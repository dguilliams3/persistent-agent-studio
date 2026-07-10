/**
 * @description Cloudflare Worker entry point — thin shell that wires packages together
 *
 * All business logic lives in packages or platform modules:
 * - HTTP routing: ./request-handler.ts → ./routes/registry.ts
 * - Think cycle: @persistence/runtime (orchestrator)
 * - Web digests: ./services/web-digest-runner.ts
 * - Batch processing: ./services/batch-processor.ts
 *
 * This file contains ONLY:
 * 1. Imports and bootstrap
 * 2. Worker export: fetch() → handleRequest, scheduled() → cron orchestration
 */

// Bootstrap
import { createServices, type Env } from "./bootstrap.js";
import { ensureTablesExist } from "@persistence/db/migrations/runtime";

// Database
import { createDrizzleClient } from "@persistence/db";
import { getState, cleanupOrphanedCycles } from "./db/index.js";

// Services
import { processPendingBatches } from "./services/index.js";

// Runtime orchestrator
import { runThinkingCycle as runOrchestrator } from "@persistence/runtime";
import { createLLM } from "@persistence/llm";
import { createPlatformCallbacks } from "./services/cycle-adapter";

// HTTP request handler (extracted)
import { handleRequest } from "./request-handler.js";

// Web digest runner (extracted)
import { runWebDigests } from "./services/web-digest-runner.js";

// Type for batch processing callback
type ActionDecision = {
  action: string;
  content?: string;
  op?: string;
  internal?: string;
  [key: string]: unknown;
};

// ============================================
// WORKER EXPORT
// ============================================

export default {
  /**
   * @description HTTP request handler — delegates to handleRequest module
   *
   * Initializes all external services from bootstrap before routing.
   * Services are created fresh on each request (Cloudflare Workers stateless model).
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const services = await createServices(env);
    return handleRequest(request, env, ctx, services);
  },

  /**
   * @description Cron trigger handler — runs every minute via Cloudflare cron
   *
   * Execution order:
   * 1. Emergency halt check
   * 2. Atomic cycle lock (prevents duplicate cron execution)
   * 3. Process completed batch requests
   * 4. Clean up orphaned cycles
   * 5. Run thinking cycle via orchestrator
   * 6. Run web agent digests (geopolitical, tech, daily)
   * 7. Release cycle lock
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        // Ensure required tables exist (auto-migration) — raw D1 interface
        await ensureTablesExist(env.DB);

        // Drizzle client for all ORM-based db function calls
        const db = createDrizzleClient(env.DB);

        // EMERGENCY HALT CHECK - checked FIRST before ANY processing
        const emergencyHalt = await getState(db, "emergency_halt");
        if (emergencyHalt === "true") {
          console.log("[Cron] EMERGENCY HALT active - skipping ALL processing");
          return;
        }

        // ATOMIC CYCLE LOCK - prevents duplicate execution from Cloudflare cron
        // double-delivery (multiple edge nodes firing the same cron event).
        // Lock auto-expires after 5 minutes to prevent deadlocks from crashed cycles.
        await env.DB.prepare(
          `INSERT OR IGNORE INTO state (key, value) VALUES ('cycle_lock', NULL)`,
        ).run();
        const lockResult = await env.DB.prepare(
          `UPDATE state SET value = ?, updated_at = datetime('now')
         WHERE key = 'cycle_lock'
           AND (value IS NULL OR value = '' OR datetime(value) < datetime('now', '-5 minutes'))`,
        )
          .bind(new Date().toISOString())
          .run();

        if (lockResult.meta.changes === 0) {
          console.log("[Cron] Cycle lock held by another worker, skipping");
          return;
        }

        try {
          // 1. Process completed batch requests
          try {
            const batchResult = await processPendingBatches(env, {
              streamActionToTelegram: async (
                db: D1Database,
                action: Record<string, unknown>,
                envParam: Env,
              ) => {
                void db;
                void action;
                void envParam;
              },
            });
            if (batchResult.processed > 0) {
              console.log(
                `[Cron] Processed ${batchResult.processed} completed batch(es)`,
              );
            }
            if (batchResult.errors.length > 0) {
              console.error(
                `[Cron] Batch processing errors:`,
                batchResult.errors,
              );
            }
          } catch (e: unknown) {
            console.error("[Cron] Error in batch processing:", e);
          }

          // 2. Clean up orphaned cycles
          try {
            const cleaned = await cleanupOrphanedCycles(db);
            if (cleaned > 0) {
              console.log(`[Cron] Cleaned up ${cleaned} orphaned cycle(s)`);
            }
          } catch (e: unknown) {
            console.error("[Cron] Error cleaning up orphaned cycles:", e);
          }

          // 3. Run thinking cycle via orchestrator
          const callbacks = createPlatformCallbacks(env);
          const llm = createLLM({
            get: (key: string) => (env as Record<string, string>)[key] || "",
          });
          const cycleResult = await runOrchestrator(
            { db, llm, callbacks },
            { fromCron: true },
          );
          if (cycleResult.skipped) {
            console.log(`[Cron] Thinking cycle skipped: ${cycleResult.reason}`);
          } else if (cycleResult.success) {
            console.log(`[Cron] Thinking cycle completed`);
          } else if (cycleResult.error) {
            console.log(`[Cron] Thinking cycle error: ${cycleResult.error}`);
          }

          // 4. Run web agent digests
          try {
            await runWebDigests(env);
          } catch (e: unknown) {
            console.error(
              "[Cron] Web agent digest error:",
              e instanceof Error ? e.message : String(e),
            );
          }
        } finally {
          // Always release cycle lock AND anti-cascade flag, even on error.
          // The anti-cascade flag (quick_followup_active) is set inside the orchestrator
          // when a quick followup fires. Clearing here prevents it from getting stuck.
          try {
            await env.DB.prepare(
              `UPDATE state SET value = NULL WHERE key IN ('cycle_lock', 'quick_followup_active')`,
            ).run();
          } catch (cleanupErr: unknown) {
            console.error(
              "[Cron] Failed to release cycle lock:",
              cleanupErr instanceof Error
                ? cleanupErr.message
                : String(cleanupErr),
            );
          }
        }
      })(),
    );
  },
};
