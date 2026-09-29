// Checks src/geometry-extensions/construction.js (1D Construct: the
// square), against DICTO's Dimensional Construction Interface:
// - the square is its four edges, n unit cells each, a closed loop;
// - cell, axis instance and axis direction are separate: the bottom and
//   top edges are two different, parallel X instances (likewise Y);
// - junctions sit at the corners and only ever add an axis (X stays).
import { squareLoop, junctions, exposedAxes, cubeEdges, edgeCells, cubeSteps, tesseractEdges, tesseractSteps, SQUARE_N } from '../src/geometry-extensions/construction.js';

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

// The cube: its 12 real edges, each n unit cells, built as the square's
// 4n cells and the first Z edge's n cells by hand, then 7 one-tap edges.
{
  const n = SQUARE_N;
  const E = cubeEdges(n);
  const key = (a, b) => [String(a), String(b)].sort().join('|');
  const real = new Set();
  for (const x of [0, n]) for (const y of [0, n]) for (const z of [0, n]) {
    if (x === 0) real.add(key([0, y, z], [n, y, z]));
    if (y === 0) real.add(key([x, 0, z], [x, n, z]));
    if (z === 0) real.add(key([x, y, 0], [x, y, n]));
  }
  check('the cube: 12 distinct edges, exactly the real cube\'s', E.length === 12 && new Set(E.map((e) => key(e.from, e.to))).size === 12 && E.every((e) => real.has(key(e.from, e.to))));
  const labels = E.map((e) => e.label).join();
  check('edges numbered per direction (X1–X4, Y1–Y4, Z1–Z4)', labels === 'X1,Y1,X2,Y2,Z1,Z2,Z3,Z4,X3,Y3,X4,Y4');
  const steps = cubeSteps(n);
  const cells = steps.flatMap((s) => s.cells);
  const firstSquare = squareLoop(n).every((c, k) => same(c.from, cells[k].from) && same(c.to, cells[k].to) && cells[k].from[2] === 0);
  check(`steps: the square first (4n), Z1 by hand (n), then 7 whole edges: ${steps.length} taps, ${cells.length} = 12n cells`,
    firstSquare && steps.length === 5 * n + 7 && cells.length === 12 * n && steps.slice(5 * n).every((s) => s.cells.length === n) && steps[4 * n].cells[0].axis === 2 && same(steps[4 * n].cells[0].from, [0, 0]));
  check('every edge cell is a unit step along its own axis', E.every((e) => edgeCells(e).every((c) => c.from.reduce((s, v, d) => s + Math.abs(c.to[d] - v), 0) === 1 && c.to[e.axis] !== c.from[e.axis])));
}

// The tesseract: its 32 real edges (every pair of its 16 corners differing
// in one coordinate), the cube's build first, W1 by hand, then 19 taps.
{
  const n = SQUARE_N;
  const E = tesseractEdges(n);
  const key = (a, b) => [String(a), String(b)].sort().join('|');
  const corners = [];
  for (let m = 0; m < 16; m++) corners.push([0, 1, 2, 3].map((d) => ((m >> d) & 1) * n));
  const real = new Set();
  corners.forEach((a) => corners.forEach((b) => { if (a.filter((v, d) => v !== b[d]).length === 1) real.add(key(a, b)); }));
  check('the tesseract: 32 distinct edges, exactly the real tesseract\'s', real.size === 32 && E.length === 32 && new Set(E.map((e) => key(e.from, e.to))).size === 32 && E.every((e) => real.has(key(e.from, e.to))));
  const per = [0, 1, 2, 3].map((a) => E.filter((e) => e.axis === a).map((e) => e.label).join());
  check('eight edges per direction, numbered 1–8 (X, Y, Z, W)', per.every((l, a) => l === Array.from({ length: 8 }, (_, i) => `${'XYZW'[a]}${i + 1}`).sort((p, q) => parseInt(p.slice(1)) - parseInt(q.slice(1))).join()), per.join(' | '));
  const T = tesseractSteps(n), Cs = cubeSteps(n);
  const prefix = Cs.every((s, k) => s.cells.length === T[k].cells.length && s.cells.every((c, i) => String(c.from) === String(T[k].cells[i].from.slice(0, 3)) && T[k].cells[i].from[3] === 0));
  const wHand = T.slice(Cs.length, Cs.length + n).every((s) => s.cells.length === 1 && s.cells[0].axis === 3);
  check(`steps: the cube's build (${Cs.length}), W1 by hand (n), then 19 whole edges: ${T.length} taps, ${T.flatMap((s) => s.cells).length} = 32n cells`,
    prefix && wHand && T.length === Cs.length + n + 19 && T.flatMap((s) => s.cells).length === 32 * n && same(T[Cs.length].cells[0].from, [0, 0]) && T[Cs.length].cells[0].from.every((v) => v === 0));
}

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
