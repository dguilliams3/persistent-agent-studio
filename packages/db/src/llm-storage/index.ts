/**
 * LLM storage database operations barrel file
 *
 * @module @persistence/db/llm-storage
 * @description Centralized exports for all LLM content tables:
 * - Cold storage (permanent memories)
 * - Notebook (saved notes)
 * - Observations (about the user)
 * - Learned (self-knowledge with evidence tracking)
 * - Questions (open curiosity threads)
 * - Reminders (persistent alerts)
 *
 * Re-exports all functions from individual modules for convenient importing:
 *   import { getColdStorage, getLearned, getQuestions } from '@persistence/db/llm-storage';
 *
 * Or import from specific modules for clarity:
 *   import { getColdStorage } from '@persistence/db/llm-storage/cold-storage';
 *   import { getLearned } from '@persistence/db/llm-storage/learned';
 *
 * @upstream Called by:
 *   - packages/db/src/index.ts - Main barrel file re-exports
 *   - packages/telegram/src/commands/context_data handlers
 *   - packages/tools/src/definitions handlers
 *   - platforms/cloudflare/src/ - Various handlers and routes
 */

// =============================================================================
// TYPES
// =============================================================================
// One-type-per-file definitions for all LLM storage tables.
// =============================================================================
export type { ColdStorageEntry } from './ColdStorageEntry';
export type { NotebookEntry } from './NotebookEntry';
export type { ObservationEntry } from './ObservationEntry';
export type { LearnedEntry } from './LearnedEntry';
export type { LearnedConfidence } from './LearnedConfidence';
export type { LearnedAddResult } from './LearnedAddResult';
export type { LearnedCiteResult } from './LearnedCiteResult';
export type { QuestionEntry } from './QuestionEntry';
export type { QuestionStatus } from './QuestionStatus';
export type { QuestionDomain } from './QuestionDomain';
export type { QuestionAddResult } from './QuestionAddResult';
export type { ReminderEntry } from './ReminderEntry';
export type { ReminderCondition } from './ReminderCondition';
export type { ReminderAddResult } from './ReminderAddResult';
export type { SaveResult } from './SaveResult';
export type { DeleteResult } from './DeleteResult';
export type { AppendResult } from './AppendResult';

// =============================================================================
// COLD STORAGE (Permanent Memories)
// =============================================================================
// The `cold_storage` table stores permanent memories that Claude has chosen to
// "freeze" - facts important enough to survive summarization and always appear
// in context. Think of it as long-term memory that never gets compressed.
//
// @upstream: Context building, COLD_STORAGE action handler
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  getColdStorage,
  addColdStorage,
} from './cold-storage';

// =============================================================================
// NOTEBOOK (Saved Notes)
// =============================================================================
// The `notebook` table provides structured note-taking with title/content/summary.
// Notes support case-insensitive partial title matching for retrieval.
// Each note is scoped to a persona for multi-persona isolation.
//
// @upstream: Context building, NOTE actions (save/get/delete)
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  getNotebook,
  getNotebookIndex,
  getNote,
  saveNote,
  deleteNote,
  appendNote,
  // RAG retrieval
  getNotebookWithEmbeddings,
  type NotebookRow,
} from './notebook';

// =============================================================================
// OBSERVATIONS (About the User)
// =============================================================================
// The `observations` table stores structured knowledge about the user that Claude
// discovers and maintains. Uses soft delete (deleted_at) for audit/recovery.
// Observations can be restored if saved again after deletion.
//
// @upstream: Context building, OBSERVATION actions (save/get/delete)
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  getObservations,
  getObservationIndex,
  getObservation,
  saveObservation,
  deleteObservation,
  getAllObservationsIncludingDeleted,
} from './observations';

// =============================================================================
// LEARNED (Self-Knowledge with Evidence Tracking)
// =============================================================================
// The `learned` table tracks battle-tested self-knowledge with confidence levels
// (emerging → stable → load-bearing) and evidence tracking. When established
// enough, entries can be promoted to cold storage with full citation history.
//
// @upstream: Context building, LEARNED actions
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  getLearned,
  getAllLearned,
  addLearned,
  updateLearned,
  citeEvidence,
  markPromoted,
  deleteLearned,
} from './learned';

// =============================================================================
// QUESTIONS (Open Curiosity Threads)
// =============================================================================
// The `questions` table holds open curiosity threads without pressure to resolve.
// Questions move through states: open → exploring → resolved/dissolved.
// Notes accumulate over time as thoughts are added.
//
// @upstream: Context building, QUESTION actions
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  getQuestions,
  getActiveQuestions,
  getAllQuestions,
  addQuestion,
  addNote,
  resolveQuestion,
  dissolveQuestion,
  deleteQuestion,
} from './questions';

// =============================================================================
// REMINDERS (Persistent Alerts)
// =============================================================================
// The `reminders` table stores alerts that persist across thinking cycles.
// Conditions: persistent (always), next_user_message, after:YYYY-MM-DD.
// Uses soft delete (dismissed_at) for audit trail.
//
// @upstream: Context building, REMINDER actions, /reminder command
// @downstream: D1 queries with persona scoping
// =============================================================================
export {
  getReminders,
  getAllReminders,
  addReminder,
  dismissReminder,
  triggerReminder,
  batchDismissReminders,
  checkReminderDue,
  type ReminderContext,
} from './reminders';
