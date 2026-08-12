// Region Ownership & Claiming -- RHOMBIVERSE_SPEC_REGIONS.md. Deliberately
// distinct from Phase 5.8's per-cell moderation `region` field (core/
// reviewed/open) -- this file is about `claimId`/who OWNS a given area,
// not whether its content has been vetted. See that spec's own section 1
// naming note; never conflate the two.
//
// Fixed-size claims only (section 2's own explicit rejection of a
// fractionalizing/shrinking model), allocated outward from world center
// (0,0,0) in true 3D shell order via the same NEIGHBOR_OFFSETS/
// shellCount(n)=10n^2+2 structure used everywhere else in this project --
// not re-derived, reused directly from lattice.js.
import { cellKey, cellsInShells, cellToWorld } from './lattice.js';

// "A claim is a 2-shell cluster" -- the spec's own example size, adopted
// as-is (implementation-tunable per the spec, not fixed by it; picking
// the spec's own example rather than inventing a different number).
// 1 (center) + 12 (shell 1) + 42 (shell 2) = 55 cells per claim.
export const CLAIM_SIZE_SHELLS = 2;

// How far out (in shells from world center) to search for a free claim
// slot before giving up. shellCount(n)=10n^2+2 means cellsInShells's own
// candidate list grows QUADRATICALLY -- an earlier version of this
// constant (300) computed roughly 90 MILLION candidate records before
// checking a single one, hanging a real browser click; caught by an
// actual Playwright run, not by reasoning about the number in isolation.
// 40 shells is still generous (cumulative candidates ~219k, computed in
// well under a second) while comfortably fitting dozens of non-
// overlapping 2-shell claims -- each occupies real Euclidean radius up to
// ~2.8 units, so claims pack far denser than "one shell ring per claim"
// might suggest. First-guess/tunable like every other constant here, but
// now grounded against an actual measured cost, not just "sounds big
// enough."
const MAX_CLAIM_SEARCH_SHELL = 40;

function footprintOf(cx, cy, cz, sizeShells) {
  return [{ x: cx, y: cy, z: cz }, ...cellsInShells(cx, cy, cz, sizeShells)];
}

function parseClaimSizeShells(size) {
  const n = parseInt(size, 10);
  return Number.isFinite(n) ? n : CLAIM_SIZE_SHELLS;
}

// Every cell key already covered by an existing claim, derived from the
// claims registry itself (not from per-cell claimId stamps, which are
// only ever present on cells that happen to have actually been built --
// see claimIdAt below for why membership is computed geometrically
// rather than requiring every claimed cell to physically exist first).
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

// Finds the first free claim-sized footprint, searching candidate CENTERS
// outward from world center in true 3D shell order (section 2: "filled
// each shell before moving to the next... first-come claims are placed
// in Shell 1 space, then Shell 2, and so on"). world center itself
// (shell 0) is tried first, since cellsInShells only ever returns shells
// 1+. Isolation (section 6): only ever reads existing claims to check for
// overlap, never resizes/moves/touches one -- granting a claim is a
// strictly additive operation.
function findFreeSlot(world, sizeShells) {
  const claimed = claimedCellKeys(world.getClaims());
  const candidateCenters = [
    { x: 0, y: 0, z: 0, shell: 0 },
    ...cellsInShells(0, 0, 0, MAX_CLAIM_SEARCH_SHELL),
  ];
  for (const center of candidateCenters) {
    const footprint = footprintOf(center.x, center.y, center.z, sizeShells);
    if (footprint.every(({ x, y, z }) => !claimed.has(cellKey(x, y, z)))) return center;
  }
  return null;
}

// Pure compute step, no mutation -- lets a caller that needs to persist
// the claim SOMEWHERE ELSE FIRST (sync.js's pushClaim, which must
// succeed against the shared table before the claim is treated as real
// -- see render.js's Claim Land handler) do so before ever touching the
// local store, rather than optimistically applying a claim locally that
// might then fail to sync (e.g. a genuine concurrent-grant race on the
// same free slot, caught server-side by the claims table's own primary
// key -- see supabase/schema.sql).
export function computeClaim(world, ownerId, sizeShells = CLAIM_SIZE_SHELLS) {
  // RHOMBIVERSE_SPEC_LOOPHOLES.md section 2: "one claim per verified
  // account." This is a fast, friendly pre-check against the LOCAL
  // (possibly slightly stale) claims view -- the real guarantee is
  // public.claims's own UNIQUE(owner_id) constraint (supabase/schema.sql),
  // which a claim attempt still has to clear regardless of what this
  // check sees.
  const alreadyOwns = Object.values(world.getClaims()).some((c) => c.ownerId === ownerId);
  if (alreadyOwns) {
    throw new Error('You already have a claim — one claim per player.');
  }
  const center = findFreeSlot(world, sizeShells);
  if (!center) {
    throw new Error(`No free claim slot found within ${MAX_CLAIM_SEARCH_SHELL} shells of world center`);
  }
  // The claim's own center coordinate makes a naturally unique,
  // deterministic id -- no counter/race needed, since a candidate is
  // only ever chosen once confirmed free of every existing claim.
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

// Convenience wrapper for local-only (non-shared, e.g. single-player or
// tests) use: computes AND immediately applies to the local store in one
// call, since there's no separate shared backend to race against.
export function allocateClaim(world, ownerId, sizeShells = CLAIM_SIZE_SHELLS) {
  const { claimId, claimData } = computeClaim(world, ownerId, sizeShells);
  world.addClaim(claimId, claimData);
  return claimId;
}

// Real Euclidean distance (world units) from a claim's own center out to
// the farthest cell in its footprint -- the exact bounding radius, not an
// estimated formula, reusing the same footprint geometry findFreeSlot
// already computes elsewhere in this file. render.js uses this to draw a
// wireframe sphere per claim so territory is visible even where nothing
// has been built yet (a claim reserves space; it doesn't require every
// cell in it to physically exist -- see claimIdAt below).
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

// Which claim (if any) owns a given lattice coordinate -- computed
// geometrically against the claims registry rather than requiring a
// per-cell claimId to already be stamped, so ownership of not-yet-built
// space inside a claim is still well-defined (a claim reserves an area,
// it doesn't need every cell in it pre-materialized). Wired into
// worldstate.js's addCell (auto-stamps claimId) and blackhole.js/
// supernova.js's isClaimProtected below.
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

// Section 4: "destructible flag ... now has a concrete referent: it's a
// flag on a claimId's owned cells" -- consumption/blast mechanics
// (blackhole.js, supernova.js) check this ADDITIVELY alongside their own
// pre-existing per-cell `destructible` field (the single-player-era
// stand-in, still honored for cells hand-set that way before claims
// existed) -- either one being false protects the cell, neither replaces
// the other.
export function isClaimProtected(claims, x, y, z) {
  const id = claimIdAt(claims, x, y, z);
  return id ? claims[id].destructible === false : false;
}
