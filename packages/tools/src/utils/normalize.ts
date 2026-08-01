/**
 * Input normalization utilities
 *
 * @module @persistence/tools/utils/normalize
 * @description Shared utilities for normalizing action parameter inputs.
 *
 * @upstream Called by: definitions/learned/handler.ts, definitions/question/handler.ts, definitions/reminder/handler.ts
 * @downstream Calls: None (pure functions)
 *
 * @antipattern DUPLICATE_NORMALIZE
 *   If you're writing a normalizeId function in a handler, STOP.
 *   Import this shared utility instead. Hookify will flag duplicate code.
 */

/**
 * Normalize input to a positive integer ID.
 * Handles string "5" -> integer 5, whitespace trimming, invalid inputs.
 *
 * @param input - String or number input from action params
 * @returns Normalized positive integer, or null if invalid
 *
 * @example
 * normalizeId("5") // 5
 * normalizeId(5) // 5
 * normalizeId(" 10 ") // 10
 * normalizeId("abc") // null
 * normalizeId(-1) // null
 * normalizeId(0) // null
 */
export function normalizeId(input: string | number | undefined): number | null {
  if (input === undefined || input === null) return null;
  const parsed = Number(String(input).trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}
