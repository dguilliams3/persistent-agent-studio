/**
 * Type-Safe Tool Registry
 *
 * @module @persistence/tools/typed-registry
 * @description Provides compile-time type safety for action execution.
 *
 * PATTERN: The tool definitions themselves ARE the registry.
 * TypeScript infers param types from handler signatures.
 *
 * @example
 * import { execute, TOOLS, ActionName } from '@persistence/tools';
 *
 * // Type-safe execution - IDE autocompletes, compiler checks params
 * await execute('MESSAGE_USER', { content: 'Hello!' }, ctx);
 *
 * // Compile error: Property 'content' is missing
 * await execute('MESSAGE_USER', {}, ctx);
 *
 * // Compile error: 'INVALID' is not assignable to ActionName
 * await execute('INVALID', {}, ctx);
 *
 * @upstream Called by:
 *   - Platform runtime (action execution)
 *   - Response parser (type-safe dispatch)
 *
 * @downstream Calls:
 *   - Individual tool handlers via TOOLS[action].handler()
 */

import type { ToolContext, ToolResult } from './types';

// Import all tool definitions
import { MESSAGE_USER } from './definitions/message-user';
import { THINK } from './definitions/think';
import { WONDER } from './definitions/wonder';
import { REMEMBER } from './definitions/remember';
import { COLD_STORAGE } from './definitions/cold-storage';
import { SEARCH } from './definitions/search';
import { ART } from './definitions/art';
import { NOTE } from './definitions/note';
import { OBSERVATION } from './definitions/observation';
import { SUMMARIZE } from './definitions/summarize';
import { REMINDER } from './definitions/reminder';
import { SET_STATUS } from './definitions/set-status';
import { SET_PROFILE_PIC } from './definitions/set-profile-pic';
import { SLEEP } from './definitions/sleep';
import { EXIST } from './definitions/exist';
import { SET_USER_STATUS } from './definitions/set-user-status';
import { SET_STATE } from './definitions/set-state';
import { LEARNED } from './definitions/learned';
import { QUESTION } from './definitions/question';
import { DIGEST } from './definitions/digest';

/**
 * The typed tool registry.
 *
 * `as const` preserves literal types, allowing TypeScript to infer
 * the exact action names and their corresponding handler signatures.
 */
export const TOOLS = {
  MESSAGE_USER,
  THINK,
  WONDER,
  REMEMBER,
  COLD_STORAGE,
  SEARCH,
  ART,
  NOTE,
  OBSERVATION,
  SUMMARIZE,
  REMINDER,
  SET_STATUS,
  SET_PROFILE_PIC,
  SLEEP,
  EXIST,
  SET_USER_STATUS,
  SET_STATE,
  LEARNED,
  QUESTION,
  DIGEST,
} as const;

/**
 * Union type of all valid action names.
 * Derived from TOOLS object keys.
 */
export type ActionName = keyof typeof TOOLS;

/**
 * Array of all action names (for runtime iteration).
 */
export const ACTION_NAMES = Object.keys(TOOLS) as ActionName[];

/**
 * Type helper: Extract the params type for a given action.
 *
 * @example
 * type MessageParams = ActionParams<'MESSAGE_USER'>;
 * // { content: string; internal?: string; shareToUser?: boolean; voice?: boolean }
 */
export type ActionParams<T extends ActionName> = Parameters<typeof TOOLS[T]['handler']>[0];

/**
 * Execute an action with full type safety.
 *
 * TypeScript will:
 * - Validate `action` is a valid ActionName
 * - Validate `params` matches the handler's expected params
 * - Infer return type (ToolResult)
 *
 * @param action - The action name (e.g., 'MESSAGE_USER')
 * @param params - The action parameters (type-checked against handler signature)
 * @param ctx - The tool context (db, cycleId, persona, env)
 * @returns Promise<ToolResult>
 *
 * @example
 * // Fully type-checked
 * const result = await execute('MESSAGE_USER', { content: 'Hello!' }, ctx);
 *
 * // Compile error: 'content' is required
 * await execute('MESSAGE_USER', {}, ctx);
 */
export async function execute<T extends ActionName>(
  action: T,
  params: ActionParams<T>,
  ctx: ToolContext
): Promise<ToolResult> {
  const tool = TOOLS[action];
  // TypeScript knows params matches the handler's expected type.
  // The `as any` cast is safe because we've already validated
  // the types at the function boundary. This is needed because TypeScript
  // can't narrow indexed access types in generic contexts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tool.handler(params as any, ctx);
}

/**
 * Check if a string is a valid action name.
 *
 * This is a type guard that narrows string to ActionName.
 *
 * @param name - The string to check
 * @returns True if name is a valid ActionName
 *
 * @example
 * const userInput = 'MESSAGE_USER';
 * if (isValidAction(userInput)) {
 *   // userInput is now typed as ActionName
 *   await execute(userInput, params, ctx);
 * }
 */
export function isValidAction(name: string): name is ActionName {
  return name in TOOLS;
}

/**
 * Get a tool definition by name (type-safe).
 *
 * @param name - The action name
 * @returns The tool definition with preserved type info
 */
export function getTool<T extends ActionName>(name: T): typeof TOOLS[T] {
  return TOOLS[name];
}
