// Hexagonal Prism -- the 5th and last of the real "5" parallelohedra
// this app was missing (Fedorov 1885: Cube, Hex Prism, RD, Elongated
// Dodecahedron, TO -- see /home/dicto/Downloads/lattice-primitives.md).
// Unlike Elongated Dodecahedron, this is NOT a sub-piece of RD's own
// lattice -- a flat-top hexagon tiles the plane on its own (no special
// proportion required, unlike RD's own elongation ratio), extruded
// along Z by any height, so this gets its own genuinely separate
// lattice/coordinate frame, same "adopted family member" treatment
// TO/Cuboctahedron already have.
//
// Coordinates: axial hex (q, r) for the in-plane hexagonal lattice
// (standard flat-top axial-to-pixel formula, e.g. redblobgames.com's
// own reference) plus an integer z for the stacking axis -- a plain
// simple-hexagonal Bravais lattice, no parity constraint (every integer
// (q, r, z) triple is a valid cell, unlike FCC's isValidCell).

// The 6 in-plane axial neighbor directions (standard hex-grid constant,
// not derived here) plus the 2 stacking-axis neighbors (top/bottom
// prism cap).
export const HEX_NEIGHBOR_OFFSETS = [
  [1, 0, 0], [1, -1, 0], [0, -1, 0], [-1, 0, 0], [-1, 1, 0], [0, 1, 0],
  [0, 0, 1], [0, 0, -1],
];

export function hexCellToWorld(q, r, z, R = 1, h = Math.sqrt(3)) {
  return [1.5 * R * q, Math.sqrt(3) * R * (r + q / 2), h * z];
}

// One real world-space direction per HEX_NEIGHBOR_OFFSETS entry --
// shared by matchHexNeighborOffset below and anything else that needs
// the real face-normal directions without re-deriving them.
function hexNeighborDirections(R, h) {
  return HEX_NEIGHBOR_OFFSETS.map(([dq, dr, dz]) => {
    const [x, y, z] = hexCellToWorld(dq, dr, dz, R, h);
    const len = Math.hypot(x, y, z);
    return [x / len, y / len, z / len];
  });
}

export function matchHexNeighborOffset(faceNormal, R = 1, h = Math.sqrt(3)) {
  const dirs = hexNeighborDirections(R, h);
  let bestIdx = 0;
  let bestDot = -Infinity;
  dirs.forEach((d, i) => {
    const dot = d[0] * faceNormal.x + d[1] * faceNormal.y + d[2] * faceNormal.z;
    if (dot > bestDot) { bestDot = dot; bestIdx = i; }
  });
  return HEX_NEIGHBOR_OFFSETS[bestIdx];
}

// Flat-top regular hexagon (vertices at 60k degrees -- a face-normal
// direction lands at the 30+60k degree midpoints, matching
// HEX_NEIGHBOR_OFFSETS' own 6 in-plane directions above), extruded by
// height h. 12 vertices: 6 top + 6 bottom.
export function hexPrismVerts(R = 1, h = Math.sqrt(3)) {
  const verts = [];
  for (const zSign of [1, -1]) {
    for (let k = 0; k < 6; k++) {
      const angle = (Math.PI / 3) * k;
      verts.push([R * Math.cos(angle), R * Math.sin(angle), zSign * h / 2]);
    }
  }
  return verts;
}
