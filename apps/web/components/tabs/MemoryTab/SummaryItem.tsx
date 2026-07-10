/**
 * SummaryItem and DraggableSummary Components
 *
 * @module components/tabs/MemoryTab/SummaryItem
 * @description Individual summary display with collapsible content, drag handle,
 * promotion/demotion controls, and metadata pills.
 *
 * @upstream Called by: SummariesSection (via DraggableSummary or directly)
 * @downstream Calls: estimateTokens, parseMetadata, METADATA_STYLES, PILL_CLASSES, METADATA_COLORS
 */

import { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Star,
  Archive,
  Pin,
  RefreshCw,
} from 'lucide-react';
import { estimateTokens, parseMetadata, METADATA_STYLES, PILL_CLASSES, METADATA_COLORS } from './constants';

// =============================================================================
// METADATA PILL COMPONENTS
// =============================================================================

interface MetadataPillProps {
  fieldKey: string;
  values: string | string[] | undefined | null;
}

/**
 * @description Renders a single metadata category with label and value pills
 *
 * @upstream Called by: SummaryMetadata
 * @downstream None - leaf component
 */
function MetadataPill({ fieldKey, values }: MetadataPillProps) {
  if (!values || (Array.isArray(values) && values.length === 0)) return null;

  const items = Array.isArray(values) ? values : [values];
  const style = (METADATA_STYLES as any)[fieldKey];
  const colorKey = (METADATA_COLORS as any)[fieldKey];
  const classes = (PILL_CLASSES as any)[colorKey];

  if (!style || !classes) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <span className={`${classes.label} rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
        {style.icon} {style.label}
      </span>
      {items.map((item, i) => (
        <span key={i} className={`${classes.value} rounded-full px-2 py-0.5 text-xs`}>
          {item}
        </span>
      ))}
    </div>
  );
}

interface SummaryMetadataProps {
  metadata: unknown;
}

/**
 * @description Displays all metadata fields for a summary
 *
 * @upstream Called by: SummaryItem (in expanded content)
 * @downstream Calls: MetadataPill, parseMetadata
 */
function SummaryMetadata({ metadata: rawMetadata }: SummaryMetadataProps) {
  const metadata = parseMetadata(rawMetadata) as Record<string, unknown> | null;
  if (!metadata) return null;

  const hasContent = (metadata.themes as string[])?.length || (metadata.entity_tags as string[])?.length ||
                     metadata.emotional_tone || metadata.time_period_label ||
                     (metadata.key_facts as string[])?.length;

  if (!hasContent) {
    return (
      <div className="text-content-muted text-xs italic">No metadata extracted</div>
    );
  }

  return (
    <div className="space-y-2">
      <MetadataPill fieldKey="themes" values={metadata.themes as string[]} />
      <MetadataPill fieldKey="entities" values={metadata.entity_tags as string[]} />
      <MetadataPill fieldKey="tone" values={metadata.emotional_tone as string} />
      <MetadataPill fieldKey="period" values={metadata.time_period_label as string} />
      <MetadataPill fieldKey="key_facts" values={metadata.key_facts as string[]} />
    </div>
  );
}

// =============================================================================
// SUMMARY ITEM
// =============================================================================

export interface SummaryItemProps {
  summary: {
    id: number;
    summary: string;
    message_count?: number;
    covered_range?: string;
    created_at?: string;
    tier?: number | string;
    tier_position?: number;
    metadata?: unknown;
  };
  isSelected: boolean;
  onToggle: (id: number) => void;
  formatTime: (time: string) => string;
  showCheckbox?: boolean;
  dragHandleProps?: Record<string, unknown> | null;
  isHighlighted?: boolean;
  onMoveToCached?: ((id: number) => void) | null;
  onMoveFromCached?: ((id: number) => void) | null;
  tier?: number | string | null;
  isMoving?: boolean;
  onPromote?: ((id: number) => void) | null;
  onDemote?: ((id: number) => void) | null;
  isPromoting?: boolean;
  onArchive?: ((id: number) => void) | null;
  onActivate?: ((id: number) => void) | null;
  isArchiving?: boolean;
  isAutoRolled?: boolean;
}

/**
 * @description Individual summary item with collapsible content, token estimate, and promotion controls
 *
 * @upstream Called by: DraggableSummary, SummariesSection (for block2/archived items)
 * @downstream Calls: estimateTokens, formatTime, SummaryMetadata
 *
 * @antipattern
 * // WRONG: Attaching drag listeners to entire wrapper div
 * <div {...listeners}>  // This makes EVERY click start a drag
 * // CORRECT: Only attach listeners to dedicated drag handle
 */
export function SummaryItem({ summary, isSelected, onToggle, formatTime, showCheckbox = true, dragHandleProps = null, isHighlighted = false, onMoveToCached = null, onMoveFromCached = null, tier = null, isMoving = false, onPromote = null, onDemote = null, isPromoting = false, onArchive = null, onActivate = null, isArchiving = false, isAutoRolled = false }: SummaryItemProps) {
  const tokens = estimateTokens(summary.summary);
  const borderClass = isSelected || isHighlighted ? 'border-accent shadow-glow' : 'border-border-subtle';
  const highlightRing = isHighlighted ? 'ring-2 ring-accent/30' : '';
  const handleGripKeyDown = (event: React.KeyboardEvent) => {
    (dragHandleProps as any)?.onKeyDown?.(event);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return (
    <details className={`bg-depth rounded-md border-2 transition-all duration-fast ${borderClass} ${highlightRing}`}>
      <summary className="p-2 cursor-pointer flex items-center gap-2 text-sm">
        {/* Drag handle - only this element has drag listeners */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-content-muted hover:text-content-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleGripKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Drag handle"
          >
            <GripVertical size={16} />
          </div>
        )}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggle(summary.id); }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded bg-depth border-border-subtle text-accent focus:ring-accent"
          />
        )}
        <span className="text-accent font-mono">#{summary.id}</span>
        <span className="text-content-muted">—</span>
        <span className="text-content-primary">{summary.message_count} entries</span>
        <span className="text-accent text-xs">~{tokens.toLocaleString()} tok</span>

        {/* Tier status indicator */}
        {tier === 3 && (
          <span className="text-emerald-400 text-xs flex items-center gap-0.5" title="Pinned to cached block">
            <Pin size={12} className="fill-emerald-400" />
          </span>
        )}
        {tier === 4 && isAutoRolled && (
          <span className="text-sky-400 text-xs flex items-center gap-0.5" title="Auto-rolled to cached prefix">
            <RefreshCw size={12} />
          </span>
        )}

        {/* Move and Promote buttons */}
        <div className="flex items-center gap-1 ml-2">
          {tier === 3 && onMoveFromCached && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveFromCached(summary.id); }}
              disabled={isMoving}
              className={`p-1 rounded transition-colors ${
                isMoving
                  ? 'text-content-muted/50 cursor-not-allowed'
                  : 'text-content-muted hover:text-warning hover:bg-surface cursor-pointer'
              }`}
              title={isMoving ? "Moving..." : "Move out of cached block"}
              aria-label="Move out of cached block"
            >
              <ArrowDown size={14} />
            </button>
          )}
          {tier !== 3 && onMoveToCached && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToCached(summary.id); }}
              disabled={isMoving}
              className={`p-1 rounded transition-colors ${
                isMoving
                  ? 'text-content-muted/50 cursor-not-allowed'
                  : 'text-content-muted hover:text-accent hover:bg-surface cursor-pointer'
              }`}
              title={isMoving ? "Moving..." : "Move to cached block"}
              aria-label="Move to cached block"
            >
              <ArrowUp size={14} />
            </button>
          )}

          {/* Promotion controls - use tier=2 (BLOCK.PROMOTED) as single source of truth */}
          {summary.tier === 2 ? (
            <>
              <span className="text-blue-400 text-xs px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 rounded-full flex items-center gap-1 font-medium">
                <Star size={10} className="fill-blue-400" />
                Block 2
              </span>
              {onDemote && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDemote(summary.id); }}
                  disabled={isPromoting}
                  className={`p-1 rounded transition-colors ${
                    isPromoting
                      ? 'text-content-muted/50 cursor-not-allowed'
                      : 'text-content-muted hover:text-rose-400 hover:bg-surface cursor-pointer'
                  }`}
                  title={isPromoting ? "Demoting..." : "Demote from Block 2"}
                  aria-label="Demote from Block 2"
                >
                  <ArrowDown size={14} />
                </button>
              )}
            </>
          ) : (
            onPromote && (
              <button
                onClick={(e) => { e.stopPropagation(); onPromote(summary.id); }}
                disabled={isPromoting}
                className={`p-1 rounded transition-colors ${
                  isPromoting
                    ? 'text-content-muted/50 cursor-not-allowed'
                    : 'text-content-muted hover:text-blue-400 hover:bg-surface cursor-pointer'
                }`}
                title={isPromoting ? "Promoting..." : "Promote to Block 2"}
                aria-label="Promote to Block 2"
              >
                <Star size={14} />
              </button>
            )
          )}

          {/* Archive/Activate controls - move between active tier and RAG Archive */}
          {(tier === 3 || tier === 4) && onArchive && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(summary.id); }}
              disabled={isArchiving}
              className={`p-1 rounded transition-colors ${
                isArchiving
                  ? 'text-content-muted/50 cursor-not-allowed'
                  : 'text-content-muted hover:text-accent hover:bg-surface cursor-pointer'
              }`}
              title={isArchiving ? "Archiving..." : "Move to RAG Archive"}
              aria-label="Move to RAG Archive"
            >
              <Archive size={14} />
            </button>
          )}
          {tier === 'archived' && onActivate && (
            <button
              onClick={(e) => { e.stopPropagation(); onActivate(summary.id); }}
              disabled={isArchiving}
              className={`p-1 rounded transition-colors ${
                isArchiving
                  ? 'text-content-muted/50 cursor-not-allowed'
                  : 'text-content-muted hover:text-success hover:bg-surface cursor-pointer'
              }`}
              title={isArchiving ? "Activating..." : "Move to Dynamic Tail"}
              aria-label="Move to Dynamic Tail"
            >
              <ArrowUp size={14} />
            </button>
          )}
        </div>

        <span className="text-content-muted text-xs ml-auto">{summary.covered_range}</span>
      </summary>
      <div className="px-3 pb-3 border-t border-border-subtle bg-surface space-y-2 pt-3">
        {/* Metadata dropdown - only shows if metadata exists */}
        {!!summary.metadata && (
          <details className="group rounded-md border border-border-subtle bg-surface/50 overflow-hidden">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex items-center gap-2 hover:bg-depth/50 transition-colors select-none">
              <ChevronRight size={14} className="text-content-muted transition-transform group-open:rotate-90" />
              <span className="text-fuchsia-400">Metadata</span>
              <span className="text-content-muted text-xs ml-auto">extracted insights</span>
            </summary>
            <div className="px-3 pb-3 pt-2 border-t border-border-subtle/50 bg-surface/30">
              <SummaryMetadata metadata={summary.metadata} />
            </div>
          </details>
        )}

        {/* Full Summary dropdown - open by default if no metadata */}
        <details className="group rounded-md border border-border-subtle bg-surface/50 overflow-hidden" open={!summary.metadata}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex items-center gap-2 hover:bg-depth/50 transition-colors select-none">
            <ChevronRight size={14} className="text-content-muted transition-transform group-open:rotate-90" />
            <span className="text-emerald-400">Full Summary</span>
            <span className="text-content-muted text-xs ml-auto">complete text</span>
          </summary>
          <div className="px-3 pb-3 pt-2 border-t border-border-subtle/50 bg-surface/30">
            <div className="text-content-primary text-sm whitespace-pre-wrap leading-relaxed">{summary.summary}</div>
            <div className="text-content-muted text-xs mt-3 pt-2 border-t border-border-subtle/30">
              Created: {formatTime(summary.created_at || '')}
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}

// =============================================================================
// DRAGGABLE SUMMARY
// =============================================================================

export interface DraggableSummaryProps extends Omit<SummaryItemProps, 'dragHandleProps' | 'showCheckbox'> {
  /** Intentionally shadows SummaryItemProps.tier for dnd-kit data-tier attribute */
}

/**
 * @description Wrapper around SummaryItem integrating dnd-kit sorting
 *
 * @upstream Called by: SummariesSection (cached and tail tiers)
 * @downstream Calls: useSortable, SummaryItem
 *
 * @antipattern
 * // WRONG: Attaching listeners to wrapper div
 * <div {...attributes} {...listeners}>  // Makes ENTIRE item respond to pointer events
 * // CORRECT: Pass listeners to dedicated handle component
 * <div {...attributes}>  // Only ARIA attributes on wrapper
 *   <SummaryItem dragHandleProps={listeners} />
 * </div>
 */
export function DraggableSummary({ summary, tier, isSelected, onToggle, formatTime, isHighlighted = false, onMoveToCached = null, onMoveFromCached = null, isMoving = false, onPromote = null, onDemote = null, isPromoting = false, onArchive = null, isArchiving = false, isAutoRolled = false }: DraggableSummaryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: summary.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} data-tier={tier} {...attributes}>
      <SummaryItem
        summary={summary}
        isSelected={isSelected}
        onToggle={onToggle}
        formatTime={formatTime}
        dragHandleProps={listeners}
        isHighlighted={isHighlighted}
        onMoveToCached={onMoveToCached}
        onMoveFromCached={onMoveFromCached}
        tier={tier}
        isMoving={isMoving}
        onPromote={onPromote}
        onDemote={onDemote}
        isPromoting={isPromoting}
        onArchive={onArchive}
        isArchiving={isArchiving}
        isAutoRolled={isAutoRolled}
      />
    </div>
  );
}
