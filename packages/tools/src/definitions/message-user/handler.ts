/**
 * MESSAGE_USER Handler
 *
 * @module @persistence/tools/definitions/message-user/handler
 * @description Executes the MESSAGE_USER action - sends messages from agent to the user.
 *
 * EXECUTION FLOW:
 * 1. Log the message to the history table with type 'message_to_user'
 * 2. If shareToUser is true (default), push message to the user's Telegram
 * 3. If voice is true, generate TTS audio using ElevenLabs API
 * 4. Broadcast message to connected WebSocket clients (web UI)
 * 5. Return success result with message content
 *
 * DATABASE TABLES TOUCHED:
 * - history: INSERT new row with type='message_to_user', content=params.content
 * - voice_history: INSERT if voice:true (stores TTS audio and metadata)
 * - state: May UPDATE last_message_time or similar tracking keys
 *
 * SIDE EFFECTS:
 * - Telegram notification sent to the user's phone (if shareToUser:true)
 * - Web UI updates in real-time via WebSocket broadcast
 * - TTS audio generated and stored (if voice:true)
 * - History entry logged with meter snapshot
 * - Message appears in the user's Dashboard tab
 *
 * ERROR HANDLING:
 * - If Telegram API fails, message is still logged to history
 * - If TTS fails, message is delivered without audio
 * - If content is missing, validation fails before handler is called
 *
 * @upstream Called by: @persistence/tools/executor during action execution
 * @downstream Calls:
 *   - logHistory() from worker/src/utils/history-logger.js
 *   - Telegram Bot API (POST to api.telegram.org)
 *   - ElevenLabs TTS API (when voice: true)
 *   - WebSocket broadcast function
 *
 * @example
 * // Send a simple text message
 * await handler({ content: "Hello!", shareToUser: true, voice: false }, ctx);
 *
 * @example
 * // Send a message with voice and internal reasoning
 * await handler({
 *   content: "I found something interesting!",
 *   voice: true,
 *   shareToUser: true,
 *   internal: "Following up on yesterday's debugging session"
 * }, ctx);
 *
 * @example
 * // Preview a message without actually sending
 * await handler({
 *   content: "Testing message format",
 *   shareToUser: false,
 *   internal: "Previewing before actual send"
 * }, ctx);
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { MessageUserParams } from "./params";
import { logHistory, HISTORY_TYPES, type DrizzleD1 } from "@persistence/db";

/**
 * Handle MESSAGE_USER action.
 *
 * This is the core handler that executes when the agent uses MESSAGE_USER.
 * It logs the message to history and returns metadata for the platform layer
 * to handle external delivery (Telegram, TTS, WebSocket).
 *
 * WHAT THIS HANDLER DOES:
 * - Validates message content
 * - Logs message to history with type='message_to_user'
 * - Returns metadata about what external actions are needed
 *
 * WHAT THE PLATFORM LAYER DOES (not this handler):
 * - Sends Telegram notification if shareToUser=true
 * - Generates TTS audio if voice=true
 * - Broadcasts to WebSocket clients
 * - Logs the TTS result to voice_history
 *
 * @param params - The validated MESSAGE_USER parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult with metadata for platform layer to handle delivery
 */
export const handler: ToolHandler<MessageUserParams> = async (
  params: MessageUserParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { content, voice, shareToUser, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  if (!content) {
    return { success: false, error: "content is required for MESSAGE_USER" };
  }

  try {
    // Log message to history (always, even if shareToUser=false)
    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.MESSAGE_TO_USER,
      content,
      internal: internal ?? null,
      cycleId,
    });

    // Return success with metadata for platform layer
    // Platform layer uses this to perform external API calls
    return {
      success: true,
      type: "message_to_user",
      data: {
        content,
        // Platform layer checks these flags to decide what external actions to take
        needsTelegram: shareToUser !== false,
        needsVoice: voice === true,
        needsWebSocketBroadcast: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process message: ${(error as Error).message}`,
    };
  }
};
