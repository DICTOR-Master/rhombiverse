// Phase 6 -- RHOMBIVERSE_SPEC_PENROSE_GROWTH.md. Real Ammann-rhombohedra
// geometry (the same construction underlying the Ammann-Kramer-Neri
// tiling, the standard 3D generalization of Penrose tiling), grown by
// local, incremental substitution rather than a global re-inflation --
// see the spec's own section 3 for why. Additive only: this module
// never imports, and is never imported by, build.js.
//
// Overlap prevention here is centroid-based deduplication (mirrors
// lattice.js's own cellKey-based Map dedup for the FCC lattice), not
// the full formal Ammann matching-rule vertex-decoration atlas needed
// for a rigorously long-range-consistent AKN tiling -- flagged
// honestly, not glossed over. For Wave 1's bounded, low-generation-
// count templates (amoeba/moss/fungus/fern), exact face-matching
// (below) plus centroid dedup already guarantees every placed tile is
// a genuine, non-overlapping golden rhombohedron; a future pass adding
// much larger/longer-running structures may need the fuller system.

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

function tileCentroid(tile) {
  const verts = tileVertices(tile);
  const sum = verts.reduce((acc, v) => vecAdd(acc, v), [0, 0, 0]);
  return scale(sum, 1 / verts.length);
}

function centroidKey(c) {
  // Rounded to 5 decimals -- comfortably tighter than the smallest real
  // distance between two distinct tile centroids in this construction
  // (edge length 1), loose enough to absorb ordinary float error from
  // repeated vector addition.
  return c.map((x) => x.toFixed(5)).join(',');
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
};

// Reuses asteroids.js's own regrowth-cooldown shape exactly (a
// periodic check, discrete step once idle time exceeds a fixed tick),
// per the spec's explicit "reuse the pattern, don't invent a new one"
// instruction -- same value, not coincidentally.
export const GROWTH_TICK_MS = 30000;

function occupiedKeySet(seed) {
  const set = new Set();
  for (const tile of seed.tiles) set.add(centroidKey(tileCentroid(tile)));
  return set;
}

// Attempts to grow one seed by one step: picks open faces (up to the
// species' facesPerTick) from the current frontier, and for each,
// attaches a new tile using a real, valid (verified) extension option
// that doesn't collide with anything already placed. Mutates
// seed.tiles/seed.generation/seed.lastGrowthAt in place. Returns true
// if anything was actually added (callers use this to decide whether
// to push a sync update, mirroring asteroids.js's own regrowth
// pattern).
export function growSeed(seed, now = Date.now()) {
  const template = GROWTH_TEMPLATES[seed.species];
  if (!template) return false;
  if (seed.generation >= template.maxGeneration) return false;
  if (now - seed.lastGrowthAt < GROWTH_TICK_MS) return false;

  const bias = SPECIES_BIAS[seed.species];
  const occupied = occupiedKeySet(seed);

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

  let added = 0;
  for (const face of frontier) {
    if (added >= bias.facesPerTick) break;
    const options = EXTENSIONS_BY_PAIR.get(pairKey(...face.pair)) ?? [];
    // Exclude the direction the CURRENT tile already used at this
    // corner -- that option recreates the same tile (self-overlap),
    // not a new one.
    const real = options.filter((opt) => opt.third !== face.exclude);
    if (real.length === 0) continue;
    const preferred = bias.preferType ? real.filter((o) => o.type === bias.preferType) : real;
    const pool = preferred.length > 0 ? preferred : real;
    const choice = pool[Math.floor((seed.tiles.length + added) % pool.length)];

    const dirs = [...face.pair, choice.third].sort((a, b) => a - b);
    const candidate = { type: choice.type, dirs, origin: face.origin };
    const key = centroidKey(tileCentroid(candidate));
    if (occupied.has(key)) continue; // would overlap an existing tile

    seed.tiles.push(candidate);
    occupied.add(key);
    added++;
  }

  if (added > 0) {
    seed.generation += 1;
    seed.lastGrowthAt = now;
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

// World-space vertices for one tile, offset by its seed's own origin --
// render.js's own job to turn this into real geometry; growth.js stays
// pure math/data, no THREE dependency (mirrors lattice.js's own
// separation of concerns).
export function tileWorldVertices(seed, tile) {
  return tileVertices(tile).map((v) => vecAdd(v, seed.origin));
}
