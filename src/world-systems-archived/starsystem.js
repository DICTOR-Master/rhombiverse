// Star System Anchor -- RHOMBIVERSE_SPEC_STAR_SYSTEM.md.
// Full design rationale/history for every export below:
// docs/code-notes/world-systems/starsystem.md
import { cellToWorld } from '../core/lattice.js';
import { BSG_MATERIAL, findClusters, bsgClusterStats } from '../geometry-extensions/gravity.js';

// First-guess constants, not yet playtested -- see docs/code-notes.
export const STAR_BSG_THRESHOLD = 8;
const LUMINOSITY_PER_BSG = 1.5;
const CARBON_CATALYST_MATERIAL = 'ferrostone';
const FROST_LINE_FRACTION = 0.6;

export function isStar(planetoid) {
  return planetoid.bsgCount >= STAR_BSG_THRESHOLD;
}

export function luminosity(planetoid) {
  if (!isStar(planetoid)) return 0;
  return (planetoid.bsgCount - STAR_BSG_THRESHOLD + 1) * LUMINOSITY_PER_BSG;
}

export function defaultLedger() {
  return { hydrogenConsumed: 0, carbonConsumed: 0, activeTicks: 0, recentFusionTimes: [], detonated: false };
}

export function pickCoreCell(cluster, center) {
  const existing = cluster.find((c) => c.material === BSG_MATERIAL && c.starLedger);
  if (existing) return existing;
  let best = null;
  let bestDist = Infinity;
  for (const c of cluster) {
    if (c.material !== BSG_MATERIAL) continue;
    const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
    const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
    if (d < bestDist - 1e-9) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function applyStarFusion(world, now = Date.now()) {
  const clusters = findClusters(world);
  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats || stats.bsgCells.length < STAR_BSG_THRESHOLD) continue;

    const hasHydrogen = cluster.some((c) => c.hydrospherePermeated);
    const hasCarbon = cluster.some((c) => c.material === CARBON_CATALYST_MATERIAL);
    if (!hasHydrogen || !hasCarbon) continue;

    const coreCell = pickCoreCell(cluster, stats.center);
    if (!coreCell) continue;
    const ledger = coreCell.starLedger ?? defaultLedger();
    // Detonated stars are spent -- fusion stops accumulating (see docs/code-notes).
    if (ledger.detonated) continue;
    const { x, y, z, ...data } = coreCell;
    world.addCell(x, y, z, {
      ...data,
      starLedger: {
        ...ledger,
        hydrogenConsumed: ledger.hydrogenConsumed + 1,
        carbonConsumed: ledger.carbonConsumed + 1,
        activeTicks: ledger.activeTicks + 1,
        recentFusionTimes: [...ledger.recentFusionTimes, now].filter((t) => now - t <= 10000),
      },
    });
  }
}

export function frostLineDistance(starPlanetoid) {
  return starPlanetoid.gravityRadius * FROST_LINE_FRACTION;
}

export function canPlaceMaterial(material, x, y, z, stars) {
  if (material !== 'ice99') return true; // frost line only restricts Ice 9.9
  const [wx, wy, wz] = cellToWorld(x, y, z);
  for (const star of stars) {
    const [cx, cy, cz] = star.centerOfMass;
    const d = Math.hypot(wx - cx, wy - cy, wz - cz);
    if (d < frostLineDistance(star)) return false;
  }
  return true;
}

export function annotateStars(planetoids, world) {
  const clusters = findClusters(world);
  const out = { ...planetoids };
  for (const [id, planetoid] of Object.entries(out)) {
    if (!isStar(planetoid)) continue;
    const cluster = clusters.find((c) => {
      const stats = bsgClusterStats(c);
      return (
        stats &&
        Math.hypot(
          stats.center[0] - planetoid.centerOfMass[0],
          stats.center[1] - planetoid.centerOfMass[1],
          stats.center[2] - planetoid.centerOfMass[2]
        ) < 1e-6
      );
    });
    const stats = cluster ? bsgClusterStats(cluster) : null;
    const coreCell = stats ? pickCoreCell(cluster, stats.center) : null;
    const ledger = coreCell?.starLedger ?? defaultLedger();
    const fusionActive =
      !!cluster &&
      cluster.some((c) => c.hydrospherePermeated) &&
      cluster.some((c) => c.material === CARBON_CATALYST_MATERIAL);
    out[id] = {
      ...planetoid,
      isStar: true,
      luminosity: luminosity(planetoid),
      fusionActive,
      hydrogenConsumed: ledger.hydrogenConsumed,
      carbonConsumed: ledger.carbonConsumed,
      accumulatedMass: ledger.hydrogenConsumed + ledger.carbonConsumed,
      detonated: ledger.detonated,
      frostLineDistance: frostLineDistance(planetoid),
    };
  }
  return out;
}
