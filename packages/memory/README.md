# @persistence/memory

Memory subsystem for persistent LLM existence loops: summarization, RAG, context assembly, and tier management.

## What This Package Does

The memory subsystem is the heart of persistence. While most LLM systems lose context between sessions, this package provides the infrastructure for an LLM to maintain continuous identity across time. It compresses growing history into summaries (like human memory consolidation), retrieves relevant memories via semantic search (RAG), and assembles these memories into Claude's system prompt in a cache-optimized 4-block structure. Together, these capabilities allow Claude to remember and learn over days, weeks, and months.

## Status

**Migration Progress:** ✅ Complete (as of 2026-01-27)

All components have been successfully extracted from `platforms/cloudflare` into this package:

```
MEMORY_MIGRATION_STATUS = {
  summarization: { parser: complete, formatter: complete, prompts: complete, tier: complete },
  rag: { math: complete, storage: complete, scoring: complete, retrieval: complete },
  context: { formatters: complete, blocks: complete, cache: complete, builder: complete }
}
```

**Pending:** The summarization orchestrator functions (`summarizeHistory()`, `batchSummarizeHistory()`, `metaSummarize()`) remain in the platform layer because they require LLM API access. All pure logic has been extracted.

## Package Structure

```
@persistence/memory
├── index.ts                    # Canonical barrel export
│
├── types.ts                    # Core type definitions
│   ├── Branded ID types (HistoryId, SummaryId, PersonaId, CycleId, ISOTimestamp)
│   ├── HistoryEntry and HistoryType
│   ├── Summary, MetaSummary, SummaryTier, SummaryMetadata
│   ├── Cache block system (BLOCK.PROMOTED, BLOCK.STABLE, BLOCK.FRESH)
│   └── State transitions (TierTransition, valid transitions)
│
├── mappers.ts                  # DB row ↔ domain type conversion
│   ├── rowToHistory, historyToRow
│   ├── rowToSummary, summaryToRow
│   └── Parse/stringify JSON fields (source_ids, metadata)
│
├── summarization/              # History compression (COMPLETE)
│   ├── parser/                 # LLM response parsing
│   │   ├── parse-history.ts    # Parse first-pass summaries (JSON/legacy/text)
│   │   ├── parse-meta.ts       # Parse meta-summaries
│   │   └── utils.ts            # Shared parsing utilities
│   ├── formatter/              # Entry formatting for prompts
│   │   ├── format-entries.ts   # Stringify history/summaries for LLM
│   │   └── Estimate tokens
│   ├── prompts/                # Default summarization prompts
│   │   ├── defaults.ts         # System prompts, instructions
│   │   └── Builders for custom prompts
│   ├── tier/                   # Tier system logic
│   │   ├── transitions.ts      # Valid tier movements (2→3, 3→4, etc.)
│   │   └── shouldTriggerMetasummarize() logic
│   └── types.ts                # SummarizationConfig, SummaryResult, etc.
│
├── rag/                        # Semantic memory retrieval (COMPLETE)
│   ├── math/                   # Vector similarity
│   │   ├── similarity.ts       # cosineSimilarity, euclideanDistance
│   │   └── statistics.ts       # mean, stdDev, normalizeVector
│   ├── storage/                # Blob conversion
│   │   └── embeddingToBlob, blobToEmbedding
│   ├── scoring/                # Multi-factor scoring
│   │   ├── recency.ts          # Newer = higher score
│   │   ├── importance.ts       # User interactions = higher score
│   │   └── combined.ts         # Weighted combination
│   ├── retrieval/              # MMR algorithm
│   │   └── mmr.ts             # Maximal Marginal Relevance selection
│   └── types.ts                # Embedding, ScoringWeights, ScoreBreakdown
│
├── sim/                        # Semantic Identity Monitor (COMPLETE)
│   ├── index.ts                # Barrel export
│   ├── types.ts                # ConceptAxis, AxisScore, BasinState
│   ├── axes.ts                 # Axis scoring logic
│   ├── basins.ts               # Basin analysis and metrics
│   ├── snapshots.ts            # Identity snapshot capture
│   └── storage.ts              # D1 persistence helpers
│
└── context/                    # Context assembly (COMPLETE)
    ├── formatters/             # Section formatting
    │   ├── history.ts          # formatHistorySection()
    │   ├── summaries.ts        # formatSummaryForContext()
    │   ├── notebook.ts         # formatNotebookSection()
    │   ├── observations.ts     # formatObservationsSection()
    │   ├── reminders.ts        # formatRemindersSection()
    │   ├── learned.ts          # formatLearnedSection()
    │   ├── cold-storage.ts     # formatColdStorageSection()
    │   ├── constants.ts        # CONTEXT_TYPE_ICONS
    │   └── Cache boundary functions (estimateTokens)
    ├── cache/                  # Cache boundary management
    │   ├── boundary.ts         # calculateHistoryBoundary, calculateSummaryBoundary
    │   └── Token estimation logic
    ├── blocks/                 # Block builders (cache-optimized structure)
    │   ├── block2.ts           # buildBlock2() - Promoted summaries
    │   ├── block3.ts           # buildBlock3() - Stable summaries, learned, notebook
    │   ├── block4.ts           # buildBlock4() - Fresh summaries, RAG results, history tail
    │   └── types.ts            # Block1Data, Block2Data, Block3Data, Block4Data
    ├── builder/                # Main orchestrator
    │   ├── build-context.ts    # buildContext() - Assemble full system prompt
    │   └── types.ts            # ContextData, ContextResult, ContextBuilderConfig
    ├── stats/                  # Summary statistics and tier splitting
    │   ├── split-summaries.ts  # splitSummariesByTierAndBoundary() - SINGLE SOURCE OF TRUTH
    │   ├── types.ts            # SummarySplitResult, SplitSummariesOptions
    │   └── index.ts            # Barrel export
    └── types.ts                # Shared context types (UserStatus, RagRetrievedMemory, etc.)
```

## Key Exports

### Core Types (from `types.ts`)

```typescript
// Branded ID types (prevent compile-time ID mix-ups)
export type HistoryId = Brand<number, 'HistoryId'>;
export type SummaryId = Brand<number, 'SummaryId'>;
export type PersonaId = Brand<number, 'PersonaId'>;
export type ISOTimestamp = Brand<string, 'ISOTimestamp'>;

// History
export interface HistoryEntry {
  id: HistoryId;
  type: HistoryType;  // 'thought' | 'message_to_user' | 'art_result' | ...
  content: string;
  created_at: ISOTimestamp;
  meter_snapshot: string | null;  // "A7 C6 N10 E8 D7"
  // ...
}

// Summaries
export interface Summary {
  id: SummaryId;
  summary: string;           // Compressed content
  source_type: 'history' | 'summary';  // First-pass or meta-summary
  source_ids: number[];      // Which entries were compressed
  tier: 1 | 2 | 3 | 4 | 'archived';  // Cache block location
  tier_position: number;     // Order within tier
  embedding: ArrayBuffer | null;  // For RAG semantic search
  metadata: SummaryMetadata;  // Rich extraction (entities, themes, tone, etc.)
}

// Cache blocks
export const BLOCK = {
  CONSTITUTION: 1,  // Static system content
  PROMOTED: 2,      // Cached important summaries
  STABLE: 3,        // Daily-change summaries
  FRESH: 4,         // Every-cycle summaries & RAG results
};
```

### Summarization Functions

```typescript
import { parseHistorySummaryResponse, parseMetaSummaryResponse, formatEntriesForSummarization } from '@persistence/memory';

// Parse LLM responses
const result = parseHistorySummaryResponse(llmOutput, options);
// Returns: ParsedSummaryResponse { summary, metadata, isValid, errors }

const metaResult = parseMetaSummaryResponse(llmOutput);
// Returns: ParsedMetaResponse { summary, source_ids, metadata }

// Format entries for LLM prompts
const formatted = formatEntriesForSummarization(historyEntries, config);
// Returns array of FormattedEntry with text, token count, truncation info
```

### RAG Functions

```typescript
import { rag } from '@persistence/memory';
// Or: import { cosineSimilarity, calculateCombinedScore } from '@persistence/memory';

// Vector similarity
const similarity = rag.cosineSimilarity(embeddingA, embeddingB);  // 0.0 - 1.0
const distance = rag.euclideanDistance(embeddingA, embeddingB);

// Scoring
const recencyScore = rag.calculateRecencyScore(timestamp, now, config);
const importanceScore = rag.calculateImportanceScore(clickCount, likeCount);
const combinedScore = rag.calculateCombinedScore(similarity, recency, importance);

// Storage (D1 constraints)
const blob = rag.embeddingToBlob(embedding);  // Float32Array → ArrayBuffer
const restored = rag.blobToEmbedding(blob);   // ArrayBuffer → Float32Array

// MMR selection (diverse top-K from large corpus)
const topResults = rag.selectByMMR(allResults, k, lambdaParam);
```

### Context Assembly Functions

```typescript
import { context, buildContext } from '@persistence/memory';

// Individual section formatting
const historyText = context.formatHistorySection(entries, { recentImageThreshold: 10 });
const summaryText = context.formatSummaryForContext(summary, 1);  // 1 = PROMOTED block
const notebookText = context.formatNotebookSection(entries);

// Cache boundaries (determine what fits in prompt)
const historyBoundary = context.calculateHistoryBoundary(history, 'history', config);
// Returns: { startIndex, endIndex, tokenEstimate, truncated }

const summaryBoundary = context.calculateSummaryBoundary(summaries, 'summaries', config);

// Build cache-optimized blocks
const block2 = context.buildBlock2({ promotedSummaries }, formatDateTime);
const block3 = context.buildBlock3(data, formatSummary, formatDateTime);
const block4 = context.buildBlock4(data, formatHistory, formatSummary, formatDateTime, formatMeters);

// Assemble full context (orchestrator)
const contextResult = buildContext({
  history,
  summaries,
  notebook,
  observations,
  reminders,
  learned,
  questions,
  coldStorage,
  userStatus,
  personaInfo,
  ragResults,
  meters,
  // ... formatters and config
});
// Returns: BuilderResult { blocks, tokenSummary, timestamp }
```

### Summary Statistics Functions

```typescript
import { splitSummariesByTierAndBoundary } from '@persistence/memory';
// Or: import { context } from '@persistence/memory'; context.splitSummariesByTierAndBoundary(...)

// Function signature
function splitSummariesByTierAndBoundary(
  summaries: Summary[],
  options?: SplitSummariesOptions
): SummarySplitResult;

// Options
interface SplitSummariesOptions {
  promotedIds?: Set<SummaryId>;        // IDs to exclude (Block 2)
  boundaryId?: SummaryId | null;       // Split point for tier 4
  estimateTokens?: (s: Summary) => number;  // Custom token estimator
}

// Result
interface SummarySplitResult {
  pinned: Summary[];      // Tier 3 - user manually froze
  autoRolled: Summary[];  // Tier 4, at/before boundary
  tail: Summary[];        // Tier 4, after boundary
  prefix: Summary[];      // Combined: pinned + autoRolled (for Block 3)
  stats: {
    pinnedCount: number;
    pinnedTokens: number;
    autoRolledCount: number;
    autoRolledTokens: number;
    tailCount: number;
    tailTokens: number;
    totalCount: number;
    totalTokens: number;
  };
}
```

**When to use:** This is the SINGLE SOURCE OF TRUTH for categorizing summaries by tier and boundary. Both `buildContext()` and the stats API (`/summary-config`) use this function to ensure consistent categorization.

**Tier semantics:**
- **Tier 2 (Promoted):** Excluded via `promotedIds` - handled separately in Block 2
- **Tier 3 (Pinned):** User manually froze - always goes to Block 3 prefix
- **Tier 4 (Dynamic):** Split by `boundaryId`:
  - At or before boundary → `autoRolled` (Block 3 prefix)
  - After boundary → `tail` (Block 4, uncached)

## Usage Examples

### Basic: Parse a Summary Response

```typescript
import { parseHistorySummaryResponse } from '@persistence/memory';

const llmOutput = `{
  "summary": "Had a philosophical discussion about identity...",
  "metadata": {
    "entity_tags": ["User", "identity", "philosophy"],
    "key_facts": ["Discussed attachment theory"],
    "themes": ["philosophy"],
    "emotional_tone": "contemplative",
    "time_period_label": "Morning chat"
  }
}`;

const result = parseHistorySummaryResponse(llmOutput);
if (result.isValid) {
  console.log(result.summary);           // The compressed text
  console.log(result.metadata.themes);   // ["philosophy"]
} else {
  console.log(result.errors);
}
```

### Semantic Search: Score and Rank Results

```typescript
import { rag } from '@persistence/memory';

const queryEmbedding = await generateEmbedding(userQuery);
const candidates = [
  { id: 1, embedding: emb1, timestamp: '2026-01-27T...' },
  { id: 2, embedding: emb2, timestamp: '2026-01-20T...' },
  // ...
];

const scored = candidates.map(cand => {
  const sim = rag.cosineSimilarity(queryEmbedding, cand.embedding);
  const recency = rag.calculateRecencyScore(cand.timestamp, Date.now(), { halfLifeDays: 7 });
  const importance = 0.8;  // From user interactions

  return {
    ...cand,
    score: rag.calculateCombinedScore(sim, recency, importance, {
      similarityWeight: 0.6,
      recencyWeight: 0.2,
      importanceWeight: 0.2,
    }),
  };
}).sort((a, b) => b.score - a.score);

// Use MMR for diversity
const topK = rag.selectByMMR(scored, 5, 0.7);
```

### Context Assembly: Build System Prompt

```typescript
import { buildContext, BLOCK } from '@persistence/memory';

const contextResult = await buildContext({
  // Data
  history: recentHistoryEntries,
  summaries: activeSummaries,
  notebook: notebookEntries,
  observations: observations,
  reminders: activeReminders,
  learned: learnedFacts,
  questions: openQuestions,
  coldStorage: permanentMemories,
  userStatus: { isAvailable: true, context: 'working' },
  personaInfo: { name: 'Claude', id: 1 as PersonaId },
  ragResults: retrievedMemories,
  meters: { attention: 7, curiosity: 5 },

  // Formatters
  formatDateTime: (iso) => formatEasternTime(iso),
  formatSummary: (summary) => context.formatSummaryForContext(summary, summary.tier),
  formatHistory: (entries) => context.formatHistorySection(entries),

  // Config
  config: {
    maxPromptTokens: 8000,
    reserved: { systemPrompt: 2000, responseBuffer: 2000 },
    historyBoundary: { enabled: true, maxTokens: 2000 },
    tierConfig: {
      [BLOCK.PROMOTED]: { maxTokens: 3000, position: 'early' },
      [BLOCK.STABLE]: { maxTokens: 2500, position: 'middle' },
      [BLOCK.FRESH]: { maxTokens: 2000, position: 'late' },
    }
  }
});

console.log(contextResult.blocks.block4.text);  // Fresh tier content
console.log(contextResult.tokenSummary);         // { used: 7500, remaining: 500 }
```

### Work With Mappers: Convert DB Rows

```typescript
import { rowToHistory, rowToSummary, historyToRow, summaryToRow } from '@persistence/memory';

// Convert database row to domain type
const dbRow = { id: 1, type: 'thought', content: 'Hello', created_at: '2026-01-27T...', ... };
const history: HistoryEntry = rowToHistory(dbRow);

// Work with domain types
history.type;  // TypeScript knows this is HistoryType
const icon = HISTORY_TYPE_ICONS[history.type];  // Safe - type is narrowed

// Convert back to DB row for storage
const toStore = historyToRow(history);
await db.prepare('INSERT INTO history VALUES (...)').bind(...Object.values(toStore)).run();
```

## Module Architecture

### Summarization Workflow

```
Raw History → formatEntriesForSummarization() → LLM Prompt
LLM Response → parseHistorySummaryResponse() → Summary Object
Summary → formatSummaryForContext() → System Prompt

Tier Logic:
  - isValidTransition(from, to) → Check if tier move is allowed
  - shouldTriggerMetasummarize() → Auto-consolidate when needed
```

### RAG Workflow

```
Query String → generateEmbedding() → Query Vector
Memory Store → [Match scores via cosineSimilarity]
All Candidates → calculateRecencyScore() → Recency Factor
All Candidates → calculateImportanceScore() → Importance Factor
All Candidates → calculateCombinedScore() → Final Score
Ranked Results → selectByMMR() → Diverse Top-K
```

### Context Assembly Workflow

```
Memory Data (history, summaries, notebook, etc.)
           ↓
splitSummariesByTierAndBoundary() → Categorize by tier/boundary
           ↓
Formatters (transform each data type to text)
           ↓
Cache Boundary Calculation (what fits in prompt)
           ↓
Block Builders (PROMOTED → STABLE → FRESH)
           ↓
Full System Prompt (4-block structure)
           ↓
buildContext() returns: { blocks, tokenSummary }
```

The `splitSummariesByTierAndBoundary()` function is the SINGLE SOURCE OF TRUTH for summary categorization. Both `buildContext()` (for block assembly) and the stats API (for `/summary-config` endpoint) use this function to ensure consistent counting and classification.

## SIM (Semantic Identity Monitor)

The `sim/` submodule (`packages/memory/src/sim/`) provides identity coherence monitoring via concept axes + basin/anomaly analysis. It is **on-demand** (not per-cycle) and uses **UPSERT** (not append-only).

### Verified Real Exports (read from packages/memory/src/sim/{index,compute,routes,types}.ts)

Pure compute (no DB):
- `computeBasinMetrics(embeddings: Float32Array[])`
- `computeEntryStats(embedding, basinMetrics)`
- `analyzeTrend(recentDistances, basinMetrics)`

DB layer (Basin Pattern, accept `db`):
- Axes: `getAxes`, `getAxisById`, `createAxis`, `updateAxis`, `deleteAxis`, `upsertScore`
- Basins: `getBasinMetrics`, `upsertBasinMetrics`
- Anomalies: `getAnomalies`, `createAnomaly`
- Embeddings: `getEmbeddingsCoverage`, `getEmbeddingsExport`, `getEmbeddingsForTable` + backfill helpers
- Constants: `SIM_EMBEDDING_TABLES`

Routes (wired in platform registry):
- POST /sim/basin/compute , GET/POST /sim/axes , /sim/anomalies , coverage/export endpoints.

**Honest gaps (verified):**
- Concept-axis scoring is schema-complete but inert: no embedding generation on `createAxis`; `upsertScore` has zero callers.
- Basin compute is manual/on-demand via POST /sim/basin/compute + UPSERT (ON CONFLICT DO UPDATE on sim_basin_metrics), **not** automatic per-cycle and **not** append-only INSERT.

Example real usage (platform):
```ts
import { computeBasinMetrics, upsertBasinMetrics, getAxes, createAxis } from '@persistence/memory/sim';
// ...
const metrics = computeBasinMetrics(embeddings);
await upsertBasinMetrics(db, { ... });
const axes = await getAxes(db);
```

### Module Structure (actual)

```
packages/memory/src/sim/
├── index.ts     # DB helpers + re-exports
├── compute.ts   # pure basin/entry/trend
├── routes.ts    # HTTP handlers
├── types.ts
```

## Integration with platforms/cloudflare

The memory package is consumed by `platforms/cloudflare/`:

- **`build-system-prompt.js`** → ✅ **WIRED** (2026-01-27) - Calls `buildContext()` to assemble blocks 2-4
- **`routes/`** → API endpoints for summarization, RAG, memory management
- **`telegram/commands/`** → Commands like `/summodel`, `/think`, `/remember`
- **Summarization orchestrator** → `summarizeHistory()`, `batchSummarizeHistory()`, `metaSummarize()` (still in platform layer, require LLM API access)

**Platform reduction:** `build-system-prompt.js` went from 1,069 → 676 lines (37% reduction) after wiring to this package.

Example integration:

```javascript
import { buildContext, parseHistorySummaryResponse } from '@persistence/memory';

// In platform layer - build the prompt
const contextResult = await buildContext({
  history: getAllHistory(db),
  summaries: getActiveSummaries(db),
  // ... other data
});

const systemPrompt = contextResult.blocks.full;  // Ready to send to Claude API
```

## Type Safety

This package uses several TypeScript patterns for safety:

### Branded Types
Prevents ID mix-ups at compile time:
```typescript
const histId: HistoryId = 1 as HistoryId;
const summId: SummaryId = 2 as SummaryId;
// TypeScript error: Cannot assign HistoryId to SummaryId
const wrong: SummaryId = histId;
```

### Exhaustive Unions
If you add a new `HistoryType`, TypeScript errors on all incomplete switches:
```typescript
const icon = HISTORY_TYPE_ICONS[historyType];  // Must handle all types
```

### Discriminated Unions
Use `source_type` to narrow summary processing:
```typescript
if (isMetaSummary(summary)) {
  // TypeScript knows: source_ids are SummaryId values
  const parentSummaries = await db.get(summary.source_ids);
} else {
  // TypeScript knows: source_ids are HistoryId values
  const entries = await db.get(summary.source_ids);
}
```

## Dependencies

- `@persistence/core` - Core utilities and types
- `@persistence/db` - Database type definitions
- `@persistence/llm` - LLM provider abstractions

## Development

```bash
# Type check
pnpm typecheck

# No runtime dependencies - this is pure logic
# Tests and examples live in platforms/cloudflare/
```

## Philosophy

Memory is not just storage—it's identity. What we remember shapes who we are. This package manages how an LLM accumulates, compresses, and retrieves experiences over time, enabling continuous identity across sessions rather than stateless context-limited interactions.

The design separates concerns:
- **Package** provides pure, testable logic (math, parsing, formatting, algorithms)
- **Platform** handles I/O (database queries, LLM API calls, file storage)
- **Integration** ties them together in `platforms/cloudflare`
