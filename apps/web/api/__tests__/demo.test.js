/**
 * Observatory demo router tests
 *
 * @covers apps/web/api/demo/index.ts
 *   - demoRequest GET /history returns the specimen arc in worker shape
 *   - demoRequest GET /auth/status authenticates the observer
 *   - demoRequest POST /message appends the visitor message immediately
 *   - demoRequest POST /message schedules a scripted specimen reply on a beat
 *   - demoRequest GET /gallery derives Media-tab items from the thread's images
 *   - demoRequest POST /think-now reports queued and schedules cycle output
 *   - SIM fixtures match the real handler contracts (packages/memory sim/routes.ts):
 *     /sim/basin, /sim/basin/trajectory, /sim/basin/weekly, /sim/anomalies,
 *     POST /sim/direction/compute — including `a<->b` cross-type pair keys
 *   - /summaries and /questions match the worker response shapes
 *   - unknown GET returns an empty object (store fallbacks handle it)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { demoRequest } from '../demo/index.ts';

describe('observatory demo router', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Advance both the router's artificial latency and scheduled entries. */
  async function settle(promise, ms = 200) {
    await vi.advanceTimersByTimeAsync(ms);
    return promise;
  }

  it('GET /history returns the specimen arc in worker shape', async () => {
    const data = await settle(demoRequest('/history?limit=100'));
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBeGreaterThan(20);
    expect(data.hasMore).toBe(false);
    const types = new Set(data.history.map((h) => h.type));
    // The arc must exercise the chat's two rendered message types
    expect(types.has('message_to_user')).toBe(true);
    expect(types.has('user_message')).toBe(true);
  });

  it('GET /auth/status authenticates the observer', async () => {
    const data = await settle(demoRequest('/auth/status'));
    expect(data.authenticated).toBe(true);
    expect(data.demo).toBe(true);
  });

  it('POST /message appends the visitor message and schedules a reply', async () => {
    const before = await settle(demoRequest('/history'));
    const post = await settle(
      demoRequest('/message', {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello, specimen' }),
      }),
    );
    expect(post.success).toBe(true);

    const afterSend = await settle(demoRequest('/history'));
    expect(afterSend.history.length).toBe(before.history.length + 1);
    const last = afterSend.history[afterSend.history.length - 1];
    expect(last.type).toBe('user_message');
    expect(last.content).toBe('Hello, specimen');

    // afterSend above already proves the reply is not instant (the visitor's
    // own row is still the newest a few hundred ms in). It must also be a
    // BEAT, not a simulated think: the copy tells the visitor nothing is
    // thinking, so a long pause here would be a pause pretending otherwise.
    await vi.advanceTimersByTimeAsync(1_500);
    const afterReply = await settle(demoRequest('/history'));
    const newest = afterReply.history[afterReply.history.length - 1];
    expect(newest.type).toBe('message_to_user');
    expect(newest.id).toBeGreaterThan(last.id);
  });

  it('GET /gallery shows the images the thread shows', async () => {
    // The Media tab reads /gallery while chat bubbles read history.internal.
    // With no route here the tab claimed "No media yet" over a visible image.
    const gallery = await settle(demoRequest('/gallery?limit=100&include_vaulted=true'));
    expect(Array.isArray(gallery.images)).toBe(true);
    expect(gallery.images.length).toBeGreaterThan(0);
    for (const image of gallery.images) {
      expect(typeof image.image).toBe('string');
      expect(image.image.startsWith('data:image')).toBe(true);
      expect(typeof image.createdAt).toBe('string');
    }

    // Derived from the same rows the thread renders — not a second fixture.
    const history = await settle(demoRequest('/history'));
    const threadImageIds = history.history
      .filter((row) => typeof row.internal === 'string' && row.internal.startsWith('data:image'))
      .map((row) => row.id)
      .sort();
    expect(gallery.images.map((image) => image.id).sort()).toEqual(threadImageIds);
  });

  it('POST /think-now reports queued and schedules cycle output', async () => {
    const before = await settle(demoRequest('/history'));
    const post = await settle(demoRequest('/think-now', { method: 'POST' }));
    expect(post.queued).toBe(true);

    await vi.advanceTimersByTimeAsync(10_000);
    const after = await settle(demoRequest('/history'));
    expect(after.history.length).toBeGreaterThan(before.history.length);
    const types = after.history
      .slice(before.history.length)
      .map((h) => h.type);
    expect(types).toContain('thought');
  });

  it('POST /personas and PUT /personas/:id/activate update the in-memory persona list', async () => {
    const created = await settle(
      demoRequest('/personas', {
        method: 'POST',
        body: JSON.stringify({ name: 'Delphi' }),
      }),
    );

    expect(created.success).toBe(true);
    expect(created.persona.name).toBe('Delphi');

    const activeAfterCreate = await settle(demoRequest('/personas/active'));
    expect(activeAfterCreate.persona.name).toBe('Delphi');

    const activated = await settle(
      demoRequest(`/personas/${created.persona.id}/activate`, {
        method: 'PUT',
      }),
    );

    expect(activated.success).toBe(true);
    expect(activated.persona.id).toBe(created.persona.id);

    const activeAfterActivate = await settle(demoRequest('/personas/active'));
    expect(activeAfterActivate.persona.id).toBe(created.persona.id);
  });

  it('GET /sim/basin matches handleGetBasin: global/perType/latestByType/crossType pair keys', async () => {
    const data = await settle(demoRequest('/sim/basin'));
    expect(data.global.sampleCount).toBeGreaterThan(0);
    expect(data.global.stdDistance).toBeGreaterThan(0);
    expect(data.global.outlierThreshold).toBeGreaterThan(data.global.meanDistance);
    expect(data.perType.thought.meanDistance).toBeGreaterThan(0);
    // Voice sample counts sum to the global census
    const perTypeSum = Object.values(data.perType).reduce(
      (sum, t) => sum + t.sampleCount,
      0,
    );
    expect(perTypeSum).toBe(data.global.sampleCount);
    // Cross-type pairs use the real `a<->b` key contract, never bare types
    const pairKeys = Object.keys(data.crossType.pairs);
    expect(pairKeys.length).toBeGreaterThan(0);
    for (const key of pairKeys) {
      expect(key).toContain('<->');
    }
    expect(data.crossType.pairs['thought<->user_message']).toBeGreaterThan(0);
    // Latest entries reference real history rows
    expect(data.latestByType.thought.entryTable).toBe('history');
    expect(typeof data.latestByType.thought.distance).toBe('number');
  });

  it('GET /sim/basin/trajectory returns scored points backed by real arc entries', async () => {
    const data = await settle(demoRequest('/sim/basin/trajectory?limit=500'));
    expect(Array.isArray(data.points)).toBe(true);
    expect(data.points.length).toBeGreaterThan(20);
    expect(data.metrics.meanDistance).toBeGreaterThan(0);

    const history = await settle(demoRequest('/history'));
    const historyIds = new Set(history.history.map((h) => h.id));
    for (const point of data.points) {
      expect(historyIds.has(point.id)).toBe(true);
      expect(typeof point.distance).toBe('number');
      expect(typeof point.zScore).toBe('number');
      expect(typeof point.content).toBe('string');
    }
    // The settling story: outliers exist and all sit in the early arc
    const outliers = data.points.filter((p) => p.isOutlier);
    expect(outliers.length).toBeGreaterThan(0);
    const newestTs = data.points[0].timestamp;
    for (const outlier of outliers) {
      expect(outlier.timestamp < newestTs).toBe(true);
    }

    // entryTypes filter honors the real query contract
    const filtered = await settle(
      demoRequest('/sim/basin/trajectory?entryTypes=thought'),
    );
    expect(filtered.points.length).toBeGreaterThan(0);
    for (const point of filtered.points) {
      expect(point.type).toBe('thought');
    }
  });

  it('GET /sim/basin/weekly tells the settling arc: outlier rate falls week over week', async () => {
    const data = await settle(demoRequest('/sim/basin/weekly?type=thought'));
    expect(data.type).toBe('thought');
    expect(Array.isArray(data.weekly)).toBe(true);
    expect(data.weekly.length).toBe(4);
    for (let i = 1; i < data.weekly.length; i += 1) {
      expect(data.weekly[i].outlierRate).toBeLessThan(data.weekly[i - 1].outlierRate);
      expect(data.weekly[i].meanDistFromGlobal).toBeLessThan(
        data.weekly[i - 1].meanDistFromGlobal,
      );
    }
    // Weekly ns sum to the voice's basin sampleCount (one consistent census)
    const basin = await settle(demoRequest('/sim/basin'));
    const weeklySum = data.weekly.reduce((sum, bucket) => sum + bucket.n, 0);
    expect(weeklySum).toBe(basin.perType.thought.sampleCount);

    const rejected = await settle(demoRequest('/sim/basin/weekly?type=bogus'));
    expect(rejected.success).toBe(false);
  });

  it('GET /sim/anomalies flags exactly the trajectory outliers', async () => {
    const anomalies = await settle(demoRequest('/sim/anomalies'));
    const trajectory = await settle(demoRequest('/sim/basin/trajectory?limit=500'));
    const outlierIds = trajectory.points
      .filter((p) => p.isOutlier)
      .map((p) => p.id)
      .sort();
    expect(anomalies.anomalies.map((a) => a.target_id).sort()).toEqual(outlierIds);
    for (const anomaly of anomalies.anomalies) {
      expect(anomaly.target_table).toBe('history');
      expect(Math.abs(anomaly.z_score)).toBeGreaterThan(2);
    }
  });

  it('POST /sim/direction/compute returns the handleComputeDirection shape', async () => {
    const missing = await settle(
      demoRequest('/sim/direction/compute', {
        method: 'POST',
        body: JSON.stringify({ poleA: [], poleB: [] }),
      }),
    );
    expect(missing.success).toBe(false);

    const result = await settle(
      demoRequest('/sim/direction/compute', {
        method: 'POST',
        body: JSON.stringify({
          poleA: [{ table: 'history', id: 2 }],
          poleB: [{ table: 'history', id: 36 }],
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.direction.magnitude).toBeGreaterThan(0);
    expect(result.direction.poleACount).toBe(1);
    expect(Array.isArray(result.projections)).toBe(true);
    expect(result.projections.length).toBeGreaterThan(0);
    // Sorted ascending, pole members anchored toward the ends
    for (let i = 1; i < result.projections.length; i += 1) {
      expect(result.projections[i].projection).toBeGreaterThanOrEqual(
        result.projections[i - 1].projection,
      );
    }
  });

  it('GET /summaries matches handleGetSummaries: active/archived/stats + alias', async () => {
    const data = await settle(demoRequest('/summaries?include_archived=true'));

    expect(Array.isArray(data.active)).toBe(true);
    expect(Array.isArray(data.archived)).toBe(true);
    expect(data.active.length).toBeGreaterThan(0);
    expect(data.summaries).toEqual(data.active);
    expect(data.stats.active).toBe(data.active.length);
    expect(data.stats.archived).toBe(data.archived.length);
    for (const summary of data.active) {
      expect(typeof summary.summary).toBe('string');
      expect(summary.summary.length).toBeGreaterThan(0);
      expect([2, 3, 4]).toContain(summary.tier);
      expect(typeof summary.message_count).toBe('number');
      expect(summary.archived_at).toBeNull();
      expect(Array.isArray(summary.source_ids)).toBe(true);
    }
  });

  it('GET /questions matches the questions schema: content/domain/notes/resolved_into', async () => {
    const data = await settle(demoRequest('/questions'));
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBeGreaterThan(0);
    for (const question of data.questions) {
      expect(typeof question.content).toBe('string');
      expect(question.content.length).toBeGreaterThan(0);
      expect(typeof question.domain).toBe('string');
      expect(['open', 'exploring', 'resolved', 'dissolved']).toContain(question.status);
      // notes is a JSON-array string, exactly as addNote persists it
      expect(Array.isArray(JSON.parse(question.notes))).toBe(true);
    }
    const resolved = data.questions.find((q) => q.status === 'resolved');
    expect(resolved).toBeDefined();
    expect(typeof resolved.resolved_into).toBe('string');
    expect(resolved.resolved_into.length).toBeGreaterThan(0);
  });

  it('GET /state returns the loop keys SettingsSections reads', async () => {
    const data = await settle(demoRequest('/state'));

    expect(typeof data.loopCount).toBe('number');
    expect(typeof data.cycleIntervalSeconds).toBe('number');
    expect(typeof data.isRunning).toBe('boolean');
    expect(typeof data.lastWakeTime).toBe('string');
    expect(data.lastWakeTime.length).toBeGreaterThan(0);
  });

  it('unknown GET returns an empty object', async () => {
    const data = await settle(demoRequest('/definitely-not-a-route'));
    expect(data).toEqual({});
  });
});
