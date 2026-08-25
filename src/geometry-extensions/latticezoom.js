// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md -- Static Sub-Lattice Geometry, LOD
// trigger/blending, Adaptive Damping, and Ecosystem Rendering helpers.
// A rendering-layer addition on top of lattice.js; never touches
// worldstate.js's cell schema. Full rationale/history for every export
// below: docs/code-notes/geometry-extensions/latticezoom.md
import { cellsInShells, shellCount, cellToWorld } from '../core/lattice.js';

export function cumulativeCellCount(maxShell) {
  let total = 1; // the center cell itself
  for (let n = 1; n <= maxShell; n++) total += shellCount(n);
  return total;
}

export function subScaleFactor(maxShell) {
  return Math.cbrt(1 / cumulativeCellCount(maxShell));
}

export const SUB_LATTICE_MAX_SHELL = 2;

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

export function generateSubLattice(parentX, parentY, parentZ, maxShell = SUB_LATTICE_MAX_SHELL, parentScale = 1) {
  return generateSubLatticeAt(cellToWorld(parentX, parentY, parentZ, parentScale), parentScale, maxShell);
}

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

export const MAX_LOD_DEPTH = 2;

export function levelTriggerDistance(baseTriggerDistance, depth, maxShell = SUB_LATTICE_MAX_SHELL) {
  return baseTriggerDistance * Math.pow(subScaleFactor(maxShell), depth - 1);
}

export function blendFactor(distance, innerTrigger, blendWidth) {
  if (distance <= innerTrigger) return 1;
  const outer = innerTrigger + blendWidth;
  if (distance >= outer) return 0;
  return (outer - distance) / blendWidth;
}

// Stage 4 -- Adaptive Damping. Same volatility-response shape as
// evolution.js's own nextVolatilityScore/VOLATILITY_DECAY_FACTOR,
// applied here to camera/reference-position movement instead of
// population swings. See companion doc for the full derivation of
// each constant below.
export const SUB_LATTICE_SWING_FRACTION_THRESHOLD = 0.3;
export const SUB_LATTICE_VOLATILITY_DECAY_FACTOR = 0.9;
export const SUB_LATTICE_THROTTLE_BASE_MS = 250;
export const SUB_LATTICE_THROTTLE_MAX_MS = 1000;
export const SUB_LATTICE_THROTTLE_MS_PER_VOLATILITY = 150;

export function swingMagnitude(movement, triggerDistance) {
  if (triggerDistance <= 0) return 0;
  return movement / triggerDistance;
}

export function nextVolatilityScore(currentScore, movement, triggerDistance) {
  const magnitude = swingMagnitude(movement, triggerDistance);
  if (magnitude >= SUB_LATTICE_SWING_FRACTION_THRESHOLD) return currentScore + magnitude;
  return currentScore * SUB_LATTICE_VOLATILITY_DECAY_FACTOR;
}

export function throttleForVolatility(volatilityScore) {
  return Math.min(
    SUB_LATTICE_THROTTLE_MAX_MS,
    SUB_LATTICE_THROTTLE_BASE_MS + volatilityScore * SUB_LATTICE_THROTTLE_MS_PER_VOLATILITY
  );
}

export function scaleVerticesAroundOrigin(vertices, origin, factor) {
  const [ox, oy, oz] = origin;
  return vertices.map(([x, y, z]) => [ox + (x - ox) * factor, oy + (y - oy) * factor, oz + (z - oz) * factor]);
}

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

export const AGGREGATE_MAX_SPECKLES = 8;
export function speckleCountForBiomass(biomassAvailability) {
  return Math.round(Math.min(1, Math.max(0, biomassAvailability)) * AGGREGATE_MAX_SPECKLES);
}
