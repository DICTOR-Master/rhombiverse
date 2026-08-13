# Rhombiverse — Spec Addendum: Penrose/RT Growth Layer (Phase 6)

Standalone addendum for `RHOMBIVERSE_PLAN.md` Phase 6: "New `growth.js`
module, new `seeds` key in world-state, generation via substitution/
L-system rules on rhombic triacontahedron geometry. Does not modify or
depend on `build.js` — additive only." Governed by
`RHOMBIVERSE_PRINCIPLES.md`. This is the spec pass `RHOMBIVERSE_PLAN.md`
section 8 said this phase needed before implementation.

---

## 1. Purpose

Phase 1–5.8 built the **crystal** half of this project's own vision
statement: a rigid, periodic FCC lattice, the same everywhere, minable
and buildable by hand. This phase builds the other, explicitly named
half: *"a quasicrystal — aperiodic, five-fold, never quite repeating,
the geometry evolution already reaches for in flowers and shells."*
Per direct instruction, this is scoped for **plant and animal forms**
specifically — the vision statement's own worked examples ("a tree, a
shell, a creature's frame") are the target output, not abstract
crystal blobs.

---

## 2. Real Geometry: Ammann Rhombohedra & the Rhombic Triacontahedron

Grounded Simplicity (`RHOMBIVERSE_PRINCIPLES.md` section 0) means
borrowing the real, named mathematical objects here exactly as the base
game borrows the real FCC lattice — not inventing an "aperiodic-looking"
approximation. The real construction, **numerically verified during
this spec pass, not just cited**:

- Take the 12 vertices of a regular icosahedron: all coordinate
  permutations of `(0, ±1, ±φ)`, where `φ = (1+√5)/2`. Six of these,
  one from each antipodal pair, are the **six icosahedral star
  vectors** — the same six five-fold axes the game's own FCC/RD system
  has no relationship to (this is a genuinely different, non-periodic
  lattice, by design).
- Any three star vectors are pairwise separated by exactly one of two
  angles: **63.43°** (`arccos(1/√5)`) or **116.57°**
  (`arccos(-1/√5)`) — verified directly (`python3`, this session):
  every pairwise angle among the six star vectors is one of these two
  values, nothing else.
- Three star vectors at 63.43° span an **acute (prolate) golden
  rhombohedron**; three at 116.57° span an **obtuse (oblate) golden
  rhombohedron**. Both have unit edge length. Verified directly this
  session: every face of both is a genuine golden rhombus (diagonal
  ratio exactly `φ = 1.618033988749895`, to full float precision), and
  the two rhombohedra's volumes are themselves in exact ratio `φ`.
  This pair is the real, standard **Ammann rhombohedron** construction
  underlying the **Ammann–Kramer–Neri (AKN) tiling**, the canonical 3D
  generalization of Penrose tiling.
- The **rhombic triacontahedron (RT)** — 30 golden-rhombus faces,
  `RHOMBIVERSE_PLAN.md`'s own named target geometry — dissects exactly
  into **10 acute + 10 obtuse** golden rhombohedra (a documented
  result, not this session's own derivation). Equivalently, the RT is
  the convex hull of a regular dodecahedron and icosahedron scaled so
  their edges are mutually orthogonal.

**Practical takeaway**: two prototiles (acute/obtuse golden
rhombohedra), both scaled from the same six star vectors, both real
golden-ratio objects, generate everything in this layer. `growth.js`
needs exactly these two tile shapes, never more.

---

## 3. Aperiodic Growth: Substitution/Inflation

Real quasicrystal tilings (AKN and its 2D cousin, Penrose) are built by
**substitution/inflation**: a tile is replaced by several smaller
copies of both prototiles, scaled down by a power of `1/φ`, and
repeated indefinitely — the same general mechanism
`RHOMBIVERSE_PLAN.md`'s own Phase 6 bullet names ("substitution/L-system
rules"). This is real, established math (the Ammann–Kramer–Neri
substitution system) — **the exact per-tile substitution multiplicities
are implementation-tunable, not fixed by this spec**: verify the
precise decomposition (how many acute/obtuse sub-tiles one acute or
obtuse tile inflates into) against a primary source (Kramer & Neri
1984; Socolar & Steinhardt 1986) at implementation time rather than
this document asserting exact numbers second-hand — same "flag it,
don't fake precision" convention this project already uses for e.g.
`roundStructure`'s `0.75` tolerance or the gravity spec's radius
constants.

**Growth reads as gradual, not a global re-inflation each tick.**
Re-running a full substitution pass over an entire existing structure
every tick would be expensive and would not match the vision
statement's own framing ("leave a crystal field untouched and come back
to find it larger") or Phase 5.5's already-deferred crystal-growth
bullet (cells auto-add adjacent to filled cells with an open face).
`growth.js` should grow **locally and incrementally**: periodically
(reusing `asteroids.js`'s own regrowth-cooldown shape — a periodic
check, discrete step once idle time exceeds a fixed tick, per this
project's established "reuse the pattern, don't invent a new one"
convention), pick open faces at the current growth frontier and attach
the next tile the local substitution grammar calls for there. The
aperiodicity comes from the real substitution grammar's own local
matching rules (Ammann's rhombohedra require matching-rule markings on
shared faces — de Bruijn/Ammann's own real mechanism — to avoid
gaps/overlaps when tiles are placed one at a time rather than by a
single global inflation), not from anything invented for this game.

---

## 4. Player-Facing Mechanic: Planting Seeds

- A **Plant** action (a seventh mode button, alongside Build/Fill/
  Round/Excavate/Generate/Report) places a `seed` at a clicked
  location — the RT/rhombohedra structure's own separate coordinate
  space, unrelated to the FCC `x,y,z` lattice cells use (see section 6).
- **Species selection**, matching the direct instruction to cover both
  plant and animal forms: a seed carries a `species` field
  (`'plant'` | `'fungus'` | `'shell'` | `'creature'`, extensible —
  `'fungus'` earns its own value rather than being folded into
  `'plant'`, see section 4.1's `fungus` template), which biases the
  *local* substitution choice at each growth step — e.g. a `'plant'`
  seed's grammar favors elongating along one axis before branching
  (tree-like), a `'fungus'` seed favors thread-like, irregular mycelial
  branching, a `'shell'` seed favors a tightening logarithmic-radius
  bias consistent with a real nautilus shell's own golden-ratio
  growth, a `'creature'` seed favors bilateral-ish branching from a
  central spine. All four still use the exact same two prototiles and
  the exact same real substitution grammar (section 3) — `species` is
  a bias on *which locally-valid substitution choice gets picked* when
  the grammar allows more than one, never a different geometry system.
  This keeps one real mechanism producing visibly different organic
  results, rather than four invented mechanisms.
- Growth ticks periodically per planted seed (reusing
  `asteroids.js`'s regrowth-cooldown shape, section 3) — a seed left
  alone gets measurably larger over real elapsed time, matching the
  vision statement directly.
- A seed can stop growing (a maximum generation count or tile count,
  implementation-tunable) so a planted structure eventually settles
  rather than growing forever — same "settles, doesn't run away"
  framing `RHOMBIVERSE_PRINCIPLES.md` section 2 (Adaptive Damping)
  already establishes for every other unbounded-seeming process in this
  project (black hole generation, asteroid population spawning,
  inventory decay).

### 4.1 Seed Templates ("off the peg" species), per direct instruction

A bare `species` bias (above) is real but abstract — a player picking
`'plant'` gets *a* tree-ish shape, not a specific, recognizable one.
This project already has the right precedent for the fix, and it's not
a new pattern: `planetoidgen.js`'s `PLANETOID_RECIPES` (`rocky`,
`ice-moon`, `gas-giant`) are named, pre-tuned instances of one general
mechanism, then `data/presets/*.json` ships large, ready-to-load,
pre-verified examples on top of that. `growth.js` should mirror this
exactly:

- `GROWTH_TEMPLATES`, a named-recipe table analogous to
  `PLANETOID_RECIPES` — each entry pre-tunes the section 4 substitution
  bias parameters (branch angle/frequency, elongation vs. radial
  preference, generation cap, orientation constraints) to reliably
  produce one specific, recognizable silhouette rather than a generic
  member of its `species` class.
- **Staged the same way the planetoid presets were, per direct
  instruction — simple/minimal templates first to prove the mechanic
  works, complex ones only once that's real**, not the full list at
  once. `data/presets/`'s own history is the concrete precedent:
  `minimal-star`/`black-hole-core`/`hydrosphere-demo` (15–21 cells,
  functional fixtures) shipped and were verified working *before*
  `rocky-planetoid.json` (5775 cells) was ever attempted — attempting
  the large/complex case first, with no small working case to build
  confidence from, is exactly backwards.

  **Wave 1 — minimal, low-generation-count templates, chosen because
  each is a genuinely simple, well-known biological growth pattern**
  (implementation should verify each actually reads as its name before
  moving to Wave 2, the same way every planetoid recipe's material
  bands were verified against the real generator output, not assumed):
  - `amoeba` — the simplest possible case: a single-cell-radius blob,
    minimal-to-zero branching, mostly testing that a seed's very first
    few generations render and look like *something* coherent at all,
    the same role `minimal-star` played for planetoid generation.
  - `moss` — very short generation cap, dense low branching, no
    dominant axis. First real test of the branching grammar itself.
  - `fungus` — thread-like, irregular mycelial branching; genuinely
    distinct from `plant`'s own bias (fungi aren't plants), so this is
    also where a fourth `species` value (`'fungus'`, alongside
    `'plant'`/`'shell'`/`'creature'`) earns its place rather than being
    forced into `plant`.
  - `fern` — the classic, textbook self-similar branching example in
    computer graphics (a Barnsley-fern-style frond is literally the
    standard demo for this exact class of substitution/L-system
    growth), and the first Wave-1 template with a clearly directional,
    frond-like read rather than a blob — the natural bridge to Wave 2.

  **Wave 2 — larger, more complex templates, attempted only after Wave
  1 is real and verified**, mirroring `rocky-planetoid.json`'s own
  "large enough to actually read as the intended thing" lesson (a small
  cluster of any voxel/tile system reads as "a clump," not its intended
  form — CLAUDE.md's own documented finding for planetoids, expected to
  hold here too): `sapling`/`conifer`/`shrub` (`plant`), `nautilus`/
  `scallop` (`shell`), `spineling`/`cluster-frame` (`creature`).

  Exact parameter values for every template above are implementation-
  tunable, same "first-guess, verify against the real output"
  convention as every other tuned constant in this project — this list
  fixes *names, wave ordering, and intended silhouettes*, not final
  numbers.
- A `data/growth-presets/*.json` directory, mirroring
  `data/presets/*.json` exactly: a handful of large, pre-grown,
  hand-verified example structures generated via the real
  `GROWTH_TEMPLATES` machinery (never hand-authored coordinates —
  matches this project's own hard rule after the presets' own history
  of catching real bugs by generating from real code instead), added
  Wave-appropriately (a `moss`/`fern` preset once Wave 1 works; a large
  `conifer`/`nautilus` preset once Wave 2 does) and loadable instantly,
  the same "exact recipe, no manual growth-waiting needed" convenience
  the planetoid presets already provide.

---

## 5. Rendering: Additive, Not a Modification to the RD System

- New geometry only: an acute-rhombohedron mesh and an
  obtuse-rhombohedron mesh, built once from the section 2 vertex math
  (mirrors exactly how `lattice.js`'s `rdRawVerts` is built once from
  real vertex math and reused everywhere) — likely via `THREE.
  ConvexGeometry` on each rhombohedron's 8 vertices, the same technique
  `render.js` already uses for the RD voxel itself.
- A **separate** `InstancedMesh` pair (one per prototile), analogous to
  the existing RD `InstancedMesh` but never sharing its buffer/capacity
  — a growth structure's tile count is unrelated to `MAX_CELLS`, and
  must not compete with it or risk the same lazy-bounding-sphere
  raycast bug `render.js`'s own history already found and fixed for the
  RD mesh (`rebuildInstances` must call `computeBoundingSphere()` again
  here, for the same documented reason).
- Rhombohedra render in **world space**, positioned/scaled independent
  of the FCC lattice's own `cellToWorld` — a planted seed's location is
  a real `(x, y, z)` world-space point, not a lattice cell coordinate,
  since Ammann rhombohedra do not tile the same space as the RD/FCC
  lattice at all (a fundamentally different, non-commensurate geometry,
  by design — this is real quasicrystal math specifically because it
  is aperiodic and does not share the crystal lattice's own repeat
  structure).
- `build.js` is never imported by or imports `growth.js` — matches the
  plan's own explicit constraint. Materials/coloring reuse the existing
  `MATERIAL_COLORS` palette rather than inventing a new one, unless a
  real reason (e.g. distinguishing acute/oblate tiles visually) argues
  otherwise.

---

## 6. World-State Schema Extension

```json
{
  "seeds": {
    "seed_1": {
      "species": "plant",
      "origin": [12.4, 0.0, -3.1],
      "plantedAt": "ISO timestamp",
      "lastGrowthAt": "ISO timestamp",
      "generation": 3,
      "tiles": [
        { "type": "acute", "position": [0, 0, 0], "orientation": 0 },
        { "type": "oblate", "position": [1.62, 0, 0.62], "orientation": 4 }
      ]
    }
  }
}
```

- New **top-level** key, `seeds` — additive to the existing world-state
  shape exactly like `claims`/`playerInventory`/`pendingTrades` were
  before it (`RHOMBIVERSE_PLAN.md` section 0's own golden rule: extend,
  never restructure).
- `origin` is a real-valued 3D point (not an integer lattice
  coordinate) — Ammann rhombohedra tile positions are not integers in
  general, unlike every other coordinate in this project so far.
  `tiles[].position` is relative to `origin`.
- `orientation` indexes into the finite set of real icosahedral-group
  rotations a tile can take (the 6 star vectors admit a specific finite
  symmetry group) — implementation detail, not fixed here.
- Synced the same way `claims`/`pendingTrades` are, if Shared World
  support is added for this layer (not required for a first pass —
  see section 9).

---

## 7. Isolation & Scope (per `RHOMBIVERSE_PRINCIPLES.md` section 1)

- A seed's own blast radius is itself: growth only ever adds tiles
  attached to that seed's own frontier, never touches another seed's
  tiles, never touches any FCC/RD cell, never touches `build.js`'s own
  world-state (`cells`). Two systems occupying the same visual space,
  provably unable to corrupt one another's data.
- A capped generation/tile count (section 4) is this layer's own
  Adaptive Damping instance — grows, then settles, per section 2 of
  Principles, matching every other unbounded-seeming mechanic already
  built in this project.
- Performance blast radius: a separate `InstancedMesh` pair with its
  own fixed capacity (mirroring `MAX_CELLS`'s own role for the RD mesh)
  bounds worst-case render cost independent of how many FCC cells exist.

---

## 8. Relationship to Phase 5.5's Deferred Crystal-Growth Bullet

`RHOMBIVERSE_PLAN.md` Phase 5.5 named an optional, never-built bullet:
"cells auto-add adjacent to filled cells with an open face, weighted by
a resource/mineral value... modeling real garnet crystal growth" on the
**existing FCC/RD lattice**. This spec does not implement that bullet —
it implements a related but geometrically distinct idea (real
aperiodic quasicrystal growth, a different lattice entirely) that
happens to satisfy the same *player-facing* promise ("leave it, come
back to find it grown"). Both could coexist: a future pass could still
add periodic FCC crystal growth (garnet-real, mirroring this project's
own mineral) as a separate, smaller feature reusing `NEIGHBOR_OFFSETS`
directly, distinct from this Penrose/RT layer's own organic
plant/animal framing. Not attempted in this pass — noted so a future
session doesn't assume this spec already covers it.

---

## 9. Success Checks

- [ ] A player can Plant a seed at a chosen world location; a
  rhombohedra structure appears there immediately (even a single tile
  — a seed is never invisible).
- [ ] Left alone, a planted seed measurably grows (more tiles) after
  real elapsed time, without any player action.
- [ ] The two prototile shapes used are verifiably golden rhombohedra
  (face diagonal ratio `φ`, per section 2's own verification method) —
  not an approximation.
- [ ] Different `species` values produce visibly different growth
  shapes (elongated/branching vs. thread-like/mycelial vs.
  radial/shell-like vs. spine-branching) from the same underlying tile
  set and grammar.
- [ ] Each named `GROWTH_TEMPLATES` entry (section 4.1) reliably
  produces its intended, recognizable silhouette — verified by
  generating it for real and looking at it, the same discipline
  `data/presets/rocky-planetoid.json` etc. were held to, not assumed
  from the parameters alone.
- [ ] At least one `data/growth-presets/*.json` file loads instantly
  into a large, pre-grown example structure, generated via the real
  template machinery rather than hand-authored.
- [ ] Growth eventually stops (generation/tile cap) rather than running
  away indefinitely.
- [ ] `build.js` is untouched — no import either direction between it
  and `growth.js`.
- [ ] Two planted seeds' growth never interact, overlap-detect, or
  otherwise reference each other.

---

## 10. Deferred / Not Yet Decided

- Exact substitution/inflation multiplicities (section 3) — pin down
  against a primary source at implementation time, not guessed here.
- Whether growth requires proximity to an FCC planetoid/gravity source,
  or can be planted freestanding in open space — a real design choice
  the plan doc doesn't resolve; simplest default is freestanding
  (fewer cross-system dependencies), revisit if it reads wrong in play.
- Shared World sync for `seeds` — not required for a first, local-only
  pass; the existing `claims`/`pendingTrades` precedent is the template
  to follow if/when this layer needs it.
- Whether a planted seed can ever be removed/harvested by a player, and
  what (if anything) that yields — genuinely undecided; the vision
  statement only describes growth, not consumption.
- Matching-rule tile markings (section 3's own real mechanism for
  gap/overlap-free incremental placement) — real, necessary, and left
  for implementation to get exactly right against a primary source
  rather than approximated here.

---

## 11. Claude Code Prompt (copy-paste to start this addendum)

> Implement Phase 6 (Penrose/RT Growth Layer) per
> `RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`. New `src/growth.js`: build the
> two Ammann rhombohedra (acute/obtuse) from the six icosahedral star
> vectors exactly as section 2 describes, verify the golden-ratio face
> diagonals and volume ratio directly (don't trust it unverified).
> Implement local, incremental substitution growth per section 3 —
> confirm the exact per-tile substitution counts against a primary
> source before hardcoding them, and say which source you used. Add
> the `seeds` world-state key (section 6) and a Plant mode button
> (section 4) with `species` selection for `plant`/`fungus`/`shell`/
> `creature`. Add `GROWTH_TEMPLATES` (section 4.1) but build and verify
> ONLY the Wave 1 templates first (`amoeba`, `moss`, `fungus`, `fern`)
> before attempting any Wave 2 one (`conifer`, `nautilus`, `spineling`,
> etc.) — same staged approach the planetoid presets already proved out
> (small functional fixtures verified working before the large
> rocky-planetoid preset was ever attempted), not the full list at
> once. Add at least one `data/growth-presets/*.json` generated for
> real from that machinery once Wave 1 works, mirroring
> `planetoidgen.js`/`data/presets/*.json`'s own established pattern
> exactly. Render via a
> new, separate `InstancedMesh` pair (section 5) — never touch
> `build.js` or the existing `cells`/`MAX_CELLS` system. Verify growth
> over time, species-driven shape differences, and that each template
> actually looks like its name via direct execution (this project's
> established practice — static reading alone has repeatedly missed
> real bugs here), not just reasoning about the code.
