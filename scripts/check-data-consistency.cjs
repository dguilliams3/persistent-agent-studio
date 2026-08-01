#!/usr/bin/env node

/**
 * Data Consistency Checker
 *
 * Lightweight sanity checks for the codebase. Only flags definite issues,
 * not style preferences or things that require maintaining whitelists.
 *
 * NOTE: This checker was simplified 2026-01-21 after the previous version
 * produced many false positives by trying to maintain lists of "valid" patterns.
 *
 * Current checks:
 * 1. Duplicate export names
 * 2. Files importing from themselves
 * 3. Console.log statements in production code (optional, disabled by default)
 *
 * Run with: node scripts/check-data-consistency.cjs
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Set to true to flag console.log statements
  flagConsoleLogs: false,

  // Directories to scan
  srcDirs: ['src', 'worker/src'],

  // File extensions to check
  extensions: ['.js', '.jsx', '.ts', '.tsx']
};

/**
 * Check for actual issues in a file
 */
function checkFile(filePath) {
  const issues = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Check for file importing itself (definite bug)
      if (line.includes(`from './${fileName.replace(/\.[^.]+$/, '')}'`) ||
          line.includes(`from "./${fileName.replace(/\.[^.]+$/, '')}"`)) {
        issues.push({
          file: filePath,
          line: lineNumber,
          type: 'SELF_IMPORT',
          message: 'File imports from itself - this will cause circular dependency',
          lineContent: trimmedLine
        });
      }

      // Optional: flag console.log in production code
      if (CONFIG.flagConsoleLogs &&
          line.includes('console.log') &&
          !filePath.includes('test') &&
          !filePath.includes('spec')) {
        issues.push({
          file: filePath,
          line: lineNumber,
          type: 'CONSOLE_LOG',
          message: 'console.log statement in production code',
          lineContent: trimmedLine
        });
      }
    });

    // Check for duplicate exports in the same file
    const exportMatches = content.matchAll(/export\s+(?:const|let|var|function|class|async function)\s+(\w+)/g);
    const exports = {};
    for (const match of exportMatches) {
      const name = match[1];
      if (exports[name]) {
        issues.push({
          file: filePath,
          line: 0,
          type: 'DUPLICATE_EXPORT',
          message: `Duplicate export '${name}' - defined multiple times`,
          lineContent: ''
        });
      }
      exports[name] = true;
    }

  } catch (e) {
    // File read error, skip
  }

  return issues;
}

/**
 * Recursively find all source files
 */
function findFiles(dirs) {
  const files = [];

  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (!entry.name.startsWith('.') &&
              entry.name !== 'node_modules' &&
              entry.name !== 'dist' &&
              entry.name !== 'coverage') {
            scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (CONFIG.extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      });
    } catch (e) {
      // Directory doesn't exist or can't be read
    }
  }

  dirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      scanDir(dir);
    }
  });

  return files;
}

function main() {
  console.log('🔍 Checking data consistency...\n');

  const files = findFiles(CONFIG.srcDirs);

  if (files.length === 0) {
    console.log('⚠️  No files found to check. Running from project root?');
    process.exit(0);
  }

  console.log(`📂 Checking ${files.length} files...\n`);

  let allIssues = [];

  files.forEach(filePath => {
    const issues = checkFile(filePath);
    if (issues.length > 0) {
      console.log(`📁 ${filePath}:`);
      issues.forEach(issue => {
        console.log(`  ${issue.line}:${issue.type} - ${issue.message}`);
        if (issue.lineContent) {
          console.log(`    ${issue.lineContent}`);
        }
      });
      console.log('');
      allIssues.push(...issues);
    }
  });

  if (allIssues.length === 0) {
    console.log('✅ No data consistency issues found!');
    process.exit(0);
  } else {
    console.log(`❌ Found ${allIssues.length} data consistency issues:`);
    console.log('\n📋 Summary by type:');

    const byType = allIssues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, findFiles, CONFIG };
