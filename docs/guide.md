# Rhombiverse User Guide

Rhombiverse and its twin, [Polyhedraverse](https://polyhedraverse.vercel.app), are two ways of looking at the same geometry. Rhombiverse is the **landscape**: the lattices themselves, stretching out in every direction. Polyhedraverse is the **portrait gallery**: the shapes that live in those lattices, one at a time, up close.

Here, every piece fills space perfectly on a real crystal lattice, so you can only put a piece where the lattice has room for it. Tap to add a piece, long-press to remove one, and look at what you've built in different views, from 1D up to 6D.

The first part of this guide walks through common tasks. The second part lists every control.

## Getting started

### Pick a dimension

After **ENTER**, the dimension picker opens: a slowly turning shape whose faces are **1D+**, **2D**, **3D**, **4D**, **5D** and **6D**, each marked with an icon. Hover over a face (or press and hold it on a touchscreen) to see its name, then tap the one you want. Drag to turn the shape and bring other faces round.

You can switch later from **Menu → Change Dimension**, or from the **Wizard** (top left), which lists every lattice in each dimension with its pieces as rotating wireframes.

### Place your first piece

An empty world shows a **cyan outline** where the first piece goes. Tap it. Then tap a face of any piece (a side, in 2D) to add a neighbour on the other side of it.

You build one piece at a time. 3D starts with the **RD** (rhombic dodecahedron) selected. The piece you're placing is shown in the **Shape** button at the bottom left; tap it to choose a different one.

### Remove a piece

- **Phone or tablet:** long-press the piece.
- **Mouse:** right-click the piece. Right-click removes in every mode.

To take back your last change, tap **Undo** (↶, bottom right). Hold it to scrub back several steps at once. Each dimension keeps its own undo history, so undoing in 2D never touches your 3D or 4D build.

### Move the camera

- **Rotate:** drag with one finger, or drag with the left mouse button.
- **Zoom:** pinch, or use the scroll wheel.
- **Pan:** drag with two fingers.

## Choosing what to build

### The pieces, by lattice

**1D+ Signal** (Wizard → 1D+ → Signal): a single line of bullet-shaped cells carrying a message. Type a message on the bottom line (it replaces the one before; edit it as usual): it appears as ghost cells, its Morse code, no need to know it, with the next one in orange. Tap it to place one at a time, or press **Send** (or Enter) to place the rest and set the message moving along the line, away from you (■ stops it). With the field empty, it shows what the line says. The eye button switches between **Outside** (from behind and above: the line runs up the screen and narrows into the distance, a faint mist carrying it on toward infinity) and **Inside** (in the tunnel: the cells pass just beneath you and climb away to a point in the distance). Long-press removes a cell and the line closes up behind it: it's one-dimensional.

The round **pulse key** beside the message is a telegraph key: tap for a dot, hold for a dash; a short pause starts a new letter and a longer one a new word. What you key shows in the message field as dots and dashes (· –), a space between letters and / between words; edit them there like any text (typing . and - works too). The little scroll beside Send opens the **Morse code** glossary: every letter, digit and sign with its dots and dashes; tap one to add it to your message. While the signal plays, the message reads out at the top of the screen, letter by letter, as it arrives there. Inside, drag to look around, pinch (or scroll) to move along the tunnel, and drag two fingers up or down (or Shift + scroll) to rise or sink; let go and the view eases back. The key learns your own rhythm, so key as slowly and carefully as you like: it reads your short presses as dots and your long ones as dashes, and judges your pauses against each other. The letters it reads show above the message box as you key.

**1D+ Construct** (Wizard → 1D+ → Construct · Square): build a square from 1D cells, one tap at a time, one line at a time. Only the line you're on shows; the next cell is orange: tap to fill it. The first side runs up the screen along **X**; at the corner a junction glows, **Y** joins (X stays) and the line you've built ghosts out; carry on clockwise: along the top, down the far side (a second X line, parallel to the first) and back along the bottom. When the loop closes, the whole square shows and fills in, and **Open in 2D** takes it to 2D's Square tile. Long-press takes back the last cell.

Then the cube: when the square closes, the view turns to three-quarters and **Z** rises from the start corner. Build its first edge one cell per tap; after that, each tap fills a whole edge: the other three Z edges, then the top square. Every edge carries its numbered name (X1, Y2, Z3 …); finished edges ghost, and the one just finished stays solid until the next. When the cube closes it shows whole with faint faces. When it closes, it goes straight into its lattice: the cubes around it as ghosts, tiling space (the **lattice** button hides or shows them). The closed square has its own lattice button too, showing the square tiling the plane. The indicator beside Wizard shows how far you've built (**1D+**, **1D+/2D**, **1D+/2D/3D**, **1D+/2D/3D/4D**). **⊘** beside Undo clears the whole build to start again (Undo brings it back), and the **Signal | Construct** toggle under Wizard switches between the two 1D worlds.

Then the tesseract: when the cube closes (**Open in 3D** takes it to 3D's Cube piece), the fourth direction **W** rises from the start corner, pointing inward: W is drawn as perspective, so the second cube sits smaller inside the first. Build its first edge one cell per tap, then one tap per edge: the other seven W edges, then the inner cube. When it closes it goes straight into its lattice; tap to turn it slowly through W, the inner and outer cubes swapping places (tap again to stop), and **Open in 4D** takes it to 4D's hypercubic (Z4) world.

**1D+ Construct · Kagome** (Wizard → 1D+ → Construct · Kagome): first a hexagon, built by hand one cell per tap, its first side up the screen, clockwise, one continuous path. It takes Kagome's three directions: **X**, then **Y** at the first corner, then **XY** (X and Y together, so still 2D). Closing it is the 2D moment: its lattice button shows the honeycomb, and **Open in 2D** takes it to 2D's Hexagon tile. Then Kagome's star forms round it, one tap per edge (no new direction): out to each point and back to the next corner, where two of Kagome's lines cross. When the star closes it goes straight into the Kagome lattice, and **Open in 2D** takes it to the Kagome tile. Then **Z**, into pyrochlore (Kagome in 3D), in the same rhythm: first the hexagonal parts, the truncated tetrahedron standing on your hexagon (four hexagons, four triangles; Z's first edge by hand, then the rest in two taps), the 3D moment; then the mini tetrahedra on its triangles, all four in one tap, three on the star's points and one on top. Together they make one big tetrahedron, 3D's Pyrochlore piece: it goes straight into the pyrochlore lattice, and **Open in 3D** takes it there. Then **W**, into hyper-pyrochlore (Kagome in 4D), the same rhythm once more: the body, the truncated 5-cell (five truncated tetrahedra, yours one of them, and five tetrahedra; W drawn as perspective, inward), W's first edge by hand, the rest in two taps; then the limbs, a small 5-cell on each tetrahedron, all five in one tap. Together one big 5-cell: tap to turn it through W, and **Open in 4D** takes it to the Hyper-pyrochlore world. The body is cyan, the limbs gold, all the way up. Each Construct family (Square, Kagome, RD) keeps its own progress.

**1D+ Construct · RD** (Wizard → 1D+ → Construct · RD): the flagship. First the RD's own rhombus, by hand like the square, starting at its 70.53° corner, first side up the screen, clockwise: the 2D moment (its lattice button shows the rhombic lattice, and **Open in 2D** takes it to the Parallelogram at the RD Rhombus angle). Then **Z** into the rhombic dodecahedron, in the RD's own grammar: the body first, the cube inside it (cyan; its edges are the rhombi's short diagonals; Z's first edge by hand, then the rest in one tap), then the limbs, a pyramid on each of its six faces (gold, all six in one tap), whose edges are the RD's. It closes straight into its lattice, the twelve RDs round it, and **Open in 3D** places an RD there. Then **W**: the RD is the 24-cell's shadow, so splitting it open makes the 24-cell. Each corner of its cube parts in two, one on each side in W, and the two copies make the tesseract (the body: W's first edge by hand, the other corners at once). Then the limbs: the six apexes join both sides in one tap, and two new apexes out along W in another. That's the 24-cell, 96 edges, turning through W, with the RD left as its ghost; **Open in 4D** takes it to the D4 world.

**2D:** Parallelogram, Triangle, Hexagon, Kite and Kagome tiles, chosen from the 2D panel (at the top; at the bottom on a phone), each at up to four lattice angles (90°, 70.53°, 63.43° and 60°).

**2D Kaleidoscope** (Wizard → 2D → Kaleidoscope): a world of its own. Build with thick and thin Penrose rhombi, pentagons, triangles, hexagons and squares (all the same edge length, so any two fit edge to edge). Where you tap decides: near a piece's edge, the chosen piece goes across it; in empty space, it drops loose and slides along until it lines up beside a partner. Pieces never overlap. Mirrors reflect your build into a kaleidoscope: the mirror button switches between a Ring (○, 1 to 12 mirrors) and a triangle of three (△60°, △45°, △30°) repeating across the screen, set with the slider; **Turn** rotates your build against the mirrors, **↻** keeps it turning, **≈** shakes every piece loose to settle into a new pattern. **Safe** (Penrose shapes only) keeps the rhombi to Penrose's matching rule, so they always form a true Penrose tiling. **Lattice View** shows the mirror lines and, outlined, every spot the piece fits.

**2D Nets** (Wizard → 2D → Nets): from 2D to 3D. Pick a solid in the panel: the **Voronoi cells**, Cube, RD and TO (truncated octahedron), the space-filling cells of the simple, face-centred and body-centred cubic lattices; its net shows as a faint ghost. Follow it: tap to build the first face side by side, in 1D cells, then each tap builds the next face. When the net is complete, tap and it folds up into the solid (the indicator reads **2D/3D**); the **fold slider** folds and unfolds it by hand, and **Open in 3D** takes the finished solid there. Long-press takes back a face (or unfolds). Each solid keeps its own progress. The **Platonic solids** are a second group: tetrahedron, octahedron, icosahedron, dodecahedron and the cube. **Open in 3D** appears for the solids the 3D world has as pieces (cube, RD, TO, octahedron). **⊘** beside Undo clears the net you're on.

**Paint** (every dimension but 1D+): the brush on the bottom row, or the Paint switch in the middle of the colour wheel, recolours pieces you've already placed. Turn it on, pick a colour, tap a piece; turn it off to build again. It switches colours to Pick, so each piece shows its own colour. (Shells and Golden Rhombohedra colour their pieces by band and type, so Paint isn't offered there, nor in Nets.) When the bottom row's slot is taken by an attach toggle (3D's Rhombohedra and Pyrochlore), the brush sits just above it; in 4D it's in the 4D panel.

**3D:**

| Lattice | Pieces |
|---|---|
| FCC | Rhombic Dodecahedron (RD), Hemi RD, Hourglass, RD Quarter, Cube, Pyramid |
| DICTO FCC | DICTO RD: DICTO's skewed rhombic dodecahedron of blue Zometool struts (six 60° and six 72° rhombi, volume φ² at edge 1), packed as a sheared FCC |
| RD Dual | Cuboctahedron (CO), Octahedron |
| BCC | Truncated Octahedron (TO) |
| BCC Interstitial | Flattened Octahedron, Disphenoid |
| Elongated Dodecahedron | Elongated Dodecahedron (ED) |
| Hexagonal | Hex Prism |
| Rhombohedral | Rhombohedra |
| Pyrochlore (3D Kagome) | Truncated Tetrahedron (the tetrahedra between them are added for you) |

**4D:**

| World | Pieces |
|---|---|
| Z4 | Tesseract (the 4D cube) |
| D4 | 24-cell, 16-cell |
| Hyper-pyrochlore (4D Kagome) | 5-cell, Truncated 5-cell, Bitruncated 5-cell |

Try this on FCC: place six Pyramids to form a Cube. Then add one Pyramid to each face of the Cube, and it becomes an RD. Remove those six again to go back to a Cube.

**RD Quarter** is one of the 4 rhombohedra an RD splits into. Tap an RD near one of its corners to fill that corner in, then tap a quarter's face to place its mirror image across that face. The mirror image always lands back on the RD lattice, so you can extend quarters from cell to cell. For a free rhombohedron lattice with Copy as well as Mirror, use **Rhombohedra**.

### Colours

Pieces are coloured by the **Colours** setting (in Settings): **Cyan** (every piece cyan, the default), **Type** (each kind of piece in its own colour, editable in the list shown) or **Pick** (each piece keeps the colour it was placed with). Tap the **Colour** button (bottom left) to choose from 15 colours: in Cyan this switches to Pick, and in Type it changes the colour of the kind of piece you're placing. Switching never loses the colours pieces were placed with.

## Looking at your build

| View | What it shows | How to turn it on |
|---|---|---|
| World View | Colour, Translucent or Skeleton | Tap the World View button to cycle |
| Lattice View | Your build plus every open slot one step out, for the chosen piece | Tap the Lattice View button (or ⬡ on the corner wheel) to cycle through the pieces |
| X-Ray | A cutaway. Drag the plane through the structure, including on a diagonal | X-Ray button (⛶) |
| Spherical | Tap to cycle: each piece as a sphere (whole RDs touch their twelve neighbours), then the voids between whole RDs (octahedral gold, tetrahedral rose, where fully enclosed) with every sphere made faint. A slider sizes every sphere (a click-stop at each shape's own size; below = apart, beyond = overlapping). With Lattice View on, every open lattice slot shows as a faint sphere. View only | Spherical button (◯): off → spheres → voids |
| Duality | The aperiodic tiling that this crystal structure casts | Duality button (◐) |
| Dualize | Swaps FCC and BCC | Settings → Dualize Preview |

Settings also has a **Section view**: pick an axis, drag the slider to move the cut, and tick **Flip** to see the other side.

## Going into 4D

1. Choose **4D** in the dimension picker, the Wizard, or **Menu → Change Dimension**.
2. Pick a world: Tesseract (Z4), 24-cell or 16-cell (D4), or a Hyper-pyrochlore piece.
3. Build as in 3D: tap a face to add the neighbouring 4D cell.

A 4D panel appears at the bottom of the screen.

- **Slice / Projection** switches how you see 4D. **Slice** (the default) shows the 3D cross-section at the current depth. **Projection** shows whole 4D cells as shadows; tap a shadow's face to build across it. In Projection you can also switch between **Parallel** and **Perspective**.
- **The slider** does what the button above it says: **W-depth** moves the slice through the fourth dimension, and **XW**, **YW** and **ZW** turn it into the fourth dimension. It clicks into place at useful stops. The one labelled **FCC** is the ordinary 3D RD world, and the one labelled **Pyrochlore** is the 3D Pyrochlore world.
- **Reset 4D** puts everything back to the starting position.
- **Paint** (the brush) appears in this panel for the 24-cell, 16-cell and Hyper-pyrochlore pieces, whose attach toggle takes the bottom row's paint slot.
- **Info** opens a panel showing the world and piece you're placing, what you've built, where the slice is (W-depth, or Projection), the XW/YW/ZW turn angles, and the 4D centre coordinates of the last cell you tapped or placed.

## Going into 5D and 6D

5D and 6D are **quasicrystals**: a cube lattice in five or six dimensions, sliced through 3D space. The pieces fill space with no gaps, but the pattern never repeats.

- **6D** is the icosahedral quasicrystal. Its pieces are two golden rhombohedra: **prolate** (tall) and **oblate** (flat).
- **5D** is the decagonal quasicrystal: layers of the Penrose tiling, made of **thick** and **thin** rhombus prisms.

1. Choose **5D** or **6D** in the dimension picker, the Wizard, or **Menu → Change Dimension**.
2. Tap the cyan outline to place the first piece, then tap a face to add the neighbouring piece. In 5D, the top and bottom faces add a layer above or below.

You don't choose the shape: the tiling decides which piece goes in each slot.

A panel appears at the bottom of the screen.

- **The slider** does what the button above it says. **Phason 1**, **Phason 2** and **Phason 3** (6D only) move the slice sideways through the hidden dimensions: pieces flip, and some leave the slice while others come in. Pieces hidden by the slice aren't deleted; slide back and they return. **Approximant** clicks through periodic crystals (1/1, 2/1, 3/2, 5/3, 8/5 …) that get closer and closer to the true quasicrystal, **τ**, at the right-hand end.
- **Build / Window** switches to **Window View**, which shows the hidden dimensions. The window is a rhombic triacontahedron in 6D and a set of pentagons in 5D. Each corner of your pieces is a point: white inside the window (the corner is in the slice), red outside. Move a phason slider and watch points cross the window's edge as pieces appear and disappear.
- **Reset 5D** / **Reset 6D** puts the slider back to the start: phason 0 at τ.
- **Info** shows the world, what you've built, how many pieces are in the slice and how many it hides, the phason and approximant settings, and in Window View how many corners are inside. Items you've summoned are listed too: tap one to slide back to its settings.

**Lattice View** shows the surrounding tiling one step out as ghosts, and they flip as you slide a phason. **World View** works as in 3D.

### The Catalogue

In 5D and 6D the bottom-left button opens the **Catalogue** (the Wizard's 5D and 6D cards open it too). It has four kinds of item:

- **Zonohedra:** shapes made of the tiling's own pieces, from a single rhombohedron up to the rhombic triacontahedron, and in 5D rhombus, hexagon, octagon and decagon prisms.
- **Polytopes:** the shadows of higher-dimensional polytopes, such as the 6-orthoplex, whose shadow is an icosahedron. A shadow lies over the tiling without blocking pieces, and its corners light up where they are in the slice. Long-press one to remove it.
- **Bridges:** hyperprisms, polytopes carried one step through a further dimension, such as the 5-orthoplex prism. Like polytopes, they land as shadows.
- **Vertex stars:** every way the pieces meet at a corner (7 in 5D, 24 in 6D), also with one or two rings of the pieces around them. Tap a heading to open its list.

Every item has a serial number. Type one in the box and tap **Summon** to go straight to it.

When you pick an item, a **gold outline** appears where it really occurs in your quasicrystal. Tap your build to move the outline to the nearest spot there, and tap the outline to place it as ordinary pieces. If the item belongs to a different approximant, the slider slides there first. **Cancel summon** stops. One **Undo** takes it back and slides the slider back to where it was.

**Connect** (in the panel, once you have two pieces) joins two items: tap a piece of each, and the shortest chain of real tiles between them is placed as one connector. One **Undo** takes it back.

## Shells

A 3D world for building **hulls**: shells of rhombic dodecahedra (RDs), each shell its own colour band, counted out from your first piece. Choose it in the Wizard's 3D screen.

- **+ Shell** fills the next shell, **− Shell** removes the outermost. **Hull** chooses how shells count: **Steps** (a cuboctahedron: 13, 55, 147 … pieces), **Distance** (toward a sphere), or a target shape (tetrahedron, cube, octahedron, RD or truncated octahedron). **Trim** cuts the hull exactly flat into that shape.
- **Fragment** mode: tap a piece, then pick a **Breakdown** (halves, thirds, quarters, sixths, eighths, twelfths, sixteenths, 24ths or 48ths); **Turn** changes the cut. In Build mode the **Piece** menu places single parts too.
- **Scale** builds with bigger RDs (×2 to ×4). **Merge ×2 / ×3** on a targeted piece shows the big RD's outline, then **Confirm** swaps in one big RD; the Breakdown menu opens it again.
- **Info** shows the ring diagram: tap a ring to hide or show that shell and look inside, remove any shell, and pick the band colours.

## Golden Rhombohedra

A 3D world for the two pieces of the 3D Penrose tiling. Choose it in the Wizard's 3D screen. Tap the cyan outline, then tap a face to add the **Prolate** or **Oblate** piece chosen in the Piece menu. **Penrose check** colours pieces green where they belong to the true aperiodic tiling and red where your build has drifted; Lattice View shows the true tiling around you, and tapping a ghost places it.

## RHOMBIS

RHOMBIS is a 3D puzzle made from the same pieces: fill the target shape with the pieces in the tray. Open it from the welcome screen (**Try RHOMBIS**). Tap a piece in the tray, then tap a glowing void to place it; some pieces flip when tapped again. **Stages** lists every puzzle in sections and ticks the ones you've solved. **← Rhombiverse** brings you back here.

## Saving your work

Your World saves automatically in this browser, every dimension, after each change. It comes back when you reopen the site on the same device and browser.

In **Settings**:

- **Export World** saves everything, every 3D lattice, your 2D tiles and your 4D, 5D and 6D builds, to one file. Use it to keep a backup or move your World to another device.
- **Import World** opens an exported file. **Undo** takes an import back.
- **Clear World** (⊘ on the corner wheel) starts again with an empty world. Undo can bring it back.

## Learning the maths

- **Almanac:** the maths and geometry behind every piece and lattice. Open it from Menu → Almanac.
- **What's New** lists recent changes.

---

# Control reference

## Screen buttons

| Control | What it does |
|---|---|
| Wizard (top left) | Browse dimensions and lattices, each with its pieces. The large orange label beside it shows the dimension you're in |
| Shape (bottom left) | The piece you're placing. Tap to change it |
| Colour (bottom left) | Build colour. Tap to change it |
| Lattice View | Cycles through Off and a view for each piece |
| Attach toggle | Only shown for pieces that attach more than one way (Rhombohedra: Copy / Mirror; Pyrochlore: small / whole tetrahedron; 24-cell / 16-cell; the three Hyper-pyrochlore 5-cells): tap to switch |
| Undo (↶, bottom right) | Tap to undo one step in the current dimension. Hold to scrub back further |
| Paint (brush) | Recolour placed pieces: turn on, pick a colour, tap a piece. In the attach toggle's place on the bottom row; when that toggle is needed it sits just above it (in 4D, in the 4D panel) |
| Signal \| Construct (under Wizard, 1D+ only) | Switches between the two 1D+ worlds |
| ⊘ Clear (beside Undo, 1D+ and Nets) | Clears the 1D+ world you're in to start again (in Nets, the net you're on); Undo brings it back |
| Menu | Opens the menu wheel (keyboard: Tab or Space) |

## Corner wheel

Drag the small wheel in the corner to turn it. Tap a face to use it.

| Symbol | Control |
|---|---|
| ⚙ | Settings |
| ⛶ | X-Ray |
| ◐ | Duality |
| ⬡ | Lattice View |
| ◇ | Menu |
| ⊘ | Clear World |
| ↻ | Reload (use it if something looks stuck) |
| ◯ | Spherical (off → spheres → voids) |
| — | World View |

## Menu wheel

The menu is a rhombic dodecahedron. Each face is a section: tap a face to open it, and use **Home** to go back. **Almanac** is always on a top face.

| Section | Contents |
|---|---|
| Home | Piece, Colour, Change Dimension |
| Piece | RD family, Cube, Pyramid, TO, Flattened Octahedron, Disphenoid, CO, Octahedron |
| RD family | RD, Hemi RD, Hourglass, RD Quarter, ED, Hex Prism, Rhombohedra, Pyrochlore |
| Change Dimension | 1D+, 2D, 3D, 4D, 5D, 6D |
| Piece (in 4D) | Tesseract, 24-cell, 16-cell, 5-cell, Truncated 5-cell, Bitruncated 5-cell |

## Settings

| Setting | What it does |
|---|---|
| Look sensitivity | Camera rotation speed |
| Invert Y | Reverses vertical drag |
| Field of view | Camera lens width |
| Graphics quality | Low, Medium or High |
| Show FPS meter | Frame-rate counter |
| Volume | Sound level |
| Language | English, 日本語, Español, Français, 한국어, 中文, Русский (also the 🌐 picker at the top of the welcome screen and this guide) |
| Colours | Cyan, Type or Pick: how pieces are coloured |
| Section view, axis, position, Flip | Cutaway along one axis |
| Dualize Preview | Special build mode |
| Export World, Import World | Back up and restore (every dimension) |

## Keyboard and mouse

| Input | Action |
|---|---|
| Left-click a face | Add a piece |
| Right-click a piece | Remove it |
| Left-drag | Rotate the camera |
| Scroll wheel | Zoom |
| Tab or Space | Open the menu wheel |
| Escape | Close the menu, Wizard or Almanac |
| Enter | Enter from the welcome screen |

## Touch

| Gesture | Action |
|---|---|
| Tap a face | Add a piece |
| Long-press a piece | Remove it |
| One-finger drag | Rotate the camera |
| Pinch | Zoom |
| Two-finger drag | Pan |
