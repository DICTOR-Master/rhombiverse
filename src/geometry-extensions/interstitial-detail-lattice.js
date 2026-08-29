// Camera-following, non-destructive preview patches for the BCC
// interstitial-site tessellation (Octahedron Site / Disphenoid) --
// same role bcc-detail-lattice.js's generateBCCLatticePatch plays for
// BCC/TO, generalized to the Lattice Quick-View system (render.js's
// LATTICE_QUICK_VIEW_MODES) so every Piece-picker type gets a "where
// would this sit near me" lens, not just BCC/TO. Reuses the SAME real
// growth math core/build.js's own click-to-place path already uses to
// grow disphenoids/octahedra (interstitial-lattice.js) -- nothing here
// is a new geometric derivation, just non-writing patch assembly.
import { nearestBCCCell, BCC_NEIGHBOR_OFFSETS } from './dual-lattice.js';
import { cellsInShells } from '../core/lattice.js';
import {
  bootstrapDisphenoid, disphenoidFaces, disphenoidNeighborAcrossFace,
  disphenoidKey, disphenoidVertsToWorld, octahedronDisphenoids,
} from './interstitial-lattice.js';

export const DISPHENOID_PATCH_MAX = 14; // roughly BCC patch's own ~13-cell (maxShell=1) visual density
export const OCTAHEDRON_PATCH_MAX_SITES = 4; // -> up to 16 disphenoids, 4 real flattened-octahedra

// BFS-grown patch of disphenoids near a world position -- bootstraps
// from the nearest real BCC lattice point (dual-lattice.js's own
// nearestBCCCell, same snap bcc-detail-lattice.js's patch uses) and
// grows face-by-face via disphenoidNeighborAcrossFace, the exact same
// real neighbor rule a live click-to-place Disphenoid uses -- deduped
// by disphenoidKey so a face shared by two already-seen disphenoids
// doesn't regrow a duplicate.
export function generateDisphenoidPatch(nearWorldPos, subScale, maxCount = DISPHENOID_PATCH_MAX) {
  const [nx, ny, nz] = nearWorldPos.map((v) => v / subScale);
  const [ax, ay, az] = nearestBCCCell(nx, ny, nz);
  const seedVerts = bootstrapDisphenoid([ax, ay, az]);
  const seen = new Map(); // disphenoidKey -> verts
  seen.set(disphenoidKey(seedVerts), seedVerts);
  const frontier = [seedVerts];
  while (frontier.length && seen.size < maxCount) {
    const verts = frontier.shift();
    for (const { excludeIdx } of disphenoidFaces(verts)) {
      if (seen.size >= maxCount) break;
      const neighbor = disphenoidNeighborAcrossFace(verts, excludeIdx);
      const key = disphenoidKey(neighbor);
      if (seen.has(key)) continue;
      seen.set(key, neighbor);
      frontier.push(neighbor);
    }
  }
  return Array.from(seen.values()).map((verts) => disphenoidVertsToWorld(verts, subScale));
}

// BFS-grown patch of octahedron-site bundles (4 disphenoids each) near
// a world position -- reuses the exact same real BCC anchor patch
// bcc-detail-lattice.js's generateBCCLatticePatch grows (cellsInShells
// + BCC_NEIGHBOR_OFFSETS), one octahedron bundle per anchor along a
// single fixed axis (matching core/build.js's own bootstrap default,
// [2,0,0], for a fresh 'ioct' placement) -- a representative sample of
// orientations is enough for a preview lens, not every possible one.
export function generateOctahedronPatch(nearWorldPos, subScale, maxSites = OCTAHEDRON_PATCH_MAX_SITES) {
  const [nx, ny, nz] = nearWorldPos.map((v) => v / subScale);
  const [ax, ay, az] = nearestBCCCell(nx, ny, nz);
  const anchors = [{ x: ax, y: ay, z: az }, ...cellsInShells(ax, ay, az, 1, 1, BCC_NEIGHBOR_OFFSETS)].slice(0, maxSites);
  const axisOffset = [2, 0, 0];
  const seen = new Map(); // disphenoidKey -> verts, deduped across sites sharing a face
  for (const a of anchors) {
    for (const verts of octahedronDisphenoids([a.x, a.y, a.z], axisOffset)) {
      seen.set(disphenoidKey(verts), verts);
    }
  }
  return Array.from(seen.values()).map((verts) => disphenoidVertsToWorld(verts, subScale));
}
