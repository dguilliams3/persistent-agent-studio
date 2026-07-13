/**
 * HTTP routes barrel file
 *
 * @module routes
 * @description Centralized exports for all HTTP route handlers.
 *
 * Re-exports all route handler functions from individual modules for convenient importing:
 *   import { handleGetState, handleGetHistory, handleSetUserStatus } from './routes/index.js';
 *
 * Routes are organized by function:
 * - **data.js**: GET endpoints for retrieving stored data
 * - **settings.js**: GET/POST endpoints for configuration management
 * - **actions.js**: POST endpoints for triggering actions
 * - **branches.js**: Memory branching system for non-destructive editing
 * - **personas.js**: Multi-persona management (list, create, activate)
 * - **personality.js**: Personality export/import snapshots
 * - **miniapp.js**: Telegram Mini App static content
 * - **transcribe.js**: Speech-to-text transcription
 * - **glossary.js**: STT glossary corrections
 * - **voice-realtime.js**: Realtime voice session lifecycle
 *
 * Note: Some complex routes remain in index.js:
 * - /context - depends on buildSystemPrompt
 * - /think-now - depends on queueThinkCycle
 * - /imagine - depends on generateImage
 * - /telegram - depends on handleTelegramUpdate
 * - /test-telegram, /test-discord - depend on service functions
 * - /batch-process - depends on processPendingBatches
 * - /metasummarize - depends on summarizeHistory
 * - /migrate - uses worker's own D1 binding for migrations
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: Database functions, services
 */

// =============================================================================
// DATA ROUTES (GET)
// =============================================================================
// Read-only endpoints for retrieving stored data.
// These are safe operations that don't modify state.
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls database query functions
// =============================================================================
export {
  handleGetState,
  handleGetHistory,
  handleGetColdStorage,
  handleGetNotebook,
  handleGetObservations,
  handleGetSummaries,
  handleGetReminders,
  handleGetCycles,
  handleGetGallery,
  handleGetProfilePicture,
  // Summary promotion (move summaries to Block 2 stable context)
  handlePromoteSummary,
  handleDemoteSummary,
  // Summary archival (RAG Archive <-> Dynamic Tail)
  handleActivateSummary,
  handleArchiveSummary,
  // Summary sort redesign (v24)
  handleSetSummaryPosition,
  handleBackfillCoveredStart,
  handleBackfillEmbeddings,
  // Summary tier refactor (v25)
  handleSetSummaryTier,
  handleMoveSummary,
  // Internal state meters
  handleGetMeters,
  handleSetMeter,
  handleSetMetersBatch,
  // Mini-app batch endpoint
  handleGetMiniAppData
} from './data.js';

export { handleGetToolRegistry } from './tools.js';

// =============================================================================
// SETTINGS ROUTES (GET/POST)
// =============================================================================
// Configuration management endpoints.
// GET endpoints return current settings.
// POST endpoints update settings with validation.
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls getState/setState from db/state.js
// =============================================================================
export {
  // User status
  handleGetUserStatus,
  handleSetUserStatus,
  // Discord toggle
  handleGetDiscordEnabled,
  handleSetDiscordEnabled,
  // Batch mode
  handleGetBatchStatus,
  handleGetBatchEnabled,
  handleSetBatchEnabled,
  // Max tokens
  handleGetMaxTokens,
  handleSetMaxTokens,
  // Cost ceiling
  handleGetCostCeiling,
  handleSetCostCeiling,
  // Telegram streaming
  handleGetStreaming,
  handleSetStreaming,
  // Sleep mode
  handleGetSleepStatus,
  handleDeleteSleepStatus,
  // Cycle interval
  handleSetInterval,
  // Summarization
  handleGetSummarizeSettings,
  handleSetSummarizeSettings,
  handleSetAutoSummarize,
  // Prompt templates
  handleGetSummarizePrompts,
  handleSetSummarizePrompts,
  // Loop control
  handleStart,
  handleStop,
  // RAG retrieval settings
  handleGetRagConfig,
  handleSetRagConfig,
  getRagConfig
} from './settings.js';

// =============================================================================
// ACTION ROUTES (POST)
// =============================================================================
// Endpoints that trigger actions or modify data.
// All require POST method with JSON body.
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls database functions, services
// =============================================================================
export {
  handlePostMessage,
  handleSetProfilePicture,
  handleDeleteProfilePicture,
  handleSaveArt,
  handlePostColdStorage,
  handlePostNotebook,
  handleReset
} from './actions.js';

// =============================================================================
// MEMORY BRANCH ROUTES (GET/POST/PUT/DELETE)
// =============================================================================
// Memory branching system for NON-DESTRUCTIVE memory manipulation.
// Enables editing, excluding, reordering memories without modifying canonical history.
//
// The 'main' branch shows canonical unmodified history.
// Other branches can have:
// - Exclusions: Hide entries from context
// - Edits: Replace displayed content (original preserved)
// - Reorders: Change timeline position
// - Synthetic memories: New entries that only exist in the branch
//
// Philosophy: "Never delete, only exclude" - all canonical data preserved forever.
//
// Branch endpoints:
// - GET    /branches              - List all branches
// - POST   /branches              - Create new branch
// - GET    /branches/active       - Get active branch
// - PUT    /branches/:name/activate - Switch active branch
// - DELETE /branches/:name        - Delete branch (not 'main')
// - POST   /branches/:name/fork   - Fork branch
// - POST   /branches/:name/reset  - Reset to canonical
//
// Memory manipulation endpoints:
// - POST   /memory/exclude        - Hide entry from context
// - POST   /memory/include        - Show excluded entry
// - POST   /memory/edit           - Edit entry (non-destructive)
// - POST   /memory/reorder        - Change position
// - GET    /memory/synthetic      - Get synthetic memories
// - POST   /memory/synthetic      - Add synthetic memory
// - PUT    /memory/synthetic/:id  - Update synthetic memory
// - DELETE /memory/synthetic/:id  - Delete synthetic memory
// - DELETE /memory/override/:id   - Remove specific override
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls db/branches.js functions
// =============================================================================
export {
  // Branch CRUD
  handleGetBranches,
  handleCreateBranch,
  handleGetActiveBranch,
  handleActivateBranch,
  handleDeleteBranch,
  handleForkBranch,
  handleResetBranch,
  // Memory overrides
  handleExcludeMemory,
  handleIncludeMemory,
  handleEditMemory,
  handleGetOverrides,
  handleReorderMemory,
  handleRemoveOverride,
  // Synthetic memories
  handleGetSyntheticMemories,
  handleAddSyntheticMemory,
  handleUpdateSyntheticMemory,
  handleDeleteSyntheticMemory
} from './branches.js';

// =============================================================================
// PERSONALITY SNAPSHOT ROUTES (GET/POST)
// =============================================================================
// Personality export/import system for backup, transfer, and experimentation.
// Enables complete personality snapshots that can be saved, shared, and restored.
//
// Export creates a PersonalitySnapshot containing:
// - meta: version, timestamp, checksum, name
// - state: loop_count, cost, interval, model settings
// - memories: history, cold_storage, notebook, observations, summaries, reminders
// - media: profile picture, gallery images (optional)
// - branches: branch list, overrides, synthetics (optional)
//
// Import supports three modes:
// - replace: Wipe and replace (destructive, requires ADMIN_PASSWORD)
// - merge: Add to existing (may duplicate)
// - branch: Create new branch with imported content (safest)
//
// Endpoints:
// - GET  /personality/export     - Export with query params
// - POST /personality/export     - Export with body options
// - POST /personality/import     - Import with mode (query param)
// - POST /personality/validate   - Validate snapshot format
// - POST /personality/preview    - Preview import without applying
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls db functions, crypto.subtle for checksums
// =============================================================================
export {
  handleExportPersonality,
  handleExportGallery,
  handleImportGallery,
  handleImportPersonality,
  handleValidateSnapshot,
  handlePreviewImport
} from '@persistence/memory/snapshot/routes';

// =============================================================================
// MINI APP ROUTES (GET)
// =============================================================================
// Telegram Mini App static content endpoints.
// Serves embedded HTML, CSS, and JavaScript for the gallery mini app.
//
// Endpoints:
// - GET /mini-app           - HTML page
// - GET /mini-app/styles.css - CSS stylesheet
// - GET /mini-app/app.js    - JavaScript application
//
// @upstream: Called by handleRequest() in index.js
// @downstream: None (serves static content)
// =============================================================================
export {
  handleGetMiniApp,
  handleGetMiniAppStyles,
  handleGetMiniAppScript
} from './miniapp.js';

// =============================================================================
// TRANSCRIPTION ROUTES (POST)
// =============================================================================
// Speech-to-text transcription endpoint for voice input.
// Accepts audio data and returns transcription via Cloudflare AI Whisper.
//
// Used by Mini App and React Web UI for voice recording features.
// Complements ElevenLabs TTS by providing the STT counterpart.
//
// Endpoints:
// - POST /transcribe - Transcribe audio to text
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls services/transcription.js transcribeAudio()
// =============================================================================
export { handleTranscribe } from './transcribe.js';

// =============================================================================
// REALTIME VOICE ROUTES (POST)
// =============================================================================
// Realtime session lifecycle endpoints for audio-to-audio providers.
//
// Endpoints:
// - POST /voice/realtime/start
// - POST /voice/realtime/transcript
// - POST /voice/realtime/end
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls voice/realtime service functions
// =============================================================================
export {
  handleVoiceRealtimeStart,
  handleVoiceRealtimeTranscript,
  handleVoiceRealtimeEnd
} from './voice-realtime.js';

// =============================================================================
// GLOSSARY ROUTES (GET/POST/PUT/DELETE)
// =============================================================================
// STT glossary management for speech-to-text corrections.
// Stores wrong→correct mappings used in:
//   1. Prompt priming: Build initial_prompt for WhisperX with correct spellings
//   2. Post-processing: Replace common mistranscriptions after STT completes
//
// Endpoints:
// - GET    /glossary         - List all entries
// - POST   /glossary         - Add new entry
// - GET    /glossary/:id     - Get single entry
// - PUT    /glossary/:id     - Update entry
// - DELETE /glossary/:id     - Delete entry (requires password or Telegram auth)
// - GET    /glossary/prompt  - Get formatted WhisperX prompt string
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls db/glossary.js functions
// =============================================================================
export {
  handleGetGlossary,
  handlePostGlossary,
  handleGetGlossaryEntry,
  handlePutGlossary,
  handleDeleteGlossary,
  handleGetGlossaryPrompt
} from './glossary.js';

// =============================================================================
// SIM ROUTES (GET/POST)
// =============================================================================
// Semantic Identity Monitor foundation endpoints for embeddings.
// MIGRATED to @persistence/memory — re-exported for backward compatibility.
// =============================================================================
export {
  handleSimEmbeddingsStatus,
  handleSimEmbeddingsExport,
  handleSimEmbeddingsBackfill,
  handleGetBasin,
  handleComputeBasin,
  handleGetTrajectory,
  handleComputeDirection
} from '@persistence/memory/sim/routes';

// =============================================================================
// PERSONA ROUTES (GET/POST/PUT)
// =============================================================================
// Multi-persona management system for running multiple AI beings on same infra.
// Enables research comparisons, forking personas, and blank-slate experiments.
//
// Each persona has isolated:
// - History, memories, notebooks, observations
// - Summaries, reminders, learned facts, questions
// - Image assets, voice history, cycles
//
// The active persona is stored in the config table and used by query helpers
// to automatically scope all database operations.
//
// Personas can be:
// - Created: Fresh blank-slate beings with custom system prompts
// - Activated: Switch which persona is currently "running"
// - Forked: Clone an existing persona's full state for A/B research
// - Exported: Complete state snapshot for backup or transfer
//
// Endpoints:
// - GET    /personas          - List all personas
// - GET    /personas/active   - Get currently active persona
// - GET    /personas/:id      - Get persona by ID
// - POST   /personas          - Create new persona (requires password)
// - PUT    /personas/:id/activate - Switch active persona
// - POST   /personas/:id/fork - Fork persona with all memories (requires password)
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls db/personas.js functions, db/fork.js
// =============================================================================
export {
  handleListPersonas,
  handleGetActivePersona,
  handleGetPersona,
  handleCreatePersona,
  handleActivatePersona,
  handleForkPersona
} from './personas.js';

// =============================================================================
// VOICE TRANSCRIPTIONS ROUTES (GET/PUT/DELETE)
// =============================================================================
// Voice message correction tracking for STT training data.
// Records the user's voice messages with original transcription and user corrections.
// Used to generate training data for improving WhisperX and prosody detection.
//
// Endpoints:
// - GET    /voice-transcriptions          - List with pagination
// - GET    /voice-transcriptions/:id      - Get single transcription
// - PUT    /voice-transcriptions/:id      - Update with corrections
// - DELETE /voice-transcriptions/:id      - Delete entry (requires password)
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls db/voiceTranscriptions.js functions
// =============================================================================
export {
  handleGetVoiceTranscriptions,
  handleGetVoiceTranscription,
  handlePutVoiceTranscription,
  handleDeleteVoiceTranscription
} from './voiceTranscriptions.js';

// =============================================================================
// SUMMARY CONFIG ROUTES (GET/POST)
// =============================================================================
// Token-threshold tier configuration endpoints shared with Telegram.
//
// Endpoints:
// - GET  /summary-config   - Current thresholds + live stats
// - POST /summary-config   - Update threshold/target values
// =============================================================================
export {
  handleGetSummaryConfig,
  handlePostSummaryConfig
} from './summary-config.js';

// =============================================================================
// MEDIA PROCESSING ROUTES (POST/GET)
// =============================================================================
// Media conversion and serving endpoints for video, audio, and other media.
//
// Endpoints:
// - POST /video-to-gif - Convert video to optimized GIF for Claude vision
// - GET /media/* - Serve media files from R2 storage
//
// @upstream: Called by handleRequest() in index.js
// @downstream: Calls services/video.js → Modal, services/media-storage.js → R2
// =============================================================================
export { handleVideoToGif, handleMediaGet } from './media.js';

// =============================================================================
// WEB SEARCH ROUTES (GET/POST)
// =============================================================================
// Direct web search via SearchGateway from @persistence/services.
// Provides API access to web search without going through Clio's actions.
//
// Endpoints:
// - GET  /web-search?q=query  - Simple search via query string
// - POST /web-search          - Search with options (query, logToHistory)
//
// @upstream: Called by handleRequest() in index.js
// @downstream: SearchGateway from @persistence/services
// =============================================================================
export { handleWebSearch, handleWebSearchGet } from './search.js';
