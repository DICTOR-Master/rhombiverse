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

// Nearest FCC lattice point(s) to a BCC coordinate -- the reverse of
// nearestBCCPoints above, added for Dualize's reverse direction
// (dualizing a region you selected on the BCC/TO lattice back onto
// FCC/RD). Genuinely asymmetric with the forward direction, verified
// numerically before wiring this into any UI (see the exhaustive check
// this was validated against): a BCC point with all-even coordinates
// is already a valid FCC point too (isValidCell's x+y+z-even constraint
// is satisfied automatically -- the real, documented overlap between
// the two lattices' "even" families, see core/bcc-build.md), so its
// nearest FCC point is itself, distance 0. A BCC point with all-odd
// coordinates sums to odd, so it's never itself FCC-valid -- flipping
// any ONE axis by +-1 fixes the parity, and by symmetry all 6 such
// single-axis flips land at exactly distance 1, genuinely equally near
// (not an arbitrary tie-break).
export function nearestFCCPoints(bccCoord) {
  const [x, y, z] = bccCoord;
  if ((x + y + z) % 2 === 0) return [[x, y, z]];
  return [
    [x + 1, y, z], [x - 1, y, z],
    [x, y + 1, z], [x, y - 1, z],
    [x, y, z + 1], [x, y, z - 1],
  ];
}

// Nearest valid BCC lattice coordinate to an arbitrary (not necessarily
// BCC-valid, not necessarily FCC-valid) continuous point -- same snap
// technique as nearestBCCPoints' own inline `snap` (round each axis to
// the nearest integer of a given parity, since a plain round() can land
// on mixed parity), generalized to take any x,y,z rather than requiring
// an FCC-valid coordinate specifically. Used to seed a single, real,
// connected BCC lattice patch from an arbitrary reference position (e.g.
// the camera), rather than needing an existing FCC cell to anchor to.
export function nearestBCCCell(x, y, z) {
  const bestForParity = (parity) => {
    const snap = (v) => {
      const lo = Math.floor(v);
      const cand = [];
      for (let k = lo - 1; k <= lo + 2; k++) {
        if (((k % 2) + 2) % 2 === parity) cand.push(k);
      }
      return cand.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best));
    };
    return [snap(x), snap(y), snap(z)];
  };
  const evenPt = bestForParity(0);
  const oddPt = bestForParity(1);
  const dist2 = ([px, py, pz]) => (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
  return dist2(evenPt) <= dist2(oddPt) ? evenPt : oddPt;
}

// Normalized BCC_NEIGHBOR_OFFSETS directions, precomputed once -- moved
// here 2026-09-02 from the now-retired core/bcc-build.js (its own
// standalone build controller was cut as redundant with core/build.js's
// own Piece:TO handleToClick, which already does the exact same
// bootstrap/extend mechanic), but the plain geometry helper itself is
// real, shared math that stays. Rewritten to plain x/y/z scalar math
// (no THREE dependency) to match this file's own "pure math only"
// design -- the caller's faceNormal only ever needs to expose .x/.y/.z,
// which a THREE.Vector3 already does.
const BCC_NEIGHBOR_DIRECTIONS = BCC_NEIGHBOR_OFFSETS.map(([x, y, z]) => {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
});

// Given a face normal (anything exposing .x/.y/.z), returns whichever of
// the 14 BCC_NEIGHBOR_OFFSETS it points closest to -- how a click on an
// existing BCC/TO cell's face resolves which real neighbor to extend
// into, same mechanic as the FCC lattice's own 12-neighbor face lookup.
export function matchBCCNeighborOffset(faceNormal) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  BCC_NEIGHBOR_DIRECTIONS.forEach(([dx, dy, dz], i) => {
    const dot = dx * faceNormal.x + dy * faceNormal.y + dz * faceNormal.z;
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  });
  return BCC_NEIGHBOR_OFFSETS[bestIdx];
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
  // nearestFCCPoints: exhaustive check over a real range, not spot-checked --
  // every BCC point's returned candidate(s) must actually be valid FCC points.
  const isValidFCC = (x, y, z) => (x + y + z) % 2 === 0;
  let fccDualOk = true;
  for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) for (let z = -4; z <= 4; z++) {
    if (!isBCC(x, y, z)) continue;
    for (const [cx, cy, cz] of nearestFCCPoints([x, y, z])) {
      if (!isValidFCC(cx, cy, cz)) fccDualOk = false;
    }
  }
  console.log('nearestFCCPoints: every candidate over [-4,4]^3 BCC points is FCC-valid ->', fccDualOk);
  if (!fccDualOk) throw new Error('nearestFCCPoints produced an invalid FCC candidate');
  console.log('nearestFCCPoints((2,0,0)) [all-even, already FCC] ->', nearestFCCPoints([2, 0, 0]));
  console.log('nearestFCCPoints((1,1,1)) [all-odd, 6 equidistant neighbors] ->', nearestFCCPoints([1, 1, 1]));
  console.log('OK');
}
