/**
 * Memory Tab Constants
 *
 * @module components/tabs/MemoryTab/constants
 * @description Shared constants for metadata display, pill styling, and helper functions.
 *
 * @upstream Called by: SummaryItem, SummariesSection, NotebookSection, etc.
 * @downstream Calls: None (pure data)
 */

// =============================================================================
// METADATA DISPLAY CONSTANTS
// =============================================================================

/**
 * Style definitions for summary metadata pills.
 * Uses distinct colors from BLOCK_STYLES to avoid visual confusion.
 *
 * Full static class strings are required because Tailwind purges unused classes
 * at build time. Dynamic construction like `bg-${color}-500` won't work.
 */
export const METADATA_STYLES = {
  themes:     { label: 'Themes',    icon: '🎨' },
  entities:   { label: 'Entities',  icon: '👤' },
  tone:       { label: 'Tone',      icon: '🎭' },
  period:     { label: 'Period',    icon: '📅' },
  key_facts:  { label: 'Key Facts', icon: '💡' },
};

/**
 * Pre-defined Tailwind classes for pill badges.
 * These MUST be full static strings so Tailwind can find them during build.
 */
export const PILL_CLASSES = {
  fuchsia: {
    label: 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-400/30',
    value: 'bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-400/20',
  },
  sky: {
    label: 'bg-sky-500/20 text-sky-400 border border-sky-400/30',
    value: 'bg-sky-500/10 text-sky-300 border border-sky-400/20',
  },
  orange: {
    label: 'bg-orange-500/20 text-orange-400 border border-orange-400/30',
    value: 'bg-orange-500/10 text-orange-300 border border-orange-400/20',
  },
  teal: {
    label: 'bg-teal-500/20 text-teal-400 border border-teal-400/30',
    value: 'bg-teal-500/10 text-teal-300 border border-teal-400/20',
  },
  pink: {
    label: 'bg-pink-500/20 text-pink-400 border border-pink-400/30',
    value: 'bg-pink-500/10 text-pink-300 border border-pink-400/20',
  },
};

/**
 * Mapping from metadata field to its color scheme.
 */
export const METADATA_COLORS = {
  themes: 'fuchsia',
  entities: 'sky',
  tone: 'orange',
  period: 'teal',
  key_facts: 'pink',
};

export const DEFAULT_CONTEXT_SIZE = 10;
export const DEFAULT_BUFFER_SIZE = 15;
export const DEFAULT_TAIL_THRESHOLD = 8000;
export const DEFAULT_TAIL_TARGET = 4000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * @description Estimate tokens from text (rough: ~4 chars per token for English)
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * @description Safely parse a JSON array string, returning array of strings.
 * Used for evidence arrays and notes arrays stored as JSON in the database.
 */
export function parseJsonArray(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [str];
  } catch {
    // If not valid JSON, return as single item (backward compatibility)
    return [str];
  }
}

/**
 * @description Safely parse metadata - handles both object and JSON string formats.
 *
 * The backend stores metadata as JSON in the database. Depending on how it's
 * fetched, it may come back as a parsed object or a raw JSON string.
 */
export function parseMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === 'object') return metadata as Record<string, unknown>;
  try {
    return JSON.parse(metadata as string);
  } catch {
    return null;
  }
}
