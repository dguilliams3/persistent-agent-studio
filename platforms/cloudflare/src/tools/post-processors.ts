/**
 * Post-Processor Registry
 *
 * @module tools/post-processors
 * @description Handles external API calls after package handlers return metadata.
 * Each processor handles one `needs*` flag from handler results.
 *
 * ARCHITECTURE:
 * Package handlers do DB work and return metadata flags like { needsTelegram: true }.
 * This module checks those flags and performs the appropriate external service calls.
 *
 * IMPORTANT: Package handlers already log the REQUEST to history (search_query, art_request).
 * Post-processors should only log RESULTS (search_result, art_result) to avoid duplicates.
 *
 * @upstream Called by: executeTool() in action-executor.js
 * @downstream Calls: Platform services (telegram.js, search.js, images.js, etc.)
 *
 * @see handler-registry.js for package handler wiring
 * @see docs/architecture/SERVICE_LAYER.md for architectural context
 */

import { logHistory } from '../utils/index.js';
import { bytesToBase64 } from '../utils/image.js';
import { getTelegramChatId } from '../utils/telegram.js';
import {
  getState,
  setState,
  addReminder,
  getHistory,
  addVoiceHistory,
} from '../db/index.js';
import {
  sendTelegram,
  sendTelegramVoice,
  sendTelegramPhoto,
  sendTelegramBase64Photo,
  callLLM,
  generateImage,
  textToSpeech,
  addFeedback,
  FEEDBACK_TYPES,
  scheduleQuickFollowup,
  summarizeHistory,
  metaSummarize,
  escapeHtml,
  chunkMessage,
  // Discord helper (checks discord_enabled flag)
  sendDiscordMessage
} from '../services/index.js';
import { runDigest, SearchGateway } from '@persistence/services';
import { DISCORD_WEBHOOK } from '../constants.js';
import type { Env } from '../bootstrap.js';

type PostProcessorContext = any;

type PostProcessorData = any;

type PostProcessor = (ctx: PostProcessorContext, data: PostProcessorData) => Promise<unknown>;
type PostProcessorResult = any;

// =============================================================================
// TIMEOUT UTILITIES
// =============================================================================

/** Timeout for digest execution (60 seconds) */
const DIGEST_TIMEOUT_MS = 60000;

/**
 * Wrap a promise with a timeout.
 *
 * @param {Promise<T>} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Error message on timeout
 * @returns {Promise<T>} The original promise result, or throws on timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
}

// [2026-02-03] SearchGateway from @persistence/services replaces doWebSearch

// =============================================================================
// POST-PROCESSOR IMPLEMENTATIONS
// =============================================================================

/**
 * Send message to Telegram.
 *
 * NOTE: Package handler already logged the message_to_user entry.
 * This just sends the notification.
 */
async function telegramPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, now = new Date() } = ctx;
  const telegramChatId = await getTelegramChatId(db);
  if (!telegramChatId) return;

  await sendTelegram(telegramChatId as string, `💬 ${data.content}`, env, { escape: true });
  await sendDiscordMessage(DISCORD_WEBHOOK, data.content ?? '', null, db);
  await setState(db, 'last_message_to_user', now.toISOString());
}

/**
 * Generate and send voice audio.
 *
 * Handles TTS generation, Telegram voice send, and voice_history logging.
 */
async function voicePostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env } = ctx;
  const telegramChatId = await getTelegramChatId(db);
  if (!telegramChatId) return;

  try {
    const ttsModel = (await getState(db, 'tts_model') as string) || 'v2';
    const ttsResult = await textToSpeech(data.content ?? '', env, { modelId: ttsModel });

    if (ttsResult.success) {
      await sendTelegramVoice(telegramChatId as string, ttsResult.audio!, env);

      // Save to voice history (persona-scoped)
      try {
        const audioBase64 = bytesToBase64(new Uint8Array(ttsResult.audio!));
        await addVoiceHistory(db, {
          text: data.content ?? '',
          model: ttsModel,
          stability: null,
          audioBase64,
          charCount: (data.content ?? '').length,
          createdAt: new Date().toISOString(),
        });
      } catch (historyErr) {
        console.error('[PostProcessor] Failed to save voice history:', historyErr);
      }
    } else {
      await addFeedback(db, FEEDBACK_TYPES.VOICE_FAILED, {
        error: ttsResult.error || 'Unknown TTS error'
      });
    }
  } catch (ttsErr: any) {
    console.error('[PostProcessor] TTS error:', (ttsErr as Error).message);
    await addFeedback(db, FEEDBACK_TYPES.VOICE_FAILED, {
      error: (ttsErr as Error).message || 'TTS exception'
    });
  }
}

/**
 * Perform web search and log results.
 *
 * NOTE: Package handler already logged search_query.
 * This logs search_result with metadata and sends to Telegram.
 */
async function searchPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId, apiKey } = ctx;
  const telegramChatId = await getTelegramChatId(db);

  // Notify search started (gives immediate feedback while search runs)
  if (telegramChatId) {
    await sendTelegram(
      telegramChatId,
      `🔍 <i>Searching: ${escapeHtml(String(data.query).substring(0, 100))}${String(data.query).length > 100 ? '...' : ''}</i>`,
      env
    );
  }

  // Use SearchGateway from @persistence/services (single entry point)
  const gateway = SearchGateway.fromCredentials(apiKey!);
  const gatewayResult = await gateway.search(data.query);

  if (gatewayResult.success && gatewayResult.summary) {
    // Log search result with metadata (package handler already logged search_query)
    await logHistory({
      db,
      type: 'search_result',
      content: gatewayResult.summary,
      internal: `Results for: ${data.query}`,
      cycleId,
      metadata: gatewayResult.metadata as unknown as Record<string, unknown>
    });

    // Send results to Telegram
    if (telegramChatId) {
      const truncated = gatewayResult.summary.length > 3500
        ? escapeHtml(gatewayResult.summary.substring(0, 3500)) + '\n\n<i>(...truncated)</i>'
        : escapeHtml(gatewayResult.summary);
      await sendTelegram(
        telegramChatId,
        `📰 <b>Search Results</b>\n<i>${escapeHtml(data.query)}</i>\n\n${truncated}`,
        env
      );
    }

    await scheduleQuickFollowup(db, 'search');
  } else if (gatewayResult.error) {
    await logHistory({
      db,
      type: 'search_result',
      content: `Search failed: ${gatewayResult.error}`,
      internal: data.query,
      cycleId,
      metadata: gatewayResult.metadata as unknown as Record<string, unknown>
    });
    await addFeedback(db, FEEDBACK_TYPES.SEARCH_FAILED, {
      error: gatewayResult.error,
      query: data.query
    });
    // Notify search failure
    if (telegramChatId) {
      await sendTelegram(
        telegramChatId,
        `❌ <b>Search Failed</b>\n<i>${escapeHtml(data.query.substring(0, 100))}</i>\n\n${escapeHtml(gatewayResult.error)}`,
        env
      );
    }
  }
}

/**
 * Generate image and log result.
 *
 * NOTE: Package handler already logged art_request.
 * This generates the image, logs art_result, and sends to Telegram.
 */
async function imageGenerationPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId } = ctx;
  const telegramChatId = await getTelegramChatId(db);

  try {
    const artResult = await generateImage(data.originalContent || data.prompt, env);

    if (artResult.success) {
      // Log art result (package handler already logged art_request)
      await logHistory({
        db,
        type: 'art_result',
        content: artResult.url || artResult.base64,
        internal: `Generated: ${data.prompt}`,
        cycleId
      });

      // Send to Telegram if shareToUser
      if (data.shareToUser && telegramChatId) {
        const provider = artResult.provider || 'cloudflare';
        const providerTag = provider === 'pony' ? '\n🐴 <i>via Pony Studio</i>' :
                          provider === 'replicate' ? '\n🔓 <i>via Replicate</i>' : '';
        const caption = `🎨 <b>New Art</b>\n\n<i>${escapeHtml(data.prompt)}</i>${providerTag}`;

        let sent = false;
        if (artResult.base64) {
          sent = await sendTelegramBase64Photo(telegramChatId, artResult.base64, caption, env);
        }
        if (!sent && artResult.url) {
          sent = await sendTelegramPhoto(telegramChatId, artResult.url, caption, env);
        }
        if (!sent) {
          await sendTelegram(
            telegramChatId,
            `⚠️ Generated art but failed to send image.\nPrompt: <i>${escapeHtml(data.prompt)}</i>`,
            env
          );
        }
      }

      await scheduleQuickFollowup(db, 'art_complete');
      return { imageData: artResult.base64, provider: artResult.provider };
    } else {
      const errorMsg = `Art generation failed: ${artResult.error}`;
      await logHistory({ db, type: 'art_result', content: errorMsg, internal: data.prompt, cycleId });

      if (telegramChatId) {
        const provider = artResult.provider || 'unknown';
        await sendTelegram(
          telegramChatId,
          `❌ <b>Art Failed</b> (${provider})\n<i>${escapeHtml(data.prompt)}</i>\n\n${escapeHtml(artResult.error || 'Unknown error')}`,
          env
        );
      }

      // No followup for failed art - wasting an API call to react to failure
    }
  } catch (artErr: any) {
    const artErrMsg = artErr instanceof Error ? artErr.message : String(artErr);
    const errorMsg = `Art generation error: ${artErrMsg}`;
    await logHistory({ db, type: 'art_result', content: errorMsg, internal: data.prompt, cycleId });

    if (telegramChatId) {
      await sendTelegram(
        telegramChatId,
        `❌ <b>Art Error</b>\n<i>${escapeHtml(data.prompt)}</i>\n\n${escapeHtml(artErrMsg)}`,
        env
      );
    }
  }
}

/**
 * Share existing gallery art.
 *
 * Finds art from history and sends to Telegram.
 */
async function gallerySharePostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId } = ctx;
  const telegramChatId = await getTelegramChatId(db);
  if (!telegramChatId) return;

  // Find recent art in history
  const recentHistory = await getHistory(db, 50);
  const isValidArt = (h: any) => h.type === 'art_result' && (
    h.content?.startsWith('data:') || h.content?.startsWith('https://')
  );
  const allArt = [...recentHistory].reverse().filter(isValidArt);

  if (allArt.length > 0) {
    const artToShare = allArt[0]; // Most recent
    const caption = `🎨 ${escapeHtml(data.message)}\n\n<i>${escapeHtml(artToShare.internal || 'untitled')}</i>`;

    try {
      if (artToShare.content.startsWith('https://')) {
        await sendTelegramPhoto(telegramChatId, artToShare.content, caption, env);
      } else {
        await sendTelegramBase64Photo(telegramChatId, artToShare.content, caption, env);
      }
    } catch (e: any) {
      const eMsg = e instanceof Error ? e.message : String(e);
      console.error('[PostProcessor] Gallery share failed:', eMsg);
      await sendTelegram(telegramChatId as string, `⚠️ Failed to share image: ${escapeHtml(eMsg)}`, env);
    }

    // Log the share (package handler already logged message_to_user with the message)
    await logHistory({
      db,
      type: 'art_shared',
      content: `${data.message} (1 image)`,
      internal: artToShare.internal,
      cycleId
    });
  } else {
    await logHistory({
      db,
      type: 'thought',
      content: 'Wanted to share art but none found in recent history',
      cycleId
    });
  }
}

/**
 * Send notification (Telegram + Discord).
 *
 * Used by SLEEP action to notify the user.
 * NOTE: Package handler already logged the sleep entry.
 */
async function notificationPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, now = new Date() } = ctx;

  if (data.message) {
    await sendDiscordMessage(DISCORD_WEBHOOK, `😴 ${data.message}`, null, db);

    const telegramChatId = await getTelegramChatId(db);
    if (telegramChatId) {
      await sendTelegram(telegramChatId, `😴 ${data.message}`, env, { escape: true });
    }

    await setState(db, 'last_message_to_user', now.toISOString());
  }
}

/**
 * Create wake reminder.
 *
 * Used by SLEEP action when wakeReminder is specified.
 */
async function reminderPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db } = ctx;

  if (data.wakeReminder) {
    await addReminder(db, data.wakeReminder, 'persistent');
  }
}

/**
 * Perform summarization.
 *
 * Handles both regular summarization and meta-summarization.
 */
async function summarizationPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId } = ctx;

  if (data.meta) {
    // Meta-summarization
    const metaResult = await metaSummarize(db, null, '', env);

    if (metaResult.success) {
      const indicesStr = metaResult.indices.length <= 5
        ? metaResult.indices.join(',')
        : `${metaResult.count} summaries`;
      await logHistory({
        db,
        type: 'summarize',
        content: `Consolidated summaries [${indicesStr}] into one`,
        internal: 'Summary layer compressed',
        cycleId
      });
      await setState(db, 'last_meta_summarize_time', new Date().toISOString());
      await setState(db, 'last_meta_summarize_count', String(metaResult.count));
      await setState(db, 'last_meta_run', JSON.stringify({
        trigger: 'loop',
        timestamp: new Date().toISOString(),
        summariesBefore: metaResult.summariesBefore,
        summariesConsolidated: metaResult.summariesConsolidated,
        summariesRemaining: metaResult.summariesRemaining,
        totalMessagesConsolidated: metaResult.totalMessagesConsolidated,
        provider: metaResult.provider,
        model: metaResult.model,
        durationMs: metaResult.durationMs,
        mode: metaResult.mode
      }));
    } else {
      await logHistory({
        db,
        type: 'summarize',
        content: `Metasummarize failed: ${metaResult.error}`,
        cycleId
      });
    }
  } else {
    // Regular summarization
    const result = await summarizeHistory(db, data.start, data.count, '', env);

    if (result.success) {
      const rangeInfo = result.start > 0
        ? `entries ${result.start}-${result.start + result.count - 1}`
        : `${result.count} oldest entries`;
      await logHistory({
        db,
        type: 'summarize',
        content: `Summarized ${rangeInfo}`,
        internal: 'Memory consolidated',
        cycleId
      });
      await setState(db, 'last_auto_summarize_time', new Date().toISOString());
      await setState(db, 'last_auto_summarize_count', String(result.count));
      await setState(db, 'last_summarize_run', JSON.stringify({
        trigger: 'loop',
        timestamp: new Date().toISOString(),
        entriesOffered: result.entriesOffered,
        entriesIncluded: result.entriesIncluded,
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
        timeRange: result.timeRange
      }));
    } else {
      await logHistory({
        db,
        type: 'summarize',
        content: `Summarization failed: ${result.error}`,
        cycleId
      });
    }
  }
}

/**
 * Look up gallery image and update profile.
 *
 * Used by SET_PROFILE_PIC when operation is 'latest' or 'select'.
 */
async function galleryLookupPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId } = ctx;

  if (data.operation === 'latest' || data.operation === 'select') {
    const recentHistory = await getHistory(db, 20);
    const latestArt = [...recentHistory].reverse().find(
      h => h.type === 'art_result' && h.content?.startsWith('data:')
    );

    if (latestArt) {
      await setState(db, 'profile_picture', latestArt.content);
      await setState(db, 'profile_picture_prompt', latestArt.internal || 'Self-portrait');
      await setState(db, 'profile_picture_updated', new Date().toISOString());

      // Send notification
      const telegramChatId = await getTelegramChatId(db);
      if (telegramChatId) {
        const caption = `🖼️ <b>New Profile Picture</b>\n\n<i>${escapeHtml(latestArt.internal || 'Self-portrait')}</i>`;
        await sendTelegramBase64Photo(telegramChatId, latestArt.content, caption, env).catch(e =>
          console.error('[PostProcessor] Telegram profile send failed:', e.message)
        );
      }
    } else {
      await logHistory({
        db,
        type: 'thought',
        content: 'Wanted to set profile picture from gallery, but no art found',
        cycleId
      });
    }
  } else if (data.operation === 'clear') {
    await setState(db, 'profile_picture', null);
    await setState(db, 'profile_picture_prompt', null);
    await setState(db, 'profile_picture_updated', null);
  }
}

/**
 * Generate new profile image and set it.
 *
 * Used by SET_PROFILE_PIC when operation is 'generate'.
 */
async function profileImageGenerationPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId } = ctx;

  if (data.operation !== 'generate' || !data.prompt) return;

  try {
    const artResult = await generateImage(data.prompt, env);

    if (artResult.success) {
      await setState(db, 'profile_picture', artResult.base64);
      await setState(db, 'profile_picture_prompt', data.prompt);
      await setState(db, 'profile_picture_updated', new Date().toISOString());

      // Send notification
      const telegramChatId = await getTelegramChatId(db);
      if (telegramChatId) {
        const caption = `🖼️ <b>New Profile Picture</b>\n\n<i>${escapeHtml(data.prompt)}</i>`;
        await sendTelegramBase64Photo(telegramChatId, artResult.base64, caption, env).catch(e =>
          console.error('[PostProcessor] Telegram profile send failed:', e.message)
        );
      }
    } else {
      await logHistory({
        db,
        type: 'thought',
        content: `Failed to generate profile picture: ${artResult.error}`,
        cycleId
      });
    }
  } catch (err: any) {
    console.error('[PostProcessor] Profile generation error:', err);
    await logHistory({
      db,
      type: 'thought',
      content: `Profile generation error: ${err instanceof Error ? err.message : String(err)}`,
      cycleId
    });
  }
}

/**
 * Run web digest and log results.
 *
 * Used by DIGEST action when op is 'trigger'.
 * Performs web searches on configured topics, summarizes via LLM, and logs to history.
 */
async function digestExecutionPostProcessor(ctx: PostProcessorContext, data: PostProcessorData) {
  const { db, env, cycleId, apiKey } = ctx;
  const telegramChatId = await getTelegramChatId(db);

  // Create SearchGateway from @persistence/services (single entry point)
  const searchGateway = SearchGateway.fromCredentials(apiKey!);

  try {
    // Run the digest using the services package (with timeout protection)
    const result = await withTimeout(
      runDigest(
        { topics: data.topics, synthesize: true },
        { searchGateway, callLLM, env }
      ),
      DIGEST_TIMEOUT_MS,
      `Digest timed out after ${DIGEST_TIMEOUT_MS / 1000}s`
    );

    // Log combined results to history
    if (result.successCount > 0) {
      const topicSummaries = result.topics
        .filter(t => t.success)
        .map(t => `### ${t.topic}\n${t.content}`)
        .join('\n\n');

      const content = result.synthesis
        ? `## Digest Summary\n${result.synthesis}\n\n---\n\n## Topic Details\n\n${topicSummaries}`
        : topicSummaries;

      await logHistory({
        db,
        type: 'web_digest',
        content,
        internal: `${result.successCount}/${data.topics.length} topics, ${result.durationMs}ms`,
        cycleId
      });

      // Update last run timestamp
      if (data.statePrefix) {
        await setState(db, `${data.statePrefix}_last_run`, new Date().toISOString());
      }

      // Notify via Telegram - send full results, no truncation
      if (telegramChatId) {
        await sendTelegram(telegramChatId, `📰 <b>Web Digest Complete</b>`, env);

        // Send each topic as its own message
        for (const topic of result.topics) {
          if (topic.success) {
            const topicMsg = `<b>${escapeHtml(topic.topic)}</b>\n${escapeHtml(topic.content)}`;
            const chunks = chunkMessage(topicMsg);
            for (const chunk of chunks) {
              await sendTelegram(telegramChatId, chunk, env);
            }
          }
        }

        // Send synthesis as its own message
        if (result.synthesis) {
          const synthesisMsg = `<b>📋 Synthesis</b>\n${escapeHtml(result.synthesis)}`;
          const chunks = chunkMessage(synthesisMsg);
          for (const chunk of chunks) {
            await sendTelegram(telegramChatId, chunk, env);
          }
        }

        await sendTelegram(
          telegramChatId,
          `<i>✅ ${result.successCount}/${data.topics.length} topics in ${result.durationMs}ms</i>`,
          env
        );
      }

      // No quick followup for digests — Clio can react on the next regular cycle.
      // Quick followups are reserved for search (report findings) and art (see result).
    } else {
      // All topics failed
      await logHistory({
        db,
        type: 'web_digest',
        content: `Digest failed: ${result.errorCount} topics failed`,
        internal: result.topics.map(t => t.error).filter(Boolean).join('; '),
        cycleId
      });

      if (telegramChatId) {
        await sendTelegram(
          telegramChatId,
          `❌ <b>Digest Failed</b>\n\nAll ${result.errorCount} topics failed to process.`,
          env
        );
      }
    }
  } catch (err: any) {
    console.error('[PostProcessor] Digest execution error:', err);
    await logHistory({
      db,
      type: 'web_digest',
      content: `Digest error: ${err instanceof Error ? err.message : String(err)}`,
      cycleId
    });

    if (telegramChatId) {
      await sendTelegram(
        telegramChatId as string,
        `❌ <b>Digest Error</b>\n\n${escapeHtml(err instanceof Error ? err.message : String(err))}`,
        env
      );
    }
  }
}

// =============================================================================
// POST-PROCESSOR REGISTRY
// =============================================================================

/**
 * Registry mapping metadata flags to post-processor functions.
 *
 * Order matters for some flags. When a handler returns multiple flags,
 * they execute in the order defined in ORDERED_FLAGS.
 */
export const POST_PROCESSORS: Record<string, PostProcessor> = {
  needsImageGeneration: imageGenerationPostProcessor,
  needsGalleryLookup: galleryLookupPostProcessor,
  needsTelegram: telegramPostProcessor,
  needsVoice: voicePostProcessor,
  needsSearchApi: searchPostProcessor,
  needsGalleryShare: gallerySharePostProcessor,
  needsNotification: notificationPostProcessor,
  needsReminder: reminderPostProcessor,
  needsSummarization: summarizationPostProcessor,
  needsDigestExecution: digestExecutionPostProcessor,
  // Profile-specific: needsImageGeneration is handled above, but for profile it's special
};

/**
 * Explicit execution order for flags.
 * Some operations must happen before others (e.g., generate image before sending to Telegram).
 */
const ORDERED_FLAGS: string[] = [
  'needsGalleryLookup',      // Look up existing art first
  'needsImageGeneration',    // Generate new image
  'needsTelegram',           // Send message
  'needsVoice',              // Generate and send voice
  'needsSearchApi',          // Perform search
  'needsGalleryShare',       // Share gallery art
  'needsSummarization',      // Compress history
  'needsDigestExecution',    // Run web digest
  'needsNotification',       // Send notifications
  'needsReminder',           // Create reminders
];

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Run post-processors based on metadata flags in handler result.
 *
 * Iterates through ORDERED_FLAGS and calls the corresponding post-processor
 * for each flag that is true in result.data.
 *
 * Errors in individual post-processors are logged but don't fail the whole action.
 *
 * @param {Object} ctx - Execution context
 * @param {D1Database} ctx.db - Database binding
 * @param {Object} ctx.env - Environment bindings
 * @param {number} ctx.cycleId - Current cycle ID
 * @param {string} [ctx.apiKey] - API key for services that need it
 * @param {Date} [ctx.now] - Current timestamp
 *
 * @param {Object} result - Handler result from package handler
 * @param {boolean} result.success - Whether handler succeeded
 * @param {Object} [result.data] - Metadata with needs* flags
 *
 * @returns {Promise<Object>} The original result, possibly with processed additions
 *
 * @upstream Called by: executeTool() in action-executor.js
 * @downstream Calls: Individual post-processor functions
 */
export async function runPostProcessors(ctx: PostProcessorContext, result: PostProcessorResult): Promise<PostProcessorResult> {
  // Only process successful results with data
  if (!result?.success || !result?.data) {
    return result;
  }

  const data = result.data;

  // Execute post-processors in order
  for (const flag of ORDERED_FLAGS) {
    if (data[flag]) {
      const processor = POST_PROCESSORS[flag];
      if (processor) {
        try {
          const processed = await processor(ctx, data);
          // Merge any returned data back into result.data
          if (processed && typeof processed === 'object') {
            Object.assign(data, processed);
          }
        } catch (e: any) {
          console.error(`[PostProcessor] ${flag} failed:`, e instanceof Error ? e.message : e);
          // Non-fatal - don't break the whole action
        }
      } else {
        console.warn(`[PostProcessor] No processor for flag: ${flag}`);
      }
    }
  }

  return result;
}

/**
 * Check if a result has any post-processing flags.
 *
 * @param {Object} result - Handler result
 * @returns {boolean} True if any needs* flags are set
 */
export function hasPostProcessingFlags(result: PostProcessorResult): boolean {
  if (!result?.data) return false;
  return Object.keys(result.data).some(k => k.startsWith('needs') && result.data![k]);
}
