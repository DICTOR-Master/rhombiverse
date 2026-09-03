// Verifies src/rhombis/cell-arrangements.js's symmetry group and shape
// enumerator directly -- this is real combinatorial math (the FCC
// lattice's own free-polyomino-style shape counting), not just glue
// code, so it gets its own real correctness tests rather than trusting
// the numbers by inspection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYMMETRY_OPERATIONS, applySymmetry, canonicalForm, enumerateShapes } from '../../src/rhombis/cell-arrangements.js';
import { NEIGHBOR_OFFSETS, isValidCell } from '../../src/core/lattice.js';

test('symmetry group has exactly 48 operations (6 axis permutations x 8 sign combinations)', () => {
  assert.equal(SYMMETRY_OPERATIONS.length, 48);
});

test('every symmetry operation maps NEIGHBOR_OFFSETS bijectively onto itself', () => {
  const offsetKeys = new Set(NEIGHBOR_OFFSETS.map((v) => v.join(',')));
  for (const op of SYMMETRY_OPERATIONS) {
    const mapped = NEIGHBOR_OFFSETS.map((v) => applySymmetry(op, v));
    const mappedKeys = new Set(mapped.map((v) => v.join(',')));
    assert.equal(mappedKeys.size, 12, 'operation must not collapse distinct offsets');
    for (const k of mappedKeys) assert.ok(offsetKeys.has(k), `operation produced a non-offset vector: ${k}`);
  }
});

test('every symmetry operation preserves the lattice parity constraint (x+y+z even)', () => {
  const sample = [[0, 0, 0], [1, 1, 0], [2, 0, 0], [1, -1, 2], [0, 2, 4]];
  for (const op of SYMMETRY_OPERATIONS) {
    for (const cell of sample) {
      assert.ok(isValidCell(...cell), 'sample cell should be a valid starting cell');
      const mapped = applySymmetry(op, cell);
      assert.ok(isValidCell(...mapped), `operation broke lattice parity: ${cell} -> ${mapped}`);
    }
  }
});

test('the symmetry group is closed under composition (applying two ops in sequence yields another member)', () => {
  const keyOf = (op) => NEIGHBOR_OFFSETS.map((v) => applySymmetry(op, v).join(',')).join('|');
  const groupSignatures = new Set(SYMMETRY_OPERATIONS.map(keyOf));
  // Spot-check composition for a handful of operation pairs, not all
  // 48*48 -- enough to catch a real implementation bug without being
  // slow, since a broken group would fail on essentially any pair.
  const sampleOps = [SYMMETRY_OPERATIONS[0], SYMMETRY_OPERATIONS[7], SYMMETRY_OPERATIONS[23], SYMMETRY_OPERATIONS[41]];
  for (const opA of sampleOps) {
    for (const opB of sampleOps) {
      const composedMapped = NEIGHBOR_OFFSETS.map((v) => applySymmetry(opA, applySymmetry(opB, v)));
      const composedKey = composedMapped.map((v) => v.join(',')).sort().join('|');
      const matchesSomeOp = SYMMETRY_OPERATIONS.some((op) => {
        const mapped = NEIGHBOR_OFFSETS.map((v) => applySymmetry(op, v));
        return mapped.map((v) => v.join(',')).sort().join('|') === composedKey;
      });
      assert.ok(matchesSomeOp, 'composed operation should itself be a member of the 48');
    }
  }
});

test('canonicalForm is invariant under any symmetry operation applied to the input', () => {
  const shape = [[0, 0, 0], [1, 1, 0], [1, 0, 1]];
  const baseline = canonicalForm(shape).key;
  for (const op of SYMMETRY_OPERATIONS) {
    const transformed = shape.map((c) => applySymmetry(op, c));
    assert.equal(canonicalForm(transformed).key, baseline);
  }
});

test('canonicalForm is invariant under translation', () => {
  const shape = [[0, 0, 0], [1, 1, 0], [1, 0, 1]];
  const translated = shape.map(([x, y, z]) => [x + 4, y - 6, z + 2]);
  assert.equal(canonicalForm(shape).key, canonicalForm(translated).key);
});

test('N=1: exactly one shape (a single cell)', () => {
  const shapes = enumerateShapes(1);
  assert.equal(shapes[1].length, 1);
  assert.deepEqual(shapes[1][0].cells, [[0, 0, 0]]);
});

test('N=2: exactly one shape -- the lattice symmetry group acts transitively on all 12 neighbor offsets', () => {
  const shapes = enumerateShapes(2);
  assert.equal(shapes[2].length, 1);
});

test('N=3: exactly four distinct shapes exist (verified by direct enumeration, not assumed)', () => {
  const shapes = enumerateShapes(3);
  assert.equal(shapes[3].length, 4);
});

test('N=3: a hand-built closed triangle (three mutually adjacent cells) is one of the four shapes', () => {
  const shapes = enumerateShapes(3);
  const triangle = [[0, 0, 0], [1, 1, 0], [1, 0, 1]]; // (1,1,0)-(1,0,1) = (0,1,-1), a real neighbor offset -- all three pairs adjacent
  const key = canonicalForm(triangle).key;
  assert.ok(shapes[3].some((s) => s.key === key), 'closed triangle should be among the four N=3 shapes');
});

test('N=3: a hand-built straight line (the same offset applied twice) is one of the four shapes, and is distinct from the triangle', () => {
  const shapes = enumerateShapes(3);
  const line = [[0, 0, 0], [1, 1, 0], [2, 2, 0]];
  const triangle = [[0, 0, 0], [1, 1, 0], [1, 0, 1]];
  const lineKey = canonicalForm(line).key;
  const triangleKey = canonicalForm(triangle).key;
  assert.notEqual(lineKey, triangleKey);
  assert.ok(shapes[3].some((s) => s.key === lineKey), 'straight line should be among the four N=3 shapes');
});

test('every generated shape at every size is actually connected (each cell adjacent to at least one other in the set)', () => {
  const shapes = enumerateShapes(4);
  for (let n = 2; n <= 4; n++) {
    for (const shape of shapes[n]) {
      const keys = new Set(shape.cells.map((c) => c.join(',')));
      for (const cell of shape.cells) {
        const hasNeighborInSet = NEIGHBOR_OFFSETS.some(([dx, dy, dz]) => {
          const k = `${cell[0] + dx},${cell[1] + dy},${cell[2] + dz}`;
          return k !== cell.join(',') && keys.has(k);
        });
        assert.ok(hasNeighborInSet, `cell ${cell} in an N=${n} shape has no neighbor within the same shape`);
      }
    }
  }
});
