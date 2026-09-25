# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.
It describes the app as it is now. For how it got here, use `git log`;
nothing in this file is history.

## What this project is

Rhombiverse is a browser-based, Three.js spatial editor for real
space-filling lattices in **2D, 3D and 4D**, plus the 6D icosahedral
quasicrystal. It's the *landscape* view:
the lattice exists first, and you place one piece at a time wherever it
has room. Tap to add a piece, long-press (or right-click) to remove one,
and look at the build through several views (Lattice View, X-Ray,
Spherical, Duality, BCC Lattice, section view, 4D slice/projection).

Twin project: [Polyhedraverse](https://github.com/DICTOR-Master/polyhedraverse),
the *portrait gallery*, where shapes connect face to face or vertex to
vertex with no lattice at all.

The same repo also ships **RHOMBIS** (`rhombis.html`, `src/rhombis/`),
a standalone packing-puzzle game.

This is **not** `~/rhombispheres/` (an unrelated pygame arcade game that
used to be called rhombiverse). Don't cross-reference the two.

GitHub: https://github.com/DICTOR-Master/rhombiverse (`gh` is authenticated).
Live: https://rhombiverse.vercel.app

Planned next: 5D/6D quasicrystal worlds, agreed design and stages in
`docs/PLAN-5D-6D.md`.

## Scope guardrails

Rhombiverse is pure, deterministic geometry. Do not add, even partially,
without an explicit decision from the user:

- simulation of any kind: physics, gravity, growth, evolution, anything
  that changes over elapsed time rather than on user action;
- game systems: mining, inventory, trade, claims, avatars, walking;
- shared or networked state: multiplayer, sync, accounts, backends, AI calls;
- bulk-building tools (fill, dig, smooth, shells, repeat, sculpt). One
  piece at a time is the design.

`scripts/stale-terms.json` lists the retired vocabulary. `npm run
verify:copy` (in CI) fails if any of it reaches user-visible text.

UI rule: hide controls that don't apply; don't grey them out.

## Layout

See README.md → Structure. In short: `index.html` (the app),
`src/render.js` (scene, render loop, most UI wiring), `src/core/`
(lattice math, placement/removal input in `build.js`, world state,
persistence), `src/app/` (wheels, Wizard, 4D and 6D worlds, Almanac, settings,
i18n, welcome, guide, language picker), `src/geometry-extensions/` (every
lattice beyond FCC), `data/` (starter world, changelog), `docs/guide*.md`
(the user guide).

## Running and checking

- **Dev:** no build step. `python3 -m http.server 8000` in the repo root;
  plain ES modules with an import map, Three.js from a CDN.
- **Production:** Vercel runs `npm run build` (`scripts/build.mjs`):
  esbuild minifies each file in place into `dist/` (no bundling, same
  module graph) and copies the static files listed there. A new
  top-level static file must be added to that list.
- **Unit tests:** `node --test tests/unit/` (CI uses Node 20; on Node 22
  pass the files, `node --test tests/unit/*.test.mjs`).
- **Browser smoke test:** `tests/browser/smoke.mjs` against a served
  copy, raw source and `dist/` both, in CI.
- **Checks:** `npm run verify:i18n | verify:rhombis-i18n | verify:copy |
  verify:lattice-2d | verify:pyrochlore | verify:rhombohedra | verify:4d |
  verify:quasicrystal`.
- **Browser automation:** run Playwright on `dicto-node` (192.168.0.7,
  SSH), not the dev Pi. Sync first, with `--delete` for tests. Headless
  Chromium there can starve timers, so hold simulated long-presses 1.5 s+.
- After every push, check CI (`gh run list -L 1`) and fix a red run.

## Conventions that matter

- **The world is data.** Each lattice has its own JSON store, keyed
  `"x,y,z"`. FCC cells are integer `(x, y, z)` with `x + y + z` even;
  the 12 neighbour offsets are the `(±1, ±1, 0)` permutations
  (`src/core/lattice.js`). Other lattices use their own frames
  (see each `geometry-extensions/*.js` header).
- **Every store change goes through `persist()`** (render.js). That is
  what records undo history (per dimension, ↶ bottom right). A new store
  must also be registered in `registerHistoryStores()`, which makes it
  part of undo and of Export/Import World (a `world-bundle` of every
  registered store).
- **i18n:** 7 languages (`src/app/i18n.js`, `LANG_ORDER`). Tag static
  text with `data-i18n` / `data-i18n-html` / `data-i18n-title` so
  `applyTranslations()` re-translates it live on a language change; call
  `t(key, lang)` for dynamic text. Every key needs all 7 languages
  (`verify:i18n`). Language is one setting (`updateSettings({ language })`),
  shared by Settings and the 🌐 picker (`src/app/language-picker.js`).
- **User guide:** `docs/guide.md` (English) plus `docs/guide.<lang>.md`,
  served in-app (`src/app/guide.js`) and at `/guide?lang=`. Button names
  in a translation must match what the app shows in that language;
  untranslated UI stays in English. Change all 7 together.
  `src/app/markdown.js` is kept identical to Polyhedraverse's
  `app/lib/markdown.ts`.
- **What's New** (`data/changelog.json`): user-facing features only,
  newest first, added in the same push. No entries for fixes to things
  that should already have worked.
- **Touch first.** Every interaction must work by touch on iPhone/iPad.
  Long-press is 500 ms (`build.js`), with a guard against the click that
  iOS synthesizes afterwards. Mouse-only tests don't prove touch works.
- **Wheel labels move every frame**, which defeats Playwright's stability
  checks. In tests, drive the underlying control (e.g.
  `.mode-btn[data-mode=build]`), the keyboard, or raw touch/mouse events,
  not clicks on wheel labels.
- **Removing a feature means deleting it**: code, UI, strings, tests,
  docs. Git history is the archive. Don't leave comments that narrate
  what used to be there.
- **Design law** (`docs/RHOMBIVERSE_PRINCIPLES.md`): prefer real,
  established geometry over anything invented, and the simplest version
  that works.
