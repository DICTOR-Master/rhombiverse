// regions.js only imports lattice.js -- zero npm dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldStore } from '../../src/worldstate.js';
import { computeClaim, claimBoundingRadius, claimIdAt } from '../../src/regions.js';

test('computeClaim: first claim lands at world center (shell 0)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const { claimId, claimData } = computeClaim(world, 'p1');
  assert.equal(claimId, 'claim_0_0_0');
  assert.deepEqual(claimData.center, [0, 0, 0]);
  assert.equal(claimData.shellIndex, 0);
  assert.equal(claimData.destructible, false);
});

test('computeClaim: second claim avoids the first, one per owner (LOOPHOLES.md section 2)', () => {
  const world = createWorldStore({ worldName: 't', version: 1, cells: {} });
  const first = computeClaim(world, 'p1');
  world.addClaim(first.claimId, first.claimData);

  const second = computeClaim(world, 'p2');
  assert.notEqual(second.claimId, first.claimId);

  assert.throws(() => computeClaim(world, 'p1'), /already have a claim/);
});

test('claimBoundingRadius: positive, roughly matches a 2-shell footprint', () => {
  const claim = { center: [0, 0, 0], size: '2-shell' };
  const radius = claimBoundingRadius(claim);
  // Shell 2's own real-distance range is documented elsewhere in this
  // project as up to sqrt(8) ~= 2.83 for unit spacing -- sanity-check
  // the bound is in that ballpark, not exact-equal to avoid coupling
  // this test to lattice.js's internal geometry.
  assert.ok(radius > 2 && radius < 3, `radius was ${radius}`);
});

test('claimIdAt: resolves ownership geometrically, without the cell needing to exist', () => {
  const claims = {
    claim_0_0_0: { ownerId: 'p1', center: [0, 0, 0], size: '2-shell' },
  };
  // Center itself and a cell within the 2-shell footprint both resolve.
  assert.equal(claimIdAt(claims, 0, 0, 0), 'claim_0_0_0');
  assert.equal(claimIdAt(claims, 1, 1, 0), 'claim_0_0_0');
  // Far outside the footprint resolves to nothing.
  assert.equal(claimIdAt(claims, 50, 50, 0), null);
});
