# Rhombiverse — Spec Addendum: Planetoid Gravity & Core-Cavity System

Standalone addendum to `RHOMBIVERSE_PLAN.md`. Extends **Phase 5.5 (Planetoid Building + Radial Gravity)** — do not merge into the main plan file; implement as its own module referencing the same lattice math (section 2 of the main plan).

---

## 1. Purpose

Defines how planetoids get coherent, walkable gravity, how that gravity's reach can be extended after the fact, and how core space scales automatically as a planetoid grows — using real FCC shell geometry rather than arbitrary numbers.

---

## 2. Material: Glassite Family (for reference)

Add to material palette (extends `RHOMBIVERSE_PLAN.md` section on materials, not yet formalized as its own file):

| Material | Function |
|---|---|
| **Glassite** | Base translucent material — see-through render, structurally solid, no gravity function. |
| **Star-Glassite** | Mid-tier translucent variant. Cosmetic/structural only, no gravity function. |
| **Blackstar-Glassite (BSG)** | Rare, dense variant. **Sole material that can source planetoid gravity.** Named after real (if speculative) astrophysics — "black star" is an actual theorized ultra-dense object in some quantum-gravity models; density-as-gravity-source is directly inspired by white dwarf/neutron star physics, deliberately scaled down for gameplay rather than kept realistic. |

---

## 3. Shell / Core-Cavity Math

FCC lattice shells around any center point follow a known closed-form: the number of cells in shell `n` (counting outward from center, `n = 1, 2, 3...`) is:

```
shellCount(n) = 10n² + 2
```

This is the same 12-neighbor-direction geometry already defined in the main plan (section 2) — it is not a new coordinate system, just the natural consequence of counting outward through those 12 directions symmetrically.

**Use of this formula here:** as a planetoid's outer radius grows, reserve inner shells as a **soft-target core cavity** — space suggested (not mandatory) for Blackstar-Glassite placement, sized proportionally via this formula.

**Implementation note — soft rule, not hard constraint:** this formula assumes a perfectly symmetric build outward from a single center. Player-built planetoids will often be irregular/lumpy. Do not block irregular building. Instead:
- Calculate an *effective radius* from the planetoid's actual filled-cell extent (e.g. average or max distance from center-of-mass).
- Suggest a core cavity size using `shellCount(n)` for `n` up to that effective radius, surfaced as a UI hint (e.g. "recommended core radius: 3 shells (~92 cells)"), not an enforced rule.

---

## 4. Gravity Mechanic

- A planetoid is only gravity-active (radial "down" toward center, walkable surface) if it has **at least one Blackstar-Glassite cell** acting as a gravity source.
- **Gravity radius** scales with total BSG mass at/near the core — more BSG (denser or larger core cluster) → gravity reaches further from center → planetoid stays coherent (walkable, "down" pointing correctly) all the way to a larger outer surface.
- Cells beyond the current gravity radius are physically solid (still built, still visible) but **inert** — no radial gravity applied; treat as normal flat-gravity or zero-gravity space until the radius is extended to include them.

### 4.1 Retroactive core growth (adding BSG later)
- Players may add BSG to an existing structure at any time — not required upfront.
- On each BSG add/change, **recalculate gravity radius** from the (possibly updated) center of mass.
- Any previously-inert cell that now falls within the new radius **immediately activates**: becomes walkable, gravity snaps to point toward center for any player/entity present in that cell at the moment of activation.
- No separate "activation" animation/logic required beyond applying the same radial-gravity rule uniformly — activation is just the boundary moving, not a special case.

### 4.2 Multi-deposit center of mass (optional, physically honest extension)
- Real gravity sums contributions from all mass, weighted by position — not just a single point source.
- Optional implementation: compute effective gravity center as the **weighted centroid of all BSG cells** in a structure (weight = density/quantity per cell), rather than requiring one single core point.
- This allows irregularly-shaped planetoids with multiple BSG deposits to still resolve to a single coherent gravity center, rather than forcing perfect spherical builds around one fixed point.
- Mark as **optional for first implementation** — a single-point core (simplest case: one designated BSG cell or cluster) is sufficient for Phase 5.5's initial success check; multi-deposit centroid can be added once the single-point version works.

---

### 4.3 Recentering Shockwave

**Problem this solves:** without deliberate feedback, a gravity center silently shifting (from BSG add/remove or asymmetric building) would feel like a bug — players' sense of "down" changing with no warning.

**Eccentric shapes are explicitly allowed.** A planetoid does not need to be a sphere — capsules, ovoids, and rough/irregular approximations of these are all valid. What's fixed is not the shape but the *governance model*: exactly **one** calculable gravity center (the BSG-weighted centroid, section 4.2) governs the entire structure, however eccentric its outer form. There is no multi-focal or ellipse-style dual-center gravity — eccentric shape, single center.

**Forming state (grace period before any recentering applies):** a planetoid with total BSG mass below a minimum core threshold is considered **forming** — no recentering events fire at all while forming, regardless of how much the computed centroid moves. This isn't a UX patch bolted on; it mirrors real protostar/young-system behavior, where there's no meaningfully settled gravitational center until enough mass has accumulated. Once total BSG mass crosses the minimum core threshold, the planetoid exits forming state and the shell-tolerance rule below applies from that point on. (Exact minimum mass value: implementation-tunable, not fixed by this spec — playtest to find a threshold that feels like "founding a core" rather than "placing one block.")

**Trigger (post-forming):** shell-degree tolerance, extended by one degree for extra building room — not a fuzzy "significant" judgment call, a specific quantized rule using `shellCount(n) = 10n² + 2` from section 3:

- Shell 1 = 12 points, Shell 2 = 42, Shell 3 = 92, Shell 4 = 162. Cumulative through Shell 4 = 1 (center) + 12 + 42 + 92 + 162 = **309 points.**
- A computed center-of-mass shift landing **within Shell 1–4** (the new center falls within that ~309-point neighborhood of the old center) is **absorbed — no recentering event, no shockwave.** Extending tolerance to a fourth shell gives meaningfully more room for ordinary core adjustments before any correction fires, on top of the forming-state grace period above.
- A shift that reaches **Shell 5 or beyond** (252 additional cells, `shellCount(5) = 10(25)+2 = 252`) is what **demands recentering.**
- Centroid math also self-dampens over time: since center-of-mass is a *weighted average*, a planetoid with substantial existing core mass barely moves when a small additional BSG deposit is added — the biggest practical risk sits at planetoid founding, which the forming-state grace period above directly addresses.

**Shockwave behavior:**
- A radial pulse propagates outward from the **new** center, shell by shell, using the same `shellCount(n)` progression from section 3 — so the effect is geometrically consistent with the rest of the lattice system, not a generic particle effect bolted on.
- Any entity (player, loose object) caught in the pulse experiences a brief, small knockback/disorientation — enough to be noticeable and communicate "something changed," not punishing.
- Gravity direction for all cells updates as the pulse passes through them, rather than snapping instantly everywhere at once — the shockwave *is* the visual/physical representation of the field reasserting itself, shell by shell outward.
- **Magnitude scales with how far past Shell 4 the new center lands.** A shift that just crosses into Shell 5 produces a modest ripple; a shift landing many shells out produces a much larger one. Anything within the Shell 1–4 tolerance zone, or anything while the planetoid is still in forming state, produces no event at all.

**Honest framing:** this is a stylized dramatization, not real physics — real gravitational fields don't "propagate" as a visible outward pulse at a screen-readable speed. It's a deliberate visual-feel choice, justified narratively as the planetoid's field "reasserting" itself, similar to how interactive visualizations often render instant physical events (impacts, energy releases) as expanding rings for readability.

### 4.4 Low-Maintenance Debounce & Scoping

Two separate concerns, both solved the same way — batch instead of react-per-edit, and scope effects narrowly instead of broadcasting them:

**Debounce (reduces event frequency, not just tolerance):**
- Centroid is **not** recalculated on every single cell placement/removal. Recalculation batches over a short settle window (e.g. a few seconds of no further BSG edits to that planetoid) — so an active building session doesn't produce a shift-check per block, only once building pauses.
- This is on top of, not instead of, the forming-state and Shell 1–4 tolerance already defined — debounce reduces *how often* the shift math even runs; tolerance governs *what happens* once it does.

**Cooldown (prevents event stacking):**
- After a recentering shockwave fires, suppress any further shockwave from that planetoid for a short cooldown period, even if additional qualifying shifts occur — reconcile any shifts during cooldown into a single event once cooldown ends, rather than firing repeatedly in quick succession.

**Scoping (limits who/what is affected):**
- Knockback/disorientation and visual shockwave effects apply **only** to entities physically on or near that specific planetoid — never broadcast world-wide, never affects unrelated planetoids or players elsewhere in the world.
- Players not on the affected planetoid experience nothing — no notification, no global event log spam. This is a local physical event, not a world-state announcement.

**Net effect:** an active builder can freely place/remove BSG during a session without triggering a stream of small events; the system only evaluates and reconciles once activity pauses, and even then the effect never reaches beyond the specific planetoid involved.

---

## 5. World-State Schema Extension

Extends the `cells` object from `RHOMBIVERSE_PLAN.md` section 3 — additive only, no breaking change to existing fields:

```json
{
  "cells": {
    "0,0,0": {
      "material": "blackstar-glassite",
      "region": "core",
      "status": "approved",
      "authorId": "system",
      "gravitySource": true,
      "gravityWeight": 1.0
    }
  },
  "planetoids": {
    "planetoid_1": {
      "centerOfMass": [0, 0, 0],
      "gravityRadius": 4.2,
      "coreShellRecommendation": 3
    }
  }
}
```
- `gravitySource` / `gravityWeight` — only present on BSG cells; used to compute centroid and total gravity strength.
- `planetoids` — new top-level object; a planetoid is a tracked cluster with a computed center of mass and current gravity radius, recalculated on any BSG add/remove within its cluster.
- `coreShellRecommendation` — output of the `shellCount(n)` soft-target calculation (section 3), for UI display only.

---

## 6. Success Checks

- [ ] Placing a single BSG cell at a structure's center activates radial gravity within a small default radius.
- [ ] Adding more BSG later increases gravity radius; previously-inert outer cells become walkable without rebuilding.
- [ ] A player standing in a cell at the moment it activates has gravity snap correctly toward center.
- [ ] UI surfaces a recommended core-shell size as the planetoid's outer radius grows (soft hint, not enforced).
- [ ] Irregular/asymmetric/eccentric planetoids (capsule, ovoid, rough approximations) are fully supported — shape is unconstrained, gravity is always governed by exactly one calculable center.
- [ ] A planetoid below the minimum core BSG threshold is in "forming" state — no recentering events fire regardless of centroid movement.
- [ ] Once past forming state, a center-of-mass shift within Shells 1–4 (≤309-point neighborhood) is absorbed with no recentering event.
- [ ] A center-of-mass shift reaching Shell 5 or beyond (post-forming) triggers a shell-by-shell outward shockwave from the new center, magnitude scaling with how far past Shell 4 the shift lands.
- [ ] Entities caught in a shockwave receive brief, noticeable (not punishing) knockback/disorientation, scaled to shift size.

---

## 7. Claude Code Prompt (copy-paste to start this addendum)

> Implement the Planetoid Gravity & Core-Cavity system per `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`. Build on top of the existing lattice/world-state code from `RHOMBIVERSE_PLAN.md` Phases 1–3. Add the `blackstar-glassite` material with `gravitySource`/`gravityWeight` fields, implement single-point gravity radius calculation first (section 4.1, skip the optional multi-deposit centroid in section 4.2 for this pass), implement the `shellCount(n) = 10n² + 2` helper for UI core-size recommendations (section 3), and extend the world-state schema exactly as shown in section 5. Skip the recentering shockwave (section 4.3) and its debounce/cooldown/scoping layer (section 4.4) for this first pass — implement both together as a follow-up once basic gravity activation/radius works and is tested; 4.4 depends on 4.3 existing first. Do not implement multi-deposit centroid gravity, recentering shockwave, debounce/scoping, or any Penrose/growth-layer code in this pass.
