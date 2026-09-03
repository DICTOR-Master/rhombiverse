# Rhombis — staged build plan

*Implementation brief — hand this directly to Claude Code.*

A 3D geometric-packing puzzle — closer to a crossword that gains pieces each level than to falling-block Tetris. A target "skeleton" (the outline of a composite solid) appears on screen. The player rotates it, selects pieces from a tray, and moves each into its void until the skeleton is fully filled. No lattice or grid is ever shown — only the silhouette of whatever still needs filling. Difficulty increases in stages, each one introducing a larger composite built from more copies of a single shared piece.

## Core geometry (verified)

Everything in the game comes from one base solid — there is exactly one geometry function to get right; every other shape is that function plus transforms.

**Base pyramid**: right pyramid, square base of side `s`, apex directly above the base's center at height `s/2`. It's one-sixth of a cube of edge `s` — apex at the cube's center, base on one face.

| Shape | Pyramid count | Construction |
|---|---|---|
| Pyramid | 1 | the base unit itself |
| Octahedron | 2 | two pyramids joined base-to-base |
| Cube | 6 | apexes meeting at the cube's center, one pyramid per face |
| Rhombic dodecahedron | 12 | a cube's 6 inward pyramids, plus 6 more of the same pyramid mirrored outward on each face |

Checked by coordinates, not just piece count: cube centered at the origin, corners at `(±s/2, ±s/2, ±s/2)`, inward apex at `(0,0,0)`, outward cap apexes at `(±s,0,0)`, `(0,±s,0)`, `(0,0,±s)`. Each pair of adjacent outward caps is provably coplanar and equilateral — a true flat rhombus, not two creased triangles. Volumes match too: 12 pyramids (6 inward + 6 outward) equal the standard rhombic dodecahedron volume for these coordinates.

One thing to decide rather than default silently: at height `s/2`, the 2-pyramid "octahedron" is a flatter bipyramid, not a regular Platonic octahedron (regular needs height ≈0.707×base edge). Doesn't affect puzzle logic, but affects how recognizable the piece looks.

## Interaction model

- **Skeleton**: wireframe outline of the target shape only — no grid, no internal lines beyond the target's own silhouette. Internal seams appear only as pieces are actually placed.
- **Rotation**: drag to orbit the skeleton.
- **Tray**: available pieces shown separately from the skeleton.
- **Placement**: tap a piece, then tap its destination; it snaps in if correctly oriented and positioned, rejects with feedback otherwise.
- **Conjoined pieces** (stage 5+): some voids can be filled more than one way — e.g. a cube-shaped gap by six loose pyramids, or by one pre-fused cube piece.

## Staged build plan

### Stage 1 — engine + one piece
Scene with orbit controls (three.js suits rotate + tap-to-place + raycasting for selection well). One parametrized pyramid mesh function, reused everywhere downstream — never redefined per shape. Pyramid skeleton + one solid piece; tap piece, tap skeleton, it snaps in.
*Done when*: free rotation, one placement, clear solved state.

### Stage 2 — octahedron (2 pieces)
Bipyramid skeleton. Two pieces, each needing correct orientation (apex in vs. out) — first stage where rotating the piece itself matters, not just its position.
*Done when*: both placeable in either order; wrong orientation is visibly rejected.

### Stage 3 — cube (6 pieces)
Cube skeleton; 6 voids sharing the cube's center as a common apex point. Tray needs to track counts of identical pieces. First real test of "no visible lattice" — only the cube's outer silhouette shows pre-solve.
*Done when*: 6 identical pieces placeable in any order, no stray internal lines before the puzzle is solved.

### Stage 4 — rhombic dodecahedron (12 pieces)
Skeleton with 12 voids (6 inward + 6 outward, per the coordinates above). Inward and outward pyramids look identical but sit differently — placement must resolve which is which.
*Done when*: full 12-piece assembly reachable by rotate + tap, matching the coordinates given.

### Stage 5 — conjoined pieces
Add pre-fused alternates (a fused pair standing in for 2 pyramids, a fused six for a cube) as optional fills for part of a larger void. Puzzle logic needs to accept more than one valid decomposition of the same volume.
*Done when*: at least one puzzle is solvable two different ways.

### Stage 6 — multi-cell puzzles
Skeletons spanning several rhombic dodecahedra positioned per an FCC lattice — the connection back to the original "strings of blocks" idea and the Rhombiverse lattice work. Pieces can be any mix of loose or fused units.
*Done when*: a multi-cell skeleton is fillable by more than one piece combination.

### Stage 7 — content and polish
Procedural skeleton generator instead of hand-built levels, so difficulty scales smoothly. Scoring/timer, undo, piece-bank UI, touch refinements (pinch-to-rotate, hold-to-preview before placing).

## Open decisions

- Platform: three.js on web is the suggested default (covers rotate + tap-to-place, ports to mobile later) — flag if this needs to be native instead.
- Whether the flatter octahedron ships as-is or gets visually called out for the player.
- Snap tolerance for position and rotation when placing a piece.
