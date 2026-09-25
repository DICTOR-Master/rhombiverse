// createWorldStore only imports lattice.js/regions.js, neither of which
// touch THREE or the DOM -- zero npm dependencies needed here either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldStore } from '../../src/core/worldstate-core.js';

function emptyWorld(hooks) {
  return createWorldStore({ worldName: 'test', version: 1, cells: {} }, hooks);
}

test('addCell/has/entries', () => {
  const world = emptyWorld();
  assert.equal(world.has(1, 1, 0), false);
  world.addCell(1, 1, 0, { material: 'base' });
  assert.equal(world.has(1, 1, 0), true);
  assert.equal(world.entries().length, 1);
  assert.equal(world.entries()[0].material, 'base');
});

test('removeCell', () => {
  const world = emptyWorld();
  world.addCell(1, 1, 0, { material: 'base' });
  world.removeCell(1, 1, 0);
  assert.equal(world.has(1, 1, 0), false);
  assert.equal(world.entries().length, 0);
});

test('addCell defaults region/status only when genuinely absent (Phase 5.8)', () => {
  const world = emptyWorld();
  world.addCell(0, 0, 0, { material: 'base' });
  const [cell] = world.entries();
  assert.equal(cell.region, 'open');
  assert.equal(cell.status, 'pending');

  // An existing cell re-added with real values (recolor, hydrosphere,
  // etc.) must never have those silently overwritten.
  world.addCell(0, 0, 0, { material: 'garnet', region: 'core', status: 'approved' });
  const [recolored] = world.entries();
  assert.equal(recolored.region, 'core');
  assert.equal(recolored.status, 'approved');
});

test('addCell no longer stamps gravitySource/gravityWeight/claimId (dead fields, removed 2026-08-31)', () => {
  // gravity.js re-derives planetoid clusters from cell `material` alone
  // and never reads these; claims are tracked entirely via the `claims`
  // map + claimIdAt(), never `cell.claimId`. See
  // RHOMBIVERSE_CLAUDE_CODE_IMPLEMENTATION_PLAN.md section 3.
  const world = emptyWorld();
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  world.addCell(1, 1, 0, { material: 'base' });
  const [bsg, base] = world.entries().sort((a, b) => a.x - b.x);
  assert.equal(bsg.gravitySource, undefined);
  assert.equal(bsg.gravityWeight, undefined);
  assert.equal(bsg.claimId, undefined);
  assert.equal(base.gravitySource, undefined);
});

test('toJSON / replaceAll round-trip preserves cells, claims, inventory, trades', () => {
  const world = emptyWorld();
  world.addCell(0, 0, 0, { material: 'base' });
  world.addClaim('claim_0_0_0', { ownerId: 'p1', center: [0, 0, 0], size: '2-shell' });
  world.creditInventory('p1', 'garnet', 5);
  world.setPendingTrade('trade_1', { playerA: 'p1', playerB: 'p2' });

  const json = world.toJSON();
  const restored = emptyWorld();
  restored.replaceAll(json);

  assert.equal(restored.has(0, 0, 0), true);
  assert.deepEqual(Object.keys(restored.getClaims()), ['claim_0_0_0']);
  assert.equal(restored.getInventory().p1.garnet.quantity, 5);
  assert.deepEqual(Object.keys(restored.getPendingTrades()), ['trade_1']);
});

test('hooks: onAdd/onRemove fire exactly once per call, with correct args', () => {
  const added = [];
  const removed = [];
  const world = emptyWorld({
    onAdd: (x, y, z, data) => added.push([x, y, z, data.material]),
    onRemove: (x, y, z) => removed.push([x, y, z]),
  });
  world.addCell(2, 0, 2, { material: 'ferrostone' });
  world.removeCell(2, 0, 2);
  assert.deepEqual(added, [[2, 0, 2, 'ferrostone']]);
  assert.deepEqual(removed, [[2, 0, 2]]);
});

test('spendInventory: fails closed when insufficient, leaves quantity untouched', () => {
  const world = emptyWorld();
  world.creditInventory('p1', 'garnet', 3);
  assert.equal(world.spendInventory('p1', 'garnet', 5), false);
  assert.equal(world.getInventory().p1.garnet.quantity, 3);
  assert.equal(world.spendInventory('p1', 'garnet', 3), true);
  assert.equal(world.getInventory().p1.garnet.quantity, 0);
});

test('creditInventory preserves lastUsedAt for an existing material, stamps fresh for a new one', () => {
  const world = emptyWorld();
  world.creditInventory('p1', 'garnet', 1, 1000);
  world.creditInventory('p1', 'garnet', 1, 2000);
  assert.equal(world.getInventory().p1.garnet.lastUsedAt, 1000);
  assert.equal(world.getInventory().p1.garnet.quantity, 2);
});
