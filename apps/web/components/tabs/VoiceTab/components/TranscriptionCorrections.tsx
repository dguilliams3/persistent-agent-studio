/**
 * Voice Transcription Corrections Section
 *
 * @module components/tabs/VoiceTab/components/TranscriptionCorrections
 * @description Displays the user's voice messages for correction training.
 * Allows correcting both transcription text and detected emotion.
 *
 * Used to generate training data for improving WhisperX and prosody detection.
 *
 * @upstream Called by:
 *   - VoiceTab/index.jsx - Renders in voice testing interface
 * @downstream Calls:
 *   - Zustand store (voice transcriptions state/actions)
 *   - Accordion component (from ui/)
 *   - formatTextWithProsody (for displaying annotations)
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { Accordion } from '../../../ui';
import { formatTextWithProsody } from './VoiceHistoryCard';
import { Check, X, Edit3 } from 'lucide-react';

import { parseDbTimestamp } from '../../../ui/historyUtils';
/** Common emotion options for correction */
const EMOTION_OPTIONS = [
  'neutral',
  'happy',
  'sad',
  'thoughtful',
  'excited',
  'tired',
  'frustrated',
  'amused',
  'loving',
];

/**
 * @description Format date in Eastern timezone for display
 *
 * @param {string} isoString - ISO date string from database (stored as UTC)
 * @returns {string} Formatted date string
 */
function formatDate(isoString: any) {
  if (!isoString) return '';
  const date = parseDbTimestamp(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * @description Voice transcription corrections section
 *
 * @upstream Called by: VoiceTab/index.jsx
 * @downstream Calls: Zustand store, Accordion, formatTextWithProsody
 *
 * @returns {JSX.Element} Transcription corrections section
 *
 * @example
 * <TranscriptionCorrections />
 */
export default function TranscriptionCorrections({ isPanel = false }: { isPanel?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editEmotion, setEditEmotion] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Store state and actions
  const voiceTranscriptions = useAppStore((s) => s.voiceTranscriptions);
  const voiceTranscriptionsTotal = useAppStore((s) => s.voiceTranscriptionsTotal);
  const voiceTranscriptionsLoading = useAppStore((s) => s.voiceTranscriptionsLoading);
  const fetchVoiceTranscriptions = useAppStore((s) => s.fetchVoiceTranscriptions);
  const updateVoiceTranscription = useAppStore((s) => s.updateVoiceTranscription);

  // Fetch transcriptions on mount
  useEffect(() => {
    fetchVoiceTranscriptions();
  }, [fetchVoiceTranscriptions]);

  /**
   * @description Start editing a transcription
   * @param {Object} item - Transcription to edit
   */
  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditText(item.corrected_text || item.raw_transcription);
    setEditEmotion(item.corrected_emotion || item.detected_emotion || 'neutral');
  };

  /**
   * @description Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditEmotion('');
  };

  /**
   * @description Save corrections
   * @param {number} id - Transcription ID
   */
  const handleSaveEdit = async (id: any) => {
    setSavingId(id);
    try {
      await updateVoiceTranscription(id, {
        correctedText: editText,
        correctedEmotion: editEmotion,
      });
      setEditingId(null);
      setEditText('');
      setEditEmotion('');
    } finally {
      setSavingId(null);
    }
  };

  // Count uncorrected entries
  const uncorrectedCount = voiceTranscriptions.filter(
    (t) => !t.corrected_text && !t.corrected_emotion
  ).length;

  const titleClass = isPanel
    ? 'flex flex-col items-start gap-1'
    : 'flex items-center gap-2';

  return (
    <Accordion
      title={(
        <span className={titleClass}>
          <span>Voice Message Corrections</span>
          {uncorrectedCount > 0 && (
            <span className="badge-warning ml-2">{uncorrectedCount} pending</span>
          )}
          <span className={`text-content-muted text-sm ${isPanel ? '' : 'ml-auto'}`}>{voiceTranscriptionsTotal} total</span>
        </span>
      )}
      variant="card"
      isOpen={isExpanded}
      onToggle={setIsExpanded}
    >
      <div className="space-y-3 pt-2">
        {voiceTranscriptionsLoading ? (
          <div className="text-center text-content-muted text-sm py-4">Loading...</div>
        ) : voiceTranscriptions.length === 0 ? (
          <div className="text-center text-content-muted text-sm py-4">
            No voice messages yet. Send voice notes via Telegram to see them here.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {voiceTranscriptions.map((item) => (
              <TranscriptionCard
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                editText={editText}
                editEmotion={editEmotion}
                onEditTextChange={setEditText}
                onEditEmotionChange={setEditEmotion}
                onStartEdit={() => handleStartEdit(item)}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={() => handleSaveEdit(item.id)}
                isSaving={savingId === item.id}
              />
            ))}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-content-muted border-t border-border-subtle pt-3">
          Correct transcription errors and emotion detection to improve speech recognition accuracy.
          Your corrections help train the STT system for better future recognition.
        </div>
      </div>
    </Accordion>
  );
}

/**
 * @description Individual transcription card with edit form
 *
 * @param {Object} props
 * @param {Object} props.item - Transcription entry
 * @param {boolean} props.isEditing - Whether this card is being edited
 * @param {string} props.editText - Current edit text value
 * @param {string} props.editEmotion - Current edit emotion value
 * @param {Function} props.onEditTextChange - Edit text change handler
 * @param {Function} props.onEditEmotionChange - Edit emotion change handler
 * @param {Function} props.onStartEdit - Start editing handler
 * @param {Function} props.onCancelEdit - Cancel editing handler
 * @param {Function} props.onSaveEdit - Save editing handler
 * @param {boolean} props.isSaving - Whether save is in progress
 * @returns {JSX.Element} Transcription card
 */
function TranscriptionCard({ item,
  isEditing,
  editText,
  editEmotion,
  onEditTextChange,
  onEditEmotionChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  isSaving, }: any) {
  const hasCorrected = item.corrected_text || item.corrected_emotion;

  if (isEditing) {
    return (
      <div className="card-elevated p-3 space-y-2">
        {/* Original transcription */}
        <div className="text-xs text-content-muted">
          Original: {formatTextWithProsody(item.raw_transcription)}
        </div>

        {/* Text correction input */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1">
            Actual Text
          </label>
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            rows={2}
            className="input text-sm resize-none"
            placeholder="What did you actually say?"
          />
        </div>

        {/* Emotion correction */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1">
            Actual Emotion: {item.detected_emotion && `(detected: ${item.detected_emotion})`}
          </label>
          <div className="flex flex-wrap gap-1">
            {EMOTION_OPTIONS.map((emotion) => (
              <button
                key={emotion}
                onClick={() => onEditEmotionChange(emotion)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  editEmotion === emotion
                    ? 'bg-accent text-white'
                    : 'bg-depth text-content-secondary hover:bg-surface'
                }`}
              >
                {emotion}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onSaveEdit}
            disabled={isSaving}
            className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
          >
            <Check size={14} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancelEdit}
            disabled={isSaving}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card-elevated p-3 ${hasCorrected ? 'border-l-2 border-success' : ''}`}
    >
      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 text-xs text-content-muted mb-1">
        <span>{formatDate(item.created_at)}</span>
        <div className="flex items-center gap-2">
          {item.detected_emotion && (
            <span className="bg-depth px-2 py-0.5 rounded">
              {item.corrected_emotion || item.detected_emotion}
              {item.corrected_emotion && item.corrected_emotion !== item.detected_emotion && (
                <span className="text-success ml-1">✓</span>
              )}
            </span>
          )}
          {item.audio_duration && (
            <span>{Math.round(item.audio_duration)}s</span>
          )}
        </div>
      </div>

      {/* Transcription text */}
      <div className="text-sm text-content-secondary mb-2">
        {item.corrected_text ? (
          <>
            <span className="text-content-primary">{formatTextWithProsody(item.corrected_text)}</span>
            {item.corrected_text !== item.raw_transcription && (
              <div className="text-xs text-content-muted mt-1 line-through">
                {item.raw_transcription}
              </div>
            )}
          </>
        ) : (
          formatTextWithProsody(item.raw_transcription)
        )}
      </div>

      {/* Edit button */}
      <button
        onClick={onStartEdit}
        className="text-xs text-accent hover:text-accent flex items-center gap-1"
      >
        <Edit3 size={12} />
        {hasCorrected ? 'Edit correction' : 'Add correction'}
      </button>
    </div>
  );
}
