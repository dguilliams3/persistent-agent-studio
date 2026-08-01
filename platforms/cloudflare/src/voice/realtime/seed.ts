/**
 * Realtime voice session seed builder
 *
 * @module voice/realtime/seed
 * @description Generates the context seed for realtime sessions using the
 * existing buildSystemPrompt() output and optional block trimming.
 *
 * WHY THIS EXISTS:
 * - Realtime voice sessions need a context "seed" that preserves identity
 *   and memory continuity across interfaces.
 * - We want a single place to define seed size, block inclusion, and token
 *   estimates so UI/Telegram/HTTP flows behave consistently.
 *
 * HOW IT FITS THE VISION:
 * - Keeps prompt assembly centralized and auditable.
 * - Allows future seed strategies (e.g., compact mode, summary-only mode)
 *   without touching provider adapters.
 *
 * ANTIPATTERNS:
 * - Do NOT build ad-hoc seeds inside routes or commands.
 *   That leads to drift between interfaces and breaks persona continuity.
 * - Do NOT force "full" block inclusion when low-latency is required.
 *
 * @upstream Called by:
 *   - voice/realtime/service.js - realtime session start flow
 * @downstream Calls:
 *   - db/index.js getActivePersonaId()
 *   - buildSystemPrompt() (injected dependency)
 *
 * @tests tests/voice/realtime-service.test.js
 */

import { getActivePersonaId } from '../../db/index.js';
import type { Env } from '../../bootstrap.js';

export interface BuildSystemPromptResult {
  systemPrompt: string;
  block1_constitution: string;
  block1Extensions: string;
  block2_promotedSummaries: string;
  block3_stableAndSummaries: string;
  block4_freshTail: string;
  historyCount: number;
  summariesCount: number;
  remindersCount: number;
  coldStorageCount: number;
  learnedCount: number;
  questionsCount: number;
  notebookCount: number;
  observationsCount: number;
  userImages: unknown[];
  claudeArtImages: unknown[];
  activeBranch: string;
  ragRetrievedCount?: number;
}

interface BuildRealtimeSeedParams {
  db: D1Database;
  env: Env;
  buildSystemPrompt: (db: D1Database, env: Env) => Promise<BuildSystemPromptResult>;
  options?: {
    includeSystemPrompt?: boolean;
    includeBlocks?: boolean;
    seedMode?: 'full' | 'compact';
  };
}

const TOKEN_ESTIMATE_DIVISOR = 3.5;

/**
 * @description Estimate token count from text using conservative char ratio
 *
 * WHY: We need a cheap, deterministic estimate for UI/telemetry without
 * invoking external tokenizers in the worker runtime.
 *
 * @param {string} text - Raw text content
 * @returns {number} Estimated token count
 */
export function estimateTokens(text: string) {
  return Math.ceil((text || '').length / TOKEN_ESTIMATE_DIVISOR);
}

/**
 * @description Build a realtime session seed from the system prompt
 *
 * WHY: This produces a stable, structured seed payload so realtime sessions
 * can be bootstrapped uniformly across web UI, Telegram, or API clients.
 *
 * @upstream Called by: voice/realtime/service.js
 * @downstream Calls: buildSystemPrompt(), getActivePersonaId()
 *
 * @param {Object} params - Build parameters
 * @param {D1Database} params.db - Database instance
 * @param {Object} params.env - Environment bindings
 * @param {Function} params.buildSystemPrompt - Injected builder
 * @param {Object} params.options - Seed options
 * @param {boolean} [params.options.includeSystemPrompt=true] - Include system prompt
 * @param {boolean} [params.options.includeBlocks=true] - Include block breakdown
 * @param {string} [params.options.seedMode='full'] - full|compact (omit block4)
 * @returns {Promise<Object>} Seed object and stats
 */
export async function buildRealtimeSeed({ db, env, buildSystemPrompt, options }: BuildRealtimeSeedParams) {
  const {
    includeSystemPrompt = true,
    includeBlocks = true,
    seedMode = 'full'
  } = options || {};

  if (typeof buildSystemPrompt !== 'function') {
    throw new Error('buildSystemPrompt is required to build realtime seed');
  }

  const personaId = await getActivePersonaId(db);
  const promptResult = await buildSystemPrompt(db, env);

  const blocks = includeBlocks ? {
    block1_constitution: promptResult.block1_constitution,
    block1_extensions: promptResult.block1Extensions,
    block2_promotedSummaries: promptResult.block2_promotedSummaries,
    block3_stableAndSummaries: promptResult.block3_stableAndSummaries,
    block4_freshTail: seedMode === 'compact' ? null : promptResult.block4_freshTail
  } : null;

  const systemPrompt = includeSystemPrompt ? promptResult.systemPrompt : null;

  const tokenCounts = {
    systemPromptTokens: systemPrompt ? estimateTokens(systemPrompt) : 0,
    blockTokens: blocks
      ? Object.values(blocks).reduce((sum, blockText) => sum + estimateTokens(blockText ?? ''), 0)
      : 0
  };

  return {
    personaId,
    seed: {
      systemPrompt,
      blocks
    },
    tokenCounts,
    stats: {
      historyCount: promptResult.historyCount,
      summariesCount: promptResult.summariesCount,
      remindersCount: promptResult.remindersCount,
      coldStorageCount: promptResult.coldStorageCount,
      learnedCount: promptResult.learnedCount,
      questionsCount: promptResult.questionsCount,
      notebookCount: promptResult.notebookCount,
      observationsCount: promptResult.observationsCount,
      imagesCount: promptResult.userImages.length,
      claudeArtCount: promptResult.claudeArtImages.length,
      activeBranch: promptResult.activeBranch,
      ragRetrievedCount: promptResult.ragRetrievedCount || 0
    }
  };
}
