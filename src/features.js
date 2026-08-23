// Feature-flag registry, separating the geometric core (lattice, dual
// structure, Sculpture Mode) from the game-loop "World Systems" (mining,
// trade, claims, hazards, etc.) so the core can eventually run standalone.
// See RHOMBIVERSE_PLAN.md's "Core vs. Modules" section and CLAUDE.md's
// "Core vs. Modules" contribution-boundary section for the full picture.
//
// IMPORTANT, read before flipping any World Systems flag to false:
// Phase A of the Migration Path (RHOMBIVERSE_PLAN.md) is now complete --
// build.js/sculpture.js/worldstate.js (Core) and gravity.js (a Geometry
// Extension) no longer have static top-level `import`s of asteroids.js
// or regions.js. Instead render.js injects the real mineAsteroidCell/
// claimIdAt/isClaimProtected functions into them (build.js via a
// constructor param, the other three via each module's own
// setRegionsIntegration()), gated behind `mining`/`economy` respectively
// (see render.js's init()). Flip `mining` off and mining becomes a
// no-op there; flip `economy` off and those four modules treat all
// space as unclaimed.
//
// Two things this does NOT yet cover, so don't assume `mining`/`economy`
// fully disable those systems everywhere: render.js's OWN direct use of
// asteroids.js (seedAsteroidBelts/applyAsteroidRegeneration/
// applyPopulationScaledSpawning/listBelts) and regions.js (computeClaim/
// claimFootprintWorldVertices, the claim-footprint UI) stays
// unconditional -- render.js is the app's own orchestrator, not a
// Core/Geometry-Extension module, so this isn't a boundary violation,
// but it does mean belts still seed/regenerate and claim UI still
// renders regardless of the flag. And blackhole.js/starsystem.js/
// supernova.js's own isClaimProtected imports from regions.js are
// untouched too -- both are World Systems tier, so a same-tier
// dependency there isn't a boundary violation either, but it means
// `hazards` doesn't turn off claim-checking inside those three. Phase B
// (physically moving files into the planned directory layout) is
// unblocked by the above but not started -- see RHOMBIVERSE_PLAN.md's
// Migration Path.
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
  mining: true,       // build.js's own mineAsteroidCell call is gated; render.js's belt seeding/regen is not -- see note above
  economy: true,       // trade + inventory + claims/regions; trade's inventory-decay call AND the four Core/Geometry-Ext modules' claim checks are gated, render.js's own claim UI is not -- see note above
  achievements: true,
  animals: true,
  hazards: true,       // blackhole, supernova, starsystem -- NOT yet wired to conditional loading -- see note above
  hydrosphere: true,
};

// TODO: once hazards is actually untangled from Core (it isn't -- see
// note above; mining/economy's Core/Geometry-Ext side is done as of
// 2026-08-23, but render.js's own direct World Systems usage isn't
// flag-gated for any of them), this registry could back a "Pure
// Geometry / Full World" mode toggle in settings.js. Not built yet --
// don't add that UI until the underlying gating is real end-to-end for
// every flag above, not just the module-boundary half that's done today.
