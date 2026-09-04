// Production-only build: minifies src/**/*.js in place (same file
// structure, same relative imports, NO bundling across files) and copies
// every other static asset the client actually loads. Local dev is
// completely untouched by this -- README.md's "Running locally" section
// still means `python3 -m http.server` directly against the repo root,
// zero tooling required, exactly as before. This script only runs at
// Vercel build time (see vercel.json's buildCommand), producing `dist/`
// as the deployed static output.
//
// Why minify-only, not bundle: a real per-file measurement (2026-08-24,
// on the actual Pi500 this app is played on) found 51%+ of src/'s JS
// bytes were comments/blank lines (this codebase's own very heavily-
// commented style) -- esbuild's minifier alone cut real measured bytes
// 669,897 -> 178,482 (73.4%), zero errors, with the exact same module
// graph untouched. Bundling would add real risk (dynamic import() paths,
// the many files/call-sites throughout this codebase) for a much smaller
// additional win, since HTTP/2 already parallelizes the separate
// requests -- not worth it for what the actual profiled bottleneck was.
import { build } from 'esbuild';
import { mkdir, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

async function findJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await findJsFiles(full)));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // Static assets the client actually fetches -- everything else in the
  // repo (docs, tests, CI config, api/'s own source) is either not
  // client-servable or handled separately by Vercel (api/ serverless
  // functions deploy independent of the static outputDirectory).
  const staticEntries = ['index.html', 'rhombis.html', 'favicon.svg', 'assets', 'data', 'TERMS.md', 'PRIVACY.md', 'SECURITY.md'];
  for (const entry of staticEntries) {
    await cp(path.join(root, entry), path.join(dist, entry), { recursive: true });
  }

  const jsFiles = await findJsFiles(path.join(root, 'src'));
  await build({
    entryPoints: jsFiles,
    outbase: path.join(root, 'src'),
    outdir: path.join(dist, 'src'),
    minify: true,
    format: 'esm',
    bundle: false,
    logLevel: 'info',
  });

  console.log(`Built ${jsFiles.length} JS files into dist/src/, plus static assets, into dist/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
