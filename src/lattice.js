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
// ratio is what makes this RD tile face-to-face against a neighbor placed
// at any offset in NEIGHBOR_OFFSETS below, at the same scale `s`.
export function rdRawVerts(s = 1) {
  return [
    ...CUBE_VERTS.map(([x, y, z]) => [x * s, y * s, z * s]),
    ...OCTA_VERTS.map(([x, y, z]) => [x * 2 * s, y * 2 * s, z * 2 * s]),
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
