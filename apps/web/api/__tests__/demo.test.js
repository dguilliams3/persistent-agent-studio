/**
 * Observatory demo router tests
 *
 * @covers apps/web/api/demo/index.ts
 *   - demoRequest GET /history returns the specimen arc in worker shape
 *   - demoRequest GET /auth/status authenticates the observer
 *   - demoRequest POST /message appends the visitor message immediately
 *   - demoRequest POST /message schedules a scripted specimen reply
 *   - demoRequest POST /think-now reports queued and schedules cycle output
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

    // The scripted reply lands after the cycle-ish delay
    await vi.advanceTimersByTimeAsync(7000);
    const afterReply = await settle(demoRequest('/history'));
    const newest = afterReply.history[afterReply.history.length - 1];
    expect(newest.type).toBe('message_to_user');
    expect(newest.id).toBeGreaterThan(last.id);
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

  it('GET /sim/basin returns observatory metrics in overview shape', async () => {
    const data = await settle(demoRequest('/sim/basin'));
    expect(data.global.sampleCount).toBeGreaterThan(0);
    expect(data.typeBasinReference.thought.meanDistance).toBeGreaterThan(0);
    expect(data.crossType.pairs.user_message).toBeGreaterThan(0);
  });

  it('unknown GET returns an empty object', async () => {
    const data = await settle(demoRequest('/definitely-not-a-route'));
    expect(data).toEqual({});
  });
});
