// RHOMBIVERSE_SPEC_ANIMALS.md Stage A -- Species Profiles & Habitat
// Placement. animals.js imports evolution.js, never the reverse.
// mobilityRange/huntBias live as SIBLING fields on the organism record,
// not inside genome (see docs/code-notes/world-systems/animals.md for why).
// Full design rationale/history for every export below:
// docs/code-notes/world-systems/animals.md
import {
  GENOME_TRAIT_RANGES,
  plantOrganism,
  RESOURCE_SEARCH_RADIUS,
  isMature,
  organismBoundingRadius,
  reproduce,
  reproduceSexual,
  MUTATION_DELTA_FRACTION,
  computeSurvivalProbability,
  localBiomassAvailability,
  CROWDING_THRESHOLD,
  CROWDING_PENALTY_PER_EXCESS,
  ORGANISM_SEED_SPECIES_PREFIX,
  localMatureSameSpeciesCount,
  BIOMASS_SEARCH_RADIUS,
} from './evolution.js';
import { cellToWorld } from '../core/lattice.js';

export const LAND_CREATURE_SPECIES = 'landCreature';
export const SEA_CREATURE_SPECIES = 'seaCreature';
export const ANIMAL_SPECIES = [LAND_CREATURE_SPECIES, SEA_CREATURE_SPECIES];

export const ANIMAL_TRAIT_RANGES = {
  mobilityRange: [1, 15],
  huntBias: [0, 1], // 0 = herbivore .. 1 = carnivore, continuous dial
};

function clamp(value, [min, max]) {
  return Math.min(max, Math.max(min, value));
}

export function clampAnimalTraits(traits = {}) {
  const clamped = {};
  for (const [trait, range] of Object.entries(ANIMAL_TRAIT_RANGES)) {
    const raw = traits[trait];
    const mid = (range[0] + range[1]) / 2;
    clamped[trait] = clamp(typeof raw === 'number' && Number.isFinite(raw) ? raw : mid, range);
  }
  return clamped;
}

export const HABITAT_SEARCH_RADIUS = RESOURCE_SEARCH_RADIUS;

function nearestCellWithinRadius(world, position, radius) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const cell of world.entries()) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    const d = Math.hypot(wx - position[0], wy - position[1], wz - position[2]);
    if (d <= radius && d < nearestDist) {
      nearestDist = d;
      nearest = cell;
    }
  }
  return nearest;
}

function isLiquidHabitatCell(cell) {
  return cell.material === 'water' && cell.hydrospherePermeated === true;
}

function isDryHabitatCell(cell) {
  return cell.material !== 'water';
}

export function isValidHabitat(world, species, position) {
  const nearest = nearestCellWithinRadius(world, position, HABITAT_SEARCH_RADIUS);
  if (species === SEA_CREATURE_SPECIES) return !!nearest && isLiquidHabitatCell(nearest);
  if (species === LAND_CREATURE_SPECIES) return !nearest || isDryHabitatCell(nearest);
  return true;
}

export function plantAnimal(world, organismId, seedId, species, genome, animalTraits, origin, now = Date.now()) {
  if (!ANIMAL_SPECIES.includes(species)) {
    throw new Error(`Unknown animal species: ${species}`);
  }
  if (!isValidHabitat(world, species, origin)) {
    throw new Error(`Invalid habitat for ${species} at [${origin.join(', ')}]`);
  }
  const result = plantOrganism(world, organismId, seedId, species, genome, origin, now);
  const clampedTraits = clampAnimalTraits(animalTraits);
  const updated = { ...world.getOrganisms()[organismId], ...clampedTraits };
  world.setOrganism(organismId, updated);
  return { ...result, organism: updated };
}

export function isAnimal(organism) {
  return !!organism && ANIMAL_SPECIES.includes(organism.species);
}

export { GENOME_TRAIT_RANGES };

// ============================================================
// Stage B -- Mobility (Abstracted, Not Live Physics)
// ============================================================
export const MAX_MOVE_ATTEMPTS = 8;

function randomCandidatePosition(origin, mobilityRange, rng) {
  const distance = rng() * mobilityRange;
  const theta = rng() * Math.PI * 2;
  const phi = rng() * Math.PI;
  return [
    origin[0] + distance * Math.sin(phi) * Math.cos(theta),
    origin[1] + distance * Math.sin(phi) * Math.sin(theta),
    origin[2] + distance * Math.cos(phi),
  ];
}

export function attemptMove(world, organismId, rng = Math.random) {
  const organism = world.getOrganisms()[organismId];
  if (!isAnimal(organism)) return false;
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return false;
  const mobilityRange = clampAnimalTraits(organism).mobilityRange;

  for (let attempt = 0; attempt < MAX_MOVE_ATTEMPTS; attempt++) {
    const candidate = randomCandidatePosition(seed.origin, mobilityRange, rng);
    if (isValidHabitat(world, organism.species, candidate)) {
      world.setSeed(organism.seedId, { ...seed, origin: candidate });
      return true;
    }
  }
  return false;
}

export function movementStepHook(world, organismId, rng) {
  attemptMove(world, organismId, rng);
}

// ============================================================
// Stage C -- Sexual Reproduction
// ============================================================
function isWithinMobilityRange(world, parentId, otherId) {
  const parent = world.getOrganisms()[parentId];
  const seedA = world.getSeeds()[parent.seedId];
  const seedB = world.getSeeds()[world.getOrganisms()[otherId]?.seedId];
  if (!seedA || !seedB) return false;
  const dist = Math.hypot(seedA.origin[0] - seedB.origin[0], seedA.origin[1] - seedB.origin[1], seedA.origin[2] - seedB.origin[2]);
  return dist <= clampAnimalTraits(parent).mobilityRange;
}

export function blendAnimalTraits(traitsA, traitsB) {
  const a = clampAnimalTraits(traitsA);
  const b = clampAnimalTraits(traitsB);
  const blended = {};
  for (const trait of Object.keys(ANIMAL_TRAIT_RANGES)) {
    blended[trait] = (a[trait] + b[trait]) / 2;
  }
  return clampAnimalTraits(blended);
}

export function mutateAnimalTraits(traits, mutationRate, rng = Math.random) {
  const t = clampAnimalTraits(traits);
  const mutated = { ...t };
  for (const [trait, range] of Object.entries(ANIMAL_TRAIT_RANGES)) {
    if (rng() < mutationRate) {
      const width = range[1] - range[0];
      mutated[trait] = t[trait] + (rng() * 2 - 1) * width * MUTATION_DELTA_FRACTION;
    }
  }
  return clampAnimalTraits(mutated);
}

function animalOffspringOrigin(world, parentAId, parentBId, species, rng) {
  const seedA = world.getSeeds()[world.getOrganisms()[parentAId].seedId];
  const seedB = world.getSeeds()[world.getOrganisms()[parentBId].seedId];
  const midpoint = [
    (seedA.origin[0] + seedB.origin[0]) / 2,
    (seedA.origin[1] + seedB.origin[1]) / 2,
    (seedA.origin[2] + seedB.origin[2]) / 2,
  ];
  const radius = Math.max(organismBoundingRadius(world, parentAId), organismBoundingRadius(world, parentBId)) * 1.5;
  for (let attempt = 0; attempt < MAX_MOVE_ATTEMPTS; attempt++) {
    const candidate = randomCandidatePosition(midpoint, radius, rng);
    if (isValidHabitat(world, species, candidate)) return candidate;
  }
  return midpoint;
}

export const MATE_PREFERENCE_TRAIT = 'huntBias';

function traitValue(organism, trait) {
  return organism[trait] !== undefined ? organism[trait] : organism.genome?.[trait];
}

function selectMateByTrait(world, candidateIds, preferredTrait, rng) {
  if (candidateIds.length === 0) return null;
  const weights = candidateIds.map((id) => Math.max(0.01, traitValue(world.getOrganisms()[id], preferredTrait) ?? 0.01));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < candidateIds.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidateIds[i];
  }
  return candidateIds[candidateIds.length - 1];
}

export function reproduceAnimal(world, parentOrganismId, offspringOrganismId, offspringSeedId, now = Date.now(), rng = Math.random, candidateIds = null, mutationRateOverride = undefined) {
  const parent = world.getOrganisms()[parentOrganismId];
  if (!isAnimal(parent)) return null;

  const pool = candidateIds ?? Object.keys(world.getOrganisms());
  const candidates = pool.filter((id) => {
    if (id === parentOrganismId) return false;
    const other = world.getOrganisms()[id];
    return other && other.species === parent.species && isMature(world, id) && isWithinMobilityRange(world, parentOrganismId, id);
  });
  if (candidates.length === 0) return { result: null, mode: 'no-mate-in-range' };

  const mateId = selectMateByTrait(world, candidates, MATE_PREFERENCE_TRAIT, rng);
  // Read before reproduction mutates any state.
  const parentAtBoundary = isAtHabitatBoundary(world, parentOrganismId);
  const origin = animalOffspringOrigin(world, parentOrganismId, mateId, parent.species, rng);
  const sexResult = reproduceSexual(world, parentOrganismId, mateId, offspringOrganismId, offspringSeedId, origin, now, rng, mutationRateOverride);
  if (!sexResult) return { result: null, mode: 'sexual-failed' };

  const mate = world.getOrganisms()[mateId];
  const blendedTraits = blendAnimalTraits(parent, mate);
  const offspringGenome = world.getOrganisms()[offspringOrganismId].genome;
  const mutatedTraits = mutateAnimalTraits(blendedTraits, mutationRateOverride ?? offspringGenome.mutationRate, rng);

  const boundaryGenerations = parentAtBoundary ? (parent.boundaryGenerations ?? 0) + 1 : 0;
  let mobilityRange = mutatedTraits.mobilityRange;
  if (parentAtBoundary) {
    const ceiling = ANIMAL_TRAIT_RANGES.mobilityRange[1];
    mobilityRange = clamp(mobilityRange + (ceiling - mobilityRange) * CROSSOVER_DIRECTED_NUDGE_FRACTION, ANIMAL_TRAIT_RANGES.mobilityRange);
  }

  const updated = { ...world.getOrganisms()[offspringOrganismId], ...mutatedTraits, mobilityRange, boundaryGenerations };
  world.setOrganism(offspringOrganismId, updated);

  const threshold =
    ANIMAL_TRAIT_RANGES.mobilityRange[0] +
    (ANIMAL_TRAIT_RANGES.mobilityRange[1] - ANIMAL_TRAIT_RANGES.mobilityRange[0]) * CROSSOVER_MOBILITY_THRESHOLD_FRACTION;
  if (boundaryGenerations >= CROSSOVER_MIN_BOUNDARY_GENERATIONS && mobilityRange >= threshold) {
    performCrossoverReclassification(world, offspringOrganismId, rng);
  }

  return { result: { seed: sexResult.seed, organism: world.getOrganisms()[offspringOrganismId] }, mode: 'sexual', mateId };
}

export function reproduceFn(world, species, parentOrganismId, candidateMateIds, offspringOrganismId, offspringSeedId, offspringOriginHint, now, rng, mutationRateOverride) {
  if (species !== LAND_CREATURE_SPECIES && species !== SEA_CREATURE_SPECIES) {
    return reproduce(world, species, parentOrganismId, candidateMateIds, offspringOrganismId, offspringSeedId, offspringOriginHint, now, rng, mutationRateOverride);
  }
  return reproduceAnimal(world, parentOrganismId, offspringOrganismId, offspringSeedId, now, rng, candidateMateIds, mutationRateOverride);
}

// ============================================================
// Stage D -- Trophic Tier Extension (Herbivory + Carnivory)
// ============================================================
export const PREY_ABUNDANT_COUNT = 3;
export const PREDATION_PROBABILITY = 0.3;

function isPreyOf(predator, candidate) {
  if (candidate.species === 'amoeba') return true;
  if (!isAnimal(candidate)) return false;
  return (candidate.huntBias ?? 0) < (predator.huntBias ?? 0);
}

function findPreyWithinRange(world, predatorId, candidateIds) {
  const predator = world.getOrganisms()[predatorId];
  const result = [];
  for (const id of candidateIds) {
    if (id === predatorId) continue;
    const other = world.getOrganisms()[id];
    if (!other || !isMature(world, id)) continue;
    if (isPreyOf(predator, other) && isWithinMobilityRange(world, predatorId, id)) result.push(id);
  }
  return result;
}

function localPreyAvailability(world, organismId, candidateIds) {
  return Math.min(1, findPreyWithinRange(world, organismId, candidateIds).length / PREY_ABUNDANT_COUNT);
}

function localSameSpeciesCountWithinMobilityRange(world, organismId, candidateIds) {
  const self = world.getOrganisms()[organismId];
  let count = 0;
  for (const id of candidateIds) {
    if (id === organismId) continue;
    const other = world.getOrganisms()[id];
    if (!other || other.species !== self.species || !isMature(world, id)) continue;
    if (isWithinMobilityRange(world, organismId, id)) count++;
  }
  return count;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

// ============================================================
// Stage F -- Real Amoeba/Herbivore Competitive Pressure
// ============================================================
export const HERBIVORE_COMPETITION_PENALTY_PER_PRESSURE = 0.15;
export const HERBIVORE_COMPETITION_HUNT_BIAS_CEILING = 0.7;

function nearbyHerbivoreCompetitionFactor(world, position, candidateIds) {
  let pressure = 0;
  for (const id of candidateIds) {
    const other = world.getOrganisms()[id];
    if (!other || !isAnimal(other) || !isMature(world, id)) continue;
    const huntBias = other.huntBias ?? 0.5;
    if (huntBias >= HERBIVORE_COMPETITION_HUNT_BIAS_CEILING) continue;
    const otherSeed = world.getSeeds()[other.seedId];
    if (!otherSeed) continue;
    const dist = Math.hypot(otherSeed.origin[0] - position[0], otherSeed.origin[1] - position[1], otherSeed.origin[2] - position[2]);
    if (dist > BIOMASS_SEARCH_RADIUS) continue;
    pressure += 1 - huntBias;
  }
  return clamp01(1 - pressure * HERBIVORE_COMPETITION_PENALTY_PER_PRESSURE);
}

function computeAmoebaSurvivalWithCompetition(world, organismId, candidateIds, crowdingThreshold) {
  const organism = world.getOrganisms()[organismId];
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return 0;
  const baseBiomass = localBiomassAvailability(world, seed.origin, candidateIds);
  const competitionFactor = nearbyHerbivoreCompetitionFactor(world, seed.origin, candidateIds);
  const availability = baseBiomass * competitionFactor;
  const scarcityFactor = availability + (1 - availability) * organism.genome.resourceEfficiency;
  const crowd = localMatureSameSpeciesCount(world, organismId, candidateIds);
  const crowdingFactor = crowd > crowdingThreshold ? clamp01(1 - (crowd - crowdingThreshold) * CROWDING_PENALTY_PER_EXCESS) : 1;
  return clamp01(scarcityFactor * crowdingFactor);
}

export function computeAnimalSurvivalProbability(world, organismId, candidateIds, crowdingThreshold = CROWDING_THRESHOLD) {
  const organism = world.getOrganisms()[organismId];
  if (organism?.species === 'amoeba') return computeAmoebaSurvivalWithCompetition(world, organismId, candidateIds, crowdingThreshold);
  if (!isAnimal(organism)) return computeSurvivalProbability(world, organismId, candidateIds, crowdingThreshold);
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return 0;

  const huntBias = organism.huntBias ?? 0.5;
  const herbivoreAvailability = localBiomassAvailability(world, seed.origin, candidateIds);
  const carnivoreAvailability = localPreyAvailability(world, organismId, candidateIds);
  const availability = (1 - huntBias) * herbivoreAvailability + huntBias * carnivoreAvailability;
  const scarcityFactor = availability + (1 - availability) * organism.genome.resourceEfficiency;

  const crowd = localSameSpeciesCountWithinMobilityRange(world, organismId, candidateIds);
  const crowdingFactor = crowd > crowdingThreshold ? clamp01(1 - (crowd - crowdingThreshold) * CROWDING_PENALTY_PER_EXCESS) : 1;

  return clamp01(scarcityFactor * crowdingFactor);
}

export function attemptPredation(world, organismId, rng = Math.random, candidateIds = null) {
  const organism = world.getOrganisms()[organismId];
  if (!isAnimal(organism) || !isMature(world, organismId)) return false;
  const huntBias = organism.huntBias ?? 0;
  if (huntBias <= 0) return false;
  const pool = candidateIds ?? Object.keys(world.getOrganisms());
  const prey = findPreyWithinRange(world, organismId, pool);
  if (prey.length === 0) return false;
  if (rng() >= PREDATION_PROBABILITY * huntBias) return false;
  const preyId = prey[Math.floor(rng() * prey.length)];
  const preyOrganism = world.getOrganisms()[preyId];
  world.removeSeed(preyOrganism.seedId);
  world.removeOrganism(preyId);
  return true;
}

export function predationStepHook(world, organismId, rng, generationIndex, simulatedNow, candidateIds) {
  attemptPredation(world, organismId, rng, candidateIds);
}

export function animalGenerationStepHook(world, organismId, rng, generationIndex, simulatedNow, candidateIds) {
  predationStepHook(world, organismId, rng, generationIndex, simulatedNow, candidateIds);
  movementStepHook(world, organismId, rng, generationIndex, simulatedNow);
}

// ============================================================
// Stage E -- Habitat Crossover
// ============================================================
export const CROSSOVER_MIN_BOUNDARY_GENERATIONS = 10;
export const CROSSOVER_MOBILITY_THRESHOLD_FRACTION = 0.9;
export const CROSSOVER_DIRECTED_NUDGE_FRACTION = 0.15;

function oppositeAnimalSpecies(species) {
  return species === LAND_CREATURE_SPECIES ? SEA_CREATURE_SPECIES : LAND_CREATURE_SPECIES;
}

function hasCellTypeNearby(world, position, radius, matches) {
  for (const cell of world.entries()) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    if (Math.hypot(wx - position[0], wy - position[1], wz - position[2]) > radius) continue;
    if (matches(cell)) return true;
  }
  return false;
}

const isLiquidCell = (cell) => cell.material === 'water' && cell.hydrospherePermeated === true;
const isDryCell = (cell) => cell.material !== 'water';

function nearestOppositeHabitatCellPosition(world, currentSpecies, position, radius) {
  const matches = currentSpecies === LAND_CREATURE_SPECIES ? isLiquidCell : isDryCell;
  let nearest = null;
  let nearestDist = Infinity;
  for (const cell of world.entries()) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    const d = Math.hypot(wx - position[0], wy - position[1], wz - position[2]);
    if (d > radius || d >= nearestDist || !matches(cell)) continue;
    nearestDist = d;
    nearest = [wx, wy, wz];
  }
  return nearest;
}

export function isAtHabitatBoundary(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  if (!isAnimal(organism)) return false;
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return false;
  if (!isValidHabitat(world, organism.species, seed.origin)) return false;
  const radius = clampAnimalTraits(organism).mobilityRange;
  return organism.species === LAND_CREATURE_SPECIES
    ? hasCellTypeNearby(world, seed.origin, radius, isLiquidCell)
    : hasCellTypeNearby(world, seed.origin, radius, isDryCell);
}

function performCrossoverReclassification(world, organismId, rng) {
  const organism = world.getOrganisms()[organismId];
  const seed = world.getSeeds()[organism.seedId];
  const newSpecies = oppositeAnimalSpecies(organism.species);
  let newOrigin = seed.origin;
  const boundaryCell = nearestOppositeHabitatCellPosition(world, organism.species, seed.origin, organism.mobilityRange);
  if (boundaryCell) {
    for (let attempt = 0; attempt < MAX_MOVE_ATTEMPTS; attempt++) {
      const candidate = randomCandidatePosition(boundaryCell, 1, rng);
      if (isValidHabitat(world, newSpecies, candidate)) {
        newOrigin = candidate;
        break;
      }
    }
  }
  world.setSeed(organism.seedId, { ...seed, origin: newOrigin, species: `${ORGANISM_SEED_SPECIES_PREFIX}${newSpecies}` });
  world.setOrganism(organismId, { ...organism, species: newSpecies, boundaryGenerations: 0, status: 'pending' });
}
