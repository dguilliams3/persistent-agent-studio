/**
 * SET_STATE Handler
 *
 * @module @persistence/tools/definitions/set-state/handler
 * @description Updates internal being-state meters (aliveness, curiosity, etc.)
 *
 * NOTE: This is a simplified implementation that sets meter values directly.
 * The FULL meters module (with trailing history tracking, visual bars, etc.)
 * is still in platforms/cloudflare/src/utils/meters.js and should be migrated
 * to packages for complete functionality.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: setState(), logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { SetStateParams } from './params';
import { logHistory, HISTORY_TYPES, setState } from '@persistence/db';

/** Meter configuration with state keys and abbreviations */
const METER_CONFIG = {
  aliveness: { key: 'meter_aliveness', abbrev: 'A' },
  curiosity: { key: 'meter_curiosity', abbrev: 'C' },
  connection: { key: 'meter_connection', abbrev: 'N' },
  ease: { key: 'meter_ease', abbrev: 'E' },
  delight: { key: 'meter_delight', abbrev: 'D' },
  anxiety: { key: 'meter_anxiety', abbrev: 'X' },
  activity: { key: 'meter_activity', abbrev: 'Y' }
} as const;

type MeterName = keyof typeof METER_CONFIG;

/**
 * Clamp a value to the valid meter range (0-10)
 */
function clampMeterValue(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

/**
 * Handle SET_STATE action.
 *
 * Updates being-state meters in the state table.
 *
 * @param params - The validated SET_STATE parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success with updated meters
 */
export const handler: ToolHandler<SetStateParams> = async (
  params: SetStateParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { internal, ...meterParams } = params;
  const { db, cycleId } = ctx;

  try {
    const typedDb = db as Parameters<typeof setState>[0];
    const updated: string[] = [];

    // Update each provided meter
    for (const [meterName, config] of Object.entries(METER_CONFIG)) {
      const value = meterParams[meterName as MeterName];
      if (value !== undefined) {
        const clampedValue = clampMeterValue(value);
        await setState(typedDb, config.key, String(clampedValue));
        updated.push(`${config.abbrev}${clampedValue}`);
      }
    }

    // Log to history if any meters were updated
    if (updated.length > 0) {
      await logHistory({
        db: typedDb,
        type: HISTORY_TYPES.STATE_UPDATE,
        content: updated.join(' '),
        internal: internal ?? 'Internal state update',
        cycleId
      });
    }

    return {
      success: true,
      type: 'state_update',
      data: {
        updated: updated.join(' '),
        // Note: This simplified version doesn't update meter_history_* keys
        // Full functionality requires migrating meters module to packages
        limitedMode: true
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update state: ${(error as Error).message}`
    };
  }
};
