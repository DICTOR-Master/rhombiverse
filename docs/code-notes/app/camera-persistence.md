# Notes: `src/app/camera-persistence.js`

Full design rationale/history for this file, moved out of the source so
the code itself stays lite and readable. See `CONTRIBUTING.md`'s "Ground
rules" for why this split exists.

## Why this exists

DICTO reported (2026-08-26): after building real, persisted world cells
positioned to visually match the BCC dual-lattice preview (`bcc-detail-
lattice.js`'s `rebuildBCCLatticeDetail`), returning to Rhombiverse later
showed the preview and the previously-built cells with a real gap between
them. Traced the cause: that preview seeds itself from `controls.target`
(the orbit camera's own look-at point, see `rebuildBCCLatticeDetail`'s own
`refPos`) every time it refreshes, and `src/render.js` had no persistence
for camera position at all — every fresh load hard-reset it to a fixed
default (`camera.position.set(6, 5, 8)`, `controls.target.set(0, 0, 0)`).
So toggling BCC back on next session always reseeded from that default
spot, not from wherever the camera actually was when the cells got built,
and the two drifted apart with no way to tell why.

This module + its wiring in `render.js` (right after `controls` is
constructed) fixes the general case: camera position/target now survive a
reload, so returning to the app resumes the exact view you left, which in
turn makes anything seeded live from that view (BCC preview included)
reseed to the same place too.

## What's persisted, what isn't

Only `camera.position` and `controls.target` — the two values already
used everywhere else in `render.js` (e.g. `refPos` in the mine-warning/
BCC/wheel-picker code) as the canonical "where is the viewer" signal.
Walk-mode-specific state (whether you were walking, facing direction,
gravity/collision setup) is NOT restored — `player.js`'s controller
directly drives `camera.position` while walking (see its own `position`
setter), so a plain position/target restore at least puts you back in the
right neighborhood even after walking somewhere, without needing to
reconstruct full walk-mode state on load.

## Save triggers

Three, deliberately layered rather than relying on just one:

- `controls.addEventListener('end', ...)` — OrbitControls' own `'end'`
  event fires once per real interaction gesture (mouseup/touchend after a
  drag), not every frame like `'change'` does. The primary save path for
  ordinary camera use.
- `setInterval(persistCameraState, 3000)` — catches walk-mode movement,
  which never fires an OrbitControls event at all (the player controller
  moves `camera.position` directly, independent of `controls`).
- `window.addEventListener('beforeunload', ...)` — last-moment safety net
  for a close/reload landing between interval ticks.

## The Sculpture Mode guard

`persistCameraState()` skips saving while `sculptureModeActive` is true.
Sculpture Mode (`enterSculptureMode` in `render.js`) already saves/
restores the pre-entry camera into its own **in-memory** (not persisted)
`savedCameraState`, then resets `camera`/`controls` to a fixed scratch-
space view for the duration. Without this guard, this module's own
interval/`beforeunload` saves would happily overwrite the real saved
world-view position with whatever transient view the user was navigating
inside the scratch sculpture space — silently corrupting the "resume
where you left off" behavior for the actual world.

## What this deliberately does NOT change

`bcc-detail-lattice.js`'s `scheduleBCCRefresh` still live-follows the
camera continuously while BCC stays toggled on within a session — that's
a separate, already-directly-requested behavior (see that function's own
header, 2026-08-25: "so BCC detail keeps following the camera instead of
freezing at whatever position it was toggled on at"). This fix is
specifically about the *cross-session* default-reset case, not about
changing how the preview behaves while you're actively using it.
