/**
 * Prompt-surface tests for persona-template.
 *
 * Tests: `platforms/cloudflare/src/prompts/persona-template.ts::buildPersonaSystemPrompt`
 * See also: `platforms/cloudflare/src/prompts/system.ts`
 */
import { describe, expect, it } from "vitest";
import { buildPersonaSystemPrompt } from "./persona-template";

describe("buildPersonaSystemPrompt", () => {
  it("re-enables SLEEP and EXIST in the action menu and guidance", () => {
    const prompt = buildPersonaSystemPrompt();

    expect(prompt).toContain("14. SLEEP - Pause my cycles for a duration");
    expect(prompt).toContain("15. EXIST - Choose to simply be present this cycle");
    expect(prompt).toContain('Format: {"action":"SLEEP","duration":1800');
    expect(prompt).toContain('Format: {"action":"EXIST","internal":"why this quiet cycle matters"}');
    expect(prompt).not.toContain("TEMPORARILY DISABLED - EXIST and SLEEP actions");
  });
});
