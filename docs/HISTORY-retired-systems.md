# History: retired world-building systems

Developer reference only. Rhombiverse is pure geometry; this records how
the earlier world-building/game layer (and its removal) worked, moved out
of the README on 2026-09-24 so the README presents only the app as it is
now.

**2026-09-24: the archive itself was deleted** (direct instruction: "remove
all stale code"): `src/world-systems-archived/`, `data/presets-archived/`,
`data/growth-presets-archived/`, `data/cyborg-archived/`, the unit tests
that only covered them, the unused `api/cultivate-intent.js`, and Lattice
Zoom (`latticezoom.js`, the orange sub-lattice that faded in near the
camera -- a growth-layer leftover that read as seeds growing). The
archived data had also still been shipping in the published site
(`scripts/build.mjs` copies `data/`). Everything is recoverable from git
history: restore from commit `3a5069b` (the last commit before the
deletion), e.g. `git show 3a5069b:src/world-systems-archived/growth.js`.
The live Penrose/Ammann-rhombohedra tiling math was NOT deleted -- it's
`src/geometry-extensions/growth.js` (used by Duality Mode) -- and the
Penrose growth spec stays in `docs/`; both are meant to be recycled in
the 5D/6D quasicrystal work.

## Core vs. Modules

The project's true differentiator is the FCC lattice / rhombic dodecahedron
geometry. World Systems (mining, trade, claims, achievements, animals,
hazards, hydrosphere — see below) are retired: the code is archived, not
deleted, but permanently unreachable in the running app. Rhombiverse is a
geometry/spatial editor first, not a survival-game loop with geometry
attached.

- **Core (always present):** lattice math (`lattice.js`), RD rendering,
  Sculpture Mode incl. build/chisel, base world-state schema, optional
  Shared World sync, plus BCC/TO Build, Cuboctahedron Build (now growable
  onto both lattice parities, so cuboctahedra can touch face-to-face, not
  just vertex-to-vertex — the Piece picker's "Octahedron" fills the gaps
  that opens up, a real zero-gap **rectified cubic honeycomb**, verified
  numerically), Lattice Quick-View, and Dualize (FCC↔BCC space-group
  dual, `dual-lattice.js`) — view-only overlay, always visible whenever
  Crystal Core cells exist.
  - **The cubic lattice this is a rectification of is real and already
    reachable, not a separate hidden system** — spelled out explicitly
    here since it wasn't obvious before: "rectified cubic honeycomb"
    means the cuboctahedron+octahedron combination above is the
    vertex-truncated version of the plain **cubic honeycomb** — the same
    doubled-parity lattice points, filled with ordinary cubes instead.
    Lattice Quick-View's own `cube` mode already renders each built
    cell's inscribed cube (`pyramidPieces(SCALE).cube`, edge = `SCALE`)
    at the single FCC parity; placed at BOTH parities (the same two
    positions `cubocta`/`octahedron` Quick-View modes already preview)
    those cubes touch face-to-face with zero gap and zero overlap — no
    new geometry needed anywhere, only combining pieces that already
    exist. `geometry-extensions/rock-salt-lattice.js` (added for
    Rhombis's own real NaCl puzzle) is the same real structure again,
    proven independently and numerically: rock salt's own two ion
    sublattices, combined, are provably this identical simple-cubic
    lattice (real coordination number 6), which is exactly why each
    ion's own natural piece shape there is a plain cube too.
- **Geometry Extensions (opt-in, still shape-focused):** Duality Mode
  (periodic↔aperiodic tiling dual, `dual.js`, using the deterministic
  Ammann-rhombohedra tiling math kept in the trimmed `growth.js`), lattice
  zoom (`latticezoom.js`). Radial gravity & planetoids (`gravity.js`,
  `planetoidgen.js`), Penrose/Ammann growth-over-time and cultivation
  (`growth.js`'s growth-engine half, `cultivation.js`) were archived
  2026-09-22 — see the second world-building removal note below.
- **World Systems (retired — code archived to `src/world-systems-archived/`,
  not reachable in the app):** mining & resources (`asteroids.js`),
  inventory, claims/regions (`regions.js`), trade (`trade.js`),
  achievements (`achievements.js`), animals (`animals.js`), hazards
  (`blackhole.js`, `supernova.js`, `starsystem.js`), hydrosphere
  (`hydrosphere.js`). `features.js` forces all of these off permanently
  now (`settings.js`'s `getSettings()` forces `pureGeometry: true`
  unconditionally, so there's no live toggle back on) — see
  `RHOMBIVERSE_PLAN.md`'s Migration Path for how this was built, and
  this repo's own commit history for the retirement itself. The modules
  and their Supabase tables (`claims`, `asteroid_regrowth`,
  `player_inventory`, `pending_trades`) are untouched — archived for
  reference/possible future use, not deleted, but nothing in the running
  app can reach them anymore. **2026-09-17**: went a step further than
  the flag-off state above — removed every remaining confusing-but-
  reachable trace, not just made them inert: the Claim/Trade/Interact/
  asteroid-mining/inventory UI (`index.html`, `render.js`) is gone
  entirely rather than merely hidden, the wheel menu's own "Trade"
  doorway is a plain unlabeled Spare face now rather than a masked
  department, `evolution.js` was found to be mis-filed under
  `world-systems/` despite being genuinely live (the real "plant
  something and let it grow" feature) and moved to
  `geometry-extensions/`, and the multiplayer presence/avatar system
  (`otherPlayers`, live name tags, the in-world "Interact" trigger) was
  removed as unused — checked directly against the live Supabase data
  first: `pending_trades`/`player_inventory`/`asteroid_regrowth` were
  all empty, `claims` had only 6 rows (dev testing, not real usage).
  Every archived spec doc (`docs/RHOMBIVERSE_SPEC_{ANIMALS,ASTEROIDS,
  BLACKHOLE,SUPERNOVA,TRADE_INVENTORY,WATER_ICE,REGIONS,LOOPHOLES}.md`)
  now says so at the top, rather than reading as a live, current spec.
  **2026-09-22 (second world-building removal pass):** went further —
  the 2026-09-17 pass kept gravity/planetoids, growth/evolution/
  cultivation, walking/exploring, and Shared World sync live, judging
  them "real geometry, not game trappings." Revisited against a
  stricter bar (deterministic, on-demand math + rendering only, no
  state that simulates itself over time) and archived all of them:
  `gravity.js`, `planetoidgen.js`, `player.js` (the walk controller),
  `evolution.js` (a real agent-based simulation that advances multiple
  generations across elapsed real time, including while the tab was
  closed — the "plant something and let it grow" framing didn't hold up
  once it was clear `resolveCatchUp` does exactly that), `cultivation.js`,
  `instance.js`, and `app/sync.js` (the Supabase realtime layer, Gallery
  included) all moved to `world-systems-archived/`. `growth.js` was
  split rather than archived wholesale: its real, deterministic Ammann-
  rhombohedra tiling/SAT-overlap math (used live by Duality Mode) stayed
  in a trimmed `geometry-extensions/growth.js`; the growth-over-time
  engine (species templates, tick-rate-limited `growSeed`/`applyGrowth`)
  moved to the archive with everything else. The Rhombic Wheel's Grow
  and Explore categories are gone (their faces are plain Spare now,
  same treatment as Trade); `workspaceMode`'s Model/World toggle stays
  (it now only gates Cuboctahedron Build, an unrelated persistent-World
  feature). Every relevant spec doc
  (`docs/RHOMBIVERSE_SPEC_{PENROSE_GROWTH,EVOLUTION_ECOSYSTEM,
  PLANETOID_GRAVITY}.md`) now says so at the top. This pass also fixed a
  real, pre-existing CI break (`tests/unit/regions.test.mjs` and 2 other
  test files imported a stale pre-2026-09-17 path) and the `evolution.js`
  "mis-filed" note above — it's genuinely retired now, not live geometry
  under the wrong directory. **Same day, follow-up:** the bundled preset
  Worlds carried the same game-world framing and were archived too — the
  Showcase World preset (`data/presets-archived/showcase-world.json`)
  turned out to embed 22 planted seeds and 11 organisms alongside its 459
  real cells, silently orphaned data once growth/evolution rendering was
  gone; the 7 planetoid "Body Types" presets (Rocky Planetoid, Ice Moon,
  Gas Giant, ...) carried the same framing in name even though they're
  plain cell spheres with no game data. The in-app "Load a World" picker
  is gone with them (`index.html`, `render.js`) — Export/Import World and
  World sharing (compressed link) are untouched. The app's own first-visit
  load path no longer branches on Showcase World at all (it was already
  permanently unreachable — `settings.js` forces `pureGeometry: true`
  unconditionally — so this was dead-code cleanup, not a behavior change);
  every visit now loads the same single-cell `starter-world.json`, and the
  already-unreachable onboarding tour trigger was removed alongside it
  (`data/cyborg-archived/onboarding.json`).

## What this is (right now)

Everything lives behind one control surface, the **Rhombic Wheel** (Tab /
Space, or tap the "Menu" label bottom-left) — three categories, each opening
its own tools (down from five as of 2026-09-22; Grow and Explore are
retired, see the second world-building removal note above):

- **Build** — click/tap a face to place a block; right-click (or long-press
  on touch) always removes the clicked cell, in every mode. A plain color
  picker (14 swatches, Auto-assign option that gives every piece type its
  own default color automatically), Repeat (drag to place a run of cells),
  and a **Fill/Round/Excavate** toolkit for shell-based structures. A
  standalone **World View** toggle (the three-rings face on the corner HUD
  wheel) switches the whole build between Color, Translucent, and Skeleton
  (ghost fill + edge outline) at a glance.
- **Alter** — Dig, Smooth, Fill, Replace: reshaping existing structure.
- **Create** — **Sculpt** (a real order-48 cubic symmetry/mirror tool with a
  shell brush, Model/Chisel modes, and an Assistance Spectrum from fully
  manual up through an AI-assisted Full-Cyborg tier). A separate, fully
  isolated **Sculpture Mode** scratch workspace opens the same tool with
  nothing connected to your real World. **Duality Mode** shows the
  aperiodic tiling a crystal structure casts as its shadow, using the
  deterministic Ammann-rhombohedra tiling math kept in the trimmed
  `growth.js` (its growth-over-time engine was archived 2026-09-22 — this
  is client-side view math only, your cells are untouched).

Supporting systems: **World sharing** via a compressed shareable link (pure
client-side URL encoding, no server involved — unrelated to and unaffected
by the Shared World sync layer archived 2026-09-22), a **What's New**
changelog (the 🕘 button next to About), and **Cyborg Mode** — an optional
guided walkthrough that, once finished, can also suggest a genuinely
creative next thing to build (real AI, same three-tier pattern as
Full-Cyborg: your own API key, the shared Vercel AI Gateway, or a local
fallback — never required to use). Full-Cyborg itself (Sculpt's most
assisted tier) uses that same AI pattern. (An in-world Interact action for
barter trades and a live named-avatar presence layer for other connected
users, plus mining/inventory/resource decay and ownership claims, existed
here too — removed 2026-09-17, unused in practice: checked directly
against the live Supabase data first, and every relevant table was empty
or dev-testing-only. Shared World itself — realtime multiplayer sync and
the public Gallery it fed — was archived 2026-09-22 along with the rest of
the second world-building removal pass.)

**7 languages** (English, 日本語, Español, Français, 한국어, 中文,
Русский — `src/app/i18n.js`, matching Polyhedraverse's own set exactly)
via the Language selector in Settings, persisted alongside the other
Settings values and shared with RHOMBIS through that same store. Scoped
to this app's own interface chrome only — never shape/material/species/
world-preset names, the same discipline Polyhedraverse's own i18n uses.
Covers the always-visible chrome (HUD, Settings basics, World
import/export/sharing, Shells, Welcome overlay) as of 2026-09-17; the
Sculpt panel and the AI section are a follow-up phase, not yet
translated. Walk mode and Gallery keys were retired 2026-09-22 along
with the systems they belonged to.

The welcome screen is a rotating RD logo with two live antipodal ENTER
faces. It used to also offer a Rhombeometry/Full World mode choice here,
picking Full World on a first visit loading a pre-built Showcase World
with a systems-flavored tour — both retired along with World Systems
above. Every visit now starts the same way: a blank single-cell world,
geometry only, no onboarding tour.

`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md` is the spec for this whole control-
surface/onboarding/AI-assistance layer (tracks B1–B7); B1–B6 are done, and
B7 (accessibility, performance guardrails, moderation/compliance
scaffolding) is partially started — the changelog panel and Walk mode's
touch controls are done, the rest is open. `CLAUDE.md`'s status section has
the full phase-by-phase build history underneath it (planetoid gravity,
water/ice, black holes, star systems, supernovae, Penrose growth,
evolution, animals, lattice zoom).

