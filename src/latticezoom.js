// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 1 -- Static Sub-Lattice Geometry.
// A rendering-layer addition ON TOP of lattice.js, reusing its real
// FCC/RD math exactly (cellsInShells, shellCount, cellToWorld) rather
// than inventing new geometry -- see the spec's own section 1 ("this is
// not invented geometry"). Per section 4 (Isolation), this module never
// touches worldstate.js's cell schema -- it only reads `cells` and
// produces derived, disposable rendering data.
import { cellsInShells, shellCount, cellToWorld } from './lattice.js';

// Real, VERIFIED derivation (not guessed) -- see this project's own
// established convention for constants of this class ("verify against
// the real generator output"). The RD is this lattice's own Voronoi
// cell; its real volume at scale s=1 is EXACTLY 2 -- confirmed
// numerically via a real ConvexGeometry volume computation on
// lattice.js's own rdRawVerts(1) (12 tetrahedra fanned from the origin,
// summed), not assumed from the cube/octa vertex constants alone. This
// also matches a clean analytic check: valid cells are exactly HALF of
// Z^3 (the x+y+z-even parity constraint), so the Voronoi cell volume
// (1 / point density) is 1 / 0.5 = 2, independently confirming the same
// number two different ways before trusting it.
//
// A sub-lattice generated out to `maxShell` shells has
// `cumulativeCellCount(maxShell)` total cells (including the center).
// Scaling every sub-cell down by `subScaleFactor(maxShell) =
// cbrt(1 / cellCount)` makes the sub-lattice's TOTAL combined volume
// exactly equal to one parent RD's own volume, for any parent scale --
// cellCount * (parentScale * factor)^3 * 2 = parentScale^3 * 2 * (cellCount
// * factor^3) = parentScale^3 * 2 * (cellCount * (1/cellCount)) =
// parentScale^3 * 2, i.e. identical to the parent's own volume. This is
// exact by construction (Voronoi cells tile with zero gap/overlap by
// definition), not merely approximate -- verified numerically in
// tests/unit/latticezoom.test.mjs rather than trusted from the algebra
// alone.
export function cumulativeCellCount(maxShell) {
  let total = 1; // the center cell itself
  for (let n = 1; n <= maxShell; n++) total += shellCount(n);
  return total;
}

export function subScaleFactor(maxShell) {
  return Math.cbrt(1 / cumulativeCellCount(maxShell));
}

// "A small number of shells" per Stage 1's own scope -- 55 sub-cells
// (1 center + 12 shell-1 + 42 shell-2) is a moderate, visually rich
// substructure without being overwhelming. Real multi-level depth
// tuning (MAX_LOD_DEPTH, per-level trigger distances) is Stage 3's own
// job, not this one -- this constant is Stage 1's own fixed test value.
export const SUB_LATTICE_MAX_SHELL = 2;

// Given a parent cell's own integer lattice coordinate (and the SAME
// `parentScale` render.js's top-level mesh already uses), generates its
// sub-lattice: cellsInShells run from a fresh LOCAL origin (0,0,0) --
// not the parent's own real coordinate, which keeps sub-cell coordinates
// small and independent of where the parent actually sits in the world
// -- then each sub-cell's real world position is the parent's own real
// center plus that local offset scaled down by subScaleFactor. The
// center sub-cell (shell 0) is added explicitly: cellsInShells (by
// design, matching its own existing "shell fill" callers elsewhere in
// this project) never returns the seed/center cell itself, only cells
// discovered during BFS expansion -- so it needs to be added here the
// same "never invisible" way plantSeed/generatePlanetoid already handle
// their own center cell elsewhere in this codebase.
export function generateSubLattice(parentX, parentY, parentZ, maxShell = SUB_LATTICE_MAX_SHELL, parentScale = 1) {
  const factor = subScaleFactor(maxShell);
  const subScale = parentScale * factor;
  const [px, py, pz] = cellToWorld(parentX, parentY, parentZ, parentScale);
  const localCells = [{ x: 0, y: 0, z: 0, shell: 0 }, ...cellsInShells(0, 0, 0, maxShell)];
  return localCells.map((cell) => {
    const [lx, ly, lz] = cellToWorld(cell.x, cell.y, cell.z, subScale);
    return { x: cell.x, y: cell.y, z: cell.z, shell: cell.shell, worldPosition: [px + lx, py + ly, pz + lz], scale: subScale };
  });
}
