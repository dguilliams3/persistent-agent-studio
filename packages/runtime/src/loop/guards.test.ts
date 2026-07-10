/**
 * @module @persistence/runtime/loop/guards.test
 * @description Unit tests for cycle guards
 *
 * Tests cover:
 * - checkIntervalGuard() - minimum interval enforcement
 * - checkSleepGuard() - sleep state handling
 * - checkBatchGuard() - batch mode handling
 * - checkRunningGuard() - concurrent cycle prevention
 * - runAllGuards() - combined guard execution
 * - getSleepState() - sleep state retrieval
 *
 * @covers ./guards.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkIntervalGuard,
  checkSleepGuard,
  checkBatchGuard,
  checkRunningGuard,
  runAllGuards,
  getSleepState,
} from "./guards";

// Mock @persistence/db
vi.mock("@persistence/db", () => ({
  getState: vi.fn(),
  setState: vi.fn(),
}));

// Mock @persistence/llm
vi.mock("@persistence/llm", () => ({
  getPendingBatches: vi.fn(),
}));

import { getState, setState } from "@persistence/db";
import { getPendingBatches } from "@persistence/llm";

const mockGetState = vi.mocked(getState);
const mockSetState = vi.mocked(setState);
const mockGetPendingBatches = vi.mocked(getPendingBatches);

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a mock DrizzleD1
 */
function createMockDb() {
  return {} as Parameters<typeof checkIntervalGuard>[0];
}

/**
 * Set up getState mock to return specific values for specific keys
 */
function mockStateValues(values: Record<string, string | undefined>) {
  mockGetState.mockImplementation(async (_db, key) => {
    return values[key];
  });
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no state values
  mockStateValues({});
  // Default: no pending batches
  mockGetPendingBatches.mockResolvedValue([]);
});

// ============================================================================
// checkIntervalGuard()
// ============================================================================

describe("checkIntervalGuard", () => {
  const db = createMockDb();
  const intervalSeconds = 60; // 1 minute

  describe("force flag", () => {
    it("proceeds immediately when force is true", async () => {
      mockStateValues({
        last_wake_time: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
      });

      const result = await checkIntervalGuard(db, intervalSeconds, true);
      expect(result.proceed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("does not check state when force is true", async () => {
      await checkIntervalGuard(db, intervalSeconds, true);
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });

  describe("no previous cycle", () => {
    it("proceeds when no last_wake_time exists", async () => {
      mockStateValues({
        last_wake_time: undefined,
      });

      const result = await checkIntervalGuard(db, intervalSeconds);
      expect(result.proceed).toBe(true);
    });
  });

  describe("interval timing", () => {
    it("blocks when interval not elapsed", async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      mockStateValues({
        last_wake_time: thirtySecondsAgo,
      });

      const result = await checkIntervalGuard(db, intervalSeconds);
      expect(result.proceed).toBe(false);
      expect(result.softSkip).toBe(true);
      expect(result.reason).toContain("30"); // ~30 seconds elapsed
      expect(result.reason).toContain("60"); // of 60 seconds required
    });

    it("proceeds when interval has elapsed", async () => {
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      mockStateValues({
        last_wake_time: twoMinutesAgo,
      });

      const result = await checkIntervalGuard(db, intervalSeconds);
      expect(result.proceed).toBe(true);
    });

    it("proceeds at exactly the interval boundary", async () => {
      const exactlyOneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      mockStateValues({
        last_wake_time: exactlyOneMinuteAgo,
      });

      const result = await checkIntervalGuard(db, intervalSeconds);
      expect(result.proceed).toBe(true);
    });

    it("respects custom interval values", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
      mockStateValues({
        last_wake_time: fiveMinutesAgo,
      });

      // 10 minute interval - should block (only 5 min elapsed)
      const result = await checkIntervalGuard(db, 600);
      expect(result.proceed).toBe(false);
    });
  });
});

// ============================================================================
// checkSleepGuard()
// ============================================================================

describe("checkSleepGuard", () => {
  const db = createMockDb();

  describe("not sleeping", () => {
    it("proceeds when no sleep_until exists", async () => {
      mockStateValues({
        sleep_until: undefined,
      });

      const result = await checkSleepGuard(db);
      expect(result.proceed).toBe(true);
    });
  });

  describe("actively sleeping", () => {
    it("blocks when sleep_until is in the future", async () => {
      const oneHourFromNow = new Date(Date.now() + 3600000).toISOString();
      mockStateValues({
        sleep_until: oneHourFromNow,
      });

      const result = await checkSleepGuard(db);
      expect(result.proceed).toBe(false);
      expect(result.softSkip).toBe(true);
      expect(result.reason).toContain("Sleeping");
      expect(result.reason).toContain("minutes remaining");
    });

    it("reports correct remaining minutes", async () => {
      const thirtyMinutesFromNow = new Date(Date.now() + 1800000).toISOString();
      mockStateValues({
        sleep_until: thirtyMinutesFromNow,
      });

      const result = await checkSleepGuard(db);
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("30");
    });
  });

  describe("sleep ended", () => {
    it("proceeds when sleep_until has passed", async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      mockStateValues({
        sleep_until: oneHourAgo,
      });

      const result = await checkSleepGuard(db);
      expect(result.proceed).toBe(true);
    });

    // BUG-008 FIX: Verify sleep_until is cleared when sleep ends
    it("clears sleep_until when sleep ends", async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      mockStateValues({
        sleep_until: oneHourAgo,
      });

      await checkSleepGuard(db);

      expect(mockSetState).toHaveBeenCalledWith(db, "sleep_until", "", {});
    });

    it("passes persona options when clearing sleep state", async () => {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      mockStateValues({
        sleep_until: oneHourAgo,
      });
      const personaOptions = { personaId: 42 };

      await checkSleepGuard(db, personaOptions);

      expect(mockSetState).toHaveBeenCalledWith(
        db,
        "sleep_until",
        "",
        personaOptions,
      );
    });
  });
});

// ============================================================================
// getSleepState()
// ============================================================================

describe("getSleepState", () => {
  const db = createMockDb();

  it("returns not sleeping when no sleep_until", async () => {
    mockStateValues({
      sleep_until: undefined,
    });

    const state = await getSleepState(db);
    expect(state.sleeping).toBe(false);
    expect(state.wakeTime).toBeUndefined();
    expect(state.reason).toBeUndefined();
  });

  it("returns not sleeping when sleep_until has passed", async () => {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    mockStateValues({
      sleep_until: oneHourAgo,
    });

    const state = await getSleepState(db);
    expect(state.sleeping).toBe(false);
  });

  it("returns sleeping state with details when actively sleeping", async () => {
    const oneHourFromNow = new Date(Date.now() + 3600000).toISOString();
    mockStateValues({
      sleep_until: oneHourFromNow,
    });

    const state = await getSleepState(db);
    expect(state.sleeping).toBe(true);
    expect(state.wakeTime).toBe(oneHourFromNow);
    expect(state.reason).toBeUndefined();
  });
});

// ============================================================================
// checkBatchGuard()
// ============================================================================

describe("checkBatchGuard", () => {
  const db = createMockDb();

  it("proceeds when no pending batches", async () => {
    mockGetPendingBatches.mockResolvedValue([]);

    const result = await checkBatchGuard(db);
    expect(result.proceed).toBe(true);
  });

  it("blocks when a batch is pending", async () => {
    mockGetPendingBatches.mockResolvedValue([
      { batch_id: "batch_123", status: "pending", duration_seconds: 45 },
    ]);

    const result = await checkBatchGuard(db);
    expect(result.proceed).toBe(false);
    expect(result.softSkip).toBe(false);
    expect(result.reason).toContain("pending batch");
    expect(result.reason).toContain("45");
  });

  it("blocks when a batch is processing", async () => {
    mockGetPendingBatches.mockResolvedValue([
      { batch_id: "batch_456", status: "processing", duration_seconds: 120 },
    ]);

    const result = await checkBatchGuard(db);
    expect(result.proceed).toBe(false);
  });

  it("proceeds when all batches are completed", async () => {
    mockGetPendingBatches.mockResolvedValue([
      { batch_id: "batch_789", status: "completed", duration_seconds: 300 },
    ]);

    const result = await checkBatchGuard(db);
    expect(result.proceed).toBe(true);
  });
});

// ============================================================================
// checkRunningGuard()
// ============================================================================

describe("checkRunningGuard", () => {
  const db = createMockDb();

  it("blocks when is_running is not set (loop paused)", async () => {
    mockStateValues({
      is_running: undefined,
    });

    const result = await checkRunningGuard(db);
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain("paused");
  });

  it('blocks when is_running is "false" (loop paused)', async () => {
    mockStateValues({
      is_running: "false",
    });

    const result = await checkRunningGuard(db);
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain("paused");
  });

  it('proceeds when is_running is "true" (loop active)', async () => {
    mockStateValues({
      is_running: "true",
    });

    const result = await checkRunningGuard(db);
    expect(result.proceed).toBe(true);
  });
});

// ============================================================================
// runAllGuards()
// ============================================================================

describe("runAllGuards", () => {
  const db = createMockDb();
  const defaultConfig = {
    intervalSeconds: 60,
    force: false,
  };

  describe("all guards pass", () => {
    it("proceeds when all conditions are met", async () => {
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      mockStateValues({
        is_running: "true",
        sleep_until: undefined,
        last_wake_time: twoMinutesAgo,
      });
      mockGetPendingBatches.mockResolvedValue([]);

      const result = await runAllGuards(db, defaultConfig);
      expect(result.proceed).toBe(true);
    });
  });

  describe("guard priority order", () => {
    it("running guard takes priority (blocks when paused)", async () => {
      mockStateValues({
        is_running: "false", // Loop paused
        sleep_until: new Date(Date.now() + 3600000).toISOString(), // Also sleeping
      });

      const result = await runAllGuards(db, defaultConfig);
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("paused");
    });

    it("batch guard takes priority over interval guard", async () => {
      mockStateValues({
        is_running: "true",
        sleep_until: undefined,
        last_wake_time: new Date(Date.now() - 10000).toISOString(), // Also interval not elapsed
      });
      mockGetPendingBatches.mockResolvedValue([
        { batch_id: "batch_1", status: "pending", duration_seconds: 30 },
      ]);

      const result = await runAllGuards(db, defaultConfig);
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("pending batch");
    });

    it("interval guard checked before sleep guard", async () => {
      // Guard order: running → batch → interval → sleep
      // If interval blocks, sleep guard is never reached
      mockStateValues({
        is_running: "true",
        sleep_until: new Date(Date.now() + 3600000).toISOString(), // Would block
        last_wake_time: new Date(Date.now() - 10000).toISOString(), // 10s of 60s elapsed
      });
      mockGetPendingBatches.mockResolvedValue([]);

      const result = await runAllGuards(db, defaultConfig);
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("Interval");
    });
  });

  describe("force flag", () => {
    it("bypasses interval check but not running guard", async () => {
      mockStateValues({
        is_running: "false", // Loop paused
        last_wake_time: new Date(Date.now() - 10000).toISOString(),
      });

      const result = await runAllGuards(db, {
        ...defaultConfig,
        force: true,
      });
      // Force doesn't bypass running guard
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("paused");
    });

    it("proceeds with force when only interval would block", async () => {
      mockStateValues({
        is_running: "true",
        sleep_until: undefined,
        last_wake_time: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
      });
      mockGetPendingBatches.mockResolvedValue([]);

      const result = await runAllGuards(db, {
        ...defaultConfig,
        force: true,
      });
      expect(result.proceed).toBe(true);
    });
  });
});

// ============================================================================
// PERSONA ISOLATION (BUG-010 FIX)
// ============================================================================

describe("persona isolation", () => {
  const db = createMockDb();
  const personaOptions = { personaId: 99 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStateValues({});
  });

  it("checkIntervalGuard passes persona options to getState", async () => {
    mockStateValues({
      last_wake_time: new Date(Date.now() - 120000).toISOString(),
    });

    await checkIntervalGuard(db, 60, false, personaOptions);

    expect(mockGetState).toHaveBeenCalledWith(
      db,
      "last_wake_time",
      personaOptions,
    );
  });

  it("checkSleepGuard passes persona options to getState", async () => {
    mockStateValues({
      sleep_until: undefined,
    });

    await checkSleepGuard(db, personaOptions);

    expect(mockGetState).toHaveBeenCalledWith(
      db,
      "sleep_until",
      personaOptions,
    );
  });

  it("checkBatchGuard calls getPendingBatches (no persona options)", async () => {
    mockGetPendingBatches.mockResolvedValue([]);

    await checkBatchGuard(db);

    expect(mockGetPendingBatches).toHaveBeenCalledWith(db);
  });

  it("checkRunningGuard passes persona options to getState", async () => {
    mockStateValues({
      is_running: "true",
    });

    await checkRunningGuard(db, personaOptions);

    expect(mockGetState).toHaveBeenCalledWith(db, "is_running", personaOptions);
  });

  it("getSleepState passes persona options to getState", async () => {
    mockStateValues({
      sleep_until: new Date(Date.now() + 3600000).toISOString(),
    });

    await getSleepState(db, personaOptions);

    expect(mockGetState).toHaveBeenCalledWith(
      db,
      "sleep_until",
      personaOptions,
    );
  });

  it("runAllGuards propagates persona options to all guards", async () => {
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    mockStateValues({
      is_running: "true",
      sleep_until: undefined,
      last_wake_time: twoMinutesAgo,
    });
    mockGetPendingBatches.mockResolvedValue([]);

    await runAllGuards(db, {
      intervalSeconds: 60,
      personaOptions,
    });

    // All getState calls should include persona options
    for (const call of mockGetState.mock.calls) {
      expect(call[2]).toEqual(personaOptions);
    }
  });

  it("runAllGuards uses empty options when personaOptions not provided", async () => {
    const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
    mockStateValues({
      is_running: "true",
      sleep_until: undefined,
      last_wake_time: twoMinutesAgo,
    });
    mockGetPendingBatches.mockResolvedValue([]);

    await runAllGuards(db, {
      intervalSeconds: 60,
    });

    // All getState calls should use empty options
    for (const call of mockGetState.mock.calls) {
      expect(call[2]).toEqual({});
    }
  });
});

// ============================================================================
// EDGE CASES & REAL-WORLD SCENARIOS
// ============================================================================

describe("edge cases", () => {
  const db = createMockDb();

  it("handles invalid date in last_wake_time", async () => {
    mockStateValues({
      last_wake_time: "invalid-date",
    });

    // Should not throw, but behavior depends on implementation
    // Invalid Date comparison will likely result in proceed: true
    const result = await checkIntervalGuard(db, 60);
    // Just verify it doesn't throw
    expect(typeof result.proceed).toBe("boolean");
  });

  it("handles very large interval values", async () => {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    mockStateValues({
      last_wake_time: oneMinuteAgo,
    });

    // 24 hour interval
    const result = await checkIntervalGuard(db, 86400);
    expect(result.proceed).toBe(false);
  });

  it("handles zero interval", async () => {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();
    mockStateValues({
      last_wake_time: oneSecondAgo,
    });

    const result = await checkIntervalGuard(db, 0);
    expect(result.proceed).toBe(true);
  });
});

describe("real-world scenarios", () => {
  const db = createMockDb();

  describe("normal cron operation", () => {
    it("allows cycle when conditions are normal", async () => {
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      mockStateValues({
        is_running: "true",
        sleep_until: undefined,
        last_wake_time: twoMinutesAgo,
      });
      mockGetPendingBatches.mockResolvedValue([]);

      const result = await runAllGuards(db, {
        intervalSeconds: 60,
      });
      expect(result.proceed).toBe(true);
    });
  });

  describe("user manually triggered /think-now", () => {
    it("allows forced cycle even if interval not elapsed", async () => {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      mockStateValues({
        is_running: "true",
        sleep_until: undefined,
        last_wake_time: tenSecondsAgo,
      });
      mockGetPendingBatches.mockResolvedValue([]);

      const result = await runAllGuards(db, {
        intervalSeconds: 60,
        force: true,
      });
      expect(result.proceed).toBe(true);
    });
  });

  describe("SLEEP action scenario", () => {
    it("blocks cycles during sleep period", async () => {
      const thirtyMinutesFromNow = new Date(Date.now() + 1800000).toISOString();
      mockStateValues({
        is_running: "true",
        sleep_until: thirtyMinutesFromNow,
        last_wake_time: new Date(Date.now() - 120000).toISOString(),
      });
      mockGetPendingBatches.mockResolvedValue([]);

      const result = await runAllGuards(db, {
        intervalSeconds: 60,
      });
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("Sleeping");
    });
  });

  describe("batch mode waiting for completion", () => {
    it("blocks while batch is pending", async () => {
      mockStateValues({
        is_running: "true",
        sleep_until: undefined,
        last_wake_time: new Date(Date.now() - 120000).toISOString(),
      });
      mockGetPendingBatches.mockResolvedValue([
        { batch_id: "batch_1", status: "pending", duration_seconds: 60 },
      ]);

      const result = await runAllGuards(db, {
        intervalSeconds: 60,
      });
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("pending batch");
    });
  });

  describe("loop paused prevention", () => {
    it("blocks when loop is paused", async () => {
      mockStateValues({
        is_running: "false",
        last_wake_time: new Date(Date.now() - 120000).toISOString(),
      });

      const result = await runAllGuards(db, {
        intervalSeconds: 60,
      });
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("paused");
    });
  });
});
