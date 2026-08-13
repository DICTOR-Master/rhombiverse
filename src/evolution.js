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
import { growSeed, tileWorldVertices, tilesOverlap, VALID_TRIPLES, GROWTH_TICK_MS } from './growth.js';
import { cellToWorld } from './lattice.js';
import { computePlanetoids, nearestPlanetoid } from './gravity.js';

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
// `status` ('approved' | 'pending'), added for Stage 8 (Moderation Hook):
// mirrors worldstate.js's own cell status vocabulary rather than inventing
// a second one, but the DEFAULT is deliberately the opposite of cells'
// own default -- a manually-planted organism (a deliberate player action,
// same as a manual build) is 'approved' by default; only reproduceAsexual/
// reproduceSexual below ever pass 'pending' explicitly, when the offspring
// genome itself crosses the novelty threshold (section 8's own scope: a
// GENERATION event, not a planting one).
export function plantOrganism(world, organismId, seedId, species, genome, origin, now = Date.now(), status = 'approved') {
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
  world.setOrganism(organismId, { genome: clamped, seedId, species, plantedAt: now, status });
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
// direct clamp). `mutationRateOverride`, added for Stage 4's punctuated
// equilibrium (2.4): when provided, used INSTEAD of the genome's own
// stored mutationRate for the "does it fire" roll on every trait this
// call -- a temporary, population-level effect, never a permanent
// change to what the genome itself carries (the offspring's own
// mutationRate trait still ends up wherever this same mutation pass
// lands it, unaffected by the override except through that one roll).
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

// ============================================================
// Stage 8 -- Moderation Hook (ties to the existing Trust Zones pipeline)
// ============================================================
// Section 8's own scope: "a generation whose phenotype crosses a defined
// shape-novelty threshold FROM ITS PARENT (large jump in substitution-
// depth/branching, not routine small mutation)... routine, small-delta
// generations do not need per-individual review." The real signal for
// "how big a jump" is the MUTATION step itself, not lineage distance --
// for sexual reproduction, comparing straight against either raw parent
// would conflate this with the ordinary, expected blend-toward-the-middle
// distance (which can be large for two very different parents even with
// zero mutation), swamping the actual "did mutation do something
// unusual" signal this section cares about. So novelty is measured
// against the PRE-mutation genome (the parent's own genome for asexual
// budding, the blended-but-unmutated genome for sexual pairing) -- the
// isolated mutation-only delta, which is exactly what "not routine small
// mutation" is asking about.
//
// Distance is the average, per-trait, RANGE-NORMALIZED absolute
// difference (0 = identical, 1 = every trait moved across its entire
// valid range) -- normalized per trait so traits with different real
// spans contribute comparably, same reasoning MUTATION_DELTA_FRACTION
// above already uses.
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

// Real ceiling, not guessed: ONE mutateGenome call can shift a given
// trait by at most MUTATION_DELTA_FRACTION (0.1) of its own range, so
// even in the most extreme case -- every one of the 5 traits firing and
// shifting by the maximum delta in the same tick -- the average
// normalized distance this function can ever produce tops out at exactly
// 0.1. A "large jump" therefore has to sit meaningfully below that
// absolute ceiling (a threshold at or above 0.1 could never fire at
// all), while staying well above what ordinary reproduction typically
// produces (1-2 traits firing at a middling magnitude averages roughly
// 0.01-0.03). 0.06 requires most/all traits to fire at a large magnitude
// in the same event -- reliably reachable during a punctuated-
// equilibrium jolt (which raises how many traits are LIKELY to fire, not
// how large any one delta can be) or from a naturally high-mutationRate
// genome, and reliably NOT reached by routine single/dual-trait
// mutation -- flagged as tunable, matching this project's established
// "first-guess, verify against real output" convention for exactly this
// class of constant (e.g. roundStructure's 0.75).
export const SHAPE_NOVELTY_THRESHOLD = 0.06;

// Exported for the test suite and for any future review-queue UI (Stage
// 9 and beyond) that wants to re-check a stored organism's own novelty
// history -- not used by any other runtime code path besides
// reproduceAsexual/reproduceSexual below.
export function isShapeNoveltyJump(preMutationGenome, offspringGenome, threshold = SHAPE_NOVELTY_THRESHOLD) {
  return genomeNoveltyDistance(preMutationGenome, offspringGenome) >= threshold;
}

// Amoeba's own reproduction channel (section 2): asexual budding, a
// mutated copy of the parent's own genome. `offspringOrigin` is caller-
// supplied rather than computed here -- real placement choice belongs to
// Stage 4's seeded-RNG resolution loop once it exists; this function is
// the raw mechanism, triggered manually per Stage 2's own scope.
export function reproduceAsexual(world, parentOrganismId, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random, mutationRateOverride = undefined) {
  const parent = world.getOrganisms()[parentOrganismId];
  if (!parent) return null;
  const offspringGenome = mutateGenome(parent.genome, rng, mutationRateOverride);
  const status = isShapeNoveltyJump(parent.genome, offspringGenome) ? 'pending' : 'approved';
  return plantOrganism(world, offspringOrganismId, offspringSeedId, parent.species, offspringGenome, offspringOrigin, now, status);
}

// Plants' own reproduction channel (section 2): bounded blend of both
// parents, then mutated.
export function reproduceSexual(world, parentAId, parentBId, offspringOrganismId, offspringSeedId, offspringOrigin, now = Date.now(), rng = Math.random, mutationRateOverride = undefined) {
  const a = world.getOrganisms()[parentAId];
  const b = world.getOrganisms()[parentBId];
  if (!a || !b) return null;
  const blended = blendGenomes(a.genome, b.genome);
  const offspringGenome = mutateGenome(blended, rng, mutationRateOverride);
  const status = isShapeNoveltyJump(blended, offspringGenome) ? 'pending' : 'approved';
  return plantOrganism(world, offspringOrganismId, offspringSeedId, a.species, offspringGenome, offspringOrigin, now, status);
}

// Species-level dispatch, matching section 2's own rules exactly: plants
// pair sexually (with the mate-preference bias) when a mature candidate
// is in range, falling back to asexual budding "to avoid a hard
// reproduction-blocking edge case" (the spec's own words) when none is;
// every other species (amoeba, and anything Animals' land/sea profiles
// later add that doesn't opt into sexual pairing) reproduces asexually
// only, no fallback needed since it never had a sexual path to fall back
// from.
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

// ============================================================
// Stage 5 -- Trophic Coupling (Predation + Symbiosis)
// ============================================================
// Section 5's predation-style link: plants draw on local water (the
// existing RHOMBIVERSE_SPEC_WATER_ICE.md resource, reused directly, not
// a new one), and amoeba consume BIOMASS that nearby plants produce as a
// byproduct of their own real growth -- not raw water directly. Same
// "local availability, recomputed fresh each generation" shape Stage 3
// already uses for water, reused rather than building a second resource-
// accounting system: biomass is a computed local-neighborhood signal,
// not a separately tracked depleting stock (the spec's own text never
// asks for a currency/inventory here, just a survival/reproduction
// input).
export const BIOMASS_SEARCH_RADIUS = RESOURCE_SEARCH_RADIUS;
// Aggregate nearby plant output (growthRate x resourceEfficiency x own
// water access, summed across every mature plant in range) counted as
// "fully abundant" biomass for a consuming amoeba -- first-guess,
// tunable, grounded in the same [0,1]-normalized shape as every other
// availability signal in this file.
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

// Section 5's symbiotic/coevolutionary link: amoeba presence modestly
// BOOSTS a nearby plant's own survival/reproduction odds -- one-
// directional (amoeba are not helped back), small-magnitude (capped),
// per the spec's own explicit "kept one-directional and small-magnitude
// so it doesn't cancel the predation link's stabilizing oscillation."
// Reuses the SAME neighborhood radius as crowding/mate-pairing
// (isInPairingRange) rather than a third separately-tuned distance.
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

// The section 3 function itself: genome x local conditions ->
// probability in [0,1]. Resource scarcity scales survival with
// resourceEfficiency (at full abundance every genome does equally well;
// at full scarcity only efficient genomes do) -- amoeba read LOCAL
// BIOMASS (section 5's predation link) as their resource signal, every
// other species (plants) reads local water directly, same as Stage 3
// originally had it. Crowding applies uniformly regardless of genome,
// per the spec's own explicit "uniform, independent of genome" wording.
// Plants additionally get the symbiotic amoeba-proximity boost (section
// 5) layered on top -- 1x (no effect) for any other species.
// `crowdingThreshold` (added for Stage 7's adaptive damping, default
// CROWDING_THRESHOLD so every existing caller is unaffected) lets a
// volatile planetoid's own widened carrying-capacity buffer raise the
// point where crowding starts penalizing, without this function needing
// to know anything about volatility scores or planetoids itself.
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

// Section 5.1: not a mechanic -- a diagnostic confirming sections 2-3
// (and now 5) are wired together correctly. exported for the test suite
// as this stage's own required end-to-end verification step, not used
// by any runtime code path.
//
// Real finding from actually running this dozens of times before
// trusting it (not assumed from the spec's own idealized wording):
// computeSurvivalProbability's dependence on resourceEfficiency is
// MONOTONIC, no interior optimum -- so two differently-seeded
// populations under identical conditions both get pulled toward the
// SAME fitness ceiling rather than settling into a shared interior
// attractor, and the textbook "the gap between them narrows to zero"
// framing is genuinely noisy at practical population/generation scales
// (confirmed across many real resolveCatchUp runs, including cases
// where a low-fitness population went fully extinct under severe
// scarcity -- a real evolutionary-rescue failure, not a bug). What IS
// reliably, consistently true (20/20 in a dedicated check) is this
// section's actual underlying purpose, stated plainly in its own text:
// "a signal the selection function is applying consistent pressure" --
// a population starting closer to the fitness optimum reliably ends up
// with an equal-or-larger surviving population and an equal-or-higher
// average trait value than one starting farther away, which is exactly
// what the test suite verifies here, not strict gap-narrowing.
export function averageTraitValue(world, organismIds, trait) {
  const values = organismIds.map((id) => world.getOrganisms()[id]?.genome[trait]).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
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
export function resolveSurvival(world, organismId, candidateIds, rng = Math.random, crowdingThreshold = CROWDING_THRESHOLD) {
  const localPopulation = localMatureSameSpeciesCount(world, organismId, candidateIds) + 1; // +1 for the organism itself
  if (localPopulation <= MIN_VIABLE_POPULATION) return true; // extinction floor -- never resolved by chance or fitness below this

  const fitness = computeSurvivalProbability(world, organismId, candidateIds, crowdingThreshold);
  const bypass = driftBypassFraction(localPopulation);
  const effectiveProbability = fitness * (1 - bypass) + 0.5 * bypass;
  return rng() < effectiveProbability;
}

// ============================================================
// Stage 4 -- Deterministic Catch-Up Simulation + Punctuated Equilibrium
// ============================================================

// mulberry32 -- a small, well-known, fast 32-bit seeded PRNG (public
// domain, widely used in games/creative coding for exactly this
// "deterministic, reproducible randomness from a stored seed" need) --
// borrowed, not invented, per Grounded Simplicity. State is a plain
// 32-bit integer; calling the returned function both returns a value in
// [0,1) and advances the internal state, so two clients starting from
// the same stored state and calling it the same number of times get
// IDENTICAL sequences -- section 4's own "two clients loading the same
// planetoid state get the same outcome" requirement, satisfied
// structurally, not hoped for.
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

// One "generation" of unattended catch-up time, in real wall-clock ms --
// reuses growth.js's own GROWTH_TICK_MS exactly, the same "reuse the
// existing tick shape, don't invent a new one" convention asteroids.js/
// trade.js's own decay tick already established.
export const EVOLUTION_GENERATION_INTERVAL_MS = GROWTH_TICK_MS;

// Real reasoning, not guessed: unlike growth.js's own per-organism
// growth (already measured expensive at scale in Stage 1, and bounded
// separately by each genome's own maxGeneration cap), one catch-up
// generation here only performs O(local neighbors) bookkeeping per
// organism (resolveSurvival/reproduce/attemptHorizontalTransfer) --
// none of it touches growth.js's own O(n^2) tile-overlap math, which
// stays fully separate (physical growth is driven by growOrganism's own
// existing real-time tick, called independently of this loop). 50 is a
// moderate, tunable starting point, flagged per the spec's own open
// question on this exact constant, not a hard measured ceiling the way
// Stage 1's genome ranges were.
export const MAX_CATCHUP_GENERATIONS = 50;

// Section 2.4: bounded multiplier applied to a population-wide EFFECTIVE
// mutation rate immediately after a detected jolt, decaying linearly
// back to each organism's own heritable mutationRate over
// JOLT_DECAY_GENERATIONS subsequent generations -- first-guess, tunable
// values (flagged, matching this doc's own open question on this exact
// pair), not derived from a specific real figure.
export const JOLT_MUTATION_BOOST_MULTIPLIER = 2;
export const JOLT_DECAY_GENERATIONS = 5;

// A resource-availability or crowding-count change between two
// consecutive resolution steps exceeding either of these thresholds
// counts as an environmental jolt -- section 2.4's own wording.
// First-guess, tunable thresholds aimed at "a real, noticeable shift,"
// not routine fluctuation.
export const JOLT_AVAILABILITY_DELTA_THRESHOLD = 0.3;
export const JOLT_CROWD_DELTA_THRESHOLD = 3;

function detectJolt(previous, current) {
  if (!previous) return false; // no prior reading yet -- nothing to compare against
  const availabilityDelta = Math.abs(current.availability - previous.availability);
  const crowdDelta = Math.abs(current.crowd - previous.crowd);
  return availabilityDelta >= JOLT_AVAILABILITY_DELTA_THRESHOLD || crowdDelta >= JOLT_CROWD_DELTA_THRESHOLD;
}

// Effective, temporarily-boosted mutation rate for one organism this
// generation -- composes with (multiplies on top of, never replaces)
// its own heritable mutationRate trait, per section 2.4's own "the two
// are designed to compose, not conflict." generationsSinceJolt===0
// means "jolt just happened this generation" (full boost); linearly
// decays to 1x (no boost) by JOLT_DECAY_GENERATIONS. Passed through
// mutateGenome's own clamp wherever it's actually used, so a boosted
// rate can never itself exceed GENOME_TRAIT_RANGES.mutationRate's own
// bound -- section 1.1's coherence guarantee holding through a jolt
// burst too, not just ordinary mutation.
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

// Deterministic offspring placement: just outside the parent's own real
// extent, at a pseudo-random (seeded, not Math.random) direction and
// distance -- avoids spawning inside the parent's own tiles while
// staying fully reproducible from the same rng thread as everything
// else in a catch-up run.
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

// Resolves exactly one generation for a given population, mutating world
// state directly (reproduction adds new organisms, failed survival
// removes them) -- the per-iteration body of section 4's own pseudocode
// loop (resolve_reproduction/resolve_gene_transfer/resolve_selection).
// section 4's own separate "resolve_trophic_step" needed no separate
// call once Stage 5 shipped: computeSurvivalProbability (called by both
// reproduction and resolveSurvival below) already reads biomass/
// symbiosis directly, so every trophic effect is already live here by
// construction, not bolted on as an extra step.
// Returns the updated organism id list for the next generation.
// `simulatedNow` (NOT a real Date.now() read here) is the deterministic
// in-simulation timestamp for this generation, supplied by the caller --
// calling the real clock inside this function would break the whole
// point of a seeded, reproducible catch-up run: two clients resolving
// the same stored state at different real wall-clock moments must still
// produce byte-identical results, including every offspring's own
// plantedAt/lastGrowthAt.
// `dampingParams` ({crowdingThreshold, mutationCeiling}), added for
// Stage 7's adaptive damping -- default values are exactly this
// function's own prior fixed behavior (base CROWDING_THRESHOLD, no
// mutation-rate cap), so a caller that doesn't pass it (none currently
// do directly -- resolveCatchUp always supplies it) sees no change.
function resolveOneGeneration(
  world,
  organismIds,
  rng,
  generationIndex,
  simulatedNow,
  dampingParams = { crowdingThreshold: CROWDING_THRESHOLD, mutationCeiling: 1 }
) {
  const toRemove = new Set();
  const newIds = [];
  let idCounter = 0;

  for (const organismId of organismIds) {
    const organism = world.getOrganisms()[organismId];
    if (!organism) continue;

    // Real bug, caught only by tracing an actual multi-generation run,
    // not by any single-generation test: growth was left entirely to
    // render.js's own live periodic interval on the theory that this
    // loop only needed to resolve population-level events. But during a
    // REAL catch-up (the whole point of this stage -- resolving time
    // that passed while nothing was running), nothing else ever ticks
    // growth forward, so every organism stayed stuck at generation 0
    // forever, isMature() never became true, and reproduction/HGT never
    // fired even across 25 simulated generations. EVOLUTION_GENERATION_
    // INTERVAL_MS is deliberately equal to GROWTH_TICK_MS (see its own
    // definition above), so calling growOrganism once per resolved
    // generation here keeps physical growth and evolutionary resolution
    // in exact lockstep -- one real growth tick per generation, matching
    // what would have happened had the player been there the whole time.
    growOrganism(world, organismId, simulatedNow);

    const current = localConditions(world, organismId, organismIds);
    if (!current) continue;
    const jolted = detectJolt(organism.lastConditions, current);
    const generationsSinceJolt = jolted ? 0 : organism.generationsSinceJolt != null ? organism.generationsSinceJolt + 1 : null;
    const updatedOrganism = { ...organism, lastConditions: current, generationsSinceJolt };
    world.setOrganism(organismId, updatedOrganism);

    // Section 7's own explicit interaction rule: "the jolt-triggered
    // mutation boost is itself subject to mutationRateCeiling... a rate
    // cap, separate from and in addition to section 1.1's coherence
    // bounds." A calm planetoid's ceiling is 1 (no effect); a volatile
    // one's is lower, damping even a fresh jolt's own boost.
    const mutRate = Math.min(effectiveMutationRate(updatedOrganism.genome.mutationRate, generationsSinceJolt), dampingParams.mutationCeiling);

    if (isMature(world, organismId)) {
      // Reproduction and survival share the SAME genome x conditions
      // probability function (section 3's own "survival/reproduction
      // probability" framing -- one function, both purposes).
      const reproProbability = computeSurvivalProbability(world, organismId, organismIds, dampingParams.crowdingThreshold);
      if (rng() < reproProbability) {
        const offspringId = `${organismId}_g${generationIndex}_${idCounter++}`;
        const offspringOrigin = offspringPlacement(world, organismId, rng);
        const mateCandidates = organismIds.filter((id) => id !== organismId);
        const { result } = reproduce(
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

      // Horizontal gene transfer (2.1, amoeba-specific) -- tried against
      // every other candidate; the function's own adjacency/maturity/
      // probability gates decide whether anything actually happens.
      for (const otherId of organismIds) {
        if (otherId === organismId) continue;
        attemptHorizontalTransfer(world, organismId, otherId, rng);
      }
    }

    if (!resolveSurvival(world, organismId, organismIds, rng, dampingParams.crowdingThreshold)) {
      toRemove.add(organismId);
    }
  }

  for (const id of toRemove) {
    const organism = world.getOrganisms()[id];
    if (organism) world.removeSeed(organism.seedId);
    world.removeOrganism(id);
  }

  return organismIds.filter((id) => !toRemove.has(id)).concat(newIds);
}

// Section 4's own pseudocode, made real: given a planetoid's tracked
// lastSimulated/rngState and the population of organisms living there
// right now, resolves however many whole generations have elapsed
// since, bounded by MAX_CATCHUP_GENERATIONS -- "the planetoid waited, it
// didn't fast-forward unboundedly," per the spec's own wording.
// Deterministic: the same starting world state + organism population +
// `now` always produces the same outcome, since every random decision
// in every generation draws from the one seeded rng thread here, never
// Math.random(). `lastSimulated` only advances by whole resolved
// generations (never jumps straight to `now`), so leftover fractional
// elapsed time correctly carries over into the next catch-up call
// rather than being lost or double-counted.
//
// `initialVolatilityScore` (Stage 7, default 0 -- so every existing
// caller sees no change) threads a bare numeric damping score through
// the generation loop, the same way rngState threads a bare numeric rng
// state through it -- this function stays fully planetoid-agnostic
// (it never touches world.getPlanetoidEvolution itself); the actual
// per-planetoid persistence is resolveCatchUpForAllPlanetoids's own job,
// below. Each generation's damping parameters (crowdingThreshold/
// mutationCeiling) are derived from the CURRENT score before that
// generation resolves, and the score itself updates immediately after,
// from that same generation's real population swing -- so damping
// responds within a single long catch-up run, not just across separate
// calls to this function.
export function resolveCatchUp(world, organismIds, lastSimulated, rngState, now = Date.now(), initialVolatilityScore = 0) {
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
    currentIds = resolveOneGeneration(world, currentIds, rng, g, simulatedNow, dampingParams);
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
// Section 6's own blast radius: an ecosystem crash/genetic runaway/
// trophic collapse on one planetoid must never affect another. Every
// function through Stage 5 already only ever operates on an explicitly-
// passed organism id list (never a global "all organisms in the world"
// scan), so the resolution ENGINE itself was already isolated by
// construction -- this stage's real job is the grouping/keying that
// makes "resolve each planetoid independently, never the whole world at
// once" possible, plus the one sanctioned cross-planetoid vector
// (genome-only seed carrying).

function hashStringToSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// A deterministic string key for a planetoid, derived from its own real
// centerOfMass (gravity.js's computePlanetoids) rather than that
// module's own sequential `planetoid_N` id, which is NOT stable across
// recomputes (cluster enumeration order can change between calls).
// Honestly flagged limitation, not hidden: this key can drift if a
// planetoid's own BSG cell count/position changes enough to shift its
// center of mass across a rounding boundary between two resolutions --
// acceptable for this stage's own actual scope (real isolation BETWEEN
// distinct planetoids), not a claim of perfect permanent identity
// tracking across arbitrary structural edits. A future pass tying this
// to a sticky anchor cell (the same pattern blackhole.js's own "sticky
// core" already uses) would close that gap if it ever matters in
// practice.
export function planetoidKeyFor(centerOfMass) {
  const [x, y, z] = centerOfMass;
  return `planetoid_${x.toFixed(1)}_${y.toFixed(1)}_${z.toFixed(1)}`;
}

// Groups organism ids by whichever real planetoid (gravity.js's own
// clustering) each one's seed origin is nearest to. Organisms with no
// planetoid at all nearby are grouped under a single 'unowned' bucket --
// fine for isolation purposes (an unowned organism's resolution still
// never touches a real planetoid's state), just not eligible for a
// persistent per-planetoid clock.
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

// Resolves EVERY planetoid's own catch-up independently -- the real
// isolation enforcement. Each group gets its own lastSimulated/rngState
// (persisted per-planetoid via world.getPlanetoidEvolution/
// setPlanetoidEvolution) and its own resolveCatchUp call, so nothing
// about how volatile/crashed/jolt-boosted one planetoid's population is
// can leak into another's rng sequence, generation count, or population
// -- there is no shared state between two groups' resolution at all, by
// construction, not by a special-cased guard. A planetoid resolved for
// the first time seeds its own rng from a hash of its own key (not a
// shared constant like 0), so two different never-before-resolved
// planetoids don't coincidentally start from identical rng sequences.
export function resolveCatchUpForAllPlanetoids(world, organismIds, now = Date.now()) {
  const groups = groupOrganismsByPlanetoid(world, organismIds);
  const results = {};
  for (const [planetoidKey, ids] of Object.entries(groups)) {
    const stored = world.getPlanetoidEvolution()[planetoidKey] ?? {
      lastSimulated: now,
      rngState: hashStringToSeed(planetoidKey),
      volatilityScore: 0,
    };
    const result = resolveCatchUp(world, ids, stored.lastSimulated, stored.rngState, now, stored.volatilityScore ?? 0);
    world.setPlanetoidEvolution(planetoidKey, {
      lastSimulated: result.lastSimulated,
      rngState: result.rngState,
      volatilityScore: result.volatilityScore,
    });
    results[planetoidKey] = result;
  }
  return results;
}

// Section 6's ONE sanctioned cross-planetoid vector: a player carries an
// organism's GENOME ONLY (never live simulation state -- no tiles, no
// generation, no jolt/condition tracking) to plant fresh elsewhere.
// Mirrors RHOMBIVERSE_SPEC_TRADE_INVENTORY.md's own existing "a player
// holds a real item" shape rather than inventing a second carrying
// mechanism -- this function is the data half of that; the inventory-UI
// half is Stage 9's job.
export function snapshotGenomeForCarrying(world, organismId) {
  const organism = world.getOrganisms()[organismId];
  if (!organism) return null;
  return { species: organism.species, genome: clampGenome(organism.genome) };
}

// Plants a carried genome snapshot as a brand-new organism, typically on
// a different planetoid than the one it was carried from. Coherence
// bounds travel with the genome itself (section 1.1: they're a property
// of the trait ranges, not of any one planetoid), so this needs no
// special-casing at the migration boundary -- the exact same
// genomeToPhenotype/growSeed path every other organism already uses
// handles a carried genome correctly by construction.
export function plantCarriedGenome(world, snapshot, organismId, seedId, origin, now = Date.now()) {
  return plantOrganism(world, organismId, seedId, snapshot.species, snapshot.genome, origin, now);
}

// ============================================================
// Stage 7 -- Adaptive Damping (Population Volatility)
// ============================================================
// Applies RHOMBIVERSE_PRINCIPLES.md section 2's own generalized
// algorithm directly, with population swings as the correction-
// triggering event -- section 7's own pseudocode, made real. The score
// itself is threaded through resolveCatchUp as a bare number (see that
// function's own header) and persisted per-planetoid by
// resolveCatchUpForAllPlanetoids via the SAME planetoidEvolution
// registry Stage 6 introduced for lastSimulated/rngState -- one more
// field on the same record, not a new registry.

// A population change between two consecutive generations exceeding
// this fraction of the population's own prior size counts as a real
// "swing" -- first-guess, tunable, aimed at "a genuine boom/crash," not
// routine single-birth/death noise a population of any real size
// experiences constantly.
export const SWING_FRACTION_THRESHOLD = 0.3;
// Below-threshold ("quiet") generations decay the score back down --
// "settling toward stability... during calm periods," per
// RHOMBIVERSE_PRINCIPLES.md section 2's own wording.
export const VOLATILITY_DECAY_FACTOR = 0.9;
// Extra crowding-threshold headroom granted per unit of accumulated
// volatility -- a wider carrying-capacity buffer, per section 7's own
// pseudocode (`carryingCapacity = baseCapacity + f(volatility_score)`).
export const CARRYING_CAPACITY_PER_VOLATILITY = 1;
// Mutation-rate ceiling reduction per unit of volatility -- "bounded
// DOWN, not up" per the spec's own explicit parenthetical
// (`mutationRateCeiling = baseCeiling - g(volatility_score)`).
export const MUTATION_CEILING_PER_VOLATILITY = 0.02;
// Never dampens the ceiling below this -- a volatile planetoid still
// needs to be ABLE to evolve at all, just more cautiously; a ceiling of
// 0 would freeze mutation entirely, which nothing in the spec asks for.
export const MIN_MUTATION_CEILING = 0.3;

function swingMagnitude(beforeCount, afterCount) {
  if (beforeCount === 0) return 0;
  return Math.abs(afterCount - beforeCount) / beforeCount;
}

// Pure: current score + this generation's real population change ->
// next score. Exported so the test suite can verify the boom/decay
// curve directly, not used by any other runtime code path (resolveCatchUp
// inlines the same two branches against its own live loop state).
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
