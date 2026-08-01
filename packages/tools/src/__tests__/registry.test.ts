/**
 * @module @persistence/tools/__tests__/registry.test
 * @description Unit tests for tool registry module
 *
 * Tests cover:
 * - TOOL_DEFINITIONS existence and structure
 * - getToolDefinition() lookup by ID
 * - getToolsByCategory() filtering
 * - getToolIds() and listToolIds()
 * - listToolDefinitions()
 * - isValidActionName() checking
 * - sanitizeHumanNameToken() / getMessageActionDisplayName() dynamic tool naming
 *
 * @covers ../registry.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TOOL_DEFINITIONS,
  getToolDefinition,
  getToolsByCategory,
  getToolIds,
  listToolDefinitions,
  listToolIds,
  isValidActionName,
  sanitizeHumanNameToken,
  getMessageActionDisplayName,
} from '../registry';
import type { ActionCategory, ToolDefinition } from '../types';

// ============================================================================
// TOOL_DEFINITIONS
// ============================================================================

describe('TOOL_DEFINITIONS', () => {
  it('exports a non-empty object of tool definitions', () => {
    expect(TOOL_DEFINITIONS).toBeDefined();
    expect(typeof TOOL_DEFINITIONS).toBe('object');
    expect(Object.keys(TOOL_DEFINITIONS).length).toBeGreaterThan(0);
  });

  it('contains all expected tool IDs', () => {
    const expectedTools = [
      'MESSAGE_USER',
      'THINK',
      'WONDER',
      'REMEMBER',
      'COLD_STORAGE',
      'SEARCH',
      'ART',
      'NOTE',
      'OBSERVATION',
      'SUMMARIZE',
      'REMINDER',
      'SET_STATUS',
      'SET_PROFILE_PIC',
      'SLEEP',
      'EXIST',
      'SET_USER_STATUS',
      'SET_STATE',
      'LEARNED',
      'QUESTION',
    ];

    for (const toolId of expectedTools) {
      expect(TOOL_DEFINITIONS[toolId]).toBeDefined();
    }
  });

  it('each definition has required ToolDefinition fields', () => {
    for (const [id, def] of Object.entries(TOOL_DEFINITIONS)) {
      expect(def.id).toBe(id);
      expect(typeof def.category).toBe('string');
      expect(def.schema).toBeDefined();
      expect(def.prompt).toBeDefined();
      expect(def.help).toBeDefined();
    }
  });

  describe('schema structure validation', () => {
    it('each schema has required array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.schema.required)).toBe(true);
      }
    });

    it('each schema has optional array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.schema.optional)).toBe(true);
      }
    });

    it('each schema has aliases object', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.schema.aliases).toBe('object');
      }
    });

    it('each schema has types object', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.schema.types).toBe('object');
      }
    });

    it('each schema has formatHint string', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.schema.formatHint).toBe('string');
      }
    });

    it('each schema has example string', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.schema.example).toBe('string');
      }
    });

    it('each schema has defaults object', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.schema.defaults).toBe('object');
      }
    });
  });

  describe('prompt structure validation', () => {
    it('each prompt has summary string', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.prompt.summary).toBe('string');
      }
    });

    it('each prompt has usage string', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.prompt.usage).toBe('string');
      }
    });

    it('each prompt has examples array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.prompt.examples)).toBe(true);
      }
    });

    it('each prompt has warnings array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.prompt.warnings)).toBe(true);
      }
    });
  });

  describe('help structure validation', () => {
    it('each help has short string', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.help.short).toBe('string');
      }
    });

    it('each help has description string', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(typeof def.help.description).toBe('string');
      }
    });

    it('each help has failureModes array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.help.failureModes)).toBe(true);
      }
    });

    it('each help has notFor array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.help.notFor)).toBe(true);
      }
    });

    it('each help has hints array', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(Array.isArray(def.help.hints)).toBe(true);
      }
    });
  });
});

// ============================================================================
// getToolDefinition()
// ============================================================================

describe('getToolDefinition', () => {
  it('returns definition for valid tool ID', () => {
    const def = getToolDefinition('THINK');
    expect(def).toBeDefined();
    expect(def?.id).toBe('THINK');
    expect(def?.category).toBe('reflection');
  });

  it('returns undefined for unknown tool ID', () => {
    const def = getToolDefinition('NONEXISTENT_TOOL');
    expect(def).toBeUndefined();
  });

  it('is case-sensitive', () => {
    const defLower = getToolDefinition('think');
    const defUpper = getToolDefinition('THINK');
    expect(defLower).toBeUndefined();
    expect(defUpper).toBeDefined();
  });

  it('returns MESSAGE_USER definition', () => {
    const def = getToolDefinition('MESSAGE_USER');
    expect(def?.id).toBe('MESSAGE_USER');
    expect(def?.category).toBe('communication');
    expect(def?.schema.required).toContain('content');
  });

  it('returns ART definition with conditional required', () => {
    const def = getToolDefinition('ART');
    expect(def?.id).toBe('ART');
    expect(def?.schema.conditionalRequired).toBeDefined();
  });
});

// ============================================================================
// getToolsByCategory()
// ============================================================================

describe('getToolsByCategory', () => {
  it('returns tools in "communication" category', () => {
    const tools = getToolsByCategory('communication');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every(t => t.category === 'communication')).toBe(true);
    expect(tools.some(t => t.id === 'MESSAGE_USER')).toBe(true);
  });

  it('returns tools in "reflection" category', () => {
    const tools = getToolsByCategory('reflection');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every(t => t.category === 'reflection')).toBe(true);
    expect(tools.some(t => t.id === 'THINK')).toBe(true);
    expect(tools.some(t => t.id === 'WONDER')).toBe(true);
  });

  it('returns tools in "memory" category', () => {
    const tools = getToolsByCategory('memory');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every(t => t.category === 'memory')).toBe(true);
  });

  it('returns tools in "research" category', () => {
    const tools = getToolsByCategory('research');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every(t => t.category === 'research')).toBe(true);
  });

  it('returns tools in "creative" category', () => {
    const tools = getToolsByCategory('creative');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every(t => t.category === 'creative')).toBe(true);
    expect(tools.some(t => t.id === 'ART')).toBe(true);
  });

  it('returns tools in "self" category', () => {
    const tools = getToolsByCategory('self');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every(t => t.category === 'self')).toBe(true);
  });

  it('returns empty array for unknown category', () => {
    const tools = getToolsByCategory('unknown' as ActionCategory);
    expect(tools).toEqual([]);
  });
});

// ============================================================================
// getToolIds() and listToolIds()
// ============================================================================

describe('getToolIds', () => {
  it('returns array of tool IDs', () => {
    const ids = getToolIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('includes expected tool IDs', () => {
    const ids = getToolIds();
    expect(ids).toContain('THINK');
    expect(ids).toContain('MESSAGE_USER');
    expect(ids).toContain('COLD_STORAGE');
  });

  it('matches keys of TOOL_DEFINITIONS', () => {
    const ids = getToolIds();
    const keys = Object.keys(TOOL_DEFINITIONS);
    expect(ids.sort()).toEqual(keys.sort());
  });
});

describe('listToolIds', () => {
  it('returns sorted array of tool IDs', () => {
    const ids = listToolIds();
    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
  });

  it('contains same IDs as getToolIds', () => {
    const listIds = listToolIds();
    const getIds = getToolIds();
    expect(listIds.sort()).toEqual(getIds.sort());
  });
});

// ============================================================================
// listToolDefinitions()
// ============================================================================

describe('listToolDefinitions', () => {
  it('returns array of tool definitions', () => {
    const defs = listToolDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
  });

  it('each element is a valid ToolDefinition', () => {
    const defs = listToolDefinitions();
    for (const def of defs) {
      expect(def.id).toBeDefined();
      expect(def.category).toBeDefined();
      expect(def.schema).toBeDefined();
      expect(def.prompt).toBeDefined();
      expect(def.help).toBeDefined();
    }
  });

  it('matches values of TOOL_DEFINITIONS', () => {
    const defs = listToolDefinitions();
    const values = Object.values(TOOL_DEFINITIONS);
    expect(defs.length).toBe(values.length);
    for (const def of defs) {
      expect(values).toContainEqual(def);
    }
  });
});

// ============================================================================
// isValidActionName()
// ============================================================================

describe('isValidActionName', () => {
  describe('valid action names', () => {
    it('returns true for THINK', () => {
      expect(isValidActionName('THINK')).toBe(true);
    });

    it('returns true for MESSAGE_USER', () => {
      expect(isValidActionName('MESSAGE_USER')).toBe(true);
    });

    it('returns true for COLD_STORAGE', () => {
      expect(isValidActionName('COLD_STORAGE')).toBe(true);
    });

    it('returns true for all registered tools', () => {
      for (const id of Object.keys(TOOL_DEFINITIONS)) {
        expect(isValidActionName(id)).toBe(true);
      }
    });
  });

  describe('invalid action names', () => {
    it('returns false for unknown action', () => {
      expect(isValidActionName('UNKNOWN_ACTION')).toBe(false);
    });

    it('returns false for lowercase version', () => {
      expect(isValidActionName('think')).toBe(false);
    });

    it('returns false for partial name', () => {
      expect(isValidActionName('MESSAGE')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidActionName('')).toBe(false);
    });

    it('returns false for prototype properties', () => {
      // Should not match Object prototype methods
      expect(isValidActionName('toString')).toBe(false);
      expect(isValidActionName('hasOwnProperty')).toBe(false);
      expect(isValidActionName('constructor')).toBe(false);
    });
  });
});

// ============================================================================
// Dynamic MESSAGE_<NAME> tool naming (humanName-driven)
// ============================================================================

describe('sanitizeHumanNameToken', () => {
  it('uppercases a simple name', () => {
    expect(sanitizeHumanNameToken('Alex')).toBe('ALEX');
  });

  it('defaults to USER for undefined/null/empty input', () => {
    expect(sanitizeHumanNameToken(undefined)).toBe('USER');
    expect(sanitizeHumanNameToken(null)).toBe('USER');
    expect(sanitizeHumanNameToken('')).toBe('USER');
  });

  it('collapses unsafe characters to underscores and trims edges', () => {
    expect(sanitizeHumanNameToken('Dr. Jane')).toBe('DR_JANE');
    expect(sanitizeHumanNameToken("O'Brien")).toBe('O_BRIEN');
    expect(sanitizeHumanNameToken('  Alex  ')).toBe('ALEX');
  });

  it('falls back to USER when sanitizing yields nothing usable', () => {
    expect(sanitizeHumanNameToken('!!!')).toBe('USER');
  });
});

describe('getMessageActionDisplayName', () => {
  it('builds the dynamic MESSAGE_<NAME> action name from humanName', () => {
    // PROOF: humanName "Alex" -> displayed tool name is MESSAGE_ALEX
    expect(getMessageActionDisplayName('Alex')).toBe('MESSAGE_ALEX');
  });

  it('defaults to MESSAGE_USER when humanName is not provided', () => {
    expect(getMessageActionDisplayName()).toBe('MESSAGE_USER');
    expect(getMessageActionDisplayName(null)).toBe('MESSAGE_USER');
    expect(getMessageActionDisplayName('User')).toBe('MESSAGE_USER');
  });
});
