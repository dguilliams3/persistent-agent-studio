/**
 * ART Parameter Types
 *
 * @module @persistence/tools/definitions/art/params
 *
 * Defines the parameters for image generation and sharing. ART is a dual-purpose
 * tool that can either MAKE new images from text prompts or SHARE existing gallery
 * entries with the user.
 *
 * PARAMETER DETAILS:
 *
 * op (required, string: 'make' | 'share'):
 *   The operation to perform - either generate new art or share existing art.
 *
 *   'make': Generate a new image from a text prompt
 *   - Requires: content (the prompt)
 *   - Creates: art_request and art_result history entries
 *   - Uses: Cloudflare AI (default), Replicate (with prefix), or FLUX/SDXL models
 *
 *   'share': Share an existing gallery image with the user
 *   - Requires: message (the sharing message)
 *   - Creates: message_to_user history entry
 *   - Uses: Gallery image selection from previous art generations
 *
 * content (conditionally required, string):
 *   REQUIRED when op='make'. The text prompt describing the image to generate.
 *
 *   Good prompts (descriptive, specific):
 *   - "A serene winter forest at dawn with soft sunlight through trees"
 *   - "Abstract digital art with flowing cyan and magenta gradients"
 *   - "REPLICATE: photorealistic portrait of a scientist in a laboratory"
 *   - "FLUX: fantasy landscape with floating islands and waterfalls"
 *
 *   Provider prefixes (optional):
 *   - No prefix: Cloudflare AI (free, fast, content filtered)
 *   - "REPLICATE:": flux-schnell (~$0.01, fast, creative)
 *   - "FLUX:": flux-dev (~$0.025, highest fidelity)
 *   - "SDXL:": stability-ai/sdxl (~$0.01, safety off, most permissive)
 *   - "PONY:": Local Pony Studio (free, requires the user's laptop online)
 *
 *   Best for:
 *   - Visual concepts that complement conversation
 *   - Artistic expressions of emotions or ideas
 *   - Illustrations for explanations or stories
 *   - Creative exploration and experimentation
 *
 *   NOT for:
 *   - Text-heavy images (generators don't do text well)
 *   - Technical diagrams (use description instead)
 *   - Photos of real people (privacy/accuracy concerns)
 *
 * message (conditionally required, string):
 *   REQUIRED when op='share'. The message to send along with the shared gallery image.
 *
 *   Examples:
 *   - "I wanted to share this piece from earlier"
 *   - "This one captures the mood we were discussing"
 *   - "Check out today's gallery entry"
 *
 * shareToUser (optional, boolean, default: false):
 *   Whether to immediately send the result to the user. When true, triggers notification.
 *   When false, result is stored but the user must check gallery/history to see it.
 *
 * internal (optional, string):
 *   Private reasoning about why you're making or sharing this art. Visible to you
 *   but not included in history entries or shown to the user.
 *
 *   Example: "This visual might help explain the concept we discussed"
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the ART tool.
 * Image generation + sharing.
 */
export interface ArtParams extends BaseToolParams {
  /** Operation: "make" or "share" (required) */
  op: 'make' | 'share';
  /** Image prompt (required when op is "make") */
  content?: string;
  /** Share message (required when op is "share") */
  message?: string;
  /** Show to the user (default: false) */
  shareToUser?: boolean;
}
