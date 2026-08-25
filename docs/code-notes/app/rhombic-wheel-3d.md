# Notes: `src/app/rhombic-wheel-3d-core.js`, `src/app/rhombic-wheel-3d.js`

Full design rationale/history for these two files, moved out of source
per `CONTRIBUTING.md`'s "Ground rules" (see `docs/code-notes/app/
wheel.md` for the same pattern applied to the 2D wheel).

## File overview

A second, parallel navigation wheel built on the real RD mesh geometry
(Home/Construct/Build/Alter/Rhombitect/Cultivate/Trade + a single-
source universal ring), gated behind `FEATURES.rhombicWheel3D` (off by
default). Deliberately does NOT touch `wheel.js`'s existing 2D radial
menu — DICTO's stated direction (2026-08-25) is that this 3D wheel is
meant to eventually *replace* `wheel.js` entirely, not stay parallel to
it forever, but that's a later task; this one only adds the new
surface and proves it out.

`rhombic-wheel-3d-core.js` is geometry/config/style only — no THREE.js,
no DOM. `rhombic-wheel-3d.js` is the renderer: its own `THREE.Scene`/
`Camera`/`WebGLRenderer`/`Raycaster` in a modal overlay, independent of
wherever the main game camera happens to be when opened.

## Universal ring: single source of truth

`resolveWheelFaces()` is the one function every wheel (including Home)
passes through — it throws if a wheel config tries to redeclare a
universal-ring key. Verified (see `rw3d_check.mjs`-style Node script
during development): every wheel resolves to exactly 12 real geometric
slots, zero gaps, zero collisions.

## Construct is a real wheel, not a stub

The flow chart (`Flow_chart.md`, supplied by the user, cross-checked
against every built config and confirmed a faithful match) models
Construct as a routing grouping ("not a wheel with its own faces...
routes directly to Build or Alter"), not a full department wheel. But a
single click still has to resolve to exactly one of two destinations
somehow. First pass (2026-08-25) left it deliberately unwired with a
`Construct*` asterisk, per direct user decision, rather than guess
which target or invent a picker UI. Second pass, same day: built as a
real (mostly-spare) wheel with Build and Alter as its two populated
faces, reusing the exact same `navigateTo:<id>` mechanism every other
wheel already uses — no new UI paradigm. This is the "grouping with two
children" read of the flow chart's intent, not a literal violation of
it; the alternative (a popup picker, or routing through the 2D wheel)
would have added a whole new interaction pattern for one edge case.

## Tool wiring (`render.js`'s `onAction`)

Department faces trigger the real existing primitives
(`.mode-btn[data-mode=...]` clicks, panel-open functions) rather than
placeholders — same reuse strategy `wheel.js` itself already uses (see
`docs/code-notes/app/wheel.md`'s "Integration strategy"). Confidence
varies per action:

- Dig/Smooth/Fill/Rhombi-model (-> `build` mode)/Rhombi-sculpt: direct
  1:1 matches to real mode-btns.
- Plant: opens the real species picker first (see "Picker reuse"
  below), then sets `plant` mode + opens `#cultivate-panel` on pick —
  mirrors the 2D wheel's own picker -> mode -> prompt order exactly.
- Prune: no separate mode exists for it — it's a right-click gesture on
  an existing growth tile while already in `plant` mode (see
  `render.js`'s `contextmenu` listener calling `pruneTile()`). Sets the
  same real mode and explains the real gesture rather than inventing a
  mode that doesn't exist.
- Growth Params: opens `#cultivate-panel` (the real "Growth Parameters"
  section already lives there).
- Dome: opens the Sculpt panel with `dome` prefilled into
  `#sculpt-nl-input` — `src/core/sculpture.js`'s shape parser genuinely
  recognizes "dome" as a keyword. A judgment call (never a documented
  1-click action before this), not invented from nothing.
- Material / Generate a Body / Plant a Seed (species): see "Picker
  reuse" below — these three 2D-wheel capabilities had no assigned
  face anywhere in the flow-chart-derived structure until 2026-08-25.
  Material -> Build wheel's spare `equator|sx-1sy-1` (material choice
  is fundamentally a Build-mode concern). Generate a Body -> Rhombitect
  wheel's spare `equator|sx-1sy-1` (confirmed via `#generator-type-
  select`'s real options — Rocky Planetoid/Ice Moon/Gas Giant/etc. — to
  mean spawning a celestial body, not a creature; placed on Rhombitect
  per direct user decision rather than Build/Cultivate/Trade, closer to
  "spawn a whole world" than single-cell placement or organic growth).
  Species picker folded into Cultivate's existing Plant face rather
  than given its own — choosing what to plant is naturally part of
  choosing to plant, not a separate action.
- Spiral Column / Templates: genuine stubs — no backing mechanic
  anywhere in the codebase, unlike the three above.
- Offer / Accept / Inventory (Trade wheel): real, but only reachable
  via the in-world "Interact" trigger (walk up to another player, tap
  Interact — see `#interact-btn`) — there is no menu-driven way to
  start a trade. These open the Lab panel (where `#trade-panel`'s
  pending-trades list and `#inventory-hint` both really live) and
  explain the real mechanism rather than pretending a direct action
  exists. Judgment call.
- Replace: NOT wired. Discovered while wiring Alter that the
  underlying "replace" mode has zero implementation anywhere — no
  `.mode-btn[data-mode="replace"]` in `index.html`, no
  `currentMode === 'replace'` handling in `render.js`. The 2D wheel's
  own Replace item (`clickModeShim('replace')`) was already a silent
  no-op before this session touched anything. Not reproducing that
  silently in the 3D wheel — shows an honest "not built yet" instead.

## Picker reuse (`openMaterialPicker`/`openSpeciesPicker`/
`openGeneratorPicker` exports on `wheel.js`)

`wheel.js`'s own `openMaterialWheel`/`openPickerStrip` overlays
(`#material-wheel-overlay`, `#wheel-picker-strip`) are real, already-
independent DOM overlays — not part of the 2D wheel's own LEVEL1/
LEVEL2 radial visuals — so calling them from the 3D wheel doesn't
depend on the 2D wheel being open, and is safe regardless of its state.
Rather than duplicate that picker logic, three thin functions were
added to `createRhombicWheel`'s returned object that read the same
real `<select>` (`#material-select`/`#species-select`/`#generator-
type-select`) and open the same real overlay. Confirmed live via real
browser execution, not just code review: the material overlay opens
and shows a real "Material: X" HUD prompt on pick; the generator picker
opens and picking activates the real `generate` mode-btn; the species
picker opens and picking activates the real `plant` mode-btn and opens
the real cultivate panel.

## Real bugs found via testing, not code review

- **Label click-accuracy** (found by DICTO from real play, not by a
  test): the DOM label for each face is deliberately rendered offset
  outward from the actual mesh (along its normal, for legibility). The
  original click handler only raycasted against the mesh, so a real
  player aiming at the readable label text — the only thing they can
  actually see to aim at — could silently miss the hit-test at some
  viewing angles. Confirmed via a diagnostic: identical clicks at a
  label's exact screen position left `#rhombic-wheel-3d-panel`'s
  `innerHTML` byte-identical before/after, with `ALL_WHEELS` correctly
  loaded — the raycaster was correctly reporting no hit, because there
  was genuinely nothing there to hit. Fixed by making each label a real
  independent click target (`pointer-events` toggled to `auto` only
  once a label's real per-frame opacity exceeds 0.2, so an invisible/
  facing-away label can't steal a click), sharing a `selectFace(key)`
  function with the mesh-raycast path, plus a `startDrag()` helper so a
  drag that begins directly on a label still orbits the wheel.
- **Drag-vs-click spurious selection**: browsers fire a native `click`
  after any `mousedown`->`mouseup` pair on the same element, even with
  real movement in between — so orbiting the wheel by drag was also
  spuriously selecting whatever face ended up under the cursor on
  release. Fixed by tracking cumulative movement since `pointerdown`
  and suppressing the click handler's selection above a 5px threshold.
- **Redundant double-render**: `animate()`'s main loop in `render.js`
  was doing a full `renderer.render(scene, camera)` of the entire game
  world every frame even while this wheel's own overlay/renderer fully
  covered the screen — pure wasted GPU work, likely a real contributor
  (alongside genuine system contention during heavy debugging sessions)
  to slow local testing. Fixed via a bridged `isRhombicWheel3DOpen`
  module-level slot (same idiom `render.js` already uses for
  `tickPresenceFn`/`refreshHudIndicator`) that `animate()` checks
  before calling `renderer.render()` — skips only that call, keeps
  multiplayer presence ticking and controls damping running. One
  acknowledged trade-off: the wheel's intentionally semi-transparent
  dimmed backdrop (`rgba(2,2,6,0.55)`) freezes on its last frame
  instead of continuing to animate while the wheel is open. A full-repo
  audit (every `new THREE.WebGLRenderer` and every `.render(` call
  site) confirmed this was the *only* place two simultaneous
  `WebGLRenderer`s existed — every other panel (Lab, Sculpt, Cultivate,
  material picker) is plain DOM/CSS with no WebGL of its own.

## A similar-looking Playwright quirk, with a DIFFERENT correct fix

`CLAUDE.md` already documents `page.click('.wheel-item:has-text(...)')`
reproducibly hanging on the 2D wheel despite a provably correct/stable
DOM — a genuine Playwright/CDP polling failure, not an app bug, fixed
by dispatching `.click()` directly via `evaluate()` instead of
Playwright's own `page.click()`.

This wheel's own test scripts hit a same-looking symptom during
development — Playwright's actionability check reported labels as "not
stable" because they're genuinely, continuously repositioned every
frame by the render loop (unlike the 2D wheel's static-once-open
`.wheel-item`s). It is tempting to reach for the same `evaluate()` fix,
and that was tried first — it's WRONG here, confirmed by a real test
failure, not assumed: this wheel added real drag-vs-click
disambiguation (`dragDistance` tracked since the last `pointerdown`,
suppressing the click handler above a 5px threshold — see "Drag-vs-
click spurious selection" above) that the 2D wheel has no equivalent
of. `element.evaluate((e) => e.click())` calls the native DOM method
directly and never fires a real `pointerdown`, so `dragDistance` is
never reset before the click handler checks it — left holding whatever
large value accumulated from the last real drag, it silently swallows
every subsequent click via the same guard that's supposed to stop
spurious drag-end selections. The correct fix for THIS component is
`page.click(selector, { force: true })` — a real synthetic
`pointerdown`->`pointerup`->`click` sequence that resets `dragDistance`
at the right moment, just skipping Playwright's stability *wait*, not
the event sequence itself. Two components that look alike (both are
"wheel" click targets, both hit a Playwright actionability quirk) can
still have genuinely different correct fixes when their underlying
interaction models differ — don't reuse a fix by surface analogy alone,
verify it against what actually broke.
