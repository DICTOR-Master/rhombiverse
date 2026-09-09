// Feature-flag registry: geometric core vs. the retired game-loop "World
// Systems" (mining, trade, claims, hazards). World Systems are archived,
// not deleted -- asteroids.js/trade.js/achievements.js and the rest still
// exist and still work, they're just permanently unreachable now
// (settings.js's getSettings() forces pureGeometry true unconditionally,
// so this file never has a live branch that could re-enable them; the
// `if` this used to be is gone because there's no longer a real "if").
// Full prior rationale/history: docs/code-notes/app/features.md.
export const FEATURES = {
  // Geometry Extensions — opt-in, still shape-focused
  dualSculpture: true,
  growth: true,
  cultivation: true,
  latticeZoom: true,
  gravity: true,
  // BCC dual-lattice: a nested detail lattice inside the existing RD
  // world, never touches world state -- see
  // geometry-extensions/bcc-detail-lattice.md. Was Rhombeometry-only;
  // now just always on, since Rhombeometry is the only mode.
  bccLattice: true,

  // World Systems — retired. Left named/false here (rather than deleted
  // from this registry) so any archived World Systems code that still
  // checks FEATURES.mining etc. keeps working exactly as it always has
  // (a safe no-op), same contract as before this change.
  mining: false,
  economy: false,
  achievements: false,
  animals: false,
  hazards: false,
  hydrosphere: false,
};
