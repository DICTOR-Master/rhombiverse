// Asteroid Belts (Resource Mining) -- RHOMBIVERSE_SPEC_ASTEROIDS.md.
// Acquisition only (no crafting/conversion). Full rationale/history:
// docs/code-notes/game-systems/asteroids.md
import { cellKey, parseCellKey, cellsInShells, isValidCell } from '../core/lattice.js';

const NODE_SHELL_RADIUS = 1; // 1 (center) + 12 (shell 1) = 13 cells/node

const BELTS = [
  { id: 'belt_1', center: [80, 80, 0], nodeOffsets: [[0, 0, 0], [8, -8, 0], [-8, 8, 0]] },
  { id: 'belt_2', center: [-80, -80, 0], nodeOffsets: [[0, 0, 0], [8, -8, 0], [-8, 8, 0]] },
];

export function listBelts() {
  return BELTS.map((b) => ({ id: b.id, center: b.center }));
}

// First-guess yield weights, tunable -- see docs/code-notes/game-systems/asteroids.md
const YIELD_WEIGHTS = [
  ['base', 35],
  ['garnet', 25],
  ['ferrostone', 20],
  ['glassite', 8],
  ['star-glassite', 5],
  ['blackstar-glassite', 2],
];

const REGEN_COOLDOWN_MS = 30000; // first-guess, not playtested

function weightedMaterial() {
  const total = YIELD_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [material, w] of YIELD_WEIGHTS) {
    if (r < w) return material;
    r -= w;
  }
  return YIELD_WEIGHTS[0][0];
}

function seedNode(world, beltCenter, offset, id) {
  const ncx = beltCenter[0] + offset[0];
  const ncy = beltCenter[1] + offset[1];
  const ncz = beltCenter[2] + offset[2];
  if (!isValidCell(ncx, ncy, ncz)) return;
  const footprint = [{ x: ncx, y: ncy, z: ncz }, ...cellsInShells(ncx, ncy, ncz, NODE_SHELL_RADIUS)];
  for (const { x, y, z } of footprint) {
    if (world.has(x, y, z)) continue;
    world.addCell(x, y, z, { material: weightedMaterial(), asteroidNodeId: id });
  }
}

// Idempotent -- see docs/code-notes/game-systems/asteroids.md
export function seedAsteroidBelts(world) {
  const alreadySeeded = world.entries().some((c) => c.asteroidNodeId);
  if (alreadySeeded) return;

  for (const belt of BELTS) {
    belt.nodeOffsets.forEach((offset, i) => {
      seedNode(world, belt.center, offset, `${belt.id}_node_${i}`);
    });
  }
}

// Population-scaled spawning (section 5, Adaptive Damping) -- see
// docs/code-notes/game-systems/asteroids.md
const BASE_NODES_PER_BELT = 3;
const NODES_PER_ACTIVE_USER = 2;
const MAX_EXTRA_NODES_PER_BELT = 6;
const ACTIVITY_WINDOW_MS = 60 * 60 * 1000;
const NODE_SPACING = 20;
function extraNodeOffsets(count) {
  const offsets = [];
  let shell = 1;
  while (offsets.length < count) {
    for (const c of cellsInShells(0, 0, 0, shell, shell)) {
      offsets.push([c.x * NODE_SPACING, c.y * NODE_SPACING, c.z * NODE_SPACING]);
      if (offsets.length >= count) break;
    }
    shell++;
  }
  return offsets;
}

function activeUserCount(world, now) {
  const cutoff = now - ACTIVITY_WINDOW_MS;
  const active = new Set();
  for (const c of world.entries()) {
    if (c.authorId && c.updatedAtMs && c.updatedAtMs >= cutoff) active.add(c.authorId);
  }
  return active.size;
}

export function targetNodesPerBelt(world, now = Date.now()) {
  const extra = Math.min(MAX_EXTRA_NODES_PER_BELT, activeUserCount(world, now) * NODES_PER_ACTIVE_USER);
  return BASE_NODES_PER_BELT + extra;
}

// Purely additive -- see docs/code-notes/game-systems/asteroids.md
export function applyPopulationScaledSpawning(world, now = Date.now()) {
  const target = targetNodesPerBelt(world, now);
  if (target <= BASE_NODES_PER_BELT) return;
  const existingIds = new Set(world.entries().map((c) => c.asteroidNodeId).filter(Boolean));
  const offsets = extraNodeOffsets(MAX_EXTRA_NODES_PER_BELT);
  for (const belt of BELTS) {
    for (let i = BASE_NODES_PER_BELT; i < target; i++) {
      const id = `${belt.id}_node_${i}`;
      if (existingIds.has(id)) continue;
      seedNode(world, belt.center, offsets[i - BASE_NODES_PER_BELT], id);
    }
  }
}

export function mineAsteroidCell(world, cell, ownerId, now = Date.now()) {
  world.removeCell(cell.x, cell.y, cell.z);
  world.setRegrowthEntry(cellKey(cell.x, cell.y, cell.z), {
    nodeId: cell.asteroidNodeId,
    material: cell.material,
    minedAt: now,
  });
  if (ownerId) world.creditInventory(ownerId, cell.material, 1);
}

// Per-node regrowth (section 4) -- see docs/code-notes/game-systems/asteroids.md
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
