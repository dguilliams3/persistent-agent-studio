/**
 * Platform Bootstrap - Service Initialization
 *
 * @module platforms/cloudflare/src/bootstrap
 * @description Creates all service instances from environment and secrets.
 *
 * This public extraction keeps the product core (LLM, memory, SIM, media, TTS,
 * STT, search) but intentionally ships zero concrete Telegram/Discord adapters.
 * Outbound messaging is a bring-your-own-channel extension point.
 *
 * @upstream Called by: Worker fetch handler (`platforms/cloudflare/src/index.ts`)
 * @downstream Calls: capability providers from `@persistence/services`
 */

import { CloudflareSecretsProvider, type SecretsProvider } from '@persistence/core';
import { ElevenLabsProvider, type TTSService } from '@persistence/services/tts';
import {
  CloudflareWhisperProvider,
  ModalProsodyProvider,
  type STTService,
  type ProsodyService,
} from '@persistence/services/stt';
import {
  ReplicateProvider,
  CloudflareAIProvider,
  PonyStudioProvider,
  type ImageService,
} from '@persistence/services/image_generation';
import { ClaudeSearchProvider, type SearchService } from '@persistence/services/search';
import { createLLM, type LLM } from '@persistence/llm';

export interface Env {
  DB: D1Database;
  AI: unknown;

  ANTHROPIC_API_KEY: string;
  ADMIN_PASSWORD: string;

  ELEVENLABS_API_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  PONY_STUDIO_USERNAME?: string;
  PONY_STUDIO_PASSWORD?: string;
  PONY_STUDIO_URL?: string;
  PONY_GALLERY_URL?: string;
  ADMIN_USERNAME?: string;
  JWT_SECRET?: string;

  [key: string]: unknown;
}

export function validateEnv(env: Env): void {
  const required = ['ANTHROPIC_API_KEY', 'ADMIN_PASSWORD'] as const;
  const missing = required.filter((key) => !env[key] || typeof env[key] !== 'string');

  if (missing.length > 0) {
    throw new Error(
      `Missing required secrets: ${missing.join(', ')}. ` +
        `Set them via: ${missing.map((key) => `npx wrangler secret put ${key}`).join(', ')}`,
    );
  }
}

export interface Services {
  tts: TTSService | null;
  stt: STTService;
  prosody: ProsodyService;
  imageGen: {
    replicate: ImageService | null;
    cloudflare: ImageService;
    pony: ImageService | null;
  };
  search: SearchService;
  llm: LLM;
}

export async function createServices(env: Env): Promise<Services> {
  const secrets: SecretsProvider = new CloudflareSecretsProvider(env);

  const [tts, pony, search, llm] = await Promise.all([
    ElevenLabsProvider.create(secrets),
    PonyStudioProvider.create(secrets),
    ClaudeSearchProvider.create(secrets),
    createLLM(secrets),
  ]);

  const replicate = await ReplicateProvider.create(secrets, {
    model: 'flux-schnell',
  });

  const prosody = new ModalProsodyProvider();
  const stt = new CloudflareWhisperProvider(env.AI);
  const cloudflareImage = new CloudflareAIProvider(env.AI);

  return {
    tts,
    stt,
    prosody,
    imageGen: {
      replicate,
      cloudflare: cloudflareImage,
      pony,
    },
    search,
    llm,
  };
}
