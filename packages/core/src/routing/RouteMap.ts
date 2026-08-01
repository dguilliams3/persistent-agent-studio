/**
 * Route map — the data-driven registry of URL patterns to handlers.
 *
 * @module routing/RouteMap
 * @description Type definition for the route map data structure. A single
 * object that documents ALL endpoints in one place, replacing if/elseif
 * chains with a declarative, scannable registry.
 *
 * @upstream Defined by: platform entry point (e.g., platforms/cloudflare/src/routes.ts)
 * @downstream Consumed by: dispatcher.ts (via buildRouteIndex in matcher.ts)
 *
 * @pattern data-driven-registry — routing configuration is data (a plain object),
 * not imperative code (an if/elseif chain). A single generic dispatcher traverses
 * the data. Adding a new route = adding one key-value pair. No branching logic,
 * no ordering dependencies.
 *
 * @antipattern Do NOT split route definitions across multiple files.
 * The route map is ONE file that serves as the API's table of contents.
 * Handler implementations live elsewhere; only the wiring lives here.
 * Splitting routes across files destroys the "one place to see all endpoints"
 * guarantee that makes the registry valuable.
 *
 * @example
 * const routeMap: RouteMap<AppContext> = {
 *   'GET /history': getHistory,
 *   'GET /state/:key': getState,
 *   'POST /state': setState,
 *   'GET /personas': listPersonas,
 *   'DELETE /gallery/:id': deleteGalleryImage,
 * };
 */

import type { RouteContext } from './RouteContext';
import type { HandlerReturn } from './RouteResult';

/**
 * A route handler function.
 *
 * @description Receives a RouteContext (or platform-extended subtype) and returns
 * either a RouteResult (JSON-serializable) or a raw Response. Handlers are the
 * HTTP translation layer only: parse inputs from context, call a domain function,
 * return the result. No business logic or database queries belong here.
 *
 * @typeParam TContext - Platform-specific context extending RouteContext
 *
 * @example
 * const handleGetHistory: RouteHandler<AppContext> = async (context) => {
 *   const personaId = Number(context.params.personaId);
 *   const history = await fetchHistory(context.db, personaId);
 *   return { data: history };
 * };
 */
export type RouteHandler<TContext extends RouteContext = RouteContext> =
  (context: TContext) => Promise<HandlerReturn> | HandlerReturn;

/**
 * Data-driven route registry.
 *
 * @description Keys are `"METHOD /path/pattern"` strings (e.g., `"GET /history"`).
 * Values are handler functions. Path segments starting with `:` are
 * treated as parameters (e.g., `"GET /gallery/:id"`). The dispatcher reads this
 * map at startup via buildRouteIndex, which pre-partitions exact and parameterized
 * routes for efficient per-request lookup.
 *
 * @typeParam TContext - Platform-specific context extending RouteContext
 *
 * @example
 * const routes: RouteMap<CloudflareRouteContext> = {
 *   'GET /state': handleGetState,
 *   'POST /message': handlePostMessage,
 *   'GET /gallery/:id': handleGetGalleryById,
 * };
 */
export type RouteMap<TContext extends RouteContext = RouteContext> =
  Record<string, RouteHandler<TContext>>;
