/**
 * Platform Callbacks Adapter
 *
 * @module services/cycle-adapter
 * @description Creates PlatformCallbacks for the runtime orchestrator by wrapping
 * Cloudflare-specific platform functions (R2 storage, Telegram, env bindings).
 *
 * This adapter is the bridge between the platform-agnostic orchestrator
 * (packages/runtime) and the Cloudflare Worker entry point (index.ts).
 *
 * @upstream Called by: index.ts scheduled() handler
 * @downstream Calls: buildSystemPrompt, buildUserContent, executeActions, sendTelegram, etc.
 */

import type { DrizzleD1 } from "@persistence/db";
import {
  getState,
  setState,
  logHistory,
  clearViewedImages,
  getHistoryCount,
  getActiveCount,
  getActiveSummaries,
  getBufferSummaries,
  createDrizzleClient,
} from "@persistence/db";
import type {
  PlatformCallbacks,
  ActionExecutionResult,
} from "@persistence/runtime";
import type { ParseResult } from "@persistence/llm";
import { createLLM } from "@persistence/llm";
import type { Env } from "../bootstrap";
import { buildSystemPrompt } from "../prompts/index.js";
import { buildUserContent } from "./cycle-images";
import {
  executeActions as executeActionsImpl,
  executeTool,
  cleanupFeedback,
  sendTelegram,
} from "./index";
import { METERS, METER_EMOJI, setMeterValue } from "../utils/index.js";
import { summarizeHistory, metaSummarize } from "./summarization";
import { getTelegramChatId } from "../utils/telegram.js";
// Streaming delivery helper not included in this distribution — no-op stub.
const streamActionToTelegram = async (..._args: any[]) => {
  /* no messaging adapter configured */
};
import {
  SUMMARIZE_CONFIG,
  DEFAULT_SUMMARIZE_THRESHOLD,
  SUMMARY_BUFFER_CONFIG,
} from "../constants";

// =============================================================================
// FACTORY
// =============================================================================

/**
 * @description Create PlatformCallbacks that wrap Cloudflare-specific platform
 * functions for the runtime orchestrator.
 *
 * Closes over `env` so the orchestrator never touches Cloudflare bindings directly.
 */
export function createPlatformCallbacks(env: Env): PlatformCallbacks {
  const apiKey = env.ANTHROPIC_API_KEY;

  return {
    // --- Context assembly ---
    buildSystemPrompt: (db: DrizzleD1) => buildSystemPrompt(db, env) as any,

    buildUserContent: (db: DrizzleD1, loopCount: number, promptResult) =>
      buildUserContent(db, loopCount, promptResult, env.MEDIA_BUCKET as any),

    // --- Action execution ---
    executeAction: async (
      db: DrizzleD1,
      action: Record<string, unknown>,
      cycleId: number,
    ) => {
      const now = new Date();
      await executeTool({ db, env, action, cycleId, apiKey, now });
    },

    executeActions: async (
      parseResult: ParseResult,
      cycleId: number,
    ): Promise<ActionExecutionResult> => {
      const db = createDrizzleClient(env.DB);
      const now = new Date();
      return executeActionsImpl(parseResult, {
        db,
        env,
        cycleId,
        executeAction: async (
          db: DrizzleD1,
          _env: Env,
          decision: any,
          cycleId: number,
        ) => {
          await executeTool({
            db,
            env,
            action: decision,
            cycleId,
            apiKey,
            now,
          });
        },
        streamToTelegram: async (db: DrizzleD1, action: any, envParam: Env) => {
          await streamActionToTelegram(db, action, envParam, {
            getState,
            sendTelegram,
          });
        },
      }) as any as ActionExecutionResult;
    },

    // --- Meters ---
    processMeters: async (
      db: DrizzleD1,
      meters: Record<string, number>,
      cycleId: number,
      note?: string,
    ) => {
      const meterNameMap: Record<string, string> = {
        A: "aliveness",
        C: "curiosity",
        N: "connection",
        E: "ease",
        D: "delight",
        X: "anxiety",
        Y: "activity",
      };
      const meterUpdates: string[] = [];
      for (const [abbrev, value] of Object.entries(meters)) {
        const meterName = meterNameMap[abbrev] || abbrev.toLowerCase();
        if (
          (METERS as Record<string, any>)[meterName] &&
          typeof value === "number"
        ) {
          const newValue = await setMeterValue(db, meterName, value);
          meterUpdates.push(
            `${(METERS as Record<string, any>)[meterName].abbrev}${newValue}`,
          );
        }
      }
      if (meterUpdates.length > 0) {
        console.log(
          `[Sync] Meters from response: ${meterUpdates.join(" ")}${note ? ` | ${note}` : ""}`,
        );
        const internal = note || "meters from response";
        await logHistory({
          db,
          type: "state_update",
          content: meterUpdates.join(" "),
          internal,
          cycleId,
        });
      }
    },

    sendMetersDisplay: async (
      meters: Record<string, number>,
      note?: string,
    ) => {
      const db = createDrizzleClient(env.DB);
      const telegramChatId = await getTelegramChatId(db);
      const streamEnabled = await getState(db, "telegram_streaming");
      if (
        telegramChatId &&
        streamEnabled === "true" &&
        env.TELEGRAM_BOT_TOKEN
      ) {
        const meterLine = Object.entries(meters)
          .map(([abbrev, value]) => `${METER_EMOJI[abbrev] || abbrev}${value}`)
          .join(" · ");
        const display = note ? `${meterLine}\n<i>${note}</i>` : meterLine;
        await sendTelegram(telegramChatId, display, env, {
          parse_mode: "HTML",
        });
      }
    },

    // --- Error notification ---
    notifyError: async (message: string) => {
      const db = createDrizzleClient(env.DB);
      const telegramChatId = await getTelegramChatId(db);
      if (telegramChatId && env.TELEGRAM_BOT_TOKEN) {
        const truncated =
          message.length > 3500
            ? message.substring(0, 3500) + "\n\n<i>...truncated</i>"
            : message;
        await sendTelegram(telegramChatId, `⚠️ ${truncated}`, env).catch(
          () => {},
        );
      }
    },

    // --- Post-cycle cleanup ---
    postCycleCleanup: async (db: DrizzleD1) => {
      await clearViewedImages(db);
      await cleanupFeedback(db);
    },

    // --- LLM calls handled by @persistence/llm via OrchestratorConfig.llm ---
    // @antipattern DO NOT add LLM call callbacks here.
    //   The orchestrator uses createLLM() from @persistence/llm which provides
    //   CallableModel.sync() and .batch() with full provider support (headers,
    //   request formatting, response parsing, error handling).

    // --- Auto-summarization ---
    autoSummarize: async (db: DrizzleD1, cycleId: number) => {
      await runAutoSummarize(db, env, cycleId);
    },
  };
}

// =============================================================================
// AUTO-SUMMARIZATION
// =============================================================================

/**
 * @description Post-cycle auto-summarization. Runs history summarization when
 * over threshold, then meta-summarization when buffer overflows.
 *
 * Extracted from the monolith's post-cycle block (lines 992-1148 in old index.ts).
 */
async function runAutoSummarize(
  db: DrizzleD1,
  env: Env,
  cycleId: number,
): Promise<void> {
  try {
    const autoSumChatId = await getTelegramChatId(db);
    const summarizeThreshold = parseInt(
      (await getState(db, "summarize_threshold")) ||
        String(DEFAULT_SUMMARIZE_THRESHOLD),
    );
    const currentHistoryCount = await getHistoryCount(db);

    // Auto-summarize history if over threshold
    if (currentHistoryCount > summarizeThreshold) {
      const buffer = 5;
      const targetSize = summarizeThreshold - buffer;
      const toSummarize = Math.min(
        currentHistoryCount - targetSize,
        SUMMARIZE_CONFIG.maxSummarizeCount,
      );

      if (toSummarize >= SUMMARIZE_CONFIG.minSummarizeCount!) {
        console.log(
          `[Auto-Summarize] History (${currentHistoryCount}) > threshold (${summarizeThreshold}), summarizing ${toSummarize} entries`,
        );

        if (autoSumChatId) {
          await sendTelegram(
            autoSumChatId,
            `📦 <b>Auto-Summarize Starting</b>\n\nHistory: ${currentHistoryCount} entries\nThreshold: ${summarizeThreshold}\nSummarizing: ${toSummarize} oldest entries...`,
            env,
          );
        }

        const historyResult = await summarizeHistory(
          db,
          0,
          toSummarize,
          "Auto-summarization triggered after cycle",
          env,
        );
        if (historyResult.success) {
          console.log(
            `[Auto-Summarize] Compressed ${historyResult.count} history entries`,
          );
          await logHistory({
            db,
            type: "summarize",
            content: `Auto-summarized ${historyResult.count} oldest history entries to manage context size`,
            internal: "System auto-summarization",
            cycleId,
          });
          await setState(
            db,
            "last_summarize_run",
            JSON.stringify({
              trigger: "auto",
              timestamp: new Date().toISOString(),
              entriesOffered: historyResult.entriesOffered,
              entriesIncluded: historyResult.entriesIncluded,
              provider: historyResult.provider,
              model: historyResult.model,
              durationMs: historyResult.durationMs,
              timeRange: historyResult.timeRange,
            }),
          );

          if (autoSumChatId) {
            await sendTelegram(
              autoSumChatId,
              `✅ <b>Auto-Summarize Complete</b>\n\nCompressed ${historyResult.count} entries into 1 summary\nNew history size: ${currentHistoryCount - historyResult.count}`,
              env,
            );
          }
        } else if (historyResult.error) {
          console.warn(
            `[Auto-Summarize] History summarization failed: ${historyResult.error}`,
          );
          if (autoSumChatId) {
            await sendTelegram(
              autoSumChatId,
              `❌ <b>Auto-Summarize Failed</b>\n\n${historyResult.error}`,
              env,
            );
          }
        }
      }
    }

    // Auto-meta-summarize using Summary Buffer System
    await runAutoMetaSummarize(db, env, cycleId, autoSumChatId);
  } catch (autoSumErr: unknown) {
    const autoSumErrMsg =
      autoSumErr instanceof Error ? autoSumErr.message : String(autoSumErr);
    console.error(
      "[Auto-Summarize] Error during auto-summarization:",
      autoSumErrMsg,
    );
    try {
      const errorChatId = await getTelegramChatId(db);
      if (errorChatId) {
        await sendTelegram(
          errorChatId,
          `❌ <b>Auto-Summarize Exception</b>\n\n${autoSumErrMsg}`,
          env,
        );
      }
    } catch (notifyErr: unknown) {
      console.error(
        "[Auto-Summarize] Failed to send error notification:",
        notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      );
    }
  }
}

/**
 * @description Auto-meta-summarize when buffer tier exceeds capacity.
 * Consolidates buffer-tier summaries into fewer, keeping context tier intact.
 */
async function runAutoMetaSummarize(
  db: DrizzleD1,
  env: Env,
  cycleId: number,
  autoSumChatId: string | null | undefined,
): Promise<void> {
  const autoMetaEnabled =
    (await getState(db, "auto_meta_summarize")) !== "false";
  const contextSize =
    parseInt((await getState(db, "summary_context_size")) || "") ||
    SUMMARY_BUFFER_CONFIG.contextSize;
  const bufferSize =
    parseInt((await getState(db, "summary_buffer_size")) || "") ||
    SUMMARY_BUFFER_CONFIG.bufferSize;
  const storedMetaThreshold = await getState(db, "meta_summarize_threshold");
  const bufferThreshold = storedMetaThreshold
    ? parseInt(storedMetaThreshold)
    : contextSize + bufferSize;
  const activeCount = await getActiveCount(db);

  if (!autoMetaEnabled || activeCount <= bufferThreshold) return;

  console.log(
    `[Auto-MetaSummarize] Buffer overflow: ${activeCount} active > threshold ${bufferThreshold} (context ${contextSize} + buffer ${bufferSize})`,
  );

  const bufferSummaries = await getBufferSummaries(db, contextSize, bufferSize);
  if (bufferSummaries.length < 2) {
    console.log(
      `[Auto-MetaSummarize] Not enough buffer summaries to consolidate (${bufferSummaries.length} < 2)`,
    );
    return;
  }

  const allActive = await getActiveSummaries(db);
  const bufferIds = new Set(bufferSummaries.map((s) => s.id));
  const bufferIndices = allActive
    .map((s, i) => (bufferIds.has(s.id) ? i : -1))
    .filter((i) => i >= 0);

  if (autoSumChatId) {
    await sendTelegram(
      autoSumChatId,
      `📚 <b>Auto-MetaSummarize Starting</b>\n\nActive summaries: ${activeCount}\nBuffer threshold: ${bufferThreshold}\nBuffer summaries: ${bufferSummaries.length}\nConsolidating buffer tier...`,
      env,
    );
  }

  const metaResult = await metaSummarize(
    db,
    bufferIndices,
    "Auto-consolidation of buffer tier",
    env,
  );

  if (metaResult.success) {
    console.log(
      `[Auto-MetaSummarize] Consolidated ${metaResult.count} buffer summaries`,
    );
    await logHistory({
      db,
      type: "summarize",
      content: `Auto-consolidated ${metaResult.count} buffer summaries (threshold: ${bufferThreshold})`,
      internal: "Buffer system auto-meta-summarization",
      cycleId,
    });
    await setState(
      db,
      "last_meta_run",
      JSON.stringify({
        trigger: "auto",
        timestamp: new Date().toISOString(),
        summariesBefore: metaResult.summariesBefore,
        summariesConsolidated: metaResult.summariesConsolidated,
        summariesRemaining: metaResult.summariesRemaining,
        totalMessagesConsolidated: metaResult.totalMessagesConsolidated,
        provider: metaResult.provider,
        model: metaResult.model,
        durationMs: metaResult.durationMs,
        mode: metaResult.mode,
      }),
    );

    if (autoSumChatId) {
      const newActiveCount = await getActiveCount(db);
      await sendTelegram(
        autoSumChatId,
        `✅ <b>Auto-MetaSummarize Complete</b>\n\nConsolidated ${metaResult.count} buffer summaries into 1\nActive summaries: ${newActiveCount}\nContext tier: ${Math.min(newActiveCount, contextSize)}`,
        env,
      );
    }
  } else if (metaResult.error) {
    console.warn(
      `[Auto-MetaSummarize] Meta-summarization failed: ${metaResult.error}`,
    );
    if (autoSumChatId) {
      await sendTelegram(
        autoSumChatId,
        `❌ <b>Auto-MetaSummarize Failed</b>\n\n${metaResult.error}`,
        env,
      );
    }
  }
}
