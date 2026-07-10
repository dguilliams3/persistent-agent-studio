/**
 * Voice Tab Component
 *
 * @module components/tabs/VoiceTab
 * @description Voice testing interface for ElevenLabs TTS integration.
 * Uses the unified design system with surface elevations, semantic colors,
 * and component utility classes (.card, .btn-primary, .input).
 *
 * Composition-only component - UI logic delegated to extracted sub-components.
 *
 * Allows users to:
 * - Enter text and hear TTS output in browser
 * - Configure TTS model (v2/v3/flash/turbo), stability (v3 only), and speed
 * - Start and end realtime voice sessions (OpenAI Realtime or future providers)
 * - Manage STT glossary entries for speech-to-text corrections
 * - Browse and replay voice history entries with pagination
 * - Correct voice message transcriptions for STT training
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop.jsx - Renders when activeTab === 'voice'
 * @downstream Calls:
 *   - CreditDisplay component (./components)
 *   - TTSConfig component (./components)
 *   - RealtimeSessionPanel component (./components)
 *   - GlossarySection component (./components) - STT glossary management
 *   - VoiceHistoryCard component (./components)
 *   - TranscriptionCorrections component (./components) - Voice message corrections
 *   - api.fetchRaw('/tts-generate') (POST, returns audio/mpeg binary)
 *   - Zustand store for voice history, TTS config, glossary, and transcriptions
 *   - Browser Web Audio API via <audio> element
 *
 * @example
 * <VoiceTab />
 */

import { useState, useRef, useEffect } from 'react';
import api from '../../../api/client';
import { useAppStore } from '../../../store';
import { Accordion } from '../../ui';
import { CreditDisplay, TTSConfig, VoiceHistoryCard, GlossarySection, TranscriptionCorrections, RealtimeSessionPanel } from './components';

/**
 * @description Voice testing tab with TTS generation, realtime session control, playback, and history
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx
 * @downstream Calls: CreditDisplay, TTSConfig, RealtimeSessionPanel, VoiceHistoryCard, /tts-generate, Zustand store
 *
 * @returns {JSX.Element} Voice testing UI
 */
export default function VoiceTab({ isPanel = false }: { isPanel?: boolean }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testGenExpanded, setTestGenExpanded] = useState(true);
  const audioRef = useRef<any>(null);

  // Get voice history state and actions from store
  const voiceHistory = useAppStore((s) => s.voiceHistory);
  const voiceHistoryTotal = useAppStore((s) => s.voiceHistoryTotal);
  const voiceHistoryPlayingId = useAppStore((s) => s.voiceHistoryPlayingId);
  const voiceHistoryExpanded = useAppStore((s) => s.voiceHistoryExpanded);
  const fetchVoiceHistory = useAppStore((s) => s.fetchVoiceHistory);
  const playVoiceHistoryEntry = useAppStore((s) => s.playVoiceHistoryEntry);
  const setVoiceHistoryExpanded = useAppStore((s) => s.setVoiceHistoryExpanded);
  const stopVoiceHistoryPlayback = useAppStore((s) => s.stopVoiceHistoryPlayback);

  // TTS config state
  const ttsModel = useAppStore((s) => s.ttsModel);
  const setTtsModel = useAppStore((s) => s.setTtsModel);
  const ttsStability = useAppStore((s) => s.ttsStability);
  const setTtsStability = useAppStore((s) => s.setTtsStability);
  const ttsSpeed = useAppStore((s) => s.ttsSpeed);
  const setTtsSpeed = useAppStore((s) => s.setTtsSpeed);
  const ttsSaving = useAppStore((s) => s.ttsSaving);
  const ttsCredits = useAppStore((s) => s.ttsCredits);
  const updateTTSModel = useAppStore((s) => s.updateTTSModel);
  const fetchTabData = useAppStore((s) => s.fetchTabData);

  // Fetch voice history, TTS model, and credits on mount
  useEffect(() => {
    fetchTabData('voice');
    // Cleanup: stop playback when unmounting
    return () => {
      stopVoiceHistoryPlayback();
    };
  }, [fetchTabData, stopVoiceHistoryPlayback]);

  /**
   * @description Generate TTS audio and create object URL for playback
   * @downstream Calls: /tts-generate endpoint, fetchVoiceHistory
   */
  const generateAudio = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError(null);

    // Revoke previous URL to prevent memory leak
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const body: any = { text: text.trim() };
      // Only include stability for v3 model
      if (ttsModel === 'v3') {
        body.stability = ttsStability;
      }
      body.speed = ttsSpeed;

      const response = await api.fetchRaw('/tts-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Generation failed: ${response.status}`);
      }

      // Get audio as blob and create object URL
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Auto-play when ready
      if (audioRef.current) {
        audioRef.current.load();
        audioRef.current.play().catch(() => {
          // Autoplay may be blocked, user can click play
        });
      }

      // Refresh voice history to show the new entry
      fetchVoiceHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to generate audio');
    } finally {
      setLoading(false);
    }
  };

  /** @description Handle form submission */
  const handleSubmit = (e: any) => {
    e.preventDefault();
    generateAudio();
  };

  /** @description Load more voice history entries */
  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchVoiceHistory(true); // append mode
    } finally {
      setLoadingMore(false);
    }
  };

  /** @description Save TTS model settings for Clio */
  const handleSaveModel = async () => {
    const success = await updateTTSModel();
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const hasMoreHistory = voiceHistory.length < voiceHistoryTotal;
  const accordionTitleClass = isPanel
    ? 'flex flex-col items-start gap-1'
    : 'flex items-center gap-2';

  return (
    <div className={isPanel ? 'space-y-3' : 'space-y-4'}>
      {/* Header */}
      <div className={isPanel ? 'flex flex-col items-start gap-1' : 'flex items-center gap-3'}>
        <span className="text-2xl">🎤</span>
        <h2 className="text-display text-xl font-semibold text-content-primary">Voice Testing</h2>
        <span className={`text-content-muted text-sm ${isPanel ? '' : 'ml-auto'}`}>
          {voiceHistoryTotal} generations
        </span>
      </div>

      {/* ElevenLabs Credits Display */}
      <CreditDisplay credits={ttsCredits} />

      {/* TTS Configuration Panel */}
      <TTSConfig
        model={ttsModel}
        onModelChange={setTtsModel}
        stability={ttsStability}
        onStabilityChange={setTtsStability}
        speed={ttsSpeed}
        onSpeedChange={setTtsSpeed}
        saving={ttsSaving}
        saveSuccess={saveSuccess}
        onSave={handleSaveModel}
      />

      {/* Realtime Voice Sessions (OpenAI Realtime / future providers) */}
      <RealtimeSessionPanel isPanel={isPanel} />

      {/* STT Glossary Section */}
      <GlossarySection isPanel={isPanel} />

      {/* TTS Generation Form */}
      <Accordion
        title="Test Voice Generation"
        isOpen={testGenExpanded}
        onToggle={setTestGenExpanded}
        variant="card"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Text Input */}
          <div>
            <label
              htmlFor="tts-text"
              className="block text-sm font-medium text-content-secondary mb-1"
            >
              Text to speak
            </label>
            <textarea
              id="tts-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              rows={3}
              className="input resize-none"
              disabled={loading}
            />
            <div className="mt-1 text-xs text-content-muted">{text.length} characters</div>
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <span>▶</span>
                Generate & Play
              </>
            )}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Generated Audio
            </label>
            <audio ref={audioRef} controls src={audioUrl} className="w-full rounded-lg">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
      </Accordion>

      {/* Voice History Section */}
      <Accordion
        title={(
          <span className={accordionTitleClass}>
            <span>Voice History</span>
            <span className={`text-content-muted text-sm ${isPanel ? '' : 'ml-auto'}`}>{voiceHistoryTotal} total</span>
          </span>
        )}
        isOpen={voiceHistoryExpanded}
        onToggle={setVoiceHistoryExpanded}
        variant="card"
      >
        {voiceHistory.length === 0 ? (
          <div className="text-content-muted text-sm py-4 text-center">
            No voice generations yet
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {voiceHistory.map((item) => (
              <VoiceHistoryCard
                key={item.id}
                item={item}
                isPlaying={voiceHistoryPlayingId === item.id}
                onPlay={() => playVoiceHistoryEntry(item.id)}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMoreHistory && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-secondary w-full mt-3 text-sm disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        )}
      </Accordion>

      {/* Voice Message Corrections Section */}
      <TranscriptionCorrections isPanel={isPanel} />
    </div>
  );
}
