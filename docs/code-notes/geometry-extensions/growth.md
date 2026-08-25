# Notes: `src/geometry-extensions/growth.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File overview

Phase 6 — `RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`. Real Ammann-rhombohedra
geometry (the same construction underlying the Ammann-Kramer-Neri
tiling, the standard 3D generalization of Penrose tiling), grown by
local, incremental substitution rather than a global re-inflation — see
the spec's own section 3 for why. Additive only: this module never
imports, and is never imported by, `build.js`.

Overlap prevention here is a real per-candidate 3D separating-axis test
against every tile already placed (`tilesOverlap`, below) — not the
full formal Ammann matching-rule vertex-decoration atlas needed for a
rigorously long-range-consistent AKN tiling — flagged honestly, not
glossed over. An earlier version of this file used centroid-equality
dedup instead (mirroring `lattice.js`'s own `cellKey`-based Map dedup
for the FCC lattice) on the assumption that exact face-matching plus
"don't recreate the exact same tile" was enough to guarantee no
overlap; a real SAT check found (2026-08-13) that assumption was wrong
— see `growSeed`'s own section below for the specific bug and fix. For
Wave 1's bounded, low-generation-count templates (amoeba/moss/fungus/
fern), real geometric overlap testing is cheap (at most a few dozen
tiles); a future pass adding much larger/longer-running structures may
need the fuller matching-rule system for performance, not correctness.

## `STAR_DIRECTIONS` / `buildStarDirections`

The 12 icosahedron vertex directions (unit vectors): all coordinate
permutations of (0, ±1, ±phi). Verified during the spec pass
(2026-08-13, and re-verified at module load, not just trusted): every
pairwise angle among these 12 is one of exactly three values — 63.43deg
(acute), 116.57deg (oblate), or 180deg (antipodal pairs) — nothing
else. This is the real construction, not an approximation.

## `VALID_TRIPLES` / `buildValidTriples`

Every valid golden-rhombohedron corner: a triple of direction indices
(into `STAR_DIRECTIONS`) whose three pairwise angles are ALL acute
(63.43deg) or ALL oblate (116.57deg) — a "mixed" triple is a valid
parallelepiped but its faces would NOT all be golden rhombi, so it is
not a real Ammann rhombohedron and is excluded. Computed once at module
load; verified this session (Python) to be exactly 20 acute + 20 oblate
= 40 total among the 220 possible triples of 12 directions.

## `EXTENSIONS_BY_PAIR` / `buildExtensionsByPair`

For an open face spanned by direction pair (i,j), which third
directions validly extend it, and what type of tile each produces.
Verified this session: every non-antipodal pair has at least one
(usually two) valid extension — growth never hits a dead end using only
these real prototile shapes.

## `unitTileVertices` / `tileVertices`

A single tile's 8 local vertices (relative to its own origin corner,
not offset by any seed) for a given direction triple — `render.js`'s
own building block for the two rhombohedron mesh templates (one per
prototile). Exported specifically so `render.js` never needs to
reimplement this subset-sum math itself; `growth.js` stays the one
source of truth for the real geometry.

A tile's 8 vertices: origin + every subset-sum of its 3 edge directions
(edge length fixed at 1, matching the spec's own unit-edge convention).

## `tileEdges`

The 3 basis edge vectors of a tile, read straight back out of its own 8
vertices (`verts[0]` is the origin corner; `verts[4]`/`[2]`/`[1]` are
the single-edge corners, per `tileVertices`' own a/b/c bit order) —
derived from the same vertex list `render.js`/tests already trust,
rather than re-deriving from `tile.dirs` a second way.

## `tilesOverlap` (and its helpers `centroidOf`/`maxRadiusFrom`)

Real 3D separating-axis test between two golden-rhombohedron tiles —
this is the actual fix for the overlap bug found 2026-08-13: the
original code only ever compared a NEW candidate's rounded centroid
against already-placed tiles' own centroids, which correctly catches an
exact duplicate placement but says nothing about a DIFFERENT tile whose
volume still overlaps an existing one — and one of the two "valid"
extension options at a face routinely does exactly that (folds back
into the parent tile instead of extending outward; see `growSeed`'s own
section below for why). Two convex parallelepipeds are separated iff
some axis among {each shape's 3 face normals, every pairwise cross
product of one shape's edge with the other's (9)} shows non-overlapping
projections — the standard SAT test for oriented boxes, exhaustive for
this shape class (15 candidate axes). `eps` tolerance treats two tiles
that only TOUCH along a shared face (zero-width projection overlap) as
non-overlapping, which is the correct and expected result for
legitimately glued neighbors. Exported so the test suite can check real
overlap directly against the same implementation `growSeed` itself
trusts, rather than re-deriving SAT math a second time (which is
exactly how the original bug went undetected: the old test only
re-checked centroid equality, not real overlap).

**Bounding-sphere pre-check** (added 2026-08-24, profiling the
first-visit Showcase World load): cheap conservative pre-check before
the expensive exact SAT test — if the two tiles' bounding SPHERES don't
overlap, the (smaller, convex) tiles inside them provably can't overlap
either — this can only ever skip work, never change the real answer.
Found live profiling growth catch-up: `growSeed`'s own
`placedVerts.some(...)` checks every new candidate against EVERY
already-placed tile in a seed, so this pre-check's payoff (O(16)
distance checks vs. up to 15 axes x 16 projections of exact SAT)
compounds directly with total tile count during a long catch-up run.

## `facesOfTile`

One open face on the growth frontier: the two directions spanning it,
the real-space point of their shared corner, and which tile/local face
it belongs to (so a consumed face can be removed from the frontier once
something attaches there). 6 faces: for each of the 3 direction pairs,
one face at the "near" corner (offset 0 along the third axis) and one
at the "far" corner (offset 1 along the third axis, i.e. o + that
direction).

## `SPECIES_BIAS`

Species bias: given the real valid extension options for a face (each
`{third, type}`), pick one. All four species use the exact same
prototiles and the exact same real per-face option set
(`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 4's own "one real
mechanism, four biases, not four invented mechanisms") — species only
weights WHICH locally-valid option gets picked, and how many faces
attempt to grow per tick.

- **amoeba**: minimal branching — strongly prefer whichever option
  keeps the structure compact (oblate tiles are the lower-volume
  prototile, see `growth.test.mjs`'s own verified volume ratio).
- **moss**: dense, low branching, no dominant axis — roughly even bias,
  but only ever grows a couple of faces per tick (short generation cap,
  per the spec's own Wave 1 framing).
- **fungus**: thread-like, irregular — strongly prefer acute (the more
  elongated-reading prototile) and grow from just one face at a time,
  giving a wandering, thread-like frontier rather than a filled blob.
- **fern**: directional, frond-like — prefer acute (elongating) but
  grow from more faces per tick than fungus, giving a fuller frond
  rather than a single thread.

## `GROWTH_TEMPLATES`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 4.1: Wave 1 only in the
first pass, per the spec's own explicit staging — simple,
low-generation-count templates first, to prove the mechanic works,
before ever attempting Wave 2 (sapling/conifer/shrub, nautilus/scallop,
spineling/cluster-frame). `maxGeneration` bounds growth per Adaptive
Damping (`RHOMBIVERSE_PRINCIPLES.md` section 2) — it settles, it
doesn't run away.

Deliberate simplification from the spec's own section 4 schema, worth
flagging plainly: the spec describes `species` as a broader category
(`plant`/`fungus`/`shell`/`creature`) with named templates AS INSTANCES
of a species. Wave 1 collapses that to one field — each template key IS
its own species value below — because with exactly one template per
intended look, a separate category-vs-template distinction has no work
to do yet. That distinction becomes real once Wave 2 gives a category
multiple templates (e.g. `plant` covering both `sapling` and `conifer`)
— this table's own shape is the thing to revisit then, not a mistake to
fix now.

Wave 2 (2026-08-13), per the spec's own section 4.1 staging — only
attempted after Wave 1 was real and verified, which it now is. This is
also where `species` (category: plant/shell/creature) and the template
key genuinely diverge for the first time — multiple templates now share
one category, exactly the distinction the spec's own header flagged as
"not real yet" for Wave 1. Each entry carries its OWN `bias` (rather
than falling back to the coarser per-category `SPECIES_BIAS` table Wave
1 used) since the spec explicitly calls for per-template tuning, not
per-category: "each entry pre-tunes the section 4 substitution bias
parameters... to reliably produce one specific, recognizable
silhouette."

`preferType`/`facesPerTick`/`maxGeneration` remain the entire real
tunable surface `growSeed` exposes (see `SPECIES_BIAS` above) — these
values are a first-guess, grounded in the real growth habit each
template names, verified against actual generator output (tile count,
bounding-box elongation) in `growth.test.mjs` and the preset generation
script, not asserted here unchecked.

Per-template real-biology grounding:
- **sapling** (`plant`, maxGeneration 8): a young tree — already
  elongating along one dominant axis (tree-like, not a blob) but modest
  in both height and generation count, distinct from a mature conifer.
- **conifer** (`plant`, maxGeneration 16): a mature evergreen —
  strongly single-axis elongating (acute prototile only, same
  `facesPerTick` as sapling so the read stays a single trunk-like
  column, not a wider crown) but grown far longer, so it reads
  unambiguously taller/older.
- **shrub** (`plant`, maxGeneration 9): a bush — many simultaneous low
  branches rather than one dominant axis (no preferred prototile, high
  `facesPerTick`), short-to-moderate generation cap so it reads
  bushy/wide rather than tall.
- **nautilus** (`shell`, maxGeneration 14): a nautilus shell's own
  logarithmic-spiral, tightly-wound growth. `growSeed`'s grammar has no
  explicit radius/curvature primitive (flagged honestly, matching this
  module's own established practice of not overclaiming precision it
  doesn't have) — the tightest available approximation within the
  existing two-prototile grammar is a strong, exclusive oblate
  preference (the lower-volume, more tightly-packing prototile) at the
  slowest possible growth rate (`facesPerTick: 1`), run for many
  generations, so the structure stays compact and dense rather than
  sprawling — a coiled read, not a true parametric spiral.
- **scallop** (`shell`, maxGeneration 8): a scallop's fluted,
  radially-ribbed fan, wider and flatter than a nautilus's tight coil —
  same oblate compactness preference, but more simultaneous growth
  points (a fanning frontier) and a shorter generation cap, so it reads
  as a smaller, broader fan rather than a long coil.
- **spineling** (`creature`, maxGeneration 10): a small creature's
  bilateral frame growing outward from a central spine — acute
  (elongating) prototile, two simultaneous growth points per tick for a
  paired/bilateral read, moderate generation cap.
- **cluster-frame** (`creature`, maxGeneration 13): a bulkier, more
  skeletal cluster-frame — no dominant axis (mixed prototiles) and more
  simultaneous growth points than spineling, run longer, for a denser,
  bulkier frame rather than a slender bilateral one.

## `GROWTH_TICK_MS`

Reuses `asteroids.js`'s own regrowth-cooldown shape exactly (a periodic
check, discrete step once idle time exceeds a fixed tick), per the
spec's explicit "reuse the pattern, don't invent a new one" instruction
— same value, not coincidentally.

## `growSeed`

Attempts to grow one seed by one step: picks open faces (up to the
species' `facesPerTick`) from the current frontier, and for each,
attaches a new tile using a real, valid (verified) extension option
that doesn't collide with anything already placed. Mutates
`seed.tiles`/`seed.generation`/`seed.lastGrowthAt` in place. Returns
true if anything was actually added (callers use this to decide whether
to push a sync update, mirroring `asteroids.js`'s own regrowth pattern).

**Real bug found and fixed 2026-08-13** (caught by a live SAT-based
geometry check, not by reading the code — centroid dedup alone looked
fine): the original version excluded a face's "current direction" as
if reusing it always self-overlapped, on the theory that it would
"recreate the same tile." That's only true for a tile's NEAR corner
face (origin = the tile's own origin — reusing the same third
direction there really does reproduce an identical tile at an
identical origin). For the FAR corner face (origin = the tile's origin
+ that same direction), reusing it instead produces a perfectly valid,
non-overlapping, ADJACENT tile continuing straight outward — excluding
it forced the algorithm onto whatever OTHER option existed for that
face pair, and verified numerically (2026-08-13) that the other option
folds back into the parent tile's own volume for fully half of all
face instances (60 of 120). Fixed by dropping the direction-exclusion
heuristic entirely and testing every real candidate against the tiles
actually placed so far with `tilesOverlap` (real SAT geometry) instead
— verified separately that every face instance has at least one
genuinely safe candidate this way, so growth still never hits a true
dead end.

`phenotypeOverride` (`{ facesPerTick, preferType, maxGeneration }`),
added 2026-08-13 for `RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` Stage 1:
lets a caller feed this function DIFFERENT parameters than the fixed
Wave-1 species tables (`SPECIES_BIAS`/`GROWTH_TEMPLATES`) — exactly the
doc's own "do not modify growth.js's rendering path, only feed it
different parameters" instruction. `growth.js` itself stays fully
unaware of genomes/organisms (`evolution.js` imports from here, never
the reverse, same one-directional-dependency shape as `build.js`/
`growth.js` already have) — it just accepts an already-computed,
already-coherence-bounded parameter set from whoever calls it. Omitting
it (the default, `null`) preserves every existing Wave-1 template's
exact prior behavior.

Wave 2 templates carry their own `bias` directly (per-template tuning,
per the spec); Wave 1 templates have no `bias` field and fall back to
the coarser per-category `SPECIES_BIAS` table exactly as before —
unchanged behavior for every already-verified template.

B5 Cultivation Mode: `growthParameters`, if the player set any at
planting time, layer ON TOP of the species' own bias rather than
replacing it — `densityBias` (0..1) scales `facesPerTick` (this is the
real "density vs. spread" L-system parameter the spec asks to expose:
how many open faces fill per tick); `directionalBias` (a 3D vector)
re-sorts the otherwise-equal candidate options below by alignment, so
growth still only ever picks among geometrically valid, non-overlapping
extensions — a player preference among what the real prototile rules
already allow, not a new growth rule.

Frontier: every open face across every existing tile, in a stable
order (tile insertion order, then the fixed `facesOfTile` order) —
deterministic, not `Math.random()`-ordered, so growth is reproducible
given the same seed history.

`placedVerts`: real placed geometry to test candidates against, grown
as tiles are accepted this tick — see this section's own note above for
why centroid-only dedup can't catch every overlap on its own.

Species-preferred type tried first, but every real option is a
candidate now (not just "not this tile's own direction") — whichever
one is actually geometrically clear wins.

If every option overlapped something already placed, this face just
doesn't grow this tick — verified this shouldn't happen for Wave 1's
own templates, but a real possibility for a denser future structure, so
it's a no-op, not a thrown error.

**`cachedBoundingRadius` (real bug found live 2026-08-14, profiling a
hung catch-up call):** `evolution.js`'s own `organismBoundingRadius`
recomputed a seed's full extent (every tile x every vertex) from
scratch on EVERY call, and gets called repeatedly inside O(n^2)
per-generation proximity checks (HGT, mate pairing, crowding) — a real,
avoidable cost multiplier. `placedVerts` here already holds every
current tile's own LOCAL vertices (`tileVertices`, not
`tileWorldVertices`) — and since `tileWorldVertices` = `tileVertices` +
`seed.origin`, distance from `seed.origin` to a WORLD vertex is exactly
distance from the ORIGIN (0,0,0) to the same LOCAL vertex
(`seed.origin` cancels out), so this is the real bounding radius,
computed for free off data this function already built, no extra
`tileVertices` calls needed. A generic, organism-agnostic cache on the
seed's own record — `growth.js` stays fully unaware of
organisms/genomes either way.

## `applyGrowth`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`-style periodic pass, called from
`render.js`'s `onChange()` same as `applyAsteroidRegeneration`/
`applyInventoryDecay` — iterates every planted seed and grows whichever
ones are due. Cheap no-op when nothing is due (mirrors every other
periodic pass in this project).

## `plantSeed`

Plants a new seed at a real world-space origin. The seed's own first
tile is placed immediately (a seed is never invisible, per the spec's
own section 9 success check) — an arbitrary valid acute triple, since
a freshly-planted seed has no "parent" face yet to inherit direction
choices from.

## `pruneTile`

B5 Cultivation Mode's Manual tier: "manually pruning part of an
already-grown structure should trigger the existing aperiodic
fill/reroute behavior the growth system already has, with no new rule
added." That behavior already exists for free — `growSeed` always
recomputes its frontier from `seed.tiles` fresh on every call, so
removing one tile here is the whole mechanic: the next growth tick
naturally finds the newly-exposed open faces on the removed tile's
former neighbors and continues from there. Refuses to prune the seed's
very first tile (index 0) — a seed with zero tiles isn't a smaller
plant, it's not a seed anymore.

## `tileWorldVertices`

World-space vertices for one tile, offset by its seed's own origin —
`render.js`'s own job to turn this into real geometry; `growth.js`
stays pure math/data, no THREE dependency (mirrors `lattice.js`'s own
separation of concerns).
