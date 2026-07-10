/**
 * Web Search Route
 *
 * @module routes/search
 * @description REST endpoint for web search via SearchGateway.
 * Provides a direct API for triggering web searches without going through Clio's actions.
 *
 * @upstream Called by: index.js route handler
 * @downstream Calls: SearchGateway from @persistence/services
 */

import { SearchGateway } from '@persistence/services';
import { logHistory } from '../utils/index.js';
import type { Env } from '../bootstrap.js';
import { createDrizzleClient } from '@persistence/db';

/**
 * Handle web search request.
 *
 * POST /web-search
 * Body: { query: string, logToHistory?: boolean }
 *
 * Returns search results with metadata. Optionally logs to history.
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment bindings
 * @param {D1Database} env.DB - D1 database
 * @param {string} env.ANTHROPIC_API_KEY - API key for search
 * @returns {Promise<Response>} Search results or error
 *
 * @example
 * curl -X POST https://worker.dev/web-search \
 *   -H "Content-Type: application/json" \
 *   -d '{"query": "weather in Raleigh NC"}'
 */
export async function handleWebSearch(request: Request, env: Env) {
  try {
    const body = await request.json() as { query?: string; logToHistory?: boolean };
    const { query, logToHistory = false } = body;

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required field: query'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use SearchGateway - single entry point for all web search
    const gateway = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY ?? '');
    const result = await gateway.search(query);

    // Optionally log to history
    if (logToHistory && env.DB) {
      const db = createDrizzleClient(env.DB);
      if (result.success) {
        await logHistory({
          db,
          type: 'search_result',
          content: result.summary ?? '',
          internal: `API: ${query}`,
          metadata: result.metadata as unknown as Record<string, unknown>
        });
      } else {
        await logHistory({
          db,
          type: 'search_result',
          content: `Search failed: ${result.error}`,
          internal: `API: ${query}`,
          metadata: result.metadata as unknown as Record<string, unknown>
        });
      }
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle GET request for simple search (query string).
 *
 * GET /web-search?q=weather+in+Raleigh
 *
 * @param {URL} url - Request URL with query params
 * @param {Object} env - Environment bindings
 * @returns {Promise<Response>} Search results
 */
export async function handleWebSearchGet(url: URL, env: Env) {
  const query = url.searchParams.get('q');

  if (!query) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing query parameter: q'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const gateway = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY ?? '');
  const result = await gateway.search(query);

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
}


