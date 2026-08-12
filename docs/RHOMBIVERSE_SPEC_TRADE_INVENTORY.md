# Rhombiverse — Spec Addendum: Inventory, Trade & Resource Decay

Standalone addendum. Extends `RHOMBIVERSE_SPEC_ASTEROIDS.md` (mining/acquisition, `playerInventory`) and is governed by `RHOMBIVERSE_PRINCIPLES.md` — the decay mechanic below is a direct reuse of the Adaptive Damping pattern (section 2) and the asteroid regeneration mechanic (`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4), not a new formula, per Grounded Simplicity (section 0).

---

## 1. Purpose

Defines how mined materials move from acquisition to use: transport (none needed), trade (direct barter), and how unused stockpiling is discouraged without an arbitrary, hard-to-compute cap.

---

## 2. Transport: Inventory-Only

- Mined materials enter `playerInventory` immediately on mining (`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 3) and are available for building from anywhere — no separate carrying/cargo mechanic, no vessels, no capacity-by-distance constraint.
- Chosen per Grounded Simplicity: no new system to design, build, or maintain; nothing here to go wrong.

---

## 3. Trade: Direct Barter

- Trade is a **direct, atomic exchange** between two players — each proposes an offer from their own inventory, both confirm, materials swap simultaneously. No partial trades, no intermediate holding state — either the full exchange completes or nothing happens (prevents scams by construction, not by moderation).
- No marketplace, currency, or listings system in this pass — barter only, the simplest form of trade that still functions, and the historically "truest" starting point for any economy (currency-based trade is a later refinement, not a prerequisite).

---

## 4. Resource Decay (Anti-Stockpiling)

**Rejected approach (for the record):** a hard cap based on "next planetoid cost + 20% of largest scale" was considered and set aside — it requires estimating a player's *future intended build* and referencing a moving "largest scale" value (ambiguous whether that's the player's own or the world's), making it hard to compute predictably or explain to a player looking at their own inventory. Not simple, not clearly truer than the alternative below.

**Chosen approach: decay, reusing the existing Adaptive Damping pattern directly.**

- Each material in `playerInventory` has a **flat, modest free-holding threshold** (same for everyone, per material type — simple, predictable, no per-player calculation).
- Quantity held **above** that threshold decays gradually over time if left unused — mirrors real material degradation/perishability, and reuses the exact volatility-decay shape already established in `RHOMBIVERSE_PRINCIPLES.md` section 2 and the asteroid node regeneration timer, rather than inventing a new formula.
- **Using/spending material resets its decay clock** for the amount used — decay only affects genuinely idle stockpiles, not materials actively cycling through active building.
- Decay rate is gentle enough not to punish normal play (gathering materials for a planetoid build in progress), but present enough that indefinitely hoarding far beyond any active use trends the stockpile back down over time — a "settling" behavior, not a punitive one, consistent with how Adaptive Damping is framed everywhere else in this project (it settles, it doesn't destroy).
- Exact threshold value and decay rate: implementation-tunable, not fixed by this spec — playtest to find values that feel like "gentle encouragement to use what you gather" rather than "penalty for saving up."

---

## 5. World-State Schema Extension

```json
{
  "playerInventory": {
    "userId_example": {
      "garnet": { "quantity": 40, "lastUsedAt": "ISO timestamp" },
      "blackstar-glassite": { "quantity": 2, "lastUsedAt": "ISO timestamp" }
    }
  },
  "pendingTrades": {
    "trade_1": {
      "playerA": "userId_example",
      "offerA": { "garnet": 10 },
      "playerB": "userId_other",
      "offerB": { "blackstar-glassite": 1 },
      "confirmedA": false,
      "confirmedB": false
    }
  }
}
```
- `lastUsedAt` drives the decay clock (section 4) — decay calculation only applies to quantity above the free threshold, measured from this timestamp.
- `pendingTrades` — atomic trade proposals; only resolves (swaps inventories) once both `confirmedA` and `confirmedB` are true; otherwise stays pending or can be cancelled by either party with no effect.

---

## 6. Isolation & Scope (per `RHOMBIVERSE_PRINCIPLES.md` section 1)

- Decay only ever affects the individual player's own inventory — never spreads to or affects any other player's holdings, world structures, or planetoids. Trivially self-contained; blast radius is exactly one player's inventory.
- A failed/cancelled trade leaves both players' inventories exactly as they were — no partial-state risk.

---

## 7. Success Checks

- [x] Mined materials are immediately usable from inventory anywhere in the world — no transport mechanic exists. Verified 2026-08-13 via a real two-session Shared World test: mining (right-click on an asteroid cell) credits inventory through `mine_asteroid_cell`, a server-authoritative RPC (unlike cells/claims, inventory is a currency-like resource — never directly writable by a client, only through this validated function or the trade-resolution trigger below).
- [x] Two players can propose, confirm, and complete a direct barter trade; the exchange is atomic (all-or-nothing). Verified 2026-08-13 two ways: direct SQL against a simulated auth context (garnet-for-ferrostone, exact correct quantities on both sides, plus an insufficient-funds-at-resolution case that cancels with zero partial effect), and a full real-browser two-session run through the actual UI (propose → realtime delivery → confirm → confirm → atomic resolve → both sides' panels update, including the same-material edge case, which double-checks the resolution trigger doesn't double-count when a swap touches the same inventory row twice in one transaction).
- [x] Inventory quantity above the flat free threshold decays gradually if unused. Server-side via a `pg_cron` job every 5 minutes (`apply_inventory_decay`, same shape as `trade.js`'s own local-only version — reused, not reinvented). Verified via direct SQL: floors exactly at the threshold, decays the correct amount for elapsed time.
- [x] Spending/using material resets its decay clock for the amount used. Same behavior server-side as the local implementation (`resolve_trade_if_ready` sets `last_used_at = now()` only on the spending side, never the receiving side, matching `RHOMBIVERSE_SPEC_LOOPHOLES.md` section 1).
- [x] Decay never affects another player's inventory or any world structure — fully scoped to the individual holder. True by construction: `apply_inventory_decay` only ever updates the row it's iterating.

---

## 8. Claude Code Prompt (copy-paste to start this addendum)

> Implement Inventory, Trade & Resource Decay per `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`. Build on top of the existing `playerInventory` object from `RHOMBIVERSE_SPEC_ASTEROIDS.md`. Materials are usable immediately from inventory — no transport/cargo system. Implement direct atomic barter trade using the `pendingTrades` schema in section 5 — both parties must confirm before any inventory changes occur. Implement decay: a flat per-material free-holding threshold (choose and document specific values), with quantity above threshold decaying over time using the same decay-rate pattern already implemented for asteroid node regeneration and described in `RHOMBIVERSE_PRINCIPLES.md` section 2 — do not invent a new decay formula, reuse that pattern's shape. Using material resets its decay clock. Do not implement a marketplace, currency, or listings system in this pass — barter only.
