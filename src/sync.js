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

// Fetches every row from public.cells and public.claims, returning both
// in the same {worldName, version, cells, claims, meta} shape
// worldstate.js/persistence.js already use, so callers can pass it
// straight to createWorldStore() or world.replaceAll() with no format
// translation.
export async function loadSharedWorld() {
  const { data, error } = await supabase.from('cells').select('x,y,z,data,author_id');
  if (error) throw error;
  const cells = {};
  for (const row of data) {
    // authorId (reusing the field name already present in RHOMBIVERSE_PLAN.md
    // section 3's own schema example, just unused until now) is merged into
    // the cell's data so blackhole.js/supernova.js can enforce "never
    // consume another player's cell" purely by reading world.entries() --
    // no separate ownership lookup needed. row.author_id is the DB's own
    // auth.uid()-stamped column (schema.sql), authoritative regardless of
    // what a client ever sent.
    cells[cellKey(row.x, row.y, row.z)] = { ...row.data, authorId: row.author_id };
  }
  const claims = await loadClaims();
  const now = new Date().toISOString();
  return {
    worldName: 'Rhombiverse (Shared)',
    version: 1,
    cells,
    claims,
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
export async function pushCellUpsert(x, y, z, data) {
  const { error } = await supabase
    .from('cells')
    .upsert({ x, y, z, data, updated_at: new Date().toISOString() });
  if (error) console.warn('Rhombiverse sync: upsert failed', x, y, z, error);
}

// A delete against a cell this session didn't author is silently
// filtered to zero rows by the cells_delete_own RLS policy, not an
// error -- the real server-side backstop behind build.js/blackhole.js/
// supernova.js's own "your own cells only" client-side checks (schema.sql's
// own comment), so no special-casing is needed here for that case.
export async function pushCellDelete(x, y, z) {
  const { error } = await supabase.from('cells').delete().match({ x, y, z });
  if (error) console.warn('Rhombiverse sync: delete failed', x, y, z, error);
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

// Subscribes to realtime INSERT/UPDATE/DELETE on public.cells (enabled
// via schema.sql's `alter publication supabase_realtime add table
// public.cells`), plus INSERT/UPDATE on public.claims (no DELETE there --
// claims are never removed, only ever granted or destructible-toggled).
// Postgres
// changes broadcast to every subscriber including the client that made
// the write, so onRemoteUpsert/onRemoteDelete/onRemoteClaim WILL fire for
// this session's own pushes too -- callers must be idempotent against
// that, which worldstate.js's addCell/removeCell/addClaim already are
// (Map set/delete). Returns an unsubscribe function.
export function subscribeToSharedWorld({ onRemoteUpsert, onRemoteDelete, onRemoteClaim }) {
  const channel = supabase
    .channel('world-sync')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cells' }, (payload) => {
      const { x, y, z, data, author_id } = payload.new;
      onRemoteUpsert(x, y, z, { ...data, authorId: author_id });
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cells' }, (payload) => {
      const { x, y, z, data, author_id } = payload.new;
      onRemoteUpsert(x, y, z, { ...data, authorId: author_id });
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
    .subscribe();

  return () => supabase.removeChannel(channel);
}
