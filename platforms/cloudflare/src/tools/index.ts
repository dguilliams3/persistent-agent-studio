/**
 * Tool registry barrel exports
 *
 * @module tools
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  FOR LLM CODING AGENTS: Import from packages, not this file  ⚠️       ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  TOOL DEFINITIONS: import { ... } from '@persistence/tools';              ║
 * ║    - TOOL_DEFINITIONS (canonical registry)                                ║
 * ║    - getToolDefinition, listToolDefinitions                               ║
 * ║    - validateAction, isValidAction                                        ║
 * ║                                                                           ║
 * ║  This directory only contains:                                            ║
 * ║    - prompt.js: Platform-specific prompt rendering                        ║
 * ║    - actions/: Platform-specific action handlers (with env bindings)      ║
 * ║    - handler-registry.js: Routes to package handlers                      ║
 * ║    - post-processors.js: Platform-specific post-processing                ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * @upstream Called by:
 *   - prompts/build-system-prompt.js
 * @downstream Calls:
 *   - tools/prompt.js (platform-specific prompt rendering)
 */

// Platform-specific prompt rendering (not in package - stays here)
export { renderToolPromptBlocks } from './prompt.js';

// ============================================================================
// DELETED FILES (2026-01-28)
// ============================================================================
//
// ❌ DELETED: registry.js - Was just an alias for @persistence/tools
//    → TOOL_REGISTRY was never imported by any code
//    → Use TOOL_DEFINITIONS from '@persistence/tools' directly
//
// ❌ REMOVED: getToolDefinition, listToolDefinitions exports
//    → Import from '@persistence/tools' directly
//
