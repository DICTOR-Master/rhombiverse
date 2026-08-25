# Notes: `src/core/build.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File overview

Raycasts to find which of the 12 faces of a clicked RD was hit, then
acts according to the currently selected build MODE (an explicit
`#mode-*` button in `index.html`, read via `getMode()` — see
`render.js`). `RHOMBIVERSE_PLAN.md` section 4, Phase 2's original
click-to-add is now the "build" mode; three more modes (fill, round,
excavate) were added early, ahead of their originally planned phases,
at the user's request. Right-click always removes the clicked cell, in
every mode — kept as a single universal, unambiguous gesture rather
than folded into the mode system, per direct instruction (2026-08-11).

This replaced an earlier modifier-key scheme (Shift+click / Ctrl+click
/ Ctrl+Shift+click for fill/round/excavate) that grew unmanageable:
five behaviors on one "click" gesture, distinguished only by which
modifiers you remembered to hold, including two pairs of literal
opposites (fill vs. excavate, add vs. remove) one keystroke apart, with
no visual indication of what a click would currently do. An explicit
mode selector is the standard fix for this (how most voxel/CAD editors
handle multiple click tools) — exactly one mode active at a time,
visually shown, plain click does whatever that mode does.

Touch (tap / long-press) is not implemented yet [as of the original
writing of this comment — touch support landed 2026-08-13, see the
Touch section below] — documented here as a known gap rather than a
half-working touch handler.

## `NEIGHBOR_DIRECTIONS`

Unit-normalized neighbor directions, precomputed once. Every RD
instance shares the same (unrotated) orientation — see `lattice.js` —
and each RD face's outward normal points exactly along its
corresponding lattice neighbor direction (the RD is the FCC lattice's
own Voronoi cell), so a raycast hit's flat face normal maps directly
onto one of these 12 directions with no per-instance transform needed.

## `roundStructure`

"Rounds" a shell-filled structure: trims outer-shell cells that sit
past the outer shell's own average distance (its "points"/corners) and
fills any gap that leaves within a band near that target radius,
including candidates one shell further out whose true distance still
qualifies (shells overlap in raw distance — shell 5's max, 7.071, is
already past shell 6's min, 6.0). Never touches cells well inside the
target radius, so a hollow-shell structure's interior is left alone —
this only reshapes the current outer surface. `TOLERANCE` is a tunable
heuristic (per this project's own convention for unmeasured constants),
not a physically derived value.

## `excavateStructure`

Removes an existing structure's cells with `shell < minShell`, carving
out its interior. The center cell itself is never touched (it has no
`shell` field, so it never matches the filter).

## `removeShell`

Removes every cell at exactly one shell number for a structure — the
"select a ring to remove" panel in `render.js` calls this directly (not
via a canvas click), one ring at a time. Exported since `render.js`'s
ring-list UI needs it, unlike round/excavateStructure which are only
ever reached through `onClick`'s mode dispatch.

## `recolorShell`

Changes every cell at exactly one shell number to a different material
IN PLACE — no geometry change, so unlike a remove-then-refill via Fill
mode this never requires clicking a specific cell in the 3D view
(there's nothing left to click once a ring is removed) and can't
accidentally change which cells exist. Added because "remove a ring
and fill it in with a different material" turned out to really mean
"recolor this ring," and coordinating Fill mode's exact shell-range
inputs plus finding a valid cell to click was the actual source of
difficulty, not a missing remove/fill feature. `canPlaceMaterial`: same
frost-line check build.js's build/fill modes use
(`RHOMBIVERSE_SPEC_STAR_SYSTEM.md` section 3) — cells that fail it are
simply left at their current material (a partial recolor), same
"skip, don't block the whole action" behavior fill mode already has.

## `createBuildController` — parameters

- `renderer`/`camera`/`mesh`: the Phase 1 `render.js` scene objects to
  raycast against.
- `cellAt(instanceId)`: looks up the `{x,y,z,...}` cell for a hit instance.
- `world`: the `worldstate.js` store (has/addCell/removeCell).
- `onChange`: called after any mutation so the caller can re-sync the mesh.
- `getMode()`: reads the active build mode (`'build'|'fill'|'round'|'excavate'`)
  from the UI.
- `getShellCount()`/`getMinShell()`: read the fill/excavate shell range.
- `getMaterial()`: reads the selected material.
- `onCellClicked(cell)`: called with every successfully-hit cell,
  regardless of mode — `render.js` uses this to track which structure's
  shells the ring-list panel should currently show.
- `canPlaceMaterial` (`RHOMBIVERSE_SPEC_STAR_SYSTEM.md` section 3's
  frost line): optional, defaults to "always allowed" so callers that
  don't care about star placement rules (tests, future non-star
  worlds) don't need to pass one. `render.js` supplies the real check.
- `getOwnerId` (`RHOMBIVERSE_SPEC_ASTEROIDS.md`): optional, defaults to
  no real identity so callers that don't care about mining (tests,
  non-shared play still works — mining itself doesn't require Shared
  World, only inventory crediting does) don't need to supply one.
  `render.js` passes the session's real Supabase user id when connected.
- `mineRemote` (`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`): optional,
  defaults to null so local-only play (and tests) don't need to supply
  one — when set, Shared World asteroid mining routes through this
  instead of the local `mineAsteroidCell`, since inventory credit there
  has to be server-authoritative (see `sync.js`'s `mineAsteroidCellRemote`).
- `mineAsteroidCell` (`RHOMBIVERSE_PLAN.md`'s Core vs. Modules boundary,
  2026-08-23): mining is a World System, so `build.js` (Core) must not
  statically import `asteroids.js` — `render.js` injects the real
  `mineAsteroidCell` here instead, gated behind `FEATURES.mining` (see
  `render.js`'s own `createBuildController` call site). Defaults to a
  no-op so mining-disabled or asteroid-free callers (tests) don't need
  to supply one.
- `onHover`/`onHoverEnd`/`onPlaced`/`onRemoved` (`RHOMBIVERSE_UIUX_BUILD_PLAN.md`
  B1): "intelligent ghost block" hover preview and placement/removal
  feedback. All optional so tests and any future headless caller don't
  need to supply them. `onHover`: `(cells: [{x,y,z}], valid: boolean)` —
  one entry normally, two while "held".
- `getDragPlacementEnabled`: Wheel's Build->Repeat leaf (see `wheel.js`):
  while true, holding the left mouse button and dragging across faces
  places a cell under the cursor on every new face entered ("walls,
  curves" per the plan), instead of the default single click-to-place.
  Defaults to a no-op false so every other mode/tool is completely
  unaffected.

## `onClick` — mode dispatch

Plant mode's own click handling (`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`)
lives entirely in `render.js` (a separate listener on the same canvas)
— the `mode === 'plant'` early return is the one line of awareness
`build.js` needs so its own unconditional "build" fallthrough doesn't
ALSO place a normal RD cell on every Plant-mode click. Not an import,
not growth-specific logic, just a mode-string no-op matching the same
shape as every other mode branch here. B4a: Sculpt mode's own click
handling lives in `render.js` too (the Assistance Spectrum/brush/mirror
logic belongs to `sculpture.js`, not `build.js`) — same no-op shape as
Plant mode.

### `mode === 'report'`

Phase 5.8's "Report" action, minimally scoped: toggles a cell between
'flagged' and 'approved' status. No separate review-queue/role system
exists yet (no accounts), so this doubles as both the report AND the
un-report/approve action rather than a one-way flag with no way back —
`render.js`'s visibility filter hides 'flagged'/'removed' cells from
the default view without deleting them (quarantine, not delete, per
the plan).

### `mode === 'replace'`

`RHOMBIVERSE_UIUX_BUILD_PLAN.md` B1's Alter submenu (Dig/Smooth/Fill/
Replace). The other three all map onto an existing mode; nothing in
this codebase already does "swap one cell's material in place," so
this is genuinely new, small, and deliberately mirrors `recolorShell`'s
per-cell shape (`world.addCell` with the same data but a new material)
rather than inventing a different mechanic.

### `mode === 'fill'`

If the clicked cell already belongs to a shell-filled structure (it was
itself placed by, or is the original center of, an earlier fill), grow
THAT structure's true center outward instead of starting a new one
where you happened to click — otherwise a second fill-mode click on an
outer shell builds an unrelated same-sized cluster next door rather
than a bigger sphere.

Re-report focus with the now-definitive `centerKey`: on a fill that
just created a brand-new structure (cell had no `shellCenter` yet when
`onCellClicked` fired above, before this mutation), the earlier call
reported no focus at all — caught by a real integration test, not
assumed. Without this, the ring panel wouldn't show the shells you just
built until a second click.

## `onContextMenu`

`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 3: "extends Phase 2's existing
block-delete action" — right-click already removed any cell; an
asteroid-tagged one now also credits inventory and registers regrowth
instead of just vanishing.

Mining is checked BEFORE the `getMode()` gate, deliberately — Walk mode
reports a null mode specifically to disable general editing
(`getMode: () => (walking ? null : currentMode)`, see `render.js`), but
the belt-approach hint text has always promised "close enough to mine
— right-click an asteroid cell to harvest it" while walking. That
promise was silently false until this fix: harvesting an asteroid cell
is allowed regardless of mode, walking included; only editing a
NON-asteroid cell still needs a real mode.

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`: Shared World routes through the
server-authoritative RPC instead of a local `removeCell` +
`creditInventory` — deliberately NOT optimistic here, unlike every
other removal in this function. The cell only disappears once the
server confirms via realtime (`render.js`'s `applyRemoteDelete`), which
also means no `onChange()` call in that branch; nothing has actually
changed locally yet.

## Hover ghost ("intelligent ghost block", B1)

Translucent preview of the next valid FCC position on plain hover;
holding the button down (without enough movement to count as a drag)
shows a SECOND preview one cell further out along the same face
normal, previewing a two-deep placement before committing to it. Only
meaningful in 'build' mode — every other mode acts on the clicked cell
itself, not a new neighbor, so there's nothing sensible to
ghost-preview.

`suppressNextClick`: set after a drag-placement gesture so the
browser's own post-drag synthetic 'click' (fired on mouseup against the
same element the drag started on) doesn't ALSO place a cell at the
release point on top of whatever drag-placement already did.

`DRAG_MOVE_TOLERANCE`: px, matches the touch long-press's own drift
tolerance.

## Touch support (2026-08-13)

Tap-to-build needed zero new code — browsers already synthesize a
'click' from a real tap (OrbitControls' own one-finger-drag-orbit
already relies on this NOT firing on a real drag, so `onClick` already
does the right thing for a tap). What touch has no built-in equivalent
for is right-click-to-remove; the industry-standard mapping (Minecraft
Bedrock, and the wider voxel-builder convention researched before
building this) is long-press. Reuses `onContextMenu` directly via a
synthetic event object rather than duplicating its logic.

`LONG_PRESS_MOVE_TOLERANCE`: px — a held finger drifts a little even at rest.

`onTouchStart`: a second finger means pinch-zoom, not a build/remove
gesture — leave it to OrbitControls and cancel any pending long-press.

`onTouchEnd`: the browser would otherwise also synthesize a 'click'
right after this touchend — without suppressing it, a long-press
remove would immediately place a new block via `onClick`.
