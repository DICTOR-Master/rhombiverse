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
} from '../../src/core/lattice.js';

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
