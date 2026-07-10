import { sql } from "drizzle-orm";
/**
 * Pending batches schema — tracking table for in-flight Anthropic Batch API jobs.
 *
 * @module packages/db/src/schema/pending-batches
 * @description When the entity uses the Anthropic Batch API for off-hours processing
 *   (50% cost savings during overnight cycles), this table tracks each submitted batch job.
 *   The Worker polls pending batches on subsequent cycles to retrieve completed results.
 *   Batches are linked to the cycle that submitted them and track the full lifecycle
 *   from submission through completion, cancellation, or error.
 * @upstream think cycle orchestrator — inserts a record when submitting a batch job
 * @upstream batch polling routine — updates status and resultsJson when job completes
 * @downstream think cycle orchestrator — reads completed batch results to continue processing
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant batchId is unique — the Anthropic-assigned batch identifier
 * @invariant status progresses: "pending" → "processing" → "completed" | "error" | "cancelled"
 * @coupling cycles.ts — cycleId references the cycle that submitted this batch
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { cycles } from "./cycles";

/**
 * Pending batches table — lifecycle tracking for Anthropic Batch API jobs.
 * Enables asynchronous, cost-efficient processing by submitting work to the
 * Batch API and polling for results across subsequent Worker invocations.
 *
 * Key columns:
 * - batchId: Anthropic's unique identifier for this batch job (unique)
 * - customId: Internal identifier used to correlate batch results with requests
 * - cycleId: The think cycle that submitted this batch job
 * - status: "pending" | "processing" | "completed" | "error" | "cancelled"
 * - resultsJson: Batch results payload once the job completes (null while pending)
 * - errorMessage: Error description if the batch job failed
 * - trigger: What initiated this batch ("scheduled", "user_message", etc.)
 * - model: The Anthropic model requested for this batch
 * - cancelledBy: Who or what cancelled this batch (if applicable)
 * - timeoutSeconds: How long to wait before timing out this batch
 *
 * Index strategy:
 * - status index: efficiently find pending/processing batches to poll
 * - submitted index: time-ordered view of batch submissions
 * - cancelled_by index: audit queries for cancellation events
 *
 * @downstream think cycle orchestrator — polls WHERE status = "pending" on each cycle
 * @pattern async-job-tracking — decouples submission from result retrieval
 * @invariant resultsJson is set atomically with status = "completed"
 */
export const pendingBatches = sqliteTable(
  "pending_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    batchId: text("batch_id").notNull().unique(),
    customId: text("custom_id").notNull(),
    submittedAt: text("submitted_at").notNull().default(sql`(datetime('now'))`),
    cycleId: integer("cycle_id").references(() => cycles.id),
    status: text("status").notNull().default("pending"),
    completedAt: text("completed_at"),
    resultsJson: text("results_json"),
    errorMessage: text("error_message"),
    trigger: text("trigger"),
    model: text("model"),
    cancelledBy: text("cancelled_by"),
    timeoutSeconds: integer("timeout_seconds"),
  },
  (table) => [
    index("idx_pending_batches_status").on(table.status),
    index("idx_pending_batches_submitted").on(table.submittedAt),
    index("idx_pending_batches_cancelled_by").on(table.cancelledBy),
  ]
);
