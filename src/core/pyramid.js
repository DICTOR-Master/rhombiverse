// Pyramid Sub-Cell Add/Remove (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md) -- pure
// logic only: no DOM, no THREE scene access, same convention as
// sculpture.js. A placed RD cell's real 7-piece structure (cube + 6
// pyramids, see lattice.js's pyramidPieces()) is tracked per-cell as a
// 6-bit `pyramids` bitmask; an ABSENT `pyramids` field means "full RD, all
// 6 present" (the pre-existing, still-overwhelmingly-common case) so
// untouched cells and saved worlds need no migration and no schema bloat.
// Full design rationale/history: docs/code-notes/core/pyramid.md
import { PYRAMID_AXES } from './lattice.js';

export const FULL_PYRAMIDS = (1 << PYRAMID_AXES.length) - 1; // 0b111111 = 63

function bitFor(axisKey) {
  const i = PYRAMID_AXES.indexOf(axisKey);
  if (i < 0) throw new Error(`Unknown pyramid axis key: ${axisKey}`);
  return 1 << i;
}

// Absent `cell.pyramids` reads as FULL_PYRAMIDS -- see header.
export function effectivePyramids(cell) {
  return cell?.pyramids ?? FULL_PYRAMIDS;
}

// "Pyramid without a cube" (direct instruction 2026-08-29): a cell can
// exist with its cube base entirely absent, just one or more of its 6
// pyramids floating on their own. Same "absent means the common case"
// convention as `pyramids` itself -- absent `cell.cube` (or any value
// other than exactly `false`) means "has a cube", so every pre-existing
// cell and saved world needs no migration.
export function hasCube(cell) {
  return cell?.cube !== false;
}

export function hasPyramid(pyramids, axisKey) {
  return (pyramids & bitFor(axisKey)) !== 0;
}

export function presentAxisKeys(pyramids) {
  return PYRAMID_AXES.filter((k) => hasPyramid(pyramids, k));
}

export function withPyramid(pyramids, axisKey) {
  return pyramids | bitFor(axisKey);
}

export function withoutPyramid(pyramids, axisKey) {
  return pyramids & ~bitFor(axisKey);
}

// --- Identifying which of the 6 pyramids a raycast hit -----------------
// See docs/code-notes/core/pyramid.md for the full derivation: a rhombic
// face's own two candidate pyramids share it (real ConvexGeometry
// triangulation puts 2 apex vertices + 1 cube vertex per hit triangle, not
// 1 apex per pyramid-owned triangle, so the hit triangle's own vertices
// don't by themselves disambiguate); a rhombus's diagonals always
// perpendicularly bisect each other, so "which of the 2 candidate apexes
// is the hit point nearer to" is an exact, not approximate, test for which
// pyramid's real triangular side-face (cube-edge + single apex, the ground
// truth geometry from section 2) actually contains that point. A hit whose
// normal is already (near-)pure axis-aligned is unambiguous on its own --
// it's a flat cube face, only ever exposed where exactly one pyramid is
// currently missing.
function axisKeyFromAxisSign(axisIndex, sign) {
  return PYRAMID_AXES[axisIndex * 2 + (sign > 0 ? 0 : 1)];
}

const FLAT_FACE_THRESHOLD = 0.9; // diagonal rhombic-face normals peak at 1/sqrt(2) =~ 0.707; pure axis normals are 1 -- wide margin either side

export function pyramidAxisForNormal(normal, threshold = FLAT_FACE_THRESHOLD) {
  const abs = normal.map(Math.abs);
  const max = Math.max(...abs);
  if (max < threshold) return null; // a diagonal rhombic-face normal, not a flat cube face
  const axisIndex = abs.indexOf(max);
  return axisKeyFromAxisSign(axisIndex, normal[axisIndex]);
}

// offset: one of lattice.js's NEIGHBOR_OFFSETS entries -- exactly 2 nonzero
// (each +-1) components, one per candidate pyramid sharing that rhombic face.
export function candidateAxesForNeighborOffset(offset) {
  const axes = [];
  offset.forEach((v, axisIndex) => {
    if (v !== 0) axes.push(axisKeyFromAxisSign(axisIndex, v));
  });
  return axes;
}

function dist3([ax, ay, az], [bx, by, bz]) {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

export function nearestPyramidAxis(localPoint, candidateAxisKeys, pieces) {
  let best = null;
  let bestDist = Infinity;
  for (const key of candidateAxisKeys) {
    const d = dist3(localPoint, pieces.pyramids[key].apex);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return best;
}

// The single entry point render.js's pyramid-mode click handler calls.
// localNormal/localPoint are the hit's face normal / world point, both
// already converted to the cell's own local (untranslated) frame by the
// caller -- this module has no THREE dependency, so it only ever sees
// plain [x,y,z] arrays.
export function resolvePyramidAxisForHit({ localNormal, localPoint, neighborOffset, pieces }) {
  const direct = pyramidAxisForNormal(localNormal);
  if (direct) return direct;
  if (!neighborOffset) return null;
  const candidates = candidateAxesForNeighborOffset(neighborOffset);
  return nearestPyramidAxis(localPoint, candidates, pieces);
}

// "Pyramid without a cube" bootstrap (direct instruction 2026-08-29):
// clicking a face where a pyramid is already present has nothing to add
// on the CLICKED cell -- but if the real FCC neighbor beyond that face
// is empty, a single cube-less pyramid can grow there instead, reaching
// back toward the cell you clicked. Which of the new cell's own 6
// pyramid axes that is stays genuinely ambiguous from the neighbor
// offset alone (a diagonal offset like (1,1,0) sits exactly between two
// candidate axes, e.g. x+ and y+, on the CLICKED cell's own side -- same
// "which of the two shares this face" ambiguity nearestPyramidAxis
// already resolves for a full cell's own click). Reuses that same
// distance-to-apex disambiguation, just re-centered on the NEW cell's
// own local frame (localPointFromNewCell = the hit point's offset from
// where the new cell's center WOULD be, not the clicked cell's), and
// against the REVERSED offset's own candidate axes (the new cell sees
// the clicked cell in the opposite direction).
export function resolveBootstrapPyramidAxis({ localPointFromNewCell, neighborOffsetFromClickedToNew, pieces }) {
  const reverseOffset = neighborOffsetFromClickedToNew.map((v) => -v);
  const candidates = candidateAxesForNeighborOffset(reverseOffset);
  return nearestPyramidAxis(localPointFromNewCell, candidates, pieces);
}

// --- World mutation ------------------------------------------------------
// Same idiom 'report'/'replace' build modes already use (core/build.js) --
// world.addCell() is a plain upsert (cells.set(), no existence check), so
// "patch one field on an already-placed cell" is just addCell with the
// rest of that cell's own data spread back in. No worldstate-core.js
// change needed. Deletes the `pyramids` field entirely when the result is
// back to full, rather than writing FULL_PYRAMIDS explicitly -- see header.
export function applyPyramidEdit(world, action, x, y, z, axisKey) {
  if (!world.has(x, y, z)) return null;
  const cell = world.entries().find((c) => c.x === x && c.y === y && c.z === z);
  if (!cell) return null;
  const current = effectivePyramids(cell);
  const present = hasPyramid(current, axisKey);
  if (action === 'remove' && !present) return null; // nothing there to remove
  if (action === 'add' && present) return null; // already there, nothing to add
  const next = action === 'remove' ? withoutPyramid(current, axisKey) : withPyramid(current, axisKey);
  // A cube-less cell (see hasCube() above) with its last pyramid just
  // removed has nothing left to render at all -- delete the cell
  // outright rather than leaving an empty, invisible ghost occupying
  // that lattice coordinate. Cells WITH a cube never hit this: the cube
  // itself is always visible on its own even at pyramids===0 (a bare
  // block), so FULL_PYRAMIDS stays the only special case for them.
  if (next === 0 && !hasCube(cell)) {
    world.removeCell(x, y, z);
    return { x, y, z, pyramids: 0, axisKey, action, cellRemoved: true };
  }
  const { x: _x, y: _y, z: _z, pyramids: _old, ...rest } = cell;
  let patch;
  if (next === FULL_PYRAMIDS) {
    // Direct instruction 2026-08-29 ("make it so pyramids can form
    // cube"): a cube-less cell that just gained its 6th and final
    // pyramid completes into an ordinary, whole cell -- the cube is
    // added automatically along with it, rather than leaving a hollow
    // 6-pyramid shell with a cube-shaped gap in the middle. `cube` is
    // dropped here the same way `pyramids` already is (absent means
    // "has a cube" -- see hasCube()'s own header); a cell that already
    // had a cube never had `cube` in `rest` to begin with, so this is a
    // no-op for the existing, unchanged case.
    const { cube: _cube, ...full } = rest;
    patch = full;
  } else {
    patch = { ...rest, pyramids: next };
  }
  world.addCell(x, y, z, patch);
  return { x, y, z, pyramids: next, axisKey, action };
}

// Bootstrap a brand-new cube-less cell with exactly one pyramid present
// -- the "pyramid without a cube" placement itself. Only ever called at
// a coordinate confirmed empty by the caller (core/build.js) -- world.
// addCell() is a plain upsert either way, but a real check keeps this
// function's own contract honest.
export function bootstrapPyramidCell(world, x, y, z, axisKey, material) {
  if (world.has(x, y, z)) return null;
  const pyramids = withPyramid(0, axisKey);
  world.addCell(x, y, z, { cube: false, pyramids, material });
  return { x, y, z, cube: false, pyramids, axisKey };
}

// Adds the cube back to an existing cube-less cell -- direct
// instruction 2026-08-29 ("but can be added is important"): a
// cube-less cell is never a dead end. Whatever pyramids are already
// present stay exactly as they are; only the `cube` field changes.
export function addCubeToCell(world, x, y, z) {
  if (!world.has(x, y, z)) return null;
  const cell = world.entries().find((c) => c.x === x && c.y === y && c.z === z);
  if (!cell || hasCube(cell)) return null; // no cell there, or already has a cube -- nothing to do
  // world.entries() (the only source cell came from) adds x/y/z onto
  // each returned record -- strip them back out, same as
  // applyPyramidEdit's own pattern, so they don't get redundantly
  // baked into the stored cell data alongside its real map key.
  const { x: _x, y: _y, z: _z, cube: _cube, ...rest } = cell;
  world.addCell(x, y, z, rest); // absent `cube` reads as "has a cube" -- see hasCube()
  return { x, y, z };
}
