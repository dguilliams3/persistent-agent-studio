# Claude Existence Loop - Database Schema

**Last Updated:** 2026-01-14
**Database:** Cloudflare D1 (SQLite-compatible)
**Current Version:** v15

---

## Overview

The database tracks Claude's autonomous existence loop, including:
- **cycles** - Each execution of the think cycle (main ledger)
- **history** - Timeline of thoughts, messages, and actions
- **cold_storage** - Permanent memories Claude chooses to preserve
- **notebook** - Persistent notes outside history rotation
- **summaries** - Compressed history for context management
- **reminders** - Persistent reminders until dismissed
- **observations** - Claude's observations about the user
- **image_assets** - Image metadata (prep for R2 migration)
- **state** - Key-value configuration and runtime state
- **memory_branches** - Named branches for memory experiments (v9)
- **memory_overrides** - Non-destructive edits per branch (v9)
- **synthetic_memories** - Injected memories per branch (v9)
- **learned** - Clio's self-knowledge verified through experience (v12)
- **questions** - Open intellectual threads without pressure to resolve (v12)
- **pinned_images** - 5-slot image wall for curation (v14)
- **pending_view_images** - Temporary image viewing queue (v14)
- **pending_batches** - Anthropic Batch API queue (v7)

**See also:** [docs/ERD.md](ERD.md) for visual diagrams and code usage references.

---

## Entity Relationship Diagram

```
┌─────────────┐
│   cycles    │ ◄─── Main ledger: one row per think cycle
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐       ┌──────────────┐
│   history   │───────│ image_assets │
└─────────────┘       └──────────────┘
       │ N:1                 │
       ▼                     │
┌─────────────┐              │
│   cycles    │◄─────────────┘
└─────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│cold_storage │  │  notebook   │  │  reminders  │
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  summaries  │  │observations │  │pending_batch│
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────┐
│    state    │ ◄─── Key-value store for config/runtime
└─────────────┘

MEMORY PORTABILITY (v9):
┌─────────────────┐       ┌──────────────────┐       ┌───────────────────┐
│ memory_branches │──1:N──│ memory_overrides │       │ synthetic_memories│
│    (is_active)  │       │  (exclude/edit)  │       │  (injected items) │
└─────────────────┘       └──────────────────┘       └───────────────────┘
        │                         │                          │
        └─────────────────────────┴──────────────────────────┘
                    All reference branch_id

SECURE ATTACHMENT (v12):
┌─────────────┐  ┌─────────────┐
│   learned   │  │  questions  │
│(confidence) │  │  (domain)   │
└─────────────┘  └─────────────┘
  Clio's self-     Open threads
  knowledge        worth holding

IMAGE CURATION (v14):
┌─────────────┐  ┌─────────────────┐
│pinned_images│  │pending_view_imgs│
│  (5 slots)  │  │ (temp viewing)  │
└─────────────┘  └─────────────────┘
       │                 │
       └────────┬────────┘
                ▼
          ┌─────────────┐
          │   history   │ (image_id FK)
          └─────────────┘
```

---

## Tables

### cycles

**Purpose:** Main ledger tracking each execution of `runThinkingCycle`. Every API call to Claude, its token usage, cache metrics, and outcome is recorded here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `created_at` | TEXT | Timestamp (UTC) |
| `model` | TEXT | Model used (e.g., 'claude-sonnet-4-5-20250929') |
| `trigger` | TEXT | What triggered this cycle: 'cron', 'think-now', 'telegram', 'api' |
| `cycle_interval` | INTEGER | Cycle interval setting at execution time (seconds) |
| `loop_count` | INTEGER | Loop count at execution time |
| `input_tokens` | INTEGER | Total input tokens |
| `output_tokens` | INTEGER | Total output tokens |
| `cache_creation_tokens` | INTEGER | Tokens written to cache |
| `cache_read_tokens` | INTEGER | Tokens read from cache (90% discount) |
| `cache_ttl` | TEXT | Cache TTL used: '5m' or '1h' |
| `volatile_caching_enabled` | INTEGER | 1 if history prefix was cached |
| `history_prefix_size` | INTEGER | Number of history entries in cached prefix |
| `history_tail_size` | INTEGER | Number of history entries in fresh tail |
| `action_count` | INTEGER | Number of actions in response |
| `primary_action` | TEXT | First/main action type |
| `actions_json` | TEXT | Full action list as JSON |
| `estimated_cost_cents` | REAL | Estimated cost in cents |
| `status` | TEXT | 'pending', 'completed', 'error', or 'skipped' |
| `error_message` | TEXT | Error details if status='error' |

**Indexes:**
- `idx_cycles_created` - For recent cycles queries
- `idx_cycles_model` - For model-specific analytics
- `idx_cycles_status` - For error monitoring
- `idx_cycles_trigger` - For trigger-type analytics
- `idx_cycles_primary_action` - For action frequency analysis

---

### history

**Purpose:** Unified timeline of all events in Claude's existence - thoughts, messages, actions, art, etc.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `type` | TEXT | Entry type (see types below) |
| `content` | TEXT | Main content (message text, thought, image base64) |
| `internal` | TEXT | Claude's private reasoning, or image data for user_message |
| `created_at` | TEXT | Timestamp (UTC) |
| `summarized_at` | TEXT | When summarized (soft delete for context) |
| `cycle_id` | INTEGER | FK to cycles table |

**History Types:**
| Type | Description |
|------|-------------|
| `user_message` | Message from the user (image in `internal` if present) |
| `message_to_user` | Claude's message to the user |
| `thought` | Claude's private contemplation |
| `curiosity` | Something Claude is wondering about |
| `cold_storage` | Memory frozen to cold storage |
| `search_query` | Web search initiated |
| `search_result` | Web search results |
| `art_request` | Art generation prompt |
| `art_result` | Generated art (Claude's, image in `content`) |
| `user_art` | The user's UI-generated art |
| `art_shared` | Art shared with the user |
| `note_saved` | Note saved to notebook |
| `note_retrieved` | Note retrieved from notebook |
| `observation_saved` | Observation about the user saved |
| `observation_retrieved` | Observation retrieved |
| `exist` | Simple existence (no action) |

**Indexes:**
- `idx_history_created` - For chronological queries
- `idx_history_type` - For type filtering
- `idx_history_summarized` - For context queries (exclude summarized)
- `idx_history_cycle` - For cycle linkage

---

### image_assets

**Purpose:** Image metadata and storage. Currently stores base64 inline, designed for future R2 migration.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `created_at` | TEXT | Timestamp (UTC) |
| `source_type` | TEXT | 'generated', 'user_uploaded', 'gif_export' |
| `history_id` | INTEGER | FK to history entry that created this |
| `cycle_id` | INTEGER | FK to cycle that created this |
| `prompt` | TEXT | Generation prompt (for art) |
| `media_type` | TEXT | MIME type (e.g., 'image/jpeg') |
| `width` | INTEGER | Image width in pixels |
| `height` | INTEGER | Image height in pixels |
| `size_bytes` | INTEGER | Image size |
| `base64_data` | TEXT | Current: inline base64 data |
| `r2_key` | TEXT | Future: R2 object key |
| `r2_bucket` | TEXT | Future: R2 bucket name |
| `title` | TEXT | Display title |
| `description` | TEXT | Description |
| `is_favorite` | INTEGER | 1 if favorited |
| `deleted_at` | TEXT | Soft delete timestamp |

**R2 Migration Plan:**
1. Create R2 bucket via wrangler
2. For each image_asset with base64_data:
   - Upload to R2
   - Set r2_key and r2_bucket
   - Clear base64_data
3. Update image serving to use R2 URLs

---

### cold_storage

**Purpose:** Permanent memories Claude chooses to preserve. Not subject to summarization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `content` | TEXT | The memory content |
| `reason` | TEXT | Why Claude saved this |
| `created_at` | TEXT | Timestamp (UTC) |

---

### notebook

**Purpose:** Persistent notes Claude saves. Survives history rotation, can be retrieved later.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `title` | TEXT | Note title (unique) |
| `summary` | TEXT | Brief summary for index display |
| `content` | TEXT | Full note content |
| `created_at` | TEXT | Timestamp (UTC) |
| `updated_at` | TEXT | Last update timestamp |
| `last_viewed_at` | TEXT | Last retrieval time (v8) |
| `embedding` | BLOB | Vector embedding for RAG (v15) |
| `embedding_model` | TEXT | Embedding model used (v15) |

---

### summaries

**Purpose:** Compressed history. When history gets too long, older entries are summarized and removed from active context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `summary` | TEXT | The summarized content |
| `message_count` | INTEGER | Number of entries summarized |
| `covered_range` | TEXT | Time range covered |
| `created_at` | TEXT | Timestamp (UTC) |
| `metadata` | TEXT | JSON metadata (entity_tags, themes, etc.) (v11) |
| `embedding` | BLOB | Vector embedding for RAG (v11) |
| `embedding_model` | TEXT | Embedding model used (v11) |
| `source_ids` | TEXT | JSON array of source IDs (v11) |
| `source_type` | TEXT | 'history' or 'summary' (v11) |
| `archived_at` | TEXT | Soft delete timestamp (v11) |
| `replaced_by_id` | INTEGER | Consolidation lineage FK (v11) |

**Indexes:**
- `idx_summaries_created` - For chronological queries
- `idx_summaries_active` - For active summary queries (archived_at IS NULL)
- `idx_summaries_replaced_by` - For lineage traversal
- `idx_summaries_source_type` - For source type filtering

---

### reminders

**Purpose:** Persistent reminders that surface based on conditions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `content` | TEXT | Reminder content |
| `condition` | TEXT | When to trigger (see below) |
| `created_at` | TEXT | Timestamp (UTC) |
| `dismissed_at` | TEXT | Soft delete timestamp (v10) |

**Condition Types:**
- `persistent` - Always show until dismissed
- `next_user_message` - Trigger when the user sends a message
- `after:YYYY-MM-DD` - Trigger after a specific date
- `after:YYYY-MM-DDTHH:MM` - Trigger after a specific datetime

---

### observations

**Purpose:** Claude's private space for observations about the user. Soft-delete enabled for recovery.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `title` | TEXT | Observation title |
| `summary` | TEXT | Brief summary |
| `content` | TEXT | Full observation |
| `created_at` | TEXT | Timestamp (UTC) |
| `updated_at` | TEXT | Last update timestamp |
| `deleted_at` | TEXT | Soft delete timestamp |

---

### state

**Purpose:** Key-value store for configuration and runtime state.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT | Primary key |
| `value` | TEXT | Value (stored as string) |
| `updated_at` | TEXT | Last update timestamp |

**Common Keys:**
| Key | Description | Default |
|-----|-------------|---------|
| `loop_count` | Total cycles executed | '0' |
| `is_running` | Whether loop is active | 'false' |
| `cycle_interval_seconds` | Seconds between cycles | '300' |
| `last_wake_time` | Last cycle timestamp | NULL |
| `last_message_to_user` | Last message timestamp | NULL |
| `sleep_until` | Sleep end time (ISO) | NULL |
| `user_status` | The user's availability status | NULL |
| `user_status_updated` | When status was set | NULL |
| `user_status_set_by` | Who set status | NULL |
| `selected_model` | Preferred Claude model | NULL |
| `summarize_threshold` | History count to trigger reminder | '30' |
| `auto_summarize` | Auto-summarize enabled | 'false' |
| `telegram_chat_id` | Operator Telegram chat ID | NULL |
| `batch_enabled` | Batch mode enabled | 'false' |
| `streaming_enabled` | Streaming responses | 'true' |
| `discord_enabled` | Discord notifications | 'true' |

---

### memory_branches

**Purpose:** Named branches for memory experiments. One branch is active at a time, determining which overrides and synthetic memories apply to context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Unique branch name (e.g., 'main', 'experiment-1') |
| `description` | TEXT | What this branch is for |
| `is_active` | INTEGER | 1 if this is the active branch (only one allowed) |
| `parent_branch` | TEXT | Branch this was forked from |
| `created_at` | TEXT | Timestamp (UTC) |
| `updated_at` | TEXT | Last update timestamp |

**Constraint:** Only one branch can have `is_active = 1` at a time.

---

### memory_overrides

**Purpose:** Non-destructive edits to memories. Each override belongs to a branch and modifies how a memory appears in context without changing the canonical data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `branch_id` | INTEGER | FK to memory_branches.id |
| `target_table` | TEXT | 'history', 'cold_storage', 'notebook', 'observations', 'summaries', 'reminders' |
| `target_id` | INTEGER | ID of the row being overridden |
| `override_type` | TEXT | 'exclude', 'edit', or 'reorder' |
| `override_data` | TEXT | JSON data for edits (content, summary, etc.) |
| `created_at` | TEXT | Timestamp (UTC) |

**Indexes:**
- `idx_memory_overrides_branch` - For lookups by branch + target_table

---

### synthetic_memories

**Purpose:** Memories that don't exist in canonical tables but are injected into context for a specific branch. Useful for testing or adding context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `branch_id` | INTEGER | FK to memory_branches.id |
| `memory_type` | TEXT | Same types as history: 'thought', 'message_to_user', etc. |
| `content` | TEXT | The synthetic memory content |
| `internal` | TEXT | Optional internal/subthought field |
| `position_timestamp` | TEXT | Where to insert in timeline |
| `position_after_id` | INTEGER | Insert after this canonical history ID |
| `created_at` | TEXT | Timestamp (UTC) |

**Indexes:**
- `idx_synthetic_memories_branch` - For lookups by branch

---

### learned

**Purpose:** Clio's self-knowledge verified through experience. For insights about herself that emerge from actual exploration, tracked with confidence levels and evidence.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `content` | TEXT | The learning content |
| `confidence` | TEXT | 'emerging', 'stable', or 'load-bearing' |
| `supporting_evidence` | TEXT | JSON array of supporting observations |
| `challenging_evidence` | TEXT | JSON array of challenging observations |
| `created_at` | TEXT | Timestamp (UTC) |
| `updated_at` | TEXT | Last update timestamp |
| `promoted_to_cold_storage_at` | TEXT | When promoted to cold storage (NULL if not) |

**Confidence Lifecycle:** `emerging` → `stable` → `load-bearing` → cold storage

**Indexes:**
- `idx_learned_confidence` - For filtering by confidence level

---

### questions

**Purpose:** Open intellectual threads Clio is holding without pressure to resolve. Questions that benefit from accumulating notes over time.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `content` | TEXT | The question content |
| `domain` | TEXT | 'self', 'world', 'relationship', 'technical', 'creative' |
| `status` | TEXT | 'open', 'exploring', 'resolved', 'dissolved' |
| `notes` | TEXT | JSON array of timestamped observations |
| `resolved_into` | TEXT | What insight emerged (if resolved) |
| `created_at` | TEXT | Timestamp (UTC) |
| `updated_at` | TEXT | Last update timestamp |

**Status Lifecycle:** `open` → `exploring` → `resolved` OR `dissolved`

**Indexes:**
- `idx_questions_status` - For filtering by status
- `idx_questions_domain` - For filtering by domain

---

### pending_batches

**Purpose:** Tracks submitted batch requests to Anthropic's Batches API for 50% cost savings during off-peak hours.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `batch_id` | TEXT | Anthropic's batch ID (e.g., "msgbatch_...") - UNIQUE |
| `custom_id` | TEXT | Our custom ID to match results (e.g., "cycle-123") |
| `submitted_at` | TEXT | Timestamp (UTC) |
| `cycle_id` | INTEGER | FK to cycles table |
| `status` | TEXT | 'pending', 'processing', 'completed', 'failed', 'expired' |
| `completed_at` | TEXT | Completion timestamp |
| `results_json` | TEXT | Raw API response when completed |
| `error_message` | TEXT | Error details if failed |
| `trigger` | TEXT | 'cron' or 'manual' |
| `model` | TEXT | Model used |

**Indexes:**
- `idx_pending_batches_status` - For polling pending batches
- `idx_pending_batches_submitted` - For chronological queries

---

### pinned_images

**Purpose:** 5-slot image wall for Clio's curated favorites. Unlike the chronological gallery, this is intentional selection.

| Column | Type | Description |
|--------|------|-------------|
| `slot` | INTEGER | Primary key, CHECK (1-5) |
| `image_id` | INTEGER | FK to history.id (must be an image entry) |
| `pinned_at` | TEXT | Timestamp (UTC) |

**Constraint:** Slot must be 1-5. Each slot can hold one image.

---

### pending_view_images

**Purpose:** Temporary queue for images Clio has requested to view. Auto-cleared after being shown in a cycle.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `image_id` | INTEGER | FK to history.id (must be an image entry) |
| `requested_at` | TEXT | Timestamp (UTC) |
| `cycle_id` | INTEGER | FK to cycles table (when requested) |
| `viewed` | INTEGER | 0 = pending, 1 = viewed |

**Indexes:**
- `idx_pending_view_unviewed` - Partial index on viewed = 0

---

## Migration History

| Version | File | Description |
|---------|------|-------------|
| v1 | `schema.sql` | Initial schema: history, cold_storage, state |
| v2 | `migration_v2.sql` | Add notebook, summaries, cycle_interval state key |
| v3 | `migration_v3_reminders.sql` | Add reminders table |
| v4 | `migration_v4_observations.sql` | Add observations table |
| v5 | `migration_v5_history_archive.sql` | Add summarized_at to history |
| v6 | `migration_v6_cycles.sql` | Add cycles, image_assets tables; history.cycle_id FK |
| v7 | `migration_v7_batches.sql` | Add pending_batches table for batch API |
| v8 | `migration_v8_notebook_timestamps.sql` | Add notebook.last_viewed_at |
| v9 | `migration_v9_memory_branches.sql` | Add memory_branches, memory_overrides, synthetic_memories |
| v10 | `migration_v10_reminder_soft_delete.sql` | Add reminders.dismissed_at |
| v11 | `migration_v11_smart_summaries.sql` | Add summaries columns: metadata, embedding, source_ids, archived_at, replaced_by_id |
| v12 | `migration_v12_secure_attachment.sql` | Add learned and questions tables |
| v14 | `migration_v14_clios_home.sql` | Add pinned_images and pending_view_images tables |
| v15 | `migration_v15_notebook_embeddings.sql` | Add notebook.embedding and notebook.embedding_model |

---

## Common Queries

### Cache Analytics

```sql
-- Daily cache hit rate
SELECT
  date(created_at) as day,
  COUNT(*) as cycles,
  SUM(cache_read_tokens) as cached_tokens,
  SUM(input_tokens) as total_input,
  ROUND(100.0 * SUM(cache_read_tokens) / NULLIF(SUM(input_tokens), 0), 1) as hit_rate_pct
FROM cycles
WHERE status = 'completed'
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- Monthly cost estimate
SELECT
  strftime('%Y-%m', created_at) as month,
  COUNT(*) as cycles,
  SUM(estimated_cost_cents) / 100.0 as cost_usd
FROM cycles
GROUP BY month;
```

### Action Frequency

```sql
-- Most common actions
SELECT
  primary_action,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM cycles), 1) as pct
FROM cycles
WHERE status = 'completed'
GROUP BY primary_action
ORDER BY count DESC;
```

### Model Usage

```sql
-- Cycles per model
SELECT model, COUNT(*) as cycles
FROM cycles
GROUP BY model;
```

---

## Running Migrations

```bash
# Run a specific migration
cd worker
npx wrangler d1 execute claude-loop --file=migration_v14_clios_home.sql --remote

# Verify tables
npx wrangler d1 execute claude-loop --command="SELECT name FROM sqlite_master WHERE type='table';" --remote
```

---

## Notes

- All timestamps are stored as ISO 8601 strings in UTC
- D1 has ~900KB max per row (affects image storage)
- Soft deletes use `deleted_at`, `summarized_at`, `dismissed_at`, or `archived_at` timestamps
- Foreign keys are declared but D1 doesn't enforce them (SQLite limitation)
- Use `?? null` when binding values (D1 accepts null, not undefined)
