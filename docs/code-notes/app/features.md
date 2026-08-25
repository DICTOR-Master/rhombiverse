# Notes: `src/app/features.js`

Full design rationale/history for this file, moved out of the source so
the code itself stays lite and readable — nothing here is new, it's the
exact commentary that used to sit inline. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## File header — the `FEATURES` registry itself

Feature-flag registry, separating the geometric core (lattice, dual
structure, Sculpture Mode) from the game-loop "World Systems" (mining,
trade, claims, hazards, etc.) so the core can eventually run standalone.
See `RHOMBIVERSE_PLAN.md`'s "Core vs. Modules" section and `CLAUDE.md`'s
"Core vs. Modules" contribution-boundary section for the full picture.

**IMPORTANT, read before flipping any World Systems flag to false:**
Phase A of the Migration Path (`RHOMBIVERSE_PLAN.md`) is complete —
`build.js`/`sculpture.js`/`worldstate.js` (Core) and `gravity.js` (a
Geometry Extension) no longer have static top-level `import`s of
`asteroids.js` or `regions.js`. And as of 2026-08-24, `render.js`'s OWN
direct usage of mining/claims/hazards is flag-gated too, closing what
used to be Phase A's "two remaining gaps": `mining`/`economy`/`hazards`
each now gate a real `await import()` inside `render.js`'s `init()`
(mirroring the achievements/animals/hydrosphere/trade pattern),
populating module-level bindings with safe inert defaults (no-op
mining, "nothing is claimed", identity-passthrough hazard annotators)
when a flag is off. Mining and hazards are pure data-layer — every one
of their many existing call sites throughout `render.js` is UNCHANGED,
correctness comes entirely from which function is bound. Claims are the
one system with a real clickable UI surface (Claim Land button, claim
boundary rendering, the World presets/Load-World picker's
claim-adjacent framing) — that panel is explicitly hidden via
`updateWorldPanelVisibility()`/the `if (FEATURES.economy)` block inside
`render.js`'s `init()`, not just left disabled underneath, so a
disabled system can't be clicked into a broken half-state.

Sculpture Mode's own scratch world (a real, separate world-state, not
gated by any of these flags) additionally hides the World presets and
asteroid-info panels whenever it's active, independent of the flags
above — see `updateWorldPanelVisibility()`'s own call sites in
`enterSculptureMode`/`exitSculptureMode`. That isolation is a UI-only
concern (`CLAUDE.md`'s "a separate, isolated scratch workspace"), not a
`FEATURES` flag, since Sculpture Mode itself is Core, always on.

All World Systems flags default to true: every one of these is an
already-shipped, live feature (see `CLAUDE.md`'s status section), and
this registry's own originating task was explicit that adding it must
not cause visual/UI changes. Flip an individual flag to false only when
deliberately testing a reduced/Pure-Geometry configuration.

Inside the object itself: "Geometry Extensions" are opt-in but still
shape-focused; "World Systems" are secondary/game-loop, safe to
disable, and every flag there is wired end-to-end (see the header
comment above).

## The Rhombeometry/Full World override (bottom of the file)

Migration Path Phase C (`RHOMBIVERSE_PLAN.md`): "Pure Geometry / Full
World" is a single visitor-level mode, not a per-world property — per
the 2026-08-23 changelog ("the FCC lattice geometry is the core, not
the mining/trade/hazard systems built on top of it"), Pure Geometry
mode is what World Systems are OPTIONAL ON TOP OF, not a separate
scratch space (that's Sculpture Mode's job) and not something a saved
world's own data carries. Choosing it just forces every World System
flag above off together; the five Geometry Extensions stay on either
way, since those ARE the core. Persisted per-device (`settings.js`,
alongside sensitivity/quality/BYOK), read here — before `render.js`'s
`init()` ever awaits a single World Systems import — so this mutation
is the only place that needs to know about it. Nothing is ever wiped:
`init()`'s existing per-flag gating already hides UI and no-ops
backend calls cleanly when a flag is off (proven per-flag by Phase
A/B), so a world's own saved cells/claims/belts data sits inert and
untouched, not deleted, while this mode is active.
