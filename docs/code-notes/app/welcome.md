# Notes: `src/app/welcome.js`

Full design rationale/history for this file, moved out of the source so
the code itself stays lite and readable — nothing here is new, it's the
exact commentary that used to sit inline. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## File header

First-run welcome/entry overlay: logo, plain-language description, and
links to the legal docs every small public web app carries
(`TERMS.md`/`PRIVACY.md`/`SECURITY.md`, already written for Phase 4's
public deploy — see `CLAUDE.md`). No "under construction" framing
(dropped 2026-08-19 — undermined trust/permanence per user feedback).
Purely a DOM/localStorage concern, deliberately independent of
`render.js`/world state — this can run (and the game can be dismissed
into) even if nothing else on the page has finished loading yet.

## The Rhombeometry/Full World mode-choice buttons

Migration Path Phase C (`RHOMBIVERSE_PLAN.md`): the same Rhombeometry
choice `render.js`'s Lab panel exposes, offered up front here too (per
direct instruction — both surfaces). `settings.js` is the single source
of truth either way; picking a different mode than what's already
active reloads immediately, since World Systems flags are only ever
read once, at `features.js`'s own module-eval time, and this overlay's
own choice can otherwise race `render.js`'s `init()` (loaded as a
separate, unordered-relative-to-this `<script type="module">`).

## `RD_EDGES`

Same wireframe rhombic dodecahedron coordinates as `favicon.svg` — this
project's own voxel shape (`lattice.js`'s `rdRawVerts`: 8 cube verts at
radius 0.5, 6 octa verts at radius 1.0), rotated to a non-axis-aligned
angle and orthographically projected so no vertex overlaps another on
screen, not generic art. Kept as a plain coordinate list here (rather
than re-deriving via `lattice.js` at runtime) since it's static
presentation geometry, not gameplay math.

2026-08-23: a same-day redraw at a different rotation with explicit
vertex-dot circles was reverted — direct feedback that it read as "too
different" from the reference image and that the dots read as unwanted
"explicit round nodes." Checked numerically against the reference
(pixel-sampled vertex positions and stroke color) and this original
rotation/color were already a close match; the dots (not the geometry)
were the actual mismatch. So: original coordinates unchanged, dot
circles removed, lines rely on `stroke-linecap="round"` alone for the
soft vertex look the reference has.

## `FALLBACK_TAGLINE`

Fallback only — shown until `loadLatestUpdate()` resolves, or if the
fetch fails outright (offline, localStorage-only dev server oddity).
The real tagline is always sourced from `data/changelog.json`'s newest
entry's OWN TITLE ONLY (see `init()`) — not hand-maintained here, so it
can't go stale the way a hardcoded line already had (2026-08-23, direct
request: "welcome should be based on changelog"). Title only, not title
+ lead item, per direct feedback that the first attempt (which appended
the item text) read as too wordy and too negatively framed for a
first-impression line — the changelog panel itself is still the place
for that fuller, more detailed wording.

## `loadLatestUpdate`

Fetched fire-and-forget from `init()` below — built synchronously with
`FALLBACK_TAGLINE` first (same reasoning as `changelog.js`'s own
overlay: don't block the welcome card's very first paint on a
network/disk round-trip), then patched in place once this resolves.

## The persona grid (`.identity-item` click/keydown wiring in `init()`)

"Consider making the four personas clickable... letting a new player
pick 'Rhombiologist' and land with the grow wheel open would complete
the onboarding arc" — `render.js` (loaded independently of this file,
see the file header above) listens for the `rhombiverse:personaChosen`
event and does the actual mode/panel switching; this module only knows
DOM/localStorage, never world state, so it can't do that part itself.

## `skip` read failure (bottom of `init()`)

localStorage unavailable (private browsing, quota) — default to
showing the intro rather than failing closed.
