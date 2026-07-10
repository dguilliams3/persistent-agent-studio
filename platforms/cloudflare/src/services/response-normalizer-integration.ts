/**
 * Response Normalizer Integration Points
 *
 * @module services/response-normalizer-integration
 * @description PRIMARY interface for normalized LLM and service responses
 *
 * ⚠️ REQUIRED: ALL LLM calls MUST use functions from this module.
 * Direct imports from underlying modules are FORBIDDEN.
 *
 * This module provides the ONLY approved interface for:
 * - @persistence/llm (LLM API calls via RequestEngine)
 * - services/response-parser.js (action parsing)
 * - services/images.js (image generation)
 *
 * MIGRATION (2026-01-30): llm.js DELETED. LLM calls now use @persistence/llm typed interface.
 * Code Is Context: This IS the interface. No backward compatibility gaslighting.
 */

// =============================================================================
// LLM INTEGRATION (Migrated to @persistence/llm 2026-01-30)
// =============================================================================
// Uses typed package interface directly - no more deprecated llm.js
// =============================================================================

import { resolveProvider, resolveModelById, RequestEngine, type EngineEnvironment, type LLMRequest } from '@persistence/llm';
import { normalizeLLMResponse, normalizeError } from './response-normalizer.js';
import type { Env } from '../bootstrap.js';

interface LLMCallOptions {
  provider: string;
  model: string;
  system: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  reasoning?: string;
}

interface NormalizationContext {
  provider?: string;
  model?: string;
  [key: string]: unknown;
}

/**
 * @description STANDARD LLM call function with response normalization
 *
 * ⚠️ REQUIRED: This is the ONLY approved way to make LLM calls in the application.
 * Uses @persistence/llm typed interface for provider-agnostic LLM calls.
 *
 * @upstream Called by: ALL LLM-powered endpoints and operations (summarization, etc.)
 * @downstream Calls: RequestEngine.execute(), resolveProvider(), resolveModelById()
 *
 * @param {Object} opts - LLM call options (provider, model, system, messages, maxTokens)
 * @param {string} opts.provider - 'anthropic' or 'openai'
 * @param {string} opts.model - Model identifier (full ID like 'claude-sonnet-4-20250514' or key like 'sonnet')
 * @param {string} opts.system - System prompt
 * @param {Array} opts.messages - Message array [{role, content}]
 * @param {number} opts.maxTokens - Token limit
 * @param {string} [opts.reasoning] - OpenAI reasoning effort: 'none'|'low'|'medium'|'high'
 * @param {Object} env - Environment with API keys
 * @returns {Promise<Object>} Normalized response: { content, metadata }
 *
 * @example
 * const result = await callLLMNormalized({
 *   provider: 'anthropic',
 *   model: 'claude-sonnet-4-20250514',
 *   system: 'You are helpful',
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   maxTokens: 1000
 * }, env);
 */
async function callLLMNormalized(opts: LLMCallOptions, env: unknown) {
  const { provider: providerName, model: modelId, system, messages, maxTokens, reasoning } = opts;

  try {
    // Resolve provider string to typed definition
    const provider = resolveProvider(providerName);

    // Resolve model - try by ID first, then by key
    let model = resolveModelById(provider, modelId);
    if (!model) {
      // Try as short key (e.g., 'sonnet', 'opus', 'gpt-4o-mini')
      model = provider.models[modelId];
    }
    if (!model) {
      // Throw error instead of silent fallback - prevents cost surprises
      const validModels = Object.keys(provider.models).join(', ');
      throw new Error(`Unknown model '${modelId}' for provider '${provider.name}'. Valid models: ${validModels}`);
    }

    // Create engine with env (contains API keys)
    const engine = new RequestEngine(env as EngineEnvironment);

    // Execute request - cast messages/reasoning to match LLMRequest types
    const response = await engine.execute({
      provider,
      model,
      mode: 'sync',
      system,
      messages: messages as LLMRequest['messages'],
      maxTokens,
      reasoning: reasoning as LLMRequest['reasoning'],
    });

    return {
      content: response.content,
      metadata: {
        provider: providerName,
        model: model.displayName,
        tokens: {
          input: response.usage.input,
          output: response.usage.output,
          cacheRead: response.usage.cacheRead ?? 0,
          cacheWrite: response.usage.cacheWrite ?? 0,
          total: response.usage.input + response.usage.output,
        },
        /** Cost in USD from RequestEngine */
        cost: response.cost ?? 0,
      },
    };

  } catch (error) {
    // Normalize the error
    const normalizedError = normalizeError(error, null, providerName);
    throw new Error(`${normalizedError.message} (${normalizedError.code})`);
  }
}

/**
 * @description Primary LLM call function - returns normalized responses
 *
 * @upstream Called by: All LLM-powered processes (summarization, Claude responses, etc.)
 * @downstream Calls: callLLMNormalized()
 *
 * @param {Object} opts - LLM call options
 * @param {Object} env - Environment with API keys
 * @returns {Promise<Object>} Normalized response: { content, metadata, usage, success, error }
 */
export async function callLLM(opts: LLMCallOptions, env: unknown) {
  return await callLLMNormalized(opts, env);
}

// =============================================================================
// RESPONSE-PARSER.JS INTEGRATION
// =============================================================================
// Enhanced action parsing with model-aware normalization
// =============================================================================

import { parseClaudeResponse as originalParseClaudeResponse } from '@persistence/llm';
import { normalizeActionContent } from './response-normalizer.js';

/**
 * Enhanced action parsing with model-aware normalization
 * @param {string} responseText - Raw response text
 * @param {Object} [context] - Optional context (provider, model, etc.)
 * @returns {Promise<Object>} Normalized parse result
 */
export async function parseClaudeResponseNormalized(responseText: string, context: NormalizationContext = {}) {
  // Try normalization first if context provided
  if (context.provider && context.model) {
    const normalized = await normalizeActionContent(responseText, context.provider, context.model);

    if (normalized.success) {
      const n = normalized as { success: true; actions?: Array<Record<string, unknown>>; parseMetadata?: Record<string, unknown>; warnings?: string[] };
      return {
        success: n.actions ? true : false,
        fullyParsed: n.parseMetadata?.fullyParsed || false,
        actions: n.actions || [],
        malformed: n.parseMetadata?.malformed || [],
        error: n.parseMetadata?.error,
        metadata: {
          provider: context.provider,
          model: context.model,
          normalization: {
            applied: true,
            warnings: n.warnings
          }
        }
      };
    }
  }

  // Fall back to original parser
  return originalParseClaudeResponse(responseText);
}

/**
 * Primary action parsing function - returns normalized results
 */
export async function parseClaudeResponse(responseText: string, context: NormalizationContext = {}) {
  return await parseClaudeResponseNormalized(responseText, context);
}

// =============================================================================
// IMAGES.JS INTEGRATION
// =============================================================================
// Enhanced image generation with normalized error handling
// =============================================================================

import { generateImage as originalGenerateImage } from './media/index.js';

/**
 * Enhanced image generation with normalized error handling
 * @param {string} prompt - Image prompt (may include provider prefixes)
 * @param {Object} env - Environment with API keys
 * @returns {Promise<Object>} Normalized result with consistent error format
 */
export async function generateImageNormalized(prompt: string, env: Env) {
  try {
    const result = await originalGenerateImage(prompt, env);

    if (result.success) {
      return {
        success: true,
        base64: result.base64,
        provider: result.provider,
        metadata: {
          normalized: true,
          originalFormat: 'base64'
        }
      };
    } else {
      // Normalize the error
      const provider = prompt.startsWith('REPLICATE:') ? 'replicate' :
                      prompt.startsWith('FLUX:') ? 'replicate' :
                      prompt.startsWith('SDXL:') ? 'replicate' : 'cloudflare';

      const normalizedError = normalizeError(
        { message: result.error },
        null,
        provider
      );

      return {
        success: false,
        error: normalizedError,
        provider
      };
    }

  } catch (error) {
    // Normalize unexpected errors
    const normalizedError = normalizeError(error, null, 'unknown');
    return {
      success: false,
      error: normalizedError
    };
  }
}

/**
 * Primary image generation function - returns normalized results
 */
export async function generateImage(prompt: string, env: Env) {
  return await generateImageNormalized(prompt, env);
}

// =============================================================================
// UTILITY FUNCTIONS FOR MIGRATION
// =============================================================================
// Helper functions to ease migration to normalized responses
// =============================================================================

/**
 * Create a normalization context from common parameters
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {Object} [additional] - Additional context
 * @returns {Object} Context object for normalization functions
 */
export function createNormalizationContext(provider: string, model: string, additional: Record<string, unknown> = {}) {
  return {
    provider,
    model,
    ...additional
  };
}

/**
 * Check if a provider is supported for normalization
 * @param {string} provider - Provider name
 * @returns {boolean}
 */
export async function isProviderSupported(provider: string) {
  const { PROVIDER_CONFIGS } = await import('./response-normalizer.js');
  return provider in PROVIDER_CONFIGS;
}

/**
 * Get supported providers list
 * @returns {string[]}
 */
export async function getSupportedProviders() {
  const { PROVIDER_CONFIGS } = await import('./response-normalizer.js');
  return Object.keys(PROVIDER_CONFIGS);
}

// =============================================================================
// EXPORTS - Normalized functions are now the standard implementation
// =============================================================================
