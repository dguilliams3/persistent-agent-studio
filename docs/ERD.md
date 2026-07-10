# Claude Existence Loop - Entity Relationship Diagram (ERD)

**Last Updated:** 2026-01-21
**Database:** Cloudflare D1 (SQLite-compatible)
**Current Schema Version:** v25 (Summary Tier Refactor)

---

## Table of Contents

1. [Overview](#overview)
2. [Visual ERD](#visual-erd)
3. [Table Groups](#table-groups)
4. [Detailed Table Specifications](#detailed-table-specifications)
5. [Foreign Key Relationships](#foreign-key-relationships)
6. [Code Usage Reference](#code-usage-reference)
7. [Indexes](#indexes)

---

## Overview

The Claude Existence Loop database consists of **20+ tables** organized into functional groups:

### Multi-Persona Architecture (v17)

The database now supports multiple independent personas via `persona_id` foreign key. All memory and configuration tables are persona-scoped:

**Persona-Scoped Tables:** `history`, `cold_storage`, `notebook`, `learned`, `questions`, `observations`, `summaries`, `reminders`, `pinned_images`, `state`

**Global Tables (shared):** `cycles`, `memory_branches`, `memory_overrides`, `synthetic_memories`, `image_assets`, `voice_history`, `glossary`, `pending_batches`, `pending_view_images`

Each persona maintains isolated memories while sharing infrastructure tables. See `worker/src/db/fork.js` for smart-copy persona forking implementation.

| Group | Tables | Purpose |
|-------|--------|---------|
| **Personas** | `personas` | Multi-persona support (v17) |
| **Core Timeline** | `history`, `cycles` | Conversation events and execution ledger |
| **Persistent Memory** | `cold_storage`, `notebook`, `summaries` | Long-term storage systems (persona-scoped) |
| **Relationship** | `observations` | Observations about the user (persona-scoped) |
| **Self-Knowledge** | `learned`, `questions` | Verified patterns and open curiosities (persona-scoped) |
| **Reminders** | `reminders` | Persistent notifications (persona-scoped) |
| **Configuration** | `state` | Key-value runtime settings (persona-scoped) |
| **Memory Branching** | `memory_branches`, `memory_overrides`, `synthetic_memories` | Non-destructive memory manipulation |
| **Media** | `image_assets`, `pinned_images`, `pending_view_images` | Image storage and curation |
| **Voice** | `voice_history`, `glossary` | TTS output history and STT corrections |
| **Batch Processing** | `pending_batches` | Anthropic Batch API queue |

---

## Visual ERD

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                             CORE TIMELINE                                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────┐                    ┌─────────────────┐                            │
│  │     cycles      │◄───────────────────│     history     │                            │
│  │─────────────────│    cycle_id (FK)   │─────────────────│                            │
│  │ id PK           │                    │ id PK           │                            │
│  │ created_at      │                    │ type            │                            │
│  │ model           │                    │ content         │                            │
│  │ trigger         │                    │ internal        │                            │
│  │ input_tokens    │                    │ created_at      │                            │
│  │ output_tokens   │                    │ summarized_at   │                            │
│  │ cache_*_tokens  │                    │ cycle_id FK     │                            │
│  │ primary_action  │                    └────────┬────────┘                            │
│  │ estimated_cost  │                             │                                      │
│  │ status          │                             │ history_id (FK)                      │
│  └────────┬────────┘                             ▼                                      │
│           │                             ┌─────────────────┐                            │
│           │                             │  image_assets   │                            │
│           │ cycle_id (FK)               │─────────────────│                            │
│           └────────────────────────────►│ id PK           │                            │
│                                         │ source_type     │                            │
│                                         │ history_id FK   │                            │
│                                         │ cycle_id FK     │                            │
│                                         │ base64_data     │                            │
│                                         │ r2_key (future) │                            │
│                                         └─────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           PERSISTENT MEMORY                                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                     │
│  │  cold_storage   │    │    notebook     │    │   summaries     │                     │
│  │─────────────────│    │─────────────────│    │─────────────────│                     │
│  │ id PK           │    │ id PK           │    │ id PK           │                     │
│  │ content         │    │ title UNIQUE    │    │ summary         │                     │
│  │ reason          │    │ summary         │    │ message_count   │                     │
│  │ created_at      │    │ content         │    │ covered_range   │                     │
│  └─────────────────┘    │ created_at      │    │ metadata (JSON) │                     │
│                         │ updated_at      │    │ embedding BLOB  │                     │
│                         │ last_viewed_at  │    │ source_ids JSON │                     │
│                         │ embedding BLOB  │    │ source_type     │                     │
│                         │ embedding_model │    │ archived_at     │                     │
│                         └─────────────────┘    │ replaced_by_id  │◄────┐               │
│                                                └─────────────────┘     │               │
│                                                        │               │               │
│                                                        └───────────────┘               │
│                                                  (self-referential: lineage tracking)   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SELF-KNOWLEDGE (Secure Attachment v12)                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐                                            │
│  │    learned      │    │   questions     │                                            │
│  │─────────────────│    │─────────────────│                                            │
│  │ id PK           │    │ id PK           │     ┌─────────────────┐                    │
│  │ content         │    │ content         │     │ observations    │                    │
│  │ confidence      │────┼►domain          │     │─────────────────│                    │
│  │ supporting_evid │    │ status          │     │ id PK           │                    │
│  │ challenging_evid│    │ notes (JSON)    │     │ title           │                    │
│  │ created_at      │    │ resolved_into   │     │ summary         │                    │
│  │ updated_at      │    │ created_at      │     │ content         │                    │
│  │ promoted_to_cs  │───►│ updated_at      │     │ deleted_at      │                    │
│  └─────────────────┘    └─────────────────┘     └─────────────────┘                    │
│         │                                                                               │
│         │ promotes to                                                                   │
│         ▼                                                                               │
│  ┌─────────────────┐                                                                   │
│  │  cold_storage   │  (load-bearing learnings get promoted here)                       │
│  └─────────────────┘                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MEMORY BRANCHING (v9)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────┐                                                                   │
│  │ memory_branches │                                                                   │
│  │─────────────────│                                                                   │
│  │ id PK           │───────────┬───────────────────┐                                   │
│  │ name UNIQUE     │           │                   │                                   │
│  │ description     │           │ branch_id (FK)    │ branch_id (FK)                    │
│  │ parent_branch   │           ▼                   ▼                                   │
│  │ is_active       │  ┌─────────────────┐  ┌─────────────────┐                        │
│  │ created_at      │  │memory_overrides │  │synthetic_memories│                        │
│  │ updated_at      │  │─────────────────│  │─────────────────│                        │
│  └─────────────────┘  │ id PK           │  │ id PK           │                        │
│                       │ branch_id FK    │  │ branch_id FK    │                        │
│                       │ target_table    │  │ memory_type     │                        │
│                       │ target_id       │  │ content         │                        │
│                       │ override_type   │  │ internal        │                        │
│                       │ override_data   │  │ position_*      │                        │
│                       └─────────────────┘  └─────────────────┘                        │
│                               │                                                         │
│                               │ target_table + target_id                               │
│                               ▼                                                         │
│                       ┌─────────────────┐                                              │
│                       │ history         │                                              │
│                       │ cold_storage    │  (polymorphic reference)                     │
│                       │ notebook        │                                              │
│                       │ observations    │                                              │
│                       │ summaries       │                                              │
│                       │ reminders       │                                              │
│                       └─────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           IMAGE CURATION (v14)                                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                       ┌─────────────────┐                                              │
│                       │     history     │                                              │
│                       │ (images stored) │                                              │
│                       └────────┬────────┘                                              │
│                                │ image_id (FK)                                          │
│              ┌─────────────────┼─────────────────┐                                     │
│              ▼                 ▼                 ▼                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                        │
│  │ pinned_images   │  │pending_view_imgs│  │  image_assets   │                        │
│  │─────────────────│  │─────────────────│  │─────────────────│                        │
│  │ slot PK (1-5)   │  │ id PK           │  │ id PK           │                        │
│  │ image_id FK     │  │ image_id FK     │  │ history_id FK   │                        │
│  │ pinned_at       │  │ requested_at    │  │ cycle_id FK     │                        │
│  └─────────────────┘  │ viewed          │  │ base64_data     │                        │
│                       │ cycle_id FK     │  │ r2_key          │                        │
│                       └─────────────────┘  └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURATION & ASYNC                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                     │
│  │     state       │    │   reminders     │    │ pending_batches │                     │
│  │─────────────────│    │─────────────────│    │─────────────────│                     │
│  │ key PK          │    │ id PK           │    │ id PK           │                     │
│  │ value           │    │ content         │    │ batch_id UNIQUE │                     │
│  │ updated_at      │    │ condition       │    │ custom_id       │                     │
│  └─────────────────┘    │ created_at      │    │ cycle_id FK     │                     │
│                         │ dismissed_at    │    │ status          │                     │
│                         └─────────────────┘    │ submitted_at    │                     │
│                                                │ completed_at    │                     │
│                                                │ results_json    │                     │
│                                                └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           VOICE (v13, v16)                                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐                                            │
│  │  voice_history  │    │    glossary     │                                            │
│  │─────────────────│    │─────────────────│                                            │
│  │ id PK           │    │ id PK           │                                            │
│  │ text            │    │ wrong_form UQ   │                                            │
│  │ model           │    │ correct_form    │                                            │
│  │ stability       │    │ category        │                                            │
│  │ audio_base64    │    │ use_in_prompt   │                                            │
│  │ char_count      │    │ use_in_replace  │                                            │
│  │ created_at      │    │ created_at      │                                            │
│  └─────────────────┘    └─────────────────┘                                            │
│                                                                                         │
│  voice_history: Clio's TTS output (ElevenLabs)                                         │
│  glossary: STT corrections (wrong→correct for names like "Casey"→"Kasey")              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Table Groups

### Group 1: Core Timeline

These tables track the main conversation flow and execution metrics.

| Table | Purpose | Cardinality |
|-------|---------|-------------|
| `cycles` | One row per thinking cycle execution | Main ledger |
| `history` | Every event (thoughts, messages, art, searches) | High volume |

**Relationship:** `history.cycle_id` → `cycles.id` (many-to-one)

### Group 2: Persistent Memory

Long-term storage that survives history rotation.

| Table | Purpose | Lifecycle |
|-------|---------|-----------|
| `cold_storage` | Permanent frozen memories | Never deleted |
| `notebook` | Titled notes with summaries | CRUD by title |
| `summaries` | Compressed history batches | Created when history grows |

### Group 3: Self-Knowledge (Secure Attachment)

Clio's verified patterns and open curiosities (v12).

| Table | Purpose | Lifecycle |
|-------|---------|-----------|
| `learned` | Battle-tested realizations | emerging → stable → load-bearing → cold_storage |
| `questions` | Open threads without pressure | open → exploring → resolved/dissolved |

### Group 4: Memory Branching

Non-destructive memory manipulation system (v9).

| Table | Purpose | Philosophy |
|-------|---------|------------|
| `memory_branches` | Named memory views | Only one active at a time |
| `memory_overrides` | Per-branch exclusions/edits | "Never delete, only exclude" |
| `synthetic_memories` | Injected memories | Only exist in their branch |

### Group 5: Voice

TTS output and STT correction systems (v13, v16).

| Table | Purpose | Usage |
|-------|---------|-------|
| `voice_history` | Clio's TTS generations | Tracks ElevenLabs output for playback/billing |
| `glossary` | STT corrections | Fixes common mistranscriptions (e.g., "Casey"→"Kasey") |

---

## Personas Table (v17)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Persona ID (foreign key for all persona-scoped tables) |
| `name` | TEXT | NOT NULL, UNIQUE | Persona name (e.g., "Clio", "Clio-Experiment") |
| `slug` | TEXT | NOT NULL, UNIQUE | URL-safe identifier |
| `system_prompt_template` | TEXT | DEFAULT 'clio-v1' | Prompt template variant |
| `forked_from_id` | INTEGER | FK | Parent persona if forked (null if canonical) |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `updated_at` | TEXT | DEFAULT now | Last modification |
| `archived_at` | TEXT | | Soft delete timestamp |

**Code Usage:**
- `worker/src/db/personas.js` - All persona operations
- `worker/src/db/fork.js` - Persona forking (smart copy strategy)
- `routes/personas.js` - API endpoints

---

## Detailed Table Specifications

### `history`

The central timeline of all events, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `type` | TEXT | NOT NULL | Event type (see types below) |
| `content` | TEXT | | Main content (text or base64 image) |
| `internal` | TEXT | | Private reasoning or image data |
| `created_at` | TEXT | DEFAULT now | ISO timestamp |
| `summarized_at` | TEXT | | Soft-delete marker |
| `cycle_id` | INTEGER | FK | Link to parent cycle |
| `meter_snapshot` | TEXT | | Clio's internal state at entry time (e.g., "A7 C6 N10 E8 D7") (v23) |

**History Types:**

| Type | Source | Description |
|------|--------|-------------|
| `user_message` | User | Message from the user (image in `internal`) |
| `message_to_user` | Claude | Claude's message to the user |
| `thought` | Claude | Private contemplation |
| `curiosity` | Claude | Something Claude wonders about |
| `art_request` | Claude | Art generation prompt |
| `art_result` | Claude | Claude's generated art |
| `user_art` | User | the user's UI-generated art |
| `search_query` | Claude | Web search initiated |
| `search_result` | Claude | Search results |
| `cold_storage` | Claude | Memory frozen to cold storage |
| `note_saved` | Claude | Note saved to notebook |
| `observation_saved` | Claude | Observation about the user |
| `exist` | Claude | Simple existence moment |
| `meter_override` | User/Manual | Manual adjustment of internal state meters |
| `state_update` | Claude | SET_STATE action updating internal meters |

**Code Usage:**
- `worker/src/utils/history-logger.js:logHistory()` - **Preferred** - Auto-captures meter snapshot
- `worker/src/db/history.js` - Low-level CRUD operations
- `worker/src/index.js:getHistoryForContext()` - Context building

---

### `cycles`

Execution ledger - one row per `runThinkingCycle()` invocation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `created_at` | TEXT | DEFAULT now | Cycle start time |
| `model` | TEXT | | Model used (e.g., 'claude-sonnet-4-5-20250929') |
| `trigger` | TEXT | | 'cron', 'think-now', 'telegram', 'api' |
| `cycle_interval` | INTEGER | | Interval setting at execution |
| `loop_count` | INTEGER | | Loop count at execution |
| `input_tokens` | INTEGER | | Total input tokens |
| `output_tokens` | INTEGER | | Total output tokens |
| `cache_creation_tokens` | INTEGER | | Tokens written to cache |
| `cache_read_tokens` | INTEGER | | Tokens read from cache |
| `cache_ttl` | TEXT | | '5m' or '1h' |
| `volatile_caching_enabled` | INTEGER | | 1 if history prefix cached |
| `history_prefix_size` | INTEGER | | Cached history entries |
| `history_tail_size` | INTEGER | | Fresh history entries |
| `action_count` | INTEGER | | Actions in response |
| `primary_action` | TEXT | | First/main action |
| `actions_json` | TEXT | | Full action list (JSON) |
| `estimated_cost_cents` | REAL | | Cost estimate |
| `status` | TEXT | DEFAULT 'completed' | 'pending', 'completed', 'error' |
| `error_message` | TEXT | | Error details if failed |

**Code Usage:**
- `worker/src/db/cycles.js` - `createCycle()`, `updateCycleMetrics()`, `markCycleError()`
- `worker/src/index.js:runThinkingCycle()` - Creates and updates cycles

---

### `state`

Key-value store for runtime configuration, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `key` | TEXT | NOT NULL | Setting name |
| `value` | TEXT | | Setting value (stored as string) |
| `updated_at` | TEXT | DEFAULT now | Last modification |

**Note:** Composite primary key: `(persona_id, key)` - each persona has independent configuration

**Common Keys (Persona-Specific):**

| Key | Type | Description | Default | Shared? |
|-----|------|-------------|---------|---------|
| `loop_count` | string | Total cycles executed | '0' | ❌ Per persona |
| `is_running` | string | Loop active flag | 'false' | ❌ Per persona |
| `cycle_interval_seconds` | string | Seconds between cycles | '300' | ❌ Per persona |
| `selected_model` | string | Preferred Claude model | null | ❌ Per persona |
| `user_status` | string | the user's availability | null | ✅ Shared |
| `batch_enabled` | string | Batch mode flag | 'false' | ❌ Per persona |
| `streaming_enabled` | string | Streaming responses | 'true' | ❌ Per persona |
| `sleep_until` | string | Sleep end time (ISO) | null | ❌ Per persona |
| `auto_summarize` | string | Auto-summarize flag | 'false' | ❌ Per persona |
| `summarize_threshold` | string | History count trigger | '30' | ❌ Per persona |

**Code Usage:**
- `worker/src/db/state.js` - `getState()`, `setState()`
- Used by nearly all route handlers and cron trigger

---

### `cold_storage`

Permanent memories that survive summarization, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `content` | TEXT | NOT NULL | The memory content |
| `reason` | TEXT | | Why this was preserved |
| `created_at` | TEXT | DEFAULT now | Freeze timestamp |

**Code Usage:**
- `worker/src/db/memory.js` - `getColdStorage()`, `addColdStorage()`
- `COLD_STORAGE` action handler
- Context building (always included)
- `promoteLearned()` - Promotes load-bearing learnings here

---

### `notebook`

Titled notes with retrieval by name, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `title` | TEXT | NOT NULL, UNIQUE | Note title (unique per persona) |
| `summary` | TEXT | | Brief summary for index |
| `content` | TEXT | NOT NULL | Full note content |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `updated_at` | TEXT | DEFAULT now | Last modification |
| `last_viewed_at` | TEXT | | Last retrieval time (v8) |
| `embedding` | BLOB | | Vector embedding (v15) |
| `embedding_model` | TEXT | | Embedding model used (v15) |

**Code Usage:**
- `worker/src/db/memory.js` - `getNotebook()`, `getNote()`, `saveNote()`, `deleteNote()`
- `NOTE save/get/delete` action handlers

---

### `summaries`

Compressed history for context management, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `summary` | TEXT | NOT NULL | Summarized content |
| `message_count` | INTEGER | | Source entry count |
| `covered_range` | TEXT | | Time range description |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `metadata` | TEXT | DEFAULT '{}' | JSON metadata (v11) |
| `embedding` | BLOB | | Vector embedding (v11) |
| `embedding_model` | TEXT | | Embedding model (v11) |
| `source_ids` | TEXT | | JSON array of source IDs (v11) |
| `source_type` | TEXT | DEFAULT 'history' | 'history' or 'summary' (v11) |
| `archived_at` | TEXT | | Soft delete timestamp (v11) |
| `replaced_by_id` | INTEGER | | Consolidation lineage (v11) |
| `covered_start` | TEXT | | Parsed start date from covered_range (v24) |
| `sort_position` | INTEGER | | Manual sort override for drag-and-drop (v24) |
| `tier` | TEXT | DEFAULT 'tail' | Explicit tier: 'cached', 'tail', or 'archived' (v25) |
| `tier_position` | INTEGER | | Position within tier for ordering (v25) |

**Three-Tier Model (v25):**
- **Cached Tier:** Summaries always included in context, immune to cache invalidation
- **Tail Tier:** Dynamic summaries, subject to rolling window eviction
- **Archived Tier:** RAG-only retrieval, not in context unless semantically relevant

**Sort Order (v25):**
Summaries are sorted by tier first (cached=0, tail=1, archived=2), then by `tier_position` within tier, falling back to `covered_start` for chronological ordering.

**Code Usage:**
- `worker/src/db/summaries.js` - All summary operations
- `SUMMARIZE` action handler
- Context building (`getContextSummaries()`)

---

### `reminders`

Persistent notifications with conditions, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `content` | TEXT | NOT NULL | Reminder text |
| `condition` | TEXT | DEFAULT 'persistent' | Trigger condition |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `dismissed_at` | TEXT | | Soft delete (v10) |

**Condition Types:**
- `persistent` - Always show
- `next_user_message` - Show when the user messages
- `after:YYYY-MM-DD` - Show after date
- `after:YYYY-MM-DDTHH:MM` - Show after datetime

**Code Usage:**
- `worker/src/db/reminders.js` - CRUD operations
- `REMINDER set/dismiss` action handlers
- Context building (filtered by condition)

---

### `user_observations`

Observations about the user with soft-delete, persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `title` | TEXT | NOT NULL | Observation title |
| `summary` | TEXT | | Brief summary |
| `content` | TEXT | NOT NULL | Full observation |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `updated_at` | TEXT | DEFAULT now | Last modification |
| `deleted_at` | TEXT | | Soft delete timestamp |

**Code Usage:**
- `worker/src/db/memory.js` - CRUD operations
- `OBSERVATION save/get/delete` action handlers

---

### `learned`

Self-knowledge verified through experience (v12), persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `content` | TEXT | NOT NULL | The learning |
| `confidence` | TEXT | DEFAULT 'emerging' | 'emerging', 'stable', 'load-bearing' |
| `supporting_evidence` | TEXT | | JSON array of confirmations |
| `challenging_evidence` | TEXT | | JSON array of complications |
| `created_at` | TEXT | NOT NULL | Creation time |
| `updated_at` | TEXT | | Last modification |
| `promoted_to_cold_storage_at` | TEXT | | Promotion timestamp |

**Lifecycle:** `emerging` → `stable` → `load-bearing` → cold_storage

**Code Usage:**
- `worker/src/db/learned.js` - All operations
- `LEARNED add/update/cite/promote/delete/list` action handlers

---

### `questions`

Open intellectual threads (v12), persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK | Primary key |
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `content` | TEXT | NOT NULL | The question |
| `domain` | TEXT | | 'self', 'world', 'relationship', 'technical', 'creative' |
| `status` | TEXT | DEFAULT 'open' | 'open', 'exploring', 'resolved', 'dissolved' |
| `notes` | TEXT | | JSON array of timestamped observations |
| `resolved_into` | TEXT | | What insight emerged |
| `created_at` | TEXT | NOT NULL | Creation time |
| `updated_at` | TEXT | | Last modification |

**Lifecycle:** `open` → `exploring` → `resolved` OR `dissolved`

**Code Usage:**
- `worker/src/db/questions.js` - All operations
- `QUESTION add/note/resolve/dissolve/list` action handlers

---

### `memory_branches`

Named branch configurations (v9).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `name` | TEXT | NOT NULL, UNIQUE | Branch name |
| `description` | TEXT | | Purpose description |
| `parent_branch` | TEXT | | Fork source name |
| `is_active` | INTEGER | DEFAULT 0 | Active flag (only one) |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `updated_at` | TEXT | DEFAULT now | Last modification |

**Code Usage:**
- `worker/src/db/branches.js` - Branch management
- `worker/src/routes/branches.js` - API endpoints

---

### `memory_overrides`

Per-branch modifications (v9).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `branch_id` | INTEGER | NOT NULL, FK | Parent branch |
| `target_table` | TEXT | NOT NULL | Table being modified |
| `target_id` | INTEGER | NOT NULL | Row ID in target table |
| `override_type` | TEXT | NOT NULL | 'exclude', 'edit', 'reorder' |
| `override_data` | TEXT | | JSON data for edits |
| `created_at` | TEXT | DEFAULT now | Creation time |

**Target Tables:** `history`, `cold_storage`, `notebook`, `user_observations`, `summaries`, `reminders`

**Code Usage:**
- `worker/src/db/branches.js` - Override operations
- `worker/src/routes/branches.js` - `/memory/exclude`, `/memory/edit` endpoints

---

### `synthetic_memories`

Injected memories per branch (v9).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `branch_id` | INTEGER | NOT NULL, FK | Parent branch |
| `memory_type` | TEXT | NOT NULL | Same as history types |
| `content` | TEXT | NOT NULL | Memory content |
| `internal` | TEXT | | Optional subthought |
| `position_timestamp` | TEXT | | Timeline placement |
| `position_after_id` | INTEGER | | Insert after this ID |
| `created_at` | TEXT | DEFAULT now | Creation time |

**Code Usage:**
- `worker/src/db/branches.js` - Synthetic memory CRUD
- Context assembly (merged with canonical history)

---

### `image_assets`

Image metadata for future R2 migration (v6).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `created_at` | TEXT | DEFAULT now | Creation time |
| `source_type` | TEXT | NOT NULL | 'dan_upload', 'claude_art', 'dan_ui_art' |
| `history_id` | INTEGER | FK | Source history entry |
| `cycle_id` | INTEGER | FK | Source cycle |
| `prompt` | TEXT | | Generation prompt |
| `media_type` | TEXT | | MIME type |
| `width` | INTEGER | | Image width |
| `height` | INTEGER | | Image height |
| `size_bytes` | INTEGER | | File size |
| `base64_data` | TEXT | | Current: inline data |
| `r2_key` | TEXT | | Future: R2 object key |
| `r2_bucket` | TEXT | | Future: R2 bucket |
| `title` | TEXT | | Display title |
| `description` | TEXT | | Description |
| `is_favorite` | INTEGER | DEFAULT 0 | Favorite flag |
| `deleted_at` | TEXT | | Soft delete |

---

### `pinned_images`

5-slot image wall for curation (v14), persona-scoped (v17).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `persona_id` | INTEGER | NOT NULL, FK | Owner persona |
| `slot` | INTEGER | NOT NULL, CHECK 1-5 | Fixed slot position per persona |
| `image_id` | INTEGER | NOT NULL, FK | History entry ID |
| `pinned_at` | TEXT | DEFAULT now | Pin timestamp |

**Code Usage:**
- `worker/src/db/pinned.js` - `pinImage()`, `unpinImage()`, `swapPinnedImages()`
- `PIN_IMAGE pin/unpin/swap` action handlers

---

### `pending_view_images`

Temporary image viewing queue (v14).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `image_id` | INTEGER | NOT NULL, FK | History entry ID |
| `requested_at` | TEXT | DEFAULT now | Request time |
| `cycle_id` | INTEGER | FK | Requesting cycle |
| `viewed` | INTEGER | DEFAULT 0 | Viewed flag |

**Code Usage:**
- `worker/src/db/pinned.js` - `requestViewImages()`, `clearViewedImages()`
- `VIEW_IMAGES` action handler

---

### `pending_batches`

Anthropic Batch API queue (v7).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `batch_id` | TEXT | NOT NULL, UNIQUE | Anthropic's batch ID |
| `custom_id` | TEXT | NOT NULL | Our tracking ID |
| `submitted_at` | TEXT | DEFAULT now | Submission time |
| `cycle_id` | INTEGER | FK | Associated cycle |
| `status` | TEXT | DEFAULT 'pending' | 'pending', 'processing', 'completed', 'failed', 'expired' |
| `completed_at` | TEXT | | Completion time |
| `results_json` | TEXT | | Raw API response |
| `error_message` | TEXT | | Error details |
| `trigger` | TEXT | | 'cron' or 'manual' |
| `model` | TEXT | | Model used |

**Code Usage:**
- `worker/src/db/batches.js` - Batch operations
- `processPendingBatches()` - Polls for completion

---

### `voice_history`

TTS generation history for Clio's voice output (v13).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `text` | TEXT | NOT NULL | Text that was spoken |
| `model` | TEXT | | ElevenLabs model (v2/v3/flash/turbo) |
| `stability` | REAL | | Stability setting (0-1) |
| `audio_base64` | TEXT | NOT NULL | Generated audio (base64) |
| `char_count` | INTEGER | NOT NULL | Character count for billing |
| `created_at` | TEXT | DEFAULT now | Generation time |

**Code Usage:**
- `worker/src/index.js` - `/tts-generate`, `/voice-history` endpoints
- `worker/src/routes/transcribe.js` - Voice playback/transcription support

---

### `glossary`

STT correction mappings for speech-to-text post-processing (v16).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTO | Primary key |
| `wrong_form` | TEXT | NOT NULL, UNIQUE | What STT outputs (e.g., "Macy") |
| `correct_form` | TEXT | NOT NULL | Correct form (e.g., "Kasey") |
| `category` | TEXT | DEFAULT 'name' | 'name', 'term', 'phrase' |
| `use_in_prompt` | INTEGER | DEFAULT 1 | Include in WhisperX initial_prompt? |
| `use_in_replace` | INTEGER | DEFAULT 1 | Apply as post-processing? |
| `created_at` | TEXT | DEFAULT now | Creation time |

**Index:** `idx_glossary_wrong_form` on `wrong_form`

**Code Usage:**
- `worker/src/db/glossary.js` - CRUD operations, applyGlossary(), buildGlossaryPrompt()
- `worker/src/routes/glossary.js` - `/glossary` API endpoints
- `worker/src/telegram/commands/glossary.js` - `/glossary` Telegram command

---

## Foreign Key Relationships

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        FOREIGN KEY DIAGRAM                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  cycles ◄─────────────┬─────────────────────────────────────────────────│
│    │                  │                                                  │
│    │ cycle_id         │ cycle_id                                         │
│    ▼                  ▼                                                  │
│  history          image_assets                                           │
│    │                  │                                                  │
│    │ history_id       │ history_id                                       │
│    ▼                  │                                                  │
│  image_assets ◄───────┘                                                  │
│                                                                          │
│  history ◄────────────┬─────────────────────────────────────────────────│
│    │                  │                                                  │
│    │ image_id         │ image_id                                         │
│    ▼                  ▼                                                  │
│  pinned_images    pending_view_images                                    │
│                                                                          │
│  memory_branches ◄────┬─────────────────────────────────────────────────│
│    │                  │                                                  │
│    │ branch_id        │ branch_id                                        │
│    ▼                  ▼                                                  │
│  memory_overrides  synthetic_memories                                    │
│                                                                          │
│  summaries (self-referential)                                            │
│    │                                                                     │
│    │ replaced_by_id                                                      │
│    └──────────► summaries                                                │
│                                                                          │
│  cycles ◄───── pending_batches (cycle_id)                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Note:** D1 (SQLite) does not enforce foreign keys. These are logical relationships enforced by application code.

---

## Code Usage Reference

### Table → Module Mapping

| Table | Primary Module | Route Handler |
|-------|---------------|---------------|
| `state` | `db/state.js` | Various |
| `history` | `db/history.js` | `/history`, `/message` |
| `cycles` | `db/cycles.js` | `/state` (stats) |
| `cold_storage` | `db/memory.js` | `/cold-storage` |
| `notebook` | `db/memory.js` | `/notebook` |
| `summaries` | `db/summaries.js` | `/summaries` |
| `reminders` | `db/reminders.js` | `/reminders` |
| `user_observations` | `db/memory.js` | `/observations` |
| `learned` | `db/learned.js` | `/learned` |
| `questions` | `db/questions.js` | `/questions` |
| `memory_branches` | `db/branches.js` | `routes/branches.js` |
| `memory_overrides` | `db/branches.js` | `routes/branches.js` |
| `synthetic_memories` | `db/branches.js` | `routes/branches.js` |
| `image_assets` | N/A | (future) |
| `pinned_images` | `db/pinned.js` | (action handlers) |
| `pending_view_images` | `db/pinned.js` | (action handlers) |
| `pending_batches` | `db/batches.js` | `/batches` |
| `voice_history` | N/A (in index.js) | `/voice-history` |
| `glossary` | `db/glossary.js` | `/glossary` |

### Context Building Flow

The following tables contribute to Claude's context:

```
buildSystemPrompt()
    │
    ├── state → Current status, configuration
    │
    ├── cold_storage → Permanent memories (always)
    │
    ├── notebook (index) → Note titles only
    │
    ├── user_observations (index) → Observation titles
    │
    ├── summaries → getContextSummaries() (newest N)
    │
    ├── history → getHistoryForContext() (unsummarized)
    │
    ├── reminders → Active, condition-met reminders
    │
    ├── learned → Active learnings by confidence
    │
    ├── questions → Open/exploring questions
    │
    └── pinned_images → Image wall titles
```

---

## Indexes

### Performance-Critical Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `history` | `idx_history_created` | `created_at DESC` | Chronological queries |
| `history` | `idx_history_type` | `type` | Type filtering |
| `history` | `idx_history_summarized` | `summarized_at` | Context queries |
| `history` | `idx_history_cycle` | `cycle_id` | Cycle linkage |
| `cycles` | `idx_cycles_created` | `created_at DESC` | Recent cycles |
| `cycles` | `idx_cycles_status` | `status` | Error monitoring |
| `summaries` | `idx_summaries_active` | `archived_at` | Active summaries |
| `learned` | `idx_learned_confidence` | `confidence` | Confidence filtering |
| `questions` | `idx_questions_status` | `status` | Status filtering |
| `memory_overrides` | `idx_memory_overrides_branch` | `branch_id, target_table` | Branch lookups |

---

## Migration History

| Version | File | Tables Added/Modified |
|---------|------|----------------------|
| v1 | `schema.sql` | `history`, `cold_storage`, `state` |
| v2 | `migration_v2.sql` | `notebook`, `summaries` |
| v3 | `migration_v3_reminders.sql` | `reminders` |
| v4 | `migration_v4_observations.sql` | `user_observations` |
| v5 | `migration_v5_history_archive.sql` | `history.summarized_at` |
| v6 | `migration_v6_cycles.sql` | `cycles`, `image_assets`, `history.cycle_id` |
| v7 | `migration_v7_batches.sql` | `pending_batches` |
| v8 | `migration_v8_notebook_timestamps.sql` | `notebook.last_viewed_at` |
| v9 | `migration_v9_memory_branches.sql` | `memory_branches`, `memory_overrides`, `synthetic_memories` |
| v10 | `migration_v10_reminder_soft_delete.sql` | `reminders.dismissed_at` |
| v11 | `migration_v11_smart_summaries.sql` | `summaries.*` (metadata, embedding, archival) |
| v12 | `migration_v12_secure_attachment.sql` | `learned`, `questions` |
| v13 | `migration_v13_voice_history.sql` | `voice_history` |
| v14 | `migration_v14_clios_home.sql` | `pinned_images`, `pending_view_images` |
| v15 | `migration_v15_notebook_embeddings.sql` | `notebook.embedding`, `notebook.embedding_model` |
| v16 | `migration_v16_glossary.sql` | `glossary` |
| v17 | `migration_v17_personas.sql` | `personas`, `persona_id` FK on all memory/config tables |
| v18-v22 | (various internal) | See `worker/src/index.js` for migration handlers |
| v23 | inline | `history.meter_snapshot` - meter state tracking |
| v24 | inline | `summaries.covered_start`, `summaries.sort_position` |
| v25 | inline | `summaries.tier`, `summaries.tier_position` - explicit tier model |

---

## D1 Gotchas

1. **Null vs Undefined:** D1 accepts `null` but NOT `undefined`. Always use `value ?? null`.

2. **No FK Enforcement:** Foreign keys are declared but not enforced by SQLite/D1.

3. **Row Size Limit:** ~900KB max per row. Images must be compressed.

4. **LIKE Pattern Complexity:** Long strings in `%...%` patterns can cause errors.

5. **Timestamps:** All stored as ISO 8601 strings in UTC.
