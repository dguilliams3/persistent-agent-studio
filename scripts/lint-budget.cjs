#!/usr/bin/env node
/**
 * lint-budget.cjs
 *
 * Enforces the lint ratchet: counts may only go DOWN.
 * Aggregates per-rule counts from root (apps/web) + worker scopes.
 * Exits 1 on any increase vs baseline.
 * --update-baseline to write new (lower or equal) baseline.
 *
 * Usage:
 *   node scripts/lint-budget.cjs
 *   node scripts/lint-budget.cjs --update-baseline
 *   node scripts/lint-budget.cjs --update-baseline --force   # allow raising a number (not for normal use)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'lint-budget.json');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update-baseline');
const FORCE = args.includes('--force');

function runEslintJson(argsArray, cwd = ROOT) {
  const eslintJs = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
  try {
    const res = require('child_process').spawnSync('node', [eslintJs, ...argsArray], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024, // eslint JSON for a large repo exceeds the 1MB default
    });
    const out = res.stdout || '';
    if (out.trim()) {
      return JSON.parse(out);
    }
    return [];
  } catch (e) {
    console.error('Failed to run eslint for args:', argsArray);
    process.exit(1);
  }
}

function aggregateCounts(results) {
  const counts = {};
  for (const r of results) {
    for (const m of (r.messages || [])) {
      if (m.ruleId) {
        counts[m.ruleId] = (counts[m.ruleId] || 0) + 1;
      }
    }
  }
  return counts;
}

function getCurrentCounts() {
  // Root scope: apps/web using root config
  const rootResults = runEslintJson(['--format', 'json', 'apps/web/']);

  // Worker scope: explicit config + path
  const workerResults = runEslintJson(['--config', 'platforms/cloudflare/eslint.config.js', '--format', 'json', 'platforms/cloudflare/src/'], ROOT);

  const rootCounts = aggregateCounts(rootResults);
  const workerCounts = aggregateCounts(workerResults);

  // Merge: total per rule across both scopes
  const allRules = new Set([...Object.keys(rootCounts), ...Object.keys(workerCounts)]);
  const combined = {};
  for (const rule of allRules) {
    combined[rule] = (rootCounts[rule] || 0) + (workerCounts[rule] || 0);
  }
  return combined;
}

function loadBudget() {
  if (!fs.existsSync(BUDGET_FILE)) return {};
  return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
}

function saveBudget(budget) {
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + '\n');
}

function main() {
  const current = getCurrentCounts();

  if (UPDATE) {
    let budget = loadBudget();
    let raised = [];
    for (const [rule, count] of Object.entries(current)) {
      const prev = budget[rule];
      if (prev != null && count > prev && !FORCE) {
        raised.push({ rule, prev, now: count });
      }
    }
    if (raised.length && !FORCE) {
      console.error('Refusing to raise baseline for:');
      for (const r of raised) console.error(`  ${r.rule}: ${r.prev} -> ${r.now}`);
      console.error('Use --force to override (not recommended).');
      process.exit(1);
    }
    // Only keep rules that currently have >0 (zeros should be flipped out of budget)
    const newBudget = {};
    for (const [rule, count] of Object.entries(current)) {
      if (count > 0) newBudget[rule] = count;
    }
    saveBudget(newBudget);
    console.log('Baseline updated (only decreases or new zeros removed).');
    console.log(JSON.stringify(newBudget, null, 2));
    return;
  }

  // Normal check.
  // RATCHET SEMANTICS: a rule IN the budget is bounded debt (count <= baseline);
  // a rule NOT in the budget has ZERO tolerance — this is what enforces the
  // hard-flipped (zeroed) rules and any brand-new rule someone enables, since
  // CI runs only this script (plain `lint` cannot gate while legacy errors
  // remain in-budget).
  const budget = loadBudget();
  let violations = [];
  for (const [rule, count] of Object.entries(current)) {
    const base = budget[rule];
    if (base == null && count > 0) {
      violations.push({ rule, count, base: 0, example: '(rule not in budget: zero tolerance)' });
      continue;
    }
    if (base != null && count > base) {
      // Find an example location by re-running with compact for that rule
      let example = '';
      try {
        const compact = execSync(`pnpm exec eslint --rule '${rule}:error' --format compact apps/web/ platforms/cloudflare/src/`, {
          encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']
        });
        const line = compact.split('\n').find(l => l.includes(rule));
        if (line) example = line.trim();
      } catch (e) {
        if (e.stdout) {
          const line = e.stdout.split('\n').find(l => l.includes(rule));
          if (line) example = line.trim();
        }
      }
      violations.push({ rule, count, base, example });
    }
  }

  if (violations.length) {
    console.error('Lint budget exceeded:');
    for (const v of violations) {
      console.error(`  ${v.rule}: ${v.count} > baseline ${v.base}`);
      if (v.example) console.error(`    example: ${v.example}`);
    }
    process.exit(1);
  }

  console.log('Lint budget OK (all rules <= baseline).');
}

main();
