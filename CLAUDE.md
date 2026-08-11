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

To reconstruct the harness: portable Node was extracted to a scratch
dir (not this repo); a scratch npm project has `three@0.185.1` in
`node_modules`; **the real `src/*.js` files need `node_modules`
findable via Node's own resolution from their location** (`import * as
THREE from 'three'` in `build.js` resolves relative to `build.js`, not
the test script) — a symlink `~/rhombiverse/node_modules ->
<scratch>/node_modules` makes that work, and must be removed again
after testing (it's `.gitignore`d, but isn't part of this repo's actual
structure — the project is deliberately build-tool-free, see "No build
step" below). Two established test patterns:
`test-fill.mjs`-style (full raycast + real click dispatch, for anything
touching `matchNeighborOffset`/mode dispatch) and
`test-modeui.mjs`/`test-undo.mjs`-style (mock DOM elements + a verbatim
copy of the specific render.js logic under test, for pure DOM-wiring
logic that doesn't need real geometry).

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
audit completed with no fixes needed). **LICENSE deliberately deferred
and actual public deploy (GitHub Pages/Vercel) explicitly held off** —
direct instruction: repo stays unlicensed/private and undeployed until
the user asks again ("the game is not near any level of sophistication to
actually play yet"). Don't deploy publicly without asking first, even
though the compliance checklist itself is otherwise clear.

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
dispatch against a live page. This environment also has no system
Chromium and no passwordless `sudo` (interactive auth required), so
installing a system browser wasn't an option either. Instead: a throwaway
Python venv (in the session scratchpad, not this repo) with `pip install
playwright` + `playwright install chromium` — no sudo needed, downloads
its own Chromium build to `~/.cache/ms-playwright` (that cache **does**
persist across sessions since it's under `$HOME`; only the venv itself
is ephemeral, so a future cold session can `python3 -m venv` + `pip
install playwright` fresh and skip the ~200MB browser download if that
cache is still present). Served the repo via `python3 -m http.server`,
then drove a real page load with Playwright: selected Blackstar-Glassite,
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

**To continue implementation**, Phase 5 (Shared World, optional realtime
sync) or the specs Phase 5.5 unlocked (black hole, star system,
supernova, water/ice — see Build order below) are next, or Phase 5.8
(Trust Zones/Moderation) if working toward a real public deploy — ask
which, don't assume. Crystal-growth mode (Phase 5.5's other bullet,
cells auto-growing over time) was intentionally left unbuilt; the plan
marks it optional/tied to Phase 6 timing. Actual public deploy (Phase 4's
GH Pages/Vercel step) is still explicitly held off per the instruction
above — don't do it without asking again, even though the mechanics have
moved well past Phase 4 in scope.
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
5.5. **Planetoid Building + Radial Gravity** — DONE, commit `30cd1c8` (2026-08-11,
     see status above), except crystal-growth (intentionally deferred to
     Phase 6 timing). `docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`.
     Also unlocks the black hole (`SPEC_BLACKHOLE.md`), star system
     (`SPEC_STAR_SYSTEM.md`), supernova (`SPEC_SUPERNOVA.md`), and
     water/ice (`SPEC_WATER_ICE.md`) addenda, each building on the last —
     none of these four started yet.
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
