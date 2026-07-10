# Emergency Debugging Guide
===========================

**Purpose:** Quick reference for diagnosing urgent issues in the Claude Existence Loop.
**Use when:** Something is clearly wrong - loop running too fast, not running, Claude panicking, unexpected behavior.

---

## Quick Diagnostics (Do These First)

### 1. Check Logs (Live)

```bash
cd platforms/cloudflare && npx wrangler tail
```

Watch for:
- `[THINK]` - Cycle starting
- `[ERROR]` - Any errors
- `[BATCH]` - Batch mode activity
- `[RAG]` - RAG retrieval issues

### 2. Check Current State

```bash
# Full state dump
curl https://your-worker.workers.dev/state | jq

# Key values to check:
# - is_running: Should be true if loop is active
# - cycle_interval_seconds: How often cycles run
# - last_run: When was last cycle
# - batch_enabled: Is batch mode on
# - sleep_until: Is Claude sleeping
```

### 3. Check Recent Cycles

```bash
curl "https://your-worker.workers.dev/cycles?limit=10" | jq
```

Look for:
- Abnormal frequency (timestamps too close together)
- Error patterns in model responses
- Unusual token counts

---

## Symptom-Based Diagnosis

### Loop Running Too Fast (60 cycles in 5 minutes)

**Symptoms:** Notifications flooding in, costs spiking, Claude seems frantic

**Check immediately:**
```bash
# Check cycle interval
curl https://your-worker.workers.dev/state | jq '.cycle_interval_seconds'

# Should be 60+ seconds. If it's very low (1-10), that's the problem.
```

**Possible causes:**
1. `cycle_interval_seconds` set too low (< 60)
2. Multiple cron triggers (check wrangler.toml)
3. Manual `/think-now` calls in a loop
4. **CRITICAL: `toEastern()` used for calculations instead of `new Date()`** (see Real Incident #1 below)

**Fix:**
```bash
# Set interval back to safe value (10 minutes = 600 seconds)
curl -X POST "https://your-worker.workers.dev/interval" \
  -H "Content-Type: application/json" \
  -d '{"seconds": 600}'
```

**Use `/debug` command (Telegram) to see:**
- Current interval setting
- Last wake time
- Elapsed time since last cycle

---

### Loop Not Running At All

**Symptoms:** No new history entries, Claude hasn't responded in hours, /status shows stale data

**Check:**
```bash
# Is loop running?
curl https://your-worker.workers.dev/state | jq '.is_running'

# Is Claude sleeping?
curl https://your-worker.workers.dev/state | jq '.sleep_until'

# When was last run?
curl https://your-worker.workers.dev/state | jq '.last_run'
```

**Possible causes:**
1. `is_running` is false - loop stopped
2. `sleep_until` is set to future time
3. Cron not triggering (Cloudflare issue)
4. Worker crashed/not deployed

**Fix:**
```bash
# Start the loop
curl -X POST "https://your-worker.workers.dev/start"

# Or wake from sleep
curl -X POST "https://your-worker.workers.dev/wake"

# Or redeploy
cd platforms/cloudflare && npx wrangler deploy
```

---

### Claude Stuck in Batch Mode

**Symptoms:** Responses delayed by hours, batch_enabled is true, no streaming

**Check:**
```bash
# Is batch mode on?
curl https://your-worker.workers.dev/state | jq '.batch_enabled'

# Check pending batches
curl https://your-worker.workers.dev/batches
```

**Fix:**
```bash
# Disable batch mode
curl -X POST "https://your-worker.workers.dev/batch" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Or via Telegram: `/batch off`

---

### API Errors / Claude Not Responding

**Symptoms:** Cycles run but no Claude response, errors in logs

**Check logs for:**
- `429` - Rate limited
- `500` - Anthropic API error
- `Authentication failed` - API key issue
- `Context length exceeded` - Prompt too long

**Possible causes:**
1. ANTHROPIC_API_KEY invalid or expired
2. Rate limits hit
3. Context window overflow (too much history)
4. Anthropic service outage

**Fix:**
```bash
# Check API key is set
cd platforms/cloudflare && npx wrangler secret list

# Re-set API key if needed
npx wrangler secret put ANTHROPIC_API_KEY

# Force summarization to reduce context
# (via Telegram) /summarize
```

---

### Database Errors (D1)

**Symptoms:** State not updating, history not saving, errors mentioning "D1" or "SQLite"

**Check:**
```bash
# Test D1 connectivity
cd platforms/cloudflare && npx wrangler d1 execute claude-loop --command="SELECT 1;" --remote
```

**Common issues:**
1. Row too large (> 900KB) - usually images
2. Migration not run after deploy
3. Database binding incorrect

**Fix:**
```bash
# Run pending migration
curl -X POST "https://your-worker.workers.dev/migrate" \
  -H "Content-Type: application/json" \
  -d '{"password": "<ADMIN_PASSWORD>", "migration": "v9"}'
```

---

### Memory/Summarization Issues

**Symptoms:** Context growing unbounded, old entries not summarizing, RAG not working

**Check:**
```bash
# Check summarization threshold
curl https://your-worker.workers.dev/state | jq '.summarize_threshold'

# Check history count
curl "https://your-worker.workers.dev/history?limit=1000" | jq 'length'

# Check summaries
curl https://your-worker.workers.dev/summaries | jq 'length'
```

**If history >> threshold and no summarization:**
- Auto-summarization may be disabled
- Check `/autosummarize` setting via Telegram

**Fix via Telegram:**
```
/autosummarize on
/summarize
```

---

## Emergency Stop Procedures

### Stop All Activity

```bash
# Stop the loop
curl -X POST "https://your-worker.workers.dev/stop"

# Verify stopped
curl https://your-worker.workers.dev/state | jq '.is_running'
```

### Full Reset (DESTRUCTIVE - Last Resort)

```bash
# This clears ALL state - use only if necessary
curl -X POST "https://your-worker.workers.dev/reset" \
  -H "Content-Type: application/json" \
  -d '{"password": "<ADMIN_PASSWORD>"}'
```

**WARNING:** Full reset clears history, memories, everything. Only use if system is completely broken.

---

## Key State Values Reference

| State Key | Purpose | Normal Value |
|-----------|---------|--------------|
| `is_running` | Loop active | `true` |
| `cycle_interval_seconds` | Time between cycles | `60-600` |
| `last_run` | Last cycle timestamp | Within interval |
| `batch_enabled` | Batch mode toggle | `true`/`false`/`null` |
| `batch_until` | Timed batch expiry | ISO timestamp or null |
| `sleep_until` | Claude sleep time | ISO timestamp or null |
| `summarize_threshold` | Auto-summarize trigger | `70` (default) |
| `history_prefix_boundary_id` | Cache boundary | Entry ID |
| `rag_enabled` | RAG toggle | `1` |

---

## Log Patterns to Watch

```bash
# In wrangler tail output:

# Good patterns:
[THINK] Starting cycle...
[THINK] Cycle complete, actions: MESSAGE_USER, THINK

# Warning patterns:
[BATCH] Waiting for batch completion...
[RAG] No summaries above threshold

# Error patterns:
[ERROR] API call failed: 429
[ERROR] D1_ERROR: Row too large
[ERROR] Context length exceeded
```

---

## Quick Commands Reference

| Action | Command |
|--------|---------|
| View logs | `cd platforms/cloudflare && npx wrangler tail` |
| Check state | `curl .../state \| jq` |
| Start loop | `curl -X POST .../start` |
| Stop loop | `curl -X POST .../stop` |
| Set interval | `curl -X POST .../interval -d '{"seconds":600}'` |
| Disable batch | `/batch off` (Telegram) |
| Force summarize | `/summarize` (Telegram) |
| Check cycles | `curl .../cycles?limit=10` |
| Deploy worker | `cd platforms/cloudflare && npx wrangler deploy` |

---

## When to Escalate

If none of the above fixes work:
1. Check Cloudflare status: https://www.cloudflarestatus.com/
2. Check Anthropic status: https://status.anthropic.com/
3. Review recent code changes (git log)
4. Check `runs/` for recent RUN directories with related work
5. Search TASK_LOGs in `runs/RUN-*/TASK_LOG.md` for similar issues

---

---

## Real Incidents (From TASK_LOGs)

### Incident #1: SLEEP Infinite Loop (toEastern Bug)

**What happened:** Claude announced SLEEP every 1-2 minutes for 90+ minutes. Never actually slept.

**Root cause:** Batch mode used `toEastern()` for timestamp calculation instead of `new Date()`.

```javascript
// WRONG (batch mode had this):
const now = toEastern();  // Creates Date with WRONG UTC timestamp!

// The cascade failure:
// Real time: 3:00 AM Eastern = 8:00 AM UTC
// toEastern() returns: 3:00 AM UTC (5 hours behind actual time!)
// sleep_until calculated as: 3:54 AM UTC
// Next cron checks: 8:00 AM UTC < 3:54 AM UTC? FALSE!
// Result: Sleep check passes, new cycle runs. INFINITE LOOP.

// CORRECT:
const now = new Date();  // Always use for calculations!
```

**Key learning:** `toEastern()` is DISPLAY-ONLY. Never use for timestamp calculations.

---

### Incident #2: Image Media Type Mismatch

**What happened:** API error: `Image does not match the provided media type image/png`

**Root cause:** Browser uploaded JPEG but declared it as PNG. API validates actual bytes.

```javascript
// Fix: Detect actual type from magic bytes
let actualType = 'image/jpeg';
if (base64.startsWith('/9j/')) actualType = 'image/jpeg';
else if (base64.startsWith('iVBOR')) actualType = 'image/png';
else if (base64.startsWith('R0lGOD')) actualType = 'image/gif';
else if (base64.startsWith('UklGR')) actualType = 'image/webp';
```

---

### Incident #3: SQLite LIKE Pattern Too Complex

**What happened:** `D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR`

**Root cause:** Long strings wrapped with `%...%` exceeded SQLite's pattern complexity limit.

```javascript
// Fix: Try exact match first, then truncated LIKE
let result = await db.prepare('SELECT * FROM table WHERE field = ?').bind(query).first();
if (!result) {
  const truncated = query.slice(0, 50);  // Max 50 chars for LIKE
  result = await db.prepare('SELECT * FROM table WHERE field LIKE ?').bind(`%${truncated}%`).first();
}
```

---

### Incident #4: Batch Mode Time Window Override Ignored

**What happened:** Batch mode showed "on" but only batched during 12AM-9AM window.

**Root cause:** Explicit `batch_enabled=true` still fell through to time window check.

```javascript
// Wrong: Falls through to time window even when explicitly enabled
if (batch_enabled === 'true') isEnabled = true;
if (!isEnabled) return false;
// ... time window check here (bug!)

// Correct: Explicit enable bypasses time window
if (batch_enabled === 'true') return true;  // EARLY RETURN
// Time window only for default (no explicit setting)
```

---

### Incident #5: 583 History Entries in Limbo

**What happened:** 583 unsummarized entries invisible to Claude (outside 50-entry context window).

**Root cause:** No bulk archive capability. Status display showed query limit, not actual count.

**Fix:** Added `/bulkarchive` command to process limbo entries in chunks with Haiku.

```bash
# Check for limbo entries:
# If unsummarized > 50, you have limbo
curl .../state | jq '.summarize_threshold'
# Compare to actual unsummarized count
```

---

## Critical Patterns to Remember

1. **Display vs Calculation:** `toEastern()`, `formatEasternTime()` are DISPLAY ONLY
2. **D1 Null Coalescing:** Always use `value ?? null`, never pass undefined
3. **Magic Bytes:** Never trust declared image types
4. **Status Filtering:** Always filter cycles/batches by `status='completed'`
5. **LIKE Truncation:** Max 50 chars for pattern matching
6. **Explicit Overrides:** User-set values should bypass default logic

---

## Related Documentation

- [CONTEXT_ASSEMBLY.md](CONTEXT_ASSEMBLY.md) - How context is built (if context issues)
- [SUMMARIZATION.md](SUMMARIZATION.md) - Summarization flow (if memory issues)
- [BATCH_MODE.md](BATCH_MODE.md) - Batch API details (if batch issues)
- [RAG_SYSTEM.md](RAG_SYSTEM.md) - RAG retrieval (if search issues)

---

## Source

Real incidents extracted from: `runs/RUN-*/TASK_LOG.md` files
Mining performed: 2026-01-12
Full findings: `runs/RUN-20260112-1012-codebase-audit-documentation/subagents/20260112-1042-tasklog-mining/FINDINGS.md`
