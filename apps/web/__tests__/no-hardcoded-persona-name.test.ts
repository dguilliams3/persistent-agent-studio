/**
 * Persona-name guard — you bring your own persona
 *
 * @module __tests__/no-hardcoded-persona-name.test
 * @description Executable form of the README's promise (lines ~7-10): the
 * reference persona shipped with this repo is *an example*, and a stranger who
 * deploys this must never find that example's name in their own instance's
 * chrome.
 *
 * This scans `apps/web/**` source and root `index.html` for the reference
 * persona's name and for the gendered pronouns that used to describe it, and
 * fails if any survive. Two exemptions, both deliberate:
 *
 * 1. `apps/web/api/demo/**` — the demo specimen is legitimately *named*. The
 *    demo shows a name because the FIXTURE DATA says so, which is exactly the
 *    behaviour we want: name flows from persona data, not from literals.
 * 2. `clio-v1` — a server-recognized system-prompt template id (packages/db
 *    handlers/personas.ts `SYSTEM_PROMPT_TEMPLATES`). It is a stored data
 *    value, not display copy; its *label* in the UI is persona-neutral.
 *
 * Targets: `apps/web/hooks/usePersonaName.ts`, `index.html`, and every
 *   surface that names the persona (AppShell, ChatView, LoginForm, TTSConfig,
 *   MemoryEditTools, SyntheticMemory, CreatePersonaModal).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PERSONA_NAME,
  APP_TITLE,
  personaDocumentTitle,
} from '../hooks/usePersonaName';

/** The reference persona's name, assembled so this file is not itself a hit. */
const REFERENCE_NAME = ['C', 'l', 'i', 'o'].join('');

/** Stored data values that legitimately contain the reference name. */
const DATA_VALUE_EXEMPTIONS = [`${REFERENCE_NAME.toLowerCase()}-v1`];

/** Directories whose contents are specimen/demo fixture data, not app copy. */
const FIXTURE_DIRS = [path.join('apps', 'web', 'api', 'demo')];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);

const REPO_ROOT = process.cwd();
const WEB_ROOT = path.join(REPO_ROOT, 'apps', 'web');

/**
 * @description Collect every scannable source file under apps/web, plus the
 * root index.html (the document title's static default lives there).
 *
 * @returns {string[]} Repo-relative POSIX paths
 */
function collectScannedFiles(): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(abs);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      found.push(abs);
    }
  };

  walk(WEB_ROOT);
  found.push(path.join(REPO_ROOT, 'index.html'));

  return found
    .map((abs) => path.relative(REPO_ROOT, abs))
    .filter((rel) => !FIXTURE_DIRS.some((dir) => rel.startsWith(dir)))
    .filter((rel) => !rel.includes('no-hardcoded-persona-name'))
    .map((rel) => rel.split(path.sep).join('/'));
}

/**
 * @description Strip the exempt data-value tokens so only genuine display
 * hardcodings can match.
 *
 * @param {string} source - Raw file contents
 * @returns {string} Contents with exempt tokens removed
 */
function stripExemptTokens(source: string): string {
  let stripped = source;
  for (const token of DATA_VALUE_EXEMPTIONS) {
    stripped = stripped.split(new RegExp(token, 'gi')).join('');
  }
  return stripped;
}

/**
 * @description Find every offending line in a file.
 *
 * @param {string} relPath - Repo-relative path (for the failure message)
 * @param {RegExp} pattern - Case-insensitive global matcher
 * @returns {string[]} "path:line: text" for each hit
 */
function findHits(relPath: string, pattern: RegExp): string[] {
  const source = stripExemptTokens(
    fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'),
  );
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => new RegExp(pattern.source, pattern.flags).test(line))
    .map(({ line, number }) => `${relPath}:${number}: ${line}`);
}

describe('no hardcoded reference-persona name in the UI', () => {
  const files = collectScannedFiles();

  it('scans a non-trivial number of files (guard against a broken walk)', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('index.html');
    expect(files).toContain('apps/web/hooks/usePersonaName.ts');
  });

  it('finds the reference persona nowhere outside demo fixtures', () => {
    const hits = files.flatMap((file) =>
      findHits(file, new RegExp(REFERENCE_NAME, 'i')),
    );
    expect(hits).toEqual([]);
  });

  it('describes the persona without gendered pronouns', () => {
    const hits = files.flatMap((file) =>
      findHits(file, /\b(she|her|hers|herself)\b/i),
    );
    expect(hits).toEqual([]);
  });

  it('keeps the static document title persona-independent', () => {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    expect(html).toContain(`<title>${APP_TITLE}</title>`);
  });
});

describe('persona name fallback', () => {
  it('is a generic noun, the persona-side analogue of the worker’s "User"', () => {
    expect(DEFAULT_PERSONA_NAME).toBe('Persona');
    expect(DEFAULT_PERSONA_NAME.toLowerCase()).not.toContain(
      REFERENCE_NAME.toLowerCase(),
    );
  });

  it('titles the document neutrally until a persona is known', () => {
    expect(personaDocumentTitle(null)).toBe(APP_TITLE);
    expect(personaDocumentTitle('Ada')).toBe(`Ada - ${APP_TITLE}`);
  });
});
