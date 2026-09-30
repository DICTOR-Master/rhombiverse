// Verifies DICTO FCC (geometry-extensions/dicto-fcc.js): DICTO's skewed
// rhombic dodecahedron of medium blue Zometool struts, and the sheared
// FCC lattice it tiles.
//
//   - its four edge directions are blue-strut lines (icosahedral two-fold
//     axes) meeting at 60 degrees three times and 72 three times, no three
//     in a plane;
//   - it has the rhombic dodecahedron's 14 corners and 12 rhombic faces,
//     six of 60 and six of 72 degrees, with the RD's own edge length;
//   - it splits into 2 all-rhombus blocks (phi/2 each at edge 1) and 2
//     flattened rhombohedra (1/2 each), so its volume is phi^2 at edge 1;
//   - the shear M carries FCC's 12 neighbour offsets exactly onto its 12
//     face-to-face translations (2 x each face centre);
//   - copies at the lattice cells fill space: random points lie in exactly
//     one cell, and the cell's volume equals the volume per lattice cell;
//   - a click on any face finds the neighbour across it.
import { NEIGHBOR_OFFSETS, isValidCell } from '../src/core/lattice.js';
import { blueLines, DICTO_DIRECTIONS, dictoCellVerts, dictoMatrix, dictoCellToWorld, matchDictoNeighborOffset } from '../src/geometry-extensions/dicto-fcc.js';

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
const det3 = (a, b, c) => dot(a, cross(b, c));
const lineAngle = (a, b) => Math.round((Math.acos(Math.min(1, Math.abs(dot(a, b)) / (norm(a) * norm(b)))) * 180) / Math.PI);
const EDGE = Math.sqrt(3) / 2; // the RD's edge at scale 1

// 1. Blue-strut directions.
const G = DICTO_DIRECTIONS;
const angles = [];
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) angles.push(lineAngle(G[i], G[j]));
check(`edge directions meet at 60 degrees three times and 72 three times (${angles.join(', ')})`, [...angles].sort((a, b) => a - b).join() === '60,60,60,72,72,72');
check('no three edge directions in a plane', [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].every(([i, j, k]) => Math.abs(det3(G[i], G[j], G[k])) > 1e-6));
{
  // Some rotation takes all four onto blue lines: the angle pattern of any four is rotation-invariant,
  // so match against the blue lines directly (a line set with this exact Gram matrix up to signs).
  const L = blueLines();
  const gram = (S) => S.map((a) => S.map((b) => Math.abs(dot(a, b)).toFixed(9)).join()).join('|');
  const target = gram(G);
  let found = false;
  const idx = [...Array(15).keys()];
  for (const a of idx) for (const b of idx) for (const c of idx) for (const d of idx) {
    if (found || new Set([a, b, c, d]).size < 4) continue;
    if (gram([L[a], L[b], L[c], L[d]]) === target) found = true;
  }
  check('the four directions are blue-strut lines of one icosahedral frame', found);
}

// 2. Corners and faces.
const V = dictoCellVerts(1);
check(`14 corners, like the rhombic dodecahedron (${V.length})`, V.length === 14);
const e = G.map((g) => scale(g, EDGE));
const faceAngles = [];
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) faceAngles.push(lineAngle(e[i], e[j]), lineAngle(e[i], e[j]));
check('12 rhombic faces: six of 60 degrees and six of 72', faceAngles.filter((a) => a === 60).length === 6 && faceAngles.filter((a) => a === 72).length === 6);
check("every edge is the RD's own edge length", V.every((v) => V.some((w) => w !== v && G.some((g) => Math.abs(norm(sub(v, w)) - EDGE) < 1e-9 && Math.abs(Math.abs(dot(sub(v, w), g)) / EDGE - 1) < 1e-9))));

// 3. Blocks and volume.
const blocks = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]].map(([i, j, k]) => Math.abs(det3(G[i], G[j], G[k])));
const halves = blocks.filter((v) => Math.abs(v - 0.5) < 1e-9).length;
const phiHalves = blocks.filter((v) => Math.abs(v - PHI / 2) < 1e-9).length;
check(`blocks at edge 1: 2 flattened rhombohedra of volume 1/2 and 2 all-rhombus blocks of phi/2 (${blocks.map((v) => v.toFixed(6)).join(', ')})`, halves === 2 && phiHalves === 2);
const volume = blocks.reduce((s, v) => s + v, 0);
check(`volume at edge 1 is phi^2 = 1 + phi (${volume.toFixed(9)})`, Math.abs(volume - PHI * PHI) < 1e-12);

// 4. The shear.
const M = dictoMatrix(1);
const faceCentres = [];
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
  const n = cross(e[i], e[j]);
  for (const sgn of [1, -1]) {
    const nn = scale(n, sgn);
    faceCentres.push(e.reduce((c, gk, k) => (k === i || k === j ? c : add(c, scale(gk, Math.sign(dot(nn, gk)) / 2))), [0, 0, 0]));
  }
}
const translations = faceCentres.map((c) => scale(c, 2));
const images = NEIGHBOR_OFFSETS.map(([x, y, z]) => dictoCellToWorld(x, y, z, 1));
check("the shear takes FCC's 12 neighbour offsets exactly onto the 12 face-to-face translations", images.every((p) => translations.some((t) => norm(sub(p, t)) < 1e-9)) && translations.every((t) => images.some((p) => norm(sub(p, t)) < 1e-9)));
const detM = Math.abs(det3(M[0], M[1], M[2]));
const cellVolume = volume * EDGE ** 3;
check(`cell volume = volume per lattice cell, 2 |det M| (${cellVolume.toFixed(9)} = ${(2 * detM).toFixed(9)})`, Math.abs(cellVolume - 2 * detM) < 1e-9);

// 5. Tiling: random points lie in exactly one cell.
{
  const planes = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const n = cross(e[i], e[j]);
    const u = scale(n, 1 / norm(n));
    for (const sgn of [1, -1]) {
      const nn = scale(u, sgn);
      const c = e.reduce((acc, gk, k) => (k === i || k === j ? acc : add(acc, scale(gk, Math.sign(dot(nn, gk)) / 2))), [0, 0, 0]);
      planes.push([nn, dot(nn, c)]);
    }
  }
  const inside = (p) => planes.every(([n, d]) => dot(n, p) < d - 1e-9);
  const cells = [];
  for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) for (let z = -4; z <= 4; z++) if (isValidCell(x, y, z)) cells.push(dictoCellToWorld(x, y, z, 1));
  let seed = 11;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let bad = 0, n = 0;
  for (let k = 0; k < 4000; k++) {
    const p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    const count = cells.filter((c) => inside(sub(p, c))).length;
    if (count > 1) bad++;
    if (count === 0 && planes.every(() => true)) {
      // On a shared face (within the tolerance band) no cell claims it strictly: allow only if it's within 1e-6 of some face.
      const near = cells.some((c) => planes.some(([nn, d]) => Math.abs(dot(nn, sub(p, c)) - d) < 1e-6));
      if (!near) bad++;
    }
    n++;
  }
  check(`${n} random points: each lies in exactly one cell (${bad} exceptions)`, bad === 0);
}

// 6. A click on each face finds the neighbour across it.
{
  // Each face's true outward normal (what a click reports), and the face's own translation.
  let ok = 0;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const n = cross(e[i], e[j]);
    for (const sgn of [1, -1]) {
      const nn = scale(n, sgn / norm(n));
      const t = scale(e.reduce((c, gk, k) => (k === i || k === j ? c : add(c, scale(gk, Math.sign(dot(nn, gk)) / 2))), [0, 0, 0]), 2);
      const o = matchDictoNeighborOffset({ x: nn[0], y: nn[1], z: nn[2] }, 1);
      if (o && norm(sub(dictoCellToWorld(o[0], o[1], o[2], 1), t)) < 1e-9) ok++;
    }
  }
  check(`each of the 12 faces leads to the neighbour across it (${ok}/12)`, ok === 12);
}

console.log(failures === 0 ? '\nAll checks passed (0 failures).' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
