/**
 * STT Glossary (Platform Re-export)
 *
 * @module db/glossary
 * @description Re-exports glossary functions from @persistence/db package.
 *
 * MIGRATION NOTE (2026-01-30):
 * Implementation consolidated from @persistence/voice into @persistence/db/voice.
 * This file now serves as a re-export barrel for backward compatibility.
 *
 * @upstream Called by: routes/glossary.js, telegram/commands/glossary.js, telegram/commands/voice.js
 * @downstream Re-exports from @persistence/db/voice
 */

// Use workspace package - relative paths don't resolve correctly with wrangler bundling
export {
  // CRUD operations
  addGlossaryEntry,
  getGlossaryEntries,
  getGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  // Pure functions (for testing/caching - new in package)
  applyGlossaryCorrections,
  buildGlossaryPrompt,
  // Convenience functions (DB fetch + apply)
  applyGlossary,
  getGlossaryPrompt,
} from '@persistence/db';
