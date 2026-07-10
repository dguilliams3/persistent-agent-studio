/**
 * Pony Studio Image Generation Provider
 *
 * @module @persistence/services/image_generation/pony
 * @description Pony Studio image generation via configured endpoint.
 *
 * Requires a reachable Pony Studio deployment.
 * Supports structured parameters via key='value' syntax.
 *
 * Flow: health check -> auth -> generate -> poll -> fetch -> return
 *
 * @upstream Called by: Platform handlers via ImageService interface
 * @downstream Calls: Pony Studio endpoints configured via PONY_STUDIO_URL
 *
 * @note Requires Pony Studio endpoint configured and reachable
 * @note JWT tokens obtained fresh each call
 */

import {
  type ServiceResult,
  failure,
  success,
} from '../core/types.js';
import type { SecretsProvider } from '@persistence/core';
import type {
  ImageService,
  ImageOptions,
  ImageResult,
  PonyStudioConfig,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const POLL_INTERVAL = 2000; // 2 seconds
const HEALTH_TIMEOUT = 5000; // 5 seconds
const AUTH_TIMEOUT = 10000; // 10 seconds

const QUALITY_PREFIX = 'score_9, score_8_up, score_7_up, rating_explicit, 1girl, 1boy';

// TODO: Does Pony as an endpoint expose these options for the user to choose from?
const NEGATIVE_PROMPT =
  'score_6, score_5, score_4, score_3, score_2, score_1, furry, anthro, pony, mlp, feral, ' +
  'deformed, distorted, disfigured, bad anatomy, wrong anatomy, mutation, mutated, ugly, ' +
  'disgusting, blurry, blur, out of focus, low quality, worst quality, watermark, text, logo, ' +
  'signature, extra fingers, missing fingers, fused fingers, too many fingers, extra limbs, ' +
  'missing limbs, bad hands, poorly drawn hands, extra breasts, multiple breasts, censored, ' +
  'mosaic censoring, bar censor';

// =============================================================================
// PRESETS
// =============================================================================

const PONY_PRESETS: Record<string, Record<string, string>> = {
  position: {
    missionary: 'missionary position, pov, from above, lying on back, spread legs, nude, sex, vaginal, penetration, looking at viewer, eye contact, face visible',
    mating_press: "mating press, legs up, ankles behind head, pov, from above, bird's eye view, looking up at viewer, face visible, eye contact, nude, sex, vaginal, deep penetration, pinned down",
    doggy: 'doggystyle, sex from behind, pov, on all fours, nude, ass, vaginal, penetration, looking back over shoulder, eye contact, face visible, arched back',
    prone: 'prone bone, lying flat on stomach, sex from behind, pov, from above, nude, ass, vaginal, penetration, looking back, face visible',
    cowgirl: 'cowgirl position, girl on top, pov, from below, straddling, nude, riding, vaginal, penetration, bouncing breasts, looking down at viewer, eye contact, face visible',
    reverse_cowgirl: 'reverse cowgirl, girl on top, pov, from below, straddling, nude, riding, ass, back view, vaginal, penetration, looking back at viewer',
    standing: 'standing sex, leg up, pov, nude, vaginal, penetration, lifted leg, against wall, facing viewer, eye contact',
    blowjob: 'blowjob, fellatio, oral, pov, on knees, looking at viewer, eye contact, direct gaze, face visible',
    titjob: 'paizuri, titjob, breast sandwich, penis between breasts, pov, looking at viewer, eye contact, licking tip, face visible',
    handjob: 'handjob, holding penis, pov, looking at viewer, eye contact, stroking, face visible',
  },
  body_type: {
    petite: 'petite, small frame, slim, delicate',
    athletic: 'athletic, fit, toned, abs',
    curvy: 'curvy, wide hips, thick thighs, hourglass figure',
    thicc: 'thick thighs, wide hips, big ass, curvy, voluptuous',
    busty: 'huge breasts, large breasts, busty',
    slim: 'slim, slender, thin, lithe',
  },
  hair_color: {
    blonde: 'blonde hair, golden hair',
    brunette: 'brown hair, brunette',
    redhead: 'red hair, ginger',
    black: 'black hair, dark hair',
    white: 'white hair, silver hair',
    pink: 'pink hair',
    blue: 'blue hair',
  },
  expression: {
    pleasure: 'pleasure, enjoying, slight smile, looking at viewer',
    ahegao: 'ahegao, tongue out, rolling eyes, drooling',
    moaning: 'moaning, open mouth, pleasure',
    shy: 'shy, embarrassed, blushing',
    seductive: 'seductive, bedroom eyes, smirking',
    loving: 'loving expression, gentle smile, intimate',
  },
  setting: {
    bedroom: 'bedroom, bed, pillows, soft lighting, intimate',
    shower: 'shower, wet, water droplets, steam, glistening skin',
    office: 'office, desk, professional setting',
    hotel: 'hotel room, luxurious, mood lighting',
    outdoors: 'outdoors, nature, natural lighting',
    pool: 'poolside, wet, summer, bright',
    beach: 'beach, sand, ocean, golden hour',
  },
  ethnicity: {
    caucasian: 'caucasian, fair skin',
    asian: 'asian, east asian',
    japanese: 'japanese, asian',
    latina: 'latina, hispanic, tan skin',
    ebony: 'ebony, dark skin, black woman',
    indian: 'indian, south asian, brown skin',
  },
  fantasy: {
    nurse: 'nurse, nurse uniform, nurse cap, stethoscope, white stockings',
    maid: 'maid, french maid, maid uniform, apron',
    teacher: 'teacher, glasses, professional, classroom',
    cheerleader: 'cheerleader, cheerleader uniform, pom poms',
    bunny_girl: 'bunny girl, bunny ears, bunny suit, fishnet stockings',
    catgirl: 'catgirl, cat ears, cat tail, neko',
  },
  aesthetic: {
    goth: 'goth girl, pale skin, dark makeup, black lipstick, tattoos, piercing',
    egirl: 'e-girl, colorful hair, heavy blush, cute',
    tomboy: 'tomboy, short hair, athletic, sporty',
    nerd: 'nerd girl, glasses, cute, shy, bookish',
    elegant: 'elegant, sophisticated, classy, refined',
    innocent: 'innocent, cute, pure, sweet',
  },
  style: {
    realistic: 'realistic, photorealistic, hyperrealistic, RAW photo, detailed skin texture, skin pores, natural lighting, 8k uhd, sharp focus, cinematic lighting',
    anime: 'source_anime, anime style, cel shading, vibrant colors, clean lines, uncensored',
    hentai: 'source_anime, hentai, anime style, detailed, vibrant, uncensored',
    '3d': 'source_3d, 3d render, realistic, ray tracing, high detail',
    artistic: 'artistic, painterly, beautiful lighting, masterpiece, best quality',
  },
};

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Pony Studio image generation provider.
 *
 * Use static factory methods to create instances:
 * - `create()` for production (async, uses SecretsProvider)
 * - `fromCredentials()` for testing (sync, direct credentials)
 *
 * @example
 * // Production usage
 * const image = await PonyStudioProvider.create(secrets);
 * const result = await image.generate("position='cowgirl' style='anime'");
 *
 * @example
 * // Testing usage
 * const image = PonyStudioProvider.fromCredentials({
 *   baseUrl: 'https://your-pony-studio.example.com',
 *   username: 'admin',
 *   password: 'secret'
 * });
 */
export class PonyStudioProvider implements ImageService {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly timeout: number;

  /**
   * @description Private constructor - use static factory methods instead.
   *
   * @upstream Called by: create(), fromCredentials()
   * @downstream Calls: None (initializes state)
   */
  private constructor(config: PonyStudioConfig) {
    this.baseUrl = config.baseUrl;
    this.username = config.username;
    this.password = config.password;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * @description Create provider from secrets.
   *
   * Production factory method that retrieves credentials from platform secrets.
   * Returns null if credentials are not configured (graceful degradation).
   *
   * @upstream Called by: Platform initialization (Cloudflare Worker, server)
   * @downstream Calls: SecretsProvider.get()
   *
   * @param secrets - Platform secrets provider
   * @param options - Optional configuration overrides (baseUrl, timeout)
   * @returns Promise<PonyStudioProvider | null> Configured provider instance or null if credentials not configured
   *
   * @example
   * const image = await PonyStudioProvider.create(secrets, {
   *   timeout: 180000
   * });
   * if (image) {
   *   const result = await image.generate("position='cowgirl'");
   * }
   */
  static async create(
    secrets: SecretsProvider,
    options?: Partial<Omit<PonyStudioConfig, 'username' | 'password'>>
  ): Promise<PonyStudioProvider | null> {
    const username = await secrets.get('PONY_STUDIO_USERNAME');
    const password = await secrets.get('PONY_STUDIO_PASSWORD');

    if (!username) {
      console.info('PonyStudioProvider: disabled (no PONY_STUDIO_USERNAME configured)');
      return null;
    }
    if (!password) {
      console.info('PonyStudioProvider: disabled (no PONY_STUDIO_PASSWORD configured)');
      return null;
    }

    const baseUrl = await secrets.get('PONY_STUDIO_URL');
    if (!baseUrl) {
      console.info('PonyStudioProvider: disabled (no PONY_STUDIO_URL configured)');
      return null;
    }

    return new PonyStudioProvider({
      baseUrl,
      username,
      password,
      ...options,
    });
  }

  /**
   * @description Create provider with direct credentials (for testing).
   *
   * Synchronous factory method that accepts credentials directly.
   *
   * @upstream Called by: Unit tests, development scripts
   * @downstream Calls: constructor
   *
   * @param config - Full configuration object
   * @returns PonyStudioProvider Configured provider instance
   *
   * @example
   * const image = PonyStudioProvider.fromCredentials({
   *   baseUrl: 'https://your-pony-studio.example.com',
   *   username: 'admin',
   *   password: 'secret'
   * });
   */
  static fromCredentials(config: PonyStudioConfig): PonyStudioProvider {
    return new PonyStudioProvider(config);
  }

  getProviderName(): string {
    return 'pony';
  }

  /**
   * Generate an image using Pony Studio.
   *
   * Supports structured parameters via key='value' syntax:
   * - position, body_type, hair_color, expression, setting, ethnicity, fantasy, aesthetic, style
   */
  async generate(
    prompt: string,
    options: ImageOptions = {}
  ): Promise<ServiceResult<ImageResult>> {
    const timeout = options.timeout ?? this.timeout;
    const startTime = Date.now();

    try {
      // Step 1: Health check
      const healthResult = await this.healthCheck();
      if (!healthResult.success) {
        return healthResult;
      }

      // Step 2: Authenticate
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }
      const token = authResult.data;

      // Step 3: Build prompt
      const { prompt: builtPrompt, negativePrompt } = this.buildPrompt(prompt);

      // Step 4: Queue generation
      const generateResult = await this.queueGeneration(token, builtPrompt, negativePrompt);
      if (!generateResult.success) {
        return generateResult;
      }
      const jobId = generateResult.data;

      // Step 5: Poll for completion
      const imageUrl = await this.pollForCompletion(token, jobId, timeout - (Date.now() - startTime));
      if (!imageUrl.success) {
        return imageUrl;
      }

      // Step 6: Fetch image
      const imageResult = await this.fetchImage(token, imageUrl.data);
      if (!imageResult.success) {
        return imageResult;
      }

      return success({
        base64: imageResult.data,
        format: 'image/png',
        provider: 'pony',
      });
    } catch (err) {
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Check if Pony Studio is online.
   */
  private async healthCheck(): Promise<ServiceResult<void>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);

      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return failure('SERVICE_ERROR', `Pony Studio health check failed: ${response.status}`);
      }

      return success(undefined);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure('TIMEOUT', 'Pony Studio unreachable (timeout)');
      }
      return failure('NETWORK_ERROR', `Pony Studio unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Authenticate and get JWT token.
   */
  private async authenticate(): Promise<ServiceResult<string>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT);

      const response = await fetch(`${this.baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return failure('AUTH_ERROR', `Auth failed: ${response.status}`);
      }

      const data = await response.json() as { token?: string; access_token?: string };
      const token = data.token ?? data.access_token;

      if (!token) {
        return failure('AUTH_ERROR', 'Auth succeeded but no token returned');
      }

      return success(token);
    } catch (err) {
      return failure('AUTH_ERROR', `Auth failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Build Pony-optimized prompt from parameters.
   */
  private buildPrompt(rawPrompt: string): { prompt: string; negativePrompt: string } {
    const { params, custom } = this.parsePrompt(rawPrompt);
    const parts = [QUALITY_PREFIX];

    // Build in order: position -> body -> ethnicity -> hair -> expression -> aesthetic -> fantasy -> setting
    const order = ['position', 'body_type', 'ethnicity', 'hair_color', 'expression', 'aesthetic', 'fantasy', 'setting'];

    for (const key of order) {
      if (params[key] && PONY_PRESETS[key]?.[params[key]]) {
        parts.push(PONY_PRESETS[key][params[key]]);
      }
    }

    // Add custom text
    if (custom) {
      parts.push(custom);
    }

    // Style goes last
    if (params.style && PONY_PRESETS.style?.[params.style]) {
      parts.push(PONY_PRESETS.style[params.style]);
    } else {
      parts.push(PONY_PRESETS.style.realistic);
    }

    return {
      prompt: parts.join(', '),
      negativePrompt: NEGATIVE_PROMPT,
    };
  }

  /**
   * Parse key='value' parameters from prompt.
   */
  private parsePrompt(rawPrompt: string): { params: Record<string, string>; custom: string } {
    const params: Record<string, string> = {};
    const paramRegex = /(\w+)=['"]([^'"]+)['"]/g;
    let match;
    let lastIndex = 0;

    while ((match = paramRegex.exec(rawPrompt)) !== null) {
      params[match[1]] = match[2];
      lastIndex = paramRegex.lastIndex;
    }

    let custom = lastIndex > 0 ? rawPrompt.slice(lastIndex).trim() : rawPrompt.trim();
    custom = custom.replace(/^(\w+=['"][^'"]+['"]\s*)+/, '').trim();

    return { params, custom };
  }

  /**
   * Queue a generation job.
   */
  private async queueGeneration(
    token: string,
    prompt: string,
    negativePrompt: string
  ): Promise<ServiceResult<string>> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt,
        negative: negativePrompt,
        seed: -1,
        width: 832,
        height: 1216,
        steps: 25,
        cfg: 7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return failure('SERVICE_ERROR', `Generate failed: ${response.status} - ${errorText.slice(0, 100)}`);
    }

    const data = await response.json() as { jobs?: Array<{ promptId?: string }>; jobId?: string; id?: string };
    const jobId = data.jobs?.[0]?.promptId ?? data.jobId ?? data.id;

    if (!jobId) {
      return failure('SERVICE_ERROR', 'No job ID in response');
    }

    return success(jobId);
  }

  /**
   * Poll for job completion.
   */
  private async pollForCompletion(
    token: string,
    jobId: string,
    remainingTimeout: number
  ): Promise<ServiceResult<string>> {
    const startTime = Date.now();

    while (Date.now() - startTime < remainingTimeout) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

      const response = await fetch(`${this.baseUrl}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) continue;

      const data = await response.json() as { pendingJobs?: Array<{ promptId?: string }> };
      const pending = data.pendingJobs ?? [];
      const job = pending.find((j) => j.promptId === jobId);

      if (!job) {
        // Job not in pending = completed
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const galleryResponse = await fetch(`${this.baseUrl}/api/gallery?page=1&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (galleryResponse.ok) {
          const galleryData = await galleryResponse.json() as { images?: Array<{ r2ImageUrl?: string; url?: string }> };
          const images = galleryData.images ?? [];
          if (images.length > 0) {
            const imageUrl = images[0].r2ImageUrl ?? images[0].url;
            if (imageUrl) {
              return success(imageUrl);
            }
          }
        }
      }
    }

    return failure('TIMEOUT', 'Generation timed out');
  }

  /**
   * Fetch image and convert to base64.
   */
  private async fetchImage(token: string, imageUrl: string): Promise<ServiceResult<string>> {
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${this.baseUrl}${imageUrl}`;

    const response = await fetch(fullUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      return failure('SERVICE_ERROR', `Image fetch failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(new Uint8Array(buffer));

    return success(`data:image/png;base64,${base64}`);
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
 * Get available Pony preset categories and their options.
 */
export function getPonyPresets(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(PONY_PRESETS).map(([category, options]) => [category, Object.keys(options)])
  );
}
