/**
 * @module @persistence/llm/__tests__/batches.test
 * @description Unit tests for batch state management
 *
 * Tests cover:
 * - Timeout configuration (getBatchTimeout, setBatchTimeout)
 * - Hard timeout configuration (getBatchHardTimeout, setBatchHardTimeout)
 * - Batch CRUD operations (storePendingBatch, getPendingBatches, updatePendingBatch, listPendingBatches)
 * - Batch window timing (isInBatchWindow, isUserRecentlyActive)
 * - Batch cancellation (cancelBatch)
 *
 * @covers ../batches.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BATCH_WINDOW,
  BATCH_HARD_TIMEOUT_SECONDS,
  getBatchTimeout,
  setBatchTimeout,
  getBatchHardTimeout,
  setBatchHardTimeout,
  listPendingBatches,
  storePendingBatch,
  getPendingBatches,
  updatePendingBatch,
  isInBatchWindow,
  isUserRecentlyActive,
  cancelBatch,
  type BatchApiStatus,
} from '../batches';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock @persistence/db
vi.mock('@persistence/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@persistence/db')>();
  return {
    ...actual,
    getState: vi.fn(),
    setState: vi.fn(),
    getActivePersonaId: vi.fn(() => Promise.resolve(1)),
  };
});

// Mock fetch for cancelBatch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  getState,
  setState,
  getActivePersonaId,
} from '@persistence/db';

type D1MockResult = {
  results: unknown[];
  success: boolean;
  meta: Record<string, unknown>;
};

// Create mock D1 database
function createMockDb() {
  const mockRawRun = vi.fn(() => Promise.resolve({ success: true }));
  const mockRawAll = vi.fn(() =>
    Promise.resolve({ results: [], success: true, meta: {} } as D1MockResult),
  );
  const mockRawBind = vi.fn(() => ({
    run: mockRawRun,
    all: mockRawAll,
  }));
  const mockRawPrepare = vi.fn(() => ({
    bind: mockRawBind,
    run: mockRawRun,
    all: mockRawAll,
  }));

  const mockInsertValues = vi.fn(() => Promise.resolve());
  const mockInsert = vi.fn(() => ({
    values: mockInsertValues,
  }));

  const mockSelectAll = vi.fn(() => Promise.resolve([]));
  const mockSelectGet = vi.fn(() => Promise.resolve(undefined));
  const mockSelectLimit = vi.fn(() => ({
    get: mockSelectGet,
  }));
  const mockSelectOrderBy = vi.fn(() => ({
    all: mockSelectAll,
    get: mockSelectGet,
    limit: mockSelectLimit,
  }));
  const mockSelectWhere = vi.fn(() => ({
    all: mockSelectAll,
    get: mockSelectGet,
    orderBy: mockSelectOrderBy,
  }));
  const mockSelectFrom = vi.fn(() => ({
    all: mockSelectAll,
    get: mockSelectGet,
    where: mockSelectWhere,
    orderBy: mockSelectOrderBy,
  }));
  const mockSelect = vi.fn(() => ({
    from: mockSelectFrom,
  }));

  return {
    $client: {
      prepare: mockRawPrepare,
    },
    insert: mockInsert,
    select: mockSelect,
    _mockRawRun: mockRawRun,
    _mockRawAll: mockRawAll,
    _mockRawBind: mockRawBind,
    _mockRawPrepare: mockRawPrepare,
    _mockInsert: mockInsert,
    _mockInsertValues: mockInsertValues,
    _mockSelect: mockSelect,
    _mockSelectFrom: mockSelectFrom,
    _mockSelectWhere: mockSelectWhere,
    _mockSelectOrderBy: mockSelectOrderBy,
    _mockSelectLimit: mockSelectLimit,
    _mockSelectAll: mockSelectAll,
    _mockSelectGet: mockSelectGet,
  };
}

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe('Batch Constants', () => {
  describe('BATCH_WINDOW', () => {
    it('has valid hour range', () => {
      expect(BATCH_WINDOW.startHour).toBeGreaterThanOrEqual(0);
      expect(BATCH_WINDOW.startHour).toBeLessThan(24);
      expect(BATCH_WINDOW.endHour).toBeGreaterThan(0);
      expect(BATCH_WINDOW.endHour).toBeLessThanOrEqual(24);
    });

    it('has reasonable activity override', () => {
      expect(BATCH_WINDOW.userActivityOverrideMinutes).toBeGreaterThan(0);
      expect(BATCH_WINDOW.userActivityOverrideMinutes).toBeLessThanOrEqual(120);
    });

    it('is disabled by default', () => {
      expect(BATCH_WINDOW.enabled).toBe(false);
    });
  });

  describe('BATCH_HARD_TIMEOUT_SECONDS', () => {
    it('is 54 minutes (3240 seconds)', () => {
      expect(BATCH_HARD_TIMEOUT_SECONDS).toBe(54 * 60);
      expect(BATCH_HARD_TIMEOUT_SECONDS).toBe(3240);
    });
  });
});

// =============================================================================
// TIMEOUT CONFIGURATION TESTS
// =============================================================================

describe('Timeout Configuration', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe('getBatchTimeout()', () => {
    it('returns custom timeout when set', async () => {
      vi.mocked(getState).mockResolvedValueOnce('7200'); // 2 hours
      const timeout = await getBatchTimeout(mockDb as any);
      expect(timeout).toBe(7200);
    });

    it('returns auto-calculated timeout when set to "auto"', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce('auto') // batch_timeout_seconds
        .mockResolvedValueOnce('300'); // cycle_interval_seconds
      const timeout = await getBatchTimeout(mockDb as any);
      expect(timeout).toBe(150); // 300 / 2
    });

    it('returns auto-calculated timeout when not set', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null) // batch_timeout_seconds
        .mockResolvedValueOnce('600'); // cycle_interval_seconds
      const timeout = await getBatchTimeout(mockDb as any);
      expect(timeout).toBe(300); // 600 / 2
    });

    it('enforces minimum 60 second timeout', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('60'); // Very short cycle
      const timeout = await getBatchTimeout(mockDb as any);
      expect(timeout).toBe(60); // Min 60, not 30
    });

    it('uses default 300s interval when none set', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const timeout = await getBatchTimeout(mockDb as any);
      expect(timeout).toBe(150); // 300 / 2
    });

    it('passes personaId option', async () => {
      vi.mocked(getState).mockResolvedValueOnce('1800');
      await getBatchTimeout(mockDb as any, { personaId: 5 });
      expect(getState).toHaveBeenCalledWith(mockDb, 'batch_timeout_seconds', { personaId: 5 });
    });
  });

  describe('setBatchTimeout()', () => {
    it('sets numeric timeout', async () => {
      const result = await setBatchTimeout(mockDb as any, 3600);
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_timeout_seconds', '3600', {});
      expect(result.timeout).toBe('3600');
    });

    it('sets string timeout', async () => {
      const result = await setBatchTimeout(mockDb as any, '1800');
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_timeout_seconds', '1800', {});
      expect(result.timeout).toBe('1800');
    });

    it('resets to auto when null', async () => {
      const result = await setBatchTimeout(mockDb as any, null);
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_timeout_seconds', null, {});
      expect(result.timeout).toBe('auto');
    });

    it('resets to auto when "auto"', async () => {
      const result = await setBatchTimeout(mockDb as any, 'auto');
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_timeout_seconds', null, {});
      expect(result.timeout).toBe('auto');
    });
  });

  describe('getBatchHardTimeout()', () => {
    it('returns custom hard timeout when set', async () => {
      vi.mocked(getState).mockResolvedValueOnce('5400'); // 90 min
      const timeout = await getBatchHardTimeout(mockDb as any);
      expect(timeout).toBe(5400);
    });

    it('returns default when not set', async () => {
      vi.mocked(getState).mockResolvedValueOnce(null);
      const timeout = await getBatchHardTimeout(mockDb as any);
      expect(timeout).toBe(BATCH_HARD_TIMEOUT_SECONDS);
    });

    it('returns default when set to "auto"', async () => {
      vi.mocked(getState).mockResolvedValueOnce('auto');
      const timeout = await getBatchHardTimeout(mockDb as any);
      expect(timeout).toBe(BATCH_HARD_TIMEOUT_SECONDS);
    });
  });

  describe('setBatchHardTimeout()', () => {
    it('sets hard timeout', async () => {
      const result = await setBatchHardTimeout(mockDb as any, 5400);
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_hard_timeout_seconds', '5400', {});
      expect(result.hardTimeout).toBe(5400);
    });

    it('resets to default when null', async () => {
      const result = await setBatchHardTimeout(mockDb as any, null);
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_hard_timeout_seconds', null, {});
      expect(result.hardTimeout).toBe(BATCH_HARD_TIMEOUT_SECONDS);
    });
  });
});

// =============================================================================
// BATCH CRUD TESTS
// =============================================================================

describe('Batch CRUD Operations', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe('listPendingBatches()', () => {
    it('queries pending and processing batches', async () => {
      mockDb._mockRawAll.mockResolvedValueOnce({
        results: [
          { batch_id: 'batch_001', status: 'pending', duration_seconds: 60 },
          { batch_id: 'batch_002', status: 'processing', duration_seconds: 120 },
        ],
        success: true,
        meta: {},
      });

      const results = await listPendingBatches(mockDb as any);

      expect(results).toHaveLength(2);
      expect(mockDb._mockRawPrepare).toHaveBeenCalled();
    });

    it('filters by personaId when provided', async () => {
      mockDb._mockRawAll.mockResolvedValueOnce({ results: [], success: true, meta: {} });

      await listPendingBatches(mockDb as any, { personaId: 3 });

      expect(mockDb._mockRawBind).toHaveBeenCalledWith(3);
    });

    it('returns empty array when no batches', async () => {
      mockDb._mockRawAll.mockResolvedValueOnce({ results: [], success: true, meta: {} });

      const results = await listPendingBatches(mockDb as any);

      expect(results).toEqual([]);
    });
  });

  describe('storePendingBatch()', () => {
    it('stores batch with all fields', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null) // batch_timeout_seconds (for getBatchTimeout)
        .mockResolvedValueOnce('300'); // cycle_interval_seconds

      await storePendingBatch(
        mockDb as any,
        'batch_abc123',
        'custom-001',
        42,
        'cron',
        'claude-opus'
      );

      expect(mockDb._mockInsert).toHaveBeenCalledOnce();
      expect(mockDb._mockInsertValues).toHaveBeenCalledWith({
        personaId: 1,
        batchId: 'batch_abc123',
        customId: 'custom-001',
        cycleId: 42,
        trigger: 'cron',
        model: 'claude-opus',
        status: 'pending',
        timeoutSeconds: 150,
      });
    });

    it('stores null cycle_id when not provided', async () => {
      // getState is called once for batch_timeout_seconds
      // When it returns a value (not null/auto), it doesn't call for cycle_interval
      vi.mocked(getState).mockResolvedValueOnce('600'); // batch_timeout_seconds = 600

      await storePendingBatch(
        mockDb as any,
        'batch_xyz',
        'custom-002',
        null,
        'manual',
        'claude-sonnet'
      );

      expect(mockDb._mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: 'batch_xyz',
          cycleId: null,
          timeoutSeconds: 600,
        }),
      );
    });

    it('captures timeout at submission time', async () => {
      vi.mocked(getState).mockResolvedValueOnce('7200'); // Custom timeout

      await storePendingBatch(
        mockDb as any,
        'batch_timed',
        'custom-003',
        1,
        'cron',
        'claude-haiku'
      );

      // Verify the 7200 timeout was included in the insert
      const insertCall = mockDb._mockInsertValues.mock.calls[0]?.[0];
      expect(insertCall.timeoutSeconds).toBe(7200);
    });
  });

  describe('getPendingBatches()', () => {
    it('returns pending batches from the Drizzle query chain', async () => {
      mockDb._mockSelectAll.mockResolvedValueOnce([]);

      await getPendingBatches(mockDb as any);

      expect(mockDb._mockSelect).toHaveBeenCalledOnce();
      expect(mockDb._mockSelectFrom).toHaveBeenCalledOnce();
      expect(mockDb._mockSelectWhere).toHaveBeenCalledOnce();
      expect(mockDb._mockSelectOrderBy).toHaveBeenCalledOnce();
    });

    it('preserves computed duration_seconds from the query result', async () => {
      mockDb._mockSelectAll.mockResolvedValueOnce([
        { id: 1, batch_id: 'batch_001', status: 'canceling', duration_seconds: 3600 },
      ]);

      const results = await getPendingBatches(mockDb as any);

      expect(results[0].duration_seconds).toBe(3600);
      expect(results[0].status).toBe('canceling');
    });

    it('honors an explicit personaId instead of silently re-reading the active persona', async () => {
      vi.mocked(getActivePersonaId).mockResolvedValueOnce(99);
      mockDb._mockSelectAll.mockResolvedValueOnce([]);

      await getPendingBatches(mockDb as any, { personaId: 2 });

      expect(getActivePersonaId).not.toHaveBeenCalled();
      expect(mockDb._mockSelectWhere).toHaveBeenCalledOnce();
    });
  });

  describe('updatePendingBatch()', () => {
    it('sets completed_at for terminal status (completed)', async () => {
      vi.mocked(getActivePersonaId).mockResolvedValueOnce(1);

      await updatePendingBatch(mockDb as any, 'batch_done', 'completed', '{"ok":true}');

      expect(mockDb._mockRawPrepare).toHaveBeenCalledWith(
        expect.stringContaining("completed_at = datetime('now')")
      );
    });

    it('sets completed_at for terminal status (failed)', async () => {
      vi.mocked(getActivePersonaId).mockResolvedValueOnce(1);

      await updatePendingBatch(mockDb as any, 'batch_err', 'failed', null, 'Error message');

      expect(mockDb._mockRawPrepare).toHaveBeenCalledWith(
        expect.stringContaining("completed_at = datetime('now')")
      );
    });

    it('does NOT set completed_at for processing status', async () => {
      vi.mocked(getActivePersonaId).mockResolvedValueOnce(1);

      await updatePendingBatch(mockDb as any, 'batch_proc', 'processing');

      expect(mockDb._mockRawPrepare).toHaveBeenCalledWith(
        expect.not.stringContaining('completed_at')
      );
    });

    it('tracks cancelled_by for canceled status', async () => {
      vi.mocked(getActivePersonaId).mockResolvedValueOnce(1);

      await updatePendingBatch(
        mockDb as any,
        'batch_cancel',
        'canceled',
        null,
        'Timed out',
        { cancelledBy: 'auto_timeout' }
      );

      expect(mockDb._mockRawBind).toHaveBeenCalledWith(
        'canceled',
        null,
        'Timed out',
        'auto_timeout',
        1,
        'batch_cancel'
      );
    });
  });
});

// =============================================================================
// BATCH WINDOW TESTS
// =============================================================================

describe('Batch Window Timing', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe('isInBatchWindow()', () => {
    // NOTE: The function calls getState TWICE in order:
    // 1. batch_enabled
    // 2. batch_until
    // batch_until is checked FIRST (takes priority if set)

    it('returns true when explicitly enabled (no timed batch)', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce('true') // batch_enabled
        .mockResolvedValueOnce(null);  // batch_until (not set)

      const result = await isInBatchWindow(mockDb as any);

      expect(result).toBe(true);
    });

    it('returns false when explicitly disabled (no timed batch)', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce('false') // batch_enabled
        .mockResolvedValueOnce(null);   // batch_until (not set)

      const result = await isInBatchWindow(mockDb as any);

      expect(result).toBe(false);
    });

    it('returns true when timed batch is active (overrides explicit setting)', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      vi.mocked(getState)
        .mockResolvedValueOnce('false')    // batch_enabled (would normally be false)
        .mockResolvedValueOnce(futureTime); // batch_until (active timer overrides)

      const result = await isInBatchWindow(mockDb as any);

      expect(result).toBe(true);
    });

    it('auto-disables when timed batch expires', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      vi.mocked(getState)
        .mockResolvedValueOnce(null)     // batch_enabled
        .mockResolvedValueOnce(pastTime); // batch_until (expired)

      const result = await isInBatchWindow(mockDb as any);

      expect(result).toBe(false);
      // Verify auto-disable calls
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_enabled', 'false', {});
      expect(setState).toHaveBeenCalledWith(mockDb, 'batch_until', null, {});
    });

    it('returns false when BATCH_WINDOW.enabled is false (no explicit setting)', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null) // No explicit batch_enabled setting
        .mockResolvedValueOnce(null); // No batch_until timer

      // BATCH_WINDOW.enabled is false by default
      const result = await isInBatchWindow(mockDb as any);

      expect(result).toBe(false);
    });
  });

  describe('isUserRecentlyActive()', () => {
    it('returns false when no user_message exists', async () => {
      mockDb._mockSelectGet.mockResolvedValueOnce(undefined);

      const result = await isUserRecentlyActive(mockDb as any);

      expect(result).toBe(false);
    });

    it('returns true when Dan messaged within override window', async () => {
      const recentTime = new Date(Date.now() - 5 * 60000).toISOString(); // 5 min ago
      mockDb._mockSelectGet.mockResolvedValueOnce({ created_at: recentTime });

      const result = await isUserRecentlyActive(mockDb as any);

      expect(result).toBe(true);
    });

    it('returns false when Dan last messaged outside override window', async () => {
      const oldTime = new Date(Date.now() - 60 * 60000).toISOString(); // 60 min ago
      mockDb._mockSelectGet.mockResolvedValueOnce({ created_at: oldTime });

      const result = await isUserRecentlyActive(mockDb as any);

      expect(result).toBe(false);
    });

    it('uses BATCH_WINDOW.userActivityOverrideMinutes threshold', async () => {
      // At exactly the threshold
      const thresholdTime = new Date(
        Date.now() - (BATCH_WINDOW.userActivityOverrideMinutes - 1) * 60000
      ).toISOString();
      mockDb._mockSelectGet.mockResolvedValueOnce({ created_at: thresholdTime });

      const result = await isUserRecentlyActive(mockDb as any);

      expect(result).toBe(true);
    });

    it('honors an explicit personaId instead of silently re-reading the active persona', async () => {
      const recentTime = new Date(Date.now() - 5 * 60000).toISOString();
      vi.mocked(getActivePersonaId).mockResolvedValueOnce(77);
      mockDb._mockSelectGet.mockResolvedValueOnce({ created_at: recentTime });

      const result = await isUserRecentlyActive(mockDb as any, { personaId: 2 });

      expect(result).toBe(true);
      expect(getActivePersonaId).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// BATCH CANCELLATION TESTS
// =============================================================================

describe('Batch Cancellation', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getActivePersonaId).mockResolvedValue(1);
  });

  describe('cancelBatch()', () => {
    it('calls Anthropic cancel endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          processing_status: 'canceling',
          cancel_initiated_at: '2026-01-29T12:00:00Z',
        }),
      });

      await cancelBatch('batch_abc123', 'test-api-key', mockDb as any);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages/batches/batch_abc123/cancel',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });

    it('returns success result with status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          processing_status: 'canceling',
          cancel_initiated_at: '2026-01-29T12:00:00Z',
        }),
      });

      const result = await cancelBatch('batch_xyz', 'api-key', mockDb as any);

      expect(result.success).toBe(true);
      expect(result.status).toBe('canceling');
      expect(result.cancelInitiatedAt).toBe('2026-01-29T12:00:00Z');
      expect(result.cancelledBy).toBe('user');
    });

    it('updates database record', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processing_status: 'canceling' }),
      });

      await cancelBatch('batch_update', 'api-key', mockDb as any);

      expect(mockDb._mockRawPrepare).toHaveBeenCalled();
    });

    it('tracks auto_timeout cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processing_status: 'canceling' }),
      });

      const result = await cancelBatch('batch_timeout', 'api-key', mockDb as any, {
        cancelledBy: 'auto_timeout',
      });

      expect(result.cancelledBy).toBe('auto_timeout');
    });

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { message: 'Batch not found' } }),
      });

      const result = await cancelBatch('batch_missing', 'api-key', mockDb as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch not found');
    });

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await cancelBatch('batch_network', 'api-key', mockDb as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});

// =============================================================================
// EDGE CASES & INTEGRATION SCENARIOS
// =============================================================================

describe('Real-world Scenarios', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  describe('Batch lifecycle', () => {
    it('handles full batch lifecycle: submit -> process -> complete', async () => {
      // Setup mocks for each stage
      vi.mocked(getState).mockResolvedValue('300'); // cycle_interval
      vi.mocked(getActivePersonaId).mockResolvedValue(1);
      mockDb._mockSelectAll.mockResolvedValue([
        {
          id: 1,
          batch_id: 'batch_lifecycle',
          status: 'processing',
          duration_seconds: 60,
        },
      ]);

      // 1. Store new batch
      await storePendingBatch(mockDb as any, 'batch_lifecycle', 'custom-1', 1, 'cron', 'opus');
      expect(mockDb._mockInsertValues).toHaveBeenCalled();

      // 2. Query pending batches
      const pending = await getPendingBatches(mockDb as any);
      expect(pending).toHaveLength(1);

      // 3. Update to completed
      await updatePendingBatch(mockDb as any, 'batch_lifecycle', 'completed', '{"result":"ok"}');
      expect(mockDb._mockRawPrepare).toHaveBeenCalledWith(
        expect.stringContaining('completed_at')
      );
    });
  });

  describe('Timeout edge cases', () => {
    it('calculates minimum timeout correctly for fast cycles', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null) // batch_timeout_seconds
        .mockResolvedValueOnce('30'); // 30 second cycle (very fast)

      const timeout = await getBatchTimeout(mockDb as any);

      // Should be min 60, not 15 (30/2)
      expect(timeout).toBe(60);
    });
  });

  describe('Window timing edge cases', () => {
    it('handles missing batch_enabled gracefully', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(undefined as any)
        .mockResolvedValueOnce(null);

      // Should not throw, should return false (BATCH_WINDOW.enabled is false)
      const result = await isInBatchWindow(mockDb as any);
      expect(result).toBe(false);
    });

    it('handles invalid batch_until date', async () => {
      vi.mocked(getState)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('not-a-date');

      // Invalid date will create NaN timestamp, comparison will fail
      // This should auto-disable because Date.now() >= NaN is false
      const result = await isInBatchWindow(mockDb as any);

      // Behavior: invalid date counts as "still active" (NaN comparison)
      // This is actually a bug we're documenting via this test
      expect(result).toBe(true);
    });
  });
});
