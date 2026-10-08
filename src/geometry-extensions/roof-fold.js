// Euclid–Kepler–Pacioli cell: a cube of edge 2 centred at the origin, the regular
// dodecahedron made by putting Euclid's roofs on it, and the regular
// icosahedron made by reflecting the 12 roof vertices back through the cube
// faces. Copies at every translation by 2 along x, y, z form the structure;
// each roof vertex then lands on a neighbouring cell's icosahedron vertex.
// Three-free; exact claims are checked by scripts/verify-roof-fold.mjs.

export const PHI = (1 + Math.sqrt(5)) / 2;
export const ROOF_FOLD_PERIOD = 2;

const cyc = (a, b) => [[0, a, b], [a, b, 0], [b, 0, a]];
const SIGNS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export const fold = (x) => 1 - Math.abs((((x + 1) % 4) + 4) % 4 - 2);

export function roofFoldCell() {
  const cube = [];
  for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) cube.push([x, y, z]);
  const roof = SIGNS.flatMap(([s, t]) => cyc(s / PHI, t * PHI));
  const ico = roof.map((v) => v.map(fold));
  const dodeca = [...cube, ...roof];
  return {
    cube,
    dodeca,
    ico,
    cubeEdges: edgesOfLength(cube, 2),
    dodecaEdges: edgesOfLength(dodeca, 2 / PHI),
    icoEdges: edgesOfLength(ico, 2 / PHI ** 2),
    nodes: [[1, 1, 1], ...ico],
  };
}

// Inside out, each wrapping the one before: rects ⊂ ico ⊂ oct ⊂ stella ⊂ cube ⊂ dodeca.
// The star holds the icosahedron and sits in the dodecahedron (its hull) but crosses the
// octahedron, stella and cube, so it goes last before the dodecahedron (verify-roof-fold.mjs).
export const ROOF_FOLD_KINDS = ['rects', 'ico', 'oct', 'stella', 'cube', 'star', 'dodeca'];
// One colour per piece, shared by every world that shows the cell.
export const ROOF_FOLD_COLOURS = { cube: 0x9fb4c8, dodeca: 0xffc857, ico: 0x5fd38a, star: 0xff7a59, oct: 0x4dd0e1, stella: 0xc792ea, rects: 0xffe082 };
// World units: icosahedron edge 1, dodecahedron phi, cube phi^2.
export const ROOF_FOLD_WORLD_SCALE = PHI ** 2 / 2;
export const siteParity = (x, y, z) => (((x + y + z) % 2) + 2) % 2;
// A quarter turn about z, for the turned view of odd sites (points in cell units).
export const turnPoint = (p) => [-p[1], p[0], p[2]];
const mod2 = (n) => ((n % 2) + 2) % 2;
// Site colourings for the alternating and checkerboard views, and the space
// group each leaves (checked in scripts/verify-roof-fold.mjs).
export const ROOF_FOLD_PATTERNS = {
  xyz: { colours: 2, of: (x, y, z) => mod2(x + y + z), group: 'Fm-3 (No. 202)' },
  columns: { colours: 2, of: (x, y) => mod2(x + y), group: 'Cmmm (No. 65)' },
  layers: { colours: 2, of: (x, y, z) => mod2(z), group: 'Pmmm (No. 47)' },
  octants: { colours: 8, of: (x, y, z) => mod2(x) + 2 * mod2(y) + 4 * mod2(z), group: 'Pmmm (No. 47), cell doubled' },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a); return a.map((c) => c / l); };
const centroid = (P) => P.reduce(add).map((c) => c / P.length);

// The vertices of a convex face with outward normal n, in counter-clockwise order seen from outside.
function ringAround(points, n) {
  const c = centroid(points);
  const u = unit(sub(points[0], c));
  const w = cross(n, u);
  return [...points].sort((p, q) => Math.atan2(dot(sub(p, c), w), dot(sub(p, c), u)) - Math.atan2(dot(sub(q, c), w), dot(sub(q, c), u)));
}
function convexFaces(verts, normals) {
  return normals.map((n) => {
    const d = Math.max(...verts.map((v) => dot(v, n)));
    return ringAround(verts.filter((v) => Math.abs(dot(v, n) - d) < 1e-9), n);
  });
}
const outward = (tri, inside) => (dot(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])), sub(centroid(tri), inside)) < 0 ? [tri[0], tri[2], tri[1]] : tri);

// Face polygons (outward, counter-clockwise) and edges of each solid, centred on the origin, cube edge 2.
// Face centres of the cube (the octahedron), the two tetrahedra on alternate corners, and
// each tetrahedron's outward face normals (the corner it doesn't use, negated, per face).
const OCT = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const TETS = [
  [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]],
];
const TET_NORMALS = TETS.map((T) => T.map((v) => unit(v.map((c) => -c))));

// The three mutually perpendicular golden rectangles (sides 2/phi and 2/phi^2) in the
// coordinate planes, counter-clockwise about +x, +y, +z.
export function goldenRectangles() {
  const a = 1 / PHI, b = 1 / PHI ** 2;
  return [
    [[0, a, b], [0, -a, b], [0, -a, -b], [0, a, -b]],
    [[b, 0, a], [b, 0, -a], [-b, 0, -a], [-b, 0, a]],
    [[a, b, 0], [-a, b, 0], [-a, -b, 0], [a, -b, 0]],
  ];
}

export function roofFoldSolids() {
  const C = roofFoldCell();
  const icoTris = [];
  for (const [i, j] of C.icoEdges) for (let k = j + 1; k < 12; k++) {
    if (C.icoEdges.some(([a, b]) => a === i && b === k) && C.icoEdges.some(([a, b]) => a === j && b === k)) icoTris.push(outward([C.ico[i], C.ico[j], C.ico[k]], [0, 0, 0]));
  }
  // Each icosahedron face's spike tip: the dodecahedron vertex 2/phi from its three corners.
  const tipOf = (tri) => C.dodeca.find((v) => dot(v, centroid(tri)) > 0 && tri.every((p) => Math.abs(Math.hypot(...sub(v, p)) - 2 / PHI) < 1e-9));
  const starTris = [];
  const starEdges = C.icoEdges.map(([i, j]) => [C.ico[i], C.ico[j]]);
  for (const tri of icoTris) {
    const tip = tipOf(tri);
    const base = centroid(tri);
    for (let e = 0; e < 3; e++) starTris.push(outward([tri[e], tri[(e + 1) % 3], tip], base));
    tri.forEach((p) => starEdges.push([p, tip]));
  }
  const pairs = (V, E) => E.map(([i, j]) => [V[i], V[j]]);
  return {
    cube: { faces: convexFaces(C.cube, [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]), edges: pairs(C.cube, C.cubeEdges) },
    dodeca: { faces: convexFaces(C.dodeca, C.ico.map(unit)), edges: pairs(C.dodeca, C.dodecaEdges) },
    ico: { faces: icoTris, edges: pairs(C.ico, C.icoEdges) },
    star: { faces: starTris, edges: starEdges },
    // The octahedron on the six cube-face centres; the icosahedron's vertices lie on its edges.
    oct: { faces: convexFaces(OCT, TET_NORMALS.flat()), edges: pairs(OCT, edgesOfLength(OCT, Math.SQRT2)) },
    // The stella octangula: the two regular tetrahedra on alternate cube corners, overlapping in the octahedron.
    stella: { faces: TETS.flatMap((T) => convexFaces(T, TET_NORMALS[TETS.indexOf(T)])), edges: TETS.flatMap((T) => pairs(T, edgesOfLength(T, 2 * Math.SQRT2))) },
    // Pacioli's three golden rectangles: the folded roof ridges, corners on the icosahedron.
    rects: { faces: goldenRectangles(), edges: goldenRectangles().flatMap((R) => R.map((p, i) => [p, R[(i + 1) % 4]])) },
  };
}

// Split a convex polygon by the plane n.p = d into the parts above and below.
function splitPolygon(P, n, d) {
  const above = [], below = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const da = dot(a, n) - d, db = dot(b, n) - d;
    if (da >= 0) above.push(a);
    if (da <= 0) below.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const x = add(a, sub(b, a).map((c) => (c * da) / (da - db)));
      above.push(x);
      below.push(x);
    }
  }
  const clean = (Q) => Q.filter((p, i) => Math.hypot(...sub(p, Q[(i + 1) % Q.length])) > 1e-9);
  const ok = (Q) => Q.length >= 3 && polygonArea(Q) > 1e-7; // slivers have no visible area but would add false edges
  const A = clean(above), B = clean(below);
  return { above: ok(A) ? A : null, below: ok(B) ? B : null };
}
function polygonArea(P) {
  let s = [0, 0, 0];
  for (let i = 1; i + 1 < P.length; i++) s = add(s, cross(sub(P[i], P[0]), sub(P[i + 1], P[0])));
  return Math.hypot(...s) / 2;
}

// The exact outer surface of the union of dodecahedra at the given sites
// ([x, y, z] integers; centres at 2 * site). Returns { site, polygon, normal } pieces.
// Where a neighbour's face lies in the same plane, an opposite-facing one
// counts as touching (interior where they meet) and a same-facing one is
// kept once, by the lower site key, so no face is drawn twice.
export function mergedDodecaSurface(sites) {
  const { dodeca } = roofFoldSolids();
  const faces = dodeca.faces.map((f) => { const n = unit(cross(sub(f[1], f[0]), sub(f[2], f[0]))); return { f, n, d: dot(f[0], n) }; });
  const keyOf = (s) => s.join();
  const occupied = new Map(sites.map((s) => [keyOf(s), s]));
  const out = [];
  for (const s of occupied.values()) {
    const o = s.map((c) => 2 * c);
    const neighbours = [];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
      const t = [s[0] + dx, s[1] + dy, s[2] + dz];
      if ((dx || dy || dz) && occupied.has(keyOf(t))) neighbours.push(t);
    }
    for (const face of faces) {
      let pieces = [face.f.map((p) => add(p, o))];
      const faceD = face.d + dot(face.n, o);
      for (const t of neighbours) {
        const ot = t.map((c) => 2 * c);
        const next = [];
        for (const piece of pieces) {
          // Inside t's dodecahedron: below all its planes. Keep what's above any plane.
          let rest = piece;
          for (const g of faces) {
            if (!rest) break;
            const gd = g.d + dot(g.n, ot);
            const coplanar = Math.abs(Math.abs(dot(g.n, face.n)) - 1) < 1e-9 && Math.abs(dot(g.n, face.n) * faceD - gd) < 1e-9;
            if (coplanar) {
              const opposite = dot(g.n, face.n) < 0;
              if (opposite || keyOf(t) < keyOf(s)) continue; // on this plane counts as inside t
              next.push(rest); rest = null; break;           // same plane, kept by this site
            }
            const { above, below } = splitPolygon(rest, g.n, gd);
            if (above) next.push(above);
            rest = below;
          }
        }
        pieces = next;
        if (!pieces.length) break;
      }
      for (const polygon of pieces) out.push({ site: s, polygon, normal: face.n });
    }
  }
  return out;
}

// The visible edges of a merged surface: outline and creases only. An edge
// is a seam (dropped) when the union is flat across it: on both sides, just
// below the piece's plane is inside a dodecahedron and just above is not.
// Edges shared by several pieces are drawn once.
export function mergedDodecaEdges(pieces, sites) {
  const { dodeca } = roofFoldSolids();
  const planes = dodeca.faces.map((f) => { const n = unit(cross(sub(f[1], f[0]), sub(f[2], f[0]))); return { n, d: dot(f[0], n) }; });
  // Only dodecahedra centred within one cell of a point can contain it.
  const occupied = new Set(sites.map((st) => st.join()));
  const inUnion = (p) => {
    const c = p.map((x) => Math.round(x / 2));
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
      const st = [c[0] + dx, c[1] + dy, c[2] + dz];
      if (occupied.has(st.join()) && planes.every(({ n, d }) => dot(sub(p, st.map((x) => 2 * x)), n) < d - 1e-12)) return true;
    }
    return false;
  };
  const raw = [];
  for (const { polygon: P, normal: n } of pieces) {
    for (let i = 0; i < P.length; i++) if (Math.hypot(...sub(P[(i + 1) % P.length], P[i])) > 1e-9) raw.push({ a: P[i], b: P[(i + 1) % P.length], n });
  }
  // Split every edge at any endpoint lying inside it, so each sub-segment is judged on its own.
  const CELL = 0.5;
  const grid = new Map();
  const cellOf = (p) => p.map((c) => Math.floor(c / CELL));
  for (const e of raw) for (const p of [e.a, e.b]) {
    const k = cellOf(p).join();
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  const pointsNear = (a, b) => {
    const lo = cellOf(a.map((c, i) => Math.min(c, b[i]) - 1e-6)), hi = cellOf(a.map((c, i) => Math.max(c, b[i]) + 1e-6));
    const found = [];
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) found.push(...(grid.get(`${x},${y},${z}`) ?? []));
    return found;
  };
  const flat = (a, b, n) => {
    const mid = a.map((c, j) => (c + b[j]) / 2);
    const v = unit(cross(sub(b, a), n));
    return [1, -1].every((side) => {
      const q = add(mid, v.map((c) => c * side * 1e-4));
      return inUnion(add(q, n.map((c) => -c * 1e-6))) && !inUnion(add(q, n.map((c) => c * 1e-6)));
    });
  };
  const seen = new Set();
  const out = [];
  for (const { a, b, n } of raw) {
    const ab = sub(b, a), L2 = dot(ab, ab);
    const cuts = [0, 1];
    for (const p of pointsNear(a, b)) {
      const t = dot(sub(p, a), ab) / L2;
      if (t > 1e-9 && t < 1 - 1e-9 && Math.hypot(...sub(add(a, ab.map((c) => c * t)), p)) < 1e-9) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let i = 0; i + 1 < cuts.length; i++) {
      if (cuts[i + 1] - cuts[i] < 1e-9) continue;
      const p = add(a, ab.map((c) => c * cuts[i])), q = add(a, ab.map((c) => c * cuts[i + 1]));
      const key = [p, q].map((x) => x.map((c) => (Math.round(c * 1e6) / 1e6 + 0).toFixed(6)).join()).sort().join('|');
      if (seen.has(key) || flat(p, q, n)) continue;
      seen.add(key);
      out.push([p, q]);
    }
  }
  return out;
}

export function edgesOfLength(verts, length, tol = 1e-9) {
  const out = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (Math.abs(Math.hypot(...verts[i].map((c, k) => c - verts[j][k])) - length) < tol) out.push([i, j]);
    }
  }
  return out;
}

// ---- The Sunstar Lattice (DICTO, 2026-10-08; ported from Kaleidohedra) ----
// Regular dodecahedra on the even cells of the EKP cubic lattice are the dodecahedron's densest
// lattice packing; each hole they leave on the odd cells is a Dogstar. A dodecahedron with the
// Dogstars round it is a Sunstar, the sun with its sun dogs (DICTO's names).
const clipBelow = (P, n, d) => splitPolygon(P, n, d).below;
const halfSpacesOf = (faces) => faces.map((f) => { const n = unit(cross(sub(f[1], f[0]), sub(f[2], f[0]))); return [n, dot(n, f[0])]; });
const insideAll = (H, p, eps = 1e-9) => H.every(([n, d]) => dot(n, p) <= d + eps);
let dodecaH = null;
/** Is p (cell units, centred on the cell) inside the cell's regular dodecahedron? */
export function insideDodecahedron(p) {
  dodecaH ??= halfSpacesOf(roofFoldSolids().dodeca.faces);
  return insideAll(dodecaH, p);
}
const DOGSTAR_NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];
/** Is p inside the cell's Dogstar: in its cube, and in none of the neighbouring dodecahedra? */
export function insideDogstar(p) {
  if (p.some((c) => Math.abs(c) > 1 + 1e-9)) return false;
  return !DOGSTAR_NEIGHBOURS.some((d) => insideDodecahedron(p.map((c, i) => c - 2 * d[i])));
}
/** The cell offsets two pieces can touch at: the 6 face neighbours and the 12 FCC neighbours. */
export const PAIR_LATTICE_NEIGHBOURS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
];
/** The dodecahedron's six five-fold axes, unit vectors (its face normals, one per opposite pair). */
export function fiveFoldAxes() {
  const out = [];
  for (const f of roofFoldSolids().dodeca.faces) {
    const c = unit(f.reduce((s, p) => add(s, p), [0, 0, 0]));
    if (!out.some((a) => Math.abs(dot(a, c)) > 1 - 1e-9)) out.push(c);
  }
  return out;
}
// Regular dodecahedra on the even cells (the densest lattice packing of the dodecahedron) leave one
// hole in each odd cell. The hole is exactly a partial stellation of a regular dodecahedron 1/phi^3
// the size of the cell's, sharing its orientation: its core, all 12 first-layer pyramids, 24 of the
// 30 second-layer wedges and the 8 great-stellated spikes that point at the cube corners (whose tips
// are the cube corners). So dodecahedra and Dogstars fill space. A dodecahedron with the Dogstars
// round it is a Sunstar, the sun with its sun dogs; together they make the Sunstar Lattice. Dogstars
// alone share corners, four at each cube corner. Built as the boundary of the hole:
// on each of the 12 planes bounding it, the cells of the plane (cut by the other 11) that have the
// hole on one side and a dodecahedron on the other. Returns its faces (cube edge 2, centred).
export function dogstarSolid() {
  const { dodeca } = roofFoldSolids();
  const D = dodeca.faces.map((f) => { const n = unit(cross(sub(f[1], f[0]), sub(f[2], f[0]))); return { n, d: dot(n, f[0]) }; });
  const centres = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if ((x + y + z) % 2 !== 0) centres.push([2 * x, 2 * y, 2 * z]);
  const inDodeca = (p) => centres.some((c) => D.every(({ n, d }) => dot(n, sub(p, c)) < d + 1e-12));
  const inHole = (p) => p.every((c) => Math.abs(c) <= 1 + 1e-9) && !inDodeca(p);
  // The 12 planes: the dodecahedron's face planes pulled in to 1/phi^3 of its inradius.
  const r = D[0].d / PHI ** 3;
  const planes = D.map(({ n }) => ({ n, d: r }));
  const faces = [];
  for (const pl of planes) {
    const u = unit(cross(pl.n, Math.abs(pl.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(pl.n, u);
    const o = pl.n.map((c) => c * pl.d);
    let Q = [[-9, -9], [9, -9], [9, 9], [-9, 9]].map(([a, b]) => o.map((c, i) => c + a * u[i] + b * v[i]));
    for (let a = 0; a < 3 && Q; a++) for (const s of [1, -1]) { const n = [0, 0, 0]; n[a] = s; Q = Q && clipBelow(Q, n, 1); }
    if (!Q) continue;
    let cells = [Q];
    for (const sp of planes) {
      if (sp === pl) continue;
      cells = cells.flatMap((C) => { const { above, below } = splitPolygon(C, sp.n, sp.d); return [above, below].filter(Boolean); });
    }
    for (const C of cells) {
      if (polygonArea(C) < 1e-9) continue;
      const c = centroid(C);
      const back = inHole(add(c, pl.n.map((x) => -x * 1e-6))), front = inHole(add(c, pl.n.map((x) => x * 1e-6)));
      if (back === front) continue;
      const out = back ? pl.n : pl.n.map((x) => -x);
      faces.push(dot(cross(sub(C[1], C[0]), sub(C[2], C[0])), out) < 0 ? [...C].reverse() : C);
    }
  }
  return faces;
}

// ---- The Dragon Jewel and the Stella–Jewel Lattice (DICTO, 2026-10-08; ported from Kaleidohedra) ----
// The Dragon Jewel (DJ) is DICTO's name for the EKP windows solid (Kaleidohedra DISCOVERIES #10): the
// dodecahedron with its six face-neighbours' stella octangulas carved out. Dragon Jewels on the even
// cells and stella octangulas on the odd cells fill space (study 10b).
const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function neighbourStellas() {
  const { stella } = roofFoldSolids();
  return FACE_DIRS.flatMap((d) => [0, 4].map((k) => stella.faces.slice(k, k + 4).map((f) => f.map((p) => add(p, d.map((c) => 2 * c))))));
}

// The dodecahedron with its six face-neighbours' stellas carved out. Its outside is 12 rhombi,
// one on each cube edge, at the dodecahedron's own face angles (72 and 108 degrees, edge 2/phi);
// the cut-away is walled by the stellas' faces, in triangles meeting at the cube-face centres.
// The 12 window rhombi (see ekpWindowsSolid), each wound outward.
export function ekpWindowRhombi() {
  const { dodeca } = roofFoldSolids();
  const isCorner = (p) => p.every((c) => Math.abs(Math.abs(c) - 1) < 1e-9);
  return dodeca.faces.map((f) => {
    const [A, B] = f.filter(isCorner);
    const Z = f.find((p) => !isCorner(p) && [A, B].every((c) => Math.abs(Math.hypot(...sub(p, c)) - 2 / PHI) < 1e-9));
    const X = A.map((c, i) => c + B[i] - Z[i]);
    const R = [A, X, B, Z];
    return dot(cross(sub(R[1], R[0]), sub(R[2], R[0])), centroid(f)) < 0 ? R.reverse() : R;
  });
}

export function ekpWindowsSolid() {
  const { dodeca } = roofFoldSolids();
  const rhombi = ekpWindowRhombi();
  const planesOf = (faces) => faces.map((f) => { const n = unit(cross(sub(f[1], f[0]), sub(f[2], f[0]))); return { n, d: dot(n, f[0]) }; });
  const D = planesOf(dodeca.faces);
  const tets = neighbourStellas().map((faces) => ({ faces, planes: planesOf(faces) }));
  // Walls: on every stella face plane, the part of the dodecahedron cut into cells by every other
  // plane, kept where the carved solid lies on exactly one side, facing away from it.
  const inside = (p) => D.every(({ n, d }) => dot(n, p) < d - 1e-12) && !tets.some((T) => T.planes.every(({ n, d }) => dot(n, p) < d + 1e-12));
  const keyOf = ({ n, d }) => [...n, d].map((c) => (Math.round(c * 1e7) / 1e7 + 0).toFixed(7)).join();
  const planes = new Map();
  for (const T of tets) for (const pl of T.planes) {
    const flip = pl.n.find((c) => Math.abs(c) > 1e-9) < 0;
    const q = flip ? { n: pl.n.map((c) => -c), d: -pl.d } : pl;
    planes.set(keyOf(q), q);
  }
  const splitters = [...planes.values()];
  const boundary = [];
  for (const pl of splitters) {
    // A large square in the plane, cut down to the dodecahedron.
    const u = unit(cross(pl.n, Math.abs(pl.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(pl.n, u);
    const o = pl.n.map((c) => c * pl.d);
    let Q = [[-9, -9], [9, -9], [9, 9], [-9, 9]].map(([a, b]) => o.map((c, i) => c + a * u[i] + b * v[i]));
    for (const { n, d } of D) { Q = Q && clipBelow(Q, n, d); }
    if (!Q) continue;
    let cells = [Q];
    for (const sp of splitters) {
      if (Math.abs(Math.abs(dot(sp.n, pl.n)) - 1) < 1e-9) continue;
      cells = cells.flatMap((C) => { const { above, below } = splitPolygon(C, sp.n, sp.d); return [above, below].filter(Boolean); });
    }
    for (const C of cells) {
      if (polygonArea(C) < 1e-9) continue;
      const c = centroid(C);
      const back = inside(add(c, pl.n.map((x) => -x * 1e-6))), front = inside(add(c, pl.n.map((x) => x * 1e-6)));
      if (back === front) continue;
      // Outward: away from the side the solid is on.
      const out = back ? pl.n : pl.n.map((x) => -x);
      boundary.push(dot(cross(sub(C[1], C[0]), sub(C[2], C[0])), out) < 0 ? [...C].reverse() : C);
    }
  }
  return { rhombi, walls: boundary };
}

let djParts = null;
function dragonJewelParts() {
  if (djParts) return djParts;
  const { dodeca, stella } = roofFoldSolids();
  const tetra = [stella.faces.slice(0, 4), stella.faces.slice(4, 8)].map(halfSpacesOf);
  const neighbourTetra = FACE_DIRS.flatMap((d) => tetra.map((H) => H.map(([n, k]) => [n, k + 2 * dot(n, d)])));
  djParts = { tetra, dodecaH: halfSpacesOf(dodeca.faces), neighbourTetra };
  return djParts;
}
/** Is p (cell units, centred on the cell) inside the Dragon Jewel? */
export function insideDragonJewel(p) {
  const { dodecaH: H, neighbourTetra } = dragonJewelParts();
  return insideAll(H, p) && !neighbourTetra.some((T) => insideAll(T, p, -1e-9));
}
/** Is p inside the cell's stella octangula? */
export function insideStella(p) {
  return dragonJewelParts().tetra.some((T) => insideAll(T, p));
}
/**
 * The five window positions on each of the dodecahedron's 12 faces: for each of the
 * pentagon's five diagonals AB (V the corner between A and B), the thick rhombus A V B V'
 * (V' is V reflected across AB). The cube picks one per face, the diagonal that is a cube
 * edge: `chosen`. Returned as { face, rhombus, chosen }.
 */
export function fiveWindowPositions() {
  const { dodeca } = roofFoldSolids();
  const out = [];
  dodeca.faces.forEach((f, fi) => {
    for (let k = 0; k < 5; k++) {
      const A = f[k], V = f[(k + 1) % 5], B = f[(k + 2) % 5];
      const m = add(A, B).map((c) => c / 2);
      const Vr = sub(m.map((c) => 2 * c), V);
      const isCubeEdge = A.every((c) => Math.abs(Math.abs(c) - 1) < 1e-9) && B.every((c) => Math.abs(Math.abs(c) - 1) < 1e-9);
      out.push({ face: fi, rhombus: [A, V, B, Vr], chosen: isCubeEdge });
    }
  });
  return out;
}
