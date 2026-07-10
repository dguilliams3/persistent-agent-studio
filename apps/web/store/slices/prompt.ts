/**
 * Prompt Templates Slice
 *
 * @module store/slices/prompt
 * @description Prompt template CRUD for summarization and meta-summarization.
 * Split from settings.ts during Phase 3 decomposition.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

interface PromptTemplates {
  summarize?: {
    system?: string;
    instructions?: string;
    isCustomSystem?: boolean;
    isCustomInstructions?: boolean;
  };
  meta?: {
    system?: string;
    instructions?: string;
    isCustomSystem?: boolean;
    isCustomInstructions?: boolean;
  };
}

function getPromptTextByType(
  templates: PromptTemplates | null,
  promptType: string,
): string {
  if (!templates) return "";
  switch (promptType) {
    case "summarize_system":
      return templates.summarize?.system || "";
    case "summarize_instructions":
      return templates.summarize?.instructions || "";
    case "meta_system":
      return templates.meta?.system || "";
    case "meta_instructions":
      return templates.meta?.instructions || "";
    default:
      return "";
  }
}

export interface PromptSlice {
  promptTemplates: PromptTemplates | null;
  promptTemplatesLoading: boolean;
  selectedPromptType: string;
  promptEditorText: string;
  promptEditorDirty: boolean;
  promptSaving: boolean;

  fetchPromptTemplates: () => Promise<void>;
  setSelectedPromptType: (promptType: string) => boolean;
  setPromptEditorText: (text: string) => void;
  savePromptTemplate: () => Promise<boolean>;
  resetPromptTemplate: () => Promise<boolean>;
  discardPromptChanges: () => void;
}

export const createPromptSlice: StateCreator<AppState, [], [], PromptSlice> = (
  set,
  get,
) => ({
  promptTemplates: null as PromptTemplates | null,
  promptTemplatesLoading: false,
  selectedPromptType: "summarize_instructions",
  promptEditorText: "",
  promptEditorDirty: false,
  promptSaving: false,

  fetchPromptTemplates: async () => {
    set({ promptTemplatesLoading: true });
    try {
      const d = (await api.get(
        "/summarize-prompts",
      )) as unknown as PromptTemplates;
      set({ promptTemplates: d, promptTemplatesLoading: false });
      const { selectedPromptType } = get();
      set({
        promptEditorText: getPromptTextByType(d, selectedPromptType),
        promptEditorDirty: false,
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch prompt templates:",
        err instanceof Error ? err.message : String(err),
      );
      set({ promptTemplatesLoading: false });
    }
  },

  setSelectedPromptType: (promptType: string) => {
    const { promptTemplates, promptEditorDirty } = get();
    if (promptEditorDirty) return false;
    set({
      selectedPromptType: promptType,
      promptEditorText: getPromptTextByType(
        promptTemplates,
        promptType as string,
      ),
      promptEditorDirty: false,
    });
    return true;
  },

  setPromptEditorText: (text: string) => {
    const { promptTemplates, selectedPromptType } = get();
    const original = getPromptTextByType(promptTemplates, selectedPromptType);
    set({ promptEditorText: text, promptEditorDirty: text !== original });
  },

  savePromptTemplate: async () => {
    const {
      addLog,
      selectedPromptType,
      promptEditorText,
      fetchPromptTemplates,
    } = get();
    set({ promptSaving: true });
    const fieldMap: Record<string, string> = {
      summarize_system: "summarizeSystem",
      summarize_instructions: "summarizeInstructions",
      meta_system: "metaSystem",
      meta_instructions: "metaInstructions",
    };
    try {
      await api.post("/summarize-prompts", {
        [fieldMap[selectedPromptType]]: promptEditorText,
      });
      addLog(`✅ Saved ${selectedPromptType.replace("_", " ")} prompt`);
      await fetchPromptTemplates();
      set({ promptSaving: false, promptEditorDirty: false });
      return true;
    } catch (err: unknown) {
      addLog(
        `❌ Failed to save prompt: ${err instanceof Error ? err.message : String(err)}`,
      );
      set({ promptSaving: false });
      return false;
    }
  },

  resetPromptTemplate: async () => {
    const { addLog, selectedPromptType, fetchPromptTemplates } = get();
    set({ promptSaving: true });
    const fieldMap: Record<string, string> = {
      summarize_system: "summarizeSystem",
      summarize_instructions: "summarizeInstructions",
      meta_system: "metaSystem",
      meta_instructions: "metaInstructions",
    };
    try {
      await api.post("/summarize-prompts", {
        [fieldMap[selectedPromptType]]: null,
      });
      addLog(
        `🔄 Reset ${selectedPromptType.replace("_", " ")} prompt to default`,
      );
      await fetchPromptTemplates();
      set({ promptSaving: false, promptEditorDirty: false });
      return true;
    } catch (err: unknown) {
      addLog(
        `❌ Failed to reset prompt: ${err instanceof Error ? err.message : String(err)}`,
      );
      set({ promptSaving: false });
      return false;
    }
  },

  discardPromptChanges: () => {
    const { promptTemplates, selectedPromptType } = get();
    set({
      promptEditorText: getPromptTextByType(
        promptTemplates,
        selectedPromptType,
      ),
      promptEditorDirty: false,
    });
  },
});
