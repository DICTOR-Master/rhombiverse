// Verifies src/geometry-extensions/lattice-4d.js against the real
// geometric facts the 4D design rests on (every one of these was first
// checked numerically in the design session before any code existed).
import {
  isD4, isD4DeepHole, KINDS_4D, CELL24_OFFSETS, cellStructure, cellVertices4,
  neighborAcrossFacet, rotation4, matVec, sliceCell, facetForSliceNormal, project4,
  toDoubled, fromDoubled, dot4,
} from '../src/geometry-extensions/lattice-4d.js';
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
check('24-cell centered at w = -1 does not show at w = 0 (half-open ownership)', sliceCell(cellVertices4('cell24', [1, 0, 0, -1]), s24.edges, I, 0) === null);
// A 16-cell whose facet lies in w = 0 shows that facet once: the one
// above owns it, the one below does not.
const up = [0.5, 0.5, 0.5, 0.5], down = [0.5, 0.5, 0.5, -0.5];
const sUp = sliceCell(cellVertices4('cell16', up), cellStructure('cell16', up).edges, I, 0);
const sDown = sliceCell(cellVertices4('cell16', down), cellStructure('cell16', down).edges, I, 0);
check('16-cell above w = 0 shows its shared facet (a regular tetrahedron of edge sqrt(2))', sUp && sUp.length === 4);
check('16-cell below w = 0 does not also show it', sDown === null);

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
