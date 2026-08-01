/**
 * A single history entry from the timeline.
 *
 * This is the atomic unit of memory — everything starts here.
 */
import type { HistoryId } from './HistoryId';
import type { PersonaId } from './PersonaId';
import type { CycleId } from './CycleId';
import type { ISOTimestamp } from './ISOTimestamp';
import type { HistoryType } from './HistoryType';

export interface HistoryEntry {
  /** Primary key */
  id: HistoryId;

  /** Owner persona (multi-persona support) */
  persona_id: PersonaId;

  /** Entry type — determines icon and processing */
  type: HistoryType;

  /**
   * Main content.
   * - Text for most types
   * - Base64 image data for art_result (with data: prefix)
   * - JSON for some internal types
   */
  content: string;

  /**
   * Internal notes / subthought.
   * - Shown with special badge in UI
   * - May contain image data for user_message
   */
  internal: string | null;

  /** When this entry was created (UTC, stored as ISO 8601) */
  created_at: ISOTimestamp;

  /**
   * When this entry was compressed into a summary.
   * - null = still in active history
   * - timestamp = summarized, can be excluded from history queries
   */
  summarized_at: ISOTimestamp | null;

  /** Link to the cycle that created this entry */
  cycle_id: CycleId | null;

  /**
   * Entity's internal state at entry time.
   * Format: "A7 C6 N10 E8 D7" (meters)
   * Added in v23.
   */
  meter_snapshot: string | null;

  /**
   * Optional JSON blob for entry provenance — e.g. {"from":"Delphi"} for
   * visitor-signed user_message rows.
   */
  metadata?: string | null;
}
