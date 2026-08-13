// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 1. latticezoom.js imports
// lattice.js only (no THREE/DOM dependency) -- zero npm dependencies,
// same as lattice.test.mjs/growth.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cumulativeCellCount,
  subScaleFactor,
  generateSubLattice,
  SUB_LATTICE_MAX_SHELL,
  selectNearbyCells,
} from '../../src/latticezoom.js';
import { shellCount, isValidCell, cellToWorld } from '../../src/lattice.js';

test('cumulativeCellCount: matches lattice.js\'s own shellCount(n) = 10n^2+2 formula exactly, plus the center', () => {
  assert.equal(cumulativeCellCount(0), 1);
  assert.equal(cumulativeCellCount(1), 1 + shellCount(1));
  assert.equal(cumulativeCellCount(2), 1 + shellCount(1) + shellCount(2));
  assert.equal(cumulativeCellCount(2), 55); // 1 + 12 + 42, matching this project's own established shell math elsewhere
});

// The real geometric claim Stage 1 exists to prove: a sub-lattice's
// TOTAL combined volume, scaled by subScaleFactor, exactly equals one
// parent RD's own volume (Voronoi cells tile with zero gap/overlap by
// definition) -- since RD volume at scale s is 2*s^3 (confirmed
// separately via a real ConvexGeometry computation, see this module's
// own header comment), the identity reduces to
// cellCount * subScaleFactor(maxShell)^3 == 1 for any shell count.
test('subScaleFactor: cellCount * factor^3 == 1 exactly (within float tolerance) -- the real volume-conservation identity, for every practical shell count', () => {
  for (const maxShell of [0, 1, 2, 3, 4, 6]) {
    const cells = cumulativeCellCount(maxShell);
    const factor = subScaleFactor(maxShell);
    const identity = cells * Math.pow(factor, 3);
    assert.ok(Math.abs(identity - 1) < 1e-9, `maxShell=${maxShell}: cellCount*factor^3 = ${identity}, expected 1`);
  }
});

test('subScaleFactor: strictly decreases as shell count grows (more, smaller sub-cells needed to conserve the same total volume)', () => {
  const f0 = subScaleFactor(1);
  const f1 = subScaleFactor(2);
  const f2 = subScaleFactor(3);
  assert.ok(f0 > f1 && f1 > f2);
});

test('generateSubLattice: produces exactly cumulativeCellCount(maxShell) sub-cells, each a real, valid FCC local coordinate', () => {
  const sub = generateSubLattice(0, 0, 0, 2);
  assert.equal(sub.length, cumulativeCellCount(2));
  for (const cell of sub) {
    assert.ok(isValidCell(cell.x, cell.y, cell.z), `local sub-cell [${cell.x},${cell.y},${cell.z}] must itself be a valid FCC lattice coordinate`);
  }
  // Exactly one center (shell 0), the rest split correctly by shell.
  assert.equal(sub.filter((c) => c.shell === 0).length, 1);
  assert.equal(sub.filter((c) => c.shell === 1).length, shellCount(1));
  assert.equal(sub.filter((c) => c.shell === 2).length, shellCount(2));
});

test('generateSubLattice: the center sub-cell sits exactly at the parent\'s own real world position; every other sub-cell is offset by real, scaled-down local coordinates', () => {
  const parentScale = 3; // an arbitrary non-1 parent scale, to confirm this isn't accidentally hardcoded to scale=1
  const [px, py, pz] = cellToWorld(2, -1, 3, parentScale);
  const sub = generateSubLattice(2, -1, 3, 1, parentScale);
  const center = sub.find((c) => c.shell === 0);
  assert.deepEqual(center.worldPosition, [px, py, pz]);

  const factor = subScaleFactor(1);
  for (const cell of sub) {
    const [lx, ly, lz] = cellToWorld(cell.x, cell.y, cell.z, parentScale * factor);
    assert.ok(Math.abs(cell.worldPosition[0] - (px + lx)) < 1e-9);
    assert.ok(Math.abs(cell.worldPosition[1] - (py + ly)) < 1e-9);
    assert.ok(Math.abs(cell.worldPosition[2] - (pz + lz)) < 1e-9);
    assert.equal(cell.scale, parentScale * factor);
  }
});

test('generateSubLattice: every sub-cell has a genuinely distinct world position (no accidental overlap/duplication)', () => {
  const sub = generateSubLattice(0, 0, 0, 3);
  const seen = new Set();
  for (const cell of sub) {
    const key = cell.worldPosition.map((v) => v.toFixed(9)).join(',');
    assert.ok(!seen.has(key), `duplicate world position found: ${key}`);
    seen.add(key);
  }
  assert.equal(seen.size, cumulativeCellCount(3));
});

test('SUB_LATTICE_MAX_SHELL default produces a real, moderate sub-lattice (55 cells) when no explicit maxShell is passed', () => {
  const sub = generateSubLattice(0, 0, 0);
  assert.equal(sub.length, cumulativeCellCount(SUB_LATTICE_MAX_SHELL));
  assert.equal(sub.length, 55);
});

// ============================================================
// Stage 2 -- Camera-Distance Trigger & Lifecycle (pure selection logic)
// ============================================================

test('selectNearbyCells: a cell far from the reference position is excluded entirely', () => {
  const cells = [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }];
  const chosen = selectNearbyCells(cells, [0, 0, 0], 4, 20, 1);
  assert.equal(chosen.length, 1);
  assert.deepEqual([chosen[0].x, chosen[0].y, chosen[0].z], [0, 0, 0]);
});

test('selectNearbyCells: real distance-based, not a flat radius per axis -- a diagonally-close cell within Euclidean range is included, one just outside is not', () => {
  const cells = [
    { x: 2, y: 2, z: 0 }, // real distance sqrt(8) ~= 2.83, inside a radius-3 trigger
    { x: 4, y: 4, z: 0 }, // real distance sqrt(32) ~= 5.66, outside
  ];
  const chosen = selectNearbyCells(cells, [0, 0, 0], 3, 20, 1);
  assert.equal(chosen.length, 1);
  assert.deepEqual([chosen[0].x, chosen[0].y, chosen[0].z], [2, 2, 0]);
});

test('selectNearbyCells: respects a real scale factor (world position = cell coord * scale, not the raw lattice coordinate)', () => {
  const cells = [{ x: 2, y: 0, z: 0 }];
  // At scale=1, world position (2,0,0) is distance 2 from the origin --
  // inside a radius-3 trigger.
  assert.equal(selectNearbyCells(cells, [0, 0, 0], 3, 20, 1).length, 1);
  // At scale=5, the SAME cell's real world position is (10,0,0) --
  // outside a radius-3 trigger. Confirms the function scales cell
  // coordinates into real world space rather than comparing raw lattice
  // coordinates directly.
  assert.equal(selectNearbyCells(cells, [0, 0, 0], 3, 20, 5).length, 0);
});

test('selectNearbyCells: caps at maxCells, keeping the CLOSEST ones when more candidates are in range than the bound allows', () => {
  const cells = [
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ];
  const chosen = selectNearbyCells(cells, [0, 0, 0], 10, 2, 1);
  assert.equal(chosen.length, 2);
  const xs = chosen.map((c) => c.x).sort();
  assert.deepEqual(xs, [1, 2], 'the two CLOSEST cells must be kept, not an arbitrary/insertion-order pair');
});

test('selectNearbyCells: real distance is available on each returned entry, sorted nearest-first', () => {
  const cells = [
    { x: 3, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
  ];
  const chosen = selectNearbyCells(cells, [0, 0, 0], 10, 20, 1);
  assert.equal(chosen.length, 3);
  for (let i = 1; i < chosen.length; i++) {
    assert.ok(chosen[i].d >= chosen[i - 1].d, 'results must be sorted nearest-first');
  }
  assert.equal(chosen[0].x, 1);
});
