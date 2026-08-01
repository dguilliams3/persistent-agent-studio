# Batch Mode
============

Documentation for the Anthropic Batches API integration: batch processing runs at
roughly **0.5x** the normal rate, ideal for off-peak hours.

> **Provenance (2026-07-31):** written pre-extraction; module paths below have been
> reconciled to the extracted layout (`platforms/cloudflare/src/services/batch-processor.ts`).
> The Telegram `/batch` commands documented from the original integration do **not** ship
> (no channel adapter does — see SETUP.md); the live controls are the API routes
> (`/batch-enabled`, `/batch-status`) and the web UI. For current model prices, see
> Anthropic's pricing page — this doc states the discount as a ratio on purpose.

---

## Overview

Batch mode uses Anthropic's Batches API instead of the standard Messages API. Batches are processed asynchronously with a 50% discount, ideal for overnight or non-interactive periods.

```
┌─────────────────────────────────────────────────────────────┐
│                    BATCH MODE FLOW                          │
└─────────────────────────────────────────────────────────────┘

    Normal Mode                     Batch Mode
    ───────────                     ──────────

    ┌─────────┐                    ┌─────────┐
    │ Cron    │                    │ Cron    │
    │ Trigger │                    │ Trigger │
    └────┬────┘                    └────┬────┘
         │                              │
         ▼                              ▼
    ┌─────────┐                    ┌─────────┐
    │ Build   │                    │ Build   │
    │ Context │                    │ Context │
    └────┬────┘                    └────┬────┘
         │                              │
         ▼                              ▼
    ┌─────────────┐                ┌─────────────┐
    │ Messages    │                │ Batches API │
    │ API (sync)  │                │ Submit      │
    └─────┬───────┘                └─────┬───────┘
          │                              │
          ▼                              ▼
    ┌─────────┐                    ┌─────────────┐
    │ Process │                    │ Store in    │
    │ Response│                    │ pending_    │
    └─────────┘                    │ batches     │
                                   └─────┬───────┘
                                         │
                                   ┌─────▼───────┐
                                   │ Next cron:  │
                                   │ Poll status │
                                   └─────┬───────┘
                                         │
                                   ┌─────▼───────┐
                                   │ If complete:│
                                   │ Fetch JSONL │
                                   │ Process     │
                                   └─────────────┘
```

---

## Cost Savings

| API | Input Cost | Output Cost | Savings |
|-----|------------|-------------|---------|
| Messages API | 1.0x | 1.0x | - |
| Batches API | 0.5x | 0.5x | **50%** |

*The 50% discount ratio applies across models; see Anthropic's pricing page for absolute rates.*

---

## When Batch Mode Activates

### Activation Logic

Location: `platforms/cloudflare/src/db/batches.js` - `isInBatchWindow()`

```
1. Check D1 state for 'batch_enabled'
   │
   ├─► 'true' (explicit on) → BATCH MODE
   │
   ├─► 'false' (explicit off) → STREAMING MODE
   │
   └─► null (no setting) → Check time window
                │
                ├─► 12 AM - 9 AM Eastern? → BATCH MODE
                │
                └─► Otherwise → STREAMING MODE
```

### Timed Batch Mode

The `/batch N` command enables batch mode for N hours:

```
/batch 8    → Batch for 8 hours, then auto-disable
/batch on   → Batch indefinitely (until /batch off)
/batch off  → Disable batch mode
```

State keys:
- `batch_enabled`: 'true' | 'false' | null
- `batch_until`: ISO timestamp when timed batch expires

### User Activity Override

**Critical**: If the user is actively messaging, we skip batch mode for faster responses.

Location: `platforms/cloudflare/src/db/batches.js` - `isUserRecentlyActive()`

```javascript
const lastUserMessage = await db.prepare(
  `SELECT created_at FROM history WHERE type = 'user_message'
   ORDER BY created_at DESC LIMIT 1`
).first();

const minutesAgo = (Date.now() - lastMessageTime.getTime()) / 60000;
return minutesAgo < BATCH_WINDOW.userActivityOverrideMinutes; // 30 min default
```

**Flow:**
1. User sends message at 2:00 AM (within batch window)
2. System detects user is active (message < 30 min ago)
3. Next cycle uses streaming API for fast response
4. After 30 min of inactivity, reverts to batch mode

---

## Configuration

### Constants (`platforms/cloudflare/src/constants.ts`)

```javascript
BATCH_WINDOW = {
  startHour: 0,                    // 12:00 AM Eastern
  endHour: 9,                      // 9:00 AM Eastern
  enabled: false,                  // Master enable for time-based batching
  userActivityOverrideMinutes: 30   // Stay streaming if user active
}
```

### Legacy Chat Commands (do not ship)

The original integration exposed `/batch`, `/batch on|off`, `/batch N` as chat-bot
commands. No channel adapter ships in this distribution; use the API toggle below or the
web UI instead.

### API Toggle

```bash
# Enable via API
curl -X POST "https://your-worker.workers.dev/batch-enabled" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Disable via API
curl -X POST "https://your-worker.workers.dev/batch" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Web UI Toggle

Settings tab → "Batch Mode" toggle

---

## Pending Batch Polling

### Database Table

```sql
CREATE TABLE pending_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,        -- Anthropic's batch ID
  custom_id TEXT NOT NULL,       -- Our tracking ID (think_N)
  cycle_id INTEGER,              -- Link to cycles table
  trigger TEXT DEFAULT 'cron',   -- 'cron' or 'manual'
  model TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, expired
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  results_json TEXT,             -- Raw API response
  error_message TEXT
);
```

### Polling Flow

Location: `platforms/cloudflare/src/services/batch-processor.ts` - `processPendingBatches()`

```
1. Query pending_batches WHERE status IN ('pending', 'processing')
   │
   └─► For each pending batch:
       │
       ├─► Call Anthropic API: GET /v1/messages/batches/{batch_id}
       │
       ├─► Status 'processing'? → Update DB, continue waiting
       │
       ├─► Status 'ended'? → Fetch results
       │   │
       │   └─► GET {results_url} → JSONL response
       │       │
       │       └─► Parse JSONL, extract response
       │           │
       │           └─► Execute actions from response
       │
       └─► Status 'expired'/'failed'? → Log error, mark failed
```

### JSONL Response Format

Anthropic returns results as JSONL (one JSON object per line):

```jsonl
{"custom_id":"think_1736640000","result":{"type":"message","content":[{"type":"text","text":"..."}]}}
```

Parsing:
```javascript
const lines = resultsText.split('\n').filter(l => l.trim());
for (const line of lines) {
  const result = JSON.parse(line);
  if (result.result?.content?.[0]?.text) {
    // Process response
  }
}
```

---

## Edge Cases

### Batch Timeout

If a batch hasn't completed after 24 hours (Anthropic's max), it's marked expired:

```javascript
if (status === 'expired') {
  await updatePendingBatch(db, batchId, 'expired', null, 'Batch expired');
}
```

### Manual Override

Users can force streaming even during batch window:
1. `/batch off` - Explicitly disables
2. User activity - Sending a message triggers streaming for 30 min

### Timed Expiration

When `/batch N` timer expires:
1. `batch_until` timestamp is checked each cycle
2. If expired, `batch_enabled` is set to 'false'
3. `batch_until` is cleared

### Multiple Pending Batches

The system can have multiple pending batches (e.g., if cycles run faster than batch processing). Each is tracked independently by `custom_id`.

---

## Verification

### Check Current Status

**API:**
```
GET /batch-status
→ Batch mode: ON (timed until 8:00 AM EST)
→ User activity override: NO (last message 45 min ago)
```

**API:**
```bash
curl "https://your-worker.workers.dev/state" | jq '.batch_enabled'
```

### Check Pending Batches

```bash
# List pending batches
curl "https://your-worker.workers.dev/batches"
```

### Verify Cost Savings

Check `/status` or `/cycles` for cost breakdown. Batch cycles show `batch: true` and lower costs.

---

## Key Files

| File | Purpose |
|------|---------|
| `platforms/cloudflare/src/db/batches.ts` | isInBatchWindow, isUserRecentlyActive, CRUD |
| `platforms/cloudflare/src/services/batch-processor.ts` | submitBatch, processPendingBatches |
| `platforms/cloudflare/src/constants.ts` | BATCH_WINDOW configuration |
| `platforms/cloudflare/migration_v7_batches.sql` | pending_batches schema |

---

## Implementation Notes

1. **Batches API endpoint**: `POST /v1/messages/batches` (not `/messages`)
2. **Results URL**: Returned in batch status response, valid for 24h
3. **Custom ID format**: `think_{timestamp}` for cycle batches
4. **24h max latency**: Batches can take up to 24 hours to process
5. **No streaming**: Batch responses are complete, not streamed
