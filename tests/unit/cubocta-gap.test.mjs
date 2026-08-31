// Doubled-density Cuboctahedron + gap-octahedron (2026-08-31 session):
// pure geometry, verified numerically rather than assumed -- same
// standard this project already holds itself to (see interstitial-
// lattice.js's own header). Only imports from lattice.js -- cubocta-
// build.js/cubocta-gap-build.js both import `three`, which isn't an npm
// dependency in this repo (browser-only, loaded via importmap), so
// their own controller logic is live/Playwright-verified only, matching
// the existing precedent (cubocta-build.js itself has no unit tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuboctahedronVertices, octGapVertices, OCTA_VERTS } from '../../src/core/lattice.js';

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function keyOf(v) { return v.map((x) => Math.round(x * 1e6)).join(','); }

test('octGapVertices: a real regular octahedron, radius 0.5s, same direction set as OCTA_VERTS', () => {
  const s = 2;
  const verts = octGapVertices(s);
  assert.equal(verts.length, 6);
  for (const v of verts) {
    assert.ok(Math.abs(Math.hypot(...v) - 0.5 * s) < 1e-9, `vertex ${v} not at radius 0.5s`);
  }
  // same direction set as OCTA_VERTS, just scaled
  const expected = OCTA_VERTS.map(([x, y, z]) => [x * 0.5 * s, y * 0.5 * s, z * 0.5 * s]);
  assert.deepEqual(verts, expected);
});

test('axis-adjacent cuboctahedra (opposite integer parity) share their square face vertex-for-vertex, no resize', () => {
  const s = 1;
  const originCO = cuboctahedronVertices(s); // cell (0,0,0)
  const neighborCO = cuboctahedronVertices(s).map(([x, y, z]) => [x + 1 * s, y, z]); // cell (1,0,0)

  // origin's +x face: the 4 verts with x === +0.5s
  const originFace = originCO.filter((v) => Math.abs(v[0] - 0.5 * s) < 1e-9);
  // neighbor's -x face: the 4 verts with local x === -0.5s (world x === 0.5s too)
  const neighborFace = neighborCO.filter((v) => Math.abs(v[0] - 0.5 * s) < 1e-9);
  assert.equal(originFace.length, 4);
  assert.equal(neighborFace.length, 4);

  const originKeys = new Set(originFace.map(keyOf));
  const neighborKeys = new Set(neighborFace.map(keyOf));
  assert.deepEqual(originKeys, neighborKeys, 'axis-adjacent CO square faces must match exactly, vertex-for-vertex');
});

test('the gap-octahedron\'s 6 vertices are exactly the shared triangular-face vertices of two opposite-corner CO\'s (origin and (1,1,1))', () => {
  const s = 1;
  const originCO = cuboctahedronVertices(s); // cell (0,0,0)
  const farCO = cuboctahedronVertices(s).map(([x, y, z]) => [x + s, y + s, z + s]); // cell (1,1,1)

  // origin's face toward (1,1,1): the 3 verts with all nonzero coords positive
  const originFace = originCO.filter((v) => v.every((c) => c >= -1e-9));
  // far CO's face toward (0,0,0) (i.e. its own (-1,-1,-1) local face): the 3 verts with all nonzero coords <= its own center
  const farFace = farCO.filter((v) => v[0] <= s + 1e-9 && v[1] <= s + 1e-9 && v[2] <= s + 1e-9 &&
    (v[0] < s - 1e-9 || v[1] < s - 1e-9 || v[2] < s - 1e-9));
  assert.equal(originFace.length, 3);
  assert.equal(farFace.length, 3);

  const octVerts = octGapVertices(s).map(([x, y, z]) => [x + 0.5 * s, y + 0.5 * s, z + 0.5 * s]); // centered at cube-center (0.5,0.5,0.5)
  const octKeys = new Set(octVerts.map(keyOf));
  for (const v of [...originFace, ...farFace]) {
    assert.ok(octKeys.has(keyOf(v)), `CO-face vertex ${v} not found among the gap-octahedron's own 6 vertices`);
  }
  assert.equal(octKeys.size, 6);
});

test('volume conservation: 1 cuboctahedron + 1 gap-octahedron per unit cell sums to exactly the unit cell\'s own volume', () => {
  const s = 1;
  // CO edge length (real, measured, not assumed)
  const co = cuboctahedronVertices(s);
  let coEdge = Infinity;
  for (let i = 0; i < co.length; i++) for (let j = i + 1; j < co.length; j++) {
    const d = dist(co[i], co[j]);
    if (d > 1e-9 && d < coEdge) coEdge = d;
  }
  const vCO = (5 / 3) * Math.SQRT2 * coEdge ** 3; // real cuboctahedron volume formula

  const octGapRadius = 0.5 * s;
  const vOctGap = (4 / 3) * octGapRadius ** 3; // real regular-octahedron volume, vertices at radius r along each axis

  assert.ok(Math.abs(vCO + vOctGap - s ** 3) < 1e-9, `expected exact conservation, got vCO=${vCO} vOctGap=${vOctGap} sum=${vCO + vOctGap} target=${s ** 3}`);
});
