#!/usr/bin/env node
/**
 * Fail on mojibake in tracked source.
 *
 * Encoding damage has reached this repo three times, three different ways: a
 * UTF-8 status template round-tripped through a non-UTF-8 layer until its emoji
 * became replacement characters; an em dash misread as cp1252 into a multi-byte
 * mess; and dropped characters replaced outright. Each was found by a human
 * reading a rendered surface, which is the slowest possible detector and only
 * works on surfaces someone happens to look at. The damage is trivially
 * greppable, so grep for it on every run instead.
 *
 * NOTE: the patterns below are built from character codes on purpose. Spelling
 * the damage literally makes this file match itself — which it did, and which
 * only surfaced once the file was committed and therefore inside its own scan
 * population. A detector has to be clean under its own detection.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const ch = (...codes) => String.fromCharCode(...codes);

// U+FFFD replacement character, and the classic cp1252-misread sequences.
const REPLACEMENT = ch(0xfffd);
const CP1252_LEAD_PUNCT = ch(0x00e2, 0x20ac); // UTF-8 punctuation read as cp1252
const CP1252_LEAD_ACCENT = ch(0x00c3); // accented Latin-1 read as cp1252
const CP1252_LEAD_SYMBOL = ch(0x00c2); // nbsp/©/® read as cp1252

const PATTERNS = [
  { re: new RegExp(REPLACEMENT), name: 'U+FFFD replacement character' },
  {
    re: new RegExp(CP1252_LEAD_PUNCT + '[' + ch(0x201c, 0x201d, 0x0022, 0x2122) + ']'),
    name: 'cp1252-misread punctuation',
  },
  {
    re: new RegExp(CP1252_LEAD_ACCENT + '[' + ch(0x00a9, 0x00a8, 0x00a2, 0x00a1, 0x00a3) + ']'),
    name: 'cp1252-misread accented letter',
  },
  {
    re: new RegExp(CP1252_LEAD_SYMBOL + '[' + ch(0x00a0, 0x00a9, 0x00ae, 0x00b0) + ']'),
    name: 'cp1252-misread symbol',
  },
];

const SKIP_DIRS = /(^|\/)(node_modules|dist|\.git|coverage|\.wrangler)(\/|$)/;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|pdf|zip|mp[34]|wasm|safetensors)$/i;

let files;
try {
  files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !SKIP_DIRS.test(f) && !BINARY_EXT.test(f));
} catch (err) {
  console.error('check-encoding: could not list tracked files —', err.message);
  process.exit(1);
}

const hits = [];
for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue; // unreadable or genuinely binary
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { re, name } of PATTERNS) {
      if (re.test(line)) {
        hits.push({ file, line: i + 1, name, text: line.trim().slice(0, 90) });
        break;
      }
    }
  });
}

if (hits.length === 0) {
  console.log(`check-encoding OK — ${files.length} tracked text files, no mojibake.`);
  process.exit(0);
}

console.error(`check-encoding FAILED — ${hits.length} site(s) of encoding damage:\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  [${h.name}]`);
  console.error(`    ${h.text}`);
}
console.error(
  '\nThese are almost always a UTF-8 file read or written as cp1252. Repair the\n' +
    'characters directly (an editor round-trip often re-breaks them) — or, if the\n' +
    'code is dead, delete it rather than lovingly restoring its emoji.',
);
process.exit(1);
