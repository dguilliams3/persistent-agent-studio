/**
 * @module @persistence/tools/__tests__/typed-registry.test
 * @description Type safety tests for the typed tool registry
 *
 * Tests cover:
 * - ActionName type inference
 * - ActionParams type extraction
 * - execute() type safety (compile-time)
 * - isValidAction() type guard
 * - getTool() type preservation
 * - Backward compatibility with TOOL_DEFINITIONS
 *
 * IMPORTANT: Many tests here verify compile-time behavior via @ts-expect-error.
 * If a @ts-expect-error line does NOT produce an error, the test will FAIL.
 * This ensures our types are strict enough to catch mistakes.
 *
 * @covers ../typed-registry.ts
 */

import { describe, it, expect, expectTypeOf, beforeAll } from 'vitest';
import {
  execute,
  TOOLS,
  ACTION_NAMES,
  isValidAction,
  getTool,
} from '../typed-registry';
import type { ActionName, ActionParams } from '../typed-registry';
import type { MessageUserParams } from '../definitions/message-user/params';
import type { ThinkParams } from '../definitions/think/params';
import type { ToolContext } from '../types';

// ============================================================================
// TOOLS object
// ============================================================================

describe('TOOLS object', () => {
  it('exports a non-empty object', () => {
    expect(TOOLS).toBeDefined();
    expect(typeof TOOLS).toBe('object');
    expect(Object.keys(TOOLS).length).toBe(20);
  });

  it('contains all 20 tool definitions', () => {
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
      'DIGEST',
    ];

    for (const toolId of expectedTools) {
      expect(TOOLS[toolId as ActionName]).toBeDefined();
    }
  });

  it('preserves individual tool types via "as const"', () => {
    // Verify TOOLS is not widened to Record<string, any>
    // by checking specific tool properties are accessible
    expect(TOOLS.MESSAGE_USER.id).toBe('MESSAGE_USER');
    expect(TOOLS.THINK.category).toBe('reflection');
    expect(TOOLS.ART.schema.conditionalRequired).toBeDefined();
  });
});

// ============================================================================
// ACTION_NAMES array
// ============================================================================

describe('ACTION_NAMES', () => {
  it('contains all action names', () => {
    expect(ACTION_NAMES.length).toBe(20);
    expect(ACTION_NAMES).toContain('MESSAGE_USER');
    expect(ACTION_NAMES).toContain('THINK');
    expect(ACTION_NAMES).toContain('EXIST');
  });

  it('matches keys of TOOLS object', () => {
    const toolKeys = Object.keys(TOOLS);
    expect(ACTION_NAMES.sort()).toEqual(toolKeys.sort());
  });
});

// ============================================================================
// ActionName type
// ============================================================================

describe('ActionName type', () => {
  it('accepts all valid tool names', () => {
    // These should all compile without errors
    const names: ActionName[] = [
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
    expect(names.length).toBe(19);
  });

  it('rejects invalid names at compile time', () => {
    // @ts-expect-error - 'INVALID' is not a valid ActionName
    const invalid: ActionName = 'INVALID';
    // This line exists to use the variable and satisfy eslint
    expect(invalid).toBeDefined();
  });

  it('rejects lowercase names at compile time', () => {
    // @ts-expect-error - 'think' is not 'THINK'
    const lowercase: ActionName = 'think';
    expect(lowercase).toBeDefined();
  });
});

// ============================================================================
// ActionParams type helper
// ============================================================================

describe('ActionParams type', () => {
  it('extracts correct params for MESSAGE_USER', () => {
    type Params = ActionParams<'MESSAGE_USER'>;
    // This test verifies at compile time that Params matches MessageUserParams
    expectTypeOf<Params>().toMatchTypeOf<MessageUserParams>();
  });

  it('extracts correct params for THINK', () => {
    type Params = ActionParams<'THINK'>;
    expectTypeOf<Params>().toMatchTypeOf<ThinkParams>();
  });

  it('extracts content as required string for THINK', () => {
    type Params = ActionParams<'THINK'>;
    // Verify that content is a required string property
    expectTypeOf<Params['content']>().toEqualTypeOf<string>();
  });

  it('allows optional voice parameter for MESSAGE_USER', () => {
    type Params = ActionParams<'MESSAGE_USER'>;
    // voice is optional boolean
    expectTypeOf<Params['voice']>().toEqualTypeOf<boolean | undefined>();
  });
});

// ============================================================================
// execute() function - type safety
// ============================================================================

describe('execute function - type safety', () => {
  // Create a mock context for type checking (won't actually run handlers)
  const mockCtx: ToolContext = {
    db: {},
    cycleId: 'test-123',
    persona: { id: 1, name: 'Test', slug: 'test' },
    env: {},
  };

  it('accepts correct params for MESSAGE_USER', () => {
    // This should compile - content is provided
    const validCall = () => execute('MESSAGE_USER', { content: 'test' }, mockCtx);
    expect(validCall).toBeDefined();
  });

  it('accepts correct params for THINK', () => {
    // This should compile - content is provided
    const validCall = () => execute('THINK', { content: 'thinking...' }, mockCtx);
    expect(validCall).toBeDefined();
  });

  it('accepts optional params for MESSAGE_USER', () => {
    // All optional params should be allowed
    const validCall = () => execute('MESSAGE_USER', {
      content: 'test',
      voice: true,
      shareToUser: false,
      internal: 'reasoning',
    }, mockCtx);
    expect(validCall).toBeDefined();
  });

  it('rejects missing required params at compile time', () => {
    // The function is never called - this only tests type checking
    const _badCall = () => {
      // @ts-expect-error - 'content' is required for MESSAGE_USER
      execute('MESSAGE_USER', {}, mockCtx);
    };
    expect(_badCall).toBeDefined();
  });

  it('rejects missing content for THINK at compile time', () => {
    const _badCall = () => {
      // @ts-expect-error - 'content' is required for THINK
      execute('THINK', {}, mockCtx);
    };
    expect(_badCall).toBeDefined();
  });

  it('rejects wrong param types at compile time', () => {
    const _badCall = () => {
      // @ts-expect-error - content must be string, not number
      execute('MESSAGE_USER', { content: 123 }, mockCtx);
    };
    expect(_badCall).toBeDefined();
  });

  it('rejects invalid action names at compile time', () => {
    const _badCall = () => {
      // @ts-expect-error - 'INVALID' is not a valid action
      execute('INVALID', {}, mockCtx);
    };
    expect(_badCall).toBeDefined();
  });

  it('rejects wrong action name at compile time', () => {
    const _badCall = () => {
      // @ts-expect-error - 'NOT_AN_ACTION' is not a valid ActionName
      execute('NOT_AN_ACTION', { content: 'test' }, mockCtx);
    };
    expect(_badCall).toBeDefined();
  });
});

// ============================================================================
// isValidAction() type guard
// ============================================================================

describe('isValidAction type guard', () => {
  it('returns true for valid action names', () => {
    expect(isValidAction('MESSAGE_USER')).toBe(true);
    expect(isValidAction('THINK')).toBe(true);
    expect(isValidAction('EXIST')).toBe(true);
  });

  it('returns false for invalid action names', () => {
    expect(isValidAction('INVALID')).toBe(false);
    expect(isValidAction('think')).toBe(false);
    expect(isValidAction('')).toBe(false);
    expect(isValidAction('message_to_user')).toBe(false);
  });

  it('narrows string to ActionName in type guard', () => {
    const maybeAction: string = 'MESSAGE_USER';

    if (isValidAction(maybeAction)) {
      // TypeScript now knows maybeAction is ActionName
      expectTypeOf(maybeAction).toEqualTypeOf<ActionName>();
    }
  });

  it('allows type-safe execution after guard', () => {
    const maybeAction: string = 'THINK';

    if (isValidAction(maybeAction)) {
      // After narrowing, we can use it with TOOLS
      const tool = TOOLS[maybeAction];
      expect(tool.id).toBe('THINK');
    }
  });
});

// ============================================================================
// getTool() function
// ============================================================================

describe('getTool function', () => {
  it('returns correctly typed tool for MESSAGE_USER', () => {
    const tool = getTool('MESSAGE_USER');
    expectTypeOf(tool).toEqualTypeOf<typeof TOOLS['MESSAGE_USER']>();
    expect(tool.id).toBe('MESSAGE_USER');
  });

  it('returns correctly typed tool for THINK', () => {
    const tool = getTool('THINK');
    expectTypeOf(tool).toEqualTypeOf<typeof TOOLS['THINK']>();
    expect(tool.id).toBe('THINK');
    expect(tool.category).toBe('reflection');
  });

  it('preserves schema structure', () => {
    const tool = getTool('ART');
    expect(tool.schema.conditionalRequired).toBeDefined();
  });

  it('rejects invalid names at compile time', () => {
    // @ts-expect-error - 'INVALID' is not a valid action name
    getTool('INVALID');
  });
});

// ============================================================================
// Backward compatibility
// ============================================================================

describe('backward compatibility with TOOL_DEFINITIONS', () => {
  // Import the legacy registry using dynamic import
  let TOOL_DEFINITIONS: Record<string, unknown>;

  beforeAll(async () => {
    const registry = await import('../registry');
    TOOL_DEFINITIONS = registry.TOOL_DEFINITIONS;
  });

  it('TOOL_DEFINITIONS contains same tools as TOOLS', () => {
    const toolsKeys = Object.keys(TOOLS).sort();
    const defsKeys = Object.keys(TOOL_DEFINITIONS).sort();
    expect(defsKeys).toEqual(toolsKeys);
  });

  it('TOOL_DEFINITIONS entries match TOOLS entries', () => {
    for (const key of Object.keys(TOOLS)) {
      expect(TOOL_DEFINITIONS[key]).toBe(TOOLS[key as ActionName]);
    }
  });

  it('TOOL_DEFINITIONS is still usable for dynamic lookup', () => {
    const toolId = 'MESSAGE_USER';
    const def = TOOL_DEFINITIONS[toolId];
    expect(def).toBeDefined();
    expect(def.id).toBe('MESSAGE_USER');
    expect(def.category).toBe('communication');
  });
});

// ============================================================================
// Integration: Real handler type extraction
// ============================================================================

describe('handler type extraction', () => {
  it('MESSAGE_USER handler expects MessageUserParams', () => {
    const handler = TOOLS.MESSAGE_USER.handler;
    // Verify handler exists
    expect(handler).toBeDefined();
    // The handler's first parameter should match MessageUserParams
    // Use NonNullable because handler is optional in ToolDefinition type
    type HandlerParams = Parameters<NonNullable<typeof handler>>[0];
    expectTypeOf<HandlerParams>().toMatchTypeOf<MessageUserParams>();
  });

  it('THINK handler expects ThinkParams', () => {
    const handler = TOOLS.THINK.handler;
    expect(handler).toBeDefined();
    type HandlerParams = Parameters<NonNullable<typeof handler>>[0];
    expectTypeOf<HandlerParams>().toMatchTypeOf<ThinkParams>();
  });

  it('all tools have handler property', () => {
    for (const key of ACTION_NAMES) {
      expect(TOOLS[key].handler).toBeDefined();
      expect(typeof TOOLS[key].handler).toBe('function');
    }
  });
});
