// The GitHub repo's About text lives outside the repo (Settings → About),
// so no commit ever updates it; it drifted for weeks ("from 2D to 6D",
// with no 1D). This reads it through GitHub's API and checks it against
// scripts/stale-terms.json, the same list verify:copy guards the app's
// text with. It only warns (a GitHub Actions ::warning::), never fails:
// the fix is a Settings edit (or `gh repo edit --description`), not code.
import { readFileSync } from 'node:fs';

const repo = process.env.GITHUB_REPOSITORY ?? 'DICTOR-Master/rhombiverse';
const headers = { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) };
let about = '';
try {
  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  about = (await res.json()).description ?? '';
} catch (e) {
  console.log(`::warning::verify-about: couldn't read the About text (${e.message}); skipped.`);
  process.exit(0);
}
const stale = JSON.parse(readFileSync(new URL('./stale-terms.json', import.meta.url), 'utf8'));
let text = about.toLowerCase();
for (const a of stale.allow ?? []) text = text.split(a.toLowerCase()).join(' ');
const found = [...(stale.terms ?? []), ...(stale.appTerms ?? [])].filter((term) => new RegExp(`(^|[^a-z0-9])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text));
// Every dimension the app has should be named: from 1D.
if (!/\b1d\b/.test(text)) found.push('(no mention of 1D)');
console.log(`About: ${about}`);
if (found.length) console.log(`::warning::GitHub About text is out of date: ${found.join(', ')}. Update it in Settings → About, or: gh repo edit --description "…"`);
else console.log('About text: no stale terms.');
