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
  isMature,
  organismBoundingRadius,
  areAdjacent,
  isInPairingRange,
  mutateGenome,
  blendGenomes,
  selectMate,
  reproduceAsexual,
  reproduceSexual,
  reproduce,
  attemptHorizontalTransfer,
  localResourceAvailability,
  computeSurvivalProbability,
  resolveSurvival,
  RESOURCE_SEARCH_RADIUS,
  CROWDING_THRESHOLD,
  DRIFT_THRESHOLD,
  MIN_VIABLE_POPULATION,
} from '../../src/evolution.js';
import { createWorldStore } from '../../src/worldstate.js';

function growToMaturity(world, organismId, maxTicks = 20) {
  let now = 0;
  for (let i = 0; i < maxTicks && !isMature(world, organismId); i++) {
    now += 30001;
    growOrganism(world, organismId, now);
  }
  return now;
}

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

// ============================================================
// Stage 2 -- Reproduction, Inheritance, HGT & Sexual Selection
// ============================================================

test('isMature: false before reaching the genome\'s own maturitySize cap, true once generation catches up to it', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'org_1', 'seed_1', 'amoeba', { maturitySize: 4 }, [0, 0, 0], 0);
  assert.equal(isMature(world, 'org_1'), false);
  growToMaturity(world, 'org_1');
  assert.equal(isMature(world, 'org_1'), true);
  assert.equal(world.getSeeds().seed_1.generation, 4);
});

test('organismBoundingRadius: 0 for a nonexistent organism, positive and growing as the organism grows', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.equal(organismBoundingRadius(world, 'nope'), 0);
  plantOrganism(world, 'org_1', 'seed_1', 'amoeba', { maturitySize: 6, growthRate: 1 }, [0, 0, 0], 0);
  const initialRadius = organismBoundingRadius(world, 'org_1');
  assert.ok(initialRadius > 0);
  growToMaturity(world, 'org_1');
  assert.ok(organismBoundingRadius(world, 'org_1') > initialRadius, 'radius should grow as more tiles are added');
});

test('areAdjacent / isInPairingRange: real distance-based, not a flat constant -- far apart is neither, close is both, mid-range is pairing-only', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'org_1', 'seed_1', 'plant', { maturitySize: 4 }, [0, 0, 0], 0);
  plantOrganism(world, 'org_close', 'seed_close', 'plant', { maturitySize: 4 }, [0.5, 0, 0], 0);
  // Fresh single-tile organisms already have a real bounding radius of
  // ~2.38 each (one golden rhombohedron, edge length 1) -- distance 10
  // clears HGT's (radiusA+radiusB)*1.2 ~= 5.7 threshold while staying
  // inside pairing's (radiusA+radiusB)*3 ~= 14.3 one.
  plantOrganism(world, 'org_mid', 'seed_mid', 'plant', { maturitySize: 4 }, [10, 0, 0], 0);
  plantOrganism(world, 'org_far', 'seed_far', 'plant', { maturitySize: 4 }, [500, 0, 0], 0);

  assert.equal(areAdjacent(world, 'org_1', 'org_close'), true);
  assert.equal(isInPairingRange(world, 'org_1', 'org_close'), true);

  assert.equal(areAdjacent(world, 'org_1', 'org_far'), false);
  assert.equal(isInPairingRange(world, 'org_1', 'org_far'), false);

  // Mid-range: within pairing's wider multiplier but beyond HGT's tight one.
  assert.equal(areAdjacent(world, 'org_1', 'org_mid'), false);
  assert.equal(isInPairingRange(world, 'org_1', 'org_mid'), true);
});

test('mutateGenome: mutationRate=0 never changes anything; mutationRate=1 always shifts every trait, still fully in-range', () => {
  const base = clampGenome({ growthRate: 0.5, branchingAngle: 0.5, resourceEfficiency: 0.5, maturitySize: 9, mutationRate: 0 });
  const unchanged = mutateGenome(base, () => 0.999); // even a near-certain roll can't fire at mutationRate=0
  assert.deepEqual(unchanged, base);

  const volatile = { ...base, mutationRate: 1 };
  // 0.9 both fires every trait (0.9 < mutationRate=1) AND gives a
  // nonzero delta ((0.9*2-1)=0.8) -- 0.5 would fire but produce an
  // exactly-zero delta, since the delta formula is symmetric around 0.5.
  const mutated = mutateGenome(volatile, () => 0.9);
  for (const [trait, [min, max]] of Object.entries(GENOME_TRAIT_RANGES)) {
    assert.ok(mutated[trait] >= min && mutated[trait] <= max, `${trait} left its range after mutation: ${mutated[trait]}`);
  }
  assert.notDeepEqual(mutated, volatile, 'expected at least the un-clamped traits to actually shift');
});

test('blendGenomes: each trait is the plain average of both parents, still a fully valid genome', () => {
  const a = clampGenome({ growthRate: 0, branchingAngle: 0, resourceEfficiency: 0, maturitySize: 3, mutationRate: 0 });
  const b = clampGenome({ growthRate: 1, branchingAngle: 1, resourceEfficiency: 1, maturitySize: 15, mutationRate: 1 });
  const blended = blendGenomes(a, b);
  assert.equal(blended.growthRate, 0.5);
  assert.equal(blended.maturitySize, 9);
  assert.equal(blended.mutationRate, 0.5);
});

test('selectMate: biased toward higher preferredTrait, but every candidate stays statistically reachable (bias, not hard filter)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'low', 'seed_low', 'plant', { resourceEfficiency: 0.05 }, [0, 0, 0], 0);
  plantOrganism(world, 'high', 'seed_high', 'plant', { resourceEfficiency: 0.95 }, [1, 0, 0], 0);

  let lowPicks = 0;
  let highPicks = 0;
  // Deterministic sweep across the full rng() domain rather than
  // Math.random() -- exercises the real weighting function exhaustively
  // instead of hoping a sample size is big enough.
  const steps = 1000;
  for (let i = 0; i < steps; i++) {
    const r = i / steps;
    const pick = selectMate(world, ['low', 'high'], 'resourceEfficiency', () => r);
    if (pick === 'low') lowPicks++;
    else highPicks++;
  }
  assert.ok(highPicks > lowPicks, 'expected the higher-trait candidate to win the majority of the weighted draw');
  assert.ok(lowPicks > 0, 'expected the lower-trait candidate to still be reachable at least sometimes (bias, not a hard filter)');
});

test('reproduceAsexual: offspring genome is a mutated copy of the parent\'s own genome, same species', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'parent', 'seed_parent', 'amoeba', { growthRate: 0.5, mutationRate: 0 }, [0, 0, 0], 0);
  const result = reproduceAsexual(world, 'parent', 'child', 'seed_child', [5, 0, 0], 1000, () => 0.999);
  assert.equal(result.organism.genome.growthRate, 0.5); // mutationRate=0 -> exact copy
  assert.equal(world.getOrganisms().child.species, 'amoeba');
  assert.deepEqual(world.getSeeds().seed_child.origin, [5, 0, 0]);
});

test('reproduceSexual: offspring genome is the blend of both parents, then mutated', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'a', 'seed_a', 'plant', { growthRate: 0, mutationRate: 0 }, [0, 0, 0], 0);
  plantOrganism(world, 'b', 'seed_b', 'plant', { growthRate: 1, mutationRate: 0 }, [1, 0, 0], 0);
  const result = reproduceSexual(world, 'a', 'b', 'child', 'seed_child', [5, 0, 0], 1000, () => 0.999);
  assert.equal(result.organism.genome.growthRate, 0.5); // pure blend, mutationRate=0 on both parents so no shift
});

test('reproduce: plants pair sexually when a mature, in-range candidate exists; falls back to asexual otherwise; amoeba never pairs', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'plant_a', 'seed_a', 'plant', { maturitySize: 3, mutationRate: 0 }, [0, 0, 0], 0);
  plantOrganism(world, 'plant_b', 'seed_b', 'plant', { maturitySize: 3, mutationRate: 0 }, [0.5, 0, 0], 0);
  growToMaturity(world, 'plant_a');
  growToMaturity(world, 'plant_b');

  const paired = reproduce(world, 'plant', 'plant_a', ['plant_b'], 'child_1', 'seed_child_1', [10, 0, 0], 5_000_000, () => 0.5);
  assert.equal(paired.mode, 'sexual');
  assert.equal(paired.mateId, 'plant_b');

  const fallback = reproduce(world, 'plant', 'plant_a', [], 'child_2', 'seed_child_2', [20, 0, 0], 6_000_000, () => 0.5);
  assert.equal(fallback.mode, 'asexual-fallback');

  plantOrganism(world, 'amoeba_a', 'seed_amoeba_a', 'amoeba', { maturitySize: 3 }, [0, 0, 0], 0);
  const amoebaResult = reproduce(world, 'amoeba', 'amoeba_a', ['plant_a'], 'child_3', 'seed_child_3', [30, 0, 0], 7_000_000, () => 0.5);
  assert.equal(amoebaResult.mode, 'asexual');
});

test('attemptHorizontalTransfer: only fires between mature, adjacent organisms, copies one trait, donor stays untouched', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'donor', 'seed_donor', 'amoeba', { maturitySize: 3, growthRate: 0.9 }, [0, 0, 0], 0);
  plantOrganism(world, 'recipient', 'seed_recipient', 'amoeba', { maturitySize: 3, growthRate: 0.1 }, [0.3, 0, 0], 0);

  // Immature yet -- must not fire regardless of rng.
  assert.equal(attemptHorizontalTransfer(world, 'donor', 'recipient', () => 0), null);

  growToMaturity(world, 'donor');
  growToMaturity(world, 'recipient');

  const donorGenomeBefore = { ...world.getOrganisms().donor.genome };
  // rng() sequence: first call gates on probability (must be < probability
  // to fire), second call picks which of the 5 traits transfers.
  let call = 0;
  const rngSeq = [0.01, 0]; // fires (0.01 < default 0.1 probability), picks trait index 0
  const transfer = attemptHorizontalTransfer(world, 'donor', 'recipient', () => rngSeq[call++]);
  assert.ok(transfer, 'expected the transfer to fire with a rng roll well under the probability threshold');
  assert.deepEqual(world.getOrganisms().donor.genome, donorGenomeBefore, 'donor must be unaffected -- HGT copies, does not exchange');
  assert.equal(world.getOrganisms().recipient.genome[transfer.trait], transfer.value);
});

test('attemptHorizontalTransfer: never fires between non-adjacent organisms, even at maximum probability roll', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'donor', 'seed_donor', 'amoeba', { maturitySize: 3 }, [0, 0, 0], 0);
  plantOrganism(world, 'far', 'seed_far', 'amoeba', { maturitySize: 3 }, [500, 0, 0], 0);
  growToMaturity(world, 'donor');
  growToMaturity(world, 'far');
  assert.equal(attemptHorizontalTransfer(world, 'donor', 'far', () => 0), null);
});

test('offspring produced via reproduceAsexual/reproduceSexual still grow into fully coherent (non-overlapping) structures', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'parent', 'seed_parent', 'plant', { growthRate: 1, branchingAngle: 0.9, maturitySize: 10, mutationRate: 1 }, [0, 0, 0], 0);
  const { organism } = reproduceAsexual(world, 'parent', 'child', 'seed_child', [50, 0, 0], 1000, () => 0.7);

  const coherence = verifyGenomeCoherence(organism.genome, 'plant', 13);
  assert.ok(coherence.coherent, `mutated offspring genome produced a real overlap: ${JSON.stringify(organism.genome)}`);
});

// ============================================================
// Stage 3 -- Environmental Selection & Genetic Drift
// ============================================================

test('localResourceAvailability: 0 with no nearby water, ramps to 1 as real water cells are added within the search radius', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  assert.equal(localResourceAvailability(world, [0, 0, 0]), 0);

  // Step size 1 (not 2): farthest cell here (i=5) is at real distance
  // 5*sqrt(2) ~= 7.07, comfortably inside RESOURCE_SEARCH_RADIUS (10) --
  // a step of 2 put the last couple of cells outside the radius entirely,
  // caught by this test itself failing rather than assumed safe.
  for (let i = 0; i < 3; i++) world.addCell(i, i, 0, { material: 'water' });
  const partial = localResourceAvailability(world, [0, 0, 0]);
  assert.ok(partial > 0 && partial < 1, `expected partial availability, got ${partial}`);

  for (let i = 3; i < 6; i++) world.addCell(i, i, 0, { material: 'water' });
  assert.equal(localResourceAvailability(world, [0, 0, 0]), 1);
});

test('localResourceAvailability: water far outside RESOURCE_SEARCH_RADIUS does not count', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(RESOURCE_SEARCH_RADIUS * 10, 0, 0, { material: 'water' });
  assert.equal(localResourceAvailability(world, [0, 0, 0]), 0);
});

test('computeSurvivalProbability: under scarcity, higher resourceEfficiency genuinely survives better; under abundance, genome barely matters', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'efficient', 'seed_eff', 'plant', { resourceEfficiency: 0.95 }, [0, 0, 0], 0);
  plantOrganism(world, 'wasteful', 'seed_waste', 'plant', { resourceEfficiency: 0.05 }, [500, 0, 0], 0); // far apart -- no crowding interaction between them

  // Scarcity: zero local water for either.
  const scarceEfficient = computeSurvivalProbability(world, 'efficient', ['efficient']);
  const scarceWasteful = computeSurvivalProbability(world, 'wasteful', ['wasteful']);
  assert.ok(scarceEfficient > scarceWasteful, `expected efficient genome to survive scarcity better: ${scarceEfficient} vs ${scarceWasteful}`);

  // Abundance: flood both neighborhoods with water (step size 1, same
  // real-distance grounding fix as the localResourceAvailability test
  // above -- 5*sqrt(2) ~= 7.07 stays inside RESOURCE_SEARCH_RADIUS).
  for (let i = 0; i < 6; i++) {
    world.addCell(i, i, 0, { material: 'water' });
    world.addCell(500 + i, i, 0, { material: 'water' });
  }
  const abundantEfficient = computeSurvivalProbability(world, 'efficient', ['efficient']);
  const abundantWasteful = computeSurvivalProbability(world, 'wasteful', ['wasteful']);
  assert.ok(Math.abs(abundantEfficient - abundantWasteful) < 0.01, `expected genome to barely matter under abundance: ${abundantEfficient} vs ${abundantWasteful}`);
  assert.equal(abundantEfficient, 1);
});

test('computeSurvivalProbability: crowding above CROWDING_THRESHOLD penalizes uniformly, independent of genome', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // A tight cluster of same-species mature plants, all within pairing range of each other.
  const ids = [];
  for (let i = 0; i < CROWDING_THRESHOLD + 3; i++) {
    const id = `plant_${i}`;
    plantOrganism(world, id, `seed_${i}`, 'plant', { maturitySize: 3, resourceEfficiency: 1 }, [i * 0.3, 0, 0], 0);
    growToMaturity(world, id);
    ids.push(id);
  }
  const crowded = computeSurvivalProbability(world, ids[0], ids);

  const world2 = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world2, 'lone', 'seed_lone', 'plant', { maturitySize: 3, resourceEfficiency: 1 }, [0, 0, 0], 0);
  growToMaturity(world2, 'lone');
  const uncrowded = computeSurvivalProbability(world2, 'lone', ['lone']);

  assert.ok(crowded < uncrowded, `expected crowding to reduce survival probability: ${crowded} vs ${uncrowded}`);
});

test('resolveSurvival: at/below MIN_VIABLE_POPULATION, survival is unconditional regardless of fitness or rng (the extinction floor)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'last', 'seed_last', 'plant', { resourceEfficiency: 0 }, [0, 0, 0], 0); // worst possible fitness
  // rng always returns 0.999 -- would fail almost any real probability check.
  assert.equal(MIN_VIABLE_POPULATION >= 1, true);
  const candidateIds = ['last']; // local population of 1, well under MIN_VIABLE_POPULATION
  assert.equal(resolveSurvival(world, 'last', candidateIds, () => 0.999), true);
});

test('resolveSurvival: above DRIFT_THRESHOLD, outcome tracks real fitness exactly (no drift blending)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // Local population counting (resolveSurvival/crowding) is gated on
  // isMature -- these need to actually finish growing, and clustered
  // close enough to count as the same local neighborhood.
  const ids = [];
  for (let i = 0; i < DRIFT_THRESHOLD + 2; i++) {
    const id = `p${i}`;
    plantOrganism(world, id, `s${i}`, 'plant', { resourceEfficiency: 1, maturitySize: 3 }, [i * 0.3, 0, 0], 0);
    growToMaturity(world, id);
    ids.push(id);
  }
  // Above DRIFT_THRESHOLD means zero drift bypass -- confirm the decision
  // boundary is EXACTLY the real computed fitness value (whatever it is,
  // crowding included), not blended toward 0.5 at all.
  const fitness = computeSurvivalProbability(world, ids[0], ids);
  assert.equal(resolveSurvival(world, ids[0], ids, () => fitness - 0.01), true);
  assert.equal(resolveSurvival(world, ids[0], ids, () => fitness + 0.01), false);
});

test('resolveSurvival: below DRIFT_THRESHOLD (but above MIN_VIABLE_POPULATION), outcome blends toward pure chance regardless of genome', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // Local population of 3 (all mature, clustered) -- below DRIFT_THRESHOLD
  // (5), above MIN_VIABLE_POPULATION (2), and below CROWDING_THRESHOLD's
  // own neighbor count (2 neighbors each, not > 3), so crowding doesn't
  // also confound this specifically-drift-focused check.
  plantOrganism(world, 'a', 'sa', 'plant', { resourceEfficiency: 0, maturitySize: 3 }, [0, 0, 0], 0); // worst possible fitness
  plantOrganism(world, 'b', 'sb', 'plant', { maturitySize: 3 }, [0.3, 0, 0], 0);
  plantOrganism(world, 'c', 'sc', 'plant', { maturitySize: 3 }, [0.6, 0, 0], 0);
  const ids = ['a', 'b', 'c'];
  for (const id of ids) growToMaturity(world, id);

  const fitness = computeSurvivalProbability(world, 'a', ids);
  assert.equal(fitness, 0, 'expected pure fitness (no drift) to be exactly 0 for this genome/environment');

  // Pure fitness (no drift) would give this organism survival probability
  // 0. With drift partially bypassing fitness at this population size, a
  // low-but-not-zero rng roll should now sometimes succeed.
  let successes = 0;
  const trials = 200;
  for (let i = 0; i < trials; i++) {
    const r = i / trials;
    if (resolveSurvival(world, 'a', ids, () => r)) successes++;
  }
  assert.ok(successes > 0, 'expected drift to give a worst-fitness organism SOME chance of survival below DRIFT_THRESHOLD');
  assert.ok(successes < trials, 'expected drift to still be a BLEND, not guaranteed survival');
});
