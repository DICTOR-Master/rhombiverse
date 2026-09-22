# Notes: `src/app/sync.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Phase 5 (Shared World) realtime sync backend over the `public.cells`
table (`supabase/schema.sql`) — swappable in alongside, not replacing,
`persistence.js`'s localStorage functions, per `persistence.js`'s own
header comment ("swappable for a realtime store later ... without a
schema change"). One row per lattice cell, keyed by (x,y,z), matching
`worldstate.js`'s existing `"x,y,z"` cell-key scheme.

Requires Anonymous Sign-Ins enabled on the project (`schema.sql`'s own
header note) — RLS's `cells_insert_own`/`cells_delete_own` policies key
off `auth.uid()`, which is null for an unauthenticated client.

## `ensureAnonymousSession`

Anonymous sign-in gives every client a stable `auth.uid()` for the
session (persisted across reloads via supabase-js's own localStorage
session cache) without any login UI — the RLS policies only need *a*
consistent identity per player, not a real account system, which
doesn't exist in this repo yet (see `CLAUDE.md`'s Phase 5.8 notes).

## `claimFromRow`

Row <-> in-memory claim shape, shared by `loadClaims` and the realtime
claims handler below so the mapping only lives in one place.

## `loadClaims`

Fetches every row from `public.claims` (`RHOMBIVERSE_SPEC_REGIONS.md`)
into the same `{claim_x_y_z: {...}}` shape `worldstate.js`'s claims
registry already uses.

## `regrowthEntryFromRow`

Row <-> in-memory regrowth-entry shape, shared by `loadRegrowthQueue`
and the realtime handler below.

## `loadRegrowthQueue`

Fetches every row from `public.asteroid_regrowth`
(`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4) into the same
`{"x,y,z": {...}}` shape `worldstate.js`'s regrowth queue already uses.

## `loadInventory`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 5: fetches every row from
`public.player_inventory` into the `{ownerId: {material: {quantity,
lastUsedAt}}}` shape `worldstate.js`'s inventory registry already uses.
Stockpiles are world-visible by design (`schema.sql`'s own comment on
`player_inventory_select_all`) — this pulls EVERY player's holdings,
not just the caller's, doubling as the data source for trade-partner
discovery in `render.js`'s UI.

## `loadPendingTrades`

`pending_trades_select_participant` RLS means this only ever returns
trades the calling session is actually a party to — no separate
filtering needed here, unlike inventory/cells/claims which are
world-visible.

## `seedFromRow`

Row <-> in-memory seed shape. `data` is the whole `growth.js` seed
object verbatim (species/origin/plantedAt/lastGrowthAt/generation/tiles)
— see the migration's own comment for why this is one JSONB blob rather
than typed columns (`growth.js`'s own epoch-ms timestamps don't map
cleanly onto Postgres `timestamptz`).

## `loadSeeds`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 10, closed 2026-08-13:
fetches every row from `public.seeds` into the same `{seedId: {...}}`
shape `worldstate.js`'s seeds registry already uses.

## `loadSharedWorld`

Fetches every row from `public.cells`, `public.claims`,
`public.asteroid_regrowth`, `public.player_inventory`,
`public.pending_trades`, and `public.seeds`, returning all six in the
same `{worldName, version, cells, claims, asteroidRegrowth,
playerInventory, pendingTrades, seeds, meta}` shape
`worldstate.js`/`persistence.js` already use, so callers can pass it
straight to `createWorldStore()` or `world.replaceAll()` with no format
translation.

Cell-row mapping: `authorId` (reusing the field name already present in
`RHOMBIVERSE_PLAN.md` section 3's own schema example, just unused until
now) is merged into the cell's data so `blackhole.js`/`supernova.js` can
enforce "never consume another player's cell" purely by reading
`world.entries()` — no separate ownership lookup needed. `row.author_id`
is the DB's own `auth.uid()`-stamped column (`schema.sql`), authoritative
regardless of what a client ever sent. `updatedAtMs` (epoch ms, easier
to compare than re-parsing an ISO string) drives `asteroids.js`'s
population-scaled spawning (`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 5)
— "active" there means authored/touched something recently, not raw
connection count, per `RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2's own
guidance.

## `setSyncErrorHandler`

Optional hook `render.js` registers to surface a sync failure to the
player — e.g. `schema.sql`'s `cells_rate_limit` trigger rejecting a
write. `pushCellUpsert`/`pushCellDelete` otherwise fail silently (see
their own notes below), which is normally fine but means a rate limit
hit — or any real sync problem — would previously vanish into the
console with the player none the wiser their build stopped reaching the
shared world. `render.js` debounces this itself; this module just
reports every failure, unfiltered.

## `pushCellUpsert`

`author_id` is deliberately omitted from the payload rather than set
client-side: on INSERT this lets the column default (`auth.uid()`, see
`schema.sql`) stamp the real inserting user, and on UPDATE (e.g. recolor
or hydrosphere permeation touching a cell someone else placed — both
explicitly allowed by the `cells_update_any_authenticated` policy)
supabase-js's upsert only SETs the columns actually passed, so the
original `author_id` is left alone instead of being overwritten by
whoever happened to trigger the update.

## `pushCellDelete`

A delete against a cell this session didn't author is silently filtered
to zero rows by the `cells_delete_own` RLS policy, not an error — the
real server-side backstop behind `build.js`/`blackhole.js`/
`supernova.js`'s own "your own cells only" client-side checks
(`schema.sql`'s own comment), so no special-casing is needed here for
that case.

## `pushClaim`

Grants a claim server-side (`RHOMBIVERSE_SPEC_REGIONS.md`). Geometry
(center/size/shellIndex) is permanent once granted — enforced by a real
BEFORE UPDATE trigger server-side (`supabase/schema.sql`'s
`claims_enforce_immutable_geometry`), not just by this file only ever
offering an insert here. `owner_id`/`granted_at` come from DB column
defaults (`auth.uid()`/`now()`), deliberately omitted from the payload
for the same reason `pushCellUpsert` omits `author_id` — the server,
not the client, is the source of truth for who actually made the
request. Throws (does not swallow) on failure, unlike
`pushCellUpsert`/`pushCellDelete` — a caller needs to know a claim
attempt genuinely failed (e.g. a concurrent-grant race losing to the
table's own primary key) before treating it as real, since `render.js`
applies a claim locally only after this succeeds.

## `pushClaimDestructible`

Toggles `destructible` on an EXISTING claim — the one column the
`claims_update_own` RLS policy + `claims_immutable_geometry` trigger
together allow the owner to change post-grant; any attempt to touch
geometry through this same path would be rejected server-side, not just
discouraged client-side. RLS's own `owner_id = auth.uid()` check means
this silently affects zero rows if called against a claim this session
doesn't own — callers (`render.js`) should only ever offer the toggle on
the player's own claims in the first place, but the server is the real
backstop regardless.

## `pushRegrowthSet`

Registers a mined cell for regrowth server-side
(`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4). Swallows errors like
`pushCellUpsert`/`pushCellDelete` (not thrown) — a failed regrowth
registration means that specific cell just won't come back, a
self-contained, low-stakes failure mode, not one that needs to unwind
the mining action itself (the cell is already gone locally and via
`pushCellDelete` by this point).

## `pushRegrowthClear`

Clears a regrowth entry once processed (cell re-added) — or if a player
has since built something else there (`asteroids.js`'s own "never
overwrite real content" check already prevented the regrow itself; this
still needs to clear the now-stale queue entry). Deleting an
already-deleted row is a silent no-op, not an error, which is exactly
what makes multiple clients racing to process the same entry safe (see
`supabase/schema.sql`'s own comment on this table).

## `pushSeedSet`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 10, closed 2026-08-13:
upserts a seed's current state (covers both the initial plant AND every
later growth tick — same single-upsert-covers-insert-and-update pattern
as `pushCellUpsert`). `owner_id` deliberately omitted from the payload,
same reasoning as `author_id` on cells: the column default stamps the
real planter on insert, and any later update (a growth tick from a
DIFFERENT connected client — see `seeds_update_any_authenticated` in
`schema.sql`) leaves the original `owner_id` alone since supabase-js's
upsert only SETs columns actually passed. Swallows errors rather than
throwing, same as `pushRegrowthSet` — a failed sync means that one
growth tick just doesn't reach other players this round, not something
that needs to unwind the local growth step already applied.

`updated_at` is explicitly set on every call, same as `pushCellUpsert` —
the column's own `default now()` only applies on INSERT, not on an
UPDATE via upsert, so a growth tick without this would silently leave
`updated_at` stuck at the seed's original plant time (caught live,
2026-08-13: generation/tiles updated correctly but `updated_at` didn't
move).

## `pushSeedClear`

Not currently called by any code path (nothing removes a seed yet),
included for symmetry with `pushRegrowthClear` and `worldstate.js`'s own
`onSeedClear` hook, which already existed in anticipation of this pass.

## `mineAsteroidCellRemote`

`RHOMBIVERSE_SPEC_ASTEROIDS.md` mining, made server-authoritative for
Shared World (unlike a cell placement, an inventory credit is a
currency-like resource — a naive "trust whatever material/amount the
client sends" upsert would trivially break the barter economy). Calls
`schema.sql`'s `mine_asteroid_cell` RPC, which re-reads the real cell
server-side (never trusts a client-supplied material) before deleting
it, queuing regrowth, and crediting exactly 1 of the SERVER-verified
material — all in one atomic transaction. Deliberately non-optimistic
unlike every other cell removal in this app: the cell only disappears
locally once the resulting realtime DELETE echoes back
(`applyRemoteDelete` in `render.js`), not on click — a real-but-small UX
tradeoff for correctness on the one thing here that's actually a
currency. Swallows errors like `pushCellUpsert`/`pushCellDelete` (a race
against another player mining the same rock, or a rate-limit hit, both
surface via `syncErrorHandler` rather than throwing).

## `pushTradePropose`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 3, proposer's side: the
caller is always `player_a` (`pending_trades_insert_as_proposer` RLS
requires it), specifying both offers up front — matches `trade.js`'s own
`proposeTrade` signature/semantics exactly, just server-backed. Throws
(does not swallow) — `render.js`'s UI needs to know a proposal genuinely
failed (e.g. the partner ID doesn't exist, or a stale duplicate trade
id) rather than silently doing nothing.

## `pushTradeConfirm`

Flips exactly one side's confirmation — `schema.sql`'s
`pending_trades_enforce_confirm_only` trigger is the real guarantee
that a caller can only ever move their OWN side (this just picks the
right column to send; RLS/the trigger would reject a wrong one
regardless). If this is the second confirmation, `schema.sql`'s
`pending_trades_resolve` trigger fires the atomic swap server-side
before this call even returns — the resulting inventory/trade-row
changes arrive back via realtime, not from this function's own return
value.

## `pushTradeCancel`

Either party can cancel/reject a still-pending trade (RLS: either
participant). A no-op if it already resolved or was already cancelled —
matches `pushRegrowthClear`'s own "deleting an already-gone row is a
silent no-op" reasoning.

## `subscribeToSharedWorld`

Subscribes to realtime INSERT/UPDATE/DELETE on `public.cells` (enabled
via `schema.sql`'s `alter publication supabase_realtime add table
public.cells`), INSERT/UPDATE on `public.claims` (no DELETE there —
claims are never removed, only ever granted or destructible-toggled),
and INSERT/DELETE on `public.asteroid_regrowth` (no UPDATE there — an
entry is either pending or gone, never modified in place). Postgres
changes broadcast to every subscriber including the client that made
the write, so `onRemoteUpsert`/`onRemoteDelete`/`onRemoteClaim`/
`onRemoteRegrowthSet`/`onRemoteRegrowthClear` WILL fire for this
session's own pushes too — callers must be idempotent against that,
which `worldstate.js`'s `addCell`/`removeCell`/`addClaim`/
`setRegrowthEntry`/`removeRegrowthEntry` already are (Map set/delete).
Returns an unsubscribe function.

Per-handler notes:
- cells DELETE: needs `schema.sql`'s `replica identity full` — without
  it, a DELETE payload's `old` only contains the primary key by
  default, which happens to be (x,y,z) here anyway, but full replica
  identity is what `schema.sql`'s own comment documents as the reason
  this is guaranteed to be populated.
- `asteroid_regrowth` DELETE: needs replica identity full (`schema.sql`),
  same reason as cells' own DELETE handler above.
- `player_inventory`: INSERT/UPDATE only — a row's quantity can hit 0
  (fully spent) but this schema never deletes a row, only zeroes it, so
  no DELETE handler is needed here. Every quantity change this session
  cares about (mining credits, trade resolution, periodic decay) flows
  through this same channel regardless of cause.
- `pending_trades`: `pending_trades_select_participant` RLS means this
  session only ever receives INSERT/UPDATE for trades it's actually a
  party to. DELETE covers both cancellation AND the resolution
  trigger's own cleanup (`schema.sql`'s `resolve_trade_if_ready` deletes
  the row once both sides confirm) — the client can't tell those two
  apart from the DELETE event alone, but doesn't need to: either way
  the trade is simply gone, and the resulting inventory change (if any)
  arrives separately via the `player_inventory` channel above. DELETE
  also needs replica identity full (`schema.sql`), same reason as
  cells' own DELETE handler.
- `seeds`: INSERT covers the initial plant, UPDATE covers every later
  growth tick (from any connected client, not just the original
  planter — see `seeds_update_any_authenticated` in `schema.sql`) —
  both handled identically, same as claims' own INSERT+UPDATE above.

## `publishToGallery` / `fetchGalleryWorlds` / `fetchGalleryWorldData`

B6's public gallery (`schema.sql`'s `shared_worlds` table — run that
migration once before these will work; requires the same Anonymous
Sign-Ins setup Phase 5's own header already documents). No realtime
subscription here — a gallery is browsed on demand
(`fetchGalleryWorlds`), not a live feed like cells/claims/trades.

## `subscribeToPresence` / `updatePresence`

B6 task #42: lightweight pseudonymous player presence (display name +
live position) for Shared World mode. Deliberately NOT a database table
or row — Supabase Realtime's own Presence feature is ephemeral,
per-connection state built exactly for "who's online and where," which
none of this file's decay/persistence concerns (cells, inventory,
trades) apply to. No migration needed for this one.

`updatePresence` is fire-and-forget by design (matches this module's
other `push*` functions' "swallow, don't block gameplay on a flaky
connection" convention) — called every frame-ish while walking, so a
single dropped update is meaningless as long as the next one gets
through.
