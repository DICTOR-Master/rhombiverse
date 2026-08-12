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
