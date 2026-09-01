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
