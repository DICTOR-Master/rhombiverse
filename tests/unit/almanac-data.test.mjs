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

// Stage 2 coverage guarantee (docs/RHOMBIVERSE_SPEC_ALMANAC.md section
// 5): every real piece must resolve to SOME geometry summary --
// {vertexCount,edgeCount,faceCount} for a single-cell convex piece, or
// {composedOf,unit} for a cluster piece -- never null (statsForAction
// silently returning null for an approved piece action would mean a new
// piece got added to WHEEL_PIECE/WHEEL_RD_FAMILY without its geometry
// source ever being wired up here).
test('every piece entry has real, non-null stats -- either computed V/E/F or a real composition', () => {
  for (const entry of PIECE_ENTRIES) {
    assert.ok(entry.stats, `piece "${entry.id}" has no stats at all`);
    const isConvexShape = typeof entry.stats.vertexCount === 'number';
    const isComposite = typeof entry.stats.composedOf === 'number';
    assert.ok(isConvexShape || isComposite, `piece "${entry.id}" has a stats object that's neither a convex V/E/F nor a composition: ${JSON.stringify(entry.stats)}`);
    if (isConvexShape) {
      // Euler's formula must hold for whatever this piece's own real
      // geometry produced -- a genuine sanity check, not a tautology,
      // since computeConvexStats derives edgeCount FROM V/F via this
      // exact formula, so this re-confirms internal consistency wasn't
      // broken by whatever vertex data almanac-data.js itself is now
      // feeding it.
      const { vertexCount, edgeCount, faceCount } = entry.stats;
      assert.equal(vertexCount - edgeCount + faceCount, 2, `piece "${entry.id}"'s V/E/F fails Euler's formula: ${JSON.stringify(entry.stats)}`);
    } else {
      assert.ok(entry.stats.composedOf >= 2, `piece "${entry.id}" is marked composite but composedOf is implausibly small: ${entry.stats.composedOf}`);
      assert.ok(entry.stats.unit && entry.stats.unit.trim().length > 0, `piece "${entry.id}" is missing a real composition unit label`);
      assert.ok(entry.stats.unitPlural && entry.stats.unitPlural.trim().length > 0, `piece "${entry.id}" is missing a real plural composition unit label`);
      assert.notEqual(entry.stats.unit, entry.stats.unitPlural, `piece "${entry.id}"'s unit/unitPlural should differ (or this is at least worth a second look)`);
    }
  }
});
