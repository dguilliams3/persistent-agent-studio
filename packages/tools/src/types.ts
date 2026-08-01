/**
 * Shared tool type definitions.
 *
 * @description Common interfaces used by the tool registry and validation.
 */
export type ActionCategory =
  | "communication"
  | "reflection"
  | "memory"
  | "research"
  | "creative"
  | "self"
  | "core";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "any";

export interface FieldSchema {
  type: FieldType;
  required: boolean;
  aliases: string[];
  defaultValue: unknown;
}

export interface ToolSchema {
  required: string[];
  optional: string[];
  aliases: Record<string, string>;
  conditionalRequired?: Record<string, string[]>;
  types: Record<string, FieldType>;
  formatHint: string;
  example: string;
  defaults: Record<string, unknown>;
}

export interface ToolPromptMeta {
  summary: string;
  usage: string;
  examples: string[];
  warnings: string[];
}

export interface ToolHelpMeta {
  short: string;
  description: string;
  failureModes: string[];
  notFor: string[];
  hints: string[];
}

/**
 * Base parameters that ALL tools receive.
 * Tool-specific params extend this.
 */
export interface BaseToolParams {
  /** Private reasoning/notes (not shown to operator) */
  internal?: string;
}

/**
 * Context passed to every tool handler.
 * Contains everything a handler needs to do its job.
 *
 * @pattern basin-pattern — all dependencies injected as parameters, not read from env
 *
 * DB TYPE NOTE: `db` is typed as `unknown` here to avoid a circular package
 * dependency between @persistence/tools and @persistence/db. At runtime it is
 * always a DrizzleD1 instance (the Drizzle ORM wrapper over Cloudflare D1).
 * Tool handlers that need typed DB access should cast: `const typedDb = db as DrizzleD1`.
 * Do NOT use D1Database (the raw Cloudflare type) — the system uses DrizzleD1 exclusively.
 *
 * @antipattern DO NOT import D1Database from Cloudflare types inside tool handlers.
 *   Accept db as DrizzleD1 (cast from ToolContext.db) and use Drizzle query builder
 *   methods or db.$client for raw SQL.
 */
export interface ToolContext {
  /** DrizzleD1 database connection (typed as unknown to avoid circular dep — cast at call site) */
  db: unknown; // Runtime type: DrizzleD1 from @persistence/db
  /** Current thinking cycle ID */
  cycleId: string | number | null;
  /** Active persona configuration */
  persona: {
    id: number;
    name: string;
    slug: string;
  };
  /** Environment bindings (API keys, etc.) */
  env: Record<string, unknown>;
}

/**
 * Result returned by every tool handler.
 * Generic type parameter allows typed return data.
 */
export interface ToolResult<T = unknown> {
  /** Whether the action succeeded */
  success: boolean;
  /** History entry type (if creating history) */
  type?: string;
  /** Additional data to return */
  data?: T;
  /** Error message if failed */
  error?: string;
}

/**
 * Handler function signature.
 * TParams must extend BaseToolParams.
 */
export type ToolHandler<TParams extends BaseToolParams = BaseToolParams> = (
  params: TParams,
  ctx: ToolContext,
) => Promise<ToolResult>;

export interface ToolDefinition<
  TParams extends BaseToolParams = BaseToolParams,
> {
  id: string;
  category: ActionCategory;
  schema: ToolSchema;
  prompt: ToolPromptMeta;
  help: ToolHelpMeta;
  /** Handler function that executes the action */
  handler: ToolHandler<TParams>;
  /**
   * Declares what history types this action produces when executed.
   * For actions with `op` variants, use Record<string, string>.
   * For simple actions, use a single string.
   * Post-processed types (search_result, art_result, etc.) are listed separately.
   */
  historyTypes?: {
    /** Primary type(s) logged by the handler */
    primary: string | Record<string, string | null> | null;
    /** Types logged by post-processors (search_result, art_result, etc.) */
    postProcessed?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  hint?: string;
  typeWarnings?: string[];
}
