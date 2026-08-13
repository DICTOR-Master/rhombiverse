// Phase 5 (Shared World) realtime sync backend over the `public.cells`
// table (supabase/schema.sql) -- swappable in alongside, not replacing,
// persistence.js's localStorage functions, per persistence.js's own
// header comment ("swappable for a realtime store later ... without a
// schema change"). One row per lattice cell, keyed by (x,y,z), matching
// worldstate.js's existing "x,y,z" cell-key scheme.
//
// Requires Anonymous Sign-Ins enabled on the project (schema.sql's own
// header note) -- RLS's cells_insert_own/cells_delete_own policies key
// off auth.uid(), which is null for an unauthenticated client.
import { createClient } from '@supabase/supabase-js';
import { cellKey } from './lattice.js';

const SUPABASE_URL = 'https://zuvlqvvxifuzumqeyuir.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Na_sq5Pe7VGObNCw5MnLcg_ZfWEhcJP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Anonymous sign-in gives every client a stable auth.uid() for the
// session (persisted across reloads via supabase-js's own localStorage
// session cache) without any login UI -- the RLS policies only need
// *a* consistent identity per player, not a real account system, which
// doesn't exist in this repo yet (see CLAUDE.md's Phase 5.8 notes).
export async function ensureAnonymousSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

// Row <-> in-memory claim shape, shared by loadClaims and the realtime
// claims handler below so the mapping only lives in one place.
function claimFromRow(row) {
  return {
    ownerId: row.owner_id,
    shellIndex: row.shell_index,
    center: [row.center_x, row.center_y, row.center_z],
    size: row.size,
    destructible: row.destructible,
    grantedAt: row.granted_at,
  };
}

// Fetches every row from public.claims (RHOMBIVERSE_SPEC_REGIONS.md) into
// the same {claim_x_y_z: {...}} shape worldstate.js's claims registry
// already uses.
export async function loadClaims() {
  const { data, error } = await supabase.from('claims').select('*');
  if (error) throw error;
  const claims = {};
  for (const row of data) claims[row.id] = claimFromRow(row);
  return claims;
}

// Row <-> in-memory regrowth-entry shape, shared by loadRegrowthQueue and
// the realtime handler below.
function regrowthEntryFromRow(row) {
  return {
    nodeId: row.node_id,
    material: row.material,
    minedAt: new Date(row.mined_at).getTime(),
  };
}

// Fetches every row from public.asteroid_regrowth (RHOMBIVERSE_SPEC_
// ASTEROIDS.md section 4) into the same {"x,y,z": {...}} shape
// worldstate.js's regrowth queue already uses.
export async function loadRegrowthQueue() {
  const { data, error } = await supabase.from('asteroid_regrowth').select('*');
  if (error) throw error;
  const queue = {};
  for (const row of data) queue[cellKey(row.x, row.y, row.z)] = regrowthEntryFromRow(row);
  return queue;
}

// RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 5: fetches every row from
// public.player_inventory into the {ownerId: {material: {quantity,
// lastUsedAt}}} shape worldstate.js's inventory registry already uses.
// Stockpiles are world-visible by design (schema.sql's own comment on
// player_inventory_select_all) -- this pulls EVERY player's holdings,
// not just the caller's, doubling as the data source for trade-partner
// discovery in render.js's UI.
export async function loadInventory() {
  const { data, error } = await supabase.from('player_inventory').select('owner_id,material,quantity,last_used_at');
  if (error) throw error;
  const inventory = {};
  for (const row of data) {
    inventory[row.owner_id] = {
      ...inventory[row.owner_id],
      [row.material]: { quantity: Number(row.quantity), lastUsedAt: new Date(row.last_used_at).getTime() },
    };
  }
  return inventory;
}

function tradeFromRow(row) {
  return {
    playerA: row.player_a,
    offerA: row.offer_a,
    playerB: row.player_b,
    offerB: row.offer_b,
    confirmedA: row.confirmed_a,
    confirmedB: row.confirmed_b,
  };
}

// pending_trades_select_participant RLS means this only ever returns
// trades the calling session is actually a party to -- no separate
// filtering needed here, unlike inventory/cells/claims which are
// world-visible.
export async function loadPendingTrades() {
  const { data, error } = await supabase.from('pending_trades').select('*');
  if (error) throw error;
  const trades = {};
  for (const row of data) trades[row.id] = tradeFromRow(row);
  return trades;
}

// Row <-> in-memory seed shape. `data` is the whole growth.js seed object
// verbatim (species/origin/plantedAt/lastGrowthAt/generation/tiles) --
// see the migration's own comment for why this is one JSONB blob rather
// than typed columns (growth.js's own epoch-ms timestamps don't map
// cleanly onto Postgres timestamptz).
function seedFromRow(row) {
  return row.data;
}

// RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 10, closed 2026-08-13:
// fetches every row from public.seeds into the same {seedId: {...}}
// shape worldstate.js's seeds registry already uses.
export async function loadSeeds() {
  const { data, error } = await supabase.from('seeds').select('id,data');
  if (error) throw error;
  const seeds = {};
  for (const row of data) seeds[row.id] = seedFromRow(row);
  return seeds;
}

// Fetches every row from public.cells, public.claims,
// public.asteroid_regrowth, public.player_inventory,
// public.pending_trades, and public.seeds, returning all six in the same
// {worldName, version, cells, claims, asteroidRegrowth, playerInventory,
// pendingTrades, seeds, meta} shape worldstate.js/persistence.js already
// use, so callers can pass it straight to createWorldStore() or
// world.replaceAll() with no format translation.
export async function loadSharedWorld() {
  const { data, error } = await supabase.from('cells').select('x,y,z,data,author_id,updated_at');
  if (error) throw error;
  const cells = {};
  for (const row of data) {
    // authorId (reusing the field name already present in RHOMBIVERSE_PLAN.md
    // section 3's own schema example, just unused until now) is merged into
    // the cell's data so blackhole.js/supernova.js can enforce "never
    // consume another player's cell" purely by reading world.entries() --
    // no separate ownership lookup needed. row.author_id is the DB's own
    // auth.uid()-stamped column (schema.sql), authoritative regardless of
    // what a client ever sent. updatedAtMs (epoch ms, easier to compare
    // than re-parsing an ISO string) drives asteroids.js's population-
    // scaled spawning (RHOMBIVERSE_SPEC_ASTEROIDS.md section 5) -- "active"
    // there means authored/touched something recently, not raw connection
    // count, per RHOMBIVERSE_SPEC_LOOPHOLES.md section 2's own guidance.
    cells[cellKey(row.x, row.y, row.z)] = {
      ...row.data,
      authorId: row.author_id,
      updatedAtMs: new Date(row.updated_at).getTime(),
    };
  }
  const claims = await loadClaims();
  const asteroidRegrowth = await loadRegrowthQueue();
  const playerInventory = await loadInventory();
  const pendingTrades = await loadPendingTrades();
  const seeds = await loadSeeds();
  const now = new Date().toISOString();
  return {
    worldName: 'Rhombiverse (Shared)',
    version: 1,
    cells,
    claims,
    asteroidRegrowth,
    playerInventory,
    pendingTrades,
    seeds,
    meta: { createdAt: now, lastModified: now },
  };
}

// Upserts one cell's current data. author_id is deliberately omitted
// from the payload rather than set client-side: on INSERT this lets the
// column default (`auth.uid()`, see schema.sql) stamp the real inserting
// user, and on UPDATE (e.g. recolor or hydrosphere permeation touching a
// cell someone else placed -- both explicitly allowed by the
// cells_update_any_authenticated policy) supabase-js's upsert only SETs
// the columns actually passed, so the original author_id is left alone
// instead of being overwritten by whoever happened to trigger the update.
// Optional hook render.js registers to surface a sync failure to the
// player -- e.g. schema.sql's cells_rate_limit trigger rejecting a
// write. pushCellUpsert/pushCellDelete otherwise fail silently (see
// their own comments below), which is normally fine but means a rate
// limit hit -- or any real sync problem -- would previously vanish into
// the console with the player none the wiser their build stopped
// reaching the shared world. render.js debounces this itself; this
// module just reports every failure, unfiltered.
let syncErrorHandler = null;
export function setSyncErrorHandler(fn) {
  syncErrorHandler = fn;
}

export async function pushCellUpsert(x, y, z, data) {
  const { error } = await supabase
    .from('cells')
    .upsert({ x, y, z, data, updated_at: new Date().toISOString() });
  if (error) {
    console.warn('Rhombiverse sync: upsert failed', x, y, z, error);
    syncErrorHandler?.(error);
  }
}

// A delete against a cell this session didn't author is silently
// filtered to zero rows by the cells_delete_own RLS policy, not an
// error -- the real server-side backstop behind build.js/blackhole.js/
// supernova.js's own "your own cells only" client-side checks (schema.sql's
// own comment), so no special-casing is needed here for that case.
export async function pushCellDelete(x, y, z) {
  const { error } = await supabase.from('cells').delete().match({ x, y, z });
  if (error) {
    console.warn('Rhombiverse sync: delete failed', x, y, z, error);
    syncErrorHandler?.(error);
  }
}

// Grants a claim server-side (RHOMBIVERSE_SPEC_REGIONS.md). Geometry
// (center/size/shellIndex) is permanent once granted -- enforced by a
// real BEFORE UPDATE trigger server-side (supabase/schema.sql's
// claims_enforce_immutable_geometry), not just by this file only ever
// offering an insert here. owner_id/granted_at come from DB column
// defaults (auth.uid()/now()), deliberately omitted from the payload for
// the same reason pushCellUpsert omits author_id -- the server, not the
// client, is the source of truth for who actually made the request.
// Throws (does not swallow) on failure, unlike pushCellUpsert/
// pushCellDelete -- a caller needs to know a claim attempt genuinely
// failed (e.g. a concurrent-grant race losing to the table's own primary
// key) before treating it as real, since render.js applies a claim
// locally only after this succeeds.
export async function pushClaim(claimId, claimData) {
  const [cx, cy, cz] = claimData.center;
  const { error } = await supabase.from('claims').insert({
    id: claimId,
    shell_index: claimData.shellIndex,
    center_x: cx,
    center_y: cy,
    center_z: cz,
    size: claimData.size,
    destructible: claimData.destructible,
  });
  if (error) throw error;
}

// Toggles destructible on an EXISTING claim -- the one column the
// claims_update_own RLS policy + claims_immutable_geometry trigger
// together allow the owner to change post-grant; any attempt to touch
// geometry through this same path would be rejected server-side, not
// just discouraged client-side. RLS's own `owner_id = auth.uid()` check
// means this silently affects zero rows if called against a claim this
// session doesn't own -- callers (render.js) should only ever offer the
// toggle on the player's own claims in the first place, but the server
// is the real backstop regardless.
export async function pushClaimDestructible(claimId, destructible) {
  const { error } = await supabase.from('claims').update({ destructible }).eq('id', claimId);
  if (error) throw error;
}

// Registers a mined cell for regrowth server-side (RHOMBIVERSE_SPEC_
// ASTEROIDS.md section 4). Swallows errors like pushCellUpsert/
// pushCellDelete (not thrown) -- a failed regrowth registration means
// that specific cell just won't come back, a self-contained, low-stakes
// failure mode, not one that needs to unwind the mining action itself
// (the cell is already gone locally and via pushCellDelete by this point).
export async function pushRegrowthSet(x, y, z, entry) {
  const { error } = await supabase.from('asteroid_regrowth').upsert({
    x,
    y,
    z,
    node_id: entry.nodeId,
    material: entry.material,
    mined_at: new Date(entry.minedAt).toISOString(),
  });
  if (error) console.warn('Rhombiverse sync: regrowth registration failed', x, y, z, error);
}

// Clears a regrowth entry once processed (cell re-added) -- or if a
// player has since built something else there (asteroids.js's own
// "never overwrite real content" check already prevented the regrow
// itself; this still needs to clear the now-stale queue entry). Deleting
// an already-deleted row is a silent no-op, not an error, which is
// exactly what makes multiple clients racing to process the same entry
// safe (see supabase/schema.sql's own comment on this table).
export async function pushRegrowthClear(x, y, z) {
  const { error } = await supabase.from('asteroid_regrowth').delete().match({ x, y, z });
  if (error) console.warn('Rhombiverse sync: regrowth clear failed', x, y, z, error);
}

// RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 10, closed 2026-08-13:
// upserts a seed's current state (covers both the initial plant AND
// every later growth tick -- same single-upsert-covers-insert-and-update
// pattern as pushCellUpsert). owner_id deliberately omitted from the
// payload, same reasoning as author_id on cells: the column default
// stamps the real planter on insert, and any later update (a growth tick
// from a DIFFERENT connected client -- see seeds_update_any_authenticated
// in schema.sql) leaves the original owner_id alone since supabase-js's
// upsert only SETs columns actually passed. Swallows errors rather than
// throwing, same as pushRegrowthSet -- a failed sync means that one
// growth tick just doesn't reach other players this round, not something
// that needs to unwind the local growth step already applied.
export async function pushSeedSet(seedId, seedData) {
  const { error } = await supabase.from('seeds').upsert({ id: seedId, data: seedData });
  if (error) console.warn('Rhombiverse sync: seed upsert failed', seedId, error);
}

// Not currently called by any code path (nothing removes a seed yet),
// included for symmetry with pushRegrowthClear and worldstate.js's own
// onSeedClear hook, which already existed in anticipation of this pass.
export async function pushSeedClear(seedId) {
  const { error } = await supabase.from('seeds').delete().match({ id: seedId });
  if (error) console.warn('Rhombiverse sync: seed clear failed', seedId, error);
}

// RHOMBIVERSE_SPEC_ASTEROIDS.md mining, made server-authoritative for
// Shared World (unlike a cell placement, an inventory credit is a
// currency-like resource -- a naive "trust whatever material/amount the
// client sends" upsert would trivially break the barter economy). Calls
// schema.sql's mine_asteroid_cell RPC, which re-reads the real cell
// server-side (never trusts a client-supplied material) before deleting
// it, queuing regrowth, and crediting exactly 1 of the SERVER-verified
// material -- all in one atomic transaction. Deliberately non-optimistic
// unlike every other cell removal in this app: the cell only disappears
// locally once the resulting realtime DELETE echoes back (applyRemoteDelete
// in render.js), not on click -- a real-but-small UX tradeoff for
// correctness on the one thing here that's actually a currency. Swallows
// errors like pushCellUpsert/pushCellDelete (a race against another
// player mining the same rock, or a rate-limit hit, both surface via
// syncErrorHandler rather than throwing).
export async function mineAsteroidCellRemote(x, y, z) {
  const { data, error } = await supabase.rpc('mine_asteroid_cell', { mx: x, my: y, mz: z });
  if (error) {
    console.warn('Rhombiverse sync: remote mining failed', x, y, z, error);
    syncErrorHandler?.(error);
    return null;
  }
  return data;
}

// RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 3, proposer's side: the
// caller is always player_a (pending_trades_insert_as_proposer RLS
// requires it), specifying both offers up front -- matches trade.js's
// own proposeTrade signature/semantics exactly, just server-backed.
// Throws (does not swallow) -- render.js's UI needs to know a proposal
// genuinely failed (e.g. the partner ID doesn't exist, or a stale
// duplicate trade id) rather than silently doing nothing.
export async function pushTradePropose(tradeId, playerA, offerA, playerB, offerB) {
  const { error } = await supabase.from('pending_trades').insert({
    id: tradeId,
    player_a: playerA,
    offer_a: offerA,
    player_b: playerB,
    offer_b: offerB,
  });
  if (error) throw error;
}

// Flips exactly one side's confirmation -- schema.sql's
// pending_trades_enforce_confirm_only trigger is the real guarantee
// that a caller can only ever move their OWN side (this just picks the
// right column to send; RLS/the trigger would reject a wrong one
// regardless). If this is the second confirmation, schema.sql's
// pending_trades_resolve trigger fires the atomic swap server-side
// before this call even returns -- the resulting inventory/trade-row
// changes arrive back via realtime, not from this function's own
// return value.
export async function pushTradeConfirm(tradeId, isPlayerA) {
  const column = isPlayerA ? 'confirmed_a' : 'confirmed_b';
  const { error } = await supabase.from('pending_trades').update({ [column]: true }).eq('id', tradeId);
  if (error) throw error;
}

// Either party can cancel/reject a still-pending trade (RLS: either
// participant). A no-op if it already resolved or was already cancelled
// -- matches pushRegrowthClear's own "deleting an already-gone row is a
// silent no-op" reasoning.
export async function pushTradeCancel(tradeId) {
  const { error } = await supabase.from('pending_trades').delete().eq('id', tradeId);
  if (error) console.warn('Rhombiverse sync: trade cancel failed', tradeId, error);
}

// Subscribes to realtime INSERT/UPDATE/DELETE on public.cells (enabled
// via schema.sql's `alter publication supabase_realtime add table
// public.cells`), INSERT/UPDATE on public.claims (no DELETE there --
// claims are never removed, only ever granted or destructible-toggled),
// and INSERT/DELETE on public.asteroid_regrowth (no UPDATE there -- an
// entry is either pending or gone, never modified in place). Postgres
// changes broadcast to every subscriber including the client that made
// the write, so onRemoteUpsert/onRemoteDelete/onRemoteClaim/
// onRemoteRegrowthSet/onRemoteRegrowthClear WILL fire for this session's
// own pushes too -- callers must be idempotent against that, which
// worldstate.js's addCell/removeCell/addClaim/setRegrowthEntry/
// removeRegrowthEntry already are (Map set/delete). Returns an
// unsubscribe function.
export function subscribeToSharedWorld({
  onRemoteUpsert,
  onRemoteDelete,
  onRemoteClaim,
  onRemoteRegrowthSet,
  onRemoteRegrowthClear,
  onRemoteInventory,
  onRemoteTrade,
  onRemoteTradeClear,
  onRemoteSeedSet,
  onRemoteSeedClear,
}) {
  const channel = supabase
    .channel('world-sync')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cells' }, (payload) => {
      const { x, y, z, data, author_id, updated_at } = payload.new;
      onRemoteUpsert(x, y, z, { ...data, authorId: author_id, updatedAtMs: new Date(updated_at).getTime() });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cells' }, (payload) => {
      const { x, y, z, data, author_id, updated_at } = payload.new;
      onRemoteUpsert(x, y, z, { ...data, authorId: author_id, updatedAtMs: new Date(updated_at).getTime() });
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cells' }, (payload) => {
      // Needs schema.sql's `replica identity full` -- without it, a
      // DELETE payload's `old` only contains the primary key by default,
      // which happens to be (x,y,z) here anyway, but full replica
      // identity is what schema.sql's own comment documents as the
      // reason this is guaranteed to be populated.
      const { x, y, z } = payload.old;
      onRemoteDelete(x, y, z);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'claims' }, (payload) => {
      if (!onRemoteClaim) return;
      onRemoteClaim(payload.new.id, claimFromRow(payload.new));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'claims' }, (payload) => {
      if (!onRemoteClaim) return;
      onRemoteClaim(payload.new.id, claimFromRow(payload.new));
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asteroid_regrowth' }, (payload) => {
      if (!onRemoteRegrowthSet) return;
      const row = payload.new;
      onRemoteRegrowthSet(cellKey(row.x, row.y, row.z), regrowthEntryFromRow(row));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'asteroid_regrowth' }, (payload) => {
      if (!onRemoteRegrowthClear) return;
      // Needs replica identity full (schema.sql), same reason as cells'
      // own DELETE handler above.
      const row = payload.old;
      onRemoteRegrowthClear(cellKey(row.x, row.y, row.z));
    })
    // player_inventory: INSERT/UPDATE only -- a row's quantity can hit 0
    // (fully spent) but this schema never deletes a row, only zeroes it,
    // so no DELETE handler is needed here. Every quantity change this
    // session cares about (mining credits, trade resolution, periodic
    // decay) flows through this same channel regardless of cause.
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_inventory' }, (payload) => {
      if (!onRemoteInventory) return;
      const row = payload.new;
      onRemoteInventory(row.owner_id, row.material, { quantity: Number(row.quantity), lastUsedAt: new Date(row.last_used_at).getTime() });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'player_inventory' }, (payload) => {
      if (!onRemoteInventory) return;
      const row = payload.new;
      onRemoteInventory(row.owner_id, row.material, { quantity: Number(row.quantity), lastUsedAt: new Date(row.last_used_at).getTime() });
    })
    // pending_trades: pending_trades_select_participant RLS means this
    // session only ever receives INSERT/UPDATE for trades it's actually
    // a party to. DELETE covers both cancellation AND the resolution
    // trigger's own cleanup (schema.sql's resolve_trade_if_ready deletes
    // the row once both sides confirm) -- the client can't tell those
    // two apart from the DELETE event alone, but doesn't need to: either
    // way the trade is simply gone, and the resulting inventory change
    // (if any) arrives separately via the player_inventory channel above.
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pending_trades' }, (payload) => {
      if (!onRemoteTrade) return;
      onRemoteTrade(payload.new.id, tradeFromRow(payload.new));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pending_trades' }, (payload) => {
      if (!onRemoteTrade) return;
      onRemoteTrade(payload.new.id, tradeFromRow(payload.new));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pending_trades' }, (payload) => {
      if (!onRemoteTradeClear) return;
      // Needs replica identity full (schema.sql), same reason as cells'
      // own DELETE handler.
      onRemoteTradeClear(payload.old.id);
    })
    // seeds: INSERT covers the initial plant, UPDATE covers every later
    // growth tick (from any connected client, not just the original
    // planter -- see seeds_update_any_authenticated in schema.sql) --
    // both handled identically, same as claims' own INSERT+UPDATE above.
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'seeds' }, (payload) => {
      if (!onRemoteSeedSet) return;
      onRemoteSeedSet(payload.new.id, seedFromRow(payload.new));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seeds' }, (payload) => {
      if (!onRemoteSeedSet) return;
      onRemoteSeedSet(payload.new.id, seedFromRow(payload.new));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'seeds' }, (payload) => {
      if (!onRemoteSeedClear) return;
      onRemoteSeedClear(payload.old.id);
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}
