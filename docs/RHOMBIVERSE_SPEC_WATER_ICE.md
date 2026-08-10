# Rhombiverse — Spec Addendum: Water & Ice 9.9 (Planetoid Hydrosphere)

Standalone addendum. Extends `RHOMBIVERSE_SPEC_ASTEROIDS.md` (resource acquisition) and `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` (Ice 9.9's core-adjacent behavior interacts directly with Blackstar-Glassite cores). This is a benign material system — it does not use the black hole's containment framework; see section 3 for the actual mechanic.

---

## 1. Water — Ordinary Resource

- Common, safe, non-hazardous material. Not asteroid-exclusive — occurs in its own deposit type (e.g. small pockets within unclaimed lattice space, similar structurally to asteroid nodes but far more common and non-scarce).
- Functional uses (implementation's choice, not fixed by this spec): feedstock for Verdant Core-style growth materials, a basic building material in its own right, or later tied into the Penrose/growth layer (`RHOMBIVERSE_PLAN.md` Phase 6) as a resource that organic growth consumes.
- No special containment or safety design needed — ordinary resource, same tier as Base Rhomb or Garnet.

---

## 2. Ice 9.9 — Naming Note

**"Ice 9.9" is fine to use as-is** — it's a numeric material name in the same style as real Ice IX (an actual, harmless high-pressure ice polymorph), not a reproduction of anyone's copyrighted text or title. No renaming needed here, unlike the earlier (mistaken) hazard framing below this note has replaced.

---

## 3. Ice 9.9 — Planetoid Hydrosphere Material

**Not a hazard.** This is a benign, life-supporting material with context-dependent behavior based on placement — closer to a planetoid's circulatory system than a threat.

**Real-world grounding:** icy moons like Europa and Enceladus have subsurface liquid oceans specifically *because* internal heat (tidal flexing, core processes) melts ice that would otherwise stay frozen at their surface temperature. Ice 9.9's behavior mirrors this directly rather than inventing an arbitrary phase-change rule.

**Two states, by placement context:**

- **Mined/placed normally (away from any BSG core):** stable solid block, forms and mines like any ordinary material — same tier as Base Rhomb or Garnet for acquisition purposes.
- **Placed around a Blackstar-Glassite core:** liquifies and **permeates the planetoid**, supporting both **life and atmosphere** — spreads through the existing structure (using the same 12-neighbor adjacency already established for lattice propagation) rather than staying a static block. This is the planetoid's water cycle *and* atmospheric system forming together — distributed moisture feeding the Verdant Core growth material and the future Penrose/growth layer (`RHOMBIVERSE_PLAN.md` Phase 6), while also establishing a breathable/livable envelope around the planetoid rather than just interior hydration.

**Design purpose:** this gives planetoids a reason to want both BSG *and* Ice 9.9 together — BSG alone makes a planetoid gravitationally coherent (per `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`), but Ice 9.9 placed around that core is what makes a planetoid **habitable** — water and air together, not separable systems. The two rare-ish materials become complementary, not redundant.

**Acquisition:** Ice 9.9 forms under normal pressure conditions in its own deposit type (comparable to a standard asteroid-belt-tier resource, per `RHOMBIVERSE_SPEC_ASTEROIDS.md`) — not artificially rare like Blackstar-Glassite, since it's meant to be a normal part of planetoid-building, not an endgame prize.

---

## 4. World-State Schema Extension

```json
{
  "cells": {
    "12,4,8": { "material": "water" },
    "18,2,6": { "material": "ice99", "state": "solid" },
    "20,0,0": { "material": "water", "sourceMaterial": "ice99", "hydrospherePermeated": true }
  },
  "planetoids": {
    "planetoid_1": {
      "centerOfMass": [0, 0, 0],
      "gravityRadius": 4.2,
      "hydrosphereActive": true,
      "atmosphereActive": true
    }
  }
}
```
- `state: "solid"` — Ice 9.9's default form when mined/placed normally, away from any BSG core.
- `sourceMaterial: "ice99"` — marks a cell that was Ice 9.9 before liquifying/permeating, for growth-layer logic (Phase 6) to identify where hydrosphere water is present.
- `hydrospherePermeated` — flag on cells that are part of a planetoid's spread hydrosphere network (from placement around a BSG core).
- `hydrosphereActive` / `atmosphereActive` on the `planetoids` object — whether this planetoid currently has Ice-9.9-derived water and air support, relevant for future growth-layer material/habitability checks. Both flip together, since permeation establishes both at once (section 3).

---

## 5. Success Checks

- [ ] Water is placeable/harvestable as an ordinary, safe resource with no special containment logic.
- [ ] Ice 9.9 forms and mines as a stable solid block under normal conditions, away from any BSG core.
- [ ] Ice 9.9 placed around a Blackstar-Glassite core liquifies and permeates the planetoid's structure via 12-neighbor adjacency.
- [ ] Permeation establishes both `hydrosphereActive` and `atmosphereActive` for the planetoid together — water and air are a single combined effect, not separate mechanics.
- [ ] There is no core-placement conversion behavior — Ice 9.9 only has the two states above.
- [ ] Neither placement context is hazardous, destructive, or requires the black hole's containment framework — this material has no blast radius, no consent flag, no ledger cost.

---

## 6. Claude Code Prompt (copy-paste to start this addendum)

> Implement Water and Ice 9.9 per `RHOMBIVERSE_SPEC_WATER_ICE.md`. Water: add as a common, safe resource per section 1, no special logic beyond normal placement/mining. Ice 9.9: implement as a normal mineable solid material by default (section 3); when placed around an existing Blackstar-Glassite core, trigger liquify-and-permeate behavior spreading through the planetoid's structure via 12-neighbor adjacency, setting both `hydrosphereActive` and `atmosphereActive` on the planetoid. There is no separate core-placement behavior — only the two states in section 3. Extend the schema exactly as shown in section 4. This is a benign material system — do not reuse or reference the black hole's containment framework (blast radius, ledger cost, destructible flag) here; none of that applies to Ice 9.9.
