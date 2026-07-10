/**
 * Data retrieval handler functions (read-only endpoints)
 *
 * @module @persistence/db/handlers/data/reads
 * @description Pure handler functions for GET endpoints retrieving stored data.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db functions, Drizzle query builder, @persistence/core/providers
 */

import { eq, and, or, desc, isNull, gt, sql, like } from 'drizzle-orm';
import type { DrizzleD1 } from '../../client';
import { getActivePersonaId } from '../../persona-scope';
import { scopedSelect } from '../../scoped-query';
import { history } from '../../schema/history';
import { coldStorage } from '../../schema/cold-storage';
import { cycles } from '../../schema/cycles';

import {
  getState,
  getColdStorage,
  getNotebook,
  getObservations,
  getReminders,
} from '../../index';

import { getVoiceTranscriptions } from '../../voice/transcriptions';

import { PROVIDERS } from '@persistence/core/providers';

/**
 * GET /state - Returns current loop state and configuration
 */
export async function handleGetState(db: DrizzleD1) {
  const activePersonaId = await getActivePersonaId(db);

  const [loopCount, lastWakeTime, lastMessageToUser, isRunning, cycleInterval, currentStatus, currentStatusEmoji, currentStatusMood, currentStatusUpdated, summarizeThreshold, autoSummarize, selectedModel, activeHistoryResult, totalHistoryResult] = await Promise.all([
    getState(db, 'loop_count'),
    getState(db, 'last_wake_time'),
    getState(db, 'last_message_to_user'),
    getState(db, 'is_running'),
    getState(db, 'cycle_interval_seconds'),
    getState(db, 'current_status'),
    getState(db, 'current_status_emoji'),
    getState(db, 'current_status_mood'),
    getState(db, 'current_status_updated'),
    getState(db, 'summarize_threshold'),
    getState(db, 'auto_summarize'),
    getState(db, 'selected_model'),
    db.select({ count: sql<number>`count(*)` })
      .from(history)
      .where(and(isNull(history.summarizedAt), eq(history.personaId, activePersonaId)))
      .get(),
    db.select({ count: sql<number>`count(*)` })
      .from(history)
      .where(eq(history.personaId, activePersonaId))
      .get(),
  ]);

  return {
    loopCount: parseInt(loopCount || '0'),
    lastWakeTime,
    lastMessageToUser: lastMessageToUser,
    isRunning: isRunning === 'true',
    cycleIntervalSeconds: parseInt(cycleInterval || '300'),
    currentStatus: currentStatus || null,
    currentStatusEmoji: currentStatusEmoji || null,
    currentStatusMood: currentStatusMood || null,
    currentStatusUpdated: currentStatusUpdated || null,
    summarizeThreshold: parseInt(summarizeThreshold || '30'),
    autoSummarize: autoSummarize === 'true',
    selectedModel: selectedModel || PROVIDERS.anthropic.models.sonnet.id,
    activeHistoryCount: activeHistoryResult?.count || 0,
    totalHistoryCount: totalHistoryResult?.count || 0
  };
}

/**
 * GET /history - Returns paginated conversation history for active persona
 */
export async function handleGetHistory(db: DrizzleD1, searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const includeArchived = searchParams.get('includeArchived') !== 'false';

  const personaId = await getActivePersonaId(db);

  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(history)
    .where(eq(history.personaId, personaId))
    .get();
  const total = countResult?.count || 0;

  const query = await scopedSelect(db, history);
  const results = await (includeArchived
    ? query.orderBy(desc(history.createdAt))
    : query.where(isNull(history.summarizedAt)).orderBy(desc(history.createdAt))
  ).limit(limit).offset(offset).all();
  const historyEntries = results.reverse();

  return {
    history: historyEntries,
    total,
    limit,
    offset,
    hasMore: offset + historyEntries.length < total
  };
}

/**
 * GET /cold-storage - Returns paginated frozen memories
 */
export async function handleGetColdStorage(db: DrizzleD1, searchParams: URLSearchParams = new URLSearchParams()) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const personaId = await getActivePersonaId(db);

  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(coldStorage)
    .where(eq(coldStorage.personaId, personaId))
    .get();
  const total = countResult?.count || 0;

  const query = await scopedSelect(db, coldStorage);
  const results = await query.orderBy(coldStorage.createdAt)
    .limit(limit).offset(offset).all();

  return {
    coldStorage: results,
    total,
    limit,
    offset,
    hasMore: offset + results.length < total
  };
}

/**
 * GET /notebook - Returns paginated saved notes with multi-row assembly
 */
export async function handleGetNotebook(db: DrizzleD1, searchParams: URLSearchParams = new URLSearchParams()) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const allEntries = await getNotebook(db);
  const total = allEntries.length;
  const notebook = allEntries.slice(offset, offset + limit);

  return {
    notebook,
    total,
    limit,
    offset,
    hasMore: offset + notebook.length < total
  };
}

/**
 * GET /observations - Returns entity's observations about the user
 */
export async function handleGetObservations(db: DrizzleD1) {
  const observations = await getObservations(db);
  return { observations };
}

/**
 * GET /reminders - Returns active reminders
 */
export async function handleGetReminders(db: DrizzleD1) {
  const reminders = await getReminders(db);
  return { reminders };
}

/**
 * GET /cycles - Returns cycle analytics with cost and cache metrics
 */
export async function handleGetCycles(db: DrizzleD1, searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '10');
  const hours = searchParams.get('hours') ? parseInt(searchParams.get('hours')!) : null;
  const personaId = await getActivePersonaId(db);

  let cycleResults;
  if (hours) {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const cutoff = cutoffDate.toISOString().replace('T', ' ').slice(0, 19);
    cycleResults = await db.select({
      id: cycles.id,
      createdAt: cycles.createdAt,
      model: cycles.model,
      trigger: cycles.trigger,
      inputTokens: cycles.inputTokens,
      outputTokens: cycles.outputTokens,
      cacheCreationTokens: cycles.cacheCreationTokens,
      cacheReadTokens: cycles.cacheReadTokens,
      cacheTtl: cycles.cacheTtl,
      actionCount: cycles.actionCount,
      primaryAction: cycles.primaryAction,
      estimatedCostCents: cycles.estimatedCostCents,
      status: cycles.status,
    })
      .from(cycles)
      .where(and(eq(cycles.personaId, personaId), eq(cycles.status, 'completed'), gt(cycles.createdAt, cutoff)))
      .orderBy(desc(cycles.id))
      .all();
  } else {
    cycleResults = await db.select({
      id: cycles.id,
      createdAt: cycles.createdAt,
      model: cycles.model,
      trigger: cycles.trigger,
      inputTokens: cycles.inputTokens,
      outputTokens: cycles.outputTokens,
      cacheCreationTokens: cycles.cacheCreationTokens,
      cacheReadTokens: cycles.cacheReadTokens,
      cacheTtl: cycles.cacheTtl,
      actionCount: cycles.actionCount,
      primaryAction: cycles.primaryAction,
      estimatedCostCents: cycles.estimatedCostCents,
      status: cycles.status,
    })
      .from(cycles)
      .where(and(eq(cycles.personaId, personaId), eq(cycles.status, 'completed')))
      .orderBy(desc(cycles.id))
      .limit(Math.min(limit, 1000))
      .all();
  }

  const results = cycleResults;
  const totalCost = results.reduce((sum, cycle) => sum + (cycle.estimatedCostCents || 0), 0);
  const averageCost = results.length > 0 ? totalCost / results.length : 0;
  const totalCacheRead = results.reduce((sum, cycle) => sum + (cycle.cacheReadTokens || 0), 0);
  const totalInput = results.reduce((sum, cycle) => sum + (cycle.inputTokens || 0), 0);
  const totalWithCache = totalCacheRead + totalInput;
  const cacheHitRate = totalWithCache > 0 ? (totalCacheRead / totalWithCache) * 100 : 0;

  return {
    cycles: results,
    stats: {
      count: results.length,
      totalCostCents: Math.round(totalCost * 1000) / 1000,
      avgCostCents: Math.round(averageCost * 1000) / 1000,
      cacheHitRate: Math.round(cacheHitRate * 10) / 10,
      ...(hours && { hoursWindow: hours })
    }
  };
}

/**
 * GET /gallery - Returns generated images from history
 *
 * @note blurred/vaulted columns are typed in Drizzle schema
 */
export async function handleGetGallery(db: DrizzleD1, searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '100');
  const includeVaulted = searchParams.get('include_vaulted') === 'true';
  const personaId = await getActivePersonaId(db);

  const vaultFilter = includeVaulted
    ? undefined
    : or(isNull(history.vaulted), eq(history.vaulted, 0));

  const results = await db.select({
    id: history.id,
    type: history.type,
    content: history.content,
    internal: history.internal,
    createdAt: history.createdAt,
    blurred: history.blurred,
    vaulted: history.vaulted,
  })
    .from(history)
    .where(and(
      eq(history.personaId, personaId),
      or(eq(history.type, 'art_result'), eq(history.type, 'user_art')),
      or(like(history.content, 'data:image%'), like(history.content, 'https://%')),
      vaultFilter
    ))
    .orderBy(desc(history.createdAt))
    .limit(limit)
    .all();

  const images = results.map((entry) => ({
    id: entry.id,
    type: entry.type,
    image: entry.content,
    prompt: entry.internal,
    createdAt: entry.createdAt,
    blurred: (entry.blurred ?? 0) === 1,
    vaulted: (entry.vaulted ?? 0) === 1
  }));

  return { images, total: images.length };
}

/**
 * GET /profile-picture - Returns entity's current profile picture
 */
export async function handleGetProfilePicture(db: DrizzleD1) {
  const profilePicture = await getState(db, 'profile_picture');
  const timestamp = await getState(db, 'profile_picture_timestamp');
  return {
    profilePicture: profilePicture || null,
    timestamp: timestamp || null
  };
}

