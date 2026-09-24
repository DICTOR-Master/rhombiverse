// 4D lattice worlds (2026-09-24 design, see the D4 plan in memory /
// docs): pure geometry, no THREE -- everything here is checked in Node by
// scripts/verify-4d.mjs.
//
// Frame (direct decision): ONE integer (x, y, z, w) frame at the RD
// world's own scale, extending core/lattice.js's FCC (even-sum integer
// points, nearest-neighbor sqrt(2)) by a fourth coordinate. w = 0 is the
// FCC floor: the D4 world's own w = 0 slice is EXACTLY the RD world (a
// 24-cell centered on a w = 0 D4 point cuts w = 0 in rdRawVerts(1) --
// verified in verify-4d).
//
// D4 = integer 4-vectors with an even coordinate sum. Its Voronoi cell is
// the 24-cell (vertices: permutations of (+-1,0,0,0) and (+-1/2)^4, edge
// 1) and its Delaunay cells are 16-cells (edge sqrt(2)) centered on the
// deep holes D4* \ D4 -- odd-sum integer points and all-half-integer
// points (three cosets, D4's triality). Cell centers are stored DOUBLED
// (all integers) so both kinds share one integer key space.
//
// Everything a cell needs (vertices, edges, facets, neighbor across a
// facet) is derived generically from its vertex list rather than hand-
// authored per kind, so the Tesseract (Z4) and Hyper-pyrochlore (A4)
// worlds can reuse the same machinery later.

export const EPS = 1e-9;

// ---- small 4-vector / 4x4 helpers (ported from polyhedraverse's
// app/lib/polyhedra/radialProjection.ts: matMul, matVec, dot4) ----
export function matMul(a, b) {
  const r = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[i][k] * b[k][j];
    r[i][j] = s;
  }
  return r;
}
export function matVec(a, v) {
  return [0, 1, 2, 3].map((i) => a[i][0] * v[0] + a[i][1] * v[1] + a[i][2] * v[2] + a[i][3] * v[3]);
}
export function dot4(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }
const sub4 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
const add4 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
const scale4 = (a, k) => [a[0] * k, a[1] * k, a[2] * k, a[3] * k];

// Rotation into w (direct decision): three planes XW, YW, ZW, each with
// its own stored angle, ALWAYS composed in the fixed order XW -> YW -> ZW
// so the same three angles always give the same view (and save/reload
// cleanly). Returns the matrix applied to world points.
function planeRotation(axis, angle) {
  const m = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const c = Math.cos(angle), s = Math.sin(angle);
  m[axis][axis] = c; m[axis][3] = -s;
  m[3][axis] = s; m[3][3] = c;
  return m;
}
export function rotation4({ xw = 0, yw = 0, zw = 0 } = {}) {
  return matMul(planeRotation(2, zw), matMul(planeRotation(1, yw), planeRotation(0, xw)));
}

// ---- D4 membership ----
const isInt = (v) => Math.abs(v - Math.round(v)) < EPS;
export function isD4(p) {
  return p.every(isInt) && Math.round(p[0] + p[1] + p[2] + p[3]) % 2 === 0;
}
// Deep holes of D4 (16-cell centers): odd-sum integer points, or all
// coordinates half-odd-integers.
export function isD4DeepHole(p) {
  if (p.every(isInt)) return Math.abs(Math.round(p[0] + p[1] + p[2] + p[3])) % 2 === 1;
  return p.every((v) => isInt(v - 0.5));
}

const PERM_UNITS = [];
for (let i = 0; i < 4; i++) for (const s of [1, -1]) { const v = [0, 0, 0, 0]; v[i] = s; PERM_UNITS.push(v); }
const HALF_SIGNS = [];
for (const a of [0.5, -0.5]) for (const b of [0.5, -0.5]) for (const c of [0.5, -0.5]) for (const d of [0.5, -0.5]) HALF_SIGNS.push([a, b, c, d]);

// 24-cell (D4 Voronoi cell) vertex offsets: the 24 deep holes nearest a
// lattice point, all at distance 1.
export const CELL24_OFFSETS = [...PERM_UNITS, ...HALF_SIGNS];

// ---- Hyper-pyrochlore: the A4 world ----
// A4 lives in the sum-zero hyperplane of R^5. Its embedding into the
// shared (x, y, z, w) frame (direct decisions, verified numerically before
// any code): xyz = sum over i<4 of p_i * S_i / 2 (S = Pyrochlore's own
// PYROCHLORE_S directions), w = p_4 / sqrt(0.8). That is an isometry, puts
// A4's nodes' w = 0 layer exactly on the RD world's FCC floor, and puts
// the slice w = -sqrt(5)/20 exactly on the existing Pyrochlore world.
//
// The honeycomb is the cyclotruncated 5-cell honeycomb: corner-sharing
// regular 5-cells (every corner in exactly two) with truncated and
// bitruncated 5-cell gaps. Its cells sit on A4*'s five cosets
// A4 + k*b0 (b_i = e_i - (1/5)(1,1,1,1,1)): k = 0, 1 -> 5-cells (two
// orientations), k = 2, 4 -> truncated 5-cells (two orientations, like
// Pyrochlore's O- and T-sites), k = 3 -> bitruncated 5-cells.
const A4_S = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]; // = PYROCHLORE_S
const SQRT08 = Math.sqrt(0.8);
export const A4_REST_W = -Math.sqrt(5) / 20; // the Pyrochlore slice
export function a4To4(p) {
  const xyz = [0, 1, 2].map((a) => (p[0] * A4_S[0][a] + p[1] * A4_S[1][a] + p[2] * A4_S[2][a] + p[3] * A4_S[3][a]) / 2);
  return [...xyz, p[4] / SQRT08];
}
export function a4From4(x) {
  const p4 = x[3] * SQRT08;
  const p = A4_S.map((S) => (S[0] * x[0] + S[1] * x[1] + S[2] * x[2]) / 2 - p4 / 4);
  return [...p, p4];
}
const A4_B = [0, 1, 2, 3, 4].map((i) => [0, 1, 2, 3, 4].map((j) => (i === j ? 0.8 : -0.2)));
// Coset class of a 5D point (0..4), or -1 if it isn't an A4* point.
export function a4Class(p) {
  const q = p.map((v) => v * 5);
  if (!q.every((v) => Math.abs(v - Math.round(v)) < 1e-6) || Math.abs(q.reduce((a, v) => a + v, 0)) > 1e-6) return -1;
  const k = ((-Math.round(q[0]) % 5) + 5) % 5;
  return q.every((v) => ((-Math.round(v) % 5) + 5) % 5 === k) ? k : -1;
}
export const A4_CLASS_KIND = ['a4cell5', 'a4cell5', 'a4trunc', 'a4bitrunc', 'a4trunc'];
const A4_EDGE = Math.SQRT2 / 2;
const A4_CIRCUMRADIUS = { a4cell5: Math.sqrt(0.2), a4trunc: Math.sqrt(0.8), a4bitrunc: 1 };
// Honeycomb vertices near a 5D point: every b_i/2 step from A4 points
// within a small box (enough for any cell's circumradius <= 1).
const a4OffsetCache = new Map();
function a4ClassOffsets(k) {
  if (a4OffsetCache.has(k)) return a4OffsetCache.get(k);
  // Representative near the origin: k * b0 reduced to k in -2..2.
  const rep = A4_B[0].map((v) => v * (k > 2 ? k - 5 : k));
  const kind = A4_CLASS_KIND[k];
  const R = A4_CIRCUMRADIUS[kind];
  const found = new Map();
  const r = [-2, -1, 0, 1, 2];
  for (const a of r) for (const b of r) for (const c of r) for (const d of r) {
    const v = [a, b, c, d, -(a + b + c + d)];
    if (Math.abs(v[4]) > 3) continue;
    for (const bi of A4_B) {
      const site = v.map((x, j) => x + bi[j] / 2 - rep[j]);
      const dist = Math.sqrt(site.reduce((sum, x) => sum + x * x, 0));
      if (Math.abs(dist - R) < 1e-6) found.set(site.map((x) => Math.round(x * 10)).join(','), a4To4(site));
    }
  }
  const offsets = [...found.values()];
  a4OffsetCache.set(k, offsets);
  return offsets;
}
function a4Kind(kind) {
  const isCenter = (c) => { const k = a4Class(a4From4(c)); return k >= 0 && A4_CLASS_KIND[k] === kind; };
  return {
    family: 'a4',
    isCenter,
    vertexOffsets: (c) => a4ClassOffsets(a4Class(a4From4(c))),
    // Keys: 5x the 5D coordinates (all integers on A4*).
    key: (c) => a4From4(c).map((v) => Math.round(v * 5)),
    fromKey: (q) => a4To4(q.map((v) => v / 5)),
  };
}
// Candidate neighbors of any A4* cell: the 10 shortest A4* steps +-b_i
// (length sqrt(0.8)) -- every facet neighbor in this honeycomb is one.
const A4_STEPS = [...A4_B, ...A4_B.map((b) => b.map((v) => -v))].map(a4To4);
// Cell kinds: center validity + vertex offsets from a (real, undoubled)
// center. A 16-cell's vertices are the D4 points at distance 1 from its
// deep hole -- 8 of the 24 candidate offsets, which 8 depends on the
// coset (triality), so it's computed, not tabulated.
export const KINDS_4D = {
  a4cell5: { label: '5-cell', ...a4Kind('a4cell5') },
  a4trunc: { label: 'Truncated 5-cell', ...a4Kind('a4trunc') },
  a4bitrunc: { label: 'Bitruncated 5-cell', ...a4Kind('a4bitrunc') },
  // Z4 (Hypercubic): one tesseract per integer point, vertices (+-1/2)^4,
  // edge 1 -- the same edge as the 24-cell, and its w = 0 slice is the
  // RD world's own unit cube (at every integer point: simple cubic).
  tesseract: {
    label: 'Tesseract',
    isCenter: (p) => p.every(isInt),
    vertexOffsets: () => HALF_SIGNS,
  },
  cell24: {
    label: '24-cell',
    isCenter: isD4,
    vertexOffsets: () => CELL24_OFFSETS,
  },
  cell16: {
    label: '16-cell',
    isCenter: isD4DeepHole,
    vertexOffsets: (c) => CELL24_OFFSETS.filter((o) => isD4(add4(c, o))),
  },
};

// Doubled integer keys <-> real centers.
export const toDoubled = (c) => c.map((v) => Math.round(v * 2));
export const fromDoubled = (d) => d.map((v) => v / 2);
export const cellKey4 = (kind, d) => `${kind}|${d.join(',')}`;


// ---- generic polytope structure from a vertex list (centered) ----
function edgesByMinDistance(verts) {
  let min = Infinity;
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    const d = dot4(sub4(verts[i], verts[j]), sub4(verts[i], verts[j]));
    if (d < min) min = d;
  }
  const edges = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) {
    const d = dot4(sub4(verts[i], verts[j]), sub4(verts[i], verts[j]));
    if (Math.abs(d - min) < 1e-6 * min) edges.push([i, j]);
  }
  return edges;
}

// Normal of the hyperplane through 4 points (generalized cross product),
// or null if they're degenerate.
function hyperplaneNormal(p0, p1, p2, p3) {
  const a = sub4(p1, p0), b = sub4(p2, p0), c = sub4(p3, p0);
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const n = [0, 1, 2, 3].map((i) => {
    const cols = [0, 1, 2, 3].filter((k) => k !== i);
    const m = [a, b, c].map((r) => cols.map((k) => r[k]));
    return (i % 2 === 0 ? 1 : -1) * det3(m);
  });
  const len = Math.sqrt(dot4(n, n));
  return len < 1e-9 ? null : scale4(n, 1 / len);
}

// Facets: every supporting hyperplane holding >= 4 vertices. Brute force
// over 4-subsets is fine at these sizes (24-cell: 10626 subsets, once
// per kind/coset, cached). Each facet: { normal (unit, outward), d
// (plane offset, normal . x = d), verts (indices) }.
function facetsOf(verts) {
  const facets = new Map();
  const n = verts.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let e = c + 1; e < n; e++) {
    let nrm = hyperplaneNormal(verts[a], verts[b], verts[c], verts[e]);
    if (!nrm) continue;
    let d = dot4(nrm, verts[a]);
    if (d < 0) { nrm = scale4(nrm, -1); d = -d; }
    if (d < 1e-9) continue; // plane through the center: never a facet of a centered convex cell
    let ok = true;
    const on = [];
    for (let i = 0; i < n; i++) {
      const t = dot4(nrm, verts[i]) - d;
      if (t > 1e-7) { ok = false; break; }
      if (t > -1e-7) on.push(i);
    }
    if (!ok) continue;
    const key = on.join(',');
    if (!facets.has(key)) facets.set(key, { normal: nrm, d, verts: on });
  }
  return [...facets.values()];
}

const structureCache = new Map();
// Centered structure of a cell kind at a given center (vertex offsets,
// edges, facets), cached by the offset set itself so every coset shares.
export function cellStructure(kind, center) {
  const offsets = KINDS_4D[kind].vertexOffsets(center);
  const key = `${kind}|${offsets.map((o) => o.join(',')).join(';')}`;
  let s = structureCache.get(key);
  if (!s) {
    s = { offsets, edges: edgesByMinDistance(offsets), facets: facetsOf(offsets) };
    structureCache.set(key, s);
  }
  return s;
}

export function cellVertices4(kind, center) {
  return cellStructure(kind, center).offsets.map((o) => add4(center, o));
}

// Neighbor across a facet: the center reflected through the facet's own
// hyperplane (exact for the regular Z4 and D4 honeycombs -- verify-4d
// checks every result lands on a valid center of the same kind).
export function neighborAcrossFacet(kind, center, facetIndex) {
  const f = cellStructure(kind, center).facets[facetIndex];
  return add4(center, scale4(f.normal, 2 * f.d));
}

// The cell across a facet, any kind: { kind, c }. Z4/D4: the same-kind
// reflection above. A4 (not a regular honeycomb -- 5-cells, truncated and
// bitruncated 5-cells meet each other): the one of the 10 +-b_i steps
// whose cell holds every vertex of that facet.
export function cellAcrossFacet(kind, center, facetIndex) {
  if (KINDS_4D[kind].family !== 'a4') return { kind, c: neighborAcrossFacet(kind, center, facetIndex) };
  const s = cellStructure(kind, center);
  const facetPts = s.facets[facetIndex].verts.map((i) => add4(center, s.offsets[i]));
  for (const step of A4_STEPS) {
    const c = add4(center, step);
    const k = a4Class(a4From4(c));
    if (k < 0) continue;
    const nk = A4_CLASS_KIND[k];
    const verts = cellVertices4(nk, c);
    if (facetPts.every((p) => verts.some((v) => Math.abs(v[0] - p[0]) + Math.abs(v[1] - p[1]) + Math.abs(v[2] - p[2]) + Math.abs(v[3] - p[3]) < 1e-6))) return { kind: nk, c };
  }
  return null;
}

// First cells of the A4 world at its rest slice (direct decisions), found
// by search and checked in verify-4d. At the rest (Pyrochlore) slice,
// Pyrochlore's truncated tetrahedra all come from truncated 5-cells: cut
// through their middle at its T-sites, and at its O-sites as the facet a
// truncated 5-cell (below) shares with a bitruncated one (above); its
// up/down tetrahedra are facets of the two 5-cell orientations. So: the 5-cell whose facet is the up-tetrahedron at the
// origin; the truncated 5-cell whose slice is the T-site truncated
// tetrahedron at (-1/2,-1/2,-1/2); and the bitruncated 5-cell whose slice
// is Pyrochlore's own first truncated tetrahedron at (1, 0, 0) (render.js
// PYROCHLORE_FIRST).
export const A4_FIRST = {
  a4cell5: a4To4([0, 0, 0, 0, 0]),
  a4trunc: a4To4([-0.8, 0.2, 0.2, 0.2, 0.2]),
  a4bitrunc: a4To4([0.4, 0.4, -0.6, -0.6, 0.4]),
};
// Straight through a bitruncated gap (direct decision, Pyrochlore-style
// growth): a bitruncated 5-cell is centrally symmetric, so the truncated
// 5-cell opposite a given one is its reflection through the gap's center.
export function throughGap(truncCenter, bitruncCenter) {
  return add4(scale4(bitruncCenter, 2), scale4(truncCenter, -1));
}
// 5-cells share corners in pairs (every honeycomb vertex is the midpoint
// of the two 4D-diamond nodes it joins): the partner of a 5-cell across
// its corner v is the 5-cell reflected through v.
export function cornerPartner(cell5Center, corner) {
  return add4(scale4(corner, 2), scale4(cell5Center, -1));
}

// ---- viewing ----
// Slice (direct decision: the default view): the 3D cross-section of a
// cell by the hyperplane w' = w0 of the ROTATED frame (p' = R p). Returns
// the section's 3D points (x', y', z'), or null when the slice misses the
// cell or only grazes it (< 4 non-coplanar points, e.g. touching a single
// vertex). CLOSED: a cell with a whole facet lying in the slice shows that
// facet -- needed at the Pyrochlore rest slice, where every tetrahedron is
// such a facet (up-tets of 5-cells, down-tets of truncated 5-cells). Two
// cells sharing that facet then give identical sections; world-4d.js
// draws only one (dedupeSections).
export function sliceCell(verts4, edges, R, w0) {
  const p = verts4.map((v) => matVec(R, v));
  const ws = p.map((v) => v[3] - w0);
  const minW = Math.min(...ws), maxW = Math.max(...ws);
  if (minW > 1e-9 || maxW < -1e-9) return null;
  const pts = [];
  p.forEach((v, i) => { if (Math.abs(ws[i]) <= 1e-9) pts.push([v[0], v[1], v[2]]); });
  for (const [i, j] of edges) {
    if ((ws[i] < -1e-9 && ws[j] > 1e-9) || (ws[i] > 1e-9 && ws[j] < -1e-9)) {
      const t = ws[i] / (ws[i] - ws[j]);
      pts.push([0, 1, 2].map((k) => p[i][k] + t * (p[j][k] - p[i][k])));
    }
  }
  return isSolid3(pts) ? pts : null;
}

// Identical sections (two cells sharing a facet that lies in the slice)
// are drawn once. Items: { pts, rank, w } -- lower rank wins (5-cells
// over truncated over bitruncated, so Pyrochlore's tetrahedra read as
// their own cells), then the cell whose center is higher in w (the one
// the facet is the bottom of, matching the old half-open rule for D4).
export function dedupeSections(items) {
  const best = new Map();
  for (const it of items) {
    const key = it.pts.map((q) => q.map((v) => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(5)).join(',')).sort().join(';');
    const cur = best.get(key);
    if (!cur || it.rank < cur.rank || (it.rank === cur.rank && it.w > cur.w)) best.set(key, it);
  }
  return [...best.values()];
}

// Projection view (parallel by default, perspective as an option):
// projects a 4D point of the ROTATED frame to 3D. Perspective ports
// polyhedraverse's projectVec4ToVec3 (v / (d - w), denominator guarded)
// and multiplies back by d so content at w = 0 keeps its true size --
// the parallel and perspective views then agree on the w = 0 floor.
export const PERSPECTIVE_DISTANCE = 4;
const MIN_VIEW_DENOMINATOR = 0.05;
export function project4(v, perspective) {
  if (!perspective) return [v[0], v[1], v[2]];
  const k = PERSPECTIVE_DISTANCE / Math.max(PERSPECTIVE_DISTANCE - v[3], MIN_VIEW_DENOMINATOR);
  return [v[0] * k, v[1] * k, v[2] * k];
}

// Which facet a tapped slice face belongs to: the section face's own 3D
// normal is the facet normal's component inside the slice hyperplane
// (rotated frame, first 3 coordinates) -- pick the facet whose projected
// normal points the same way. Only facets actually crossed by the slice
// are candidates.
export function facetForSliceNormal(kind, center, R, w0, n3) {
  const s = cellStructure(kind, center);
  const verts = s.offsets.map((o) => matVec(R, add4(center, o)));
  let best = -1, bestCos = 0.99;
  s.facets.forEach((f, idx) => {
    const ws = f.verts.map((i) => verts[i][3] - w0);
    if (Math.min(...ws) > 1e-9 || Math.max(...ws) < -1e-9) return;
    const rn = matVec(R, f.normal);
    const len = Math.hypot(rn[0], rn[1], rn[2]);
    if (len < 1e-6) return;
    const cos = (rn[0] * n3[0] + rn[1] * n3[1] + rn[2] * n3[2]) / (len * Math.hypot(...n3));
    if (cos > bestCos) { bestCos = cos; best = idx; }
  });
  return best;
}

// True when a 3D point set spans a solid (has 4 non-coplanar points).
export function isSolid3(pts) {
  if (pts.length < 4) return false;
  const a = pts[0];
  let b = null, c = null;
  for (const p of pts) {
    if (!b) { if (Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) > 1e-7) b = p; continue; }
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (!c && Math.hypot(...cr) > 1e-7) { c = cr; continue; }
    if (c && Math.abs(c[0] * v[0] + c[1] * v[1] + c[2] * v[2]) > 1e-7) return true;
  }
  return false;
}
