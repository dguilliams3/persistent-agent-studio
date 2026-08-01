/**
 * Drizzle Kit configuration — schema source and migration output settings for packages/db.
 *
 * @module packages/db/drizzle.config
 * @description Configures drizzle-kit for migration generation and schema introspection.
 *   Points to the schema barrel directory (./src/schema) so drizzle-kit discovers all
 *   table definitions via the index.ts barrel. Migration SQL files are written to ./drizzle.
 *   Targets Cloudflare D1 (SQLite dialect).
 * @upstream drizzle-kit CLI — `drizzle-kit generate` reads this config to produce migrations
 * @downstream ./drizzle/ — generated migration SQL files land here for D1 deployment
 * @pattern split-schema — schema source is a directory of domain-scoped files, not a single file
 * @invariant dialect must remain "sqlite" — the runtime is Cloudflare D1 (SQLite-compatible)
 * @coupling packages/db/src/schema/index.ts — the schema directory entry point
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema",
  out: "./drizzle",
});
