# Notes: `src/geometry-extensions/growth.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File overview

Trimmed 2026-09-22 (second world-building removal pass) from the
original `growth.js`, which also carried a real growth-over-time engine
(species templates, tick-rate-limited `growSeed`/`applyGrowth`/
`plantSeed`/`pruneTile`). That engine — plus its full original history,
including the real overlap bug found 2026-08-13 and the perf fix found
2026-08-24 — is archived in full at
`src/world-systems-archived/growth.js`; its code-note moved to
`docs/code-notes/world-systems-archived/growth.md`.

What's kept here is Ammann-rhombohedra geometry (the same construction
underlying the Ammann-Kramer-Neri tiling, the standard 3D generalization
of Penrose tiling) that is genuinely deterministic and non-simulated:
the 12 star directions, the valid acute/oblate rhombohedron triples
they form, a single tile's vertices, and a real 3D SAT overlap test
between two tiles. `render.js`'s live Duality Mode feature
(`VALID_TRIPLES`, `unitTileVertices`) depends on this directly.

## `STAR_DIRECTIONS` / `buildStarDirections`

The 12 icosahedron vertex directions (unit vectors): all coordinate
permutations of (0, ±1, ±phi). Verified during the original spec pass
(2026-08-13, and re-verified at module load, not just trusted): every
pairwise angle among these 12 is one of exactly three values — 63.43deg
(acute), 116.57deg (oblate), or 180deg (antipodal pairs) — nothing
else. This is the real construction, not an approximation.

## `VALID_TRIPLES` / `buildValidTriples`

Every valid golden-rhombohedron corner: a triple of direction indices
(into `STAR_DIRECTIONS`) whose three pairwise angles are ALL acute
(63.43deg) or ALL oblate (116.57deg) — a "mixed" triple is a valid
parallelepiped but its faces would NOT all be golden rhombi, so it is
not a real Ammann rhombohedron and is excluded. Computed once at module
load; verified (Python) to be exactly 20 acute + 20 oblate = 40 total
among the 220 possible triples of 12 directions.

## `unitTileVertices` / `tileVertices`

A single tile's 8 local vertices (relative to its own origin corner,
not offset by any seed) for a given direction triple — `render.js`'s
own building block for its rhombohedron mesh templates. Exported
specifically so callers never need to reimplement this subset-sum math
themselves; this module stays the one source of truth for the real
geometry.

A tile's 8 vertices: origin + every subset-sum of its 3 edge directions
(edge length fixed at 1, matching the original spec's unit-edge
convention).

## `tileEdges`

The 3 basis edge vectors of a tile, read straight back out of its own 8
vertices (`verts[0]` is the origin corner; `verts[4]`/`[2]`/`[1]` are
the single-edge corners, per `tileVertices`' own a/b/c bit order).

## `tilesOverlap` (and its helpers `centroidOf`/`maxRadiusFrom`)

Real 3D separating-axis test between two golden-rhombohedron tiles. Two
convex parallelepipeds are separated iff some axis among {each shape's
3 face normals, every pairwise cross product of one shape's edge with
the other's (9)} shows non-overlapping projections — the standard SAT
test for oriented boxes, exhaustive for this shape class (15 candidate
axes). `eps` tolerance treats two tiles that only TOUCH along a shared
face (zero-width projection overlap) as non-overlapping, which is the
correct result for legitimately glued neighbors.

**Bounding-sphere pre-check**: cheap conservative pre-check before the
expensive exact SAT test — if the two tiles' bounding SPHERES don't
overlap, the (smaller, convex) tiles inside them provably can't overlap
either — this can only ever skip work, never change the real answer.

Not called by any live feature today (its one live caller, the
archived `evolution.js`'s crowding check, was archived in the same pass
this file was trimmed) — kept because it's genuine deterministic
geometry, not simulation, and a lattice-overlap check is a natural
thing a lattice-selection tool will want again.
