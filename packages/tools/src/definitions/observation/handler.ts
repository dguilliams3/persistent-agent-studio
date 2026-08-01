/**
 * OBSERVATION Handler
 *
 * @module @persistence/tools/definitions/observation/handler
 * @description Manages observations about the user (save/get/delete).
 *
 * Observations are structured insights about the user's behavior, preferences, or patterns.
 * Uses soft delete - deleted observations have deleted_at set rather than being removed.
 * Saving to an existing title updates it; saving to a soft-deleted title restores it.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: logHistory() from @persistence/db/history-logger,
 *   getObservation(), saveObservation(), deleteObservation() from @persistence/db
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   Handlers should NOT contain raw SQL queries (db.prepare, insertWithPersona, etc.).
 *   Instead, call high-level functions from @persistence/db that encapsulate the SQL.
 *   This keeps handlers focused on validation/orchestration, not database details.
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { ObservationParams } from "./params";
import {
  logHistory,
  HISTORY_TYPES,
  type DrizzleD1,
  getObservation,
  saveObservation,
  deleteObservation,
} from "@persistence/db";

/**
 * Handle OBSERVATION action.
 *
 * Manages observation entries (save/get/delete).
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult indicating success/failure
 *
 * @example
 * await handler({ op: "save", title: "Energy Patterns", content: "..." }, ctx);
 */
export const handler: ToolHandler<ObservationParams> = async (
  params: ObservationParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { op, title, content, summary, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  try {
    switch (op) {
      case "save": {
        if (!content) {
          return {
            success: false,
            error: "content is required for save operation",
          };
        }
        const safeTitle = title ?? "Untitled";

        const result = await saveObservation(
          typedDb,
          safeTitle,
          content,
          summary ?? "",
        );

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.OBSERVATION_SAVED,
          content: `${result.action === "created" ? "Created" : result.action === "restored" ? "Restored" : "Updated"} observation: "${safeTitle}"`,
          internal: internal ?? `Observation ${result.action}`,
          cycleId,
        });

        return {
          success: true,
          type: "observation_saved",
          data: { action: result.action, id: result.id, title: safeTitle },
        };
      }

      case "get": {
        const obs = await getObservation(typedDb, title ?? "");

        if (!obs) {
          return {
            success: false,
            error: `Observation not found: "${title}"`,
          };
        }

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.OBSERVATION_RETRIEVED,
          content: `Retrieved observation: "${obs.title}"`,
          internal: internal ?? "Observation retrieved",
          cycleId,
        });

        return {
          success: true,
          type: "observation_retrieved",
          data: obs,
        };
      }

      case "delete": {
        const result = await deleteObservation(typedDb, title ?? "");

        if (!result.success) {
          return { success: false, error: `Observation not found: "${title}"` };
        }

        return {
          success: true,
          type: "observation_deleted",
          data: { title: result.title },
        };
      }

      default:
        return { success: false, error: `Unknown operation: ${op}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Observation operation failed: ${(error as Error).message}`,
    };
  }
};
