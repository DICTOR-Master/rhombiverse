# Rhombiverse — Spec Addendum: Asteroid Belts (Resource Mining)

Standalone addendum. Extends `RHOMBIVERSE_PLAN.md` (Phase 2 build/delete tool, world-state schema) and is governed by `RHOMBIVERSE_PRINCIPLES.md` (population-scaled spawning below is a direct application of the adaptive-damping pattern — scaling to system load rather than a fixed constant).

---

## 1. Purpose

Defines where raw building materials come from. Answers the "no pre-existing terrain to mine" gap in the base lattice: rather than materials being embedded in ordinary world terrain, they exist in discrete, pre-seeded **asteroid belts** placed in otherwise-unclaimed lattice space — consistent with the Dictoroids/asteroid-ride lore already established for this universe.

---

## 2. World Seeding

- World launches with **two starting asteroid belts**, placed at fixed coordinates in unclaimed lattice space, well outside the default spawn/core region (`RHOMBIVERSE_PLAN.md` Phase 5.8 region model).
- Each belt is a **cluster of asteroid nodes** — individual small clumps of cells (reuse the `shellCount(n) = 10n² + 2` structure from the gravity spec for each node's internal shape: a node is effectively a tiny shell-cluster, not a single cell).
- Belts are visually/spatially distinct from player-built regions — floating clusters in open lattice space, not attached to any core/spawn structure.

---

## 3. Material Yield

Mining an asteroid cell removes it (extends Phase 2's existing block-delete action) and adds the material to the player's inventory (new concept — see schema, section 6).

| Material | Yield frequency in asteroid belts |
|---|---|
| Base Rhomb | Common |
| Garnet | Common–moderate |
| Ferrostone | Moderate |
| Glassite / Star-Glassite | Uncommon |
| Blackstar-Glassite | Rare, asteroid-exclusive — does not occur anywhere else in the world |

Exact probability weights: implementation-tunable, not fixed by this spec.

---

## 4. Regeneration (Individual Cell Regrowth)

- A mined (removed) asteroid cell **slowly regrows** after a cooldown period, rather than being permanently gone — same underlying idea already established for Verdant Core's tame growth behavior in the material palette.
- Regeneration is **per-node**, not instantaneous belt-wide — a heavily mined node regrows gradually, cell by cell, not all at once.
- This keeps any given asteroid belt a real, finite-feeling resource on a given day (you can mine it out faster than it regrows if you're aggressive) without the world ever permanently running dry.

---

## 5. Population-Scaled Spawning (Adaptive Damping applied to resource supply)

This is the direct application of the adaptive pattern from `RHOMBIVERSE_PRINCIPLES.md` section 2 — instead of a fixed spawn rate, total asteroid supply adapts to system load (active user count):

```
target_total_capacity = base_capacity + f(active_users)
```
- `base_capacity` = the two starting belts' baseline node count — always present, even with very few active users.
- `f(active_users)` = a monotonically increasing, bounded function — more concurrent active users → more total asteroid nodes/belts are spawned to keep pace with demand and avoid overcrowding/competition for scarce nodes.
- **When active user count drops, spawning throttles down** (fewer *new* nodes generated) — but existing asteroids are never deleted or punished for population decline. Supply contracts by slowing new growth, not by removing what's already there. This mirrors the "settling," non-punitive shape of adaptive damping already established elsewhere (decay toward baseline, not destructive correction).
- New capacity can manifest as either denser nodes within the two existing belts, or entirely new belts spawned further out in unclaimed space — implementation's choice, both are valid under this spec.
- `f()`'s exact shape (linear, logarithmic, stepped) is implementation-tunable; it must be bounded (per principles doc's requirement that adaptive mechanisms never become unbounded) so a hypothetical very large player count can't generate unlimited belts indefinitely — a sane upper capacity ceiling should be defined at implementation time.

---

## 6. World-State Schema Extension

```json
{
  "asteroidBelts": {
    "belt_1": {
      "center": [40, 0, 40],
      "nodes": {
        "node_1": {
          "center": [40, 0, 40],
          "shellRadius": 2,
          "cells": { "40,0,40": { "material": "garnet", "minedAt": null } }
        }
      }
    }
  },
  "playerInventory": {
    "userId_example": {
      "garnet": 12,
      "blackstar-glassite": 1
    }
  }
}
```
- `minedAt`: timestamp when a cell was mined, null if intact — drives the per-node regeneration timer (section 4).
- `playerInventory`: new top-level object, additive to existing schema — required for mining to have any purpose (materials need somewhere to go before being used to build planetoids elsewhere).

---

## 7. Isolation & Scope (per `RHOMBIVERSE_PRINCIPLES.md` section 1)

- Asteroid mining/regeneration/spawning is fully self-contained — it never affects player-built regions, planetoids, or the black hole system. Belts exist in unclaimed space by definition (section 2).
- Population-scaled spawning only adds/throttles *new* nodes; it never modifies or removes existing player-independent world content, keeping this system's blast radius limited to its own belts.

---

## 8. Success Checks

- [ ] World launches with exactly two seeded asteroid belts in unclaimed space, outside the default core/spawn region.
- [ ] Mining an asteroid cell removes it and adds the corresponding material to the miner's inventory.
- [ ] A mined cell regrows individually after a cooldown period; heavily mined nodes regrow gradually, not all at once.
- [ ] Total asteroid capacity increases with active user count and decreases (via throttled new spawning only, never deletion) as active users decline.
- [ ] Blackstar-Glassite yields only from asteroid belts, nowhere else in the world.
- [ ] No amount of player count growth causes unbounded belt/node generation — a defined capacity ceiling exists.

---

## 9. Claude Code Prompt (copy-paste to start this addendum)

> Implement the Asteroid Belt resource system per `RHOMBIVERSE_SPEC_ASTEROIDS.md`. Build on top of the existing lattice/world-state code from `RHOMBIVERSE_PLAN.md` Phases 1–3. Seed two starting asteroid belts in unclaimed lattice space using the schema in section 6. Extend the block-delete action from Phase 2 so mining an asteroid cell adds its material to a new `playerInventory` object. Implement per-node regeneration with a cooldown timer (section 4). Implement population-scaled spawning per section 5 as a bounded function of active user count, choosing and documenting a specific capacity ceiling. Do not implement crafting/conversion of materials or planetoid-building consumption of inventory in this pass — this spec covers acquisition only.
