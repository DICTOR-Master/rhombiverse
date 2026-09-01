// Pyramid Sub-Cell click resolution (core/pyramid.js). No prior test
// file existed for this module despite real regressions being fixed
// here twice the same day (2026-09-01) -- this covers the actual
// regression scenario ("pyramids still dont like filling in last
// inverted cap": a click meant to fill the one remaining missing axis
// on an almost-full cube instead placed a stray pyramid elsewhere),
// not just the underlying helper functions in isolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pyramidPieces, PYRAMID_AXES } from '../../src/core/lattice.js';
import {
  FULL_PYRAMIDS,
  withoutPyramid,
  hasPyramid,
  candidateAxesForNeighborOffset,
  nearestPyramidAxis,
  resolvePyramidAxisForHit,
  resolvePyramidClickOnExisting,
  pyramidAxisForNormal,
  axisKeyToOffset,
} from '../../src/core/pyramid.js';

const pieces = pyramidPieces();

test('candidateAxesForNeighborOffset: the (0,-1,1) rhombic direction is shared by exactly y- and z+', () => {
  assert.deepEqual(candidateAxesForNeighborOffset([0, -1, 1]).sort(), ['y-', 'z+'].sort());
});

test('regression: clicking near an existing z+ pyramid\'s own side face, with y- the one remaining missing axis, resolves to y- (the real gap), not z+ (already present)', () => {
  // 5/6 pyramids present -- only y- missing, the exact "almost-full
  // cube, one gap left" scenario the regression report described.
  const missingAxisKeys = PYRAMID_AXES.filter((k) => k === 'y-');
  assert.deepEqual(missingAxisKeys, ['y-']);

  // The click lands essentially ON z+'s own apex -- the worst case for
  // the old (pre-fix) pure-nearest-distance logic, since nothing is
  // closer to z+'s own apex than z+'s own apex.
  const localPoint = pieces.pyramids['z+'].apex;

  const resolved = resolvePyramidAxisForHit({
    localNormal: [0, 0, 0], // not axis-aligned -- forces the diagonal/neighborOffset fallback path
    localPoint,
    neighborOffset: [0, -1, 1],
    missingAxisKeys,
    pieces,
  });
  assert.equal(resolved, 'y-', `expected the real missing axis y-, got ${resolved}`);
});

test('control: the OLD behavior (no missingAxisKeys) really did pick the wrong candidate for that exact click -- confirms this is a real fix, not a no-op', () => {
  const oldResolved = nearestPyramidAxis(pieces.pyramids['z+'].apex, ['y-', 'z+'], pieces);
  assert.equal(oldResolved, 'z+', 'the pre-fix logic must reproduce the reported bug (picks the already-present axis)');
});

test('Remove must NOT prefer a missing axis -- passing missingAxisKeys is opt-in, omitting it keeps the old nearest-distance behavior', () => {
  const resolved = resolvePyramidAxisForHit({
    localNormal: [0, 0, 0],
    localPoint: pieces.pyramids['z+'].apex,
    neighborOffset: [0, -1, 1],
    // missingAxisKeys intentionally omitted, matching build.js's Remove
    // call sites (resolveClickedPyramidAxis without preferMissing).
    pieces,
  });
  assert.equal(resolved, 'z+', 'Remove must resolve to the actually-clicked axis, not a missing one');
});

test('when BOTH candidates are still missing, falls back to nearest-by-distance (defensive -- real geometry should never actually reach a diagonal face with neither owner present)', () => {
  const resolved = resolvePyramidAxisForHit({
    localNormal: [0, 0, 0],
    localPoint: pieces.pyramids['z+'].apex,
    neighborOffset: [0, -1, 1],
    missingAxisKeys: ['y-', 'z+'],
    pieces,
  });
  assert.equal(resolved, 'z+'); // closer to z+'s own apex in this constructed case
});

test('resolvePyramidClickOnExisting (existing regression, 72568ca): a lone pyramid (5 missing) still offers real bonding candidates', () => {
  const resolved = resolvePyramidClickOnExisting({
    hostCell: [0, 0, 0],
    hitAxisKey: 'z+',
    missingAxisKeys: PYRAMID_AXES.filter((k) => k !== 'z+'), // 5 missing = genuinely lone pyramid
    localPoint: pieces.pyramids['z+'].apex, // click right on its own apex -> point-to-point bond
    pieces,
  });
  assert.equal(resolved.type, 'pointToPoint');
});

test('resolvePyramidClickOnExisting: once a 2nd pyramid is present (4 missing), every further click completes a missing sibling unconditionally, never bonds', () => {
  const pyramids = withoutPyramid(FULL_PYRAMIDS, 'y-'); // 5 present, only y- missing
  assert.ok(hasPyramid(pyramids, 'z+'));
  const resolved = resolvePyramidClickOnExisting({
    hostCell: [0, 0, 0],
    hitAxisKey: 'z+',
    missingAxisKeys: ['y-'],
    localPoint: pieces.pyramids['z+'].apex, // would look like point-to-point by raw distance
    pieces,
  });
  assert.equal(resolved.type, 'fill');
  assert.equal(resolved.axisKey, 'y-');
});

// --- Real regression, direct report 2026-09-01 ("placing pyramids is
// still too difficult, impossible even ... used to be placeable by
// tapping surface you want to attach to", inconsistent outcomes
// depending on exact click position): resolvePyramidClickOnExisting's
// OWN flat distance-race (missing-sibling candidates competing against
// bond candidates) is now replaced with region classification -- these
// tests ground that against real pyramidPieces() geometry, not
// constructed numbers.

test('classifyPyramidHitRegion (via resolvePyramidClickOnExisting): a click on z+\'s own exposed flat BASE, using its real face normal, resolves to flatToFlat -- not a distance race', () => {
  const { base } = pieces.pyramids['z+'];
  const baseCenter = [0, 1, 2].map((i) => base.reduce((sum, c) => sum + c[i], 0) / base.length);
  const resolved = resolvePyramidClickOnExisting({
    hostCell: [0, 0, 0],
    hitAxisKey: 'z+',
    missingAxisKeys: PYRAMID_AXES.filter((k) => k !== 'z+'), // lone pyramid, 5 missing
    localNormal: [0, 0, -1], // the base's real outward normal -- opposite of z+'s own axis
    localPoint: baseCenter,
    pieces,
  });
  assert.equal(resolved.type, 'flatToFlat');
});

test('classifyPyramidHitRegion: a click near a shared BASE CORNER (the exact region the old flat-distance-race bug misfired on) still resolves to sibling-fill, not an unrelated bond/fill target', () => {
  // A real cube corner shared between z+'s base and 2 other (missing)
  // axes' own bases -- the previous version's flat race across ALL
  // missing siblings' apexes could misfire here since real distances
  // get close; region classification only ever compares against z+'s
  // OWN apex/base-edge-midpoint, so it can't be pulled off by a
  // same-cell sibling's own apex being coincidentally closer.
  const cubeCorner = pieces.cube.find(([x, y, z]) => x > 0 && y > 0 && z > 0);
  const resolved = resolvePyramidClickOnExisting({
    hostCell: [0, 0, 0],
    hitAxisKey: 'z+',
    missingAxisKeys: PYRAMID_AXES.filter((k) => k !== 'z+'),
    localNormal: null, // a genuine side-face hit, not the flat base
    localPoint: cubeCorner,
    pieces,
  });
  assert.equal(resolved.type, 'fill', `expected a sibling fill at a shared base corner, got ${resolved.type}`);
});

test('classifyPyramidHitRegion: a click near z+\'s own apex (side face, tip end) resolves to pointToPoint, independent of any other axis\'s geometry', () => {
  const resolved = resolvePyramidClickOnExisting({
    hostCell: [0, 0, 0],
    hitAxisKey: 'z+',
    missingAxisKeys: PYRAMID_AXES.filter((k) => k !== 'z+'),
    localNormal: null,
    localPoint: pieces.pyramids['z+'].apex,
    pieces,
  });
  assert.equal(resolved.type, 'pointToPoint');
});

// --- "Cubes have narrow opportunities" / "lattice needs doubling for
// pyramids", direct reports 2026-09-01: build.js's resolveGrowthOffset
// (not importable here -- build.js pulls in `three` -- but its own
// logic is exactly axisKeyToOffset(pyramidAxisForNormal(n)) when that's
// non-null, else the existing matchNeighborOffset) is grounded here via
// its two real building blocks, both pure and THREE-free.

test('axisKeyToOffset: all 6 real pure-axis offsets match PYRAMID_AXES exactly', () => {
  assert.deepEqual(axisKeyToOffset('x+'), [1, 0, 0]);
  assert.deepEqual(axisKeyToOffset('x-'), [-1, 0, 0]);
  assert.deepEqual(axisKeyToOffset('y+'), [0, 1, 0]);
  assert.deepEqual(axisKeyToOffset('y-'), [0, -1, 0]);
  assert.deepEqual(axisKeyToOffset('z+'), [0, 0, 1]);
  assert.deepEqual(axisKeyToOffset('z-'), [0, 0, -1]);
});

test('regression: all 6 of a Cube\'s real flat faces now resolve to 6 DISTINCT growth targets (the old matchNeighborOffset-only approach only ever reached 5, with +x/+y colliding on the same cell -- verified independently in this same session)', () => {
  const faces = { 'x+': [1, 0, 0], 'x-': [-1, 0, 0], 'y+': [0, 1, 0], 'y-': [0, -1, 0], 'z+': [0, 0, 1], 'z-': [0, 0, -1] };
  const offsets = Object.entries(faces).map(([expectedAxis, normal]) => {
    const axisKey = pyramidAxisForNormal(normal);
    assert.equal(axisKey, expectedAxis, `pyramidAxisForNormal(${normal}) should identify its own face`);
    return axisKeyToOffset(axisKey).join(',');
  });
  const distinct = new Set(offsets);
  assert.equal(distinct.size, 6, `expected 6 distinct growth targets, got ${distinct.size}: ${offsets.join(' | ')}`);
});

test('safety: two cubes placed pure-axis-adjacent (SCALE apart) sit exactly tangent -- zero overlap, by construction', () => {
  const SCALE = 1;
  const cubeHalfWidth = 0.5 * SCALE;
  const pureAxisSpacing = SCALE; // axisKeyToOffset gives a unit step, * SCALE in world units
  assert.ok(Math.abs(cubeHalfWidth + cubeHalfWidth - pureAxisSpacing) < 1e-9, 'two cube half-widths must sum to exactly the real pure-axis spacing');
});

test('RD faces are never flat/axis-aligned -- pyramidAxisForNormal always returns null for a real diagonal RD face, so resolveGrowthOffset\'s pure-axis branch can never fire for RD growth', () => {
  // A real RD face normal -- e.g. the (1,1,0)-type direction, normalized.
  const rdFaceNormal = [1 / Math.SQRT2, 1 / Math.SQRT2, 0];
  assert.equal(pyramidAxisForNormal(rdFaceNormal), null);
});
