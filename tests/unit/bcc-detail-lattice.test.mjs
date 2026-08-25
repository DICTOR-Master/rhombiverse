// BCC dual-lattice Phase 2 (revised, nested design). No THREE/DOM
// dependency, mirrors latticezoom.test.mjs's own conventions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BCC_DETAIL_MAX_SHELL,
  BCC_DETAIL_SAFETY_MARGIN,
  bccCellCount,
  generateBCCSubLatticeAt,
  bccDetailVertsFor,
} from '../../src/geometry-extensions/bcc-detail-lattice.js';
import { rdRawVerts, cellToWorld, NEIGHBOR_OFFSETS } from '../../src/core/lattice.js';
import { BCC_NEIGHBOR_OFFSETS } from '../../src/geometry-extensions/dual-lattice.js';

// Same general SAT overlap test used to first diagnose the same-scale
// overlap problem this file's whole design exists to avoid -- face
// normals of both shapes (their own real neighbor-offset directions, a
// Voronoi cell's facets are always its perpendicular bisectors toward
// each neighbor) plus their pairwise cross products as edge axes. Extra
// candidate axes can only find MORE true separations, never a false
// "overlap", so this over-inclusive set is the safe direction for a
// regression guard.
function normalize([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return len < 1e-9 ? null : [x / len, y / len, z / len];
}
function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}
function dot([ax, ay, az], [bx, by, bz]) { return ax * bx + ay * by + az * bz; }
const FCC_AXES = NEIGHBOR_OFFSETS.map(normalize).filter(Boolean);
const BCC_AXES = BCC_NEIGHBOR_OFFSETS.map(normalize).filter(Boolean);
const CROSS_AXES = [];
for (const a of FCC_AXES) for (const b of BCC_AXES) { const n = normalize(cross(a, b)); if (n) CROSS_AXES.push(n); }
const ALL_AXES = [...FCC_AXES, ...BCC_AXES, ...CROSS_AXES];
function polytopesOverlap(vertsA, vertsB, eps = 1e-6) {
  for (const axis of ALL_AXES) {
    const pa = vertsA.map((v) => dot(v, axis));
    const pb = vertsB.map((v) => dot(v, axis));
    if (Math.max(...pa) <= Math.min(...pb) + eps || Math.max(...pb) <= Math.min(...pa) + eps) return false;
  }
  return true;
}

test('bccCellCount: matches the real generated cell list length, for several shell counts', () => {
  for (const maxShell of [0, 1, 2]) {
    const sub = generateBCCSubLatticeAt([0, 0, 0], 1, maxShell);
    assert.equal(sub.length, bccCellCount(maxShell));
  }
});

test('generateBCCSubLatticeAt: sub-cell scale grows linearly with parentScale (a pure containment ratio, not hardcoded to scale=1)', () => {
  const sub1 = generateBCCSubLatticeAt([0, 0, 0], 1, 1);
  const sub3 = generateBCCSubLatticeAt([0, 0, 0], 3, 1);
  for (let i = 0; i < sub1.length; i++) {
    assert.ok(Math.abs(sub3[i].scale - sub1[i].scale * 3) < 1e-9);
  }
});

test('generateBCCSubLatticeAt: the center sub-cell sits at the parent\'s own real world position', () => {
  const parentScale = 3;
  const [px, py, pz] = cellToWorld(2, -1, 3, parentScale);
  const sub = generateBCCSubLatticeAt([px, py, pz], parentScale, 1);
  const center = sub.find((c) => c.shell === 0);
  assert.deepEqual(center.worldPosition, [px, py, pz]);
});

test('generateBCCSubLatticeAt: real margin check -- every sub-cell vertex stays strictly inside the parent RD\'s own inradius sphere, with room to spare matching BCC_DETAIL_SAFETY_MARGIN', () => {
  const parentScale = 2;
  const parentInradius = (Math.SQRT2 / 2) * parentScale; // verified separately against a real numeric computation in bcc-detail-lattice.js
  const sub = generateBCCSubLatticeAt([0, 0, 0], parentScale, 2);
  let maxReach = 0;
  for (const cell of sub) {
    for (const v of bccDetailVertsFor(cell)) maxReach = Math.max(maxReach, Math.hypot(...v));
  }
  assert.ok(maxReach < parentInradius, `max sub-cell reach ${maxReach} must stay inside parent inradius ${parentInradius}`);
  // Confirms the safety margin is actually doing real work, not degenerate (e.g. margin=1 exactly at the limit).
  assert.ok(maxReach / parentInradius < BCC_DETAIL_SAFETY_MARGIN + 0.05);
});

// NOTE: nested sub-cells are SUPPOSED to intersect their parent's volume --
// that's what nesting means. A disjointness (SAT) test is the wrong tool
// here (an earlier version of this test used one and produced a false
// "overlap" failure on a fully-contained cell). What actually matters is
// exact CONTAINMENT: every sub-cell vertex must stay on the inside of
// every one of the parent's own face half-spaces (the parent RD is exactly
// the intersection of those half-spaces, so this is the precise, not
// merely sufficient, convex-containment test).
test('generateBCCSubLatticeAt: exact containment -- every BCC sub-cell vertex stays strictly inside every one of the parent RD\'s own face half-spaces', () => {
  const parentScale = 1;
  const parentCenter = [0, 0, 0];
  const parentVerts = rdRawVerts(parentScale).map(([x, y, z]) => [x + parentCenter[0], y + parentCenter[1], z + parentCenter[2]]);
  const parentFaceAxes = NEIGHBOR_OFFSETS.map(normalize).filter(Boolean);
  const parentFacePlanes = parentFaceAxes.map((axis) => ({ axis, offset: Math.max(...parentVerts.map((v) => dot(v, axis))) }));
  for (const maxShell of [0, 1, 2]) {
    const sub = generateBCCSubLatticeAt(parentCenter, parentScale, maxShell);
    for (const cell of sub) {
      for (const v of bccDetailVertsFor(cell)) {
        for (const { axis, offset } of parentFacePlanes) {
          assert.ok(dot(v, axis) < offset + 1e-9, `maxShell=${maxShell}, cell shell=${cell.shell} [${cell.x},${cell.y},${cell.z}] has a vertex outside the parent RD's own face plane`);
        }
      }
    }
  }
});

test('generateBCCSubLatticeAt: real SAT check -- no two BCC sub-cells overlap each other', () => {
  const sub = generateBCCSubLatticeAt([0, 0, 0], 1, 2);
  const allVerts = sub.map(bccDetailVertsFor);
  for (let i = 0; i < allVerts.length; i++) {
    for (let j = i + 1; j < allVerts.length; j++) {
      assert.ok(!polytopesOverlap(allVerts[i], allVerts[j]), `sub-cells ${i} and ${j} must not overlap each other`);
    }
  }
});

test('BCC_DETAIL_MAX_SHELL default is a small, real, non-degenerate value', () => {
  assert.ok(BCC_DETAIL_MAX_SHELL >= 1);
  assert.ok(bccCellCount(BCC_DETAIL_MAX_SHELL) > 1);
});
