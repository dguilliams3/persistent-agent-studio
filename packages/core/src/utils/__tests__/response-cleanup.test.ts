/**
 * Tests for response content cleanup
 *
 * @covers cleanResponseContent
 */

import { describe, it, expect } from 'vitest';
import { cleanResponseContent } from '../response-cleanup';

describe('cleanResponseContent', () => {
  describe('code block unwrapping', () => {
    it('unwraps ```json code blocks', () => {
      const input = '```json\n{"action":"THINK","content":"test"}\n```';
      const result = cleanResponseContent(input);
      expect(result).toBe('{"action":"THINK","content":"test"}');
    });

    it('unwraps plain ``` code blocks', () => {
      const input = '```\n{"action":"THINK"}\n```';
      const result = cleanResponseContent(input);
      expect(result).toBe('{"action":"THINK"}');
    });

    it('unwraps code blocks with other language tags', () => {
      const input = '```javascript\nconsole.log("hello");\n```';
      const result = cleanResponseContent(input);
      expect(result).toBe('console.log("hello");');
    });

    it('preserves content with inline code blocks', () => {
      // If code block is not the entire content, don't unwrap
      const input = 'Here is some code:\n```json\n{"a":1}\n```\nEnd.';
      const result = cleanResponseContent(input);
      expect(result).toBe('Here is some code:\n```json\n{"a":1}\n```\nEnd.');
    });

    it('handles code block with trailing whitespace', () => {
      const input = '```json\n{"action":"THINK"}\n```  \n';
      const result = cleanResponseContent(input);
      expect(result).toBe('{"action":"THINK"}');
    });
  });

  describe('whitespace normalization', () => {
    it('normalizes 3+ newlines to 2', () => {
      const input = 'Line 1\n\n\n\nLine 2';
      const result = cleanResponseContent(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('normalizes multiple groups of excessive newlines', () => {
      const input = 'A\n\n\n\nB\n\n\n\n\nC';
      const result = cleanResponseContent(input);
      expect(result).toBe('A\n\nB\n\nC');
    });

    it('preserves double newlines', () => {
      const input = 'Line 1\n\nLine 2';
      const result = cleanResponseContent(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('trims leading and trailing whitespace', () => {
      const input = '  \n\nContent here\n\n  ';
      const result = cleanResponseContent(input);
      expect(result).toBe('Content here');
    });
  });

  describe('no changes needed', () => {
    it('returns clean content unchanged', () => {
      const input = '{"action":"THINK","content":"test"}';
      const result = cleanResponseContent(input);
      expect(result).toBe(input);
    });

    it('handles empty string', () => {
      const result = cleanResponseContent('');
      expect(result).toBe('');
    });

    it('handles whitespace-only string', () => {
      const result = cleanResponseContent('   \n\n   ');
      expect(result).toBe('');
    });
  });

  describe('combined scenarios', () => {
    it('unwraps code block AND normalizes whitespace', () => {
      const input = '```json\n\n\n\n{"action":"THINK"}\n\n\n\n```';
      const result = cleanResponseContent(input);
      // Code block unwrapped, then whitespace normalized
      expect(result).toBe('{"action":"THINK"}');
    });

    it('handles multiline JSON in code block', () => {
      const input = '```json\n[\n  {"action": "THINK"},\n  {"action": "EXIST"}\n]\n```';
      const result = cleanResponseContent(input);
      expect(result).toBe('[\n  {"action": "THINK"},\n  {"action": "EXIST"}\n]');
    });
  });
});
