// Feature-flag registry, separating the geometric core (lattice, dual
// structure, Sculpture Mode) from the game-loop "World Systems" (mining,
// trade, claims, hazards, etc.) so the core can eventually run standalone.
// See RHOMBIVERSE_PLAN.md's "Core vs. Modules" section and CLAUDE.md's
// "Core vs. Modules" contribution-boundary section for the full picture.
//
// IMPORTANT, read before flipping any World Systems flag to false:
// Phase A of the Migration Path (RHOMBIVERSE_PLAN.md) is complete --
// build.js/sculpture.js/worldstate.js (Core) and gravity.js (a Geometry
// Extension) no longer have static top-level `import`s of asteroids.js
// or regions.js. And as of 2026-08-24, render.js's OWN direct usage of
// mining/claims/hazards is flag-gated too, closing what used to be
// Phase A's "two remaining gaps": `mining`/`economy`/`hazards` each now
// gate a real `await import()` inside render.js's init() (mirroring the
// achievements/animals/hydrosphere/trade pattern), populating module-
// level bindings with safe inert defaults (no-op mining, "nothing is
// claimed", identity-passthrough hazard annotators) when a flag is off.
// Mining and hazards are pure data-layer -- every one of their many
// existing call sites throughout render.js is UNCHANGED, correctness
// comes entirely from which function is bound. Claims are the one
// system with a real clickable UI surface (Claim Land button, claim
// boundary rendering, the World presets/Load-World picker's claim-
// adjacent framing) -- that panel is explicitly hidden via
// updateWorldPanelVisibility()/the `if (FEATURES.economy)` block inside
// render.js's init(), not just left disabled underneath, so a disabled
// system can't be clicked into a broken half-state.
//
// Sculpture Mode's own scratch world (a real, separate world-state, not
// gated by any of these flags) additionally hides the World presets and
// asteroid-info panels whenever it's active, independent of the flags
// above -- see updateWorldPanelVisibility()'s own call sites in
// enterSculptureMode/exitSculptureMode. That isolation is a UI-only
// concern (CLAUDE.md's "a separate, isolated scratch workspace"), not a
// FEATURES flag, since Sculpture Mode itself is Core, always on.
//
// All World Systems flags default to true: every one of these is an
// already-shipped, live feature (see CLAUDE.md's status section), and this
// registry's own originating task was explicit that adding it must not
// cause visual/UI changes. Flip an individual flag to false only when
// deliberately testing a reduced/Pure-Geometry configuration.
export const FEATURES = {
  // Geometry Extensions — opt-in, still shape-focused
  dualSculpture: true,
  growth: true,
  cultivation: true,
  latticeZoom: true,
  gravity: true,

  // World Systems — secondary, game-loop, safe to disable. Every flag
  // below is now wired end-to-end (see the header comment above).
  mining: true,
  economy: true,
  achievements: true,
  animals: true,
  hazards: true,
  hydrosphere: true,
};

// A "Pure Geometry / Full World" mode toggle (RHOMBIVERSE_PLAN.md's
// Migration Path Phase C) can now be built on top of this registry --
// every flag is real, end-to-end, not just the module-boundary half
// that was done as of Phase A. Not built yet: still needs its own real
// design pass (where does the toggle live, does flipping it wipe an
// existing world's already-placed belts/claims or only affect new
// worlds, does it persist per-device or per-world) before adding UI.
