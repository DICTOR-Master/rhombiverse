# Rhombiverse — Spec Addendum: Evolutionary & Ecosystem Development

Standalone addendum. Extends the Penrose/RT Growth Layer (`RHOMBIVERSE_PLAN.md` Phase 6, now implemented — plant life and amoeba are live in the select menus with preselected compatible planetoids). This document does not re-spec growth itself; it specs what happens *across generations* of already-growable organisms. Complies with `RHOMBIVERSE_PRINCIPLES.md` — Grounded Simplicity, Isolation, Adaptive Damping are called out explicitly below, per the binding rule in that document.

Governing decisions (confirmed with the project owner before writing this plan):

1. **True heritable evolution** — organisms carry a small numeric genome; offspring inherit and mutate it; environment applies real selection pressure. Not cosmetic per-individual randomness (that already exists) — actual descent-with-modification.
2. **Environmental influence only** — players shape conditions (resources, crowding, placement, proximity between species); no direct breeding/culling UI. Consistent with "plant a seed and something magical grows all by itself."
3. **Deterministic catch-up simulation** — no continuous background tick. Generations are resolved on load, from a seeded deterministic function, the same pattern already used for unattended crystal growth (Phase 5.5).
4. **Basic trophic interaction** — amoeba consume a resource plants produce. A real, minimal food web, not two independent random-walks.
5. **Geometric coherence is a hard constraint, not an aesthetic nice-to-have** — evolution must never be allowed to drift phenotypes into visually degenerate or chaotic shapes. Beauty is load-bearing to the whole project's identity ("the geometry evolution already reaches for in flowers and shells," per the existing vision statement) and is enforced structurally, not left to hope. See section 1.1.

**Cherry-picked evolutionary mechanisms**, added deliberately on top of the baseline (mutation + selection) rather than building every real mechanism that exists — picking some and leaving others out is the point:

6. **Horizontal gene transfer** (amoeba-specific) — section 2.1.
7. **Genetic drift** (small-population stochasticity) — section 2.2.
8. **Sexual selection** (plant mate preference) — section 2.3.
9. **Punctuated equilibrium** (environmental-jolt-triggered mutation bursts) — section 2.4.
10. **Symbiosis / coevolution** (plant–amoeba mutualism) — section 5.
11. **Convergent evolution** — not a built mechanic, an expected *observed* outcome used to verify the rest is working correctly — section 5.1.

Explicitly **not** included in this pass: founder effect, kin selection/altruism. Both were considered and set aside to keep the build lean — neither is precluded from a later addition; this is a considered subset, not an oversight.

---

## 1. Genome & Phenotype (Grounded Simplicity)

Every organism instance gets a small, fixed-length genome — a handful of bounded numeric traits, not an open-ended gene system. Traits map directly onto parameters the existing growth L-system already exposes, so this is a new *data layer* on top of `growth.js`, not a new growth engine.

Proposed trait set (tune exact ranges during implementation, not fixed by this doc):

```
genome = {
  growthRate:        0.0–1.0,   // speed of substitution steps
  branchingAngle:     bounded,   // five-fold L-system parameter
  resourceEfficiency: 0.0–1.0,   // biomass/water consumed per growth step
  maturitySize:        bounded,   // substitution depth required to reproduce
  mutationRate:        0.0–1.0    // this organism's own offspring-mutation volatility
}
```

`mutationRate` being itself a heritable trait is deliberate and real-biology-grounded — real mutation rates are themselves under selection (too high is destabilizing, too low prevents adaptation), which gives Adaptive Damping (section 7) something genuine to act on rather than a hand-tuned global constant. Punctuated equilibrium (section 2.4) temporarily overrides this per-organism trait at the population level during a detected environmental jolt — the two are designed to compose, not conflict.

Phenotype = genome run through the existing substitution/L-system rules. No new rendering path — the growth layer already turns rule parameters into shape; evolution just changes which parameters a given seed starts with.

### 1.1 Geometric Coherence Constraint (Beauty by Construction)

The project's whole premise is that everything — built or grown — traces back to real crystallography and real mathematics, and stays beautiful *because* it's true to that geometry rather than arbitrary (`RHOMBIVERSE_PLAN.md` §6 vision statement; `RHOMBIVERSE_PRINCIPLES.md` §0 Grounded Simplicity). Evolution is the one system that runs unattended across many generations with no player curating each result — so it's also the system most able to quietly wander away from that premise if left unconstrained. This section makes beauty a structural guarantee, not a hope.

**Mechanism, not judgment call:** genome trait ranges (section 1) and the mutation function (section 2) are bounded specifically at the values that keep the resulting L-system output within the rhombic triacontahedron's five-fold quasicrystalline substitution rules — the same rules that already guarantee a *single* planted seed grows into something coherent (per Phase 6). A mutated trait can move the *degree* of branching, size, or angle, but the bounds themselves are chosen so no reachable genome value produces a substitution rule the geometry doesn't actually support. In other words: coherence is enforced by never letting the genome parameterize outside what real quasicrystalline growth allows, not by inspecting output shapes after the fact and rejecting ugly ones.

**Why this is Grounded Simplicity, not a new mechanic:** the growth layer's L-system *already* only knows how to produce five-fold-coherent shapes — that constraint already exists in `growth.js`. This section's entire job is to make sure the genome-to-phenotype mapping (section 1) and every mutation/crossover/transfer operation (sections 2–2.4) only ever hands that existing system values it already knows how to render coherently. No new geometry code, no new beauty-scoring system — just discipline about which parameter ranges the evolutionary layer is allowed to reach into.

**Relationship to section 8 (Moderation):** section 8's shape-novelty threshold catches *large, sudden* jumps for content-moderation reasons (safety/UGC). This section is a different, earlier gate — it prevents *degenerate* geometry (shapes that break the five-fold coherence rule entirely) from being reachable at all, regardless of how large or small the mutation step was. A shape can be novel-but-coherent (passes this section, may still get routed to moderation for novelty) or attempted-but-blocked (never reachable, because the bounds in this section don't allow it) — these are two independent checks, not one.

---

## 2. Reproduction & Inheritance

- **Amoeba** (fast-turnover model organism): asexual budding. On reaching `maturitySize` with sufficient local resource, spawns one offspring in an adjacent valid cell with a mutated copy of the parent genome.
- **Plants** (slow-turnover): proximity-based pairing — two mature plants within a defined lattice radius produce one offspring genome as a bounded blend of both parents' traits, then mutated (see section 2.3 for how the *choice* of pairing partner works). Falls back to asexual budding if no second mature plant is in range (avoids a hard reproduction-blocking edge case).
- **Mutation function:** each trait independently has `mutationRate` chance to shift by a small bounded delta, clamped to that trait's valid range — and that valid range is itself set per section 1.1, so no mutation, however unlucky, can ever produce an incoherent phenotype. Simple, auditable, no exotic operators (crossover-point schemes, etc.) — per Grounded Simplicity, this is the simplest mechanism that still produces real heritable variation.

### 2.1 Horizontal Gene Transfer (Amoeba-Specific)

Real, grounded biology: protists and microbes acquire genetic material laterally, outside parent-to-offspring reproduction — unlike plants (reproduce sexually/asexually only), this gives amoeba a second, distinct inheritance channel, and is part of why amoeba make a good fast-evolution model organism versus slower, single-channel plants.

- On a resolution step (section 4), two mature amoeba occupying **adjacent** cells have a small, fixed probability of a **single-trait transfer**: one randomly chosen trait value copies from one to the other (donor unaffected, per real HGT — copying, not exchange).
- Deliberately narrow: one trait, one direction, one step — not whole-genome swapping.
- Not gated by the selection function (section 3) — happens regardless of fitness, same as real lateral transfer. Selection still acts afterward on whatever genome each amoeba now carries.
- Transferred values are already coherence-bounded (section 1.1) on the donor side, so the copy is automatically valid on the recipient side too — no extra check needed here.
- **Blast radius:** adjacent-cell-only, same generation-step — cannot cascade further than one hop per resolution step.

### 2.2 Genetic Drift (Small-Population Stochasticity)

Real, grounded biology: in small populations, trait frequencies shift by pure chance, independent of fitness — the smaller the population, the stronger the effect (this is standard population-genetics theory, not an invented mechanic).

- When a planetoid's local population of a species is below a defined `driftThreshold`, the selection function (section 3) is **partially bypassed**: a fraction of reproduction/survival outcomes are resolved by uniform random chance rather than fitness-weighted probability, scaled by how far below threshold the population is.
- Above `driftThreshold`, selection operates normally (full fitness-weighting, no drift bypass) — real populations large enough for selection to reliably outweigh chance.
- This directly explains, in-world, why a freshly founder-planted planetoid (very few individuals) can wander genetically for a few generations before selection "takes hold" — a real and desirable emergent story, not a bug to hide.
- Chance-driven outcomes still only sample within the section 1.1 coherence bounds — drift changes *which* coherent value wins, never opens the door to an incoherent one.

### 2.3 Sexual Selection (Plant Mate Preference)

Real, grounded biology, scoped narrowly to plants' existing proximity-pairing mechanic (section 2): instead of pairing with *any* mature plant in range, add a mate-preference bias toward a specific trait (proposed: `resourceEfficiency`, since it's the most legible/consequential trait — implementation's call, not fixed here).

- When multiple mature plants are in pairing range, the preference function weights selection probability toward higher values of the chosen trait, rather than picking uniformly at random among candidates.
- This is a *bias*, not a hard filter — lower-trait candidates remain reachable, just less likely, keeping genetic diversity from collapsing to a single dominant value (which would undercut section 2.2's drift and section 5.1's convergent-evolution check).
- Scoped to plants only (matches the existing proximity-pairing mechanic); amoeba's asexual budding has no analogous mate-choice step.

### 2.4 Punctuated Equilibrium (Environmental-Jolt-Triggered Mutation Bursts)

Real, grounded biology: the fossil record shows long periods of genetic stasis punctuated by rapid change after major environmental shifts, rather than constant gradual drift — this ties mutation intensity to *detected environmental change* instead of leaving `mutationRate` a purely per-organism, always-on constant.

- The catch-up engine (section 4) already evaluates local conditions each resolution step. Define an `environmentalJolt` event: a resource-availability or crowding-band change exceeding a documented threshold between consecutive resolution steps (e.g. Ice 9.9 permeation newly introduced/removed near a population).
- On a detected jolt, the *effective* population-wide mutation rate is temporarily boosted (bounded multiplier, decaying back to each organism's own heritable `mutationRate` over a fixed number of subsequent generations) — stasis is simply the default, unboosted state.
- This composes with, rather than replaces, the heritable `mutationRate` trait (section 1): the jolt boost is a temporary population-wide multiplier on top of whatever each organism's own trait already is.
- A boosted mutation rate still only ever samples within section 1.1's coherence bounds — a jolt can accelerate *how fast* a population explores the space of beautiful, coherent shapes, never push it outside that space. This is what keeps a dramatic, generations-spanning burst of change from ever reading as chaos rather than a still-recognizably-grown transformation.

---

## 3. Environmental Selection Pressure

This is what makes it evolution rather than random drift: traits must actually affect survival/reproduction odds, tied to existing systems rather than invented ones.

- **Resource scarcity** (existing Ice 9.9 / water permeation level, `RHOMBIVERSE_SPEC_WATER_ICE.md`) — higher `resourceEfficiency` increases survival odds when local water/biomass is scarce, decreases the reproduction threshold cost when abundant.
- **Crowding** — local population density above a threshold reduces survival odds uniformly (space/light/resource competition), independent of genome — this is the pressure that keeps population bounded and gives efficient genomes room to actually outcompete inefficient ones.
- **Planetoid conditions** — the preselected "suitable" planetoids already encode a starting resource/temperature profile; that profile is what different genomes are being selected against, so no new per-planetoid property is required beyond what placement already implies.
- **Below `driftThreshold` (section 2.2):** this fitness-weighting is partially bypassed in favor of chance, as described above.

Selection is applied only at the resolution step (section 4), never as a per-frame calculation — keeps it cheap and keeps the mechanism auditable as one clear function: `genome × local conditions → survival/reproduction probability`.

---

## 4. Deterministic Catch-Up Simulation

No live server tick. Each organism-populated planetoid stores `lastSimulated: timestamp` and a seeded RNG state in world-state (new `organisms` key, parallel to the existing `seeds` key from Phase 6).

```
on planetoid_load(planetoid):
    elapsed = now() - planetoid.lastSimulated
    generations = min(floor(elapsed / generationInterval), MAX_CATCHUP_GENERATIONS)
    rng = seededRNG(planetoid.rngState)
    for g in 1..generations:
        detect_environmental_jolt(planetoid)   # section 2.4
        resolve_reproduction(planetoid, rng)   # sections 2, 2.3
        resolve_gene_transfer(planetoid, rng)  # section 2.1
        resolve_selection(planetoid, rng)      # sections 3, 2.2 (drift)
        resolve_trophic_step(planetoid, rng)   # section 5
    planetoid.rngState = rng.state
    planetoid.lastSimulated = now()
```

- `MAX_CATCHUP_GENERATIONS` is a required bound — this is the Isolation/Adaptive-Damping discipline applied to compute cost itself: a planetoid left untouched for a year must never trigger a year's worth of simulation in one page load. Excess elapsed time beyond the cap is simply not simulated (the planetoid "waited," it didn't fast-forward unboundedly).
- Deterministic + seeded means two clients loading the same planetoid state get the same outcome — no server authority required beyond storing/serving the world-state JSON, consistent with the existing "world is data" golden rule.

---

## 5. Trophic Coupling (Ecosystem, Including Symbiosis)

Minimal food web, deliberately not a complex web — one predation-style link plus one mutualistic link, not an open-ended interaction graph:

- **Predation-style link:** plants produce a `biomass` resource as a byproduct of growth (draws from water/Ice-9.9 permeation, per the existing Verdant Core feedstock hook in `RHOMBIVERSE_SPEC_WATER_ICE.md`). Amoeba consume local `biomass` to reproduce; insufficient biomass lowers amoeba survival/reproduction odds directly (section 3's mechanism, same function, different resource).
- **Symbiotic/coevolutionary link:** amoeba presence within a defined radius of a plant modestly **boosts** that plant's `growthRate`-effective output (real-grounded — many real microbial/protist populations aerate or fertilize soil around plant roots; simplified to one directional boost rather than a bidirectional exchange). Kept one-directional and small-magnitude so it doesn't cancel the predation link's stabilizing oscillation.
- Both links are difference-equation updates per generation, not continuous calculus — a simplified, grounded version of real predator-prey (Lotka–Volterra) and mutualistic coupling, per Grounded Simplicity's "simplest version that's still true."

Expected emergent behavior: biomass and amoeba populations oscillate out of phase from predation, while the symbiotic link should show plant density trending modestly higher in areas with sustained amoeba presence — both are Rhythm and Harmony (Core Principles §6) produced naturally by the coupling, not scripted.

### 5.1 Convergent Evolution (Observed, Not Built)

Not a new mechanic — a predicted *emergent outcome* of sections 2–3 working correctly together, worth naming explicitly because it doubles as a verification tool: independently-seeded populations (different starting genomes) placed on planetoids with similar resource/crowding profiles should, after enough generations, trend toward similar trait values for the traits that profile selects on — even though nothing in the code ever compares the two populations to each other. If this does *not* happen across two similarly-conditioned test planetoids, it's a signal the selection function (section 3) isn't actually applying consistent pressure — treat convergence as a diagnostic, not a feature to implement.

---

## 6. Isolation (Blast Radius)

**Blast radius: single planetoid.** An ecosystem crash, genetic runaway (e.g. `mutationRate` drifting high and destabilizing a population), or trophic collapse on one planetoid must never affect another planetoid or the wider world — same law as the gravity recentering precedent in `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` §4.4.

- All simulation state (`organisms`, `rngState`, `lastSimulated`, biomass levels) is stored per-planetoid.
- **Only sanctioned cross-planetoid vector:** a player physically carries a "seed" item (existing inventory system, `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`) that snapshots one organism's *genome data only* — never live simulation state — for planting elsewhere.
- **Every cherry-picked mechanism stays within this same radius by construction**, not by a separate rule added per-mechanism: horizontal gene transfer is adjacent-cell-only; genetic drift and punctuated equilibrium operate on the local per-planetoid population/RNG state already scoped in section 4; sexual selection only re-weights an already-local pairing pool; symbiosis operates on the same local radius as the predation link. No new cross-boundary surface is introduced by any of them.
- Section 1.1's coherence bounds travel with the genome itself (they're a property of the trait ranges, not of any one planetoid), so a carried seed is exactly as geometrically coherent on its new planetoid as it was on its old one — no special-casing needed at the migration boundary.

---

## 7. Adaptive Damping (Population Volatility)

Applies the generalized algorithm from `RHOMBIVERSE_PRINCIPLES.md` §2 directly, with population swings as the correction-triggering event:

```
on population_swing_event(planetoid, magnitude):
    volatility_score(planetoid) += weight_of(magnitude)
    carryingCapacity(planetoid) = baseCapacity + f(volatility_score)
    mutationRateCeiling(planetoid) = baseCeiling - g(volatility_score)  # bounded down, not up

on quiet_generations_elapsed(planetoid):
    volatility_score(planetoid) *= decay_factor
```

A planetoid whose ecosystem repeatedly booms and crashes gradually gets a wider carrying-capacity buffer and a lower ceiling on how volatile mutation rates are allowed to become — settling toward stability over generations rather than oscillating forever. A calm, rarely-swinging ecosystem keeps tight, precise defaults.

**Interaction with punctuated equilibrium (2.4):** the jolt-triggered mutation boost is itself subject to `mutationRateCeiling` — a planetoid with a volatile history dampens even its jolt-response bursts, so repeated environmental shocks don't compound into runaway instability. This is the two mechanisms composing correctly rather than fighting: punctuated equilibrium proposes a burst, adaptive damping caps how large any burst is allowed to be. Note this is a *rate* cap, separate from and in addition to section 1.1's *coherence* bounds — even an undamped burst could never produce an incoherent shape; damping is about how fast the population explores the coherent space, not about widening what's reachable within it.

---

## 8. Moderation Hook (ties to existing Trust Zones, not a new pipeline)

Because genomes drift unpredictably over many unattended generations (unlike a single planted seed, which resolves once, instantly, under a player's eye), evolved phenotypes need to pass through the *existing* Phase 5.8 region/status pipeline rather than a new one:

- A generation whose phenotype crosses a defined shape-novelty threshold from its parent (large jump in substitution-depth/branching, not routine small mutation) is created with `status: "pending"` and routed through the existing review queue, exactly like a new manual build.
- Routine, small-delta generations do not need per-individual review — only cost-checking outliers, to keep the moderation queue from being flooded by ordinary evolutionary noise. A punctuated-equilibrium mutation burst (2.4) will legitimately generate more outliers in a short span than steady-state — the queue should expect and absorb that, not treat it as anomalous.
- **Distinct from section 1.1:** this queue exists for content-moderation reasons (is a *coherent, beautiful* shape still appropriate/safe for the UGC pipeline) — it is never a backstop for geometric incoherence, because section 1.1 guarantees incoherent shapes are never reachable in the first place. Nothing evolution produces should ever need moderation for "being ugly" or "broken looking" — only for the same content concerns any manual build already goes through.
- This is explicitly flagged (per `RHOMBIVERSE_COMPLIANCE.md`) as needing a real design/legal pass if the audience includes minors, same as the rest of the UGC pipeline.

---

## 9. Player-Facing Surface (Environmental Influence Only)

No breeding/culling UI. Players influence outcomes only through existing levers:

- Placing/removing Ice 9.9 near a Blackstar-Glassite core changes local resource availability (section 3) — and, if the change is large enough, can itself register as an environmental jolt (section 2.4).
- Choosing which preselected planetoid to plant on sets the starting selection pressure.
- Planting density (how many seeds, how close together) sets initial crowding pressure and initial genetic-drift exposure (a sparser founding population drifts more, section 2.2), and sets opportunity for horizontal gene transfer, since adjacency is required for it.
- Co-locating plants and amoeba is a meaningful choice (section 5's symbiotic link), giving players an indirect way to favor plant growth without any new UI — just placement.
- Optional: an "inspect" tool surfaces a planetoid's dominant current traits (read-only), so players can *observe* evolution — including convergence across planetoids (5.1) — without directly steering it. Every phenotype this tool ever displays is, by section 1.1's construction, one of the geometrically coherent forms the L-system already knows how to render beautifully — nothing players observe should ever look like an error state.

---

## 10. Success Checks

- [ ] Two organisms of the same species on the same planetoid, several generations apart, show measurably different trait values traceable to inherited-and-mutated genomes (not independent randomness).
- [ ] A planetoid with scarce local resource shows rising average `resourceEfficiency` over simulated generations; an abundant one does not select for it as strongly.
- [ ] Two adjacent mature amoeba occasionally show a single shared trait value not explainable by shared ancestry (horizontal transfer working).
- [ ] A freshly founded, small population shows genetic wander not explainable by fitness alone; the same species above `driftThreshold` does not (genetic drift working, and correctly bounded to small populations only).
- [ ] Plant reproduction pairing shows a statistical bias toward higher-`resourceEfficiency` partners when multiple candidates are in range, without fully excluding lower-trait candidates (sexual selection working as a bias, not a hard filter).
- [ ] A scripted environmental jolt (sudden resource change) produces a measurable, temporary rise in population-wide mutation rate that decays back to baseline over subsequent generations (punctuated equilibrium working).
- [ ] Plant density in areas with sustained nearby amoeba presence trends modestly higher than otherwise-identical amoeba-free areas (symbiotic link working).
- [ ] Two independently-seeded, similarly-conditioned test planetoids show trait convergence over many generations despite no code path comparing them directly (convergent evolution observed — validates section 3's selection function).
- [ ] Exhaustively sampling the bounds of every genome trait (including extremes and rapid punctuated-equilibrium bursts) never produces a phenotype outside the L-system's five-fold coherent substitution rules — no incoherent/degenerate shape is reachable by any combination of mutation, crossover, drift, or transfer (section 1.1 verified structurally, not just spot-checked).
- [ ] Reloading a planetoid after a long absence resolves in bounded time regardless of real elapsed time (`MAX_CATCHUP_GENERATIONS` enforced).
- [ ] Two clients loading the same stored planetoid state produce identical simulated outcomes (determinism verified).
- [ ] Amoeba and biomass populations on a populated planetoid show out-of-phase oscillation over generations (predation coupling working).
- [ ] A population crash or genetic runaway on one planetoid produces zero measurable effect on any other planetoid's state.
- [ ] A planetoid with a history of repeated population swings shows a measurably wider carrying-capacity buffer, and dampened jolt-response bursts, versus a calm one (adaptive damping working, including its interaction with punctuated equilibrium).
- [ ] A large phenotype jump between parent and offspring generation is flagged `pending` and enters the existing review queue; routine small mutations are not.
- [ ] No new UI exists for direct breeding/culling — only existing placement/resource/planetoid-choice levers affect outcomes.

---

## 11. Build Order (stages, each its own Claude Code task)

**Stage 1 — Genome, Phenotype & Coherence Bounds**
Add `organisms` key to world-state schema (parallel to `seeds`). Define the genome struct (section 1) and the phenotype-mapping function that feeds existing L-system parameters. Critically, derive each trait's valid range directly from what the existing `growth.js` substitution rules already accept as coherent input (section 1.1) — this stage's success check is as much "no genome value can produce a broken/incoherent shape" as it is "genome in, shape out."

**Stage 2 — Reproduction, Inheritance, HGT & Sexual Selection**
Implement asexual budding (amoeba) and proximity-pairing (plants) with the mate-preference bias (2.3), the bounded mutation function, and amoeba-specific horizontal gene transfer (2.1). Single-generation only — trigger manually to verify each channel independently before wiring into automatic resolution. Confirm every offspring/transfer result still falls within Stage 1's coherence bounds.

**Stage 3 — Environmental Selection & Genetic Drift**
Wire resource scarcity and crowding into survival/reproduction probability (section 3), including the `driftThreshold` bypass (2.2). Verify with scripted tests: (a) differing `resourceEfficiency` under scarcity produces differential reproduction success above threshold, (b) a population below threshold shows chance-driven outcomes instead.

**Stage 4 — Deterministic Catch-Up Engine + Punctuated Equilibrium**
Implement `lastSimulated`/seeded-RNG resolution loop (section 4) with `MAX_CATCHUP_GENERATIONS`, including environmental-jolt detection and the temporary mutation-rate boost (2.4). Verify bounded runtime, determinism, a scripted jolt producing the expected boost-then-decay curve, and that even a maximal burst stays within Stage 1's coherence bounds.

**Stage 5 — Trophic Coupling (Predation + Symbiosis) & Convergence Check**
Add `biomass` production/consumption (predation link) and the amoeba-proximity growth boost (symbiotic link). As a verification-only step, run two similarly-conditioned test planetoids from different starting genomes and confirm trait convergence over many generations (5.1) — this is the single best end-to-end check that sections 2–5 are wired correctly.

**Stage 6 — Isolation Enforcement**
Confirm all new state, including every cherry-picked mechanism, is planetoid-scoped; implement the seed-carrying genome-snapshot mechanic as the sole cross-planetoid vector. Verify a deliberately destabilized test planetoid has zero effect on a second, untouched planetoid.

**Stage 7 — Adaptive Damping**
Implement the volatility-score/carrying-capacity/mutation-ceiling algorithm (section 7), including its interaction with punctuated equilibrium's jolt boost. Verify a scripted "repeatedly crashed" planetoid shows both wider carrying capacity and dampened jolt-response versus a calm control.

**Stage 8 — Moderation Hook**
Implement shape-novelty-jump detection and route qualifying generations into the existing `pending`/review pipeline. Verify routine mutations don't enter the queue, a scripted large jump does, and a punctuated-equilibrium burst doesn't overwhelm the queue's expected volume.

**Stage 9 — Player-Facing Surface**
Wire existing placement/resource UI to affect selection pressure end-to-end; add the read-only "inspect dominant traits" tool. No new breeding UI, per the governing decision.

---

## 12. Claude Code Prompt (copy-paste to start Stage 1)

> Implement Stage 1 of `RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md`: add an `organisms` key to the world-state schema, parallel to the existing `seeds` key from the Penrose/RT growth layer. Define a genome struct with the five traits in section 1 (`growthRate`, `branchingAngle`, `resourceEfficiency`, `maturitySize`, `mutationRate`). Before fixing numeric bounds, first inspect the existing `growth.js` substitution/L-system rules to determine what range of each corresponding parameter actually produces coherent five-fold quasicrystalline output — then set each trait's valid range to exactly that, per section 1.1 (geometric coherence is a hard constraint here, not a later cleanup pass). Implement a pure function `genomeToPhenotype(genome) -> growthParams` that maps genome values onto those existing L-system substitution parameters — do not modify `growth.js`'s rendering path, only feed it different (always-coherent) parameters. No reproduction, selection, gene-transfer, drift, sexual-selection, punctuated-equilibrium, or trophic logic yet — this stage is data model, the genome→phenotype mapping, and the coherence-bound derivation only, verifiable by confirming an organism planted with a given genome grows into the shape its mapped parameters predict, and that no value within the defined trait ranges can produce a broken or incoherent shape.

---

## 13. Open Design Questions (flagged, not blocking)

- Exact numeric ranges/defaults for each genome trait (now additionally constrained by section 1.1 — depends on inspecting `growth.js`'s actual accepted parameter space, not just picking round numbers).
- Exact mutation magnitude per trait (how big a "small bounded delta" is).
- `generationInterval` and `MAX_CATCHUP_GENERATIONS` real-world values.
- Whether `biomass` is a new material/resource type or an alias/extension of Water.
- Exact shape-novelty threshold that triggers moderation review (section 8).
- Horizontal gene transfer probability-per-adjacent-pair-per-generation-step (2.1) — should read as "occasional," not routine.
- Symbiotic growth-boost magnitude (section 5) — must stay small enough not to cancel predation oscillation.
- `driftThreshold` population size (2.2) — below what count does chance meaningfully outweigh fitness in a realistic small founding population.
- Which trait sexual selection biases toward (2.3 proposes `resourceEfficiency` as most legible; not fixed).
- `environmentalJolt` detection threshold and the mutation-boost multiplier/decay curve (2.4).
