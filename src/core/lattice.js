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
