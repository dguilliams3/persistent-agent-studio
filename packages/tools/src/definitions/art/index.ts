/**
 * ART Tool Definition
 *
 * @module @persistence/tools/definitions/art
 *
 * PURPOSE: Generate images from text prompts or share existing gallery entries with the user.
 * ART is a dual-purpose creative tool that enables visual expression - either creating
 * new images via AI generation pipelines or sharing previously generated artwork from
 * the gallery.
 *
 * WHEN TO USE (op='make'):
 * - You want to create a visual representation of a concept or idea
 * - An image would enhance the conversation or explanation
 * - You're expressing creativity or exploring visual aesthetics
 * - You want to illustrate something that's hard to describe in words
 * - You're responding to the user's request for artwork
 * - You're experimenting with different artistic styles or subjects
 *
 * WHEN TO USE (op='share'):
 * - You want to bring the user's attention to a previously generated image
 * - You're referencing earlier artwork in current conversation
 * - You want to highlight a particular gallery entry
 * - You're curating or organizing visual content
 *
 * WHEN NOT TO USE:
 * - Text-heavy content (generators don't handle text well)
 * - Technical diagrams or charts (describe them instead)
 * - Photos of real specific people (privacy + accuracy concerns)
 * - Content that would violate provider content policies
 * - When you just want to describe something visually (use MESSAGE_USER)
 *
 * PARAMETERS:
 * - op (required, 'make' | 'share'): Which operation to perform
 * - content (required if op='make'): Text prompt for image generation
 * - message (required if op='share'): Message to send with shared image
 * - shareToUser (optional, default false): Send result directly to the user
 * - internal (optional): Private reasoning not shown to the user
 *
 * IMAGE GENERATION PROVIDERS:
 * You can control which provider generates your image with prompt prefixes:
 *
 * Default (no prefix): Cloudflare AI
 * - Free, fast, content-filtered
 * - Good for: General purpose, quick concepts
 * - Example: "A serene winter forest at dawn"
 *
 * REPLICATE: flux-schnell (~$0.01/image)
 * - Fast, creative, some content filtering
 * - Good for: Creative concepts, artistic styles
 * - Example: "REPLICATE: surreal dreamscape with floating islands"
 *
 * FLUX: flux-dev (~$0.025/image)
 * - Highest fidelity, slower generation
 * - Good for: High-quality detailed work
 * - Example: "FLUX: photorealistic portrait in natural lighting"
 *
 * SDXL: stability-ai/sdxl (~$0.01/image)
 * - Safety checker disabled, most permissive
 * - Good for: Content that gets filtered elsewhere
 * - Example: "SDXL: artistic figure study"
 *
 * PONY: Local Pony Studio (free)
 * - No content filtering, requires the user's laptop online
 * - Good for: When other providers are rate-limited
 * - Example: "PONY: anime character in fantasy forest"
 *
 * PROMPT CRAFTING TIPS:
 * - Be descriptive: "serene winter forest with soft morning light through trees"
 * - Include style: "photorealistic", "anime", "watercolor", "digital art"
 * - Add mood: "peaceful", "dramatic", "mysterious", "vibrant"
 * - Specify details: "cyan and magenta gradients", "golden hour lighting"
 * - Keep under 400 characters to avoid truncation
 *
 * STORAGE CHARACTERISTICS:
 * - Images compressed from ~2.5MB PNG to 75-120KB JPEG
 * - Stored as base64-encoded data URIs in history table
 * - Creates TWO history entries: art_request + art_result
 * - Visible in web UI gallery tab
 * - Eventually summarized with rest of history
 *
 * COST CONSIDERATIONS:
 * - Default provider (Cloudflare AI): Free
 * - Replicate providers: $0.01-0.025 per image
 * - Local PONY: Free (but requires the user's laptop)
 * - Each generation adds ~75-120KB to history (D1 storage)
 *
 * FALLBACK BEHAVIOR:
 * If content filtering blocks your prompt:
 * 1. Try REPLICATE: (some filtering)
 * 2. Try SDXL: (safety off)
 * 3. Try PONY: (no filtering, requires laptop)
 * System will attempt SDXL automatically on content filter errors.
 *
 * RELATED TOOLS:
 * - MESSAGE_USER: For describing visuals without generating
 * - THINK: For reasoning about what to create
 * - WONDER: For expressing curiosity about visual concepts
 * - NOTE: For organizing prompts or art concepts
 *
 * @category creative
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: Image generation APIs, logHistory() (2-3x), compression utilities, getMeterSnapshot()
 */
import type { ToolDefinition } from '../../types';
import type { ArtParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { ArtParams } from './params';

/**
 * ART tool definition with co-located handler.
 */
export const ART: ToolDefinition<ArtParams> = {
  id: 'ART',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: {
      make: 'art_request',
      share: 'message_to_user'
    },
    postProcessed: ['art_result']
  }
};
