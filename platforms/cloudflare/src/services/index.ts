/**
 * External services barrel file
 *
 * @module services
 * @description Centralized exports for all external service integrations.
 *
 * Re-exports all service functions from individual modules for convenient importing:
 *   import { generateImage } from './services/index.js';
 *
 * Or import from specific modules for clarity:
 *   import { generateImage } from './services/media/index.js';
 *
 * Note: Web search uses ClaudeSearchProvider from @persistence/services directly.
 *
 * @upstream Called by:
 *   - index.js (main worker) - imports services for action execution and command handling
 *   - executeActions() - uses media and image services
 *   - Route handlers - various services for API endpoints
 */

// =============================================================================
// LLM PROVIDER ABSTRACTION
// =============================================================================
// LLM calls are handled by @persistence/llm package via response-normalizer-integration.js.
// All LLM provider logic has been migrated to the typed package interface.
//
// @upstream: summarizeHistory(), metaSummarize()
// @downstream: @persistence/llm (RequestEngine, resolveProvider, resolveModelById)
// =============================================================================
// ⚠️ REQUIRED: Normalized callLLM - ALL LLM calls must use this for consistent response parsing
export { callLLM } from "./response-normalizer-integration.js";

// NOTE: summary-config.js functions are imported directly by consumers:
// - routes/summary-config.js imports from ../services/summary-config.js
// - telegram/commands/tier-config.js imports from ../../services/summary-config.js

// =============================================================================
// SUMMARIZATION SERVICES
// =============================================================================
// Summarization helpers used by the worker, Telegram commands, and REST routes.
// =============================================================================
export { summarizeHistory, metaSummarize } from "./summarization.js";

// =============================================================================
// QUICK FOLLOW-UP
// =============================================================================
export { scheduleQuickFollowup } from "./quick-followup.js";

// =============================================================================
// MEDIA SERVICES (images, video, audio, storage)
// =============================================================================
// Media services are imported directly from ./media/index.js by consumers.
// Only commonly used exports are re-exported here.
//
// @upstream: Called by action executors, route handlers, Telegram commands
// @downstream: Cloudflare AI, Replicate API, ElevenLabs, Modal, R2 bucket
// =============================================================================
export {
  // Image generation (most commonly used)
  generateImage,
  // Audio TTS
  textToSpeech,
  TTS_MODELS,
} from "./media/index.js";

// NOTE: Most media functions are imported directly from ./media/index.js:
// - index.js imports convertVideoToGif, createGifDataUrl, formatGifMetadata, storeGifMedia, getMedia, isR2Reference, extractR2Key
// - routes/media.js imports from ../services/media/index.js
// - routes/transcribe.js imports transcribeAudio from ../services/media/index.js
// - telegram/commands/voice.js imports transcribeAudio, downloadTelegramFile from ../../services/media/index.js

// =============================================================================
// EMBEDDING HELPERS & RAG RETRIEVAL
// =============================================================================
// Vector embedding generation (CloudflareEmbeddingProvider, EMBEDDING_MODEL) was
// previously re-exported from this barrel. Those re-exports have been removed.
// Import embedding types and providers directly from @persistence/embedding:
//   import { CloudflareEmbeddingProvider, EMBEDDING_MODEL } from '@persistence/embedding';
//
// Blob conversion and RAG retrieval are still re-exported below from @persistence/memory.
//
// @upstream: Called by addSummary(), metaSummarize(), buildSystemPrompt()
// @downstream: @persistence/embedding (direct), @persistence/memory
// =============================================================================
export {
  embeddingToBlob,
  blobToEmbedding,
  retrieveRelevantMemories,
  retrieveRelevantSummaries,
} from "@persistence/memory";

// =============================================================================
// SIM COMPUTATION HELPERS
// =============================================================================
// Pure math utilities for Semantic Identity Monitor basin statistics.
// Provides centroid computation, entry z-scores, and short-term trend analysis.
// MIGRATED: Now re-exported from @persistence/memory (packages/memory/src/sim/compute.ts)
// =============================================================================
export {
  computeBasinMetrics,
  computeEntryStats,
  analyzeTrend,
} from "@persistence/memory";

// NOTE: TTS (textToSpeech, TTS_MODELS) and STT (transcribeAudio, downloadTelegramFile)
// are now exported from ./media/index.js above (consolidated audio services)

// =============================================================================
// ACTION FEEDBACK SERVICE
// =============================================================================
// Feedback system to surface tool failures and issues to Clio.
// Only commonly used exports are re-exported here.
//
// @upstream: Called by action executors when issues occur
// @downstream: Stores in D1 state, included in context assembly
// =============================================================================
export {
  addFeedback,
  getFeedbackAndClear,
  formatFeedbackForContext,
  FEEDBACK_TYPES,
} from "./feedback.js";

// NOTE: normalizeAction and transformLegacyAction are used internally by
// action-executor.js - they're not needed as public exports

// NOTE: Token counting functions are imported directly from ./tokenizer.js:
// - routes/registry.js uses dynamic import for countTokensForProvider, countContextTokens

// NOTE: Prosodic annotation functions are imported directly from ./prosody.js:
// - telegram/commands/voice.js imports getProsodyAnnotation from ../../services/prosody.js

// =============================================================================
// BATCH PROCESSING SERVICE
// =============================================================================
// Anthropic Batches API operations for async processing with 50% cost savings.
// Handles batch submission, status checking, and execution.
//
// The Batches API enables off-peak processing where requests are queued and
// processed asynchronously. This module provides:
//
// - checkPendingBatchGuard: Check if batch is pending (for /think guards)
// - submitBatch: Submit new batch request to Anthropic
// - processPendingBatches: Main processing loop (called by cron)
//
// Note: checkBatchStatus and fetchBatchResults moved to @persistence/llm
// and are used internally by processPendingBatches via RequestEngine.
//
// processPendingBatches requires callbacks for action execution:
// - executeBatchAction: Executes parsed actions (stays in index.js)
// - streamActionToTelegram: Streams actions to Telegram (optional)
//
// @upstream: Called by index.js scheduled(), orchestrator (via cycle-adapter), /think-now
// @downstream: @persistence/llm, db/batches.js, services/telegram.js
// =============================================================================
export {
  checkPendingBatchGuard,
  queueThinkCycle,
  submitBatch,
  processPendingBatches,
} from "./batch-processor.js";

// =============================================================================
// RESPONSE PARSING
// =============================================================================
// Shared response parsing for Claude's action JSON output.
// Only parseClaudeResponse is commonly used; helper functions are internal.
//
// @upstream: orchestrator, processPendingBatches()
// @downstream: None (pure parsing logic)
// =============================================================================
export { parseClaudeResponse } from "@persistence/llm";

// =============================================================================
// ACTION EXECUTION WRAPPER
// =============================================================================
// DRY execution wrapper for sync and batch modes.
// Only commonly used exports are re-exported here.
//
// @upstream: orchestrator (via cycle-adapter), processPendingBatches() in batch-processor.js
// @downstream: feedback.js, action-registry.js, db/state.js
// =============================================================================
export {
  executeActions,
  executeTool,
  getParseErrors,
  markParseErrorsShown,
  formatFeedbackTooltip,
  cleanupFeedback,
} from "./action-executor.js";

// NOTE: storeParseErrors and clearParseErrors are used internally by batch-processor.js
// which imports them directly - no re-export needed

// =============================================================================
// PINNED IMAGES SERVICE
// =============================================================================
// Pinned image management for Claude's context. Allows Claude to reference
// specific images from history in her responses.
//
// @upstream: Called by tools/actions/index.js, telegram commands
// @downstream: db/pinned-images.js, history queries
// =============================================================================
export {
  executePinImageAction,
  executeViewImagesAction,
} from "./pinned-images.js";

// =============================================================================
// SEARCH GATEWAY (from @persistence/services)
// =============================================================================
// SearchGateway is the SINGLE entry point for all web search operations.
// It wraps ClaudeSearchProvider and provides metadata tracking.
//
// @upstream: post-processors.js, actions/index.js, commands/index.js
// @downstream: @persistence/services (ClaudeSearchProvider)
// =============================================================================
export { SearchGateway } from "@persistence/services";

