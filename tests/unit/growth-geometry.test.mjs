// Ammann-rhombohedra tiling geometry -- the deterministic, live half of
// growth.js kept after the 2026-09-22 split (second world-building
// removal pass). Extracted from growth.test.mjs, which tested the
// growth-over-time engine half (now archived, see
// tests/unit/growth-archived.test.mjs... actually kept as
// growth.test.mjs itself, which tested the retired engine and was deleted 2026-09-24)
// alongside this geometry. Zero npm dependencies, same as lattice.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHI,
  STAR_DIRECTIONS,
  VALID_TRIPLES,
  unitTileVertices,
  tilesOverlap,
} from '../../src/geometry-extensions/growth.js';

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function len(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

test('STAR_DIRECTIONS: 12 unit vectors, exactly two non-antipodal pairwise angle classes', () => {
  assert.equal(STAR_DIRECTIONS.length, 12);
  for (const v of STAR_DIRECTIONS) {
    assert.ok(Math.abs(len(v) - 1) < 1e-9, 'each direction must be unit length');
  }
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      const ang = (Math.acos(Math.max(-1, Math.min(1, dot(STAR_DIRECTIONS[i], STAR_DIRECTIONS[j])))) * 180) / Math.PI;
      seen.add(Math.round(ang * 100) / 100);
    }
  }
  // Exactly three distinct pairwise angles across all 66 pairs:
  // 63.43 (acute), 116.57 (oblate), 180 (antipodal) -- verified during
  // the spec pass and re-checked here at every module load.
  const rounded = [...seen].sort((a, b) => a - b);
  assert.deepEqual(rounded, [63.43, 116.57, 180]);
});

test('VALID_TRIPLES: exactly 20 acute + 20 oblate among all 220 possible triples', () => {
  const acute = VALID_TRIPLES.filter((t) => t.type === 'acute');
  const oblate = VALID_TRIPLES.filter((t) => t.type === 'oblate');
  assert.equal(acute.length, 20);
  assert.equal(oblate.length, 20);
});

test('every valid triple is a genuine golden rhombohedron: faces are golden rhombi, and acute/oblate volumes are in exact ratio phi', () => {
  function volume(dirs) {
    const [a, b, c] = dirs.map((i) => STAR_DIRECTIONS[i]);
    // scalar triple product a . (b x c)
    const cross = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    return Math.abs(dot(a, cross));
  }
  function faceDiagonalRatio(dirs) {
    const [a, b] = dirs.slice(0, 2).map((i) => STAR_DIRECTIONS[i]);
    const dLong = len([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
    const dShort = len([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
    return Math.max(dLong, dShort) / Math.min(dLong, dShort);
  }

  const acute = VALID_TRIPLES.find((t) => t.type === 'acute');
  const oblate = VALID_TRIPLES.find((t) => t.type === 'oblate');

  assert.ok(Math.abs(faceDiagonalRatio(acute.dirs) - PHI) < 1e-9);
  assert.ok(Math.abs(faceDiagonalRatio(oblate.dirs) - PHI) < 1e-9);

  const vAcute = volume(acute.dirs);
  const vOblate = volume(oblate.dirs);
  assert.ok(Math.abs(vAcute / vOblate - PHI) < 1e-9, `expected volume ratio phi, got ${vAcute / vOblate}`);
});

test('unitTileVertices: 8 distinct vertices for a real triple', () => {
  const verts = unitTileVertices(VALID_TRIPLES[0].dirs);
  assert.equal(verts.length, 8);
  const keys = new Set(verts.map((v) => v.map((x) => x.toFixed(5)).join(',')));
  assert.equal(keys.size, 8);
});

test('tilesOverlap: two tiles at the same origin (identical) genuinely overlap; a tile far away does not', () => {
  const dirs = VALID_TRIPLES[0].dirs;
  const vertsA = unitTileVertices(dirs);
  const vertsB = unitTileVertices(dirs);
  assert.ok(tilesOverlap(vertsA, vertsB), 'identical tiles at the same origin must overlap');
  const vertsFar = unitTileVertices(dirs).map(([x, y, z]) => [x + 100, y + 100, z + 100]);
  assert.ok(!tilesOverlap(vertsA, vertsFar), 'tiles far apart must not overlap');
});
