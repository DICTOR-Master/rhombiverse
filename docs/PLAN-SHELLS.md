# Plan: Shells, a hull-building 3D scene

Status: agreed design; stages 1-3 shipped. Delete this file once every stage
has shipped (the code and the guide then describe the feature).

## The idea

A 3D scene of its own, with its own tools, for building **hulls** out of
**shells** of rhombic dodecahedra (RDs) and their symmetric pieces, and
for exploring them across scales: zoom out and a finished cluster
becomes one bigger RD; zoom in and an RD opens into its pieces. It
brings back what the old Shells tool and the planetoid growth did (both
purged in 3d87e35; restore reference 216ddbd), as pure geometry.

## The design (agreed with the user, 2026-09-26)

- **Its own scene**, like the 4D and 5D/6D worlds: its own store, undo,
  panel and tools. The main 3D world keeps one piece at a time. It is
  **listed as a 3D world** alongside FCC and BCC (the Wizard's 3D screen
  and the Piece wheel).
- **The first piece placed is the centre** the shells count out from.
- **Shells are colour bands.** Every piece is coloured by the shell it
  falls in, counted out from a centre cell. Two shell rules, toggled:
  - **Steps**: shell n is every cell n neighbour-steps from the centre.
    Sizes 12, 42, 92, 162, 252, 362 … (10n² + 2); totals 1, 13, 55, 147 …
    (the cuboctahedral magic numbers). The hull stays a cuboctahedron.
  - **Distance**: shell n is every cell at the n-th distance from the
    centre. Sizes 12, 6, 24, 12, 24, 8, 48, 6 … The hull passes through
    faceted shapes toward a sphere (the old planetoid growth).
  - **Target**: shells measured by a chosen shape's own distance, so the
    hull grows as that shape: **tetrahedron, cube, octahedron, rhombic
    dodecahedron, cuboctahedron, truncated octahedron**. Measured
    2026-09-26: every face of each lies on a lattice layer, so all are
    exact. Fixed orientation, lined up with the lattice; the tetrahedron
    comes in its 2 mirror orientations. No icosahedron or dodecahedron:
    no lattice can give their golden-ratio faces (the crystallographic
    restriction). No ED stretch: the ED lattice makes the regular shapes
    inexact (decided against, 2026-09-26).
- **Hulls are stepped (whole cells) by default, with a trim option** that
  cuts the outer layer to perfectly flat faces. Cube faces use the app's
  Cube and Pyramid pieces (RD = cube + 6 pyramids); octahedron and
  tetrahedron faces need a new piece, the **corner cap** (RD =
  octahedron + 8 caps, each 1/24 of the RD; a tetrahedral face removes
  4 alternate caps). Caps don't touch the RD's centre, so they aren't
  made of the 48 wedges: a separate small family.
- **Both ways of building**: place pieces by hand (tap a face to add the
  neighbour, long-press to remove), and grow or shrink a whole shell at
  a time.
- **Pieces: the RD and every symmetric split of it, down to 1/48.**
  Measured (Monte Carlo, 2026-09-26): each split below cuts the RD into
  pieces of equal volume, and every piece is an exact symmetry image of
  the first, so each split gives identical pieces:

  | Split | Pieces | Cut by |
  |---|---|---|
  | Halves | 2 | one mirror (two kinds: through the square axes, or the diagonals) |
  | Thirds | 3 | three half-planes around a 3-way corner axis |
  | Quarters | 4 | two mirrors |
  | Sixths | 6 | cones through the faces of the inner cube |
  | Eighths | 8 | the three coordinate mirrors (octants) |
  | Twelfths | 12 | pyramids on the rhombic faces |
  | Sixteenths | 16 | octants, then halved |
  | 24ths | 24 | octants, then thirded |
  | 48ths | 48 | the fundamental wedges |

  Some splits have more than one form (the two halves above; quarters
  also come as the RD's four rhombohedra). Reuse what the app already
  has: Hemi RD, RD Quarter, Rhombohedra, Cube and Pyramid (render.js
  builders, `core/lattice.js`); don't rebuild them.
- **Scale ladder: bigger RDs, smaller pieces.** A scaled FCC lattice sits
  exactly inside FCC, so a big RD is filled exactly by small pieces.
  Measured:

  | Big RD | Wholes | Halves | Thirds | Quarters | Sixths | Total |
  |---|---|---|---|---|---|---|
  | ×2 | 1 | 12 | – | – | 6 | 8 |
  | ×3 | 19 | – | 24 | – | – | 27 |
  | ×4 | 43 | 36 | – | 8 | 6 | 64 |
  | ×6 | 165 | 84 | 24 | – | 6 | 216 |

  More than one step is available (×2, ×3, and chains: ×4, ×6 …). Every
  scale needs only RDs plus halves, thirds, quarters and sixths at the
  boundary: sixths at the big RD's six 4-way corners, quarters at its
  eight 3-way corners when those land on lattice points, halves and
  thirds along its faces and edges. The finer splits are for exploring,
  never forced by scaling.
- **Zooming out shows an outline first.** The big RD appears as an
  outline around its small pieces, showing which pieces are missing or
  extra; confirming replaces them with one big RD. Zooming in opens a
  big RD back into its pieces. Each is one undo step.
- **Band colours**: the old per-shell hue step is the default (render.js
  `shellTint`, 0.15 of the hue circle per shell), and a palette can be
  chosen instead.
- **Big RDs keep their inner bands**: a big RD remembers the shell
  colours of the pieces it replaced, seen in X-Ray and Translucent.

## Stages

Each stage ships on its own, fully working, with its checks passing.

**1. Geometry engine and checks (no UI).** *Shipped:* all 68 checks
pass. Confirmed: the ×4 corner quarters are the rhombohedral quarters
(the app's RD Quarter) and the ×3 thirds are the 3-way-axis thirds; the
app's RD Quarter and Hemi RD pieces are exact members of the family.
`src/geometry-extensions/rd-pieces.js`: every split in the table as
real solids (vertices and faces), placed by lattice cell and symmetry
element; the scale decomposition (a big RD at ×k → its list of small
pieces, each with type, cell and orientation); step and distance
shells at any scale (reuse `cellsInShells`). `scripts/verify-shells.mjs`
(`npm run verify:shells`, in CI) checks exactly, not by sampling:
- each split's pieces are congruent and fill the RD with no gap or
  overlap;
- the ×2, ×3, ×4 and ×6 decompositions match the table and fill the big
  RD exactly;
- which named split each scale-boundary piece belongs to (the ×4
  quarters are expected to be rhombohedral quarters, and the ×3 thirds
  the 3-way-axis thirds; confirm);
- shell sizes for both rules.

**2. The scene.** *Shipped, with stage 3 pulled in:* `+ Shell` / `− Shell`
and the Hull picker (Steps = the cuboctahedron's gauge, Distance, and
the six targets). Drawn as ONE fused surface of the visible faces
(user's idea: fuse the hidden core), so hull size barely costs frame
rate: measured on dicto-node (software GPU, 12-15 fps with one RD),
7-10 fps from 300 to 3,871 pieces, versus 1.3 fps drawing every piece.
Cap 4,000 pieces for now; the view pulls back to fit after `+ Shell`.
`src/app/world-shells.js` (same factory shape as
`world-quasicrystal.js`): place RDs on the FCC lattice by hand, colour
bands by shell from the centre cell, the Steps | Distance toggle, its
own store, undo and Export/Import entry, listed as a 3D world.

**3. Grow, shrink and targets.** *Shipped in stage 2.* Add or remove the whole outer shell in
one step (one undo step each), in any shell rule. The Target rule with
its shape picker (stepped hulls). Engine: target gauges; verify:shells
checks each target's faces are flat lattice layers.

**4. Pieces, fragmenting and trimming.** The **trim option**: flat hull
faces from Cube, Pyramid, corner caps and the RD's halves (engine and
verify:shells extended with the caps; checked: RD = octahedron + 8 caps
exactly). Every split as a placeable piece, from a
picker grouped by split (halves … 48ths). Pieces snap into cell
positions and orientations, and can mix with whole RDs. **Fragmenting**
(user, 2026-09-26): target a placed piece or block, pick a breakdown
from a dropdown, and it splits into that many pieces in place (one undo
step); pieces keep their shell colour.

**5. Scale ladder.** Zoom out: pick a scale (×2, ×3 …), see the big-RD
outline over the build with missing and extra pieces marked, confirm to
replace. Zoom in: a big RD opens into its pieces. Big and small pieces
can then sit together, joined by the boundary pieces.

**6. Views and Info.** World View (Colour, Translucent, Skeleton) and
X-Ray to see the bands inside. The **shell viewer** from the old Shells
panel (restore reference 216ddbd, `renderRingDiagram`): concentric
rings, one per shell in its colour, with counts; tap a ring to show,
hide, recolour or remove that shell. Info shows counts per shell, per piece
kind and per scale, and the hull's shape.

**7. Words and docs.** All 7 languages for the new UI, a User Guide
section in all 7 guides, Almanac cards (shells and magic numbers, the
RD's symmetric splits, the scale ladder), and a What's New entry per
shipped stage.

## Open questions

- **Size limit:** 4,000 pieces for now; confirm on a real phone/iPad
  whether it can go higher.

## Rules that apply throughout

Touch first, tested by touch. Hide controls that don't apply. Every
change goes through `persist()` (undo, Export/Import). New user-visible
text passes `verify:copy` and `verify:i18n`. No backend, no network
calls. Check CI after every push.
