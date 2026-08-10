# Rhombiverse — Spec Addendum: Loophole Fixes

Standalone addendum. Patches specific gaps identified across `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`, `RHOMBIVERSE_SPEC_REGIONS.md`, `RHOMBIVERSE_SPEC_SUPERNOVA.md`, `RHOMBIVERSE_SPEC_BLACKHOLE.md`, and `RHOMBIVERSE_SPEC_ASTEROIDS.md`. Each fix reuses an existing pattern where possible, per Grounded Simplicity.

---

## 1. Decay-Reset Gaming

**Loophole:** "using material resets its decay clock" (`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 4) is exploitable — placing and immediately re-mining a block, or two accounts ping-ponging a trade, resets decay indefinitely without any real building happening.

**Fix:**
- Decay reset only triggers on **persistent placement** — a block must remain placed for a minimum dwell time before it counts as "used" and resets the clock. Immediate re-mining does not reset decay.
- **Trade receipt never resets decay on its own.** Receiving material via barter is treated as acquisition, not use — its decay clock continues from whenever it was originally mined, not reset by the trade.

---

## 2. Multi-Account Exploitation

**Loophole:** region claiming (`RHOMBIVERSE_SPEC_REGIONS.md`) and asteroid population-scaled spawning (`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 5) both assume one player = one identity. Fake/duplicate accounts could claim multiple regions or inflate perceived population to farm extra asteroid spawns.

**Fix (honest, partial):**
- **Spec-level mitigation:** one claim per verified account (`RHOMBIVERSE_SPEC_REGIONS.md`), and population-scaled spawning should key off some sanity-checked activity signal (e.g. recent building/mining actions), not raw concurrent-connection count, which is trivially inflated.
- **Explicit limit acknowledged:** no spec-level rule fully closes multi-accounting — genuine prevention requires platform-level account verification/rate-limiting, outside this document's scope. Stated here so it isn't silently assumed solved.

---

## 3. Supernova/Black Hole Matter Farming Loop

**Loophole:** as written, a player could deliberately trigger repeated supernovae or black-hole consumption purely to harvest the scattered/redistributed matter (`RHOMBIVERSE_SPEC_SUPERNOVA.md` section 3), effectively bypassing normal mining scarcity.

**Fix:**
- **Conservation rule, explicit:** matter redistribution from a supernova (or any future similar event) can never return more total mass than was consumed to cause it — net-neutral at best, after accounting for the resource cost of triggering the event in the first place (`RHOMBIVERSE_SPEC_BLACKHOLE.md` section 3's ledger-funding already implies this; this fix makes it an explicit, checked invariant rather than an implication).
- Since triggering these events already costs resources (ledger-funded per the black hole spec), and redistribution can't exceed what went in, repeated triggering is a wash at best, never a net resource gain — closing the farming incentive by construction.

---

## 4. Claim Allocation Overlapping Pre-Seeded Content

**Loophole:** region claim allocation (`RHOMBIVERSE_SPEC_REGIONS.md` section 2) expands outward shell-by-shell with no reservation for coordinates already used by the two starting asteroid belts or any star system.

**Fix:**
- Pre-seeded world content (asteroid belts, star system anchor) must be placed and reserved **before** the claim-allocation system begins granting shells, and their occupied coordinates marked as **non-allocatable** regardless of shell index.
- Claim allocation must skip any shell cells already reserved by pre-seeded content, continuing to the next available cell in shell order rather than overlapping it.

---

## 5. Gravity Pull vs. Destruction Consent Gap

**Loophole:** the `destructible` flag (`RHOMBIVERSE_SPEC_BLACKHOLE.md`, `RHOMBIVERSE_SPEC_SUPERNOVA.md`) governs whether a hazard can *destroy/convert another player's blocks* — but doesn't address pulling a *player's own avatar/entity* into someone else's gravity well, which is a distinct unwanted effect not currently gated.

**Fix:**
- Extend `destructible`-style consent to entity effects: a black hole or supernova's gravitational pull can only meaningfully affect another player's **entity** (not just their blocks) if that player is physically present within an **unclaimed** region, or within a claim they've flagged `destructible` — never within their own protected claim, regardless of proximity to the hazard.
- This reuses the same flag rather than adding a second consent field — one flag governs both block-destruction and entity-pull consent for a given claim.

---

## 6. Success Checks

- [ ] Re-mining an immediately-placed block does not reset its decay clock; only placements that persist past a minimum dwell time do.
- [ ] Receiving material via trade does not reset that material's decay clock.
- [ ] One claim per verified account; population-scaled asteroid spawning uses a sanity-checked activity signal, not raw connection count — with the multi-account limitation explicitly documented as unresolved at the spec level.
- [ ] Supernova/black hole matter redistribution never exceeds total consumed mass; repeated triggering cannot net-farm resources.
- [ ] Claim allocation never overlaps pre-seeded asteroid belt or star system coordinates.
- [ ] A player's entity cannot be pulled by another's black hole/supernova while inside their own protected (non-`destructible`) claim.

---

## 7. Claude Code Prompt (copy-paste to apply these fixes)

> Apply the fixes in `RHOMBIVERSE_SPEC_LOOPHOLES.md` to the existing implementations of `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`, `RHOMBIVERSE_SPEC_REGIONS.md`, `RHOMBIVERSE_SPEC_SUPERNOVA.md`, and `RHOMBIVERSE_SPEC_BLACKHOLE.md`. Specifically: (1) add a minimum dwell time before block placement resets decay, and exclude trade receipt from resetting decay; (2) enforce one claim per account and switch asteroid spawn scaling to an activity-based signal rather than raw connection count; (3) add an explicit conservation check so supernova/black-hole matter redistribution never exceeds consumed mass; (4) reserve pre-seeded asteroid belt and star coordinates as non-allocatable before claim allocation runs; (5) extend the `destructible` flag to gate entity-pull effects, not just block conversion, using the same flag rather than a new field. Document the multi-account limitation in code comments as a known, spec-acknowledged gap rather than something this pass claims to fully solve.
