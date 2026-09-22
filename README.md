# Rhombiverse

Rhombiverse is a browser-based spatial editor for constructing and exploring
with rhombic dodecahedra, truncated octahedra, cuboctahedra, and their
related polyhedra on the FCC and BCC lattices — with symmetry tools,
Dualize (FCC↔BCC), and optional organic growth.

Everything is made of rhombi, and rhombi obey two different kinds of order
at once. One is a crystal — rigid, repeating, minable, buildable, the same
everywhere you look, the geometry real garnet already grows in. The other is
a quasicrystal — aperiodic, five-fold, never quite repeating, the geometry
evolution already reaches for in flowers and shells. Nothing here is
arbitrary; every shape traces back to real crystallography and real
mathematics.

From that one rule: raise a mountain range face-by-face from a single seed
block, fill a sphere and stand on the surface of your own planetoid with
gravity bending toward its core, plant something and let five-fold growth
rules unfold it into a tree or a shell, leave a crystal field untouched and
come back to find it larger. It's a multi-lattice spatial editor first — a
small, coherent field of shape to sculpt, decompose, and dualize.

See `RHOMBIVERSE_PLAN.md` section 6 for the full vision statement, and
`CLAUDE.md` for a technical map of this repo.

Try it at **[rhombiverse.vercel.app](https://rhombiverse.vercel.app)** — no
install, no account required.

Twin project to **[Polyhedraverse](https://polyhedraverse.vercel.app)**: here,
the lattice makes shapes possible — placement is constrained by what the
lattice geometrically allows. Over there, shapes make the space possible —
there's no lattice at all, connecting polyhedra face-to-face or vertex-to-
vertex is what produces structure in the first place. Same underlying
geometric rigor, opposite direction.

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

## RHOMBIS

A standalone, 117-stage geometric-packing puzzle game (`rhombis.html`,
linked from the welcome screen) that teaches real crystal-lattice
geometry through play rather than exposition — rotate a target shape,
tap pieces into place, watch it assemble. Difficulty ramps with stage
number: simple whole-shape arrangement first (does this piece go here,
no rotation involved), then real orientation-matching (6-way, 12-way,
and a 24-way tetragonal-disphenoid decomposition of the same RD), then
increasingly large composite puzzles — two real shapes joined into one
(Molecules, every real pairing from the shape catalog), a molecule whose
two halves are genuine mirror images of each other (Mirrored Molecule,
only possible for this lattice's handful of genuinely chiral shapes), a
single shape broken into irregular chunks instead (Hulls / Big Hulls, up
through a real 13-cell Cuboctahedron and a 20-cell tetrahedral stack),
three shapes joined at a shared hub (Branching Molecules), and Burr
Puzzles — the tier where placement ORDER matters, a "key" piece
genuinely blocked until the others around it are down. Four crossover
tiers combine these mechanics directly (a Burr key layered onto a
Molecule Split, a Mirrored Molecule, and a Branching Molecule; a Big
Hull whose chunks interlock at real crossing points — a boundary cell
splits clean in half, by a real plane through its own center, between
its home chunk and the one real neighboring chunk that actually borders
it there (not the exact faces of every possible neighbor at once, which
turned out to let two different chunks' own tabs meet at only a shared
point rather than a real flat seam whenever they weren't edge-adjacent)
— a real "half a cell missing, supplied by its neighbor" seam rather
than a clean whole-cell boundary, with the Burr key drawn fresh at random
from the chunks themselves every playthrough) — any stage built this
way shows its own real lineage in the stage picker. Two merged Crystal stages (real FCC and BCC
coordination geometry) each carry the other real crystallizing metals
as attributions rather than shipping a separate near-identical stage
per element. A real Alloy tier sits alongside them: 3 ordered B2
intermetallics (NiAl, FeAl, beta brass), 2 dilute substitutional alloy
steels (chromium, molybdenum — the dopant sites drawn at random every
playthrough), a real interstitial Carbon Steel (the actual octahedral
site carbon occupies in alpha-iron, a genuinely different piece of
geometry rather than a recolored cell), 4 real FCC dilute alloys
(electrum, white gold, rose gold, bronze), a real Salt (NaCl)
puzzle — 1 cation and its 6 real anion neighbors, the one stage built
on cross-species octahedral coordination rather than same-species
substitution — and a real Calcite/magnesite (CaCO3) puzzle one stage
later, the same rock-salt topology genuinely distorted along a trigonal
axis (a real, algebraically-derived ~101.5° rhombohedral angle) with a
flat CO3 triangular anion that flips orientation between layers, the
actual real reason this space group is rhombohedral rather than cubic.
Stage ORDER across the whole 117-stage main sequence tracks real
structural/mechanism difficulty end to end, not just within a tier —
BCC's own single-cell and two-cell introduction sits beside the FCC
"One Piece"/"Octahedron" pair near the very start (not at the end,
where a 1-piece stage would look like the "final boss" and undersell
everything harder before it), Multi-Cell (8 real pieces per its own two-cell alternate fill — a fused
whole-cell piece, a diagonal-octahedron bipyramid along the exact real
axis the two cells share, angled relative to the RD's own faces rather
than axis-aligned like the plain "Octahedron" stage, plus 2 merged
"hubcap" pieces per cell covering the other 10 real faces the
octahedron doesn't claim — all built from the RD's own real 12 rhombic
faces, facePieces(), the same primitive verified for the Disphenoid
crossover's own tabs)
sits last within its own real family of same-mechanism stages rather
than off among unrelated crossover puzzles just because it has more
pieces, and Salt/Calcite (8 pieces) sit before the larger 14-17 piece
Alloy stages despite sharing
the SAME key mechanism, since piece count is real difficulty too, but
only when comparing stages that actually share a mechanism — not a
flat count across completely different puzzle logic. A Color Match
tier duplicates the earliest
3-cell shapes with a genuinely different puzzle logic (each piece tied
to one real cell by color, not shape) as an easier on-ramp, positioned
before its own uncolored siblings. Every stage ships with decoy pieces
drawn from the same real shape family, not obviously-wrong filler.
`src/rhombis/`
is its own small engine: `puzzle-state.js` (pure state machine, no
THREE/DOM), `geometry.js` (mesh construction), `stages.js` (every
stage's own content, generated from real lattice math rather than
hand-placed wherever a generator can reach), `main.js` (input/render/
camera, shared by every stage) — plus real lattice math reused directly
from `geometry-extensions/dual-lattice.js`, `bcc-detail-lattice.js`,
`interstitial-lattice.js` (the real BCC interstitial site), and
`rock-salt-lattice.js` (the real NaCl structure, proven to be the FCC
lattice with its own octahedral holes filled — a genuine simple-cubic
lattice, needing no new mesh geometry at all), never re-derived.

## Structure

```
rhombiverse/
  index.html                # static entry point, Three.js via import map (no bundling; see "Running locally")
  rhombis.html               # Rhombis: standalone 117-stage geometric-packing puzzle (FCC + BCC), linked from the welcome screen
  api/                       # Vercel serverless functions (AI Gateway proxy: sculpt/cultivate/cyborg-suggest)
  src/
    rhombis/                 # Rhombis' own code: puzzle-state.js (pure state machine), geometry.js
                              #   (THREE mesh, built on core/lattice.js's pyramidPieces()), stages.js
                              #   (per-stage scene content), main.js (generic engine: input/render/advance)
    lattice.js               # RD/FCC coordinate math, 12-neighbor lookup
    render.js                 # Three.js scene, per-frame loop, most UI wiring
    build.js                   # placement/removal, face-picking, mouse+touch input
    bcc-build.js                # BCC dual-lattice build: same face-click mechanic, own store/mesh
    worldstate.js             # world JSON load/save/serialize (cells, seeds, claims, organisms, inventory, trades)
    persistence.js            # localStorage backend
    wheel.js                   # the Rhombic Wheel radial menu
    welcome.js                 # first-run overlay: rotating RD logo, mode choice, ENTER
    camera-persistence.js       # orbit camera position/target survive a reload
    settings.js                # sensitivity/FOV/quality/volume, Lab panel state
    sculpture.js               # Sculpt tool: symmetry/mirror, shell brush, Assistance Spectrum
    growth.js                  # TRIMMED 2026-09-22: real Ammann-rhombohedra tiling/SAT-overlap math only (feeds Duality Mode) -- the growth-over-time engine half moved to world-systems-archived/
    latticezoom.js               # sub-lattice zoom rendering (Lattice Zoom Stages 1-4; the organism/biomass Stage 5 was removed 2026-09-22)
    cyborg.js                      # guided-walkthrough narration engine
    byok.js                         # bring-your-own-AI-key (direct browser calls) + shared AI Gateway fallback
    worldshare.js                     # compressed shareable World links (client-side URL encoding, no server -- unrelated to the retired Shared World sync layer)
    changelog.js                       # What's New panel (fetches data/changelog.json)
    sfx.js                                # menu/build sound cues
    world-systems-archived/               # RETIRED, code kept intact but unreachable (see "World Systems" above): achievements.js, animals.js, asteroids.js, blackhole.js, hydrosphere.js, regions.js, starsystem.js, supernova.js, trade.js (2026-09-17); gravity.js, planetoidgen.js, player.js, evolution.js, cultivation.js, instance.js, growth.js (growth-engine half), sync.js (2026-09-22)
  data/
    starter-world.json         # single seed cell at the FCC origin -- the only World the app itself ever loads
    presets-archived/            # RETIRED 2026-09-22: Showcase World + the 7 planetoid "Body Types" spheres. Unreachable -- the "Load a World" picker itself is gone (see README's world-building removal note above)
    growth-presets-archived/      # RETIRED 2026-09-22: pre-grown organism data, no longer loadable (the growth feature that generated it is archived)
    cyborg/                         # guided-walkthrough subscripts -- just first-build-session.json now (onboarding.json moved to cyborg-archived/, see below)
    cyborg-archived/                  # RETIRED 2026-09-22: onboarding.json, narrated retired Full World/game content, its own trigger was already permanently unreachable
    changelog.json                    # What's New panel content, real dated entries
  supabase/schema.sql          # backend schema + RLS policies -- left untouched (frontend-only scope) even though Shared World sync itself was archived 2026-09-22
  docs/                        # design specs (see below)
  RHOMBIVERSE_PLAN.md          # construction-order plan -- read this first
  README.md
```

## Design documents (`docs/`)

Read `RHOMBIVERSE_PLAN.md` (repo root) first, then `docs/RHOMBIVERSE_PRINCIPLES.md`
(the cross-cutting design law every other doc complies with). The rest are
standalone addenda, each extending specific phases of the plan:

| Doc | Extends |
|---|---|
| `RHOMBIVERSE_PRINCIPLES.md` | Cross-cutting law: Grounded Simplicity, Isolation, Adaptive Damping |
| `RHOMBIVERSE_UIUX_BUILD_PLAN.md` | The Rhombic Wheel control surface, Sculpture/Duality/Cultivation Modes, Cyborg Mode + AI assistance, onboarding, world sharing/gallery, in-world trade (tracks B1–B7) |
| `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` | Phase 5.5 — planetoid building, radial gravity, BSG core |
| `RHOMBIVERSE_SPEC_BLACKHOLE.md` | Planetoid gravity — extreme case, asymptotic containment |
| `RHOMBIVERSE_SPEC_STAR_SYSTEM.md` | Planetoid gravity + water/ice — BSG at star scale |
| `RHOMBIVERSE_SPEC_SUPERNOVA.md` | Star system — Chandrasekhar-style mass threshold |
| `RHOMBIVERSE_SPEC_WATER_ICE.md` | Asteroids + planetoid gravity — hydrosphere/atmosphere |
| `RHOMBIVERSE_SPEC_ASTEROIDS.md` | Plan Phase 2 — resource acquisition, mining |
| `RHOMBIVERSE_SPEC_REGIONS.md` | Plan section 2/Phase 5.8 — ownership claims |
| `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` | Asteroids — barter trade, resource decay |
| `RHOMBIVERSE_SPEC_LOOPHOLES.md` | Patches gaps across regions/supernova/blackhole/asteroids/trade |
| `RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` | Phase 6 — aperiodic quasicrystal growth layer, real Ammann-rhombohedra geometry |
| `RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` | Growth layer — genome/phenotype, reproduction, speciation, trophic coupling |
| `RHOMBIVERSE_SPEC_ANIMALS.md` | Evolution — species/habitat, mobility, sexual reproduction, herbivory/carnivory |
| `RHOMBIVERSE_SPEC_LATTICE_ZOOM.md` | Growth/evolution — sub-lattice zoom rendering near organisms |
| `RHOMBIVERSE_COMPLIANCE.md` | Legal/safety checklist, phased by when each item is required |

## Contributing

Humans and AI coding agents are both welcome to open PRs — see
`CONTRIBUTING.md` for how this project actually works and
`CODE_OF_CONDUCT.md` for the community standard. `CLAUDE.md` is the
real technical onboarding doc, worth reading before `RHOMBIVERSE_PLAN.md`
if you're jumping straight into code.

## Running locally

No build step — plain ES modules loaded via an import map in `index.html`.
Serve the directory with any static file server, e.g.:

```
cd ~/rhombiverse
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Shared World mode, the AI Gateway
fallback, and the public Gallery need real Supabase/Vercel backends
(`src/app/sync.js`, `api/`) — everything else works fully offline against
`localStorage`.

Production (Vercel) additionally runs `npm run build` (`scripts/build.mjs`)
before deploying — real profiling on the actual Pi 500 this app is played
on (2026-08-24) found over half of `src/`'s JS bytes were comments, so
esbuild minifies each file in place (no bundling, same module graph) for a
real, measured improvement. This has no effect on local dev — the command
above still serves raw, fully-commented source directly, zero tooling
required.

The primary dev machine is that same Pi (arm64) — fine for day-to-day
work, but slow for anything browser-automation-heavy. Where a second
machine is available (`dicto-node` on the LAN, reachable over SSH), it's
worth using for that kind of task rather than waiting on the Pi.
