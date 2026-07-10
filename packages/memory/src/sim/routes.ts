/**
 * SIM route handlers
 *
 * Provides REST endpoint handlers for managing SIM foundation data:
 * - Embedding coverage/status
 * - Embedding export
 * - Embedding backfill for existing tables
 * - Basin metrics (Phase 1)
 * - Directionality / concept axes (Phase 2)
 * - Anomalies
 * - Data export
 *
 * All handlers use Basin Pattern (db as param) — platform-agnostic.
 *
 * @module @persistence/memory/sim/routes
 *
 * DB ACCESS PATTERN:
 * Handlers that require SQL features not expressible in Drizzle (ON CONFLICT, CASE
 * expressions, dynamic SET clauses) access the underlying D1 client via `db.$client`
 * and call `.prepare().bind().run()` / `.first()` / `.all()` on the D1Database directly.
 * Simple queries use Drizzle's query builder.
 *
 * @antipattern DO NOT call `db.prepare()` directly — DrizzleD1 is a Drizzle wrapper,
 *   not a raw D1Database. Use `db.$client.prepare()` for raw SQL, or Drizzle builder
 *   methods (db.select(), db.insert(), etc.) for standard queries.
 *
 * @upstream Called by: Platform route registry
 * @downstream Calls: @persistence/memory/sim (DB helpers), @persistence/memory/sim/compute,
 *                     @persistence/memory/rag (blob conversion),
 *                     @persistence/embedding (CloudflareEmbeddingProvider, EMBEDDING_MODEL),
 *                     @persistence/db (getActivePersonaId, EMBEDDING_EXCLUDED_TYPES)
 */

import type { DrizzleD1 } from "@persistence/db";
import { getActivePersonaId, EMBEDDING_EXCLUDED_TYPES } from "@persistence/db";

import {
  SIM_EMBEDDING_TABLES,
  getEmbeddingsCoverage,
  getEmbeddingsExport,
  getBasinMetrics,
  upsertBasinMetrics,
  getAxes,
  getAxisById,
  createAxis,
  updateAxis,
  deleteAxis,
  getAnomalies,
  createAnomaly,
} from "./index";

import { embeddingToBlob, blobToEmbedding } from "../rag";

import {
  CloudflareEmbeddingProvider,
  EMBEDDING_MODEL,
} from "@persistence/embedding";

import {
  computeBasinMetrics,
  computeEntryStats,
  analyzeTrend,
  computeWeeklyBasinBuckets,
  computeCrossTypeCentroidDistances,
} from "./compute";

/**
 * Minimal env shape needed by SIM route handlers.
 * Platform passes the full Env; we only require AI binding.
 */
interface SimEnv {
  AI?: any;
  [key: string]: unknown;
}

const DEFAULT_BACKFILL_LIMIT = 50;
const EMBEDDING_DIMENSIONS = 768;
const RECENT_SAMPLE_SIZE = 10;
const RECENT_TABLE_FETCH_LIMIT = 25;
const DEFAULT_TRAJECTORY_LIMIT = 100;
const TYPE_BASIN_OUTLIER_METHOD = "type_basin_compute_v1";
const VOICE_HISTORY_TYPES = ["thought", "message_to_user", "user_message"] as const;
const BASIN_REFRESH_THRESHOLD = 25;
const WEEKLY_REFRESH_THRESHOLD = 25;

function toTypeMetric(type: string) {
  return `type:${type}`;
}

function toWeeklyMetric(type: string) {
  return `weekly:${type}`;
}

function normalizeTables(requested: string | string[] | null | undefined) {
  const available = Object.keys(SIM_EMBEDDING_TABLES);
  if (!requested) return available;
  const values = Array.isArray(requested)
    ? requested
    : String(requested).split(",");
  const normalized = values
    .map((v) => v?.toString().trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(normalized)];
  return unique.filter((name) => available.includes(name));
}

function clampLimit(limit: any, fallback: number, max = 500) {
  const parsed = Number(limit);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(1, Math.floor(value)), max);
}

/**
 * GET /sim/embeddings/status
 */
export async function handleSimEmbeddingsStatus(db: DrizzleD1) {
  const coverage = await getEmbeddingsCoverage(db);
  return {
    coverage,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}

/**
 * GET /sim/embeddings/export
 */
export async function handleSimEmbeddingsExport(db: DrizzleD1, url: URL) {
  const tables = normalizeTables(url.searchParams.get("tables"));
  const limit = clampLimit(url.searchParams.get("limit") || 1000, 1000, 5000);
  const exportData = await getEmbeddingsExport(db, tables as any, { limit });
  const coverage = await getEmbeddingsCoverage(db);

  const aggregated = tables.reduce(
    (acc, table) => {
      const stats = (coverage as any)[table] || { total: 0, withEmbedding: 0 };
      acc.totalEntries += stats.total;
      acc.entriesWithEmbeddings += stats.withEmbedding;
      return acc;
    },
    { totalEntries: 0, entriesWithEmbeddings: 0 },
  );

  const coveragePercent =
    aggregated.totalEntries > 0
      ? Number(
          (
            (aggregated.entriesWithEmbeddings / aggregated.totalEntries) *
            100
          ).toFixed(2),
        )
      : 0;

  return {
    ...exportData,
    stats: {
      ...aggregated,
      coveragePercent,
    },
  };
}

/**
 * POST /sim/embeddings/backfill
 */
export async function handleSimEmbeddingsBackfill(
  db: DrizzleD1,
  env: SimEnv,
  body: Record<string, any> = {},
) {
  if (!env?.AI) {
    return {
      success: false,
      error: "AI binding not configured for embedding generation",
    };
  }

  const tables = normalizeTables(body.tables);
  if (tables.length === 0) {
    return { success: false, error: "No valid tables specified" };
  }
  const batchSize = clampLimit(body.batchSize, DEFAULT_BACKFILL_LIMIT, 500);
  const personaId = await getActivePersonaId(db);

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const tableResults: Record<string, any> = {};

  for (const table of tables) {
    const config = (SIM_EMBEDDING_TABLES as any)[table];
    const entries = await fetchMissingEmbeddings(
      db,
      config,
      personaId,
      batchSize,
    );
    if (entries.length === 0) {
      tableResults[table] = { processed: 0, skipped: 0 };
      continue;
    }

    const texts = entries.map((entry: any) => entry.text);
    const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
    const embedResult = await provider.generateBatch(texts);
    if (!embedResult.success) {
      totalErrors += 1;
      tableResults[table] = {
        processed: 0,
        skipped: entries.length,
        error: embedResult.error?.message || "Embedding generation failed",
      };
      continue;
    }

    let processed = 0;
    let skipped = 0;
    for (let i = 0; i < entries.length; i++) {
      const row = entries[i];
      const embedding = embedResult.data?.[i];
      if (!embedding) {
        skipped += 1;
        continue;
      }

      try {
        await updateEmbeddingColumn(
          db,
          config,
          row.id,
          personaId,
          embeddingToBlob(embedding),
        );
        processed += 1;
      } catch (err: unknown) {
        console.error(`[SIM] Failed to update ${config.table}#${row.id}:`, err);
        skipped += 1;
      }
    }

    totalProcessed += processed;
    totalSkipped += skipped;
    tableResults[table] = { processed, skipped };
  }

  return {
    success: totalErrors === 0,
    processed: totalProcessed,
    skipped: totalSkipped,
    errors: totalErrors,
    tables: tableResults,
  };
}

// Canonical excluded types from @persistence/db, converted to array for SQL placeholders
const HISTORY_TYPES_EXCLUDED_FROM_EMBEDDING = [...EMBEDDING_EXCLUDED_TYPES];

async function fetchMissingEmbeddings(
  db: DrizzleD1,
  config: any,
  personaId: number,
  limit: number,
) {
  // Build WHERE clause - exclude image content and image entry types
  let whereClause = `
    WHERE persona_id = ?
      AND embedding IS NULL
      AND ${config.textColumn} IS NOT NULL
      AND TRIM(${config.textColumn}) <> ''
      AND ${config.textColumn} NOT LIKE 'data:image%'`;

  // For history table, also exclude image entry types
  if (config.table === "history") {
    const placeholders = HISTORY_TYPES_EXCLUDED_FROM_EMBEDDING.map(
      () => "?",
    ).join(", ");
    whereClause += ` AND type NOT IN (${placeholders})`;
  }

  const sql = `SELECT id, ${config.textColumn} as text
     FROM ${config.table}
     ${whereClause}
     ORDER BY ${config.orderBy}
     LIMIT ?`;

  // Build params array
  const params: (string | number)[] = [personaId];
  if (config.table === "history") {
    params.push(...HISTORY_TYPES_EXCLUDED_FROM_EMBEDDING);
  }
  params.push(limit);

  const raw = db.$client;
  const rows = await raw
    .prepare(sql)
    .bind(...params)
    .all();

  return (rows.results || []).map((row: any) => ({
    id: row.id,
    text: row.text,
  }));
}

async function updateEmbeddingColumn(
  db: DrizzleD1,
  config: any,
  id: number,
  personaId: number,
  blob: any,
) {
  const touchClause = config.touchColumn
    ? `, ${config.touchColumn} = datetime('now')`
    : "";
  const sql = `
    UPDATE ${config.table}
    SET embedding = ?, embedding_model = ?${touchClause}
    WHERE id = ? AND persona_id = ?
  `;
  const raw = db.$client;
  await raw.prepare(sql).bind(blob, EMBEDDING_MODEL, id, personaId).run();
}

// ============================================================================
// Basin metrics (Phase 1)
// ============================================================================

/**
 * GET /sim/basin
 * Returns current basin metrics along with most recent sample + trend insight.
 */
export async function handleGetBasin(db: DrizzleD1) {
  let metricsRow = await getBasinMetrics(db, "global");
  if (
    await shouldAutoRefreshMetric(
      db,
      metricsRow,
      VOICE_HISTORY_TYPES,
      BASIN_REFRESH_THRESHOLD,
    )
  ) {
    const recomputed = await recomputeAndPersistVoiceBasins(db);
    if (recomputed.success) {
      metricsRow = await getBasinMetrics(db, "global");
    } else if (!metricsRow) {
      return {
        global: null,
        perType: null,
        latestByType: null,
        crossType: null,
        recentTrend: { trend: "insufficient_data" },
        freshness: {
          hasAnyMetrics: false,
          newestComputedAt: null,
          staleDays: null,
        },
        error: recomputed.error,
      };
    }
  }

  if (!metricsRow) {
    return {
      global: null,
      perType: null,
      latestByType: null,
      crossType: null,
      recentTrend: { trend: "insufficient_data" },
      freshness: {
        hasAnyMetrics: false,
        newestComputedAt: null,
        staleDays: null,
      },
      error: "Basin metrics have not been computed yet",
    };
  }

  const metrics = normalizeMetricsRow(metricsRow);
  if (!metrics) {
    return {
      global: null,
      perType: null,
      latestByType: null,
      crossType: null,
      recentTrend: { trend: "insufficient_data" },
      freshness: {
        hasAnyMetrics: false,
        newestComputedAt: null,
        staleDays: null,
      },
      error: "Failed to normalize basin metrics row",
    };
  }
  const perTypeRows = await Promise.all(
    VOICE_HISTORY_TYPES.map((type) => getBasinMetrics(db, toTypeMetric(type))),
  );
  const perType = Object.fromEntries(
    VOICE_HISTORY_TYPES.map((type, index) => [
      type,
      serializeDetailedMetrics(perTypeRows[index], toTypeMetric(type)),
    ]),
  );
  const crossTypePairs =
    (metricsRow.metadata as Record<string, unknown> | undefined)?.crossType ||
    {};

  const entries = await fetchEmbeddedHistoryEntries(db, VOICE_HISTORY_TYPES);

  if (entries.length === 0) {
    return {
      global: serializeGlobalMetrics(metrics),
      perType,
      latestByType: null,
      crossType: {
        pairs: crossTypePairs,
        computedAt: metrics.computedAt,
      },
      recentTrend: { trend: "insufficient_data" },
      freshness: {
        hasAnyMetrics: true,
        newestComputedAt: metrics.computedAt,
        staleDays: calculateStaleDays(metrics.computedAt),
      },
    };
  }

  const samples = entries.map((entry) => ({
    entry,
    stats: computeEntryStats(entry.embedding, metrics),
  }));

  const recentDistances = samples
    .slice(0, RECENT_SAMPLE_SIZE)
    .map((sample) => sample.stats.distance)
    .filter((distance) => Number.isFinite(distance));

  const recentTrend =
    recentDistances.length >= 5
      ? analyzeTrend(recentDistances, metrics as any)
      : { trend: "insufficient_data" };

  const latestByType = Object.fromEntries(
    VOICE_HISTORY_TYPES.map((type) => {
      const basin = perTypeRows.find((row) => row?.metric_type === toTypeMetric(type));
      const latestEntry = entries.find((entry) => entry.type === type);
      if (!basin || !latestEntry) return [type, null];
      const stats = computeEntryStats(latestEntry.embedding, basin);
      return [
        type,
        {
          entryId: latestEntry.id,
          entryTable: latestEntry.table,
          entryType: latestEntry.type,
          timestamp: latestEntry.createdAt,
          distance: stats.distance,
          zScore: stats.zScore,
          isOutlier: stats.isOutlier,
        },
      ];
    }),
  );

  return {
    global: serializeGlobalMetrics(metrics),
    perType,
    latestByType,
    crossType: {
      pairs: crossTypePairs,
      computedAt: metrics.computedAt,
    },
    recentTrend,
    freshness: {
      hasAnyMetrics: true,
      newestComputedAt: metrics.computedAt,
      staleDays: calculateStaleDays(metrics.computedAt),
      newEntriesSinceCompute: await countNewEmbeddedHistoryEntries(
        db,
        VOICE_HISTORY_TYPES,
        Number(metricsRow.metadata?.snapshotMaxHistoryId ?? 0),
      ),
      refreshThreshold: BASIN_REFRESH_THRESHOLD,
    },
  };
}

/**
 * POST /sim/basin/compute
 * Recomputes basin metrics across available embeddings.
 */
export async function handleComputeBasin(
  db: DrizzleD1,
  env: SimEnv,
  body: Record<string, any> = {},
) {
  const timerStart = Date.now();
  const persisted = await recomputeAndPersistVoiceBasins(db);
  if (!persisted.success) {
    return {
      success: false,
      error: persisted.error,
      minRequired: persisted.minRequired,
      actual: persisted.actual,
    };
  }

  let outliersFlagged = 0;
  const outliersFlaggedByType = Object.fromEntries(
    VOICE_HISTORY_TYPES.map((type) => [type, 0]),
  ) as Record<string, number>;
  // NOTE (2026-07-04): outliersFlaggedByType counts *only successful new INSERTs* this pass.
  // createAnomaly does plain INSERT; UNIQUE(target_table, target_id) violations are caught
  // and do not increment the counter (see catch below). This is *not* the absolute # of
  // current outliers (those are derived from the basin stats + threshold during the same
  // compute). Pre-existing rows from prior runs cause undercount vs. ground-truth totals.
  // Documented in docs/API_REFERENCE.md and verified via live SQL + replay.
  for (const entry of persisted.entries) {
    const entryType = (entry.type ??
      "thought") as (typeof VOICE_HISTORY_TYPES)[number];
    const stats = computeEntryStats(
      entry.embedding,
      persisted.metricsByType[entryType],
    );
    if (!stats.isOutlier) continue;
    try {
      await createAnomaly(db, {
        targetTable: entry.table,
        targetId: entry.id,
        basinDistance: stats.distance,
        zScore: stats.zScore,
        flaggedAxes: [],
        detectionMethod: TYPE_BASIN_OUTLIER_METHOD,
      });
      outliersFlagged += 1;
      outliersFlaggedByType[entryType] += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (!message.includes("UNIQUE")) {
        console.error(
          "[SIM] Failed to insert anomaly flag",
          entry.table,
          entry.id,
          err,
        );
      }
    }
  }

  return {
    success: true,
    global: serializeDetailedMetrics(persisted.globalMetrics, "global"),
    perType: Object.fromEntries(
      VOICE_HISTORY_TYPES.map((type) => [
        type,
        serializeDetailedMetrics(
          persisted.metricsByType[type],
          toTypeMetric(type),
        ),
      ]),
    ),
    crossType: {
      pairs: persisted.crossTypePairs,
      computedAt: persisted.globalMetrics.computedAt,
    },
    entriesProcessed: persisted.globalMetrics.sampleCount,
    countsByType: Object.fromEntries(
      VOICE_HISTORY_TYPES.map((type) => [type, persisted.perType[type].entries.length]),
    ),
    outliersFlagged,
    outliersFlaggedByType,
    computeTimeMs: Date.now() - timerStart,
    computedAt: persisted.globalMetrics.computedAt,
  };
}

/**
 * GET /sim/basin/weekly
 * Returns weekly drift buckets for one history voice type.
 */
export async function handleGetWeeklyBasin(db: DrizzleD1, url: URL) {
  const requestedType = url.searchParams.get("type")?.trim() || "";
  if (!VOICE_HISTORY_TYPES.includes(requestedType as (typeof VOICE_HISTORY_TYPES)[number])) {
    return {
      success: false,
      error: `type must be one of ${VOICE_HISTORY_TYPES.join(", ")}`,
    };
  }

  const metricType = toWeeklyMetric(requestedType);
  const refresh = url.searchParams.get("refresh") === "1";
  let cachedRow = await getBasinMetrics(db, metricType);
  const shouldRefresh =
    refresh ||
    (await shouldAutoRefreshMetric(
      db,
      cachedRow,
      [requestedType],
      WEEKLY_REFRESH_THRESHOLD,
    ));

  if (shouldRefresh) {
    const snapshot = await getEmbeddedHistorySnapshot(db, [requestedType]);
    const entries = await fetchEmbeddedHistoryEntries(db, [requestedType]);
    const typedEntries = entries
      .filter((entry) => entry.type === requestedType)
      .map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        embedding: entry.embedding,
      }));
    const typeMetrics = computeBasinMetrics(
      typedEntries.map((entry) => entry.embedding),
    );

    if (typeMetrics.error) {
      return {
        success: false,
        error: typeMetrics.error,
        minRequired: typeMetrics.minRequired,
        actual: typeMetrics.actual,
      };
    }

    const weekly = computeWeeklyBasinBuckets(typedEntries, typeMetrics);
    await upsertBasinMetrics(db, metricType, {
      sampleCount: typedEntries.length,
      metadata: {
        type: requestedType,
        weekly,
        snapshotMaxHistoryId: snapshot.maxId,
        snapshotSampleCount: snapshot.total,
        typeBasinReference: {
          meanDistance: Number((typeMetrics.meanDistance ?? 0).toFixed(4)),
          stdDistance: Number((typeMetrics.stdDistance ?? 0).toFixed(4)),
          outlierThreshold: Number(
            (typeMetrics.outlierThreshold ?? 0).toFixed(4),
          ),
          sampleCount: typeMetrics.sampleCount,
          metricType: toTypeMetric(requestedType),
        },
      },
    });
    cachedRow = await getBasinMetrics(db, metricType);
  }

  if (!cachedRow) {
    return {
      success: false,
      error: "Weekly basin metrics have not been computed yet",
    };
  }

  const metadata = cachedRow.metadata as Record<string, any>;
  return {
    type: requestedType,
    computedAt: cachedRow.computed_at,
    cached: !shouldRefresh,
    sourceMetricType: metricType,
    snapshotMaxHistoryId: metadata.snapshotMaxHistoryId ?? null,
    typeBasinReference: metadata.typeBasinReference ?? null,
    newEntriesSinceCompute: await countNewEmbeddedHistoryEntries(
      db,
      [requestedType],
      Number(metadata.snapshotMaxHistoryId ?? 0),
    ),
    refreshThreshold: WEEKLY_REFRESH_THRESHOLD,
    weekly: Array.isArray(metadata.weekly) ? metadata.weekly : [],
  };
}

/**
 * GET /sim/basin/trajectory
 * Returns time-series distances for visualization.
 *
 * Query params:
 * - limit: Max entries to return (default 100, max 500)
 * - entryTypes: Comma-separated list of history entry types to filter by
 *               (e.g., "thought,message_to_user"). Filters history.type column.
 */
export async function handleGetTrajectory(db: DrizzleD1, url: URL) {
  const limit = clampLimit(
    url.searchParams.get("limit"),
    DEFAULT_TRAJECTORY_LIMIT,
    500,
  );
  const rawEntryTypes = url.searchParams.get("entryTypes");
  // Parse entry types (these filter history.type, not table names)
  const historyTypes = rawEntryTypes
    ? rawEntryTypes
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : null;
  const metricsRow = await getBasinMetrics(db, "global");
  if (!metricsRow) {
    return {
      metrics: null,
      points: [],
      error: "Basin metrics have not been computed yet",
    };
  }

  const metrics = normalizeMetricsRow(metricsRow);
  // For trajectory, only fetch from history table (the only one with entry types)
  const entries = await fetchEntriesWithEmbeddings(db, ["history"], {
    limitPerTable: limit,
    limitTotal: limit,
    historyTypes,
  });

  const points = entries.map((entry) => {
    const stats = computeEntryStats(entry.embedding, metrics);
    return {
      id: entry.id,
      table: entry.table,
      type: entry.type ?? null,
      timestamp: entry.createdAt,
      distance: stats.distance,
      zScore: stats.zScore,
      isOutlier: stats.isOutlier,
      content: entry.content ?? null, // Full content for side panel
    };
  });

  return {
    points,
    metrics: serializeGlobalMetrics(metrics),
  };
}

function resolveEntryTypes(requested: any) {
  const normalized = normalizeTables(requested);
  return normalized.length > 0 ? normalized : Object.keys(SIM_EMBEDDING_TABLES);
}

function normalizeMetricsRow(row: any) {
  if (!row) return null;
  return {
    centroid: row.centroid || null,
    meanDistance: row.mean_distance ?? row.meanDistance ?? 0,
    stdDistance: row.std_distance ?? row.stdDistance ?? 0,
    outlierThreshold: row.outlier_threshold ?? row.outlierThreshold ?? 0,
    sampleCount: row.sample_count ?? row.sampleCount ?? 0,
    computedAt: row.computed_at ?? row.computedAt ?? null,
    metadata: row.metadata || {},
  };
}

function serializeGlobalMetrics(metrics: any) {
  if (!metrics) return null;
  return {
    meanDistance: metrics.meanDistance ?? null,
    stdDistance: metrics.stdDistance ?? null,
    outlierThreshold: metrics.outlierThreshold ?? null,
    sampleCount: metrics.sampleCount ?? null,
    computedAt: metrics.computedAt ?? null,
  };
}

function serializeDetailedMetrics(metrics: any, metricType: string) {
  if (!metrics) return null;
  return {
    metricType,
    meanDistance: metrics.meanDistance ?? metrics.mean_distance ?? null,
    stdDistance: metrics.stdDistance ?? metrics.std_distance ?? null,
    outlierThreshold:
      metrics.outlierThreshold ?? metrics.outlier_threshold ?? null,
    sampleCount: metrics.sampleCount ?? metrics.sample_count ?? null,
    computedAt: metrics.computedAt ?? metrics.computed_at ?? null,
    metadata: metrics.metadata ?? {},
  };
}

function calculateStaleDays(computedAt: string | null) {
  if (!computedAt) return null;
  const ms = Date.now() - new Date(computedAt).getTime();
  return Number((ms / 86400000).toFixed(2));
}

async function fetchEmbeddedHistoryEntries(
  db: DrizzleD1,
  historyTypes: readonly string[],
) {
  return fetchEntriesWithEmbeddings(db, ["history"], {
    historyTypes,
    limitPerTable: null,
    limitTotal: null,
  });
}

async function getEmbeddedHistorySnapshot(
  db: DrizzleD1,
  historyTypes: readonly string[],
) {
  const placeholders = historyTypes.map(() => "?").join(", ");
  const raw = db.$client;
  const row = await raw
    .prepare(
      `SELECT MAX(id) as max_id, COUNT(*) as total
       FROM history
       WHERE persona_id = ?
         AND embedding IS NOT NULL
         AND type IN (${placeholders})`,
    )
    .bind(await getActivePersonaId(db), ...historyTypes)
    .first<{ max_id: number | null; total: number | null }>();
  return {
    maxId: row?.max_id ?? 0,
    total: row?.total ?? 0,
  };
}

async function countNewEmbeddedHistoryEntries(
  db: DrizzleD1,
  historyTypes: readonly string[],
  sinceId: number,
) {
  if (!sinceId) return Number.POSITIVE_INFINITY;
  const placeholders = historyTypes.map(() => "?").join(", ");
  const raw = db.$client;
  const row = await raw
    .prepare(
      `SELECT COUNT(*) as total
       FROM history
       WHERE persona_id = ?
         AND embedding IS NOT NULL
         AND id > ?
         AND type IN (${placeholders})`,
    )
    .bind(await getActivePersonaId(db), sinceId, ...historyTypes)
    .first<{ total: number | null }>();
  return row?.total ?? 0;
}

async function computeVoiceBasinPayload(
  db: DrizzleD1,
  options: { snapshotMaxHistoryId?: number; snapshotTotal?: number } = {},
) {
  const entries = await fetchEmbeddedHistoryEntries(db, VOICE_HISTORY_TYPES);
  const globalEmbeddings = entries.map((entry) => entry.embedding);
  const globalMetrics = computeBasinMetrics(globalEmbeddings);

  if (globalMetrics.error) {
    return {
      success: false as const,
      error: globalMetrics.error,
      minRequired: globalMetrics.minRequired,
      actual: globalMetrics.actual,
      entries,
    };
  }

  const entriesByType = Object.fromEntries(
    VOICE_HISTORY_TYPES.map((type) => [
      type,
      entries.filter((entry) => entry.type === type),
    ]),
  ) as Record<string, typeof entries>;

  const metricsByType = Object.fromEntries(
    VOICE_HISTORY_TYPES.map((type) => [
      type,
      computeBasinMetrics(entriesByType[type].map((entry) => entry.embedding)),
    ]),
  ) as Record<string, ReturnType<typeof computeBasinMetrics>>;

  const invalidType = Object.entries(metricsByType).find(
    ([, metrics]) => !!metrics.error,
  );
  if (invalidType) {
    const [type, metrics] = invalidType;
    return {
      success: false as const,
      error: `Insufficient data for ${type}`,
      minRequired: metrics.minRequired,
      actual: metrics.actual,
      entries,
    };
  }

  const crossTypePairs = computeCrossTypeCentroidDistances(metricsByType);
  const snapshot = options.snapshotMaxHistoryId
    ? {
        snapshotMaxHistoryId: options.snapshotMaxHistoryId,
        snapshotSampleCount: options.snapshotTotal ?? entries.length,
      }
    : null;

  const metadataBase = snapshot ?? {};

  const perType = Object.fromEntries(
    VOICE_HISTORY_TYPES.map((type) => [
      type,
      {
        metricType: toTypeMetric(type),
        metrics: metricsByType[type],
        entries: entriesByType[type],
        metadata: {
          ...metadataBase,
          crossType: Object.fromEntries(
            Object.entries(crossTypePairs).filter(([pair]) => pair.includes(type)),
          ),
        },
      },
    ]),
  );

  return {
    success: true as const,
    entries,
    globalMetrics,
    metricsByType,
    perType,
    crossTypePairs,
  };
}

async function recomputeAndPersistVoiceBasins(db: DrizzleD1) {
  const snapshot = await getEmbeddedHistorySnapshot(db, VOICE_HISTORY_TYPES);
  const payload = await computeVoiceBasinPayload(db, {
    snapshotMaxHistoryId: snapshot.maxId,
    snapshotTotal: snapshot.total,
  });
  if (!payload.success) return payload;

  await upsertBasinMetrics(db, "global", {
    ...payload.globalMetrics,
    metadata: {
      snapshotMaxHistoryId: snapshot.maxId,
      snapshotSampleCount: snapshot.total,
      voiceTypes: [...VOICE_HISTORY_TYPES],
      crossType: payload.crossTypePairs,
    },
  });

  for (const type of VOICE_HISTORY_TYPES) {
    await upsertBasinMetrics(db, toTypeMetric(type), {
      ...payload.metricsByType[type],
      metadata: payload.perType[type].metadata,
    });
  }

  return {
    ...payload,
    snapshot,
  };
}

async function shouldAutoRefreshMetric(
  db: DrizzleD1,
  metricsRow: any,
  historyTypes: readonly string[],
  threshold: number,
) {
  if (!metricsRow) return true;
  const snapshotMaxHistoryId = Number(
    metricsRow.metadata?.snapshotMaxHistoryId ?? 0,
  );
  const newEntries = await countNewEmbeddedHistoryEntries(
    db,
    historyTypes,
    snapshotMaxHistoryId,
  );
  return newEntries >= threshold;
}

// ============================================================================
// Directionality (Phase 2)
// ============================================================================

/**
 * POST /sim/direction/compute
 *
 * Computes a semantic direction vector between two anchor entries and projects
 * other entries along that axis.
 */
export async function handleComputeDirection(
  db: DrizzleD1,
  body: Record<string, any> = {},
) {
  const {
    anchorA,
    anchorB,
    poleA,
    poleB,
    projectTables,
    projectLimit = 50,
  } = body;

  // Support both single anchor (anchorA/B) and multi-anchor (poleA/B) formats
  const anchorsA = poleA || (anchorA ? [anchorA] : []);
  const anchorsB = poleB || (anchorB ? [anchorB] : []);

  if (anchorsA.length === 0) {
    return {
      success: false,
      error: "Pole A requires at least one anchor entry",
    };
  }
  if (anchorsB.length === 0) {
    return {
      success: false,
      error: "Pole B requires at least one anchor entry",
    };
  }

  for (const a of anchorsA) {
    if (!a?.id || !a?.table) {
      return {
        success: false,
        error: "Each Pole A anchor must have id and table",
      };
    }
  }
  for (const b of anchorsB) {
    if (!b?.id || !b?.table) {
      return {
        success: false,
        error: "Each Pole B anchor must have id and table",
      };
    }
  }

  // Check for overlap between poles
  const aIds = new Set(anchorsA.map((a: any) => `${a.table}:${a.id}`));
  for (const b of anchorsB) {
    if (aIds.has(`${b.table}:${b.id}`)) {
      return {
        success: false,
        error: `Entry ${b.table}#${b.id} cannot be in both poles`,
      };
    }
  }

  // Fetch embeddings for Pole A and compute centroid
  const embeddingsA = [];
  for (const anchor of anchorsA) {
    const emb = await fetchSingleEmbedding(db, anchor.table, anchor.id);
    if (!emb) {
      return {
        success: false,
        error: `Pole A entry ${anchor.table}#${anchor.id} has no embedding`,
      };
    }
    embeddingsA.push(emb);
  }
  const centroidA = computeCentroid(embeddingsA);

  // Fetch embeddings for Pole B and compute centroid
  const embeddingsB = [];
  for (const anchor of anchorsB) {
    const emb = await fetchSingleEmbedding(db, anchor.table, anchor.id);
    if (!emb) {
      return {
        success: false,
        error: `Pole B entry ${anchor.table}#${anchor.id} has no embedding`,
      };
    }
    embeddingsB.push(emb);
  }
  const centroidB = computeCentroid(embeddingsB);

  // Compute direction vector (centroidB - centroidA)
  const direction = subtractVectors(centroidB!, centroidA!);
  const magnitude = vectorMagnitude(direction);

  if (magnitude < 1e-10) {
    return {
      success: false,
      error:
        "Anchor embeddings are too similar (near-zero direction magnitude)",
    };
  }

  // Normalize direction
  const normalizedDir = normalizeDirectionVector(direction);

  // Fetch entries to project
  const tables = resolveEntryTypes(projectTables);
  const limit = clampLimit(projectLimit, 50, 200);
  const entries = await fetchEntriesWithEmbeddings(db, tables, {
    limitPerTable: limit,
    limitTotal: limit,
  });

  // Project each entry onto the direction
  const projections = entries.map((entry) => {
    const toEntry = subtractVectors(entry.embedding, centroidA!);
    const projection = dotProduct(toEntry, normalizedDir);
    const normalizedProjection =
      magnitude > 0 ? (projection / magnitude) * 2 - 1 : 0;

    return {
      id: entry.id,
      table: entry.table,
      type: entry.type ?? null,
      projection: normalizedProjection,
      timestamp: entry.createdAt,
      content: entry.content ?? null,
    };
  });

  projections.sort((a, b) => a.projection - b.projection);

  return {
    success: true,
    direction: {
      magnitude,
      poleACount: anchorsA.length,
      poleBCount: anchorsB.length,
      poleA: anchorsA,
      poleB: anchorsB,
    },
    projections,
  };
}

function computeCentroid(embeddings: Float32Array[]) {
  if (embeddings.length === 0) return null;
  if (embeddings.length === 1) return embeddings[0];

  const dim = embeddings[0].length;
  const centroid = new Float32Array(dim);

  for (let i = 0; i < dim; i++) {
    let sum = 0;
    for (const emb of embeddings) {
      sum += emb[i];
    }
    centroid[i] = sum / embeddings.length;
  }

  return centroid;
}

async function fetchSingleEmbedding(
  db: DrizzleD1,
  tableName: string,
  id: number,
) {
  const config = (SIM_EMBEDDING_TABLES as any)[tableName];
  if (!config) return null;

  const personaId = await getActivePersonaId(db);
  const raw = db.$client;
  const querySql = `SELECT embedding FROM ${config.table} WHERE persona_id = ? AND id = ?`;
  const row = await raw.prepare(querySql).bind(personaId, id).all();
  const entry = row.results?.[0];

  if (!(entry as any)?.embedding) return null;
  return blobToEmbedding((entry as any).embedding);
}

function subtractVectors(b: Float32Array, a: Float32Array) {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = b[i] - a[i];
  }
  return result;
}

function vectorMagnitude(v: Float32Array) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

// Named to avoid collision with rag's normalizeVector export
function normalizeDirectionVector(v: Float32Array) {
  const mag = vectorMagnitude(v);
  if (mag < 1e-10) return v;
  const result = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i] / mag;
  }
  return result;
}

function dotProduct(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function fetchEntriesWithEmbeddings(
  db: DrizzleD1,
  tables: string[],
  options: Record<string, any> = {},
) {
  const normalizedTables =
    Array.isArray(tables) && tables.length > 0
      ? tables
      : Object.keys(SIM_EMBEDDING_TABLES);
  const entries = [];
  const limitPerTable =
    typeof options.limitPerTable === "number"
      ? Math.max(1, options.limitPerTable)
      : null;
  const limitTotal =
    typeof options.limitTotal === "number"
      ? Math.max(1, options.limitTotal)
      : null;
  const historyTypes = options.historyTypes;
  const personaId = await getActivePersonaId(db);
  const raw = db.$client;

  for (const key of normalizedTables) {
    const config = (SIM_EMBEDDING_TABLES as any)[key];
    if (!config) continue;

    const typeCol = key === "history" ? ", type" : "";
    const contentCol = config.textColumn
      ? `, ${config.textColumn} as text_content`
      : "";

    let whereClause = "WHERE persona_id = ? AND embedding IS NOT NULL";
    const params: unknown[] = [personaId];

    if (key === "history") {
      const excludePlaceholders = HISTORY_TYPES_EXCLUDED_FROM_EMBEDDING.map(
        () => "?",
      ).join(", ");
      whereClause += ` AND type NOT IN (${excludePlaceholders})`;
      params.push(...HISTORY_TYPES_EXCLUDED_FROM_EMBEDDING);

      if (historyTypes && historyTypes.length > 0) {
        const includePlaceholders = historyTypes.map(() => "?").join(", ");
        whereClause += ` AND type IN (${includePlaceholders})`;
        params.push(...historyTypes);
      }
    }

    if (limitPerTable) {
      params.push(limitPerTable);
    }
    const limitClause = limitPerTable ? " LIMIT ?" : "";
    const querySql = `
      SELECT id, created_at${typeCol}${contentCol}, embedding
      FROM ${config.table}
      ${whereClause}
      ORDER BY created_at DESC${limitClause}
    `;
    const rows = await raw
      .prepare(querySql)
      .bind(...params)
      .all();
    for (const row of (rows.results || []) as any[]) {
      if (!row.embedding) continue;
      const content = config.textColumn ? row.text_content : null;
      entries.push({
        table: key,
        id: row.id,
        createdAt: row.created_at,
        type: row.type ?? null,
        content: content ?? null,
        embedding: blobToEmbedding(row.embedding),
      });
    }
  }

  entries.sort((a, b) => {
    const aTs = Date.parse(a.createdAt) || 0;
    const bTs = Date.parse(b.createdAt) || 0;
    return bTs - aTs;
  });

  if (limitTotal && entries.length > limitTotal) {
    return entries.slice(0, limitTotal);
  }
  return entries;
}

// ============================================================================
// Concept Axes CRUD (Phase 2+)
// ============================================================================

/**
 * GET /sim/axes
 */
export async function handleGetAxes(db: DrizzleD1) {
  const axes = await getAxes(db);
  return { axes };
}

/**
 * GET /sim/axes/:id
 */
export async function handleGetAxis(db: DrizzleD1, axisId: string | number) {
  const id = Number(axisId);
  if (!Number.isFinite(id)) {
    return { success: false, error: "Invalid axis ID" };
  }
  const axis = await getAxisById(db, id);
  if (!axis) {
    return { success: false, error: "Axis not found" };
  }
  return { axis };
}

const MAX_EXAMPLES_PER_ARRAY = 50;
const MAX_EXAMPLE_LENGTH = 1000;

function validateExamplesArray(
  examples: unknown,
  fieldName: string,
): { valid: boolean; error?: string; value: string[] } {
  if (!Array.isArray(examples)) {
    return { valid: false, error: `${fieldName} must be an array`, value: [] };
  }
  if (examples.length > MAX_EXAMPLES_PER_ARRAY) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum of ${MAX_EXAMPLES_PER_ARRAY} items`,
      value: [],
    };
  }
  for (let i = 0; i < examples.length; i++) {
    if (typeof examples[i] !== "string") {
      return {
        valid: false,
        error: `${fieldName}[${i}] must be a string`,
        value: [],
      };
    }
    if (examples[i].length > MAX_EXAMPLE_LENGTH) {
      return {
        valid: false,
        error: `${fieldName}[${i}] exceeds maximum of ${MAX_EXAMPLE_LENGTH} characters`,
        value: [],
      };
    }
  }
  return { valid: true, value: examples as string[] };
}

/**
 * POST /sim/axes
 */
export async function handleCreateAxis(
  db: DrizzleD1,
  body: Record<string, any> = {},
) {
  const { name, description, positiveExamples, negativeExamples } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return { success: false, error: "Axis name is required" };
  }

  let validatedPositive: string[] = [];
  let validatedNegative: string[] = [];

  if (positiveExamples !== undefined && positiveExamples !== null) {
    const result = validateExamplesArray(positiveExamples, "positiveExamples");
    if (!result.valid) return { success: false, error: result.error };
    validatedPositive = result.value;
  }
  if (negativeExamples !== undefined && negativeExamples !== null) {
    const result = validateExamplesArray(negativeExamples, "negativeExamples");
    if (!result.valid) return { success: false, error: result.error };
    validatedNegative = result.value;
  }

  const result = await createAxis(db, {
    name: name.trim(),
    description: description || null,
    positiveExamples: validatedPositive,
    negativeExamples: validatedNegative,
  });
  return {
    success: true,
    id: result.meta?.last_row_id,
  };
}

/**
 * PUT /sim/axes/:id
 */
export async function handleUpdateAxis(
  db: DrizzleD1,
  axisId: string | number,
  body: Record<string, any> = {},
) {
  const id = Number(axisId);
  if (!Number.isFinite(id)) {
    return { success: false, error: "Invalid axis ID" };
  }
  const { name, description, positiveExamples, negativeExamples, isActive } =
    body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  if (positiveExamples !== undefined) {
    const result = validateExamplesArray(positiveExamples, "positiveExamples");
    if (!result.valid) return { success: false, error: result.error };
    updates.positiveExamples = result.value;
  }
  if (negativeExamples !== undefined) {
    const result = validateExamplesArray(negativeExamples, "negativeExamples");
    if (!result.valid) return { success: false, error: result.error };
    updates.negativeExamples = result.value;
  }

  if (isActive !== undefined) updates.isActive = isActive;

  const result = await updateAxis(db, id, updates);
  return result;
}

/**
 * DELETE /sim/axes/:id
 */
export async function handleDeleteAxis(db: DrizzleD1, axisId: string | number) {
  const id = Number(axisId);
  if (!Number.isFinite(id)) {
    return { success: false, error: "Invalid axis ID" };
  }
  const result = await deleteAxis(db, id);
  return { success: result.meta?.changes > 0 };
}

/**
 * GET /sim/axes/:id/scores
 */
export async function handleGetAxisScores(
  db: DrizzleD1,
  axisId: string | number,
  url: URL,
) {
  const id = Number(axisId);
  if (!Number.isFinite(id)) {
    return { success: false, error: "Invalid axis ID" };
  }
  const targetTable = url.searchParams.get("table") || "history";
  const limit = clampLimit(url.searchParams.get("limit"), 100, 500);

  const personaId = await getActivePersonaId(db);
  const raw = db.$client;
  const querySql = `
    SELECT s.*, a.name AS axis_name
    FROM sim_axis_scores s
    JOIN sim_concept_axes a ON s.axis_id = a.id
    WHERE s.persona_id = ? AND s.axis_id = ?
    ORDER BY s.created_at DESC
    LIMIT ?
  `;
  const rows = await raw.prepare(querySql).bind(personaId, id, limit).all();
  return { scores: rows.results || [] };
}

// ============================================================================
// Anomalies
// ============================================================================

/**
 * GET /sim/anomalies
 */
export async function handleGetAnomalies(db: DrizzleD1, url: URL) {
  const unresolvedOnly = url.searchParams.get("unresolved") === "true";
  const limit = clampLimit(url.searchParams.get("limit"), 50, 500);
  const anomalies = await getAnomalies(db, { unresolvedOnly, limit });
  return { anomalies };
}

// ============================================================================
// Data Export
// ============================================================================

/**
 * GET /sim/export
 * Exports SIM data for external analysis (JSON format).
 */
export async function handleSimExport(db: DrizzleD1, url: URL) {
  const includeRawEmbeddings = url.searchParams.get("embeddings") === "true";
  const limit = clampLimit(url.searchParams.get("limit"), 500, 5000);

  const axes = await getAxes(db);
  const metricsRow = await getBasinMetrics(db, "global");
  const anomalies = await getAnomalies(db, { limit: 500 });

  const personaId = await getActivePersonaId(db);
  const raw = db.$client;
  const axisScores = [];
  for (const axis of axes) {
    const querySql = `
      SELECT s.*, a.name AS axis_name
      FROM sim_axis_scores s
      JOIN sim_concept_axes a ON s.axis_id = a.id
      WHERE s.persona_id = ? AND s.axis_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?
    `;
    const rows = await raw
      .prepare(querySql)
      .bind(personaId, axis.id, limit)
      .all();
    for (const row of rows.results || []) {
      axisScores.push(row);
    }
  }

  const tables = Object.keys(SIM_EMBEDDING_TABLES);
  const entries = await fetchEntriesWithEmbeddings(db, tables, {
    limitPerTable: limit,
    limitTotal: limit,
  });

  const trajectoryExport = entries.map((entry) => {
    const stats = metricsRow
      ? computeEntryStats(entry.embedding, normalizeMetricsRow(metricsRow))
      : null;
    const point: Record<string, unknown> = {
      id: entry.id,
      table: entry.table,
      type: entry.type ?? null,
      timestamp: entry.createdAt,
      content: entry.content ?? null,
    };
    if (stats) {
      point.distance = stats.distance;
      point.zScore = stats.zScore;
      point.isOutlier = stats.isOutlier;
    }
    if (includeRawEmbeddings && entry.embedding) {
      point.embedding = Array.from(entry.embedding);
    }
    return point;
  });

  const basinMetrics = metricsRow
    ? serializeGlobalMetrics(normalizeMetricsRow(metricsRow))
    : null;

  return {
    exportedAt: new Date().toISOString(),
    format: "sim-export-v1",
    basinMetrics,
    axes: axes.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      positiveExamples: a.positive_examples,
      negativeExamples: a.negative_examples,
      isActive: a.is_active,
      createdAt: a.created_at,
    })),
    axisScores,
    trajectory: trajectoryExport,
    anomalies: anomalies.map((a) => ({
      id: a.id,
      targetTable: a.target_table,
      targetId: a.target_id,
      basinDistance: a.basin_distance,
      zScore: a.z_score,
      flaggedAxes: a.flagged_axes,
      detectionMethod: a.detection_method,
      inspected: a.inspected,
      verdict: a.verdict,
      createdAt: a.created_at,
    })),
  };
}
