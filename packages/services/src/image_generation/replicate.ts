/**
 * Replicate Image Generation Provider
 *
 * @module @persistence/services/image_generation/replicate
 * @description Replicate API image generation implementation.
 *
 * Supports multiple models:
 * - flux-schnell: Fast, creative (~$0.01)
 * - flux-dev: Highest fidelity (~$0.025)
 * - sdxl: Most permissive, safety off (~$0.01)
 *
 * @upstream Called by: Platform handlers via ImageService interface
 * @downstream Calls: Replicate API (api.replicate.com)
 */

import {
  type ServiceResult,
  failure,
  success,
  httpStatusToErrorCode,
} from '../core/types.js';
import { parseApiError } from '../core/http.js';
import type { SecretsProvider } from '@persistence/core';
import type {
  ImageService,
  ImageOptions,
  ImageResult,
  ReplicateConfig,
  ReplicateModelConfig,
} from './types.js';
import { REPLICATE_MODELS } from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_BASE = 'https://api.replicate.com/v1';
const DEFAULT_MAX_WAIT = 60;

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Replicate image generation provider.
 *
 * Use static factory methods to create instances:
 * - `create()` for production (async, uses SecretsProvider)
 * - `fromCredentials()` for testing (sync, direct credentials)
 *
 * @example
 * // Production usage
 * const image = await ReplicateProvider.create(secrets, { model: 'flux-schnell' });
 * const result = await image.generate('a sunset');
 *
 * @example
 * // Testing usage
 * const image = ReplicateProvider.fromCredentials('r8_...');
 */
export class ReplicateProvider implements ImageService {
  private readonly apiToken: string;
  private readonly modelConfig: ReplicateModelConfig;
  private readonly defaultOptions: Partial<ImageOptions>;

  /**
   * @description Private constructor - use static factory methods instead.
   *
   * @upstream Called by: create(), fromCredentials()
   * @downstream Calls: None (initializes state)
   */
  private constructor(config: ReplicateConfig) {
    this.apiToken = config.apiToken;
    this.modelConfig =
      typeof config.model === 'string'
        ? REPLICATE_MODELS[config.model] ?? { modelId: config.model, name: config.model, provider: config.model }
        : config.model;
    this.defaultOptions = config.defaultOptions ?? {};
  }

  /**
   * @description Create provider from secrets.
   *
   * Production factory method that retrieves API token from platform secrets.
   * Returns null if API token is not configured (graceful degradation).
   *
   * @upstream Called by: Platform initialization (Cloudflare Worker, server)
   * @downstream Calls: SecretsProvider.get()
   *
   * @param secrets - Platform secrets provider
   * @param options - Optional configuration (model, defaultOptions)
   * @returns Promise<ReplicateProvider | null> Configured provider instance or null if API token not configured
   *
   * @example
   * const image = await ReplicateProvider.create(secrets, {
   *   model: 'flux-dev',
   *   defaultOptions: { steps: 50 }
   * });
   * if (image) {
   *   const result = await image.generate('a sunset');
   * }
   */
  static async create(
    secrets: SecretsProvider,
    options?: Partial<Omit<ReplicateConfig, 'apiToken'>>
  ): Promise<ReplicateProvider | null> {
    const apiToken = await secrets.get('REPLICATE_API_TOKEN');

    if (!apiToken) {
      console.info('ReplicateProvider: disabled (no REPLICATE_API_TOKEN configured)');
      return null;
    }

    return new ReplicateProvider({
      apiToken,
      model: options?.model ?? 'flux-schnell',
      ...options,
    });
  }

  /**
   * @description Create provider with direct credentials (for testing).
   *
   * Synchronous factory method that accepts credentials directly.
   * Maintains backward compatibility with existing test code.
   *
   * @upstream Called by: Unit tests, development scripts
   * @downstream Calls: constructor
   *
   * @param config - Full configuration or just API token string
   * @returns ReplicateProvider Configured provider instance
   *
   * @example
   * // Simple string (defaults to flux-schnell)
   * const image = ReplicateProvider.fromCredentials('r8_...');
   *
   * @example
   * // Full config
   * const image = ReplicateProvider.fromCredentials({
   *   apiToken: 'r8_...',
   *   model: 'flux-dev'
   * });
   */
  static fromCredentials(config: ReplicateConfig | string): ReplicateProvider {
    if (typeof config === 'string') {
      return new ReplicateProvider({
        apiToken: config,
        model: 'flux-schnell',
      });
    }
    return new ReplicateProvider(config);
  }

  getProviderName(): string {
    return this.modelConfig.provider;
  }

  /**
   * Generate an image using Replicate API.
   *
   * Uses synchronous mode with Prefer: wait header.
   */
  async generate(
    prompt: string,
    options: ImageOptions = {}
  ): Promise<ServiceResult<ImageResult>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const timeout = mergedOptions.timeout ?? 120000;

    try {
      // Build model-specific input
      const input = this.buildInput(prompt, mergedOptions);

      // Determine endpoint
      const endpoint = this.modelConfig.version
        ? `${API_BASE}/predictions`
        : `${API_BASE}/models/${this.modelConfig.modelId}/predictions`;

      // Build request body
      const body: Record<string, unknown> = { input };
      if (this.modelConfig.version) {
        body.version = this.modelConfig.version;
      }

      // Create timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const maxWait = this.modelConfig.maxWaitSeconds ?? DEFAULT_MAX_WAIT;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'Prefer': `wait=${maxWait}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json() as {
        status?: string;
        output?: string | string[];
        error?: string;
        detail?: string;
        title?: string;
      };

      // Handle HTTP errors
      if (!response.ok) {
        const errorMsg =
          parseApiError(data) ?? data.detail ?? data.error ?? `HTTP ${response.status}`;
        return failure(
          httpStatusToErrorCode(response.status),
          errorMsg,
          { statusCode: response.status }
        );
      }

      // Handle API errors
      if (data.error) {
        return failure('SERVICE_ERROR', data.error);
      }

      // Check status
      if (data.status === 'succeeded' && data.output) {
        const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;

        if (!imageUrl) {
          return failure('SERVICE_ERROR', 'No image URL in response');
        }

        // Fetch and convert to base64
        const base64Result = await this.fetchImageAsBase64(imageUrl);
        if (!base64Result.success) {
          return base64Result;
        }

        return success({
          base64: base64Result.data,
          url: imageUrl,
          format: 'image/png',
          provider: this.modelConfig.provider,
        });
      } else if (data.status === 'starting' || data.status === 'processing') {
        return failure('TIMEOUT', 'Generation timed out - try again');
      } else {
        return failure('SERVICE_ERROR', `Unexpected status: ${data.status}`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure('TIMEOUT', 'Request timed out');
      }
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Build model-specific input parameters.
   */
  private buildInput(
    prompt: string,
    options: ImageOptions
  ): Record<string, unknown> {
    const modelId = this.modelConfig.modelId;

    // Base input
    const input: Record<string, unknown> = {
      prompt,
      num_outputs: options.numOutputs ?? 1,
    };

    // Model-specific configurations
    if (modelId.includes('flux-schnell')) {
      input.output_format = options.outputFormat ?? 'png';
      input.go_fast = true;
      if (options.disableSafety !== false) {
        input.disable_safety_checker = true;
      }
    } else if (modelId.includes('flux-dev')) {
      input.output_format = options.outputFormat ?? 'png';
      input.guidance = options.guidance ?? 3.5;
      input.num_inference_steps = options.steps ?? 28;
      if (options.disableSafety !== false) {
        input.disable_safety_checker = true;
      }
    } else if (modelId.includes('sdxl')) {
      input.width = options.width ?? this.modelConfig.defaultWidth ?? 1024;
      input.height = options.height ?? this.modelConfig.defaultHeight ?? 1024;
      input.num_inference_steps = options.steps ?? 30;
      input.guidance_scale = options.guidance ?? 7.5;
      input.scheduler = options.scheduler ?? 'K_EULER';
      if (options.negativePrompt) {
        input.negative_prompt = options.negativePrompt;
      }
      if (options.disableSafety !== false) {
        input.disable_safety_checker = true;
      }
    }

    // Override with any model-specific settings
    if (options.modelSettings) {
      Object.assign(input, options.modelSettings);
    }

    return input;
  }

  /**
   * Fetch image from URL and convert to base64.
   */
  private async fetchImageAsBase64(url: string): Promise<ServiceResult<string>> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return failure('SERVICE_ERROR', `Failed to fetch image: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = this.arrayBufferToBase64(new Uint8Array(buffer));

      return success(`data:image/png;base64,${base64}`);
    } catch (err) {
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Convert Uint8Array to base64 string.
   */
  private arrayBufferToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Create a Replicate provider for a specific model.
 *
 * Convenience factory functions for testing.
 * For production, use ReplicateProvider.create() with SecretsProvider.
 */
export function createFluxSchnellProvider(apiToken: string): ReplicateProvider {
  return ReplicateProvider.fromCredentials({ apiToken, model: 'flux-schnell' });
}

export function createFluxDevProvider(apiToken: string): ReplicateProvider {
  return ReplicateProvider.fromCredentials({ apiToken, model: 'flux-dev' });
}

export function createSDXLProvider(apiToken: string): ReplicateProvider {
  return ReplicateProvider.fromCredentials({ apiToken, model: 'sdxl' });
}
