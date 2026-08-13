// RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md Stage 1 -- genome, phenotype,
// and the geometric-coherence bound derivation (section 1.1). A new data
// layer ON TOP of growth.js, not a new growth engine: this module imports
// growth.js, growth.js never imports this module (one-directional, same
// shape as growth.js's own relationship to build.js). Only Stage 1's own
// scope lives here -- no reproduction/selection/gene-transfer/drift/
// punctuated-equilibrium/trophic/catch-up logic yet (later stages).
//
// growth.js's REAL tunable parameter surface, found by inspecting the
// module directly rather than guessing (section 1.1's own instruction):
// the underlying quasicrystal geometry itself (STAR_DIRECTIONS,
// VALID_TRIPLES, EXTENSIONS_BY_PAIR) is entirely FIXED -- there is no
// continuous "angle" degree of freedom to tune without breaking real
// five-fold coherence, since only 40 real golden-rhombohedron triples
// exist at all. The only things a caller can actually vary are:
// facesPerTick (how many faces attempt to grow per tick), preferType
// (which of the two real prototile shapes -- acute/oblate/unbiased -- is
// favored), and maxGeneration (how many ticks before growth stops). Every
// genome trait below maps onto exactly one of these three, or is left
// inert in this stage (wired up by later stages per the spec's own
// staging).
import { growSeed, tileWorldVertices, tilesOverlap, VALID_TRIPLES } from './growth.js';
import { cellToWorld } from './lattice.js';

// Real, MEASURED bounds, not guessed -- verified 2026-08-13 with a
// throwaway stress-test copy of growth.js (never committed) that
// temporarily raised facesPerTick/maxGeneration far past any existing
// Wave-1 template:
//   - Coherence held with ZERO overlaps at facesPerTick=8, 60
//     generations, 479 tiles -- confirming growSeed's real SAT-overlap
//     check (fixed 2026-08-13) has no reachable coherence failure at
//     these scales, not just within the previously-tested small range.
//   - Compute cost, however, scales roughly quadratically with tile
//     count (the overlap check tests each candidate against every
//     placed tile): 15 ticks/119 tiles ~386ms, 20 ticks/159 tiles
//     ~932ms, 40 ticks/319 tiles ~8.9s. The real ceiling on these
//     traits is therefore a PERFORMANCE bound, not a coherence one --
//     exactly the class of concern RHOMBIVERSE_PRINCIPLES.md's Adaptive
//     Damping law (and this same spec's own MAX_CATCHUP_GENERATIONS,
//     Stage 4) already exists to police, so genome ranges are set here
//     to keep any single organism's full growth comfortably fast (well
//     under ~500ms even at the extreme end) rather than at whatever
//     geometry alone would technically still tolerate.
// maturitySize's floor (3) matches amoeba's own existing template
// minimum; its ceiling (15) is real-measured (~386ms) rather than
// picked to look round. facesPerTick's ceiling (6) is a modest doubling
// of Wave-1's existing top end (fern's 3), comfortably inside the
// coherence-safe range verified up to 8.
export const GENOME_TRAIT_RANGES = {
  growthRate: [0, 1],
  branchingAngle: [0, 1],
  resourceEfficiency: [0, 1], // inert in Stage 1 -- wired up by Stage 3/5 (selection/trophic)
  maturitySize: [3, 15],
  mutationRate: [0, 1], // inert in Stage 1 -- wired up by Stage 2 (mutation function)
};

function clamp(value, [min, max]) {
  return Math.min(max, Math.max(min, value));
}

// Clamps every trait to its own real, coherence-and-performance-grounded
// range -- the actual enforcement mechanism behind section 1.1's "no
// reachable genome value can produce an incoherent or runaway-expensive
// phenotype" guarantee. Always returns a genuinely valid genome, even if
// given out-of-range or missing values (defaults to each range's
// midpoint for anything absent, never throws).
export function clampGenome(genome = {}) {
  const clamped = {};
  for (const [trait, range] of Object.entries(GENOME_TRAIT_RANGES)) {
    const raw = genome[trait];
    const mid = (range[0] + range[1]) / 2;
    clamped[trait] = clamp(typeof raw === 'number' && Number.isFinite(raw) ? raw : mid, range);
  }
  return clamped;
}

// branchingAngle -> preferType: the real underlying lever (growth.js's
// bias.preferType) is a discrete choice among exactly three real options
// (favor the acute prototile, favor the oblate prototile, or stay
// unbiased between them) -- there is no continuous angle parameter to
// feed it, so a continuous genome trait is mapped onto that discrete
// choice via simple, deterministic thresholds (not a new probabilistic
// mechanism -- Stage 4's own seeded RNG, not yet built, is the right
// place for any real randomness). Thresholds split the range into three
// equal thirds, mirroring how Wave-1's own three preferType values
// (acute/oblate/null) already partition the space.
function branchingAngleToPreferType(branchingAngle) {
  if (branchingAngle < 1 / 3) return 'oblate';
  if (branchingAngle > 2 / 3) return 'acute';
  return null;
}

// Pure function: genome -> growthParams. No side effects, no reference
// to any specific organism/world state -- exactly the spec's own Stage 1
// instruction. Every output value is, by construction (the ranges above
// were themselves derived FROM growth.js's real accepted parameter
// space), one growSeed already knows how to render as a coherent,
// non-overlapping structure -- there is no genome value in
// GENOME_TRAIT_RANGES that can produce a call growSeed would reject or
// that would break coherence.
export function genomeToPhenotype(genome) {
  const g = clampGenome(genome);
  return {
    facesPerTick: Math.round(1 + g.growthRate * 5), // 1..6
    preferType: branchingAngleToPreferType(g.branchingAngle),
    maxGeneration: Math.round(g.maturitySize), // already stored in real generation units, 3..15
  };
}

// Plants a new organism: a genome (world-state's own `organisms`
// registry) driving a real growth.js seed (the existing `seeds`
// registry) via the SAME seedId, so rebuildSeedMeshes/tileWorldVertices
// etc. all keep working unchanged -- an organism is not a new visual
// object, it's a seed whose growth is genome-driven instead of
// species-table-driven. `species` here is a display label only (an
// evolved organism's actual behavior comes entirely from its genome,
// per this module's own header) -- reuses plantSeed's own "never
// invisible" guarantee by hand rather than importing plantSeed itself,
// since plantSeed's own species lookup (GROWTH_TEMPLATES[species]) would
// reject a non-Wave-1 species label; the first tile is placed directly
// here instead, matching plantSeed's own logic exactly.
export function plantOrganism(world, organismId, seedId, species, genome, origin, now = Date.now()) {
  const clamped = clampGenome(genome);
  const firstTriple = VALID_TRIPLES.find((t) => t.type === 'acute');
  const seed = {
    species,
    origin,
    plantedAt: now,
    lastGrowthAt: now,
    generation: 0,
    tiles: [{ type: firstTriple.type, dirs: [...firstTriple.dirs], origin: [0, 0, 0] }],
  };
  world.setSeed(seedId, seed);
  world.setOrganism(organismId, { genome: clamped, seedId, species, plantedAt: now });
  return { seed, organism: world.getOrganisms()[organismId] };
}

// Grows one organism by one step, genome-driven -- the orchestration
// growth.js itself never performs (it stays agnostic of genomes). Thin
// by design: look up the genome, compute its phenotype, hand growth.js
// exactly the parameters this genome implies. Returns growSeed's own
// return value (whether anything was actually added).
export function growOrganism(world, organismId, now = Date.now()) {
  const organism = world.getOrganisms()[organismId];
  if (!organism) return false;
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return false;
  const phenotype = genomeToPhenotype(organism.genome);
  const grew = growSeed(seed, now, phenotype);
  if (grew) world.setSeed(organism.seedId, seed);
  return grew;
}

// ============================================================
// Stage 2 -- Reproduction, Inheritance, HGT & Sexual Selection
// ============================================================
// Section 2's own "resource-gated" language ("on reaching maturitySize
// WITH SUFFICIENT LOCAL RESOURCE") is deliberately not enforced by
// anything below -- Stage 2's own build-order text scopes this stage to
// the raw reproduction MECHANISM only, "single-generation only, trigger
// manually," resource/selection gating is Stage 3's job to layer on top
// as a caller-level check before ever calling these. Every function here
// also takes an `rng` parameter (default Math.random) rather than
// hardcoding randomness -- Stage 4 needs a SEEDED rng for real
// determinism ("two clients loading the same planetoid state get the
// same outcome"), so the extension point is designed in now rather than
// retrofitted, same as seeds' own onSeedSet hook was pre-wired well
// before its actual sync pass existed.

// "reached maturitySize" = has finished growing to its own genome's cap
// -- maturitySize IS maxGeneration (see genomeToPhenotype above), so
// maturity is just "generation caught up to that cap," not a separate
// concept needing its own tracked state.
export function isMature(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  if (!organism) return false;
  const seed = world.getSeeds()[organism.seedId];
  if (!seed) return false;
  return seed.generation >= genomeToPhenotype(organism.genome).maxGeneration;
}

// Real Euclidean distance from an organism's own origin to the farthest
// vertex of any of its tiles -- reuses tileWorldVertices directly rather
// than estimating from tile count, so proximity checks below are grounded
// in the organism's ACTUAL grown extent, not a guessed constant.
export function organismBoundingRadius(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  const seed = organism && world.getSeeds()[organism.seedId];
  if (!seed) return 0;
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

// HGT's own "adjacent cells" language, translated to this module's
// real-valued coordinate space: two organisms' own grown extents come
// close enough to plausibly touch. 1.2x (not exactly 1.0x) gives a small
// real-contact buffer rather than requiring literal edge-touching, which
// would make HGT nearly unreachable in practice.
export const HGT_ADJACENCY_MULTIPLIER = 1.2;
export function areAdjacent(world, idA, idB) {
  const dist = organismDistance(world, idA, idB);
  return dist <= (organismBoundingRadius(world, idA) + organismBoundingRadius(world, idB)) * HGT_ADJACENCY_MULTIPLIER;
}

// Plant proximity-pairing's own "a defined lattice radius" (left open by
// the spec) -- grounded the same way as HGT's adjacency check (a
// multiple of the pair's own real bounding radii, so it scales sensibly
// whether organisms are small saplings or large mature structures)
// rather than a flat arbitrary distance. 3x is deliberately much wider
// than HGT's 1.2x: mate-pairing is a "same neighborhood" relationship,
// not a "touching" one.
export const PAIRING_RANGE_MULTIPLIER = 3;
export function isInPairingRange(world, idA, idB) {
  const dist = organismDistance(world, idA, idB);
  return dist <= (organismBoundingRadius(world, idA) + organismBoundingRadius(world, idB)) * PAIRING_RANGE_MULTIPLIER;
}

// Mutation delta magnitude: 10% of a trait's own range width per mutation
// event -- "small" per the spec's own language, grounded as a fraction of
// each trait's real range (so it scales correctly across traits with very
// different spans) rather than one flat number across all five. Flagged,
// per this doc's own open-questions section, as tunable, not fixed.
export const MUTATION_DELTA_FRACTION = 0.1;

// Each trait independently rolls the genome's OWN mutationRate as its
// mutation chance (section 2's own wording), shifts by a small bounded
// delta if it fires, and is re-clamped -- so no mutation, however
// unlucky, can ever land outside GENOME_TRAIT_RANGES (section 1.1's
// guarantee holding through this stage too, not just Stage 1's own
// direct clamp).
export function mutateGenome(genome, rng = Math.random) {
  const g = clampGenome(genome);
  const mutated = { ...g };
  for (const [trait, range] of Object.entries(GENOME_TRAIT_RANGES)) {
    if (rng() < g.mutationRate) {
      const width = range[1] - range[0];
      mutated[trait] = g[trait] + (rng() * 2 - 1) * width * MUTATION_DELTA_FRACTION;
    }
  }
  return clampGenome(mutated);
}

// Bounded blend of two parents' traits (plain average, per-trait) --
// "simple, auditable, no exotic operators" per section 2's own stated
// preference. Mutation is applied SEPARATELY afterward by the caller
// (reproduceSexual, below), matching section 2's "blend, then mutated."
export function blendGenomes(genomeA, genomeB) {
  const a = clampGenome(genomeA);
  const b = clampGenome(genomeB);
  const blended = {};
  for (const trait of Object.keys(GENOME_TRAIT_RANGES)) {
    blended[trait] = (a[trait] + b[trait]) / 2;
  }
  return clampGenome(blended);
}

// Section 2.3: fitness-proportionate weighted pick among candidates,
// biased toward higher values of the preferred trait -- a BIAS, not a
// hard filter (every candidate keeps a real, nonzero chance via the
// 0.01 floor, so genetic diversity can't collapse to always-the-same
// winner, which would undercut section 2.2's drift and section 5.1's
// convergent-evolution check once those exist). Scoped to plants only by
// its caller (reproduce, below) -- amoeba's asexual budding has no
// analogous mate-choice step, per section 2.3's own scoping.
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

// Amoeba's own reproduction channel (section 2): asexual budding, a
// mutated copy of the parent's own genome. `offspringOrigin` is caller-
// supplied rather than computed here -- real placement choice belongs to
// Stage 4's seeded-RNG resolution loop once it exists; this function is
// the raw mechanism, triggered manually per Stage 2's own scope.
export function reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random) {
  const parent = world.getOrganisms()[parentOrganismId];
  if (!parent) return null;
  return plantOrganism(world, offspringOrganismId, offspringSeedId, parent.species, mutateGenome(parent.genome, rng), offspringOrigin, now);
}

// Plants' own reproduction channel (section 2): bounded blend of both
// parents, then mutated.
export function reproduceSexual(world, parentAId, parentBId, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random) {
  const a = world.getOrganisms()[parentAId];
  const b = world.getOrganisms()[parentBId];
  if (!a || !b) return null;
  return plantOrganism(world, offspringOrganismId, offspringSeedId, a.species, mutateGenome(blendGenomes(a.genome, b.genome), rng), offspringOrigin, now);
}

// Species-level dispatch, matching section 2's own rules exactly: plants
// pair sexually (with the mate-preference bias) when a mature candidate
// is in range, falling back to asexual budding "to avoid a hard
// reproduction-blocking edge case" (the spec's own words) when none is;
// every other species (amoeba, and anything Animals' land/sea profiles
// later add that doesn't opt into sexual pairing) reproduces asexually
// only, no fallback needed since it never had a sexual path to fall back
// from.
export function reproduce(world, species, parentOrganismId, candidateMateIds, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random) {
  if (species === 'plant') {
    const matureCandidates = candidateMateIds.filter((id) => isMature(world, id) && isInPairingRange(world, parentOrganismId, id));
    if (matureCandidates.length > 0) {
      const mateId = selectMate(world, matureCandidates, MATE_PREFERENCE_TRAIT, rng);
      return { result: reproduceSexual(world, parentOrganismId, mateId, offspringOrganismId, offspringSeedId, offspringOrigin, now, rng), mode: 'sexual', mateId };
    }
    return { result: reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now, rng), mode: 'asexual-fallback' };
  }
  return { result: reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now, rng), mode: 'asexual' };
}

// Section 2.1, amoeba-specific: a small, fixed chance that one randomly
// chosen trait copies from a mature, adjacent donor to a mature,
// adjacent recipient -- donor unaffected (copying, not exchange, per
// real HGT), not gated by any fitness/selection check (happens
// regardless, same as real lateral transfer), and NOT itself
// re-clamped beyond the copy (the donor's own value is already
// coherence-bounded, so the copy is automatically valid on the
// recipient too -- section 2.1's own stated reasoning, verified true by
// construction since both genomes already live in the same clamped
// space). 10% per adjacent mature pair per resolution step is a game-
// balance choice (flagged, not derived from a real transfer-rate
// figure) aimed at "occasional, not routine," per this doc's own open
// question.
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

// Stage 1's own verification helper: confirms a genome's phenotype never
// produces a growSeed call that yields real geometric overlap, across
// its full growth history -- the structural, not-spot-checked check
// section 1.1 and this spec's own success-check list ask for. Exported
// for the test suite; not used by any runtime code path.
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
// "Selection is applied only at the resolution step... one clear
// function: genome x local conditions -> survival/reproduction
// probability" (section 3's own words) -- everything below is exactly
// that one function plus its inputs, a pure probability calculation.
// Nothing here mutates world state or removes an organism; a caller
// (Stage 4's catch-up loop) decides what to DO with the probability.

// How far around an organism's own origin to sample for local water
// availability -- section 3 reuses the existing hydrosphere spec's
// permeated-water material as the resource signal, not a new one.
// Grounded at 10 world units: comfortably larger than a single mature
// organism's own real bounding radius (measured ~2.4-20 units across
// Stage 1/2's own genome ranges) so "local" genuinely means the
// organism's immediate surroundings, not the whole planetoid.
export const RESOURCE_SEARCH_RADIUS = 10;
// Water cells within that radius counted as "fully abundant" -- below
// this, availability ramps down linearly to 0 (no water cells at all).
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

// 0 (no local water at all) .. 1 (at or above RESOURCE_ABUNDANT_COUNT).
export function localResourceAvailability(world, position) {
  return Math.min(1, countLocalWaterCells(world, position) / RESOURCE_ABUNDANT_COUNT);
}

// Crowding: same-species mature organisms within this radius. Reuses
// the same "multiple of real bounding radius" grounding as Stage 2's
// pairing/adjacency checks rather than a flat guessed distance.
export const CROWDING_RANGE_MULTIPLIER = 3;
export const CROWDING_THRESHOLD = 3; // local mature same-species count above which crowding starts penalizing
export const CROWDING_PENALTY_PER_EXCESS = 0.15; // survival multiplier lost per organism above threshold

function localMatureSameSpeciesCount(world, organismId, candidateIds) {
  const self = world.getOrganisms()[organismId];
  if (!self) return 0;
  let count = 0;
  for (const id of candidateIds) {
    if (id === organismId) continue;
    const other = world.getOrganisms()[id];
    if (!other || other.species !== self.species || !isMature(world, id)) continue;
    if (isInPairingRange(world, organismId, id)) count++; // reuses the same "same neighborhood" radius as mate pairing, by design -- crowding and mate-availability are the same real neighborhood, not two separately-tuned radii
  }
  return count;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

// The section 3 function itself: genome x local conditions ->
// probability in [0,1]. Resource scarcity scales survival with
// resourceEfficiency (at full abundance every genome does equally well;
// at full scarcity only efficient genomes do); crowding applies
// uniformly regardless of genome, per the spec's own explicit "uniform,
// independent of genome" wording.
export function computeSurvivalProbability(world, organismId, candidateIds) {
  const organism = world.getOrganisms()[organismId];
  const seed = organism && world.getSeeds()[organism.seedId];
  if (!organism || !seed) return 0;

  const availability = localResourceAvailability(world, seed.origin);
  const scarcityFactor = availability + (1 - availability) * organism.genome.resourceEfficiency;

  const crowd = localMatureSameSpeciesCount(world, organismId, candidateIds);
  const crowdingFactor = crowd > CROWDING_THRESHOLD ? clamp01(1 - (crowd - CROWDING_THRESHOLD) * CROWDING_PENALTY_PER_EXCESS) : 1;

  return clamp01(scarcityFactor * crowdingFactor);
}

// Section 2.2: below this LOCAL (same-species, in-neighborhood)
// population count, selection is partially bypassed in favor of chance
// -- a real, small-founding-population number (population genetics'
// own "drift dominates in small populations" holds even more strongly
// at game-scale populations of a handful of individuals than in real
// large populations), flagged as tunable per the spec's own open
// question, not derived from a specific real-world figure.
export const DRIFT_THRESHOLD = 5;

// DIRECT REQUIREMENT, 2026-08-13: selection must never drive an
// established lineage to full local extinction -- older/simpler
// organism types need to persist alongside newer ones for long-term
// world variation. Below this population count, survival is forced to
// certain (probability 1) regardless of fitness or drift, protecting
// the lineage's own ability to recover. 2 (not 1) is deliberate: a
// lone survivor of a SEXUAL species (plants) can never pair again, so
// the real floor for "still a viable, recoverable lineage" is a pair,
// not a single individual.
export const MIN_VIABLE_POPULATION = 2;

// Fraction of the survival decision resolved by uniform chance (0.5)
// rather than fitness, scaling from 0 (at/above DRIFT_THRESHOLD, pure
// fitness) up toward 1 as local population approaches zero -- "scaled
// by how far below threshold the population is," per section 2.2's own
// wording.
function driftBypassFraction(localPopulation) {
  if (localPopulation >= DRIFT_THRESHOLD) return 0;
  return (DRIFT_THRESHOLD - localPopulation) / DRIFT_THRESHOLD;
}

// The real per-organism decision a caller (Stage 4) applies each
// resolution step. `candidateIds` is the pool of other organisms to
// measure local population/crowding/mate-availability against (Stage 4
// would pass "everything on this planetoid"; kept as an explicit
// parameter here, same as Stage 2's own functions, rather than this
// module reaching into a not-yet-defined per-planetoid registry).
export function resolveSurvival(world, organismId, candidateIds, rng = Math.random) {
  const localPopulation = localMatureSameSpeciesCount(world, organismId, candidateIds) + 1; // +1 for the organism itself
  if (localPopulation <= MIN_VIABLE_POPULATION) return true; // extinction floor -- never resolved by chance or fitness below this

  const fitness = computeSurvivalProbability(world, organismId, candidateIds);
  const bypass = driftBypassFraction(localPopulation);
  const effectiveProbability = fitness * (1 - bypass) + 0.5 * bypass;
  return rng() < effectiveProbability;
}
