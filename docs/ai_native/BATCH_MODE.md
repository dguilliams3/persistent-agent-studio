# Batch Mode - Claude Existence Loop
=====================================

Documentation for the Anthropic Batches API integration, providing 50% cost savings during off-peak hours.

---

## Overview

Batch mode uses Anthropic's Batches API instead of the standard Messages API. Batches are processed asynchronously with a 50% discount, ideal for overnight or non-interactive periods.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    BATCH MODE FLOW                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

    Normal Mode                     Batch Mode
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                     â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ Cron    â”‚                    â”‚ Cron    â”‚
    â”‚ Trigger â”‚                    â”‚ Trigger â”‚
    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜                    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
         â”‚                              â”‚
         â–¼                              â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ Build   â”‚                    â”‚ Build   â”‚
    â”‚ Context â”‚                    â”‚ Context â”‚
    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜                    â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”˜
         â”‚                              â”‚
         â–¼                              â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ Messages    â”‚                â”‚ Batches API â”‚
    â”‚ API (sync)  â”‚                â”‚ Submit      â”‚
    â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜                â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â”‚                              â”‚
          â–¼                              â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚ Process â”‚                    â”‚ Store in    â”‚
    â”‚ Responseâ”‚                    â”‚ pending_    â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                    â”‚ batches     â”‚
                                   â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                                         â”‚
                                   â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”
                                   â”‚ Next cron:  â”‚
                                   â”‚ Poll status â”‚
                                   â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                                         â”‚
                                   â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”
                                   â”‚ If complete:â”‚
                                   â”‚ Fetch JSONL â”‚
                                   â”‚ Process     â”‚
                                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Cost Savings

| API | Input Cost | Output Cost | Savings |
|-----|------------|-------------|---------|
| Messages API | $15/MTok | $75/MTok | - |
| Batches API | $7.50/MTok | $37.50/MTok | **50%** |

*Prices for Claude Sonnet 4. Opus costs more but same 50% discount ratio.*

---

## When Batch Mode Activates

### Activation Logic

Location: `platforms/cloudflare/src/db/batches.js` - `isInBatchWindow()`

```
1. Check D1 state for 'batch_enabled'
   â”‚
   â”œâ”€â–º 'true' (explicit on) â†’ BATCH MODE
   â”‚
   â”œâ”€â–º 'false' (explicit off) â†’ STREAMING MODE
   â”‚
   â””â”€â–º null (no setting) â†’ Check time window
                â”‚
                â”œâ”€â–º 12 AM - 9 AM Eastern? â†’ BATCH MODE
                â”‚
                â””â”€â–º Otherwise â†’ STREAMING MODE
```

### Timed Batch Mode

The `/batch N` command enables batch mode for N hours:

```
/batch 8    â†’ Batch for 8 hours, then auto-disable
/batch on   â†’ Batch indefinitely (until /batch off)
/batch off  â†’ Disable batch mode
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

### Constants (`constants.js`)

```javascript
BATCH_WINDOW = {
  startHour: 0,                    // 12:00 AM Eastern
  endHour: 9,                      // 9:00 AM Eastern
  enabled: false,                  // Master enable for time-based batching
  userActivityOverrideMinutes: 30   // Stay streaming if user active
}
```

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/batch` | Show current batch mode status |
| `/batch on` | Enable batch mode indefinitely |
| `/batch off` | Disable batch mode |
| `/batch N` | Enable batch for N hours |

### API Toggle

```bash
# Enable via API
curl -X POST "https://your-worker.workers.dev/batch" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Disable via API
curl -X POST "https://your-worker.workers.dev/batch" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Web UI Toggle

Settings tab â†’ "Batch Mode" toggle

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

Location: `platforms/cloudflare/src/index.js` - `processPendingBatches()`

```
1. Query pending_batches WHERE status IN ('pending', 'processing')
   â”‚
   â””â”€â–º For each pending batch:
       â”‚
       â”œâ”€â–º Call Anthropic API: GET /v1/messages/batches/{batch_id}
       â”‚
       â”œâ”€â–º Status 'processing'? â†’ Update DB, continue waiting
       â”‚
       â”œâ”€â–º Status 'ended'? â†’ Fetch results
       â”‚   â”‚
       â”‚   â””â”€â–º GET {results_url} â†’ JSONL response
       â”‚       â”‚
       â”‚       â””â”€â–º Parse JSONL, extract response
       â”‚           â”‚
       â”‚           â””â”€â–º Execute actions from response
       â”‚
       â””â”€â–º Status 'expired'/'failed'? â†’ Log error, mark failed
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

**Telegram:**
```
/batch
â†’ Batch mode: ON (timed until 8:00 AM EST)
â†’ User activity override: NO (last message 45 min ago)
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
| `platforms/cloudflare/src/db/batches.js` | isInBatchWindow, isUserRecentlyActive, CRUD |
| `platforms/cloudflare/src/index.js` | submitBatch, processPendingBatches |
| `platforms/cloudflare/src/constants.js` | BATCH_WINDOW configuration |
| `worker/migration_v7_batches.sql` | pending_batches schema |

---

## Implementation Notes

1. **Batches API endpoint**: `POST /v1/messages/batches` (not `/messages`)
2. **Results URL**: Returned in batch status response, valid for 24h
3. **Custom ID format**: `think_{timestamp}` for cycle batches
4. **24h max latency**: Batches can take up to 24 hours to process
5. **No streaming**: Batch responses are complete, not streamed
