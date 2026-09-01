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

## Current status (as of 2026-08-19)

Everything through Lattice Zoom (2026-08-14) plus the entire UI/UX
overhaul tracks B1–B6 (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`) is done. In
build order:

- **B1–B6** (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`) — DONE. Replaced the
  always-visible sidebar with the **Rhombic Wheel** radial menu
  (`src/app/wheel.js`) as the single control surface; added **Sculpture
  Mode** (`src/core/sculpture.js`, order-48 cubic symmetry group, Model/
  Chisel, an Assistance Spectrum up to AI-assisted Full-Cyborg), **Cyborg
  Mode** guided walkthroughs (`src/app/cyborg.js`, supports multiple
  concurrent instances — the manual toggle and the auto-started
  onboarding sequence are two separate instances), **Duality Mode**
  (reuses `growth.js`'s real Ammann-rhombohedra tile geometry, not
  separate projection math) and **Cultivation Mode**
  (`src/geometry-extensions/cultivation.js`), **bring-your-own-AI-key** support
  (`src/app/byok.js` — direct browser calls to Anthropic/OpenAI/etc., with a
  shared Vercel AI Gateway fallback in `api/` and a local keyword-parser
  last resort), an **achievements** toast system (`src/world-systems/achievements.js`),
  **World sharing** via compressed URLs (`src/app/worldshare.js`) and a
  public **Gallery** (`shared_worlds` table, `src/app/sync.js`), a sequenced
  first-visit **onboarding** walkthrough that loads the real Showcase
  World and ends with a clickable persona picker on the welcome screen,
  and a rebuilt **in-world trade UI** — walk near another player (visible
  as a live named avatar via Supabase Realtime **Presence**, a
  lightweight pseudonymous display name, no accounts) and use **Interact**
  to open a two-sided drag-and-tap offer view, replacing the old
  permanent Lab-panel trade form. All "Under Construction" branding was
  deliberately removed (2026-08-19, user feedback: it undermined trust).
- **B7 partially started** (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`) — the
  rest is the biggest remaining track (Lab view audit, accessibility
  pass, performance guardrails, OG screenshot, moderation/compliance
  scaffolding are all still open). Shipped so far: the versioned
  "What's New" changelog panel (`src/app/changelog.js`,
  `data/changelog.json`, real dated entries) replacing the branding
  that was removed above; and real touch controls for Walk/Explore mode
  (`player.js`'s `setVirtualMove`/`setVirtualKey`/`lookBy`, an on-screen
  joystick/jump button/drag-to-look zone in `render.js`) — Walk mode was
  previously completely unusable on touch (keyboard-only movement,
  Pointer-Lock-only look), and a prior session had worked around that
  by hiding its toggle on touch devices entirely; that hiding is now
  removed since there's something real to show. Also shipped, off-plan
  but explicitly requested: Cyborg Mode can now suggest a genuinely
  creative next build (`api/cyborg-suggest.js`, same three-tier AI
  pattern as Full-Cyborg) once its walkthrough finishes — Cyborg Mode
  itself stays narration-only, exactly what B3 defined it as.
- **Known, real, pre-existing gap found while building Walk-mode touch
  controls (not caused by that work, not yet fixed):** `render.js`
  passes `getMode: () => (walking ? null : currentMode)` into
  `build.js`'s `createBuildController`, and `onContextMenu`'s first
  line is `if (!getMode()) return;` — so right-click mining is
  currently a silent no-op while walking, on desktop too, contradicting
  the belt-approach hint text's own "right-click an asteroid cell to
  harvest it" promise. Needs a decision: should Walk mode's `getMode()`
  distinguish "can freely build/edit" (no) from "can still mine" (should
  probably be yes)?
- **A real CI regression chase, 2026-08-19** (see `tests/browser/
  smoke.mjs` and `.github/workflows/ci.yml`): the smoke test started
  failing/hanging from B6's first commit onward, for two distinct
  reasons, not one. (1) Cold JS parse/eval time genuinely grew past the
  old fixed 10s `waitForSelector` timeouts as the module graph grew
  across B1-B6 — recalibrated to 25s, a real test-maintenance fix, not
  a bug (bundling the module graph together was never the right fix
  for a test timeout — see `scripts/build.mjs`, added 2026-08-24, for
  the real production perf fix this project actually took: minify each
  file in place, no bundling, dev untouched). (2)
  `page.click('.wheel-item:has-text(...)')` reproducibly hung on one
  specific interaction, both locally and on GitHub's runners, even
  though a live diagnostic proved the DOM state was completely correct
  and stable every time (a MutationObserver over 2s of idle showed zero
  mutations, `elementFromPoint` confirmed no occluding element, a raw
  `querySelectorAll` via `evaluate()` found the target instantly) — a
  genuine Playwright/CDP-level polling failure, not an app bug. Fixed
  by dispatching `.click()` directly via `evaluate()` for wheel-item
  clicks instead of Playwright's own `page.click()`. Also bumped
  `actions/checkout`/`actions/setup-node` v4→v7 (clears a real Node-20-
  deprecated platform warning) while deliberately keeping
  `node-version: 20` for the jobs themselves — bumping that to 24 broke
  `node --test tests/unit/` outright (a real Node 22+ regression
  resolving a bare directory argument, reproduced locally too) and was
  reverted.

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
  → player-facing surface). `src/world-systems/evolution.js`.
- **`RHOMBIVERSE_SPEC_ANIMALS.md`** — done, all 6 stages (species/
  habitat, mobility, sexual reproduction, trophic herbivory/carnivory,
  habitat crossover, full verification). `src/world-systems/animals.js`.
- **`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md`** — done, all 6 stages (static
  sub-lattice geometry → camera-distance trigger → multi-level depth &
  blending → adaptive damping → real-organism/plant-coverage rendering
  → landscape aggregate state). `src/geometry-extensions/latticezoom.js`, wired into
  `src/render.js`.
- **Showcase world** — done, `data/presets/showcase-world.json` (a real
  continental planetoid with growth, evolved organisms, and animals),
  loadable via the `#preset-select` dropdown.
- **Spherical Toggle** (2026-09-01, `docs/RHOMBIVERSE_SPEC_ADDENDUM_SPHERICAL_TOGGLE.md`)
  — **Stage 1 only**: classification + superellipsoid math
  (`src/geometry-extensions/spherical-toggle.js`, pure/THREE-free, unit
  tested against this repo's own real vertex generators, not just the
  spec's illustrative numbers — a real numeric error in the spec's own
  Truncated Octahedron volume-matched-sphere constant was caught and
  fixed during review, 1.9695 -> 1.1371) wired into a HUD toggle
  (`#spherical-toggle`, `render.js`), reachable via the persistent HUD
  Wheel (`hud-wheel-3d.js`, replaced the last Duality-duplicate face).
  Covers every real placeable piece type (RD, Octahedron(gap), Cube,
  Cuboctahedron, Truncated Octahedron, Disphenoid — Disphenoid and Cube
  are their own per-cell Meshes, not InstancedMesh, so each has its own
  swap code path, see `sphericalClassificationFor`'s own header and the
  toggle handler's Cube/Disphenoid blocks). Direct instruction
  (2026-09-01): stay strictly to **sphere or superellipsoid**, no third
  `volumeSphere` render mode (it isn't a different shape anyway, just a
  different radius choice for a sphere). Cuboctahedron is the one
  superellipsoid; everything else is a plain sphere.
  Two real rounds of live-build feedback the same day reshaped the
  radius choice per shape, both grounded/verified before landing (see
  `tests/unit/spherical-toggle.test.mjs`, 220/220 passing):
  1. Truncated Octahedron ("spheres obviously too small") — its solved
     superellipsoid exponent (n≈1.585 < 2) pinches the shape down to
     0.866×R everywhere off-axis, unlike Cuboctahedron's n≈2.71 which
     bulges outward past R. Switched to a plain sphere at the same R
     (the real axis-face touching distance).
  2. RD/Cube/Octahedron ("RD slightly too small" / "cube and
     cube-octahedron slightly too big") — confirmed a systematic
     pattern: face-plane-distance R is the SMALLEST possible measure of
     a faceted shape's size, so it reads undersized across the board.
     Switched RD/Octahedron(gap)/Cube from face-plane R to a
     volume-matched R (still just a sphere, sized by real volume
     instead) — real volumes grounded in this repo's own decomposition
     (RD = cube+6-pyramids = 2·scale³; Octahedron = (4/3)·r³ at
     r=0.5·scale = scale³/6; Cube = scale³ trivially), independently
     re-verified from raw vertex data in the test file, not just
     algebra. Cuboctahedron's own superellipsoid was deliberately left
     unchanged — by the same "real vertices reach past face distance"
     analysis it's likely already undersized in absolute terms too, so
     "too big" there most likely reads as a relative effect against
     RD's now-corrected size, not an independent CO bug; flagged for
     DICTO to re-check once RD's fix is live rather than guessed at
     further. Disphenoid was also deliberately left at face-plane R
     (its own volume-matched R would be a ~54% jump — a much more
     elongated shape, no real feedback yet that it reads wrong, and
     that big a jump risks visible clipping through its own real faces).
  **NOT yet done**: Sculpture Mode's own mesh, Lattice Zoom's
  sub-lattice/aggregate-speckle meshes (both reuse RD's own geometry
  builder at other scales, out of scope for this stage), and Section 4
  (disphenoid-ring -> torus, explicitly deferred by direct instruction
  — disphenoids still convert individually, just never merged into a
  torus). Not yet confirmed in a live browser (no Playwright/npm
  available in this session's environment) — verify visually, esp.
  whether Cuboctahedron still reads oversized after this round, before
  treating Stage 1 as fully done.
- **Rhombic Wheel 3D** (2026-08-25, `src/app/rhombic-wheel-3d-core.js`/
  `rhombic-wheel-3d.js`) — the sole navigation surface now, on the real
  RD mesh. The old 2D radial menu (`wheel.js`) was fully removed the
  same day, per direct user decision — not flag-gated, deleted. No
  feature flag on the 3D wheel either; it's load-bearing, not optional.
  Real material/generator/species picker overlays and the drag-
  placement toggle survive the removal in `src/app/wheel-pickers.js`
  (extracted out of `wheel.js` before deletion so the 3D wheel's real
  functionality didn't depend on a file about to disappear). Tab/Space/
  `#hud-wheel-cue`/Escape all reclaimed to drive the 3D wheel directly.
  Home/Construct/Build/Alter/Rhombitect/Cultivate/Trade all real and
  reachable; department faces wired to real actions (mode-btn clicks,
  the real pickers), not placeholders, except Spiral Column/Templates
  and Pattern (genuine stubs — Pattern matches the *old* 2D wheel's own
  "coming soon" placeholder, not withheld functionality) and Replace
  (discovered broken in the 2D wheel too, before it was removed — no
  implementation anywhere). Full rationale:
  `docs/code-notes/app/rhombic-wheel-3d.md`.

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
  offset table — implement it once in `src/core/lattice.js`.
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

## Core vs. Modules

`RHOMBIVERSE_PLAN.md`'s "Core vs. Modules" section has the full
architecture and Migration Path; this is the short version for staying
inside the boundary while coding.

- **Core** (`src/core/lattice.js`, `src/core/sculpture.js`,
  `src/core/build.js`, `src/render.js`, `src/core/worldstate-core.js`,
  `src/core/persistence.js`) must never import from or depend on World
  Systems modules (mining, trade, regions, achievements, animals,
  hazards, hydrosphere). If a change to core seems to require such a
  dependency, stop and flag it rather than adding the import. **As of
  2026-08-23 (Migration Path Phase A) this is enforced for build.js/
  sculpture.js/worldstate-core.js**: none of them statically import
  `asteroids.js`/`regions.js` anymore — `render.js` injects the real
  functions (gated behind `features.js`'s `mining`/`economy` flags) via
  a constructor param (build.js) or each module's own
  `setRegionsIntegration()` (sculpture.js/worldstate-core.js/gravity.js).
  `render.js` itself is the one exception, and deliberately so — it's
  the app's own orchestrator (not yet split into a separate
  `render-core.js`/`index-orchestrator.js`, see `RHOMBIVERSE_PLAN.md`'s
  Migration Path Phase B), so its own direct World-Systems usage is
  expected, not a violation — though as of 2026-08-24 that usage is
  ALSO flag-gated end-to-end (`FEATURES.mining`/`economy`/`hazards`),
  closing what used to be an open gap here. Don't add a *new*
  Core→World-Systems dependency in any of the other five files.
- **The dual cube/octahedron structure exists now** (`src/core/dual.js`,
  merged 2026-08-23) — it's part of core, not optional, load-bearing,
  not gated behind a flag (`FEATURES.dualSculpture` exists but only
  controls whether the Sculpture Mode UI for it shows, per that flag's
  own comment). Don't confuse it with the separate, unrelated Duality
  Mode (`render.js`, Duality toggle), which shows the aperiodic
  Penrose-tiling shadow a structure casts, not a cube/octahedron dual
  mesh.
- New game-loop functionality belongs in World Systems, gated behind a
  flag in `features.js`, defaulted to `false` for anything genuinely new,
  and loaded via dynamic `import()` — not wired into core's always-on
  path. (`features.js`'s existing World Systems flags default to `true`,
  not `false` — deliberate, since those are already-shipped live
  features; see that file's own header comment before changing any of
  them.)
- Game-system PRs and modules are welcome and can be owned/maintained by
  other contributors independent of core.

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
   `src/app/sync.js`, gated behind an opt-in toggle (local single-player play
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
7. **UI/UX overhaul** (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`, tracks
   B1–B7) — a later, separate build plan layered on top of everything
   above once the core mechanics were all in place. B1–B6 DONE (see
   status above); B7 not started.

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
