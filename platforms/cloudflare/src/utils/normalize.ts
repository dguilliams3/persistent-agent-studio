/**
 * Input normalization utilities for graceful action parameter handling
 *
 * RATIONALE (2026-01-11):
 * Claude (as the loop agent) sometimes sends action parameters with minor variations
 * from the expected format - e.g., string IDs instead of integers. Rather than failing
 * on these edge cases, we normalize inputs to be more forgiving.
 *
 * NOTE: Most normalization functions have been migrated to @persistence/tools.
 * This file only contains normalizeId which is still used by platform db/pinned.js.
 *
 * @module utils/normalize
 */

/**
 * @description Normalizes an ID to an integer, handling string/number inputs gracefully
 *
 * RATIONALE: Claude sometimes sends IDs as strings (e.g., {"id":"1"} instead of {"id":1}).
 * This is a common JSON serialization quirk - some parsers stringify numbers, and Claude
 * may learn from examples that used string IDs. We should accept both.
 *
 * Real example that prompted this:
 *   Claude sent: {"action":"REMINDER","op":"dismiss","id":"1"}
 *   Expected:    {"action":"REMINDER","op":"dismiss","id":1}
 *   Both should work identically.
 *
 * @upstream Called by: db/pinned.js (pinned image actions)
 * @downstream Calls: parseInt (native)
 *
 * @param {string|number|null|undefined} value - The ID value to normalize
 * @returns {number|null} Integer ID, or null if the value can't be parsed as a valid ID
 *
 * @example
 * normalizeId(5)       // 5
 * normalizeId("5")     // 5
 * normalizeId(" 5 ")   // 5 (trims whitespace)
 * normalizeId("5abc")  // 5 (parseInt behavior - takes leading digits)
 * normalizeId("abc")   // null (no leading digits)
 * normalizeId(null)    // null
 * normalizeId(undefined) // null
 * normalizeId("")      // null
 * normalizeId(0)       // 0 (valid ID)
 * normalizeId("0")     // 0 (valid ID)
 */
export function normalizeId(value: string | number | null | undefined): number | null {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // If already a number, validate it
  if (typeof value === 'number') {
    // NaN, Infinity, etc. are invalid
    if (!Number.isFinite(value)) return null;
    // Negative IDs are invalid
    if (value < 0) return null;
    // Return as integer (floor for decimals like 5.7 -> 5)
    return Math.floor(value);
  }

  // String: trim whitespace first, then try to parse
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed)) return null;
    if (parsed < 0) return null;
    return parsed;
  }

  // Any other type (object, array, etc.) - invalid
  return null;
}
