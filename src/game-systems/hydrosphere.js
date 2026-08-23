// Water & Ice 9.9 (planetoid hydrosphere) -- RHOMBIVERSE_SPEC_WATER_ICE.md.
// A benign material system: no blast radius, no ledger cost, no
// destructible/consent flag -- deliberately does NOT touch the black
// hole's containment framework (see that spec's own section 3). Water
// itself needs no code here at all -- it's already an ordinary,
// freely-placeable material via the existing material picker/build modes
// (section 1: "same tier as Base Rhomb or Garnet"). The only real
// mechanic is Ice 9.9's context-dependent liquify-and-permeate behavior
// (section 3), which reuses the exact same cluster/BSG detection already
// built for planetoid gravity rather than re-deriving it.
import { findClusters, BSG_MATERIAL } from '../geometry-extensions/gravity.js';

export const ICE99_MATERIAL = 'ice99';

// For every connected cluster (same NEIGHBOR_OFFSETS adjacency as
// gravity.js) containing at least one Blackstar-Glassite cell, converts
// any Ice 9.9 cell IN THAT SAME CLUSTER from a stable solid block to
// permeated water -- section 3: "spreads through the existing structure
// ... using the same 12-neighbor adjacency already established," i.e.
// the whole connected structure, not just cells directly touching the
// core. Mutates `world` in place. Idempotent and safe to call on every
// world change: already-permeated cells are skipped (never reconverted
// or reverted -- section 3's "no core-placement conversion behavior,
// only the two states" is one-directional by construction here), and
// clusters with no BSG or no Ice 9.9 are untouched entirely.
export function applyHydrosphere(world) {
  const clusters = findClusters(world);
  for (const cluster of clusters) {
    const hasBSG = cluster.some((c) => c.material === BSG_MATERIAL);
    if (!hasBSG) continue;
    for (const cell of cluster) {
      if (cell.material === ICE99_MATERIAL && !cell.hydrospherePermeated) {
        const { x, y, z, ...data } = cell;
        world.addCell(x, y, z, {
          ...data,
          material: 'water',
          sourceMaterial: ICE99_MATERIAL,
          hydrospherePermeated: true,
        });
      }
    }
  }
}
