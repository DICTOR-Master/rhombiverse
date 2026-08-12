// Inventory, Trade & Resource Decay -- RHOMBIVERSE_SPEC_TRADE_INVENTORY.md.
// First pass: decay + full trade data model/resolution logic, all
// verified via direct execution. Deliberately NOT wired to Supabase sync
// or a UI yet -- matches regions.js's own "data layer first" start,
// which later got sync/UI/a destructible toggle across separate
// follow-up passes.
//
// "Using material" (section 4's decay-clock reset) has exactly one real
// meaning in this implementation: completing a trade that spends it.
// Building remains completely free/inventory-independent, per the
// still-standing deferral in RHOMBIVERSE_SPEC_ASTEROIDS.md's own Claude
// Code prompt ("do not implement... planetoid-building consumption of
// inventory in this pass") -- nothing in THIS spec's own prompt reverses
// that, so it stays deferred, not silently assumed.

// Section 4's flat, per-material free-holding thresholds -- first-guess/
// tunable like every other numeric constant in this project, roughly
// scaled to RHOMBIVERSE_SPEC_ASTEROIDS.md's own yield rarity (common
// materials get a bigger free pile before decay kicks in, rare ones
// smaller -- decay pressure should track scarcity, not be uniform).
const FREE_THRESHOLDS = {
  base: 30,
  garnet: 20,
  ferrostone: 15,
  glassite: 8,
  'star-glassite': 5,
  'blackstar-glassite': 2,
};
const DEFAULT_FREE_THRESHOLD = 10; // any material not in the table above

// Reuses asteroids.js's own regrowth-cooldown SHAPE exactly (a periodic
// check, discrete decrement once idle time exceeds a fixed tick) per the
// spec's explicit "do not invent a new decay formula, reuse [the
// asteroid regeneration] pattern's shape" instruction. Not literally
// importing a shared constant (asteroids.js doesn't export one -- its
// own REGEN_COOLDOWN_MS is internal), but matching its value
// intentionally, not coincidentally.
const DECAY_TICK_MS = 30000;
const DECAY_AMOUNT_PER_TICK = 1;

function freeThreshold(material) {
  return FREE_THRESHOLDS[material] ?? DEFAULT_FREE_THRESHOLD;
}

// Section 4: quantity above the free threshold decays
// DECAY_AMOUNT_PER_TICK for every DECAY_TICK_MS of inactivity
// (lastUsedAt unchanged since) -- gentle and bounded, never decays below
// the threshold itself (a "settling" floor, not a punitive drain toward
// zero, per RHOMBIVERSE_PRINCIPLES.md section 2's own framing: Adaptive
// Damping settles, it doesn't destroy). Advances lastUsedAt by whole
// ticks actually consumed (not resetting to `now`) so multiple elapsed
// intervals caught in one check each apply correctly -- same catch-up
// shape asteroids.js's regrowth queue already uses.
export function applyInventoryDecay(world, now = Date.now()) {
  const inventory = world.getInventory();
  for (const [ownerId, materials] of Object.entries(inventory)) {
    for (const [material, entry] of Object.entries(materials)) {
      const threshold = freeThreshold(material);
      if (entry.quantity <= threshold) continue;
      const elapsedTicks = Math.floor((now - entry.lastUsedAt) / DECAY_TICK_MS);
      if (elapsedTicks <= 0) continue;
      const maxDecayable = entry.quantity - threshold;
      const decayAmount = Math.min(maxDecayable, elapsedTicks * DECAY_AMOUNT_PER_TICK);
      const ticksApplied = Math.ceil(decayAmount / DECAY_AMOUNT_PER_TICK);
      world.setInventoryEntry(ownerId, material, {
        quantity: entry.quantity - decayAmount,
        lastUsedAt: entry.lastUsedAt + ticksApplied * DECAY_TICK_MS,
      });
    }
  }
}

function hasSufficientOffer(world, playerId, offer) {
  const inv = world.getInventory()[playerId] ?? {};
  return Object.entries(offer).every(([material, amount]) => (inv[material]?.quantity ?? 0) >= amount);
}

// Section 3: "each proposes an offer from their own inventory." Rejects
// up front if the proposer can't currently afford their own offer -- a
// friendly fail-fast check, not the only guarantee (resolveTrade
// re-checks BOTH sides at the moment of actual resolution, since
// inventory can change between proposal and both confirmations -- see
// its own comment). tradeId is the caller's choice, matching claims'
// own id-ownership split between regions.js and its caller.
export function proposeTrade(world, tradeId, playerA, offerA, playerB, offerB) {
  if (!hasSufficientOffer(world, playerA, offerA)) {
    throw new Error('You do not have enough material for this offer.');
  }
  world.setPendingTrade(tradeId, {
    playerA,
    offerA,
    playerB,
    offerB,
    confirmedA: false,
    confirmedB: false,
  });
}

// Section 3: "either the full exchange completes or nothing happens."
// Re-verifies BOTH sides can still afford their own offer at the moment
// of resolution (inventory may have changed since proposal -- spent in
// another trade, or decayed) -- section 6's "no partial-state risk"
// means a trade that can no longer be honored must cancel cleanly
// rather than partially execute or leave either side short. Spending
// resets each spender's OWN decay clock (worldstate.js's
// spendInventory); crediting the receiver does NOT reset theirs
// (creditInventory's own behavior) -- together this is exactly
// RHOMBIVERSE_SPEC_LOOPHOLES.md section 1's "trade receipt never resets
// decay on its own," satisfied by reusing the two existing primitives
// correctly rather than a special case here.
function resolveTrade(world, tradeId, trade) {
  if (!hasSufficientOffer(world, trade.playerA, trade.offerA) || !hasSufficientOffer(world, trade.playerB, trade.offerB)) {
    world.removePendingTrade(tradeId);
    return false;
  }
  const now = Date.now();
  for (const [material, amount] of Object.entries(trade.offerA)) {
    world.spendInventory(trade.playerA, material, amount, now);
    world.creditInventory(trade.playerB, material, amount, now);
  }
  for (const [material, amount] of Object.entries(trade.offerB)) {
    world.spendInventory(trade.playerB, material, amount, now);
    world.creditInventory(trade.playerA, material, amount, now);
  }
  world.removePendingTrade(tradeId);
  return true;
}

// Marks one party's confirmation and resolves the trade the moment BOTH
// are true -- "no partial trades, no intermediate holding state" (section
// 3) is satisfied structurally: nothing about either player's inventory
// ever changes until this exact instant, and it changes completely, in
// one pass, or the trade is dropped by resolveTrade above. A caller
// confirming for a playerId that isn't actually a party to this trade is
// silently ignored, not an error -- matches removeCell/removeRegrowthEntry's
// own "acting on something not there is a safe no-op" convention.
export function confirmTrade(world, tradeId, playerId) {
  const trade = world.getPendingTrades()[tradeId];
  if (!trade) return;
  const updated = { ...trade };
  if (playerId === trade.playerA) updated.confirmedA = true;
  else if (playerId === trade.playerB) updated.confirmedB = true;
  else return;
  world.setPendingTrade(tradeId, updated);
  if (updated.confirmedA && updated.confirmedB) resolveTrade(world, tradeId, updated);
}

// Section 6: "a failed/cancelled trade leaves both players' inventories
// exactly as they were" -- true by construction, since a pending trade
// never touches inventory at all until both-confirmed resolution;
// cancelling before that point is just discarding the proposal.
export function cancelTrade(world, tradeId) {
  world.removePendingTrade(tradeId);
}
