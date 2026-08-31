// RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md -- genome/phenotype, reproduction,
// selection, catch-up simulation, isolation, adaptive damping (Stages 1-8).
// This module imports growth.js, growth.js never imports this module.
// Full design rationale/history for every export below: docs/code-notes/game-systems/evolution.md
import { tileWorldVertices, tilesOverlap, GROWTH_TICK_MS } from '../geometry-extensions/growth.js';
import { cellToWorld } from '../core/lattice.js';
import { computePlanetoids, nearestPlanetoid } from '../geometry-extensions/gravity.js';
import { plantInstance, growInstance, phenotypeFromSliders } from '../core/instance.js';

export const GENOME_TRAIT_RANGES = {
  growthRate: [0, 1],
  branchingAngle: [0, 1],
  resourceEfficiency: [0, 1], // inert in Stage 1 -- wired up by Stage 3/5
  maturitySize: [3, 15],
  mutationRate: [0, 1], // inert in Stage 1 -- wired up by Stage 2
};

function clamp(value, [min, max]) {
  return Math.min(max, Math.max(min, value));
}

export function clampGenome(genome = {}) {
  const clamped = {};
  for (const [trait, range] of Object.entries(GENOME_TRAIT_RANGES)) {
    const raw = genome[trait];
    const mid = (range[0] + range[1]) / 2;
    clamped[trait] = clamp(typeof raw === 'number' && Number.isFinite(raw) ? raw : mid, range);
  }
  return clamped;
}

function branchingAngleToPreferType(branchingAngle) {
  if (branchingAngle < 1 / 3) return 'oblate';
  if (branchingAngle > 2 / 3) return 'acute';
  return null;
}

// The genome-driven half of the split: derive plain slider-style inputs
// from a genome, then hand off to core/instance.js's phenotypeFromSliders()
// for the actual (genome-free) math -- kept in sync with Rhombeometry
// mode's own Lab-panel sliders by construction, not by convention.
export function genomeToPhenotype(genome) {
  const g = clampGenome(genome);
  return phenotypeFromSliders({
    growthRate: g.growthRate,
    maturitySize: g.maturitySize,
    preferType: branchingAngleToPreferType(g.branchingAngle),
  });
}

// Namespaced species string on the underlying seed (organism:<species>) so it can
// never collide with a real GROWTH_TEMPLATES key -- see notes.md for the real bug this fixes.
export const ORGANISM_SEED_SPECIES_PREFIX = 'organism:';
export function plantOrganism(world, organismId, seedId, species, genome, origin, now = Date.now(), status = 'approved') {
  const clamped = clampGenome(genome);
  const seed = plantInstance({ species: `${ORGANISM_SEED_SPECIES_PREFIX}${species}`, origin, now });
  world.setSeed(seedId, seed);
  world.setOrganism(organismId, { genome: clamped, seedId, species, plantedAt: now, status });
  return { seed, organism: world.getOrganisms()[organismId] };
}

export function growOrganism(world, organismId, now = Date.now()) {
  const organism = world.getOrganisms()[organismId];
  if (!organism) return false;
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return false;
  const phenotype = genomeToPhenotype(organism.genome);
  const grew = growInstance(seed, now, phenotype);
  if (grew) world.setSeed(organism.seedId, seed);
  return grew;
}

// ============================================================
// Stage 2 -- Reproduction, Inheritance, HGT & Sexual Selection
// ============================================================

export function isMature(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  if (!organism) return false;
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return false;
  return seed.generation >= genomeToPhenotype(organism.genome).maxGeneration;
}

export function organismBoundingRadius(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  const seed = organism && world.getSeeds()[organism.seedId];
  if (!seed) return 0;
  // growth.js's growSeed caches this on the seed record after every real growth
  // tick -- reuse it when present (this was a real hot path, see notes.md).
  if (typeof seed.cachedBoundingRadius === 'number') return seed.cachedBoundingRadius;
  let maxDist = 0;
  for (const tile of seed.tiles) {
    for (const v of tileWorldVertices(seed, tile)) {
      const d = Math.hypot(v[0] - seed.origin[0], v[1] - seed.origin[1], v[2] - seed.origin[2]);
      if (d > maxDist) maxDist = d;
    }
  }
  return maxDist;
}

function organismDistance(world, idA, idB) {
  const seedA = world.getSeeds()[world.getOrganisms()[idA]?.seedId];
  const seedB = world.getSeeds()[world.getOrganisms()[idB]?.seedId];
  if (!seedA || !seedB) return Infinity;
  return Math.hypot(seedA.origin[0] - seedB.origin[0], seedA.origin[1] - seedB.origin[1], seedA.origin[2] - seedB.origin[2]);
}

export const HGT_ADJACENCY_MULTIPLIER = 1.2;
export function areAdjacent(world, idA, idB) {
  const dist = organismDistance(world, idA, idB);
  return dist <= (organismBoundingRadius(world, idA) + organismBoundingRadius(world, idB)) * HGT_ADJACENCY_MULTIPLIER;
}

export const PAIRING_RANGE_MULTIPLIER = 3;
export function isInPairingRange(world, idA, idB) {
  const dist = organismDistance(world, idA, idB);
  return dist <= (organismBoundingRadius(world, idA) + organismBoundingRadius(world, idB)) * PAIRING_RANGE_MULTIPLIER;
}

export const MUTATION_DELTA_FRACTION = 0.1;

export function mutateGenome(genome, rng = Math.random, mutationRateOverride = undefined) {
  const g = clampGenome(genome);
  const effectiveRate = mutationRateOverride ?? g.mutationRate;
  const mutated = { ...g };
  for (const [trait, range] of Object.entries(GENOME_TRAIT_RANGES)) {
    if (rng() < effectiveRate) {
      const width = range[1] - range[0];
      mutated[trait] = g[trait] + (rng() * 2 - 1) * width * MUTATION_DELTA_FRACTION;
    }
  }
  return clampGenome(mutated);
}

export function blendGenomes(genomeA, genomeB) {
  const a = clampGenome(genomeA);
  const b = clampGenome(genomeB);
  const blended = {};
  for (const trait of Object.keys(GENOME_TRAIT_RANGES)) {
    blended[trait] = (a[trait] + b[trait]) / 2;
  }
  return clampGenome(blended);
}

export const MATE_PREFERENCE_TRAIT = 'resourceEfficiency';
export function selectMate(world, candidateIds, preferredTrait = MATE_PREFERENCE_TRAIT, rng = Math.random) {
  if (candidateIds.length === 0) return null;
  const weights = candidateIds.map((id) => Math.max(0.01, world.getOrganisms()[id]?.genome[preferredTrait] ?? 0.01));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < candidateIds.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidateIds[i];
  }
  return candidateIds[candidateIds.length - 1];
}

// ============================================================
// Stage 8 -- Moderation Hook (ties to the existing Trust Zones pipeline)
// ============================================================
// Novelty measured against the PRE-mutation genome (parent's own genome for
// asexual, blended-but-unmutated for sexual) -- see notes.md for why.

function genomeNoveltyDistance(genomeA, genomeB) {
  const a = clampGenome(genomeA);
  const b = clampGenome(genomeB);
  let total = 0;
  let count = 0;
  for (const [trait, range] of Object.entries(GENOME_TRAIT_RANGES)) {
    const width = range[1] - range[0];
    total += Math.abs(a[trait] - b[trait]) / width;
    count++;
  }
  return total / count;
}

export const SHAPE_NOVELTY_THRESHOLD = 0.06; // tuned, see notes.md

export function isShapeNoveltyJump(preMutationGenome, offspringGenome, threshold = SHAPE_NOVELTY_THRESHOLD) {
  return genomeNoveltyDistance(preMutationGenome, offspringGenome) >= threshold;
}

export function reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random, mutationRateOverride = undefined) {
  const parent = world.getOrganisms()[parentOrganismId];
  if (!parent) return null;
  const offspringGenome = mutateGenome(parent.genome, rng, mutationRateOverride);
  const status = isShapeNoveltyJump(parent.genome, offspringGenome) ? 'pending' : 'approved';
  return plantOrganism(world, offspringOrganismId, offspringSeedId, parent.species, offspringGenome, offspringOrigin, now, status);
}

export function reproduceSexual(world, parentAId, parentBId, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random, mutationRateOverride = undefined) {
  const a = world.getOrganisms()[parentAId];
  const b = world.getOrganisms()[parentBId];
  if (!a || !b) return null;
  const blended = blendGenomes(a.genome, b.genome);
  const offspringGenome = mutateGenome(blended, rng, mutationRateOverride);
  const status = isShapeNoveltyJump(blended, offspringGenome) ? 'pending' : 'approved';
  return plantOrganism(world, offspringOrganismId, offspringSeedId, a.species, offspringGenome, offspringOrigin, now, status);
}

export function reproduce(world, species, parentOrganismId, candidateMateIds, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random, mutationRateOverride = undefined) {
  if (species === 'plant') {
    const matureCandidates = candidateMateIds.filter((id) => isMature(world, id) && isInPairingRange(world, parentOrganismId, id));
    if (matureCandidates.length > 0) {
      const mateId = selectMate(world, matureCandidates, MATE_PREFERENCE_TRAIT, rng);
      return { result: reproduceSexual(world, parentOrganismId, mateId, offspringOrganismId, offspringSeedId, offspringOrigin, now, rng, mutationRateOverride), mode: 'sexual', mateId };
    }
    return { result: reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now, rng, mutationRateOverride), mode: 'asexual-fallback' };
  }
  return { result: reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now, rng, mutationRateOverride), mode: 'asexual' };
}

export const HGT_PROBABILITY = 0.1;
export function attemptHorizontalTransfer(world, donorId, recipientId, rng = Math.random, probability = HGT_PROBABILITY) {
  if (!isMature(world, donorId) || !isMature(world, recipientId)) return null;
  if (!areAdjacent(world, donorId, recipientId)) return null;
  if (rng() >= probability) return null;
  const donor = world.getOrganisms()[donorId];
  const recipient = world.getOrganisms()[recipientId];
  const traits = Object.keys(GENOME_TRAIT_RANGES);
  const trait = traits[Math.floor(rng() * traits.length)];
  world.setOrganism(recipientId, { ...recipient, genome: clampGenome({ ...recipient.genome, [trait]: donor.genome[trait] }) });
  return { trait, value: donor.genome[trait] };
}

// Exported for the test suite; not used by any runtime code path.
export function verifyGenomeCoherence(genome, species, ticks) {
  const seeds = {};
  const organisms = {};
  const world = {
    getSeeds: () => seeds,
    setSeed: (id, s) => {
      seeds[id] = s;
    },
    getOrganisms: () => organisms,
    setOrganism: (id, o) => {
      organisms[id] = o;
    },
  };
  const organismId = 'verify';
  plantOrganism(world, organismId, organismId, species, genome, [0, 0, 0], 0);
  let now = 0;
  for (let i = 0; i < ticks; i++) {
    now += 30001; // just past GROWTH_TICK_MS
    growOrganism(world, organismId, now);
  }
  const seed = seeds[organismId];
  const allVerts = seed.tiles.map((t) => tileWorldVertices(seed, t));
  for (let i = 0; i < allVerts.length; i++) {
    for (let j = i + 1; j < allVerts.length; j++) {
      if (tilesOverlap(allVerts[i], allVerts[j])) {
        return { coherent: false, tileCount: seed.tiles.length, overlapAt: [i, j] };
      }
    }
  }
  return { coherent: true, tileCount: seed.tiles.length, generation: seed.generation };
}

// ============================================================
// Stage 3 -- Environmental Selection & Genetic Drift
// ============================================================
// genome x local conditions -> survival/reproduction probability. Pure --
// nothing here mutates world state; the caller (Stage 4) decides what to do.

export const RESOURCE_SEARCH_RADIUS = 10;
export const RESOURCE_ABUNDANT_COUNT = 5;

function countLocalWaterCells(world, position) {
  let count = 0;
  for (const cell of world.entries()) {
    if (cell.material !== 'water') continue;
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    if (Math.hypot(wx - position[0], wy - position[1], wz - position[2]) <= RESOURCE_SEARCH_RADIUS) count++;
  }
  return count;
}

export function localResourceAvailability(world, position) {
  return Math.min(1, countLocalWaterCells(world, position) / RESOURCE_ABUNDANT_COUNT);
}

export const CROWDING_RANGE_MULTIPLIER = 3;
export const CROWDING_THRESHOLD = 3; // local mature same-species count above which crowding starts penalizing
export const CROWDING_PENALTY_PER_EXCESS = 0.15; // survival multiplier lost per organism above threshold

export function localMatureSameSpeciesCount(world, organismId, candidateIds) {
  const self = world.getOrganisms()[organismId];
  if (!self) return 0;
  let count = 0;
  for (const id of candidateIds) {
    if (id === organismId) continue;
    const other = world.getOrganisms()[id];
    if (!other || other.species !== self.species || !isMature(world, id)) continue;
    if (isInPairingRange(world, organismId, id)) count++; // same neighborhood radius as mate pairing, by design
  }
  return count;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

// ============================================================
// Stage 5 -- Trophic Coupling (Predation + Symbiosis)
// ============================================================

export const BIOMASS_SEARCH_RADIUS = RESOURCE_SEARCH_RADIUS;
export const BIOMASS_ABUNDANT_OUTPUT = 2;

export function localBiomassAvailability(world, position, candidateIds) {
  let total = 0;
  for (const id of candidateIds) {
    const organism = world.getOrganisms()[id];
    if (!organism || organism.species !== 'plant' || !isMature(world, id)) continue;
    const seed = world.getSeeds()[organism.seedId];
    if (!seed) continue;
    const dist = Math.hypot(seed.origin[0] - position[0], seed.origin[1] - position[1], seed.origin[2] - position[2]);
    if (dist > BIOMASS_SEARCH_RADIUS) continue;
    total += organism.genome.growthRate * organism.genome.resourceEfficiency * localResourceAvailability(world, seed.origin);
  }
  return Math.min(1, total / BIOMASS_ABUNDANT_OUTPUT);
}

export const SYMBIOSIS_BOOST_PER_AMOEBA = 0.05;
export const SYMBIOSIS_MAX_BOOST = 0.3;

function nearbyMatureAmoebaCount(world, plantOrganismId, candidateIds) {
  let count = 0;
  for (const id of candidateIds) {
    if (id === plantOrganismId) continue;
    const other = world.getOrganisms()[id];
    if (!other || other.species !== 'amoeba' || !isMature(world, id)) continue;
    if (isInPairingRange(world, plantOrganismId, id)) count++;
  }
  return count;
}

function computeSymbiosisFactor(world, plantOrganismId, candidateIds) {
  return 1 + Math.min(SYMBIOSIS_MAX_BOOST, nearbyMatureAmoebaCount(world, plantOrganismId, candidateIds) * SYMBIOSIS_BOOST_PER_AMOEBA);
}

export function computeSurvivalProbability(world, organismId, candidateIds, crowdingThreshold = CROWDING_THRESHOLD) {
  const organism = world.getOrganisms()[organismId];
  const seed = organism && world.getSeeds()[organism.seedId];
  if (!organism || !seed) return 0;

  const availability =
    organism.species === 'amoeba' ? localBiomassAvailability(world, seed.origin, candidateIds) : localResourceAvailability(world, seed.origin);
  const scarcityFactor = availability + (1 - availability) * organism.genome.resourceEfficiency;

  const crowd = localMatureSameSpeciesCount(world, organismId, candidateIds);
  const crowdingFactor = crowd > crowdingThreshold ? clamp01(1 - (crowd - crowdingThreshold) * CROWDING_PENALTY_PER_EXCESS) : 1;

  const symbiosisFactor = organism.species === 'plant' ? computeSymbiosisFactor(world, organismId, candidateIds) : 1;

  return clamp01(scarcityFactor * crowdingFactor * symbiosisFactor);
}

// Diagnostic, not a mechanic -- exported for the test suite, not used by any runtime code path.
export function averageTraitValue(world, organismIds, trait) {
  const values = organismIds.map((id) => world.getOrganisms()[id]?.genome[trait]).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export const DRIFT_THRESHOLD = 5; // tuned, see notes.md
export const MIN_VIABLE_POPULATION = 2; // 2, not 1: a lone sexual-species survivor can never pair again

function driftBypassFraction(localPopulation) {
  if (localPopulation >= DRIFT_THRESHOLD) return 0;
  return (DRIFT_THRESHOLD - localPopulation) / DRIFT_THRESHOLD;
}

export function resolveSurvival(
  world,
  organismId,
  candidateIds,
  rng = Math.random,
  crowdingThreshold = CROWDING_THRESHOLD,
  survivalProbabilityFn = computeSurvivalProbability
) {
  const localPopulation = localMatureSameSpeciesCount(world, organismId, candidateIds) + 1; // +1 for the organism itself
  if (localPopulation <= MIN_VIABLE_POPULATION) return true; // extinction floor -- never resolved by chance or fitness below this

  const fitness = survivalProbabilityFn(world, organismId, candidateIds, crowdingThreshold);
  const bypass = driftBypassFraction(localPopulation);
  const effectiveProbability = fitness * (1 - bypass) + 0.5 * bypass;
  return rng() < effectiveProbability;
}

// ============================================================
// Stage 4 -- Deterministic Catch-Up Simulation + Punctuated Equilibrium
// ============================================================

// mulberry32 (public domain) -- deterministic, reproducible randomness from a stored seed.
export function createSeededRng(seedState) {
  let s = seedState >>> 0;
  const rng = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.getState = () => s >>> 0;
  return rng;
}

export const EVOLUTION_GENERATION_INTERVAL_MS = GROWTH_TICK_MS;
export const MAX_CATCHUP_GENERATIONS = 50; // tunable, see notes.md
export const MAX_ORGANISMS_PER_PLANETOID = 100; // real cap, see notes.md for the live-found hang/crash this closes

export const JOLT_MUTATION_BOOST_MULTIPLIER = 2;
export const JOLT_DECAY_GENERATIONS = 5;

export const JOLT_AVAILABILITY_DELTA_THRESHOLD = 0.3;
export const JOLT_CROWD_DELTA_THRESHOLD = 3;

function detectJolt(previous, current) {
  if (!previous) return false; // no prior reading yet -- nothing to compare against
  const availabilityDelta = Math.abs(current.availability - previous.availability);
  const crowdDelta = Math.abs(current.crowd - previous.crowd);
  return availabilityDelta >= JOLT_AVAILABILITY_DELTA_THRESHOLD || crowdDelta >= JOLT_CROWD_DELTA_THRESHOLD;
}

export function effectiveMutationRate(baseMutationRate, generationsSinceJolt) {
  if (generationsSinceJolt === null || generationsSinceJolt === undefined || generationsSinceJolt >= JOLT_DECAY_GENERATIONS) {
    return baseMutationRate;
  }
  const decayFraction = 1 - generationsSinceJolt / JOLT_DECAY_GENERATIONS;
  const boost = 1 + (JOLT_MUTATION_BOOST_MULTIPLIER - 1) * decayFraction;
  return clamp(baseMutationRate * boost, [0, 1]);
}

function localConditions(world, organismId, candidateIds) {
  const organism = world.getOrganisms()[organismId];
  const seed = organism && world.getSeeds()[organism.seedId];
  if (!organism || !seed) return null;
  return {
    availability: localResourceAvailability(world, seed.origin),
    crowd: localMatureSameSpeciesCount(world, organismId, candidateIds),
  };
}

function offspringPlacement(world, parentOrganismId, rng) {
  const organism = world.getOrganisms()[parentOrganismId];
  const seed = world.getSeeds()[organism.seedId];
  const radius = organismBoundingRadius(world, parentOrganismId);
  const distance = radius * (1.5 + rng());
  const theta = rng() * Math.PI * 2;
  const phi = rng() * Math.PI;
  return [
    seed.origin[0] + distance * Math.sin(phi) * Math.cos(theta),
    seed.origin[1] + distance * Math.sin(phi) * Math.sin(theta),
    seed.origin[2] + distance * Math.cos(phi),
  ];
}

function resolveOneGeneration(
  world,
  organismIds,
  rng,
  generationIndex,
  simulatedNow,
  dampingParams = { crowdingThreshold: CROWDING_THRESHOLD, mutationCeiling: 1 },
  onGenerationStep = null,
  reproduceFn = reproduce,
  survivalProbabilityFn = computeSurvivalProbability
) {
  const toRemove = new Set();
  const newIds = [];
  let idCounter = 0;

  for (const organismId of organismIds) {
    const organism = world.getOrganisms()[organismId];
    if (!organism) continue;

    onGenerationStep?.(world, organismId, rng, generationIndex, simulatedNow, organismIds);

    // Physical growth kept in lockstep with catch-up resolution -- see notes.md
    // for the real multi-generation bug this closes (organisms never maturing).
    growOrganism(world, organismId, simulatedNow);

    const current = localConditions(world, organismId, organismIds);
    if (!current) continue;
    const jolted = detectJolt(organism.lastConditions, current);
    const generationsSinceJolt = jolted ? 0 : organism.generationsSinceJolt != null ? organism.generationsSinceJolt + 1 : null;
    const updatedOrganism = { ...organism, lastConditions: current, generationsSinceJolt };
    world.setOrganism(organismId, updatedOrganism);

    const mutRate = Math.min(effectiveMutationRate(updatedOrganism.genome.mutationRate, generationsSinceJolt), dampingParams.mutationCeiling);

    if (isMature(world, organismId)) {
      const reproProbability = survivalProbabilityFn(world, organismId, organismIds, dampingParams.crowdingThreshold);
      const belowPopulationCap = organismIds.length + newIds.length < MAX_ORGANISMS_PER_PLANETOID;
      if (rng() < reproProbability && belowPopulationCap) {
        const offspringId = `${organismId}_g${generationIndex}_${idCounter++}`;
        const offspringOrigin = offspringPlacement(world, organismId, rng);
        const mateCandidates = organismIds.filter((id) => id !== organismId);
        const { result } = reproduceFn(
          world,
          organism.species,
          organismId,
          mateCandidates,
          offspringId,
          `seed_${offspringId}`,
          offspringOrigin,
          simulatedNow,
          rng,
          mutRate
        );
        if (result) newIds.push(offspringId);
      }

      for (const otherId of organismIds) {
        if (otherId === organismId) continue;
        attemptHorizontalTransfer(world, organismId, otherId, rng);
      }
    }

    if (!resolveSurvival(world, organismId, organismIds, rng, dampingParams.crowdingThreshold, survivalProbabilityFn)) {
      toRemove.add(organismId);
    }
  }

  for (const id of toRemove) {
    const organism = world.getOrganisms()[id];
    if (organism) world.removeSeed(organism.seedId);
    world.removeOrganism(id);
  }

  // Re-checks world.getOrganisms() (not just this function's own toRemove set) so a
  // DIFFERENT removal (e.g. animals.js's onGenerationStep predation hook) is caught
  // too -- see notes.md for the real "zombie id" bug this closes.
  return organismIds.filter((id) => !toRemove.has(id) && world.getOrganisms()[id]).concat(newIds);
}

export function resolveCatchUp(
  world,
  organismIds,
  lastSimulated,
  rngState,
  now = Date.now(),
  initialVolatilityScore = 0,
  onGenerationStep = null,
  reproduceFn = reproduce,
  survivalProbabilityFn = computeSurvivalProbability
) {
  const elapsed = Math.max(0, now - lastSimulated);
  const generations = Math.min(Math.floor(elapsed / EVOLUTION_GENERATION_INTERVAL_MS), MAX_CATCHUP_GENERATIONS);
  const rng = createSeededRng(rngState);

  let currentIds = organismIds;
  let volatilityScore = initialVolatilityScore;
  for (let g = 0; g < generations; g++) {
    const simulatedNow = lastSimulated + (g + 1) * EVOLUTION_GENERATION_INTERVAL_MS;
    const beforeCount = currentIds.length;
    const dampingParams = {
      crowdingThreshold: CROWDING_THRESHOLD + carryingCapacityBonus(volatilityScore),
      mutationCeiling: mutationRateCeiling(volatilityScore),
    };
    currentIds = resolveOneGeneration(world, currentIds, rng, g, simulatedNow, dampingParams, onGenerationStep, reproduceFn, survivalProbabilityFn);
    volatilityScore = nextVolatilityScore(volatilityScore, beforeCount, currentIds.length);
  }

  return {
    organismIds: currentIds,
    rngState: rng.getState(),
    lastSimulated: lastSimulated + generations * EVOLUTION_GENERATION_INTERVAL_MS,
    generationsResolved: generations,
    volatilityScore,
  };
}

// ============================================================
// Stage 6 -- Isolation Enforcement
// ============================================================

function hashStringToSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function planetoidKeyFor(centerOfMass) {
  const [x, y, z] = centerOfMass;
  return `planetoid_${x.toFixed(1)}_${y.toFixed(1)}_${z.toFixed(1)}`;
}

export function groupOrganismsByPlanetoid(world, organismIds) {
  const planetoids = computePlanetoids(world);
  const groups = {};
  for (const organismId of organismIds) {
    const organism = world.getOrganisms()[organismId];
    const seed = organism && world.getSeeds()[organism.seedId];
    if (!organism || !seed) continue;
    const nearest = nearestPlanetoid({ x: seed.origin[0], y: seed.origin[1], z: seed.origin[2] }, planetoids);
    const key = nearest ? planetoidKeyFor(nearest.centerOfMass) : 'unowned';
    (groups[key] ??= []).push(organismId);
  }
  return groups;
}

export function resolveCatchUpForAllPlanetoids(
  world,
  organismIds,
  now = Date.now(),
  onGenerationStep = null,
  reproduceFn = reproduce,
  survivalProbabilityFn = computeSurvivalProbability
) {
  const groups = groupOrganismsByPlanetoid(world, organismIds);
  const planetoidsList = computePlanetoids(world);
  const results = {};
  for (const [planetoidKey, ids] of Object.entries(groups)) {
    const stored = world.getPlanetoidEvolution()[planetoidKey] ?? {
      lastSimulated: now,
      rngState: hashStringToSeed(planetoidKey),
      volatilityScore: 0,
      landscapeState: 0,
    };
    const result = resolveCatchUp(
      world,
      ids,
      stored.lastSimulated,
      stored.rngState,
      now,
      stored.volatilityScore ?? 0,
      onGenerationStep,
      reproduceFn,
      survivalProbabilityFn
    );
    // 'unowned' organisms have no real centerOfMass to evaluate biomass at.
    const planetoid = Object.values(planetoidsList).find((p) => planetoidKeyFor(p.centerOfMass) === planetoidKey);
    const targetBiomass = planetoid ? localBiomassAvailability(world, planetoid.centerOfMass, result.organismIds) : 0;
    const landscapeState = nextLandscapeState(stored.landscapeState ?? 0, targetBiomass, result.generationsResolved);
    world.setPlanetoidEvolution(planetoidKey, {
      lastSimulated: result.lastSimulated,
      rngState: result.rngState,
      volatilityScore: result.volatilityScore,
      landscapeState,
    });
    results[planetoidKey] = result;
  }
  return results;
}

export function snapshotGenomeForCarrying(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  if (!organism) return null;
  return { species: organism.species, genome: clampGenome(organism.genome) };
}

export function plantCarriedGenome(world, snapshot, organismId, seedId, origin, now = Date.now()) {
  return plantOrganism(world, organismId, seedId, snapshot.species, snapshot.genome, origin, now);
}

// ============================================================
// Stage 7 -- Adaptive Damping (Population Volatility)
// ============================================================

export const SWING_FRACTION_THRESHOLD = 0.3;
export const VOLATILITY_DECAY_FACTOR = 0.9;
export const CARRYING_CAPACITY_PER_VOLATILITY = 1;
export const MUTATION_CEILING_PER_VOLATILITY = 0.02;
export const MIN_MUTATION_CEILING = 0.3;

function swingMagnitude(beforeCount, afterCount) {
  if (beforeCount === 0) return 0;
  return Math.abs(afterCount - beforeCount) / beforeCount;
}

export function nextVolatilityScore(currentScore, beforeCount, afterCount) {
  const magnitude = swingMagnitude(beforeCount, afterCount);
  if (magnitude >= SWING_FRACTION_THRESHOLD) return currentScore + magnitude;
  return currentScore * VOLATILITY_DECAY_FACTOR;
}

export function carryingCapacityBonus(volatilityScore) {
  return volatilityScore * CARRYING_CAPACITY_PER_VOLATILITY;
}

export function mutationRateCeiling(volatilityScore) {
  return Math.max(MIN_MUTATION_CEILING, 1 - volatilityScore * MUTATION_CEILING_PER_VOLATILITY);
}

export const LANDSCAPE_STATE_EMA_RATE = 0.1;
export function nextLandscapeState(currentState, targetBiomass, generationsResolved) {
  const decay = Math.pow(1 - LANDSCAPE_STATE_EMA_RATE, generationsResolved);
  return targetBiomass + (currentState - targetBiomass) * decay;
}
