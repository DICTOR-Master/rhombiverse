// Wizard parity (2026-09-24): every real placeable 3D piece on the wheels
// is listed under exactly one lattice in the wizard -- the wizard's own
// counterpart of
// almanac-data.test.mjs's coverage guarantee.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHEEL_PIECE, WHEEL_RD_FAMILY } from '../../src/app/rhombic-wheel-3d-core.js';
import { LATTICES_3D } from '../../src/app/dimension-wizard.js';

const wizardActions = LATTICES_3D.flatMap((lat) => lat.pieces.map((p) => p.action));

test('every wheel piece appears in the wizard exactly once', () => {
  const wheelActions = [...Object.values(WHEEL_PIECE.faces), ...Object.values(WHEEL_RD_FAMILY.faces)]
    .map((f) => f.action)
    .filter((a) => a && (a.startsWith('tool:pieceType:') || a === 'tool:cuboctaBuild' ));
  for (const a of new Set(wheelActions)) {
    assert.equal(wizardActions.filter((w) => w === a).length, 1, `${a} listed once`);
  }
  assert.equal(new Set(wizardActions).size, wizardActions.length, 'no duplicates');
  // Shells and Golden Rhombohedra are Wizard-only (the wheels have no free face).
  for (const a of wizardActions.filter((w) => w !== 'tool:shellsWorld' && w !== 'tool:goldenWorld')) assert.ok(wheelActions.includes(a), `${a} is a real wheel action`);
});
