/**
 * Summary statistics database operations
 *
 * @module @persistence/db/summaries/stats
 * @description Aggregation and analytics functions for summaries.
 *
 * Provides counts and totals for:
 * - Active vs archived summary counts
 * - Total message coverage
 * - Dashboard displays and monitoring
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/summaries.js - GET /summaries stats endpoint
 * @downstream Calls:
 *   - Drizzle query builder
 */

import { isNull, isNotNull, eq, and, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { summaries } from '../schema/summaries';

/**
 * @description Gets summary statistics (counts of active/archived)
 *
 * Useful for dashboard displays and monitoring.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/summaries.js - GET /summaries endpoint for stats
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @returns Stats object with active/archived counts and total message coverage
 */
export async function getSummaryStats(db: DrizzleD1): Promise<{
  active: number;
  archived: number;
  totalMessages: number;
}> {
  const personaId = await getActivePersonaId(db);
  const [activeResult, archivedResult, messagesResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(summaries)
      .where(and(eq(summaries.personaId, personaId), isNull(summaries.archivedAt)))
      .get(),
    db.select({ count: sql<number>`count(*)` })
      .from(summaries)
      .where(and(eq(summaries.personaId, personaId), isNotNull(summaries.archivedAt)))
      .get(),
    db.select({ total: sql<number>`sum(message_count)` })
      .from(summaries)
      .where(and(eq(summaries.personaId, personaId), isNull(summaries.archivedAt)))
      .get(),
  ]);

  return {
    active: activeResult?.count ?? 0,
    archived: archivedResult?.count ?? 0,
    totalMessages: messagesResult?.total ?? 0
  };
}
