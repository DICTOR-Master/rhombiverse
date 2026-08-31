# Notes: `src/world-systems/regions.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Region Ownership & Claiming — `RHOMBIVERSE_SPEC_REGIONS.md`. Deliberately
distinct from Phase 5.8's per-cell moderation `region` field (core/
reviewed/open) — this file is about `claimId`/who OWNS a given area,
not whether its content has been vetted. See that spec's own section 1
naming note; never conflate the two.

Fixed-size claims only (section 2's own explicit rejection of a
fractionalizing/shrinking model), allocated outward from world center
(0,0,0) in true 3D shell order via the same `NEIGHBOR_OFFSETS`/
`shellCount(n)=10n^2+2` structure used everywhere else in this project
— not re-derived, reused directly from `lattice.js`.

## `CLAIM_SIZE_SHELLS`

Raised from the spec's own original 2-shell example (55 cells, real
bounding radius ~2.8 units) to 8-shell, 2026-08-13 — direct request
after a player found a 2-shell claim genuinely too small to build
anything that reads as a real structure in: this project's own
planetoid-generation history already found an 8-shell/radius-8 body
"still visibly faceted" but recognizably round (it needed radius 14 to
look fully smooth) before it was itself bumped larger for the preset
planetoids — reusing that already-field-tested size here rather than
picking a new number. 2,057 cells per claim, real bounding radius
11.314 units (both verified directly, not estimated). Fixed-size
claims only (section 2's own explicit rejection of a fractionalizing/
shrinking model) — this is a global default for every FUTURE claim;
claims already granted at the old size keep it (Isolation guarantee,
below: a claim is never resized after granting).

## `MAX_CLAIM_SEARCH_SHELL`

How far out (in shells from world center) to search for a free claim
slot before giving up. `shellCount(n)=10n^2+2` means `cellsInShells`'s
own candidate list grows QUADRATICALLY — an earlier version of this
constant (300) computed roughly 90 MILLION candidate records before
checking a single one, hanging a real browser click; caught by an
actual Playwright run, not by reasoning about the number in isolation.
This search cost is driven purely by `MAX_CLAIM_SEARCH_SHELL` itself,
independent of `CLAIM_SIZE_SHELLS` — 40 shells is still ~219k candidate
centers, computed in well under a second, same as before the claim
size increase above. What DOES shrink with a bigger claim size is how
many non-overlapping claims actually fit inside that search range: two
claims' footprints can't share a cell, so claim centers need roughly
2*`CLAIM_SIZE_SHELLS` shells of separation — at 8-shell claims that's
~16 shells apart, comfortably fitting many players within 40 shells
(though far fewer than the old 2-shell claims did); a jump to
full-planetoid-scale claims (14+ shells, ~28-shell separation) was
explicitly rejected for this reason — it would leave room for only a
handful of players before the search genuinely runs out. First-guess/
tunable like every other constant here, but grounded against an actual
measured cost, not just "sounds big enough."

## `claimedCellKeys` (internal)

Every cell key already covered by an existing claim, derived from the
claims registry itself (not from per-cell `claimId` stamps, which are
only ever present on cells that happen to have actually been built —
see `claimIdAt` below for why membership is computed geometrically
rather than requiring every claimed cell to physically exist first).

## `reservedAsteroidCellKeys` (internal)

`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 4: pre-seeded content (asteroid
belts) must be non-allocatable, regardless of shell index. Reads
`world.entries()` directly rather than importing `asteroids.js` —
every asteroid cell is already tagged with `asteroidNodeId` (the same
pattern `claimId`/`shellCenter` use), so this needs no coupling between
the two modules; it just treats "already occupied by pre-seeded
content" as another flavor of "already spoken for", same as an
existing claim. The spec also names a "star system anchor" to reserve,
but this implementation has no such thing — Star System (`starsystem.js`)
is a threshold crossed by a player's OWN BSG cluster wherever they
choose to build it, not fixed pre-seeded content at a known coordinate,
so there is nothing fixed to reserve for it; only the belts apply here.

## `findFreeSlot` (internal)

Finds the first free claim-sized footprint, searching candidate CENTERS
outward from a given origin in true 3D shell order (section 2: "filled
each shell before moving to the next... first-come claims are placed
in Shell 1 space, then Shell 2, and so on") — the origin itself
(shell 0) is tried first, since `cellsInShells` only ever returns shells
1+. Isolation (section 6): only ever reads existing claims to check for
overlap, never resizes/moves/touches one — granting a claim is a
strictly additive operation. Also skips any candidate overlapping
reserved pre-seeded content (see `reservedAsteroidCellKeys` above) —
section 4's fix, "continuing to the next available cell in shell order
rather than overlapping it" is exactly what this loop already does,
now with reserved cells added to what counts as "not free".

`origin` defaults to world center, but callers should pass wherever
the requesting player actually is (`render.js` does) — 2026-08-13,
direct insight from a player: the lattice is genuinely unbounded, so
there's no reason every search has to restart from the same shared
point and re-scan an increasingly crowded origin as more claims
accumulate. Search cost is bounded by `MAX_CLAIM_SEARCH_SHELL`
regardless of origin, but with a fixed origin that cost grows toward
the ceiling as the community grows (more claims to scan past before
reaching free space); with a per-player origin, each search only ever
needs to escape LOCAL crowding near that player, so cost stays flat no
matter how many total claims exist elsewhere in the lattice. The
tradeoff: `shellIndex` on a granted claim is relative to THAT claim's
own search origin, not a single shared reference point — it's no
longer directly comparable across claims with different origins, only
meaningful as "how far this player had to search from where they
were."

## `computeClaim`

Pure compute step, no mutation — lets a caller that needs to persist
the claim SOMEWHERE ELSE FIRST (`sync.js`'s `pushClaim`, which must
succeed against the shared table before the claim is treated as real
— see `render.js`'s Claim Land handler) do so before ever touching the
local store, rather than optimistically applying a claim locally that
might then fail to sync (e.g. a genuine concurrent-grant race on the
same free slot, caught server-side by the claims table's own primary
key — see `supabase/schema.sql`).

`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2: "one claim per verified
account." This is a fast, friendly pre-check against the LOCAL
(possibly slightly stale) claims view — the real guarantee is
`public.claims`'s own `UNIQUE(owner_id)` constraint (`supabase/schema.sql`),
which a claim attempt still has to clear regardless of what this
check sees.

The claim's own center coordinate makes a naturally unique,
deterministic id — no counter/race needed, since a candidate is
only ever chosen once confirmed free of every existing claim.

## `allocateClaim`

Convenience wrapper for local-only (non-shared, e.g. single-player or
tests) use: computes AND immediately applies to the local store in one
call, since there's no separate shared backend to race against.

## `claimBoundingRadius`

Real Euclidean distance (world units) from a claim's own center out to
the farthest cell in its footprint — the exact bounding radius, not an
estimated formula, reusing the same footprint geometry `findFreeSlot`
already computes elsewhere in this file. `render.js` uses this to draw a
wireframe sphere per claim so territory is visible even where nothing
has been built yet (a claim reserves space; it doesn't require every
cell in it to physically exist — see `claimIdAt` below).

## `claimFootprintWorldVertices`

World-space cell-center points for every cell in a claim's own real
footprint — 2026-08-13, replacing the old sphere visualization, which
used `claimBoundingRadius` (the farthest single CORNER of the footprint)
as a sphere radius. That's a real, MUCH looser bound than the actual
territory: this project's own lattice is built from the rhombic
dodecahedron's own 12 face-normal directions (`NEIGHBOR_OFFSETS`), so a
BFS "ball" in this graph metric is not a sphere at all — its outer
boundary is itself rhombic-dodecahedron-shaped (min real distance
N, max N*sqrt(2) at shell N, same fact `build.js`'s own `roundStructure`
already documents). Rather than deriving that shape analytically, this
returns the REAL cell-center points of the claim's own footprint so a
caller can build the exact true convex hull (`render.js` does, via
`three/addons`' `ConvexGeometry`, the same tool already used for every RD
cell and every Penrose tile in this app) — the accurate shape by
construction, not an approximation of one.

## `claimIdAt`

Which claim (if any) owns a given lattice coordinate — computed
geometrically against the claims registry rather than requiring a
per-cell `claimId` to already be stamped, so ownership of not-yet-built
space inside a claim is still well-defined (a claim reserves an area,
it doesn't need every cell in it pre-materialized). Wired into
`worldstate.js`'s `addCell` (auto-stamps `claimId`) and `blackhole.js`/
`supernova.js`'s `isClaimProtected` below.

## `isClaimProtected`

Section 4: "destructible flag ... now has a concrete referent: it's a
flag on a claimId's owned cells" — consumption/blast mechanics
(`blackhole.js`, `supernova.js`) check this ADDITIVELY alongside their own
pre-existing per-cell `destructible` field (the single-player-era
stand-in, still honored for cells hand-set that way before claims
existed) — either one being false protects the cell, neither replaces
the other.
