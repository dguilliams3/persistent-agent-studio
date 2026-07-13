/**
 * @persistence/db - Database adapters and helpers
 *
 * @description
 * Database layer providing persona-aware CRUD operations,
 * migrations, and Drizzle ORM query builder for all tables.
 *
 * The primary database client type exported here is DrizzleD1 (from ./client),
 * which is the Drizzle-wrapped D1 binding. It is NOT an alias for Cloudflare's
 * D1Database type. All db parameters throughout the system should be typed as
 * DrizzleD1.
 *
 * @upstream worker fetch/scheduled handlers
 * @downstream Cloudflare D1 database via env.DB binding, accessed through DrizzleD1
 *
 * @example
 * import { getHistory, getActivePersonaId } from '@persistence/db';
 * import type { DrizzleD1 } from '@persistence/db';
 * import { runRuntimeMigrations } from '@persistence/db/migrations/runtime';
 */

// =============================================================================
// PERSONA ABSTRACTION (Core Layer)
// =============================================================================
// These functions form the foundation for multi-persona database isolation.
// All persona-aware functions build on these primitives.
// =============================================================================
export {
  // Types
  type PersonaOptions,
  type PersonaRecord,
  type ForkPersonaOptions,
  type ForkPersonaResult,
  type ForkPersonaError,
  // Functions
  getActivePersonaId,
  setActivePersonaId,
  getPersona,
  listPersonas,
  createPersona,
  derivePersonaSlug,
  resetPersonaCache,
  forkPersona,
} from "./personas";

export { type DrizzleD1, createDrizzleClient } from "./client";

// =============================================================================
// STATE TABLE
// =============================================================================
// Key-value store for runtime configuration and state.
// =============================================================================
export { getState, setState } from "./state";
export {
  queueQuickFollowup,
  type QueueQuickFollowupOptions,
  type QueueQuickFollowupResult,
} from "./quick-followup";

// =============================================================================
// HISTORY TABLE
// =============================================================================
// Chronological conversation timeline - every thought, message, action.
// =============================================================================
export {
  type HistoryEntry,
  type AddHistoryOptions,
  getHistory,
  addHistory,
  deleteOldestHistory,
  deleteHistoryByIds,
  getHistoryForContext,
  getOldestHistory,
  parseDbTimestamp,
  getHistoryCount,
} from "./history";

// =============================================================================
// HISTORY LOGGER (High-level API)
// =============================================================================
// Standardized history logging with type validation, error handling, and batch support.
// This is the recommended API for tool handlers and action executors.
// =============================================================================
export {
  HISTORY_TYPES,
  EMBEDDABLE_TYPES,
  EMBEDDING_EXCLUDED_TYPES,
  type HistoryType,
  type LogHistoryParams,
  type LogHistoryBatchParams,
  type LogOperationResultParams,
  logHistory,
  logHistoryBatch,
  logOperationResult,
} from "./history-logger";

// =============================================================================
// CYCLES TABLE
// =============================================================================
// Execution ledger - tracks each thinking cycle's metrics and costs.
// =============================================================================
export {
  type CycleContext,
  type CycleMetrics,
  type TokenUsage,
  createCycle,
  updateCycleMetrics,
  markCycleError,
  cleanupOrphanedCycles,
  calculateCostCents,
} from "./cycles";

// =============================================================================
// RUNTIME MIGRATIONS
// =============================================================================
// Cold-start table creation and schema updates.
// =============================================================================
export { ensureTablesExist, runRuntimeMigrations } from "./migrations/runtime";

// =============================================================================
// LLM LONG-TERM STORAGE (cold_storage, notebook, observations, learned, questions, reminders)
// =============================================================================
// Content tables where the LLM saves persistent data. All support persona scoping.
//
// NOTE: This is distinct from packages/memory/ which handles the memory SYSTEM
// (summarization, RAG, context assembly). This is just CRUD for content tables.
//
// @upstream: Context building, action handlers, API endpoints, Telegram commands
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  // Types - Cold Storage
  type ColdStorageEntry,
  // Types - Notebook
  type NotebookEntry,
  // Types - Observations
  type ObservationEntry,
  // Types - Learned
  type LearnedEntry,
  type LearnedConfidence,
  type LearnedAddResult,
  type LearnedCiteResult,
  // Types - Questions
  type QuestionEntry,
  type QuestionStatus,
  type QuestionDomain,
  type QuestionAddResult,
  // Types - Reminders
  type ReminderEntry,
  type ReminderCondition,
  type ReminderAddResult,
  type ReminderContext,
  // Types - Shared
  type SaveResult,
  type DeleteResult,
  type AppendResult,
  // Cold Storage
  getColdStorage,
  addColdStorage,
  // Notebook
  getNotebook,
  getNotebookIndex,
  getNote,
  saveNote,
  appendNote,
  deleteNote,
  // Notebook RAG retrieval
  getNotebookWithEmbeddings,
  type NotebookRow,
  // Observations
  getObservations,
  getObservationIndex,
  getObservation,
  saveObservation,
  deleteObservation,
  getAllObservationsIncludingDeleted,
  // Learned
  getLearned,
  getAllLearned,
  addLearned,
  updateLearned,
  citeEvidence,
  markPromoted,
  deleteLearned,
  // Questions
  getQuestions,
  getActiveQuestions,
  getAllQuestions,
  addQuestion,
  addNote,
  resolveQuestion,
  dissolveQuestion,
  deleteQuestion,
  // Reminders
  getReminders,
  getAllReminders,
  addReminder,
  dismissReminder,
  triggerReminder,
  batchDismissReminders,
  checkReminderDue,
} from "./llm-storage";

// =============================================================================
// BRANCHING SYSTEM (memory_branches, memory_overrides, synthetic_memories)
// =============================================================================
// Non-destructive memory manipulation: branches for different views of history,
// overrides to exclude/edit/reorder memories, synthetics for injected memories.
//
// @upstream: Route handlers, context assembly
// @downstream: D1 queries on branching tables
// =============================================================================
export {
  // Types
  type Branch,
  type BranchResult,
  type MemoryOverride,
  type EditData,
  type ReorderData,
  type ResetResult,
  type SyntheticMemory,
  type SyntheticResult,
  type SyntheticPlacement,
  type SyntheticUpdates,
  // Branch CRUD
  getBranches,
  getActiveBranch,
  getBranchByName,
  createBranch,
  activateBranch,
  deleteBranch,
  forkBranch,
  // Overrides
  getOverrides,
  getOverridesForEntry,
  excludeMemory,
  includeMemory,
  editMemory,
  reorderMemory,
  removeOverride,
  resetBranch,
  // Synthetic memories
  getSyntheticMemories,
  addSyntheticMemory,
  updateSyntheticMemory,
  deleteSyntheticMemory,
} from "./branches";

// =============================================================================
// SUMMARIES TABLE
// =============================================================================
// Compressed batches of history entries. When history grows too large,
// older entries are compressed into summaries. Meta-summaries consolidate
// multiple summaries. Three-tier system: cached (stable), tail (dynamic),
// archived (RAG-only).
//
// @upstream: Context building, summarization services, API endpoints
// @downstream: D1 queries with tier-aware sorting
// =============================================================================
export {
  // CRUD
  getSummaries,
  getAllSummaries,
  getSummaryById,
  addSummary,
  archiveSummaries,
  updateSummaryEmbedding,
  updateSummaryMetadata,
  // Retrieval
  getActiveSummaries,
  getContextSummaries,
  getBufferSummaries,
  getActiveCount,
  getPromotedSummaries,
  // RAG retrieval
  getSummariesWithEmbeddings,
  type GetSummariesWithEmbeddingsOptions,
  type SummaryRow,
  // Tier management
  setSummaryTier,
  setSummaryTierPosition,
  moveSummary,
  promoteSummary,
  demoteSummary,
  activateSummary,
  archiveSummaryById,
  // Stats
  getSummaryStats,
  // Lifecycle
  parseCoveredRangeStartDate,
  setSummaryPosition,
  batchSummaryPositions,
  setCoveredStart,
  backfillCoveredStart,
} from "./summaries";

// =============================================================================
// METERS (Internal State)
// =============================================================================
// Self-report status system for tracking internal state.
// Seven being-state dimensions (0-10 scale) updated per cycle.
//
// ARCHITECTURE (v2 - Unified State):
// Each meter is stored as a single JSON object containing value, history, and decay tracking.
// Storage key: meter_state_<name> (e.g., meter_state_aliveness)
//
// METER TYPES:
// - Core meters (METERS constant): Clio can SET these in her response
// - Involuntary meters (runtime): user-controlled, Clio can only READ
//
// DECAY/RECOVERY SYSTEM:
// Meters naturally drift toward equilibrium (5) unless actively maintained.
// - Values > 5 decay DOWN toward 5
// - Values < 5 recover UP toward 5
// - Triggers when: unchanged for 2+ cycles AND 45+ minutes
//
// @upstream: Context building, action handlers, telegram commands, history logger
// @downstream: State table reads/writes
// =============================================================================
export {
  // Types
  type MeterConfig,
  type MeterName,
  type MeterValues,
  type MeterHistories,
  type MeterState,
  type AllMeterStates,
  type DecayTracking,
  type DecayConfig,
  type DecayResult,
  type InvoluntaryMeterConfig,
  type InvoluntaryMeterDisplay,
  // Config
  METERS,
  METER_EMOJI,
  METER_ALIASES,
  DEFAULT_METER_VALUE,
  MAX_HISTORY_LENGTH,
  DEFAULT_DECAY_CONFIG,
  // Core functions
  getMeterValues,
  setMeterValue,
  setMeterValues,
  getMeterHistory,
  getAllMeterHistories,
  getMeterSnapshot,
  // Unified state functions (v2)
  getMeterState,
  getAllMeterStates,
  setMeterState,
  createDefaultMeterState,
  // Decay logic (pure functions)
  shouldDecay,
  getDecayedValue,
  updateDecayTracking,
  // Decay application (DB functions)
  applyDecayToMeter,
  applyDecayToAllMeters,
  // Migration
  migrateMeterToUnified,
  migrateAllMetersToUnified,
  // Formatters
  formatMeterBar,
  formatMeterCompact,
  formatHistoryTrend,
  formatMetersSection,
  // Utility
  resolveMeterName,
  getDecayInfo,
  // Equilibrium (runtime config)
  getEquilibrium,
  setEquilibrium,
  getAllEquilibriums,
  resetEquilibrium,
  // Involuntary meters (user-controlled, Clio reads only)
  getInvoluntaryMeters,
  getEnabledInvoluntaryMeters,
  addInvoluntaryMeter,
  enableInvoluntaryMeter,
  disableInvoluntaryMeter,
  removeInvoluntaryMeter,
  getInvoluntaryMeterState,
  setInvoluntaryMeterValue,
  isInvoluntaryMeter,
  getInvoluntaryMeterDisplays,
  snapshotInvoluntaryMeters,
} from "./meters";

// =============================================================================
// PINNED IMAGES (Image Wall + View Queue)
// =============================================================================
// Curated 5-slot image wall + pending view images queue.
// Allows the LLM to pin meaningful images and request to view past images.
//
// @upstream: Context building (MY SPACE), PIN_IMAGE/VIEW_IMAGES actions
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  // Types
  type PinnedImage,
  type PinnedImageContext,
  type PendingViewImage,
  type GallerySummary,
  type PinResult,
  type SwapResult,
  type ViewRequestResult,
  type ClearViewedResult,
  // Utility
  normalizeId,
  // Pinned Images
  getPinnedImages,
  getPinnedImagesForContext,
  pinImage,
  unpinImage,
  swapPinnedImages,
  // Pending View Images
  requestViewImages,
  getPendingViewImages,
  clearViewedImages,
  markImagesViewed,
  // Gallery
  getGallerySummary,
} from "./pinned";

// =============================================================================
// VOICE (STT Glossary + Transcriptions)
// =============================================================================
// Voice processing database operations. Glossary for STT corrections,
// transcriptions for voice message tracking.
//
// @upstream: Platform voice handlers, telegram commands, API routes
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  // Types
  type GlossaryEntryRow,
  type GlossaryFilterOptions,
  type GlossaryEntryInput,
  type GlossaryEntryUpdate,
  type VoiceTranscription,
  type VoiceTranscriptionInput,
  type TranscriptionCorrection,
  type GetTranscriptionsOptions,
  type TranscriptionListResult,
  type AddTranscriptionResult,
  // Glossary functions
  addGlossaryEntry,
  getGlossaryEntries,
  getGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  applyGlossaryCorrections,
  buildGlossaryPrompt,
  applyGlossary,
  getGlossaryPrompt,
  // Transcription functions
  addVoiceTranscription,
  getVoiceTranscriptions,
  getVoiceTranscription,
  updateTranscriptionCorrection,
  deleteVoiceTranscription,
} from "./voice";

// =============================================================================
// DRIZZLE QUERY OPERATORS (re-exported for consumer packages)
// =============================================================================
// Consumer packages that build Drizzle queries need these operators but should
// not take a direct dependency on drizzle-orm. Re-exported here as the single
// resolution point.
// =============================================================================
export { eq, and, or, sql, desc, asc, inArray, isNull } from "drizzle-orm";

// =============================================================================
// SCHEMA TABLE OBJECTS (Drizzle table references for consumer packages)
// =============================================================================
// Consumer packages that build their own Drizzle queries need the table objects.
// These are re-exported from the schema barrel for external use.
// =============================================================================
export {
  coldStorage as coldStorageTable,
  pendingBatches,
  simConceptAxes,
  simAxisScores,
  simBasinMetrics,
  simAnomalyFlags,
  history as historyTable,
  summaries as summariesTable,
  learned as learnedTable,
  questions as questionsTable,
} from "./schema";

// =============================================================================
// PLACEHOLDER EXPORTS
// =============================================================================
// The following modules are not yet migrated to TypeScript.
// They will be imported from the worker/src/db/* files during the transition.
// =============================================================================

/**
 * @todo Migrate remaining modules to @persistence/db:
 * - batches.ts
 * - sim.ts
 *
 * @done Migrated:
 * - learned.ts (2026-01-27)
 * - questions.ts (2026-01-27)
 * - reminders.ts (2026-01-27)
 * - fork.ts → personas.ts (2026-01-28)
 * - pinned.ts (2026-01-28)
 * - reminders/checkReminderDue (2026-01-28)
 * - glossary.ts (2026-01-30) - Consolidated from @persistence/voice
 * - voiceTranscriptions.ts (2026-01-30) - Consolidated from @persistence/voice
 */

// Temporary placeholder for modules not yet migrated
export const DB_MIGRATION_STATUS = {
  migrated: [
    "personas",
    "personas/fork",
    "state",
    "history",
    "history-logger",
    "cycles",
    "migrations/runtime",
    "llm-storage/cold-storage",
    "llm-storage/notebook",
    "llm-storage/observations",
    "llm-storage/learned",
    "llm-storage/questions",
    "llm-storage/reminders",
    "branches",
    "summaries",
    "meters",
    "pinned",
    "voice/glossary",
    "voice/transcriptions",
  ],
  pending: ["batches", "sim"],
} as const;
