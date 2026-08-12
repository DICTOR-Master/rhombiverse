// Planetoid gravity backend -- RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md,
// section 7's scoped first pass: single-point/single-cluster gravity
// source (section 4.1's simplest case: "one designated BSG cell or
// cluster"), NOT the multi-deposit weighted centroid of section 4.2 --
// deferred on purpose, matching RHOMBIVERSE_PRINCIPLES.md section 0's own
// worked example of Grounded Simplicity ("single-point BSG gravity was
// implemented before the more complex multi-deposit centroid option").
// Also skips the recentering shockwave (section 4.3) and its
// debounce/cooldown/scoping (4.4) entirely, per the spec's own Claude
// Code prompt -- there is no "correction event" in this pass, so
// Isolation/Adaptive Damping (RHOMBIVERSE_PRINCIPLES.md sections 1-2)
// don't yet apply; revisit when the shockwave follow-up lands.
import { NEIGHBOR_OFFSETS, cellKey, parseCellKey, cellToWorld } from './lattice.js';
import { isClaimProtected } from './regions.js';

export const BSG_MATERIAL = 'blackstar-glassite';

// First-guess constants, not yet playtested -- same "flag it, don't
// silently invent tuning math" convention this project already follows
// (build.js's roundStructure TOLERANCE, render.js's MAX_SHELL comment).
const BASE_GRAVITY_RADIUS = 2.2; // world units of reach with a single BSG cell
const RADIUS_PER_BSG = 0.5; // additional world units of reach per additional BSG cell
const AVG_SHELL_SPACING = 1.2; // world units/shell -- approximated from
  // build.js's roundStructure's own empirically-observed shell distances
  // (shell 5 max ~7.071, shell 6 min ~6.0), used ONLY for the soft
  // core-size UI hint below, never for the actual gravity math, so this
  // approximation is fine for that purpose.
const CORE_FRACTION = 1 / 3; // recommended core radius as a fraction of a
  // planetoid's own outer extent -- an arbitrary starting ratio, not
  // derived from anything; playtest before treating as final.

// Flood-fills every built cell into connected clusters via the same
// 12-direction adjacency as everything else in this lattice (build.js's
// neighbor matching, lattice.js's cellsInShells): two cells are in the
// same cluster iff connected through a chain of built neighbors.
export function findClusters(world) {
  const cells = world.entries();
  const byKey = new Map(cells.map((c) => [cellKey(c.x, c.y, c.z), c]));
  const visited = new Set();
  const clusters = [];

  for (const cell of cells) {
    const startKey = cellKey(cell.x, cell.y, cell.z);
    if (visited.has(startKey)) continue;
    const cluster = [];
    const stack = [startKey];
    visited.add(startKey);
    while (stack.length) {
      const key = stack.pop();
      cluster.push(byKey.get(key));
      const [x, y, z] = parseCellKey(key);
      for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
        const nKey = cellKey(x + dx, y + dy, z + dz);
        if (byKey.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          stack.push(nKey);
        }
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

// Shared per-cluster BSG math -- the single-point center-of-mass and
// gravity-radius formula, factored out so other spec modules that need
// the same "is this cluster gravitationally coherent, and how far does
// it reach" answer (blackhole.js's threshold/radius checks) reuse the
// exact same numbers computePlanetoids uses, rather than re-deriving
// them. Returns null for a cluster with no BSG cell at all (inert).
export function bsgClusterStats(cluster) {
  const bsgCells = cluster.filter((c) => c.material === BSG_MATERIAL);
  if (bsgCells.length === 0) return null;

  const sum = bsgCells.reduce(
    (acc, c) => {
      const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
      acc.x += wx;
      acc.y += wy;
      acc.z += wz;
      return acc;
    },
    { x: 0, y: 0, z: 0 }
  );
  const center = [sum.x / bsgCells.length, sum.y / bsgCells.length, sum.z / bsgCells.length];
  const gravityRadius = BASE_GRAVITY_RADIUS + (bsgCells.length - 1) * RADIUS_PER_BSG;
  return { bsgCells, center, gravityRadius };
}

// For every cluster containing at least one Blackstar-Glassite cell,
// computes its single-point gravity source, gravity radius, and a soft
// core-shell-size UI hint (section 3's shellCount(n), used here via the
// AVG_SHELL_SPACING approximation rather than a full BFS re-derivation --
// this is a UI suggestion only, per the spec's own "soft hint, not an
// enforced rule"). Clusters with no BSG cell at all are inert (no
// gravity), matching section 4: "cells beyond the current gravity radius
// are physically solid... but inert."
export function computePlanetoids(world) {
  const clusters = findClusters(world);
  const planetoids = {};
  let nextId = 1;

  for (const cluster of clusters) {
    const stats = bsgClusterStats(cluster);
    if (!stats) continue;
    const { bsgCells, center, gravityRadius } = stats;

    let surfaceRadius = 0;
    for (const c of cluster) {
      const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z);
      const d = Math.hypot(wx - center[0], wy - center[1], wz - center[2]);
      if (d > surfaceRadius) surfaceRadius = d;
    }

    const effectiveShells = Math.max(1, Math.round(surfaceRadius / AVG_SHELL_SPACING));
    const coreShellRecommendation = Math.max(1, Math.round(effectiveShells * CORE_FRACTION));

    // Both flip together (RHOMBIVERSE_SPEC_WATER_ICE.md section 4:
    // "permeation establishes both at once") -- reads the
    // hydrospherePermeated flag hydrosphere.js's applyHydrosphere already
    // stamped on this cluster's cells by the time this runs (render.js
    // calls applyHydrosphere before computePlanetoids on every change), so
    // no separate clustering pass or ice99 lookup is needed here.
    const hydrosphereActive = cluster.some((c) => c.hydrospherePermeated);

    planetoids[`planetoid_${nextId++}`] = {
      centerOfMass: center,
      gravityRadius,
      surfaceRadius,
      coreShellRecommendation,
      bsgCount: bsgCells.length,
      cellCount: cluster.length,
      hydrosphereActive,
      atmosphereActive: hydrosphereActive,
    };
  }
  return planetoids;
}

// The nearest planetoid to a world position, regardless of whether its
// gravity actually reaches that far (`active` reports which) -- used both
// for real gravity application (player.js only acts when active) and for
// the UI hint (useful even when nothing is active yet, e.g. "no gravity
// source" or "just out of range").
export function nearestPlanetoid(position, planetoids) {
  let best = null;
  let bestDist = Infinity;
  for (const [id, p] of Object.entries(planetoids)) {
    const [cx, cy, cz] = p.centerOfMass;
    const d = Math.hypot(position.x - cx, position.y - cy, position.z - cz);
    if (d < bestDist) {
      bestDist = d;
      best = { id, ...p, distance: d, active: d <= p.gravityRadius };
    }
  }
  return best;
}

// Gravity state at a world position for physics purposes -- null means
// open space (no active radial gravity there), matching section 4's
// "treat as normal flat-gravity or zero-gravity space" for inert cells;
// this project's space setting makes zero-gravity the natural default
// (see player.js).
//
// claims (optional, defaults to none): RHOMBIVERSE_SPEC_LOOPHOLES.md
// section 5's entity-pull consent gap -- block destruction inside a
// protected (destructible: false) claim was already blocked
// (blackhole.js/supernova.js's isClaimProtected checks), but nothing
// stopped a hazard's GRAVITY from still pulling a player's own avatar
// while standing inside one, which is a distinct unwanted effect. Reuses
// the exact same isClaimProtected check regions.js already provides for
// cells, applied here to the entity's own position (rounded to its
// nearest lattice cell, since claims are defined in cell space, not
// continuous world space -- an entity standing exactly between cells
// simply won't match any claim footprint, which is a safe, conservative
// fallback since this only ever withholds a protection benefit, never
// grants an exploit).
export function gravityAt(position, planetoids, claims = {}) {
  const nearest = nearestPlanetoid(position, planetoids);
  if (!nearest || !nearest.active) return null;
  const cx = Math.round(position.x);
  const cy = Math.round(position.y);
  const cz = Math.round(position.z);
  if (isClaimProtected(claims, cx, cy, cz)) return null;
  return nearest;
}
