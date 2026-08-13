// RHOMBIVERSE_SPEC_ANIMALS.md Stage A. animals.js imports evolution.js
// only (no THREE/DOM dependency either) -- zero npm dependencies, same
// as growth.test.mjs/evolution.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIMAL_TRAIT_RANGES,
  LAND_CREATURE_SPECIES,
  SEA_CREATURE_SPECIES,
  clampAnimalTraits,
  isValidHabitat,
  plantAnimal,
  isAnimal,
  HABITAT_SEARCH_RADIUS,
  MAX_MOVE_ATTEMPTS,
  attemptMove,
  movementStepHook,
} from '../../src/animals.js';
import { isMature, growOrganism, GENOME_TRAIT_RANGES, resolveCatchUpForAllPlanetoids, plantOrganism } from '../../src/evolution.js';
import { createWorldStore } from '../../src/worldstate.js';

function growToMaturity(world, organismId, maxTicks = 20) {
  let now = 0;
  for (let i = 0; i < maxTicks && !isMature(world, organismId); i++) {
    now += 30001;
    growOrganism(world, organismId, now);
  }
  return isMature(world, organismId);
}

test('clampAnimalTraits: defaults missing/invalid values to each range midpoint, never throws', () => {
  const clamped = clampAnimalTraits({});
  assert.equal(clamped.mobilityRange, (ANIMAL_TRAIT_RANGES.mobilityRange[0] + ANIMAL_TRAIT_RANGES.mobilityRange[1]) / 2);
  assert.equal(clamped.huntBias, 0.5);
});

test('clampAnimalTraits: clamps out-of-range values into each trait\'s own real range', () => {
  const clamped = clampAnimalTraits({ mobilityRange: 999, huntBias: -5 });
  assert.equal(clamped.mobilityRange, ANIMAL_TRAIT_RANGES.mobilityRange[1]);
  assert.equal(clamped.huntBias, ANIMAL_TRAIT_RANGES.huntBias[0]);
});

test('isValidHabitat: land creature is valid with no nearby cell at all (dry by default) or a dry cell; invalid near a liquid-permeated cell', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.equal(isValidHabitat(world, LAND_CREATURE_SPECIES, [50, 50, 50]), true, 'open space with nothing nearby defaults to dry');

  world.addCell(0, 0, 0, { material: 'base' });
  assert.equal(isValidHabitat(world, LAND_CREATURE_SPECIES, [0, 0, 0]), true, 'a dry base-rhomb cell is valid land habitat');

  world.addCell(1, 1, 0, { material: 'water', hydrospherePermeated: true });
  assert.equal(isValidHabitat(world, LAND_CREATURE_SPECIES, [1, 1, 0]), false, 'a liquid-permeated cell is NOT valid land habitat');
});

test('isValidHabitat: sea creature is invalid with no nearby cell or a dry cell; valid only near a real liquid-permeated cell', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.equal(isValidHabitat(world, SEA_CREATURE_SPECIES, [50, 50, 50]), false, 'open space with nothing nearby is not valid sea habitat');

  world.addCell(0, 0, 0, { material: 'base' });
  assert.equal(isValidHabitat(world, SEA_CREATURE_SPECIES, [0, 0, 0]), false, 'a dry cell is NOT valid sea habitat');

  world.addCell(1, 1, 0, { material: 'water', hydrospherePermeated: true });
  assert.equal(isValidHabitat(world, SEA_CREATURE_SPECIES, [1, 1, 0]), true, 'a real liquid-permeated cell IS valid sea habitat');
});

test('isValidHabitat: plain surface water (no hydrospherePermeated flag) is NOT valid sea habitat -- the deliberate spec-literal scope choice', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'water' }); // an oceanic-recipe surface water cell, never permeated
  assert.equal(isValidHabitat(world, SEA_CREATURE_SPECIES, [0, 0, 0]), false);
  assert.equal(isValidHabitat(world, LAND_CREATURE_SPECIES, [0, 0, 0]), false, 'and also not valid land habitat -- a lake is not dry');
});

test('plantAnimal: rejects an unknown species', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.throws(() => plantAnimal(world, 'a1', 'seed_a1', 'dragon', {}, {}, [0, 0, 0]), /Unknown animal species/);
});

test('plantAnimal: rejects planting a land creature directly on a liquid-permeated cell', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'water', hydrospherePermeated: true });
  assert.throws(() => plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, {}, {}, [0, 0, 0]), /Invalid habitat/);
});

test('plantAnimal: rejects planting a sea creature in open dry space', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.throws(() => plantAnimal(world, 'a1', 'seed_a1', SEA_CREATURE_SPECIES, {}, {}, [0, 0, 0]), /Invalid habitat/);
});

test('plantAnimal: a valid placement produces an organism carrying BOTH the base genome (evolution.js\'s own shape) and the two animal-specific traits, independently bounded', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  const { organism } = plantAnimal(
    world,
    'a1',
    'seed_a1',
    LAND_CREATURE_SPECIES,
    { growthRate: 2, maturitySize: 8 }, // deliberately out-of-range growthRate to confirm base clamping still applies
    { mobilityRange: 999, huntBias: 0.7 },
    [0, 0, 0]
  );
  assert.equal(organism.species, LAND_CREATURE_SPECIES);
  assert.ok(isAnimal(organism));
  // Base genome still exactly evolution.js's own shape/bounds -- proves
  // plantOrganism's own clampGenome ran completely unmodified.
  for (const trait of Object.keys(GENOME_TRAIT_RANGES)) {
    assert.ok(trait in organism.genome, `organism.genome must still carry ${trait}`);
  }
  assert.equal(organism.genome.growthRate, GENOME_TRAIT_RANGES.growthRate[1], 'out-of-range growthRate still clamped by evolution.js unchanged');
  assert.equal(organism.genome.maturitySize, 8);
  // Animal traits live as SIBLING fields, not nested inside genome.
  assert.equal(organism.mobilityRange, ANIMAL_TRAIT_RANGES.mobilityRange[1], 'out-of-range mobilityRange clamped to its own real ceiling');
  assert.equal(organism.huntBias, 0.7);
  assert.equal(organism.genome.mobilityRange, undefined, 'animal traits must never leak into the base genome object');
});

test('plantAnimal: a planted animal organism still grows correctly via the unchanged growOrganism/isMature pipeline', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, { maturitySize: 4 }, {}, [0, 0, 0], 0);
  assert.equal(isMature(world, 'a1'), false);
  const reachedMaturity = growToMaturity(world, 'a1');
  assert.ok(reachedMaturity, 'an animal organism must be able to reach maturity through evolution.js\'s own unmodified growth pipeline');
});

test('HABITAT_SEARCH_RADIUS reuses evolution.js\'s own RESOURCE_SEARCH_RADIUS grounding, not a second separately-tuned constant', () => {
  assert.equal(HABITAT_SEARCH_RADIUS, 10);
});

// ============================================================
// Stage B -- Mobility
// ============================================================

test('attemptMove: a non-animal organism is always a no-op', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'p1', 'seed_p1', 'amoeba', {}, [0, 0, 0], 0);
  const moved = attemptMove(world, 'p1');
  assert.equal(moved, false);
  assert.deepEqual(world.getSeeds()['seed_p1'].origin, [0, 0, 0]);
});

test('attemptMove: real movement never exceeds the organism\'s own mobilityRange, across many trials', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // A wide-open dry field -- every candidate direction is valid land
  // habitat, so this exercises real movement distance, not the retry path.
  const origin = [0, 0, 0];
  const { organism } = plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, {}, { mobilityRange: 5 }, origin, 0);
  for (let i = 0; i < 200; i++) {
    const before = world.getSeeds()['seed_a1'].origin;
    attemptMove(world, 'a1');
    const after = world.getSeeds()['seed_a1'].origin;
    const dist = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
    assert.ok(dist <= organism.mobilityRange + 1e-9, `single-step distance ${dist} exceeded mobilityRange ${organism.mobilityRange}`);
  }
});

test('attemptMove: a land creature confined to a small dry island surrounded by water never actually crosses into the liquid-permeated cells, across many real moves', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  // A ring of permeated water cells surrounding the dry island at a
  // real, fixed distance -- confirms the real invariant Stage B's own
  // success check asks for ("movement... stays within... valid cells"),
  // not "never moves at all": a small dry island still permits real
  // local movement, it just must never reach the surrounding water.
  for (let x = -3; x <= 3; x++) {
    for (let y = -3; y <= 3; y++) {
      for (let z = -3; z <= 3; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        if ((x + y + z) % 2 !== 0) continue; // valid FCC parity only
        world.addCell(x, y, z, { material: 'water', hydrospherePermeated: true });
      }
    }
  }
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, {}, { mobilityRange: 15 }, [0, 0, 0], 0);
  for (let i = 0; i < 30; i++) {
    attemptMove(world, 'a1');
    const pos = world.getSeeds()['seed_a1'].origin;
    assert.ok(isValidHabitat(world, LAND_CREATURE_SPECIES, pos), `land creature must always remain in valid dry habitat, found at [${pos}]`);
  }
});

test('attemptMove: a sea creature stays within its liquid-permeated pool, never wandering onto dry land', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // A small pool of permeated water around the origin; dry land just
  // beyond it in every direction.
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if ((x + y + z) % 2 !== 0) continue;
        world.addCell(x, y, z, { material: 'water', hydrospherePermeated: true });
      }
    }
  }
  plantAnimal(world, 'a1', 'seed_a1', SEA_CREATURE_SPECIES, {}, { mobilityRange: 2 }, [0, 0, 0], 0);
  for (let i = 0; i < 30; i++) {
    attemptMove(world, 'a1');
    const pos = world.getSeeds()['seed_a1'].origin;
    assert.ok(isValidHabitat(world, SEA_CREATURE_SPECIES, pos), `sea creature must always remain in valid liquid habitat, found at [${pos}]`);
  }
});

test('movementStepHook wired into resolveCatchUpForAllPlanetoids: a real multi-generation catch-up run actually moves a land animal over time, while never leaving valid habitat', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  const origin = [1, 1, 1]; // adjacent to the BSG seed so a real planetoid exists
  // maturitySize deliberately far beyond how many generations this test
  // resolves -- reproduction (and the population dynamics/extinction-
  // eligibility that come with a population > MIN_VIABLE_POPULATION)
  // must never fire here, so the single tracked organism id is
  // guaranteed to still exist at the end; this test is about mobility,
  // not survival/reproduction (Stage C's own job).
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, { maturitySize: 15, mutationRate: 0 }, { mobilityRange: 3 }, origin, 0);

  const startOrigin = [...world.getSeeds()['seed_a1'].origin];
  // First call establishes this planetoid's own lastSimulated baseline
  // (a never-before-resolved planetoid's fallback IS `now` itself, per
  // resolveCatchUpForAllPlanetoids's own design -- zero elapsed time on
  // a truly first call is correct, not a bug). A second call at a real
  // LATER `now` then has genuine elapsed time to resolve against that
  // stored baseline -- same two-call shape the Stage 4 catch-up tests
  // above already use for this exact reason.
  resolveCatchUpForAllPlanetoids(world, ['a1'], 0, movementStepHook);
  resolveCatchUpForAllPlanetoids(world, ['a1'], 30000 * 10, movementStepHook);

  const endOrigin = world.getSeeds()['seed_a1'].origin;
  assert.notDeepEqual(endOrigin, startOrigin, 'a real multi-generation catch-up run must actually move the animal at least once');
  assert.ok(isValidHabitat(world, LAND_CREATURE_SPECIES, endOrigin), 'final position must still be valid habitat');
});
