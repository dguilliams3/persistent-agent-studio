/**
 * Configuration handler functions (RAG, summarization, prompts)
 *
 * @module @persistence/db/handlers/settings/config
 * @description Handler functions for RAG retrieval config, summarization settings,
 * prompt templates, and auto-summarize toggle.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db state functions, @persistence/core RAG_DEFAULTS
 */

import type { DrizzleD1 } from '../../client';

import {
  getState,
  setState,
} from '../../index';

import { RAG_DEFAULTS } from '@persistence/core';


type SettingsBody = Record<string, unknown>;

// --- Summarization Settings ---

export const DEFAULT_PROMPTS = {
  summarize_system: 'You are Claude, summarizing your own conversation history for future reference. This is YOUR history - your thoughts, your messages to the user, things you wondered about.',

  summarize_instructions: `Preserve:
- Key things the user said and what you said back
- Important thoughts or realizations you had
- Things you were curious about or wanted to follow up on
- Any art you made and why
- Emotional texture and relationship developments
- Anything you'd want to remember

Be concise but don't lose important details. Write in first person as if you're writing notes to your future self.

For the metadata, extract:
- entity_tags: Names, topics, and concepts mentioned (the user, work, physics, etc.)
- key_facts: Specific facts worth remembering
- themes: Recurring themes or patterns (career, creativity, relationship)
- emotional_tone: Overall emotional quality (reflective, excited, frustrated, playful)
- time_period_label: A descriptive label for when this happened (early January 2026)`,

  meta_system: 'You are Claude, consolidating multiple of your own previous summaries into a single comprehensive summary.',

  meta_instructions: `Preserve:
- The most significant conversations and relationship developments with the user
- Key insights, realizations, and emotional moments
- Important patterns or recurring themes
- Things you'd want your future self to remember
- Creative work and its significance

Merge overlapping or redundant information. Maintain chronological flow where relevant.
Write in first person as notes to your future self. Be thorough but not redundant.`
};

export async function handleGetSummarizeSettings(db: DrizzleD1) {
  const threshold = await getState(db, 'summarize_threshold');
  const autoSummarize = await getState(db, 'auto_summarize');
  const summaryMaxTokens = await getState(db, 'summary_max_tokens');
  const metaSummaryMaxTokens = await getState(db, 'meta_summary_max_tokens');
  const metaReasoningEffort = await getState(db, 'meta_reasoning_effort');
  const defaultCount = await getState(db, 'summarize_default_count');

  return {
    summarizeThreshold: parseInt(threshold || '30'),
    autoSummarize: autoSummarize === 'true',
    summaryMaxTokens: parseInt(summaryMaxTokens || '4000'),
    metaSummaryMaxTokens: parseInt(metaSummaryMaxTokens || '4000'),
    metaReasoningEffort: metaReasoningEffort || 'low',
    reasoningEffortOptions: ['none', 'low', 'medium', 'high'],
    summarizeDefaultCount: parseInt(defaultCount || '50')
  };
}

export async function handleSetSummarizeSettings(db: DrizzleD1, body: SettingsBody) {
  const threshold = body.threshold as string | undefined;
  const autoSummarize = body.autoSummarize as boolean | undefined;
  const summaryMaxTokens = body.summaryMaxTokens as string | undefined;
  const metaSummaryMaxTokens = body.metaSummaryMaxTokens as string | undefined;
  const metaReasoningEffort = body.metaReasoningEffort as string | undefined;
  const summarizeDefaultCount = body.summarizeDefaultCount as string | undefined;

  if (threshold !== undefined) {
    const thresholdValue = Math.max(10, Math.min(100, parseInt(threshold) || 30));
    await setState(db, 'summarize_threshold', String(thresholdValue));
  }
  if (autoSummarize !== undefined) {
    await setState(db, 'auto_summarize', autoSummarize ? 'true' : 'false');
  }
  if (summaryMaxTokens !== undefined) {
    const tokens = Math.max(500, Math.min(7500, parseInt(summaryMaxTokens) || 4000));
    await setState(db, 'summary_max_tokens', String(tokens));
  }
  if (metaSummaryMaxTokens !== undefined) {
    const tokens = Math.max(500, Math.min(7500, parseInt(metaSummaryMaxTokens) || 4000));
    await setState(db, 'meta_summary_max_tokens', String(tokens));
  }
  if (metaReasoningEffort !== undefined) {
    const validEfforts = ['none', 'low', 'medium', 'high'];
    const effort = validEfforts.includes(metaReasoningEffort) ? metaReasoningEffort : 'low';
    await setState(db, 'meta_reasoning_effort', effort);
  }
  if (summarizeDefaultCount !== undefined) {
    const count = Math.max(10, Math.min(100, parseInt(summarizeDefaultCount) || 50));
    await setState(db, 'summarize_default_count', String(count));
  }

  const settings = await handleGetSummarizeSettings(db);
  return { success: true, ...settings };
}

export async function handleSetAutoSummarize(db: DrizzleD1, body: SettingsBody) {
  const { enabled } = body;
  await setState(db, 'auto_summarize', enabled ? 'true' : 'false');
  return { success: true, autoSummarize: enabled };
}

// --- Prompt Templates ---

export async function handleGetSummarizePrompts(db: DrizzleD1) {
  const [summarizeSystem, summarizeInstructions, metaSystem, metaInstructions] = await Promise.all([
    getState(db, 'summarize_system_prompt'),
    getState(db, 'summarize_instructions'),
    getState(db, 'meta_system_prompt'),
    getState(db, 'meta_instructions')
  ]);

  return {
    summarize: {
      system: summarizeSystem || DEFAULT_PROMPTS.summarize_system,
      instructions: summarizeInstructions || DEFAULT_PROMPTS.summarize_instructions,
      isCustomSystem: !!summarizeSystem,
      isCustomInstructions: !!summarizeInstructions
    },
    meta: {
      system: metaSystem || DEFAULT_PROMPTS.meta_system,
      instructions: metaInstructions || DEFAULT_PROMPTS.meta_instructions,
      isCustomSystem: !!metaSystem,
      isCustomInstructions: !!metaInstructions
    },
    defaults: DEFAULT_PROMPTS
  };
}

export async function handleSetSummarizePrompts(db: DrizzleD1, body: SettingsBody) {
  const summarizeSystem = body.summarizeSystem as string | null | undefined;
  const summarizeInstructions = body.summarizeInstructions as string | null | undefined;
  const metaSystem = body.metaSystem as string | null | undefined;
  const metaInstructions = body.metaInstructions as string | null | undefined;
  const updates: string[] = [];

  if (summarizeSystem !== undefined) {
    await setState(db, 'summarize_system_prompt', summarizeSystem === null ? '' : summarizeSystem);
    updates.push('summarizeSystem');
  }
  if (summarizeInstructions !== undefined) {
    await setState(db, 'summarize_instructions', summarizeInstructions === null ? '' : summarizeInstructions);
    updates.push('summarizeInstructions');
  }
  if (metaSystem !== undefined) {
    await setState(db, 'meta_system_prompt', metaSystem === null ? '' : metaSystem);
    updates.push('metaSystem');
  }
  if (metaInstructions !== undefined) {
    await setState(db, 'meta_instructions', metaInstructions === null ? '' : metaInstructions);
    updates.push('metaInstructions');
  }

  const prompts = await handleGetSummarizePrompts(db);
  return { success: true, updated: updates, ...prompts };
}

// --- RAG Config ---

export async function handleGetRagConfig(db: DrizzleD1) {
  const ragEnabled = await getState(db, 'rag_enabled');
  const ragTopK = await getState(db, 'rag_top_k');
  const ragRecencyHalflife = await getState(db, 'rag_recency_halflife');
  const ragMinSimilarity = await getState(db, 'rag_min_similarity');
  const ragSimilarityWeight = await getState(db, 'rag_similarity_weight');
  const ragRecencyWeight = await getState(db, 'rag_recency_weight');
  const ragImportanceWeight = await getState(db, 'rag_importance_weight');
  const ragMmrLambda = await getState(db, 'rag_mmr_lambda');

  const source: Record<string, unknown> = {};

  const config = {
    enabled: ragEnabled !== null ? ragEnabled === 'true' : true,
    topK: ragTopK ? parseInt(ragTopK) : RAG_DEFAULTS.topK,
    queryHistoryCount: 10,
    recencyHalflifeDays: ragRecencyHalflife ? parseInt(ragRecencyHalflife) : RAG_DEFAULTS.recencyHalflifeDays,
    minSimilarity: ragMinSimilarity ? parseFloat(ragMinSimilarity) : RAG_DEFAULTS.minSimilarity,
    weights: {
      similarity: ragSimilarityWeight ? parseFloat(ragSimilarityWeight) : RAG_DEFAULTS.weights.similarity,
      recency: ragRecencyWeight ? parseFloat(ragRecencyWeight) : RAG_DEFAULTS.weights.recency,
      importance: ragImportanceWeight ? parseFloat(ragImportanceWeight) : RAG_DEFAULTS.weights.importance
    },
    mmrLambda: ragMmrLambda ? parseFloat(ragMmrLambda) : RAG_DEFAULTS.mmrLambda
  };

  source.enabled = ragEnabled !== null ? 'state' : 'default';
  source.topK = ragTopK !== null ? 'state' : 'default';
  source.queryHistoryCount = 'default';
  source.recencyHalflifeDays = ragRecencyHalflife !== null ? 'state' : 'default';
  source.minSimilarity = ragMinSimilarity !== null ? 'state' : 'default';
  source.weights = {
    similarity: ragSimilarityWeight !== null ? 'state' : 'default',
    recency: ragRecencyWeight !== null ? 'state' : 'default',
    importance: ragImportanceWeight !== null ? 'state' : 'default'
  };
  source.mmrLambda = ragMmrLambda !== null ? 'state' : 'default';

  return { ...config, source };
}

export async function handleSetRagConfig(db: DrizzleD1, body: SettingsBody) {
  const updates: string[] = [];

  if (body.reset === true) {
    await setState(db, 'rag_enabled', null);
    await setState(db, 'rag_top_k', null);
    await setState(db, 'rag_recency_halflife', null);
    await setState(db, 'rag_min_similarity', null);
    await setState(db, 'rag_similarity_weight', null);
    await setState(db, 'rag_recency_weight', null);
    await setState(db, 'rag_importance_weight', null);
    await setState(db, 'rag_mmr_lambda', null);
    return { success: true, message: 'RAG settings reset to defaults', config: RAG_DEFAULTS };
  }

  if (body.enabled !== undefined) {
    await setState(db, 'rag_enabled', body.enabled ? 'true' : 'false');
    updates.push(`enabled: ${body.enabled}`);
  }

  if (body.topK !== undefined) {
    const topK = Math.max(1, Math.min(10, parseInt(String(body.topK))));
    await setState(db, 'rag_top_k', String(topK));
    updates.push(`topK: ${topK}`);
  }

  if (body.recencyHalflifeDays !== undefined) {
    const halflife = Math.max(1, Math.min(365, parseInt(String(body.recencyHalflifeDays))));
    await setState(db, 'rag_recency_halflife', String(halflife));
    updates.push(`recencyHalflifeDays: ${halflife}`);
  }

  if (body.minSimilarity !== undefined) {
    const minimumSimilarity = Math.max(0, Math.min(1, parseFloat(String(body.minSimilarity))));
    await setState(db, 'rag_min_similarity', String(minimumSimilarity));
    updates.push(`minSimilarity: ${minimumSimilarity}`);
  }

  if (body.mmrLambda !== undefined) {
    const lambda = Math.max(0, Math.min(1, parseFloat(String(body.mmrLambda))));
    await setState(db, 'rag_mmr_lambda', String(lambda));
    updates.push(`mmrLambda: ${lambda}`);
  }

  if (body.weights) {
    const weightsObj = body.weights as Record<string, number | undefined>;
    let { similarity, recency, importance } = weightsObj;

    if (similarity === undefined) similarity = RAG_DEFAULTS.weights.similarity;
    if (recency === undefined) recency = RAG_DEFAULTS.weights.recency;
    if (importance === undefined) importance = RAG_DEFAULTS.weights.importance;

    const sum = similarity + recency + importance;
    if (Math.abs(sum - 1.0) > 0.01) {
      similarity = similarity / sum;
      recency = recency / sum;
      importance = importance / sum;
    }

    await setState(db, 'rag_similarity_weight', String(similarity));
    await setState(db, 'rag_recency_weight', String(recency));
    await setState(db, 'rag_importance_weight', String(importance));
    updates.push(`weights: {similarity: ${similarity.toFixed(2)}, recency: ${recency.toFixed(2)}, importance: ${importance.toFixed(2)}}`);
  }

  const newConfig = await handleGetRagConfig(db);

  return {
    success: true,
    updated: updates,
    config: newConfig
  };
}

/**
 * Helper to get merged RAG config without source metadata (for internal use).
 */
export async function getRagConfig(db: DrizzleD1) {
  const fullConfig = await handleGetRagConfig(db);
  const { source, ...config } = fullConfig;
  return config;
}
