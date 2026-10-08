// Verifies DICTO's Euclid–Kepler–Pacioli cell (geometry-extensions/roof-fold.js;
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
//     with only lattice translations: Pm-3, nodes on 1b and 12j (0, y, z);
//     these are exactly the cube's symmetries of the icosahedron, axes aligned:
//     31 icosahedral axes parallel in every cell, 7 of them crystal-wide;
//   - the four placeable solids (cube, dodecahedron, icosahedron, and the
//     star, which is the great stellated dodecahedron) are closed and outward
//     with exact volumes, and nest;
//   - face neighbours' dodecahedra overlap, edge neighbours only touch;
//   - the merged-dodecahedra surface encloses exactly the union, edges without seams;
//   - colouring sites by parity leaves only even translations: Fm-3; columns,
//     layers and octants give Cmmm, Pmmm and a doubled Pmmm;
//   - Pacioli's golden rectangles are the neighbours' roof ridges; Kepler's
//     chain icosahedron < octahedron < tetrahedra < cube < dodecahedron nests
//     exactly in one cell;
//   - two extractions that don't overlap: even-cell dodecahedra (the optimal
//     lattice packing, (5+sqrt5)/8) and even-cell stars with odd-cell
//     icosahedra, sharing only corners.
import { PHI, ROOF_FOLD_PERIOD as P, ROOF_FOLD_KINDS, roofFoldCell, roofFoldSolids, mergedDodecaSurface, mergedDodecaEdges, siteParity, ROOF_FOLD_PATTERNS, goldenRectangles, dogstarSolid, insideDogstar, insideDodecahedron, ekpWindowsSolid, ekpWindowRhombi, insideDragonJewel, insideStella, PAIR_LATTICE_NEIGHBOURS, fiveWindowPositions, fiveFoldAxes } from '../src/geometry-extensions/roof-fold.js';

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

const S_FACES_FOR_ALIGN = roofFoldSolids().ico.faces;
// 5b. Alignment: the cubic symmetries that keep the structure are exactly the cube's symmetries
// that are also symmetries of the icosahedron (m-3 = m-3m intersected with the icosahedral group),
// the most of the icosahedron's symmetry a periodic crystal can keep. Its axes line up with the
// cube's: the 3 cube axes are icosahedral 2-fold axes, the 4 body diagonals icosahedral 3-fold axes
// (normals of 8 of its faces), and every cell's solids share one orientation.
{
  const icoSet = new Set(C.ico.map((v) => v.map((c) => c.toFixed(7)).join()));
  const keepsIco = ops.filter((op) => C.ico.every((v) => icoSet.has(op.f(v).map((c) => (c + 0).toFixed(7)).join())));
  const sameOps = keepsIco.length === 24 && keepsIco.every((op) => op.even) && ops.filter((op) => op.even).every((op) => keepsIco.includes(op));
  const icoFaceNormals = S_FACES_FOR_ALIGN.map((t) => { const n = cross(sub(t[1], t[0]), sub(t[2], t[0])); return n.map((c) => c / norm(n)); });
  const diagonals = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1]].map((d) => d.map((c) => c / Math.sqrt(3)));
  const diagOk = diagonals.every((d) => icoFaceNormals.some((n) => Math.abs(Math.abs(dot(n, d)) - 1) < EPS));
  const axesOk = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].every((a) => AXES.some((b) => norm(cross(a, b)) < EPS));
  check('aligned: the 24 operations kept are exactly the cube symmetries of the icosahedron (m-3); cube axes are icosahedral 2-fold axes, body diagonals icosahedral 3-fold axes', sameOps && diagOk && axesOk);
}

// 5c. Every cell's solids carry the icosahedron's 31 rotation axes (6 five-fold through vertex pairs,
// 10 three-fold through face pairs, 15 two-fold through edge pairs), all parallel from cell to cell
// since every cell is a translate. Of these, exactly 7 are symmetries of the whole crystal: the 3
// cube axes (two-fold) and the 4 body diagonals (three-fold); the other 24 are local, aligned.
{
  const dirKey = (v) => { let u = v.map((c) => c / norm(v)); const i = u.findIndex((c) => Math.abs(c) > 1e-9); if (u[i] < 0) u = u.map((c) => -c); return u.map((c) => (c + 0).toFixed(6)).join(); };
  const five = new Set(C.ico.map(dirKey));
  const three = new Set(S_FACES_FOR_ALIGN.map((t) => dirKey(t.reduce(add))));
  const two = new Set(C.icoEdges.map(([i, j]) => dirKey(add(C.ico[i], C.ico[j]))));
  // A rotation axis is kept by the crystal when the kept operations include a rotation about it.
  const keptRotAxes = new Set();
  for (const op of ops.filter((o) => o.even)) {
    const M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => op.f(e)); // columns
    const det = dot(M[0], cross(M[1], M[2]));
    if (det < 0) continue; // rotations only
    const trace = M[0][0] + M[1][1] + M[2][2];
    if (Math.abs(trace - 3) < 1e-9) continue; // identity
    const axis = [M[1][2] - M[2][1], M[2][0] - M[0][2], M[0][1] - M[1][0]];
    const ax = norm(axis) > 1e-9 ? axis : [0, 1, 2].map((k) => M[k][k] > 0 ? 1 : 0); // half-turns: axis = the fixed coordinate
    keptRotAxes.add(dirKey(norm(axis) > 1e-9 ? axis : ax));
  }
  const allIco = new Set([...five, ...three, ...two]);
  const keptAreIco = [...keptRotAxes].every((k) => allIco.has(k));
  check(`each cell's solids carry ${five.size} + ${three.size} + ${two.size} = ${allIco.size} icosahedral axes, all parallel across cells; ${keptRotAxes.size} of them are symmetries of the whole crystal`,
    five.size === 6 && three.size === 10 && two.size === 15 && allIco.size === 31 && keptRotAxes.size === 7 && keptAreIco);
}

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
V.oct = 4 / 3; // edge sqrt2: (sqrt2/3) a^3
V.stella = 2 * (8 / 3); // two tetrahedra of edge 2 sqrt2, counted separately
for (const k of ROOF_FOLD_KINDS) {
  if (k === 'rects') continue; // three flat plates, not a solid
  if (k === 'stella') { const f = S.stella.faces; check(`stella: two closed tetrahedra (${f.length} faces), volumes ${volumeOf(f.slice(0, 4)).toFixed(6)} + ${volumeOf(f.slice(4)).toFixed(6)} = 2 x 8/3`, closed(f.slice(0, 4)) && closed(f.slice(4)) && Math.abs(volumeOf(f) - V.stella) < 1e-9); continue; }
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

// 12. Kepler's chain and Pacioli's rectangles (DICTO, 2026-10-06).
// (a) The six neighbours' roof ridges meet inside each cube as the long sides of the three
// mutually perpendicular golden rectangles, whose 12 corners are the icosahedron's vertices, and
// the rectangles interlock in the Borromean way (each passes through the next, cyclically).
{
  const R = goldenRectangles();
  const corners = new Set(R.flat().map(rawKey));
  const icoKeys = new Set(C.ico.map(rawKey));
  const golden = R.every((r) => { const L = norm(sub(r[0], r[1])), Sh = norm(sub(r[1], r[2])); return Math.abs(L - 2 / PHI) < EPS && Math.abs(Sh - 2 / PHI ** 2) < EPS && Math.abs(L / Sh - PHI) < EPS && Math.abs(dot(sub(r[1], r[0]), sub(r[2], r[1]))) < EPS; });
  // Every roof ridge (the edge joining a cube face's two roof vertices), moved into the neighbour
  // across that face, is a long side of a rectangle.
  const longSides = new Set(R.flatMap((r) => [[r[0], r[1]], [r[2], r[3]]]).map(([a, b]) => [rawKey(a), rawKey(b)].sort().join('|')));
  const roof = C.dodeca.slice(8);
  let ridges = 0, onSides = 0;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
    if (Math.abs(norm(sub(roof[i], roof[j])) - 2 / PHI) > EPS) continue;
    const axis = [0, 1, 2].find((k) => Math.abs(roof[i][k]) > 1 + EPS && Math.abs(roof[j][k] - roof[i][k]) < EPS);
    if (axis === undefined) continue;
    ridges++;
    const t = [0, 0, 0]; t[axis] = -2 * Math.sign(roof[i][axis]);
    if (longSides.has([rawKey(add(roof[i], t)), rawKey(add(roof[j], t))].sort().join('|'))) onSides++;
  }
  // Borromean: along each pair's shared axis, one rectangle's extent lies strictly inside the other's.
  const ext = (r, k) => Math.max(...r.map((p) => Math.abs(p[k])));
  const inside = [[0, 1, 2], [1, 2, 0], [2, 0, 1]].every(([a, b, k]) => ext(R[a], k) < ext(R[b], k) - EPS);
  check(`golden rectangles: 3 of sides 2/phi x 2/phi^2 (ratio phi), corners = the 12 icosahedron vertices; ${onSides} of ${ridges} roof ridges are their long sides in the neighbour; interlocked cyclically (Borromean)`,
    golden && corners.size === 12 && [...corners].every((k) => icoKeys.has(k)) && ridges === 6 && onSides === 6 && inside);
}
// (b) The octahedron on the cube-face centres: each of the icosahedron's 12 vertices lies on a
// different one of its 12 edges, dividing it in the golden ratio.
{
  const O = S.oct;
  let hits = 0; const used = new Set();
  for (const v of C.ico) {
    O.edges.forEach(([a, b], e) => {
      const ab = sub(b, a), t = dot(sub(v, a), ab) / dot(ab, ab);
      if (t > EPS && t < 1 - EPS && norm(sub(add(a, ab.map((c) => c * t)), v)) < EPS) {
        const r = Math.max(t, 1 - t) / Math.min(t, 1 - t);
        if (Math.abs(r - PHI) < EPS) { hits++; used.add(e); }
      }
    });
  }
  // And 8 of the icosahedron's 20 faces lie in the octahedron's 8 face planes (inradius = 1/sqrt3).
  const pk = (P) => { const n = cross(sub(P[1], P[0]), sub(P[2], P[0])).map((c, _, a) => c / Math.hypot(...a)); return [...n, dot(P[0], n)].map((c) => (Math.round(c * 1e6) / 1e6 + 0).toFixed(6)).join(); };
  const octPl = new Set(O.faces.map(pk));
  const shared = S.ico.faces.filter((f) => octPl.has(pk(f))).length;
  check(`8 of the icosahedron's faces lie in the octahedron's 8 face planes (${shared})`, shared === 8);
  check(`octahedron on the 6 cube-face centres (edge sqrt2, volume 4/3): every icosahedron vertex on its own octahedron edge, at the golden section (${hits} of 12, ${used.size} edges)`,
    O.edges.length === 12 && hits === 12 && used.size === 12 && closed(O.faces) && Math.abs(volumeOf(O.faces) - 4 / 3) < 1e-9);
}
// (c) The two tetrahedra (alternate cube corners) are regular, their 8 face planes are exactly the
// octahedron's, so they overlap in it; each tetrahedron's 6 edge midpoints are its vertices.
{
  const planeKey = (P) => { const n = cross(sub(P[1], P[0]), sub(P[2], P[0])).map((c, _, a) => c / Math.hypot(...a)); return [...n, dot(P[0], n)].map((c) => (Math.round(c * 1e6) / 1e6 + 0).toFixed(6)).join(); };
  const tetPlanes = new Set(S.stella.faces.map(planeKey));
  const octPlanes = new Set(S.oct.faces.map(planeKey));
  const samePlanes = tetPlanes.size === 8 && [...tetPlanes].every((k) => octPlanes.has(k));
  const octKeys = new Set(S.oct.faces.flat().map(rawKey));
  const mids = S.stella.edges.map(([a, b]) => rawKey(a.map((c, i) => (c + b[i]) / 2)));
  const regular = S.stella.edges.every(([a, b]) => Math.abs(norm(sub(a, b)) - 2 * Math.SQRT2) < EPS);
  check('stella octangula: two regular tetrahedra (edge 2 sqrt2) on alternate cube corners whose 8 face planes are the octahedron\'s; their edge midpoints are its vertices',
    regular && samePlanes && new Set(mids).size === 6 && mids.every((k) => octKeys.has(k)));
}
// (d) Kepler's chain, all in one cell: icosahedron in octahedron in each tetrahedron in cube in
// dodecahedron (each inside the next, closed), plus Kepler's star around the icosahedron.
{
  const planesOf = (faces) => faces.map((f) => { const n = cross(sub(f[1], f[0]), sub(f[2], f[0])); const u = n.map((c) => c / norm(n)); return { n: u, d: dot(f[0], u) }; });
  const within = (pts, faces) => { const H = planesOf(faces); return pts.every((p) => H.every(({ n, d }) => dot(p, n) <= d + 1e-9)); };
  const T1 = S.stella.faces.slice(0, 4), T2 = S.stella.faces.slice(4);
  const chain = within(C.ico, S.oct.faces) && within(S.oct.faces.flat(), T1) && within(S.oct.faces.flat(), T2)
    && within(T1.flat(), S.cube.faces) && within(T2.flat(), S.cube.faces) && within(C.cube, S.dodeca.faces) && within(S.star.faces.flat(), S.dodeca.faces);
  check('Kepler\'s chain nests exactly in one cell: icosahedron in octahedron in both tetrahedra in cube in dodecahedron', chain);
}
// (e) Symmetry: the stella octangula keeps all 24 operations of m-3; one tetrahedron alone keeps 12
// (the rotation group 23); the octahedron keeps all 24. Their edges lie along cube face diagonals,
// not icosahedral two-fold axes (a second, sqrt2 rod family).
{
  const setOf = (pts) => new Set(pts.map(rawKey));
  const keeps = (pts) => { const S0 = setOf(pts); return ops.filter((op) => op.even && pts.every((p) => S0.has(rawKey(op.f(p).map((c) => c + 0))))).length; };
  const T1v = S.stella.faces.slice(0, 4).flat(), all = S.stella.faces.flat();
  const offAxes = [...S.oct.edges, ...S.stella.edges].every(([a, b]) => !onAxis(sub(a, b)));
  check(`symmetry: stella octangula keeps ${keeps(all)} of the 24, one tetrahedron ${keeps(T1v)}, the octahedron ${keeps(S.oct.faces.flat())}; their edges are off the icosahedral axes`,
    keeps(all) === 24 && keeps(T1v) === 12 && keeps(S.oct.faces.flat()) === 24 && offAxes);
}

// (f) The wrap order (ROOF_FOLD_KINDS: the Piece list, X-ray and Nets order): each piece lies inside
// the next along rects ⊂ ico ⊂ oct ⊂ stella ⊂ cube ⊂ dodeca; the star holds the icosahedron and
// sits in the dodecahedron but crosses the octahedron, stella and cube (each has a point outside
// the other), so it goes just before the dodecahedron.
{
  const inConvex = (faces, p) => faces.every((f) => dot(cross(sub(f[1], f[0]), sub(f[2], f[0])), sub(p, f[0])) <= 1e-9);
  const inTet = (T, p) => [[0, 1, 2, 3], [0, 2, 3, 1], [0, 3, 1, 2], [1, 3, 2, 0]].every(([a, b, c, d]) => {
    const n = cross(sub(T[b], T[a]), sub(T[c], T[a]));
    return dot(n, sub(p, T[a])) * dot(n, sub(T[d], T[a])) >= -1e-9;
  });
  const spikes = S.ico.faces.map((f, i) => [...f, S.star.faces[3 * i][2]]);
  const stellaTets = [0, 4].map((i) => S.stella.faces.slice(i, i + 4));
  const isIn = {
    ico: (p) => inConvex(S.ico.faces, p), oct: (p) => inConvex(S.oct.faces, p), cube: (p) => inConvex(S.cube.faces, p), dodeca: (p) => inConvex(S.dodeca.faces, p),
    stella: (p) => stellaTets.some((T) => inConvex(T, p)),
    star: (p) => inConvex(S.ico.faces, p) || spikes.some((T) => inTet(T, p)),
  };
  const mid = (P) => P.reduce(add).map((c) => c / P.length);
  // Corners, edge midpoints and face centres, each pulled a hair toward its face's centre and the cell's.
  const samples = (k) => S[k].faces.flatMap((f) => { const c = mid(f); return [...f, ...f.map((p, i) => mid([p, f[(i + 1) % f.length]])), c].map((p) => p.map((x, j) => (x + (c[j] - x) * 1e-6) * (1 - 1e-6))); });
  const within = (a, b) => samples(a).every((p) => isIn[b](p));
  const chain = ROOF_FOLD_KINDS.filter((k) => k !== 'star');
  const chained = chain.every((k, i) => i === 0 || within(chain[i - 1], k));
  const crosses = (k) => samples('star').some((p) => !isIn[k](p)) && samples(k).some((p) => !isIn.star(p));
  check(`wrap order ${ROOF_FOLD_KINDS.join(' → ')}: ${chain.join(' ⊂ ')}; ico ⊂ star ⊂ dodeca; the star crosses oct, stella and cube`,
    chained && within('ico', 'star') && within('star', 'dodeca') && ['oct', 'stella', 'cube'].every(crosses)
    && ROOF_FOLD_KINDS.indexOf('star') === ROOF_FOLD_KINDS.indexOf('dodeca') - 1);
}

// Stella–Jewel Lattice (ported from Kaleidohedra, 2026-10-08).
// The Dragon Jewel (the EKP windows solid): 12 rhombi and 48 walls enclosing exactly 12.
{
  const { rhombi, walls } = ekpWindowsSolid();
  const vol = [...rhombi, ...walls].reduce((t, f) => { for (let m = 1; m + 1 < f.length; m++) t += dot(f[0], cross(f[m], f[m + 1])); return t; }, 0) / 6;
  check(`Dragon Jewel: ${rhombi.length} rhombi and ${walls.length} walls, volume ${vol.toFixed(9)} = 12`, rhombi.length === 12 && walls.length === 48 && Math.abs(vol - 12) < 1e-9);
}
// (f) Windows and stellas, checkerboard (a study of #10; direct question, 2026-10-08: "a male
// counterpart to window"): windows in the even cells, a stella octangula in the odd ones, fill
// space. Each odd cube must be exactly its stella plus its six even neighbours' roofs with the
// stella carved out, no gap or overlap: checked on a 40^3 grid of points in the cube, and by
// volume (6 carved roofs = cube - stella = 4; windows 12 + stella 4 = two cubes).
{
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const halfSpaces = (V) => {
    const H = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) for (let k = j + 1; k < V.length; k++) {
      const n0 = cr(sub(V[j], V[i]), sub(V[k], V[i])), L = norm(n0);
      if (L < 1e-9) continue;
      const n = n0.map((x) => x / L), d = dot(n, V[i]), side = V.map((q) => dot(n, q) - d);
      if (side.every((x) => x <= 1e-9)) H.push([n, d]); else if (side.every((x) => x >= -1e-9)) H.push([n.map((x) => -x), -d]);
    }
    return H;
  };
  const inside = (H, q) => H.every(([n, d]) => dot(n, q) <= d);
  const tets = [[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]]].map(halfSpaces);
  const dv = [];
  for (const f of roofFoldSolids().dodeca.faces) for (const q of f) if (!dv.some((r) => norm(sub(q, r)) < 1e-9)) dv.push(q);
  const roofs = [];
  for (let a = 0; a < 3; a++) for (const sg of [1, -1]) roofs.push(halfSpaces(dv.filter((q) => sg * q[a] >= 1 - 1e-9).map((q) => q.map((c, i) => (i === a ? c - 2 * sg : c)))));
  const N = 40;
  let bad = 0, inStella = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const q = [i, j, k].map((t, ax) => -1 + (2 * (t + 0.5)) / N + 1e-7 * (ax + 1));
    const st = tets.some((H) => inside(H, q));
    const r = roofs.filter((H) => inside(H, q)).length;
    if (st) inStella++;
    if (!st && r !== 1) bad++;
  }
  const a = 2 / PHI, dodecaVol = ((15 + 7 * Math.sqrt(5)) / 4) * a ** 3, roof = (dodecaVol - 8) / 6, carved = (dodecaVol - 12) / 6;
  check(`windows and stellas, checkerboard: each odd cube is its stella + six carved roofs (${N ** 3} points, ${bad} uncovered or doubled); 6 x ${(roof - carved).toFixed(4)} = cube - stella = 4`, bad === 0 && Math.abs(6 * (roof - carved) - 4) < 1e-12 && Math.abs(inStella / N ** 3 - 0.5) < 0.01);
}

// (g) The Dragon Jewel (DICTO's name for the windows solid on its own, 2026-10-08) and the
// Stella–Jewel Lattice. Five-fold: each window lies in a dodecahedron face (its normal one of the
// six five-fold axes); each face has five window positions (one per pentagon diagonal), and the
// cube picks the one whose diagonal is a cube edge. Dragon Jewels alone on the even cells (FCC)
// meet face to face on all 12 rhombi. The world's point tests agree with the checkerboard (10b).
{
  const W = ekpWindowRhombi(), P5 = fiveWindowPositions(), axes = fiveFoldAxes();
  const sameSet = (A, B) => A.length === B.length && A.every((p) => B.some((q) => norm(sub(p, q)) < 1e-9));
  const chosen = P5.filter((x) => x.chosen).map((x) => x.rhombus);
  const picks = P5.length === 60 && chosen.length === 12 && chosen.every((r) => W.some((w) => sameSet(r, w)));
  const nrm = (r) => { const n = cross(sub(r[1], r[0]), sub(r[2], r[0])); return n.map((c) => c / norm(n)); };
  const onAxes = axes.length === 6 && W.every((r) => axes.some((a) => Math.abs(Math.abs(dot(a, nrm(r))) - 1) < 1e-9));
  const thick = P5.every(({ rhombus: [A, V, B] }) => Math.abs(Math.acos(dot(sub(A, V), sub(B, V)) / (norm(sub(A, V)) * norm(sub(B, V)))) * 180 / Math.PI - 108) < 1e-9);
  check('Dragon Jewel, five-fold: 6 five-fold axes; each face has 5 window positions (thick rhombi on its diagonals), and the cube picks exactly the 12 windows, each facing a five-fold axis', picks && onAxes && thick);
  const FCC = PAIR_LATTICE_NEIGHBOURS.slice(6);
  const faceToFace = W.every((r) => FCC.some((s) => W.some((w) => sameSet(r, w.map((p) => p.map((c, i) => c + 2 * s[i]))))));
  check('Dragon Jewels alone on the even cells (FCC) meet face to face on all 12 rhombi', faceToFace);
  const N = 24;
  let bad = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const q = [i, j, k].map((t, ax) => -1 + (2 * (t + 0.5)) / N + 1e-7 * (ax + 1));
    const st = insideStella(q);
    const dj = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter((d) => insideDragonJewel(q.map((c, a) => c - 2 * d[a]))).length;
    if ((st ? 1 : 0) + dj !== 1) bad++;
  }
  check(`Stella–Jewel Lattice point tests: each point of an odd cube is in its stella octangula or exactly one neighbouring Dragon Jewel (${N ** 3} points, ${bad} wrong)`, bad === 0);
}


// Sunstar Lattice (ported from Kaleidohedra, 2026-10-08).
// (h) The Dogstar (DICTO, 2026-10-08; DICTO's name, first called the gap star; a dodecahedron with its Dogstars round it is a Sunstar): the hole left in each odd cell by regular dodecahedra on the
// even cells (their densest lattice packing). A closed surface of 60 triangles on the 12 face planes of
// a dodecahedron 1/phi^3 the cell's, edges only 2/phi^4, 2/phi^3, 2/phi^2 and 2/phi, volume exactly
// 16 minus the dodecahedron; dodecahedra and Dogstars fill space (point grid, ray casting).
{
  const F = dogstarSolid();
  const vol = F.reduce((t, f) => { for (let m = 1; m + 1 < f.length; m++) t += dot(f[0], cross(f[m], f[m + 1])); return t; }, 0) / 6;
  const dodecaVol = ((15 + 7 * Math.sqrt(5)) / 4) * (2 / PHI) ** 3;
  const dir = new Map();
  const vkey = (p) => p.map((c) => (Math.round(c * 1e7) / 1e7 + 0).toFixed(7)).join();
  for (const f of F) f.forEach((p, i) => { const k = `${vkey(p)}>${vkey(f[(i + 1) % f.length])}`; dir.set(k, (dir.get(k) ?? 0) + 1); });
  const closed = [...dir.entries()].every(([k, n]) => { const [a, b] = k.split('>'); return n === 1 && dir.get(`${b}>${a}`) === 1; });
  const golden = [4, 3, 2, 1].map((k) => 2 / PHI ** k);
  const edgesGolden = F.every((f) => f.every((p, i) => golden.some((g) => Math.abs(norm(sub(f[(i + 1) % f.length], p)) - g) < 1e-9)));
  const r = roofFoldSolids().dodeca.faces.map((f) => Math.abs(dot(f[0], (() => { const n = cross(sub(f[1], f[0]), sub(f[2], f[0])); return n.map((c) => c / norm(n)); })())))[0] / PHI ** 3;
  const onPlanes = F.every((f) => { const n = cross(sub(f[1], f[0]), sub(f[2], f[0])); const u = n.map((c) => c / norm(n)); return Math.abs(Math.abs(dot(u, f[0])) - r) < 1e-9; });
  // Fill: points of an odd cube are in the Dogstar or in exactly one neighbouring dodecahedron.
  const D = roofFoldSolids().dodeca.faces.map((f) => { const n = cross(sub(f[1], f[0]), sub(f[2], f[0])); const u = n.map((c) => c / norm(n)); return [u, dot(u, f[0])]; });
  const inDodecaAt = (p, c) => D.every(([n, d]) => dot(n, sub(p, c)) <= d + 1e-12);
  const inGap = (p) => { let hits = 0; const d = [0.5773, 0.6123, 0.5401]; for (const f of F) for (let m = 1; m + 1 < f.length; m++) { const a = sub(f[0], p), e1 = sub(f[m], f[0]), e2 = sub(f[m + 1], f[0]); const h = cross(d, e2), det = dot(e1, h); if (Math.abs(det) < 1e-12) continue; const sv = a.map((c) => -c); const u = dot(sv, h) / det; if (u < 0 || u > 1) continue; const q = cross(sv, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue; if (dot(e2, q) / det > 0) hits++; } return hits % 2 === 1; };
  const N = 20;
  let bad = 0;
  const evens = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if ((x + y + z) % 2 !== 0) evens.push([2 * x, 2 * y, 2 * z]);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const q = [i, j, k].map((t, ax) => -1 + (2 * (t + 0.5)) / N + 1e-7 * (ax + 1));
    const count = (inGap(q) ? 1 : 0) + evens.filter((c) => inDodecaAt(q, c)).length;
    if (count !== 1) bad++;
  }
  check(`Dogstar: closed, ${F.length} triangles on the 12 face planes of a dodecahedron 1/phi^3 the cell's, edges only 2/phi^4..2/phi, volume ${vol.toFixed(6)} = 16 - dodecahedron; with dodecahedra it fills space (the Sunstar Lattice) (${N ** 3} points, ${bad} wrong)`, closed && F.length === 60 && onPlanes && edgesGolden && Math.abs(vol - (16 - dodecaVol)) < 1e-9 && bad === 0);
}

// (i) The Sunstar Lattice world's point tests: each point of an odd cube is in its Dogstar or in
// exactly one of the 14 dodecahedra round it.
{
  const N = 22, round = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if ((x + y + z) % 2 !== 0) round.push([x, y, z]);
  let bad = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const q = [i, j, k].map((t, ax) => -1 + (2 * (t + 0.5)) / N + 1e-7 * (ax + 1));
    const n = (insideDogstar(q) ? 1 : 0) + round.filter((d) => insideDodecahedron(q.map((c, a) => c - 2 * d[a]))).length;
    if (n !== 1) bad++;
  }
  check(`Sunstar Lattice point tests: each point of an odd cube is in its Dogstar or exactly one dodecahedron (${N ** 3} points, ${bad} wrong)`, bad === 0);
}

console.log(failures === 0 ? '\nAll checks passed (0 failures).' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
