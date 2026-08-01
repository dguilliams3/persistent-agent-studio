/**
 * Mapper layer for converting between flat D1 database rows and nested domain types.
 *
 * @module packages/memory/src/mappers
 * @description
 * Implements the "Flat DB, Nested Types" architecture pattern:
 * - Database stores flat rows with JSON strings for complex fields
 * - Application uses nested TypeScript interfaces for type safety
 * - Mappers provide bidirectional conversion between representations
 *
 * This pattern keeps the SQLite/D1 schema simple while providing rich types
 * in application code. The mapper layer is the single point of responsibility
 * for parsing/stringifying JSON fields and handling edge cases.
 *
 * Key Design Decisions:
 * 1. JSON fields are always coalesced to valid defaults (never throw on parse)
 * 2. Invalid/missing data logs warnings but returns safe defaults
 * 3. All DB writes use `?? null` pattern (D1 accepts null, not undefined)
 * 4. Tier values are validated and default to 'tail' if invalid
 *
 * @upstream Called by:
 *   - packages/memory/src/summarization/ - Summary creation and retrieval
 *   - packages/memory/src/context/ - Context assembly
 *   - platforms/cloudflare/src/db/history.js - History entry CRUD
 *   - platforms/cloudflare/src/db/summaries.js - Summary CRUD
 *
 * @downstream Calls:
 *   - ./types - Domain type definitions
 */

import type {
  HistoryEntry,
  HistoryId,
  HistoryType,
  Summary,
  SummaryMetadata,
  SummaryTier,
  PersonaId,
  CycleId,
  ISOTimestamp,
} from './types';

import type { SummaryRow } from '@persistence/db';

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE ROW TYPES (flat, matches D1 schema)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw history row as returned by D1.
 *
 * @description
 * Flat structure matching the `history` table schema.
 * All complex types (meter snapshot) are stored as JSON strings.
 */
export interface HistoryRow {
  id: number;
  persona_id: number;
  type: string;
  content: string;
  internal: string | null;
  created_at: string;
  summarized_at: string | null;
  cycle_id: number | null;
  meter_snapshot: string | null;
}

/**
 * @description Stringify source IDs for database storage
 *
 * @upstream Called by: summaryToRow()
 * @downstream Calls: JSON.stringify
 *
 * @param ids - Array of IDs (HistoryId or SummaryId)
 * @returns JSON string representation
 *
 * @example
 * stringifySourceIds([1, 2, 3]) // → "[1,2,3]"
 * stringifySourceIds([]) // → "[]"
 */
export function stringifySourceIds(ids: number[]): string {
  return JSON.stringify(ids);
}

/**
 * @description Stringify metadata for database storage
 *
 * @upstream Called by: summaryToRow()
 * @downstream Calls: JSON.stringify
 *
 * @param meta - Metadata object or null
 * @returns JSON string or null
 *
 * @example
 * stringifyMetadata({ entity_tags: ["User"], ... })
 * // → '{"entity_tags":["User"],...}'
 *
 * stringifyMetadata(null) // → null
 *
 * @note D1 accepts null for TEXT columns, so we preserve null instead of "null" string
 */
export function stringifyMetadata(meta: SummaryMetadata | null): string | null {
  if (meta === null) return null;

  // Don't store empty metadata
  const hasContent =
    meta.entity_tags.length > 0 ||
    meta.key_facts.length > 0 ||
    meta.themes.length > 0 ||
    meta.emotional_tone !== null ||
    meta.time_period_label !== null;

  if (!hasContent) return null;

  return JSON.stringify(meta);
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Convert database row to HistoryEntry domain type
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/db/history.js - getHistory(), getHistoryForContext()
 *   - packages/memory/src/context/ - Context assembly
 *
 * @downstream Calls: Type casting only
 *
 * @param row - Raw database row
 * @returns Typed HistoryEntry with branded IDs
 *
 * @example
 * const row = await db.prepare('SELECT * FROM history WHERE id = ?').bind(1).first();
 * const entry = rowToHistory(row);
 * // entry.id is HistoryId, entry.type is HistoryType, etc.
 *
 * @note We trust the database schema for type correctness.
 * Invalid types will surface as TypeScript errors at usage sites.
 */
export function rowToHistory(row: HistoryRow): HistoryEntry {
  return {
    id: row.id as HistoryId,
    persona_id: row.persona_id as PersonaId,
    type: row.type as HistoryType,
    content: row.content,
    internal: row.internal,
    created_at: row.created_at as ISOTimestamp,
    summarized_at: row.summarized_at as ISOTimestamp | null,
    cycle_id: row.cycle_id as CycleId | null,
    meter_snapshot: row.meter_snapshot,
  };
}

/**
 * @description Convert HistoryEntry domain type to database row
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/db/history.js - addHistory(), updateHistory()
 *   - packages/memory/src/context/ - Synthetic memory insertion
 *
 * @downstream Calls: None
 *
 * @param entry - Typed HistoryEntry
 * @returns Flat row structure for D1
 *
 * @example
 * const entry: HistoryEntry = { ... };
 * const row = historyToRow(entry);
 * await db.prepare('INSERT INTO history (...) VALUES (...)').bind(...Object.values(row)).run();
 *
 * @note All fields are coalesced to null (D1 requires null, not undefined)
 */
export function historyToRow(entry: HistoryEntry): HistoryRow {
  return {
    id: entry.id as number,
    persona_id: entry.persona_id as number,
    type: entry.type,
    content: entry.content,
    internal: entry.internal ?? null,
    created_at: entry.created_at,
    summarized_at: entry.summarized_at ?? null,
    cycle_id: entry.cycle_id ?? null,
    meter_snapshot: entry.meter_snapshot ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Serialize tier value for database storage
 *
 * Converts numeric tiers to strings for DB TEXT column.
 * - 2 → '2'
 * - 3 → '3'
 * - 4 → '4'
 * - 'archived' → 'archived'
 *
 * @param tier - Typed SummaryTier
 * @returns String for DB storage
 */
function serializeTier(tier: SummaryTier): string {
  if (typeof tier === 'number') {
    return String(tier);
  }
  return tier; // 'archived' passes through
}

/**
 * @description Convert Summary domain type to database row
 *
 * Handles all serialization:
 * - Stringifies JSON fields (source_ids, metadata)
 * - Serializes tier (number → string for DB)
 * - Coalesces all nulls (D1 requirement)
 * - Preserves ArrayBuffer embedding as-is
 * - Converts branded types to raw numbers
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/db/summaries.js - createSummary(), updateSummary()
 *   - packages/memory/src/summarization/ - Summary creation
 *
 * @downstream Calls:
 *   - stringifySourceIds() - JSON array serialization
 *   - stringifyMetadata() - JSON object serialization
 *   - serializeTier() - Tier number to string
 *
 * @param summary - Typed Summary
 * @returns Flat row structure for D1
 *
 * @example
 * const summary: Summary = { ... };
 * const row = summaryToRow(summary);
 * await db.prepare('INSERT INTO summaries (...) VALUES (...)').bind(...Object.values(row)).run();
 *
 * @note All fields use ?? null pattern (D1 accepts null, not undefined)
 */
export function summaryToRow(summary: Summary): SummaryRow {
  return {
    id: summary.id as number,
    persona_id: summary.persona_id as number,
    summary: summary.summary,
    message_count: summary.message_count,
    covered_range: summary.covered_range,
    covered_start: summary.covered_start ?? null,
    covered_end: summary.covered_end ?? null,
    source_type: summary.source_type,
    source_ids: stringifySourceIds(summary.source_ids),
    tier: serializeTier(summary.tier),
    tier_position: summary.tier_position ?? null,
    created_at: summary.created_at,
    archived_at: summary.archived_at ?? null,
    replaced_by_id: summary.replaced_by_id ?? null,
    embedding: summary.embedding ?? null,
    embedding_model: summary.embedding_model ?? null,
    metadata: stringifyMetadata(summary.metadata),
  };
}
