# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in
this repository. Written for a future Claude Code session with no memory of
the conversation that scaffolded this repo, so it can pick up cold.

## What this project is

Rhombiverse is a browser-based, Three.js voxel-style world-builder where the
"voxel" is a **rhombic dodecahedron (RD)**, packed via the real FCC lattice.
Players build outward face-by-face from a seed cell; the world is stored as
plain JSON, not baked geometry, so any renderer/client/future backend can
read and write it. See `RHOMBIVERSE_PLAN.md` section 0 (Meta-Paradigm) and
section 6 (Vision Statement) before touching anything else in this repo —
they're short and everything downstream assumes you've read them.

**This is a different project from `~/rhombispheres/`** (formerly named
`rhombiverse` until 2026-08-11, when it was renamed to free up this name).
`~/rhombispheres/` is an unrelated Python/pygame arcade game (DICTOROIDS-
family hemisphere-capture levels). Same brand word, nothing else shared —
don't cross-reference code or specs between the two repos.

**GitHub**: private repo at https://github.com/DICTOR-Master/rhombiverse
(account `DICTOR-Master`, `gh` already authenticated).

## Current status (as of 2026-08-14)

Everything through Lattice Zoom is done. In build order:

- **Phases 1–4** (renderer, build tool, local persistence, public deploy)
  — done, live.
- **Phase 5** (Shared World / Supabase realtime sync) — done, opt-in
  toggle, local single-player is still the default.
- **Phase 5.5** (Planetoid Building + Radial Gravity) — done, plus all
  four addenda (Water/Ice, Black Hole, Star System, Supernova).
- **Phase 5.8** (Trust Zones/Moderation) — done, **deliberately,
  intentionally partial**: the flagged/removed Report mechanism works;
  a three-tier reachability gate, age/mode selector, COPPA review, and
  moderator-scaling are explicitly deferred with documented reasons, not
  left incomplete by oversight.
- `RHOMBIVERSE_SPEC_REGIONS.md` (ownership claims), `_ASTEROIDS.md`
  (mining/resources), `_TRADE_INVENTORY.md` (barter/decay),
  `_LOOPHOLES.md` (cross-spec gap patches) — all done.
- **Phase 6** (Penrose/RT Growth Layer) — done, both waves (Wave 1:
  `amoeba`/`moss`/`fungus`/`fern`; Wave 2: `sapling`/`conifer`/`shrub`/
  `nautilus`/`scallop`/`spineling`/`cluster-frame`).
- **`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md`** — done, all 9 stages
  (genome/phenotype → reproduction/HGT/sexual selection →
  environmental selection → deterministic catch-up engine → trophic
  coupling → isolation enforcement → adaptive damping → moderation hook
  → player-facing surface). `src/evolution.js`.
- **`RHOMBIVERSE_SPEC_ANIMALS.md`** — done, all 6 stages (species/
  habitat, mobility, sexual reproduction, trophic herbivory/carnivory,
  habitat crossover, full verification). `src/animals.js`.
- **`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md`** — done, all 6 stages (static
  sub-lattice geometry → camera-distance trigger → multi-level depth &
  blending → adaptive damping → real-organism/plant-coverage rendering
  → landscape aggregate state). `src/latticezoom.js`, wired into
  `src/render.js`.
- **Showcase world** — done, `data/presets/showcase-world.json` (a real
  continental planetoid with growth, evolved organisms, and animals),
  loadable via the `#preset-select` dropdown.

Building the showcase world (2026-08-14) surfaced and fixed three real
performance bugs in `evolution.js`/`worldstate.js` (unbounded population
growth, and two O(n) registry/geometry recomputations hit inside O(n²)
loops — see that commit's own message for full detail). The real
worst-case timing improved ~40s→~2s, verified via `node --test`. A
live-browser crash still reproduced afterward under headless/software
(SwiftShader) rendering in this session's own sandboxed dev environment
— **root-caused and confirmed resolved same day**: retested headed,
against a real GPU via the actual X display (`DISPLAY=:0`, not headless),
and the exact same scenario that reliably crashed headless stayed at
2–34ms round-trip latency for a full 20s hold-still with zero issues.
The crash was a headless/software-rendering artifact of this dev
sandbox, not a real app bug reachable by an actual player on a normal
GPU-accelerated browser.

Full reasoning, every tuned constant's derivation, and every real bug
found is in `git log`/the GitHub repo history itself (already pushed) --
this section states what's CURRENTLY true, it does not narrate how it
got there. If you need the story behind something, `git log --oneline`
and the commit bodies are the real record, not a second markdown file
duplicating them.

## Read this before touching anything

- **No build step, by design.** `index.html` loads Three.js via an ES
  module import map from a CDN — no npm/webpack/vite. This is a direct
  application of Grounded Simplicity (`docs/RHOMBIVERSE_PRINCIPLES.md`
  section 0): the simplest thing that still works, and it keeps the repo
  trivially deployable as static files (GitHub Pages / Vercel, Phase 4).
  Don't introduce a bundler unless a real requirement forces it.
- **The world is data, not baked geometry** (`RHOMBIVERSE_PLAN.md` section
  0, the "golden rule"). Every mechanic in every spec extends the same JSON
  world-state additively — new top-level keys (`planetoids`, `claims`,
  `asteroidBelts`, `playerInventory`, `pendingTrades`) or new per-cell
  fields, never a breaking schema change. If an implementation task seems
  to require restructuring existing schema fields, stop and re-read the
  relevant spec — that's almost certainly not what's being asked for.
- **`RHOMBIVERSE_PRINCIPLES.md` governs every other doc and is not optional
  reading.** Three binding laws, in order of precedence:
  1. **Grounded Simplicity** — borrow real physics or established
     convention over inventing something arbitrary; prefer the simplest
     version that still works. Applied throughout: FCC crystallography,
     white-dwarf-density-as-gravity (Blackstar-Glassite), Schwarzschild
     asymptotic behavior (black hole), Chandrasekhar-limit detonation
     (supernova), icy-moon subsurface oceans (Ice 9.9).
  2. **Isolation** — any subsystem that can go unstable must define its own
     bounded **blast radius**; a local problem never propagates world-wide.
  3. **Adaptive Damping** — correction/tolerance mechanisms must widen
     (boundedly) with repeated correction and decay during calm periods,
     not use a single fixed threshold forever. Reused verbatim (not
     reinvented) by black hole cost-scaling, supernova threshold approach,
     asteroid population-scaled spawning, and inventory decay.
  Every future spec is expected to state its blast radius and its
  volatility/decay tuning explicitly, the same way "Success Checks"
  already is a required section.
- **`shellCount(n) = 10n² + 2`** (FCC shell size at radius `n`) is the one
  formula reused across nearly every subsystem: core-cavity sizing
  (gravity), recentering-shockwave tolerance (gravity), asymptotic
  space-generation cost (black hole), asteroid node internal shape, claim
  allocation shell-filling (regions). Implement it once, import it
  everywhere — do not let a second spec quietly reimplement it.
- **12-neighbor FCC adjacency** is the other universal primitive: valid
  cell = `(x,y,z) ∈ ℤ³` where `x+y+z` is even; 12 offsets in
  `RHOMBIVERSE_PLAN.md` section 2. Lattice propagation (hydrosphere
  permeation), shell counting, and claim allocation all walk this same
  offset table — implement it once in `src/lattice.js`.
- **"region" is two unrelated fields — do not conflate them.** The per-cell
  `region` field (`RHOMBIVERSE_PLAN.md` Phase 5.8) is a *moderation*
  status (`core`/`reviewed`/`open`). Ownership is a separate field,
  `claimId` (`docs/RHOMBIVERSE_SPEC_REGIONS.md`). A cell can have both at
  once; they answer different questions. This collision is called out
  explicitly in the regions spec — read it before touching either field.
- **`destructible` is a single flag with two effects, not two flags.** It
  lives on a `claims` entry (not per-cell) and gates both block-destruction
  *and* entity-pull consent for that claim (the entity-pull gap was a
  loophole fixed in `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` section 5 — don't
  add a second consent field for entities, extend the existing one).
- **Cross-player black hole/supernova consumption is never allowed, full
  stop — binding direct instruction, 2026-08-12.** Not opt-in, not
  `destructible`-gated: `blackhole.js`'s `applyBlackHoleConsumption` and
  `supernova.js`'s `detonate` both skip any candidate cell whose
  `authorId` (stamped from Supabase's `author_id` column by `sync.js`,
  merged into cell data client-side) differs from the black hole/star's
  own sticky `coreCell.authorId`. This predates and is independent of
  Phase 5.8's eventual region/claim/consent system — treat it as a hard
  floor Phase 5.8 builds on top of, not something Phase 5.8 introduces.
  Any future consumption-adjacent mechanic (new spec, new material) must
  preserve this check, not bypass it.
- **Decay-reset and multi-account loopholes are spec-acknowledged, not
  spec-solved.** `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2 explicitly
  states multi-accounting has no full spec-level fix (needs platform-level
  account verification, out of scope). Don't write code or comments
  implying it's solved — document it as a known gap, per that spec's own
  instruction.

## Build order (full detail in `RHOMBIVERSE_PLAN.md` section 4)

Phases 1–4 are the base game (single-player, local, becomes public/static
once deployed). Phase 5+ and the spec addenda layer on progressively:

1. **Lattice + Renderer** — one RD renders, camera orbits. No interactivity.
2. **Build Tool** — face-picking raycast, click to add/remove cells.
3. **Local Persistence** — `localStorage` save/load, JSON export/import.
4. **Deploy Publicly** — static deploy (GH Pages/Vercel), still single-player.
   *`docs/RHOMBIVERSE_COMPLIANCE.md`'s "Required before Phase 4" checklist
   (LICENSE, ToS, Privacy Policy, SECURITY.md, XSS audit) must be done
   before this phase ships, not after.*
5. **Shared World** (optional) — swap persistence backend to realtime sync.
   DONE, 2026-08-12 (see status above) — Supabase `public.cells` table +
   `src/sync.js`, gated behind an opt-in toggle (local single-player play
   is still the default and fully unaffected when it's off).
5.5. **Planetoid Building + Radial Gravity** — DONE, commit `30cd1c8` (2026-08-11,
     see status above), except crystal-growth (intentionally deferred to
     Phase 6 timing). `docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`.
     Also unlocks four addenda, whose REAL dependency order is not the
     order the docs list them in: **Water/Ice → Black Hole → Star System
     → Supernova** (Star System hard-depends on Water/Ice's hydrogen/
     oxygen; Supernova depends on both Star System and Black Hole).
     - Water/Ice (`SPEC_WATER_ICE.md`) — DONE, commit `ce528da` (2026-08-11).
     - Black Hole (`SPEC_BLACKHOLE.md`) — DONE except the Phase 5.8-
       dependent cross-player consent model, deliberately scoped for
       single-player per direct instruction (see status above).
     - Star System (`SPEC_STAR_SYSTEM.md`) — DONE (2026-08-11, see status above).
     - Supernova (`SPEC_SUPERNOVA.md`) — DONE (2026-08-11, see status above). All four addenda complete.
5.8. **Trust Zones / Moderation** — region moderation states + review
     pipeline. DONE, deliberately partial (see status above).
     `docs/RHOMBIVERSE_SPEC_REGIONS.md` (ownership claims) and
     the asteroid/trade specs assume this exists — implement before those
     if working out of order. *`RHOMBIVERSE_COMPLIANCE.md`'s Phase 5.8
     checklist includes a real COPPA review if minors may use the app —
     legal, not just technical.*
6. **Penrose/RT Growth Layer** (v2) — additive-only `growth.js`, does not
   modify `build.js`. DONE, both waves (see status above).

`docs/RHOMBIVERSE_SPEC_ASTEROIDS.md` (mining/resources) and
`docs/RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` (barter/decay) extend Phase 2's
build/delete tool and can be built any time after it, independent of the
5.x gravity/moderation track — DONE (see status above). `docs/
RHOMBIVERSE_SPEC_LOOPHOLES.md` patches gaps across five other specs — DONE,
already applied.

## Compliance

`docs/RHOMBIVERSE_COMPLIANCE.md`'s Phase 4 checklist (`LICENSE`,
`TERMS.md`, `PRIVACY.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`CONTRIBUTING.md`) is done — all present at repo root, the app is
publicly deployed. Any NEW backend-auth/rate-limiting/GDPR-relevant
surface added going forward should be checked against that doc directly,
not assumed pre-cleared by this note.
