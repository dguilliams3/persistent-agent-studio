# packages/ - Shared Logic Layer

**Status:** MOSTLY MIGRATED (as of 2026-01-27)

---

## The Goal

Packages should be **platform-agnostic** - importable from Cloudflare Workers, Node.js, Deno, or anywhere JavaScript runs.

## The Reality (Current State)

| Package | Purity | Notes |
|---------|--------|-------|
| `@persistence/core` | Pure | Constants, types, configs - no side effects |
| (removed) | — | telegram handlers live in `@persistence/services/src/messaging/telegram/` + `platforms/cloudflare/src/telegram/` (no separate package) |
| `@persistence/discord` | Pure | Type definitions only (skeleton) |
| `@persistence/tools` | **Database** | 19 tool handlers with full DB operations |
| `@persistence/llm` | **API Calls** | Provider types, pricing, RequestEngine with sync + batch API |
| `@persistence/runtime` | Pure | Types, guards - actual loop still in worker |
| `@persistence/db` | **Database** | Persona-scoped queries, history logging |
| `@persistence/memory` | **Database** | Summarization, tier transitions, context assembly |

### Basin Pattern (Database Access in Packages)

Packages that access the database follow the **Basin Pattern**:
- Receive `db: D1Database` as a parameter (not from env)
- Use raw SQL via `db.prepare()` - self-contained queries
- No cross-package dependencies on @persistence/db (where possible)
- Platform layer provides thin 3-line wrappers

This makes packages portable - they work anywhere a D1-compatible database is provided.

---

## Package Categories

### Category 1: Pure Definitions (No Side Effects)

```
@persistence/core      - Constants, types, config builders
@persistence/discord   - Webhook types (skeleton)
@persistence/llm       - Provider definitions, pricing
@persistence/runtime   - Loop types, guards (logic in worker)
```

These can run anywhere. No `fetch()`, no database calls.

### Category 2: Database Operations (Basin Pattern)

```
@persistence/db        - Persona-scoped queries, history logging (shared utilities)
@persistence/tools     - 19 Claude ACTION handlers (LEARNED, ART, NOTE, etc.)
(no @persistence/telegram) - handlers live in @persistence/services/src/messaging/telegram/ + platforms/cloudflare/src/telegram/ (no top-level @persistence/telegram package)
@persistence/memory    - Summarization logic, tier transitions
```

These packages accept `db` as a parameter and execute SQL. They're still platform-agnostic because they don't depend on Cloudflare-specific APIs.

---

## What Lives Where

### @persistence/tools - Claude's ACTIONS (19 handlers)

What Claude can DO when thinking:

| Handler | Lines | Operations |
|---------|-------|------------|
| learned | 275 | add, update, cite, promote, delete, list |
| question | 219 | add, note, resolve, dissolve, list |
| art | 215 | make, share |
| observation | 171 | save, get, delete |
| note | 161 | save, get, delete |
| reminder | 140 | set, dismiss |
| search | 130 | web search |
| message-user | 127 | send message |
| cold-storage | 119 | store permanent memory |
| set-profile-pic | 98 | update avatar |
| set-state | 97 | update state values |
| think | 96 | private contemplation |
| sleep | 80 | pause for duration |
| set-status | 72 | update status line |
| summarize | 61 | compress history |
| set-user-status | 59 | update the user's availability |
| remember | 58 | ephemeral note |
| exist | 55 | simply be present |
| wonder | 51 | express curiosity |

### Telegram Commands (no @persistence/telegram package)

What the user types in Telegram:

| Module | Handlers | Status |
|--------|----------|--------|
| loop/ | handlePause, handleResume, handleEmergency | ✅ Migrated |
| history/ | handleLast, handleLastMessage, handleDeleteLast | ✅ Migrated |
| status/ | handleStart, handleDebug, handleProfilePic, handleStatus | ✅ Migrated |
| status/meter/ | handleMeter | ✅ Migrated |
| context_data/reminders/ | handleReminders, handleReminder | ✅ Migrated |
| context_data/notes/ | handleNotes | ✅ Migrated |
| context_data/cold/ | handleCold | ✅ Migrated |
| context_data/summaries/ | handleSummaries | ✅ Migrated |
| context_data/observations/ | handleObservations | ✅ Migrated |
| context_data/learned/ | handleLearned | ✅ Migrated |
| context_data/questions/ | handleQuestions | ✅ Migrated |
| help/ | buildMainHelpMenu, getCommandHelp | ✅ Migrated |

**~45 more handlers** remain in `platforms/cloudflare/src/telegram/commands/` (config, operations, voice, gallery, etc.)

---

## Import Patterns

### From Pure Packages (Works Everywhere)

```typescript
import { ACTION_TYPES, MODEL_PRICING } from '@persistence/core';
import { TOOL_DEFINITIONS } from '@persistence/tools';
```

### From Database Packages (Needs D1 Binding)

```typescript
// Tool handler example
import { handler as learnedHandler } from '@persistence/tools/definitions/learned';
await learnedHandler(params, { db: env.DB, cycleId: 123 });

// Telegram command example (actual location)
import { handleStatus } from '@persistence/services/src/messaging/telegram/commands/status/handler';
// or from platform: platforms/cloudflare/src/telegram/commands/status/handler.ts
await handleStatus({ db: env.DB, token: env.TELEGRAM_BOT_TOKEN, chatId, args });
```

### Wrangler Import Workaround

Wrangler's esbuild doesn't resolve pnpm workspace aliases. Use relative paths:

```javascript
// In platforms/cloudflare/src/telegram/commands/index.js
// BAD - won't resolve
import { handleStatus } from '@persistence/services/src/messaging/telegram/commands/status/handler';

// GOOD - relative path works
import { handleStatus } from '../../../../../packages/services/src/messaging/telegram/commands/status/handler';
```

---

## Adding New Code

### Pure Functions/Types → Package

If it doesn't need external I/O:
- Type definitions → `packages/*/src/types.ts`
- Constants → `packages/core/src/constants.ts`
- Formatting → in services or platform telegram/
- Validation → `packages/tools/src/validation.ts`

### Database Queries → Basin Pattern

If it queries D1:
- For tool actions → `packages/tools/src/definitions/{action}/handler.ts`
- For Telegram commands → `@persistence/services/src/messaging/telegram/commands/` or platform equiv.
- Accept `db: D1Database` as parameter
- Use raw SQL (no @persistence/db imports in telegram commands)

### External APIs → platforms/

If it calls external APIs (Telegram, Anthropic, Replicate, etc.):
- Stays in `platforms/cloudflare/src/services/`
- Packages return metadata, platform executes

---

## Migration Status

| Component | Status | Location |
|-----------|--------|----------|
| Tool schemas | ✅ Migrated | `@persistence/tools/definitions/*/schema.ts` |
| Tool handlers (19) | ✅ Migrated | `@persistence/tools/definitions/*/handler.ts` |
| Command definitions | ✅ Migrated | `@persistence/services/src/messaging/telegram/commands/` + `platforms/cloudflare/src/telegram/` |
| Command handlers | ✅ Migrated | (same; no separate @persistence/telegram package) |
| History logging | ✅ Migrated | `@persistence/db/history-logger.ts` |
| Cycle tracking | ✅ Migrated | `@persistence/db` |
| Persona queries | ✅ Migrated | `@persistence/db/personas.ts` |
| Summarization | ✅ Migrated | `@persistence/memory/summarization/` |
| Remaining commands (~45) | Platform | `platforms/cloudflare/src/telegram/commands/` (config/ops/voice/gallery etc.) |
| Context builder | Platform | `platforms/cloudflare/src/prompts/build-system-prompt.ts` + @persistence/memory |
| Think cycle orchestration | Platform | @persistence/runtime + platforms/cloudflare adapter |

**Real dep graph (verified):** core/db → llm/media/embedding → memory → tools/services → runtime → platform

**Removals:** discord + voice packages removed (see commit history e.g. around dd47ff8).

---

## Questions to Ask

1. **Does it call fetch()?** → `platforms/cloudflare/src/services/`
2. **Does it query D1?** → Basin Pattern in appropriate package
3. **Is it a type/constant/pure function?** → Appropriate `@persistence/*` package
4. **Is it UI code?** → `apps/`
