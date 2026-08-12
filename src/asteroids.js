// Asteroid Belts (Resource Mining) -- RHOMBIVERSE_SPEC_ASTEROIDS.md.
// First pass, scoped to acquisition only per the spec's own Claude Code
// prompt ("do not implement crafting/conversion... this pass covers
// acquisition only"): world seeding, mining -> inventory, per-cell
// regeneration. Population-scaled spawning (section 5) is deliberately
// deferred -- see CLAUDE.md's asteroids status for why.
//
// Deviates from the spec's own section 6 JSON shape in one place, on
// purpose: no separate `asteroidBelts` registry storing belt/node
// structure. Belt/node geometry here is fully deterministic (fixed seed
// coordinates, not player-granted like claims), so it's expressed as
// plain module constants + a seeding function rather than mutable state
// that would need its own accessor methods for no real benefit -- an
// asteroid cell's own `asteroidNodeId` field (living in the normal
// world.cells map, same pattern as shellCenter/claimId) is enough to
// identify which node it belongs to. `playerInventory` and the regrowth
// queue ARE real top-level world-state, per the spec (worldstate.js).
import { cellKey, parseCellKey, cellsInShells, isValidCell } from './lattice.js';

const NODE_SHELL_RADIUS = 1; // "individual small clumps" -- 1 (center) + 12 (shell 1) = 13 cells/node

// Two starting belts (section 2), placed well outside regions.js's own
// claim-search range (MAX_CLAIM_SEARCH_SHELL=40, real distance under
// ~50 units) so belts and claims can never collide in this pass.
// RHOMBIVERSE_SPEC_LOOPHOLES.md section 4 (reserve pre-seeded content
// before claim allocation runs) is deliberately NOT built yet -- this
// distance is what makes deferring it safe for now, not a permanent fix.
const BELTS = [
  { id: 'belt_1', center: [80, 80, 0], nodeOffsets: [[0, 0, 0], [8, -8, 0], [-8, 8, 0]] },
  { id: 'belt_2', center: [-80, -80, 0], nodeOffsets: [[0, 0, 0], [8, -8, 0], [-8, 8, 0]] },
];

// Section 3's yield table, as relative weights -- first-guess/tunable
// like every other numeric constant in this project, not derived.
// Blackstar-Glassite is intentionally rare here; it remains freely
// placeable via the material dropdown elsewhere in the game (Build/Fill/
// Generate all already depend on that for the gravity/black-hole/star-
// system mechanics built earlier this session) -- this table governs
// what MINING an asteroid yields, not a restriction on where BSG can
// ever be placed. Read fully literally, section 3's "does not occur
// anywhere else in the world" would contradict every gravity-mechanic
// spec already built and tested; the yield-only reading is the one that
// doesn't regress them.
const YIELD_WEIGHTS = [
  ['base', 35],
  ['garnet', 25],
  ['ferrostone', 20],
  ['glassite', 8],
  ['star-glassite', 5],
  ['blackstar-glassite', 2],
];

// 30s -- first-guess, fast enough to observe/test without waiting
// minutes; not playtested, same convention as every other timing
// constant in this project (blackhole.js's DAMPING_WINDOW_MS, etc.).
const REGEN_COOLDOWN_MS = 30000;

function weightedMaterial() {
  const total = YIELD_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [material, w] of YIELD_WEIGHTS) {
    if (r < w) return material;
    r -= w;
  }
  return YIELD_WEIGHTS[0][0];
}

// Places the two starting belts' cells directly into world.cells, tagged
// with asteroidNodeId. Idempotent: only seeds if NO asteroid cells exist
// yet anywhere (checked once, cheaply, via world.entries()) -- safe to
// call unconditionally on every init()/enableSharedWorld() without
// re-seeding or duplicating belts on a later load/reconnect. Never
// overwrites a cell that's already there for any reason.
export function seedAsteroidBelts(world) {
  const alreadySeeded = world.entries().some((c) => c.asteroidNodeId);
  if (alreadySeeded) return;

  for (const belt of BELTS) {
    belt.nodeOffsets.forEach((offset, i) => {
      const ncx = belt.center[0] + offset[0];
      const ncy = belt.center[1] + offset[1];
      const ncz = belt.center[2] + offset[2];
      if (!isValidCell(ncx, ncy, ncz)) return;
      const id = `${belt.id}_node_${i}`;
      const footprint = [
        { x: ncx, y: ncy, z: ncz },
        ...cellsInShells(ncx, ncy, ncz, NODE_SHELL_RADIUS),
      ];
      for (const { x, y, z } of footprint) {
        if (world.has(x, y, z)) continue;
        world.addCell(x, y, z, { material: weightedMaterial(), asteroidNodeId: id });
      }
    });
  }
}

// Mining: removes the cell (reuses the exact same world.removeCell every
// other delete path already uses), credits the miner's inventory if they
// have a real identity (local single-player play has none -- the mining
// mechanic itself still works there, only inventory bookkeeping is
// skipped), and registers the position for regrowth. `cell` is whatever
// build.js's raycast controller already resolved -- no re-fetch needed.
export function mineAsteroidCell(world, cell, ownerId, now = Date.now()) {
  world.removeCell(cell.x, cell.y, cell.z);
  world.setRegrowthEntry(cellKey(cell.x, cell.y, cell.z), {
    nodeId: cell.asteroidNodeId,
    material: cell.material,
    minedAt: now,
  });
  if (ownerId) world.creditInventory(ownerId, cell.material, 1);
}

// Per-node regrowth (section 4): each pending-regrowth entry becomes a
// real cell again once REGEN_COOLDOWN_MS has passed, cell by cell (not
// whole-node-at-once) -- entries regrow independently since each has its
// own minedAt timestamp, giving exactly the "heavily mined node regrows
// gradually" behavior the spec asks for with no extra bookkeeping. Skips
// (and permanently drops) an entry if a player has since built something
// else at that exact position -- never overwrites real player content,
// matching Isolation (asteroid mechanics never disturb player builds).
export function applyAsteroidRegeneration(world, now = Date.now()) {
  const queue = world.getRegrowthQueue();
  for (const [key, entry] of Object.entries(queue)) {
    if (now - entry.minedAt < REGEN_COOLDOWN_MS) continue;
    world.removeRegrowthEntry(key);
    const [x, y, z] = parseCellKey(key);
    if (world.has(x, y, z)) continue;
    world.addCell(x, y, z, { material: entry.material, asteroidNodeId: entry.nodeId });
  }
}
