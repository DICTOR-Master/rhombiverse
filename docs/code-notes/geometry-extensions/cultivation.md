# Notes: `src/geometry-extensions/cultivation.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File overview

Cultivation Mode (`RHOMBIVERSE_UIUX_BUILD_PLAN.md` B5). "Reuse the
Assistance Spectrum tiers and Full-Cyborg scoping rules from B4 exactly
— do not redefine them" — `canFullCyborgEditAt` is imported straight
from `sculpture.js`, not reimplemented. Manual tier's
`growthParameters` and the prune-triggers-reroute mechanic live in
`growth.js` itself (`growSeed`/`pruneTile`) since they're real changes
to the growth algorithm, not this module's concern — this module only
covers session state and the two Assistance-tier behaviors that are
genuinely specific to Cultivation: Semi-Cyborg's planting-site
suggestion and Full-Cyborg's natural-language planting.

## `proposeCultivationSite`

Semi-Cyborg: "this spot has strong hydrosphere permeation, likely a
good planting site" — reuses `hydrosphere.js`'s REAL field name,
`hydrospherePermeated` (the build plan calls it `hydrosphereActive`,
which doesn't exist anywhere in this codebase; same kind of naming
mismatch as B4's symmetry-group claim, honored by using the real name
instead of inventing a field that isn't there).

## Full-Cyborg: natural-language planting/tending

Same two-path shape as `sculpture.js`'s Full-Cyborg (a real AI-Gateway
call with a bounded local parser as fallback) — see
`api/cultivate-intent.js` for the server side.

## `requestCultivationIntent`

Same three-tier fallback as `sculpture.js`'s Full-Cyborg: the player's
own AI key, then this site's shared AI Gateway, then the local parser.

## `executeCultivationIntent`

Scoped and gated identically to B4a's Full-Cyborg (B5's own explicit
requirement) — `canFullCyborgEditAt` is coordinate-based (claims are
defined over integer lattice cells), so a seed's real-valued origin is
snapped to its nearest lattice cell before the check, same bridge
`nearestValidCell` already exists for elsewhere in this codebase.
