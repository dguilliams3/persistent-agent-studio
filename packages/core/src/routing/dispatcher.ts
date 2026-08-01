/**
 * Generic HTTP request dispatcher.
 *
 * @module routing/dispatcher
 * @description The core dispatch loop: parse request -> match route ->
 * build context -> call handler -> format response. Platform-agnostic;
 * platform layers provide a context factory to attach their own bindings
 * (db, env, CORS headers) without modifying this module.
 *
 * Dispatch flow:
 *   1. Parse URL and method from Request
 *   2. Parse body (JSON) for non-GET/HEAD methods
 *   3. findRoute — O(1) exact match, O(p) parameterized fallback
 *   4. If no match: return 404 or 405 based on FindRouteResult
 *   5. buildContext — platform layer attaches db/env/etc.
 *   6. handler(context) — returns RouteResult or raw Response
 *   7. If handler throws: return 500 with error message
 *   8. If RouteResult: serialize to JSON Response with merged headers
 *   9. If raw Response: inject default headers if missing, pass through
 *
 * @upstream Called by: platform entry points (e.g., Cloudflare Worker fetch())
 * @downstream Calls: buildRouteIndex, findRoute from matcher.ts; matched handler functions
 *
 * @antipattern Do NOT add platform-specific logic here. This module
 * knows nothing about Cloudflare, D1, Env bindings, or CORS. The platform
 * layer handles those concerns via DispatcherConfig.buildContext and
 * DispatcherConfig.defaultHeaders.
 */

import type { RouteContext } from './RouteContext';
import type { RouteResult, HandlerReturn } from './RouteResult';
import type { RouteHandler } from './RouteMap';
import { findRoute, buildRouteIndex } from './route-index';

/** Methods that never have a request body. */
const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Configuration for creating a dispatcher.
 *
 * @typeParam TContext - Platform-specific context extending RouteContext
 */
export interface DispatcherConfig<TContext extends RouteContext> {
  /** The route map: "METHOD /path" -> handler */
  routes: Record<string, RouteHandler<TContext>>;

  /**
   * Build a platform-specific context from the base RouteContext.
   * Called after route matching, before handler invocation.
   * Use this to attach db, env, CORS headers, etc.
   */
  buildContext: (baseContext: RouteContext) => TContext | Promise<TContext>;

  /**
   * Optional: inject headers into every response (e.g., CORS, cache).
   * Applied to both JSON-serialized RouteResult responses and raw Response
   * pass-throughs (if the header is not already set).
   */
  defaultHeaders?: (context: TContext, path: string, method: string) => Record<string, string>;
}

/**
 * Create a request dispatcher from a route map and platform config.
 *
 * Call once at startup. Returns a dispatch function that handles
 * individual requests. Returns a Response for every matched route
 * (including errors), or null when no route matches at all.
 *
 * @param config - Route map, context factory, and optional default headers
 * @returns Async dispatch function: (request: Request) => Promise<Response | null>
 */
export function createDispatcher<TContext extends RouteContext>(
  config: DispatcherConfig<TContext>,
): (request: Request) => Promise<Response | null> {
  const routeIndex = buildRouteIndex(config.routes);

  return async function dispatch(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const routeResult = findRoute(routeIndex, method, path);

    if (!routeResult.found) {
      if (routeResult.methodNotAllowed) {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null; // 404 — caller handles
    }

    // Parse request body for methods that carry one
    const body = BODYLESS_METHODS.has(method)
      ? null
      : await request.json().catch(() => null);

    const baseContext: RouteContext = {
      request,
      url,
      method,
      params: routeResult.match.params,
      query: url.searchParams,
      body,
    };

    const context = await config.buildContext(baseContext);

    let result: HandlerReturn;
    try {
      result = await routeResult.match.handler(context);
    } catch (handlerError) {
      const errorMessage = handlerError instanceof Error
        ? handlerError.message
        : String(handlerError);
      console.error(`[dispatcher] Handler error on ${method} ${path}:`, handlerError);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const getDefaultHeaders = () =>
      config.defaultHeaders ? config.defaultHeaders(context, path, method) : {};

    // Handler returned a raw Response — inject default headers if missing
    if (result instanceof Response) {
      const defaults = getDefaultHeaders();
      if (Object.keys(defaults).length === 0) {
        return result;
      }
      const mergedHeaders = new Headers(result.headers);
      for (const [headerName, headerValue] of Object.entries(defaults)) {
        if (!mergedHeaders.has(headerName)) {
          mergedHeaders.set(headerName, headerValue);
        }
      }
      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers: mergedHeaders,
      });
    }

    // Handler returned a RouteResult — serialize to JSON Response
    const routeData = result as RouteResult;
    const status = routeData.status ?? 200;

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getDefaultHeaders(),
      ...routeData.headers,
    };

    return new Response(JSON.stringify(routeData.data), {
      status,
      headers: responseHeaders,
    });
  };
}
