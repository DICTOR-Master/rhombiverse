# Notes: `src/world-systems/supernova.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Supernova Threshold — `RHOMBIVERSE_SPEC_SUPERNOVA.md`. "Reuses the
containment pattern from `RHOMBIVERSE_SPEC_BLACKHOLE.md` directly... no
new safety mechanism is invented here" (spec header) — this file is
deliberately thin, leaning on `blackhole.js`'s and `starsystem.js`'s
already-built mechanics rather than duplicating them.

## `SUPERNOVA_CRITICAL_MASS` / `DAMPING_WINDOW_MS` / `DAMPING_FACTOR` / `SCATTER_MATERIAL`

First-guess constants, not yet playtested — same convention as every
other tunable in this project. `SUPERNOVA_CRITICAL_MASS` is the star's
own "Chandrasekhar-equivalent limit" (section 1): accumulated fusion
mass (`starLedger`'s own `hydrogenConsumed`+`carbonConsumed` — section
2's explicit "extends the existing... ledger pattern... same shape, not
a new field type", so this reuses `starsystem.js`'s ledger directly
rather than inventing a second one) that triggers detonation once
reached. `DAMPING_FACTOR` is the marginal-threshold multiplier per
recent fusion tick, same shape as `blackhole.js`'s own damping.
`SCATTER_MATERIAL` is an arbitrary "raw material" stand-in, not fixed
by the spec.

## `applyDetonationCheck`

Checks every star-classified cluster for whether it has crossed its
(adaptively-damped) critical mass and, if so, detonates it exactly once
(section 2: "below threshold... normal... at/past threshold... triggers
a supernova event — a single, bounded detonation"). Mutates `world` in
place; safe to call every `onChange` like the other spec modules'
`apply*` passes — idempotent past detonation since `applyStarFusion.js`
already stops accumulating further mass once `detonated` is set, and
this function itself checks that flag before doing anything.

Effective-threshold damping: section 2, "the closer accumulated mass
gets to the limit, the more costly/resistant further fueling becomes"
— reusing `blackhole.js`'s exact damping shape (scale up the required
threshold with recent activity) rather than inventing a second pattern.

## `detonate`

Section 3's effects, in order: bounded blast radius (reuses
`gravityRadius`, "same radius mechanic as planetoid gravity" — the same
convention `blackhole.js` already established), destructible-flag
consent (same single-player-scoped interpretation as `blackhole.js` —
see that file's header for why: no accounts/Phase 5.8 yet, a
single-player world's creator already owns everything,
`destructible:false` is a real per-cell opt-out today), matter
redistribution (removed cells are matched 1:1 with new
`SCATTER_MATERIAL` cells placed just beyond the blast radius, not
simply deleted), and remnant (deliberately NO code here at all — the
star's own BSG core cells are never touched by this function, only
FOREIGN cells within the blast radius are, so if the core's `bsgCount`
already meets `blackhole.js`'s own `BLACK_HOLE_BSG_THRESHOLD`, the
already-running `applyBlackHoleConsumption`/`applyAsymptoticGeneration`
passes simply start treating it as a black hole on the very next
`onChange` — exactly "instantiate the existing Black Hole system... do
not build a separate remnant mechanic," satisfied by NOT writing
remnant-specific code rather than by writing some).

Per-cell removal loop notes:
- Never touches the star's own structure — see remnant note above.
- Claim check: `RHOMBIVERSE_SPEC_REGIONS.md` section 4 — same
  claim-level destructible check as `blackhole.js`'s own consumption
  loop, additive with the per-cell field just above.
- Author check: same absolute cross-player guard as `blackhole.js`'s
  own consumption loop (2026-08-12, direct instruction) — a foreign
  cell authored by a different player than this star's own core
  creator is never touched by detonation, unconditionally.

Scatter-placement loop: scatters BEYOND the blast radius, into "nearby
unclaimed space" (section 3).

## `annotateSupernovae`

Read-only summary for UI/tests, same pattern as the other spec modules'
`annotate*` functions.
