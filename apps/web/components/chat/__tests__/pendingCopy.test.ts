/**
 * Tests: `apps/web/components/chat/pendingCopy.ts::pendingChatCopy`
 *
 * The pending indicator is a claim, and these are the four claims it can make.
 * The demo branch is what a reviewer sees; the LIVE branch has no rendered
 * path in the exhibit, so this is the only thing that ever exercises it.
 */

import { describe, expect, it } from 'vitest';
import { pendingChatCopy } from '../pendingCopy';

const LIVE = { demoMode: false, personaName: 'Ada' };
const DEMO = { demoMode: true, personaName: 'Ada' };

describe('pendingChatCopy', () => {
  describe('demo exhibit — nothing is thinking, and it must say so', () => {
    it('names the reply as a fetch, not deliberation', () => {
      const copy = pendingChatCopy({ ...DEMO, isThinking: false });
      expect(copy.statusText).toBe(
        'Fetching a scripted reply — no model is thinking about this',
      );
      expect(copy.pendingLabel).toBe('Fetching a scripted reply');
    });

    it('names a think cycle as scripted, on the real timing', () => {
      const copy = pendingChatCopy({ ...DEMO, isThinking: true });
      expect(copy.statusText).toContain('Scripted cycle');
      expect(copy.statusText).toContain('nothing is thinking');
      expect(copy.pendingLabel).toBe('Running a scripted cycle');
    });

    it('never claims the persona is thinking, in copy or in the a11y name', () => {
      for (const isThinking of [true, false]) {
        const copy = pendingChatCopy({ ...DEMO, isThinking });
        // "nothing is thinking" / "no model is thinking" are denials, not claims.
        expect(copy.statusText).not.toMatch(/\bAda is\b/);
        expect(copy.pendingLabel).not.toMatch(/^Thinking/);
        expect(copy.pendingLabel).not.toContain('Ada');
      }
    });
  });

  describe('live deployment — a real model, so a real wait', () => {
    it('says the message is queued for the next cycle while awaiting a reply', () => {
      const copy = pendingChatCopy({ ...LIVE, isThinking: false });
      expect(copy.statusText).toBe(
        'Ada has your message — replying on its next cycle',
      );
      expect(copy.pendingLabel).toBe('Waiting for Ada to reply');
    });

    it('says thinking only when a cycle is actually running', () => {
      const copy = pendingChatCopy({ ...LIVE, isThinking: true });
      expect(copy.statusText).toBe(
        'Ada is picking this up — usually under 2 minutes',
      );
      expect(copy.pendingLabel).toBe('Thinking');
    });

    it('never calls a live wait scripted', () => {
      for (const isThinking of [true, false]) {
        const copy = pendingChatCopy({ ...LIVE, isThinking });
        expect(copy.statusText.toLowerCase()).not.toContain('script');
        expect(copy.pendingLabel.toLowerCase()).not.toContain('script');
      }
    });
  });

  it('carries the persona name into every live line', () => {
    for (const isThinking of [true, false]) {
      const copy = pendingChatCopy({
        demoMode: false,
        personaName: 'Specimen 9',
        isThinking,
      });
      expect(copy.statusText).toContain('Specimen 9');
    }
  });
});
