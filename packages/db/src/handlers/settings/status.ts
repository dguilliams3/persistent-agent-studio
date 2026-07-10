/**
 * User status handler functions
 *
 * @module @persistence/db/handlers/settings/status
 * @description Handler functions for user status, discord, sleep, loop control,
 * and interval settings.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db state functions
 */

import type { DrizzleD1 } from '../../client';

import {
  getState,
  setState,
} from '../../index';


type SettingsBody = Record<string, unknown>;

// --- User Status ---

export async function handleGetUserStatus(db: DrizzleD1) {
  const status = await getState(db, 'user_status');
  const timestamp = await getState(db, 'user_status_timestamp');
  return { status: status || 'unknown', timestamp };
}

export async function handleSetUserStatus(db: DrizzleD1, body: SettingsBody) {
  const { status } = body;
  if (!status || typeof status !== 'string') {
    return { error: 'Status is required and must be a string', status: 400 };
  }
  await setState(db, 'user_status', status);
  await setState(db, 'user_status_timestamp', new Date().toISOString());
  return { success: true, status };
}

// --- Discord ---

export async function handleGetDiscordEnabled(db: DrizzleD1) {
  const enabled = await getState(db, 'discord_enabled');
  return { enabled: enabled !== 'false' };
}

export async function handleSetDiscordEnabled(db: DrizzleD1, body: SettingsBody) {
  const { enabled } = body;
  await setState(db, 'discord_enabled', enabled ? 'true' : 'false');
  return { success: true, enabled };
}

// --- Sleep ---

export async function handleGetSleepStatus(db: DrizzleD1) {
  const isSleeping = await getState(db, 'is_sleeping');
  const sleepUntil = await getState(db, 'sleep_until');
  return {
    isSleeping: isSleeping === 'true',
    sleepUntil: sleepUntil || null
  };
}

export async function handleDeleteSleepStatus(db: DrizzleD1) {
  await setState(db, 'is_sleeping', 'false');
  await setState(db, 'sleep_until', null);
  return { success: true, message: 'Entity has been woken up' };
}

// --- Loop Control ---

export async function handleStart(db: DrizzleD1) {
  await setState(db, 'is_running', 'true');
  return { success: true };
}

export async function handleStop(db: DrizzleD1) {
  await setState(db, 'is_running', 'false');
  return { success: true };
}

// --- Interval ---

export async function handleSetInterval(db: DrizzleD1, body: SettingsBody) {
  const seconds = body.seconds as string;
  const value = parseInt(seconds);
  if (isNaN(value) || value < 30 || value > 3600) {
    return { error: 'seconds must be a number between 30 and 3600', status: 400 };
  }
  await setState(db, 'cycle_interval_seconds', String(value));
  return { success: true, interval: value };
}

// --- Max Tokens ---

export async function handleGetMaxTokens(db: DrizzleD1, defaultMaximum: number) {
  const maxTokens = await getState(db, 'max_output_tokens');
  return { maxTokens: parseInt(maxTokens || String(defaultMaximum)) };
}

export async function handleSetMaxTokens(db: DrizzleD1, body: SettingsBody) {
  const maxTokens = body.maxTokens as string;
  const value = parseInt(maxTokens);
  if (isNaN(value) || value < 100 || value > 16000) {
    return { error: 'maxTokens must be a number between 100 and 16000', status: 400 };
  }
  await setState(db, 'max_output_tokens', String(value));
  return { success: true, maxTokens: value };
}

// --- Streaming ---

export async function handleGetStreaming(db: DrizzleD1) {
  const streaming = await getState(db, 'telegram_streaming');
  return { enabled: streaming === 'true' };
}

export async function handleSetStreaming(db: DrizzleD1, body: SettingsBody) {
  const { enabled } = body;
  await setState(db, 'telegram_streaming', enabled ? 'true' : 'false');
  return { success: true, enabled };
}
