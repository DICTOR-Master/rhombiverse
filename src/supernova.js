// Supernova Threshold -- RHOMBIVERSE_SPEC_SUPERNOVA.md. "Reuses the
// containment pattern from RHOMBIVERSE_SPEC_BLACKHOLE.md directly... no
// new safety mechanism is invented here" (spec header) -- this file is
// deliberately thin, leaning on blackhole.js's and starsystem.js's
// already-built mechanics rather than duplicating them.
import { cellKey, cellToWorld, cellsInShells } from './lattice.js';
import { BSG_MATERIAL, findClusters, bsgClusterStats } from './gravity.js';
import { isStar, pickCoreCell, defaultLedger, STAR_BSG_THRESHOLD } from './starsystem.js';

// First-guess constants, not yet playtested -- same convention as every
// other tunable in this project. SUPERNOVA_CRITICAL_MASS is the star's
// own "Chandrasekhar-equivalent limit" (section 1): accumulated fusion
// mass (starLedger's own hydrogenConsumed+carbonConsumed -- section 2's
// explicit "extends the existing... ledger pattern... same shape, not a
// new field type", so this reuses starsystem.js's ledger directly rather
// than inventing a second one) that triggers detonation once reached.
export const SUPERNOVA_CRITICAL_MASS = 30;
const DAMPING_WINDOW_MS = 10000;
const DAMPING_FACTOR = 0.5; // marginal-threshold multiplier per recent fusion tick, same shape as blackhole.js's own damping
const SCATTER_MATERIAL = 'garnet'; // arbitrary "raw material" stand-in, not fixed by the spec

function accumulatedMass(ledger) {
  return ledger.hydrogenConsumed + ledger.carbonConsumed;
}

// Checks every star-classified cluster for whether it has crossed its
// (adaptively-damped) critical mass and, if so, detonates it exactly
// once (section 2: "below threshold... normal... at/past threshold...
// triggers a supernova event -- a single, bounded detonation"). Mutates
// `world` in place; safe to call every onChange like the other spec
// modules' apply* passes -- idempotent past detonation since
// applyStarFusion.js already stops accumulating further mass once
// `detonated` is set, and this function itself checks that flag before
// doing anything.
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
    // Section 2: "the closer accumulated mass gets to the limit, the more
    // costly/resistant further fueling becomes" -- reusing blackhole.js's
    // exact damping shape (scale up the required threshold with recent
    // activity) rather than inventing a second pattern.
    const effectiveThreshold = SUPERNOVA_CRITICAL_MASS * (1 + recentCount * DAMPING_FACTOR);
    if (accumulatedMass(ledger) < effectiveThreshold) continue;

    detonate(world, cluster, stats, coreCell, ledger);
  }
}

// Section 3's effects, in order: bounded blast radius (reuses gravityRadius,
// "same radius mechanic as planetoid gravity" -- the same convention
// blackhole.js already established), destructible-flag consent (same
// single-player-scoped interpretation as blackhole.js -- see that file's
// header for why: no accounts/Phase 5.8 yet, a single-player world's
// creator already owns everything, destructible:false is a real per-cell
// opt-out today), matter redistribution (removed cells are matched 1:1
// with new SCATTER_MATERIAL cells placed just beyond the blast radius,
// not simply deleted), and remnant (deliberately NO code here at all --
// the star's own BSG core cells are never touched by this function, only
// FOREIGN cells within the blast radius are, so if the core's bsgCount
// already meets blackhole.js's own BLACK_HOLE_BSG_THRESHOLD, the
// already-running applyBlackHoleConsumption/applyAsymptoticGeneration
// passes simply start treating it as a black hole on the very next
// onChange -- exactly "instantiate the existing Black Hole system... do
// not build a separate remnant mechanic," satisfied by NOT writing
// remnant-specific code rather than by writing some).
function detonate(world, cluster, stats, coreCell, ledger) {
  const { center, gravityRadius } = stats;
  const clusterKeys = new Set(cluster.map((c) => cellKey(c.x, c.y, c.z)));

  let scatterCount = 0;
  for (const cell of world.entries()) {
    if (clusterKeys.has(cellKey(cell.x, cell.y, cell.z))) continue; // never touches the star's own structure -- see remnant note above
    if (cell.destructible === false) continue;
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
      if (d <= gravityRadius) continue; // scatters BEYOND the blast radius, into "nearby unclaimed space" (section 3)
      const key = cellKey(cand.x, cand.y, cand.z);
      if (clusterKeys.has(key) || world.has(cand.x, cand.y, cand.z)) continue;
      world.addCell(cand.x, cand.y, cand.z, { material: SCATTER_MATERIAL, supernovaScattered: true });
      placed += 1;
    }
  }

  const { x, y, z, ...data } = coreCell;
  world.addCell(x, y, z, { ...data, starLedger: { ...ledger, detonated: true } });
}

// Read-only summary for UI/tests, same pattern as the other spec
// modules' annotate* functions.
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
