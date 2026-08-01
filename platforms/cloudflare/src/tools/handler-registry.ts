/**
 * Handler Registry - Package Handler Wiring
 *
 * @module tools/handler-registry
 * @description Auto-wires all package tool handlers. Just add a tool to
 * @persistence/tools and it's automatically available here.
 *
 * @upstream Called by: executeTool() in action-executor.js
 * @downstream Calls: Package handlers from @persistence/tools
 */

import { getActivePersonaId, getPersona } from '../db/index.js';
import { TOOLS, type ToolContext, type ToolHandler } from '@persistence/tools';
import type { Env } from '../bootstrap.js';

type ToolAction = { action: string; [key: string]: unknown };
type PlatformContext = { db: D1Database; env: Env; action: ToolAction; cycleId: number };
type PackageHandler = ToolHandler;

/**
 * Auto-generated registry from package TOOLS.
 * No manual registration needed - just add tools to the package.
 */
const PACKAGE_HANDLER_REGISTRY = Object.fromEntries(
  Object.entries(TOOLS).map(([name, tool]) => [name, tool.handler])
) as Record<string, PackageHandler>;

/**
 * Execute a package handler if one exists for the given action.
 *
 * @param {Object} platformCtx - Platform execution context
 * @param {D1Database} platformCtx.db - Database binding
 * @param {Object} platformCtx.env - Environment bindings
 * @param {Object} platformCtx.action - Action object with name and params
 * @param {number} platformCtx.cycleId - Current cycle ID
 * @returns {Promise<Object|null>} - ToolResult if handled, null if no package handler
 */
export async function executePackageHandler(platformCtx: PlatformContext): Promise<unknown | null> {
  const { db, env, action, cycleId } = platformCtx;
  const actionName = action.action;

  const handler = PACKAGE_HANDLER_REGISTRY[actionName];
  if (!handler) {
    return null; // No package handler - fall back to platform handler
  }

  // Extract params from action object (remove the 'action' key itself)
  const { action: _, ...params } = action;

  // Build package handler context
  const activePersonaId = await getActivePersonaId(db);
  const activePersona = await getPersona(db, activePersonaId);
  const toolCtx: ToolContext = {
    db,
    env,
    cycleId,
    persona: {
      id: activePersona?.id ?? activePersonaId,
      name: activePersona?.name ?? 'Unknown Persona',
      slug: activePersona?.slug ?? 'unknown-persona'
    }
  };

  // Execute package handler
  const result = await handler(params, toolCtx);

  return result;
}

/**
 * Check if an action has a package handler available.
 */
export function hasPackageHandler(actionName: string): boolean {
  return actionName in PACKAGE_HANDLER_REGISTRY;
}

/**
 * Get list of actions with package handlers.
 */
export function getWiredActions(): string[] {
  return Object.keys(PACKAGE_HANDLER_REGISTRY);
}
