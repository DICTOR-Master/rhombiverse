# Notes: `src/game-systems/asteroids.js`

Full design rationale/history for this file, moved out of the source so
the code itself stays lite and readable — nothing here is new, it's the
exact commentary that used to sit inline. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## File overview

Asteroid Belts (Resource Mining) — `RHOMBIVERSE_SPEC_ASTEROIDS.md`.
Scoped to acquisition only per the spec's own Claude Code prompt ("do
not implement crafting/conversion... this pass covers acquisition
only"): world seeding, mining -> inventory, per-cell regeneration, and
population-scaled spawning (section 5).

Deviates from the spec's own section 6 JSON shape in one place, on
purpose: no separate `asteroidBelts` registry storing belt/node
structure. Belt/node geometry here is fully deterministic (fixed seed
coordinates, not player-granted like claims), so it's expressed as
plain module constants + a seeding function rather than mutable state
that would need its own accessor methods for no real benefit — an
asteroid cell's own `asteroidNodeId` field (living in the normal
`world.cells` map, same pattern as `shellCenter`/`claimId`) is enough to
identify which node it belongs to. `playerInventory` and the regrowth
queue ARE real top-level world-state, per the spec (`worldstate.js`).

## `NODE_SHELL_RADIUS`

"individual small clumps" — 1 (center) + 12 (shell 1) = 13 cells/node.

## `BELTS`

Two starting belts (section 2), placed well outside `regions.js`'s own
claim-search range (`MAX_CLAIM_SEARCH_SHELL=40`, real distance under
~50 units) so belts and claims can never collide in this pass.
`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 4 (reserve pre-seeded content
before claim allocation runs) is deliberately NOT built yet — this
distance is what makes deferring it safe for now, not a permanent fix.

## `listBelts`

Read-only belt locations for UI — `render.js`'s "Go to Belt" controls
need these to be discoverable/reachable at all (belts sit 80+ units
from the default camera framing, impractical to find by orbiting
blind). Exposes only id/center, not the internal `nodeOffsets` shape.

## `YIELD_WEIGHTS`

Section 3's yield table, as relative weights — first-guess/tunable like
every other numeric constant in this project, not derived.
Blackstar-Glassite is intentionally rare here; it remains freely
placeable via the material dropdown elsewhere in the game (Build/Fill/
Generate all already depend on that for the gravity/black-hole/star-
system mechanics built earlier this session) — this table governs what
MINING an asteroid yields, not a restriction on where BSG can ever be
placed. Read fully literally, section 3's "does not occur anywhere
else in the world" would contradict every gravity-mechanic spec already
built and tested; the yield-only reading is the one that doesn't
regress them.

## `REGEN_COOLDOWN_MS`

30s — first-guess, fast enough to observe/test without waiting minutes;
not playtested, same convention as every other timing constant in this
project (`blackhole.js`'s `DAMPING_WINDOW_MS`, etc.).

## `seedNode`

Places one node's cells into `world.cells` at `beltCenter+offset`,
tagged with `id`. Never overwrites a cell that's already there for any
reason. Shared by both initial seeding and population-scaled spawning.

## `seedAsteroidBelts`

Places the two starting belts' cells directly into `world.cells`,
tagged with `asteroidNodeId`. Idempotent: only seeds if NO asteroid
cells exist yet anywhere (checked once, cheaply, via `world.entries()`)
— safe to call unconditionally on every `init()`/`enableSharedWorld()`
without re-seeding or duplicating belts on a later load/reconnect.
Never overwrites a cell that's already there for any reason.

## Population-scaled spawning constants

Section 5: population-scaled spawning, Adaptive Damping
(`RHOMBIVERSE_PRINCIPLES.md` section 2) applied to resource supply.
`target_total_capacity = base_capacity + f(active_users)`, `f()`
bounded per the spec's own explicit requirement. `BASE_NODES_PER_BELT`
matches `BELTS`' own hardcoded `nodeOffsets` length above — those 6
nodes (2 belts x 3) are the permanent floor, always present regardless
of population.

- `NODES_PER_ACTIVE_USER` — `f()`'s slope, first-guess/tunable, not derived.
- `MAX_EXTRA_NODES_PER_BELT` — `f()`'s bound, the spec's own explicit
  "sane upper capacity ceiling" requirement; total ceiling =
  `(3+6)*2 belts = 18 nodes`.
- `ACTIVITY_WINDOW_MS` — "Active" = authored/touched a cell within this
  window — per `RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2's own explicit
  guidance ("a sanity-checked activity signal... not raw
  concurrent-connection count, which is trivially inflated"), not a
  live presence/connection count (this repo has no presence tracking at
  all). 1 hour, first-guess/tunable like every other timing constant
  here.
- `NODE_SPACING` — node centers beyond the original hand-placed 3 are
  generated systematically rather than hand-listed, reusing the SAME
  `cellsInShells` "expand outward from a center" pattern used
  everywhere else in this project — just applied at a coarser
  granularity (node SLOTS, not individual cells). Even spacing (so
  scaled coordinates always keep valid lattice parity regardless of the
  original cell's own parity) keeps generated node centers well
  separated — each node's own real footprint radius is under 3 units.

## `targetNodesPerBelt`

Read-only, for UI/tests — current target node count per belt given
present activity. Local-only play has no `authorId`/`updatedAtMs`
anywhere, so `activeUserCount` is always 0 there and this always
returns `BASE_NODES_PER_BELT` — population scaling is inherently a
Shared World concept, correctly a no-op for solo play.

## `applyPopulationScaledSpawning`

Grows each belt toward its current target node count. Purely additive
— only ever ADDS nodes when target rises above what already exists;
when target falls (population decline), the loop simply stops early
and does nothing further, never removing/touching nodes already seeded
at a higher population. Matches section 5's explicit guarantee ("supply
contracts by slowing new growth, not by removing what's already there")
exactly, by construction, not by a separate check.

## `mineAsteroidCell`

Mining: removes the cell (reuses the exact same `world.removeCell`
every other delete path already uses), credits the miner's inventory if
they have a real identity (local single-player play has none — the
mining mechanic itself still works there, only inventory bookkeeping is
skipped), and registers the position for regrowth. `cell` is whatever
`build.js`'s raycast controller already resolved — no re-fetch needed.

## `applyAsteroidRegeneration`

Per-node regrowth (section 4): each pending-regrowth entry becomes a
real cell again once `REGEN_COOLDOWN_MS` has passed, cell by cell (not
whole-node-at-once) — entries regrow independently since each has its
own `minedAt` timestamp, giving exactly the "heavily mined node regrows
gradually" behavior the spec asks for with no extra bookkeeping. Skips
(and permanently drops) an entry if a player has since built something
else at that exact position — never overwrites real player content,
matching Isolation (asteroid mechanics never disturb player builds).
