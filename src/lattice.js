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
