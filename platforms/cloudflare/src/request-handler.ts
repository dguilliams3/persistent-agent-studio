/**
 * @description HTTP request handler for the Cloudflare Worker API
 *
 * Routes requests through JWT auth middleware, then dispatches via the route registry.
 * Handles CORS, body parsing, and cache headers.
 *
 * @upstream Called by: Worker fetch() handler in index.ts
 * @downstream Calls: dispatchRoute() (registry), route handlers
 */

import type { Env, Services } from './bootstrap.js';
import { extractToken, verifyToken } from './utils/jwt.js';
import { ensureTablesExist } from '@persistence/db/migrations/runtime';
import { createDrizzleClient } from '@persistence/db';
import { dispatchRoute } from './routes/registry.js';
import { buildSystemPrompt } from './prompts/index.js';
import { runThinkingCycle as runOrchestrator } from '@persistence/runtime';
import { createPlatformCallbacks } from './services/cycle-adapter';

/**
 * @description HTTP Cache-Control headers by endpoint
 *
 * Tiered caching strategy with stale-while-revalidate (SWR):
 * - STATIC (24hr): Data that only changes on redeploy
 * - LOW_FREQ (5min + 1hr SWR): User-initiated changes only
 * - MEDIUM_FREQ (30s + 10min SWR): May change each cycle
 * - HIGH_FREQ (5s + 30s SWR): Critical fresh data
 */
const CACHE_HEADERS: Record<string, string> = {
  // TIER 1: STATIC (24-hour cache) - only changes on redeploy
  '/pricing': 'public, max-age=86400',

  // TIER 2: LOW FREQUENCY - user-initiated only
  '/personas': 'private, no-store',
  '/personas/active': 'private, no-store',
  '/branches': 'private, no-store',
  '/branches/active': 'private, no-store',
  '/observations': 'private, no-store',
  '/reminders': 'private, no-store',
  '/learned': 'private, no-store',
  '/questions': 'private, no-store',
  '/notebook': 'private, no-store',
  '/glossary': 'private, no-store',
  '/profile-picture': 'private, no-store',
  '/user-status': 'private, no-store',
  '/tts-model': 'private, no-store',
  '/sum-model': 'private, no-store',
  '/memory/synthetic': 'private, no-store',
  '/rag': 'private, no-store',
  '/sim/embeddings/status': 'private, no-store',
  '/sim/embeddings/export': 'private, no-store',

  // TIER 3: MEDIUM FREQUENCY - may change per cycle
  '/cold-storage': 'private, no-store',
  '/summaries': 'private, no-store',
  '/gallery': 'private, no-store',
  '/pinned-images': 'private, no-store',
  '/cycles': 'private, no-store',
  '/voice-history': 'private, no-store',

  // TIER 4: HIGH FREQUENCY - critical fresh data
  '/state': 'private, no-store',
  '/history': 'private, no-store',
  '/meters': 'private, no-store',
};

/**
 * @description Main HTTP request router with service dependency injection
 *
 * Services are initialized once per request in the fetch() handler and passed here.
 * This enables testing with mock services and keeps service initialization centralized.
 *
 * @param {Request} request - The incoming HTTP request
 * @param {Object} env - Environment bindings (DB, secrets, AI binding)
 * @param {Object} ctx - Execution context (waitUntil, passThroughOnException)
 * @param {Object} services - Initialized service instances from bootstrap
 * @returns {Promise<Response>} HTTP response
 */
export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext, _services: Services): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const db = createDrizzleClient(env.DB);

  const requestOrigin = request.headers.get('Origin');
  const configuredOrigins = (String(env.CORS_ALLOWED_ORIGINS || env.FRONTEND_ORIGIN || ''))
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    url.origin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...configuredOrigins
  ]);

  if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
    return Response.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const allowOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : null;

  // Ensure required tables exist (auto-migration) — needs raw D1 binding, not Drizzle
  await ensureTablesExist(env.DB);

  // CORS headers
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (allowOrigin) {
    corsHeaders['Access-Control-Allow-Origin'] = allowOrigin;
    corsHeaders['Vary'] = 'Origin';
  }

  /**
   * @description Get combined headers for a response (CORS + Cache-Control)
   */
  const getResponseHeaders = (pathname: string, method = 'GET') => {
    // Never cache mutations
    if (method !== 'GET') {
      return { ...corsHeaders, 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };
    }
    // Strip query params for cache lookup
    const basePath = pathname.split('?')[0];
    const cacheControl = CACHE_HEADERS[basePath] || 'no-cache';
    return { ...corsHeaders, 'Cache-Control': cacheControl };
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // =========================================================================
  // JWT AUTH MIDDLEWARE
  // =========================================================================
  const AUTH_EXEMPT_PREFIXES = ['/auth/', '/health'];
  const isAuthExempt = AUTH_EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix));

  if (!isAuthExempt) {
    const jwtSecret = env.JWT_SECRET as string;
    if (!jwtSecret) {
      return Response.json(
        { error: 'Authentication not configured' },
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Media GETs may carry the JWT as a query param: <img> tags cannot set an
    // Authorization header, so R2-backed thumbnails 401'd and the Media view
    // rendered nothing but broken images (RUN-20260704-1520). The frontend's
    // resolveMediaUrl appends ?token=<jwt> for exactly this path.
    let token = extractToken(request);
    if (!token && request.method === 'GET' && path.startsWith('/media/')) {
      token = url.searchParams.get('token');
    }
    if (!token) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer', ...corsHeaders } }
      );
    }

    const payload = await verifyToken(token, jwtSecret);
    if (!payload) {
      return Response.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer', ...corsHeaders } }
      );
    }
  }

  try {
    // Parse body once for POST/PUT/DELETE (reusable by handlers)
    let body = null;
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      try {
        const clonedRequest = request.clone();
        const rawBody = await clonedRequest.text();

        if (!rawBody || !rawBody.trim()) {
          body = {};
        } else {
          body = JSON.parse(rawBody);
        }
      } catch {
        return Response.json(
          { error: 'Malformed JSON request body' },
          { status: 400, headers: getResponseHeaders(path, request.method) }
        );
      }
    }

    // Build context object for registry handlers
    const routeCtx = {
      db,
      env,
      request,
      url,
      body,
      corsHeaders,
      getResponseHeaders,
      buildSystemPrompt,
      runOrchestrator,
      createPlatformCallbacks,
      executionCtx: ctx,
      params: {}
    };

    // GET /media/* - Serve media from R2 storage (wildcard path)
    if (path.startsWith('/media/') && request.method === 'GET') {
      const { handleMediaGet } = await import('./routes/media.js');
      return handleMediaGet(request, env);
    }

    // Try registry dispatch
    const registryResponse = await dispatchRoute(path, request.method, routeCtx as any);
    if (registryResponse) {
      return registryResponse as Response;
    }

    // All routes are now in the registry — return 404 for unmatched paths
    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });

  } catch (e: unknown) {
    console.error('API error:', e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500, headers: corsHeaders });
  }
}
