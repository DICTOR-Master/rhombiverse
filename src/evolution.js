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
