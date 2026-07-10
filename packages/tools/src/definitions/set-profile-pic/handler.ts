/**
 * SET_PROFILE_PIC Handler
 *
 * @module @persistence/tools/definitions/set-profile-pic/handler
 * @description Manages the agent's profile picture/avatar.
 *
 * Operations:
 * - content="latest": Use most recent gallery image
 * - content="clear": Remove profile picture
 * - prompt=<text>: Generate new avatar from prompt
 * - image_id=<id>: Use specific gallery image by ID
 *
 * WHAT THIS HANDLER DOES:
 * - Validates parameters
 * - Returns metadata about what profile action is needed
 *
 * WHAT THE PLATFORM LAYER DOES (not this handler):
 * - Fetches gallery images
 * - Generates new images if prompt provided
 * - Updates Telegram bot profile picture
 * - Stores profile state
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: None (platform layer handles external APIs)
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { SetProfilePicParams } from "./params";
import { logHistory, HISTORY_TYPES, type DrizzleD1 } from "@persistence/db";

/**
 * Handle SET_PROFILE_PIC action.
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult with metadata for platform layer
 */
export const handler: ToolHandler<SetProfilePicParams> = async (
  params: SetProfilePicParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { content, prompt, image_id, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  try {
    // Determine operation type
    let operation: "latest" | "clear" | "generate" | "select";
    if (content === "latest") {
      operation = "latest";
    } else if (content === "clear") {
      operation = "clear";
    } else if (prompt) {
      operation = "generate";
    } else if (image_id) {
      operation = "select";
    } else {
      return {
        success: false,
        error: 'Must specify content ("latest"|"clear"), prompt, or image_id',
      };
    }

    // Log the profile update intent
    const logContent =
      operation === "clear"
        ? "Clearing profile picture"
        : operation === "latest"
          ? "Setting profile to latest gallery image"
          : operation === "generate"
            ? `Generating new profile: "${prompt}"`
            : `Setting profile to gallery image ${image_id}`;

    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.STATUS_UPDATE,
      content: logContent,
      internal: internal ?? `Profile operation: ${operation}`,
      cycleId,
    });

    // Return metadata for platform layer
    return {
      success: true,
      type: "profile_update",
      data: {
        operation,
        prompt: prompt ?? null,
        imageId: image_id ?? null,
        // Platform layer uses these to perform the actual updates
        needsGalleryLookup: operation === "latest" || operation === "select",
        needsImageGeneration: operation === "generate",
        needsTelegramUpdate: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Profile update failed: ${(error as Error).message}`,
    };
  }
};
