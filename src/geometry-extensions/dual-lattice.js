// BCC (body-centered-cubic) lattice math -- reciprocal/dual to the FCC
// lattice (src/core/lattice.js). Pure math only, Phase 1 -- not wired
// into rendering yet. Full design rationale/history:
// docs/code-notes/geometry-extensions/dual-lattice.md

export function isBCC(x, y, z) {
  const px = ((x % 2) + 2) % 2;
  const py = ((y % 2) + 2) % 2;
  const pz = ((z % 2) + 2) % 2;
  return px === py && py === pz;
}

export const BCC_NEIGHBOR_OFFSETS = [
  // 8 nearest (body-diagonal)
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  // 6 second-nearest (axis)
  [2, 0, 0], [-2, 0, 0],
  [0, 2, 0], [0, -2, 0],
  [0, 0, 2], [0, 0, -2],
];

// 24 truncated-octahedron vertices -- generated, not hand-listed (see notes.md).
export function truncatedOctahedronVertices(scale = 1) {
  const base = [0, 1, 2];
  const perms = [
    [0, 1, 2], [0, 2, 1],
    [1, 0, 2], [1, 2, 0],
    [2, 0, 1], [2, 1, 0],
  ];
  const verts = [];
  for (const [ia, ib, ic] of perms) {
    const a = base[ia];
    const b = base[ib];
    const c = base[ic];
    const signsFor = (v) => (v === 0 ? [1] : [1, -1]);
    for (const sa of signsFor(a)) {
      for (const sb of signsFor(b)) {
        for (const sc of signsFor(c)) {
          verts.push([a * sa * scale, b * sb * scale, c * sc * scale]);
        }
      }
    }
  }
  const seen = new Set();
  const unique = [];
  for (const v of verts) {
    const key = v.map((n) => n.toFixed(6)).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  return unique;
}

// Nearest BCC dual-lattice points to an FCC coordinate. Unwired (Phase 3 stretch); see notes.md.
export function nearestBCCPoints(fccCoord) {
  const [x, y, z] = fccCoord;
  const results = [];
  for (const parity of [0, 1]) {
    const snap = (v) => {
      const lo = Math.floor(v);
      const cand = [];
      for (let k = lo - 1; k <= lo + 2; k++) {
        if (((k % 2) + 2) % 2 === parity) cand.push(k);
      }
      return cand.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best));
    };
    const px = snap(x);
    const py = snap(y);
    const pz = snap(z);
    results.push([px, py, pz]);
  }
  const seen = new Set();
  const unique = [];
  for (const p of results) {
    const key = p.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  return unique;
}

// Standalone sanity gate: `node src/geometry-extensions/dual-lattice.js`
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('dual-lattice.js')) {
  const verts = truncatedOctahedronVertices(1);
  console.log(`truncatedOctahedronVertices(1) produced ${verts.length} vertices (expected 24).`);
  if (verts.length !== 24) {
    throw new Error(`Expected exactly 24 vertices, got ${verts.length}`);
  }
  console.log('isBCC checks:', {
    'origin (0,0,0) all-even -> true': isBCC(0, 0, 0),
    '(1,1,1) all-odd -> true': isBCC(1, 1, 1),
    '(1,1,0) mixed -> false': isBCC(1, 1, 0),
    '(2,0,0) all-even -> true': isBCC(2, 0, 0),
  });
  console.log(`BCC_NEIGHBOR_OFFSETS length: ${BCC_NEIGHBOR_OFFSETS.length} (expected 14).`);
  console.log('OK');
}
