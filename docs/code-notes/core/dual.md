# Notes: `src/core/dual.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Dual cube/octahedron structure inscribed in each RD (`RHOMBIVERSE_PLAN.md`'s
"Core vs. Modules" section: this is core, not optional, once it exists —
`CLAUDE.md`'s own words). Every RD's 14 raw vertices (`lattice.js`'s
`rdRawVerts`) are exactly 8 three-valent cube-type vertices followed by 6
four-valent octa-type vertices — confirmed directly against
`rdRawVerts`/`CUBE_VERTS`/`OCTA_VERTS` before writing this file, not assumed.
`getDual` below still classifies by vertex count as a defensive fallback
(see its own note) rather than hard-relying on that fixed order.

## `CUBE_EDGES`

12 edges of the inscribed cube, as index pairs into the 8 three-valent
vertices (`CUBE_VERTS`' own `[-1,1]x[-1,1]x[-1,1]` enumeration order:
index = x*4 + y*2 + z, each axis mapped 0/1 -> -1/+1). Two vertices are
adjacent cube corners iff they differ in exactly one coordinate.

## `OCTA_EDGES`

12 edges of the inscribed octahedron, as index pairs into the 6
four-valent vertices (`OCTA_VERTS`' own order: +x,-x,+y,-y,+z,-z). Two
octahedron vertices are adjacent iff they are NOT antipodal (i.e. not
the +/- pair of the same axis) — every non-antipodal pair among 6
vertices is an edge, giving exactly 12.

## `DUAL_DIRS`

Lattice-index offsets (NOT world-space directions — see `getDual`/
`snapToDual` below for the actual world-space dual vertex positions,
which come straight from `rdRawVerts` and need no scaling here) usable
anywhere `NEIGHBOR_OFFSETS` itself is used as an integer cell-index
offset table, e.g. the Dual Shell brush's BFS traversal.

Raw (±1,±1,±1) cube directions and (±1,0,0)-family octa directions
both have an ODD coordinate sum, which is invalid on this lattice —
`isValidCell` (`lattice.js`) requires x+y+z EVEN, and `NEIGHBOR_OFFSETS`'
own 12 entries are all even-sum by construction (e.g. `[1,1,0]` sums to
2) so that adding one to a valid cell always yields another valid
cell. Doubling both direction sets fixes this the same way
`NEIGHBOR_OFFSETS`' own `[1,1,0]`-family already implicitly does (an
even-sum step): (±2,±2,±2) sums to ±6/±2 (even), and
(±2,0,0)-family sums to ±2 (even) — both always land on valid
cells. This is "scaled to match however `NEIGHBOR_OFFSETS` is scaled"
per this task's own instruction: `NEIGHBOR_OFFSETS` is exactly the set
of even-sum unit-family FCC steps, and this is the even-sum cube-
family / octa-family analogue at the next integer scale that
satisfies the same parity constraint.

## `getDual`

Given one cell's 14 raw RD vertices (`lattice.js`'s `rdRawVerts(s)` output,
already offset to the cell's world position by the caller), returns the
inscribed cube/octahedron vertex sets and their edge index lists.
Classifies by vertex count from the front (8 then 6) per `rdRawVerts`'
confirmed order; falls back to classifying by distance from the cell
center if a caller ever passes a differently-ordered 14-vertex array
(defensive, per this task's own investigation-first instruction — not
expected to trigger against this codebase's real `rdRawVerts`).

`rdRawVerts`' confirmed order (8 cube-type, then 6 octa-type) is used
directly when it looks right (first 8 all closer to center than the
last 6, matching the cube-at-half-radius/octa-at-full-radius
relationship) — otherwise re-sorts by distance as the fallback.

## `snapToDual`

Snaps an arbitrary world-space point to the nearest dual vertex of the
given dual (as returned by `getDual`), restricted to whichever solid(s)
`focus` selects (`'cube' | 'octa' | 'both'`), within `threshold` world
units. Returns `{ point: [x,y,z], which: 'cube'|'octa', index }` or null
if nothing is within threshold.

## Re-exported `NEIGHBOR_OFFSETS`

Re-exported here for callers that want to compare dual-direction
traversal against the normal 12-neighbor offset table without a second
import — not otherwise used by this module.
