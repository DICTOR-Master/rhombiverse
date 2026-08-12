---
name: browser-test-harness
description: Reconstruct the two direct-execution test harnesses used for this repo (Rhombiverse) when a bug or feature needs real verification rather than static code reading — a portable Node.js + real `three` package harness for pure lattice/raycast math (no WebGL/DOM), and a portable Python + Playwright harness for real browser rendering, clicks, and pointer lock. Use when static reading can't resolve a reported bug, or before trusting a new feature as working.
---

# Browser/Node test harness for Rhombiverse

This repo (`~/rhombiverse`) has no Node/browser tooling installed by
default and is deliberately build-tool-free (see CLAUDE.md's "No build
step, by design"). Both harnesses below are throwaway, built outside the
repo, and proven reusable across multiple sessions this project has had.
Reach for direct execution before theorizing further when a bug can't be
resolved by reading code — it has found real gaps (and disproven
reported bugs) that static reading missed.

## Harness 1: Node + real `three` package (pure math, no WebGL/DOM)

For anything in `lattice.js`/`worldstate.js`/`build.js` — raycast math,
mode dispatch, cell mutation — that's pure CPU-side logic with no
rendering dependency.

1. Download a portable Node.js binary (no root available; `nodejs.org`
   release tarball extracted to a scratch dir, not this repo — no
   `apt`/`npm install` needed).
2. In a scratch npm project (also outside this repo), `npm install
   three@0.185.1` (match the version pinned in `index.html`'s import
   map).
3. **The real `src/*.js` files need `node_modules` findable via Node's
   own resolution from their location** — `import * as THREE from
   'three'` in `build.js` resolves relative to `build.js`, not the test
   script. A symlink `~/rhombiverse/node_modules -> <scratch>/node_modules`
   makes that work, and **must be removed again after testing** — it's
   `.gitignore`d, but isn't part of this repo's actual structure.
4. Import the real `src/*.js` files via absolute paths and exercise them
   directly. `Raycaster`, `InstancedMesh.raycast()`, `ConvexGeometry` etc.
   are pure CPU-side math with no WebGL/DOM dependency, so this exercises
   real ray-triangle intersection, not a mock. A real `EventTarget` (Node
   global) stands in for `renderer.domElement`; `new Event('click')` with
   `clientX`/`clientY` assigned as plain properties stands in for a
   browser click; project the target cell's world position through the
   real camera matrices to find the correct screen coordinate to click,
   rather than guessing pixel values.

Two established test patterns:
- **Full raycast + real click dispatch** (`test-fill.mjs`-style) — for
  anything touching `matchNeighborOffset`/mode dispatch.
- **Mock DOM elements + a verbatim copy of the specific `render.js` logic
  under test** (`test-modeui.mjs`/`test-undo.mjs`-style) — for pure
  DOM-wiring logic that doesn't need real geometry.

## Harness 2: Python + Playwright (real rendering, clicks, pointer lock)

For anything Harness 1 can't reach — actual WebGL rendering, pointer
lock, or real click/keyboard dispatch against a live page. This
environment has no system Chromium and no passwordless `sudo`, so
installing a system browser isn't an option.

1. Create a throwaway Python venv (in the session scratchpad, not this
   repo): `python3 -m venv <scratch>/pwenv`.
2. `pip install playwright` then `playwright install chromium` — no sudo
   needed. Downloads its own Chromium build to `~/.cache/ms-playwright`.
   **That cache persists across sessions** (it's under `$HOME`); only the
   venv itself is ephemeral, so a future cold session can recreate the
   venv and skip the ~200MB browser download if the cache is still
   present.
3. Serve the repo: `python3 -m http.server 8000` (kill any prior listener
   on that port first: `lsof -ti:8000 -sTCP:LISTEN | xargs -r kill`).
4. Drive a real page load with Playwright — `page.goto`, real clicks,
   real keyboard/mouse input, `page.screenshot()` for visual confirmation,
   `page.on('console', ...)`/`page.on('pageerror', ...)` to catch runtime
   errors.

Known Chromium/CDP limitation: a CDP-synthetic Escape keydown does **not**
release pointer lock (the browser's native "Escape exits pointer lock"
shortcut is tied to genuine trusted input and doesn't fire from
automation — not an app bug; real physical Escape presses do trigger it).
Call `document.exitPointerLock()` directly via `page.evaluate()` to
simulate what a real Escape does at the browser-chrome level instead.
