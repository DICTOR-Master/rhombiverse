# Notes: `src/core/lattice.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## `CUBE_VERTS` / `OCTA_VERTS`

Raw RD vertex set: 8 cube vertices + 6 octahedron vertices at 2x
radius. This is the exact `CUBE_VERTS` + `OCTA_VERTS*2` formula already
established and tested across `~/rhombicroid/geometry.py`'s
"rhombicroid" raw-point set and all six `~/rhombispheres/` levels built
from it — ported directly here, not re-derived, per this project
family's own convention of reusing proven constants rather than
hand-rolling new ones.

## `rdRawVerts`

A single RD's 14 raw vertices, scaled by `s`. The cube/octa 2:1 radius
ratio (ported from `geometry.py`) is what makes this RD's *shape*
correct; the absolute size is NOT `geometry.py`'s own raw scale (that
repo's `CUBE_VERTS=1`/`OCTA_VERTS=2` is tuned for its own
`WORLD_SCALE`, unrelated to this lattice's unit spacing). The RD is
this FCC lattice's own Voronoi cell: solving where 3 adjacent
perpendicular-bisector planes of `NEIGHBOR_OFFSETS` meet (e.g. x+y=1,
x+z=1, y+z=1) gives cube-type vertices at magnitude 0.5 and octa-type
at magnitude 1.0 for unit spacing — i.e. exactly HALF of `geometry.py`'s
raw constants — which is what tiles adjacent cells face-to-face with no
gap or overlap at `cellToWorld`'s own `coord*s` spacing. Confirmed
2026-08-11 after a real overlap bug from using `geometry.py`'s
un-halved scale directly.

## `NEIGHBOR_OFFSETS`

12 neighbor offsets, one per RD face. See `RHOMBIVERSE_PLAN.md` section 2.

## `isValidCell`

Valid cell: (x,y,z) in Z^3 where x+y+z is even — the FCC lattice parity
constraint. Adding any `NEIGHBOR_OFFSETS` entry to a valid cell always
yields another valid cell.

## `nearestValidCell`

Snaps an arbitrary real-valued position (e.g. camera/player world
coordinates, already divided by whatever scale factor `cellToWorld`
used) to the nearest valid FCC lattice cell — the inverse of
`cellToWorld`, needed anywhere a real-space point (not already an
integer cell) has to become a search/build origin. Rounds each axis
independently, then — since independent rounding can land on an
invalid (odd-sum) parity — nudges whichever axis had the largest
rounding error by +-1 toward the raw value, the adjustment that changes
the snapped point the least.

## `cellKey`

World-state cell keys are `"x,y,z"` strings (`RHOMBIVERSE_PLAN.md`
section 3).

## `cellToWorld`

World-space position = lattice coord * scale factor s. No rotation
logic needed — every RD sits in identical orientation.

## `shellCount`

Number of cells in shell n (counting outward from a center point, n =
1, 2, 3...) — `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` section 3. Not a
new formula: the standard FCC coordination-shell count for this
12-neighbor lattice. Used to sanity-check `cellsInShells` below.

## `cellsInShells`

BFS outward through `NEIGHBOR_OFFSETS` from a center cell, returning
every cell in shells `minShell..maxShell` (exclusive of the center
itself unless `minShell` is 0) as `{x, y, z, shell}` records. This is
the "shell fill" shortcut tool — Phase 5.5's fill-sphere tool from
`RHOMBIVERSE_PLAN.md` ("radius input -> auto-fills all valid lattice
cells within that radius of a chosen center"), built early/
out-of-sequence at the user's request (2026-08-11) to approximate
spherical planetoid shapes while Phase 2's build tool was still the
only interaction available. Verified against `shellCount(n)` above (BFS
shell sizes match `10n^2+2` exactly through n=6) before shipping, since
no browser/Node was available in the session that wrote this to run it
directly. Each result's `shell` field lets the renderer tint cells by
shell distance so the outward layers are visually distinguishable.
`minShell` (default 1 = solid fill from the center) lets a caller skip
the innermost shells for a hollow-shell build — still traverses them
for BFS correctness, just doesn't record them in the result. `offsets`
(default `NEIGHBOR_OFFSETS`, additive param — every existing call site
is unaffected) lets a caller walk a different direction table instead
of the normal 12-neighbor set — e.g. `dual.js`'s `DUAL_DIRS.cube/octa`
for Sculpture Mode's "Dual Shell" brush, which grows a shell-cluster
along the inscribed cube/octahedron's own directions rather than
face-adjacency.
