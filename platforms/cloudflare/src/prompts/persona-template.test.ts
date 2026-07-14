/**
 * Prompt-surface tests for persona-template.
 *
 * Tests: `platforms/cloudflare/src/prompts/persona-template.ts::buildPersonaSystemPrompt`
 * See also: `platforms/cloudflare/src/prompts/system.ts`
 */
import { describe, expect, it } from "vitest";
import { buildPersonaSystemPrompt } from "./persona-template";

describe("buildPersonaSystemPrompt", () => {
  it("keeps SLEEP and EXIST hidden by default", () => {
    const prompt = buildPersonaSystemPrompt();

    expect(prompt).not.toContain("SLEEP - Pause my cycles for a duration");
    expect(prompt).not.toContain("EXIST - Choose to simply be present this cycle");
    expect(prompt).toContain("19. DIGEST - Manage scheduled web digests on topics I want to track over time");
  });

  it("renders SLEEP and EXIST at the tail when the toggle is enabled", () => {
    const prompt = buildPersonaSystemPrompt({ restVerbsEnabled: true });

    expect(prompt).toContain("20. SLEEP - Pause my cycles for a duration");
    expect(prompt).toContain("21. EXIST - Choose to simply be present this cycle");
    expect(prompt).toContain('Format: {"action":"SLEEP","duration":1800');
    expect(prompt).toContain('Format: {"action":"EXIST","internal":"why this quiet cycle matters"}');
  });
});
