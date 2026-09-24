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

// ---------------------------------------------------------------------------
// All 4 orientations (direct report 2026-09-24: "rhombohedra touch on
// attach only provides one orientation... clustering four seems
// impossible"). Everything above is the original translation-only
// lattice (one fixed orientation, rdQuarterPieces(s)[0]) -- kept for
// migration. Real fact, checked numerically before building (and
// re-checked by scripts/verify-rhombohedra.mjs): across EVERY face of
// EVERY one of RD Quarter's 4 orientations, exactly 2 rhombohedra can
// attach without overlapping -- the same-orientation translate (the
// only one the old lattice ever offered) and one partner in a
// DIFFERENT orientation (the one that pairs toward a whole RD). 4 around
// a shared RD center reassemble that RD exactly.
//
// Pieces are stored by CENTROID: cell (x,y,z) = 4 x the centroid at
// s=1 (always integers -- every vertex is a multiple of 1/2), with the
// orientation q (0..3, rdQuarterPieces' own anchor order) in the cell's
// own data as `o`. A centroid alone identifies a piece: two pieces with
// the same centroid would overlap anyway.
// ---------------------------------------------------------------------------

const ORIENT_TEMPLATES = rdQuarterPieces(1).map((raw) => {
  const c = [0, 1, 2].map((a) => raw.reduce((sum, p) => sum + p[a], 0) / raw.length);
  return raw.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
});
const vkey = (p) => p.map((n) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(6)).join(',');
const setKey = (pts) => pts.map(vkey).sort().join('|');

// The proper rotation (a signed permutation matrix, det +1) taking the
// orientation-0 template onto orientation q -- found by search, not
// hand-derived, so one shared geometry + a per-instance rotation renders
// all 4 exactly.
const ROTATIONS = (() => {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const mats = [];
  for (const p of perms) for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    [sx, sy, sz].forEach((sg, r) => { m[r][p[r]] = sg; });
    const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    if (det === 1) mats.push(m);
  }
  const apply = (m, v) => [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]);
  return ORIENT_TEMPLATES.map((target) => mats.find((m) => setKey(ORIENT_TEMPLATES[0].map((v) => apply(m, v))) === setKey(target)));
})();

// Row-major 3x3 rotation for orientation q (for the renderer's instance matrix).
export function rhombohedraOrientationMatrix(q) {
  return ROTATIONS[q];
}

export function rhombohedraPieceWorld(c4, s = 1) {
  return [(c4[0] / 4) * s, (c4[1] / 4) * s, (c4[2] / 4) * s];
}

function pieceVerts(q, c4) {
  const c = rhombohedraPieceWorld(c4, 1);
  return ORIENT_TEMPLATES[q].map((v) => [v[0] + c[0], v[1] + c[1], v[2] + c[2]]);
}

// The 6 faces of a centered template, as vertex-index quads -- rdQuarterPieces
// emits vertices in (b0,b1,b2) binary order, so a face is "b_k fixed".
const FACE_INDEX = [0, 1, 2].flatMap((k) => [0, 1].map((b) => [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => ((i >> (2 - k)) & 1) === b)));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function outwardNormal(face, center) {
  const n = cross(sub(face[1], face[0]), sub(face[2], face[0]));
  return dot3(n, sub(face[0], center)) < 0 ? n.map((x) => -x) : n;
}

// Separating-axis test for two parallelepipeds (s=1 units): true only if
// their interiors overlap (touching faces/edges/corners is fine).
export function rhombohedraOverlap(qa, ca, qb, cb) {
  const A = pieceVerts(qa, ca);
  const B = pieceVerts(qb, cb);
  const ea = [sub(A[4], A[0]), sub(A[2], A[0]), sub(A[1], A[0])];
  const eb = [sub(B[4], B[0]), sub(B[2], B[0]), sub(B[1], B[0])];
  const axes = [
    ...[[0, 1], [0, 2], [1, 2]].map(([i, j]) => cross(ea[i], ea[j])),
    ...[[0, 1], [0, 2], [1, 2]].map(([i, j]) => cross(eb[i], eb[j])),
    ...ea.flatMap((a) => eb.map((b) => cross(a, b))),
  ];
  for (const n of axes) {
    if (Math.hypot(...n) < 1e-9) continue;
    const pa = A.map((v) => dot3(v, n));
    const pb = B.map((v) => dot3(v, n));
    if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
  }
  return true;
}

// Every rhombohedron that can attach across the face of piece (q, c4)
// whose outward normal best matches worldNormal: [{ o, c4 }], the
// same-orientation translate first, then the partner orientation.
export function rhombohedraAttachOptions(q, c4, worldNormal) {
  const V = pieceVerts(q, c4);
  const center = rhombohedraPieceWorld(c4, 1);
  let face = null;
  let bestDot = -Infinity;
  for (const idx of FACE_INDEX) {
    const f = idx.map((i) => V[i]);
    const n = outwardNormal(f, center);
    const d = dot3(n, worldNormal) / Math.hypot(...n);
    if (d > bestDot) { bestDot = d; face = f; }
  }
  const faceKey = setKey(face);
  // Numeric lexicographic minimum -- translation-invariant, unlike a
  // string sort (which misorders negative coordinates).
  const lexMin = (pts) => pts.reduce((m, p) => {
    for (let a = 0; a < 3; a++) {
      if (p[a] < m[a] - 1e-9) return p;
      if (p[a] > m[a] + 1e-9) return m;
    }
    return m;
  });
  const faceMin = lexMin(face);
  const options = [];
  for (let q2 = 0; q2 < 4; q2++) {
    for (const idx of FACE_INDEX) {
      const g = idx.map((i) => ORIENT_TEMPLATES[q2][i]);
      const t = sub(faceMin, lexMin(g));
      if (setKey(g.map((v) => [v[0] + t[0], v[1] + t[1], v[2] + t[2]])) !== faceKey) continue;
      const c2 = t.map((x) => Math.round(x * 4));
      if (options.some((o) => o.o === q2 && vkey(o.c4) === vkey(c2))) continue;
      if (!rhombohedraOverlap(q, c4, q2, c2)) options.push({ o: q2, c4: c2 });
    }
  }
  return options.sort((a, b) => (a.o === q ? 0 : 1) - (b.o === q ? 0 : 1));
}

// Old translation-only save format (cell = (i,j,k) lattice index, no
// `o`) -> the centroid frame above. Old pieces were the orientation-0
// template centered on rhombohedraCellToWorld(i,j,k).
export function rhombohedraMigrateLegacyCell(i, j, k) {
  return rhombohedraCellToWorld(i, j, k, 1).map((x) => Math.round(x * 4));
}
