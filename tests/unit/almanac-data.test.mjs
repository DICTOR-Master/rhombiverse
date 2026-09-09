// Coverage guarantee for Almanac Stage 0 (docs/RHOMBIVERSE_SPEC_ALMANAC.md
// section 5): every real placeable piece in WHEEL_PIECE/WHEEL_RD_FAMILY
// must show up in Almanac's data exactly once, with no silent gaps and
// no accidental duplicates (e.g. WHEEL_PIECE's own "RD" face is a
// navigation doorway into WHEEL_RD_FAMILY's real RD entry, not a second
// piece -- this file is the real check that distinction actually holds,
// not just an assumption baked into almanac-data.js's own comments).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHEEL_PIECE, WHEEL_RD_FAMILY } from '../../src/app/rhombic-wheel-3d-core.js';
import {
  PIECE_ENTRIES,
  ALMANAC_ENTRIES,
  isRealPieceAction,
} from '../../src/app/almanac-data.js';

function realActionsIn(wheelConfig) {
  return Object.values(wheelConfig.faces)
    .map((face) => face.action)
    .filter(isRealPieceAction);
}

test('every real piece action in WHEEL_PIECE/WHEEL_RD_FAMILY appears in Almanac exactly once', () => {
  const expectedActions = [...realActionsIn(WHEEL_PIECE), ...realActionsIn(WHEEL_RD_FAMILY)];
  const actualIds = PIECE_ENTRIES.map((e) => e.id);

  for (const action of expectedActions) {
    assert.ok(actualIds.includes(action), `Almanac is missing an entry for real piece action "${action}"`);
  }
  const seen = new Set();
  for (const id of actualIds) {
    assert.ok(!seen.has(id), `Almanac has a duplicate entry for "${id}"`);
    seen.add(id);
  }
  // No extras either: PIECE_ENTRIES should be exactly this set, not a superset.
  assert.equal(actualIds.length, expectedActions.length);
});

test('every Almanac entry has a real label and description', () => {
  for (const entry of ALMANAC_ENTRIES) {
    assert.ok(entry.id, `entry missing id: ${JSON.stringify(entry)}`);
    assert.ok(entry.label && entry.label.trim().length > 0, `entry "${entry.id}" missing a label`);
    assert.ok(entry.desc && entry.desc.trim().length > 0, `entry "${entry.id}" missing a description`);
  }
});

test('every Almanac entry id is globally unique across pieces/concepts/history', () => {
  const ids = ALMANAC_ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id found across ALMANAC_ENTRIES');
});

test("WHEEL_PIECE's own RD doorway is excluded -- not a second RD piece entry", () => {
  const rdEntries = PIECE_ENTRIES.filter((e) => e.label === 'RD');
  assert.equal(rdEntries.length, 1, "expected exactly one RD piece entry (from WHEEL_RD_FAMILY, not WHEEL_PIECE's doorway)");
  assert.equal(rdEntries[0].id, 'tool:pieceType:rd');
});
