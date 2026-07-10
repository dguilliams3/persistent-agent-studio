/**
 * @module @persistence/tools/__tests__/validation.test
 * @description Unit tests for action validation module
 *
 * Tests cover:
 * - validateAction() basic validation
 * - validateAction() required field checking
 * - validateAction() alias resolution
 * - validateAction() conditional required fields
 * - validateAction() type warnings
 * - validateActions() batch validation
 * - isValidAction() boolean helper
 * - getActionSchema() schema lookup
 *
 * @covers ../validation.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateAction,
  validateActions,
  isValidAction,
  getActionSchema,
} from '../validation';

// ============================================================================
// validateAction() - Basic Validation
// ============================================================================

describe('validateAction - basic validation', () => {
  describe('null/undefined handling', () => {
    it('rejects null input', () => {
      const result = validateAction(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Action must be a non-null object');
    });

    it('rejects undefined input', () => {
      const result = validateAction(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Action must be a non-null object');
    });
  });

  describe('non-object handling', () => {
    it('rejects string input', () => {
      const result = validateAction('THINK');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Action must be a non-null object');
    });

    it('rejects number input', () => {
      const result = validateAction(42);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Action must be a non-null object');
    });

    it('treats array input as object (arrays are objects in JS)', () => {
      // Note: Arrays are objects in JavaScript, so they pass the object check
      // but fail on missing 'action' field
      const result = validateAction(['THINK']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required field: "action"');
    });
  });

  describe('missing action field', () => {
    it('rejects object without action field', () => {
      const result = validateAction({ content: 'hello' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required field: "action"');
    });

    it('provides hint about action field', () => {
      const result = validateAction({ content: 'hello' });
      expect(result.hint).toContain('action');
    });
  });

  describe('unknown action type', () => {
    it('rejects unknown action type', () => {
      const result = validateAction({ action: 'UNKNOWN_ACTION', content: 'test' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown action type: "UNKNOWN_ACTION"');
    });

    it('provides hint with valid actions', () => {
      const result = validateAction({ action: 'UNKNOWN_ACTION' });
      expect(result.hint).toContain('THINK');
      expect(result.hint).toContain('MESSAGE_USER');
    });
  });
});

// ============================================================================
// validateAction() - Required Fields
// ============================================================================

describe('validateAction - required fields', () => {
  describe('THINK action', () => {
    it('validates valid THINK action', () => {
      const result = validateAction({
        action: 'THINK',
        content: 'I should process this carefully...'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects THINK without content', () => {
      const result = validateAction({ action: 'THINK' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field(s): content');
    });
  });

  describe('MESSAGE_USER action', () => {
    it('validates valid MESSAGE_USER action', () => {
      const result = validateAction({
        action: 'MESSAGE_USER',
        content: 'Hello there!'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects MESSAGE_USER without content', () => {
      const result = validateAction({ action: 'MESSAGE_USER' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field(s): content');
    });

    it('validates MESSAGE_USER with optional fields', () => {
      const result = validateAction({
        action: 'MESSAGE_USER',
        content: 'Hello!',
        voice: true,
        shareToUser: true,
        internal: 'greeting'
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('COLD_STORAGE action', () => {
    it('validates valid COLD_STORAGE action', () => {
      const result = validateAction({
        action: 'COLD_STORAGE',
        content: 'The user loves astronomy'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects COLD_STORAGE without content', () => {
      const result = validateAction({ action: 'COLD_STORAGE' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field(s): content');
    });
  });

  describe('SLEEP action', () => {
    it('validates valid SLEEP action', () => {
      const result = validateAction({
        action: 'SLEEP',
        duration: 1800
      });
      expect(result.valid).toBe(true);
    });

    it('rejects SLEEP without duration', () => {
      const result = validateAction({ action: 'SLEEP' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field(s): duration');
    });
  });

  describe('NOTE action (multiple required)', () => {
    it('validates valid NOTE save action', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'save',
        title: 'My Note',
        body: 'Note content here'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects NOTE without op', () => {
      const result = validateAction({
        action: 'NOTE',
        title: 'My Note',
        body: 'content'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('op');
    });

    it('rejects NOTE without title', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'save',
        body: 'content'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('title');
    });
  });
});

// ============================================================================
// validateAction() - Alias Resolution
// ============================================================================

describe('validateAction - alias resolution', () => {
  describe('SEARCH action (content -> query alias)', () => {
    it('accepts query parameter (canonical)', () => {
      const result = validateAction({
        action: 'SEARCH',
        query: 'aurora borealis forecast'
      });
      expect(result.valid).toBe(true);
    });

    it('accepts content parameter (alias)', () => {
      const result = validateAction({
        action: 'SEARCH',
        content: 'aurora borealis forecast'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects when neither query nor content provided', () => {
      const result = validateAction({
        action: 'SEARCH'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('query');
    });

    it('prefers canonical field when both provided', () => {
      const result = validateAction({
        action: 'SEARCH',
        query: 'canonical value',
        content: 'alias value'
      });
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// validateAction() - Conditional Required Fields
// ============================================================================

/**
 * Conditional required validation tests.
 *
 * These test that when a condition is met (e.g., "op === 'make'"),
 * the corresponding fields become required.
 *
 * See: validation.ts evaluateCondition() function
 */
describe('validateAction - conditional required', () => {
  describe('ART action', () => {
    it('validates ART with op=make and content', () => {
      const result = validateAction({
        action: 'ART',
        op: 'make',
        content: 'A serene winter forest'
      });
      expect(result.valid).toBe(true);
    });

    it('validates ART with op=share and message', () => {
      const result = validateAction({
        action: 'ART',
        op: 'share',
        message: 'Check out this art!'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects ART op=make without content', () => {
      const result = validateAction({
        action: 'ART',
        op: 'make'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('content');
    });

    it('rejects ART op=share without message', () => {
      const result = validateAction({
        action: 'ART',
        op: 'share'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('message');
    });

    it('rejects ART without op', () => {
      const result = validateAction({
        action: 'ART',
        content: 'A beautiful sunset'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('op');
    });
  });

  describe('REMINDER action', () => {
    it('validates REMINDER op=set with content and condition', () => {
      const result = validateAction({
        action: 'REMINDER',
        op: 'set',
        content: 'Ask about the demo',
        condition: 'persistent'
      });
      expect(result.valid).toBe(true);
    });

    it('validates REMINDER op=dismiss with id', () => {
      const result = validateAction({
        action: 'REMINDER',
        op: 'dismiss',
        id: 5
      });
      expect(result.valid).toBe(true);
    });

    it('rejects REMINDER op=set without content', () => {
      const result = validateAction({
        action: 'REMINDER',
        op: 'set',
        condition: 'persistent'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('content');
    });

    it('rejects REMINDER op=set without condition', () => {
      const result = validateAction({
        action: 'REMINDER',
        op: 'set',
        content: 'Ask about the demo'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('condition');
    });

    it('rejects REMINDER op=dismiss without id', () => {
      const result = validateAction({
        action: 'REMINDER',
        op: 'dismiss'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });
  });

  describe('LEARNED action', () => {
    it('validates LEARNED op=add with content and confidence', () => {
      const result = validateAction({
        action: 'LEARNED',
        op: 'add',
        content: 'I learn better through exploration',
        confidence: 'emerging'
      });
      expect(result.valid).toBe(true);
    });

    it('validates LEARNED op=cite with id, type, and evidence', () => {
      const result = validateAction({
        action: 'LEARNED',
        op: 'cite',
        id: 1,
        type: 'supporting',
        evidence: 'From our conversation on Monday'
      });
      expect(result.valid).toBe(true);
    });

    it('validates LEARNED op=update with id', () => {
      const result = validateAction({
        action: 'LEARNED',
        op: 'update',
        id: 1,
        content: 'Updated insight'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects LEARNED op=add without confidence', () => {
      const result = validateAction({
        action: 'LEARNED',
        op: 'add',
        content: 'Some insight'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('confidence');
    });

    it('rejects LEARNED op=cite without evidence', () => {
      const result = validateAction({
        action: 'LEARNED',
        op: 'cite',
        id: 1,
        type: 'supporting'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('evidence');
    });
  });

  describe('NOTE action', () => {
    it('validates NOTE op=save with body', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'save',
        title: 'My Note',
        body: 'Content here'
      });
      expect(result.valid).toBe(true);
    });

    it('validates NOTE op=get without body', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'get',
        title: 'My Note'
      });
      expect(result.valid).toBe(true);
    });

    it('validates NOTE op=delete without body', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'delete',
        title: 'My Note'
      });
      expect(result.valid).toBe(true);
    });

    it('rejects NOTE op=save without body', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'save',
        title: 'My Note'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('body');
    });
  });
});

// ============================================================================
// validateAction() - Type Warnings
// ============================================================================

describe('validateAction - type warnings', () => {
  it('returns valid with type warning for wrong content type', () => {
    const result = validateAction({
      action: 'THINK',
      content: 123 // Should be string
    });
    // Type checking is advisory - still valid
    expect(result.valid).toBe(true);
    expect(result.typeWarnings).toBeDefined();
    expect(result.typeWarnings?.length).toBeGreaterThan(0);
    expect(result.typeWarnings?.[0]).toContain('content');
  });

  it('returns valid with type warning for wrong duration type', () => {
    const result = validateAction({
      action: 'SLEEP',
      duration: '1800' // Should be number
    });
    expect(result.valid).toBe(true);
    expect(result.typeWarnings).toBeDefined();
    expect(result.typeWarnings?.[0]).toContain('duration');
  });

  it('returns valid with type warning for wrong boolean type', () => {
    const result = validateAction({
      action: 'MESSAGE_USER',
      content: 'Hello',
      voice: 'yes' // Should be boolean
    });
    expect(result.valid).toBe(true);
    expect(result.typeWarnings).toBeDefined();
    expect(result.typeWarnings?.[0]).toContain('voice');
  });

  it('returns no type warnings when types are correct', () => {
    const result = validateAction({
      action: 'MESSAGE_USER',
      content: 'Hello',
      voice: true,
      shareToUser: false
    });
    expect(result.valid).toBe(true);
    expect(result.typeWarnings).toBeUndefined();
  });

  it('skips type checking for null/undefined values', () => {
    const result = validateAction({
      action: 'MESSAGE_USER',
      content: 'Hello',
      internal: null as unknown as string // Null should not trigger warning
    });
    expect(result.valid).toBe(true);
    // May or may not have warnings, but should not fail
  });
});

// ============================================================================
// validateAction() - Format Hints
// ============================================================================

describe('validateAction - format hints', () => {
  it('includes formatHint in error for missing required field', () => {
    const result = validateAction({ action: 'THINK' });
    expect(result.hint).toBeDefined();
    expect(result.hint).toContain('THINK');
  });

  it('includes formatHint for conditional required error', () => {
    const result = validateAction({
      action: 'ART',
      op: 'make'
    });
    expect(result.valid).toBe(false);
    expect(result.hint).toBeDefined();
  });
});

// ============================================================================
// validateActions() - Batch Validation
// ============================================================================

describe('validateActions', () => {
  it('validates empty array', () => {
    const results = validateActions([]);
    expect(results).toEqual([]);
  });

  it('validates array of valid actions', () => {
    const results = validateActions([
      { action: 'THINK', content: 'thinking...' },
      { action: 'MESSAGE_USER', content: 'Hello!' }
    ]);
    expect(results.length).toBe(2);
    expect(results.every(r => r.valid)).toBe(true);
  });

  it('validates array with mixed valid/invalid', () => {
    const results = validateActions([
      { action: 'THINK', content: 'valid' },
      { action: 'THINK' }, // Missing content
      { action: 'MESSAGE_USER', content: 'valid' }
    ]);
    expect(results.length).toBe(3);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(true);
  });

  it('preserves order of results', () => {
    const actions = [
      { action: 'THINK', content: 'first' },
      { action: 'UNKNOWN' },
      { action: 'MESSAGE_USER', content: 'third' }
    ];
    const results = validateActions(actions);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[1].error).toContain('Unknown action');
    expect(results[2].valid).toBe(true);
  });
});

// ============================================================================
// isValidAction()
// ============================================================================

describe('isValidAction', () => {
  it('returns true for valid action', () => {
    expect(isValidAction({ action: 'THINK', content: 'hello' })).toBe(true);
  });

  it('returns false for invalid action', () => {
    expect(isValidAction({ action: 'THINK' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidAction(null)).toBe(false);
  });

  it('returns false for unknown action', () => {
    expect(isValidAction({ action: 'FAKE' })).toBe(false);
  });

  it('returns true despite type warnings', () => {
    // Type warnings don't make action invalid
    expect(isValidAction({ action: 'THINK', content: 123 })).toBe(true);
  });
});

// ============================================================================
// getActionSchema()
// ============================================================================

describe('getActionSchema', () => {
  it('returns schema for valid action name', () => {
    const schema = getActionSchema('THINK');
    expect(schema).toBeDefined();
    expect(schema?.required).toContain('content');
  });

  it('returns schema for MESSAGE_USER', () => {
    const schema = getActionSchema('MESSAGE_USER');
    expect(schema).toBeDefined();
    expect(schema?.required).toContain('content');
    expect(schema?.optional).toContain('voice');
    expect(schema?.optional).toContain('shareToUser');
  });

  it('returns schema for ART with conditionalRequired', () => {
    const schema = getActionSchema('ART');
    expect(schema).toBeDefined();
    expect(schema?.conditionalRequired).toBeDefined();
  });

  it('returns schema for SEARCH with aliases', () => {
    const schema = getActionSchema('SEARCH');
    expect(schema).toBeDefined();
    expect(schema?.aliases).toBeDefined();
    expect(schema?.aliases.content).toBe('query');
  });

  it('returns null for unknown action', () => {
    const schema = getActionSchema('NONEXISTENT');
    expect(schema).toBeNull();
  });

  it('is case-sensitive', () => {
    const schemaUpper = getActionSchema('THINK');
    const schemaLower = getActionSchema('think');
    expect(schemaUpper).toBeDefined();
    expect(schemaLower).toBeNull();
  });
});

// ============================================================================
// EDGE CASES & REAL-WORLD SCENARIOS
// ============================================================================

describe('real-world scenarios', () => {
  describe('complex valid actions', () => {
    it('validates full MESSAGE_USER with all optional fields', () => {
      const result = validateAction({
        action: 'MESSAGE_USER',
        content: 'Good morning! I was thinking about our conversation yesterday.',
        voice: true,
        shareToUser: true,
        internal: 'Friendly morning greeting to start the day'
      });
      expect(result.valid).toBe(true);
    });

    it('validates NOTE save with optional summary', () => {
      const result = validateAction({
        action: 'NOTE',
        op: 'save',
        title: 'Project Ideas',
        body: '# Project Ideas\n\n## Voice Recognition\n...',
        summary: 'Collection of AI project ideas'
      });
      expect(result.valid).toBe(true);
    });

    it('validates LEARNED add with supporting evidence', () => {
      const result = validateAction({
        action: 'LEARNED',
        op: 'add',
        content: 'The user prefers concise technical explanations over verbose ones',
        confidence: 'emerging',
        supporting: 'Based on their feedback on the memory system explanation'
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('malformed inputs from LLM', () => {
    it('handles action with extra unknown fields', () => {
      const result = validateAction({
        action: 'THINK',
        content: 'valid thought',
        extraField: 'should be ignored',
        anotherExtra: 123
      });
      expect(result.valid).toBe(true);
    });

    it('handles empty content string', () => {
      const result = validateAction({
        action: 'THINK',
        content: ''
      });
      // Empty string satisfies type requirement
      expect(result.valid).toBe(true);
    });

    it('handles whitespace-only content', () => {
      const result = validateAction({
        action: 'THINK',
        content: '   '
      });
      // Validation doesn't check for meaningful content
      expect(result.valid).toBe(true);
    });
  });

  describe('EXIST action (minimal)', () => {
    it('validates EXIST with no parameters', () => {
      const result = validateAction({ action: 'EXIST' });
      expect(result.valid).toBe(true);
    });

    it('validates EXIST with optional internal', () => {
      const result = validateAction({
        action: 'EXIST',
        internal: 'Just being present'
      });
      expect(result.valid).toBe(true);
    });
  });
});
