// DICTO Hex Prism (queued 2026-10-01, after DICTO FCC): the lattice of the
// leaning regular-hexagonal prism DICTO built from four equal struts
// (Polyhedraverse's DICTO_LEANING_HEX_PRISM). Its hexagon sides run along
// u, v, w at 60 degrees in one plane; the lean d is at 90 degrees to u and
// 72 degrees to v and w. So it has two regular hexagons, two squares and
// four 72/108 degree rhombi (Penrose's thick rhombus), leans
// asin((phi - 1) / sqrt 3) ~ 20.9 degrees from upright, and has volume
// 3 phi / 2 at edge 1.
//
// It tiles space as the plain hexagonal prism does, with each layer
// slid along the lean: the in-plane translations are the hexagonal
// lattice's, the stacking one is d. So this reuses hex-prism.js's axial
// (q, r) coordinates and neighbour table unchanged, in the same frame
// (flat-top hexagon in x-y, stacking up z): world = hexagon centre + z d.
// verify-dicto-hex.mjs proves the fill.
import { HEX_NEIGHBOR_OFFSETS } from '../krp-core/src/geometry-extensions/hex-prism.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => scale(a, 1 / norm(a));

const LEAN_Y = (2 * Math.cos((72 * Math.PI) / 180)) / Math.sqrt(3); // d . (0, 1, 0): 72 degrees to v and w, 90 to u

/** The lean d at edge R: the stacking translation. */
export function dictoHexLean(R = 1) {
  return [0, LEAN_Y * R, Math.sqrt(1 - LEAN_Y * LEAN_Y) * R];
}

/** The 12 corners at edge R, centred: the bottom hexagon, then the top one (slid by d). */
export function dictoHexCellVerts(R = 1) {
  const d = dictoHexLean(R);
  const hex = Array.from({ length: 6 }, (_, k) => [R * Math.cos((Math.PI / 3) * k), R * Math.sin((Math.PI / 3) * k), 0]);
  return [...hex.map((p) => sub(p, scale(d, 0.5))), ...hex.map((p) => add(p, scale(d, 0.5)))];
}

/** The 8 faces as corner indices into dictoHexCellVerts, wound outward. */
export function dictoHexCellFaces() {
  const faces = [[5, 4, 3, 2, 1, 0], [6, 7, 8, 9, 10, 11]];
  for (let k = 0; k < 6; k++) { const j = (k + 1) % 6; faces.push([k, j, j + 6, k + 6]); }
  return faces;
}

/** Each face's unit outward normal and centre, at edge R. */
function faceFrames(R) {
  const V = dictoHexCellVerts(R);
  return dictoHexCellFaces().map((f) => {
    const P = f.map((i) => V[i]);
    const centre = scale(P.reduce(add, [0, 0, 0]), 1 / P.length);
    let n = unit(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    if (dot(n, centre) < 0) n = scale(n, -1);
    return { normal: n, centre };
  });
}

/** World position of cell (q, r, z): the hexagonal lattice in x-y, each layer slid by d. */
export function dictoHexCellToWorld(q, r, z, R = 1) {
  const d = dictoHexLean(R);
  return [1.5 * R * q + z * d[0], Math.sqrt(3) * R * (r + q / 2) + z * d[1], z * d[2]];
}

export const DICTO_HEX_NEIGHBOR_OFFSETS = HEX_NEIGHBOR_OFFSETS;

/**
 * The neighbour offset across the face a hit landed on: the face whose
 * outward normal is closest to the hit's; its neighbour sits at twice the
 * face centre (a parallelohedron meets each neighbour face to face).
 */
export function matchDictoHexNeighborOffset(faceNormal, R = 1) {
  const n = [faceNormal.x, faceNormal.y, faceNormal.z];
  let best = null;
  for (const f of faceFrames(R)) if (!best || dot(f.normal, n) > dot(best.normal, n)) best = f;
  const t = scale(best.centre, 2);
  return HEX_NEIGHBOR_OFFSETS.find((o) => norm(sub(dictoHexCellToWorld(o[0], o[1], o[2], R), t)) < 1e-9);
}
