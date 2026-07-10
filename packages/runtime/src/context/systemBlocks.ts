/**
 * System Block Assembly for Anthropic API
 *
 * @module @persistence/runtime/context/systemBlocks
 * @description Assembles content blocks into the Anthropic Messages API format
 * with cache_control directives. This is the API-layer adapter that wraps the
 * content blocks (built by @persistence/memory/context) into the wire format.
 *
 * Uses 4 blocks with smart TTL selection based on cycle interval:
 * - Block 1 (constitution + extensions + profile pic): Stable, always cached
 * - Block 2 (promoted summaries): Stable, conditionally cached
 * - Block 3 (stable context): Volatile, cached based on interval
 * - Block 4 (fresh tail): Never cached
 *
 * @upstream Called by: runThinkingCycle() (platforms/cloudflare)
 * @downstream Calls: selectCacheTtl() from cacheTtl.ts
 */

import { selectCacheTtl } from './cacheTtl.js';

/**
 * Cache strategy configuration passed from the cycle runner.
 */
export interface CacheStrategy {
  cycleInterval: number;
  useVolatileCaching: boolean;
  historyPrefixSize: number;
  prefixBoundaryId?: number | null;
  actualTailTokens?: number;
  historyTailTokenThreshold: number;
  historyTailTokenTarget?: number;
  actualTailSize: number;
  historyTailSize?: number;
  ttl: string;
}

/** Profile picture metadata for Block 1 injection */
export interface ProfilePictureRef {
  image?: string;
  prompt?: string | null;
}

/** A single system block in the Anthropic Messages API format */
export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral'; ttl: string | null };
}

/**
 * @description Builds the system blocks array for the Anthropic Messages API
 * with cache-optimized TTL selection.
 *
 * @param block1 - Constitution (static intro, actions, MY_CONTEXT)
 * @param block1Extensions - Cold storage + MY SPACE (rarely changes, appended to Block 1)
 * @param block2 - Promoted summaries (stable context)
 * @param block3 - Stable context + summaries prefix (volatile)
 * @param block4 - Fresh tail (recent history, user status, time, reminders)
 * @param cacheStrategy - Cache strategy configuration
 * @param profilePicture - Optional profile picture reference
 * @returns Array of system blocks for the Anthropic Messages API
 */
export function buildSystemBlocks(
  block1: string,
  block1Extensions: string,
  block2: string,
  block3: string,
  block4: string,
  cacheStrategy: CacheStrategy,
  profilePicture: ProfilePictureRef | null = null
): SystemBlock[] {
  const blocks: SystemBlock[] = [];
  const interval = cacheStrategy.cycleInterval;

  // Select TTLs based on interval
  const stableTtl = selectCacheTtl(interval, true);
  const volatileTtl = selectCacheTtl(interval, false);

  // Block 1: Constitution + Extensions + Profile Pic - ALWAYS CACHED
  let block1Full = block1Extensions ? `${block1}${block1Extensions}` : block1;
  if (profilePicture?.image) {
    block1Full += `\n\n--- MY PROFILE PICTURE ---\n[I have a profile picture (shown in user message). Prompt: "${profilePicture.prompt || 'No description'}"]`;
  }
  if (block1Full) {
    blocks.push({
      type: 'text',
      text: block1Full,
      cache_control: { type: 'ephemeral', ttl: stableTtl }
    });
  }

  // Block 2: Promoted summaries - Conditionally cached
  if (block2 && block2.trim() !== '--- PROMOTED SUMMARIES ---' && block2.trim() !== '') {
    blocks.push({
      type: 'text',
      text: block2,
      cache_control: { type: 'ephemeral', ttl: stableTtl }
    });
  }

  // Block 3: Stable context + Summaries prefix - Conditionally cached
  if (block3 && block3.trim() !== '--- STABLE CONTEXT ---') {
    if (volatileTtl && cacheStrategy.useVolatileCaching) {
      blocks.push({
        type: 'text',
        text: block3,
        cache_control: { type: 'ephemeral', ttl: volatileTtl }
      });
    } else {
      blocks.push({
        type: 'text',
        text: block3
      });
    }
  }

  // Block 4: Fresh tail - NEVER cached
  if (block4) {
    blocks.push({
      type: 'text',
      text: block4
    });
  }

  console.log(`[Cache Strategy] Interval: ${interval}s, Stable TTL: ${stableTtl}, Volatile TTL: ${volatileTtl || 'none'}, Volatile caching: ${cacheStrategy.useVolatileCaching}, Prefix: ${cacheStrategy.historyPrefixSize} entries (boundary ID: ${cacheStrategy.prefixBoundaryId || 'none'}), Tail: ${cacheStrategy.actualTailTokens}/${cacheStrategy.historyTailTokenThreshold} tokens (${cacheStrategy.actualTailSize} entries), Profile pic: ${!!profilePicture?.image}`);

  return blocks;
}
