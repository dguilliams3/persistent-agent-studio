/**
 * Route index — startup-time indexing and per-request lookup.
 *
 * @module routing/route-index
 * @description Parses route map keys, builds pre-indexed lookup structures,
 * and provides the findRoute function used by the dispatcher. Separated
 * from matcher.ts to keep both files within the 150-line limit.
 *
 * @upstream Called by: dispatcher.ts (createDispatcher)
 * @downstream Calls: matchPath, normalizePath from matcher.ts
 *
 * @antipattern Do NOT call buildRouteIndex on every request. It is an
 * O(n) startup cost that must be paid once, not per request.
 */

import type { RouteContext } from './RouteContext';
import type { RouteHandler } from './RouteMap';
import { matchPath, normalizePath } from './matcher';

/** Result of a successful route match. */
export interface RouteMatch<TContext extends RouteContext = RouteContext> {
  handler: RouteHandler<TContext>;
  params: Record<string, string>;
}

/**
 * Distinguishes "no route" from "wrong method" so callers
 * can return 404 vs 405 as appropriate.
 */
export type FindRouteResult<TContext extends RouteContext = RouteContext> =
  | { found: true; match: RouteMatch<TContext> }
  | { found: false; methodNotAllowed: boolean };

/** Pre-indexed route structures for fast per-request lookup. */
export interface RouteIndex<TContext extends RouteContext = RouteContext> {
  exactRoutes: Map<string, RouteHandler<TContext>>;
  parameterizedRoutes: Array<[string, string, RouteHandler<TContext>]>;
  knownPaths: Set<string>;
  knownPatterns: Array<[string, string]>;
}

/**
 * Parse a route map key into its method and path components.
 * Normalizes method to uppercase. Throws at registration time
 * if the key is malformed.
 *
 * @param routeKey - Route key in "METHOD /path" format (e.g., "GET /history")
 * @returns Tuple of [method, path]
 * @throws Error if the key is missing a method or path
 */
export function parseRouteKey(routeKey: string): [string, string] {
  const spaceIndex = routeKey.indexOf(' ');
  if (spaceIndex <= 0) {
    throw new Error(
      `Invalid route key "${routeKey}": must be "METHOD /path" (e.g., "GET /history")`,
    );
  }
  const method = routeKey.slice(0, spaceIndex).toUpperCase();
  const path = routeKey.slice(spaceIndex + 1);
  if (!path.startsWith('/')) {
    throw new Error(
      `Invalid route key "${routeKey}": path must start with "/" (e.g., "GET /history")`,
    );
  }
  return [method, path];
}

/**
 * Find a matching route for a given method and path.
 *
 * Normalizes trailing slashes, checks exact matches first (O(1)),
 * then parameterized patterns. Distinguishes 404 from 405.
 *
 * @param index - Pre-built route index from buildRouteIndex
 * @param method - HTTP method (GET, POST, etc.)
 * @param requestPath - Request path (e.g., '/gallery/42/blur')
 * @returns FindRouteResult distinguishing match, not-found, and method-not-allowed
 */
export function findRoute<TContext extends RouteContext>(
  index: RouteIndex<TContext>,
  method: string,
  requestPath: string,
): FindRouteResult<TContext> {
  const path = normalizePath(requestPath);
  const upperMethod = method.toUpperCase();

  const exactKey = `${upperMethod} ${path}`;
  const exactHandler = index.exactRoutes.get(exactKey);
  if (exactHandler) {
    return { found: true, match: { handler: exactHandler, params: {} } };
  }

  for (const [routeMethod, routePattern, handler] of index.parameterizedRoutes) {
    if (routeMethod !== upperMethod) continue;
    const params = matchPath(routePattern, path);
    if (params) {
      return { found: true, match: { handler, params } };
    }
  }

  const pathExists = index.knownPaths.has(path) ||
    index.knownPatterns.some(([, pattern]) => matchPath(pattern, path) !== null);

  return { found: false, methodNotAllowed: pathExists };
}

/**
 * Pre-process a route map into indexed structures for fast lookup.
 *
 * Separates exact routes (O(1) Map lookup) from parameterized routes
 * (sequential matching). Normalizes methods to uppercase. Call once
 * at startup, reuse the index for every request.
 *
 * @param routeMap - The route map to index
 * @returns RouteIndex with all pre-computed lookup structures
 * @throws Error if any route key is malformed
 */
export function buildRouteIndex<TContext extends RouteContext>(
  routeMap: Record<string, RouteHandler<TContext>>,
): RouteIndex<TContext> {
  const exactRoutes = new Map<string, RouteHandler<TContext>>();
  const parameterizedRoutes: Array<[string, string, RouteHandler<TContext>]> = [];
  const knownPaths = new Set<string>();
  const knownPatterns: Array<[string, string]> = [];

  for (const [routeKey, handler] of Object.entries(routeMap)) {
    const [method, path] = parseRouteKey(routeKey);
    const normalizedKey = `${method} ${path}`;

    if (path.includes(':')) {
      parameterizedRoutes.push([method, path, handler]);
      if (!knownPatterns.some(([, existing]) => existing === path)) {
        knownPatterns.push([method, path]);
      }
    } else {
      exactRoutes.set(normalizedKey, handler);
      knownPaths.add(path);
    }
  }

  return { exactRoutes, parameterizedRoutes, knownPaths, knownPatterns };
}
