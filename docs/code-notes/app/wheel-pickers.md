# Notes: `src/app/wheel-pickers.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## Piece picker: real RD geometry, not an approximation

**Superseded same day**: the flat-SVG widget this section originally
described (built in `wheel-pickers.js` itself) is gone -- direct live
comparison against a real wheel screenshot found it "easily
distinguishable from the real wheel" (no genuine perspective/lighting a
flat SVG can produce). Replaced with a real WebGL mini-render,
`app/piece-cluster-3d.js` -- see that file's own header for the
rendering side of the story. The geometry derivation below is still
exactly how the real 4 faces/vertex were found, and that same insight
(which 4 of the 12 `buildRDFaces()` faces share a 4-valent vertex) is
what the new widget's fixed rotation and face selection are built from
too -- kept here as the one real source of that computation, cross-
referenced rather than re-derived a third time.

Direct instruction, 2026-08-26, after two earlier misreads (a flat
picker-strip, then a plain 2x2 CSS grid of rotated squares): "I want it
to look like it is the wheel static at a position where four diamond
faces form a square... in the same color size and orientation as the
real RD, the menu one not the HUD."

Taken literally and computed, not eyeballed. An RD has 6 vertices where
exactly 4 faces meet (the "apex"/4-valent vertices — the other 8 are
3-valent, where the main wheel's own default opening view looks down
instead). `buildRDFaces()` (`rhombic-wheel-3d-core.js`) generates all 12
faces from three loops (equator/top/bottom); a real script (not this
file, a throwaway check) built that same face list and searched for
which faces actually share vertex `(2,0,0)` — exactly 4 came back:

```
equator sx=1 sy=1  [[2,0,0],[1,1,1],[0,2,0],[1,1,-1]]
equator sx=1 sy=-1 [[2,0,0],[1,-1,1],[0,-2,0],[1,-1,-1]]
top sx=1 sz=1      [[2,0,0],[1,1,1],[0,0,2],[1,-1,1]]
bottom sx=1 sz=-1  [[2,0,0],[1,1,-1],[0,0,-2],[1,-1,-1]]
```

`(2,0,0)` sits exactly on the +X axis, so "looking straight down that
shared vertex's own axis" is a plain orthographic drop of the X
coordinate — no camera math needed, just project each vertex to `(y,
-z)` (the negation keeps +Z appearing up on screen, matching a normal
top-is-up reading). Scaled by 25, that gave the 4 polygons the old flat
SVG widget hard-coded (its own `PIECE_FACE_LAYOUT`, since removed):

```
right/rd:      0,0  25,-25  50,0   25,25
bottom/cube:   0,0  25,25   0,50   -25,25
left/pyramid:  0,0  -25,-25 -50,0  -25,25
top/to:        0,0  25,-25  0,-50  -25,-25
```

Real, checked consequence, not assumed: the 4 outer points — `(50,0)`,
`(0,50)`, `(-50,0)`, `(0,-50)` — have equal diagonals of length 100,
i.e. they form an exact square (a "diamond" the way the instruction used
the word) when the 4 faces are placed together. That square is the
actual, computed silhouette of "4 real rhombic faces meeting at one of
the RD's own 4-valent vertices, viewed head-on" — not a shape chosen to
look like one. The new WebGL widget doesn't need these flat 2D
coordinates at all (a real camera does the projection now) — it reuses
`hud-wheel-3d.js`'s own already-verified rotation for this exact vertex
(`group.rotation.set(0, -Math.PI/2, 0)`) instead, but it's the same 4
faces (`equator|sx1sy1` / `equator|sx1sy-1` / `top|sx1sz1` /
`bottom|sx1sz-1`) this computation found.

Which piece tier (rd/cube/pyramid/to) sits on which of the 4 positions
is arbitrary (no semantic reason ties, say, "Cube" to one slot
specifically) — the geometry only fixes that there are 4 congruent
rhombi meeting at a center forming a square, not which label goes where.

Color: `#4DD0E1` (`SKELETON_COLOR`, `rhombic-wheel-3d-core.js`) — the
MAIN Rhombic Wheel 3D's own wireframe cyan, not the small persistent HUD
wheel's gold (`hud-wheel-3d.js`'s `GOLD = 0xd4af37`) — direct
clarification the two were being confused ("the menu one not the HUD").
Still true of the WebGL widget's own material.

## Everything else in this file

`openMaterialWheel`/`openPickerStrip`/the drag-placement toggle predate
this and are unchanged — real, independent functionality extracted out
of the old 2D `wheel.js` (removed 2026-08-25) so the Rhombic Wheel 3D,
now the sole navigation surface, doesn't depend on a second UI's
internals for real features. `openPickerStrip` gained optional
per-option `icon` support in the same session as the piece-cluster work
above (used briefly by an earlier Piece-picker attempt, since reverted
to the dedicated cluster widget) — left in place as a real, reusable
capability for any future picker that wants it, not dead code.
