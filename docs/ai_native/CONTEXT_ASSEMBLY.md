# Context Window Assembly & 4-Block Caching

**Last Updated:** 2026-07-31 (reconciled against the extracted packages)

> **Provenance (2026-07-31):** this doc was originally written (2026-01) against the
> pre-extraction Cloudflare monolith (`platforms/cloudflare/src/index.js`), which no longer
> exists. It has been reconciled against the shipped code. The authoritative sources are:
> `packages/memory/src/context/` (block builders, boundary math, formatters),
> `packages/runtime/src/context/` (cache TTL policy, API block assembly), and
> `platforms/cloudflare/src/prompts/build-system-prompt.ts` (data loading + Block 1 +
> boundary persistence). Where this doc and the code disagree, the code wins. The cost
> story is told in **ratios, not prices** (prices rot; ratios hold) — the interactive
> version, with values imported from or test-pinned to the shipped code, is the web app's
> **Efficiencies** page.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [4-Block Caching Architecture](#4-block-caching-architecture)
3. [Cache TTL Policy](#cache-ttl-policy)
4. [Stable Prefix Boundary Mechanism](#stable-prefix-boundary-mechanism)
5. [Image Handling](#image-handling)
6. [What Goes In vs Out of Context](#what-goes-in-vs-out-of-context)
7. [Cache Efficiency Metrics](#cache-efficiency-metrics)
8. [Adding New Context Sections](#adding-new-context-sections)

---

## System Overview

### What the persona sees each cycle

Every time the thinking cycle runs, the system assembles a context window that includes:

- **Static constitution** — system prompt, action/tool definitions, MY_CONTEXT, cold
  storage, MY SPACE, profile picture (rarely changes)
- **Promoted summaries** — pinned summaries that bypass normal rotation (changes rarely)
- **Stable context** — observations plus the older-summaries prefix (changes on
  OBSERVATION actions and boundary rolls)
- **Fresh tail** — learned/questions/notebook, RAG results, the summary tail, FULL
  conversation history, reminders, status, meters (changes every cycle)

A mature persona's assembled context runs to tens of thousands of input tokens (~50K is a
realistic anchor — see the README's cost section), which would be expensive to send fresh
every cycle.

### Why caching matters

Anthropic's prompt caching lets us mark sections of the prompt as cacheable:

1. **First call**: a cache write occurs, at a premium over the normal input rate
   (~1.25x for 5-minute-TTL entries, ~2x for 1-hour-TTL entries)
2. **Subsequent calls**: cache reads cost roughly **0.1x** the normal input rate
3. **Off-hours batch processing** runs at roughly **0.5x** on top of that

So if ~90% of a cycle's input tokens come from cache reads, the cycle's input bill is
roughly **a fifth** of the uncached equivalent (0.9 × 0.1 + 0.1 × 1.0 ≈ 0.19). The exact
ratios live in `CACHE_PRICING` (`packages/core/src/constants.ts`) and are exercised
interactively on the Efficiencies page.

### 4-Block Architecture Overview (as built)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        THE CONTEXT WINDOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ BLOCK 1: CONSTITUTION (+ extensions + profile pic)            │  │
│  │ [cache_control: ephemeral — ALWAYS cached]                    │  │
│  │                                                               │  │
│  │ • System prompt template (identity, existence)                │  │
│  │ • Action/tool definitions (THINK, MESSAGE_*, LEARNED, ...)    │  │
│  │ • MY_CONTEXT static text about the human                      │  │
│  │ • Cold storage (permanent memories)                           │  │
│  │ • MY SPACE (pinned images, gallery summary)                   │  │
│  │ • Profile picture reference (if set)                          │  │
│  │                                                               │  │
│  │ Change frequency: rarely (deploys, cold storage, pins)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ BLOCK 2: PROMOTED SUMMARIES                                   │  │
│  │ [cache_control: ephemeral — conditionally cached]             │  │
│  │                                                               │  │
│  │ • Pinned/promoted summaries that bypass normal rotation       │  │
│  │ • Typically 0-3 summaries; small block                        │  │
│  │                                                               │  │
│  │ Change frequency: rarely (manual promote/demote)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ BLOCK 3: STABLE CONTEXT + SUMMARIES PREFIX                    │  │
│  │ [cache_control: ephemeral — cached per TTL policy]            │  │
│  │                                                               │  │
│  │ • Observations about the human                                │  │
│  │ • Older compressed history summaries (the prefix)             │  │
│  │                                                               │  │
│  │ Change frequency: OBSERVATION actions; summary boundary rolls │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ BLOCK 4: FRESH TAIL (never cached)                            │  │
│  │                                                               │  │
│  │ ORDER (distant → recent → action):                            │  │
│  │ 1. Learned entries, questions, notebook index                 │  │
│  │ 2. RAG-retrieved memories (semantic recall, if enabled)       │  │
│  │ 3. Summary tail (recent summaries not yet in the prefix)      │  │
│  │ 4. FULL HISTORY (all entries, oldest to newest)               │  │
│  │ 5. Tool feedback from last cycle                              │  │
│  │ 6. Active reminders (with due status)                         │  │
│  │ 7. Human's current status                                     │  │
│  │ 8. Current time, loop count, wake-density line                │  │
│  │ 9. Meters section (internal state)                            │  │
│  │                                                               │  │
│  │ Change frequency: every cycle                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Why learned/questions/notebook live in Block 4, not Block 2:** they are
action-modifiable (a single LEARNED action would invalidate any cache block holding
them), and they read best close to history and the action instructions. Moving them to
the uncached tail keeps Blocks 2 and 3 cache-stable and keeps the freshest
self-knowledge adjacent to the decision point. (`packages/memory/src/context/blocks/block3.ts`
records the move in its header.)

---

## 4-Block Caching Architecture

The split of responsibilities after the runtime extraction:

| Layer | Module | Role |
|---|---|---|
| Data loading + Block 1 | `platforms/cloudflare/src/prompts/build-system-prompt.ts` | Fetches memory tables from D1, applies branch overrides, runs RAG, builds Block 1, persists boundary updates |
| Static prompt | `platforms/cloudflare/src/prompts/system.ts` (`getStaticSystemPrompt()`) | Identity/constitution template |
| Blocks 2-4 (pure) | `packages/memory/src/context/builder/build-context.ts` (`buildContext()`) | Pure orchestrator: boundaries → split → `buildBlock2/3/4` |
| Block builders | `packages/memory/src/context/blocks/{block2,block3,block4}.ts` | Format each block from typed inputs |
| Boundary math | `packages/memory/src/context/cache/boundary.ts` | Pure stable-boundary calculation (see below) |
| API assembly | `packages/runtime/src/context/systemBlocks.ts` (`buildSystemBlocks()`) | Wraps block text in Anthropic `cache_control` wire format |
| TTL policy | `packages/runtime/src/context/cacheTtl.ts` (`selectCacheTtl()`) | Picks 5m / 1h / no-cache per block per cycle interval |

### Block 1: Constitution (always cached)

**Built by:** `getStaticSystemPrompt()` + tool prompt rendering + cold storage / MY SPACE
extensions, assembled in `build-system-prompt.ts`; profile picture reference appended in
`buildSystemBlocks()`.

**Contents:** system prompt template, action/tool definitions, MY_CONTEXT, cold storage,
MY SPACE (pinned images + gallery summary), profile picture.

**Change frequency:** rarely — deploys, cold-storage writes, pin changes.

**Why it's cached:** the content is nearly static across cycles. It always gets a cache
marker; only the TTL bends with cadence (`selectCacheTtl(interval, /* stable */ true)`).

### Block 2: Promoted Summaries

**Built by:** `packages/memory/src/context/blocks/block2.ts` (`buildBlock2()`).

**Contents:** summaries explicitly promoted out of the normal rotation
(`tier = BLOCK.PROMOTED`). Promote/demote via the worker routes
`/summaries/:id/promote` and `/summaries/:id/demote`.

**Why a separate block:** promoted summaries change on a *manual* schedule — pinning one
should not invalidate the observations/summaries-prefix cache, and vice versa.

### Block 3: Stable Context + Summaries Prefix

**Built by:** `packages/memory/src/context/blocks/block3.ts` (`buildBlock3()`).

**Contents:** observations about the human, then the *prefix* of older summaries (the
recent summary *tail* stays in Block 4, uncached, so a new summary doesn't invalidate
this block).

**Change frequency:** OBSERVATION actions; summary-boundary rolls (token-threshold
based — see the boundary mechanism below).

### Block 4: Fresh Tail (never cached)

**Built by:** `packages/memory/src/context/blocks/block4.ts` (`buildBlock4()`).

**Contents (in order):** learned entries → questions → notebook index → RAG-retrieved
memories → summary tail → FULL history (oldest to newest) → tool feedback → reminders →
human's status → loop count / current time / wake-density line → meters.

**Ordering rationale:** distant context first, most recent content closest to the action
instructions, where it carries the most weight.

**Why FULL history is uncached here:** the *prefix/tail* split that decides what is
"cached history" is applied upstream by the boundary mechanism; what lands in Block 4 is
the live tail the persona must always see fresh.

---

## Cache TTL Policy

The old design gated caching on a hand-derived "54-minute" rule. The shipped policy is a
pure function, `selectCacheTtl()` (`packages/runtime/src/context/cacheTtl.ts`):

| Cycle interval | Stable blocks (1, 2) | Volatile blocks (3) | Block 4 |
|---|---|---|---|
| < 270s (`SHORT_TTL_THRESHOLD`) | 5m TTL | 5m TTL | never cached |
| < 1,440s (`LONG_TTL_THRESHOLD`) | 1h TTL | 1h TTL | never cached |
| ≥ 1,440s | 1h TTL | **not cached** | never cached |

The reasoning: a 5-minute cache entry self-refreshes on every read, so fast cadences use
the cheapest write premium (~1.25x); slower cadences need 1-hour entries (~2x write
premium) to survive between wakes; and past the long threshold, a volatile-block write
would expire before the next read — pure premium, no payoff — so volatile blocks skip
caching entirely. Stable blocks are always cached.

---

## Stable Prefix Boundary Mechanism

### The problem

**Naive approach:** split history dynamically each cycle ("last 25% is the tail"). Every
new entry then changes the prefix content → the cache invalidates **every cycle** → zero
cache hits.

### The solution: ID-based boundary, token-based shifting

**Module:** `packages/memory/src/context/cache/boundary.ts` — pure functions
(`calculateHistoryBoundary()`, `calculateSummaryBoundary()`), no I/O. The platform loads
and persists the boundary IDs in D1 state (`history_prefix_boundary_id`,
`summary_prefix_boundary_id` — `build-system-prompt.ts`).

**Key idea:** track the boundary by **entry ID** (not index), and shift it only when the
tail grows past a **token threshold**:

1. Load the stored boundary ID and find it in the current history.
2. If no boundary exists (first run, or the boundary entry was deleted), initialize by
   walking backwards from the end until the tail holds ~`target` tokens.
3. Each cycle, estimate the tail's token count. While the tail is under the `threshold`,
   **keep the boundary where it is** — the prefix is byte-identical, cache hits.
4. When the tail exceeds the `threshold` (and has more than the minimum entry count),
   shift the boundary forward until the tail is back near `target`. One cache miss, then
   hits again.

**Shipped parameters** (`HISTORY_TOKEN_CONFIG`, `platforms/cloudflare/src/config/index.ts`):
history tail shifts at **12,000** tokens, back to a **6,000**-token target, keeping at
least 3 tail entries. The summaries prefix/tail uses the same mechanism at **8,000 /
4,000** with at least 1 live tail summary (`SUMMARY_BUFFER_CONFIG`,
`platforms/cloudflare/src/constants.ts`).

**Amortization:** with threshold = 2 × target, one boundary shift (one cache miss) buys
on the order of ten cycles of cache hits — the boundary module's own worked example in
its header. Token-based thresholds (rather than the old entry-count "2x rule") keep the
mechanism honest when entries vary wildly in size.

### Boundary deletion handling

If the boundary entry is deleted (e.g., summarization removed old entries),
`findIndex` misses, and the calculation re-initializes the boundary — one unavoidable
cache invalidation, no crash.

---

## Image Handling

### Tail-only collection strategy

Images cost real tokens (base64). The system therefore only *collects image data* from
recent history — prefix entries render as text placeholders (`[sent an image]`), because
the persona already saw those images in the cycles when they were new.

**Where it lives now:**

- The history formatter accepts a collect-images flag and an image budget
  (`packages/memory/src/context/formatters/history.ts`; default: the last 10 entries
  carry actual image data).
- The cycle's image assembly is `platforms/cloudflare/src/services/cycle-images.ts`:
  the human's recent images are capped at the **last 3**; the persona's own art is
  subject to a visibility-decay policy (`packages/runtime/src/art-decay.ts`) rather than
  a flat "last 2".
- Pinned images and the gallery summary ride in Block 1 (MY SPACE) via
  `getPinnedImagesForContext()` / `getGallerySummary()`.

### Image attribution

Two source types, presented in separate sections: the human's images (`user_message`
attachments, `user_art`) and the persona's generated art (`art_result`).

---

## What Goes In vs Out of Context

### IN context (every cycle)

| Component | Block | Change frequency |
|-----------|-------|------------------|
| System prompt template + action definitions | 1 | rare (deploys) |
| MY_CONTEXT | 1 | rare |
| Cold storage | 1 | infrequent (hours/days) |
| MY SPACE (pins + gallery summary) | 1 | infrequent |
| Profile picture | 1 | rare (manual) |
| Promoted summaries | 2 | rare (manual promote/demote) |
| Observations index | 3 | on OBSERVATION actions |
| Summaries prefix (older) | 3 | boundary rolls |
| Learned entries | 4 | on LEARNED actions |
| Questions | 4 | on QUESTION actions |
| Notebook index | 4 | on NOTE actions |
| RAG-retrieved memories | 4 | every cycle (if enabled) |
| Summary tail (recent) | 4 | when new summaries land |
| FULL history | 4 | every cycle |
| Tool feedback | 4 | when errors occur |
| Active reminders | 4 | occasional |
| Human's status | 4 | variable |
| Time, loop count, wake density | 4 | every cycle |
| Meters | 4 | every cycle |
| Recent images | (user content) | activity-dependent |

### OUT of context (not in the direct prompt)

| Component | Reason | Access method |
|-----------|--------|---------------|
| Archived summaries | consolidated away | RAG semantic retrieval |
| Notebook full content | size | `GET_NOTE` action |
| Observation details | size | `GET_OBSERVATION` action |
| Old images (prefix) | already seen | gallery (frontend UI) |
| Triggered reminders | history log | visible in history |
| Cost/cycle data | analytics | `/cycles` API endpoint |
| Memory branches / overrides / synthetic memories | editor features | applied inside `buildSystemPrompt()` when a branch is active |

### Access patterns

- **Direct prompt** — always available, zero latency, token cost every cycle (unless
  cached). Best for frequently needed, small-to-medium content.
- **Action-based retrieval** — the persona requests via an action; one cycle of delay;
  cost only when retrieved. Best for large, infrequently needed content.
- **RAG semantic retrieval** — automatic, based on recent-history embedding; cost only
  for the few results returned. Best for the distant past.
- **Frontend UI only** — zero persona visibility, zero token cost. Best for audit trails
  and human exploration.

---

## Cache Efficiency Metrics

### The ratio arithmetic

Per Anthropic's pricing model (ratios relative to the uncached input rate = 1.0; shipped
in `CACHE_PRICING`, `packages/core/src/constants.ts`):

- cache read ≈ **0.1x**
- cache write premium: **1.25x** (5m TTL) / **2x** (1h TTL)
- batch processing ≈ **0.5x**

A cycle whose prompt is fraction *c* cache-read and (1 − *c*) fresh costs roughly
`c × 0.1 + (1 − c) × 1.0` of the uncached equivalent — at c = 0.9, about **0.19x**. A
cache write cycle costs *more* than an uncached one for the written span, which is why
the boundary mechanism works to make writes rare and reads long-lived. The Efficiencies
page in the web app lets you move these sliders against the real shipped functions.

### The per-cycle ledger

Every cycle writes its own receipt — model, input/output tokens, cache reads vs writes,
estimated cost, actions taken — into the `cycles` table
(`packages/db/src/cycles.ts`, `updateCycleMetrics()` / `calculateCostCents()`).

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

**Healthy:** `cache_hit_rate_pct` consistently high (roughly 70-85% for a persona on a
cacheable cadence); `cache_read_tokens` stable with occasional drops to 0 (a boundary
shift or deploy). **Unhealthy:** hit rate persistently low, or erratic cache-read values
(boundary thrashing — check the tail token threshold against actual entry sizes).

**Log lines to look for** (`npx wrangler tail`):

```
[Cache] Initialized history boundary at entry ID 245 (index 51, tail ~5800 tokens, target: 6000)
[Cache] Shifted history boundary ...
```

---

## Adding New Context Sections

### Decision checklist

Before adding new content to the persona's context:

1. **Is it needed every cycle?** No → action-based retrieval. Yes → continue.
2. **Does it change every cycle?** Yes → Block 4. No → continue.
3. **Does it change multiple times per hour?** Yes → Block 4 (caching would hurt).
4. **Does it change rarely (hours/days)?** Yes → Block 3 (or Block 1 if effectively
   static and identity-level).
5. **Is it large (>2,000 tokens)?** Reconsider: index + action-based retrieval.
6. **Does it depend on history content?** Yes → Block 4.

### Implementation steps (as built)

1. **Add the data to the block's input type** — `Block3Data` / `Block4Data` in
   `packages/memory/src/context/blocks/types.ts`.
2. **Format it in the block builder** — `block3.ts` / `block4.ts` (add a formatter in
   `packages/memory/src/context/formatters/` if the section needs one).
3. **Load the data in the platform layer** — `build-system-prompt.ts` fetches from D1
   and fills the block data objects that `buildContext()` consumes.
4. **Watch the cache impact** — compare `cache_read_tokens` / hit rate in the `cycles`
   table before and after; a Block 3 addition that changes often will show up as a
   falling hit rate.
5. **Document it** — this file's tables, plus `ACTIONS_REFERENCE.md` if you added an
   action and `DATABASE_SCHEMA.md` if you added a table.

### Size guidance

- Anthropic context window: 200K tokens; a mature persona's cycle uses a modest fraction
  of it. Don't add >10K-token sections without strong justification.
- Block 3 additions: < 2,000 tokens each. Block 4 additions: < 1,000 tokens each (paid
  fresh every cycle). Action-retrieved content: < 5,000 tokens (occasional cost).

---

## Summary

The 4-block architecture keeps most of a large prompt behind cache markers:

1. **Block 1 (Constitution):** static identity — always cached
2. **Block 2 (Promoted):** pinned summaries — cached, invalidated only by manual moves
3. **Block 3 (Stable + prefix):** observations + older summaries — cached per TTL policy
4. **Block 4 (Fresh tail):** everything the persona must see fresh — never cached

The **stable prefix boundary mechanism** is the key trick: ID-based tracking with
token-threshold shifting means one cache invalidation buys many cycles of cache hits.

**Key files:**
- `packages/memory/src/context/builder/build-context.ts` — pure block orchestrator
- `packages/memory/src/context/blocks/` — block builders + types
- `packages/memory/src/context/cache/boundary.ts` — boundary math
- `packages/runtime/src/context/cacheTtl.ts` — TTL policy
- `packages/runtime/src/context/systemBlocks.ts` — Anthropic wire format
- `platforms/cloudflare/src/prompts/build-system-prompt.ts` — data loading, Block 1,
  boundary persistence
- `platforms/cloudflare/src/config/index.ts` + `constants.ts` — token thresholds

**Key state values:**
- `history_prefix_boundary_id` / `summary_prefix_boundary_id` — stable boundary trackers
- `cycle_interval_seconds` — drives the TTL policy
