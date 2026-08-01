/**
 * COLD_STORAGE Handler
 *
 * @module @persistence/tools/definitions/cold-storage/handler
 * @description Stores permanent, immutable memories that appear in every context build.
 *
 * EXECUTION FLOW:
 * 1. Receives validated parameters (content + optional internal reasoning)
 * 2. Inserts into cold_storage table with persona scoping
 * 3. Calls logHistory() to record the storage action in history timeline
 * 4. Returns success result with the stored content
 *
 * DATABASE TOUCHES:
 * - INSERT into `cold_storage` table (permanent storage)
 * - INSERT into `history` table with type='cold_storage' (audit trail)
 * - Meter snapshot automatically captured in history entry
 *
 * SIDE EFFECTS:
 * - New permanent memory appears in Block 1 of ALL FUTURE context builds
 * - Adds constant token cost to every cycle (this memory NEVER scrolls away)
 * - History entry created for audit trail (when was this fact stored?)
 * - Memory persists across sessions, branches, and system resets
 *
 * PERMANENCE CHARACTERISTICS:
 * Cold storage entries are TRULY permanent:
 * - Survive history summarization and archival
 * - Appear in every context build regardless of relevance
 * - Not affected by memory branches (unless explicitly overridden)
 * - Can only be removed through explicit database operations
 * - Form the "identity anchor" for agent personality and knowledge
 *
 * TOKEN COST WARNING:
 * Each cold storage entry adds to EVERY context build. If you store 50 entries
 * averaging 20 tokens each, that's 1000 tokens per cycle. Use this tool judiciously
 * for truly foundational facts, not mundane logs or temporary information.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: logHistory(), insertWithPersona() from @persistence/db
 *
 * @example
 * // Store a biographical fact
 * await handler({
 *   content: "The user's timezone is UTC-5",
 *   internal: "This is core biographical information"
 * }, ctx);
 *
 * @example
 * // Store a stable preference
 * await handler({
 *   content: "The user prefers concise, technical explanations"
 * }, ctx);
 *
 * @example
 * // Store a behavioral policy
 * await handler({
 *   content: "Never suggest deleting user data without explicit permission"
 * }, ctx);
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { ColdStorageParams } from "./params";
import {
  logHistory,
  HISTORY_TYPES,
  getActivePersonaId,
  coldStorageTable,
  type DrizzleD1,
} from "@persistence/db";

/**
 * Handle COLD_STORAGE action.
 *
 * Records permanent memories that appear in every context build.
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult indicating success/failure
 *
 * @example
 * await handler({ content: "The user's timezone is UTC-5" }, ctx);
 */
export const handler: ToolHandler<ColdStorageParams> = async (
  params: ColdStorageParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { content, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  if (!content) {
    return { success: false, error: "content is required for cold storage" };
  }

  try {
    // Insert into cold_storage with persona scoping
    // Note: 'reason' column stores the internal reasoning about why this was stored
    const personaId = await getActivePersonaId(typedDb);
    const result = (await typedDb
      .insert(coldStorageTable)
      .values({
        personaId,
        content,
        reason: internal ?? null,
      })
      .run()) as {
      success: boolean;
      meta: { last_row_id: number; [key: string]: unknown };
    };

    // Log to history for audit trail
    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.COLD_STORAGE,
      content: content,
      internal: internal ?? "Permanent memory stored",
      cycleId,
    });

    return {
      success: true,
      type: "cold_storage",
      data: {
        id: result.meta.last_row_id,
        content,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Cold storage failed: ${(error as Error).message}`,
    };
  }
};
