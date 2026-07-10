/**
 * Shared History Display Utilities
 *
 * @module ui/historyUtils
 * @description Shared constants and utilities for displaying history entries.
 * Used by ChatTab, AxisBuilderView, and other history displays.
 *
 * @upstream Called by:
 *   - tabs/ChatTab/index.jsx
 *   - tabs/SemanticMonitorTab/views/AxisBuilderView.jsx
 */

// =============================================================================
// ICON MAPPING
// =============================================================================

/**
 * @description Icon mapping for history entry types (Lucide icon names)
 */
export const TYPE_ICONS: Record<string, string> = {
  thought: 'Brain',
  curiosity: 'HelpCircle',
  remember: 'Pin',
  message_to_user: 'MessageCircle',
  user_message: 'User',
  art_request: 'Sparkles',
  art_result: 'Image',
  user_art: 'Palette',
  user_video: 'Film',
  search_query: 'Search',
  search_result: 'Globe',
  cold_storage: 'Snowflake',
  note_saved: 'StickyNote',
  exist: 'Sparkles',
  sleep: 'Moon',
  status_update: 'Activity',
  summarize: 'Package',
  user_status_update: 'UserCog',
  learned_add: 'BookOpen',
  learned_update: 'BookOpen',
  learned_cite: 'Quote',
  learned_promote: 'TrendingUp',
  learned_delete: 'Trash2',
  learned_list: 'List',
  question_add: 'HelpCircle',
  question_note: 'MessageSquare',
  question_resolve: 'CheckCircle',
  question_dissolve: 'XCircle',
  question_list: 'List',
  reminder_set: 'Bell',
  reminder_dismiss: 'BellOff',
  parse_error: 'AlertTriangle',
  action_error: 'AlertOctagon',
};

// =============================================================================
// COLOR MAPPING
// =============================================================================

/**
 * @description Tailwind color classes for history entry types
 */
export const TYPE_COLORS: Record<string, string> = {
  thought: 'text-purple-400',
  curiosity: 'text-cyan-400',
  remember: 'text-yellow-400',
  message_to_user: 'text-blue-400',
  user_message: 'text-emerald-400',
  art_request: 'text-pink-400',
  art_result: 'text-pink-400',
  user_art: 'text-orange-400',
  user_video: 'text-rose-400',
  search_query: 'text-indigo-400',
  search_result: 'text-indigo-300',
  cold_storage: 'text-cyan-300',
  note_saved: 'text-amber-400',
  exist: 'text-gray-400',
  sleep: 'text-indigo-300',
  status_update: 'text-teal-400',
  summarize: 'text-orange-300',
  user_status_update: 'text-emerald-300',
  learned_add: 'text-green-400',
  learned_update: 'text-green-300',
  learned_cite: 'text-green-300',
  learned_promote: 'text-green-500',
  learned_delete: 'text-red-400',
  learned_list: 'text-green-300',
  question_add: 'text-violet-400',
  question_note: 'text-violet-300',
  question_resolve: 'text-emerald-400',
  question_dissolve: 'text-gray-400',
  question_list: 'text-violet-300',
  reminder_set: 'text-amber-400',
  reminder_dismiss: 'text-gray-400',
  parse_error: 'text-red-400',
  action_error: 'text-red-500',
};

// =============================================================================
// BORDER COLOR MAPPING (for timeline visual distinction)
// =============================================================================

/**
 * @description Border-left colors for history entry types in timeline
 * Grouped by semantic category for visual cohesion:
 * - Blue: Outbound messages
 * - Green: Inbound from the user
 * - Purple: Internal thoughts
 * - Cyan: Curiosity and questions
 * - Amber: Memory and notes
 * - Pink: Creative (art)
 * - Indigo: Search
 * - Teal: Status updates
 * - Red: Errors
 */
export const TYPE_BORDER_COLORS: Record<string, string> = {
  // Outbound communication - blue
  message_to_user: 'border-l-blue-400/50',
  // Inbound from the user - green
  user_message: 'border-l-emerald-400/50',
  // Internal thoughts - purple
  thought: 'border-l-purple-400/50',
  remember: 'border-l-purple-300/50',
  // Curiosity and questions - cyan
  curiosity: 'border-l-cyan-400/50',
  question_add: 'border-l-cyan-400/50',
  question_note: 'border-l-cyan-300/50',
  question_resolve: 'border-l-emerald-400/50',
  question_dissolve: 'border-l-gray-400/50',
  question_list: 'border-l-cyan-300/50',
  // Memory and storage - amber
  cold_storage: 'border-l-amber-400/50',
  note_saved: 'border-l-amber-300/50',
  // Learning - green
  learned_add: 'border-l-green-400/50',
  learned_update: 'border-l-green-300/50',
  learned_cite: 'border-l-green-300/50',
  learned_promote: 'border-l-green-500/50',
  learned_delete: 'border-l-red-400/50',
  learned_list: 'border-l-green-300/50',
  // Creative - pink
  art_request: 'border-l-pink-400/50',
  art_result: 'border-l-pink-400/50',
  user_art: 'border-l-orange-400/50',
  user_video: 'border-l-rose-400/50',
  // Search - indigo
  search_query: 'border-l-indigo-400/50',
  search_result: 'border-l-indigo-300/50',
  // Status - teal
  status_update: 'border-l-teal-400/50',
  user_status_update: 'border-l-teal-300/50',
  // Reminders - amber
  reminder_set: 'border-l-amber-400/50',
  reminder_dismiss: 'border-l-gray-400/50',
  // Errors - red
  parse_error: 'border-l-red-400/70',
  action_error: 'border-l-red-500/70',
  // Default
  exist: 'border-l-gray-400/30',
  sleep: 'border-l-indigo-300/30',
  summarize: 'border-l-orange-300/50',
};

// =============================================================================
// LABEL MAPPING
// =============================================================================

/**
 * @description Human-readable labels for entry types
 */
export const TYPE_LABELS: Record<string, string> = {
  thought: 'Thought',
  curiosity: 'Wonder',
  remember: 'Remember',
  message_to_user: 'To User',
  user_message: 'From User',
  art_request: 'Art Request',
  art_result: 'Art Created',
  user_art: 'User Art',
  user_video: 'User Video',
  search_query: 'Search',
  search_result: 'Search Result',
  cold_storage: 'Memory Stored',
  note_saved: 'Note Saved',
  exist: 'Exist',
  sleep: 'Sleep',
  status_update: 'Status',
  summarize: 'Summarize',
  user_status_update: 'User Status',
  learned_add: 'Learned',
  learned_update: 'Updated Learning',
  learned_cite: 'Cited',
  learned_promote: 'Promoted',
  learned_delete: 'Removed Learning',
  learned_list: 'Listed Learnings',
  question_add: 'New Question',
  question_note: 'Question Note',
  question_resolve: 'Question Resolved',
  question_dissolve: 'Question Dissolved',
  question_list: 'Listed Questions',
  reminder_set: 'Reminder Set',
  reminder_dismiss: 'Reminder Done',
  parse_error: 'Parse Error',
  action_error: 'Action Error',
};

// =============================================================================
// FILTER OPTIONS
// =============================================================================

/**
 * @description Filter categories for history display
 */
export const FILTER_OPTIONS = [
  { value: 'all', label: 'All', icon: 'List' },
  { value: 'messages', label: 'Messages', icon: 'MessageCircle', types: ['user_message', 'message_to_user'] },
  { value: 'thoughts', label: 'Thoughts', icon: 'Brain', types: ['thought', 'curiosity', 'remember'] },
  { value: 'art', label: 'Art', icon: 'Image', types: ['art_request', 'art_result', 'user_art', 'user_video'] },
  { value: 'search', label: 'Search', icon: 'Search', types: ['search_query', 'search_result'] },
  { value: 'knowledge', label: 'Knowledge', icon: 'BookOpen', types: [
    'learned_add', 'learned_update', 'learned_cite', 'learned_promote', 'learned_delete', 'learned_list',
    'question_add', 'question_note', 'question_resolve', 'question_dissolve', 'question_list',
    'reminder_set', 'reminder_dismiss'
  ] },
  { value: 'errors', label: 'Errors', icon: 'AlertTriangle', types: ['parse_error', 'action_error'] },
  { value: 'other', label: 'Other', icon: 'MoreHorizontal', types: ['cold_storage', 'exist', 'sleep', 'note_saved', 'status_update', 'summarize', 'user_status_update'] },
];

/**
 * @description Entry types that have meaningful text content (for axis building)
 */
export const SELECTABLE_TYPES = [
  'thought',
  'message_to_user',
  'user_message',
  'exist',
  'curiosity',
  'search_result',
  'note_saved',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * @description Format timestamp for display (Eastern Time)
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time (e.g., "2:34 PM" or "Jan 15, 2:34 PM")
 */
export function formatTime(timestamp: any) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  return `${dateStr}, ${timeStr}`;
}

/**
 * @description Truncate content for preview, handling base64 images
 * @param {string} content - Full content string
 * @param {number} [maxLen=120] - Maximum length
 * @returns {string} Truncated content
 */
export function truncateContent(content: any, maxLen = 120) {
  if (!content) return '';
  // Handle base64 images and R2 URLs
  if (content.startsWith('data:image') || content.startsWith('https://')) return '[Image]';
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen).trim() + '...';
}

/**
 * @description Filter history entries by category
 * @param {Array} entries - History entries to filter
 * @param {string} filter - Filter category value
 * @param {Array} [voiceHistory] - Voice history for voiceOnly matching
 * @returns {Array} Filtered entries
 */
export function filterHistoryByType(entries: any, filter: any, voiceHistory: any[] = []) {
  if (filter === 'all') return entries;
  const option: any = FILTER_OPTIONS.find((opt) => opt.value === filter);
  if (!option?.types) return entries;

  let filtered = entries.filter((entry: any) => option.types.includes(entry.type));

  // Special handling for voice filter
  if (option.voiceOnly && voiceHistory.length > 0) {
    filtered = filtered.filter((entry: any) =>
      voiceHistory.some((v: any) => {
        if (!v.created_at || !entry.created_at) return false;
        const vTime = new Date(v.created_at).getTime();
        const hTime = new Date(entry.created_at).getTime();
        const timeDiff = Math.abs(vTime - hTime);
        return timeDiff < 60000 && entry.content?.includes(v.text?.slice(0, 50));
      })
    );
  }

  return filtered;
}

/**
 * @description Get display text for a history entry (prefers content over internal for most types)
 * @param {Object} entry - History entry
 * @returns {string} Text to display
 */
export function getEntryDisplayText(entry: any) {
  if (!entry) return '';

  // For exist/note_saved, internal is the meaningful content
  if (entry.type === 'exist' || entry.type === 'note_saved') {
    return entry.internal || entry.content || '';
  }

  // For most types, content is primary
  return entry.content || entry.internal || '';
}
