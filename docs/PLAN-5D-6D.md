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

**1. Engine and checks (no UI).**
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
- the Penrose patch at zero offset has exactly Conway's 7 vertex stars;
- the thick/thin and prolate/oblate ratios approach τ;
- each approximant repeats with the expected period;
- a small phason step flips tiles only locally.

**2. The 6D world** (first, because its maths already exists).
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
prisms. Building across a prism's top or bottom face adds the next
layer. Phason 3 is hidden.

**4. Window View**, for both worlds.

**5. Info panel** summon/build record (the build counts first; summon
rows arrive with stage 6).

**6. Catalogue pipeline and summon.** Add `data/catalogue-5d6d.json`
(serial, tier, kind, name, parameters), the Wizard showcase,
serial-number lookup, the ghost outline + tap placement, the animated
slider jump, and one undo step. Start with bridge pieces and zonohedra
(about 50) to prove the pipeline. `verify:catalogue` checks:
- every entry computes and lands without self-overlap;
- serials are unique and inside their range;
- names are unique.

**7. Fill the catalogue**: about 100 patches (Conway's 7 vertex stars at
2–3 sizes, the named patches such as the cartwheel and Conway worms,
and the icosahedral clusters), then the polytopes (zonotopal ones as
ordinary pieces, the rest as the polytope piece type below).

**8. Words and docs**: all 7 languages for new UI strings, a guide
section in all 7 guides, Almanac entries for the new pieces and
concepts, and a What's New entry per shipped stage.

## Polytopes that aren't made of the tier's pieces (decided)

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
