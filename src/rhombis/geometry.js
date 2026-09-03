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
import { pyramidPieces, rdRawVerts } from '../core/lattice.js';

export function pyramidGeometry(scale = 1) {
  const { base, apex } = pyramidPieces(scale).pyramids['y+'];
  const points = [...base, apex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.translate(0, -scale / 2, 0);
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
// currently show -- the single place that understands BOTH orientation
// vocabularies in play, so callers never need to know which one a given
// piece uses. Stage 1/2 use a bare axis key ('y+', 'y-') and always mean
// outward (their own up/down flip); Stage 4's manual-orientation
// prototype (direct instruction 2026-09-03: "prototype manual
// orientation on stage 4 and feel it out") needs the FULL 12-way space
// (a loose piece can be turned to any of the RD's 6 inward or 6 outward
// targets, not just flip), so it uses a compound 'axisKey:in'/
// 'axisKey:out' key instead. Two formats, not two functions, so
// puzzle-state.js's own flipPiece()/placeSelected() (which only ever
// compare `orientation` strings for equality, never interpret them)
// needed zero changes to support this.
export function quaternionForOrientationKey(key) {
  if (key.includes(':')) {
    const [axisKey, direction] = key.split(':');
    return direction === 'in' ? inwardQuaternion(axisKey) : outwardQuaternion(axisKey);
  }
  return outwardQuaternion(key);
}
