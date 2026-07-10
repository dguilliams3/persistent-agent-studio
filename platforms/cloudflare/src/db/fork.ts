/**
 * Persona forking operations (Platform Re-export)
 *
 * @module db/fork
 * @description Re-exports persona forking from @persistence/db.
 *
 * MIGRATION NOTE: Implementation moved to packages/db/src/personas.ts (2026-01-28)
 *
 * Uses "Smart Copy" strategy:
 * - Copies: history, cold_storage, notebook, learned, questions, glossary,
 *           observations, summaries, reminders, pinned_images, state (partial)
 * - Skips: voice_history, cycles, pending_batches, voice_transcriptions, pending_view_images
 *          (large/transient data that doesn't define the persona's identity)
 *
 * @upstream Called by:
 *   - routes/personas.js handleForkPersona()
 *   - telegram/commands/persona.js handlePersonaFork()
 * @downstream Calls:
 *   - @persistence/db/personas.ts forkPersona()
 */

// Use workspace package - relative paths don't resolve correctly with wrangler bundling
export { forkPersona } from '@persistence/db';
