# Rhombiverse — Spec Addendum: Spherical Toggle

## Purpose

A view toggle that renders geometric bodies in a simplified, near-spherical
form: shapes with uniform face-distance render as true spheres; shapes with
non-uniform face-distance render as superellipsoids (a "flattened sphere"
that still respects the shape's cubic symmetry).

**No torus/ring-grouping of any kind — direct instruction, ruled out
entirely, not deferred.** Every cell (disphenoid included) always renders
as its own individual sphere, full stop, regardless of how many same-type
cells are arranged around a shared axis. An earlier draft of this doc had
a ring→torus section; it's removed, not "not yet built" — don't re-add it.

General spirit: **make everything as near-spherical as possible.** The rules
below are a starting algorithm, not a locked spec — thresholds are exposed as
named constants so they can be tuned after visual testing without touching
the core logic.

---

## 1. Per-shape classification (single body)

For any shape being rendered under the toggle:

1. Compute the set of face-plane distances from the shape's center (one
   distance per distinct face orientation class, not per individual face).
2. **If all distances are equal** (within `EPSILON_UNIFORM`, suggested
   `1e-4`): render as a **plain sphere**, radius = that distance.
   - Applies to: Cube, Octahedron, Rhombic Dodecahedron, and any disphenoid
     (disphenoids have congruent, symmetry-related faces and are always
     equidistant from center — treat as sphere individually, no exception
     logic needed).
3. **If there are exactly two distinct distances**, and one distance belongs
   to axis-aligned faces (face normal ∝ (1,0,0)-type) and the other to
   body-diagonal faces (face normal ∝ (1,1,1)-type): render as a
   **superellipsoid**.
   - Applies to: Cuboctahedron, Truncated Octahedron.
4. **Anything else** (more than two distinct distances, or faces that don't
   cleanly resolve into axis/diagonal families): **fall back to a
   volume-matched sphere.** Do not attempt to force-fit a superellipsoid —
   this keeps the rule safe for future shapes not yet accounted for here.
   - Volume-matched radius: `R = (3V / 4π)^(1/3)`, where `V` is the shape's
     true volume.

---

## 2. Superellipsoid formula (case 3 above)

Equation: `|x|^n + |y|^n + |z|^n = R^n`

- `R` = the axis-aligned face distance (this holds exactly regardless of `n`,
  since setting y=z=0 in the equation gives x=R directly).
- `n` solved from the ratio of the two face distances:

  ```
  ρ = diagonal_face_distance / axis_face_distance
  n = 1 / (0.5 − log₃(ρ))
  ```

  (`log₃(ρ) = ln(ρ) / ln(3)`)

Verified against both known shapes:

| Shape | Axis faces | Diagonal faces | ρ | Solved n |
|---|---|---|---|---|
| Cuboctahedron | squares, R=1.0 | triangles, 1.1547 | 1.1547 | 2.7095 |
| Truncated Octahedron | squares, R=1.1547 | hexagons, 1.0 | 0.8660 | 1.5850 |

Note the CO/TO relationship: same ratio magnitude (2/√3 ≈ 1.1547) in both
cases, but inverted — CO bulges toward its diagonal (triangle) faces (n>2,
rounder-than-sphere at corners), TO bulges toward its axis (square) faces
(n<2, flatter-than-sphere, closer to octahedron-like). The formula handles
both directions without a special case — `n` naturally lands above or below
2 depending on which face family is farther out.

---

## 3. Visual-QA escape hatch

Per-shape render mode is a named, human-editable constant, not a runtime
decision:

```
renderMode: 'superellipsoid' | 'volumeSphere'
```

Default `'superellipsoid'` for any shape hitting case 3. If it reads wrong
in a build, flip the constant for that shape to `'volumeSphere'` — no code
change required. Volume-matched sphere radii, precomputed for reference:

- Cuboctahedron: **1.1675** (vs. face distances 1.0 / 1.1547)
- Truncated Octahedron: **1.1371** (vs. face distances 1.1547 / 1.0)

---

## Implementation notes

- Cube / Octahedron / RD keep using the existing plain-sphere path — no
  regression risk, nothing here changes their behavior.
- Superellipsoid rendering needs one reusable function
  (`|x|^n+|y|^n+|z|^n=R^n`), parameterized by `R` and `n` — not a per-shape
  mesh.
- All numeric thresholds in Section 3 should live as named constants in
  one config location, not inline, so DICTO can retune after visual testing
  without touching detection/render logic.
- No ring/torus grouping — see Purpose above. Disphenoids (including the
  Flattened Octahedron, which is 4 disphenoids around a shared axis) always
  render as individual spheres, never merged.
