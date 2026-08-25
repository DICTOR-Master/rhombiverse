// Phase 6 -- RHOMBIVERSE_SPEC_PENROSE_GROWTH.md. Real Ammann-rhombohedra
// geometry, grown by local incremental substitution (never imports, and
// is never imported by, build.js). Full design rationale/history for
// every export below: docs/code-notes/geometry-extensions/growth.md

export const PHI = (1 + Math.sqrt(5)) / 2;

const ACUTE_ANGLE_DEG = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI; // 63.434948822922...
const OBLATE_ANGLE_DEG = (Math.acos(-1 / Math.sqrt(5)) * 180) / Math.PI; // 116.565051177078...
const ANGLE_EPS = 0.05;

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

export function unitTileVertices(dirs) {
  return tileVertices({ dirs, origin: [0, 0, 0] });
}

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

function tileEdges(verts) {
  const o = verts[0];
  return [vecAdd(verts[4], scale(o, -1)), vecAdd(verts[2], scale(o, -1)), vecAdd(verts[1], scale(o, -1))];
}

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

// Real 3D SAT overlap test between two tiles, with a cheap bounding-sphere
// pre-check (never changes the answer, only skips the expensive exact
// test). See docs/code-notes/geometry-extensions/growth.md for the full
// derivation and the 2026-08-13/2026-08-24 bug/perf histories.
export function tilesOverlap(vertsA, vertsB, eps = 1e-6) {
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

function facesOfTile(tile) {
  const [i, j, k] = tile.dirs;
  const [ei, ej, ek] = [STAR_DIRECTIONS[i], STAR_DIRECTIONS[j], STAR_DIRECTIONS[k]];
  const o = tile.origin;
  return [
    { pair: [i, j], origin: o, exclude: k },
    { pair: [i, j], origin: vecAdd(o, ek), exclude: k },
    { pair: [i, k], origin: o, exclude: j },
    { pair: [i, k], origin: vecAdd(o, ej), exclude: j },
    { pair: [j, k], origin: o, exclude: i },
    { pair: [j, k], origin: vecAdd(o, ei), exclude: i },
  ];
}

// Per-species growth bias. See docs/code-notes/.../growth.md for the
// real-biology grounding behind each choice.
const SPECIES_BIAS = {
  amoeba: { preferType: 'oblate', facesPerTick: 1 },
  moss: { preferType: null, facesPerTick: 2 },
  fungus: { preferType: 'acute', facesPerTick: 1 },
  fern: { preferType: 'acute', facesPerTick: 3 },
};

// Wave 1 + Wave 2 growth templates. See docs/code-notes/.../growth.md
// for the spec staging history and per-template real-biology grounding.
export const GROWTH_TEMPLATES = {
  amoeba: { species: 'amoeba', maxGeneration: 3 },
  moss: { species: 'moss', maxGeneration: 5 },
  fungus: { species: 'fungus', maxGeneration: 6 },
  fern: { species: 'fern', maxGeneration: 6 },

  sapling: {
    species: 'plant',
    maxGeneration: 8,
    bias: { preferType: 'acute', facesPerTick: 2 },
  },
  conifer: {
    species: 'plant',
    maxGeneration: 16,
    bias: { preferType: 'acute', facesPerTick: 2 },
  },
  shrub: {
    species: 'plant',
    maxGeneration: 9,
    bias: { preferType: null, facesPerTick: 4 },
  },
  nautilus: {
    species: 'shell',
    maxGeneration: 14,
    bias: { preferType: 'oblate', facesPerTick: 1 },
  },
  scallop: {
    species: 'shell',
    maxGeneration: 8,
    bias: { preferType: 'oblate', facesPerTick: 3 },
  },
  spineling: {
    species: 'creature',
    maxGeneration: 10,
    bias: { preferType: 'acute', facesPerTick: 2 },
  },
  'cluster-frame': {
    species: 'creature',
    maxGeneration: 13,
    bias: { preferType: null, facesPerTick: 4 },
  },
};

export const GROWTH_TICK_MS = 30000;

// Grows one seed by one step. See docs/code-notes/.../growth.md for the
// 2026-08-13 overlap-bug story and the phenotypeOverride/growthParameters
// design rationale.
export function growSeed(seed, now = Date.now(), phenotypeOverride = null) {
  const maxGeneration = phenotypeOverride ? phenotypeOverride.maxGeneration : GROWTH_TEMPLATES[seed.species]?.maxGeneration;
  if (maxGeneration === undefined) return false;
  if (seed.generation >= maxGeneration) return false;
  if (now - seed.lastGrowthAt < GROWTH_TICK_MS) return false;

  const bias = phenotypeOverride
    ? { preferType: phenotypeOverride.preferType, facesPerTick: phenotypeOverride.facesPerTick }
    : (GROWTH_TEMPLATES[seed.species].bias ?? SPECIES_BIAS[seed.species]);

  const growthParams = seed.growthParameters;
  const facesPerTick =
    growthParams?.densityBias != null
      ? Math.max(1, Math.round(bias.facesPerTick * (0.4 + growthParams.densityBias * 1.2)))
      : bias.facesPerTick;

  const frontier = [];
  for (const tile of seed.tiles) {
    for (const face of facesOfTile(tile)) {
      frontier.push(face);
    }
  }

  const placedVerts = seed.tiles.map((t) => tileVertices(t));

  let added = 0;
  for (const face of frontier) {
    if (added >= facesPerTick) break;
    const options = EXTENSIONS_BY_PAIR.get(pairKey(...face.pair)) ?? [];
    if (options.length === 0) continue;
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
  }

  if (added > 0) {
    seed.generation += 1;
    seed.lastGrowthAt = now;
    // cachedBoundingRadius: real perf fix, see docs/code-notes/.../growth.md
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

export function pruneTile(world, seedId, tileIndex) {
  const seed = world.getSeeds()[seedId];
  if (!seed || tileIndex <= 0 || tileIndex >= seed.tiles.length) return false;
  seed.tiles.splice(tileIndex, 1);
  world.setSeed(seedId, seed);
  return true;
}

export function tileWorldVertices(seed, tile) {
  return tileVertices(tile).map((v) => vecAdd(v, seed.origin));
}
