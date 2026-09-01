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
//
// Real regression, direct report 2026-09-01 ("pyramids still dont like
// filling in last inverted cap" -- a fill click near the one remaining
// downward gap kept placing a stray pyramid elsewhere instead): a click
// that lands on a DIAGONAL rhombic side face -- an EXISTING pyramid's
// own slant, not the still-open flat cube face itself -- falls through
// to the `direct` check returning null (a slanted face is never
// axis-aligned), landing in the neighborOffset fallback below. That
// fallback maps the clicked face to exactly 2 candidate axes that could
// jointly own a rhombic face at that orientation, then used to pick
// whichever's own apex was closer to the click point -- but the
// clicked pyramid's OWN apex is always closer than a missing sibling's,
// since the click physically landed on that pyramid's own geometry.
// The exact same flaw 72568ca already fixed for the separate tagged-
// mesh click path (resolvePyramidClickOnExisting), just never applied
// here. Real fix: of the 2 candidates, a diagonal rhombic face can only
// ever be clickable where at least one of its 2 owning pyramids is
// actually present (if neither were, there'd be no slanted geometry
// there to click) -- so if exactly one candidate is still genuinely
// missing on this cell, that's deterministically the intended target,
// no distance comparison needed at all.
export function resolvePyramidAxisForHit({ localNormal, localPoint, neighborOffset, missingAxisKeys, pieces }) {
  const direct = pyramidAxisForNormal(localNormal);
  if (direct) return direct;
  if (!neighborOffset) return null;
  const candidates = candidateAxesForNeighborOffset(neighborOffset);
  if (missingAxisKeys) {
    const stillMissing = candidates.filter((k) => missingAxisKeys.includes(k));
    if (stillMissing.length === 1) return stillMissing[0];
  }
  return nearestPyramidAxis(localPoint, candidates, pieces);
}

// --- Free-standing pyramid-to-pyramid bonding ("attach flat to flat or
// point to point", direct instruction 2026-09-01) -----------------------
// A lone (cube-less) pyramid's own base and apex are both real, clickable
// geometry (buildPyramidOnlyMeshes in render.js builds the FULL convex
// hull of base+apex, not just the 4 outward-facing side triangles) -- so
// a second pyramid can bond to an EXISTING one either at its flat base
// (mirrored, forming a real -- though not Platonic-regular, since the
// base is a cube-face square and the sides are isosceles not
// equilateral -- octahedron) or apex-to-apex (tips touching, bases
// flaring away from each other, chaining the structure further out).
// Both are derived directly from pyramidPieces()'s own base/apex
// formulas: for a pyramid at host cell C with axis index i, sign σ
// (PYRAMID_AXES pairs are consecutive +/-, so i XOR 1 on the PYRAMID_AXES
// index gives the opposite key), base_world[i] = C[i]*s + σ*0.5s and
// apex_world[i] = C[i]*s + σ*s. Solving "new pyramid's own base/apex
// formula equals the existing one's" for the new host's own integer
// coordinate gives the two rules below -- flat-to-flat: newHost = C + σ
// (one step out), opposite axis; point-to-point: newHost = C + 2σ (two
// steps out, past the existing apex), opposite axis.
export function oppositeAxisKey(axisKey) {
  const i = PYRAMID_AXES.indexOf(axisKey);
  const j = i % 2 === 0 ? i + 1 : i - 1;
  return PYRAMID_AXES[j];
}

function axisIndexAndSign(axisKey) {
  const i = PYRAMID_AXES.indexOf(axisKey);
  return { axisIndex: i < 2 ? 0 : i < 4 ? 1 : 2, sign: i % 2 === 0 ? 1 : -1 };
}

// The pure integer offset (e.g. [1,0,0] for 'x+') a given axis key
// points along -- used by growPureAxisOffset (build.js) to grow a new
// Cube/Pyramid cell straight out from a genuinely flat, exposed cube
// face, instead of lossily snapping to one of the 12 diagonal
// NEIGHBOR_OFFSETS directions (see that function's own header for why
// snapping was a real, confirmed bug -- only 5 of 12 real directions
// reachable from a cube's 6 flat faces, 2 duplicated).
export function axisKeyToOffset(axisKey) {
  const { axisIndex, sign } = axisIndexAndSign(axisKey);
  const offset = [0, 0, 0];
  offset[axisIndex] = sign;
  return offset;
}

export function flatToFlatMirror(hostCell, axisKey) {
  const { axisIndex, sign } = axisIndexAndSign(axisKey);
  const host = hostCell.slice();
  host[axisIndex] += sign;
  return { host, axisKey: oppositeAxisKey(axisKey) };
}

export function pointToPointMirror(hostCell, axisKey) {
  const { axisIndex, sign } = axisIndexAndSign(axisKey);
  const host = hostCell.slice();
  host[axisIndex] += 2 * sign;
  return { host, axisKey: oppositeAxisKey(axisKey) };
}

// Classify a hit on an already-present pyramid's OWN geometry into one
// of 3 real regions -- 'base' (the flat exposed back, opposite the
// pyramid's own outward axis -- flat-to-flat bond), 'apex' (nearer this
// pyramid's own tip than its own base-edge midpoint, on one of its 4
// triangular side faces -- point-to-point bond), or 'sibling' (the rest
// of a side face, nearer the base -- grow a missing NEIGHBOR axis on
// this SAME cell). Deliberately compares ONLY against this ONE
// pyramid's own landmarks (its own apex vs. its own nearest base-edge
// midpoint), never against any OTHER axis's geometry -- see
// resolvePyramidClickOnExisting's own header for why that distinction
// matters.
function classifyPyramidHitRegion({ axisKey, localNormal, localPoint, pieces }) {
  if (localNormal && pyramidAxisForNormal(localNormal) === oppositeAxisKey(axisKey)) return 'base';
  const { apex, base } = pieces.pyramids[axisKey];
  const distToApex = dist3(localPoint, apex);
  const nearest2 = base.map((c) => ({ c, d: dist3(localPoint, c) })).sort((a, b) => a.d - b.d).slice(0, 2);
  const nearEdgeMid = [0, 1, 2].map((k) => (nearest2[0].c[k] + nearest2[1].c[k]) / 2);
  return distToApex < dist3(localPoint, nearEdgeMid) ? 'apex' : 'sibling';
}

// Resolve a click on an ALREADY-PRESENT pyramid's own geometry into
// exactly one real outcome.
//
// Real regression, direct report 2026-09-01 ("placing pyramids is
// still too difficult, impossible even ... used to be placeable by
// tapping surface you want to attach to"): an earlier version of this
// function (itself already a fix for a DIFFERENT regression, the "last
// inverted cap" bug -- see git history) threw every candidate -- up to
// 5 missing-sibling fill targets PLUS both bond candidates -- into one
// flat distance-to-click race. That mostly resolved correctly (a
// sibling axis's apex sits on a completely different cube face, usually
// far from a click on THIS pyramid's own surface), but near shared cube
// corners/base edges the distances can land close enough for ordinary
// click-precision noise to flip the outcome -- exactly the described
// symptom (sometimes fills a sibling, sometimes bonds, sometimes
// nothing), not a single deterministic failure.
//
// Real fix: classify which REGION of the clicked pyramid's own geometry
// was hit first (classifyPyramidHitRegion, above -- comparing only
// within that one pyramid's own landmarks, never against unrelated
// siblings elsewhere on the cube), THEN resolve within that region.
// 'sibling' still needs nearestPyramidAxis to pick WHICH missing axis,
// but now compared only among the real missing candidates, with no
// bond-candidate competition muddying that comparison.
//
// The real distinguishing signal for whether bonding is even offered at
// all is unchanged from the previous fix: how many pyramids this cell
// already has. Exactly ONE present (missingAxisKeys.length ==
// PYRAMID_AXES.length - 1, a genuinely lone, undecided pyramid) is the
// doc's own "1 stands alone, 2 bond to form an octahedron" branch
// point, so flat-to-flat/point-to-point bonding is offered. Once a
// SECOND pyramid has ever been added to the same cell, the player has
// already committed to "6 pyramids = cube" on THIS cell -- every
// further click completes a missing sibling unconditionally, with no
// bonding offered at all, regardless of which region was hit.
export function resolvePyramidClickOnExisting({ hostCell, hitAxisKey, missingAxisKeys, localNormal, localPoint, pieces }) {
  if (missingAxisKeys.length < PYRAMID_AXES.length - 1) {
    return { type: 'fill', axisKey: nearestPyramidAxis(localPoint, missingAxisKeys, pieces) };
  }
  const region = classifyPyramidHitRegion({ axisKey: hitAxisKey, localNormal, localPoint, pieces });
  if (region === 'base') return { type: 'flatToFlat', ...flatToFlatMirror(hostCell, hitAxisKey) };
  if (region === 'apex') return { type: 'pointToPoint', ...pointToPointMirror(hostCell, hitAxisKey) };
  return { type: 'fill', axisKey: nearestPyramidAxis(localPoint, missingAxisKeys, pieces) };
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
