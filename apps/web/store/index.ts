/**
 * Zustand Global State Store
 *
 * @module store
 * @description Central state management for the React frontend using Zustand.
 * Composes domain-specific slices into a single flat store.
 *
 * Phase 3 decomposition:
 * - core.ts → ui.ts (UI state, navigation, lightbox)
 * - settings.ts → loop.ts, model.ts, summarization.ts, rag.ts, prompt.ts
 * - voice.ts → voice.ts (minus tool registry) + tools.ts
 * - data.ts, chat.ts, summaries.ts, gallery.ts, editor.ts, sim.ts → kept as-is
 *
 * @upstream Called by: All React components needing shared state
 * @downstream Calls: api/client.ts (via slices), Zustand create()
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WORKER_URL } from "../api/client";
import type { AppState } from "./types";

// Slice creators
import { createUISlice, normalizeActiveTab } from "./slices/ui";
import { createLightboxSlice } from "./slices/lightbox";
import { createLoopSlice } from "./slices/loop";
import { createLoopActionsSlice } from "./slices/loopActions";
import { createLoopFetchSlice } from "./slices/loopFetch";
import { createModelSlice } from "./slices/model";
import { createSummarizationSlice } from "./slices/summarization";
import { createSummarizationActionsSlice } from "./slices/summarizationActions";
import { createRagSlice } from "./slices/rag";
import { createPromptSlice } from "./slices/prompt";
import { createToolsSlice } from "./slices/tools";
import { createDataSlice } from "./slices/data";
import { createChatSlice } from "./slices/chat";
import { createSummariesSlice } from "./slices/summaries";
import { createGallerySlice } from "./slices/gallery";
import { createEditorSlice } from "./slices/editor";
import { createVoiceSlice } from "./slices/voice";
import { createSIMSlice } from "./slices/sim";

// Re-export AppState for consumers
export type { AppState } from "./types";

// =============================================================================
// STORE COMPOSITION
// =============================================================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get, store) =>
      ({
        // Phase 3 decomposed slices (replace core.ts + settings.ts)
        ...createUISlice(set, get, store),
        ...createLightboxSlice(set, get, store),
        ...createLoopSlice(set, get, store),
        ...createLoopActionsSlice(set, get, store),
        ...createLoopFetchSlice(set, get, store),
        ...createModelSlice(set, get, store),
        ...createSummarizationSlice(set, get, store),
        ...createSummarizationActionsSlice(set, get, store),
        ...createRagSlice(set, get, store),
        ...createPromptSlice(set, get, store),
        ...createToolsSlice(set, get, store),

        // Existing slices (to be further decomposed in future phases)
        ...createDataSlice(set, get, store),
        ...createChatSlice(set, get, store),
        ...createSummariesSlice(set, get, store),
        ...createGallerySlice(set, get, store),
        ...createEditorSlice(set, get, store),
        ...createVoiceSlice(set, get, store),
        ...createSIMSlice(set, get, store),
      }) as AppState,
    {
      name: "claude-loop-ui",
      version: 2,
      /**
       * Migrate function for zustand persist.
       * Handles legacy activeTab values stored before the view overhaul
       * ('gallery' | 'voice' | 'monitor') and any other garbage → valid ActiveView.
       * Bumped version so this runs on first load after deploy for users with old localStorage.
       *
       * @upstream localStorage['claude-loop-ui'] (partialized activeTab only)
       * @downstream Rehydrated state has safe activeTab; AppShell never receives invalid view
       */
      migrate: (persistedState: unknown, _version: number) => {
        if (persistedState && typeof persistedState === "object") {
          const state = persistedState as { activeTab?: unknown };
          if (state.activeTab !== undefined) {
            state.activeTab = normalizeActiveTab(state.activeTab);
          }
        }
        return persistedState;
      },
      partialize: (state: AppState) => ({
        activeTab: state.activeTab,
      }),
    },
  ),
);

// =============================================================================
// UTILITY FUNCTIONS (exported separately from store)
// =============================================================================

/**
 * @description Resolve media internal value to a displayable URL.
 * Handles both base64 data URLs and R2 references transparently.
 *
 * R2 URLs carry the JWT as a ?token= query param: <img> elements cannot send
 * an Authorization header, and /media/* is auth-gated on the worker — without
 * the param every R2-backed thumbnail 401s (the "Media tab fails" bug,
 * RUN-20260704-1520). The worker accepts the param for GET /media/* only.
 */
export function resolveMediaUrl(
  internal: string | null | undefined,
): string | null {
  if (!internal) return null;
  if (internal.startsWith("data:")) return internal;
  if (internal.startsWith("r2://")) {
    const key = internal.slice(5);
    const token = typeof localStorage !== "undefined"
      ? localStorage.getItem("auth_token")
      : null;
    const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
    return `${WORKER_URL}/media/${key}${suffix}`;
  }
  return internal;
}

/**
 * Test-only export of the migration applicator.
 * Allows direct verification that persisted legacy state is transformed
 * without needing to simulate full storage rehydration.
 *
 * @upstream Test code in store.test.js
 * @downstream Proves 'gallery'→'media', 'voice'→'voice', 'monitor'→'sim', invalid→'chat'
 */
export function __migratePersistedState(persistedState: unknown, version: number): unknown {
  if (persistedState && typeof persistedState === "object") {
    const state = persistedState as { activeTab?: unknown };
    if (state.activeTab !== undefined) {
      state.activeTab = normalizeActiveTab(state.activeTab);
    }
  }
  return persistedState;
}

export default useAppStore;
