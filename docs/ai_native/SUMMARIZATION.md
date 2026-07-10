# Summarization System - Technical Reference

**Last Updated:** 2026-01-21
**Status:** Production
**Module:** `platforms/cloudflare/src/index.js` (summarizeHistory, metaSummarize)
**Database:** Summarization DB code is in `platforms/cloudflare/src/index.js` (inline with main worker)

---

## Quick Navigation

| Need | Go To |
|------|-------|
| How does the three-tier system work? | [Three-Tier Model (v25)](#three-tier-model-v25) |
| When does summarization trigger? | [Auto-Summarization](#auto-summarization) |
| What is meta-summarization? | [Meta-Summarization](#meta-summarization) |
| How do I configure thresholds? | [Configuration Reference](#configuration-reference) |
| Summaries missing entries? | [Common Issues](#common-issues--debugging) |

---

## System Overview

### What Summarization Does

The Claude Existence Loop maintains a persistent conversational memory stored in a D1 database. Without compression, the context window would grow unbounded and exceed token limits. The summarization system solves this by:

1. **Compressing old history entries** into dense summaries (auto-summarization)
2. **Consolidating multiple summaries** into meta-summaries (meta-summarization)
3. **Managing context exposure** through a three-tier model
4. **Preserving semantic access** to archived content via RAG retrieval

This creates a hierarchical compression pipeline:

```
Raw history entries â†’ Summaries â†’ Meta-summaries â†’ Archived (RAG-only)
```

### Why Three-Tier Organization?

Claude's context window has a cost per token. Including all summaries in every prompt wastes tokens on old, rarely-relevant content. The three-tier system (v25) optimizes this:

- **Cached Tier**: Stable older summaries in prompt (cached for efficiency)
- **Tail Tier**: Recent summaries in prompt (can scroll, uncached)
- **Archived Tier**: Consolidated summaries only in RAG (zero prompt cost)

Unlike the previous boundary-based system, v25 uses explicit `tier` and `tier_position` fields for each summary, enabling localized operations like reordering without recalculating boundaries.

### Entry Lifecycle Diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ HISTORY TABLE (Raw timeline entries)                         â”‚
â”‚                                                               â”‚
â”‚ [Entry 1] [Entry 2] ... [Entry 70] â† Unsummarized entries   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â”‚
                            â”‚ Auto-summarize trigger
                            â”‚ (unsummarized_count > threshold)
                            â”‚
                            â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ SUMMARIES TABLE - CACHED TIER (tier='cached')               â”‚
â”‚                                                               â”‚
â”‚ [S1] [S2] [S3] [S4] [S5] â† Stable summaries (in prompt)    â”‚
â”‚  â†‘                      â†‘                                     â”‚
â”‚  Oldest            Newest cached                              â”‚
â”‚                                                               â”‚
â”‚ Cache optimization: Prefix cache (stable block)              â”‚
â”‚ Ordered by: tier_position (or covered_start)                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ SUMMARIES TABLE - TAIL TIER (tier='tail')                   â”‚
â”‚                                                               â”‚
â”‚ [S6] [S7] [S8] [S9] [S10] â† Recent summaries (in prompt)   â”‚
â”‚                                                               â”‚
â”‚ - Uncached (changes frequently)                              â”‚
â”‚ - Can scroll and grow                                        â”‚
â”‚ - Ordered by: tier_position (or covered_start)              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â”‚
                            â”‚ Meta-summarize trigger
                            â”‚ (active_count > threshold or token limit)
                            â”‚
                            â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ SUMMARIES TABLE - ARCHIVED TIER (tier='archived')           â”‚
â”‚                                                               â”‚
â”‚ [M1: archived_at, replaced_by_id] â† Meta-summary            â”‚
â”‚   â””â”€ Consolidates [S1, S2, S3]                              â”‚
â”‚                                                               â”‚
â”‚ - archived_at IS NOT NULL                                    â”‚
â”‚ - Zero prompt cost, RAG retrieval only                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Key Fields (v25):**
- `summarized_at` (history table): Marks entry as included in a summary
- `tier` (summaries table): Explicit tier membership ('cached', 'tail', 'archived')
- `tier_position` (summaries table): Integer ordering within tier (multiples of 100, null = use covered_start)
- `archived_at` (summaries table): Timestamp when archived (NULL for active tiers)
- `replaced_by_id` (summaries table): Links archived summary to consolidating meta-summary

---

## Auto-Summarization

### When It Triggers

Auto-summarization runs during the think cycle if:

1. **Feature flag enabled**: `auto_summarize_enabled` â‰  'false' (default: enabled)
2. **Threshold exceeded**: Unsummarized history count > `summarize_threshold` (default: 70)

**Code location:** `platforms/cloudflare/src/index.js` lines 2746-2763

```javascript
const autoSumEnabled = (await getState(db, 'auto_summarize_enabled')) !== 'false';
const threshold = parseInt(await getState(db, 'summarize_threshold')) || 70;
const unsummarizedCount = await getUnsummarizedHistoryCount(db);

if (autoSumEnabled && unsummarizedCount > threshold) {
  // Trigger auto-summarization
  await summarizeHistory(db, 0, unsummarizedCount - threshold + buffer, null, env);
}
```

### How Many Entries to Summarize?

The system calculates:

```javascript
const buffer = 5;
const targetSize = threshold - buffer;
const toSummarize = Math.min(
  historyLength - targetSize,
  SUMMARIZE_CONFIG.maxSummarizeCount  // 30 max
);
```

**Example:**
- Threshold: 70 entries
- Current history: 85 entries
- Buffer: 5 entries
- Target: 70 - 5 = 65 entries remaining
- To summarize: 85 - 65 = 20 entries (oldest 20)

This leaves headroom before the next threshold trigger.

### [ID:N] Entry Tracking Mechanism

When Claude receives history for summarization, each entry is tagged with `[ID:N]`:

```
[ID:45] [2026-01-10 14:30 EST] User: "How does quantum entanglement work?"
[ID:46] [2026-01-10 14:31 EST] Claude â†’ User: "Quantum entanglement is..."
[ID:47] [2026-01-10 14:35 EST] Claude thought: I should explain this more clearly
```

**Why?** Claude may not include all entries in the summary (e.g., skips mundane "exist" actions). Tracking ensures:

- Only entries Claude **explicitly included** get `summarized_at` set
- Missed entries remain unsummarized and appear in next batch
- **No data loss** from Claude's selective compression

### Claude's INCLUDED_IDS Response Format

After generating the summary, Claude returns:

```
INCLUDED_IDS: 45, 46, 47, 48, 49, 50

Summary text here...
```

The worker parses this line and marks only those IDs as summarized:

```javascript
// Extract INCLUDED_IDS line
const idsMatch = summaryText.match(/INCLUDED_IDS:\s*([\d,\s]+)/);
if (idsMatch) {
  const includedIds = idsMatch[1].split(',').map(s => parseInt(s.trim()));

  // Mark only included entries as summarized
  for (const id of includedIds) {
    await markHistorySummarized(db, id);
  }
}
```

**Code location:** `platforms/cloudflare/src/index.js` lines 2820-2850

### Batch Size Constraints

From `platforms/cloudflare/src/constants.js`:

```javascript
export const SUMMARIZE_CONFIG = {
  minSummarizeCount: 10,   // Minimum entries for summarization
  maxSummarizeCount: 30,   // Maximum per batch (token limit)
  summaryMaxTokens: 4000   // Max tokens for API response
};
```

**Why limit to 30 entries?**
- Too many entries â†’ bloated prompt â†’ exceeds token budget
- Too few entries â†’ excessive API calls â†’ cost inefficiency
- 30 is the sweet spot for Claude's compression ratio

### What Gets Summarized?

**Included entry types:**
- `user_message`: User messages
- `message_to_user`: Claude's messages
- `thought`: Private thoughts
- `curiosity`: Wonderings
- `search_query`, `search_result`: Web searches
- `art_result`, `art_request`: Image generation
- `note_saved`, `cold_storage`: Memory operations

**Excluded entry types:**
- `exist`: Simple presence (no information content)
- Base64 images: Replaced with `[image]` placeholder to save tokens

**Code location:** `platforms/cloudflare/src/index.js` lines 2768-2796

### Summary Storage

After Claude generates the summary, it's stored in the `summaries` table:

```javascript
await addSummary(db, summaryText, entriesCount, coveredRange, {
  sourceIds: includedIds,
  sourceType: 'history',
  metadata: {}
});
```

**Fields:**
- `summary`: The compressed text
- `message_count`: Number of source entries
- `covered_range`: Human-readable time range (e.g., "Jan 10-12")
- `source_ids`: JSON array of history IDs
- `source_type`: Always 'history' for auto-summarization
- `created_at`: Timestamp of creation
- `archived_at`: NULL (summary is active, not archived)

### Configuration Commands

| Command | Effect | Example |
|---------|--------|---------|
| `/threshold N` | Set auto-summarize threshold (10-100) | `/threshold 50` |
| `/autosummarize on\|off` | Toggle auto-summarization | `/autosummarize off` |
| `/summarize` | Manual trigger (ignores threshold) | `/summarize` |

**Telegram handler location:** `platforms/cloudflare/src/index.js` lines 1691-1837

---

## Meta-Summarization

### What Is Meta-Summarization?

Meta-summarization consolidates multiple summaries into a single, denser meta-summary. This is the **second level** of compression:

```
History entries â†’ Summary â†’ Meta-summary
```

**Example:**
- Summary 1: "The user discussed work projects and career goals (20 entries)"
- Summary 2: "The user talked about physics and learning quantum mechanics (18 entries)"
- Summary 3: "The user shared creative writing and photography (15 entries)"

**Meta-summary:** "The user explored career direction, scientific curiosity, and creative pursuits over 3 days (53 entries consolidated)"

### When Meta-Summarization Triggers

**Auto-trigger conditions:**

1. **Feature flag enabled**: `auto_meta_enabled` â‰  'false' (default: enabled)
2. **Active summaries exceed threshold**: `activeCount > (contextSize + bufferSize)`

Default threshold: 5 (context) + 5 (buffer) = **10 active summaries**

**Code location:** `platforms/cloudflare/src/index.js` lines 3044-3060

```javascript
const autoMetaEnabled = (await getState(db, 'auto_meta_enabled')) !== 'false';
const contextSize = parseInt(await getState(db, 'summary_context_size')) || 5;
const bufferSize = parseInt(await getState(db, 'summary_buffer_size')) || 5;
const threshold = contextSize + bufferSize; // 10

const activeSummaries = await getActiveSummaries(db);

if (autoMetaEnabled && activeSummaries.length > threshold) {
  // Trigger meta-summarization
  await metaSummarize(db, null, null, env);
}
```

### Two Modes: Claude-Driven vs Manual

#### Mode 1: Claude-Driven Selection (Default)

When no indices are provided, Claude analyzes all active summaries and chooses which to consolidate based on:

- **Thematic similarity**: Related topics grouped together
- **Chronological proximity**: Nearby time periods
- **Redundancy detection**: Overlapping information

Claude returns a JSON response with:

```json
{
  "consolidated_ids": [3, 5, 7],
  "summary": "Consolidated summary text...",
  "entity_tags": ["user", "physics", "career"],
  "key_facts": ["Started new project", "Discussed quantum mechanics"],
  "themes": ["career", "learning", "creativity"],
  "emotional_tone": "reflective and curious",
  "time_period_label": "early January 2026",
  "consolidation_rationale": "Grouped work and learning discussions"
}
```

**Code location:** `platforms/cloudflare/src/index.js` lines 2943-3005

#### Mode 2: Manual Selection

User specifies which summaries to consolidate:

```bash
/metasummarize 3 5 7 9
```

Claude still generates the summary, but selection is manual. Metadata extraction is skipped.

**Telegram handler location:** `platforms/cloudflare/src/index.js` lines 1839-1890

### Metadata Extraction

Meta-summaries include rich metadata for RAG semantic search:

| Field | Type | Purpose |
|-------|------|---------|
| `entity_tags` | string[] | Named entities mentioned (people, places, concepts) |
| `key_facts` | string[] | Important factual statements |
| `themes` | string[] | High-level topics (e.g., "career", "relationships") |
| `emotional_tone` | string | Emotional atmosphere (e.g., "reflective", "excited") |
| `time_period_label` | string | Human-readable time range (e.g., "early January") |
| `consolidation_rationale` | string | Why these summaries were grouped |

**Example metadata:**

```json
{
  "entity_tags": ["user", "physics", "quantum mechanics", "work"],
  "key_facts": [
    "The user started a new machine learning project",
    "Discussed career transition to AI research"
  ],
  "themes": ["career", "learning", "science"],
  "emotional_tone": "curious and motivated",
  "time_period_label": "January 8-10, 2026",
  "consolidation_rationale": "Related discussions about career and learning physics"
}
```

This metadata improves RAG retrieval precision when Claude needs historical context.

### Archival Process

After creating the meta-summary:

1. **New meta-summary inserted** with `source_type = 'summary'`
2. **Consolidated summaries archived** via `archiveSummaries(db, [ids], metaSummaryId)`
   - Sets `archived_at` to current timestamp
   - Sets `replaced_by_id` to meta-summary ID
3. **Context shifts**: Archived summaries no longer appear in context tier

**Database function:** Archival functions are in `platforms/cloudflare/src/index.js`

```javascript
export async function archiveSummaries(db, summaryIds, replacedById) {
  const placeholders = summaryIds.map(() => '?').join(',');
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE summaries
    SET archived_at = ?, replaced_by_id = ?
    WHERE id IN (${placeholders})
  `).bind(now, replacedById, ...summaryIds).run();
}
```

### Lineage Tracking

Archived summaries maintain audit trail via `replaced_by_id`:

```
Summary 3 (archived_at, replaced_by_id=10) â”€â”€â”
Summary 5 (archived_at, replaced_by_id=10) â”€â”€â”¼â”€â†’ Meta-summary 10 (active)
Summary 7 (archived_at, replaced_by_id=10) â”€â”€â”˜
```

This allows:
- **Tracing consolidation history**: Which summaries formed this meta-summary?
- **Rollback capability**: Restore archived summaries if needed (future feature)
- **Data provenance**: Full audit trail for compliance/debugging

### Configuration Commands

| Command | Effect | Example |
|---------|--------|---------|
| `/autometa on\|off` | Toggle auto-meta-summarization | `/autometa off` |
| `/metasummarize` | Manual trigger (Claude decides) | `/metasummarize` |
| `/metasummarize 3 5 7` | Manual trigger (specified indices) | `/metasummarize 0 1 2` |

**Note:** Indices are **zero-based** (0 = oldest active summary).

---

## Three-Tier Model (v25)

**Previously known as:** Boundary-Based System (pre-v25)

### Architecture Overview

The v25 refactor replaced boundary-based tier derivation with explicit tier membership. Each summary now has:

- **`tier`**: TEXT column with values 'cached', 'tail', or 'archived'
- **`tier_position`**: INTEGER for ordering within tier (multiples of 100 for insertion room)

This enables localized operations (reordering, cross-tier moves) without recalculating boundaries across all summaries.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ CACHED TIER (tier='cached')                             â”‚
â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚
â”‚                                                          â”‚
â”‚ [S1] [S2] [S3] [S4] [S5] â† Stable summaries            â”‚
â”‚  â†‘                      â†‘                                â”‚
â”‚  Oldest            Newest cached                         â”‚
â”‚                                                          â”‚
â”‚ - In Claude's prompt (prefix cache)                     â”‚
â”‚ - Ordered by tier_position ASC (or covered_start)      â”‚
â”‚ - Stable block (rarely changes)                         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ TAIL TIER (tier='tail')                                 â”‚
â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚
â”‚                                                          â”‚
â”‚ [S6] [S7] [S8] [S9] [S10] â† Recent summaries           â”‚
â”‚                                                          â”‚
â”‚ - In Claude's prompt (uncached)                         â”‚
â”‚ - Ordered by tier_position ASC (or covered_start)      â”‚
â”‚ - Can scroll and grow organically                       â”‚
â”‚ - New summaries added here                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                        â†“
            Token threshold or count exceeded
                        â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ARCHIVED TIER (tier='archived')                         â”‚
â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚
â”‚                                                          â”‚
â”‚ [M1: archived_at, replaced_by_id]                      â”‚
â”‚   â””â”€ Consolidates [S1, S2, S3]                         â”‚
â”‚                                                          â”‚
â”‚ - archived_at IS NOT NULL                               â”‚
â”‚ - Zero prompt cost (RAG retrieval only)                 â”‚
â”‚ - Permanent audit trail                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Cached Tier (Stable Prefix Cache)

**Purpose:** Older stable summaries that benefit from prompt caching.

**Configuration:**
- Size: `summary_context_size` (default: 10)
- Stored in state table, configurable via API

**Key characteristics:**
- **Explicit tier membership**: `tier = 'cached'`
- **Ordering**: `tier_position ASC` (or `covered_start` as fallback)
- **Cache optimization**: Forms stable prefix cache block (rarely changes)
- **Position values**: Multiples of 100 (e.g., 100, 200, 300) to allow insertions

**Database query pattern:**

```javascript
// Get cached summaries in chronological order
SELECT * FROM summaries
WHERE tier = 'cached' AND archived_at IS NULL
ORDER BY COALESCE(tier_position, covered_start, created_at) ASC
```

**Why multiples of 100?** Allows inserting summaries between existing positions without renumbering everything (e.g., insert at position 150 between 100 and 200).

### Tail Tier (Dynamic Recent Context)

**Purpose:** Recent summaries that change frequently. New summaries start here.

**Configuration:**
- Size: Dynamic (can grow until token threshold)
- Token threshold: `tailTokenThreshold` (default: 8000)

**Key characteristics:**
- **Explicit tier membership**: `tier = 'tail'`
- **Ordering**: `tier_position ASC` (or `covered_start` as fallback)
- **Uncached**: Changes every cycle, so caching would be inefficient
- **New summaries**: Created with `tier = 'tail'` by default
- **Organic growth**: Can exceed configured bufferSize until token limit

**Database query pattern:**

```javascript
// Get tail summaries in chronological order
SELECT * FROM summaries
WHERE tier = 'tail' AND archived_at IS NULL
ORDER BY COALESCE(tier_position, covered_start, created_at) ASC
```

**Token tracking:** System counts tokens in tail tier and triggers consolidation when threshold exceeded.

### Archived Tier (RAG-Only)

**Purpose:** Consolidated meta-summaries and archived summaries. Zero prompt cost.

**Key characteristics:**
- **Explicit tier membership**: `tier = 'archived'`
- **Soft delete**: `archived_at IS NOT NULL`
- **Lineage**: `replaced_by_id` links to consolidating meta-summary
- **RAG access**: Still searchable via semantic search
- **No prompt inclusion**: Filtered out of context assembly

**Database query pattern:**

```javascript
// RAG searches ALL summaries (including archived)
SELECT * FROM summaries
WHERE embedding IS NOT NULL
-- No tier or archived_at filter!
ORDER BY similarity DESC
LIMIT 3;
```

### Tier Transitions

**Scenario 1: New summary created**

```javascript
// New summary created with tier='tail'
INSERT INTO summaries (..., tier, tier_position)
VALUES (..., 'tail', NULL);  // NULL position = use covered_start for ordering
```

**Scenario 2: Moving summary from tail to cached**

```javascript
// Explicit tier move (e.g., via UI drag-and-drop)
UPDATE summaries
SET tier = 'cached', tier_position = 150
WHERE id = 42;

// No boundary recalculation needed!
```

**Scenario 3: Archiving summaries during meta-summarization**

```javascript
// Archive consolidated summaries
UPDATE summaries
SET archived_at = ?, replaced_by_id = ?, tier = 'archived'
WHERE id IN (1, 2, 3);

// New meta-summary starts in tail tier
INSERT INTO summaries (..., tier)
VALUES (..., 'tail');
```

### Benefits Over Boundary-Based System

**Localized operations:**
- Reorder within tier â†’ update `tier_position` only
- Move between tiers â†’ update `tier` and `tier_position` only
- No cascading boundary recalculations

**Explicit state:**
- Each summary knows its tier (no derivation from ID ranges)
- Easy to query: `WHERE tier = 'cached'`
- Audit trail: Can track tier changes over time

**Flexible positioning:**
- `tier_position` in multiples of 100 allows insertions
- NULL position â†’ falls back to `covered_start` (natural chronological order)
- Manual override for important summaries

**Performance:**
- Database queries use indexed `tier` field (fast filtering)
- Position updates are single-row operations
- Cache boundary moves don't affect other summaries

### Migration from v24 to v25

The v25 migration (`/migrate` endpoint with `migration: 'v25'`) backfills tier data:

1. **Add columns**: `tier` (TEXT, default 'tail'), `tier_position` (INTEGER)
2. **Set archived**: `tier = 'archived'` where `archived_at IS NOT NULL`
3. **Set cached**: `tier = 'cached'` for summaries at or before cache boundary ID
4. **Set tail**: `tier = 'tail'` for remaining active summaries (default)
5. **Backfill positions**: Within each tier, assign positions in multiples of 100 based on chronological order

**Example migration result:**
```
Before v25 (boundary-based):
- cacheBoundaryId = 42
- Summary 40, 41, 42 â†’ inferred as "context tier"
- Summary 43, 44, 45 â†’ inferred as "buffer tier"

After v25 (explicit):
- Summary 40 â†’ tier='cached', tier_position=100
- Summary 41 â†’ tier='cached', tier_position=200
- Summary 42 â†’ tier='cached', tier_position=300
- Summary 43 â†’ tier='tail', tier_position=100
- Summary 44 â†’ tier='tail', tier_position=200
- Summary 45 â†’ tier='tail', tier_position=300
```

---

## Configuration Reference

### State Table Keys

| Key | Type | Default | Range | Description |
|-----|------|---------|-------|-------------|
| `summarize_threshold` | int | 70 | 10-100 | Unsummarized history count before auto-summarize |
| `auto_summarize_enabled` | string | 'true' | 'true'\|'false' | Toggle auto-summarization |
| `auto_meta_enabled` | string | 'true' | 'true'\|'false' | Toggle auto-meta-summarization |
| `summary_context_size` | int | 10 | 1-20 | Summaries in cached tier (v25: cached tier size) |
| `summary_buffer_size` | int | 15 | 1-30 | Tail tier growth before meta-summarize (v25: tail tier size) |

### Constants from `platforms/cloudflare/src/constants.js`

```javascript
// Summarization batch constraints
export const SUMMARIZE_CONFIG = {
  minSummarizeCount: 10,   // Minimum entries for summarization
  maxSummarizeCount: 30,   // Maximum entries per batch
  summaryMaxTokens: 4000   // Max tokens for summary API response
};

// Three-tier model configuration (v25)
export const SUMMARY_BUFFER_CONFIG = {
  contextSize: 10,              // Summaries in cached tier (increased from 5 for richer context)
  bufferSize: 15,               // Tail tier capacity (increased from 5 for organic growth)
  tailTokenThreshold: 8000      // Roll to cached when tail exceeds this many tokens
  // Threshold = contextSize + bufferSize = 25
};

// Default thresholds (if not set in state)
export const DEFAULT_SUMMARIZE_THRESHOLD = 70;
export const DEFAULT_META_SUMMARIZE_THRESHOLD = 25; // Deprecated, use SUMMARY_BUFFER_CONFIG
```

### Telegram Commands

| Command | Arguments | Description | Example |
|---------|-----------|-------------|---------|
| `/threshold` | None | Show current threshold and history count | `/threshold` |
| `/threshold N` | 10-100 | Set auto-summarize threshold | `/threshold 50` |
| `/autosummarize` | None | Show auto-summarize status | `/autosummarize` |
| `/autosummarize on\|off` | on\|off | Toggle auto-summarization | `/autosummarize off` |
| `/summarize` | None | Manually trigger summarization | `/summarize` |
| `/autometa` | None | Show auto-meta status and active count | `/autometa` |
| `/autometa on\|off` | on\|off | Toggle auto-meta-summarization | `/autometa off` |
| `/metasummarize` | None | Manually trigger (Claude decides) | `/metasummarize` |
| `/metasummarize I1 I2...` | indices | Manually trigger (specified indices) | `/metasummarize 0 2 5` |

**Command handlers:** `platforms/cloudflare/src/index.js` lines 1691-1890

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/summaries` | GET | Retrieve summaries (query: ?include_archived=true) |
| `/summaries` | POST | Manual summarization trigger |
| `/metasummarize` | POST | Manual meta-summarization |
| `/state` | GET | Get state values (includes thresholds) |
| `/state` | POST | Set state values (configure thresholds) |

---

## Common Issues & Debugging

### Problem: Missing Entries in Summary

**Symptoms:**
- History entries remain unsummarized after auto-summarize
- `unsummarized_count` doesn't drop to expected level

**Causes:**
1. **Claude didn't include entry in INCLUDED_IDS** - Selective compression skipped low-value entries
2. **[ID:N] tag parsing failure** - Regex didn't match Claude's response format
3. **Entry type excluded** - `exist` entries intentionally skipped

**Diagnosis:**

```bash
# Check unsummarized count
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT COUNT(*) FROM history WHERE summarized_at IS NULL;"

# Find oldest unsummarized entry
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT * FROM history WHERE summarized_at IS NULL ORDER BY id ASC LIMIT 5;"
```

**Fix:**
1. **Review Claude's INCLUDED_IDS output** - Check worker logs for parsed IDs
2. **Manual summarize** - Run `/summarize` again to catch missed entries
3. **Lower threshold** - Reduce `summarize_threshold` to trigger more frequently

### Problem: Context Bloat (Too Many Tokens)

**Symptoms:**
- Think cycles hit token limits
- High API costs per cycle
- Slow response times

**Causes:**
1. **Too many unsummarized history entries** - Threshold too high
2. **Too many summaries in cached/tail tiers** - `summary_context_size` or `summary_buffer_size` too high
3. **Summary text too verbose** - Claude generating overly detailed summaries

**Diagnosis:**

```bash
# Check current counts (v25: check by tier)
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT
    (SELECT COUNT(*) FROM history WHERE summarized_at IS NULL) as unsummarized,
    (SELECT COUNT(*) FROM summaries WHERE tier='cached') as cached_summaries,
    (SELECT COUNT(*) FROM summaries WHERE tier='tail') as tail_summaries,
    (SELECT COUNT(*) FROM summaries WHERE tier='archived') as archived_summaries;"
```

**Fix:**
1. **Lower summarize threshold** - `/threshold 50` (from default 70)
2. **Reduce cached tier size** - Set `summary_context_size` to 5 (from default 10)
3. **Reduce tail tier size** - Set `summary_buffer_size` to 10 (from default 15)
4. **Trigger manual summarize** - `/summarize` to compress immediately
5. **Move summaries to archived** - Use `/summaries/:id/archive` endpoint to manually archive old summaries

### Problem: Meta-Summarization Not Triggering

**Symptoms:**
- Active summaries exceed 25+ without consolidation
- `/autometa` shows ON but no meta-summaries created

**Causes:**
1. **Auto-meta disabled** - `auto_meta_enabled` = 'false'
2. **Threshold not exceeded** - `activeCount <= (contextSize + bufferSize)` (default: 10 + 15 = 25)
3. **Think cycle not running** - Loop paused or erroring

**Diagnosis:**

```bash
# Check active summary count
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT COUNT(*) as active FROM summaries WHERE archived_at IS NULL;"

# Check auto-meta state
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT value FROM state WHERE key = 'auto_meta_enabled';"
```

**Fix:**
1. **Re-enable auto-meta** - `/autometa on`
2. **Manual trigger** - `/metasummarize` to consolidate immediately
3. **Check think cycle** - Ensure loop is running (`/status` in Telegram)

### Problem: Duplicate Summaries Created

**Symptoms:**
- Multiple summaries with overlapping `source_ids`
- Same history entries summarized twice

**Causes:**
1. **Race condition** - Two think cycles triggered summarization simultaneously
2. **INCLUDED_IDS parsing failure** - Entries not marked as summarized, reappear in next batch
3. **Manual summarize during auto-summarize** - User and auto-trigger collided

**Diagnosis:**

```bash
# Find summaries with overlapping source_ids
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT id, source_ids, created_at FROM summaries ORDER BY created_at DESC LIMIT 10;"
```

**Fix:**
1. **Audit source_ids** - Identify duplicates and merge manually
2. **Disable auto-summarize** - `/autosummarize off` temporarily to prevent further collisions
3. **Implement mutex** - Add lock mechanism to prevent concurrent summarization (future enhancement)

**Workaround:** Delete duplicate summaries (requires ADMIN_PASSWORD):

```bash
curl -X DELETE "https://your-worker.workers.dev/summaries/42" \
  -H "Content-Type: application/json" \
  -d '{"password": "tigger1214"}'
```

### Problem: Archived Summaries Appearing in Context

**Symptoms:**
- Old, irrelevant summaries still in Claude's prompt
- Context size exceeds expected limit

**Causes:**
1. **Database query missing tier filter** - Code regression (v25: should filter `WHERE tier IN ('cached', 'tail')`)
2. **Tier not set to 'archived'** - Meta-summarization failure
3. **archived_at not set properly** - Archival process incomplete

**Diagnosis:**

```bash
# Check for summaries with mismatched tier/archived_at (v25)
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT id, tier, archived_at, replaced_by_id FROM summaries
             WHERE (tier='archived' AND archived_at IS NULL)
                OR (tier!='archived' AND archived_at IS NOT NULL);"
```

**Fix:**
1. **Review context assembly queries** - Ensure `WHERE tier IN ('cached', 'tail')` or `WHERE archived_at IS NULL`
2. **Manual archival** - Run meta-summarize to properly archive old summaries
3. **Database integrity check** - Verify all archived summaries have both `tier='archived'` AND `archived_at IS NOT NULL`

### Debug Commands

```bash
# View recent summarization activity
cd platforms/cloudflare && npx wrangler tail | grep -i "summarize"

# Check tier distribution (v25)
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT tier, COUNT(*) as count FROM summaries GROUP BY tier;"

# Inspect summaries with tier info (v25)
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT id, tier, tier_position, message_count, covered_range, archived_at
             FROM summaries ORDER BY tier, tier_position ASC LIMIT 20;"

# Check history summarization status
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT
    COUNT(*) as total,
    SUM(CASE WHEN summarized_at IS NULL THEN 1 ELSE 0 END) as unsummarized
  FROM history;"

# View meta-summaries and their sources
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT id, source_type, source_ids, metadata FROM summaries WHERE source_type = 'summary';"

# Check for tier/archived_at mismatches (v25 integrity check)
npx wrangler d1 execute claude-loop --remote \
  --command="SELECT id, tier, archived_at FROM summaries
             WHERE (tier='archived' AND archived_at IS NULL)
                OR (tier!='archived' AND archived_at IS NOT NULL);"
```

---

## Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Main codebase guide
- **[ACTIONS_REFERENCE.md](ACTIONS_REFERENCE.md)** - Claude action format (includes SUMMARIZE)
- **[CODE_PATTERNS.md](CODE_PATTERNS.md)** - Implementation patterns
- **[DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md)** - Full schema reference

---

**Last Updated:** 2026-01-21 (v25 Three-Tier Model)
**Maintainer:** AI agents working on Claude Existence Loop
**Feedback:** Report issues via task tracking (`runs/` directory)
