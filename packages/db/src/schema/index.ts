/**
 * Schema barrel — re-exports all table definitions from domain-scoped schema files.
 *
 * This is the single import point for drizzle-kit and the db client.
 *
 * @downstream drizzle-kit generate — reads all exports to produce migrations
 * @downstream db client — `import * as schema` for typed queries
 * @invariant Every table defined in schema/*.ts MUST be re-exported here
 * @coupling drizzle.config.ts — points to this directory
 */
import type { InferSelectModel } from "drizzle-orm";

import { personas } from "./personas";
import { history } from "./history";
import { summaries } from "./summaries";
import { coldStorage } from "./cold-storage";
import { notebook } from "./notebook";
import { cycles } from "./cycles";
import { state } from "./state";
import { config } from "./config";
import { reminders } from "./reminders";
import { observations } from "./observations";
import { learned } from "./learned";
import { questions } from "./questions";
import { imageAssets } from "./image-assets";
import { pinnedImages } from "./pinned-images";
import { pendingViewImages } from "./pending-view-images";
import { voiceHistory } from "./voice-history";
import { voiceTranscriptions } from "./voice-transcriptions";
import { memoryBranches } from "./memory-branches";
import { memoryOverrides } from "./memory-overrides";
import { syntheticMemories } from "./synthetic-memories";
import { simConceptAxes } from "./sim-concept-axes";
import { simAxisScores } from "./sim-axis-scores";
import { simBasinMetrics } from "./sim-basin-metrics";
import { simAnomalyFlags } from "./sim-anomaly-flags";
import { promptComponents } from "./prompt-components";
import { glossary } from "./glossary";
import { pendingBatches } from "./pending-batches";

// Re-export all tables
export {
  personas,
  history,
  summaries,
  coldStorage,
  notebook,
  cycles,
  state,
  config,
  reminders,
  observations,
  learned,
  questions,
  imageAssets,
  pinnedImages,
  pendingViewImages,
  voiceHistory,
  voiceTranscriptions,
  memoryBranches,
  memoryOverrides,
  syntheticMemories,
  simConceptAxes,
  simAxisScores,
  simBasinMetrics,
  simAnomalyFlags,
  promptComponents,
  glossary,
  pendingBatches,
};

// InferSelectModel types — domain types derived from schema
export type Persona = InferSelectModel<typeof personas>;
export type HistoryEntry = InferSelectModel<typeof history>;
export type Summary = InferSelectModel<typeof summaries>;
export type ColdStorageEntry = InferSelectModel<typeof coldStorage>;
export type NotebookEntry = InferSelectModel<typeof notebook>;
export type Cycle = InferSelectModel<typeof cycles>;
export type StateEntry = InferSelectModel<typeof state>;
export type ConfigEntry = InferSelectModel<typeof config>;
export type Reminder = InferSelectModel<typeof reminders>;
export type Observation = InferSelectModel<typeof observations>;
export type LearnedEntry = InferSelectModel<typeof learned>;
export type Question = InferSelectModel<typeof questions>;
export type ImageAsset = InferSelectModel<typeof imageAssets>;
export type PinnedImage = InferSelectModel<typeof pinnedImages>;
export type PendingViewImage = InferSelectModel<typeof pendingViewImages>;
export type VoiceHistoryEntry = InferSelectModel<typeof voiceHistory>;
export type VoiceTranscription = InferSelectModel<typeof voiceTranscriptions>;
export type MemoryBranch = InferSelectModel<typeof memoryBranches>;
export type MemoryOverride = InferSelectModel<typeof memoryOverrides>;
export type SyntheticMemory = InferSelectModel<typeof syntheticMemories>;
export type SimConceptAxis = InferSelectModel<typeof simConceptAxes>;
export type SimAxisScore = InferSelectModel<typeof simAxisScores>;
export type SimBasinMetric = InferSelectModel<typeof simBasinMetrics>;
export type SimAnomalyFlag = InferSelectModel<typeof simAnomalyFlags>;
export type PromptComponent = InferSelectModel<typeof promptComponents>;
export type GlossaryEntry = InferSelectModel<typeof glossary>;
export type PendingBatch = InferSelectModel<typeof pendingBatches>;
