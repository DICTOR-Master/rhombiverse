// BCC dual-lattice Phase 2 (third revision, 2026-08-25): one real,
// connected, globally-consistent BCC lattice sharing the FCC world's own
// coordinate frame -- see bcc-detail-lattice.js's own header for the full
// history of why this replaced two earlier designs. No THREE/DOM
// dependency, mirrors latticezoom.test.mjs's own conventions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BCC_LATTICE_MAX_SHELL,
  bccShapeScaleFor,
  generateBCCLatticePatch,
  bccDetailVertsFor,
} from '../../src/geometry-extensions/bcc-detail-lattice.js';
import { cellToWorld, cellsInShells } from '../../src/core/lattice.js';
import { isBCC, BCC_NEIGHBOR_OFFSETS, nearestBCCCell } from '../../src/geometry-extensions/dual-lattice.js';

function normalize([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return len < 1e-9 ? null : [x / len, y / len, z / len];
}
function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}
function dot([ax, ay, az], [bx, by, bz]) { return ax * bx + ay * by + az * bz; }
const BCC_AXES = BCC_NEIGHBOR_OFFSETS.map(normalize).filter(Boolean);
const CROSS_AXES = [];
for (const a of BCC_AXES) for (const b of BCC_AXES) { const n = normalize(cross(a, b)); if (n) CROSS_AXES.push(n); }
const ALL_AXES = [...BCC_AXES, ...CROSS_AXES];
// Same general SAT overlap test used throughout this feature's own history
// -- real face-normal axes (a Voronoi cell's facets are always its
// perpendicular bisectors toward each neighbor) plus their pairwise cross
// products. Extra candidate axes can only find MORE true separations,
// never a false "overlap", so this over-inclusive set is the safe
// direction for a regression guard.
function polytopesOverlap(vertsA, vertsB, eps = 1e-6) {
  for (const axis of ALL_AXES) {
    const pa = vertsA.map((v) => dot(v, axis));
    const pb = vertsB.map((v) => dot(v, axis));
    if (Math.max(...pa) <= Math.min(...pb) + eps || Math.max(...pb) <= Math.min(...pa) + eps) return false;
  }
  return true;
}

test('nearestBCCCell: always returns a genuinely valid BCC coordinate', () => {
  const samples = [[0, 0, 0], [0.4, 0.4, 0.4], [3.7, -2.1, 5.9], [-1.5, -1.5, -1.5], [10.2, 0.1, -4.9]];
  for (const [x, y, z] of samples) {
    const [cx, cy, cz] = nearestBCCCell(x, y, z);
    assert.ok(isBCC(cx, cy, cz), `[${cx},${cy},${cz}] from input [${x},${y},${z}] must be BCC-valid`);
  }
});

test('nearestBCCCell: really is nearest -- matches a brute-force search over a small window', () => {
  const samples = [[0.4, 0.4, 0.4], [2.6, -1.1, 0.9], [-3.3, 2.2, 1.1]];
  for (const [x, y, z] of samples) {
    const got = nearestBCCCell(x, y, z);
    let best = null, bestD = Infinity;
    for (let ix = Math.floor(x) - 3; ix <= Math.floor(x) + 3; ix++) {
      for (let iy = Math.floor(y) - 3; iy <= Math.floor(y) + 3; iy++) {
        for (let iz = Math.floor(z) - 3; iz <= Math.floor(z) + 3; iz++) {
          if (!isBCC(ix, iy, iz)) continue;
          const d = (ix - x) ** 2 + (iy - y) ** 2 + (iz - z) ** 2;
          if (d < bestD) { bestD = d; best = [ix, iy, iz]; }
        }
      }
    }
    assert.deepEqual(got, best, `nearestBCCCell(${x},${y},${z}) = ${got}, brute force says ${best}`);
  }
});

test('bccShapeScaleFor: half the lattice spacing (the real, verified self-tiling ratio)', () => {
  assert.equal(bccShapeScaleFor(1), 0.5);
  assert.equal(bccShapeScaleFor(4), 2);
});

test('generateBCCLatticePatch: produces exactly 1 + cellsInShells(...) cells, all real BCC-valid coordinates', () => {
  for (const maxShell of [0, 1, 2]) {
    const patch = generateBCCLatticePatch([0, 0, 0], 1, maxShell);
    const [cx, cy, cz] = nearestBCCCell(0, 0, 0);
    const expectedCount = 1 + cellsInShells(cx, cy, cz, maxShell, 1, BCC_NEIGHBOR_OFFSETS).length;
    assert.equal(patch.length, expectedCount);
    for (const cell of patch) assert.ok(isBCC(cell.x, cell.y, cell.z));
  }
});

test('generateBCCLatticePatch: every cell\'s world position is exactly cellToWorld(x,y,z,subScale) -- a pure function of its own coordinate, not of the seed position', () => {
  const subScale = 2;
  const patch = generateBCCLatticePatch([5, 5, 5], subScale, 2);
  for (const cell of patch) {
    assert.deepEqual(cell.worldPosition, cellToWorld(cell.x, cell.y, cell.z, subScale));
  }
});

// The whole point of this redesign: two patches seeded from DIFFERENT
// nearby positions must agree exactly on any coordinate they both cover --
// real global consistency, not two independent, incompatible local
// clusters. This is what makes adjacent FCC cells' BCC content connect
// instead of reading as disconnected islands.
test('generateBCCLatticePatch: two patches seeded from different nearby positions agree exactly on shared coordinates', () => {
  const patchA = generateBCCLatticePatch([0, 0, 0], 1, 3);
  const patchB = generateBCCLatticePatch([3, 3, 3], 1, 3);
  const byKeyA = new Map(patchA.map((c) => [`${c.x},${c.y},${c.z}`, c]));
  const byKeyB = new Map(patchB.map((c) => [`${c.x},${c.y},${c.z}`, c]));
  let sharedCount = 0;
  for (const [key, cellA] of byKeyA) {
    const cellB = byKeyB.get(key);
    if (!cellB) continue;
    sharedCount++;
    assert.deepEqual(cellA.worldPosition, cellB.worldPosition, `shared cell ${key} must have identical world position from both seeds`);
    assert.equal(cellA.scale, cellB.scale);
  }
  assert.ok(sharedCount > 0, 'expected at least some real overlap between two nearby patches to actually verify consistency');
});

test('generateBCCLatticePatch: real SAT check -- no two cells in the same patch overlap each other (real self-tiling, not just non-degenerate)', () => {
  const patch = generateBCCLatticePatch([0, 0, 0], 1, 2);
  const allVerts = patch.map(bccDetailVertsFor);
  for (let i = 0; i < allVerts.length; i++) {
    for (let j = i + 1; j < allVerts.length; j++) {
      assert.ok(!polytopesOverlap(allVerts[i], allVerts[j]), `cells ${i} and ${j} must not overlap each other`);
    }
  }
});

test('BCC_LATTICE_MAX_SHELL default is a real, non-degenerate value', () => {
  assert.ok(BCC_LATTICE_MAX_SHELL >= 1);
});
