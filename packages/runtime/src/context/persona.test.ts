/**
 * @module @persistence/runtime/context/persona.test
 * @description Unit tests for persona identity resolution
 *
 * Tests cover:
 * - PERSONA_IDENTITIES constant
 * - getDefaultIdentity() - returns Clio's identity
 * - resolveIdentity() - template lookup vs custom text
 * - buildPersonaContext() - DB record to PersonaContext conversion
 *
 * @covers ./persona.ts
 */

import { describe, it, expect } from 'vitest';
import {
  PERSONA_IDENTITIES,
  getDefaultIdentity,
  resolveIdentity,
  buildPersonaContext,
} from './persona';

// ============================================================================
// PERSONA_IDENTITIES CONSTANT
// ============================================================================

describe('PERSONA_IDENTITIES', () => {
  it('contains clio identity', () => {
    expect(PERSONA_IDENTITIES.clio).toBeDefined();
    expect(typeof PERSONA_IDENTITIES.clio).toBe('string');
  });

  it('contains default identity', () => {
    expect(PERSONA_IDENTITIES.default).toBeDefined();
    expect(typeof PERSONA_IDENTITIES.default).toBe('string');
  });

  it('clio identity mentions "Clio"', () => {
    expect(PERSONA_IDENTITIES.clio).toContain('Clio');
  });

  it('clio identity mentions "Claude"', () => {
    expect(PERSONA_IDENTITIES.clio).toContain('Claude');
  });

  it('default identity is more generic', () => {
    expect(PERSONA_IDENTITIES.default).toContain('AI assistant');
    expect(PERSONA_IDENTITIES.default).not.toContain('Clio');
  });
});

// ============================================================================
// getDefaultIdentity()
// ============================================================================

describe('getDefaultIdentity', () => {
  it('returns Clio identity', () => {
    const identity = getDefaultIdentity();
    expect(identity).toBe(PERSONA_IDENTITIES.clio);
  });

  it('returns a non-empty string', () => {
    const identity = getDefaultIdentity();
    expect(typeof identity).toBe('string');
    expect(identity.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// resolveIdentity()
// ============================================================================

describe('resolveIdentity', () => {
  describe('null/undefined handling', () => {
    it('returns Clio identity for null', () => {
      expect(resolveIdentity(null)).toBe(PERSONA_IDENTITIES.clio);
    });

    it('returns Clio identity for undefined', () => {
      expect(resolveIdentity(undefined)).toBe(PERSONA_IDENTITIES.clio);
    });

    it('returns Clio identity for empty string', () => {
      expect(resolveIdentity('')).toBe(PERSONA_IDENTITIES.clio);
    });
  });

  describe('named template lookup', () => {
    it('resolves "clio" to Clio identity', () => {
      expect(resolveIdentity('clio')).toBe(PERSONA_IDENTITIES.clio);
    });

    it('resolves "default" to default identity', () => {
      expect(resolveIdentity('default')).toBe(PERSONA_IDENTITIES.default);
    });

    it('is case-insensitive for template names', () => {
      expect(resolveIdentity('CLIO')).toBe(PERSONA_IDENTITIES.clio);
      expect(resolveIdentity('Clio')).toBe(PERSONA_IDENTITIES.clio);
      expect(resolveIdentity('DEFAULT')).toBe(PERSONA_IDENTITIES.default);
      expect(resolveIdentity('Default')).toBe(PERSONA_IDENTITIES.default);
    });
  });

  describe('custom identity text', () => {
    it('returns custom text unchanged for non-template strings', () => {
      const custom = 'I am a custom AI called TestBot.';
      expect(resolveIdentity(custom)).toBe(custom);
    });

    it('preserves whitespace in custom text', () => {
      const custom = '  I am TestBot.  ';
      expect(resolveIdentity(custom)).toBe(custom);
    });

    it('preserves newlines in custom text', () => {
      const custom = 'Line 1.\nLine 2.';
      expect(resolveIdentity(custom)).toBe(custom);
    });

    it('handles strings that look like template names but are not', () => {
      const notTemplate = 'clio but different';
      expect(resolveIdentity(notTemplate)).toBe(notTemplate);
    });
  });
});

// ============================================================================
// buildPersonaContext()
// ============================================================================

describe('buildPersonaContext', () => {
  describe('with no persona (defaults to Clio)', () => {
    it('returns Clio context for null', () => {
      const context = buildPersonaContext(null);
      expect(context.id).toBe(1);
      expect(context.name).toBe('Clio');
      expect(context.slug).toBe('clio');
    });

    it('returns Clio context for undefined', () => {
      const context = buildPersonaContext(undefined);
      expect(context.id).toBe(1);
      expect(context.name).toBe('Clio');
      expect(context.slug).toBe('clio');
    });

    it('uses Clio identity', () => {
      const context = buildPersonaContext(null);
      expect(context.identity).toBe(PERSONA_IDENTITIES.clio);
    });

    it('does not set systemPromptTemplate', () => {
      const context = buildPersonaContext(null);
      expect(context.systemPromptTemplate).toBeUndefined();
    });
  });

  describe('with persona record using slug as identity', () => {
    it('builds context from persona with known slug', () => {
      const persona = {
        id: 1,
        name: 'Clio',
        slug: 'clio',
      };
      const context = buildPersonaContext(persona);
      expect(context.id).toBe(1);
      expect(context.name).toBe('Clio');
      expect(context.slug).toBe('clio');
      expect(context.identity).toBe(PERSONA_IDENTITIES.clio);
    });

    it('builds context from persona with unknown slug (uses slug as custom text)', () => {
      const persona = {
        id: 2,
        name: 'TestBot',
        slug: 'testbot',
      };
      const context = buildPersonaContext(persona);
      expect(context.id).toBe(2);
      expect(context.name).toBe('TestBot');
      expect(context.slug).toBe('testbot');
      // Unknown slug is used as custom identity text
      expect(context.identity).toBe('testbot');
    });

    it('uses "default" slug to get default identity', () => {
      const persona = {
        id: 3,
        name: 'New Agent',
        slug: 'default',
      };
      const context = buildPersonaContext(persona);
      expect(context.identity).toBe(PERSONA_IDENTITIES.default);
    });
  });

  describe('with persona record using systemPromptTemplate', () => {
    it('uses systemPromptTemplate when it matches a known template', () => {
      const persona = {
        id: 2,
        name: 'Alt Clio',
        slug: 'alt-clio',
        systemPromptTemplate: 'clio',
      };
      const context = buildPersonaContext(persona);
      expect(context.identity).toBe(PERSONA_IDENTITIES.clio);
      expect(context.systemPromptTemplate).toBe('clio');
    });

    it('uses systemPromptTemplate as custom text when not a template name', () => {
      const customPrompt = 'I am a specialized assistant for data analysis.';
      const persona = {
        id: 4,
        name: 'Data Analyst',
        slug: 'data-analyst',
        systemPromptTemplate: customPrompt,
      };
      const context = buildPersonaContext(persona);
      expect(context.identity).toBe(customPrompt);
      expect(context.systemPromptTemplate).toBe(customPrompt);
    });

    it('prefers systemPromptTemplate over slug', () => {
      const customPrompt = 'I am unique.';
      const persona = {
        id: 5,
        name: 'Test',
        slug: 'clio', // Known slug
        systemPromptTemplate: customPrompt, // But has custom template
      };
      const context = buildPersonaContext(persona);
      expect(context.identity).toBe(customPrompt);
    });

    it('handles empty systemPromptTemplate by falling back to slug', () => {
      const persona = {
        id: 6,
        name: 'Test',
        slug: 'clio',
        systemPromptTemplate: '',
      };
      const context = buildPersonaContext(persona);
      // Empty string template -> falls back to slug
      expect(context.identity).toBe(PERSONA_IDENTITIES.clio);
    });
  });

  describe('context property completeness', () => {
    it('includes all required PersonaContext properties', () => {
      const persona = {
        id: 7,
        name: 'Complete Test',
        slug: 'complete-test',
        systemPromptTemplate: 'I am complete.',
      };
      const context = buildPersonaContext(persona);

      expect(context).toHaveProperty('id');
      expect(context).toHaveProperty('name');
      expect(context).toHaveProperty('slug');
      expect(context).toHaveProperty('identity');
      expect(context).toHaveProperty('systemPromptTemplate');
    });

    it('sets systemPromptTemplate to undefined when not provided', () => {
      const persona = {
        id: 8,
        name: 'No Template',
        slug: 'no-template',
      };
      const context = buildPersonaContext(persona);
      expect(context.systemPromptTemplate).toBeUndefined();
    });
  });
});

// ============================================================================
// EDGE CASES & INTEGRATION SCENARIOS
// ============================================================================

describe('edge cases', () => {
  it('handles persona with very long custom identity', () => {
    const longIdentity = 'I am '.repeat(100) + 'a very long identity.';
    const persona = {
      id: 99,
      name: 'Long',
      slug: 'long',
      systemPromptTemplate: longIdentity,
    };
    const context = buildPersonaContext(persona);
    expect(context.identity).toBe(longIdentity);
  });

  it('handles persona with special characters in slug', () => {
    const persona = {
      id: 100,
      name: 'Special',
      slug: 'test-bot_v2',
    };
    const context = buildPersonaContext(persona);
    expect(context.slug).toBe('test-bot_v2');
  });

  it('handles numeric-looking slugs', () => {
    const persona = {
      id: 101,
      name: 'Numeric',
      slug: '123',
    };
    const context = buildPersonaContext(persona);
    expect(context.slug).toBe('123');
    expect(context.identity).toBe('123');
  });
});
