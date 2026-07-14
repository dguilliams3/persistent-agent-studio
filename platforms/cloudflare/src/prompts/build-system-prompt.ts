/**
 * System prompt assembly
 *
 * @module prompts/build-system-prompt
 * @description Builds the full system prompt (4-block cache layout) by assembling
 * canonical memory tables, summaries, reminders, and tool registry injection.
 *
 * REFACTORED (2026-01-27):
 * - Core context assembly logic moved to @persistence/memory package
 * - This file now handles: DB fetching, RAG retrieval, Block 1, boundary persistence
 * - Pure transformation logic delegated to buildContext()
 *
 * @upstream Called by:
 *   - orchestrator (via cycle-adapter buildSystemPrompt callback)
 *   - routes/context (via handleRequest)
 *   - voice/realtime/seed.js (via dependency injection)
 * @downstream Calls:
 *   - db/index.js memory readers
 *   - prompts/system.js getStaticSystemPrompt()
 *   - tools/prompt.js renderToolPromptBlocks()
 *   - @persistence/memory buildContext()
 */

import { getStaticSystemPrompt } from "./system.js";
import { renderToolPromptBlocks } from "../tools/index.js";
import {
  getState,
  setState,
  getHistoryForContext,
  getHistoryCount,
  getColdStorage,
  getActiveSummaries,
  getPromotedSummaries,
  getNotebookIndex,
  getReminders,
  checkReminderDue,
  getObservationIndex,
  getLearned,
  getQuestions,
  getPinnedImagesForContext,
  getGallerySummary,
  getPendingViewImages,
  getActiveBranch,
  getOverrides,
  getSyntheticMemories,
  getActivePersonaId,
  getPersona,
} from "../db/index.js";
import {
  getMeterValues,
  getAllMeterHistories,
  getInvoluntaryMeterDisplays,
} from "@persistence/db";
import { getRagConfig } from "../routes/settings.js";
import {
  formatEasternTime,
  formatEasternDateTime,
  formatMetersSection,
} from "../utils/index.js";
import { CloudflareEmbeddingProvider } from "@persistence/embedding";
import {
  retrieveRelevantMemories,
  getFeedbackAndClear,
  formatFeedbackForContext,
  formatFeedbackTooltip,
  getParseErrors,
  markParseErrorsShown,
} from "../services/index.js";
import {
  LONG_TTL_THRESHOLD,
  HISTORY_TOKEN_CONFIG,
  SUMMARIZE_CONFIG,
  DEFAULT_SUMMARIZE_THRESHOLD,
  SUMMARY_BUFFER_CONFIG,
  HISTORY_TAIL_RATIO,
} from "../constants.js";
import type { Env } from "../bootstrap.js";

// Import from @persistence/memory package
import { buildContext, formatSummaryForContext } from "@persistence/memory";
import type { ContextData } from "@persistence/memory";
import type { UserImage, ClaudeArtImage } from "@persistence/media";

type HistoryEntry = Awaited<ReturnType<typeof getHistoryForContext>>[number];
type BranchOverride = Awaited<ReturnType<typeof getOverrides>>[number];
type SyntheticMemory = Awaited<ReturnType<typeof getSyntheticMemories>>[number];
type PinnedImage = Awaited<
  ReturnType<typeof getPinnedImagesForContext>
>[number];
type GallerySummary = Awaited<ReturnType<typeof getGallerySummary>>;

type BranchTargetTable =
  | "history"
  | "cold_storage"
  | "summaries"
  | "notebook"
  | "observations"
  | "reminders";
type BranchResultKey =
  | "history"
  | "coldStorage"
  | "summaries"
  | "notebook"
  | "observations"
  | "reminders";

type BranchDataItem = {
  id: string | number;
  type?: string | null;
  content?: string | null;
  internal?: string | null;
  created_at?: string | null;
  _edited?: boolean;
  _originalContent?: string | null;
  _reordered?: boolean;
  _position?: number;
  _timestampOverride?: string | null;
  _synthetic?: boolean;
  _syntheticId?: string | number;
  [key: string]: unknown;
};

type BranchData = {
  history: BranchDataItem[];
  coldStorage: BranchDataItem[];
  summaries: BranchDataItem[];
  notebook: BranchDataItem[];
  observations: BranchDataItem[];
  reminders: BranchDataItem[];
};

// UserImage and ClaudeArtImage imported from @persistence/media

interface FormatHistoryOptions {
  recentImageThreshold: number;
}

// ============================================================================
// BRANCH OVERRIDE LOGIC (platform-specific)
// ============================================================================

/**
 * @description Applies memory branch overrides to canonical data arrays
 *
 * The branching system enables NON-DESTRUCTIVE memory manipulation:
 * - Canonical history remains immutable (the "main" branch shows unmodified data)
 * - Other branches can exclude, edit, or reorder memories
 * - Synthetic memories can be inserted that don't exist in canonical history
 *
 * Philosophy: "Never delete, only exclude" - all canonical data is preserved forever.
 *
 * @upstream Called by: buildSystemPrompt() when active branch is not 'main'
 * @downstream Calls: None (pure transformation function)
 */
function applyBranchOverrides(
  canonical: BranchData,
  overrides: BranchOverride[],
  synthetics: SyntheticMemory[],
): BranchData {
  // Deep clone to avoid mutating original data
  const result = {
    history: [...canonical.history],
    coldStorage: [...canonical.coldStorage],
    summaries: [...canonical.summaries],
    notebook: [...canonical.notebook],
    observations: [...canonical.observations],
    reminders: [...canonical.reminders],
  };

  // Map table names to result keys
  const tableMap: Record<BranchTargetTable, BranchResultKey> = {
    history: "history",
    cold_storage: "coldStorage",
    summaries: "summaries",
    notebook: "notebook",
    observations: "observations",
    reminders: "reminders",
  };

  // Track which items are excluded
  const excluded = new Set();

  // Apply overrides
  for (const override of overrides) {
    const tableKey = tableMap[override.target_table as BranchTargetTable];
    if (!tableKey) continue;

    const items = result[tableKey];
    const itemIndex = items.findIndex((item) => item.id === override.target_id);
    if (itemIndex === -1) continue;

    switch (override.override_type) {
      case "exclude":
        excluded.add(`${override.target_table}:${override.target_id}`);
        break;

      case "edit":
        try {
          const edits = JSON.parse(
            override.override_data || "{}",
          ) as Partial<BranchDataItem>;
          const item = items[itemIndex];
          item._edited = true;
          item._originalContent = item.content;
          if (edits.content !== undefined) item.content = edits.content;
          if (edits.type !== undefined) item.type = edits.type;
          if (edits.internal !== undefined) item.internal = edits.internal;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error(`Failed to parse edit override data: ${message}`);
        }
        break;

      case "reorder":
        try {
          const pos = JSON.parse(override.override_data || "{}") as {
            position?: number;
            timestamp_override?: string;
          };
          const item = items[itemIndex];
          item._reordered = true;
          if (pos.position !== undefined) item._position = pos.position;
          if (pos.timestamp_override !== undefined)
            item._timestampOverride = pos.timestamp_override;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error(`Failed to parse reorder override data: ${message}`);
        }
        break;
    }
  }

  // Add synthetic memories to history
  for (const synth of synthetics) {
    result.history.push({
      id: `synth_${synth.id}`,
      type: synth.memory_type,
      content: synth.content,
      internal: synth.internal,
      created_at: (synth.position_timestamp || synth.created_at) as
        | string
        | undefined,
      _synthetic: true,
      _syntheticId: synth.id,
    });
  }

  // Filter out excluded items
  for (const [table, key] of Object.entries(tableMap) as [
    BranchTargetTable,
    BranchResultKey,
  ][]) {
    result[key] = result[key].filter((item) => {
      const itemId =
        typeof item.id === "string" && item.id.startsWith("synth_")
          ? item.id
          : item.id;
      return !excluded.has(`${table}:${itemId}`);
    });
  }

  // Sort history by effective timestamp
  result.history.sort((a, b) => {
    const aTime = a._timestampOverride || a.created_at || "";
    const bTime = b._timestampOverride || b.created_at || "";
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  return result;
}

// ============================================================================
// HISTORY FORMATTER (platform-specific, passed to buildContext)
// ============================================================================

/**
 * Format a single history entry for context display.
 *
 * @param {Object} h - History entry
 * @param {Array} userImages - Array to collect the user's images
 * @param {Array} claudeArtImages - Array to collect Claude's art
 * @param {boolean} collectImages - Whether to collect image data
 * @returns {string} Formatted entry text
 */
function formatHistoryEntry(
  h: HistoryEntry,
  userImages: UserImage[],
  claudeArtImages: ClaudeArtImage[],
  collectImages = true,
): string {
  const timeStr = formatEasternTime(new Date(h.created_at));
  const isBase64Image = h.content?.startsWith("data:image");

  switch (h.type) {
    case "user_message": {
      const hasImage = h.internal && h.internal.startsWith("data:image");
      if (hasImage && collectImages) {
        userImages.push({
          time: timeStr,
          image: h.internal ?? "",
          text: h.content,
        });
      }
      return `[${timeStr}] DAN: "${h.content}"${hasImage ? (collectImages ? " [sent an image - see below]" : " [sent an image]") : ""}`;
    }
    case "message_to_dan":
      return `[${timeStr}] MESSAGED DAN: "${h.content}"`;
    case "thought":
      return `[${timeStr}] THOUGHT: ${h.content}`;
    case "curiosity":
      return `[${timeStr}] WONDERED: ${h.content}`;
    case "remember":
      return `[${timeStr}] TO FOLLOW UP: ${h.content}`;
    case "cold_storage":
      return `[${timeStr}] FROZE TO COLD STORAGE: ${h.content}`;
    case "search_query":
      return `[${timeStr}] I SEARCHED FOR: ${h.content}`;
    case "search_result":
      return `[${timeStr}] SEARCH RESULTS:\n${h.content}`;
    case "art_request":
      return `[${timeStr}] I MADE ART: "${h.content}"`;
    case "art_result": {
      const isActualImage = h.content && h.content.startsWith("data:image");
      if (isActualImage && collectImages) {
        const artPrompt =
          h.internal?.replace(/^Generated:\s*/, "") || "untitled";
        claudeArtImages.push({
          time: timeStr,
          image: h.content,
          prompt: artPrompt,
        });
      }
      return `[${timeStr}] ART CREATED: [image${isActualImage && collectImages ? " - see MY ART section below" : ""}]`;
    }
    case "user_art": {
      const isUserArtImage = h.content && h.content.startsWith("data:image");
      if (isUserArtImage && collectImages) {
        const userArtPrompt =
          h.internal?.replace(/^(?:User's|Dan's) prompt:\s*/, "") || "untitled";
        userImages.push({
          time: timeStr,
          image: h.content,
          text: `User's art: ${userArtPrompt}`,
        });
      }
      return `[${timeStr}] DAN MADE ART: "${h.internal?.replace(/^(?:User's|Dan's) prompt:\s*/, "") || "untitled"}"${isUserArtImage && collectImages ? " [see USER'S IMAGES section]" : ""}`;
    }
    case "art_shared":
      return `[${timeStr}] SHARED ART WITH DAN: "${h.content}"`;
    case "user_video": {
      const hasVideoGif =
        h.internal &&
        (h.internal.startsWith("data:image") || h.internal.startsWith("r2://"));
      if (hasVideoGif && collectImages) {
        userImages.push({
          time: timeStr,
          image: h.internal ?? "",
          text: h.content || "Video from user",
        });
      }
      return `[${timeStr}] DAN SENT VIDEO: "${h.content || "video"}"${hasVideoGif && collectImages ? " [see USER'S IMAGES section]" : ""}`;
    }
    case "note_saved":
      return `[${timeStr}] SAVED TO NOTEBOOK: "${h.content}" - ${h.internal || ""}`;
    case "note_retrieved":
      return `[${timeStr}] RETRIEVED NOTE: "${h.content}"\n---\n${h.internal || "(empty)"}\n---`;
    case "observation_saved":
      return `[${timeStr}] SAVED OBSERVATION: "${h.content}" - ${h.internal || ""}`;
    case "observation_retrieved":
      return `[${timeStr}] RETRIEVED OBSERVATION: "${h.content}"\n---\n${h.internal || "(empty)"}\n---`;
    case "exist":
      return `[${timeStr}] JUST EXISTING: ${h.internal || "(quietly)"}`;
    default:
      if (isBase64Image) {
        return `[${timeStr}] ${h.type.toUpperCase()}: [image] "${h.internal || "unknown prompt"}"`;
      }
      return `[${timeStr}] ${h.type}: ${h.content}`;
  }
}

/**
 * Format history section for context display.
 * This is the formatHistory function passed to buildContext().
 *
 * @param {Array} entries - History entries
 * @param {Object} options - Formatting options
 * @param {number} options.recentImageThreshold - Index threshold for image collection
 * @returns {{ text: string, userImages: Array, claudeArtImages: Array }}
 */
function formatHistorySection(
  entries: HistoryEntry[],
  options: FormatHistoryOptions,
): {
  text: string;
  userImages: UserImage[];
  claudeArtImages: ClaudeArtImage[];
} {
  const userImages: UserImage[] = [];
  const claudeArtImages: ClaudeArtImage[] = [];
  const { recentImageThreshold } = options;

  const text = entries
    .map((h: HistoryEntry, i: number) => {
      const collectImages = i >= recentImageThreshold;
      return formatHistoryEntry(h, userImages, claudeArtImages, collectImages);
    })
    .join("\n");

  return { text, userImages, claudeArtImages };
}

// ============================================================================
// MY SPACE FORMATTER (platform-specific)
// ============================================================================

/**
 * Format MY SPACE section (pinned images and gallery).
 */
function formatMySpaceSection(
  pinnedImages: PinnedImage[],
  gallerySummary: GallerySummary,
): string {
  const formatPinnedSlots = () => {
    const slots = [];
    for (let i = 1; i <= 5; i++) {
      const pin = pinnedImages.find((p) => p.slot === i);
      if (pin) {
        slots.push(`  [slot ${i}] id:${pin.image_id} "${pin.title}"`);
      } else {
        slots.push(`  [slot ${i}] empty`);
      }
    }
    return slots.join("\n");
  };

  const gallerySectionContent =
    gallerySummary.count > 0
      ? `Gallery (${gallerySummary.count} images, recent): ${gallerySummary.images
          .slice(0, 5)
          .map((img) => `[id:${img.id}] "${img.title}"`)
          .join(
            ", ",
          )}${gallerySummary.count > 5 ? ` ... (${gallerySummary.count - 5} more)` : ""}`
      : "Gallery: empty";

  return `--- MY SPACE ---
Pinned images (use PIN_IMAGE to curate):
${formatPinnedSlots()}

${gallerySectionContent}`;
}

// ============================================================================
// MAIN BUILD FUNCTION
// ============================================================================

/**
 * @description Builds the complete system prompt for Claude's thinking cycle
 *
 * ARCHITECTURE:
 * 1. Fetch all data from DB (platform responsibility)
 * 2. Apply branch overrides if active
 * 3. Perform RAG retrieval (requires env.AI binding)
 * 4. Prepare ContextData and config
 * 5. Call buildContext() from @persistence/memory (pure transformation)
 * 6. Persist boundary updates
 * 7. Assemble Block 1 and combine with blocks 2-4
 *
 * @upstream Called by: orchestrator (via cycle-adapter), /context endpoint
 * @downstream Calls: DB functions, buildContext(), getStaticSystemPrompt()
 *
 * @param {D1Database} db - The Cloudflare D1 database instance
 * @param {Object} env - Cloudflare environment (for AI binding)
 * @returns {Promise<Object>} Context result with all blocks and metadata
 */
export async function buildSystemPrompt(
  db: D1Database,
  env: Env | null = null,
) {
  // =========================================================================
  // 1. LOAD CONFIGURATION
  // =========================================================================
  const summarizeThreshold = parseInt(
    (await getState(db, "summarize_threshold")) ||
      String(DEFAULT_SUMMARIZE_THRESHOLD),
  );
  const historyTailSize = Math.ceil(summarizeThreshold * HISTORY_TAIL_RATIO);
  const cycleInterval = parseInt(
    (await getState(db, "cycle_interval_seconds")) || "300",
  );
  const lastWakeTime = await getState(db, "last_wake_time");
  const userStatus = await getState(db, "dan_status");
  const userStatusUpdated = await getState(db, "dan_status_updated");
  const userStatusSetBy = await getState(db, "dan_status_set_by");

  // =========================================================================
  // 2. LOAD ALL MEMORY DATA
  // =========================================================================
  const totalUnsummarizedCount = await getHistoryCount(db);
  const historyLoadCount = Math.max(50, historyTailSize * 3);
  let history = await getHistoryForContext(
    db,
    Math.min(historyLoadCount, totalUnsummarizedCount),
  );
  let coldStorage = await getColdStorage(db);

  const summaryPrefixSize =
    parseInt((await getState(db, "summary_context_size")) ?? "", 10) ||
    SUMMARY_BUFFER_CONFIG.contextSize;
  let allSummaries = await getActiveSummaries(db);
  const promotedSummaries = await getPromotedSummaries(db);

  let notebookIndex = await getNotebookIndex(db);
  let reminders = await getReminders(db);
  let observationIndex = await getObservationIndex(db);
  const learnedEntries = await getLearned(db);
  const questionEntries = await getQuestions(db);

  const pinnedImages = await getPinnedImagesForContext(db);
  const gallerySummary = await getGallerySummary(db, 10);
  const pendingViewImages = await getPendingViewImages(db);

  // =========================================================================
  // 3. APPLY BRANCH OVERRIDES
  // =========================================================================
  const activeBranch = await getActiveBranch(db);
  const branchName = activeBranch?.name || "main";

  if (activeBranch) {
    const synthetics = await getSyntheticMemories(db, activeBranch.id);
    const overrides =
      branchName !== "main" ? await getOverrides(db, activeBranch.id) : [];

    if (overrides.length > 0 || synthetics.length > 0) {
      console.log(
        `[Branch] Active branch: "${branchName}" - applying ${overrides.length} overrides, ${synthetics.length} synthetics`,
      );
      const modified = applyBranchOverrides(
        {
          history: history as unknown as BranchDataItem[],
          coldStorage: coldStorage as unknown as BranchDataItem[],
          summaries: allSummaries as unknown as BranchDataItem[],
          notebook: notebookIndex as unknown as BranchDataItem[],
          observations: observationIndex as unknown as BranchDataItem[],
          reminders: reminders as unknown as BranchDataItem[],
        },
        overrides as BranchOverride[],
        synthetics as SyntheticMemory[],
      );
      history = modified.history as unknown as typeof history;
      coldStorage = modified.coldStorage as unknown as typeof coldStorage;
      allSummaries = modified.summaries as unknown as typeof allSummaries;
      notebookIndex = modified.notebook as unknown as typeof notebookIndex;
      observationIndex =
        modified.observations as unknown as typeof observationIndex;
      reminders = modified.reminders as unknown as typeof reminders;
    }
  }

  const now = new Date();

  // =========================================================================
  // 4. PREPARE CONTEXT FOR REMINDERS AND FEEDBACK
  // =========================================================================
  const newUserMessage = history.some(
    (h) =>
      h.type === "user_message" &&
      lastWakeTime &&
      new Date(h.created_at) > new Date(lastWakeTime),
  );
  const reminderContext = { newUserMessage };
  const dueReminders = reminders.filter((r) =>
    checkReminderDue(r, reminderContext),
  );

  const lastMessageEntry = [...history]
    .reverse()
    .find((h) => h.type === "message_to_dan");
  const timeSinceLastMessage = lastMessageEntry
    ? Math.round(
        (now.getTime() - new Date(lastMessageEntry.created_at).getTime()) /
          60000,
      )
    : null;

  const pendingFeedback = await getFeedbackAndClear(db);
  const feedbackSection = formatFeedbackForContext(pendingFeedback);

  const parseErrorFeedback = await getParseErrors(db);
  let parseErrorTooltip = "";
  if (parseErrorFeedback) {
    parseErrorTooltip = formatFeedbackTooltip(parseErrorFeedback);
    await markParseErrorsShown(db);
  }

  // Summarization reminder
  const historyOverThreshold = history.length > summarizeThreshold;
  const summarizeReminder = historyOverThreshold
    ? `⚠️ MEMORY MANAGEMENT NOTICE ⚠️
Your history has ${history.length} entries (threshold: ${summarizeThreshold}).
Consider using SUMMARIZE to compress older entries and keep your context manageable.
Recommended: SUMMARIZE with count:${Math.min(history.length - summarizeThreshold + 10, SUMMARIZE_CONFIG.maxSummarizeCount)} to bring history back under threshold.
This preserves important information while freeing up context space.\n\n`
    : "";

  // =========================================================================
  // 5. RAG RETRIEVAL (requires env.AI binding)
  // =========================================================================
  let ragResults: ContextData["ragResults"] = [];
  const historyTailText = history
    .map((h) => formatHistoryEntry(h, [], [], false))
    .join("\n");

  if (env) {
    const ragConfig = await getRagConfig(db);

    if (ragConfig.enabled && historyTailText.length > 0) {
      try {
        const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
        const embeddingResult = await provider.generate(historyTailText);

        if (embeddingResult.success) {
          ragResults = (await retrieveRelevantMemories(
            db,
            embeddingResult.data,
            {
              topK: ragConfig.topK,
              maxNotebookEntries: 2,
              recencyHalflifeDays: ragConfig.recencyHalflifeDays,
              minSimilarity: ragConfig.minSimilarity,
              weights: ragConfig.weights,
            },
          )) as unknown as ContextData["ragResults"];

          if (ragResults.length > 0) {
            const summaryCount = ragResults.filter(
              (r: ContextData["ragResults"][number]) => r.type === "summary",
            ).length;
            const notebookCount = ragResults.filter(
              (r: ContextData["ragResults"][number]) => r.type === "notebook",
            ).length;
            console.log(
              `[RAG] Retrieved ${ragResults.length} memories (${summaryCount} summaries, ${notebookCount} notebooks) for context`,
            );
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn(
          "[RAG] Retrieval failed, continuing without RAG:",
          message,
        );
      }
    }
  }

  // =========================================================================
  // 6. LOAD METERS
  // =========================================================================
  const meterValues = await getMeterValues(db);
  const meterHistories = await getAllMeterHistories(db);
  const involuntaryMeters = await getInvoluntaryMeterDisplays(db);

  // =========================================================================
  // 7. PREPARE CACHE CONFIGURATION
  // =========================================================================
  const useVolatileCaching = cycleInterval < LONG_TTL_THRESHOLD;

  const storedTailTokenThreshold = await getState(db, "tail_token_threshold");
  const storedTailTokenTarget = await getState(db, "tail_token_target");
  const parsedTailTokenThreshold = parseInt(storedTailTokenThreshold ?? "", 10);
  const parsedTailTokenTarget = parseInt(storedTailTokenTarget ?? "", 10);

  const cacheConfig = {
    useVolatileCaching,
    cycleIntervalSeconds: cycleInterval,
    ttl: useVolatileCaching ? "5min" : "1hr",
    historyTailTokenThreshold: HISTORY_TOKEN_CONFIG.tail.threshold,
    historyTailTokenTarget: HISTORY_TOKEN_CONFIG.tail.target,
    minHistoryTailEntries: HISTORY_TOKEN_CONFIG.tail.minValue,
    summaryTailTokenThreshold: Number.isFinite(parsedTailTokenThreshold)
      ? parsedTailTokenThreshold
      : SUMMARY_BUFFER_CONFIG.tailTokenThreshold,
    summaryTailTokenTarget: Number.isFinite(parsedTailTokenTarget)
      ? parsedTailTokenTarget
      : SUMMARY_BUFFER_CONFIG.tailTokenTarget,
    minSummaryTailSummaries: SUMMARY_BUFFER_CONFIG.minTailSummaries ?? 1,
    summaryPrefixSize,
  };

  // =========================================================================
  // 8. LOAD BOUNDARY STATE
  // =========================================================================
  const storedHistoryBoundaryId = await getState(
    db,
    "history_prefix_boundary_id",
  );
  const storedSummaryBoundaryId = await getState(
    db,
    "summary_prefix_boundary_id",
  );

  const historyBoundaryId = storedHistoryBoundaryId
    ? parseInt(storedHistoryBoundaryId, 10)
    : null;
  const summaryBoundaryId = storedSummaryBoundaryId
    ? parseInt(storedSummaryBoundaryId, 10)
    : null;

  // =========================================================================
  // 9. PREPARE CONTEXT DATA FOR BUILDER
  // =========================================================================
  const loopCount = parseInt((await getState(db, "loop_count")) || "0") + 1;

  const contextData: ContextData = {
    history: history as unknown as ContextData["history"],
    summaries: allSummaries as unknown as ContextData["summaries"],
    promotedSummaries:
      promotedSummaries as unknown as ContextData["promotedSummaries"],
    coldStorage: coldStorage as unknown as ContextData["coldStorage"],
    notebook: notebookIndex as unknown as ContextData["notebook"],
    observations: observationIndex as unknown as ContextData["observations"],
    learned: learnedEntries as unknown as ContextData["learned"],
    questions: questionEntries as unknown as ContextData["questions"],
    reminders: reminders as unknown as ContextData["reminders"],
    dueReminders: dueReminders as unknown as ContextData["dueReminders"],
    ragResults,
    userStatus: userStatus
      ? {
          status: userStatus,
          updated: userStatusUpdated ?? null,
          setBy: userStatusSetBy ?? null,
        }
      : null,
    persona: null, // Persona handled separately for Block 1
    meters: {
      values: meterValues,
      histories: meterHistories,
      involuntary: involuntaryMeters,
    },
  };

  const builderConfig = {
    historyBoundaryId,
    summaryBoundaryId,
    cache: cacheConfig,
    now,
    loopCount,
    timeSinceLastMessage,
    feedback: feedbackSection,
    parseErrorTooltip,
    summarizeReminder,
  };

  const formatters: Parameters<typeof buildContext>[1] = {
    formatDateTime: (date: Date) =>
      formatEasternDateTime(date),
    formatSummary: formatSummaryForContext,
    formatHistory: formatHistorySection as unknown as Parameters<
      typeof buildContext
    >[1]["formatHistory"],
    formatMeters: formatMetersSection as unknown as Parameters<
      typeof buildContext
    >[1]["formatMeters"],
  };

  // =========================================================================
  // 10. BUILD CONTEXT (pure transformation)
  // =========================================================================
  const result = buildContext(
    contextData as unknown as Parameters<typeof buildContext>[0],
    formatters as unknown as Parameters<typeof buildContext>[1],
    builderConfig as unknown as Parameters<typeof buildContext>[2],
  );

  // =========================================================================
  // 11. PERSIST BOUNDARY UPDATES
  // =========================================================================
  if (result.boundaryUpdates.history.shifted) {
    const newHistoryBoundaryId = result.boundaryUpdates.history.boundaryId;
    if (newHistoryBoundaryId !== null) {
      await setState(
        db,
        "history_prefix_boundary_id",
        String(newHistoryBoundaryId),
      );
      console.log(result.boundaryUpdates.history.logMessage);
    }
  }

  if (result.boundaryUpdates.summary.shifted) {
    const newSummaryBoundaryId = result.boundaryUpdates.summary.boundaryId;
    if (newSummaryBoundaryId !== null) {
      await setState(
        db,
        "summary_prefix_boundary_id",
        String(newSummaryBoundaryId),
      );
      console.log(result.boundaryUpdates.summary.logMessage);
    }
  }

  // =========================================================================
  // 12. BUILD BLOCK 1 (platform-specific: static prompt + tools)
  // =========================================================================
  const personaId = await getActivePersonaId(db);
  const persona = personaId ? await getPersona(db, personaId) : null;
  const personaIdentity = persona?.system_prompt_template || "clio";
  const restVerbsEnabled = (await getState(db, "rest_verbs_enabled")) === "true";

  const toolPromptBlock = renderToolPromptBlocks();
  const block1_constitution =
    getStaticSystemPrompt({
      identity: personaIdentity,
      operatorName: "Dan",
      restVerbsEnabled,
    }) + (toolPromptBlock ? `\n\n${toolPromptBlock}` : "");

  // Block 1 extensions: Cold storage + MY SPACE
  const coldStorageSection =
    coldStorage.length > 0
      ? `MY COLD STORAGE (permanent memories I've chosen to preserve):\n${coldStorage.map((item) => `- ${item.content}`).join("\n")}\n\n`
      : "";
  const mySpaceSection = formatMySpaceSection(pinnedImages, gallerySummary);
  const block1Extensions =
    coldStorageSection || mySpaceSection
      ? `\n\n--- PERMANENT CONTEXT (rarely changes) ---\n${coldStorageSection}${mySpaceSection}`.trim()
      : "";

  // =========================================================================
  // 13. ASSEMBLE FINAL RESULT
  // =========================================================================
  // Extract block text for legacy compatibility
  const block2_promotedSummaries = result.block2.text;
  const block3_stableAndSummaries = result.block3.text;
  const block4_freshTail = result.block4.text;

  // Legacy combined prompts
  const dynamicPrompt = [
    block2_promotedSummaries,
    block3_stableAndSummaries,
    block4_freshTail,
  ]
    .filter(Boolean)
    .join("\n\n");
  const systemPrompt = block1_constitution + "\n\n" + dynamicPrompt;

  return {
    // New 4-block structure
    block1_constitution,
    block1Extensions,
    block2_promotedSummaries,
    block3_stableAndSummaries,
    block4_freshTail,

    // Cache strategy info
    cacheStrategy: {
      useVolatileCaching,
      cycleInterval,
      historyTailTokenThreshold: cacheConfig.historyTailTokenThreshold,
      historyTailTokenTarget: cacheConfig.historyTailTokenTarget,
      actualTailTokens: result.boundaryUpdates.history.tailTokenCount,
      actualTailSize: history.length,
      historyPrefixSize: 0, // All history in Block 4 now
      prefixBoundaryId: result.boundaryUpdates.history.boundaryId,
      ttl: "1h",
    },

    // Legacy fields
    staticPrompt: block1_constitution,
    dynamicPrompt,
    systemPrompt,

    // Image collections
    userImages: result.images.userImages,
    claudeArtImages: result.images.claudeArtImages,

    // Counts
    historyCount: result.metadata.historyCount,
    summariesCount: result.metadata.summariesCount,
    remindersCount: result.metadata.remindersCount,
    coldStorageCount: coldStorage.length,
    learnedCount: result.metadata.learnedCount,
    questionsCount: result.metadata.questionsCount,
    notebookCount: result.metadata.notebookCount,
    observationsCount: result.metadata.observationsCount,

    // RAG results
    ragRetrievedCount: result.metadata.ragRetrievedCount,
    ragRetrievedSummaries: ragResults.map(
      (r: ContextData["ragResults"][number]) => ({
        type: r.type,
        id: r.item.id,
        range:
          r.type === "summary"
            ? (r.item as { covered_range?: string }).covered_range
            : (r.item as { title?: string }).title,
        content:
          r.type === "summary"
            ? (r.item as { summary?: string }).summary
            : (r.item as { content?: string }).content,
        tokenCount:
          (r.item as { token_count?: number }).token_count ||
          Math.ceil(
            (
              (r.type === "summary"
                ? (r.item as { summary?: string }).summary
                : (r.item as { content?: string }).content) ?? ""
            ).length / 4,
          ) ||
          0,
        scores: r.scores,
      }),
    ),

    // Branch info
    activeBranch: branchName,

    // Pending images
    pendingViewImages,
  };
}
