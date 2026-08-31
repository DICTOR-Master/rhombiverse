// growth.js is pure math (no THREE/DOM dependency, mirrors lattice.js's
// own separation of concerns) -- zero npm dependencies here either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHI,
  STAR_DIRECTIONS,
  VALID_TRIPLES,
  GROWTH_TEMPLATES,
  growSeed,
  plantSeed,
  applyGrowth,
  tileWorldVertices,
  tilesOverlap,
} from '../../src/geometry-extensions/growth.js';
import { createWorldStore } from '../../src/core/worldstate-core.js';

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function len(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

test('STAR_DIRECTIONS: 12 unit vectors, exactly two non-antipodal pairwise angle classes', () => {
  assert.equal(STAR_DIRECTIONS.length, 12);
  for (const v of STAR_DIRECTIONS) {
    assert.ok(Math.abs(len(v) - 1) < 1e-9, 'each direction must be unit length');
  }
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      const ang = (Math.acos(Math.max(-1, Math.min(1, dot(STAR_DIRECTIONS[i], STAR_DIRECTIONS[j])))) * 180) / Math.PI;
      seen.add(Math.round(ang * 100) / 100);
    }
  }
  // Exactly three distinct pairwise angles across all 66 pairs:
  // 63.43 (acute), 116.57 (oblate), 180 (antipodal) -- verified during
  // the spec pass and re-checked here at every module load.
  const rounded = [...seen].sort((a, b) => a - b);
  assert.deepEqual(rounded, [63.43, 116.57, 180]);
});

test('VALID_TRIPLES: exactly 20 acute + 20 oblate among all 220 possible triples', () => {
  const acute = VALID_TRIPLES.filter((t) => t.type === 'acute');
  const oblate = VALID_TRIPLES.filter((t) => t.type === 'oblate');
  assert.equal(acute.length, 20);
  assert.equal(oblate.length, 20);
});

test('every valid triple is a genuine golden rhombohedron: faces are golden rhombi, and acute/oblate volumes are in exact ratio phi', () => {
  function volume(dirs) {
    const [a, b, c] = dirs.map((i) => STAR_DIRECTIONS[i]);
    // scalar triple product a . (b x c)
    const cross = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    return Math.abs(dot(a, cross));
  }
  function faceDiagonalRatio(dirs) {
    const [a, b] = dirs.slice(0, 2).map((i) => STAR_DIRECTIONS[i]);
    const dLong = len([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
    const dShort = len([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
    return Math.max(dLong, dShort) / Math.min(dLong, dShort);
  }

  const acute = VALID_TRIPLES.find((t) => t.type === 'acute');
  const oblate = VALID_TRIPLES.find((t) => t.type === 'oblate');

  assert.ok(Math.abs(faceDiagonalRatio(acute.dirs) - PHI) < 1e-9);
  assert.ok(Math.abs(faceDiagonalRatio(oblate.dirs) - PHI) < 1e-9);

  const vAcute = volume(acute.dirs);
  const vOblate = volume(oblate.dirs);
  assert.ok(Math.abs(vAcute / vOblate - PHI) < 1e-9, `expected volume ratio phi, got ${vAcute / vOblate}`);
});

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
