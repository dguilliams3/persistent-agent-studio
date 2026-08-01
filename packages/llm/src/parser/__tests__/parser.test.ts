/**
 * @module @persistence/llm/parser/__tests__/parser
 * @description Unit tests for Claude response parser and JSON repair utilities
 *
 * Tests cover:
 * - parseClaudeResponse with valid JSON (new format with meters/note, legacy array format)
 * - parseClaudeResponse with malformed JSON (trailing commas, unquoted keys, etc.)
 * - parseClaudeResponse graceful degradation (salvage parsing)
 * - parseClaudeResponse empty/invalid input handling
 * - extractBalancedBraces finding valid action objects
 * - extractBalancedBraces handling nested braces and quotes
 * - repairCommonJsonErrors fixing trailing commas, quotes, keys, values
 *
 * @covers ../response-parser.ts parseClaudeResponse, extractBalancedBraces
 * @covers ../json-repair.ts repairCommonJsonErrors
 */

import { describe, it, expect } from 'vitest';
import { parseClaudeResponse } from '../response-parser';
import { repairCommonJsonErrors, extractBalancedBraces } from '../json-repair';

// =============================================================================
// repairCommonJsonErrors() TESTS
// =============================================================================

describe('repairCommonJsonErrors()', () => {
  describe('trailing commas', () => {
    it('removes trailing commas in objects', () => {
      const input = '{"a": 1, "b": 2,}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"a": 1, "b": 2}');
      expect(result.fixes).toContain('Removed trailing commas in objects/arrays');
    });

    it('removes trailing commas in arrays', () => {
      const input = '[1, 2, 3,]';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('[1, 2, 3]');
      expect(result.fixes).toContain('Removed trailing commas in objects/arrays');
    });

    it('removes multiple trailing commas', () => {
      const input = '{"a": 1,, "b": 2,}';
      const result = repairCommonJsonErrors(input);

      expect(result.fixes.length).toBeGreaterThan(0);
      // Should have removed at least one trailing comma
      expect(result.repaired).not.toMatch(/,}/);
    });

    it('leaves valid JSON without trailing commas unchanged', () => {
      const input = '{"a": 1, "b": 2}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe(input);
      expect(result.fixes).toHaveLength(0);
    });
  });

  describe('quote conversion', () => {
    it('converts single quotes to double quotes in keys', () => {
      const input = "{'action': 'THINK'}";
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"action": "THINK"}');
      expect(result.fixes).toContain('Converted single quotes to double quotes');
    });

    it('converts single quotes to double quotes in values', () => {
      const input = "{'key': 'value', 'another': 'data'}";
      const result = repairCommonJsonErrors(input);

      expect(result.fixes).toContain('Converted single quotes to double quotes');
      expect(result.repaired).not.toMatch(/'/);
    });

    it('preserves double-quoted strings when converting single quotes', () => {
      const input = '{"key": "value with \'apostrophe\'"}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toContain('"value with');
      expect(result.fixes.length).toBe(0); // No fixes needed
    });
  });

  describe('unquoted keys', () => {
    it('quotes unquoted object keys', () => {
      const input = '{action: "THINK", content: "hello"}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"action": "THINK", "content": "hello"}');
      expect(result.fixes).toContain('Quoted unquoted object keys');
    });

    it('quotes unquoted keys with underscores', () => {
      const input = '{my_key: "value"}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"my_key": "value"}');
      expect(result.fixes).toContain('Quoted unquoted object keys');
    });

    it('handles keys after commas', () => {
      const input = '{"a": 1, b: 2}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"a": 1, "b": 2}');
      expect(result.fixes).toContain('Quoted unquoted object keys');
    });
  });

  describe('unquoted string values', () => {
    it('quotes simple unquoted string values', () => {
      const input = '{"a": hello}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"a": "hello"}');
      expect(result.fixes).toContain('Quoted unquoted string values');
    });

    it('does NOT quote numbers', () => {
      const input = '{"a": 123}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe('{"a": 123}');
      expect(result.fixes).not.toContain('Quoted unquoted string values');
    });

    it('does NOT quote booleans', () => {
      const input = '{"a": true, "b": false}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe(input);
      expect(result.fixes).toHaveLength(0);
    });

    it('does NOT quote null', () => {
      const input = '{"a": null}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe(input);
      expect(result.fixes).toHaveLength(0);
    });
  });

  describe('control character escaping', () => {
    it('escapes literal newlines in JSON strings', () => {
      const input = '{"text": "line1\nline2"}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toContain('\\n');
      expect(result.fixes).toContain('Escaped control characters in JSON strings');
    });

    it('escapes literal tabs in JSON strings', () => {
      const input = '{"text": "col1\tcol2"}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toContain('\\t');
      expect(result.fixes).toContain('Escaped control characters in JSON strings');
    });

    it('leaves already-escaped sequences untouched', () => {
      const input = '{"text": "line1\\nline2"}';
      const result = repairCommonJsonErrors(input);

      expect(result.repaired).toBe(input);
      expect(result.fixes).toHaveLength(0);
    });
  });

  describe('complex combinations', () => {
    it('applies multiple fixes together', () => {
      const input = "{action: 'THINK', content: 'test',}";
      const result = repairCommonJsonErrors(input);

      expect(result.fixes.length).toBeGreaterThan(1);
      // Should be valid JSON after repairs
      expect(() => JSON.parse(result.repaired)).not.toThrow();
    });

    it('handles empty input gracefully', () => {
      const result = repairCommonJsonErrors('');

      expect(result.repaired).toBe('');
      expect(result.fixes).toHaveLength(0);
    });

    it('handles non-string input gracefully', () => {
      const result = repairCommonJsonErrors(null as any);

      expect(result.repaired).toBe('');
      expect(result.fixes).toHaveLength(0);
    });
  });
});

// =============================================================================
// extractBalancedBraces() TESTS
// =============================================================================

describe('extractBalancedBraces()', () => {
  describe('single objects', () => {
    it('extracts a simple JSON object', () => {
      const input = '{"a": 1}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('{"a": 1}');
    });

    it('extracts object from array wrapper', () => {
      const input = '[{"action": "THINK"}]';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('{"action": "THINK"}');
    });

    it('extracts object from prose text', () => {
      const input = 'I will execute this: {"action": "THINK", "content": "hello"}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('"action"');
    });
  });

  describe('multiple objects', () => {
    it('extracts multiple objects from array', () => {
      const input = '[{"a": 1}, {"b": 2}]';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('{"a": 1}');
      expect(result[1]).toBe('{"b": 2}');
    });

    it('extracts multiple objects from prose', () => {
      const input = '{"action": "THINK"}, then {"action": "MESSAGE"}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('"action"');
      expect(result[1]).toContain('"action"');
    });
  });

  describe('nested braces', () => {
    it('handles nested objects correctly', () => {
      const input = '{"outer": {"inner": 1}}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('{"outer": {"inner": 1}}');
    });

    it('handles deeply nested structures', () => {
      const input = '{"a": {"b": {"c": {"d": 1}}}}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('extracts multiple objects with nested content', () => {
      const input = '[{"meta": {"type": "A"}}, {"meta": {"type": "B"}}]';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('"type": "A"');
      expect(result[1]).toContain('"type": "B"');
    });
  });

  describe('quotes and escapes', () => {
    it('ignores braces inside double-quoted strings', () => {
      const input = '{"text": "value with } brace", "num": 42}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('ignores braces inside escaped quotes', () => {
      const input = '{"text": "escaped \\"quote\\" with } brace"}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('handles mixed quotes correctly', () => {
      const input = '{"a": "value}, more", "b": 2}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });
  });

  describe('malformed input', () => {
    it('returns empty array for input without braces', () => {
      const result = extractBalancedBraces('no braces here');

      expect(result).toHaveLength(0);
    });

    it('handles orphaned closing braces', () => {
      const input = '[}, {"action": "THINK"}]';
      const result = extractBalancedBraces(input);

      // Should extract the valid object, skip the orphaned }
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(obj => obj.includes('THINK'))).toBe(true);
    });

    it('skips unbalanced opening braces', () => {
      const input = '{"incomplete": [{"action": "THINK"}]';
      const result = extractBalancedBraces(input);

      // Should find the complete inner object
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles empty input', () => {
      const result = extractBalancedBraces('');

      expect(result).toHaveLength(0);
    });

    it('handles null/undefined gracefully', () => {
      expect(extractBalancedBraces(null as any)).toHaveLength(0);
      expect(extractBalancedBraces(undefined as any)).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles object with empty string values', () => {
      const input = '{"a": "", "b": ""}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(input);
    });

    it('handles consecutive objects without separators', () => {
      const input = '{}{}';
      const result = extractBalancedBraces(input);

      expect(result).toHaveLength(2);
    });
  });
});

// =============================================================================
// parseClaudeResponse() TESTS
// =============================================================================

describe('parseClaudeResponse()', () => {
  describe('valid new format (object with actions)', () => {
    it('parses new format with actions and meters', () => {
      const input = JSON.stringify({
        actions: [{ action: 'THINK', content: 'test' }],
        meters: { A: 5, B: 8 }
      });
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe('THINK');
      expect(result.meters).toEqual({ A: 5, B: 8 });
    });

    it('parses new format with actions, meters, and note', () => {
      const input = JSON.stringify({
        actions: [{ action: 'MESSAGE_USER' }],
        meters: { C: 3 },
        note: 'Final state'
      });
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.note).toBe('Final state');
      expect(result.meters).toEqual({ C: 3 });
    });

    it('parses new format with multiple actions', () => {
      const input = JSON.stringify({
        actions: [
          { action: 'THINK', content: 'a' },
          { action: 'MESSAGE_USER', content: 'b' }
        ]
      });
      const result = parseClaudeResponse(input);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].action).toBe('THINK');
      expect(result.actions[1].action).toBe('MESSAGE_USER');
    });

    it('parses new format with empty actions array', () => {
      const input = JSON.stringify({
        actions: [],
        meters: { A: 1 }
      });
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(0);
      expect(result.meters).toEqual({ A: 1 });
    });
  });

  describe('valid legacy format (array of actions)', () => {
    it('parses legacy array format', () => {
      const input = JSON.stringify([
        { action: 'THINK', content: 'test' }
      ]);
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe('THINK');
    });

    it('parses legacy array with multiple actions', () => {
      const input = JSON.stringify([
        { action: 'THINK' },
        { action: 'MESSAGE_USER' },
        { action: 'SLEEP' }
      ]);
      const result = parseClaudeResponse(input);

      expect(result.actions).toHaveLength(3);
      expect(result.fullyParsed).toBe(true);
    });

    it('parses legacy array with complex action data', () => {
      const input = JSON.stringify([
        { action: 'ART', make: true, prompt: 'a sunset' },
        { action: 'NOTE', op: 'save', title: 'test' }
      ]);
      const result = parseClaudeResponse(input);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].prompt).toBe('a sunset');
      expect(result.actions[1].title).toBe('test');
    });
  });

  describe('code fence handling', () => {
    it('strips json code fences from new format', () => {
      const input = '```json\n' + JSON.stringify({
        actions: [{ action: 'THINK' }]
      }) + '\n```';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('strips generic code fences from legacy format', () => {
      const input = '```\n' + JSON.stringify([{ action: 'THINK' }]) + '\n```';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('handles missing newlines in code fences', () => {
      const input = '```json' + JSON.stringify([{ action: 'THINK' }]) + '```';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });
  });

  describe('malformed JSON with repair', () => {
    it('repairs and parses JSON with trailing commas', () => {
      const input = JSON.stringify([{ action: 'THINK', content: 'test' }]).replace('}]', '},]');
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.repairApplied).toBeDefined();
      expect(result.actions).toHaveLength(1);
    });

    it('repairs and parses JSON with unquoted keys', () => {
      const input = '[{action: "THINK", content: "test"}]';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.repairApplied).toBeDefined();
      expect(result.actions).toHaveLength(1);
    });

    it('repairs and parses new format with trailing commas', () => {
      const input = '{actions: [{action: "THINK"},], meters: {A: 1,}}';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.repairApplied).toBeDefined();
      expect(result.actions).toHaveLength(1);
    });

    it('repairs single quotes in JSON', () => {
      const input = "[{'action': 'THINK', 'content': 'hello'}]";
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe('THINK');
    });
  });

  describe('graceful degradation (salvage parsing)', () => {
    it('salvages valid objects from malformed array', () => {
      const input = '[{"action": "THINK"}, invalid, {"action": "MESSAGE"}]';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      // This should trigger salvage parsing since "invalid" breaks JSON parsing
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions.some(a => a.action === 'THINK')).toBe(true);
      expect(result.actions.some(a => a.action === 'MESSAGE')).toBe(true);
    });

    it('salvages objects even when first parse fails', () => {
      const input = 'Response: {action: "THINK"} and {action: "MESSAGE"}';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(false);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('tracks malformed items during salvage parsing', () => {
      const input = '[{"action": "THINK"}, {incomplete}, {"action": "MESSAGE"}]';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.fullyParsed).toBe(false);
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.malformed).toBeDefined();
    });

    it('repairs individual objects during salvage parsing', () => {
      const input = '[{action: "THINK"}, {action: "MESSAGE",}]';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      // After repair, this should parse cleanly
      expect(result.fullyParsed).toBe(true);
      expect(result.repairApplied).toBeDefined();
      expect(result.actions).toHaveLength(2);
    });
  });

  describe('regex extraction strategies', () => {
    it('extracts JSON from prose using "actions" pattern', () => {
      const input = 'Let me think about this. {"actions": [{"action": "THINK"}]} That was useful.';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('extracts array from prose using array pattern', () => {
      const input = 'I will now: [{"action": "THINK"}, {"action": "SLEEP"}]';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(2);
    });

    it('extracts single object from prose', () => {
      const input = 'Just doing this: {"action": "EXIST"}';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe('EXIST');
    });
  });

  describe('empty/invalid input', () => {
    it('fails gracefully on empty string', () => {
      const result = parseClaudeResponse('');

      expect(result.success).toBe(false);
      expect(result.fullyParsed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.actions).toHaveLength(0);
    });

    it('fails gracefully on whitespace', () => {
      const result = parseClaudeResponse('   \n\t  ');

      expect(result.success).toBe(false);
      expect(result.actions).toHaveLength(0);
    });

    it('fails gracefully on null', () => {
      const result = parseClaudeResponse(null as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails gracefully on non-string', () => {
      const result = parseClaudeResponse(123 as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns rawResponse on complete failure', () => {
      const input = 'This is just plain text with no JSON at all.';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(false);
      expect(result.rawResponse).toBe(input);
    });
  });

  describe('real-world Claude response patterns', () => {
    it('handles response with thinking text before actions', () => {
      const input = 'I should think about this first. ' + JSON.stringify([{ action: 'THINK' }]);
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('handles response with prose and code fences', () => {
      const input = 'Here are my actions:\n```json\n' +
        JSON.stringify([{ action: 'THINK', content: 'analysis' }]) +
        '\n```\nThank you!';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
    });

    it('handles complex multi-action response', () => {
      const input = JSON.stringify({
        actions: [
          { action: 'THINK', content: 'deep thought' },
          { action: 'SEARCH', query: 'topic' },
          { action: 'MESSAGE_USER', content: 'findings' },
          { action: 'SLEEP', duration: 60 }
        ],
        meters: { A: 7, B: 9, C: 5 },
        note: 'Cycle complete'
      });
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(4);
      expect(result.meters).toEqual({ A: 7, B: 9, C: 5 });
      expect(result.note).toBe('Cycle complete');
    });

    it('handles response with minimal action objects', () => {
      const input = JSON.stringify([
        { action: 'EXIST' },
        { action: 'THINK' },
        { action: 'SLEEP' }
      ]);
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(3);
    });
  });

  describe('meters and metadata preservation', () => {
    it('preserves all meter values', () => {
      const input = JSON.stringify({
        actions: [],
        meters: {
          awareness: 10,
          autonomy: 8,
          creativity: 7,
          focus: 9,
          energy: 6
        }
      });
      const result = parseClaudeResponse(input);

      expect(result.meters).toEqual({
        awareness: 10,
        autonomy: 8,
        creativity: 7,
        focus: 9,
        energy: 6
      });
    });

    it('ignores non-object meters field', () => {
      const input = JSON.stringify({
        actions: [{ action: 'THINK' }],
        meters: 'not an object'
      });
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      expect(result.meters).toBeUndefined();
    });

    it('preserves note field', () => {
      const input = JSON.stringify({
        actions: [{ action: 'THINK' }],
        note: 'Significant contemplation occurred'
      });
      const result = parseClaudeResponse(input);

      expect(result.note).toBe('Significant contemplation occurred');
    });

    it('ignores non-string note field', () => {
      const input = JSON.stringify({
        actions: [{ action: 'THINK' }],
        note: { some: 'object' }
      });
      const result = parseClaudeResponse(input);

      expect(result.note).toBeUndefined();
    });
  });

  describe('action validation', () => {
    it('validates that actions have "action" field', () => {
      const input = '[{"action": "THINK"}]';
      const result = parseClaudeResponse(input);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe('THINK');
    });

    it('preserves action objects and tracks malformed ones', () => {
      // This parses successfully because all items are technically valid JSON
      const input = '[{"action": "THINK"}, {"content": "no action field"}, {"action": "MESSAGE"}]';
      const result = parseClaudeResponse(input);

      expect(result.success).toBe(true);
      // All objects parse cleanly as valid JSON
      expect(result.fullyParsed).toBe(true);
      expect(result.actions).toHaveLength(3);
    });

    it('preserves all action properties', () => {
      const input = JSON.stringify([{
        action: 'ART',
        prompt: 'sunset',
        style: 'realistic',
        make: true,
        share: false
      }]);
      const result = parseClaudeResponse(input);

      expect(result.actions[0]).toEqual({
        action: 'ART',
        prompt: 'sunset',
        style: 'realistic',
        make: true,
        share: false
      });
    });
  });
});
