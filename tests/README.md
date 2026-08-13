# Tests

Two independent suites, matching the two harnesses described in
`.claude/skills/browser-test-harness/SKILL.md` (this is their permanent,
committed form; that skill's harnesses were always throwaway/local).

## Unit tests (`unit/`)

Pure math/logic (`src/lattice.js`, `src/worldstate.js`, `src/regions.js`)
— none of these import `three` or touch the DOM. Zero npm dependencies;
`src/package.json`'s `"type": "module"` is the only thing needed so plain
Node treats `src/*.js` as ESM (deliberately scoped to `src/`, not the
repo root, so it can never affect how Vercel detects/builds this
project — still zero build step for the app itself).

```
node --test tests/unit/
```

## Browser smoke test (`browser/`)

A real Playwright browser driving the actual app — the one thing the
unit tests can't cover (rendering, real clicks, DOM state). Needs the
app served locally first, exactly as this repo's own `README.md`
describes:

```
python3 -m http.server 8000 &
cd tests/browser && npm install && npx playwright install chromium
node smoke.mjs
```

Both run automatically on every push/PR via `.github/workflows/ci.yml`.
