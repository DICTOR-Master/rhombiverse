// Verifies src/geometry-extensions/lattice-4d.js against the real
// geometric facts the 4D design rests on (every one of these was first
// checked numerically in the design session before any code existed).
import {
  isD4, isD4DeepHole, KINDS_4D, CELL24_OFFSETS, cellStructure, cellVertices4,
  neighborAcrossFacet, rotation4, matVec, sliceCell, facetForSliceNormal, project4,
  toDoubled, fromDoubled, dot4, dedupeSections,
  a4To4, a4From4, a4Class, A4_CLASS_KIND, A4_REST_W, A4_FIRST, cellAcrossFacet, throughGap, cornerPartner,
} from '../src/geometry-extensions/lattice-4d.js';
import { pyrochloreSiteOrientation } from '../src/geometry-extensions/pyrochlore-lattice.js';
import { rdRawVerts } from '../src/core/lattice.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}
const key3 = (p) => p.map((n) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(6)).join(',');
const sameSet3 = (a, b) => {
  const A = new Set(a.map(key3)), B = new Set(b.map(key3));
  return A.size === B.size && [...A].every((k) => B.has(k));
};
const O = [0, 0, 0, 0];

// D4 itself.
const d4Near = [];
for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) for (const d of [-1, 0, 1]) {
  const p = [a, b, c, d];
  if (isD4(p) && dot4(p, p) === 2) d4Near.push(p);
}
check('D4 has 24 nearest neighbors at distance sqrt(2)', d4Near.length === 24);

// 24-cell = D4 Voronoi cell.
const s24 = cellStructure('cell24', O);
check('24-cell: 24 vertices', s24.offsets.length === 24);
check('24-cell: 96 edges, all length 1', s24.edges.length === 96);
check('24-cell: 24 facets (octahedra, 6 vertices each)', s24.facets.length === 24 && s24.facets.every((f) => f.verts.length === 6));
check('24-cell vertices are D4 deep holes, each at distance 1', CELL24_OFFSETS.every((o) => isD4DeepHole(o) && Math.abs(dot4(o, o) - 1) < 1e-9));
// Voronoi check: every vertex is equidistant (1) from the origin and no
// D4 point is closer.
const lat = [];
for (const a of [-2, -1, 0, 1, 2]) for (const b of [-2, -1, 0, 1, 2]) for (const c of [-2, -1, 0, 1, 2]) for (const d of [-2, -1, 0, 1, 2]) if (isD4([a, b, c, d])) lat.push([a, b, c, d]);
check('24-cell vertices are Voronoi vertices of D4 (no lattice point closer than the center)', CELL24_OFFSETS.every((v) => lat.every((p) => dot4([v[0] - p[0], v[1] - p[1], v[2] - p[2], v[3] - p[3]], [v[0] - p[0], v[1] - p[1], v[2] - p[2], v[3] - p[3]]) >= 1 - 1e-9)));
const n24 = s24.facets.map((_, i) => neighborAcrossFacet('cell24', O, i));
const key4 = (p) => p.map((v) => v.toFixed(6)).join(',');
check('24-cell neighbors across facets = the 24 D4 nearest neighbors', new Set(n24.map(key4)).size === 24 && n24.every((p) => d4Near.some((q) => key4(q) === key4(p))));

// 16-cells on all three deep-hole cosets.
for (const c of [[1, 0, 0, 0], [0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, -0.5]]) {
  const s = cellStructure('cell16', c);
  const verts = cellVertices4('cell16', c);
  check(`16-cell at (${c}): 8 D4 vertices, 24 edges of length sqrt(2), 16 tetrahedral facets`,
    verts.length === 8 && verts.every(isD4) && s.edges.length === 24 && s.facets.length === 16 && s.facets.every((f) => f.verts.length === 4));
  const nb = s.facets.map((_, i) => neighborAcrossFacet('cell16', c, i));
  check(`16-cell at (${c}): every facet neighbor is another deep hole at distance 1`, nb.every((p) => isD4DeepHole(p) && Math.abs(dot4(p.map((v, k) => v - c[k]), p.map((v, k) => v - c[k])) - 1) < 1e-9));
  // The neighbor shares exactly that facet's 4 vertices.
  check(`16-cell at (${c}): neighbors share the whole facet`, s.facets.every((f, i) => {
    const other = new Set(cellVertices4('cell16', nb[i]).map((v) => v.join(',')));
    return f.verts.every((vi) => other.has(verts[vi].join(',')));
  }));
}

// Tiling by volume: D4's covolume is 2 (index 2 in Z4). One 24-cell per
// lattice point must have volume 2; 16-cells come 3 per lattice point
// (three deep-hole cosets), so each must have volume 2/3. Volumes are
// computed from the real facets: V4 = sum over facets of (d / 4) * V3,
// with each facet's own V3 from its 3D hull (divergence theorem).
function facetVolume3(pts4, normal) {
  // Orthonormal basis of the facet's hyperplane (Gram-Schmidt vs normal).
  const basis = [];
  for (const e of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) {
    let v = e.map((x, i) => x - dot4(e, normal) * normal[i]);
    for (const b of basis) { const k = dot4(v, b); v = v.map((x, i) => x - k * b[i]); }
    const len = Math.sqrt(dot4(v, v));
    if (len > 1e-6) basis.push(v.map((x) => x / len));
    if (basis.length === 3) break;
  }
  const p3 = pts4.map((p) => basis.map((b) => dot4(p, b)));
  // Divergence theorem over the facet's own 2D faces: every supporting
  // point-triple spans a face plane; each distinct plane's coplanar
  // points form one convex polygon (ordered by angle), and each polygon
  // adds area * (distance from the centroid) / 3. Handles square faces
  // (tesseract cubes) as well as triangles. (THREE isn't a Node
  // dependency of this repo.)
  const g = [0, 1, 2].map((k) => p3.reduce((sum, p) => sum + p[k], 0) / p3.length);
  const d = p3.map((p) => [p[0] - g[0], p[1] - g[1], p[2] - g[2]]);
  const planes = new Map();
  for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) for (let k = j + 1; k < d.length; k++) {
    const u = d[j].map((x, a) => x - d[i][a]), v = d[k].map((x, a) => x - d[i][a]);
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    if (len < 1e-9) continue;
    n = n.map((x) => x / len);
    let off = n[0] * d[i][0] + n[1] * d[i][1] + n[2] * d[i][2];
    if (off < 0) { n = n.map((x) => -x); off = -off; }
    const side = d.map((p) => n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - off);
    if (side.some((t) => t > 1e-9)) continue;
    const on = side.map((t, idx) => (Math.abs(t) < 1e-9 ? idx : -1)).filter((idx) => idx >= 0);
    planes.set(on.join(','), { n, off, on });
  }
  let vol = 0;
  for (const { n, off, on } of planes.values()) {
    const c = [0, 1, 2].map((a) => on.reduce((sum, idx) => sum + d[idx][a], 0) / on.length);
    const e1 = d[on[0]].map((x, a) => x - c[a]);
    const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const pts = on.map((idx) => d[idx].map((x, a) => x - c[a])).sort((a, b) => Math.atan2(dot(a, e2), dot(a, e1)) - Math.atan2(dot(b, e2), dot(b, e1)));
    let area = 0;
    for (let m = 0; m < pts.length; m++) {
      const a = pts[m], b = pts[(m + 1) % pts.length];
      area += dot(n, [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]) / 2;
    }
    vol += Math.abs(area) * off / 3;
  }
  return vol;
}
function volume4(kind, c) {
  const s = cellStructure(kind, c);
  return s.facets.reduce((sum, f) => sum + (f.d / 4) * facetVolume3(f.verts.map((i) => s.offsets[i]), f.normal), 0);
}
check('24-cell volume = 2 = D4 covolume (one per lattice point fills space)', Math.abs(volume4('cell24', O) - 2) < 1e-9);
check('16-cell volume = 2/3 on every coset (three per lattice point fill space)', [[1, 0, 0, 0], [0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, -0.5]].every((c) => Math.abs(volume4('cell16', c) - 2 / 3) < 1e-9));

// Z4 (Hypercubic): tesseracts.
const sT = cellStructure('tesseract', O);
check('tesseract: 16 vertices, 32 edges of length 1, 8 cubic facets (8 vertices each)', sT.offsets.length === 16 && sT.edges.length === 32 && sT.facets.length === 8 && sT.facets.every((f) => f.verts.length === 8));
const nT = sT.facets.map((_, i) => neighborAcrossFacet('tesseract', O, i));
check('tesseract neighbors across facets = the 8 unit steps (+-e_i)', new Set(nT.map(key4)).size === 8 && nT.every((p) => Math.abs(dot4(p, p) - 1) < 1e-9 && p.filter((v) => Math.abs(v) > 1e-9).length === 1));
check('tesseract volume = 1 = Z4 covolume (one per integer point fills space)', Math.abs(volume4('tesseract', O) - 1) < 1e-9);
check('tesseract edge = 24-cell edge = 1 (one shared ruler)', sT.edges.every(([i, j]) => Math.abs(Math.hypot(...sT.offsets[i].map((v, k) => v - sT.offsets[j][k])) - 1) < 1e-9) && s24.edges.every(([i, j]) => Math.abs(Math.hypot(...s24.offsets[i].map((v, k) => v - s24.offsets[j][k])) - 1) < 1e-9));
const secT = sliceCell(cellVertices4('tesseract', O), sT.edges, rotation4(), 0);
check('tesseract at the origin sliced at w = 0 is the RD world\'s own unit cube (+-1/2)^3', secT && sameSet3(secT, rdRawVerts(1).slice(0, 8)));
check('tesseract centered at w = 1 does not show at w = 0 (it spans w 1/2..3/2)', sliceCell(cellVertices4('tesseract', [0, 0, 0, 1]), sT.edges, rotation4(), 0) === null);
// Vertex-first parallel shadow (looking along (1,1,1,1)) has an RD outline.
const basisT = [[0.5, 0.5, -0.5, -0.5], [0.5, -0.5, 0.5, -0.5], [0.5, -0.5, -0.5, 0.5]];
const shadowT = sT.offsets.map((v) => basisT.map((b) => dot4(v, b)));
const extremeT = [...new Set(shadowT.map(key3))].map((k) => k.split(',').map(Number)).filter((p) => Math.hypot(...p) > 1e-9);
check('tesseract vertex-first shadow: 14 outline points forming an RD (8 at one radius, 6 at another, ratio 2/sqrt3)', extremeT.length === 14 && (() => { const r = extremeT.map((p) => Math.hypot(...p)).sort((a, b) => a - b); return Math.abs(r[0] - r[7]) < 1e-9 && Math.abs(r[8] - r[13]) < 1e-9 && Math.abs(r[13] / r[0] - 2 / Math.sqrt(3)) < 1e-9; })());

// The D4 world's w = 0 slice IS the RD world: a 24-cell on a w = 0 D4
// point cuts w = 0 in exactly rdRawVerts(1), and one on a w = +-1 point
// only touches it at a single vertex (not a solid).
const I = rotation4();
const sec = sliceCell(cellVertices4('cell24', O), s24.edges, I, 0);
check('24-cell at the origin sliced at w = 0 is exactly the RD (rdRawVerts(1))', sec && sameSet3(sec, rdRawVerts(1)));
check('24-cell centered at w = 1 does not show a solid at w = 0', sliceCell(cellVertices4('cell24', [1, 0, 0, 1]), s24.edges, I, 0) === null);
check('24-cell centered at w = -1 does not show at w = 0 (touches at one vertex only)', sliceCell(cellVertices4('cell24', [1, 0, 0, -1]), s24.edges, I, 0) === null);
// A 16-cell whose facet lies in w = 0 shows that facet once: the one
// above owns it, the one below does not.
const up = [0.5, 0.5, 0.5, 0.5], down = [0.5, 0.5, 0.5, -0.5];
const sUp = sliceCell(cellVertices4('cell16', up), cellStructure('cell16', up).edges, I, 0);
const sDown = sliceCell(cellVertices4('cell16', down), cellStructure('cell16', down).edges, I, 0);
check('16-cell above w = 0 shows its shared facet (a regular tetrahedron of edge sqrt(2))', sUp && sUp.length === 4);
check('16-cells above and below a facet in w = 0 give the identical section, drawn once (the one above)', sDown && (() => { const kept = dedupeSections([{ pts: sUp, rank: 0, w: up[3], id: 'up' }, { pts: sDown, rank: 0, w: down[3], id: 'down' }]); return kept.length === 1 && kept[0].id === 'up'; })());

// Tapping a slice face resolves the right facet: for each of the RD's 12
// faces (normals = the 12 FCC directions), the facet found must lead to
// the matching FCC neighbor, i.e. the RD world's own neighbor rule.
const fcc = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]];
check('Tapping each RD face in the w = 0 slice places the matching FCC neighbor', fcc.every((n) => {
  const f = facetForSliceNormal('cell24', O, I, 0, n);
  if (f < 0) return false;
  const nb = neighborAcrossFacet('cell24', O, f);
  return [n[0], n[1], n[2], 0].every((v, k) => Math.abs(nb[k] - v) < 1e-9);
}));

// ---- Hyper-pyrochlore (A4) ----
const b5 = [0, 1, 2, 3, 4].map((i) => [0, 1, 2, 3, 4].map((j) => (i === j ? 0.8 : -0.2)));
const roots5 = [];
for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j) { const r = [0, 0, 0, 0, 0]; r[i] = 1; r[j] = -1; roots5.push(r); }
check('A4 embedding is an isometry (all 20 roots land at length sqrt(2))', roots5.every((r) => Math.abs(Math.hypot(...a4To4(r)) - Math.SQRT2) < 1e-12));
check('A4 embedding round-trips', roots5.every((r) => a4From4(a4To4(r)).every((v, k) => Math.abs(v - r[k]) < 1e-12)));
check('A4 nodes (class 0) sit on the FCC floor at w = 0: node layer xyz = the FCC points', roots5.filter((r) => r[4] === 0).every((r) => { const x = a4To4(r); return x[3] === 0 && Number.isInteger(Math.round(x[0])) && Math.abs(x[0] + x[1] + x[2]) % 2 < 1e-9; }));
const rep5 = (k) => a4To4(b5[0].map((v) => v * (k > 2 ? k - 5 : k)));
const shape = (kind, c) => { const st = cellStructure(kind, c); return [st.offsets.length, st.edges.length, st.facets.map((f) => f.verts.length).sort((a, b) => a - b).join(' ')]; };
check('5-cell: 5 corners, 10 edges, 5 tetrahedral facets', JSON.stringify(shape('a4cell5', rep5(0))) === JSON.stringify([5, 10, '4 4 4 4 4']));
check('truncated 5-cell (both orientations): 20 corners, 40 edges, 5 tetrahedra + 5 truncated tetrahedra', [2, 4].every((k) => JSON.stringify(shape('a4trunc', rep5(k))) === JSON.stringify([20, 40, '4 4 4 4 4 12 12 12 12 12'])));
check('bitruncated 5-cell: 30 corners, 60 edges, 10 truncated-tetrahedron facets', JSON.stringify(shape('a4bitrunc', rep5(3))) === JSON.stringify([30, 60, '12 12 12 12 12 12 12 12 12 12']));
check('every A4 edge is sqrt(2)/2 (= Pyrochlore tetrahedron edge)', ['a4cell5', 'a4trunc', 'a4bitrunc'].every((k, i) => { const st = cellStructure(k, rep5([0, 2, 3][i])); return st.edges.every(([a, c]) => Math.abs(Math.hypot(...st.offsets[a].map((v, j) => v - st.offsets[c][j])) - Math.SQRT2 / 2) < 1e-9); }));
// Tiling by volume: per A4 lattice point there are 2 five-cells, 2
// truncated and 1 bitruncated 5-cell; together they must fill A4's
// covolume sqrt(det Gram) = sqrt(5).
const vA4 = 2 * volume4('a4cell5', rep5(0)) + volume4('a4trunc', rep5(2)) + volume4('a4trunc', rep5(4)) + volume4('a4bitrunc', rep5(3));
check(`A4 cells fill space: 2 x 5-cell + 2 x truncated + bitruncated = sqrt(5) (got ${vA4.toFixed(9)})`, Math.abs(vA4 - Math.sqrt(5)) < 1e-9);
// Adjacency.
const acrossKinds = (kind, c) => cellStructure(kind, c).facets.map((f, i) => [f.verts.length, cellAcrossFacet(kind, c, i)?.kind]);
check('every 5-cell facet touches a truncated 5-cell', acrossKinds('a4cell5', rep5(0)).every(([, k]) => k === 'a4trunc') && acrossKinds('a4cell5', rep5(1)).every(([, k]) => k === 'a4trunc'));
check('truncated 5-cell: tetrahedral facets touch 5-cells, big facets touch bitruncated 5-cells (never another truncated)', [2, 4].every((cl) => acrossKinds('a4trunc', rep5(cl)).every(([n, k]) => (n === 4 ? k === 'a4cell5' : k === 'a4bitrunc'))));
check('every bitruncated facet touches a truncated 5-cell', acrossKinds('a4bitrunc', rep5(3)).every(([, k]) => k === 'a4trunc'));
check('straight through a bitruncated gap lands on a truncated 5-cell of the other orientation that shares a facet with the gap', (() => {
  const T = rep5(2);
  return cellStructure('a4trunc', T).facets.every((f, i) => {
    if (f.verts.length !== 12) return true;
    const B = cellAcrossFacet('a4trunc', T, i).c;
    const T2 = throughGap(T, B);
    const cl = a4Class(a4From4(T2));
    return cl === 4 && cellStructure('a4bitrunc', B).facets.some((_, j) => { const n = cellAcrossFacet('a4bitrunc', B, j); return n.kind === 'a4trunc' && n.c.every((v, k) => Math.abs(v - T2[k]) < 1e-9); });
  });
})());
check('corner partners: each 5-cell corner is shared with exactly the 5-cell reflected through it (the other orientation)', (() => {
  const C = rep5(0);
  return cellVertices4('a4cell5', C).every((v) => { const P = cornerPartner(C, v); return a4Class(a4From4(P)) === 1 && cellVertices4('a4cell5', P).some((u) => u.every((x, k) => Math.abs(x - v[k]) < 1e-9)); });
})());
check('A4 first cells are the right kinds', ['a4cell5', 'a4trunc', 'a4bitrunc'].every((k) => A4_CLASS_KIND[a4Class(a4From4(A4_FIRST[k]))] === k));
// The rest slice IS the Pyrochlore world: slice every A4 cell near the
// origin at w = -sqrt(5)/20, draw identical sections once, and check each
// is a Pyrochlore piece: truncated tetrahedra (12 corners) at T-sites are
// truncated 5-cells cut through their middle; at O-sites they're the
// facet a truncated 5-cell (below) shares with a bitruncated one (above);
// tetrahedra are facets of 5-cells at FCC points (up) and T+ holes (down).
const restItems = [];
const rr = [-2, -1, 0, 1, 2];
for (let k = -2; k <= 2; k++) for (const a of rr) for (const bb of rr) for (const c of rr) for (const d of rr) {
  const v = [a, bb, c, d, -(a + bb + c + d)];
  if (Math.abs(v[4]) > 2) continue;
  const c4 = a4To4(v.map((x, j) => x + k * b5[0][j]));
  if (Math.hypot(c4[0], c4[1], c4[2]) > 2.2 || Math.abs(c4[3] - A4_REST_W) > 1.2) continue;
  const kind = A4_CLASS_KIND[((k % 5) + 5) % 5];
  const sec = sliceCell(cellVertices4(kind, c4), cellStructure(kind, c4).edges, I, A4_REST_W);
  if (sec) restItems.push({ pts: sec, rank: { a4cell5: 0, a4trunc: 1, a4bitrunc: 2 }[kind], w: c4[3], kind });
}
const restKept = dedupeSections(restItems).filter((it) => it.pts.every((q) => Math.hypot(...q) < 2));
const centroid = (pts) => [0, 1, 2].map((ax) => pts.reduce((t, q) => t + q[ax], 0) / pts.length);
const isFCC = (q) => q.every((v) => Math.abs(v - Math.round(v)) < 1e-9) && Math.round(q[0] + q[1] + q[2]) % 2 === 0;
const isTplus = (q) => { const r = q.map((v) => v - 0.5); return r.every((v) => Math.abs(v - Math.round(v)) < 1e-9) && ((Math.round(r[0] + r[1] + r[2]) % 2) + 2) % 2 === 0; };
check(`rest slice: every section near the origin is a Pyrochlore piece (${restKept.length} pieces)`, restKept.length >= 20 && restKept.every((it) => {
  const cn = centroid(it.pts);
  const site = cn.every((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9) ? pyrochloreSiteOrientation(...cn.map((v) => Math.round(v * 2))) : 0;
  if (it.pts.length === 12) return (it.kind === 'a4trunc' && site !== 0) || (it.kind === 'a4bitrunc' && site === 1);
  if (it.pts.length === 4) return it.kind === 'a4cell5' && (isFCC(cn) || isTplus(cn));
  return false;
}));
check('rest slice: first 5-cell = up-tet at the origin, first bitruncated = the TT at (1,0,0), first truncated = the T-site TT at (-1/2,-1/2,-1/2)', (() => {
  const up = sliceCell(cellVertices4('a4cell5', A4_FIRST.a4cell5), cellStructure('a4cell5', A4_FIRST.a4cell5).edges, I, A4_REST_W);
  const tt = sliceCell(cellVertices4('a4bitrunc', A4_FIRST.a4bitrunc), cellStructure('a4bitrunc', A4_FIRST.a4bitrunc).edges, I, A4_REST_W);
  const down = sliceCell(cellVertices4('a4trunc', A4_FIRST.a4trunc), cellStructure('a4trunc', A4_FIRST.a4trunc).edges, I, A4_REST_W);
  const S = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  return up && sameSet3(up, S.map((q) => q.map((v) => v / 4))) && tt && tt.length === 12 && key3(centroid(tt)) === key3([1, 0, 0]) && down && down.length === 12 && key3(centroid(down)) === key3([-0.5, -0.5, -0.5]);
})());

// Rotation: orthonormal, fixed XW -> YW -> ZW order, identity at 0.
const R = rotation4({ xw: 0.3, yw: -0.7, zw: 1.1 });
const RtR = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => [0, 1, 2, 3].reduce((s, k) => s + R[k][i] * R[k][j], 0)));
check('rotation4 is orthonormal', RtR.every((row, i) => row.every((v, j) => Math.abs(v - (i === j ? 1 : 0)) < 1e-12)));
check('rotation4 at zero angles is the identity', rotation4().every((row, i) => row.every((v, j) => v === (i === j ? 1 : 0))));
check('rotation4 leaves the other axes alone for a pure XW turn', Math.abs(matVec(rotation4({ xw: 0.4 }), [0, 1, 0, 0])[1] - 1) < 1e-12);
// Tesseract and 24-cell vertex-first parallel projections both have an
// RD outline -- checked by the design session in Python; here just the
// 24-cell: vertex-first = its (0,0,0,1) vertex along w, parallel drop.
const proj = CELL24_OFFSETS.map((v) => project4(v, false));
check('24-cell vertex-first parallel shadow spans exactly the RD corners (14 distinct extreme points)', sameSet3([...new Set(proj.map(key3))].map((k) => k.split(',').map(Number)).filter((p) => Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]) > 1e-9), rdRawVerts(1)));
check('perspective keeps w = 0 at true size', key3(project4([1, 2, 3, 0], true)) === key3([1, 2, 3]));

// Doubled keys round-trip.
check('doubled keys round-trip half-integer centers', fromDoubled(toDoubled([0.5, -0.5, 1.5, 2])).join(',') === '0.5,-0.5,1.5,2');
check('every kind accepts its own centers', KINDS_4D.cell24.isCenter([1, 1, 0, 0]) && KINDS_4D.cell16.isCenter([1, 0, 0, 0]) && !KINDS_4D.cell16.isCenter([1, 1, 0, 0]));

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll 4D checks passed.');
process.exit(failures ? 1 : 0);
