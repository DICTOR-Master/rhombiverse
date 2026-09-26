// Kaleidoscope (2D world of its own, src/app/world-kaleidoscope.js): flat
// tiles with one shared edge length, so every shape here fits edge to
// edge with every other, and the mirror groups that turn a build into a
// kaleidoscope. Pure 2D maths, no THREE (verify:kaleidoscope).
//
// Shapes, in three groups of lattice partners:
//   Penrose: thick rhombus (72°/108°), thin rhombus (36°/144°), pentagon
//            (108°: the thick rhombus's blunt angle);
//   Kagome:  triangle, hexagon;
//   Square:  square, triangle.
// A tile is its corner list, counter-clockwise, edge length 1.
//
// Mirrors (a true kaleidoscope: the build is cut to one fundamental
// domain, and that piece is reflected everywhere):
//   ring k (k = 1 … 12): k mirror lines through the origin, 2k wedges of
//     angle π/k (the dihedral group of order 2k), a round rosette;
//   'tri60' | 'tri45' | 'tri30': three mirrors round a triangle
//     (60-60-60, 45-45-90, 30-60-90), the only triangles whose
//     reflections tile the plane seamlessly; `size` is the triangle's
//     base in edge lengths. The origin is always a mirror corner.
// `turn` rotates the build against the mirrors, like turning the tube.

export const KALEIDO_SHAPES = {
  thick: [72, 108, 72, 108],
  thin: [36, 144, 36, 144],
  pentagon: [108, 108, 108, 108, 108],
  triangle: [60, 60, 60],
  square: [90, 90, 90, 90],
  hexagon: [120, 120, 120, 120, 120, 120],
};
export const KALEIDO_SHAPE_LABELS = { thick: 'Thick rhombus', thin: 'Thin rhombus', pentagon: 'Pentagon', triangle: 'Triangle', square: 'Square', hexagon: 'Hexagon' };
export const KALEIDO_GROUPS = [
  { id: 'penrose', label: 'Penrose', shapes: ['thick', 'thin', 'pentagon'] },
  { id: 'kagome', label: 'Kagome', shapes: ['triangle', 'hexagon'] },
  { id: 'square', label: 'Square', shapes: ['square', 'triangle'] },
];
export const MIRROR_MODES = ['ring', 'tri60', 'tri45', 'tri30'];
export const RING_MIN = 1;
export const RING_MAX = 12;
export const SIZE_MIN = 1;
export const SIZE_MAX = 8;

const DEG = Math.PI / 180;
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

/** The tile of `shape` on the directed edge a→b (interior on its left).
 * `flip` starts the angle list one corner on, so a rhombus can put
 * either its sharp or its blunt corner at a. */
export function tileOnEdge(shape, a, b, flip = false) {
  const base = KALEIDO_SHAPES[shape];
  const angles = flip ? [...base.slice(1), base[0]] : base;
  const v = [a, b];
  let d = sub(b, a);
  for (let i = 1; i < angles.length - 1; i++) {
    d = rot(d, Math.PI - angles[i] * DEG);
    v.push([v[i][0] + d[0], v[i][1] + d[1]]);
  }
  return v;
}

export function centroid(poly) {
  let ax = 0, ay = 0, a2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const c = cross(p, q);
    a2 += c; ax += (p[0] + q[0]) * c; ay += (p[1] + q[1]) * c;
  }
  if (Math.abs(a2) < 1e-12) return poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
  return [ax / (3 * a2), ay / (3 * a2)];
}
export function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += cross(poly[i], poly[(i + 1) % poly.length]);
  return s / 2;
}

/** `shape` centred on p, turned by `angle` (radians): a loose piece. */
export function looseTile(shape, p, angle) {
  const t = tileOnEdge(shape, [0, 0], [1, 0]);
  const c = centroid(t);
  return t.map((q) => { const r = rot(sub(q, c), angle); return [r[0] + p[0], r[1] + p[1]]; });
}

/** The first Attach piece: on the mirror line from the origin, so it
 * starts at the centre of the rosette. */
export const firstTile = (shape) => tileOnEdge(shape, [0, 0], [1, 0]);

/** Two convex tiles overlap in more than a sliver (shared edges and
 * corners are fine). */
export function overlaps(P, Q, eps = 1e-6) {
  for (const poly of [P, Q]) {
    for (let i = 0; i < poly.length; i++) {
      const e = sub(poly[(i + 1) % poly.length], poly[i]);
      const n = [-e[1], e[0]];
      const proj = (R) => R.map((p) => p[0] * n[0] + p[1] * n[1]);
      const a = proj(P), b = proj(Q);
      if (Math.max(...a) <= Math.min(...b) + eps || Math.max(...b) <= Math.min(...a) + eps) return false;
    }
  }
  return true;
}

export function contains(poly, p) {
  for (let i = 0; i < poly.length; i++) {
    if (cross(sub(poly[(i + 1) % poly.length], poly[i]), sub(p, poly[i])) < -1e-9) return false;
  }
  return true;
}

function segDistance(p, a, b) {
  const ab = sub(b, a), ap = sub(p, a);
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])));
  return { d: Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1]), t };
}

/** Nearest tile edge to p within `reach`: { tile, i, t } (edge i runs
 * from corner i to corner i+1; t is how far along it p projects).
 * A tile containing p wins over a nearer edge of another tile. */
export function nearestEdge(tiles, p, reach = 0.6) {
  let best = null;
  const inside = [...tiles].reverse().find((x) => contains(x.verts, p));
  for (const x of inside ? [inside] : tiles) {
    x.verts.forEach((a, i) => {
      const { d, t } = segDistance(p, a, x.verts[(i + 1) % x.verts.length]);
      if (d <= reach && (!best || d < best.d)) best = { tile: x, i, t, d };
    });
  }
  return best;
}

/** The pieces that could go across edge i of `tile`, outside it:
 * preferred orientation first (a rhombus puts its sharp corner at the
 * end of the edge nearer the tap, t). */
export function candidatesAcross(shape, tile, i, t = 0.5) {
  const a = tile.verts[i], b = tile.verts[(i + 1) % tile.verts.length];
  // Reversed (b→a) puts the new interior on the far side from `tile`.
  const plain = tileOnEdge(shape, b, a, false);
  const flipped = tileOnEdge(shape, b, a, true);
  const base = KALEIDO_SHAPES[shape];
  if (base.every((x) => x === base[0])) return [plain];
  // plain has angle base[0] at b (the edge's end, t = 1).
  const sharpAtB = base[0] < base[1];
  return (t >= 0.5) === sharpAtB ? [plain, flipped] : [flipped, plain];
}

// ---- mirrors ----

/** The fundamental domain, a convex CCW polygon (big wedges are cut off
 * far outside any build). */
export function domain(mode, k, size) {
  const R = 400;
  if (mode === 'ring') {
    if (k === 1) return [[-R, 0], [R, 0], [R, R], [-R, R]];
    const a = Math.PI / k;
    return [[0, 0], [R, 0], [R * Math.cos(a), R * Math.sin(a)]];
  }
  const s = size;
  if (mode === 'tri60') return [[0, 0], [s, 0], [s / 2, (s * Math.sqrt(3)) / 2]];
  if (mode === 'tri45') return [[0, 0], [s, 0], [s, s]];
  return [[0, 0], [s, 0], [s, s / Math.sqrt(3)]]; // tri30: 30° at the origin
}

// An affine map as [a, b, c, d, e, f]: (x, y) -> (a x + b y + e, c x + d y + f).
const apply = (m, [x, y]) => [m[0] * x + m[1] * y + m[4], m[2] * x + m[3] * y + m[5]];
const compose = (m, n) => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[0] * n[4] + m[1] * n[5] + m[4], m[2] * n[4] + m[3] * n[5] + m[5],
];
function reflectAcross(a, b) {
  const d = sub(b, a);
  const L = Math.hypot(...d);
  const [ux, uy] = [d[0] / L, d[1] / L];
  const r = [2 * ux * ux - 1, 2 * ux * uy, 2 * ux * uy, 2 * uy * uy - 1];
  // Fix a: e = a - r a.
  return [r[0], r[1], r[2], r[3], a[0] - (r[0] * a[0] + r[1] * a[1]), a[1] - (r[2] * a[0] + r[3] * a[1])];
}
export { apply as applyMap };

/** Every image of the domain within `radius` of the origin, as maps. */
export function groupMaps(mode, k, size, radius = 40) {
  if (mode === 'ring') {
    const out = [];
    for (let j = 0; j < k; j++) {
      const a = (2 * Math.PI * j) / k, c = Math.cos(a), s = Math.sin(a);
      out.push([c, -s, s, c, 0, 0]);
      out.push([c, s, s, -c, 0, 0]); // rotate after reflecting in the x axis
    }
    return out;
  }
  const D = domain(mode, k, size);
  const c0 = centroid(D);
  const keyOf = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
  const id = [1, 0, 0, 1, 0, 0];
  const seen = new Set([keyOf(c0)]);
  const out = [id];
  const queue = [id];
  while (queue.length) {
    const m = queue.shift();
    for (let i = 0; i < 3; i++) {
      const n = compose(m, reflectAcross(D[i], D[(i + 1) % 3]));
      const c = apply(n, c0);
      if (Math.hypot(...c) > radius) continue;
      const key = keyOf(c);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
      queue.push(n);
    }
  }
  return out;
}

/** p folded into the domain: the point of the build a tap on any mirror
 * image really lands on. */
export function fold(mode, k, size, p) {
  if (mode === 'ring') {
    const r = Math.hypot(...p);
    const w = (2 * Math.PI) / k;
    let a = Math.atan2(p[1], p[0]);
    a = ((a % w) + w) % w;
    if (a > w / 2) a = w - a;
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  const D = domain(mode, k, size);
  let q = p;
  for (let n = 0; n < 500; n++) {
    let moved = false;
    for (let i = 0; i < 3; i++) {
      const a = D[i], b = D[(i + 1) % 3];
      if (cross(sub(b, a), sub(q, a)) < -1e-12) { q = apply(reflectAcross(a, b), q); moved = true; }
    }
    if (!moved) break;
  }
  return q;
}

/** Sutherland-Hodgman: poly cut to the convex CCW polygon clip. */
export function clipPolygon(poly, clip) {
  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p) => cross(sub(b, a), sub(p, a)) >= -1e-12;
    const hitAt = (p, q) => {
      const dp = cross(sub(b, a), sub(p, a)), dq = cross(sub(b, a), sub(q, a));
      const t = dp / (dp - dq);
      return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
    };
    const input = out;
    out = [];
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length];
      if (inside(q)) { if (!inside(p)) out.push(hitAt(p, q)); out.push(q); } else if (inside(p)) out.push(hitAt(p, q));
    });
  }
  return out.length >= 3 ? out : [];
}

/** The part of segment a-b inside the convex CCW polygon clip, or null. */
export function clipSegment(a, b, clip) {
  let t0 = 0, t1 = 1;
  const d = sub(b, a);
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i], q = clip[(i + 1) % clip.length];
    const e = sub(q, p);
    const num = cross(e, sub(a, p)), den = cross(e, d);
    if (Math.abs(den) < 1e-14) { if (num < -1e-12) return null; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [[a[0] + t0 * d[0], a[1] + t0 * d[1]], [a[0] + t1 * d[0], a[1] + t1 * d[1]]];
}

export const rotatePoint = rot;

// ---- Penrose matching (Safe) ----
// de Bruijn's form of Penrose's arrow rule: give every corner the index
// sum(n) of its point n in Z^5 (edge directions e_j = 72°·j count +1,
// their opposites -1). In a true Penrose rhombus tiling the indices take
// only four consecutive values (verify:kaleidoscope, against the 5D
// world's tiling), so a rhombus is Safe when its corners stay in 1…4.
// Corners reached along any other direction have no index (null).
export const PENROSE_SHAPES = ['thick', 'thin'];
const STEP = 72 * DEG;
function stepOf(a, b) {
  const t = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (const [off, s] of [[0, 1], [Math.PI, -1]]) {
    const m = (t - off) / STEP;
    if (Math.abs(m - Math.round(m)) < 1e-6) return s;
  }
  return null;
}
/** Indices along a tile's corners, starting from known ones at corners
 * 0 and 1 (null: unknown). */
export function indicesFrom(verts, i0, i1) {
  const out = [i0, i1];
  for (let i = 2; i < verts.length; i++) {
    const s = out[i - 1] === null ? null : stepOf(verts[i - 1], verts[i]);
    out.push(s === null ? null : out[i - 1] + s);
  }
  if (out.some((x) => x === null) || out[0] === null || out[1] === null) return out.map(() => null);
  // Closing edge must agree (it does whenever every edge is on-grid).
  const s = stepOf(verts[verts.length - 1], verts[0]);
  return s !== null && out[verts.length - 1] + s === out[0] ? out : out.map(() => null);
}
/** The first piece's indices, shifted into 1…4 where they fit. */
export function firstIndices(verts) {
  const s = stepOf(verts[0], verts[1]);
  const raw = s === null ? verts.map(() => null) : indicesFrom(verts, 0, s);
  if (raw[0] === null) return raw;
  const shift = 1 - Math.min(...raw);
  return raw.map((x) => x + shift);
}
export const indicesSafe = (idx) => idx.every((x) => x === null || (x >= 1 && x <= 4));
