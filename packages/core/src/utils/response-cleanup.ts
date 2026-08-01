/**
 * Response Content Cleanup
 *
 * @module @persistence/core/utils/response-cleanup
 * @description Provider-agnostic cleanup for LLM response content.
 *
 * Applies common transformations that improve content quality:
 * - Unwrapping markdown code blocks
 * - Normalizing excessive whitespace
 *
 * @upstream Called by:
 *   - @persistence/llm RequestEngine.execute()
 *   - Any code processing raw LLM responses
 */

/**
 * Clean LLM response content
 *
 * Applies provider-agnostic cleanup:
 * 1. Unwrap code blocks (```json ... ``` or ``` ... ```)
 * 2. Normalize excessive whitespace (3+ newlines -> 2)
 * 3. Trim leading/trailing whitespace
 *
 * @param content - Raw content from LLM response
 * @returns Cleaned content
 *
 * @example
 * // Unwraps code blocks
 * cleanResponseContent('```json\n{"action":"THINK"}\n```')
 * // Returns: '{"action":"THINK"}'
 *
 * @example
 * // Normalizes whitespace
 * cleanResponseContent('Line 1\n\n\n\nLine 2')
 * // Returns: 'Line 1\n\nLine 2'
 */
export function cleanResponseContent(content: string): string {
  let cleaned = content;

  // Unwrap markdown code blocks if the ENTIRE content is wrapped
  // Matches: ```json\n...\n``` or ```\n...\n``` (with optional language tag)
  const codeBlockMatch = cleaned.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```\s*$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  }

  // Normalize excessive whitespace (3+ consecutive newlines -> 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}
