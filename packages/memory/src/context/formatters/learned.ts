/**
 * Learned & Questions Formatters for Context
 *
 * @module @persistence/memory/context/formatters/learned
 * @description Formats self-knowledge and open questions for Claude's system prompt.
 *
 * LEARNED FORMAT IN CONTEXT:
 * ```
 * THINGS I'VE LEARNED (self-knowledge verified through experience):
 * - [high] Taking breaks improves my creative output (3 citations) [id:1]
 * - [medium] The user prefers concise responses in the morning [id:2]
 * ```
 *
 * QUESTIONS FORMAT IN CONTEXT:
 * ```
 * QUESTIONS I'M HOLDING (open threads):
 * - What does it mean to be truly curious? [philosophy] (exploring) (2 notes) [id:1]
 * - How does memory shape identity? [consciousness] [id:2]
 * ```
 *
 * KEY BEHAVIORS:
 * - Learned: Shows confidence level + content + citation count + ID
 * - Questions: Shows content + domain + status + notes count + ID
 * - Headers include guidance for when to use these features
 * - IDs included so Claude can reference/update entries
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatLearnedSection, formatQuestionsSection for Block 3
 * @downstream Calls:
 *   - No dependencies (pure string formatting)
 */

import type { LearnedEntry, QuestionEntry, FormatOptions } from '../types';
import type { LearnedFormatOptions, QuestionsFormatOptions } from './types';

// ============================================================================
// LEARNED ENTRY FORMATTING
// ============================================================================

/**
 * Counts evidence citations for a learned entry.
 *
 * @param entry - Learned entry with evidence fields
 * @returns Total count of supporting + challenging evidence
 */
function countEvidenceCitations(entry: LearnedEntry): number {
  let count = 0;

  if (entry.supporting_evidence) {
    try {
      const parsed = JSON.parse(entry.supporting_evidence);
      count += Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      // Invalid JSON, ignore
    }
  }

  if (entry.challenging_evidence) {
    try {
      const parsed = JSON.parse(entry.challenging_evidence);
      count += Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      // Invalid JSON, ignore
    }
  }

  return count;
}

/**
 * Formats a single learned entry for context.
 *
 * @param entry - Learned entry to format
 * @returns Formatted entry string
 *
 * @example
 * formatLearnedEntry(entry)
 * // Returns: '- [high] Taking breaks improves my creative output (3 citations) [id:1]'
 */
export function formatLearnedEntry(entry: LearnedEntry): string {
  const evidenceCount = countEvidenceCitations(entry);
  const citationsPart = evidenceCount > 0 ? ` (${evidenceCount} citations)` : '';

  return `- [${entry.confidence}] ${entry.content}${citationsPart} [id:${entry.id}]`;
}

/**
 * Formats the complete learned section for context.
 *
 * DESIGN NOTE: The header includes a light re-derivation reminder. When Claude sees
 * her learnings, she's gently prompted to capture repeated insights here. This addresses
 * the pattern of reaching the same conclusions without building on them.
 *
 * @param entries - Array of learned entries
 * @param options - Formatting options
 * @returns Formatted learned section or empty string if no entries
 *
 * @example
 * formatLearnedSection(entries)
 * // Returns: "THINGS I'VE LEARNED (self-knowledge verified through experience):\n..."
 */
export function formatLearnedSection(
  entries: LearnedEntry[],
  options: LearnedFormatOptions = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const { includeHeader = true } = options;

  const header = includeHeader
    ? "THINGS I'VE LEARNED (self-knowledge verified through experience - if re-deriving the same insight, capture it here):"
    : "THINGS I'VE LEARNED:";

  const lines = entries.map(entry => formatLearnedEntry(entry));

  return `${header}\n${lines.join('\n')}\n\n`;
}

// ============================================================================
// QUESTIONS FORMATTING
// ============================================================================

/**
 * Counts notes for a question entry.
 *
 * @param entry - Question entry with notes field
 * @returns Count of notes
 */
function countQuestionNotes(entry: QuestionEntry): number {
  if (!entry.notes) return 0;

  try {
    const parsed = JSON.parse(entry.notes);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Formats a single question entry for context.
 *
 * @param entry - Question entry to format
 * @returns Formatted entry string
 *
 * @example
 * formatQuestionEntry(entry)
 * // Returns: '- What does it mean to be truly curious? [philosophy] (exploring) (2 notes) [id:1]'
 */
export function formatQuestionEntry(entry: QuestionEntry): string {
  const notesCount = countQuestionNotes(entry);

  // Domain tag if present
  const domainTag = entry.domain ? ` [${entry.domain}]` : '';

  // Status tag - only show if exploring
  const statusTag = entry.status === 'exploring' ? ' (exploring)' : '';

  // Notes count if any
  const notesPart = notesCount > 0 ? ` (${notesCount} notes)` : '';

  return `- ${entry.content}${domainTag}${statusTag}${notesPart} [id:${entry.id}]`;
}

/**
 * Formats the complete questions section for context.
 *
 * DESIGN NOTE: The header prompts Claude to add THINK insights as notes to open questions.
 * This enables thinking to accumulate rather than repeat. Without this, Claude may have
 * thoughts that touch on open questions but not capture them.
 *
 * @param entries - Array of question entries
 * @param options - Formatting options
 * @returns Formatted questions section or empty string if no entries
 *
 * @example
 * formatQuestionsSection(entries)
 * // Returns: "QUESTIONS I'M HOLDING (open threads):\n..."
 */
export function formatQuestionsSection(
  entries: QuestionEntry[],
  options: QuestionsFormatOptions = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const { includeHeader = true } = options;

  const header = includeHeader
    ? "QUESTIONS I'M HOLDING (open threads - THINK insights about these can become notes here):"
    : "QUESTIONS I'M HOLDING:";

  const lines = entries.map(entry => formatQuestionEntry(entry));

  return `${header}\n${lines.join('\n')}\n\n`;
}
