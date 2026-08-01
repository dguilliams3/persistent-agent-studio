/**
 * @persistence/core/routing — Generic HTTP routing infrastructure
 *
 * @module routing
 * @description Data-driven route dispatch system. Platform-agnostic types
 * and functions for matching requests to handlers via a declarative route map.
 * All exports are re-exports from the sub-modules; no logic lives here.
 *
 * ## Exports
 *
 * **Types:** RouteContext, RouteResult, HandlerReturn, RouteMap, RouteHandler, RouteMatch
 * **Functions:** createDispatcher, matchPath, findRoute, buildRouteIndex, parseRouteKey
 * **Config:** DispatcherConfig
 *
 * @upstream Imported by: platform entry points (e.g., platforms/cloudflare/src/index.ts)
 * @downstream Re-exports from: RouteContext.ts, RouteResult.ts, RouteMap.ts,
 *             matcher.ts, dispatcher.ts
 *
 * @pattern barrel-re-export — consumers import from '@persistence/core/routing'
 * without needing to know the internal file structure. Internal reorganization
 * is non-breaking as long as this barrel re-exports the same surface.
 *
 * @example
 * import { createDispatcher, type RouteMap, type RouteContext } from '@persistence/core/routing';
 *
 * interface AppContext extends RouteContext { db: D1Database; env: Env; }
 *
 * const routes: RouteMap<AppContext> = {
 *   'GET /history': getHistory,
 *   'POST /message': postMessage,
 * };
 *
 * const dispatch = createDispatcher({
 *   routes,
 *   buildContext: (base) => ({ ...base, db, env }),
 * });
 */

export type { RouteContext } from './RouteContext';
export type { RouteResult, HandlerReturn } from './RouteResult';
export type { RouteHandler, RouteMap } from './RouteMap';
export { matchPath, normalizePath } from './matcher';
export type { RouteMatch, FindRouteResult, RouteIndex } from './route-index';
export { findRoute, buildRouteIndex, parseRouteKey } from './route-index';
export type { DispatcherConfig } from './dispatcher';
export { createDispatcher } from './dispatcher';
