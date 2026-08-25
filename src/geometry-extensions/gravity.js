// Planetoid gravity backend -- RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md.
// Full design rationale/history for every export below:
// docs/code-notes/geometry-extensions/gravity.md
import { NEIGHBOR_OFFSETS, cellKey, parseCellKey, cellToWorld } from '../core/lattice.js';

// Core vs. Modules boundary: render.js supplies the real isClaimProtected
// via setRegionsIntegration(), gated behind FEATURES.economy. Inert
// default here (no claims exist) otherwise.
let isClaimProtected = () => false;
export function setRegionsIntegration({ isClaimProtected: isClaimProtectedFn }) {
  isClaimProtected = isClaimProtectedFn;
}

export const BSG_MATERIAL = 'blackstar-glassite';

// First-guess constants, not yet playtested -- see docs/code-notes.
const BASE_GRAVITY_RADIUS = 2.2;
const RADIUS_PER_BSG = 0.5;
const AVG_SHELL_SPACING = 1.2;
const CORE_FRACTION = 1 / 3;

export function findClusters(world) {
  const cells = world.entries();
  const byKey = new Map(cells.map((c) => [cellKey(c.x, c.y, c.z), c]));
  const visited = new Set();
  const clusters = [];

  for (const cell of cells) {
    const startKey = cellKey(cell.x, cell.y, cell.z);
    if (visited.has(startKey)) continue;
    const cluster = [];
    const stack = [startKey];
    visited.add(startKey);
    while (stack.length) {
      const key = stack.pop();
      cluster.push(byKey.get(key));
      const [x, y, z] = parseCellKey(key);
      for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
        const nKey = cellKey(x + dx, y + dy, z + dz);
        if (byKey.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          stack.push(nKey);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function bsgClusterStats(cluster) {
  const bsgCells = cluster.filter((c) => c.material === BSG_MATERIAL);
  if (bsgCells.length === 0) return null;

  const sum = bsgCells.reduce(
    (acc, c) => {
      const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
      acc.x += wx;
      acc.y += wy;
      acc.z += wz;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );
  const center = [sum.x / bsgCells.length, sum.y / bsgCells.length, sum.z / bsgCells.length];
  const gravityRadius = BASE_GRAVITY_RADIUS + (bsgCells.length - 1) * RADIUS_PER_BSG;
  return { bsgCells, center, gravityRadius };
}

export function computePlanetoids(world) {
  const clusters = findClusters(world);
  const planetoids = {};
  let nextId = 1;

  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats) continue;
    const { bsgCells, center, gravityRadius } = stats;

    let surfaceRadius = 0;
    for (const c of cluster) {
      const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
      const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
      if (d > surfaceRadius) surfaceRadius = d;
    }

    const effectiveShells = Math.max(1, Math.round(surfaceRadius / AVG_SHELL_SPACING));
    const coreShellRecommendation = Math.max(1, Math.round(effectiveShells * CORE_FRACTION));

    // hydrosphere.js's applyHydrosphere runs before this every change, so
    // reading its flag here needs no separate clustering pass.
    const hydrosphereActive = cluster.some((c) => c.hydrospherePermeated);

    planetoids[`planetoid_${nextId++}`] = {
      centerOfMass: center,
      gravityRadius,
      surfaceRadius,
      coreShellRecommendation,
      bsgCount: bsgCells.length,
      cellCount: cluster.length,
      hydrosphereActive,
      atmosphereActive: hydrosphereActive,
    };
  }
  return planetoids;
}

export function nearestPlanetoid(position, planetoids) {
  let best = null;
  let bestDist = Infinity;
  for (const [id, p] of Object.entries(planetoids)) {
    const [cx, cy, cz] = p.centerOfMass;
    const d = Math.hypot(position.x - cx, position.y - cy, position.z - cz);
    if (d < bestDist) {
      bestDist = d;
      best = { id, ...p, distance: d, active: d <= p.gravityRadius };
    }
  }
  return best;
}

export function gravityAt(position, planetoids, claims = {}) {
  const nearest = nearestPlanetoid(position, planetoids);
  if (!nearest || !nearest.active) return null;
  const cx = Math.round(position.x);
  const cy = Math.round(position.y);
  const cz = Math.round(position.z);
  if (isClaimProtected(claims, cx, cy, cz)) return null;
  return nearest;
}
