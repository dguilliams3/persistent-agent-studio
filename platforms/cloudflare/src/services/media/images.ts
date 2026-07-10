/**
 * Image generation service supporting multiple providers
 *
 * @module services/media/images
 * @description Generates images using Cloudflare Workers AI or Replicate API.
 *
 * Multiple providers with automatic routing by prefix:
 * - **No prefix** → Cloudflare Workers AI (Stable Diffusion XL, content-filtered)
 * - **REPLICATE:** → Replicate flux-schnell (fast, creative, ~$0.01)
 * - **FLUX:** → Replicate flux-dev (highest fidelity, ~$0.025)
 * - **SDXL:** → Replicate stability-ai/sdxl with safety off (most permissive, ~$0.01)
 * - **PONY:** → Local Pony Studio via Cloudflare Tunnel (free, requires laptop online)
 *
 * All generated images are automatically compressed from PNG to JPEG
 * to fit within D1's ~900KB row limit.
 *
 * @upstream Called by:
 *   - executeActions() in index.js for MAKE_ART action
 *   - /image and /imagine Telegram command handlers
 *   - /imagine API endpoint
 *
 * @downstream Calls:
 *   - Cloudflare Workers AI binding (env.AI)
 *   - Replicate API (multiple models)
 *   - bytesToBase64, compressPngToJpeg from utils/image.js
 */

import { bytesToBase64, compressPngToJpeg } from '../../utils/image.js';
import { REPLICATE_CONFIG, PONY_CONFIG, IMAGE_COMPRESSION, DEFAULT_NEGATIVE_PROMPT } from '../../constants.js';
import type { Env } from '../../bootstrap.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Image generation deals with multi-provider APIs with varying response shapes.
// Using 'any' for API response bodies and options is appropriate here.

// =============================================================================
// R2 UPLOAD HELPER
// =============================================================================
// Uploads generated images to Pony Studio's R2 bucket for permanent storage.
// Returns URLs that can be stored in Clio's history instead of base64.
// =============================================================================

/**
 * @description Upload an image to Pony Studio's R2 bucket for permanent storage
 *
 * Stores images in the pony-gallery R2 bucket via the gallery worker.
 * Returns permanent URLs that can be stored in Clio's history instead of base64.
 *
 * @upstream Called by: generateImage() after successful generation
 * @downstream Calls: gallery upload endpoint configured by the platform
 *
 * @param {string} base64Data - Data URL (data:image/png;base64,...) or raw base64
 * @param {Object} metadata - Image metadata
 * @param {string} metadata.prompt - Generation prompt
 * @param {string} [metadata.provider] - Which provider generated this
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadToR2(
  base64Data: string,
  metadata: Record<string, any> = {},
  galleryBaseUrl?: string
) {
  if (!galleryBaseUrl) {
    return { success: false, error: 'Gallery upload not configured' };
  }

  try {
    // Strip data URL prefix if present
    const rawBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    // Generate unique filename: clio_YYYYMMDD_HHMMSS_randomhex.png
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const filename = `clio_${dateStr}_${randomHex}.png`;
    const imageKey = `images/${filename}`;

    // Upload to R2
    console.log('[R2] Uploading to:', imageKey);
    const uploadResponse = await fetch(`${galleryBaseUrl}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: imageKey, data: rawBase64 })
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({})) as Record<string, any>;
      console.error('[R2] Upload failed:', uploadResponse.status, errorData);
      return { success: false, error: errorData.error || `Upload failed: ${uploadResponse.status}` };
    }

    const imageUrl = `${galleryBaseUrl}/images/${filename}`;

    // Store metadata in pony-studio D1 (non-fatal if fails)
    try {
      await fetch(`${galleryBaseUrl}/api/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hash: `clio_${dateStr}_${randomHex}`,
          path: imageKey,
          thumb_path: null,
          prompt: metadata.prompt || null,
          negative: metadata.negative || null,
          seed: metadata.seed || null,
          timestamp: Date.now(),
          blurred: false,
          archived: false,
          settings: JSON.stringify({ source: 'clio', provider: metadata.provider || 'unknown' }),
          favorite: false
        })
      });
    } catch (metaErr: unknown) {
      console.warn('[R2] Metadata save failed (non-fatal):', metaErr instanceof Error ? metaErr.message : String(metaErr));
    }

    console.log('[R2] Upload complete:', imageUrl);
    return { success: true, url: imageUrl, key: imageKey, filename };

  } catch (e: unknown) {
    console.error('[R2] Upload error:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// =============================================================================
// REPLICATE API HELPER
// =============================================================================
// Shared helper for all Replicate-based image generation.
// Handles: API calls, error handling, image fetching, compression.
//
// @upstream Called by: generateImageReplicate, generateImageFluxDev, generateImageSDXL
// @downstream Calls: Replicate API, bytesToBase64, compressPngToJpeg
// =============================================================================

/**
 * @description Makes a Replicate API prediction request and processes the result
 *
 * Shared helper that handles the common flow for all Replicate models:
 * 1. POST prediction request with input parameters
 * 2. Handle HTTP and API errors
 * 3. Check status (succeeded/starting/processing)
 * 4. Fetch image from URL and convert to base64
 * 5. Compress to JPEG for storage
 *
 * @upstream Called by: generateImageReplicate, generateImageFluxDev, generateImageSDXL
 * @downstream Calls: Replicate predictions API, fetch (for image URL), bytesToBase64, compressPngToJpeg
 *
 * @param {Object} options - Request configuration
 * @param {string} options.prompt - Image description
 * @param {string} options.apiToken - Replicate API token
 * @param {string} options.modelKey - Key into REPLICATE_CONFIG.models (fluxSchnell|fluxDev|sdxl)
 * @param {Object} options.input - Model-specific input parameters
 * @param {string} options.logPrefix - Prefix for console logs (e.g., '[Replicate]')
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider?: string}>}
 *
 * @example
 * const result = await callReplicateApi({
 *   prompt: 'a sunset',
 *   apiToken: 'r8_...',
 *   modelKey: 'fluxSchnell',
 *   input: { prompt: 'a sunset', num_outputs: 1, disable_safety_checker: true },
 *   logPrefix: '[Replicate]'
 * });
 */
async function callReplicateApi({ prompt, apiToken, modelKey, input, logPrefix }: { prompt: string; apiToken: string; modelKey: string; input: Record<string, any>; logPrefix: string }) {
  const modelConfig = (REPLICATE_CONFIG.models as Record<string, any>)[modelKey];
  const { provider, compression } = modelConfig;
  const url = `${REPLICATE_CONFIG.apiBaseUrl}${modelConfig.endpoint}`;

  try {
    console.log(`${logPrefix} Starting generation for:`, prompt.substring(0, 80) + '...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': `wait=${REPLICATE_CONFIG.maxWaitSeconds}`
      },
      body: JSON.stringify(modelConfig.version ? { version: modelConfig.version, input } : { input })
    });

    const data = await response.json() as any;
    console.log(`${logPrefix} Response status:`, response.status, 'prediction status:', data.status, 'error:', data.error || data.detail || 'none');

    // Handle HTTP errors (like 402 insufficient credit)
    if (!response.ok) {
      const errorMsg = data.detail || data.error || data.title || `HTTP ${response.status}`;
      console.error(`${logPrefix} HTTP error:`, errorMsg);
      return { success: false, error: errorMsg, provider };
    }

    if (data.error) {
      console.error(`${logPrefix} API error:`, data.error);
      return { success: false, error: data.error, provider };
    }

    // Check if completed or need to poll
    if (data.status === 'succeeded' && data.output) {
      const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
      console.log(`${logPrefix} Got image URL:`, imageUrl?.substring(0, 80) + '...');

      if (!imageUrl) {
        return { success: false, error: 'No image URL in response', provider };
      }

      // Fetch the image and convert to base64
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = bytesToBase64(new Uint8Array(imageBuffer));
      const pngBase64 = `data:image/png;base64,${base64}`;

      // Compress the image
      const compressed = compressPngToJpeg(pngBase64, compression.maxDimension, compression.quality);

      if (compressed.error) {
        console.warn(`${logPrefix} Compression failed, using original:`, compressed.error);
        return { success: true, base64: pngBase64, provider };
      }

      console.log(`${logPrefix} Image: ${compressed.originalSizeKB}KB → ${compressed.compressedSizeKB}KB`);
      return { success: true, base64: compressed.base64, provider };
    } else if (data.status === 'starting' || data.status === 'processing') {
      return { success: false, error: 'Generation timed out - try again', provider };
    } else {
      return { success: false, error: `Unexpected status: ${data.status}`, provider };
    }
  } catch (e: unknown) {
    console.error(`${logPrefix} Generation error:`, e);
    return { success: false, error: e instanceof Error ? e.message : String(e), provider };
  }
}

// =============================================================================
// REPLICATE MODEL FUNCTIONS
// =============================================================================
// Individual functions for each supported Replicate model.
// Each builds model-specific input and calls the shared helper.
// =============================================================================

/**
 * @description Generates an image using Replicate flux-schnell (fast, ~$0.01)
 *
 * Uses FLUX Schnell model for fast generation. Images are fetched and compressed
 * before returning. The disable_safety_checker flag allows unrestricted content.
 *
 * @upstream Called by: generateImage() when prompt has REPLICATE: prefix
 * @downstream Calls: callReplicateApi helper
 *
 * @param {string} prompt - Image description (without the REPLICATE: prefix)
 * @param {string} apiToken - Replicate API token from env.REPLICATE_API_TOKEN
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider?: string}>}
 *
 * @example
 * const result = await generateImageReplicate('surreal dreamscape', apiToken);
 * if (result.success) {
 *   // result.base64 contains compressed JPEG data URL
 *   // result.provider === 'replicate'
 * }
 *
 * @note Requires active Replicate account with API credits.
 *       Returns error with HTTP 402 if account has insufficient funds.
 */
export async function generateImageReplicate(prompt: string, apiToken: string) {
  return callReplicateApi({
    prompt,
    apiToken,
    modelKey: 'fluxSchnell',
    input: {
      prompt,
      num_outputs: 1,
      output_format: 'png',
      go_fast: true,
      disable_safety_checker: true
    },
    logPrefix: '[Replicate]'
  });
}

/**
 * @description Generates an image using Replicate flux-dev (highest fidelity, ~$0.025)
 *
 * Uses FLUX Dev model for maximum quality output. Slower but best results.
 * More permissive than flux-schnell for creative content.
 *
 * @upstream Called by: generateImage() when prompt has FLUX: prefix
 * @downstream Calls: callReplicateApi helper
 *
 * @param {string} prompt - Image description (without the FLUX: prefix)
 * @param {string} apiToken - Replicate API token
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider?: string}>}
 */
export async function generateImageFluxDev(prompt: string, apiToken: string) {
  return callReplicateApi({
    prompt,
    apiToken,
    modelKey: 'fluxDev',
    input: {
      prompt,
      num_outputs: 1,
      output_format: 'png',
      guidance: 3.5,
      num_inference_steps: 28,
      disable_safety_checker: true
    },
    logPrefix: '[FluxDev]'
  });
}

/**
 * @description Generates an image using Replicate SDXL with safety checker disabled
 *
 * Uses stability-ai/sdxl model with disable_safety_checker=true for maximum
 * permissiveness. Good quality, ~$0.01/image. Most reliable for NSFW content.
 *
 * @upstream Called by: generateImage() when prompt has SDXL: prefix
 * @downstream Calls: callReplicateApi helper
 *
 * @param {string} prompt - Image description (without the SDXL: prefix)
 * @param {string} apiToken - Replicate API token
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider?: string}>}
 */
export async function generateImageSDXL(prompt: string, apiToken: string) {
  return callReplicateApi({
    prompt,
    apiToken,
    modelKey: 'sdxl',
    input: {
      prompt,
      negative_prompt: DEFAULT_NEGATIVE_PROMPT,
      num_outputs: 1,
      width: 1024,
      height: 1024,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      scheduler: 'K_EULER',
      disable_safety_checker: true
    },
    logPrefix: '[SDXL]'
  });
}

// =============================================================================
// PONY STUDIO PRESETS & PROMPT BUILDER
// =============================================================================
// Parameter presets from pony-studio MCP server.
// These map friendly names to detailed prompt tags.
// =============================================================================

/**
 * @description Pony Studio parameter presets from MCP server
 * Maps simple parameter values to detailed prompt tag strings.
 *
 * @upstream Used by: buildPonyPrompt()
 */
/**
 * @description Complete Pony Studio presets - source of truth for both prompt building AND help display
 * Synced with pony-studio src/App.jsx presets (2026-01-22)
 */
const PONY_PRESETS = {
  position: {
    missionary: 'missionary position, pov, from above, lying on back, spread legs, nude, sex, vaginal, penetration, looking at viewer, eye contact, face visible',
    mating_press: "mating press, legs up, ankles behind head, pov, from above, bird's eye view, looking up at viewer, face visible, eye contact, nude, sex, vaginal, deep penetration, pinned down",
    doggy: 'doggystyle, sex from behind, pov, on all fours, nude, ass, vaginal, penetration, looking back over shoulder, eye contact, face visible, arched back',
    prone: 'prone bone, lying flat on stomach, sex from behind, pov, from above, nude, ass, vaginal, penetration, looking back, face visible',
    cowgirl: 'cowgirl position, girl on top, pov, from below, straddling, nude, riding, vaginal, penetration, bouncing breasts, looking down at viewer, eye contact, face visible',
    reverse_cowgirl: 'reverse cowgirl, girl on top, pov, from below, straddling, nude, riding, ass, back view, vaginal, penetration, looking back at viewer',
    standing: 'standing sex, leg up, pov, nude, vaginal, penetration, lifted leg, against wall, facing viewer, eye contact',
    wall_pin: 'against wall, standing sex, pov, lifted up, pinned',
    blowjob: 'blowjob, fellatio, oral, pov, on knees, looking at viewer, eye contact, direct gaze, face visible',
    titjob: 'paizuri, titjob, breast sandwich, penis between breasts, pov, looking at viewer, eye contact, licking tip, face visible',
    handjob: 'handjob, holding penis, pov, looking at viewer, eye contact, stroking, face visible',
    spooning: 'spooning, lying on side, sex from behind, intimate',
    lap_sitting: 'sitting on lap, face to face, pov',
    pov_standing: 'standing over viewer, pov from below',
    pov_straddling: 'straddling viewer, pov from below'
  },
  body_type: {
    petite: 'petite, small frame, slim, delicate',
    athletic: 'athletic, fit, toned, abs',
    curvy: 'curvy, wide hips, thick thighs, hourglass figure',
    thicc: 'thick thighs, wide hips, big ass, curvy, voluptuous',
    busty: 'huge breasts, large breasts, busty',
    slim: 'slim, slender, thin, lithe'
  },
  hair_color: {
    blonde: 'blonde hair, golden hair',
    brunette: 'brown hair, brunette',
    redhead: 'red hair, ginger',
    black: 'black hair, dark hair',
    white: 'white hair, silver hair',
    pink: 'pink hair',
    blue: 'blue hair',
    purple: 'purple hair, violet hair',
    green: 'green hair',
    rainbow: 'rainbow hair, multicolored hair, gradient hair'
  },
  hair_length: {
    long: 'long hair, flowing hair',
    medium: 'medium hair, shoulder length hair',
    short: 'short hair'
  },
  eye_color: {
    blue: 'blue eyes, bright eyes',
    green: 'green eyes, emerald eyes',
    brown: 'brown eyes, warm eyes',
    hazel: 'hazel eyes',
    purple: 'purple eyes, violet eyes',
    red: 'red eyes, crimson eyes'
  },
  expression: {
    pleasure: 'pleasure, enjoying, slight smile, looking at viewer',
    ahegao: 'ahegao, tongue out, rolling eyes, drooling',
    moaning: 'moaning, open mouth, pleasure',
    orgasm: 'orgasm, intense pleasure, trembling',
    eye_contact: 'looking at viewer, eye contact, direct gaze',
    shy: 'shy, embarrassed, blushing',
    seductive: 'seductive, bedroom eyes, smirking',
    loving: 'loving expression, gentle smile, intimate',
    smug: 'smug, confident, knowing smile',
    surprised: 'surprised, shocked, wide eyes'
  },
  setting: {
    bedroom: 'bedroom, bed, pillows, soft lighting, intimate',
    shower: 'shower, wet, water droplets, steam, glistening skin',
    office: 'office, desk, professional setting',
    hotel: 'hotel room, luxurious, mood lighting',
    outdoors: 'outdoors, nature, natural lighting',
    pool: 'poolside, wet, summer, bright',
    beach: 'beach, sand, ocean, golden hour',
    onsen: 'onsen, hot spring, steam, japanese bath',
    dungeon: 'dungeon, dark, chains, mysterious lighting',
    castle: 'castle, medieval, stone walls, candlelight'
  },
  ethnicity: {
    caucasian: 'caucasian, fair skin',
    asian: 'asian, east asian',
    japanese: 'japanese, asian',
    latina: 'latina, hispanic, tan skin',
    ebony: 'ebony, dark skin, black woman',
    indian: 'indian, south asian, brown skin'
  },
  fantasy: {
    nurse: 'nurse, nurse uniform, nurse cap, stethoscope, white stockings',
    secretary: 'secretary, office lady, glasses, pencil skirt',
    maid: 'maid, french maid, maid uniform, apron',
    teacher: 'teacher, glasses, professional, classroom',
    cheerleader: 'cheerleader, cheerleader uniform, pom poms',
    bunny_girl: 'bunny girl, bunny ears, bunny suit, fishnet stockings',
    catgirl: 'catgirl, cat ears, cat tail, neko',
    princess: 'princess, tiara, elegant dress, royal',
    bride: 'bride, wedding dress, veil, white lingerie',
    schoolgirl: 'schoolgirl, school uniform, plaid skirt',
    cop: 'police officer, cop uniform, handcuffs',
    witch: 'witch, witch hat, magical, spellcaster',
    elf: 'elf, elf ears, fantasy, ethereal beauty',
    demon: 'demon girl, horns, demon tail, succubus',
    angel: 'angel, angel wings, halo, heavenly'
  },
  aesthetic: {
    goth: 'goth girl, pale skin, dark makeup, black lipstick, tattoos, piercing',
    egirl: 'e-girl, colorful hair, heavy blush, cute',
    tomboy: 'tomboy, short hair, athletic, sporty',
    nerd: 'nerd girl, glasses, cute, shy, bookish',
    elegant: 'elegant, sophisticated, classy, refined',
    innocent: 'innocent, cute, pure, sweet',
    punk: 'punk, mohawk, piercings, rebellious, edgy',
    gyaru: 'gyaru, tanned skin, blonde hair, heavy makeup, japanese',
    milf: 'milf, mature, older woman, sophisticated, experienced'
  },
  style: {
    // Realistic/Photography
    realistic: 'realistic, photorealistic, hyperrealistic, RAW photo, detailed skin texture, skin pores, natural lighting, 8k uhd, sharp focus, cinematic lighting',
    glamour: 'professional lighting, beauty shot, magazine quality',
    boudoir: 'intimate, soft lighting, romantic, sensual',
    golden_hour: 'warm sunlight, sun rays, lens flare, backlit',
    noir: 'film noir, black and white, high contrast, dramatic shadows',
    vintage: 'retro, film grain, faded colors, 70s aesthetic',
    // Anime/Manga
    anime: 'source_anime, anime style, cel shading, vibrant colors, clean lines, uncensored',
    hentai: 'source_anime, hentai, anime style, detailed, vibrant, uncensored',
    retro_anime: '80s anime, 90s anime, cel animation, VHS quality',
    manga: 'manga style, black and white, screentones',
    // 3D
    '3d': 'source_3d, 3d render, realistic, ray tracing, high detail',
    disney_3d: 'disney style, 3d animated, pixar style, big eyes',
    pixar: 'pixar style, 3d animated movie, subsurface scattering',
    // 2D/Cartoon
    disney_2d: 'classic disney animation, 2d animated, hand drawn',
    cartoon_2000s: 'early 2000s cartoon, kim possible style, flash animation',
    cartoon_90s: '90s cartoon style, bold outlines, flat colors',
    cartoon_modern: 'adventure time style, steven universe, calarts',
    toon: 'cartoon, toony, stylized, 2d animation',
    looney_tunes: 'classic cartoon, golden age, exaggerated',
    // Art Styles
    artistic: 'artistic, painterly, beautiful lighting, masterpiece, best quality',
    fantasy_art: 'fantasy art, illustration, magical, epic',
    concept_art: 'concept art, professional illustration, artstation',
    comic: 'comic book style, western comic, graphic novel',
    ukiyo_e: 'japanese woodblock print, traditional art, edo period',
    art_nouveau: 'decorative, ornate, flowing lines, floral patterns',
    pin_up: 'pin-up art, vintage, 1950s style, gil elvgren',
    pop_art: 'pop art, andy warhol style, halftone dots',
    watercolor: 'watercolor painting, soft edges, artistic',
    oil_painting: 'oil painting, classical art, renaissance style',
    impressionist: 'impressionist painting, monet style, dreamy',
    gothic: 'gothic, dark aesthetic, moody, dark fantasy, victorian',
    soft_glow: 'soft lighting, dreamy, ethereal, glowing',
    semi_realistic: 'semi-realistic, stylized realism, blend',
    sketch: 'pencil sketch, graphite drawing',
    cel_shaded: 'cel shaded, toon shading, borderlands style'
  }
};

/**
 * @description Generate help text for PONY: presets - used by /image pony ? command
 * @upstream Called by: Telegram command handler (handleTelegramWebhook)
 * @returns {string} Formatted help text listing all preset categories and options
 */
export function getPonyPresetsHelp() {
  const lines = ['🎨 *PONY: Structured Parameters*\n'];
  lines.push('Format: `PONY: key=\'value\' key2=\'value2\' custom text`\n');

  for (const [category, options] of Object.entries(PONY_PRESETS)) {
    const keys = Object.keys(options);
    const displayName = category.replace(/_/g, ' ');
    lines.push(`*${displayName}:* ${keys.join(', ')}`);
  }

  lines.push('\n_Example:_ `PONY: position=\'cowgirl\' style=\'anime\' blue eyes, long hair`');
  lines.push('\n_Quality tags and negative prompt auto-added._');
  return lines.join('\n');
}

/**
 * @description Quality prefix auto-added to all Pony prompts
 */
const PONY_QUALITY_PREFIX = 'score_9, score_8_up, score_7_up, rating_explicit, 1girl, 1boy';

/**
 * @description Default negative prompt for Pony Studio
 */
const PONY_NEGATIVE_PROMPT = 'score_6, score_5, score_4, score_3, score_2, score_1, furry, anthro, pony, mlp, feral, deformed, distorted, disfigured, bad anatomy, wrong anatomy, mutation, mutated, ugly, disgusting, blurry, blur, out of focus, low quality, worst quality, watermark, text, logo, signature, extra fingers, missing fingers, fused fingers, too many fingers, extra limbs, missing limbs, bad hands, poorly drawn hands, extra breasts, multiple breasts, censored, mosaic censoring, bar censor';

/**
 * @description Parse Pony prompt with structured parameters
 *
 * Extracts key='value' pairs and returns remaining text as custom.
 * Format: "position='cowgirl' style='anime' Tifa Lockhart, red eyes"
 *
 * @upstream Called by: buildPonyPrompt()
 *
 * @param {string} rawPrompt - The prompt with optional key='value' pairs
 * @returns {{params: Object, custom: string}} Extracted parameters and remaining text
 *
 * @example
 * parsePonyPrompt("position='cowgirl' style='anime' Tifa Lockhart")
 * // Returns: { params: { position: 'cowgirl', style: 'anime' }, custom: 'Tifa Lockhart' }
 */
function parsePonyPrompt(rawPrompt: string) {
  const params: Record<string, string> = {};
  // Match key='value' or key="value" patterns
  const paramRegex = /(\w+)=['"]([^'"]+)['"]/g;
  let match;
  let lastIndex = 0;

  while ((match = paramRegex.exec(rawPrompt)) !== null) {
    params[match[1]] = match[2];
    lastIndex = paramRegex.lastIndex;
  }

  // Everything after the last param is custom text
  // If no params found, the whole thing is custom
  let custom = lastIndex > 0 ? rawPrompt.slice(lastIndex).trim() : rawPrompt.trim();

  // Also remove any remaining param patterns that might be at the start
  custom = custom.replace(/^(\w+=['"][^'"]+['"]\s*)+/, '').trim();

  return { params, custom };
}

/**
 * @description Build Pony-optimized prompt from parameters
 *
 * Constructs prompt in the same order as Pony Studio MCP:
 * 1. Quality prefix (auto-added)
 * 2. Position → Body → Ethnicity → Hair → Expression → Aesthetic → Fantasy → Setting → Custom → Style
 *
 * @upstream Called by: generateImagePony()
 * @downstream Uses: PONY_PRESETS, PONY_QUALITY_PREFIX
 *
 * @param {string} rawPrompt - The raw prompt with optional key='value' pairs
 * @returns {{prompt: string, negativePrompt: string}} Built prompt and negative prompt
 *
 * @example
 * buildPonyPrompt("position='cowgirl' style='anime' Tifa Lockhart")
 * // Returns: { prompt: 'score_9, score_8_up, ..., cowgirl position, ...', negativePrompt: '...' }
 */
function buildPonyPrompt(rawPrompt: string) {
  const { params, custom } = parsePonyPrompt(rawPrompt);
  const parts = [PONY_QUALITY_PREFIX];

  // Build in Pony Studio order: position → body → ethnicity → hair → eyes → expression → aesthetic → fantasy → setting → custom → style
  const order = ['position', 'body_type', 'ethnicity', 'hair_color', 'hair_length', 'eye_color', 'expression', 'aesthetic', 'fantasy', 'setting'];

  for (const key of order) {
    if (params[key] && (PONY_PRESETS as any)[key]?.[(params as any)[key]]) {
      parts.push((PONY_PRESETS as any)[key][(params as any)[key]]);
    }
  }

  // Add custom text
  if (custom) {
    parts.push(custom);
  }

  // Style goes last
  if (params.style && (PONY_PRESETS.style as Record<string, string>)?.[params.style]) {
    parts.push((PONY_PRESETS.style as Record<string, string>)[params.style]);
  } else {
    // Default to realistic if no style specified
    parts.push(PONY_PRESETS.style.realistic);
  }

  return {
    prompt: parts.join(', '),
    negativePrompt: PONY_NEGATIVE_PROMPT
  };
}

// =============================================================================
// PONY STUDIO FUNCTION
// =============================================================================
// Local image generation via the user's laptop running Pony Studio (ComfyUI).
// Requires laptop online with Cloudflare Tunnel active.
//
// Flow: health check → auth → generate → poll → fetch → compress
// =============================================================================

/**
 * @description Generate image via local Pony Studio (Cloudflare Tunnel)
 *
 * Unlike Replicate providers, Pony Studio requires a multi-step flow:
 * 1. Health check - verify ComfyUI is running on the user's laptop
 * 2. JWT auth - get token for subsequent requests
 * 3. Build prompt - parse key='value' params, add quality tags
 * 4. Queue generation - POST to /api/generate
 * 5. Poll for completion - GET /api/jobs until done
 * 6. Fetch result - get image from gallery
 * 7. Compress - prepare for D1 storage
 *
 * Supports structured parameters via key='value' syntax:
 * - position: missionary, doggy, cowgirl, prone, standing, blowjob, titjob, handjob
 * - body_type: petite, athletic, curvy, thicc, busty, slim
 * - hair_color: blonde, brunette, redhead, black, white, pink, blue
 * - expression: pleasure, ahegao, moaning, shy, seductive, loving
 * - setting: bedroom, shower, office, hotel, outdoors, pool, beach
 * - ethnicity: caucasian, asian, japanese, latina, ebony, indian
 * - fantasy: nurse, maid, teacher, cheerleader, bunny_girl, catgirl
 * - aesthetic: goth, egirl, tomboy, nerd, elegant, innocent
 * - style: realistic, anime, hentai, 3d, artistic
 *
 * Auto-adds quality prefix (score_9, etc.) and negative prompt.
 * Returns gracefully if laptop offline (no error spam).
 *
 * @upstream Called by: generateImage() when PONY: prefix detected
 * @downstream Calls:
 *   - buildPonyPrompt() for parameter parsing and prompt construction
 *   - fetch() to Pony Studio endpoints configured by the platform
 *   - bytesToBase64() for image conversion
 *   - compressPngToJpeg() for image optimization
 *
 * @param {string} prompt - The generation prompt with optional key='value' params
 * @param {Object} env - Worker environment with PONY_* secrets
 * @param {string} env.PONY_STUDIO_URL - Base URL for Pony Studio
 * @param {string} env.PONY_USERNAME - Admin username
 * @param {string} env.PONY_PASSWORD - Admin password
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider: string}>}
 *
 * @example
 * // Simple prompt (just custom text, defaults to realistic style)
 * const result = await generateImagePony('anime girl, sunset', env);
 *
 * // Structured params with custom text
 * const result = await generateImagePony("position='cowgirl' style='anime' Tifa Lockhart", env);
 *
 * @note Requires the user's laptop to be online with tunnel running
 * @note JWT tokens obtained fresh each call for simplicity
 */
export async function generateImagePony(prompt: string, env: Env, options: Record<string, any> = {}) {
  const baseUrl = env.PONY_STUDIO_URL;
  const { endpoints, timeouts: defaultTimeouts, compression } = PONY_CONFIG;

  // Allow timeout override via options (for configurable /ponytimeout)
  const timeouts = {
    ...defaultTimeouts,
    generation: options.ponyTimeout || defaultTimeouts.generation
  };

  try {
    console.log('[Pony] Starting generation for:', prompt.substring(0, 80) + '...');

    // Step 1: Health check - is the laptop online?
    const healthUrl = `${baseUrl}${endpoints.health}`;
    console.log('[Pony] Health check URL:', healthUrl);
    const healthController = new AbortController();
    const healthTimeout = setTimeout(() => healthController.abort(), timeouts.healthCheck);

    try {
      const healthResponse = await fetch(healthUrl, {
        signal: healthController.signal
      });
      clearTimeout(healthTimeout);

      if (!healthResponse.ok) {
        const body = await healthResponse.text().catch(() => '(no body)');
        console.log('[Pony] Health check failed:', healthResponse.status, body.substring(0, 200));
        return { success: false, error: `Pony Studio health check failed: ${healthResponse.status}`, provider: 'pony' };
      }
      console.log('[Pony] Health check passed');
    } catch (e: unknown) {
      clearTimeout(healthTimeout);
      console.log('[Pony] Health check error:', e instanceof Error ? e.name : 'unknown', e instanceof Error ? e.message : String(e));
      return { success: false, error: `Pony Studio unreachable: ${e instanceof Error ? e.message : String(e)}`, provider: 'pony' };
    }

    // Step 2: Authenticate and get JWT token
    console.log('[Pony] Authenticating...');
    const authController = new AbortController();
    const authTimeout = setTimeout(() => authController.abort(), timeouts.auth);

    let token;
    try {
      const authResponse = await fetch(`${baseUrl}${endpoints.auth}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: env.PONY_USERNAME,
          password: env.PONY_PASSWORD
        }),
        signal: authController.signal
      });
      clearTimeout(authTimeout);

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('[Pony] Auth failed:', authResponse.status, errorText);
        return { success: false, error: `Auth failed: ${authResponse.status}`, provider: 'pony' };
      }

      const authData = await authResponse.json() as Record<string, any>;
      token = authData.token || authData.access_token;
      if (!token) {
        console.error('[Pony] No token in auth response:', authData);
        return { success: false, error: 'Auth succeeded but no token returned', provider: 'pony' };
      }
      console.log('[Pony] Authenticated successfully');
    } catch (e: unknown) {
      clearTimeout(authTimeout);
      console.error('[Pony] Auth error:', e instanceof Error ? e.message : String(e));
      return { success: false, error: `Auth failed: ${e instanceof Error ? e.message : String(e)}`, provider: 'pony' };
    }

    // Step 3: Build Pony-optimized prompt with quality tags
    const { prompt: builtPrompt, negativePrompt } = buildPonyPrompt(prompt);
    console.log('[Pony] Built prompt:', builtPrompt.substring(0, 100) + '...');

    // Step 4: Queue generation job
    console.log('[Pony] Queueing generation...');
    const generateResponse = await fetch(`${baseUrl}${endpoints.generate}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: builtPrompt,
        negative: negativePrompt,
        seed: -1,
        width: 832,
        height: 1216,
        steps: 25,
        cfg: 7
      })
    }, env.PONY_GALLERY_URL);

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('[Pony] Generate failed:', generateResponse.status, errorText);
      return { success: false, error: `Generate failed: ${generateResponse.status} - ${errorText.substring(0, 100)}`, provider: 'pony' };
    }

    const generateData = await generateResponse.json() as Record<string, any>;
    // Pony Studio returns { success, message, jobs: [{ promptId, seed }] }
    const jobId = generateData.jobs?.[0]?.promptId || generateData.jobId || generateData.job_id || generateData.id;
    console.log('[Pony] Job queued:', jobId, 'from response:', JSON.stringify(generateData).substring(0, 200));

    // Step 4: Poll for completion
    console.log('[Pony] Polling for completion...');
    const startTime = Date.now();
    let imageUrl = null;

    while (Date.now() - startTime < timeouts.generation) {
      await new Promise(resolve => setTimeout(resolve, timeouts.pollInterval));

      // Pony Studio /api/jobs returns array of all jobs (no query param filtering)
      const jobsResponse = await fetch(`${baseUrl}${endpoints.jobs}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!jobsResponse.ok) {
        console.warn('[Pony] Jobs poll failed:', jobsResponse.status);
        continue;
      }

      const jobsData = await jobsResponse.json() as Record<string, any>;
      console.log('[Pony] Jobs response:', JSON.stringify(jobsData).substring(0, 500));
      // Pony returns { pendingJobs: [...], recentCompleted: N } - check pendingJobs array
      const jobsArray = jobsData.pendingJobs || jobsData.jobs || (Array.isArray(jobsData) ? jobsData : []);
      const job = jobsArray.find((j: any) => j.promptId === jobId || j.jobId === jobId || j.id === jobId || j.job_id === jobId);

      if (job) {
        // Job still in pending queue - keep waiting
        console.log('[Pony] Job', jobId, 'still pending (attempt', job.attempts || 1, ')');
        continue;
      }

      // Job not in pendingJobs = completed! Fetch from gallery
      console.log('[Pony] Job', jobId, 'not in pending - checking gallery for completed image');

      // Small delay to let gallery update after job completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      const galleryResponse = await fetch(`${baseUrl}${endpoints.gallery}?page=1&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (galleryResponse.ok) {
        const galleryData = await galleryResponse.json() as Record<string, any>;
        console.log('[Pony] Gallery response (looking for promptId:', jobId, '):', JSON.stringify(galleryData).substring(0, 500));
        const images = galleryData.images || galleryData.items || galleryData;
        if (Array.isArray(images) && images.length > 0) {
          // Try to match by promptId first (if Pony stores it in gallery records)
          let matchedImage = images.find(img =>
            img.promptId === jobId ||
            img.prompt_id === jobId ||
            img.jobId === jobId ||
            img.job_id === jobId
          );

          if (matchedImage) {
            console.log('[Pony] Found matching image by promptId:', matchedImage.id || matchedImage.promptId);
          } else {
            // Fallback: take most recent image (legacy behavior, may cause race conditions)
            console.warn('[Pony] No promptId match found, using most recent image (may be wrong!)');
            console.log('[Pony] Available image fields:', images[0] ? Object.keys(images[0]).join(', ') : 'none');
            matchedImage = images[0];
          }

          imageUrl = matchedImage.r2ImageUrl || matchedImage.url || matchedImage.image_url || matchedImage.path;
          console.log('[Pony] Found image URL:', imageUrl);
          break;
        }
      }
      // Gallery didn't have it yet, keep polling
    }

    if (!imageUrl) {
      return { success: false, error: 'Generation timed out or no image URL returned', provider: 'pony' };
    }

    // Step 5: Fetch the image
    console.log('[Pony] Fetching image from:', imageUrl.substring(0, 80) + '...');

    // If imageUrl is relative, prepend base URL
    const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

    const imageResponse = await fetch(fullImageUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!imageResponse.ok) {
      console.error('[Pony] Image fetch failed:', imageResponse.status);
      return { success: false, error: `Image fetch failed: ${imageResponse.status}`, provider: 'pony' };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = bytesToBase64(new Uint8Array(imageBuffer));
    const pngBase64 = `data:image/png;base64,${base64}`;

    // Step 6: Compress the image
    const compressed = compressPngToJpeg(pngBase64, compression.maxDimension, compression.quality);

    if (compressed.error) {
      console.warn('[Pony] Compression failed, using original:', compressed.error);
      return { success: true, base64: pngBase64, provider: 'pony' };
    }

    console.log(`[Pony] Image: ${compressed.originalSizeKB}KB → ${compressed.compressedSizeKB}KB`);
    return { success: true, base64: compressed.base64, provider: 'pony' };

  } catch (e: unknown) {
    console.error('[Pony] Generation error:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e), provider: 'pony' };
  }
}

// =============================================================================
// MAIN ROUTER FUNCTION
// =============================================================================
// Entry point that routes to the appropriate provider based on prefix.
// =============================================================================

/**
 * @description Generates an image using Cloudflare Workers AI or Replicate
 *
 * Main entry point for image generation. Routes based on prefix:
 * - REPLICATE: → flux-schnell (fast)
 * - FLUX: → flux-dev (high fidelity)
 * - SDXL: → stability-ai/sdxl (most permissive)
 * - PONY: → Local Pony Studio (free, requires laptop online)
 * - No prefix → Cloudflare Workers AI
 *
 * Cloudflare AI returns images in various formats (ReadableStream, ArrayBuffer,
 * Uint8Array, or object). This function handles all cases and compresses the
 * result to JPEG for storage efficiency.
 *
 * @upstream Called by: MAKE_ART action executor, /image command, /imagine API
 * @downstream Calls: generateImageReplicate, generateImageFluxDev, generateImageSDXL, generateImagePony, env.AI.run
 *
 * @param {string} prompt - Text description of the image to generate
 *                          Prefix with "REPLICATE: " to use Replicate API
 * @param {Object} env - Environment object containing AI binding and secrets
 * @param {Object} env.AI - Cloudflare Workers AI binding
 * @param {string} [env.REPLICATE_API_TOKEN] - Optional Replicate API token
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider?: string}>}
 *
 * @example
 * // Use Cloudflare AI (default, content-filtered)
 * const result = await generateImage('a sunset over mountains', env);
 *
 * // Use Replicate flux-schnell (fast)
 * const result = await generateImage('REPLICATE: surreal alien landscape', env);
 *
 * // Use SDXL (most permissive, safety off)
 * const result = await generateImage('SDXL: detailed portrait', env);
 *
 * if (result.success) {
 *   // result.base64 contains "data:image/jpeg;base64,..." (compressed)
 *   // result.provider is 'cloudflare', 'replicate', 'flux-dev', or 'sdxl'
 * }
 *
 * @note Images are compressed to ~100-300KB JPEG to fit D1 row limits (~900KB).
 *       Original PNG can be 2-3MB before compression.
 */
export async function generateImage(prompt: string, env: Env, options: Record<string, any> = {}) {
  // Helper to add R2 upload to successful results
  async function withR2Upload(result: any, promptText: string) {
    if (!result.success || !result.base64) {
      return result;
    }

    // Upload to R2 for permanent storage
    const r2Result = await uploadToR2(result.base64, {
      prompt: promptText,
      provider: result.provider
    });

    if (r2Result.success) {
      console.log('[generateImage] R2 URL:', r2Result.url);
      return {
        ...result,
        url: r2Result.url  // Add URL while keeping base64 for backward compat
      };
    }

    // Fall back to base64-only if R2 fails
    console.warn('[generateImage] R2 upload failed, using base64 only:', r2Result.error);
    return result;
  }

  try {
    // Check for REPLICATE: prefix → flux-schnell (fast, ~$0.01)
    const replicateMatch = prompt.match(/^REPLICATE:\s*(.+)$/i);
    if (replicateMatch) {
      const actualPrompt = replicateMatch[1].trim();
      if (!env.REPLICATE_API_TOKEN) {
        return { success: false, error: 'Replicate not configured - add REPLICATE_API_TOKEN secret' };
      }
      console.log('Routing to flux-schnell:', actualPrompt.substring(0, 50) + '...');
      const result = await generateImageReplicate(actualPrompt, env.REPLICATE_API_TOKEN);
      return await withR2Upload(result, actualPrompt);
    }

    // Check for FLUX: prefix → flux-dev (highest fidelity, ~$0.025)
    const fluxMatch = prompt.match(/^FLUX:\s*(.+)$/i);
    if (fluxMatch) {
      const actualPrompt = fluxMatch[1].trim();
      if (!env.REPLICATE_API_TOKEN) {
        return { success: false, error: 'Replicate not configured - add REPLICATE_API_TOKEN secret' };
      }
      console.log('Routing to flux-dev (high fidelity):', actualPrompt.substring(0, 50) + '...');
      const result = await generateImageFluxDev(actualPrompt, env.REPLICATE_API_TOKEN);
      return await withR2Upload(result, actualPrompt);
    }

    // Check for SDXL: prefix → stability-ai/sdxl with safety off (most permissive, ~$0.01)
    const sdxlMatch = prompt.match(/^SDXL:\s*(.+)$/i);
    if (sdxlMatch) {
      const actualPrompt = sdxlMatch[1].trim();
      if (!env.REPLICATE_API_TOKEN) {
        return { success: false, error: 'Replicate not configured - add REPLICATE_API_TOKEN secret' };
      }
      console.log('Routing to SDXL (uncensored):', actualPrompt.substring(0, 50) + '...');
      const result = await generateImageSDXL(actualPrompt, env.REPLICATE_API_TOKEN);
      return await withR2Upload(result, actualPrompt);
    }

    // Check for PONY: prefix → Local Pony Studio via Cloudflare Tunnel (free, requires laptop)
    const ponyMatch = prompt.match(/^PONY:\s*(.+)$/i);
    if (ponyMatch) {
      const actualPrompt = ponyMatch[1].trim();
      if (!env.PONY_STUDIO_URL) {
        return { success: false, error: 'Pony Studio not configured', provider: 'pony' };
      }
      console.log('[Pony] Routing to Pony Studio:', actualPrompt.substring(0, 50) + '...');
      const result = await generateImagePony(actualPrompt, env, options);
      return await withR2Upload(result, actualPrompt);
    }

    // Default: Use Cloudflare Workers AI for image generation
    const response = await (env.AI as any).run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: prompt,
      negative_prompt: DEFAULT_NEGATIVE_PROMPT
    });

    // Debug: log response type
    console.log('AI response type:', typeof response, response?.constructor?.name);
    console.log('AI response keys:', response ? Object.keys(response) : 'null');

    // Response could be ReadableStream, ArrayBuffer, or object with image property
    let imageData;

    if (response instanceof ReadableStream) {
      // It's a stream, read it
      const reader = response.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      imageData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        imageData.set(chunk, offset);
        offset += chunk.length;
      }
    } else if (response instanceof ArrayBuffer) {
      imageData = new Uint8Array(response);
    } else if (response instanceof Uint8Array) {
      imageData = response;
    } else if (response && response.image) {
      // Some models return { image: base64string }
      if (typeof response.image === 'string') {
        const base64 = response.image.startsWith('data:') ? response.image : `data:image/png;base64,${response.image}`;
        return await withR2Upload({ success: true, base64, provider: 'cloudflare' }, prompt);
      }
      imageData = new Uint8Array(response.image);
    } else {
      // Try treating it as raw bytes
      imageData = new Uint8Array(response);
    }

    const base64 = bytesToBase64(imageData);

    if (!base64 || base64.length < 100) {
      console.log('Base64 too short:', base64?.length, 'imageData length:', imageData?.length);
      return { success: false, error: 'Image data too small or empty', provider: 'cloudflare' };
    }

    const pngBase64 = `data:image/png;base64,${base64}`;

    // Compress PNG to JPEG to fit in D1 storage (max ~900KB)
    const compressed = compressPngToJpeg(pngBase64, IMAGE_COMPRESSION.maxDimension, IMAGE_COMPRESSION.jpegQuality);

    if (compressed.error) {
      console.warn('Compression failed, using original PNG:', compressed.error);
      return await withR2Upload({ success: true, base64: pngBase64, provider: 'cloudflare' }, prompt);
    }

    console.log('[Cloudflare] Image generated successfully');
    return await withR2Upload({ success: true, base64: compressed.base64, provider: 'cloudflare' }, prompt);
  } catch (e: unknown) {
    console.error('Image generation error:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e), provider: 'cloudflare' };
  }
}
