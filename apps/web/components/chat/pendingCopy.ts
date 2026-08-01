/**
 * What the chat's pending affordance is allowed to say
 *
 * @module components/chat/pendingCopy
 * @description One pure decision: given which wait is running and which build
 * is behind it, produce the visible status line and the spoken label for the
 * chat's pending indicator.
 *
 * This exists as its own function because the indicator is a CLAIM, and the
 * two builds do not support the same claim:
 *
 * - LIVE — a real model runs. A send queues a quick follow-up (POST /message →
 *   queueQuickFollowup), so the persona picks the message up on its next cycle
 *   instead of waiting out the full interval; "on its next cycle" is the true
 *   statement. Once a cycle is actually running, "thinking" is true too.
 * - DEMO — nothing is thinking. The reply is a fixture string on a timer, and
 *   the specimen says exactly that in the reply it sends back. An indicator
 *   implying deliberation would be the one lie this exhibit cannot afford, so
 *   the copy reads as a fetch, because that is what it is.
 *
 * Pure — no store, no React, no module state. Split out of ChatView so both
 * branches are directly testable; the live branch has no rendered path in the
 * demo exhibit and would otherwise never be exercised.
 *
 * @upstream Called by: ChatView (pending affordance)
 * @downstream Calls: nothing
 * @tests apps/web/components/chat/__tests__/pendingCopy.test.ts
 */

export interface PendingCopyInput {
  /** A think cycle is running (store: isThinking). */
  isThinking: boolean;
  /** The exhibit build — fixtures, no model (api/client: DEMO_MODE). */
  demoMode: boolean;
  /** Display name of the active persona. */
  personaName: string;
}

export interface PendingCopy {
  /** Visible line under the breathing dots. */
  statusText: string;
  /** Accessible name for the dots — must agree with statusText. */
  pendingLabel: string;
}

/**
 * @description Resolve the honest copy for whichever wait is running.
 *
 * @param input - which wait, which build, whose name
 * @returns visible status line + accessible label
 *
 * @example
 * pendingChatCopy({ isThinking: false, demoMode: true, personaName: 'Ada' });
 * // → 'Fetching a scripted reply — no model is thinking about this'
 */
export function pendingChatCopy({
  isThinking,
  demoMode,
  personaName,
}: PendingCopyInput): PendingCopy {
  if (isThinking) {
    return demoMode
      ? {
          statusText:
            'Scripted cycle, running on the real timing — nothing is thinking',
          pendingLabel: 'Running a scripted cycle',
        }
      : {
          statusText: `${personaName} is picking this up — usually under 2 minutes`,
          pendingLabel: 'Thinking',
        };
  }
  return demoMode
    ? {
        statusText: 'Fetching a scripted reply — no model is thinking about this',
        pendingLabel: 'Fetching a scripted reply',
      }
    : {
        statusText: `${personaName} has your message — replying on its next cycle`,
        pendingLabel: `Waiting for ${personaName} to reply`,
      };
}
