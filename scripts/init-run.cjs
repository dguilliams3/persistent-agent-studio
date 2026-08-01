#!/usr/bin/env node
/**
 * @description Initialize a new RUN directory with proper structure and templates.
 *
 * Usage:
 *   node scripts/init-run.cjs <slug>
 *   node scripts/init-run.cjs fix-auth-bug
 *   node scripts/init-run.cjs add-telegram-command
 *
 * Creates:
 *   runs/RUN-YYYYMMDD-HHMM-<slug>/
 *   ├── TASK_LOG.md          (from template)
 *   ├── SPEC_v1.md           (from template)
 *   └── subagents/           (empty directory)
 *
 * @upstream Called manually by developers/agents starting new tasks
 * @downstream Creates files in runs/ directory
 */

const fs = require('fs');
const path = require('path');

// Get project root (parent of scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RUNS_DIR = path.join(PROJECT_ROOT, 'runs');
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'docs', 'templates');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getTimestamp() {
  const now = new Date();
  // Convert to Eastern Time
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const year = eastern.getFullYear();
  const month = String(eastern.getMonth() + 1).padStart(2, '0');
  const day = String(eastern.getDate()).padStart(2, '0');
  const hours = String(eastern.getHours()).padStart(2, '0');
  const minutes = String(eastern.getMinutes()).padStart(2, '0');

  return {
    runId: `${year}${month}${day}-${hours}${minutes}`,
    formatted: `${year}-${month}-${day} ${hours}:${minutes} EST`
  };
}

function validateSlug(slug) {
  if (!slug) {
    return { valid: false, error: 'Slug is required' };
  }

  // Check format: lowercase, hyphen-separated, 3-5 words
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return {
      valid: false,
      error: 'Slug must be lowercase, hyphen-separated, start with letter, end with letter/number'
    };
  }

  const words = slug.split('-');
  if (words.length > 6) {
    return {
      valid: false,
      error: 'Slug should be 3-5 words max (6 allowed for descriptive names)'
    };
  }

  return { valid: true };
}

function loadTemplate(templateName) {
  const templatePath = path.join(TEMPLATES_DIR, templateName);

  if (!fs.existsSync(templatePath)) {
    log(`Warning: Template not found: ${templatePath}`, 'yellow');
    return null;
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

function processTemplate(template, replacements) {
  let processed = template;

  for (const [key, value] of Object.entries(replacements)) {
    // Replace {{KEY}} and [KEY] patterns
    processed = processed.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    processed = processed.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  }

  // Replace YYYYMMDD-HHMM pattern
  if (replacements.RUN_ID) {
    processed = processed.replace(/RUN-YYYYMMDD-HHMM/g, `RUN-${replacements.RUN_ID}`);
  }

  // Replace date patterns
  if (replacements.TIMESTAMP) {
    processed = processed.replace(/YYYY-MM-DD HH:MM EST/g, replacements.TIMESTAMP);
  }

  return processed;
}

function createRunDirectory(slug) {
  const { runId, formatted } = getTimestamp();
  const dirName = `RUN-${runId}-${slug}`;
  const runPath = path.join(RUNS_DIR, dirName);

  // Check if directory already exists
  if (fs.existsSync(runPath)) {
    log(`Error: Directory already exists: ${dirName}`, 'red');
    log('Wait a minute and try again, or use a different slug.', 'yellow');
    process.exit(1);
  }

  // Create main directory
  fs.mkdirSync(runPath, { recursive: true });
  log(`Created: ${dirName}/`, 'green');

  // Create subagents directory
  const subagentsPath = path.join(runPath, 'subagents');
  fs.mkdirSync(subagentsPath);
  log(`Created: ${dirName}/subagents/`, 'cyan');

  // Template replacements
  const replacements = {
    RUN_ID: runId,
    SLUG: slug,
    TIMESTAMP: formatted,
    'Task Title': `[Task Title - ${slug.replace(/-/g, ' ')}]`
  };

  // Create TASK_LOG.md
  const taskLogTemplate = loadTemplate('TASK_LOG_template.md');
  if (taskLogTemplate) {
    const taskLogContent = processTemplate(taskLogTemplate, replacements);
    fs.writeFileSync(path.join(runPath, 'TASK_LOG.md'), taskLogContent);
    log(`Created: ${dirName}/TASK_LOG.md`, 'green');
  } else {
    // Fallback minimal TASK_LOG
    const fallbackTaskLog = `# Task Log: RUN-${runId} - [Task Title]

**Created:** ${formatted}
**Status:** IN_PROGRESS
**Working Directory:** runs/${dirName}/

---

## Objective

[Clear statement of what needs to be accomplished]

---

## Progress Timeline

### ${formatted} - Task Started
- Generated Run ID: RUN-${runId}
- Created working directory

---

## Files Created/Modified

- (none yet)

---

## Blockers (Tech Debt Discovered)

N/A

---

## Don't Retry (Failed Approaches)

N/A

---

## Summary

[Final summary when task is complete]
`;
    fs.writeFileSync(path.join(runPath, 'TASK_LOG.md'), fallbackTaskLog);
    log(`Created: ${dirName}/TASK_LOG.md (fallback template)`, 'yellow');
  }

  // Create SPEC_v1.md
  const specTemplate = loadTemplate('SPEC_template.md');
  if (specTemplate) {
    const specContent = processTemplate(specTemplate, replacements);
    fs.writeFileSync(path.join(runPath, 'SPEC_v1.md'), specContent);
    log(`Created: ${dirName}/SPEC_v1.md`, 'green');
  } else {
    // Fallback minimal SPEC
    const fallbackSpec = `# SPEC_v1: [Task Title]

**RUN_ID:** RUN-${runId}
**Created:** ${formatted}
**Status:** Active

---

## Objective

[Clear goal statement]

---

## Scope

### In Scope
- [Deliverable 1]

### Out of Scope
- [Not included]

---

## Approach

[High-level strategy]

---

## Success Criteria

- [ ] [Criterion 1]

---

## Don't Retry (Anti-Patterns)

N/A
`;
    fs.writeFileSync(path.join(runPath, 'SPEC_v1.md'), fallbackSpec);
    log(`Created: ${dirName}/SPEC_v1.md (fallback template)`, 'yellow');
  }

  // Summary
  console.log();
  log('=' .repeat(60), 'cyan');
  log(`${colors.bold}RUN directory initialized successfully!${colors.reset}`, 'green');
  log('=' .repeat(60), 'cyan');
  console.log();
  log(`Directory: runs/${dirName}/`, 'reset');
  log(`Run ID:    RUN-${runId}`, 'reset');
  log(`Timestamp: ${formatted}`, 'reset');
  console.log();
  log('Next steps:', 'yellow');
  log('  1. Update TASK_LOG.md Objective section', 'reset');
  log('  2. Fill out SPEC_v1.md with scope and approach', 'reset');
  log('  3. Start working and log progress in TASK_LOG.md', 'reset');
  console.log();

  return dirName;
}

// Main
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(`
${colors.bold}init-run.cjs${colors.reset} - Initialize a new RUN directory

${colors.cyan}Usage:${colors.reset}
  node scripts/init-run.cjs <slug>

${colors.cyan}Examples:${colors.reset}
  node scripts/init-run.cjs fix-auth-bug
  node scripts/init-run.cjs add-telegram-command
  node scripts/init-run.cjs refactor-action-parser

${colors.cyan}Creates:${colors.reset}
  runs/RUN-YYYYMMDD-HHMM-<slug>/
  ├── TASK_LOG.md
  ├── SPEC_v1.md
  └── subagents/

${colors.cyan}Slug requirements:${colors.reset}
  - Lowercase letters, numbers, and hyphens only
  - Start with a letter, end with letter/number
  - 3-5 words recommended (max 6)

${colors.cyan}Templates:${colors.reset}
  docs/templates/TASK_LOG_template.md
  docs/templates/SPEC_template.md
`);
    process.exit(0);
  }

  const slug = args[0].toLowerCase();

  // Validate slug
  const validation = validateSlug(slug);
  if (!validation.valid) {
    log(`Error: ${validation.error}`, 'red');
    process.exit(1);
  }

  // Check runs directory exists
  if (!fs.existsSync(RUNS_DIR)) {
    log(`Error: runs/ directory not found. Are you in the project root?`, 'red');
    process.exit(1);
  }

  // Create the RUN directory
  createRunDirectory(slug);
}

main();
