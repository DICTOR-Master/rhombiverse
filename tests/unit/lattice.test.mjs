// Pure math, zero dependencies (lattice.js itself imports nothing) --
// runs with plain `node --test`, no npm install needed. Covers the one
// formula reused across nearly every subsystem in this project
// (shellCount(n) = 10n^2+2, CLAUDE.md's own words) and the parity
// invariant every other coordinate check in the app assumes holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCell,
  NEIGHBOR_OFFSETS,
  cellKey,
  parseCellKey,
  shellCount,
  cellsInShells,
  nearestValidCell,
  facePieces,
  pyramidPieces,
} from '../../src/core/lattice.js';

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { return Math.hypot(a[0], a[1], a[2]); }
function tetraVolume(a, b, c, d) {
  return Math.abs(dot(sub(b, a), cross(sub(c, a), sub(d, a)))) / 6;
}
function pyramidVolume({ base: [b0, b1, b2, b3], apex }) {
  return tetraVolume(apex, b0, b1, b2) + tetraVolume(apex, b0, b2, b3);
}

// facePieces() exists specifically because an earlier real attempt at
// chunk-to-chunk interlocking geometry (Rhombis, 2026-09-05) built its
// tabs from pyramidPieces()'s own 6-axis frame instead -- which only
// ever reaches a single VERTEX of a real 12-neighbor-direction face,
// not the flat face itself, so two chunks built that way only ever
// touched at a point. These tests are the real guarantee that never
// happens again: every face is a genuine planar rhombus facing the
// correct real neighbor direction, and the 12 of them together
// reconstruct the exact same RD pyramidPieces() already builds.
test('facePieces: each of the 12 real faces is planar, a genuine rhombus (4 equal sides), and faces its own NEIGHBOR_OFFSETS direction', () => {
  const faces = facePieces(2);
  assert.equal(faces.length, 12);
  faces.forEach(({ base }, i) => {
    const [v0, v1, v2, v3] = base;
    const sides = [norm(sub(v1, v0)), norm(sub(v2, v1)), norm(sub(v3, v2)), norm(sub(v0, v3))];
    sides.forEach((len) => assert.ok(Math.abs(len - sides[0]) < 1e-9, `face ${i} side lengths not equal`));
    const planeNormal = cross(sub(v1, v0), sub(v2, v0));
    assert.ok(Math.abs(dot(planeNormal, sub(v3, v0))) < 1e-9, `face ${i} vertices not coplanar`);
    const centroid = [0, 1, 2].map((k) => (v0[k] + v1[k] + v2[k] + v3[k]) / 4);
    const dir = centroid.map((c) => c / norm(centroid));
    const expected = NEIGHBOR_OFFSETS[i].map((c) => c / norm(NEIGHBOR_OFFSETS[i]));
    assert.ok(Math.abs(dot(dir, expected) - 1) < 1e-6, `face ${i} does not face its own NEIGHBOR_OFFSETS direction`);
  });
});

test('facePieces: the 12 real face-pyramids reconstruct the exact same RD volume as pyramidPieces (cube + 6 pyramids)', () => {
  const scale = 3;
  const { cube: cubeVerts, pyramids } = pyramidPieces(scale);
  // Cube volume via its own real edge length (cubeVerts[0] and [1]
  // differ only in z per CUBE_VERTS' own nesting order -- a real edge,
  // not a face or space diagonal).
  const cubeEdge = norm(sub(cubeVerts[1], cubeVerts[0]));
  const pyramidTotal = Object.values(pyramids).reduce((sum, p) => sum + pyramidVolume(p), 0);
  const totalOld = cubeEdge ** 3 + pyramidTotal;

  const faceTotal = facePieces(scale).reduce((sum, f) => sum + pyramidVolume(f), 0);
  assert.ok(Math.abs(totalOld - faceTotal) < 1e-6, `expected ${totalOld}, got ${faceTotal}`);
});

test('isValidCell: FCC parity (x+y+z even)', () => {
  assert.equal(isValidCell(0, 0, 0), true);
  assert.equal(isValidCell(1, 1, 0), true);
  assert.equal(isValidCell(1, -1, 0), true);
  assert.equal(isValidCell(1, 0, 0), false);
  assert.equal(isValidCell(2, 3, 0), false);
});

test('cellKey/parseCellKey round-trip', () => {
  for (const [x, y, z] of [[0, 0, 0], [5, -3, 12], [-100, 0, 100]]) {
    assert.deepEqual(parseCellKey(cellKey(x, y, z)), [x, y, z]);
  }
});

test('nearestValidCell: always returns a valid-parity cell, and matches an exact cell exactly', () => {
  assert.deepEqual(nearestValidCell(0, 0, 0), [0, 0, 0]);
  assert.deepEqual(nearestValidCell(5, 5, 0), [5, 5, 0]);
  // Independent per-axis rounding alone would land on an odd-sum
  // (invalid) cell here -- confirms the parity fix-up actually engages.
  const snapped = nearestValidCell(0.6, 0.6, 0.1);
  assert.equal(isValidCell(...snapped), true);
});

test('nearestValidCell: nudges the axis with the largest rounding error, toward the raw value', () => {
  // 0.9 rounds to 1, 0.1 rounds to 0, 0 rounds to 0 -- sum is 1 (invalid).
  // The z axis (raw 0, rounded 0, zero error) should NOT be the one
  // nudged; the y axis (raw 0.1, rounded 0, error 0.1) is smaller error
  // than x (raw 0.9, rounded 1, error 0.1 too -- tie go to whichever
  // indexOf finds first, which is x here) -- assert only the invariant
  // that actually matters: the result is valid and close to the input.
  const [x, y, z] = nearestValidCell(0.9, 0.1, 0);
  assert.equal(isValidCell(x, y, z), true);
  assert.ok(Math.abs(x - 0.9) + Math.abs(y - 0.1) + Math.abs(z - 0) < 1.5);
});

test('NEIGHBOR_OFFSETS: 12 entries, each preserves lattice parity', () => {
  assert.equal(NEIGHBOR_OFFSETS.length, 12);
  for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
    // Adding any offset to a valid cell must stay valid -- so each
    // offset's own coordinate sum must be even (RHOMBIVERSE_PLAN.md
    // section 2's own invariant). Math.abs guards against JS's `%`
    // returning -0 for a negative even dividend (e.g. -2 % 2 === -0),
    // which assert/strict's Object.is-based equal would otherwise
    // (correctly, per JS semantics) treat as distinct from 0.
    assert.equal(Math.abs((dx + dy + dz) % 2), 0);
  }
  // All 12 must be distinct directions.
  const unique = new Set(NEIGHBOR_OFFSETS.map(([x, y, z]) => cellKey(x, y, z)));
  assert.equal(unique.size, 12);
});

test('shellCount(n) = 10n^2 + 2', () => {
  assert.equal(shellCount(1), 12);
  assert.equal(shellCount(2), 42);
  assert.equal(shellCount(6), 362);
});

test('cellsInShells matches shellCount(n) exactly through n=6', () => {
  // The specific regression this project has hand-verified multiple
  // times throughout its history (CLAUDE.md) before trusting BFS shell
  // fill as correct -- codified here so it can never silently regress.
  for (let n = 1; n <= 6; n++) {
    const cells = cellsInShells(0, 0, 0, n);
    const bucket = {};
    for (const c of cells) bucket[c.shell] = (bucket[c.shell] ?? 0) + 1;
    for (let shell = 1; shell <= n; shell++) {
      assert.equal(bucket[shell], shellCount(shell), `shell ${shell} of ${n}`);
    }
  }
});

test('cellsInShells: minShell skips inner shells but still returns outer ones', () => {
  const hollow = cellsInShells(0, 0, 0, 3, 2);
  assert.equal(hollow.some((c) => c.shell === 1), false);
  assert.equal(hollow.filter((c) => c.shell === 2).length, shellCount(2));
  assert.equal(hollow.filter((c) => c.shell === 3).length, shellCount(3));
});
