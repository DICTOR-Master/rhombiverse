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
import { cellKey, cellsInShells } from './lattice.js';

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
export function allocateClaim(world, ownerId, sizeShells = CLAIM_SIZE_SHELLS) {
  const claims = world.getClaims();
  const claimed = claimedCellKeys(claims);
  const candidateCenters = [
    { x: 0, y: 0, z: 0, shell: 0 },
    ...cellsInShells(0, 0, 0, MAX_CLAIM_SEARCH_SHELL),
  ];

  for (const center of candidateCenters) {
    const footprint = footprintOf(center.x, center.y, center.z, sizeShells);
    const free = footprint.every(({ x, y, z }) => !claimed.has(cellKey(x, y, z)));
    if (!free) continue;

    const claimId = `claim_${Object.keys(claims).length + 1}`;
    const claimData = {
      ownerId,
      shellIndex: center.shell,
      center: [center.x, center.y, center.z],
      size: `${sizeShells}-shell`,
      destructible: false,
      grantedAt: new Date().toISOString(),
    };
    world.addClaim(claimId, claimData);
    return claimId;
  }

  throw new Error(
    `No free claim slot found within ${MAX_CLAIM_SEARCH_SHELL} shells of world center`
  );
}

// Which claim (if any) owns a given lattice coordinate -- computed
// geometrically against the claims registry rather than requiring a
// per-cell claimId to already be stamped, so ownership of not-yet-built
// space inside a claim is still well-defined (a claim reserves an area,
// it doesn't need every cell in it pre-materialized). NOT yet wired into
// build.js/blackhole.js/supernova.js -- see CLAUDE.md's regions status
// for what's still deliberately deferred.
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
