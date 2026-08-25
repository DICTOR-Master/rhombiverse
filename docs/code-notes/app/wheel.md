# Notes: `src/app/wheel.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File overview

The Rhombic Wheel — `RHOMBIVERSE_UIUX_BUILD_PLAN.md` B1's radial menu,
the one control surface all mode/material interaction is meant to go
through once the old always-visible sidebar is gone.

Integration strategy: rather than re-implementing mode-switching/
material-selection state (`currentMode`, `MODE_HINTS`, `updateModeUI`,
the fill/generate/plant row visibility, etc. — all real, working logic
already in `render.js`), this wheel drives the EXACT SAME hidden shim
controls `render.js` already listens to (`.mode-btn[data-mode=...]`,
`#material-select`, `#generator-type-select`, `#species-select`,
`#walk-toggle`) via `.click()`/`.value`, then closes itself. Zero
backend/mode-logic duplication, per B1's own "do not modify... backend
logic in this pass" scope — this is a new INPUT layer on top of
unchanged logic, not a parallel implementation of it.

Rhombic grammar: every wheel entry is a real rhombus (a square rotated
45deg, not a circle or rectangle) per B1's explicit styling
requirement. The four first-level entries additionally sit at N/E/S/W
around the center, which traces a rhombus/diamond outline as a whole —
the shape language holds at both the single-control and
whole-composition level.

## `LEVEL1` (the "Grow" category)

B5: Cultivation Mode's own wheel placement was an explicit either/or in
the spec ("whichever of the existing 'Alter' category or a new 'Grow'
category fits the existing wheel taxonomy more cleanly... document
which one you chose"). Chose a new "Grow" category: Alter's own
identity is reshaping EXISTING structure (Dig/Smooth/Fill/Replace),
whereas Cultivation is about planting and tending living growth — a
different enough mental model that folding it into Alter would misfile
it, and the wheel already tolerates a non-diamond (5-item) layout fine
via `positionsFor`'s generic even-spacing.

## `BUILD_SUBMENU` / `ALTER_SUBMENU`

Build -> Place/Repeat/Pattern/Material and Alter -> Dig/Smooth/Fill/
Replace are B1's own literal table. `'mode'` entries proxy a hidden
`.mode-btn` by `data-mode`; `'tool'` entries are `build.js` behavior
toggles, not modes; `'material'` opens the level-3 material strip.

## `CREATE_SUBMENU`

B4a: the real Sculpture tool module (symmetry mirroring, shell brush,
Assistance Spectrum tiers) now lives behind the "Sculpt" leaf, opening
`#sculpt-panel` (`render.js` owns it — a dedicated panel, not a wheel
picker, since it has several independent controls at once: tier,
mirror plane, brush radius, and Full-Cyborg's text box). The other two
leaves are B1's original interim placement for the two pre-existing
"make a whole structure/organism" mechanics — kept as-is, B4a's own
text never asked for them to move.

## `GROW_SUBMENU`

B5: Cultivation's own dedicated panel, same reasoning as Sculpt's —
tier/growthParameters/NL box are several independent controls at once,
not a single pick-one-of-N leaf.

## Material wheel CSS (`#material-wheel-overlay` etc.)

B2: material selection is a true radial wheel of miniature rhombi (not
the linear strip generator/species pickers still use), with a live
structure-preview on hover — see `onHoverPreview` (passed in as
`onMaterialHoverPreview`).

## `readSelectOptions`

Flattens `<optgroup>` into `{group, value, label}` entries, and bare
`<option>`s into `{group: null, ...}` — single-sourced from the real
hidden `<select>` in `index.html` so the wheel can never drift out of
sync with what `render.js` actually reads via `.value`.

## `createRhombicWheel` options

- `onMaterialHoverPreview`/`onMaterialHoverEnd` (B2): material wheel
  extras. `getMaterialColor(value)` -> CSS color string keeps
  `MATERIAL_COLORS` single-sourced in `render.js` rather than
  duplicated here. These drive the live structure-preview on the
  current ghost cell (`render.js` owns the THREE scene, so the actual
  recoloring happens there).
- `onOpenSculptPanel` (B4a): Create -> Sculpt opens `render.js`'s own
  `#sculpt-panel` (several independent controls at once — tier/mirror/
  brush/NL box — don't fit the wheel's picker-strip or material-wheel
  patterns cleanly).
- `onOpenCultivatePanel` (B5): Grow -> Cultivate opens `render.js`'s
  own `#cultivate-panel`, same reasoning as `onOpenSculptPanel` above.

## `open()`'s `rhombiverse:wheelOpened` dispatch

B6's onboarding discovery sequence listens for this (see `render.js`/
`data/cyborg/onboarding.json`) — a real, generically useful signal,
same spirit as `build.js`'s `onPlaced`/`onHover`.

## `#hud-wheel-cue` click listener

Tab/Space is the whole menu-entry point, and phones have no keyboard to
send either — without this, the entire wheel (and everything reachable
only through it, e.g. Sculpt) is unreachable on touch. `#hud-wheel-cue`
already sits in the HUD for exactly this purpose; it just wasn't
clickable before.
