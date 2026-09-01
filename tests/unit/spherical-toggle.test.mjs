// Spherical Toggle Stage 1 (docs/RHOMBIVERSE_SPEC_ADDENDUM_SPHERICAL_TOGGLE.md).
// Two layers: (1) the pure classification/superellipsoid math against the
// spec's own worked examples, and (2) this repo's real per-shape face
// distances, computed directly from the actual vertex generators in
// lattice.js/dual-lattice.js (not re-derived by hand) -- ground-truth
// geometry, matching this project's own "verify numerically" precedent
// (see cubocta-gap.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyShape,
  superellipsoidN,
  volumeMatchedRadius,
  superellipsoidPoint,
  EPSILON_UNIFORM_REL,
} from '../../src/geometry-extensions/spherical-toggle.js';
import { rdRawVerts, CUBE_VERTS, octGapVertices, cuboctahedronVertices } from '../../src/core/lattice.js';
import { truncatedOctahedronVertices } from '../../src/geometry-extensions/dual-lattice.js';
import { bccShapeScaleFor } from '../../src/geometry-extensions/bcc-detail-lattice.js';
import { bootstrapDisphenoid, disphenoidVertsToWorld } from '../../src/geometry-extensions/interstitial-lattice.js';

function planeDistance(points) {
  // points: 3+ coplanar points -- returns the plane's distance from the origin.
  const [a, b, c] = points;
  const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0],
  ];
  const nLen = Math.hypot(...n);
  const d = Math.abs(n[0] * a[0] + n[1] * a[1] + n[2] * a[2]) / nLen;
  return d;
}

test('spec worked example: Cuboctahedron axis/diagonal ratio -> n = 2.7095', () => {
  const n = superellipsoidN(1.0, 1.1547);
  assert.ok(Math.abs(n - 2.7095) < 1e-3, `got n=${n}`);
});

test('spec worked example: Truncated Octahedron axis/diagonal ratio -> n = 1.5850', () => {
  const n = superellipsoidN(1.1547, 1.0);
  assert.ok(Math.abs(n - 1.5850) < 1e-3, `got n=${n}`);
});

test('volumeMatchedRadius: Cuboctahedron (V=20/3 at square-face-distance=1) -> R = 1.1675', () => {
  const R = volumeMatchedRadius(20 / 3);
  assert.ok(Math.abs(R - 1.1675) < 1e-3, `got R=${R}`);
});

test('volumeMatchedRadius: Truncated Octahedron corrected value -> R = 1.1371 (spec addendum previously had this wrong at 1.9695 -- see review)', () => {
  // Real TO volume at hex-face-distance=1, derived from the standard
  // vertex set (permutations of (0,+-1,+-2), volume 32 at edge=sqrt(2)),
  // rescaled by 1/sqrt(3) to put the hexagonal face at distance 1.
  const V = 32 / (3 * Math.sqrt(3));
  const R = volumeMatchedRadius(V);
  assert.ok(Math.abs(R - 1.1371) < 1e-3, `got R=${R}`);
  // Sanity floor: a volume-matched sphere can never exceed the shape's
  // own circumradius (a sphere that large would have strictly more
  // volume than any convex body it circumscribes). TO circumradius at
  // this normalization is a*sqrt(10)/2 with a = sqrt(2/3) -> ~1.291.
  const circumradius = Math.sqrt(2 / 3) * (Math.sqrt(10) / 2);
  assert.ok(R < circumradius, `volume-matched R=${R} must be < circumradius=${circumradius}`);
});

test('classifyShape: single face-distance entry -> sphere', () => {
  const result = classifyShape({ faceDistances: [{ distance: 0.70711 }] });
  assert.equal(result.mode, 'sphere');
  assert.ok(Math.abs(result.R - 0.70711) < 1e-6);
});

test('classifyShape: two distances both tagged axis -> falls back (not a valid axis/diagonal pair), needs volume', () => {
  assert.throws(() => classifyShape({
    faceDistances: [{ distance: 1.0, family: 'axis' }, { distance: 1.2, family: 'axis' }],
  }), /volumeSphere/);
});

test('classifyShape: proper axis+diagonal pair -> superellipsoid, R = axis distance', () => {
  const result = classifyShape({
    faceDistances: [{ distance: 1.1547, family: 'diagonal' }, { distance: 1.0, family: 'axis' }],
  });
  assert.equal(result.mode, 'superellipsoid');
  assert.ok(Math.abs(result.R - 1.0) < 1e-9);
  assert.ok(Math.abs(result.n - 2.7095) < 1e-3);
});

test('classifyShape: 3+ distinct distances, volume given -> volumeSphere fallback', () => {
  const result = classifyShape({
    faceDistances: [{ distance: 1.0 }, { distance: 1.2 }, { distance: 1.5 }],
    volume: 20 / 3,
  });
  assert.equal(result.mode, 'volumeSphere');
  assert.ok(Math.abs(result.R - 1.1675) < 1e-3);
});

test('classifyShape: unresolvable shape with no volume given -> throws rather than guessing', () => {
  assert.throws(() => classifyShape({ faceDistances: [{ distance: 1.0 }, { distance: 1.2 }, { distance: 1.5 }] }));
});

test('superellipsoidPoint: n=2 reduces to a plain sphere (every sampled point at exactly R)', () => {
  const R = 2.5;
  for (const eta of [-1.2, -0.3, 0, 0.7, 1.5]) {
    for (const omega of [-3, -1, 0, 1.4, 3]) {
      const [x, y, z] = superellipsoidPoint(eta, omega, R, 2);
      const d = Math.hypot(x, y, z);
      assert.ok(Math.abs(d - R) < 1e-9, `eta=${eta} omega=${omega} -> d=${d}, expected R=${R}`);
    }
  }
});

test('superellipsoidPoint: axis point (eta=0, omega=0) always lands at exactly (R,0,0) regardless of n', () => {
  for (const n of [1.585, 2, 2.7095, 5]) {
    const [x, y, z] = superellipsoidPoint(0, 0, 3, n);
    assert.ok(Math.abs(x - 3) < 1e-9 && Math.abs(y) < 1e-9 && Math.abs(z) < 1e-9, `n=${n} -> (${x},${y},${z})`);
  }
});

// --- Ground-truth: this repo's real placeable shapes, computed directly
// from the actual vertex generators, at SCALE=1 (results scale linearly
// with SCALE, so this is the general result, not a special case).

test('real RD (rdRawVerts) is uniform -> sphere, R = SCALE/sqrt(2)', () => {
  const verts = rdRawVerts(1);
  // A known RD face: two adjacent cube corners sharing a +x+y octant,
  // plus the two octahedron tips along +x and +y (see module comment
  // in lattice.js -- rdRawVerts = cube corners at +-0.5 + octa tips at +-1).
  const cube = verts.slice(0, 8);
  const octa = verts.slice(8, 14);
  const face = [
    cube.find(([x, y]) => x > 0 && y > 0),
    octa.find(([x, y, z]) => x > 0 && y === 0 && z === 0),
    octa.find(([x, y, z]) => y > 0 && x === 0 && z === 0),
  ];
  const d = planeDistance(face);
  const result = classifyShape({ faceDistances: [{ distance: d }] });
  assert.equal(result.mode, 'sphere');
  assert.ok(Math.abs(result.R - 1 / Math.SQRT2) < 1e-6, `got R=${result.R}`);
});

test('real Cube piece (rdRawVerts cube half) is uniform -> sphere, R = 0.5*SCALE', () => {
  const cube = CUBE_VERTS.map(([x, y, z]) => [x * 0.5, y * 0.5, z * 0.5]);
  const face = cube.filter(([x]) => x === 0.5); // the x=0.5 face, 4 coplanar points
  const d = planeDistance(face);
  const result = classifyShape({ faceDistances: [{ distance: d }] });
  assert.equal(result.mode, 'sphere');
  assert.ok(Math.abs(result.R - 0.5) < 1e-9);
});

test('real Octahedron piece (octGapVertices) is uniform -> sphere, R = 0.5*SCALE/sqrt(3)', () => {
  const verts = octGapVertices(1);
  const face = verts.filter(([x, y, z]) => x > 0 || y > 0 || z > 0).slice(0, 3);
  const d = planeDistance(face);
  const result = classifyShape({ faceDistances: [{ distance: d }] });
  assert.equal(result.mode, 'sphere');
  assert.ok(Math.abs(result.R - 0.5 / Math.sqrt(3)) < 1e-6, `got R=${result.R}`);
});

test('real Cuboctahedron (cuboctahedronVertices) -> superellipsoid, matches spec ratio', () => {
  const verts = cuboctahedronVertices(1);
  // Square (axis) face: the 4 verts with x === 0.5.
  const squareFace = verts.filter(([x]) => Math.abs(x - 0.5) < 1e-9);
  // Triangle (diagonal) face in the +x+y+z octant: (0.5,0.5,0), (0.5,0,0.5),
  // (0,0.5,0.5) -- all three sum to 1.0, coplanar on x+y+z=1.
  const triFace = [
    verts.find(([x, y, z]) => x === 0.5 && y === 0.5 && z === 0),
    verts.find(([x, y, z]) => x === 0.5 && y === 0 && z === 0.5),
    verts.find(([x, y, z]) => x === 0 && y === 0.5 && z === 0.5),
  ];
  assert.equal(squareFace.length, 4);
  const axisD = planeDistance(squareFace);
  const diagD = planeDistance(triFace);
  assert.ok(Math.abs(diagD / axisD - 1.1547) < 1e-3, `ratio=${diagD / axisD}`);
  const result = classifyShape({
    faceDistances: [{ distance: axisD, family: 'axis' }, { distance: diagD, family: 'diagonal' }],
  });
  assert.equal(result.mode, 'superellipsoid');
  assert.ok(Math.abs(result.R - 0.5) < 1e-9);
  assert.ok(Math.abs(result.n - 2.7095) < 1e-3);
});

test('real Truncated Octahedron (truncatedOctahedronVertices at bccShapeScaleFor(SCALE)) -> superellipsoid, matches spec ratio', () => {
  const s = bccShapeScaleFor(1); // SCALE=1 -> s=0.5
  const verts = truncatedOctahedronVertices(s);
  const squareFace = verts.filter(([, , z]) => Math.abs(z - 2 * s) < 1e-6);
  const hexFace = verts.filter(([x, y, z]) => Math.abs(x + y + z - 3 * s) < 1e-6);
  assert.equal(squareFace.length, 4);
  assert.equal(hexFace.length, 6);
  const axisD = planeDistance(squareFace);
  const diagD = planeDistance(hexFace);
  assert.ok(Math.abs(axisD / diagD - 1.1547) < 1e-3, `ratio=${axisD / diagD}`);
  const result = classifyShape({
    faceDistances: [{ distance: axisD, family: 'axis' }, { distance: diagD, family: 'diagonal' }],
  });
  assert.equal(result.mode, 'superellipsoid');
  assert.ok(Math.abs(result.R - 1) < 1e-6, `got R=${result.R}`); // axis distance = SCALE = 1
  assert.ok(Math.abs(result.n - 1.5850) < 1e-3);
});

test('real Disphenoid (bootstrapDisphenoid) is uniform -> sphere, R = SCALE/(2*sqrt(2))', () => {
  const raw = bootstrapDisphenoid([0, 0, 0]);
  const world = disphenoidVertsToWorld(raw, 1); // SCALE=1
  const centroid = [0, 1, 2].map((i) => world.reduce((s, v) => s + v[i], 0) / 4);
  // All 4 faces (each excluding one of the 4 vertices) -- confirm every
  // one lands the same distance from centroid, not just one face.
  const distances = [0, 1, 2, 3].map((excludeIdx) => {
    const face = world.filter((_, i) => i !== excludeIdx);
    const d = planeDistance(face.map((v) => [v[0] - centroid[0], v[1] - centroid[1], v[2] - centroid[2]]));
    return d;
  });
  const result = classifyShape({ faceDistances: distances.map((distance) => ({ distance })) });
  assert.equal(result.mode, 'sphere');
  assert.ok(Math.abs(result.R - 1 / (2 * Math.SQRT2)) < 1e-9, `got R=${result.R}`);
});

test('EPSILON_UNIFORM_REL is a relative (not absolute) tolerance', () => {
  assert.equal(typeof EPSILON_UNIFORM_REL, 'number');
  assert.ok(EPSILON_UNIFORM_REL > 0 && EPSILON_UNIFORM_REL < 1e-2);
});
