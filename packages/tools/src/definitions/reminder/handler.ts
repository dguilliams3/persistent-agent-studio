/**
 * REMINDER Handler
 *
 * @module @persistence/tools/definitions/reminder/handler
 * @description Sets or dismisses reminders that persist across thinking cycles.
 *
 * Reminder conditions:
 * - 'persistent' (default): Always shown in context
 * - 'next_user_message': Only shown when user sends a new message
 * - 'after:YYYY-MM-DD': Only shown after the specified date
 *
 * Uses soft delete - dismissed reminders have dismissed_at set rather than being removed.
 * MAX_REMINDERS limit (default 5) is enforced by the platform layer.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: logHistory() from @persistence/db/history-logger,
 *   addReminder(), dismissReminder() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { ReminderParams } from "./params";
import { normalizeId } from "../../utils/normalize";
import {
  logHistory,
  HISTORY_TYPES,
  type DrizzleD1,
  addReminder,
  dismissReminder,
} from "@persistence/db";

/**
 * Handle REMINDER action.
 *
 * Sets or dismisses reminders.
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult indicating success/failure
 *
 * @example
 * await handler({ op: "set", content: "Ask the user...", condition: "persistent" }, ctx);
 */
export const handler: ToolHandler<ReminderParams> = async (
  params: ReminderParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { op, content, condition, id, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  try {
    switch (op) {
      case "set": {
        if (!content) {
          return {
            success: false,
            error: "content is required for set operation",
          };
        }

        const result = await addReminder(
          typedDb,
          content,
          condition ?? "persistent",
        );

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.REMINDER_SET,
          content: `Set reminder: "${content}" (${result.condition})`,
          internal: internal ?? "Reminder created",
          cycleId,
        });

        return {
          success: true,
          type: "reminder_set",
          data: { ...result, content },
        };
      }

      case "dismiss": {
        if (id === undefined) {
          return {
            success: false,
            error: "id is required for dismiss operation",
          };
        }

        const normalizedId = normalizeId(id);
        if (normalizedId === null) {
          return { success: false, error: `Invalid reminder id: ${id}` };
        }

        const dismissed = await dismissReminder(typedDb, normalizedId);

        if (!dismissed) {
          return {
            success: false,
            error: `Reminder not found: ${id}`,
          };
        }

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.REMINDER_DISMISS,
          content: `Dismissed reminder ${id}`,
          internal: internal ?? "Reminder dismissed",
          cycleId,
        });

        return {
          success: true,
          type: "reminder_dismissed",
          data: { id: normalizedId },
        };
      }

      default:
        return { success: false, error: `Unknown operation: ${op}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Reminder operation failed: ${(error as Error).message}`,
    };
  }
};
