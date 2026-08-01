/**
 * Aggregate Queries
 *
 * @module @persistence/db/aggregates
 * @description Composite orchestrators that fetch multiple tables in parallel
 *   and return unified views. These are read-only aggregations with no mutations.
 *
 * Use aggregates when:
 * - Frontend needs data from multiple tables in one request
 * - Multiple queries can be parallelized for efficiency
 * - A "dashboard view" is needed
 *
 * @upstream Called by: Route handlers in platforms/cloudflare
 * @downstream Calls: Individual table query functions
 */

