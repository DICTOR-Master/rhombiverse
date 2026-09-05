// Rhombis' one parametrized pyramid mesh function (RHOMBIVERSE_SPEC_
// RHOMBIS_GAME_BUILD_PLAN.md, "Core geometry"): every shape downstream
// (octahedron, cube, RD) is this same mesh plus transforms, never a
// redefinition. Reuses core/lattice.js's pyramidPieces() -- already the
// real RD cube+6-pyramid decomposition, unit tested in tests/unit/
// pyramid.test.mjs and lattice.test.mjs -- instead of re-deriving pyramid
// vertices. Same point-cloud -> THREE.ConvexGeometry recipe render.js's
// own buildRDGeometry()/buildCuboctaGeometry() already use, not a new one.
//
// Canonical pose (translated after ConvexGeometry, once): base is the
// flat s*s square at y=0 centered on the origin, apex at (0, s/2, 0) --
// exactly the spec's own "Base pyramid" definition, verbatim ("square
// base of side s, apex directly above the base's center at height
// s/2"). pyramidPieces(s).pyramids['y+'] gives this same pyramid but
// with its base sitting at y=+s/2 (erected outward off a cube face, the
// pose RD's cap pyramids need) -- shifting down by s/2 re-centers it on
// the spec's own base-at-origin pose instead, so every Rhombis stage
// composes it purely via Group/mesh transforms (Stage 2's octahedron:
// identity vs. a 180 degree rotation about X, both sharing this same
// base plane) rather than needing a second geometry variant.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { pyramidPieces, facePieces, oppositeNeighborIndex, rdRawVerts } from '../core/lattice.js';
import { SYMMETRY_OPERATIONS } from './cell-arrangements.js';

export function pyramidGeometry(scale = 1) {
  const { base, apex } = pyramidPieces(scale).pyramids['y+'];
  const points = [...base, apex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.translate(0, -scale / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

// A pyramid from a cell's own local center to ONE of its 12 REAL
// rhombic faces (facePieces() in core/lattice.js -- the actual shared
// face two adjacent cells at NEIGHBOR_OFFSETS[offsetIndex] have, unlike
// pyramidPieces()'s own 6-axis inscribed-cube frame, which only ever
// reaches a single vertex of a real 12-neighbor-direction face, not the
// flat face itself). Already correctly oriented and positioned in the
// cell's own local frame -- unlike pyramidGeometry() above, this needs
// no canonical-mesh-plus-quaternion reuse, since facePieces() already
// gives each of the 12 directions its own real, distinct vertices.
export function facePyramidGeometry(scale, offsetIndex) {
  const { base, apex } = facePieces(scale)[offsetIndex];
  const points = [...base, apex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// A real bipyramid through a cell's own center, aligned along one
// specific real NEIGHBOR_OFFSETS direction -- two facePyramidGeometry()
// pyramids, toward that neighbor and its real opposite, merged base-to-
// base through the shared apex point (the cell's own center). Genuinely
// different from pyramidGeometry()'s own "Octahedron" (Stage 2, 2
// pyramids along a plain cube-face axis, dead straight relative to the
// RD's own faces) -- this one runs along a real (1,1,0)-type diagonal
// neighbor direction instead, so it reads visually as tilted/angled
// relative to the RD's own faces, not axis-aligned. Direct instruction
// (2026-09-05, "multi cell could benefit from a variety of pieces
// within it like two angled conjoined adjacent octahedra at the
// connecting point between the two pieces" -- generalized immediately
// after: "the bridging point of any adjacent shapes in a structure is
// a potential opportunity for a big odd connection"): built from the
// SAME real facePieces() primitive verified earlier the same day (see
// core/lattice.js's own header), not a new heuristic, so two adjacent
// cells' own diagonal octahedra -- each built along the SAME real
// shared axis -- meet at that real shared face exactly, the identical
// "share the exact same 4 real-world vertices" guarantee already
// proven for the Disphenoid crossover's own tabs.
export function diagonalOctahedronGeometry(scale, offsetIndex) {
  const near = facePieces(scale)[offsetIndex];
  const far = facePieces(scale)[oppositeNeighborIndex(offsetIndex)];
  const points = [...near.base, ...far.base, near.apex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// A real, SHORT pyramid off one cell's own real shared face (facePieces()
// again -- same guaranteed real alignment as diagonalOctahedronGeometry
// above), reaching only PART of the way toward the cell's own true
// center rather than all the way there. Two of these -- one built this
// way for each of two real adjacent cells, off the SAME real shared
// face -- meet exactly at that face (proven by the same real-vertex
// symmetry diagonalOctahedronGeometry already relies on) and together
// read as one real flat, wide, 4-pointed star/diamond spanning halfway
// into each cell, rather than a tall gem reaching all the way through
// both (direct instruction, 2026-09-05: "a nice flat square star shape
// that spans halfway into two joined cells" -- "a 3D star that pokes
// into both cells symmetrically... squat version of the octahedron").
export function flatStarPointGeometry(scale, offsetIndex, depthFraction = 0.5) {
  const { base } = facePieces(scale)[offsetIndex];
  const faceCentroid = base.reduce(([sx, sy, sz], [x, y, z]) => [sx + x / 4, sy + y / 4, sz + z / 4], [0, 0, 0]);
  // apex (real) is [0,0,0] -- interpolating from the face centroid
  // toward it by depthFraction shortens the real pyramid's own height
  // without moving its base off the real face at all.
  const shortApex = faceCentroid.map((c) => c * (1 - depthFraction));
  const points = [...base, shortApex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// A real, whole rhombic dodecahedron mesh -- Stage 6's "fused twelve"
// piece (a full RD standing in for a cell's own 12 loose pyramids at
// once, RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md's "conjoined
// pieces" extended to a whole cell). Reuses core/lattice.js's own
// rdRawVerts() -- the SAME 14-point convex hull recipe render.js's own
// buildRDGeometry() uses for every real placed RD in the main
// Rhombiverse app -- rather than deriving RD geometry a second way, so
// this fused piece is a genuine RD, not an approximation.
export function rhombicDodecahedronGeometry(scale = 1) {
  const points = rdRawVerts(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// A real, whole-RD decomposition into 24 congruent TETRAGONAL
// DISPHENOIDS -- direct instruction (2026-09-04, "tetragonal disphenoids
// to form an RD"), verified numerically before writing any of this (see
// the session's own scratch verification script, not reproduced here):
// take the RD's own center O and, for each of the 12 rhombic faces (a
// pair of adjacent octahedron-cap vertices plus the 2 cube corners they
// share), split that face's own rhombic pyramid (face + O) along its
// SHORT diagonal (the cube-corner-to-cube-corner one, not the longer
// octa-to-octa one -- splitting along the LONG diagonal instead gives a
// real but DIFFERENT, non-disphenoid tetrahedron, confirmed by checking
// opposite-edge equality both ways) -- 12 faces x 2 halves = 24
// tetrahedra, each with all 3 opposite-edge pairs equal (the defining
// property of a disphenoid), and since two of its three distinct edge
// lengths coincide, each face is an ISOSCELES triangle -- a TETRAGONAL
// disphenoid specifically, not just any isosceles one.
//
// Canonical piece: O at local origin (the RD's own shared center --
// EVERY one of the 24 real target orientations keeps this same vertex
// at that same shared point, so unlike every other Rhombis piece this
// one only ever needs to ROTATE in place, never translate, to reach any
// of its 24 targets), one octahedron-cap vertex along +x, and the 2
// cube corners shared between the +x and +y faces.
function disphenoidLocalPoints(scale) {
  return [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(scale, 0, 0),
    new THREE.Vector3(scale / 2, scale / 2, scale / 2),
    new THREE.Vector3(scale / 2, scale / 2, -scale / 2),
  ];
}

export function disphenoidGeometry(scale = 1) {
  const geometry = new ConvexGeometry(disphenoidLocalPoints(scale));
  geometry.computeVertexNormals();
  return geometry;
}

// The 24 PROPER (determinant +1) operations of the full 48-element
// octahedral symmetry group (`cell-arrangements.js`'s own
// `SYMMETRY_OPERATIONS`, reused rather than a second copy of the same
// math) -- a signed permutation is a real rigid ROTATION exactly when
// its determinant is +1; the other 24 (determinant -1) are reflections,
// which a real physical piece can't be moved through, only rotated.
// Verified numerically (not assumed): applying these 24 rotations to
// the canonical disphenoid above reaches all 24 real target
// orientations, each exactly once -- a tetragonal disphenoid's own
// D2d symmetry makes it ACHIRAL (superposable on its own mirror image
// via a genuine rotation), which is exactly why 24 pure rotations
// alone -- no reflections needed -- suffice to cover all 24 slots.
function permutationParity(perm) {
  let inversions = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[i] > perm[j]) inversions++;
    }
  }
  return inversions % 2 === 0 ? 1 : -1;
}

const PROPER_SYMMETRY_OPERATIONS = SYMMETRY_OPERATIONS.filter(
  (op) => permutationParity(op.perm) * op.signs[0] * op.signs[1] * op.signs[2] === 1,
);

export const DISPHENOID_ORIENTATIONS = PROPER_SYMMETRY_OPERATIONS.map((_, i) => `d${i}`);

// Converts one signed-permutation operation into the THREE.Quaternion
// that performs the SAME rotation on a real mesh -- a signed permutation
// IS already a rotation matrix (each row/column has exactly one nonzero
// +-1 entry), so this just places those entries directly into a
// Matrix4's columns (column j = where the op sends basis vector e_j)
// rather than re-deriving the rotation some other way.
function quaternionForSymmetryOp(op) {
  const column = (j) => {
    const basisVector = [0, 0, 0];
    basisVector[j] = 1;
    return [
      op.signs[0] * basisVector[op.perm[0]],
      op.signs[1] * basisVector[op.perm[1]],
      op.signs[2] * basisVector[op.perm[2]],
    ];
  };
  const [c0, c1, c2] = [column(0), column(1), column(2)];
  const matrix = new THREE.Matrix4().set(
    c0[0], c1[0], c2[0], 0,
    c0[1], c1[1], c2[1], 0,
    c0[2], c1[2], c2[2], 0,
    0, 0, 0, 1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

const DISPHENOID_QUATERNIONS = PROPER_SYMMETRY_OPERATIONS.map(quaternionForSymmetryOp);

export function quaternionForDisphenoidOrientation(key) {
  return DISPHENOID_QUATERNIONS[Number(key.slice(1))];
}

function applySymmetryOp(op, vector) {
  const v = [vector.x, vector.y, vector.z];
  return new THREE.Vector3(
    op.signs[0] * v[op.perm[0]],
    op.signs[1] * v[op.perm[1]],
    op.signs[2] * v[op.perm[2]],
  );
}

// The 4 real WORLD points [O, apex, cube1, cube2] for one of the 24
// disphenoid orientations, at a given scale -- lets a caller build
// FUSED multi-disphenoid pieces directly from real geometry (the same
// "merge real per-piece point sets" pattern `stages.js` already uses
// throughout, e.g. `buildMoleculeStage`'s own `lobeCenters`), rather
// than needing a separately-derived quaternion for each member.
export function disphenoidPointsForOrientation(index, scale = 1) {
  const op = PROPER_SYMMETRY_OPERATIONS[index];
  return disphenoidLocalPoints(scale).map((p) => applySymmetryOp(op, p));
}

// General axis-keyed orientation system, reusing core/pyramid.js's own
// 'x+'/'x-'/'y+'/'y-'/'z+'/'z-' vocabulary (PYRAMID_AXES) rather than
// inventing a second one. Stage 2's octahedron only ever needed a plain
// up/down flip (a special case of this: outwardQuaternion('y+') is
// identity, outwardQuaternion('y-') is the 180 degree flip it used to
// hardcode) -- Stage 3's cube needs the full 6-axis version (each
// piece's apex pointing INWARD, toward the shared cube center, off a
// different face per void), so this generalizes rather than adding a
// second orientation system alongside the first.
export const AXIS_NORMALS = {
  'x+': new THREE.Vector3(1, 0, 0),
  'x-': new THREE.Vector3(-1, 0, 0),
  'y+': new THREE.Vector3(0, 1, 0),
  'y-': new THREE.Vector3(0, -1, 0),
  'z+': new THREE.Vector3(0, 0, 1),
  'z-': new THREE.Vector3(0, 0, -1),
};

// Which of the RD's 6 real outward directions this orientation's own
// apex point lands on (e.g. 'x+') -- used to group the 24 disphenoids
// into 6 real fused clusters (direct instruction, 2026-09-04, "lots of
// the pieces conjoined... too much of an x-ray exploration" against the
// original 24-loose-piece version): the 4 disphenoids sharing the SAME
// apex point are always mutually face-adjacent (verified numerically --
// every disphenoid has degree 3 in its own face-adjacency graph, exactly
// its 3 same-apex siblings), so grouping this way always produces a
// real, connected, non-arbitrary chunk, not an arbitrary partition.
export function disphenoidApexAxisKey(index, scale = 1) {
  const apex = disphenoidPointsForOrientation(index, scale)[1];
  for (const [key, normal] of Object.entries(AXIS_NORMALS)) {
    if (apex.distanceTo(normal.clone().multiplyScalar(scale)) < 1e-6) return key;
  }
  throw new Error(`disphenoidApexAxisKey: orientation ${index} apex did not match any axis`);
}

const UP = new THREE.Vector3(0, 1, 0);

function quaternionForApexDirection(direction) {
  return new THREE.Quaternion().setFromUnitVectors(UP, direction);
}

// Apex points OUTWARD along the axis, away from the shared origin --
// Stage 2's two tray pieces (both start 'y+', flip toggles to 'y-').
export function outwardQuaternion(axisKey) {
  return quaternionForApexDirection(AXIS_NORMALS[axisKey]);
}

// Apex points INWARD along the axis, toward the shared origin -- the
// Cube's 6 sub-pyramids (Stage 3): base sits on the face named by
// axisKey, apex meets the other 5 pyramids' apexes at the center.
export function inwardQuaternion(axisKey) {
  return quaternionForApexDirection(AXIS_NORMALS[axisKey].clone().negate());
}

// Resolves a piece's `orientation` string to the quaternion it should
// currently show -- the single place that understands EVERY orientation
// vocabulary in play, so callers never need to know which one a given
// piece uses. Stage 1/2 use a bare axis key ('y+', 'y-') and always mean
// outward (their own up/down flip); the Cube's own pieces use a compound
// 'axisKey:in' key (always inward, apex meeting the shared center); the
// RD/Multi-Cell manual-orientation pieces use the bare axis-key
// vocabulary too now (2026-09-04 fix -- see `stages.js`'s own
// `OPPOSITE_AXIS` comment for why a SEPARATE 'axisKey:in'/'axisKey:out'
// scheme for those specifically was a real bug, not just a second
// format: half its 12 "distinct" keys were accidental duplicates of the
// other half); the Disphenoid RD piece (2026-09-04) needs a FOURTH,
// unrelated 24-way vocabulary ('d0'..'d23') since a disphenoid's lower
// symmetry means a bare axis direction can't disambiguate its pose the
// way it can for an axis-aligned pyramid. Multiple formats, not
// multiple functions each with their own caller-side branching, so
// puzzle-state.js's own flipPiece()/placeSelected() (which only ever
// compare `orientation` strings for equality, never interpret them)
// needed zero changes to support any of this.
export function quaternionForOrientationKey(key) {
  if (key.startsWith('d') && /^\d+$/.test(key.slice(1))) {
    return quaternionForDisphenoidOrientation(key);
  }
  if (key.includes(':')) {
    const [axisKey, direction] = key.split(':');
    return direction === 'in' ? inwardQuaternion(axisKey) : outwardQuaternion(axisKey);
  }
  return outwardQuaternion(key);
}
