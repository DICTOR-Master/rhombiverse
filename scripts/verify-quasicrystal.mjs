// Verifies src/geometry-extensions/quasicrystal.js, the cut-and-project
// engine behind the 5D (Penrose, from Z^5) and 6D (Ammann-Kramer, from Z^6)
// worlds, against the known facts about those tilings.
import {
  makeQuasicrystal, BASE_OFFSET, APPROXIMANT_STOPS, approximantPeriods, subsets, centroid, tileKey,
} from '../src/geometry-extensions/quasicrystal.js';
import { PHI, STAR_DIRECTIONS, tilesOverlap } from '../src/geometry-extensions/growth.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}
const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dist = (a, b) => Math.hypot(...sub(a, b));
const volume = (v) => Math.abs(det3(sub(v[4], v[0]), sub(v[2], v[0]), sub(v[1], v[0])));
const NAMES = { '6d': ['prolate', 'oblate'], '5d': ['thick', 'thin'] };

function countOverlaps(e, tiles) {
  const V = tiles.map((t) => e.tileVertices(t.n, t.I));
  let n = 0;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (tilesOverlap(V[i], V[j])) n++;
  return n;
}
function facesNotShared(e, tiles, offset) {
  let n = 0;
  for (const t of tiles) for (const f of e.tileFaces(t.n, t.I)) if (e.tilesOnFace(f.n, f.K, offset).length !== 2) n++;
  return n;
}
const minMargin = (e, tiles, offset) => Math.min(...tiles.map((t) => e.margin(t.n, t.I, offset)));

// Map of tiles under a signed permutation of the basis (a lattice symmetry).
function mapTile(t, perm, sign) {
  const n = new Array(t.n.length).fill(0);
  t.n.forEach((x, i) => { n[perm[i]] += sign[i] * x; });
  for (const i of t.I) if (sign[i] < 0) n[perm[i]] -= 1; // the cube now spans -e, re-anchor it
  return { n, I: t.I.map((i) => perm[i]).sort((a, b) => a - b) };
}
// The signed permutation induced on the par vectors by a 3D/2D rotation.
function signedPermutation(par, rotate) {
  const perm = [], sign = [];
  for (const v of par) {
    const r = rotate(v);
    const j = par.findIndex((w) => dist(w, r) < 1e-9 || dist(w, r.map((x) => -x)) < 1e-9);
    perm.push(j);
    sign.push(dist(par[j], r) < 1e-9 ? 1 : -1);
  }
  return { perm, sign };
}
function rotateAbout(axis, angle) {
  const [x, y, z] = axis.map((c) => c / Math.hypot(...axis));
  const c = Math.cos(angle), s = Math.sin(angle), C = 1 - c;
  const m = [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
  return (v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}
// Perp action of a signed permutation: perp(P e_i) = sign_i perp(e_perm_i).
// Returns the image of offset y under it, by expressing y in 3 perp vectors.
function perpImage(e, perm, sign, y) {
  const [a, b, c] = [0, 1, 2].map((i) => e.perp[i]);
  const d = det3(a, b, c);
  const coef = [det3(y, b, c) / d, det3(a, y, c) / d, det3(a, b, y) / d];
  return [0, 1, 2].reduce((v, i) => v.map((x, k) => x + coef[i] * sign[i] * e.perp[perm[i]][k]), [0, 0, 0]);
}

for (const tier of ['6d', '5d']) {
  const e = makeQuasicrystal(tier);
  const off = BASE_OFFSET[tier];
  const [big, small] = NAMES[tier];
  console.log(`\n== ${tier} (${tier === '6d' ? 'Ammann-Kramer, Z^6' : 'Penrose, Z^5'}) ==`);

  // The frame: par and perp are orthogonal complements.
  const parRows = e.par[0].map((_, k) => e.par.map((v) => v[k]));
  const perpRows = [0, 1, 2].map((k) => e.perp.map((v) => v[k]));
  const maxDot = Math.max(...parRows.flatMap((a) => perpRows.map((b) => Math.abs(a.reduce((s, x, i) => s + x * b[i], 0)))));
  check('par and perp spaces are orthogonal', maxDot < 1e-12);
  check('every par vector has unit length (edge length 1)', e.par.every((v) => Math.abs(Math.hypot(...v) - 1) < 1e-12));

  if (tier === '6d') {
    check('the 20 tile triples give 10 prolate + 10 oblate shapes',
      [...subsets(6, 3)].filter((I) => e.tileType(I) === 'prolate').length === 10);
    check('tile edges are growth.js\'s icosahedral star directions (same golden rhombohedra)',
      e.par.every((v) => STAR_DIRECTIONS.some((w) => dist(v, w) < 1e-9)));
  }

  // The window: rhombic triacontahedron (32 vertices) / rhombic icosahedron (22).
  check(`window is a ${tier === '6d' ? 'rhombic triacontahedron (32 vertices)' : 'rhombic icosahedron (22 vertices)'}`,
    e.windowVertices().length === (tier === '6d' ? 32 : 22));

  // A patch: a real face-to-face tiling.
  const R = tier === '6d' ? 5 : 9;
  const tiles = e.patch(off, R);
  check(`patch of radius ${R}: ${tiles.length} tiles`, tiles.length > (tier === '6d' ? 500 : 250));
  check('base offset is regular (no face test on a window boundary)', minMargin(e, tiles, off) > 1e-6);
  check('every face of every tile is shared by exactly two tiles', facesNotShared(e, tiles, off) === 0);
  check('no two tiles overlap', countOverlaps(e, tiles) === 0);
  check('every tile vertex passes the vertex window test',
    tiles.every((t) => cornerPoints(t).every((m) => e.isVertex(m, off))));
  function cornerPoints(t) {
    const out = [];
    for (let mask = 0; mask < 1 << t.I.length; mask++) out.push(t.n.map((x, l) => x + (t.I.some((i, b) => i === l && mask & (1 << b)) ? 1 : 0)));
    return out;
  }
  function planar(c) { return tier === '6d' ? c : [c[0], c[2]]; }

  // Ratio -> tau: exactly, from the window volumes (a tile's frequency is the
  // volume of its acceptance region), and statistically in a big patch.
  const w = { [big]: 0, [small]: 0 };
  for (const I of subsets(e.d, e.k)) {
    const rest = [...Array(e.d).keys()].filter((l) => !I.includes(l));
    w[e.tileType(I)] += Math.abs(det3(...rest.map((l) => e.perp[l])));
  }
  check(`${big}:${small} frequency ratio from the window volumes is exactly tau`, Math.abs(w[big] / w[small] - PHI) < 1e-12);
  const bigPatch = e.patch(off, tier === '6d' ? 11 : 35);
  const nBig = bigPatch.filter((t) => e.tileType(t.I) === big).length;
  const ratio = nBig / (bigPatch.length - nBig);
  // Space-filling: tiles well inside the big patch fill the ball.
  const inner = (tier === '6d' ? 11 : 35) - 2;
  const volIn = bigPatch.filter((t) => Math.hypot(...planar(centroid(e.tileVertices(t.n, t.I)))) < inner)
    .reduce((s, t) => s + volume(e.tileVertices(t.n, t.I)), 0);
  const ballVol = tier === '6d' ? (4 / 3) * Math.PI * inner ** 3 : Math.PI * inner ** 2 * 1;
  check(`tiles fill space (volume ratio ${(volIn / ballVol).toFixed(3)} within 3% of 1)`, Math.abs(volIn / ballVol - 1) < 0.03);
  check(`${big}:${small} count in a ${bigPatch.length}-tile patch is ${ratio.toFixed(3)}, within 3% of tau`, Math.abs(ratio / PHI - 1) < 0.03);

  // Symmetry, as equivariance: rotating the lattice by a symmetry of the
  // star maps the tiling at offset y to the tiling at the rotated offset.
  // Icosahedral axes: a vertex (5-fold), a face centre (3-fold: three
  // vertices at 63.4 degrees to each other), an edge midpoint (2-fold).
  const nearby = (u) => STAR_DIRECTIONS.filter((w) => Math.abs(w.reduce((s, x, i) => s + x * u[i], 0) - 1 / Math.sqrt(5)) < 1e-9);
  const u0 = e.par[0];
  const [u1] = nearby(u0);
  const u2 = nearby(u0).find((w) => nearby(u1).some((x) => dist(x, w) < 1e-9));
  const rotations = tier === '6d'
    ? [['5-fold', rotateAbout(u0, (2 * Math.PI) / 5)],
       ['3-fold', rotateAbout(u0.map((x, k) => x + u1[k] + u2[k]), (2 * Math.PI) / 3)],
       ['2-fold', rotateAbout(u0.map((x, k) => x + u1[k]), Math.PI)]]
    : [['5-fold', (v) => { const a = (2 * Math.PI) / 5; return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; }]];
  for (const [label, rot] of rotations) {
    const { perm, sign } = signedPermutation(e.par, rot);
    const isPerm = new Set(perm).size === e.d && perm.every((j) => j >= 0);
    const off2 = isPerm ? perpImage(e, perm, sign, off) : off;
    const small3 = e.patch(off, tier === '6d' ? 3 : 5);
    check(`${label} rotation is a lattice symmetry and maps the tiling onto the tiling at the rotated offset`,
      isPerm && small3.every((t) => { const m = mapTile(t, perm, sign); return e.isTile(m.n, m.I, off2); }));
  }

  if (tier === '5d') {
    // Penrose: 7 distinct vertex neighbourhoods by angle (de Bruijn's 8
    // rhombus vertex types; S and S5, both five thick rhombi, differ only by
    // matching arrows). A cut off the Penrose diagonal gives more.
    const penrose = vertexStars(e, off, 25);
    check(`Penrose tiling at the base offset has exactly 7 vertex stars (${penrose.length})`, penrose.length === 7);
    const slid = vertexStars(e, [off[0] + 0.3, off[1] - 0.2, off[2]], 25);
    check('an in-plane phason slide keeps the same 7 vertex stars', slid.join() === penrose.join());
    const generalized = vertexStars(e, [off[0], off[1], off[2] + 0.2 / Math.SQRT2], 25);
    check(`moving off the Penrose diagonal breaks it (${generalized.length} vertex stars)`, generalized.length > 7);
  }

  // Phason: a small step flips tiles only locally.
  const step = tier === '6d' ? [0.01, -0.006, 0.003] : [0.05, -0.035, 0];
  const offB = off.map((x, i) => x + step[i]);
  const rP = tier === '6d' ? 5 : 16;
  const before = new Map(e.patch(off, rP).map((t) => [tileKey(t.n, t.I), t]));
  const after = new Map(e.patch(offB, rP).map((t) => [tileKey(t.n, t.I), t]));
  const gone = [...before.keys()].filter((k) => !after.has(k)).map((k) => before.get(k));
  const come = [...after.keys()].filter((k) => !before.has(k)).map((k) => after.get(k));
  const centre = (t) => centroid(e.tileVertices(t.n, t.I));
  const interior = (t) => Math.hypot(...planar(centre(t))) < rP - 2;
  check(`a small phason step changes some tiles (${gone.length} out, ${come.length} in, of ${before.size})`, gone.length > 0 && come.length > 0);
  check(`...but only ${((100 * gone.length) / before.size).toFixed(0)}% of them (under 15%)`, gone.length / before.size < 0.15);
  check('every tile that leaves is replaced by one arriving within 2 edges (a local flip)',
    gone.filter(interior).length > 0 && gone.filter(interior).every((g) => come.some((c) => dist(centre(g), centre(c)) < 2)));
  const vGone = gone.filter(interior).reduce((s, t) => s + volume(e.tileVertices(t.n, t.I)), 0);
  const vCome = come.filter(interior).reduce((s, t) => s + volume(e.tileVertices(t.n, t.I)), 0);
  check(`flips conserve volume (out ${vGone.toFixed(2)}, in ${vCome.toFixed(2)})`, Math.abs(vGone - vCome) < 0.25 * Math.max(vGone, 1));
  check('a phason step never moves a piece: unchanged tiles keep their key and position',
    [...before.keys()].filter((k) => after.has(k)).every((k) => dist(centre(before.get(k)), centre(after.get(k))) < 1e-12));

  // Approximants: every Fibonacci stop is a valid periodic tiling.
  for (const ap of APPROXIMANT_STOPS.filter(Boolean)) {
    const a = makeQuasicrystal(tier, ap);
    const ts = a.patch(off, tier === '6d' ? 3.5 : 6);
    const periods = approximantPeriods(tier, ap);
    const valid = minMargin(a, ts, off) > 1e-7 && facesNotShared(a, ts, off) === 0 && countOverlaps(a, ts) === 0;
    const periodic = periods.every((p) => Math.hypot(...a.perpOf(p)) < 1e-9 && ts.every((t) => a.isTile(t.n.map((x, i) => x + p[i]), t.I, off)));
    check(`approximant ${ap.join('/')}: valid tiling, periodic along ${periods.length} lattice vectors`, valid && periodic);
  }
}

function vertexStars(e, offset, R) {
  const at = new Map();
  for (const t of e.patch(offset, R)) {
    const [i, j] = t.I;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const v = t.n.map((x, l) => x + (l === i ? a : 0) + (l === j ? b : 0));
      const d1 = e.par[i].map((x) => (a ? -x : x));
      const d2 = e.par[j].map((x) => (b ? -x : x));
      const a1 = Math.atan2(d1[1], d1[0]), a2 = Math.atan2(d2[1], d2[0]);
      let lo = a1;
      let span = (((a2 - a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (span > Math.PI) { lo = a2; span = 2 * Math.PI - span; }
      const key = v.join(',');
      if (!at.has(key)) at.set(key, { p: e.parOf(v), list: [] });
      at.get(key).list.push({ lo, u: Math.round(span / (Math.PI / 5)) });
    }
  }
  const types = new Set();
  for (const { p, list } of at.values()) {
    if (Math.hypot(...p) > R - 4 || list.reduce((s, x) => s + x.u, 0) !== 10) continue;
    const seq = list.sort((x, y) => x.lo - y.lo).map((x) => x.u);
    const forms = [];
    for (const s of [seq, [...seq].reverse()]) for (let r = 0; r < s.length; r++) forms.push([...s.slice(r), ...s.slice(0, r)].join(''));
    types.add(forms.sort()[0]);
  }
  return [...types].sort();
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall quasicrystal checks passed');
process.exit(failures ? 1 : 0);
