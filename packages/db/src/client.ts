/**
 * Drizzle D1 client factory
 *
 * @module @persistence/db/client
 * @description Creates a typed Drizzle ORM client wrapping a Cloudflare D1 binding.
 *   All query-builder usage throughout the package imports DrizzleD1 from here.
 *
 *   DrizzleD1 is the inferred return type of createDrizzleClient() — it is NOT a
 *   re-export or alias of Cloudflare's D1Database binding type. Consumer code should
 *   always type its `db` parameters as DrizzleD1, never as D1Database.
 *
 *   Raw SQL escape hatch: when Drizzle's query builder cannot express a query
 *   (e.g. REPLACE INTO, complex subqueries, julianday arithmetic), access the
 *   underlying D1 binding via `db.$client`. Use `db.$client.prepare(sql).bind(...).run()`
 *   for mutations and `.all()` / `.first()` for reads.
 *
 * @upstream Called by: all db modules that need the Drizzle client type
 * @downstream Calls: drizzle-orm/d1
 * @pattern factory — single creation point for the typed client
 * @antipattern DO NOT type db parameters as D1Database — use DrizzleD1 from this module.
 *   D1Database is the raw Cloudflare binding; DrizzleD1 is the Drizzle-wrapped client with
 *   full query-builder support. Mixing the two types forces unnecessary casts.
 * @antipattern DO NOT call .prepare() directly on a DrizzleD1 instance — it does not exist
 *   on the Drizzle wrapper. Access the raw binding via db.$client first, then call
 *   db.$client.prepare(sql).
 */
import { drizzle } from "drizzle-orm/d1";
import type { AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DrizzleD1 = ReturnType<typeof createDrizzleClient>;

export function createDrizzleClient(d1: AnyD1Database) {
  return drizzle(d1, { schema });
}
