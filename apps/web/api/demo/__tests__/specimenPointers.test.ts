/**
 * Specimen documentation pointers — the exhibit points at its own pages
 *
 * @module api/demo/__tests__/specimenPointers.test
 * @description The demo's discoverability contract: the specimen's LAST
 * visible scripted message (on screen before any interaction) ends by
 * pointing at the two reading pages in its own voice — markdown links to
 * /about and /efficiencies — and the first scripted visitor reply carries
 * one of the two links, so the pointer survives the visitor's own message
 * pushing the original bubble up. Also pins the honesty boundary: the
 * pointer copy must not claim authorship of the code, and adding it must
 * not disturb the wobble entry the About page quotes verbatim.
 *
 * Targets: `apps/web/api/demo/specimen.ts` (SPECIMEN_HISTORY tail,
 *   VISITOR_REPLY_SCRIPT), rendered by `packages/ui` ChatBubble markdown.
 */

import { describe, it, expect } from 'vitest';
import {
  SPECIMEN_HISTORY,
  VISITOR_REPLY_SCRIPT,
  WOBBLE_ENTRY_ID,
} from '../specimen';

/** The newest message_to_user — the last bubble a visitor sees pre-interaction. */
function lastVisibleMessage(): string {
  const messages = SPECIMEN_HISTORY.filter(
    (specimenEntry) => specimenEntry.type === 'message_to_user',
  );
  return messages[messages.length - 1]?.content ?? '';
}

describe('the last visible scripted message', () => {
  it('ends with markdown links to BOTH reading pages', () => {
    const content = lastVisibleMessage();
    expect(content).toContain('](/about)');
    expect(content).toContain('](/efficiencies)');
    // "ENDS with" — the pointer is the closing beat, not a buried aside.
    const pointerStart = content.indexOf('](/about)');
    expect(pointerStart).toBeGreaterThan(content.length / 2);
  });

  it('is not the wobble entry (the verbatim-pinned quote stays untouched)', () => {
    const messages = SPECIMEN_HISTORY.filter(
      (specimenEntry) => specimenEntry.type === 'message_to_user',
    );
    expect(messages[messages.length - 1]?.id).not.toBe(WOBBLE_ENTRY_ID);
  });
});

describe('the scripted visitor reply', () => {
  it('the first reply carries a pointer to a reading page', () => {
    expect(VISITOR_REPLY_SCRIPT[0]).toContain('](/about)');
  });
});

describe('honesty constraints on the pointer copy', () => {
  it('never claims the specimen wrote the code', () => {
    const copy = lastVisibleMessage() + VISITOR_REPLY_SCRIPT.join(' ');
    // The specimen may keep/read/point at the pages; authorship claims about
    // the codebase would be the exhibit lying about itself.
    expect(copy).not.toMatch(/I (wrote|built|coded|designed) (the|this) (code|instrument|observatory|repo)/i);
  });
});
