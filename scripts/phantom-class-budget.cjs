#!/usr/bin/env node
/**
 * phantom-class-budget.cjs
 *
 * Enforces a ratchet for Tailwind color/shadow utility classes that can fail
 * silently when they reference unregistered config keys or undefined CSS vars.
 *
 * Scope: apps/web only
 * Checks:
 *  - named bg/text/border/shadow utilities against registered Tailwind colors/shadows
 *  - arbitrary forms like bg-[rgb(var(--depth))] against CSS vars defined in
 *    packages/ui/src/tokens.css and apps/web/index.css
 *
 * Budget semantics mirror lint-budget.cjs:
 *  - counts may only go DOWN
 *  - any key not present in the budget has zero tolerance
 *
 * Usage:
 *   node scripts/phantom-class-budget.cjs
 *   node scripts/phantom-class-budget.cjs --update-baseline
 *   node scripts/phantom-class-budget.cjs --update-baseline --force
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'phantom-class-budget.json');
const WEB_ROOT = path.join(ROOT, 'apps', 'web');
const TOKEN_FILES = [
  path.join(ROOT, 'packages', 'ui', 'src', 'tokens.css'),
  path.join(ROOT, 'apps', 'web', 'index.css'),
];
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const UPDATE = process.argv.includes('--update-baseline');
const FORCE = process.argv.includes('--force');

const DEFAULT_COLOR_KEYS = new Set([
  'inherit',
  'current',
  'transparent',
  'black',
  'white',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
]);

const DEFAULT_SHADOW_KEYS = new Set([
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  'inner',
  'none',
]);

const TEXT_NON_COLOR_KEYS = new Set([
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'ellipsis',
  'clip',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
]);

const BORDER_NON_COLOR_KEYS = new Set([
  '0',
  '2',
  '4',
  '8',
  't',
  'r',
  'b',
  'l',
  'x',
  'y',
  'solid',
  'dashed',
  'dotted',
  'double',
  'hidden',
  'collapse',
  'separate',
]);

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(fullPath));
      continue;
    }
    if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function countLineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

function parseCssVariables() {
  const vars = new Set();
  const varRegex = /--([A-Za-z0-9_-]+)\s*:/g;
  for (const file of TOKEN_FILES) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = varRegex.exec(source))) {
      vars.add(match[1]);
    }
  }
  return vars;
}

function flattenColorKeys(input, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(input || {})) {
    if (key === '__esModule') continue;
    if (typeof value === 'string') {
      keys.add(prefix ? `${prefix}-${key}` : key);
      continue;
    }
    if (value && typeof value === 'object') {
      const nextPrefix = prefix ? `${prefix}-${key}` : key;
      if (typeof value.DEFAULT === 'string') {
        keys.add(nextPrefix);
      }
      for (const nestedKey of flattenColorKeys(value, nextPrefix)) {
        keys.add(nestedKey);
      }
    }
  }
  return keys;
}

function flattenShadowKeys(input) {
  return new Set(Object.keys(input || {}).filter((key) => key !== '__esModule'));
}

async function loadTailwindRegistry() {
  const configModule = await import(pathToFileURL(path.join(ROOT, 'tailwind.config.js')).href);
  const colorsModule = await import('tailwindcss/colors.js');
  const config = configModule.default || configModule;
  const tailwindColors = colorsModule.default || colorsModule;
  const configColors = config?.theme?.extend?.colors || {};
  const configShadows = config?.theme?.extend?.boxShadow || {};

  const namedColors = new Set();
  for (const key of flattenColorKeys(configColors)) namedColors.add(key);
  for (const root of DEFAULT_COLOR_KEYS) {
    if (tailwindColors[root]) {
      namedColors.add(root);
      if (typeof tailwindColors[root] === 'object') {
        for (const scale of Object.keys(tailwindColors[root])) {
          if (scale !== '__esModule') {
            namedColors.add(`${root}-${scale}`);
          }
        }
      }
    } else {
      namedColors.add(root);
    }
  }

  const namedShadows = new Set(DEFAULT_SHADOW_KEYS);
  for (const key of flattenShadowKeys(configShadows)) namedShadows.add(key);

  return { namedColors, namedShadows };
}

function isCommentOnly(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/')
  );
}

function getUtilityCore(token) {
  const core = token.includes(':') ? token.slice(token.lastIndexOf(':') + 1) : token;
  return core.trim();
}

function normalizeBorderToken(raw) {
  const parts = raw.split('-');
  if (parts.length > 1 && ['x', 'y', 't', 'r', 'b', 'l'].includes(parts[0])) {
    return parts.slice(1).join('-');
  }
  return raw;
}

function stripOpacity(token) {
  return token.split('/')[0];
}

function validateArbitraryUtility(core, cssVars) {
  const matches = [...core.matchAll(/var\(--([A-Za-z0-9_-]+)\)/g)];
  if (!matches.length) {
    return { valid: true };
  }
  const missing = matches
    .map((match) => match[1])
    .filter((variable) => !cssVars.has(variable));
  return missing.length
    ? { valid: false, reason: `undefined CSS var(s): ${missing.join(', ')}` }
    : { valid: true };
}

function validateNamedUtility(core, registries) {
  if (core.startsWith('bg-')) {
    const candidate = stripOpacity(core.slice(3));
    if (candidate.startsWith('gradient-to-')) return { valid: true, skip: true };
    if (registries.namedColors.has(candidate)) return { valid: true };
    return { valid: false, reason: `unregistered background color '${candidate}'` };
  }
  if (core.startsWith('text-')) {
    const candidate = stripOpacity(core.slice(5));
    if (TEXT_NON_COLOR_KEYS.has(candidate)) return { valid: true, skip: true };
    if (registries.namedColors.has(candidate)) return { valid: true };
    return { valid: false, reason: `unregistered text color '${candidate}'` };
  }
  if (core.startsWith('border-')) {
    const candidate = stripOpacity(normalizeBorderToken(core.slice(7)));
    if (BORDER_NON_COLOR_KEYS.has(candidate)) return { valid: true, skip: true };
    if (registries.namedColors.has(candidate)) return { valid: true };
    return { valid: false, reason: `unregistered border color '${candidate}'` };
  }
  if (core.startsWith('shadow-')) {
    const candidate = stripOpacity(core.slice(7));
    if (registries.namedShadows.has(candidate)) return { valid: true };
    return { valid: false, reason: `unregistered shadow token '${candidate}'` };
  }
  return { valid: true };
}

function parseLocalUtilityClasses() {
  const classes = new Set();
  const classRegex = /\.([A-Za-z0-9_-]+)\s*\{/g;
  for (const file of TOKEN_FILES) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = classRegex.exec(source))) {
      classes.add(match[1]);
    }
  }
  return classes;
}

function extractCandidates(file, source) {
  const relative = path.relative(ROOT, file).replace(/\\/g, '/');
  const entries = [];

  if (path.extname(file) === '.css') {
    source.split(/\r?\n/).forEach((line, index) => {
      if (!line.includes('@apply')) return;
      entries.push({
        line: index + 1,
        text: line.trim(),
        classText: line,
        file: relative,
      });
    });
    return entries;
  }

  const attrRegex =
    /className\s*=\s*(?:\{`([\s\S]*?)`\}|`([\s\S]*?)`|"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrRegex.exec(source))) {
    const classText = match[1] || match[2] || match[3] || match[4] || '';
    entries.push({
      line: countLineAt(source, match.index),
      text: classText.replace(/\s+/g, ' ').trim(),
      classText,
      file: relative,
    });
  }
  return entries;
}

function collectViolations(files, registries, cssVars, localClasses) {
  const counts = {};
  const examples = {};
  const lineViolations = [];
  const tokenRegex =
    /\b(?:[A-Za-z0-9_\-[\]\/]+:)*?(?:bg-\[[^\]]+\]|text-\[[^\]]+\]|border(?:-[trblxy])?-\[[^\]]+\]|shadow-\[[^\]]+\]|bg-[A-Za-z][A-Za-z0-9\-\/]*|text-[A-Za-z][A-Za-z0-9\-\/]*|border(?:-[trblxy])?-[A-Za-z][A-Za-z0-9\-\/]*|shadow-[A-Za-z][A-Za-z0-9\-\/]*)/g;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const candidates = extractCandidates(file, source);
    for (const candidate of candidates) {
      if (isCommentOnly(candidate.text)) continue;
      const matches = candidate.classText.match(tokenRegex) || [];
      for (const token of matches) {
        const core = getUtilityCore(token);
        if (!/^(bg-|text-|border-|shadow-)/.test(core)) continue;
        if (localClasses.has(core)) continue;
        const result = core.includes('[')
          ? validateArbitraryUtility(core, cssVars)
          : validateNamedUtility(core, registries);
        if (result.valid && !result.skip) continue;
        if (result.skip) continue;
        const key = core;
        counts[key] = (counts[key] || 0) + 1;
        if (!examples[key]) {
          examples[key] = `${candidate.file}:${candidate.line}:${candidate.text}`;
        }
        lineViolations.push({
          key,
          file: candidate.file,
          line: candidate.line,
          reason: result.reason,
          source: candidate.text,
        });
      }
    }
  }

  return { counts, examples, lineViolations };
}

function loadBudget() {
  if (!fs.existsSync(BUDGET_FILE)) return {};
  return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
}

function saveBudget(budget) {
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + '\n');
}

async function main() {
  const cssVars = parseCssVariables();
  const registries = await loadTailwindRegistry();
  const localClasses = parseLocalUtilityClasses();
  const files = listFiles(WEB_ROOT);
  const { counts, examples, lineViolations } = collectViolations(
    files,
    registries,
    cssVars,
    localClasses,
  );

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
      console.error('Refusing to raise phantom-class baseline for:');
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
    console.log('Phantom-class baseline updated.');
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
        example: examples[key] || '',
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
    console.error('Phantom Tailwind class budget exceeded:');
    for (const item of violations) {
      console.error(`  ${item.key}: ${item.count} > baseline ${item.base}`);
      if (item.example) console.error(`    example: ${item.example}`);
    }
    process.exit(1);
  }

  console.log('Phantom Tailwind class budget OK (all keys <= baseline).');
  if (lineViolations.length) {
    console.log(`Current phantom-class debt entries scanned: ${lineViolations.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
