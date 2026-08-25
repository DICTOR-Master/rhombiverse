// BCC dual-lattice Phase 2 (second revision, 2026-08-25): ONE continuous,
// globally-consistent BCC lattice sharing the FCC world's own coordinate
// frame and cellToWorld transform, at BCC's own real, established
// self-tiling scale -- not independently re-derived or re-centered per
// FCC cell. Full rationale: docs/code-notes/geometry-extensions/
// bcc-detail-lattice.md
//
// Why not the earlier per-cell-nested design (kept containment margins,
// re-centered on each parent RD): direct user feedback (2026-08-25) --
// each cluster was strictly contained inside its own parent cell with a
// safety margin, which deliberately kept content away from that cell's
// own boundary. That guarantees a dead zone at every FCC-FCC seam:
// clusters in adjacent cells never touch, even at identical scale, so it
// read as disconnected islands rather than a cohesive lattice. Direct
// instruction: "mathematically consistent and interchangeable" with FCC.
//
// This version drops containment margins entirely -- no longer needed,
// since the world already renders translucent while this is active
// (render.js's own depthWrite:false fix), so visual overlap with the FCC
// world is expected, not a defect to engineer around. Instead this
// builds a real, BFS-connected patch of BCC lattice points using BCC's
// own real neighbor offsets, at BCC's own real self-tiling scale (equal
// to SCALE, the same lattice constant FCC itself uses -- "interchangeable"
// taken literally, not a fraction of it), mirroring exactly how the FCC
// world itself is generated (cellsInShells + real neighbor offsets, one
// shared coordinate frame) rather than a separate, independently-derived
// mechanism.
import { cellsInShells, cellToWorld } from '../core/lattice.js';
import { BCC_NEIGHBOR_OFFSETS, truncatedOctahedronVertices, nearestBCCCell } from './dual-lattice.js';

export const BCC_LATTICE_MAX_SHELL = 1;

// Real, established self-tiling ratio (verified in dual-lattice's own
// Phase 1 work and this module's own tests): a BCC cell at lattice
// spacing `subScale` needs shape scale subScale/2 for its square/hex
// faces to exactly meet its neighbors' -- not re-derived here.
export function bccShapeScaleFor(subScale) {
  return subScale / 2;
}

// Real, connected BFS patch of BCC lattice points, seeded from whichever
// valid BCC coordinate is nearest to `nearWorldPos` (typically the
// camera) -- NOT tied to any specific FCC parent cell, so two patches
// generated from nearby seeds share real lattice neighbors wherever they
// overlap, the same continuity property the FCC world itself already has.
export function generateBCCLatticePatch(nearWorldPos, subScale, maxShell = BCC_LATTICE_MAX_SHELL) {
  const [nx, ny, nz] = nearWorldPos.map((v) => v / subScale);
  const [cx, cy, cz] = nearestBCCCell(nx, ny, nz);
  const localCells = [{ x: cx, y: cy, z: cz, shell: 0 }, ...cellsInShells(cx, cy, cz, maxShell, 1, BCC_NEIGHBOR_OFFSETS)];
  const shapeScale = bccShapeScaleFor(subScale);
  return localCells.map((cell) => ({
    x: cell.x, y: cell.y, z: cell.z, shell: cell.shell,
    worldPosition: cellToWorld(cell.x, cell.y, cell.z, subScale),
    scale: shapeScale,
  }));
}

export function bccDetailVertsFor(cell) {
  const [wx, wy, wz] = cell.worldPosition;
  return truncatedOctahedronVertices(cell.scale).map(([x, y, z]) => [x + wx, y + wy, z + wz]);
}
