/**
 * Entry Actions — voice playback and selection controls
 *
 * @module ui/EntryActions
 * @description Inline action controls for history entries: voice playback button,
 * selection checkbox, and pole indicator badges.
 *
 * @upstream Called by: ui/HistoryEntryRow
 * @downstream Calls: ui/Icon
 * @pattern Decomposed sub-component — extracted from HistoryEntryRow (Wave 2C)
 */

import { Icon } from './Icon';

interface VoicePlaybackProps {
  matchingVoice: Record<string, unknown> | null;
  playVoiceHistoryEntry?: (id: number) => void;
  voiceHistoryPlayingId?: number | null;
}

/**
 * @description Inline voice play/pause button for entries with matching voice audio
 */
export function VoicePlayback({ matchingVoice, playVoiceHistoryEntry, voiceHistoryPlayingId }: VoicePlaybackProps) {
  if (!matchingVoice || !playVoiceHistoryEntry) return null;

  const isPlaying = voiceHistoryPlayingId === matchingVoice.id;

  return (
    <button
      onClick={() => playVoiceHistoryEntry(matchingVoice.id as number)}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-1 transition-all ${
        isPlaying
          ? 'bg-accent text-white'
          : 'bg-surface hover:bg-accent/20 text-content-secondary hover:text-accent'
      }`}
      title={isPlaying ? 'Stop' : 'Play voice'}
    >
      <Icon name={isPlaying ? 'Pause' : 'Play'} size={10} />
    </button>
  );
}

interface SelectionCheckboxProps {
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  entryId: number;
}

/**
 * @description Checkbox for selectable mode (Axis Builder)
 */
export function SelectionCheckbox({ isSelected, onToggleSelect, entryId }: SelectionCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={(e) => {
        e.stopPropagation();
        onToggleSelect(entryId);
      }}
      onClick={(e) => e.stopPropagation()}
      className="mr-2 w-4 h-4 rounded border-border-subtle text-cyan-500 cursor-pointer"
    />
  );
}

interface PoleIndicatorProps {
  pole: 'A' | 'B';
}

/**
 * @description Pole A/B badge for Axis Builder selection mode
 */
export function PoleIndicator({ pole }: PoleIndicatorProps) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1 ${
      pole === 'A'
        ? 'bg-cyan-500/20 text-cyan-400'
        : 'bg-amber-500/20 text-amber-400'
    }`}>
      Pole {pole}
    </span>
  );
}
