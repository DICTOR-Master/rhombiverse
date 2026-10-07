// Verifies DICTO Hex Prism (geometry-extensions/dicto-hex.js): the
// leaning regular-hexagonal prism of four equal edge directions, and the
// slid hexagonal lattice it tiles.
//
//   - edge 1 everywhere; u, v, w at 60 degrees in a plane; the lean at 90
//     degrees to u and 72 to v and w; it leans ~20.9 degrees from upright;
//   - faces: two regular hexagons, two squares, four 72/108 rhombi;
//   - volume 3 phi / 2 at edge 1;
//   - copies at the lattice cells fill space: random points lie in exactly
//     one cell, and the cell's volume equals the volume per lattice cell;
//   - a click on any face finds the neighbour across it, face to face.
import { dictoHexLean, dictoHexCellVerts, dictoHexCellFaces, dictoHexCellToWorld, matchDictoHexNeighborOffset, DICTO_HEX_NEIGHBOR_OFFSETS } from '../src/geometry-extensions/dicto-hex.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}
const PHI = (1 + Math.sqrt(5)) / 2;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => Math.hypot(...a);
const deg = (a, b) => (Math.acos(dot(a, b) / (norm(a) * norm(b))) * 180) / Math.PI;

const V = dictoHexCellVerts(1), F = dictoHexCellFaces(), d = dictoHexLean(1);
const u = [1, 0, 0], v = [0.5, Math.sqrt(3) / 2, 0], w = [-0.5, Math.sqrt(3) / 2, 0];

// 1. Directions and lean.
check(`the lean is unit length, at 90 degrees to u and 72 to v and w (${deg(d, u).toFixed(6)}, ${deg(d, v).toFixed(6)}, ${deg(d, w).toFixed(6)})`,
  Math.abs(norm(d) - 1) < 1e-12 && Math.abs(deg(d, u) - 90) < 1e-9 && Math.abs(deg(d, v) - 72) < 1e-9 && Math.abs(deg(d, w) - 72) < 1e-9);
const lean = deg(d, [0, 0, 1]);
check(`it leans asin((phi - 1) / sqrt 3) = ${lean.toFixed(4)} degrees from upright`, Math.abs(Math.sin((lean * Math.PI) / 180) - (PHI - 1) / Math.sqrt(3)) < 1e-12 && Math.abs(lean - 20.9) < 0.05);

// 2. Faces.
const edgesOf = (f) => f.map((i, k) => norm(sub(V[f[(k + 1) % f.length]], V[i])));
check('every edge has length 1', F.every((f) => edgesOf(f).every((e) => Math.abs(e - 1) < 1e-12)));
const corner = (f, k) => deg(sub(V[f[(k + f.length - 1) % f.length]], V[f[k]]), sub(V[f[(k + 1) % f.length]], V[f[k]]));
const kinds = F.map((f) => (f.length === 6 ? (f.every((_, k) => Math.abs(corner(f, k) - 120) < 1e-9) ? 'hexagon' : '?') : f.every((_, k) => Math.abs(corner(f, k) - 90) < 1e-9) ? 'square' : [72, 108].includes(Math.round(corner(f, 0))) && Math.abs(corner(f, 0) + corner(f, 1) - 180) < 1e-9 ? 'rhombus72' : '?'));
const count = (k) => kinds.filter((x) => x === k).length;
check(`faces: ${count('hexagon')} regular hexagons, ${count('square')} squares, ${count('rhombus72')} rhombi of 72/108 degrees`, count('hexagon') === 2 && count('square') === 2 && count('rhombus72') === 4);
const planar = F.every((f) => { const n = cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]])); return f.every((i) => Math.abs(dot(n, sub(V[i], V[f[0]]))) < 1e-12); });
check('every face is flat', planar);

// 3. Volume.
const vol = Math.abs(F.reduce((s, f) => { for (let k = 1; k + 1 < f.length; k++) s += dot(V[f[0]], cross(V[f[k]], V[f[k + 1]])); return s; }, 0)) / 6;
check(`volume 3 phi / 2 = ${(1.5 * PHI).toFixed(6)} at edge 1 (${vol.toFixed(6)})`, Math.abs(vol - 1.5 * PHI) < 1e-12);
const a1 = dictoHexCellToWorld(1, 0, 0), a2 = dictoHexCellToWorld(0, 1, 0), a3 = dictoHexCellToWorld(0, 0, 1);
check(`one cell per lattice point: |det| of the lattice = ${Math.abs(dot(a1, cross(a2, a3))).toFixed(6)}`, Math.abs(Math.abs(dot(a1, cross(a2, a3))) - vol) < 1e-12);

// 4. Fill: random points lie in exactly one nearby cell.
const planes = F.map((f) => { let n = cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]])); n = scale(n, 1 / norm(n)); const c = dot(n, V[f[0]]); return c < 0 ? [scale(n, -1), -c] : [n, c]; });
const inCell = (p, c) => planes.every(([n, k]) => dot(n, sub(p, c)) <= k + 1e-12);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let bad = 0;
const N = 4000;
for (let i = 0; i < N; i++) {
  const p = [rand() * 6 - 3, rand() * 6 - 3, rand() * 6 - 3];
  let hits = 0;
  for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) for (let z = -5; z <= 5; z++) if (inCell(p, dictoHexCellToWorld(q, r, z))) hits++;
  if (hits !== 1) bad++;
}
check(`copies at every lattice cell fill space: ${N} random points, ${bad} in none or several`, bad === 0);

// 5. Neighbours: across each face, the neighbour shares that face exactly.
let ok = 0;
for (const f of F) {
  const P = f.map((i) => V[i]);
  let n = cross(sub(P[1], P[0]), sub(P[2], P[0]));
  const c = scale(P.reduce(add, [0, 0, 0]), 1 / P.length);
  if (dot(n, c) < 0) n = scale(n, -1);
  const o = matchDictoHexNeighborOffset({ x: n[0], y: n[1], z: n[2] });
  if (!o) continue;
  const t = dictoHexCellToWorld(...o);
  // The neighbour's own corners include all of this face's corners.
  if (P.every((p) => V.some((q) => norm(sub(add(q, t), p)) < 1e-9))) ok++;
}
check(`a tap on each of the ${F.length} faces finds the neighbour sharing it (${ok})`, ok === F.length && new Set(F.map((f) => { const P = f.map((i) => V[i]); const c = scale(P.reduce(add, [0, 0, 0]), 1 / P.length); return String(matchDictoHexNeighborOffset({ x: c[0], y: c[1], z: c[2] })); })).size === DICTO_HEX_NEIGHBOR_OFFSETS.length);

console.log(failures === 0 ? '\nAll checks passed (0 failures).' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
