// Water & Ice 9.9 (planetoid hydrosphere) -- RHOMBIVERSE_SPEC_WATER_ICE.md.
// Full rationale: docs/code-notes/world-systems/hydrosphere.md
import { findClusters, BSG_MATERIAL } from '../geometry-extensions/gravity.js';

export const ICE99_MATERIAL = 'ice99';

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
