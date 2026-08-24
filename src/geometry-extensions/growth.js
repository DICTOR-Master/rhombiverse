// Phase 6 -- RHOMBIVERSE_SPEC_PENROSE_GROWTH.md. Real Ammann-rhombohedra
// geometry (the same construction underlying the Ammann-Kramer-Neri
// tiling, the standard 3D generalization of Penrose tiling), grown by
// local, incremental substitution rather than a global re-inflation --
// see the spec's own section 3 for why. Additive only: this module
// never imports, and is never imported by, build.js.
//
// Overlap prevention here is a real per-candidate 3D separating-axis
// test against every tile already placed (tilesOverlap, below) -- not
// the full formal Ammann matching-rule vertex-decoration atlas needed
// for a rigorously long-range-consistent AKN tiling -- flagged
// honestly, not glossed over. An earlier version of this file used
// centroid-equality dedup instead (mirroring lattice.js's own
// cellKey-based Map dedup for the FCC lattice) on the assumption that
// exact face-matching plus "don't recreate the exact same tile" was
// enough to guarantee no overlap; a real SAT check found (2026-08-13)
// that assumption was wrong -- see growSeed's own header for the
// specific bug and fix. For Wave 1's bounded, low-generation-count
// templates (amoeba/moss/fungus/fern), real geometric overlap testing
// is cheap (at most a few dozen tiles); a future pass adding much
// larger/longer-running structures may need the fuller matching-rule
// system for performance, not correctness.

export const PHI = (1 + Math.sqrt(5)) / 2;

const ACUTE_ANGLE_DEG = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI; // 63.434948822922...
const OBLATE_ANGLE_DEG = (Math.acos(-1 / Math.sqrt(5)) * 180) / Math.PI; // 116.565051177078...
const ANGLE_EPS = 0.05;

// The 12 icosahedron vertex directions (unit vectors): all coordinate
// permutations of (0, ±1, ±phi). Verified during the spec pass
// (2026-08-13, and re-verified here at module load, not just trusted):
// every pairwise angle among these 12 is one of exactly three values --
// 63.43deg (acute), 116.57deg (oblate), or 180deg (antipodal pairs) --
// nothing else. This is the real construction, not an approximation.
export const STAR_DIRECTIONS = buildStarDirections();

function buildStarDirections() {
  const perms = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ];
  const seen = new Map();
  for (const [, p1, p2] of perms) {
    for (const s1 of [1, -1]) {
      for (const s2 of [1, -1]) {
        const v = [0, 0, 0];
        v[p1] = s1;
        v[p2] = s2 * PHI;
        const len = Math.hypot(v[0], v[1], v[2]);
        const unit = [v[0] / len, v[1] / len, v[2] / len];
        const key = unit.map((x) => x.toFixed(6)).join(',');
        if (!seen.has(key)) seen.set(key, unit);
      }
    }
  }
  const dirs = [...seen.values()];
  if (dirs.length !== 12) {
    throw new Error(`buildStarDirections: expected 12 unique directions, got ${dirs.length}`);
  }
  return dirs;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function angleDeg(a, b) {
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
}

// Every valid golden-rhombohedron corner: a triple of direction indices
// (into STAR_DIRECTIONS) whose three pairwise angles are ALL acute
// (63.43deg) or ALL oblate (116.57deg) -- a "mixed" triple is a valid
// parallelepiped but its faces would NOT all be golden rhombi, so it is
// not a real Ammann rhombohedron and is excluded. Computed once at
// module load; verified this session (Python) to be exactly 20 acute +
// 20 oblate = 40 total among the 220 possible triples of 12 directions.
export const VALID_TRIPLES = buildValidTriples();

function buildValidTriples() {
  const triples = [];
  const n = STAR_DIRECTIONS.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const aij = angleDeg(STAR_DIRECTIONS[i], STAR_DIRECTIONS[j]);
      if (Math.abs(aij - 180) < ANGLE_EPS) continue; // antipodal, degenerate
      for (let k = j + 1; k < n; k++) {
        const aik = angleDeg(STAR_DIRECTIONS[i], STAR_DIRECTIONS[k]);
        const ajk = angleDeg(STAR_DIRECTIONS[j], STAR_DIRECTIONS[k]);
        if (Math.abs(aik - 180) < ANGLE_EPS || Math.abs(ajk - 180) < ANGLE_EPS) continue;
        const allAcute = [aij, aik, ajk].every((a) => Math.abs(a - ACUTE_ANGLE_DEG) < ANGLE_EPS);
        const allOblate = [aij, aik, ajk].every((a) => Math.abs(a - OBLATE_ANGLE_DEG) < ANGLE_EPS);
        if (allAcute) triples.push({ dirs: [i, j, k], type: 'acute' });
        else if (allOblate) triples.push({ dirs: [i, j, k], type: 'oblate' });
      }
    }
  }
  return triples;
}

// For an open face spanned by direction pair (i,j), which third
// directions validly extend it, and what type of tile each produces.
// Verified this session: every non-antipodal pair has at least one
// (usually two) valid extension -- growth never hits a dead end using
// only these real prototile shapes.
const EXTENSIONS_BY_PAIR = buildExtensionsByPair();

function pairKey(i, j) {
  return i < j ? `${i},${j}` : `${j},${i}`;
}

function buildExtensionsByPair() {
  const map = new Map();
  for (const { dirs, type } of VALID_TRIPLES) {
    const [i, j, k] = dirs;
    for (const [a, b, c] of [
      [i, j, k],
      [i, k, j],
      [j, k, i],
    ]) {
      const key = pairKey(a, b);
      const list = map.get(key) ?? [];
      list.push({ third: c, type });
      map.set(key, list);
    }
  }
  return map;
}

function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

// A single tile's 8 local vertices (relative to its own origin corner,
// not offset by any seed) for a given direction triple -- render.js's
// own building block for the two rhombohedron mesh templates (one per
// prototile). Exported specifically so render.js never needs to
// reimplement this subset-sum math itself; growth.js stays the one
// source of truth for the real geometry.
export function unitTileVertices(dirs) {
  return tileVertices({ dirs, origin: [0, 0, 0] });
}

// A tile's 8 vertices: origin + every subset-sum of its 3 edge
// directions (edge length fixed at 1, matching the spec's own unit-
// edge convention).
function tileVertices(tile) {
  const [i, j, k] = tile.dirs;
  const [ei, ej, ek] = [STAR_DIRECTIONS[i], STAR_DIRECTIONS[j], STAR_DIRECTIONS[k]];
  const verts = [];
  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      for (const c of [0, 1]) {
        let v = tile.origin;
        if (a) v = vecAdd(v, ei);
        if (b) v = vecAdd(v, ej);
        if (c) v = vecAdd(v, ek);
        verts.push(v);
      }
    }
  }
  return verts;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalizeOrNull(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len < 1e-9 ? null : scale(v, 1 / len);
}

// The 3 basis edge vectors of a tile, read straight back out of its own
// 8 vertices (verts[0] is the origin corner; verts[4]/[2]/[1] are the
// single-edge corners, per tileVertices' own a/b/c bit order above) --
// derived from the same vertex list render.js/tests already trust,
// rather than re-deriving from tile.dirs a second way.
function tileEdges(verts) {
  const o = verts[0];
  return [vecAdd(verts[4], scale(o, -1)), vecAdd(verts[2], scale(o, -1)), vecAdd(verts[1], scale(o, -1))];
}

// Real 3D separating-axis test between two golden-rhombohedron tiles --
// this is the actual fix for the overlap bug found 2026-08-13: the
// original code only ever compared a NEW candidate's rounded centroid
// against already-placed tiles' own centroids, which correctly
// catches an exact duplicate placement but says nothing about a
// DIFFERENT tile whose volume still overlaps an existing one -- and one
// of the two "valid" extension options at a face routinely does exactly
// that (folds back into the parent tile instead of extending outward;
// see growSeed's own comment for why). Two convex parallelepipeds are
// separated iff some axis among {each shape's 3 face normals, every
// pairwise cross product of one shape's edge with the other's (9)}
// shows non-overlapping projections -- the standard SAT test for
// oriented boxes, exhaustive for this shape class (15 candidate axes).
// `eps` tolerance treats two tiles that only TOUCH along a shared face
// (zero-width projection overlap) as non-overlapping, which is the
// correct and expected result for legitimately glued neighbors.
// Exported so the test suite can check real overlap directly against
// the same implementation growSeed itself trusts, rather than
// re-deriving SAT math a second time (which is exactly how the
// original bug -- see growSeed's header -- went undetected: the old
// test only re-checked centroid equality, not real overlap).
function centroidOf(verts) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const v of verts) {
    cx += v[0];
    cy += v[1];
    cz += v[2];
  }
  return [cx / verts.length, cy / verts.length, cz / verts.length];
}

function maxRadiusFrom(verts, center) {
  let r = 0;
  for (const v of verts) {
    const d = Math.hypot(v[0] - center[0], v[1] - center[1], v[2] - center[2]);
    if (d > r) r = d;
  }
  return r;
}

export function tilesOverlap(vertsA, vertsB, eps = 1e-6) {
  // Cheap conservative pre-check before the expensive exact SAT test
  // below: if the two tiles' bounding SPHERES don't overlap, the
  // (smaller, convex) tiles inside them provably can't overlap either --
  // this can only ever skip work, never change the real answer. Found
  // live 2026-08-24 profiling growth catch-up: growSeed's own
  // `placedVerts.some(...)` checks every new candidate against EVERY
  // already-placed tile in a seed, so this pre-check's payoff (O(16)
  // distance checks vs. up to 15 axes x 16 projections of exact SAT)
  // compounds directly with total tile count during a long catch-up run.
  const centerA = centroidOf(vertsA);
  const centerB = centroidOf(vertsB);
  const dist = Math.hypot(centerA[0] - centerB[0], centerA[1] - centerB[1], centerA[2] - centerB[2]);
  if (dist > maxRadiusFrom(vertsA, centerA) + maxRadiusFrom(vertsB, centerB) + eps) return false;

  const [e1, e2, e3] = tileEdges(vertsA);
  const [f1, f2, f3] = tileEdges(vertsB);
  const axes = [];
  for (const [a, b] of [
    [e1, e2],
    [e1, e3],
    [e2, e3],
    [f1, f2],
    [f1, f3],
    [f2, f3],
  ]) {
    const n = normalizeOrNull(cross(a, b));
    if (n) axes.push(n);
  }
  for (const ea of [e1, e2, e3]) {
    for (const eb of [f1, f2, f3]) {
      const n = normalizeOrNull(cross(ea, eb));
      if (n) axes.push(n);
    }
  }
  for (const axis of axes) {
    const pa = vertsA.map((v) => dot(v, axis));
    const pb = vertsB.map((v) => dot(v, axis));
    const minA = Math.min(...pa);
    const maxA = Math.max(...pa);
    const minB = Math.min(...pb);
    const maxB = Math.max(...pb);
    if (maxA <= minB + eps || maxB <= minA + eps) return false; // separated (or just touching) on this axis
  }
  return true; // no separating axis found among any candidate -- genuine overlap
}

// One open face on the growth frontier: the two directions spanning it,
// the real-space point of their shared corner, and which tile/local
// face it belongs to (so a consumed face can be removed from the
// frontier once something attaches there).
function facesOfTile(tile) {
  const [i, j, k] = tile.dirs;
  const [ei, ej, ek] = [STAR_DIRECTIONS[i], STAR_DIRECTIONS[j], STAR_DIRECTIONS[k]];
  const o = tile.origin;
  // 6 faces: for each of the 3 direction pairs, one face at the "near"
  // corner (offset 0 along the third axis) and one at the "far" corner
  // (offset 1 along the third axis, i.e. o + that direction).
  return [
    { pair: [i, j], origin: o, exclude: k },
    { pair: [i, j], origin: vecAdd(o, ek), exclude: k },
    { pair: [i, k], origin: o, exclude: j },
    { pair: [i, k], origin: vecAdd(o, ej), exclude: j },
    { pair: [j, k], origin: o, exclude: i },
    { pair: [j, k], origin: vecAdd(o, ei), exclude: i },
  ];
}

// species bias: given the real valid extension options for a face
// (each {third, type}), pick one. All four species use the exact same
// prototiles and the exact same real per-face option set
// (RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 4's own "one real
// mechanism, four biases, not four invented mechanisms") -- species
// only weights WHICH locally-valid option gets picked, and how many
// faces attempt to grow per tick.
const SPECIES_BIAS = {
  // amoeba: minimal branching -- strongly prefer whichever option
  // keeps the structure compact (oblate tiles are the lower-volume
  // prototile, see growth.test.mjs's own verified volume ratio).
  amoeba: { preferType: 'oblate', facesPerTick: 1 },
  // moss: dense, low branching, no dominant axis -- roughly even bias,
  // but only ever grows a couple of faces per tick (short generation
  // cap, per the spec's own Wave 1 framing).
  moss: { preferType: null, facesPerTick: 2 },
  // fungus: thread-like, irregular -- strongly prefer acute (the more
  // elongated-reading prototile) and grow from just one face at a time,
  // giving a wandering, thread-like frontier rather than a filled blob.
  fungus: { preferType: 'acute', facesPerTick: 1 },
  // fern: directional, frond-like -- prefer acute (elongating) but grow
  // from more faces per tick than fungus, giving a fuller frond rather
  // than a single thread.
  fern: { preferType: 'acute', facesPerTick: 3 },
};

// RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 4.1: Wave 1 only in this
// pass, per the spec's own explicit staging -- simple, low-generation-
// count templates first, to prove the mechanic works, before ever
// attempting Wave 2 (sapling/conifer/shrub, nautilus/scallop,
// spineling/cluster-frame). maxGeneration bounds growth per Adaptive
// Damping (RHOMBIVERSE_PRINCIPLES.md section 2) -- it settles, it
// doesn't run away.
//
// Deliberate simplification from the spec's own section 4 schema,
// worth flagging plainly: the spec describes `species` as a broader
// category (`plant`/`fungus`/`shell`/`creature`) with named templates
// AS INSTANCES of a species. Wave 1 collapses that to one field --
// each template key IS its own species value below -- because with
// exactly one template per intended look, a separate
// category-vs-template distinction has no work to do yet. That
// distinction becomes real once Wave 2 gives a category multiple
// templates (e.g. `plant` covering both `sapling` and `conifer`) --
// this table's own shape is the thing to revisit then, not a mistake
// to fix now.
export const GROWTH_TEMPLATES = {
  amoeba: { species: 'amoeba', maxGeneration: 3 },
  moss: { species: 'moss', maxGeneration: 5 },
  fungus: { species: 'fungus', maxGeneration: 6 },
  fern: { species: 'fern', maxGeneration: 6 },

  // Wave 2 (2026-08-13), per the spec's own section 4.1 staging -- only
  // attempted after Wave 1 was real and verified, which it now is. This
  // is also where `species` (category: plant/shell/creature) and the
  // template key genuinely diverge for the first time -- multiple
  // templates now share one category, exactly the distinction the spec's
  // own header flagged as "not real yet" for Wave 1. Each entry carries
  // its OWN `bias` (rather than falling back to the coarser per-category
  // SPECIES_BIAS table Wave 1 used) since the spec explicitly calls for
  // per-template tuning, not per-category: "each entry pre-tunes the
  // section 4 substitution bias parameters... to reliably produce one
  // specific, recognizable silhouette."
  //
  // `preferType`/`facesPerTick`/`maxGeneration` remain the entire real
  // tunable surface growSeed exposes (see SPECIES_BIAS above) -- these
  // values are a first-guess, grounded in the real growth habit each
  // template names, verified against actual generator output (tile
  // count, bounding-box elongation) in growth.test.mjs and the preset
  // generation script, not asserted here unchecked.
  sapling: {
    species: 'plant',
    // Real biology: a young tree -- already elongating along one
    // dominant axis (tree-like, not a blob) but modest in both height
    // and generation count, distinct from a mature conifer.
    maxGeneration: 8,
    bias: { preferType: 'acute', facesPerTick: 2 },
  },
  conifer: {
    species: 'plant',
    // Real biology: a mature evergreen -- strongly single-axis
    // elongating (acute prototile only, same facesPerTick as sapling so
    // the read stays a single trunk-like column, not a wider crown) but
    // grown far longer, so it reads unambiguously taller/older.
    maxGeneration: 16,
    bias: { preferType: 'acute', facesPerTick: 2 },
  },
  shrub: {
    species: 'plant',
    // Real biology: a bush -- many simultaneous low branches rather
    // than one dominant axis (no preferred prototile, high
    // facesPerTick), short-to-moderate generation cap so it reads
    // bushy/wide rather than tall.
    maxGeneration: 9,
    bias: { preferType: null, facesPerTick: 4 },
  },
  nautilus: {
    species: 'shell',
    // Real biology: a nautilus shell's own logarithmic-spiral,
    // tightly-wound growth. growSeed's grammar has no explicit
    // radius/curvature primitive (flagged honestly, matching this
    // module's own established practice of not overclaiming precision
    // it doesn't have) -- the tightest available approximation within
    // the existing two-prototile grammar is a strong, exclusive oblate
    // preference (the lower-volume, more tightly-packing prototile) at
    // the slowest possible growth rate (facesPerTick: 1), run for many
    // generations, so the structure stays compact and dense rather than
    // sprawling -- a coiled read, not a true parametric spiral.
    maxGeneration: 14,
    bias: { preferType: 'oblate', facesPerTick: 1 },
  },
  scallop: {
    species: 'shell',
    // Real biology: a scallop's fluted, radially-ribbed fan, wider and
    // flatter than a nautilus's tight coil -- same oblate compactness
    // preference, but more simultaneous growth points (a fanning
    // frontier) and a shorter generation cap, so it reads as a smaller,
    // broader fan rather than a long coil.
    maxGeneration: 8,
    bias: { preferType: 'oblate', facesPerTick: 3 },
  },
  spineling: {
    species: 'creature',
    // Real biology: a small creature's bilateral frame growing outward
    // from a central spine -- acute (elongating) prototile, two
    // simultaneous growth points per tick for a paired/bilateral read,
    // moderate generation cap.
    maxGeneration: 10,
    bias: { preferType: 'acute', facesPerTick: 2 },
  },
  'cluster-frame': {
    species: 'creature',
    // Real biology: a bulkier, more skeletal cluster-frame -- no
    // dominant axis (mixed prototiles) and more simultaneous growth
    // points than spineling, run longer, for a denser, bulkier frame
    // rather than a slender bilateral one.
    maxGeneration: 13,
    bias: { preferType: null, facesPerTick: 4 },
  },
};

// Reuses asteroids.js's own regrowth-cooldown shape exactly (a
// periodic check, discrete step once idle time exceeds a fixed tick),
// per the spec's explicit "reuse the pattern, don't invent a new one"
// instruction -- same value, not coincidentally.
export const GROWTH_TICK_MS = 30000;

// Attempts to grow one seed by one step: picks open faces (up to the
// species' facesPerTick) from the current frontier, and for each,
// attaches a new tile using a real, valid (verified) extension option
// that doesn't collide with anything already placed. Mutates
// seed.tiles/seed.generation/seed.lastGrowthAt in place. Returns true
// if anything was actually added (callers use this to decide whether
// to push a sync update, mirroring asteroids.js's own regrowth
// pattern).
//
// Real bug found and fixed 2026-08-13 (caught by a live SAT-based
// geometry check, not by reading the code -- centroid dedup alone
// looked fine): the original version excluded a face's "current
// direction" as if reusing it always self-overlapped, on the theory
// that it would "recreate the same tile." That's only true for a
// tile's NEAR corner face (origin = the tile's own origin -- reusing
// the same third direction there really does reproduce an identical
// tile at an identical origin). For the FAR corner face (origin = the
// tile's origin + that same direction), reusing it instead produces a
// perfectly valid, non-overlapping, ADJACENT tile continuing straight
// outward -- excluding it forced the algorithm onto whatever OTHER
// option existed for that face pair, and verified numerically
// (2026-08-13) that the other option folds back into the parent
// tile's own volume for fully half of all face instances (60 of 120).
// Fixed by dropping the direction-exclusion heuristic entirely and
// testing every real candidate against the tiles actually placed so
// far with tilesOverlap (real SAT geometry) instead -- verified
// separately that every face instance has at least one genuinely safe
// candidate this way, so growth still never hits a true dead end.
// `phenotypeOverride` ({ facesPerTick, preferType, maxGeneration }), added
// 2026-08-13 for RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md Stage 1: lets a
// caller feed this function DIFFERENT parameters than the fixed Wave-1
// species tables (SPECIES_BIAS/GROWTH_TEMPLATES) -- exactly the doc's own
// "do not modify growth.js's rendering path, only feed it different
// parameters" instruction. growth.js itself stays fully unaware of
// genomes/organisms (evolution.js imports from here, never the reverse,
// same one-directional-dependency shape as build.js/growth.js already
// have) -- it just accepts an already-computed, already-coherence-bounded
// parameter set from whoever calls it. Omitting it (the default, `null`)
// preserves every existing Wave-1 template's exact prior behavior.
export function growSeed(seed, now = Date.now(), phenotypeOverride = null) {
  const maxGeneration = phenotypeOverride ? phenotypeOverride.maxGeneration : GROWTH_TEMPLATES[seed.species]?.maxGeneration;
  if (maxGeneration === undefined) return false;
  if (seed.generation >= maxGeneration) return false;
  if (now - seed.lastGrowthAt < GROWTH_TICK_MS) return false;

  // Wave 2 templates carry their own `bias` directly (per-template
  // tuning, per the spec); Wave 1 templates have no `bias` field and
  // fall back to the coarser per-category SPECIES_BIAS table exactly as
  // before -- unchanged behavior for every already-verified template.
  const bias = phenotypeOverride
    ? { preferType: phenotypeOverride.preferType, facesPerTick: phenotypeOverride.facesPerTick }
    : (GROWTH_TEMPLATES[seed.species].bias ?? SPECIES_BIAS[seed.species]);

  // B5 Cultivation Mode: growthParameters, if the player set any at
  // planting time, layer ON TOP of the species' own bias rather than
  // replacing it -- densityBias (0..1) scales facesPerTick (this is
  // the real "density vs. spread" L-system parameter the spec asks to
  // expose: how many open faces fill per tick); directionalBias (a 3D
  // vector) re-sorts the otherwise-equal candidate options below by
  // alignment, so growth still only ever picks among geometrically
  // valid, non-overlapping extensions -- a player preference among what
  // the real prototile rules already allow, not a new growth rule.
  const growthParams = seed.growthParameters;
  const facesPerTick =
    growthParams?.densityBias != null
      ? Math.max(1, Math.round(bias.facesPerTick * (0.4 + growthParams.densityBias * 1.2)))
      : bias.facesPerTick;

  // Frontier: every open face across every existing tile, in a stable
  // order (tile insertion order, then the fixed facesOfTile order) --
  // deterministic, not Math.random()-ordered, so growth is reproducible
  // given the same seed history.
  const frontier = [];
  for (const tile of seed.tiles) {
    for (const face of facesOfTile(tile)) {
      frontier.push(face);
    }
  }

  // Real placed geometry to test candidates against, grown as tiles are
  // accepted this tick -- see this function's own header for why
  // centroid-only dedup can't catch every overlap on its own.
  const placedVerts = seed.tiles.map((t) => tileVertices(t));

  let added = 0;
  for (const face of frontier) {
    if (added >= facesPerTick) break;
    const options = EXTENSIONS_BY_PAIR.get(pairKey(...face.pair)) ?? [];
    if (options.length === 0) continue;
    // Species-preferred type tried first, but every real option is a
    // candidate now (not just "not this tile's own direction") --
    // whichever one is actually geometrically clear wins.
    const preferred = bias.preferType ? options.filter((o) => o.type === bias.preferType) : options;
    const rest = options.filter((o) => !preferred.includes(o));
    let orderedOptions = [...preferred, ...rest];
    if (growthParams?.directionalBias) {
      const [bx, by, bz] = growthParams.directionalBias;
      orderedOptions = orderedOptions
        .map((o) => ({ o, align: STAR_DIRECTIONS[o.third][0] * bx + STAR_DIRECTIONS[o.third][1] * by + STAR_DIRECTIONS[o.third][2] * bz }))
        .sort((a, b) => b.align - a.align)
        .map(({ o }) => o);
    }

    for (let n = 0; n < orderedOptions.length; n++) {
      const choice = orderedOptions[(seed.tiles.length + added + n) % orderedOptions.length];
      const dirs = [...face.pair, choice.third].sort((a, b) => a - b);
      const candidate = { type: choice.type, dirs, origin: face.origin };
      const candidateVerts = tileVertices(candidate);
      if (placedVerts.some((verts) => tilesOverlap(candidateVerts, verts))) continue;

      seed.tiles.push(candidate);
      placedVerts.push(candidateVerts);
      added++;
      break;
    }
    // If every option overlapped something already placed, this face
    // just doesn't grow this tick -- verified this shouldn't happen for
    // Wave 1's own templates, but a real possibility for a denser
    // future structure, so it's a no-op, not a thrown error.
  }

  if (added > 0) {
    seed.generation += 1;
    seed.lastGrowthAt = now;
    // Real bug found live (2026-08-14) profiling a hung catch-up call:
    // evolution.js's own organismBoundingRadius recomputed a seed's full
    // extent (every tile x every vertex) from scratch on EVERY call, and
    // gets called repeatedly inside O(n^2) per-generation proximity
    // checks (HGT, mate pairing, crowding) -- a real, avoidable cost
    // multiplier. `placedVerts` here already holds every current tile's
    // own LOCAL vertices (tileVertices, not tileWorldVertices) -- and
    // since tileWorldVertices = tileVertices + seed.origin, distance
    // from seed.origin to a WORLD vertex is exactly distance from the
    // ORIGIN (0,0,0) to the same LOCAL vertex (seed.origin cancels out),
    // so this is the real bounding radius, computed for free off data
    // this function already built, no extra tileVertices calls needed.
    // A generic, organism-agnostic cache on the seed's own record --
    // growth.js stays fully unaware of organisms/genomes either way.
    let maxDist = 0;
    for (const verts of placedVerts) {
      for (const v of verts) {
        const d = Math.hypot(v[0], v[1], v[2]);
        if (d > maxDist) maxDist = d;
      }
    }
    seed.cachedBoundingRadius = maxDist;
  }
  return added > 0;
}

// RHOMBIVERSE_SPEC_TRADE_INVENTORY.md-style periodic pass, called from
// render.js's onChange() same as applyAsteroidRegeneration/
// applyInventoryDecay -- iterates every planted seed and grows whichever
// ones are due. Cheap no-op when nothing is due (mirrors every other
// periodic pass in this project).
export function applyGrowth(world, now = Date.now()) {
  let changed = false;
  for (const [seedId, seed] of Object.entries(world.getSeeds())) {
    if (growSeed(seed, now)) {
      world.setSeed(seedId, seed);
      changed = true;
    }
  }
  return changed;
}

// Plants a new seed at a real world-space origin. The seed's own first
// tile is placed immediately (a seed is never invisible, per the
// spec's own section 9 success check) -- an arbitrary valid acute
// triple, since a freshly-planted seed has no "parent" face yet to
// inherit direction choices from.
export function plantSeed(world, seedId, species, origin, now = Date.now()) {
  if (!GROWTH_TEMPLATES[species]) {
    throw new Error(`Unknown growth species: ${species}`);
  }
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
  return seed;
}

// B5 Cultivation Mode's Manual tier: "manually pruning part of an
// already-grown structure should trigger the existing aperiodic
// fill/reroute behavior the growth system already has, with no new
// rule added." That behavior already exists for free -- growSeed always
// recomputes its frontier from seed.tiles fresh on every call (see
// above), so removing one tile here is the whole mechanic: the next
// growth tick naturally finds the newly-exposed open faces on the
// removed tile's former neighbors and continues from there. Refuses to
// prune the seed's very first tile (index 0) -- a seed with zero tiles
// isn't a smaller plant, it's not a seed anymore.
export function pruneTile(world, seedId, tileIndex) {
  const seed = world.getSeeds()[seedId];
  if (!seed || tileIndex <= 0 || tileIndex >= seed.tiles.length) return false;
  seed.tiles.splice(tileIndex, 1);
  world.setSeed(seedId, seed);
  return true;
}

// World-space vertices for one tile, offset by its seed's own origin --
// render.js's own job to turn this into real geometry; growth.js stays
// pure math/data, no THREE dependency (mirrors lattice.js's own
// separation of concerns).
export function tileWorldVertices(seed, tile) {
  return tileVertices(tile).map((v) => vecAdd(v, seed.origin));
}
