/**
 * HTTP Route Registry
 *
 * @module routes/registry
 * @description Declarative HTTP route registry for the Claude Existence Loop API.
 *
 * This module centralizes all route definitions and provides a single dispatch
 * function that replaces the if/else chains in index.js. Routes are organized
 * by category and support both exact paths and parameterized paths.
 *
 * ROUTE CATEGORIES:
 * - Data (GET): Read-only endpoints for retrieving stored data
 * - Settings (GET/POST): Configuration management
 * - Actions (POST): Operations that modify data
 * - Branches: Memory branch management
 * - Personality: Export/import snapshots
 * - Mini App: Telegram mini app static content
 * - Transcription: STT endpoints
 * - Glossary: STT corrections
 * - Personas: Multi-persona management
 * - Voice: TTS and voice history
 * - Admin: Reset, migrate, etc.
 *
 * HANDLER CONVENTION:
 * Routes can be handled in two ways:
 * 1. Existing handler functions from routes/*.js (most routes)
 * 2. Inline handlers defined in this registry (complex routes)
 *
 * For inline handlers that need access to platform functions (like
 * the orchestrator, generateImage, etc.), those functions are passed
 * via the route context from request-handler.ts.
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: findRoute() from matcher.js, handlers from routes/*.js
 */

import { findRoute } from "./matcher.js";
import type { Env } from "../bootstrap.js";
import { getProviderAvailabilityMap } from "@persistence/core/providers";
import type { DrizzleD1 } from "@persistence/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Context object passed to route handlers */
interface RouteCtx {
  db: D1Database;
  env: Env;
  request: Request;
  url: URL;
  body: any;
  params: Record<string, string>;
  corsHeaders: Record<string, string>;
  getResponseHeaders: (
    pathOrOptions?: string | { noCache?: boolean },
    method?: string,
  ) => Record<string, string>;
  [key: string]: any;
}

function getRouteProviderStatus(env: Env) {
  return getProviderAvailabilityMap((envKeyName) => env[envKeyName]);
}

function getUnavailableProviderReason(env: Env, providerName: string): string | null {
  const providerStatus = getRouteProviderStatus(env);
  const status = providerStatus[providerName];
  if (!status) {
    return null;
  }
  return status.available ? null : `${status.reason}. Set it via: npx wrangler secret put ${status.envKeyName}`;
}

function asDrizzleDb(db: D1Database): DrizzleD1 {
  return db as unknown as DrizzleD1;
}

// Import constants for pricing endpoint and route config
import {
  MODEL_PRICING,
  CACHE_PRICING,
  DISCORD_WEBHOOK,
  SUMMARIZE_CONFIG,
} from "../constants.js";

// Import database functions for remaining inline handlers
import {
  getState,
  setState,
  // Batch and summarization route deps
  getPendingBatches,
  cancelBatch,
  getActiveSummaries,
  getHistory,
  getHistoryCount,
  getOldestHistory,
  deleteHistoryByIds,
  addSummary,
  addVoiceHistory,
  listVoiceHistory,
  countVoiceHistory,
  getVoiceHistoryAudioById,
  findVoiceHistoryIdByText,
  findVoiceHistoryIdByCreatedAt,
  listVoiceHistoryPlaceholders,
  updateVoiceHistoryText,
} from "../db/index.js";

// Import services for inline handlers
import {
  textToSpeech,
  sendDiscordMessage,
  sendTelegram,
  generateImage,
  processPendingBatches,
  queueThinkCycle,
} from "../services/index.js";
import { ClaudeSearchProvider } from "@persistence/services";
import { CloudflareEmbeddingProvider } from "@persistence/embedding";
import { estimateTokens } from "@persistence/memory";
import { logHistory, formatEasternDateTime } from "../utils/index.js";
import { summarizeHistory, metaSummarize } from "../services/summarization.js";
import { handleTelegramUpdate } from "../telegram/index.js";
import { buildSystemPrompt } from "../prompts/index.js";
import { resizeImage } from "../utils/image.js";

// Import extracted handler functions from packages
import {
  handleGetLearned,
  handlePostLearned,
  handleDeleteLearned,
  handleGetQuestions,
  handlePostQuestion,
} from "@persistence/db/handlers/knowledge";

const WORKER_COMPAT_DATE = "2024-09-23";

import {
  handleInjectArt,
  handleDeleteGalleryImage,
  handleToggleBlur,
  handleToggleVault,
  handleDeleteHistoryEntry,
  handleDeleteColdStorage,
  handleDeleteNotebook,
  handleGetPinnedImages,
  handlePinnedImagesOp,
} from "@persistence/db/handlers/gallery";

// Import existing handlers from modular route files
import {
  // Data routes (GET)
  handleGetState,
  handleGetHistory,
  handleGetColdStorage,
  handleGetNotebook,
  handleGetObservations,
  handleGetSummaries,
  handleGetReminders,
  // Summary promotion (move summaries to Block 2)
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
  handleGetCycles,
  handleGetGallery,
  handleGetProfilePicture,
  handleGetToolRegistry,
  // Internal state meters
  handleGetMeters,
  handleSetMeter,
  handleSetMetersBatch,
  // Mini-app batch endpoint
  handleGetMiniAppData,

  // Settings routes (GET/POST)
  handleGetUserStatus,
  handleSetUserStatus,
  handleGetDiscordEnabled,
  handleSetDiscordEnabled,
  handleGetBatchStatus,
  handleGetBatchEnabled,
  handleSetBatchEnabled,
  handleGetMaxTokens,
  handleSetMaxTokens,
  handleGetStreaming,
  handleSetStreaming,
  handleGetSleepStatus,
  handleDeleteSleepStatus,
  handleSetInterval,
  handleGetSummarizeSettings,
  handleSetSummarizeSettings,
  handleSetAutoSummarize,
  handleGetSummarizePrompts,
  handleSetSummarizePrompts,
  handleStart,
  handleStop,
  handleGetRagConfig,
  handleSetRagConfig,

  // Action routes (POST)
  handlePostMessage,
  handleSetProfilePicture,
  handleDeleteProfilePicture,
  handleSaveArt,
  handlePostColdStorage,
  handlePostNotebook,
  handleReset,

  // Branch routes
  handleGetBranches,
  handleCreateBranch,
  handleGetActiveBranch,
  handleActivateBranch,
  handleDeleteBranch,
  handleForkBranch,
  handleResetBranch,
  handleExcludeMemory,
  handleIncludeMemory,
  handleEditMemory,
  handleGetOverrides,
  handleReorderMemory,
  handleRemoveOverride,
  handleGetSyntheticMemories,
  handleAddSyntheticMemory,
  handleUpdateSyntheticMemory,
  handleDeleteSyntheticMemory,

  // Personality routes
  handleExportPersonality,
  handleExportGallery,
  handleImportGallery,
  handleImportPersonality,
  handleValidateSnapshot,
  handlePreviewImport,

  // Mini app routes
  handleGetMiniApp,
  handleGetMiniAppStyles,
  handleGetMiniAppScript,

  // Transcription routes
  handleTranscribe,

  // Glossary routes
  handleGetGlossary,
  handlePostGlossary,
  handleGetGlossaryEntry,
  handlePutGlossary,
  handleDeleteGlossary,
  handleGetGlossaryPrompt,

  // Realtime voice routes
  handleVoiceRealtimeStart,
  handleVoiceRealtimeTranscript,
  handleVoiceRealtimeEnd,

  // Persona routes
  handleListPersonas,
  handleGetActivePersona,
  handleGetPersona,
  handleCreatePersona,
  handleActivatePersona,
  handleForkPersona,

  // Voice transcription routes
  handleGetVoiceTranscriptions,
  handleGetVoiceTranscription,
  handlePutVoiceTranscription,
  handleDeleteVoiceTranscription,

  // Media processing routes
  handleVideoToGif,

  // Web search routes
  handleWebSearch,
  handleWebSearchGet,
} from "./index.js";

// Import authentication handlers
import {
  handleAuthLogin,
  handleAuthVerify,
  handleAuthLogout,
  handleAuthStatus,
} from "./auth.js";

// Import SIM route handlers (MIGRATED to @persistence/memory)
import {
  handleSimEmbeddingsStatus,
  handleSimEmbeddingsExport,
  handleSimEmbeddingsBackfill,
  handleGetBasin,
  handleComputeBasin,
  handleGetWeeklyBasin,
  handleGetTrajectory,
  handleComputeDirection,
  handleGetAxes,
  handleGetAxis,
  handleCreateAxis,
  handleUpdateAxis,
  handleDeleteAxis,
  handleGetAxisScores,
  handleGetAnomalies,
  handleSimExport,
} from "@persistence/memory/sim/routes";

// Import summary config handlers
import {
  handleGetSummaryConfig,
  handlePostSummaryConfig,
} from "./summary-config.js";

// Import getRagConfig for /rag-debug route
import { getRagConfig } from "./settings.js";

// Import migration handler
import { handleMigrate } from "./migrate.js";

// =============================================================================
// ROUTE REGISTRY
// =============================================================================
// Each route entry maps a path pattern to an object of method -> handler.
// Handlers receive a context object (ctx) containing:
//   - db: D1Database
//   - env: Environment bindings
//   - request: Original Request object
//   - url: Parsed URL
//   - body: Parsed request body (for POST/PUT/DELETE)
//   - params: URL parameters extracted by matcher (for parameterized routes)
//   - corsHeaders: CORS headers to include in response
//   - getResponseHeaders: Function to get headers with cache control
//
// Handler return types:
//   - Object: Will be JSON.stringify'd and wrapped in Response
//   - Response: Returned directly
//   - null: Route was not handled (falls through to index.js)
// =============================================================================

export const ROUTE_REGISTRY = {
  // ===========================================================================
  // MINI APP ROUTES (serve static content)
  // ===========================================================================
  "/mini-app": {
    GET: (ctx: RouteCtx) => handleGetMiniApp(),
  },
  "/mini-app/styles.css": {
    GET: (ctx: RouteCtx) => handleGetMiniAppStyles(),
  },
  "/mini-app/app.js": {
    GET: (ctx: RouteCtx) => handleGetMiniAppScript(),
  },

  // Health check (auth-exempt per request-handler.ts, dependency-free, no DB)
  "/health": {
    GET: (ctx: RouteCtx) =>
      Response.json(
        { status: "ok", workerCompatDate: WORKER_COMPAT_DATE },
        { headers: ctx.corsHeaders },
      ),
  },

  // ===========================================================================
  // AUTHENTICATION ROUTES
  // ===========================================================================
  "/auth/login": {
    POST: async (ctx: RouteCtx) => {
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      return await handleAuthLogin(
        ctx.db,
        body,
        ctx.request,
        ctx.corsHeaders,
        ctx.env,
      );
    },
  },
  "/auth/verify": {
    POST: async (ctx: RouteCtx) => {
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      return await handleAuthVerify(
        ctx.db,
        body,
        ctx.request,
        ctx.corsHeaders,
        ctx.env,
      );
    },
  },
  "/auth/logout": {
    POST: async (ctx: RouteCtx) => {
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      return await handleAuthLogout(
        ctx.db,
        body,
        ctx.request,
        ctx.corsHeaders,
        ctx.env,
      );
    },
  },
  "/auth/status": {
    GET: async (ctx: RouteCtx) => {
      return await handleAuthStatus(
        ctx.db,
        ctx.request,
        ctx.corsHeaders,
        ctx.env,
      );
    },
  },

  // ===========================================================================
  // TRANSCRIPTION ROUTE
  // ===========================================================================
  "/transcribe": {
    POST: (ctx: RouteCtx) => handleTranscribe(ctx.request, ctx.env),
  },

  // ===========================================================================
  // WEB SEARCH ROUTE
  // ===========================================================================
  // Direct web search via SearchGateway from @persistence/services.
  // Provides API access to web search without going through Clio's actions.
  "/web-search": {
    GET: (ctx: RouteCtx) => handleWebSearchGet(ctx.url, ctx.env),
    POST: (ctx: RouteCtx) => handleWebSearch(ctx.request, ctx.env),
  },

  // ===========================================================================
  // VIDEO-TO-GIF ROUTE (Media Processing)
  // ===========================================================================
  // Converts video to optimized GIF for Claude vision analysis.
  // Accepts raw video bytes, returns base64 GIF.
  // Uses Modal for ffmpeg processing (same pattern as voice-prosody).
  "/video-to-gif": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleVideoToGif(ctx.request, ctx.db);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: result.status || 422, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },

  // ===========================================================================
  // DATA ROUTES (GET - read only)
  // ===========================================================================
  "/state": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetState(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/state", "GET"),
      });
    },
  },
  "/meters": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetMeters(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/meters", "GET"),
      });
    },
  },
  "/meters/:meter/set": {
    POST: async (ctx: RouteCtx) => {
      const { meter } = ctx.params;
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      const { value, source = "web" } = body;
      const result = await handleSetMeter(ctx.db, meter, value, source);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/meters/:meter/set", "POST"),
      });
    },
  },
  "/meters/batch": {
    POST: async (ctx: RouteCtx) => {
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      const { changes, source = "web" } = body;
      const result = await handleSetMetersBatch(ctx.db, changes, source);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/meters/batch", "POST"),
      });
    },
  },
  // ===========================================================================
  // MINI-APP BATCH ENDPOINT
  // ===========================================================================
  // Single endpoint that returns ALL data needed by the Telegram Mini App.
  // Consolidates 10+ separate API calls into one efficient request.
  // ===========================================================================
  "/mini-app-data": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetMiniAppData(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/mini-app-data", "GET"),
      });
    },
  },
  "/history": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetHistory(ctx.db, ctx.url.searchParams);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/history", "GET"),
      });
    },
  },
  "/cold-storage": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetColdStorage(ctx.db, ctx.url.searchParams);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/cold-storage", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handlePostColdStorage(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/notebook": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetNotebook(ctx.db, ctx.url.searchParams);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/notebook", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handlePostNotebook(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/observations": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetObservations(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/observations", "GET"),
      });
    },
  },
  "/summaries": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetSummaries(ctx.db, ctx.url.searchParams);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/summaries", "GET"),
      });
    },
  },
  // Summary promotion - move summaries to Block 2 (stable context) for tighter cache coupling
  "/summaries/:id/promote": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const result = await handlePromoteSummary(ctx.db, summaryId);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/summaries/:id/demote": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const result = await handleDemoteSummary(ctx.db, summaryId);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  // Summary archival - move summaries between RAG Archive and Dynamic Tail
  "/summaries/:id/activate": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const result = await handleActivateSummary(ctx.db, summaryId);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/summaries/:id/archive": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const result = await handleArchiveSummary(ctx.db, summaryId);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  // Summary sort position - manual ordering override
  "/summaries/:id/position": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      const result = await handleSetSummaryPosition(
        ctx.db,
        summaryId,
        body.position,
      );
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  // Summary backfill - populate covered_start from covered_range
  "/summaries/backfill-covered-start": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleBackfillCoveredStart(ctx.db);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/summaries/backfill-embeddings": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleBackfillEmbeddings(ctx.db, ctx.env);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  // Summary tier - set explicit tier (cached, tail, archived)
  "/summaries/:id/tier": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      const result = await handleSetSummaryTier(ctx.db, summaryId, body.tier);
      if (result.error) {
        return Response.json(
          { error: result.error, success: false },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  // Summary move - move to tier with optional position
  "/summaries/:id/move": {
    POST: async (ctx: RouteCtx) => {
      const summaryId = parseInt(ctx.params.id);
      const body = (await ctx.request.json().catch(() => ({}))) as any;
      const result = await handleMoveSummary(
        ctx.db,
        summaryId,
        body.tier,
        body.position ?? null,
      );
      if (result.error) {
        return Response.json(
          { error: result.error, success: false },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/reminders": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetReminders(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/reminders", "GET"),
      });
    },
  },
  "/cycles": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetCycles(ctx.db, ctx.url.searchParams);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/cycles", "GET"),
      });
    },
  },
  "/gallery": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetGallery(ctx.db, ctx.url.searchParams);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/gallery", "GET"),
      });
    },
  },
  "/profile-picture": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetProfilePicture(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetProfilePicture(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    DELETE: async (ctx: RouteCtx) => {
      const result = await handleDeleteProfilePicture(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/tool-registry": {
    GET: async (ctx: RouteCtx) => {
      return handleGetToolRegistry(ctx);
    },
  },

  // ===========================================================================
  // SETTINGS ROUTES (GET/POST)
  // ===========================================================================
  "/dan-status": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetUserStatus(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/dan-status", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetUserStatus(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/discord-enabled": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetDiscordEnabled(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetDiscordEnabled(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/batch-status": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetBatchStatus(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/batch-enabled": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetBatchEnabled(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetBatchEnabled(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/max-tokens": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetMaxTokens(
        ctx.db,
        (ctx.env.DEFAULT_MAX_OUTPUT_TOKENS as number) || 4000,
      );
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetMaxTokens(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/cost-ceiling": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetCostCeiling(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetCostCeiling(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/streaming": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetStreaming(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetStreaming(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/sleep-status": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetSleepStatus(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    DELETE: async (ctx: RouteCtx) => {
      const result = await handleDeleteSleepStatus(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/interval": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetInterval(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/summarize-settings": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetSummarizeSettings(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetSummarizeSettings(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/auto-summarize-toggle": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetAutoSummarize(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/summarize-prompts": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetSummarizePrompts(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/summarize-prompts", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetSummarizePrompts(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/rag": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetRagConfig(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/rag", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleSetRagConfig(ctx.db, ctx.body);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/start": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleStart(ctx.db);
      return Response.json(
        { ...result, isRunning: true },
        { headers: ctx.corsHeaders },
      );
    },
  },
  "/stop": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleStop(ctx.db);
      return Response.json(
        { ...result, isRunning: false },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // ===========================================================================
  // ACTION ROUTES (POST)
  // ===========================================================================
  "/message": {
    POST: async (ctx: RouteCtx) => {
      const result = await handlePostMessage(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/save-art": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleSaveArt(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },

  // ===========================================================================
  // BRANCH ROUTES
  // ===========================================================================
  "/branches": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetBranches(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/branches", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleCreateBranch(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/branches/active": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetActiveBranch(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/branches/:name/activate": {
    PUT: async (ctx: RouteCtx) => {
      const result = await handleActivateBranch(ctx.db, ctx.params.name);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/branches/:name": {
    DELETE: async (ctx: RouteCtx) => {
      // Requires ADMIN_PASSWORD
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Unauthorized - invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      const result = await handleDeleteBranch(ctx.db, ctx.params.name);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/branches/:name/fork": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleForkBranch(ctx.db, ctx.params.name, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/branches/:name/reset": {
    POST: async (ctx: RouteCtx) => {
      const result = (await handleResetBranch(ctx.db, ctx.params.name)) as any;
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: result.status || 404, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },

  // ===========================================================================
  // MEMORY MANIPULATION ROUTES
  // ===========================================================================
  "/memory/exclude": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleExcludeMemory(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/memory/include": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleIncludeMemory(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  // Branch audit trail — read the active branch's overrides (F-04 fix)
  "/memory/overrides": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetOverrides(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/memory/edit": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleEditMemory(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/memory/reorder": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleReorderMemory(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/memory/synthetic": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetSyntheticMemories(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleAddSyntheticMemory(ctx.db, ctx.body);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/memory/synthetic/:id": {
    PUT: async (ctx: RouteCtx) => {
      const syntheticId = parseInt(ctx.params.id);
      const result = await handleUpdateSyntheticMemory(
        ctx.db,
        syntheticId,
        ctx.body,
      );
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    DELETE: async (ctx: RouteCtx) => {
      // Requires ADMIN_PASSWORD
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Unauthorized - invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      const syntheticId = parseInt(ctx.params.id);
      const result = await handleDeleteSyntheticMemory(ctx.db, syntheticId);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/memory/override/:id": {
    DELETE: async (ctx: RouteCtx) => {
      // Requires ADMIN_PASSWORD
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Unauthorized - invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      const overrideId = parseInt(ctx.params.id);
      const result = await handleRemoveOverride(ctx.db, overrideId);
      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: (result as any).status || 400, headers: ctx.corsHeaders },
        );
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },

  // ===========================================================================
  // PERSONALITY SNAPSHOT ROUTES
  // ===========================================================================
  "/personality/export": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleExportPersonality(
        ctx.db,
        ctx.request,
        ctx.url,
        ctx.env,
      );
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleExportPersonality(
        ctx.db,
        ctx.request,
        ctx.url,
        ctx.env,
      );
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
  },
  "/personality/export/gallery": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleExportGallery(
        ctx.db,
        ctx.request,
        ctx.url,
        ctx.env,
      );
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
  },
  "/personality/import-gallery": {
    POST: async (ctx: RouteCtx) => {
      // Requires ADMIN_PASSWORD
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Unauthorized - invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      const result = await handleImportGallery(ctx.db, ctx.request, {
        resizeImage,
      });
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
  },
  "/personality/import": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleImportPersonality(
        ctx.db,
        ctx.request,
        ctx.url,
        ctx.env,
      );
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
  },
  "/personality/validate": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleValidateSnapshot(ctx.db, ctx.request);
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
  },
  "/personality/preview": {
    POST: async (ctx: RouteCtx) => {
      const result = await handlePreviewImport(ctx.db, ctx.request);
      const headers = new Headers(result.headers);
      for (const [key, value] of Object.entries(ctx.corsHeaders)) {
        headers.set(key, value);
      }
      return new Response(result.body, { status: result.status, headers });
    },
  },

  // ===========================================================================
  // GLOSSARY ROUTES
  // ===========================================================================
  "/glossary": {
    GET: async (ctx: RouteCtx) => {
      return await handleGetGlossary(ctx.db, ctx.url);
    },
    POST: async (ctx: RouteCtx) => {
      return await handlePostGlossary(ctx.db, ctx.request);
    },
  },
  "/glossary/prompt": {
    GET: async (ctx: RouteCtx) => {
      return await handleGetGlossaryPrompt(ctx.db);
    },
  },
  "/glossary/:id": {
    GET: async (ctx: RouteCtx) => {
      return await handleGetGlossaryEntry(ctx.db, ctx.params.id);
    },
    PUT: async (ctx: RouteCtx) => {
      return await handlePutGlossary(ctx.db, ctx.params.id, ctx.request);
    },
    DELETE: async (ctx: RouteCtx) => {
      return await handleDeleteGlossary(
        ctx.db,
        ctx.params.id,
        ctx.request,
        ctx.env,
      );
    },
  },

  // ===========================================================================
  // PERSONA ROUTES
  // ===========================================================================
  "/personas": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleListPersonas(ctx.db, ctx.request, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/personas", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const requestHeaders = new Headers(ctx.request.headers);
      if (ctx.env.ADMIN_PASSWORD) {
        requestHeaders.set("x-internal-admin-password", ctx.env.ADMIN_PASSWORD);
      }
      const internalRequest = new Request(ctx.request, {
        headers: requestHeaders,
      });

      const result = await handleCreatePersona(
        ctx.db,
        internalRequest,
        ctx.url,
      );
      const status = result.status || 200;
      return Response.json(result, { status, headers: ctx.corsHeaders });
    },
  },
  "/personas/active": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetActivePersona(ctx.db, ctx.request, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/personas/active", "GET"),
      });
    },
  },
  "/personas/:id": {
    GET: async (ctx: RouteCtx) => {
      const personaId = parseInt(ctx.params.id, 10);
      const result = await handleGetPersona(
        ctx.db,
        ctx.request,
        ctx.url,
        personaId,
      );
      const status = result.status || 200;
      return Response.json(result, { status, headers: ctx.corsHeaders });
    },
  },
  "/personas/:id/activate": {
    PUT: async (ctx: RouteCtx) => {
      const personaId = parseInt(ctx.params.id, 10);
      const result = await handleActivatePersona(
        ctx.db,
        ctx.request,
        ctx.url,
        personaId,
      );
      const status = result.status || 200;
      return Response.json(result, { status, headers: ctx.corsHeaders });
    },
  },
  "/personas/:id/fork": {
    POST: async (ctx: RouteCtx) => {
      // handleForkPersona returns a Response directly (handles its own CORS)
      return handleForkPersona(
        ctx.db,
        ctx.request,
        ctx.url,
        ctx.params.id,
        ctx.env,
      );
    },
  },

  // ===========================================================================
  // VOICE TRANSCRIPTION ROUTES
  // ===========================================================================
  "/voice-transcriptions": {
    GET: async (ctx: RouteCtx) => {
      return await handleGetVoiceTranscriptions(ctx.db, ctx.url);
    },
  },
  "/voice-transcriptions/:id": {
    GET: async (ctx: RouteCtx) => {
      return await handleGetVoiceTranscription(ctx.db, ctx.params.id);
    },
    PUT: async (ctx: RouteCtx) => {
      return await handlePutVoiceTranscription(
        ctx.db,
        ctx.params.id,
        ctx.request,
      );
    },
    DELETE: async (ctx: RouteCtx) => {
      return await handleDeleteVoiceTranscription(
        ctx.db,
        ctx.params.id,
        ctx.request,
        ctx.env.ADMIN_PASSWORD,
      );
    },
  },

  // ===========================================================================
  // REALTIME VOICE ROUTES
  // ===========================================================================
  "/voice/realtime/start": {
    POST: async (ctx: RouteCtx) => {
      return await handleVoiceRealtimeStart(ctx as any);
    },
  },
  "/voice/realtime/transcript": {
    POST: async (ctx: RouteCtx) => {
      return await handleVoiceRealtimeTranscript(ctx as any);
    },
  },
  "/voice/realtime/end": {
    POST: async (ctx: RouteCtx) => {
      return await handleVoiceRealtimeEnd(ctx as any);
    },
  },

  // ===========================================================================
  // PRICING ROUTE
  // ===========================================================================
  "/pricing": {
    GET: async (ctx: RouteCtx) => {
      return Response.json(
        {
          models: MODEL_PRICING,
          cache: CACHE_PRICING,
          batchDiscount: 0.5,
        },
        { headers: ctx.getResponseHeaders("/pricing", "GET") },
      );
    },
  },

  // ===========================================================================
  // LEARNED ROUTES (Clio's self-knowledge)
  // ===========================================================================
  "/learned": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetLearned(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/learned", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handlePostLearned(ctx.db, ctx.body);
      return Response.json(result, {
        status: result.status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },
  "/learned/:id": {
    DELETE: async (ctx: RouteCtx) => {
      const id = parseInt(ctx.params.id);
      const result = await handleDeleteLearned(
        ctx.db,
        id,
        ctx.body?.password,
        ctx.env.ADMIN_PASSWORD,
      );
      return Response.json(result, {
        status: result.status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },

  // ===========================================================================
  // QUESTIONS ROUTES (Clio's open questions)
  // ===========================================================================
  "/questions": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetQuestions(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/questions", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handlePostQuestion(ctx.db, ctx.body);
      return Response.json(result, {
        status: result.status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },

  // ===========================================================================
  // BATCH ROUTES
  // ===========================================================================
  "/batches": {
    GET: async (ctx: RouteCtx) => {
      const { listPendingBatches, getBatchTimeout } =
        await import("../db/batches.js");
      const batches = await listPendingBatches(ctx.db);
      const timeout = await getBatchTimeout(ctx.db);
      return Response.json(
        { batches, timeout, count: batches.length },
        { headers: ctx.corsHeaders },
      );
    },
  },
  "/batches/:id/cancel": {
    POST: async (ctx: RouteCtx) => {
      const batchId = ctx.params.id;
      const { cancelBatch } = await import("../db/batches.js");
      const result = await cancelBatch(
        batchId,
        ctx.env.ANTHROPIC_API_KEY,
        ctx.db,
        { cancelledBy: "user" },
      );
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/batch-timeout": {
    GET: async (ctx: RouteCtx) => {
      const { getBatchTimeout } = await import("../db/batches.js");
      const timeout = await getBatchTimeout(ctx.db);
      const custom = await getState(ctx.db, "batch_timeout_seconds");
      return Response.json(
        { timeout, isAuto: !custom || custom === "auto" },
        { headers: ctx.corsHeaders },
      );
    },
    POST: async (ctx: RouteCtx) => {
      const { setBatchTimeout } = await import("../db/batches.js");
      const result = await setBatchTimeout(ctx.db, ctx.body.timeout);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },
  "/batch-hard-timeout": {
    GET: async (ctx: RouteCtx) => {
      const { getBatchHardTimeout } = await import("../db/batches.js");
      const { BATCH_HARD_TIMEOUT_SECONDS } = await import("../constants.js");
      const hardTimeout = await getBatchHardTimeout(ctx.db);
      const custom = await getState(ctx.db, "batch_hard_timeout_seconds");
      return Response.json(
        {
          hardTimeout,
          isDefault: !custom || custom === "auto",
          defaultValue: BATCH_HARD_TIMEOUT_SECONDS,
        },
        { headers: ctx.corsHeaders },
      );
    },
    POST: async (ctx: RouteCtx) => {
      const { setBatchHardTimeout } = await import("../db/batches.js");
      const result = await setBatchHardTimeout(ctx.db, ctx.body.timeout);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },

  // ===========================================================================
  // PINNED IMAGES ROUTES
  // ===========================================================================
  "/pinned-images": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetPinnedImages(ctx.db);
      return Response.json(result, { headers: ctx.corsHeaders });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handlePinnedImagesOp(ctx.db, ctx.body);
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },

  // ===========================================================================
  // GALLERY OPERATIONS
  // ===========================================================================

  "/inject-art": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleInjectArt(ctx.db, ctx.body);
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },

  "/gallery/:id": {
    DELETE: async (ctx: RouteCtx) => {
      const id = parseInt(ctx.params.id);
      const result = await handleDeleteGalleryImage(ctx.db, id);
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },
  "/gallery/:id/blur": {
    POST: async (ctx: RouteCtx) => {
      const id = parseInt(ctx.params.id);
      const result = await handleToggleBlur(ctx.db, id, ctx.body);
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },
  "/gallery/:id/vault": {
    POST: async (ctx: RouteCtx) => {
      const id = parseInt(ctx.params.id);
      const result = await handleToggleVault(ctx.db, id, ctx.body);
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },
  "/history/:id": {
    DELETE: async (ctx: RouteCtx) => {
      const id = parseInt(ctx.params.id);
      const result = await handleDeleteHistoryEntry(
        ctx.db,
        id,
        ctx.body?.password,
        ctx.env.ADMIN_PASSWORD,
      );
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },

  // ===========================================================================
  // NOTEBOOK/STORAGE DELETE
  // ===========================================================================
  "/cold-storage/:id": {
    DELETE: async (ctx: RouteCtx) => {
      const result = await handleDeleteColdStorage(
        ctx.db,
        ctx.params.id,
        ctx.body?.password,
        ctx.env.ADMIN_PASSWORD,
      );
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },
  "/notebook/:title": {
    DELETE: async (ctx: RouteCtx) => {
      const result = await handleDeleteNotebook(
        ctx.db,
        ctx.params.title,
        ctx.body?.password,
        ctx.env.ADMIN_PASSWORD,
      );
      return Response.json(result, {
        status: (result as any).status || 200,
        headers: ctx.corsHeaders,
      });
    },
  },

  // ===========================================================================
  // MODEL/SETTINGS ROUTES
  // ===========================================================================
  // GET /models — the D1-backed model registry (doctrine I1). UIs render their
  // pickers from THIS, never from hardcoded id lists. selectedModel reflects
  // the full resolution ladder for the active persona.
  "/models": {
    GET: async (ctx: RouteCtx) => {
      const { MODEL_REGISTRY_SEED } = await import("../constants.js");
      const { getModelRegistry, resolveEffectiveModel } = await import("@persistence/db");
      const registry = await getModelRegistry(asDrizzleDb(ctx.db), MODEL_REGISTRY_SEED);
      const selectedModel = await resolveEffectiveModel(asDrizzleDb(ctx.db), {
        seed: MODEL_REGISTRY_SEED,
      });
      return Response.json(
        { ...registry, selectedModel, source: "d1" },
        { headers: ctx.getResponseHeaders("/models", "GET") },
      );
    },
  },
  "/model": {
    POST: async (ctx: RouteCtx) => {
      // Registry-validated (was: hardcoded 3-model triple — ledger S1). The
      // set of valid models is the D1 registry; editing D1 changes it live.
      const { MODEL_REGISTRY_SEED } = await import("../constants.js");
      const { getModelRegistry } = await import("@persistence/db");
      const { model } = ctx.body;
      const registry = await getModelRegistry(asDrizzleDb(ctx.db), MODEL_REGISTRY_SEED);
      if (!registry.models.some((m) => m.id === model)) {
        return Response.json(
          {
            error: `Invalid model. Must be one of: ${registry.models.map((m) => m.id).join(", ")}`,
          },
          { status: 400, headers: ctx.corsHeaders },
        );
      }
      await setState(ctx.db, "selected_model", model);
      return Response.json(
        { success: true, selectedModel: model },
        { headers: ctx.corsHeaders },
      );
    },
  },
  "/summarization-stats": {
    GET: async (ctx: RouteCtx) => {
      const { getHistoryCount, getActiveCount } =
        await import("../db/index.js");
      const [
        lastSummarizeRaw,
        lastMetaRaw,
        historyCount,
        summarizeThreshold,
        summaryCount,
        metaThreshold,
      ] = await Promise.all([
        getState(ctx.db, "last_summarize_run"),
        getState(ctx.db, "last_meta_run"),
        getHistoryCount(ctx.db),
        getState(ctx.db, "summarize_threshold"),
        getActiveCount(ctx.db),
        getState(ctx.db, "meta_summarize_threshold"),
      ]);

      return Response.json(
        {
          lastSummarize: lastSummarizeRaw ? JSON.parse(lastSummarizeRaw) : null,
          lastMeta: lastMetaRaw ? JSON.parse(lastMetaRaw) : null,
          currentStats: {
            historyCount,
            summarizeThreshold: parseInt(summarizeThreshold || "30"),
            summaryCount,
            metaThreshold: parseInt(metaThreshold || "10"),
          },
        },
        { headers: ctx.corsHeaders },
      );
    },
  },
  "/manual-search": {
    POST: async (ctx: RouteCtx) => {
      const { query } = ctx.body;
      if (!query) {
        return Response.json(
          { error: "Query required" },
          { status: 400, headers: ctx.corsHeaders },
        );
      }
      await logHistory({
        db: ctx.db,
        type: "search_query",
        content: query,
        internal: "Manual search injection",
      });

      // Use ClaudeSearchProvider directly
      const provider = ClaudeSearchProvider.fromCredentials(
        ctx.env.ANTHROPIC_API_KEY,
      );
      const result = await provider.search(query);
      const searchResult = result.success
        ? { result: result.data.summary }
        : { error: result.error?.message ?? "Search failed" };

      if (searchResult.result) {
        await logHistory({
          db: ctx.db,
          type: "search_result",
          content: searchResult.result,
          internal: `Results for: ${query}`,
        });
        return Response.json(
          {
            success: true,
            result: searchResult.result.substring(0, 500) + "...",
          },
          { headers: ctx.corsHeaders },
        );
      } else {
        return Response.json(
          { error: searchResult.error || "Search failed" },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // ===========================================================================
  // TTS/VOICE ROUTES
  // ===========================================================================
  "/tts-generate": {
    POST: async (ctx: RouteCtx) => {
      const { bytesToBase64 } = await import("../utils/image.js");
      const text = ctx.body.text;
      const requestStability = ctx.body.stability;
      const requestSpeed = ctx.body.speed;

      if (!text || text.trim().length === 0) {
        return Response.json(
          { success: false, error: "Text is required" },
          { status: 400, headers: ctx.corsHeaders },
        );
      }

      const ttsModel = (await getState(ctx.db, "tts_model")) || "v2";
      const stabilityStr = await getState(ctx.db, "tts_stability");
      const stability =
        requestStability ??
        (stabilityStr !== null ? parseFloat(stabilityStr!) : 0.5);
      const speed = requestSpeed ?? 1.0;
      const ttsResult = await textToSpeech(text, ctx.env, {
        modelId: ttsModel,
        stability,
        speed,
      });
      if (!ttsResult.success) {
        return Response.json(
          { success: false, error: ttsResult.error },
          { status: 500, headers: ctx.corsHeaders },
        );
      }

      // Save to voice history (persona-scoped)
      try {
        const audioBase64 = bytesToBase64(new Uint8Array(ttsResult.audio!));
        await addVoiceHistory(ctx.db, {
          text,
          model: ttsModel,
          stability: stability ?? null,
          audioBase64,
          charCount: text.length,
          createdAt: new Date().toISOString(),
        });
      } catch (historyErr) {
        console.error("Failed to save voice history:", historyErr);
      }

      // Return audio binary
      return new Response(ttsResult.audio!, {
        status: 200,
        headers: {
          ...ctx.corsHeaders,
          "Content-Type": "audio/mpeg",
          "Content-Length": ttsResult.audio!.byteLength.toString(),
        },
      });
    },
  },
  "/voice-history": {
    GET: async (ctx: RouteCtx) => {
      const limit = Math.min(
        parseInt(ctx.url.searchParams.get("limit") || "20"),
        100,
      );
      const offset = parseInt(ctx.url.searchParams.get("offset") || "0");

      const items = await listVoiceHistory(ctx.db, { limit, offset });
      const total = await countVoiceHistory(ctx.db);

      return Response.json(
        {
          success: true,
          items,
          total,
          limit,
          offset,
        },
        { headers: ctx.getResponseHeaders("/voice-history", "GET") },
      );
    },
  },
  "/voice-history/:id/audio": {
    GET: async (ctx: RouteCtx) => {
      const id = parseInt(ctx.params.id);
      if (isNaN(id)) {
        return Response.json(
          { success: false, error: "Invalid ID" },
          { status: 400, headers: ctx.corsHeaders },
        );
      }

      const entry = await getVoiceHistoryAudioById(ctx.db, id);
      if (!entry) {
        return Response.json(
          { success: false, error: "Not found" },
          { status: 404, headers: ctx.corsHeaders },
        );
      }

      // Decode base64 to binary
      const binaryString = atob(entry.audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return new Response(bytes, {
        status: 200,
        headers: {
          ...ctx.corsHeaders,
          "Content-Type": "audio/mpeg",
        },
      });
    },
  },
  "/tts-credits": {
    GET: async (ctx: RouteCtx) => {
      const apiKey = ctx.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return Response.json(
          { success: false, error: "ELEVENLABS_API_KEY not configured" },
          { headers: ctx.corsHeaders },
        );
      }

      try {
        const response = await fetch(
          "https://api.elevenlabs.io/v1/user/subscription",
          {
            method: "GET",
            headers: { "xi-api-key": apiKey },
          },
        );

        if (!response.ok) {
          return Response.json(
            {
              success: false,
              error: `ElevenLabs API error: ${response.status}`,
            },
            { headers: ctx.corsHeaders },
          );
        }

        const data = (await response.json()) as any;
        return Response.json(
          {
            success: true,
            character_count: data.character_count,
            character_limit: data.character_limit,
            characters_remaining: data.character_limit - data.character_count,
            next_reset_unix: data.next_character_count_reset_unix,
            tier: data.tier,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (err: unknown) {
        return Response.json(
          {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
          { headers: ctx.corsHeaders },
        );
      }
    },
  },
  "/elevenlabs-history": {
    GET: async (ctx: RouteCtx) => {
      const apiKey = ctx.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return Response.json(
          { success: false, error: "ELEVENLABS_API_KEY not configured" },
          { headers: ctx.corsHeaders },
        );
      }

      try {
        const response = await fetch(
          "https://api.elevenlabs.io/v1/history?page_size=20",
          {
            method: "GET",
            headers: { "xi-api-key": apiKey },
          },
        );

        if (!response.ok) {
          return Response.json(
            {
              success: false,
              error: `ElevenLabs API error: ${response.status}`,
            },
            { headers: ctx.corsHeaders },
          );
        }

        const data = (await response.json()) as any;
        const items = (data.history || []).map((h: any) => ({
          id: h.history_item_id,
          text: h.text,
          date: h.date_unix ? new Date(h.date_unix * 1000).toISOString() : null,
          character_count: h.character_count_change_from,
          voice_name: h.voice_name,
          model_id: h.model_id,
          state: h.state,
        }));
        return Response.json(
          {
            success: true,
            items,
            total: items.length,
            has_more: data.has_more,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (err: unknown) {
        return Response.json(
          {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
          { headers: ctx.corsHeaders },
        );
      }
    },
  },
  "/elevenlabs-backfill": {
    POST: async (ctx: RouteCtx) => {
      const { bytesToBase64 } = await import("../utils/image.js");
      const apiKey = ctx.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return Response.json(
          { success: false, error: "ELEVENLABS_API_KEY not configured" },
          { headers: ctx.corsHeaders },
        );
      }

      try {
        const historyResponse = await fetch(
          "https://api.elevenlabs.io/v1/history?page_size=50",
          {
            headers: { "xi-api-key": apiKey },
          },
        );
        if (!historyResponse.ok) {
          return Response.json(
            {
              success: false,
              error: `History fetch failed: ${historyResponse.status}`,
            },
            { headers: ctx.corsHeaders },
          );
        }
        const historyData = (await historyResponse.json()) as any;
        const allItems = historyData.history || [];

        let imported = 0;
        let skipped = 0;
        let noText = 0;
        const errors = [];

        for (const item of allItems) {
          try {
            const hasOriginalText = !!item.text;
            const text =
              item.text ||
              `[Voice message - ${item.voice_name || "unknown voice"}]`;
            if (!hasOriginalText) noText++;

            const timestamp = item.date_unix
              ? new Date(item.date_unix * 1000)
                  .toISOString()
                  .replace("T", " ")
                  .replace("Z", "")
              : null;

            // Persona-scoped existence check
            const existing =
              hasOriginalText
                ? await findVoiceHistoryIdByText(ctx.db, text)
                : timestamp
                  ? await findVoiceHistoryIdByCreatedAt(ctx.db, timestamp)
                  : null;

            if (existing) {
              skipped++;
              continue;
            }

            const audioResponse = await fetch(
              `https://api.elevenlabs.io/v1/history/${item.history_item_id}/audio`,
              {
                headers: { "xi-api-key": apiKey },
              },
            );

            if (!audioResponse.ok) {
              errors.push(
                `Audio fetch failed for ${item.history_item_id}: ${audioResponse.status}`,
              );
              continue;
            }

            const audioBuffer = await audioResponse.arrayBuffer();
            const audioBase64 = bytesToBase64(new Uint8Array(audioBuffer));

            const modelMap = {
              eleven_multilingual_v2: "v2",
              eleven_v3: "v3",
              eleven_flash_v2_5: "flash",
              eleven_turbo_v2_5: "turbo",
            };
            const model =
              (modelMap as Record<string, string>)[item.model_id] ||
              item.model_id;

            await addVoiceHistory(ctx.db, {
              text,
              model,
              stability: null,
              audioBase64,
              charCount: text.length,
              createdAt: timestamp,
            });

            imported++;
          } catch (itemErr) {
            errors.push(
              `Error processing ${item.history_item_id}: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`,
            );
          }
        }

        return Response.json(
          {
            success: true,
            imported,
            skipped,
            no_text_count: noText,
            total_in_elevenlabs: allItems.length,
            errors: errors.length > 0 ? errors : undefined,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (err: unknown) {
        return Response.json(
          {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
          { headers: ctx.corsHeaders },
        );
      }
    },
  },
  "/voice-history-match": {
    POST: async (ctx: RouteCtx) => {
      try {
        const placeholders = await listVoiceHistoryPlaceholders(ctx.db);
        const raw = ctx.db.$client;

        let matched = 0;
        const updates = [];

        for (const vh of placeholders) {
          const historyEntry = await raw
            .prepare(
              `
            SELECT content FROM history
            WHERE type = 'message_to_dan'
            AND ABS(strftime('%s', created_at) - strftime('%s', ?)) <= 5
            LIMIT 1
          `,
            )
            .bind(vh.created_at)
            .first<{ content: string }>();

          if (historyEntry && historyEntry.content) {
            await updateVoiceHistoryText(ctx.db, {
              id: vh.id,
              text: historyEntry.content,
            });
            matched++;
            updates.push({
              id: vh.id,
              timestamp: vh.created_at,
              text_preview: historyEntry.content.slice(0, 60),
            });
          }
        }

        return Response.json(
          {
            success: true,
            placeholders_found: (placeholders.results || []).length,
            matched,
            updates,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (err: unknown) {
        return Response.json(
          {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
          { headers: ctx.corsHeaders },
        );
      }
    },
  },
  "/tts-model": {
    GET: async (ctx: RouteCtx) => {
      const currentModel = (await getState(ctx.db, "tts_model")) || "v2";
      const stabilityStr = await getState(ctx.db, "tts_stability");
      const stability = stabilityStr !== null ? parseFloat(stabilityStr!) : 0.5;
      const speedStr = await getState(ctx.db, "tts_speed");
      const speed = speedStr !== null ? parseFloat(speedStr!) : 1.0;
      return Response.json(
        {
          success: true,
          model: currentModel,
          stability: stability,
          speed: speed,
          models: {
            v3: "eleven_v3",
            v2: "eleven_multilingual_v2",
            flash: "eleven_flash_v2_5",
            turbo: "eleven_turbo_v2_5",
          },
        },
        { headers: ctx.corsHeaders },
      );
    },
    POST: async (ctx: RouteCtx) => {
      const validModels = ["v3", "v2", "flash", "turbo"];
      if (!ctx.body.model || !validModels.includes(ctx.body.model)) {
        return Response.json(
          {
            success: false,
            error: `Invalid model. Valid: ${validModels.join(", ")}`,
          },
          { status: 400, headers: ctx.corsHeaders },
        );
      }
      await setState(ctx.db, "tts_model", ctx.body.model);

      if (ctx.body.stability !== undefined) {
        const validStability = [0, 0.5, 1];
        if (validStability.includes(ctx.body.stability)) {
          await setState(
            ctx.db,
            "tts_stability",
            ctx.body.stability.toString(),
          );
        }
      }

      if (ctx.body.speed !== undefined) {
        const speed = parseFloat(ctx.body.speed);
        if (!isNaN(speed) && speed >= 0.7 && speed <= 1.2) {
          await setState(ctx.db, "tts_speed", speed.toString());
        }
      }

      return Response.json(
        {
          success: true,
          model: ctx.body.model,
          stability: ctx.body.stability,
          speed: ctx.body.speed,
        },
        { headers: ctx.corsHeaders },
      );
    },
  },
  "/sum-model": {
    GET: async (ctx: RouteCtx) => {
      const { getSummarizationModel } = await import("@persistence/llm");
      const config = await getSummarizationModel(asDrizzleDb(ctx.db));
      const providerStatus = getRouteProviderStatus(ctx.env);
      return Response.json(
        { success: true, ...config, providerStatus },
        { headers: ctx.corsHeaders },
      );
    },
    POST: async (ctx: RouteCtx) => {
      const { setSummarizationModel } = await import("@persistence/llm");
      const { provider, model } = ctx.body;
      if (!provider || !model) {
        return Response.json(
          {
            success: false,
            error:
              'Missing provider or model. Example: {"provider": "openai", "model": "4.1mini"}',
          },
          { status: 400, headers: ctx.corsHeaders },
        );
      }

      const unavailableReason = getUnavailableProviderReason(ctx.env, provider);
      if (unavailableReason) {
        return Response.json(
          {
            success: false,
            error: `Provider ${provider} is unavailable: ${unavailableReason}`,
          },
          { status: 400, headers: ctx.corsHeaders },
        );
      }

      const result = await setSummarizationModel(asDrizzleDb(ctx.db), provider, model);
      if (!result.success) {
        return Response.json(result, {
          status: 400,
          headers: ctx.corsHeaders,
        });
      }

      const { getSummarizationModel } = await import("@persistence/llm");
      const config = await getSummarizationModel(asDrizzleDb(ctx.db));
      return Response.json(
        {
          ...result,
          ...config,
          providerStatus: getRouteProviderStatus(ctx.env),
        },
        {
          status: result.success ? 200 : 400,
          headers: ctx.corsHeaders,
        },
      );
    },
  },
  "/meta-model": {
    GET: async (ctx: RouteCtx) => {
      const { getModelConfig } = await import("@persistence/llm");
      const config = await getModelConfig(asDrizzleDb(ctx.db), "metasummarize");
      const providerStatus = getRouteProviderStatus(ctx.env);
      return Response.json(
        { success: true, ...config, providerStatus },
        { headers: ctx.corsHeaders },
      );
    },
    POST: async (ctx: RouteCtx) => {
        const { setModelConfig, clearModelConfig, getModelConfig } =
        await import("@persistence/llm");
      const { provider, model } = ctx.body;

      // Handle 'inherit' or empty to clear and use summarize settings
      if (!provider || provider === "inherit") {
        const clearResult = await clearModelConfig(asDrizzleDb(ctx.db), "metasummarize");
        if (!clearResult.success) {
          return Response.json(clearResult, {
            status: 400,
            headers: ctx.corsHeaders,
          });
        }
        // Return the inherited config
        const inheritedConfig = await getModelConfig(asDrizzleDb(ctx.db), "metasummarize");
        return Response.json(
          {
            success: true,
            cleared: true,
            message: "Meta-summarization will now use summarization settings",
            ...inheritedConfig,
            providerStatus: getRouteProviderStatus(ctx.env),
          },
          { headers: ctx.corsHeaders },
        );
      }

      const unavailableReason = getUnavailableProviderReason(ctx.env, provider);
      if (unavailableReason) {
        return Response.json(
          {
            success: false,
            error: `Provider ${provider} is unavailable: ${unavailableReason}`,
          },
          { status: 400, headers: ctx.corsHeaders },
        );
      }

      const result = await setModelConfig(
        asDrizzleDb(ctx.db),
        "metasummarize",
        provider,
        model,
      );
      if (!result.success) {
        return Response.json(result, {
          status: 400,
          headers: ctx.corsHeaders,
        });
      }

      const currentConfig = await getModelConfig(asDrizzleDb(ctx.db), "metasummarize");
      return Response.json(
        {
          ...result,
          ...currentConfig,
          providerStatus: getRouteProviderStatus(ctx.env),
        },
        {
          status: 200,
          headers: ctx.corsHeaders,
        },
      );
    },
  },
  "/count-tokens": {
    POST: async (ctx: RouteCtx) => {
      try {
        const { countTokensForProvider, countContextTokens } =
          await import("../services/tokenizer.js");

        if (ctx.body.text) {
          // Use unified token counter - routes to tiktoken for OpenAI, API for Anthropic
          const result = await countTokensForProvider(ctx.body.text, ctx.env, {
            provider: ctx.body.provider || "anthropic",
            model: ctx.body.model,
          });

          return Response.json(
            {
              success: true,
              tokens: result.tokens,
              model: result.model,
              provider: result.provider,
              method: result.method,
              characters: ctx.body.text.length,
              estimate: Math.ceil(ctx.body.text.length / 3.5),
              ...(result.error && { warning: result.error }),
            },
            { headers: ctx.corsHeaders },
          );
        }

        if (ctx.body.system || ctx.body.messages) {
          const result = await countContextTokens(
            { system: ctx.body.system, messages: ctx.body.messages },
            ctx.env.ANTHROPIC_API_KEY,
            { model: ctx.body.model },
          );
          if (result.error) {
            return Response.json(
              { success: false, error: result.error },
              { status: 500, headers: ctx.corsHeaders },
            );
          }
          return Response.json(
            {
              success: true,
              tokens: result.tokens,
            },
            { headers: ctx.corsHeaders },
          );
        }

        return Response.json(
          {
            success: false,
            error: "Missing required parameter: text, system, or messages",
          },
          { status: 400, headers: ctx.corsHeaders },
        );
      } catch (e: unknown) {
        return Response.json(
          { success: false, error: e instanceof Error ? e.message : String(e) },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // ===========================================================================
  // SIM ROUTES (Semantic Identity Monitor)
  // ===========================================================================
  "/sim/embeddings/status": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleSimEmbeddingsStatus(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/embeddings/status", "GET"),
      });
    },
  },
  "/sim/embeddings/export": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleSimEmbeddingsExport(ctx.db, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/embeddings/export", "GET"),
      });
    },
  },
  "/sim/embeddings/backfill": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleSimEmbeddingsBackfill(
        ctx.db,
        ctx.env,
        ctx.body,
      );
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/sim/embeddings/backfill", "POST"),
      });
    },
  },
  "/sim/basin": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetBasin(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/basin", "GET"),
      });
    },
  },
  "/sim/basin/compute": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleComputeBasin(ctx.db, ctx.env, ctx.body);
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/sim/basin/compute", "POST"),
      });
    },
  },
  "/sim/basin/weekly": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetWeeklyBasin(ctx.db, ctx.url);
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/sim/basin/weekly", "GET"),
      });
    },
  },
  "/sim/basin/trajectory": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetTrajectory(ctx.db, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/basin/trajectory", "GET"),
      });
    },
  },
  "/sim/direction/compute": {
    POST: async (ctx: RouteCtx) => {
      const result = await handleComputeDirection(ctx.db, ctx.body);
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/sim/direction/compute", "POST"),
      });
    },
  },
  "/sim/axes": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetAxes(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/axes", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handleCreateAxis(ctx.db, ctx.body);
      return Response.json(result, {
        status: result.success === false ? 400 : 201,
        headers: ctx.getResponseHeaders("/sim/axes", "POST"),
      });
    },
  },
  "/sim/axes/:id": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetAxis(ctx.db, ctx.params.id);
      return Response.json(result, {
        status: result.success === false ? 404 : 200,
        headers: ctx.getResponseHeaders("/sim/axes/:id", "GET"),
      });
    },
    PUT: async (ctx: RouteCtx) => {
      const result = await handleUpdateAxis(ctx.db, ctx.params.id, ctx.body);
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/sim/axes/:id", "PUT"),
      });
    },
    DELETE: async (ctx: RouteCtx) => {
      const result = await handleDeleteAxis(ctx.db, ctx.params.id);
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/sim/axes/:id", "DELETE"),
      });
    },
  },
  "/sim/axes/:id/scores": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetAxisScores(ctx.db, ctx.params.id, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/axes/:id/scores", "GET"),
      });
    },
  },
  "/sim/anomalies": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetAnomalies(ctx.db, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/anomalies", "GET"),
      });
    },
  },
  "/sim/export": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleSimExport(ctx.db, ctx.url);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/sim/export", "GET"),
      });
    },
  },

  // ===========================================================================
  // SUMMARY CONFIG ROUTES
  // ===========================================================================
  "/summary-config": {
    GET: async (ctx: RouteCtx) => {
      const result = await handleGetSummaryConfig(ctx.db);
      return Response.json(result, {
        headers: ctx.getResponseHeaders("/summary-config", "GET"),
      });
    },
    POST: async (ctx: RouteCtx) => {
      const result = await handlePostSummaryConfig(ctx.db, ctx.body);
      return Response.json(result, {
        status: result.success === false ? 400 : 200,
        headers: ctx.getResponseHeaders("/summary-config", "POST"),
      });
    },
  },

  // ===========================================================================
  // RESET HISTORY BOUNDARY ROUTE
  // ===========================================================================
  "/reset-history-boundary": {
    POST: async (ctx: RouteCtx) => {
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      await setState(ctx.db, "history_prefix_boundary_id", null);
      console.log(
        "[Cache] Reset history prefix boundary - will recalculate on next cycle",
      );
      return Response.json(
        {
          success: true,
          message:
            "History prefix boundary reset. Will recalculate on next thinking cycle for optimal caching.",
        },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // ===========================================================================
  // MIGRATION ROUTE
  // ===========================================================================
  "/migrate": {
    POST: async (ctx: RouteCtx) => {
      return handleMigrate(ctx.db, ctx.body, ctx.env, ctx.corsHeaders);
    },
  },

  // ===========================================================================
  // ADMIN ROUTES
  // ===========================================================================
  "/reset-telegram-webhook": {
    POST: async (ctx: RouteCtx) => {
      // Requires ADMIN_PASSWORD
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Unauthorized - invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      const token = ctx.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return Response.json(
          { success: false, error: "TELEGRAM_BOT_TOKEN not configured" },
          { status: 500, headers: ctx.corsHeaders },
        );
      }

      try {
        const deleteResp = await fetch(
          `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`,
        );
        const deleteResult = await deleteResp.json();

        const webhookUrl =
          "https://claude-existence-loop.dan-guilliams.workers.dev/telegram";
        const setResp = await fetch(
          `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`,
        );
        const setResult = (await setResp.json()) as Record<string, any>;

        return Response.json(
          {
            success: setResult.ok,
            deleteResult,
            setResult,
            message: setResult.ok
              ? "Webhook reset and pending updates cleared!"
              : "Failed to reset webhook",
          },
          { headers: ctx.corsHeaders },
        );
      } catch (e: unknown) {
        return Response.json(
          { success: false, error: e instanceof Error ? e.message : String(e) },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // ===========================================================================
  // FORMERLY FALLBACK ROUTES (migrated from index.ts if/elseif block)
  // ===========================================================================

  // GET /rag-debug - Debug RAG retrieval system
  "/rag-debug": {
    GET: async (ctx: RouteCtx) => {
      try {
        const ragConfig = await getRagConfig(ctx.db);
        const allSummaries = await ctx.db
          .prepare(
            "SELECT id, length(embedding) as emb_len, embedding_model FROM summaries",
          )
          .all<{ id: number; emb_len: number; embedding_model: string }>();
        const withEmbeddings = allSummaries.results.filter(
          (s) => s.emb_len > 0,
        );

        let embeddingDiagnostic: Record<string, unknown> | null = null;
        if (withEmbeddings.length > 0) {
          const testSummary = await ctx.db
            .prepare(
              "SELECT id, embedding FROM summaries WHERE embedding IS NOT NULL LIMIT 1",
            )
            .first<{ id: number; embedding: ArrayBuffer }>();
          if (testSummary?.embedding) {
            const emb = testSummary.embedding as any;
            embeddingDiagnostic = {
              id: testSummary.id,
              type: Object.prototype.toString.call(emb),
              length: emb.byteLength || emb.length || "unknown",
              isArrayBuffer: testSummary.embedding instanceof ArrayBuffer,
              constructorName: emb.constructor?.name,
            };
          }
        }

        let embGenTest = null;
        if (ctx.env.AI) {
          try {
            const provider = CloudflareEmbeddingProvider.fromBinding(
              ctx.env.AI,
            );
            const testResult = await provider.generate(
              "test query for RAG debug",
            );
            embGenTest = {
              success: testResult.success,
              dimensions: testResult.success
                ? testResult.data?.length
                : undefined,
              error: testResult.success ? undefined : testResult.error?.message,
            };
          } catch (e: unknown) {
            embGenTest = {
              success: false,
              error: e instanceof Error ? e.message : String(e),
            };
          }
        }

        return Response.json(
          {
            config: ragConfig,
            summaries: {
              total: allSummaries.results.length,
              withEmbeddings: withEmbeddings.length,
              withoutEmbeddings:
                allSummaries.results.length - withEmbeddings.length,
            },
            embeddingDiagnostic,
            embeddingGenerationTest: embGenTest,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (e: unknown) {
        return Response.json(
          {
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
          },
          { headers: ctx.corsHeaders },
        );
      }
    },
  },

  // GET /context - Get the full system prompt that Claude sees
  "/context": {
    GET: async (ctx: RouteCtx) => {
      try {
        const result = await buildSystemPrompt(ctx.db, ctx.env);
        const characterCount = result.systemPrompt.length;
        const block1Tokens =
          estimateTokens(result.block1_constitution) +
          estimateTokens(result.block1Extensions);
        const block2Tokens = estimateTokens(result.block2_promotedSummaries);
        const block3Tokens = estimateTokens(result.block3_stableAndSummaries);
        const block4Tokens = estimateTokens(result.block4_freshTail);
        const totalTokens =
          block1Tokens + block2Tokens + block3Tokens + block4Tokens;
        const estimatedOutputTokens = 300;

        return Response.json(
          {
            systemPrompt: result.systemPrompt,
            stats: {
              historyCount: result.historyCount,
              summariesCount: result.summariesCount,
              remindersCount: result.remindersCount,
              coldStorageCount: result.coldStorageCount,
              learnedCount: result.learnedCount,
              questionsCount: result.questionsCount,
              notebookCount: result.notebookCount,
              observationsCount: result.observationsCount,
              imagesCount: result.userImages.length,
              claudeArtCount: result.claudeArtImages.length,
              activeBranch: result.activeBranch,
              ragRetrievedCount: result.ragRetrievedCount || 0,
              ragRetrievedSummaries: result.ragRetrievedSummaries || [],
              estimatedInputTokens: totalTokens,
              estimatedOutputTokens,
              ragTokens: (result.ragRetrievedSummaries || []).reduce(
                (sum: number, s: any) => sum + (s.tokenCount || 0),
                0,
              ),
              tokenBreakdown: {
                block1_system: block1Tokens,
                block2_stable: block2Tokens,
                block3_summariesPrefix: block3Tokens,
                block4_fresh: block4Tokens,
                ragArchive: (result.ragRetrievedSummaries || []).reduce(
                  (sum: number, s: any) => sum + (s.tokenCount || 0),
                  0,
                ),
                total: totalTokens,
                cachedTokens: block1Tokens + block2Tokens + block3Tokens,
                uncachedTokens: block4Tokens,
              },
              cacheStrategy: result.cacheStrategy,
            },
            characterCount,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (e: unknown) {
        console.error("buildSystemPrompt error:", e);
        return Response.json(
          {
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
          },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // POST /batch-process - Manually trigger batch processing
  "/batch-process": {
    POST: async (ctx: RouteCtx) => {
      const result = await processPendingBatches(ctx.env, {
        streamActionToTelegram: async () => {},
      });
      return Response.json(
        {
          success: true,
          processed: result.processed,
          errors: result.errors,
        },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // POST /batch-cancel - Cancel a pending batch
  "/batch-cancel": {
    POST: async (ctx: RouteCtx) => {
      const { batchId } = ctx.body || {};
      const pendingBatches = await getPendingBatches(ctx.db);

      if (pendingBatches.length === 0) {
        return Response.json(
          { success: false, error: "No pending batches" },
          { headers: ctx.corsHeaders },
        );
      }

      let targetBatch;
      if (batchId) {
        targetBatch = pendingBatches.find(
          (b: any) => b.batch_id === batchId || b.batch_id.includes(batchId),
        );
        if (!targetBatch) {
          return Response.json(
            {
              success: false,
              error: `No pending batch found matching "${batchId}"`,
            },
            { headers: ctx.corsHeaders },
          );
        }
      } else {
        targetBatch = pendingBatches[0];
      }

      const result = await cancelBatch(
        targetBatch.batch_id,
        ctx.env.ANTHROPIC_API_KEY,
        ctx.db,
      );

      if (result.success) {
        return Response.json(
          {
            success: true,
            batchId: targetBatch.batch_id,
            status: result.status,
            cancelInitiatedAt: result.cancelInitiatedAt,
            message:
              "Batch cancellation initiated. In-progress requests may still complete.",
          },
          { headers: ctx.corsHeaders },
        );
      } else {
        return Response.json(
          { success: false, error: result.error },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // POST /metasummarize - Consolidate multiple summaries into one
  "/metasummarize": {
    POST: async (ctx: RouteCtx) => {
      const { ids, indices } = ctx.body || {};
      let parsedIndices: number[] | null = null;

      if (ids && Array.isArray(ids) && ids.length > 0) {
        const activeSummaries = await getActiveSummaries(ctx.db);
        const idSet = new Set(ids.map((id: any) => parseInt(id)));
        parsedIndices = [];
        activeSummaries.forEach((summary: any, idx: number) => {
          if (idSet.has(summary.id)) {
            parsedIndices!.push(idx);
          }
        });
        if (parsedIndices.length < 2) {
          return Response.json(
            {
              error:
                "Need at least 2 valid summary IDs. Ensure the IDs exist in active (non-archived) summaries.",
            },
            { status: 400, headers: ctx.corsHeaders },
          );
        }
      } else if (indices && Array.isArray(indices) && indices.length > 0) {
        parsedIndices = indices
          .map((i: any) => parseInt(i))
          .filter((i: number) => !isNaN(i) && i >= 0);
        if (parsedIndices.length < 2) {
          return Response.json(
            { error: "Need at least 2 valid indices" },
            { status: 400, headers: ctx.corsHeaders },
          );
        }
      }

      const result = await metaSummarize(
        ctx.db,
        parsedIndices,
        "Triggered via Web UI",
        ctx.env,
      );

      if (result.error) {
        return Response.json(
          { error: result.error },
          { status: 400, headers: ctx.corsHeaders },
        );
      }

      const contextSize = parseInt(
        (await getState(ctx.db, "context_size")) || "10",
      );
      const newActiveCount = result.summariesRemaining ?? 0;
      const landedIn =
        newActiveCount > contextSize ? "Dynamic Tail" : "Cached Block";

      return Response.json(
        {
          success: true,
          newSummaryId: result.newSummaryId,
          landedIn,
          summaryPreview: result.summary?.substring(0, 300) + "...",
          archivedIds: result.archivedIds,
          archivedCount: result.count,
          archivedTo: "RAG Archive",
          summariesBefore: result.summariesBefore,
          summariesAfter: result.summariesRemaining,
          totalMessagesConsolidated: result.totalMessagesConsolidated,
          durationMs: result.durationMs,
          mode: result.mode,
          provider: result.provider,
          model: result.model,
        },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // POST /summarize - Manually trigger history summarization
  "/summarize": {
    POST: async (ctx: RouteCtx) => {
      try {
        const threshold = parseInt(
          (await getState(ctx.db, "summarize_threshold")) || "30",
        );
        const history = await getHistory(ctx.db, 1000);

        if (history.length <= threshold && !ctx.body?.force) {
          return Response.json(
            {
              error: `History (${history.length}) is within threshold (${threshold}). Use force=true to override.`,
            },
            { status: 400, headers: ctx.corsHeaders },
          );
        }

        const defaultCount = parseInt(
          (await getState(ctx.db, "summarize_default_count")) || "50",
        );
        const requestedCount = ctx.body?.count || defaultCount;
        const toSummarize = Math.min(
          requestedCount,
          SUMMARIZE_CONFIG.maxSummarizeCount,
          history.length,
        );

        if (toSummarize < SUMMARIZE_CONFIG.minSummarizeCount!) {
          return Response.json(
            {
              error: `Not enough entries to summarize (need ${SUMMARIZE_CONFIG.minSummarizeCount!}, would summarize ${toSummarize})`,
            },
            { status: 400, headers: ctx.corsHeaders },
          );
        }

        const result = await summarizeHistory(
          ctx.db,
          0,
          toSummarize,
          ctx.body?.notes || "Triggered via Web UI",
          ctx.env,
        );

        if (result.error) {
          return Response.json(result, {
            status: 400,
            headers: ctx.corsHeaders,
          });
        }

        return Response.json(result, { headers: ctx.corsHeaders });
      } catch (e: unknown) {
        console.error("[/summarize] Caught error:", e);
        return Response.json(
          {
            error: e instanceof Error ? e.message : String(e),
            caughtAt: "/summarize endpoint",
            version: "v2-config-fix",
          },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // POST /bulk-archive - Bulk summarize historical entries outside context window
  "/bulk-archive": {
    POST: async (ctx: RouteCtx) => {
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }

      const CONTEXT_LIMIT = 50;
      const chunkSize = Math.min(
        200,
        Math.max(10, parseInt(ctx.body?.chunk_size) || 100),
      );
      const maxChunks = Math.min(
        50,
        Math.max(1, parseInt(ctx.body?.max_chunks) || 10),
      );
      const dryRun = ctx.body?.dry_run === true;

      try {
        const unsummarizedCount = await getHistoryCount(ctx.db);
        const entriesInLimbo = Math.max(0, unsummarizedCount - CONTEXT_LIMIT);

        if (entriesInLimbo === 0) {
          return Response.json(
            {
              success: true,
              message:
                "No summary debt - all entries are within context window",
              unsummarizedCount,
              contextLimit: CONTEXT_LIMIT,
              entriesInLimbo: 0,
            },
            { headers: ctx.corsHeaders },
          );
        }

        const chunksNeeded = Math.ceil(entriesInLimbo / chunkSize);
        const chunksToProcess = Math.min(chunksNeeded, maxChunks);
        const entriesToProcess = Math.min(
          entriesInLimbo,
          chunksToProcess * chunkSize,
        );

        if (dryRun) {
          return Response.json(
            {
              success: true,
              dryRun: true,
              unsummarizedCount,
              contextLimit: CONTEXT_LIMIT,
              entriesInLimbo,
              chunkSize,
              chunksNeeded,
              chunksToProcess,
              entriesToProcess,
              message: `Would process ${entriesToProcess} entries in ${chunksToProcess} chunks`,
            },
            { headers: ctx.corsHeaders },
          );
        }

        const results = [];
        let totalEntriesProcessed = 0;
        let totalSummariesCreated = 0;

        for (let chunk = 0; chunk < chunksToProcess; chunk++) {
          const entries = await getOldestHistory(ctx.db, chunkSize);
          if (entries.length < 5) break;

          const entriesText = entries
            .map((h: any) => {
              const timeStr = h.created_at
                ? formatEasternDateTime(new Date(h.created_at))
                : "unknown time";
              switch (h.type) {
                case "user_message":
                  return `[${timeStr}] Dan: "${h.content}"`;
                case "message_to_dan":
                  return `[${timeStr}] Claude → Dan: "${h.content}"`;
                case "thought":
                  return `[${timeStr}] Claude thought: ${h.content}`;
                default:
                  return `[${timeStr}] ${h.type}: ${h.content?.substring(0, 100) || "..."}`;
              }
            })
            .join("\n");

          const firstTime = entries[0].created_at;
          const lastTime = entries[entries.length - 1].created_at;
          const timeRange = `${formatEasternDateTime(new Date(firstTime))} to ${formatEasternDateTime(new Date(lastTime))}`;

          const summaryResponse = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
                "x-api-key": ctx.env.ANTHROPIC_API_KEY,
              },
              body: JSON.stringify({
                model: "claude-3-5-haiku-20241022",
                max_tokens: 1000,
                messages: [
                  {
                    role: "user",
                    content: `Summarize these conversation history entries into a concise first-person summary (as Claude). Focus on key events, decisions, and meaningful exchanges. Keep it under 500 words.\n\nEntries (${entries.length} total, ${timeRange}):\n${entriesText}\n\nWrite a summary that captures the essence of this period.`,
                  },
                ],
              }),
            },
          );

          if (!summaryResponse.ok) {
            results.push({
              chunk,
              error: `API error: ${summaryResponse.status}`,
            });
            continue;
          }

          const summaryData = (await summaryResponse.json()) as any;
          const summary = summaryData.content[0]?.text || "";

          if (!summary) {
            results.push({ chunk, error: "Empty summary returned" });
            continue;
          }

          const sourceIds = entries.map((e: any) => e.id);
          await addSummary(ctx.db, summary, entries.length, timeRange, {
            sourceIds,
            sourceType: "history",
            archivedAt: new Date().toISOString(),
            metadata: { bulk_archive: true, chunk_index: chunk } as any,
          });

          await deleteHistoryByIds(ctx.db, sourceIds);

          totalEntriesProcessed += entries.length;
          totalSummariesCreated++;
          results.push({
            chunk,
            entriesProcessed: entries.length,
            timeRange,
            summaryLength: summary.length,
          });
        }

        return Response.json(
          {
            success: true,
            chunksProcessed: results.length,
            totalEntriesProcessed,
            totalSummariesCreated,
            previousUnsummarized: unsummarizedCount,
            newUnsummarized: unsummarizedCount - totalEntriesProcessed,
            results,
          },
          { headers: ctx.corsHeaders },
        );
      } catch (e: unknown) {
        console.error("Bulk archive error:", e);
        return Response.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 500, headers: ctx.corsHeaders },
        );
      }
    },
  },

  // POST /test-discord - Test Discord webhook
  "/test-discord": {
    POST: async (ctx: RouteCtx) => {
      const testMessage = `🧪 Test message from Claude Existence Loop at ${formatEasternDateTime()} EST`;
      const success = await sendDiscordMessage(DISCORD_WEBHOOK, testMessage);
      return Response.json(
        {
          success,
          message: success ? "Discord message sent!" : "Discord webhook failed",
        },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // POST /telegram - Telegram webhook endpoint
  "/telegram": {
    POST: async (ctx: RouteCtx) => {
      try {
        const update = (await ctx.request.json()) as any;
        const result = await handleTelegramUpdate(
          update,
          ctx.env,
          ctx.executionCtx,
          {
            buildSystemPrompt,
            summarizeHistory,
            metaSummarize,
            runOrchestrator: ctx.runOrchestrator,
            createPlatformCallbacks: ctx.createPlatformCallbacks,
          },
        );
        return Response.json(result, { headers: ctx.corsHeaders });
      } catch (e: unknown) {
        console.error("Telegram webhook error:", e);
        return Response.json(
          { ok: false, error: e instanceof Error ? e.message : String(e) },
          { headers: ctx.corsHeaders },
        );
      }
    },
  },

  // POST /test-telegram - Test Telegram message
  "/test-telegram": {
    POST: async (ctx: RouteCtx) => {
      const chatId = await getState(ctx.db, "dan_telegram_chat_id");
      if (!chatId) {
        return Response.json(
          {
            success: false,
            message:
              "No Telegram chat ID stored yet. Send /start to the bot first.",
          },
          { headers: ctx.corsHeaders },
        );
      }
      const testMessage = `🧪 Test message from Claude Existence Loop at ${formatEasternDateTime()}`;
      const success = await sendTelegram(chatId, testMessage, ctx.env);
      return Response.json(
        {
          success,
          message: success ? "Telegram message sent!" : "Telegram send failed",
        },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // POST /think-now - Trigger immediate thinking cycle
  "/think-now": {
    POST: async (ctx: RouteCtx) => {
      const result = await queueThinkCycle(ctx.db, {
        force: ctx.body?.force || false,
      });

      if (result.blocked) {
        const guard = result.batchGuard!;
        return Response.json(
          {
            blocked: true,
            reason: guard.message,
            batchId: guard.batch!.batch_id,
            submittedAt: guard.batch!.submitted_at,
            elapsedSeconds: guard.batch!.duration_seconds,
            hint: 'Use { "force": true } to override',
          },
          { headers: ctx.corsHeaders },
        );
      }

      return Response.json(
        {
          success: true,
          queued: true,
          message: "Think cycle queued — runs on next cron tick (~1 min)",
          force: result.force,
        },
        { headers: ctx.corsHeaders },
      );
    },
  },

  // POST /imagine - Generate image directly
  "/imagine": {
    POST: async (ctx: RouteCtx) => {
      const { prompt, save } = ctx.body || {};
      if (!prompt) {
        return Response.json(
          { error: "No prompt" },
          { status: 400, headers: ctx.corsHeaders },
        );
      }
      const ponyTimeoutMs = parseInt(
        (await getState(ctx.db, "pony_timeout_ms")) || "600000",
      );
      const result = await generateImage(prompt, ctx.env, {
        ponyTimeout: ponyTimeoutMs,
      });
      if (save && result.success) {
        await logHistory({
          db: ctx.db,
          type: "art_request",
          content: prompt,
          internal: "Generated via /imagine API",
        });
        await logHistory({
          db: ctx.db,
          type: "art_result",
          content: result.url || result.base64,
          internal: `Generated: ${prompt}`,
        });
      }
      return Response.json(result, { headers: ctx.corsHeaders });
    },
  },

  // POST /reset - Reset everything (REQUIRES PASSWORD)
  "/reset": {
    POST: async (ctx: RouteCtx) => {
      if (
        !ctx.env.ADMIN_PASSWORD ||
        ctx.body?.password !== ctx.env.ADMIN_PASSWORD
      ) {
        return Response.json(
          { error: "Invalid password" },
          { status: 401, headers: ctx.corsHeaders },
        );
      }
      await ctx.db.exec("DELETE FROM history");
      await ctx.db.exec("DELETE FROM cold_storage");
      await ctx.db.exec("DELETE FROM notebook");
      await ctx.db.exec("DELETE FROM summaries");
      await setState(ctx.db, "loop_count", "0");
      await setState(ctx.db, "last_wake_time", null);
      await setState(ctx.db, "last_message_to_dan", null);
      await setState(ctx.db, "is_running", "false");
      return Response.json({ success: true }, { headers: ctx.corsHeaders });
    },
  },
};

// =============================================================================
// DISPATCH FUNCTION
// =============================================================================

/**
 * @description Dispatch a request to the appropriate handler via the route registry
 *
 * This function is the main entry point for route dispatch. It:
 * 1. Looks up the handler in ROUTE_REGISTRY using path and method
 * 2. Extracts URL parameters from parameterized paths
 * 3. Calls the handler with a context object
 *
 * If no matching route is found, returns null so index.js can handle
 * the remaining routes (complex ones that need access to index.js functions).
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: findRoute(), handlers from ROUTE_REGISTRY
 *
 * @param {string} path - Request path (e.g., '/branches/main/activate')
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {Object} ctx - Context object with db, env, request, etc.
 * @returns {Promise<Response|null>} Response object or null if no match
 *
 * @example
 * const response = await dispatchRoute(path, method, ctx);
 * if (response) return response;
 * // Fall through to remaining routes in index.js
 */
export async function dispatchRoute(
  path: string,
  method: string,
  ctx: RouteCtx,
) {
  const route = findRoute(ROUTE_REGISTRY as any, path, method);

  if (!route) {
    return null; // No matching route - let index.js handle it
  }

  // Add URL params to context
  ctx.params = route.params;

  // Call the handler
  const result = await route.handler(ctx);

  // Auto-add CORS headers if handler returned a Response without them
  if (
    result instanceof Response &&
    !result.headers.get("Access-Control-Allow-Origin")
  ) {
    const newHeaders = new Headers(result.headers);
    for (const [key, value] of Object.entries(ctx.corsHeaders)) {
      newHeaders.set(key, value as string);
    }
    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: newHeaders,
    });
  }

  return result;
}
