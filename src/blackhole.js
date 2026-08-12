// Black Hole (Asymptotic Containment) -- RHOMBIVERSE_SPEC_BLACKHOLE.md.
// "Black hole = extreme case of the same gravity-source mechanic" (the
// spec's own section 3 framing, mirrored by Star System's identical
// "large-scale BSG, not a new material" move) -- there is no new
// material or object type here. A cluster becomes a black hole once its
// BSG mass crosses BLACK_HOLE_BSG_THRESHOLD; below that, it is an
// ordinary planetoid (gravity.js) and none of this file's logic applies.
//
// SCOPED FOR SINGLE-PLAYER (2026-08-11, direct instruction), UPDATED
// 2026-08-12 once Shared World (Phase 5) made cross-player consumption a
// LIVE possibility rather than a hypothetical. The spec's section 4 full
// consent/region-ownership model still depends on Phase 5.8, not built
// here -- but per direct instruction ("not possible at all for one
// player's black hole to swallow another's built work"), an absolute,
// unconditional guard was added below: any foreign cell with a real
// `authorId` (stamped by sync.js from Supabase's own auth.uid()-backed
// `author_id` column) that doesn't match this black hole's own core
// creator is skipped, full stop -- not an opt-in via `destructible`, no
// exceptions. This is narrower than Phase 5.8's eventual region/claim
// system (no shared-ownership regions, no explicit consent grants
// between specific players) but it is a hard floor: cross-player
// consumption is categorically impossible regardless of what Phase 5.8
// eventually adds on top. `destructible: false` remains the finer-
// grained, OPT-IN escape hatch for protecting specific cells of your OWN
// build from your OWN black hole (unaffected by the authorId guard,
// which only ever concerns OTHER players' cells).
import { shellCount, cellKey, cellToWorld, cellsInShells } from './lattice.js';
import { BSG_MATERIAL, findClusters, bsgClusterStats } from './gravity.js';
import { isClaimProtected } from './regions.js';

// First-guess constants, not yet playtested -- same "flag it, don't
// silently invent tuning math" convention this project already follows
// (build.js's roundStructure TOLERANCE, gravity.js's BASE_GRAVITY_RADIUS).
export const BLACK_HOLE_BSG_THRESHOLD = 20; // BSG cells needed before a cluster counts as a black hole rather than an ordinary planetoid
export const MAX_GENERATED_CELLS = 2000; // explicit finite cap on asymptotic buffer cells per black hole (section 2's "computability caveat")
const EVENT_HORIZON_FRACTION = 0.15; // fraction of gravityRadius treated as the automatic-consumption zone
const DAMPING_WINDOW_MS = 10000; // recent-consumption window for adaptive damping (section 5)
const DAMPING_FACTOR = 0.5; // marginal cost multiplier per consumption event inside the window

export function isBlackHole(planetoid) {
  return planetoid.bsgCount >= BLACK_HOLE_BSG_THRESHOLD;
}

// Cumulative shellCount(1..n) -- section 3: "generating space at shell n
// requires cumulative consumed-matter currency proportional to shells 1
// through n."
export function shellCumulativeCost(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) total += shellCount(i);
  return total;
}

function defaultLedger() {
  return { consumedMatter: 0, generatedThroughShell: 0, recentConsumptionTimes: [] };
}

// Sticky core-cell selection: once a cluster has an established ledger on
// one of its BSG cells, keep using that same cell so consumedMatter/
// generatedThroughShell survive centerOfMass drifting slightly as the
// cluster grows -- only pick a fresh core (nearest BSG cell to
// centerOfMass, ties broken by cellKey for determinism) the first time a
// cluster crosses the black-hole threshold.
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

// Consumption: any foreign (non-BSG, non-generated-buffer) cell within
// the event horizon of a black-hole-classified cluster is absorbed --
// removed from the world and its mass credited to that black hole's
// ledger, funding future space generation (section 3). Excludes cells
// with `destructible: false` (this repo's single-player stand-in for the
// spec's region consent flag -- see file header) and cells already
// tagged `generatedByBlackHole` (so a black hole can't refund itself by
// "consuming" the buffer it just generated). Mutates `world` in place;
// safe to call on every world change like hydrosphere.js's
// applyHydrosphere -- idempotent once nothing foreign remains in range.
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
      // RHOMBIVERSE_SPEC_REGIONS.md section 4: destructible now also
      // resolves via the cell's claim (if any), additively with the
      // per-cell field just above.
      if (isClaimProtected(claims, cell.x, cell.y, cell.z)) continue;
      // Absolute cross-player guard, per direct instruction (2026-08-12):
      // a foreign cell with a real authorId that differs from this black
      // hole's own core creator is NEVER consumable, full stop -- not an
      // opt-in via destructible, unconditional. A cell with no authorId
      // (local-only play, the static seed, presets, anything that never
      // went through sync.js) has nothing to protect it FROM here, same
      // as before this check existed -- fully backward compatible.
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

// Asymptotic space generation: backfills empty lattice cells between a
// black hole's center and the nearest foreign structure with
// `generatedByBlackHole` buffer cells, funded by the ledger consumption
// built above -- section 2's "as any entity or structure approaches...
// procedurally inserts additional lattice cells." A structure "gets
// closer" in this discrete, structure-based sense (building nearer to
// center), not continuous real-time motion -- deliberately not hooked
// into player.js's per-frame walk loop, since that would generate real
// InstancedMesh cells every frame while merely standing still and isn't
// needed for the mechanic's actual purpose (funding-gated containment).
// Never fills a shell that already contains a real foreign cell (can't
// overwrite existing builds), never extends past the nearest foreign
// structure's own shell (only fills the gap, so "how much space exists
// between you and the center" is what grows, not the black hole eating
// outward on its own with nobody approaching), never exceeds
// gravityRadius (section 4's bounded blast radius), and never exceeds
// MAX_GENERATED_CELLS (section 2's finite computability cap). Adaptive
// damping (section 5): the ledger balance required to fund shell n scales
// up with how many consumption events happened in the last
// DAMPING_WINDOW_MS, so a black hole absorbing matter fast becomes
// progressively costlier to keep extending rather than easier.
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

    // Nearest shell (BFS distance from the core cell) that holds a real,
    // foreign (not part of this cluster) built cell -- generation must
    // never reach or pass it. Shell cap derived from gravityRadius itself
    // (every shell is at least ~1 world unit further out, so this is a
    // generous, cheap-to-compute upper bound) rather than an arbitrary
    // large constant -- BFS candidate count grows with shell^2, so an
    // unbounded/oversized cap here would be a real per-onChange perf cost.
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
      if (cand.shell >= nearestForeignShell) break; // never fill into/past the approaching structure
      const [wx, wy, wz] = cellToWorld(cand.x, cand.y, cand.z);
      if (Math.hypot(wx - center[0], wy - center[1], wz - center[2]) > gravityRadius) continue; // bounded radius (section 4)
      const key = cellKey(cand.x, cand.y, cand.z);
      if (clusterKeys.has(key) || world.has(cand.x, cand.y, cand.z)) continue;

      const requiredLedger = shellCumulativeCost(cand.shell) * dampingMultiplier;
      if (ledger.consumedMatter < requiredLedger) continue; // insufficient ledger -- generation halts here (section 6)

      world.addCell(cand.x, cand.y, cand.z, { material: 'base', generatedByBlackHole: true });
      totalGenerated += 1;
      if (cand.shell > generatedThroughShell) generatedThroughShell = cand.shell;
    }

    if (totalGenerated > 0) {
      saveLedger(world, coreCell, { ...ledger, generatedThroughShell });
    }
  }
}

// Read-only summary for UI/tests: attaches black-hole ledger state onto
// the matching planetoid record computePlanetoids already returned (by
// centerOfMass, since both derive from the same clusters in the same
// world state within one render.js onChange pass). Returns a NEW object
// -- does not mutate the passed-in planetoids.
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
