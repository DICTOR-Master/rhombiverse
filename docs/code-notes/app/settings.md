# Notes: `src/app/settings.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## Module overview

Single source of truth for the B1 Settings panel (sensitivity, invert-Y,
FOV, graphics quality, volume) — reachable only via the Advanced/Lab
entry point per `RHOMBIVERSE_UIUX_BUILD_PLAN.md` B1, never shown on the
main screen. Kept as a tiny pub/sub store rather than scattering these
five values across `render.js`/`player.js`'s own module-level consts, so
every consumer (camera FOV, `OrbitControls.rotateSpeed`, `player.js`
mouse look, `sfx.js` gain, renderer pixel ratio) reacts to a change the
same way.

## `DEFAULTS.sensitivity`

Multiplier on both `OrbitControls.rotateSpeed` and `player.js`'s own
`MOUSE_SENSITIVITY`.

## `DEFAULTS.fov`

Matches the camera's original hardcoded `PerspectiveCamera` fov.

## `DEFAULTS.byokProvider` / `byokApiKey` / `byokModel`

Bring-Your-Own-AI-Key (requested mid-B5): `'none' | 'anthropic' | 'openai'`.
The key/model live ONLY here (this visitor's own `localStorage`) — see
`byok.js`, never sent to this site's own server.

## `DEFAULTS.pureGeometry`

Migration Path Phase C (`RHOMBIVERSE_PLAN.md`): "Rhombeometry" mode —
World Systems (mining/economy/achievements/animals/hazards/
hydrosphere) forced off, geometry-only. Defaults to true — direct
instruction, matching "the geometry comes first" (the 2026-08-23
changelog's own framing): a first-time visitor lands in Rhombeometry,
not Full World, unless they choose otherwise. Read by `features.js` at
module-eval time, before `render.js`'s `init()` ever gates a single
World Systems import — so changing this needs a reload to take effect
(see `welcome.js`/`render.js`'s own toggle wiring).

## `onSettingsChange`

Returns an unsubscribe function, same shape as every other event-ish
helper in this codebase (`sync.js`'s `subscribeToSharedWorld`, etc.).
