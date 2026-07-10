/**
 * Action Validation Module
 *
 * @module @persistence/tools/validation
 * @description Validates action objects against tool schemas.
 *
 * @upstream Called by:
 *   - Response parser (post-parse validation)
 *   - Action executor (pre-execution validation)
 *   - API routes (request validation)
 *
 * @downstream Calls: TOOL_DEFINITIONS from ./registry
 */

import type { ToolDefinition, ValidationResult } from './types';
import { TOOL_DEFINITIONS } from './registry';

/**
 * @description Evaluate a simple condition string against an action object.
 *
 * Supports:
 * - "field === 'value'" - Field equals string (single or double quotes)
 * - "field === number" - Field equals number
 * - "field === true|false" - Field equals boolean
 *
 * @param condition - Condition string like "op === 'make'" or 'op === "set"'
 * @param action - Action object to evaluate against
 * @returns Whether condition is satisfied
 *
 * @note Very basic parser - handles common cases only
 *
 * @example
 * evaluateCondition('op === "make"', { op: 'make' }) // true
 * evaluateCondition("op === 'set'", { op: 'set' }) // true
 * evaluateCondition('count === 5', { count: 5 }) // true
 * evaluateCondition('flag === true', { flag: true }) // true
 */
function evaluateCondition(condition: string, action: Record<string, unknown>): boolean {
  // Parse: "field === value" where value can be quoted string, boolean, or number
  // Use separate capture groups for quoted strings vs unquoted values
  const quotedMatch = condition.match(/^(\w+)\s*===\s*(['"])(.+?)\2$/);
  if (quotedMatch) {
    // Quoted string: "op === 'make'" or 'op === "set"'
    const [, fieldName, , expectedValue] = quotedMatch;
    return action[fieldName] === expectedValue;
  }

  // Unquoted value: boolean or number
  const unquotedMatch = condition.match(/^(\w+)\s*===\s*(\S+)$/);
  if (!unquotedMatch) {
    return false;
  }

  const [, fieldName, expectedValue] = unquotedMatch;
  const actualValue = action[fieldName];

  // Handle boolean: "flag === true" or "flag === false"
  if (expectedValue === 'true') {
    return actualValue === true;
  }
  if (expectedValue === 'false') {
    return actualValue === false;
  }

  // Handle number: "count === 5"
  const numVal = Number(expectedValue);
  if (!isNaN(numVal)) {
    return actualValue === numVal;
  }

  // Fallback: direct string comparison (for unquoted strings like identifiers)
  return actualValue === expectedValue;
}

/**
 * @description Validate action structure against registry rules.
 *
 * Checks:
 * 1. Action exists in registry
 * 2. Required fields are present (accounting for aliases)
 * 3. Conditional required fields if applicable
 * 4. Type hints (advisory warnings, not hard blocking)
 *
 * Returns early on first validation error with clear hint.
 *
 * @param action - Action object to validate (should have 'action' field)
 * @returns Validation result object
 *
 * @note Does NOT throw - returns validation result object
 * @note Type checking is advisory - incorrect types log warning but don't fail validation
 */
export function validateAction(action: unknown): ValidationResult {
  if (!action || typeof action !== 'object') {
    return {
      valid: false,
      error: 'Action must be a non-null object',
      hint: 'Expected: {"action": "ACTION_NAME", ...}, got: ' + String(action)
    };
  }

  const actionObj = action as Record<string, unknown>;
  const actionName = actionObj.action as string | undefined;

  // Check action exists
  if (!actionName) {
    return {
      valid: false,
      error: 'Missing required field: "action"',
      hint: 'Every action must have an "action" field matching one of the 18 action types (e.g., "THINK", "MESSAGE_USER")'
    };
  }

  const toolDef = TOOL_DEFINITIONS[actionName];
  if (!toolDef) {
    const validActions = Object.keys(TOOL_DEFINITIONS).join(', ');
    return {
      valid: false,
      error: `Unknown action type: "${actionName}"`,
      hint: `Valid actions: ${validActions}`
    };
  }

  const schema = toolDef.schema;

  // Build set of fields present in action (excluding 'action' itself)
  const presentFields = new Set(Object.keys(actionObj).filter(k => k !== 'action'));

  // Resolve aliases to canonical field names for validation.
  // Aliases and canonical names are MUTUALLY EXCLUSIVE in resolved set:
  // - If canonical present: use canonical (alias ignored even if present)
  // - If only alias present: map to canonical name
  // - If neither present: field is absent
  //
  // This prevents double-counting and ensures validation checks canonical names.
  const resolvedFields = new Set<string>();

  for (const field of presentFields) {
    // Check if this field is an alias
    const canonical = schema.aliases?.[field];
    if (canonical) {
      // This is an alias - only add canonical if canonical isn't already present
      if (!presentFields.has(canonical)) {
        resolvedFields.add(canonical);
      }
      // Don't add the alias itself - we only track canonical names
    } else {
      // Not an alias - add directly
      resolvedFields.add(field);
    }
  }

  // Check required fields
  const missingRequired = schema.required.filter(field => !resolvedFields.has(field));
  if (missingRequired.length > 0) {
    return {
      valid: false,
      error: `Missing required field(s): ${missingRequired.join(', ')}`,
      hint: `${actionName} requires: ${schema.required.join(', ')}. Format hint: ${schema.formatHint}`
    };
  }

  // Check conditional required fields (e.g., "op === 'make'" → content required)
  if (schema.conditionalRequired) {
    for (const [condition, requiredIfTrue] of Object.entries(schema.conditionalRequired)) {
      const matches = evaluateCondition(condition, actionObj);
      if (matches) {
        const missingConditional = requiredIfTrue.filter(field => !resolvedFields.has(field));
        if (missingConditional.length > 0) {
          return {
            valid: false,
            error: `Missing fields required when ${condition}: ${missingConditional.join(', ')}`,
            hint: schema.formatHint
          };
        }
      }
    }
  }

  // Type checking (advisory - log but don't fail)
  const typeWarnings: string[] = [];
  for (const [field, expectedType] of Object.entries(schema.types || {})) {
    if (field in actionObj && actionObj[field] != null) {
      const actualType = Array.isArray(actionObj[field]) ? 'array' : typeof actionObj[field];
      if (actualType !== expectedType && expectedType !== 'any') {
        typeWarnings.push(`Field "${field}": expected ${expectedType}, got ${actualType}`);
      }
    }
  }

  if (typeWarnings.length > 0) {
    return {
      valid: true,
      typeWarnings
    };
  }

  return { valid: true };
}

/**
 * @description Validate multiple actions, returning results for each.
 *
 * @param actions - Array of action objects
 * @returns Array of validation results (same order as input)
 */
export function validateActions(actions: unknown[]): ValidationResult[] {
  return actions.map(validateAction);
}

/**
 * @description Check if an action is valid without returning details.
 *
 * @param action - Action object
 * @returns true if valid, false otherwise
 */
export function isValidAction(action: unknown): boolean {
  return validateAction(action).valid;
}

/**
 * @description Get the schema for an action type.
 *
 * @param actionName - Name of the action (e.g., "THINK")
 * @returns Schema object or null if not found
 */
export function getActionSchema(actionName: string): ToolDefinition['schema'] | null {
  const toolDef = TOOL_DEFINITIONS[actionName];
  return toolDef?.schema || null;
}
