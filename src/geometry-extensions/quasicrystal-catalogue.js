// The 5D/6D catalogue (data/catalogue-5d6d.json) on the cut-and-project
// engine: pure geometry, no THREE. An entry names a shape (a few
// parameters); the app finds where that shape genuinely occurs in the
// current tiling, so a summoned item always lands as real pieces of the
// same quasicrystal as the build (docs/PLAN-5D-6D.md, stage 6).
//
// Zonohedra (serials 1000-1999): the zonotope spanned by a set S of basis
// directions (6D: 3-6 icosahedral axes, from a golden rhombohedron to the
// rhombic triacontahedron; 5D: 2-5 Penrose directions, from a rhombus to
// the decagon, as a prism `layers` tall). Any rotation of S counts: every
// direction set congruent to the entry's is searched. The zonotope at
// lattice point n is present when, for every k-subset I of S, the tiling
// has the tile (n + d, I) for some d in {0,1} on S \ I (a zonotope's
// tilings use each k-subset exactly once).
import { subsets } from './quasicrystal.js';

export const SERIAL_RANGES = {
  polytope: [1, 999],
  zonohedron: [1000, 1999],
  bridge: [2000, 2999],
  patch: [3000, 9999],
};

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

// A direction set's shape, up to rotation: for a single tile its type,
// otherwise the sorted |cos| of every pair of directions.
function signature(e, S) {
  if (S.length === e.k) return e.tileType(S);
  const pairs = [];
  for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) pairs.push(Math.abs(dot(e.par[S[a]], e.par[S[b]])).toFixed(4));
  return `${S.length}:${pairs.sort().join(',')}`;
}

// Every direction set congruent to S.
export function congruentSets(e, S) {
  const sig = signature(e, S);
  return [...subsets(e.d, S.length)].filter((T) => signature(e, T) === sig);
}

// Tiles of the zonotope of S anchored at n, or null if the tiling (as the
// set `has` of tile keys) doesn't contain it there.
function zonotopeAt(e, has, n, S) {
  const tiles = [];
  for (const I of subsets(S.length, e.k)) {
    const J = I.map((i) => S[i]);
    const free = S.filter((l) => !J.includes(l));
    let found = null;
    for (let mask = 0; mask < 1 << free.length && !found; mask++) {
      const m = n.map((x, l) => x + (free.some((f, b) => f === l && mask & (1 << b)) ? 1 : 0));
      if (has(m, J)) found = { n: m, I: J };
    }
    if (!found) return null;
    tiles.push(found);
  }
  return tiles;
}

// The nearest place (to the physical point `near`: 3D in 6D, the Penrose
// plane's (x, z) in 5D) where the entry's shape occurs in the tiling at
// `offset`: { tiles: [{ n, I }], centre } or null.
export function findOccurrence(e, offset, entry, near) {
  const sets = congruentSets(e, entry.directions);
  for (const radius of [5, 9, 14]) {
    const tiles = e.patch(offset, radius, near);
    const keys = new Set(tiles.map((t) => `${t.n.join(',')}|${t.I.join('')}`));
    const has = (n, I) => keys.has(`${n.join(',')}|${I.join('')}`);
    const anchors = new Map(tiles.map((t) => [t.n.join(','), t.n]));
    let best = null;
    for (const n of anchors.values()) {
      for (const S of sets) {
        const centre = S.reduce((v, i) => v.map((x, j) => x + 0.5 * e.par[i][j]), e.parOf(n));
        const dist = Math.hypot(...centre.map((x, j) => x - near[j]));
        if (best && dist >= best.dist) continue;
        if (dist > radius - 3) continue; // only where the patch is complete
        const found = zonotopeAt(e, has, n, S);
        if (found) best = { tiles: found, centre, dist };
      }
    }
    if (best) return { tiles: best.tiles, centre: best.centre };
  }
  return null;
}

// How many pieces an entry lands as.
export function pieceCount(e, entry) {
  const m = entry.directions.length;
  let c = 1;
  for (let i = 0; i < e.k; i++) c = (c * (m - i)) / (i + 1);
  return c * (entry.layers ?? 1);
}

export const findBySerial = (entries, serial) => entries.find((x) => x.serial === serial) ?? null;

// The zonotope's corners, centred on the origin, in the build's frame
// (5D: the Penrose plane is x/z and the prism's layers stack along y), for
// wireframe previews.
export function zonotopeVertices(e, entry, prismHeight = 1) {
  const gens = entry.directions.map((i) => (e.tier === '6d' ? e.par[i] : [e.par[i][0], 0, e.par[i][1]]));
  if (entry.layers) gens.push([0, prismHeight * entry.layers, 0]);
  const pts = [];
  for (let m = 0; m < 1 << gens.length; m++) {
    pts.push(gens.reduce((v, g, i) => v.map((x, j) => x + (m & (1 << i) ? 0.5 : -0.5) * g[j]), [0, 0, 0]));
  }
  return pts;
}

// The catalogue file, fetched once (browser only).
let cataloguePromise = null;
export function loadCatalogue() {
  cataloguePromise ??= fetch('./data/catalogue-5d6d.json').then((r) => r.json()).catch(() => []);
  return cataloguePromise;
}
