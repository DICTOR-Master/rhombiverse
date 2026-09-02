# Rhombiverse — Spec Addendum: Black Hole Asymptotic(Containment)

Standalone addendum. Extends `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` (black hole = extreme case of the same gravity-source mechanic) and is governed by `RHOMBIVERSE_PRINCIPLES.md` (isolation + adaptive damping both apply directly here — this spec is close to a worked example of both principles at once).

---

## 1. Purpose & Core Design Constraint

A black hole must be creatable by players without ever being able to consume unbounded space, destroy unrelated players/structures, or grow without limit. This is not enforced by an arbitrary rule layered on top — it emerges from the mechanic's own physics-inspired design, per the "master's tools cannot destroy the master's house" principle: **the system should be structurally incapable of producing an unbounded black hole, not merely forbidden from doing so.**

---

## 2. Core Mechanic: Asymptotic Space Generation

**Real-physics grounding:** near an actual black hole (Schwarzschild geometry), space itself stretches — an object falling toward the event horizon appears, to a distant observer, to take infinitely longer to arrive, asymptotically approaching but never reaching it in finite observed time. This spec adapts that real behavior directly, rather than inventing a hard numeric cap.

**Mechanic:** as any entity or structure approaches a black hole, the app **procedurally inserts additional lattice cells** between the approaching entity and the black hole's center — using the same FCC coordinate system already defined in `RHOMBIVERSE_PLAN.md` section 2. The closer the entity gets, the more new space is generated, such that apparent remaining distance shrinks progressively more slowly, asymptotically approaching (but never reaching) zero.

**Effect:** arrival at the black hole's true center becomes **structurally impossible**, not merely disallowed by a rule — the entity is always still "approaching," never "arrived," for any practically reachable play session.

**Computability caveat (honest limit):** true infinite space generation isn't computable. Implementation must cap total generated cells at a very-large-but-finite bound — indistinguishable from infinite within any real play session, but bounded under the hood so the engine never attempts genuinely unbounded generation. State this cap explicitly in implementation (tunable, not fixed by this spec).

---

## 3. Resource Cost: Consumed Matter Funds Generated Space

**This is the mechanism that makes containment self-enforcing, not just geometric.**

- Generating new asymptotic space is **not free** — it is funded directly by matter the black hole itself has consumed (cells it has absorbed from the world), converted into new buffer-space cells. This is a direct echo of mass-energy conservation: the black hole isn't destroying matter for free, it's converting consumed mass into the very space that prevents anything from reaching it.
- **Cost scales with shell distance**, using the same `shellCount(n) = 10n² + 2` progression already established in the gravity spec — generating space at shell `n` requires cumulative consumed-matter "currency" proportional to shells 1 through `n`. Because this cost compounds with distance, sustaining an ever-closer approach requires disproportionately more consumed matter, the further "in" anything gets.
- **Practical consequence:** since consumable matter in the world is finite (and rare materials like Blackstar-Glassite are deliberately scarce, per the gravity spec), no player can realistically accrue enough resource to fund space generation all the way to a true center. The economic cost becomes the practical enforcement mechanism — the asymptote is real geometry, but the resource cost is what makes it *taxing to even approach*, not just theoretically infinite.
- **Who pays:** the black hole's creator/owner account accrues the consumed-matter ledger; space generation draws against that ledger. A black hole that stops consuming matter (nothing left nearby, or player stops feeding it) stalls — it does not continue expanding on credit.

---

## 4. Isolation (per `RHOMBIVERSE_PRINCIPLES.md` section 1)

- **Blast radius is explicit and bounded:** a black hole's consumption/pull effect only applies within its current active radius (same radius mechanic as planetoid gravity) — it cannot reach or affect structures/players outside that radius, regardless of how much matter it has consumed.
- **No creator, however resourced, can expand blast radius unboundedly** — radius growth is bounded by the same finite-resource economics in section 3, which functions as the enforced ceiling required by the isolation principle.
- **Cross-player consent — resolved: opt-in destructible zones.** A black hole's pull/consumption effect can only affect another player's structures if that player has explicitly opted their region into a "destructible" mode (a region-level flag, set by the region's owner, tracked alongside the `region`/`status` fields already defined in `RHOMBIVERSE_PLAN.md` section 3). **Default is protected** — any region without this flag set is entirely immune to black hole consumption, regardless of the black hole's radius or accrued ledger. This gives players who want real stakes/drama a way to opt in, while everyone else stays safe by default — consistent with the Phase 5.8 trust-zone model and the project's broader safety priorities (see `RHOMBIVERSE_COMPLIANCE.md`).
- A black hole's own creator may always affect their own claimed region regardless of the destructible flag (self-risk requires no opt-in, since it only affects the creator's own build).

---

## 5. Adaptive Damping (per `RHOMBIVERSE_PRINCIPLES.md` section 2)

- If a black hole is consuming matter and generating space rapidly (many correction/consumption events in a short window), apply the same volatility-aware tolerance pattern from the principles doc: the *cost* of continued expansion increases with recent consumption rate, not just cumulative shell distance — a black hole growing very fast becomes progressively more expensive to keep growing, pushing naturally toward a settled, stable radius rather than runaway acceleration.
- This is a deliberate departure from real black hole physics (real ones runaway-accrete, growing easier as they grow bigger) — noted here explicitly as an intentional safety-first divergence, consistent with the shockwave mechanic's similar departure from realism in the gravity spec.

---

## 6. Success Checks

- [ ] An entity approaching a black hole never reaches its true center — apparent distance shrinks asymptotically, never reaching zero, within any real play session.
- [ ] Space generation draws from a consumed-matter ledger tied to the black hole's creator; generation halts if the ledger is insufficient.
- [ ] Cost of generating space at shell `n` scales with cumulative `shellCount` through `n`, making deeper approach disproportionately expensive.
- [ ] Black hole pull/consumption effect never extends beyond its current bounded active radius, regardless of accrued matter.
- [ ] Rapid recent consumption increases the marginal cost of further growth (adaptive damping), rather than growth becoming easier over time.
- [ ] No player action can cause unbounded lattice generation — a hard, very-large finite cap exists under the hood even though it's practically unreachable through normal play.
- [ ] A black hole cannot affect another player's region unless that player has explicitly set their region's `destructible` flag; unflagged regions are fully immune regardless of black hole radius or ledger size.
- [ ] A black hole's creator can always affect their own claimed region without needing the destructible flag.

---

## 7. Claude Code Prompt (copy-paste to start this addendum)

> Implement the Black Hole (Asymptotic Containment) system per `RHOMBIVERSE_SPEC_BLACKHOLE.md`. Build on top of the existing gravity/lattice code from `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` and `RHOMBIVERSE_PLAN.md`. Implement: (1) procedural asymptotic space generation between an approaching entity and the black hole center, capped at a large-but-finite bound (choose and document a specific cap value), (2) a consumed-matter ledger per black hole that funds space generation, with cost scaling via `shellCount(n) = 10n² + 2` cumulative through the current shell, (3) a bounded active pull radius that cannot be exceeded regardless of ledger size, (4) adaptive cost-scaling per `RHOMBIVERSE_PRINCIPLES.md` section 2 so rapid recent growth increases marginal future cost, (5) a per-region `destructible` boolean flag (extending the world-state schema alongside `region`/`status`) — a black hole may only consume cells in another player's region if that region's flag is true; a black hole's own creator's region is always affected regardless of the flag. This depends on the Phase 5.8 trust-zone/region-ownership system existing first — do not invent a separate ownership model here.
