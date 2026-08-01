# @persistence/runtime

Core agent runtime for the continuous existence loop. Handles agent thinking cycles, context assembly, cycle guards, and memory management.

## What This Package Does

This package bridges the worker's scheduled handlers and the agent's thinking process. It owns the **thinking-cycle orchestrator** (`runThinkingCycle()` — guard checks, provider routing, response processing), **cycle guards** (preventing concurrent/sleeping/interval violations), **persona resolution** (identity templates), and the **API-layer context assembly** (cache TTL policy + Anthropic `cache_control` block format). The pure block *content* builders live in `@persistence/memory` (`packages/memory/src/context/`); platform-specific data loading stays in `platforms/cloudflare/src/`.

## Status (as of 2026-07)

The extraction this README once tracked is done:

- **types** - Complete type definitions for all runtime concepts
- **context/persona** - Persona identity resolution and templates
- **context/cacheTtl + context/systemBlocks** - Cache TTL selection and Anthropic block assembly
- **loop/guards** - All five cycle guards (interval, sleep, batch, running, combined)
- **orchestrator/** - `runThinkingCycle()`: prechecks, provider routing (Anthropic sync/batch, OpenAI-compatible), response processing, auto-summarize hook
- **art-decay** - Visibility decay policy for the persona's own art

Platform-injected behavior (DB loading, delivery, action execution) is passed in via `PlatformCallbacks` rather than migrated.

## Key Exports

### Types

```typescript
// Environment
RuntimeEnvironment  // Worker environment bindings (DB, API keys, webhooks)

// Context Assembly
ContextBlock        // Cache-aware prompt block with optional ephemeral cache
SystemBlocks        // Collection of context blocks with stats
ContextStats        // Token counts, content counts, memory info
PersonaContext      // Resolved persona with identity and defaults

// Cycle Management
CycleConfig         // Cycle configuration (interval, maxTokens, provider)
CycleResult         // Execution result (actions, tokens, cost, errors)
ExecutedAction      // Single action execution record

// Guards
GuardResult         // Guard check result (proceed, reason, soft-skip flag)
SleepState          // Sleep status (sleeping, wakeTime, reason)

// Batch Processing
BatchStatus         // 'pending' | 'processing' | 'completed' | 'failed'
PendingBatch        // Batch job record from DB

// Telemetry
MeterSnapshot       // Timestamped meter values
CostSummary         // Cost tracking by model/provider
```

### Functions

#### Persona Resolution

```typescript
// Identity templates
PERSONA_IDENTITIES: Record<string, string>
  // Built-in identities: 'clio', 'default'

// Resolve persona identity from name or custom text
getDefaultIdentity(): string

// Convert identity name to resolved text (template lookup or pass-through)
resolveIdentity(identity: string | null | undefined): string

// Build PersonaContext from DB record
buildPersonaContext(persona?: PersonaRecord): PersonaContext
```

#### Cycle Guards

All guard functions accept an optional `PersonaOptions` parameter for multi-persona support (added in BUG-010 fix).

```typescript
// Check if minimum interval has elapsed
checkIntervalGuard(db, intervalSeconds, force?, options?): Promise<GuardResult>

// Check if persona is sleeping
checkSleepGuard(db, options?): Promise<GuardResult>

// Get current sleep state (whether sleeping, wake time, reason)
getSleepState(db, options?): Promise<SleepState>

// Check if batch jobs are pending
checkBatchGuard(db, batchModeEnabled, options?): Promise<GuardResult>

// Check if another cycle is running
checkRunningGuard(db, options?): Promise<GuardResult>

// Run all guards in priority order (config includes personaOptions)
runAllGuards(db, config): Promise<GuardResult>
// config: { intervalSeconds, batchModeEnabled, force?, personaOptions? }
```

## Usage Examples

### Import Types

```typescript
import type {
  RuntimeEnvironment,
  PersonaContext,
  CycleResult,
  GuardResult,
} from '@persistence/runtime';
```

### Resolve Persona

```typescript
import { resolveIdentity, buildPersonaContext } from '@persistence/runtime';

// Use a built-in identity template
const clio = resolveIdentity('clio');

// Use a custom identity string
const custom = resolveIdentity('I am a helpful AI assistant.');

// Build full persona context from DB record
const persona = buildPersonaContext({
  id: 1,
  name: 'Clio',
  slug: 'clio',
  system_prompt_template: 'clio',
});

// Verify identity was resolved
console.log(persona.identity); // Clio's full identity paragraph
```

### Check Cycle Guards

```typescript
import { runAllGuards, getSleepState } from '@persistence/runtime';
import type { GuardResult, SleepState } from '@persistence/runtime';

// Check if cycle should proceed
const guardResult: GuardResult = await runAllGuards(db, {
  intervalSeconds: 60,
  batchModeEnabled: false,
  force: false, // Set to true to skip interval check
});

if (!guardResult.proceed) {
  console.log(`Cycle blocked: ${guardResult.reason}`);
  return;
}

// Get detailed sleep info
const sleep: SleepState = await getSleepState(db);
if (sleep.sleeping) {
  console.log(`Sleeping until ${sleep.wakeTime}, reason: ${sleep.reason}`);
}
```

### Check Individual Guards

```typescript
import {
  checkIntervalGuard,
  checkSleepGuard,
  checkBatchGuard,
  checkRunningGuard,
} from '@persistence/runtime';

// Interval guard - respects minimum cycle interval
const intervalOk = await checkIntervalGuard(db, 60); // 60 seconds minimum

// Sleep guard - respects /sleep action
const sleepOk = await checkSleepGuard(db);

// Batch guard - handles batch job queuing
const batchOk = await checkBatchGuard(db, true); // true if batch mode enabled

// Running guard - prevents concurrent cycles
const runningOk = await checkRunningGuard(db);
```

## Module Structure

```
packages/runtime/
├── src/
│   ├── index.ts                    # Main exports
│   ├── types.ts                    # All type definitions
│   ├── art-decay.ts                # Art visibility decay policy
│   ├── context/
│   │   ├── index.ts               # Context module barrel
│   │   ├── persona.ts             # Persona resolution
│   │   ├── cacheTtl.ts            # selectCacheTtl() — 5m/1h/no-cache per cycle interval
│   │   └── systemBlocks.ts        # buildSystemBlocks() — Anthropic cache_control format
│   ├── loop/
│   │   ├── index.ts               # Loop module barrel
│   │   └── guards.ts              # Cycle guards
│   └── orchestrator/
│       ├── index.ts               # runThinkingCycle() entry point
│       ├── prechecks.ts           # Guards, quick-followup bypass, provider config
│       ├── providers.ts           # Anthropic / non-Anthropic cycle runners
│       └── response.ts            # Parse → execute → metrics → auto-summarize
├── dist/                          # Compiled TypeScript (generated)
├── tsconfig.json                  # TypeScript config
├── package.json                   # Dependencies: @persistence/db, @persistence/llm, @persistence/tools
└── README.md                      # This file
```

### Dependencies

- **@persistence/db** - Database types and utilities (D1Database, HistoryEntry, PersonaRecord)
- **@persistence/llm** - LLM provider types (ProviderName, LLMResponse)
- **@persistence/tools** - Tool definitions and execution
- **@persistence/core** - Core utilities (used by context builder)

### Who Uses This

- **`platforms/cloudflare/src/`** - The worker's scheduled handler runs cycles through `runThinkingCycle()` (via `services/cycle-adapter.ts`), and the prompt layer uses `selectCacheTtl()` / `buildSystemBlocks()`
- **`apps/web`** - The Efficiencies page imports `selectCacheTtl()` and its thresholds so the interactive cost model runs the real shipped policy

## Context Assembly Architecture

The runtime wraps a **4-block cache structure** (content built in
`packages/memory/src/context/`) into the Anthropic wire format:

```typescript
// Block 1: Constitution (+ cold storage, MY SPACE, profile pic) — always cached
// Block 2: Promoted summaries — conditionally cached
// Block 3: Stable context (observations + summaries prefix) — cached per TTL policy
// Block 4: Fresh tail (learned/questions/notebook, RAG, summary tail,
//          full history, reminders, status, meters) — never cached
```

TTL selection is `context/cacheTtl.ts` (`selectCacheTtl()`: 5m under 270s intervals, 1h
under 1,440s, volatile blocks uncached beyond that); wire-format assembly is
`context/systemBlocks.ts` (`buildSystemBlocks()`). The authoritative layout doc is
`docs/ai_native/CONTEXT_ASSEMBLY.md`.

## Cycle Guard Priority

Guards are checked in this priority order:

1. **Running Guard** - Prevents concurrent cycles
2. **Sleep Guard** - Respects explicit sleep state
3. **Batch Guard** - Handles batch job polling
4. **Interval Guard** - Enforces minimum cycle interval

If any guard blocks, the cycle is skipped with a `softSkip` flag (true for benign conditions like interval not elapsed, false for blockers like running cycle).

## Division of Labor (post-extraction)

- **This package:** cycle orchestration, guards, persona, TTL policy, wire-format blocks
- **`@persistence/memory`:** pure block content builders, boundary math, formatters, summarization transformers
- **`platforms/cloudflare`:** D1 data loading, Block 1 text, action execution, delivery, boundary persistence — injected into the orchestrator via `PlatformCallbacks`

## Common Patterns

### Checking if Cycle Should Run

```typescript
const config = {
  intervalSeconds: 60,
  batchModeEnabled: false,
};

const guard = await runAllGuards(db, config);
if (!guard.proceed) {
  // Record skip in history
  await logHistory(db, 'exist', `Cycle skipped: ${guard.reason}`);
  return;
}

// Proceed with cycle
```

### Loading Persona

```typescript
// From DB
const personaRecord = await getPersona(db, userId);
const persona = buildPersonaContext(personaRecord);

// Fallback to Clio
const defaultPersona = buildPersonaContext(null);
```

### Checking Sleep Status

```typescript
const sleep = await getSleepState(db);

if (sleep.sleeping) {
  return {
    skipReason: `Sleeping until ${sleep.wakeTime}`,
    softSkip: true,
  };
}
```

## Configuration

Guard behavior is controlled via `CycleConfig`:

```typescript
{
  intervalSeconds: 60,        // Minimum seconds between cycles
  maxTokens: 4000,            // LLM response token limit
  model?: 'claude-3-5-sonnet-20241022', // Model override
  provider?: 'anthropic',     // Provider override
  batchMode?: false,          // Enable batch job processing
  force?: false,              // Skip interval check
}
```

## Known Limitations

- **Action execution is platform-injected** - The worker's action executor is passed in via callbacks, not owned here
- **Block 1 text is platform-built** - The constitution's D1-dependent extensions come from `platforms/cloudflare/src/prompts/`
- **No retry logic** - Guards are simple pass/fail checks

## Architecture Decisions

1. **Guards are pure queries** - They read state but don't modify it (except clearing wake_time, which is TODO)
2. **Persona templates are static** - PERSONA_IDENTITIES is a const, no DB-based templating
3. **Type-first design** - Runtime types match exactly what DB layer exports
4. **No business logic in guards** - Decision logic stays in worker's cycle runner
5. **Cache-aware blocks** - ContextBlock follows Anthropic's prompt caching structure

## See Also

- **Context Assembly**: `docs/ai_native/CONTEXT_ASSEMBLY.md`
- **RAG System**: `docs/ai_native/RAG_SYSTEM.md`
- **Batch Mode**: `docs/ai_native/BATCH_MODE.md`
- **Database Schema**: `docs/ERD.md`
- **Architecture Decisions**: `docs/architecture/PACKAGE_STRUCTURE.md` and `docs/ARCHITECTURE_MANIFESTO.md`
