# Rhombiverse

Rhombiverse is a free, browser-based geometry builder. Everything is made
of shapes that fill space perfectly — starting from the rhombic
dodecahedron, the natural cell of the face-centered cubic (FCC) lattice —
and every piece traces back to real crystallography and real mathematics.
It is pure geometry: you place, remove, slice and view shapes on real
lattices, nothing more.

Try it at **[rhombiverse.vercel.app](https://rhombiverse.vercel.app)** — no
install, no account required.

Twin project to **[Polyhedraverse](https://polyhedraverse.vercel.app)**: here,
the lattice makes shapes possible — placement is constrained by what the
lattice geometrically allows. Over there, shapes make the space possible —
there's no lattice at all, connecting polyhedra face-to-face or vertex-to-
vertex is what produces structure in the first place. Same underlying
geometric rigor, opposite direction.

## What you can do

Pick a dimension from the **Dimension wheel** (or the **Wizard**, top left,
which lists every lattice with its pieces as rotating wireframes), then
tap to build. An empty world shows a cyan outline where your first piece
goes; tap a face to add the neighbor across it; long-press (or right-click)
removes.

- **2D** — three tile primitives (Parallelogram, Triangle, Hexagon), each
  at four named lattice angles, plus Kagome and Rhombille arrangements.
- **3D** — every piece listed under the lattice it lives on:
  - **FCC**: RD, Hemi RD, Hourglass, RD Quarter, Cube, Pyramid
  - **RD Dual**: Cuboctahedron, Octahedron
  - **BCC**: Truncated Octahedron; **BCC Interstitial**: Flattened
    Octahedron, Disphenoid
  - **Elongated Dodecahedron**, **Hexagonal Prism** and **Rhombohedra**,
    each on its own lattice
  - **Pyrochlore (3D Kagome)**: truncated tetrahedra with their
    corner-sharing tetrahedra
- **4D** — three worlds sharing one frame with the RD world:
  - **Tesseract** (Z4, the 4D cube)
  - **D4**: the 24-cell (the 4D RD — its slice at w = 0 is exactly the RD
    world) and the 16-cell
  - **Hyper-pyrochlore (4D Kagome)**: corner-sharing 5-cells with
    truncated and bitruncated 5-cell gaps; its rest slice is exactly the
    3D Pyrochlore world

  You see 4D as a **slice** (the default) or a **projection** (parallel or
  perspective). One geared slider moves the slice through w or turns it
  into the fourth dimension (XW, YW, ZW), with click-stops and Reset 4D.

- **Views** — World View (Color, Translucent, Skeleton), Lattice View (your
  build plus every open slot one step out), X-Ray cutaways (including
  diagonal cuts), Spherical, Duality Mode (the aperiodic tiling a crystal
  structure casts) and Dualize (FCC ↔ BCC).
- **One piece at a time** — tap a face to add a piece, long-press (or
  right-click) to remove one; 14 colors (or auto-assign per piece); Undo
  (↶) per dimension, with hold-to-scrub.
- **Almanac** — the math and geometry behind every piece and lattice.
- **Save** — your World saves automatically in the browser; Export /
  Import World saves every dimension to one file. **What's New** lists
  recent changes.
- **7 languages** (English, 日本語, Español, Français, 한국어, 中文,
  Русский), set in Settings.
- **RHOMBIS** — a separate 3D packing-puzzle game built on the same
  pieces (below).

It works on phones, tablets and desktop — touch first.


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
  index.html            # the app: static entry point, Three.js via import map (no bundling; see "Running locally")
  rhombis.html          # RHOMBIS, the standalone packing-puzzle game
  src/
    render.js           # Three.js scene, per-frame loop, most UI wiring
    core/               # lattice math, placement/removal and input (build.js), world state, persistence
    app/                # UI: wheels, Dimension wizard, 4D, 5D and 6D worlds and their slider, Almanac, settings, i18n, welcome, What's New
    geometry-extensions/  # every lattice beyond FCC: BCC, 2D tilings, ED, hex prism, rhombohedra,
                        #   Pyrochlore, 4D (lattice-4d.js), dual/Duality math, spherical view
    rhombis/            # RHOMBIS' own code
  data/
    starter-world.json  # the empty world every visit starts from
    changelog.json      # What's New
  scripts/              # build, and the verify:* checks (geometry, i18n, stale wording)
  tests/                # unit tests and the browser smoke test
  docs/                 # the user guide (7 languages), principles, compliance checklist
```

## Documents

| Doc | What it is |
|---|---|
| `docs/guide.md` (+ `guide.<lang>.md`) | How to use Rhombiverse, also served at /guide |
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
