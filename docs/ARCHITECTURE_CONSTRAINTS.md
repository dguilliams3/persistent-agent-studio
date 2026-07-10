# Architecture Constraints

> Hard rules that apply to all changes. Violations are bugs, not trade-offs.
> For project overview and task execution, see `CLAUDE.md`.

---

## System Identity

A persistent autonomous AI entity platform with research capabilities. Entities think on configurable cycles, maintain layered memory, develop autonomously, and are measured via the Semantic Identity Monitor (SIM). The system runs entirely on Cloudflare's edge — no local server required.

**Primary interface:** Mobile-first PWA (chat-first design)
**Secondary interfaces:** Telegram bot, React web dashboard
**Research function:** Track identity evolution through embedding space across personas

---

## Absolute Constraints

These are non-negotiable. Every change, every feature, every "quick fix" must respect them.

### 1. Cloudflare Only (Worker + D1 + R2)

The runtime is a Cloudflare Worker with cron trigger. All durable persistence goes through D1. Media storage uses R2. There is no local server, no tunnel, no laptop dependency. The system runs 24/7 on Cloudflare's edge even when every device is off.

**Exception:** `video-to-gif/` and `voice-prosody/` are Python Modal apps for media processing that Cloudflare Workers cannot perform (video transcoding, audio analysis). These are the only non-Cloudflare compute.

### 2. Anthropic API Key IS Required

Unlike the chief-of-staff system (which uses `claude --print`), this system calls the Anthropic API directly for entity thinking cycles. The API key is stored as a Cloudflare Worker secret. Batch API mode is used during off-hours for 50% cost savings.

### 3. TypeScript Strict Mode

All application code is TypeScript with `strict: true`. No `.js` files in `platforms/`, `packages/`, or `apps/`. The only JavaScript is generated build output.

**Exception:** `video-to-gif/` and `voice-prosody/` are Python.

### 4. Persona Data Isolation

All D1 queries that touch entity data MUST filter by `persona_id`. Use Drizzle query builder with explicit `.where(eq(table.personaId, personaId))` on every SELECT, UPDATE, and DELETE that touches a persona-scoped table. Get the active persona ID via `getActivePersonaId(db)` from `@persistence/db/persona-scope`. Never query history, memory, or SIM data without a persona scope. This is critical for research — cross-persona data leakage invalidates experiments.

@antipattern DO NOT use raw `db.prepare()` SQL — use the Drizzle query builder from `@persistence/db/client`.

#### Scoped Query Helpers

For queries that do NOT need a custom `personaId` override and use full-table selects, use the scoped query helpers from `@persistence/db/scoped-query`:

- `scopedSelect(db, table)` — wraps `db.select().from(table)` with automatic `persona_id` filter
- `scopedUpdate(db, table)` — wraps `db.update(table)` with automatic `persona_id` filter
- `scopedDelete(db, table)` — wraps `db.delete(table)` with automatic `persona_id` filter

Each helper calls `getActivePersonaId(db)` internally and ANDs the persona filter with any caller-provided `.where()` conditions.

**When to use scoped helpers:**
- Handler functions that always operate on the active persona (e.g., `handlers/gallery.ts`, `handlers/data/reads.ts`)
- Summary tier/lifecycle operations that don't need persona override
- Any new persona-scoped query without custom select fields

**When NOT to use scoped helpers (keep manual persona filtering):**
- Functions accepting `options.personaId` for fork/branch operations — scopedSelect cannot pass a custom persona ID
- Queries with custom select projections (e.g., `db.select({ count: sql\`count(*)\` })`) — scopedSelect always does `db.select().from(table)`
- INSERT operations — scoped helpers only cover SELECT, UPDATE, DELETE
- Raw SQL queries with subqueries (e.g., `deleteOldestHistory`)
- JOINs or complex query compositions
- Non-persona-scoped tables (config, personas, state, cycles, memoryBranches, memoryOverrides, syntheticMemories)

@antipattern DO NOT wrap functions that accept `options.personaId` in scopedSelect — the override pattern exists for fork operations and scopedSelect silently ignores it, causing data to read/write to the wrong persona.

### 5. Append-Only History

The `history` table is append-only. Entries are never edited or deleted. Summarization compresses but preserves — the `summarized_at` column marks entries as consumed by a summary, but the original entry remains. This ensures experimental reproducibility.

**Exception:** Memory branches can *exclude* entries from a persona's view without deleting them (the `memory_overrides` table).

### 6. Embedding Integrity

Embeddings use BGE-base-en-v1.5 (768-dim) via Cloudflare Workers AI (free). Once an embedding is computed and stored, it is never recomputed or overwritten. SIM metrics depend on embedding stability over time. If the embedding model changes, start a new persona — don't re-embed existing data.

---

## Code Size Limits

Line limits refer to **executable code only** — imports, logic, JSX/TSX, type definitions. Docstrings, comments, and documentation do NOT count.

### Worker (platforms/cloudflare/src/) — TARGET: <300 lines total

The platform layer should shrink to near-nothing as logic migrates to packages. Until then:

| File type | Code line limit | Typical range | Split signal |
|-----------|----------------|---------------|--------------|
| Worker entry (`index.ts`) | 100 lines | 30–60 | Env mapping + handler wiring only. All logic in packages. |
| Any remaining route/service/command files | 0 lines (target) | migrate to packages | If it exists here, it should be moving to a package |

### Packages (packages/*)

| File type | Code line limit | Typical range | Split signal |
|-----------|----------------|---------------|--------------|
| Package entry (`index.ts`) | 50 lines | 10–30 | Re-exports only. No logic in barrel files |
| Module file | 150 lines | 30–100 | One concern per file |
| Test file | 200 lines | 50–150 | One describe block per file is fine; split if testing unrelated concerns |

### Frontend (apps/web/)

| File type | Code line limit | Typical range | Split signal |
|-----------|----------------|---------------|--------------|
| React component (`.tsx`) | 100 lines | 25–80 | If JSX return exceeds 50 lines, decompose into child components |
| View (top-level page) | 150 lines | 40–100 | Views compose components. If logic is appearing here, extract it |
| Store slice | 100 lines | 30–70 | One slice per domain/concern |
| Hook | 80 lines | 15–50 | One hook per concern. Compose hooks, don't grow them |
| API client | 80 lines | 20–50 | Group by endpoint domain |
| Utility | 60 lines | 10–40 | One utility per file |

### Statement Limits (NOT Line Limits)

Limits are on **executable statements** — assignments, calls, returns, conditionals, loops, declarations. Docstrings, comments, blank lines, and import lines do NOT count. This codebase uses intentionally dense docstrings with ASCII diagrams, flow charts, and extensive @pattern/@antipattern tags. A function with 15 statements and 200 lines of documentation is a 15-statement function.

| Scope | Statement limit | Split signal |
|-------|----------------|--------------|
| Single function | 30 statements | If a function has >30 statements of logic, extract helper functions |
| Single file (code statements) | 150 statements | If a file has >150 statements, it's doing too many things. Split by concern |
| React component (JSX return) | 40 statements | If the JSX return block has >40 elements/expressions, decompose into child components |

**The 4,325-Line Rule (historical):** No file shall ever reach 4,325 lines again. This is a hard cap including documentation. But the SPIRIT of the rule is about statements, not lines — a 2,000-line file with 50 statements and 1,950 lines of documentation is fine. A 500-line file with 400 statements is not.

---

## Structural Rules

### Platform Minimization (PRIORITY — Complete the Strangler Fig)

**Target state:** `platforms/cloudflare/` is a <300 line Worker entry point that does exactly three things:
1. Maps Cloudflare `env` bindings to a platform-agnostic `RuntimeEnv` interface defined in `packages/core`
2. Exports `fetch` and `scheduled` handlers
3. Wires packages together

**Everything else moves to packages.** Routing, telegram commands, tools, voice, SIM routes, services — all of it. The only genuinely Cloudflare-specific code is the `env` binding map (`env.DB` → `runtime.db`, `env.ANTHROPIC_API_KEY` → `runtime.anthropicApiKey`). Everything downstream uses the package-defined `RuntimeEnv`, not Cloudflare types.

```typescript
// packages/core/src/types.ts — platform-agnostic runtime interface
interface RuntimeEnv {
  db: D1Database;
  bucket: R2Bucket;
  anthropicApiKey: string;
  telegramBotToken: string;
  adminPassword: string;
  // ...
}

// platforms/cloudflare/src/index.ts — the ENTIRE platform layer
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const runtime: RuntimeEnv = {
      db: env.DB,
      bucket: env.BUCKET,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      // ...
    };
    return handleRequest(request, runtime, ctx);  // handleRequest lives in packages
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const runtime: RuntimeEnv = { /* same map */ };
    return handleScheduled(runtime, ctx);  // handleScheduled lives in packages
  }
};
```

**Why this matters:**
- Routing is just URL pattern matching — not Cloudflare-specific
- Secrets are just strings — platform provides them, packages consume them
- Every line in `platforms/` is a line that can't be tested without Cloudflare's runtime
- Every line in `packages/` is a line that can run anywhere with a compatible `RuntimeEnv`

**Current state:** ~45 telegram command files, routes, services, and tools remain in `platforms/cloudflare/src/`. These need to complete migration to packages with types co-located in their domain.

### Package Boundaries

- Packages depend downward: `services` → `tools` → `memory` → `llm` → `db` → `core`
- No circular dependencies between packages
- No package may import from `platforms/` — packages are platform-agnostic
- `platforms/cloudflare/` imports from packages, never the reverse

### Frontend Structure

- **Chat is the primary view.** The app opens to conversation. Everything else is secondary.
- Components follow three tiers: `views/` (full pages), `components/` (composed, stateful), `ui/` (pure presentational)
- Store slices are per-concern, not per-view
- API calls live in the store, not in components

### Apps are Peers, Not Embedded Strings

Each frontend gets its own directory under `apps/` with its own build step:

```
apps/
├── web/          ← React PWA (primary interface)
```

**Frontends are not string literals inside Worker files.** They live under `apps/`, have their own components and build steps, and import shared data functions from packages via `@persistence/*` path aliases.

**Do NOT** embed frontend code as template literal strings in backend files. If it has HTML/CSS/JS, it's an app with a build step.

### Breaking Code Is Free — Breaking Data Requires Migration

Code can be restructured, renamed, moved, deleted freely. Redeploy and the new code runs.

Data changes (database schema, column renames, field semantics) require migration plans because existing data is in the OLD shape. A persona's history entries, cold storage memories, SIM embeddings — these survive redeployments and must remain queryable.

**Before any schema change:**
1. Write a migration SQL (ALTER TABLE, new column, data copy)
2. Document in TASK_LOG what data is affected
3. Test migration against a copy if possible
4. Never DROP a column with research data without the user's explicit approval

### Identity Context Is Database-Stored, Not Hardcoded

Persona identity context (biography, background, relationship framing) lives in the `system_context` column of the personas table, NOT in a TypeScript constant file.

**Why:** Hardcoded context means every persona gets the same biography. DB-stored context means each persona has its own identity. An agent asked "add a new persona" discovers all persona data through the same DB path.

**`context.ts` must be deleted** once the migration is complete.

### SIM (on-demand, upsert — not per-cycle/append-only)

Basin metrics + concept axes are computed **on-demand** (POST /sim/basin/compute and axis/score endpoints), **not** automatically per thinking cycle. Storage uses UPSERT (ON CONFLICT DO UPDATE on sim_basin_metrics / sim_axis_scores), **not** append-only INSERT.

**Verified reality (packages/memory/src/sim/{routes,compute,index}.ts + registry.ts):**
- Routes register manual endpoints only.
- computeBasinMetrics / upsertBasinMetrics are called from handlers.
- No calls inside runtime/orchestrator for automatic per-cycle.
- schema-complete for axes/scores but currently inert in places (no auto-embed on axis create; some upsert paths have zero callers).

See packages/memory/README.md for the real exported surface and honest gaps.

### Route Registry — Data-Driven, No Conditional Chains

The route registry is a **data structure** (a map of URL patterns to handler references), not a conditional chain. A generic dispatcher traverses the map.

```typescript
// BANNED — 2,000-line if/elseif chain
if (path === '/history' && method === 'GET') { return handleGetHistory(context); }
if (path === '/state' && method === 'GET') { return handleGetState(context); }
if (path === '/state' && method === 'POST') { return handleSetState(context); }
// ... 100 more

// REQUIRED — declarative route map + generic dispatcher
const routes: RouteMap = {
  'GET /history': handleGetHistory,
  'GET /state/:key': handleGetState,
  'POST /state': handleSetState,
  'GET /sim/axes': handleGetAxes,
  'POST /sim/axes': handleCreateAxis,
};

// One generic function dispatches ALL routes
function dispatch(request: Request, routes: RouteMap, context: RouteContext): Response {
  const handler = matchRoute(request.method, url.pathname, routes);
  const result = await handler(context);
  return formatResponse(result);
}
```

**Route handlers are HTTP translation only:**
1. Parse HTTP inputs (URL params, body) into typed arguments
2. Call a domain function from packages
3. Format the domain result into an HTTP response

No business logic in handlers. No database queries. No conditional branching. Parse → call → format.

### Import Discipline — Path Aliases Only

**No relative imports beyond one parent (`../`).** Use path aliases for all cross-directory imports.

```typescript
// BANNED — fragile, unreadable, agents can't tell where it goes
import { getHistory } from '../../../packages/db/src/history';
import { PersonaRecord } from '../../core/types';

// REQUIRED — self-documenting, refactor-safe
import { getHistory } from '@persistence/db';
import type { PersonaRecord } from '@persistence/core';
import { Button } from '@/components/ui';
```

- `packages/` use workspace names: `@persistence/db`, `@persistence/core`, `@persistence/memory`
- `apps/web/` uses `@/` path alias for cross-directory imports
- `platforms/cloudflare/` imports packages by workspace name
- Same-directory relative imports (`./sibling`) are fine
- One level up (`../adjacent`) is acceptable within a package
- **Two or more levels up (`../../`) is BANNED** — use a path alias or the file is in the wrong place

### Descriptive Variable Names — No Abbreviations

Variable names are the cheapest documentation and the highest-leverage disambiguation tool for agents. An agent reading `summarizationConfig` knows instantly what it is. An agent reading `sumCfg` has to infer.

**Rule:** If the full word fits, use the full word. Always.

**But: descriptive of the ABSTRACTION, not the INSTANCE.** Names describe the architectural role, not today's domain data. The code should survive a persona swap, a platform swap, a use-case swap without renaming anything.

```typescript
// OVER-SPECIFIC — married to current usage
const clioMemories = getColdStorage();
const telegramChatId = getRecipient();
const lutronMaterials = getAnalysisTargets();

// RIGHT — describes the role, not the instance
const permanentMemories = getColdStorage();
const messagingRecipientId = getRecipient();
const analysisTargets = getAnalysisTargets();
```

```typescript
// BANNED
for (const k of v) { const r = process(k, cfg); }
let pId = getPersonaId();
const res = await fetch(url);
const cb = () => handleClick();

// REQUIRED
for (const material of materialsToAnalyze) { const analysisResult = process(material, analysisConfiguration); }
let personaId = getPersonaId();
const response = await fetch(requestUrl);
const handleClickCallback = () => handleClick();
```

**Acceptable abbreviations** (universally unambiguous, single meaning):
`db`, `id`, `url`, `api`, `html`, `css`, `js`, `ts`, `ui`, `env`

**Everything else is spelled out.** `configuration` not `cfg`. `response` not `res`. `request` not `req`. `parameters` not `params`. `callback` not `cb`. `index` not `idx`. `count` not `cnt`. `message` not `msg`. `context` not `ctx`. `image` not `img`. `telegram` not `tlgm`.

**Library imports exception (NO ALIASES supersedes NO ABBREVIATIONS):** If a library exports an abbreviated name (`ctx` from Hono, `eq` from Drizzle, `db` from a client), use it as-is. Do NOT alias library names (`ctx as context`, `eq as equals`) — that creates confusion when agents read library documentation and violates the no-shims/no-backwards-compat rule. The no-abbreviation rule applies to OUR variable names, not to names imposed by dependencies. When in conflict, no-alias wins.

**Target: 0% code duplication.** artemis-agents achieves 0.0% Python duplication across 40K lines of agent-produced code. That's the proof that when naming, structure, and conventions are right, agents don't produce duplication because there's never ambiguity about where something already exists.

### One Type Per File

Each type definition gets its own file, named after the type. No `types.ts` dumping grounds with 15 interfaces.

```
packages/memory/src/types/
├── Summary.ts
├── MetaSummary.ts
├── BasinMetrics.ts
├── ConceptAxis.ts
└── index.ts            ← barrel re-export for clean imports

packages/core/src/types/
├── PersonaConfig.ts
├── RuntimeEnv.ts       ← (or stays at core/src/runtime-env.ts — own file either way)
├── MeterConfig.ts
└── index.ts
```

**Why:** The filename IS the documentation. An agent looking for `Summary` sees `Summary.ts` in the file tree. No opening a 200-line file and searching. Adding a type = adding a file. Deleting a type = deleting a file.

**Barrel files** (`index.ts`) re-export everything for clean consumer imports. Consumers import from `@persistence/memory` — they don't need to know the internal file structure.

### Composable Types — No Primitive Bags

Types are built by composing other types, not by repeating primitive fields. Each type is a meaningful concept that other types reference as a building block.

```typescript
// BANNED — flat bag of primitives, fields repeated across types
interface Action {
  type: string;
  toolName: string;
  toolQuery: string;
  resultContent: string;
  resultSuccess: boolean;
  personaId: number;
  personaName: string;
  cycleId: number;
}

// REQUIRED — types compose other types
interface Action {
  type: ActionType;          // enum/union, not bare string
  toolCall: ToolCall;        // a composed type
  cycle: CycleReference;    // reusable across many contexts
  persona: PersonaReference; // defined once, used everywhere
}

interface ToolCall {
  tool: Tool;
  parameters: ToolParameters;
  result: ToolResult;
}
```

**The principle:** If you see `personaId: number` and `personaName: string` appearing together in more than one type, extract `PersonaReference` and compose it. Types reference types. Only the LEAF types contain primitives.

**One concept per directory** for complex types (the Tool pattern):
```
packages/tools/src/definitions/search/
├── handler.ts       ← the function itself
├── schema.ts        ← JSON schema for LLM tool calling
├── params.ts        ← TypeScript param interface
├── hints.ts         ← error recovery text for the entity
├── help.ts          ← human-facing help text
└── index.ts         ← barrel
```

Everything about `search` lives in `search/`. The directory IS the concept.

### Events Architecture — History Entries Are Events

Everything in the history table is an **Event**. Each event type is a self-contained file with its own metadata (key, icon, label, category). No central map. Adding a new event type = adding a file.

**Two sources of events:**
1. **Tool events** — produced by Tools (think, search, art, sleep, etc.). Event metadata PULLS from the Tool definition — don't redefine what the Tool already owns.
2. **System events** — not tool-produced (user_message, parse_error, status_update, meter_override). Own their metadata directly.

```
packages/core/src/events/
├── EventDefinition.ts          ← base interface { key, icon, label, category }
├── EventCategory.ts            ← union type for categories
├── tool-events/
│   ├── ThoughtEvent.ts         ← pulls icon/label/category from ThinkTool
│   ├── SearchQueryEvent.ts     ← pulls from SearchTool
│   └── ...
├── system-events/
│   ├── UserMessageEvent.ts
│   ├── ParseErrorEvent.ts
│   └── ...
└── index.ts                    ← barrel, auto-assembles registry from all events
```

**Suffix convention:** `*Event.ts` for events, `*Tool.ts` for tools (if renamed). No ambiguity between `SearchQueryEvent.ts` and the Search tool.

**HistoryEntry references an Event, not a raw string.** The `type` field in the database is a string key. The TypeScript type maps it to a rich EventDefinition with icon, label, and category as attributes — not a parallel lookup map.

### Domain Ownership — Types Match the Domain, Not the Implementation

Types live with their domain. The domain is **what things ARE**, not which client or handler happens to use them.

```
// WRONG — type defined where it's consumed
packages/services/src/messaging/telegram/Photo.ts    ← Telegram doesn't own what a Photo IS
packages/tools/src/definitions/art/ArtImage.ts       ← Tools don't own what an ArtImage IS

// RIGHT — type defined in its domain package
packages/media/src/image/static/Photo.ts             ← Media owns what a Photo IS
packages/media/src/image/static/ArtImage.ts          ← Media owns what art IS

// RIGHT — platform extends domain type for platform-specific context
packages/services/src/messaging/telegram/TelegramPhoto.ts  ← extends Photo, adds fileId/chatId
```

**The rule:** The canonical type lives in the domain package. Platforms and clients import and extend — they never redefine. If Telegram, the web UI, and the PWA all need `Photo`, it lives in one place and all three import it.

**Cross-cutting types** (used by 3+ packages) live in `packages/core/src/types/`. Domain-specific types live in their domain package (`packages/media/`, `packages/db/`, etc.).

**Do NOT** create central type directories that orphan types from the code that uses them.

### Types Are Agent Documentation

In 4th Layer Engineering, types and directory structure ARE the documentation that agents use to understand and extend the system.

**Naming:** Type names should let an agent immediately map to the DB schema, API, or domain concept. Use `persona` (maps to `personas` table) not `entity` (abstract, no DB mapping). Use `Photo` (concrete, greppable) not `ImageInput` (vague).

**Directory structure:** The presence of directories is documentation. `image/static/` and `image/animated/` exist so agents see both categories. An agent finding `animated/` without `static/` might not realize there's a counterpart.

**Filename = type name:** `Photo.ts` exports `Photo`. An agent looking for the Photo type finds exactly one file. No opening a `types.ts` file and searching.

**@antipattern docstrings:** When a type or function exists that agents should use instead of building their own, add `@antipattern` docstrings that direct agents to the existing solution:

```typescript
/**
 * @antipattern DO NOT create LLM call callbacks here — use `createLLM()` from @persistence/llm.
 *   The LLM package provides CallableModel with .sync() and .batch() methods.
 */
```

### Reuse Before Creating — Check Existing Packages

Before creating a new type, interface, callback, or utility:
1. Check if the concept already exists in another package
2. Check if `packages/core/` has a base type you should extend
3. Check if `packages/media/`, `packages/db/`, `packages/llm/` already export what you need

```typescript
// WRONG — reinventing what @persistence/llm already provides
interface PlatformCallbacks {
  callAnthropicSync: (params: SyncParams) => Promise<SyncResult>;
  submitBatch: (apiKey: string, ...) => Promise<BatchResult>;
}

// RIGHT — use the existing typed LLM interface
import { LLM } from '@persistence/llm';
interface OrchestratorConfig {
  llm: LLM;  // llm.anthropic.opus.sync() handles everything
}
```

**If you can't find an existing type but think one should exist**, check the architecture constraints and package barrel files (`index.ts`) before creating a new one. The type system is designed for composition — your new type probably extends or composes existing types.

### No Personal Names in Code — Open Source Ready

This codebase will become open source. No private personal names in type names, variable names, table names, function names, or constants. Use role-based abstractions, with "Clio" preserved only where the public-example persona is explicitly intentional.

```typescript
// BANNED — married to a specific person's real name (this repo's original
// identifiers looked exactly like this before the public-extraction sweep)
<name>_message, <name>_art, <name>_video, <name>_observations
is<Name>RecentlyActive(), SET_<NAME>_STATUS
handleIam  // (when it means "the human's status")

// REQUIRED — describes the role
user_message, user_art, user_video, observations
isHumanRecentlyActive(), SET_HUMAN_STATUS  // or SET_USER_STATUS
handleUserStatus
```

**Table renames required during Drizzle migration:**
- `<name>_observations` → `observations` (the entity observes — persona_id says WHO, content says WHAT)

**Constant/type renames:**
- `<name>_message` → `user_message`
- `<name>_art` → `user_art`
- `<name>_video` → `user_video`
- `<NAME>_MESSAGE` → `USER_MESSAGE`
- `SET_<NAME>_STATUS` → `SET_USER_STATUS`
- `is<Name>RecentlyActive` → `isUserRecentlyActive`

Persona names (Clio, Eli) are DATA in the database, not code. That's fine — the code says `persona.name`, not `clioName`.

### Zero Code Duplication

- Shared logic goes in `packages/`
- Platform-specific logic stays in `platforms/`
- Frontend-specific logic stays in `apps/web/`
- If the same function exists in two places, one of them is a bug

### camelCase Properties in TypeScript Interfaces

All new TypeScript interfaces use camelCase property names. This matches Drizzle ORM's column mapping convention and prevents the `as unknown as` cast pattern that occurs when DB types have camelCase but consumer types use snake_case.

@antipattern DO NOT use snake_case in TypeScript interface properties — use camelCase. The Drizzle schema uses camelCase property names that map to snake_case SQL columns automatically.

---

## Docstring Convention

Every exported function, component, and module receives a docstring. Minimum tags:

```typescript
/**
 * Computes basin metrics for a persona's embedding trajectory.
 *
 * @downstream SemanticMonitorTab — displays metrics in OverviewPanel
 * @upstream packages/memory/src/sim — called by SIM route handler
 * @pattern stateless-computation — pure function, no side effects
 * @antipattern Do NOT cache results — basin metrics must reflect current data
 * @tested_by services/__tests__/sim.test.ts
 * @invariant Requires at least 2 embeddings to compute meaningful metrics
 */
```

Docstrings serve three purposes: (1) human readability, (2) LLM context for agent file selection, (3) search embedding relevance. Verbosity is intentional.

---

## Research Constraints

### SIM Data Must Be Exportable

Every SIM metric stored in D1 must be retrievable via the `/sim/export` endpoint in a format suitable for external analysis (JSON with documented schema, CSV for trajectory data). Researchers must be able to reproduce analysis in Python/R without access to the running system.

### Persona Experiments Are Non-Destructive

Running a new persona experiment must never modify, delete, or corrupt data from any existing persona. Memory branches provide non-destructive manipulation. The `persona_id` filter is the primary isolation mechanism.

### Embedding Model Is Frozen Per Persona

All embeddings for a given persona use the same model (currently BGE-base-en-v1.5). If the model changes, start a new persona. Mixed-model embeddings within a persona are invalid for SIM analysis.

---

## Codebase Health Pulse (Tracked at Every Archival)

Every archived RUN includes a health pulse header. These are NOT gates — archival is never blocked by a metric. They're a **pulse** so trends are visible across time. If test-to-source ratio drops across three runs, something's wrong.

### Metrics

| Metric | Command/Method | Target | Why |
|--------|---------------|--------|-----|
| **Code duplication %** | `npx jscpd --min-lines 5 --min-tokens 50` | 0% | Disambiguation guarantee — agents know WHERE things exist |
| **Source statements** | Count executable statements (excl docs/comments/blanks) | Track trend | The actual "size" of the codebase |
| **Test statements** | Same count for test files | Track trend | Coverage proxy |
| **Test-to-source ratio** | test statements / source statements | ≥0.80 | artemis-agents benchmark |
| **Docstring-to-code ratio** | docstring+comment lines / statement lines | ≥0.50 | Docs are first-class artifacts, not afterthoughts |
| **Cross-reference density** | Count of `@downstream` + `@upstream` + `@tested_by` + `@pattern` tags | Increasing | How connected the documentation graph is |
| **Function statements (max)** | Largest function by statement count | ≤30 | Per statement limits constraint |
| **Function statements (avg)** | Average statements per function | Track trend | Codebase-wide function complexity |
| **Function statements (median)** | Median statements per function | Track trend | Unaffected by outlier god functions |
| **File statements (max)** | Largest file by statement count | ≤150 | Per statement limits constraint |
| **File statements (avg)** | Average statements per file | Track trend | Codebase-wide file complexity |
| **File statements (median)** | Median statements per file | Track trend | Unaffected by outlier god files |
| **TypeScript error count** | `npx tsc --noEmit` | 0 | Strict mode, no suppressions |
| **Platform line count** | `wc -l platforms/cloudflare/src/**/*.ts` | <300 | Tracking toward platform minimization target |
| **Circular dependency count** | Static analysis or manual audit | 0 | Clean package boundaries |

### Archive Entry Health Header

Every archived RUN entry starts with this header:

```markdown
### [RUN-YYYYMMDD-HHMM] Brief Description

**Archived:** YYYY-MM-DD HH:MM EST
**Created:** YYYY-MM-DD HH:MM EST
**Working Directory:** `runs/CLAUDE-RUNS/RUN-ID-slug/`

#### Codebase Health Pulse
| Metric | Value |
|--------|-------|
| Code duplication | X.XX% (jscpd 5/50) |
| Source statements | N |
| Test statements | N |
| Test:source ratio | X.XX |
| Docstring:code ratio | X.XX |
| Cross-reference tags | N (@downstream: X, @upstream: X, @tested_by: X, @pattern: X) |
| Function statements | max: function_name (N) · avg: N · median: N |
| File statements | max: file_path (N) · avg: N · median: N |
| TS errors | 0 |
| Platform lines | N |
| Circular deps | N |

**Summary:**
[Brief description of what was accomplished]
```

### Health Tracking, Not Health Gating

- **Archival is NEVER blocked** by a metric being outside target
- The pulse exists so agents and the user can see trends
- If a metric degrades, the TASK_LOG should note why (e.g., "test ratio dropped because we added 500 lines of routes without tests — tests are a follow-up")
- The target values are aspirational benchmarks from artemis-agents, not pass/fail thresholds

---

## What These Constraints Enable

- **Research integrity:** Persona isolation + append-only history + frozen embeddings = reproducible experiments
- **Research publishability:** SIM export + documented schema + clean data model = external analysis possible
- **Agent productivity:** Size limits + structural rules + zero duplication = agents know WHERE to look and extend
- **Operational simplicity:** Cloudflare-only + no local server = runs 24/7 on free tier
- **Identity safety:** Persona scoping helpers + non-destructive branches = experiments can't corrupt each other

