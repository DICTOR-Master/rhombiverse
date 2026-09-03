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

**Second real live report, 2026-09-03**: "still having issues with
placing pyramids... seemingly weird placing logic," "wrong orientation/
position," reported as ongoing/"hit or miss" across Build and Sculpture
Mode. Investigated via a real Playwright repro against production
(`~/rhombiverse/tests/browser`'s own Playwright install; see the
`browser-test-harness` skill) reading `localStorage`'s real world JSON
after each click — not the HUD prompt text, which turned out to be an
unreliable signal for a separate reason below. Two findings:

1. **Not a bug, but a real, confusing UX gap**: `render.js`'s
   `showHudPrompt` (search that name) only toggles a CSS `visible`
   class on its timeout — it never clears the element's `textContent`.
   A successful Add/Remove shows no prompt at all (success is silent by
   design). So a stale failure message ("No pyramid there to remove —
   that face is already a flat cube.") can sit in the DOM indefinitely
   after its own toast has visually faded, and reads as if it's
   describing whatever you *just* did, even when that click actually
   succeeded. Not fixed as part of this investigation — flagged here so
   it isn't lost; the actual fix is trivial (clear `textContent` too, or
   show a brief real confirmation on success) but out of scope for the
   session that found it.
2. **Real, confirmed, reproducible bug** (now fixed, this same commit):
   `core/build.js`'s Add+Pyramid handler, the branch that runs when the
   click did NOT land on an existing tagged pyramid mesh
   (`hitAxisKey` falsy, ~line 639), called `resolveClickedPyramidAxis(hit,
   cell, { preferMissing: true })` and, if that no-op'd, fell straight
   through to "grow a stray neighbor cell" (the documented "pyramid
   without a cube" behavior a few lines below). But `preferMissing` only
   shortcuts to a missing axis when it's one of the *2 candidates tied to
   the specific face actually hit* (`candidateAxesForNeighborOffset`, off
   that face's own FCC neighbor offset) — clicking a diagonal seam
   between two OTHER, already-present pyramids (nowhere near the real
   gap) resolves to one of those instead, no-ops, and used to trigger the
   neighbor-growth fallback even though the SAME cell still had a real
   pyramid missing elsewhere. This directly contradicted this whole
   block's own documented invariant ("never changes what happens when
   there genuinely IS a pyramid still to add"). Reproduced deterministically:
   strip 3 pyramids from a fresh cell via Remove, Add them back one at a
   time at a FIXED screen point (no camera movement) — the first two
   Add clicks correctly complete the same cell; the third, at the exact
   same screen point, instead spawns an unrelated new cell elsewhere
   (confirmed via the real `cells` JSON, not visual guessing). Root
   cause confirmed by comparing against `resolvePyramidClickOnExisting`
   (the OTHER click path, landing on an existing tagged pyramid mesh),
   which already gets this right — its own `'fill'` branch checks ALL of
   the cell's missing axes, not just the 2 tied to whichever face was
   hit. Fix: when the face-specific resolution no-ops, check whether the
   cell has ANY pyramid still missing at all; if so, complete the
   nearest one (`nearestPyramidAxis` over the full `missingAxisKeys`
   list, mirroring the other path) before ever falling through to the
   neighbor-growth logic. No `core/pyramid.js` change was needed —
   `nearestPyramidAxis` already existed and already did the right thing
   given the full candidate list; `build.js` just wasn't calling it with
   the full list in this one branch. Verified fixed via the same
   Playwright repro: the 3rd Add click now completes the original
   cell (all 6 axes present, `pyramids` field correctly dropped back to
   absent-means-full) with no stray cell created.
