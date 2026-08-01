/**
 * Local Model Support (Ollama, LM Studio)
 *
 * @module @persistence/llm/local
 * @description Local LLM integration via tunnel for self-hosted models.
 *
 * Supports two local providers:
 * - Ollama: /api/generate with prompt string
 * - LM Studio: /v1/chat/completions with OpenAI-compatible format
 *
 * All db parameters are typed as DrizzleD1 (the Drizzle-wrapped client from
 * @persistence/db/client), not as the raw Cloudflare D1Database binding.
 *
 * Migrated from platforms/cloudflare/src/services/llm.js (2026-01-30)
 *
 * @upstream Called by:
 *   - Telegram /localmodel command
 *   - Think cycle (when local model enabled)
 * @downstream Calls:
 *   - fetch() to local model endpoint
 *   - @persistence/db (getState, setState) — DrizzleD1-based state helpers
 */

import { getState, setState } from "@persistence/db";
import type { DrizzleD1 } from "@persistence/db";

// =============================================================================
// TYPES
// =============================================================================

export interface LocalModelConfig {
  enabled: boolean;
  endpoint: string | null;
  model: string;
  provider: "ollama" | "lmstudio";
  useForIntervals: boolean;
}

export interface LocalCallOptions {
  endpoint: string;
  model: string;
  prompt: string;
  system?: string;
  messages?: Array<{ role: string; content: string }>;
  provider?: "ollama" | "lmstudio";
  timeoutMs?: number;
}

export interface LocalCallResult {
  content: string;
  model: string;
  provider: string;
}

// Default local model name when not configured
const DEFAULT_LOCAL_MODEL = "llama3.2";

// =============================================================================
// LOCAL MODEL CALL
// =============================================================================

/**
 * @description Call a local LLM via tunnel (Ollama or LM Studio)
 *
 * Supports two formats:
 * - Ollama: /api/generate with prompt string
 * - LM Studio: /v1/chat/completions with OpenAI-compatible format
 *
 * @upstream Called by: callWithLocalFallback(), /localmodel test command
 * @downstream Calls: fetch() to local model endpoint
 *
 * @param opts - Call options
 * @returns Result with content, model, and provider used
 *
 * @throws {Error} If endpoint is unreachable or returns error
 *
 * @example
 * const result = await callLocalModel({
 *   endpoint: 'https://xxx.trycloudflare.com',
 *   model: 'llama3.2',
 *   prompt: 'Hello!',
 *   provider: 'ollama'
 * });
 */
export async function callLocalModel(
  opts: LocalCallOptions,
): Promise<LocalCallResult> {
  const {
    endpoint,
    model,
    prompt,
    system,
    messages,
    provider = "ollama",
    timeoutMs = 60000,
  } = opts;

  const startTime = Date.now();
  console.log(`[callLocalModel] ${provider}/${model} - endpoint: ${endpoint}`);

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[callLocalModel] TIMEOUT after ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    let url: string;
    let body: Record<string, unknown>;

    if (provider === "lmstudio") {
      // LM Studio uses OpenAI-compatible format
      url = `${endpoint}/v1/chat/completions`;
      body = {
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          ...(messages || [{ role: "user", content: prompt }]),
        ],
        stream: false,
      };
    } else {
      // Ollama format (default)
      url = `${endpoint}/api/generate`;
      body = {
        model,
        prompt: system ? `${system}\n\n${prompt}` : prompt,
        stream: false,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Required for ngrok free tier to bypass browser warning page
        "ngrok-skip-browser-warning": "69420",
        "User-Agent": "Claude-Existence-Loop/1.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error body");
      console.error(
        `[callLocalModel] Error (${response.status}) after ${elapsedMs}ms: ${errorText.substring(0, 200)}`,
      );
      throw new Error(
        `Local model error (${response.status}): ${errorText.substring(0, 100)}`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    let content: string | undefined;

    if (provider === "lmstudio") {
      // OpenAI format response
      const choices = data.choices as
        | Array<{ message?: { content?: string } }>
        | undefined;
      content = choices?.[0]?.message?.content;
    } else {
      // Ollama format response
      content = data.response as string | undefined;
    }

    if (!content) {
      console.error(
        `[callLocalModel] Empty response:`,
        JSON.stringify(data).substring(0, 200),
      );
      throw new Error("Local model returned empty response");
    }

    console.log(
      `[callLocalModel] SUCCESS ${provider}/${model} - ${elapsedMs}ms, ${content.length} chars`,
    );

    return {
      content,
      model,
      provider: `local/${provider}`,
    };
  } catch (e) {
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startTime;

    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Local model timeout after ${timeoutMs / 1000}s`);
    }

    console.error(
      `[callLocalModel] ERROR after ${elapsedMs}ms:`,
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
}

// =============================================================================
// CONFIG MANAGEMENT
// =============================================================================

/**
 * @description Get local model configuration from state
 *
 * @upstream Called by: callWithLocalFallback(), /localmodel command
 * @downstream Calls: getState()
 *
 * @param db - Database instance
 * @returns Local model configuration
 */
export async function getLocalModelConfig(
  db: DrizzleD1,
): Promise<LocalModelConfig> {
  const enabled = (await getState(db, "local_model_enabled")) === "true";
  const endpointRaw = await getState(db, "local_model_endpoint");
  const endpoint = endpointRaw ?? null; // Convert undefined to null for type safety
  const model = (await getState(db, "local_model_name")) || DEFAULT_LOCAL_MODEL;
  const provider = ((await getState(db, "local_model_provider")) ||
    "ollama") as "ollama" | "lmstudio";
  const useForIntervals =
    (await getState(db, "use_local_for_intervals")) !== "false"; // Default true

  return { enabled, endpoint, model, provider, useForIntervals };
}

/**
 * @description Set local model configuration in state
 *
 * @upstream Called by: /localmodel command, API endpoints
 * @downstream Calls: setState()
 *
 * @param db - Database instance
 * @param config - Configuration to set (partial update supported)
 */
export async function setLocalModelConfig(
  db: DrizzleD1,
  config: Partial<LocalModelConfig>,
): Promise<void> {
  if (config.enabled !== undefined) {
    await setState(
      db,
      "local_model_enabled",
      config.enabled ? "true" : "false",
    );
  }
  if (config.endpoint !== undefined) {
    await setState(db, "local_model_endpoint", config.endpoint);
  }
  if (config.model !== undefined) {
    await setState(db, "local_model_name", config.model);
  }
  if (config.provider !== undefined) {
    await setState(db, "local_model_provider", config.provider);
  }
  if (config.useForIntervals !== undefined) {
    await setState(
      db,
      "use_local_for_intervals",
      config.useForIntervals ? "true" : "false",
    );
  }
}

// =============================================================================
// FALLBACK ORCHESTRATION
// =============================================================================

/**
 * Call options for the fallback function.
 * These mirror standard LLM call params.
 */
export interface CallWithFallbackOptions {
  provider: string;
  model?: string;
  system: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  reasoning?: string;
}

export interface CallWithFallbackResult {
  content: string;
  model: string;
  provider: string;
  usedLocal: boolean;
  localError?: string;
}

/**
 * Type for an LLM caller function that the platform provides.
 * This follows the Basin pattern - callers pass in their LLM caller.
 */
export type LLMCaller = (
  opts: CallWithFallbackOptions,
  env: Record<string, string>,
) => Promise<string>;

/**
 * @description Call LLM with local model fallback
 *
 * If local model is enabled and configured, attempts to use it first.
 * Falls back to the specified provider (Anthropic/OpenAI) on failure.
 *
 * NOTE: This function requires an LLM caller to be passed in (Basin pattern).
 * The platform layer provides this caller with appropriate credentials.
 *
 * @upstream Called by: Think cycle when local model is enabled
 * @downstream Calls: callLocalModel(), provided llmCaller
 *
 * @param opts - Standard callLLM options
 * @param db - Database instance
 * @param env - Environment with API keys
 * @param llmCaller - Function to call the remote LLM (provided by platform)
 * @param localOpts - Local model options
 * @returns Result with content, model, provider, and whether local was used
 *
 * @example
 * // Platform provides the LLM caller
 * const callLLM = (opts, env) => services.llm.anthropic.opus.sync({ ...opts });
 *
 * const result = await callWithLocalFallback(
 *   { provider: 'anthropic', model: 'claude-opus-4', system: '...', messages: [...] },
 *   db,
 *   env,
 *   callLLM,
 *   { isIntervalCycle: true }
 * );
 * // Returns: { content: '...', model: 'llama3.2', provider: 'local/ollama', usedLocal: true }
 */
export async function callWithLocalFallback(
  opts: CallWithFallbackOptions,
  db: DrizzleD1,
  env: Record<string, string>,
  llmCaller: LLMCaller,
  localOpts: { forceLocal?: boolean; isIntervalCycle?: boolean } = {},
): Promise<CallWithFallbackResult> {
  const { forceLocal = false, isIntervalCycle = false } = localOpts;

  // Get local model config
  const localConfig = await getLocalModelConfig(db);

  // Determine if we should try local model
  const shouldTryLocal =
    localConfig.enabled &&
    localConfig.endpoint &&
    (!localConfig.useForIntervals || isIntervalCycle);

  if (!shouldTryLocal) {
    // Just use normal provider via the caller
    const content = await llmCaller(opts, env);
    return {
      content,
      model: opts.model || "default",
      provider: opts.provider,
      usedLocal: false,
    };
  }

  // Try local model first
  try {
    console.log(
      `[callWithLocalFallback] Attempting local model: ${localConfig.provider}/${localConfig.model}`,
    );

    // Build prompt from system + messages
    let prompt = "";
    if (opts.system) {
      prompt += opts.system + "\n\n";
    }
    if (opts.messages) {
      for (const msg of opts.messages) {
        if (msg.role === "user") {
          prompt += `Human: ${msg.content}\n\n`;
        } else if (msg.role === "assistant") {
          prompt += `Assistant: ${msg.content}\n\n`;
        }
      }
    }
    prompt += "Assistant:";

    const result = await callLocalModel({
      endpoint: localConfig.endpoint!,
      model: localConfig.model,
      prompt,
      system: opts.system,
      messages: opts.messages,
      provider: localConfig.provider,
    });

    return {
      content: result.content,
      model: result.model,
      provider: result.provider,
      usedLocal: true,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(
      `[callWithLocalFallback] Local model failed: ${errorMessage}`,
    );

    if (forceLocal) {
      throw new Error(
        `Local model failed and forceLocal=true: ${errorMessage}`,
      );
    }

    // Fall back to remote provider
    console.log(`[callWithLocalFallback] Falling back to ${opts.provider}`);
    const content = await llmCaller(opts, env);
    return {
      content,
      model: opts.model || "default",
      provider: opts.provider,
      usedLocal: false,
      localError: errorMessage,
    };
  }
}
