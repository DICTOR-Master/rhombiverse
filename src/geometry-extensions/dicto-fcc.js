// DICTO FCC (direct request 2026-09-30): a skewed rhombic dodecahedron
// DICTO built in Zometool from medium blue struts, and the sheared FCC
// lattice it tiles. Credit: DICTO, built in Zometool. See Polyhedraverse's
// docs/dicto-zometool-discoveries.md for the full account.
//
// The cell is the zonohedron on four blue-strut directions (Zometool's
// blue struts lie along the 15 two-fold axes of icosahedral symmetry)
// that meet at 60 degrees three times and 72 degrees three times, no
// three in a plane: twelve rhombic faces, six of 60 and six of 72
// degrees, and the rhombic dodecahedron's 14 corners. It splits into two
// "all-rhombus" blocks (volume phi/2 each at edge 1) and two flattened
// rhombohedra (1/2 each), so its volume is 1 + phi = phi^2.
//
// It tiles space exactly as the rhombic dodecahedra of FCC do, sheared:
// one linear map M carries FCC's 12 nearest-neighbour vectors onto the
// cell's 12 face-to-face translations (verify-dicto-fcc.mjs proves it).
// So this lattice reuses FCC's own cell coordinates and neighbour table
// (core/lattice.js: integer x, y, z with x + y + z even) unchanged, and
// only M differs: world = M (x, y, z).
//
// Size: edge = the RD's own edge (sqrt 3 / 2 at scale 1), so the two
// worlds sit side by side at the same scale. Orientation: the four edge
// directions are turned to lie as close as possible to the RD's four
// body-diagonal edge directions, so the world reads as a sheared RD world.
import { NEIGHBOR_OFFSETS, isValidCell } from '../core/lattice.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => scale(a, 1 / norm(a));
const det3 = (a, b, c) => dot(a, cross(b, c));

/** The 15 blue-strut lines (icosahedral two-fold axes), unit vectors. */
export function blueLines() {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const e = [0, 0, 0]; e[k] = 1; out.push(e);
    for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
      const q = [0, 0, 0];
      q[k] = 0.5; q[(k + 1) % 3] = (s1 * PHI) / 2; q[(k + 2) % 3] = s2 / (2 * PHI);
      out.push(unit(q));
    }
  }
  return out;
}

const lineAngle = (a, b) => Math.round((Math.acos(Math.min(1, Math.abs(dot(a, b)))) * 180) / Math.PI);

/** The four blue directions of DICTO's cell (60 degrees three times, 72 three times), in the blue frame. */
function cellDirectionsBlueFrame() {
  const L = blueLines();
  for (let a = 0; a < 15; a++) for (let b = a + 1; b < 15; b++) for (let c = b + 1; c < 15; c++) for (let d = c + 1; d < 15; d++) {
    const S = [L[a], L[b], L[c], L[d]];
    const triples = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
    if (triples.some(([i, j, k]) => Math.abs(det3(S[i], S[j], S[k])) < 1e-9)) continue;
    const angles = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) angles.push(lineAngle(S[i], S[j]));
    if (angles.sort((x, y) => x - y).join() === '60,60,60,72,72,72') return S;
  }
  throw new Error('dicto-fcc: no blue cell found');
}

/** A rotation (as a function) taking p0 to q0 exactly and p1 as near q1 as it can go. */
function alignTwo(p0, p1, q0, q1) {
  const frame = (x, y) => {
    const e1 = unit(x);
    const e2 = unit(sub(y, scale(e1, dot(y, e1))));
    return [e1, e2, cross(e1, e2)];
  };
  const P = frame(p0, p1), Q = frame(q0, q1);
  return (v) => add(add(scale(Q[0], dot(v, P[0])), scale(Q[1], dot(v, P[1]))), scale(Q[2], dot(v, P[2])));
}

const RD_DIAGONALS = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(unit);

/** The cell's four unit edge directions, turned to lie closest to the RD's body diagonals. */
export const DICTO_DIRECTIONS = (() => {
  const G = cellDirectionsBlueFrame();
  const perms = [];
  const permute = (arr, rest) => (rest.length ? rest.forEach((x, i) => permute([...arr, x], rest.filter((_, j) => j !== i))) : perms.push(arr));
  permute([], [0, 1, 2, 3]);
  let best = null;
  for (const p of perms) for (let signs = 0; signs < 16; signs++) {
    const g = p.map((gi, k) => scale(G[gi], (signs >> k) & 1 ? -1 : 1));
    const rot = alignTwo(g[0], g[1], RD_DIAGONALS[0], RD_DIAGONALS[1]);
    const r = g.map(rot);
    const misfit = r.reduce((s, v, k) => s + norm(sub(v, RD_DIAGONALS[k])), 0);
    if (!best || misfit < best.misfit - 1e-12) best = { misfit, r };
  }
  return best.r;
})();

const RD_EDGE = Math.sqrt(3) / 2; // rdRawVerts(1): (1/2,1/2,1/2) to (1,0,0)

/** The cell's 14 corners at scale s (edge = the RD's), centred on the origin. */
export function dictoCellVerts(s = 1) {
  const e = RD_EDGE * s;
  const out = [];
  for (let m = 0; m < 16; m++) {
    let v = [0, 0, 0];
    DICTO_DIRECTIONS.forEach((g, k) => { v = add(v, scale(g, ((m >> k) & 1 ? 0.5 : -0.5) * e)); });
    out.push(v);
  }
  // Of the 16 sums, 14 are corners; the other 2 lie inside (where the
  // four blocks meet). A corner lies on at least three face planes.
  const faces = cellFaces(s);
  return out.filter((v) => faces.filter((f) => Math.abs(dot(f.normal, v) - f.offset) < 1e-9).length >= 3);
}

/** The 12 faces at edge e (scale s): unit outward normal and distance. Each spans two edge directions. */
function cellFaces(s = 1) {
  const e = RD_EDGE * s;
  const g = DICTO_DIRECTIONS.map((d) => scale(d, e));
  const faces = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const n = unit(cross(g[i], g[j]));
    for (const sgn of [1, -1]) {
      const nn = scale(n, sgn);
      // The face's centre is where the other two directions push it: half of each, on nn's side.
      const centre = g.reduce((c, gk, k) => (k === i || k === j ? c : add(c, scale(gk, Math.sign(dot(nn, gk)) / 2))), [0, 0, 0]);
      faces.push({ normal: nn, offset: dot(nn, centre), centre, span: [i, j] });
    }
  }
  return faces;
}

/**
 * The shear M, as its three columns: world = M (x, y, z) for FCC cell
 * coordinates. Chosen so FCC's 12 neighbour offsets land exactly on the
 * cell's 12 face-to-face translations (2 x each face centre), and of the
 * maps that do, the one closest to the plain FCC map, so neighbouring
 * cells keep their familiar directions.
 */
export function dictoMatrix(s = 1) {
  const T = cellFaces(s).map((f) => scale(f.centre, 2));
  const F = NEIGHBOR_OFFSETS;
  const solve = (fa, fb, fc, ta, tb, tc) => {
    // M F = T for three independent pairs: M = T F^-1.
    const D = det3(fa, fb, fc);
    if (Math.abs(D) < 1e-9) return null;
    const inv = [cross(fb, fc), cross(fc, fa), cross(fa, fb)].map((r) => scale(r, 1 / D)); // rows of F^-1 (F has columns fa, fb, fc)
    // M = [ta tb tc] * F^-1 ; column k of M = sum_i t_i * inv[i][k]
    return [0, 1, 2].map((k) => add(add(scale(ta, inv[0][k]), scale(tb, inv[1][k])), scale(tc, inv[2][k])));
  };
  const apply = (M, v) => add(add(scale(M[0], v[0]), scale(M[1], v[1])), scale(M[2], v[2]));
  const [fa, fb, fc] = [F[0], F[4], F[8]];
  let best = null;
  for (const ta of T) for (const tb of T) for (const tc of T) {
    const M = solve(fa, fb, fc, ta, tb, tc);
    if (!M) continue;
    if (!F.every((f) => T.some((t) => norm(sub(apply(M, f), t)) < 1e-9))) continue;
    const dist = [0, 1, 2].reduce((sum, k) => sum + norm(sub(M[k], [k === 0 ? s : 0, k === 1 ? s : 0, k === 2 ? s : 0])), 0);
    if (!best || dist < best.dist) best = { dist, M };
  }
  if (!best) throw new Error('dicto-fcc: no shear maps FCC onto the cell');
  return best.M;
}

const matrixCache = new Map();
function matrixFor(s) {
  if (!matrixCache.has(s)) matrixCache.set(s, dictoMatrix(s));
  return matrixCache.get(s);
}

/** World position of FCC cell (x, y, z) in the DICTO lattice. */
export function dictoCellToWorld(x, y, z, s = 1) {
  const M = matrixFor(s);
  return add(add(scale(M[0], x), scale(M[1], y)), scale(M[2], z));
}

export const DICTO_NEIGHBOR_OFFSETS = NEIGHBOR_OFFSETS;
export { isValidCell as isValidDictoCell };

/**
 * The neighbour offset across the face a hit landed on: the face whose
 * outward normal is closest to the hit's, then its translation mapped
 * back to FCC coordinates.
 */
export function matchDictoNeighborOffset(faceNormal, s = 1) {
  const faces = cellFaces(s);
  let best = faces[0];
  for (const f of faces) if (dot(f.normal, [faceNormal.x, faceNormal.y, faceNormal.z]) > dot(best.normal, [faceNormal.x, faceNormal.y, faceNormal.z])) best = f;
  const t = scale(best.centre, 2);
  const M = matrixFor(s);
  return NEIGHBOR_OFFSETS.find((o) => norm(sub(dictoCellToWorld(o[0], o[1], o[2], s), t)) < 1e-9);
}

export const DICTO_ZOME_BLUE = 0x1f5fa8; // Zometool's blue strut colour, roughly

// ---- The four blocks (stage 2, direct request 2026-10-01) ----------------
// Each cell splits into four parallelepipeds, one per choice of three of
// its four edge directions: two "all-rhombus" blocks (volume phi/2 at edge
// 1) and two flattened rhombohedra (1/2). Together the blocks of every
// cell fill space, so a block's face is shared with exactly one other
// block, in the same cell or a neighbouring one.

const TRIPLES = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];

/** Does a point lie strictly inside a parallelepiped (origin o, edges a, b, c)? */
function insideBox(p, o, a, b, c) {
  const D = det3(a, b, c);
  const r = sub(p, o);
  const t = [det3(r, b, c) / D, det3(a, r, c) / D, det3(a, b, r) / D];
  return t.every((x) => x > 1e-9 && x < 1 - 1e-9);
}

/**
 * Where each block sits: the cell is the sweep of its four edges from its
 * lowest corner, and each block is that corner plus either nothing or the
 * one edge it doesn't use. Of the 16 ways to choose, the one whose four
 * blocks don't overlap (tested at points spread through each block).
 */
function blockOffsets(g) {
  const cornerPts = (o, a, b, c) => {
    const pts = [];
    for (const i of [0.2, 0.5, 0.8]) for (const j of [0.2, 0.5, 0.8]) for (const k of [0.2, 0.5, 0.8]) pts.push(add(add(add(o, scale(a, i)), scale(b, j)), scale(c, k)));
    return pts;
  };
  for (let m = 0; m < 16; m++) {
    const boxes = TRIPLES.map((t, q) => {
      const missing = [0, 1, 2, 3].find((i) => !t.includes(i));
      return { o: (m >> q) & 1 ? g[missing] : [0, 0, 0], e: t.map((i) => g[i]) };
    });
    const clash = boxes.some((b1, i) => boxes.some((b2, j) => j > i && cornerPts(b1.o, ...b1.e).some((p) => insideBox(p, b2.o, ...b2.e))));
    if (!clash) return boxes;
  }
  throw new Error('dicto-fcc: no non-overlapping block arrangement');
}

const blocksCache = new Map();

/**
 * The cell's four blocks at scale s, relative to the cell centre:
 * corners, kind, and for each of its six faces the outward normal, the
 * face centre and the neighbouring block across it ({ offset, q }, offset
 * in FCC cell coordinates, [0, 0, 0] for a block of the same cell).
 */
export function dictoBlocks(s = 1) {
  if (blocksCache.has(s)) return blocksCache.get(s);
  const e = RD_EDGE * s;
  const g = DICTO_DIRECTIONS.map((d) => scale(d, e));
  const centre = scale(g.reduce(add, [0, 0, 0]), 0.5);
  const boxes = blockOffsets(g).map((b) => ({ o: sub(b.o, centre), e: b.e }));
  const blocks = boxes.map(({ o, e: [a, b, c] }, q) => {
    const corners = [];
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) corners.push(add(add(add(o, scale(a, i)), scale(b, j)), scale(c, k)));
    const mid = add(o, scale(add(add(a, b), c), 0.5));
    const faces = [];
    for (const [p1, p2, other] of [[a, b, c], [a, c, b], [b, c, a]]) {
      const n = unit(cross(p1, p2));
      for (const side of [0, 1]) {
        const fc = add(add(o, scale(add(p1, p2), 0.5)), scale(other, side));
        const nn = dot(n, sub(fc, mid)) > 0 ? n : scale(n, -1);
        faces.push({ normal: nn, centre: fc });
      }
    }
    const volume = Math.abs(det3(a, b, c)) / e ** 3;
    return { q, corners, faces, kind: Math.abs(volume - 0.5) < 1e-9 ? 'flattened' : 'allRhombus' };
  });
  // Neighbours: the block (in this cell or one of its 12 neighbours) with a face at the same centre, facing back.
  const M = matrixFor(s);
  const at = (o) => add(add(scale(M[0], o[0]), scale(M[1], o[1])), scale(M[2], o[2]));
  for (const b of blocks) {
    b.neighbours = b.faces.map((f) => {
      for (const offset of [[0, 0, 0], ...NEIGHBOR_OFFSETS]) {
        const shift = at(offset);
        for (const b2 of blocks) {
          if (offset.every((x) => x === 0) && b2.q === b.q) continue;
          if (b2.faces.some((f2) => norm(sub(add(f2.centre, shift), f.centre)) < 1e-9 && dot(f2.normal, f.normal) < -1 + 1e-9)) return { offset, q: b2.q };
        }
      }
      return null;
    });
  }
  blocksCache.set(s, blocks);
  return blocks;
}

/** The neighbour across the face of block q whose outward normal is closest to faceNormal. */
export function matchDictoBlockNeighbour(q, faceNormal, s = 1) {
  const b = dictoBlocks(s)[q];
  let best = 0;
  b.faces.forEach((f, i) => { if (dot(f.normal, [faceNormal.x, faceNormal.y, faceNormal.z]) > dot(b.faces[best].normal, [faceNormal.x, faceNormal.y, faceNormal.z])) best = i; });
  return b.neighbours[best];
}

// Blocks live in their own store keyed by (4x + q, y, z): cell (x, y, z) and block q in 0..3.
export const dictoBlockKey = (x, y, z, q) => [4 * x + q, y, z];
export const dictoBlockFromKey = (kx, y, z) => ({ x: Math.floor(kx / 4), y, z, q: ((kx % 4) + 4) % 4 });
