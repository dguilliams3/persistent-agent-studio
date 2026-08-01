/**
 * Summary lifecycle and position database operations
 *
 * @module @persistence/db/summaries/lifecycle
 * @description Operations for summary positioning and lifecycle management.
 *
 * Includes:
 * - Sort position management
 * - covered_start backfill
 * - Date parsing from covered_range
 * - Batch position updates
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/summaries.js - Position endpoints
 *   - platforms/cloudflare/src/routes/migrate.js - Backfill migrations
 * @downstream Calls:
 *   - Drizzle query builder
 */

import { eq, isNull } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { scopedSelect, scopedUpdate } from '../scoped-query';
import { summaries } from '../schema/summaries';

// ═══════════════════════════════════════════════════════════════════════════
// DATE PARSING
// ═══════════════════════════════════════════════════════════════════════════

const MONTH_MAP: Record<string, number> = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};

/**
 * @description Parses covered_range string to extract the start date
 *
 * Handles multiple formats:
 * - "1/8/2026, 10:24:54 PM to ..." (slash with seconds)
 * - "Jan 9, 3:09 PM to ..." (month abbreviation)
 * - "Meta-summary of [...] (...)" (recursive)
 * - "Batch summary (...): ..." (recursive)
 *
 * @param range - The covered_range string to parse
 * @returns The extracted start date, or null if unparseable
 */
export function parseCoveredRangeStartDate(range: string): Date | null {
  if (!range || typeof range !== 'string') return null;

  // FORMAT 1: Slash with seconds - "1/8/2026, 10:24:54 PM to ..."
  let match = range.match(/^(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)\s+(AM|PM)\s+to/);
  if (match) {
    const [, month, day, year, hour, min, sec, ampm] = match;
    let h = parseInt(hour);
    if (ampm === 'PM' && h !== 12) h += 12;
    else if (ampm === 'AM' && h === 12) h = 0;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(min), parseInt(sec));
  }

  // FORMAT 5: Batch summary - "Batch summary (title): date range"
  match = range.match(/^Batch summary\s+\([^)]+\):\s+(.+)$/);
  if (match) {
    return parseCoveredRangeStartDate(match[1]);
  }

  // FORMAT 4: Meta-summary - "Meta-summary of [...] (date range)"
  match = range.match(/^Meta-summary of \[[^\]]+\]\s+\((.+)\)$/);
  if (match) {
    // Strip trailing parens that might be nested
    return parseCoveredRangeStartDate(match[1].replace(/\)+$/, ''));
  }

  // FORMAT 2/3: Month abbreviation - "Jan 9, 3:09 PM to ..."
  match = range.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+),\s+(\d+):(\d+)\s+(AM|PM)\s+to/);
  if (match) {
    const [, month, day, hour, min, ampm] = match;
    let h = parseInt(hour);
    if (ampm === 'PM' && h !== 12) h += 12;
    else if (ampm === 'AM' && h === 12) h = 0;
    return new Date(2026, MONTH_MAP[month], parseInt(day), h, parseInt(min), 0);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Updates the sort_position for a summary
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to update
 * @param position - The new sort position (null to clear)
 * @returns Result with number of rows affected
 */
export async function setSummaryPosition(
  db: DrizzleD1,
  summaryId: number,
  position: number | null
): Promise<{ changes: number }> {
  const update = await scopedUpdate(db, summaries);
  const result = await update.set({ sortPosition: position ?? null })
    .where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}

/**
 * @description Batch update sort_position for multiple summaries (v24 sort redesign)
 *
 * @param db - Drizzle D1 client
 * @param positions - Array of position updates
 * @returns Count of rows updated
 */
export async function batchSummaryPositions(
  db: DrizzleD1,
  positions: Array<{ id: number; position: number }>
): Promise<{ updated: number }> {
  if (!positions || positions.length === 0) return { updated: 0 };

  let updated = 0;
  for (const { id, position } of positions) {
    try {
      const update = await scopedUpdate(db, summaries);
      await update.set({ sortPosition: position })
        .where(eq(summaries.id, id));
      updated++;
    } catch (err) {
      console.error(`[batchSummaryPositions] Failed to update summary ${id}:`, (err as Error).message);
    }
  }

  return { updated };
}

// ═══════════════════════════════════════════════════════════════════════════
// COVERED_START MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Updates the covered_start for a summary
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to update
 * @param coveredStart - ISO timestamp string
 * @returns Result with number of rows affected
 */
export async function setCoveredStart(
  db: DrizzleD1,
  summaryId: number,
  coveredStart: string
): Promise<{ changes: number }> {
  const update = await scopedUpdate(db, summaries);
  const result = await update.set({ coveredStart })
    .where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}

/**
 * @description Backfills covered_start for all summaries that don't have it
 *
 * @param db - Drizzle D1 client
 * @returns Statistics about the backfill operation
 */
export async function backfillCoveredStart(db: DrizzleD1): Promise<{
  updated: number;
  failed: number;
  errors: Array<{ id: number; covered_range: string }>;
}> {
  const query = await scopedSelect(db, summaries);
  const rawRows = await query.where(isNull(summaries.coveredStart))
    .all();
  const rows = rawRows.map(row => ({ id: row.id, coveredRange: row.coveredRange }));

  let updated = 0;
  let failed = 0;
  const errors: Array<{ id: number; covered_range: string }> = [];

  for (const row of rows) {
    const startDate = parseCoveredRangeStartDate(row.coveredRange ?? '');
    if (startDate) {
      await setCoveredStart(db, row.id, startDate.toISOString());
      updated++;
    } else {
      failed++;
      errors.push({ id: row.id, covered_range: (row.coveredRange ?? '').slice(0, 50) });
    }
  }

  return { updated, failed, errors };
}
