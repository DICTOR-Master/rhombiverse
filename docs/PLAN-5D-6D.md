# Plan: 5D and 6D quasicrystal worlds

Status: agreed design, not started. Delete this file once every stage
has shipped (the code and the guide then describe the feature).

## The design (agreed with the user, 2026-09-25)

- **6D = icosahedral quasicrystal**: the Ammann–Kramer tiling of prolate
  and oblate golden rhombohedra, cut and projected from Z⁶.
  **5D = decagonal quasicrystal**: Penrose rhombus layers stacked into
  prisms, from Z⁵. Both are 3D builds, on **one cut-and-project engine**.
- **Pieces**, from the Shape button (bottom left) as usual. 6D: prolate
  and oblate golden rhombohedra. 5D: thick and thin Penrose rhombus
  prisms. One at a time: tap a face to add the neighbour across it,
  long-press to remove. Colour button as usual.
- **Slider**: ONE slider with mode buttons, like 4D, and each mode keeps
  its own value: `Phason 1 · Phason 2 · Phason 3 · Approximant`. Phason 3
  is hidden in 5D (not greyed). Approximant snaps to the Fibonacci stops
  1/1, 2/1, 3/2, 5/3, 8/5 … → τ (a periodic crystal at the start, the
  true quasicrystal at τ). A phason slide moves pieces in and out of the
  slice, the way W-depth does in 4D. No XW/YW/ZW rotations.
- **Views**: Lattice View (the surrounding tiling as a ghost outline,
  extending past the build and flipping live as you slide), Window View
  (the acceptance window in the hidden dimensions: a rhombic
  triacontahedron for 6D, pentagons for Penrose, with your pieces'
  points; a point crossing its edge is a tile appearing or vanishing),
  and World View: Colour · Translucent · Skeleton.
- **Catalogue**: about 250 entries in a static file, no backend. About
  100 quasicrystal patches, 40–60 polytopes, 30–50 zonohedra, 10–20
  bridge pieces. Each entry is a few parameters and the app computes its
  geometry. Serial ranges per kind so numbers never change: 1–999
  polytopes, 1000–1999 zonohedra, 2000–2999 bridge pieces, 3000+ patches.
  Reached from a Wizard showcase and by serial-number lookup.
- **Summon**: pick an item, and a ghost outline appears; tap to move it
  (snapped to the lattice), tap the ghost to place it. It lands as
  ordinary editable pieces (a deliberate exception to one piece at a
  time); pieces that would overlap are skipped. The slider slides
  (animated, about 0.5 s) to the item's own settings. The whole summon
  is one undo step, which also restores the previous settings.
- **Info (i)**: each summoned item (serial, name, settings; tap to slide
  back to it), counts of hand-placed vs summoned and visible vs hidden
  pieces, and the current slider settings.

## Stages

Each stage ships on its own, fully working, with its checks passing.

**1. Engine and checks (no UI).** *Shipped.*
`src/geometry-extensions/quasicrystal.js`: Z⁵/Z⁶ projection into
physical and hidden space, the acceptance window, the window test
under a phason offset, which lattice faces become tiles, the
neighbour across a tile face, and approximants (τ replaced by a
Fibonacci ratio). Reuse `growth.js` (`PHI`, `STAR_DIRECTIONS`,
`VALID_TRIPLES`, `unitTileVertices`, `tilesOverlap`); don't rewrite
it. `scripts/verify-quasicrystal.mjs` (`npm run verify:quasicrystal`,
added to CI) checks, numerically:
- no two tiles overlap;
- the symmetry is 5-fold or icosahedral;
- the Penrose patch at the base offset has exactly 7 vertex stars by
  angle (de Bruijn's 8 rhombus vertex types, two of which differ only by
  matching arrows; Conway's 7 are the kite-and-dart ones), and a cut off
  the Penrose diagonal has more;
- the thick/thin and prolate/oblate ratios approach τ;
- each approximant repeats with the expected period;
- a small phason step flips tiles only locally.

**2. The 6D world** (first, because its maths already exists). *Shipped:*
the tiling decides each piece's shape (no Shape button in 6D), edge 1,
phasons ±1 window width per sweep, Lattice View one step out.
Enable the 6D card in the dimension picker and the Wizard, plus the
reserved 6D wheel faces. Add a world store for (lattice point,
direction triple) pieces, registered in `registerHistoryStores()` so
undo and Export/Import cover it. Tap-to-add and long-press-remove come
through `build.js`, with the cyan first-placement target. The panel
reuses `world-4d.js`'s slider and toggle pattern (Phason 1–3,
Approximant) with click-stops, plus Lattice View and the World View
modes. Browser check by touch on dicto-node: place, remove, slide,
undo.

**3. The 5D world.** Same engine and panel for Z⁵: Penrose rhombus
prisms (layer height `PRISM_HEIGHT` = 1 edge, confirmed). *Shipped:* one
factory for both worlds, `src/app/world-quasicrystal.js`. Building across a prism's top or bottom face adds the next
layer. Phason 3 is hidden.

**4. Window View**, for both worlds. *Shipped:* a Build | Window toggle,
true size, every corner as a point (plus ghost corners with Lattice View);
a piece shows exactly when all its corners are inside (checked).

**5. Info panel** summon/build record. *Folded:* the build counts
(built by type, shown vs hidden, slider settings, window corners) shipped
with stages 2–4; hand-placed vs summoned counts and the summon rows (tap
one to slide back to its settings; Info then takes taps on those rows)
move into stage 6, where they have content.

**6. Catalogue pipeline and summon.** Add `data/catalogue-5d6d.json`
(serial, tier, kind, name, parameters), the Wizard showcase,
serial-number lookup, the ghost outline + tap placement, the animated
slider jump, one undo step, and the Info summon record (from stage 5).
*Shipped (user decisions):* summons snap to where the item genuinely
occurs in the current tiling (so they land as real pieces of the same
quasicrystal, never contradicting the build); the slider moves only when
the item needs another approximant. The bottom-left button is Catalogue
in 5D/6D (the Wizard's catalogue screen, serial box on top). First batch:
the 23 real zonohedra (6D: both golden rhombohedra, Bilinski dodecahedron,
rhombic icosahedron, rhombic triacontahedron; 5D: rhombus, both hexagon,
octagon and decagon prisms at 1-3 layers), serials 1001-1023. A ghost off
screen brings the camera round to it. Start with bridge pieces and zonohedra
(about 50) to prove the pipeline. `verify:catalogue` checks:
- every entry computes and lands without self-overlap;
- serials are unique and inside their range;
- names are unique.

*Bridge pieces (2000–2999), user's description, still open:* "ridge
pieces (N−2)" or prismatoid / hyperprism geometry that bridges two parallel
shapes in different hyperplanes. To design before filling that range.

**7. Fill the catalogue**: about 100 patches (the 7 Penrose vertex stars at
2–3 sizes, the named patches such as the cartwheel and Conway worms,
and the icosahedral clusters), then the polytopes (zonotopal ones as
ordinary pieces, the rest as the polytope piece type below).
*7a shipped:* 62 vertex-star patches (serials 3001–3062), made by
`scripts/generate-catalogue-patches.mjs`: an entry is a window point plus
1–3 rings, landing where that exact patch occurs, any rotation or
reflection. 5D: the 7 Penrose vertex stars (by shape; de Bruijn's S and S5
share a first ring) at 1–3 rings. 6D: the 24 Ammann–Kramer vertex stars at
1 ring, 17 of them at 2 rings (only surrounds seen 10+ times in the sample,
so a summon lands nearby; 3 rings is hundreds of pieces and rarely
repeats). Names are descriptive; de Bruijn's letters and literature names
(cartwheel, Conway worms, icosahedral clusters) wait until their
definitions are checked. *7b shipped:* 27 polytopes (serials 1–27,
`scripts/generate-catalogue-polytopes.mjs`): orthoplex, demicube and corner
simplex over 3 to d axes, one per orientation class. User decisions: a
polytope lands as a shadow overlay at a tiling vertex (projected wireframe
over translucent faces, never blocking tiles, corners in the slice lit,
its hidden-dimension shadow in Window View), only lattice polytopes (the
regular 6-simplex and 2₂₁ don't live on Z⁶), and 5D shadows as 1-layer
prisms. This replaces the solid "polytope piece" idea below.

**8. Words and docs**: all 7 languages for new UI strings, a guide
section in all 7 guides, Almanac entries for the new pieces and
concepts, and a What's New entry per shipped stage.

## Polytopes that aren't made of the tier's pieces (superseded by 7b: shadow overlays)

Zonohedra and patches decompose exactly into the tier's own pieces (the
rhombic triacontahedron is 20 golden rhombohedra, for example), so they
land as ordinary pieces. Polytopes that don't (simplices, demicubes,
2₂₁) land as **one new "polytope" piece type**: a single piece showing
that polytope's projection, placed, selected, coloured and removed like
any other piece, and recorded in Info like any summon. It gets its own
store entry kind, and `verify:catalogue` checks it doesn't overlap the
pieces around it.

## Rules that apply throughout

Touch first, tested by touch. Hide controls that don't apply. Every
change goes through `persist()` (undo, Export/Import). New user-visible
text passes `verify:copy` and `verify:i18n`. No backend, no network
calls. Check CI after every push.
