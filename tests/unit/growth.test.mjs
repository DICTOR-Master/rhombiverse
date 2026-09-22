// growth.js's growth-over-time engine (species templates, tick-rate-
// limited growSeed/applyGrowth/plantSeed/pruneTile) was archived
// 2026-09-22 (second world-building removal pass) to
// src/world-systems-archived/growth.js -- these tests moved with it.
// The deterministic Ammann-rhombohedra tiling geometry half that stayed
// live (STAR_DIRECTIONS/VALID_TRIPLES/unitTileVertices/tilesOverlap) is
// covered separately in growth-geometry.test.mjs, against the live
// trimmed src/geometry-extensions/growth.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROWTH_TEMPLATES,
  growSeed,
  plantSeed,
  applyGrowth,
  tileWorldVertices,
  tilesOverlap,
} from '../../src/world-systems-archived/growth.js';
// getSeeds/setSeed no longer exist on the live createWorldStore (schema
// trimmed 2026-09-22) -- see helpers/archived-world-store.mjs for why.
import { createArchivedWorldStore as createWorldStore } from './helpers/archived-world-store.mjs';

test('plantSeed: a fresh seed is never invisible (at least one tile immediately)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const seed = plantSeed(world, 'seed_1', 'moss', [0, 0, 0], 1000);
  assert.equal(seed.tiles.length, 1);
  assert.equal(seed.generation, 0);
  assert.deepEqual(Object.keys(world.getSeeds()), ['seed_1']);
});

test('plantSeed: rejects an unknown species', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.throws(() => plantSeed(world, 'seed_1', 'dragon', [0, 0, 0]), /Unknown growth species/);
});

test('growSeed: respects the tick cooldown (no growth before GROWTH_TICK_MS elapses)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const seed = plantSeed(world, 'seed_1', 'moss', [0, 0, 0], 1000);
  const before = seed.tiles.length;
  const grew = growSeed(seed, 1000 + 5000); // well under the 30s tick
  assert.equal(grew, false);
  assert.equal(seed.tiles.length, before);
});

test('growSeed: grows after the tick cooldown, and every tile is a real, distinct, non-overlapping golden rhombohedron', () => {
  for (const species of Object.keys(GROWTH_TEMPLATES)) {
    const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
    const seed = plantSeed(world, 'seed_1', species, [0, 0, 0], 0);
    let now = 0;
    let ticks = 0;
    // Run well past the template's own maxGeneration to also prove
    // growth actually stops (Adaptive Damping) rather than running
    // away.
    while (ticks < GROWTH_TEMPLATES[species].maxGeneration + 5) {
      now += 30000;
      growSeed(seed, now);
      ticks++;
    }
    assert.ok(seed.tiles.length > 1, `${species}: expected growth beyond the initial tile`);
    assert.ok(
      seed.generation <= GROWTH_TEMPLATES[species].maxGeneration,
      `${species}: generation ${seed.generation} exceeded maxGeneration ${GROWTH_TEMPLATES[species].maxGeneration}`
    );

    // Real pairwise 3D overlap check (separating-axis test on the
    // actual tile geometry), not just centroid-equality -- a 2026-08-13
    // bug (see growSeed's own header) produced tiles with DIFFERENT
    // centroids that still genuinely overlapped in space, which a
    // centroid-only check can never catch. Touching along a shared
    // face (the normal, expected way tiles connect) is correctly NOT
    // an overlap here -- only real interior penetration is.
    const allVerts = seed.tiles.map((tile) => tileWorldVertices(seed, tile));
    for (let i = 0; i < allVerts.length; i++) {
      for (let j = i + 1; j < allVerts.length; j++) {
        assert.ok(
          !tilesOverlap(allVerts[i], allVerts[j]),
          `${species}: tile ${i} and tile ${j} genuinely overlap in space`
        );
      }
    }
  }
});

test('applyGrowth: grows every due seed in the world, reports whether anything changed', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantSeed(world, 'seed_1', 'moss', [0, 0, 0], 0);
  plantSeed(world, 'seed_2', 'fern', [10, 0, 0], 0);

  assert.equal(applyGrowth(world, 5000), false); // nothing due yet

  const changed = applyGrowth(world, 35000);
  assert.equal(changed, true);
  const seeds = world.getSeeds();
  assert.ok(seeds.seed_1.tiles.length > 1);
  assert.ok(seeds.seed_2.tiles.length > 1);
});

test('applyGrowth: honors a seed\'s own stored phenotypeOverride on every tick, not just at plant time (genome-free growth sliders, section 6)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // amoeba's own GROWTH_TEMPLATES maxGeneration is 3 -- without the
  // override this seed would stop growing there.
  const seed = plantSeed(world, 'seed_1', 'amoeba', [0, 0, 0], 0);
  world.setSeed('seed_1', { ...seed, phenotypeOverride: { maxGeneration: 8, facesPerTick: 2, preferType: null } });

  let now = 0;
  for (let i = 0; i < 8; i++) {
    now += 30001;
    applyGrowth(world, now);
  }
  const grown = world.getSeeds().seed_1;
  assert.ok(grown.generation > 3, `expected the override's maxGeneration (8) to be honored past the template's own cap (3), got generation ${grown.generation}`);
});

test('tileWorldVertices: offsets by the seed origin, 8 distinct vertices per tile', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const seed = plantSeed(world, 'seed_1', 'amoeba', [5, 5, 5], 0);
  const verts = tileWorldVertices(seed, seed.tiles[0]);
  assert.equal(verts.length, 8);
  const keys = new Set(verts.map((v) => v.map((x) => x.toFixed(5)).join(',')));
  assert.equal(keys.size, 8);
  for (const v of verts) {
    assert.ok(v[0] >= 4 && v[0] <= 8, 'vertices should be near the seed origin, not at the raw lattice origin');
  }
});
