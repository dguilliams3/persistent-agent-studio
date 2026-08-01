/**
 * History Entry Formatters for Context
 *
 * @module @persistence/memory/context/formatters/history
 * @description Formats history entries for inclusion in Claude's system prompt.
 *
 * ENTRY FORMAT IN CONTEXT:
 * ```
 * [3:45 PM] USER: "Hello, how are you?"
 * [3:46 PM] MESSAGED USER: "I'm doing well! Thinking about..."
 * [3:47 PM] THOUGHT: The conversation with the user is going nicely...
 * ```
 *
 * KEY BEHAVIORS:
 * - Timestamps in Eastern Time
 * - Type-specific formatting (USER:, THOUGHT:, etc.)
 * - Base64 images replaced with "[image]" placeholder
 * - Images collected into separate arrays for vision API
 * - Only recent images get actual data (older ones just noted)
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatHistorySection for Block 4
 * @downstream Calls:
 *   - formatters/types.ts - Icon mappings
 */

import type { HistoryEntry } from '../../types';
import type { UserImage, ClaudeArtImage } from '../types';
import type { HistoryFormatOptions, HistoryFormatResult } from './types';
import { getTypeIcon } from './types';

import { parseDbTimestamp } from '@persistence/db';
// ============================================================================
// TIMESTAMP FORMATTING
// ============================================================================

/**
 * Formats a timestamp for context display (e.g., "3:45 PM").
 *
 * @param date - Date to format
 * @param timezone - Timezone for display (default: America/New_York)
 * @returns Formatted time string
 */
export function formatTimeForContext(
  date: Date,
  timezone: string = 'America/New_York'
): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

/**
 * Formats a date-time for context display (e.g., "Jan 15, 3:45 PM").
 *
 * @param date - Date to format
 * @param timezone - Timezone for display (default: America/New_York)
 * @returns Formatted date-time string
 */
export function formatDateTimeForContext(
  date: Date,
  timezone: string = 'America/New_York'
): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

// ============================================================================
// SINGLE ENTRY FORMATTING
// ============================================================================

/**
 * Checks if content is a base64 image.
 *
 * @param content - Content to check
 * @returns True if content starts with data:image
 */
function isBase64Image(content: string | null | undefined): boolean {
  return !!content && content.startsWith('data:image');
}

/**
 * Extracts a visitor sender name from history metadata (object, JSON string,
 * or null). Defensive by design: malformed metadata must NEVER break context
 * assembly — any parse failure returns null and the entry renders as USER.
 */
export function parseSenderFrom(metadata: unknown): string | null {
  if (!metadata) return null;
  let parsed: unknown = metadata;
  if (typeof metadata === 'string') {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const from = (parsed as Record<string, unknown>).from;
  if (typeof from !== 'string') return null;
  const trimmed = from.trim();
  return trimmed || null;
}

/**
 * Formats a single history entry for context display.
 *
 * This is the core formatting function that handles all entry types.
 * Images are detected and handled specially (not embedded as base64).
 *
 * @param entry - History entry to format
 * @param userImages - Array to push the user's images into
 * @param claudeArtImages - Array to push Claude's art into
 * @param collectImages - Whether to collect actual image data
 * @param timezone - Timezone for timestamps
 * @returns Formatted entry string
 *
 * @example
 * formatHistoryEntry(entry, [], [], true, 'America/New_York')
 * // Returns: "[3:45 PM] USER: \"Hello!\""
 */
export function formatHistoryEntry(
  entry: HistoryEntry,
  userImages: UserImage[],
  claudeArtImages: ClaudeArtImage[],
  collectImages: boolean = true,
  timezone: string = 'America/New_York'
): string {
  const timeStr = formatTimeForContext(parseDbTimestamp(entry.created_at), timezone);

  // Content-based detection: catch ANY base64 image regardless of type
  // This prevents new image types from dumping 260K chars into context
  const contentIsImage = isBase64Image(entry.content);

  switch (entry.type) {
    case 'user_message': {
      const hasImage = entry.internal && entry.internal.startsWith('data:image');
      if (hasImage && collectImages) {
        userImages.push({ time: timeStr, image: entry.internal!, text: entry.content });
      }
      const senderName = parseSenderFrom(entry.metadata);
      const label = senderName ? `FROM ${senderName.toUpperCase()}` : 'USER';
      // For prefix (cached) images, show they existed but don't include actual data
      return `[${timeStr}] ${label}: "${entry.content}"${hasImage ? (collectImages ? ' [sent an image - see below]' : ' [sent an image]') : ''}`;
    }

    case 'message_to_user':
      return `[${timeStr}] MESSAGED USER: "${entry.content}"`;

    case 'thought':
      return `[${timeStr}] THOUGHT: ${entry.content}`;

    case 'curiosity':
      return `[${timeStr}] WONDERED: ${entry.content}`;

    case 'remember':
      return `[${timeStr}] TO FOLLOW UP: ${entry.content}`;

    case 'cold_storage':
      return `[${timeStr}] FROZE TO COLD STORAGE: ${entry.content}`;

    case 'search_query':
      return `[${timeStr}] I SEARCHED FOR: ${entry.content}`;

    case 'search_result':
      return `[${timeStr}] SEARCH RESULTS:\n${entry.content}`;

    case 'art_request':
      return `[${timeStr}] I MADE ART: "${entry.content}"`;

    case 'art_result': {
      const isActualImage = entry.content && entry.content.startsWith('data:image');
      if (isActualImage && collectImages) {
        const artPrompt = entry.internal?.replace(/^Generated:\s*/, '') || 'untitled';
        claudeArtImages.push({ time: timeStr, image: entry.content, prompt: artPrompt });
      }
      // For prefix (cached) images, note they existed but don't reference seeing them
      return `[${timeStr}] ART CREATED: [image${isActualImage && collectImages ? ' - see MY ART section below' : ''}]`;
    }

    case 'user_art': {
      // User's UI-generated art (via /save-art endpoint)
      const isUserArtImage = entry.content && entry.content.startsWith('data:image');
      if (isUserArtImage && collectImages) {
        const userArtPrompt = entry.internal?.replace(/^User's prompt:\s*/, '') || 'untitled';
        userImages.push({ time: timeStr, image: entry.content, text: `User's art: ${userArtPrompt}` });
      }
      return `[${timeStr}] USER MADE ART: "${entry.internal?.replace(/^User's prompt:\s*/, '') || 'untitled'}"${isUserArtImage && collectImages ? ' [see USER\'S IMAGES section]' : ''}`;
    }

    case 'art_shared':
      return `[${timeStr}] SHARED ART WITH USER: "${entry.content}"`;

    case 'user_video': {
      // Video converted to GIF via Modal — can be data:image or r2:// reference
      const hasVideoGif = entry.internal && (entry.internal.startsWith('data:image') || entry.internal.startsWith('r2://'));
      if (hasVideoGif && collectImages) {
        userImages.push({ time: timeStr, image: entry.internal!, text: entry.content || 'Video from user' });
      }
      return `[${timeStr}] USER SENT VIDEO: "${entry.content || 'video'}"${hasVideoGif && collectImages ? ' [see USER\'S IMAGES section]' : ''}`;
    }

    case 'note_saved':
      return `[${timeStr}] SAVED TO NOTEBOOK: "${entry.content}" - ${entry.internal || ''}`;

    case 'note_retrieved':
      return `[${timeStr}] RETRIEVED NOTE: "${entry.content}"\n---\n${entry.internal || '(empty)'}\n---`;

    case 'observation_saved':
      return `[${timeStr}] SAVED OBSERVATION: "${entry.content}" - ${entry.internal || ''}`;

    case 'observation_retrieved':
      return `[${timeStr}] RETRIEVED OBSERVATION: "${entry.content}"\n---\n${entry.internal || '(empty)'}\n---`;

    case 'exist':
      return `[${timeStr}] JUST EXISTING: ${entry.internal || '(quietly)'}`;

    default:
      // Catch-all for unknown types - use content-based detection for safety
      if (contentIsImage) {
        // Unknown image type - show prompt from internal, not base64 from content
        return `[${timeStr}] ${entry.type.toUpperCase()}: [image] "${entry.internal || 'unknown prompt'}"`;
      }
      return `[${timeStr}] ${entry.type}: ${entry.content}`;
  }
}

// ============================================================================
// BATCH FORMATTING
// ============================================================================

/**
 * Formats an array of history entries for context.
 *
 * Only collects actual image data from recent entries (controlled by
 * recentImageThreshold) to save tokens while preserving conversational context.
 *
 * @param entries - Array of history entries
 * @param options - Formatting options
 * @returns Formatted result with text and image arrays
 *
 * @example
 * const result = formatHistorySection(entries, { recentImageThreshold: 10 });
 * console.log(result.text);  // Formatted history text
 * console.log(result.userImages);  // User's recent images
 */
export function formatHistorySection(
  entries: HistoryEntry[],
  options: HistoryFormatOptions = {}
): HistoryFormatResult {
  const {
    collectImages = true,
    recentImageThreshold = 10,
    timezone = 'America/New_York'
  } = options;

  const userImages: UserImage[] = [];
  const claudeArtImages: ClaudeArtImage[] = [];

  // Determine threshold for collecting images
  const imageCollectionStart = Math.max(0, entries.length - recentImageThreshold);

  // Format each entry
  const lines = entries.map((entry, index) => {
    // Only collect images from recent entries
    const shouldCollect = collectImages && index >= imageCollectionStart;
    return formatHistoryEntry(entry, userImages, claudeArtImages, shouldCollect, timezone);
  });

  const text = lines.join('\n');

  return {
    text,
    userImages,
    claudeArtImages,
    entryCount: entries.length,
    tokenEstimate: Math.ceil(text.length / 4)
  };
}

/**
 * Formats history section with header and markers.
 *
 * Produces a complete section suitable for Block 4:
 * ```
 * FULL HISTORY (15 entries, oldest to newest):
 * [3:45 PM] USER: "Hello"
 * [3:46 PM] THOUGHT: Interesting...
 * --- END OF HISTORY ---
 * ```
 *
 * @param entries - Array of history entries
 * @param options - Formatting options
 * @returns Formatted result with section text and images
 */
export function formatHistorySectionWithHeader(
  entries: HistoryEntry[],
  options: HistoryFormatOptions = {}
): HistoryFormatResult {
  if (entries.length === 0) {
    return {
      text: '',
      userImages: [],
      claudeArtImages: [],
      entryCount: 0,
      tokenEstimate: 0
    };
  }

  const result = formatHistorySection(entries, options);

  const header = `FULL HISTORY (${entries.length} entries, oldest to newest):`;
  const footer = '--- END OF HISTORY ---';

  const fullText = `${header}\n${result.text}\n${footer}`;

  return {
    ...result,
    text: fullText,
    tokenEstimate: Math.ceil(fullText.length / 4)
  };
}
