// BCC dual-lattice Phase 2 (revised): a genuinely non-overlapping way for
// the BCC truncated-octahedron lattice to interpenetrate the FCC/RD world --
// nested INSIDE each parent RD cell's own volume, at a smaller scale,
// structurally similar to latticezoom.js's own generateSubLatticeAt (same
// isolation rule: never touches worldstate.js's cell schema) but with a
// different scale derivation -- see below for why. Full rationale:
// docs/code-notes/geometry-extensions/bcc-detail-lattice.md
//
// Why nested, not same-scale: two DIFFERENT lattices' full-size Voronoi
// cells can never be simultaneously gap-free AND overlap-free everywhere
// (a Voronoi tiling is by definition 100% space-filling, so a second
// lattice's full-size cells always cut into the first somewhere -- proven
// via a real SAT overlap test, not assumed).
//
// Why NOT latticezoom's own volume-conservation trick: that technique
// (shrink sub-cells so their combined volume exactly equals the parent's)
// is only a valid containment guarantee when the sub-cells are the SAME
// shape as the parent, recursively tiling it with the same lattice rule --
// trivially exact because it's literally the same space-filling tiling at
// smaller scale. It does NOT generalize to nesting a foreign shape: a
// single BCC cell volume-matched to its parent RD still pokes outside the
// RD's own boundary (caught by this file's own test suite, not assumed --
// equal volume never implies containment for two different convex solids
// sharing a center). Real fix: derive the scale from actual containment --
// numerically compute the parent RD's inradius and the BCC sub-lattice's
// own worst-case reach (farthest cell center + that cell's own
// circumradius) at a unit scale, then scale down so the real reach fits
// inside the real inradius, with an explicit safety margin.
import { cellsInShells, cellToWorld, rdRawVerts, NEIGHBOR_OFFSETS } from '../core/lattice.js';
import { BCC_NEIGHBOR_OFFSETS, truncatedOctahedronVertices } from './dual-lattice.js';

export const BCC_DETAIL_MAX_SHELL = 1;

// Leaves real clearance between the outermost BCC sub-cell and the parent's
// own boundary -- not shaved to the exact theoretical limit, so float error
// and any future tweak to either shape's vertex generator can't tip it into
// overlap silently.
export const BCC_DETAIL_SAFETY_MARGIN = 0.85;

function dot([ax, ay, az], [bx, by, bz]) { return ax * bx + ay * by + az * bz; }
function normalize([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return len < 1e-9 ? null : [x / len, y / len, z / len];
}

// Real, numeric inradius (center-to-nearest-face distance) of the parent
// RD at scale=1 -- computed from rdRawVerts' own output via its real face
// normals (NEIGHBOR_OFFSETS: a Voronoi cell's facets are always the
// perpendicular bisectors toward each neighbor), not hand-derived.
function rdInradiusUnit() {
  const verts = rdRawVerts(1);
  let inradius = Infinity;
  for (const off of NEIGHBOR_OFFSETS) {
    const axis = normalize(off);
    const maxProj = Math.max(...verts.map((v) => dot(v, axis)));
    inradius = Math.min(inradius, maxProj);
  }
  return inradius;
}
const RD_INRADIUS_UNIT = rdInradiusUnit();

export function bccCellCount(maxShell = BCC_DETAIL_MAX_SHELL) {
  // BCC_NEIGHBOR_OFFSETS mixes two edge lengths (8 body-diagonal + 6 axis),
  // so there's no closed shellCount()-style formula the way FCC's 12
  // same-length neighbors give -- count the real generated cells directly.
  return 1 + cellsInShells(0, 0, 0, maxShell, 1, BCC_NEIGHBOR_OFFSETS).length;
}

// Real, numeric worst-case reach of the BCC sub-lattice at unit sub-scale
// (subScale=1, shapeScale=0.5): the farthest any point of any sub-cell's
// own truncated-octahedron shape gets from the shared center, in raw
// (unscaled) units -- computed from the real generated cells and the real
// generated shape vertices, not assumed from either shape's own formula.
function bccWorstCaseReachUnit(localCells) {
  let reach = 0;
  const unitShapeVerts = truncatedOctahedronVertices(0.5);
  for (const cell of localCells) {
    const [cx, cy, cz] = cellToWorld(cell.x, cell.y, cell.z, 1);
    for (const [vx, vy, vz] of unitShapeVerts) {
      reach = Math.max(reach, Math.hypot(cx + vx, cy + vy, cz + vz));
    }
  }
  return reach;
}

export function generateBCCSubLatticeAt(parentCenter, parentScale, maxShell = BCC_DETAIL_MAX_SHELL) {
  const localCells = [{ x: 0, y: 0, z: 0, shell: 0 }, ...cellsInShells(0, 0, 0, maxShell, 1, BCC_NEIGHBOR_OFFSETS)];
  const reachUnit = bccWorstCaseReachUnit(localCells);
  const subScale = parentScale * (RD_INRADIUS_UNIT / reachUnit) * BCC_DETAIL_SAFETY_MARGIN;
  const shapeScale = subScale / 2;
  const [px, py, pz] = parentCenter;
  return localCells.map((cell) => {
    const [lx, ly, lz] = cellToWorld(cell.x, cell.y, cell.z, subScale);
    return {
      x: cell.x, y: cell.y, z: cell.z, shell: cell.shell,
      worldPosition: [px + lx, py + ly, pz + lz],
      scale: shapeScale,
    };
  });
}

export function bccDetailVertsFor(cell) {
  const [wx, wy, wz] = cell.worldPosition;
  return truncatedOctahedronVertices(cell.scale).map(([x, y, z]) => [x + wx, y + wy, z + wz]);
}
