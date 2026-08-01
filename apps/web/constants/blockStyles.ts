/**
 * Block Styles Configuration
 *
 * @module constants/blockStyles
 * @description Single source of truth for cache block colors used in:
 * - ContextBar (bar visualization)
 * - MemoryTab tier sections
 *
 * Color scheme rationale:
 * - System: Icy cyan (frozen foundation)
 * - Promoted: Blue (user-pinned, stable)
 * - Stable: Bright green (auto-cached)
 * - Fresh: Rose gold (uncached, new)
 * - Archive: Emerald (retrievable, alive)
 *
 * @upstream Called by: None (root config)
 * @downstream Calls: None (pure data)
 * @tests constants/__tests__/blockStyles.test.js
 */

export const BLOCK_STYLES = {
  system: {
    key: 'block1_system',
    label: 'System',
    gradient: 'from-cyan-400/80 to-cyan-500/80',
    glow: 'rgba(34, 211, 238, 0.3)',
    border: 'border-l-cyan-400',
    bg: 'bg-cyan-400/10',
    text: 'text-cyan-400',
    textLight: 'text-cyan-300',
    tooltip: 'Constitution + Cold Storage + MY SPACE',
  },
  promoted: {
    key: 'block2_stable',
    label: 'Promoted',
    gradient: 'from-blue-500/80 to-blue-600/80',
    glow: 'rgba(59, 130, 246, 0.3)',
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    textLight: 'text-blue-300',
    tooltip: 'Promoted summaries (Block 2)',
  },
  stable: {
    key: 'block3_summariesPrefix',
    label: 'Stable',
    gradient: 'from-green-400/80 to-green-500/80',
    glow: 'rgba(74, 222, 128, 0.3)',
    border: 'border-l-green-400',
    bg: 'bg-green-400/10',
    text: 'text-green-400',
    textLight: 'text-green-300',
    tooltip: 'Learned + Questions + Notebook + Observations + Cached Summaries',
  },
  fresh: {
    key: 'block4_fresh',
    label: 'Fresh',
    gradient: 'from-rose-400/80 to-rose-500/80',
    glow: 'rgba(251, 113, 133, 0.3)',
    border: 'border-l-rose-400',
    bg: 'bg-rose-400/10',
    text: 'text-rose-400',
    textLight: 'text-rose-300',
    tooltip: 'Dynamic tail + History (never cached)',
    uncached: true,
  },
  archive: {
    key: 'ragArchive',
    label: 'RAG',
    gradient: 'from-emerald-400/80 to-emerald-500/80',
    glow: 'rgba(52, 211, 153, 0.3)',
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    textLight: 'text-emerald-300',
    tooltip: 'Searchable via semantic similarity (RAG)',
  },
};

/**
 * Get bar-compatible BLOCKS array for ContextBar
 * @returns {Array} Array of block styles for the 5 main segments (includes RAG)
 */
export const getBarBlocks = () => [
  BLOCK_STYLES.system,
  BLOCK_STYLES.promoted,
  BLOCK_STYLES.stable,
  BLOCK_STYLES.fresh,
  BLOCK_STYLES.archive,
];
