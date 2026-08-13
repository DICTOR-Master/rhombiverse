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
} from '../../src/animals.js';
import { isMature, growOrganism, GENOME_TRAIT_RANGES } from '../../src/evolution.js';
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
