// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 1. latticezoom.js imports
// lattice.js only (no THREE/DOM dependency) -- zero npm dependencies,
// same as lattice.test.mjs/growth.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cumulativeCellCount,
  subScaleFactor,
  generateSubLattice,
  generateSubLatticeAt,
  SUB_LATTICE_MAX_SHELL,
  selectNearbyCells,
  selectNearbyByWorldPosition,
  MAX_LOD_DEPTH,
  levelTriggerDistance,
  blendFactor,
  SUB_LATTICE_SWING_FRACTION_THRESHOLD,
  SUB_LATTICE_VOLATILITY_DECAY_FACTOR,
  SUB_LATTICE_THROTTLE_BASE_MS,
  SUB_LATTICE_THROTTLE_MAX_MS,
  swingMagnitude,
  nextVolatilityScore,
  throttleForVolatility,
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

// ============================================================
// Stage 3 -- Multi-Level Depth & Blending
// ============================================================

test('generateSubLatticeAt: the general core produces IDENTICAL output to generateSubLattice for the same parent, proving the wrapper is a true delegation, not a re-derivation', () => {
  const viaWrapper = generateSubLattice(2, -1, 3, 2, 1.5);
  const viaCore = generateSubLatticeAt([2 * 1.5, -1 * 1.5, 3 * 1.5], 1.5, 2);
  assert.deepEqual(viaWrapper, viaCore);
});

test('generateSubLatticeAt: real recursion -- a level-1 sub-cell\'s own worldPosition/scale fed back in produces a genuinely nested level-2 sub-lattice, positioned relative to the level-1 cell (not the original top-level parent)', () => {
  const level1 = generateSubLattice(0, 0, 0, 1, 1);
  const aLevel1Cell = level1.find((c) => c.shell === 1);
  const level2 = generateSubLatticeAt(aLevel1Cell.worldPosition, aLevel1Cell.scale, 1);
  // The level-2 center must sit exactly at the level-1 cell's own real
  // position -- not the top-level parent's.
  const level2Center = level2.find((c) => c.shell === 0);
  assert.deepEqual(level2Center.worldPosition, aLevel1Cell.worldPosition);
  // And level-2 cells are meaningfully SMALLER/closer together than
  // level-1 ones -- real nested detail, not a same-scale duplicate.
  assert.ok(aLevel1Cell.scale > 0);
  assert.ok(level2[1].scale < aLevel1Cell.scale);
});

test('selectNearbyByWorldPosition: same real distance-based selection as selectNearbyCells, generalized to pre-positioned items (the recursive level-2 case)', () => {
  const items = [
    { id: 'near', worldPosition: [1, 0, 0] },
    { id: 'far', worldPosition: [10, 0, 0] },
  ];
  const chosen = selectNearbyByWorldPosition(items, [0, 0, 0], 3, 20);
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].id, 'near');
});

test('levelTriggerDistance: depth 1 returns exactly the base distance; deeper levels shrink proportionally to how the geometry itself shrinks (self-similar reveal ratio at every depth)', () => {
  const base = 4;
  assert.equal(levelTriggerDistance(base, 1), base);
  const factor = subScaleFactor(SUB_LATTICE_MAX_SHELL);
  assert.ok(Math.abs(levelTriggerDistance(base, 2) - base * factor) < 1e-9);
  assert.ok(levelTriggerDistance(base, 2) < levelTriggerDistance(base, 1), 'deeper levels must have a strictly smaller trigger radius');
});

test('MAX_LOD_DEPTH is a real, fixed, positive bound', () => {
  assert.equal(typeof MAX_LOD_DEPTH, 'number');
  assert.ok(MAX_LOD_DEPTH >= 1);
});

test('blendFactor: 1.0 at or inside the inner trigger, 0.0 at or beyond the outer edge, real linear ramp in between (not a hard pop)', () => {
  assert.equal(blendFactor(0, 4, 1), 1);
  assert.equal(blendFactor(4, 4, 1), 1);
  assert.equal(blendFactor(5, 4, 1), 0);
  assert.equal(blendFactor(10, 4, 1), 0);
  const mid = blendFactor(4.5, 4, 1);
  assert.ok(mid > 0 && mid < 1, `expected a real intermediate value in the blend band, got ${mid}`);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, 'exact midpoint of the blend band must be exactly 0.5 (linear ramp)');
});

test('blendFactor: monotonically decreasing as distance increases through the blend band -- a real continuous ramp, not a step function', () => {
  const samples = [4, 4.2, 4.4, 4.6, 4.8, 5].map((d) => blendFactor(d, 4, 1));
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] <= samples[i - 1], `blendFactor must never increase as distance grows: ${samples}`);
  }
});

// ============================================================
// Stage 4 -- Adaptive Damping
// ============================================================

test('swingMagnitude: real ratio of movement to the base trigger distance, zero when there is no movement', () => {
  assert.equal(swingMagnitude(0, 4), 0);
  assert.equal(swingMagnitude(2, 4), 0.5);
  assert.equal(swingMagnitude(4, 4), 1);
  assert.equal(swingMagnitude(1, 0), 0, 'must not divide by zero if a caller ever passes a zero trigger distance');
});

test('nextVolatilityScore: a real rapid swing (>= SUB_LATTICE_SWING_FRACTION_THRESHOLD) ACCUMULATES onto the current score', () => {
  const bigMovement = 4; // movement == triggerDistance -> magnitude exactly 1.0
  const next = nextVolatilityScore(0.5, bigMovement, 4);
  assert.ok(Math.abs(next - (0.5 + 1.0)) < 1e-9, `expected accumulation to exactly current + magnitude, got ${next}`);
});

test('nextVolatilityScore: a calm tick (below threshold) DECAYS the current score by SUB_LATTICE_VOLATILITY_DECAY_FACTOR, never accumulates', () => {
  const tinyMovement = 0.01 * 4; // well under the 0.3 threshold fraction
  const next = nextVolatilityScore(2, tinyMovement, 4);
  assert.ok(Math.abs(next - 2 * SUB_LATTICE_VOLATILITY_DECAY_FACTOR) < 1e-9);
  assert.ok(next < 2, 'a calm tick must reduce the score, never grow it');
});

test('nextVolatilityScore: repeated rapid swings vs repeated calm ticks from the same starting score diverge -- real accumulation vs real settling, not noise', () => {
  let rapidScore = 0;
  let calmScore = 5; // start elevated, as if from a prior burst of scrubbing
  for (let i = 0; i < 5; i++) {
    rapidScore = nextVolatilityScore(rapidScore, 4, 4); // magnitude 1.0 every tick
    calmScore = nextVolatilityScore(calmScore, 0, 4); // zero movement every tick
  }
  assert.ok(rapidScore > 4, `sustained rapid scrubbing should accumulate a real elevated score, got ${rapidScore}`);
  assert.ok(calmScore < 5 * Math.pow(SUB_LATTICE_VOLATILITY_DECAY_FACTOR, 5) + 1e-9, `sustained calm movement should decay toward zero, got ${calmScore}`);
  assert.ok(rapidScore > calmScore, 'rapid scrubbing must end up with a strictly higher volatility score than sustained calm movement from a higher start');
});

test('throttleForVolatility: zero volatility returns exactly the base throttle (the Stage 2 tight default)', () => {
  assert.equal(throttleForVolatility(0), SUB_LATTICE_THROTTLE_BASE_MS);
});

test('throttleForVolatility: monotonically increasing with volatility, bounded at SUB_LATTICE_THROTTLE_MAX_MS -- adaptive, not infinite, per RHOMBIVERSE_PRINCIPLES.md section 2', () => {
  const low = throttleForVolatility(1);
  const high = throttleForVolatility(10);
  const extreme = throttleForVolatility(1000);
  assert.ok(low > SUB_LATTICE_THROTTLE_BASE_MS, 'any real volatility must widen the throttle above the base');
  assert.ok(high > low, 'more volatility must widen the throttle further');
  assert.equal(extreme, SUB_LATTICE_THROTTLE_MAX_MS, 'extreme volatility must be capped, never unbounded');
});

test('throttleForVolatility: a real scripted rapid-zoom scenario produces a measurably wider throttle than a calm-movement control -- Stage 4\'s own success check', () => {
  let rapidScore = 0;
  let calmScore = 0;
  for (let i = 0; i < 8; i++) {
    rapidScore = nextVolatilityScore(rapidScore, 6, 4); // large real movement every tick (a player scrubbing fast)
    calmScore = nextVolatilityScore(calmScore, 0.05, 4); // near-stationary camera
  }
  const rapidThrottle = throttleForVolatility(rapidScore);
  const calmThrottle = throttleForVolatility(calmScore);
  assert.equal(calmThrottle, SUB_LATTICE_THROTTLE_BASE_MS, 'a calm-movement control should stay at the tight default');
  assert.ok(rapidThrottle > calmThrottle, `rapid scrubbing must produce a measurably wider throttle interval than the calm control (rapid=${rapidThrottle}, calm=${calmThrottle})`);
});
