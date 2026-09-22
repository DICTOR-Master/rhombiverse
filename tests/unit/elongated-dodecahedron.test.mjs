// Elongated Dodecahedron: real, verified geometry (18 vertices, 8
// rhombic + 4 hexagonal faces) plus its own anisotropic world-scale for
// the FCC-shared lattice frame. Regression coverage for a real bug
// found live, direct report ("i am revolving it in every direction...
// no hexagon faces" / "RD is coming after elongated is selected"):
// elongDodecaCellToWorld's old formula (`z * (s+h)`) charged a FULL
// elongation gap for the very FIRST step away from the real,
// un-elongated RD every piece bootstraps off (see elongated-
// dodecahedron.js's own header), when only HALF that gap is real there
// -- misaligning every piece bootstrapped in a direction with a
// nonzero z component (8 of NEIGHBOR_OFFSETS' 12 real directions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elongatedDodecahedronVerts, elongDodecaCellToWorld } from '../../src/geometry-extensions/elongated-dodecahedron.js';
import { rdRawVerts, NEIGHBOR_OFFSETS } from '../../src/core/lattice.js';

function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

test('elongatedDodecahedronVerts returns 18 real vertices, taller than RD only along Z', () => {
  const s = 1;
  const rd = rdRawVerts(s);
  const ed = elongatedDodecahedronVerts(s);
  assert.equal(ed.length, 18);
  const bbox = (verts) => ['x', 'y', 'z'].map((_, i) => [Math.min(...verts.map((v) => v[i])), Math.max(...verts.map((v) => v[i]))]);
  const rdBox = bbox(rd);
  const edBox = bbox(ed);
  assert.ok(Math.abs(rdBox[0][1] - edBox[0][1]) < 1e-9, 'X extent unchanged');
  assert.ok(Math.abs(rdBox[1][1] - edBox[1][1]) < 1e-9, 'Y extent unchanged');
  assert.ok(edBox[2][1] > rdBox[2][1], 'Z extent is genuinely taller (elongated)');
});

test('elongDodecaCellToWorld(0,0,0) is the origin, matching an un-elongated RD there', () => {
  assert.deepEqual(elongDodecaCellToWorld(0, 0, 0, 1), [0, 0, 0]);
});

test('elongDodecaCellToWorld is self-consistent: one real RD-transition step (h/2) plus N further full elongdodeca steps (h each)', () => {
  const s = 1;
  const h = Math.sqrt(3) * 0.5;
  const [, , z1] = elongDodecaCellToWorld(0, 0, 1, s);
  const [, , z2] = elongDodecaCellToWorld(0, 0, 2, s);
  assert.ok(Math.abs(z1 - (s + h / 2)) < 1e-9, 'first step is a half-elongation transition off a real RD');
  assert.ok(Math.abs(z2 - (z1 + (s + h))) < 1e-9, 'each further step is a full elongdodeca-to-elongdodeca gap');
  const [, , zNeg1] = elongDodecaCellToWorld(0, 0, -1, s);
  assert.ok(Math.abs(zNeg1 + z1) < 1e-9, 'symmetric in -z');
});

test('a bootstrapped Elongated Dodecahedron sits EXACTLY flush against the real RD it grew from, for every one of the 8 real "pole" NEIGHBOR_OFFSETS directions (dz != 0)', () => {
  // Scoped to the 8 directions with a nonzero z-component -- these are
  // the ones this fix actually changes (the "pole" rhombic faces,
  // shifted outward but otherwise UNCHANGED by elongation, so the
  // shared face's own 4 vertices must exactly coincide, same real RD
  // points). The other 4 directions (dz=0, the "equator") are a
  // genuinely different case -- their shared face becomes a real
  // HEXAGON, whose vertices are the ORIGINAL octahedral points split
  // into two new ones (see elongatedDodecahedronVerts' own header), not
  // a plain 4-vertex match -- covered by the "equator center position"
  // test below instead.
  const s = 1;
  const rd = rdRawVerts(s);
  const cube = rd.slice(0, 8);
  const octa = rd.slice(8, 14);
  const octaVertex = (axis, sign) => octa[axis * 2 + (sign > 0 ? 0 : 1)];
  const edVerts = elongatedDodecahedronVerts(s);
  const poleOffsets = NEIGHBOR_OFFSETS.filter(([, , dz]) => dz !== 0);
  assert.equal(poleOffsets.length, 8);

  for (const [dx, dy, dz] of poleOffsets) {
    const axes = [dx, dy, dz];
    const [a1, a2] = [0, 1, 2].filter((a) => axes[a] !== 0);
    const s1 = Math.sign(axes[a1]);
    const s2 = Math.sign(axes[a2]);
    const cubeMatches = cube.filter((v) => Math.sign(v[a1]) === s1 && Math.sign(v[a2]) === s2);
    const faceVerts = [octaVertex(a1, s1), cubeMatches[0], octaVertex(a2, s2), cubeMatches[1]];

    const [wx, wy, wz] = elongDodecaCellToWorld(dx, dy, dz, s);
    const edWorldVerts = edVerts.map(([x, y, z]) => [x + wx, y + wy, z + wz]);

    for (const fv of faceVerts) {
      const best = Math.min(...edWorldVerts.map((v) => dist(v, fv)));
      assert.ok(best < 1e-9, `RD face vertex ${JSON.stringify(fv)} for direction ${JSON.stringify([dx, dy, dz])} should exactly coincide with a real ElongDodeca vertex (closest was ${best})`);
    }
  }
});

test('for the 4 "equator" NEIGHBOR_OFFSETS directions (dz=0), the ElongDodeca cell center exactly matches a plain RD neighbor there -- unaffected by elongation, as expected', () => {
  const s = 1;
  const equatorOffsets = NEIGHBOR_OFFSETS.filter(([, , dz]) => dz === 0);
  assert.equal(equatorOffsets.length, 4);
  for (const [dx, dy, dz] of equatorOffsets) {
    const [wx, wy, wz] = elongDodecaCellToWorld(dx, dy, dz, s);
    assert.deepEqual([wx, wy, wz], [dx * s, dy * s, 0]);
  }
});
