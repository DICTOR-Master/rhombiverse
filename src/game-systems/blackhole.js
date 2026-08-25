// Black Hole (Asymptotic Containment) -- RHOMBIVERSE_SPEC_BLACKHOLE.md.
// Extreme case of the same gravity-source mechanic, no new material/
// object type. Scoped for single-player, with an absolute cross-player
// consumption guard -- see companion doc for the full history.
// Full design rationale/history: docs/code-notes/game-systems/blackhole.md
import { shellCount, cellKey, cellToWorld, cellsInShells } from '../core/lattice.js';
import { BSG_MATERIAL, findClusters, bsgClusterStats } from '../geometry-extensions/gravity.js';
import { isClaimProtected } from './regions.js';

export const BLACK_HOLE_BSG_THRESHOLD = 20;
export const MAX_GENERATED_CELLS = 2000;
const EVENT_HORIZON_FRACTION = 0.15;
const DAMPING_WINDOW_MS = 10000;
const DAMPING_FACTOR = 0.5;

export function isBlackHole(planetoid) {
  return planetoid.bsgCount >= BLACK_HOLE_BSG_THRESHOLD;
}

export function shellCumulativeCost(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) total += shellCount(i);
  return total;
}

function defaultLedger() {
  return { consumedMatter: 0, generatedThroughShell: 0, recentConsumptionTimes: [] };
}

function pickCoreCell(cluster, center) {
  const existing = cluster.find((c) => c.material === BSG_MATERIAL && c.blackHoleLedger);
  if (existing) return existing;

  let best = null;
  let bestDist = Infinity;
  for (const c of cluster) {
    if (c.material !== BSG_MATERIAL) continue;
    const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
    const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
    const key = cellKey(c.x, c.y, c.z);
    const better = d < bestDist - 1e-9 || (Math.abs(d - bestDist) < 1e-9 && (!best || key < cellKey(best.x, best.y, best.z)));
    if (better) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function ledgerOf(coreCell) {
  return coreCell.blackHoleLedger ?? defaultLedger();
}

function saveLedger(world, coreCell, ledger) {
  const { x, y, z, ...data } = coreCell;
  world.addCell(x, y, z, { ...data, blackHoleLedger: ledger });
}

export function applyBlackHoleConsumption(world, now = Date.now()) {
  const clusters = findClusters(world);
  const claims = world.getClaims();
  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats) continue;
    const bsgCount = stats.bsgCells.length;
    if (bsgCount < BLACK_HOLE_BSG_THRESHOLD) continue;
    const { center, gravityRadius } = stats;
    const eventHorizon = gravityRadius * EVENT_HORIZON_FRACTION;

    const coreCell = pickCoreCell(cluster, center);
    if (!coreCell) continue;
    let ledger = ledgerOf(coreCell);
    let changed = false;

    for (const cell of world.entries()) {
      if (cell.material === BSG_MATERIAL) continue;
      if (cell.generatedByBlackHole) continue;
      if (cell.destructible === false) continue;
      if (isClaimProtected(claims, cell.x, cell.y, cell.z)) continue;
      if (cell.authorId && cell.authorId !== coreCell.authorId) continue;
      const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
      const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
      if (d > eventHorizon) continue;

      world.removeCell(cell.x, cell.y, cell.z);
      ledger = {
        ...ledger,
        consumedMatter: ledger.consumedMatter + 1,
        recentConsumptionTimes: [...ledger.recentConsumptionTimes, now].filter(
          (t) => now - t <= DAMPING_WINDOW_MS
        ),
      };
      changed = true;
    }

    if (changed) saveLedger(world, coreCell, ledger);
  }
}

export function applyAsymptoticGeneration(world, now = Date.now()) {
  const clusters = findClusters(world);
  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats) continue;
    const bsgCount = stats.bsgCells.length;
    if (bsgCount < BLACK_HOLE_BSG_THRESHOLD) continue;
    const { center, gravityRadius } = stats;

    const coreCell = pickCoreCell(cluster, center);
    if (!coreCell) continue;
    const ledger = ledgerOf(coreCell);

    const clusterKeys = new Set(cluster.map((c) => cellKey(c.x, c.y, c.z)));
    const [ccx, ccy, ccz] = [coreCell.x, coreCell.y, coreCell.z];

    const shellCap = Math.min(40, Math.ceil(gravityRadius) + 3);
    const candidates = cellsInShells(ccx, ccy, ccz, shellCap);
    let nearestForeignShell = Infinity;
    for (const cand of candidates) {
      if (cand.shell >= nearestForeignShell) break;
      const key = cellKey(cand.x, cand.y, cand.z);
      if (clusterKeys.has(key)) continue;
      if (world.has(cand.x, cand.y, cand.z)) {
        nearestForeignShell = cand.shell;
        break;
      }
    }
    if (nearestForeignShell === Infinity) continue; // nothing approaching yet -- no pressure, no generation

    const recentCount = ledger.recentConsumptionTimes.filter((t) => now - t <= DAMPING_WINDOW_MS).length;
    const dampingMultiplier = 1 + recentCount * DAMPING_FACTOR;

    let generatedThroughShell = ledger.generatedThroughShell;
    let totalGenerated = 0;
    for (const cand of candidates) {
      if (totalGenerated >= MAX_GENERATED_CELLS) break;
      if (cand.shell >= nearestForeignShell) break;
      const [wx, wy, wz] = cellToWorld(cand.x, cand.y, cand.z);
      if (Math.hypot(wx - center[0], wy - center[1], wz - center[2]) > gravityRadius) continue;
      const key = cellKey(cand.x, cand.y, cand.z);
      if (clusterKeys.has(key) || world.has(cand.x, cand.y, cand.z)) continue;

      const requiredLedger = shellCumulativeCost(cand.shell) * dampingMultiplier;
      if (ledger.consumedMatter < requiredLedger) continue;

      world.addCell(cand.x, cand.y, cand.z, { material: 'base', generatedByBlackHole: true });
      totalGenerated += 1;
      if (cand.shell > generatedThroughShell) generatedThroughShell = cand.shell;
    }

    if (totalGenerated > 0) {
      saveLedger(world, coreCell, { ...ledger, generatedThroughShell });
    }
  }
}

export function annotateBlackHoles(planetoids, world) {
  const clusters = findClusters(world);
  const out = { ...planetoids };
  for (const [id, planetoid] of Object.entries(out)) {
    if (!isBlackHole(planetoid)) continue;
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
    if (!cluster) continue;
    const stats = bsgClusterStats(cluster);
    const coreCell = pickCoreCell(cluster, stats.center);
    const ledger = coreCell ? ledgerOf(coreCell) : defaultLedger();
    out[id] = {
      ...planetoid,
      isBlackHole: true,
      consumedMatter: ledger.consumedMatter,
      generatedThroughShell: ledger.generatedThroughShell,
      generatedCellCount: cluster.filter((c) => c.generatedByBlackHole).length,
    };
  }
  return out;
}
