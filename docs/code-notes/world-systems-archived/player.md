# Notes: `src/app/player.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## Module overview

Minimal first-person "Walk" controller for planetoid surfaces —
`RHOMBIVERSE_PLAN.md` Phase 5.5's other half (`gravity.js` supplies the
physics this reads). Deliberately NOT `three/addons`' `PointerLockControls`:
that class hard-codes world Y as "up" in its internal Euler math, which
breaks the moment gravity's "up" is a radial direction instead. This
builds camera orientation directly from yaw/pitch plus whatever `up`
`gravity.js` reports for the player's current position each frame, so
walking on a curved planetoid surface re-levels correctly; flying in
open space (no active planetoid) falls back to world Y and behaves like
a simple no-clip flycam — the "zero-gravity space between planetoids"
case section 4 allows for inert cells applies here too.

Known first-pass limitation: no roll blending between two DIFFERENT
planetoids' gravity fields in one session (up snaps instantly at the
boundary) — acceptable for now since a single-planetoid session is the
realistic first-playtest case; revisit if that changes.

## `applyLookDelta`

Shared by real mouse movement (pointer-lock, desktop) and the touch
look-drag zone (`render.js`) — same sensitivity/invert/clamp either
way, just a different source of raw dx/dy.

## `setVirtualMove` / `setVirtualKey` / `lookBy`

Touch has no keyboard and mobile browsers don't support Pointer Lock
the way desktop does — `render.js`'s on-screen joystick/look layer
drives movement and look through these instead of real keyboard/mouse
events. `virtualMove` is analog (joystick displacement, -1..1 per
axis), blended additively with any real WASD input rather than
replacing it, so a hybrid device with both isn't penalized.

## `update` — camera basis

Camera basis: align world-Y-up basis vectors to `up`, then apply yaw
around `up` and pitch around the yaw-adjusted right axis — the
standard "re-level to an arbitrary up vector" construction.

`moveDir.normalize()` only clamps when combined input actually exceeds
full speed (WASD + virtual joystick can otherwise stack past 1).

## `update` — open space

Open space: no momentum, direct fly-cam movement (up/down via
Space/Shift) — there's no "ground" to fall toward out here.
