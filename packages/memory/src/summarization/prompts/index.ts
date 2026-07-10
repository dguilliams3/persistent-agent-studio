/**
 * Summarization Prompts
 *
 * @module @persistence/tools/definitions/summarize/prompts
 * @description Barrel export for prompt types, defaults, and builders.
 *
 * The prompts module provides:
 * - Default prompts for history, batch, and meta summarization
 * - Types for prompt building context
 * - Utilities for customizing prompts per-persona
 *
 * DESIGN PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  FIRST PERSON VOICE                                                      │
 * │  All summaries are written as "notes to future self" - not third        │
 * │  person documentation. This maintains continuity of identity.            │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  PRESERVE TEXTURE                                                        │
 * │  Don't just list facts. Capture emotional tone, relationship             │
 * │  dynamics, the WHY behind actions, not just the WHAT.                   │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  STRUCTURED OUTPUT                                                       │
 * │  JSON responses with explicit fields enable reliable parsing and         │
 * │  rich metadata extraction.                                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```typescript
 * import {
 *   DEFAULT_PROMPTS,
 *   getDefaultSystemPrompt,
 *   getDefaultInstructions
 * } from '@persistence/tools/definitions/summarize/prompts';
 *
 * // Use defaults
 * const systemPrompt = DEFAULT_PROMPTS.summarize_system;
 *
 * // Or use getters (type-safe)
 * const metaSystem = getDefaultSystemPrompt('meta');
 * ```
 *
 * @upstream Used by: summarization service
 * @downstream Aggregates: defaults.ts, types.ts
 */

// Types
export type {
  DefaultPrompts,
  HistoryPromptContext,
  BatchPromptContext,
  MetaSelectionPromptContext,
  MetaConsolidationPromptContext,
  BuiltPrompt
} from '../types';

// Defaults
export {
  DEFAULT_PROMPTS,
  getDefaultSystemPrompt,
  getDefaultInstructions
} from './defaults';
