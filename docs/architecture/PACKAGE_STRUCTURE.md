# Package Structure

**Created:** 2026-01-27
**Status:** Vision Document

> **Note:** This document describes the target architecture. Check actual package
> directories for current state. **(2026-07-31)** The `telegram/` and `discord/` entries
> below are historical: this distribution ships **no concrete channel adapter** —
> `packages/services/src/messaging/` holds the transport-agnostic contract instead, and
> there is no `@persistence/telegram` or `@persistence/discord` package to build.

This document describes the target architecture for the monorepo package structure.

---

## Overview

```
packages/
├── core/          # Shared types, constants, utilities
├── db/            # D1 database operations
├── discord/       # Discord integration and webhooks
├── llm/           # LLM API calls (Anthropic, OpenAI)
├── memory/        # Summarization, RAG, context building
├── runtime/       # Runtime utilities and environment
├── services/      # External service integrations
├── telegram/      # Telegram command handlers
├── tools/         # Tool definitions, validation, handlers
└── voice/         # Voice/TTS functionality

platforms/
└── cloudflare/    # Worker entry point, routing, bindings

apps/
└── web/           # React frontend
```

---

## Package Responsibilities

### @persistence/core

**Purpose:** Shared types and constants used across all packages.

```
packages/core/src/
├── types/
│   ├── history.ts      # HistoryEntry, HistoryType
│   ├── actions.ts      # ActionCategory, BaseAction
│   ├── results.ts      # ServiceResult<T>, AsyncJob<T>
│   └── index.ts
├── constants/
│   ├── history-types.ts
│   └── index.ts
└── index.ts
```

**Rules:**
- NO dependencies on other @persistence/* packages
- NO runtime logic, only types and constants
- CAN be imported by frontend (apps/web)

---

### @persistence/db

**Purpose:** All D1 database operations, persona-scoped.

```
packages/db/src/
├── personas.ts         # Persona abstraction layer
├── state.ts            # Key-value state
├── history.ts          # Timeline entries
├── history-logger.ts   # High-level logging API
├── cycles.ts           # Execution ledger
├── llm-storage/        # LLM-managed tables
│   ├── learned.ts
│   ├── questions.ts
│   ├── reminders.ts
│   ├── notebook.ts
│   ├── observations.ts
│   └── cold-storage.ts
├── branches/           # Memory branching system
├── summaries/          # Summary tier management
└── migrations/
```

**Rules:**
- Takes D1 database binding as parameter
- All functions are persona-scoped by default
- NO external API calls
- NO env access - db binding passed in

---

### @persistence/llm

**Purpose:** LLM API interactions (Anthropic, OpenAI).

```
packages/llm/src/
├── engine/             # Multi-provider abstraction
│   ├── engine.ts       # LLMEngine class
│   ├── providers/
│   │   ├── anthropic.ts
│   │   └── openai.ts
│   └── types.ts
├── batch/              # Batch API support
└── index.ts
```

**Rules:**
- Takes API keys as parameters
- NO D1 access (that's @persistence/db's job)
- Returns structured results, not raw API responses

---

### @persistence/services

**Purpose:** External service integrations (Telegram, Discord, image gen, etc.)

```
packages/services/src/
├── core/
│   ├── types.ts        # ServiceResult, AsyncJob, JobStatus
│   ├── http.ts         # Shared fetch wrapper
│   ├── async-job.ts    # AsyncJobService interface
│   └── errors.ts
├── telegram/
│   ├── types.ts
│   ├── messages.ts
│   ├── media.ts
│   └── index.ts
├── discord/
│   ├── types.ts
│   ├── webhook.ts
│   └── index.ts
├── elevenlabs/
│   ├── types.ts
│   ├── tts.ts
│   └── index.ts
├── brave/
│   ├── types.ts
│   ├── search.ts
│   └── index.ts
└── index.ts
```

**Rules:**
- Takes API keys/tokens as parameters
- NO env access - secrets passed in
- NO D1 access - pure HTTP services
- Implements `AsyncJobService` interface where applicable
- See [ASYNC_JOB_PATTERN.md](./ASYNC_JOB_PATTERN.md) for async services

---

### @persistence/tools

**Purpose:** Tool definitions, validation, and handlers.

```
packages/tools/src/
├── definitions/        # 18+ tool definitions
│   ├── learned/
│   │   ├── schema.ts
│   │   ├── params.ts
│   │   ├── handler.ts
│   │   └── index.ts
│   └── ...
├── registry.ts         # Tool lookup
├── validation.ts       # Action validation
├── types.ts
├── utils/
│   └── normalize.ts    # Shared utilities
└── index.ts
```

**Rules:**
- Handlers call @persistence/db for database ops
- Handlers return metadata for platform-dependent ops
- NO direct external API calls in handlers
- See [SERVICE_LAYER.md](./SERVICE_LAYER.md) for how handlers interact with services

---

### @persistence/memory

**Purpose:** Summarization, RAG, context building.

```
packages/memory/src/
├── summarization/
├── rag/
├── context/
└── index.ts
```

**Rules:**
- Uses @persistence/db for storage
- Uses @persistence/llm for LLM calls
- Orchestrates memory operations

---

### Telegram command handlers (no @persistence/telegram package)

**Purpose:** Telegram command handlers (actual location).

Telegram command logic lives in:
- @persistence/services/src/messaging/telegram/ (shared command definitions and logic)
- platforms/cloudflare/src/telegram/ (platform-specific wiring and additional commands)

No separate `packages/telegram/` package exists.

**Rules:**
- Command handlers use @persistence/db via basin pattern
- Sending uses platform or services
- Many commands migrated to services

---

### @persistence/discord

**Purpose:** Discord integration and webhooks.

```
packages/discord/src/
├── webhook.ts      # Discord webhook operations
├── types.ts        # Discord-specific types
└── index.ts
```

**Rules:**
- Takes webhook URL as parameter
- Pure HTTP operations
- NO direct env access

---

### @persistence/runtime

**Purpose:** Runtime utilities and environment abstraction.

```
packages/runtime/src/
├── environment.ts  # Environment detection
├── utilities.ts    # Runtime-agnostic utilities
└── index.ts
```

**Rules:**
- Abstracts runtime-specific behavior
- Provides portable utilities
- NO Cloudflare-specific imports

---

### @persistence/voice

**Purpose:** Voice and TTS functionality.

```
packages/voice/src/
├── tts.ts          # Text-to-speech operations
├── types.ts        # Voice-specific types
└── index.ts
```

**Rules:**
- Takes API keys as parameters
- Handles ElevenLabs integration
- Returns audio data/URLs

---

## Dependency Graph

```
                    ┌─────────────┐
                    │ apps/web    │
                    └──────┬──────┘
                           │ HTTP only
                           ▼
              ┌────────────────────────┐
              │ platforms/cloudflare   │
              └───────────┬────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  ┌───────────┐    ┌───────────┐    ┌───────────┐
  │ @persist/ │    │ @persist/ │    │ @persist/ │
  │ tools     │    │ telegram  │    │ memory    │
  └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
        │                │                │
        ├────────────────┼────────────────┤
        │                │                │
        ▼                ▼                ▼
  ┌───────────┐    ┌───────────┐    ┌───────────┐
  │ @persist/ │    │ @persist/ │    │ @persist/ │
  │ db        │    │ llm       │    │ services  │
  └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
        │                │                │
        └────────────────┴────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ @persist/   │
                  │ core        │
                  └─────────────┘
```

**Dependency Rules:**
1. `core` has NO dependencies on other packages
2. `db`, `llm`, `services`, `discord`, `runtime` depend only on `core`
3. `tools`, `telegram`, `memory`, `voice` can depend on `db`, `llm`, `services`
4. `platforms/cloudflare` can depend on any package
5. `apps/web` does NOT import packages directly (HTTP only)

---

## Platform vs Package

See [PLATFORM_VS_PACKAGE.md](./PLATFORM_VS_PACKAGE.md) for what belongs in the platform layer vs packages.

---

## Adding a New Package

1. Create `packages/{name}/` directory
2. Add `package.json` with name `@persistence/{name}`
3. Add to workspace in root `pnpm-workspace.yaml`
4. Follow the structure patterns above
5. Update this document
