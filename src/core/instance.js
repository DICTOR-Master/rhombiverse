// Crystal Core "instance" primitives: pure geometry only (position,
// generation, appearance), no genome/reproduction/survival. Shared by
// growth.js's own player-cultivation path and world-systems/evolution.js's
// organism path, so the seed-record shape is built in exactly one place.
// See RHOMBIVERSE_CLAUDE_CODE_IMPLEMENTATION_PLAN.md section 3 (delivered
// 2026-08-31) for the plantInstance/growInstance naming this formalizes.
import { growSeed, VALID_TRIPLES } from '../geometry-extensions/growth.js';

// Same seed-record shape growth.js's own plantSeed() builds -- factored
// out here so evolution.js's plantOrganism() no longer duplicates it.
export function plantInstance({ species, origin, now = Date.now() }) {
  const firstTriple = VALID_TRIPLES.find((t) => t.type === 'acute');
  return {
    species,
    origin,
    plantedAt: now,
    lastGrowthAt: now,
    generation: 0,
    tiles: [{ type: firstTriple.type, dirs: [...firstTriple.dirs], origin: [0, 0, 0] }],
  };
}

// growth.js's growSeed is already pure geometry (tiles/generation/
// lastGrowthAt/cachedBoundingRadius only) -- re-exported under the
// instance vocabulary rather than moved, so growth.js itself stays
// untouched.
export const growInstance = growSeed;

// The genome-free half of evolution.js's genomeToPhenotype(): given
// plain slider-style inputs (not a genome), produces the same
// phenotypeOverride shape growSeed() already accepts. Lets Rhombeometry
// mode's Cultivate flow build a phenotypeOverride without importing the
// game-layer evolution.js at all.
export function phenotypeFromSliders({ growthRate, maturitySize, preferType = null }) {
  return {
    facesPerTick: Math.round(1 + growthRate * 5), // 1..6
    preferType,
    maxGeneration: Math.round(maturitySize), // 3..15
  };
}
