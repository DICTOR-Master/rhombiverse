// Star System Anchor -- RHOMBIVERSE_SPEC_STAR_SYSTEM.md. "A star is
// simply a sufficiently massive Blackstar-Glassite core -- same
// material, same gravity mechanic already spec'd, no new material type"
// (section 1) -- exactly the same move as Black Hole's own framing, and
// independent of it: a cluster can cross the (lower) star threshold
// without ever reaching the black hole threshold, or in principle both,
// since the spec doesn't state exclusivity between the two.
import { cellToWorld } from './lattice.js';
import { BSG_MATERIAL, findClusters, bsgClusterStats } from './gravity.js';

// First-guess constants, not yet playtested -- same convention as every
// other tunable in gravity.js/blackhole.js. STAR_BSG_THRESHOLD is
// deliberately lower than blackhole.js's BLACK_HOLE_BSG_THRESHOLD (20):
// a star is meant to be a reachable mid-game milestone, not an endgame
// rarity -- most players will hit Supernova's own critical-mass
// threshold (a separate, higher constant in supernova.js) well before
// ever accumulating enough BSG to become a black hole by direct
// accretion alone, matching how real stars only reach black-hole density
// via collapse, not steady growth.
export const STAR_BSG_THRESHOLD = 8;
const LUMINOSITY_PER_BSG = 1.5; // arbitrary UI-facing scale, not physically calibrated
const CARBON_CATALYST_MATERIAL = 'ferrostone'; // reused per spec section 2's own explicit
  // permission ("default to reusing something existing before adding a
  // new material type") -- Ferrostone is the closest existing fit for a
  // common, unglamorous, structural catalyst material.
const FROST_LINE_FRACTION = 0.6; // fraction of a star's gravityRadius, first-guess

export function isStar(planetoid) {
  return planetoid.bsgCount >= STAR_BSG_THRESHOLD;
}

export function luminosity(planetoid) {
  if (!isStar(planetoid)) return 0;
  return (planetoid.bsgCount - STAR_BSG_THRESHOLD + 1) * LUMINOSITY_PER_BSG;
}

// Exported: supernova.js reads/extends this same shape (accumulated
// mass, detonation state) rather than inventing a second ledger, per
// that spec's own "extends the existing... ledger pattern" instruction.
export function defaultLedger() {
  return { hydrogenConsumed: 0, carbonConsumed: 0, activeTicks: 0, recentFusionTimes: [], detonated: false };
}

// Sticky core-cell selection, same pattern as blackhole.js's pickCoreCell
// -- kept independent (not shared) since a cluster's black-hole core cell
// and star core cell are conceptually different ledgers that could, in
// principle, both live on cells of the same cluster without colliding
// (different field names: starLedger vs blackHoleLedger). Exported: a
// star's own core cell is also where supernova.js's detonation state
// lives, per that spec's own instruction to extend this same ledger
// rather than invent a second one.
export function pickCoreCell(cluster, center) {
  const existing = cluster.find((c) => c.material === BSG_MATERIAL && c.starLedger);
  if (existing) return existing;
  let best = null;
  let bestDist = Infinity;
  for (const c of cluster) {
    if (c.material !== BSG_MATERIAL) continue;
    const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
    const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
    if (d < bestDist - 1e-9) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// Fusion: a star cluster with BOTH hydrogen feedstock (at least one
// `hydrospherePermeated` cell -- section 2's "Hydrogen -- consumed as
// fusion fuel... Ice 9.9 is water, which splits into real fusion fuel
// plus a useful byproduct") and carbon catalyst (at least one
// CARBON_CATALYST_MATERIAL cell) present anywhere in the cluster sustains
// active fusion. Deliberately does NOT physically delete/deplete those
// feedstock cells each tick -- Ice 9.9's hydrosphere is a standing
// network (RHOMBIVERSE_SPEC_WATER_ICE.md section 3: "spreads through the
// existing structure"), not a one-shot consumable, so treating its mere
// PRESENCE as the fuel gate (rather than destroying player-built cells as
// an automatic side effect every world change) is the non-destructive,
// non-surprising reading. The ledger itself still accumulates in the
// same "consumption pattern, same shape" the spec asks for
// (hydrogenConsumed/carbonConsumed tally up each active tick), it just
// isn't backed by deleting real matter -- an explicit implementation
// choice, not an oversight. Oxygen byproduct feeding atmosphere needs no
// separate code: fusion's own hydrogen source (hydrospherePermeated)
// already implies hydrosphereActive/atmosphereActive are already true
// for that same cluster (gravity.js sets both from the same flag), so
// section 2's "Oxygen released... feeding the existing atmosphere
// mechanic" is satisfied structurally, not by a second flag.
export function applyStarFusion(world, now = Date.now()) {
  const clusters = findClusters(world);
  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats || stats.bsgCells.length < STAR_BSG_THRESHOLD) continue;

    const hasHydrogen = cluster.some((c) => c.hydrospherePermeated);
    const hasCarbon = cluster.some((c) => c.material === CARBON_CATALYST_MATERIAL);
    if (!hasHydrogen || !hasCarbon) continue;

    const coreCell = pickCoreCell(cluster, stats.center);
    if (!coreCell) continue;
    const ledger = coreCell.starLedger ?? defaultLedger();
    // A detonated star (RHOMBIVERSE_SPEC_SUPERNOVA.md) is spent -- "a
    // single, bounded detonation, not a runaway process" -- so fusion
    // stops accumulating further mass once that's happened, rather than
    // silently re-arming for a second detonation.
    if (ledger.detonated) continue;
    const { x, y, z, ...data } = coreCell;
    world.addCell(x, y, z, {
      ...data,
      starLedger: {
        ...ledger,
        hydrogenConsumed: ledger.hydrogenConsumed + 1,
        carbonConsumed: ledger.carbonConsumed + 1,
        activeTicks: ledger.activeTicks + 1,
        recentFusionTimes: [...ledger.recentFusionTimes, now].filter((t) => now - t <= 10000),
      },
    });
  }
}

// Frost line (section 3): one distance threshold from EACH active star's
// center. Inside it, only rocky/metallic materials are placeable; Ice 9.9
// cannot be placed there at all. Beyond it, anything goes (matches the
// spec's "no Ice 9.9 possible here" / "Ice-9.9-rich" framing -- rocky
// materials aren't forbidden beyond the line, only Ice 9.9 is forbidden
// inside it). A position with no star nearby has no frost-line
// restriction at all -- ordinary planetoids are unaffected.
export function frostLineDistance(starPlanetoid) {
  return starPlanetoid.gravityRadius * FROST_LINE_FRACTION;
}

// Checked by build.js before placing a cell (see render.js wiring).
// `stars` is the list of star-classified planetoid records (already
// annotated with isStar via annotateStars below). Returns true if
// `material` is placeable at (x,y,z) given every nearby star's frost
// line; false rejects the placement.
export function canPlaceMaterial(material, x, y, z, stars) {
  if (material !== 'ice99') return true; // frost line only restricts Ice 9.9 (section 3)
  const [wx, wy, wz] = cellToWorld(x, y, z);
  for (const star of stars) {
    const [cx, cy, cz] = star.centerOfMass;
    const d = Math.hypot(wx - cx, wy - cy, wz - cz);
    if (d < frostLineDistance(star)) return false;
  }
  return true;
}

// Read-only summary for UI/tests, same pattern as blackhole.js's
// annotateBlackHoles -- attaches luminosity/fusion/frost-line info onto
// the matching planetoid record by centerOfMass identity.
export function annotateStars(planetoids, world) {
  const clusters = findClusters(world);
  const out = { ...planetoids };
  for (const [id, planetoid] of Object.entries(out)) {
    if (!isStar(planetoid)) continue;
    const cluster = clusters.find((c) => {
      const stats = bsgClusterStats(c);
      return (
        stats &&
        Math.hypot(
          stats.center[0] - planetoid.centerOfMass[0],
          stats.center[1] - planetoid.centerOfMass[1],
          stats.center[2] - planetoid.centerOfMass[2]
        ) < 1e-6
      );
    });
    const stats = cluster ? bsgClusterStats(cluster) : null;
    const coreCell = stats ? pickCoreCell(cluster, stats.center) : null;
    const ledger = coreCell?.starLedger ?? defaultLedger();
    const fusionActive =
      !!cluster &&
      cluster.some((c) => c.hydrospherePermeated) &&
      cluster.some((c) => c.material === CARBON_CATALYST_MATERIAL);
    out[id] = {
      ...planetoid,
      isStar: true,
      luminosity: luminosity(planetoid),
      fusionActive,
      hydrogenConsumed: ledger.hydrogenConsumed,
      carbonConsumed: ledger.carbonConsumed,
      accumulatedMass: ledger.hydrogenConsumed + ledger.carbonConsumed,
      detonated: ledger.detonated,
      frostLineDistance: frostLineDistance(planetoid),
    };
  }
  return out;
}
