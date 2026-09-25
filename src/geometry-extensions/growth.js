// Ammann-rhombohedra tiling geometry -- deterministic, on-demand math only.
// Trimmed 2026-09-22 (second world-building removal pass) from the original
// growth.js, which also carried a real growth-over-time engine (species
// templates, tick-rate-limited growSeed/applyGrowth/plantSeed/pruneTile).
// That engine is archived in full at
// the old growth engine (deleted 2026-09-24 with the rest of the
// retired systems -- see docs/HISTORY-retired-systems.md).
//
// What's kept here is genuinely reusable, non-simulated geometry: the 12
// star directions, the valid acute/oblate rhombohedron triples they form,
// a single tile's vertices, and a real 3D SAT overlap test between two
// tiles. render.js's live Duality Mode feature (VALID_TRIPLES,
// unitTileVertices) depends on this directly.

export const PHI = (1 + Math.sqrt(5)) / 2;

const ACUTE_ANGLE_DEG = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI; // 63.434948822922...
const OBLATE_ANGLE_DEG = (Math.acos(-1 / Math.sqrt(5)) * 180) / Math.PI; // 116.565051177078...
const ANGLE_EPS = 0.05;

export const STAR_DIRECTIONS = buildStarDirections();

function buildStarDirections() {
  const perms = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ];
  const seen = new Map();
  for (const [, p1, p2] of perms) {
    for (const s1 of [1, -1]) {
      for (const s2 of [1, -1]) {
        const v = [0, 0, 0];
        v[p1] = s1;
        v[p2] = s2 * PHI;
        const len = Math.hypot(v[0], v[1], v[2]);
        const unit = [v[0] / len, v[1] / len, v[2] / len];
        const key = unit.map((x) => x.toFixed(6)).join(',');
        if (!seen.has(key)) seen.set(key, unit);
      }
    }
  }
  const dirs = [...seen.values()];
  if (dirs.length !== 12) {
    throw new Error(`buildStarDirections: expected 12 unique directions, got ${dirs.length}`);
  }
  return dirs;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function angleDeg(a, b) {
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
}

export const VALID_TRIPLES = buildValidTriples();

function buildValidTriples() {
  const triples = [];
  const n = STAR_DIRECTIONS.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const aij = angleDeg(STAR_DIRECTIONS[i], STAR_DIRECTIONS[j]);
      if (Math.abs(aij - 180) < ANGLE_EPS) continue; // antipodal, degenerate
      for (let k = j + 1; k < n; k++) {
        const aik = angleDeg(STAR_DIRECTIONS[i], STAR_DIRECTIONS[k]);
        const ajk = angleDeg(STAR_DIRECTIONS[j], STAR_DIRECTIONS[k]);
        if (Math.abs(aik - 180) < ANGLE_EPS || Math.abs(ajk - 180) < ANGLE_EPS) continue;
        const allAcute = [aij, aik, ajk].every((a) => Math.abs(a - ACUTE_ANGLE_DEG) < ANGLE_EPS);
        const allOblate = [aij, aik, ajk].every((a) => Math.abs(a - OBLATE_ANGLE_DEG) < ANGLE_EPS);
        if (allAcute) triples.push({ dirs: [i, j, k], type: 'acute' });
        else if (allOblate) triples.push({ dirs: [i, j, k], type: 'oblate' });
      }
    }
  }
  return triples;
}

function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function unitTileVertices(dirs) {
  return tileVertices({ dirs, origin: [0, 0, 0] });
}

function tileVertices(tile) {
  const [i, j, k] = tile.dirs;
  const [ei, ej, ek] = [STAR_DIRECTIONS[i], STAR_DIRECTIONS[j], STAR_DIRECTIONS[k]];
  const verts = [];
  for (const a of [0, 1]) {
    for (const b of [0, 1]) {
      for (const c of [0, 1]) {
        let v = tile.origin;
        if (a) v = vecAdd(v, ei);
        if (b) v = vecAdd(v, ej);
        if (c) v = vecAdd(v, ek);
        verts.push(v);
      }
    }
  }
  return verts;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalizeOrNull(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len < 1e-9 ? null : scale(v, 1 / len);
}

function tileEdges(verts) {
  const o = verts[0];
  return [vecAdd(verts[4], scale(o, -1)), vecAdd(verts[2], scale(o, -1)), vecAdd(verts[1], scale(o, -1))];
}

function centroidOf(verts) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const v of verts) {
    cx += v[0];
    cy += v[1];
    cz += v[2];
  }
  return [cx / verts.length, cy / verts.length, cz / verts.length];
}

function maxRadiusFrom(verts, center) {
  let r = 0;
  for (const v of verts) {
    const d = Math.hypot(v[0] - center[0], v[1] - center[1], v[2] - center[2]);
    if (d > r) r = d;
  }
  return r;
}

// Real 3D SAT overlap test between two tiles, with a cheap bounding-sphere
// pre-check (never changes the answer, only skips the expensive exact
// test). Not called
// by any live feature today (its one live caller, evolution.js, was
// archived in the same pass this file was trimmed) -- kept because it's
// genuine deterministic geometry, not simulation, and a lattice-overlap
// check is a natural thing a lattice-selection tool will want again.
export function tilesOverlap(vertsA, vertsB, eps = 1e-6) {
  const centerA = centroidOf(vertsA);
  const centerB = centroidOf(vertsB);
  const dist = Math.hypot(centerA[0] - centerB[0], centerA[1] - centerB[1], centerA[2] - centerB[2]);
  if (dist > maxRadiusFrom(vertsA, centerA) + maxRadiusFrom(vertsB, centerB) + eps) return false;

  const [e1, e2, e3] = tileEdges(vertsA);
  const [f1, f2, f3] = tileEdges(vertsB);
  const axes = [];
  for (const [a, b] of [
    [e1, e2],
    [e1, e3],
    [e2, e3],
    [f1, f2],
    [f1, f3],
    [f2, f3],
  ]) {
    const n = normalizeOrNull(cross(a, b));
    if (n) axes.push(n);
  }
  for (const ea of [e1, e2, e3]) {
    for (const eb of [f1, f2, f3]) {
      const n = normalizeOrNull(cross(ea, eb));
      if (n) axes.push(n);
    }
  }
  for (const axis of axes) {
    const pa = vertsA.map((v) => dot(v, axis));
    const pb = vertsB.map((v) => dot(v, axis));
    const minA = Math.min(...pa);
    const maxA = Math.max(...pa);
    const minB = Math.min(...pb);
    const maxB = Math.max(...pb);
    if (maxA <= minB + eps || maxB <= minA + eps) return false; // separated (or just touching) on this axis
  }
  return true; // no separating axis found among any candidate -- genuine overlap
}
