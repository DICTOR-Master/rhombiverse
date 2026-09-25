# Rhombiverse User Guide

Rhombiverse and its twin, [Polyhedraverse](https://polyhedraverse.vercel.app), are two ways of looking at the same geometry. Rhombiverse is the **landscape**: the lattices themselves, stretching out in every direction. Polyhedraverse is the **portrait gallery**: the shapes that live in those lattices, one at a time, up close.

Here, every piece fills space perfectly on a real crystal lattice, so you can only put a piece where the lattice has room for it. Tap to add a piece, long-press to remove one, and look at what you've built in different views, from 2D up to 6D.

The first part of this guide walks through common tasks. The second part lists every control.

## Getting started

### Pick a dimension

After **ENTER**, the dimension picker opens: a slowly turning shape whose faces are **2D**, **3D**, **4D**, **5D** and **6D**, each marked with an icon. Hover over a face (or press and hold it on a touchscreen) to see its name, then tap the one you want. Drag to turn the shape and bring other faces round.

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

**2D:** Parallelogram, Triangle, Hexagon, Kite and Kagome tiles, chosen from the panel at the top, each at up to four lattice angles (90°, 70.53°, 63.43° and 60°).

**3D:**

| Lattice | Pieces |
|---|---|
| FCC | Rhombic Dodecahedron (RD), Hemi RD, Hourglass, RD Quarter, Cube, Pyramid |
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

Tap the **Colour** button (bottom left) to choose from 14 colours. The colour you pick sticks to the piece you're placing. With **Auto-assign colour by piece type** turned on (in Settings), each kind of piece starts with its own colour until you pick one.

## Looking at your build

| View | What it shows | How to turn it on |
|---|---|---|
| World View | Colour, Translucent or Skeleton | Tap the World View button to cycle |
| Lattice View | Your build plus every open slot one step out, for the chosen piece | Tap the Lattice View button to cycle through the pieces |
| X-Ray | A cutaway. Drag the plane through the structure, including on a diagonal | X-Ray button (⛶) |
| Spherical | Each piece shown as a near-sphere | Spherical button (◯) |
| Duality | The aperiodic tiling that this crystal structure casts | Duality button (◐) |
| BCC Lattice | The body-centred cubic lattice nested inside the FCC one | BCC Lattice button (⬡) |
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

In 5D and 6D the bottom-left button opens the **Catalogue** (the Wizard's 5D and 6D cards open it too). It has three kinds of item:

- **Zonohedra:** shapes made of the tiling's own pieces, from a single rhombohedron up to the rhombic triacontahedron, and in 5D rhombus, hexagon, octagon and decagon prisms.
- **Polytopes:** the shadows of higher-dimensional polytopes, such as the 6-orthoplex, whose shadow is an icosahedron. A shadow lies over the tiling without blocking pieces, and its corners light up where they are in the slice. Long-press one to remove it.
- **Vertex stars:** every way the pieces meet at a corner (7 in 5D, 24 in 6D), also with one or two rings of the pieces around them. Tap a heading to open its list.

Every item has a serial number. Type one in the box and tap **Summon** to go straight to it.

When you pick an item, a **gold outline** appears where it really occurs in your quasicrystal. Tap your build to move the outline to the nearest spot there, and tap the outline to place it as ordinary pieces. If the item belongs to a different approximant, the slider slides there first. **Cancel summon** stops. One **Undo** takes it back and slides the slider back to where it was.

## Saving your work

Your World saves automatically in this browser, every dimension, after each change. It comes back when you reopen the site on the same device and browser.

In **Settings**:

- **Export World** saves everything, every 3D lattice, your 2D tiles and your 4D, 5D and 6D builds, to one file. Use it to keep a backup or move your World to another device.
- **Import World** opens an exported file. **Undo** takes an import back.
- **New World** starts again with an empty world. **Clear World** (⊘) does the same from the corner wheel. Undo can bring it back.

## Learning the maths

- **Almanac:** the maths and geometry behind every piece and lattice. Open it from Menu → Almanac.
- **What's New** lists recent changes.

---

# Control reference

## Screen buttons

| Control | What it does |
|---|---|
| Wizard (top left) | Browse dimensions and lattices, each with its pieces |
| Shape (bottom left) | The piece you're placing. Tap to change it |
| Colour (bottom left) | Build colour. Tap to change it |
| Lattice View | Cycles through Off and a view for each piece |
| Rhombohedra attach | Only shown for Rhombohedra: switches between Copy and Mirror |
| Undo (↶, bottom right) | Tap to undo one step in the current dimension. Hold to scrub back further |
| Menu | Opens the menu wheel (keyboard: Tab or Space) |

## Corner wheel

Drag the small wheel in the corner to turn it. Tap a face to use it.

| Symbol | Control |
|---|---|
| ⚙ | Settings |
| ⛶ | X-Ray |
| ◐ | Duality |
| ⬡ | BCC Lattice |
| ◇ | Menu |
| ⊘ | Clear World |
| ↻ | Reload (use it if something looks stuck) |
| ◯ | Spherical |
| — | World View, Cuboctahedron Build |

## Menu wheel

The menu is a rhombic dodecahedron. Each face is a section: tap a face to open it, and use **Home** to go back. **Settings** and **Almanac** are always on the top faces.

| Section | Contents |
|---|---|
| Home | Piece, Colour, Change Dimension |
| Piece | RD family, Cube, Pyramid, TO, Flattened Octahedron, Disphenoid, CO, Octahedron |
| RD family | RD, Hemi RD, Hourglass, RD Quarter, ED, Hex Prism, Rhombohedra, Pyrochlore |
| Change Dimension | 2D, 3D, 4D, 5D, 6D |

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
| Auto-assign colour by piece type | Gives each kind of piece its own colour |
| Section view, axis, position, Flip | Cutaway along one axis |
| Build Cuboctahedron, Dualize Preview | Special build modes |
| New World, Export World, Import World | Start again, back up, and restore (every dimension) |

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
