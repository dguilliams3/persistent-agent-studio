/**
 * QUESTION Handler
 *
 * @module @persistence/tools/definitions/question/handler
 * @description Manages open curiosity threads without pressure to resolve them.
 *
 * Lifecycle:
 * 1. Added when Clio has genuine curiosity or uncertainty (status: 'open')
 * 2. Notes accumulate as she thinks about it or finds relevant information
 * 3. Status can change: 'open' → 'exploring' → 'resolved' or 'dissolved'
 * 4. Resolved questions document what insight emerged
 * 5. Dissolved questions stopped mattering (not answered, just no longer interesting)
 *
 * Domains: self | world | user | technical | creative
 * NOT a to-do list. No pressure to resolve.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: logHistory() from @persistence/db/history-logger,
 *   addQuestion(), addNote(), resolveQuestion(), dissolveQuestion(), getActiveQuestions() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { QuestionParams } from "./params";
import { normalizeId } from "../../utils/normalize";
import {
  logHistory,
  HISTORY_TYPES,
  type DrizzleD1,
  addQuestion,
  addNote,
  resolveQuestion,
  dissolveQuestion,
  getActiveQuestions,
  type QuestionEntry,
  type QuestionStatus,
} from "@persistence/db";

export const handler: ToolHandler<QuestionParams> = async (
  params: QuestionParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const {
    op,
    id,
    content,
    domain,
    note,
    set_exploring,
    resolved_into,
    reason,
    internal,
  } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  try {
    switch (op) {
      case "add": {
        if (!content) {
          return {
            success: false,
            error: "content is required for add operation",
          };
        }

        const result = await addQuestion(typedDb, content, domain ?? null);

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.QUESTION_ADD,
          content: `New question: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}"${domain ? ` (${domain})` : ""}`,
          internal: internal ?? "Open question added",
          cycleId,
        });

        return {
          success: true,
          type: "question_added",
          data: result,
        };
      }

      case "note": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null || !note) {
          return {
            success: false,
            error: "id and note are required for note operation",
          };
        }

        const result = await addNote(
          typedDb,
          normalizedId,
          note,
          set_exploring ?? false,
        );

        if (!result.success) {
          return {
            success: false,
            error: `Question not found: ${normalizedId}`,
          };
        }

        return {
          success: true,
          type: "question_noted",
          data: {
            id: normalizedId,
            noteCount: result.noteCount,
            status: result.status,
          },
        };
      }

      case "resolve": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null) {
          return {
            success: false,
            error: "id is required for resolve operation",
          };
        }

        const resolved = await resolveQuestion(
          typedDb,
          normalizedId,
          resolved_into ?? null,
        );

        if (!resolved) {
          return {
            success: false,
            error: `Question not found: ${normalizedId}`,
          };
        }

        if (resolved_into) {
          await logHistory({
            db: typedDb,
            type: HISTORY_TYPES.QUESTION_RESOLVE,
            content: `Resolved question ${normalizedId}: ${resolved_into.slice(0, 100)}${resolved_into.length > 100 ? "..." : ""}`,
            internal: internal ?? "Question resolved with insight",
            cycleId,
          });
        }

        return {
          success: true,
          type: "question_resolved",
          data: { id: normalizedId, resolved_into: resolved_into ?? null },
        };
      }

      case "dissolve": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null) {
          return {
            success: false,
            error: "id is required for dissolve operation",
          };
        }

        const dissolved = await dissolveQuestion(
          typedDb,
          normalizedId,
          reason ?? null,
        );

        if (!dissolved) {
          return {
            success: false,
            error: `Question not found: ${normalizedId}`,
          };
        }

        return {
          success: true,
          type: "question_dissolved",
          data: { id: normalizedId, reason: reason ?? null },
        };
      }

      case "list": {
        const entries = await getActiveQuestions(typedDb);

        return {
          success: true,
          type: "question_list",
          data: { entries, count: entries.length },
        };
      }

      default:
        return { success: false, error: `Unknown operation: ${op}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Question operation failed: ${(error as Error).message}`,
    };
  }
};
