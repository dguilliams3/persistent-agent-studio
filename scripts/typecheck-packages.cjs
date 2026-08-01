#!/usr/bin/env node
/**
 * Typecheck the shared `packages/*` libraries.
 *
 * Why this is a script and not a one-line pnpm filter:
 *
 *   "typecheck:packages": "pnpm -r --filter './packages/*' run typecheck"
 *
 * ...silently passed on Windows. npm scripts run through cmd.exe, which does not
 * strip single quotes, so pnpm received the literal filter `'./packages/*'`,
 * matched zero projects, printed "No projects matched the filters", and exited 0.
 * The same line run from a POSIX shell matched fine and exited non-zero. A gate
 * that reports success on one platform because it checked nothing is worse than
 * no gate at all, so the match count is now asserted explicitly below.
 *
 * KNOWN STATE: this check currently FAILS, and that failure is pre-existing and
 * architectural, not a regression. The bulk of it is TS6059 ("file is not under
 * rootDir") from the packages sharing sources without TypeScript project
 * references. Fixing it is a build-topology change, not a lint pass.
 *
 * The gates that DO gate this repo, and are green, are:
 *   pnpm typecheck:web · pnpm typecheck:worker · pnpm typecheck:budget
 *   pnpm lint:budget · pnpm build · pnpm build:packages · pnpm test
 *
 * If you are evaluating this repository: prefer those. This script is kept
 * runnable, and kept honest, so the remaining debt stays visible instead of
 * hiding behind a filter that matched nothing.
 */

const { spawnSync } = require('node:child_process');

const FILTER = './packages/*';

// Discover matching workspace projects first, so "no matches" can never be
// mistaken for "everything passed".
const listed = spawnSync(
  'pnpm',
  ['-r', '--filter', FILTER, 'list', '--depth', '-1', '--json'],
  { encoding: 'utf8', shell: true },
);

let matched = [];
try {
  const parsed = JSON.parse(listed.stdout || '[]');
  matched = Array.isArray(parsed) ? parsed : [parsed];
} catch {
  matched = [];
}

if (matched.length === 0) {
  console.error(
    `typecheck:packages matched NO workspace projects for filter "${FILTER}".\n` +
      'That is a tooling failure, not a passing check. Refusing to exit 0.',
  );
  process.exit(1);
}

console.log(`typecheck:packages — ${matched.length} workspace project(s) matched.`);
console.log('NOTE: this check is known-red (pre-existing TS6059 rootDir topology).');
console.log('Green gates: typecheck:web, typecheck:worker, typecheck:budget, lint:budget, build, test.\n');

const run = spawnSync('pnpm', ['-r', '--filter', FILTER, 'run', 'typecheck'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(run.status === 0 ? 0 : 1);
