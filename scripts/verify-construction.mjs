// Checks src/geometry-extensions/construction.js (1D Construct: the
// square), against DICTO's Dimensional Construction Interface:
// - the square is its four edges, n unit cells each, a closed loop;
// - cell, axis instance and axis direction are separate: the bottom and
//   top edges are two different, parallel X instances (likewise Y);
// - junctions sit at the corners and only ever add an axis (X stays).
import { squareLoop, junctions, exposedAxes, cubeEdges, edgeCells, cubeSteps, tesseractEdges, tesseractSteps, kagomePlan, squarePlan, SQUARE_N } from '../src/geometry-extensions/construction.js';

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

// Kagome: the hexagon by hand, one continuous clockwise path in three
// directions (X, Y, XY), then the star's outline round it, one tap per
// edge; the star's six straight lines (each a hexagon side carried on
// both ways), two per direction √3·n apart; each corner where two cross.
{
  const n = SQUARE_N;
  const K = kagomePlan(n);
  const E2 = K.edges.slice(0, 18); // the 2D part: hexagon and star
  const len = (e) => Math.hypot(...e.from.map((v, i) => e.to[i] - v));
  const dir = (e) => e.from.map((v, i) => (e.to[i] - v) / len(e));
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const eq = (p, q) => p.every((v, d) => near(v, q[d]));
  const path = E2.every((e, k) => !k || k === 6 || eq(e.from, E2[k - 1].to)) && eq(E2[5].to, E2[0].from) && eq(E2[17].to, E2[0].from);
  check('Kagome: 18 edges of n cells, flat; the hexagon, then the star outline, each one continuous closed path', E2.every((e) => near(len(e), n) && e.from[2] === 0 && e.to[2] === 0) && path);
  const lines = [0, 1, 2, 3, 4, 5].map((i) => K.edges.filter((e) => e.along === i));
  const straight = lines.every((es) => es.length === 3 && es.every((e) => { const d = dir(e), d0 = dir(es[0]); return near(Math.abs(d[0] * d0[0] + d[1] * d0[1]), 1) && near(d0[0] * (e.from[1] - es[0].from[1]) - d0[1] * (e.from[0] - es[0].from[0]), 0); }));
  check('the star: six straight lines, each a hexagon side carried on past both corners', straight);
  const axes = [...new Set(E2.map((e) => e.axis))].sort();
  check('three directions (X, Y, XY), no new dimension: XY is X and Y together', axes.join() === '0,1,4' && K.axisNames[4] === 'XY' && K.milestones.slice(0, 2).every((m) => m.dim === 2));
  // Offsets across each direction, both lines measured against one heading.
  const across = (i, j) => { const d = dir(lines[i][0]), p = lines[j][0].from; return -d[1] * p[0] + d[0] * p[1]; };
  check('each direction: two parallel lines, √3·n apart', [0, 1, 2].every((i) => near(Math.abs(across(i, i) - across(i, i + 3)), Math.sqrt(3) * n)));
  const crossings = K.crossings.every((h) => E2.filter((e) => eq(e.from, h) || eq(e.to, h)).length === 4);
  check('the hexagon\'s six corners are crossings: two lines, four edge ends', K.crossings.length === 6 && crossings);
  check(`steps: the hexagon by hand (6n = ${6 * n}), the star one tap per edge (12)`, K.steps.slice(0, 6 * n).every((s) => s.cells.length === 1) && K.steps.slice(6 * n, 6 * n + 12).every((s) => s.cells.length === n) && K.milestones[1].at === 6 * n + 12);
  // Pyrochlore: the body, then the limbs. The truncated tetrahedron on
  // the hexagon (12 corners, each on 3 of its 18 edges; four hexagons and
  // four triangles), then a tetrahedron on each triangle; together one big
  // regular tetrahedron of edge 3n, every edge n.
  const kk = (p) => p.slice(0, 3).map((v) => v.toFixed(5)).join();
  const tt = K.milestones[2], py = K.milestones[3];
  const ttEdges = [...K.edges.slice(0, 6), ...K.edges.slice(18, tt.whole)];
  const deg = new Map();
  for (const e of ttEdges) for (const p of [e.from, e.to]) deg.set(kk(p), (deg.get(kk(p)) ?? 0) + 1);
  check('the truncated tetrahedron: the hexagon + 12 edges; 12 corners, three edges at each; 4 hexagons + 4 triangles', ttEdges.length === 18 && deg.size === 12 && [...deg.values()].every((d) => d === 3) && tt.faces.filter((f) => f.length === 6).length === 4 && tt.faces.filter((f) => f.length === 3).length === 4 && tt.dim === 3);
  // The big tetrahedron's corners: its apex (the highest point) and the
  // points 3n from it.
  const pts = K.edges.flatMap((e) => [e.from, e.to]).filter((p, i, a) => a.findIndex((q) => kk(q) === kk(p)) === i);
  const d3 = (a, b) => near(Math.hypot(...a.slice(0, 3).map((v, d) => v - b[d])), 3 * n);
  const top = pts.reduce((a, b) => (b[2] > a[2] ? b : a));
  // (All six star points lie 3n from it; its base is the three with an edge going up.)
  const big = [top, ...pts.filter((p) => d3(p, top) && K.edges.some((e) => kk(e.from) === kk(p) && e.to[2] > 0))];
  const bigRegular = big.length === 4 && big.every((a, x) => big.every((b, y) => x === y || near(Math.hypot(...a.slice(0, 3).map((v, d) => v - b[d])), 3 * n)));
  check('then its limbs: one tap per edge, and all together one big regular tetrahedron (edge 3n), every edge n', bigRegular && K.edges.every((e) => near(len(e), n)) && K.steps.slice(tt.at).every((s) => s.cells.length === n) && py.open.piece === 'pyrochlore');
  const pyro = py.lattice;
  const pdeg = new Map();
  for (const [a, b] of [...pyro, ...K.edges.map((e) => [e.from, e.to])]) for (const p of [a, b]) pdeg.set(kk(p), (pdeg.get(kk(p)) ?? 0) + 1);
  check('its lattice: every edge n; no corner in more than two tetrahedra (at most 6 edges)', pyro.every(([a, b]) => near(Math.hypot(...a.map((v, d) => v - b[d])), n)) && [...pdeg.values()].every((d) => d <= 6), `${pyro.length} ghost edges`);
  check(`steps: hexagon by hand, star by edge, Z1 by hand, then an edge a tap: ${K.steps.length} taps`, K.steps.length === 6 * n + 12 + n + 17 && K.steps.slice(6 * n + 12, 7 * n + 12).every((s) => s.cells.length === 1));
  const sq = squarePlan(n);
  check('the square plan builds exactly as before (square → cube → tesseract)', sq.steps.length === tesseractSteps(n).length && sq.milestones.map((m) => m.at).join() === `${4 * n},${cubeSteps(n).length},${tesseractSteps(n).length}`);
}

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
