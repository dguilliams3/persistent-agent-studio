/**
 * Memory Subsystem
 *
 * @module @persistence/memory
 * @description Core memory management for persistent LLM systems.
 *
 * This package is THE heart of the persistence system. An LLM without memory
 * is stateless - this package provides the infrastructure for:
 *
 * - **Summarization**: Compress history into summaries (human brain consolidation)
 * - **RAG**: Semantic retrieval of relevant memories (complete)
 * - **Context Assembly**: Build the system prompt with memories (complete)
 * - **Block System**: Explicit cache blocks (BLOCK.PROMOTED, BLOCK.STABLE, BLOCK.FRESH)
 *
 * PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Memory is not just storage - it's identity.                             │
 * │                                                                          │
 * │  What we remember shapes who we are. This package manages how an LLM     │
 * │  accumulates, compresses, and retrieves its experiences over time.       │
 * │  The goal is continuous identity across sessions, not just context.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * PACKAGE STRUCTURE:
 * ```
 * @persistence/memory
 * ├── summarization/     # History compression (COMPLETE)
 * │   ├── parser/        # LLM response parsing
 * │   ├── formatter/     # Entry formatting for prompts
 * │   ├── prompts/       # Default summarization prompts
 * │   └── tier/          # Tier system logic
 * │
 * ├── rag/               # Semantic retrieval (COMPLETE)
 * │   ├── math/          # Vector math (cosine, euclidean, normalize)
 * │   ├── storage/       # Blob ↔ embedding conversion
 * │   ├── scoring/       # Recency, importance, combined scoring
 * │   └── retrieval/     # MMR algorithm
 * │
 * ├── context/           # Context assembly (COMPLETE)
 * │   ├── formatters/    # Section formatters
 * │   ├── builder/       # Main orchestrator (buildContext)
 * │   ├── blocks/        # Block 2/3/4 builders
 * │   └── cache/         # Cache boundary management
 * │
 * └── sim/               # Semantic Identity Monitor (COMPLETE)
 *     ├── types.ts       # SIM type definitions
 *     └── index.ts       # Axes, scores, basin metrics, anomalies
 * ```
 *
 * USAGE:
 * ```typescript
 * // Summarization
 * import { summarization } from '@persistence/memory';
 * const result = summarization.parseHistorySummaryResponse(llmOutput);
 *
 * // Or direct submodule import
 * import { parseHistorySummaryResponse } from '@persistence/memory/summarization';
 * ```
 *
 * MIGRATION STATUS:
 * - [x] summarization/parser - Implemented
 * - [x] summarization/formatter - Implemented
 * - [x] summarization/prompts - Implemented
 * - [x] summarization/tier - Implemented
 * - [x] rag/math,storage,scoring - Implemented (Step 3A.1-3)
 * - [x] rag/retrieval - MMR algorithm (Step 3A.4)
 * - [x] context/formatters - Implemented (Step 3B.1)
 * - [x] context/blocks,cache,builder - Implemented (Steps 3B.2-4)
 *
 * @upstream Used by: @persistence/tools (SUMMARIZE), @persistence/runtime, platforms/
 * @downstream Uses: @persistence/core, @persistence/db, @persistence/llm
 */

// ============================================================================
// CORE TYPES (canonical source for all memory types)
// ============================================================================

export type {
  // Branded ID types
  HistoryId,
  SummaryId,
  PersonaId,
  CycleId,
  ISOTimestamp,
  TimeRangeDescription,

  // History types
  HistoryEntry,
  HistoryType,

  // Summary types
  Summary,
  MetaSummary,
  SummaryTier,
  SummarySourceType,
  SummaryMetadata,

  // Cache block types
  ContextBlock,

  // State machine types
  TierTransition,
  SummaryLifecycleState,
} from './types';

export {
  // Cache block system
  BLOCK,
  isInContext,

  // History and summary utilities
  HISTORY_TYPE_ICONS,
  TIER_SORT_ORDER,
  DEFAULT_METADATA,
  VALID_TRANSITIONS,
  isHistoryType,
  isMetaSummary,
  isValidTransition,
  getSummaryLifecycleState,
} from './types';

// ============================================================================
// MAPPERS (DB row ↔ domain type conversion)
// ============================================================================

export type {
  HistoryRow,
} from './mappers';

export {
  rowToHistory,
  historyToRow,
  summaryToRow,
  stringifySourceIds,
  stringifyMetadata,
} from './mappers';

// ============================================================================
// SUMMARIZATION
// ============================================================================

// Namespace export for qualified access
export * as summarization from './summarization';

// Re-export summarization-specific types at package level
export type {
  // Config types
  SummarizationConfig,
  MetaSummarizationConfig,
  // Result types
  SummaryResult,
  MetaSummaryResult,
  // Processing types
  FormattedEntry,
  ParsedSummaryResponse,
  // Orchestrator types (NEW)
  LLMAdapter,
  EmbeddingAdapter,
  SummarizeRequest,
  MetaSummarizeRequest,
  SummaryDraft,
  MetaSummaryDraft,
  SummarizeResult as OrchestratorSummarizeResult,
  MetaSummarizeResult as OrchestratorMetaSummarizeResult,
} from './summarization';

// Re-export commonly used functions at package level
export {
  parseHistorySummaryResponse,
  parseMetaSummaryResponse,
  formatEntriesForSummarization,
  DEFAULT_PROMPTS,
  shouldTriggerMetasummarize,
  // Orchestrator functions (NEW)
  summarize,
  metaSummarize,
  // Token estimation (canonical: chars/4)
  estimateTokens,
} from './summarization';

// ============================================================================
// RAG
// ============================================================================

// Namespace export for qualified access
export * as rag from './rag';

// Re-export RAG-specific types at package level
export type {
  Embedding,
  EmbeddingFloat32,
  ScoringWeights,
  ScoreBreakdown,
  ScoredResult,
  ScoredResultWithEmbedding,
  RecencyConfig,
  ImportanceConfig,
} from './rag';

// Re-export commonly used RAG functions at package level
export {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  embeddingToBlob,
  blobToEmbedding,
  calculateRecencyScore,
  calculateImportanceScore,
  calculateCombinedScore,
  DEFAULT_SCORING_WEIGHTS,
  EMBEDDING_DIMENSION,
  // High-level retrieval orchestrators
  retrieveRelevantSummaries,
  retrieveRelevantMemories,
  DEFAULT_RETRIEVAL_CONFIG,
} from './rag';

// Re-export orchestrator types
export type {
  RetrievalConfig,
  ScoredSummaryResult,
  ScoredMemoryResult,
  MemoryRetrievalConfig,
} from './rag';

// ============================================================================
// CONTEXT
// ============================================================================

// Namespace export for qualified access
export * as context from './context';

// Re-export context-specific types at package level
export type {
  // Format options
  FormatOptions,
  FormattedSection,

  // Memory data types for context
  NotebookEntry,
  ObservationEntry,
  ReminderEntry,
  LearnedEntry,
  QuestionEntry,
  ColdStorageEntry,

  // Image types
  UserImage,
  ClaudeArtImage,

  // Context assembly types
  ContextData,
  ContextResult,
  UserStatus,
  PersonaInfo,
  RagRetrievedMemory,

  // Cache types
  CacheConfig,
  CacheBoundaryState,
  HistoryBoundaryResult,
  SummaryBoundaryResult,

  // Block types
  BlockConfig,
  Block1Data,
  Block2Data,
  Block3Data,
  Block4Data,
  BlockResult,
  FourBlockResult,

  // Builder types
  ContextBuilderConfig,
  ContextFormatters,
  BuilderResult,
} from './context';

// Re-export commonly used context formatters at package level
export {
  // History formatting
  formatTimeForContext,
  formatDateTimeForContext,
  formatHistoryEntry,
  formatHistorySection,
  formatHistorySectionWithHeader,

  // Section formatting
  formatNotebookSection,
  formatObservationsSection,
  formatSummaryForContext,
  formatSummariesPrefixSection,
  formatSummariesTailSection,
  formatPromotedSummariesSection,
  formatRemindersSection,
  formatLearnedSection,
  formatQuestionsSection,
  formatColdStorageSection,

  // Constants
  CONTEXT_TYPE_ICONS,
  getTypeIcon,

  // Cache boundary functions
  estimateHistoryTokens,
  estimateSummaryTokens,
  calculateHistoryBoundary,
  calculateSummaryBoundary,

  // Block builders
  buildBlock2,
  buildBlock3,
  buildBlock4,

  // Context builder
  buildContext,

  // Stats (tier/boundary split logic)
  splitSummariesByTierAndBoundary,
} from './context';

// ============================================================================
// SNAPSHOT (Personality Export/Import)
// ============================================================================

// Namespace export for qualified access
export * as snapshot from './snapshot';

// Re-export snapshot-specific types at package level
export type {
  // Image types
  ImageRef,
  GalleryImage,
  GalleryManifest,
  GalleryExport,

  // Snapshot structure types
  SnapshotMeta,
  SnapshotState,
  SnapshotMemories,
  SnapshotMedia,
  SnapshotBranches,
  SnapshotSystemPrompt,
  PersonalitySnapshot,

  // Export entry types
  HistoryExportEntry,
  ColdStorageExportEntry,
  NotebookExportEntry,
  ObservationExportEntry,
  SummaryExportEntry,
  ReminderExportEntry,
  GalleryMediaEntry,
  BranchExportEntry,
  BranchOverrideEntry,
  SyntheticMemoryEntry,

  // Validation types
  ValidationResult,

  // Pending image refs
  PendingImageRef,
  PendingImageRefsState,
} from './snapshot';

// Re-export commonly used snapshot functions at package level
export {
  // Constants
  SNAPSHOT_VERSION,
  MAX_EXPORT_SIZE_BYTES,
  DEFAULT_EXPORT_HISTORY_LIMIT,
  IMAGE_PLACEHOLDER,
  EXPORTABLE_STATE_KEYS,
  REQUIRED_MEMORY_TYPES,
  // Checksum
  calculateChecksum,
  verifyChecksum,
  // Validation
  validateSnapshotFormat,
} from './snapshot';

export type { ExportableStateKey, RequiredMemoryType } from './snapshot';

// ============================================================================
// SIM (Semantic Identity Monitor)
// ============================================================================

// Namespace export for qualified access
export * as sim from './sim';

// Re-export SIM-specific types at package level
export type {
  // Config types
  EmbeddingTableConfig,
  EmbeddingTableName,
  // Concept axes
  ConceptAxisRow,
  ConceptAxis,
  CreateAxisInput,
  UpdateAxisInput,
  // Axis scores
  AxisScore,
  UpsertScoreInput,
  // Basin metrics
  BasinMetricsRow,
  BasinMetrics,
  UpsertBasinMetricsInput,
  // Anomaly tracking
  AnomalyFlagRow,
  AnomalyFlag,
  CreateAnomalyInput,
  UpdateAnomalyInput,
  AnomalyFilters,
  // Export types
  EmbeddingsExportResult,
  EmbeddingsCoverage,
  TableCoverageStats,
  SimQueryOptions,
} from './sim';

// Re-export commonly used SIM functions at package level
export {
  // Config
  SIM_EMBEDDING_TABLES,
  // Concept axes
  getAxes,
  getAxisById,
  createAxis,
  updateAxis,
  deleteAxis,
  // Axis scores
  getScoresForEntry,
  upsertScore,
  batchUpsertScores,
  // Basin metrics
  getBasinMetrics,
  upsertBasinMetrics,
  // Anomaly tracking
  getAnomalies,
  createAnomaly,
  updateAnomaly,
  // Embedding helpers
  getEmbeddingsExport,
  getEmbeddingsCoverage,
  // Computation helpers (pure math)
  computeBasinMetrics,
  computeEntryStats,
  analyzeTrend,
  getIsoWeekKey,
  computeCentroidDistance,
  computeCrossTypeCentroidDistances,
  computeWeeklyBasinBuckets,
} from './sim';

// ============================================================================
// MIGRATION STATUS
// ============================================================================

/**
 * Tracks migration progress from platforms/ to this package.
 */
export const MEMORY_MIGRATION_STATUS = {
  summarization: {
    parser: 'complete',
    formatter: 'complete',
    prompts: 'complete',
    tier: 'complete',
    orchestrator: 'complete', // summarize(), metaSummarize() - type-driven extraction (2026-01-27)
  },
  rag: {
    math: 'complete',      // cosineSimilarity, euclideanDistance, normalizeVector, mean, stdDev
    storage: 'complete',   // embeddingToBlob, blobToEmbedding
    scoring: 'complete',   // recency, importance, combined scoring
    retrieval: 'complete', // MMR algorithm
    // Platform-bound (stays in platforms/):
    embeddings: 'platform', // generateEmbedding() uses env.AI binding
  },
  context: {
    formatters: 'complete', // All section formatters extracted
    blocks: 'complete',     // Block builders (buildBlock2/3/4)
    cache: 'complete',      // Boundary management (calculateHistoryBoundary, calculateSummaryBoundary)
    builder: 'complete',    // Main orchestrator (buildContext)
    // Platform wiring: build-system-prompt.js now calls buildContext() (2026-01-27)
  },
  sim: {
    types: 'complete',     // Type definitions for SIM entities
    axes: 'complete',      // Concept axis CRUD
    scores: 'complete',    // Axis scores for content
    basin: 'complete',     // Basin metrics for anomaly detection
    anomalies: 'complete', // Anomaly flag tracking
    export: 'complete',    // Embedding export utilities
  },
  snapshot: {
    types: 'complete',     // PersonalitySnapshot, ImageRef, GalleryExport types (2026-01-30)
    constants: 'complete', // SNAPSHOT_VERSION, EXPORTABLE_STATE_KEYS, etc.
    checksum: 'complete',  // calculateChecksum, verifyChecksum
    validation: 'complete', // validateSnapshotFormat
    // Platform-bound (stays in platforms/):
    handlers: 'platform', // Export/import HTTP handlers need DB + Request/Response
  },
} as const;
