// Region Ownership & Claiming -- RHOMBIVERSE_SPEC_REGIONS.md. Distinct
// from Phase 5.8's per-cell moderation `region` field (core/reviewed/
// open) -- this file is about claimId/who OWNS an area, not vetting.
// Full design rationale/history: docs/code-notes/game-systems/regions.md
import { cellKey, cellsInShells, cellToWorld } from '../core/lattice.js';

export const CLAIM_SIZE_SHELLS = 8;

const MAX_CLAIM_SEARCH_SHELL = 40;

function footprintOf(cx, cy, cz, sizeShells) {
  return [{ x: cx, y: cy, z: cz }, ...cellsInShells(cx, cy, cz, sizeShells)];
}

function parseClaimSizeShells(size) {
  const n = parseInt(size, 10);
  return Number.isFinite(n) ? n : CLAIM_SIZE_SHELLS;
}

function claimedCellKeys(claims) {
  const set = new Set();
  for (const claim of Object.values(claims)) {
    const [cx, cy, cz] = claim.center;
    for (const { x, y, z } of footprintOf(cx, cy, cz, parseClaimSizeShells(claim.size))) {
      set.add(cellKey(x, y, z));
    }
  }
  return set;
}

function reservedAsteroidCellKeys(world) {
  const set = new Set();
  for (const c of world.entries()) {
    if (c.asteroidNodeId) set.add(cellKey(c.x, c.y, c.z));
  }
  return set;
}

function findFreeSlot(world, sizeShells, origin = { x: 0, y: 0, z: 0 }) {
  const claimed = claimedCellKeys(world.getClaims());
  const reserved = reservedAsteroidCellKeys(world);
  const candidateCenters = [
    { x: origin.x, y: origin.y, z: origin.z, shell: 0 },
    ...cellsInShells(origin.x, origin.y, origin.z, MAX_CLAIM_SEARCH_SHELL),
  ];
  for (const center of candidateCenters) {
    const footprint = footprintOf(center.x, center.y, center.z, sizeShells);
    const free = footprint.every(({ x, y, z }) => {
      const key = cellKey(x, y, z);
      return !claimed.has(key) && !reserved.has(key);
    });
    if (free) return center;
  }
  return null;
}

export function computeClaim(world, ownerId, sizeShells = CLAIM_SIZE_SHELLS, origin = { x: 0, y: 0, z: 0 }) {
  const alreadyOwns = Object.values(world.getClaims()).some((c) => c.ownerId === ownerId);
  if (alreadyOwns) {
    throw new Error('You already have a claim — one claim per player.');
  }
  const center = findFreeSlot(world, sizeShells, origin);
  if (!center) {
    throw new Error(`No free claim slot found within ${MAX_CLAIM_SEARCH_SHELL} shells of [${origin.x}, ${origin.y}, ${origin.z}]`);
  }
  const claimId = `claim_${center.x}_${center.y}_${center.z}`;
  const claimData = {
    ownerId,
    shellIndex: center.shell,
    center: [center.x, center.y, center.z],
    size: `${sizeShells}-shell`,
    destructible: false,
    grantedAt: new Date().toISOString(),
  };
  return { claimId, claimData };
}

export function allocateClaim(world, ownerId, sizeShells = CLAIM_SIZE_SHELLS, origin = { x: 0, y: 0, z: 0 }) {
  const { claimId, claimData } = computeClaim(world, ownerId, sizeShells, origin);
  world.addClaim(claimId, claimData);
  return claimId;
}

export function claimBoundingRadius(claim) {
  const [cx, cy, cz] = claim.center;
  const [ccx, ccy, ccz] = cellToWorld(cx, cy, cz);
  let maxDist = 0;
  for (const c of footprintOf(cx, cy, cz, parseClaimSizeShells(claim.size))) {
    const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
    const d = Math.hypot(wx - ccx, wy - ccy, wz - ccz);
    if (d > maxDist) maxDist = d;
  }
  return maxDist;
}

export function claimFootprintWorldVertices(claim, scale = 1) {
  const [cx, cy, cz] = claim.center;
  return footprintOf(cx, cy, cz, parseClaimSizeShells(claim.size)).map((c) => cellToWorld(c.x, c.y, c.z, scale));
}

export function claimIdAt(claims, x, y, z) {
  const key = cellKey(x, y, z);
  for (const [id, claim] of Object.entries(claims)) {
    const [cx, cy, cz] = claim.center;
    const inFootprint = footprintOf(cx, cy, cz, parseClaimSizeShells(claim.size)).some(
      (c) => cellKey(c.x, c.y, c.z) === key
    );
    if (inFootprint) return id;
  }
  return null;
}

export function isClaimProtected(claims, x, y, z) {
  const id = claimIdAt(claims, x, y, z);
  return id ? claims[id].destructible === false : false;
}
