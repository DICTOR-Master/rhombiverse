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

Play it at **[rhombiverse.vercel.app](https://rhombiverse.vercel.app)** — no
install, no account required.

## Core vs. Modules

The project's true differentiator is the FCC lattice / rhombic dodecahedron
geometry — not the continuously-simulated systems (mining, trade, etc.) built on top of
it. Those systems are valuable and genuinely fun, but secondary to the
geometry itself:

- **Core (always present):** lattice math (`lattice.js`), RD rendering,
  Sculpture Mode incl. build/chisel, base world-state schema, optional
  Shared World sync, plus BCC/TO Build, Cuboctahedron Build (now growable
  onto both lattice parities, so cuboctahedra can touch face-to-face, not
  just vertex-to-vertex — the Piece picker's "Octahedron" fills the gaps
  that opens up, a real zero-gap rectified cubic honeycomb, verified
  numerically), Lattice Quick-View, and Dualize (FCC↔BCC space-group
  dual, `dual-lattice.js`) — view-only overlay, always visible whenever
  Crystal Core cells exist.
- **Geometry Extensions (opt-in, still shape-focused):** radial gravity &
  planetoids (`gravity.js`, `planetoidgen.js`), Penrose/Ammann growth
  (`growth.js`), Duality Mode (periodic↔aperiodic tiling dual,
  `dual.js`, shown once grown Penrose/Ammann structures exist), lattice
  zoom (`latticezoom.js`), cultivation (`cultivation.js`).
- **World Systems (secondary, continuously-simulated, can be disabled or
  community-owned):** mining & resources, inventory, claims/regions
  (`regions.js`), trade (`trade.js`), achievements (`achievements.js`),
  animals (`animals.js`), hazards (`blackhole.js`, `supernova.js`,
  `starsystem.js`), hydrosphere (`hydrosphere.js`). `features.js`'s flag
  registry disconnects all of these together in Rhombeometry mode (mining,
  economy/claims, achievements, animals, hazards, hydrosphere all flip off
  at once) — see `RHOMBIVERSE_PLAN.md`'s Migration Path for the history.

A "Rhombeometry / Full World" mode toggle exists (welcome screen and
Lab Settings) — defaults to Rhombeometry, geometry-only.

## What this is (right now)

Everything lives behind one control surface, the **Rhombic Wheel** (Tab /
Space, or tap the "Menu" label bottom-left) — five categories, each opening
its own tools:

- **Build** — click/tap a face to place a block; right-click (or long-press
  on touch) always removes the clicked cell, in every mode. A material
  picker, Repeat (drag to place a run of cells), and a **Fill/Round/
  Excavate** planetoid toolkit for building whole spheres and retrofitting
  them (radial gravity bends toward the core once a body is large enough to
  have one).
- **Alter** — Dig, Smooth, Fill, Replace: reshaping existing structure.
- **Create** — **Sculpt** (a real order-48 cubic symmetry/mirror tool with a
  shell brush, Model/Chisel modes, and an Assistance Spectrum from fully
  manual up through an AI-assisted Full-Cyborg tier), plus body-generator
  and seed-planting shortcuts. A separate, fully isolated **Sculpture Mode**
  scratch workspace opens the same tool with nothing connected to your real
  World.
- **Grow** — **Cultivate**: real Ammann-rhombohedra/Penrose aperiodic
  growth (not baked animation) unfolds a planted seed into a tree, shell, or
  crystal cluster over time; a genome/phenotype evolution system lets
  planted organisms reproduce, mutate, and speciate; animals have habitats,
  mobility, and trophic relationships. **Duality Mode** shows the aperiodic
  tiling a crystal structure casts as its shadow, reusing the same real
  growth geometry rather than separate projection math.
- **Explore** — first-person walk mode with real gravity underfoot. On
  touch devices, a real on-screen joystick, jump button, and drag-to-look
  zone appear automatically — not just a desktop-only mode.

Supporting systems: **Shared World** (opt-in — Supabase realtime sync, no
account needed beyond a lightweight anonymous session), a **pseudonymous
display name** with live named avatars for other connected players, an
in-world **Interact** action for two-sided drag-and-tap barter trades,
mining/inventory/resource decay, ownership claims, an **achievements** toast
system, **World sharing** via a compressed shareable link, a public
**Gallery** of shared/showcase Worlds, a **What's New** changelog (the 🕘
button next to About), and **Cyborg Mode** — an optional guided walkthrough
that, once finished, can also suggest a genuinely creative next thing to
build (real AI, same three-tier pattern as Full-Cyborg: your own API key,
the shared Vercel AI Gateway, or a local fallback — never required to
play). Full-Cyborg itself (Sculpt/Cultivate's most assisted tier) uses that
same AI pattern.

The welcome screen is a rotating RD logo with two live antipodal ENTER
faces and a Mode choice (Pure Rhombeometry / Full World, defaulting
to Rhombeometry — geometry only). Picking Full World on a first-time
visit loads the real Showcase World (a continental planetoid with growth,
evolved organisms, and animals already in it) and walks you through
build → open the wheel → plant something → explore, rather than a
tutorial modal; Rhombeometry mode instead starts from a blank single-cell
world with no systems-flavored onboarding.

`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md` is the spec for this whole control-
surface/onboarding/AI-assistance layer (tracks B1–B7); B1–B6 are done, and
B7 (accessibility, performance guardrails, moderation/compliance
scaffolding) is partially started — the changelog panel and Walk mode's
touch controls are done, the rest is open. `CLAUDE.md`'s status section has
the full phase-by-phase build history underneath it (planetoid gravity,
water/ice, black holes, star systems, supernovae, Penrose growth,
evolution, animals, lattice zoom).

## Structure

```
rhombiverse/
  index.html                # static entry point, Three.js via import map (no bundling; see "Running locally")
  api/                       # Vercel serverless functions (AI Gateway proxy: sculpt/cultivate/cyborg-suggest)
  src/
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
    player.js                  # first-person walk controller
    sculpture.js               # Sculpt tool: symmetry/mirror, shell brush, Assistance Spectrum
    cultivation.js             # Cultivate tool: planting assistance tiers
    growth.js                  # Penrose/Ammann-rhombohedra aperiodic growth layer
    evolution.js                # genome/phenotype/reproduction/speciation for grown organisms
    animals.js                  # species, habitat, mobility, trophic relationships
    latticezoom.js               # sub-lattice zoom rendering near organisms/plants
    planetoidgen.js               # planetoid body generation (rocky/ice/gas/ocean/etc.)
    gravity.js, hydrosphere.js, blackhole.js, starsystem.js, supernova.js  # radial gravity + the four addenda
    asteroids.js                 # mining/resource belts
    regions.js                    # ownership claims
    trade.js                      # barter/decay data model
    cyborg.js                      # guided-walkthrough narration engine
    byok.js                         # bring-your-own-AI-key (direct browser calls) + shared AI Gateway fallback
    achievements.js                  # soft-goal toast system
    worldshare.js                     # compressed shareable World links
    changelog.js                       # What's New panel (fetches data/changelog.json)
    sync.js                             # Supabase realtime: cells, claims, trades, inventory, presence, gallery
    sfx.js                                # menu/build sound cues
  data/
    starter-world.json         # single seed cell at the FCC origin
    presets/                    # loadable Worlds, incl. the Showcase World
    growth-presets/               # pre-grown organism data
    cyborg/                         # guided-walkthrough subscripts (first-build-session, onboarding)
    changelog.json                    # What's New panel content, real dated entries
  supabase/schema.sql          # Shared World backend schema + RLS policies
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
