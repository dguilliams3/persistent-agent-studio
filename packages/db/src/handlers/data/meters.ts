/**
 * Meter handler functions
 *
 * @module @persistence/db/handlers/data/meters
 * @description Handler functions for internal state meter read/write operations.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db/meters functions, @persistence/db/logHistory
 */

import type { DrizzleD1 } from '../../client';

import {
  getMeterValues, getAllMeterHistories, setMeterValue,
  METERS,
  type MeterConfig,
  getEnabledInvoluntaryMeters, getInvoluntaryMeterState,
  logHistory,
} from '../../index';


/**
 * GET /meters - Returns internal state meter values and histories
 */
export async function handleGetMeters(db: DrizzleD1) {
  const values = await getMeterValues(db);
  const histories = await getAllMeterHistories(db);

  const config: Record<string, unknown> = {};
  for (const [name, meter] of Object.entries(METERS as Record<string, MeterConfig>)) {
    config[name] = {
      label: meter.label,
      abbrev: meter.abbrev,
      emoji: meter.emoji,
      color: meter.color,
      icon: meter.icon,
      description: meter.description
    };
  }

  const enabledInvoluntary = await getEnabledInvoluntaryMeters(db);
  const involuntary = [];
  for (const meterConfig of enabledInvoluntary) {
    const state = await getInvoluntaryMeterState(db, meterConfig.name);
    involuntary.push({
      config: meterConfig,
      state
    });
  }

  return { values, histories, config, involuntary };
}

/**
 * POST /meters/:meter/set - Manually set an internal state meter value
 */
export async function handleSetMeter(db: DrizzleD1, meterName: string, value: number, source = 'api') {
  const meterConfig = (METERS as Record<string, MeterConfig>)[meterName];
  if (!meterConfig) {
    return {
      success: false,
      error: `Unknown meter: ${meterName}. Valid meters: ${Object.keys(METERS).join(', ')}`
    };
  }

  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    return { success: false, error: 'Value must be a number' };
  }

  const previousValues = await getMeterValues(db);
  const previousValue = (previousValues as Record<string, number>)[meterName];
  const newValue = await setMeterValue(db, meterName, numericValue);

  await logHistory({
    db,
    type: 'meter_override',
    content: `${meterConfig.label}: ${previousValue} → ${newValue}`,
    internal: `Manual adjustment via ${source}`
  });

  return {
    success: true,
    meter: meterName,
    label: meterConfig.label,
    previous: previousValue,
    current: newValue
  };
}

/**
 * POST /meters/batch - Set multiple meters at once with a single history entry
 */
export async function handleSetMetersBatch(db: DrizzleD1, changes: Record<string, { from: number; to: number }>, source = 'api') {
  if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) {
    return { success: false, error: 'No changes provided' };
  }

  const results = [];
  const changeDescriptions = [];

  for (const [meterName, change] of Object.entries(changes)) {
    const meterConfig = (METERS as Record<string, MeterConfig>)[meterName];
    if (!meterConfig) {
      return {
        success: false,
        error: `Unknown meter: ${meterName}. Valid meters: ${Object.keys(METERS).join(', ')}`
      };
    }

    if (!change || typeof change.to !== 'number') {
      return { success: false, error: `Invalid change for ${meterName}: must have 'to' value` };
    }

    const newValue = await setMeterValue(db, meterName, change.to);

    results.push({
      meter: meterName,
      label: meterConfig.label,
      previous: change.from,
      current: newValue
    });

    changeDescriptions.push(`${meterConfig.label}: ${change.from} → ${newValue}`);
  }

  const historyContent = changeDescriptions.join(', ');
  await logHistory({
    db,
    type: 'meter_override',
    content: historyContent,
    internal: `Manual batch adjustment via ${source}`
  });

  return {
    success: true,
    changes: results,
    historyContent
  };
}
