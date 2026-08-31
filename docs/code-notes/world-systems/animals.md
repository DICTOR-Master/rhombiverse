# Notes: `src/world-systems/animals.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header (RHOMBIVERSE_SPEC_ANIMALS.md Stage A)

RHOMBIVERSE_SPEC_ANIMALS.md Stage A — Species Profiles & Habitat
Placement. A data layer ON TOP of evolution.js (which itself sits on
growth.js) — same one-directional-dependency shape as every prior layer
in this stack: animals.js imports evolution.js, evolution.js never
imports animals.js.

Real architectural choice, made deliberately before writing anything
else: section 1's `mobilityRange`/`huntBias` are stored as SIBLING
fields on the organism record (alongside `genome`, `seedId`,
`species`...), never nested inside `genome` itself. evolution.js's
`clampGenome`/`mutateGenome`/`blendGenomes`/`isShapeNoveltyJump` are all
hardcoded to the fixed 5-trait `GENOME_TRAIT_RANGES` table (by that
module's own design, not an oversight — see its own header) — putting
the two new traits inside `genome` would mean every one of those
already-tested Stage 1-9 functions silently STRIPS them on every
clamp/mutate/blend/plant call, since each one rebuilds the genome
object by iterating `GENOME_TRAIT_RANGES` only. Keeping them as
separate top-level fields instead means the base genome keeps flowing
through evolution.js's existing, unchanged, already-verified pipeline
exactly as it already does for amoeba/plant — this module owns
clamping/mutating/blending ONLY the two new fields, additively, per
this project's own "extend, never restructure" golden rule for
world-state schema.

## `ANIMAL_TRAIT_RANGES`

Section 1's own two additional traits. Real-valued world-space units
for `mobilityRange` (the same coordinate space as an organism's own
`seed.origin`, per growth.js's real, non-lattice quasicrystal
placement) — floor (1) mirrors `GENOME_TRAIT_RANGES.maturitySize`'s own
"not literally zero" floor; ceiling (15) sits at the same order of
magnitude as `RESOURCE_SEARCH_RADIUS` (10, evolution.js's own
"comfortably larger than a mature organism's own real bounding radius"
grounding), extended modestly so a genuinely mobile creature can roam
beyond its immediate resource neighborhood without ever crossing a
whole planetoid in one resolution step. Flagged as tunable, matching
this project's "first-guess, verify against real output" convention —
this doc's own section 10 leaves the exact range explicitly open, not
fixed here.

`huntBias`: 0 = herbivore .. 1 = carnivore, a continuous dial (section
4), not a species split.

## `clampAnimalTraits`

Same shape as evolution.js's own `clampGenome`: always returns a fully
valid, defaulted traits object, never throws, defaults missing/invalid
values to each range's own midpoint.

## `HABITAT_SEARCH_RADIUS`

How far to search for the nearest BUILT cell to classify a real-valued
position's habitat — reuses evolution.js's own `RESOURCE_SEARCH_RADIUS`
directly rather than a second, separately-tuned constant, same real
grounding ("comfortably larger than a mature organism's own bounding
radius").

## `isLiquidHabitatCell`

Sea creature habitat (section 1.2): "Ice-9.9-liquid-permeated cells
only... the same liquid-hydrosphere zone already spec'd around
Blackstar-Glassite cores" — deliberately narrow, matching
hydrosphere.js's own `hydrospherePermeated` flag exactly, NOT plain
surface `water` (a real, separate liquid population per that module's
own `material:'water'` + `hydrospherePermeated` distinction — see
CLAUDE.md's own "two different water populations, not a naming
coincidence" note on the oceanic planetoid recipes). A future pass
could widen this to cover surface oceans too; not done here, per this
spec's own literal wording — flagged as a real, deliberate scope
choice, not an oversight.

## `isDryHabitatCell`

Land creature habitat (section 1.1): "dry, non-Ice-9.9-permeated
cells" — also excludes plain surface water/ocean cells (a lake is not
dry either), a conservative real-world reading that goes slightly
beyond the spec's own literal wording without contradicting it.

## `isValidHabitat`

The real, hard placement gate section 1 describes: classifies a
real-valued world-space position by whichever BUILT FCC cell is
nearest to it within `HABITAT_SEARCH_RADIUS`. No cell built nearby at
all defaults to dry/land — "wet" must be positively established by a
real nearby permeated cell, never assumed. Non-animal species are
unaffected (habitat validity is an animals-only concept).

## `plantAnimal`

Plants a new animal organism. The base genome (the standard 5-trait
shape) is handled ENTIRELY by evolution.js's own `plantOrganism`,
completely unchanged — `growOrganism`/`isMature`/`genomeToPhenotype`
all keep working on an animal organism with zero animals-specific
code, since they only ever read
`genome.growthRate`/`branchingAngle`/`maturitySize`, never the species
string itself. `mobilityRange`/`huntBias` are attached as sibling
fields immediately after. Rejects a position that fails its own
species' habitat validity outright — section 7's own first success
check ("land creatures never occupy Ice-9.9-liquid cells; sea creatures
never occupy dry cells") is enforced here at the one real entry point,
not hoped for downstream.

## `isAnimal`

Exported for Stage B+ (mobility/reproduction/trophic) and the test
suite — confirms an organism record actually carries both the base
genome (evolution.js's own shape, `GENOME_TRAIT_RANGES`) and the two
animal-specific fields, all independently bounded.

## Stage B — Mobility (Abstracted, Not Live Physics)

Section 2: NOT continuous physics — each resolution step, a mobile
organism's effective location is resolved as a single bounded random
walk within its own genome's `mobilityRange` of its previous position,
constrained to its habitat type. Consistent with the whole framework's
deterministic-catch-up model (evolution.js's own section 4): this is a
population-level position update alongside reproduction/selection, not
a new physics/pathfinding system.

### `MAX_MOVE_ATTEMPTS`

Real, grounded reasoning for the bounded-retry shape: section 2's own
blast-radius sentence is a HARD constraint ("an organism can never move
somewhere its habitat trait doesn't support") — a single random draw
landing in invalid habitat (e.g. a land creature's walk stepping over
open water) must never actually move the organism there. Retrying a
bounded number of fresh random directions before giving up and staying
put is the simplest mechanism that still guarantees the hard constraint
holds on every call, without ever searching for the "nearest valid"
spot (which would smuggle in pathfinding, a deliberately different,
heavier system section 2 explicitly says this isn't). `MAX_MOVE_ATTEMPTS=8`
is a first-guess, flagged as tunable, not derived from a specific
figure — generous enough that an organism deep in valid habitat (the
common case) essentially always finds a valid direction on its first
try, small enough to stay cheap even for an organism sitting right at a
habitat boundary.

### `randomCandidatePosition`

A single candidate point: a uniformly-random direction (spherical) at a
uniformly-random distance up to `mobilityRange` — "within
`mobilityRange` of its previous cell," per section 2's own wording, not
always AT the full range.

### `attemptMove`

The real per-organism mechanism, exported for direct/manual use (Stage
B's own scope, mirroring evolution.js's Stage 2 "trigger manually to
verify each channel independently before wiring into automatic
resolution") and as the function `movementStepHook` below wraps for the
automatic catch-up loop. Non-animal organisms are always a no-op (this
module is the ONLY thing that knows what an "animal" is). Returns
whether the organism actually moved (false if it stayed put, either
because it isn't an animal or because every attempt landed in invalid
habitat). Inline note kept: "no valid direction found this step —
stays put, never placed somewhere invalid."

### `movementStepHook`

The real `onGenerationStep` hook (evolution.js's own Stage B extension
point, added specifically for this) — passed straight to
`resolveCatchUpForAllPlanetoids` by render.js's own wiring. Matches that
hook's exact signature; only the `world`/`organismId`/`rng` parameters
are actually needed here (`generationIndex`/`simulatedNow` are for
other hooks' potential use, not this one).

## Stage C — Sexual Reproduction

### `isWithinMobilityRange`

Section 3: "two mature, same-habitat, same-species individuals within
mobilityRange of each other" — deliberately the PARENT's own
`mobilityRange` as the search radius (the organism whose reproduction
is being resolved is the one "reaching out" this far), not
evolution.js's own `isInPairingRange` (a multiple of combined bounding
radius — the right grounding for a sessile plant, not a mobile creature
whose real reach is its own heritable `mobilityRange` trait).

### `blendAnimalTraits`

Bounded blend of two parents' animal traits — same plain per-trait
average shape as evolution.js's own `blendGenomes`, scoped to
`ANIMAL_TRAIT_RANGES` instead of the base genome table.

### `mutateAnimalTraits`

Mutates animal traits using the SAME per-trait mutation shape as
evolution.js's own `mutateGenome` (independent per-trait roll against
`mutationRate`, delta magnitude `MUTATION_DELTA_FRACTION` of the
trait's own range) — reuses that exact constant rather than a second,
separately-tuned one. `mutationRate` is deliberately a required
parameter, not a second independently-tracked rate: the offspring's own
(already-mutated) base `genome.mutationRate` is the one heritable
concept governing volatility across the WHOLE genome, base traits and
animal-specific traits alike — not two unrelated dials.

### `animalOffspringOrigin`

Offspring placement for animals: unlike evolution.js's own private
`offspringPlacement` (used for amoeba/plant, which have no habitat
constraint), this MUST land somewhere the offspring's own species can
actually live. Tries a bounded number of random points near the
midpoint of both parents (their real average position, not just the
initiating parent's) before falling back to that midpoint outright —
"never invisible" (growth.js's own established convention) wins even in
the rare case no nearby valid spot is found, matching this project's
own precedent of a graceful, honestly-imperfect fallback over a hard
failure.

### `MATE_PREFERENCE_TRAIT`

Sexual selection bias (evolution doc section 2.3): `huntBias`, this
implementation's own choice among the spec's two proposed options
(`huntBias` or `resourceEfficiency`, "not fixed" per section 10's own
open question) — `huntBias` is the more legible, animals-specific trait
to actually observe pairing bias toward, matching the spec's own
reasoning for why plants biased toward `resourceEfficiency` ("the most
legible/consequential trait").

### `traitValue` / `selectMateByTrait`

Real bug caught by a live statistical test before trusting this (a
scripted 300-trial run showed ~51/49, no real bias at all):
evolution.js's own `selectMate` hardcodes
`organism.genome[preferredTrait]` — correct for plants' own
`resourceEfficiency` (a base-genome trait), but `huntBias` lives as a
SIBLING field on the organism record (see this module's own header on
why), so that lookup silently read `undefined` for every animal
candidate, `Math.max(0.01, undefined)` produced NaN weights for all of
them, and the weighted pick degraded to an effectively broken,
near-uniform selection. Fixed with this module's own trait-aware
weighted pick — otherwise byte-identical to evolution.js's own
`selectMate` (same fitness-proportionate weighting, same 0.01 floor so
no candidate is ever fully excluded) — rather than modifying
evolution.js's own `selectMate`, which is correct exactly as written
for its own (base-genome-only) callers.

### `reproduceAnimal`

The real per-organism mechanism (Stage C's own "trigger manually to
verify" scope, mirroring evolution.js's own Stage 2 build order) —
finds a mature, same-species mate within the parent's own
`mobilityRange`, blends+mutates BOTH the base genome (entirely via
evolution.js's own `reproduceSexual`, unmodified) and the
animal-specific traits (this module's own
`blendAnimalTraits`/`mutateAnimalTraits`), and plants the result at a
real, habitat-valid position. Returns null if no eligible mate is in
range this step (a real, expected outcome — not every resolution step
finds a mate, section 3 doesn't promise one will). `mutationRateOverride`
(Stage 4's punctuated-equilibrium jolt boost) threads through to BOTH
the base genome's own mutation (via `reproduceSexual`, unmodified) and
this module's own animal-trait mutation — one shared override,
composing with punctuated equilibrium exactly the way evolution.js's
own `reproduceSexual`/`reproduceAsexual` already do, not a second
untouched pathway.

Inline note kept in code: read `parentAtBoundary` BEFORE reproduction
mutates any state — this generation's crossover eligibility is about
the PARENT's own standing position/pressure at the moment of conceiving
this offspring.

### `reproduceFn`

The real `reproduceFn` override (evolution.js's own Stage C extension
point, added specifically for this) — matches `reproduce`'s exact call
shape. `landCreature`/`seaCreature` route through `reproduceAnimal`
above; every other species (amoeba, plant) delegates straight back to
evolution.js's own unmodified `reproduce`, so this override is a pure
superset, never a behavior change for non-animal species.

## Stage D — Trophic Tier Extension (Herbivory + Carnivory)

Section 4: `huntBias` is a CONTINUOUS dial, not a herbivore/carnivore
species split — "one more difference-equation link," reusing the exact
same biomass resource pool evolution.js's Stage 5 already created for
amoeba (herbivory: a second consumer of the same pool, which naturally
creates real competitive pressure with amoeba without inventing a new
resource type), plus a real, direct predation event for the carnivory
half (a genuine per-generation prey-removal, the most honest/grounded
representation of "eats another organism" — simpler and more legible
than a purely probabilistic nudge, and it's what makes the effect on
prey populations actually MEASURABLE per section 7's own success check,
not just theoretically present).

### `PREY_ABUNDANT_COUNT`

Same "count within range, normalize to [0,1] at an abundant threshold"
shape evolution.js's own `RESOURCE_ABUNDANT_COUNT`/`BIOMASS_ABUNDANT_OUTPUT`
already use — reused here for prey, not a new normalization scheme.

### `PREDATION_PROBABILITY`

A hunt only actually succeeds probabilistically per generation (real
predators don't catch prey on every encounter) — first-guess, flagged
as tunable per this project's established convention for exactly this
class of constant.

### `isPreyOf`

True prey relationship (section 4): amoeba are always valid prey (any
`huntBias > 0` carnivore can target them, matching the spec's own "prey
on amoeba directly, or on other animals of lower huntBias" — amoeba
have no `huntBias` of their own, treated as `huntBias` 0 for this
comparison); an animal is prey only to another animal with a STRICTLY
higher `huntBias`, so two equal-`huntBias` animals never prey on each
other.

### `findPreyWithinRange`

Every mature, in-`mobilityRange` organism from `candidateIds` (Stage
6's own planetoid-scoped population, passed through
`onGenerationStep`'s own extension — see evolution.js's own comment on
why — rather than a global `world.getOrganisms()` scan) that counts as
this predator's prey.

### `localSameSpeciesCountWithinMobilityRange`

Same-species crowding count, but scoped to the organism's OWN
`mobilityRange` (its real reach) rather than evolution.js's own
bounding-radius-multiplier neighborhood — same reasoning as
`reproduceAnimal`'s own `isWithinMobilityRange` (a mobile creature's
real "local" is defined by how far it can move, not how big it
physically is).

## Stage F — Real Amoeba/Herbivore Competitive Pressure

Real gap found while working through section 7's own success-check
list end-to-end, not assumed away: section 4's own explicit claim is
that herbivorous animals are "a second consumer of the same resource
pool, which naturally creates competitive pressure between amoeba and
low-huntBias animals for the same biomass." But evolution.js's own
`localBiomassAvailability` is a pure SUPPLY-side calculation (nearby
mature plant output) — it has no notion of how many consumers are
drawing on that same supply, so an amoeba's own survival odds were
completely unaffected by nearby herbivore animals, no matter how many
existed. This closes that gap for real: each nearby mature,
herbivore-leaning animal (low `huntBias`) reduces the EFFECTIVE biomass
an amoeba itself reads by a real, bounded fraction — more herbivorous
(lower `huntBias`) means more direct competition for the same plant
output; a pure/near-carnivore (`huntBias` near 1, mostly eating other
animals instead) barely competes for biomass at all.

### `HERBIVORE_COMPETITION_PENALTY_PER_PRESSURE` / `HERBIVORE_COMPETITION_HUNT_BIAS_CEILING`

`HERBIVORE_COMPETITION_HUNT_BIAS_CEILING`: above this `huntBias`, an
animal is considered to be drawing so little on the shared biomass pool
that it doesn't meaningfully compete with amoeba for it at all —
consistent with `huntBias` already being a continuous dial (section 4),
this just bounds how far the competition signal itself extends, not a
new hard species split.

### `nearbyHerbivoreCompetitionFactor`

Inline note kept: "more herbivorous = more real competitive draw on the
same pool" (the `pressure += 1 - huntBias` line).

### `computeAmoebaSurvivalWithCompetition`

Recomposes evolution.js's own real amoeba formula (scarcity x crowding
— amoeba get no symbiosis factor, per `computeSurvivalProbability`'s
own species check, so this is the complete formula, not a partial
approximation) using the SAME building blocks that function uses
internally (`localMatureSameSpeciesCount`, `CROWDING_PENALTY_PER_EXCESS`),
substituting a competition-adjusted biomass availability in place of
the raw supply-side figure. Reuses, does not reinvent, the underlying
formula shape.

### `computeAnimalSurvivalProbability`

The real `survivalProbabilityFn` override (evolution.js's own Stage D
extension point) — `huntBias` blends two availability signals into one
(0 = pure herbivore reading local biomass exactly like amoeba already
does, 1 = pure carnivore reading local prey density, continuous
in-between per section 4's own "dial, not a split"), then reuses the
SAME scarcity/crowding formula SHAPE evolution.js's own
`computeSurvivalProbability` already established (resourceEfficiency
matters more under scarcity, crowding penalizes uniformly above
threshold) rather than inventing a new one. Delegates straight back to
evolution.js's own unmodified `computeSurvivalProbability` for `'plant'`
and anything else — a pure superset, same pattern as `reproduceFn`.
`'amoeba'` is the one other species this override touches, per Stage
F's own real competitive-pressure fix above.

### `attemptPredation`

The real, direct predation event: a mature carnivore-leaning animal
(`huntBias` alone gates whether it hunts at all THIS generation via the
probability roll below — there is no separate hard species/threshold
split, matching section 4's own "continuous dial" framing: a `huntBias`
of, say, 0.2 still occasionally hunts, just proportionally rarely,
since `huntBias` also feeds directly into its own survival-probability
blend above) with real prey in range has a real, bounded chance per
generation of removing ONE prey organism outright — section 4's own
carnivory mechanism, made concrete. Never removes more than one prey
per predator per generation (bounded, not a massacre). Inline note
kept: "higher huntBias hunts more reliably, still never certain" (the
probability-roll early-return line).

### `animalGenerationStepHook`

The real combined per-generation hook, wired into render.js's own
`resolveEvolution` as the actual `onGenerationStep` — resolves
predation BEFORE movement (hunt from the current position, then move),
matching this module's own established "hook order reflects the
generation's real event order" convention from Stage B.

## Stage E — Habitat Crossover

Section 5's own real open design questions (section 10: boundary-
adjacency definition, sustained-pressure generation minimum, and the
trait-value reclassification threshold are all explicitly "not fixed
here") — real, grounded decisions made below rather than left
unimplemented:

- The drift happens across GENERATIONS via inheritance, not within one
  living individual's own lifetime — matches the spec's own literal
  wording ("boundary-adjacent individuals' OFFSPRING gradually
  mutate... once an OFFSPRING's mutated traits cross the threshold, IT
  is reclassified"), and composes naturally with `reproduceAnimal`
  (already the one place a new organism record is created) rather than
  needing a second, separate per-tick mutation pass on living adults.
  This is also what makes "never a single environmental jolt" true BY
  CONSTRUCTION: reclassification can only ever advance through a REAL
  successful reproduction event (itself already gated on maturity, mate
  availability, and a genome x conditions survival-probability roll),
  so a lineage genuinely has to keep succeeding at reproducing while
  staying at the boundary, generation after generation — not one
  lucky/unlucky tick.
- "Boundary" = currently in genuinely valid habitat for the organism's
  OWN species (never mid-invalid), AND the OPPOSITE habitat type is
  reachable within its own real `mobilityRange` — "regularly present at
  the edge of the other's territory," per the spec's own wording,
  grounded in the same real reach concept mobility/reproduction/predation
  already use, not a new radius.
- `mobilityRange` is the one real, already-heritable trait genuinely
  relevant to habitat tolerance (it IS how far an organism can reach
  into unfamiliar terrain) — sustained boundary pressure nudges it
  DIRECTIONALLY toward its own range ceiling each qualifying generation
  (on top of, not instead of, ordinary blend+mutation), and crossing
  `CROSSOVER_MOBILITY_THRESHOLD_FRACTION` of that range is the real
  "trait-value threshold" section 5 asks for.

### `isAtHabitatBoundary`

Inline note kept: "never mid-invalid — section 5's own guarantee" (the
`isValidHabitat` early-return line).

### `nearestOppositeHabitatCellPosition`

Real bug caught by direct execution before trusting this stage: the
FIRST version of `performCrossoverReclassification` (below) picked a
candidate position by uniformly sampling within the WHOLE
`mobilityRange` sphere around the organism's current position, the same
technique `attemptMove`/`animalOffspringOrigin` already use successfully
elsewhere. That works fine for THOSE (any locally-valid-habitat point
is an acceptable outcome) but fails here specifically: the region where
the OPPOSITE habitat type is actually the nearest cell is a small lens
near the one real boundary cell, and shrinks (as a fraction of the full
sampling sphere) precisely as `mobilityRange` grows large under
sustained pressure — exactly the condition crossover eligibility
requires. A scripted 40-generation run confirmed this concretely:
`mobilityRange` grew past 11, and 8 random attempts within an 11-unit
sphere essentially never landed in the correct few-unit lens near the
actual boundary cell, so it kept silently falling back to the
PRE-crossover (now genuinely invalid) origin. Fixed by finding the real
nearest opposite-type cell first, then sampling a small jitter radius
AROUND that specific cell instead of the organism's own position —
guarantees the target cell is the region's own nearest neighbor, so the
search reliably succeeds regardless of how large `mobilityRange` has
grown.

### `performCrossoverReclassification`

The real reclassification event: flips the species on BOTH the
organism record (dispatch/behavior) and the underlying seed's own
namespaced species field (evolution.js's own
`ORGANISM_SEED_SPECIES_PREFIX` convention — keeps render.js's
`speciesColor` tinting correct after crossover too), repositions into a
real, freshly-verified valid position for the NEW species (bounded
retry, same "never invisible, never placed in invalid habitat" shape as
`animalOffspringOrigin`/`attemptMove` — falling back to the
pre-crossover origin only in the rare case no nearby valid spot is
found), resets the boundary-pressure counter (a new lineage phase
starts clean), and — per section 5's own explicit, unconditional
instruction — ALWAYS routes to the pending moderation queue regardless
of how small this specific mutation step was, since a species
reclassification is significant BY KIND, not by measured novelty
magnitude (overrides whatever `isShapeNoveltyJump` already decided for
the ordinary base-genome mutation this same generation). Inline note
kept on the jitter-sampling line: small jitter radius AROUND the real
boundary cell (not the organism's own possibly-distant position) — see
this note for why sampling around the organism itself fails once
`mobilityRange` has grown large.
