# Rhombiverse — Construction Order Plan

## 0. Meta-Paradigm (simplified)

Rhombiverse is one **world-state**, rendered by whatever client reads it. Two systems will eventually write to that world-state, but only one is built first:

1. **RD Lattice (build system)** — deterministic, player-placed, FCC-packed rhombic dodecahedra. Ships in v1.
2. **Penrose/RT Growth (organic system)** — procedural, aperiodic, 5-fold quasicrystalline growth (plants/creatures). Ships in v2+, as an additive layer on the same world format.

**Golden rule:** the world is data (JSON), not baked geometry. Any renderer, any client, any future multiplayer backend just reads/writes this data. This is what makes "open to the public" possible without a rewrite later.

---

## 0.5. Core vs. Modules

The FCC lattice / rhombic dodecahedron geometry — and its planned dual
cube-octahedron structure — is this project's core: what makes Rhombiverse
Rhombiverse rather than another voxel builder. The game-loop World Systems
(mining, trade, claims, hazards, and the rest) built on top of that geometry
are valuable, well-built, and genuinely fun — but secondary, and meant to be
independently extendable rather than load-bearing for the core experience.

- **Core (always present):** lattice math (`lattice.js`), rendering
  (`render.js`), build/chisel (`build.js`), Sculpture Mode (`sculpture.js`),
  base world-state schema (`worldstate.js`), persistence (`persistence.js`),
  optional Shared World sync (`sync.js`). A dual cube/octahedron structure
  (`dual.js`) is planned for this tier but does not exist in the codebase
  today — the only thing currently called "dual" in the app is Duality Mode
  (`render.js`, ~L2172), which shows the aperiodic Penrose-tiling shadow a
  structure casts (reusing `growth.js`'s tile geometry) — a genuinely
  different concept from a cube/octahedron dual mesh, not a stand-in for it.
- **Geometry Extensions (opt-in, still shape-focused):** radial gravity &
  planetoids (`gravity.js`, `planetoidgen.js`), Penrose/Ammann growth
  (`growth.js`), lattice zoom (`latticezoom.js`), cultivation
  (`cultivation.js`).
- **World Systems (secondary, game-loop, can be disabled or
  community-owned):** mining & resources (`asteroids.js`), inventory, claims/
  regions (`regions.js`), trade (`trade.js`), achievements
  (`achievements.js`), animals (`animals.js`), hazards (`blackhole.js`,
  `supernova.js`, `starsystem.js`), hydrosphere (`hydrosphere.js`).

Proposed directory layout (target state — see Migration Path below for how
the codebase gets there; nothing has been physically moved yet):

```
src/
  core/
    lattice.js
    dual.js
    render-core.js
    build.js
    sculpture.js
    worldstate-core.js
    persistence.js
  geometry-extensions/
    growth.js
    cultivation.js
    latticezoom.js
    planetoidgen.js
    gravity.js
  game-systems/
    asteroids.js
    trade.js
    regions.js
    achievements.js
    animals.js
    evolution.js
    hydrosphere.js
    blackhole.js
    starsystem.js
    supernova.js
  app/
    wheel.js
    settings.js
    player.js
    sync.js
    index-orchestrator.js
```

### Migration Path

- [x] Phase A: `features.js` flag registry added, and the Core/Geometry-
      Extension side of the untangling is now done (2026-08-23).
      `achievements`, `animals`, `hydrosphere`, and trade's inventory-
      decay call load via a flag-gated dynamic `import()` in `render.js`'s
      `init()`, same as before. `build.js` (Core) no longer has a static
      import of `asteroids.js` — `mineAsteroidCell` is now injected via a
      constructor param on `createBuildController`, gated behind
      `FEATURES.mining`. `sculpture.js`/`worldstate.js` (Core) and
      `gravity.js` (Geometry Extensions) no longer have static imports of
      `regions.js` — `render.js` calls each module's own
      `setRegionsIntegration()` with the real `claimIdAt`/
      `isClaimProtected`, gated behind `FEATURES.economy`. Every one of
      these four modules keeps a safe inert default (no-op mining,
      "nothing is claimed") so tests and a `FEATURES`-disabled build both
      still work. Two remaining gaps this left open — `render.js`'s own
      direct World-Systems usage (belt seeding, claim UI), and
      `blackhole.js`/`starsystem.js`/`supernova.js`'s own un-gated
      imports of `regions.js` and each other — were **closed 2026-08-24**:
      `mining`/`economy`/`hazards` each now gate a real dynamic
      `import()` inside `render.js`'s own `init()`, same pattern as
      achievements/animals/hydrosphere/trade. Mining/hazards are pure
      data-layer (every existing render.js call site stayed unchanged;
      correctness comes entirely from whether the real function or an
      inert/identity default is bound). Claims got real UI treatment
      instead — the Claim Land button, claim boundary rendering, and the
      World presets/Load-World picker are explicitly hidden
      (`updateWorldPanelVisibility()`) when `FEATURES.economy` is off,
      not just left disabled underneath a still-visible button. Sculpture
      Mode's own scratch world additionally hides the World presets and
      asteroid-info panels whenever it's active, independent of these
      flags — direct feedback that "world presets shouldn't show in
      sculpture mode and asteroids shouldn't be in background," since
      Sculpture Mode is Core (always on) and genuinely isolated from the
      real World. See `features.js`'s own header comment for the exact
      same breakdown, kept in sync with this entry.
  - [x] Phase B (mostly done, 2026-08-23): every file except `render.js`
        itself physically moved (`git mv`) into the `core/` /
        `geometry-extensions/` / `game-systems/` / `app/` layout above,
        with every cross-module `import`/dynamic `import()` path fixed —
        `worldstate.js` renamed to `worldstate-core.js` per the layout
        above along the way. Seven files this section's original draft
        didn't name (they postdate it) were placed by judgment, not
        left ambiguous: `features.js`/`welcome.js`/`changelog.js`/
        `byok.js`/`cyborg.js`/`sfx.js`/`worldshare.js` all went to
        `app/` — each is app-shell/orchestration-adjacent (DOM UI,
        cross-cutting service, or share-link plumbing), none is
        geometry-core logic or World-Systems game-loop content.
        **`render.js` deliberately NOT split into `render-core.js` +
        `index-orchestrator.js`** — at 4,347 lines with rendering and
        app orchestration genuinely intertwined throughout (world-system
        ticks calling into scene updates, UI handlers calling into world
        mutation), drawing that line correctly needs its own dedicated,
        careful pass, not a mechanical move alongside 30 other files.
        It still lives at `src/render.js`, importing every other module
        via its new tiered path. Verified via the full unit suite (179
        tests) plus live browser checks: page load, build, the
        claims/gravity dependency-injection wiring from Phase A, the
        welcome tagline and changelog panel (both fetch
        `data/changelog.json` via the document's own base URL, so the
        move doesn't affect them) — all zero console errors.
  - [x] Phase C: DONE, 2026-08-24. "Rhombeometry / Full World" mode
        toggle, on both the welcome screen and Lab Settings (per direct
        instruction — not either/or). Resolved design questions: it's a
        single visitor-level mode (`settings.js`'s `pureGeometry`,
        localStorage-backed, per-device), not a per-world property — the
        2026-08-23 "geometry comes first" framing means World Systems sit
        optionally on top of the geometry, not the reverse, so there's
        no per-world data to carry the choice or wipe when it changes.
        `features.js` reads it at module-eval time, forcing all six
        World Systems flags off together when active; nothing is ever
        wiped, since init()'s existing per-flag UI-hiding (Phase A/B)
        already handles "system off" cleanly. Defaults to Rhombeometry
        (not Full World) and sits first/left of Full World in the
        welcome screen's markup — both direct instructions. Changing the
        mode always reloads (World Systems flags are only ever read
        once, at boot) — verified end-to-end with a real WebDriver
        (geckodriver/Marionette) run, not just code review: default
        mode, welcome-screen toggle, Lab panel checkbox toggle, and the
        FEATURES-gated UI (claim-land-row) all confirmed to flip
        correctly in both directions, real reload included.
  - [ ] Phase D: Optionally publish `core/` + dual Sculpture Mode as a
        standalone reusable library/template.

---

## 1. Repo Setup

- Create a **private** GitHub repo named `rhombiverse`.
- License: leave unset for now (add MIT or similar when flipping public — private repos don't need one).
- Structure:
```
rhombiverse/
  index.html
  /src
    lattice.js       # RD/FCC math (coordinates, neighbors, world<->screen)
    render.js         # Three.js scene, mesh generation for RD blocks
    build.js           # placement/removal, face-picking, input handling
    worldstate.js    # load/save/serialize world JSON
    persistence.js    # localStorage now, swappable backend later
  /data
    starter-world.json
  /docs               # design notes, this plan, future Penrose spec
  README.md
  RHOMBIVERSE_PLAN.md  # this file
```
- Flip to public later: Settings → General → Danger Zone → Change visibility. No code changes required if secrets/keys are never committed (keep any future backend keys in `.env`, gitignored, from day one even though nothing needs one yet).

---

## 2. Core Math (RD / FCC Lattice)

Use integer coordinates with a parity constraint — this *is* the FCC lattice, and RD cells are exactly its Voronoi cells:

```
valid cell: (x, y, z) ∈ ℤ³ where (x + y + z) is even
```

**12 neighbor offsets** (each corresponds to one of the RD's 12 faces):
```
(1,1,0) (1,-1,0) (-1,1,0) (-1,-1,0)
(1,0,1) (1,0,-1) (-1,0,1) (-1,0,-1)
(0,1,1) (0,1,-1) (0,-1,1) (0,-1,-1)
```
Adding any offset to a valid cell yields another valid cell (parity is preserved automatically).

World-space position = lattice coord × scale factor `s` (start `s = 1`). No rotation logic needed — every RD sits in identical orientation.

---

## 3. World-State Schema

```json
{
  "worldName": "Rhombiverse",
  "version": 1,
  "cells": {
    "0,0,0": { "material": "base", "region": "core", "status": "approved", "authorId": "system" },
    "1,1,0": { "material": "base", "region": "core", "status": "approved", "authorId": "system" }
  },
  "meta": {
    "createdAt": "ISO timestamp",
    "lastModified": "ISO timestamp"
  }
}
```
- Key = `"x,y,z"` string (stable, JSON-safe, human-readable for debugging).
- `material` is a string enum, extend later (e.g. "garnet", "crystal").
- `region` and `status` (added in Phase 5.8, see below) exist from schema v1 even before moderation is implemented, so nothing downstream needs to change shape later — only start being enforced.
- This exact schema is what a future Penrose layer and future multiplayer sync will both read/write alongside — do not couple it tightly to renderer internals.

---

## 4. Build Order (feed each phase to Claude Code as its own task)

**Phase 1 — Lattice + Renderer (no interactivity yet)**
- Implement `lattice.js`: coordinate validation, neighbor lookup, world-space conversion.
- Implement `render.js`: Three.js scene, camera, one RD mesh generator (12 rhombic faces from 14 vertices — standard RD vertex set, scaled by `s`), instanced rendering for performance.
- Load `starter-world.json` (a single seed cell) and render it.
- **Success check:** one RD renders correctly in browser, camera orbits it.

**Phase 2 — Build Tool**
- Raycast from camera/cursor to detect which of the 12 faces of a hovered cell is targeted.
- Click/tap → compute neighbor coordinate via offset table → add cell to world-state → re-render.
- Right-click/long-press → remove cell (block delete).
- **Success check:** player can build outward face-by-face from the seed cell using only mouse/touch.

**Phase 3 — Local Persistence**
- `persistence.js`: save world-state to `localStorage` on every change; load on page open.
- Add "New World" / "Export JSON" / "Import JSON" buttons — this makes the JSON schema portable before any backend exists.
- **Success check:** refreshing the browser preserves the build; JSON can be manually shared/re-imported.

**Phase 4 — Deploy Publicly (playable, still single-player)**
- Deploy to GitHub Pages or Vercel from the private repo (deployment can be public even if source repo stays private).
- Share the live link — this is the earliest possible "public and interactive" milestone.
- **Success check:** anyone with the link can build in their own local session.

**Phase 5 — Shared World (optional next step)**
- Swap `persistence.js` backend from `localStorage` to a lightweight realtime store (e.g. Firebase Realtime DB or Supabase) keyed by the same `"x,y,z"` cell format — no schema change needed.
- **Success check:** two browser tabs see each other's placed blocks.

**Phase 5.5 — Planetoid Building + Radial Gravity**
- Planetoid = a cluster of RD cells filled within a given radius of a center coordinate. Provide a "fill sphere" tool (radius input → auto-fills all valid lattice cells within that radius of a chosen center), then allow normal Phase-2 hand-building/carving on top.
- Radial gravity: movement/physics must support gravity vectors that point toward a planetoid's center, not just globally down. Structural decision — flag this now so Phase 1–2 movement code isn't hardcoded to flat "down" gravity, even though radial gravity isn't implemented until this phase.
- Crystal-growth mode (optional, ties to Phase 6 timing): cells auto-add adjacent to filled cells with an open face, weighted by a resource/mineral value — planetoids that grow unattended using the same lattice math, modeling real garnet crystal growth.
- **Success check:** player can seed a planetoid, walk on its surface with gravity pulling toward its center, and watch it optionally grow new cells over time.

**Phase 5.8 — Trust Zones / Moderation (concentric ring model)**
- Extend world-state (already schema-ready via `region` and `status` fields from section 3):
  - `region`: `"core"` (curated/canon), `"reviewed"` (community content that passed review), `"open"` (unreviewed, opt-in only).
  - `status`: `"approved"` | `"pending"` | `"flagged"` | `"removed"`.
  - `authorId`: who placed/grew the cell — needed for accountability and takedown.
- Default spawn/visible world = `region: "core"` only. Players never land in unreviewed content by accident.
- New builds default to `region: "open"`, `status: "pending"` until reviewed — quarantined from the default view, not deleted.
- Minimum viable moderation pipeline: automated filter (profanity/basic content classifier) on submit → human review queue to promote `pending` → `reviewed`/`core`, or `pending` → `flagged`/`removed`.
- "Report" action on any cell/region → sets `status: "flagged"`, removes from default visibility pending review.
- Because world history is just JSON snapshots, rollback to a prior snapshot is the moderation team's safety net from day one — no special "undo" system needed.
- Age/mode flag on the client (not just spatial zoning) determines whether `reviewed`/`open` regions are even reachable for that session — spatial zones alone are not sufficient enforcement, since a bad actor could just build in a nominally "safe" area.
- **Note:** if the audience includes minors, this phase also has real legal dimensions (e.g. COPPA-type obligations for UGC platforms) beyond the technical design — worth review before Phase 4's public link goes out widely, not just before Phase 5.8 is coded.
- **Success check:** a newly placed cell is invisible in the default/core view until promoted; a flagged cell disappears from default view immediately; a snapshot rollback restores a prior clean world-state.

**Phase 6 — Penrose/RT Growth Layer (v2, separate spec)**
- New `growth.js` module, new `seeds` key in world-state, generation via substitution/L-system rules on rhombic triacontahedron geometry.
- Does not modify or depend on `build.js` — additive only.
- Spec pass done: `docs/RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` — real Ammann-rhombohedra/AKN-tiling geometry, verified numerically before being written down, scoped for plant/animal organic growth forms per direct instruction.
- Wave 1 implementation done (`src/geometry-extensions/growth.js`, `amoeba`/`moss`/`fungus`/`fern`) — see CLAUDE.md's 2026-08-13 status for what was built, real findings along the way, and how it was verified. Wave 2 (larger/more complex templates) not started, per the spec's own staging.

---

## 5. First Claude Code Prompt (copy-paste to start)

> Build Phase 1 of Rhombiverse per `RHOMBIVERSE_PLAN.md`: a Three.js web app that renders a single rhombic dodecahedron at the FCC lattice origin (0,0,0), using the coordinate system and neighbor-offset table in section 2, with a scale factor `s=1`. Set up the file structure exactly as in section 1. Camera should orbit the shape with mouse drag. No build/placement logic yet — this phase is renderer + lattice math only.

---

## 6. Vision Statement (English)

Rhombiverse is a world built from a single honest rule: everything is made of rhombi, and rhombi obey two different kinds of order at once. One is a crystal — rigid, repeating, minable, buildable, the same everywhere you look, the geometry real garnet already grows in. The other is a quasicrystal — aperiodic, five-fold, never quite repeating, the geometry evolution already reaches for in flowers and shells. Nothing here is arbitrary; every shape traces back to real crystallography and real mathematics, which means the world can keep surprising you without ever feeling random.

From that one rule, a whole range of things becomes possible: raise a mountain range face-by-face from a single seed block. Fill a sphere and stand on the surface of your own planetoid, gravity bending toward its core instead of some flat horizon. Plant something and let five-fold growth rules unfold it into a tree, a shell, a creature's frame — never twice the same, but always recognizably grown rather than generated. Leave a crystal field untouched and come back to find it larger, closer to some mineral logic than to any player's hand. Two people can build side by side in the same lattice and never place a block in exactly the same way twice, because 12 faces and infinite radii offer more room than a flat grid ever could.

It's less a building game than a small, coherent universe of shape — one where the built and the grown are drawn from the same rhombus, obeying different laws, and where every structure you make is, in some real sense, also a fact about geometry.

---

## 8. Deferred / Not Yet Decided
- Exact RD material/texture style.
- Auth/accounts for shared-world phase.
- Growth-layer L-system rule set (needs its own design pass).
- Specific moderation classifier/service choice for Phase 5.8.
- Legal review of UGC-and-minors obligations before wide public release.
- Wheel "Fold" gesture (RHOMBIVERSE_SPEC_WHEEL_FOLD.md), reframe Stage 5 -- parked 2026-08-28, not implemented. Reasoning: Fold's whole purpose was decluttering the Home wheel's 6 departments down to the 3 most-used; Model workspace mode (Stage 2's `workspaceMode`) already hard-locks Rhombivate/Trade/Explore/Rhombisis's dynamic half, leaving exactly Construct/Rhombitect/Rhombisis reachable -- the same 3 Fold would have shown. So Fold would be near-redundant in Model mode, and its only genuinely distinct value is decluttering the wheel in World mode (nothing else reduces that today). Direct user decision: not worth building until/unless working in World mode with the full wheel live is a real recurring want. If revisited, the resolved design (for reference, not yet built): visible-when-folded = Construct/Rhombitect/Rhombisis (uniform across modes, since Trade/Rhombivate/Explore were never in that set to begin with); folded-away faces ghost to 15% opacity but stay fully clickable (not locked); long-press Tab/Space (0.5s) or two-finger-tap/long-press a new center-hub indicator on touch; persisted after first use. The spec's own letter-shortcut auto-unfold clause has no existing hook to build on and was already scoped out.
