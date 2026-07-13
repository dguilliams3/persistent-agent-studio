/**
 * Visitor `from` sanitization tests â€” F-B2 (RUN-20260712-2013)
 */

import { describe, it, expect } from 'vitest';
import { sanitizeVisitorFrom } from './actions';

describe('sanitizeVisitorFrom', () => {
  it('absent means null (legacy user path, no attribution)', () => {
    expect(sanitizeVisitorFrom(undefined)).toBeNull();
    expect(sanitizeVisitorFrom(null)).toBeNull();
  });

  it('valid names pass through trimmed', () => {
    expect(sanitizeVisitorFrom('Delphi')).toBe('Delphi');
    expect(sanitizeVisitorFrom('  Virgil  ')).toBe('Virgil');
    expect(sanitizeVisitorFrom('Frizzle B (companionship)')).toBe('Frizzle B (companionship)');
  });

  it('provided-but-unusable returns the invalid sentinel', () => {
    expect(sanitizeVisitorFrom('')).toBe('invalid');
    expect(sanitizeVisitorFrom('   ')).toBe('invalid');
    expect(sanitizeVisitorFrom(42)).toBe('invalid');
    expect(sanitizeVisitorFrom({ name: 'Delphi' })).toBe('invalid');
    expect(sanitizeVisitorFrom('x'.repeat(65))).toBe('invalid');
  });

  it('rejects control characters (built via fromCharCode)', () => {
    const withNul = 'Del' + String.fromCharCode(0) + 'phi';
    const withEsc = 'Del' + String.fromCharCode(27) + 'phi';
    const withDel = 'Del' + String.fromCharCode(127) + 'phi';
    expect(sanitizeVisitorFrom(withNul)).toBe('invalid');
    expect(sanitizeVisitorFrom(withEsc)).toBe('invalid');
    expect(sanitizeVisitorFrom(withDel)).toBe('invalid');
  });

  it('64 chars exactly is allowed (boundary)', () => {
    const name = 'x'.repeat(64);
    expect(sanitizeVisitorFrom(name)).toBe(name);
  });
});
