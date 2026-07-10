import { describe, it, expect } from 'vitest';
import { computeBasinMetrics, computeEntryStats, analyzeTrend } from '@persistence/memory';

function createEmbedding(value: number, dims = 4): Float32Array {
  const arr = new Float32Array(dims);
  arr.fill(value);
  return arr;
}

function createRandomEmbedding(dims = 4, seed = 0): Float32Array {
  const arr = new Float32Array(dims);
  for (let i = 0; i < dims; i++) {
    // Deterministic pseudo-random for reproducibility
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    arr[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return arr;
}

describe('services/sim', () => {
  // ===========================================================================
  // computeBasinMetrics
  // ===========================================================================
  describe('computeBasinMetrics', () => {
    it('returns error for null input', () => {
      const result = computeBasinMetrics(null as any);
      expect(result.error).toBe('Insufficient data');
      expect(result.actual).toBe(0);
    });

    it('returns error for empty array', () => {
      const result = computeBasinMetrics([]);
      expect(result.error).toBe('Insufficient data');
      expect(result.actual).toBe(0);
      expect(result.minRequired).toBe(10);
    });

    it('returns error for fewer than 10 embeddings', () => {
      const result = computeBasinMetrics([createEmbedding(0)]);
      expect(result.error).toBe('Insufficient data');
      expect(result.actual).toBe(1);
      expect(result.minRequired).toBe(10);
    });

    it('returns error for 9 embeddings (boundary)', () => {
      const embeddings = Array.from({ length: 9 }, (_, i) => createEmbedding(i));
      const result = computeBasinMetrics(embeddings);
      expect(result.error).toBe('Insufficient data');
      expect(result.actual).toBe(9);
    });

    it('succeeds with exactly 10 embeddings', () => {
      const embeddings = Array.from({ length: 10 }, (_, i) => createEmbedding(i * 0.1, 2));
      const result = computeBasinMetrics(embeddings);
      expect(result.error).toBeUndefined();
      expect(result.sampleCount).toBe(10);
    });

    it('computes centroid as mean of vectors', () => {
      const embeddings = Array.from({ length: 10 }, (_, i) => createEmbedding(i * 0.1, 2));
      const result = computeBasinMetrics(embeddings);
      expect(result.centroid).toBeInstanceOf(Float32Array);
      expect(result.centroid!.length).toBe(2);
      // Mean of 0, 0.1, 0.2, ..., 0.9 = 0.45
      expect(result.centroid![0]).toBeCloseTo(0.45, 5);
      expect(result.centroid![1]).toBeCloseTo(0.45, 5);
    });

    it('computes outlier threshold at mean plus two times std deviation', () => {
      const embeddings = Array.from({ length: 12 }, (_, i) => createEmbedding(i, 1));
      const result = computeBasinMetrics(embeddings);
      expect(result.outlierThreshold).toBeCloseTo(
        result.meanDistance! + 2 * result.stdDistance!,
        6
      );
    });

    it('returns zero mean and std for all-identical embeddings', () => {
      const embeddings = Array.from({ length: 10 }, () => createEmbedding(5, 4));
      const result = computeBasinMetrics(embeddings);
      expect(result.error).toBeUndefined();
      expect(result.meanDistance).toBe(0);
      expect(result.stdDistance).toBe(0);
      expect(result.outlierThreshold).toBe(0);
    });

    it('centroid matches the single repeated value for identical embeddings', () => {
      const embeddings = Array.from({ length: 10 }, () => createEmbedding(3.14, 3));
      const result = computeBasinMetrics(embeddings);
      expect(result.centroid![0]).toBeCloseTo(3.14, 5);
      expect(result.centroid![1]).toBeCloseTo(3.14, 5);
      expect(result.centroid![2]).toBeCloseTo(3.14, 5);
    });

    it('returns valid computedAt ISO timestamp', () => {
      const embeddings = Array.from({ length: 10 }, (_, i) => createEmbedding(i));
      const result = computeBasinMetrics(embeddings);
      expect(result.computedAt).toBeDefined();
      expect(new Date(result.computedAt!).getTime()).not.toBeNaN();
    });

    it('produces positive stdDistance for varied embeddings', () => {
      const embeddings = Array.from({ length: 20 }, (_, i) => createRandomEmbedding(8, i));
      const result = computeBasinMetrics(embeddings);
      expect(result.stdDistance).toBeGreaterThan(0);
      expect(result.meanDistance).toBeGreaterThan(0);
    });

    it('returns error for embeddings with zero dimensions', () => {
      const embeddings = Array.from({ length: 10 }, () => new Float32Array(0));
      const result = computeBasinMetrics(embeddings);
      expect(result.error).toBe('Invalid embeddings');
    });

    it('handles high-dimensional embeddings (768-dim like BGE)', () => {
      const embeddings = Array.from({ length: 15 }, (_, i) => createRandomEmbedding(768, i * 42));
      const result = computeBasinMetrics(embeddings);
      expect(result.error).toBeUndefined();
      expect(result.centroid!.length).toBe(768);
      expect(result.sampleCount).toBe(15);
      expect(Number.isFinite(result.meanDistance)).toBe(true);
      expect(Number.isFinite(result.stdDistance)).toBe(true);
    });
  });

  // ===========================================================================
  // computeEntryStats
  // ===========================================================================
  describe('computeEntryStats', () => {
    it('returns zeros for null embedding', () => {
      const stats = computeEntryStats(null as any, { centroid: createEmbedding(0), meanDistance: 1, stdDistance: 0.5 });
      expect(stats.distance).toBe(0);
      expect(stats.zScore).toBe(0);
      expect(stats.isOutlier).toBe(false);
    });

    it('returns zeros for null basin metrics', () => {
      const stats = computeEntryStats(createEmbedding(1), null as any);
      expect(stats.distance).toBe(0);
      expect(stats.zScore).toBe(0);
      expect(stats.isOutlier).toBe(false);
    });

    it('returns zeros for metrics without centroid', () => {
      const stats = computeEntryStats(createEmbedding(1), { centroid: null, meanDistance: 1, stdDistance: 0.5 } as any);
      expect(stats.distance).toBe(0);
    });

    it('returns z-score of 0 when std deviation is zero', () => {
      const embeddings = Array.from({ length: 10 }, () => createEmbedding(0));
      const metrics = computeBasinMetrics(embeddings);
      const stats = computeEntryStats(createEmbedding(0), metrics);
      expect(stats.distance).toBe(0);
      expect(stats.zScore).toBe(0);
      expect(stats.isOutlier).toBe(false);
    });

    it('flags entries beyond 2 sigma as outliers', () => {
      const metrics = {
        centroid: createEmbedding(0, 1),
        meanDistance: 1,
        stdDistance: 0.5
      };
      const stats = computeEntryStats(createEmbedding(3, 1), metrics);
      expect(stats.distance).toBeCloseTo(3);
      expect(stats.zScore).toBeGreaterThan(2);
      expect(stats.isOutlier).toBe(true);
    });

    it('does not flag entries within 2 sigma', () => {
      const metrics = {
        centroid: createEmbedding(0, 1),
        meanDistance: 1,
        stdDistance: 1
      };
      const stats = computeEntryStats(createEmbedding(1, 1), metrics);
      expect(stats.isOutlier).toBe(false);
    });

    it('correctly computes distance for entry at centroid', () => {
      const metrics = {
        centroid: createEmbedding(5, 4),
        meanDistance: 2,
        stdDistance: 1
      };
      const stats = computeEntryStats(createEmbedding(5, 4), metrics);
      expect(stats.distance).toBeCloseTo(0);
    });

    it('computes euclidean distance correctly for known vectors', () => {
      const centroid = new Float32Array([0, 0, 0]);
      const entry = new Float32Array([3, 4, 0]);
      const metrics = { centroid, meanDistance: 2, stdDistance: 1 };
      const stats = computeEntryStats(entry, metrics);
      expect(stats.distance).toBeCloseTo(5, 4); // 3-4-5 triangle
    });

    it('correctly handles negative z-scores (closer than mean)', () => {
      const metrics = {
        centroid: createEmbedding(0, 1),
        meanDistance: 5,
        stdDistance: 1
      };
      // Entry at distance ~0.5 from centroid, well below mean of 5
      const stats = computeEntryStats(createEmbedding(0.5, 1), metrics);
      expect(stats.zScore).toBeLessThan(0);
      expect(stats.isOutlier).toBe(true); // |z| > 2
    });
  });

  // ===========================================================================
  // analyzeTrend
  // ===========================================================================
  describe('analyzeTrend', () => {
    it('returns insufficient_data for null input', () => {
      const result = analyzeTrend(null as any, { meanDistance: 1, stdDistance: 0.5 });
      expect(result.trend).toBe('insufficient_data');
    });

    it('returns insufficient_data for fewer than 5 distances', () => {
      const result = analyzeTrend([1, 2, 3, 4], { meanDistance: 1, stdDistance: 0.5 });
      expect(result.trend).toBe('insufficient_data');
    });

    it('returns insufficient_data for empty array', () => {
      const result = analyzeTrend([], { meanDistance: 1, stdDistance: 0.5 });
      expect(result.trend).toBe('insufficient_data');
    });

    it('succeeds with exactly 5 distances', () => {
      const distances = [0.5, 0.5, 0.5, 0.5, 0.5];
      const result = analyzeTrend(distances, { meanDistance: 0.5, stdDistance: 0.2 });
      expect(result.trend).toBe('stable');
    });

    it('returns stable for distances near the global mean', () => {
      const metrics = { meanDistance: 0.5, stdDistance: 0.2 };
      const distances = [0.48, 0.52, 0.54, 0.50, 0.46];
      const result = analyzeTrend(distances, metrics);
      expect(result.trend).toBe('stable');
      expect(result.last10Mean).toBeCloseTo(0.5, 2);
    });

    it('returns drifting_outward when recent mean exceeds threshold', () => {
      const metrics = { meanDistance: 0.5, stdDistance: 0.1 };
      const distances = [0.7, 0.68, 0.72, 0.69, 0.71];
      const result = analyzeTrend(distances, metrics);
      expect(result.trend).toBe('drifting_outward');
      expect(result.driftFromGlobal).toBeGreaterThan(0);
    });

    it('returns converging when recent mean is well below global mean', () => {
      const metrics = { meanDistance: 1.0, stdDistance: 0.2 };
      const distances = [0.7, 0.72, 0.68, 0.71, 0.69];
      const result = analyzeTrend(distances, metrics);
      expect(result.trend).toBe('converging');
      expect(result.driftFromGlobal).toBeLessThan(0);
    });

    it('computes last10Std for recent distances', () => {
      const metrics = { meanDistance: 1.0, stdDistance: 0.5 };
      const distances = [1.0, 1.0, 1.0, 1.0, 1.0];
      const result = analyzeTrend(distances, metrics);
      expect(result.last10Std).toBe(0);
    });

    it('handles null basin metrics gracefully', () => {
      const distances = [1, 2, 3, 4, 5];
      const result = analyzeTrend(distances, null as any);
      // Should still compute without crashing
      expect(result.trend).toBeDefined();
    });

    it('drift threshold is proportional to global stdDistance', () => {
      // With very small std, even small drifts are significant
      const metricsSmallStd = { meanDistance: 1.0, stdDistance: 0.01 };
      const distances = [1.01, 1.02, 1.01, 1.02, 1.01];
      const result = analyzeTrend(distances, metricsSmallStd);
      // These small deviations exceed 0.5 * 0.01 = 0.005
      expect(result.trend).toBe('drifting_outward');
    });
  });
});
