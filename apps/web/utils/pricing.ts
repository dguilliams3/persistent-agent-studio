/**
 * Token estimation and pricing utilities
 *
 * @module utils/pricing
 * @description Frontend utilities for token estimation and Claude API cost calculation.
 *
 * ARCHITECTURE:
 * - Source of truth: worker/src/constants.js (backend)
 * - Runtime sync: /pricing API endpoint
 * - Frontend: Zustand store caches API response, falls back to hardcoded defaults
 */

import type { PricingConfig } from '../types';

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

export const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(input: string | number): number {
  if (typeof input === 'number') {
    return Math.ceil(input / CHARS_PER_TOKEN);
  }
  if (typeof input === 'string') {
    return Math.ceil(input.length / CHARS_PER_TOKEN);
  }
  return 0;
}

export function estimateTokensForArray(
  items: Array<Record<string, string | undefined>> | null | undefined,
  field: string = 'content'
): number {
  if (!Array.isArray(items)) return 0;
  const totalChars = items.reduce((sum, item) => {
    const text = item?.[field] || '';
    return sum + text.length;
  }, 0);
  return estimateTokens(totalChars);
}

// ============================================================================
// MODEL PRICING - matches worker/src/constants.js
// ============================================================================

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

interface CachePricingConfig {
  cacheReadDiscount: number;
  cacheWritePremium5m: number;
  cacheWritePremium1h: number;
  batchDiscount: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  opus: { inputPerMillion: 5.0, outputPerMillion: 25.0 },
  sonnet: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  haiku: { inputPerMillion: 0.80, outputPerMillion: 4.0 },
};

export const CACHE_PRICING: CachePricingConfig = {
  cacheReadDiscount: 0.1,
  cacheWritePremium5m: 1.25,
  cacheWritePremium1h: 2.0,
  batchDiscount: 0.5,
};

export function getPricingConfig(storeConfig: PricingConfig | null) {
  return {
    models: storeConfig?.models || MODEL_PRICING,
    cache: storeConfig?.cache || CACHE_PRICING,
    batchDiscount: storeConfig?.batchDiscount ?? CACHE_PRICING.batchDiscount,
  };
}

export function getModelType(modelId: string | null | undefined): string {
  if (!modelId) return 'sonnet';
  if (modelId.includes('haiku')) return 'haiku';
  if (modelId.includes('opus')) return 'opus';
  return 'sonnet';
}

interface EstimateCycleCostParams {
  model: string;
  inputTokens: number;
  outputTokens?: number;
  cacheHitRate?: number;
  isBatch?: boolean;
  pricingConfig?: PricingConfig | null;
}

export function estimateCycleCost({
  model,
  inputTokens,
  outputTokens = 300,
  cacheHitRate = 0,
  isBatch = false,
  pricingConfig = null,
}: EstimateCycleCostParams): number {
  const { models, cache, batchDiscount } = getPricingConfig(pricingConfig);
  const modelType = getModelType(model);
  const pricing: any = models[modelType] || models.sonnet || MODEL_PRICING.sonnet;

  const inputPrice = (pricing.inputPerMillion || pricing.input || 0) / 1_000_000;
  const outputPrice = (pricing.outputPerMillion || pricing.output || 0) / 1_000_000;

  const cacheHitFraction = Math.min(100, Math.max(0, cacheHitRate)) / 100;
  const cachedTokens = inputTokens * cacheHitFraction;
  const freshTokens = inputTokens * (1 - cacheHitFraction);

  const cachedCost = cachedTokens * inputPrice * (cache as CachePricingConfig).cacheReadDiscount;
  const freshCost = freshTokens * inputPrice;
  const outputCost = outputTokens * outputPrice;

  let totalDollars = cachedCost + freshCost + outputCost;

  if (isBatch) {
    totalDollars *= batchDiscount;
  }

  return Math.round(totalDollars * 100 * 100) / 100;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(tokens);
}

export function formatCost(cents: number): string {
  if (cents < 0.01) return '<0.01\u00a2';
  if (cents < 1) return `${cents.toFixed(2)}\u00a2`;
  return `${cents.toFixed(1)}\u00a2`;
}

export function getModelLabel(modelId: string): string {
  const type = getModelType(modelId);
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return secs > 0 && minutes < 5 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  return `${secs}s`;
}
