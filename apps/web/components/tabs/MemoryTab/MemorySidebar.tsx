/**
 * Memory Sidebar Component
 *
 * @module components/tabs/MemoryTab/MemorySidebar
 * @description Vertical navigation sidebar for memory sections with count badges.
 * Shows at-a-glance memory type counts and allows quick navigation.
 *
 * Neural Observatory Design:
 * - Active section has cyan accent + glow
 * - Count badges with semantic colors
 * - Hover effects with subtle lift
 *
 * @upstream Called by: MemoryTab/index.jsx
 * @downstream Calls: Icon (Lucide icons)
 *
 * @param {Object} props
 * @param {string} props.activeSection - Currently selected section ID
 * @param {Function} props.onSectionChange - Callback when section changes
 * @param {Object} props.counts - Count of items per section
 * @returns {React.ReactElement}
 *
 * @example
 * <MemorySidebar
 *   activeSection="summaries"
 *   onSectionChange={(id) => setActiveSection(id)}
 *   counts={{ summaries: 15, notebook: 5, coldStorage: 3 }}
 * />
 */

import {
  Layers,
  BookOpen,
  Snowflake,
  Bell,
  Eye,
  GraduationCap,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

/**
 * Cache block configuration
 * Block 1: Constitution + Cold Storage + MY SPACE + Profile Pic (always cached)
 * Block 3: Learned + Questions + Notebook + Observations + Summaries prefix (conditionally cached)
 * Block 4: Fresh tail including Reminders (never cached)
 */
const BLOCK_BADGES: Record<string | number, any> = {
  1: { label: 'B1', color: 'bg-cyan-500/30 text-cyan-300 border-cyan-400/40', title: 'Block 1: Always cached (stable)' },
  3: { label: 'B3', color: 'bg-amber-500/30 text-amber-300 border-amber-400/40', title: 'Block 3: Conditionally cached' },
  4: { label: 'B4', color: 'bg-rose-500/30 text-rose-300 border-rose-400/40', title: 'Block 4: Never cached (fresh)' },
};

/**
 * Section configuration with icons, labels, and cache block assignment
 */
const SECTIONS = [
  {
    id: 'summaries',
    label: 'Summaries',
    icon: Layers,
    countKey: 'summaries',
    color: 'text-amber-400',
    description: 'Compressed history (cached, tail, archived)',
    block: null, // Complex: prefix in B3, tail in B4, archived in RAG
  },
  {
    id: 'notebook',
    label: 'Notebook',
    icon: BookOpen,
    countKey: 'notebook',
    color: 'text-emerald-400',
    description: 'Saved notes and references',
    block: 3,
  },
  {
    id: 'coldStorage',
    label: 'Cold Storage',
    icon: Snowflake,
    countKey: 'coldStorage',
    color: 'text-cyan-400',
    description: 'Permanent frozen memories',
    block: 1,
  },
  {
    id: 'learned',
    label: 'Learned',
    icon: GraduationCap,
    countKey: 'learned',
    color: 'text-violet-400',
    description: 'Verified self-knowledge',
    block: 3,
  },
  {
    id: 'questions',
    label: 'Questions',
    icon: HelpCircle,
    countKey: 'questions',
    color: 'text-rose-400',
    description: 'Open questions being held',
    block: 3,
  },
  {
    id: 'observations',
    label: 'Observations',
    icon: Eye,
    countKey: 'observations',
    color: 'text-blue-400',
    description: 'Notes about the user',
    block: 3,
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: Bell,
    countKey: 'reminders',
    color: 'text-orange-400',
    description: 'Active reminders',
    block: 4,
  },
  {
    id: 'rag',
    label: 'RAG Archive',
    icon: Sparkles,
    countKey: 'rag',
    color: 'text-accent',
    description: 'Semantic retrieval from archived memories',
    block: null, // RAG is dynamically injected, not in a fixed cache block
  },
];

/**
 * Single sidebar item with block indicator
 */
function SidebarItem({ section, count, isActive, onClick }: any) {
  const Icon = section.icon;
  const hasItems = count > 0;
  const blockBadge = section.block ? BLOCK_BADGES[section.block] : null;

  return (
    <button
      onClick={() => onClick(section.id)}
      className={`
        w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left
        transition-all duration-200 group
        ${isActive
          ? 'bg-accent/10 border border-accent/30 glow-subtle'
          : 'bg-transparent border border-transparent hover:bg-depth hover:border-border-subtle'
        }
      `}
      title={section.description}
    >
      {/* Icon */}
      <Icon
        size={18}
        className={`
          transition-colors flex-shrink-0
          ${isActive ? 'text-accent' : `${section.color} group-hover:text-accent`}
        `}
      />

      {/* Label */}
      <span className={`
        flex-1 text-sm font-medium truncate
        ${isActive ? 'text-accent' : 'text-content-secondary group-hover:text-content-primary'}
      `}>
        {section.label}
      </span>

      {/* Block indicator badge */}
      {blockBadge && (
        <span
          className={`
            px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border flex-shrink-0
            ${blockBadge.color}
          `}
          title={blockBadge.title}
        >
          {blockBadge.label}
        </span>
      )}

      {/* Count badge */}
      {hasItems && (
        <span className={`
          px-2 py-0.5 rounded-full text-xs font-mono font-medium flex-shrink-0
          transition-colors
          ${isActive
            ? 'bg-accent/20 text-accent'
            : 'bg-surface text-content-muted group-hover:bg-accent/10 group-hover:text-accent'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  );
}


/**
 * Compact horizontal section strip — same SECTIONS config as the sidebar,
 * rendered as a horizontally-scrollable tab row. Used where the vertical
 * sidebar does not fit: panel mode (laptop SplitView, 280-400px) and
 * mobile full-screen (below md, where the sidebar is hidden).
 *
 * @upstream Called by: MemoryTab/index.tsx (isPanel mode + mobile fallback)
 * @downstream Calls: Lucide icons via SECTIONS config
 */
export function MemorySectionStrip({
  activeSection = 'summaries',
  onSectionChange,
  counts = {},
}: MemorySidebarProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0" role="tablist">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        const count = counts[section.countKey] || 0;
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            role="tab"
            aria-selected={isActive}
            title={section.description}
            className={`
              flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium
              whitespace-nowrap flex-shrink-0 min-h-[44px] transition-all duration-200
              ${isActive
                ? 'border text-accent'
                : 'bg-transparent border border-transparent text-content-secondary hover:bg-depth hover:border-border-subtle hover:text-content-primary'
              }
            `}
            style={isActive ? { backgroundColor: 'var(--accent-soft)', borderColor: 'var(--accent)' } : undefined}
          >
            <Icon size={14} className={isActive ? 'text-accent' : section.color} />
            <span>{section.label}</span>
            {count > 0 && (
              <span className={`
                px-1.5 py-0.5 rounded-full text-[10px] font-mono
                ${isActive ? 'text-accent' : 'bg-surface text-content-muted'}
              `}
                style={isActive ? { backgroundColor: 'var(--accent-soft)' } : undefined}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface MemorySidebarProps {
  activeSection?: string;
  onSectionChange: (id: string) => void;
  counts?: Record<string, number>;
}

/**
 * Main MemorySidebar component
 */
export default function MemorySidebar({
  activeSection = 'summaries',
  onSectionChange,
  counts = {},
}: MemorySidebarProps) {
  // Calculate total memory items
  const totalItems = Object.values(counts).reduce((sum, c) => sum + (c || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-3">
        <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider">
          Memory Sections
        </h3>
        <p className="text-xs text-content-muted mt-1">
          {totalItems} total items
        </p>
      </div>

      {/* Section list */}
      <nav className="space-y-1">
        {SECTIONS.map((section) => (
          <SidebarItem
            key={section.id}
            section={section}
            count={counts[section.countKey] || 0}
            isActive={activeSection === section.id}
            onClick={onSectionChange}
          />
        ))}
      </nav>

      {/* Footer hint with block legend */}
      <div className="px-3 pt-2 border-t border-border-subtle space-y-2">
        <p className="text-[10px] text-content-muted">
          Select a section to view.
        </p>
        <div className="flex flex-wrap gap-1.5 text-[9px]">
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 font-mono" title="Always cached">B1</span>
          <span className="text-content-muted">cached</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400/40 font-mono" title="Conditionally cached">B3</span>
          <span className="text-content-muted">stable</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-400/40 font-mono" title="Never cached">B4</span>
          <span className="text-content-muted">fresh</span>
        </div>
      </div>
    </div>
  );
}


