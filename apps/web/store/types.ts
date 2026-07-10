/**
 * Composite Store Type
 *
 * @module store/types
 * @description Composes AppState from all slice interfaces.
 * Each slice exports its own interface; this file unions them
 * into the full store shape used by StateCreator<AppState>.
 *
 * @upstream Imported by: All store slices (for StateCreator generic)
 * @downstream Composed from: All slice interfaces
 */

import type { UISlice } from "./slices/ui";
import type { LightboxSlice } from "./slices/lightbox";
import type { LoopSlice } from "./slices/loop";
import type { LoopActionsSlice } from "./slices/loopActions";
import type { LoopFetchSlice } from "./slices/loopFetch";
import type { ModelSlice } from "./slices/model";
import type { SummarizationSlice } from "./slices/summarization";
import type { SummarizationActionsSlice } from "./slices/summarizationActions";
import type { RagSlice } from "./slices/rag";
import type { PromptSlice } from "./slices/prompt";
import type { ToolsSlice } from "./slices/tools";
import type { DataSlice } from "./slices/data";
import type { ChatSlice } from "./slices/chat";
import type { SummariesSlice } from "./slices/summaries";
import type { GallerySlice } from "./slices/gallery";
import type { EditorSlice } from "./slices/editor";
import type { VoiceSlice } from "./slices/voice";
import type { SIMSlice } from "./slices/sim";

/**
 * AppState — the full shape of the Zustand store.
 *
 * Composed from explicit slice interfaces so that every cross-slice
 * `get()` call is fully typed. If a slice adds or renames a field,
 * TypeScript will catch all downstream breakage at compile time.
 */
export type AppState = UISlice &
  LightboxSlice &
  LoopSlice &
  LoopActionsSlice &
  LoopFetchSlice &
  ModelSlice &
  SummarizationSlice &
  SummarizationActionsSlice &
  RagSlice &
  PromptSlice &
  ToolsSlice &
  DataSlice &
  ChatSlice &
  SummariesSlice &
  GallerySlice &
  EditorSlice &
  VoiceSlice &
  SIMSlice;
