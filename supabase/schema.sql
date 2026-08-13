-- Rhombiverse Phase 5 (Shared World) schema.
-- Run this once in the Supabase SQL Editor for the project this app
-- points at (src/sync.js). Also requires enabling Anonymous Sign-Ins:
-- Dashboard -> Authentication -> Sign In / Providers -> Anonymous.
--
-- One row per lattice cell, keyed by its own (x,y,z) coordinate --
-- mirrors worldstate.js's existing "x,y,z" cell-key scheme exactly, per
-- RHOMBIVERSE_PLAN.md section 3's "no schema change needed" for Phase 5.
-- `data` holds everything worldstate.js already stores per cell
-- (material, shell, shellCenter, hydrospherePermeated, blackHoleLedger,
-- starLedger, generatedByBlackHole, generatorType, destructible, etc.)
-- as one JSONB blob rather than a column per possible field -- matches
-- the project's own "world is data, additive schema" golden rule
-- (RHOMBIVERSE_PLAN.md section 0): a new mechanic's new per-cell field
-- never needs a migration here.
create table public.cells (
  x integer not null,
  y integer not null,
  z integer not null,
  data jsonb not null,
  author_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (x, y, z)
);

alter table public.cells enable row level security;
-- Needed so UPDATE/DELETE realtime payloads include the old row values
-- (sync.js's onDelete handler needs the deleted row's x,y,z).
alter table public.cells replica identity full;

-- Anyone can see the shared world.
create policy "cells_select_all" on public.cells
  for select using (true);

-- You can only ever insert cells as yourself -- RLS makes author
-- impersonation on insert impossible regardless of client-side bugs.
create policy "cells_insert_own" on public.cells
  for insert with check (author_id = auth.uid());

-- Broad on purpose: recolor and hydrosphere permeation both need to be
-- able to update a cell placed by a different author (see CLAUDE.md's
-- Phase 5 entry for the full reasoning -- both are deliberately NOT
-- restricted to "your own cells only", unlike delete below).
create policy "cells_update_any_authenticated" on public.cells
  for update using (auth.role() = 'authenticated');

-- Only the original placer can remove their own cell (right-click /
-- Round / Excavate, and Black Hole/Supernova consumption of FOREIGN
-- matter -- both explicitly restricted to "your own cells only" per
-- direct instruction). This is the real server-side backstop behind
-- the matching client-side ownership checks in build.js/blackhole.js/
-- supernova.js -- without it, a buggy or malicious client could still
-- delete someone else's cell.
create policy "cells_delete_own" on public.cells
  for delete using (author_id = auth.uid());

alter publication supabase_realtime add table public.cells;

-- RHOMBIVERSE_SPEC_REGIONS.md: ownership claims, synced across sessions.
-- INSERT-only by design -- no update/delete RLS policy at all, which
-- hard-enforces section 2's "no claim is ever resized, moved, or shrunk
-- after being granted" at the database level, not just in application
-- code. `id` is the claim's own center coordinate ("claim_x_y_z"),
-- computed client-side by regions.js's allocateClaim -- deterministic
-- and collision-free by construction (a candidate center is only ever
-- chosen once its own footprint is confirmed free of every existing
-- claim), and doubles as the primary key so a genuine concurrent-grant
-- race (two sessions computing the same free slot before either has
-- synced) fails loudly via a unique-constraint violation rather than
-- silently double-granting the same land.
create table public.claims (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  shell_index integer not null,
  center_x integer not null,
  center_y integer not null,
  center_z integer not null,
  size text not null,
  destructible boolean not null default false,
  granted_at timestamptz not null default now()
);

alter table public.claims enable row level security;

-- Everyone needs to see everyone's claims -- blackhole.js/supernova.js's
-- isClaimProtected() check has to work regardless of who's black hole is
-- evaluating it.
create policy "claims_select_all" on public.claims
  for select using (true);

-- You can only ever grant a claim as yourself.
create policy "claims_insert_own" on public.claims
  for insert with check (owner_id = auth.uid());

alter publication supabase_realtime add table public.claims;

-- Lets a claim's owner toggle `destructible` after grant, without
-- reopening geometry to change. Plain RLS (USING/WITH CHECK) only ever
-- sees the NEW row, so it can't by itself compare against OLD to block
-- specific column changes -- a BEFORE UPDATE trigger is the correct,
-- standard Postgres way to enforce "only this column may change," and
-- matches this table's existing philosophy (INSERT-only was already
-- chosen specifically to hard-enforce immutability at the DB level, not
-- just in application code -- see the table's own comment above).
create policy "claims_update_own" on public.claims
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.claims_enforce_immutable_geometry()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.shell_index is distinct from old.shell_index
     or new.center_x is distinct from old.center_x
     or new.center_y is distinct from old.center_y
     or new.center_z is distinct from old.center_z
     or new.size is distinct from old.size
     or new.granted_at is distinct from old.granted_at
  then
    raise exception 'claims are immutable except destructible (RHOMBIVERSE_SPEC_REGIONS.md section 2)';
  end if;
  return new;
end;
$$;

create trigger claims_immutable_geometry
  before update on public.claims
  for each row execute function public.claims_enforce_immutable_geometry();

-- RHOMBIVERSE_SPEC_LOOPHOLES.md section 2: "one claim per verified
-- account." A UNIQUE constraint is the real, server-side enforcement --
-- regions.js's client-side pre-check (computeClaim) is a fast, friendly
-- error path, not the actual guarantee; a modified/malicious client
-- skipping that check still hits this constraint on INSERT.
alter table public.claims add constraint claims_one_per_owner unique (owner_id);

-- Real bug found via a live two-session test, 2026-08-12: asteroid cells
-- (data->>'asteroidNodeId' is not null) got author_id stamped to
-- whichever session happened to run seedAsteroidBelts first, and the
-- existing cells_delete_own policy (author_id = auth.uid()) then meant
-- only that ONE seeding session could ever mine them -- every other
-- player's right-click silently failed server-side. Mining is meant to
-- be universal, not owner-gated. Postgres OR's multiple permissive
-- policies for the same command together, so this is purely additive:
-- your own cells (existing policy) OR any asteroid-tagged cell (this
-- one), either allows deletion.
create policy "cells_delete_asteroid" on public.cells
  for delete using (data->>'asteroidNodeId' is not null);

-- RHOMBIVERSE_SPEC_ASTEROIDS.md section 4: syncs the regrowth queue so
-- ANY connected client can process a pending regrowth, not just whoever
-- originally mined the cell (who might have disconnected before the
-- cooldown elapsed). INSERT/DELETE open to any authenticated user --
-- regrowth is a system process, not owner-gated, same reasoning as
-- cells_delete_asteroid. Racing clients are safe by construction: the
-- resulting cell write is the same idempotent upsert every cell write
-- already uses, and deleting an already-deleted row is a silent no-op.
create table public.asteroid_regrowth (
  x integer not null,
  y integer not null,
  z integer not null,
  node_id text not null,
  material text not null,
  mined_at timestamptz not null default now(),
  primary key (x, y, z)
);

alter table public.asteroid_regrowth enable row level security;
alter table public.asteroid_regrowth replica identity full;

create policy "asteroid_regrowth_select_all" on public.asteroid_regrowth
  for select using (true);

create policy "asteroid_regrowth_insert_any" on public.asteroid_regrowth
  for insert with check (auth.role() = 'authenticated');

create policy "asteroid_regrowth_delete_any" on public.asteroid_regrowth
  for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.asteroid_regrowth;

-- Security advisor fix, 2026-08-13: an unset search_path on a
-- SECURITY-sensitive function lets a caller who can create objects
-- earlier in their own search_path shadow what the function resolves
-- to. Explicit search_path closes that regardless of caller state --
-- standard Postgres hardening, not a behavior change.
alter function public.claims_enforce_immutable_geometry() set search_path = public;

-- RHOMBIVERSE_COMPLIANCE.md's "Rate limiting" item (Required before
-- Phase 5), 2026-08-13: RLS (cells_insert_own/cells_delete_own/etc.)
-- already proves WHO wrote something, but nothing previously capped HOW
-- OFTEN one identity could write. Real gap now that the repo (and the
-- publishable key + this full schema) is public and discoverable.
--
-- Token bucket per Adaptive Damping (RHOMBIVERSE_PRINCIPLES.md section
-- 0), the same shape already used by blackhole.js's cost-scaling and
-- supernova.js's threshold damping -- reused, not reinvented. Sized
-- deliberately generously: a single legitimate Fill-mode click at
-- MAX_SHELL=15 (render.js) inserts up to shellCumulativeCost(15)=12431
-- cells in one burst, since every cell push is still one request each
-- (no client-side batching exists yet) -- the limit must never punish
-- one enthusiastic click, only sustained/scripted abuse across many
-- separate actions. Capacity 15000 comfortably clears that ceiling;
-- refill of 20/sec (1200/min, full refill in ~12.5min) still bounds a
-- naive infinite scripted loop to a small fraction of its unthrottled
-- rate. This bounds the blast radius of casual/accidental abuse -- it
-- does not claim to stop a genuinely determined attacker, consistent
-- with this project's existing honesty about unsolved gaps (see
-- RHOMBIVERSE_SPEC_LOOPHOLES.md's own multi-account note).
create table public.rate_limits (
  owner_id uuid primary key,
  tokens numeric not null,
  last_refill timestamptz not null default now()
);

-- RLS enabled with NO policies at all -- nobody can read or write this
-- table directly, including its own owner (flagged INFO by the security
-- advisor as "RLS enabled, no policy" -- intentional, that IS the
-- policy: deny-all direct access). The only access path is the
-- SECURITY DEFINER function below, which bypasses RLS intentionally (it
-- needs to read/update every user's own row, not just the caller's).
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  capacity numeric := 15000;
  refill_per_second numeric := 20;
  current_tokens numeric;
  elapsed numeric;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Rhombiverse Shared World writes require an authenticated session';
  end if;

  insert into public.rate_limits (owner_id, tokens, last_refill)
  values (uid, capacity, now())
  on conflict (owner_id) do nothing;

  select tokens, extract(epoch from (now() - last_refill))
    into current_tokens, elapsed
    from public.rate_limits
    where owner_id = uid
    for update;

  current_tokens := least(capacity, current_tokens + elapsed * refill_per_second);

  if current_tokens < 1 then
    raise exception 'Rhombiverse Shared World write budget exceeded -- slow down, it refills over time';
  end if;

  update public.rate_limits
    set tokens = current_tokens - 1, last_refill = now()
    where owner_id = uid;

  return coalesce(new, old);
end;
$$;

-- Applies to INSERT/UPDATE/DELETE alike -- recolor and Excavate mode can
-- push just as many writes as Build/Fill/Generate, and all represent
-- the same underlying resource cost.
create trigger cells_rate_limit
  before insert or update or delete on public.cells
  for each row execute function public.check_rate_limit();

-- Security advisor fix, 2026-08-13: Supabase's PostgREST layer exposes
-- every public-schema function as a callable /rest/v1/rpc/ endpoint by
-- default, regardless of intent. check_rate_limit is a trigger function
-- -- Postgres itself refuses a direct (non-trigger) call, so the
-- real-world exploit surface was a clean error, not data exposure -- but
-- there's no reason to leave it listed as a public RPC target. Revoking
-- EXECUTE doesn't affect the trigger itself: a trigger fires via the
-- trigger mechanism, not a role's EXECUTE grant on the function.
-- Verified live after this revoke that the trigger still fires
-- correctly (a real insert/delete still consumes a token as expected).
revoke all on function public.check_rate_limit() from public, anon, authenticated;

-- RHOMBIVERSE_COMPLIANCE.md's "Backup strategy independent of live
-- world-state" item, 2026-08-13. Honest framing up front: this is NOT
-- true off-platform disaster recovery -- a total project-level loss
-- would take these snapshots too, since they live in the same Postgres
-- instance. What it DOES cover, for real: the actually likely failure
-- modes for a small hobby project -- a buggy moderation/consumption
-- pass, an application bug that mass-deletes or corrupts cells, a bad
-- manual SQL edit, or a black hole/supernova mechanic gone wrong. A
-- snapshot table separate from the live tables, on a schedule, with no
-- application write path to it, is the simplest thing that provides
-- real recovery value here without new paid infrastructure (Supabase's
-- own point-in-time recovery is a paid-plan feature) -- Grounded
-- Simplicity over inventing an off-platform pipeline this project
-- doesn't otherwise need.
create extension if not exists pg_cron;

create table public.world_snapshots (
  id bigserial primary key,
  taken_at timestamptz not null default now(),
  cells jsonb not null,
  claims jsonb not null
);

-- No policies at all -- this is an internal recovery mechanism, not
-- player-facing data; nobody (including the anon/authenticated roles
-- normal gameplay uses) can read or write it directly. Same deny-all
-- pattern as rate_limits.
alter table public.world_snapshots enable row level security;

create or replace function public.take_world_snapshot()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.world_snapshots (cells, claims)
  values (
    (select coalesce(jsonb_object_agg(x || ',' || y || ',' || z, data), '{}'::jsonb) from public.cells),
    (select coalesce(jsonb_object_agg(id, jsonb_build_object(
      'ownerId', owner_id, 'shellIndex', shell_index,
      'center', jsonb_build_array(center_x, center_y, center_z),
      'size', size, 'destructible', destructible, 'grantedAt', granted_at
    )), '{}'::jsonb) from public.claims)
  );
  -- Retention: keep the last 30 snapshots (daily cadence below -> ~1
  -- month of history) rather than growing this table forever.
  delete from public.world_snapshots
    where id not in (select id from public.world_snapshots order by taken_at desc limit 30);
end;
$$;

revoke all on function public.take_world_snapshot() from public, anon, authenticated;

-- Daily at 03:00 UTC -- low-traffic hour for a small hobby project,
-- arbitrary but reasonable; not derived from any real usage data since
-- none exists yet. Verified live: manually invoked take_world_snapshot()
-- once and confirmed a correct row landed in world_snapshots, and
-- confirmed cron.job shows this schedule registered and active.
select cron.schedule('daily-world-snapshot', '0 3 * * *', $$select public.take_world_snapshot()$$);

-- Real finding while adding the job above, 2026-08-13: enabling pg_cron
-- pulled in its own default grants, which include EXECUTE on
-- cron.schedule/cron.unschedule for the anon AND authenticated roles --
-- Supabase's own default when the extension is enabled, not something
-- this migration set, and (confirmed by testing) not something this
-- project's own postgres role has sufficient privilege to revoke --
-- those grants are owned/protected by supabase_admin. Investigated
-- rather than assumed dangerous: a direct curl against
-- /rest/v1/rpc/schedule with the public anon key returns a clean
-- PostgREST 404 ("Could not find the function public.schedule..."),
-- confirming PostgREST only ever searches the public schema for RPC
-- targets and never routes to `cron.*` at all -- the raw Postgres grant
-- is real but genuinely unreachable through this app's actual public
-- API surface (the anon/publishable key). It would only matter to
-- someone holding a direct Postgres connection string, a completely
-- different and already-protected secret. Left as a documented,
-- investigated non-issue rather than either silently ignored or
-- incorrectly claimed fixed.
revoke all on function cron.schedule(text, text) from public, anon, authenticated;
revoke all on function cron.schedule(text, text, text) from public, anon, authenticated;
revoke all on function cron.unschedule(text) from public, anon, authenticated;
revoke all on function cron.unschedule(bigint) from public, anon, authenticated;

-- RHOMBIVERSE_SPEC_TRADE_INVENTORY.md, wired to Supabase, 2026-08-13.
-- src/trade.js already has the full local-only data model and
-- resolution logic (decay, propose/confirm/cancel) -- this section
-- makes it real for Shared World, which needs a different trust model
-- than cells/claims: a cell is basically cosmetic (a "wrong" cell just
-- makes a weirder world), but inventory is a currency-like resource --
-- a client that could freely upsert its own quantity would trivially
-- break the whole barter economy. So unlike cells (client computes,
-- server just authenticates+stores), inventory writes are NEVER
-- directly grantable to players -- every change happens through a
-- SECURITY DEFINER function that validates the real, server-known state
-- first. This mirrors this project's own established pattern (claims'
-- immutability trigger, the rate limiter) rather than inventing a new
-- trust model.
create table public.player_inventory (
  owner_id uuid not null,
  material text not null,
  quantity numeric not null default 0,
  last_used_at timestamptz not null default now(),
  primary key (owner_id, material)
);

alter table public.player_inventory enable row level security;
alter table public.player_inventory replica identity full;

-- Stockpiles are world-visible on purpose -- matches this project's
-- existing "open commons" posture for cells/claims (TERMS.md's own
-- framing), and doubles as trade-partner discovery: with no chat/DM
-- system in this app, seeing who holds what is the only practical way
-- to find someone worth proposing a trade to.
create policy "player_inventory_select_all" on public.player_inventory
  for select using (true);

-- Deliberately NO insert/update/delete policy for anon/authenticated --
-- every write goes through mine_asteroid_cell() or the trade-resolution
-- trigger below, both SECURITY DEFINER, both bypassing RLS
-- intentionally after doing their own real validation.

-- RHOMBIVERSE_SPEC_ASTEROIDS.md section 3 + section 4, made
-- server-authoritative: the ONLY way Shared World inventory can grow is
-- through this function, which re-reads the real cell server-side
-- (never trusts a client-supplied material/amount) before crediting.
-- Bundles the deletion + regrowth-queue registration + credit into one
-- atomic call, replacing the previous three separate client-driven
-- steps for the shared-world case specifically -- local single-player
-- play keeps using asteroids.js's own mineAsteroidCell unchanged, this
-- is additive.
create or replace function public.mine_asteroid_cell(mx integer, my integer, mz integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cell_data jsonb;
  mat text;
  cur_qty numeric;
begin
  if uid is null then
    raise exception 'Mining requires an authenticated session';
  end if;

  select data into cell_data from public.cells where x = mx and y = my and z = mz for update;
  if cell_data is null or cell_data->>'asteroidNodeId' is null then
    raise exception 'No asteroid cell at that position';
  end if;
  mat := cell_data->>'material';

  delete from public.cells where x = mx and y = my and z = mz;

  insert into public.asteroid_regrowth (x, y, z, node_id, material, mined_at)
  values (mx, my, mz, cell_data->>'asteroidNodeId', mat, now())
  on conflict (x, y, z) do update
    set node_id = excluded.node_id, material = excluded.material, mined_at = excluded.mined_at;

  select quantity into cur_qty from public.player_inventory where owner_id = uid and material = mat for update;
  if cur_qty is null then
    insert into public.player_inventory (owner_id, material, quantity, last_used_at) values (uid, mat, 1, now());
  else
    update public.player_inventory set quantity = cur_qty + 1 where owner_id = uid and material = mat;
  end if;

  return jsonb_build_object('material', mat);
end;
$$;

revoke all on function public.mine_asteroid_cell(integer, integer, integer) from public, anon;
grant execute on function public.mine_asteroid_cell(integer, integer, integer) to authenticated;

-- RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 5: pendingTrades. Unlike
-- cells/claims/inventory, a specific negotiation is private between its
-- two participants, not world-visible -- your stockpile is public, but
-- an in-progress offer isn't broadcast to everyone.
create table public.pending_trades (
  id text primary key,
  player_a uuid not null,
  offer_a jsonb not null,
  player_b uuid not null,
  offer_b jsonb not null,
  confirmed_a boolean not null default false,
  confirmed_b boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pending_trades enable row level security;
alter table public.pending_trades replica identity full;

create policy "pending_trades_select_participant" on public.pending_trades
  for select using (auth.uid() = player_a or auth.uid() = player_b);

-- Matches trade.js's proposeTrade: the caller is always player_a (the
-- proposer specifies both sides' offers up front; player_b just
-- confirms or lets it sit/cancels).
create policy "pending_trades_insert_as_proposer" on public.pending_trades
  for insert with check (auth.uid() = player_a);

create policy "pending_trades_update_participant" on public.pending_trades
  for update using (auth.uid() = player_a or auth.uid() = player_b)
  with check (auth.uid() = player_a or auth.uid() = player_b);

-- Either party can cancel/reject -- matches trade.js's own cancelTrade,
-- which has no permission check at all in its local-only form (fine
-- there; here the RLS itself IS the permission check).
create policy "pending_trades_delete_participant" on public.pending_trades
  for delete using (auth.uid() = player_a or auth.uid() = player_b);

-- Restricts an UPDATE to exactly one thing: the calling party may only
-- flip THEIR OWN confirmed_* column, never the trade terms and never
-- the other party's confirmation. Same immutable-except-one-field
-- pattern as claims_enforce_immutable_geometry, applied to this table's
-- own shape.
create or replace function public.pending_trades_enforce_confirm_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.player_a is distinct from old.player_a
     or new.offer_a is distinct from old.offer_a
     or new.player_b is distinct from old.player_b
     or new.offer_b is distinct from old.offer_b
     or new.created_at is distinct from old.created_at
  then
    raise exception 'pending trade terms are immutable once proposed (RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 3)';
  end if;
  if auth.uid() = old.player_a and new.confirmed_b is distinct from old.confirmed_b then
    raise exception 'only player B may confirm player B''s side';
  end if;
  if auth.uid() = old.player_b and new.confirmed_a is distinct from old.confirmed_a then
    raise exception 'only player A may confirm player A''s side';
  end if;
  return new;
end;
$$;

create trigger pending_trades_confirm_only
  before update on public.pending_trades
  for each row execute function public.pending_trades_enforce_confirm_only();

-- The actual atomic swap (RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 3:
-- "either the full exchange completes or nothing happens... prevents
-- scams by construction"). Fires once both confirmations land; re-
-- verifies BOTH sides can still afford their own offer at THIS exact
-- moment (inventory may have moved since proposal -- spent elsewhere,
-- or decayed), same re-check trade.js's own resolveTrade already does
-- locally. An unaffordable trade is dropped silently (deleted, no
-- partial effect) rather than erroring -- matches section 6's "a
-- failed/cancelled trade leaves both players' inventories exactly as
-- they were."
create or replace function public.resolve_trade_if_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mat text;
  amt numeric;
  held numeric;
begin
  if not (new.confirmed_a and new.confirmed_b) then
    return new;
  end if;

  for mat, amt in select key, value::numeric from jsonb_each_text(new.offer_a) loop
    select quantity into held from public.player_inventory where owner_id = new.player_a and material = mat;
    if held is null or held < amt then
      delete from public.pending_trades where id = new.id;
      return null;
    end if;
  end loop;
  for mat, amt in select key, value::numeric from jsonb_each_text(new.offer_b) loop
    select quantity into held from public.player_inventory where owner_id = new.player_b and material = mat;
    if held is null or held < amt then
      delete from public.pending_trades where id = new.id;
      return null;
    end if;
  end loop;

  for mat, amt in select key, value::numeric from jsonb_each_text(new.offer_a) loop
    update public.player_inventory set quantity = quantity - amt, last_used_at = now()
      where owner_id = new.player_a and material = mat;
    insert into public.player_inventory (owner_id, material, quantity, last_used_at)
      values (new.player_b, mat, amt, now())
      on conflict (owner_id, material) do update set quantity = public.player_inventory.quantity + amt;
  end loop;
  for mat, amt in select key, value::numeric from jsonb_each_text(new.offer_b) loop
    update public.player_inventory set quantity = quantity - amt, last_used_at = now()
      where owner_id = new.player_b and material = mat;
    insert into public.player_inventory (owner_id, material, quantity, last_used_at)
      values (new.player_a, mat, amt, now())
      on conflict (owner_id, material) do update set quantity = public.player_inventory.quantity + amt;
  end loop;

  delete from public.pending_trades where id = new.id;
  return null;
end;
$$;

create trigger pending_trades_resolve
  after update on public.pending_trades
  for each row execute function public.resolve_trade_if_ready();

alter publication supabase_realtime add table public.player_inventory;
alter publication supabase_realtime add table public.pending_trades;

-- Same fix as check_rate_limit()/claims_enforce_immutable_geometry
-- before: these are trigger functions (Postgres refuses a direct
-- non-trigger call), but Supabase's default API exposure lists every
-- public-schema function as a callable RPC target regardless of intent.
-- mine_asteroid_cell's own EXECUTE grant to authenticated is
-- intentional (that IS the public entry point, already designed to
-- validate everything server-side) and is left alone.
revoke all on function public.pending_trades_enforce_confirm_only() from public, anon, authenticated;
revoke all on function public.resolve_trade_if_ready() from public, anon, authenticated;

-- Section 4 decay, made real for Shared World: same shape as trade.js's
-- own applyInventoryDecay (flat free threshold per material, gentle
-- linear decay above it, reused not reinvented), run periodically via
-- pg_cron rather than client-side, since inventory is now server-
-- authoritative -- a client can no longer just write its own decayed
-- value. Every 5 minutes rather than trade.js's 30-second client tick:
-- the client-side version ran on every local onChange (cheap, frequent,
-- no real cost); a cron job has a real fixed cost per run regardless of
-- whether anything decays, so a coarser interval is the right trade for
-- a hobby-scale project -- still frequent enough that decay reads as
-- "gradual," per the spec's own framing, not "instant" or
-- "unnoticeable."
create or replace function public.apply_inventory_decay()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  free_thresholds jsonb := '{"base":30,"garnet":20,"ferrostone":15,"glassite":8,"star-glassite":5,"blackstar-glassite":2}'::jsonb;
  default_threshold numeric := 10;
  decay_tick_seconds numeric := 30;
  decay_amount_per_tick numeric := 1;
  row_rec record;
  threshold numeric;
  elapsed_ticks numeric;
  max_decayable numeric;
  decay_amount numeric;
  ticks_applied numeric;
begin
  for row_rec in select * from public.player_inventory loop
    threshold := coalesce((free_thresholds->>row_rec.material)::numeric, default_threshold);
    if row_rec.quantity <= threshold then
      continue;
    end if;
    elapsed_ticks := floor(extract(epoch from (now() - row_rec.last_used_at)) / decay_tick_seconds);
    if elapsed_ticks <= 0 then
      continue;
    end if;
    max_decayable := row_rec.quantity - threshold;
    decay_amount := least(max_decayable, elapsed_ticks * decay_amount_per_tick);
    ticks_applied := ceil(decay_amount / decay_amount_per_tick);
    update public.player_inventory
      set quantity = row_rec.quantity - decay_amount,
          last_used_at = row_rec.last_used_at + make_interval(secs => ticks_applied * decay_tick_seconds)
      where owner_id = row_rec.owner_id and material = row_rec.material;
  end loop;
end;
$$;

revoke all on function public.apply_inventory_decay() from public, anon, authenticated;

select cron.schedule('inventory-decay', '*/5 * * * *', $$select public.apply_inventory_decay()$$);

-- RHOMBIVERSE_SPEC_PENROSE_GROWTH.md: Phase 6 growth-layer seeds, synced
-- across sessions -- section 10's own deferral, closed 2026-08-13 by
-- direct request. `id` is the client-generated seedId (matches
-- growth.js's own "caller owns id generation" convention, same as
-- claims/trades/regrowth). `data` holds the entire seed object (species,
-- origin, plantedAt, lastGrowthAt, generation, tiles) as one JSONB blob,
-- same "world is data" convention cells.data already uses -- growth.js's
-- own plantedAt/lastGrowthAt are client-side epoch-ms numbers, not
-- Postgres timestamps, so a single opaque blob avoids inventing a type
-- mapping for them.
create table public.seeds (
  id text primary key,
  data jsonb not null,
  owner_id uuid not null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.seeds enable row level security;
-- Needed so UPDATE/DELETE realtime payloads include the old row values,
-- same reason as cells/claims/asteroid_regrowth.
alter table public.seeds replica identity full;

create policy "seeds_select_all" on public.seeds
  for select using (true);

create policy "seeds_insert_own" on public.seeds
  for insert with check (owner_id = auth.uid());

-- Broad on purpose, same reasoning as cells_update_any_authenticated: a
-- seed needs to keep growing (growSeed/applyGrowth updates
-- generation/tiles/lastGrowthAt) from ANY connected client's periodic
-- tick, not just whoever planted it -- who might disconnect long before
-- the seed reaches its maxGeneration cap. Mirrors asteroid_regrowth's
-- own "any connected client can process anyone's pending regrowth"
-- reasoning exactly.
create policy "seeds_update_any_authenticated" on public.seeds
  for update using (auth.role() = 'authenticated');

-- Not currently exercised (nothing in the app ever calls removeSeed yet),
-- included for symmetry with worldstate.js's own onSeedClear hook, which
-- already existed in anticipation of this sync pass.
create policy "seeds_delete_own" on public.seeds
  for delete using (owner_id = auth.uid());

alter publication supabase_realtime add table public.seeds;
