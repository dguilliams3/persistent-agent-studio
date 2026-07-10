# How Clio's Context Window Rolling Works

## The Simple Version

Clio has a **context window** - a limited amount of text that fits in her prompt at any given time. As conversations continue and summaries accumulate, the system must decide **what stays visible** and **what gets archived**.

---

## What's In Clio's Prompt Right Now?

At any given moment, Clio's system prompt contains:

```
┌─────────────────────────────────────────────────────────────┐
│ STATIC SYSTEM PROMPT                                        │
│ (personality, actions, rules - ~3K tokens, rarely changes)  │
├─────────────────────────────────────────────────────────────┤
│ CACHED BLOCK (Summaries)                                    │
│ Older summaries frozen in place. Only changes when you      │
│ manually move the boundary or consolidate.                  │
│ (~14K tokens in your case)                                  │
├─────────────────────────────────────────────────────────────┤
│ DYNAMIC TAIL (Summaries)                                    │
│ Recent summaries. This is what "rolls" when threshold hit.  │
│ (~7.5K tokens, threshold is 8K)                             │
├─────────────────────────────────────────────────────────────┤
│ RAG MEMORIES (if relevant)                                  │
│ Semantically retrieved from archive based on current topic  │
│ (0-5 memories, varies per cycle)                            │
├─────────────────────────────────────────────────────────────┤
│ RECENT HISTORY                                              │
│ Raw conversation entries (last ~50 messages)                │
│ (~8-15K tokens depending on verbosity)                      │
└─────────────────────────────────────────────────────────────┘
```

**Total prompt size:** ~30-40K tokens typically

---

## The Two Zones: Cached Block vs Dynamic Tail

### Cached Block (Frozen)
- **What:** Older summaries you've decided to keep stable
- **Where:** Everything BEFORE the boundary ID
- **Changes when:**
  - You manually drag the boundary in the UI
  - You consolidate summaries
- **Anthropic caching:** These tokens get cached by the API (90% cost reduction on re-read)

### Dynamic Tail (Rolling)
- **What:** Recent summaries that accumulate until threshold
- **Where:** Everything AFTER the boundary ID
- **Changes when:**
  - New summaries are created (auto or manual)
  - "Roll" occurs when token threshold exceeded
- **Anthropic caching:** These tokens are NOT cached (they change too often)

---

## The Boundary: One ID Controls Everything

There's a single value stored in the database: `cacheBoundaryId`

```
Summaries: [#66] [#68] [#144] [#146] [#149] [#156] | [#157] [#158] [#159] [#164]
                      CACHED                       |         TAIL
                                                   ^
                                          cacheBoundaryId = 156
```

- Everything with ID ≤ 156 = Cached Block
- Everything with ID > 156 = Dynamic Tail

**Moving the boundary** = changing this single ID value.

---

## What "Rolling" Means

When the Dynamic Tail exceeds its token threshold (8,000 tokens in your config):

### Before Roll
```
Cached: [#66] [#68] [#144] [#146] [#149] [#156]     = 14,434 tok
Tail:   [#157] [#158] [#159] [#160] [#164]         = 8,200 tok  ← Over threshold!
```

### After Roll
```
Cached: [#66] [#68] [#144] [#146] [#149] [#156] [#157] [#158]  = ~18K tok
Tail:   [#159] [#160] [#164]                                   = ~4K tok
```

The boundary moves forward, "freezing" some tail summaries into the cached block.

**Target after roll:** ~8,000 tokens (configurable)

---

## When Does Caching Actually Help?

### Anthropic Prompt Caching Rules
1. Cache is based on **prefix matching** - tokens must be identical from the start
2. Cache TTL: 5 minutes (free tier) or configurable (paid)
3. Cache ONLY helps when the **beginning of the prompt stays the same**

### What This Means for Clio

```
Cycle 1: [Static Prompt] [Cached Block] [Tail] [History]
                         ^^^^^^^^^^^^^^^
                         This part cached

Cycle 2: [Static Prompt] [Cached Block] [Tail + new summary] [History]
                         ^^^^^^^^^^^^^^^
                         Still cached! (identical prefix)

Cycle 3: [Static Prompt] [Cached Block + rolled summaries] [New Tail] [History]
                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                         CACHE INVALIDATED - prefix changed
```

**Key insight:** Every time the cached block changes, you pay full price for re-caching those tokens.

---

## Rate of Change Under Different Conditions

### Condition 1: Normal Conversation
- **Tail growth:** ~200-500 tokens per summary
- **New summary frequency:** Every 10-50 history entries (depends on auto-summarize threshold)
- **Roll frequency:** When tail hits 8K tokens → roughly every 15-40 summaries
- **Cache invalidation:** Once per roll (every few hours to days of active conversation)

### Condition 2: Heavy Conversation Day
- **Tail growth:** Faster (more entries = more summaries)
- **Roll frequency:** Could happen 2-3 times in a day
- **Cache invalidation:** 2-3 times per day
- **Cost impact:** Each invalidation = re-cache ~15-20K tokens

### Condition 3: Idle/Low Activity
- **Tail growth:** Minimal (THINK/EXIST cycles don't add much)
- **Roll frequency:** Rare (weeks between rolls)
- **Cache hit rate:** Very high (same prefix for many cycles)
- **Cost impact:** Minimal - cache working well

### Condition 4: Manual Consolidation
- **Immediate effect:** Cache invalidation
- **Benefit:** Reduces total tokens in cached block
- **When worth it:** When you have many small summaries that could be one big one

---

## The Config Values Explained

| Setting | Current | What It Does |
|---------|---------|--------------|
| Tail Roll Threshold | 8000 tok | Tail must exceed this to trigger roll |
| Tail Target After Roll | 8000 tok | How small to make tail after roll |
| Cached Window (summaries) | 10 | Display hint (not used in logic) |
| Buffer Window (summaries) | 15 | Display hint (not used in logic) |

**Note:** The "Cached Window" and "Buffer Window" settings are display-only in the UI. The actual boundary is controlled by `cacheBoundaryId`, not summary counts.

---

## Practical Recommendations

### To Maximize Cache Hits (Save Money)
1. Keep the cached block stable - don't move boundary often
2. Consolidate summaries during low-activity periods
3. Set tail threshold high enough that rolls are infrequent

### To Keep Context Relevant
1. Let the tail roll naturally - fresh summaries stay accessible
2. Archive old summaries to RAG when they're no longer directly relevant
3. Use consolidation to compress verbose summaries

### When to Manually Intervene
1. **Consolidate** when you see many small summaries about the same topic
2. **Move boundary** when recent summaries should be frozen (important context)
3. **Archive** when summaries are historical but not needed in every prompt

---

## What the UI Shows

```
┌──────────────────────────────────────────────────────────────┐
│ Memory Summaries  15 active (~21,976 tok) • 129 archived     │
├──────────────────────────────────────────────────────────────┤
│ ❄️ Cached Block (6)  ~14,434 tok                             │
│    [Summaries frozen in prompt - drag to move boundary]      │
├──────────────────────────────────────────────────────────────┤
│ 📜 Dynamic Tail (9)  7,542 / 8,000 tok  "Roll soon"          │
│    [Recent summaries - will roll into cached when threshold] │
├──────────────────────────────────────────────────────────────┤
│ 📚 RAG Archive (129)  ~108,868 tok                           │
│    [Searchable via semantic similarity - not always in prompt]│
└──────────────────────────────────────────────────────────────┘
```

- **"Roll soon"** = Tail is near threshold, next summary might trigger roll
- **Drag summaries** = Move boundary between cached and tail
- **Select + Consolidate** = Merge multiple summaries into one

---

## Summary

1. **Cached Block** = Frozen summaries at the start of context (API-cached, cheap to re-read)
2. **Dynamic Tail** = Recent summaries that accumulate and eventually roll
3. **Boundary** = Single ID that divides cached from tail
4. **Rolling** = Moving boundary forward when tail gets too big
5. **Cache invalidation** = Happens whenever cached block changes (costs money)
6. **Your control** = Move boundary manually, consolidate summaries, set thresholds
