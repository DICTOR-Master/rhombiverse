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

// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 4 -- Adaptive Damping.
//
// Not a new mechanic invented for this spec -- RHOMBIVERSE_PRINCIPLES.md
// section 2's own generalized volatility-response shape, the same one
// evolution.js's nextVolatilityScore/VOLATILITY_DECAY_FACTOR already
// implements for population swings: accumulate a volatility score on
// each "correction event" (there, a >=30%-of-prior-population swing
// between generations; here, real camera/reference-position movement
// between refreshes), decay it during calm periods, and drive a bounded,
// monotonically-increasing response off of it (there, carrying-capacity
// headroom + a lowered mutation ceiling; here, a widened recompute
// throttle interval). Deliberately its own local constants, not a
// literal import of evolution.js's -- a different subsystem's own
// tunable, same shape.
//
// SUB_LATTICE_SWING_FRACTION_THRESHOLD (0.3): reuses evolution.js's own
// exact threshold VALUE as a real reference point, not an unrelated
// number -- adapted to this domain as "real movement across one refresh
// tick exceeding 30% of the base trigger distance counts as a genuine
// rapid scrub," the same "genuine swing vs routine noise" cutoff shape,
// just normalized by a different (but equally real, already-existing)
// baseline quantity.
export const SUB_LATTICE_SWING_FRACTION_THRESHOLD = 0.3;
// Same value AND same role as evolution.js's own VOLATILITY_DECAY_FACTOR
// -- "settling toward stability... during calm periods," per
// RHOMBIVERSE_PRINCIPLES.md section 2's own wording.
export const SUB_LATTICE_VOLATILITY_DECAY_FACTOR = 0.9;
// The existing Stage 2 tight default (250ms), now named so Stage 4's
// widening has a real base to widen FROM rather than a bare literal.
export const SUB_LATTICE_THROTTLE_BASE_MS = 250;
// Bounded widening cap (section 2's own "adaptive, not infinite"
// requirement) -- even under sustained rapid scrubbing, a recompute
// still happens at least once a second, so the revealed sub-lattice
// never lags the camera by more than that regardless of how volatile
// movement gets.
export const SUB_LATTICE_THROTTLE_MAX_MS = 1000;
// Linear widening rate: reaching the 1000ms cap from the 250ms base
// takes a volatility score of (1000-250)/150 = 5 -- roughly five
// consecutive "full-strength" swings (each tick's movement equal to a
// full trigger-distance, magnitude ~1.0) accumulated without an
// intervening calm tick to decay them, i.e. genuinely sustained rapid
// scrubbing, not one quick flick of the wheel.
export const SUB_LATTICE_THROTTLE_MS_PER_VOLATILITY = 150;

// Pure: how far the reference position moved since the last refresh,
// expressed as a fraction of the base trigger distance -- the same
// "normalize the raw metric by something already real in the system"
// shape evolution.js's own swingMagnitude uses (there: population change
// as a fraction of prior population).
export function swingMagnitude(movement, triggerDistance) {
  if (triggerDistance <= 0) return 0;
  return movement / triggerDistance;
}

// Pure: current volatility score + this refresh's own real movement ->
// next score. Mirrors evolution.js's own nextVolatilityScore shape
// exactly (accumulate on a real swing, multiplicatively decay
// otherwise), parameterized on movement/triggerDistance instead of
// before/after population counts.
export function nextVolatilityScore(currentScore, movement, triggerDistance) {
  const magnitude = swingMagnitude(movement, triggerDistance);
  if (magnitude >= SUB_LATTICE_SWING_FRACTION_THRESHOLD) return currentScore + magnitude;
  return currentScore * SUB_LATTICE_VOLATILITY_DECAY_FACTOR;
}

// Pure: volatility score -> the real throttle interval render.js's own
// self-rescheduling refresh loop should use next, bounded between the
// tight default and the widened cap.
export function throttleForVolatility(volatilityScore) {
  return Math.min(
    SUB_LATTICE_THROTTLE_MAX_MS,
    SUB_LATTICE_THROTTLE_BASE_MS + volatilityScore * SUB_LATTICE_THROTTLE_MS_PER_VOLATILITY
  );
}

// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 5 -- Ecosystem Rendering (Real
// Organisms + Plant-Coverage Layer). Pure geometry/aggregate helpers;
// render.js supplies the real THREE-specific wiring and reads real
// evolution.js data (organisms/biomass) -- same "business logic lives in
// a pure module" split every prior stage already used.
//
// Real design call made re-reading section 6.1's own text closely (not
// guessed): "an organism is just more content that becomes visible once
// the camera is close enough for its actual (tiny) size to register at
// all" -- this REPLACES an organism's existing always-visible, wrong-
// scale rendering (the literal "scale-mismatch problem the project
// owner raised" the section opens with) with this stage's LOD-gated tiny
// version, rather than adding a second copy alongside the old one.

// Scales a set of real world-space vertices DOWN around a fixed real
// world-space origin -- shrinks an organism's own already-correct
// growth-tile shape around its own rooted position, rather than
// re-deriving its geometry from scratch at a different scale. factor=1
// is a no-op; factor=0 collapses every vertex onto origin itself
// (degenerate -- callers must skip building geometry from that output,
// not feed it to a hull constructor).
export function scaleVerticesAroundOrigin(vertices, origin, factor) {
  const [ox, oy, oz] = origin;
  return vertices.map(([x, y, z]) => [ox + (x - ox) * factor, oy + (y - oy) * factor, oz + (z - oz) * factor]);
}

// Which species has the most individuals among a real nearby organism
// list -- the aggregate layer's own "dominant species" signal (section
// 6.1). Ties broken by first-seen order (stable, not random): real ties
// are rare with real population data, but a DETERMINISTIC break avoids
// the aggregate layer's tint flickering between two colors frame to
// frame on a near-tied population.
export function dominantSpecies(organisms) {
  if (organisms.length === 0) return null;
  const counts = new Map();
  for (const o of organisms) counts.set(o.species, (counts.get(o.species) ?? 0) + 1);
  let best = null;
  let bestCount = -1;
  for (const [species, count] of counts) {
    if (count > bestCount) {
      best = species;
      bestCount = count;
    }
  }
  return best;
}

// Real, bounded instanced-speckle count for the aggregate plant-coverage
// layer -- section 10's own "leaning toward instanced geometry...
// cheaper, cruder... for a first pass," driven directly by evolution.js's
// own localBiomassAvailability (already [0,1]-normalized -- section
// 6.1's own "reusing section 5's own biomass figure"). AGGREGATE_MAX_
// SPECKLES (8): a small, cheap, first-pass density range -- real per-cell
// coverage visibly changes as biomass changes (this stage's own success
// check) without rendering hundreds of instances per revealed cell.
export const AGGREGATE_MAX_SPECKLES = 8;
export function speckleCountForBiomass(biomassAvailability) {
  return Math.round(Math.min(1, Math.max(0, biomassAvailability)) * AGGREGATE_MAX_SPECKLES);
}
