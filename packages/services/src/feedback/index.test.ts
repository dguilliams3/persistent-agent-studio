/**
 * @module @persistence/services/feedback/index.test
 * @description Unit tests for action feedback + normalization.
 *
 * Covers:
 * - normalizeAction() typo/alias correction (existing behavior)
 * - normalizeAction() dynamic humanName tool-name resolution (PART B PROOF):
 *   any MESSAGE_<NAME> the model emits maps back to the internal
 *   MESSAGE_USER action, and MESSAGE_USER itself round-trips as a no-op.
 * - transformLegacyAction() structural transforms
 * - Feedback storage/formatting helpers
 *
 * @covers ./index.ts
 */

import { describe, it, expect } from 'vitest';
import { normalizeAction, transformLegacyAction, formatFeedbackForContext } from './index';

describe('normalizeAction', () => {
  describe('existing typo/alias correction', () => {
    it('corrects past-tense variants to canonical action names', () => {
      expect(normalizeAction('THOUGHT')).toBe('THINK');
      expect(normalizeAction('WONDERED')).toBe('WONDER');
      expect(normalizeAction('MESSAGED_USER')).toBe('MESSAGE_USER');
    });

    it('corrects shorthand and common misspellings to MESSAGE_USER', () => {
      expect(normalizeAction('MESSAGE')).toBe('MESSAGE_USER');
      expect(normalizeAction('MSG')).toBe('MESSAGE_USER');
      expect(normalizeAction('MSG_USER')).toBe('MESSAGE_USER');
      expect(normalizeAction('MESAGE_USER')).toBe('MESSAGE_USER');
      expect(normalizeAction('MASSAGE_USER')).toBe('MESSAGE_USER');
    });

    it('is case-insensitive and uppercases unknown actions', () => {
      expect(normalizeAction('think')).toBe('THINK');
      expect(normalizeAction('unknown_action')).toBe('UNKNOWN_ACTION');
    });

    it('passes through falsy input unchanged', () => {
      expect(normalizeAction('')).toBe('');
    });
  });

  describe('dynamic humanName tool-name resolution (PART B)', () => {
    it('maps MESSAGE_<NAME> back to the internal MESSAGE_USER action', () => {
      // PROOF: a model configured with humanName "Alex" that emits the
      // dynamic MESSAGE_ALEX tool name still executes as MESSAGE_USER.
      expect(normalizeAction('MESSAGE_ALEX')).toBe('MESSAGE_USER');
      expect(normalizeAction('message_alex')).toBe('MESSAGE_USER');
      expect(normalizeAction('MESSAGE_DR_JANE')).toBe('MESSAGE_USER');
    });

    it('round-trips the canonical MESSAGE_USER action as a no-op', () => {
      // Default humanName "User" renders MESSAGE_USER, which must still
      // resolve to itself (not just happen to work via the alias table).
      expect(normalizeAction('MESSAGE_USER')).toBe('MESSAGE_USER');
    });

    it('does not swallow the distinct typo aliases into the generic rule', () => {
      // These have their own explicit ACTION_ALIASES entries and must not
      // silently pass through unnormalized if that table is ever pruned.
      expect(normalizeAction('MESSAGED_USER')).toBe('MESSAGE_USER');
      expect(normalizeAction('MESAGE_USER')).toBe('MESSAGE_USER');
      expect(normalizeAction('MASSAGE_USER')).toBe('MESSAGE_USER');
    });

    it('does not affect unrelated actions that happen to contain MESSAGE', () => {
      expect(normalizeAction('SET_STATUS')).toBe('SET_STATUS');
      expect(normalizeAction('SET_USER_STATUS')).toBe('SET_USER_STATUS');
    });
  });
});

describe('transformLegacyAction', () => {
  it('sets default op for legacy ART action names', () => {
    const result = transformLegacyAction({ action: 'SHARE_ART' });
    expect(result.op).toBe('share');
  });

  it('leaves non-legacy actions unchanged', () => {
    const action = { action: 'MESSAGE_USER', content: 'hi' };
    expect(transformLegacyAction(action)).toEqual(action);
  });

  it('passes through actions with no action field', () => {
    const action = { content: 'hi' } as { action?: string; content: string };
    expect(transformLegacyAction(action)).toBe(action);
  });
});

describe('formatFeedbackForContext', () => {
  it('returns empty string for null/empty feedback', () => {
    expect(formatFeedbackForContext(null)).toBe('');
    expect(formatFeedbackForContext([])).toBe('');
  });

  it('formats feedback messages with header/footer', () => {
    const result = formatFeedbackForContext([
      { type: 'x', details: {}, message: 'Something happened', timestamp: 'now' },
    ]);
    expect(result).toContain('Something happened');
    expect(result).toContain('--- FEEDBACK FROM LAST CYCLE ---');
  });
});
