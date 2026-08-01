/**
 * Tool Action Handlers (Platform-Only)
 *
 * @module tools/actions
 * @description Platform handlers for actions that DON'T have package handlers yet.
 *
 * MIGRATION STATUS:
 * 19 handlers have been migrated to @persistence/tools and are wired via handler-registry.js.
 * Post-processing for handlers that return metadata flags is in post-processors.js.
 *
 * This file only contains handlers that have no package equivalent:
 * - METASUMMARIZE: Uses same service as SUMMARIZE but with different params
 * - PIN_IMAGE / VIEW_IMAGES: Platform-only (no package handler)
 *
 * @see ../handler-registry.js for wired package handlers (19 total)
 * @see ../post-processors.js for metadata flag handling
 *
 * DO NOT ADD BACK (migrated to packages):
 * - Pure DB: THINK, WONDER, REMEMBER, EXIST, COLD_STORAGE, NOTE, OBSERVATION,
 *            REMINDER, SET_STATUS, SET_USER_STATUS, SET_STATE, LEARNED, QUESTION
 * - With post-processing: MESSAGE_USER, SEARCH, ART, SLEEP, SET_PROFILE_PIC, SUMMARIZE
 */

import { logHistory } from '../../utils/index.js';
import {
  getState,
  setState
} from '../../db/index.js';
import {
  executePinImageAction,
  executeViewImagesAction,
  metaSummarize,
  callLLM,
  // Search gateway from @persistence/services
  SearchGateway
} from '../../services/index.js';
// Web agent imports for DIGEST action
import {
  runDigest,
  loadTopicsFromState,
  WEB_AGENT_PRESETS,
  MAX_TOPICS,
  getWebAgentStateKeys
} from '@persistence/services/web-agent';
import type { Env } from '../../bootstrap.js';

type ActionPayload = {
  action: string;
  internal?: string;
  indices?: string | number[];
  [key: string]: unknown;
};

type HandlerContext = {
  db: D1Database;
  env: Env;
  action: ActionPayload;
  cycleId: number;
};

type WebAgentPreset = keyof typeof WEB_AGENT_PRESETS;

function isWebAgentPreset(value: string): value is WebAgentPreset {
  return value in WEB_AGENT_PRESETS;
}

/**
 * Platform action handlers.
 *
 * These are fallbacks - executeTool() tries package handlers first via
 * handler-registry.js. Only actions NOT in the package registry reach these.
 */
export const ACTION_HANDLERS = {
  METASUMMARIZE: handleMetasummarize,
  PIN_IMAGE: handlePinImage,
  VIEW_IMAGES: handleViewImages,
  DIGEST: handleDigest
};

// =============================================================================
// METASUMMARIZE - Complex summarization service
// =============================================================================

/**
 * Handle METASUMMARIZE action.
 *
 * Consolidates multiple summaries into one. Uses the same summarization service
 * as SUMMARIZE but with different parameters.
 *
 * NOTE: This could be merged into SUMMARIZE handler with meta:true flag,
 * but kept separate for now due to different parameter handling.
 */
async function handleMetasummarize({ db, env, action, cycleId }: HandlerContext) {
  let indices = null;
  if (action.indices) {
    if (Array.isArray(action.indices)) {
      indices = action.indices.map((i: number) => parseInt(String(i), 10)).filter((i: number) => !isNaN(i));
    } else if (typeof action.indices === 'string') {
      indices = action.indices.split(',').map((i: string) => parseInt(i.trim(), 10)).filter((i: number) => !isNaN(i));
    }
  }

  const metaResult = await metaSummarize(db, indices, String(action.internal ?? ''), env);

  if (metaResult.success) {
    const indicesStr = metaResult.indices.length <= 5
      ? metaResult.indices.join(',')
      : `${metaResult.count} summaries`;
    await logHistory({
      db,
      type: 'summarize',
      content: `Consolidated summaries [${indicesStr}] into one`,
      internal: 'Summary layer compressed',
      cycleId
    });
    await setState(db, 'last_meta_summarize_time', new Date().toISOString());
    await setState(db, 'last_meta_summarize_count', String(metaResult.count));
    await setState(db, 'last_meta_run', JSON.stringify({
      trigger: 'loop',
      timestamp: new Date().toISOString(),
      summariesBefore: metaResult.summariesBefore,
      summariesConsolidated: metaResult.summariesConsolidated,
      summariesRemaining: metaResult.summariesRemaining,
      totalMessagesConsolidated: metaResult.totalMessagesConsolidated,
      provider: metaResult.provider,
      model: metaResult.model,
      durationMs: metaResult.durationMs,
      mode: metaResult.mode
    }));
  } else {
    await logHistory({
      db,
      type: 'summarize',
      content: `Metasummarize failed: ${metaResult.error}`,
      internal: action.internal,
      cycleId
    });
  }
}

// =============================================================================
// PIN_IMAGE / VIEW_IMAGES - Platform-only (no package handler)
// =============================================================================

/**
 * Handle PIN_IMAGE action.
 *
 * Delegates to the pinned-images service.
 */
async function handlePinImage({ db, action, cycleId }: HandlerContext) {
  await executePinImageAction({ db, decision: action, cycleId });
}

/**
 * Handle VIEW_IMAGES action.
 *
 * Delegates to the pinned-images service.
 */
async function handleViewImages({ db, action, cycleId }: HandlerContext) {
  await executeViewImagesAction({ db, decision: action, cycleId });
}

// =============================================================================
// DIGEST - Web Agent Topic Management
// =============================================================================

/**
 * Handle DIGEST action for web agent topic management.
 *
 * Operations:
 * - add_topic: Add a topic to the digest list (max MAX_TOPICS)
 * - remove_topic: Remove a topic from the list
 * - list: List current topics and status
 * - trigger: Force immediate digest run
 * - enable: Enable scheduled runs
 * - disable: Disable scheduled runs
 *
 * @upstream Called by: executeTool() via ACTION_HANDLERS
 * @downstream Calls: runWebAgent(), loadWebAgentConfig(), state functions
 */
async function handleDigest({ db, env, action, cycleId }: HandlerContext) {
  const op = typeof action.op === 'string' ? action.op : '';
  const topic = typeof action.topic === 'string' ? action.topic : '';
  const preset = typeof action.preset === 'string' ? action.preset : 'geopolitical';

  // Validate preset
  const validPresets = Object.keys(WEB_AGENT_PRESETS);
  if (!isWebAgentPreset(preset)) {
    await logHistory({
      db,
      type: 'thought',
      content: `DIGEST failed: Unknown preset "${preset}". Valid presets: ${validPresets.join(', ')}`,
      internal: action.internal,
      cycleId
    });
    return;
  }

  const presetConfig = WEB_AGENT_PRESETS[preset];
  const stateKeys = getWebAgentStateKeys(presetConfig.statePrefix);

  switch (op) {
    case 'add_topic': {
      if (!topic) {
        await logHistory({
          db,
          type: 'thought',
          content: 'DIGEST add_topic requires a topic parameter',
          internal: action.internal,
          cycleId
        });
        return;
      }

      // Load current topics with corruption protection
      let current: string[] = [];
      try {
        const raw = await getState(db, stateKeys.topics);
        const parsed = raw ? JSON.parse(raw) : [];
        current = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      } catch (e) {
        const normalizedError = e instanceof Error ? e : new Error(String(e));
        console.error(`[DIGEST] Corrupted topics JSON, resetting: ${normalizedError.message}`);
        current = [];
      }

      // Check max topics limit
      if (current.length >= MAX_TOPICS) {
        await logHistory({
          db,
          type: 'thought',
          content: `Cannot add topic: maximum ${MAX_TOPICS} topics allowed. Remove a topic first.`,
          internal: `Attempted to add "${topic}" but already at max capacity`,
          cycleId
        });
        return;
      }

      // Add if not duplicate
      if (!current.includes(topic)) {
        current.push(topic);
        await setState(db, stateKeys.topics, JSON.stringify(current));
        await logHistory({
          db,
          type: 'thought',
          content: `Added "${topic}" to ${preset} digest. Topics: ${current.join(', ')}`,
          internal: action.internal,
          cycleId
        });
      } else {
        await logHistory({
          db,
          type: 'thought',
          content: `Topic "${topic}" already in ${preset} digest`,
          internal: action.internal,
          cycleId
        });
      }
      break;
    }

    case 'remove_topic': {
      if (!topic) {
        await logHistory({
          db,
          type: 'thought',
          content: 'DIGEST remove_topic requires a topic parameter',
          internal: action.internal,
          cycleId
        });
        return;
      }

      let current: string[] = [];
      try {
        const raw = await getState(db, stateKeys.topics);
        const parsed = raw ? JSON.parse(raw) : [];
        current = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      } catch (e) {
        current = [];
      }

      const filtered = current.filter((t: string) => t !== topic);
      await setState(db, stateKeys.topics, JSON.stringify(filtered));

      await logHistory({
        db,
        type: 'thought',
        content: `Removed "${topic}" from ${preset} digest. Topics: ${filtered.length > 0 ? filtered.join(', ') : '(none)'}`,
        internal: action.internal,
        cycleId
      });
      break;
    }

    case 'list': {
      let topics: string[] = [];
      try {
        const raw = await getState(db, stateKeys.topics);
        const parsed = raw ? JSON.parse(raw) : [];
        topics = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [];
      } catch (e) {
        topics = [];
      }

      const enabled = await getState(db, stateKeys.enabled);
      const lastRun = await getState(db, stateKeys.lastRun);

      const status = [
        `**${preset} Digest**`,
        `Enabled: ${enabled === 'true' ? 'Yes' : 'No'}`,
        `Topics (${topics.length}/${MAX_TOPICS}): ${topics.length > 0 ? topics.join(', ') : '(none)'}`,
        `Last run: ${lastRun || 'Never'}`,
        `Interval: ${presetConfig.intervalHours} hours`
      ].join('\n');

      await logHistory({
        db,
        type: 'thought',
        content: status,
        internal: action.internal,
        cycleId
      });
      break;
    }

    case 'trigger': {
      // Load topics from state
      const topics = await loadTopicsFromState(presetConfig.statePrefix, { db, getState });

      if (topics.length === 0) {
        await logHistory({
          db,
          type: 'thought',
          content: `Cannot trigger ${preset} digest: no topics configured. Add topics first.`,
          internal: action.internal,
          cycleId
        });
        return;
      }

      await logHistory({
        db,
        type: 'thought',
        content: `Starting ${preset} digest for ${topics.length} topics...`,
        internal: action.internal,
        cycleId
      });

      // SearchGateway from @persistence/services - single entry point for searches
      if (!env.ANTHROPIC_API_KEY) {
        await logHistory({
          db,
          type: 'thought',
          content: `Cannot trigger ${preset} digest: ANTHROPIC_API_KEY is not configured.`,
          internal: action.internal,
          cycleId
        });
        return;
      }

      if (typeof env.ANTHROPIC_API_KEY !== 'string' || env.ANTHROPIC_API_KEY.length === 0) {
        await logHistory({
          db,
          type: 'thought',
          content: `Cannot trigger ${preset} digest: ANTHROPIC_API_KEY not configured.`,
          internal: action.internal,
          cycleId
        });
        return;
      }
      const searchGateway = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);

      // Run pure digest service - parallel searches, optional synthesis
      const result = await runDigest(
        {
          topics,
          synthesize: topics.length > 1, // Synthesize if multiple topics
          synthesisProvider: presetConfig.provider,
          synthesisModel: presetConfig.model
        },
        { searchGateway, callLLM, env }
      );

      // Log each topic result to history (web_digest type)
      for (const topicResult of result.topics) {
        if (topicResult.success) {
          await logHistory({
            db,
            type: 'web_digest',
            content: `**${topicResult.topic}**\n\n${topicResult.content}`,
            internal: `Query: ${topicResult.searchQuery} | Duration: ${topicResult.durationMs}ms`,
            cycleId
          });
        } else {
          await logHistory({
            db,
            type: 'thought',
            content: `Failed to fetch "${topicResult.topic}": ${topicResult.error}`,
            internal: action.internal,
            cycleId
          });
        }
      }

      // Log synthesis if generated
      if (result.synthesis) {
        await logHistory({
          db,
          type: 'web_digest',
          content: `**Daily Digest Synthesis**\n\n${result.synthesis}`,
          internal: `Provider: ${result.synthesisMetadata?.provider} | Model: ${result.synthesisMetadata?.model} | Cost: $${result.synthesisMetadata?.cost?.toFixed(4) ?? 0}`,
          cycleId
        });
      }

      // Update last run timestamp
      await setState(db, stateKeys.lastRun, new Date().toISOString());

      await logHistory({
        db,
        type: 'thought',
        content: `${preset} digest complete: ${result.successCount}/${topics.length} topics in ${result.durationMs}ms${result.errorCount > 0 ? ` (${result.errorCount} errors)` : ''}`,
        internal: JSON.stringify(result),
        cycleId
      });
      break;
    }

    case 'enable': {
      await setState(db, stateKeys.enabled, 'true');
      await logHistory({
        db,
        type: 'thought',
        content: `${preset} digest enabled. Will run every ${presetConfig.intervalHours} hours.`,
        internal: action.internal,
        cycleId
      });
      break;
    }

    case 'disable': {
      await setState(db, stateKeys.enabled, null);
      await logHistory({
        db,
        type: 'thought',
        content: `${preset} digest disabled.`,
        internal: action.internal,
        cycleId
      });
      break;
    }

    default:
      await logHistory({
        db,
        type: 'thought',
        content: `Unknown DIGEST operation: "${op}". Valid ops: add_topic, remove_topic, list, trigger, enable, disable`,
        internal: action.internal,
        cycleId
      });
  }
}
