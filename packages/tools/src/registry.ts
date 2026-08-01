/**
 * Unified Tool Registry
 *
 * @module @persistence/tools/registry
 * @description Collects and exposes tool definitions, schemas, and helpers.
 *
 * NOTE: For type-safe action execution, use typed-registry.ts instead.
 * This file provides backward compatibility and helper functions for
 * validation, help text, and discovery.
 *
 * @upstream Called by:
 *   - Response parser (validation)
 *   - Prompt builder (system prompt injection)
 *   - Action executor (pre-execution validation)
 *   - UI/Telegram help surfaces
 *
 * @downstream Calls: None (pure data + validation)
 */

import { TOOLS } from './typed-registry';
import type {
  ActionCategory,
  FieldSchema,
  FieldType,
  ToolDefinition,
  ToolHelpMeta,
  ToolPromptMeta,
  ToolSchema,
  ValidationResult
} from './types';

export type {
  ActionCategory,
  FieldSchema,
  FieldType,
  ToolDefinition,
  ToolHelpMeta,
  ToolPromptMeta,
  ToolSchema,
  ValidationResult
} from './types';

/**
 * Complete registry of all tool definitions.
 *
 * For type-safe execution, use the `execute()` function from typed-registry.
 * This export is maintained for backward compatibility with validation,
 * help text generation, and dynamic lookup by string.
 *
 * Note: We cast to `Record<string, ToolDefinition<any>>` because each tool
 * has its own params type. For type-safe access, use TOOLS from typed-registry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOL_DEFINITIONS: Record<string, ToolDefinition<any>> = TOOLS as Record<string, ToolDefinition<any>>;

/**
 * Lookup a tool definition by ID.
 */
export function getToolDefinition(id: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS[id];
}

/**
 * Get all tools that belong to the given category.
 */
export function getToolsByCategory(category: ActionCategory): ToolDefinition[] {
  return Object.values(TOOL_DEFINITIONS).filter(tool => tool.category === category);
}

/**
 * List all tool IDs currently registered.
 */
export function getToolIds(): string[] {
  return Object.keys(TOOL_DEFINITIONS);
}

/**
 * Legacy helper to list all tool definitions.
 */
export function listToolDefinitions(): ToolDefinition[] {
  return Object.values(TOOL_DEFINITIONS);
}

/**
 * Legacy helper to list tool IDs (sorted for stable display).
 */
export function listToolIds(): string[] {
  return getToolIds().sort();
}

/**
 * Check whether an action ID exists in the registry.
 */
export function isValidActionName(actionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TOOL_DEFINITIONS, actionId);
}

// =============================================================================
// TOOL HELP & INFORMATION FUNCTIONS
// =============================================================================

/**
 * Simplified tool information for display/help surfaces.
 *
 * @description User-friendly representation of a tool containing
 * just the essential information needed for help text and discovery.
 */
export interface ToolInfo {
  /** Tool ID (e.g., "MESSAGE_USER") */
  name: string;
  /** Human-readable category (e.g., "communication") */
  category: ActionCategory;
  /** Brief one-line description */
  description: string;
  /** Parameter definitions if available */
  params?: Array<{
    name: string;
    type: FieldType;
    required: boolean;
    description?: string;
  }>;
  /** Usage examples */
  examples?: string[];
}

/**
 * Get simplified tool information for all registered tools.
 *
 * @description Transforms the full ToolDefinition objects into
 * simplified ToolInfo structures suitable for display in help
 * text, Telegram commands, or UI surfaces.
 *
 * @returns Array of ToolInfo objects sorted by tool name
 *
 * @upstream Called by:
 *   - handleToolsCommand() - Telegram /tools command
 *   - UI help surfaces - Web UI tool reference
 *
 * @downstream Calls:
 *   - getToolDefinition() - Fetches full definition for each tool
 */
export function getToolRegistry(): ToolInfo[] {
  return Object.values(TOOL_DEFINITIONS)
    .map(tool => ({
      name: tool.id,
      category: tool.category,
      description: tool.help.short,
      params: tool.schema.required.concat(tool.schema.optional).map(paramName => ({
        name: paramName,
        type: tool.schema.types[paramName] || 'any',
        required: tool.schema.required.includes(paramName),
        description: undefined // Could be enhanced later with param descriptions
      })),
      examples: tool.prompt.examples
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get simplified information for a specific tool by name.
 *
 * @description Fetches and transforms a single tool's definition
 * into a user-friendly ToolInfo structure.
 *
 * @param {string} name - Tool ID to look up (e.g., "MESSAGE_USER")
 * @returns {ToolInfo | undefined} Tool info or undefined if not found
 *
 * @upstream Called by:
 *   - handleToolsCommand() - Telegram /tools <name> command
 *   - Context builders - When assembling tool-specific help
 *
 * @downstream Calls:
 *   - getToolDefinition() - Fetches the full definition
 */
export function getToolByName(name: string): ToolInfo | undefined {
  const tool = getToolDefinition(name);
  if (!tool) return undefined;

  return {
    name: tool.id,
    category: tool.category,
    description: tool.help.short,
    params: tool.schema.required.concat(tool.schema.optional).map(paramName => ({
      name: paramName,
      type: tool.schema.types[paramName] || 'any',
      required: tool.schema.required.includes(paramName),
      description: undefined
    })),
    examples: tool.prompt.examples
  };
}

/**
 * Generate formatted help text for a specific tool.
 *
 * @description Creates a multi-line help string suitable for
 * display in Telegram or terminal, including description,
 * parameters, and usage examples.
 *
 * @param {string} name - Tool ID to generate help for
 * @returns {string} Formatted help text or error message if tool not found
 *
 * @example
 * const helpText = getToolHelp("MESSAGE_USER");
 * // Returns:
 * // MESSAGE_USER (communication)
 * // Send a message directly to the user.
 * //
 * // Parameters:
 * //   - content (string, required)
 * //   - internal (string, optional)
 * //
 * // Examples:
 * //   MESSAGE_USER — {"content":"Hello!"}
 *
 * @upstream Called by:
 *   - handleToolsCommand() - Telegram /tools <name> command
 *   - CLI help surfaces - Command-line tool reference
 *
 * @downstream Calls:
 *   - getToolByName() - Fetches simplified tool info
 */
export function getToolHelp(name: string): string {
  const tool = getToolByName(name);
  if (!tool) {
    return `Tool "${name}" not found. Use /tools to list all available tools.`;
  }

  const lines: string[] = [];
  lines.push(`${tool.name} (${tool.category})`);
  lines.push(tool.description);
  lines.push('');

  if (tool.params && tool.params.length > 0) {
    lines.push('Parameters:');
    for (const param of tool.params) {
      const requiredStr = param.required ? 'required' : 'optional';
      lines.push(`  - ${param.name} (${param.type}, ${requiredStr})`);
    }
    lines.push('');
  }

  if (tool.examples && tool.examples.length > 0) {
    lines.push('Examples:');
    for (const example of tool.examples) {
      lines.push(`  ${example}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get all tool names sorted alphabetically.
 *
 * @description Returns a sorted list of all registered tool IDs,
 * useful for autocomplete, validation, or listing.
 *
 * @returns {string[]} Sorted array of tool IDs
 *
 * @upstream Called by:
 *   - handleToolsCommand() - Telegram /tools command (list mode)
 *   - Validation functions - Check if action name is valid
 *
 * @downstream Calls: None (pure data access)
 */
export function getToolNames(): string[] {
  return Object.keys(TOOL_DEFINITIONS).sort();
}

// =============================================================================
// DYNAMIC MESSAGE ACTION NAME (humanName-driven tool display)
// =============================================================================

/**
 * Sanitize a human name into a safe uppercase token for LLM-facing tool-name
 * display (letters/digits/underscore only).
 *
 * @description Used to build the dynamic MESSAGE_<NAME> display name. Any
 * character outside [A-Z0-9_] is collapsed to a single underscore, and
 * leading/trailing underscores are trimmed. Falls back to "USER" when the
 * input is empty or sanitizes to nothing (e.g. all-punctuation input).
 *
 * @param humanName - Persona's configured name for the human operator
 * @returns Safe uppercase token, e.g. "Alex" -> "ALEX", "Dr. Jane" -> "DR_JANE"
 *
 * @example
 * sanitizeHumanNameToken('Alex')   // 'ALEX'
 * sanitizeHumanNameToken(undefined) // 'USER'
 * sanitizeHumanNameToken('')        // 'USER'
 */
export function sanitizeHumanNameToken(humanName?: string | null): string {
  const token = (humanName ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || 'USER';
}

/**
 * Returns the LLM-facing display name for the message-to-user action,
 * driven by the persona's configured humanName.
 *
 * @description The internal action name and all storage/routing (execute(),
 * TOOL_DEFINITIONS lookup, history 'type' column) always stay 'MESSAGE_USER'
 * — this only changes what the MODEL SEES as the tool name in the rendered
 * system prompt, so a persona that knows the human's name can address them
 * as a peer instead of a generic "user". The reverse mapping (model emits
 * MESSAGE_<NAME> -> internal MESSAGE_USER action) lives in
 * normalizeAction() in @persistence/services/feedback.
 *
 * @param humanName - Persona's configured name for the human operator (default 'User')
 * @returns Display name, e.g. 'Alex' -> 'MESSAGE_ALEX', undefined -> 'MESSAGE_USER'
 *
 * @example
 * getMessageActionDisplayName('Alex') // 'MESSAGE_ALEX'
 * getMessageActionDisplayName()       // 'MESSAGE_USER'
 */
export function getMessageActionDisplayName(humanName?: string | null): string {
  return `MESSAGE_${sanitizeHumanNameToken(humanName)}`;
}
