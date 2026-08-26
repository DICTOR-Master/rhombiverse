// RD/FCC lattice math: coordinate validation, 12-neighbor lookup, world<->screen
// conversion. See RHOMBIVERSE_PLAN.md section 2.
// Full design rationale/history for every export below: docs/code-notes/core/lattice.md

export const CUBE_VERTS = [-1, 1].flatMap((x) =>
  [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))
);

export const OCTA_VERTS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export function rdRawVerts(s = 1) {
  const half = s * 0.5;
  return [
    ...CUBE_VERTS.map(([x, y, z]) => [x * half, y * half, z * half]),
    ...OCTA_VERTS.map(([x, y, z]) => [x * 2 * half, y * 2 * half, z * 2 * half]),
  ];
}

// RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md section 2: an RD decomposes exactly
// into a cube plus 6 square pyramids, one erected on each cube face. This
// derives that decomposition FROM rdRawVerts() (the same 14 points already
// used to build the whole-block render/collision geometry, via
// buildRDGeometry() in render.js) rather than recomputing vertex math
// separately -- if rdRawVerts ever changes, this stays correct for free.
// PYRAMID_AXES matches OCTA_VERTS' own fixed order (+x,-x,+y,-y,+z,-z), so
// apexRaw[i] below is guaranteed to be the correct apex for PYRAMID_AXES[i].
export const PYRAMID_AXES = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];

export function pyramidPieces(s = 1) {
  const verts = rdRawVerts(s);
  const cube = verts.slice(0, 8);
  const apexRaw = verts.slice(8, 14);
  const pyramids = {};
  PYRAMID_AXES.forEach((axisKey, i) => {
    const axisIndex = i < 2 ? 0 : i < 4 ? 1 : 2;
    const sign = i % 2 === 0 ? 1 : -1;
    const base = cube.filter((v) => Math.sign(v[axisIndex]) === sign);
    pyramids[axisKey] = { base, apex: apexRaw[i] };
  });
  return { cube, pyramids };
}

export const NEIGHBOR_OFFSETS = [
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
  [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
];

// Valid cell: x+y+z even (FCC parity constraint).
export function isValidCell(x, y, z) {
  return (x + y + z) % 2 === 0;
}

export function neighbors(x, y, z) {
  return NEIGHBOR_OFFSETS.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
}

export function nearestValidCell(x, y, z) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rz = Math.round(z);
  if (isValidCell(rx, ry, rz)) return [rx, ry, rz];
  const errs = [Math.abs(x - rx), Math.abs(y - ry), Math.abs(z - rz)];
  const worst = errs.indexOf(Math.max(...errs));
  const nudged = [rx, ry, rz];
  const raw = [x, y, z];
  nudged[worst] += raw[worst] >= nudged[worst] ? 1 : -1;
  return nudged;
}

export function cellKey(x, y, z) {
  return `${x},${y},${z}`;
}

export function parseCellKey(key) {
  return key.split(',').map(Number);
}

export function cellToWorld(x, y, z, s = 1) {
  return [x * s, y * s, z * s];
}

export function shellCount(n) {
  return 10 * n * n + 2;
}

export function cellsInShells(cx, cy, cz, maxShell, minShell = 1, offsets = NEIGHBOR_OFFSETS) {
  const visited = new Set([cellKey(cx, cy, cz)]);
  let frontier = [[cx, cy, cz]];
  const result = [];
  for (let shell = 1; shell <= maxShell; shell++) {
    const next = [];
    for (const [x, y, z] of frontier) {
      for (const [dx, dy, dz] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        const k = cellKey(nx, ny, nz);
        if (!visited.has(k)) {
          visited.add(k);
          next.push([nx, ny, nz]);
          if (shell >= minShell) result.push({ x: nx, y: ny, z: nz, shell });
        }
      }
    }
    frontier = next;
  }
  return result;
}
