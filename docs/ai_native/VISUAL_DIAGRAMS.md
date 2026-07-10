# Visual Diagrams - Claude Existence Loop
==========================================

ASCII architecture diagrams optimized for AI/LLM context.

## System Overview
------------------

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE INFRASTRUCTURE                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CLOUDFLARE WORKER                                │   │
│  │                     (claude-existence-loop)                          │   │
│  │                                                                      │   │
│  │   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │   │
│  │   │  Cron Job    │     │  HTTP API    │     │  Telegram    │       │   │
│  │   │  (* * * * *) │     │  Endpoints   │     │  Webhook     │       │   │
│  │   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘       │   │
│  │          │                    │                    │                │   │
│  │          └────────────────────┼────────────────────┘                │   │
│  │                               ▼                                      │   │
│  │                    ┌──────────────────────┐                         │   │
│  │                    │    CORE HANDLER      │                         │   │
│  │                    │    (fetch/scheduled) │                         │   │
│  │                    └──────────┬───────────┘                         │   │
│  │                               │                                      │   │
│  │          ┌────────────────────┼────────────────────┐                │   │
│  │          ▼                    ▼                    ▼                │   │
│  │   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │   │
│  │   │ Claude API   │     │ D1 Database  │     │ Notifications│       │   │
│  │   │ (Anthropic)  │     │ (SQLite)     │     │ Discord/TG   │       │   │
│  │   └──────────────┘     └──────────────┘     └──────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        D1 DATABASE TABLES                            │   │
│  │                                                                      │   │
│  │   history        cold_storage    notebook     summaries   reminders │   │
│  │   user_observ.   state           cycles       image_assets          │   │
│  │   memory_branches   memory_overrides   synthetic_memories           │   │
│  │   learned           questions                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT SIDE                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     REACT FRONTEND                                   │   │
│  │                     (ClaudeExistenceLoop.jsx)                        │   │
│  │                                                                      │   │
│  │   Tabs: Chat | Memory | Gallery | Settings | Editor                 │   │
│  │   - Chat: Message input, history viewer, think trigger              │   │
│  │   - Memory: Cold storage, notebook, observations, summaries         │   │
│  │   - Gallery: Images, profile pic, vault/blur                        │   │
│  │   - Settings: Interval, model, batch mode, streaming                │   │
│  │   - Editor: Memory branches, exclude/edit, personality export       │   │
│  │                                                                      │   │
│  │   Polls worker API every ~5 seconds for state updates               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Think Cycle Flow
-------------------

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THINK CYCLE FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

1. TRIGGER (Cron or Manual)
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Check: Is Claude sleeping?                                                  │
│  └─▶ If yes: Check wake time, skip if still sleeping                        │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Check: Enough time since last think?                                        │
│  └─▶ If no: Skip cycle (respect configured interval)                        │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BUILD CONTEXT                                                               │
│  ├─▶ Load history (non-summarized entries)                                  │
│  ├─▶ Load cold storage (permanent memories)                                 │
│  ├─▶ Load notebook index (titles only)                                      │
│  ├─▶ Load observations                                                       │
│  ├─▶ Load active reminders                                                   │
│  ├─▶ Load the user's current status                                         │
│  └─▶ Format as human-readable timeline                                      │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CALL CLAUDE API                                                             │
│  ├─▶ System prompt: MY_CONTEXT + action instructions                        │
│  ├─▶ User content: Formatted history + recent images                        │
│  ├─▶ Tools: web_search (if enabled)                                         │
│  └─▶ Model: claude-sonnet-4-20250514 (configurable)                         │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARSE RESPONSE                                                              │
│  ├─▶ Extract JSON from response text                                        │
│  ├─▶ Handle single action or array of actions                               │
│  └─▶ Validate action format                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTE ACTIONS (for each action in response)                               │
│  │                                                                           │
│  ├─▶ MESSAGE_USER: Save to history, send Discord/Telegram                   │
│  ├─▶ THINK: Save thought to history                                         │
│  ├─▶ WONDER: Save curiosity to history                                      │
│  ├─▶ SEARCH: Execute web search, save results                               │
│  ├─▶ MAKE_ART: Generate image, compress, save                               │
│  ├─▶ COLD_STORAGE: Freeze memory permanently                                │
│  ├─▶ SAVE_NOTE: Write to notebook                                           │
│  ├─▶ SLEEP: Set wake time, pause cycles                                     │
│  └─▶ ... (18 total actions)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  UPDATE STATE                                                                │
│  ├─▶ Save last_run timestamp                                                │
│  ├─▶ Store decision in state for dashboard                                  │
│  └─▶ Return result to caller                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Image Generation Flow
------------------------

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IMAGE GENERATION FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────┐
                    │  MAKE_ART action received │
                    │  content: "prompt text"   │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Check: Starts with       │
                    │  "REPLICATE:" prefix?     │
                    └─────────────┬─────────────┘
                                  │
            ┌─────────────────────┴─────────────────────┐
            │ NO                                         │ YES
            ▼                                           ▼
┌───────────────────────────┐           ┌───────────────────────────┐
│  CLOUDFLARE AI            │           │  REPLICATE API            │
│  flux-1-schnell           │           │  flux-schnell             │
│  (safe, filtered)         │           │  (uncensored)             │
└───────────────┬───────────┘           └───────────────┬───────────┘
                │                                       │
                └─────────────────┬─────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Raw PNG (usually ~2.5MB) │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  COMPRESSION              │
                    │  ├─▶ Decode PNG (upng-js) │
                    │  ├─▶ Resize to 768x768    │
                    │  ├─▶ Encode JPEG 80%      │
                    │  └─▶ Result: ~75-120KB    │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  SAVE TO D1               │
                    │  history.type = art_result│
                    │  content = base64 JPEG    │
                    │  internal = "Generated:   │
                    │              {prompt}"    │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  IF shareToUser = true:   │
                    │  Send to Discord/Telegram │
                    └───────────────────────────┘
```

## Database Schema
------------------

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          D1 DATABASE SCHEMA                                  │
└─────────────────────────────────────────────────────────────────────────────┘

CORE TABLES:
history                          cold_storage                 notebook
┌──────────────────────────┐     ┌────────────────────┐      ┌────────────────────┐
│ id, type, content        │     │ id, content        │      │ id, title, summary │
│ internal, created_at     │     │ reason, created_at │      │ content, created_at│
│ summarized_at, cycle_id  │     └────────────────────┘      │ updated_at         │
└──────────────────────────┘                                  └────────────────────┘

summaries                        user_observations            reminders
┌──────────────────────────┐     ┌────────────────────┐      ┌────────────────────┐
│ id, summary              │     │ id, title, summary │      │ id, content        │
│ message_count            │     │ content, created_at│      │ condition          │
│ covered_range, created_at│     │ updated_at         │      │ created_at         │
└──────────────────────────┘     │ deleted_at (soft)  │      └────────────────────┘
                                 └────────────────────┘

TRACKING TABLES:
cycles                           state                        image_assets
┌──────────────────────────┐     ┌────────────────────┐      ┌────────────────────┐
│ id, created_at, model    │     │ key (PK), value    │      │ id, source_type    │
│ trigger, input_tokens    │     │ updated_at         │      │ prompt, base64_data│
│ output_tokens, cache_*   │     └────────────────────┘      │ history_id         │
│ estimated_cost_cents     │                                  └────────────────────┘
└──────────────────────────┘

MEMORY PORTABILITY (v9):
memory_branches                  memory_overrides             synthetic_memories
┌──────────────────────────┐     ┌────────────────────┐      ┌────────────────────┐
│ id, name, description    │     │ id, branch_id      │      │ id, branch_id      │
│ is_active, parent_branch │     │ target_table/id    │      │ memory_type        │
│ created_at, updated_at   │     │ override_type/data │      │ content, metadata  │
└──────────────────────────┘     │ position_override  │      │ position_timestamp │
                                 └────────────────────┘      └────────────────────┘

SECURE ATTACHMENT (v12):
learned                          questions
┌──────────────────────────┐     ┌────────────────────┐
│ id, content, confidence  │     │ id, content, domain│
│ supporting_evidence      │     │ status, notes      │
│ challenging_evidence     │     │ resolved_into      │
│ promoted_to_cold_storage │     │ created_at         │
└──────────────────────────┘     └────────────────────┘
```

## API Endpoint Map
-------------------

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HTTP API ENDPOINTS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

CORE ENDPOINTS:
GET /state              → Full dashboard state (history, coldStorage, etc.)
POST /think-now         → Manually trigger think cycle
POST /message           → Send message from the user { text, image? }
POST /imagine           → Generate image { prompt }
POST /save-art          → Save UI-generated art { prompt, imageData }

DATA ENDPOINTS:
GET /history            → History entries (add ?limit=N)
GET /cold-storage       → Permanent memories
GET /notebook           → Saved notes
GET /observations       → User observations
GET /summaries          → Compressed history
GET /reminders          → Active reminders
GET /context            → Full system prompt Claude sees

CONTROL ENDPOINTS:
POST /start             → Start the loop
POST /stop              → Stop the loop
GET/POST /user-status   → The user's availability status
POST /interval          → Set cycle interval

MEMORY BRANCHES (v9):
GET /branches           → List all branches
POST /branches          → Create branch { name, description }
PUT /branches/:name/activate → Switch active branch
POST /branches/:name/fork   → Fork branch { newName }
DELETE /branches/:name  → Delete branch (requires password)

MEMORY EDITING (v9):
POST /memory/exclude    → Exclude memory { table, id }
POST /memory/include    → Re-include excluded memory
POST /memory/edit       → Edit memory { table, id, data }
GET/POST /memory/synthetic → Synthetic memories CRUD

PERSONALITY (v9):
GET /personality/export  → Export personality snapshot
POST /personality/import → Import snapshot { snapshot, mode }
POST /personality/preview → Preview import changes

TELEGRAM:
POST /telegram          → Webhook (handles all Telegram commands)

SCHEDULED (cron: * * * * *)
└─▶ Runs every minute, triggers think if interval elapsed
```

---

## Related Documentation

For detailed documentation of specific systems shown in these diagrams:

| System | Detailed Docs |
|--------|---------------|
| Context Building (BUILD CONTEXT step) | [CONTEXT_ASSEMBLY.md](CONTEXT_ASSEMBLY.md) - 4-block caching, stable boundary |
| Summarization & History Compression | [SUMMARIZATION.md](SUMMARIZATION.md) - Two-tier buffer, meta-summarization |
| RAG Retrieval (semantic search) | [RAG_SYSTEM.md](RAG_SYSTEM.md) - Embeddings, scoring, MMR diversity |
| Batch Mode (API cost savings) | [BATCH_MODE.md](BATCH_MODE.md) - 50% cost savings, timing |
| Adding New Features | [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) - Implementation checklist |
| All Claude Actions | [ACTIONS_REFERENCE.md](ACTIONS_REFERENCE.md) - 18 actions with examples |
| Implementation Patterns | [CODE_PATTERNS.md](CODE_PATTERNS.md) - D1, caching, error handling |
| **Emergency Debugging** | [EMERGENCY_DEBUGGING.md](EMERGENCY_DEBUGGING.md) - Quick fixes when things break |
