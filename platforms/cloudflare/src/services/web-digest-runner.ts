/**
 * @description Runs scheduled web agent digests during the cron cycle
 *
 * Each preset (geopolitical, tech, daily) is checked independently for whether
 * it's due to run. Results are logged to history and sent to Telegram.
 *
 * @upstream Called by: Worker scheduled() handler
 * @downstream Calls: @persistence/services/web-agent, sendTelegram, logHistory
 */

import type { Env } from '../bootstrap.js';
import { getState, setState } from '../db/index.js';
import { createDrizzleClient } from '@persistence/db';
import { sendTelegram, escapeHtml, callLLM, SearchGateway } from './index.js';
import { logHistory } from '../utils/index.js';
import { getTelegramChatId } from '../utils/telegram.js';

/**
 * @description Check and run all web agent digest presets
 *
 * Saves last_run IMMEDIATELY before running the digest to prevent re-entry.
 * The digest takes 30-60s+ (multiple Sonnet API calls with web search).
 * Without early save, the next cron tick would launch a parallel run.
 */
export async function runWebDigests(env: Env): Promise<void> {
  const db = createDrizzleClient(env.DB);

  const {
    isWebAgentDue,
    loadTopicsFromState,
    runDigest,
    getWebAgentStateKeys,
    WEB_AGENT_PRESETS
  } = await import('@persistence/services/web-agent');

  for (const [presetName, presetConfig] of Object.entries(WEB_AGENT_PRESETS)) {
    const due = await isWebAgentDue(
      presetConfig.statePrefix,
      presetConfig.intervalHours,
      { db, getState },
      (presetConfig as any).targetHourUTC
    );

    if (!due) continue;

    // CRITICAL: Save last_run IMMEDIATELY to prevent re-entry.
    // Without this, overlapping digest runs were causing ~$10/day in charges.
    const stateKeys = getWebAgentStateKeys(presetConfig.statePrefix);
    await setState(db, stateKeys.lastRun, new Date().toISOString());

    console.log(`[Cron] Running ${presetName} web digest`);
    const topics = await loadTopicsFromState(presetConfig.statePrefix, { db, getState });

    if (topics.length === 0) continue;

    const searchGateway = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);

    const result = await runDigest(
      {
        topics,
        synthesize: topics.length > 1,
        synthesisProvider: presetConfig.provider,
        synthesisModel: presetConfig.model
      },
      { searchGateway, callLLM, env }
    );

    // Log each topic result to history
    for (const topicResult of result.topics) {
      if (topicResult.success) {
        await logHistory({
          db,
          type: 'web_digest',
          content: `**${topicResult.topic}**\n\n${topicResult.content}`,
          internal: `[Cron:${presetName}] Query: ${topicResult.searchQuery}`
        });
      }
    }

    // Log synthesis if generated
    if (result.synthesis) {
      await logHistory({
        db: db,
        type: 'web_digest',
        content: `**${presetName} Digest Synthesis**\n\n${result.synthesis}`,
        internal: `[Cron] Provider: ${result.synthesisMetadata?.provider} | Cost: $${result.synthesisMetadata?.cost?.toFixed(4) ?? 0}`
      });
    }

    // Send digest results to Telegram
    const telegramChatId = await getTelegramChatId(db);
    if (telegramChatId && env.TELEGRAM_BOT_TOKEN) {
      try {
        let message = `\u{1F4F0} <b>${presetName.charAt(0).toUpperCase() + presetName.slice(1)} Digest</b>\n\n`;

        for (const topicResult of result.topics) {
          if (topicResult.success) {
            const truncatedContent = topicResult.content.length > 500
              ? topicResult.content.substring(0, 500) + '...'
              : topicResult.content;
            message += `<b>${escapeHtml(topicResult.topic)}</b>\n${escapeHtml(truncatedContent)}\n\n`;
          }
        }

        if (result.synthesis) {
          const truncatedSynthesis = result.synthesis.length > 800
            ? result.synthesis.substring(0, 800) + '...'
            : result.synthesis;
          message += `<b>Synthesis</b>\n<i>${escapeHtml(truncatedSynthesis)}</i>\n\n`;
        }

        message += `<i>\u2705 ${result.successCount}/${topics.length} topics in ${result.durationMs}ms</i>`;

        if (message.length > 4000) {
          message = message.substring(0, 3900) + '\n\n<i>(...truncated)</i>';
        }

        await sendTelegram(telegramChatId, message, env);
      } catch (telegramErr: unknown) {
        console.error(`[Cron] Failed to send ${presetName} digest to Telegram:`, telegramErr instanceof Error ? telegramErr.message : String(telegramErr));
      }
    }

    console.log(`[Cron] ${presetName} digest complete: ${result.successCount}/${topics.length} topics in ${result.durationMs}ms`);
  }
}
