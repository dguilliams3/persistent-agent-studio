/**
 * Chart Detail Panel
 *
 * @module ui/charts/ChartDetailPanel
 * @description Side panel component for displaying selected chart point content.
 * Slides in from the right when a point is clicked, showing full content,
 * metadata, and metrics for the selected entry.
 *
 * Design based on email app reading pane pattern - fixed width (~320px),
 * shows full content without truncation, keyboard dismissible.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/views/TrajectoryView.jsx - For trajectory point details
 *   - SemanticMonitorTab/views/DirectionalityExplorer.jsx - For projection details
 * @downstream Calls:
 *   - ../Icon.jsx - For close button and type icons
 */

import { useEffect, useCallback } from 'react';
import { Icon } from '../Icon';

/**
 * Entry type to icon mapping
 */
const TYPE_ICONS: Record<string, string> = {
  thought: 'MessageCircle',
  message_to_user: 'Send',
  user_message: 'User',
  cold_storage: 'Snowflake',
  user_observation: 'Eye',
  note: 'FileText',
  summary: 'FileText',
  default: 'Circle',
};

/**
 * @description Format a timestamp for display
 *
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted date string
 */
function formatDisplayTime(timestamp: any) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * @description Get icon name for entry type
 *
 * @param {string} type - Entry type
 * @returns {string} Icon name for Lucide
 */
function getTypeIcon(type: any) {
  return TYPE_ICONS[type] || TYPE_ICONS.default;
}

interface ChartDetailPanelProps {
  entry?: {
    id?: number | string;
    type?: string;
    table?: string;
    content?: string;
    timestamp?: string;
    distance?: number;
    zScore?: number;
    projection?: number;
  } | null;
  onClose: () => void;
  isOpen?: boolean;
}

/**
 * @description Side panel for displaying selected chart entry details
 *
 * @param {Object} props - Component props
 * @param {Object|null} props.entry - Selected entry data
 * @param {string|number} [props.entry.id] - Entry ID
 * @param {string} [props.entry.type] - Entry type (thought, message, etc.)
 * @param {string} [props.entry.table] - Source table
 * @param {string} [props.entry.content] - Full entry content
 * @param {string} [props.entry.timestamp] - ISO timestamp
 * @param {number} [props.entry.distance] - Distance from centroid
 * @param {number} [props.entry.zScore] - Z-score value
 * @param {number} [props.entry.projection] - Projection value (-1 to +1)
 * @param {Function} props.onClose - Handler to close the panel
 * @param {boolean} [props.isOpen=false] - Panel visibility state
 * @returns {JSX.Element|null} Panel element or null when closed
 *
 * @example
 * <ChartDetailPanel
 *   entry={selectedPoint}
 *   onClose={() => setSelectedPoint(null)}
 *   isOpen={!!selectedPoint}
 * />
 */
export function ChartDetailPanel({ entry, onClose, isOpen = false }: ChartDetailPanelProps) {
  /**
   * @description Handle Escape key to close panel
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: any) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * @description Handle click outside panel to close
   */
  const handleBackdropClick = useCallback((e: any) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Don't render if not open or no entry
  if (!isOpen || !entry) return null;

  const typeIcon = getTypeIcon(entry.type);

  return (
    // Backdrop (optional - for modal-like behavior, remove for side panel only)
    <div
      className="absolute inset-y-0 right-0 z-30 flex"
      onClick={handleBackdropClick}
    >
      {/* Panel - constrained height with internal scroll */}
      <div
        className="w-80 bg-surface border-l border-border-subtle shadow-xl
                   flex flex-col animate-slide-in-right overflow-hidden
                   max-h-full"
        style={{ height: 'min(100%, 500px)' }}
      >
        {/* Header - fixed */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-border-subtle bg-surface">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-surface text-content-secondary">
              <Icon name={typeIcon} size={12} />
              {entry.type || entry.table || 'Entry'}
            </span>
            <span className="text-xs text-content-muted">#{entry.id}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface text-content-secondary
                       hover:text-content-primary transition-colors"
            title="Close (Escape)"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Content - scrollable with min-h-0 to allow shrink */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {entry.content ? (
            <div className="text-sm text-content-primary whitespace-pre-wrap leading-relaxed">
              {entry.content}
            </div>
          ) : (
            <div className="text-sm text-content-muted italic">
              No content available for this entry.
            </div>
          )}
        </div>

        {/* Footer with metadata - fixed */}
        <div className="flex-shrink-0 border-t border-border-subtle bg-surface p-3 space-y-2">
          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Distance */}
            {entry.distance != null && (
              <div className="flex justify-between">
                <span className="text-content-muted">Distance:</span>
                <span className="font-mono text-content-secondary">
                  {entry.distance.toFixed(4)}
                </span>
              </div>
            )}

            {/* Z-score */}
            {entry.zScore != null && (
              <div className="flex justify-between">
                <span className="text-content-muted">Z-score:</span>
                <span className={`font-mono font-medium ${
                  Math.abs(entry.zScore) > 2 ? 'text-danger' :
                  Math.abs(entry.zScore) > 1 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {entry.zScore >= 0 ? '+' : ''}{entry.zScore.toFixed(2)}σ
                </span>
              </div>
            )}

            {/* Projection (for directionality) */}
            {entry.projection != null && (
              <div className="flex justify-between col-span-2">
                <span className="text-content-muted">Projection:</span>
                <span className={`font-mono font-medium ${
                  entry.projection >= 0 ? 'text-cyan-500' : 'text-amber-500'
                }`}>
                  {entry.projection >= 0 ? '+' : ''}{entry.projection.toFixed(3)}
                </span>
              </div>
            )}
          </div>

          {/* Timestamp */}
          {entry.timestamp && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-content-muted">Created:</span>
              <span className="text-content-secondary">
                {formatDisplayTime(entry.timestamp)}
              </span>
            </div>
          )}

          {/* Source info */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border-subtle">
            <span className="text-content-muted">Source:</span>
            <span className="font-mono text-content-secondary">
              {entry.table || 'unknown'}#{entry.id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


export default ChartDetailPanel;
