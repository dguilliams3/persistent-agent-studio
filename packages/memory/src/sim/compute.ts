/**
 * Semantic Identity Monitor computation helpers
 *
 * Pure in-memory basin metric computation utilities.
 * No database or platform dependencies.
 *
 * @module @persistence/memory/sim/compute
 *
 * @upstream Called by: SIM route handlers (packages/memory/src/sim/routes.ts)
 * @downstream Calls: @persistence/memory/rag (euclideanDistance, mean, standardDeviation)
 */

import { euclideanDistance, mean, standardDeviation } from '../rag';
import type { WeeklyBasinBucket, WeeklyBasinEntry } from './types';

type BasinMetrics = {
  centroid: Float32Array | null;
  meanDistance: number;
  stdDistance: number;
  outlierThreshold?: number;
};

/**
 * Computes aggregate basin statistics from a collection of embeddings.
 *
 * @param {Float32Array[]} embeddings - Embedding vectors sampled from SIM tables
 * @returns {{
 *   centroid?: Float32Array,
 *   meanDistance?: number,
 *   stdDistance?: number,
 *   outlierThreshold?: number,
 *   sampleCount?: number,
 *   error?: string,
 *   minRequired?: number,
 *   actual?: number
 * }}
 */
export function computeBasinMetrics(embeddings: Float32Array[]) {
  if (!Array.isArray(embeddings) || embeddings.length < 10) {
    return {
      error: 'Insufficient data',
      minRequired: 10,
      actual: Array.isArray(embeddings) ? embeddings.length : 0
    };
  }

  const dims = embeddings[0]?.length || 0;
  if (dims === 0) {
    return { error: 'Invalid embeddings', minRequired: 10, actual: embeddings.length };
  }

  const centroid = new Float32Array(dims);
  for (const emb of embeddings) {
    for (let i = 0; i < dims; i += 1) {
      centroid[i] += emb[i] / embeddings.length;
    }
  }

  const distances = embeddings.map(emb => euclideanDistance(emb, centroid));
  const meanDistance = mean(distances);
  const stdDistance = standardDeviation(distances, meanDistance);
  const outlierThreshold = meanDistance + 2 * stdDistance;

  return {
    centroid,
    meanDistance,
    stdDistance,
    outlierThreshold,
    sampleCount: embeddings.length,
    computedAt: new Date().toISOString()
  };
}

/**
 * Computes distance/z-score metadata for a single embedding.
 *
 * @param {Float32Array} embedding - Entry embedding vector
 * @param {{
 *   centroid: Float32Array,
 *   meanDistance: number,
 *   stdDistance: number
 * }} basinMetrics - Pre-computed basin metrics
 * @returns {{distance: number, zScore: number, isOutlier: boolean}}
 */
export function computeEntryStats(embedding: Float32Array, basinMetrics: Partial<BasinMetrics> | null | undefined) {
  if (!embedding || !basinMetrics?.centroid) {
    return { distance: 0, zScore: 0, isOutlier: false };
  }

  const distance = euclideanDistance(embedding, basinMetrics.centroid);
  const stdDistance = basinMetrics.stdDistance ?? 0;
  const meanDistance = basinMetrics.meanDistance ?? 0;
  const hasSpread = Number.isFinite(stdDistance) && stdDistance > 0;
  const zScore = hasSpread
    ? (distance - meanDistance) / stdDistance
    : 0;

  return {
    distance,
    zScore,
    isOutlier: Math.abs(zScore) > 2
  };
}

/**
 * Analyzes recent distances to determine directional drift.
 *
 * @param {number[]} recentDistances - Ordered newest -> oldest distances
 * @param {{
 *   meanDistance: number,
 *   stdDistance: number
 * }} basinMetrics - Global statistics reference
 * @returns {{
 *   trend: 'stable'|'drifting_outward'|'converging'|'insufficient_data',
 *   last10Mean?: number,
 *   last10Std?: number,
 *   driftFromGlobal?: number
 * }}
 */
export function analyzeTrend(recentDistances: number[], basinMetrics: Partial<BasinMetrics>) {
  if (!Array.isArray(recentDistances) || recentDistances.length < 5) {
    return { trend: 'insufficient_data' };
  }

  const recentMean = mean(recentDistances);
  const recentStd = standardDeviation(recentDistances, recentMean);

  const globalMean = basinMetrics?.meanDistance ?? 0;
  const globalStd = basinMetrics?.stdDistance ?? 0;
  const drift = recentMean - globalMean;
  const driftThreshold = globalStd * 0.5;

  let trend = 'stable';
  if (drift > driftThreshold) {
    trend = 'drifting_outward';
  } else if (drift < -driftThreshold) {
    trend = 'converging';
  }

  return {
    trend,
    last10Mean: recentMean,
    last10Std: recentStd,
    driftFromGlobal: drift
  };
}

/**
 * Compute ISO week key for a timestamp, matching the study harness.
 */
export function getIsoWeekKey(timestamp: string | number) {
  const source = typeof timestamp === 'number' ? new Date(timestamp) : new Date(`${timestamp}Z`);
  const day = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()),
  );
  const dayNum = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((day.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Euclidean distance between two centroids.
 */
export function computeCentroidDistance(a: Float32Array, b: Float32Array) {
  return euclideanDistance(a, b);
}

/**
 * Pairwise centroid distances between per-type basin metrics.
 */
export function computeCrossTypeCentroidDistances(
  metricsByType: Record<string, Partial<BasinMetrics> | null | undefined>,
) {
  const available = Object.entries(metricsByType).filter(
    ([, metrics]) => metrics?.centroid instanceof Float32Array,
  ) as Array<[string, BasinMetrics]>;
  const pairs: Record<string, number> = {};

  for (let i = 0; i < available.length; i += 1) {
    for (let j = i + 1; j < available.length; j += 1) {
      const [leftType, leftMetrics] = available[i];
      const [rightType, rightMetrics] = available[j];
      pairs[`${leftType}<->${rightType}`] = Number(
        computeCentroidDistance(
          leftMetrics.centroid as Float32Array,
          rightMetrics.centroid as Float32Array,
        ).toFixed(4),
      );
    }
  }

  return pairs;
}

/**
 * Weekly drift buckets using the same math as the run-dir analyzer.
 */
export function computeWeeklyBasinBuckets(
  entries: WeeklyBasinEntry[],
  globalMetrics: Partial<BasinMetrics> | null | undefined,
): WeeklyBasinBucket[] {
  if (!entries.length || !globalMetrics?.centroid) return [];

  const byWeek = new Map<string, WeeklyBasinEntry[]>();
  for (const entry of entries) {
    const key = getIsoWeekKey(entry.createdAt);
    const bucket = byWeek.get(key) ?? [];
    bucket.push(entry);
    byWeek.set(key, bucket);
  }

  return [...byWeek.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, bucketEntries]) => {
      const stats = bucketEntries.map((entry) =>
        computeEntryStats(entry.embedding, globalMetrics),
      );
      const ownMetrics = computeBasinMetrics(
        bucketEntries.map((entry) => entry.embedding),
      );
      const ownValid = !ownMetrics.error && ownMetrics.centroid;

      return {
        week,
        n: bucketEntries.length,
        meanDistFromGlobal: Number(
          (stats.reduce((sum, stat) => sum + stat.distance, 0) / bucketEntries.length).toFixed(4),
        ),
        outlierRate: Number(
          (stats.filter((stat) => stat.isOutlier).length / bucketEntries.length).toFixed(4),
        ),
        ownSpread: ownValid ? Number(ownMetrics.stdDistance.toFixed(4)) : null,
        ownCentroidShiftFromGlobal:
          ownValid && globalMetrics.centroid
            ? Number(
                computeCentroidDistance(ownMetrics.centroid, globalMetrics.centroid).toFixed(4),
              )
            : null,
      };
    });
}
