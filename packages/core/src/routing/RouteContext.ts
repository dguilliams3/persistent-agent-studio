/**
 * Route context — the standardized input every route handler receives.
 *
 * @module routing/RouteContext
 * @description Platform-agnostic context object constructed by the dispatcher
 * before calling a matched handler. Contains parsed request data and
 * platform bindings needed to service the request.
 *
 * @upstream Constructed by: dispatcher.ts (createDispatcher)
 * @downstream Consumed by: route handler functions registered in RouteMap
 *
 * @pattern context-object — carries all inputs needed by a handler through
 * a single typed parameter, avoiding long argument lists and enabling
 * platform extension without changing handler signatures.
 *
 * @antipattern Do NOT add platform-specific fields here (e.g., Cloudflare
 * Env bindings, D1Database). Those belong in the platform layer's extended
 * context type. This interface covers only what is universally needed for
 * routing and must remain platform-agnostic.
 *
 * @example
 * // Platform-specific extension pattern
 * interface CloudflareRouteContext extends RouteContext {
 *   db: D1Database;
 *   env: Env;
 *   executionContext: ExecutionContext;
 * }
 */

/**
 * Core fields every route handler receives from the dispatcher.
 *
 * @description Platform layers extend this with their own bindings (db, env, etc.)
 * via interface extension. Handlers typed to a subinterface receive both the
 * base fields below and any platform-specific additions.
 */
export interface RouteContext {
  /** Original HTTP request */
  request: Request;

  /** Parsed URL from the request */
  url: URL;

  /** HTTP method (uppercase: GET, POST, PUT, DELETE) */
  method: string;

  /** Path parameters extracted from the URL pattern (e.g., { id: '42' }) */
  params: Record<string, string>;

  /** Query parameters from the URL search string */
  query: URLSearchParams;

  /** Parsed request body (JSON). Null for GET/HEAD requests. */
  body: unknown;
}
