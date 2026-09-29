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
export const SQUARE_N = 10;

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

/** An edge's n unit cells, from its start: { from, to, axis, instance, index }. */
export function edgeCells(e) {
  const len = e.from.reduce((s, v, i) => s + Math.abs(e.to[i] - v), 0);
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
