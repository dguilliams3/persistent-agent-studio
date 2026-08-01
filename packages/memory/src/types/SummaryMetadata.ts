/**
 * Rich metadata extracted during summarization.
 * All fields optional — LLM may not provide all of them.
 */
export interface SummaryMetadata {
  /** Named entities mentioned (people, places, concepts) */
  entity_tags: string[];

  /** Key facts worth preserving */
  key_facts: string[];

  /** Themes/topics covered */
  themes: string[];

  /** Emotional tone of the period */
  emotional_tone: string | null;

  /** Human-readable period label */
  time_period_label: string | null;
}

/**
 * Default metadata when none provided.
 */
export const DEFAULT_METADATA: SummaryMetadata = {
  entity_tags: [],
  key_facts: [],
  themes: [],
  emotional_tone: null,
  time_period_label: null
};
