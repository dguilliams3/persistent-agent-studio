/**
 * Summary row mappers (local copy to avoid circular dependency)
 *
 * @module @persistence/db/summaries/mappers
 * @description Local copy of mappers to avoid circular dependency with @persistence/memory.
 *
 * NOTE: This duplicates code from @persistence/memory/src/mappers.ts but is necessary
 * because db needs these at module load time, and memory depends on db.
 *
 * @upstream Called by: retrieval.ts, crud.ts
 */

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL TYPE DEFINITIONS (to avoid importing from memory)
// ═══════════════════════════════════════════════════════════════════════════

/** Branded ID types for type safety */
type SummaryId = number & { readonly __brand: 'SummaryId' };
type PersonaId = number & { readonly __brand: 'PersonaId' };
type ISOTimestamp = string & { readonly __brand: 'ISOTimestamp' };

/** Summary tiers - matches BLOCK constants */
export type SummaryTier = 2 | 3 | 4 | 'archived';

/** Source types for summaries */
type SummarySourceType = 'history' | 'summary';

/** Metadata for summaries */
export interface SummaryMetadata {
  entity_tags: string[];
  key_facts: string[];
  themes: string[];
  emotional_tone: string | null;
  time_period_label: string | null;
}

/**
 * Raw summary row as returned by D1.
 */
export interface SummaryRow {
  id: number;
  persona_id: number;
  summary: string;
  message_count: number;
  covered_range: string;
  covered_start: string | null;
  covered_end: string | null;
  source_type: string | null;
  source_ids: string | null;
  tier: string;
  tier_position: number | null;
  created_at: string;
  archived_at: string | null;
  replaced_by_id: number | null;
  embedding: ArrayBuffer | null;
  embedding_model: string | null;
  metadata: string | null;
}

/**
 * Domain type for summaries.
 */
export interface Summary {
  id: SummaryId;
  persona_id: PersonaId;
  summary: string;
  message_count: number;
  covered_range: string;
  covered_start: ISOTimestamp;
  covered_end: ISOTimestamp | null;
  source_type: SummarySourceType;
  source_ids: number[];
  tier: SummaryTier;
  tier_position: number;
  created_at: ISOTimestamp;
  archived_at: ISOTimestamp | null;
  replaced_by_id: SummaryId | null;
  embedding: ArrayBuffer | null;
  embedding_model: string | null;
  metadata: SummaryMetadata | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function parseSourceIds(json: string | null): number[] {
  if (json === null || json === undefined) return [];

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      console.warn(`[mappers] source_ids is not an array: ${json}`);
      return [];
    }
    return parsed.filter((id) => typeof id === 'number');
  } catch (error) {
    console.warn(`[mappers] Failed to parse source_ids: ${json}`, error);
    return [];
  }
}

function parseMetadata(json: string | null): SummaryMetadata | null {
  if (json === null || json === undefined) return null;

  try {
    const parsed = JSON.parse(json);
    if (Object.keys(parsed).length === 0) return null;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn(`[mappers] metadata is not an object: ${json}`);
      return null;
    }
    return {
      entity_tags: Array.isArray(parsed.entity_tags) ? parsed.entity_tags : [],
      key_facts: Array.isArray(parsed.key_facts) ? parsed.key_facts : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      emotional_tone: parsed.emotional_tone ?? null,
      time_period_label: parsed.time_period_label ?? null,
    };
  } catch (error) {
    console.warn(`[mappers] Failed to parse metadata: ${json}`, error);
    return null;
  }
}

function normalizeTier(tier: string | null): SummaryTier {
  if (tier === null) return 4;
  if (tier === '2') return 2;
  if (tier === '3') return 3;
  if (tier === '4') return 4;
  if (tier === 'archived') return 'archived';
  if (tier === 'promoted') return 2;
  if (tier === 'cached') return 3;
  if (tier === 'tail' || tier === 'buffer') return 4;
  console.warn(`[mappers] Invalid tier value: ${tier}, defaulting to 4`);
  return 4;
}

function normalizeSourceType(sourceType: string | null): SummarySourceType {
  if (sourceType === null) return 'history';
  const validTypes: SummarySourceType[] = ['history', 'summary'];
  if (validTypes.includes(sourceType as SummarySourceType)) {
    return sourceType as SummarySourceType;
  }
  console.warn(`[mappers] Invalid source_type: ${sourceType}, defaulting to 'history'`);
  return 'history';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MAPPER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert database row to Summary domain type
 */
export function rowToSummary(row: SummaryRow): Summary {
  return {
    id: row.id as SummaryId,
    persona_id: row.persona_id as PersonaId,
    summary: row.summary,
    message_count: row.message_count,
    covered_range: row.covered_range,
    covered_start: row.covered_start as ISOTimestamp,
    covered_end: row.covered_end as ISOTimestamp | null,
    source_type: normalizeSourceType(row.source_type),
    source_ids: parseSourceIds(row.source_ids),
    tier: normalizeTier(row.tier),
    tier_position: row.tier_position ?? 0,
    created_at: row.created_at as ISOTimestamp,
    archived_at: row.archived_at as ISOTimestamp | null,
    replaced_by_id: row.replaced_by_id as SummaryId | null,
    embedding: row.embedding,
    embedding_model: row.embedding_model,
    metadata: parseMetadata(row.metadata),
  };
}
