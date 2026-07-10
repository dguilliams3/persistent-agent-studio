/**
 * @module @persistence/services/feedback
 * @description Action feedback system - surfaces tool failures and issues
 *
 * Provides feedback when actions fail or have issues, displayed in
 * the next cycle's context for learning from mistakes.
 *
 * Also handles action name normalization (typo correction, legacy action
 * transformation) so actions execute even with minor spelling variations.
 *
 * Basin Pattern: accepts db as parameter, no platform-specific deps.
 *
 * @upstream Called by: action executors, streaming action execution
 * @downstream Calls: @persistence/db (getState, setState)
 */

import { getState, setState } from "@persistence/db";

type DrizzleD1 = Parameters<typeof getState>[0];
type ActionPayload = Record<string, unknown> & { action?: string };
type FeedbackDetails = Record<string, unknown>;
type FeedbackItem = {
  type: string;
  details: FeedbackDetails;
  message: string;
  timestamp: string;
};

// ============================================================================
// Action Normalization - Easy to extend with new typos/aliases
// ============================================================================

/**
 * Map of common action typos/aliases to canonical action names.
 * Add new entries here when the AI uses variant spellings.
 */
const ACTION_ALIASES: Record<string, string> = {
  // Past tense variants
  MESSAGED_USER: "MESSAGE_USER",
  THOUGHT: "THINK",
  WONDERED: "WONDER",
  REMEMBERED: "REMEMBER",
  SEARCHED: "SEARCH",
  SLEPT: "SLEEP",
  EXISTED: "EXIST",

  // Shorthand variants
  MESSAGE: "MESSAGE_USER",
  MSG: "MESSAGE_USER",
  MSG_USER: "MESSAGE_USER",

  // Common mistakes
  MESAGE_USER: "MESSAGE_USER",
  MASSAGE_USER: "MESSAGE_USER",

  // Legacy art action names -> consolidated ART action
  // (structural transformation happens in transformLegacyAction)
  SHARE_ART: "ART",
  SHARED_ART: "ART",
  MAKE_ART: "ART",
  MADE_ART: "ART",
};

/**
 * Legacy actions that require structural transformation (not just name aliasing).
 * Maps old action names to default op values that should be set if op is missing.
 */
const LEGACY_ACTION_DEFAULTS: Record<string, Record<string, string>> = {
  SHARE_ART: { op: "share" },
  SHARED_ART: { op: "share" },
  MAKE_ART: { op: "make" },
  MADE_ART: { op: "make" },
};

/**
 * Transform a legacy action to its consolidated form.
 *
 * Some legacy actions (SHARE_ART, MAKE_ART) were replaced by the consolidated
 * ART action with an `op` parameter. This function transforms the old format
 * to the new format so legacy usage still works.
 */
export function transformLegacyAction(action: ActionPayload): ActionPayload {
  if (!action || !action.action) return action;

  const originalName = action.action.toUpperCase();
  const defaults = LEGACY_ACTION_DEFAULTS[originalName];

  if (defaults) {
    return {
      ...action,
      ...Object.fromEntries(
        Object.entries(defaults).filter(([key]) => action[key] === undefined),
      ),
    };
  }

  return action;
}

/**
 * Matches any dynamic MESSAGE_<NAME> action name (including the canonical
 * MESSAGE_USER itself), but not the MESSAGED_/MESAGE_/MASSAGE_ typo variants
 * above, which have their own explicit ACTION_ALIASES entries.
 */
const DYNAMIC_MESSAGE_ACTION_PATTERN = /^MESSAGE_[A-Z0-9_]+$/;

/**
 * Normalize action name to canonical form.
 *
 * Handles common typos and aliases so actions execute even with
 * minor spelling variations.
 *
 * Also resolves the dynamic humanName tool name (see
 * getMessageActionDisplayName() in @persistence/tools): when a persona is
 * configured with humanName "Alex", the model sees the tool as MESSAGE_ALEX
 * in its prompt. Any MESSAGE_<NAME> the model emits back is mapped here to
 * the single internal MESSAGE_USER action, so storage/routing never depend
 * on humanName. MESSAGE_USER itself round-trips through this rule as a
 * no-op, so it always works regardless of the configured humanName.
 */
export function normalizeAction(action: string): string {
  if (!action) return action;
  const upper = action.toUpperCase();
  if (ACTION_ALIASES[upper]) return ACTION_ALIASES[upper];
  if (DYNAMIC_MESSAGE_ACTION_PATTERN.test(upper)) return "MESSAGE_USER";
  return upper;
}

// ============================================================================
// Feedback Types - Easy to extend with new feedback categories
// ============================================================================

export const FEEDBACK_TYPES = {
  ACTION_NORMALIZED: "action_normalized",
  ACTION_UNKNOWN: "action_unknown",
  VOICE_FAILED: "voice_failed",
  VOICE_REQUESTED: "voice_requested",
  MESSAGE_FAILED: "message_failed",
  CONTENT_MISSING: "content_missing",
  SEARCH_FAILED: "search_failed",
  SEARCH_FIELD_FIXED: "search_field_fixed",
} as const;

/**
 * Human-readable templates for feedback messages.
 */
const FEEDBACK_TEMPLATES: Record<string, (details: FeedbackDetails) => string> =
  {
    [FEEDBACK_TYPES.ACTION_NORMALIZED]: (d) =>
      `\u26a0\ufe0f Action "${d.original}" was auto-corrected to "${d.corrected}"`,

    [FEEDBACK_TYPES.ACTION_UNKNOWN]: (d) =>
      `\u274c Unknown action "${d.action}" - check spelling. Available: MESSAGE_USER, THINK, WONDER, etc.`,

    [FEEDBACK_TYPES.VOICE_FAILED]: (d) =>
      `\ud83d\udd07 Voice generation failed: ${d.error}. Text message was still sent.`,

    [FEEDBACK_TYPES.VOICE_REQUESTED]: (d) =>
      `\ud83d\udd0a Voice sent successfully (${d.chars} chars, ${d.model})`,

    [FEEDBACK_TYPES.MESSAGE_FAILED]: (d) =>
      `\u274c Failed to send message: ${d.error}`,

    [FEEDBACK_TYPES.CONTENT_MISSING]: (d) =>
      `\u26a0\ufe0f Action "${d.action}" had no content - nothing was executed`,

    [FEEDBACK_TYPES.SEARCH_FAILED]: (d) =>
      `\ud83d\udd0d\u274c Web search failed: ${d.error}. Query was: "${d.query}"`,

    [FEEDBACK_TYPES.SEARCH_FIELD_FIXED]: () =>
      `\u26a0\ufe0f SEARCH used "query" field instead of "content" - auto-corrected and executed`,
  };

// ============================================================================
// Feedback Storage - Persists to next cycle
// ============================================================================

/**
 * Add feedback for the next cycle.
 *
 * Stores feedback in D1 state that will be shown in the next
 * context assembly. Feedback is cleared after being shown.
 */
export async function addFeedback(
  db: DrizzleD1,
  type: string,
  details: FeedbackDetails,
): Promise<void> {
  try {
    const existing = JSON.parse(
      (await getState(db, "pending_feedback")) || "[]",
    ) as FeedbackItem[];
    existing.push({
      type,
      details,
      message:
        FEEDBACK_TEMPLATES[type]?.(details) ||
        `${type}: ${JSON.stringify(details)}`,
      timestamp: new Date().toISOString(),
    });
    await setState(db, "pending_feedback", JSON.stringify(existing));
  } catch (err) {
    console.error("Failed to add feedback:", err);
  }
}

/**
 * Get pending feedback and clear it.
 *
 * Retrieves all feedback accumulated since last cycle and clears
 * the queue. Called during context assembly.
 */
export async function getFeedbackAndClear(
  db: DrizzleD1,
): Promise<FeedbackItem[]> {
  try {
    const raw = await getState(db, "pending_feedback");
    const feedback = JSON.parse(raw || "[]") as FeedbackItem[];
    if (feedback.length > 0) {
      await setState(db, "pending_feedback", "[]");
    }
    return feedback;
  } catch (err) {
    console.error("Failed to get feedback:", err);
    return [];
  }
}

/**
 * Format feedback array for inclusion in context.
 *
 * Converts feedback array to a human-readable string.
 * Returns empty string if no feedback.
 */
export function formatFeedbackForContext(
  feedback: FeedbackItem[] | null | undefined,
): string {
  if (!feedback || feedback.length === 0) return "";

  const messages = feedback.map((f) => f.message).join("\n");
  return `--- FEEDBACK FROM LAST CYCLE ---
${messages}
--- END FEEDBACK ---

`;
}
