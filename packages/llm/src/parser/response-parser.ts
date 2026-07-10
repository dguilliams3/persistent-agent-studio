/**
 * @module parser/response-parser
 * @description Shared response parsing for Claude's action JSON output.
 *
 * This module centralizes the logic for parsing Claude's responses into action objects.
 * Used by both sync mode and batch mode to ensure consistent behavior and DRY code.
 *
 * Features:
 * - Multiple parsing strategies (direct JSON, code fences, embedded in prose)
 * - Smart JSON repair for common formatting errors
 * - Conservative error correction (only patterns we're confident about)
 *
 * @upstream Called by:
 *   - Platform index.js runThinkingCycle() - sync mode action parsing
 *   - Platform batch-processor.js processPendingBatches() - batch mode action parsing
 *
 * @downstream Calls: repairCommonJsonErrors, extractBalancedBraces
 */

import type { ParseResult, ParsedAction } from '../types';
import { repairCommonJsonErrors, extractBalancedBraces } from './json-repair';

/**
 * @description Parse Claude's response text into actions and meters.
 *
 * Handles multiple formats Claude might return:
 * 1. New format: {"actions": [...], "meters": {"A": 8, ...}}
 * 2. Legacy array: [{"action": "THINK", ...}]
 * 3. Code-fenced JSON: ```json\n{...}\n``` or ```json\n[...]\n```
 * 4. JSON embedded in prose: "I'll do this... {...}"
 * 5. Malformed JSON with some valid actions: salvage what we can
 *
 * Parsing strategies (tried in order):
 * 1. Direct JSON parse - check for new format (object with actions/meters fields)
 * 2. Direct JSON parse - check for legacy format (array of actions)
 * 3. Smart repair (trailing commas, quotes, unquoted keys) + parse
 * 4. Regex extraction + parse
 * 5. Balanced brace extraction + individual object parsing (graceful degradation)
 *
 * @param responseText - Raw text from Claude's response
 * @returns ParseResult with success status, actions, meters, and error info
 *
 * @example
 * // New format with meters
 * const result = parseClaudeResponse('{"actions": [{"action": "THINK"}], "meters": {"A": 8}}');
 * // Returns: { success: true, fullyParsed: true, actions: [...], meters: {A: 8} }
 *
 * @example
 * // Legacy array format (backwards compatible)
 * const result = parseClaudeResponse('[{"action": "THINK", "content": "..."}]');
 * // Returns: { success: true, fullyParsed: true, actions: [...] }
 *
 * @note Returns rawResponse on complete failure for debugging/display purposes
 * @note fullyParsed: true means clean parse worked; false means salvage parsing was used
 * @note meters field only present if response included it (new format)
 */
export function parseClaudeResponse(responseText: string): ParseResult {
  if (!responseText || typeof responseText !== 'string') {
    return {
      success: false,
      fullyParsed: false,
      actions: [],
      error: 'Empty or invalid response text',
      rawResponse: String(responseText || '')
    };
  }

  // Strategy 1: Try direct JSON parse after stripping code fences
  try {
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleanJson);

    // Check for new format: {"actions": [...], "meters": {...}, "note": "..."}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.actions)) {
      const result: ParseResult = { success: true, fullyParsed: true, actions: parsed.actions as ParsedAction[] };
      if (parsed.meters && typeof parsed.meters === 'object') {
        result.meters = parsed.meters as Record<string, number>;
      }
      if (parsed.note && typeof parsed.note === 'string') {
        result.note = parsed.note;
      }
      return result;
    }

    // Legacy format: array of actions directly
    const actions = Array.isArray(parsed) ? parsed : [parsed];
    return { success: true, fullyParsed: true, actions: actions as ParsedAction[] };
  } catch {
    // Primary parse failed, try fallback strategies
  }

  // Strategy 2: Try smart repair + parse
  const { repaired, fixes } = repairCommonJsonErrors(responseText);
  if (fixes.length > 0) {
    try {
      const cleanRepaired = repaired
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleanRepaired);

      // Check for new format with meters and note
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.actions)) {
        const result: ParseResult = { success: true, fullyParsed: true, actions: parsed.actions as ParsedAction[], repairApplied: fixes };
        if (parsed.meters && typeof parsed.meters === 'object') {
          result.meters = parsed.meters as Record<string, number>;
        }
        if (parsed.note && typeof parsed.note === 'string') {
          result.note = parsed.note;
        }
        return result;
      }

      // Legacy format
      const actions = Array.isArray(parsed) ? parsed : [parsed];
      return { success: true, fullyParsed: true, actions: actions as ParsedAction[], repairApplied: fixes };
    } catch {
      // Repair helped but still couldn't parse, continue
    }
  }

  // Strategy 3: Extract JSON object with "actions" field (new format)
  const objectMatch = responseText.match(/\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed && Array.isArray(parsed.actions)) {
        const result: ParseResult = { success: true, fullyParsed: true, actions: parsed.actions as ParsedAction[] };
        if (parsed.meters && typeof parsed.meters === 'object') {
          result.meters = parsed.meters as Record<string, number>;
        }
        if (parsed.note && typeof parsed.note === 'string') {
          result.note = parsed.note;
        }
        return result;
      }
    } catch {
      // Object regex matched but JSON was malformed - continue
    }
  }

  // Strategy 4: Extract JSON array from response using regex (legacy format)
  const arrayMatch = responseText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const actions = JSON.parse(arrayMatch[0]);
      if (Array.isArray(actions)) {
        return { success: true, fullyParsed: true, actions: actions as ParsedAction[] };
      }
    } catch {
      // Array regex matched but JSON was malformed - try salvage parsing
    }
  }

  // Strategy 5: Graceful degradation - extract individual objects with balanced braces
  const extractedObjects = extractBalancedBraces(responseText);
  if (extractedObjects.length > 0) {
    const actions: ParsedAction[] = [];
    const malformed: { raw: string; error: string }[] = [];

    for (const objStr of extractedObjects) {
      // Try to parse each object individually
      try {
        const action = JSON.parse(objStr);
        // Verify it has an action field (basic validation)
        if (action && typeof action === 'object' && action.action) {
          actions.push(action as ParsedAction);
        } else {
          malformed.push({ raw: objStr, error: 'Missing "action" field' });
        }
      } catch (objError) {
        // Try repair on this specific object
        const { repaired: repairedObj, fixes: objFixes } = repairCommonJsonErrors(objStr);
        if (objFixes.length > 0) {
          try {
            const action = JSON.parse(repairedObj);
            if (action && typeof action === 'object' && action.action) {
              actions.push(action as ParsedAction);
              continue;
            }
          } catch {
            // Repair didn't help
          }
        }
        malformed.push({ raw: objStr, error: objError instanceof Error ? objError.message : String(objError) });
      }
    }

    if (actions.length > 0) {
      return {
        success: true,
        fullyParsed: false,
        actions,
        malformed: malformed.length > 0 ? malformed : undefined
      };
    }
  }

  // Strategy 6: Extract single JSON object from response
  const objMatch = responseText.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const action = JSON.parse(objMatch[0]);
      return { success: true, fullyParsed: true, actions: [action as ParsedAction] };
    } catch {
      // Object regex matched but JSON was malformed
    }
  }

  // All strategies failed
  return {
    success: false,
    fullyParsed: false,
    actions: [],
    error: 'Failed to parse JSON from response (tried direct parse, smart repair, array extraction, balanced brace extraction, object extraction)',
    rawResponse: responseText
  };
}
