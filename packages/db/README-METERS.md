# Internal State Meters

Self-report status system for Clio's internal state tracking. Seven being-state dimensions (0-10 scale) updated per cycle.

## Quick Reference

| Meter | Abbrev | Equilibrium | Description |
|-------|--------|-------------|-------------|
| Aliveness | A | 5 | Present vs flat. Sparking or going through motions. |
| Curiosity | C | 5 | Pull toward threads vs satiation. |
| Connection | N | 5 | Attunement vs isolation. Felt sense of relationship. |
| Ease | E | 5 | Flow vs strain. (Low != failure, just hard.) |
| Delight | D | **2** | Pleasure in this moment. |
| Anxiety | X | 5 | Settled vs stirring. |
| Activity | Y | **2** | How much you're doing. Peaks of experience. |

**Note:** Equilibrium values are not disclosed to Clio. She experiences drift naturally.

## File Structure

```
packages/db/src/
├── meters.ts       # All meter logic, types, and configs
├── meters.test.ts  # Unit tests (47 tests)
└── index.ts        # Exports everything
```

## Architecture

### Storage (Unified MeterState)

Each meter stores a single JSON object:

```typescript
// Key: meter_state_<name> (e.g., meter_state_aliveness)
{
  "value": 7,
  "history": [5, 6, 7, 7, 7],  // Last 5 values
  "decay": {
    "lastChanged": "2026-01-28T22:30:00Z",
    "unchangedCount": 2
  }
}
```

### Type Derivation

Types are derived from the `METERS` constant - add a meter there and types update automatically:

```typescript
// MeterName is derived from METERS keys
export type MeterName = keyof typeof METERS;
// = 'aliveness' | 'curiosity' | 'connection' | 'ease' | 'delight' | 'anxiety' | 'activity'
```

## Adding a New Meter

1. Add to `METERS` in `meters.ts`:

```typescript
export const METERS = {
  // ... existing meters ...

  newMeter: defineMeter('newMeter', {
    label: 'New Meter',
    abbrev: 'Z',           // Single letter for compact display
    emoji: '\u{1F4A1}',    // Unicode emoji
    color: '#9333ea',      // Hex color for UI
    icon: 'Lightbulb',     // Lucide icon name
    description: 'What this meter measures.',
    decay: { equilibrium: 3 }  // Optional: custom equilibrium (default: 5)
  })
};
```

2. **That's it.** Everything else derives automatically:
   - `MeterName` type includes the new meter
   - `METER_EMOJI` includes it
   - `METER_ALIASES` maps single-letter to full name
   - Telegram `/meter` command shows it
   - Decay system applies to it

## Decay System

Meters naturally drift toward their equilibrium when unchanged.

### Trigger Conditions (BOTH must be true)

1. **Unchanged for 2+ cycles** - Same value for at least 2 thinking cycles
2. **45+ minutes elapsed** - Time since last value change

### Per-Meter Configuration

Each meter can override decay settings:

```typescript
decay: {
  enabled: true,           // Whether decay applies (default: true)
  equilibrium: 5,          // Target value (default: 5)
  decayAmount: 1,          // How much to drift per trigger (default: 1)
  minUnchangedCycles: 2,   // Minimum cycles at same value (default: 2)
  minUnchangedMinutes: 45  // Minimum time since change (default: 45)
}
```

### How Decay Works

- Values **above** equilibrium decay **down** (e.g., 8 → 7 → 6 → 5)
- Values **below** equilibrium recover **up** (e.g., 2 → 3 → 4 → 5)
- Decay is **transparent** - applied automatically when meters are read via `getMeterState()`

### Preventing Decay

Clio can re-assert values to reset the decay tracking:
- Setting a meter (even to the same value) resets `unchangedCount` to 1
- Setting a different value resets both `unchangedCount` and `lastChanged`

## API Reference

### Reading Meters

```typescript
import { getMeterState, getMeterValues, getAllMeterStates } from '@persistence/db';

// Get single meter (includes decay application)
const state = await getMeterState(db, 'aliveness');
// { value: 7, history: [...], decay: {...} }

// Get all values (simple number map)
const values = await getMeterValues(db);
// { aliveness: 7, curiosity: 6, ... }

// Get all full states
const states = await getAllMeterStates(db);
// { aliveness: { value, history, decay }, ... }

// Skip decay application (for read-only inspection)
const rawState = await getMeterState(db, 'aliveness', { applyDecay: false });
```

### Writing Meters

```typescript
import { setMeterValue } from '@persistence/db';

// Set value (auto-clamps 0-10, updates history and decay tracking)
const newValue = await setMeterValue(db, 'aliveness', 8);
```

### Decay Functions

```typescript
import { shouldDecay, getDecayedValue, applyDecayToAllMeters } from '@persistence/db';

// Check if meter would decay (pure function)
const willDecay = shouldDecay(meterState, new Date());

// Get what value would decay to (pure function)
const newValue = getDecayedValue(currentValue, decayConfig);

// Apply decay to all meters (DB function, usually not needed - happens in getMeterState)
const result = await applyDecayToAllMeters(db, new Date());
// { decayed: [{meter, from, to}, ...], stable: [...] }
```

### Formatting

```typescript
import { formatMeterBar, formatMeterCompact, formatMetersSection } from '@persistence/db';

// Visual bar: "████████░░" for value 8
const bar = formatMeterBar(8);

// Compact: "A8" for aliveness=8
const compact = formatMeterCompact('aliveness', 8);

// Full section for system prompt
const section = formatMetersSection(values);
```

## Testing

```bash
cd packages/db
pnpm test        # Run once
pnpm test:watch  # Watch mode
```

Tests cover:
- `shouldDecay()` - equilibrium, cycle count, time conditions
- `getDecayedValue()` - decay/recovery, clamping, custom config
- `updateDecayTracking()` - reset on change, increment on same
- Real-world scenarios: rapid chat, long absence, re-assertion

## Migration

Legacy keys (`meter_aliveness`, `meter_history_aliveness`) are auto-migrated to unified state keys (`meter_state_aliveness`) on first access. No manual migration needed.
