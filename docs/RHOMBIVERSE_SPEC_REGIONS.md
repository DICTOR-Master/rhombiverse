# Rhombiverse — Spec Addendum: Region Ownership & Claiming

Standalone addendum. Fills a gap several existing specs already depend on (`destructible` flag, "a player's own claimed region" — referenced in `RHOMBIVERSE_SPEC_BLACKHOLE.md` and `RHOMBIVERSE_SPEC_SUPERNOVA.md`). Governed by `RHOMBIVERSE_PRINCIPLES.md`. Reuses the shell-geometry pattern already established rather than inventing a new spatial model, per Grounded Simplicity (section 0) and the project's "only best, or not best" standard — considered and rejected a fractionalizing/shrinking allocation model in favor of the simpler fixed-size approach below (see section 2 for that comparison).

---

## 1. Naming Note: Two Different "Region" Concepts

`RHOMBIVERSE_PLAN.md` Phase 5.8 already uses `region` on a cell to mean **moderation status** (`"core"` / `"reviewed"` / `"open"`). This spec introduces **ownership claims**, a different concept — which player, if any, owns a given area. To avoid collision, ownership uses a separate field: `claimId` (see schema, section 5). A cell can have both a moderation `region` and an ownership `claimId` simultaneously — they answer different questions ("is this content vetted?" vs "who owns this space?").

---

## 2. Allocation Model: Fixed-Size Claims, Outward via Shell Structure

**Rejected approach (for the record):** a fractionalizing model, where new players' default claim size shrinks as population grows to keep a bounded "core" area fully allocated, was considered and set aside. It solves a problem the lattice's own infinitude already solves for free, at the cost of a dynamic formula, variable plot sizes, and a special-cased core region — more moving parts for no real gain. Per Grounded Simplicity and "only best, not more options," the simpler model below wins outright, not just marginally.

**Chosen approach:**
- Every player claim is a **fixed size** (a specific number of cells or shell-radius, e.g. "a claim is a 2-shell cluster" — exact size implementation-tunable, not fixed by this spec, but the same size for every player, no exceptions).
- Claims are allocated **outward from world center, shell by shell, using the same `shellCount(n) = 10n² + 2` structure and 12-neighbor adjacency already established** (`RHOMBIVERSE_PLAN.md` section 2, reused directly in `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` and `RHOMBIVERSE_SPEC_ASTEROIDS.md`) — not a flat/planar spiral, but true 3D shell expansion through all 12 neighbor directions, consistent with how everything else in this world already grows outward from a center.
- Allocation fills each shell before moving to the next: first-come claims are placed in Shell 1 space, then Shell 2, and so on — early players naturally end up nearer center, later players further out, exactly like real settlement patterns, with zero formula recalculation and nothing about any existing claim ever changing once granted.
- **No claim is ever resized, moved, or shrunk after being granted** — this is the core guarantee that keeps the model consistent with Isolation (`RHOMBIVERSE_PRINCIPLES.md` section 1): the allocation system itself must never disrupt a player's existing claim, the same way no other subsystem is allowed to.

---

## 3. Unclaimed Space

- Space between/beyond allocated claims remains **unclaimed** — this is where asteroid belts (`RHOMBIVERSE_SPEC_ASTEROIDS.md`) and free-roaming/building-without-ownership already live, per existing specs.
- Unclaimed space is not owned by anyone and is not subject to another player's `destructible` consent flag — it's the "wild" default the trust-zone `open` region already describes in Phase 5.8.

---

## 4. Relationship to Existing Specs

- `destructible` flag (`RHOMBIVERSE_SPEC_BLACKHOLE.md`, `RHOMBIVERSE_SPEC_SUPERNOVA.md`) now has a concrete referent: it's a flag on a `claimId`'s owned cells, settable only by that claim's owner.
- "A player's own claimed region" (used throughout the hazard specs) now resolves precisely to "cells with `claimId` matching that player."
- Phase 5.8's moderation `region` (core/reviewed/open) and this spec's `claimId` (ownership) are independent and can be cross-referenced but never conflated (section 1).

---

## 5. World-State Schema Extension

```json
{
  "cells": {
    "1,1,0": {
      "material": "base",
      "region": "core",
      "status": "approved",
      "authorId": "system",
      "claimId": null
    }
  },
  "claims": {
    "claim_1": {
      "ownerId": "userId_example",
      "shellIndex": 1,
      "center": [3, 1, 2],
      "size": "2-shell",
      "destructible": false,
      "grantedAt": "ISO timestamp"
    }
  }
}
```
- `claimId` on a cell — null for unclaimed space, otherwise references a `claims` entry.
- `claims` object — one entry per granted claim; `shellIndex` records which shell it was allocated in, useful for both display ("you're in the 4th ring out") and for the allocation algorithm to know where to place the next claim.
- `destructible` lives on the claim itself, not per-cell — a single flag per claim, consistent with how `RHOMBIVERSE_SPEC_BLACKHOLE.md` already describes it as a region-level setting.

---

## 6. Isolation & Scope (per `RHOMBIVERSE_PRINCIPLES.md` section 1)

- The allocation system's only action is granting new claims in unclaimed space — it never reads, modifies, or resizes any existing claim. Its blast radius, in principle, is "zero effect on anything already granted."

---

## 7. Success Checks

- [ ] Every claim is the same fixed size, regardless of when it was granted or how many players have joined since.
- [ ] New claims are allocated shell by shell, outward from center, using true 3D 12-neighbor shell structure — not a flat/planar pattern.
- [ ] No claim is ever resized, moved, or shrunk once granted, regardless of population growth.
- [ ] Unclaimed space between/beyond claims remains open, matching the existing Phase 5.8 `open` region behavior.
- [ ] `destructible` flag and "own claimed region" in the black hole and supernova specs now resolve concretely to `claimId`-owned cells.

---

## 8. Claude Code Prompt (copy-paste to start this addendum)

> Implement Region Ownership & Claiming per `RHOMBIVERSE_SPEC_REGIONS.md`. Build on top of the existing lattice/shell math from `RHOMBIVERSE_PLAN.md` section 2 and the `shellCount(n) = 10n² + 2` formula already used in `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`. Implement fixed-size claim allocation (choose and document a specific claim size) filling shells outward from world center in true 3D via 12-neighbor adjacency, not a flat spiral. Add the `claims` object and per-cell `claimId` field per section 5 — keep this fully distinct from the existing moderation `region` field (core/reviewed/open) from Phase 5.8; do not merge or rename either field. Wire the `destructible` flag referenced in `RHOMBIVERSE_SPEC_BLACKHOLE.md` and `RHOMBIVERSE_SPEC_SUPERNOVA.md` to live on the `claims` object as specified. Do not implement any fractionalizing/shrinking allocation model — fixed size only, per section 2.
