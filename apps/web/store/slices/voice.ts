/**
 * Voice/TTS State Slice
 *
 * @module store/slices/voice
 * @description Zustand store slice for voice and TTS-related state management.
 * Manages voice history (pagination, playback), TTS configuration (model,
 * stability, speed, ElevenLabs credits), and realtime voice session control.
 *
 * Extracted from main store to reduce monolithic file size and improve
 * maintainability. Uses slice pattern for Zustand composition.
 *
 * @upstream Called by:
 *   - store/index.js - Spread into main store via createVoiceSlice()
 * @downstream Calls:
 *   - api/client.js - API calls (get, post, fetchRaw)
 *   - /voice-history endpoint (GET)
 *   - /voice-history/:id/audio endpoint (GET via fetchRaw for blob)
 *   - /tts-model endpoint (GET/POST)
 *   - /tts-credits endpoint (GET)
 *   - /voice/realtime/start endpoint (POST)
 *   - /voice/realtime/end endpoint (POST)
 *
 * @example
 * // In main store:
 * import { createVoiceSlice } from './slices/voice';
 * export const useAppStore = create<AppState>()((set, get) => ({
 *   ...createVoiceSlice(set, get),
 * }));
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api, { getAdminPassword } from "../../api/client";

// =============================================================================
// HELPER INTERFACES
// =============================================================================

/** Voice history entry from /voice-history endpoint */
export interface VoiceHistoryItem {
  id: number;
  created_at: string;
  model: string;
  stability: number | null;
  char_count: number;
  text: string;
}

/** Voice transcription entry from /voice-transcriptions endpoint */
export interface VoiceTranscriptionItem {
  id: number;
  created_at: string;
  raw_transcription: string;
  corrected_text: string | null;
  corrected_emotion: string | null;
  detected_emotion: string | null;
  audio_duration: number | null;
}

/** ElevenLabs TTS credit usage info */
export interface TTSCredits {
  used: number;
  limit: number;
  remaining: number;
  resetUnix: number;
  tier: string;
}

/** Options for starting a realtime voice session */
export interface RealtimeSessionOptions {
  provider?: string;
  model?: string;
  seedMode?: string;
  includeSystemPrompt?: boolean;
  includeBlocks?: boolean;
  sessionLabel?: string;
}

// =============================================================================
// SLICE INTERFACE
// =============================================================================

export interface VoiceSlice {
  // Voice History State
  voiceHistory: VoiceHistoryItem[];
  voiceHistoryTotal: number;
  voiceHistoryOffset: number;
  voiceHistoryAudio: HTMLAudioElement | null;
  voiceHistoryPlayingId: number | null;
  voiceHistoryExpanded: boolean;

  // TTS Config State
  ttsModel: string;
  ttsStability: number;
  ttsSpeed: number;
  ttsSaving: boolean;
  ttsCredits: TTSCredits | null;

  // STT Glossary State
  glossaryEntries: unknown[];
  glossaryLoading: boolean;

  // Voice Transcriptions State
  voiceTranscriptions: VoiceTranscriptionItem[];
  voiceTranscriptionsTotal: number;
  voiceTranscriptionsLoading: boolean;

  // Realtime Voice Session State
  realtimeSession: unknown;
  realtimeSessionLoading: boolean;
  realtimeSessionError: string | null;

  // Voice History Setters
  setVoiceHistory: (history: VoiceHistoryItem[]) => void;
  setVoiceHistoryTotal: (total: number) => void;
  setVoiceHistoryOffset: (offset: number) => void;
  setVoiceHistoryAudio: (audio: HTMLAudioElement | null) => void;
  setVoiceHistoryPlayingId: (id: number | null) => void;
  setVoiceHistoryExpanded: (expanded: boolean) => void;

  // TTS Config Setters
  setTtsModel: (model: string) => void;
  setTtsStability: (stability: number) => void;
  setTtsSpeed: (speed: number) => void;
  setTtsSaving: (saving: boolean) => void;
  setTtsCredits: (credits: TTSCredits | null) => void;

  // STT Glossary Setters
  setGlossaryEntries: (entries: unknown[]) => void;
  setGlossaryLoading: (loading: boolean) => void;

  // Voice Transcriptions Setters
  setVoiceTranscriptions: (transcriptions: VoiceTranscriptionItem[]) => void;
  setVoiceTranscriptionsTotal: (total: number) => void;
  setVoiceTranscriptionsLoading: (loading: boolean) => void;

  // Realtime Voice Session Setters
  setRealtimeSession: (session: unknown) => void;
  setRealtimeSessionLoading: (loading: boolean) => void;
  setRealtimeSessionError: (error: string | null) => void;

  // Voice History Actions
  fetchVoiceHistory: (append?: boolean) => Promise<void>;
  playVoiceHistoryEntry: (id: number) => Promise<void>;
  stopVoiceHistoryPlayback: () => void;

  // TTS Config Actions
  fetchTTSModel: () => Promise<void>;
  updateTTSModel: () => Promise<boolean>;
  fetchTTSCredits: () => Promise<void>;

  // STT Glossary Actions
  fetchGlossary: () => Promise<void>;
  addGlossaryEntry: (
    wrongForm: string,
    correctForm: string,
    category?: string,
  ) => Promise<boolean>;
  deleteGlossaryEntry: (id: number) => Promise<boolean>;

  // Voice Transcriptions Actions
  fetchVoiceTranscriptions: (options?: {
    limit?: string;
    needsCorrection?: boolean;
  }) => Promise<void>;
  updateVoiceTranscription: (
    id: number,
    corrections: { correctedText?: string; correctedEmotion?: string },
  ) => Promise<boolean>;

  // Realtime Voice Session Actions
  startRealtimeSession: (options?: RealtimeSessionOptions) => Promise<unknown>;
  endRealtimeSession: (options?: {
    sessionId?: string;
    reason?: string;
  }) => Promise<unknown>;
}

/**
 * @description Create voice/TTS state slice for Zustand store
 *
 * @upstream Called by: store/index.js
 * @downstream Calls: API client, Browser Audio API
 * @example
 * const voiceSlice = createVoiceSlice(set, get);
 * // Returns: { voiceHistory: [], fetchVoiceHistory: async () => {...}, ... }
 */
export const createVoiceSlice: StateCreator<AppState, [], [], VoiceSlice> = (
  set,
  get,
) => ({
  // ===========================================================================
  // VOICE HISTORY STATE
  // ===========================================================================

  /** @type {Array<VoiceHistoryItem>} Voice history entries from /voice-history endpoint */
  voiceHistory: [] as VoiceHistoryItem[],

  /** @type {number} Total count of voice history entries */
  voiceHistoryTotal: 0,

  /** @type {number} Current offset for voice history pagination */
  voiceHistoryOffset: 0,

  /** @type {HTMLAudioElement|null} Currently playing voice history audio */
  voiceHistoryAudio: null as HTMLAudioElement | null,

  /** @type {number|null} ID of currently playing voice history entry */
  voiceHistoryPlayingId: null as number | null,

  /** @type {boolean} Whether voice history section is expanded */
  voiceHistoryExpanded: true,

  // ===========================================================================
  // TTS CONFIG STATE
  // ===========================================================================

  /** @type {string} TTS model: 'v2' | 'v3' | 'flash' | 'turbo' */
  ttsModel: "v2",

  /** @type {number} TTS stability for v3: 0 (Creative), 0.5 (Natural), 1 (Robust) */
  ttsStability: 0.5,

  /** @type {number} TTS speed: 0.7 - 1.2 */
  ttsSpeed: 1.0,

  /** @type {boolean} Whether TTS settings are being saved */
  ttsSaving: false,

  /** @type {Object|null} ElevenLabs credit info: { used, limit, remaining, resetUnix, tier } */
  ttsCredits: null as TTSCredits | null,

  // ===========================================================================
  // STT GLOSSARY STATE
  // ===========================================================================

  /** @type {Array<Object>} STT glossary entries from /glossary endpoint */
  glossaryEntries: [] as unknown[],

  /** @type {boolean} Whether glossary is loading */
  glossaryLoading: false,

  // ===========================================================================
  // VOICE TRANSCRIPTIONS STATE (for correction training)
  // ===========================================================================

  /** @type {Array<VoiceTranscriptionItem>} Voice transcriptions from /voice-transcriptions endpoint */
  voiceTranscriptions: [] as VoiceTranscriptionItem[],

  /** @type {number} Total count of voice transcriptions */
  voiceTranscriptionsTotal: 0,

  /** @type {boolean} Whether transcriptions are loading */
  voiceTranscriptionsLoading: false,

  // ===========================================================================
  // REALTIME VOICE SESSION STATE
  // ===========================================================================

  /**
   * @type {Object|null} Active realtime session data from /voice/realtime/start
   * Includes provider/model metadata, seed summary, and provider session payload.
   */
  realtimeSession: null as unknown,

  /** @type {boolean} Whether realtime session start/end is in progress */
  realtimeSessionLoading: false,

  /**
   * @type {string|null} Last realtime session error (for UI feedback)
   * This is intentionally string-only to keep UI simple and LLM-friendly.
   */
  realtimeSessionError: null as string | null,

  // Tool registry moved to slices/tools.ts during Phase 3 decomposition.

  // ===========================================================================
  // VOICE HISTORY SETTERS
  // ===========================================================================

  /** @description Set voice history array */
  setVoiceHistory: (history: VoiceHistoryItem[]) =>
    set({ voiceHistory: history }),

  /** @description Set total voice history count */
  setVoiceHistoryTotal: (total: number) => set({ voiceHistoryTotal: total }),

  /** @description Set pagination offset */
  setVoiceHistoryOffset: (offset: number) =>
    set({ voiceHistoryOffset: offset }),

  /** @description Set currently playing audio element */
  setVoiceHistoryAudio: (audio: HTMLAudioElement | null) =>
    set({ voiceHistoryAudio: audio }),

  /** @description Set playing entry ID */
  setVoiceHistoryPlayingId: (id: number | null) =>
    set({ voiceHistoryPlayingId: id }),

  /** @description Toggle voice history section expansion */
  setVoiceHistoryExpanded: (expanded: boolean) =>
    set({ voiceHistoryExpanded: expanded }),

  // ===========================================================================
  // TTS CONFIG SETTERS
  // ===========================================================================

  /** @description Set TTS model */
  setTtsModel: (model: string) => set({ ttsModel: model }),

  /** @description Set TTS v3 stability */
  setTtsStability: (stability: number) => set({ ttsStability: stability }),

  /** @description Set TTS playback speed */
  setTtsSpeed: (speed: number) => set({ ttsSpeed: speed }),

  /** @description Set saving state flag */
  setTtsSaving: (saving: boolean) => set({ ttsSaving: saving }),

  /** @description Set ElevenLabs credits info */
  setTtsCredits: (credits: TTSCredits | null) => set({ ttsCredits: credits }),

  // ===========================================================================
  // STT GLOSSARY SETTERS
  // ===========================================================================

  /** @description Set glossary entries array */
  setGlossaryEntries: (entries: unknown[]) => set({ glossaryEntries: entries }),

  /** @description Set glossary loading state */
  setGlossaryLoading: (loading: boolean) => set({ glossaryLoading: loading }),

  // ===========================================================================
  // VOICE TRANSCRIPTIONS SETTERS
  // ===========================================================================

  /** @description Set voice transcriptions array */
  setVoiceTranscriptions: (transcriptions: VoiceTranscriptionItem[]) =>
    set({ voiceTranscriptions: transcriptions }),

  /** @description Set voice transcriptions total count */
  setVoiceTranscriptionsTotal: (total: number) =>
    set({ voiceTranscriptionsTotal: total }),

  /** @description Set voice transcriptions loading state */
  setVoiceTranscriptionsLoading: (loading: boolean) =>
    set({ voiceTranscriptionsLoading: loading }),

  // ===========================================================================
  // REALTIME VOICE SESSION SETTERS
  // ===========================================================================

  /** @description Set the active realtime session payload */
  setRealtimeSession: (session: unknown) => set({ realtimeSession: session }),

  /** @description Set realtime session loading flag */
  setRealtimeSessionLoading: (loading: boolean) =>
    set({ realtimeSessionLoading: loading }),

  /** @description Set realtime session error string */
  setRealtimeSessionError: (error: string | null) =>
    set({ realtimeSessionError: error }),

  // ===========================================================================
  // VOICE HISTORY ASYNC ACTIONS
  // ===========================================================================

  /**
   * @description Fetch voice history with pagination support
   *
   * @upstream Called by: VoiceTab/index.jsx (on mount, load more)
   * @downstream Calls: /voice-history endpoint
   *
   * @returns Promise<void>
   */
  fetchVoiceHistory: async (append = false) => {
    const { voiceHistoryOffset } = get();
    const offset = append ? voiceHistoryOffset : 0;

    try {
      const data = (await api.get(
        `/voice-history?limit=10&offset=${offset}`,
      )) as Record<string, unknown>;
      const items = (
        Array.isArray(data.items) ? data.items : []
      ) as VoiceHistoryItem[];

      if (append) {
        set((state) => ({
          voiceHistory: [...state.voiceHistory, ...items],
          voiceHistoryOffset: state.voiceHistoryOffset + items.length,
        }));
      } else {
        set({
          voiceHistory: items,
          voiceHistoryOffset: items.length,
        });
      }
      set({ voiceHistoryTotal: (data.total as number) || 0 });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch voice history:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Play or stop a voice history entry
   *
   * @upstream Called by: VoiceTab/index.jsx (history card click)
   * @downstream Calls: /voice-history/:id/audio endpoint, Browser Audio API
   *
   * @param id - Voice history entry ID
   * @returns Promise<void>
   */
  playVoiceHistoryEntry: async (id: number) => {
    const {
      voiceHistoryAudio,
      voiceHistoryPlayingId,
      setVoiceHistoryAudio,
      setVoiceHistoryPlayingId,
    } = get();

    // If same entry is playing, stop it
    if (voiceHistoryPlayingId === id && voiceHistoryAudio) {
      voiceHistoryAudio.pause();
      setVoiceHistoryAudio(null);
      setVoiceHistoryPlayingId(null);
      return;
    }

    // Stop any currently playing audio
    if (voiceHistoryAudio) {
      voiceHistoryAudio.pause();
    }

    try {
      const response = await api.fetchRaw(`/voice-history/${id}/audio`);
      if (!response.ok) throw new Error("Failed to fetch audio");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setVoiceHistoryAudio(null);
        setVoiceHistoryPlayingId(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setVoiceHistoryAudio(null);
        setVoiceHistoryPlayingId(null);
        URL.revokeObjectURL(audioUrl);
      };

      setVoiceHistoryAudio(audio);
      setVoiceHistoryPlayingId(id);
      audio.play();
    } catch (err: unknown) {
      console.error(
        "Failed to play voice history:",
        err instanceof Error ? err.message : String(err),
      );
      setVoiceHistoryAudio(null);
      setVoiceHistoryPlayingId(null);
    }
  },

  /**
   * @description Stop currently playing voice history audio
   *
   * @upstream Called by: VoiceTab/index.jsx (cleanup on unmount)
   * @downstream Calls: Browser Audio API
   *
   * @returns void
   */
  stopVoiceHistoryPlayback: () => {
    const {
      voiceHistoryAudio,
      setVoiceHistoryAudio,
      setVoiceHistoryPlayingId,
    } = get();
    if (voiceHistoryAudio) {
      voiceHistoryAudio.pause();
      setVoiceHistoryAudio(null);
      setVoiceHistoryPlayingId(null);
    }
  },

  // ===========================================================================
  // TTS CONFIG ASYNC ACTIONS
  // ===========================================================================

  /**
   * @description Fetch TTS model configuration from backend
   *
   * @upstream Called by: VoiceTab/index.jsx (on mount)
   * @downstream Calls: /tts-model endpoint (GET)
   *
   * @returns Promise<void>
   */
  fetchTTSModel: async () => {
    try {
      const data = (await api.get("/tts-model")) as Record<string, unknown>;
      set({
        ttsModel: (data.model as string) || "v2",
        ttsStability: (data.stability as number) ?? 0.5,
        ttsSpeed: (data.speed as number) ?? 1.0,
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch TTS model:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Update TTS model configuration (persists to Clio's settings)
   *
   * @upstream Called by: VoiceTab/index.jsx (save button)
   * @downstream Calls: /tts-model endpoint (POST), addLog (via get())
   *
   * @returns Success status
   *
   * @note Uses get() to access addLog from main store slice
   */
  updateTTSModel: async () => {
    const { ttsModel, ttsStability, ttsSpeed, setTtsSaving, addLog } = get();
    setTtsSaving(true);

    try {
      const body: { model: string; speed: number; stability?: number } = {
        model: ttsModel,
        speed: ttsSpeed,
      };
      if (ttsModel === "v3") {
        body.stability = ttsStability;
      }

      await api.post("/tts-model", body);

      const stabilityNames: Record<number, string> = {
        0: "Creative",
        0.5: "Natural",
        1: "Robust",
      };
      const stabilityStr =
        ttsModel === "v3"
          ? ` (${stabilityNames[ttsStability] || "Natural"})`
          : "";
      const speedStr = ttsSpeed !== 1.0 ? ` @ ${ttsSpeed.toFixed(2)}x` : "";
      addLog(`TTS model set to ${ttsModel}${stabilityStr}${speedStr}`);
      return true;
    } catch (err: unknown) {
      addLog(
        `Failed to update TTS model: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    } finally {
      setTtsSaving(false);
    }
  },

  /**
   * @description Fetch ElevenLabs TTS credits usage
   *
   * @upstream Called by: VoiceTab/index.jsx (on mount)
   * @downstream Calls: /tts-credits endpoint (GET)
   *
   * @returns Promise<void>
   */
  fetchTTSCredits: async () => {
    try {
      const data = (await api.get("/tts-credits")) as Record<string, unknown>;
      if (data.success) {
        set({
          ttsCredits: {
            used: data.character_count as number,
            limit: data.character_limit as number,
            remaining: data.characters_remaining as number,
            resetUnix: data.next_reset_unix as number,
            tier: data.tier as string,
          },
        });
      }
    } catch (err: unknown) {
      console.error(
        "Failed to fetch TTS credits:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  // ===========================================================================
  // STT GLOSSARY ASYNC ACTIONS
  // ===========================================================================

  /**
   * @description Fetch all STT glossary entries
   *
   * @upstream Called by: VoiceTab/GlossarySection (on mount)
   * @downstream Calls: /glossary endpoint (GET)
   *
   * @returns Promise<void>
   */
  fetchGlossary: async () => {
    set({ glossaryLoading: true });
    try {
      const data = (await api.get("/glossary")) as Record<string, unknown>;
      set({ glossaryEntries: (data.entries as unknown[]) || [] });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch glossary:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      set({ glossaryLoading: false });
    }
  },

  /**
   * @description Add a new STT glossary entry
   *
   * @upstream Called by: VoiceTab/GlossarySection (form submit)
   * @downstream Calls: /glossary endpoint (POST), fetchGlossary
   *
   * @param wrongForm - What STT typically outputs (e.g., "Macy")
   * @param correctForm - What it should be (e.g., "Kasey")
   * @param [category='name'] - Category: 'name', 'term', or 'phrase'
   * @returns Success status
   */
  addGlossaryEntry: async (
    wrongForm: string,
    correctForm: string,
    category = "name",
  ) => {
    const { fetchGlossary, addLog } = get();
    try {
      await api.post("/glossary", {
        wrong_form: wrongForm,
        correct_form: correctForm,
        category,
      });
      addLog(`Added glossary: "${wrongForm}" → "${correctForm}"`);
      await fetchGlossary();
      return true;
    } catch (err: unknown) {
      addLog(
        `Failed to add glossary entry: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  },

  /**
   * @description Delete an STT glossary entry
   *
   * @upstream Called by: VoiceTab/GlossarySection (delete button)
   * @downstream Calls: /glossary/:id endpoint (DELETE), fetchGlossary
   *
   * @param id - Entry ID to delete
   * @returns Success status
   */
  deleteGlossaryEntry: async (id: number) => {
    const { fetchGlossary, addLog } = get();
    try {
      const adminPassword = getAdminPassword();
      if (!adminPassword) {
        addLog("Admin password required to delete glossary entries");
        return false;
      }

      await api.delete(`/glossary/${id}`, { password: adminPassword });
      addLog("Deleted glossary entry");
      await fetchGlossary();
      return true;
    } catch (err: unknown) {
      addLog(
        `Failed to delete glossary entry: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  },

  // ===========================================================================
  // VOICE TRANSCRIPTIONS ASYNC ACTIONS
  // ===========================================================================

  /**
   * @description Fetch voice transcriptions for correction training
   *
   * @upstream Called by: VoiceTab/TranscriptionCorrections (on mount)
   * @downstream Calls: /voice-transcriptions endpoint (GET)
   *
   * @param [options] - Query options
   * @param [options.limit=20] - Max entries to return
   * @param [options.needsCorrection] - Only entries without corrections
   * @returns Promise<void>
   */
  fetchVoiceTranscriptions: async (
    options: { limit?: string; needsCorrection?: boolean } = {},
  ) => {
    set({ voiceTranscriptionsLoading: true });
    try {
      const params = new URLSearchParams();
      if (options.limit) params.set("limit", options.limit);
      if (options.needsCorrection) params.set("needsCorrection", "true");
      const data = (await api.get(
        `/voice-transcriptions?${params.toString()}`,
      )) as Record<string, unknown>;
      set({
        voiceTranscriptions: (data.items as VoiceTranscriptionItem[]) || [],
        voiceTranscriptionsTotal: (data.total as number) || 0,
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch voice transcriptions:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      set({ voiceTranscriptionsLoading: false });
    }
  },

  /**
   * @description Update a voice transcription with user corrections
   *
   * @upstream Called by: VoiceTab/TranscriptionCorrections (save button)
   * @downstream Calls: /voice-transcriptions/:id endpoint (PUT), fetchVoiceTranscriptions
   *
   * @param id - Transcription ID
   * @param corrections - Correction data
   * @param [corrections.correctedText] - User's corrected transcription
   * @param [corrections.correctedEmotion] - User's corrected emotion
   * @returns Success status
   */
  updateVoiceTranscription: async (
    id: number,
    corrections: { correctedText?: string; correctedEmotion?: string },
  ) => {
    const { fetchVoiceTranscriptions, addLog } = get();
    try {
      await api.put(`/voice-transcriptions/${id}`, {
        corrected_text: corrections.correctedText,
        corrected_emotion: corrections.correctedEmotion,
      });
      addLog("Saved transcription correction");
      await fetchVoiceTranscriptions();
      return true;
    } catch (err: unknown) {
      addLog(
        `Failed to save correction: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  },

  // ===========================================================================
  // REALTIME VOICE SESSION ACTIONS
  // ===========================================================================

  /**
   * @description Start a realtime voice session via the worker API
   *
   * WHY: This creates a lightweight, UI-driven entrypoint for E2E testing
   * without requiring Telegram commands, so a user can verify provider setup
   * and retrieve a client_secret directly in the Voice tab.
   *
   * @upstream Called by: VoiceTab/RealtimeSessionPanel (Start button)
   * @downstream Calls: /voice/realtime/start endpoint (POST)
   *
   * @param options - Session options forwarded to the worker
   * @param [options.provider] - Provider identifier (e.g., "openai")
   * @param [options.model] - Realtime model ID
   * @param [options.seedMode] - "full" or "compact"
   * @param [options.includeSystemPrompt] - Include system prompt seed
   * @param [options.includeBlocks] - Include block breakdown
   * @param [options.sessionLabel] - Optional source tag for history logs
   * @returns Session result or null on failure
   *
   * @note On failure, realtimeSessionError is populated for UI display.
   */
  startRealtimeSession: async (options: RealtimeSessionOptions = {}) => {
    const {
      setRealtimeSession,
      setRealtimeSessionLoading,
      setRealtimeSessionError,
    } = get();

    setRealtimeSessionLoading(true);
    setRealtimeSessionError(null);

    try {
      const payload = {
        ...options,
        sessionLabel: options.sessionLabel || "web-ui",
      };
      const result = await api.post("/voice/realtime/start", payload);
      setRealtimeSession(result);
      return result;
    } catch (err: unknown) {
      const apiErr = err as {
        data?: { error?: string };
        message?: string;
      };
      const message =
        apiErr?.data?.error ||
        (err instanceof Error ? err.message : String(err)) ||
        "Realtime session start failed";
      console.error("Failed to start realtime session:", message);
      setRealtimeSession(null);
      setRealtimeSessionError(message);
      return null;
    } finally {
      setRealtimeSessionLoading(false);
    }
  },

  /**
   * @description End a realtime voice session via the worker API
   *
   * WHY: We want the session termination event to be explicit so the
   * history timeline can store a clear end marker and optional cost summary.
   *
   * @upstream Called by: VoiceTab/RealtimeSessionPanel (End button)
   * @downstream Calls: /voice/realtime/end endpoint (POST)
   *
   * @param options - End options
   * @param options.sessionId - Session identifier to close
   * @param [options.reason] - Optional end reason
   * @returns End result or null on failure
   */
  endRealtimeSession: async ({
    sessionId,
    reason = "completed",
  }: { sessionId?: string; reason?: string } = {}) => {
    const { setRealtimeSessionLoading, setRealtimeSessionError } = get();

    if (!sessionId) {
      setRealtimeSessionError("Session ID is required to end a realtime call.");
      return null;
    }

    setRealtimeSessionLoading(true);
    setRealtimeSessionError(null);

    try {
      const result = await api.post("/voice/realtime/end", {
        sessionId,
        reason,
      });
      return result;
    } catch (err: unknown) {
      const apiErr = err as {
        data?: { error?: string };
        message?: string;
      };
      const message =
        apiErr?.data?.error ||
        (err instanceof Error ? err.message : String(err)) ||
        "Realtime session end failed";
      console.error("Failed to end realtime session:", message);
      setRealtimeSessionError(message);
      return null;
    } finally {
      setRealtimeSessionLoading(false);
    }
  },

  // fetchToolRegistry moved to slices/tools.ts during Phase 3 decomposition.
});
