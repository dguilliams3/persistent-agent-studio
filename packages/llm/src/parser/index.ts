/**
 * @module parser
 * @description Claude response parsing utilities.
 *
 * This module provides robust JSON parsing for Claude's action responses,
 * including:
 * - Multiple parsing strategies (direct, regex, salvage)
 * - JSON repair for common formatting errors
 * - Balanced brace extraction for malformed responses
 *
 * @upstream Used by:
 *   - Platform sync mode (index.js runThinkingCycle)
 *   - Platform batch mode (batch-processor.js)
 *
 * @downstream None (pure parsing logic)
 *
 * @example
 * import { parseClaudeResponse, repairCommonJsonErrors } from '@persistence/llm';
 *
 * const result = parseClaudeResponse(claudeText);
 * if (result.success) {
 *   for (const action of result.actions) {
 *     console.log(action.action, action.content);
 *   }
 * }
 */

// Types
export type {
  ParsedAction,
  MalformedAction,
  ParseResult,
  RepairResult,
  ParseResultGeneric,
} from '../types';

// JSON repair utilities
export { repairCommonJsonErrors, extractBalancedBraces } from './json-repair';

// Main response parser
export { parseClaudeResponse } from './response-parser';
