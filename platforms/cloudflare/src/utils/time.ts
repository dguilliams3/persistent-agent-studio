/**
 * Time utility functions for Eastern timezone formatting
 * Extracted from index.js for better modularity
 */

/**
 * @description Converts a date to Eastern timezone
 *
 * This is useful for consistent timestamp display regardless of where
 * the Cloudflare Worker is executing (edge locations worldwide).
 *
 * @param {Date} [date=new Date()] - The date to convert, defaults to current date/time
 * @returns {Date} A new Date object representing the time in Eastern timezone
 * @example
 * const easternNow = toEastern();
 * const easternSpecific = toEastern(new Date('2025-01-15T12:00:00Z'));
 */
export function toEastern(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * @description Formats a date as a time string in Eastern timezone (e.g., "3:45 PM")
 * @param {Date} [date=new Date()] - The date to format, defaults to current date/time
 * @returns {string} Formatted time string with hour, minute, and AM/PM
 * @example
 * formatEasternTime() // "3:45 PM"
 * formatEasternTime(new Date('2025-01-15T18:30:00Z')) // "1:30 PM"
 */
export function formatEasternTime(date = new Date()) {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * @description Formats a date as a date-time string in Eastern timezone (e.g., "Jan 15, 3:45 PM")
 * @param {Date} [date=new Date()] - The date to format, defaults to current date/time
 * @returns {string} Formatted date-time string with month, day, hour, minute, and AM/PM
 * @example
 * formatEasternDateTime() // "Jan 15, 3:45 PM"
 * formatEasternDateTime(new Date('2025-06-20T18:30:00Z')) // "Jun 20, 2:30 PM"
 */
export function formatEasternDateTime(date = new Date()) {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * @description Formats a timestamp as relative time (e.g., "2h ago", "3d ago", "Jan 5")
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Human-readable relative time
 */
export function formatRelativeTime(timestamp: string | Date): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? new Date(timestamp + 'Z') : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  // For older entries, show the date
  return date.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
}

/**
 * @description Starts a timing measurement for calculating elapsed time
 *
 * Used for response time tracking in Telegram commands and other operations.
 * Returns an object with a method to get elapsed time.
 *
 * @upstream Called by: Telegram command handlers, think cycle
 * @downstream Calls: Date.now()
 *
 * @returns {{ elapsed: () => string }} Object with elapsed() method returning formatted duration
 *
 * @example
 * const timer = startTimer();
 * // ... do some work ...
 * console.log(`Took ${timer.elapsed()}`); // "Took 1.5s"
 */
export function startTimer() {
  const start = Date.now();
  return {
    /**
     * @description Returns elapsed time as formatted string (e.g., "1.5s")
     * @returns {string} Formatted elapsed time
     */
    elapsed: () => {
      const ms = Date.now() - start;
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    },
    /**
     * @description Returns elapsed time in milliseconds
     * @returns {number} Elapsed time in milliseconds
     */
    elapsedMs: () => Date.now() - start
  };
}

/**
 * @description Format context statistics for display
 *
 * Creates a standardized context stats message showing system prompt and data counts.
 * Used by /context and /export commands to display the same information consistently.
 *
 * @upstream Called by: /context command, /export command
 * @downstream Calls: None (pure formatting)
 *
 * @param {Object} contextResult - Result from buildSystemPrompt()
 * @param {string} contextResult.systemPrompt - Full system prompt text
 * @param {number} contextResult.historyCount - Number of history entries
 * @param {number} contextResult.summariesCount - Number of summaries
 * @param {number} contextResult.coldStorageCount - Number of cold storage entries
 * @param {number} contextResult.notebookCount - Number of notebook entries
 * @param {number} contextResult.remindersCount - Number of active reminders
 * @param {Array} contextResult.userImages - Array of the user's images
 * @returns {string} Formatted stats message for Telegram
 *
 * @example
 * const result = await buildSystemPrompt(db);
 * const stats = formatContextStats(result);
 * // Returns: "📊 <b>Context Stats</b>\n• Characters: 45,231\n• History entries: 15\n..."
 */
export function formatContextStats(contextResult: { systemPrompt: string; historyCount: number; summariesCount: number; coldStorageCount: number; notebookCount: number; remindersCount: number; userImages: unknown[] }): string {
  return `📊 <b>Context Stats</b>
• Characters: ${contextResult.systemPrompt.length.toLocaleString()}
• History entries: ${contextResult.historyCount}
• Summaries: ${contextResult.summariesCount}
• Cold storage: ${contextResult.coldStorageCount}
• Notebook notes: ${contextResult.notebookCount}
• Reminders: ${contextResult.remindersCount}
• User's images: ${contextResult.userImages.length}`;
}

/**
 * @description Validates entries array before summarization operations
 *
 * DRY utility for summarization functions. Returns either { valid: true, entries }
 * or { valid: false, error: string } to allow callers to handle gracefully.
 *
 * Replaces duplicate defensive checks in summarizeHistory() and batchSummarizeHistory().
 *
 * @upstream Called by: summarizeHistory(), batchSummarizeHistory()
 * @downstream Calls: None (pure validation)
 *
 * @param {Array<Object>} entries - Array of entries to validate
 * @param {string} [context='summarization'] - Context string for error messages
 * @returns {{ valid: boolean, entries?: Array, error?: string }}
 *
 * @example
 * const result = validateEntriesForSummarization(toSummarize, 'batch summarize');
 * if (!result.valid) return { error: result.error };
 */
export function validateEntriesForSummarization(entries: unknown[], context = 'summarization'): { valid: boolean; entries?: unknown[]; error?: string } {
  if (!entries || !Array.isArray(entries)) {
    return { valid: false, error: `Invalid entries array for ${context}` };
  }

  if (entries.length === 0) {
    return { valid: false, error: `No entries to process for ${context}` };
  }

  if (!entries[0]) {
    return { valid: false, error: `First entry is null/undefined for ${context}` };
  }

  return { valid: true, entries };
}

// NOTE: formatSummaryForContext moved to @persistence/memory (2026-01-28)