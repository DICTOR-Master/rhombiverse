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

// Cell kinds: center validity + vertex offsets from a (real, undoubled)
// center. A 16-cell's vertices are the D4 points at distance 1 from its
// deep hole -- 8 of the 24 candidate offsets, which 8 depends on the
// coset (triality), so it's computed, not tabulated.
export const KINDS_4D = {
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
// hyperplane (exact for these regular honeycombs -- verify-4d checks
// every result lands on a valid center of the same kind).
export function neighborAcrossFacet(kind, center, facetIndex) {
  const f = cellStructure(kind, center).facets[facetIndex];
  return add4(center, scale4(f.normal, 2 * f.d));
}

// ---- viewing ----
// Slice (direct decision: the default view): the 3D cross-section of a
// cell by the hyperplane w' = w0 of the ROTATED frame (p' = R p). Returns
// the section's 3D points (x', y', z'), or null when the slice misses the
// cell or only grazes it (< 4 non-coplanar points, e.g. touching a single
// vertex). Half-open ownership (minW <= w0 < maxW) so a slice lying
// exactly on a shared facet shows that facet once, not twice.
export function sliceCell(verts4, edges, R, w0) {
  const p = verts4.map((v) => matVec(R, v));
  const ws = p.map((v) => v[3] - w0);
  const minW = Math.min(...ws), maxW = Math.max(...ws);
  if (!(minW <= 1e-9 && maxW > 1e-9)) return null;
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
