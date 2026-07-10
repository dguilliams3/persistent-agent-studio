# API Reference

> Comprehensive reference for the Claude Existence Loop REST API and Telegram Bot.

**Base URL:** `https://your-worker.workers.dev`

**Last Updated:** 2026-02-03

---

## Table of Contents

- [Authentication](#authentication)
- [Request/Response Conventions](#requestresponse-conventions)
- [REST Endpoints](#rest-endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Loop State & Configuration](#loop-state--configuration)
  - [History](#history)
  - [Memory (Cold Storage, Notebook, Observations)](#memory)
  - [Summaries](#summaries)
  - [Summarization Operations](#summarization-operations)
  - [Reminders](#reminders)
  - [Meters (Internal State)](#meters-internal-state)
  - [Gallery & Images](#gallery--images)
  - [Messaging](#messaging)
  - [Web Search](#web-search)
  - [Memory Branches](#memory-branches)
  - [Memory Manipulation](#memory-manipulation)
  - [Personality Snapshots](#personality-snapshots)
  - [Personas](#personas)
  - [Self-Knowledge (Learned & Questions)](#self-knowledge)
  - [TTS & Voice](#tts--voice)
  - [Transcription](#transcription)
  - [Glossary (STT Corrections)](#glossary)
  - [Settings & Toggles](#settings--toggles)
  - [Model Selection](#model-selection)
  - [Thinking & Actions](#thinking--actions)
  - [Batches](#batches)
  - [Media](#media)
  - [SIM (Semantic Identity Map)](#sim)
  - [Admin & Maintenance](#admin--maintenance)
  - [Misc](#misc)
- [Telegram Bot Commands](#telegram-bot-commands)
- [Routing Infrastructure](#routing-infrastructure)

---

## Authentication

The API uses **four authentication mechanisms**, none of which function as global middleware. Auth is checked per-endpoint inline.

### 1. ADMIN_PASSWORD (Most Common)

Password sent in request body. Required for destructive operations (DELETE, /reset, /migrate).

```bash
curl -X DELETE "$BASE/history/123" \
  -H "Content-Type: application/json" \
  -d '{"password":"<ADMIN_PASSWORD>"}'
```

### 2. JWT Bearer Token

Used by `/auth/*` endpoints. Not enforced on data endpoints.

```bash
curl -X POST "$BASE/auth/login" \
  -d '{"username":"admin","password":"<PASSWORD>"}'
# Returns: { token: "eyJ..." }

curl "$BASE/auth/status" -H "Authorization: Bearer <token>"
```

### 3. Telegram initData (HMAC)

For Telegram Mini App. Server validates `X-Telegram-Init-Data` header against bot token. Currently only used by `DELETE /glossary/:id`.

### 4. Internal Admin Header

`POST /personas` uses `x-internal-admin-password` header (worker self-injects).

### Protected Endpoints Summary

| Endpoint | Method | Auth Type |
|----------|--------|-----------|
| `/reset` | POST | ADMIN_PASSWORD |
| `/migrate` | POST | ADMIN_PASSWORD (fallback: `tigger1214`) |
| `/bulk-archive` | POST | ADMIN_PASSWORD |
| `/reset-history-boundary` | POST | ADMIN_PASSWORD (optional) |
| `/branches/:name` | DELETE | ADMIN_PASSWORD |
| `/memory/synthetic/:id` | DELETE | ADMIN_PASSWORD |
| `/memory/override/:id` | DELETE | ADMIN_PASSWORD |
| `/history/:id` | DELETE | ADMIN_PASSWORD |
| `/learned/:id` | DELETE | ADMIN_PASSWORD |
| `/voice-transcriptions/:id` | DELETE | ADMIN_PASSWORD |
| `/glossary/:id` | DELETE | ADMIN_PASSWORD or Telegram initData |
| `/personality/import` (replace) | POST | ADMIN_PASSWORD |
| `/personas` | POST | x-internal-admin-password header |
| `/personas/:id/fork` | POST | ADMIN_PASSWORD |

**All other endpoints are public (no auth required).**

### CORS

Fully open: `Access-Control-Allow-Origin: *`. All methods. All responses include CORS headers.

### Rate Limiting

Only `/auth/login`: 5 failed attempts per IP per hour.

---

## Request/Response Conventions

### Request Body

POST/PUT/DELETE requests send JSON:
```bash
curl -X POST "$BASE/endpoint" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Response Format

All responses are JSON with CORS headers:
```json
{
  "success": true,
  "data": "..."
}
```

Errors:
```json
{
  "error": "Description of what went wrong"
}
```

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request / validation error |
| 401 | Unauthorized (wrong password) |
| 404 | Not found |
| 429 | Rate limited (login only) |
| 500 | Internal server error |

### Cache-Control Tiers

GET responses use tiered caching:

| Tier | max-age | stale-while-revalidate | Endpoints |
|------|---------|----------------------|-----------|
| Static | 24h | -- | `/pricing` |
| Low | 5min | 1h | `/personas`, `/branches`, `/observations`, `/glossary` |
| Medium | 30s | 10min | `/cold-storage`, `/summaries`, `/gallery`, `/cycles` |
| High | 5s | 30s | `/state`, `/history`, `/meters` |

POST/PUT/DELETE always return `no-store, no-cache`.

---

## REST Endpoints

### Authentication Endpoints

#### POST /auth/login
Login and receive JWT token. Rate limited (5 attempts/IP/hour).
- **Body:** `{ username: string, password: string }`
- **Response:** JWT token on success

#### POST /auth/verify
Verify a JWT token.
- **Headers:** `Authorization: Bearer <token>`
- **Response:** `{ valid: boolean, user?: { username }, expires?: number }`

#### GET /auth/status
Check auth status without credentials.
- **Response:** `{ authenticated: boolean, user?: {...} }`

#### POST /auth/logout
Client-side only (no token blacklist).

---

### Loop State & Configuration

#### GET /state
Current loop state.
- **Response:**
```json
{
  "loopCount": 1234,
  "lastWakeTime": "2026-02-03T...",
  "isRunning": true,
  "cycleIntervalSeconds": 300,
  "currentStatus": "Reflecting on recent events",
  "selectedModel": "claude-sonnet-4-20250514",
  "activeHistoryCount": 42
}
```

#### GET /context
Full system prompt with token stats.
- **Response:** `{ systemPrompt, stats: { historyCount, summariesCount, tokenBreakdown, ... }, characterCount }`

#### GET /pricing
Model pricing info.
- **Response:** `{ models: {...}, cache: {...}, batchDiscount: 0.5 }`

---

### History

#### GET /history
- **Query:** `?limit=100&offset=0&includeArchived=true`
- **Response:** `{ history: [...], total, limit, offset, hasMore }`

#### DELETE /history/:id
- **Auth:** ADMIN_PASSWORD
- **Body:** `{ "password": "<ADMIN_PASSWORD>" }`
- **Response:** `{ success: true, deleted_id: 123, type: "thought" }`

---

### Memory

#### GET /cold-storage
Permanent memories. `?limit=N`

#### POST /cold-storage
- **Body:** `{ content: string, context?: string }`
- **Response:** `{ success: true, id: 123 }`

#### DELETE /cold-storage/:id
No password required.

#### GET /notebook
Saved notes.

#### POST /notebook
- **Body:** `{ title: string, content: string }`

#### DELETE /notebook/:title
Title is URL-decoded from path.

#### GET /observations
User observations (soft-delete filtered).

---

### Summaries

#### GET /summaries
All summaries with tier/position metadata.

#### POST /summaries/:id/promote
Move to Block 2 (stable/cached context).

#### POST /summaries/:id/demote
Remove from Block 2.

#### POST /summaries/:id/activate
Move from RAG Archive to Dynamic Tail.

#### POST /summaries/:id/archive
Move from Dynamic Tail to RAG Archive.

#### POST /summaries/:id/position
- **Body:** `{ position: number }`

#### POST /summaries/:id/tier
- **Body:** `{ tier: "cached" | "tail" | "archived" }`

#### POST /summaries/:id/move
- **Body:** `{ tier: string, position?: number }`

#### POST /summaries/backfill-covered-start
Backfill covered_start from covered_range.

#### POST /summaries/backfill-embeddings
Generate embeddings for summaries missing them.

---

### Summarization Operations

#### POST /summarize
- **Body:** `{ count?: number, force?: boolean, notes?: string }`
- **Response:** `{ success: true, count, summary, ... }`

#### POST /metasummarize
- **Body:** `{ ids?: number[], indices?: number[] }`
- **Response:** `{ success: true, newSummaryId, landedIn, archivedIds, durationMs, ... }`

#### POST /bulk-archive
- **Auth:** ADMIN_PASSWORD
- **Body:** `{ password, chunk_size?: 10-200, max_chunks?: 1-50, dry_run?: boolean }`

#### GET /summarization-stats
- **Response:** `{ lastSummarize, lastMeta, currentStats: { historyCount, summarizeThreshold, ... } }`

---

### Reminders

#### GET /reminders
Active reminders.

---

### Meters (Internal State)

#### GET /meters
All meter values, histories, config.

#### POST /meters/:meter/set
- **Body:** `{ value: number, source?: string }`
```bash
curl -X POST "$BASE/meters/curiosity/set" \
  -d '{"value": 8, "source": "web"}'
```

#### POST /meters/batch
- **Body:** `{ changes: { [meterName]: number }, source?: string }`

---

### Gallery & Images

#### GET /gallery
Art images with pagination.

#### DELETE /gallery/:id
- **Body:** `{ confirmed: true }` (no password)

#### POST /gallery/:id/blur
- **Body:** `{ blurred?: boolean }`

#### POST /gallery/:id/vault
- **Body:** `{ vaulted?: boolean }`

#### POST /inject-art
- **Body:** `{ image: string (base64), internal?: string, prompt?: string }`

#### POST /save-art
- **Body:** `{ image: string (base64), prompt?: string }`

#### GET /pinned-images
- **Response:** `{ pins: [...] }`

#### POST /pinned-images
- **Body:** `{ op: "pin"|"unpin"|"swap", slot?, image_id?, slot_a?, slot_b? }`

#### GET /profile-picture
#### POST /profile-picture
- **Body:** `{ image: string (base64) }`
#### DELETE /profile-picture

---

### Messaging

#### POST /message
Send a message from the user.
- **Body:** `{ message: string, image?: string (base64) }`
```bash
curl -X POST "$BASE/message" \
  -d '{"message":"Hey Clio, how are you?"}'
```

---

### Web Search

#### GET /web-search
- **Query:** `?q=search+query`
- **Response:** SearchGateway result `{ success, summary, metadata: { provider, model, tool, durationMs, query } }`
```bash
curl "$BASE/web-search?q=weather+in+Raleigh+NC"
```

#### POST /web-search
- **Body:** `{ query: string, logToHistory?: boolean }`
```bash
curl -X POST "$BASE/web-search" \
  -d '{"query":"weather in Raleigh NC","logToHistory":true}'
```

#### POST /manual-search
- **Body:** `{ query: string }`
- Logs to history as search_query + search_result.

---

### Memory Branches

#### GET /branches
#### POST /branches
- **Body:** `{ name: string, description?: string }`

#### GET /branches/active
#### PUT /branches/:name/activate
#### DELETE /branches/:name
- **Auth:** ADMIN_PASSWORD

#### POST /branches/:name/fork
- **Body:** `{ name: string }`

#### POST /branches/:name/reset

---

### Memory Manipulation

#### POST /memory/exclude
- **Body:** `{ table: string, id: number }`

#### POST /memory/include
- **Body:** `{ table: string, id: number }`

#### POST /memory/edit
- **Body:** `{ table: string, id: number, content: string }`

#### POST /memory/reorder
- **Body:** `{ table: string, id: number, position: number }`

#### GET /memory/synthetic
#### POST /memory/synthetic
- **Body:** `{ memory_type: string, content: string, internal?: string }`

#### PUT /memory/synthetic/:id
- **Body:** `{ content?: string, internal?: string }`

#### DELETE /memory/synthetic/:id
- **Auth:** ADMIN_PASSWORD

#### DELETE /memory/override/:id
- **Auth:** ADMIN_PASSWORD

---

### Personality Snapshots

#### GET /personality/export
Optional password for full export.

#### POST /personality/export
Export with options.

#### GET /personality/export/gallery
Gallery export data.

#### POST /personality/import-gallery
Gallery import data.

#### POST /personality/import
- **Auth:** ADMIN_PASSWORD for `mode: 'replace'` only. `merge`/`branch` modes are public.

#### POST /personality/validate
Validate snapshot format.

#### POST /personality/preview
Preview import changes.

---

### Personas

#### GET /personas
- **Query:** `?includeArchived=false`
- **Response:** `{ personas: [...], activePersonaId, count }`

#### GET /personas/active
- **Response:** `{ activePersonaId, persona: {...} }`

#### GET /personas/:id
Single persona or 404.

#### POST /personas
- **Auth:** x-internal-admin-password header
- **Body:** `{ password, slug, name?, systemPromptTemplate, operatorContextId?, forkedFromId? }`

#### PUT /personas/:id/activate
- **Response:** `{ success: true, activePersonaId, persona }`

#### POST /personas/:id/fork
- **Auth:** ADMIN_PASSWORD
- **Body:** `{ password, newName, historyDays? }`

---

### Self-Knowledge

#### GET /learned
- **Response:** `{ learned: [...] }`

#### POST /learned
- **Body (add):** `{ content, confidence?, supporting? }`
- **Body (update):** `{ id, content?, confidence? }`

#### DELETE /learned/:id
- **Auth:** ADMIN_PASSWORD

#### GET /questions
- **Response:** `{ questions: [...] }`

#### POST /questions
- **Body:** `{ op: "add"|"note"|"resolve"|"dissolve"|"list", ... }`

---

### TTS & Voice

#### POST /tts-generate
- **Body:** `{ text: string, stability?: number, speed?: number }`
- **Response:** Binary `audio/mpeg`

#### GET /voice-history
- **Query:** `?limit=20&offset=0`
- **Response:** `{ items: [...], total, limit, offset }`

#### GET /voice-history/:id/audio
- **Response:** Binary `audio/mpeg`

#### GET /tts-credits
- **Response:** `{ character_count, character_limit, characters_remaining, next_reset_unix, tier }`

#### GET /elevenlabs-history
#### POST /elevenlabs-backfill
#### POST /voice-history-match

---

### Transcription

#### POST /transcribe
- **Body:** Raw audio bytes (`audio/webm`, `audio/ogg`, `audio/mpeg`, `audio/wav`)
- **Response:** `{ success: true, text: "..." }`
```bash
curl -X POST "$BASE/transcribe" --data-binary @recording.webm
```

---

### Glossary

#### GET /glossary
- **Query:** `?forPrompt=bool&forReplace=bool`
- **Response:** `{ entries: [...], count }`

#### POST /glossary
- **Body:** `{ wrong_form, correct_form, category?: "name" }`
- **Response:** 201 Created or 409 Conflict

#### GET /glossary/prompt
Formatted WhisperX prompt string.

#### GET /glossary/:id
#### PUT /glossary/:id
- **Body:** `{ wrong_form?, correct_form?, category?, use_in_prompt?, use_in_replace? }`

#### DELETE /glossary/:id
- **Auth:** ADMIN_PASSWORD or Telegram initData

---

### Settings & Toggles

#### GET/POST /user-status
- **POST Body:** `{ status: string }`

#### GET/POST /discord-enabled
- **POST Body:** `{ enabled: boolean }`

#### GET /batch-status
Full batch state.

#### GET/POST /batch-enabled
- **POST Body:** `{ enabled: boolean, hours?: number }`

#### GET/POST /max-tokens
- **POST Body:** `{ maxTokens: number }` (500-16000)

#### GET/POST /streaming
- **POST Body:** `{ enabled: boolean }`

#### GET/DELETE /sleep-status
DELETE clears sleep (wake up).

#### POST /interval
- **Body:** `{ seconds: number }` (60-3600)

#### GET/POST /summarize-settings
#### POST /auto-summarize-toggle
- **Body:** `{ enabled: boolean }`

#### GET/POST /summarize-prompts
#### GET/POST /rag
#### POST /start
#### POST /stop

---

### Model Selection

#### POST /model
- **Body:** `{ model: string }` (sonnet/opus/haiku)

#### GET/POST /tts-model
- **POST Body:** `{ model: "v3"|"v2"|"flash"|"turbo", stability?, speed? }`

#### GET/POST /sum-model
- **POST Body:** `{ provider: "openai"|"anthropic"|"deepseek"|"kimi", model: string }`
- **GET Response:** includes `availableModels` and `providerStatus` metadata so clients can disable providers whose worker secret is unset.

#### GET/POST /meta-model
- **POST Body:** `{ provider, model }` or `{ provider: "inherit" }`

---

### Thinking & Actions

#### POST /think-now
Trigger immediate thinking cycle.
- **Body:** `{ model?: string, force?: boolean }`
- **Response:** Cycle result or `{ blocked: true, reason, hint }` if batch pending
```bash
curl -X POST "$BASE/think-now" -d '{"force": true}'
```

#### POST /imagine
Generate image.
- **Body:** `{ prompt: string, save?: boolean }`

---

### Batches

#### GET /batches
- **Response:** `{ batches: [...], timeout, count }`

#### POST /batches/:id/cancel

#### GET/POST /batch-timeout
- **POST Body:** `{ timeout: number | "auto" }`

#### GET/POST /batch-hard-timeout
- **POST Body:** `{ timeout: number | "auto" }`

#### POST /batch-process
#### POST /batch-cancel
- **Body:** `{ batchId?: string }`

---

### Media

#### GET /media/*
Serves from R2 bucket. Content-addressed, cached immutably.

#### POST /video-to-gif
- **Body:** Raw video bytes
- **Headers:** `Content-Type: video/mp4`, `X-Max-Duration: 15`
- **Response:** `{ gifBase64, gifDataUrl, gifSizeBytes, inputDuration, frameCount, dimensions, ... }`

---

### SIM

#### GET /sim/embeddings/status
- **Response:** `{ coverage, embeddingModel, dimensions: 768 }`

#### GET /sim/embeddings/export
- **Query:** `?tables=comma,separated&limit=1000`

#### POST /sim/embeddings/backfill
- **Body:** `{ tables?: string[], batchSize?: number }`

#### GET /sim/basin
Basin metrics.

#### POST /sim/basin/compute
- **Body:** `{ entryTypes?: string[] }`
- **Response (key fields):** `{ success, global, perType, crossType, entriesProcessed, countsByType, outliersFlagged, outliersFlaggedByType, computeTimeMs, computedAt }`
- **Note on outliersFlaggedByType:** Reports counts of *newly-inserted* anomaly flag rows during *this* compute pass only (successful INSERTs into sim_anomaly_flags). Implementation uses plain `db.insert(...).values().run()`; UNIQUE(target_table, target_id) conflicts are caught and silently skipped (no increment). This is **not** the absolute count of outliers in the current dataset (use the perType/global outlierThreshold + distances or study ground-truth JSONL results for that). Pre-existing flags from prior basin runs (e.g. Jan/Feb) are retained and cause the "flagged this pass" number to under-count relative to absolute GT for the same snapshot. See packages/memory/src/sim/routes.ts:506 (handleComputeBasin) and createAnomaly. (Added 2026-07-04 during Lane C live verification.)

#### GET /sim/basin/trajectory
- **Query:** `?limit=100&entryTypes=thought,curiosity`

#### POST /sim/direction/compute
- **Body:** Anchor pair or multi-anchor pole format (see subagent findings for full schema).

---

### Admin & Maintenance

#### POST /reset
**DESTRUCTIVE.** Deletes history, cold_storage, notebook, summaries. Resets loop count.
- **Auth:** ADMIN_PASSWORD
- **Body:** `{ "password": "<ADMIN_PASSWORD>" }`

#### POST /migrate
Run database migrations.
- **Auth:** ADMIN_PASSWORD
- **Body:** `{ password, migration?: "v9"|"v10"|..., sql?: string }`
```bash
curl -X POST "$BASE/migrate" \
  -d '{"password":"<ADMIN_PASSWORD>","migration":"v16"}'
```

#### POST /reset-history-boundary
Reset cache boundary.
- **Auth:** ADMIN_PASSWORD (optional if not configured)

#### POST /reset-telegram-webhook
Re-register Telegram webhook.

#### GET /rag-debug
RAG diagnostics.

---

### Misc

#### GET /tool-registry
Sanitized tool metadata from `@persistence/tools`.

#### POST /count-tokens
- **Body:** `{ text, provider?, model? }` or `{ system, messages }`
- **Response:** `{ tokens, model, provider, method, characters, estimate }`

#### POST /telegram
Telegram webhook endpoint (receives Update objects).

#### POST /test-discord
Send test Discord message.

#### POST /test-telegram
Send test Telegram message.

## Telegram Bot Commands

~50 unique commands organized by category. Type `/help` to see all.

### Info Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/help` | `/help [topic]` | Full categorized command reference |
| `/start` | `/start` | Same as /help |
| `/status` | `/status` | Dashboard: context stats, costs, batch state, memory counts |
| `/last` | `/last` | Most recent history entry |
| `/lastmessage` | `/lastmessage` | Most recent message_to_user with internal notes |
| `/debug` | `/debug` | Interval check timing debug info |
| `/profilepic` | `/profilepic [full]` | View Clio's profile picture |

### Control Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/think` | `/think [force]` | Trigger immediate thinking cycle |
| `/pause` | `/pause` | Stop future cycles |
| `/resume` | `/resume` | Re-enable scheduled thinking |
| `/emergency` | `/emergency` | Hard stop all cron (hidden) |
| `/batches` | `/batches` | List pending batch jobs |
| `/cancel` | `/cancel [batch_id\|all]` | Cancel batch job(s) |
| `/digest` | `/digest [preset]` | Web agent digest (geopolitical/tech/daily) |

### Settings Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/model` | `/model [name]` | View/change thinking model |
| `/tokens` | `/tokens [limit]` | Max output tokens (500-16000) |
| `/interval` | `/interval [seconds]` | Cycle interval (60-3600) |
| `/iam` | `/iam [status\|clear]` | The user's availability status |
| `/threshold` | `/threshold [n]` | Summarization threshold (10-100) |
| `/sumcount` | `/sumcount [n]` | Default entries to summarize |
| `/metathreshold` | `/metathreshold [n]` | Meta-summarization threshold |
| `/autosummarize` | `/autosummarize [on\|off]` | Toggle auto summarization |
| `/autometa` | `/autometa [on\|off]` | Toggle auto meta-summarization |
| `/summodel` | `/summodel [provider [model]]` | Summarization model |
| `/metamodel` | `/metamodel [provider [model]\|inherit]` | Meta-summarization model |
| `/ttsmodel` | `/ttsmodel [v2\|v3\|flash\|turbo]` | ElevenLabs TTS model |
| `/batch` | `/batch [on\|off\|hours]` | Batch API control |
| `/batchtimeout` | `/batchtimeout [seconds\|auto]` | Batch timeout |
| `/stream` | `/stream [on\|off]` | Telegram streaming |
| `/discord` | `/discord [on\|off]` | Discord notifications |
| `/images` | `/images [1-10]` | Art images in context |
| `/rag` | `/rag [on\|off\|topk N\|halflife N\|...]` | RAG retrieval config |
| `/tierconfig` | `/tierconfig [threshold N\|target N]` | Summary tier thresholds |
| `/localmodel` | `/localmodel [on\|off\|endpoint\|...]` | Local LLM (Ollama/LM Studio) |
| `/video` | `/video [on\|off\|duration\|fps\|width\|reset]` | Video-to-GIF settings |
| `/voice` | `/voice [on\|off\|prosody on\|off]` | Voice transcription config |
| `/meter` | `/meter [name value\|eq\|list\|...]` | Internal state meters |
| `/glossary` | `/glossary [add wrong->right\|remove ID]` | STT name corrections |
| `/persona` | `/persona [list\|switch\|info\|create]` | Persona management |
| `/ponytimeout` | `/ponytimeout [seconds\|Nm]` | PONY image gen timeout |

### Memory / Data Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/notes` | `/notes [n\|?]` | Browse notebook entries |
| `/summaries` | `/summaries [n\|all\|file]` | View/export summaries |
| `/cold` | `/cold [file]` | View/export cold storage |
| `/observations` | `/observations [file\|?]` | User observations |
| `/learned` | `/learned [brief\|file\|?]` | Verified learnings |
| `/questions` | `/questions [brief\|file\|?]` | Open questions |
| `/reminders` | `/reminders` | Active reminders |
| `/reminder` | `/reminder [add CONTENT\|remove ID]` | Add/remove reminders |
| `/history` | `/history [n\|file]` | View/export history |
| `/search` | `/search [n\|file]` | View/export search history |
| `/context` | `/context [file]` | View full system prompt |

### Operations Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/summarize` | `/summarize [?\|q\|file]` | Compress oldest history |
| `/metasummarize` | `/metasummarize [?\|q\|file\|indices]` | Consolidate summaries |
| `/bulkarchive` | `/bulkarchive [chunk_size]` | Bulk summarize old entries |
| `/backfill-embeddings` | `/backfill-embeddings` | Generate missing embeddings |
| `/backfill-notebook` | `/backfill-notebook` | Generate notebook embeddings |

### Media Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/image` | `/image <prompt>` | Generate image with preview |
| `/image!` | `/image! <prompt>` | Generate and auto-save |
| `/gallery` | `/gallery [n] [start end]` | Browse generated images |
| `/tts` | `/tts [text]` | Generate TTS audio |
| `/callstart` | `/callstart [provider model]` | Start realtime voice |
| `/callend` | `/callend [sessionId]` | End voice session |

### Admin Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/export` | `/export [all\|N] [+images]` | Export personality data |
| `/deletelast` | `/deletelast [count]` | Delete recent entries (max 3) |
| `/tools` | `/tools [N]` | Show tool registry snapshot |

### Command Aliases

| Alias | Resolves To |
|-------|------------|
| `/start` | `/help` |
| `/start_loop` | `/resume` |
| `/notebook` | `/notes` |
| `/local` | `/localmodel` |
| `/image!` | `/image` (auto-save) |
| `/backfillembeddings` | `/backfill-embeddings` |
| `/backfillnotebook` | `/backfill-notebook` |

### Non-Command Inputs

Telegram also handles:
- **Callback queries** - Inline keyboard buttons (image save/discard)
- **Voice messages** - Transcribed via Whisper (if `/voice on`)
- **Photos** - Sent as `user_message` with base64 content
- **Text** - Plain text logged as `user_message`

---

## Routing Infrastructure

### Two-Tier Dispatch

1. **Tier 1: Route Registry** (`routes/registry.js`) - Declarative route map, ~110 path-method combinations
2. **Tier 2: Legacy if/else chain** (`index.js`) - Routes depending on `index.js` functions (think, imagine, summarize, etc.)

Request flow: `/media/*` prefix match -> `dispatchRoute()` -> legacy fallback -> 404

### Route Context Object

Registry handlers receive `ctx`:

```javascript
{
  db,                // D1Database
  env,               // Cloudflare env (secrets, AI binding, R2 bucket)
  request,           // Original Request
  url,               // Parsed URL
  body,              // Pre-parsed JSON body (POST/PUT/DELETE)
  corsHeaders,       // CORS headers object
  getResponseHeaders,// Function(pathname, method) -> headers with cache
  buildSystemPrompt, // Reference to prompt builder
  params: {}         // URL parameters from path matching
}
```

### Adding a New Route

1. Create handler in `routes/*.js`
2. Export from `routes/index.js`
3. Import in `routes/registry.js`
4. Add entry to `ROUTE_REGISTRY`:

```javascript
'/my-endpoint': {
  GET: async (ctx) => {
    const result = await handleMyEndpoint(ctx.db);
    return Response.json(result, { headers: ctx.getResponseHeaders('/my-endpoint', 'GET') });
  }
}
```

### Path Parameters

Express-style `:param` syntax. Values are always strings.

```javascript
'/summaries/:id/tier': {
  POST: async (ctx) => {
    const id = parseInt(ctx.params.id);
    // ...
  }
}
```

---

## Endpoint Statistics

| Category | Count |
|----------|-------|
| Authentication | 4 |
| Loop State | 3 |
| History | 2 |
| Memory (cold/notebook/obs) | 7 |
| Summaries | 11 |
| Summarization Ops | 4 |
| Settings/Toggles | ~20 |
| Model Selection | 6 |
| Gallery & Images | 9 |
| Memory Branches | 7 |
| Memory Manipulation | 8 |
| Personality | 6 |
| Personas | 6 |
| Self-Knowledge | 4 |
| TTS & Voice | 7 |
| Transcription | 1 |
| Glossary | 6 |
| Web Search | 3 |
| Thinking & Actions | 2 |
| Batches | 6 |
| Media | 2 |
| SIM | 7 |
| Admin | 4 |
| Misc | 6 |
| **Total REST** | **~150+** |
| **Telegram Commands** | **~50** |
