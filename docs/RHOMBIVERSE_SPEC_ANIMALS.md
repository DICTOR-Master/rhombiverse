# Rhombiverse — Spec Addendum: Land & Sea Creature Evolution (Animals)

Standalone addendum. Plugs into `RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md`'s species-agnostic organism framework (section 0 of that document) as two new species profiles — **land creatures** and **sea creatures** — rather than a parallel system. Everything not restated here (genome coherence bounds, deterministic catch-up simulation, isolation/blast-radius law, adaptive damping, the moderation hook) is inherited unchanged from that document. This addendum only specs what's genuinely new: mobility, sexual reproduction, a third trophic tier, habitat placement, and — cherry-picked specifically for animals — a rare grounded **habitat crossover** mechanism.

Governing decisions (confirmed with the project owner):

1. **Two distinct species profiles**, not one type with a habitat flag — land and sea creatures get their own trait sets and reproduction rules, the same clean-species-boundary pattern plants and amoeba already use.
2. **Extend the food web to a third trophic tier** — animals consume amoeba/plant biomass (herbivory), with an optional carnivore variant preying on other animals. Still a small, bounded web (2–3 links), not an open graph.
3. **Habitat crossover, cherry-picked** — grounded in real macroevolutionary transitions (Cetacea reverting from land to sea roughly 50 million years ago; early arachnid/myriapod lineages moving from sea to land in the other direction). A rare, slow, sustained-pressure mechanism, not a casual one — see section 5.

---

## 1. Species Profiles (per the framework's section 0)

### 1.1 Land Creatures

- **Habitat:** dry, non-Ice-9.9-permeated lattice cells (existing hydrosphere spec, `RHOMBIVERSE_SPEC_WATER_ICE.md`).
- **Additional genome traits** on top of the base five (`growthRate`, `branchingAngle`, `resourceEfficiency`, `maturitySize`, `mutationRate`):
  ```
  mobilityRange:  bounded,  // max cells traversed per resolution step
  huntBias:        0.0–1.0   // herbivore (0) .. carnivore (1) tendency, see section 4
  ```
- **Reproduction:** sexual, mate-pairing within `mobilityRange` (extends the plant proximity-pairing pattern from the evolution doc's section 2.3, generalized to a mobile population rather than a fixed radius).

### 1.2 Sea Creatures

- **Habitat:** Ice-9.9-liquid-permeated cells only (the same liquid-hydrosphere zone already spec'd around Blackstar-Glassite cores).
- **Same additional traits as land** (`mobilityRange`, `huntBias`) — the two profiles differ in habitat and default trait ranges, not in structure, which is what makes section 5's crossover mechanism representable at all (see there).
- **Reproduction:** sexual, mate-pairing within `mobilityRange`, same mechanism as land, scoped to liquid cells.

Both profiles' trait ranges are bounded per the evolution doc's section 1.1 (Geometric Coherence) — `mobilityRange` and `huntBias` included. No animal genome value may produce phenotype behavior the L-system/movement system doesn't already know how to render coherently.

---

## 2. Mobility (Abstracted, Not Live Physics)

Consistent with the evolution doc's deterministic catch-up model (no live tick): animal movement is **not** simulated as continuous physics. Each resolution step (per generation, section 4 of the evolution doc), a mobile organism's effective location is resolved as a bounded random walk within `mobilityRange` of its previous cell, constrained to its habitat type (dry cells for land, liquid cells for sea). This keeps movement cheap and deterministic-with-seed, exactly like every other mechanism in the framework — no new physics/pathfinding system, just a population-level position update alongside reproduction and selection.

**Blast radius:** movement is bounded by `mobilityRange` per step and by habitat-cell validity — an organism can never move somewhere its habitat trait doesn't support, and never further than its own trait allows in one resolution step.

---

## 3. Sexual Reproduction

Both land and sea creatures use mate-pairing: two mature, same-habitat, same-species individuals within `mobilityRange` of each other produce one offspring genome as a bounded blend of both parents' traits, then mutated — structurally identical to the plant pairing rule in the evolution doc's section 2, generalized from a fixed lattice radius to "however far this individual can currently reach." The evolution doc's sexual-selection mechanism (2.3) applies here too: pairing can bias toward a chosen trait (proposed: `huntBias` or `resourceEfficiency`, implementation's call) rather than picking uniformly among candidates in range.

---

## 4. Trophic Tier Extension

Adds one tier on top of the existing plant → amoeba predation link (evolution doc, section 5):

- **Herbivory:** land/sea creatures with low `huntBias` consume local `biomass` (the same resource amoeba already consume) to reproduce — a second consumer of the same resource pool, which naturally creates competitive pressure between amoeba and low-`huntBias` animals for the same biomass, without inventing a new resource type.
- **Carnivory (optional per-individual, not a separate species):** creatures with high `huntBias` instead prey on amoeba directly, or on other animals of lower `huntBias` within range — `huntBias` acts as a continuous dial rather than a hard herbivore/carnivore species split, which keeps the food web at "one more difference-equation link," not a second parallel system.
- Still a difference-equation update per generation, per Grounded Simplicity, same as the rest of section 5.

---

## 5. Habitat Crossover (Cherry-Picked, Grounded Macroevolutionary Transition)

Real, specifically-grounded biology, not an invented mechanic: real lineages have crossed the land/sea boundary in both directions — cetaceans (whales, dolphins) descend from land mammals that returned to the sea roughly 50 million years ago; conversely, early arachnid and myriapod lineages arose from marine ancestors that moved onto land. This is the single most dramatic kind of evolutionary change the real fossil record documents, so it earns a place here — but it must stay **rare and slow**, matching how rare it actually is in nature, not a routine toggle.

**Mechanism:**
- Applies only at a **habitat boundary** — land cells immediately adjacent to a permanently Ice-9.9-liquid-permeated zone (or the reverse), where individuals of one habitat type are regularly present at the edge of the other's territory.
- Requires **sustained, directional environmental pressure** across many consecutive generations — not a single environmental jolt (section 2.4 of the evolution doc covers single-jolt mutation bursts; this is different and deliberately stricter). A documented minimum number of consecutive generations under boundary pressure is required before any crossover becomes possible.
- Under that sustained pressure, boundary-adjacent individuals' offspring gradually mutate `mobilityRange` and habitat-relevant traits toward values valid in the *other* habitat, still bounded throughout by the coherence rule (section 1.1 of the evolution doc) — each intermediate generation remains a fully coherent, fully valid organism of its current species profile, never a broken in-between state.
- Once an offspring's mutated traits cross the defined threshold into the other habitat's valid range, it is reclassified as that other species profile — a land lineage's descendant becomes a sea creature, or vice versa. This is a data reclassification (which species profile the organism record uses), not a new object type.
- **Rare by construction:** the sustained-pressure requirement, the multi-generation minimum, and the coherence bounds together make this a genuinely uncommon event even under favorable conditions — matching the real fossil record, where this kind of transition happened only a handful of times across all of Earth's evolutionary history, not routinely.

**Blast radius:** boundary-cell-adjacent only, same planetoid, same as every other mechanism in this framework.

**Moderation:** because a crossover reclassification is a substantial phenotype/behavior change by definition, it always routes through the evolution doc's section 8 moderation hook (`pending` review), regardless of how small any single generation's mutation step was — this is the one case in the whole framework where an event is flagged for review by *kind*, not by measured novelty-jump size, because the event itself (species reclassification) is inherently significant.

---

## 6. Isolation & Adaptive Damping

Inherited directly from the evolution doc's sections 6–7, with no new blast-radius or damping rules needed:

- All animal state (position, genome, habitat classification) is planetoid-scoped, same as plants/amoeba.
- Mobility (section 2) and crossover (section 5) are both already bounded to adjacent/boundary cells — neither introduces a wider blast radius than the framework's existing single-planetoid law.
- Population-swing adaptive damping (evolution doc section 7) applies to animal populations exactly as written — a planetoid with volatile predator/prey swings (now including the new herbivory/carnivory links) widens its own carrying-capacity buffer over time, same algorithm, no animal-specific variant required.

---

## 7. Success Checks

- [ ] Land creatures never occupy Ice-9.9-liquid cells; sea creatures never occupy dry cells, except during an active, sustained crossover event (section 5).
- [ ] Animal movement between resolution steps stays within each individual's `mobilityRange` and its habitat's valid cells.
- [ ] Herbivorous animals (low `huntBias`) measurably compete with amoeba for local biomass — amoeba population responds to animal presence, not just plant output.
- [ ] Carnivorous animals (high `huntBias`) show measurable predation effects on amoeba and/or lower-`huntBias` animals.
- [ ] Under short-lived or non-boundary environmental pressure, no habitat crossover occurs — the mechanism only activates under the documented sustained, boundary-adjacent, multi-generation condition.
- [ ] Under a scripted, sustained boundary-pressure test case, a land lineage's descendants are observed gradually mutating toward sea-valid traits over many generations, eventually reclassifying — and the reverse case (sea to land) also succeeds under its own sustained pressure.
- [ ] Every generation produced during a crossover sequence remains a coherent, fully valid organism of its current profile (no broken intermediate state ever exists, per section 1.1's coherence guarantee).
- [ ] A crossover reclassification event is always routed to the moderation `pending` queue, regardless of mutation-step size.
- [ ] No new UI exists for direct breeding/culling/steering crossover — it remains purely a consequence of sustained environmental placement (e.g. a player permanently flooding a land boundary with Ice 9.9), per the evolution doc's environmental-influence-only governing decision.

---

## 8. Build Order

**Stage A — Species Profiles & Habitat Placement**
Define the land/sea trait extensions (section 1) and wire habitat validity (dry vs. liquid cells) into the existing `organisms` schema from the evolution doc. No mobility, reproduction, or trophic logic yet — verify an animal genome only ever spawns in its valid habitat.

**Stage B — Mobility**
Implement the bounded-random-walk position update (section 2) inside the existing per-generation resolution loop. Verify movement never exceeds `mobilityRange` or crosses into invalid habitat cells.

**Stage C — Sexual Reproduction**
Implement mate-pairing within `mobilityRange` (section 3), reusing the evolution doc's blend-and-mutate offspring function and sexual-selection bias. Verify against the evolution doc's existing plant-pairing tests, generalized to a moving population.

**Stage D — Trophic Extension**
Wire `huntBias`-driven herbivory/carnivory into the existing biomass/predation resolution step (section 4). Verify competitive pressure between amoeba and herbivorous animals, and predation effects from carnivorous ones.

**Stage E — Habitat Crossover**
Implement boundary-cell detection, the sustained-pressure/multi-generation gate, and the gradual trait-mutation-toward-reclassification sequence (section 5). Verify both directions (land→sea, sea→land) under scripted sustained-pressure test cases, and verify the mechanism stays dormant under ordinary/short-lived conditions.

**Stage F — Moderation & Verification**
Route crossover reclassification events into the existing `pending` queue unconditionally. Run the full success-check list (section 7) end-to-end.

---

## 9. Claude Code Prompt (copy-paste to start Stage A)

> Implement Stage A of `RHOMBIVERSE_SPEC_ANIMALS.md`, building on the existing `organisms` schema and species-profile framework from `RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` section 0. Add two new species profiles, `landCreature` and `seaCreature`, each extending the base genome with `mobilityRange` and `huntBias` traits (section 1 of this document), bounded per the coherence discipline already established in the evolution doc's section 1.1. Wire habitat validity so land creatures only spawn/exist on dry lattice cells and sea creatures only on Ice-9.9-liquid-permeated cells, reusing the existing hydrosphere classification from `RHOMBIVERSE_SPEC_WATER_ICE.md` rather than adding a new habitat system. No mobility, reproduction, trophic, or crossover logic yet — this stage is species-profile data model and habitat-placement validation only.

---

## 10. Open Design Questions (flagged, not blocking)

- Exact `mobilityRange` and `huntBias` ranges/defaults per profile.
- Which trait sexual selection biases toward for animals (section 3 proposes `huntBias` or `resourceEfficiency`; not fixed).
- Boundary-adjacency definition (how many cells from a habitat edge counts as "boundary") and the exact sustained-pressure generation-count minimum for crossover eligibility (section 5).
- The trait-value threshold that triggers reclassification from one species profile to the other.
- Whether carnivory ever targets other animals of the *same* `huntBias` tier (cannibalism-adjacent) or only strictly lower tiers — left open pending a design pass, not fixed by this document.
