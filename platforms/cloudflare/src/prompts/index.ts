/**
 * @module prompts
 * @description Prompt templates for the Claude Existence Loop worker
 *
 * This module contains the system prompts and templates used by personas.
 * Extracted from index.js for better discoverability and maintainability.
 *
 * Contents:
 * - system.js: Main export with getStaticSystemPrompt()
 * - persona-template.js: Persona-specific identity templates and builder
 * - build-system-prompt.js: Full context assembly for cycles + /context
 *
 * Architecture (as of 2026-01-16):
 * - PERSONA_IDENTITIES: Named identity strings (clio, default)
 * - buildPersonaSystemPrompt(): Assembles identity + shared guidelines + operator
 * - getStaticSystemPrompt(): Backwards-compatible default (Clio)
 *
 * @upstream Called by: cycle-adapter (buildSystemPrompt callback), route handlers
 * @downstream Calls: context.js (MY_CONTEXT), constants.js (config values)
 *
 * @example
 * // Get default Clio prompt
 * import { getStaticSystemPrompt } from './prompts';
 * const block1 = getStaticSystemPrompt();
 *
 * // Get custom persona prompt
 * import { getStaticSystemPrompt, PERSONA_IDENTITIES } from './prompts';
 * const block1 = getStaticSystemPrompt({ identity: 'custom identity text' });
 */

export { getStaticSystemPrompt, PERSONA_IDENTITIES } from './system.js';
export { buildPersonaSystemPrompt, resolveIdentity, getDefaultIdentity } from './persona-template.js';
export { buildSystemPrompt } from './build-system-prompt.js';
