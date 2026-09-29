// Construct (1D → primitive), the data model of DICTO's Dimensional
// Construction Interface (docs/DIMENSIONAL_CONSTRUCTION_INTERFACE.md).
// Pure, no THREE (verify:construction). The doc's terms, kept apart:
// - axis direction: X, Y, Z, W, V, U, … (index 0, 1, 2, …; open-ended);
// - axis instance: one line in a direction; parallel axes = instances
//   sharing a direction (the square's bottom and top edges are two X
//   instances);
// - cell: one unit interval on an instance;
// - junction: where another direction becomes available. It never
//   replaces an axis: turning onto Y adds Y to X.
// - primitive: what the filled cells compose.
//
// The square (direct decisions, 2026-09-29: "I wanted a square, not a
// grid"; "staged, as simple as possible"): its four edges, n cells each,
// built one cell at a time round the loop: along X, a junction at the
// corner where Y joins, up Y, back along the top (a second, parallel X
// instance), down the last side, and the square closes.

export const AXES = ['X', 'Y', 'Z', 'W', 'V', 'U'];
export const axisName = (i) => AXES[i] ?? `A${i + 1}`;
// Cells per edge, every family (direct decision, 2026-09-29: "make all
// builds five a side"; it was 10, and Kagome's star, three edges across,
// drew its cells as hairlines on a phone).
export const SQUARE_N = 5;

/** The square's cells in building order: { from, to, axis, instance,
 * index }. Edges go +X, +Y, -X, -Y; instance ids are per edge. */
export function squareLoop(n = SQUARE_N) {
  const edges = [
    { axis: 0, step: [1, 0], start: [0, 0] },
    { axis: 1, step: [0, 1], start: [n, 0] },
    { axis: 0, step: [-1, 0], start: [n, n] },
    { axis: 1, step: [0, -1], start: [0, n] },
  ];
  const cells = [];
  edges.forEach((e, instance) => {
    for (let i = 0; i < n; i++) {
      const from = [e.start[0] + e.step[0] * i, e.start[1] + e.step[1] * i];
      const to = [from[0] + e.step[0], from[1] + e.step[1]];
      cells.push({ from, to, axis: e.axis, instance, index: i });
    }
  });
  return cells;
}

/** Junctions along the loop: where the next cell's axis differs from the
 * one before (the corners). `exposes` is that axis; the axes available
 * after it are every axis met so far, so none is ever replaced. */
export function junctions(cells) {
  const out = [];
  for (let k = 1; k < cells.length; k++) {
    if (cells[k].axis !== cells[k - 1].axis) out.push({ at: k, point: cells[k].from, exposes: cells[k].axis });
  }
  return out;
}

/** The axes available once `filled` cells are in: X from the start, then
 * each new axis as its junction is reached. */
export function exposedAxes(cells, filled) {
  const seen = [];
  for (let k = 0; k < Math.min(filled + 1, cells.length); k++) if (!seen.includes(cells[k].axis)) seen.push(cells[k].axis);
  return seen;
}

/** The cube, built on from the closed square (direct decisions,
 * 2026-09-29: "first 10 cells by hand, then one tap per edge, with axes
 * numbered"): Z rises from the square's start corner, its first edge one
 * cell per tap; then each remaining edge fills in one tap: the other three
 * Z edges, then the top square (parallel X and Y instances). Returns the
 * twelve edges in building order: { axis, instance, label, from, to },
 * points in ℝ³; `label` numbers the instances per direction (X1, X2, …). */
export function cubeEdges(n = SQUARE_N) {
  const base = [[0, 0], [n, 0], [n, n], [0, n]];
  const edges = [];
  const count = {};
  const add = (axis, from, to) => {
    count[axis] = (count[axis] ?? 0) + 1;
    edges.push({ axis, instance: edges.length, label: `${axisName(axis)}${count[axis]}`, from, to });
  };
  base.forEach((p, k) => { const q = base[(k + 1) % 4]; add(k % 2, [...p, 0], [...q, 0]); });
  base.forEach((p) => add(2, [...p, 0], [...p, n]));
  base.forEach((p, k) => { const q = base[(k + 1) % 4]; add(k % 2, [...p, n], [...q, n]); });
  return edges;
}

/** An edge's unit cells, from its start: { from, to, axis, instance, index }
 * (as many as its length, in any direction). */
export function edgeCells(e) {
  const len = Math.round(Math.hypot(...e.from.map((v, i) => e.to[i] - v)));
  return Array.from({ length: len }, (_, i) => ({
    from: e.from.map((v, d) => v + ((e.to[d] - v) / len) * i),
    to: e.from.map((v, d) => v + ((e.to[d] - v) / len) * (i + 1)),
    axis: e.axis, instance: e.instance, index: i,
  }));
}

/** The whole build as taps: the square's 4n cells and the first Z edge's
 * n cells one per tap, then one tap per remaining edge. Each step:
 * { cells, edge } (edge = instance id). */
export function cubeSteps(n = SQUARE_N) {
  const edges = cubeEdges(n);
  const steps = [];
  edges.forEach((e, k) => {
    const cells = edgeCells(e);
    if (k <= 4) cells.forEach((c) => steps.push({ cells: [c], edge: e.instance }));
    else steps.push({ cells, edge: e.instance });
  });
  return steps;
}

/** The tesseract, built on from the closed cube (direct decisions,
 * 2026-09-29: "same as the cube"): W rises from the start corner, its
 * first edge one cell per tap; then one tap per remaining edge: the other
 * seven W edges, then the second cube's twelve. Points in ℝ⁴; the cube's
 * edges keep their names, the second cube's continue them (X5 …). */
export function tesseractEdges(n = SQUARE_N) {
  const cube = cubeEdges(n);
  const edges = cube.map((e) => ({ ...e, from: [...e.from, 0], to: [...e.to, 0] }));
  const count = { 0: 4, 1: 4, 2: 4 };
  const add = (axis, from, to) => {
    count[axis] = (count[axis] ?? 0) + 1;
    edges.push({ axis, instance: edges.length, label: `${axisName(axis)}${count[axis]}`, from, to });
  };
  const corners = [[0, 0, 0], [n, 0, 0], [n, n, 0], [0, n, 0], [0, 0, n], [n, 0, n], [n, n, n], [0, n, n]];
  corners.forEach((p) => add(3, [...p, 0], [...p, n]));
  cube.forEach((e) => add(e.axis, [...e.from, n], [...e.to, n]));
  return edges;
}

/** The whole build as taps, square → cube → tesseract: each new
 * direction's first edge one cell per tap, every other edge one tap.
 * Each step: { cells, edge }. */
export function tesseractSteps(n = SQUARE_N) {
  const edges = tesseractEdges(n);
  const byHand = new Set([0, 1, 2, 3, 4, 12]); // the square's four sides, Z1, W1
  const steps = [];
  edges.forEach((e) => {
    const cells = edgeCells(e);
    if (byHand.has(e.instance)) cells.forEach((c) => steps.push({ cells: [c], edge: e.instance }));
    else steps.push({ cells, edge: e.instance });
  });
  return steps;
}


// ---- construction plans: one per family (Construct's Wizard cards) ----
// A plan is everything Construct draws, in ℝ⁴ (x up the screen, y to the
// right, z toward you, w inward):
// - edges: { axis, instance, line, label, from, to }; `line` groups the
//   edges of one straight line (the square's sides are one edge each);
// - steps: the taps, { cells, edge } (see tesseractSteps);
// - flat: the steps of the first, flat stage, built one line at a time;
// - milestones: where a shape closes, in order: { at (steps), whole (the
//   first `whole` edges show solid), dim, name, prompt, corners, faces,
//   lattice (ghost segments), autoLattice, open ({ dim, piece }), turn }.
const pad4 = (p) => [...p, ...[0, 0, 0, 0]].slice(0, 4);
const allIn = (vals, n) => vals.every((v) => v === 0 || v === n);

function gridLattice(n, dims, w = [0]) {
  const G = [-n, 0, n, 2 * n];
  const segs = [];
  const own = (a, b) => allIn([...a, ...b], n);
  const cubeGrid = (wv, d) => {
    const out = [];
    for (let axis = 0; axis < d; axis++) {
      const others = [0, 1, 2].slice(0, d).filter((k) => k !== axis);
      const combos = others.length === 1 ? G.map((u) => [u]) : G.flatMap((u) => G.map((v) => [u, v]));
      for (const c of combos) for (let k = 0; k < 3; k++) {
        const from = [0, 0, 0, wv], to = [0, 0, 0, wv];
        others.forEach((o, i) => { from[o] = to[o] = c[i]; });
        from[axis] = G[k]; to[axis] = G[k + 1];
        out.push([from, to]);
      }
    }
    return out;
  };
  if (dims <= 3) return cubeGrid(0, dims).filter(([a, b]) => !own(a, b));
  // The tesseract's: the cube's 3×3×3 at both W levels joined along W,
  // and its next neighbour along W (the smaller shell inside; the one
  // outside sits at the eye of W's perspective).
  for (const wv of w) for (const sg of cubeGrid(wv, 3)) if (!own(...sg)) segs.push(sg);
  for (const x of G) for (const y of G) for (const z of G) if (!allIn([x, y, z], n)) segs.push([[x, y, z, 0], [x, y, z, n]]);
  for (const [a, b] of cubeGrid(2 * n, 3)) if (allIn([...a.slice(0, 3), ...b.slice(0, 3)], n)) segs.push([a, b]);
  for (const x of [0, n]) for (const y of [0, n]) for (const z of [0, n]) segs.push([[x, y, z, n], [x, y, z, 2 * n]]);
  return segs;
}

/** Square → cube → tesseract. */
export function squarePlan(n = SQUARE_N) {
  const edges = tesseractEdges(n).map((e) => ({ ...e, line: e.instance }));
  const steps = tesseractSteps(n);
  const cubeDone = steps.findIndex((s) => s.edge === 12);
  const corners = (d) => {
    const out = [];
    for (let m = 0; m < 1 << d; m++) out.push(pad4([0, 1, 2, 3].slice(0, d).map((k) => ((m >> k) & 1) * n)));
    return out;
  };
  const sq = [[0, 0, 0, 0], [n, 0, 0, 0], [n, n, 0, 0], [0, n, 0, 0]];
  const cubeFaces = [0, 1, 2].flatMap((fix) => [0, n].map((v) => {
    const [a, b] = [0, 1, 2].filter((k) => k !== fix);
    return [[0, 0], [n, 0], [n, n], [0, n]].map(([p, q]) => { const pt = [0, 0, 0, 0]; pt[fix] = v; pt[a] = p; pt[b] = q; return pt; });
  }));
  return {
    id: 'square', n, edges, steps, flat: 4 * n, startPrompt: 'con.prompt.start',
    milestones: [
      { at: 4 * n, whole: 4, dim: 2, name: 'Square', prompt: 'con.prompt.square', corners: corners(2), faces: [sq], lattice: gridLattice(n, 2), autoLattice: false, open: { dim: '2D', piece: 'parallelogram' } },
      { at: cubeDone, whole: 12, dim: 3, name: 'Cube', prompt: 'con.prompt.cube', corners: corners(3), faces: cubeFaces, lattice: gridLattice(n, 3), autoLattice: true, open: { dim: '3D', piece: 'cube' } },
      { at: steps.length, whole: 32, dim: 4, name: 'Tesseract', prompt: 'con.prompt.tesseract', corners: corners(4), faces: [], lattice: gridLattice(n, 4, [0, n]), autoLattice: true, open: { dim: '4D', piece: 'tesseract' }, turn: true },
    ],
  };
}

/** Kagome: its star unit, two triangles of side 3n through a hexagon of
 * side n; six straight lines in Kagome's three directions (direct
 * decisions, 2026-09-29: "star unit, then lattice", "make all
 * builds five a side"). The first triangle is traced round, its first side up the
 * screen, then the second; each direction's first edge by hand, every
 * other edge one tap. The lattice: each direction's lines, √3·n apart. */
export function kagomePlan(n = SQUARE_N) {
  const r3 = Math.sqrt(3);
  const a = (r3 / 2) * n; // the triangle's side from its centre
  const A = [[-1.5 * n, -a], [1.5 * n, -a], [0, 2 * a]];
  const B = A.map(([x, y]) => [-x, -y]);
  const names = ['X', 'Y', 'V'];
  const edges = [];
  const count = {};
  [A, B].forEach((T, t) => T.forEach((p, i) => {
    const q = T[(i + 1) % 3];
    const axis = i; // A's and B's sides pair up, parallel
    const line = t * 3 + i;
    for (let k = 0; k < 3; k++) {
      const f = (u) => pad4([p[0] + ((q[0] - p[0]) * u) / 3, p[1] + ((q[1] - p[1]) * u) / 3]);
      count[axis] = (count[axis] ?? 0) + 1;
      edges.push({ axis, instance: edges.length, line, label: `${names[axis]}${count[axis]}`, from: f(k), to: f(k + 1) });
    }
  }));
  const seen = new Set();
  const steps = [];
  edges.forEach((e) => {
    const cells = edgeCells(e);
    if (!seen.has(e.axis)) { seen.add(e.axis); cells.forEach((c) => steps.push({ cells: [c], edge: e.instance })); } else steps.push({ cells, edge: e.instance });
  });
  // Lattice lines: direction d_k = A's k-th side; offsets a + j·√3n from
  // the centre; clipped to a disc, minus the star's own stretch.
  const RC = 4.6 * n;
  const lattice = [];
  for (let k = 0; k < 3; k++) {
    const [p, q] = [A[k], A[(k + 1) % 3]];
    const d = [(q[0] - p[0]) / (3 * n), (q[1] - p[1]) / (3 * n)];
    const nu = [-d[1], d[0]];
    for (let j = -3; j <= 3; j++) {
      const c = (nu[0] * p[0] + nu[1] * p[1]) + j * r3 * n;
      if (Math.abs(c) >= RC) continue;
      const h = Math.sqrt(RC * RC - c * c);
      const foot = [nu[0] * c, nu[1] * c];
      const at = (u) => pad4([foot[0] + d[0] * u, foot[1] + d[1] * u]);
      // The star's own lines (j = 0 through A's side, and B's parallel one)
      // span |u| ≤ 1.5n; the lattice carries them on beyond.
      const own = Math.abs(Math.abs(c) - a) < 1e-6;
      if (own) { lattice.push([at(-h), at(-1.5 * n)]); lattice.push([at(1.5 * n), at(h)]); } else lattice.push([at(-h), at(h)]);
    }
  }
  const tips = [...A, ...B].map(pad4);
  const P = (u) => pad4(u);
  // Faces: the hexagon (the triangles' crossings) and the six points.
  const hex = [];
  for (let i = 0; i < 6; i++) { const ang = Math.PI / 2 + (i * Math.PI) / 3; hex.push(P([n * Math.cos(ang + Math.PI / 6) * 1, n * Math.sin(ang + Math.PI / 6)])); }
  const hexByAngle = hex.map((h) => ({ h, ang: Math.atan2(h[1], h[0]) }));
  const faces = [hex, ...tips.map((tip) => {
    const ang = Math.atan2(tip[1], tip[0]);
    const near = hexByAngle.filter(({ ang: b }) => Math.abs(Math.atan2(Math.sin(b - ang), Math.cos(b - ang))) < Math.PI / 3).map(({ h }) => h);
    return [tip, ...near];
  })];
  return {
    id: 'kagome', n, edges, steps, flat: steps.length, axisNames: names, startPrompt: 'con.prompt.startKagome',
    milestones: [
      { at: steps.length, whole: edges.length, dim: 2, name: 'Kagome', prompt: 'con.prompt.kagome', corners: tips, faces, lattice, autoLattice: true, open: { dim: '2D', piece: 'kagome' } },
    ],
  };
}

export const PLANS = { square: squarePlan, kagome: kagomePlan };
