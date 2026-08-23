// Feature-flag registry, separating the geometric core (lattice, dual
// structure, Sculpture Mode) from the game-loop "World Systems" (mining,
// trade, claims, hazards, etc.) so the core can eventually run standalone.
// See RHOMBIVERSE_PLAN.md's "Core vs. Modules" section and CLAUDE.md's
// "Core vs. Modules" contribution-boundary section for the full picture.
//
// IMPORTANT, read before flipping any World Systems flag to false:
// mining/economy/hazards are listed here for the registry's sake, but are
// NOT actually wired to conditional loading yet -- three modules that must
// stay always-on (build.js, sculpture.js, worldstate.js -- Core; gravity.js
// -- Geometry Extensions) have real, synchronous, top-level `import`
// dependencies on asteroids.js and regions.js. Gating those two behind a
// flag today would either break Core/Geometry-Extension loading (if the
// flag also touched their imports) or be a silent no-op (build.js's own
// static import of asteroids.js keeps mining code loading regardless of
// what this flag says). Untangling that is real, separate work -- see
// RHOMBIVERSE_PLAN.md's Migration Path, Phase A/B. Only
// achievements/animals/hydrosphere, and trade's inventory-decay call, are
// actually dynamic-import-gated today (see render.js's init()).
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

  // World Systems — secondary, game-loop, safe to disable
  mining: true,       // NOT yet wired to conditional loading -- see note above
  economy: true,       // trade + inventory + claims/regions; only trade's inventory-decay call is actually gated today, claims/regions is not (see note above)
  achievements: true,
  animals: true,
  hazards: true,       // blackhole, supernova, starsystem -- NOT yet wired to conditional loading -- see note above
  hydrosphere: true,
};

// TODO: once mining/economy(claims)/hazards are actually untangled from
// Core (RHOMBIVERSE_PLAN.md Migration Path Phase A/B), this registry could
// back a "Pure Geometry / Full World" mode toggle in settings.js. Not built
// yet -- don't add that UI until the underlying gating is real for every
// flag above, not just the four that are wired today.
