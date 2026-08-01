/**
 * Semantic Identity Monitor (SIM) Database Helpers
 *
 * @module @persistence/memory/sim
 * @description Persona-scoped utilities for SIM data structures.
 *
 * SIM provides identity coherence monitoring through:
 * - **Concept axes**: Trained vector directions for meaning dimensions
 * - **Axis scores**: Projections of content onto concept axes
 * - **Basin metrics**: Distribution statistics for anomaly detection
 * - **Anomaly flags**: Content that deviates from learned patterns
 *
 * This module also handles embedding export/coverage for tables
 * that participate in the SIM system (summaries, learned, questions, history).
 *
 * PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SIM answers: "Is this new content consistent with who I am?"           │
 * │                                                                         │
 * │  By projecting content onto learned concept axes and tracking           │
 * │  distance from the "basin of identity", SIM detects when content        │
 * │  might be anomalous - helping maintain coherent identity over time.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DB ACCESS PATTERN:
 * Functions that require SQL features not expressible in Drizzle (latest-row
 * reads, dynamic SET clauses, raw CASE expressions) access the underlying
 * D1 client via `db.$client` and call `.prepare().bind().run()` / `.first()` /
 * `.all()` on the raw D1Database. Standard CRUD uses Drizzle query builder.
 *
 * @antipattern DO NOT call `db.prepare()` — DrizzleD1 wraps D1Database; the
 *   `.prepare()` method does not exist on the Drizzle wrapper. Always use
 *   `db.$client.prepare()` for raw SQL or Drizzle builder methods for
 *   standard queries. Never destructure `db` to extract `$client` at module
 *   level — access it per-call inside each function.
 *
 * @upstream Called by:
 *   - @persistence/memory/sim/routes (SIM route handlers)
 *   - Future: Context building for identity consistency checks
 * @downstream Calls:
 *   - @persistence/db for persona scoping (getActivePersonaId, Drizzle tables)
 *   - @persistence/memory/rag/storage for blob conversion (blobToEmbedding, embeddingToBlob)
 */

import {
  type DrizzleD1,
  type PersonaOptions,
  getActivePersonaId,
  simConceptAxes,
  simAxisScores,
  simBasinMetrics,
  simAnomalyFlags,
  summariesTable,
  learnedTable,
  questionsTable,
  historyTable,
  eq,
  and,
  sql,
  desc,
  asc,
} from "@persistence/db";

import { blobToEmbedding, embeddingToBlob } from "../rag/storage";

import type {
  EmbeddingTableConfig,
  EmbeddingTableName,
  ConceptAxisRow,
  ConceptAxis,
  CreateAxisInput,
  UpdateAxisInput,
  AxisScore,
  UpsertScoreInput,
  BasinMetricsRow,
  BasinMetrics,
  UpsertBasinMetricsInput,
  AnomalyFlagRow,
  AnomalyFlag,
  CreateAnomalyInput,
  UpdateAnomalyInput,
  AnomalyFilters,
  EmbeddingsExportResult,
  EmbeddingsCoverage,
  TableCoverageStats,
  SimQueryOptions,
} from "./types";

// Re-export types
export type {
  EmbeddingTableConfig,
  EmbeddingTableName,
  ConceptAxisRow,
  ConceptAxis,
  CreateAxisInput,
  UpdateAxisInput,
  AxisScore,
  UpsertScoreInput,
  BasinMetricsRow,
  BasinMetrics,
  UpsertBasinMetricsInput,
  AnomalyFlagRow,
  AnomalyFlag,
  CreateAnomalyInput,
  UpdateAnomalyInput,
  AnomalyFilters,
  EmbeddingsExportResult,
  EmbeddingsCoverage,
  TableCoverageStats,
  SimQueryOptions,
} from "./types";

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Run result from Drizzle D1 operations (insert, update, delete).
 * Matches the subset of D1Result that callers actually use.
 */
interface RunResult {
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
    [key: string]: unknown;
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Boundary mappers: Drizzle rows (camelCase schema properties) -> the
 * snake_case *Row contracts this module's formatters read.
 *
 * The previous `as unknown as` double-casts forced the wrong type over
 * correctly-typed camelCase rows — formatAxisRow then read undefined for
 * positive_examples/negative_examples/concept_vector, the AxisManager edit
 * form loaded blank, and Save wrote [] back over real training examples
 * (G-001, RUN-20260711-1939). Same class as the summarization kill fixed
 * in packages/db the same day. getScoresForEntry (explicit select aliases)
 * is this file's positive control; these mappers bring the other four
 * query sites to the same truth.
 */
export function toConceptAxisRow(row: typeof simConceptAxes.$inferSelect): ConceptAxisRow {
  return {
    id: row.id,
    persona_id: row.personaId,
    name: row.name,
    description: row.description,
    positive_examples: row.positiveExamples,
    negative_examples: row.negativeExamples,
    concept_vector: (row.conceptVector as ArrayBuffer | null) ?? null,
    vector_model: row.vectorModel ?? "bge-base-en-v1.5",
    is_active: row.isActive ?? 1,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function toBasinMetricsRow(row: typeof simBasinMetrics.$inferSelect): BasinMetricsRow {
  return {
    id: row.id,
    persona_id: row.personaId,
    metric_type: row.metricType,
    centroid: (row.centroid as ArrayBuffer | null) ?? null,
    mean_distance: row.meanDistance,
    std_distance: row.stdDistance,
    outlier_threshold: row.outlierThreshold,
    sample_count: row.sampleCount,
    metadata: row.metadata ?? "{}",
    computed_at: row.computedAt,
  };
}

export function toAnomalyFlagRow(row: typeof simAnomalyFlags.$inferSelect): AnomalyFlagRow {
  return {
    id: row.id,
    persona_id: row.personaId,
    target_table: row.targetTable,
    target_id: row.targetId,
    basin_distance: row.basinDistance,
    z_score: row.zScore,
    flagged_axes: row.flaggedAxes ?? "[]",
    detection_method: row.detectionMethod,
    inspected: row.inspected ?? 0,
    verdict: row.verdict,
    notes: row.notes,
    created_at: row.createdAt,
    resolved_at: row.resolvedAt,
  };
}

/**
 * Mapping from JS property names to SQL column names for axis updates
 */
const AXIS_COLUMN_MAP: Record<string, string> = {
  positiveExamples: "positive_examples",
  negativeExamples: "negative_examples",
  conceptVector: "concept_vector",
  vectorModel: "vector_model",
  isActive: "is_active",
};

/**
 * @description Safely parse JSON with fallback and warning on failure.
 *
 * BUG-004 FIX: Added console.warn logging when JSON parse fails.
 * This helps debug data corruption or unexpected column values.
 *
 * @param value - JSON string to parse
 * @param fallback - Default value if parsing fails
 * @param context - Optional context for warning message (e.g., column name, table)
 * @returns Parsed value or fallback
 */
function safeJsonParse<T>(
  value: string | null | undefined,
  fallback: T,
  context?: string,
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    // BUG-004 FIX: Log warning with context when JSON parsing fails
    const contextStr = context ? ` (context: ${context})` : "";
    const preview =
      value.length > 100 ? value.substring(0, 100) + "..." : value;
    console.warn(
      `[SIM] safeJsonParse failed${contextStr}: ${error instanceof Error ? error.message : "unknown error"}. Value preview: "${preview}"`,
    );
    return fallback;
  }
}

/**
 * @description Serialize embedding blob to number array for JSON export
 *
 * @param blob - Raw embedding blob from database
 * @returns Number array or null
 */
function serializeEmbedding(
  blob: ArrayBuffer | Uint8Array | number[] | null,
): number[] | null {
  if (!blob) return null;
  return Array.from(blobToEmbedding(blob));
}

/**
 * @description Parse JSON examples array
 *
 * @param raw - JSON string
 * @param context - Optional context for error logging
 * @returns String array
 */
function parseExamples(
  raw: string | null | undefined,
  context?: string,
): string[] {
  const parsed = safeJsonParse<unknown>(raw, [], context);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * @description Format a raw axis row into JS-friendly format
 *
 * @param row - Raw database row
 * @returns Formatted axis or null
 */
function formatAxisRow(row: ConceptAxisRow | null): ConceptAxis | null {
  if (!row) return null;
  return {
    ...row,
    positive_examples: parseExamples(
      row.positive_examples,
      `axis[${row.id}].positive_examples`,
    ),
    negative_examples: parseExamples(
      row.negative_examples,
      `axis[${row.id}].negative_examples`,
    ),
    concept_vector: row.concept_vector
      ? blobToEmbedding(row.concept_vector)
      : null,
  };
}

// ============================================================================
// EMBEDDING TABLE CONFIGURATION
// ============================================================================

/**
 * Shared configuration for tables that expose embedding data.
 * Used by export + backfill flows to keep column definitions consistent.
 *
 * @upstream Called by: getEmbeddingsExport(), getEmbeddingsCoverage()
 * @downstream Calls: None (config)
 */
export const SIM_EMBEDDING_TABLES: Record<
  EmbeddingTableName,
  EmbeddingTableConfig
> = {
  summaries: {
    table: "summaries",
    select: "id, summary, metadata, created_at, embedding, embedding_model",
    textColumn: "summary",
    orderBy: "created_at DESC",
    touchColumn: null,
    format(row: Record<string, unknown>) {
      return {
        id: row.id,
        summary: row.summary,
        metadata: safeJsonParse(
          row.metadata as string,
          {},
          `summaries[${row.id}].metadata`,
        ),
        created_at: row.created_at,
        embedding_model: row.embedding_model,
        embedding: serializeEmbedding(
          row.embedding as ArrayBuffer | Uint8Array | number[] | null,
        ),
      };
    },
  },
  learned: {
    table: "learned",
    select: "id, content, confidence, created_at, embedding, embedding_model",
    textColumn: "content",
    orderBy: "created_at DESC",
    touchColumn: "updated_at",
    format(row: Record<string, unknown>) {
      return {
        id: row.id,
        content: row.content,
        confidence: row.confidence,
        created_at: row.created_at,
        embedding_model: row.embedding_model,
        embedding: serializeEmbedding(
          row.embedding as ArrayBuffer | Uint8Array | number[] | null,
        ),
      };
    },
  },
  questions: {
    table: "questions",
    select:
      "id, content, domain, status, created_at, embedding, embedding_model",
    textColumn: "content",
    orderBy: "created_at DESC",
    touchColumn: "updated_at",
    format(row: Record<string, unknown>) {
      return {
        id: row.id,
        content: row.content,
        domain: row.domain,
        status: row.status,
        created_at: row.created_at,
        embedding_model: row.embedding_model,
        embedding: serializeEmbedding(
          row.embedding as ArrayBuffer | Uint8Array | number[] | null,
        ),
      };
    },
  },
  history: {
    table: "history",
    select:
      "id, type, content, internal, created_at, embedding, embedding_model",
    // Type-specific text extraction:
    // - exist, note_saved: Use internal (the actual reflection/content)
    // - thought, message_*, etc: Use content (internal is just a brief annotation)
    //
    // BUG-011 FIX/DOCUMENTATION: SQL CASE Expression as Column Name Pattern
    // ═══════════════════════════════════════════════════════════════════════
    // This textColumn value is a SQL CASE expression, NOT a simple column name.
    // It's used in SELECT clauses like: `SELECT ${config.textColumn} AS text_content FROM ...`
    //
    // WHY THIS PATTERN:
    // - History entries have semantically different text locations based on type
    // - 'exist' and 'note_saved' entries have the meaningful content in `internal`
    // - Most other types have meaningful content in `content`
    //
    // FRAGILITY WARNING:
    // - If DB schema changes column names, this expression breaks silently
    // - The CASE expression is evaluated by SQLite, not JavaScript
    // - Unit tests should verify this pattern works: see sim.test.ts for coverage
    //
    // ALTERNATIVE CONSIDERED: Post-process in JavaScript
    // - Pros: More explicit, easier to debug
    // - Cons: Requires fetching both columns always, more data transfer
    // - Decision: Keep SQL-side for efficiency (we may have many history rows)
    textColumn:
      "CASE WHEN type IN ('exist', 'note_saved') THEN COALESCE(internal, content) ELSE content END",
    orderBy: "created_at DESC",
    touchColumn: null,
    format(row: Record<string, unknown>) {
      return {
        id: row.id,
        type: row.type,
        content: row.content,
        internal: row.internal,
        created_at: row.created_at,
        embedding_model: row.embedding_model,
        embedding: serializeEmbedding(
          row.embedding as ArrayBuffer | Uint8Array | number[] | null,
        ),
      };
    },
  },
};

// ============================================================================
// CONCEPT AXES
// ============================================================================

/**
 * @description Get all active concept axes
 *
 * Returns axes sorted by name for consistent display.
 *
 * @upstream Called by: SIM routes, axis management UI
 * @downstream Calls: personaAll(), formatAxisRow()
 *
 * @param db - Database instance
 * @param options - Persona options
 * @returns Array of parsed concept axes
 *
 * @example
 * const axes = await getAxes(db);
 * // [{ name: 'playfulness', positive_examples: ['...'], ... }]
 */
export async function getAxes(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<ConceptAxis[]> {
  const personaId = await getActivePersonaId(db);
  const rows = await db
    .select()
    .from(simConceptAxes)
    .where(
      and(
        eq(simConceptAxes.personaId, personaId),
        eq(simConceptAxes.isActive, 1),
      ),
    )
    .orderBy(asc(simConceptAxes.name))
    .all();
  return rows
    .map(toConceptAxisRow)
    .map(formatAxisRow)
    .filter((a): a is ConceptAxis => a !== null);
}

/**
 * @description Get a single concept axis by ID
 *
 * @upstream Called by: Axis detail views, update operations
 * @downstream Calls: personaFirst(), formatAxisRow()
 *
 * @param db - Database instance
 * @param id - Axis ID
 * @param options - Persona options
 * @returns Parsed concept axis or null
 */
export async function getAxisById(
  db: DrizzleD1,
  id: number,
  options: PersonaOptions = {},
): Promise<ConceptAxis | null> {
  const personaId = await getActivePersonaId(db);
  const row = await db
    .select()
    .from(simConceptAxes)
    .where(
      and(eq(simConceptAxes.personaId, personaId), eq(simConceptAxes.id, id)),
    )
    .get();
  return formatAxisRow(row ? toConceptAxisRow(row) : null);
}

/**
 * @description Create a new concept axis
 *
 * @upstream Called by: SIM routes, axis training flows
 * @downstream Calls: insertWithPersona(), embeddingToBlob()
 *
 * @param db - Database instance
 * @param data - Axis creation data
 * @param options - Persona options
 * @returns D1 result with last_row_id for new axis
 *
 * @example
 * const result = await createAxis(db, {
 *   name: 'playfulness',
 *   description: 'Lighthearted vs serious tone',
 *   positiveExamples: ['Whee!', 'That is hilarious'],
 *   negativeExamples: ['This is serious', 'We must consider']
 * });
 */
export async function createAxis(
  db: DrizzleD1,
  data: CreateAxisInput,
  options: PersonaOptions = {},
): Promise<RunResult> {
  const positiveExamples = Array.isArray(data?.positiveExamples)
    ? data.positiveExamples
    : [];
  const negativeExamples = Array.isArray(data?.negativeExamples)
    ? data.negativeExamples
    : [];

  // Handle conceptVector - could be Float32Array or number[]
  let vectorBlob: ArrayBuffer | null = null;
  if (data?.conceptVector) {
    const vec =
      data.conceptVector instanceof Float32Array
        ? data.conceptVector
        : new Float32Array(data.conceptVector);
    vectorBlob = embeddingToBlob(vec);
  }

  const personaId = await getActivePersonaId(db);
  return db
    .insert(simConceptAxes)
    .values({
      personaId,
      name: data?.name,
      description: data?.description ?? null,
      positiveExamples: JSON.stringify(positiveExamples),
      negativeExamples: JSON.stringify(negativeExamples),
      conceptVector: vectorBlob,
      vectorModel: data?.vectorModel ?? "bge-base-en-v1.5",
      isActive:
        typeof data?.isActive === "number"
          ? data.isActive
          : data?.isActive === false
            ? 0
            : 1,
    })
    .run() as Promise<RunResult>;
}

/**
 * @description Update an existing concept axis
 *
 * @upstream Called by: SIM routes, axis training flows
 * @downstream Calls: getActivePersonaId(), embeddingToBlob()
 *
 * @param db - Database instance
 * @param id - Axis ID
 * @param updates - Fields to update
 * @param options - Persona options
 * @returns Success indicator
 */
export async function updateAxis(
  db: DrizzleD1,
  id: number,
  updates: UpdateAxisInput,
  options: PersonaOptions = {},
): Promise<{ success: boolean; error?: string }> {
  if (!updates || Object.keys(updates).length === 0) {
    return { success: false, error: "No updates provided" };
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const column = AXIS_COLUMN_MAP[key] || key;

    if (column === "positive_examples") {
      setClauses.push("positive_examples = ?");
      values.push(JSON.stringify(Array.isArray(value) ? value : []));
      continue;
    }
    if (column === "negative_examples") {
      setClauses.push("negative_examples = ?");
      values.push(JSON.stringify(Array.isArray(value) ? value : []));
      continue;
    }
    if (column === "concept_vector") {
      setClauses.push("concept_vector = ?");
      if (value) {
        const vec =
          value instanceof Float32Array
            ? value
            : new Float32Array(value as number[]);
        values.push(embeddingToBlob(vec));
      } else {
        values.push(null);
      }
      continue;
    }
    if (column === "is_active") {
      setClauses.push("is_active = ?");
      values.push(value ? 1 : 0);
      continue;
    }
    setClauses.push(`${column} = ?`);
    values.push(value ?? null);
  }

  if (setClauses.length === 0) {
    return { success: false, error: "No valid fields to update" };
  }

  setClauses.push('updated_at = datetime("now")');
  const personaId = await getActivePersonaId(db);
  values.push(id, personaId);

  const raw = db.$client;
  const result = await raw
    .prepare(
      `UPDATE sim_concept_axes SET ${setClauses.join(", ")} WHERE id = ? AND persona_id = ?`,
    )
    .bind(...values)
    .run();

  return { success: result.meta.changes > 0 };
}

/**
 * @description Delete a concept axis
 *
 * @upstream Called by: SIM routes
 * @downstream Calls: getActivePersonaId()
 *
 * @param db - Database instance
 * @param id - Axis ID
 * @param options - Persona options
 * @returns D1 result
 */
export async function deleteAxis(
  db: DrizzleD1,
  id: number,
  options: PersonaOptions = {},
): Promise<RunResult> {
  const personaId = await getActivePersonaId(db);
  const raw = db.$client;
  return raw
    .prepare("DELETE FROM sim_concept_axes WHERE id = ? AND persona_id = ?")
    .bind(id, personaId)
    .run();
}

// ============================================================================
// AXIS SCORES
// ============================================================================

/**
 * @description Get all scores for a specific content entry
 *
 * Returns scores with axis names joined for display.
 *
 * @upstream Called by: Content detail views, SIM analysis
 * @downstream Calls: personaAll()
 *
 * @param db - Database instance
 * @param targetTable - Source table (summaries, history, etc.)
 * @param targetId - Row ID in source table
 * @param options - Persona options
 * @returns Array of axis scores with names
 */
export async function getScoresForEntry(
  db: DrizzleD1,
  targetTable: string,
  targetId: number,
  options: PersonaOptions = {},
): Promise<AxisScore[]> {
  const personaId = await getActivePersonaId(db);
  const rows = await db
    .select({
      id: simAxisScores.id,
      persona_id: simAxisScores.personaId,
      axis_id: simAxisScores.axisId,
      target_table: simAxisScores.targetTable,
      target_id: simAxisScores.targetId,
      score: simAxisScores.score,
      percentile: simAxisScores.percentile,
      created_at: simAxisScores.createdAt,
      axis_name: simConceptAxes.name,
    })
    .from(simAxisScores)
    .innerJoin(simConceptAxes, eq(simAxisScores.axisId, simConceptAxes.id))
    .where(
      and(
        eq(simAxisScores.personaId, personaId),
        eq(simAxisScores.targetTable, targetTable),
        eq(simAxisScores.targetId, targetId),
      ),
    )
    .orderBy(asc(simConceptAxes.name))
    .all();
  return rows as AxisScore[];
}

/**
 * @description Upsert a single axis score
 *
 * Creates or updates the score for a content entry on an axis.
 *
 * @upstream Called by: SIM scoring pipelines
 * @downstream Calls: getActivePersonaId()
 *
 * @param db - Database instance
 * @param axisId - Concept axis ID
 * @param targetTable - Source table
 * @param targetId - Row ID
 * @param score - Score value
 * @param percentile - Optional percentile
 * @param options - Persona options
 * @returns D1 result
 */
export async function upsertScore(
  db: DrizzleD1,
  axisId: number,
  targetTable: string,
  targetId: number,
  score: number,
  percentile?: number | null,
  options: PersonaOptions = {},
): Promise<RunResult> {
  const personaId = await getActivePersonaId(db);
  const raw = db.$client;
  return raw
    .prepare(
      `
    INSERT INTO sim_axis_scores (persona_id, axis_id, target_table, target_id, score, percentile)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(axis_id, target_table, target_id)
    DO UPDATE SET score = excluded.score, percentile = excluded.percentile
  `,
    )
    .bind(personaId, axisId, targetTable, targetId, score, percentile ?? null)
    .run();
}

/**
 * @description Batch upsert multiple axis scores
 *
 * Efficiently insert/update many scores at once.
 *
 * @upstream Called by: Batch scoring pipelines
 * @downstream Calls: getActivePersonaId(), db.batch()
 *
 * @param db - Database instance
 * @param scores - Array of score inputs
 * @param options - Persona options
 * @returns Array of D1 results
 */
export async function batchUpsertScores(
  db: DrizzleD1,
  scores: UpsertScoreInput[],
  options: PersonaOptions = {},
): Promise<RunResult[]> {
  if (!Array.isArray(scores) || scores.length === 0) {
    return [];
  }
  const personaId = await getActivePersonaId(db);
  const raw = db.$client;
  const stmt = raw.prepare(`
    INSERT INTO sim_axis_scores (persona_id, axis_id, target_table, target_id, score, percentile)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(axis_id, target_table, target_id)
    DO UPDATE SET score = excluded.score, percentile = excluded.percentile
  `);

  const prepared = scores.map((score) =>
    stmt.bind(
      personaId,
      score.axisId,
      score.targetTable,
      score.targetId,
      score.score,
      score.percentile ?? null,
    ),
  );

  if (typeof raw.batch === "function") {
    return raw.batch(prepared) as Promise<RunResult[]>;
  }

  // Fallback for environments without batch
  const results: RunResult[] = [];
  for (const statement of prepared) {
    results.push(await statement.run());
  }
  return results;
}

// ============================================================================
// BASIN METRICS
// ============================================================================

/**
 * @description Get basin metrics for a metric type
 *
 * Basin metrics track the distribution of embeddings for anomaly detection.
 * In the live schema, `sim_basin_metrics` is effectively a latest-row cache per
 * `metric_type` because the backing migration created `UNIQUE(persona_id, metric_type)`.
 * Read the migration and reality, not the older append-only narrative.
 *
 * @upstream Called by: Anomaly detection pipelines
 * @downstream Calls: personaFirst(), blobToEmbedding()
 *
 * @param db - Database instance
 * @param metricType - Type of metric (e.g., 'global', 'axis:playfulness')
 * @param options - Persona options
 * @returns Parsed basin metrics or null
 */
export async function getBasinMetrics(
  db: DrizzleD1,
  metricType: string = "global",
  options: PersonaOptions = {},
): Promise<BasinMetrics | null> {
  const personaId = await getActivePersonaId(db);
  const row = await db
    .select()
    .from(simBasinMetrics)
    .where(
      and(
        eq(simBasinMetrics.personaId, personaId),
        eq(simBasinMetrics.metricType, metricType),
      ),
    )
    .orderBy(desc(simBasinMetrics.computedAt), desc(simBasinMetrics.id))
    .get();
  if (!row) return null;
  const typedRow = toBasinMetricsRow(row);
  return {
    ...typedRow,
    centroid: typedRow.centroid ? blobToEmbedding(typedRow.centroid) : null,
    metadata: safeJsonParse(
      typedRow.metadata,
      {},
      `basin_metrics[${metricType}].metadata`,
    ),
  };
}

/**
 * @description Write the latest basin metrics row for a metric type.
 *
 * The live table has `UNIQUE(persona_id, metric_type)` in the worker migration,
 * so this helper updates the latest cache row for that metric type rather than
 * appending historical series rows.
 *
 * @upstream Called by: Basin recomputation pipelines
 * @downstream Calls: getActivePersonaId(), embeddingToBlob()
 *
 * @param db - Database instance
 * @param metricType - Type of metric
 * @param metrics - Metrics data
 * @param options - Persona options
 * @returns D1 result
 */
export async function upsertBasinMetrics(
  db: DrizzleD1,
  metricType: string,
  metrics: UpsertBasinMetricsInput,
  options: PersonaOptions = {},
): Promise<RunResult> {
  const personaId = await getActivePersonaId(db);

  // Handle centroid - could be Float32Array or number[]
  let centroidBlob: ArrayBuffer | null = null;
  if (metrics?.centroid) {
    const vec =
      metrics.centroid instanceof Float32Array
        ? metrics.centroid
        : new Float32Array(metrics.centroid);
    centroidBlob = embeddingToBlob(vec);
  }

  const raw = db.$client;
  const statement = raw.prepare(`
    INSERT INTO sim_basin_metrics (
      persona_id,
      metric_type,
      centroid,
      mean_distance,
      std_distance,
      outlier_threshold,
      sample_count,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(persona_id, metric_type)
    DO UPDATE SET
      centroid = excluded.centroid,
      mean_distance = excluded.mean_distance,
      std_distance = excluded.std_distance,
      outlier_threshold = excluded.outlier_threshold,
      sample_count = excluded.sample_count,
      metadata = excluded.metadata,
      computed_at = datetime('now')
  `);

  return statement
    .bind(
      personaId,
      metricType,
      centroidBlob,
      metrics?.meanDistance ?? null,
      metrics?.stdDistance ?? null,
      metrics?.outlierThreshold ?? null,
      metrics?.sampleCount ?? null,
      JSON.stringify(metrics?.metadata || {}),
    )
    .run();
}

// ============================================================================
// ANOMALY TRACKING
// ============================================================================

/**
 * @description Get anomaly flags
 *
 * Returns flagged content that may deviate from identity patterns.
 *
 * @upstream Called by: Anomaly review UI, SIM routes
 * @downstream Calls: personaAll()
 *
 * @param db - Database instance
 * @param filters - Query filters
 * @param options - Persona options
 * @returns Array of parsed anomaly flags
 */
export async function getAnomalies(
  db: DrizzleD1,
  filters: AnomalyFilters = {},
  options: PersonaOptions = {},
): Promise<AnomalyFlag[]> {
  const { unresolvedOnly = false, limit: queryLimit = 100 } = filters;
  const personaId = await getActivePersonaId(db);

  const conditions = [eq(simAnomalyFlags.personaId, personaId)];
  if (unresolvedOnly) {
    conditions.push(eq(simAnomalyFlags.inspected, 0));
  }

  const rows = await db
    .select()
    .from(simAnomalyFlags)
    .where(and(...conditions))
    .orderBy(desc(simAnomalyFlags.createdAt))
    .limit(queryLimit)
    .all();

  return rows.map(toAnomalyFlagRow).map((row) => ({
    ...row,
    flagged_axes: parseExamples(
      row.flagged_axes,
      `anomaly[${row.id}].flagged_axes`,
    ),
  }));
}

/**
 * @description Create a new anomaly flag
 *
 * @upstream Called by: Anomaly detection pipelines
 * @downstream Calls: insertWithPersona()
 *
 * @param db - Database instance
 * @param data - Anomaly data
 * @param options - Persona options
 * @returns D1 result with last_row_id
 */
export async function createAnomaly(
  db: DrizzleD1,
  data: CreateAnomalyInput,
  options: PersonaOptions = {},
): Promise<RunResult> {
  const personaId = await getActivePersonaId(db);
  return db
    .insert(simAnomalyFlags)
    .values({
      personaId,
      targetTable: data?.targetTable,
      targetId: data?.targetId,
      basinDistance: data?.basinDistance ?? null,
      zScore: data?.zScore ?? null,
      flaggedAxes: JSON.stringify(
        Array.isArray(data?.flaggedAxes) ? data.flaggedAxes : [],
      ),
      detectionMethod: data?.detectionMethod ?? null,
    })
    .run() as Promise<RunResult>;
}

/**
 * @description Update an anomaly flag
 *
 * Used to mark anomalies as inspected or resolved.
 *
 * @upstream Called by: Anomaly review flows
 * @downstream Calls: getActivePersonaId()
 *
 * @param db - Database instance
 * @param id - Anomaly ID
 * @param updates - Fields to update
 * @param options - Persona options
 * @returns D1 result
 */
export async function updateAnomaly(
  db: DrizzleD1,
  id: number,
  updates: UpdateAnomalyInput,
  options: PersonaOptions = {},
): Promise<RunResult> {
  const personaId = await getActivePersonaId(db);
  const inspectedValue =
    updates?.inspected === undefined ? null : updates.inspected ? 1 : 0;

  const raw = db.$client;
  return raw
    .prepare(
      `
    UPDATE sim_anomaly_flags
    SET inspected = COALESCE(?, inspected),
        verdict = COALESCE(?, verdict),
        notes = COALESCE(?, notes),
        resolved_at = COALESCE(?, resolved_at)
    WHERE id = ? AND persona_id = ?
  `,
    )
    .bind(
      inspectedValue,
      updates?.verdict ?? null,
      updates?.notes ?? null,
      updates?.resolvedAt ?? null,
      id,
      personaId,
    )
    .run();
}

// ============================================================================
// EMBEDDING HELPERS
// ============================================================================

/**
 * @description Export embeddings from specified tables
 *
 * Returns formatted rows with serialized embeddings for external processing.
 *
 * @upstream Called by: SIM training pipelines, data export
 * @downstream Calls: personaAll(), SIM_EMBEDDING_TABLES.format()
 *
 * @param db - Database instance
 * @param tables - Table names to export
 * @param options - Query options including limit
 * @returns Object with table names as keys, formatted rows as values
 */
export async function getEmbeddingsExport(
  db: DrizzleD1,
  tables: EmbeddingTableName[],
  options: SimQueryOptions = {},
): Promise<EmbeddingsExportResult> {
  const limit =
    typeof options.limit === "number" ? Math.max(1, options.limit) : 1000;
  const uniqueTables = [...new Set(tables)].filter(
    (table) => SIM_EMBEDDING_TABLES[table],
  );
  const results: EmbeddingsExportResult = {};

  const personaId = await getActivePersonaId(db);

  const raw = db.$client;
  for (const key of uniqueTables) {
    const config = SIM_EMBEDDING_TABLES[key];
    const queryResult = await raw
      .prepare(
        `SELECT ${config.select}
       FROM ${config.table}
       WHERE persona_id = ? AND embedding IS NOT NULL
       ORDER BY ${config.orderBy}
       LIMIT ?`,
      )
      .bind(personaId, limit)
      .all<Record<string, unknown>>();
    // TypeScript needs explicit casting here
    (results as Record<string, unknown[]>)[key] = (
      queryResult.results || []
    ).map(config.format);
  }

  return results;
}

/**
 * @description Get embedding coverage statistics for all tables
 *
 * Reports how many rows have embeddings vs total rows per table.
 *
 * @upstream Called by: SIM dashboard, health checks
 * @downstream Calls: personaFirst()
 *
 * @param db - Database instance
 * @param options - Persona options
 * @returns Coverage stats keyed by table name
 */
export async function getEmbeddingsCoverage(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<EmbeddingsCoverage> {
  const tables = Object.keys(SIM_EMBEDDING_TABLES) as EmbeddingTableName[];
  const coverage = {} as EmbeddingsCoverage;

  const personaId = await getActivePersonaId(db);

  const raw = db.$client;
  for (const table of tables) {
    const total = await raw
      .prepare(`SELECT COUNT(*) as count FROM ${table} WHERE persona_id = ?`)
      .bind(personaId)
      .first<{ count: number }>();
    const withEmbedding = await raw
      .prepare(
        `SELECT COUNT(*) as count FROM ${table} WHERE persona_id = ? AND embedding IS NOT NULL`,
      )
      .bind(personaId)
      .first<{ count: number }>();

    const totalCount = Number(total?.count || 0);
    const withCount = Number(withEmbedding?.count || 0);
    const percent =
      totalCount > 0 ? Number(((withCount / totalCount) * 100).toFixed(2)) : 0;

    coverage[table] = {
      total: totalCount,
      withEmbedding: withCount,
      percent,
    } satisfies TableCoverageStats;
  }

  return coverage;
}

// ============================================================================
// COMPUTATION HELPERS (pure math, no DB)
// ============================================================================

export {
  computeBasinMetrics,
  computeEntryStats,
  analyzeTrend,
  getIsoWeekKey,
  computeCentroidDistance,
  computeCrossTypeCentroidDistances,
  computeWeeklyBasinBuckets,
} from "./compute";

// ============================================================================
// ROUTE HANDLERS
// ============================================================================
// SIM route handlers live in ./routes.ts — import separately to avoid circular deps:
//   import { handleGetBasin, ... } from '@persistence/memory/sim/routes';
// They are NOT re-exported here because they import from this barrel.
// ============================================================================
