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
import { rdRawVerts, CUBE_VERTS, octGapVertices, cuboctahedronVertices, NEIGHBOR_OFFSETS } from '../../src/core/lattice.js';
import { truncatedOctahedronVertices, BCC_NEIGHBOR_OFFSETS } from '../../src/geometry-extensions/dual-lattice.js';
import { bccShapeScaleFor } from '../../src/geometry-extensions/bcc-detail-lattice.js';
import {
  bootstrapDisphenoid,
  disphenoidVertsToWorld,
  octahedronDisphenoids,
  disphenoidKey,
  disphenoidNeighborAcrossFace,
  disphenoidVolume,
} from '../../src/geometry-extensions/interstitial-lattice.js';
// octGapCellToWorld inlined, NOT imported from cubocta-gap-build.js --
// that file imports `three` (not an npm dep here, see this file's own
// header), same reasoning cubocta-gap.test.mjs already documents.
function octGapCellToWorld(i, j, k, s = 1) {
  return [(i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s];
}

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

// Volume-matched radii (Direct override #2 in render.js's own
// sphericalClassificationFor -- real live-build feedback that
// face-plane-distance spheres read systematically too small for these
// pointy, faceted, lattice-tiling shapes). Cube and Octahedron are
// verified fully independently here: tetrahedron-volume-from-origin
// decomposition using ONLY the real vertex data, no face-ordering
// assumptions needed since a tetrahedron's signed volume from the
// origin to any 3 points doesn't care which order they're given in.
function tetraVolumeFromOrigin(a, b, c) {
  const cross = [
    b[1] * c[2] - b[2] * c[1],
    b[2] * c[0] - b[0] * c[2],
    b[0] * c[1] - b[1] * c[0],
  ];
  return Math.abs(a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
}

test('real Octahedron (octGapVertices) volume = scale^3/6, verified via its real 8 faces', () => {
  const scale = 3; // arbitrary non-1 scale, to also confirm cubic scaling
  const verts = octGapVertices(scale); // 6 verts: (+-R,0,0),(0,+-R,0),(0,0,+-R)
  const byAxis = [0, 1, 2].map((axis) => verts.filter((v) => v[axis] !== 0));
  let volume = 0;
  for (const vx of byAxis[0]) {
    for (const vy of byAxis[1]) {
      for (const vz of byAxis[2]) {
        volume += tetraVolumeFromOrigin(vx, vy, vz); // one of the 8 real triangular faces each time
      }
    }
  }
  assert.ok(Math.abs(volume - scale ** 3 / 6) < 1e-9, `got volume=${volume}, expected ${scale ** 3 / 6}`);
});

test('real Cube piece (CUBE_VERTS half-scale) volume = scale^3', () => {
  const scale = 2.5;
  const cube = CUBE_VERTS.map(([x, y, z]) => [x * 0.5 * scale, y * 0.5 * scale, z * 0.5 * scale]);
  // Axis-aligned box -- real volume is just the product of its own real
  // per-axis extents, no decomposition/ordering needed at all.
  const extent = (axis) => Math.max(...cube.map((v) => v[axis])) - Math.min(...cube.map((v) => v[axis]));
  const volume = extent(0) * extent(1) * extent(2);
  assert.ok(Math.abs(volume - scale ** 3) < 1e-9, `got volume=${volume}, expected ${scale ** 3}`);
});

test('volumeMatchedRadius applied to real per-shape volumes matches render.js\'s own documented constants', () => {
  // RD volume (2*scale^3) is grounded in this repo's own pre-existing,
  // already-relied-upon cube+6-pyramid decomposition (pyramidPieces,
  // RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md section 2) -- this is a
  // consistency check on the arithmetic, not a from-scratch
  // re-derivation of that decomposition itself.
  const scale = 1;
  assert.ok(Math.abs(volumeMatchedRadius(2 * scale ** 3) - 0.7816) < 1e-3);
  assert.ok(Math.abs(volumeMatchedRadius(scale ** 3 / 6) - 0.3413) < 1e-3);
  assert.ok(Math.abs(volumeMatchedRadius(scale ** 3) - 0.6204) < 1e-3);
});

test('EPSILON_UNIFORM_REL is a relative (not absolute) tolerance', () => {
  assert.equal(typeof EPSILON_UNIFORM_REL, 'number');
  assert.ok(EPSILON_UNIFORM_REL > 0 && EPSILON_UNIFORM_REL < 1e-2);
});

// --- Disphenoid pairwise merging (render.js's applySphericalToDisphenoids,
// 2026-09-01): a touching pair merges into one sphere; an unpaired
// disphenoid with a real neighbor present anywhere stays at the original
// capped radius; a fully isolated one (no real neighbor at all) gets its
// own uncapped volume-matched radius instead. All three R values here are
// computed programmatically from the real octahedronDisphenoids/
// disphenoidNeighborAcrossFace functions, not hand-derived, and cross-
// checked against render.js's own constants.

function centroidOf(verts) {
  return [0, 1, 2].map((i) => verts.reduce((s, v) => s + v[i], 0) / verts.length);
}
function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('a real bundle-mate pair is reachable via disphenoidNeighborAcrossFace (not assumed adjacent)', () => {
  const [D0, D1] = octahedronDisphenoids([0, 0, 0], [2, 0, 0]);
  const reachedKeys = [0, 1, 2, 3].map((i) => disphenoidKey(disphenoidNeighborAcrossFace(D0, i)));
  assert.ok(reachedKeys.includes(disphenoidKey(D1)), 'D0 must reach D1 across exactly one of its 4 real faces');
});

test('merged-pair ceiling: half the real distance from the pair centroid to its closest other real disphenoid (a remaining bundle-mate, not an outward neighbor)', () => {
  const [D0, D1, D2, D3] = octahedronDisphenoids([0, 0, 0], [2, 0, 0]);
  const cA = centroidOf(D0);
  const cB = centroidOf(D1);
  const mid = [0, 1, 2].map((i) => (cA[i] + cB[i]) / 2);

  const candidateDistances = [D2, D3].map((d) => dist3(mid, centroidOf(d)));
  // Also check D0/D1's own "outward" (non-shared-face) neighbors -- confirms
  // the bundle-mates really are the closest, not assumed.
  for (const [cell, excludeShared] of [[D0, 2], [D1, 3]]) {
    for (let i = 0; i < 4; i++) {
      if (i === excludeShared) continue;
      const nb = disphenoidNeighborAcrossFace(cell, i);
      candidateDistances.push(dist3(mid, centroidOf(nb)));
    }
  }
  const minDist = Math.min(...candidateDistances);
  assert.ok(Math.abs(minDist - Math.sqrt(10) / 4) < 1e-9, `got minDist=${minDist}, expected sqrt(10)/4=${Math.sqrt(10) / 4}`);
  const ceiling = minDist / 2;
  assert.ok(Math.abs(ceiling - Math.sqrt(10) / 8) < 1e-9);
});

test('disphenoidPairR: volume-matched(4/3*scale^3) exceeds the ceiling, so the ceiling binds', () => {
  const scale = 1;
  const [D0] = octahedronDisphenoids([0, 0, 0], [2, 0, 0]);
  const pairVolume = 2 * disphenoidVolume(D0) * scale ** 3; // disphenoidVolume is on raw (unscaled) verts
  const uncapped = volumeMatchedRadius((4 / 3) * scale ** 3);
  assert.ok(Math.abs(pairVolume - (4 / 3) * scale ** 3) < 1e-9, `got pairVolume=${pairVolume}`);
  const ceiling = (Math.sqrt(10) / 8) * scale;
  assert.ok(uncapped > ceiling, 'expected the ceiling to actually bind');
  const R = Math.min(uncapped, ceiling);
  assert.ok(Math.abs(R - ceiling) < 1e-9);
});

test('disphenoidFreeR (no real neighbor present) is bigger than the capped single-disphenoid R', () => {
  const scale = 1;
  const capped = scale / (2 * Math.SQRT2);
  const free = volumeMatchedRadius((2 / 3) * scale ** 3);
  assert.ok(free > capped, `expected free=${free} > capped=${capped}`);
});

// --- Proportion pass (2026-09-01): R = min(volume-matched radius, real
// tangent ceiling), where "tangent ceiling" is HALF the real distance to
// the nearest same-type neighbor in whatever lattice that piece type
// actually occupies. Each ceiling below is grounded in real placement
// data (not assumed), matching render.js's own sphericalClassificationFor
// header -- these are the same numbers that function's `cap()` helper
// uses directly.

test('RD/Cube ceiling: half the main FCC world\'s own NEIGHBOR_OFFSETS spacing', () => {
  const scale = 2; // arbitrary, confirms scale-linearity too
  const spacing = Math.hypot(...NEIGHBOR_OFFSETS[0]) * scale; // (1,1,0)-type, magnitude sqrt(2)
  const ceiling = spacing / 2;
  assert.ok(Math.abs(ceiling - scale / Math.SQRT2) < 1e-9, `got ceiling=${ceiling}`);
  // RD: volume-matched (0.7816*scale) exceeds this -> capped at the ceiling.
  assert.ok(Math.min(0.7816 * scale, ceiling) === ceiling);
  // Cube: volume-matched (0.6204*scale) is under the ceiling -> real growth, unchanged by the cap.
  assert.ok(Math.min(0.6204 * scale, ceiling) < ceiling);
});

test('Cuboctahedron ceiling: half its own real axis-adjacent spacing (1.0*scale, its doubled-density lattice, not RD\'s)', () => {
  const scale = 2;
  const originCO = cuboctahedronVertices(scale);
  const neighborCO = cuboctahedronVertices(scale).map(([x, y, z]) => [x + scale, y, z]); // real axis-adjacent CO, per lattice.js's own header
  const originFace = originCO.filter((v) => Math.abs(v[0] - 0.5 * scale) < 1e-9);
  const neighborFace = neighborCO.filter((v) => Math.abs(v[0] - 0.5 * scale) < 1e-9);
  // Real touching faces coincide exactly (vertex-for-vertex) -- so the
  // ceiling (half the axis-adjacent spacing) equals CO's own square-face
  // distance exactly, verified directly rather than assumed.
  const originKeys = new Set(originFace.map((v) => v.map((n) => n.toFixed(6)).join(',')));
  const neighborKeys = new Set(neighborFace.map((v) => v.map((n) => n.toFixed(6)).join(',')));
  assert.deepEqual(originKeys, neighborKeys);
  const ceiling = scale / 2;
  assert.ok(Math.abs(ceiling - 0.5 * scale) < 1e-9);
  assert.ok(Math.min(volumeMatchedRadius((5 / 6) * scale ** 3), ceiling) === ceiling); // volume-matched exceeds -> capped
});

test('Truncated Octahedron ceiling: half BCC_NEIGHBOR_OFFSETS\' own axis-family spacing (2*scale)', () => {
  const scale = 2;
  const axisOffset = BCC_NEIGHBOR_OFFSETS.find(([x, y, z]) => Math.hypot(x, y, z) === 2);
  assert.ok(axisOffset, 'expected a real (+-2,0,0)-type axis offset in BCC_NEIGHBOR_OFFSETS');
  const spacing = Math.hypot(...axisOffset) * scale;
  const ceiling = spacing / 2;
  assert.ok(Math.abs(ceiling - scale) < 1e-9, `got ceiling=${ceiling}`);
  // Confirmed "great size": volume-matched (0.9847*scale) is UNDER this
  // ceiling already, so the cap is inert -- min() just passes it through.
  assert.ok(Math.min(volumeMatchedRadius(4 * scale ** 3), ceiling) < ceiling);
});

test('Octahedron(gap) ceiling: half its own real octGap-lattice neighbor spacing (1.0*scale)', () => {
  const scale = 2;
  const a = octGapCellToWorld(0, 0, 0, scale);
  const b = octGapCellToWorld(1, 0, 0, scale); // real adjacent octGap index
  const spacing = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const ceiling = spacing / 2;
  assert.ok(Math.abs(ceiling - 0.5 * scale) < 1e-9, `got ceiling=${ceiling}`);
  // Real growth: volume-matched (0.3413*scale) is comfortably under this
  // ceiling, unlike the old face-plane-distance value (0.2887*scale).
  const oldValue = (0.5 * scale) / Math.sqrt(3);
  const newValue = Math.min(volumeMatchedRadius(scale ** 3 / 6), ceiling);
  assert.ok(newValue > oldValue, `expected growth: new=${newValue}, old=${oldValue}`);
  assert.ok(newValue < ceiling);
});

// Pyramid/Cube pieces (render.js's applySphericalToPartials): every
// pyramid-based cell shares ONE real per-pyramid volume unit
// (PYRAMID_VOLUME = scale^3/6, exactly 1/6 of RD's own cube+6-pyramid
// volume) -- these two exact relationships are why 6-pyramids-no-cube
// lands at precisely Cube's own sphere size, and why "twelve" (however
// spread across real construction) lands at precisely RD's.
test('6 real pyramid-units (no cube) sum to exactly Cube\'s own real volume (scale^3)', () => {
  const scale = 3;
  const pyramidVolume = scale ** 3 / 6;
  assert.ok(Math.abs(6 * pyramidVolume - scale ** 3) < 1e-9);
});

test('12 real pyramid-units sum to exactly RD\'s own real volume (2*scale^3, cube+6-pyramids)', () => {
  const scale = 3;
  const pyramidVolume = scale ** 3 / 6;
  assert.ok(Math.abs(12 * pyramidVolume - 2 * scale ** 3) < 1e-9);
});
