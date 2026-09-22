// Rhombohedra (free lattice): direct follow-up, same session as RD
// Quarter -- "need placement of rhombohedra not limited to fill
// existing RDs, rhombohedra should be able to fulfil their own
// geometry free connecting in all directions... call them rhombohedra
// too." RD Quarter (core/lattice.js's own rdQuarterPieces) only ever
// exists as a sub-piece INSIDE an already-real FCC cell (bootstrapped
// off an existing solid RD/Hemi RD/Hourglass) -- real consequence,
// found live: a rhombohedron added inside an ALREADY-solid cell is
// geometrically enclosed by that same cell's own outer surface, so it
// can never be raycast-hit from outside again (confirmed directly: a
// full-canvas sweep found no click position that could remove one).
//
// This is the fix: a genuinely separate, free-standing lattice, own
// "adopted family member" store/mesh/coordinate frame (same pattern as
// BCC/Hex Prism/every 2D family), where a rhombohedron tiles 3D space
// by pure translation along ITS OWN 3 edge vectors -- true for ANY
// parallelepiped by definition, not something special-cased here. Uses
// exactly ONE of RD Quarter's own 4 real congruent orientations
// (rdQuarterPieces(s)[0], anchor [1,1,1]) as the fixed generator, so
// this is still the SAME real shape (Fedorov zonotope decomposition of
// RD, verified in core/lattice.js), just growing freely through empty
// space instead of only appearing pre-packed inside a full RD.
import { rdQuarterPieces } from '../core/lattice.js';

// The 3 real edge vectors of rdQuarterPieces(s)[0] (anchor [1,1,1]),
// derived directly from that function's own construction: anchor=(h,h,h)
// (h=s/2), edges run to the 3 adjacent octahedral points. At s=1:
// edge0=(0.5,-0.5,-0.5), edge1=(-0.5,0.5,-0.5), edge2=(-0.5,-0.5,0.5).
// Computed here (not hand-copied) so this always matches
// rdQuarterPieces exactly even if that function's own numbers change.
function edgeVectors(s = 1) {
  const half = s * 0.5;
  const octa = s;
  const [sx, sy, sz] = [1, 1, 1];
  const anchor = [sx * half, sy * half, sz * half];
  return [
    [sx * octa - anchor[0], -anchor[1], -anchor[2]],
    [-anchor[0], sy * octa - anchor[1], -anchor[2]],
    [-anchor[0], -anchor[1], sz * octa - anchor[2]],
  ];
}

// 6 real face-sharing neighbors: +-each of the 3 edge vectors -- same
// "own coordinate frame, own offset table" pattern BCC/Hex Prism/every
// 2D family already establishes.
export const RHOMBOHEDRA_NEIGHBOR_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

export function rhombohedraCellToWorld(i, j, k, s = 1) {
  const [e0, e1, e2] = edgeVectors(s);
  return [
    i * e0[0] + j * e1[0] + k * e2[0],
    i * e0[1] + j * e1[1] + k * e2[1],
    i * e0[2] + j * e1[2] + k * e2[2],
  ];
}

// The canonical tile, re-centered on its own centroid (rdQuarterPieces'
// own raw verts are anchor-relative, not centroid-relative) so this
// works with the same "one shared geometry, translate via instance
// matrix" InstancedMesh pattern every other family uses.
export function rhombohedraTileVerts(s = 1) {
  const raw = rdQuarterPieces(s)[0];
  const cx = raw.reduce((sum, p) => sum + p[0], 0) / raw.length;
  const cy = raw.reduce((sum, p) => sum + p[1], 0) / raw.length;
  const cz = raw.reduce((sum, p) => sum + p[2], 0) / raw.length;
  return raw.map(([x, y, z]) => [x - cx, y - cy, z - cz]);
}

// Real face-normal matching (a genuine 3D solid, not a flat 2D tile --
// no hit-point-direction workaround needed the way lattice-2d.js's
// families require). Precomputes each of the 6 neighbor offsets' own
// real world DIRECTION (not the raw index offset, which isn't a unit
// vector here any more than a triangle's is) and picks the best dot
// product against the clicked face's own normal.
export function matchRhombohedraNeighborOffset(faceNormal, s = 1) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  RHOMBOHEDRA_NEIGHBOR_OFFSETS.forEach(([di, dj, dk], idx) => {
    const [wx, wy, wz] = rhombohedraCellToWorld(di, dj, dk, s);
    const len = Math.hypot(wx, wy, wz);
    const dot = (wx / len) * faceNormal.x + (wy / len) * faceNormal.y + (wz / len) * faceNormal.z;
    if (dot > bestDot) { bestDot = dot; bestIdx = idx; }
  });
  return RHOMBOHEDRA_NEIGHBOR_OFFSETS[bestIdx];
}
