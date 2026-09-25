// Stale-copy guard (2026-09-24, direct request: retired world-building/
// game wording kept resurfacing despite repeated manual sweeps, because
// most matches live in code comments and bury the few real ones). Checks
// ONLY user-visible text -- string literals in shipped JS (comments
// stripped by esbuild first), HTML text/attributes (comments stripped),
// the README, and What's New -- against scripts/stale-terms.json.
import fs from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { terms, allow = [] } = JSON.parse(fs.readFileSync(path.join(root, 'scripts/stale-terms.json'), 'utf8'));
const re = new RegExp(`\\b(${terms.join('|')})\\b`, 'i');
const allowRe = allow.length ? new RegExp(allow.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}
// String literals of JS: esbuild drops most comments, then a small
// tokenizer walks what's left (it keeps a few comments inside object
// literals) and collects only real '...', "..." and `...` text --
// template ${...} expressions are skipped, not collected.
function jsStrings(code) {
  const src = transformSync(code, { loader: 'js', legalComments: 'none' }).code;
  const out = [];
  let i = 0;
  const n = src.length;
  function readTemplate() { // at the opening backtick
    let text = '';
    i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { text += src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { i += 2; skipCode('}'); continue; }
      text += src[i++];
    }
    i++;
    out.push(text);
  }
  function skipCode(close) { // code until an unmatched `close`, collecting nested strings
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; if (i < 2) i = n; continue; }
      if (c === "'" || c === '"') {
        let text = '';
        i++;
        while (i < n && src[i] !== c) { if (src[i] === '\\') { text += src[i + 1]; i += 2; continue; } text += src[i++]; }
        i++;
        out.push(text);
        continue;
      }
      if (c === '`') { readTemplate(); continue; }
      if (close && c === '{') depth++;
      if (close && c === close) { if (depth === 0) { i++; return; } depth--; }
      i++;
    }
  }
  skipCode(null);
  return out;
}

const hits = [];
const check = (file, text, where) => {
  const m = (allowRe ? text.replace(allowRe, '') : text).match(re);
  if (m) hits.push(`${path.relative(root, file)}${where ? ` (${where})` : ''}: "${m[0]}" in ${JSON.stringify(text.length > 140 ? `${text.slice(Math.max(0, m.index - 60), m.index + 60)}` : text)}`);
};

const jsFiles = [...walk(path.join(root, 'src')), ...(fs.existsSync(path.join(root, 'api')) ? walk(path.join(root, 'api')) : [])];
for (const f of jsFiles) for (const s of jsStrings(fs.readFileSync(f, 'utf8'))) check(f, s);

for (const f of fs.readdirSync(root).filter((n) => n.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  html.split('\n').forEach((line, i) => check(path.join(root, f), line, `line ${i + 1}`));
}

// README, the How-to guide, and the published legal/security pages
// (scripts/build.mjs ships them).
for (const f of ['README.md', 'docs/guide.md', ...['ja', 'es', 'fr', 'ko', 'zh', 'ru'].map((l) => `docs/guide.${l}.md`), 'TERMS.md', 'PRIVACY.md', 'SECURITY.md']) {
  if (!fs.existsSync(path.join(root, f))) continue;
  fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => check(path.join(root, f), line, `line ${i + 1}`));
}

for (const [i, e] of JSON.parse(fs.readFileSync(path.join(root, 'data/changelog.json'), 'utf8')).entries()) {
  for (const t of [e.title, ...(e.items ?? [])]) check(path.join(root, 'data/changelog.json'), t, `entry ${i}: ${e.date}`);
}

if (hits.length) {
  console.log(hits.join('\n'));
  console.log(`\n${hits.length} stale term(s) in user-visible text (see scripts/stale-terms.json).`);
  process.exit(1);
}
console.log('No stale terms in user-visible text.');
