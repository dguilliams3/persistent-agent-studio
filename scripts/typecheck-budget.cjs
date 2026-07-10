#!/usr/bin/env node
/**
 * typecheck-budget.cjs
 *
 * Enforces the TypeScript ratchet for apps/web and platforms/cloudflare.
 * Counts errors by scope + TS error code. Counts may only go DOWN.
 * A code not present in the budget has ZERO tolerance.
 *
 * Usage:
 *   node scripts/typecheck-budget.cjs
 *   node scripts/typecheck-budget.cjs --update-baseline
 *   node scripts/typecheck-budget.cjs --update-baseline --force
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'typecheck-budget.json');
const TSC_JS = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update-baseline');
const FORCE = args.includes('--force');

const SCOPES = {
  'apps/web': ['--noEmit', '--pretty', 'false', '-p', 'apps/web/tsconfig.typecheck.json'],
  'platforms/cloudflare': ['--noEmit', '--pretty', 'false', '-p', 'platforms/cloudflare/tsconfig.json'],
};

function runTsc(argsArray) {
  const result = spawnSync('node', [TSC_JS, ...argsArray], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });

  return `${result.stdout || ''}${result.stderr || ''}`;
}

function collectCounts() {
  const counts = {};
  const examples = {};

  for (const [scope, scopeArgs] of Object.entries(SCOPES)) {
    const output = runTsc(scopeArgs);
    const lines = output.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const match = line.match(/error (TS\d+):/);
      if (!match) continue;
      const code = match[1];
      const key = `${scope}:${code}`;
      counts[key] = (counts[key] || 0) + 1;
      if (!examples[key]) {
        examples[key] = line.trim();
      }
    }
  }

  return { counts, examples };
}

function loadBudget() {
  if (!fs.existsSync(BUDGET_FILE)) return {};
  return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
}

function saveBudget(budget) {
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + '\n');
}

function main() {
  const { counts, examples } = collectCounts();

  if (UPDATE) {
    const budget = loadBudget();
    const raised = [];

    for (const [key, count] of Object.entries(counts)) {
      const prev = budget[key];
      if (prev != null && count > prev && !FORCE) {
        raised.push({ key, prev, now: count });
      }
    }

    if (raised.length && !FORCE) {
      console.error('Refusing to raise typecheck baseline for:');
      for (const item of raised) {
        console.error(`  ${item.key}: ${item.prev} -> ${item.now}`);
      }
      console.error('Use --force to override (not recommended).');
      process.exit(1);
    }

    const nextBudget = {};
    for (const [key, count] of Object.entries(counts)) {
      if (count > 0) nextBudget[key] = count;
    }

    saveBudget(nextBudget);
    console.log('Typecheck baseline updated.');
    console.log(JSON.stringify(nextBudget, null, 2));
    return;
  }

  const budget = loadBudget();
  const violations = [];

  for (const [key, count] of Object.entries(counts)) {
    const base = budget[key];
    if (base == null && count > 0) {
      violations.push({
        key,
        count,
        base: 0,
        example: examples[key] || '(code not in budget: zero tolerance)',
      });
      continue;
    }
    if (base != null && count > base) {
      violations.push({
        key,
        count,
        base,
        example: examples[key] || '',
      });
    }
  }

  if (violations.length) {
    console.error('Typecheck budget exceeded:');
    for (const item of violations) {
      console.error(`  ${item.key}: ${item.count} > baseline ${item.base}`);
      if (item.example) {
        console.error(`    example: ${item.example}`);
      }
    }
    process.exit(1);
  }

  console.log('Typecheck budget OK (all scope/code counts <= baseline).');
}

main();
