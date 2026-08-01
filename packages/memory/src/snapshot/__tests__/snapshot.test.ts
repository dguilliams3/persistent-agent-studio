/**
 * @module @persistence/memory/snapshot/__tests__/snapshot.test
 * @description Unit tests for snapshot module functions
 *
 * Tests cover:
 * - calculateChecksum() - SHA-256 hashing of snapshot content
 * - verifyChecksum() - Checksum validation and integrity verification
 * - validateSnapshotFormat() - Format validation and schema compliance
 *
 * @covers checksum.ts, validation.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateChecksum, verifyChecksum } from '../checksum';
import { validateSnapshotFormat } from '../validation';
import { SNAPSHOT_VERSION } from '../constants';
import type { PersonalitySnapshot } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Minimal valid snapshot for testing
 */
function createValidSnapshot(overrides: Partial<PersonalitySnapshot> = {}): PersonalitySnapshot {
  return {
    meta: {
      version: SNAPSHOT_VERSION,
      exportedAt: '2026-02-01T12:00:00Z',
      sourceHost: 'test.example.com',
      name: 'Test Snapshot',
      description: 'A test snapshot',
      ...overrides.meta,
    },
    state: {
      loop_count: 100,
      total_cost_cents: 500,
      ...overrides.state,
    },
    memories: {
      history: [],
      coldStorage: [],
      notebook: [],
      observations: [],
      summaries: [],
      reminders: [],
      imageRefs: [],
      ...overrides.memories,
    },
    media: {
      profilePicture: null,
      gallery: [],
      ...overrides.media,
    },
    branches: {
      list: [],
      overrides: [],
      synthetics: [],
      activeBranch: 'main',
      ...overrides.branches,
    },
    systemPrompt: {
      template: 'You are Claude',
      customizations: {},
      ...overrides.systemPrompt,
    },
    ...overrides,
  };
}

// ============================================================================
// calculateChecksum()
// ============================================================================

describe('calculateChecksum', () => {
  describe('consistency', () => {
    it('produces the same hash for identical inputs', async () => {
      const snapshot = createValidSnapshot();
      const hash1 = await calculateChecksum(snapshot);
      const hash2 = await calculateChecksum(snapshot);
      expect(hash1).toBe(hash2);
    });

    it('produces consistent hash format (hex string)', async () => {
      const snapshot = createValidSnapshot();
      const hash = await calculateChecksum(snapshot);
      // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different content', async () => {
      const snapshot1 = createValidSnapshot({
        state: { loop_count: 100 },
      });
      const snapshot2 = createValidSnapshot({
        state: { loop_count: 101 },
      });
      const hash1 = await calculateChecksum(snapshot1);
      const hash2 = await calculateChecksum(snapshot2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('meta field exclusion', () => {
    it('ignores meta field when calculating checksum', async () => {
      const baseSnapshot = createValidSnapshot();
      const snapshotWithMeta = createValidSnapshot({
        meta: {
          ...baseSnapshot.meta,
          checksum: 'sha256:abc123',
          exportedAt: '2026-02-01T13:00:00Z', // Different timestamp
        },
      });

      const hash1 = await calculateChecksum(baseSnapshot);
      const hash2 = await calculateChecksum(snapshotWithMeta);
      expect(hash1).toBe(hash2); // Same content (excluding meta)
    });

    it('produces same hash when only meta.checksum changes', async () => {
      const snapshot = createValidSnapshot({
        meta: { checksum: 'sha256:old' },
      });
      const snapshotNoChecksum = createValidSnapshot();

      const hash1 = await calculateChecksum(snapshot);
      const hash2 = await calculateChecksum(snapshotNoChecksum);
      expect(hash1).toBe(hash2);
    });

    it('produces same hash when only meta.exportedAt changes', async () => {
      const snapshot1 = createValidSnapshot({
        meta: { exportedAt: '2026-02-01T12:00:00Z' },
      });
      const snapshot2 = createValidSnapshot({
        meta: { exportedAt: '2026-02-02T12:00:00Z' },
      });

      const hash1 = await calculateChecksum(snapshot1);
      const hash2 = await calculateChecksum(snapshot2);
      expect(hash1).toBe(hash2);
    });
  });

  describe('content sensitivity', () => {
    it('detects changes in state', async () => {
      const snapshot1 = createValidSnapshot({
        state: { loop_count: 100 },
      });
      const snapshot2 = createValidSnapshot({
        state: { loop_count: 101 },
      });

      const hash1 = await calculateChecksum(snapshot1);
      const hash2 = await calculateChecksum(snapshot2);
      expect(hash1).not.toBe(hash2);
    });

    it('detects changes in memories', async () => {
      const snapshot1 = createValidSnapshot({
        memories: { history: [] },
      });
      const snapshot2 = createValidSnapshot({
        memories: {
          history: [
            {
              id: 1,
              type: 'thought',
              content: 'test',
              created_at: '2026-02-01T12:00:00Z',
            },
          ],
        },
      });

      const hash1 = await calculateChecksum(snapshot1);
      const hash2 = await calculateChecksum(snapshot2);
      expect(hash1).not.toBe(hash2);
    });

    it('detects changes in system prompt', async () => {
      const snapshot1 = createValidSnapshot({
        systemPrompt: { template: 'You are Claude' },
      });
      const snapshot2 = createValidSnapshot({
        systemPrompt: { template: 'You are Claude AI' },
      });

      const hash1 = await calculateChecksum(snapshot1);
      const hash2 = await calculateChecksum(snapshot2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('edge cases', () => {
    it('handles empty snapshot gracefully', async () => {
      const emptySnapshot = {} as PersonalitySnapshot;
      const hash = await calculateChecksum(emptySnapshot);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles complex nested structures', async () => {
      const complexSnapshot = createValidSnapshot({
        memories: {
          history: [
            {
              id: 1,
              type: 'thought',
              content: 'Complex content with "quotes" and special chars: @#$%',
              internal: 'internal data',
              created_at: '2026-02-01T12:00:00Z',
              summarized_at: '2026-02-01T13:00:00Z',
              meter_snapshot: 'A7 C6 N10',
            },
            {
              id: 2,
              type: 'message_to_user',
              content: 'Multi\nline\ncontent',
              created_at: '2026-02-01T12:30:00Z',
            },
          ],
        },
      });

      const hash = await calculateChecksum(complexSnapshot);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles unicode characters', async () => {
      const unicodeSnapshot = createValidSnapshot({
        state: { user_profile: '你好世界 🌍 Привет' },
      });
      const hash = await calculateChecksum(unicodeSnapshot);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

// ============================================================================
// verifyChecksum()
// ============================================================================

describe('verifyChecksum', () => {
  describe('valid checksums', () => {
    it('returns true for valid checksum', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);
      const snapshotWithChecksum = createValidSnapshot({
        meta: { checksum: `sha256:${checksum}` },
      });

      const isValid = await verifyChecksum(snapshotWithChecksum);
      expect(isValid).toBe(true);
    });

    it('returns true for checksum without sha256: prefix', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);
      const snapshotWithChecksum = createValidSnapshot({
        meta: { checksum }, // No prefix
      });

      const isValid = await verifyChecksum(snapshotWithChecksum);
      expect(isValid).toBe(true);
    });

    it('returns true when no checksum is present', async () => {
      const snapshot = createValidSnapshot({
        meta: { checksum: undefined },
      });

      const isValid = await verifyChecksum(snapshot);
      expect(isValid).toBe(true);
    });
  });

  describe('invalid/tampered checksums', () => {
    it('returns false for tampered checksum', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);
      // Corrupt the checksum by changing one character
      const corruptedChecksum = checksum.slice(0, -1) + '0';
      const snapshotWithBadChecksum = createValidSnapshot({
        meta: { checksum: `sha256:${corruptedChecksum}` },
      });

      const isValid = await verifyChecksum(snapshotWithBadChecksum);
      expect(isValid).toBe(false);
    });

    it('returns false when content has been modified', async () => {
      const snapshot = createValidSnapshot({ state: { loop_count: 100 } });
      const checksum = await calculateChecksum(snapshot);

      // Modify content but keep old checksum
      const modifiedSnapshot = createValidSnapshot({
        state: { loop_count: 200 },
        meta: { checksum: `sha256:${checksum}` },
      });

      const isValid = await verifyChecksum(modifiedSnapshot);
      expect(isValid).toBe(false);
    });

    it('returns false for completely wrong checksum', async () => {
      const snapshot = createValidSnapshot({
        meta: { checksum: 'sha256:' + 'a'.repeat(64) },
      });

      const isValid = await verifyChecksum(snapshot);
      expect(isValid).toBe(false);
    });
  });

  describe('checksum format handling', () => {
    it('handles sha256: prefix correctly', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);
      const snapshotWithPrefix = createValidSnapshot({
        meta: { checksum: `sha256:${checksum}` },
      });

      const isValid = await verifyChecksum(snapshotWithPrefix);
      expect(isValid).toBe(true);
    });

    it('handles checksum without prefix', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);
      const snapshotNoPrefix = createValidSnapshot({
        meta: { checksum },
      });

      const isValid = await verifyChecksum(snapshotNoPrefix);
      expect(isValid).toBe(true);
    });
  });

  describe('metadata changes', () => {
    it('still validates when meta.exportedAt changes', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);

      const snapshotWithNewTimestamp = createValidSnapshot({
        meta: {
          checksum: `sha256:${checksum}`,
          exportedAt: '2026-02-02T12:00:00Z', // Different timestamp
        },
      });

      const isValid = await verifyChecksum(snapshotWithNewTimestamp);
      expect(isValid).toBe(true);
    });

    it('still validates when other meta fields change', async () => {
      const snapshot = createValidSnapshot();
      const checksum = await calculateChecksum(snapshot);

      const snapshotWithNewMeta = createValidSnapshot({
        meta: {
          checksum: `sha256:${checksum}`,
          name: 'Different Name',
          description: 'Different Description',
          sourceHost: 'different.host.com',
        },
      });

      const isValid = await verifyChecksum(snapshotWithNewMeta);
      expect(isValid).toBe(true);
    });
  });
});

// ============================================================================
// validateSnapshotFormat()
// ============================================================================

describe('validateSnapshotFormat', () => {
  describe('valid snapshots', () => {
    it('accepts a valid snapshot', () => {
      const snapshot = createValidSnapshot();
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts snapshot with all required fields', () => {
      const snapshot = createValidSnapshot({
        meta: {
          version: SNAPSHOT_VERSION,
          exportedAt: '2026-02-01T12:00:00Z',
        },
        memories: {
          history: [
            {
              id: 1,
              type: 'thought',
              content: 'test',
              created_at: '2026-02-01T12:00:00Z',
            },
          ],
          coldStorage: [],
          notebook: [],
          observations: [],
          summaries: [],
          reminders: [],
          imageRefs: [],
        },
      });

      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('missing required fields', () => {
    it('rejects snapshot missing meta field', () => {
      const snapshot = createValidSnapshot();
      delete (snapshot as any).meta;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: meta');
    });

    it('rejects snapshot missing state field', () => {
      const snapshot = createValidSnapshot();
      delete (snapshot as any).state;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: state');
    });

    it('rejects snapshot missing memories field', () => {
      const snapshot = createValidSnapshot();
      delete (snapshot as any).memories;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: memories');
    });

    it('rejects snapshot with all required fields missing', () => {
      const snapshot = {} as PersonalitySnapshot;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3); // meta, state, memories
      expect(result.errors).toContain('Missing required field: meta');
      expect(result.errors).toContain('Missing required field: state');
      expect(result.errors).toContain('Missing required field: memories');
    });
  });

  describe('version validation', () => {
    it('rejects snapshot with wrong version', () => {
      const snapshot = createValidSnapshot({
        meta: { version: '1.0' }, // Wrong version
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) =>
        e.includes(`Unsupported version: 1.0 (expected ${SNAPSHOT_VERSION})`)
      )).toBe(true);
    });

    it('rejects snapshot missing version in meta', () => {
      const snapshot = createValidSnapshot();
      delete (snapshot.meta as any).version;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing meta.version');
    });

    it('accepts snapshot with correct version', () => {
      const snapshot = createValidSnapshot({
        meta: { version: SNAPSHOT_VERSION },
      });
      const result = validateSnapshotFormat(snapshot);
      // May have other validation issues, but version should be OK
      expect(
        result.errors.some((e) => e.includes('Unsupported version'))
      ).toBe(false);
    });
  });

  describe('meta field validation', () => {
    it('rejects meta missing exportedAt field', () => {
      const snapshot = createValidSnapshot();
      delete (snapshot.meta as any).exportedAt;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing meta.exportedAt');
    });

    it('rejects meta missing version field', () => {
      const snapshot = createValidSnapshot();
      delete (snapshot.meta as any).version;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing meta.version');
    });
  });

  describe('memories structure validation', () => {
    it('rejects when history is not an array', () => {
      const snapshot = createValidSnapshot({
        memories: { history: {} as any },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('memories.history must be an array');
    });

    it('rejects when coldStorage is not an array', () => {
      const snapshot = createValidSnapshot({
        memories: { coldStorage: null as any },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('memories.coldStorage must be an array');
    });

    it('rejects when notebook is not an array', () => {
      const snapshot = createValidSnapshot({
        memories: { notebook: 'not-an-array' as any },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('memories.notebook must be an array');
    });

    it('rejects when observations is not an array', () => {
      const snapshot = createValidSnapshot({
        memories: { observations: { items: [] } as any },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('memories.observations must be an array');
    });

    it('rejects when summaries is not an array', () => {
      const snapshot = createValidSnapshot({
        memories: { summaries: 123 as any },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('memories.summaries must be an array');
    });

    it('rejects when reminders is not an array', () => {
      const snapshot = createValidSnapshot({
        memories: { reminders: 'string' as any },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('memories.reminders must be an array');
    });

    it('accepts all memory types as empty arrays', () => {
      const snapshot = createValidSnapshot({
        memories: {
          history: [],
          coldStorage: [],
          notebook: [],
          observations: [],
          summaries: [],
          reminders: [],
          imageRefs: [],
        },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts populated memory arrays', () => {
      const snapshot = createValidSnapshot({
        memories: {
          history: [
            {
              id: 1,
              type: 'thought',
              content: 'test',
              created_at: '2026-02-01T12:00:00Z',
            },
          ],
          coldStorage: [
            { id: 1, content: 'test', created_at: '2026-02-01T12:00:00Z' },
          ],
          notebook: [
            { id: 1, title: 'test', content: 'test', created_at: '2026-02-01T12:00:00Z' },
          ],
          observations: [
            { id: 1, title: 'test', content: 'test', created_at: '2026-02-01T12:00:00Z' },
          ],
          summaries: [
            {
              id: 1,
              summary: 'test',
              message_count: 10,
              created_at: '2026-02-01T12:00:00Z',
            },
          ],
          reminders: [
            {
              id: 1,
              content: 'test',
              condition: 'daily',
              triggered: 0,
              created_at: '2026-02-01T12:00:00Z',
            },
          ],
          imageRefs: [],
        },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('error accumulation', () => {
    it('collects all validation errors', () => {
      const snapshot = {
        // Missing all required fields
      } as PersonalitySnapshot;
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports multiple memory type errors', () => {
      const snapshot = createValidSnapshot({
        memories: {
          history: {} as any, // Wrong type
          coldStorage: 'not-array' as any, // Wrong type
          notebook: null as any, // Wrong type
        },
      });
      const result = validateSnapshotFormat(snapshot);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('edge cases', () => {
    it('handles empty object gracefully', () => {
      const result = validateSnapshotFormat({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('throws error for null values', () => {
      expect(() => {
        validateSnapshotFormat(null as any);
      }).toThrow();
    });

    it('throws error for undefined values', () => {
      expect(() => {
        validateSnapshotFormat(undefined as any);
      }).toThrow();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('snapshot module integration', () => {
  it('checksum validates snapshots after export', async () => {
    // Simulate export flow
    const originalSnapshot = createValidSnapshot({
      state: { loop_count: 100 },
    });

    // Calculate checksum
    const checksum = await calculateChecksum(originalSnapshot);

    // Add checksum to exported snapshot
    const exportedSnapshot = createValidSnapshot({
      meta: { checksum: `sha256:${checksum}` },
      state: { loop_count: 100 },
    });

    // Verify exported snapshot
    const isValid = await verifyChecksum(exportedSnapshot);
    expect(isValid).toBe(true);
  });

  it('detects corruption during import', async () => {
    // Create and export snapshot
    const snapshot = createValidSnapshot();
    const checksum = await calculateChecksum(snapshot);
    const exportedSnapshot = createValidSnapshot({
      meta: { checksum: `sha256:${checksum}` },
      state: { loop_count: 100 },
    });

    // Simulate corruption
    const corruptedSnapshot = createValidSnapshot({
      meta: { checksum: `sha256:${checksum}` },
      state: { loop_count: 999 }, // Modified
    });

    const isValid = await verifyChecksum(corruptedSnapshot);
    expect(isValid).toBe(false);
  });

  it('validates and checks integrity together', async () => {
    // Create valid snapshot
    const snapshot = createValidSnapshot();
    const formatValid = validateSnapshotFormat(snapshot);
    expect(formatValid.valid).toBe(true);

    // Add checksum
    const checksum = await calculateChecksum(snapshot);
    const snapshotWithChecksum = createValidSnapshot({
      meta: { checksum: `sha256:${checksum}` },
    });

    // Both format and checksum should be valid
    const checksumValid = await verifyChecksum(snapshotWithChecksum);
    expect(checksumValid).toBe(true);
  });
});
