// Cut-and-project engine for the 5D and 6D quasicrystal worlds.
//
// Both worlds are slices of a hypercubic lattice Z^d:
//   6D: Z^6 -> the Ammann-Kramer tiling of prolate and oblate golden
//       rhombohedra (icosahedral). Tiles are 3-faces of Z^6.
//   5D: Z^5 -> the Penrose rhombus tiling (thick and thin rhombi), stacked
//       into prism layers. Tiles are 2-faces of Z^5, times a layer index.
//
// A face is (n, I): lattice point n in Z^d and a sorted index set I of
// basis directions (|I| = 3 in 6D, 2 in 5D); it is the cube n + [0,1]^I.
// Its physical shape is the parallelepiped spanned by the par projections
// of e_i, i in I, at par(n). Pieces never move: a phason offset only
// decides which faces are in the tiling.
//
// Selection (de Bruijn dual / canonical cut): the face (n, I) is a tile
// iff its dual face in the half-shifted lattice meets the cut space
// E + gamma, i.e. iff
//     y = gamma_perp - perp(n) - 1/2 sum_{i in I} perp(e_i)
// lies in sum_{l not in I} [-1/2, 1/2] perp(e_l).
// The perp space is 3D in both worlds (in 5D it includes the diagonal
// direction (1,1,1,1,1)), so this is one 3x3 solve per face.
//
// Approximants: the physical space E is replaced by E_q, the same rows
// with tau replaced by q = F(k+1)/F(k). E_q is rational, so the tiling
// repeats. Tiles are still drawn with the true golden par vectors.

import { PHI, STAR_DIRECTIONS } from './growth.js';

const EPS = 1e-9;

// --- small linear algebra ------------------------------------------------

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const addScaled = (a, b, s) => a.map((x, i) => x + b[i] * s);

function det3(a, b, c) {
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

// Solve [a b c] x = y (a, b, c are columns) by Cramer's rule.
function solve3(a, b, c, y) {
  const d = det3(a, b, c);
  return [det3(y, b, c) / d, det3(a, y, c) / d, det3(a, b, y) / d];
}

// Orthonormal basis of the row space of `rows` (Gram-Schmidt).
function orthonormalRows(rows) {
  const out = [];
  for (const r of rows) {
    let v = r.slice();
    for (const u of out) v = addScaled(v, u, -dot(v, u));
    const len = Math.sqrt(dot(v, v));
    out.push(v.map((x) => x / len));
  }
  return out;
}

const columns = (rows) => rows[0].map((_, i) => rows.map((r) => r[i]));

// --- the two lattices ---------------------------------------------------------

// Row matrices (one row per physical/perp coordinate, one column per basis
// vector e_i), as functions of the golden number t so the same formulas give
// the approximants.

// 6D: the six icosahedral axes, one per antipodal pair of growth.js's
// STAR_DIRECTIONS (so tiles match unitTileVertices exactly). Their raw
// coordinates are 0, +-1, +-PHI; replacing PHI by t gives the approximant
// rows, and by -1/t the perp (Galois-conjugate) rows.
const ICOSA_AXES = (() => {
  const g = [0.3, 0.2, 0.1]; // generic: never orthogonal to an axis
  const len = Math.hypot(1, PHI);
  return STAR_DIRECTIONS.filter((u) => dot(u, g) > 0).map((u) => u.map((x) => Math.round(x * len * 1e6) / 1e6));
})();
const icosaCoord = (x, t) => (Math.abs(Math.abs(x) - 1) < 1e-4 ? Math.sign(x) : Math.abs(x) < 1e-4 ? 0 : Math.sign(x) * t);
function icosaRows(t) {
  const len = Math.hypot(1, t);
  return [0, 1, 2].map((k) => ICOSA_AXES.map((a) => icosaCoord(a[k], t) / len));
}

// 5D: e_k -> (cos 2pi k/5, sin 2pi k/5). cos 72 = 1/(2t), cos 144 = -t/2,
// sin 144 / sin 72 = 1/t. Perp: (cos 4pi k/5, sin 4pi k/5, 1/sqrt 2), the
// conjugate rows (t -> -1/t) plus the diagonal, all rows of equal norm.
const SIN72 = Math.sin((2 * Math.PI) / 5);
const SIN36 = Math.sin(Math.PI / 5);
function pentaRows(t, sinScale = SIN72) {
  return [
    [1, 1 / (2 * t), -t / 2, -t / 2, 1 / (2 * t)],
    [0, 1, 1 / t, -1 / t, -1].map((x) => x * sinScale),
  ];
}
const DIAG5 = 1 / Math.SQRT2;

// Build the engine data for one world at golden number (or approximant) q.
function frame(tier, q) {
  let parRows, perpRowsTau;
  if (tier === '6d') {
    parRows = icosaRows(PHI);
    perpRowsTau = icosaRows(-1 / PHI);
  } else {
    parRows = pentaRows(PHI);
    perpRowsTau = [...pentaRows(-1 / PHI, SIN36), [1, 1, 1, 1, 1].map(() => DIAG5)];
  }
  let perpRows = perpRowsTau;
  if (q !== PHI) {
    // Kernel of the perp map must be E_q: project the golden perp frame onto
    // the orthogonal complement of E_q (unchanged at q = tau).
    const eq = orthonormalRows(tier === '6d' ? icosaRows(q) : pentaRows(q));
    perpRows = perpRowsTau.map((r) => eq.reduce((v, u) => addScaled(v, u, -dot(v, u)), r));
  }
  return { par: columns(parRows), perp: columns(perpRows) };
}

// --- public API -----------------------------------------------------------------

export const TIERS = {
  '6d': { d: 6, k: 3, name: 'icosahedral' },
  '5d': { d: 5, k: 2, name: 'decagonal' },
};

// Height of one 5D prism layer, in edge lengths.
export const PRISM_HEIGHT = 1;

// Approximant click-stops: [numerator, denominator] Fibonacci ratios -> tau.
// null is the true quasicrystal.
export const APPROXIMANT_STOPS = [[1, 1], [2, 1], [3, 2], [5, 3], [8, 5], [13, 8], null];

// Base cut offset in perp space; phason sliders add to it. Chosen generic
// (no lattice point on a window boundary; a symmetric offset such as one on
// a 5-fold axis lies in the window's facet planes and is singular). 5D: the
// diagonal component c/2 is what makes the tiling a true Penrose tiling
// (four pentagonal windows); the in-plane part is the phason.
export const BASE_OFFSET = {
  '6d': [0.0123, 0.0071, 0.0047],
  '5d': [0.0123, 0.0071, DIAG5 / 2],
};

// Create an engine for one world. approximant: null (true quasicrystal) or
// [a, b] with a/b a Fibonacci ratio.
export function makeQuasicrystal(tier, approximant = null) {
  const spec = TIERS[tier];
  if (!spec) throw new Error(`unknown quasicrystal tier ${tier}`);
  const q = approximant ? approximant[0] / approximant[1] : PHI;
  const { par, perp } = frame(tier, q); // par is always golden
  const d = spec.d;
  const all = [...Array(d).keys()];

  const perpOf = (n) => n.reduce((v, ni, i) => (ni ? addScaled(v, perp[i], ni) : v), [0, 0, 0]);
  const parOf = (n) => n.reduce((v, ni, i) => (ni ? addScaled(v, par[i], ni) : v), par[0].map(() => 0));

  // Coefficients c_l of y in the complementary perp vectors (any three are
  // independent in both worlds). |c_l| <= 1/2 for all l <=> the face is a tile.
  function faceCoefficients(n, I, offset) {
    let y = addScaled(offset, perpOf(n), -1);
    for (const i of I) y = addScaled(y, perp[i], -0.5);
    const rest = all.filter((l) => !I.includes(l));
    const [a, b, c] = rest.map((l) => perp[l]);
    return solve3(a, b, c, y);
  }

  function isTile(n, I, offset) {
    return faceCoefficients(n, I, offset).every((c) => Math.abs(c) <= 0.5);
  }

  // Distance of the face's test from the window boundary (0 = singular).
  function margin(n, I, offset) {
    return Math.min(...faceCoefficients(n, I, offset).map((c) => Math.abs(Math.abs(c) - 0.5)));
  }

  // The window is the zonotope sum_l [-1/2, 1/2] perp(e_l) (rhombic
  // triacontahedron in 6D, rhombic icosahedron in 5D), as facet planes: one
  // normal per pair of generators.
  const windowPlanes = [];
  for (let a = 0; a < d; a++) for (let b = a + 1; b < d; b++) {
    const g1 = perp[a], g2 = perp[b];
    const nrm = [g1[1] * g2[2] - g1[2] * g2[1], g1[2] * g2[0] - g1[0] * g2[2], g1[0] * g2[1] - g1[1] * g2[0]];
    const normal = nrm.map((x) => x / Math.hypot(...nrm));
    windowPlanes.push({ normal, half: 0.5 * perp.reduce((s, g) => s + Math.abs(dot(g, normal)), 0) });
  }

  // Vertex n of Z^d is in the tiling iff offset - perp(n) is in the window.
  function isVertex(n, offset) {
    const y = addScaled(offset, perpOf(n), -1);
    return windowPlanes.every(({ normal, half }) => Math.abs(dot(normal, y)) <= half + EPS);
  }

  // Window vertices (the zonotope's corners), for Window View.
  function windowVertices() {
    const pts = [];
    for (let m = 0; m < 1 << d; m++) {
      let v = [0, 0, 0];
      for (let i = 0; i < d; i++) v = addScaled(v, perp[i], m & (1 << i) ? 0.5 : -0.5);
      pts.push(v);
    }
    // Keep only extreme points: those on at least three facet planes.
    return pts.filter((p) => windowPlanes.filter(({ normal, half }) => Math.abs(Math.abs(dot(normal, p)) - half) < 1e-7).length >= 3)
      .filter((p, i, arr) => arr.findIndex((o) => Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]) < 1e-7) === i);
  }

  // Physical vertices of a tile, in growth.js's order (index a*4 + b*2 + c
  // over the three edges), so tilesOverlap applies. 5D tiles are prisms:
  // the Penrose plane is x/z and layers stack along y.
  function tileVertices(n, I, layer = 0) {
    const origin = parOf(n);
    let o, edges;
    if (tier === '6d') {
      o = origin;
      edges = I.map((i) => par[i]);
    } else {
      const lift = (p) => [p[0], 0, p[1]];
      o = [origin[0], layer * PRISM_HEIGHT, origin[1]];
      edges = [lift(par[I[0]]), lift(par[I[1]]), [0, PRISM_HEIGHT, 0]];
    }
    const verts = [];
    for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) {
      verts.push([0, 1, 2].map((x) => o[x] + a * edges[0][x] + b * edges[1][x] + c * edges[2][x]));
    }
    return verts;
  }

  // Tile type. 6D: 'prolate' or 'oblate' (by the sign pattern of the three
  // edge dot products). 5D: 'thick' (72 deg) or 'thin' (36 deg).
  function tileType(I) {
    const e = I.map((i) => par[i]);
    if (tier === '6d') {
      const acute = dot(e[0], e[1]) * dot(e[0], e[2]) * dot(e[1], e[2]) > 0;
      return acute ? 'prolate' : 'oblate';
    }
    return Math.abs(dot(e[0], e[1])) < 0.5 ? 'thick' : 'thin';
  }

  // The faces of a tile, as (m, K) with |K| = |I| - 1. Each has two sides:
  // at n and at n + e_i, for the dropped direction i.
  function tileFaces(n, I) {
    const faces = [];
    for (const i of I) {
      const K = I.filter((j) => j !== i);
      faces.push({ n, K, drop: i, side: 0 });
      faces.push({ n: n.map((x, j) => x + (j === i ? 1 : 0)), K, drop: i, side: 1 });
    }
    return faces;
  }

  // Every tile containing face (m, K) under this offset. In a valid tiling
  // there are exactly two.
  function tilesOnFace(m, K, offset) {
    const out = [];
    for (let j = 0; j < d; j++) {
      if (K.includes(j)) continue;
      const J = [...K, j].sort((a, b) => a - b);
      for (const eps of [0, 1]) {
        const n = m.map((x, l) => x - (l === j ? eps : 0));
        if (isTile(n, J, offset)) out.push({ n, I: J });
      }
    }
    return out;
  }

  // The tile across face `f` (from tileFaces) of tile (n, I), or null.
  function neighbourAcross(n, I, f, offset) {
    const self = tileKey(n, I);
    const other = tilesOnFace(f.n, f.K, offset).filter((t) => tileKey(t.n, t.I) !== self);
    return other.length === 1 ? other[0] : null;
  }

  // A tile near the physical origin: search growing boxes of Z^d.
  function seedTile(offset) {
    for (let r = 1; r <= 4; r++) {
      let best = null;
      const n = new Array(d).fill(-r);
      for (;;) {
        for (const I of subsets(d, spec.k)) {
          if (!isTile(n, I, offset)) continue;
          const c = centroid(tileVertices(n, I));
          const dist = Math.hypot(...c);
          if (!best || dist < best.dist) best = { n: n.slice(), I, dist };
        }
        let i = 0;
        while (i < d && n[i] === r) n[i++] = -r;
        if (i === d) break;
        n[i]++;
      }
      if (best && best.dist < 1.5) return { n: best.n, I: best.I };
    }
    throw new Error('seedTile: no tile near the origin');
  }

  // All tiles with centroid within `radius` of the physical origin
  // (5D: of the Penrose plane, one layer), by walking face neighbours.
  function patch(offset, radius) {
    const start = seedTile(offset);
    const seen = new Map([[tileKey(start.n, start.I), start]]);
    const queue = [start];
    while (queue.length) {
      const t = queue.pop();
      for (const f of tileFaces(t.n, t.I)) {
        for (const u of tilesOnFace(f.n, f.K, offset)) {
          const key = tileKey(u.n, u.I);
          if (seen.has(key)) continue;
          if (Math.hypot(...centroid(tileVertices(u.n, u.I))) > radius + 3) continue;
          seen.set(key, u);
          queue.push(u);
        }
      }
    }
    return [...seen.values()].filter((t) => Math.hypot(...centroidXZ(t)) <= radius);
  }
  const centroidXZ = (t) => {
    const c = centroid(tileVertices(t.n, t.I));
    return tier === '6d' ? c : [c[0], c[2]];
  };

  return {
    tier, d, k: spec.k, q, approximant,
    par: par, perp,
    perpOf, parOf,
    isTile, margin, isVertex, windowVertices, windowPlanes,
    tileVertices, tileType, tileFaces, tilesOnFace, neighbourAcross,
    seedTile, patch,
  };
}

export function tileKey(n, I, layer) {
  return `${n.join(',')}|${I.join('')}${layer === undefined ? '' : `|${layer}`}`;
}

export function centroid(verts) {
  return [0, 1, 2].map((x) => verts.reduce((s, v) => s + v[x], 0) / verts.length);
}

// Integer period vectors of an approximant: lattice vectors in E_q, so the
// tiling is invariant under them. Each is a par row of the approximant with
// denominators cleared.
export function approximantPeriods(tier, [a, b]) {
  if (tier === '6d') {
    return [0, 1, 2].map((k) => ICOSA_AXES.map((ax) => {
      const s = icosaCoord(ax[k], 1);
      return Math.abs(Math.abs(ax[k]) - 1) < 1e-4 ? s * b : s * a; // 1 -> b, t -> a (times b)
    }));
  }
  // x row (1, 1/2q, -q/2, -q/2, 1/2q) * 2ab; y row (0, 1, 1/q, -1/q, -1) * a.
  return [[2 * a * b, b * b, -a * a, -a * a, b * b], [0, a, b, -b, -a]];
}

export function* subsets(d, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i < d; i++) { acc.push(i); yield* subsets(d, k, i + 1, acc); acc.pop(); }
}
