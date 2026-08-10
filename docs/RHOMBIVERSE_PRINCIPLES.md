# Rhombiverse — Core Principles

Cross-cutting design law for the whole system — not specific to any one subsystem (gravity, moderation, growth, multiplayer, or anything built later). Every future spec document should be written to comply with these principles; they take precedence over convenience in any individual subsystem's design.

This document formalizes what was informally called "entropic normalization" — on inspection, it's actually two distinct, well-established engineering principles working together. Both are stated below as binding rules, not suggestions.

---

## 0. Grounded Simplicity (Prime Directive)

**Law:** nothing in Rhombiverse should wander far from reality without cause — and whatever is built should be as simple and easily resolvable as possible. Where a choice exists between borrowing an established, well-understood pattern (real physics, or established game-design convention) versus inventing something arbitrary, borrow. Where new lore or rules genuinely must be established, they should be as internally coherent and minimal as the real-world analogues they stand in for. **The simpler and truer the better — in that order of preference when they conflict, but ideally both at once.**

This isn't a stylistic preference — it's a design discipline that's already shaped every spec written so far, made explicit here so future decisions default to it rather than relying on it having been followed by accident:

- **Real-physics grounding, used repeatedly:** the FCC lattice's 12-neighbor structure (real crystallography), Blackstar-Glassite's density-as-gravity-source (real white dwarf/neutron star physics, scaled down), the black hole's asymptotic space-generation (real Schwarzschild-geometry behavior), Ice 9.9's core-adjacent liquefaction (real icy-moon subsurface-ocean heating). Each borrowed a real mechanism rather than inventing an arbitrary one.
- **Simplicity, chosen over complexity even when complexity was available:** the shell-degree recentering rule (a specific quantized threshold) was chosen over a vague "significant shift" judgment call; single-point BSG gravity was implemented before the more complex multi-deposit centroid option, explicitly deferred rather than front-loaded; Ice 9.9 was reduced from three placement states to two once the third added complexity without necessity.
- **When reality and simplicity conflict, note the departure honestly rather than hiding it:** the recentering shockwave and the black hole's damping-against-runaway-growth are both explicitly flagged in their own specs as departures from real physics, chosen deliberately for safety/legibility — the rule is not "always be 100% physically accurate," it's "don't drift from reality without a stated reason, and prefer the simplest version of whatever you land on."
- **Where no real-world analogue exists (pure game lore, e.g. material names, world structure):** default to whatever is easiest to reason about and resolve unambiguously — a rule a new player or a future contributor can hold in their head, not one requiring a lookup table of special cases.

**Binding rule for future specs:** before any new mechanic is written, ask (a) does a real-world or established-game-design analogue already solve this problem, and (b) is this the simplest version of the rule that still does what's needed. Only invent new, more complex mechanics when both answers are genuinely no — and if a departure from realism or simplicity is necessary, state it plainly in the spec, the way the shockwave and black-hole-damping departures already do.

---

## 1. Isolation (Containment)

**Law:** instability, correction, or failure in one part of the system must never propagate into unrelated parts of the system. A local problem stays local.

This is the resilience-engineering pattern sometimes called *bulkheading* (after ship design — a flooded compartment shouldn't sink the whole vessel) or a *circuit breaker* (a fault trips a local breaker, not the whole grid).

**Already implemented once, as precedent:** the Planetoid Gravity spec's scoping rule (`RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`, section 4.4) — a recentering shockwave affects only entities on the specific planetoid involved, never the wider world, never unrelated planetoids, never unaffected players. That was designed as a local fix; this document promotes it to a general law every future subsystem must also follow.

**Binding rule for future specs:** any subsystem that can enter an unstable, corrective, or high-frequency-adjustment state (physics, moderation actions, growth-layer computation, multiplayer sync conflicts, anything not yet designed) must define its own **blast radius** — the explicit boundary beyond which its instability cannot spread — as part of its spec, the same way section 4.4 did for gravity.

---

## 2. Adaptive Damping (the actual "settling" behavior)

**Law:** if a part of the system requires correction more frequently than expected, the system should not just tolerate this indefinitely or punish it repeatedly — it should **adapt**, widening its own stability margins over time so that genuinely volatile things trend toward calm rather than staying perpetually twitchy.

This maps to a real control-theory pattern: a *self-tuning regulator*. Fixed tolerance forever is naive; tolerance that adapts based on observed volatility is how real physical and biological homeostatic systems actually behave (this is a legitimate generalization from the same real-physics grounding already used elsewhere in this project, not an invented mechanic).

**Concrete worked example (planetoid gravity):** a planetoid that triggers multiple Shell-5+ recentering events in a short span shouldn't just get a cooldown (a purely temporary fix) — it should **permanently widen its own tolerance band slightly with each repeated correction**, converging toward a stable, rarely-triggered state over time, rather than remaining equally twitchy forever. A calm, rarely-edited planetoid keeps a tight, precise tolerance; a volatile, heavily-reworked one earns a wider one, exactly the way it would need to for a builder actively iterating on it.

**Generalized algorithm (subsystem-agnostic — not just for gravity):**
```
on correction_event(subsystem_instance):
    volatility_score(subsystem_instance) += weight_of(correction_event)
    tolerance(subsystem_instance) = base_tolerance + f(volatility_score)
    # f() is monotonically increasing but bounded — tolerance widens with
    # repeated correction, but never becomes unlimited/unregulatable

on quiet_period_elapsed(subsystem_instance):
    volatility_score(subsystem_instance) *= decay_factor
    # volatility memory fades during calm periods, so an instance that
    # stabilizes for good gradually returns toward base tolerance too —
    # not a one-way ratchet, a genuine settling behavior
```
- `weight_of(correction_event)` and `decay_factor` are subsystem-specific tuning values, not fixed by this document.
- The bound on tolerance-widening is required — unbounded adaptation would let something perpetually unstable escape correction entirely, which defeats the purpose. Adaptive, not infinite.
- Decay during calm periods is what makes this *settling* rather than *permanent drift* — a subsystem that behaves for a while should trend back toward its original precision, not stay permanently loosened by past volatility.

**Binding rule for future specs:** any subsystem with a correction/tolerance mechanism (thresholds, cooldowns, moderation-review frequency, sync-conflict resolution, anything not yet designed) should implement volatility-aware adaptive tolerance using this pattern, rather than a single fixed threshold assumed to be correct forever.

---

## 3. Relationship Between the Three Principles

Grounded Simplicity (0) governs the *shape* any mechanic takes before it's even built; Isolation (1) and Adaptive Damping (2) then govern how that mechanic behaves once instability shows up within it:
- **Grounded Simplicity** answers: *what should this rule even look like?* (Answer: borrowed from reality or convention where possible, and as simple as it can be while still working.)
- **Isolation** answers: *when something goes unstable, how far does it reach?* (Answer: as little as possible, always locally bounded.)
- **Adaptive damping** answers: *what happens to that unstable thing over time?* (Answer: it settles, converging toward calm, rather than oscillating forever or requiring ever-more-aggressive correction.)

A system with only isolation is safe but can stay noisy forever within its own boundary. A system with only adaptive damping but no isolation could still let one volatile part disrupt everything else while it's in the process of settling. A system with neither Grounded Simplicity nor the other two could still be safe and stable, but arbitrary and hard to reason about. All three are required together for the "natural order that settles" behavior described as the goal.

---

## 4. How This Governs Existing & Future Documents

- `RHOMBIVERSE_PLAN.md` and `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` predate this document but are already substantially compliant (world-state-as-data supports isolation naturally; section 4.4's scoping is a working isolation instance; the real-physics grounding throughout both docs already satisfies Grounded Simplicity). No retroactive rewrite required.
- **Recommended, not urgent:** add a one-line reference in both existing docs pointing here, so future readers understand the gravity spec's scoping/cooldown behavior as an instance of a general law, not a one-off gravity-specific choice.
- Every subsystem spec written from this point forward (moderation review frequency, growth-layer stability, multiplayer conflict resolution, anything else) should explicitly state its **blast radius** (isolation) and, where it has any correction mechanism, its **volatility/decay tuning** (adaptive damping) — treat these as required sections in future spec documents, the same way "Success Checks" already is.

---

## 6. Rhythm, Harmony & Change (Experiential Principles)

The three principles above (0–2) are mechanical laws — how any given subsystem must be built. These three are how a *well-built* system should actually feel to play in, and they are deliberately interdependent, not separate rules to satisfy individually:

**Rhythm** — the world should have real periodicity, not static states or pure randomness. This isn't new: asteroid regeneration (`RHOMBIVERSE_SPEC_ASTEROIDS.md`), inventory decay settling back toward baseline, and adaptive tolerance widening-then-decaying (section 2) are all already rhythmic — things cycle, rather than sitting fixed or spiking unpredictably. Rhythm is what Adaptive Damping produces when it's working correctly.

**Harmony** — no single system should dominate or unbalance the others; materials, hazards, and mechanics should support each other rather than compete. BSG-and-Ice-9.9 as complementary rather than redundant (`RHOMBIVERSE_SPEC_WATER_ICE.md`), and the conservation rule preventing supernova matter-farming (`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 3), are both harmony in practice. Harmony is what Isolation produces when it's working correctly — nothing able to overwhelm anything else.

**Change** — the world must be genuinely capable of transforming, not fixed once built. Stars fusing, supernovae detonating, hydrospheres permeating, claims expanding outward as players join — all real, permanent change, not decoration. Change is what Grounded Simplicity permits by insisting mechanics borrow from real, dynamic physical processes rather than static invented ones.

**Why interdependent:** Rhythm without Harmony is chaos with a beat — cycles that fight each other. Harmony without Change is a static, lifeless balance — stable but dead. Change without Rhythm is pure entropy — transformation with no discernible pattern to learn or rely on. All three together are what "a natural order that settles" (the original goal behind Adaptive Damping) actually looks like when experienced, not just measured.

**Binding rule for future specs:** when evaluating whether a new mechanic is ready, check it against these three the way section 0's mechanical checklist is already used — does it cycle in some recognizable way (Rhythm), does it avoid dominating other systems (Harmony), and does it represent something genuinely capable of changing over time (Change)? A mechanic satisfying 0–2 mechanically but failing all three of these experientially is a signal worth pausing on.

---

## 7. Claude Code Prompt (copy-paste to apply this document)

> Read `RHOMBIVERSE_PRINCIPLES.md` alongside any other Rhombiverse spec before implementing it. Before implementing any new mechanic, check it against Grounded Simplicity (section 0): does it borrow from real physics or established convention, and is it the simplest version that still works? Where a subsystem has a correction/tolerance mechanism (e.g. the planetoid gravity recentering system), implement the generalized adaptive-damping algorithm in section 2 — volatility score increases on correction events, tolerance widens as a bounded function of volatility, and volatility decays during quiet periods so tolerance settles back toward baseline. Where a subsystem can enter an unstable or corrective state, confirm and enforce its blast radius per section 1 before considering the implementation complete.
