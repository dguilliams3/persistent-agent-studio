/**
 * NOTE Handler
 *
 * @module @persistence/tools/definitions/note/handler
 * @description Manages notebook entries (save/append/get/delete).
 *
 * Notebook entries are wiki-style pages with title, body content, and summary.
 * - save: Overwrites entire note (creates new or replaces existing)
 * - append: Adds timestamped section to existing note (creates if doesn't exist)
 * - get: Retrieves note with all sections assembled
 * - delete: Removes note and all its sections
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: logHistory() from @persistence/db/history-logger,
 *   getNote(), saveNote(), appendNote(), deleteNote() from @persistence/db
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   Handlers should NOT contain raw SQL queries (db.prepare, insertWithPersona, etc.).
 *   Instead, call high-level functions from @persistence/db that encapsulate the SQL.
 *   This keeps handlers focused on validation/orchestration, not database details.
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { NoteParams } from "./params";
import {
  logHistory,
  HISTORY_TYPES,
  type DrizzleD1,
  getNote,
  saveNote,
  appendNote,
  deleteNote,
} from "@persistence/db";

/**
 * Handle NOTE action.
 *
 * Manages notebook entries (save/append/get/delete).
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult indicating success/failure
 *
 * @example
 * // Overwrite entire note
 * await handler({ op: "save", title: "Ideas", body: "Fresh content..." }, ctx);
 *
 * @example
 * // Append to existing note (creates timestamped section)
 * await handler({ op: "append", title: "Ideas", body: "New thought...", summary: "On creativity" }, ctx);
 */
export const handler: ToolHandler<NoteParams> = async (
  params: NoteParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { op, title, body, summary, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  try {
    switch (op) {
      case "save": {
        if (!body) {
          return {
            success: false,
            error: "body is required for save operation",
          };
        }
        const safeTitle = title ?? "Untitled";

        const result = await saveNote(typedDb, safeTitle, body, summary ?? "");

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.NOTE_SAVED,
          content: `${result.action === "created" ? "Created" : "Updated"} note: "${safeTitle}"`,
          internal: internal ?? `Note ${result.action}`,
          cycleId,
        });

        return {
          success: true,
          type: "note_saved",
          data: { action: result.action, id: result.id, title: safeTitle },
        };
      }

      case "append": {
        if (!body) {
          return {
            success: false,
            error: "body is required for append operation",
          };
        }
        const safeTitle = title ?? "Untitled";

        const result = await appendNote(
          typedDb,
          safeTitle,
          body,
          summary ?? null,
        );

        if (!result.appended) {
          return {
            success: false,
            error: `Duplicate append rejected (same content within 60s)`,
          };
        }

        const action = result.reason === "created" ? "Created" : "Appended to";
        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.NOTE_SAVED,
          content: `${action} note: "${safeTitle}"`,
          internal: internal ?? (summary || "Addition appended"),
          cycleId,
        });

        return {
          success: true,
          type: "note_saved",
          data: {
            action: result.reason === "created" ? "created" : "appended",
            id: result.id,
            title: safeTitle,
          },
        };
      }

      case "get": {
        const note = await getNote(typedDb, title ?? "");

        if (!note) {
          return {
            success: false,
            error: `Note not found: "${title}"`,
          };
        }

        return {
          success: true,
          type: "note_retrieved",
          data: note,
        };
      }

      case "delete": {
        const result = await deleteNote(typedDb, title ?? "");

        if (!result.success) {
          return { success: false, error: `Note not found: "${title}"` };
        }

        return {
          success: true,
          type: "note_deleted",
          data: { title: result.title },
        };
      }

      default:
        return { success: false, error: `Unknown operation: ${op}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Note operation failed: ${(error as Error).message}`,
    };
  }
};
