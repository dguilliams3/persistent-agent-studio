/**
 * Specimen surface fixtures — every demo surface has something honest to show
 *
 * @module api/demo/__tests__/specimenSurfaces.test
 * @description Covers the fixture pass that filled the exhibit's last empty
 * surfaces (MERGED_LEDGER §2 rows 7 + 12):
 *   - GET /observations serves ObservationEntry-shaped rows (the pattern
 *     journal is no longer `{observations: []}`)
 *   - GET /context matches the real handler's contract (systemPrompt +
 *     stats.tokenBreakdown + characterCount), with block sums internally
 *     consistent and inside the boundaries the Efficiencies page states
 *     (history tail rolls at 12K toward 6K; summary tail at 8K)
 *   - the pre-seeded film-test branch: listed, inert on main, serving its
 *     synthetics only while active, and clean again after flipping back
 *   - fixture hygiene: no entry content repeats the UI's own type label
 *     ("New Question: New question: …"), meter snapshots carry only defined
 *     meters (A/C/N/E/D), and timestamps are deterministic (no Math.random
 *     in the fixture module)
 *
 * Targets: `apps/web/api/demo/specimen.ts`, `apps/web/api/demo/index.ts`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { demoRequest } from '../index';
import {
  SPECIMEN_HISTORY,
  SPECIMEN_OBSERVATIONS,
  SPECIMEN_FILM_TEST_BRANCH,
} from '../specimen';

describe('specimen surface fixtures', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Advance the router's artificial latency. */
  async function settle<T>(promise: Promise<T>, ms = 200): Promise<T> {
    await vi.advanceTimersByTimeAsync(ms);
    return promise;
  }

  it('GET /observations serves the pattern journal in ObservationEntry shape', async () => {
    const data = (await settle(demoRequest('/observations'))) as {
      observations: Array<Record<string, unknown>>;
    };
    expect(data.observations.length).toBeGreaterThanOrEqual(3);
    for (const row of data.observations) {
      expect(typeof row.id).toBe('number');
      expect(typeof row.title).toBe('string');
      expect((row.title as string).length).toBeGreaterThan(0);
      expect(typeof row.summary).toBe('string');
      expect(typeof row.content).toBe('string');
      expect((row.content as string).length).toBeGreaterThan(40);
      expect(typeof row.created_at).toBe('string');
      expect(typeof row.updated_at).toBe('string');
      expect(row.deleted_at).toBeNull();
    }
  });

  it('GET /context matches the real contract with internally consistent blocks', async () => {
    const data = (await settle(demoRequest('/context'))) as {
      systemPrompt: string;
      characterCount: number;
      stats: Record<string, unknown> & {
        tokenBreakdown: Record<string, number>;
        ragRetrievedSummaries: unknown[];
      };
    };
    expect(typeof data.systemPrompt).toBe('string');
    expect(data.characterCount).toBe(data.systemPrompt.length);

    const b = data.stats.tokenBreakdown;
    // Sums derive from the parts — the claim can never exceed the arithmetic.
    expect(b.cachedTokens).toBe(b.block1_system + b.block2_stable + b.block3_summariesPrefix);
    expect(b.uncachedTokens).toBe(b.block4_fresh);
    expect(b.total).toBe(b.cachedTokens + b.uncachedTokens);
    expect(data.stats.estimatedInputTokens).toBe(b.total);
    // Efficiencies-page consistency: the fresh history tail lives between its
    // 6K roll target and its 12K roll threshold; the cached summaries prefix
    // stays under the 8K summary-tail threshold.
    expect(b.block4_fresh).toBeGreaterThan(6000);
    expect(b.block4_fresh).toBeLessThan(12000);
    expect(b.block3_summariesPrefix).toBeLessThan(8000);
    // Counts are derived from the fixtures, not restated by hand.
    expect(data.stats.observationsCount).toBe(SPECIMEN_OBSERVATIONS.length);
    expect(data.stats.historyCount).toBeGreaterThanOrEqual(SPECIMEN_HISTORY.length);
    expect(Array.isArray(data.stats.ragRetrievedSummaries)).toBe(true);
  });

  it('GET /rag says the exhibit has no retrieval instead of warning into the void', async () => {
    const data = (await settle(demoRequest('/rag'))) as Record<string, unknown>;
    expect(data.enabled).toBe(false);
    expect(data.demo).toBe(true);
  });

  it('film-test branch: listed, inert on main, synthetics only while active, clean after flip-back', async () => {
    const branches = (await settle(demoRequest('/branches'))) as {
      branches: Array<{ name: string; is_active: number }>;
      activeBranch: string;
    };
    expect(branches.activeBranch).toBe('main');
    const filmTest = branches.branches.find(
      (b) => b.name === SPECIMEN_FILM_TEST_BRANCH.name,
    );
    expect(filmTest).toBeDefined();
    expect(filmTest!.is_active).toBe(0);

    // Main is pristine: no synthetics before any flip.
    const onMain = (await settle(demoRequest('/memory/synthetic'))) as {
      synthetics: unknown[];
    };
    expect(onMain.synthetics).toEqual([]);

    // Flip: the seeded synthetics surface, placed into the arc by timestamp.
    const activate = (await settle(
      demoRequest(`/branches/${SPECIMEN_FILM_TEST_BRANCH.name}/activate`, {
        method: 'PUT',
      }),
    )) as { success: boolean; activeBranch: string };
    expect(activate.success).toBe(true);
    expect(activate.activeBranch).toBe(SPECIMEN_FILM_TEST_BRANCH.name);

    const onBranch = (await settle(demoRequest('/memory/synthetic'))) as {
      synthetics: Array<Record<string, unknown>>;
    };
    expect(onBranch.synthetics.length).toBe(
      SPECIMEN_FILM_TEST_BRANCH.synthetics.length,
    );
    for (const synth of onBranch.synthetics) {
      expect(typeof synth.content).toBe('string');
      expect(typeof synth.position_timestamp).toBe('string');
      expect(typeof synth.memory_type).toBe('string');
    }

    // Flip back: main is exactly as clean as before the excursion.
    const restore = (await settle(
      demoRequest('/branches/main/activate', { method: 'PUT' }),
    )) as { success: boolean; activeBranch: string };
    expect(restore.activeBranch).toBe('main');
    const backOnMain = (await settle(demoRequest('/memory/synthetic'))) as {
      synthetics: unknown[];
    };
    expect(backOnMain.synthetics).toEqual([]);
  });

  it('DELETE /memory/synthetic/:id splices the row instead of silently succeeding', async () => {
    // Deleting a synthetic used to fall through to the blanket
    // `{success: true}` while the branch Map kept the row — the refetched
    // list came back unchanged (the FB-02 silent-lie class on delete).
    await settle(
      demoRequest(`/branches/${SPECIMEN_FILM_TEST_BRANCH.name}/activate`, {
        method: 'PUT',
      }),
    );
    const before = (await settle(demoRequest('/memory/synthetic'))) as {
      synthetics: Array<{ id: number }>;
    };
    // Scalar snapshot: the demo GET serves the live branch array, so a
    // length read after the delete would see the spliced array either way.
    const beforeCount = before.synthetics.length;
    expect(beforeCount).toBeGreaterThan(0);
    const victim = before.synthetics[0];

    const deleted = (await settle(
      demoRequest(`/memory/synthetic/${victim.id}`, { method: 'DELETE' }),
    )) as { success?: boolean; deleted_id?: number };
    expect(deleted.success).toBe(true);
    expect(deleted.deleted_id).toBe(victim.id);

    const after = (await settle(demoRequest('/memory/synthetic'))) as {
      synthetics: Array<{ id: number }>;
    };
    expect(after.synthetics.length).toBe(beforeCount - 1);
    expect(after.synthetics.some((s) => s.id === victim.id)).toBe(false);

    // Unknown ids fail loudly instead of pretending.
    const missing = (await settle(
      demoRequest('/memory/synthetic/999999', { method: 'DELETE' }),
    )) as { error?: string };
    expect(missing.error).toBeTruthy();

    await settle(demoRequest('/branches/main/activate', { method: 'PUT' }));
  });

  it('DELETE /learned/:id removes the row the Learnings card just confirmed', async () => {
    const before = (await settle(demoRequest('/learned'))) as {
      learned: Array<{ id: number }>;
    };
    const beforeCount = before.learned.length;
    expect(beforeCount).toBeGreaterThan(0);
    const victim = before.learned[beforeCount - 1];

    const deleted = (await settle(
      demoRequest(`/learned/${victim.id}`, { method: 'DELETE' }),
    )) as { success?: boolean; deleted_id?: number };
    expect(deleted.success).toBe(true);
    expect(deleted.deleted_id).toBe(victim.id);

    const after = (await settle(demoRequest('/learned'))) as {
      learned: Array<{ id: number }>;
    };
    expect(after.learned.length).toBe(beforeCount - 1);
    expect(after.learned.some((row) => row.id === victim.id)).toBe(false);

    const missing = (await settle(
      demoRequest('/learned/999999', { method: 'DELETE' }),
    )) as { error?: string };
    expect(missing.error).toBeTruthy();
  });

  it('no entry content repeats the type label the UI already prints', () => {
    // The UI renders TYPE_LABELS[type] beside each entry (historyUtils):
    // question_add → "New Question", learned_add → "Learned",
    // question_resolve → "Question Resolved", learned_cite → "Cited",
    // remember → "Remember".
    // Fixture content restating those read as "New Question: New question: …".
    const doubledPrefix = /^(new question|learned|question resolved|cited( learning)?|remember):/i;
    for (const specimenEntry of SPECIMEN_HISTORY) {
      expect(specimenEntry.content).not.toMatch(doubledPrefix);
    }
  });

  it('meter snapshots carry only the meters the meter map defines (A/C/N/E/D)', () => {
    const snapshots = SPECIMEN_HISTORY.map((e) => e.meter_snapshot).filter(
      (s): s is string => typeof s === 'string',
    );
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snapshot of snapshots) {
      for (const chip of snapshot.split(' ')) {
        expect(chip).toMatch(/^[ACNED](10|\d)$/);
      }
    }
  });

  it('fixture timestamps are deterministic — no Math.random in the specimen module', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/web/api/demo/specimen.ts'),
      'utf-8',
    );
    expect(source).not.toContain('Math.random');
    // And the generated stamps are well-formed DB timestamps.
    for (const specimenEntry of SPECIMEN_HISTORY) {
      expect(specimenEntry.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    }
  });
});
