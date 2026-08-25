// Phase 5 (Shared World) realtime sync backend over the `public.cells`
// table (supabase/schema.sql). Requires Anonymous Sign-Ins enabled on
// the project. Full design rationale/history for every export below:
// docs/code-notes/app/sync.md
import { createClient } from '@supabase/supabase-js';
import { cellKey } from '../core/lattice.js';

const SUPABASE_URL = 'https://zuvlqvvxifuzumqeyuir.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Na_sq5Pe7VGObNCw5MnLcg_ZfWEhcJP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function ensureAnonymousSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

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

export async function loadClaims() {
  const { data, error } = await supabase.from('claims').select('*');
  if (error) throw error;
  const claims = {};
  for (const row of data) claims[row.id] = claimFromRow(row);
  return claims;
}

function regrowthEntryFromRow(row) {
  return {
    nodeId: row.node_id,
    material: row.material,
    minedAt: new Date(row.mined_at).getTime(),
  };
}

export async function loadRegrowthQueue() {
  const { data, error } = await supabase.from('asteroid_regrowth').select('*');
  if (error) throw error;
  const queue = {};
  for (const row of data) queue[cellKey(row.x, row.y, row.z)] = regrowthEntryFromRow(row);
  return queue;
}

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

export async function loadPendingTrades() {
  const { data, error } = await supabase.from('pending_trades').select('*');
  if (error) throw error;
  const trades = {};
  for (const row of data) trades[row.id] = tradeFromRow(row);
  return trades;
}

function seedFromRow(row) {
  return row.data;
}

export async function loadSeeds() {
  const { data, error } = await supabase.from('seeds').select('id,data');
  if (error) throw error;
  const seeds = {};
  for (const row of data) seeds[row.id] = seedFromRow(row);
  return seeds;
}

export async function loadSharedWorld() {
  const { data, error } = await supabase.from('cells').select('x,y,z,data,author_id,updated_at');
  if (error) throw error;
  const cells = {};
  for (const row of data) {
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

export async function pushCellDelete(x, y, z) {
  const { error } = await supabase.from('cells').delete().match({ x, y, z });
  if (error) {
    console.warn('Rhombiverse sync: delete failed', x, y, z, error);
    syncErrorHandler?.(error);
  }
}

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

export async function pushClaimDestructible(claimId, destructible) {
  const { error } = await supabase.from('claims').update({ destructible }).eq('id', claimId);
  if (error) throw error;
}

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

export async function pushRegrowthClear(x, y, z) {
  const { error } = await supabase.from('asteroid_regrowth').delete().match({ x, y, z });
  if (error) console.warn('Rhombiverse sync: regrowth clear failed', x, y, z, error);
}

export async function pushSeedSet(seedId, seedData) {
  const { error } = await supabase
    .from('seeds')
    .upsert({ id: seedId, data: seedData, updated_at: new Date().toISOString() });
  if (error) console.warn('Rhombiverse sync: seed upsert failed', seedId, error);
}

export async function pushSeedClear(seedId) {
  const { error } = await supabase.from('seeds').delete().match({ id: seedId });
  if (error) console.warn('Rhombiverse sync: seed clear failed', seedId, error);
}

export async function mineAsteroidCellRemote(x, y, z) {
  const { data, error } = await supabase.rpc('mine_asteroid_cell', { mx: x, my: y, mz: z });
  if (error) {
    console.warn('Rhombiverse sync: remote mining failed', x, y, z, error);
    syncErrorHandler?.(error);
    return null;
  }
  return data;
}

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

export async function pushTradeConfirm(tradeId, isPlayerA) {
  const column = isPlayerA ? 'confirmed_a' : 'confirmed_b';
  const { error } = await supabase.from('pending_trades').update({ [column]: true }).eq('id', tradeId);
  if (error) throw error;
}

export async function pushTradeCancel(tradeId) {
  const { error } = await supabase.from('pending_trades').delete().eq('id', tradeId);
  if (error) console.warn('Rhombiverse sync: trade cancel failed', tradeId, error);
}

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
      const row = payload.old;
      onRemoteRegrowthClear(cellKey(row.x, row.y, row.z));
    })
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
      onRemoteTradeClear(payload.old.id);
    })
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

export async function publishToGallery(title, worldData, thumbnail) {
  const { data, error } = await supabase
    .from('shared_worlds')
    .insert({ title, world_data: worldData, thumbnail })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchGalleryWorlds(limit = 30) {
  const { data, error } = await supabase
    .from('shared_worlds')
    .select('id, title, thumbnail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchGalleryWorldData(id) {
  const { data, error } = await supabase.from('shared_worlds').select('world_data').eq('id', id).single();
  if (error) throw error;
  return data.world_data;
}

let presenceChannel = null;

export function subscribeToPresence(userId, initialPayload, onSync) {
  presenceChannel = supabase.channel('world-presence', {
    config: { presence: { key: userId } },
  });
  presenceChannel.on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    const others = {};
    for (const [key, entries] of Object.entries(state)) {
      if (key === userId || entries.length === 0) continue;
      others[key] = entries[entries.length - 1];
    }
    onSync(others);
  });
  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await presenceChannel.track(initialPayload);
  });
  return () => {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  };
}

export function updatePresence(payload) {
  presenceChannel?.track(payload).catch(() => {});
}
