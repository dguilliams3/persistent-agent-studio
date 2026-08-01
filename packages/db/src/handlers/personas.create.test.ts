/**
 * Persona mint contract tests — unified create contract
 *
 * @module @persistence/db/handlers/personas.create.test
 * @description Pins the unified create contract: the web lane sends only
 * {name, password} and MUST mint (slug derived, template defaulted); an
 * explicit bad slug or unknown template still fails loudly; the derivation
 * rule is one shared function used by every door.
 *
 * Tests: packages/db/src/handlers/personas.ts::handleCreatePersona (validation
 * layer — branches that return before any db call), packages/db/src/personas.ts::derivePersonaSlug
 */

import { describe, it, expect } from 'vitest';
import { handleCreatePersona } from './personas';
import { derivePersonaSlug } from '../personas';
import type { DrizzleD1 } from '../client';

// Validation-branch tests never reach the db — a throwing proxy proves it.
const explodingDb = new Proxy(
  {},
  {
    get() {
      throw new Error('db must not be touched by a validation rejection');
    },
  },
) as unknown as DrizzleD1;

const PW = 'test-admin-pw';

describe('derivePersonaSlug — the one canonical rule', () => {
  it('derives url-safe slugs from display names', () => {
    expect(derivePersonaSlug('Test Persona')).toBe('test-persona');
    expect(derivePersonaSlug('  Ada   Lovelace 2 ')).toBe('ada-lovelace-2');
    expect(derivePersonaSlug('Émile!!')).toBe('mile'); // non-ascii stripped, no edge dashes
  });

  it('returns empty string when nothing derivable', () => {
    expect(derivePersonaSlug('!!!')).toBe('');
    expect(derivePersonaSlug('')).toBe('');
    expect(derivePersonaSlug(undefined as unknown as string)).toBe('');
  });
});

describe('handleCreatePersona — unified mint contract (validation layer)', () => {
  it('rejects when creation guard is unconfigured', async () => {
    const result = await handleCreatePersona(explodingDb, { name: 'X', password: 'x' }, null);
    expect(result).toMatchObject({ status: 503, code: 'PERSONA_CREATION_LOCKED' });
  });

  it('rejects a wrong password before anything else', async () => {
    const result = await handleCreatePersona(explodingDb, { name: 'X', password: 'nope' }, PW);
    expect(result).toMatchObject({ status: 401, code: 'INVALID_PASSWORD' });
  });

  it('still rejects an EXPLICIT malformed slug (no silent rewriting)', async () => {
    const result = await handleCreatePersona(
      explodingDb,
      { name: 'Fine Name', slug: 'Bad Slug!', password: PW },
      PW,
    );
    expect(result).toMatchObject({ status: 400, code: 'INVALID_SLUG' });
  });

  it('rejects when neither slug nor a derivable name is provided (clear message)', async () => {
    const result = (await handleCreatePersona(
      explodingDb,
      { name: '!!!', password: PW },
      PW,
    )) as { status: number; code: string; error: string };
    expect(result).toMatchObject({ status: 400, code: 'INVALID_SLUG' });
    expect(result.error).toMatch(/name containing letters\/numbers/);
  });

  it('still rejects an EXPLICIT unknown template (honest rejection, not rewrite)', async () => {
    const result = await handleCreatePersona(
      explodingDb,
      { name: 'Labrat', systemPromptTemplate: 'not-a-template', password: PW },
      PW,
    );
    expect(result).toMatchObject({ status: 400, code: 'INVALID_TEMPLATE' });
  });

  it('accepts the web payload shape past validation: {name, password} only', async () => {
    // The exploding proxy proves derivation+defaulting SUCCEEDED and the
    // handler proceeded to the db phase (slug-conflict check) — i.e. the
    // old guaranteed-400 is gone. The db phase itself is exercised by
    // integration paths, not this unit layer.
    await expect(
      handleCreatePersona(explodingDb, { name: 'Test Persona', password: PW }, PW),
    ).rejects.toThrow(/db must not be touched/);
  });
});
