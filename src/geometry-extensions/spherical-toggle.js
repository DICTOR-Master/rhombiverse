// Spherical Toggle (docs/RHOMBIVERSE_SPEC_ADDENDUM_SPHERICAL_TOGGLE.md):
// pure geometry/classification math only, no `three` import (matches
// cubocta-gap.test.mjs's own precedent -- `three` isn't an npm dependency
// in this repo, browser-only via importmap, so anything that needs to be
// unit-testable under `node --test` has to stay THREE-free). render.js
// consumes this module's outputs (mode/R/n, or raw sample points from
// sampleSuperellipsoidGrid) to build the actual BufferGeometry.
//
// Covers Section 1 (classification) + Section 2 (superellipsoid formula)
// + Section 3 (volume-matched fallback). There is no ring/torus grouping
// in this feature at all, by direct instruction -- not deferred, ruled
// out entirely. Every cell (disphenoid included) always renders as its
// own individual sphere, regardless of how many same-type cells share an
// axis. The spec's own original draft had a ring-of-disphenoids->torus
// section; it was removed from the doc, not left as future work.
//
// EPSILON_UNIFORM deviates from the spec's own suggested value: the spec
// suggests a flat 1e-4 absolute tolerance, written against numeric
// examples normalized to R~1. This repo's real shapes are compared at
// whatever SCALE the world is currently using, which is not fixed to ~1
// -- an absolute tolerance would over- or under-fire depending on SCALE.
// Using the same 1e-4 as a RELATIVE tolerance (fraction of the mean of
// the two distances being compared) keeps the check scale-invariant,
// which is what "uniform face distance" actually means geometrically.

export const EPSILON_UNIFORM_REL = 1e-4;

function signedPow(x, p) {
  return Math.sign(x) * Math.abs(x) ** p;
}

// Section 2: n solved from the ratio of the two face distances.
// rho = diagonal / axis; n = 1 / (0.5 - log_3(rho)).
// Derivation check (also covered by spherical-toggle.test.mjs): setting
// y=z=0 in |x|^n+|y|^n+|z|^n=R^n gives x=R regardless of n, so R is
// always exactly the axis-aligned face distance; matching the diagonal
// ray (x=y=z=t) point's distance-from-origin (t*sqrt(3)) to
// diagonal_face_distance and solving for n gives exactly this formula.
export function superellipsoidN(axisDistance, diagonalDistance) {
  const rho = diagonalDistance / axisDistance;
  return 1 / (0.5 - Math.log(rho) / Math.log(3));
}

// Section 3 fallback: volume-matched sphere. R = (3V / 4pi)^(1/3).
export function volumeMatchedRadius(volume) {
  return Math.cbrt((3 * volume) / (4 * Math.PI));
}

// Groups raw {distance, family} records into distinct face-orientation
// classes, folding together any within EPSILON_UNIFORM_REL of each other.
// Small-input single-linkage-by-sort -- these lists only ever have a
// handful of entries (one per distinct face orientation of one shape),
// no need for anything fancier.
function groupByDistance(faceDistances) {
  const sorted = [...faceDistances].sort((a, b) => a.distance - b.distance);
  const groups = [];
  for (const fd of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(fd.distance - last.distance) <= EPSILON_UNIFORM_REL * ((fd.distance + last.distance) / 2)) {
      last.families.add(fd.family ?? 'unspecified');
      last.distance = (last.distance + fd.distance) / 2;
    } else {
      groups.push({ distance: fd.distance, families: new Set([fd.family ?? 'unspecified']) });
    }
  }
  return groups;
}

// Section 1: classify a shape from its distinct face-plane distances.
// faceDistances: [{ distance: number, family?: 'axis' | 'diagonal' }],
// one entry per distinct face-orientation class (not per individual
// face). `family` is only required to disambiguate the exactly-two-
// distances case (axis-aligned vs. body-diagonal); omit it for shapes
// being tested for uniformity only.
// `volume`: required only if the shape needs the fallback case.
export function classifyShape({ faceDistances, volume } = {}) {
  if (!Array.isArray(faceDistances) || faceDistances.length === 0) {
    throw new Error('classifyShape: faceDistances must be a non-empty array');
  }
  const groups = groupByDistance(faceDistances);

  if (groups.length === 1) {
    return { mode: 'sphere', R: groups[0].distance };
  }

  if (groups.length === 2) {
    const axisGroup = groups.find((g) => g.families.size === 1 && g.families.has('axis'));
    const diagGroup = groups.find((g) => g.families.size === 1 && g.families.has('diagonal'));
    if (axisGroup && diagGroup) {
      const n = superellipsoidN(axisGroup.distance, diagGroup.distance);
      return { mode: 'superellipsoid', R: axisGroup.distance, n };
    }
  }

  if (volume === undefined) {
    throw new Error('classifyShape: shape does not resolve to sphere or superellipsoid -- pass `volume` for the volumeSphere fallback');
  }
  return { mode: 'volumeSphere', R: volumeMatchedRadius(volume) };
}

// Single reusable point generator for ALL three render modes -- 'sphere'
// and 'volumeSphere' are just this formula at n=2 (verified in
// spherical-toggle.test.mjs: at n=2, m=1, the signed-power terms reduce
// to plain cos/sin, the standard sphere parametrization). Matches the
// spec's own implementation note: "one reusable function... not a
// per-shape mesh."
// eta: latitude, [-pi/2, pi/2]. omega: longitude, [-pi, pi].
export function superellipsoidPoint(eta, omega, R, n) {
  const m = 2 / n;
  const cEta = signedPow(Math.cos(eta), m);
  const sEta = signedPow(Math.sin(eta), m);
  const cOmega = signedPow(Math.cos(omega), m);
  const sOmega = signedPow(Math.sin(omega), m);
  return [R * cEta * cOmega, R * cEta * sOmega, R * sEta];
}

// Lat/lon grid of surface points -- render.js turns this into a
// BufferGeometry (standard UV-sphere-style quad/triangle strip). Kept
// here (not in render.js) so the grid math itself stays unit-testable
// without `three`.
export function sampleSuperellipsoidGrid(R, n, latSegments = 16, lonSegments = 24) {
  const rows = [];
  for (let i = 0; i <= latSegments; i++) {
    const eta = -Math.PI / 2 + (Math.PI * i) / latSegments;
    const row = [];
    for (let j = 0; j <= lonSegments; j++) {
      const omega = -Math.PI + (2 * Math.PI * j) / lonSegments;
      row.push(superellipsoidPoint(eta, omega, R, n));
    }
    rows.push(row);
  }
  return rows;
}
