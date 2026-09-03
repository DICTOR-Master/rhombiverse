// Generates the complete, symmetry-deduplicated set of connected N-cell
// FCC lattice shapes, for building multi-cell Rhombis stages -- direct
// instruction (2026-09-04): "from here forward all mathematical
// possibilities in any cell arrangement", after Stage 7 ("Joined
// Pair") was built from a single hand-picked 2-cell layout. Rather than
// hand-picking a few named shapes for N=3+ ("a line", "a triangle",
// "some other bend"), this enumerates every one that actually exists in
// the lattice, the same "free polyomino" counting problem (distinct
// shapes up to rotation/reflection, not counting every orientation
// separately) adapted from a square grid to this lattice.
//
// Pure math, no THREE/DOM -- same "core logic separate from rendering"
// split puzzle-state.js already follows. core/lattice.js's own
// NEIGHBOR_OFFSETS/isValidCell are the only inputs; this file adds
// nothing to the lattice's own definition, only reasons about shapes
// built from it.
import { NEIGHBOR_OFFSETS, isValidCell } from '../core/lattice.js';

// The FCC lattice's full symmetry group: every operation that maps the
// 12 NEIGHBOR_OFFSETS onto themselves as a set is exactly the octahedral
// symmetry group -- all 6 permutations of the (x,y,z) axes, combined
// with all 8 independent sign flips, 6*8 = 48 operations total. This is
// provably complete (not a guess): NEIGHBOR_OFFSETS is exactly the set
// of integer vectors with two coordinates at +-1 and one at 0 (the
// (+-1,+-1,0)-permutation class), and a signed permutation is the most
// general linear map that preserves "which coordinates are +-1 vs 0"
// for every vector in that class simultaneously -- verified directly in
// this file's own test suite (every operation maps NEIGHBOR_OFFSETS
// bijectively onto itself, and the group closes under composition).
// Signed permutations also preserve x+y+z's parity (a sign flip changes
// one coordinate by an even amount, +-2x; a permutation doesn't change
// the sum at all) -- so every operation maps real, valid lattice cells
// (isValidCell's own even-sum constraint) to real, valid lattice cells,
// not just abstract offset vectors.
function permutations3() {
  const indices = [0, 1, 2];
  const results = [];
  const used = [false, false, false];
  const current = [];
  function build() {
    if (current.length === 3) { results.push([...current]); return; }
    for (const i of indices) {
      if (used[i]) continue;
      used[i] = true;
      current.push(i);
      build();
      current.pop();
      used[i] = false;
    }
  }
  build();
  return results;
}

function signCombinations3() {
  const results = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        results.push([sx, sy, sz]);
      }
    }
  }
  return results;
}

// Each operation: { perm: [p0,p1,p2], signs: [s0,s1,s2] } such that
// applying it to [x,y,z] gives [s0*v[p0], s1*v[p1], s2*v[p2]].
export const SYMMETRY_OPERATIONS = permutations3().flatMap((perm) =>
  signCombinations3().map((signs) => ({ perm, signs }))
);

export function applySymmetry(op, [x, y, z]) {
  const v = [x, y, z];
  return [op.signs[0] * v[op.perm[0]], op.signs[1] * v[op.perm[1]], op.signs[2] * v[op.perm[2]]];
}

function cellKey([x, y, z]) {
  return `${x},${y},${z}`;
}

// Canonical form of a connected cell SHAPE (a set of lattice
// coordinates, not yet reduced by symmetry): try all 48 symmetry
// operations, for each one translate the result so its own
// lexicographically-smallest cell sits at the origin (translation
// invariance -- shape, not absolute position, is what's being
// compared), sort the translated coordinates lexicographically, and
// keep the lexicographically smallest of all 48 resulting
// representations. Two shapes are the same up to rotation/reflection
// if and only if their canonical forms are identical (as a joined
// string, safe to use directly as a dedup key).
function compareCells(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function canonicalForm(cells) {
  let best = null;
  for (const op of SYMMETRY_OPERATIONS) {
    const transformed = cells.map((c) => applySymmetry(op, c));
    transformed.sort(compareCells);
    const [ox, oy, oz] = transformed[0];
    const translated = transformed.map(([x, y, z]) => [x - ox, y - oy, z - oz]);
    const key = translated.map(cellKey).join('|');
    if (best === null || key < best.key) best = { key, cells: translated };
  }
  return best;
}

// Enumerates every connected N-cell shape in the lattice, up to
// rotation/reflection -- BFS-grows from a single seed cell (0,0,0),
// adding one more cell (any lattice neighbor of any cell already in
// the set) at a time, canonicalizing and deduping at each size before
// growing further (so N=k's own complete, deduped shape list is real
// input to generating N=k+1, not just a size filter after the fact).
// Returns, for each N from 1 to maxN, the list of canonical shapes
// (each a sorted array of [x,y,z] triples with the shape's own
// "smallest" cell translated to the origin).
export function enumerateShapes(maxN) {
  const byN = [];
  byN[1] = [canonicalForm([[0, 0, 0]])];

  for (let n = 2; n <= maxN; n++) {
    const seen = new Map();
    for (const shape of byN[n - 1]) {
      const existing = new Set(shape.cells.map(cellKey));
      const candidateNeighbors = new Set();
      for (const cell of shape.cells) {
        for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
          const next = [cell[0] + dx, cell[1] + dy, cell[2] + dz];
          if (!isValidCell(...next)) continue; // defensive -- NEIGHBOR_OFFSETS already only produces valid cells from a valid one
          const key = cellKey(next);
          if (!existing.has(key)) candidateNeighbors.add(key);
        }
      }
      for (const key of candidateNeighbors) {
        const [x, y, z] = key.split(',').map(Number);
        const grown = [...shape.cells, [x, y, z]];
        const canon = canonicalForm(grown);
        if (!seen.has(canon.key)) seen.set(canon.key, canon);
      }
    }
    byN[n] = [...seen.values()];
  }
  return byN;
}
