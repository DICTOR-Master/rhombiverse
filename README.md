# Rhombiverse

Rhombiverse is a free, browser-based geometry builder **from 2D to 6D**.
Everything is made of shapes that fill space perfectly on real lattices —
starting from the rhombic dodecahedron, the natural cell of the
face-centered cubic (FCC) lattice — and every piece traces back to real
crystallography and mathematics: 2D tilings, 3D crystal lattices, 4D
polytope worlds, 5D and 6D quasicrystals, and Shells, a scene for building
hulls in colour bands. You place, remove, slice and view shapes; nothing
more.

Try it at **[rhombiverse.vercel.app](https://rhombiverse.vercel.app)** — no
install, no account, works on phones, tablets and desktop (touch first),
in 7 languages.

Twin project to **[Polyhedraverse](https://polyhedraverse.vercel.app)**:
here the lattice makes shapes possible — placement is constrained by what
the lattice allows. There, shapes make the space possible — polyhedra
joined face to face with no lattice at all. Same geometry, opposite
direction.

## What you can do

Pick a dimension from the **dimension picker** (or the **Wizard**, top
left, which lists every lattice with its pieces as turning wireframes),
then tap to build. An empty world shows a cyan outline where your first
piece goes; tap a face to add the neighbour across it; long-press (or
right-click) removes. The **User Guide** (in the app, or at
[/guide](https://rhombiverse.vercel.app/guide)) covers every control.

- **2D** — five tiles (Parallelogram, Triangle, Hexagon, Kite, Kagome) on
  four lattice angles (Square, RD Rhombus, Golden Rhombus, Triangular),
  plus the Rhombille pattern.
- **3D** — every piece listed under the lattice it lives on:
  - **FCC**: rhombic dodecahedron (RD), Hemi RD, Hourglass, RD Quarter,
    Cube, Pyramid
  - **RD Dual**: Cuboctahedron, Octahedron
  - **BCC**: Truncated Octahedron; **BCC Interstitial**: Flattened
    Octahedron, Disphenoid
  - **Elongated Dodecahedron**, **Hexagonal Prism** and **Rhombohedra**,
    each on its own lattice
  - **Pyrochlore (3D Kagome)**: truncated tetrahedra with their
    corner-sharing tetrahedra
- **Shells** (a 3D world of its own) — build **hulls** from shells of
  rhombic dodecahedra, each shell its own colour band, counted out from
  your first piece as a **cuboctahedron** (the magic numbers 13, 55, 147 …),
  a **sphere**, or a chosen **tetrahedron, cube, octahedron, rhombic
  dodecahedron or truncated octahedron**. Add or remove a whole shell in
  one tap; **Trim** cuts the hull exactly flat into its target shape;
  **Fragment** breaks any piece into its symmetric parts — halves, thirds,
  quarters, sixths, eighths, twelfths, sixteenths, 24ths or all 48 wedges —
  and single parts can be placed on their own. A **Scale** menu builds with
  bigger RDs (×2 to ×4), and **Merge** turns a cluster of small pieces into
  one big RD, or opens one back up.
- **Golden Rhombohedra** (a 3D world of its own) — build freely with the
  prolate and oblate golden rhombohedra, the two pieces of the 3D Penrose
  (Ammann–Kramer) tiling. The **Penrose check** colours each piece green
  where it belongs to the true aperiodic tiling and red where the build has
  drifted; Lattice View shows the true tiling around your build.
- **4D** — three worlds sharing one frame with the RD world:
  **Tesseract** (Z4), **D4** (the 24-cell, the 4D RD, whose slice at
  w = 0 is exactly the RD world, and the 16-cell) and **Hyper-pyrochlore
  (4D Kagome)** (corner-sharing 5-cells). See 4D as a **slice** or a
  **projection**; one geared slider moves the slice through w or turns it
  into the fourth dimension (XW, YW, ZW).
- **5D and 6D quasicrystals** — cut and projected from the cube lattices
  Z⁵ and Z⁶: **6D** is the icosahedral quasicrystal of prolate and oblate
  golden rhombohedra (the Ammann–Kramer tiling); **5D** is layers of the
  **Penrose tiling** as thick and thin rhombus prisms. The tiling decides
  each piece. **Phason** sliders slide the slice through the hidden
  dimensions (pieces flip), the **Approximant** slider steps through
  periodic crystals (1/1, 2/1, 3/2, 5/3 …) toward the true quasicrystal
  at τ, and **Window View** shows the acceptance window. The **Catalogue**
  holds 155 items — zonohedra up to the rhombic triacontahedron, every
  vertex star, higher-dimensional polytope shadows and 43 hyperprism
  bridges — each summoned by name or serial number to where it really
  occurs in your quasicrystal. **Connect** joins any two items with the
  shortest chain of real tiles between them.
- **Views** — World View (Colour, Translucent, Skeleton), Lattice View
  (the open slots around your build and its outer layers, fading inward),
  X-Ray cutaways (including diagonal cuts), Spherical, Duality Mode (the
  aperiodic tiling a crystal structure casts) and Dualize (FCC ↔ BCC).
- **Almanac** — the maths behind every piece and lattice, including cut
  and project, phasons and approximants.
- **Save** — your World saves automatically in the browser; Export /
  Import World saves every dimension to one file; Undo per dimension,
  with hold-to-scrub. **What's New** lists recent changes.
- **7 languages** — English, 日本語, Español, Français, 한국어, 中文,
  Русский: the interface, the User Guide and the Wizard.

## RHOMBIS

A standalone 3D geometric packing-puzzle game (`rhombis.html`, linked from
the welcome screen) built on the same pieces: 117 stages that teach real
crystal-lattice geometry through play. Rotate a target shape and tap
pieces into place. Stages run from single whole shapes to orientation
matching (6-, 12- and 24-way splits of the RD), molecules of joined
shapes, mirror-image molecules, hulls broken into chunks (up to a 13-cell
cuboctahedron and a 20-cell tetrahedral stack), branching molecules and
burr puzzles where placement order matters, plus crystal stages (real FCC
and BCC metals), alloys (NiAl, FeAl, beta brass, alloy steels, carbon
steel, electrum, white and rose gold, bronze), rock salt (NaCl) and
calcite. Stage order follows real difficulty, and every stage's decoy
pieces come from the same shape family. Its engine lives in `src/rhombis/`
and reuses the app's lattice maths rather than re-deriving it.

## Structure

```
rhombiverse/
  index.html            # the app: static entry point, Three.js via import map (no bundling; see "Running locally")
  rhombis.html          # RHOMBIS, the standalone packing-puzzle game
  src/
    render.js           # Three.js scene, per-frame loop, most UI wiring
    core/               # lattice math, placement/removal and input (build.js), world state, persistence
    app/                # UI: wheels, Dimension wizard, the 4D, 5D/6D and Shells worlds, Almanac, settings, i18n, welcome, What's New
    geometry-extensions/  # every lattice beyond FCC: BCC, 2D tilings, ED, hex prism, rhombohedra,
                        #   Pyrochlore, 4D (lattice-4d.js), quasicrystals and their catalogue,
                        #   RD pieces and hulls (rd-pieces.js), dual/Duality math, spherical view
    rhombis/            # RHOMBIS' own code
  data/
    starter-world.json  # the empty world every visit starts from
    changelog.json      # What's New
    catalogue-5d6d.json # the 5D/6D Catalogue
  scripts/              # build, and the verify:* checks (geometry, i18n, stale wording)
  tests/                # unit tests and the browser smoke test
  docs/                 # the user guide (7 languages), principles, compliance checklist
```

## Documents

| Doc | What it is |
|---|---|
| `docs/guide.md` (+ `guide.<lang>.md`) | The Rhombiverse User Guide, also served at /guide |
| `docs/RHOMBIVERSE_PRINCIPLES.md` | The design law: real geometry, simplest version, world as data |
| `docs/RHOMBIVERSE_COMPLIANCE.md` | What's in place legally, and what to re-check before adding a backend |
| `CLAUDE.md` | Technical onboarding: scope, running and checking, conventions |

## Contributing

Humans and AI coding agents are both welcome to open PRs — see
`CONTRIBUTING.md` for how this project actually works and
`CODE_OF_CONDUCT.md` for the community standard. `CLAUDE.md` is the
real technical onboarding doc.

## Running locally

No build step — plain ES modules loaded via an import map in `index.html`.
Serve the directory with any static file server, e.g.:

```
cd ~/rhombiverse
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Everything works fully offline — there
is no server side; your World lives in the browser's `localStorage`.

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
