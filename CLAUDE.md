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

**Phase 3 (local persistence) is implemented, NOT yet visually
verified.** `persistence.js` gained `saveToLocalStorage`/
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
alerts on invalid JSON rather than silently failing). **Not yet
verified** — after hard-refreshing, build something, refresh the page
again, and confirm the build persists (Phase 3's actual success check);
also try Export then Import to confirm round-tripping works, and New
World to confirm it resets after confirmation.

**To continue implementation**, Phase 4 (deploy publicly: GitHub
Pages/Vercel, still single-player) is next — see `RHOMBIVERSE_PLAN.md`
section 4. Before that phase ships, `docs/RHOMBIVERSE_COMPLIANCE.md`'s
"Required before Phase 4" checklist (LICENSE, ToS, Privacy Policy,
SECURITY.md, XSS audit) needs doing — not yet started.
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
5.5. **Planetoid Building + Radial Gravity** — `docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`.
     Also unlocks the black hole (`SPEC_BLACKHOLE.md`), star system
     (`SPEC_STAR_SYSTEM.md`), supernova (`SPEC_SUPERNOVA.md`), and
     water/ice (`SPEC_WATER_ICE.md`) addenda, each building on the last.
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
