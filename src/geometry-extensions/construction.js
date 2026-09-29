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
// Cells per edge, every family (direct decisions, 2026-09-29: "make all
// builds five a side", "edges same length as before, just longer
// cells"; it was 10).
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
    w: { centre: [n / 2, n / 2, n / 2], eye: n, mid: n / 2 },
    milestones: [
      { at: 4 * n, whole: 4, dim: 2, name: 'Square', prompt: 'con.prompt.square', corners: corners(2), faces: [sq], lattice: gridLattice(n, 2), autoLattice: false, open: { dim: '2D', piece: 'parallelogram' } },
      { at: cubeDone, whole: 12, dim: 3, name: 'Cube', prompt: 'con.prompt.cube', corners: corners(3), faces: cubeFaces, lattice: gridLattice(n, 3), autoLattice: true, open: { dim: '3D', piece: 'cube' } },
      { at: steps.length, whole: 32, dim: 4, name: 'Tesseract', prompt: 'con.prompt.tesseract', corners: corners(4), faces: [], lattice: gridLattice(n, 4, [0, n]), autoLattice: true, open: { dim: '4D', piece: 'tesseract' }, turn: true },
    ],
  };
}

/** Kagome (direct decisions, 2026-09-29: "star unit, then lattice", "build
 * the hexagon first, five taps a side", third direction named "XY";
 * "directions are free, dimensions are earned"): the hexagon, its first
 * side up the screen, traced clockwise by hand, one continuous path; it
 * takes Kagome's three line directions, X, Y and XY (X and Y together,
 * still 2D), and closing it is the 2D moment. Then the star: its outline
 * traced round the hexagon, out to each point and back to the next
 * corner, one tap per edge (no new direction), each corner a crossing of
 * two of Kagome's lines. Then the Kagome lattice: each direction's lines,
 * √3·n apart. Axis ids: 0 X, 1 Y, 4 XY (2 and 3 stay Z and W). */
export function kagomePlan(n = SQUARE_N) {
  const r3 = Math.sqrt(3);
  const dirs = [[1, 0], [0.5, r3 / 2], [-0.5, r3 / 2]]; // X, Y, XY (x up the screen, y right)
  const AX = [0, 1, 4];
  const names = { 0: 'X', 1: 'Y', 4: 'XY', 2: 'Z', 3: 'W' };
  // The hexagon, clockwise from its bottom-left corner.
  const P = [[0, 0]];
  const sideDir = [0, 1, 2, 0, 1, 2].map((k, i) => (i < 3 ? dirs[k] : dirs[k].map((v) => -v)));
  for (let i = 0; i < 5; i++) P.push([P[i][0] + n * sideDir[i][0], P[i][1] + n * sideDir[i][1]]);
  const centre = [P.reduce((s, p) => s + p[0], 0) / 6, P.reduce((s, p) => s + p[1], 0) / 6];
  const axisOf = (d) => {
    const k = dirs.findIndex((u) => Math.abs(Math.abs(u[0] * d[0] + u[1] * d[1]) - 1) < 1e-9);
    return AX[k];
  };
  const edges = [];
  const count = {};
  const add = (from, to, along, line) => {
    const d = [(to[0] - from[0]) / n, (to[1] - from[1]) / n];
    const axis = axisOf(d);
    count[axis] = (count[axis] ?? 0) + 1;
    edges.push({ axis, instance: edges.length, line, along, label: `${names[axis]}${count[axis]}`, from: pad4(from), to: pad4(to) });
  };
  for (let i = 0; i < 6; i++) add(P[i], P[(i + 1) % 6], i, i);
  // The star's outline: a point on each side, reached along the
  // neighbouring sides' lines carried on past the corners.
  const tips = [];
  for (let i = 0; i < 6; i++) {
    const a = P[i], b = P[(i + 1) % 6];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const out = [mid[0] - centre[0], mid[1] - centre[1]];
    const L = Math.hypot(...out);
    const tip = [mid[0] + (out[0] / L) * (r3 / 2) * n, mid[1] + (out[1] / L) * (r3 / 2) * n];
    tips.push(tip);
    add(a, tip, (i + 5) % 6, 6 + 2 * i); // side i-1's line, on past corner i
    add(tip, b, (i + 1) % 6, 7 + 2 * i); // side i+1's line, back in to corner i+1
  }
  // Pyrochlore (direct decisions, 2026-09-29: "go on to pyrochlore",
  // "3D hexagon after star points in 2D"): Kagome in 3D, the same rhythm
  // again. First the 3D hexagon, the truncated tetrahedron (four hexagons,
  // four triangles) standing on the built hexagon, Z's first edge by hand,
  // then one tap per edge; closing it is the 3D moment. Then its points:
  // a tetrahedron capping each triangle, one tap per edge, three on the
  // star's points and one on top; with them it is one big tetrahedron
  // (edge 3n), 3D's own Pyrochlore piece. Every edge reaching out of the
  // plane is a Z edge; the top triangle's run level, in Kagome's
  // directions.
  const h = Math.sqrt(2 / 3) * n; // a regular tetrahedron's height (edge n)
  const T3 = [0, 2, 4].map((i) => tips[i]); // the big tetrahedron's base: the star's alternate points
  const BA = [centre[0], centre[1], 3 * h]; // and its apex
  const at3 = (A, B, f) => [0, 1, 2].map((d) => (A[d] ?? 0) + ((B[d] ?? 0) - (A[d] ?? 0)) * f);
  const S1 = T3.map((T) => at3(T, BA, 1 / 3)); // where Z's edges from the hexagon meet
  const S2 = T3.map((T) => at3(T, BA, 2 / 3)); // the top triangle
  const addZ = (from, to) => {
    const d = [(to[0] - from[0]) / n, (to[1] - from[1]) / n];
    const level = Math.abs((to[2] ?? 0) - (from[2] ?? 0)) < 1e-9;
    const axis = level ? axisOf(d) : 2;
    count[axis] = (count[axis] ?? 0) + 1;
    edges.push({ axis, instance: edges.length, line: 20 + edges.length, along: -1, label: `${names[axis]}${count[axis]}`, from: pad4(from), to: pad4(to) });
  };
  // The truncated tetrahedron: over each alternate point's corner, up to
  // S1 from the hexagon's two corners there and on up the big edge to S2;
  // then the top triangle.
  [0, 2, 4].forEach((i, k) => { addZ(P[i], S1[k]); addZ(P[(i + 1) % 6], S1[k]); addZ(S1[k], S2[k]); });
  [0, 1, 2].forEach((k) => addZ(S2[k], S2[(k + 1) % 3]));
  const ttDone = edges.length;
  // Its points: the three caps' outer edges (up from the star's points)
  // and the top cap's three edges to the apex.
  [0, 2, 4].forEach((i, k) => addZ(tips[i], S1[k]));
  [0, 1, 2].forEach((k) => addZ(S2[k], BA));
  const pyroDone = edges.length;
  // Hyper-pyrochlore (direct request: "no 4D Kagome?"; "same pattern in
  // W"): the rhythm once more, a dimension up. A big 5-cell (edge 3n)
  // over the big tetrahedron is the truncated 5-cell (the body, five
  // truncated tetrahedra and five tetrahedra, yours one of them) plus a
  // small 5-cell on each of its tetrahedra (the limbs). W's first edge by
  // hand, then one tap per edge.
  const h4 = 3 * n * Math.sqrt(5 / 8); // a regular 5-cell's height over its base (edge 3n)
  const big3 = [...T3.map((t) => [t[0], t[1], 0]), BA];
  const cen3 = [0, 1, 2].map((d) => big3.reduce((sum, v) => sum + v[d], 0) / 4);
  const V4 = [...cen3, h4];
  const at4 = (A, B, f) => [0, 1, 2, 3].map((d) => (A[d] ?? 0) + ((B[d] ?? 0) - (A[d] ?? 0)) * f);
  const Q1 = big3.map((c) => at4(c, V4, 1 / 3));
  const Q2 = big3.map((c) => at4(c, V4, 2 / 3));
  const addW = (from, to) => {
    const dw = (to[3] ?? 0) - (from[3] ?? 0), dz = (to[2] ?? 0) - (from[2] ?? 0);
    const axis = Math.abs(dw) > 1e-9 ? 3 : Math.abs(dz) > 1e-9 ? 2 : axisOf([(to[0] - from[0]) / n, (to[1] - from[1]) / n]);
    count[axis] = (count[axis] ?? 0) + 1;
    edges.push({ axis, instance: edges.length, line: 20 + edges.length, along: -1, label: `${names[axis]}${count[axis]}`, from: pad4(from), to: pad4(to) });
  };
  // Each big corner's cut: its three neighbours at a third, in 3D.
  const cut3 = big3.map((V) => big3.filter((W) => W !== V).map((W) => at3(V, W, 1 / 3)));
  // The body: from each corner's cut up into W, then on along the big edge.
  big3.forEach((V, k) => { cut3[k].forEach((c) => addW(c, Q1[k])); addW(Q1[k], Q2[k]); });
  // Its top: the tetrahedron where W's edges meet at two thirds.
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) addW(Q2[i], Q2[j]);
  const bodyDone = edges.length;
  // The limbs: each corner's small 5-cell closes along its big edge.
  big3.forEach((V, k) => addW(V, Q1[k]));
  Q2.forEach((q) => addW(q, V4));
  edges.forEach((e, k) => { if ((k >= 6 && k < 18) || (k >= ttDone && k < pyroDone) || k >= bodyDone) e.part = 'limb'; });
  const steps = [];
  edges.forEach((e, k) => {
    const cells = edgeCells(e);
    if (k < 6 || k === 18 || k === pyroDone) cells.forEach((c) => steps.push({ cells: [c], edge: e.instance })); // the hexagon, Z's first edge, W's first edge
    else steps.push({ cells, edge: e.instance });
  });
  // Lattices. The hexagon's: the honeycomb, two rings round it. Kagome's:
  // each direction's lines through the hexagon's sides, √3·n apart,
  // clipped to a disc, carrying the star's own lines on past its points.
  const key = (a, b) => [a, b].map((p) => p.map((v) => v.toFixed(6)).join(',')).sort().join('|');
  const hexAt = (c) => P.map((p) => [p[0] - centre[0] + c[0], p[1] - centre[1] + c[1]]);
  const honey = new Map();
  const seen = new Set([centre.map((v) => v.toFixed(6)).join()]);
  let ring = [centre];
  const cells = [centre];
  for (let r = 0; r < 2; r++) {
    const next = [];
    for (const c of ring) for (let i = 0; i < 6; i++) {
      const h = hexAt(c);
      const mid = [(h[i][0] + h[(i + 1) % 6][0]) / 2, (h[i][1] + h[(i + 1) % 6][1]) / 2];
      const nc = [2 * mid[0] - c[0], 2 * mid[1] - c[1]];
      const k2 = nc.map((v) => v.toFixed(6)).join();
      if (!seen.has(k2)) { seen.add(k2); next.push(nc); cells.push(nc); }
    }
    ring = next;
  }
  const own = new Set(P.map((p, i) => key(p, P[(i + 1) % 6])));
  for (const c of cells) {
    const h = hexAt(c);
    h.forEach((p, i) => { const q = h[(i + 1) % 6]; const k2 = key(p, q); if (!own.has(k2)) honey.set(k2, [pad4(p), pad4(q)]); });
  }
  const RC = 4.6 * n;
  const kagome = [];
  dirs.forEach((d) => {
    const nu = [-d[1], d[0]];
    const oc = nu[0] * centre[0] + nu[1] * centre[1];
    for (let j = -4; j <= 3; j++) {
      const off = (r3 / 2) * n * (2 * j + 1);
      if (Math.abs(off) >= RC) continue;
      const h = Math.sqrt(RC * RC - off * off);
      const foot = [centre[0] + nu[0] * off, centre[1] + nu[1] * off];
      const at = (u) => pad4([foot[0] + d[0] * u, foot[1] + d[1] * u]);
      if (j === 0 || j === -1) { kagome.push([at(-h), at(-1.5 * n)]); kagome.push([at(1.5 * n), at(h)]); } else kagome.push([at(-h), at(h)]);
    }
  });
  // Pyrochlore's: three Kagome layers with their tetrahedra, this one and
  // the layers 2h above and below. Along [111], pyrochlore alternates
  // Kagome and triangular layers, h apart; each neighbouring Kagome layer
  // is this one reflected through a triangle's centre, so its tetrahedra
  // share the corners of this layer's (above: the up ones; below: the
  // down ones). Kept to the tetrahedra whose triangles lie near.
  const tri = (i) => [P[i], tips[i], P[(i + 1) % 6]];
  const a1 = dirs[0].map((v) => 2 * n * v), a2 = dirs[1].map((v) => 2 * n * v); // Kagome's own translations
  const upT = tri(0), downT = tri(1);
  const cen = (t) => [0, 1].map((d) => (t[0][d] + t[1][d] + t[2][d]) / 3);
  const RL = 2.7 * n;
  const layerTris = [];
  for (let u = -4; u <= 4; u++) for (let v = -4; v <= 4; v++) {
    const T = [u * a1[0] + v * a2[0], u * a1[1] + v * a2[1]];
    for (const [t, up] of [[upT, true], [downT, false]]) {
      const moved = t.map((p) => [p[0] + T[0], p[1] + T[1]]);
      const c = cen(moved);
      if (Math.hypot(c[0] - centre[0], c[1] - centre[1]) <= RL) layerTris.push({ t: moved, up });
    }
  }
  const pyro = new Map();
  const ownPyro = new Set(edges.map((e) => key(e.from.slice(0, 3), e.to.slice(0, 3))));
  const addTet = (t, apex) => {
    const vs = [...t.map((p) => [p[0], p[1], p[2] ?? 0]), apex];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const k2 = key(vs[i], vs[j]);
      if (!ownPyro.has(k2)) pyro.set(k2, [pad4(vs[i]), pad4(vs[j])]);
    }
  };
  const cUp = cen(upT), cDown = cen(downT);
  for (const [z, mirror, flip] of [[0, null, false], [2 * h, cUp, true], [-2 * h, cDown, true]]) {
    for (const { t, up } of layerTris) {
      const tt = mirror ? t.map((p) => [2 * mirror[0] - p[0], 2 * mirror[1] - p[1], z]) : t.map((p) => [p[0], p[1], 0]);
      const c = cen(tt);
      // Reflected, an up triangle's image is a down one there.
      const pointsUp = flip ? !up : up;
      addTet(tt, [c[0], c[1], z + (pointsUp ? h : -h)]);
    }
  }
  const hexFace = P.map(pad4);
  // Two colours (direct decision, 2026-09-29: "double colours for Kagome",
  // limbs gold): the body (hexagon, truncated tetrahedron) and the limbs
  // (the star's points, the mini tetrahedra), edges and faces alike.
  const limb = (f) => Object.assign(f, { part: 'limb' });
  const tipFaces = tips.map((tp, i) => limb([pad4(tp), pad4(P[(i + 1) % 6]), pad4(P[i])]));
  const bigCorners = [...T3.map((t) => [t[0], t[1], 0]), BA];
  const hexOfFace = (A, B, C) => [at3(A, B, 1 / 3), at3(A, B, 2 / 3), at3(B, C, 1 / 3), at3(B, C, 2 / 3), at3(C, A, 1 / 3), at3(C, A, 2 / 3)].map(pad4);
  const [c0, c1, c2, c3] = bigCorners;
  const ttFaces = [
    hexOfFace(c0, c1, c2), hexOfFace(c0, c1, c3), hexOfFace(c1, c2, c3), hexOfFace(c2, c0, c3),
    ...bigCorners.map((V) => bigCorners.filter((W) => W !== V).map((W) => pad4(at3(V, W, 1 / 3)))),
  ];
  const capFaces = [
    ...[0, 2, 4].flatMap((i, k) => [[tips[i], P[i], P[(i + 1) % 6]], [tips[i], P[i], S1[k]], [tips[i], P[(i + 1) % 6], S1[k]]]),
    ...[0, 1, 2].map((k) => [S2[k], S2[(k + 1) % 3], BA]),
  ].map((f) => limb(f.map(pad4)));
  const ttCorners = [...P.map((p) => [p[0], p[1], 0]), ...S1, ...S2].map(pad4);
  return {
    id: 'kagome', n, edges, steps, flat: 6 * n, axisNames: names,
    startPrompt: 'con.prompt.startKagome', junctionPrompt: { 4: 'con.prompt.junctionXY' },
    crossings: P.map(pad4),
    // W's perspective: toward the big tetrahedron's centre, where the big
    // 5-cell's apex stands, seen from 3n off in W; it turns about half
    // the apex's height.
    w: { centre: cen3, eye: 3 * n, mid: h4 / 2 },
    // Depth seen with the Kagome plane as a floor: from low in front, Z up
    // the screen (world axes: the plane is the screen's x–y, Z toward you).
    view3: { dir: [-0.35, -0.85, 0.45], up: [0, 0, 1] },
    milestones: [
      { at: 6 * n, whole: 6, dim: 2, name: 'Hexagon', prompt: 'con.prompt.hexagon', corners: P.map(pad4), faces: [hexFace], lattice: [...honey.values()], autoLattice: false, open: { dim: '2D', piece: 'hexagon' } },
      { at: 6 * n + 12, whole: 18, dim: 2, name: 'Kagome', prompt: 'con.prompt.kagome', corners: tips.map(pad4), faces: [hexFace, ...tipFaces], lattice: kagome, autoLattice: true, open: { dim: '2D', piece: 'kagome' } },
      { at: steps.findIndex((st) => st.edge === ttDone), whole: ttDone, dim: 3, name: 'Truncated tetrahedron', prompt: 'con.prompt.tt', corners: ttCorners, faces: ttFaces, lattice: [], autoLattice: false, open: null },
      { at: steps.findIndex((st) => st.edge === pyroDone), whole: pyroDone, dim: 3, name: 'Pyrochlore', prompt: 'con.prompt.pyrochlore', corners: [...ttCorners, ...bigCorners.map(pad4), ...tips.map(pad4)], faces: [...ttFaces, ...capFaces], lattice: [...pyro.values()], autoLattice: true, open: { dim: '3D', piece: 'pyrochlore' } },
      { at: steps.findIndex((st) => st.edge === bodyDone), whole: bodyDone, dim: 4, name: 'Truncated 5-cell', prompt: 'con.prompt.t5', corners: [...cut3.flat(), ...Q1, ...Q2].map(pad4), faces: [], lattice: [], autoLattice: false, open: null },
      { at: steps.length, whole: edges.length, dim: 4, name: 'Hyper-pyrochlore', prompt: 'con.prompt.hyper', corners: [...cut3.flat(), ...Q1, ...Q2, ...big3, V4].map(pad4), faces: [], lattice: [], autoLattice: false, open: { dim: '4D', piece: 'a4trunc' }, turn: true },
    ],
  };
}

/** The rhombic dodecahedron, from its own rhombus (direct decisions,
 * 2026-09-29: "RD reg rhombus", "like the square", "body then limbs"):
 * the RD's face rhombus (70.53° / 109.47°) by hand, starting at its acute
 * corner, first side up the screen, clockwise: the 2D moment. Then the
 * RD's own grammar, cube plus six pyramids: the cube inside (the body;
 * its edges are the rhombi's short diagonals, 2n/√3 long), Z's first edge
 * by hand, then one tap per edge; then the six pyramids on its faces (the
 * limbs), whose edges are the RD's. The RD closes into its lattice, the
 * twelve RDs round it (FCC). */
export function rdPlan(n = SQUARE_N) {
  const s = (2 * n) / Math.sqrt(3); // the cube's side (RD edge n)
  const hs = s / 2;
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((t, v, i) => t + v * b[i], 0);
  const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // RD coordinates: the cube's corners (±hs)³, the apexes ±s on each axis.
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push([x * hs, y * hs, z * hs]);
  const apexes = [0, 1, 2].flatMap((k) => [1, -1].map((sg) => { const a = [0, 0, 0]; a[k] = sg * s; return a; }));
  // The first rhombus: A1 (acute) → C1 → A2 (acute) → C2.
  const A1 = [s, 0, 0], C1 = [hs, hs, hs], A2 = [0, s, 0], C2 = [hs, hs, -hs];
  const ex = norm(sub(C1, A1));
  const v = sub(C2, A1);
  const ey = norm(sub(v, ex.map((t) => t * dot(v, ex))));
  let ez = cross(ex, ey);
  if (dot(sub([0, 0, 0], A1), ez) < 0) ez = ez.map((t) => -t); // the RD on the near side
  const plan = (p) => { const d = sub(p, A1); return pad4([dot(d, ex), dot(d, ey), dot(d, ez)]); };
  const key3 = (p) => p.map((t) => t.toFixed(6)).join();
  const edges = [];
  const count = {};
  const names = { 0: 'X', 1: 'Y', 4: 'XY', 2: 'Z', 3: 'W' };
  const uDir = norm(sub(C1, A1)), vDir = norm(sub(C2, A1));
  const add = (a, b, part) => {
    const from = plan(a), to = plan(b);
    const d = norm(sub(b, a));
    const inPlane = Math.abs(to[2]) < 1e-9 && Math.abs(from[2]) < 1e-9;
    const axis = !inPlane ? 2 : Math.abs(Math.abs(dot(d, uDir)) - 1) < 1e-9 ? 0 : Math.abs(Math.abs(dot(d, vDir)) - 1) < 1e-9 ? 1 : 4;
    count[axis] = (count[axis] ?? 0) + 1;
    edges.push({ axis, instance: edges.length, line: edges.length, along: -1, label: `${names[axis]}${count[axis]}`, from, to, ...(part ? { part } : {}) });
  };
  const has = (a, b) => edges.some((e) => (key3(e.from.slice(0, 3)) === key3(plan(a).slice(0, 3)) && key3(e.to.slice(0, 3)) === key3(plan(b).slice(0, 3))) || (key3(e.from.slice(0, 3)) === key3(plan(b).slice(0, 3)) && key3(e.to.slice(0, 3)) === key3(plan(a).slice(0, 3))));
  // The rhombus (its edges are pyramids' edges: limbs).
  [[A1, C1], [C1, A2], [A2, C2], [C2, A1]].forEach(([a, b]) => add(a, b, 'limb'));
  const rhombusDone = edges.length;
  // The body: the cube, from C1 out of the plane first, then outward
  // edge by edge, each touching what's built.
  const cubeEdges3 = [];
  corners.forEach((a, i) => corners.forEach((b, j) => { if (i < j && sub(a, b).filter((t) => Math.abs(t) > 1e-9).length === 1) cubeEdges3.push([a, b]); }));
  const first = cubeEdges3.find(([a, b]) => (key3(a) === key3(C1) || key3(b) === key3(C1)) && Math.abs(plan(key3(a) === key3(C1) ? b : a)[2]) > 1e-9);
  const orient = ([a, b], from) => (key3(a) === key3(from) ? [a, b] : [b, a]);
  const built = new Set([key3(C1), key3(C2)]);
  const queue = [orient(first, C1)];
  const rest = cubeEdges3.filter((e) => e !== first);
  while (queue.length) {
    const [a, b] = queue.shift();
    add(a, b);
    built.add(key3(a)); built.add(key3(b));
    const next = rest.findIndex(([p, q]) => built.has(key3(p)) || built.has(key3(q)));
    if (next >= 0) { const [p, q] = rest.splice(next, 1)[0]; queue.push(built.has(key3(p)) ? [p, q] : [q, p]); }
  }
  const cubeDone = edges.length;
  // The limbs: each pyramid's edges from its apex to its face's corners,
  // the first rhombus's two apexes first.
  const order = [A1, A2, ...apexes.filter((a) => key3(a) !== key3(A1) && key3(a) !== key3(A2))];
  for (const A of order) {
    corners.filter((c) => Math.abs(Math.hypot(...sub(c, A)) - n) < 1e-9).forEach((c) => { if (!has(A, c)) add(c, A, 'limb'); });
  }
  const steps = [];
  edges.forEach((e, k) => {
    const cells = edgeCells(e);
    if (k < rhombusDone || k === rhombusDone) cells.forEach((c) => steps.push({ cells: [c], edge: e.instance }));
    else steps.push({ cells, edge: e.instance });
  });
  const at = (count2) => steps.findIndex((st) => st.edge === count2);
  // Faces and lattices.
  const rhombus = [A1, C1, A2, C2].map(plan);
  const cubeFaces = [0, 1, 2].flatMap((k) => [-1, 1].map((sg) => {
    const f = corners.filter((c) => Math.abs(c[k] - sg * hs) < 1e-9);
    const [i, j] = [0, 1, 2].filter((d) => d !== k);
    const cen = [0, 0, 0]; cen[k] = sg * hs;
    return f.sort((a, b) => Math.atan2(a[j], a[i]) - Math.atan2(b[j], b[i])).map(plan);
  }));
  const rdFaces = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const Ai = apexes[i], Aj = apexes[j];
    if (Math.abs(dot(Ai, Aj)) > 1e-9) continue; // perpendicular apexes share a face
    const cs = corners.filter((c) => Math.abs(Math.hypot(...sub(c, Ai)) - n) < 1e-9 && Math.abs(Math.hypot(...sub(c, Aj)) - n) < 1e-9);
    rdFaces.push(Object.assign([Ai, cs[0], Aj, cs[1]].map(plan), { part: 'limb' }));
  }
  // The rhombus's lattice: its 3×3 in the plane.
  const u2 = sub(C1, A1), v2 = sub(C2, A1);
  const rhombLattice = [];
  for (const [base, step] of [[u2, v2], [v2, u2]]) for (let a = -1; a <= 2; a++) for (let b = -1; b <= 1; b++) {
    const p0 = A1.map((t, i) => t + base[i] * b + step[i] * a);
    const p1 = p0.map((t, i) => t + base[i]);
    if (a >= 0 && a <= 1 && b === 0) continue; // the rhombus's own sides
    rhombLattice.push([plan(p0), plan(p1)]);
  }
  // The RD's lattice: the twelve RDs round it (FCC neighbours ±s±s0).
  const rdEdges = (o) => {
    const out = [];
    for (const A of apexes) for (const c of corners) if (Math.abs(Math.hypot(...sub(c, A)) - n) < 1e-9) out.push([A.map((t, i) => t + o[i]), c.map((t, i) => t + o[i])]);
    return out;
  };
  const ownRD = new Set(rdEdges([0, 0, 0]).map(([a, b]) => [key3(a), key3(b)].sort().join('|')));
  const rdLattice = new Map();
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (const si of [-1, 1]) for (const sj of [-1, 1]) {
    const o = [0, 0, 0]; o[i] = si * s; o[j] = sj * s;
    for (const [a, b] of rdEdges(o)) { const k2 = [key3(a), key3(b)].sort().join('|'); if (!ownRD.has(k2)) rdLattice.set(k2, [plan(a), plan(b)]); }
  }
  const centre3 = plan([0, 0, 0]);
  return {
    id: 'rd', n, edges, steps, flat: 4 * n, axisNames: names,
    startPrompt: 'con.prompt.startRd',
    w: { centre: centre3.slice(0, 3), eye: 2 * s, mid: 0 },
    milestones: [
      { at: 4 * n, whole: rhombusDone, dim: 2, name: 'Rhombus', prompt: 'con.prompt.rhombus', corners: rhombus, faces: [Object.assign([...rhombus], { part: 'limb' })], lattice: rhombLattice, autoLattice: false, open: { dim: '2D', piece: 'parallelogram', angle: 'rd-rhombus' } },
      { at: at(cubeDone), whole: cubeDone, dim: 3, name: 'Cube', prompt: 'con.prompt.rdBody', corners: corners.map(plan), faces: cubeFaces, lattice: [], autoLattice: false, open: null },
      { at: steps.length, whole: edges.length, dim: 3, name: 'Rhombic dodecahedron', prompt: 'con.prompt.rd', corners: [...corners, ...apexes].map(plan), faces: rdFaces, lattice: [...rdLattice.values()], autoLattice: true, open: { dim: '3D', piece: 'rd' } },
    ],
  };
}

export const PLANS = { square: squarePlan, kagome: kagomePlan, rd: rdPlan };
