# Rhombiverse — Spec Addendum: Supernova Threshold

Standalone addendum. Extends `RHOMBIVERSE_SPEC_STAR_SYSTEM.md` (BSG-as-star, carbon-catalyzed fusion) and reuses the containment pattern from `RHOMBIVERSE_SPEC_BLACKHOLE.md` directly, per Grounded Simplicity (`RHOMBIVERSE_PRINCIPLES.md` section 0) — no new safety mechanism is invented here.

---

## 1. Real-Physics Grounding

Carbon near a BSG star is normal and required (CNO-cycle catalyst, `RHOMBIVERSE_SPEC_STAR_SYSTEM.md` section 2) — **not** a hazard under ordinary fueling. The real hazard is a specific, well-documented phenomenon: a white-dwarf-type star (BSG's original grounding) that accumulates carbon-oxygen mass past a critical limit — the real **Chandrasekhar limit** — undergoes runaway carbon fusion: a **Type Ia supernova**, a thermonuclear detonation rather than steady burning. This spec implements that threshold directly, rather than treating carbon itself as dangerous.

---

## 2. Mechanic: Mass Threshold, Reusing Black Hole Containment

- Each BSG star tracks accumulated mass (extends the existing `gravityWeight`/ledger pattern already used for BSG cores and the black hole's matter ledger — same shape, not a new field type).
- A defined **critical mass threshold** exists per star (tunable, not fixed by this spec — named here as the star's Chandrasekhar-equivalent limit).
- **Below threshold:** normal operation exactly as in `RHOMBIVERSE_SPEC_STAR_SYSTEM.md` — carbon/hydrogen fueling proceeds safely.
- **Approaching threshold:** reuse Adaptive Damping (`RHOMBIVERSE_PRINCIPLES.md` section 2) — the closer accumulated mass gets to the limit, the more costly/resistant further fueling becomes, giving the system (and the player) a natural, self-braking warning rather than a silent cliff edge.
- **At/past threshold:** triggers a **supernova event** — a single, bounded detonation, not a runaway process.

---

## 3. Supernova Event Effects

- **Bounded blast radius (reuses Isolation, `RHOMBIVERSE_PRINCIPLES.md` section 1):** exactly the same containment shape as the black hole — a hard-capped radius defined at trigger time, never unbounded, never able to reach unrelated parts of the world.
- **Consent (reuses the black hole's `destructible` flag model directly):** a supernova can only affect another player's region if that region's `destructible` flag is set, identical rule to `RHOMBIVERSE_SPEC_BLACKHOLE.md` section 3 — default protected, opt-in danger only.
- **Matter redistribution, not simple deletion:** consumed mass within the blast radius scatters back into nearby unclaimed lattice space as raw materials (echoes real supernovae seeding surrounding space with heavy elements) — destructive to structures in range, but not a pure resource sink; this is a genuine real-physics behavior, not an invented mercy mechanic.
- **Possible remnant (elegant reuse, not a new system):** if the star's mass was extreme enough at detonation, the remaining core can collapse directly into the existing Black Hole mechanic (`RHOMBIVERSE_SPEC_BLACKHOLE.md`) — reusing that spec wholesale as the "what's left afterward" state, rather than designing a separate remnant system. Below that extreme threshold, no remnant forms; the core is simply consumed in the event.

---

## 4. Success Checks

- [ ] Normal carbon/hydrogen fueling below the critical mass threshold produces no hazard, matching `RHOMBIVERSE_SPEC_STAR_SYSTEM.md` behavior exactly.
- [ ] Further fueling becomes progressively costlier as accumulated mass approaches the threshold (adaptive damping), rather than an unwarned cliff edge.
- [ ] Reaching the threshold triggers exactly one bounded detonation event, not a runaway or repeating effect.
- [ ] Detonation cannot affect another player's region unless that region's `destructible` flag is set; the star owner's own region is always affected.
- [ ] Matter within the blast radius scatters into nearby unclaimed space as raw materials rather than being simply deleted.
- [ ] An extreme-mass detonation can leave a Black Hole remnant using the existing black hole spec unmodified; a lesser detonation leaves no remnant.

---

## 5. Claude Code Prompt (copy-paste to start this addendum)

> Implement the Supernova Threshold per `RHOMBIVERSE_SPEC_SUPERNOVA.md`. Build on top of `RHOMBIVERSE_SPEC_STAR_SYSTEM.md`'s BSG-star fueling logic. Track accumulated star mass; below a documented critical threshold, fueling behaves exactly as already specified. As mass approaches the threshold, apply the adaptive-damping cost-scaling pattern from `RHOMBIVERSE_PRINCIPLES.md` section 2 (reuse, don't reinvent). At threshold, trigger one bounded detonation: hard-capped blast radius (reuse the isolation pattern from `RHOMBIVERSE_SPEC_BLACKHOLE.md`), the same `destructible` region flag for cross-player consent, and matter within radius scattering into nearby unclaimed space as raw materials rather than being deleted. If detonation mass exceeds a documented extreme threshold, instantiate the existing Black Hole system (`RHOMBIVERSE_SPEC_BLACKHOLE.md`) as the remnant — do not build a separate remnant mechanic.
