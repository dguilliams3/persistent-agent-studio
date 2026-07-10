/**
 * UI State Slice
 *
 * @module store/slices/ui
 * @description Navigation, lightbox, error display, chat view mode,
 * image preview, and other frontend-only UI state.
 *
 * Split from core.ts during Phase 3 decomposition.
 * Replaces tab navigation with rail-based activeView.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: fetchTabData (data coordination)
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";

/**
 * @description Maps legacy persisted tab ids ('gallery', 'voice', 'monitor') and any
 * invalid/unknown values to current valid ActiveView set. Used for both
 * persist migration (old localStorage) and setActiveTab hardening.
 *
 * @upstream Persisted state from localStorage claude-loop-ui; UI callers of setActiveTab
 * @downstream Store always holds a valid view; UI render branches never see garbage
 */
const LEGACY_TO_VIEW: Record<string, string> = {
  gallery: "media",
  voice: "voice",
  monitor: "sim",
};

const VALID_ACTIVE_VIEWS = new Set<string>([
  "chat",
  "memory",
  "media",
  "editor",
  "voice",
  "settings",
  "sim",
]);

export function normalizeActiveTab(tab: unknown): string {
  if (typeof tab !== "string") return "chat";
  if (VALID_ACTIVE_VIEWS.has(tab)) return tab;
  if (LEGACY_TO_VIEW[tab]) return LEGACY_TO_VIEW[tab];
  return "chat";
}

/** Shape of the last decision entry displayed in the ChatTab. */
export interface DecisionEntry {
  action?: string;
  time?: string;
  internal?: string;
  content?: string;
  [key: string]: unknown;
}

export interface UISlice {
  /** Currently active view: 'chat' | 'memory' | 'media' | 'editor' | 'voice' | 'settings' | 'sim' */
  activeTab: string;
  /** Views that have been visited (for lazy loading). */
  visitedTabs: Set<string>;
  /** True when waiting for Claude response. */
  isThinking: boolean;
  /** Current error message to display, or null. */
  error: string | null;
  /** UI log messages (last 100). */
  log: Array<{ msg: string; time: number }>;
  /** The user's message input field value. */
  userInput: string;
  /** Claude's most recent decision/action. */
  lastDecision: DecisionEntry | null;
  /** Most recent MESSAGE_USER history entry. */
  lastMessageToUserEntry: Record<string, unknown> | null;
  /** Show all history vs limited. */
  showAllHistory: boolean;
  /** Default history limit for display. */
  historyLimit: number;
  /** History type filter for chat display. */
  historyTypeFilter: string;
  /** Chat view mode (kept for compat; new design is chat-only). */
  chatViewMode: string;
  /** Show images inline in history. */
  showImages: boolean;
  /** Blur images until clicked. */
  blurImages: boolean;
  /** Currently selected image for preview. */
  selectedImage: unknown;
  /** Image preview data URL. */
  imagePreview: string | null;
  /** True while converting video to GIF. */
  isConvertingVideo: boolean;

  // --- Setters ---
  setActiveTab: (tab: string) => void;
  setIsThinking: (val: boolean) => void;
  setError: (err: string | null) => void;
  clearError: () => void;
  addLog: (msg: string) => void;
  clearLog: () => void;
  setUserInput: (val: string) => void;
  setLastDecision: (decision: DecisionEntry | null) => void;
  setLastMessageToUserEntry: (entry: Record<string, unknown> | null) => void;
  setShowAllHistory: (val: boolean) => void;
  setHistoryLimit: (limit: number) => void;
  setHistoryTypeFilter: (filter: string) => void;
  setChatViewMode: (mode: string) => void;
  setShowImages: (show: boolean) => void;
  setBlurImages: (blur: boolean) => void;
  setSelectedImage: (image: unknown) => void;
  setImagePreview: (preview: string | null) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (
  set,
  get,
) => ({
  /** Currently active view: 'chat' | 'memory' | 'media' | 'editor' | 'voice' | 'settings' | 'sim' */
  activeTab: "chat",

  /** Views that have been visited (for lazy loading). */
  visitedTabs: new Set(["chat"]),

  /** True when waiting for Claude response. */
  isThinking: false,

  // isLoading lives in data.ts (set by fetchAll).

  /** Current error message to display, or null. */
  error: null,

  /** UI log messages (last 100). */
  log: [] as Array<{ msg: string; time: number }>,

  /** The user's message input field value. */
  userInput: "",

  /** Claude's most recent decision/action. */
  lastDecision: null as DecisionEntry | null,

  /** Most recent MESSAGE_USER history entry. */
  lastMessageToUserEntry: null as Record<string, unknown> | null,

  /** Show all history vs limited. */
  showAllHistory: false,

  /** Default history limit for display. */
  historyLimit: 50,

  /** History type filter for chat display. */
  historyTypeFilter: "all",

  /** Chat view mode (kept for compat; new design is chat-only). */
  chatViewMode: "chat",

  /** Show images inline in history. */
  showImages: false,

  /** Blur images until clicked. */
  blurImages: false,

  /** Currently selected image for preview. */
  selectedImage: null,

  /** Image preview data URL. */
  imagePreview: null,

  /** True while converting video to GIF. */
  isConvertingVideo: false,

  // Lightbox state lives in lightbox.ts (split for 100-line limit)

  // --- Setters ---

  /**
   * @description Set active view/tab. Normalizes legacy values ('gallery'→'media' etc)
   * and unknown values to 'chat' at the write boundary so persisted state and
   * in-memory state cannot contain invalid ids.
   *
   * @upstream IconRail navigation, direct calls, rehydration side-effects
   * @downstream activeTab updated to valid value; may trigger fetchTabData(normalized)
   */
  setActiveTab: (tab: string) => {
    const normalized = normalizeActiveTab(tab);
    const { visitedTabs, fetchTabData } = get();
    // After gallery→media rename, normalized == raw for current keys.
    // Legacy ('gallery' etc) only handled by normalizeActiveTab (persist mappings stay).
    const isFirstVisit = !visitedTabs.has(normalized);
    set((state) => ({
      activeTab: normalized,
      visitedTabs: new Set([...state.visitedTabs, normalized]),
    }));
    if (isFirstVisit && typeof fetchTabData === "function") {
      fetchTabData(normalized);
    }
  },

  setIsThinking: (val: boolean) => set({ isThinking: val }),
  setError: (err: string | null) => set({ error: err }),
  clearError: () => set({ error: null }),

  addLog: (msg: string) =>
    set((s) => ({
      log: [...s.log.slice(-99), { msg, time: Date.now() }],
    })),

  clearLog: () => set({ log: [] }),
  setUserInput: (val: string) => set({ userInput: val }),
  setLastDecision: (decision: DecisionEntry | null) =>
    set({ lastDecision: decision }),
  setLastMessageToUserEntry: (entry: Record<string, unknown> | null) =>
    set({ lastMessageToUserEntry: entry }),
  setShowAllHistory: (val: boolean) => set({ showAllHistory: val }),
  setHistoryLimit: (limit: number) => set({ historyLimit: limit }),
  setHistoryTypeFilter: (filter: string) => set({ historyTypeFilter: filter }),
  setChatViewMode: (mode: string) => set({ chatViewMode: mode }),
  setShowImages: (show: boolean) => set({ showImages: show }),
  setBlurImages: (blur: boolean) => set({ blurImages: blur }),
  setSelectedImage: (image: unknown) => set({ selectedImage: image }),
  setImagePreview: (preview: string | null) => set({ imagePreview: preview }),
  // Lightbox setters/actions live in lightbox.ts
});
