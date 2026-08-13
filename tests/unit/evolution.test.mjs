// RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md Stage 1. evolution.js imports
// growth.js only (no THREE/DOM dependency either) -- zero npm
// dependencies, same as growth.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENOME_TRAIT_RANGES,
  clampGenome,
  genomeToPhenotype,
  plantOrganism,
  growOrganism,
  verifyGenomeCoherence,
} from '../../src/evolution.js';
import { createWorldStore } from '../../src/worldstate.js';

test('clampGenome: every trait clamps into its own real range, missing/invalid values default to the midpoint', () => {
  const over = clampGenome({ growthRate: 5, branchingAngle: -3, maturitySize: 999, mutationRate: NaN });
  for (const [trait, [min, max]] of Object.entries(GENOME_TRAIT_RANGES)) {
    assert.ok(over[trait] >= min && over[trait] <= max, `${trait} out of range: ${over[trait]}`);
  }
  const empty = clampGenome({});
  for (const [trait, [min, max]] of Object.entries(GENOME_TRAIT_RANGES)) {
    assert.equal(empty[trait], (min + max) / 2, `${trait} should default to its range midpoint`);
  }
});

test('genomeToPhenotype: growthRate maps to facesPerTick within growth.js\'s real coherence-safe range (1..6)', () => {
  const low = genomeToPhenotype({ growthRate: 0 });
  const high = genomeToPhenotype({ growthRate: 1 });
  assert.equal(low.facesPerTick, 1);
  assert.equal(high.facesPerTick, 6);
});

test('genomeToPhenotype: branchingAngle maps to the three real discrete preferType values via thresholds', () => {
  assert.equal(genomeToPhenotype({ branchingAngle: 0 }).preferType, 'oblate');
  assert.equal(genomeToPhenotype({ branchingAngle: 0.5 }).preferType, null);
  assert.equal(genomeToPhenotype({ branchingAngle: 1 }).preferType, 'acute');
});

test('genomeToPhenotype: maturitySize maps directly to maxGeneration, real-measured range 3..15', () => {
  assert.equal(genomeToPhenotype({ maturitySize: 3 }).maxGeneration, 3);
  assert.equal(genomeToPhenotype({ maturitySize: 15 }).maxGeneration, 15);
});

test('plantOrganism: a fresh organism is never invisible (at least one tile immediately), genome stored alongside its seed', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const { seed, organism } = plantOrganism(world, 'org_1', 'seed_1', 'evolved-plant', { growthRate: 0.5 }, [0, 0, 0], 1000);
  assert.equal(seed.tiles.length, 1);
  assert.deepEqual(Object.keys(world.getOrganisms()), ['org_1']);
  assert.deepEqual(Object.keys(world.getSeeds()), ['seed_1']);
  assert.equal(organism.seedId, 'seed_1');
  assert.ok(organism.genome.growthRate === 0.5);
});

test('growOrganism: grows the linked seed using genome-derived parameters, respects the genome\'s own maxGeneration cap', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'org_1', 'seed_1', 'evolved-plant', { maturitySize: 4, growthRate: 1 }, [0, 0, 0], 0);

  let now = 0;
  let ticks = 0;
  while (ticks < 4 + 5) {
    now += 30001;
    growOrganism(world, 'org_1', now);
    ticks++;
  }
  const seed = world.getSeeds().seed_1;
  assert.ok(seed.tiles.length > 1, 'expected growth beyond the initial tile');
  assert.ok(seed.generation <= 4, `generation ${seed.generation} exceeded the genome's own maturitySize cap of 4`);
});

test('growOrganism: a missing organism or seed is a safe no-op, not a throw', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.equal(growOrganism(world, 'nope', 1000), false);
});

test('verifyGenomeCoherence: exhaustively sampling every trait range extreme + midpoint never produces a genuine geometric overlap (section 1.1)', () => {
  const extremes = [0, 0.5, 1];
  const maturitySizes = [3, 9, 15];
  let sampled = 0;
  for (const growthRate of extremes) {
    for (const branchingAngle of extremes) {
      for (const maturitySize of maturitySizes) {
        const result = verifyGenomeCoherence({ growthRate, branchingAngle, maturitySize }, 'evolved-plant', maturitySize + 3);
        assert.ok(result.coherent, `genome {growthRate:${growthRate}, branchingAngle:${branchingAngle}, maturitySize:${maturitySize}} produced a real overlap`);
        sampled++;
      }
    }
  }
  assert.equal(sampled, 27, 'expected a full 3x3x3 sweep of the extremes + midpoint');
});

test('verifyGenomeCoherence: the two prior real bugs (near/far-face fold-back) stay fixed under genome-driven growth too', () => {
  // Same class of check that caught the 2026-08-13 growth.js overlap bug
  // in the first place -- re-run here against genome-driven parameters
  // specifically (facesPerTick=6, both acute and oblate bias), not just
  // the fixed Wave-1 species tables growth.test.mjs already covers.
  const acuteHeavy = verifyGenomeCoherence({ growthRate: 1, branchingAngle: 1, maturitySize: 10 }, 'evolved-plant', 13);
  const oblateHeavy = verifyGenomeCoherence({ growthRate: 1, branchingAngle: 0, maturitySize: 10 }, 'evolved-plant', 13);
  assert.ok(acuteHeavy.coherent, 'high-facesPerTick, fully-acute-biased genome produced a real overlap');
  assert.ok(oblateHeavy.coherent, 'high-facesPerTick, fully-oblate-biased genome produced a real overlap');
  assert.ok(acuteHeavy.tileCount > 5 && oblateHeavy.tileCount > 5, 'expected real growth to have happened, not a trivially-small structure');
});
