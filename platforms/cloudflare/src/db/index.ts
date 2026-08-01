/**
 * Database operations barrel file
 *
 * @module db
 * @description Centralized exports for all D1 database operations.
 *
 * Re-exports from @persistence/db for migrated modules,
 * plus platform-only modules not yet in packages.
 *
 * @upstream Called by:
 *   - index.js (main worker) - imports all database functions for route handlers and cron
 *   - processPendingBatches() - uses getPendingBatches, updatePendingBatch, addHistory
 *   - orchestrator (via cycle-adapter) - uses createCycle, updateCycleMetrics, getHistory, addHistory, etc.
 *   - All HTTP route handlers - use various database functions
 */

// =============================================================================
// MIGRATED TO PACKAGES - Re-export from @persistence/db
// =============================================================================

export {
  // Personas
  getActivePersonaId,
  setActivePersonaId,
  getPersona,
  listPersonas,
  resetPersonaCache,

  // State
  getState,
  setState,

  // History
  getHistory,
  addHistory,
  deleteOldestHistory,
  deleteHistoryByIds,
  getHistoryForContext,
  getOldestHistory,
  getHistoryCount,

  // Cycles
  createCycle,
  updateCycleMetrics,
  markCycleError,
  cleanupOrphanedCycles,
  calculateCostCents,

  // LLM Storage (cold_storage, notebook, observations)
  getColdStorage,
  addColdStorage,
  getNotebook,
  getNotebookIndex,
  saveNote,
  deleteNote,
  getObservations,
  getObservationIndex,
  saveObservation,

  // Learned
  getLearned,
  addLearned,
  updateLearned,
  citeEvidence as citeLearned,
  markPromoted as promoteLearned,
  deleteLearned,

  // Questions
  getQuestions,
  addQuestion,
  addNote as addQuestionNote,
  resolveQuestion,
  dissolveQuestion,

  // Reminders
  getReminders,
  getAllReminders,
  addReminder,

  // Branches
  getBranches,
  getActiveBranch,
  getBranchByName,
  createBranch,
  activateBranch,
  deleteBranch,
  forkBranch,
  getOverrides,
  excludeMemory,
  includeMemory,
  editMemory,
  reorderMemory,
  removeOverride,
  resetBranch,
  getSyntheticMemories,
  addSyntheticMemory,
  updateSyntheticMemory,
  deleteSyntheticMemory,

  // Summaries
  getSummaries,
  getAllSummaries,
  addSummary,
  archiveSummaries,
  updateSummaryEmbedding,
  getActiveSummaries,
  getContextSummaries,
  getBufferSummaries,
  getActiveCount,
  getPromotedSummaries,
  setSummaryTier,
  moveSummary,
  promoteSummary,
  demoteSummary,
  activateSummary,
  archiveSummaryById,
  getSummaryStats,
  setSummaryPosition,
  backfillCoveredStart,
} from '@persistence/db';

// =============================================================================
// UTILITY FUNCTIONS (not DB operations, used by context building)
// =============================================================================
// checkReminderDue is a pure function that evaluates a reminder condition
// against context (e.g., newUserMessage: true). NOT a DB operation.
// Imported directly from @persistence/db (formerly re-exported from ./reminders.js)

// =============================================================================
// PINNED IMAGES (migrated to @persistence/db)
// =============================================================================
// All pinned image functions now imported directly from @persistence/db
// (formerly re-exported from ./pinned.js)
export {
  // Utility - checkReminderDue
  checkReminderDue,

  // Pinned Images (Image Wall)
  getPinnedImages,
  getPinnedImagesForContext,
  pinImage,
  unpinImage,
  swapPinnedImages,

  // Pending View Images (VIEW_IMAGES action)
  requestViewImages,
  getPendingViewImages,
  clearViewedImages,

  // Gallery Summary
  getGallerySummary,
} from '@persistence/db';

// =============================================================================
// PLATFORM-ONLY (not yet migrated to packages)
// =============================================================================

export {
  getBatchTimeout,
  setBatchTimeout,
  listPendingBatches,
  storePendingBatch,
  getPendingBatches,
  updatePendingBatch,
  isInBatchWindow,
  isUserRecentlyActive,
  cancelBatch
} from './batches.js';

export {
  addGlossaryEntry,
  getGlossaryEntries,
  deleteGlossaryEntry,
  applyGlossary
} from './glossary.js';

export {
  SIM_EMBEDDING_TABLES,
  getAxes,
  getAxisById,
  createAxis,
  updateAxis,
  deleteAxis,
  getScoresForEntry,
  upsertScore,
  batchUpsertScores,
  getBasinMetrics,
  upsertBasinMetrics,
  getAnomalies,
  createAnomaly,
  updateAnomaly,
  getEmbeddingsExport,
  getEmbeddingsCoverage
} from './sim.js';

export {
  getVoiceTranscriptions,
  getVoiceTranscription,
  updateTranscriptionCorrection,
  deleteVoiceTranscription
} from './voiceTranscriptions.js';

export {
  addVoiceHistory,
  listVoiceHistory,
  countVoiceHistory,
  getVoiceHistoryAudioById,
  findVoiceHistoryIdByText,
  findVoiceHistoryIdByCreatedAt,
  listVoiceHistoryPlaceholders,
  updateVoiceHistoryText,
} from './voiceHistory.js';

// forkPersona is imported directly from ./fork.js by routes/personas.js
// No re-export needed here
