// RHOMBIVERSE_SPEC_ANIMALS.md Stage A -- Species Profiles & Habitat
// Placement. A data layer ON TOP of evolution.js (which itself sits on
// growth.js) -- same one-directional-dependency shape as every prior
// layer in this stack: animals.js imports evolution.js, evolution.js
// never imports animals.js.
//
// Real architectural choice, made deliberately before writing anything
// else: section 1's `mobilityRange`/`huntBias` are stored as SIBLING
// fields on the organism record (alongside `genome`, `seedId`,
// `species`...), never nested inside `genome` itself. evolution.js's
// clampGenome/mutateGenome/blendGenomes/isShapeNoveltyJump are all
// hardcoded to the fixed 5-trait GENOME_TRAIT_RANGES table (by that
// module's own design, not an oversight -- see its own header) --
// putting the two new traits inside `genome` would mean every one of
// those already-tested Stage 1-9 functions silently STRIPS them on
// every clamp/mutate/blend/plant call, since each one rebuilds the
// genome object by iterating GENOME_TRAIT_RANGES only. Keeping them as
// separate top-level fields instead means the base genome keeps flowing
// through evolution.js's existing, unchanged, already-verified pipeline
// exactly as it already does for amoeba/plant -- this module owns
// clamping/mutating/blending ONLY the two new fields, additively, per
// this project's own "extend, never restructure" golden rule for
// world-state schema.
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
} from './evolution.js';
import { cellToWorld } from './lattice.js';

export const LAND_CREATURE_SPECIES = 'landCreature';
export const SEA_CREATURE_SPECIES = 'seaCreature';
export const ANIMAL_SPECIES = [LAND_CREATURE_SPECIES, SEA_CREATURE_SPECIES];

// Section 1's own two additional traits. Real-valued world-space units
// for mobilityRange (the same coordinate space as an organism's own
// seed.origin, per growth.js's real, non-lattice quasicrystal
// placement) -- floor (1) mirrors GENOME_TRAIT_RANGES.maturitySize's own
// "not literally zero" floor; ceiling (15) sits at the same order of
// magnitude as RESOURCE_SEARCH_RADIUS (10, evolution.js's own "comfortably
// larger than a mature organism's own real bounding radius" grounding),
// extended modestly so a genuinely mobile creature can roam beyond its
// immediate resource neighborhood without ever crossing a whole
// planetoid in one resolution step. Flagged as tunable, matching this
// project's "first-guess, verify against real output" convention -- this
// doc's own section 10 leaves the exact range explicitly open, not fixed
// here.
export const ANIMAL_TRAIT_RANGES = {
  mobilityRange: [1, 15],
  huntBias: [0, 1], // 0 = herbivore .. 1 = carnivore, a continuous dial (section 4), not a species split
};

function clamp(value, [min, max]) {
  return Math.min(max, Math.max(min, value));
}

// Same shape as evolution.js's own clampGenome: always returns a fully
// valid, defaulted traits object, never throws, defaults missing/invalid
// values to each range's own midpoint.
export function clampAnimalTraits(traits = {}) {
  const clamped = {};
  for (const [trait, range] of Object.entries(ANIMAL_TRAIT_RANGES)) {
    const raw = traits[trait];
    const mid = (range[0] + range[1]) / 2;
    clamped[trait] = clamp(typeof raw === 'number' && Number.isFinite(raw) ? raw : mid, range);
  }
  return clamped;
}

// How far to search for the nearest BUILT cell to classify a real-valued
// position's habitat -- reuses evolution.js's own RESOURCE_SEARCH_RADIUS
// directly rather than a second, separately-tuned constant, same real
// grounding ("comfortably larger than a mature organism's own bounding
// radius").
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

// Sea creature habitat (section 1.2): "Ice-9.9-liquid-permeated cells
// only... the same liquid-hydrosphere zone already spec'd around
// Blackstar-Glassite cores" -- deliberately narrow, matching
// hydrosphere.js's own `hydrospherePermeated` flag exactly, NOT plain
// surface `water` (a real, separate liquid population per that module's
// own material:'water' + hydrospherePermeated distinction -- see
// CLAUDE.md's own "two different water populations, not a naming
// coincidence" note on the oceanic planetoid recipes). A future pass
// could widen this to cover surface oceans too; not done here, per this
// spec's own literal wording -- flagged as a real, deliberate scope
// choice, not an oversight.
function isLiquidHabitatCell(cell) {
  return cell.material === 'water' && cell.hydrospherePermeated === true;
}

// Land creature habitat (section 1.1): "dry, non-Ice-9.9-permeated
// cells" -- also excludes plain surface water/ocean cells (a lake is not
// dry either), a conservative real-world reading that goes slightly
// beyond the spec's own literal wording without contradicting it.
function isDryHabitatCell(cell) {
  return cell.material !== 'water';
}

// The real, hard placement gate section 1 describes: classifies a
// real-valued world-space position by whichever BUILT FCC cell is
// nearest to it within HABITAT_SEARCH_RADIUS. No cell built nearby at
// all defaults to dry/land -- "wet" must be positively established by a
// real nearby permeated cell, never assumed. Non-animal species are
// unaffected (habitat validity is an animals-only concept).
export function isValidHabitat(world, species, position) {
  const nearest = nearestCellWithinRadius(world, position, HABITAT_SEARCH_RADIUS);
  if (species === SEA_CREATURE_SPECIES) return !!nearest && isLiquidHabitatCell(nearest);
  if (species === LAND_CREATURE_SPECIES) return !nearest || isDryHabitatCell(nearest);
  return true;
}

// Plants a new animal organism. The base genome (the standard 5-trait
// shape) is handled ENTIRELY by evolution.js's own plantOrganism,
// completely unchanged -- growOrganism/isMature/genomeToPhenotype all
// keep working on an animal organism with zero animals-specific code,
// since they only ever read genome.growthRate/branchingAngle/
// maturitySize, never the species string itself. mobilityRange/huntBias
// are attached as sibling fields immediately after. Rejects a position
// that fails its own species' habitat validity outright -- section 7's
// own first success check ("land creatures never occupy Ice-9.9-liquid
// cells; sea creatures never occupy dry cells") is enforced here at the
// one real entry point, not hoped for downstream.
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

// Exported for Stage B+ (mobility/reproduction/trophic) and the test
// suite -- confirms an organism record actually carries both the base
// genome (evolution.js's own shape, GENOME_TRAIT_RANGES) and the two
// animal-specific fields, all independently bounded.
export function isAnimal(organism) {
  return !!organism && ANIMAL_SPECIES.includes(organism.species);
}

export { GENOME_TRAIT_RANGES };

// ============================================================
// Stage B -- Mobility (Abstracted, Not Live Physics)
// ============================================================
// Section 2: NOT continuous physics -- each resolution step, a mobile
// organism's effective location is resolved as a single bounded random
// walk within its own genome's mobilityRange of its previous position,
// constrained to its habitat type. Consistent with the whole framework's
// deterministic-catch-up model (evolution.js's own section 4): this is a
// population-level position update alongside reproduction/selection, not
// a new physics/pathfinding system.
//
// Real, grounded reasoning for the bounded-retry shape below: section 2's
// own blast-radius sentence is a HARD constraint ("an organism can never
// move somewhere its habitat trait doesn't support") -- a single random
// draw landing in invalid habitat (e.g. a land creature's walk stepping
// over open water) must never actually move the organism there. Retrying
// a bounded number of fresh random directions before giving up and
// staying put is the simplest mechanism that still guarantees the hard
// constraint holds on every call, without ever searching for the
// "nearest valid" spot (which would smuggle in pathfinding, a
// deliberately different, heavier system section 2 explicitly says this
// isn't). MAX_MOVE_ATTEMPTS=8 is a first-guess, flagged as tunable, not
// derived from a specific figure -- generous enough that an organism
// deep in valid habitat (the common case) essentially always finds a
// valid direction on its first try, small enough to stay cheap even for
// an organism sitting right at a habitat boundary.
export const MAX_MOVE_ATTEMPTS = 8;

// A single candidate point: a uniformly-random direction (spherical) at
// a uniformly-random distance up to mobilityRange -- "within mobilityRange
// of its previous cell," per section 2's own wording, not always AT the
// full range.
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

// The real per-organism mechanism, exported for direct/manual use (Stage
// B's own scope, mirroring evolution.js's Stage 2 "trigger manually to
// verify each channel independently before wiring into automatic
// resolution") and as the function movementStepHook below wraps for the
// automatic catch-up loop. Non-animal organisms are always a no-op (this
// module is the ONLY thing that knows what an "animal" is). Returns
// whether the organism actually moved (false if it stayed put, either
// because it isn't an animal or because every attempt landed in invalid
// habitat).
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
  return false; // no valid direction found this step -- stays put, never placed somewhere invalid
}

// The real onGenerationStep hook (evolution.js's own Stage B extension
// point, added specifically for this) -- passed straight to
// resolveCatchUpForAllPlanetoids by render.js's own wiring. Matches that
// hook's exact signature; only the `world`/`organismId`/`rng` parameters
// are actually needed here (generationIndex/simulatedNow are for other
// hooks' potential use, not this one).
export function movementStepHook(world, organismId, rng) {
  attemptMove(world, organismId, rng);
}

// ============================================================
// Stage C -- Sexual Reproduction
// ============================================================
// Section 3: "two mature, same-habitat, same-species individuals within
// mobilityRange of each other" -- deliberately the PARENT's own
// mobilityRange as the search radius (the organism whose reproduction is
// being resolved is the one "reaching out" this far), not evolution.js's
// own isInPairingRange (a multiple of combined bounding radius -- the
// right grounding for a sessile plant, not a mobile creature whose real
// reach is its own heritable mobilityRange trait).
function isWithinMobilityRange(world, parentId, otherId) {
  const parent = world.getOrganisms()[parentId];
  const seedA = world.getSeeds()[parent.seedId];
  const seedB = world.getSeeds()[world.getOrganisms()[otherId]?.seedId];
  if (!seedA || !seedB) return false;
  const dist = Math.hypot(seedA.origin[0] - seedB.origin[0], seedA.origin[1] - seedB.origin[1], seedA.origin[2] - seedB.origin[2]);
  return dist <= clampAnimalTraits(parent).mobilityRange;
}

// Bounded blend of two parents' animal traits -- same plain per-trait
// average shape as evolution.js's own blendGenomes, scoped to
// ANIMAL_TRAIT_RANGES instead of the base genome table.
export function blendAnimalTraits(traitsA, traitsB) {
  const a = clampAnimalTraits(traitsA);
  const b = clampAnimalTraits(traitsB);
  const blended = {};
  for (const trait of Object.keys(ANIMAL_TRAIT_RANGES)) {
    blended[trait] = (a[trait] + b[trait]) / 2;
  }
  return clampAnimalTraits(blended);
}

// Mutates animal traits using the SAME per-trait mutation shape as
// evolution.js's own mutateGenome (independent per-trait roll against
// `mutationRate`, delta magnitude MUTATION_DELTA_FRACTION of the trait's
// own range) -- reuses that exact constant rather than a second,
// separately-tuned one. `mutationRate` is deliberately a required
// parameter, not a second independently-tracked rate: the offspring's
// own (already-mutated) base genome.mutationRate is the one heritable
// concept governing volatility across the WHOLE genome, base traits and
// animal-specific traits alike -- not two unrelated dials.
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

// Offspring placement for animals: unlike evolution.js's own private
// offspringPlacement (used for amoeba/plant, which have no habitat
// constraint), this MUST land somewhere the offspring's own species can
// actually live. Tries a bounded number of random points near the
// midpoint of both parents (their real average position, not just the
// initiating parent's) before falling back to that midpoint outright --
// "never invisible" (growth.js's own established convention) wins even
// in the rare case no nearby valid spot is found, matching this
// project's own precedent of a graceful, honestly-imperfect fallback
// over a hard failure.
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

// Sexual selection bias (evolution doc section 2.3): huntBias, this
// implementation's own choice among the spec's two proposed options
// (huntBias or resourceEfficiency, "not fixed" per section 10's own open
// question) -- huntBias is the more legible, animals-specific trait to
// actually observe pairing bias toward, matching the spec's own
// reasoning for why plants biased toward resourceEfficiency ("the most
// legible/consequential trait").
export const MATE_PREFERENCE_TRAIT = 'huntBias';

// Real bug caught by a live statistical test before trusting this (a
// scripted 300-trial run showed ~51/49, no real bias at all): evolution.js's
// own selectMate hardcodes `organism.genome[preferredTrait]` -- correct
// for plants' own resourceEfficiency (a base-genome trait), but huntBias
// lives as a SIBLING field on the organism record (see this module's own
// header on why), so that lookup silently read `undefined` for every
// animal candidate, `Math.max(0.01, undefined)` produced NaN weights for
// all of them, and the weighted pick degraded to an effectively broken,
// near-uniform selection. Fixed with this module's own trait-aware
// weighted pick -- otherwise byte-identical to evolution.js's own
// selectMate (same fitness-proportionate weighting, same 0.01 floor so
// no candidate is ever fully excluded) -- rather than modifying
// evolution.js's own selectMate, which is correct exactly as written for
// its own (base-genome-only) callers.
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

// The real per-organism mechanism (Stage C's own "trigger manually to
// verify" scope, mirroring evolution.js's own Stage 2 build order) --
// finds a mature, same-species mate within the parent's own
// mobilityRange, blends+mutates BOTH the base genome (entirely via
// evolution.js's own reproduceSexual, unmodified) and the animal-specific
// traits (this module's own blendAnimalTraits/mutateAnimalTraits), and
// plants the result at a real, habitat-valid position. Returns null if no
// eligible mate is in range this step (a real, expected outcome -- not
// every resolution step finds a mate, section 3 doesn't promise one will).
// `mutationRateOverride` (Stage 4's punctuated-equilibrium jolt boost)
// threads through to BOTH the base genome's own mutation (via
// reproduceSexual, unmodified) and this module's own animal-trait
// mutation -- one shared override, composing with punctuated equilibrium
// exactly the way evolution.js's own reproduceSexual/reproduceAsexual
// already do, not a second untouched pathway.
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
  const origin = animalOffspringOrigin(world, parentOrganismId, mateId, parent.species, rng);
  const sexResult = reproduceSexual(world, parentOrganismId, mateId, offspringOrganismId, offspringSeedId, origin, now, rng, mutationRateOverride);
  if (!sexResult) return { result: null, mode: 'sexual-failed' };

  const mate = world.getOrganisms()[mateId];
  const blendedTraits = blendAnimalTraits(parent, mate);
  const offspringGenome = world.getOrganisms()[offspringOrganismId].genome;
  const mutatedTraits = mutateAnimalTraits(blendedTraits, mutationRateOverride ?? offspringGenome.mutationRate, rng);
  const updated = { ...world.getOrganisms()[offspringOrganismId], ...mutatedTraits };
  world.setOrganism(offspringOrganismId, updated);
  return { result: { seed: sexResult.seed, organism: updated }, mode: 'sexual', mateId };
}

// The real reproduceFn override (evolution.js's own Stage C extension
// point, added specifically for this) -- matches `reproduce`'s exact
// call shape. landCreature/seaCreature route through reproduceAnimal
// above; every other species (amoeba, plant) delegates straight back to
// evolution.js's own unmodified `reproduce`, so this override is a pure
// superset, never a behavior change for non-animal species.
export function reproduceFn(world, species, parentOrganismId, candidateMateIds, offspringOrganismId, offspringSeedId, offspringOriginHint, now, rng, mutationRateOverride) {
  if (species !== LAND_CREATURE_SPECIES && species !== SEA_CREATURE_SPECIES) {
    return reproduce(world, species, parentOrganismId, candidateMateIds, offspringOrganismId, offspringSeedId, offspringOriginHint, now, rng, mutationRateOverride);
  }
  return reproduceAnimal(world, parentOrganismId, offspringOrganismId, offspringSeedId, now, rng, candidateMateIds, mutationRateOverride);
}

// ============================================================
// Stage D -- Trophic Tier Extension (Herbivory + Carnivory)
// ============================================================
// Section 4: huntBias is a CONTINUOUS dial, not a herbivore/carnivore
// species split -- "one more difference-equation link," reusing the
// exact same biomass resource pool evolution.js's Stage 5 already
// created for amoeba (herbivory: a second consumer of the same pool,
// which naturally creates real competitive pressure with amoeba without
// inventing a new resource type), plus a real, direct predation event
// for the carnivory half (a genuine per-generation prey-removal, the
// most honest/grounded representation of "eats another organism" --
// simpler and more legible than a purely probabilistic nudge, and it's
// what makes the effect on prey populations actually MEASURABLE per
// section 7's own success check, not just theoretically present).

// Same "count within range, normalize to [0,1] at an abundant threshold"
// shape evolution.js's own RESOURCE_ABUNDANT_COUNT/BIOMASS_ABUNDANT_OUTPUT
// already use -- reused here for prey, not a new normalization scheme.
export const PREY_ABUNDANT_COUNT = 3;

// A hunt only actually succeeds probabilistically per generation (real
// predators don't catch prey on every encounter) -- first-guess,
// flagged as tunable per this project's established convention for
// exactly this class of constant.
export const PREDATION_PROBABILITY = 0.3;

// True prey relationship (section 4): amoeba are always valid prey
// (any huntBias > 0 carnivore can target them, matching the spec's own
// "prey on amoeba directly, or on other animals of lower huntBias" --
// amoeba have no huntBias of their own, treated as huntBias 0 for this
// comparison); an animal is prey only to another animal with a STRICTLY
// higher huntBias, so two equal-huntBias animals never prey on each
// other.
function isPreyOf(predator, candidate) {
  if (candidate.species === 'amoeba') return true;
  if (!isAnimal(candidate)) return false;
  return (candidate.huntBias ?? 0) < (predator.huntBias ?? 0);
}

// Every mature, in-mobilityRange organism from `candidateIds` (Stage 6's
// own planetoid-scoped population, passed through onGenerationStep's own
// extension -- see evolution.js's own comment on why -- rather than a
// global world.getOrganisms() scan) that counts as this predator's prey.
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

// Same-species crowding count, but scoped to the organism's OWN
// mobilityRange (its real reach) rather than evolution.js's own
// bounding-radius-multiplier neighborhood -- same reasoning as
// reproduceAnimal's own isWithinMobilityRange (a mobile creature's real
// "local" is defined by how far it can move, not how big it physically
// is).
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

// The real survivalProbabilityFn override (evolution.js's own Stage D
// extension point) -- huntBias blends two availability signals into one
// (0 = pure herbivore reading local biomass exactly like amoeba already
// does, 1 = pure carnivore reading local prey density, continuous
// in-between per section 4's own "dial, not a split"), then reuses the
// SAME scarcity/crowding formula SHAPE evolution.js's own
// computeSurvivalProbability already established (resourceEfficiency
// matters more under scarcity, crowding penalizes uniformly above
// threshold) rather than inventing a new one. Delegates straight back to
// evolution.js's own unmodified computeSurvivalProbability for any
// non-animal species -- a pure superset, same pattern as reproduceFn.
export function computeAnimalSurvivalProbability(world, organismId, candidateIds, crowdingThreshold = CROWDING_THRESHOLD) {
  const organism = world.getOrganisms()[organismId];
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

// The real, direct predation event: a mature carnivore-leaning animal
// (huntBias alone gates whether it hunts at all THIS generation via the
// probability roll below -- there is no separate hard species/threshold
// split, matching section 4's own "continuous dial" framing: a huntBias
// of, say, 0.2 still occasionally hunts, just proportionally rarely,
// since huntBias also feeds directly into its own survival-probability
// blend above) with real prey in range has a real, bounded chance per
// generation of removing ONE prey organism outright -- section 4's own
// carnivory mechanism, made concrete. Never removes more than one prey
// per predator per generation (bounded, not a massacre).
export function attemptPredation(world, organismId, rng = Math.random, candidateIds = null) {
  const organism = world.getOrganisms()[organismId];
  if (!isAnimal(organism) || !isMature(world, organismId)) return false;
  const huntBias = organism.huntBias ?? 0;
  if (huntBias <= 0) return false;
  const pool = candidateIds ?? Object.keys(world.getOrganisms());
  const prey = findPreyWithinRange(world, organismId, pool);
  if (prey.length === 0) return false;
  if (rng() >= PREDATION_PROBABILITY * huntBias) return false; // higher huntBias hunts more reliably, still never certain
  const preyId = prey[Math.floor(rng() * prey.length)];
  const preyOrganism = world.getOrganisms()[preyId];
  world.removeSeed(preyOrganism.seedId);
  world.removeOrganism(preyId);
  return true;
}

export function predationStepHook(world, organismId, rng, generationIndex, simulatedNow, candidateIds) {
  attemptPredation(world, organismId, rng, candidateIds);
}

// The real combined per-generation hook, wired into render.js's own
// resolveEvolution as the actual onGenerationStep -- resolves predation
// BEFORE movement (hunt from the current position, then move), matching
// this module's own established "hook order reflects the generation's
// real event order" convention from Stage B.
export function animalGenerationStepHook(world, organismId, rng, generationIndex, simulatedNow, candidateIds) {
  predationStepHook(world, organismId, rng, generationIndex, simulatedNow, candidateIds);
  movementStepHook(world, organismId, rng, generationIndex, simulatedNow);
}
