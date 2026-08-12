# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in
this repository. Written for a future Claude Code session with no memory of
the conversation that scaffolded this repo, so it can pick up cold.

## What this project is

Rhombiverse is a browser-based, Three.js voxel-style world-builder where the
"voxel" is a **rhombic dodecahedron (RD)**, packed via the real FCC lattice.
Players build outward face-by-face from a seed cell; the world is stored as
plain JSON, not baked geometry, so any renderer/client/future backend can
read and write it. See `RHOMBIVERSE_PLAN.md` section 0 (Meta-Paradigm) and
section 6 (Vision Statement) before touching anything else in this repo —
they're short and everything downstream assumes you've read them.

**This is a different project from `~/rhombispheres/`** (formerly named
`rhombiverse` until 2026-08-11, when it was renamed to free up this name).
`~/rhombispheres/` is an unrelated Python/pygame arcade game (DICTOROIDS-
family hemisphere-capture levels). Same brand word, nothing else shared —
don't cross-reference code or specs between the two repos.

**GitHub**: private repo at https://github.com/DICTOR-Master/rhombiverse
(account `DICTOR-Master`, `gh` already authenticated).

## Current status (as of 2026-08-11)

**Phase 1 (renderer + lattice math, no interactivity) is implemented.**
`src/lattice.js` has the FCC coordinate math (`isValidCell`, 12
`NEIGHBOR_OFFSETS`, `cellKey`/`parseCellKey`, `cellToWorld`) and the RD raw
vertex set — ported directly from `~/rhombicroid/geometry.py`'s
`CUBE_VERTS + OCTA_VERTS*2` formula (the same one already proven across
all six built `~/rhombispheres/` levels), not re-derived from scratch.
`src/worldstate.js` loads and flattens `data/starter-world.json`.
`src/render.js` builds one RD's triangulated geometry via Three.js's
`ConvexGeometry` (the JS equivalent of the `scipy.ConvexHull` step
`build_polyhedron` uses in the Python sibling projects — Phase 1 only
needs triangles for rendering, not `build_polyhedron`'s merged N-gon
faces, which are a physics-layer concern this project doesn't have yet),
renders it via `InstancedMesh` for every cell in the loaded world, and
orbits it with `OrbitControls`. `persistence.js` remains a stub (Phase 3).

**Phase 1 visually verified, 2026-08-11** — no Node/browser/screenshot
tooling in this environment, so the user confirmed rendering/orbiting in
a real browser from a separate machine/terminal.

**Phase 2 (build tool) is implemented, NOT yet visually verified.**
`src/build.js` raycasts against the `InstancedMesh`; left-click on a face
adds the corresponding neighbor cell (matching the hit's flat face normal
against the 12 `NEIGHBOR_OFFSETS` directions — every RD face's outward
normal points exactly along its neighbor direction, since the RD is the
FCC lattice's own Voronoi cell, so no per-instance transform is needed),
right-click removes the clicked cell. `src/worldstate.js` gained
`createWorldStore` (an in-memory `Map`-backed store with
`has`/`addCell`/`removeCell`/`entries`) to back this — Phase 3 will add
persistence on top, not replace this store. `render.js` now allocates the
`InstancedMesh` at a fixed capacity (`MAX_CELLS = 4096`) and re-syncs
`mesh.count`/instance matrices on every world-state change via
`rebuildInstances`. `OrbitControls`' right-mouse-button pan is disabled
(`controls.mouseButtons.RIGHT = null`) so right-click is unambiguous for
removal — confirmed safe by reading `OrbitControls`' own source (an
unrecognized `mouseButtons` value falls through to a no-op, doesn't
error). **Touch (tap / long-press) is explicitly not implemented** —
mouse only, documented as a known gap in `build.js` rather than a
half-working touch handler.

**Real bug found and fixed, 2026-08-11: RD size was 2x too large for the
lattice spacing, causing built cells to visibly overlap.** The user
confirmed click-to-remove worked in a real browser, but newly-built
neighbor cells overlapped their neighbors instead of tiling flush. Root
cause: `rdRawVerts` ported `geometry.py`'s raw `CUBE_VERTS`(±1)/
`OCTA_VERTS`(±2) constants directly, but those are scaled for
rhombicroid's own `WORLD_SCALE=8.0` flight arena, not for tiling against
this lattice's unit `NEIGHBOR_OFFSETS` (e.g. `(1,1,0)`, magnitude √2).
Solved by treating the RD as literally what it is — this FCC lattice's
own Voronoi cell — and solving where 3 adjacent perpendicular-bisector
planes of the neighbor offsets meet (e.g. `x+y=1, x+z=1, y+z=1` →
`(0.5,0.5,0.5)`): correct cube-vertex magnitude is `0.5*s`, octa-vertex
`1.0*s`, i.e. exactly **half** of geometry.py's raw values, though the
cube:octa 2:1 *ratio* itself (the shape) was already correct. Fixed in
`lattice.js`'s `rdRawVerts`. **Not yet re-confirmed visually after this
fix** — hard-refresh and confirm cells now tile flush with no gap or
overlap before trusting this as resolved.

**Second real bug found and fixed, 2026-08-11: only cells near the very
first click could ever be built.** Confirmed after the tiling fix above:
tiling itself was correct, but the user could not place all 12 neighbors
around one seed cell — most clicks silently did nothing. Root cause,
found by reading three.js's own `InstancedMesh.raycast()` source directly
rather than guessing: it pre-checks the ray against `this.boundingSphere`
before testing any instance, but only computes that sphere **lazily,
once** (`if (this.boundingSphere === null) this.computeBoundingSphere()`)
— it is never auto-invalidated when `mesh.count` grows or instances move.
The first-ever raycast call froze a tiny sphere around whatever few cells
existed at that moment; every later click outside that stale sphere was
dropped before per-instance testing ever ran, regardless of `mesh.count`.
Fixed by calling `mesh.computeBoundingSphere()` at the end of every
`rebuildInstances()` call in `render.js`, so the cached sphere always
reflects the current instance set. **Not yet re-confirmed visually** —
after hard-refreshing, try ringing all 12 faces of the seed cell with
neighbor cells before trusting this as resolved.

**Shell fill tool — implemented 2026-08-11, early/out-of-sequence at the
user's request.** Clarified: not a rendering/skin feature at all — the
user wants a shortcut to build near-spherical planetoid shapes using the
lattice's own shell structure ("wrap one cell with 12 and so on
outwards"). This is exactly Phase 5.5's "fill sphere" tool from
`RHOMBIVERSE_PLAN.md`, pulled forward. `lattice.js`'s `cellsInShells(cx,
cy, cz, maxShell)` does a BFS outward through `NEIGHBOR_OFFSETS`,
returning every cell in shells 1..maxShell as `{x, y, z, shell}` —
verified against `shellCount(n) = 10n²+2`
(`docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` section 3) before shipping
since no Node/browser was available to run it directly: BFS shell sizes
matched the formula exactly through n=6. **Shift+click** an existing cell
(instead of a plain click) fills that many shells around it via
`build.js`; a small on-page number input (`#shell-count` in `index.html`)
sets the shell count. Each filled cell stores its `shell` number in
world-state, and `render.js` uses it to tint instances by shell distance
via `InstancedMesh.setColorAt` (confirmed via three.js source that
`USE_INSTANCING_COLOR` activates automatically once any `setColorAt` call
exists — no `material.vertexColors` flag needed). Cells without a `shell`
(plain single-clicks, the original seed) render untinted (white
multiplier = no change to the base material color). `MAX_CELLS` was
raised from 4096 to 20000 to leave headroom for shell-fills (cumulative
cells through shell 8 alone is ~2057). **Not yet visually verified** —
after hard-refreshing, Shift+click the seed cell and confirm 12
same-colored neighbor cells appear, and that increasing the shell-count
input and Shift+clicking again adds a second, differently-tinted ring
outward.

**Real bug found and fixed, 2026-08-11: a second Shift+click built a new,
unrelated cluster instead of growing the first one.** User confirmed
shell-fill worked and tinted correctly on the first click, but clicking
again (with a bigger N, expecting the sphere to grow) instead built
another same-sized group next door. Root cause: every Shift+click treated
whatever cell was clicked as a brand-new center, with no memory of which
structure it belonged to. Fixed by tagging every shell-filled cell
(including the original center, retroactively, on first fill) with a
`shellCenter` field — the stringified coordinate of its structure's true
origin. A later Shift+click checks the clicked cell for an existing
`shellCenter`: if present, it re-runs `cellsInShells` from that stored
center (not the clicked cell), so growth compounds around the same
origin; new cells inherit the same `shellCenter` so the chain continues
correctly on a third, fourth, etc. click. If absent (an untagged plain
cell), the clicked cell becomes a new center, same as before — so
Shift+clicking an unrelated cell still starts a separate structure, which
is correct. Already-placed cells are never re-added or reshuffled, only
gaps between the old and new radius get filled. **Visually confirmed,
2026-08-11** — user confirmed growth compounds correctly up through 10
shells on the same structure.

**Phase 3 (local persistence) is implemented and visually confirmed,
2026-08-11** — user confirmed persistence-across-refresh, Export/Import
round-tripping, and New World's reset all work. `persistence.js` gained
`saveToLocalStorage`/
`loadFromLocalStorage` (JSON in/out of `localStorage`, wrapped in
try/catch since a quota-exceeded failure shouldn't break building —
real risk given `MAX_CELLS=20000`-scale worlds, not hypothetical),
`clearLocalStorage`, `exportWorldFile` (Blob + synthetic anchor download,
no library), and `importWorldFile` (reads a `File`, resolves to parsed
JSON, throws on invalid JSON for the caller to handle as a user-facing
error rather than a crash). `worldstate.js`'s `createWorldStore` gained
`toJSON()` (serializes back to the full section-3 shape, refreshing
`meta.lastModified`) and `replaceAll(newWorldJSON)` — mutates the
**same** store object in place rather than requiring a new one, so
`build.js`'s already-wired closures keep working after a reset/import
without any re-wiring. `render.js`: `init()` now loads from
`localStorage` first, falling back to `starter-world.json` only if
nothing is saved yet; every `onChange` (add/remove/shell-fill) both
re-renders and re-saves; three new buttons in `index.html`'s `#controls`
overlay — **New World** (confirm-gated, since it's destructive; clears
storage and reloads the static seed), **Export JSON** (downloads the
current world), **Import JSON** (file picker, replaces the world,
alerts on invalid JSON rather than silently failing).

**Three more planetoid tools added, 2026-08-11, at the user's request —
NOT yet visually verified.** All build on the shell-fill tool above,
still ahead of Phase 5.5's own planned scope:

- **Material picker.** A `#material-select` dropdown in `index.html`
  (values: `base`, `garnet`, `ferrostone`, `glassite`, `star-glassite`,
  `blackstar-glassite`, `ice99`, `water` — the exact strings used in the
  specs' own JSON examples) replaces the hardcoded `material: 'base'` in
  both the single-click add and shell-fill paths in `build.js`. Cosmetic
  only for now — `render.js`'s `MATERIAL_COLORS` gives each a base tint,
  applied via `setColorAt` (shared `InstancedMesh` material color is now
  white, an identity multiplier, so per-instance color shows through
  unmodified). No material has functional behavior yet (gravity/
  hydrosphere are Phase 5.5+). Shell tint (existing) now blends 35% into
  the material color rather than replacing it, so both are visible at
  once.
- **Hollow-shell fill.** `cellsInShells` (`lattice.js`) gained a
  `minShell` parameter (default 1 = old solid-fill behavior). A new
  `#hollow-from` input lets Shift+click fill only shells
  `hollow-from..radius`, leaving the interior empty — a crust instead of
  a solid ball.
- **Round/sculpt tool.** Ctrl+click (Cmd on Mac) a shell-tagged cell to
  "round" that structure. Real insight behind why this is needed, checked
  numerically before implementing (not assumed): a single BFS shell spans
  a wide range of true Euclidean distances from center — shell 6 ranges
  6.0 to 8.485 world units, wider than the ~1.15-unit average spacing
  *between* shells — so a shell-filled sphere's boundary is genuinely
  faceted, not just visually rough. `roundStructure` (`build.js`)
  reselects the outer boundary by true distance instead of shell number:
  computes the outer shell's average distance from center as a target
  radius, trims any cell beyond `target + 0.75` (cuts the "points"), and
  fills any gap within `target ± 0.75` using `cellsInShells(..., maxShell
  + 1)` as the candidate pool (extended by one shell since shells overlap
  in raw distance — shell 5's max, 7.071, already exceeds shell 6's min,
  6.0). Never touches cells well inside the target radius, so a
  hollow-shell structure's interior survives a round pass untouched. Gap
  fills reuse the outer shell's own majority material rather than
  reverting to `base`. `0.75` is a tunable heuristic, not derived —
  consistent with how other numeric constants are handled throughout the
  specs (e.g. the gravity spec's shell-tolerance and cooldown values).
- **Excavate tool.** `excavateStructure` (`build.js`) removes every cell
  in an existing structure with `shell` below the current "Hollow from
  shell" UI value, leaving the center and everything at or above that
  shell intact — for hollowing out something already built solid (the
  hollow-fill option above only skips filling the interior on a *new*
  fill, it can't retroactively carve an existing one).

**Interaction model replaced with an explicit mode selector, 2026-08-11
— superseding everything above about Shift/Ctrl/Ctrl+Shift+click.** User
feedback, verbatim reasoning worth preserving: five behaviors triggered
by modifier-key combinations on one "click" gesture — including two
pairs of literal opposites (fill vs. excavate, add vs. remove) one
keystroke apart — became unmanageable; user couldn't tell what was
broken vs. just hard to keep straight ("seemingly all can't separate to
understand what is wrong"). Replaced with **four mode buttons**
(`.mode-btn[data-mode]` in `index.html`: Build/Fill/Round/Excavate,
exactly one `.active` at a time) — a plain click now does whatever the
selected mode does, dispatched in `build.js`'s `onClick` via `getMode()`
returning `'build'|'fill'|'round'|'excavate'`, no modifier keys anywhere.
**Right-click stays a universal remove in every mode** — deliberately
NOT folded into the mode system, per direct instruction, since it's the
single most common corrective action and shouldn't require a mode
switch. The underlying algorithms (`cellsInShells`, `roundStructure`,
`excavateStructure`) are unchanged; only how they're triggered changed.

**Section view + onion-skin shells, 2026-08-11, NOT yet visually
verified.** Added because the shell system was invisible from outside a
solid structure — impossible to verify what fill/round/excavate actually
did, likely a real contributor to the interaction-model confusion above.
Two independent, composable filters:
- **Section view** (`#section-enable` + `#section-axis`/`#section-pos`/
  `#section-flip checkbox`): a single `THREE.Plane` cutaway, GPU-side via
  `material.clippingPlanes` (`renderer.localClippingEnabled = true` is
  required once, globally, for any clipping to take effect — easy to
  silently no-op without it). `updateSectionPlane()` in `render.js`
  rebuilds the plane via `setFromNormalAndCoplanarPoint` on every
  input change — the plane's *position* (a point on it, always
  `axisVec * pos`) and its *normal direction* (flips which side is kept
  vs. clipped) are computed separately and must stay that way: an early
  version incorrectly folded the flip into the position calculation too,
  which would have shifted the plane's location depending on flip state
  instead of just which side it clips. No rebuild needed when this
  changes — clipping is a per-fragment GPU test, picked up automatically
  next frame.
- **Onion-skin shells** (`#onion-min`/`#onion-max`): a per-cell JS filter
  in `visibleCells()` (`render.js`) — cells with no `shell` (plain
  clicks, the seed) always show regardless of range; shell-tagged cells
  outside `[min, max]` are excluded from `rebuildInstances`' instance
  set entirely, so they're both invisible AND unclickable, not just
  hidden. View-only: never touches `world` data, so `round`/`excavate`
  (which read `world.entries()` directly, not the filtered `cellOrder`)
  still see and operate on the true full structure regardless of what's
  currently visible on screen.

**Not yet visually verified** — after hard-refreshing: click each mode
button and confirm a plain click does the right thing per mode (Build
adds one cell; Fill/Round/Excavate act on shell-tagged structures using
the shell inputs); confirm right-click still removes regardless of which
mode is active; enable Section view and drag the position slider to
confirm a visible cutaway through the structure; narrow the onion-skin
range on a shell-filled sphere and confirm only that shell band renders
(and that clicking elsewhere on the hidden structure does nothing).

**Real bug fixed, 2026-08-11: shell-number inputs had inconsistent,
purely cosmetic caps.** User noticed shells went up to 100 on one input
but only 10 on another. Root cause was worse than a display
inconsistency: `#shell-count`/`#hollow-from` had `max="10"` in HTML,
`#onion-min`/`#onion-max` had no `max` at all (999 default value) — and
none of the four were actually *enforced* in JS. An HTML `max` on a
number input is purely a validation hint; typing past it does nothing.
`getShellCount()` had no upper clamp at all, so a typed value like `100`
would genuinely attempt to fill through shell 100 (~200k+ cells) against
a 20000-cell `MAX_CELLS` budget. Fixed by adding `MAX_SHELL = 15`
(`render.js`) — cumulative cells through shell 15 is 12431, leaving real
headroom under `MAX_CELLS` — and real-clamping `getShellCount()` to it
(`getMinShell()` was already bounded transitively via `Math.min(...,
getShellCount())`). **Onion-min/max are deliberately NOT clamped in JS**
despite getting the same `max="15"` HTML hint for visual consistency —
they're a safe display filter, not a cell generator, and clamping them
would make shells from an Import JSON world (potentially built before
`MAX_SHELL` existed, or hand-edited) permanently unviewable rather than
just unbuildable-from-scratch in this session. Onion-max's default value
also changed from the arbitrary `999` placeholder to `15`, matching the
real ceiling rather than an arbitrary "big enough" number.

**Real testing infrastructure established, 2026-08-11 — use this before
guessing at future bugs.** User reported "Fill mode only removes cells,"
reproducible even in a fresh private-browsing window. Static code
reading found nothing (correctly — see below). Rather than keep
guessing, downloaded a portable Node.js binary (no root available;
`nodejs.org` release tarball extracted to a scratch dir, no `apt`/`npm`
install needed) and `npm install three@0.185.1` in a scratch project,
then imported the REAL `lattice.js`/`worldstate.js`/`build.js` (via
absolute paths) against the real npm `three` package — `Raycaster`,
`InstancedMesh.raycast()`, `ConvexGeometry` etc. are pure CPU-side math
with no WebGL/DOM dependency, so this exercises real ray-triangle
intersection, not a mock. A real `EventTarget` (Node global) stands in
for `renderer.domElement`; `new Event('click')` with `clientX`/`clientY`
assigned as plain properties stands in for a browser click; the seed
cell's world position is projected through the real camera matrices to
find the correct screen coordinate to click, rather than guessing pixel
values. **Result: Fill mode was, and is, 100% correct** — a simulated
fill-mode click on the seed produced exactly 147 cells (1 + 12 + 42 +
92, matching shells 1–3 exactly), fully tagged. The reported bug was
never reproduced through the actual code path; root cause (if any)
remains external to `lattice.js`/`worldstate.js`/`build.js`'s mode
dispatch. **This harness is reusable** — when a future bug report can't
be resolved by reading code, reach for direct execution before
theorizing further; it found a real gap (see the `onCellClicked` fix
below) that static reading had missed, in the same session that also
proved the reported bug wasn't there.

To reconstruct the harness, use the `browser-test-harness` skill
(`.claude/skills/browser-test-harness/SKILL.md`) — Harness 1 there.

**UI complexity feedback led to a real redesign, 2026-08-11 — several
rounds, each grounded in something concrete, not vibes:**
1. First complaint ("too complicated appearance all options seem
   available at same time") → contextual mode UI: `updateModeUI()`
   shows/hides `#material-row`/`#shell-radius-row`/`#hollow-from-row`
   per active mode, and `#mode-hint` states in plain language what a
   click currently does (see `MODE_HINTS`). Verified via
   `test-modeui.mjs` mock-DOM test before shipping: all four modes show
   exactly the intended rows.
2. Direct request ("onion ring model as a standard view... select rings
   to remove... undo button clearly visible") → **removed** the
   onion-skin `#onion-min`/`#onion-max` view-only filter entirely
   (superseded, not kept alongside — two ways to look at the same shell
   concept would be exactly the redundancy being complained about) and
   replaced it with a live **ring-list panel** (`#shells-panel`,
   deliberately on the opposite side of the screen from `#controls` —
   spatial separation of "how to build" vs. "what you've built /
   undo", not just visual grouping within one growing box).
3. Follow-up request (concentric-circle diagram) → `renderRingDiagram()`
   draws a bullseye SVG: largest shell painted first, each smaller shell
   painted on top covering the larger one's center, leaving only its own
   ring-shaped band visible and clickable — the standard technique for
   real donut/ring click targets without arc/annulus path math. Colored
   via the same hue formula as `shellTint()` in the 3D view (`shellHue()`
   below it), so a shell reads as the same color everywhere. Kept
   **alongside**, not instead of, the text list with `×` buttons — a
   thin ring is easy to mis-click, so the list is the precise fallback,
   not a redundant duplicate.

**Undo, implemented as a full-world-JSON snapshot stack, not a
diff/command log** — simpler to reason about correctly than tracking
per-operation inverses, and every mutating path (Build/Fill/Round/
Excavate/ring-remove/New World/Import) already produces a full
`world.toJSON()`, so one mechanism covers all of them for free, with no
per-operation-type undo logic needed. `lastSnapshot` always holds the
state as of the end of the *previous* `onChange`, i.e. exactly the state
right before whatever mutation the *current* `onChange` is reporting —
this is what lets a single hook in `onChange` capture correct "before"
snapshots without instrumenting every individual
`world.addCell`/`removeCell` call site in `build.js`. Undo itself calls
`rebuildInstances`/`saveToLocalStorage` directly rather than going
through `onChange()`, deliberately — going through `onChange()` would
push a new snapshot for the undo action itself, effectively making undo
un-undo-able in a confusing way. Capped at 20 states (`MAX_UNDO`).
Verified end-to-end via `test-undo.mjs` against the real modules: fill →
undo → back to 1 cell; redo the fill → remove one ring → undo → ring
restored → undo again → back to 1 cell → undo on an empty stack is a
safe no-op. **That test caught a real gap**: `onCellClicked` fires with
the clicked cell's PRE-mutation state, so on the very first fill that
creates a brand-new structure, the original cell had no `shellCenter`
yet at the moment `onCellClicked` was invoked — the ring panel wouldn't
have focused on a just-built structure without a second click. Fixed by
having the `fill` branch in `build.js` re-invoke `onCellClicked` a
second time with the now-definitive `centerKey` after the fill
completes.

**Visually confirmed, 2026-08-11: ring panel appearance and diagram.**
User liked the ring panel's look. But reported real friction trying to
"remove a ring and fill it in with a different material" via the two
panels together. Root cause, on investigation: once a ring is removed
there's nothing left in the 3D view to click, so refilling it via Fill
mode required exactly matching shell-radius/hollow-from to the removed
shell number AND finding a still-existing cell of the same structure to
click on -- awkward by construction, not a bug. What the user actually
wanted was simpler than remove-then-refill: changing a ring's material
in place. Added `recolorShell(world, centerKey, shellNumber, material)`
(`build.js`) -- pure material overwrite via `world.addCell` with the
existing `shell`/`shellCenter` preserved, no geometry change, so it
can't touch cell count or trigger the "nothing to click" problem at all.
Wired as a **Recolor** button on every ring-list row (`render.js`),
using whichever material is currently selected in `#material-select`.
Verified against the real modules via `test-recolor.mjs`: recolors
exactly the target shell, leaves other shells' materials and every
shell's `shell`/`shellCenter` tags untouched, changes no cell count.

**`#material-row` is no longer mode-gated** — it used to hide in
Round/Excavate (`updateModeUI()`), but Recolor needs it regardless of
active mode; hiding it there would have forced a mode switch just to
see the dropdown before recoloring. Now always visible.

**Not yet visually verified in a real browser for this round** (Recolor
+ always-visible material row) — after hard-refreshing: build a shell,
change the material dropdown, click Recolor on one ring in the list, and
confirm only that ring's color changes in the 3D view with no cells
added or removed; confirm the material dropdown stays visible while in
Round or Excavate mode.

**Phase 4 (compliance docs) done, commit `84f65fd`, 2026-08-11.**
`docs/RHOMBIVERSE_COMPLIANCE.md`'s "Required before Phase 4" checklist is
done except LICENSE (`TERMS.md`/`PRIVACY.md`/`SECURITY.md` added, XSS
audit completed with no fixes needed). LICENSE and public deploy were
initially deferred by direct instruction ("the game is not near any
level of sophistication to actually play yet") — see the 2026-08-12
entry below for both being completed once the user asked again.

**Public deploy done, 2026-08-12 — direct instruction, superseding the
Phase 4 deferral above.** MIT `LICENSE` added (copyright DICTOR-Master).
Deployed via Vercel, linked directly to the GitHub repo (`DICTOR-Master/
rhombiverse`, still private — Vercel deploying from a private repo
doesn't require making it public, unlike GitHub Pages, which was the
deciding factor in choosing Vercel over Pages). No build step needed —
matches this project's own "no build step, by design" principle exactly;
Vercel serves `index.html` straight from the repo root, no
`package.json`/build command involved. **Live at
https://rhombiverse.vercel.app** — verified twice: a raw `curl` (200,
correct HTML) and a real headless-browser load (real screenshot showing
the actual rendered scene — seed cell, full controls panel — zero
console errors), not just a reachability check. First deployment on a
brand-new Vercel project is automatically assigned straight to
production (not something achievable by using a "safer" preview-only
command) — worth knowing before assuming a plain `vercel deploy` is ever
non-live for a project's very first deploy.

**Real gotcha hit right after, 2026-08-12: every deploy AFTER the first
one got silently stuck at `readyState: BLOCKED`, never reaching the
production alias, with no error surfaced by the CLI's own progress
output (it just hangs at "Building…" forever).** Chased two wrong
theories first (Vercel account/email mismatch, then Deployment
Protection/SSO) before querying the deployment object directly via the
Management API (`GET /v13/deployments/:id`), which is what actually
revealed the real, documented reason:
`readyStateReason: "The Deployment was blocked because there was no git
user associated with the commit."` — the commit author on every commit
this whole session, `DICTO <dicto@dicto.jp>` (this sandbox's local git
config, unrelated to the user's real GitHub/Vercel accounts), isn't a
recognized collaborator identity, so Vercel refuses to auto-promote any
deploy sourced from it — except a project's very first-ever deployment,
which gets a one-time exception (explaining why that one alone worked).
Fixed by setting `git config user.email` (this repo only, not global) to
the user's real address and committing again -- **past commits' authors
are immutable, so this only takes effect starting with the next new
commit, not retroactively**. If a future deploy mysteriously re-blocks
after this, check `GET /v13/deployments/:id`'s `readyStateReason` FIRST,
directly, rather than guessing from the CLI's own silence -- both wrong
theories chased here were plausible-sounding but a five-second API call
would have settled it immediately.

**Phase 5.5 (Planetoid Building + Radial Gravity) done, commit
`30cd1c8`, 2026-08-11 — built out of sequence, ahead of Phase 4's own
deploy step, and picked up mid-flight as uncommitted work-in-progress
rather than scaffolded fresh in this session** (the shell-fill/hollow/
round/excavate tools above were already pulled forward earlier; this
finishes the other Phase 5.5 bullet, "Radial gravity," per
`RHOMBIVERSE_PLAN.md` section 4 and
`docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`). New `src/gravity.js`:
flood-fills built cells into connected clusters via the same
`NEIGHBOR_OFFSETS` adjacency as everything else, and for every cluster
containing at least one Blackstar-Glassite cell computes a single-point
gravity source (center = average world position of its BSG cells),
gravity radius (`BASE_GRAVITY_RADIUS + (bsgCount-1) * RADIUS_PER_BSG`,
first-guess constants, not yet playtested — same "flag it, don't
silently invent tuning math" convention as `roundStructure`'s `0.75`
above), and a soft core-cavity-size UI hint via `shellCount(n)`. Deliberately
scoped to the spec's own section 4.1 (single-point/single-cluster source)
— section 4.2's multi-deposit weighted centroid and section 4.3's
recentering shockwave are both explicitly deferred, matching
`RHOMBIVERSE_PRINCIPLES.md` section 0's own worked example of Grounded
Simplicity. New `src/player.js`: a first-person walk controller,
deliberately NOT three/addons' `PointerLockControls` since that hardcodes
world-Y as "up" in its internal Euler math, which breaks once gravity's
"up" is a radial direction instead — builds camera orientation from
yaw/pitch plus whatever `up` `gravity.js` reports for the current
position each frame, so walking on a curved surface re-levels correctly;
falls back to a no-clip flycam (no momentum, direct WASD + Space/Shift
up-down) when no gravity is active, matching the spec's "inert cells ...
treat as normal flat-gravity or zero-gravity space." Known first-pass
limitation, left as-is on purpose: no roll blending between two different
planetoids' gravity fields in one session (up snaps instantly at the
boundary) — a single-planetoid session is the realistic first-playtest
case. Wired into `render.js`: an **Enter Walk Mode** button toggles
`controls.enabled` vs. the walk controller, requests/releases pointer
lock, and a `pointerlockchange` listener catches the browser exiting lock
on its own (Esc, tab switch) so Walk Mode's UI state can't get out of
sync with the actual lock state. `getMode()` returns `null` while
walking so Build/Fill/Round/Excavate can't fire mid-walk. A live
`#gravity-info` hint reports the nearest planetoid and whether its
gravity is in range, reading `controls.target` in Build mode and the
live player position while walking. `worldstate.js`'s `addCell` also
stamps `gravitySource`/`gravityWeight` on BSG cells per the spec's
section 5 schema — **not load-bearing**, `gravity.js` treats `material`
as ground truth so worlds imported without these fields still work;
they exist for schema-compliance/future tooling only.

**Verified with a real headless-browser run, 2026-08-11 — a genuinely
new testing capability for this repo, worth using again.** The existing
"Real testing infrastructure" section above (portable Node + real `three`
package) proves CPU-side math only, explicitly *without* WebGL/DOM — it
can't exercise actual rendering, pointer lock, or real click/keyboard
dispatch against a live page. Reconstructed via the `browser-test-harness`
skill (`.claude/skills/browser-test-harness/SKILL.md`, Harness 2 —
portable Python venv + Playwright + cached Chromium, no sudo/system
browser needed). Drove a real page load: selected Blackstar-Glassite,
clicked a face to place a BSG cell, confirmed `#gravity-info` went from
"No planetoid yet" to "gravity active · radius 2.2u · 1 BSG cell",
clicked **Enter Walk Mode**, confirmed `document.pointerLockElement` was
genuinely non-null (real lock, not just a UI flag flip), sent WASD +
mouse-move input, then proved the exit path two ways: a CDP-synthetic
Escape keydown did **not** release the lock (a known Chromium/CDP
limitation — the browser's native "Escape exits pointer lock" shortcut is
tied to genuine trusted input and doesn't fire from automation; this is
not an app bug and real physical Escape presses do trigger it), so
`document.exitPointerLock()` was called directly to simulate what a real
Escape does at the browser-chrome level — confirmed `render.js`'s
`pointerlockchange` listener correctly caught that and called
`exitWalk()`, reverting the button text, hiding the walk hint, and
restoring `OrbitControls`. Zero console errors or page exceptions across
the whole run (only benign WebGL driver performance warnings). Real
screenshots taken at each step confirm the render itself (not just DOM
state) is correct.

**Water & Ice 9.9 (planetoid hydrosphere) done, commit `ce528da`,
2026-08-11.** `docs/RHOMBIVERSE_SPEC_WATER_ICE.md`. Water needed no new
code — already an ordinary, freely-placeable material. New
`src/hydrosphere.js`: for every connected cluster (reuses `gravity.js`'s
`findClusters`, now exported) containing at least one BSG cell, any Ice
9.9 cell **anywhere in that same cluster** — not just cells directly
touching the core — liquifies into permeated water (`applyHydrosphere`,
called every `render.js` `onChange`/`init`, mutates world in place,
idempotent). `gravity.js`'s `computePlanetoids` gained
`hydrosphereActive`/`atmosphereActive` on each planetoid record (both
flip together, reading the `hydrospherePermeated` flag already stamped
by the time it runs). Deliberately does not touch the black hole's
containment framework at all, per the spec's own section 3. Verified
with a real Playwright run: BSG + adjacent Ice 9.9 converts to permeated
water, visible in the render (distinct blue tint) and in the
`#gravity-info` hint, zero console errors.

**Black Hole (Asymptotic Containment) done, 2026-08-11 — scoped for
single-player, direct instruction.** `docs/
RHOMBIVERSE_SPEC_BLACKHOLE.md`. The spec's own section 4 says its
cross-player consent model "depends on the Phase 5.8 trust-zone/region-
ownership system existing first" — this repo has no accounts and no
Phase 5.8 yet, so per direct instruction the real physics/economics are
built in full now, while the ownership/consent layer is deliberately NOT
faked. New `src/blackhole.js`: **a black hole is not a new material or
object type** — mirrors Star System's own framing — a BSG cluster
becomes one once `BLACK_HOLE_BSG_THRESHOLD` (20, first-guess/tunable)
BSG cells are reached, reusing `gravity.js`'s new `bsgClusterStats`
helper (factored out of `computePlanetoids` so both modules share the
exact same center/radius math, not two derivations of it). **Consumption**
(`applyBlackHoleConsumption`): any foreign, non-buffer cell within
`EVENT_HORIZON_FRACTION` (0.15) of `gravityRadius` is absorbed —
removed from the world, credited to a matter ledger stored on a sticky
"core" BSG cell (nearest to centerOfMass the first time the threshold is
crossed, then kept stable across recomputes so accumulated ledger state
survives the cluster growing). **Generation**
(`applyAsymptoticGeneration`): backfills empty lattice cells between the
core and the nearest *foreign* structure (a structure chain-connected to
the black hole's own cluster is correctly excluded from "foreign" —
confirmed the hard way, see below) with `generatedByBlackHole` buffer
cells (distinct dark render tint), gated by four independent, all
independently-verified limits: (1) `shellCumulativeCost(n)` (cumulative
`shellCount` through shell n) must be affordable from the ledger, scaled
up by (2) adaptive damping — `1 + recentConsumptionCount *
DAMPING_FACTOR` over a `DAMPING_WINDOW_MS` (10s) window, so rapid recent
consumption makes further growth costlier, not easier; (3) generation
never reaches or passes the nearest foreign structure's own BFS shell;
(4) generation never exceeds real Euclidean `gravityRadius`, and (5)
never exceeds `MAX_GENERATED_CELLS` (2000, the spec's own "computability
caveat" cap). **Consent/ownership, deliberately NOT built as fake
multiplayer:** in a single-player world the black hole's creator already
owns 100% of the world, so the spec's own creator-exception clause
already covers everything with zero extra code. What got real, narrow
meaning instead: a per-cell `destructible: false` opt-out (checked by
consumption) lets a player protect specific cells of their *own* build
from their *own* black hole — forward-compatible with the eventual
cross-player meaning without inventing account/region state that doesn't
exist yet.

**Real bug caught only by execution, not code review, while testing
this:** an early version of the generation test built a "foreign
approaching structure" as a chain of built cells reaching out from the
core — but `findClusters` groups by *built adjacency*, not material, so
that chain silently merged into the black hole's own cluster and was
then correctly excluded by `clusterKeys` from ever counting as "foreign,"
making generation look broken (0 cells) when the code was actually
working exactly as designed and the test setup was wrong. Root-caused by
building a genuinely *disconnected* foreign cell instead (a gap, no
connecting chain) — confirms `applyAsymptoticGeneration`'s "foreign
means not part of this cluster" logic is correct, but is also a real
trap worth remembering: **anything chain-built onto a black hole's own
structure becomes part of it**, including for future mechanics that need
to reason about "what's near a black hole but not owned by it." Verified
via real execution throughout, not static reading: since this module has
no DOM/Three.js dependency, tests drove it with dynamic `import()`
straight from a running `http.server` inside a headless Chromium page
(no Node needed) — confirmed threshold detection, in-range consumption
crediting the ledger while an out-of-event-horizon structure stays
untouched, generation correctly halting with an insufficient ledger,
generation correctly stopping exactly one shell short of a nearby
foreign structure with an abundant ledger, generation correctly capped
by `gravityRadius` and by `MAX_GENERATED_CELLS` when nothing nearby
limits it first, and adaptive damping producing measurably less
generation (541 cells / shell 5 vs. 35 cells / shell 2) from the
*identical* ledger balance when 20 recent consumption events are present
vs. none. Also reran the Phase 5.5 walk-mode and Water/Ice regression
tests afterward to confirm the new pipeline calls (`applyHydrosphere` →
`applyBlackHoleConsumption` → `applyAsymptoticGeneration` →
`rebuildInstances` → `computePlanetoids` → `annotateBlackHoles`, wired
into both `init()` and `onChange()` in `render.js`) didn't regress
ordinary (non-black-hole) play — both passed unchanged, zero console
errors.

**Star System Anchor done, 2026-08-11.** `docs/
RHOMBIVERSE_SPEC_STAR_SYSTEM.md`. New `src/starsystem.js`: same "not a
new material" framing as Black Hole — a BSG cluster becomes a star past
`STAR_BSG_THRESHOLD` (8, deliberately lower than Black Hole's 20, so a
star is a reachable mid-game milestone rather than requiring
endgame-scale accretion), independent of black-hole status (a cluster
could in principle cross both thresholds; the spec doesn't say they're
exclusive). `luminosity` scales linearly with BSG count above threshold.
**Fusion** (`applyStarFusion`): active whenever the cluster contains
*both* a `hydrospherePermeated` cell (hydrogen, from Water/Ice's own
mechanic — section 2's "Ice 9.9... splits into fusion fuel plus a
byproduct") and a Ferrostone cell (the reused carbon-catalyst material —
implementation's own choice, per the spec's explicit permission to reuse
rather than mint a new material). **Deliberately does not physically
delete the fuel cells each tick** — Ice 9.9's hydrosphere is a standing
network per its own spec, not a one-shot consumable, so presence (not
depletion) is the gate; a ledger (`hydrogenConsumed`/`carbonConsumed`)
still accumulates in the same shape the spec asks for, just not backed
by deleting player-built matter, which would be a surprising/destructive
side effect nothing in the spec actually asks for. **Oxygen byproduct
needed zero new code**: fusion's hydrogen source already requires
`hydrospherePermeated`, which already implies `hydrosphereActive`/
`atmosphereActive` are already true for that cluster via `gravity.js` —
satisfied structurally, not by a second flag. **Frost line**
(`canPlaceMaterial`, `frostLineDistance` = 0.6 × a star's `gravityRadius`,
first-guess): the one real build-time constraint this spec adds — Ice
9.9 cannot be placed within a star's frost line, checked before every
placement path that can introduce material (`build.js`'s build mode,
fill mode, and `recolorShell`, all three now take an optional
`canPlaceMaterial` callback, defaulting to always-allowed so existing
callers/tests are unaffected). Rocky materials are never restricted by
the frost line (only Ice 9.9 is), matching the spec's actual wording.
No orbital motion implemented, per the spec's own explicit deferral.
Verified via the same direct-module-execution technique as Black Hole:
threshold detection, luminosity formula, fusion correctly gated on both
fuel types being present (and inert without either), frost-line
placement correctly blocked inside / allowed outside / never restricting
rocky materials — all real execution, zero console errors. Reran the
Water/Ice, Walk Mode, and Black Hole regression tests afterward with no
breakage.

**Frost line reconfirmed via an actual raycast click, 2026-08-12** (the
isolated-function verification above was real but not sufficient on its
own — a genuine UI click exercises the raycast/face-matching/mode-dispatch
path in `build.js` that the isolated test never touched). First attempt
tried chaining individual Build-mode clicks outward face-by-face,
computed via the exact camera projection `render.js` uses (position
`(6,5,8)`, `lookAt(0,0,0)`, real `THREE.Vector3.project()`) — this
surfaced two real click-targeting lessons worth keeping: (1) two adjacent
Voronoi cells share a face exactly at the midpoint between their
centers, not at the neighbor's own center — aiming a click at the full
neighbor position often overshoots the mesh into empty space and hits
nothing; (2) as the structure grows, a fixed camera position walks
distant click targets off-canvas onto the UI overlay (confirmed directly
by probing screen projections — a point at world `(4.5,4.5,0)` landed on
the Undo button, not the canvas) or gets occluded by nearer geometry
along the same ray once the scene is dense enough. Sidestepped both by
using Fill mode's own per-candidate-cell `canPlaceMaterial` check instead
of chained Build clicks: one real click on the seed (Blackstar-Glassite,
shell 1 → a 12-BSG-cell star) followed by one real click with Ice 9.9
selected and shell-count 4 (shells 2–4, since shell 1 is already
occupied) exercises the frost line across a wide distance range in a
single interaction. Result: all 108 placed Ice 9.9 cells sit at distance
≥4.69 against a 4.62 frost line — zero exceptions — and the ring panel
confirms shells 2–3 were never built at all (not attempted-and-rejected,
genuinely skipped), visually a hollow gap between the BSG core and the
outer ice shell in the actual render. This is now confirmed via real
end-to-end interaction, not just the underlying function.

**Supernova Threshold done, 2026-08-11 — all four Phase 5.5 addenda now
complete.** `docs/RHOMBIVERSE_SPEC_SUPERNOVA.md`. New `src/supernova.js`,
deliberately thin per the spec's own header ("reuses the containment
pattern from Black Hole directly... no new safety mechanism is invented
here"). **Accumulated mass reuses `starsystem.js`'s own ledger
directly** (`hydrogenConsumed + carbonConsumed`), not a second ledger —
literal reading of the spec's "extends the existing... ledger pattern...
same shape, not a new field type." `SUPERNOVA_CRITICAL_MASS` (30,
first-guess) is the Chandrasekhar-equivalent limit; adaptive damping
scales the *effective* threshold up with recent fusion activity (same
shape as `blackhole.js`'s own damping — reused, not reinvented, per this
spec's explicit instruction) rather than shrinking increments, so
detonation is a real, reachable, deterministic event rather than an
eternally-receding asymptote. **Detonation is single-shot**:
`applyStarFusion` stops accumulating mass once `starLedger.detonated` is
set, and `applyDetonationCheck` itself checks that flag first — confirmed
idempotent by calling it twice in the same test with no double-effect.
Effects: bounded blast radius (reuses `gravityRadius`, same "same radius
mechanic" convention as Black Hole), the same single-player-scoped
`destructible: false` consent check as Black Hole (confirmed a
protected cell survives untouched), and matter redistribution — consumed
foreign cells are matched 1:1 with new `supernovaScattered` cells placed
just beyond the blast radius, never simple deletion. **The remnant needed
genuinely zero new code**: `detonate()` never touches the star's own BSG
core cells (only foreign ones within radius), so if that core's own
`bsgCount` already meets `blackhole.js`'s `BLACK_HOLE_BSG_THRESHOLD`, the
*already-running* `applyBlackHoleConsumption`/`applyAsymptoticGeneration`
passes simply start treating it as a black hole on the very next
`onChange` — confirmed directly (`isBlackHole: true, isBlackHoleRemnant:
true` after detonating a 20-BSG-cell star), literally satisfying "do not
build a separate remnant mechanic" by not writing one. Verified via the
same direct-module-execution technique as the other three specs: below-
threshold (no detonation), above-threshold (detonation, consumption,
scatter, protected-cell survival, idempotent re-check), heavily-damped
(same raw mass, no detonation because of recent activity), and the
extreme-mass remnant case — one test run's "foreign" cell ended up
accidentally cluster-connected the same way Black Hole's generation test
did earlier in this session (worth remembering as a recurring test-design
trap, not a code bug: anything built adjacent to a BSG structure becomes
part of its cluster, foreign or not) — didn't invalidate the run's actual
point (the remnant reuse), so left as-is rather than re-engineering
further. Reran the full regression suite (Water/Ice, Walk Mode, both
Black Hole tests, Star System) afterward — all six passed clean, zero
console errors throughout this whole session's testing.

**Structure presets added, 2026-08-12 — direct instruction, prompted by
real friction hit while verifying the frost line above.** Hand-clicking
a precise multi-cell structure (e.g. a 20-BSG-cell black hole) face by
face turned out to be genuinely fragile — see the frost-line entry above
for the two concrete lessons (shared-face midpoints vs. neighbor
centers; a fixed camera plus a growing structure walking click targets
off-canvas or into occlusion). New `data/presets/*.json`: `minimal-star`
(shell-1 BSG core, 12 cells, plus one adjacent Ice 9.9 and one Ferrostone
cell so fusion is active immediately on load), `black-hole-core` (shell-1
BSG + 8 more from shell 2 = exactly `BLACK_HOLE_BSG_THRESHOLD`), and
`hydrosphere-demo` (a small 3-BSG sub-star cluster with adjacent Ice 9.9,
isolating Water/Ice's permeation from star/fusion behavior). **Generated
via the real in-browser lattice math** (`NEIGHBOR_OFFSETS`-driven, via
the same dynamic-`import()`-in-headless-Chromium technique used for
testing all session, not hand-derived coordinates — the exact class of
error that caused the friction these exist to fix). A new **Load preset**
dropdown + button in `index.html`'s controls panel (confirm-gated, same
destructive-action pattern as **New World**) calls `world.replaceAll()`
in `render.js`. Verified two ways: the underlying JSON was checked
through the full `apply*`/`annotate*` pipeline directly (module-level,
confirming e.g. `black-hole-core` is already `isBlackHole: true` on
load, and correctly auto-consumes its own leftover `base`-material seed
cell within the event horizon — a real, intentional consequence of the
Black Hole mechanic, not a preset bug), and then the actual **Load**
button was clicked for all three presets in a fresh browser session,
confirming the real UI path produces identical results. Zero console
errors. **Also serve as reusable test fixtures** — future tests can load
these same JSON files directly instead of hand-building cells in test
code or clicking through the UI, sidestepping the face-targeting
fragility documented above entirely.

**Formula-driven planetoid generator added, 2026-08-12 — direct
instruction, a new idea from the user (not a spec-derived feature), built
directly without a spec doc first per their own explicit call.** Distinct
from the static presets above: instead of fixed pre-built JSON snapshots,
this is a fifth build mode (**Generate**) that constructs a full,
correctly-graduated body of a chosen real-world-inspired type at
whatever radius you click, in one click. New `src/planetoidgen.js`:
`PLANETOID_RECIPES` (`rocky`, `ice-moon`, `gas-giant`), each a
`materialForShell(shell, totalShells)` function picking a material by
which fractional band the shell falls into — as simple a formula as
reasonably possible, per the user's own stated goal. Every recipe stamps
exactly one Blackstar-Glassite cell at the generated center: gravity in
this game is entirely BSG-tied (not new lore, a hard constraint of the
existing gravity mechanic), so a generated body needs one to be
walkable/coherent at all. Rocky planetoid grades Ferrostone (core) →
Garnet (mantle) → Base Rhomb (crust), mirroring real planetary
differentiation. Ice moon grades Ferrostone (core) → Ice 9.9 (icy
shell) — the outer shell auto-permeates into water via the *already-
existing* `hydrosphere.js` the moment it's generated, confirmed directly
(`hydrosphereActive: true` immediately after one click), a genuine
payoff of reusing existing mechanics rather than a new one. Gas giant
reuses Glassite ("translucent... no gravity function," per the gravity
spec's own material table) as a large outer envelope rather than
inventing a new low-density material or `state` field — same "reuse
before inventing" move as Star System's Ferrostone-as-carbon-catalyst.
`generatePlanetoid` reuses `cellsInShells` directly (the same
`shellCount(n) = 10n²+2` substrate as everything else), respects the
Star System frost line via the same `canPlaceMaterial` callback Fill
mode and `recolorShell` already take, and skips cells that already exist
rather than overwriting real player-built matter. Wired as a genuine
fifth mode button (`build.js`'s `onClick` dispatch, `index.html`'s
`#generator-row` type dropdown shown contextually like the other modes'
inputs, reusing the existing "Shell fill radius" input for total size).
Verified via three real clicks in a fresh browser (one per body type):
material-by-shell breakdown matched the intended bands exactly at
`totalShells=6` (rocky: shells 1–2/3–4/5–6 → ferrostone/garnet/base; ice
moon: shells 1–3 ferrostone, 4–6 water — permeation confirmed; gas
giant: shell 1 ferrostone, 2–6 glassite), shell cell-counts matched
`shellCount(n)` exactly (12/42/92/162/252/362), zero console errors.
Reran the full nine-test regression suite afterward (Water/Ice, Walk
Mode, both Black Hole tests, Star System, Supernova, the presets UI, and
the frost-line fill test) — all passed clean.

**Phase 5 (Shared World, optional realtime sync) done, 2026-08-12 —
picked up mid-flight from an uncommitted `supabase/schema.sql` that
predated this session's own memory (a `public.cells` table, one row per
lattice cell keyed by `(x,y,z)`, RLS policies already written to match
Black Hole/Supernova's existing "your own cells only" consent rules,
referencing a not-yet-written `src/sync.js`).** Backing project: Supabase
`zuvlqvvxifuzumqeyuir`, connected via its MCP server this session
(authenticated via OAuth, then Anonymous Sign-Ins enabled via the
Management API since the dashboard's own Save button was unresponsive —
`external_anonymous_users_enabled: true`). Applied the drafted schema as
migration `phase5_shared_world_cells`. New `src/sync.js`:
`ensureAnonymousSession()` (stable per-browser identity with zero login
UI, matching the "no real account system yet" scoping already used for
Black Hole/Supernova's consent model), `loadSharedWorld()` (returns the
same `{worldName, version, cells, meta}` shape `worldstate.js`/
`persistence.js` already use, so it drops straight into
`createWorldStore`/`replaceAll` with no format translation),
`pushCellUpsert`/`pushCellDelete`, `subscribeToSharedWorld()` (realtime
INSERT/UPDATE/DELETE). Project URL + publishable key are hardcoded client-
side deliberately — they're meant to be public, security comes entirely
from RLS, same as every Supabase browser app. `@supabase/supabase-js`
added to `index.html`'s import map via **esm.sh**, not the unpkg CDN
three.js already uses — unlike three.js's single self-contained bundle,
supabase-js pulls in several sibling npm packages (`auth-js`,
`realtime-js`, `postgrest-js`, etc.) as bare specifiers that raw unpkg
can't resolve without an import-map entry per sub-package; esm.sh
resolves/flattens all of that server-side into one working ESM module.

`worldstate.js`'s `createWorldStore` gained an optional `hooks: {onAdd,
onRemove}` param, called at the end of `addCell`/`removeCell` — confirmed
by grep that literally every mutation path in the app (build.js's click
handlers, `recolorShell`/`removeShell`, and every `apply*()` derived-
mechanic module: hydrosphere, black hole, star fusion, supernova) already
goes through these two methods, making this the single correct hook
point, with `worldstate.js` itself staying completely unaware of Supabase.
Deliberately NOT called by `replaceAll` — a bulk local-view swap (Undo,
New World, Import, Load preset) is a personal reset, not a real edit, and
must never bulk-push/delete against a shared world.

`render.js` wiring: a **Shared World** toggle button (`#shared-world-
toggle`) next to New World/Export/Import, confirm-gated like Load preset
since it swaps the current view. Enabling: anonymous sign-in →
`loadSharedWorld()` → `world.replaceAll()` → subscribe. A module-level
`applyingRemote` flag suppresses the push hooks specifically while a
just-received remote change is being written into the local store
(`applyRemoteUpsert`/`applyRemoteDelete`, both reuse the full `onChange()`
pipeline so derived mechanics recompute correctly against remote cells
too) — without it, every client echoing back what it just received would
feedback-loop forever. **New World / Import JSON / Load preset are
disabled outright for the duration of a Shared World session** (found by
reasoning through, not by hitting the bug live): all three mutate via
`replaceAll`, which bypasses the sync hooks by design (above), so New
World's `clearLocalStorage()` would have silently wiped the player's real
local save, and Undo/Import/Load-preset would silently desync the local
view from the shared table with no way back except toggling off and back
on. `onChange()`'s `saveToLocalStorage` call and the Undo button (both
disabled AND its click handler) are guarded by the same `sharedWorldActive`
flag, for the same reason — the local save must stay frozen at whatever
the player's private build was while looking at the shared world, or
switching back would silently lose it. Disabling reloads the local world
from `localStorage` (or the static seed) and re-enables the three
controls — a clean, symmetric mode switch, deliberately mirroring Walk
Mode's own enter/exit pattern.

**Real bug found and fixed, 2026-08-12: the shared world started
genuinely empty, making Shared World unbuildable from a fresh project.**
Unlike the local world (`data/starter-world.json` always seeds one cell),
`public.cells` had zero rows on a fresh migration. Build/Fill/Generate all
raycast onto an *existing* cell's face to place a neighbor — with nothing
in the table, the very first player to enable Shared World had literally
nothing to click. Found by real execution, not by inspection: a headless-
Chromium Playwright run (portable venv + the `~/.cache/ms-playwright`
Chromium binary cached from an earlier session, same reusable harness
documented above under "Real testing infrastructure") clicked Enable
Shared World, then clicked canvas-center in Build mode — network logging
showed the `select` genuinely returning `[]` and the click's raycast
correctly hitting nothing (not a bug in `build.js` — geometrically
correct behavior against a truly empty scene). Fixed with a one-time
migration inserting a single `(0,0,0)` `base`-material cell into
`public.cells`, mirroring the local starter world's own shape. **Verified
end-to-end after the fix, real execution throughout**: Enable Shared
World → real anonymous-signup network call (200) → real `select` returning
the seed cell → real Build-mode click on the seed → real `POST
.../rest/v1/cells` (201) confirmed via direct SQL query to hold the
correct neighbor cell; then, to test the *pull* direction specifically, a
cell was inserted directly via SQL from **outside the browser entirely**
(simulating a second, independent player) — the running page's realtime
subscription picked it up and rendered it with zero page interaction and
zero console/page errors, confirmed both by a before/after screenshot
(a second, garnet-tinted cell visibly appears) and by the network log
showing no errors during the wait window. Disable Shared World afterward
correctly reverted the hint text, button label, and re-enabled the three
guarded controls. Test artifacts ((1,0,1), (0,1,1)) were deleted after
verification, leaving only the legitimate (0,0,0) seed cell in the shared
table.

**Known, deliberate limitations, not yet solved (documented per this
project's own convention of flagging real gaps rather than hiding them):**
undo/new-world/import/load-preset are unavailable for the whole duration
of a Shared World session (not just incompatible with one specific
action) — the only way back to local editing is the Disable button.
Derived mechanics (hydrosphere/black hole/star fusion/supernova) only
recompute on this client in response to either a local edit or an
incoming realtime event for a cell that was pushed by `addCell`/
`removeCell` — a mechanic threshold crossed purely by combining multiple
*other* players' simultaneous edits without this client also receiving a
matching realtime event for each could theoretically miss a recompute
until this client's own next edit; not hit in testing (single extra
client, sequential edits) but not proven safe under real concurrent
multi-player load either. No presence/multi-cursor UI — you can't see
who else is connected or where they're building.

**Phase 5.8 (Trust Zones/Moderation) started, 2026-08-12 — deliberately
partial, scope chosen and stated up front rather than attempting the
plan's full bullet list.** `RHOMBIVERSE_PLAN.md`'s Phase 5.8 section lists
several sub-items; two don't actually apply to this app yet and were
skipped rather than faked: an "automated profanity/content filter" has
nothing to scan (no free-text UGC exists anywhere — material is a fixed
dropdown enum, no chat, no naming), and a "human review queue" needs an
account/role system this repo doesn't have. What WAS built, matching the
plan's own two concrete success checks: `worldstate.js`'s `addCell`
defaults `region: 'open'`/`status: 'pending'` on any cell missing them
(existing cells re-added via `...data` spreads — recolor, hydrosphere,
black hole/star mechanics — already carry their real values, so this only
ever stamps genuinely brand-new cells; curated content in
`data/starter-world.json`/`data/presets/*.json` sets `'core'`/`'approved'`
explicitly in its own JSON and bypasses this via `replaceAll()`
untouched). A sixth mode button, **Report**, toggles a clicked cell
between `'flagged'` and `'approved'` — doubling as both the report AND
the undo-a-report action since no separate reviewer role exists to make a
one-way flag safe. `render.js`'s `visibleCells()` excludes
`'flagged'`/`'removed'` cells from the default view entirely (invisible
AND unclickable, same technique the old onion-skin filter used) —
quarantined, not deleted, per the plan's own framing; Report mode itself
is the one exception, showing them with a distinct red tint so they can
actually be found and un-flagged. Derived mechanics (hydrosphere/black
hole/etc.) read `world.entries()` directly, not this filtered view, so a
flagged cell still fully participates in gravity/consumption/fusion —
correct, since flagging is about visibility, not existence. The plan's
"rollback via JSON snapshots" bullet needed zero new code — Export JSON
(Phase 3) already provides exactly that mechanism. **Not yet live-tested
in a real browser** (reasoning/static-checked only, including catching
and fixing a real temporal-dead-zone bug — `currentMode` was referenced
before its own declaration — during review) — this pass was scoped
tighter and verified lighter than earlier sessions' work, per direct
instruction to start rationing effort/tokens on this project. **Not yet
built, left for a real follow-up**: the full `core`/`reviewed`/`open`
three-tier reachability gate (region field is stamped but not yet
enforced — only the flagged/removed binary is), the age/mode client
selector the plan calls for, and `RHOMBIVERSE_SPEC_REGIONS.md`'s
ownership-claims system (a related but distinct concept from this
moderation `region` — see that spec's own section 1 naming note).

**Reachability gate + age/mode selector deliberately NOT built,
2026-08-13 — a scope decision, not an oversight, made when actually
sitting down to build it.** Direct pushback from the user mid-
investigation: "it seems quite a step to be able to create anything
offensive enough at this juncture to warrant legal protection" — and
on inspection, correct. This app's entire UGC surface is placing
fixed-material voxels from an 8-item enum in a coarse lattice; there is
still no chat, no free text, no usernames beyond anonymous UUIDs
anywhere in the app (unchanged since the original Phase 5.8 pass
above). The already-shipped `status: 'flagged'`/`'removed'` Report
mechanism is a real, working, proportionate safety valve for that
surface at this population (effectively zero real users). A full
three-tier reachability gate with a client-side age/mode selector is
real, nontrivial machinery (and, as investigation before stopping
turned up, has a genuine sharp edge: the live Shared World seed cell
in `public.cells` has no `region` field at all, so a naive `region ??
'open'` default-deny gate would show a brand-new player literally
nothing, not even something to build from, in the spec's own
safest/default mode — a real bug that only matters if this gets built)
for a risk that isn't pressing yet. Building it now would violate
`RHOMBIVERSE_PRINCIPLES.md` section 0's own Grounded Simplicity law:
don't build for a hypothetical future requirement. **Explicitly
deferred, not abandoned** — revisit if any of these actually change:
free-text UGC (chat, naming) gets added, the population grows past
"effectively zero," or a real moderation incident occurs that the
existing flagged/removed mechanism doesn't adequately handle. COPPA
review and a moderator-scaling plan (`RHOMBIVERSE_COMPLIANCE.md`'s
other two open Phase 5.8 items) are left open for the same reason plus
their own: COPPA needs real legal review no Claude Code session can
substitute for, and moderator scaling is a staffing decision only the
maintainer can make.

**`RHOMBIVERSE_SPEC_REGIONS.md` (ownership claims) data layer + full
wiring done, 2026-08-12 — built as two passes in the same session: data
layer/algorithm first (hand-traced only), then wired end-to-end once the
user asked to keep going.** `worldstate.js`'s `createWorldStore` gained a
`claims` registry (`getClaims()`/`addClaim()`, included in `toJSON()`/
restored by `replaceAll()`) — the first addendum needing a genuinely new
top-level world-state key rather than fitting entirely inside per-cell
fields, since every prior addendum (shell/shellCenter, gravitySource,
blackHoleLedger, starLedger) did. `src/regions.js`: `CLAIM_SIZE_SHELLS =
2` (the spec's own worked example, adopted as-is), `allocateClaim(world,
ownerId, sizeShells)` searches candidate claim CENTERS outward from world
center in true 3D shell order (reusing `cellsInShells`/`shellCount`
directly, world center itself tried first since that helper only returns
shells 1+), granting the first whose own fixed-size footprint doesn't
overlap any existing claim's — matches section 2's "fill each shell
before moving to the next" and section 6's Isolation guarantee (only ever
reads existing claims, never resizes/moves one). `claimIdAt(claims, x, y,
z)` resolves ownership geometrically against the registry, so a claim
reserves space even before every cell in it is built.
`worldstate.js`'s `addCell` now auto-stamps `claimId` via `claimIdAt` on
any genuinely new cell (same "only default if absent" rule as region/
status, so an existing cell's real claimId is never silently
overwritten, and a later claim never retroactively annexes already-placed
cells). `blackhole.js`'s `applyBlackHoleConsumption` and `supernova.js`'s
`detonate` both gained `isClaimProtected()` checks alongside their
existing per-cell `destructible`/authorId guards — additive, not a
replacement: any of the three being true/false-as-appropriate protects a
cell. A minimal **Claim Land** button (enabled only while Shared World is
connected, since ownership needs a real per-player identity) calls
`allocateClaim` with this session's own `auth.uid()` and reports the
result inline — no claims list/map UI beyond that one line yet.
**Real bug caught only by a live Playwright run, not by the earlier
hand-trace**: `MAX_CLAIM_SEARCH_SHELL` was originally 300 — looks like a
generous, safe margin in isolation, but `shellCount(n)=10n²+2` grows
quadratically, so `cellsInShells(0,0,0,300)` tried to eagerly materialize
roughly **90 million** candidate records before checking even one,
hanging a real browser click for 30+ seconds (Playwright's own click
timeout is what surfaced it — the underlying page had genuinely frozen).
Fixed by lowering to 40 (cumulative ~219k candidates, sub-second, still
comfortably enough to pack dozens of non-overlapping claims given each
one's real Euclidean footprint is only ~2.8 units). Verified after the
fix with the same real run: `claim_1` granted at world center (shell 0)
as expected, a second call correctly skipped every overlapping candidate
through shell 4 and landed `claim_2` at shell 5 — matching the spacing
the design predicted — zero console/page errors throughout.

**Claims synced to Supabase, 2026-08-12 — same session, picked up
immediately after the user said to keep going.** New `public.claims`
table (`supabase/schema.sql`, applied as migration `phase58_claims_table`):
**INSERT-only, no update/delete RLS policy at all** — the database itself
now hard-enforces section 2's "no claim is ever resized, moved, or
shrunk," not just application code. `id` is the claim's own center
coordinate (`claim_x_y_z`) rather than a counter — deterministic,
collision-free by construction, and doubles as the primary key so a
genuine concurrent-grant race (two sessions computing the same free slot
before either has synced) fails loudly server-side instead of silently
double-granting land. `regions.js`'s `allocateClaim` was split into a
pure `computeClaim` (no mutation) plus a thin local-only wrapper, so
render.js's Claim Land handler can push to Supabase FIRST and only apply
the claim to the local store once that succeeds — unlike cell edits
(which apply optimistically, then push), a claim needs the server's
verdict before being treated as real. `sync.js` gained `loadClaims()`
(merged into `loadSharedWorld()`'s return value, so `world.replaceAll()`
picks up claims with zero extra plumbing) and `pushClaim()`; realtime
subscription extended with claims' own INSERT event (`onRemoteClaim`),
applied via a plain `world.addClaim()` with no `applyingRemote` guard
needed — claims have no local push-hook to feedback-loop against, unlike
cells' addCell/removeCell. **Verified with two genuinely independent
browser CONTEXTS (separate localStorage, separate anonymous auth
sessions — not two tabs sharing one identity)**: Player A claimed world
center; Player B, connecting separately, received A's claim via realtime
and correctly computed a non-overlapping slot at shell 5 — confirmed
against the DB directly afterward (two rows, two genuinely distinct
`owner_id`s). Zero console/page errors in either session.

**Claims list + territory visualization added, 2026-08-12 — same session,
closing the "no UI beyond the hint" gap from the pass above.**
`regions.js` gained `claimBoundingRadius(claim)`: the EXACT real
Euclidean distance from a claim's center to the farthest cell in its own
footprint (reusing the same footprint geometry `findFreeSlot` already
computes, not an estimated formula) — needed because most of a claim's
area is typically unbuilt space with no cell to tint, so a wireframe
sphere sized to this radius is the visualization, not per-cell coloring.
`render.js`'s `refreshClaims()` rebuilds a `THREE.Group` of these spheres
(green = this session's own claims, amber = everyone else's) plus a text
list (`#claims-list`, "★" marking your own) from `world.getClaims()` on
every point claims actually change — a local grant, a remote claim
arriving via realtime, or entering/leaving Shared World — not on every
cell-level `onChange()`, since claims change far less often than cells.
Verified live (not just statically, since this touches the actual scene
graph): loaded Shared World (empty claims list, correct empty state),
clicked Claim Land, confirmed the list showed `★ claim_0_0_0 — shell 0 —
you` and a screenshot showed a real green wireframe sphere centered
exactly on the claimed seed cell, then disabled Shared World and
confirmed the list reset to empty — zero console errors throughout.
**`destructible` toggle after grant added, 2026-08-12 — same session,
closing the exact gap named above, per direct instruction.** Built
exactly as flagged: a real, narrowly-scoped RLS policy, not RLS flipped
open. `claims_update_own` allows UPDATE only from the row's own owner;
since a plain RLS `WITH CHECK` only ever sees the NEW row (can't compare
against OLD to block specific columns), a `BEFORE UPDATE` trigger
(`claims_enforce_immutable_geometry`) does the actual enforcement —
raises if `id`/`owner_id`/`shell_index`/`center_*`/`size`/`granted_at`
differ from OLD, `destructible` is the only column exempted. Verified
directly against the database BEFORE wiring any app code around it (this
is a hard safety guarantee, worth confirming in isolation first): a raw
`UPDATE ... SET destructible = true` succeeded, a raw `UPDATE ... SET
center_x = 99` on the same row failed with the trigger's own exception.
`sync.js` gained `pushClaimDestructible()` and an UPDATE handler on the
claims realtime subscription (reusing the same `onRemoteClaim` callback
as INSERT, since `world.addClaim`'s overwrite-by-key semantics already
handle both correctly with no extra logic). `render.js`'s claims list
gained a "Protected" checkbox, shown only on the player's own claims
(RLS would just silently reject an attempt on anyone else's, so there's
no point offering a control that can only fail) — reverts optimistic
local state on a failed push rather than leaving the UI lying about
server truth. Verified live end-to-end: toggled off then back on,
confirmed both the checkbox state and the DB row's actual `destructible`
column matched at every step, zero console errors.

**`RHOMBIVERSE_SPEC_LOOPHOLES.md`, two of five fixes applied, 2026-08-12
— the other three checked and found genuinely blocked or already
satisfied, not silently skipped.** Read the whole spec first: #1 (decay-
reset gaming) and #4 (claim allocation overlapping pre-seeded content)
are both hard-blocked on `SPEC_TRADE_INVENTORY.md`/`SPEC_ASTEROIDS.md`
existing, neither of which does yet. #3 (supernova/black hole matter
farming) is already closed by the existing design, not by new code: a
star can only ever detonate once (`starLedger.detonated`), and
`detonate()`'s scatter loop is a strict 1:1 match against consumed
foreign mass (`if (placed >= scatterCount) break`) — no path to net-
positive farming exists to patch. Applied the two that were both
unblocked and genuinely missing:
- **#2 (one claim per account, the claims half only — the asteroid-spawn-
  scaling half is still blocked on Asteroids not existing).** `public.
  claims` gained a real `UNIQUE(owner_id)` constraint — verified directly
  against the DB (a second INSERT for the same owner genuinely fails)
  before touching any app code, same discipline as the destructible-
  toggle trigger above. `regions.js`'s `computeClaim` gained a matching
  client-side pre-check for a fast, friendly error — the constraint is
  the real guarantee, the pre-check is just better UX. `render.js`'s
  Claim Land button now disables itself once the session already owns a
  claim, via the same `refreshClaims()` that already tracks this.
- **#5 (gravity-pull vs. destruction consent gap).** `gravity.js`'s
  `gravityAt(position, planetoids, claims)` gained a third param: reuses
  `isClaimProtected` (already proven correct for block-destruction) on
  the ENTITY's own position instead of a candidate cell — a player
  standing inside a protected claim is never gravitationally pulled,
  regardless of proximity to the hazard, closing a distinct consent gap
  from block-destruction (which was already closed). `render.js` threads
  a new module-level `currentClaims` (same cross-scope pattern as the
  existing `planetoids` variable, needed since `gravityAt` is called from
  both `init()`-scoped and module-level `animate()`/`updateGravityInfo()`
  code) through to both `player.js`'s real physics and the gravity-info
  hint text, which now distinguishes "active" from "blocked — you're in a
  protected claim" instead of showing a status that doesn't match what
  physically happens.
**Real bug caught only by live testing, not the implementation itself**:
Claim Land's own `finally` block unconditionally reset
`claimLandBtn.disabled = !sharedWorldActive` (i.e. re-enabled it)
regardless of outcome, silently undoing `refreshClaims()`'s "you already
own a claim, stay disabled" state set moments earlier in the SAME click
handler's try block — every successful claim looked fine but immediately
made the button clickable again. Fixed by re-deriving the same ownership
check in `finally` instead of a blind reset. Verified live end-to-end
after the fix: real UI click correctly grants one claim then disables the
button; forcing the button back on and clicking again gets rejected by
the real `computeClaim` guard with the exact error text; `gravityAt`
exercised directly via dynamic import in a live page (not simulated) —
a position inside a protected claim returns no gravity, the same
position with zero claims defined still returns gravity, and a position
just outside the claim but within gravity range still gets pulled. Zero
console errors throughout.

**`RHOMBIVERSE_SPEC_ASTEROIDS.md` started, 2026-08-12 — first pass, scoped
exactly to the spec's own "acquisition only" instruction (no crafting/
conversion, no planetoid-building consumption of inventory).** New
`src/asteroids.js`. Two starting belts (`belt_1`/`belt_2`, three nodes
each, 13 cells/node via `cellsInShells` radius 1 — "reuse the shellCount
structure" per section 2), placed at `[80,80,0]`/`[-80,-80,0]` —
deliberately well outside `regions.js`'s own claim-search range (real
distance under ~50 units) so belts and claims can never collide in this
pass. **One deliberate schema deviation from section 6**: no separate
`asteroidBelts` registry storing belt/node structure — belt/node geometry
is fully deterministic (fixed constants, not player-granted like claims),
so it's plain module constants + a seeding function; an asteroid cell's
own `asteroidNodeId` field (living in the normal `world.cells` map, same
pattern as `shellCenter`/`claimId`) is enough to identify its node.
`playerInventory` and a new `asteroidRegrowth` queue (this
implementation's own bookkeeping for section 4, not in the spec's literal
schema) ARE real top-level world-state, per `worldstate.js`. Mining
extends the *existing* universal right-click delete (`build.js`'s
`onContextMenu`): an asteroid-tagged cell now also credits
`playerInventory` (only when a real session identity exists — local-only
play still lets mining/regrowth work mechanically, just without inventory
bookkeeping) and registers a regrowth-queue entry instead of just
vanishing. Regrowth (`applyAsteroidRegeneration`) runs on every
`onChange()` AND on a standalone 5s `setInterval` (deliberately NOT
routed through `onChange()` — would push a phantom undo-stack entry and
re-save every tick even when nothing regrew) so a mined cell comes back
after real time passes, not only on the player's next edit. Yield
weights (section 3) are a first-guess table; **Blackstar-Glassite's
"asteroid-exclusive" wording is interpreted as yield-only, not a build-
time placement restriction** — read fully literally it would contradict
every gravity/black-hole/star-system mechanic already built and tested
this session, which all depend on BSG being freely placeable via the
material dropdown.

**Verified via real execution**, though not via a literal in-3D raycast
click on an asteroid cell — the belts sit 80+ units from the default
camera, impractical to reach without dedicated camera-navigation code
this pass didn't need to write. Instead: confirmed the REAL `init()`
pipeline seeded 78 cells across 6 nodes into the REAL live world (read
back from `localStorage` after forcing a save via an unrelated click —
first attempt checked `localStorage` immediately after page load and
found nothing, which turned out to be correct, pre-existing behavior
unrelated to asteroids: nothing is saved until the first `onChange()`,
not right after initial seeding); exercised `mineAsteroidCell`/
`applyAsteroidRegeneration` directly via dynamic import against a live
in-browser store — mining removed the cell and credited inventory
correctly, and simulating an elapsed cooldown correctly regrew it with
the original material and node id preserved. Zero console errors
throughout.

**Known limitations, explicit, not silently left out**: population-
scaled spawning (section 5) is entirely deferred — capacity is fixed at
the two starting belts regardless of active user count. The regrowth
queue is LOCAL/per-session state, not synced to Supabase — if the player
who mined a cell disconnects before its cooldown elapses, that specific
regrowth won't fire from anyone else's client (the cell's removal syncs
globally via the existing cells realtime channel, but the pending-regrow
timer tracking it does not). A rare simultaneous-first-connection race
exists for Shared World seeding (two sessions both seeding a truly fresh
world at once) — same class of narrow, accepted race as regions.js's own
claim-allocation, not worth distributed-locking machinery for a one-time
bootstrap case. `RHOMBIVERSE_SPEC_LOOPHOLES.md` section 4 (reserve
pre-seeded content before claim allocation runs) is still NOT built —
newly unblocked now that asteroids exist, but not done in this pass.

**Asteroid discoverability UI added, 2026-08-12 — closes the exact
"impractical to reach" testing gap noted in the pass above.** The
asteroids first pass had zero way to find or reach the belts short of
reading source (80+ units from the default camera framing, no minimap) —
confirmed as a real usability gap, not just a testing inconvenience, once
named explicitly. `asteroids.js` exports `listBelts()` (id + center only,
not the internal node-offset shape). `render.js`: one **"Go to belt N"**
button per belt (built from `listBelts()`, so a future third belt needs
no UI code), reframing the camera exactly like the initial
`camera.position.set(6,5,8)`/`controls.target.set(0,0,0)` setup, just
offset to the belt's own center — exits Walk Mode first if active, since
`player.js` drives `camera.position` every frame there and would
otherwise immediately override the move. A new `updateBeltHint()`
(module-level, same pattern as `updateGravityInfo`, since `listBelts()`
needs no world-state access) reports the nearest belt and its distance,
refreshed everywhere gravity info already is.

**Verified live, and for the first time via an actual 3D raycast click,
not direct module execution**: clicked "Go to belt 1", confirmed the hint
went from "113u away" to "0u away" and a screenshot showed a real cluster
of asteroid cells now in view; right-clicked at canvas center and
confirmed via a before/after screenshot comparison that a real cell
genuinely vanished (plus `Undo (1)` appearing) — the exact mining path
the earlier asteroids pass could only verify through dynamic import
because the belts were unreachable by camera. Zero console errors
throughout. Inventory correctly stayed at "connect to Shared World to
mine" in this local-only run, matching the existing, intentional design
(mining works mechanically without a session identity; only inventory
bookkeeping needs one).

**Population-scaled spawning (section 5) added, 2026-08-12 — the last
named gap in `RHOMBIVERSE_SPEC_ASTEROIDS.md`'s own scope, closing it
except for the two items noted below.** `asteroids.js`:
`target_total_capacity = base_capacity + f(active_users)` per the spec's
own formula, literally. `BASE_NODES_PER_BELT = 3` (matches the two
belts' existing hardcoded nodes — the permanent floor). "Active user" —
per `RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2's own explicit guidance
("a sanity-checked activity signal... not raw concurrent-connection
count") — means a distinct `authorId` that touched a cell within
`ACTIVITY_WINDOW_MS` (1 hour), NOT a live presence/connection count
(this repo tracks no presence at all). `sync.js` gained `updatedAtMs`
(merged from Supabase's `updated_at` column, both in `loadSharedWorld()`
and the realtime handlers) specifically to make this recency check
possible client-side. `f(activeUsers) = min(MAX_EXTRA_NODES_PER_BELT=6,
activeUsers * NODES_PER_ACTIVE_USER=2)` — bounded per the spec's own
explicit "sane upper capacity ceiling" requirement (18 nodes total
ceiling, 2 belts × 9). Extra node positions beyond the original 3
hand-placed ones are generated systematically (`extraNodeOffsets`,
reusing `cellsInShells`'s own "expand outward from a center" pattern at
a coarser granularity — node SLOTS spaced `NODE_SPACING=20` apart, not
individual cells) rather than hand-listed, so the ceiling can grow
without hand-authoring more coordinates. `applyPopulationScaledSpawning`
is purely additive by construction — the loop only ever adds nodes
below the current target; when target falls (population decline) it
simply does fewer iterations, never touching nodes already seeded at a
higher population — this IS section 5's "contracts by slowing new
growth, not by removing what's already there" guarantee, not a separate
check enforcing it. **Verified live via direct module execution against
real world-store mutations** (not simulated): 0 active users → target
stays at base, true no-op; 3 fabricated distinct recent authors →
target correctly became 9/belt, spawning exactly 18 total nodes (234
cells); 10 authors → target stayed capped at 9 (ceiling genuinely
enforced, not just documented); simulating the activity window expiring
→ target dropped back to 3, and a further spawning pass touched zero of
the 18 already-seeded nodes. Zero console errors.

**Two real cross-player bugs found and fixed, 2026-08-12, while starting
to build Supabase sync for the regrowth queue** (that work itself wasn't
finished this pass -- see below). Neither was found by review; both
surfaced only from a genuine two-browser-session live test, the same
technique already established this session for claims.

1. **Asteroid cells were undeletable by anyone except whoever happened
   to seed them.** `public.cells`'s existing `cells_delete_own` RLS
   policy requires `author_id = auth.uid()`; since `pushCellUpsert`
   omits `author_id` (relying on the column default at INSERT time),
   whichever session's `seedAsteroidBelts` call ran first became the
   permanent, sole `author_id` for all 78 seeded cells. Every other
   player's right-click "mine" would optimistically vanish the cell in
   their OWN view while the actual server-side DELETE silently failed
   (RLS violations on DELETE just affect zero rows, no error surfaced) --
   asteroid mining has never actually worked cross-player until now.
   Fixed with an additional, purely permissive RLS policy,
   `cells_delete_asteroid` (`using (data->>'asteroidNodeId' is not
   null)`) -- Postgres OR's multiple permissive policies for the same
   command together, so this is strictly additive: your own cells
   (existing policy) OR any asteroid-tagged cell (this one). Verified
   with a real two-session test: Session A seeded 78 cells (confirmed via
   direct SQL, single author, before B ever connected -- eliminating
   timing as a factor); Session B navigated to the belt and right-clicked
   a real cell; A's count dropped to 77 in the database, confirming a
   genuine cross-player DELETE succeeded for the first time.
2. **Asteroid belts were purely local/cosmetic in Shared World the whole
   time -- never actually reaching Supabase at all.** In
   `enableSharedWorld()`, `seedAsteroidBelts(world)` was called BEFORE
   `sharedWorldActive = true` was set. Every `world.addCell` call during
   seeding fires the `onAdd` hook into `handleLocalAdd`, which itself
   checks `if (sharedWorldActive && ...)` before pushing -- since that
   flag was still false during the entire seeding loop, none of the 78
   `pushCellUpsert` calls ever fired. The belts rendered correctly and
   looked completely normal in every single-session test this whole
   session (including the earlier "confirmed 78 cells across 6 nodes"
   verification, which read from `localStorage`, not Supabase) -- this
   is exactly why a second, genuinely independent session was needed to
   catch it; nothing about single-session testing could have. Fixed by
   moving `sharedWorldActive = true` before `seedAsteroidBelts(world)`.
   Verified the same way: after the fix, a solo session's seeding
   produced exactly 78 rows server-side (confirmed via direct SQL),
   where it had produced zero before.

**Bonus, unplanned confirmation from the same test session**: the
"second author" that appeared partway through this investigation looked
at first like a THIRD bug (a reseeding race) -- traced it down to
`loadSharedWorld()` returning the correct, complete row set every time
it was checked directly, which ruled that out. It turned out to be
`applyPopulationScaledSpawning` correctly firing for real: once a second
session (B) connected, A counted as one recent active author, so
`target = 3 + min(6, 1*2) = 5` nodes/belt -- exactly 2 extra nodes × 2
belts × 13 cells = 52, matching what was observed exactly. A genuine,
unplanned live confirmation of section 5 working correctly beyond the
synthetic direct-module test from the pass before this one.

**Regrowth queue synced to Supabase, 2026-08-12 — the item deferred
above, finished right after.** New `public.asteroid_regrowth` table
(`{x,y,z}` primary key, `node_id`/`material`/`mined_at`): INSERT/DELETE
open to any authenticated user, deliberately -- regrowth is a system
process, not owner-gated, same reasoning as `cells_delete_asteroid`
above. `worldstate.js`'s `setRegrowthEntry`/`removeRegrowthEntry` gained
`onRegrowthSet`/`onRegrowthClear` hooks (same pattern as `addCell`/
`removeCell`'s existing `onAdd`/`onRemove`); `sync.js` gained
`pushRegrowthSet`/`pushRegrowthClear`/`loadRegrowthQueue`, folded into
`loadSharedWorld()`'s return value and the realtime subscription
(INSERT/DELETE only -- an entry is either pending or gone, never updated
in place). `render.js`'s `applyRemoteRegrowthSet`/`applyRemoteRegrowthClear`
need the same `applyingRemote` guard cells use (unlike claims, which
have no local push-hook to suppress) but deliberately skip `onChange()`
-- setting/clearing a regrowth entry has no visual effect of its own,
the cell actually reappearing/vanishing is a separate `cells`-table event
that already triggers its own `onChange` independently. **Verified with
a real two-session test, the exact scenario this closes**: Session A
mined a real cell via a real click; confirmed via direct SQL that a row
appeared in `asteroid_regrowth`; fast-forwarded its `mined_at` to
simulate the cooldown elapsing; released Session B (which never mined
anything, didn't even know this cell existed) to connect fresh --
B's own periodic tick correctly processed A's entry: the cell reappeared
server-side with its original material and node id intact, and the
regrowth queue emptied. This is the precise gap the local-only version
had (the original miner disconnecting before their own timer fired) --
now any connected client can complete anyone's pending regrowth.

**`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 4 (claim/belt collision guard)
built, 2026-08-12 — the last open loophole, all five now resolved (two
applied, two found already-closed by existing design, this one built).**
`regions.js`'s `findFreeSlot` gained `reservedAsteroidCellKeys(world)`:
reads `world.entries()` directly rather than importing `asteroids.js` --
every asteroid cell is already tagged with `asteroidNodeId` (same
pattern as `claimId`/`shellCenter`), so "already occupied by pre-seeded
content" needed no coupling between the two modules, just another
flavor of "already spoken for," alongside the existing claims check. The
spec also names a "star system anchor" to reserve, but this
implementation has none -- Star System is a threshold crossed by a
player's OWN BSG cluster wherever THEY choose to build it, not fixed
pre-seeded content at a known coordinate, so there's nothing fixed to
reserve for it; only the belts apply here, stated plainly rather than
pretending otherwise. **Verified via direct module execution**: real
asteroid belts sit 80+ units out, genuinely beyond `regions.js`'s own
`MAX_CLAIM_SEARCH_SHELL=40` search range, so the collision can't occur
in normal play with real belts -- to prove the guard itself works
rather than just that it's unreachable, a synthetic asteroid-tagged
cell was placed at world center (0,0,0), exactly where a claim would
otherwise land first. Confirmed the claim correctly diverted to
`(3, 3, 0)`, shell 3 -- the nearest position whose own 2-shell footprint
(bounding radius ~2.8 units) clears the reserved cell (real distance
~4.24 units) -- rather than overlapping it. Zero console errors.

**`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` started, 2026-08-12 — data layer
first (decay + full trade logic), matching regions.js's own "start lean"
precedent, not wired to Supabase sync or a UI yet.** `worldstate.js`'s
`playerInventory` entries changed shape from a bare number to
`{quantity, lastUsedAt}` per the spec's own section 5 schema (only
`asteroids.js`'s existing `creditInventory` call site was affected, and
its signature stayed backward-compatible via a defaulted `now` param).
New `src/trade.js`: `applyInventoryDecay` (flat per-material free
thresholds, roughly scaled to `RHOMBIVERSE_SPEC_ASTEROIDS.md`'s own
yield rarity; decays quantity above threshold in discrete ticks matching
`asteroids.js`'s own regrowth-cooldown SHAPE exactly, per the spec's
explicit "do not invent a new decay formula" instruction — same 30s tick
value, intentionally, not coincidentally) and the full barter engine
(`proposeTrade`/`confirmTrade`/`cancelTrade`, atomic resolution only once
both parties confirm, re-verifying both offers are still affordable at
resolution time since inventory can drift between proposal and
confirmation). **"Using material" has exactly one real meaning in this
implementation: completing a trade that spends it** — building remains
completely free/inventory-independent, per the still-standing deferral
in `RHOMBIVERSE_SPEC_ASTEROIDS.md`'s own Claude Code prompt, which
nothing in this spec's own prompt reverses. `RHOMBIVERSE_SPEC_LOOPHOLES.md`
section 1 ("trade receipt never resets decay on its own") is satisfied
by construction, not a special case: `creditInventory` only stamps a
fresh clock for a material the receiver has genuinely never held before;
an existing stockpile's own clock is always preserved through a trade.
**Verified via direct module execution**, including catching two flawed
test assertions before trusting the result: decay correctly floors at
the free threshold and never touches below-threshold stock; the full
propose → single-confirm (no effect yet) → both-confirm → atomic swap
sequence produces exactly the right quantities on both sides; a spent
stack's clock resets to a genuine fresh timestamp (the first test
compared against a stale frozen value instead of the real resolution-time
`Date.now()`, caught and re-verified correctly); the actual Loopholes
scenario — a receiver who ALREADY holds stale stock receiving more via
trade — correctly leaves their existing clock untouched (the first test
checked first-time acquisition instead, which correctly does get a fresh
baseline since there's no existing decay state to protect, not a
violation of anything); cancelling a trade leaves both inventories
untouched; proposing with insufficient funds throws and creates no
pending trade. Zero console errors throughout. **Deliberately not done
this pass**: no Supabase sync for `playerInventory`/`pendingTrades`, and
no UI at all (propose/confirm/inventory display) — both natural next
slices, matching how regions.js's own data-layer-first start later
gained sync and UI across separate follow-up passes.

**New large "Rocky Planetoid" preset added, 2026-08-12 — user feedback
on the live, now-public deploy: the existing three presets (15–21 cells
each) read as "a few stuck together rhombis," not spheres.** Not a bug
— confirmed live, screenshotted, and root-caused: those presets were
deliberately built as minimal FUNCTIONAL fixtures (e.g. `black-hole-core`
is exactly `BLACK_HOLE_BSG_THRESHOLD`, 20 BSG cells, nothing more), and
rhombic dodecahedra are angular, not curved -- a small cluster genuinely
can't read as round regardless of any code fix; only a large-enough
shell count starts approximating a sphere's silhouette. `data/presets/
rocky-planetoid.json` (923 cells: 1 BSG core + shells 1–6) fixes the gap
directly rather than by tuning anything -- generated via the REAL
`generatePlanetoid` (`planetoidgen.js`, the same function **Generate**
mode already calls live) at `totalShells=6`, the exact same generation
path already verified correct when Generate mode itself shipped, not a
hand-rolled/re-derived structure. Added as a new `#preset-select` option.
**Verified live**: loaded it, confirmed material counts exactly matched
the rocky recipe's own bands (1 BSG / 54 ferrostone / 254 garnet / 614
base -- shells 1–2/3–4/5–6 respectively), and a real screenshot (properly
zoomed out -- OrbitControls' zoom direction on this project is positive
`deltaY` = zoom OUT, easy to get backwards, caught by looking at the
first attempt's screenshot rather than assuming) shows a genuinely round,
recognizably planet-shaped silhouette, not a small blocky clump. Zero
console errors.

**Entry welcome overlay + wireframe RD branding, 2026-08-13.** New
`src/welcome.js`: a first-run modal (localStorage-flagged, checkbox-
gated "don't show again," reopenable via a persistent "i" button) with
a plain-language description, a how-to-play list, and an
under-construction disclaimer made a running motif per direct request
(page title, Open Graph/Twitter meta, a construction-tape badge, and a
small persistent on-screen tag during play — not just a paragraph).
Logo (both `favicon.svg` and the in-card SVG) is the project's own
voxel shape, not generic art: real `rdRawVerts` coordinates rotated to
a non-axis-aligned angle so no vertex overlaps another. **Real bug
caught and fixed**: the favicon's own descriptive comment used this
project's usual `--` dash style, which is invalid inside an XML
comment and silently broke standalone `.svg` rendering — confirmed via
a direct Playwright load before/after. `TERMS.md`/`PRIVACY.md` updated
same day to actually describe Shared World and land claims (they'd
drifted stale since Phase 5 shipped, still saying "no accounts, no
backend"), plus a "note on cooperation" section framing Shared World as
an open commons, per direct request.

**Repo opened to public/AI contribution, 2026-08-13, direct
instruction ("I want humans and AI to be able to visit make
improvements and have impact").** Full git-history secrets audit first
(clean — no `.env`/service-role keys ever committed, only the
already-documented public Supabase publishable key) before anything
irreversible. Added `CONTRIBUTING.md` (explicitly welcomes disclosed
AI-assisted PRs on equal footing with human ones — accurate, since this
repo has genuinely been built that way from the start) and the standard
Contributor Covenant `CODE_OF_CONDUCT.md`. Confirmed with the user, then
flipped the GitHub repo private→public via `gh repo edit`. GitHub
Discussions enabled with light structured Forms on Ideas/Q&A
(`.github/DISCUSSION_TEMPLATE/*.yml`) and a pinned welcome post — aimed
at encouraging participation while discouraging drive-by/low-effort
posts, per direct request, not gatekeeping it.

**Shared World security hardening pass, 2026-08-13** — prompted by
going public: the Supabase publishable key + full schema are now
visible to anyone. Closed `RHOMBIVERSE_COMPLIANCE.md`'s two remaining
"required before Phase 5" gaps for real: **rate limiting**
(`schema.sql`'s `cells_rate_limit` trigger, a token bucket sized to
never punish one legitimate huge Fill/Generate click while still
bounding scripted abuse — Adaptive Damping, reused not reinvented) and
**backups** (a daily `pg_cron` snapshot into `world_snapshots`, honestly
scoped as protection against realistic failure modes, not off-platform
disaster recovery). Both verified live via direct SQL against a
simulated `auth.uid()` context (token math, rejection, refill; snapshot
correctness). Found and fixed real issues along the way while already
in the schema: a mutable-search-path advisory on the pre-existing
claims trigger, `check_rate_limit()` exposed as a public RPC endpoint,
and investigated (not just assumed) pg_cron's default anon-execute
grant on `cron.schedule` — confirmed via a real curl against the
publishable key that PostgREST 404s there (only routes to `public`
schema), so left as a documented non-issue rather than chased further.
`render.js`/`sync.js` gained a debounced `#sync-warning` on-screen
notice so a rejected write is visible instead of silently desyncing —
verified via a real mocked-rejection browser test.

**`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` finished — Supabase sync + UI,
2026-08-13**, closing the one gap left in its own status (data layer
existed, no sync/UI). Real trust-model distinction from every other
synced table: a cell is basically cosmetic, but inventory is a
currency-like resource — a client that could freely upsert its own
quantity would trivially break the barter economy. So unlike cells
(client computes, server authenticates+stores), inventory writes are
NEVER directly grantable; new `public.player_inventory` has a
world-visible SELECT policy (doubles as trade-partner discovery, no
chat/DM system exists) but no insert/update policy for any player role
at all. The only two ways it can change: `mine_asteroid_cell()`, a
SECURITY DEFINER RPC that re-reads the real cell server-side (never
trusts a client-supplied material) before deleting it, queuing
regrowth, and crediting exactly 1 of the verified material — replacing
the old client-driven delete+credit for the Shared World case
specifically (local-only play keeps `asteroids.js`'s own
`mineAsteroidCell`, untouched); and new `public.pending_trades` +
its `resolve_trade_if_ready` trigger, which fires the atomic swap the
instant both `confirmed_a`/`confirmed_b` land, re-verifying both sides
can still afford their own offer at that exact moment (inventory may
have moved since proposal) and dropping the trade with zero partial
effect if not — a `pending_trades_enforce_confirm_only` trigger (same
immutable-except-one-column pattern as claims) ensures a caller can
only ever flip their OWN confirmation. Decay is also server-side now
(a `pg_cron` job every 5 minutes, same formula shape as `trade.js`'s
own local version, reused not reinvented) since a client can no longer
write its own decayed value; `render.js`'s `onChange()` now skips the
local decay pass entirely while Shared World is active, to avoid the
display drifting out of sync with the server between realtime updates.
UI: a compact single-material-each-side trade form (not a full
multi-item basket — the spec's own "no marketplace/listings" scope
limit made this the right amount of simplicity) plus a live pending-
trades list with Confirm/Cancel, both only shown while connected (local
single-player has no second identity to trade with, so there's nothing
meaningful to show).

**Real bug caught only by an actual two-browser-session UI test, not
the direct-SQL verification that came first**: `#propose-trade-btn`
(and everything below it in a now-much-longer control panel) was
genuinely unreachable — `#controls` had `position:fixed` with no
`max-height`/`overflow-y`, and `body` has `overflow:hidden` for the 3D
canvas, so once the panel's content grew past the viewport height there
was no way to scroll to it in a REAL browser, not just a test
artifact. Fixed by giving `#controls` its own `overflow-y:auto` up to
the viewport height. This was a latent, pre-existing gap the earlier,
shorter panel never happened to trigger — worth remembering that a
UI-growing feature can surface a layout bug unrelated to its own logic.

**Verified end-to-end via two genuinely independent browser sessions**
(separate localStorage/anon auth, matching the established convention
from the claims work): Player A mined a real asteroid cell via a real
right-click (credited via the RPC, confirmed in `#inventory-hint`),
Player B mined a different one; A's trade-partner list correctly showed
B (and vice versa) via the public inventory data; A proposed a real
trade through the actual form; B saw it appear via realtime and
confirmed through the real Confirm button; A confirmed theirs, which
triggered server-side resolution; both sides' pending-trades lists
correctly emptied and inventory reflected the swap (including a
same-material edge case — both players happened to mine `base` — which
also proved the resolution trigger doesn't double-count when a swap
touches the same inventory row twice in one transaction, confirmed
exactly correct via direct SQL afterward). Zero console errors across
both sessions throughout. All test identities' cells/inventory/rate-
limit rows cleaned from the live shared database after verification,
same discipline as every other live-DB test this session.

**To continue implementation**, all four Phase 5.5 addenda (Water/Ice,
Black Hole, Star System, Supernova), Phase 5 (Shared World),
`RHOMBIVERSE_SPEC_REGIONS.md`, `RHOMBIVERSE_SPEC_ASTEROIDS.md`,
`RHOMBIVERSE_SPEC_LOOPHOLES.md`, and `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`
are all done now. Phase 5.8 (Trust Zones/Moderation) is closed out as
**deliberately, intentionally partial** (see its 2026-08-13 status
above) — the flagged/removed Report mechanism is built and working; the
three-tier reachability gate, age/mode selector, COPPA review, and a
moderator-scaling plan are explicitly deferred with documented reasons,
not left incomplete by oversight. Nothing named remains open anywhere
in this repo's scope, besides the explicitly-deferred crystal-growth
mode. The repo is public
(`github.com/DICTOR-Master/rhombiverse`) with Discussions enabled. Ask
before assuming what's next.
Crystal-growth mode (Phase 5.5's other bullet,
cells auto-growing over time) was intentionally left unbuilt; the plan
marks it optional/tied to Phase 6 timing. Public deploy is DONE (see the
2026-08-12 entry above, live at https://rhombiverse.vercel.app) — the
repo itself stays private (Vercel deploys from it without requiring
public visibility), but the built site is genuinely live and public now;
factor that into any future security/compliance judgment calls (e.g. the
XSS audit already done in Phase 4 is no longer a hypothetical-future
concern).
Each subsequent phase and spec addendum ends with its own copy-paste-ready
Claude Code prompt — use those rather than improvising scope, they're
calibrated to build on exactly what the prior phase produced.

## Read this before touching anything

- **No build step, by design.** `index.html` loads Three.js via an ES
  module import map from a CDN — no npm/webpack/vite. This is a direct
  application of Grounded Simplicity (`docs/RHOMBIVERSE_PRINCIPLES.md`
  section 0): the simplest thing that still works, and it keeps the repo
  trivially deployable as static files (GitHub Pages / Vercel, Phase 4).
  Don't introduce a bundler unless a real requirement forces it.
- **The world is data, not baked geometry** (`RHOMBIVERSE_PLAN.md` section
  0, the "golden rule"). Every mechanic in every spec extends the same JSON
  world-state additively — new top-level keys (`planetoids`, `claims`,
  `asteroidBelts`, `playerInventory`, `pendingTrades`) or new per-cell
  fields, never a breaking schema change. If an implementation task seems
  to require restructuring existing schema fields, stop and re-read the
  relevant spec — that's almost certainly not what's being asked for.
- **`RHOMBIVERSE_PRINCIPLES.md` governs every other doc and is not optional
  reading.** Three binding laws, in order of precedence:
  1. **Grounded Simplicity** — borrow real physics or established
     convention over inventing something arbitrary; prefer the simplest
     version that still works. Applied throughout: FCC crystallography,
     white-dwarf-density-as-gravity (Blackstar-Glassite), Schwarzschild
     asymptotic behavior (black hole), Chandrasekhar-limit detonation
     (supernova), icy-moon subsurface oceans (Ice 9.9).
  2. **Isolation** — any subsystem that can go unstable must define its own
     bounded **blast radius**; a local problem never propagates world-wide.
  3. **Adaptive Damping** — correction/tolerance mechanisms must widen
     (boundedly) with repeated correction and decay during calm periods,
     not use a single fixed threshold forever. Reused verbatim (not
     reinvented) by black hole cost-scaling, supernova threshold approach,
     asteroid population-scaled spawning, and inventory decay.
  Every future spec is expected to state its blast radius and its
  volatility/decay tuning explicitly, the same way "Success Checks"
  already is a required section.
- **`shellCount(n) = 10n² + 2`** (FCC shell size at radius `n`) is the one
  formula reused across nearly every subsystem: core-cavity sizing
  (gravity), recentering-shockwave tolerance (gravity), asymptotic
  space-generation cost (black hole), asteroid node internal shape, claim
  allocation shell-filling (regions). Implement it once, import it
  everywhere — do not let a second spec quietly reimplement it.
- **12-neighbor FCC adjacency** is the other universal primitive: valid
  cell = `(x,y,z) ∈ ℤ³` where `x+y+z` is even; 12 offsets in
  `RHOMBIVERSE_PLAN.md` section 2. Lattice propagation (hydrosphere
  permeation), shell counting, and claim allocation all walk this same
  offset table — implement it once in `src/lattice.js`.
- **"region" is two unrelated fields — do not conflate them.** The per-cell
  `region` field (`RHOMBIVERSE_PLAN.md` Phase 5.8) is a *moderation*
  status (`core`/`reviewed`/`open`). Ownership is a separate field,
  `claimId` (`docs/RHOMBIVERSE_SPEC_REGIONS.md`). A cell can have both at
  once; they answer different questions. This collision is called out
  explicitly in the regions spec — read it before touching either field.
- **`destructible` is a single flag with two effects, not two flags.** It
  lives on a `claims` entry (not per-cell) and gates both block-destruction
  *and* entity-pull consent for that claim (the entity-pull gap was a
  loophole fixed in `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` section 5 — don't
  add a second consent field for entities, extend the existing one).
- **Cross-player black hole/supernova consumption is never allowed, full
  stop — binding direct instruction, 2026-08-12.** Not opt-in, not
  `destructible`-gated: `blackhole.js`'s `applyBlackHoleConsumption` and
  `supernova.js`'s `detonate` both skip any candidate cell whose
  `authorId` (stamped from Supabase's `author_id` column by `sync.js`,
  merged into cell data client-side) differs from the black hole/star's
  own sticky `coreCell.authorId`. This predates and is independent of
  Phase 5.8's eventual region/claim/consent system — treat it as a hard
  floor Phase 5.8 builds on top of, not something Phase 5.8 introduces.
  Any future consumption-adjacent mechanic (new spec, new material) must
  preserve this check, not bypass it.
- **Decay-reset and multi-account loopholes are spec-acknowledged, not
  spec-solved.** `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2 explicitly
  states multi-accounting has no full spec-level fix (needs platform-level
  account verification, out of scope). Don't write code or comments
  implying it's solved — document it as a known gap, per that spec's own
  instruction.

## Build order (full detail in `RHOMBIVERSE_PLAN.md` section 4)

Phases 1–4 are the base game (single-player, local, becomes public/static
once deployed). Phase 5+ and the spec addenda layer on progressively:

1. **Lattice + Renderer** — one RD renders, camera orbits. No interactivity.
2. **Build Tool** — face-picking raycast, click to add/remove cells.
3. **Local Persistence** — `localStorage` save/load, JSON export/import.
4. **Deploy Publicly** — static deploy (GH Pages/Vercel), still single-player.
   *`docs/RHOMBIVERSE_COMPLIANCE.md`'s "Required before Phase 4" checklist
   (LICENSE, ToS, Privacy Policy, SECURITY.md, XSS audit) must be done
   before this phase ships, not after.*
5. **Shared World** (optional) — swap persistence backend to realtime sync.
   DONE, 2026-08-12 (see status above) — Supabase `public.cells` table +
   `src/sync.js`, gated behind an opt-in toggle (local single-player play
   is still the default and fully unaffected when it's off).
5.5. **Planetoid Building + Radial Gravity** — DONE, commit `30cd1c8` (2026-08-11,
     see status above), except crystal-growth (intentionally deferred to
     Phase 6 timing). `docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`.
     Also unlocks four addenda, whose REAL dependency order is not the
     order the docs list them in: **Water/Ice → Black Hole → Star System
     → Supernova** (Star System hard-depends on Water/Ice's hydrogen/
     oxygen; Supernova depends on both Star System and Black Hole).
     - Water/Ice (`SPEC_WATER_ICE.md`) — DONE, commit `ce528da` (2026-08-11).
     - Black Hole (`SPEC_BLACKHOLE.md`) — DONE except the Phase 5.8-
       dependent cross-player consent model, deliberately scoped for
       single-player per direct instruction (see status above).
     - Star System (`SPEC_STAR_SYSTEM.md`) — DONE (2026-08-11, see status above).
     - Supernova (`SPEC_SUPERNOVA.md`) — DONE (2026-08-11, see status above). All four addenda complete.
5.8. **Trust Zones / Moderation** — region moderation states + review
     pipeline. `docs/RHOMBIVERSE_SPEC_REGIONS.md` (ownership claims) and
     the asteroid/trade specs assume this exists — implement before those
     if working out of order. *`RHOMBIVERSE_COMPLIANCE.md`'s Phase 5.8
     checklist includes a real COPPA review if minors may use the app —
     legal, not just technical.*
6. **Penrose/RT Growth Layer** (v2) — additive-only `growth.js`, does not
   modify `build.js`. Not designed yet beyond the one-paragraph mention in
   the plan; needs its own spec pass before implementation.

`docs/RHOMBIVERSE_SPEC_ASTEROIDS.md` (mining/resources) and
`docs/RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` (barter/decay) extend Phase 2's
build/delete tool and can be built any time after it, independent of the
5.x gravity/moderation track. `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` patches
gaps across five other specs — apply it once those specs exist, don't skip
it as "just cleanup."

## Compliance

Nothing in `docs/RHOMBIVERSE_COMPLIANCE.md` blocks Phases 1–3 (this repo's
current target). Before implementing Phase 4 (first public link), scaffold
`LICENSE` (ask which license — near-irreversible once adopted), a minimal
`TERMS.md`, `PRIVACY.md`, and `SECURITY.md` per that doc's own suggested
Claude Code prompt. Don't build backend-auth/rate-limiting/GDPR items until
Phase 5 actually introduces a real backend — implementing them earlier
would be premature per Grounded Simplicity.
