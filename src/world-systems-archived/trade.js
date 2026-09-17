// Inventory, Trade & Resource Decay -- RHOMBIVERSE_SPEC_TRADE_INVENTORY.md.
// Full design rationale/history: docs/code-notes/world-systems/trade.md

const FREE_THRESHOLDS = {
  base: 30,
  garnet: 20,
  ferrostone: 15,
  glassite: 8,
  'star-glassite': 5,
  'blackstar-glassite': 2,
};
const DEFAULT_FREE_THRESHOLD = 10; // any material not in the table above

const DECAY_TICK_MS = 30000;
const DECAY_AMOUNT_PER_TICK = 1;

function freeThreshold(material) {
  return FREE_THRESHOLDS[material] ?? DEFAULT_FREE_THRESHOLD;
}

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

// A confirming playerId that isn't actually a party to this trade is
// silently ignored, not an error.
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

export function cancelTrade(world, tradeId) {
  world.removePendingTrade(tradeId);
}
