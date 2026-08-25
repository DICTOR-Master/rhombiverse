# Notes: `src/core/worldstate-core.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Load/save/serialize the world-state JSON (schema: `RHOMBIVERSE_PLAN.md`
section 3), and an in-memory mutable store over it. Actually persisting
to storage (localStorage) lives in `persistence.js` — this module only
tracks state in memory and knows how to turn it back into JSON.

## `setRegionsIntegration` / the `claimIdAt` binding

`RHOMBIVERSE_PLAN.md`'s Core vs. Modules boundary (2026-08-23): claims
are a World System, so `worldstate.js` (Core) must not statically
import `regions.js`. `render.js` supplies the real `claimIdAt` here via
`setRegionsIntegration()`, gated behind `FEATURES.economy` (see
`render.js`'s own `init()`). Inert default (no claims exist) so
local-only play, tests, and claims-disabled worlds simply never stamp a
claimId, same as before any claim registry existed at all.

## `createWorldStore`

Wraps a loaded world JSON's `cells` map in a `Map` keyed the same way
(`"x,y,z"`), with add/remove/has by coordinate and a stable-order
`entries()` list for rendering. The store is a single long-lived object
(`render.js` holds one reference for the whole session) — `replaceAll`
mutates it in place rather than requiring callers to swap to a new
store, so existing closures (`build.js`'s controller, etc.) keep
working after a "New World" reset or a JSON import.

`hooks.onAdd(x,y,z,data)`/`onRemove(x,y,z)`, both optional, fire at the
end of every `addCell`/`removeCell` call — every mutation path in the
app (`build.js`'s click handlers, `recolorShell`/`removeShell`, and
every `apply*()` derived-mechanic module) goes through these two
methods, so this is the single point `sync.js` (Phase 5) needs to hook
to push local changes to the shared backend, without `worldstate.js`
knowing anything about Supabase/realtime itself. Deliberately NOT
called by `replaceAll` — a bulk local-view swap (Undo, New World,
Import, Load preset) is a personal reset, not a real edit, and must
never bulk-push/delete against a shared world (`render.js` additionally
disables those controls entirely while Shared World sync is active,
since `replaceAll` bypassing these hooks means they'd otherwise
silently desync the shared view).

### `claims`

`RHOMBIVERSE_SPEC_REGIONS.md`'s `claims` registry — the first addendum
to need a genuinely new TOP-LEVEL world-state key rather than just new
per-cell fields (every prior addendum — shell/shellCenter,
gravitySource, blackHoleLedger, starLedger — fit entirely inside
existing cells). `?? {}` so JSON from before this existed still loads.

### `inventory` / `regrowthQueue`

`RHOMBIVERSE_SPEC_ASTEROIDS.md`: `playerInventory` is the spec's own
top-level schema key (section 6), keyed by ownerId then material.
`asteroidRegrowth` is NOT in the spec's own schema — it's this
implementation's bookkeeping for section 4's per-cell regrowth timer
(`asteroids.js` keeps mined-cell material/nodeId/timestamp here rather
than embedding it in a separate asteroidBelts registry, since node
geometry itself is fully deterministic/hardcoded, not player-granted
like claims — see `asteroids.js`'s own header for the full reasoning).

### `pendingTrades`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 5's own top-level schema
key — atomic barter proposals, resolved (or left pending/cancelled) by
`trade.js`. `?? {}` so JSON from before this existed still loads.

### `seeds`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 6's own top-level schema
key — planted growth-layer seeds, owned/mutated by `growth.js`.
Genuinely separate coordinate space from `cells` (real-valued
world-space points, not integer FCC lattice coordinates) — see that
spec's own section 5/6 for why. `?? {}` so JSON from before this
existed still loads.

### `organisms`

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` Stage 1, 2026-08-13:
heritable genomes, parallel in shape to `seeds` (flat id-keyed map) but
a genuinely separate registry, not a field bolted onto a seed —
`evolution.js` owns this key and `growth.js` stays fully unaware of it
(one-directional dependency, `evolution.js` imports `growth.js`, never
the reverse). `?? {}` so JSON from before this existed still loads.

### `seedsCache` / `organismsCache` / `planetoidEvolutionCache`

Memoized `getSeeds()`/`getOrganisms()`/`getPlanetoidEvolution()`
copies — real bug found live (2026-08-14, building the Lattice Zoom
showcase-world preset): `getSeeds`/`getOrganisms`'s own defensive
`{ ...x }` copy (see their own comments — a deliberate, real safety
guarantee, "callers can't mutate it directly," NOT the thing to
remove) was being called repeatedly inside `evolution.js`'s own O(n^2)
per-generation loops (`attemptHorizontalTransfer` and several helpers
each independently re-fetch the full registry), turning an already-
O(n^2) pass into an effective O(n^3) one — profiled live via `node
--cpu-prof`: `getSeeds`/`getOrganisms`'s own copy alone was ~40% of
total self-time in a real worst-case `MAX_CATCHUP_GENERATIONS` run,
which took 35-40 real seconds and hung/crashed a live browser tab.
Since every mutation below already reassigns (copy-on-write), never
mutates in place, the SAME already-built copy stays perfectly valid to
hand out repeatedly between mutations — caching it here keeps the
exact same external safety contract (still a genuinely separate object
no caller can corrupt live state through) while making repeated reads
between writes O(1) instead of O(n) each. Invalidated (set back to
null) by every mutator below and by `replaceAll`; lazily rebuilt on the
next read after that.

### `cellsEntriesCache`

Same fix, same real bug shape, applied to `cells`/`entries()` (found
2026-08-24 profiling the first-visit Showcase World load): `entries()`
was the one remaining unmemoized getter of this shape, doing a full
`Array.from(cells.entries()).map(parseCellKey)` scan on every call.
`evolution.js`'s `countLocalWaterCells` calls `world.entries()` once
per organism per catch-up generation — with `MAX_CATCHUP_GENERATIONS`
(50) and several organisms, that's the same O(n) read repeated hundreds
of times between any real cell mutation, profiled live as ~1.3s of a
~6s synchronous block (`parseCellKey` alone) before the page could
register a single click. Invalidated by `addCell`/`removeCell`/
`replaceAll` below, lazily rebuilt on the next `entries()` call —
callers only ever read fields off these objects, never mutate them
(checked against every real call site), so the same object is safe to
hand out repeatedly between mutations.

### `planetoidEvolution`

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` Stage 6, 2026-08-13:
per-planetoid catch-up state (lastSimulated/rngState), keyed by a
deterministic string derived from that planetoid's own real
centerOfMass — see `evolution.js`'s own `planetoidKeyFor` for the exact
derivation and its honestly-flagged limits. Genuinely separate from
`organisms` (which individuals exist) — this is which PLANETOID's
clock/rng an individual's resolution draws from. `?? {}` so JSON from
before this existed still loads.

## `addCell`

Stamps gravitySource/gravityWeight per the schema in
`RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` section 5, for any cell whose
material is Blackstar-Glassite (and strips them otherwise, e.g. on
recolor away from it). These fields are NOT load-bearing —
`gravity.js` treats `material` as ground truth so worlds imported from
an older export (without these fields) still work correctly — they
exist for schema-compliance / future external tooling only.

Phase 5.8 moderation fields (`RHOMBIVERSE_PLAN.md` section 3 / Phase
5.8): schema-ready on every cell, defaulted only when genuinely absent
— an existing cell's own data (spread in via `...data` by every caller
that re-adds a cell, e.g. recolor, hydrosphere, black hole/star
mechanics) already carries its real values here, so this only ever
stamps brand-new cells. `region` defaults to 'open'/`status` to
'pending' per the plan's own "new builds default to open/pending until
reviewed" — curated content (`data/starter-world.json`,
`data/presets/*.json`) sets 'core'/'approved' explicitly in its own
JSON and bypasses this entirely via `replaceAll()`, so it's never
touched here.

`RHOMBIVERSE_SPEC_REGIONS.md`: claimId is decided once, at creation
time, against whatever claims exist right now — same "only stamp if
genuinely absent" rule as region/status above, so an existing cell's
real claimId (from before this run, or from a claim granted after it
was built) is never silently overwritten. A later claim never
retroactively annexes already-placed cells — matches `regions.js`'s
own Isolation guarantee (allocation only ever reads existing state,
never touches it).

## `getClaims`

Read-only view of the claims registry — `regions.js`'s allocation
algorithm and `claimIdAt()` both read this to know what's already
granted. Returns a shallow copy so callers can't mutate it directly
(must go through `addClaim`, same defensive shape as `entries()`).

## `addClaim`

Grants a new claim or updates an existing one (id is the caller's
choice, not auto-generated here — `regions.js` owns id generation).
Synced to Supabase like everything else — see `render.js`'s
`enableSharedWorld`/`applyRemoteClaim` and `sync.js`'s `pushClaim`.

## `getInventory`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 5: each material entry
is `{quantity, lastUsedAt}`, not a bare number — lastUsedAt drives
`trade.js`'s decay clock. Local-only for this first pass (see
`CLAUDE.md`'s status) — not yet synced to Supabase.

## `creditInventory`

Crediting (mining, or receiving via a completed trade) deliberately
does NOT reset lastUsedAt for a material the player already holds —
only spending does (`spendInventory` below). This is exactly
`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 1's own fix, satisfied by
construction rather than a special case: "trade receipt never resets
decay on its own... its decay clock continues from whenever it was
originally mined." A material the player has genuinely never held
before has no prior timestamp to preserve, so it starts its own clock
at `now` — the only sensible baseline, not a loophole (there's no
existing decay state being reset away).

## `spendInventory`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 4: "using/spending
material resets its decay clock for the amount used" — the one real
"use" event this implementation has is completing a trade (see
`trade.js`'s own header for why building doesn't consume inventory
yet). Returns false without mutating anything if the holder doesn't
have enough — callers must check this before treating a spend as
having happened, same "no partial-state risk" guarantee trade
resolution itself needs (section 6).

## `setInventoryEntry`

Direct setter for `trade.js`'s decay pass, which computes the exact
resulting `{quantity, lastUsedAt}` itself (decay is neither a credit
nor a spend in the player-action sense — see `applyInventoryDecay`).

## `getPendingTrades` / `setPendingTrade` / `removePendingTrade`

Pending barter proposals — `trade.js` owns id generation and
resolution logic; this is just storage, same division of
responsibility as claims (`regions.js`) and the regrowth queue
(`asteroids.js`). `hooks.onTradeSet`/`onTradeClear` mirror the same
optional-hook pattern as `onRegrowthSet`/`onRegrowthClear`, for a
future Supabase sync pass.

## `getRegrowthQueue` / `setRegrowthEntry` / `removeRegrowthEntry`

Pending asteroid regrowth entries, keyed by "x,y,z" — see
`asteroids.js`'s `mineAsteroidCell`/`applyAsteroidRegeneration`.
`hooks.onRegrowthSet(key,entry)`/`onRegrowthClear(key)`, both optional,
mirror `onAdd`/`onRemove` above — the sync point `sync.js`'s
`pushRegrowthSet`/`pushRegrowthClear` hook into
(`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4: any connected client should
be able to process a pending regrowth, not just whoever originally
mined the cell, who might disconnect before the cooldown elapses).

## `getSeeds` / `setSeed` / `removeSeed`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`: planted growth-layer seeds, owned
by `growth.js` (`plantSeed`/`growSeed`/`applyGrowth`). Same
set/remove-by-id shape as `pendingTrades` above, keyed by an arbitrary
seedId the caller chooses (matches claims'/trades' own "caller owns id
generation" division of responsibility). `hooks.onSeedSet`/
`onSeedClear` mirror `onTradeSet`/`onTradeClear`, for a future Supabase
sync pass (not required for a first, local-only pass per the spec's
own section 10).

## `getOrganisms` / `setOrganism` / `removeOrganism`

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` Stage 1: heritable genomes,
same set/remove-by-id shape as seeds above — `evolution.js` owns id
generation (matches every other registry's own "caller owns id
generation" division of responsibility). `hooks.onOrganismSet`/
`onOrganismClear` mirror `onSeedSet`/`onSeedClear`, pre-wired the same
way seeds' own hooks were before their sync pass existed.

## `getPlanetoidEvolution` / `setPlanetoidEvolution`

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` Stage 6: per-planetoid
catch-up clock/rng, same set-by-key shape as organisms/seeds above.

## `toJSON`

Serializes back to the full `RHOMBIVERSE_PLAN.md` section 3 shape, for
`persistence.js` to save/export.

## `replaceAll`

Replaces the entire world in place (New World reset, JSON import).
