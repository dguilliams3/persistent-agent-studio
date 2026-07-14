import { describe, expect, it } from "vitest";
import { buildBlock4 } from "./block4";
import type { Block4Data } from "./types";

function createBaseData(history: Block4Data["history"], now: Date): Block4Data {
  return {
    learned: [],
    questions: [],
    notebook: [],
    ragResults: [],
    summaryTail: [],
    history,
    reminders: [],
    dueReminders: [],
    userStatus: null,
    loopCount: 3,
    now,
    timeSinceLastMessage: null,
    feedback: "",
    parseErrorTooltip: "",
    summarizeReminder: "",
    meters: {
      values: {},
      histories: {},
    },
  };
}

describe("buildBlock4 density line", () => {
  it("reports fed wakes from existing history boundaries and last inbound age", () => {
    const now = new Date("2026-07-13T14:00:00.000Z");
    const history = [
      {
        id: 1,
        persona_id: 1,
        type: "user_message" as any,
        content: "hello",
        internal: null,
        created_at: "2026-07-13T10:00:00.000Z",
        summarized_at: null,
        cycle_id: null,
        meter_snapshot: null,
      },
      {
        id: 2,
        persona_id: 1,
        type: "thought" as any,
        content: "wake one",
        internal: null,
        created_at: "2026-07-13T10:05:00.000Z",
        summarized_at: null,
        cycle_id: 101 as any,
        meter_snapshot: null,
      },
      {
        id: 3,
        persona_id: 1,
        type: "thought" as any,
        content: "wake two",
        internal: null,
        created_at: "2026-07-13T11:00:00.000Z",
        summarized_at: null,
        cycle_id: 102 as any,
        meter_snapshot: null,
      },
      {
        id: 4,
        persona_id: 1,
        type: "web_digest" as any,
        content: "digest",
        internal: null,
        created_at: "2026-07-13T11:30:00.000Z",
        summarized_at: null,
        cycle_id: null,
        meter_snapshot: null,
      },
      {
        id: 5,
        persona_id: 1,
        type: "thought" as any,
        content: "wake three",
        internal: null,
        created_at: "2026-07-13T12:00:00.000Z",
        summarized_at: null,
        cycle_id: 103 as any,
        meter_snapshot: null,
      },
    ];

    const result = buildBlock4(
      createBaseData(history as Block4Data["history"], now),
      () => ({ text: "history", userImages: [], claudeArtImages: [] }),
      () => "summary",
      (date) => date.toISOString(),
      () => "meters",
    );

    expect(result.text).toContain(
      "Of my last 3 wakes, 2 had something new; last inbound word 2h ago.",
    );
  });
});
