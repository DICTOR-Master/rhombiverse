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

// Real, general core: given ANY parent's real world CENTER + real scale
// (not necessarily an integer top-level lattice coordinate), generates
// its sub-lattice the same way every time. This is what makes Stage 3's
// recursion possible -- a level-1 sub-cell's own `worldPosition`/`scale`
// (below) can be fed straight back in as the "parent" for a level-2
// sub-lattice, with zero special-casing between depths. `cellsInShells`
// runs from a fresh LOCAL origin (0,0,0) -- not the parent's own real
// coordinate, which keeps sub-cell coordinates small regardless of
// depth -- then each sub-cell's real world position is the parent's own
// real center plus that local offset scaled down by subScaleFactor. The
// center sub-cell (shell 0) is added explicitly: cellsInShells (by
// design, matching its own existing "shell fill" callers elsewhere in
// this project) never returns the seed/center cell itself, only cells
// discovered during BFS expansion -- so it needs to be added here the
// same "never invisible" way plantSeed/generatePlanetoid already handle
// their own center cell elsewhere in this codebase.
export function generateSubLatticeAt(parentCenter, parentScale, maxShell = SUB_LATTICE_MAX_SHELL) {
  const factor = subScaleFactor(maxShell);
  const subScale = parentScale * factor;
  const [px, py, pz] = parentCenter;
  const localCells = [{ x: 0, y: 0, z: 0, shell: 0 }, ...cellsInShells(0, 0, 0, maxShell)];
  return localCells.map((cell) => {
    const [lx, ly, lz] = cellToWorld(cell.x, cell.y, cell.z, subScale);
    return { x: cell.x, y: cell.y, z: cell.z, shell: cell.shell, worldPosition: [px + lx, py + ly, pz + lz], scale: subScale };
  });
}

// Thin wrapper for the TOP-level case (an integer lattice parent
// coordinate, Stage 1/2's own original call shape) -- kept as its own
// named function so every existing caller/test stays unchanged; just
// resolves the parent's real world center via lattice.js's own
// cellToWorld, then delegates to the general core above.
export function generateSubLattice(parentX, parentY, parentZ, maxShell = SUB_LATTICE_MAX_SHELL, parentScale = 1) {
  return generateSubLatticeAt(cellToWorld(parentX, parentY, parentZ, parentScale), parentScale, maxShell);
}

// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 2 -- Camera-Distance Trigger &
// Lifecycle. Pure selection logic, deliberately factored out of
// render.js's own THREE-specific mesh-buffer code so it's independently
// unit-testable (this project's own established discipline: business
// logic lives in a pure, THREE-free module; only actual scene-graph
// wiring lives in render.js, verified live instead). Given every built
// cell and a real reference position (the camera, or the live player
// position while walking), returns the closest `maxCells` cells within
// `triggerDistance`, nearest-first -- render.js generates each chosen
// cell's own sub-lattice and writes it into its shared InstancedMesh
// buffer.
export function selectNearbyCells(cells, referencePosition, triggerDistance, maxCells, scale = 1) {
  const [rx, ry, rz] = referencePosition;
  const nearby = [];
  for (const cell of cells) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, scale);
    const d = Math.hypot(wx - rx, wy - ry, wz - rz);
    if (d <= triggerDistance) nearby.push({ x: cell.x, y: cell.y, z: cell.z, d });
  }
  nearby.sort((a, b) => a.d - b.d);
  return nearby.slice(0, maxCells);
}

// Same real selection logic as selectNearbyCells above, generalized to
// operate on items that already carry a real `worldPosition` (a level-1
// sub-cell, when selecting level-2 candidates) rather than an integer
// lattice coordinate needing cellToWorld -- the recursive case Stage 3
// needs. selectNearbyCells itself is left untouched (its own existing
// callers/tests keep working byte-identical); this is the general core
// underneath both.
export function selectNearbyByWorldPosition(items, referencePosition, triggerDistance, maxCount) {
  const [rx, ry, rz] = referencePosition;
  const nearby = [];
  for (const item of items) {
    const [wx, wy, wz] = item.worldPosition;
    const d = Math.hypot(wx - rx, wy - ry, wz - rz);
    if (d <= triggerDistance) nearby.push({ ...item, d });
  }
  nearby.sort((a, b) => a.d - b.d);
  return nearby.slice(0, maxCount);
}

// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 3 -- Multi-Level Depth &
// Blending.
//
// MAX_LOD_DEPTH=2 (sub-lattice, then sub-sub-lattice) -- per section 2's
// own "2 or 3 is the likely practical range." Real reasoning, not
// arbitrary: each deeper level's own trigger radius is scaled down by
// the SAME subScaleFactor the geometry itself shrinks by (see
// levelTriggerDistance below), so the number of simultaneously-active
// deeper-level cells stays small by construction -- only whatever is
// within an already-tiny radius of the camera can ever qualify. Picked
// 2 rather than 3 to keep this pass's real cost/complexity bounded
// (two InstancedMeshes, not three) while still proving genuine
// recursion works, not just one extra fixed level -- revisit only if
// real play ever shows a concrete need for a third depth.
export const MAX_LOD_DEPTH = 2;

// A deeper level's own trigger distance and blend width are the SAME
// real fraction of its parent's own as the geometry itself shrinks by
// (subScaleFactor) -- keeps the "reveal ratio" self-similar at every
// depth rather than picking a second, unrelated set of numbers per
// level.
export function levelTriggerDistance(baseTriggerDistance, depth, maxShell = SUB_LATTICE_MAX_SHELL) {
  return baseTriggerDistance * Math.pow(subScaleFactor(maxShell), depth - 1);
}

// Cross-fade/scale blending (section 3's own explicit "not a hard pop"
// requirement): 1.0 (full scale) at or inside `innerTrigger`, ramping
// LINEARLY down to 0.0 (invisible) at `innerTrigger + blendWidth`, and
// exactly 0 beyond that -- render.js applies this as a uniform scale
// multiplier on each instance's own transform, so a cell visibly grows
// in as the camera approaches and shrinks back out as it retreats,
// rather than popping in/out at a hard boundary.
export function blendFactor(distance, innerTrigger, blendWidth) {
  if (distance <= innerTrigger) return 1;
  const outer = innerTrigger + blendWidth;
  if (distance >= outer) return 0;
  return (outer - distance) / blendWidth;
}
