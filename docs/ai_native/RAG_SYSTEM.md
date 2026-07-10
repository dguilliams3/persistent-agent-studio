# RAG System - Retrieval-Augmented Generation

**Last Updated:** 2026-01-12 10:36 EST
**Status:** Production (deployed 2026-01-11)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Embedding Generation](#embedding-generation)
3. [Scoring Formula](#scoring-formula)
4. [MMR (Maximal Marginal Relevance)](#mmr-maximal-marginal-relevance)
5. [Configuration](#configuration)
6. [Integration in Context Building](#integration-in-context-building)
7. [Performance](#performance)
8. [Key Functions Reference](#key-functions-reference)

---

## System Overview

### What RAG Does

RAG (Retrieval-Augmented Generation) semantically retrieves relevant past summaries based on current conversation context. Instead of relying solely on chronological history, Claude can recall compressed historical context that may not appear in recent entries but is semantically relevant to the current discussion.

**Key Benefits:**
- Access to archived summaries (the ONLY way to retrieve bulk-archived content)
- Semantic relevance over chronological ordering
- Controlled context bloat (only top-K most relevant summaries)
- Diversity via MMR (prevents redundant similar results)

### When RAG Activates

RAG runs during every thinking cycle when ALL conditions are met:

1. `ragConfig.enabled === true` (configurable via state or Telegram)
2. `env` parameter passed to `buildSystemPrompt()` (provides AI binding)
3. History tail exists (at least some recent conversation to generate query)

### When RAG Skips

RAG gracefully skips and logs when:

- RAG disabled in config (`rag_enabled = false` in state)
- No `env` parameter (some endpoints like UI don't pass it)
- No history entries available
- Embedding generation fails (logged but doesn't block cycle)

### High-Level Flow

```
Thinking Cycle Triggered
       â”‚
       â–¼
buildSystemPrompt(db, env)
       â”‚
       â”œâ”€â–º Load history (split into prefix/tail)
       â”‚
       â”œâ”€â–º Check RAG config
       â”‚   - Enabled?
       â”‚   - Has env.AI?
       â”‚   - Has history tail?
       â”‚
       â””â”€â–º RAG Retrieval Pipeline
           â”‚
           â”œâ”€â–º 1. Generate query embedding from tail text
           â”‚      (BGE-base-en-v1.5, 768 dimensions)
           â”‚
           â”œâ”€â–º 2. Fetch ALL summaries with embeddings
           â”‚      (including archived summaries)
           â”‚
           â”œâ”€â–º 3. Score each summary
           â”‚      - Similarity (cosine, 50% weight)
           â”‚      - Recency (exp decay, 30% weight)
           â”‚      - Importance (log scale, 20% weight)
           â”‚
           â”œâ”€â–º 4. Filter by minSimilarity threshold (default 0.3)
           â”‚
           â”œâ”€â–º 5. Apply MMR for diversity
           â”‚      Î» * relevance - (1-Î») * max_sim_to_selected
           â”‚
           â”œâ”€â–º 6. Select top-K summaries (default 3)
           â”‚
           â””â”€â–º 7. Format as "Relevant Past Context" section
               Insert into Block 4 (uncached, before fresh tail)
```

---

## Embedding Generation

### Model Specification

| Property | Value |
|----------|-------|
| **Provider** | Cloudflare Workers AI |
| **Model** | `@cf/baai/bge-base-en-v1.5` |
| **Dimensions** | 768 |
| **Max Input** | 8000 characters (truncated if longer) |
| **Output Format** | Float32Array (768 floats) |

**BGE (BAAI General Embedding)** is optimized for retrieval and semantic similarity tasks. The base variant balances performance and speed.

### When Embeddings Are Created

Embeddings are generated automatically during three operations:

1. **Regular Summarization** (`summarizeHistory`)
   - Triggered when history count exceeds threshold (default 70)
   - Uses Opus model to compress history
   - Embedding generated from summary text

2. **Meta-Summarization** (`metaSummarize`)
   - Triggered when active summaries exceed context+buffer (default 10)
   - Uses Sonnet to intelligently group related summaries
   - Embedding generated for consolidated summary

3. **Bulk Archive** (`/bulkarchive`)
   - User-initiated via Telegram command
   - Archives old summaries with embeddings
   - Creates "born archived" summaries (never in chronological context)

### Storage Format

Embeddings are stored in the `summaries` table:

| Column | Type | Description |
|--------|------|-------------|
| `embedding` | BLOB | Serialized Float32Array |
| `embedding_model` | TEXT | Model identifier (e.g., "bge-base-en-v1.5") |

**Serialization:**
```javascript
// Store: Float32Array â†’ ArrayBuffer â†’ BLOB
const buffer = embedding.buffer; // ArrayBuffer
await db.prepare('UPDATE summaries SET embedding = ? WHERE id = ?')
  .bind(buffer, summaryId).run();

// Retrieve: BLOB â†’ ArrayBuffer â†’ Float32Array
const row = await db.prepare('SELECT embedding FROM summaries WHERE id = ?')
  .bind(summaryId).first();
const embedding = new Float32Array(row.embedding);
```

**Storage Size:** 768 floats Ã— 4 bytes = 3,072 bytes per embedding (~3KB)

---

## Scoring Formula

RAG uses a weighted scoring formula combining three components:

### Combined Score Formula

```
final_score = (Î± * similarity) + (Î² * recency) + (Î³ * importance)

Default weights:
Î± (similarity)  = 0.5 (50%)
Î² (recency)     = 0.3 (30%)
Î³ (importance)  = 0.2 (20%)
```

### Component 1: Similarity Score (50% weight)

**Purpose:** Semantic relevance to current conversation

**Method:** Cosine similarity between query embedding and summary embedding

**Range:** -1 to 1 (typically 0.3 to 1.0 for text)

**Formula:**
```
similarity = (a Â· b) / (||a|| Ã— ||b||)

Where:
a Â· b = dot product (sum of element-wise multiplication)
||a|| = magnitude of vector a (sqrt of sum of squares)
||b|| = magnitude of vector b
```

**Example Calculation:**
```javascript
// Query: "career planning discussion"
// Summary: "The user and I discussed career goals and physics background"

const queryEmb = [0.23, -0.45, 0.67, ...]; // 768 dims
const summaryEmb = [0.25, -0.43, 0.69, ...]; // 768 dims

// Dot product
let dotProduct = 0;
for (let i = 0; i < 768; i++) {
  dotProduct += queryEmb[i] * summaryEmb[i];
}
// dotProduct = 152.4

// Magnitudes
let normA = Math.sqrt(queryEmb.reduce((sum, v) => sum + v*v, 0));
// normA = 18.7
let normB = Math.sqrt(summaryEmb.reduce((sum, v) => sum + v*v, 0));
// normB = 19.1

// Cosine similarity
const similarity = dotProduct / (normA * normB);
// similarity = 152.4 / (18.7 * 19.1) = 0.82
```

**Interpretation:**
| Range | Meaning |
|-------|---------|
| 0.9 - 1.0 | Nearly identical semantically |
| 0.7 - 0.9 | Highly relevant |
| 0.5 - 0.7 | Moderately relevant |
| 0.3 - 0.5 | Weakly relevant |
| < 0.3 | Not relevant (filtered out by minSimilarity) |

### Component 2: Recency Score (30% weight)

**Purpose:** Favor recent summaries over ancient ones

**Method:** Exponential decay with configurable halflife

**Range:** 0 to 1 (1 = today, 0.5 = one halflife ago, approaches 0 for old)

**Formula:**
```
recency = e^(-ln(2) * daysSince / halflifeDays)

Default halflife: 14 days
```

**Example Calculation:**
```javascript
// Summary created: 2026-01-01
// Today: 2026-01-12
// Halflife: 14 days

const daysSince = 11; // days between dates

const recency = Math.exp(-Math.LN2 * daysSince / 14);
// recency = e^(-0.693 * 11 / 14)
// recency = e^(-0.544)
// recency = 0.58
```

**Decay Table (14-day halflife):**
| Days Ago | Recency Score |
|----------|---------------|
| 0 (today) | 1.00 |
| 7 days | 0.71 |
| 14 days | 0.50 |
| 21 days | 0.35 |
| 28 days | 0.25 |
| 42 days | 0.125 |
| 56 days | 0.063 |

### Component 3: Importance Score (20% weight)

**Purpose:** Prioritize summaries covering more conversation

**Method:** Logarithmic scaling by message count

**Range:** 0 to 1+ (can exceed 1 for very large summaries)

**Formula:**
```
importance = log(1 + messageCount) / log(1 + maxExpected)

Default maxExpected: 100 messages
```

**Example Calculation:**
```javascript
// Summary covers 50 messages
// maxExpected = 100

const importance = Math.log(1 + 50) / Math.log(1 + 100);
// importance = log(51) / log(101)
// importance = 3.93 / 4.62
// importance = 0.85
```

**Importance Table (maxExpected=100):**
| Messages | Importance Score |
|----------|------------------|
| 1 | 0.15 |
| 5 | 0.39 |
| 10 | 0.52 |
| 20 | 0.66 |
| 50 | 0.85 |
| 100 | 1.00 |
| 200 | 1.09 |

**Why logarithmic?** Prevents huge summaries from dominating. A 200-message summary is only 9% more important than a 100-message summary, not 2x.

### Combined Score Example

```javascript
// Summary: "Career planning discussion" (created 11 days ago, 50 messages)

const similarity = 0.82;  // High semantic match
const recency = 0.58;     // 11 days old
const importance = 0.85;  // 50 messages

const combined = (0.5 * 0.82) + (0.3 * 0.58) + (0.2 * 0.85);
// combined = 0.41 + 0.174 + 0.17
// combined = 0.754

// This summary would rank highly!
```

---

## MMR (Maximal Marginal Relevance)

### Purpose

MMR prevents redundant similar summaries from dominating results. Without MMR, the top-3 results might all be about the same topic (e.g., three career planning summaries). MMR ensures diversity by penalizing candidates similar to already-selected results.

### The Problem Without MMR

```
Query: "career planning"

Top 5 by combined score (without MMR):
1. "Career goals and physics background" (0.82)
2. "Career trajectory discussion" (0.80)
3. "Career planning next steps" (0.78)
4. "Family dynamics and relationships" (0.65)
5. "Project ideas and creativity" (0.62)

Problem: Results 1-3 are all redundant!
```

### MMR Algorithm

```
Selected = []
Remaining = [all candidates sorted by combined score]

while len(Selected) < topK and len(Remaining) > 0:
    best_mmr_score = -âˆž
    best_candidate = None

    for each candidate in Remaining:
        if Selected is empty:
            mmr_score = candidate.combined_score
        else:
            # Find max similarity to any already-selected summary
            max_sim = max(cosine(candidate, s) for s in Selected)

            # MMR formula: balance relevance vs diversity
            mmr_score = Î» * candidate.combined_score - (1-Î») * max_sim

        if mmr_score > best_mmr_score:
            best_mmr_score = mmr_score
            best_candidate = candidate

    Selected.append(best_candidate)
    Remaining.remove(best_candidate)

return Selected
```

### Lambda Parameter

```
mmr_score = Î» * relevance - (1-Î») * similarity_to_selected

Î» = 1.0: Pure relevance (MMR disabled, just use combined score)
Î» = 0.7: Balanced (70% relevance, 30% diversity penalty) [DEFAULT]
Î» = 0.5: Equal weight to relevance and diversity
Î» = 0.0: Maximum diversity (ignores relevance entirely)
```

**Default:** `Î» = 0.7` provides good balance between relevant and diverse results.

### MMR Example

```javascript
Query: "career planning"
Candidates (sorted by combined score):

1. Career goals (combined=0.82)
2. Career trajectory (combined=0.80, sim_to_1=0.95)
3. Career next steps (combined=0.78, sim_to_1=0.92, sim_to_2=0.88)
4. Family dynamics (combined=0.65, sim_to_1=0.20, sim_to_2=0.18)
5. Project ideas (combined=0.62, sim_to_1=0.15, sim_to_2=0.12)

MMR Selection (Î»=0.7, topK=3):

Round 1:
- Candidate 1: mmr = 0.82 (no penalty, first selection)
- Selected: [1]

Round 2:
- Candidate 2: mmr = 0.7*0.80 - 0.3*0.95 = 0.56 - 0.285 = 0.275
- Candidate 3: mmr = 0.7*0.78 - 0.3*0.92 = 0.546 - 0.276 = 0.270
- Candidate 4: mmr = 0.7*0.65 - 0.3*0.20 = 0.455 - 0.060 = 0.395 â­ BEST
- Candidate 5: mmr = 0.7*0.62 - 0.3*0.15 = 0.434 - 0.045 = 0.389
- Selected: [1, 4]

Round 3:
- Candidate 2: mmr = 0.7*0.80 - 0.3*max(0.95, 0.18) = 0.56 - 0.285 = 0.275
- Candidate 3: mmr = 0.7*0.78 - 0.3*max(0.92, 0.15) = 0.546 - 0.276 = 0.270
- Candidate 5: mmr = 0.7*0.62 - 0.3*max(0.15, 0.12) = 0.434 - 0.045 = 0.389 â­ BEST
- Selected: [1, 4, 5]

Final Results:
1. Career goals (0.82 combined, 0.820 mmr)
2. Family dynamics (0.65 combined, 0.395 mmr)
3. Project ideas (0.62 combined, 0.389 mmr)

Much more diverse than [Career goals, Career trajectory, Career next steps]!
```

---

## Configuration

### Default RAG_CONFIG

Defined in `platforms/cloudflare/src/constants.js`:

```javascript
export const RAG_CONFIG = {
  enabled: true,
  topK: 3,
  queryHistoryCount: 20,
  recencyHalflifeDays: 14,
  minSimilarity: 0.3,
  weights: {
    similarity: 0.5,
    recency: 0.3,
    importance: 0.2
  },
  mmrLambda: 0.7
};
```

### Configuration Parameters

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `enabled` | boolean | true/false | `true` | Master toggle for RAG retrieval |
| `topK` | integer | 1-10 | `3` | Number of summaries to retrieve |
| `queryHistoryCount` | integer | 1-100 | `20` | Recent history entries for query generation |
| `recencyHalflifeDays` | integer | 1-365 | `14` | Days for recency score to decay by 50% |
| `minSimilarity` | float | 0.0-1.0 | `0.3` | Minimum cosine similarity threshold |
| `weights.similarity` | float | 0.0-1.0 | `0.5` | Weight for semantic similarity |
| `weights.recency` | float | 0.0-1.0 | `0.3` | Weight for temporal recency |
| `weights.importance` | float | 0.0-1.0 | `0.2` | Weight for message count |
| `mmrLambda` | float | 0.0-1.0 | `0.7` | MMR diversity parameter (1=pure relevance) |

**Note:** Weights do NOT need to sum to 1.0 (auto-normalized internally), but it's recommended for clarity.

### Telegram Commands

RAG configuration is fully controllable via Telegram:

```bash
/rag                        # Show current settings
/rag on                     # Enable RAG
/rag off                    # Disable RAG
/rag topk 5                 # Set top-K results (1-10)
/rag halflife 30            # Set recency halflife (1-365 days)
/rag minsim 0.5             # Set min similarity threshold (0.0-1.0)
/rag weights 0.6 0.2 0.2    # Set weights (similarity recency importance)
/rag mmr 0.8                # Set MMR lambda (0.0-1.0)
/rag reset                  # Reset all to defaults
```

**Examples:**

```bash
# Disable RAG entirely
/rag off

# High precision mode (fewer, more relevant results)
/rag topk 2
/rag minsim 0.5
/rag weights 0.7 0.2 0.1
/rag mmr 0.8

# Deep historical recall mode
/rag topk 5
/rag halflife 30
/rag minsim 0.2
/rag weights 0.6 0.2 0.2
/rag mmr 0.6

# Recent context focus mode
/rag halflife 7
/rag weights 0.4 0.5 0.1
```

### API Endpoints

**GET /rag** - Retrieve current configuration with source tracking

```bash
curl https://your-worker.workers.dev/rag

Response:
{
  "enabled": true,
  "topK": 3,
  "recencyHalflifeDays": 14,
  "minSimilarity": 0.3,
  "weights": {
    "similarity": 0.5,
    "recency": 0.3,
    "importance": 0.2
  },
  "mmrLambda": 0.7,
  "source": {
    "enabled": "defaults",
    "topK": "state",
    "recencyHalflifeDays": "defaults",
    ...
  }
}
```

**POST /rag** - Update configuration (partial updates supported)

```bash
# Enable RAG
curl -X POST https://your-worker.workers.dev/rag \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Update weights
curl -X POST https://your-worker.workers.dev/rag \
  -H "Content-Type: application/json" \
  -d '{"weights": {"similarity": 0.6, "recency": 0.2, "importance": 0.2}}'

# Reset to defaults
curl -X POST https://your-worker.workers.dev/rag \
  -H "Content-Type: application/json" \
  -d '{"reset": true}'
```

### State Storage

RAG config is persisted in the `state` table with individual keys:

| State Key | Type | Example Value |
|-----------|------|---------------|
| `rag_enabled` | boolean | `1` (true) |
| `rag_top_k` | integer | `3` |
| `rag_recency_halflife` | integer | `14` |
| `rag_min_similarity` | float | `0.3` |
| `rag_similarity_weight` | float | `0.5` |
| `rag_recency_weight` | float | `0.3` |
| `rag_importance_weight` | float | `0.2` |
| `rag_mmr_lambda` | float | `0.7` |

**Retrieval precedence:** State value â†’ Default from `RAG_CONFIG` â†’ Fallback

### Tuning Recommendations

**Use Case 1: Recent Context Focus**
```javascript
{
  topK: 3,
  halflife: 7,           // Faster decay
  minsim: 0.25,          // Lower threshold
  weights: [0.4, 0.5, 0.1],  // Emphasize recency
  mmrLambda: 0.7
}
```

**Use Case 2: Deep Historical Recall**
```javascript
{
  topK: 5,               // More results
  halflife: 30,          // Slower decay
  minsim: 0.2,           // Lower threshold
  weights: [0.6, 0.2, 0.2],  // Emphasize similarity
  mmrLambda: 0.6         // More diversity
}
```

**Use Case 3: High Precision (Quality over Quantity)**
```javascript
{
  topK: 2,               // Fewer results
  minsim: 0.5,           // Higher threshold
  weights: [0.7, 0.2, 0.1],  // Heavy similarity weight
  mmrLambda: 0.8         // Less diversity penalty
}
```

**Use Case 4: Maximum Diversity**
```javascript
{
  topK: 5,
  minsim: 0.3,
  weights: [0.5, 0.3, 0.2],
  mmrLambda: 0.5         // Equal relevance/diversity
}
```

---

## Integration in Context Building

### Context Prompt Structure

RAG results are inserted into Block 4 (uncached block) of the system prompt:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Block 1: Static System Prompt (CACHED - long TTL)          â”‚
â”‚ - Action reference, identity, capabilities                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Block 2: Stable Context (CACHED - long TTL)                â”‚
â”‚ - Cold storage, notebook, observations, branch summaries    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Block 3: History Prefix (CACHED - short TTL)               â”‚
â”‚ - Older history entries (stable, rarely changes)            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Block 4: Fresh Tail (NEVER CACHED)                         â”‚
â”‚                                                               â”‚
â”‚ ## Relevant Past Context                                    â”‚
â”‚ [RAG RESULTS INSERT HERE]                                   â”‚
â”‚                                                               â”‚
â”‚ ## Recent Activity                                          â”‚
â”‚ [Fresh history tail]                                        â”‚
â”‚                                                               â”‚
â”‚ ## Current Status                                           â”‚
â”‚ [User status, reminders, cycle count]                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### RAG Section Format

```markdown
## Relevant Past Context

The following summaries from your compressed history may be relevant
to the current conversation:

[1] (Jan 1-3, 2026 | similarity: 0.82)
The user and I discussed career planning and their physics background.
They're considering transitioning from academia to industry and want
to leverage their research experience in computational modeling...

[2] (Dec 28-30, 2025 | similarity: 0.75)
We explored ideas about creativity and project structure. The user shared
their approach to organizing complex codebases and mentioned an interest
in AI-native documentation patterns...

[3] (Jan 5, 2026 | similarity: 0.71)
Conversation about database indexing strategy and query performance.
The user compared composite versus single-column indexes and weighed
read-versus-write trade-offs for the history table...
```

**Summary truncation:** Summaries > 500 characters are truncated with "..." to prevent token bloat.

### Query Generation

The query embedding is generated from the recent history tail:

```javascript
// Get last N entries from history (default N=20 from queryHistoryCount)
const historyTail = recentHistory.slice(-queryHistoryCount);

// Format as text
const queryText = historyTail.map(h => {
  const timestamp = formatEasternDateTime(h.created_at);
  return `[${timestamp}] ${h.content}`;
}).join('\n');

// Generate embedding
const { embedding } = await generateEmbedding(queryText, env);
```

**Why the tail?** Using recent conversation as the query ensures relevance to current topics. Claude's most recent thoughts and the user's latest messages form the semantic query.

### Archived Summaries Included

**CRITICAL:** RAG searches ALL summaries with embeddings, including `archived_at IS NOT NULL`.

Archived summaries are:
- **Removed from chronological context** (don't appear in Block 3)
- **Only accessible via RAG** semantic retrieval
- **Created by:**
  - Meta-summarization (consolidating old summaries)
  - Bulk archive (`/bulkarchive` command)

This is the **ONLY way** to access bulk-archived historical context. Without RAG, archived summaries are invisible.

### Graceful Degradation

RAG failures are logged but don't block the thinking cycle:

```javascript
try {
  // RAG retrieval pipeline
  const ragResults = await retrieveRelevantSummaries(db, queryEmbedding, config);
  // Format and insert into prompt
} catch (e) {
  console.warn('[RAG] Retrieval failed, continuing without RAG:', e.message);
  // Cycle continues normally without RAG section
}
```

**No RAG results?** The "Relevant Past Context" section is simply omitted.

---

## Performance

### Embedding Generation

| Metric | Value |
|--------|-------|
| **Latency** | 100-500ms per embedding |
| **Frequency** | Only on summary creation (not every cycle) |
| **Cost** | Free (Cloudflare Workers AI) |
| **Batch Support** | Yes (via `generateEmbeddingsBatch`) |

**Optimization:** Embeddings are generated once at summary creation and stored. Retrieval uses pre-computed embeddings, not real-time generation.

### Retrieval Algorithm

| Metric | Value |
|--------|-------|
| **Algorithm** | Brute-force cosine similarity |
| **Complexity** | O(N Ã— D) where N=summaries, D=dimensions (768) |
| **Typical N** | 10-50 summaries |
| **Typical D** | 768 (fixed by model) |
| **Search Time** | <10ms (in-memory operations) |

**Why brute-force?** With only 10-50 summaries, approximate nearest neighbor (ANN) algorithms like HNSW or FAISS add unnecessary complexity. Direct cosine similarity is fast enough.

**Scaling concern:** If summary count grows to 1000+, consider:
- ANN indexing (HNSW via Pinecone or local implementation)
- Limiting search to non-archived summaries first
- Hierarchical search (search meta-summaries, then drill down)

### Token Cost Per Cycle

| Component | Token Count |
|-----------|-------------|
| **RAG Section Header** | ~25 tokens |
| **Per Summary** | ~140 tokens (truncated to 500 chars) |
| **Total (3 summaries)** | ~445 tokens |

**Impact on cache:** RAG results go in Block 4 (uncached), so they don't affect cache hit rates. However, they do increase input token usage by ~445 tokens per cycle.

**Cost estimate:**
```
445 tokens Ã— $3.00 per 1M input tokens = $0.001335 per cycle
At 144 cycles/day (10-min interval), RAG adds ~$0.19/day to input costs
```

### Memory Usage

| Component | Size |
|-----------|------|
| **Embedding (Float32Array)** | 768 Ã— 4 bytes = 3,072 bytes |
| **Candidate List (N=50)** | 50 Ã— 3KB = 150KB |
| **Selected Results (K=3)** | 3 Ã— 3KB = 9KB |

**Peak memory:** ~150KB during retrieval (ephemeral, garbage collected after cycle).

---

## Key Functions Reference

### Core Functions

**Function:** `generateEmbedding(text, env)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:48`
**Purpose:** Generate 768-dimensional embedding from text
**Upstream:** addSummary(), metaSummarize(), RAG query generation
**Downstream:** Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`)

---

**Function:** `retrieveRelevantSummaries(db, queryEmbedding, config)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:373`
**Purpose:** Full RAG pipeline (score + MMR + top-K selection)
**Upstream:** buildSystemPrompt() during context building
**Downstream:** D1 SELECT, cosineSimilarity(), calculateRecencyScore(), calculateImportanceScore()

---

**Function:** `cosineSimilarity(a, b)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:204`
**Purpose:** Calculate semantic similarity between two embeddings
**Upstream:** retrieveRelevantSummaries(), MMR diversity calculation
**Downstream:** None (pure math)

---

**Function:** `calculateRecencyScore(createdAt, halflifeDays)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:305`
**Purpose:** Exponential decay score based on summary age
**Upstream:** retrieveRelevantSummaries()
**Downstream:** None (pure math)

---

**Function:** `calculateImportanceScore(messageCount, maxExpectedCount)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:329`
**Purpose:** Logarithmic importance score based on message count
**Upstream:** retrieveRelevantSummaries()
**Downstream:** None (pure math)

---

**Function:** `embeddingToBlob(embedding)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:156`
**Purpose:** Serialize Float32Array to BLOB for D1 storage
**Upstream:** addSummary() when storing embeddings
**Downstream:** ArrayBuffer operations

---

**Function:** `blobToEmbedding(blob)`
**Location:** `platforms/cloudflare/src/services/embeddings.js:179`
**Purpose:** Deserialize BLOB to Float32Array for retrieval
**Upstream:** retrieveRelevantSummaries(), findSimilarSummaries()
**Downstream:** Float32Array constructor

---

**Function:** `getRagConfig(db)`
**Location:** `platforms/cloudflare/src/routes/settings.js:496`
**Purpose:** Merge default RAG_CONFIG with state overrides
**Upstream:** buildSystemPrompt(), `/rag` Telegram command
**Downstream:** getState() for each config key

---

**Function:** `buildSystemPrompt(db, env)`
**Location:** `platforms/cloudflare/src/index.js` (large function, ~3700 lines)
**Purpose:** Construct full system prompt with RAG integration
**Upstream:** runThinkingCycle(), `/context` endpoint
**Downstream:** getRagConfig(), generateEmbedding(), retrieveRelevantSummaries()

---

### Database Schema

**Table:** `summaries`

```sql
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  covered_range TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  embedding BLOB,              -- Float32Array serialized
  embedding_model TEXT,        -- 'bge-base-en-v1.5'
  archived_at TEXT             -- NULL for active, timestamp for archived
);
```

---

## Quick Reference

### One-Liner Commands

```bash
# Enable RAG
curl -X POST https://your-worker.workers.dev/rag \
  -H "Content-Type: application/json" -d '{"enabled": true}'

# Set high precision mode
curl -X POST https://your-worker.workers.dev/rag \
  -H "Content-Type: application/json" \
  -d '{"topK":2,"minSimilarity":0.5,"weights":{"similarity":0.7,"recency":0.2,"importance":0.1}}'

# Reset to defaults
curl -X POST https://your-worker.workers.dev/rag \
  -H "Content-Type: application/json" -d '{"reset": true}'
```

### Debugging RAG

**Check current config:**
```bash
curl https://your-worker.workers.dev/rag
```

**Check context with RAG stats:**
```bash
curl https://your-worker.workers.dev/context
# Returns: ragRetrievedCount, ragRetrievedSummaries
```

**View logs (wrangler tail):**
```bash
cd platforms/cloudflare && npx wrangler tail
# Watch for "[RAG]" prefixed log lines
```

**Common log patterns:**
```
[RAG] Retrieved 3 summaries via MMR (from 12 candidates, 47 total)
[RAG] No summaries above minSimilarity threshold (0.3)
[RAG] Retrieval failed, continuing without RAG: <error>
[Embeddings] Generated 768-dimensional embedding
```

---

**End of RAG System Documentation**
