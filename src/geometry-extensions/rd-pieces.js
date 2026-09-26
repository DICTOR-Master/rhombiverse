// RD pieces and the scale ladder, for the Shells scene (docs/PLAN-SHELLS.md,
// stage 1). Pure geometry, no three.js, so scripts/verify-shells.mjs runs
// it in Node.
//
// Frame: the app's FCC lattice (core/lattice.js): cells are integer points
// with an even coordinate sum, and the unit RD is |x|+|y|, |x|+|z|,
// |y|+|z| <= 1 (corners (±1,0,0) and (±½,±½,±½), volume 2).
//
// Every piece is a convex solid given by half-spaces: the RD's 12 face
// planes plus a few planes through its centre. A split is its first
// piece plus the symmetry subgroup whose images of it are the other
// pieces; a piece is (split, symmetry element) placed at a lattice cell
// and scale. The scale ladder: k * FCC sits inside FCC, so a big RD of
// scale k is filled exactly by small cells cut by its face planes, which
// are mirror planes of the small tiling -- the cut pieces are always
// members of this family (measured in verify-shells).

const EPS = 1e-9;

// ---- symmetry: the RD's 48 elements (signed permutation matrices) ----
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
export const OH = PERMS.flatMap((p) => [1, -1].flatMap((sx) => [1, -1].flatMap((sy) => [1, -1].map((sz) => {
  const s = [sx, sy, sz];
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => (p[r] === c ? s[r] : 0)));
}))));
const matKey = (m) => m.flat().join(',');
const OH_INDEX = new Map(OH.map((m, i) => [matKey(m), i]));
const mul = (a, b) => a.map((row) => [0, 1, 2].map((c) => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c]));
export const apply = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
// Closure of a set of generators (indices into OH).
function subgroup(gens) {
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const seen = new Map([[matKey(I), I]]);
  const queue = [I];
  while (queue.length) {
    const m = queue.pop();
    for (const g of gens) {
      const n = mul(g, m);
      if (!seen.has(matKey(n))) { seen.set(matKey(n), n); queue.push(n); }
    }
  }
  return [...seen.values()].map((m) => OH_INDEX.get(matKey(m)));
}
const reflect = (n) => { // reflection across the plane through 0 with normal n (n a coordinate or face-diagonal axis)
  const nn = n[0] * n[0] + n[1] * n[1] + n[2] * n[2];
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => (r === c ? 1 : 0) - (2 * n[r] * n[c]) / nn));
};
const CYCLE = [[0, 0, 1], [1, 0, 0], [0, 1, 0]]; // (x,y,z) -> (z,x,y), the 3-fold turn about (1,1,1)
const SWAP_XY = [[0, 1, 0], [1, 0, 0], [0, 0, 1]];
const HALF_TURN = (a) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => (r === c ? (r === a ? 1 : -1) : 0)));

// ---- convex solids ----
// A plane is { n, d } meaning n·x <= d. The RD's 12 faces:
const RD_PLANES = [];
for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const si of [1, -1]) for (const sj of [1, -1]) {
  const n = [0, 0, 0]; n[i] = si; n[j] = sj;
  RD_PLANES.push({ n, d: 1 });
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function solve3(p, q, r) {
  const det = dot(p.n, cross(q.n, r.n));
  if (Math.abs(det) < EPS) return null;
  const v = [0, 0, 0];
  const a = cross(q.n, r.n), b = cross(r.n, p.n), c = cross(p.n, q.n);
  for (let i = 0; i < 3; i++) v[i] = (p.d * a[i] + q.d * b[i] + r.d * c[i]) / det;
  return v;
}
function dedupe(points) {
  const out = [];
  for (const v of points) if (!out.some((w) => Math.abs(w[0] - v[0]) + Math.abs(w[1] - v[1]) + Math.abs(w[2] - v[2]) < 1e-7)) out.push(v);
  return out;
}
// Vertices, faces (ordered loops) and volume of { x : n·x <= d for every plane }.
export function solidFromPlanes(planes) {
  const pts = [];
  for (let a = 0; a < planes.length; a++) for (let b = a + 1; b < planes.length; b++) for (let c = b + 1; c < planes.length; c++) {
    const v = solve3(planes[a], planes[b], planes[c]);
    if (v && planes.every((p) => dot(p.n, v) <= p.d + EPS)) pts.push(v);
  }
  const verts = dedupe(pts);
  if (verts.length < 4) return { verts: [], faces: [], volume: 0, planes };
  const centre = verts.reduce((s, v) => [s[0] + v[0] / verts.length, s[1] + v[1] / verts.length, s[2] + v[2] / verts.length], [0, 0, 0]);
  const faces = [];
  let volume = 0;
  const seenFace = new Set();
  for (const p of planes) {
    const on = verts.map((v, i) => [v, i]).filter(([v]) => Math.abs(dot(p.n, v) - p.d) < 1e-7);
    if (on.length < 3) continue;
    const key = on.map(([, i]) => i).sort((x, y) => x - y).join(',');
    if (seenFace.has(key)) continue;
    seenFace.add(key);
    // order the face's vertices around its own centre
    const fc = on.reduce((s, [v]) => [s[0] + v[0] / on.length, s[1] + v[1] / on.length, s[2] + v[2] / on.length], [0, 0, 0]);
    const u = sub(on[0][0], fc);
    const w = cross(p.n, u);
    on.sort(([a], [b]) => Math.atan2(dot(sub(a, fc), w), dot(sub(a, fc), u)) - Math.atan2(dot(sub(b, fc), w), dot(sub(b, fc), u)));
    faces.push(on.map(([, i]) => i));
    for (let t = 1; t + 1 < on.length; t++) volume += Math.abs(dot(sub(on[0][0], centre), cross(sub(on[t][0], centre), sub(on[t + 1][0], centre)))) / 6;
  }
  return { verts, faces, volume, planes };
}
// Cone planes through the centre, given as normals m with m·x >= 0.
const cone = (normals) => normals.map((m) => ({ n: m.map((x) => -x), d: 0 }));

// ---- the splits ----
// Twelfths: the pyramid on the RD face towards (1,1,0), i.e. where x+y is
// the largest of the 12 forms ±x_i ± x_j.
const FORMS = [];
for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const si of [1, -1]) for (const sj of [1, -1]) { const f = [0, 0, 0]; f[i] = si; f[j] = sj; FORMS.push(f); }
const TWELFTH_CONE = FORMS.map((f) => sub([1, 1, 0], f)).filter((m) => m.some((x) => x !== 0));
// Rhombohedral quarter: core/lattice.js rdQuarterPieces()[0] (anchor at
// the cube corner (-½,-½,-½), opposite corner at the centre). Its own
// planes, from its 8 corners.
function rhombohedronPlanes() {
  const a = [-0.5, -0.5, -0.5];
  const e = [[-0.5, 0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5]]; // anchor -> (-1,0,0), (0,-1,0), (0,0,-1)
  const planes = [];
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const n = cross(e[i], e[j]);
    const k = 3 - i - j;
    const s = Math.sign(dot(n, e[k]));
    // two parallel faces: through a, and through a + e[k]
    planes.push({ n: n.map((x) => -s * x), d: -s * dot(n, a) });
    planes.push({ n: n.map((x) => s * x), d: s * dot(n, [a[0] + e[k][0], a[1] + e[k][1], a[2] + e[k][2]]) });
  }
  return planes;
}

const R = (n) => OH_INDEX.get(matKey(reflect(n)));
const M = (m) => OH_INDEX.get(matKey(m));
const SPLIT_DEFS = [
  { id: 'whole', count: 1, planes: [], gens: [] },
  { id: 'half-axis', count: 2, planes: cone([[1, 0, 0]]), gens: [R([1, 0, 0])] },
  { id: 'half-diagonal', count: 2, planes: cone([[1, 1, 0]]), gens: [R([1, 1, 0])] },
  { id: 'third', count: 3, planes: cone([[1, -1, 0], [1, 0, -1]]), gens: [M(CYCLE)] },
  { id: 'quarter-mirror', count: 4, planes: cone([[1, 0, 0], [0, 1, 0]]), gens: [R([1, 0, 0]), R([0, 1, 0])] },
  { id: 'quarter-rhombohedron', count: 4, planes: rhombohedronPlanes(), gens: [M(HALF_TURN(2)), M(HALF_TURN(1))] },
  { id: 'sixth', count: 6, planes: cone([[1, -1, 0], [1, 1, 0], [1, 0, -1], [1, 0, 1]]), gens: [M(CYCLE), R([1, 0, 0])] },
  { id: 'eighth', count: 8, planes: cone([[1, 0, 0], [0, 1, 0], [0, 0, 1]]), gens: [R([1, 0, 0]), R([0, 1, 0]), R([0, 0, 1])] },
  { id: 'twelfth', count: 12, planes: cone(TWELFTH_CONE), gens: OH.map((_, i) => i) },
  { id: 'sixteenth', count: 16, planes: cone([[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, -1, 0]]), gens: [R([1, 0, 0]), R([0, 1, 0]), R([0, 0, 1]), M(SWAP_XY)] },
  { id: '24th', count: 24, planes: cone([[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, -1, 0], [1, 0, -1]]), gens: [R([1, 0, 0]), R([0, 1, 0]), R([0, 0, 1]), M(CYCLE)] },
  { id: '48th', count: 48, planes: cone([[1, -1, 0], [0, 1, -1], [0, 0, 1]]), gens: OH.map((_, i) => i) },
];

export const SPLITS = SPLIT_DEFS.map((s) => {
  const piece0 = solidFromPlanes([...RD_PLANES, ...s.planes]);
  // One symmetry element per distinct piece of the split.
  const elements = [];
  const keys = new Set();
  for (const g of subgroup(s.gens.map((i) => OH[i]))) {
    const k = vertexKey(piece0.verts.map((v) => apply(OH[g], v)));
    if (!keys.has(k)) { keys.add(k); elements.push(g); }
  }
  return { id: s.id, count: s.count, planes: [...RD_PLANES, ...s.planes], piece0, elements };
});
export const SPLIT_BY_ID = new Map(SPLITS.map((s) => [s.id, s]));

function vertexKey(verts) {
  return verts.map((v) => v.map((x) => (Math.round(x * 1e6) / 1e6 + 0).toFixed(6)).join(':')).sort().join('|');
}

// The solid of piece (split, symmetry element g) at `cell`, scaled by k.
export function pieceSolid(splitId, g, cell = [0, 0, 0], k = 1) {
  const s = SPLIT_BY_ID.get(splitId);
  const m = OH[g];
  const planes = s.planes.map((p) => ({ n: apply(m, p.n), d: p.d }));
  const moved = planes.map((p) => ({ n: p.n, d: k * p.d + k * dot(p.n, cell) }));
  return solidFromPlanes(moved);
}

// Which split and symmetry element a solid centred on the origin is, or
// null. Matches by vertex set.
export function identifyPiece(verts) {
  const key = vertexKey(verts);
  for (const s of SPLITS) {
    if (s.piece0.verts.length !== verts.length) continue;
    for (let g = 0; g < OH.length; g++) {
      if (vertexKey(s.piece0.verts.map((v) => apply(OH[g], v))) === key) return { split: s.id, g };
    }
  }
  return null;
}

// ---- the scale ladder ----
// The big RD of scale k at coarse cell `big` (a cell of the coarse lattice
// k*FCC, given in coarse cell coordinates), split into small cells: one
// entry per small cell it touches, { cell (small coordinates), split, g,
// volume }. Cut by the big RD's own 12 face planes.
export function scaleDecomposition(k, big = [0, 0, 0]) {
  const centre = big.map((x) => k * x);
  const bigPlanes = RD_PLANES.map((p) => ({ n: p.n, d: k * p.d + dot(p.n, centre) }));
  const out = [];
  for (let x = -k - 1; x <= k + 1; x++) for (let y = -k - 1; y <= k + 1; y++) for (let z = -k - 1; z <= k + 1; z++) {
    if ((x + y + z) % 2 !== 0) continue;
    const cell = [centre[0] + x, centre[1] + y, centre[2] + z];
    const small = RD_PLANES.map((p) => ({ n: p.n, d: p.d + dot(p.n, cell) }));
    const part = solidFromPlanes([...small, ...bigPlanes]);
    if (part.volume < 1e-7) continue;
    const local = part.verts.map((v) => sub(v, cell));
    const id = identifyPiece(local);
    out.push({ cell, split: id?.split ?? null, g: id?.g ?? null, volume: part.volume });
  }
  return out;
}

// ---- shells ----
// Cells of the lattice k*FCC around `centre` (small coordinates, on that
// lattice), grouped into shells. 'steps': neighbour steps (hull stays a
// cuboctahedron). 'distance': distinct distances from the centre (hull
// tends to a sphere). Returns [[cells of shell 1], [cells of shell 2], …].
const STEPS = [];
for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const si of [1, -1]) for (const sj of [1, -1]) { const s = [0, 0, 0]; s[i] = si; s[j] = sj; STEPS.push(s); }
export function shells(rule, count, centre = [0, 0, 0], k = 1) {
  if (rule === 'steps') {
    const seen = new Set([centre.join(',')]);
    let frontier = [centre];
    const out = [];
    for (let n = 0; n < count; n++) {
      const next = [];
      for (const c of frontier) for (const s of STEPS) {
        const d = [c[0] + k * s[0], c[1] + k * s[1], c[2] + k * s[2]];
        const key = d.join(',');
        if (!seen.has(key)) { seen.add(key); next.push(d); }
      }
      out.push(next);
      frontier = next;
    }
    return out;
  }
  // distance: search a cube big enough for `count` distinct radii
  const byR2 = new Map();
  for (let reach = 2; ; reach += 2) {
    byR2.clear();
    for (let x = -reach; x <= reach; x++) for (let y = -reach; y <= reach; y++) for (let z = -reach; z <= reach; z++) {
      if ((x + y + z) % 2 !== 0 || (x === 0 && y === 0 && z === 0)) continue;
      const r2 = x * x + y * y + z * z;
      if (!byR2.has(r2)) byR2.set(r2, []);
      byR2.get(r2).push([centre[0] + k * x, centre[1] + k * y, centre[2] + k * z]);
    }
    const radii = [...byR2.keys()].sort((a, b) => a - b).slice(0, count);
    // complete only if the search cube holds every cell up to the last radius
    if (radii.length === count && radii[count - 1] <= reach * reach) return radii.map((r2) => byR2.get(r2));
  }
}

// ---- hulls: shells measured by a target shape ----
// A hull is a gauge: a cell's "size" as that shape (the smallest copy of
// the shape, centred on the centre cell, that contains it). Shell n is
// every cell with the n-th smallest positive gauge, so the build grows as
// that shape. 'steps' is the cuboctahedron's gauge, which is exactly the
// FCC neighbour-step distance; 'distance' compares squared distances (a
// sphere). Every linear hull here has |x|,|y|,|z| <= gauge, so a search
// box of half-width g holds every cell up to gauge g.
const ax = (c) => c.map(Math.abs);
export const HULLS = {
  steps: (c) => { const [x, y, z] = ax(c); return Math.max(x, y, z, (x + y + z) / 2); },
  distance: ([x, y, z]) => x * x + y * y + z * z,
  tetrahedron: ([x, y, z]) => Math.max(x + y + z, x - y - z, -x + y - z, -x - y + z),
  'tetrahedron-mirror': ([x, y, z]) => Math.max(-x - y - z, -x + y + z, x - y + z, x + y - z),
  cube: (c) => Math.max(...ax(c)),
  octahedron: (c) => ax(c).reduce((a, b) => a + b, 0),
  rd: (c) => { const [x, y, z] = ax(c); return Math.max(x + y, x + z, y + z); },
  // Truncated octahedron: square faces at max|x_i| = 2, hexagons at
  // |x|+|y|+|z| = 3 (corners (0,±1,±2)); scaled so the squares sit at 1.
  to: (c) => { const [x, y, z] = ax(c); return Math.max(x, y, z, (2 * (x + y + z)) / 3); },
};
export const HULL_IDS = Object.keys(HULLS);
const gaugeKey = (g) => Math.round(g * 1e9);
// Per hull: every cell (relative to the centre) up to a covered gauge,
// grouped by gauge, and the sorted distinct positive gauges.
const hullCache = new Map();
function hullTable(hull, needGauge = 0, needCount = 0) {
  let t = hullCache.get(hull);
  const covered = (M) => (hull === 'distance' ? M * M : M);
  for (let M = t ? t.M * 2 : 8; !t || t.covered < needGauge || t.values.length < needCount; M *= 2) {
    const f = HULLS[hull];
    const byGauge = new Map();
    for (let x = -M; x <= M; x++) for (let y = -M; y <= M; y++) for (let z = -M; z <= M; z++) {
      if ((x + y + z) % 2 !== 0) continue;
      const g = f([x, y, z]);
      if (g <= 0 || g > covered(M) + 1e-9) continue;
      const k = gaugeKey(g);
      if (!byGauge.has(k)) byGauge.set(k, []);
      byGauge.get(k).push([x, y, z]);
    }
    const values = [...byGauge.keys()].sort((a, b) => a - b);
    t = { M, covered: covered(M), byGauge, values, rank: new Map(values.map((v, i) => [v, i + 1])) };
    hullCache.set(hull, t);
    if (M > 256) break; // far beyond any buildable hull
  }
  return t;
}
// The shell number of `cell` in `hull` around `centre` (0 = the centre).
export function hullShellOf(hull, cell, centre) {
  const rel = [cell[0] - centre[0], cell[1] - centre[1], cell[2] - centre[2]];
  const g = HULLS[hull](rel);
  if (g <= 0) return 0;
  return hullTable(hull, g).rank.get(gaugeKey(g)) ?? 0;
}
// The cells of shell n (n >= 1) of `hull` around `centre`.
export function hullShell(hull, n, centre) {
  const t = hullTable(hull, 0, n);
  return (t.byGauge.get(t.values[n - 1]) ?? []).map((c) => [c[0] + centre[0], c[1] + centre[1], c[2] + centre[2]]);
}

// ---- fragments: orientations, hit tests, overlap ----
// The RD's symmetry element r applied after g (OH indices).
export const composeOH = (r, g) => OH_INDEX.get(matKey(mul(OH[r], OH[g])));
// A split's distinct orientations: each is the list of symmetry elements
// of its pieces (turned as a whole by some r). Whole, and splits whose
// piece set every symmetry keeps, have just one.
const orientationCache = new Map();
export function splitOrientations(splitId) {
  if (orientationCache.has(splitId)) return orientationCache.get(splitId);
  const s = SPLIT_BY_ID.get(splitId);
  const seen = new Set();
  const out = [];
  for (let r = 0; r < OH.length; r++) {
    const gs = s.elements.map((g) => composeOH(r, g));
    const key = gs.map((g) => vertexKey(s.piece0.verts.map((v) => apply(OH[g], v)))).sort().join('#');
    if (!seen.has(key)) { seen.add(key); out.push(gs); }
  }
  orientationCache.set(splitId, out);
  return out;
}
// Half-spaces of piece (split, g) at `cell`, scale k.
export function piecePlanes(splitId, g, cell = [0, 0, 0], k = 1) {
  const m = OH[g];
  return SPLIT_BY_ID.get(splitId).planes.map((p) => {
    const n = apply(m, p.n);
    return { n, d: k * p.d + k * dot(n, cell) };
  });
}
export const pointInPiece = (splitId, g, cell, point, k = 1, eps = 1e-9) => piecePlanes(splitId, g, cell, k).every((p) => dot(p.n, point) <= p.d + eps);
// Which piece of a split (among all 48 orientations) holds `point` in
// `cell`: the one the point is deepest inside. null if none holds it.
export function pieceAt(splitId, cell, point, k = 1) {
  let best = null, bestDepth = -Infinity;
  const seen = new Set();
  for (let g = 0; g < OH.length; g++) {
    const planes = piecePlanes(splitId, g, cell, k);
    const key = planes.map((p) => `${p.n.join()}|${p.d}`).sort().join('#');
    if (seen.has(key)) continue;
    seen.add(key);
    const depth = Math.min(...planes.map((p) => (p.d - dot(p.n, point)) / Math.hypot(...p.n)));
    if (depth > bestDepth) { bestDepth = depth; best = g; }
  }
  return bestDepth >= -1e-9 ? { split: splitId, g: best } : null;
}
// Do two pieces overlap (share volume)? Exact, from their half-spaces.
export function piecesOverlap(a, b) {
  return solidFromPlanes([...piecePlanes(a.split, a.g, a.cell, a.k ?? 1), ...piecePlanes(b.split, b.g, b.cell, b.k ?? 1)]).volume > 1e-7;
}

// ---- trimming: a hull cut to its target's flat faces ----
// Planes { n, d } (n·x <= d) of hull `hull` at gauge g around `centre`,
// for every hull with flat faces (all but 'distance').
const OCT_N = [1, -1].flatMap((a) => [1, -1].flatMap((b) => [1, -1].map((c) => [a, b, c])));
const AX_N = [0, 1, 2].flatMap((i) => [1, -1].map((s) => { const n = [0, 0, 0]; n[i] = s; return n; }));
const HULL_FACES = {
  steps: [[AX_N, 1], [OCT_N, 2]],
  tetrahedron: [[[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], 1]],
  'tetrahedron-mirror': [[[[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]], 1]],
  cube: [[AX_N, 1]],
  octahedron: [[OCT_N, 1]],
  rd: [[RD_PLANES.map((p) => p.n), 1]],
  to: [[AX_N, 1], [OCT_N, 1.5]],
};
export const TRIMMABLE = Object.keys(HULL_FACES);
export function hullPlanes(hull, g, centre = [0, 0, 0]) {
  return HULL_FACES[hull].flatMap(([normals, s]) => normals.map((n) => ({ n, d: s * g + dot(n, centre) })));
}
// The gauge to trim at, for a hull whose shells 1..n are complete: through
// the centres of shell n's cells (measured exact for every flat hull), or
// for the truncated octahedron the largest exact size at most that (its
// squares and hexagons only both fit the lattice at gauge 3, 4, 7, 8, …).
// null when there's no exact size yet.
export function trimGauge(hull, n) {
  if (!TRIMMABLE.includes(hull) || n < 1) return null;
  const g = HULLS[hull](hullShell(hull, n, [0, 0, 0])[0]);
  if (hull !== 'to') return g;
  let best = null;
  for (let m = 1; m <= n; m++) {
    const gm = HULLS.to(hullShell('to', m, [0, 0, 0])[0]);
    if (Math.abs(gm - Math.round(gm)) < 1e-9 && [0, 3].includes(Math.round(gm) % 4)) best = gm;
  }
  return best;
}
// Cell `cell` (whole, or one piece of it) cut by the trim planes: null if
// it lies wholly outside, 'inside' if the cut leaves it untouched, else
// the cut solid.
export function trimPiece(planes, splitId, g, cell) {
  const own = piecePlanes(splitId, g, cell);
  const solid = solidFromPlanes(own);
  const inside = (v) => planes.every((p) => dot(p.n, v) <= p.d + 1e-9);
  if (solid.verts.every(inside)) return 'inside';
  const cut = solidFromPlanes([...own, ...planes]);
  return cut.volume > 1e-7 ? cut : null;
}

// The FCC lattice point nearest to p (integers with an even sum): round,
// then fix the parity on the coordinate that was furthest from an integer.
export function nearestFcc(p) {
  const r = p.map(Math.round);
  if ((r[0] + r[1] + r[2]) % 2 !== 0) {
    let i = 0;
    for (let j = 1; j < 3; j++) if (Math.abs(p[j] - r[j]) > Math.abs(p[i] - r[i])) i = j;
    r[i] += p[i] > r[i] ? 1 : -1;
  }
  return r;
}

// The same piece can come from several symmetry elements (its stabiliser).
// canonicalG: the element splitOrientations uses for that piece, so pieces
// from different sources (scaleDecomposition's identifyPiece, pieceAt,
// fragment lists) compare by g directly.
const canonicalCache = new Map();
export function canonicalG(splitId, g) {
  const key = `${splitId}|${g}`;
  if (canonicalCache.has(key)) return canonicalCache.get(key);
  const s = SPLIT_BY_ID.get(splitId);
  const target = vertexKey(s.piece0.verts.map((v) => apply(OH[g], v)));
  const found = splitOrientations(splitId).flat().find((h) => vertexKey(s.piece0.verts.map((v) => apply(OH[h], v))) === target) ?? g;
  canonicalCache.set(key, found);
  return found;
}
