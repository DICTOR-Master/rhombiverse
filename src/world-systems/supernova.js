// Supernova Threshold -- RHOMBIVERSE_SPEC_SUPERNOVA.md.
// Full design rationale/history: docs/code-notes/world-systems/supernova.md
import { cellKey, cellToWorld, cellsInShells } from '../core/lattice.js';
import { BSG_MATERIAL, findClusters, bsgClusterStats } from '../geometry-extensions/gravity.js';
import { isStar, pickCoreCell, defaultLedger, STAR_BSG_THRESHOLD } from './starsystem.js';
import { isClaimProtected } from './regions.js';

export const SUPERNOVA_CRITICAL_MASS = 30;
const DAMPING_WINDOW_MS = 10000;
const DAMPING_FACTOR = 0.5;
const SCATTER_MATERIAL = 'garnet';

function accumulatedMass(ledger) {
  return ledger.hydrogenConsumed + ledger.carbonConsumed;
}

export function applyDetonationCheck(world, now = Date.now()) {
  const clusters = findClusters(world);
  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats || stats.bsgCells.length < STAR_BSG_THRESHOLD) continue;

    const coreCell = pickCoreCell(cluster, stats.center);
    if (!coreCell) continue;
    const ledger = coreCell.starLedger ?? defaultLedger();
    if (ledger.detonated) continue;

    const recentCount = ledger.recentFusionTimes.filter((t) => now - t <= DAMPING_WINDOW_MS).length;
    const effectiveThreshold = SUPERNOVA_CRITICAL_MASS * (1 + recentCount * DAMPING_FACTOR);
    if (accumulatedMass(ledger) < effectiveThreshold) continue;

    detonate(world, cluster, stats, coreCell, ledger);
  }
}

function detonate(world, cluster, stats, coreCell, ledger) {
  const { center, gravityRadius } = stats;
  const clusterKeys = new Set(cluster.map((c) => cellKey(c.x, c.y, c.z)));
  const claims = world.getClaims();

  let scatterCount = 0;
  for (const cell of world.entries()) {
    if (clusterKeys.has(cellKey(cell.x, cell.y, cell.z))) continue;
    if (cell.destructible === false) continue;
    if (isClaimProtected(claims, cell.x, cell.y, cell.z)) continue;
    if (cell.authorId && cell.authorId !== coreCell.authorId) continue;
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    if (Math.hypot(wx - center[0], wy - center[1], wz - center[2]) > gravityRadius) continue;

    world.removeCell(cell.x, cell.y, cell.z);
    scatterCount += 1;
  }

  if (scatterCount > 0) {
    const [ccx, ccy, ccz] = [coreCell.x, coreCell.y, coreCell.z];
    const shellCap = Math.min(40, Math.ceil(gravityRadius) + 6);
    const candidates = cellsInShells(ccx, ccy, ccz, shellCap);
    let placed = 0;
    for (const cand of candidates) {
      if (placed >= scatterCount) break;
      const [wx, wy, wz] = cellToWorld(cand.x, cand.y, cand.z);
      const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
      if (d <= gravityRadius) continue;
      const key = cellKey(cand.x, cand.y, cand.z);
      if (clusterKeys.has(key) || world.has(cand.x, cand.y, cand.z)) continue;
      world.addCell(cand.x, cand.y, cand.z, { material: SCATTER_MATERIAL, supernovaScattered: true });
      placed += 1;
    }
  }

  const { x, y, z, ...data } = coreCell;
  world.addCell(x, y, z, { ...data, starLedger: { ...ledger, detonated: true } });
}

export function annotateSupernovae(planetoids) {
  const out = { ...planetoids };
  for (const [id, planetoid] of Object.entries(out)) {
    if (!planetoid.isStar) continue;
    out[id] = {
      ...planetoid,
      supernovaCriticalMass: SUPERNOVA_CRITICAL_MASS,
      detonated: !!planetoid.detonated,
      isBlackHoleRemnant: !!planetoid.detonated && !!planetoid.isBlackHole,
    };
  }
  return out;
}
