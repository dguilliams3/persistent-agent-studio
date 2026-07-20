/**
 * Tool registry prompt rendering
 *
 * @module tools/prompt
 * @description Renders a tool catalog block for injection into the system prompt.
 *
 * WHY THIS EXISTS:
 * - The system prompt should describe tools dynamically so new tools
 *   automatically appear without editing prompt templates.
 * - Keeping this logic here makes buildSystemPrompt leaner and DRY.
 *
 * @upstream Called by:
 *   - prompts/build-system-prompt.js
 * @downstream Calls:
 *   - tools/registry.js (listToolDefinitions)
 */

// Import directly from package - do NOT use local wrappers (see tools/registry.js)
import { listToolDefinitions, getMessageActionDisplayName } from '@persistence/tools';

interface RenderToolPromptOptions {
  heading?: string;
  includeWarnings?: boolean;
  /**
   * Persona's configured name for the human operator. When set, the
   * MESSAGE_USER action is displayed to the model as MESSAGE_<HUMANNAME>
   * (e.g. 'Alex' -> 'MESSAGE_ALEX'). Internal routing is unaffected — see
   * getMessageActionDisplayName() in @persistence/tools.
   */
  humanName?: string | null;
  restVerbsEnabled?: boolean;
}

/**
 * @description Render tool prompt blocks from the registry
 *
 * @param {Object} [options] - Render options
 * @param {string} [options.heading='TOOL REGISTRY'] - Heading label
 * @param {boolean} [options.includeWarnings=true] - Print warnings/failure modes
 * @param {string|null} [options.humanName] - Drives the dynamic MESSAGE_<NAME> display name
 * @returns {string} Rendered prompt block (empty string when no tools)
 */
export function renderToolPromptBlocks(options: RenderToolPromptOptions = {}) {
  const {
    heading = 'TOOL REGISTRY',
    includeWarnings = true,
    humanName = null,
    restVerbsEnabled = false,
  } = options;
  const tools = listToolDefinitions().filter((tool) => {
    if (restVerbsEnabled) {
      return true;
    }
    return tool.id !== 'SLEEP' && tool.id !== 'EXIST';
  });

  if (tools.length === 0) {
    return '';
  }

  const entries = tools.map((tool) => {
    const lines = [];
    const categorySuffix = tool.category ? ` (${tool.category})` : '';
    lines.push(`TOOL: ${tool.id}${categorySuffix}`);

    if (tool.prompt?.summary) {
      lines.push(`Summary: ${tool.prompt.summary}`);
    }
    if (tool.prompt?.usage) {
      lines.push(`Usage: ${tool.prompt.usage}`);
    }

    const examples = Array.isArray(tool.prompt?.examples) ? tool.prompt.examples : [];
    if (examples.length > 0) {
      lines.push('Examples:');
      examples.forEach((example) => lines.push(`  - ${example}`));
    }

    if (includeWarnings) {
      const warnings = Array.isArray(tool.prompt?.warnings) ? tool.prompt.warnings : [];
      if (warnings.length > 0) {
        lines.push('Warnings:');
        warnings.forEach((warning) => lines.push(`  - ${warning}`));
      }

      const failureModes = Array.isArray(tool.help?.failureModes) ? tool.help.failureModes : [];
      if (failureModes.length > 0) {
        lines.push('Failure Modes:');
        failureModes.forEach((failure) => lines.push(`  - ${failure}`));
      }

      const notFor = Array.isArray(tool.help?.notFor) ? tool.help.notFor : [];
      if (notFor.length > 0) {
        lines.push('Not For:');
        notFor.forEach((item) => lines.push(`  - ${item}`));
      }
    }

    return lines.join('\n');
  });

  const block = `--- ${heading} ---\n${entries.join('\n\n')}\n--- END ${heading} ---`;

  // Dynamic humanName tool naming: swap the literal MESSAGE_USER action name
  // for MESSAGE_<HUMANNAME> so the model addresses the human by name. Only
  // affects what's shown here — internal routing/storage stays MESSAGE_USER
  // (see getMessageActionDisplayName() and normalizeAction()'s reverse map).
  const displayName = getMessageActionDisplayName(humanName);
  if (displayName !== 'MESSAGE_USER') {
    return block.replace(/\bMESSAGE_USER\b/g, displayName);
  }
  return block;
}
