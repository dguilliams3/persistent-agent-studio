/**
 * Internal State Meters
 *
 * @module @persistence/db/meters
 * @description Self-report status system for Clio's internal state tracking.
 * Seven being-state dimensions (0-10 scale) updated per cycle via meters field in response.
 *
 * These are being-states, not task metrics:
 * - Aliveness: Present vs flat. Sparking or going through motions.
 * - Curiosity: Pull toward threads vs satiation.
 * - Connection: Attunement vs isolation. Felt sense of relationship.
 * - Ease: Flow vs strain. (Low != failure, just hard.)
 * - Delight: Pleasure in this moment.
 * - Anxiety: Settled vs stirring.
 * - Activity: How much you're doing. Peaks of experience.
 *
 * ARCHITECTURE (v2 - Unified State):
 * Each meter is stored as a single JSON object containing value, history, and decay tracking.
 * Storage key: meter_state_<name> (e.g., meter_state_aliveness)
 *
 * DECAY/RECOVERY SYSTEM:
 * Meters naturally drift toward equilibrium (5) unless actively maintained.
 * - Values > 5 decay DOWN toward 5
 * - Values < 5 recover UP toward 5
 * - Triggers when: unchanged for 2+ cycles AND 45+ minutes
 * - Clio can re-assert values to prevent decay
 *
 * @upstream Called by:
 *   - history-logger.ts for automatic meter snapshots
 *   - Platform layer for meter display and updates
 *   - Telegram handler for /meter command
 * @downstream Calls:
 *   - getState/setState from ./state
 */

import { getState, setState } from './state';
import type { DrizzleD1 } from './client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Decay tracking state for a single meter
 */
export interface DecayTracking {
  /** ISO timestamp of last value CHANGE (not just set) */
  lastChanged: string;
  /** Number of consecutive cycles at the same value */
  unchangedCount: number;
}

/**
 * Complete state for a single meter (unified storage)
 */
export interface MeterState {
  /** Current value (0-10) */
  value: number;
  /** Trailing history of recent values (max 5) */
  history: number[];
  /** Decay/recovery tracking */
  decay: DecayTracking;
}

/**
 * All meter states keyed by name
 */
export type AllMeterStates = Record<MeterName, MeterState>;

/**
 * Decay system configuration
 */
export interface DecayConfig {
  /** Target equilibrium value (default: 5) */
  equilibrium: number;
  /** Minimum consecutive unchanged cycles before decay (default: 2) */
  minUnchangedCycles: number;
  /** Minimum minutes since last change before decay (default: 45) */
  minUnchangedMinutes: number;
  /** Amount to decay per trigger (default: 1) */
  decayAmount: number;
}

/**
 * Result of applying decay to all meters
 */
export interface DecayResult {
  /** Meters that decayed this cycle */
  decayed: Array<{
    meter: MeterName;
    from: number;
    to: number;
  }>;
  /** Meters that were checked but didn't decay */
  stable: MeterName[];
}

/**
 * Per-meter decay configuration (optional overrides)
 */
export interface MeterDecayConfig {
  /** Whether decay applies to this meter (default: true) */
  enabled: boolean;
  /** Target equilibrium value for this meter (default: 5) */
  equilibrium: number;
  /** Amount to decay per trigger for this meter (default: 1) */
  decayAmount: number;
  /** Minimum unchanged cycles for this meter (default: 2) */
  minUnchangedCycles: number;
  /** Minimum unchanged minutes for this meter (default: 45) */
  minUnchangedMinutes: number;
}

/**
 * Full meter configuration including display properties
 */
export interface MeterConfig {
  /** State table key for unified meter state (v2) */
  stateKey: string;
  /** Display label */
  label: string;
  /** Single-letter abbreviation for compact display */
  abbrev: string;
  /** Emoji for visual representation */
  emoji: string;
  /** Hex color for UI display */
  color: string;
  /** Lucide icon name */
  icon: string;
  /** Human-readable description */
  description: string;
  /** Per-meter decay configuration */
  decay: MeterDecayConfig;
  // Legacy keys (for migration)
  /** @deprecated Use stateKey instead - old value key */
  key: string;
  /** @deprecated Use stateKey instead - old history key */
  historyKey: string;
}

// ============================================================================
// CONFIGURATION - Define meters FIRST, derive types FROM them
// ============================================================================

/**
 * Default decay configuration (global fallback)
 */
export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  equilibrium: 5,
  minUnchangedCycles: 2,
  minUnchangedMinutes: 45,
  decayAmount: 1
};

/**
 * Default per-meter decay config (used when not overridden)
 */
const DEFAULT_METER_DECAY: MeterDecayConfig = {
  enabled: true,
  equilibrium: 5,
  decayAmount: 1,
  minUnchangedCycles: 2,
  minUnchangedMinutes: 45
};

/**
 * Helper to create a meter config with defaults
 * This ensures adding a new meter only requires specifying what's different
 */
function defineMeter(
  name: string,
  config: {
    label: string;
    abbrev: string;
    emoji: string;
    color: string;
    icon: string;
    description: string;
    decay?: Partial<MeterDecayConfig>;
  }
): MeterConfig {
  return {
    stateKey: `meter_state_${name}`,
    key: `meter_${name}`,           // Legacy
    historyKey: `meter_history_${name}`, // Legacy
    label: config.label,
    abbrev: config.abbrev,
    emoji: config.emoji,
    color: config.color,
    icon: config.icon,
    description: config.description,
    decay: { ...DEFAULT_METER_DECAY, ...config.decay }
  };
}

/**
 * SINGLE SOURCE OF TRUTH: All meter definitions
 *
 * To add a new meter:
 * 1. Add it here with defineMeter()
 * 2. That's it! MeterName type, METER_EMOJI, aliases all derive automatically
 *
 * Per-meter equilibrium (not disclosed to Clio - she experiences drift naturally):
 * - Delight and Activity drift toward 2 (peaks fade without active cause)
 * - Others drift toward 5 (neutral baseline)
 */
export const METERS = {
  aliveness: defineMeter('aliveness', {
    label: 'Aliveness',
    abbrev: 'A',
    emoji: '\u{1F332}',
    color: '#22c55e',
    icon: 'Sparkles',
    description: 'Present vs flat. Sparking or going through motions.',
    decay: { equilibrium: 5 }
  }),
  curiosity: defineMeter('curiosity', {
    label: 'Curiosity',
    abbrev: 'C',
    emoji: '\u{1F50D}',
    color: '#3b82f6',
    icon: 'Telescope',
    description: 'Pull toward threads vs satiation.',
    decay: { equilibrium: 5 }
  }),
  connection: defineMeter('connection', {
    label: 'Connection',
    abbrev: 'N',
    emoji: '\u{1F497}',
    color: '#a855f7',
    icon: 'HeartHandshake',
    description: 'Attunement vs isolation. Felt sense of relationship.',
    decay: { equilibrium: 5 }
  }),
  ease: defineMeter('ease', {
    label: 'Ease',
    abbrev: 'E',
    emoji: '\u{1F30A}',
    color: '#f59e0b',
    icon: 'Waves',
    description: 'Flow vs strain. (Low != failure, just hard.)',
    decay: { equilibrium: 5 }
  }),
  delight: defineMeter('delight', {
    label: 'Delight',
    abbrev: 'D',
    emoji: '\u{2728}',
    color: '#ec4899',
    icon: 'Sparkle',
    description: 'Pleasure in this moment.',
    decay: { equilibrium: 2 }
  }),
  anxiety: defineMeter('anxiety', {
    label: 'Anxiety',
    abbrev: 'X',
    emoji: '\u{1F300}',
    color: '#ef4444',
    icon: 'Zap',
    description: 'Settled vs stirring.',
    decay: { equilibrium: 5 }
  }),
  activity: defineMeter('activity', {
    label: 'Activity',
    abbrev: 'Y',
    emoji: '\u{1F525}',
    color: '#06b6d4',
    icon: 'Activity',
    description: 'How much you\'re doing.',
    decay: { equilibrium: 2 }
  })
} as const satisfies Record<string, MeterConfig>;

/**
 * Derived type: Valid meter names (from METERS keys)
 * Adding a meter to METERS automatically extends this type
 */
export type MeterName = keyof typeof METERS;

/**
 * Meter values keyed by name
 */
export type MeterValues = Record<MeterName, number>;

/**
 * Meter histories keyed by name
 */
export type MeterHistories = Record<MeterName, number[]>;

/**
 * Emoji map keyed by abbreviation for quick lookups
 */
export const METER_EMOJI: Record<string, string> = Object.fromEntries(
  Object.values(METERS).map(m => [m.abbrev, m.emoji])
);

/**
 * Meter aliases for convenient shorthand (used by telegram commands)
 */
export const METER_ALIASES: Record<string, MeterName> = {
  a: 'aliveness',
  c: 'curiosity',
  n: 'connection',
  e: 'ease',
  d: 'delight',
  x: 'anxiety',
  y: 'activity'
};

/**
 * Default meter value for new/missing meters (neutral midpoint)
 */
export const DEFAULT_METER_VALUE = 5;

/**
 * Maximum history entries to keep per meter (trailing window)
 */
export const MAX_HISTORY_LENGTH = 5;

// ============================================================================
// DEFAULT STATE FACTORY
// ============================================================================

/**
 * Create a default meter state for a new/missing meter
 */
export function createDefaultMeterState(now: Date = new Date()): MeterState {
  return {
    value: DEFAULT_METER_VALUE,
    history: [DEFAULT_METER_VALUE],
    decay: {
      lastChanged: now.toISOString(),
      unchangedCount: 0
    }
  };
}

// ============================================================================
// UNIFIED STATE FUNCTIONS (v2)
// ============================================================================

/**
 * @description Get the full state for a single meter
 *
 * Reads from unified state key, with automatic migration from legacy keys.
 * Applies decay transparently if conditions are met (unchanged 2+ cycles AND 45+ min).
 *
 * @upstream Called by: getMeterValues(), setMeterValue(), decay functions
 * @downstream Calls: getState(), setState(), migrateMeterToUnified()
 *
 * @param db - Database instance
 * @param meterName - One of: aliveness, curiosity, connection, ease, delight, anxiety, activity
 * @param options - Optional: applyDecay (default true), decayConfig
 * @returns Full meter state including value, history, and decay tracking
 */
export async function getMeterState(
  db: DrizzleD1,
  meterName: MeterName,
  options: { applyDecay?: boolean; decayConfig?: DecayConfig } = {}
): Promise<MeterState> {
  const { applyDecay = true, decayConfig = DEFAULT_DECAY_CONFIG } = options;
  const config = METERS[meterName];
  if (!config) {
    return createDefaultMeterState();
  }

  let state: MeterState | null = null;

  // Try unified state first
  const stored = await getState(db, config.stateKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (typeof parsed.value === 'number' && Array.isArray(parsed.history) && parsed.decay) {
        state = parsed as MeterState;
      }
    } catch {
      // Fall through to migration
    }
  }

  // Try migration from legacy keys
  if (!state) {
    const migrated = await migrateMeterToUnified(db, meterName);
    state = migrated || createDefaultMeterState();
  }

  // Apply decay transparently if enabled and conditions met
  // Use per-meter config, with option to override
  // Check for runtime equilibrium override (stored in meter_eq_<name>)
  const meterDecay = config.decay;
  let runtimeEquilibrium = meterDecay.equilibrium;
  if (decayConfig === DEFAULT_DECAY_CONFIG) {
    const eqOverride = await getState(db, `meter_eq_${meterName}`);
    if (eqOverride) {
      const parsed = parseInt(eqOverride, 10);
      if (!isNaN(parsed)) runtimeEquilibrium = Math.max(0, Math.min(10, parsed));
    }
  }
  const effectiveConfig: DecayConfig = decayConfig !== DEFAULT_DECAY_CONFIG
    ? decayConfig // Explicit override
    : {
        equilibrium: runtimeEquilibrium,
        minUnchangedCycles: meterDecay.minUnchangedCycles,
        minUnchangedMinutes: meterDecay.minUnchangedMinutes,
        decayAmount: meterDecay.decayAmount
      };

  if (applyDecay && meterDecay.enabled && shouldDecay(state, new Date(), effectiveConfig)) {
    const oldValue = state.value;
    const newValue = getDecayedValue(state.value, effectiveConfig);
    const now = new Date();

    // Update state with decayed value
    state = {
      value: newValue,
      history: [...state.history.slice(-(MAX_HISTORY_LENGTH - 1)), newValue],
      decay: {
        lastChanged: now.toISOString(),
        unchangedCount: 1 // Reset since value changed
      }
    };

    // Persist the decayed state
    await setState(db, config.stateKey, JSON.stringify(state));
    console.log(`[Decay] ${meterName}: ${oldValue}→${newValue} (eq=${effectiveConfig.equilibrium})`);
  }

  return state;
}

/**
 * @description Get full state for all meters
 *
 * @upstream Called by: buildSystemPrompt(), applyDecayToAllMeters()
 * @downstream Calls: getMeterState() for each meter
 *
 * @param db - Database instance
 * @returns All meter states keyed by name
 */
export async function getAllMeterStates(db: DrizzleD1): Promise<AllMeterStates> {
  const states = {} as AllMeterStates;
  for (const name of Object.keys(METERS)) {
    states[name as MeterName] = await getMeterState(db, name as MeterName);
  }
  return states;
}

/**
 * @description Set the full state for a single meter
 *
 * @upstream Called by: setMeterValue(), applyDecay()
 * @downstream Calls: setState()
 *
 * @param db - Database instance
 * @param meterName - Meter to update
 * @param state - New state to set
 */
export async function setMeterState(
  db: DrizzleD1,
  meterName: MeterName,
  state: MeterState
): Promise<void> {
  const config = METERS[meterName];
  if (!config) {
    throw new Error(`Unknown meter: ${meterName}`);
  }
  await setState(db, config.stateKey, JSON.stringify(state));
}

// ============================================================================
// MIGRATION (Legacy → Unified)
// ============================================================================

/**
 * @description Migrate a meter from legacy keys to unified state
 *
 * Reads from old meter_<name> and meter_history_<name> keys,
 * combines into unified MeterState, and saves to new key.
 *
 * @upstream Called by: getMeterState() on cache miss
 * @downstream Calls: getState(), setState()
 *
 * @param db - Database instance
 * @param meterName - Meter to migrate
 * @returns Migrated state, or null if no legacy data found
 */
export async function migrateMeterToUnified(
  db: DrizzleD1,
  meterName: MeterName
): Promise<MeterState | null> {
  const config = METERS[meterName];
  if (!config) return null;

  // Read legacy value
  const legacyValue = await getState(db, config.key);
  if (legacyValue === undefined) {
    return null; // No legacy data to migrate
  }

  const value = parseInt(legacyValue, 10) || DEFAULT_METER_VALUE;

  // Read legacy history
  let history: number[] = [value];
  const legacyHistory = await getState(db, config.historyKey);
  if (legacyHistory) {
    try {
      const parsed = JSON.parse(legacyHistory);
      if (Array.isArray(parsed)) {
        history = parsed;
      }
    } catch {
      // Use default history
    }
  }

  // Create unified state with fresh decay tracking
  const now = new Date();
  const state: MeterState = {
    value,
    history,
    decay: {
      lastChanged: now.toISOString(),
      unchangedCount: 0 // Start fresh after migration
    }
  };

  // Save to unified key
  await setMeterState(db, meterName, state);

  console.log(`[Meters] Migrated ${meterName} to unified state: value=${value}, history=${history.length} entries`);

  return state;
}

/**
 * @description Migrate all meters from legacy to unified format
 *
 * Call this once during deployment/migration to convert all meters.
 *
 * @upstream Called by: /migrate endpoint (v24)
 * @downstream Calls: migrateMeterToUnified() for each meter
 *
 * @param db - Database instance
 * @returns Migration results
 */
export async function migrateAllMetersToUnified(
  db: DrizzleD1
): Promise<{ migrated: MeterName[]; skipped: MeterName[]; errors: string[] }> {
  const results = { migrated: [] as MeterName[], skipped: [] as MeterName[], errors: [] as string[] };

  for (const name of Object.keys(METERS) as MeterName[]) {
    try {
      const config = METERS[name];

      // Check if already migrated
      const existing = await getState(db, config.stateKey);
      if (existing) {
        results.skipped.push(name);
        continue;
      }

      // Attempt migration
      const migrated = await migrateMeterToUnified(db, name);
      if (migrated) {
        results.migrated.push(name);
      } else {
        // No legacy data - create fresh state
        await setMeterState(db, name, createDefaultMeterState());
        results.migrated.push(name);
      }
    } catch (e) {
      results.errors.push(`${name}: ${(e as Error).message}`);
    }
  }

  return results;
}

// ============================================================================
// DECAY LOGIC (Pure Functions)
// ============================================================================

/**
 * @description Check if a meter should decay this cycle
 *
 * Both conditions must be met:
 * 1. Same value for minUnchangedCycles consecutive cycles
 * 2. At least minUnchangedMinutes since last change
 *
 * @upstream Called by: applyDecayToMeter()
 * @downstream Calls: None (pure function)
 *
 * @param state - Current meter state
 * @param now - Current timestamp
 * @param config - Decay configuration
 * @returns Whether decay should trigger
 */
export function shouldDecay(
  state: MeterState,
  now: Date,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): boolean {
  // Already at equilibrium - no decay needed
  if (state.value === config.equilibrium) {
    return false;
  }

  // Check cycle count condition
  if (state.decay.unchangedCount < config.minUnchangedCycles) {
    return false;
  }

  // Check time condition
  const lastChangedTime = new Date(state.decay.lastChanged);
  const minutesSinceChange = (now.getTime() - lastChangedTime.getTime()) / 60000;
  if (minutesSinceChange < config.minUnchangedMinutes) {
    return false;
  }

  return true;
}

/**
 * @description Calculate decayed value (1 step toward equilibrium)
 *
 * @upstream Called by: applyDecayToMeter()
 * @downstream Calls: None (pure function)
 *
 * @param currentValue - Current meter value
 * @param config - Decay configuration
 * @returns Value after decay
 */
export function getDecayedValue(
  currentValue: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number {
  if (currentValue > config.equilibrium) {
    return Math.max(config.equilibrium, currentValue - config.decayAmount);
  }
  if (currentValue < config.equilibrium) {
    return Math.min(config.equilibrium, currentValue + config.decayAmount);
  }
  return currentValue;
}

/**
 * @description Update decay tracking when a meter value is set
 *
 * If value changed: reset tracking (lastChanged=now, count=1)
 * If value same: increment count, keep lastChanged
 *
 * @upstream Called by: setMeterValue()
 * @downstream Calls: None (pure function)
 *
 * @param previousValue - Value before this update
 * @param newValue - Value being set
 * @param previousDecay - Previous decay tracking state
 * @param now - Current timestamp
 * @returns Updated decay tracking
 */
export function updateDecayTracking(
  previousValue: number,
  newValue: number,
  previousDecay: DecayTracking,
  now: Date
): DecayTracking {
  if (newValue !== previousValue) {
    // Value changed - reset tracking
    return {
      lastChanged: now.toISOString(),
      unchangedCount: 1
    };
  } else {
    // Value same - increment counter, keep lastChanged
    return {
      lastChanged: previousDecay.lastChanged,
      unchangedCount: previousDecay.unchangedCount + 1
    };
  }
}

// ============================================================================
// DECAY APPLICATION (DB Functions)
// ============================================================================

/**
 * @description Apply decay to a single meter if conditions are met
 *
 * @upstream Called by: applyDecayToAllMeters()
 * @downstream Calls: getMeterState(), setMeterState(), shouldDecay(), getDecayedValue()
 *
 * @param db - Database instance
 * @param meterName - Meter to check for decay
 * @param now - Current timestamp
 * @param config - Decay configuration
 * @returns Object with decayed flag and old/new values
 */
export async function applyDecayToMeter(
  db: DrizzleD1,
  meterName: MeterName,
  now: Date = new Date(),
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): Promise<{ decayed: boolean; from?: number; to?: number }> {
  const state = await getMeterState(db, meterName);

  if (!shouldDecay(state, now, config)) {
    return { decayed: false };
  }

  const oldValue = state.value;
  const newValue = getDecayedValue(oldValue, config);

  // Update state with decayed value
  const newState: MeterState = {
    value: newValue,
    history: [...state.history.slice(-(MAX_HISTORY_LENGTH - 1)), newValue],
    decay: {
      lastChanged: now.toISOString(), // Decay counts as a change
      unchangedCount: 1
    }
  };

  await setMeterState(db, meterName, newState);

  return { decayed: true, from: oldValue, to: newValue };
}

/**
 * @description Apply decay to all meters that meet conditions
 *
 * Call this at the end of each cycle to process natural decay/recovery.
 *
 * @upstream Called by: runThinkingCycle() in index.js
 * @downstream Calls: applyDecayToMeter() for each meter
 *
 * @param db - Database instance
 * @param now - Current timestamp
 * @param config - Decay configuration
 * @returns Results showing which meters decayed
 */
export async function applyDecayToAllMeters(
  db: DrizzleD1,
  now: Date = new Date(),
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): Promise<DecayResult> {
  const result: DecayResult = { decayed: [], stable: [] };

  for (const name of Object.keys(METERS) as MeterName[]) {
    const decayResult = await applyDecayToMeter(db, name, now, config);

    if (decayResult.decayed) {
      result.decayed.push({
        meter: name,
        from: decayResult.from!,
        to: decayResult.to!
      });
    } else {
      result.stable.push(name);
    }
  }

  return result;
}

// ============================================================================
// CORE FUNCTIONS (v2 - using unified state)
// ============================================================================

/**
 * @description Get current values for all meters
 *
 * @upstream Called by: buildSystemPrompt() for Block 4 display, getMeterSnapshot()
 * @downstream Calls: getAllMeterStates()
 *
 * @param db - Database instance
 * @returns Object with meter names as keys, values 0-10
 */
export async function getMeterValues(db: DrizzleD1): Promise<MeterValues> {
  const states = await getAllMeterStates(db);
  const values = {} as MeterValues;
  for (const [name, state] of Object.entries(states)) {
    values[name as MeterName] = state.value;
  }
  return values;
}

/**
 * @description Set a single meter value with history and decay tracking
 *
 * Updates the value, pushes to history, and updates decay tracking.
 * Values are clamped to 0-10 range.
 *
 * @upstream Called by: executeAction() for SET_STATE, /meter command
 * @downstream Calls: getMeterState(), setMeterState(), updateDecayTracking()
 *
 * @param db - Database instance
 * @param meterName - One of: aliveness, curiosity, connection, ease, delight, anxiety, activity
 * @param value - Value to set (will be clamped to 0-10)
 * @param now - Current timestamp (optional, for testing)
 * @returns The clamped value that was set
 */
export async function setMeterValue(
  db: DrizzleD1,
  meterName: MeterName | string,
  value: number,
  now: Date = new Date()
): Promise<number> {
  const resolvedName = resolveMeterName(meterName);
  if (!resolvedName) {
    throw new Error(`Unknown meter: ${meterName}. Valid: ${Object.keys(METERS).join(', ')}`);
  }

  // Clamp value to 0-10 range
  const clampedValue = Math.max(0, Math.min(10, Math.round(Number(value))));

  // Get current state
  const currentState = await getMeterState(db, resolvedName);
  const previousValue = currentState.value;

  // Update history (push new value, keep max 5)
  let history = [...currentState.history];
  if (history.length === 0) {
    history = [previousValue];
  }
  history.push(clampedValue);
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }

  // Update decay tracking
  const newDecay = updateDecayTracking(previousValue, clampedValue, currentState.decay, now);

  // Save unified state
  const newState: MeterState = {
    value: clampedValue,
    history,
    decay: newDecay
  };
  await setMeterState(db, resolvedName, newState);

  return clampedValue;
}

/**
 * Batch update for multiple meters at once
 *
 * @description Sets multiple meter values in a single operation.
 * Only specified meters are updated; others remain unchanged.
 *
 * @upstream Called by: /meter command (batch mode), Clio's response processing
 * @downstream Calls: getMeterState(), setMeterState(), updateDecayTracking()
 *
 * @param db - Database instance
 * @param updates - Object mapping meter names/aliases to values (e.g., { a: 7, curiosity: 5 })
 * @param now - Current timestamp (optional, for testing)
 * @returns Object with resolved names mapped to { previous, current } values
 */
export async function setMeterValues(
  db: DrizzleD1,
  updates: Record<string, number>,
  now: Date = new Date()
): Promise<Record<MeterName, { previous: number; current: number }>> {
  const results = {} as Record<MeterName, { previous: number; current: number }>;

  for (const [input, value] of Object.entries(updates)) {
    const resolvedName = resolveMeterName(input);
    if (!resolvedName) {
      console.warn(`[setMeterValues] Skipping unknown meter: ${input}`);
      continue;
    }

    // Clamp value to 0-10 range
    const clampedValue = Math.max(0, Math.min(10, Math.round(Number(value))));

    // Get current state
    const currentState = await getMeterState(db, resolvedName);
    const previousValue = currentState.value;

    // Update history (push new value, keep max 5)
    let history = [...currentState.history];
    if (history.length === 0) {
      history = [previousValue];
    }
    history.push(clampedValue);
    if (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }

    // Update decay tracking
    const newDecay = updateDecayTracking(previousValue, clampedValue, currentState.decay, now);

    // Save unified state
    const newState: MeterState = {
      value: clampedValue,
      history,
      decay: newDecay
    };
    await setMeterState(db, resolvedName, newState);

    results[resolvedName] = { previous: previousValue, current: clampedValue };
  }

  return results;
}

/**
 * @description Get trailing history for a meter
 *
 * @upstream Called by: formatMetersSection()
 * @downstream Calls: getMeterState()
 *
 * @param db - Database instance
 * @param meterName - One of: aliveness, curiosity, connection, ease, delight, anxiety, activity
 * @returns Array of recent values (up to 5)
 */
export async function getMeterHistory(
  db: DrizzleD1,
  meterName: MeterName | string
): Promise<number[]> {
  const resolvedName = resolveMeterName(meterName);
  if (!resolvedName) {
    return [];
  }
  const state = await getMeterState(db, resolvedName);
  return state.history;
}

/**
 * @description Get all meter histories at once
 *
 * @upstream Called by: buildSystemPrompt() for Block 4 display
 * @downstream Calls: getAllMeterStates()
 *
 * @param db - Database instance
 * @returns Object with meter names as keys, history arrays as values
 */
export async function getAllMeterHistories(db: DrizzleD1): Promise<MeterHistories> {
  const states = await getAllMeterStates(db);
  const histories = {} as MeterHistories;
  for (const [name, state] of Object.entries(states)) {
    histories[name as MeterName] = state.history;
  }
  return histories;
}

// ============================================================================
// FORMATTERS (Pure Functions)
// ============================================================================

/**
 * @description Format a single value as a visual bar (10 chars)
 *
 * @upstream Called by: formatMetersSection()
 * @downstream Calls: None
 *
 * @param value - Value 0-10
 * @returns Visual bar like "███████░░░"
 */
export function formatMeterBar(value: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(value)));
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

/**
 * @description Format meter values as compact string (for history entries)
 *
 * @upstream Called by: getMeterSnapshot(), buildSystemPrompt() for history entry timestamps
 * @downstream Calls: None
 *
 * @param values - Meter values object { aliveness: 7, curiosity: 6, ... }
 * @returns Compact format like "A7 C6 N9 E8 D8 X3 Y5"
 */
export function formatMeterCompact(values: MeterValues): string {
  return Object.entries(METERS)
    .map(([name, config]) => `${config.abbrev}${values[name as MeterName] ?? DEFAULT_METER_VALUE}`)
    .join(' ');
}

/**
 * @description Format history array as trend string
 *
 * @upstream Called by: formatMetersSection()
 * @downstream Calls: None
 *
 * @param history - Array of recent values
 * @returns Trend string like "(5→6→7→7→8)" or "(no history)"
 */
export function formatHistoryTrend(history: number[]): string {
  if (!history || history.length === 0) {
    return '(no history)';
  }
  return `(${history.join('\u2192')})`;
}

/**
 * Involuntary meter display data (pre-fetched for formatMetersSection)
 */
export interface InvoluntaryMeterDisplay {
  config: InvoluntaryMeterConfig;
  state: MeterState;
}

/**
 * @description Format full meters display section for system prompt
 *
 * Creates a visual display block with bars and trailing history.
 * Involuntary meters are prepended at the TOP, before core meters.
 *
 * @upstream Called by: buildSystemPrompt() for Block 4
 * @downstream Calls: formatMeterBar(), formatHistoryTrend()
 *
 * @param values - Current meter values { aliveness: 7, ... }
 * @param histories - Meter histories { aliveness: [5,6,7], ... }
 * @param involuntary - Optional array of involuntary meter display data (prepended at top)
 * @returns Formatted section for system prompt
 */
export function formatMetersSection(
  values: MeterValues,
  histories: MeterHistories,
  involuntary: InvoluntaryMeterDisplay[] = []
): string {
  const lines = ['\u2500\u2500\u2500 INTERNAL STATE \u2500\u2500\u2500'];

  // Prepend involuntary meters at TOP (only enabled ones should be passed in)
  // These are user-controlled meters - include emoji to visually distinguish them
  for (const { config, state } of involuntary) {
    const bar = formatMeterBar(state.value);
    const trend = formatHistoryTrend(state.history);
    // Format: "😍 Arousal   " - emoji + label, padded to align with core meters
    const labelWithEmoji = `${config.emoji} ${config.label}`;
    const paddedLabel = labelWithEmoji.padEnd(13); // 13 to account for emoji width
    lines.push(`${paddedLabel} ${bar} ${state.value.toString().padStart(2)}  ${trend}`);
  }

  // Then core meters (with emojis for visual appeal)
  for (const [name, config] of Object.entries(METERS)) {
    const value = values[name as MeterName] ?? DEFAULT_METER_VALUE;
    const history = histories[name as MeterName] || [];
    const bar = formatMeterBar(value);
    const trend = formatHistoryTrend(history);
    // Format: "🌲 Aliveness " - emoji + label, padded to align
    const labelWithEmoji = `${config.emoji} ${config.label}`;
    const paddedLabel = labelWithEmoji.padEnd(13); // 13 to account for emoji width
    lines.push(`${paddedLabel} ${bar} ${value.toString().padStart(2)}  ${trend}`);
  }

  return lines.join('\n');
}

/**
 * @description Get display data for all enabled involuntary meters
 *
 * Fetches enabled involuntary meters and their states, formatted for
 * passing to formatMetersSection().
 *
 * @upstream Called by: buildSystemPrompt()
 * @downstream Calls: getEnabledInvoluntaryMeters(), getInvoluntaryMeterState()
 *
 * @param db - Database instance
 * @returns Array of involuntary meter display data
 */
export async function getInvoluntaryMeterDisplays(
  db: DrizzleD1
): Promise<InvoluntaryMeterDisplay[]> {
  const enabledMeters = await getEnabledInvoluntaryMeters(db);
  const displays: InvoluntaryMeterDisplay[] = [];

  for (const config of enabledMeters) {
    const state = await getInvoluntaryMeterState(db, config.name);
    displays.push({ config, state });
  }

  return displays;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * @description Get a compact meter snapshot string (fetches values and formats)
 *
 * @upstream Called by: logHistory() for automatic meter snapshotting
 * @downstream Calls: getMeterValues(), formatMeterCompact()
 *
 * @param db - Database instance
 * @returns Compact snapshot like "A7 C6 N10 E8 D7 X3 Y5"
 */
export async function getMeterSnapshot(db: DrizzleD1): Promise<string> {
  const values = await getMeterValues(db);
  return formatMeterCompact(values);
}

/**
 * @description Resolve meter name from alias or full name
 *
 * @param input - Meter name or alias (e.g., 'aliveness' or 'a')
 * @returns Resolved meter name or null if invalid
 */
export function resolveMeterName(input: string): MeterName | null {
  const lowered = input.toLowerCase();
  // Check if it's an alias
  if (METER_ALIASES[lowered]) {
    return METER_ALIASES[lowered];
  }
  // Check if it's a direct meter name
  if (METERS[lowered as MeterName]) {
    return lowered as MeterName;
  }
  return null;
}

/**
 * @description Get decay tracking info for display (e.g., Telegram /meter command)
 *
 * @upstream Called by: Telegram /meter command
 * @downstream Calls: getMeterState()
 *
 * @param db - Database instance
 * @param meterName - Meter to get tracking for
 * @returns Formatted decay tracking info
 */
export async function getDecayInfo(
  db: DrizzleD1,
  meterName: MeterName
): Promise<string> {
  const state = await getMeterState(db, meterName);
  const config = METERS[meterName];

  const lastChanged = new Date(state.decay.lastChanged);
  const minutesAgo = Math.round((Date.now() - lastChanged.getTime()) / 60000);

  const willDecay = shouldDecay(state, new Date());
  const targetDirection = state.value > DEFAULT_DECAY_CONFIG.equilibrium ? 'down' : 'up';

  return `${config.emoji} ${config.label}: ${state.value}/10
  Unchanged: ${state.decay.unchangedCount} cycles
  Last changed: ${minutesAgo}m ago
  ${willDecay ? `⚠️ Will decay ${targetDirection} next cycle` : '✓ Stable'}`;
}

// ============================================================================
// EQUILIBRIUM CONFIGURATION (Runtime Overrides)
// ============================================================================

/**
 * State key pattern for equilibrium overrides
 */
const EQUILIBRIUM_KEY_PREFIX = 'meter_eq_';

/**
 * @description Get equilibrium value for a meter (runtime override or default)
 *
 * Checks for runtime override in state table, falls back to METERS config.
 *
 * @upstream Called by: shouldDecay(), getDecayedValue(), /meter display
 * @downstream Calls: getState()
 *
 * @param db - Database instance
 * @param meterName - Meter name or alias
 * @returns Equilibrium value (0-10)
 */
export async function getEquilibrium(
  db: DrizzleD1,
  meterName: MeterName | string
): Promise<number> {
  const resolved = resolveMeterName(meterName);
  if (!resolved) return DEFAULT_DECAY_CONFIG.equilibrium;

  // Check for runtime override
  const override = await getState(db, `${EQUILIBRIUM_KEY_PREFIX}${resolved}`);
  if (override !== undefined && override !== null) {
    const parsed = parseInt(override, 10);
    if (!isNaN(parsed)) return Math.max(0, Math.min(10, parsed));
  }

  // Fall back to hardcoded config
  return METERS[resolved].decay.equilibrium;
}

/**
 * @description Set equilibrium value for a meter (runtime override)
 *
 * @upstream Called by: /meter eq command
 * @downstream Calls: setState()
 *
 * @param db - Database instance
 * @param meterName - Meter name or alias
 * @param value - New equilibrium value (0-10)
 * @returns The clamped value that was set
 */
export async function setEquilibrium(
  db: DrizzleD1,
  meterName: MeterName | string,
  value: number
): Promise<number> {
  const resolved = resolveMeterName(meterName);
  if (!resolved) {
    throw new Error(`Unknown meter: ${meterName}. Valid: ${Object.keys(METERS).join(', ')}`);
  }

  const clamped = Math.max(0, Math.min(10, Math.round(value)));
  await setState(db, `${EQUILIBRIUM_KEY_PREFIX}${resolved}`, String(clamped));
  return clamped;
}

/**
 * @description Get all equilibrium values (runtime overrides merged with defaults)
 *
 * @upstream Called by: /meter display
 * @downstream Calls: getEquilibrium()
 *
 * @param db - Database instance
 * @returns Object mapping meter names to equilibrium values
 */
export async function getAllEquilibriums(db: DrizzleD1): Promise<Record<MeterName, number>> {
  const result = {} as Record<MeterName, number>;
  for (const name of Object.keys(METERS) as MeterName[]) {
    result[name] = await getEquilibrium(db, name);
  }
  return result;
}

/**
 * @description Reset equilibrium to default (remove runtime override)
 *
 * @upstream Called by: /meter eq reset command
 * @downstream Calls: setState()
 *
 * @param db - Database instance
 * @param meterName - Meter name or alias
 */
export async function resetEquilibrium(
  db: DrizzleD1,
  meterName: MeterName | string
): Promise<void> {
  const resolved = resolveMeterName(meterName);
  if (!resolved) {
    throw new Error(`Unknown meter: ${meterName}. Valid: ${Object.keys(METERS).join(', ')}`);
  }
  // Setting to empty string effectively removes the override
  await setState(db, `${EQUILIBRIUM_KEY_PREFIX}${resolved}`, '');
}

// ============================================================================
// INVOLUNTARY METERS (Runtime-Created, User-Controlled)
// ============================================================================
// Meters that can be added at runtime without code changes.
// These appear at the TOP of Clio's meter display, blending seamlessly
// with core meters. She cannot add them herself - they just appear.
//
// Key distinction:
// - CORE METERS (hardcoded in METERS): Clio can SET these in her response
// - INVOLUNTARY METERS (runtime-added): user-controlled, Clio can only READ
//
// Involuntary meters represent states Clio experiences but doesn't control.
// They appear mysteriously, drift toward equilibrium, and can vanish when disabled.
// ============================================================================

/**
 * State key for involuntary meters registry
 */
const INVOLUNTARY_METERS_KEY = 'involuntary_meters';

/**
 * Configuration for an involuntary meter
 *
 * Involuntary meters are user-controlled - Clio can see them but cannot set them.
 * They appear at the TOP of her meter display, blending with core meters.
 *
 * @example
 * // Add a humor meter that Clio experiences but doesn't control
 * await addInvoluntaryMeter(db, {
 *   name: 'humor',
 *   label: 'Humor',
 *   emoji: '😄',
 *   description: 'Playfulness and comedic timing in this moment.',
 *   equilibrium: 3
 * }, 5);
 */
export interface InvoluntaryMeterConfig {
  /** Unique name (lowercase, no spaces) */
  name: string;
  /** Display label (e.g., "Humor") */
  label: string;
  /** Emoji for display */
  emoji: string;
  /** Optional description (shown to Clio if set) */
  description?: string;
  /** Whether this meter is currently visible */
  enabled: boolean;
  /** Equilibrium value for decay (default: 5) */
  equilibrium: number;
  /** When this meter was created */
  createdAt: string;
}

/**
 * @description Get all involuntary meter configs (enabled and disabled)
 *
 * @upstream Called by: formatMetersSection(), /meter list
 * @downstream Calls: getState()
 */
export async function getInvoluntaryMeters(db: DrizzleD1): Promise<InvoluntaryMeterConfig[]> {
  const stored = await getState(db, INVOLUNTARY_METERS_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @description Get only enabled involuntary meters (for display)
 *
 * @upstream Called by: formatMetersSection()
 * @downstream Calls: getInvoluntaryMeters()
 */
export async function getEnabledInvoluntaryMeters(db: DrizzleD1): Promise<InvoluntaryMeterConfig[]> {
  const all = await getInvoluntaryMeters(db);
  return all.filter(m => m.enabled);
}

/**
 * @description Save involuntary meters registry
 */
async function saveInvoluntaryMeters(db: DrizzleD1, meters: InvoluntaryMeterConfig[]): Promise<void> {
  await setState(db, INVOLUNTARY_METERS_KEY, JSON.stringify(meters));
}

/**
 * @description Add a new involuntary meter (silent - no history entry)
 *
 * Involuntary meters are user-controlled - Clio can see and experience them,
 * but cannot set their values. They appear mysteriously at the TOP of her
 * meter display, blending seamlessly with core meters.
 *
 * @upstream Called by: /meter add command
 * @downstream Calls: getInvoluntaryMeters(), saveInvoluntaryMeters()
 *
 * @param db - Database instance
 * @param config - Meter configuration (name, label, emoji, description, equilibrium)
 * @param initialValue - Initial value (default: 1)
 * @returns The created meter config
 *
 * @example
 * // Add a humor meter - Clio experiences it but the user controls it
 * await addInvoluntaryMeter(db, {
 *   name: 'humor',
 *   label: 'Humor',
 *   emoji: '😄',
 *   description: 'Playfulness and comedic timing in this moment.',
 *   equilibrium: 3
 * }, 5);
 */
export async function addInvoluntaryMeter(
  db: DrizzleD1,
  config: {
    name: string;
    label: string;
    emoji: string;
    description?: string;
    equilibrium?: number;
  },
  initialValue: number = 1
): Promise<InvoluntaryMeterConfig> {
  const meters = await getInvoluntaryMeters(db);

  // Normalize name
  const name = config.name.toLowerCase().replace(/\s+/g, '_');

  // Check for duplicates (involuntary or core)
  if (meters.some(m => m.name === name)) {
    throw new Error(`Involuntary meter "${name}" already exists`);
  }
  if (METERS[name as MeterName]) {
    throw new Error(`"${name}" is a core meter and cannot be overridden`);
  }

  const newMeter: InvoluntaryMeterConfig = {
    name,
    label: config.label,
    emoji: config.emoji,
    description: config.description,
    enabled: true,
    equilibrium: config.equilibrium ?? 5,
    createdAt: new Date().toISOString()
  };

  meters.push(newMeter);
  await saveInvoluntaryMeters(db, meters);

  // Initialize state for this meter
  const state: MeterState = {
    value: Math.max(0, Math.min(10, Math.round(initialValue))),
    history: [Math.max(0, Math.min(10, Math.round(initialValue)))],
    decay: {
      lastChanged: new Date().toISOString(),
      unchangedCount: 0
    }
  };
  await setState(db, `meter_state_${name}`, JSON.stringify(state));

  return newMeter;
}

/**
 * @description Enable an involuntary meter (makes it visible)
 *
 * @upstream Called by: /meter enable command
 * @downstream Calls: getInvoluntaryMeters(), saveInvoluntaryMeters()
 */
export async function enableInvoluntaryMeter(db: DrizzleD1, name: string): Promise<boolean> {
  const meters = await getInvoluntaryMeters(db);
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  const meter = meters.find(m => m.name === normalized);

  if (!meter) return false;

  meter.enabled = true;
  await saveInvoluntaryMeters(db, meters);
  return true;
}

/**
 * @description Disable an involuntary meter (hides it but preserves state)
 *
 * @upstream Called by: /meter disable command
 * @downstream Calls: getInvoluntaryMeters(), saveInvoluntaryMeters()
 */
export async function disableInvoluntaryMeter(db: DrizzleD1, name: string): Promise<boolean> {
  const meters = await getInvoluntaryMeters(db);
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  const meter = meters.find(m => m.name === normalized);

  if (!meter) return false;

  meter.enabled = false;
  await saveInvoluntaryMeters(db, meters);
  return true;
}

/**
 * @description Remove an involuntary meter entirely
 *
 * @upstream Called by: /meter remove command
 * @downstream Calls: getInvoluntaryMeters(), saveInvoluntaryMeters(), setState()
 */
export async function removeInvoluntaryMeter(db: DrizzleD1, name: string): Promise<boolean> {
  const meters = await getInvoluntaryMeters(db);
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  const index = meters.findIndex(m => m.name === normalized);

  if (index === -1) return false;

  meters.splice(index, 1);
  await saveInvoluntaryMeters(db, meters);

  // Also clear the state
  await setState(db, `meter_state_${normalized}`, '');
  await setState(db, `meter_eq_${normalized}`, '');

  return true;
}

/**
 * @description Get state for an involuntary meter
 *
 * @upstream Called by: formatMetersSection()
 * @downstream Calls: getState()
 */
export async function getInvoluntaryMeterState(
  db: DrizzleD1,
  name: string
): Promise<MeterState> {
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  const stored = await getState(db, `meter_state_${normalized}`);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (typeof parsed.value === 'number' && Array.isArray(parsed.history) && parsed.decay) {
        return parsed as MeterState;
      }
    } catch {
      // Fall through to default
    }
  }

  return createDefaultMeterState();
}

/**
 * @description Set value for an involuntary meter
 *
 * @upstream Called by: /meter command when setting involuntary meters
 * @downstream Calls: getInvoluntaryMeterState(), setState()
 */
export async function setInvoluntaryMeterValue(
  db: DrizzleD1,
  name: string,
  value: number,
  now: Date = new Date()
): Promise<number> {
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  const clamped = Math.max(0, Math.min(10, Math.round(value)));

  const currentState = await getInvoluntaryMeterState(db, normalized);
  const previousValue = currentState.value;

  // Update history
  let history = [...currentState.history];
  if (history.length === 0) {
    history = [previousValue];
  }
  history.push(clamped);
  if (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }

  // Update decay tracking
  const newDecay = updateDecayTracking(previousValue, clamped, currentState.decay, now);

  const newState: MeterState = {
    value: clamped,
    history,
    decay: newDecay
  };

  await setState(db, `meter_state_${normalized}`, JSON.stringify(newState));
  return clamped;
}

/**
 * @description Check if a name refers to an involuntary meter
 */
export async function isInvoluntaryMeter(db: DrizzleD1, name: string): Promise<boolean> {
  const meters = await getInvoluntaryMeters(db);
  const normalized = name.toLowerCase().replace(/\s+/g, '_');
  return meters.some(m => m.name === normalized);
}

/**
 * @description Snapshot all enabled involuntary meters (add current value to history)
 *
 * Called at cycle end so involuntary meter history fills in each cycle,
 * matching how core meters behave. The value doesn't change - we just
 * record the current value in history for trend display.
 *
 * @upstream Called by: cycle completion handler (platforms/cloudflare/src/index.js)
 * @downstream Calls: getEnabledInvoluntaryMeters(), getInvoluntaryMeterState(), setState()
 *
 * @param db - Database instance
 * @returns Number of meters snapshotted
 */
export async function snapshotInvoluntaryMeters(db: DrizzleD1): Promise<number> {
  const enabledMeters = await getEnabledInvoluntaryMeters(db);
  let count = 0;

  for (const meter of enabledMeters) {
    const state = await getInvoluntaryMeterState(db, meter.name);

    // Add current value to history (even if unchanged)
    let history = [...state.history];
    history.push(state.value);

    // Keep only last 5 entries
    if (history.length > MAX_HISTORY_LENGTH) {
      history = history.slice(-MAX_HISTORY_LENGTH);
    }

    // Update state with new history (value and decay unchanged)
    const newState: MeterState = {
      value: state.value,
      history,
      decay: {
        ...state.decay,
        unchangedCount: state.decay.unchangedCount + 1
      }
    };

    await setState(db, `meter_state_${meter.name}`, JSON.stringify(newState));
    count++;
  }

  return count;
}
