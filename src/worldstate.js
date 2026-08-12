// Load/save/serialize the world-state JSON (schema: RHOMBIVERSE_PLAN.md
// section 3), and an in-memory mutable store over it. Actually persisting
// to storage (localStorage) lives in persistence.js -- this module only
// tracks state in memory and knows how to turn it back into JSON.
import { cellKey, parseCellKey } from './lattice.js';
import { claimIdAt } from './regions.js';

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load world from ${url}: ${res.status}`);
  }
  return res.json();
}

// Wraps a loaded world JSON's `cells` map in a Map keyed the same way
// ("x,y,z"), with add/remove/has by coordinate and a stable-order
// entries() list for rendering. The store is a single long-lived object
// (render.js holds one reference for the whole session) -- replaceAll
// mutates it in place rather than requiring callers to swap to a new
// store, so existing closures (build.js's controller, etc.) keep working
// after a "New World" reset or a JSON import.
// hooks.onAdd(x,y,z,data)/onRemove(x,y,z), both optional, fire at the end
// of every addCell/removeCell call -- every mutation path in the app
// (build.js's click handlers, recolorShell/removeShell, and every
// apply*() derived-mechanic module) goes through these two methods, so
// this is the single point sync.js (Phase 5) needs to hook to push local
// changes to the shared backend, without worldstate.js knowing anything
// about Supabase/realtime itself. Deliberately NOT called by replaceAll
// -- a bulk local-view swap (Undo, New World, Import, Load preset) is a
// personal reset, not a real edit, and must never bulk-push/delete
// against a shared world (render.js additionally disables those controls
// entirely while Shared World sync is active, since replaceAll bypassing
// these hooks means they'd otherwise silently desync the shared view).
export function createWorldStore(worldJSON, hooks = {}) {
  let worldName = worldJSON.worldName;
  let version = worldJSON.version;
  let meta = { ...worldJSON.meta };
  const cells = new Map(Object.entries(worldJSON.cells));
  // RHOMBIVERSE_SPEC_REGIONS.md's `claims` registry -- the first addendum
  // to need a genuinely new TOP-LEVEL world-state key rather than just
  // new per-cell fields (every prior addendum -- shell/shellCenter,
  // gravitySource, blackHoleLedger, starLedger -- fit entirely inside
  // existing cells). `?? {}` so JSON from before this existed still loads.
  let claims = { ...(worldJSON.claims ?? {}) };
  // RHOMBIVERSE_SPEC_ASTEROIDS.md: playerInventory is the spec's own
  // top-level schema key (section 6), keyed by ownerId then material.
  // asteroidRegrowth is NOT in the spec's own schema -- it's this
  // implementation's bookkeeping for section 4's per-cell regrowth timer
  // (asteroids.js keeps mined-cell material/nodeId/timestamp here rather
  // than embedding it in a separate asteroidBelts registry, since node
  // geometry itself is fully deterministic/hardcoded, not player-granted
  // like claims -- see asteroids.js's own header for the full reasoning).
  let inventory = { ...(worldJSON.playerInventory ?? {}) };
  let regrowthQueue = { ...(worldJSON.asteroidRegrowth ?? {}) };
  // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 5's own top-level schema
  // key -- atomic barter proposals, resolved (or left pending/cancelled)
  // by trade.js. `?? {}` so JSON from before this existed still loads.
  let pendingTrades = { ...(worldJSON.pendingTrades ?? {}) };

  return {
    has(x, y, z) {
      return cells.has(cellKey(x, y, z));
    },
    // Stamps gravitySource/gravityWeight per the schema in
    // RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md section 5, for any cell whose
    // material is Blackstar-Glassite (and strips them otherwise, e.g. on
    // recolor away from it). These fields are NOT load-bearing --
    // gravity.js treats `material` as ground truth so worlds imported
    // from an older export (without these fields) still work correctly --
    // they exist for schema-compliance / future external tooling only.
    addCell(x, y, z, data) {
      const { gravitySource, gravityWeight, ...rest } = data;
      let stamped =
        data.material === 'blackstar-glassite'
          ? { ...rest, gravitySource: true, gravityWeight: gravityWeight ?? 1.0 }
          : rest;
      // Phase 5.8 moderation fields (RHOMBIVERSE_PLAN.md section 3 / Phase
      // 5.8): schema-ready on every cell, defaulted only when genuinely
      // absent -- an existing cell's own data (spread in via ...data by
      // every caller that re-adds a cell, e.g. recolor, hydrosphere,
      // black hole/star mechanics) already carries its real values here,
      // so this only ever stamps brand-new cells. `region` defaults to
      // 'open'/`status` to 'pending' per the plan's own "new builds
      // default to open/pending until reviewed" -- curated content
      // (data/starter-world.json, data/presets/*.json) sets 'core'/
      // 'approved' explicitly in its own JSON and bypasses this entirely
      // via replaceAll(), so it's never touched here.
      if (stamped.region === undefined) stamped = { ...stamped, region: 'open' };
      if (stamped.status === undefined) stamped = { ...stamped, status: 'pending' };
      // RHOMBIVERSE_SPEC_REGIONS.md: claimId is decided once, at creation
      // time, against whatever claims exist right now -- same "only stamp
      // if genuinely absent" rule as region/status above, so an existing
      // cell's real claimId (from before this run, or from a claim
      // granted after it was built) is never silently overwritten. A
      // later claim never retroactively annexes already-placed cells --
      // matches regions.js's own Isolation guarantee (allocation only
      // ever reads existing state, never touches it).
      if (stamped.claimId === undefined) {
        stamped = { ...stamped, claimId: claimIdAt(claims, x, y, z) };
      }
      cells.set(cellKey(x, y, z), stamped);
      hooks.onAdd?.(x, y, z, stamped);
    },
    removeCell(x, y, z) {
      cells.delete(cellKey(x, y, z));
      hooks.onRemove?.(x, y, z);
    },
    entries() {
      return Array.from(cells.entries()).map(([key, data]) => {
        const [x, y, z] = parseCellKey(key);
        return { x, y, z, ...data };
      });
    },
    // Read-only view of the claims registry -- regions.js's allocation
    // algorithm and claimIdAt() both read this to know what's already
    // granted. Returns a shallow copy so callers can't mutate it directly
    // (must go through addClaim, same defensive shape as entries()).
    getClaims() {
      return { ...claims };
    },
    // Grants a new claim or updates an existing one (id is the caller's
    // choice, not auto-generated here -- regions.js owns id generation).
    // Synced to Supabase like everything else -- see render.js's
    // enableSharedWorld/applyRemoteClaim and sync.js's pushClaim.
    addClaim(claimId, claimData) {
      claims = { ...claims, [claimId]: claimData };
    },
    // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 5: each material entry
    // is `{quantity, lastUsedAt}`, not a bare number -- lastUsedAt drives
    // trade.js's decay clock. Local-only for this first pass (see
    // CLAUDE.md's status) -- not yet synced to Supabase.
    getInventory() {
      return { ...inventory };
    },
    // Crediting (mining, or receiving via a completed trade) deliberately
    // does NOT reset lastUsedAt for a material the player already holds
    // -- only spending does (spendInventory below). This is exactly
    // RHOMBIVERSE_SPEC_LOOPHOLES.md section 1's own fix, satisfied by
    // construction rather than a special case: "trade receipt never
    // resets decay on its own... its decay clock continues from whenever
    // it was originally mined." A material the player has genuinely
    // never held before has no prior timestamp to preserve, so it starts
    // its own clock at `now` -- the only sensible baseline, not a
    // loophole (there's no existing decay state being reset away).
    creditInventory(ownerId, material, amount = 1, now = Date.now()) {
      const current = inventory[ownerId] ?? {};
      const existing = current[material];
      const nextEntry = existing
        ? { quantity: existing.quantity + amount, lastUsedAt: existing.lastUsedAt }
        : { quantity: amount, lastUsedAt: now };
      inventory = { ...inventory, [ownerId]: { ...current, [material]: nextEntry } };
    },
    // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 4: "using/spending
    // material resets its decay clock for the amount used" -- the one
    // real "use" event this implementation has is completing a trade
    // (see trade.js's own header for why building doesn't consume
    // inventory yet). Returns false without mutating anything if the
    // holder doesn't have enough -- callers must check this before
    // treating a spend as having happened, same "no partial-state risk"
    // guarantee trade resolution itself needs (section 6).
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
    // Direct setter for trade.js's decay pass, which computes the exact
    // resulting {quantity, lastUsedAt} itself (decay is neither a credit
    // nor a spend in the player-action sense -- see applyInventoryDecay).
    setInventoryEntry(ownerId, material, entry) {
      const current = inventory[ownerId] ?? {};
      inventory = { ...inventory, [ownerId]: { ...current, [material]: entry } };
    },
    // Pending barter proposals -- trade.js owns id generation and
    // resolution logic; this is just storage, same division of
    // responsibility as claims (regions.js) and the regrowth queue
    // (asteroids.js). hooks.onTradeSet/onTradeClear mirror the same
    // optional-hook pattern as onRegrowthSet/onRegrowthClear, for a
    // future Supabase sync pass.
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
    // Pending asteroid regrowth entries, keyed by "x,y,z" -- see
    // asteroids.js's mineAsteroidCell/applyAsteroidRegeneration.
    // hooks.onRegrowthSet(key,entry)/onRegrowthClear(key), both optional,
    // mirror onAdd/onRemove above -- the sync point sync.js's
    // pushRegrowthSet/pushRegrowthClear hook into (RHOMBIVERSE_SPEC_
    // ASTEROIDS.md section 4: any connected client should be able to
    // process a pending regrowth, not just whoever originally mined the
    // cell, who might disconnect before the cooldown elapses).
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
    // Serializes back to the full RHOMBIVERSE_PLAN.md section 3 shape,
    // for persistence.js to save/export.
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
    // Replaces the entire world in place (New World reset, JSON import).
    replaceAll(newWorldJSON) {
      worldName = newWorldJSON.worldName;
      version = newWorldJSON.version;
      meta = { ...newWorldJSON.meta };
      claims = { ...(newWorldJSON.claims ?? {}) };
      inventory = { ...(newWorldJSON.playerInventory ?? {}) };
      regrowthQueue = { ...(newWorldJSON.asteroidRegrowth ?? {}) };
      pendingTrades = { ...(newWorldJSON.pendingTrades ?? {}) };
      cells.clear();
      for (const [key, data] of Object.entries(newWorldJSON.cells)) {
        cells.set(key, data);
      }
    },
  };
}
