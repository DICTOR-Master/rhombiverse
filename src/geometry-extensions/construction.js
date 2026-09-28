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
