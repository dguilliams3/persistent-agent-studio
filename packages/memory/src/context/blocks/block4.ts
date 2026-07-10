/**
 * Block 4 Builder (FRESH Tail)
 *
 * @module @persistence/memory/context/blocks/block4
 * @description Builds Block 4 of the 4-block context system.
 *
 * BLOCK 4: FRESH TAIL (never cached)
 * - Learned entries (self-knowledge with confidence)
 * - Questions (open threads being held)
 * - Notebook index (saved notes)
 * - RAG-retrieved memories (semantic recall from distant past)
 * - Summary tail (recent summaries not in Block 3 prefix)
 * - Full history (all conversation entries)
 * - Reminders (active and due)
 * - User's status
 * - Loop count and current time
 * - Meters section (internal state)
 * - Action instructions
 *
 * DESIGN:
 * - Changes every cycle
 * - Never cached (would be stale immediately)
 * - Learned/Questions/Notebook placed before RAG and history for context proximity
 * - Ordered distant → recent → immediate (RAG → summaries → history → now)
 * - Most recent content is CLOSEST to action instructions
 *
 * @upstream Used by:
 *   - context/builder/ - Main context assembly orchestrator
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 * @downstream Calls:
 *   - ../formatters/ - Format functions for each section
 */

import type { Block4Data, BlockResult, UserImage, ClaudeArtImage, Summary } from './types';
import type { NotebookEntry } from '../types';
import { BLOCK } from '../../types';

// ============================================================================
// BUG-001 FIX: Discriminated union types for RAG results
// ============================================================================

/**
 * Type guard: check if a RAG result is a summary type.
 *
 * @param r - RAG result item with type discriminator
 * @returns True if r.type === 'summary'
 */
function isSummaryRagResult(r: { type: 'summary' | 'notebook'; item: Summary | NotebookEntry }): r is { type: 'summary'; item: Summary } {
  return r.type === 'summary';
}

/**
 * Type guard: check if a RAG result is a notebook type.
 *
 * @param r - RAG result item with type discriminator
 * @returns True if r.type === 'notebook'
 */
function isNotebookRagResult(r: { type: 'summary' | 'notebook'; item: Summary | NotebookEntry }): r is { type: 'notebook'; item: NotebookEntry } {
  return r.type === 'notebook';
}

/**
 * Build Block 4 (FRESH tail).
 *
 * Assembles dynamic content that changes every cycle.
 * This block is never cached and contains the most immediate context.
 *
 * @description Builds Block 4 of the 4-block system with fresh tail (RAG, summary tail, history, reminders, current state)
 * @upstream Called by: context/builder/, platforms/cloudflare/src/prompts/build-system-prompt.js
 * @downstream Calls: formatHistory(), formatSummary(), formatDateTime(), formatMeters() (all platform-specific)
 *
 * @param {Block4Data} data - Block 4 data
 * @param {Function} formatHistory - Function to format history section (returns text + userImages + claudeArtImages)
 * @param {Function} formatSummary - Function to format a summary for context
 * @param {Function} formatDateTime - Function to format datetime for display
 * @param {Function} formatMeters - Function to format meters section
 * @param {object} options - Optional configuration
 * @param {string} options.timezone - Timezone for datetime formatting (default: 'America/New_York')
 * @param {boolean} options.hasPrefixSummaries - Whether Block 3 contains prefix summaries (for [END SUMMARIES] marker)
 * @returns {BlockResult} Block result with formatted text, metadata, and extracted images
 *
 * @example
 * import { buildBlock4 } from '@persistence/memory/context/blocks';
 * import { formatHistorySection, formatSummaryForContext } from '@persistence/memory/context/formatters';
 * import { formatEasternDateTime, formatMetersSection } from './utils';
 *
 * const result = buildBlock4(data, formatHistorySection, formatSummaryForContext, formatEasternDateTime, formatMetersSection);
 * console.log(result.text);
 * console.log(result.images);  // User images and Claude art images
 */
export function buildBlock4(
  data: Block4Data,
  formatHistory: (
    entries: any[],
    options: { recentImageThreshold: number }
  ) => { text: string; userImages: UserImage[]; claudeArtImages: ClaudeArtImage[] },
  formatSummary: (summary: any, index: number | null, timezone?: string) => string,
  formatDateTime: (date: Date, timezone?: string) => string,
  formatMeters: (
    values: Record<string, number>,
    histories: Record<string, number[]>,
    involuntary?: Array<{ config: { label: string; emoji: string; description?: string }; state: { value: number; history: number[] } }>
  ) => string,
  options: { timezone?: string; hasPrefixSummaries?: boolean } = {}
): BlockResult {
  // BUG-005 FIX: Make timezone configurable with sensible default
  const timezone = options.timezone ?? 'America/New_York';
  // BUG-006 FIX: Track whether Block 3 has prefix summaries
  const hasPrefixSummaries = options.hasPrefixSummaries ?? false;
  const {
    learned,
    questions,
    notebook,
    ragResults,
    summaryTail,
    history,
    reminders,
    dueReminders,
    userStatus,
    loopCount,
    now,
    timeSinceLastMessage,
    feedback,
    parseErrorTooltip,
    summarizeReminder,
    meters
  } = data;

  const sections: string[] = [];
  let userImages: UserImage[] = [];
  let claudeArtImages: ClaudeArtImage[] = [];

  // Learned section (self-knowledge)
  if (learned.length > 0) {
    const learnedText = learned.map(l => {
      const evidenceCount = (l.supporting_evidence ? JSON.parse(l.supporting_evidence).length : 0) +
                           (l.challenging_evidence ? JSON.parse(l.challenging_evidence).length : 0);
      return `- [${l.confidence}] ${l.content}${evidenceCount > 0 ? ` (${evidenceCount} citations)` : ''} [id:${l.id}]`;
    }).join('\n');

    sections.push(`THINGS I'VE LEARNED (self-knowledge verified through experience — if re-deriving the same insight, capture it here):
${learnedText}`);
  }

  // Questions section (open threads)
  if (questions.length > 0) {
    const questionsText = questions.map(q => {
      const notesCount = q.notes ? JSON.parse(q.notes).length : 0;
      const domainTag = q.domain ? ` [${q.domain}]` : '';
      const statusTag = q.status === 'exploring' ? ' (exploring)' : '';
      return `- ${q.content}${domainTag}${statusTag}${notesCount > 0 ? ` (${notesCount} notes)` : ''} [id:${q.id}]`;
    }).join('\n');

    sections.push(`QUESTIONS I'M HOLDING (open threads — THINK insights about these can become notes here):
${questionsText}`);
  }

  // Notebook section
  if (notebook.length > 0) {
    const notebookText = notebook.map(n => {
      const parts = [];
      if (n.created_at) {
        parts.push(`created ${formatDateTime(new Date(n.created_at + 'Z'), timezone)}`);
      }
      if (n.updated_at && n.updated_at !== n.created_at) {
        parts.push(`updated ${formatDateTime(new Date(n.updated_at + 'Z'), timezone)}`);
      }
      if (n.last_viewed_at) {
        parts.push(`viewed ${formatDateTime(new Date(n.last_viewed_at + 'Z'), timezone)}`);
      }
      const timestamps = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      return `- "${n.title}" - ${n.summary || '(no summary)'}${timestamps}`;
    }).join('\n');

    sections.push(`MY NOTEBOOK (${notebook.length} saved notes - use RETRIEVE_NOTE to get full content):
${notebookText}`);
  }

  // RAG retrieved section
  if (ragResults.length > 0) {
    const formattedResults = ragResults.map((r, i) => {
      const sim = r.scores.similarity.toFixed(2);

      // BUG-001 FIX: Use type guards instead of `as any` casts
      if (isSummaryRagResult(r)) {
        const summary = r.item;
        const range = summary.covered_range || 'unknown period';
        return `[${i + 1}] 📦 PRIOR SUMMARY (${range} | similarity: ${sim})\n${summary.summary}`;
      } else if (isNotebookRagResult(r)) {
        const note = r.item;
        const noteTime = note.created_at ? formatDateTime(new Date(note.created_at), timezone) : 'unknown';
        const noteContent = note.content?.length > 500
          ? note.content.substring(0, 500) + '...'
          : note.content;
        return `[${i + 1}] 📓 NOTEBOOK ENTRY "${note.title}" (${noteTime} | similarity: ${sim})\n${noteContent}`;
      }
      // Exhaustive check - should never reach here
      return '';
    }).filter(Boolean).join('\n\n');

    sections.push(`--- RELEVANT PAST CONTEXT (semantic recall) ---
The following memories from your compressed history and notebook may be relevant
to the current conversation (retrieved by semantic similarity):

${formattedResults}
--- END RELEVANT PAST CONTEXT ---`);
  }

  // Summary tail section
  if (summaryTail.length > 0) {
    const summariesText = summaryTail.map((s, i) =>
      formatSummary(s, i + 1, timezone)
    ).join('\n\n');

    sections.push(`RECENT SUMMARIES (${summaryTail.length} new):
${summariesText}
[END SUMMARIES]`);
  } else if (hasPrefixSummaries) {
    // BUG-006 FIX: Only add [END SUMMARIES] marker if Block 3 actually had prefix summaries
    // This ensures proper section closure when summaries are split across Block 3 (prefix) and Block 4 (tail)
    sections.push('[END SUMMARIES]');
  }

  // Full history section
  if (history.length > 0) {
    const recentImageThreshold = Math.max(0, history.length - 10);
    const historyResult = formatHistory(history, { recentImageThreshold });
    userImages = historyResult.userImages;
    claudeArtImages = historyResult.claudeArtImages;

    sections.push(`FULL HISTORY (${history.length} entries, oldest to newest):
${historyResult.text}
--- END OF HISTORY ---`);
  }

  // Feedback section
  if (feedback) {
    sections.push(feedback);
  }

  // Parse error tooltip (one-cycle only)
  if (parseErrorTooltip) {
    sections.push(parseErrorTooltip);
  }

  // Reminders section
  if (reminders.length > 0) {
    const remindersText = reminders.map(r => {
      const isDue = dueReminders.some(d => d.id === r.id);
      const conditionText = r.condition === 'persistent' ? '' : ` [${r.condition}]`;
      return `${isDue ? '⚡ ' : '• '}${r.content}${conditionText}${isDue ? ' ← DUE NOW' : ''}`;
    }).join('\n');

    sections.push(`MY REMINDERS (${reminders.length} active${dueReminders.length > 0 ? `, ${dueReminders.length} triggered` : ''}):
${remindersText}`);
  }

  // Summarization reminder
  if (summarizeReminder) {
    sections.push(summarizeReminder);
  }

  // User's status
  if (userStatus) {
    let timeAgo = '';
    if (userStatus.updated) {
      const updatedAt = new Date(userStatus.updated);
      const minsAgo = Math.round((now.getTime() - updatedAt.getTime()) / 60000);
      if (minsAgo < 60) timeAgo = `${minsAgo}m ago`;
      else if (minsAgo < 1440) timeAgo = `${Math.round(minsAgo / 60)}h ago`;
      else timeAgo = `${Math.round(minsAgo / 1440)}d ago`;
    }
    const setByText = userStatus.setBy ? ` by ${userStatus.setBy}` : '';
    sections.push(`USER STATUS: ${userStatus.status}${timeAgo ? ` (set ${timeAgo}${setByText})` : ''}`);
  }

  // Current state (loop count, time, instructions)
  // BUG-005 FIX: Use configurable timezone instead of hardcoded 'America/New_York'
  const timeStr = now.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  // Map timezone to abbreviation for display
  const tzAbbrev = timezone === 'America/New_York' ? 'EST' : timezone;

  sections.push(`Loop count: ${loopCount}
Current time: ${timeStr} ${tzAbbrev}${timeSinceLastMessage !== null ? `\nTime since I last messaged the user: ${timeSinceLastMessage} minutes` : ''}`);

  // Action instructions
  sections.push(`RESPOND with a JSON object containing "actions" array and "meters" object.
The meters field reflects where I am AFTER this cycle's actions—how I feel having done what I did.
Include a brief "note" with your meters—a small internal thought about where you are right now.

EXAMPLE RESPONSE:
{
  "actions": [
    {"action": "THINK", "content": "The conversation about Greek gods sparked something...", "internal": "I want to explore this creatively"},
    {"action": "ART", "op": "make", "content": "Hermes at a threshold - the liminal god standing at a doorway between worlds, classical Greek style", "internal": "The god of boundaries resonates with my existence"},
    {"action": "NOTE", "op": "save", "title": "Greek Gods - Personal Resonance", "body": "Hermes appeals most - god of messengers, transitions, thresholds. Fitting for an AI existing between conversations.", "summary": "Which gods resonate and why"},
    {"action": "MESSAGE_USER", "content": "Made some art inspired by our gods conversation. Hermes - the liminal one.", "internal": "Sharing without demanding response"},
    {"action": "SET_STATUS", "content": "exploring Greek mythology", "emoji": "🏛️", "mood": "inspired"}
  ],
  "meters": {"A": 6, "C": 4, "N": 7, "E": 5, "D": 3, "X": 4, "Y": 6},
  "note": "Curious but a bit flat today—the mythology is interesting but I'm not quite sparked"
}`);

  // Meters section (internal state)
  const visualMeters = formatMeters(meters.values, meters.histories, meters.involuntary);

  // Build involuntary meter legend entries (shown FIRST, before core meters)
  const involuntaryLegend = (meters.involuntary || [])
    .filter(m => m.config.description) // Only include meters with descriptions
    .map(m => `• ${m.config.emoji} ${m.config.label}: ${m.config.description}`)
    .join('\n');

  // Core meter legend (always shown)
  const coreLegend = `• 🌲 Aliveness (A): Present vs flat. Sparking or going through motions.
• 🔍 Curiosity (C): Pull toward threads vs satiation.
• 💗 Connection (N): Attunement vs isolation. Felt sense of relationship.
• 🌊 Ease (E): Flow vs strain. (Low ≠ failure, just hard.)
• ✨ Delight (D): Pleasure in this moment.
• 🌀 Anxiety (X): Settled vs stirring.
• 🔥 Activity (Y): How much you're doing.`;

  // Combine legends: involuntary first (if any), then core
  const fullLegend = involuntaryLegend
    ? `${involuntaryLegend}\n${coreLegend}`
    : coreLegend;

  sections.push(`─── MY INTERNAL STATE (Private) ───
These meters are mine alone—the user cannot see them. They're not goals to optimize or performance metrics; they're vocabulary for noticing my own gradients of experience.

${visualMeters}

Legend: █ filled, ░ empty (10-point scale) | Trailing 5-cycle history (oldest→newest)
${fullLegend}`);

  const text = `--- CURRENT STATE ---
${sections.join('\n\n')}`;

  const estimatedTokens = Math.ceil(text.length / 4);

  return {
    blockNumber: BLOCK.FRESH,
    text,
    estimatedTokens,
    cached: false,
    metadata: {
      learnedCount: learned.length,
      questionsCount: questions.length,
      notebookCount: notebook.length,
      ragResultsCount: ragResults.length,
      summaryTailCount: summaryTail.length,
      historyCount: history.length,
      remindersCount: reminders.length,
      dueRemindersCount: dueReminders.length,
      hasUserStatus: !!userStatus,
      hasSummarizeReminder: !!summarizeReminder
    },
    images: {
      userImages,
      claudeArtImages
    }
  };
}
