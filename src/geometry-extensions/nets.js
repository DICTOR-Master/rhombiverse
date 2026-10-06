// Nets (2D → 3D): a solid's faces unfolded flat, edge to edge, and folded
// back up (direct decisions, 2026-09-29: "a new section of 2D to 3D, only
// nets"; "follow the ghost net in 2D, side by side, 1D, shape by shape;
// construction complete, tap it and it folds into the solid"; "fold
// slider"; "flagship first": the cube and the RD). Pure maths, no THREE
// (verify:nets).
//
// A net is a tree over the solid's faces: each face but the first hangs
// from a parent face on a shared edge, its hinge. Folding by t (0 flat,
// 1 closed) turns each face about its hinge by (1 - t) of its unfold
// angle, on top of its parent's own turn; the first face lies flat on
// the screen throughout.

// ---- a little linear algebra (4×4, column-major like THREE.Matrix4) ----
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const mul = (A, B) => {
  const C = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) C[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k];
  return C;
};
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const apply = (M, p) => [0, 1, 2].map((r) => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r]);
// Rotation by `angle` about the line through `a` along unit `d`.
function rotationAbout(a, d, angle) {
  const [x, y, z] = d, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const R = [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
  const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, a[0], a[1], a[2], 1];
  const Ti = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -a[0], -a[1], -a[2], 1];
  return mul(T, mul(R, Ti));
}

// ---- the solids: vertices and faces (each face its corners in order) ----
function cube() {
  const v = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const idx = (x, y, z) => v.findIndex((p) => p[0] === x && p[1] === y && p[2] === z);
  const faces = [];
  for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) {
    const [i, j] = [0, 1, 2].filter((d) => d !== k);
    const at = (a, b) => { const p = [0, 0, 0]; p[k] = sg; p[i] = a; p[j] = b; return idx(...p); };
    faces.push([at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]);
  }
  return { v, faces, edge: 2 };
}
function rd() {
  const v = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  for (let k = 0; k < 3; k++) for (const sg of [1, -1]) { const p = [0, 0, 0]; p[k] = 2 * sg; v.push(p); }
  const key = (p) => p.join();
  const at = (p) => v.findIndex((q) => key(q) === key(p));
  const faces = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (const si of [1, -1]) for (const sj of [1, -1]) {
    const k = 3 - i - j;
    const A = [0, 0, 0]; A[i] = 2 * si;
    const B = [0, 0, 0]; B[j] = 2 * sj;
    const c = (sk) => { const p = [0, 0, 0]; p[i] = si; p[j] = sj; p[k] = sk; return p; };
    faces.push([at(A), at(c(1)), at(B), at(c(-1))]);
  }
  return { v, faces, edge: Math.sqrt(3) };
}
// The truncated octahedron: the permutations of (0, ±1, ±2); six square
// faces (a coordinate ±2) and eight hexagons (x·s = 3 for each sign
// triple s), their corners put in order round each face.
function truncatedOctahedron() {
  const v = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const [i, j, k] of perms) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const p = [0, 0, 0]; p[i] = 0; p[j] = a; p[k] = 2 * b;
    if (!v.some((q) => q.every((x, d) => x === p[d]))) v.push(p);
  }
  const faces = [];
  for (let k = 0; k < 3; k++) for (const sg of [-1, 1]) faces.push(ordered(v, v.map((p, i) => i).filter((i) => v[i][k] === 2 * sg)));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) faces.push(ordered(v, v.map((p, i) => i).filter((i) => v[i][0] * sx + v[i][1] * sy + v[i][2] * sz === 3)));
  return { v, faces, edge: Math.SQRT2 };
}
// A face's corners (indices) in order round its centre.
function ordered(v, idx) {
  const pts = idx.map((i) => v[i]);
  const c = pts.reduce((s, p) => s.map((x, d) => x + p[d] / pts.length), [0, 0, 0]);
  const n = norm(c);
  const u = norm(sub(pts[0], c));
  const w = cross(n, u);
  return idx.map((i) => ({ i, a: Math.atan2(dot(sub(v[i], c), w), dot(sub(v[i], c), u)) })).sort((a, b) => a.a - b.a).map((x) => x.i);
}
// Any convex solid from its vertices: its faces are the planes through
// three corners with every other corner on one side; its edge the
// shortest distance between corners.
function hullOf(v) {
  const faces = [];
  const seen = new Set();
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++) {
    let n = cross(sub(v[j], v[i]), sub(v[k], v[i]));
    const len = Math.hypot(...n);
    if (len < 1e-9) continue;
    n = n.map((x) => x / len);
    const d = dot(n, v[i]);
    const side = v.map((p) => dot(n, p) - d);
    if (side.every((x) => x <= 1e-9) || side.every((x) => x >= -1e-9)) {
      const on = v.map((p, q) => q).filter((q) => Math.abs(side[q]) < 1e-9);
      const key = on.join();
      if (!seen.has(key)) { seen.add(key); faces.push(ordered(v, on)); }
    }
  }
  let edge = Infinity;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) edge = Math.min(edge, Math.hypot(...sub(v[i], v[j])));
  return { v, faces, edge };
}
const PHI = (1 + Math.sqrt(5)) / 2;
const cyclic = (pts) => pts.flatMap(([a, b, c]) => [[a, b, c], [b, c, a], [c, a, b]]);
const signs = (p) => {
  let out = [[]];
  for (const x of p) out = out.flatMap((q) => (x === 0 ? [[...q, 0]] : [[...q, x], [...q, -x]]));
  return out;
};
const tetrahedron = () => hullOf([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
const octahedron = () => hullOf([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
const icosahedron = () => hullOf(cyclic(signs([0, 1, PHI])));
const dodecahedron = () => hullOf([...signs([1, 1, 1]), ...cyclic(signs([0, 1 / PHI, PHI]))]);
// The golden zonohedra: every face the same golden rhombus (diagonals phi : 1).
// Each is the zonohedron of some of the icosahedron's six five-fold axes:
// three give a golden rhombohedron (prolate or oblate, depending on which
// three), four the Bilinski dodecahedron, five the rhombic icosahedron, all
// six the rhombic triacontahedron.
const FIVEFOLD = [[0, 1, PHI], [0, -1, PHI], [1, PHI, 0], [-1, PHI, 0], [PHI, 0, 1], [PHI, 0, -1]];
const zonohedron = (dirs) => {
  const pts = [];
  for (let m = 0; m < 1 << dirs.length; m++) pts.push(dirs.reduce((acc, d, i) => acc.map((c, k) => c + (m >> i & 1 ? 0.5 : -0.5) * d[k]), [0, 0, 0]));
  const { faces } = hullOf(pts);
  // Every edge is one of the axes. (The nearest two corners aren't always an
  // edge: the oblate's two flat-side poles are closer.)
  const edge = Math.hypot(...dirs[0]);
  // Keep only the corners: interior sums belong to no face.
  const used = [...new Set(faces.flat())].sort((a, b) => a - b);
  const at = new Map(used.map((i, j) => [i, j]));
  return { v: used.map((i) => pts[i]), faces: faces.map((f) => f.map((i) => at.get(i))), edge };
};
// Pairwise dots of three axes all positive: the prolate; a negative product: the oblate.
const prolate = () => zonohedron([FIVEFOLD[0], FIVEFOLD[2], FIVEFOLD[4]]);
const oblate = () => zonohedron([FIVEFOLD[0], FIVEFOLD[1], FIVEFOLD[2]]);
const bilinski = () => zonohedron(FIVEFOLD.slice(0, 4));
const rhombicIcosahedron = () => zonohedron(FIVEFOLD.slice(0, 5));
const triacontahedron = () => zonohedron(FIVEFOLD);
// Grouped as the panel shows them. The Voronoi cells (direct decision,
// 2026-09-29: "Voronoi in the name if valid and relevant"): the cube, the
// RD and the truncated octahedron are exactly the Voronoi cells of the
// simple, face-centred and body-centred cubic lattices, the region
// nearer one lattice point than any other, and so each fills space.
// The Platonic solids (direct decision, 2026-09-29: "all possible
// regulars"), the cube among them too. `piece`: its 3D piece, where
// the 3D world has one (Open in 3D).
export const SOLIDS = {
  cube: { label: 'Cube', groups: ['voronoi', 'platonic'], make: cube, piece: 'cube' },
  rd: { label: 'Rhombic dodecahedron', groups: ['voronoi'], make: rd, piece: 'rd' },
  to: { label: 'Truncated octahedron', groups: ['voronoi'], make: truncatedOctahedron, piece: 'to' },
  tetra: { label: 'Tetrahedron', groups: ['platonic'], make: tetrahedron },
  octa: { label: 'Octahedron', groups: ['platonic'], make: octahedron, piece: 'octahedron' },
  icosa: { label: 'Icosahedron', groups: ['platonic'], make: icosahedron },
  dodeca: { label: 'Dodecahedron', groups: ['platonic'], make: dodecahedron },
  // The golden zonohedra, coloured as in the Golden Rhombohedra world; the two
  // rhombohedra open there (`golden`).
  prolate: { label: 'Prolate golden rhombohedron', groups: ['golden'], make: prolate, golden: 'prolate', color: 0xffc857 },
  oblate: { label: 'Oblate golden rhombohedron', groups: ['golden'], make: oblate, golden: 'oblate', color: 0x7cc4ff },
  bilinski: { label: 'Bilinski dodecahedron', groups: ['golden'], make: bilinski, color: 0xffc857 },
  ricosa: { label: 'Rhombic icosahedron', groups: ['golden'], make: rhombicIcosahedron, color: 0xffc857 },
  rtriac: { label: 'Rhombic triacontahedron', groups: ['golden'], make: triacontahedron, color: 0xffc857 },
};
export const SOLID_GROUPS = [{ id: 'voronoi', label: 'Voronoi cells' }, { id: 'platonic', label: 'Platonic solids' }, { id: 'golden', label: 'Golden zonohedra' }];

// ---- nets ----
// Faces as corner coordinates, scaled to edge L, each wound so its normal
// points outward.
function solidFaces(id, L) {
  const { v, faces, edge } = SOLIDS[id].make();
  const k = L / edge;
  return faces.map((f) => {
    const pts = f.map((i) => v[i].map((x) => x * k));
    const c = pts.reduce((s, p) => s.map((x, d) => x + p[d] / pts.length), [0, 0, 0]);
    const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    // Wound outward: corners and their ids reversed together (they were
    // out of step, so a face's hinge was taken as the wrong side and that
    // side never drawn; direct report: "the RD net doesn't fully enclose
    // all sides").
    const flip = dot(n, c) < 0;
    return { pts: flip ? [...pts].reverse() : pts, keys: flip ? [...f].reverse() : [...f] };
  });
}
const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const centroid = (pts) => pts.reduce((s, p) => s.map((x, d) => x + p[d] / pts.length), [0, 0, 0]);
const normalOf = (pts) => norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));

// Each face's transform at fold t, for a given tree.
function transforms(faces, tree, M0, t) {
  const T = new Array(faces.length);
  for (const i of tree.order) {
    const node = tree.nodes[i];
    if (node.parent < 0) { T[i] = M0; continue; }
    T[i] = mul(T[node.parent], rotationAbout(node.a, node.d, (1 - t) * node.angle));
  }
  return T;
}
// A tree: breadth first from `root`, neighbours taken in turn from
// `shift`; each child's unfold angle turns it into its parent's plane on
// the far side of the hinge.
function makeTree(faces, root, shift, depthFirst = false, seed = 0) {
  const adj = faces.map(() => []);
  const byEdge = new Map();
  faces.forEach((f, i) => f.keys.forEach((k, j) => {
    const e = edgeKey(k, f.keys[(j + 1) % f.keys.length]);
    if (byEdge.has(e)) { const [o, oj] = byEdge.get(e); adj[i].push({ face: o, j, oj }); adj[o].push({ face: i, j: oj, oj: j }); } else byEdge.set(e, [i, j]);
  }));
  // A fixed pseudo-random neighbour order per seed (0: plain turn order).
  let r = seed * 9301 + 49297;
  const rand = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const nodes = faces.map(() => null);
  nodes[root] = { parent: -1 };
  const order = [root];
  const visit = (p) => {
    const list = adj[p].map((x, s) => adj[p][(s + shift) % adj[p].length]);
    if (seed) list.sort(() => rand() - 0.5);
    const kids = [];
    for (let s = 0; s < list.length; s++) {
      const { face: c, j } = list[s];
      if (nodes[c]) continue;
      const P = faces[p].pts;
      const a = P[j], b = P[(j + 1) % P.length];
      const d = norm(sub(b, a));
      // Turn c about the hinge until its normal matches its parent's.
      const nP = normalOf(P), nC = normalOf(faces[c].pts);
      const angle = Math.atan2(dot(cross(nC, nP), d), dot(nC, nP));
      nodes[c] = { parent: p, a, d, angle, hinge: edgeKey(faces[p].keys[j], faces[p].keys[(j + 1) % P.length]) };
      order.push(c);
      kids.push(c);
      if (depthFirst) visit(c);
    }
    if (!depthFirst) return kids;
    return [];
  };
  // Breadth first: visit faces in the order they joined; depth first:
  // each child's own branch before its siblings.
  if (depthFirst) visit(root);
  else for (let q = 0; q < order.length; q++) visit(order[q]);
  return { nodes, order };
}
// The first face flat on the screen (z = 0), its outside facing away (so
// the solid folds up toward you), its first edge up the screen.
function flatten(face) {
  const P = face.pts;
  const n = normalOf(P);
  const ex = norm(sub(P[1], P[0])); // up the screen
  const ez = n.map((v) => -v); // toward you: the solid's inside
  const ey = cross(ex, ez); // to the right (a proper rotation)
  const c = centroid(P);
  // Column-major: rows are the world axes' directions in solid space.
  const R = [ey[0], ex[0], ez[0], 0, ey[1], ex[1], ez[1], 0, ey[2], ex[2], ez[2], 0, 0, 0, 0, 1];
  const shift = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -c[0], -c[1], -c[2], 1];
  return mul(R, shift);
}
// Do two flat convex polygons overlap (more than touching)? Separating axes.
function overlap(A, B) {
  const shrink = (P) => { const c = centroid(P); return P.map((p) => p.map((v, d) => c[d] + (v - c[d]) * 0.999)); };
  const a = shrink(A), b = shrink(B);
  for (const P of [a, b]) for (let i = 0; i < P.length; i++) {
    const e = sub(P[(i + 1) % P.length], P[i]);
    const axis = [-e[1], e[0]];
    const proj = (Q) => Q.map((q) => q[0] * axis[0] + q[1] * axis[1]);
    const pa = proj(a), pb = proj(b);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
  }
  return true;
}
/** A solid's net: the flattest-found tree whose faces lie flat without
 * overlapping, preferring a compact one. { faces (pts in solid space,
 * edge L), nodes, order, M0, at(t) → per-face 4×4 transforms, flat
 * (each face's corners on the screen at t = 0) }. */
export function netOf(id, L = 5) {
  const faces = solidFaces(id, L);
  let best = null;
  const tries = [];
  for (let root = 0; root < faces.length; root++) for (let shift = 0; shift < 4; shift++) for (const depthFirst of [false, true]) tries.push([root, shift, depthFirst, 0]);
  for (let seed = 1; seed <= 400; seed++) tries.push([seed % faces.length, 0, seed % 2 === 0, seed]);
  for (const [root, shift, depthFirst, seed] of tries) {
    if (best && seed) break; // a plain tree found: no need to search further
    const tree = makeTree(faces, root, shift, depthFirst, seed);
    const M0 = flatten(faces[root]);
    const T = transforms(faces, tree, M0, 0);
    const flat = faces.map((f, i) => f.pts.map((p) => apply(T[i], p)));
    let ok = flat.every((P) => P.every((p) => Math.abs(p[2]) < 1e-6));
    for (let i = 0; ok && i < flat.length; i++) for (let j = i + 1; ok && j < flat.length; j++) if (overlap(flat[i], flat[j])) ok = false;
    if (!ok) continue;
    const xs = flat.flat().map((p) => p[0]), ys = flat.flat().map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (!best || area < best.area - 1e-9) best = { tree, M0, flat, area };
  }
  if (!best) throw new Error(`no flat net found for ${id}`);
  const { tree, M0, flat } = best;
  // Edges: each face owns its sides but the hinge to its parent (the
  // parent's), so a finished net has every edge once, and the edges that
  // meet only when folded twice (once on each face).
  const owned = faces.map((f, i) => {
    const hinge = tree.nodes[i].hinge;
    const out = [];
    f.keys.forEach((k, j) => {
      const k2 = f.keys[(j + 1) % f.keys.length];
      if (edgeKey(k, k2) !== hinge) out.push([f.pts[j], f.pts[(j + 1) % f.pts.length]]);
    });
    return out;
  });
  return {
    id, label: SOLIDS[id].label, L, faces, tree, M0, flat, owned,
    at: (t) => transforms(faces, tree, M0, t),
  };
}
/** The build, following the ghost net: the first face side by side (a tap
 * per side), then a face a tap (direct decision: "first face by sides,
 * then a face a tap"). Each step: { face, edges: [[a, b], ...] }. */
export function netSteps(net) {
  const [root, ...rest] = net.tree.order;
  return [...net.owned[root].map((e) => ({ face: root, edges: [e] })), ...rest.map((f) => ({ face: f, edges: net.owned[f] }))];
}
export { IDENTITY };
