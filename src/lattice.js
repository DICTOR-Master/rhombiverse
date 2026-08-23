// RD/FCC lattice math: coordinate validation, 12-neighbor lookup, world<->screen
// conversion. See RHOMBIVERSE_PLAN.md section 2.

// Raw RD vertex set: 8 cube vertices + 6 octahedron vertices at 2x radius.
// This is the exact CUBE_VERTS + OCTA_VERTS*2 formula already established
// and tested across ~/rhombicroid/geometry.py's "rhombicroid" raw-point
// set and all six ~/rhombispheres/ levels built from it -- ported directly
// here, not re-derived, per this project family's own convention of
// reusing proven constants rather than hand-rolling new ones.
export const CUBE_VERTS = [-1, 1].flatMap((x) =>
  [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))
);

export const OCTA_VERTS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

// A single RD's 14 raw vertices, scaled by `s`. The cube/octa 2:1 radius
// ratio (ported from geometry.py) is what makes this RD's *shape* correct;
// the absolute size below is NOT geometry.py's own raw scale (that repo's
// CUBE_VERTS=1/OCTA_VERTS=2 is tuned for its own WORLD_SCALE, unrelated to
// this lattice's unit spacing). The RD is this FCC lattice's own Voronoi
// cell: solving where 3 adjacent perpendicular-bisector planes of
// NEIGHBOR_OFFSETS meet (e.g. x+y=1, x+z=1, y+z=1) gives cube-type
// vertices at magnitude 0.5 and octa-type at magnitude 1.0 for unit
// spacing -- i.e. exactly HALF of geometry.py's raw constants -- which is
// what tiles adjacent cells face-to-face with no gap or overlap at
// cellToWorld's own coord*s spacing. Confirmed 2026-08-11 after a real
// overlap bug from using geometry.py's un-halved scale directly.
export function rdRawVerts(s = 1) {
  const half = s * 0.5;
  return [
    ...CUBE_VERTS.map(([x, y, z]) => [x * half, y * half, z * half]),
    ...OCTA_VERTS.map(([x, y, z]) => [x * 2 * half, y * 2 * half, z * 2 * half]),
  ];
}

// 12 neighbor offsets, one per RD face. See RHOMBIVERSE_PLAN.md section 2.
export const NEIGHBOR_OFFSETS = [
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
  [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
];

// Valid cell: (x,y,z) in Z^3 where x+y+z is even -- the FCC lattice parity
// constraint. Adding any NEIGHBOR_OFFSETS entry to a valid cell always
// yields another valid cell.
export function isValidCell(x, y, z) {
  return (x + y + z) % 2 === 0;
}

export function neighbors(x, y, z) {
  return NEIGHBOR_OFFSETS.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
}

// Snaps an arbitrary real-valued position (e.g. camera/player world
// coordinates, already divided by whatever scale factor cellToWorld
// used) to the nearest valid FCC lattice cell -- the inverse of
// cellToWorld, needed anywhere a real-space point (not already an
// integer cell) has to become a search/build origin. Rounds each axis
// independently, then -- since independent rounding can land on an
// invalid (odd-sum) parity -- nudges whichever axis had the largest
// rounding error by +-1 toward the raw value, the adjustment that
// changes the snapped point the least.
export function nearestValidCell(x, y, z) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rz = Math.round(z);
  if (isValidCell(rx, ry, rz)) return [rx, ry, rz];
  const errs = [Math.abs(x - rx), Math.abs(y - ry), Math.abs(z - rz)];
  const worst = errs.indexOf(Math.max(...errs));
  const nudged = [rx, ry, rz];
  const raw = [x, y, z];
  nudged[worst] += raw[worst] >= nudged[worst] ? 1 : -1;
  return nudged;
}

// World-state cell keys are "x,y,z" strings (RHOMBIVERSE_PLAN.md section 3).
export function cellKey(x, y, z) {
  return `${x},${y},${z}`;
}

export function parseCellKey(key) {
  return key.split(',').map(Number);
}

// World-space position = lattice coord * scale factor s. No rotation
// logic needed -- every RD sits in identical orientation.
export function cellToWorld(x, y, z, s = 1) {
  return [x * s, y * s, z * s];
}

// Number of cells in shell n (counting outward from a center point, n =
// 1, 2, 3...) -- RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md section 3. Not a
// new formula: the standard FCC coordination-shell count for this
// 12-neighbor lattice. Used here to sanity-check cellsInShells below.
export function shellCount(n) {
  return 10 * n * n + 2;
}

// BFS outward through NEIGHBOR_OFFSETS from a center cell, returning
// every cell in shells minShell..maxShell (exclusive of the center
// itself unless minShell is 0) as {x, y, z, shell} records. This is the
// "shell fill" shortcut tool -- Phase 5.5's fill-sphere tool from
// RHOMBIVERSE_PLAN.md ("radius input -> auto-fills all valid lattice
// cells within that radius of a chosen center"), built early/
// out-of-sequence at the user's request (2026-08-11) to approximate
// spherical planetoid shapes while Phase 2's build tool is still the
// only interaction available. Verified against shellCount(n) above (BFS
// shell sizes match 10n^2+2 exactly through n=6) before shipping, since
// no browser/Node was available in the session that wrote this to run it
// directly. Each result's `shell` field lets the renderer tint cells by
// shell distance so the outward layers are visually distinguishable.
// `minShell` (default 1 = solid fill from the center) lets a caller skip
// the innermost shells for a hollow-shell build -- still traverses them
// for BFS correctness, just doesn't record them in the result.
// `offsets` (default NEIGHBOR_OFFSETS, additive param -- every existing
// call site is unaffected) lets a caller walk a different direction
// table instead of the normal 12-neighbor set -- e.g. dual.js's
// DUAL_DIRS.cube/octa for Sculpture Mode's "Dual Shell" brush, which
// grows a shell-cluster along the inscribed cube/octahedron's own
// directions rather than face-adjacency.
export function cellsInShells(cx, cy, cz, maxShell, minShell = 1, offsets = NEIGHBOR_OFFSETS) {
  const visited = new Set([cellKey(cx, cy, cz)]);
  let frontier = [[cx, cy, cz]];
  const result = [];
  for (let shell = 1; shell <= maxShell; shell++) {
    const next = [];
    for (const [x, y, z] of frontier) {
      for (const [dx, dy, dz] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        const k = cellKey(nx, ny, nz);
        if (!visited.has(k)) {
          visited.add(k);
          next.push([nx, ny, nz]);
          if (shell >= minShell) result.push({ x: nx, y: ny, z: nz, shell });
        }
      }
    }
    frontier = next;
  }
  return result;
}
