/**
 * History Entry Row — container composing metadata, content, and actions.
 *
 * @module ui/HistoryEntryRow
 * @description Orchestrates entry rendering by composing EntryMetadata, EntryContent,
 * and EntryActions sub-components. Supports two modes: 'display' (Chat tab timeline)
 * and 'selectable' (Axis Builder pole selection).
 *
 * @upstream Called by: ChatTab, AxisBuilderView
 * @downstream Calls: EntryMetadata, EntryContent, EntryActions (VoicePlayback, SelectionCheckbox, PoleIndicator), historyUtils
 * @pattern Composition — container orchestrates sub-components, passes classified props down
 */

import { Icon } from './Icon';
import { TYPE_ICONS, TYPE_LABELS, TYPE_COLORS, TYPE_BORDER_COLORS, formatTime } from './historyUtils';
import { EntryMetadata } from './EntryMetadata';
import { EntryContent } from './EntryContent';
import { VoicePlayback, SelectionCheckbox, PoleIndicator } from './EntryActions';

interface HistoryEntryRowProps {
  entry: Record<string, unknown>;
  formatTimeShort?: (time: string) => string;
  getHistoryIcon?: (type: string) => string;
  getHistoryLabel?: (type: string) => string;
  showMeterSnapshot?: boolean;
  showImages?: boolean;
  blurImages?: boolean;
  getAllImages?: () => Array<{ src: string; prompt: string }>;
  openLightbox?: (images: Array<{ src: string; prompt: string }>, index: number) => void;
  voiceHistory?: Array<Record<string, unknown>>;
  playVoiceHistoryEntry?: (id: number) => void;
  voiceHistoryPlayingId?: number | null;
  mode?: 'display' | 'selectable';
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  poleIndicator?: 'A' | 'B' | null;
  className?: string;
}

export function HistoryEntryRow({
  entry: h,
  formatTimeShort: formatTimeProp,
  getHistoryIcon,
  getHistoryLabel,
  showMeterSnapshot = true,
  showImages = false,
  blurImages = false,
  getAllImages,
  openLightbox,
  voiceHistory = [],
  playVoiceHistoryEntry,
  voiceHistoryPlayingId,
  mode = 'display',
  isSelected = false,
  onToggleSelect,
  poleIndicator = null,
  className = '',
}: HistoryEntryRowProps) {
  const timeFormatter = formatTimeProp || formatTime;
  const iconGetter = getHistoryIcon || ((type: string) => TYPE_ICONS[type] || 'Circle');
  const labelGetter = getHistoryLabel || ((type: string) => TYPE_LABELS[type] || type);

  // Classify entry type for rendering
  const hasMediaContent = (h.content as string)?.startsWith('data:image') || (h.content as string)?.startsWith('https://');
  const hasMediaInternal = (h.internal as string)?.startsWith('data:image') || (h.internal as string)?.startsWith('https://');
  const isArtResult = (h.type === 'art_result' || h.type === 'user_art') && hasMediaContent;
  const isUserArt = h.type === 'user_art' && hasMediaContent;
  const isUserImage = h.type === 'user_message' && hasMediaInternal;
  const isUserVideo = h.type === 'user_video' && hasMediaInternal;
  const isParseError = h.type === 'parse_error';

  // Match voice entry for message_to_user
  const matchingVoice = h.type === 'message_to_user' && voiceHistory.find((v) => {
    if (!v.created_at || !h.created_at) return false;
    const timeDiff = Math.abs(new Date(v.created_at as string).getTime() - new Date(h.created_at as string).getTime());
    return timeDiff < 60000 && (h.content as string)?.includes((v.text as string)?.slice(0, 50));
  });

  // Icon rendering
  const iconName = typeof iconGetter === 'function' ? iconGetter(h.type as string) : TYPE_ICONS[h.type as string] || 'Circle';
  const isEmoji = typeof iconName === 'string' && iconName.match(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{26FF}]/u);
  const colorGetter = (type: string) => TYPE_COLORS[type] || 'text-content-muted';

  // Styling
  const typeBorderClass = mode === 'display' ? TYPE_BORDER_COLORS[h.type as string] || 'border-l-gray-400/20' : '';
  const selectionBgClass = mode === 'selectable'
    ? poleIndicator === 'A' ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
      : poleIndicator === 'B' ? 'bg-amber-500/10 border-l-2 border-l-amber-500'
      : isSelected ? 'bg-accent/5'
      : 'hover:bg-surface'
    : '';
  const baseClass = isParseError
    ? 'bg-danger/10 rounded px-2 -mx-2 border-l-2 border-danger'
    : mode === 'display' ? `pl-2 border-l-2 ${typeBorderClass}` : '';

  const rowProps = mode === 'selectable' && onToggleSelect
    ? {
        onClick: () => onToggleSelect(h.id as number),
        className: `py-1 text-sm cursor-pointer transition-colors ${baseClass} ${selectionBgClass} ${className}`,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onToggleSelect(h.id as number),
      }
    : { className: `py-1 text-sm ${baseClass} ${className}` };

  return (
    <div {...rowProps}>
      {mode === 'selectable' && onToggleSelect && (
        <SelectionCheckbox isSelected={isSelected} onToggleSelect={onToggleSelect} entryId={h.id as number} />
      )}

      <EntryMetadata
        createdAt={h.created_at as string}
        meterSnapshot={h.meter_snapshot as string}
        showMeterSnapshot={showMeterSnapshot}
        formatTimeShort={timeFormatter}
      />

      {/* Type icon */}
      <span className={`mr-1 ${isParseError ? 'text-danger' : colorGetter(h.type as string)}`}>
        {isEmoji ? iconName : <Icon name={iconName} size={14} className="inline" />}
      </span>

      {/* Type label */}
      <span className={`font-medium mr-1 ${
        h.type === 'user_message' ? 'text-success'
          : h.type === 'message_to_user' ? 'text-accent'
          : h.type === 'exist' ? 'text-content-muted'
          : isParseError ? 'text-danger'
          : 'text-content-secondary'
      }`}>
        {labelGetter(h.type as string)}:
      </span>

      {mode === 'selectable' && poleIndicator && <PoleIndicator pole={poleIndicator} />}

      {mode === 'display' && matchingVoice && (
        <VoicePlayback
          matchingVoice={matchingVoice || null}
          playVoiceHistoryEntry={playVoiceHistoryEntry}
          voiceHistoryPlayingId={voiceHistoryPlayingId}
        />
      )}

      <EntryContent
        entry={h}
        isArtResult={isArtResult}
        isUserArt={isUserArt}
        isUserImage={isUserImage}
        isUserVideo={isUserVideo}
        isParseError={isParseError}
        showImages={showImages}
        blurImages={blurImages}
        getAllImages={getAllImages}
        openLightbox={openLightbox}
      />
    </div>
  );
}

export default HistoryEntryRow;
