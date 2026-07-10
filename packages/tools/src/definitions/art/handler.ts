/**
 * ART Handler
 *
 * @module @persistence/tools/definitions/art/handler
 * @description Executes the ART action - generates images or shares gallery entries.
 *
 * EXECUTION FLOW:
 *
 * When op='make' (generate new image):
 * 1. Receives validated parameters (content prompt + optional provider prefix)
 * 2. Parses provider prefix from content (REPLICATE:, FLUX:, SDXL:, PONY:, or default)
 * 3. Calls appropriate image generation API:
 *    - Default: Cloudflare AI (free, fast, content filtered)
 *    - REPLICATE: flux-schnell (~$0.01, fast, creative)
 *    - FLUX: flux-dev (~$0.025, highest fidelity, slower)
 *    - SDXL: stability-ai/sdxl (~$0.01, safety off, most permissive)
 *    - PONY: Local Pony Studio (free, requires the user's laptop online)
 * 4. Compresses returned image from ~2.5MB PNG to ~75-120KB JPEG (D1 row limit)
 * 5. Logs art_request to history with the prompt
 * 6. Logs art_result to history with compressed base64 image
 * 7. If shareToUser=true, also sends message_to_user
 * 8. Returns success with image data
 *
 * When op='share' (share existing art):
 * 1. Receives validated parameters (message + optional gallery reference)
 * 2. Retrieves existing gallery entry from history (most recent art_result)
 * 3. Logs message_to_user with the message and image reference
 * 4. Triggers Telegram/Discord notification if configured
 * 5. Returns success with shared entry
 *
 * DATABASE TOUCHES:
 * - INSERT into `history` table with type='art_request' (when op='make')
 * - INSERT into `history` table with type='art_result' (when op='make')
 * - INSERT into `history` table with type='message_to_user' (when op='share' or shareToUser=true)
 * - All entries automatically capture meter snapshots
 *
 * SIDE EFFECTS:
 * - External API call to image generation provider (costs money, rate limited)
 * - Image compression (CPU intensive, ~100ms)
 * - History entries with large base64 data (75-120KB per image)
 * - Telegram/Discord notifications (when shareToUser=true)
 * - Gallery entry visible in web UI
 *
 * IMAGE PROVIDERS:
 * - Cloudflare AI: Free, fast, content-filtered (blocks NSFW)
 * - Replicate flux-schnell: $0.01/image, fast, creative, some filtering
 * - Replicate flux-dev: $0.025/image, highest quality, slower
 * - Replicate SDXL: $0.01/image, safety off, most permissive
 * - Local Pony Studio: Free, no filtering, requires the user's laptop running
 *
 * COMPRESSION:
 * All images are compressed before storage to fit D1's ~900KB row limit:
 * - Input: ~2.5MB PNG from generator
 * - Output: 75-120KB JPEG at quality 0.7
 * - Format: base64-encoded data URI
 *
 * ERROR HANDLING:
 * - API timeouts: Return error message, no history entries
 * - Content filtering: Try fallback provider (REPLICATE → SDXL)
 * - Rate limits: Return error with wait time
 * - Compression failures: Return error, don't store
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls:
 *   - Image generation APIs (Cloudflare AI, Replicate, local PONY)
 *   - logHistory() from worker/src/utils/history-logger.js (2-3x)
 *   - Image compression utilities
 *   - Telegram/Discord notification APIs
 *   - getMeterSnapshot() (called internally by logHistory)
 *
 * @example
 * // Generate new art with default provider
 * await handler({
 *   op: "make",
 *   content: "A serene winter forest at dawn with soft sunlight",
 *   shareToUser: true
 * }, ctx);
 *
 * @example
 * // Generate with specific provider
 * await handler({
 *   op: "make",
 *   content: "FLUX: photorealistic portrait of a scientist in laboratory"
 * }, ctx);
 *
 * @example
 * // Share existing gallery entry
 * await handler({
 *   op: "share",
 *   message: "I wanted to share this piece from earlier - it captures the mood"
 * }, ctx);
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { ArtParams } from "./params";
import { logHistory, HISTORY_TYPES, type DrizzleD1 } from "@persistence/db";

/** Provider prefixes for image generation */
const PROVIDER_PREFIXES = ["REPLICATE:", "FLUX:", "SDXL:", "PONY:"] as const;

/**
 * Parse provider prefix from content, returning provider and clean prompt
 */
function parseProvider(content: string): { provider: string; prompt: string } {
  for (const prefix of PROVIDER_PREFIXES) {
    if (content.toUpperCase().startsWith(prefix)) {
      return {
        provider: prefix.replace(":", "").toLowerCase(),
        prompt: content.slice(prefix.length).trim(),
      };
    }
  }
  return { provider: "cloudflare", prompt: content };
}

/**
 * Handle ART action.
 *
 * Logs art requests to history and returns metadata for the platform layer
 * to perform image generation or share existing gallery entries.
 *
 * WHAT THIS HANDLER DOES:
 * - Validates params (content for make, message for share)
 * - Parses provider prefix from content
 * - Logs art_request to history (for make op)
 * - Returns metadata about what external action is needed
 *
 * WHAT THE PLATFORM LAYER DOES (not this handler):
 * - Calls image generation APIs (Cloudflare AI, Replicate, FLUX, SDXL, PONY)
 * - Compresses images for D1 storage
 * - Logs art_result to history
 * - Sends Telegram notification if shareToUser=true
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult with metadata for platform layer
 *
 * @example
 * await handler({ op: "make", content: "A serene forest" }, ctx);
 */
export const handler: ToolHandler<ArtParams> = async (
  params: ArtParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { op, content, message, shareToUser, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  try {
    if (op === "make") {
      if (!content) {
        return {
          success: false,
          error: "content (prompt) is required for make operation",
        };
      }

      // Parse provider from content
      const { provider, prompt } = parseProvider(content);

      // Log art request to history
      await logHistory({
        db: typedDb,
        type: HISTORY_TYPES.ART_REQUEST,
        content: content,
        internal: internal ?? `Provider: ${provider}`,
        cycleId,
      });

      // Return metadata for platform layer to perform generation
      return {
        success: true,
        type: "art_request",
        data: {
          op: "make",
          prompt,
          provider,
          originalContent: content,
          shareToUser: shareToUser === true,
          // Platform layer uses this to perform image generation
          needsImageGeneration: true,
        },
      };
    } else if (op === "share") {
      if (!message) {
        return {
          success: false,
          error: "message is required for share operation",
        };
      }

      // Log share intent - platform layer will find gallery entry and send
      await logHistory({
        db: typedDb,
        type: HISTORY_TYPES.MESSAGE_TO_USER,
        content: message,
        internal: internal ?? "Sharing gallery art",
        cycleId,
      });

      // Return metadata for platform layer to handle sharing
      return {
        success: true,
        type: "art_shared",
        data: {
          op: "share",
          message,
          // Platform layer uses this to find recent gallery entry and send
          needsGalleryShare: true,
        },
      };
    }

    return { success: false, error: `Unknown operation: ${op}` };
  } catch (error) {
    return {
      success: false,
      error: `Art operation failed: ${(error as Error).message}`,
    };
  }
};
