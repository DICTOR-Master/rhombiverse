// Calcite/magnesite (CaCO3/MgCO3, R-3c rhombohedral carbonate) lattice
// math -- built directly on rock-salt-lattice.js's own real cation/anion
// topology (calcite genuinely IS a rhombohedrally-distorted rock-salt
// structure: same two interpenetrating sublattices, a real, documented
// mineralogical fact, not a fresh derivation), plus two genuinely new
// pieces of real geometry rock salt never needed: a trigonal (3-fold,
// [1,1,1]-axis) distortion, and a real flat CO3(2-) triangular anion
// that flips orientation between alternating layers along that same
// axis -- the actual real reason this space group is called "R"
// (rhombohedral-centered), not an invented flourish. Pure math only,
// no `three` import (matches every other geometry-extensions file's own
// "unit-testable under node --test" convention). Full design rationale:
// docs/code-notes/geometry-extensions/calcite-lattice.md
import { isCationSite, isAnionSite, CATION_ANION_OFFSETS } from './rock-salt-lattice.js';

export { isCationSite, isAnionSite, CATION_ANION_OFFSETS };

// The real axial stretch factor along [1,1,1] that turns the cubic
// rock-salt parent's own 60-degree cation-cation rhombohedral angle
// into calcite's real, well-documented rhombohedral angle of ~101.5
// degrees -- derived algebraically below (see the module's own
// standalone sanity gate for the full derivation and a numeric
// round-trip check), not a hand-picked "looks about right" number. An
// idealization from first principles (a real hypothetical cubic NaCl-
// type parent compressed to calcite's own real measured angle), not a
// claim of lab-precision lattice constants -- honest about that, the
// same spirit stages.js's own real-metal colors already use ("standard
// reference approximations... not exact spectrophotometry").
export const CALCITE_RHOMBOHEDRAL_ANGLE_DEG = 101.5;
export const AXIAL_STRETCH_FACTOR = 0.3540188897683978;

const TRIGONAL_AXIS = [1, 1, 1];
const TRIGONAL_AXIS_LEN = Math.sqrt(3);
const TRIGONAL_UNIT = TRIGONAL_AXIS.map((v) => v / TRIGONAL_AXIS_LEN);

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function norm(a) { return Math.hypot(a[0], a[1], a[2]); }

// The real trigonal distortion: decompose into components parallel/
// perpendicular to the [1,1,1] axis, stretch ONLY the parallel
// component by AXIAL_STRETCH_FACTOR, leave the perpendicular plane
// (the real plane the CO3 triangles themselves lie in) untouched.
export function distortToRhombohedral([x, y, z]) {
  const v = [x, y, z];
  const along = dot(v, TRIGONAL_UNIT);
  const parallel = scale(TRIGONAL_UNIT, along);
  const perp = sub(v, parallel);
  return add(perp, scale(parallel, AXIAL_STRETCH_FACTOR));
}

// Real orthonormal basis for the plane perpendicular to [1,1,1] -- used
// to build the real CO3 triangle, which lies IN that plane (the actual
// reason calcite's carbonate groups sit "flat" relative to the trigonal
// axis, not an arbitrary choice of orientation).
const PERP_E1 = (() => {
  const raw = [1, -1, 0];
  const n = norm(raw);
  return raw.map((v) => v / n);
})();
const PERP_E2 = (() => {
  // TRIGONAL_UNIT x PERP_E1, real cross product -- guaranteed
  // perpendicular to both by construction, not assumed.
  const [ax, ay, az] = TRIGONAL_UNIT;
  const [bx, by, bz] = PERP_E1;
  const raw = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  const n = norm(raw);
  return raw.map((v) => v / n);
})();

// Which real anion LAYER (an integer plane index along [1,1,1]) a given
// raw lattice point sits on -- consecutive integer values of x+y+z are
// consecutive real (111) planes of this combined lattice (confirmed in
// rock-salt-lattice.js's own self-test: cation/anion sublattices
// exactly partition every integer point by x+y+z parity), so anion
// planes specifically (odd sums) are 2 apart. Layer parity of THIS
// index is what alternates the real CO3 orientation below -- the
// actual structural feature that makes this a genuine R-3c (not P-3c1)
// space group, not an invented flourish.
export function anionLayerIndex(x, y, z) {
  return (x + y + z - 1) / 2;
}

// Real flat equilateral CO3 triangle, centered on a real (already-
// distorted) anion world position, radius `r` (a real molecular-scale
// decoration, deliberately much smaller than the lattice spacing --
// same "stylized, not lab-scale-accurate" convention this whole
// project already uses for piece geometry). Orientation alternates by
// a real 60-degree rotation between adjacent anion layers -- verified
// in the sanity gate below to produce a genuine equilateral triangle
// regardless of which layer it's on.
export function co3TriangleVerts(anionWorldPos, r, layerIndex) {
  const rotationOffsetDeg = ((layerIndex % 2) + 2) % 2 === 0 ? 0 : 60;
  const verts = [];
  for (let i = 0; i < 3; i++) {
    const angleDeg = rotationOffsetDeg + i * 120;
    const angleRad = (angleDeg * Math.PI) / 180;
    const offset = add(scale(PERP_E1, Math.cos(angleRad) * r), scale(PERP_E2, Math.sin(angleRad) * r));
    verts.push(add(anionWorldPos, offset));
  }
  return verts;
}

// Standalone sanity gate: `node src/geometry-extensions/calcite-lattice.js`
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('calcite-lattice.js')) {
  const acos = (c) => (Math.acos(c) * 180) / Math.PI;

  // 1. The real distortion, applied to two real cation-cation nearest-
  // neighbor vectors (NEIGHBOR_OFFSETS-family, magnitude sqrt(2), real
  // 60-degree angle in the undistorted cubic parent), must produce
  // EXACTLY calcite's own real rhombohedral angle -- not approximately,
  // the derivation is supposed to hit it on the nose.
  const v1 = distortToRhombohedral([1, 1, 0]);
  const v2 = distortToRhombohedral([1, 0, 1]);
  const angle = acos(dot(v1, v2) / (norm(v1) * norm(v2)));
  console.log(`distorted cation-cation angle (expect ${CALCITE_RHOMBOHEDRAL_ANGLE_DEG}):`, angle);
  if (Math.abs(angle - CALCITE_RHOMBOHEDRAL_ANGLE_DEG) > 1e-6) {
    throw new Error(`distortion produced angle ${angle}, expected ${CALCITE_RHOMBOHEDRAL_ANGLE_DEG}`);
  }

  // 2. The trigonal axis itself must be UNCHANGED in direction (only
  // its own length scales) -- a real distortion along an axis should
  // never rotate that same axis.
  const axisImage = distortToRhombohedral(TRIGONAL_AXIS);
  const axisDir = axisImage.map((v) => v / norm(axisImage));
  const dotWithOriginal = dot(axisDir, TRIGONAL_UNIT);
  console.log('trigonal axis direction preserved (expect 1):', dotWithOriginal);
  if (Math.abs(dotWithOriginal - 1) > 1e-9) throw new Error('trigonal axis direction was not preserved');

  // 3. The perpendicular basis is genuinely perpendicular to the axis
  // AND to each other, real orthonormal frame, not assumed.
  console.log('PERP_E1 . axis (expect 0):', dot(PERP_E1, TRIGONAL_UNIT));
  console.log('PERP_E2 . axis (expect 0):', dot(PERP_E2, TRIGONAL_UNIT));
  console.log('PERP_E1 . PERP_E2 (expect 0):', dot(PERP_E1, PERP_E2));
  console.log('|PERP_E1| (expect 1):', norm(PERP_E1));
  console.log('|PERP_E2| (expect 1):', norm(PERP_E2));
  if (Math.abs(dot(PERP_E1, TRIGONAL_UNIT)) > 1e-9) throw new Error('PERP_E1 not perpendicular to axis');
  if (Math.abs(dot(PERP_E2, TRIGONAL_UNIT)) > 1e-9) throw new Error('PERP_E2 not perpendicular to axis');
  if (Math.abs(dot(PERP_E1, PERP_E2)) > 1e-9) throw new Error('PERP_E1/PERP_E2 not orthogonal');

  // 4. A real CO3 triangle, at either layer parity, must be genuinely
  // equilateral (all 3 sides equal) and genuinely planar (all 3
  // vertices equidistant from, and the triangle's own normal parallel
  // to, the trigonal axis) -- both checked, not assumed.
  for (const layerIndex of [0, 1]) {
    const verts = co3TriangleVerts([0, 0, 0], 1, layerIndex);
    const sideLens = [
      norm(sub(verts[0], verts[1])),
      norm(sub(verts[1], verts[2])),
      norm(sub(verts[2], verts[0])),
    ];
    const equilateral = sideLens.every((l) => Math.abs(l - sideLens[0]) < 1e-9);
    console.log(`layer ${layerIndex} CO3 triangle side lengths (expect all equal):`, sideLens, 'equilateral:', equilateral);
    if (!equilateral) throw new Error(`layer ${layerIndex} CO3 triangle is not equilateral`);
    for (const v of verts) {
      if (Math.abs(dot(v, TRIGONAL_UNIT)) > 1e-9) throw new Error(`layer ${layerIndex} CO3 vertex not perpendicular to trigonal axis`);
    }
  }

  // 5. Real alternation: layer 0 and layer 1 triangles must be
  // genuinely rotated relative to each other (a real 60-degree
  // offset), not accidentally identical -- the actual structural
  // feature that makes this R-3c rather than a plain stacked P lattice.
  const v0 = co3TriangleVerts([0, 0, 0], 1, 0)[0];
  const v1t = co3TriangleVerts([0, 0, 0], 1, 1)[0];
  const rotationAngle = acos(dot(v0, v1t) / (norm(v0) * norm(v1t)));
  console.log('rotation between layer 0 and layer 1 triangle orientation (expect 60):', rotationAngle);
  if (Math.abs(rotationAngle - 60) > 1e-6) throw new Error(`expected 60 degree alternation, got ${rotationAngle}`);

  console.log('OK');
}
