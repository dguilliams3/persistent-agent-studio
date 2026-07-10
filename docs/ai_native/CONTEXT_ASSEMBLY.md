# Context Window Assembly & 4-Block Caching

**Last Updated:** 2026-01-19 18:30 EST

---

## Table of Contents

1. [System Overview](#system-overview)
2. [4-Block Caching Architecture](#4-block-caching-architecture)
3. [Stable Prefix Boundary Mechanism](#stable-prefix-boundary-mechanism)
4. [Image Handling](#image-handling)
5. [What Goes In vs Out of Context](#what-goes-in-vs-out-of-context)
6. [Cache Efficiency Metrics](#cache-efficiency-metrics)
7. [Adding New Context Sections](#adding-new-context-sections)

---

## System Overview

### What Claude Sees Each Cycle

Every time Claude's thinking cycle runs, the system assembles a comprehensive context window that includes:

- **Static constitution** - System prompt + cold storage + MY SPACE (rarely changes)
- **Stable context** - Learned, questions, notebook index, observations (changes on Clio actions)
- **Summaries prefix** - Older compressed history summaries (independent cache lifecycle)
- **Fresh tail** - RAG results, summary tail, FULL conversation history, reminders, status

This context window can be **20,000+ tokens**, which would cost significant money if sent fresh every cycle.

### Why Caching Matters

Anthropic's Prompt Caching feature allows us to mark sections of the prompt as cacheable. When Claude processes a cached section:

1. **First time**: Cache write occurs (25% premium cost)
2. **Subsequent calls**: Cache read occurs (90% discount - pay only 10%)
3. **Cache duration**: 1 hour (with extended TTL beta header)

**Cost savings example:**
- Without caching: 20,000 input tokens × $3/M = $0.06 per cycle
- With caching (90% cached): 2,000 fresh + 18,000 cached (10% cost) = $0.0114 per cycle
- **Savings: ~80% reduction in input costs**

At 144 cycles/day (10-minute intervals), this saves **~$7/day** or **~$200/month**.

### 4-Block Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLAUDE'S CONTEXT WINDOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BLOCK 1: Constitution + Permanent Context                     │   │
│  │ [cache_control: ephemeral, ttl: 1hr]                         │   │
│  │                                                               │   │
│  │ • System prompt template                                     │   │
│  │ • Action definitions (THINK, MESSAGE_USER, LEARNED, etc.)    │   │
│  │ • MY_CONTEXT static text about the user                      │   │
│  │ • Cold storage (permanent memories)                          │   │
│  │ • MY SPACE (pinned images, gallery summary)                  │   │
│  │                                                               │   │
│  │ Size: ~9000-11000 tokens                                     │   │
│  │ Change frequency: Rarely (deploys, cold storage, pins)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BLOCK 2: Stable Context (no summaries)                       │   │
│  │ [cache_control: ephemeral, ttl: 1hr]                         │   │
│  │                                                               │   │
│  │ • Learnings (self-knowledge with confidence levels)          │   │
│  │ • Questions (open threads with domains)                      │   │
│  │ • Notebook index (titles + summaries only)                   │   │
│  │ • Observations index                                         │   │
│  │                                                               │   │
│  │ Size: ~2000-4000 tokens                                      │   │
│  │ Change frequency: On LEARNED/QUESTION/NOTE/OBSERVATION acts  │   │
│  │                                                               │   │
│  │ NOTE: Summaries moved to Block 3 for independent caching     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BLOCK 3: Summaries Prefix                                    │   │
│  │ [cache_control: ephemeral, ttl: 1hr] (conditional)           │   │
│  │                                                               │   │
│  │ • Older compressed history summaries                         │   │
│  │ • Newer summaries in Block 4 tail (uncached)                 │   │
│  │ • Split by token threshold (~2000 tokens tail)               │   │
│  │                                                               │   │
│  │ Size: ~12000-20000 tokens (depends on summary volume)        │   │
│  │ Change frequency: Only when meta-summaries created (~18 cyc) │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BLOCK 3.5: Profile Picture (optional)                        │   │
│  │ [cache_control: ephemeral, ttl: 1hr]                         │   │
│  │                                                               │   │
│  │ • Claude's current profile picture image reference           │   │
│  │ • Only included if profile_pic state value exists            │   │
│  │                                                               │   │
│  │ Size: Variable (compressed image data)                       │   │
│  │ Change frequency: Rare (manual changes by Claude)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ BLOCK 4: Fresh Tail (FULL HISTORY)                           │   │
│  │ [NO cache_control - always fresh]                            │   │
│  │                                                               │   │
│  │ ORDER (distant → recent → action):                           │   │
│  │ 1. RAG-retrieved summaries (semantic search, if enabled)     │   │
│  │ 2. Recent summaries (tail, uncached)                         │   │
│  │ 3. FULL HISTORY (all entries, oldest to newest)              │   │
│  │ 4. Tool feedback from last cycle                             │   │
│  │ 5. Active reminders (with due status)                        │   │
│  │ 6. User's current status                                     │   │
│  │ 7. Current time and loop count                               │   │
│  │ 8. Recent images (user's photos, Claude's art - last 10)     │   │
│  │                                                               │   │
│  │ Size: ~8000-15000 tokens (varies with history)               │   │
│  │ Change frequency: Every cycle                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4-Block Caching Architecture

### Block 1: Static Constitution (1hr TTL)

**Location:** `getStaticSystemPrompt()` in `platforms/cloudflare/src/index.js`

**Contents:**
- System prompt template defining Clio's identity and existence
- Action definitions with detailed formats and examples
- MY_CONTEXT section (static information about the user)
- Action response format instructions

**Token size:** ~5500 tokens

**Change frequency:** Rarely - only when deploying code changes to the system prompt

**Caching strategy:**
```javascript
const block1_constitution = getStaticSystemPrompt();
// In API call:
{
  type: 'text',
  text: block1_constitution,
  cache_control: { type: 'ephemeral' } // 1hr TTL with beta header
}
```

**Why it's cached:** This content is completely static and identical across all cycles for all users. First cycle pays 25% premium, subsequent cycles get 90% discount for the entire hour.

---

### Block 2: Stable Context (1hr TTL)

**Location:** Lines 4632-4637 in `platforms/cloudflare/src/index.js`

**Contents:**
- **Learnings** - Self-knowledge Clio has verified through experience (with confidence levels)
- **Questions** - Open intellectual threads Clio is holding (with domains and status)
- **Notebook index** - List of saved notes with titles, summaries, and timestamps
- **Observations index** - List of observations about the user with titles and summaries

**NOTE:** Cold storage + MY SPACE moved to Block 1 (rarely change). Summaries moved to Block 3 (independent cache lifecycle).

**Token size:** ~2000-4000 tokens (varies by content volume)

**Change frequency:** When Clio takes specific actions
- Learnings: Added when Clio uses LEARNED op:add action (occasional)
- Questions: Added when Clio uses QUESTION op:add action (occasional)
- Notebook: Added when Clio uses NOTE op:save action (occasional)
- Observations: Added when Clio uses OBSERVATION op:save action (occasional)

**Caching strategy:**
```javascript
const block2_stableContext = `--- STABLE CONTEXT ---
${learnedSection}${questionsSection}${notebookSection}${observationsSection}`.trim();
// In API call:
{
  type: 'text',
  text: block2_stableContext,
  cache_control: { type: 'ephemeral' }
}
```

**Why it's cached:** These sections change only when Clio explicitly takes actions to add/update them. Between actions, the entire block gets 90% discount. Separating from summaries means a new summary doesn't invalidate this block.

**Index-only pattern:** Notebook and observations send only titles + summaries, not full content. Full content retrieved on-demand via `GET_NOTE` or `GET_OBSERVATION` actions. This keeps Block 2 smaller and more cache-stable.

---

### Block 3: Summaries Prefix (1hr TTL, conditional)

**Location:** Lines 4639-4654 in `platforms/cloudflare/src/index.js`

**Contents:**
- Older compressed history summaries (beyond the tail threshold)
- Newer summaries in Block 4 tail (uncached) to avoid invalidating this block
- Split by token threshold: ~2000 tokens in tail, rest in prefix

**Token size:** ~12000-20000 tokens (depends on summary volume)

**Change frequency:** Only when meta-summaries are created (~every 18 cycles)

**Conditional caching logic:**
```javascript
const cycleIntervalSeconds = parseInt(await getState(db, 'cycle_interval_seconds')) || 60;
const maxCacheableInterval = 3600 * 0.9; // 54 minutes (90% of 1hr TTL)
const useVolatileCaching = cycleIntervalSeconds <= maxCacheableInterval;

// Summaries prefix - older summaries in their own cached block
const block3_summariesPrefix = summariesPrefixSection;
// In API call (only if useVolatileCaching is true):
{
  type: 'text',
  text: block3_summariesPrefix,
  cache_control: { type: 'ephemeral' }
}
```

**Why separate from Block 2:** Summaries change on a different schedule than learned/questions. When Clio adds a LEARNED entry, Block 2 invalidates but Block 3 keeps its summary cache. When a new summary is created, it goes in Block 4 tail first (uncached), only rolling into Block 3 when tail exceeds threshold.

**Why conditional:** If `cycle_interval_seconds > 54 minutes`, the cache will expire before the next cycle. No point paying 25% premium for cache writes that will never be read.

---

### Block 3.5: Profile Picture (1hr TTL, optional)

**Location:** Dynamically added in API call if `profile_pic` state exists

**Contents:**
- Claude's current profile picture (compressed image data)

**Token size:** Variable (depends on image, typically ~500-1500 tokens for base64)

**Change frequency:** Rare - only when Claude manually changes profile picture

**Caching strategy:**
```javascript
const profilePic = await getState(db, 'profile_pic');
if (profilePic && profilePic.startsWith('data:image')) {
  // Add to message content with cache control
  userContent.push({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: profilePic.split(',')[1]
    },
    cache_control: { type: 'ephemeral' }
  });
}
```

**Why it's cached:** Profile pictures change rarely, so caching amortizes the token cost over many cycles.

---

### Block 4: Fresh Tail - FULL HISTORY (NEVER cached)

**Location:** Lines 4656-4697 in `platforms/cloudflare/src/index.js`

**Contents (in order - distant → recent → action):**
1. **RAG-retrieved summaries** - Semantically relevant past summaries (if RAG enabled, clearly labeled)
2. **Recent summaries (tail)** - New summaries not yet rolled into Block 3 prefix
3. **FULL HISTORY** - All conversation entries (oldest to newest)
4. **Tool feedback** - Error feedback from last cycle's actions
5. **Active reminders** - List of reminders with due indicators
6. **Summarization reminder** - Warning if history exceeds threshold
7. **User's status** - Current availability status
8. **Current time** - Eastern Time formatted datetime
9. **Loop count** - Incremented cycle counter
10. **Time since last message** - Minutes since Claude last messaged the user

**Ordering rationale:** Places distant context (RAG) first, compressed recent (summaries) second, raw history third (oldest to newest), closest to action instructions. This ensures most recent events have maximum attention weight near the action prompt.

**Token size:** ~8000-15000 tokens (varies with history size)

**Change frequency:** Every single cycle

**NO caching:**
```javascript
// ORDERING: RAG (distant) → Summaries (compressed recent) → History (raw recent) → Action context
const block4_freshTail = `--- CURRENT STATE ---
${ragRetrievedSection}${summaryTailSection}${historyTailEntries.length > 0 ? `FULL HISTORY (${historyTailEntries.length} entries, oldest to newest):\n${historyTailText}\n--- END OF HISTORY ---\n\n` : ''}${feedbackSection}${remindersSection}${summarizeReminder}${userStatusSection}Loop count: ${loopCount}
Current time: ${now.toLocaleString(...)} EST...`;
// In API call: NO cache_control marker (always fresh)
{
  type: 'text',
  text: block4_freshTail
  // No cache_control
}
```

**Why FULL history uncached:** Simplifies architecture by eliminating history split boundary management. All history flows in clean chronological order (oldest → newest → action). The trade-off is higher uncached tokens, but the cognitive clarity is worth it.

**Image inclusion:** Images are only collected from the last 10 history entries to save tokens.

---

## Stable Prefix Boundary Mechanism

### The Problem

**Naive approach:** Split history dynamically each cycle at 60/40 ratio:
- Cycle N: 30 entries total → prefix = 0-17, tail = 18-29
- Cycle N+1: 31 entries (1 new) → prefix = 0-18, tail = 19-30

**Result:** Prefix content changes every cycle → cache invalidated every cycle → zero cache hits!

### The Solution: ID-Based Boundary Tracking

**Key insight:** Track the boundary by **entry ID** (not index), and only shift it when the tail grows >= 2x target size.

**State key:** `history_prefix_boundary_id` (integer, history entry ID)

**Algorithm:**
```javascript
// 1. Load stored boundary ID
const storedBoundaryId = await getState(db, 'history_prefix_boundary_id');
let prefixBoundaryId = storedBoundaryId ? parseInt(storedBoundaryId) : null;

// 2. Find where that ID falls in current history
let boundaryIndex = prefixBoundaryId
  ? history.findIndex(h => h.id === prefixBoundaryId)
  : -1;

// 3. If boundary not found (deleted or never set), initialize it
if (boundaryIndex === -1 && history.length > 0) {
  const newBoundaryIndex = Math.max(0, history.length - historyTailSize - 1);
  prefixBoundaryId = history[newBoundaryIndex].id;
  await setState(db, 'history_prefix_boundary_id', String(prefixBoundaryId));
  boundaryIndex = newBoundaryIndex;
}

// 4. Check if tail has grown too large
const currentTailSize = boundaryIndex >= 0 ? history.length - boundaryIndex - 1 : history.length;
if (currentTailSize >= historyTailSize * 2) {
  // 5. Shift boundary forward to bring tail back to target size
  const newBoundaryIndex = history.length - historyTailSize - 1;
  prefixBoundaryId = history[newBoundaryIndex].id;
  await setState(db, 'history_prefix_boundary_id', String(prefixBoundaryId));
  boundaryIndex = newBoundaryIndex;
  console.log(`[Cache] Updated prefix boundary to entry ID ${prefixBoundaryId}`);
}

// 6. Split history using stable boundary
const historyPrefixEntries = history.slice(0, boundaryIndex + 1); // Inclusive
const historyTailEntries = history.slice(boundaryIndex + 1);
```

**Location:** Lines 3537-3568 in `platforms/cloudflare/src/index.js`

### 2x Shift Rule

**Target tail size:** `historyTailSize = Math.ceil(summarizeThreshold * 0.25)`
- With default `summarizeThreshold = 70`: `historyTailSize = 18`

**Shift trigger:** Tail grows to `>= historyTailSize * 2`
- Boundary only shifts when tail reaches 36+ entries

**Example timeline:**
```
Cycle N:   history=70, boundary=ID 52 (index 51), prefix=0-51 (52 entries), tail=52-69 (18 entries)
           → Cache written for prefix (52 entries)

Cycle N+1: history=71, boundary=ID 52 (index 51), prefix=0-51 (52 entries), tail=52-70 (19 entries)
           → Cache HIT for prefix (unchanged)

Cycle N+2: history=72, boundary=ID 52 (index 51), prefix=0-51 (52 entries), tail=52-71 (20 entries)
           → Cache HIT for prefix (unchanged)

... (12 more cycles with cache hits) ...

Cycle N+18: history=88, boundary=ID 52 (index 51), prefix=0-51 (52 entries), tail=52-87 (36 entries)
            → Tail now >= 2x target (36 >= 36)
            → Shift boundary to ID 70 (index 69)
            → New split: prefix=0-69 (70 entries), tail=70-87 (18 entries)
            → Cache MISS (prefix changed), but write new cache

Cycle N+19: history=89, boundary=ID 70 (index 69), prefix=0-69 (70 entries), tail=70-88 (19 entries)
            → Cache HIT for new prefix
```

**Result:** Cache hits for 17 consecutive cycles, then 1 cache miss to shift, then 17+ more hits.

### Why 2x and Not More?

**Tradeoff analysis:**
- **Smaller multiplier (1.5x):** More frequent cache invalidations, but smaller tail = fewer fresh tokens
- **Larger multiplier (3x):** Fewer cache invalidations, but larger tail = more fresh tokens every cycle
- **2x:** Balanced - amortizes cache write cost over ~18 cycles while keeping tail manageable

**Token math:**
- Average tail entry: ~100 tokens
- Target tail: 18 entries = ~1800 tokens/cycle
- Max tail before shift: 36 entries = ~3600 tokens/cycle
- Average over shift cycle: ~2700 tokens/cycle
- Prefix: ~5000 tokens (cached 90% of the time)
- **Net savings:** Pay full price for 2700 tokens/cycle + 10% of 5000 = 3200 tokens vs 7700 uncached = **58% savings**

### Boundary Deletion Handling

**Scenario:** The boundary entry gets deleted (e.g., summarization removes old entries)

**Detection:** `history.findIndex(h => h.id === prefixBoundaryId)` returns `-1`

**Recovery:** Reinitialize boundary at `history.length - historyTailSize - 1`

This causes a cache invalidation (unavoidable), but prevents crashes.

### Configuration

**Constants** (in `platforms/cloudflare/src/constants.js`):
```javascript
export const HISTORY_TAIL_RATIO = 0.25;  // 25% of summarize_threshold
export const DEFAULT_SUMMARIZE_THRESHOLD = 70;
// Tail size = ceil(70 * 0.25) = 18 entries
// Shift trigger = 18 * 2 = 36 entries
```

**Runtime state:**
- `summarize_threshold` - Configurable per-deployment (affects tail size)
- `history_prefix_boundary_id` - Automatically managed by buildSystemPrompt()

---

## Image Handling

### Tail-Only Collection Strategy

**Problem:** Images consume significant tokens (base64 encoding). Including all images every cycle would:
1. Increase token costs dramatically
2. Exceed context window limits quickly
3. Show Claude images it already "saw" in previous cycles

**Solution:** Only collect images from **tail entries** (recent history after boundary)

**Rationale:** Prefix images were in the tail during previous cycles when Claude already processed them visually. Re-sending them wastes tokens without providing new information.

### Implementation

**Location:** Lines 3638-3651 in `platforms/cloudflare/src/index.js`

```javascript
// Image collection arrays
const userImages = [];
const claudeArtImages = [];

// Split history at stable boundary
const historyPrefixEntries = history.slice(0, stableSplitIndex);
const historyTailEntries = history.slice(stableSplitIndex);

// Prefix: DON'T collect images (collectImages=false)
const historyPrefixText = historyPrefixEntries.map(h =>
  formatHistoryEntry(h, userImages, claudeArtImages, false) // false = skip image data
).join('\n');

// Tail: DO collect images (collectImages=true)
const historyTailText = historyTailEntries.map(h =>
  formatHistoryEntry(h, userImages, claudeArtImages, true) // true = collect image data
).join('\n');
```

**formatHistoryEntry() behavior:**

**For prefix entries (collectImages=false):**
```javascript
case 'user_message':
  const hasImage = h.internal && h.internal.startsWith('data:image');
  // Don't push to userImages array, just note it existed
  return `[${timeStr}] USER: "${h.content}"${hasImage ? ' [sent an image]' : ''}`;

case 'art_result':
  const isActualImage = h.content && h.content.startsWith('data:image');
  // Don't push to claudeArtImages array
  return `[${timeStr}] ART CREATED: [image]`;
```

**For tail entries (collectImages=true):**
```javascript
case 'user_message':
  const hasImage = h.internal && h.internal.startsWith('data:image');
  if (hasImage && collectImages) {
    userImages.push({ time: timeStr, image: h.internal, text: h.content });
  }
  return `[${timeStr}] USER: "${h.content}"${hasImage ? ' [sent an image - see below]' : ''}`;

case 'art_result':
  const isActualImage = h.content && h.content.startsWith('data:image');
  if (isActualImage && collectImages) {
    const artPrompt = h.internal?.replace(/^Generated:\s*/, '') || 'untitled';
    claudeArtImages.push({ time: timeStr, image: h.content, prompt: artPrompt });
  }
  return `[${timeStr}] ART CREATED: [image${isActualImage ? ' - see MY ART section below' : ''}]`;
```

### Image Limits

**Constants** (hardcoded in `platforms/cloudflare/src/index.js`):
```javascript
// Lines 3987, 4063:
const recentImages = userImages.slice(-3);        // Last 3 user images
const recentClaudeArt = claudeArtImages.slice(-2); // Last 2 Claude art images
```

**Why these limits:**
- **3 user images:** Captures recent conversation context (photos, screenshots) without overwhelming
- **2 Claude art images:** Lets Claude reference recent creative work without excessive tokens
- **Total: 5 images max** per cycle (typically 2000-5000 tokens depending on compression)

**Note:** No `MAX_IMAGES_IN_CONTEXT` constant exists - limits are hardcoded at usage sites.

### Token Savings

**Example calculation:**
- Compressed image: ~800 tokens each
- If history has 10 images (5 in prefix, 5 in tail)
- Without tail-only strategy: 10 × 800 = 8000 tokens
- With tail-only strategy (limit 5): 5 × 800 = 4000 tokens
- **Savings: 4000 tokens/cycle** (~$0.012/cycle or ~$1.73/day at 10-min intervals)

### Image Attribution

**Type distinction:**
- `art_result` - Claude's generated art (Cloudflare AI or Replicate)
- `user_art` - User's UI-generated art (saved via `/save-art` endpoint)

Both collected from tail, presented in separate sections:
```javascript
userContent.push({ type: 'text', text: `\n\nUSER'S IMAGES (${recentImages.length} recent):` });
// ... add the user's images ...
userContent.push({ type: 'text', text: `\n\nMY ART (${recentClaudeArt.length} recent creations I can see):` });
// ... add Claude's art ...
```

---

## What Goes In vs Out of Context

### IN Context (Every Cycle)

| Component | Location | Cache Block | Typical Token Size | Change Frequency |
|-----------|----------|-------------|-------------------|------------------|
| System prompt template | Block 1 | Static | ~5500 | Rare (deploys only) |
| Action definitions | Block 1 | Static | (in system prompt) | Rare |
| MY_CONTEXT (user info) | Block 1 | Static | (in system prompt) | Rare |
| Cold storage list | Block 2 | Stable | ~500-2000 | Infrequent (hours) |
| Notebook index | Block 2 | Stable | ~300-1500 | Infrequent (hours) |
| Observations index | Block 2 | Stable | ~300-1000 | Infrequent (hours) |
| Context summaries (5) | Block 2 | Stable | ~1000-2500 | Periodic (hours/days) |
| History prefix | Block 3 | Conditional | ~1000-8000 | Batch shifts (~18 cycles) |
| Profile picture | Block 3.5 | Optional | ~500-1500 | Rare (manual changes) |
| RAG summaries (3) | Block 4 | Never | ~500-1500 | Every cycle (if enabled) |
| Summary tail | Block 4 | Never | ~500-1500 | When new summaries created |
| History tail | Block 4 | Never | ~1000-3000 | Every cycle |
| Tool feedback | Block 4 | Never | ~0-500 | When errors occur |
| Active reminders | Block 4 | Never | ~100-500 | Occasional (when set) |
| User's status | Block 4 | Never | ~50-150 | Variable (manual/auto) |
| Time and loop count | Block 4 | Never | ~50 | Every cycle |
| Recent images (5) | Block 4 | Never | ~2000-5000 | Variable (activity-dependent) |

**Total typical context:** 15,000-30,000 tokens
- Cached portion: 8,000-17,000 tokens (Block 1-3)
- Fresh portion: 3,000-8,000 tokens (Block 4)

### OUT of Context (Not Included)

These components are accessible but NOT in the direct prompt:

| Component | Reason | Access Method | Where Stored |
|-----------|--------|---------------|--------------|
| Tail tier summaries | Token optimization | RAG semantic retrieval | `summaries` table (tier='tail') |
| Archived summaries | Historical | RAG semantic retrieval | `summaries` table (tier='archived') |
| Notebook content (full) | Size limit | `GET_NOTE` action | `notebook` table |
| Observation details | Size limit | `GET_OBSERVATION` action | `observations` table |
| Old images (prefix) | Already seen | Gallery (frontend UI) | `history` table (internal field) |
| Triggered reminders | History log | N/A (visible in history) | `reminders` table (triggered=1) |
| Deleted observations | Soft delete | Admin recovery only | `observations` (deleted_at set) |
| Cost/cycle data | Analytics | `/cycles` API endpoint | `cycles` table |
| Memory branches | Editor feature | Branch API endpoints | `memory_branches` table |
| Memory overrides | Branch view | Applied in buildSystemPrompt | `memory_overrides` table |
| Synthetic memories | Branch injection | Applied in buildSystemPrompt | `synthetic_memories` table |

### Access Patterns

**Direct prompt:**
- Always available
- Zero latency
- Token cost every cycle (unless cached)
- Best for: Frequently needed, small-to-medium size content

**Action-based retrieval:**
- Claude must explicitly request via action (GET_NOTE, GET_OBSERVATION)
- One cycle delay (request → next cycle sees content in history)
- Token cost only when retrieved
- Best for: Large content, infrequently needed

**RAG semantic retrieval:**
- Automatic based on recent history embedding
- Retrieved every cycle (if RAG enabled)
- Token cost only for retrieved results (typically 3 summaries)
- Best for: Historical context relevant to current conversation

**Frontend UI only:**
- No API access, user-facing display
- Zero Claude visibility
- No token cost
- Best for: Audit trails, user exploration (gallery, cost graphs)

---

## Cache Efficiency Metrics

### Token Savings Calculation

**Anthropic API response fields:**
```javascript
response.usage = {
  input_tokens: 18500,                    // Total input tokens sent
  cache_creation_input_tokens: 14000,     // Tokens written to cache (first call)
  cache_read_input_tokens: 14000,         // Tokens read from cache (subsequent calls)
  output_tokens: 350                      // Response tokens generated
}
```

**Cost calculation:**

**First cycle (cache write):**
```javascript
const cachedTokens = response.usage.cache_creation_input_tokens || 0;  // 14000
const uncachedTokens = response.usage.input_tokens - cachedTokens;     // 4500

const inputCost = (
  (uncachedTokens / 1_000_000) * inputPricePerMillion +
  (cachedTokens / 1_000_000) * inputPricePerMillion * 1.25  // 25% premium
);

// Example (Sonnet at $3/M input):
// = (4500 / 1M) * $3 + (14000 / 1M) * $3 * 1.25
// = $0.0135 + $0.0525
// = $0.066
```

**Subsequent cycles (cache read):**
```javascript
const cacheReadTokens = response.usage.cache_read_input_tokens || 0;   // 14000
const freshTokens = response.usage.input_tokens - cacheReadTokens;     // 4500

const inputCost = (
  (freshTokens / 1_000_000) * inputPricePerMillion +
  (cacheReadTokens / 1_000_000) * inputPricePerMillion * 0.1  // 90% discount
);

// Example (Sonnet at $3/M input):
// = (4500 / 1M) * $3 + (14000 / 1M) * $3 * 0.1
// = $0.0135 + $0.0042
// = $0.0177
```

**Savings per cycle:** $0.066 (no cache) - $0.0177 (cache hit) = **$0.0483 saved**

**Break-even:** Cache write premium ($0.066 - $0.0177 = $0.0489) recovered after 1 cache hit

### Typical Savings by Block

**Block 1 (Static Constitution):**
- Size: ~5500 tokens
- Cache hit rate: ~99% (only misses on deploy)
- Savings per hit: 5500 × $3/M × 0.9 = $0.01485/cycle
- Monthly: $0.01485 × 144 cycles/day × 30 days = **~$64/month**

**Block 2 (Stable Context):**
- Size: ~2000-5000 tokens (avg 3500)
- Cache hit rate: ~80% (invalidated by COLD_STORAGE, SAVE_NOTE, etc.)
- Savings per hit: 3500 × $3/M × 0.9 = $0.00945/cycle
- Monthly: $0.00945 × 144 × 30 × 0.8 = **~$33/month**

**Block 3 (History Prefix):**
- Size: ~1000-8000 tokens (avg 4000)
- Cache hit rate: ~95% (only misses on boundary shift every ~18 cycles)
- Savings per hit: 4000 × $3/M × 0.9 = $0.0108/cycle
- Monthly: $0.0108 × 144 × 30 × 0.95 = **~$44/month**

**Total cache savings:** ~$141/month (Sonnet pricing)

**Without caching:** ~$280/month total input costs
**With caching:** ~$139/month total input costs
**Net reduction:** **~50% input cost savings**

### Verifying Cache Effectiveness

**Log inspection:**

Look for these console.log entries in worker logs (`npx wrangler tail`):

```
[Cache] Initialized prefix boundary at entry ID 245 (index 51)
[Cache] Updated prefix boundary to entry ID 270 (tail was 36, now 18)
```

**API response analysis:**

Check the `cycles` table for cache token data:
```sql
SELECT
  created_at,
  input_tokens,
  cached_tokens,
  cache_read_tokens,
  ROUND((cache_read_tokens * 1.0 / input_tokens) * 100, 1) as cache_hit_rate_pct
FROM cycles
WHERE created_at > datetime('now', '-1 day')
ORDER BY created_at DESC
LIMIT 20;
```

**Healthy metrics:**
- `cache_hit_rate_pct` consistently 70-85%
- `cache_read_tokens` shows stable values (~14000) with occasional drops to 0 (cache miss)
- Cache misses occur in batches: Block 1 miss (deploy), Block 2 miss (new memory), Block 3 miss (boundary shift)

**Unhealthy signs:**
- `cache_hit_rate_pct` consistently < 50%
- `cache_read_tokens` frequently 0
- Erratic cache read values → suggests boundary thrashing (reduce TAIL_SHIFT_MULTIPLIER)

### Cache TTL Monitoring

**Extended cache TTL header:**
```javascript
headers: {
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'extended-cache-ttl-2025-04-11' // Required for 1hr TTL
}
```

**If header missing:** Cache TTL falls back to 5 minutes → cache expires between cycles → zero hits

**Verification:** Check response headers for confirmation (not currently logged, but can add)

---

## Adding New Context Sections

### Decision Checklist

Before adding new content to Claude's context, work through this decision tree:

1. **Is it needed every cycle?**
   - No → Use action-based retrieval (GET_SOMETHING action)
   - Yes → Continue to #2

2. **Does it change every cycle?**
   - Yes → Add to Block 4 (Fresh Tail) - no caching
   - No → Continue to #3

3. **Does it change multiple times per hour?**
   - Yes → Add to Block 4 (Fresh Tail) - caching would hurt more than help
   - No → Continue to #4

4. **Does it change rarely (hours/days between changes)?**
   - Yes → Add to Block 2 (Stable Context) - cache hits amortize cost
   - No (changes ~hourly) → Add to Block 3 or 4 depending on size

5. **Is it large (>2000 tokens)?**
   - Yes → Reconsider: can you use an index + action-based retrieval?
   - No → Proceed with adding to appropriate block

6. **Does it depend on history content?**
   - Yes (e.g., "recent conversation topic detector") → Block 4 (depends on tail)
   - No → Block 2 (stable across cycles)

### Implementation Steps

#### For Block 2 (Stable Context) Addition

**Example:** Adding "favorite topics" permanent list

1. **Query the data:**
```javascript
// In buildSystemPrompt()
const favoriteTopics = await getFavoriteTopics(db); // Your query function
```

2. **Format for display:**
```javascript
const favoriteTopicsSection = favoriteTopics.length > 0
  ? `MY FAVORITE TOPICS:\n${favoriteTopics.map(t => `- ${t.name}: ${t.description}`).join('\n')}\n\n`
  : '';
```

3. **Add to Block 2 assembly:**
```javascript
const block2_stableContext = `--- STABLE CONTEXT ---
${coldStorageSection}${notebookSection}${observationsSection}${summariesSection}${favoriteTopicsSection}`.trim();
```

4. **Update constants (if applicable):**
```javascript
// In platforms/cloudflare/src/constants.js
export const MAX_FAVORITE_TOPICS = 10; // Prevent unbounded growth
```

5. **Test cache impact:**
```javascript
// Before deploy: Note current cache_read_tokens avg
// After deploy: Monitor for change
// If cache hit rate drops significantly, reconsider placement
```

#### For Block 4 (Fresh Tail) Addition

**Example:** Adding "time until next event" reminder

1. **Query the data:**
```javascript
// In buildSystemPrompt()
const nextEvent = await getNextScheduledEvent(db);
```

2. **Format for display:**
```javascript
const nextEventSection = nextEvent
  ? `NEXT EVENT: "${nextEvent.title}" in ${nextEvent.hoursUntil} hours\n\n`
  : '';
```

3. **Add to Block 4 assembly:**
```javascript
const block4_freshTail = `--- CURRENT STATE ---
${remindersSection}${summarizeReminder}${nextEventSection}${historyTailEntries.length > 0 ? `RECENT HISTORY...` : ''}...`;
```

4. **No caching considerations** - Block 4 is never cached

#### For Action-Based Retrieval

**Example:** Adding "long-form diary entries"

1. **Create database table/function:**
```javascript
// In platforms/cloudflare/src/db/diary.js
export async function getDiaryEntry(db, date) {
  const result = await db.prepare(
    'SELECT * FROM diary WHERE date = ?'
  ).bind(date).first();
  return result;
}
```

2. **Add action to system prompt:**
```javascript
// In getStaticSystemPrompt()
const actions = `
...existing actions...

16. RETRIEVE_DIARY
Retrieve a specific diary entry by date.
{"action": "RETRIEVE_DIARY", "date": "2026-01-12"}
`;
```

3. **Implement action handler:**
```javascript
// In runThinkingCycle() action processing
case 'RETRIEVE_DIARY':
  const entry = await getDiaryEntry(db, action.date);
  await addHistory(db, 'diary_retrieved', `${action.date}`, entry?.content || '(no entry for this date)');
  break;
```

4. **Document in ACTIONS_REFERENCE.md**

### Testing Cache Impact

**Before making changes:**
```bash
# Get baseline cache metrics
npx wrangler d1 execute claude-loop --remote --command="
SELECT
  AVG(cache_read_tokens * 1.0 / input_tokens) as avg_cache_hit_rate,
  AVG(input_tokens) as avg_input_tokens
FROM cycles
WHERE created_at > datetime('now', '-1 day')
"
```

**After deploying changes:**
```bash
# Wait 1 hour for sufficient data
# Re-run query and compare

# Expected changes:
# - Block 2 addition: input_tokens increases, cache_hit_rate unchanged (after first miss)
# - Block 4 addition: input_tokens increases, cache_hit_rate decreases slightly (higher % fresh)
# - New boundary logic: cache_hit_rate may change (monitor over days)
```

**Red flags:**
- Cache hit rate drops > 10% → Reconsider placement or size
- Input tokens increase > 3000 → Consider index-only or action-based approach
- Cache read tokens become erratic → May indicate boundary thrashing

### Size Limits

**D1 database row limit:** ~900KB per row
- Impacts: `history.internal` (images), `state.value` (profile_pic)
- Always compress images before storage

**Anthropic context window:** 200K tokens (Claude Opus/Sonnet 4.5)
- Current usage: ~20-30K tokens (10-15% of limit)
- Headroom: ~170K tokens
- Don't add >10K token sections without strong justification

**Recommended section sizes:**
- Block 2 additions: < 2000 tokens each
- Block 4 additions: < 1000 tokens each (paid every cycle)
- Action-retrieved content: < 5000 tokens (occasional cost)

### Update Documentation

When adding new context sections:

1. **Update this file (CONTEXT_ASSEMBLY.md):**
   - Add to "What Goes In vs Out of Context" table
   - Update "Typical Token Size" in metrics section

2. **Update ACTIONS_REFERENCE.md** (if adding action)

3. **Update DATABASE_SCHEMA.md** (if adding table)

4. **Update CLAUDE.md** (if user-facing feature)

---

## Summary

The 4-block caching architecture achieves **~50% input cost reduction** by:

1. **Block 1 (Static):** System prompt cached 99% of the time
2. **Block 2 (Stable):** Slow-changing memories cached 80%+ of the time
3. **Block 3 (History Prefix):** Stable boundary ensures 95%+ cache hit rate
4. **Block 4 (Fresh Tail):** Never cached - keeps context current

The **stable prefix boundary mechanism** is the key innovation:
- ID-based tracking prevents cache thrashing
- 2x shift rule amortizes cache writes over ~18 cycles
- Images only collected from tail to save tokens

**Key files:**
- `platforms/cloudflare/src/index.js` - buildSystemPrompt() (lines 3456-3872)
- `platforms/cloudflare/src/constants.js` - Cache configuration (lines 67-115)

**Key state values:**
- `history_prefix_boundary_id` - Stable boundary tracker
- `cycle_interval_seconds` - Determines Block 3 caching eligibility
- `summarize_threshold` - Indirectly sets tail size (25% ratio)

**Monitoring:**
- Watch `cycles` table for cache_read_tokens consistency
- Log boundary shifts to verify 2x rule working correctly
- Alert if cache hit rate drops below 60%
