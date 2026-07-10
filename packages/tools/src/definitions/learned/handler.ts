/**
 * LEARNED Handler
 *
 * @module @persistence/tools/definitions/learned/handler
 * @description Manages battle-tested self-knowledge with confidence levels and evidence tracking.
 *
 * Lifecycle:
 * 1. Added when Clio notices a pattern worth tracking (confidence: 'emerging')
 * 2. Evidence accumulates (supporting or challenging) over time via cite
 * 3. Confidence can be updated: 'emerging' → 'stable' → 'load-bearing'
 * 4. When established enough, can be promoted to cold storage with full citation history
 *
 * Evidence is stored as JSON arrays that grow with each citation.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: logHistory() from @persistence/db/history-logger,
 *   addLearned(), updateLearned(), citeEvidence(), markPromoted(), deleteLearned(), getLearned(), addColdStorage() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { LearnedParams } from "./params";
import { normalizeId } from "../../utils/normalize";
import {
  logHistory,
  HISTORY_TYPES,
  type DrizzleD1,
  addLearned,
  updateLearned,
  citeEvidence,
  markPromoted,
  deleteLearned,
  getLearned,
  addColdStorage,
  type LearnedEntry,
  type LearnedConfidence,
} from "@persistence/db";

export const handler: ToolHandler<LearnedParams> = async (
  params: LearnedParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const {
    op,
    id,
    content,
    confidence,
    supporting,
    type: evidenceType,
    evidence,
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
        const safeConfidence = (confidence as LearnedConfidence) ?? "emerging";

        const result = await addLearned(
          typedDb,
          content,
          safeConfidence,
          supporting ?? null,
        );

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.LEARNED_ADD,
          content: `Added learned: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}" (${safeConfidence})`,
          internal: internal ?? "Self-knowledge added",
          cycleId,
        });

        return {
          success: true,
          type: "learned_added",
          data: result,
        };
      }

      case "update": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null) {
          return {
            success: false,
            error: "valid id is required for update operation",
          };
        }
        if (!content && !confidence) {
          return {
            success: false,
            error: "at least one of content or confidence is required",
          };
        }

        const updated = await updateLearned(typedDb, normalizedId, {
          content: content ?? undefined,
          confidence: confidence as LearnedConfidence | undefined,
        });

        if (!updated) {
          return {
            success: false,
            error: `Learned entry not found: ${normalizedId}`,
          };
        }

        return {
          success: true,
          type: "learned_updated",
          data: { id: normalizedId, content, confidence },
        };
      }

      case "cite": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null || !evidenceType || !evidence) {
          return {
            success: false,
            error:
              "id, type (supporting/challenging), and evidence are required",
          };
        }

        const result = await citeEvidence(
          typedDb,
          normalizedId,
          evidenceType as "supporting" | "challenging",
          evidence,
        );

        if (!result.success) {
          return {
            success: false,
            error: `Learned entry not found: ${normalizedId}`,
          };
        }

        return {
          success: true,
          type: "learned_cited",
          data: {
            id: normalizedId,
            evidenceType,
            evidenceCount: result.evidenceCount,
          },
        };
      }

      case "promote": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null) {
          return {
            success: false,
            error: "id is required for promote operation",
          };
        }

        // Get entry for validation and building context
        const allLearned = await getLearned(typedDb);
        const learned = allLearned.find((l) => l.id === normalizedId);

        if (!learned) {
          return {
            success: false,
            error: `Learned entry not found: ${normalizedId}`,
          };
        }

        if (learned.confidence !== "load-bearing") {
          return {
            success: false,
            error: `Can only promote load-bearing learnings (current: ${learned.confidence})`,
          };
        }

        if (learned.promoted_to_cold_storage_at) {
          return { success: false, error: "Already promoted to cold storage" };
        }

        // Build context from evidence
        const supportingEvidence = learned.supporting_evidence
          ? JSON.parse(learned.supporting_evidence)
          : [];
        const challengingEvidence = learned.challenging_evidence
          ? JSON.parse(learned.challenging_evidence)
          : [];

        let context = `Promoted from LEARNED (confidence: load-bearing, tracked since ${learned.created_at})`;
        if (supportingEvidence.length > 0) {
          context += `\nSupporting: ${supportingEvidence.join("; ")}`;
        }
        if (challengingEvidence.length > 0) {
          context += `\nChallenging: ${challengingEvidence.join("; ")}`;
        }

        // Insert into cold storage using DB function
        // Note: addColdStorage returns void, not an object with id
        await addColdStorage(typedDb, learned.content, context);

        // Mark as promoted
        await markPromoted(typedDb, normalizedId);

        await logHistory({
          db: typedDb,
          type: HISTORY_TYPES.COLD_STORAGE,
          content: `Promoted learned to cold storage: "${learned.content.slice(0, 80)}..."`,
          internal: internal ?? "Self-knowledge promoted to permanent memory",
          cycleId,
        });

        return {
          success: true,
          type: "learned_promoted",
          data: { id: normalizedId, promotedToColdStorage: true },
        };
      }

      case "delete": {
        const normalizedId = normalizeId(id);
        if (normalizedId === null) {
          return {
            success: false,
            error: "id is required for delete operation",
          };
        }

        const deleted = await deleteLearned(typedDb, normalizedId);

        if (!deleted) {
          return {
            success: false,
            error: `Learned entry not found: ${normalizedId}`,
          };
        }

        return {
          success: true,
          type: "learned_deleted",
          data: { id: normalizedId },
        };
      }

      case "list": {
        const entries = await getLearned(typedDb);

        return {
          success: true,
          type: "learned_list",
          data: { entries, count: entries.length },
        };
      }

      default:
        return { success: false, error: `Unknown operation: ${op}` };
    }
  } catch (error) {
    return {
      success: false,
      error: `Learned operation failed: ${(error as Error).message}`,
    };
  }
};
