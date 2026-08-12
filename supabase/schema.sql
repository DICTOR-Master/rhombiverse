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
