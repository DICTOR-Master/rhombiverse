# Notes: `src/game-systems/starsystem.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File-level scope

Star System Anchor — `RHOMBIVERSE_SPEC_STAR_SYSTEM.md`. "A star is
simply a sufficiently massive Blackstar-Glassite core — same material,
same gravity mechanic already spec'd, no new material type" (section
1) — exactly the same move as Black Hole's own framing, and
independent of it: a cluster can cross the (lower) star threshold
without ever reaching the black hole threshold, or in principle both,
since the spec doesn't state exclusivity between the two.

## `STAR_BSG_THRESHOLD` / `LUMINOSITY_PER_BSG` / `CARBON_CATALYST_MATERIAL` / `FROST_LINE_FRACTION`

First-guess constants, not yet playtested — same convention as every
other tunable in `gravity.js`/`blackhole.js`. `STAR_BSG_THRESHOLD` is
deliberately lower than `blackhole.js`'s `BLACK_HOLE_BSG_THRESHOLD`
(20): a star is meant to be a reachable mid-game milestone, not an
endgame rarity — most players will hit Supernova's own critical-mass
threshold (a separate, higher constant in `supernova.js`) well before
ever accumulating enough BSG to become a black hole by direct accretion
alone, matching how real stars only reach black-hole density via
collapse, not steady growth.

- `LUMINOSITY_PER_BSG` — arbitrary UI-facing scale, not physically calibrated.
- `CARBON_CATALYST_MATERIAL` = `'ferrostone'` — reused per spec section
  2's own explicit permission ("default to reusing something existing
  before adding a new material type") — Ferrostone is the closest
  existing fit for a common, unglamorous, structural catalyst material.
- `FROST_LINE_FRACTION` — fraction of a star's `gravityRadius`, first-guess.

## `defaultLedger`

Exported: `supernova.js` reads/extends this same shape (accumulated
mass, detonation state) rather than inventing a second ledger, per that
spec's own "extends the existing... ledger pattern" instruction.

## `pickCoreCell`

Sticky core-cell selection, same pattern as `blackhole.js`'s
`pickCoreCell` — kept independent (not shared) since a cluster's
black-hole core cell and star core cell are conceptually different
ledgers that could, in principle, both live on cells of the same
cluster without colliding (different field names: `starLedger` vs
`blackHoleLedger`). Exported: a star's own core cell is also where
`supernova.js`'s detonation state lives, per that spec's own
instruction to extend this same ledger rather than invent a second one.

## `applyStarFusion`

Fusion: a star cluster with BOTH hydrogen feedstock (at least one
`hydrospherePermeated` cell — section 2's "Hydrogen — consumed as
fusion fuel... Ice 9.9 is water, which splits into real fusion fuel
plus a useful byproduct") and carbon catalyst (at least one
`CARBON_CATALYST_MATERIAL` cell) present anywhere in the cluster
sustains active fusion. Deliberately does NOT physically delete/deplete
those feedstock cells each tick — Ice 9.9's hydrosphere is a standing
network (`RHOMBIVERSE_SPEC_WATER_ICE.md` section 3: "spreads through
the existing structure"), not a one-shot consumable, so treating its
mere PRESENCE as the fuel gate (rather than destroying player-built
cells as an automatic side effect every world change) is the
non-destructive, non-surprising reading. The ledger itself still
accumulates in the same "consumption pattern, same shape" the spec asks
for (`hydrogenConsumed`/`carbonConsumed` tally up each active tick), it
just isn't backed by deleting real matter — an explicit implementation
choice, not an oversight. Oxygen byproduct feeding atmosphere needs no
separate code: fusion's own hydrogen source (`hydrospherePermeated`)
already implies `hydrosphereActive`/`atmosphereActive` are already true
for that same cluster (`gravity.js` sets both from the same flag), so
section 2's "Oxygen released... feeding the existing atmosphere
mechanic" is satisfied structurally, not by a second flag.

Inline note on the `ledger.detonated` check: a detonated star
(`RHOMBIVERSE_SPEC_SUPERNOVA.md`) is spent — "a single, bounded
detonation, not a runaway process" — so fusion stops accumulating
further mass once that's happened, rather than silently re-arming for a
second detonation.

## `frostLineDistance`

Frost line (section 3): one distance threshold from EACH active star's
center. Inside it, only rocky/metallic materials are placeable; Ice 9.9
cannot be placed there at all. Beyond it, anything goes (matches the
spec's "no Ice 9.9 possible here" / "Ice-9.9-rich" framing — rocky
materials aren't forbidden beyond the line, only Ice 9.9 is forbidden
inside it). A position with no star nearby has no frost-line
restriction at all — ordinary planetoids are unaffected.

## `canPlaceMaterial`

Checked by `build.js` before placing a cell (see `render.js` wiring).
`stars` is the list of star-classified planetoid records (already
annotated with `isStar` via `annotateStars` below). Returns true if
`material` is placeable at (x,y,z) given every nearby star's frost
line; false rejects the placement.

## `annotateStars`

Read-only summary for UI/tests, same pattern as `blackhole.js`'s
`annotateBlackHoles` — attaches luminosity/fusion/frost-line info onto
the matching planetoid record by `centerOfMass` identity.
