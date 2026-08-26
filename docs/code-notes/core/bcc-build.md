# Notes: `src/core/bcc-build.js` and the BCC dual-lattice build feature

Full design rationale/history, moved out of the source so the code
itself stays lite and readable. See `CONTRIBUTING.md`'s "Ground rules"
for why this split exists. Covers `src/core/bcc-build.js` plus its
wiring across `src/render.js`, `src/core/build.js`, `src/core/
persistence.js`, and `index.html`.

## Background

`geometry-extensions/bcc-detail-lattice.js` already had a BCC dual-
lattice *preview* -- a client-side-only ghost mesh, regenerated live
from the camera position, never touching world state ("your world is
untouched," its own in-app hint text). 2026-08-26: direct request to
make BCC cells real, placeable, saveable, and able to visually join the
normal FCC/RD World -- reached after a scoping conversation covering
several real open questions, resolved as follows (see `git log` for the
full back-and-forth):

- **Materials**: same `MATERIAL_COLORS` palette as the main world, no
  tint, no second material system.
- **Overlap**: explicitly ALLOWED, by direct instruction, for the
  builder's own structures -- not prevented, not even checked for. The
  two lattices are meant to be able to visually join by overlapping
  where they meet, not just touch.
- **Storage**: a genuinely separate world store (own `createWorldStore`
  instance, own localStorage key), not a `kind` tag merged into the main
  `cells` Map. This turned out to be necessary regardless of the overlap
  decision -- BCC's "even" coordinate family (e.g. `(2,0,0)`) is
  *simultaneously* a valid FCC coordinate, and a plain `Map` keyed by
  `(x,y,z)` can only hold one value per key no matter how permissive the
  placement rule is.
- **Entry mode**: a genuinely separate build controller and mode, not a
  generalization of `core/build.js`'s own (RD-shape-specific) raycast/
  ghost-preview machinery -- mirrors the precedent Sculpt and Plant
  modes already set (their own systems, gated behind the same
  `.mode-btn[data-mode="..."]` convention).
- **Placement mechanic**: the same face-click UX as normal build (hover
  a face, click, the next cell appears adjacent), driven by the
  truncated octahedron's own 14 neighbor directions
  (`BCC_NEIGHBOR_OFFSETS`, defined since Phase 1 of the dual-lattice
  work but unused until now) instead of RD's 12.

A real numeric question got resolved along the way too: does a BCC cell
at the documented scale (`bccShapeScaleFor(subScale) = subScale/2`)
actually overlap its FCC neighbors, or just touch? Verified via SAT over
the real face-normal directions already in the codebase (RD's 12
`NEIGHBOR_OFFSETS` + the truncated octahedron's 14
`BCC_NEIGHBOR_OFFSETS`): exact, zero-tolerance tangent contact -- no
gap, no overlap, everywhere checked (all 8 odd-parity neighbors of an
FCC point, plus the even-parity family). That's the *default* placement
scale now; nothing in this feature enforces it or prevents a cell from
landing closer.

A separate, unrelated geometric question came up mid-build too (also
verified numerically, not just reasoned about): does growing FCC/RD
shells outward converge to a truncated octahedron, and the reverse for
BCC shells to an RD? Checked with the real `cellsInShells` -- BCC shell
growth converges to an EXACT rhombic dodecahedron (not asymptotically,
exactly, from the very first shell: `BCC_NEIGHBOR_OFFSETS` are literally
`rdRawVerts(1)` scaled by 2, vertex for vertex), but RD shell growth
converges to a cuboctahedron instead, not a truncated octahedron
(`NEIGHBOR_OFFSETS` are a cuboctahedron's own 12 vertices). One
direction of the symmetry holds exactly; the other doesn't. Doesn't
change anything about this feature's scale choice -- shell-growth shape
is a function of the neighbor-offset combinatorics, invariant to any
render-scale parameter.

## `src/core/bcc-build.js`

`matchBCCNeighborOffset` mirrors `core/build.js`'s own
`matchNeighborOffset` exactly, just against `BCC_NEIGHBOR_OFFSETS`
instead of `NEIGHBOR_OFFSETS`.

`createBCCBuildController` is deliberately much smaller than
`createBuildController` -- click-to-place, right-click-to-remove only.
No ghost-preview, no drag-placement, no touch support, no fill/round/
excavate/generate/report modes -- those are real `build.js` features
this controller doesn't reimplement, since none of them were part of
what was actually asked for ("same face-click mechanic as normal
build"). Worth adding later if wanted, not assumed necessary now.

`pick()` raycasts against BOTH `bccMesh` and `fccMesh` at once
(`raycaster.intersectObjects`, closest hit wins), not just `bccMesh` --
this is what makes the bootstrap case work: with no BCC cells placed
yet, there's nothing to click ON in BCC mode without also being able to
hit the normal World. When the closest hit is the FCC mesh, the next BCC
cell is seeded via `nearestBCCCell` from that face's clicked position
outward along its normal, using the exact same "snap to nearest real
BCC lattice point" function the ghost preview already uses to seed
itself from the camera. When the closest hit is the BCC mesh itself,
it's the normal case -- extend from that cell via
`matchBCCNeighborOffset`.

## `core/build.js`'s new `mode === 'bcc'` guards

Both attach their `click`/`contextmenu` listeners to the same
`renderer.domElement`, so both controllers' handlers run on every click
regardless of which mode is active -- exactly the same situation
`'plant'`/`'sculpt'` were already in, and the fix is the same: an early
`return` for the mode this controller doesn't own. Without the
`onContextMenu` guard specifically, right-clicking a BCC-mode click that
happened to hit an FCC cell would have deleted that FCC cell -- `mode ===
'bcc'` was truthy, so the existing `if (!getMode()) return;` gate never
caught it.

## `render.js` wiring

- `bccWorld`: a second `createWorldStore(...)` instance (same factory
  the main world AND Sculpture Mode's own scratch world already use),
  loaded from its own key (`BCC_STORAGE_KEY`) via `loadFromLocalStorage`,
  with no World-Systems hooks (regrowth/seeds/etc) -- this build is
  Rhombeometry-only, those never apply.
- `bccMesh`: its own `InstancedMesh` (`buildBCCGeometry`, the truncated-
  octahedron equivalent of `buildRDGeometry`), own material clone (same
  recipe as the main mesh's, so `instanceColorFor`'s per-cell coloring
  works identically).
- `bccCellOrder`: a genuinely SEPARATE module-level array from the main
  world's own `cellOrder`. `rebuildInstances()` (the main world's
  instance-rebuild function) overwrites the shared `cellOrder` it reads
  from `cellAt(instanceId)`; calling it for BCC cells would have
  silently corrupted the main world's own click hit-testing. A small
  parallel `rebuildBCCInstances()` writes to its own array instead.
- `onBCCChange()`: deliberately NOT the main world's own `onChange()` --
  that function is entirely World-Systems machinery (asteroid
  regeneration, hydrosphere, achievements, the undo stack...), all of it
  off in Rhombeometry mode anyway, the only mode this build ever runs
  in. Mirrors how Sculpture Mode's own `sculptTarget.apply` is a small
  dedicated rebuild too, not a reuse of the heavy main pipeline.
- The `#bcc-build-row` mode-btn lives in the Lab panel (not the wheel --
  every wheel face is already allocated, see `rhombic-wheel-3d.md`'s own
  "temporary duplicates" note; reallocating one wasn't part of what was
  scoped here), gated to Rhombeometry-only the same way the `#bcc-toggle`
  preview button already is.
- `MODE_HINTS.bcc` / `PLAYER_FACING_MODE_LABEL.bcc`: reuse the existing
  generic per-mode hint/HUD-label infrastructure rather than adding a
  separate hint element.
- `clearWorldToNew` (Clear World) now also resets `bccWorld` and its own
  localStorage key -- a "fresh start" should mean both stores, not just
  the main one.

## `core/persistence.js`'s `BCC_STORAGE_KEY`

A completely separate localStorage key
(`rhombiverse-bcc-world`), not a field merged into the main world's own
JSON blob. The main world has ~11 separate
`saveToLocalStorage(world.toJSON())` call sites scattered across
`render.js` (undo, Shared World sync, the initial shared-link load,
Clear World...) -- folding BCC data into that same JSON would have
meant auditing and updating every one of those call sites to also carry
it, with a real risk of missing one and silently losing BCC data on
some code path. A separate key sidesteps all of that: none of those
call sites need to change, and none of them can accidentally clobber
BCC data either.

## Verified live (Playwright, `tests/browser`)

Left-click bootstraps a real BCC cell from a clicked FCC face (checked:
lands on a genuinely valid all-same-parity coordinate). A second
left-click on that cell's own face extends it via a real
`BCC_NEIGHBOR_OFFSETS` step. Right-click removes it. A full page reload
preserves placed cells (round-tripped through the real
`BCC_STORAGE_KEY`, not just an in-memory object). Zero console/page
errors through the whole sequence.
