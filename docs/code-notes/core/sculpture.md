# Notes: `src/core/sculpture.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Sculpture tool module (`RHOMBIVERSE_UIUX_BUILD_PLAN.md` B4) — shared,
built once, used identically by B4a (in-world "Create" wheel category)
and B4b (standalone Sculpture Mode). Pure logic only: no DOM, no THREE
scene access — callers (`render.js`) own presentation, this owns the
Assistance Spectrum data model, symmetry mirroring, the shell-radius
brush, and Full-Cyborg's natural-language intent parsing/execution.

## `setRegionsIntegration` / claims wiring

`RHOMBIVERSE_PLAN.md`'s Core vs. Modules boundary (2026-08-23): claims
are a World System, so `sculpture.js` (Core) must not statically import
`regions.js`. `render.js` supplies the real `claimIdAt`/`isClaimProtected`
here via `setRegionsIntegration()`, gated behind `FEATURES.economy` (see
`render.js`'s own `init()`). Inert defaults — no claims exist — so
local-only play, tests, and mining-disabled worlds behave exactly as
"nothing is claimed," same permissive framing `canFullCyborgEditAt`'s
own note below already relies on for the no-claims-registry case.

## Symmetry mirroring — `FULL_SYMMETRY_GROUP`

"Reuse the lattice's existing order-48 cubic symmetry group" (B4's own
wording) — no such group actually existed anywhere in this codebase
before this file (confirmed by search; the plan's own "already in your
repository" framing was wrong for this one specific reference, unlike
its regions/claims counterpart, which is real). Built here instead:
the full octahedral symmetry group Oh has exactly 48 elements — every
combination of a signed permutation of (x,y,z) (3! permutations x 2^3
sign choices = 48). Every element trivially preserves the FCC parity
rule (`isValidCell`: x+y+z even), since negating or reordering integers
never changes the parity of their sum.

## `MIRROR_PLANES`

The Manual-tier "pick a mirror plane" control exposes six real,
nameable elements of that same 48-element group (the axis-aligned and
diagonal reflections) rather than all 48 as a flat button list — a
UI-legibility choice, not a reduction of the underlying group, which
stays fully available via `FULL_SYMMETRY_GROUP` above for anything else
(e.g. Full-Cyborg's own "mirror this wing" phrasing) that wants it.

## Shell-radius brush — `shellBrushCells`

"Reuse the existing `shellCount(n) = 10n^2+2` formula... one click
adds/removes an entire shell-cluster." `cellsInShells` (`lattice.js`) is
that exact existing formula's own candidate generator — reused
directly, not reimplemented. Returns the list of cells actually
touched (so a caller can also mirror them) rather than mutating
silently; center itself is included for radius >= 0 add actions.
`offsets` (additive param, default undefined -> `cellsInShells`' own
`NEIGHBOR_OFFSETS` default) lets a caller pass `dual.js`'s `DUAL_DIRS.cube`/
`octa` instead, for Sculpture Mode's "Dual Shell" brush — every
existing call site (which omits it) is unaffected.

## `applySymmetricCell`

Applies a single-cell add/remove, then its mirrored counterpart too
(if a plane is chosen and the mirror lands somewhere different from
the original — a cell exactly ON the mirror plane maps to itself,
correctly a no-op second write). Returns every real cell touched.

## `sculptStroke`

Combined brush+mirror stroke — what the actual Manual-tier click
handler calls: every cell the shell-radius brush would touch, each
ALSO mirrored if a plane is chosen. radius 0 degenerates to exactly
`applySymmetricCell`'s own single-cell(+mirror) behavior.
`shellOffsets` (additive param) — Sculpture Mode's "Dual Shell"
checkbox passes `dual.js`'s `DUAL_DIRS.cube`/`octa` here so the brush grows
along the inscribed cube/octahedron's own directions instead of the
normal 12-neighbor shell; every existing call site (which omits it)
is unaffected.

## Dual symmetry presets — `applyDualSymmetry`

"Cube symmetry"/"Octa symmetry": replicate a sculpt operation across
the 8 cube-anchor or 6 octa-anchor positions from `dual.js`'s `DUAL_DIRS`,
as translated copies of the target cell — the same "apply original,
then apply each transformed copy" shape `applySymmetricCell` already
uses for a single mirror plane, generalized here to an arbitrary list
of coordinate offsets instead of one mirror function. No order-48
symmetry tool actually exists anywhere in this codebase's UI to
extend (checked directly during this task's own investigation step —
`FULL_SYMMETRY_GROUP` is exported above but never consumed; only the
6-plane `MIRROR_PLANES` picker is wired to the UI), so this reuses
`applySymmetricCell`'s per-cell apply logic rather than a nonexistent
48-transform application path.

## `applyFullSymmetry`

Full symmetry (48): replicates a sculpt operation through every
element of `FULL_SYMMETRY_GROUP` (a genuine linear map fixing the world
origin — same "reflect the raw (x,y,z) coordinates" shape
`mirrorCell`/`applySymmetricCell` already use for the 6-plane picker, just
all 48 elements of Oh instead of one reflection). A cell on a
symmetry axis/plane maps to itself under some elements, so the orbit
can be smaller than 48 for that specific cell — deduped via a Set
rather than assumed to always produce exactly 48 touched cells.

## `createSculptureSession`

Exact shape from `RHOMBIVERSE_UIUX_BUILD_PLAN.md` B4's own schema.

## `findDualAnchor` / `updateSemiCyborgSuggestion`

Semi-Cyborg: "the agent observes the player's recent manual edits and
proposes a plausible next edit... surfaced as preview cells." The
spec's own example reason ("completing symmetric dome edge") is a
literal symmetry-completion heuristic, not an LLM call — implemented
exactly that way: after a manual edit, if a mirror plane is active and
that edit's own mirror counterpart doesn't exist yet, propose adding
it. Call this after every manual world mutation while `assistanceTier`
is `'semi-cyborg'`; no-ops (clears `pendingSuggestion`) if there's nothing
to propose.

`dualFocus` (additive param, default undefined -> dual-awareness
skipped entirely, every existing call site unaffected) is the
dual-awareness task's own hook: when the mirror-plane heuristic above
finds nothing to propose, and dual data is available (`dualFocus` not
`"none"`/undefined), check whether the just-edited cell sits at one of
its neighbor's own inscribed-cube/octahedron dual-direction positions
(`DUAL_DIRS.cube`/`octa`, `dual.js`) — i.e. the player just built outward
along a real cube/octa vertex direction from an existing cell. If so,
propose completing that whole inscribed solid via the SAME
`pendingSuggestion`/`acceptSuggestion`/`dismissSuggestion` mechanism as the
mirror-plane suggestion above (reused, not a new UI system) — this is
the "suggest mirroring across the inscribed cube/octahedron" behavior
from the dual-awareness task, expressed as "these are the still-
missing cells of that solid" rather than inventing a second suggestion
shape. Scoped to the add case only (an anchor a removed cell used to
complete doesn't have a stable single anchor to re-derive from) — a
deliberate scope decision, not an oversight.

A missing mirror of a just-ADDED cell is a real gap to fill; a still-
present mirror of a just-REMOVED cell is a real "you cleared one side,
the other side is now asymmetric" gap in the other direction. Both
read as the same "complete the symmetric feature" suggestion, just add
vs. remove.

## Full-Cyborg: natural-language intent → concrete cell edits

Two paths, same output shape (`{cells, action, description}`):

1. `requestFullCyborgIntent` (preferred): POSTs the player's raw text to
   `/api/sculpt-intent`, a real Vercel serverless function that calls an
   LLM via Vercel's AI Gateway — genuine natural-language UNDERSTANDING,
   not keyword matching. The model's only job is producing a small
   structured decision (shape/action/radius/mirror); turning that into
   actual FCC-lattice cell coordinates stays 100% deterministic
   client-side math (`intentToCells`), reused by both paths — the model
   never invents coordinates itself.
2. `parseFullCyborgIntent` (fallback): a bounded keyword parser, used
   when the API call fails for any reason (AI Gateway not yet enabled
   on the Vercel project, network issue, rate limit) — so this feature
   still genuinely works even before/without that one-time dashboard
   setup step, rather than hard-failing.

## `detectSize`

`3` is a reasonable, disclosed default when no size word is present.

## `intentToCells`

Shared geometry step for both the local parser and the AI-Gateway path
— shape/action/radius/mirror -> real cell coordinates. `origin`:
`{x,y,z}`, the player's current build-cursor cell.

**Wall shape:** a straight run of cells along the lattice's own X
neighbor direction, `radius` cells long each way from origin — reuses
NEIGHBOR-adjacent stepping via `cellsInShells`' own shell-1 members
filtered to one direction would overcomplicate a simple line; a direct
arithmetic walk is clearer and still real lattice math (every step
preserves the parity rule since +2 on one axis does).

**Dome/sphere/mirror-wing:** all resolve to a shell-radius cluster —
"dome" reads as the upper half (y >= origin.y), matching the word's
own real-world shape; "sphere"/"mirror-wing" use the full cluster (a
"wing" is just whatever's on one side once mirrored).

## `parseFullCyborgIntent`

`origin`: `{x,y,z}` — where the edit is centered (`render.js` passes
the player's current build-cursor cell).

## AI-Gateway-backed path — `requestFullCyborgIntent`

See `/api/sculpt-intent.js`: sends the raw text to the server, gets
back a small structured decision, and turns it into cells with the
exact same `intentToCells` math the local parser uses. Falls back to
`parseFullCyborgIntent` on any failure — a real resilience path, not a
formality: this makes the feature work even before AI Gateway is
enabled on the Vercel project dashboard (a one-time manual step only
the project owner can do).

Three-tier fallback, in order: (1) the player's own AI key (`byok.js` —
their key, their browser, their choice), (2) this site's shared AI
Gateway (`/api/sculpt-intent`), (3) the local keyword parser. Each tier
only runs if the one before it is unavailable or fails — the feature
works at every tier, just with more real language understanding the
higher up the chain it succeeds.

`dualFocus` (additive param, dual-awareness task): the one context
token that task adds to Full-Cyborg's request. `render.js` passes
`undefined` when `FEATURES.dualSculpture` is false, so the BYOK prompt
text and the `/api/sculpt-intent` JSON body are byte-identical to
before this task in that configuration — no other existing field is
restructured or reordered.

## `canFullCyborgEditAt`

Scoping rule shared by B4a's Full-Cyborg tier: "restricted to the
player's own claimed region... or destructible-flagged space." Local-
only play (no Shared World, no real claims registry) has nothing to
restrict against, so this is permissive there by construction —
`claimIdAt` returns null for any coordinate with no claims at all.

## `executeFullCyborgIntent`

Applies a parsed intent, skipping any cell the scoping check rejects.
Every resulting `world.addCell`/`removeCell` call is IDENTICAL to a
normal manual placement — this project's own `authorId` stamping
happens server-side (`sync.js`, from the authenticated session), never
supplied by the client — so edits made here are attributed to whichever
player is actually signed in and pushing them, never to "the agent," by
construction, not by a special case this function has to implement.
