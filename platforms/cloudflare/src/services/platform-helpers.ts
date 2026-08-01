/**
 * @fileoverview Discord helper for Cloudflare worker
 *
 * Provides discord_enabled flag checking wrapper for DiscordWebhookProvider.
 *
 * NOTE: Web search has been migrated to SearchGateway from @persistence/services.
 * All consumers should import SearchGateway directly.
 *
 * TODO: Consider migrating Discord to a DiscordGateway in @persistence/services
 * with flag checking, then delete this file entirely.
 *
 * @module platform-helpers
 * @upstream post-processors.js (telegramPostProcessor, notificationPostProcessor)
 * @downstream @persistence/services (DiscordWebhookProvider)
 */

// Discord adapter not included in this distribution — inert stub preserves
// the send helpers' signatures for anyone wiring a real webhook provider.
const DiscordWebhookProvider = {
  fromCredentials: (_url: string) => ({
    sendText: async (_a: any, _b?: any) => ({ success: true }),
    sendTextWithImage: async (_a: any, _b?: any) => ({ success: true }),
  }),
};
import { getState } from '../db/index.js';

/**
 * Send a message to Discord via webhook
 *
 * Wraps DiscordWebhookProvider with platform-specific behavior:
 * - Checks discord_enabled flag in database (if db provided)
 * - Handles both text-only and text-with-image messages
 * - Catches and logs errors, returning boolean success
 *
 * @param {string} webhookUrl - Discord webhook URL
 * @param {string} message - Message content to send
 * @param {string|null} [imageUrl=null] - Optional image URL to attach
 * @param {D1Database|null} [db=null] - Optional database to check discord_enabled flag
 * @returns {Promise<boolean>} True if sent successfully or skipped due to disabled
 *
 * @example
 * // Basic text message
 * await sendDiscordMessage(env.DISCORD_WEBHOOK, 'Hello from Clio!');
 *
 * // With image
 * await sendDiscordMessage(env.DISCORD_WEBHOOK, 'Check this out', 'https://...', db);
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  message: string,
  imageUrl: string | null = null,
  db: D1Database | null = null
) {
  try {
    if (db) {
      const discordEnabled = await getState(db, 'discord_enabled');
      if (discordEnabled === 'false') {
        console.log('Discord notifications disabled, skipping');
        return true;
      }
    }
    const provider = DiscordWebhookProvider.fromCredentials(webhookUrl);
    const result = imageUrl
      ? await provider.sendTextWithImage(message, imageUrl)
      : await provider.sendText('_', message);
    return result.success;
  } catch (e) {
    console.error('Discord error:', e);
    return false;
  }
}
