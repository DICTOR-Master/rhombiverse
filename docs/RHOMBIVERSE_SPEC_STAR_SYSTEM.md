# Rhombiverse — Spec Addendum: Star System Anchor

Standalone addendum. Extends `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` (BSG) and `RHOMBIVERSE_SPEC_WATER_ICE.md` (Ice 9.9). Governed by `RHOMBIVERSE_PRINCIPLES.md` — every choice below is the simplest extension of an existing mechanic or a direct real-astrophysics borrow, per Grounded Simplicity (section 0). No new subsystem is introduced; a star is a scaled-up, relabeled application of things already spec'd.

---

## 1. Star = Large-Scale BSG, Not a New Material

A "sun" is simply a sufficiently massive Blackstar-Glassite core — same material, same gravity mechanic already spec'd, no new material type. Real white dwarfs/neutron stars (BSG's original grounding) genuinely do emit light and heat, so this is an extension, not an invention.

- Add one new field to BSG: `luminosity` — scales with total BSG mass at a core, same way `gravityRadius` already does. A planetoid-scale BSG core has negligible luminosity (no visible change); a star-scale core has significant luminosity (visible light/heat emission).
- No separate "star" material or object type — a star is just what a BSG core becomes above a certain mass threshold. One mechanic, two visible outcomes depending on scale.

---

## 2. Fuel: Ice 9.9 as Hydrogen + Oxygen, Carbon as Catalyst

Real stars fuse hydrogen; Ice 9.9 is water (H₂O), which splits naturally into real fusion fuel plus a useful byproduct:

- **Hydrogen** — consumed as fusion fuel by the BSG core, funding/sustaining its `luminosity` over time (reuses the existing ledger-style consumption pattern already used for the black hole's matter ledger — same shape, different context).
- **Oxygen** — released as a byproduct, feeding atmosphere generation elsewhere (ties directly back to Ice 9.9's existing atmosphere role in `RHOMBIVERSE_SPEC_WATER_ICE.md` — the same water source does double duty, star fuel and planetoid air, without needing two separate materials).
- **Carbon** — one additional element, included because real massive-star fusion (the CNO cycle) uses carbon as a catalyst alongside hydrogen. Included here for the same reason everything else is — because it's the real mechanism, not an invented addition. No new mechanic beyond "required alongside hydrogen for fusion to proceed."

No new material needed for Carbon if a common material already fills that role adequately (e.g. treat as a trace property of an existing material rather than minting a new one) — implementation's call, but default to reusing something existing before adding a new material type.

---

## 3. Bands by Distance: Frost Line (Real Astrophysics, Directly Borrowed)

Real solar systems have a **frost line** — inside it, too hot for ice to remain solid, so only rocky/metallic material condenses; beyond it, ice survives, producing icy/volatile-rich bodies. This directly answers "how should composition vary by distance from the star" without inventing a new rule:

- **Inner band (within the frost line):** rocky/metallic materials only — Base Rhomb, Garnet, Ferrostone. No Ice 9.9 possible here; too close to the star's heat.
- **Outer band (beyond the frost line):** Ice-9.9-rich — this is where the existing asteroid belts (`RHOMBIVERSE_SPEC_ASTEROIDS.md`) naturally sit, echoing how our own asteroid belt sits near/beyond the real frost line.
- One line, one threshold distance from the star's center — not multiple zones, not a gradient function. Simplest version that's still physically true.

---

## 4. Orbital Motion: Explicitly Deferred, Fixed Placement for Now

Planetoids and asteroid belts are placed at **fixed positions** relative to the star — no simulated orbital motion in this pass. Real orbital mechanics is a genuinely new class of subsystem (continuous motion, gravitational interaction between multiple bodies), not an extension of anything already spec'd, and isn't required for the frost-line/fuel mechanics above to work. Noted as a possible deliberate future addition, not a default — avoids adding complexity that isn't earning its place yet.

---

## 5. Success Checks

- [ ] A BSG core above the star-mass threshold emits `luminosity`; below it, behaves exactly as an ordinary planetoid core (no new material, no new object type).
- [ ] Star luminosity is sustained by consuming Hydrogen (from Ice 9.9), alongside Carbon as a required catalyst — matching real CNO-cycle fusion at a simplified level.
- [ ] Oxygen released from the same fusion process is available to feed atmosphere generation, reusing the existing mechanic from `RHOMBIVERSE_SPEC_WATER_ICE.md` rather than a new one.
- [ ] Materials found in a given region respect the frost-line rule: rocky-only inside it, Ice-9.9-capable beyond it.
- [ ] No orbital motion is simulated — all placements are fixed relative to the star.

---

## 6. Claude Code Prompt (copy-paste to start this addendum)

> Implement the Star System Anchor per `RHOMBIVERSE_SPEC_STAR_SYSTEM.md`. Do not create a new material or object type for "star" — extend the existing Blackstar-Glassite core logic from `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` with a `luminosity` field that scales with core mass above a documented threshold. Implement fusion consumption: Hydrogen (split from Ice 9.9) funds luminosity over time, Carbon required as catalyst (reuse an existing material if reasonable rather than adding a new one — your call, document the choice), Oxygen released as byproduct feeding the existing atmosphere mechanic in `RHOMBIVERSE_SPEC_WATER_ICE.md`. Implement one frost-line distance threshold from the star's center: inside = rocky materials only (no Ice 9.9), outside = Ice-9.9-capable, consistent with where asteroid belts are already placed. Do not implement orbital motion — all positions relative to the star are fixed in this pass.
