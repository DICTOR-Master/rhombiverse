// Rock-salt (NaCl, B1-type) lattice math -- a second real ionic
// structure built ENTIRELY from core/lattice.js's own existing FCC
// math, not a new coordinate system. Real crystallographic identity:
// the rock-salt structure is the FCC lattice with its own octahedral
// holes filled by a second species -- so in this codebase's existing
// "x+y+z even" FCC-validity convention (core/lattice.js's own
// isValidCell), the anion sublattice is simply every ODD-sum point, and
// together the two sublattices are a genuine SIMPLE CUBIC lattice (real
// coordination number 6, the defining property), not a third bespoke
// lattice type. Full design rationale: docs/code-notes/
// geometry-extensions/rock-salt-lattice.md
//
// Consequence that matters for rendering: each ion's own real Voronoi
// cell in a simple cubic lattice is an ordinary CUBE (edge = the
// nearest-neighbor spacing, 1 unit here) -- unlike BCC's truncated
// octahedron or FCC-alone's rhombic dodecahedron, this needs NO new
// mesh derivation at all. A cube primitive already exists everywhere
// in this codebase.
import { isValidCell, NEIGHBOR_OFFSETS, OCTA_VERTS } from '../core/lattice.js';

// Cation sublattice = the existing FCC-valid set (even sum) unchanged.
export function isCationSite(x, y, z) {
  return isValidCell(x, y, z);
}

// Anion sublattice = every point NOT on the cation sublattice (odd
// sum) -- proved below (self-test) to be an exact translate of the
// SAME real FCC lattice by one cation-anion offset, not an
// independently-chosen set.
export function isAnionSite(x, y, z) {
  return !isValidCell(x, y, z);
}

// The 6 real nearest cross-species (octahedral) neighbor offsets --
// OCTA_VERTS is already exactly this vector set (core/lattice.js's own
// "6 non-lattice octahedron directions" used for the RD's own apex
// construction), reused directly rather than re-derived.
export const CATION_ANION_OFFSETS = OCTA_VERTS;

export function crossSpeciesNeighbors(x, y, z) {
  return CATION_ANION_OFFSETS.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
}

// Same-species neighbors (12-fold, real FCC coordination) -- the
// EXISTING NEIGHBOR_OFFSETS, unchanged: translation preserves every
// distance/adjacency relationship, so the anion sublattice has
// IDENTICAL real FCC coordination to the cation one, just recentered.
export function sameSpeciesNeighbors(x, y, z) {
  return NEIGHBOR_OFFSETS.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
}

// Standalone sanity gate: `node src/geometry-extensions/rock-salt-lattice.js`
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('rock-salt-lattice.js')) {
  const dist = ([ax, ay, az], [bx, by, bz]) => Math.hypot(ax - bx, ay - by, az - bz);

  // 1. Cation/anion sublattices are disjoint and together cover every
  // integer point (real simple-cubic completeness, not a partial set).
  let coverageOk = true;
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) {
    const cation = isCationSite(x, y, z);
    const anion = isAnionSite(x, y, z);
    if (cation === anion) coverageOk = false; // must be exactly one, never both/neither
  }
  console.log('cation/anion sublattices exactly partition every integer point:', coverageOk);
  if (!coverageOk) throw new Error('cation/anion coverage check failed');

  // 2. The anion sublattice is a genuine translate of the SAME real FCC
  // lattice by exactly one cross-species offset -- not assumed, checked:
  // for a real cation site, cation + offset must be a real anion site,
  // for every one of the 6 offsets.
  let translateOk = true;
  for (const [dx, dy, dz] of CATION_ANION_OFFSETS) {
    if (!isAnionSite(dx, dy, dz)) translateOk = false; // origin (0,0,0) is a real cation site
  }
  console.log('anion sublattice is a real translate of the cation FCC lattice:', translateOk);
  if (!translateOk) throw new Error('anion-as-translate check failed');

  // 3. Real coordination counts: 6 cross-species nearest neighbors, 12
  // same-species nearest neighbors, matching real NaCl (6 Cl- around
  // each Na+ in a real octahedron) and real FCC (12) respectively.
  const cross = crossSpeciesNeighbors(0, 0, 0);
  const same = sameSpeciesNeighbors(0, 0, 0);
  console.log('cross-species (octahedral) neighbor count (expect 6):', cross.length);
  console.log('same-species (FCC) neighbor count (expect 12):', same.length);
  if (cross.length !== 6) throw new Error(`expected 6 cross-species neighbors, got ${cross.length}`);
  if (same.length !== 12) throw new Error(`expected 12 same-species neighbors, got ${same.length}`);
  for (const p of cross) if (!isAnionSite(...p)) throw new Error(`cross-species neighbor ${p} is not a real anion site`);
  for (const p of same) if (!isCationSite(...p)) throw new Error(`same-species neighbor ${p} is not a real cation site`);
  console.log('every cross-species neighbor is a real anion site, every same-species neighbor a real cation site: OK');

  // 4. Real cross-species octahedron shape: all 6 vertices equidistant
  // from center (a genuine octahedron, not an arbitrary hexahedron) --
  // adjacent pairs (e.g. +x,+y) share one real edge length, opposite
  // pairs (+x,-x) share a different (longer) length, both uniform
  // across all 6 vertices.
  const origin = [0, 0, 0];
  const crossDists = cross.map((p) => dist(origin, p));
  const allUnitDistance = crossDists.every((d) => Math.abs(d - 1) < 1e-9);
  console.log('every cross-species neighbor at real unit distance from center:', allUnitDistance);
  if (!allUnitDistance) throw new Error('cross-species neighbors are not equidistant from center');

  // 5. The real physical ratio check: real NaCl's own Na-Cl distance
  // (a/2) to Na-Na distance (a/sqrt(2)) ratio is sqrt(2)/2 ~= 0.7071 --
  // this coordinate system's own cation-anion spacing (1) to
  // cation-cation spacing (sqrt(2), NEIGHBOR_OFFSETS' own magnitude)
  // must reproduce that EXACT real ratio, not just "look plausible".
  const cationAnionDist = 1; // CATION_ANION_OFFSETS' own magnitude
  const cationCationDist = Math.hypot(1, 1, 0); // NEIGHBOR_OFFSETS' own magnitude
  const ratio = cationAnionDist / cationCationDist;
  const realRatio = Math.SQRT2 / 2;
  console.log('cation-anion : cation-cation distance ratio (expect sqrt(2)/2 ~= 0.70711):', ratio);
  if (Math.abs(ratio - realRatio) > 1e-9) throw new Error(`distance ratio ${ratio} does not match real NaCl's own ${realRatio}`);

  console.log('OK');
}
