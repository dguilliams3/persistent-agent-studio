/**
 * Formatter Types for Context Assembly
 *
 * @module @persistence/memory/context/formatters/types
 * @description Type definitions and constants for formatting context sections.
 *
 * The formatters transform raw database records into text suitable for
 * Claude's system prompt. Key responsibilities:
 *
 * 1. **Type-based formatting** - Different entry types get different icons
 * 2. **Timestamp formatting** - Eastern timezone for all user-facing times
 * 3. **Image handling** - Base64 images are noted but not embedded in text
 * 4. **Section structure** - Headers, separators, and consistent formatting
 *
 * @upstream Used by:
 *   - formatters/history.ts
 *   - formatters/notebook.ts
 *   - formatters/summaries.ts
 *   - etc.
 * @downstream Calls:
 *   - No dependencies (pure type definitions)
 */

import type { HistoryEntry } from '../../types';
import type { FormatOptions } from '../types';

// Re-export for convenience
export type { FormatOptions };

// ============================================================================
// HISTORY TYPE ICONS
// ============================================================================

/**
 * Emoji icons for history entry types in context display.
 *
 * These icons appear in the formatted history section to help Claude
 * quickly identify the type of each entry. They differ slightly from
 * the summarization icons (which use [ID:N] markers for tracking).
 *
 * NOTE: This is for CONTEXT DISPLAY. For summarization prompts,
 * see @persistence/memory/summarization/formatter/types.ts
 */
export const CONTEXT_TYPE_ICONS: Record<string, string> = {
  // Claude's internal states
  thought: '💭',
  curiosity: '🔍',
  exist: '😌',
  state_update: '🔄',
  remember: '📝',

  // Communication
  message_to_user: '📤',
  user_message: '👤',

  // Creative
  art_request: '🎨',
  art_result: '🖼️',
  user_art: '🎨',
  art_shared: '🖼️',
  user_video: '🎬',

  // Search
  search_query: '🔎',
  search_result: '📰',

  // Memory operations
  cold_storage: '🧊',
  note_saved: '📓',
  note_retrieved: '📖',
  observation_saved: '👁️',
  observation_retrieved: '👁️',

  // System
  meter_override: '⚡',
  voice_sent: '🎤',

  // Fallback
  default: '•'
};

/**
 * Get the icon for a history entry type.
 *
 * @param type - The history entry type
 * @returns The emoji icon for display
 */
export function getTypeIcon(type: string): string {
  return CONTEXT_TYPE_ICONS[type] || CONTEXT_TYPE_ICONS.default;
}

// ============================================================================
// HISTORY FORMATTING
// ============================================================================

/**
 * Options for formatting history entries for context.
 */
export interface HistoryFormatOptions extends FormatOptions {
  /**
   * Whether to collect images into separate arrays.
   * Images in the text section get a placeholder; actual image data
   * goes into userImages/claudeArtImages arrays.
   * Default: true
   */
  collectImages?: boolean;

  /**
   * Only collect images from entries within this threshold of the end.
   * Older images get "[sent an image]" placeholder without actual data.
   * Default: 10 (last 10 entries get actual image data)
   */
  recentImageThreshold?: number;
}

/**
 * Result of formatting history entries.
 */
export interface HistoryFormatResult {
  /** Formatted text for all history entries */
  text: string;

  /** Images from the user (for vision API) */
  userImages: Array<{ time: string; image: string; text: string }>;

  /** Art created by Claude (for vision API) */
  claudeArtImages: Array<{ time: string; image: string; prompt: string }>;

  /** Number of entries formatted */
  entryCount: number;

  /** Estimated token count */
  tokenEstimate: number;
}

// ============================================================================
// SUMMARY FORMATTING
// ============================================================================

/**
 * Options for formatting summaries for context.
 */
export interface SummaryFormatOptions extends FormatOptions {
  /** Include tier information in the header (default false) */
  includeTier?: boolean;

  /** 1-based starting index for numbering (default 1) */
  startIndex?: number;
}

// ============================================================================
// REMINDER FORMATTING
// ============================================================================

/**
 * Options for formatting reminders for context.
 */
export interface ReminderFormatOptions extends FormatOptions {
  /** IDs of reminders that are currently due */
  dueReminderIds?: number[];
}

// ============================================================================
// LEARNED/QUESTIONS FORMATTING
// ============================================================================

/**
 * Options for formatting learned entries for context.
 */
export interface LearnedFormatOptions extends FormatOptions {
  /** Include the header text explaining what learned entries are */
  includeHeader?: boolean;
}

/**
 * Options for formatting questions for context.
 */
export interface QuestionsFormatOptions extends FormatOptions {
  /** Include the header text explaining what questions are */
  includeHeader?: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * A formatter function signature.
 */
export type SectionFormatter<TData, TOptions extends FormatOptions = FormatOptions> = (
  data: TData,
  options?: TOptions
) => string;
