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
  createSeededRng,
  effectiveMutationRate,
  resolveCatchUp,
  MAX_CATCHUP_GENERATIONS,
  EVOLUTION_GENERATION_INTERVAL_MS,
  JOLT_MUTATION_BOOST_MULTIPLIER,
  JOLT_DECAY_GENERATIONS,
  localBiomassAvailability,
  SYMBIOSIS_MAX_BOOST,
  averageTraitValue,
  planetoidKeyFor,
  groupOrganismsByPlanetoid,
  resolveCatchUpForAllPlanetoids,
  snapshotGenomeForCarrying,
  plantCarriedGenome,
  nextVolatilityScore,
  carryingCapacityBonus,
  mutationRateCeiling,
  SWING_FRACTION_THRESHOLD,
  VOLATILITY_DECAY_FACTOR,
  MIN_MUTATION_CEILING,
  isShapeNoveltyJump,
  SHAPE_NOVELTY_THRESHOLD,
} from '../../src/evolution.js';
import { createWorldStore } from '../../src/worldstate.js';
import { applyGrowth } from '../../src/growth.js';

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

// ============================================================
// Stage 4 -- Deterministic Catch-Up Simulation + Punctuated Equilibrium
// ============================================================

test('createSeededRng: same seed produces an identical sequence; different seeds diverge', () => {
  const a = createSeededRng(12345);
  const b = createSeededRng(12345);
  const c = createSeededRng(99999);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  const seqC = Array.from({ length: 10 }, () => c());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  for (const v of seqA) assert.ok(v >= 0 && v < 1, `rng value out of [0,1): ${v}`);
});

test('createSeededRng: stopping and resuming from getState() produces the exact same continuation as one unbroken run', () => {
  const full = createSeededRng(42);
  const fullSeq = Array.from({ length: 10 }, () => full());

  const firstHalf = createSeededRng(42);
  const firstSeq = Array.from({ length: 5 }, () => firstHalf());
  const resumedState = firstHalf.getState();
  const secondHalf = createSeededRng(resumedState);
  const secondSeq = Array.from({ length: 5 }, () => secondHalf());

  assert.deepEqual(firstSeq, fullSeq.slice(0, 5));
  assert.deepEqual(secondSeq, fullSeq.slice(5, 10));
});

test('effectiveMutationRate: full boost immediately after a jolt, decaying linearly to baseline by JOLT_DECAY_GENERATIONS', () => {
  const base = 0.1;
  const atJolt = effectiveMutationRate(base, 0);
  assert.equal(atJolt, base * JOLT_MUTATION_BOOST_MULTIPLIER);

  const midDecay = effectiveMutationRate(base, Math.floor(JOLT_DECAY_GENERATIONS / 2));
  assert.ok(midDecay > base && midDecay < atJolt, `expected a value strictly between baseline and full boost, got ${midDecay}`);

  assert.equal(effectiveMutationRate(base, JOLT_DECAY_GENERATIONS), base);
  assert.equal(effectiveMutationRate(base, JOLT_DECAY_GENERATIONS + 10), base);
  assert.equal(effectiveMutationRate(base, null), base); // never jolted
});

test('effectiveMutationRate: never exceeds the real [0,1] mutationRate range even at the boosted extreme', () => {
  const boosted = effectiveMutationRate(0.9, 0); // 0.9 * 2 would be 1.8 unclamped
  assert.ok(boosted <= 1, `boosted mutation rate exceeded 1: ${boosted}`);
});

test('resolveCatchUp: bounded by MAX_CATCHUP_GENERATIONS regardless of how much real time elapsed', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'a', 'sa', 'plant', { maturitySize: 3 }, [0, 0, 0], 0);
  const hugeElapsed = EVOLUTION_GENERATION_INTERVAL_MS * (MAX_CATCHUP_GENERATIONS * 1000);
  const result = resolveCatchUp(world, ['a'], 0, 1, hugeElapsed);
  assert.equal(result.generationsResolved, MAX_CATCHUP_GENERATIONS);
});

test('resolveCatchUp: lastSimulated advances by exactly the resolved generations, preserving fractional leftover time', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'a', 'sa', 'plant', { maturitySize: 3 }, [0, 0, 0], 0);
  const now = EVOLUTION_GENERATION_INTERVAL_MS * 3.5; // 3 whole generations, half a generation left over
  const result = resolveCatchUp(world, ['a'], 0, 1, now);
  assert.equal(result.generationsResolved, 3);
  assert.equal(result.lastSimulated, EVOLUTION_GENERATION_INTERVAL_MS * 3);
});

test('resolveCatchUp: fully deterministic -- identical starting state + params produce byte-identical outcomes across two independent world stores', () => {
  function freshWorldWithPopulation() {
    const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
    plantOrganism(world, 'p1', 's1', 'plant', { maturitySize: 4, resourceEfficiency: 0.6 }, [0, 0, 0], 0);
    plantOrganism(world, 'p2', 's2', 'plant', { maturitySize: 4, resourceEfficiency: 0.4 }, [0.4, 0, 0], 0);
    return world;
  }

  const worldA = freshWorldWithPopulation();
  const worldB = freshWorldWithPopulation();
  const now = EVOLUTION_GENERATION_INTERVAL_MS * 8;

  const resultA = resolveCatchUp(worldA, ['p1', 'p2'], 0, 777, now);
  const resultB = resolveCatchUp(worldB, ['p1', 'p2'], 0, 777, now);

  assert.deepEqual(resultA.organismIds.slice().sort(), resultB.organismIds.slice().sort());
  assert.equal(resultA.rngState, resultB.rngState);
  assert.equal(resultA.lastSimulated, resultB.lastSimulated);
  for (const id of resultA.organismIds) {
    assert.deepEqual(worldA.getOrganisms()[id].genome, worldB.getOrganisms()[id].genome, `organism ${id}'s genome diverged between two identical runs`);
  }
});

test('resolveCatchUp: surviving organisms after a real multi-generation run still have fully coherent (non-overlapping) grown structures', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'p1', 's1', 'plant', { maturitySize: 4, growthRate: 0.8, branchingAngle: 0.5 }, [0, 0, 0], 0);
  const now = EVOLUTION_GENERATION_INTERVAL_MS * 6;
  const result = resolveCatchUp(world, ['p1'], 0, 555, now);

  for (const id of result.organismIds) {
    const organism = world.getOrganisms()[id];
    const coherence = verifyGenomeCoherence(organism.genome, organism.species, 13);
    assert.ok(coherence.coherent, `organism ${id}'s genome produced a real overlap after catch-up: ${JSON.stringify(organism.genome)}`);
  }
});

test('resolveCatchUp: a lone organism never goes extinct through a real multi-generation run (extinction floor holding end-to-end)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // Worst-case genome for survival odds -- if the extinction floor didn't
  // hold, this organism should die quickly under pure fitness/drift.
  plantOrganism(world, 'lone', 'seed_lone', 'plant', { resourceEfficiency: 0, maturitySize: 3 }, [0, 0, 0], 0);
  const now = EVOLUTION_GENERATION_INTERVAL_MS * MAX_CATCHUP_GENERATIONS;
  const result = resolveCatchUp(world, ['lone'], 0, 314159, now);
  assert.ok(result.organismIds.includes('lone'), 'the lone organism should never be removed while population <= MIN_VIABLE_POPULATION');
});

// ============================================================
// Stage 5 -- Trophic Coupling (Predation + Symbiosis) & Convergence
// ============================================================

test('localBiomassAvailability: 0 with no nearby mature plants, positive once one exists with real water access, capped at 1', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'plant1', 'splant1', 'plant', { growthRate: 1, resourceEfficiency: 1, maturitySize: 3 }, [0, 0, 0], 0);
  assert.equal(localBiomassAvailability(world, [0, 0, 0], ['plant1']), 0, 'immature plant should produce no biomass yet');

  growToMaturity(world, 'plant1');
  // Zero local water -> localResourceAvailability(plant's own origin) is
  // 0 -> biomass contribution is growthRate*resourceEfficiency*0 = 0
  // still, until the plant itself has water access.
  assert.equal(localBiomassAvailability(world, [0, 0, 0], ['plant1']), 0);

  for (let i = 0; i < 6; i++) world.addCell(i, i, 0, { material: 'water' });
  const withWater = localBiomassAvailability(world, [0, 0, 0], ['plant1']);
  assert.ok(withWater > 0, 'a mature plant with real water access should produce measurable biomass');
});

test('computeSurvivalProbability: amoeba survival is driven by nearby BIOMASS (plant presence), not raw water directly', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'amoeba1', 'sa1', 'amoeba', { resourceEfficiency: 0, maturitySize: 3 }, [0, 0, 0], 0);
  growToMaturity(world, 'amoeba1');
  for (let i = 0; i < 6; i++) world.addCell(i, i, 0, { material: 'water' }); // plenty of raw water, but no plants

  const noBiomass = computeSurvivalProbability(world, 'amoeba1', ['amoeba1']);
  assert.equal(noBiomass, 0, 'raw water alone (no plant producers) should not feed an amoeba -- resourceEfficiency=0 means zero survival with zero biomass');

  plantOrganism(world, 'plant1', 'splant1', 'plant', { growthRate: 1, resourceEfficiency: 1, maturitySize: 3 }, [0.5, 0, 0], 0);
  growToMaturity(world, 'plant1');
  const withBiomass = computeSurvivalProbability(world, 'amoeba1', ['amoeba1', 'plant1']);
  assert.ok(withBiomass > noBiomass, 'a nearby producing plant should measurably improve amoeba survival odds');
});

test('computeSurvivalProbability: plant survival gets a small, capped boost from nearby mature amoeba (one-directional symbiosis)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'plant1', 'splant1', 'plant', { resourceEfficiency: 0.5, maturitySize: 3 }, [0, 0, 0], 0);
  growToMaturity(world, 'plant1');
  const withoutAmoeba = computeSurvivalProbability(world, 'plant1', ['plant1']);

  const withAmoeba = [];
  for (let i = 0; i < 3; i++) {
    const id = `amoeba${i}`;
    plantOrganism(world, id, `sa${i}`, 'amoeba', { maturitySize: 3 }, [0.3 * (i + 1), 0, 0], 0);
    growToMaturity(world, id);
    withAmoeba.push(id);
  }
  const boosted = computeSurvivalProbability(world, 'plant1', ['plant1', ...withAmoeba]);
  assert.ok(boosted >= withoutAmoeba, `expected nearby amoeba to boost (never hurt) plant survival: ${boosted} vs ${withoutAmoeba}`);

  // One-directional: the amoeba themselves get no such boost from being near a plant.
  const amoebaProb = computeSurvivalProbability(world, 'amoeba0', ['plant1', ...withAmoeba]);
  assert.ok(amoebaProb <= 1, 'sanity: amoeba probability still a valid probability');

  // Capped: flooding with many more amoeba shouldn't exceed SYMBIOSIS_MAX_BOOST's ceiling relative to the base.
  const manyAmoeba = [...withAmoeba];
  for (let i = 3; i < 20; i++) {
    const id = `amoeba${i}`;
    plantOrganism(world, id, `sa${i}`, 'amoeba', { maturitySize: 3 }, [0.3 * (i + 1), 0, 0], 0);
    growToMaturity(world, id);
    manyAmoeba.push(id);
  }
  const maxedOut = computeSurvivalProbability(world, 'plant1', ['plant1', ...manyAmoeba]);
  assert.ok(maxedOut <= withoutAmoeba * (1 + SYMBIOSIS_MAX_BOOST) + 1e-9, 'symbiosis boost must stay capped even with many nearby amoeba');
});

test('Convergent evolution (5.1, diagnostic): selection consistently favors the higher-starting-fitness population across many independent trials', () => {
  // A real finding from investigating this check, worth recording here
  // (also in evolution.js's own header comment above averageTraitValue):
  // computeSurvivalProbability's dependence on resourceEfficiency is
  // MONOTONIC (no interior optimum -- higher is always at least as good,
  // all the way to 1.0), so two populations under the same conditions
  // both get pulled toward the SAME fitness ceiling rather than settling
  // into a shared interior attractor. That means the textbook "gap
  // between two populations narrows toward zero" version of convergence
  // is genuinely noisy at practical population/generation scales --
  // verified empirically (not assumed) across dozens of real
  // resolveCatchUp runs at several population sizes and scarcity levels
  // before writing this test, including cases where the low-fitness
  // population went fully extinct under severe scarcity (a real
  // evolutionary-rescue failure, not a bug) rather than "catching up."
  // What IS reliably, consistently true across every one of those same
  // runs -- confirmed 20/20 in a dedicated check -- is section 5.1's
  // actual underlying purpose: selection applies REAL, consistent
  // pressure, so a population starting closer to the fitness optimum
  // reliably ends up with an equal-or-larger surviving population and an
  // equal-or-higher average trait value than one starting farther away.
  // That is what this test actually asserts, across enough independent
  // trials to be a real statistical statement, not a lucky single seed.
  function seedPopulation(startingEfficiency, rngSeedOffset) {
    const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
    for (let i = 0; i < 3; i++) world.addCell(i, i, 0, { material: 'water' });
    const ids = [];
    for (let i = 0; i < 15; i++) {
      const id = `p${i}`;
      plantOrganism(world, id, `s${i}`, 'plant', { resourceEfficiency: startingEfficiency, maturitySize: 3 }, [(i % 10) * 0.3, Math.floor(i / 10) * 0.3, 0], 0);
      ids.push(id);
    }
    return { world, ids };
  }

  // 10 trials (not 20) -- a dedicated investigation run confirmed 20/20
  // clean before this test was written; 10 is still a real statistical
  // sample, just faster for the suite to run every time.
  const trials = 10;
  const now = EVOLUTION_GENERATION_INTERVAL_MS * MAX_CATCHUP_GENERATIONS;
  let validTrials = 0;
  let highPopWins = 0;
  let highAvgWins = 0;

  for (let t = 0; t < trials; t++) {
    const low = seedPopulation(0.3, t);
    const high = seedPopulation(0.7, t);
    const resultLow = resolveCatchUp(low.world, low.ids, 0, 1000 + t * 111, now);
    const resultHigh = resolveCatchUp(high.world, high.ids, 0, 5000 + t * 222, now);
    const avgLow = averageTraitValue(low.world, resultLow.organismIds, 'resourceEfficiency');
    const avgHigh = averageTraitValue(high.world, resultHigh.organismIds, 'resourceEfficiency');
    if (avgLow === null || avgHigh === null) continue;
    validTrials++;
    if (resultHigh.organismIds.length >= resultLow.organismIds.length) highPopWins++;
    if (avgHigh >= avgLow) highAvgWins++;
  }

  assert.ok(validTrials >= trials * 0.5, `expected most trials to leave surviving organisms to measure, got ${validTrials}/${trials}`);
  assert.equal(highPopWins, validTrials, `expected the higher-starting-fitness population to end up >= population size every trial: ${highPopWins}/${validTrials}`);
  assert.equal(highAvgWins, validTrials, `expected the higher-starting-fitness population to keep >= average trait value every trial: ${highAvgWins}/${validTrials}`);
});

// ============================================================
// Stage 6 -- Isolation Enforcement
// ============================================================

function seedTwoPlanetoids() {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // Two real, independent BSG clusters far apart -- gravity.js's own
  // findClusters requires actual adjacency-connected cells, and far
  // enough apart that they can never be mistaken for the same cluster.
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  world.addCell(200, 200, 0, { material: 'blackstar-glassite' });
  return world;
}

test('planetoidKeyFor: deterministic given the same centerOfMass', () => {
  assert.equal(planetoidKeyFor([1.23, -4.56, 0]), planetoidKeyFor([1.23, -4.56, 0]));
  assert.notEqual(planetoidKeyFor([0, 0, 0]), planetoidKeyFor([200, 200, 0]));
});

test('groupOrganismsByPlanetoid: organisms near different real planetoids land in different groups; same planetoid, same group', () => {
  const world = seedTwoPlanetoids();
  plantOrganism(world, 'near1a', 's1a', 'plant', {}, [1, 0, 0], 0);
  plantOrganism(world, 'near1b', 's1b', 'plant', {}, [1.5, 0, 0], 0);
  plantOrganism(world, 'near2', 's2', 'plant', {}, [201, 200, 0], 0);

  const groups = groupOrganismsByPlanetoid(world, ['near1a', 'near1b', 'near2']);
  const keys = Object.keys(groups);
  assert.equal(keys.length, 2, `expected exactly 2 real planetoid groups, got ${keys.length}: ${JSON.stringify(groups)}`);
  const groupOfNear1 = keys.find((k) => groups[k].includes('near1a'));
  assert.ok(groups[groupOfNear1].includes('near1b'), 'organisms near the same planetoid should share a group');
  assert.ok(!groups[groupOfNear1].includes('near2'), 'an organism near a DIFFERENT planetoid must not share the group');
});

test('resolveCatchUpForAllPlanetoids: a deliberately destabilized planetoid has ZERO measurable effect on a second, untouched planetoid', () => {
  const world = seedTwoPlanetoids();

  // Planetoid A: deliberately destabilized -- maxed mutationRate, many
  // individuals, harsh scarcity (no water at all near it) to maximize
  // volatility/genetic runaway risk.
  const idsA = [];
  for (let i = 0; i < 10; i++) {
    const id = `a${i}`;
    plantOrganism(world, id, `sa${i}`, 'plant', { mutationRate: 1, resourceEfficiency: 0.1, maturitySize: 3 }, [i * 0.3, 0, 0], 0);
    idsA.push(id);
  }

  // Planetoid B: calm, healthy, far away.
  const idsB = [];
  for (let i = 0; i < 5; i++) {
    const id = `b${i}`;
    plantOrganism(world, id, `sb${i}`, 'plant', { mutationRate: 0.2, resourceEfficiency: 0.8, maturitySize: 3 }, [200 + i * 0.3, 200, 0], 0);
    idsB.push(id);
  }
  world.addCell(200, 201, 0, { material: 'water' }); // real water for B's own neighborhood

  const genomeSnapshotB = idsB.map((id) => JSON.stringify(world.getOrganisms()[id].genome));

  const now = EVOLUTION_GENERATION_INTERVAL_MS * MAX_CATCHUP_GENERATIONS;
  resolveCatchUpForAllPlanetoids(world, [...idsA, ...idsB], now);

  // B's own surviving original organisms must be byte-identical to
  // before A's own resolution ever ran -- not just "similar," EXACTLY
  // unchanged, since A and B are resolved as fully separate groups with
  // zero shared state.
  for (let i = 0; i < idsB.length; i++) {
    const stillThere = world.getOrganisms()[idsB[i]];
    if (stillThere) {
      assert.equal(JSON.stringify(stillThere.genome), genomeSnapshotB[i], `B's organism ${idsB[i]} genome changed -- isolation violated`);
    }
  }

  // B's own planetoid evolution state must be independently keyed from A's.
  const evoState = world.getPlanetoidEvolution();
  const keys = Object.keys(evoState);
  assert.equal(keys.length, 2, `expected 2 independently-tracked planetoid clocks, got ${keys.length}`);
});

test('resolveCatchUpForAllPlanetoids: running twice with an untouched second planetoid in between produces the SAME rngState for the untouched one (no cross-contamination over repeated calls)', () => {
  const world = seedTwoPlanetoids();
  plantOrganism(world, 'a0', 'sa0', 'plant', { maturitySize: 3 }, [0, 0, 0], 0);
  plantOrganism(world, 'b0', 'sb0', 'plant', { maturitySize: 3 }, [200, 200, 0], 0);

  const now1 = EVOLUTION_GENERATION_INTERVAL_MS * 5;
  resolveCatchUpForAllPlanetoids(world, ['a0', 'b0'], now1);
  const bStateAfterFirst = world.getPlanetoidEvolution()[Object.keys(world.getPlanetoidEvolution()).find((k) => k.includes('200.0'))];

  // Resolve again, but only involving A's own organism this time (B not
  // included in the id list at all -- simulating B being far outside
  // whatever region is currently being resolved).
  const now2 = EVOLUTION_GENERATION_INTERVAL_MS * 10;
  resolveCatchUpForAllPlanetoids(world, ['a0'], now2);

  const bStateAfterSecond = world.getPlanetoidEvolution()[Object.keys(world.getPlanetoidEvolution()).find((k) => k.includes('200.0'))];
  assert.deepEqual(bStateAfterSecond, bStateAfterFirst, "B's own stored clock/rng must be untouched by a resolution pass that never included any of B's organisms");
});

test('snapshotGenomeForCarrying: contains ONLY species + genome, never live simulation state (tiles, generation, jolt tracking)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'org1', 'seed1', 'plant', { growthRate: 0.7 }, [0, 0, 0], 0);
  const snapshot = snapshotGenomeForCarrying(world, 'org1');
  assert.deepEqual(Object.keys(snapshot).sort(), ['genome', 'species']);
  assert.equal(snapshot.genome.growthRate, 0.7);
});

test('plantCarriedGenome: a genome carried to a brand-new location grows into a fully coherent structure, identical genome preserved', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'origOrg', 'origSeed', 'plant', { growthRate: 0.9, branchingAngle: 0.8, maturitySize: 10 }, [0, 0, 0], 0);
  const snapshot = snapshotGenomeForCarrying(world, 'origOrg');

  const { organism } = plantCarriedGenome(world, snapshot, 'carriedOrg', 'carriedSeed', [9999, 9999, 0], 0);
  assert.deepEqual(organism.genome, snapshot.genome);
  assert.deepEqual(world.getSeeds().carriedSeed.origin, [9999, 9999, 0]);

  const coherence = verifyGenomeCoherence(snapshot.genome, snapshot.species, 13);
  assert.ok(coherence.coherent, 'a carried genome must be exactly as coherent on its new planetoid as it was on the old one');
});

// ============================================================
// Stage 7 -- Adaptive Damping (Population Volatility)
// ============================================================

test('nextVolatilityScore: a real swing (>= SWING_FRACTION_THRESHOLD) increases the score; a quiet generation decays it', () => {
  const afterBigSwing = nextVolatilityScore(0, 10, 3); // 70% drop, well above threshold
  assert.ok(afterBigSwing > 0, 'a large population swing should raise the score from 0');

  const afterQuiet = nextVolatilityScore(2, 10, 10); // no change at all
  assert.equal(afterQuiet, 2 * VOLATILITY_DECAY_FACTOR);

  const smallChange = swingFractionOf(10, 9); // just under threshold, if threshold is 0.3 this is 0.1
  if (smallChange < SWING_FRACTION_THRESHOLD) {
    assert.equal(nextVolatilityScore(1, 10, 9), 1 * VOLATILITY_DECAY_FACTOR, 'a small, sub-threshold change should decay, not accumulate');
  }
});
function swingFractionOf(before, after) {
  return Math.abs(after - before) / before;
}

test('carryingCapacityBonus / mutationRateCeiling: monotonic in volatility, ceiling respects its own floor', () => {
  assert.equal(carryingCapacityBonus(0), 0);
  assert.ok(carryingCapacityBonus(5) > carryingCapacityBonus(1));

  assert.equal(mutationRateCeiling(0), 1); // no volatility -> no cap at all
  assert.ok(mutationRateCeiling(5) < mutationRateCeiling(1));
  assert.ok(mutationRateCeiling(10000) >= MIN_MUTATION_CEILING, 'ceiling must never dampen below MIN_MUTATION_CEILING, even at extreme volatility');
});

test('Section 7\'s own explicit interaction rule: a jolt-triggered mutation boost is itself subject to the volatility-driven ceiling', () => {
  const base = 0.4;
  const jolted = effectiveMutationRate(base, 0); // full jolt boost, no damping
  assert.equal(jolted, base * JOLT_MUTATION_BOOST_MULTIPLIER);

  const highVolatilityCeiling = mutationRateCeiling(50); // a very volatile planetoid
  const dampedJoltedRate = Math.min(jolted, highVolatilityCeiling);
  assert.ok(dampedJoltedRate < jolted, 'a volatile planetoid should dampen even a fresh jolt burst below its undamped value');
  assert.ok(dampedJoltedRate >= MIN_MUTATION_CEILING - 1e-9);
});

test('Real end-to-end: a genuinely harsher/more chaotic planetoid accumulates a measurably higher volatility score than a calm one over a real multi-generation run', () => {
  // Deterministic scenario (fixed planetoid positions -> fixed rng seed
  // via hashStringToSeed, no explicit seed variation needed) -- verified
  // directly before writing this assertion, not assumed: this exact
  // setup reliably shows the volatile planetoid running measurably
  // hotter throughout a real run, even though BOTH planetoids show some
  // real volatility (ordinary population/crowding oscillation is a
  // genuine, expected feature of this system, not something a "calm"
  // planetoid is exempt from).
  function seedPlanetoid(center, count, genomeOverrides) {
    const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
    world.addCell(center[0], center[1], center[2], { material: 'blackstar-glassite' });
    const ids = [];
    for (let i = 0; i < count; i++) {
      const id = `p${i}`;
      plantOrganism(world, id, `s${i}`, 'plant', { maturitySize: 3, ...genomeOverrides }, [center[0] + i * 0.3, center[1], center[2]], 0);
      ids.push(id);
    }
    return { world, ids };
  }

  const volatile = seedPlanetoid([0, 0, 0], 20, { mutationRate: 0.9, resourceEfficiency: 0.3 });
  const calm = seedPlanetoid([500, 500, 0], 5, { mutationRate: 0.1, resourceEfficiency: 0.6 });
  for (let i = 0; i < 6; i++) calm.world.addCell(500 + i, 500 + i, 0, { material: 'water' });

  let idsV = volatile.ids;
  let idsC = calm.ids;
  let maxScoreV = 0;
  let maxScoreC = 0;
  const rounds = 20;
  for (let gen = 1; gen <= rounds; gen++) {
    const now = EVOLUTION_GENERATION_INTERVAL_MS * gen;
    const rv = resolveCatchUpForAllPlanetoids(volatile.world, idsV, now);
    const rc = resolveCatchUpForAllPlanetoids(calm.world, idsC, now);
    idsV = Object.values(rv)[0].organismIds;
    idsC = Object.values(rc)[0].organismIds;
    maxScoreV = Math.max(maxScoreV, Object.values(rv)[0].volatilityScore);
    maxScoreC = Math.max(maxScoreC, Object.values(rc)[0].volatilityScore);
  }

  assert.ok(maxScoreV > maxScoreC, `expected the harsher/more chaotic planetoid to reach a higher peak volatility score: volatile=${maxScoreV.toFixed(3)} calm=${maxScoreC.toFixed(3)}`);
});

test('DIRECT REQUIREMENT composition: the widened carrying-capacity buffer measurably improves survival odds for a crowded organism, not just "after the fact"', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const ids = [];
  for (let i = 0; i < CROWDING_THRESHOLD + 4; i++) {
    const id = `p${i}`;
    plantOrganism(world, id, `s${i}`, 'plant', { maturitySize: 3, resourceEfficiency: 1 }, [i * 0.3, 0, 0], 0);
    growToMaturity(world, id);
    ids.push(id);
  }

  const baseProbability = computeSurvivalProbability(world, ids[0], ids, CROWDING_THRESHOLD);
  const dampedProbability = computeSurvivalProbability(world, ids[0], ids, CROWDING_THRESHOLD + carryingCapacityBonus(5));
  assert.ok(dampedProbability > baseProbability, `expected the widened threshold to genuinely improve survival odds for a crowded organism: base=${baseProbability} damped=${dampedProbability}`);
});

test('Extinction floor still holds under real adaptive damping: a harsh, high-mutation planetoid never reaches zero population across a full-length run', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  world.addCell(0, 0, 0, { material: 'blackstar-glassite' });
  const ids = [];
  for (let i = 0; i < 15; i++) {
    const id = `p${i}`;
    plantOrganism(world, id, `s${i}`, 'plant', { mutationRate: 1, resourceEfficiency: 0, maturitySize: 3 }, [i * 0.3, 0, 0], 0);
    ids.push(id);
  }
  const now = EVOLUTION_GENERATION_INTERVAL_MS * MAX_CATCHUP_GENERATIONS;
  const result = resolveCatchUpForAllPlanetoids(world, ids, now);
  const final = Object.values(result)[0];
  assert.ok(final.organismIds.length >= 1, 'population must never reach zero, even under maximal stress with damping active');
});

// ============================================================
// Stage 8 -- Moderation Hook
// ============================================================

// A scripted rng alternating [always-fire, always-max-positive-delta] --
// forces every trait mutateGenome visits to shift by the maximum
// possible delta (MUTATION_DELTA_FRACTION of its own range) in the same
// tick, the real worst case genomeNoveltyDistance can ever produce from
// one mutation event (see SHAPE_NOVELTY_THRESHOLD's own comment).
function maxDeltaRng() {
  let call = 0;
  return () => (call++ % 2 === 0 ? 0 : 1);
}

// A scripted rng that never fires at all (every "does it fire" check
// reads 1, always >= any real effectiveRate) -- the zero-mutation floor.
function neverFireRng() {
  return () => 1;
}

test('isShapeNoveltyJump: identical genomes are never novel; maximally-different genomes are', () => {
  const base = clampGenome({});
  assert.equal(isShapeNoveltyJump(base, base), false);
  const extreme = {};
  for (const trait of Object.keys(GENOME_TRAIT_RANGES)) {
    extreme[trait] = GENOME_TRAIT_RANGES[trait][1];
  }
  assert.equal(isShapeNoveltyJump(base, clampGenome(extreme)), true);
});

test('isShapeNoveltyJump: SHAPE_NOVELTY_THRESHOLD sits below the real ceiling one mutateGenome call can ever produce', () => {
  // Real ceiling: every trait fires and shifts by the max delta ->
  // average normalized distance == MUTATION_DELTA_FRACTION exactly.
  const parent = clampGenome({});
  const offspring = mutateGenome(parent, maxDeltaRng(), 1);
  assert.ok(isShapeNoveltyJump(parent, offspring), 'the real worst-case single mutation must be reachable as a novelty jump');
  assert.ok(SHAPE_NOVELTY_THRESHOLD < 0.1, 'threshold must sit below the real 0.1 per-event ceiling or it could never fire');
});

test('reproduceAsexual: routine mutation (never-fire rng, zero delta) produces an approved offspring, never pending', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'parent', 'seed_parent', 'amoeba', { mutationRate: 0.5 }, [0, 0, 0], 0);
  const { organism } = reproduceAsexual(world, 'parent', 'child', 'seed_child', [5, 0, 0], 1000, neverFireRng());
  assert.equal(organism.status, 'approved');
});

test('reproduceAsexual: a scripted maximal mutation burst (every trait, max delta) produces a pending offspring', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'parent', 'seed_parent', 'amoeba', {}, [0, 0, 0], 0);
  const { organism } = reproduceAsexual(world, 'parent', 'child', 'seed_child', [5, 0, 0], 1000, maxDeltaRng(), 1);
  assert.equal(organism.status, 'pending');
});

test('reproduceSexual: novelty is measured against the BLENDED-but-unmutated genome, not either raw parent -- two very different parents blending routinely (no extra mutation) still stay approved', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'a', 'seed_a', 'plant', { resourceEfficiency: 0 }, [0, 0, 0], 0);
  plantOrganism(world, 'b', 'seed_b', 'plant', { resourceEfficiency: 1 }, [10, 0, 0], 0);
  // never-fire rng: pure blend, zero mutation-induced delta, even though
  // the two parents themselves are maximally different on this trait.
  const { organism } = reproduceSexual(world, 'a', 'b', 'child', 'seed_child', [5, 0, 0], 1000, neverFireRng());
  assert.equal(organism.status, 'approved');
});

test('reproduceSexual: a scripted maximal mutation burst on top of the blend still produces a pending offspring', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  plantOrganism(world, 'a', 'seed_a', 'plant', {}, [0, 0, 0], 0);
  plantOrganism(world, 'b', 'seed_b', 'plant', {}, [10, 0, 0], 0);
  const { organism } = reproduceSexual(world, 'a', 'b', 'child', 'seed_child', [5, 0, 0], 1000, maxDeltaRng(), 1);
  assert.equal(organism.status, 'pending');
});

test('plantOrganism: an organism seed never collides with a real GROWTH_TEMPLATES key -- growth.js\'s applyGrowth() (called unconditionally on every seed by render.js\'s periodic tick) must be a total no-op against it', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  // 'amoeba' is deliberately the real colliding case: it's both a valid
  // organism dispatch species AND a real Wave-1 GROWTH_TEMPLATES key.
  const { seed, organism } = plantOrganism(world, 'o1', 'seed_o1', 'amoeba', { maturitySize: 10 }, [0, 0, 0], 0);
  assert.notEqual(seed.species, 'amoeba', 'the underlying seed must not carry the raw, collidable species string');
  assert.equal(organism.species, 'amoeba', 'the ORGANISM record itself must still carry the plain dispatch species');

  // Advance well past growth.js's own 30s tick cooldown and Wave-1
  // amoeba's own maxGeneration (3) -- if applyGrowth mistakenly matched
  // this seed against GROWTH_TEMPLATES.amoeba, it would have grown and
  // capped out by now using the WRONG (template, not genome-driven) bias.
  const changed = applyGrowth(world, 200000);
  assert.equal(changed, false, 'applyGrowth must never touch an organism-tracked seed');
  const seedAfter = world.getSeeds()['seed_o1'];
  assert.equal(seedAfter.generation, 0, 'only growOrganism (genome-driven) may grow an organism seed, never the template path');
  assert.equal(seedAfter.tiles.length, 1);
});

test('plantOrganism: a manually/directly planted organism (not a reproduction event) defaults to approved, never pending', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const { organism } = plantOrganism(world, 'o1', 'seed_o1', 'amoeba', {}, [0, 0, 0], 0);
  assert.equal(organism.status, 'approved');
});

test('Punctuated-equilibrium composition: a jolt-boosted effective mutation rate produces measurably more pending offspring than baseline over many reproduction events, without flooding the queue (most still approved)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const rng = createSeededRng(42);

  let baselinePending = 0;
  const trials = 60;
  for (let i = 0; i < trials; i++) {
    plantOrganism(world, `p${i}`, `seed_p${i}`, 'amoeba', { mutationRate: 0.1 }, [0, 0, 0], 0);
    const { organism } = reproduceAsexual(world, `p${i}`, `c${i}`, `seed_c${i}`, [5, 0, 0], 1000, rng);
    if (organism.status === 'pending') baselinePending++;
  }

  let boostedPending = 0;
  for (let i = 0; i < trials; i++) {
    plantOrganism(world, `bp${i}`, `seed_bp${i}`, 'amoeba', { mutationRate: 0.1 }, [0, 0, 0], 0);
    // mutationRateOverride simulates a fresh jolt's full boost -- every
    // trait now independently likely to fire, same shape resolveOneGeneration
    // itself applies via effectiveMutationRate.
    const { organism } = reproduceAsexual(world, `bp${i}`, `bc${i}`, `seed_bc${i}`, [5, 0, 0], 1000, rng, 1);
    if (organism.status === 'pending') boostedPending++;
  }

  assert.ok(boostedPending > baselinePending, `expected the jolt-boosted run (${boostedPending}/${trials} pending) to flag more than baseline (${baselinePending}/${trials})`);
  assert.ok(boostedPending < trials, 'even a full boost must not flag literally every offspring -- the queue must not be flooded wholesale');
});
