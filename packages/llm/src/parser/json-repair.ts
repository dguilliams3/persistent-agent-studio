/**
 * @module parser/json-repair
 * @description JSON repair utilities for fixing common formatting errors.
 *
 * These functions apply conservative fixes to common JSON errors that Claude
 * sometimes produces. They only fix patterns we're confident about - never
 * attempting major structural repairs or guesses.
 *
 * @upstream Called by: response-parser.ts (fallback strategy)
 * @downstream None (pure parsing logic)
 */

import type { RepairResult } from '../types';

/**
 * @description Attempt to repair common JSON formatting errors in text.
 *
 * This function applies conservative fixes to common JSON errors that Claude sometimes
 * produces. It only fixes patterns we're very confident about - never attempts major
 * structural repairs or guesses.
 *
 * Fixes applied (in order):
 * 1. Trailing commas in objects and arrays: {a: 1,} -> {a: 1}, [1,2,] -> [1,2]
 * 2. Single quotes to double quotes: {'a': 'b'} -> {"a": "b"}
 *    (respects quotes already inside double-quoted strings)
 * 3. Unquoted keys: {action: "X"} -> {"action": "X"}
 *    (matches simple identifiers before colons)
 * 4. Unquoted string values: {"a": hello} -> {"a": "hello"}
 *    (only for simple alphanumeric values, not numbers/booleans/null)
 *
 * @param text - Potentially malformed JSON text
 * @returns Object with repaired text and list of fixes applied
 *
 * @example
 * const result = repairCommonJsonErrors('{"a": 1,}');
 * // Returns: { repaired: '{"a": 1}', fixes: ['Removed trailing commas in objects/arrays'] }
 *
 * @example
 * const result = repairCommonJsonErrors("{'action': 'THINK'}");
 * // Returns: { repaired: '{"action": "THINK"}', fixes: ['Converted single quotes to double quotes'] }
 *
 * @note This is intentionally conservative. It will NOT:
 *   - Fix truncated strings
 *   - Fix missing closing braces/brackets
 *   - Try to parse escaped characters
 *   - Fix major structural issues
 *   If a pattern seems uncertain, it's left alone.
 */
export function repairCommonJsonErrors(text: string): RepairResult {
  if (!text || typeof text !== 'string') {
    return { repaired: text || '', fixes: [] };
  }

  let repaired = text;
  const fixes: string[] = [];

  // Fix 1: Remove trailing commas in objects and arrays
  // Match: comma followed by } or ]
  const trailingCommaRegex = /,(\s*[}\]])/g;
  if (trailingCommaRegex.test(repaired)) {
    repaired = repaired.replace(trailingCommaRegex, '$1');
    fixes.push('Removed trailing commas in objects/arrays');
  }

  // Fix 2: Convert single quotes to double quotes
  // Strategy: Replace single quotes that are NOT inside double-quoted strings
  // We'll be conservative: only replace 'text' patterns where single quotes wrap content
  // Pattern: ' followed by non-quote content, followed by '
  // But skip if we're already inside a double-quoted string

  // First, protect strings that are already double-quoted by replacing them temporarily
  const doubleQuotedStrings: string[] = [];
  let protectIndex = 0;
  let tempRepaired = repaired.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    doubleQuotedStrings[protectIndex] = match;
    return `__QUOTED_STRING_${protectIndex++}__`;
  });

  // Now replace single quotes with double quotes in unprotected areas
  const singleQuoteRegex = /'([^']*)'/g;
  if (singleQuoteRegex.test(tempRepaired)) {
    tempRepaired = tempRepaired.replace(singleQuoteRegex, '"$1"');
    fixes.push('Converted single quotes to double quotes');
  }

  // Restore the protected double-quoted strings
  doubleQuotedStrings.forEach((str, idx) => {
    tempRepaired = tempRepaired.replace(`__QUOTED_STRING_${idx}__`, str);
  });
  repaired = tempRepaired;

  // Fix 3: Quote unquoted keys
  // Pattern: { or , followed by whitespace, then identifier (letters/numbers/_), then :
  // Example: {action: "X"} -> {"action": "X"}
  const unquotedKeyRegex = /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  if (unquotedKeyRegex.test(repaired)) {
    repaired = repaired.replace(unquotedKeyRegex, '$1"$2":');
    fixes.push('Quoted unquoted object keys');
  }

  // Fix 4: Escape unescaped newlines and tabs in JSON strings
  // JSON requires control characters to be escaped, but Claude sometimes returns literal ones
  // We need to be careful to only escape within quoted strings
  // Strategy: Temporarily protect already-valid JSON strings, then escape control chars in the rest

  // First, protect valid JSON strings (those that don't contain unescaped control chars)
  const stringProtector: string[] = [];
  let protectIdx = 0;
  let protectedText = repaired.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    // Check if this string contains unescaped newlines or tabs
    if (match.includes('\n') || match.includes('\t')) {
      // This string needs repairing - don't protect it
      return match;
    } else {
      // This string is already valid - protect it
      stringProtector[protectIdx] = match;
      return `__PROTECTED_STRING_${protectIdx++}__`;
    }
  });

  // Now escape control characters in unprotected strings
  protectedText = protectedText.replace(/(".*?")/gs, (match) => {
    if (match.includes('__PROTECTED_STRING_')) return match; // Skip protected strings
    // Escape newlines and tabs
    return match.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  });

  // Restore protected strings
  stringProtector.forEach((str, idx) => {
    protectedText = protectedText.replace(`__PROTECTED_STRING_${idx}__`, str);
  });

  if (protectedText !== repaired) {
    repaired = protectedText;
    fixes.push('Escaped control characters in JSON strings');
  }

  // Fix 5: Quote simple unquoted string values
  // Pattern: : followed by whitespace, then a simple identifier (not a number, boolean, null, or quoted string)
  // This is tricky - we want to quote values like: {"a": hello} but NOT: {"a": 123} or {"a": true} or {"a": "text"}
  // Safe pattern: : followed by a simple alphanumeric identifier that isn't followed by special chars
  const unquotedValueRegex = /:\s*(?!["'\d\-true|false|null|\[|\{])([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  if (unquotedValueRegex.test(repaired)) {
    repaired = repaired.replace(unquotedValueRegex, ': "$1"');
    fixes.push('Quoted unquoted string values');
  }

  return { repaired, fixes };
}

/**
 * @description Extract all top-level JSON objects {...} from a string with robust brace balancing.
 *
 * Handles:
 * - Nested braces (properly matched)
 * - Braces inside quoted strings (ignored as structure)
 * - Escaped quotes (\"... doesn't break string parsing)
 * - Malformed JSON with unbalanced braces (returns what it can find)
 *
 * Algorithm:
 * 1. Iterate through string character by character
 * 2. Track whether we're inside a quoted string (and handle escapes)
 * 3. Count opening/closing braces only when not in a string
 * 4. When brace count reaches 0 after opening, we found a complete object
 * 5. Continue searching for more objects (don't stop at first match)
 *
 * @param text - Input text that may contain JSON objects and other content
 * @returns Array of extracted object strings (may be empty if no valid objects found)
 *
 * @example
 * extractBalancedBraces('[{"a": 1}, "orphan", {"b": {"c": 2}}]')
 * // Returns: ['{"a": 1}', '{"b": {"c": 2}}']
 *
 * @example
 * extractBalancedBraces('[{"action": "THINK"}, "internal": "oops"}, {"action": "MESSAGE"}]')
 * // Returns: ['{"action": "THINK"}', '{"action": "MESSAGE"}']
 * // Note: "internal": "oops"} is orphaned (no opening brace), skipped
 *
 * @example
 * extractBalancedBraces('{"key": "value with } inside", "num": 42}')
 * // Returns: ['{"key": "value with } inside", "num": 42}']
 * // Correctly ignores } inside quoted string
 *
 * @note Returns empty array if input is null/undefined/not a string
 * @note Malformed JSON won't crash - function gracefully handles unbalanced braces
 * @note Objects are returned in the order they appear in the input
 */
export function extractBalancedBraces(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const objects: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Find the next opening brace
    const startIdx = text.indexOf('{', i);
    if (startIdx === -1) {
      // No more opening braces found
      break;
    }

    // Track whether we're inside a quoted string
    let inString = false;
    let escapeNext = false;
    let braceCount = 0;
    let endIdx = -1;

    // Iterate from the opening brace onwards
    for (let j = startIdx; j < text.length; j++) {
      const char = text[j];

      // Handle escape sequences
      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      // Handle backslash escape
      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      // Toggle string state on unescaped quotes
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      // Count braces only when not inside a string
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;

          // When braceCount reaches 0, we've found the closing brace
          if (braceCount === 0) {
            endIdx = j;
            break;
          }
        }
      }
    }

    // If we found a balanced object, extract it
    if (endIdx !== -1) {
      const objectStr = text.substring(startIdx, endIdx + 1);
      objects.push(objectStr);
      // Continue searching after this object
      i = endIdx + 1;
    } else {
      // Unbalanced brace - skip this opening brace and continue
      i = startIdx + 1;
    }
  }

  return objects;
}
