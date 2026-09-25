# How to use Rhombiverse

Rhombiverse and its twin, [Polyhedraverse](https://polyhedraverse.vercel.app), are two ways of looking at the same geometry. Rhombiverse is the **landscape**: the lattices themselves, stretching out in every direction. Polyhedraverse is the **portrait gallery**: the shapes that live in those lattices, one at a time, up close.

Here, every piece fills space perfectly on a real crystal lattice, so you can only put a piece where the lattice has room for it. Tap to add a piece, long-press to remove one, and look at what you've built in different views, in 2D, 3D or 4D.

The first part of this guide walks through common tasks. The second part lists every control.

## Getting started

### Pick a dimension

After **ENTER**, the dimension picker opens: a slowly turning shape whose faces are **2D**, **3D** and **4D**, each marked with an icon. Hover over a face (or press and hold it on a touchscreen) to see its name, then tap the one you want. Drag to turn the shape and bring other faces round.

You can switch later from **Menu → Change Dimension**, or from the **Wizard** (top left), which lists every lattice in each dimension with its pieces as rotating wireframes.

### Place your first piece

An empty world shows a **cyan outline** where the first piece goes. Tap it. Then tap a face of any piece (a side, in 2D) to add a neighbour on the other side of it.

The piece you place is shown in the **Shape** button at the top of the screen. Tap it to choose a different piece.

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

Try this on FCC: place 6 Pyramids on a Cube, then 12, then remove the outer 6.

### Colours

Tap the **Colour** button to choose from 14 colours. With **Auto-assign colour by piece type** turned on (in Settings), each kind of piece gets its own colour.

## Building faster

Open **Menu → Build** for these tools:

- **Add:** tap a face to add one piece (the normal tool).
- **Repeat:** drag across faces to place a row of pieces.
- **Fill:** tap to fill a gap.
- **Symmetry:** opens the Sculpt panel (see [Sculpting with symmetry](#sculpting-with-symmetry)).

Open **Menu → Alter** to change what's already there:

- **Dig:** tap a piece to remove it.
- **Smooth:** tap to round off a corner.
- **Remove:** tap to remove single pieces.

### Shells

A structure grows outwards in shells, one layer at a time. In **Settings**, **Shell fill radius** builds a solid ball of that many shells, and **Hollow from shell** leaves it hollow inside. Tap a built structure to list its shells and recolour any one of them.

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

## Sculpting with symmetry

Open **Symmetry** (Menu → Build) to build with mirrors.

- **Model** adds pieces and **Chisel** removes them.
- Choose a mirror plane (X, Y, Z or a diagonal), or **Full symmetry (48)** to copy every change 48 ways (full cubic symmetry).
- **Brush radius** changes how much each tap touches.

**Sculpture Mode** (◆) is a separate scratch space that doesn't touch your main build. From there you can export STL, OBJ or GLTF files, or **Place a copy in-world**.

**Assistance tiers:** Manual is the default. Semi-Cyborg and Full-Cyborg let an AI suggest shapes from a short description (for example "make a small dome here"). This is optional. It works with the shared key or your own key, which you can add in Settings.

## Saving and sharing

In **Settings**:

- **Share World (copy link):** copies a link that contains the whole world. Nothing is stored on a server.
- **Export World / Import World:** saves the world to a file and opens it again.
- **Export Model (.rhomb):** saves the geometry only.
- **New World:** starts again with an empty world. **Clear World** (⊘) does the same from the corner wheel.

## Learning the maths

- **Almanac:** the maths and geometry behind every piece and lattice. Open it from Menu → Almanac.
- **Cyborg Mode** (◈) is a guided walkthrough that can suggest what to build next.
- **What's New** lists recent changes.

---

# Control reference

## Screen buttons

| Control | What it does |
|---|---|
| Wizard (top left) | Browse dimensions and lattices, each with its pieces |
| Shape | The piece you're placing. Tap to change it |
| Colour | Build colour. Tap to change it |
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
| ◈ | Cyborg Mode |
| ◆ | Sculpture Mode |
| ◐ | Duality |
| ⬡ | BCC Lattice |
| ◇ | Menu |
| ⊘ | Clear World |
| ↻ | Reload (use it if something looks stuck) |
| ◯ | Spherical |
| — | World View, Cuboctahedron Build |

## Menu wheel

The menu is a rhombic dodecahedron. Each face is a section: tap a face to open it, and use **Home** to go back. **Cyborg**, **Settings** and **Almanac** are always on the top faces.

| Section | Contents |
|---|---|
| Home | Build, Alter, Blueprint, Change Dimension |
| Build | Add, Repeat, Fill, Symmetry, Piece, Colour |
| Piece | RD family, Cube, Pyramid, TO, Flattened Octahedron, Disphenoid, CO, Octahedron |
| RD family | RD, Hemi RD, Hourglass, RD Quarter, ED, Hex Prism, Rhombohedra, Pyrochlore |
| Alter | Dig, Smooth, Remove |
| Blueprint | Dome: opens Sculpt with "dome" filled in |
| Change Dimension | 2D, 3D, 4D |

## Settings

| Setting | What it does |
|---|---|
| Look sensitivity | Camera rotation speed |
| Invert Y | Reverses vertical drag |
| Field of view | Camera lens width |
| Graphics quality | Low, Medium or High |
| Show FPS meter | Frame-rate counter |
| Volume | Sound level |
| Model workspace | Pauses Cuboctahedron Build |
| Language | English, 日本語, Español, Français, 한국어, 中文, Русский |
| Auto-assign colour by piece type | Gives each kind of piece its own colour |
| Shell fill radius / Hollow from shell | Builds a solid or hollow ball of shells |
| Section view, axis, position, Flip | Cutaway along one axis |
| Build Cuboctahedron, Dualize Preview | Special build modes |
| AI key (provider, key, model) | Optional: use your own AI key for the assistance tiers |
| New World, Export World, Export Model (.rhomb), Import World, Share World | Save, load and share |

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
