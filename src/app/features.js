import { getSettings } from './settings.js';

// Feature-flag registry: geometric core vs. game-loop "World Systems"
// (mining, trade, claims, hazards). Full rationale/history (including
// the IMPORTANT flag-gating notes and the Rhombeometry override below):
// docs/code-notes/app/features.md
export const FEATURES = {
  // Geometry Extensions — opt-in, still shape-focused
  dualSculpture: true,
  growth: true,
  cultivation: true,
  latticeZoom: true,
  gravity: true,
  // BCC dual-lattice Phase 2: Rhombeometry-only, a nested detail lattice
  // inside the existing RD world, never touches world state -- see
  // geometry-extensions/bcc-detail-lattice.md.
  bccLattice: false,
  // Rhombic Wheel 3D: a second, parallel navigation wheel built on the
  // real RD mesh (Home/Build/Alter/Rhombitect/Cultivate/Trade + universal
  // ring), alongside the existing 2D wheel.js -- not a replacement for
  // it. See app/rhombic-wheel-3d.js. Off by default until verified.
  rhombicWheel3D: false,

  // World Systems — secondary, game-loop, safe to disable, wired end-to-end.
  mining: true,
  economy: true,
  achievements: true,
  animals: true,
  hazards: true,
  hydrosphere: true,
};

// Migration Path Phase C: Rhombeometry mode forces every World System
// flag off together (Geometry Extensions stay on) -- see companion doc.
if (getSettings().pureGeometry) {
  FEATURES.mining = false;
  FEATURES.economy = false;
  FEATURES.achievements = false;
  FEATURES.animals = false;
  FEATURES.hazards = false;
  FEATURES.hydrosphere = false;
  FEATURES.bccLattice = true;
}
