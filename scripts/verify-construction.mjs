// Checks src/geometry-extensions/construction.js (1D Construct), against
// DICTO's Dimensional Construction Interface:
// - cell, axis instance and axis direction are separate things: every
//   cell belongs to one instance, every instance to one direction, and
//   parallel instances share a direction without being the same line;
// - the grid is exactly the primitive's unit edges (square: 2n(n+1),
//   cube: 3n(n+1)^2, tesseract: 4n(n+1)^3), counted from its geometry;
// - junctions only ever add a direction (X is never replaced);
// - the rules can always be completed, one available cell at a time;
// - cells fill in order along their instance.
import { buildGrid, createConstruction, AXES, PRIMITIVES } from '../src/geometry-extensions/construction.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}

for (const { id, d } of PRIMITIVES) {
  for (const n of [1, 2, 3, 5]) {
    const g = buildGrid(d, n);
    const want = d * n * (n + 1) ** (d - 1);
    // Geometry: unit, axis-aligned, all distinct, all inside [0, n]^d,
    // and every lattice point of the primitive is a cell end.
    const keys = new Set(g.cells.map((c) => `${c.from}|${c.to}`));
    const unit = g.cells.every((c) => c.from.reduce((s, v, i) => s + Math.abs(c.to[i] - v), 0) === 1 && c.to[c.dir] - c.from[c.dir] === 1);
    const inside = g.cells.every((c) => [...c.from, ...c.to].every((v) => v >= 0 && v <= n));
    const pts = new Set(g.cells.flatMap((c) => [String(c.from), String(c.to)]));
    check(`${id} n=${n}: ${g.cells.length} cells = ${d}·n·(n+1)^${d - 1}, unit and axis-aligned, all ${(n + 1) ** d} corners reached`,
      g.cells.length === want && keys.size === want && unit && inside && pts.size === (n + 1) ** d);
    // Model: cell ≠ instance ≠ direction.
    const byInstance = g.cells.every((c) => g.instances[c.instance].cells.includes(c.id) && g.instances[c.instance].dir === c.dir);
    const parallel = [...Array(d).keys()].every((dir) => {
      const lines = g.instances.filter((ins) => ins.dir === dir);
      return lines.length === (n + 1) ** (d - 1) && new Set(lines.map((l) => String(l.base))).size === lines.length;
    });
    if (n === 3) check(`${id}: every cell on one instance, (n+1)^${d - 1} distinct parallel instances per direction`, byInstance && parallel);
  }
  // Complete it greedily, one available cell (or junction) at a time.
  const c = createConstruction(d, 3);
  let steps = 0, exposedSeq = [c.exposed], orderOk = true;
  while (!c.complete() && steps < 10000) {
    const st = c.states();
    const next = st.indexOf('available');
    if (next >= 0) {
      const cell = c.grid.cells[next];
      const ins = c.grid.instances[cell.instance];
      if (cell.index > 0 && !c.filled.has(ins.cells[cell.index - 1])) orderOk = false;
      c.fill(next);
    } else if (c.junction()) { c.expose(); exposedSeq.push(c.exposed); } else break;
    steps++;
  }
  check(`${id}: completes one cell at a time, filling in order (${steps} steps)`, c.complete() && orderOk);
  check(`${id}: junctions add ${exposedSeq.map((k) => AXES.slice(0, k).join('')).join(' → ')}, never replacing an axis`,
    exposedSeq.every((k, i) => i === 0 || k === exposedSeq[i - 1] + 1) && exposedSeq.at(-1) === d);
}

// Availability: at the start only the X line through the origin can be
// filled, and only its first cell; Y waits for that whole line.
{
  const c = createConstruction(2, 3);
  const st = c.states();
  const avail = st.map((s, i) => (s === 'available' ? i : -1)).filter((i) => i >= 0);
  check('start: exactly one cell available, the first on the X line through the origin', avail.length === 1 && c.grid.cells[avail[0]].dir === 0 && c.grid.cells[avail[0]].index === 0 && c.grid.cells[avail[0]].from.every((v) => v === 0));
  check('no junction before the first X line is full', c.junction() === null);
  for (let i = 0; i < 3; i++) c.fill(c.states().indexOf('available'));
  const j = c.junction();
  check('then a junction at the origin exposes Y', !!j && j.exposes === 1 && j.at.every((v) => v === 0));
  c.expose();
  const kinds = c.states().map((s, i) => (s === 'available' ? c.grid.cells[i].dir : -1)).filter((x) => x >= 0);
  check('after it: Y lines from every reached point along X become available, X stays', kinds.filter((k) => k === 1).length === 4 && c.exposed === 2);
  // Unfill: only what nothing depends on.
  const firstX = c.grid.instances.find((ins) => ins.dir === 0 && ins.base.every((v) => v === 0));
  check('a cell with a later one after it cannot be unfilled', !c.canUnfill(firstX.cells[0]));
  check('the last cell of the line can', c.canUnfill(firstX.cells[2]));
  c.unfill(firstX.cells[2]);
  check('unfilling it closes Y again (its junction no longer holds, nothing built with Y)', c.exposed === 1);
}

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
