# Notes: `src/core/pyramid.js` (+ `lattice.js`'s `pyramidPieces`)

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

`RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md` (a standalone addendum, `~/Downloads/`,
outside the repo): every RD decomposes exactly into a cube plus 6 square
pyramids, one per cube face. This module lets a player add/remove
individual pyramids on an already-placed cell, finer-grained than the
existing whole-block Rhombi-model/Rhombi-sculpt tier.

## `lattice.js`'s `pyramidPieces(s)`

Derives the cube + 6 pyramids directly from `rdRawVerts(s)` (the SAME 14
points the whole-block render/collision geometry already uses via
`buildRDGeometry()`) rather than recomputing vertex math — if `rdRawVerts`
ever changes, this stays correct for free, per the spec's own instruction
("this extraction should be a single shared utility function"). `s` here
means whatever `rdRawVerts`'s own `s` already means project-wide (the
spec's literal "half-width" wording is satisfied by matching the
project's actual existing convention, not by inventing a new parameter
shape). `PYRAMID_AXES` fixes the key order to `OCTA_VERTS`' own
(+x,-x,+y,-y,+z,-z), so `apexRaw[i]` from `rdRawVerts`'s last 6 vertices is
guaranteed to line up with `PYRAMID_AXES[i]`.

## Bitmask (`FULL_PYRAMIDS`, `hasPyramid`, `withPyramid`, `withoutPyramid`, `presentAxisKeys`, `effectivePyramids`)

A cell's real pyramid state is a 6-bit mask, one bit per `PYRAMID_AXES`
entry. An ABSENT `cell.pyramids` field reads as `FULL_PYRAMIDS` (all 6
present) via `effectivePyramids` — the overwhelmingly common case (every
untouched cell, every whole-block-placed cell) needs zero schema
migration and adds zero JSON bytes. `applyPyramidEdit` (below) actively
deletes the field again once a cell is edited back to full, rather than
writing `FULL_PYRAMIDS` explicitly, to keep that property true forever,
not just at world-load time.

## Identifying which pyramid a raycast hit

The real, initially-surprising part. `pyramidAxisForNormal`,
`candidateAxesForNeighborOffset`, `nearestPyramidAxis`, and the combined
entry point `resolvePyramidAxisForHit` exist because of a wrong first
assumption, caught by actually building and inspecting the real
`ConvexGeometry` output (a Playwright script dumping every triangle's
vertex labels and normal) before writing any resolution logic — not
reasoned out and trusted blind.

**Wrong assumption**: that each of the RD's 24 real hull triangles has
exactly one pyramid's apex vertex + 2 cube vertices, so the hit triangle's
own vertices would directly identify which pyramid it belongs to.

**What the real hull actually does**: `ConvexGeometry` (QuickHull) fans
each of the 8 cube (three-valent) vertices out to its 3 neighboring apex
pairs — every one of the 24 triangles has exactly **2 apex vertices + 1
cube vertex** (confirmed by dumping all 24 and counting). This
triangulates each genuine rhombic face along its APEX-apex diagonal, not
its cube-cube diagonal — the opposite of what a "one triangle per pyramid
side" mental model assumes. So a hit triangle's own vertex set does NOT
by itself say which of the 2 pyramids sharing that rhombic face owns the
clicked point.

**The actual fix, proven not just tested**: a rhombus's two diagonals
always perpendicularly bisect each other (a defining property of any
rhombus, not specific to this one). The real ground-truth boundary between
pyramid A's true triangular side-face (its own base edge + its own single
apex — the geometry from `pyramidPieces`, not `ConvexGeometry`'s internal
triangulation) and neighboring pyramid B's is exactly the cube-cube
diagonal of that shared rhombic face — which is exactly the perpendicular
bisector of the apex-apex diagonal. So "is the hit point nearer apex A or
apex B" is an EXACT test for which pyramid's real triangle contains it,
not an approximation. `nearestPyramidAxis` implements exactly that, given
the 2 candidates.

Where the 2 candidates come from: `matchNeighborOffset` (already used by
whole-block Build mode) maps a rhombic face's normal to its FCC neighbor
offset, e.g. `[1,1,0]`; `candidateAxesForNeighborOffset` reads that
offset's 2 nonzero signed components directly as the 2 candidate axis
keys (`x+`/`y+` for `[1,1,0]`) — no lookup table, the offset already
encodes it.

A hit whose normal is already (near-)pure axis-aligned
(`pyramidAxisForNormal`, threshold 0.9 — diagonal rhombic normals peak at
`1/sqrt(2) ≈ 0.707`, wide margin either side) needs none of this: it's a
flat cube face, only ever exposed where exactly one specific pyramid is
currently missing, so it's unambiguous on its own. `resolvePyramidAxisForHit`
tries this direct case first and only falls back to the candidate-pair
test for a genuinely diagonal (rhombic) hit.

All of the above (both branches, the bitmask helpers, and a real
`createWorldStore` round-trip through `applyPyramidEdit`) was verified via
a real Playwright script exercising the actual shipped functions before
wiring any DOM/raycasting around them — see `applyPyramidEdit` below and
`render.md`'s own Pyramid Sub-Cell section for the full end-to-end
(real click, real screenshot) verification on top of this.

## `applyPyramidEdit(world, action, x, y, z, axisKey)`

Same idiom `report`/`replace` build modes already use (`core/build.js`):
`world.addCell` is a plain upsert (`cells.set()`, no existence check), so
"patch one field on an already-placed cell" is just `addCell` with that
cell's own other data spread back in — no `worldstate-core.js` change
needed. No-ops (returns `null`) on removing an already-absent pyramid or
adding an already-present one, both real cases a player's click can hit
(e.g. Pyramid-model clicked on a face that already has its pyramid).

**Real live report traced to exactly this, 2026-08-26**: "I select one
of shapes tap screen nothing happens." Reproduced with a genuine
`page.touchscreen.tap()` against production (not the manually-dispatched
synthetic `click` the earlier touch verification used, which papered
over this) — Add+Pyramid on a fresh, full block silently no-ops, and
every freshly-placed block IS full, so picking the Pyramid piece tier
and tapping any existing block is the very first thing a new player
tries and the very first thing that goes silent. The no-op itself was
never a bug; the silence was. `core/build.js`'s new `onPieceNoOp`
callback (wired in `render.js` to a real `showHudPrompt`) gives the
player the actual reason instead of nothing.
