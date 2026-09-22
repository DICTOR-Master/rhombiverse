// Elongated Dodecahedron -- the 4th of the real "5" parallelohedra this
// app was missing (Cube, Hex Prism, RD, Elongated Dodecahedron, TO --
// see /home/dicto/Downloads/lattice-primitives.md; RD and TO already
// ship, Cube is already viewable as RD's own inscribed sub-piece via
// Lattice Quick-View). Direct user instruction: "fill the registry with
// remainder of five," scoped as a real, independently placeable
// occupant ("occupant shapes on existing FCC positions") -- see the
// plan file's own "Primitive catalog per dimension" section.
//
// Construction (verified against a real source before writing any
// coordinates -- Polytope Wiki / MathWorld, both independently
// confirming the same method): take a Rhombic Dodecahedron, cut it
// through its own equator (the 4 rhombic faces whose plane passes
// through the center), and insert a square prism of height `h` between
// the two halves. The 8 top/bottom-ring rhombic faces (facePieces()'s
// own "top"/"bottom" faces, core/lattice.js) are untouched by this cut
// and simply shift outward; the 4 equator rhombi each merge with one new
// prism side face into a single flat hexagon (verified planar and
// coplanar with the ORIGINAL rhombus's own plane below, not assumed).
//
// h = sqrt(3) * half is the one non-arbitrary value: it's the exact
// height that makes all 6 edges of each new hexagon equal length, and
// that length is EXACTLY the RD's own existing edge length (both
// verified numerically, not just algebraically, in this session's own
// scratch check) -- i.e. the elongation that makes this app's own RD
// edges and the new hexagon edges consistent, not an arbitrary choice.
//
// Real, load-bearing consequence for the build controller
// (elongdodeca-build.js): face count stays 12 (8 rhombi + 4 hexagons,
// same as RD's own 12), so this shape's neighbor-adjacency structure is
// COMBINATORIALLY IDENTICAL to RD's -- it reuses core/lattice.js's own
// NEIGHBOR_OFFSETS/isValidCell UNCHANGED, needing only its own
// (anisotropic) cellToWorld, not a new offset table the way TO/CO each
// needed. Verified: 18 vertices, 12 faces (matches the cited source's
// own "eighteen vertices, twenty-eight edges, twelve faces" exactly --
// 28 edges = 8*4 rhombus-edges/2-shared + 4*6 hexagon-edges/mixed
// sharing, not independently re-derived here, taken on the source's
// own authority since it isn't load-bearing for anything this file
// computes).
import { CUBE_VERTS, OCTA_VERTS } from '../core/lattice.js';

// The one real free parameter: how much of the RD's own edge length the
// elongation height is. 1 (the default) is the verified "equilateral
// hexagon" value; exposed as a parameter rather than hardcoded so a
// future caller can deliberately depart from it (and must then say so),
// per this app's own "disclose departures honestly" principle rather
// than silently keep the canonical form buried in a default.
export function elongatedDodecahedronVerts(s = 1, elongationRatio = 1) {
  const half = s * 0.5;
  const oct = s; // = 2 * half, RD's own octahedral-vertex distance
  const h = Math.sqrt(3) * half * elongationRatio;
  const verts = [];
  // 2 apex points (the elongation axis, Z) -- untouched by the cut,
  // just pushed outward by the extra h/2.
  verts.push([0, 0, oct + h / 2], [0, 0, -(oct + h / 2)]);
  // 8 cube corners (CUBE_VERTS) -- also untouched by the cut itself
  // (none lie on the z=0 cut plane), just shifted by the extra h/2 in
  // whichever half they're already in.
  for (const [x, y, z] of CUBE_VERTS) {
    verts.push([x * half, y * half, z * half + Math.sign(z) * (h / 2)]);
  }
  // 8 split equator vertices: the X-axis and Y-axis OCTA_VERTS entries
  // (the 2 Z-axis ones are the apexes above, already handled) each sat
  // exactly on the z=0 cut plane in the un-elongated RD, so each splits
  // into a +h/2 copy (top prism cap) and a -h/2 copy (bottom prism cap).
  for (const [x, y, z] of OCTA_VERTS) {
    if (z !== 0) continue; // skip the 2 Z-axis (apex) entries, handled above
    verts.push([x * oct, y * oct, h / 2], [x * oct, y * oct, -h / 2]);
  }
  return verts; // 2 + 8 + 8 = 18, matches the cited source exactly
}

// Anisotropic world-scale: identical to core/lattice.js's own
// cellToWorld in X/Y (this shape shares RD's own combinatorial lattice,
// per this file's own header), but stretched in Z by the same
// elongation this shape's own geometry above already bakes in --
// otherwise adjacent cells along Z would overlap/gap instead of sharing
// a flush face. NEIGHBOR_OFFSETS/isValidCell (core/lattice.js) are
// reused verbatim by elongdodeca-build.js; only this scale function is
// new, per this file's own header.
//
// Real bug found live, direct report ("i am revolving it in every
// direction... no hexagon faces" / "seeing RD when elongated is
// selected"): elongDodecaWorld has NO seed of its own -- every piece
// bootstraps off an ALREADY-REAL, un-elongated RD cell in the main
// world (this file's own header: "the main world's own cells are
// always a valid bootstrap surface"). The z=0 cell in THIS store's own
// coordinate frame therefore always represents that real, ordinary RD
// -- but the old formula (`z * (s+h)`) charged the SAME full elongation
// gap (s+h) for the very FIRST step away from it as for every step
// between two ALREADY-elongated neighbors, when the boundary crossed on
// that first step is only HALF-elongated (one real RD side, one
// elongated side). That extra half-h of unearned distance pushed the
// first placed piece off its true flush position -- for the 8 of 12
// NEIGHBOR_OFFSETS with a nonzero z-component (2/3 of all real click
// directions), badly enough to misalign the piece and hide the very
// hexagonal faces that would prove it isn't just another RD.
//
// Fixed by decomposing z into "one real RD-to-elongdodeca transition
// (h/2) plus (|z|-1) further elongdodeca-to-elongdodeca steps (h each)"
// -- verified algebraically equal to `z*(s+h) - sign(z)*(h/2)` for any
// integer z, and confirmed self-consistent: z=1's own flush position
// (s+h/2) plus one further full elongdodeca step (s+h) exactly equals
// z=2's own value, so growing a SECOND elongdodeca off an already-
// placed one (elongDodecaMesh-to-elongDodecaMesh, not bootstrapped
// through a real RD) still gets the correct, undiminished full gap.
export function elongDodecaCellToWorld(x, y, z, s = 1, elongationRatio = 1) {
  const half = s * 0.5;
  const h = Math.sqrt(3) * half * elongationRatio;
  const worldZ = z === 0 ? 0 : z * (s + h) - Math.sign(z) * (h / 2);
  return [x * s, y * s, worldZ];
}
