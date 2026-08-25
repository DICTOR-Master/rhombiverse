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

## `RD_EDGES_3D` / the spinning logo (`buildRDEdges`/`startLogoSpin`)

2026-08-26 redesign, direct instruction: simplify the whole overlay down
to a large rotating wireframe RD, the ENTER action, and the Rhombeometry/
Full Game World mode choice — dropped the persona picker (`.identity-*`,
the `rhombiverse:personaChosen` dispatch) and the `.quickstart` hint line
entirely. Those onboarding modes (walk/sculpt/plant) are reachable from
the Rhombic Wheel 3D / HUD Wheel once inside now anyway, so losing the
welcome-screen shortcut to them isn't a real capability loss. `render.js`
still has a `rhombiverse:personaChosen` listener wired — left in place,
unreachable rather than ripped out, in case a future surface wants to
dispatch it again.

This replaced the older static, pixel-matched-to-`favicon.svg` `RD_EDGES`
projection (see prior history below) with a real, live-rotating one built
from `buildRDFaces()` — the exact same shared geometry source as the
Rhombic Wheel 3D / HUD Wheel (`rhombic-wheel-3d-core.js`), not a separate
baked coordinate list — so the logo is genuinely the same object as the
rest of the app's RD-everywhere identity. Deliberately still plain 2D
vertex math (rotate, orthographic-project, redraw `<line>` attrs on
`requestAnimationFrame`), NOT a THREE/WebGL scene: `render.js`'s own main
renderer is already running behind this overlay at welcome-screen time,
and a second simultaneous full WebGL render is a real, already-diagnosed
perf mistake in this codebase (see `hud-wheel-3d.js`'s header on why it
shares the main renderer via scissor rather than standing up its own) —
easiest way to not repeat that here is to just not use WebGL at all.
`startLogoSpin()`/its returned stop function run only while the overlay
is actually visible (started in `show()`, cancelled in `hide()`).

Iterated live against direct feedback the same day, in order: (1) ENTER
was first a plain button below the logo — rejected as "too similar to
the old version," moved onto a rotating face instead; (2) that face's
visibility was first a flat facing-based fade — direct feedback asked for
a pulsing/breathing appear-and-fade, so `breathe` (a sine wave on
`pulsePhase`) now multiplies the facing-based `sweep` rather than
replacing it; (3) the face was first an `equator`-ring rhombus (reads as
"horizontal") — direct feedback wanted a "vertically-aligned diamond,"
so `ENTER_FACE` moved to a `top`-ring face (checked numerically: also
happens to hit a higher peak facing-the-viewer value, ~0.96 vs the
equator faces' ~0.78, so it's an improvement on both axes); (4) an
`.enter-hint` caption under the tagline explaining the mechanic was
dropped per explicit "no explanation" feedback — the interaction is
meant to read as self-evident.

Real bug caught while verifying this in a real browser (Playwright, via
`tests/browser` — this repo's existing headless-smoke setup; plain
ImageMagick `import`/Pillow `ImageGrab` both failed outright in this
environment because the desktop session is Wayland/Mutter, not plain
X11): the first version incremented `angle`/`pulsePhase` by a fixed
amount per `requestAnimationFrame` call, implicitly assuming ~60fps. This
Pi doesn't hold that once `render.js`'s own WebGL scene is also live
behind the overlay, so the real-world rotation crawled — confirmed by
sampling `#enter-face-poly`'s `fill-opacity` over 14 real seconds and
seeing it barely move. Fixed by driving `angle`/`pulsePhase` off real
elapsed time (`performance.now()` deltas via `frame(t)`'s `dt`, clamped
to 0.1s so a tab-switch/GC pause doesn't jump the shape) instead of a
frame counter — `SPIN_SPEED`/`PULSE_SPEED` are rad/SECOND now, not
rad/frame.

One more legibility pass after that: the wireframe has no hidden-line
removal (every edge, front and back, is always drawn), so a subtle fill
read as clutter rather than a clear "this face is lit up" cue, and the
label's original near-black fill (matched to the *old* button's
dark-on-solid-cyan treatment) had too little contrast against a merely
translucent face. Fixed by brightening the label to a near-white
`#eafcff`, raising the fill-opacity multiplier (0.35 → 0.55), and adding
a stroke-width thicken-on-opacity touch to the active face's outline.

Prior history, superseded above: the old static `RD_EDGES` was drawn to
pixel-match `favicon.svg`'s own rotation/projection (this project's own
voxel shape, `lattice.js`'s `rdRawVerts`: 8 cube verts at radius 0.5, 6
octa verts at radius 1.0). 2026-08-23: a same-day redraw at a different
rotation with explicit vertex-dot circles was reverted — direct feedback
that it read as "too different" from the reference image and that the
dots read as unwanted "explicit round nodes." Checked numerically against
the reference (pixel-sampled vertex positions and stroke color) and that
original rotation/color were already a close match; the dots (not the
geometry) were the actual mismatch. `favicon.svg` itself is untouched by
the 2026-08-26 redesign — only this file's own logo changed.

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

## The persona grid — removed 2026-08-26

Used to be four clickable personas ("Consider making the four personas
clickable... letting a new player pick 'Rhombiologist' and land with the
grow wheel open would complete the onboarding arc") dispatching a
`rhombiverse:personaChosen` event for `render.js` to act on. Cut in the
2026-08-26 simplification pass — see `RD_EDGES_3D` section above for why.

## `skip` read failure (bottom of `init()`)

localStorage unavailable (private browsing, quota) — default to
showing the intro rather than failing closed.
