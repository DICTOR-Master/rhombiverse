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

function pieceEntriesFrom(wheelConfig) {
  return Object.values(wheelConfig.faces)
    .filter((face) => isRealPieceAction(face.action))
    .map((face) => ({
      kind: 'piece',
      id: face.action,
      label: face.label,
      desc: face.desc,
      markKey: ACTION_TO_MARK[face.action] ?? null,
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
