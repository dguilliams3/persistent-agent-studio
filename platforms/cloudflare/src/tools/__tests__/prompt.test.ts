/**
 * @module platforms/cloudflare/src/tools/__tests__/prompt.test
 * @description Unit tests for the tool registry prompt renderer.
 *
 * Covers the RENDER half of the dynamic humanName tool naming feature:
 * the rendered TOOL REGISTRY block shown to the model displays
 * MESSAGE_<HUMANNAME> instead of the internal MESSAGE_USER action name
 * when a humanName is configured (see getMessageActionDisplayName() in
 * @persistence/tools, and normalizeAction() in @persistence/services for
 * the reverse/PARSE mapping).
 *
 * @covers ../prompt.ts
 */

import { describe, it, expect } from 'vitest';
import { buildPersonaSystemPrompt } from '../../prompts/persona-template';
import { renderToolPromptBlocks } from '../prompt';

describe('renderToolPromptBlocks', () => {
  it('renders the canonical MESSAGE_USER action name by default', () => {
    const block = renderToolPromptBlocks();
    expect(block).toContain('TOOL: MESSAGE_USER');
    expect(block).not.toMatch(/MESSAGE_ALEX/);
  });

  it('renders the canonical MESSAGE_USER action name when humanName is "User"', () => {
    const block = renderToolPromptBlocks({ humanName: 'User' });
    expect(block).toContain('TOOL: MESSAGE_USER');
  });

  it('renders MESSAGE_<HUMANNAME> for a configured humanName (PROOF)', () => {
    // PROOF: with humanName="Alex", the built tool schema shown to the
    // model contains MESSAGE_ALEX, not MESSAGE_USER.
    const block = renderToolPromptBlocks({ humanName: 'Alex' });
    expect(block).toContain('TOOL: MESSAGE_ALEX');
    expect(block).not.toMatch(/\bMESSAGE_USER\b/);
  });

  it('substitutes the action name inside examples too, not just the header', () => {
    const block = renderToolPromptBlocks({ humanName: 'Alex' });
    // The MESSAGE_USER tool's prompt.examples are formatted as
    // 'MESSAGE_USER — {"content":...}' (no "action" field in the example
    // JSON itself), so the substitution must reach the example lines too.
    expect(block).toMatch(/MESSAGE_ALEX — \{"content"/);
  });

  it('leaves other tools unaffected by the humanName substitution', () => {
    const block = renderToolPromptBlocks({ humanName: 'Alex' });
    expect(block).toContain('TOOL: THINK');
    expect(block).toContain('TOOL: WONDER');
  });

  it('sanitizes an unsafe humanName into a safe token', () => {
    const block = renderToolPromptBlocks({ humanName: "Dr. Jane O'Brien" });
    expect(block).toContain('TOOL: MESSAGE_DR_JANE_O_BRIEN');
  });

  it('omits rest-verb tool definitions from the composed prompt when the flag is off', () => {
    const composedPrompt =
      buildPersonaSystemPrompt({ restVerbsEnabled: false }) +
      '\n\n' +
      renderToolPromptBlocks({ restVerbsEnabled: false });

    expect(composedPrompt).not.toContain('TOOL: SLEEP');
    expect(composedPrompt).not.toContain('TOOL: EXIST');
  });
});
