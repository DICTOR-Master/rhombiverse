# Notes: `src/app/sfx.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Tiny WebAudio blip generator for B1's "brief... sound on placement/
removal" requirement (`RHOMBIVERSE_UIUX_BUILD_PLAN.md`). No audio
assets exist anywhere in this repo yet, and adding a bundler/asset
pipeline just for two short beeps would violate the project's own
no-build-step rule (`CLAUDE.md`) — a couple of oscillator blips is the
Grounded-Simplicity-appropriate way to get real sound with zero new
tooling.

## `blip` — the suspended-AudioContext check

Browsers start an `AudioContext` 'suspended' until a user gesture —
every call here already happens inside a click/contextmenu handler, so
this is always safe to call, just occasionally a no-op resume.
