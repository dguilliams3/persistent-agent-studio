/**
 * Reminders (persistent alerts) database operations
 *
 * @module @persistence/db/llm-storage/reminders
 * @description Database operations for persistent reminders that survive thinking cycles.
 *
 * Reminder conditions:
 * - `persistent` (default): Always shown in context
 * - `next_user_message`: Only shown when the user sends a message
 * - `after:YYYY-MM-DD`: Only shown after the specified date
 *
 * Uses soft delete (dismissed_at timestamp) for audit trail.
 *
 * @upstream Called by:
 *   - packages/telegram/src/commands/context_data/reminders/handler.ts
 *   - packages/tools/src/definitions/reminder/handler.ts
 *   - platforms/cloudflare context building
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   If you're writing raw SQL for reminders operations in a handler, STOP.
 *   Import and use these functions instead. Handlers should orchestrate, not query.
 */

import { eq, and, isNull, sql, asc, desc } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { reminders } from '../schema/reminders';
import type { ReminderEntry } from './ReminderEntry';
import type { ReminderAddResult } from './ReminderAddResult';

/**
 * Options for persona-scoped reminder operations.
 */
interface ReminderOptions {
  personaId?: number;
}

/**
 * @description Retrieves all active reminders (not dismissed)
 *
 * Returns reminders that should currently be shown in context.
 *
 * @upstream Called by:
 *   - packages/telegram/src/commands/context_data/reminders/handler.ts - /reminders command
 *   - platforms/cloudflare context building
 * @downstream Calls:
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of active reminders, sorted by ID
 *
 * @note Only returns active (dismissed_at IS NULL)
 */
export async function getReminders(db: DrizzleD1, options: ReminderOptions = {}): Promise<ReminderEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select({
    id: reminders.id,
    content: reminders.content,
    condition: reminders.condition,
    created_at: reminders.createdAt,
    dismissed_at: reminders.dismissedAt,
  })
    .from(reminders)
    .where(and(
      eq(reminders.personaId, personaId),
      isNull(reminders.dismissedAt)
    ))
    .orderBy(asc(reminders.id))
    .all();

  return rows.map(row => ({ ...row, triggered: 0 })) as ReminderEntry[];
}

/**
 * @description Retrieves ALL reminders including dismissed ones
 *
 * Use this for auditing or debugging.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of all reminders
 */
export async function getAllReminders(db: DrizzleD1, options: ReminderOptions = {}): Promise<ReminderEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select({
    id: reminders.id,
    content: reminders.content,
    condition: reminders.condition,
    created_at: reminders.createdAt,
    dismissed_at: reminders.dismissedAt,
  })
    .from(reminders)
    .where(eq(reminders.personaId, personaId))
    .orderBy(desc(reminders.createdAt))
    .all();

  return rows.map(row => ({ ...row, triggered: row.dismissed_at ? 1 : 0 })) as ReminderEntry[];
}

/**
 * @description Adds a new reminder with condition
 *
 * Creates a new persistent reminder.
 *
 * @upstream Called by:
 *   - packages/telegram/src/commands/context_data/reminders/handler.ts - /reminder add
 *   - packages/tools/src/definitions/reminder/handler.ts - REMINDER set action
 * @downstream Calls:
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param content - The reminder text
 * @param condition - When to show (default: 'persistent')
 * @param options - Optional settings
 * @returns The ID and condition of the new reminder
 */
export async function addReminder(
  db: DrizzleD1,
  content: string,
  condition: string = 'persistent',
  options: ReminderOptions = {}
): Promise<ReminderAddResult> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.insert(reminders).values({
    personaId,
    content,
    condition,
  }).returning({ id: reminders.id });

  return {
    id: result[0].id,
    condition
  };
}

/**
 * @description Dismisses (soft deletes) a reminder
 *
 * Sets dismissed_at timestamp rather than hard deleting for audit trail.
 *
 * @upstream Called by:
 *   - packages/telegram/src/commands/context_data/reminders/handler.ts - /reminder remove
 *   - packages/tools/src/definitions/reminder/handler.ts - REMINDER dismiss action
 * @downstream Calls:
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param id - The reminder ID to dismiss
 * @param options - Optional settings
 * @returns True if dismissed, false if not found or already dismissed
 */
export async function dismissReminder(
  db: DrizzleD1,
  id: number,
  options: ReminderOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.update(reminders)
    .set({ dismissedAt: sql`datetime("now")` })
    .where(and(
      eq(reminders.personaId, personaId),
      eq(reminders.id, id),
      isNull(reminders.dismissedAt)
    ))
    .returning({ id: reminders.id });

  return result.length > 0;
}

/**
 * @description Marks a reminder as triggered (dismissed after firing)
 *
 * Used for condition-based reminders that fire once (like next_user_message).
 * Implemented via dismissedAt since the D1 schema uses soft-delete for this pattern.
 *
 * @param db - Drizzle D1 client
 * @param id - The reminder ID
 * @param options - Optional settings
 * @returns True if triggered, false if not found
 */
export async function triggerReminder(
  db: DrizzleD1,
  id: number,
  options: ReminderOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.update(reminders)
    .set({ dismissedAt: sql`datetime("now")` })
    .where(and(
      eq(reminders.personaId, personaId),
      eq(reminders.id, id),
      isNull(reminders.dismissedAt)
    ))
    .returning({ id: reminders.id });

  return result.length > 0;
}

/**
 * @description Batch dismisses multiple reminders
 *
 * Efficiently dismisses multiple reminders in one operation.
 *
 * @param db - Drizzle D1 client
 * @param ids - Array of reminder IDs to dismiss
 * @param options - Optional settings
 * @returns Results
 */
export async function batchDismissReminders(
  db: DrizzleD1,
  ids: number[],
  options: ReminderOptions = {}
): Promise<{ dismissed: number[]; notFound: number[] }> {
  const dismissed: number[] = [];
  const notFound: number[] = [];

  for (const id of ids) {
    const success = await dismissReminder(db, id, options);
    if (success) {
      dismissed.push(id);
    } else {
      notFound.push(id);
    }
  }

  return { dismissed, notFound };
}

// =============================================================================
// PURE UTILITY FUNCTIONS
// =============================================================================

/**
 * Context passed to checkReminderDue for condition evaluation
 */
export interface ReminderContext {
  /** Whether the user has sent a new message this cycle */
  newUserMessage?: boolean;
}

/**
 * @description Checks if a single reminder's condition is met and should be shown
 *
 * Pure function for evaluating reminder conditions against current context.
 * Used by context building to filter which reminders to include.
 *
 * @upstream Called by:
 *   - Context building (to filter reminders for display)
 * @downstream Calls: None (pure function)
 *
 * @param reminder - The reminder to check (needs condition field)
 * @param context - Context about current state
 * @returns True if the reminder's condition is met and should be shown
 */
export function checkReminderDue(
  reminder: { condition?: string | null },
  context: ReminderContext = {}
): boolean {
  const { condition } = reminder;
  if (!condition || condition === 'persistent') return true;

  if (condition === 'next_user_message' && context.newUserMessage) return true;

  if (condition.startsWith('after:')) {
    const afterDate = new Date(condition.slice(6));
    if (!isNaN(afterDate.getTime()) && new Date() >= afterDate) return true;
  }

  return false;
}
