/**
 * Prompt-surface tests for persona-template.
 *
 * Tests: `platforms/cloudflare/src/prompts/persona-template.ts::buildPersonaSystemPrompt`
 * See also: `platforms/cloudflare/src/prompts/system.ts`
 *
 * The humanName suite covers the README/SETUP promise: the persona addresses
 * its human by the D1 `human_name` state key (default "User"), the outbound
 * action label renders as MESSAGE_<NAME>, and internal storage stays a
 * stable `message_to_user` type so renaming is data-safe.
 */
import { describe, expect, it } from "vitest";
import { normalizeAction } from "@persistence/services";
import { MESSAGE_USER, getMessageActionDisplayName } from "@persistence/tools";
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

  describe("humanName personalization", () => {
    it('defaults to the generic "User" when no humanName is configured', () => {
      const prompt = buildPersonaSystemPrompt();

      expect(prompt).toContain(
        "1. MESSAGE_USER - Send User a message",
      );
      expect(prompt).toContain("WHO USER IS — MY REFERENCE NOTES");
      expect(prompt).toContain(
        "**I trust that User appreciates hearing from me**",
      );
      expect(prompt).toContain('{"action":"MESSAGE_USER","content":"hello"}');
    });

    it("carries no hardcoded author name or retired aliases in the composed prompt", () => {
      const prompt = buildPersonaSystemPrompt();

      expect(prompt).not.toMatch(/\bDan\b/);
      expect(prompt).not.toContain("MESSAGE_DAN");
      expect(prompt).not.toContain("shareToDan");
    });

    it("addresses a configured human by name, including the MESSAGE_<NAME> action label", () => {
      const prompt = buildPersonaSystemPrompt({ humanName: "Alex" });

      expect(prompt).toContain("1. MESSAGE_ALEX - Send Alex a message");
      expect(prompt).toContain("WHO ALEX IS — MY REFERENCE NOTES");
      expect(prompt).toContain(
        "**I trust that Alex appreciates hearing from me**",
      );
      expect(prompt).toContain('{"action":"MESSAGE_ALEX","content":"hello"}');
      expect(prompt).toContain("OBSERVATION - Alex observations");
      expect(prompt).not.toMatch(/\bMESSAGE_USER\b/);
    });

    it("keeps the rest-verb toggle surgery working for a configured name", () => {
      const prompt = buildPersonaSystemPrompt({
        humanName: "Alex",
        restVerbsEnabled: true,
      });

      expect(prompt).toContain("1. MESSAGE_ALEX - Send Alex a message");
      expect(prompt).toContain("20. SLEEP - Pause my cycles for a duration");
      expect(prompt).toContain("21. EXIST - Choose to simply be present this cycle");
    });

    it("advertises the real shareToUser parameter, not a retired alias", () => {
      const prompt = buildPersonaSystemPrompt({ humanName: "Alex" });

      expect(prompt).toContain('"shareToUser":true');
    });

    it("never changes internal routing or storage types when the display name changes", () => {
      // The label the model sees is dynamic...
      expect(getMessageActionDisplayName("Alex")).toBe("MESSAGE_ALEX");
      // ...but whatever MESSAGE_<NAME> the model emits normalizes back to
      // the single internal action...
      expect(normalizeAction("MESSAGE_ALEX")).toBe("MESSAGE_USER");
      expect(normalizeAction("MESSAGE_USER")).toBe("MESSAGE_USER");
      // ...whose history storage type is the stable message_to_user.
      expect(MESSAGE_USER.id).toBe("MESSAGE_USER");
      expect(MESSAGE_USER.historyTypes?.primary).toBe("message_to_user");
    });
  });
});
