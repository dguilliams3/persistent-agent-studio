/**
 * DIGEST Handler
 *
 * @module @persistence/tools/definitions/digest/handler
 * @description Executes the DIGEST action - manages scheduled web digests.
 *
 * EXECUTION FLOW:
 * 1. Receives validated parameters (op, topic?, preset?)
 * 2. Routes to appropriate operation handler
 * 3. For state changes: Updates state table via getState/setState
 * 4. For trigger: Returns metadata for platform layer to execute digest
 * 5. Returns success result with operation outcome
 *
 * DATABASE TOUCHES:
 * - READ/WRITE `state` table for topic list, enabled flag, last run time
 * - State keys follow pattern: {preset}_topics, {preset}_enabled, {preset}_last_run
 *
 * SIDE EFFECTS:
 * - State table updates for add/remove/enable/disable
 * - For trigger: Platform layer performs web searches + LLM calls + history logging
 *
 * OPERATION DETAILS:
 *
 * add_topic:
 *   - Reads current topics from state
 *   - Validates max 10 topics
 *   - Adds new topic to JSON array
 *   - Writes updated array to state
 *
 * remove_topic:
 *   - Reads current topics from state
 *   - Filters out the specified topic
 *   - Writes updated array to state
 *
 * list_topics:
 *   - Reads current topics from state
 *   - Returns topics array with enabled status
 *
 * trigger:
 *   - Returns metadata for platform layer to execute
 *   - Platform calls runDigest() with current topics
 *   - Results logged to history as web_digest
 *
 * enable/disable:
 *   - Sets {preset}_enabled state to 'true'/'false'
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls:
 *   - getState/setState from @persistence/db
 *   - Platform layer performs actual digest via runDigest()
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { DigestParams } from "./params";
import { getState, setState, type DrizzleD1 } from "@persistence/db";

// =============================================================================
// LOCAL CONSTANTS (avoid cyclic dependency with @persistence/services)
// =============================================================================

/** Maximum topics allowed per preset */
const MAX_TOPICS = 10;

/**
 * Preset configurations - mirrors @persistence/services/web-agent/types.ts
 * Only includes the statePrefix field needed by this handler.
 */
const DIGEST_PRESETS = {
  geopolitical: { statePrefix: "web_agent_geopolitical" },
  tech: { statePrefix: "web_agent_tech" },
  daily: { statePrefix: "web_agent_daily" },
} as const;

type DigestPresetName = keyof typeof DIGEST_PRESETS;

/**
 * Safely parse topics JSON from state.
 * Returns empty array on parse failure instead of throwing.
 *
 * @param json - Raw JSON string from state, or undefined
 * @param preset - Preset name for error logging
 * @returns Array of topic strings, empty on failure
 */
function parseTopicsFromState(
  json: string | undefined,
  preset: string,
): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      console.error(`[DIGEST] Topics for ${preset} is not an array, resetting`);
      return [];
    }
    return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    console.error(
      `[DIGEST] Corrupted topics JSON for ${preset}, resetting to empty`,
    );
    return [];
  }
}

/**
 * Get state keys for a given prefix.
 */
function getStateKeys(statePrefix: string) {
  return {
    topics: `${statePrefix}_topics`,
    enabled: `${statePrefix}_enabled`,
    lastRun: `${statePrefix}_last_run`,
  };
}

/**
 * Handle DIGEST action.
 *
 * Routes to the appropriate operation based on the op parameter.
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult with operation outcome
 */
export const handler: ToolHandler<DigestParams> = async (
  params: DigestParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { op, topic, preset = "geopolitical", internal } = params;
  const { db } = ctx;
  const typedDb = db as DrizzleD1;

  // Get preset config and state keys
  const presetConfig = DIGEST_PRESETS[preset as DigestPresetName];
  if (!presetConfig) {
    return {
      success: false,
      error: `Unknown preset: ${preset}. Valid: geopolitical, tech, daily`,
    };
  }

  const stateKeys = getStateKeys(presetConfig.statePrefix);

  try {
    switch (op) {
      case "add_topic": {
        if (!topic) {
          return {
            success: false,
            error: "topic is required for add_topic operation",
          };
        }

        // Read current topics (safe parse)
        const topicsJson = await getState(typedDb, stateKeys.topics);
        const topics = parseTopicsFromState(topicsJson, preset);

        // Check max limit
        if (topics.length >= MAX_TOPICS) {
          return {
            success: false,
            error: `Maximum ${MAX_TOPICS} topics allowed. Remove one first.`,
          };
        }

        // Check for duplicates
        if (topics.includes(topic)) {
          return {
            success: false,
            error: `Topic "${topic}" is already in the list.`,
          };
        }

        // Add topic
        topics.push(topic);
        await setState(typedDb, stateKeys.topics, JSON.stringify(topics));

        return {
          success: true,
          data: {
            op: "add_topic",
            topic,
            preset,
            totalTopics: topics.length,
            topics,
          },
        };
      }

      case "remove_topic": {
        if (!topic) {
          return {
            success: false,
            error: "topic is required for remove_topic operation",
          };
        }

        // Read current topics (safe parse)
        const topicsJson = await getState(typedDb, stateKeys.topics);
        const topics = parseTopicsFromState(topicsJson, preset);

        // Check if exists
        if (!topics.includes(topic)) {
          return {
            success: false,
            error: `Topic "${topic}" is not in the list.`,
          };
        }

        // Remove topic
        const newTopics = topics.filter((t) => t !== topic);
        await setState(typedDb, stateKeys.topics, JSON.stringify(newTopics));

        return {
          success: true,
          data: {
            op: "remove_topic",
            topic,
            preset,
            totalTopics: newTopics.length,
            topics: newTopics,
          },
        };
      }

      case "list_topics": {
        // Safe parse of topics
        const topicsJson = await getState(typedDb, stateKeys.topics);
        const topics = parseTopicsFromState(topicsJson, preset);
        const enabled = await getState(typedDb, stateKeys.enabled);
        const lastRun = await getState(typedDb, stateKeys.lastRun);

        return {
          success: true,
          data: {
            op: "list_topics",
            preset,
            enabled: enabled === "true",
            lastRun: lastRun ?? null,
            totalTopics: topics.length,
            topics,
          },
        };
      }

      case "trigger": {
        // Rate limiting: enforce 5-minute minimum between triggers
        const MIN_TRIGGER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
        const lastRun = await getState(typedDb, stateKeys.lastRun);
        if (lastRun) {
          const elapsed = Date.now() - new Date(lastRun).getTime();
          if (elapsed < MIN_TRIGGER_INTERVAL_MS) {
            const waitSeconds = Math.ceil(
              (MIN_TRIGGER_INTERVAL_MS - elapsed) / 1000,
            );
            return {
              success: false,
              error: `Rate limited. Wait ${waitSeconds}s before triggering again.`,
            };
          }
        }

        // Read topics to include in metadata (safe parse)
        const topicsJson = await getState(typedDb, stateKeys.topics);
        const topics = parseTopicsFromState(topicsJson, preset);

        if (topics.length === 0) {
          return {
            success: false,
            error: "No topics configured. Use add_topic first.",
          };
        }

        // Return metadata for platform layer to execute
        return {
          success: true,
          data: {
            op: "trigger",
            preset,
            topics,
            // Signal to platform layer to run the digest
            needsDigestExecution: true,
            statePrefix: presetConfig.statePrefix,
          },
        };
      }

      case "enable": {
        await setState(typedDb, stateKeys.enabled, "true");

        return {
          success: true,
          data: {
            op: "enable",
            preset,
            enabled: true,
          },
        };
      }

      case "disable": {
        await setState(typedDb, stateKeys.enabled, "false");

        return {
          success: true,
          data: {
            op: "disable",
            preset,
            enabled: false,
          },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown op: ${op}. Valid: add_topic, remove_topic, list_topics, trigger, enable, disable`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `DIGEST ${op} failed: ${(error as Error).message}`,
    };
  }
};
