// Checks src/geometry-extensions/construction.js (1D Construct: the
// square), against DICTO's Dimensional Construction Interface:
// - the square is its four edges, n unit cells each, a closed loop;
// - cell, axis instance and axis direction are separate: the bottom and
//   top edges are two different, parallel X instances (likewise Y);
// - junctions sit at the corners and only ever add an axis (X stays).
import { squareLoop, junctions, exposedAxes, SQUARE_N } from '../src/geometry-extensions/construction.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

for (const n of [1, 2, SQUARE_N, 7]) {
  const c = squareLoop(n);
  const unit = c.every((x) => Math.abs(x.to[0] - x.from[0]) + Math.abs(x.to[1] - x.from[1]) === 1);
  const chained = c.every((x, k) => same(x.from, c[(k + c.length - 1) % c.length].to));
  const onEdge = c.every((x) => [...x.from, ...x.to].every((v) => v >= 0 && v <= n) && (x.from[0] % n === 0 || x.from[1] % n === 0));
  const pts = new Set(c.map((x) => String(x.from)));
  check(`n=${n}: ${c.length} = 4n unit cells, one closed loop round the square's edge (${pts.size} distinct corners of cells), no interior`,
    c.length === 4 * n && unit && chained && onEdge && pts.size === 4 * n);
}

const c = squareLoop();
const xs = [...new Set(c.filter((x) => x.axis === 0).map((x) => x.instance))];
const ys = [...new Set(c.filter((x) => x.axis === 1).map((x) => x.instance))];
check('two parallel X instances (bottom, top) and two Y (right, left): same direction, different lines', xs.length === 2 && ys.length === 2 && c.filter((x) => x.instance === xs[0])[0].from[1] !== c.filter((x) => x.instance === xs[1])[0].from[1]);
const j = junctions(c);
check('a junction at each of the three corners reached along the way', j.length === 3 && j.every((x) => [[SQUARE_N, 0], [SQUARE_N, SQUARE_N], [0, SQUARE_N]].some((p) => same(p, x.point))));
let ok = true;
let prev = [];
for (let k = 0; k <= c.length; k++) {
  const e = exposedAxes(c, k);
  if (!prev.every((a) => e.includes(a))) ok = false;
  prev = e;
}
check('axes only ever join: X from the start, Y at the first corner, and X is never replaced', ok && exposedAxes(c, 0).join() === '0' && exposedAxes(c, SQUARE_N).join() === '0,1');

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
