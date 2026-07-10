# @persistence/db

Database layer providing persona-aware CRUD operations, migrations, and D1 bindings for all tables in the Persistent Claude system.

This package is the single source of truth for database interactions. All platform-specific code (Cloudflare Workers, etc.) imports from here rather than writing raw SQL. Think of it as the "models and migrations" layer that abstracts away D1 implementation details.

## Status

**Fully Migrated:** 15 modules (personas, state, history, history-logger, cycles, migrations/runtime, llm-storage [cold-storage, notebook, observations, learned, questions, reminders], branches, summaries, meters, pinned, fork)

**Pending Migration:** 4 modules still live in `platforms/cloudflare/src/db/` (platform-specific features):
- batches, glossary, sim, voiceTranscriptions

**Recently Migrated:** pinned.ts, forkPersona (now in personas.ts)

## Key Exports

All functions are persona-aware (automatically scoped to the active persona) and work with Cloudflare D1 database bindings.

### Persona Abstraction (Core Layer)

The foundation for multi-persona database isolation. All other functions build on these primitives.

| Export | Purpose |
|--------|---------|
| `getActivePersonaId(db)` | Get the currently active persona ID from config table |
| `setActivePersonaId(db, id)` | Switch active persona |
| `getPersona(db, id)` | Fetch persona metadata (name, slug, system_prompt_template, etc.) |
| `listPersonas(db)` | List all personas with stats |
| `personaAll(db, sql, values, options?)` | Execute query scoped to active persona, returns multiple rows |
| `personaFirst(db, sql, values, options?)` | Execute query scoped to active persona, returns first row or null |
| `personaRun(db, sql, values, options?)` | Execute INSERT/UPDATE/DELETE scoped to active persona |
| `insertWithPersona(db, table, columns, values, options?)` | Insert row with persona_id automatically added |
| `forkPersona(db, options)` | Clone a persona with all its data (history, summaries, etc.) |
| `scopeSqlToPersona(sql)` | Add persona_id WHERE clause to SQL |
| `resetPersonaCache()` | Clear cached persona ID (for testing/reset) |

### State Table

Key-value store for runtime configuration (loop_count, is_running, cycle_interval_seconds, model, etc.)

| Export | Purpose |
|--------|---------|
| `getState(db, key)` | Get value by key |
| `setState(db, key, value)` | Set or update value with auto-timestamp |

### History Table

Chronological conversation timeline (all thoughts, messages, actions, events).

| Export | Purpose |
|--------|---------|
| `getHistory(db, limit?, options?)` | Get history entries in chronological order (oldest first) |
| `addHistory(db, entry)` | Add new history entry |
| `deleteOldestHistory(db, count)` | Remove oldest entries (for maintenance) |
| `deleteHistoryByIds(db, ids)` | Delete specific entries by ID list |
| `getHistoryForContext(db, limit?)` | Get entries for context building (DESC order) |
| `getOldestHistory(db, limit?)` | Get oldest entries |
| `getHistoryCount(db)` | Total entry count |

**History Entry Fields:**
```typescript
interface HistoryEntry {
  id: number;
  persona_id: number;
  type: string;  // See HISTORY_TYPES below
  content: string;
  internal: string | null;
  cycle_id: number | null;
  meter_snapshot: string | null;  // JSON snapshot of Clio's internal state
  created_at: string;
  summarized_at: string | null;
  blurred: number;  // 0 or 1
  vaulted: number;  // 0 or 1
}
```

### History Logger (High-level API)

Type-safe history logging with validation, error handling, and batch support. **This is the recommended API** for action handlers and tool executors.

| Export | Purpose |
|--------|---------|
| `logHistory(params)` | Log single history entry with type validation |
| `logHistoryBatch(params)` | Log multiple related entries at once |
| `logOperationResult(params)` | Helper for operation success/failure |
| `HISTORY_TYPES` | Enum of valid types |

**Valid History Types:**
```
thought, curiosity, remember, cold_storage, message_to_user,
user_message, search_query, search_result, art_request, art_result,
art_shared, user_art, user_video, note_saved, note_retrieved,
observation_saved, observation_retrieved, reminder_set, reminder_dismiss,
status_update, state_update, meter_override, learned_add, learned_update,
learned_cite, learned_promote, learned_delete, learned_list, question_add,
question_note, question_resolve, question_dissolve, question_list,
pin_update, exist, parse_error, sleep, user_status_update, summarize,
image, text, ephemeral
```

### Cycles Table

Execution ledger - tracks each thinking cycle's metrics, tokens, and costs.

| Export | Purpose |
|--------|---------|
| `createCycle(db, context)` | Create new cycle record at start of thinking cycle |
| `updateCycleMetrics(db, cycleId, metrics)` | Update with token counts and costs after completion |
| `markCycleError(db, cycleId, error)` | Mark cycle as failed with error message |
| `calculateCostCents(tokens, model, cacheMultiplier?)` | Calculate cost from token usage and pricing |

**Pricing included from @persistence/core:**
- Haiku: ~$1/MTok input, ~$4/MTok output
- Sonnet: ~$3/MTok input, ~$15/MTok output
- Opus: ~$5/MTok input, ~$15/MTok output
- Cache: 90% discount on cache reads, 25% cost on cache writes

### LLM Long-Term Storage

Three content tables where Claude saves persistent data. All are persona-scoped.

#### Cold Storage (Permanent Memories)

Facts important enough to survive summarization and always appear in context.

| Export | Purpose |
|--------|---------|
| `getColdStorage(db, options?)` | Get all permanent memories |
| `addColdStorage(db, entry)` | Save new permanent memory |

#### Notebook (Saved Notes)

User-facing notes that Claude can save and retrieve.

| Export | Purpose |
|--------|---------|
| `getNotebook(db, options?)` | Get all notebook entries (returns index + full content) |
| `getNotebookIndex(db, options?)` | Get notebook index only (titles, not content) |
| `getNote(db, id)` | Get single note by ID |
| `saveNote(db, note)` | Create or update note |
| `deleteNote(db, id)` | Delete note by ID |

#### Observations

Observations Claude has made about the user's behavior, preferences, etc.

| Export | Purpose |
|--------|---------|
| `getObservations(db, options?)` | Get active observations (excludes soft-deleted) |
| `getObservationIndex(db, options?)` | Get observation index only (titles, not content) |
| `getObservation(db, id)` | Get single observation by ID |
| `saveObservation(db, obs)` | Create or update observation |
| `deleteObservation(db, id)` | Soft-delete observation (sets deleted_at timestamp) |
| `getAllObservationsIncludingDeleted(db)` | Get all observations including deleted (for audit) |

#### Learned (Self-Knowledge)

Battle-tested realizations Claude has verified through experience. Tracks confidence levels and evidence.

| Export | Purpose |
|--------|---------|
| `getLearned(db, options?)` | Get active learned entries (excludes promoted) |
| `getAllLearned(db, options?)` | Get all learned entries including promoted |
| `addLearned(db, content, confidence?, supporting?)` | Add new learning with optional initial evidence |
| `updateLearned(db, id, updates)` | Update content or confidence level |
| `citeEvidence(db, id, type, evidence)` | Add supporting or challenging evidence |
| `markPromoted(db, id)` | Mark as promoted to cold storage |
| `deleteLearned(db, id)` | Soft-delete a learned entry |

**Confidence Levels:** `'emerging'` → `'stable'` → `'load-bearing'`

#### Questions (Open Curiosity)

Open threads Claude is curious about—held without pressure to resolve.

| Export | Purpose |
|--------|---------|
| `getQuestions(db, options?)` | Get all questions |
| `getActiveQuestions(db, options?)` | Get open/exploring questions only |
| `getAllQuestions(db, options?)` | Get all including resolved/dissolved |
| `addQuestion(db, content, domain?)` | Add new question |
| `addNote(db, id, note, setExploring?)` | Add note to question, optionally set exploring |
| `resolveQuestion(db, id, resolvedInto?)` | Mark as resolved with optional insight |
| `dissolveQuestion(db, id, reason?)` | Mark as dissolved (stopped mattering) |
| `deleteQuestion(db, id)` | Soft-delete a question |

**Status:** `'open'` → `'exploring'` → `'resolved'` or `'dissolved'`
**Domains:** `'self'`, `'world'`, `'user'`, `'technical'`, `'creative'`

#### Reminders (Persistent Prompts)

Reminders that persist across thinking cycles, triggered by conditions.

| Export | Purpose |
|--------|---------|
| `getReminders(db, options?)` | Get active (non-dismissed) reminders |
| `getDueReminders(db, context?)` | Get reminders whose conditions are met |
| `getAllReminders(db, options?)` | Get all including dismissed |
| `addReminder(db, content, condition?)` | Add reminder with condition |
| `dismissReminder(db, id)` | Soft-dismiss by ID |
| `triggerReminder(db, id)` | Mark as triggered |
| `batchDismissReminders(db, ids)` | Dismiss multiple reminders |

**Conditions:** `'persistent'` (always), `'next_user_message'`, `'after:YYYY-MM-DD'`

### Branching System

Non-destructive memory manipulation through branches, overrides, and synthetic memories.

#### Branches

Different "views" of the memory timeline. Only one branch is active at a time.

| Export | Purpose |
|--------|---------|
| `getBranches(db, options?)` | List all branches |
| `getActiveBranch(db, options?)` | Get currently active branch |
| `getBranchByName(db, name)` | Get branch by slug name |
| `createBranch(db, name, description?, parent?)` | Create new branch (forked from parent if specified) |
| `activateBranch(db, name)` | Switch active branch |
| `deleteBranch(db, name)` | Delete branch and cleanup |
| `forkBranch(db, sourceName, newName)` | Fork branch with overrides/synthetics |

#### Overrides

Non-destructive edits to memories: exclude, edit, reorder.

| Export | Purpose |
|--------|---------|
| `getOverrides(db, branchId)` | Get all overrides for branch |
| `getOverridesForEntry(db, branchId, entryId)` | Get overrides for specific history entry |
| `excludeMemory(db, branchId, entryId)` | Hide memory from context without deleting |
| `includeMemory(db, branchId, entryId)` | Remove exclusion override |
| `editMemory(db, branchId, entryId, editData)` | Modify memory content (shadow original) |
| `reorderMemory(db, branchId, entryId, newPosition)` | Change memory sort order |
| `removeOverride(db, branchId, entryId, type)` | Remove specific override by type |
| `resetBranch(db, branchId)` | Clear all overrides (revert to canonical) |

#### Synthetic Memories

Injected memories that don't exist in canonical history.

| Export | Purpose |
|--------|---------|
| `getSyntheticMemories(db, branchId)` | Get all synthetic memories for branch |
| `addSyntheticMemory(db, branchId, memory)` | Create synthetic memory at position |
| `updateSyntheticMemory(db, id, updates)` | Update synthetic memory content/position |
| `deleteSyntheticMemory(db, id)` | Delete synthetic memory |

### Meters (Internal State)

Self-report status system for Clio's internal state tracking. Seven being-state dimensions (0-10 scale) updated per cycle.

**Two Meter Types:**
- **Core meters** (hardcoded in METERS constant): Clio can SET these in her response
- **Involuntary meters** (runtime-added): user-controlled, Clio can only READ

#### Core Meter Functions

| Export | Purpose |
|--------|---------|
| `getMeterValues(db)` | Get current values for all core meters |
| `setMeterValue(db, name, value)` | Set single meter value with history tracking |
| `setMeterValues(db, updates)` | Batch set multiple meters at once |
| `getMeterState(db, name)` | Get full state (value, history, decay tracking) |
| `getAllMeterStates(db)` | Get full state for all meters |
| `getMeterSnapshot(db)` | Get compact snapshot string (e.g., "A7 C6 N10") |
| `formatMetersSection(values, histories, involuntary?)` | Format for system prompt |

#### Decay System

Meters naturally drift toward equilibrium unless actively maintained. Decay triggers when: unchanged for 2+ cycles AND 45+ minutes.

| Export | Purpose |
|--------|---------|
| `shouldDecay(state, now, config?)` | Check if meter should decay |
| `getDecayedValue(value, config?)` | Calculate value after decay |
| `applyDecayToAllMeters(db, now?)` | Apply decay to all eligible meters |
| `getEquilibrium(db, name)` | Get equilibrium value (runtime or default) |
| `setEquilibrium(db, name, value)` | Override equilibrium at runtime |
| `resetEquilibrium(db, name)` | Reset to default equilibrium |

#### Involuntary Meters (User-Controlled)

Runtime-added meters that Clio can see but not control. Appear at TOP of her meter display.

| Export | Purpose |
|--------|---------|
| `getInvoluntaryMeters(db)` | Get all involuntary meter configs |
| `getEnabledInvoluntaryMeters(db)` | Get only enabled (visible) meters |
| `addInvoluntaryMeter(db, config, initialValue?)` | Add new involuntary meter |
| `enableInvoluntaryMeter(db, name)` | Make visible to Clio |
| `disableInvoluntaryMeter(db, name)` | Hide from Clio (preserves state) |
| `removeInvoluntaryMeter(db, name)` | Delete entirely |
| `getInvoluntaryMeterState(db, name)` | Get full state for involuntary meter |
| `setInvoluntaryMeterValue(db, name, value)` | Set involuntary meter value |
| `isInvoluntaryMeter(db, name)` | Check if name is an involuntary meter |
| `getInvoluntaryMeterDisplays(db)` | Get display data for formatMetersSection |

**Storage:**
- `meter_state_<name>` → Unified JSON state (value, history, decay tracking)
- `meter_eq_<name>` → Runtime equilibrium override (optional)
- `involuntary_meters` → JSON array of InvoluntaryMeterConfig

**Core Meter Names:** aliveness, curiosity, connection, ease, delight, anxiety, activity

**Aliases:** a=aliveness, c=curiosity, n=connection, e=ease, d=delight, x=anxiety, y=activity

### Summaries Table

Compressed batches of history entries. When history grows too large, older entries are compressed into summaries to preserve context while reducing token usage.

#### Three-Tier System (v25)

- **cached**: Pinned to stable context block (Anthropic cache-friendly)
- **tail**: Dynamic context, most recent summaries
- **archived**: Not in direct context, available via RAG

#### CRUD Operations

| Export | Purpose |
|--------|---------|
| `getSummaries(db, limit?, options?)` | Get summaries paginated |
| `getAllSummaries(db, options?)` | Get all summaries |
| `getSummaryById(db, id)` | Get single summary by ID |
| `addSummary(db, summary)` | Create new summary from history or other summaries |
| `archiveSummaries(db, ids, reason?)` | Bulk move summaries to archived tier |
| `updateSummaryEmbedding(db, id, embedding, vector?)` | Update embedding for RAG retrieval |
| `updateSummaryMetadata(db, id, metadata)` | Update summary metadata |

#### Retrieval Operations

| Export | Purpose |
|--------|---------|
| `getActiveSummaries(db)` | Get cached + tail summaries (for context) |
| `getContextSummaries(db)` | Get summaries eligible for current context block |
| `getBufferSummaries(db)` | Get summaries in rolling token window |
| `getActiveCount(db)` | Count of active (non-archived) summaries |
| `getPromotedSummaries(db)` | Get promoted/pinned summaries |

#### Tier Management

| Export | Purpose |
|--------|---------|
| `setSummaryTier(db, id, tier)` | Move summary to tier (cached/tail/archived) |
| `setSummaryTierPosition(db, id, tier, position)` | Move to tier at specific position |
| `moveSummary(db, id, tier, position?)` | Combined set + position operation |
| `promoteSummary(db, id)` | Move from tail to cached tier |
| `demoteSummary(db, id)` | Move from cached to tail tier |
| `activateSummary(db, id)` | Move from archived to tail tier |
| `archiveSummaryById(db, id)` | Move to archived tier |

#### Stats & Lifecycle

| Export | Purpose |
|--------|---------|
| `getSummaryStats(db)` | Get counts per tier and total tokens |
| `parseCoveredRangeStartDate(range)` | Parse covered_range (e.g., "20260101-20260107") |
| `setSummaryPosition(db, id, position)` | Set manual sort position |
| `batchSummaryPositions(db, updates)` | Batch update positions |
| `setCoveredStart(db, id, date)` | Set covered_start (ISO timestamp) |
| `backfillCoveredStart(db)` | Auto-fill missing covered_start values |

### Pinned Images (Image Wall + View Queue)

Curated 5-slot image wall and pending view images queue. Allows Clio to pin meaningful images and request to view past images.

#### Types

| Type | Purpose |
|------|---------|
| `PinnedImage` | Full pinned image data (slot, id, data, prompt) |
| `PinnedImageContext` | Lightweight for context (slot, id, title) |
| `PendingViewImage` | Image queued for viewing |
| `GallerySummary` | Gallery count and recent titles |
| `PinResult` | Result of pin/unpin operations |
| `SwapResult` | Result of swap operation |
| `ViewRequestResult` | Result of view request |
| `ClearViewedResult` | Result of clear operation |

#### Functions

| Export | Purpose |
|--------|---------|
| `normalizeId(value)` | Normalize string/number ID to integer |
| `getPinnedImages(db, options?)` | Get all pinned images with full data |
| `getPinnedImagesForContext(db, options?)` | Get pinned images for context (titles only) |
| `pinImage(db, slot, imageId, options?)` | Pin image to slot (1-5) |
| `unpinImage(db, slot, options?)` | Remove image from slot |
| `swapPinnedImages(db, slotA, slotB, options?)` | Swap images between slots |
| `requestViewImages(db, ids, cycleId?, options?)` | Queue images for viewing |
| `getPendingViewImages(db, options?)` | Get queued images |
| `clearViewedImages(db, options?)` | Clear viewed images queue |
| `markImagesViewed(db, ids, options?)` | Mark specific images viewed |
| `getGallerySummary(db, limit?, options?)` | Get gallery count and titles |

### Reminders Utilities

| Export | Purpose |
|--------|---------|
| `checkReminderDue(reminder, context?)` | Pure function to check if a reminder condition is met |

### Migrations

Cold-start table creation and schema updates.

| Export | Purpose |
|--------|---------|
| `ensureTablesExist(db)` | Create all tables if missing (safe to call multiple times) |
| `runRuntimeMigrations(db, migrations?)` | Apply pending migrations at startup |

## Usage Examples

### Basic State Management

```typescript
import { getState, setState } from '@persistence/db';

// Get a config value
const interval = await getState(db, 'cycle_interval_seconds');

// Set a config value (upserts automatically)
await setState(db, 'cycle_interval_seconds', '60');
```

### Logging History

```typescript
import { logHistory, HISTORY_TYPES } from '@persistence/db';

// Log a thought
await logHistory({
  db,
  type: HISTORY_TYPES.THOUGHT,
  content: 'I wonder what the user is thinking about right now',
  meterSnapshot: JSON.stringify({ A: 5, C: 3, N: 12 })
});

// Log an action result
await logHistory({
  db,
  type: HISTORY_TYPES.MESSAGE_TO_USER,
  content: 'Hey there, I had a thought...',
  internal: 'Sent via Telegram' // Optional metadata
});
```

### Batch Logging

```typescript
import { logHistoryBatch } from '@persistence/db';

await logHistoryBatch({
  db,
  entries: [
    { type: HISTORY_TYPES.SEARCH_QUERY, content: 'Claude' },
    { type: HISTORY_TYPES.SEARCH_RESULT, content: '[search results]' },
    { type: HISTORY_TYPES.MESSAGE_TO_USER, content: 'Found some interesting stuff...' }
  ]
});
```

### Managing Summaries

```typescript
import { getSummaries, setSummaryTier, moveSummary } from '@persistence/db';

// Get active summaries for context
const active = await getSummaries(db);

// Promote a summary to cached tier
await promoteSummary(db, summaryId);

// Move a summary to archived with position
await moveSummary(db, summaryId, 'archived', 100);
```

### Working with Branches

```typescript
import {
  getBranches,
  createBranch,
  activateBranch,
  excludeMemory,
  addSyntheticMemory
} from '@persistence/db/branches';

// Create a new branch
const branch = await createBranch(db, 'experiment-v2', 'Testing new approach');

// Switch to it
await activateBranch(db, 'experiment-v2');

// Exclude a memory from context
await excludeMemory(db, branch.id, historyEntryId);

// Add a synthetic memory
await addSyntheticMemory(db, branch.id, {
  memory_type: 'observation',
  content: 'This is what I think happened',
  position_timestamp: new Date().toISOString()
});
```

### Saving Notes

```typescript
import { saveNote, getNotebook } from '@persistence/db';

// Save a note
await saveNote(db, {
  title: 'Meeting Notes',
  content: 'Discussed project timeline',
  summary: 'Timeline discussion'
});

// Get all notebook entries
const notes = await getNotebook(db);
```

### Creating Cycles

```typescript
import { createCycle, updateCycleMetrics, calculateCostCents } from '@persistence/db';

// At start of thinking cycle
const cycleId = await createCycle(db, {
  model: 'claude-opus-4.5',
  trigger: 'cron',
  cycleInterval: 60,
  loopCount: 42
});

// At end of thinking cycle
await updateCycleMetrics(db, cycleId, {
  inputTokens: 5000,
  outputTokens: 800,
  cacheCreationTokens: 1000,
  cacheReadTokens: 2000,
  actionCount: 3,
  primaryAction: 'MESSAGE_USER'
});

// Calculate cost
const cost = calculateCostCents(
  { input_tokens: 5000, output_tokens: 800 },
  'claude-opus-4.5',
  0.9  // cache multiplier
);
console.log(`Cycle cost: $${(cost / 100).toFixed(4)}`);
```

## Module Structure

```
packages/db/src/
├── index.ts                    # Main barrel file with all exports
├── personas.ts                 # Multi-persona abstraction layer
├── state.ts                    # Key-value state table
├── history.ts                  # Conversation timeline
├── history-logger.ts           # Type-safe logging API
├── cycles.ts                   # Execution ledger
├── migrations/
│   └── runtime.ts              # Table creation and schema updates
├── llm-storage/
│   ├── index.ts                # Barrel file
│   ├── types.ts                # Shared types (Entry types, result types)
│   ├── cold-storage.ts         # Permanent memories
│   ├── notebook.ts             # Saved notes
│   ├── observations.ts         # Observations about the user
│   ├── learned.ts              # Self-knowledge with evidence tracking
│   ├── questions.ts            # Open curiosity threads
│   └── reminders.ts            # Persistent prompts
├── branches/
│   ├── index.ts                # Barrel file
│   ├── types.ts                # Shared types
│   ├── branches.ts             # Branch CRUD
│   ├── overrides.ts            # Memory exclusion/edit/reorder
│   └── synthetic.ts            # Injected memories
├── summaries/
│   ├── index.ts                # Barrel file
│   ├── crud.ts                 # Create/read/update/archive
│   ├── retrieval.ts            # Query by context/tier
│   ├── tiers.ts                # Tier management (cached/tail/archived)
│   ├── stats.ts                # Statistics
│   └── lifecycle.ts            # Position/coverage tracking
├── pinned.ts                   # Image wall and view queue (5 slots)
└── meters.ts                   # Meter state, history, decay
```

## Integration with Platforms

This package is consumed by:

1. **platforms/cloudflare/** - Worker routes, handlers, and context building
   - Uses: all CRUD functions, persona awareness, history logging
   - Example: `import { getHistory, logHistory } from '@persistence/db'`

2. **packages/memory/** - Summarization and RAG services
   - Uses: summaries CRUD, retrieval functions
   - Example: `import { addSummary, getActiveSummaries } from '@persistence/db'`

3. **packages/tools/** - Tool handlers and action executors
   - Uses: history-logger, state management
   - Example: `import { logHistory, HISTORY_TYPES } from '@persistence/db'`

4. **apps/web/** - Frontend API client
   - Uses: indirectly through worker routes
   - Worker routes call these functions to serve frontend requests

## Pending Migrations

The following modules are still in `platforms/cloudflare/src/db/` (platform-specific features):

| Module | Purpose | Status |
|--------|---------|--------|
| batches | Batch mode ledger | PENDING (platform-specific) |
| glossary | STT corrections | PENDING (platform-specific) |
| sim | Semantic identity monitor | PENDING (platform-specific) |
| voiceTranscriptions | Voice history and audio | PENDING (platform-specific) |

**Recently Migrated:**
- `pinned.ts` - Image wall and view queue (now exported from @persistence/db)
- `forkPersona()` - Moved to personas.ts (now exported from @persistence/db)
- `checkReminderDue()` - Pure reminder condition checker (now exported from @persistence/db)

Once migrated, remaining modules will be exported from `@persistence/db` alongside the existing modules.

## Important Notes

### Persona Scoping

All functions are automatically scoped to the active persona. If you need to query a specific persona, use the `PersonaOptions` parameter:

```typescript
// Query default/active persona
const history = await getHistory(db);

// Query specific persona
const history = await getHistory(db, 50, { personaId: 2 });

// Bypass persona scoping entirely (rarely needed)
const history = await getHistory(db, 50, { disableAutoScope: true });
```

### D1 Null Handling

D1 accepts `null` but **not** `undefined`. Always use null coalescing:

```typescript
// CORRECT
await setState(db, key, value ?? null);

// WRONG
await setState(db, key, value);  // undefined will fail silently
```

### Meter Snapshots

Every history entry can capture a meter snapshot (JSON string of Clio's internal state at that moment). The `logHistory` function accepts `meterSnapshot` as an optional parameter:

```typescript
const meterSnapshot = JSON.stringify({ A: 7, C: 6, N: 10, E: 8, D: 7 });
await logHistory({
  db,
  type: HISTORY_TYPES.THOUGHT,
  content: 'Thinking...',
  meterSnapshot
});
```

### Soft Deletes

The `user_observations` table uses soft delete (sets `deleted_at` timestamp) rather than hard delete. This preserves audit trails:

```typescript
// Regular delete (sets deleted_at)
await deleteObservation(db, obsId);

// Get all including soft-deleted (for audit/recovery)
const all = await getAllObservationsIncludingDeleted(db);
```

---

**Last Updated:** 2026-01-31
**Version:** 0.1.0
