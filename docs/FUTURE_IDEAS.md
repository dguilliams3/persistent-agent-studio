# Future Ideas

Low-priority ideas and explorations that haven't been assigned TD codes yet. These are "someday/maybe" items, not active technical debt.

**To promote an idea to active work:** Create a RUN directory and optionally assign a TD code if it addresses existing debt.

---

## Multi-Summary Consolidation (Batch Summarization)
**Added:** 2026-01-14
**Effort:** 2-3 hours

**Problem:** Auto-summarization creates one summary per call. When there are 11 entries to summarize, it creates 1 summary. But it could intelligently group entries into multiple summaries in one call.

**Example:**
- Current: 11 entries → 1 summary covering all 11
- Better: 11 entries → 2 summaries (entries 1-5 grouped by theme A, entries 6-11 by theme B)

**Benefits:**
- Reduces total summarization calls
- Better semantic grouping (related entries stay together)
- More granular retrieval for RAG

**Implementation approach:**
1. Modify summarization prompt to request multiple logical groups
2. Parse multi-summary response in `summarizeHistory()`
3. Add grouping hints from entry metadata

---

## Command Entity System
**Added:** Unknown
**Effort:** High

Commands (Telegram, API, UI) should be self-describing entities with properties:

```javascript
const commands = {
  '/threshold': {
    name: 'threshold',
    description: 'View/set summarize threshold',
    usage: '/threshold [n]',
    params: [{ name: 'n', type: 'number', range: [10, 100], optional: true }],
    category: 'settings',
    handler: handleThreshold,
    helpText: 'Set how many history entries before...',
    webUIVisible: true,
    clioContextVisible: false,
  }
};
```

**Benefits:**
- `/help` generated dynamically from registry
- Web UI settings generated from same source
- Clio's context could include available commands
- Less duplication between Telegram, API, and UI

---

## Self-Pattern Awareness
**Added:** Unknown
**Effort:** Medium

Claude could benefit from seeing patterns in its own behavior:
- "You've messaged the user 3 times today"
- "You've been curious about astronomy lately"
- "You haven't used cold storage in a while"

Would require computing stats from history and injecting into prompt.

---

## Auto-Infer User Status from Time
**Added:** Unknown
**Effort:** Low

If no status is set, could infer from time of day:
- 11pm-7am EST: "probably sleeping"
- 9am-5pm weekdays: "probably working"

But explicit status is better - this would just be a fallback.

---

## Voice Features - Remaining Items
**Added:** 2026-01-14
**Updated:** 2026-01-16
**Effort:** Low

**Status:** VoiceTab implemented with TTS, history, model/stability/speed controls, credits, glossary, and transcription corrections.

**Remaining:**
- Voice selection dropdown (requires ElevenLabs voices API)
- ElevenLabs History Backfill UI (endpoint exists, no UI trigger)

---

## Browser-Based Whisper (Free Unlimited STT)
**Added:** 2026-01-14
**Related:** RUN-20260114-2320-voice-input-stt
**Effort:** 3-4 hours

**Problem:** Cloudflare AI Whisper has a free tier but costs after that. For Mini App and React Web UI, we could use browser-based Whisper for completely free, unlimited transcription.

**Solution:** Use [Transformers.js](https://huggingface.co/docs/transformers.js) which runs Whisper entirely in the browser via WebAssembly/WebGPU.

**Pros:**
- Completely free, unlimited usage
- Audio never leaves device (privacy)
- Works offline after model is cached

**Cons:**
- First load downloads model (~40-150MB)
- Slower than API (~2-5s for 30s audio)
- Won't work well on very low-end mobile devices

---

## Extended Thinking Mode Exploration
**Added:** 2026-01-15
**Effort:** 4-5 hours

**Context:** Claude supports "extended thinking" - actual model reasoning traces that show how Claude deliberates before responding.

**What extended thinking provides:**
- `thinking` content blocks with step-by-step reasoning
- Better quality for complex reasoning tasks

**Cost implications (significant):**
- Thinking tokens billed as OUTPUT tokens ($15/MTok Sonnet, $25/MTok Opus)
- 4K thinking budget → ~4x cost increase per cycle

**When to consider:**
- If reasoning quality for complex decisions is noticeably poor
- When cost savings elsewhere offset the increase

---

## Semantic Identity Monitor (SIM) - Phases 2-5
**Added:** 2026-01-19
**Active RUN:** `runs/RUN-20260119-2046-semantic-identity-monitor/`
**Effort:** 12-15 hours remaining

Phase 0-1 (Foundation + Basin Metrics) completed. Remaining phases:

| Phase | Component | Effort | Description |
|-------|-----------|--------|-------------|
| 2 | Concept Vectors | 4-5h | Four axes (relational, secure, exploratory, voice_match) |
| 3 | Trajectory View | 3-4h | Recharts time-series with anomaly highlighting |
| 4 | 2D Scatter | 2-3h | UMAP projection via Modal (pre-computed on cron) |
| 5 | Anomaly Detection | 2-3h | Synthetic injection experiments, research framework |

See active RUN for current progress and HANDOFF.md for continuation context.
