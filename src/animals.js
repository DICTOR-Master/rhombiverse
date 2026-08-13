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
