/**
 * Voice Database Module
 *
 * @module @persistence/db/voice
 * @description Database operations for voice-related tables: glossary (STT corrections)
 * and voice_transcriptions. This module provides CRUD operations for managing
 * speech-to-text correction data.
 *
 * Consolidated from @persistence/voice package into @persistence/db for simpler
 * architecture (DB operations belong in the DB package).
 *
 * Key components:
 * - Glossary: Correction terms for transcription errors (e.g., "macy" -> "Macy")
 * - Transcriptions: Store and manage voice transcription records with corrections
 *
 * @upstream Called by:
 *   - Platform routes/glossary.js - REST API endpoints
 *   - Platform telegram/commands/glossary.js - /glossary command
 *   - Platform telegram/commands/voice.js - Voice message processing
 *   - @persistence/services/messaging/telegram/commands/glossary
 * @downstream Calls:
 *   - Drizzle query builder with persona scoping via persona-scope.ts
 *   - D1 database queries
 */

// =============================================================================
// TYPES
// =============================================================================
// One-type-per-file definitions for voice-related database tables.
// =============================================================================
export type { GlossaryEntryRow } from './GlossaryEntryRow.js';
export type { GlossaryFilterOptions } from './GlossaryFilterOptions.js';
export type { GlossaryEntryInput } from './GlossaryEntryInput.js';
export type { GlossaryEntryUpdate } from './GlossaryEntryUpdate.js';
export type { VoiceTranscription } from './VoiceTranscription.js';
export type { VoiceTranscriptionInput } from './VoiceTranscriptionInput.js';
export type { TranscriptionCorrection } from './TranscriptionCorrection.js';
export type { GetTranscriptionsOptions } from './GetTranscriptionsOptions.js';
export type { TranscriptionListResult } from './TranscriptionListResult.js';
export type { AddTranscriptionResult } from './AddTranscriptionResult.js';
// PersonaOptions is internal — consumed by GlossaryFilterOptions and
// GetTranscriptionsOptions but not re-exported from this barrel.

// =============================================================================
// GLOSSARY
// =============================================================================
// Glossary entries correct common transcription errors from WhisperX.
// Each entry maps a wrong_form (misheard) to correct_form (desired).
// Used in two ways:
// 1. Prompt priming: buildGlossaryPrompt() for WhisperX initial_prompt
// 2. Post-processing: applyGlossaryCorrections() for text replacement
// =============================================================================
export {
  // CRUD operations
  addGlossaryEntry,
  getGlossaryEntries,
  getGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  // Pure functions (for testing and caching)
  applyGlossaryCorrections,
  buildGlossaryPrompt,
  // Convenience functions (DB + pure function composition)
  applyGlossary,
  getGlossaryPrompt,
} from './glossary.js';

// =============================================================================
// TRANSCRIPTIONS
// =============================================================================
// Voice transcription CRUD operations. Stores raw transcriptions and
// user corrections for training data.
// =============================================================================
export {
  addVoiceTranscription,
  getVoiceTranscriptions,
  getVoiceTranscription,
  updateTranscriptionCorrection,
  deleteVoiceTranscription,
} from './transcriptions.js';
