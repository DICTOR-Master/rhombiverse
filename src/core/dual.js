// Dual cube/octahedron structure inscribed in each RD (core, not
// optional). Full design rationale/history: docs/code-notes/core/dual.md
import { NEIGHBOR_OFFSETS } from './lattice.js';

export const CUBE_EDGES = [
  [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3],
  [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
];

export const OCTA_EDGES = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 4], [2, 5], [3, 4], [3, 5],
];

// Lattice-index offsets (not world-space directions), even-sum scaled
// to satisfy this lattice's parity constraint -- see docs/code-notes.
export const DUAL_DIRS = {
  cube: [-2, 2].flatMap((x) =>
    [-2, 2].flatMap((y) => [-2, 2].map((z) => [x, y, z]))
  ),
  octa: [
    [2, 0, 0], [-2, 0, 0],
    [0, 2, 0], [0, -2, 0],
    [0, 0, 2], [0, 0, -2],
  ],
};

export function getDual(vertices, center = [0, 0, 0]) {
  if (vertices.length !== 14) {
    throw new Error(`getDual expects 14 RD vertices, got ${vertices.length}`);
  }
  const dist2 = ([x, y, z]) => {
    const dx = x - center[0], dy = y - center[1], dz = z - center[2];
    return dx * dx + dy * dy + dz * dz;
  };
  const first8 = vertices.slice(0, 8);
  const last6 = vertices.slice(8, 14);
  const maxFirst8 = Math.max(...first8.map(dist2));
  const minLast6 = Math.min(...last6.map(dist2));
  let cube, octa;
  if (maxFirst8 <= minLast6) {
    cube = first8;
    octa = last6;
  } else {
    const sorted = [...vertices].sort((a, b) => dist2(a) - dist2(b));
    cube = sorted.slice(0, 8);
    octa = sorted.slice(8, 14);
  }
  return { cube, octa, cubeEdges: CUBE_EDGES, octaEdges: OCTA_EDGES };
}

export function snapToDual(worldPoint, dual, focus, threshold) {
  const candidates = [];
  if (focus === 'cube' || focus === 'both') {
    dual.cube.forEach((v, i) => candidates.push({ point: v, which: 'cube', index: i }));
  }
  if (focus === 'octa' || focus === 'both') {
    dual.octa.forEach((v, i) => candidates.push({ point: v, which: 'octa', index: i }));
  }
  let best = null;
  let bestDist = threshold;
  const [px, py, pz] = worldPoint;
  for (const c of candidates) {
    const [vx, vy, vz] = c.point;
    const d = Math.hypot(vx - px, vy - py, vz - pz);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export { NEIGHBOR_OFFSETS };
