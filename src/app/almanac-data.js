// Almanac Stage 0 -- content data module. See docs/RHOMBIVERSE_SPEC_
// ALMANAC.md section 5 for the full staged plan this implements the
// first step of. No UI here -- that's Stage 1.
//
// Piece entries are DERIVED from WHEEL_PIECE/WHEEL_RD_FAMILY's own
// label/desc/action fields, never re-typed -- those are already the
// real, live descriptions a player sees when picking a piece to place,
// and Almanac should never be able to drift out of sync with them
// (Grounded Simplicity, RHOMBIVERSE_PRINCIPLES.md section 0: reuse an
// established source rather than inventing a parallel one). See
// tests/unit/almanac-data.test.mjs for the coverage check this promises
// -- every real piece action appears in Almanac exactly once, no silent
// gaps.
import { WHEEL_PIECE, WHEEL_RD_FAMILY, ACTION_TO_MARK } from './rhombic-wheel-3d-core.js';
import { computeConvexStats } from '../core/polyhedron-stats.js';
import { CUBE_VERTS, rdRawVerts, pyramidPieces, cuboctahedronVertices, octGapVertices, hemisphereSplit } from '../core/lattice.js';
import { truncatedOctahedronVertices } from '../geometry-extensions/dual-lattice.js';
import { bootstrapDisphenoid, octahedronVerts } from '../geometry-extensions/interstitial-lattice.js';
import { CORNER_GROUPS, BAND_GROUPS, TRIANGLE_GROUPS, triangleRingCells, canonicalHourglassCells } from '../core/hemisphere-build.js';

// Only "kind: dept" faces with a real tool:pieceType:*/tool:cuboctaBuild
// action are actual placeable pieces. Excludes two kinds of non-piece
// faces that would otherwise leak into this list:
//  - navigation doorways (WHEEL_PIECE's own "RD" face is just
//    `navigateTo:rdFamily`, a link INTO WHEEL_RD_FAMILY's real
//    "tool:pieceType:rd" entry, not a second, separate piece)
//  - SPARE faces (`action: null`, e.g. WHEEL_RD_FAMILY's last slot)
export function isRealPieceAction(action) {
  return typeof action === 'string' && (action.startsWith('tool:pieceType:') || action === 'tool:cuboctaBuild');
}

// Stage 2 -- real, COMPUTED vertex/edge/face counts, never hand-typed,
// via polyhedron-stats.js's general convex-hull deriver applied to each
// piece's own real vertex-building function (the same function the game
// itself calls to place that piece) -- single source of truth for
// geometry, the same discipline PIECE_ENTRIES' label/desc above already
// holds for copy. Cross-checked in tests/unit/polyhedron-stats.test.mjs
// against this codebase's own independently-derived face structure
// where one already exists (RD's facePieces(), the disphenoid's
// disphenoidFaces()) -- both match exactly.
function convexPieceVerts(action) {
  switch (action) {
    case 'tool:pieceType:rd': return rdRawVerts(1);
    case 'tool:pieceType:cube': return CUBE_VERTS;
    case 'tool:pieceType:pyramid': {
      const { pyramids } = pyramidPieces(1);
      return [...pyramids['x+'].base, pyramids['x+'].apex];
    }
    case 'tool:pieceType:to': return truncatedOctahedronVertices(1);
    // "Flattened Octahedron" -- the 4-disphenoid bundle (interstitial-
    // lattice.js's own module header), not a plain regular octahedron.
    case 'tool:pieceType:ioct': return octahedronVerts([0, 0, 0], [2, 0, 0]);
    case 'tool:pieceType:idis': return bootstrapDisphenoid([0, 0, 0]);
    case 'tool:cuboctaBuild': return cuboctahedronVertices(1);
    // "Octahedron" (fills the gap between cuboctahedra) -- octGapVertices,
    // a plain regular octahedron, genuinely distinct from ioct above
    // despite both being "an octahedron" in casual terms.
    case 'tool:pieceType:octahedron': return octGapVertices(1);
    case 'tool:pieceType:halfrd': return hemisphereSplit(1, 0).positive;
    default: return null; // not a single-cell convex piece -- see compositionForAction below
  }
}

// Cluster/composite pieces are NOT single convex polyhedra -- they're
// multiple real pieces meeting at genuine concave dihedral angles (a
// convex hull would incorrectly "shrink-wrap" over the actual shape and
// report a wrong, misleadingly-simple V/E/F). Rather than compute a
// wrong number, this reports the real COMPOSITION instead, derived from
// the same group arrays core/hemisphere-build.js's own click-to-place
// logic already uses -- never hand-counted. Triangle Ring is genuinely
// NOT 3 plain Hemi RD halves despite the family resemblance (it's 3
// "wedge2" cells -- each independently clipped by TWO hemisphereSplit
// cuts, a smaller and differently-shaped piece -- see hemisphere-
// build.js's own wedge2Key header), so it gets its own real unit label.
// unit/unitPlural given explicitly, not derived by appending "s" --
// "Hemi RD half" pluralizes irregularly ("halves"), and naive
// pluralization would silently produce "halfs" (a real bug found live,
// caught in the actual rendered detail panel, not just imagined).
function compositionForAction(action) {
  switch (action) {
    case 'tool:pieceType:hourglass':
      return { count: canonicalHourglassCells(0, 0, 0, 1, 1, 0).length, unit: 'Hemi RD half', unitPlural: 'Hemi RD halves' };
    case 'tool:pieceType:hemi3':
      return { count: CORNER_GROUPS[0].indices.length, unit: 'Hemi RD half', unitPlural: 'Hemi RD halves' };
    case 'tool:pieceType:hemi4':
      return { count: BAND_GROUPS[0].indices.length, unit: 'Hemi RD half', unitPlural: 'Hemi RD halves' };
    case 'tool:pieceType:hemiTri':
      return { count: TRIANGLE_GROUPS[0].indices.length, unit: 'Hemi RD half', unitPlural: 'Hemi RD halves' };
    case 'tool:pieceType:hemiRing':
      return { count: triangleRingCells([0, 0, 0], CORNER_GROUPS[0].indices).length, unit: 'wedge cell', unitPlural: 'wedge cells' };
    default: return null;
  }
}

/**
 * A piece's own real geometry summary -- either {vertexCount, edgeCount,
 * faceCount} (single-cell convex pieces) or {composedOf, unit} (cluster
 * pieces). null only for a genuinely non-piece entry (shouldn't happen
 * for anything isRealPieceAction already approved -- verified in
 * tests/unit/almanac-data.test.mjs, every real piece action resolves to
 * one or the other, no silent gaps).
 */
export function statsForAction(action) {
  const verts = convexPieceVerts(action);
  if (verts) return computeConvexStats(verts);
  const composition = compositionForAction(action);
  if (composition) return { composedOf: composition.count, unit: composition.unit, unitPlural: composition.unitPlural };
  return null;
}

function pieceEntriesFrom(wheelConfig) {
  return Object.values(wheelConfig.faces)
    .filter((face) => isRealPieceAction(face.action))
    .map((face) => ({
      kind: 'piece',
      id: face.action,
      label: face.label,
      desc: face.desc,
      markKey: ACTION_TO_MARK[face.action] ?? null,
      stats: statsForAction(face.action),
    }));
}

// 14 real pieces total (7 from WHEEL_PIECE's own top-level tiers, 7 from
// the RD family sub-wheel) as of this writing -- the real count is
// whatever the two wheel configs actually contain, verified (not just
// asserted) in tests/unit/almanac-data.test.mjs, so this list can never
// silently drift stale as new pieces are added to either wheel.
export const PIECE_ENTRIES = [
  ...pieceEntriesFrom(WHEEL_PIECE),
  ...pieceEntriesFrom(WHEEL_RD_FAMILY),
];

// Lattice-concept entries (spec section 3b) -- genuinely new copy, kept
// short (a reference card, not a textbook), matching RHOMBIVERSE_
// PRINCIPLES.md's Grounded Simplicity tone: plain, factual, cites real
// crystallography rather than inventing lore. markKey left null for
// both -- open question, spec section 6: neither concept has an
// existing wheel-icons.js mark of its own yet.
export const LATTICE_CONCEPT_ENTRIES = [
  {
    kind: 'concept',
    id: 'concept:bccLattice',
    label: 'The BCC Lattice',
    desc: "Rhombiverse's world grid is a real body-centered cubic (BCC) lattice -- every cell has 8 nearest neighbors (the cube corners) and 6 next-nearest (the face centers), the same coordination real BCC crystals (iron, tungsten) have. The interstitial pieces (Flattened Octahedron, Disphenoid) exist because a BCC lattice's own gaps have real, specific shapes -- they aren't placed arbitrarily.",
    markKey: null,
  },
  {
    kind: 'concept',
    id: 'concept:rdDuality',
    label: 'RD and the FCC Lattice',
    desc: "The rhombic dodecahedron (RD) is the real Voronoi cell of a face-centered cubic (FCC) lattice -- the same reason honeybees' hexagonal cells and closest-sphere-packing both relate to this shape. RD tiles 3D space with zero gaps, which is why it -- not a cube -- is Rhombiverse's own base building cell.",
    markKey: null,
  },
];

// World Systems retirement note (spec section 3c) -- one historical
// entry, not blocking any other stage. See README.md/CLAUDE.md's own
// retirement notes and commit 890615a for the real history this
// summarizes.
export const HISTORY_ENTRIES = [
  {
    kind: 'history',
    id: 'history:worldSystemsRetired',
    label: 'What Happened to World Systems?',
    desc: 'World Systems (mining, trade, claims, achievements, animals, hazards) was retired -- the code is archived, not deleted, but every path to it in the live UI is gone. Shared World (pure building, no simulation) is the only mode now. See commit 890615a for the full change.',
    markKey: null,
  },
];

export const ALMANAC_ENTRIES = [...PIECE_ENTRIES, ...LATTICE_CONCEPT_ENTRIES, ...HISTORY_ENTRIES];
