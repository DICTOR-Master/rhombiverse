// Load/save/serialize the world-state JSON (schema: RHOMBIVERSE_PLAN.md
// section 3), and an in-memory mutable store over it. Persistence to
// storage lives in persistence.js -- this module only tracks state in
// memory. Full design rationale/history for every export below:
// docs/code-notes/core/worldstate-core.md
import { cellKey, parseCellKey } from './lattice.js';

// Core vs. Modules boundary (RHOMBIVERSE_PLAN.md, 2026-08-23) used to
// have a claimIdAt integration point here too (render.js supplied the
// real one via setRegionsIntegration(), gated behind FEATURES.economy).
// Removed 2026-08-31 along with the claimId cell-stamping it only
// existed to feed (see addCell below). sculpture.js's own
// setRegionsIntegration() hook (same reasoning) was removed 2026-09-22,
// never having had a live caller; gravity.js's was archived along with
// the rest of that system the same day.

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load world from ${url}: ${res.status}`);
  }
  return res.json();
}

export function createWorldStore(worldJSON, hooks = {}) {
  let worldName = worldJSON.worldName;
  let version = worldJSON.version;
  let meta = { ...worldJSON.meta };
  const cells = new Map(Object.entries(worldJSON.cells));
  let claims = { ...(worldJSON.claims ?? {}) };
  let inventory = { ...(worldJSON.playerInventory ?? {}) };
  let regrowthQueue = { ...(worldJSON.asteroidRegrowth ?? {}) };
  let pendingTrades = { ...(worldJSON.pendingTrades ?? {}) };
  // Memoized entries() copy -- a real perf bug found live (2026-08-24),
  // see notes. Invalidated (set back to null) by every mutator below and
  // by replaceAll; lazily rebuilt on the next read after that.
  let cellsEntriesCache = null;

  return {
    has(x, y, z) {
      return cells.has(cellKey(x, y, z));
    },
    addCell(x, y, z, data) {
      // gravitySource/gravityWeight and claimId used to be stamped here
      // too -- removed 2026-08-31 (RHOMBIVERSE_CLAUDE_CODE_IMPLEMENTATION_PLAN.md
      // section 3): gravity.js re-derives planetoid clusters from cell
      // `material` alone (never reads these), and nothing reads
      // `cell.claimId` back either -- claims are tracked entirely via the
      // `claims` map + claimIdAt(). Both were dead weight on every cell.
      // region/status are NOT included in that cleanup -- they're
      // documented schema-v1 fields (RHOMBIVERSE_PLAN.md section 3) for
      // moderation, and `status` is live-read for flagged/removed
      // rendering (render.js).
      const { gravitySource, gravityWeight, claimId, ...rest } = data;
      let stamped = rest;
      if (stamped.region === undefined) stamped = { ...stamped, region: 'open' };
      if (stamped.status === undefined) stamped = { ...stamped, status: 'pending' };
      cells.set(cellKey(x, y, z), stamped);
      cellsEntriesCache = null;
      hooks.onAdd?.(x, y, z, stamped);
    },
    removeCell(x, y, z) {
      cells.delete(cellKey(x, y, z));
      cellsEntriesCache = null;
      hooks.onRemove?.(x, y, z);
    },
    entries() {
      if (cellsEntriesCache === null) {
        cellsEntriesCache = Array.from(cells.entries()).map(([key, data]) => {
          const [x, y, z] = parseCellKey(key);
          return { x, y, z, ...data };
        });
      }
      return cellsEntriesCache;
    },
    getClaims() {
      return { ...claims };
    },
    addClaim(claimId, claimData) {
      claims = { ...claims, [claimId]: claimData };
    },
    getInventory() {
      return { ...inventory };
    },
    creditInventory(ownerId, material, amount = 1, now = Date.now()) {
      const current = inventory[ownerId] ?? {};
      const existing = current[material];
      const nextEntry = existing
        ? { quantity: existing.quantity + amount, lastUsedAt: existing.lastUsedAt }
        : { quantity: amount, lastUsedAt: now };
      inventory = { ...inventory, [ownerId]: { ...current, [material]: nextEntry } };
    },
    spendInventory(ownerId, material, amount, now = Date.now()) {
      const current = inventory[ownerId] ?? {};
      const existing = current[material];
      if (!existing || existing.quantity < amount) return false;
      inventory = {
        ...inventory,
        [ownerId]: { ...current, [material]: { quantity: existing.quantity - amount, lastUsedAt: now } },
      };
      return true;
    },
    setInventoryEntry(ownerId, material, entry) {
      const current = inventory[ownerId] ?? {};
      inventory = { ...inventory, [ownerId]: { ...current, [material]: entry } };
    },
    getPendingTrades() {
      return { ...pendingTrades };
    },
    setPendingTrade(tradeId, tradeData) {
      pendingTrades = { ...pendingTrades, [tradeId]: tradeData };
      hooks.onTradeSet?.(tradeId, tradeData);
    },
    removePendingTrade(tradeId) {
      const { [tradeId]: _removed, ...rest } = pendingTrades;
      pendingTrades = rest;
      hooks.onTradeClear?.(tradeId);
    },
    getRegrowthQueue() {
      return { ...regrowthQueue };
    },
    setRegrowthEntry(key, entry) {
      regrowthQueue = { ...regrowthQueue, [key]: entry };
      hooks.onRegrowthSet?.(key, entry);
    },
    removeRegrowthEntry(key) {
      const { [key]: _removed, ...rest } = regrowthQueue;
      regrowthQueue = rest;
      hooks.onRegrowthClear?.(key);
    },
    toJSON() {
      return {
        worldName,
        version,
        cells: Object.fromEntries(cells),
        claims,
        playerInventory: inventory,
        asteroidRegrowth: regrowthQueue,
        pendingTrades,
        meta: { ...meta, lastModified: new Date().toISOString() },
      };
    },
    replaceAll(newWorldJSON) {
      worldName = newWorldJSON.worldName;
      version = newWorldJSON.version;
      meta = { ...newWorldJSON.meta };
      claims = { ...(newWorldJSON.claims ?? {}) };
      inventory = { ...(newWorldJSON.playerInventory ?? {}) };
      regrowthQueue = { ...(newWorldJSON.asteroidRegrowth ?? {}) };
      pendingTrades = { ...(newWorldJSON.pendingTrades ?? {}) };
      cellsEntriesCache = null;
      cells.clear();
      for (const [key, data] of Object.entries(newWorldJSON.cells)) {
        cells.set(key, data);
      }
    },
  };
}
