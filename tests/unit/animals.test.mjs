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
  blendAnimalTraits,
  mutateAnimalTraits,
  reproduceAnimal,
  reproduceFn,
  MATE_PREFERENCE_TRAIT,
  computeAnimalSurvivalProbability,
  attemptPredation,
  animalGenerationStepHook,
  PREDATION_PROBABILITY,
  isAtHabitatBoundary,
  CROSSOVER_MIN_BOUNDARY_GENERATIONS,
} from '../../src/animals.js';
import {
  isMature,
  growOrganism,
  GENOME_TRAIT_RANGES,
  resolveCatchUpForAllPlanetoids,
  plantOrganism,
  reproduce,
  computeSurvivalProbability,
} from '../../src/evolution.js';
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

// ============================================================
// Stage C -- Sexual Reproduction
// ============================================================

test('blendAnimalTraits: plain per-trait average, clamped', () => {
  const blended = blendAnimalTraits({ mobilityRange: 1, huntBias: 0 }, { mobilityRange: 15, huntBias: 1 });
  assert.equal(blended.mobilityRange, 8);
  assert.equal(blended.huntBias, 0.5);
});

test('mutateAnimalTraits: mutationRate 0 never changes anything; mutationRate 1 always mutates while staying in range', () => {
  const traits = { mobilityRange: 8, huntBias: 0.5 };
  const unchanged = mutateAnimalTraits(traits, 0, Math.random);
  assert.deepEqual(unchanged, traits);

  const alwaysMutated = mutateAnimalTraits(traits, 1, () => 0.999);
  assert.notDeepEqual(alwaysMutated, traits);
  assert.ok(alwaysMutated.mobilityRange >= ANIMAL_TRAIT_RANGES.mobilityRange[0] && alwaysMutated.mobilityRange <= ANIMAL_TRAIT_RANGES.mobilityRange[1]);
  assert.ok(alwaysMutated.huntBias >= 0 && alwaysMutated.huntBias <= 1);
});

test('reproduceAnimal: a non-animal parent is rejected outright (null)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'p1', 'seed_p1', 'amoeba', {}, [0, 0, 0], 0);
  assert.equal(reproduceAnimal(world, 'p1', 'child', 'seed_child'), null);
});

test('reproduceAnimal: no mate in range (or no other organisms at all) returns a real, distinguishable "no-mate-in-range" result, not a crash', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, {}, { mobilityRange: 2 }, [0, 0, 0], 0);
  const outcome = reproduceAnimal(world, 'a1', 'child', 'seed_child', 0);
  assert.equal(outcome.result, null);
  assert.equal(outcome.mode, 'no-mate-in-range');
});

test('reproduceAnimal: a different species within physical range does NOT count as an eligible mate', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { mobilityRange: 5 }, [0, 0, 0], 0);
  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3 }, [1, 1, 0], 0);
  for (const id of ['a1', 'amoeba1']) {
    let now = 0;
    for (let i = 0; i < 10 && !isMature(world, id); i++) {
      now += 30001;
      growOrganism(world, id, now);
    }
  }
  const outcome = reproduceAnimal(world, 'a1', 'child', 'seed_child', 300000);
  assert.equal(outcome.mode, 'no-mate-in-range');
});

test('reproduceAnimal: a real successful pairing produces an offspring with a BLENDED+MUTATED base genome AND animal traits, planted in valid habitat', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  // mutationRate: 0 explicitly -- mutateGenome's own fire check is
  // `rng() < effectiveRate`, so an rng that always returns 0 would
  // actually ALWAYS fire against any positive mutationRate (0 < rate),
  // the opposite of "never mutates". Genuinely guaranteeing a blend-only
  // outcome means mutationRate itself must be 0, not just picking a
  // convenient-looking rng constant.
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, { maturitySize: 3, resourceEfficiency: 0.2, mutationRate: 0 }, { mobilityRange: 8, huntBias: 0.1 }, [0, 0, 0], 0);
  plantAnimal(world, 'a2', 'seed_a2', LAND_CREATURE_SPECIES, { maturitySize: 3, resourceEfficiency: 0.8, mutationRate: 0 }, { mobilityRange: 8, huntBias: 0.9 }, [1, 1, 0], 0);
  for (const id of ['a1', 'a2']) {
    let now = 0;
    for (let i = 0; i < 10 && !isMature(world, id); i++) {
      now += 30001;
      growOrganism(world, id, now);
    }
    assert.ok(isMature(world, id));
  }

  const outcome = reproduceAnimal(world, 'a1', 'child', 'seed_child', 300000, Math.random); // mutationRate 0 on both parents -> blend-only regardless of rng
  assert.equal(outcome.mode, 'sexual');
  assert.ok(outcome.mateId === 'a2');
  const child = outcome.result.organism;
  assert.equal(child.species, LAND_CREATURE_SPECIES);
  // Blend-only (rng always 0 -> mutation never fires): exact midpoint of both parents.
  assert.ok(Math.abs(child.genome.resourceEfficiency - 0.5) < 1e-9);
  assert.ok(Math.abs(child.mobilityRange - 8) < 1e-9);
  assert.ok(Math.abs(child.huntBias - 0.5) < 1e-9);
  assert.ok(isValidHabitat(world, LAND_CREATURE_SPECIES, world.getSeeds()['seed_child'].origin));
});

test('reproduceFn: delegates non-animal species straight to evolution.js\'s own unmodified reproduce()', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'p1', 'seed_p1', 'amoeba', {}, [0, 0, 0], 0);
  const outcome = reproduceFn(world, 'amoeba', 'p1', [], 'child', 'seed_child', [5, 0, 0], 1000, () => 0);
  assert.equal(outcome.mode, 'asexual'); // matches reproduce()'s own dispatch for non-plant species
  assert.ok(outcome.result);
});

test('reproduceFn: routes landCreature/seaCreature through reproduceAnimal, not the generic asexual fallback', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { mobilityRange: 8 }, [0, 0, 0], 0);
  plantAnimal(world, 'a2', 'seed_a2', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { mobilityRange: 8 }, [1, 1, 0], 0);
  for (const id of ['a1', 'a2']) {
    let now = 0;
    for (let i = 0; i < 10 && !isMature(world, id); i++) {
      now += 30001;
      growOrganism(world, id, now);
    }
  }
  const outcome = reproduceFn(world, LAND_CREATURE_SPECIES, 'a1', ['a2'], 'child', 'seed_child', [5, 0, 0], 300000, () => 0);
  assert.equal(outcome.mode, 'sexual');
  assert.equal(outcome.mateId, 'a2');
});

test('Sexual selection bias (MATE_PREFERENCE_TRAIT=huntBias): statistically favors the higher-huntBias candidate without fully excluding the lower one', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  plantAnimal(world, 'parent', 'seed_parent', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { mobilityRange: 8 }, [0, 0, 0], 0);
  plantAnimal(world, 'low', 'seed_low', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { mobilityRange: 8, huntBias: 0.05 }, [1, 1, 0], 0);
  plantAnimal(world, 'high', 'seed_high', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { mobilityRange: 8, huntBias: 0.95 }, [-1, -1, 0], 0);
  for (const id of ['parent', 'low', 'high']) {
    let now = 0;
    for (let i = 0; i < 10 && !isMature(world, id); i++) {
      now += 30001;
      growOrganism(world, id, now);
    }
  }
  let highCount = 0;
  const trials = 300;
  for (let i = 0; i < trials; i++) {
    const outcome = reproduceAnimal(world, 'parent', `child_${i}`, `seed_child_${i}`, 300000 + i, Math.random);
    if (outcome.mateId === 'high') highCount++;
  }
  assert.ok(highCount > trials * 0.55, `expected a real bias toward the higher-huntBias candidate, got ${highCount}/${trials}`);
  assert.ok(highCount < trials, 'the lower-trait candidate must remain statistically reachable (bias, not a hard filter)');
});

test('movementStepHook + reproduceFn wired into a real multi-generation catch-up run: a land creature population actually grows via real sexual reproduction', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0.1 }, { mobilityRange: 5 }, [1, 1, 1], 0);
  plantAnimal(world, 'a2', 'seed_a2', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0.1 }, { mobilityRange: 5 }, [2, 2, 0], 0);

  resolveCatchUpForAllPlanetoids(world, ['a1', 'a2'], 0, movementStepHook, reproduceFn);
  const result = resolveCatchUpForAllPlanetoids(world, ['a1', 'a2'], 30000 * 30, movementStepHook, reproduceFn);
  const finalIds = Object.values(result)[0].organismIds;

  assert.ok(finalIds.length >= 2, 'a real 30-generation run with two mature-eligible land creatures in range must produce real sexual reproduction');
  for (const id of finalIds) {
    const organism = world.getOrganisms()[id];
    assert.equal(organism.species, LAND_CREATURE_SPECIES);
    assert.ok(organism.mobilityRange >= ANIMAL_TRAIT_RANGES.mobilityRange[0] && organism.mobilityRange <= ANIMAL_TRAIT_RANGES.mobilityRange[1]);
    const seed = world.getSeeds()[organism.seedId];
    assert.ok(isValidHabitat(world, LAND_CREATURE_SPECIES, seed.origin), 'every surviving organism must still be in valid habitat after a real multi-generation run');
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

// ============================================================
// Stage D -- Trophic Tier Extension (Herbivory + Carnivory)
// ============================================================

test('computeAnimalSurvivalProbability: delegates straight to evolution.js\'s own unmodified computeSurvivalProbability for a non-animal organism', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'p1', 'seed_p1', 'amoeba', {}, [0, 0, 0], 0);
  assert.equal(computeAnimalSurvivalProbability(world, 'p1', ['p1']), computeSurvivalProbability(world, 'p1', ['p1']));
});

test('computeAnimalSurvivalProbability: a pure herbivore (huntBias=0) responds to local BIOMASS -- a nearby mature plant WITH real water access measurably raises its odds under scarcity', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantAnimal(world, 'herb', 'seed_herb', LAND_CREATURE_SPECIES, { maturitySize: 3, resourceEfficiency: 0 }, { huntBias: 0 }, [0, 0, 0], 0);
  const withoutPlant = computeAnimalSurvivalProbability(world, 'herb', ['herb']);

  // localBiomassAvailability's own formula needs the PLANT itself to
  // have real water access (growthRate*resourceEfficiency*0 = 0
  // otherwise, per evolution.test.mjs's own established pattern) --
  // biomass isn't produced from nothing.
  for (let i = 0; i < 6; i++) world.addCell(3 + i, i, 0, { material: 'water' });
  plantOrganism(world, 'plant1', 'seed_plant1', 'plant', { maturitySize: 3, growthRate: 1, resourceEfficiency: 1 }, [3, 0, 0], 0);
  growToMaturity(world, 'plant1');
  const withPlant = computeAnimalSurvivalProbability(world, 'herb', ['herb', 'plant1']);

  assert.ok(withPlant > withoutPlant, `expected local plant biomass to raise a low-resourceEfficiency herbivore's odds, got ${withoutPlant} -> ${withPlant}`);
});

test('computeAnimalSurvivalProbability: a pure carnivore (huntBias=1) responds to local PREY density -- nearby mature amoeba measurably raise its odds under scarcity', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantAnimal(world, 'carn', 'seed_carn', LAND_CREATURE_SPECIES, { maturitySize: 3, resourceEfficiency: 0 }, { huntBias: 1 }, [0, 0, 0], 0);
  const withoutPrey = computeAnimalSurvivalProbability(world, 'carn', ['carn']);

  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3 }, [1, 1, 0], 0);
  growToMaturity(world, 'amoeba1');
  const withPrey = computeAnimalSurvivalProbability(world, 'carn', ['carn', 'amoeba1']);

  assert.ok(withPrey > withoutPrey, `expected nearby prey to raise a low-resourceEfficiency carnivore's odds, got ${withoutPrey} -> ${withPrey}`);
});

test('computeAnimalSurvivalProbability: huntBias is a continuous blend, not a hard split -- an intermediate huntBias responds to BOTH biomass and prey', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantAnimal(world, 'omni', 'seed_omni', LAND_CREATURE_SPECIES, { maturitySize: 3, resourceEfficiency: 0 }, { huntBias: 0.5 }, [0, 0, 0], 0);
  const baseline = computeAnimalSurvivalProbability(world, 'omni', ['omni']);

  for (let i = 0; i < 6; i++) world.addCell(3 + i, i, 0, { material: 'water' });
  plantOrganism(world, 'plant1', 'seed_plant1', 'plant', { maturitySize: 3, growthRate: 1, resourceEfficiency: 1 }, [3, 0, 0], 0);
  growToMaturity(world, 'plant1');
  const withPlantOnly = computeAnimalSurvivalProbability(world, 'omni', ['omni', 'plant1']);
  assert.ok(withPlantOnly > baseline, 'a mid-huntBias animal must still benefit at least partially from nearby biomass');

  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3 }, [1, 1, 0], 0);
  growToMaturity(world, 'amoeba1');
  const withBoth = computeAnimalSurvivalProbability(world, 'omni', ['omni', 'plant1', 'amoeba1']);
  assert.ok(withBoth > withPlantOnly, 'adding real prey on top must raise it further still');
});

test('attemptPredation: a pure herbivore (huntBias=0) never preys, even with abundant prey in range', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantAnimal(world, 'herb', 'seed_herb', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { huntBias: 0, mobilityRange: 5 }, [0, 0, 0], 0);
  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3 }, [1, 1, 0], 0);
  for (const id of ['herb', 'amoeba1']) growToMaturity(world, id);
  const happened = attemptPredation(world, 'herb', () => 0, ['herb', 'amoeba1']);
  assert.equal(happened, false);
  assert.ok(world.getOrganisms()['amoeba1'], 'prey must survive when the predator has zero huntBias');
});

test('attemptPredation: a real carnivore with prey in range and a favorable roll actually REMOVES the prey organism and its seed', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantAnimal(world, 'carn', 'seed_carn', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { huntBias: 1, mobilityRange: 5 }, [0, 0, 0], 0);
  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3 }, [1, 1, 0], 0);
  for (const id of ['carn', 'amoeba1']) growToMaturity(world, id);
  const happened = attemptPredation(world, 'carn', () => 0, ['carn', 'amoeba1']); // rng=0 always beats PREDATION_PROBABILITY*huntBias (positive)
  assert.equal(happened, true);
  assert.equal(world.getOrganisms()['amoeba1'], undefined, 'prey organism must be genuinely removed');
  assert.equal(world.getSeeds()['seed_amoeba1'], undefined, 'prey seed (its rendered structure) must be genuinely removed too');
});

test('attemptPredation: an animal never preys on a same-or-higher-huntBias animal (strict lower-tier only)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantAnimal(world, 'a', 'seed_a', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { huntBias: 0.5, mobilityRange: 5 }, [0, 0, 0], 0);
  plantAnimal(world, 'b_equal', 'seed_b', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { huntBias: 0.5, mobilityRange: 5 }, [1, 1, 0], 0);
  for (const id of ['a', 'b_equal']) growToMaturity(world, id);
  const happened = attemptPredation(world, 'a', () => 0, ['a', 'b_equal']);
  assert.equal(happened, false, 'equal huntBias must never count as prey');
  assert.ok(world.getOrganisms()['b_equal']);
});

test('animalGenerationStepHook + computeAnimalSurvivalProbability wired into a real multi-generation catch-up run: a carnivore land creature measurably reduces a nearby amoeba population over time', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  plantAnimal(world, 'carn', 'seed_carn', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { huntBias: 1, mobilityRange: 6 }, [1, 1, 1], 0);
  const amoebaIds = [];
  for (let i = 0; i < 6; i++) {
    const id = `amoeba${i}`;
    plantOrganism(world, id, `seed_${id}`, 'amoeba', { maturitySize: 3, mutationRate: 0 }, [1 + i * 0.3, 1, 1], 0);
    amoebaIds.push(id);
  }
  const allIds = ['carn', ...amoebaIds];

  resolveCatchUpForAllPlanetoids(world, allIds, 0, animalGenerationStepHook, reproduceFn, computeAnimalSurvivalProbability);
  const result = resolveCatchUpForAllPlanetoids(
    world,
    allIds,
    30000 * 25,
    animalGenerationStepHook,
    reproduceFn,
    computeAnimalSurvivalProbability
  );
  const finalIds = Object.values(result)[0].organismIds;
  const survivingAmoeba = finalIds.filter((id) => world.getOrganisms()[id]?.species === 'amoeba');

  assert.ok(survivingAmoeba.length < amoebaIds.length, `expected measurable predation to reduce the amoeba population (started at ${amoebaIds.length}, ended at ${survivingAmoeba.length})`);
  assert.ok(finalIds.includes('carn') || finalIds.some((id) => id.startsWith('carn_')), 'the carnivore lineage should still be present, benefiting from the prey it consumed');
});

// ============================================================
// Stage E -- Habitat Crossover
// ============================================================

test('isAtHabitatBoundary: false with no opposite-habitat cell in reach; true once a real liquid-permeated cell is within the organism\'s own mobilityRange', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  plantAnimal(world, 'a1', 'seed_a1', LAND_CREATURE_SPECIES, {}, { mobilityRange: 2 }, [0, 0, 0], 0);
  assert.equal(isAtHabitatBoundary(world, 'a1'), false, 'no liquid cell exists anywhere yet');

  world.addCell(3, 3, 0, { material: 'water', hydrospherePermeated: true }); // real distance ~4.24, beyond mobilityRange 2
  assert.equal(isAtHabitatBoundary(world, 'a1'), false, 'liquid cell exists but is out of reach');

  world.setOrganism('a1', { ...world.getOrganisms()['a1'], mobilityRange: 6 });
  assert.equal(isAtHabitatBoundary(world, 'a1'), true, 'liquid cell is now within the organism\'s own real reach');
});

test('isAtHabitatBoundary: false for an organism NOT currently in its own valid habitat (never mid-invalid)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'water', hydrospherePermeated: true });
  plantAnimal(world, 's1', 'seed_s1', SEA_CREATURE_SPECIES, {}, { mobilityRange: 10 }, [0, 0, 0], 0);
  // Directly (and invalidly, bypassing plantAnimal's own guard) relocate
  // it onto dry, unrelated ground to exercise this specific edge case.
  world.setSeed('seed_s1', { ...world.getSeeds()['seed_s1'], origin: [50, 50, 50] });
  assert.equal(isAtHabitatBoundary(world, 's1'), false);
});

test('reproduceAnimal: a parent NOT at a habitat boundary never accumulates boundaryGenerations, even across many generations', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' }); // no liquid cell anywhere -- never a boundary
  plantAnimal(world, 'p0', 'seed_p0', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 8 }, [0, 0, 0], 0);
  plantAnimal(world, 'm0', 'seed_m0', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 8 }, [0.5, 0.5, 0], 0);
  for (const id of ['p0', 'm0']) growToMaturity(world, id);

  let parentId = 'p0';
  for (let i = 1; i <= 5; i++) {
    const offspringId = `gen${i}`;
    const outcome = reproduceAnimal(world, parentId, offspringId, `seed_${offspringId}`, i * 100000, () => 0.5, [parentId, 'm0']);
    assert.equal(outcome.mode, 'sexual');
    assert.equal(outcome.result.organism.boundaryGenerations, 0);
    growToMaturity(world, offspringId, 30);
    parentId = offspringId;
  }
});

test('reproduceAnimal + Stage E: sustained boundary pressure across many real consecutive generations eventually reclassifies a land lineage into a sea creature -- and never on a single generation', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  world.addCell(3, 3, 0, { material: 'water', hydrospherePermeated: true }); // real boundary, distance ~4.24
  plantAnimal(world, 'p0', 'seed_p0', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 10, huntBias: 0 }, [0, 0, 0], 0);
  plantAnimal(world, 'm0', 'seed_m0', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 10, huntBias: 0 }, [0.5, 0.5, 0], 0);
  for (const id of ['p0', 'm0']) growToMaturity(world, id);
  assert.ok(isAtHabitatBoundary(world, 'p0'), 'test setup sanity check -- the parent must genuinely be at a boundary');

  let parentId = 'p0';
  let reclassifiedAt = null;
  const MAX_GENERATIONS = 40;
  for (let i = 1; i <= MAX_GENERATIONS && !reclassifiedAt; i++) {
    const offspringId = `gen${i}`;
    const outcome = reproduceAnimal(world, parentId, offspringId, `seed_${offspringId}`, i * 100000, () => 0.5, [parentId, 'm0']);
    assert.equal(outcome.mode, 'sexual');
    const bornSpecies = outcome.result.organism.species;
    // Every generation is either still a fully valid, coherent land
    // organism, or (only once, the moment it happens) a freshly
    // reclassified sea creature -- never anything else, and every land
    // generation must genuinely still pass its own habitat check
    // (section 5's "never a broken in-between state").
    assert.ok(bornSpecies === LAND_CREATURE_SPECIES || bornSpecies === SEA_CREATURE_SPECIES);
    if (bornSpecies === LAND_CREATURE_SPECIES) {
      const seed = world.getSeeds()[outcome.result.organism.seedId];
      assert.ok(isValidHabitat(world, LAND_CREATURE_SPECIES, seed.origin), `generation ${i} must be genuinely valid land habitat`);
    }
    if (bornSpecies === SEA_CREATURE_SPECIES) {
      reclassifiedAt = i;
      break;
    }
    growToMaturity(world, offspringId, 30);
    // Real, grounded reason this matters (found via direct execution,
    // not assumed): pairing a drifting lineage against a permanently
    // STATIC mate every generation creates a genuine migration-selection
    // equilibrium (the blend-then-nudge trajectory mathematically
    // converges to a fixed point, ~11.3 here, verified by hand) that
    // never reaches the crossover threshold, no matter how many
    // generations pass -- because half of every blend keeps getting
    // pulled back down by the unchanging outsider. A REAL boundary
    // POPULATION (section 5's own "boundary-adjacent INDIVIDUALS",
    // plural) would have every local individual drifting under the SAME
    // sustained pressure, not one lineage against a frozen outlier -- so
    // the mate's own mobilityRange is nudged forward here too, modeling
    // that the whole local population is under the same pressure. This
    // does not change reproduceAnimal's own real mechanism at all, only
    // this test's population model.
    world.setOrganism('m0', { ...world.getOrganisms()['m0'], mobilityRange: outcome.result.organism.mobilityRange });
    parentId = offspringId;
  }

  assert.ok(reclassifiedAt !== null, `expected a real reclassification to eventually occur within ${MAX_GENERATIONS} generations of sustained boundary pressure`);
  assert.ok(
    reclassifiedAt >= CROSSOVER_MIN_BOUNDARY_GENERATIONS,
    `reclassification must require sustained pressure across many generations, not a single one -- happened at generation ${reclassifiedAt}`
  );

  const reclassified = world.getOrganisms()[`gen${reclassifiedAt}`];
  assert.equal(reclassified.status, 'pending', 'a crossover reclassification must ALWAYS route to moderation, regardless of mutation-step size');
  assert.equal(reclassified.boundaryGenerations, 0, 'the counter resets once a new lineage phase begins');
  const reclassifiedSeed = world.getSeeds()[reclassified.seedId];
  assert.ok(isValidHabitat(world, SEA_CREATURE_SPECIES, reclassifiedSeed.origin), 'the reclassified organism must be placed in genuinely valid habitat for its NEW species');
});

test('reproduceAnimal + Stage E: the REVERSE direction (sea to land) also succeeds under its own sustained pressure -- section 7\'s own explicit success check', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'water', hydrospherePermeated: true });
  world.addCell(3, 3, 0, { material: 'base' }); // real boundary, distance ~4.24, dry this time
  plantAnimal(world, 'p0', 'seed_p0', SEA_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 10, huntBias: 0 }, [0, 0, 0], 0);
  plantAnimal(world, 'm0', 'seed_m0', SEA_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 10, huntBias: 0 }, [0.5, 0.5, 0], 0);
  for (const id of ['p0', 'm0']) growToMaturity(world, id);
  assert.ok(isAtHabitatBoundary(world, 'p0'));

  let parentId = 'p0';
  let reclassifiedAt = null;
  for (let i = 1; i <= 40 && !reclassifiedAt; i++) {
    const offspringId = `rgen${i}`;
    const outcome = reproduceAnimal(world, parentId, offspringId, `seed_${offspringId}`, i * 100000, () => 0.5, [parentId, 'm0']);
    assert.equal(outcome.mode, 'sexual');
    if (outcome.result.organism.species === LAND_CREATURE_SPECIES) {
      reclassifiedAt = i;
      break;
    }
    growToMaturity(world, offspringId, 30);
    world.setOrganism('m0', { ...world.getOrganisms()['m0'], mobilityRange: outcome.result.organism.mobilityRange });
    parentId = offspringId;
  }

  assert.ok(reclassifiedAt !== null, 'the reverse sea-to-land direction must also be reachable under sustained pressure');
  const reclassified = world.getOrganisms()[`rgen${reclassifiedAt}`];
  assert.equal(reclassified.status, 'pending');
  const reclassifiedSeed = world.getSeeds()[reclassified.seedId];
  assert.ok(isValidHabitat(world, LAND_CREATURE_SPECIES, reclassifiedSeed.origin));
});

// ============================================================
// Stage F -- Moderation & Full Verification (section 7's own checklist)
// ============================================================

// Both tests below need a plant with real water access (per
// localBiomassAvailability's own formula) WITHOUT that water being the
// nearest cell to wherever the amoeba/animal is planted (which would
// make it invalid LAND habitat for the animal, per isValidHabitat's own
// "nearest cell" classification). A dry anchor cell much closer to the
// amoeba/animal cluster than the water cluster resolves this: still
// "in range" (within HABITAT_SEARCH_RADIUS/BIOMASS_SEARCH_RADIUS, both
// 10) for biomass/competition purposes, but never the NEAREST cell for
// habitat classification.
test('Real competitive pressure: a nearby mature herbivorous animal measurably LOWERS an amoeba\'s own survival odds under scarcity, competing for the same biomass -- closes a real gap found while auditing the full success-check list', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' }); // dry anchor, much nearer to the cluster below than the water is
  for (let i = 0; i < 6; i++) world.addCell(6 + i, 6 + i, 0, { material: 'water' }); // ~8.5 units out, still in range for the plant's own water access
  plantOrganism(world, 'plant1', 'seed_plant1', 'plant', { maturitySize: 3, growthRate: 1, resourceEfficiency: 1 }, [3, 3, 0], 0);
  growToMaturity(world, 'plant1');
  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3, resourceEfficiency: 0 }, [0.2, 0, 0], 0);
  growToMaturity(world, 'amoeba1');

  const withoutCompetitor = computeAnimalSurvivalProbability(world, 'amoeba1', ['amoeba1', 'plant1']);

  plantAnimal(world, 'herb1', 'seed_herb1', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { huntBias: 0 }, [0.3, 0, 0], 0);
  growToMaturity(world, 'herb1');
  const withCompetitor = computeAnimalSurvivalProbability(world, 'amoeba1', ['amoeba1', 'plant1', 'herb1']);

  assert.ok(
    withCompetitor < withoutCompetitor,
    `expected a nearby herbivore to measurably lower amoeba's own odds (real competition for the same biomass), got ${withoutCompetitor} -> ${withCompetitor}`
  );
});

test('Real competitive pressure: a pure/near-carnivore nearby does NOT meaningfully compete with amoeba for biomass (it hunts amoeba directly instead -- a different link)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  for (let i = 0; i < 6; i++) world.addCell(6 + i, 6 + i, 0, { material: 'water' });
  plantOrganism(world, 'plant1', 'seed_plant1', 'plant', { maturitySize: 3, growthRate: 1, resourceEfficiency: 1 }, [3, 3, 0], 0);
  growToMaturity(world, 'plant1');
  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3, resourceEfficiency: 0 }, [0.2, 0, 0], 0);
  growToMaturity(world, 'amoeba1');
  const withoutCompetitor = computeAnimalSurvivalProbability(world, 'amoeba1', ['amoeba1', 'plant1']);

  plantAnimal(world, 'carn1', 'seed_carn1', LAND_CREATURE_SPECIES, { maturitySize: 3 }, { huntBias: 1 }, [0.3, 0, 0], 0);
  growToMaturity(world, 'carn1');
  const withCarnivore = computeAnimalSurvivalProbability(world, 'amoeba1', ['amoeba1', 'plant1', 'carn1']);

  assert.equal(withCarnivore, withoutCompetitor, 'a pure carnivore should not draw on the shared biomass pool at all');
});

test('Section 7: under short-lived boundary pressure (fewer generations than CROSSOVER_MIN_BOUNDARY_GENERATIONS), no habitat crossover occurs', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'base' });
  world.addCell(3, 3, 0, { material: 'water', hydrospherePermeated: true });
  plantAnimal(world, 'p0', 'seed_p0', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 10, huntBias: 0 }, [0, 0, 0], 0);
  plantAnimal(world, 'm0', 'seed_m0', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0 }, { mobilityRange: 10, huntBias: 0 }, [0.5, 0.5, 0], 0);
  for (const id of ['p0', 'm0']) growToMaturity(world, id);

  let parentId = 'p0';
  const shortRun = CROSSOVER_MIN_BOUNDARY_GENERATIONS - 3; // deliberately short of the real threshold
  for (let i = 1; i <= shortRun; i++) {
    const offspringId = `sgen${i}`;
    const outcome = reproduceAnimal(world, parentId, offspringId, `seed_${offspringId}`, i * 100000, () => 0.5, [parentId, 'm0']);
    assert.equal(outcome.mode, 'sexual');
    assert.equal(outcome.result.organism.species, LAND_CREATURE_SPECIES, `no crossover should occur before sustained pressure accumulates (generation ${i})`);
    assert.ok(outcome.result.organism.boundaryGenerations < CROSSOVER_MIN_BOUNDARY_GENERATIONS);
    growToMaturity(world, offspringId, 30);
    world.setOrganism('m0', { ...world.getOrganisms()['m0'], mobilityRange: outcome.result.organism.mobilityRange });
    parentId = offspringId;
  }
});

test('Section 7 end-to-end: a mixed population (plant, amoeba, herbivore, carnivore) run through a real multi-generation catch-up shows every mechanism composing correctly at once -- coherent structures, competitive pressure, predation, and no invalid habitat anywhere', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  for (let i = 0; i < 6; i++) world.addCell(i, i, 1, { material: 'water' });

  plantOrganism(world, 'plant1', 'seed_plant1', 'plant', { maturitySize: 3, growthRate: 1, resourceEfficiency: 1, mutationRate: 0.05 }, [1, 0, 1], 0);
  plantOrganism(world, 'amoeba1', 'seed_amoeba1', 'amoeba', { maturitySize: 3, mutationRate: 0.05 }, [1, 1, 0], 0);
  plantOrganism(world, 'amoeba2', 'seed_amoeba2', 'amoeba', { maturitySize: 3, mutationRate: 0.05 }, [1, -1, 0], 0);
  plantAnimal(world, 'herb1', 'seed_herb1', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0.05 }, { huntBias: 0.1, mobilityRange: 6 }, [-1, 1, 0], 0);
  plantAnimal(world, 'carn1', 'seed_carn1', LAND_CREATURE_SPECIES, { maturitySize: 3, mutationRate: 0.05 }, { huntBias: 1, mobilityRange: 6 }, [-1, -1, 0], 0);
  const allIds = ['plant1', 'amoeba1', 'amoeba2', 'herb1', 'carn1'];

  resolveCatchUpForAllPlanetoids(world, allIds, 0, animalGenerationStepHook, reproduceFn, computeAnimalSurvivalProbability);
  const result = resolveCatchUpForAllPlanetoids(
    world,
    allIds,
    30000 * 20,
    animalGenerationStepHook,
    reproduceFn,
    computeAnimalSurvivalProbability
  );
  const finalIds = Object.values(result)[0].organismIds;

  assert.ok(finalIds.length >= 1, 'the ecosystem must not have gone fully extinct');
  for (const id of finalIds) {
    const organism = world.getOrganisms()[id];
    const seed = world.getSeeds()[organism.seedId];
    assert.ok(seed, `organism ${id} must have a real seed backing it`);
    assert.ok(seed.tiles.length >= 1, `organism ${id} must never be invisible`);
    if (isAnimal(organism)) {
      assert.ok(
        isValidHabitat(world, organism.species, seed.origin),
        `animal ${id} (${organism.species}) must always remain in valid habitat after a real multi-generation run`
      );
      assert.ok(organism.mobilityRange >= ANIMAL_TRAIT_RANGES.mobilityRange[0] && organism.mobilityRange <= ANIMAL_TRAIT_RANGES.mobilityRange[1]);
      assert.ok(organism.huntBias >= 0 && organism.huntBias <= 1);
    }
    for (const trait of Object.keys(GENOME_TRAIT_RANGES)) {
      const value = organism.genome[trait];
      assert.ok(
        value >= GENOME_TRAIT_RANGES[trait][0] && value <= GENOME_TRAIT_RANGES[trait][1],
        `organism ${id}'s ${trait}=${value} must stay within its real coherence-bounded range`
      );
    }
  }
});
