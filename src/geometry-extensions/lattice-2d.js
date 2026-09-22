// 2D lattice tier (dimension-select wizard Phase 2): flat layer pinned
// to z=0 in the SAME 3D scene/camera/wheel apparatus 3D already uses --
// direct instruction, "flat layer in the same 3D scene... own world-
// stores/meshes per family (same 'adopted family member' pattern as
// BCC/Hex Prism), just flat. No separate UI mode." Starting with Square
// alone (Z², trivial -- no special proportion, no duals/offset-table
// derivation needed), per direct instruction to ship it first and add
// Triangular/Hexagonal/Rhombic as fast follow-ups.
//
// A tile gets a small real height (not a literal 0-height flat quad) --
// same "arbitrary extrusion height is fine, no special ratio required"
// reasoning hex-prism.js's own header already established for its own
// prism height, applied here for the same practical reason: a truly
// flat (zero-volume) tile risks total invisibility from a grazing
// camera angle and z-fighting against the ground/other flat content.

// A square tile shares a full edge (not just a corner) with exactly its
// 4 orthogonal neighbors -- diagonal tiles only touch at a point, not a
// real boundary, so (following this app's own established "real
// adjacency, not just proximity" discipline for NEIGHBOR_OFFSETS) those
// are excluded here.
export const SQUARE_NEIGHBOR_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
];

export function squareCellToWorld(x, y, s = 1, worldZ = 0) {
  return [x * s, y * s, worldZ];
}

// A square prism: s x s cross-section in the XY (world) plane, height h
// along the scene's own Z (up) axis, centered on worldZ.
export function squareTileVerts(s = 1, h = 0.15 * 1) {
  const half = s / 2;
  const verts = [];
  for (const hz of [h / 2, -h / 2]) {
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      verts.push([sx * half, sy * half, hz]);
    }
  }
  return verts;
}
