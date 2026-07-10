/**
 * Tool registry HTTP routes
 *
 * @module routes/tools
 * @description Provides read-only access to the enriched tool registry so UI and
 * transport surfaces can stay in sync with the canonical recipe cards.
 *
 * WHY THIS EXISTS:
 * - UI panels and Telegram commands need the same tool metadata that feeds the
 *   system prompt. Exposing it over HTTP keeps everything DRY without copying
 *   the registry into the frontend bundle.
 *
 * @upstream Called by:
 *   - routes/registry.js (`/tool-registry` GET endpoint)
 * @downstream Calls:
 *   - tools/registry.js listToolDefinitions()
 */

// Import directly from package - do NOT use local wrappers (see tools/registry.js)
import { listToolDefinitions } from '@persistence/tools';

type ToolRouteContext = {
  corsHeaders?: HeadersInit;
};

/**
 * @description Handle GET /tool-registry by returning sanitized tool metadata
 *
 * @param {Object} ctx - Request context injected by the route registry
 * @returns {Response} JSON response containing tool catalog
 */
export async function handleGetToolRegistry(ctx: ToolRouteContext) {
  const tools = listToolDefinitions().map((tool) => ({
    id: tool.id,
    category: tool.category,
    prompt: tool.prompt,
    help: tool.help,
    schema: {
      required: tool.schema.required,
      optional: tool.schema.optional,
      defaults: tool.schema.defaults,
      formatHint: tool.schema.formatHint,
      example: tool.schema.example
    }
  }));

  return Response.json(
    { tools, generatedAt: new Date().toISOString() },
    { headers: ctx?.corsHeaders || {} }
  );
}
