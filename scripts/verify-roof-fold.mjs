// Verifies DICTO's roof-fold cell (geometry-extensions/roof-fold.js;
// Kaleidohedra DISCOVERIES.md #8), the Icosahedral/Dodecahedral Transitions world's geometry:
//
//   - cube, dodecahedron and icosahedron are regular, with edges
//     2 : 2/phi : 2/phi^2, all along icosahedral two-fold axes;
//   - copies at translations by 2 give 13 nodes per cell, every dodecahedron
//     vertex is a node, and every roof vertex is a neighbour's icosahedron vertex;
//   - the dodecahedra cover space once or twice, mean (5 + sqrt5)/4;
//   - each icosahedron face has one node at 2/phi from its three corners,
//     the 20 tips are the dodecahedron's vertices, apex 36 degrees;
//   - the node set's symmetry is the 24 operations of m-3 about the origin,
//     with only lattice translations: Pm-3, nodes on 1b and 12j (0, y, z).
//   - the four placeable solids (cube, dodecahedron, icosahedron, and the
//     star, which is the great stellated dodecahedron) are closed and outward
//     with exact volumes, and nest;
//   - face neighbours' dodecahedra overlap, edge neighbours only touch;
//   - the merged-dodecahedra surface encloses exactly the union, edges without seams;
//   - colouring sites by parity leaves only even translations: Fm-3; columns,
//     layers and octants give Cmmm, Pmmm and a doubled Pmmm;
//   - two extractions that don't overlap: even-cell dodecahedra (the optimal
//     lattice packing, (5+sqrt5)/8) and even-cell stars with odd-cell
//     icosahedra, sharing only corners.
import { PHI, ROOF_FOLD_PERIOD as P, ROOF_FOLD_KINDS, roofFoldCell, roofFoldSolids, mergedDodecaSurface, mergedDodecaEdges, siteParity, ROOF_FOLD_PATTERNS } from '../src/geometry-extensions/roof-fold.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}
const EPS = 1e-9;
const sub = (a, b) => a.map((c, i) => c - b[i]);
const add = (a, b) => a.map((c, i) => c + b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(...a);
const wrap = (v) => v.map((c) => { const m = ((c % P) + P) % P; return Math.abs(m - P) < EPS ? 0 : m; });
const key = (v) => wrap(v).map((c) => c.toFixed(7)).join();

const C = roofFoldCell();

// 1. Regular solids and the edge chain.
const degreesAll = (n, edges, d) => { const deg = new Array(n).fill(0); edges.forEach(([i, j]) => { deg[i]++; deg[j]++; }); return deg.every((x) => x === d); };
check(`cube: 12 edges of 2, 3 at each corner`, C.cubeEdges.length === 12 && degreesAll(8, C.cubeEdges, 3));
check(`dodecahedron: 30 edges of 2/phi, 3 at each of 20 vertices`, C.dodecaEdges.length === 30 && degreesAll(20, C.dodecaEdges, 3));
check(`icosahedron: 30 edges of 2/phi^2, 5 at each of 12 vertices`, C.icoEdges.length === 30 && degreesAll(12, C.icoEdges, 5));
const icoD = [];
for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) icoD.push(norm(sub(C.ico[i], C.ico[j])));
icoD.sort((a, b) => a - b);
check('the 30 shortest icosahedron distances are equal, the next is longer', icoD[29] - icoD[0] < EPS && icoD[30] - icoD[29] > 0.1);

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
for (const [s, t] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let r = 0; r < 3; r++) {
  const b = [1, s * PHI, t / PHI];
  AXES.push([b[(3 - r) % 3], b[(4 - r) % 3], b[(5 - r) % 3]]);
}
const onAxis = (v) => AXES.some((a) => norm(cross(v, a)) / (norm(v) * norm(a)) < EPS);
const allOnAxes = (V, E) => E.every(([i, j]) => onAxis(sub(V[i], V[j])));
check('15 distinct two-fold axes', new Set(AXES.map((a) => a.map((c) => (c / norm(a)).toFixed(6)).join())).size === 15);
check('every cube, dodecahedron and icosahedron edge is along a two-fold axis',
  allOnAxes(C.cube, C.cubeEdges) && allOnAxes(C.dodeca, C.dodecaEdges) && allOnAxes(C.ico, C.icoEdges));

// 2. Nodes per cell and coincidences.
const nodeKeys = new Set(C.nodes.map(key));
const everyPoint = new Set([...C.dodeca, ...C.ico].map(key));
check(`13 nodes per cell (${nodeKeys.size}), no other points`, nodeKeys.size === 13 && everyPoint.size === 13);
const icoKeys = new Set(C.ico.map(key));
check('every roof vertex is an icosahedron vertex of a neighbouring cell', C.dodeca.slice(8).every((v) => icoKeys.has(key(v)) && norm(v) > 1.5));

// 3. Covering by dodecahedra.
const faceNormals = C.ico.map((v) => v.map((c) => c / norm(v)));
const faceDist = Math.max(...C.dodeca.map((v) => dot(v, faceNormals[0])));
check('all 12 dodecahedron faces are planes through 5 vertices at the same distance',
  faceNormals.every((n) => C.dodeca.filter((v) => Math.abs(dot(v, n) - faceDist) < EPS).length === 5 && Math.max(...C.dodeca.map((v) => dot(v, n))) < faceDist + EPS));
const inside = (p) => faceNormals.every((n) => dot(p, n) <= faceDist + EPS);
check('the icosahedron lies inside its own dodecahedron', C.ico.every(inside));
const N = 48;
const counts = { 0: 0, 1: 0, 2: 0, more: 0 };
let total = 0;
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
  const p = [i, j, k].map((c, a) => -1 + (2 * (c + 0.5 + 0.0137 * (a + 1))) / N);
  let m = 0;
  for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) for (const z of [-2, 0, 2]) if (inside(sub(p, [x, y, z]))) m++;
  total += m;
  counts[m > 2 ? 'more' : m]++;
}
const mean = total / N ** 3;
const exactMean = (10 + 2 * Math.sqrt(5)) / 8;
check(`dodecahedron volume (15+7sqrt5)/4 (2/phi)^3 = 10 + 2sqrt5`, Math.abs(((15 + 7 * Math.sqrt(5)) / 4) * (2 / PHI) ** 3 - (10 + 2 * Math.sqrt(5))) < EPS && Math.abs(exactMean - (5 + Math.sqrt(5)) / 4) < EPS);
check(`every sample point covered once or twice (${(counts[1] / N ** 3).toFixed(3)} once, ${(counts[2] / N ** 3).toFixed(3)} twice)`, counts[0] === 0 && counts.more === 0);
check(`sampled mean multiplicity ${mean.toFixed(4)} matches (5+sqrt5)/4 = ${exactMean.toFixed(4)}`, Math.abs(mean - exactMean) < 0.01);

// 4. Spikes on the icosahedron faces.
const faces = [];
for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 12; c++) {
  const e = 2 / PHI ** 2;
  if ([[a, b], [a, c], [b, c]].every(([i, j]) => Math.abs(norm(sub(C.ico[i], C.ico[j])) - e) < EPS)) faces.push([a, b, c]);
}
const nearNodes = [];
for (const n of C.nodes) for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) for (const z of [-2, 0, 2]) nearNodes.push(add(n, [x, y, z]));
const tips = faces.map((f) => {
  const V = f.map((i) => C.ico[i]);
  const c = V.reduce(add).map((x) => x / 3);
  return nearNodes.filter((p) => dot(sub(p, c), c) > 0 && V.every((v) => Math.abs(norm(sub(p, v)) - 2 / PHI) < EPS));
});
check(`20 icosahedron faces, each with exactly one tip node`, faces.length === 20 && tips.every((t) => t.length === 1));
const tipKeys = new Set(tips.map((t) => t[0].map((c) => c.toFixed(7)).join()));
const dodecaKeys = new Set(C.dodeca.map((v) => v.map((c) => c.toFixed(7)).join()));
check('the 20 tips are exactly the 20 dodecahedron vertices', tipKeys.size === 20 && [...tipKeys].every((k) => dodecaKeys.has(k)));
const apex = (Math.acos(1 - (2 / PHI ** 2) ** 2 / (2 * (2 / PHI) ** 2)) * 180) / Math.PI;
check(`spike faces are golden triangles (apex ${apex.toFixed(4)} degrees)`, Math.abs(apex - 36) < 1e-9);

// 5. Symmetry: which of the 48 cubic point operations map the node set to itself, and with which translation.
const PERMS = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [1, 0, 2], [0, 2, 1], [2, 1, 0]];
const ops = [];
for (const perm of PERMS) for (let s = 0; s < 8; s++) {
  const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
  ops.push({ even: PERMS.indexOf(perm) < 3, f: (v) => perm.map((p, i) => sg[i] * v[p]) });
}
const preserves = (f, t) => C.nodes.every((v) => nodeKeys.has(key(add(f(v), t))));
const candidates = (f) => C.nodes.map((v) => sub(v, f(C.nodes[0])));
const kept = ops.map((op) => candidates(op.f).filter((t) => preserves(op.f, t)));
check('exactly 24 point operations keep the node set (m-3), all with no swap of two axes',
  kept.filter((t) => t.length).length === 24 && ops.every((op, i) => (kept[i].length > 0) === op.even));
check('each works with a lattice translation only (symmorphic, origin on the icosahedron centre)', kept.every((ts) => ts.every((t) => key(t) === key([0, 0, 0]))));
const stab = (v) => ops.filter((op) => key(op.f(v)) === key(v)).length;
check(`corner node is fixed by all 24 (Wyckoff 1b); each icosahedron vertex by 2, a mirror (12j, (0, y, z), y = ${(1 / (2 * PHI)).toFixed(4)}, z = ${(1 / (2 * PHI ** 2)).toFixed(4)} in cell units)`,
  ops.filter((op) => op.even).every((op) => key(op.f([1, 1, 1])) === key([1, 1, 1])) && C.ico.every((v) => ops.filter((op) => op.even && key(op.f(v)) === key(v)).length === 2) && C.ico.every((v) => v.some((c) => Math.abs(c) < EPS)) && stab([1, 1, 1]) === 48);

// 6. The four placeable solids: closed, outward, with their exact volumes.
const S = roofFoldSolids();
const volumeOf = (polys) => polys.reduce((v, P) => { for (let i = 1; i + 1 < P.length; i++) v += dot(P[0], cross(P[i], P[i + 1])) / 6; return v; }, 0);
const rawKey = (v) => v.map((c) => c.toFixed(7)).join();
const closed = (polys) => {
  const half = new Map();
  for (const P of polys) for (let i = 0; i < P.length; i++) { const k = `${rawKey(P[i])}>${rawKey(P[(i + 1) % P.length])}`; half.set(k, (half.get(k) ?? 0) + 1); }
  return [...half.keys()].every((k) => { const [a, b] = k.split('>'); return half.get(`${b}>${a}`) === 1 && half.get(k) === 1; });
};
const V = { cube: 8, dodeca: 10 + 2 * Math.sqrt(5), ico: (5 / 12) * (3 + Math.sqrt(5)) * (2 / PHI ** 2) ** 3 };
const spike = (Math.sqrt(3) / 4) * (2 / PHI ** 2) ** 2 * (2 / Math.sqrt(3)) / 3; // base area x height / 3, height 2/sqrt3
V.star = V.ico + 20 * spike;
for (const k of ROOF_FOLD_KINDS) {
  const f = S[k].faces;
  check(`${k}: ${f.length} faces, closed, outward, volume ${volumeOf(f).toFixed(6)} = ${V[k].toFixed(6)}`, closed(f) && Math.abs(volumeOf(f) - V[k]) < 1e-9);
}
check('star: 60 triangles and 90 edges, spike height 2/sqrt3', S.star.faces.length === 60 && S.star.edges.length === 90 && Math.abs(norm(sub(S.star.faces[0][2], S.ico.faces[0].reduce(add).map((c) => c / 3))) - 2 / Math.sqrt(3)) < 1e-9);
// The star is Kepler's great stellated dodecahedron {5/2, 3}: its 60 visible triangles lie in 12
// planes, 5 to a plane, each plane's 5 tips a regular pentagram whose edge is phi^3 x the core edge.
{
  const byPlane = new Map();
  for (const t of S.star.faces) {
    let n = cross(sub(t[1], t[0]), sub(t[2], t[0])); n = n.map((c) => c / norm(n));
    const k = [...n, dot(t[0], n)].map((c) => (Math.round(c * 1e6) / 1e6 + 0).toFixed(6)).join();
    if (!byPlane.has(k)) byPlane.set(k, []);
    byPlane.get(k).push(t[2]);
  }
  const base = 2 / PHI ** 2;
  const pentagrams = [...byPlane.values()].every((tips) => {
    if (tips.length !== 5) return false;
    const d = []; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) d.push(norm(sub(tips[i], tips[j])));
    d.sort((a, b) => a - b);
    // a regular pentagon's 5 sides and 5 diagonals; the pentagram's edge is its diagonal
    return d.slice(0, 5).every((x) => Math.abs(x - d[0]) < EPS) && d.slice(5).every((x) => Math.abs(x - d[5]) < EPS) && Math.abs(d[5] - PHI ** 3 * base) < EPS;
  });
  check('the star is the great stellated dodecahedron: 12 planes of 5 triangles, each a regular pentagram of edge phi^3 x the core edge', byPlane.size === 12 && pentagrams);
}
check('icosahedron, star and dodecahedron nest: star inside dodecahedron, icosahedron inside star',
  S.star.faces.flat().every(inside) && Math.abs(V.dodeca - V.star) > 0.1);

// 7. Neighbouring dodecahedra: face neighbours overlap, edge neighbours only touch along a cube edge.
const sharedCorners = (t) => C.dodeca.filter((p) => C.dodeca.some((q) => norm(sub(add(p, t), q)) < EPS)).length;
check('face neighbours share a cube face\'s 4 corners, edge neighbours a cube edge (2), corner neighbours a corner (1)',
  sharedCorners([2, 0, 0]) === 4 && sharedCorners([0, 2, 2]) === 2 && sharedCorners([2, 2, 2]) === 1);

// 8. Merged dodecahedra: the outer surface encloses exactly the union.
function sampledUnion(sites, n = 40) {
  const lo = [0, 1, 2].map((a) => Math.min(...sites.map((s) => 2 * s[a])) - 1.8);
  const hi = [0, 1, 2].map((a) => Math.max(...sites.map((s) => 2 * s[a])) + 1.8);
  let hits = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const p = [i, j, k].map((c, a) => lo[a] + ((c + 0.5 + 0.011 * (a + 1)) / n) * (hi[a] - lo[a]));
    if (sites.some((s) => inside(sub(p, s.map((c) => 2 * c))))) hits++;
  }
  return (hits / n ** 3) * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
}
for (const [label, sites] of [
  ['one site', [[0, 0, 0]]],
  ['two face neighbours', [[0, 0, 0], [1, 0, 0]]],
  ['two edge neighbours', [[0, 0, 0], [0, 1, 1]]],
  ['a 2x2x2 block', [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z])))],
  ['an L of four', [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0]]],
]) {
  const surf = mergedDodecaSurface(sites);
  const vol = volumeOf(surf.map((p) => p.polygon));
  const sampled = sampledUnion(sites);
  const deep = surf.every(({ polygon, site }) => { const c = polygon.reduce(add).map((x) => x / polygon.length); return sites.every((s) => s === site || !faceNormals.every((n) => dot(sub(c, s.map((v) => 2 * v)), n) < faceDist - 1e-7)); });
  check(`merged surface, ${label}: encloses ${vol.toFixed(3)} (sampled union ${sampled.toFixed(3)}), no piece inside another dodecahedron`, Math.abs(vol - sampled) / sampled < 0.01 && deep);
}
check('merged surface of one site is the whole dodecahedron', Math.abs(volumeOf(mergedDodecaSurface([[0, 0, 0]]).map((p) => p.polygon)) - V.dodeca) < 1e-9);
check('merged surface of two edge neighbours encloses exactly twice the dodecahedron (they touch, no overlap)', Math.abs(volumeOf(mergedDodecaSurface([[0, 0, 0], [0, 1, 1]]).map((p) => p.polygon)) - 2 * V.dodeca) < 1e-9);

const edgeLength = (E) => E.reduce((t, [a, b]) => t + norm(sub(a, b)), 0);
const oneEdges = mergedDodecaEdges(mergedDodecaSurface([[0, 0, 0]]), [[0, 0, 0]]);
check(`merged edges of one site are its 30 edges (${oneEdges.length})`, oneEdges.length === 30 && oneEdges.every(([a, b]) => Math.abs(norm(sub(a, b)) - 2 / PHI) < EPS));
// Every drawn edge is a real crease or outline (the union is not flat across it), every original
// dodecahedron edge still on the surface is drawn, and no edge is drawn twice.
const inUnion = (sites) => (p) => sites.some((st) => faceNormals.every((n) => dot(sub(p, st.map((c) => 2 * c)), n) < faceDist - 1e-12));
const notFlatAround = (inside, a, b) => {
  const mid = a.map((c, i) => (c + b[i]) / 2);
  const t = sub(b, a).map((c) => c / norm(sub(b, a)));
  const u0 = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(t, u0).map((c, _, v) => c / norm(cross(t, u0)));
  const w = cross(t, u);
  const ring = [];
  for (let k = 0; k < 360; k++) { const th = (k * Math.PI) / 180; ring.push(inside(add(mid, add(u.map((c) => c * 1e-4 * Math.cos(th)), w.map((c) => c * 1e-4 * Math.sin(th)))))); }
  const n = ring.filter(Boolean).length;
  return n > 0 && n < 360 && Math.abs(n - 180) > 2; // some solid, some empty, and not a straight half-plane
};
for (const [label, sites] of [['two face neighbours', [[0, 0, 0], [1, 0, 0]]], ['two edge neighbours', [[0, 0, 0], [0, 1, 1]]], ['a 2x2x2 block', [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z])))]]) {
  const inside = inUnion(sites);
  const E = mergedDodecaEdges(mergedDodecaSurface(sites), sites);
  const creases = E.every(([a, b]) => notFlatAround(inside, a, b));
  let overlaps = 0;
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
    const [a, b] = E[i], [c, d] = E[j];
    const ab = sub(b, a);
    const on = (p) => { const t = dot(sub(p, a), ab) / dot(ab, ab); return t > -1e-9 && t < 1 + 1e-9 && norm(sub(add(a, ab.map((x) => x * t)), p)) < 1e-7; };
    if (on(c) && on(d) && on(c.map((x, k) => (x + d[k]) / 2))) overlaps++;
  }
  // Original dodecahedron edges whose midpoint is on the union's surface and is a crease must be drawn.
  const drawnAt = (p) => E.some(([a, b]) => { const ab = sub(b, a); const t = dot(sub(p, a), ab) / dot(ab, ab); return t > -1e-9 && t < 1 + 1e-9 && norm(sub(add(a, ab.map((x) => x * t)), p)) < 1e-7; });
  const missing = sites.flatMap((st) => S.dodeca.edges.map(([a, b]) => [add(a, st.map((c) => 2 * c)), add(b, st.map((c) => 2 * c))]))
    .filter(([a, b]) => notFlatAround(inside, a, b) && !drawnAt(a.map((c, i) => (c + b[i]) / 2))).length;
  check(`merged edges, ${label}: ${E.length} edges, all creases or outline, none twice, no crease missing`, creases && overlaps === 0 && missing === 0);
}

// 9. Alternating views: colouring sites by parity keeps the 24 point operations but halves the
// translations to the even ones (an FCC lattice), so the alternated structure is Fm-3.
const sites3 = [];
for (let x = -1; x <= 2; x++) for (let y = -1; y <= 2; y++) for (let z = -1; z <= 2; z++) sites3.push([x, y, z]);
const mod4 = (p) => p.map((c) => (((c % 4) + 4) % 4).toFixed(6)).join();
const coloured = new Set(sites3.flatMap((s) => C.ico.map((v) => `${mod4(add(v, s.map((c) => 2 * c)))}|${siteParity(...s)}`)));
const keeps = (f, t) => sites3.every((s) => C.ico.every((v) => coloured.has(`${mod4(add(f(add(v, s.map((c) => 2 * c))), t))}|${siteParity(...s)}`)));
check('parity colouring: all 24 m-3 operations kept, odd translations (2,0,0) swap colours, even ones (2,2,0) keep them',
  ops.filter((op) => op.even).every((op) => keeps(op.f, [0, 0, 0])) && !keeps((v) => v, [2, 0, 0]) && keeps((v) => v, [2, 2, 0]) && keeps((v) => v, [0, 2, -2]));

// 10. Every pattern: which of the 24 m-3 operations and which translations keep its colouring.
// Conventional settings: x+y keeps mmm with lattice (1,1,0),(1,-1,0),(0,0,1) -> C-centred on a
// (2,2,1) cell, Cmmm; z keeps mmm with (1,0,0),(0,1,0),(0,0,2), Pmmm; octants keep only mmm with a
// doubled primitive cell, Pmmm (its 8 colours tell the axes apart).
const sitesP = [];
for (let x = -2; x <= 3; x++) for (let y = -2; y <= 3; y++) for (let z = -2; z <= 3; z++) sitesP.push([x, y, z]);
const mod8 = (p) => p.map((c) => (((c % 8) + 8) % 8).toFixed(6)).join();
const EXPECT = {
  xyz: { ops: 24, keep: [[2, 2, 0], [0, 2, 2], [2, 0, 2]], lose: [[2, 0, 0]] },
  columns: { ops: 8, keep: [[2, 2, 0], [2, -2, 0], [0, 0, 2]], lose: [[2, 0, 0], [0, 2, 0]] },
  layers: { ops: 8, keep: [[2, 0, 0], [0, 2, 0], [0, 0, 4]], lose: [[0, 0, 2], [2, 2, 2]] },
  octants: { ops: 8, keep: [[4, 0, 0], [0, 4, 0], [0, 0, 4]], lose: [[2, 0, 0], [2, 2, 0], [2, 2, 2]] },
};
for (const [name, pat] of Object.entries(ROOF_FOLD_PATTERNS)) {
  const col = new Set(sitesP.flatMap((st) => C.ico.map((v) => `${mod8(add(v, st.map((c) => 2 * c)))}|${pat.of(...st)}`)));
  const keepsP = (f, t) => sitesP.every((st) => C.ico.every((v) => col.has(`${mod8(add(f(add(v, st.map((c) => 2 * c))), t))}|${pat.of(...st)}`)));
  const opsKept = ops.filter((op) => op.even && keepsP(op.f, [0, 0, 0])).length;
  const e = EXPECT[name];
  check(`pattern ${name}: ${opsKept} point operations kept, translations ${e.keep.map((t) => `(${t})`).join(' ')} keep it, ${e.lose.map((t) => `(${t})`).join(' ')} don't -> ${pat.group}`,
    opsKept === e.ops && e.keep.every((t) => keepsP((v) => v, t)) && e.lose.every((t) => !keepsP((v) => v, t)));
}

// 11. Extractions from the same vertices that don't overlap.
// (a) Dodecahedra on the even cells alone (an FCC lattice): the 12 nearest touch (checked above,
// union exactly 2V), the next are 4 apart, beyond two circumradii (2 sqrt3), so none overlap; one
// dodecahedron per 16 of volume gives density (10 + 2 sqrt5)/16 = (5 + sqrt5)/8, the optimal lattice
// packing density of the regular dodecahedron (Betke & Henk), each touching 12 others.
const circum = Math.max(...C.dodeca.map(norm));
const DIRECTIONS_ODD = [];
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (siteParity(x, y, z) === 1) DIRECTIONS_ODD.push([2 * x, 2 * y, 2 * z]);
check(`even-cell dodecahedra: next neighbours 4 apart > 2 circumradii ${(2 * circum).toFixed(4)}; density ${(V.dodeca / 16).toFixed(6)} = (5+sqrt5)/8`,
  4 > 2 * circum + 1e-9 && Math.abs(V.dodeca / 16 - (5 + Math.sqrt(5)) / 8) < 1e-12);
// (b) Stars on even cells, icosahedra on odd cells: exact separating-axis test between every
// convex piece of a star (its icosahedron and 20 spike tetrahedra) and every nearby odd-cell
// icosahedron; they may touch but never overlap, and each star's 12 roof tips are icosahedron vertices.
const polyOf = (faces) => ({ verts: faces.flat(), normals: faces.map((f) => cross(sub(f[1], f[0]), sub(f[2], f[0]))), edges: faces.flatMap((f) => f.map((p, i) => sub(f[(i + 1) % f.length], p))) });
const shift = (P, o) => ({ ...P, verts: P.verts.map((v) => add(v, o)) });
const spikeFaces = S.star.faces.reduce((acc, f, i) => { (acc[Math.floor(i / 3)] ??= []).push(f); return acc; }, []).map((three) => [...three, [three[0][0], three[2][0], three[1][0]]]);
const starPieces = [polyOf(S.ico.faces), ...spikeFaces.map(polyOf)];
const icoPoly = polyOf(S.ico.faces);
const overlapDepth = (A, B) => {
  const axes = [...A.normals, ...B.normals];
  for (const ea of A.edges) for (const eb of B.edges) { const a = cross(ea, eb); if (norm(a) > 1e-9) axes.push(a); }
  let least = Infinity;
  for (const ax of axes) {
    const u = ax.map((c) => c / norm(ax));
    const pa = A.verts.map((v) => dot(v, u)), pb = B.verts.map((v) => dot(v, u));
    least = Math.min(least, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
  }
  return least; // <= 0 (within rounding) means the interiors are disjoint
};
let worst = -Infinity, pairs = 0;
for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
  if (siteParity(dx, dy, dz) !== 1) continue;
  const ico = shift(icoPoly, [2 * dx, 2 * dy, 2 * dz]);
  for (const piece of starPieces) { worst = Math.max(worst, overlapDepth(piece, ico)); pairs++; }
}
const tipsOnIco = C.dodeca.slice(8).every((t) => DIRECTIONS_ODD.some((o) => C.ico.some((v) => norm(sub(add(v, o), t)) < EPS)));
check(`stars on even cells and icosahedra on odd cells share only corners: ${pairs} piece pairs, deepest overlap ${worst.toExponential(1)}; all 12 roof tips are icosahedron vertices`, worst < 1e-9 && tipsOnIco);

console.log(failures === 0 ? '\nAll checks passed (0 failures).' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
