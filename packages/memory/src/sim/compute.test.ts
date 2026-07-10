import { describe, expect, it } from "vitest";
import {
  computeBasinMetrics,
  computeCrossTypeCentroidDistances,
  computeWeeklyBasinBuckets,
  getIsoWeekKey,
} from "./compute";

function repeatEmbedding(values: number[], count: number) {
  return Array.from({ length: count }, () => Float32Array.from(values));
}

describe("SIM weekly/cross-type helpers", () => {
  it("computes ISO week keys matching the study harness format", () => {
    expect(getIsoWeekKey("2026-02-25 03:52:41")).toMatch(/^2026-W\d{2}$/);
  });

  it("computes cross-type centroid distances", () => {
    const thought = computeBasinMetrics(repeatEmbedding([0, 0], 10));
    const userMessage = computeBasinMetrics(repeatEmbedding([3, 4], 10));

    const pairs = computeCrossTypeCentroidDistances({
      thought,
      user_message: userMessage,
    });

    expect(pairs["thought<->user_message"]).toBe(5);
  });

  it("computes weekly buckets using global-reference distances", () => {
    const weekOne = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      createdAt: `2026-02-23 12:00:${String(index).padStart(2, "0")}`,
      embedding: Float32Array.from([0, 0]),
    }));
    const weekTwo = Array.from({ length: 10 }, (_, index) => ({
      id: index + 11,
      createdAt: `2026-03-02 12:00:${String(index).padStart(2, "0")}`,
      embedding: Float32Array.from([2, 0]),
    }));

    const global = computeBasinMetrics(
      [...weekOne, ...weekTwo].map((entry) => entry.embedding),
    );
    const weekly = computeWeeklyBasinBuckets([...weekOne, ...weekTwo], global);

    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toMatchObject({
      n: 10,
      meanDistFromGlobal: 1,
      outlierRate: 0,
      ownSpread: 0,
      ownCentroidShiftFromGlobal: 1,
    });
    expect(weekly[1]).toMatchObject({
      n: 10,
      meanDistFromGlobal: 1,
      outlierRate: 0,
      ownSpread: 0,
      ownCentroidShiftFromGlobal: 1,
    });
  });
});
