// createWorldStore only imports lattice.js, which touches neither THREE
// nor the DOM -- zero npm dependencies needed here either.
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

test('addCell stores the data it is given, unchanged', () => {
  const world = emptyWorld();
  world.addCell(0, 0, 0, { material: 'base', pyramids: 0 });
  const [cell] = world.entries();
  assert.deepEqual(cell, { x: 0, y: 0, z: 0, material: 'base', pyramids: 0 });
});

test('toJSON / replaceAll round-trip preserves cells', () => {
  const world = emptyWorld();
  world.addCell(0, 0, 0, { material: 'base' });
  world.addCell(1, 1, 0, { material: 'teal' });

  const json = world.toJSON();
  const restored = emptyWorld();
  restored.replaceAll(json);

  assert.equal(restored.has(0, 0, 0), true);
  assert.equal(restored.has(1, 1, 0), true);
  assert.equal(restored.entries().length, 2);
});

test('hooks: onAdd/onRemove fire exactly once per call, with correct args', () => {
  const added = [];
  const removed = [];
  const world = emptyWorld({
    onAdd: (x, y, z, data) => added.push([x, y, z, data.material]),
    onRemove: (x, y, z) => removed.push([x, y, z]),
  });
  world.addCell(2, 0, 2, { material: 'teal' });
  world.removeCell(2, 0, 2);
  assert.deepEqual(added, [[2, 0, 2, 'teal']]);
  assert.deepEqual(removed, [[2, 0, 2]]);
});
