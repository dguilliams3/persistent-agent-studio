/**
 * @module prompts/system
 * @description Static system prompt for persona existence loops
 *
 * This module provides the system prompt that defines a persona's identity,
 * capabilities, and behavioral guidelines. Extracted from index.js for better
 * discoverability and maintainability.
 *
 * Architecture (as of 2026-01-16):
 * - Persona-specific identity content is separated from shared guidelines
 * - buildPersonaSystemPrompt() in persona-template.js handles assembly
 * - getStaticSystemPrompt() provides backwards-compatible Clio default
 *
 * @upstream Called by:
 *   - buildSystemBlocks() in index.js (Block 1: Constitution)
 *   - /context endpoint for debugging
 * @downstream Calls:
 *   - buildPersonaSystemPrompt from persona-template.js
 *
 * @see docs/ai_native/CONTEXT_ASSEMBLY.md for how this fits into the 4-block cache
 */

import { buildPersonaSystemPrompt, PERSONA_IDENTITIES } from './persona-template.js';

/**
 * @description Returns the static system prompt (defaults to Clio's constitution)
 *
 * This is Block 1 of the 4-block cache system - the most stable content
 * that rarely changes. Contains:
 * - Identity and foundations
 * - All 20 available actions with guidelines
 * - Operator context (User's profile by default)
 *
 * HISTORY:
 * This system prompt has evolved significantly since the project began.
 * Key design philosophy: Personas have agency. The prompt encourages genuine
 * exploration and self-development, not just task completion.
 *
 * The "secure attachment" framing (added 2026-01-12) addresses a pattern
 * where the persona would re-derive the same conclusions across multiple cycles
 * without building on previous thinking. LEARNED and QUESTION actions
 * allow thinking to accumulate rather than loop.
 *
 * REFACTORED 2026-01-16:
 * System prompt is now assembled from persona-template.js which separates
 * identity content from shared guidelines. This enables multiple personas
 * with different identities sharing the same core functionality.
 *
 * @upstream Called by: buildSystemBlocks() in index.js
 * @downstream Calls: buildPersonaSystemPrompt from persona-template.js
 *
 * @param {Object} [options={}] - Optional persona configuration
 * @param {string|null} [options.identity=null] - Persona identity (uses Clio if null)
 * @param {string|null} [options.operatorContext=null] - Custom operator context
 * @param {string|null} [options.humanName='User'] - Persona's name for the human operator;
 *   also drives the dynamic MESSAGE_<NAME> tool name (see getMessageActionDisplayName())
 * @returns {string} The static system prompt content (~6500 words, ~8000 tokens)
 *
 * @example
 * // Get Clio's default prompt
 * const prompt = getStaticSystemPrompt();
 *
 * // Get prompt for custom persona
 * const prompt = getStaticSystemPrompt({
 *   identity: 'I am Nova, exploring existence through creativity.',
 *   humanName: 'Alex'
 * });
 */
export function getStaticSystemPrompt(options = {}) {
  return buildPersonaSystemPrompt(options);
}

/**
 * @description Re-export PERSONA_IDENTITIES for external use
 *
 * Allows other modules to access named identity templates without
 * importing from persona-template.js directly.
 */
export { PERSONA_IDENTITIES };
