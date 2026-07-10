/**
 * HTTP Route Matching Utilities
 *
 * @module routes/matcher
 * @description Route matching with URL parameter extraction.
 *
 * Supports two types of routes:
 * - Exact paths: `/state`, `/history`
 * - Parameterized paths: `/branches/:name/activate`, `/gallery/:id/blur`
 *
 * Parameter names in patterns (e.g., `:name`, `:id`) are extracted and provided
 * to handlers via ctx.params.
 *
 * @upstream Called by: dispatchRoute() in registry.js
 * @downstream Calls: None (pure functions)
 *
 * @example
 * matchRoute('/branches/:name/activate', '/branches/main/activate')
 * // Returns: { match: true, params: { name: 'main' } }
 *
 * matchRoute('/state', '/state')
 * // Returns: { match: true, params: {} }
 *
 * matchRoute('/state', '/history')
 * // Returns: null
 */

/**
 * @description Match a path against a route pattern
 *
 * Supports exact matches and parameterized segments.
 * Parameters are denoted with `:` prefix (e.g., `:id`, `:name`).
 *
 * @upstream Called by: findRoute()
 * @downstream Calls: None
 *
 * @param {string} pattern - Route pattern (e.g., '/branches/:name/activate')
 * @param {string} path - Actual request path (e.g., '/branches/main/activate')
 * @returns {{match: true, params: Object}|null} Match result or null
 *
 * @example
 * // Exact match
 * matchRoute('/state', '/state')
 * // => { match: true, params: {} }
 *
 * // Parameterized match
 * matchRoute('/gallery/:id/blur', '/gallery/123/blur')
 * // => { match: true, params: { id: '123' } }
 *
 * // No match - different structure
 * matchRoute('/branches/:name', '/branches/main/activate')
 * // => null
 */
export function matchRoute(pattern: string, path: string): { match: true; params: Record<string, string> } | null {
  // Handle exact match (no parameters)
  if (!pattern.includes(':')) {
    return pattern === path ? { match: true, params: {} } : null;
  }

  // Handle parameterized route
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  // Must have same number of segments
  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      // This is a parameter - extract the value
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      // Static segment doesn't match
      return null;
    }
  }

  return { match: true, params };
}

/**
 * @description Find a matching route in the registry
 *
 * First checks for exact path matches (O(1) lookup), then falls back to
 * parameterized route matching (O(n) worst case).
 *
 * @upstream Called by: dispatchRoute() in registry.js
 * @downstream Calls: matchRoute()
 *
 * @param {Object} registry - Route registry (path -> { method -> handler })
 * @param {string} path - Request path
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @returns {{ handler: Function, params: Object }|null} Handler and params, or null
 *
 * @example
 * const result = findRoute(ROUTE_REGISTRY, '/branches/main/activate', 'PUT');
 * if (result) {
 *   return result.handler({ ...ctx, params: result.params });
 * }
 */
/** Route handler function type */
export type RouteHandler = (_ctx: unknown) => Promise<Response | Record<string, unknown>>;

/** Route registry shape: path -> method -> handler */
export type RouteRegistry = Record<string, Record<string, RouteHandler>>;

export function findRoute(registry: RouteRegistry, path: string, method: string): { handler: RouteHandler; params: Record<string, string> } | null {
  // Fast path: check exact matches first (O(1) lookup)
  if (registry[path] && registry[path][method]) {
    return { handler: registry[path][method], params: {} };
  }

  // Slow path: check parameterized routes
  for (const [pattern, methods] of Object.entries(registry)) {
    // Skip exact paths (already checked above)
    if (!pattern.includes(':')) continue;

    const result = matchRoute(pattern, path);
    const methodMap = methods as Record<string, RouteHandler>;
    if (result && methodMap[method]) {
      return { handler: methodMap[method], params: result.params };
    }
  }

  return null;
}
