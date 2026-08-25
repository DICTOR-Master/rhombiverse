# Notes: `src/game-systems/blackhole.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Black Hole (Asymptotic Containment) — `RHOMBIVERSE_SPEC_BLACKHOLE.md`.
"Black hole = extreme case of the same gravity-source mechanic" (the
spec's own section 3 framing, mirrored by Star System's identical
"large-scale BSG, not a new material" move) — there is no new material
or object type here. A cluster becomes a black hole once its BSG mass
crosses `BLACK_HOLE_BSG_THRESHOLD`; below that, it is an ordinary
planetoid (`gravity.js`) and none of this file's logic applies.

SCOPED FOR SINGLE-PLAYER (2026-08-11, direct instruction), UPDATED
2026-08-12 once Shared World (Phase 5) made cross-player consumption a
LIVE possibility rather than a hypothetical. The spec's section 4 full
consent/region-ownership model still depends on Phase 5.8, not built
here — but per direct instruction ("not possible at all for one
player's black hole to swallow another's built work"), an absolute,
unconditional guard was added below: any foreign cell with a real
`authorId` (stamped by `sync.js` from Supabase's own `auth.uid()`-backed
`author_id` column) that doesn't match this black hole's own core
creator is skipped, full stop — not an opt-in via `destructible`, no
exceptions. This is narrower than Phase 5.8's eventual region/claim
system (no shared-ownership regions, no explicit consent grants
between specific players) but it is a hard floor: cross-player
consumption is categorically impossible regardless of what Phase 5.8
eventually adds on top. `destructible: false` remains the finer-
grained, OPT-IN escape hatch for protecting specific cells of your OWN
build from your OWN black hole (unaffected by the `authorId` guard,
which only ever concerns OTHER players' cells).

## Threshold/tuning constants

First-guess constants, not yet playtested — same "flag it, don't
silently invent tuning math" convention this project already follows
(`build.js`'s `roundStructure` TOLERANCE, `gravity.js`'s
`BASE_GRAVITY_RADIUS`).

- `BLACK_HOLE_BSG_THRESHOLD` — BSG cells needed before a cluster counts
  as a black hole rather than an ordinary planetoid.
- `MAX_GENERATED_CELLS` — explicit finite cap on asymptotic buffer cells
  per black hole (section 2's "computability caveat").
- `EVENT_HORIZON_FRACTION` — fraction of `gravityRadius` treated as the
  automatic-consumption zone.
- `DAMPING_WINDOW_MS` — recent-consumption window for adaptive damping
  (section 5).
- `DAMPING_FACTOR` — marginal cost multiplier per consumption event
  inside the window.

## `shellCumulativeCost`

Cumulative `shellCount(1..n)` — section 3: "generating space at shell n
requires cumulative consumed-matter currency proportional to shells 1
through n."

## `pickCoreCell` (internal)

Sticky core-cell selection: once a cluster has an established ledger on
one of its BSG cells, keep using that same cell so `consumedMatter`/
`generatedThroughShell` survive `centerOfMass` drifting slightly as the
cluster grows — only pick a fresh core (nearest BSG cell to
`centerOfMass`, ties broken by `cellKey` for determinism) the first time
a cluster crosses the black-hole threshold.

## `applyBlackHoleConsumption`

Consumption: any foreign (non-BSG, non-generated-buffer) cell within
the event horizon of a black-hole-classified cluster is absorbed —
removed from the world and its mass credited to that black hole's
ledger, funding future space generation (section 3). Excludes cells
with `destructible: false` (this repo's single-player stand-in for the
spec's region consent flag — see file header) and cells already
tagged `generatedByBlackHole` (so a black hole can't refund itself by
"consuming" the buffer it just generated). Mutates `world` in place;
safe to call on every world change like `hydrosphere.js`'s
`applyHydrosphere` — idempotent once nothing foreign remains in range.

Inline detail on the two protection checks in the consumption loop:
- `RHOMBIVERSE_SPEC_REGIONS.md` section 4: `destructible` now also
  resolves via the cell's claim (if any), additively with the per-cell
  field.
- Absolute cross-player guard, per direct instruction (2026-08-12): a
  foreign cell with a real `authorId` that differs from this black
  hole's own core creator is NEVER consumable, full stop — not an
  opt-in via `destructible`, unconditional. A cell with no `authorId`
  (local-only play, the static seed, presets, anything that never went
  through `sync.js`) has nothing to protect it FROM here, same as
  before this check existed — fully backward compatible.

## `applyAsymptoticGeneration`

Asymptotic space generation: backfills empty lattice cells between a
black hole's center and the nearest foreign structure with
`generatedByBlackHole` buffer cells, funded by the ledger consumption
built above — section 2's "as any entity or structure approaches...
procedurally inserts additional lattice cells." A structure "gets
closer" in this discrete, structure-based sense (building nearer to
center), not continuous real-time motion — deliberately not hooked
into `player.js`'s per-frame walk loop, since that would generate real
`InstancedMesh` cells every frame while merely standing still and isn't
needed for the mechanic's actual purpose (funding-gated containment).
Never fills a shell that already contains a real foreign cell (can't
overwrite existing builds), never extends past the nearest foreign
structure's own shell (only fills the gap, so "how much space exists
between you and the center" is what grows, not the black hole eating
outward on its own with nobody approaching), never exceeds
`gravityRadius` (section 4's bounded blast radius), and never exceeds
`MAX_GENERATED_CELLS` (section 2's finite computability cap). Adaptive
damping (section 5): the ledger balance required to fund shell n scales
up with how many consumption events happened in the last
`DAMPING_WINDOW_MS`, so a black hole absorbing matter fast becomes
progressively costlier to keep extending rather than easier.

Inline detail on the shell-search bound: nearest shell (BFS distance
from the core cell) that holds a real, foreign (not part of this
cluster) built cell — generation must never reach or pass it. Shell
cap derived from `gravityRadius` itself (every shell is at least ~1
world unit further out, so this is a generous, cheap-to-compute upper
bound) rather than an arbitrary large constant — BFS candidate count
grows with shell^2, so an unbounded/oversized cap here would be a real
per-`onChange` perf cost.

## `annotateBlackHoles`

Read-only summary for UI/tests: attaches black-hole ledger state onto
the matching planetoid record `computePlanetoids` already returned (by
`centerOfMass`, since both derive from the same clusters in the same
world state within one `render.js` `onChange` pass). Returns a NEW
object — does not mutate the passed-in planetoids.
