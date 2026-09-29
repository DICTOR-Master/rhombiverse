# Rhombiverse — Spec Addendum: Spherical View Cycle

**Equivalent volume → close packing → structural voids**

> For Claude Code: read this spec, inspect the existing spherical toggle / X-Ray Lens code, then produce a staged implementation plan before writing any code.

## 1. Concept

The existing Spherical View becomes the first state of a three-state cycle. Each press of the same control reveals a deeper reading of the **same selected geometry**. It is not a new block type, a new shape family, or a separate system.

- Obeys the X-Ray Lens rule: **view-only, no world-state change**.
- Appears only on shapes where a spherical reading is geometrically meaningful.
- "CPS" (close-packed spheres) is an internal term only. It never appears in the UI.

## 2. The Three States

| # | State | What the user sees | Question it answers |
|---|---|---|---|
| 1 | **Equivalent Sphere** | The existing spherical toggle: superellipsoid, or a volume-matched sphere as fallback | "What round form holds this volume?" |
| 2 | **Close-Packed Spheres** | One touching sphere per lattice site inside the selection | "How do spheres fill this?" |
| 3 | **Voids / Structure** | The tetrahedral and octahedral gaps between those spheres | "What space does packing leave behind?" |

Cycle order: Shape → Sphere → Packed Spheres → Voids → back to Shape.

## 3. Why This Fits Rhombiverse

The rhombic dodecahedron is the Voronoi cell of the FCC lattice, so packing falls straight out of the block grid:

- **State 2:** put one sphere at each RD cell centre. Neighbours touch across the 12 faces (kissing number 12).
- **State 3:** the voids sit on RD vertices.
  - The 6 four-valent vertices are **octahedral voids** (6 spheres around each).
  - The 8 three-valent vertices are **tetrahedral voids** (4 spheres around each).

Using D3 / A1* integer coordinates (sphere centres on even-sum integer points, where cell-centre (0,0,0) has vertices (±1,0,0) and (±½,±½,±½)), nothing has to be searched for. Both voids and spheres can be read directly off the existing geometry.

## 4. Technical Foundation

- **Lattice coordinate generator:** FCC in the A1*/D3 integer frame. HCP (ABAB layers, vertical offset √(2/3)·d) is optional and comes later.
- **Void detector:** classify RD vertices by valence (4 → octahedral, 3 → tetrahedral). Keep a general four-sphere/six-sphere detector for non-grid clusters.
- **Rendering:** one centralised `THREE.InstancedMesh` each for spheres, tetra voids and octa voids.
- **Radius transition:** a continuous parameter inside the lens, not a main control.
  - `0` = the baseline Rhombiverse wireframe
  - `EdgeLength/2` = spheres at tangency
  - greater than that = overlapping, molecular-style clusters
- Expose all radii and thresholds as **named constants**. Add per-shape `renderMode` flags as QA escape hatches.

## 5. Interface

- One compact symbol or toggle cycles through the states. It is not three separate buttons.
- The geometry itself explains the change, with minimal text.
- Open question, carried over: can this lens layer with the Structural Lens, or must they be mutually exclusive?

## 6. Implementation Order

1. Formalise the existing spherical toggle as State 1.
2. Add State 2 close-packed spheres for RD cells and multi-cell selections.
3. Add State 3 void display from RD vertex valence.
4. Wire all three into a single cycle control.
5. Switch to instanced rendering before scaling to large selections.
6. Test which shapes benefit, and expose the cycle only on those.

**Later extensions (out of scope for the first release):**

- Voronoi boundary/shell extraction. This does not become a fourth state unless testing shows it is clearly distinct.
- Sphere-to-void snapping and structural-integrity checks, as an extension of the existing face-to-face snapping system.

## 7. Design Principle

The geometry should become progressively more revealing without the interface becoming progressively more complicated.
