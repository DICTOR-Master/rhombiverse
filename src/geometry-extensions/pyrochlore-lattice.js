// Pyrochlore (3D Kagome) -- direct request 2026-09-24: "an equivalent 3D
// Kagome lattice... based on FCC, as a combination of tetrahedrons and
// empty tetrahedron spaces", refined in discussion to the real
// pyrochlore lattice (the standard "3D Kagome"): corner-sharing
// tetrahedra, exactly 2 per vertex (one up, one down) -- the same rule
// that defines 2D Kagome's corner-sharing triangles -- with truncated-
// tetrahedron voids, i.e. the quarter cubic honeycomb. Cut perpendicular
// to a cube body-diagonal it shows alternating Kagome and triangular
// layers: lattice-2d.js's own Kagome is literally a cross-section of it.
//
// Registered to the main RD world (direct decision), in its own units:
// FCC cells are the even-sum integer points (core/lattice.js cellToWorld
// is identity), nearest-neighbor distance sqrt(2). Verified numerically
// before building (scripts/verify-pyrochlore.mjs re-checks all of it):
//   - up-tetrahedra sit on FCC points (one inside every RD), corners at
//     p + s/4 for s in S below -- tetrahedron edge sqrt(2)/2, half the RD
//     spacing;
//   - down-tetrahedra sit on T+ holes (p + (1/2,1/2,1/2)), the RD 3-valent
//     corners where 4 RDs meet, corners at q - s/4;
//   - truncated tetrahedra (TT) sit on the complementary diamond sites:
//     octahedral holes (FCC + (1,0,0), "O-sites") and T- holes (FCC -
//     (1/2,1/2,1/2), "T-sites"). The two site types are exact inversions
//     of each other; O-site TTs are capped by 4 down-tets, T-site TTs by
//     4 up-tets. Adjacent TTs share a whole hexagonal face; a TT plus its
//     4 caps is one big tetrahedron of 3x the edge; 2 tets + 2 TTs per FCC
//     point fill space exactly.
//
// The buildable piece is the TT (direct decision -- the 3D analog of 2D
// Kagome's hexagon); tetrahedra are DERIVED from placed TTs exactly like
// lattice-2d.js's kagomeStarTriangles: a tetrahedron exists iff at least
// one of the TTs it caps is placed.
//
// Cell coordinates are DOUBLED world coordinates (all integers): an
// O-site is all-even with (i+j+k)/2 odd, a T-site is all-odd with
// (i+j+k) = 1 mod 4. Up-tet centers (FCC points) are all-even with
// (i+j+k)/2 even; down-tet centers (T+ holes) are all-odd with
// (i+j+k) = 3 mod 4.

export const PYROCHLORE_S = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];

const mod = (a, n) => ((a % n) + n) % n;
const allEven = (i, j, k) => mod(i, 2) === 0 && mod(j, 2) === 0 && mod(k, 2) === 0;
const allOdd = (i, j, k) => mod(i, 2) === 1 && mod(j, 2) === 1 && mod(k, 2) === 1;

// +1 = O-site, -1 = T-site, 0 = not a TT site.
export function pyrochloreSiteOrientation(i, j, k) {
  if (allEven(i, j, k) && mod((i + j + k) / 2, 2) === 1) return 1;
  if (allOdd(i, j, k) && mod(i + j + k, 4) === 1) return -1;
  return 0;
}

export function pyrochloreCellToWorld(i, j, k, s = 1) {
  return [(i / 2) * s, (j / 2) * s, (k / 2) * s];
}

// Hex-face neighbors: +S from an O-site, -S from a T-site (the diamond
// network), in doubled coordinates.
export function pyrochloreNeighborOffsets(orientation) {
  return PYROCHLORE_S.map(([a, b, c]) => [a * orientation, b * orientation, c * orientation]);
}

// Up-tet corners around its own center; the down-tet is the exact
// negation (verified: a down-tet at q has corners q - s/4).
export function tetrahedronVerts(kind, s = 1) {
  const sign = kind === 'up' ? 1 : -1;
  return PYROCHLORE_S.map(([a, b, c]) => [(sign * a * s) / 4, (sign * b * s) / 4, (sign * c * s) / 4]);
}

// The O-site TT's 12 vertices around its own center, derived (not hand-
// typed) from the lattice itself: every pyrochlore vertex (a tet corner)
// at the TT circumradius from an O-site. The T-site TT is the negation.
const TET_EDGE = Math.SQRT2 / 2;
const TT_CIRCUMRADIUS = (TET_EDGE * Math.sqrt(22)) / 4;
const O_TEMPLATE = (() => {
  const c = [1, 0, 0];
  const found = new Map();
  for (let x = -2; x <= 3; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) {
    if (mod(x + y + z, 2) !== 0) continue;
    for (const [a, b, d] of PYROCHLORE_S) {
      const v = [x + a / 4, y + b / 4, z + d / 4];
      const r = Math.hypot(v[0] - c[0], v[1] - c[1], v[2] - c[2]);
      if (Math.abs(r - TT_CIRCUMRADIUS) < 1e-9) found.set(v.map((n) => n.toFixed(6)).join(','), [v[0] - c[0], v[1] - c[1], v[2] - c[2]]);
    }
  }
  return [...found.values()];
})();

export function truncatedTetrahedronVerts(orientation, s = 1) {
  return O_TEMPLATE.map(([x, y, z]) => [x * orientation * s, y * orientation * s, z * orientation * s]);
}

// Cap tets of a TT at doubled coords (i,j,k): O-site caps are down-tets
// at (i,j,k) - s, T-site caps are up-tets at (i,j,k) + s (doubled coords).
export function pyrochloreCapTetsOf(i, j, k) {
  const o = pyrochloreSiteOrientation(i, j, k);
  const kind = o === 1 ? 'down' : 'up';
  return PYROCHLORE_S.map(([a, b, c]) => ({ kind, center: [i - o * a, j - o * b, k - o * c] }));
}

// Every tetrahedron touching any placed TT, deduped by center. `owner` is
// the cellOrder index of the first placed TT capped by it -- used for its
// tint and to resolve a tap on it back to a real stored cell.
export function pyrochloreCapTets(cellOrder) {
  const up = new Map();
  const down = new Map();
  cellOrder.forEach(({ x, y, z }, owner) => {
    for (const { kind, center } of pyrochloreCapTetsOf(x, y, z)) {
      const map = kind === 'up' ? up : down;
      const key = center.join(',');
      if (!map.has(key)) map.set(key, { center, owner });
    }
  });
  return { up: [...up.values()], down: [...down.values()] };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Tap on a TT: which hex face (-> neighbor TT, doubled coords) the world
// face normal points through, or null for a triangle face (those are
// always covered by a cap tet).
export function pyrochloreNeighborForTTFace(i, j, k, worldNormal) {
  const o = pyrochloreSiteOrientation(i, j, k);
  let best = null;
  let bestDot = -Infinity;
  for (const [a, b, c] of PYROCHLORE_S) {
    for (const sign of [1, -1]) {
      const d = dot(worldNormal, [a * sign, b * sign, c * sign]);
      if (d > bestDot) { bestDot = d; best = { hex: sign === o, offset: [a * sign, b * sign, c * sign] }; }
    }
  }
  return best.hex ? [i + best.offset[0], j + best.offset[1], k + best.offset[2]] : null;
}

// Tap on a tet: the TT across the tapped face (doubled coords). An up-tet
// face opposite corner s has outward normal -s and the TT across it sits
// at center - s; a down-tet's is +s -> center + s.
export function pyrochloreNeighborForTetFace(kind, center, worldNormal) {
  const sign = kind === 'up' ? -1 : 1;
  let best = PYROCHLORE_S[0];
  let bestDot = -Infinity;
  for (const s of PYROCHLORE_S) {
    const d = dot(worldNormal, [s[0] * sign, s[1] * sign, s[2] * sign]);
    if (d > bestDot) { bestDot = d; best = s; }
  }
  return [center[0] + sign * best[0], center[1] + sign * best[1], center[2] + sign * best[2]];
}

// Real volumes at scale s (edge e = s*sqrt(2)/2) and inradius-style
// ceilings for the Spherical Toggle's cap() rule (render.js's own
// sphericalClassificationFor): a TT's nearest faces are its hexagons at
// sqrt(6)/4 * e; a regular tet's inradius is e / (2*sqrt(6)).
export function pyrochloreShapeStats(s = 1) {
  const e = TET_EDGE * s;
  return {
    truncatedTetrahedron: { volume: ((23 * Math.SQRT2) / 12) * e ** 3, ceiling: (Math.sqrt(6) / 4) * e },
    tetrahedron: { volume: e ** 3 / (6 * Math.SQRT2), ceiling: e / (2 * Math.sqrt(6)) },
  };
}

// ---------------------------------------------------------------------------
// Individual small tetrahedra (direct request 2026-09-24: a Whole tet |
// Small tet toggle "for add or removal"). Tets stay DERIVED from placed
// TTs by default; the world can additionally hold per-tet cells at a tet's
// own center (never a TT site -- the two index sets are disjoint, see the
// header): { tetAdded: true, material } adds a tet on its own (pure
// corner-sharing pyrochlore growth), { tetRemoved: true } hides a derived
// cap. A removed tet STAYS removed even if another TT later caps the same
// spot (direct decision) -- only an explicit Small-tet add brings it back.
// ---------------------------------------------------------------------------

// 'up' | 'down' | null for a doubled-coordinate point.
export function pyrochloreTetKind(i, j, k) {
  if (allEven(i, j, k) && mod((i + j + k) / 2, 2) === 0) return 'up';
  if (allOdd(i, j, k) && mod(i + j + k, 4) === 3) return 'down';
  return null;
}

// Every tetrahedron actually shown: derived caps of placed TTs, minus
// tetRemoved markers, plus tetAdded cells. `cell` is what tints it (the
// owning TT, or the tet's own added cell).
export function pyrochloreVisibleTets(cells) {
  const tts = cells.filter((c) => pyrochloreSiteOrientation(c.x, c.y, c.z) !== 0);
  const marks = new Map(cells.filter((c) => pyrochloreTetKind(c.x, c.y, c.z)).map((c) => [`${c.x},${c.y},${c.z}`, c]));
  const derived = pyrochloreCapTets(tts);
  const out = { up: [], down: [] };
  const seen = new Set();
  for (const kind of ['up', 'down']) {
    for (const { center, owner } of derived[kind]) {
      const key = center.join(',');
      const m = marks.get(key);
      if (m?.tetRemoved) continue;
      seen.add(key);
      out[kind].push({ center, cell: m?.tetAdded ? m : tts[owner] });
    }
  }
  for (const [key, m] of marks) {
    if (!m.tetAdded || seen.has(key)) continue;
    out[pyrochloreTetKind(m.x, m.y, m.z)].push({ center: [m.x, m.y, m.z], cell: m });
  }
  return out;
}

// Tap on a TT's TRIANGLE face in Small-tet mode: the cap tet that belongs
// there ({ kind, center }), or null for a hexagon face.
export function pyrochloreCapForTTFace(i, j, k, worldNormal) {
  const o = pyrochloreSiteOrientation(i, j, k);
  let best = null;
  let bestDot = -Infinity;
  for (const s of PYROCHLORE_S) {
    for (const sign of [1, -1]) {
      const d = dot(worldNormal, [s[0] * sign, s[1] * sign, s[2] * sign]);
      if (d > bestDot) { bestDot = d; best = { sign, s }; }
    }
  }
  if (best.sign === o) return null; // a hexagon face
  return { kind: o === 1 ? 'down' : 'up', center: [i + best.sign * best.s[0], j + best.sign * best.s[1], k + best.sign * best.s[2]] };
}

// Small-tet corner growth: the tet sharing the corner of (kind, center)
// nearest `localDir` (tap point minus the tet's own world center). Each
// pyrochlore vertex has exactly one up and one down tet, so an up-tet's
// corner s is shared with the down-tet at center + s, and a down-tet's
// corner -s with the up-tet at center - s (doubled coords).
export function pyrochloreTetCornerPartner(kind, center, localDir) {
  const sign = kind === 'up' ? 1 : -1;
  let best = PYROCHLORE_S[0];
  let bestDot = -Infinity;
  for (const s of PYROCHLORE_S) {
    const d = dot(localDir, [s[0] * sign, s[1] * sign, s[2] * sign]);
    if (d > bestDot) { bestDot = d; best = s; }
  }
  return { kind: kind === 'up' ? 'down' : 'up', center: [center[0] + sign * best[0], center[1] + sign * best[1], center[2] + sign * best[2]] };
}
