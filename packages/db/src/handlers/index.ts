/**
 * Handler functions barrel
 *
 * @module @persistence/db/handlers
 * @description Re-exports all handler functions from domain-specific modules.
 *
 * These handlers accept typed params and db, returning response-ready shapes.
 * Platform wiring wraps results into HTTP Response objects.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/
 */

export * from './data';
export * from './settings';
export * from './branches';
export * from './actions';
export * from './personas';
export * from './knowledge';
export * from './gallery';
