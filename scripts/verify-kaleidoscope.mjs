// Checks src/geometry-extensions/kaleidoscope.js:
// - every shape closes with unit edges and the right angles;
// - the mirrors: folding lands in the domain, and some mirror image
//   carries the folded point back to where it was (ring and triangles);
//   the ring's 2k wedges fill the full turn;
// - clipping and overlap tests;
// - Safe: the index rule against the 5D world's true Penrose tiling.
import {
  KALEIDO_SHAPES, tileOnEdge, area, overlaps, contains, domain, groupMaps, applyMap, fold, clipPolygon,
  indicesFrom, firstIndices, indicesSafe, candidatesAcross, firstTile,
} from '../src/geometry-extensions/kaleidoscope.js';
import { makeQuasicrystal, BASE_OFFSET } from '../src/geometry-extensions/quasicrystal.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

for (const [shape, angles] of Object.entries(KALEIDO_SHAPES)) {
  for (const flip of [false, true]) {
    const v = tileOnEdge(shape, [0.3, -0.2], [1.1, 0.4], flip);
    const n = v.length;
    const edgesOk = v.every((p, i) => near(dist(p, v[(i + 1) % n]), 1));
    const want = flip ? [...angles.slice(1), angles[0]] : angles;
    const anglesOk = v.every((p, i) => {
      const a = v[(i + n - 1) % n], b = v[(i + 1) % n];
      const ang = Math.acos(((a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1])) / (dist(a, p) * dist(b, p)));
      return near((ang * 180) / Math.PI, want[i], 1e-7);
    });
    check(`${shape}${flip ? ' (flipped)' : ''}: closes with unit edges, angles ${want.join('/')}, counter-clockwise`, edgesOk && anglesOk && area(v) > 0);
  }
}
check('pentagon angle = thick rhombus blunt angle (they fit)', KALEIDO_SHAPES.pentagon[0] === KALEIDO_SHAPES.thick[1]);

// Two tiles on opposite sides of one edge don't overlap; a tile overlaps itself.
{
  const a = tileOnEdge('hexagon', [0, 0], [1, 0]);
  const b = tileOnEdge('square', [1, 0], [0, 0]);
  check('tiles sharing an edge do not overlap', !overlaps(a, b));
  check('a tile overlaps a shifted copy of itself', overlaps(a, a.map(([x, y]) => [x + 0.3, y + 0.1])));
  const across = candidatesAcross('thick', { verts: a }, 0);
  check('candidates across an edge sit outside the tile', across.every((c) => !overlaps(c, a)));
}

// Mirrors.
const pts = Array.from({ length: 60 }, (_, i) => [Math.cos(i * 2.39996) * (0.2 + i * 0.13), Math.sin(i * 2.39996) * (0.2 + i * 0.13)]);
for (let k = 1; k <= 12; k++) {
  const maps = groupMaps('ring', k, 0);
  const D = domain('ring', k, 0);
  const ok = pts.every((p) => {
    const q = fold('ring', k, 0, p);
    return contains(D, q) && near(Math.hypot(...q), Math.hypot(...p), 1e-9) && maps.some((m) => dist(applyMap(m, q), p) < 1e-9);
  });
  check(`ring of ${k}: ${maps.length} images; every point folds into the wedge and maps back`, ok && maps.length === 2 * k);
}
for (const mode of ['tri60', 'tri45', 'tri30']) {
  for (const size of [1, 3, 8]) {
    const D = domain(mode, 0, size);
    const maps = groupMaps(mode, 0, size, 40);
    const ok = pts.every((p) => {
      const q = fold(mode, 0, size, p);
      return contains(D, q) && maps.some((m) => dist(applyMap(m, q), p) < 1e-7);
    });
    // Images of the domain have the domain's area and tile a disc
    // without gaps: count ~ disc area / triangle area.
    const expect = (Math.PI * 40 * 40) / Math.abs(area(D));
    check(`${mode} size ${size}: every point folds into the triangle and maps back; ${maps.length} images (~${Math.round(expect)})`, ok && maps.length > 0.8 * expect && maps.length < 1.2 * expect);
  }
}

// Clipping.
{
  const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const q1 = clipPolygon(sq, domain('ring', 2, 0));
  check('a square about the centre cut to the 90° wedge is a quarter', near(area(q1), 1, 1e-9));
  const half = clipPolygon(sq, domain('ring', 1, 0));
  check('cut by one mirror, half is left', near(area(half), 2, 1e-9));
  const none = clipPolygon(sq.map(([x, y]) => [x + 10, y - 20]), domain('tri60', 0, 3));
  check('a tile outside the triangle cuts to nothing', none.length === 0);
}

// Safe: corner indices in the true Penrose tiling take four consecutive
// values, and indicesFrom reproduces them along each rhombus.
{
  const e = makeQuasicrystal('5d');
  const tiles = e.patch(BASE_OFFSET['5d'], 12);
  const sums = new Set();
  let propagated = true;
  for (const { n, I } of tiles) {
    const [i, j] = I;
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => { const m = [...n]; m[i] += a; m[j] += b; return m; });
    const idx = corners.map((m) => m.reduce((s, x) => s + x, 0));
    idx.forEach((x) => sums.add(x));
    const pos = corners.map((m) => [0, 1].map((c) => m.reduce((s, x, l) => s + x * Math.cos((2 * Math.PI * l) / 5 - (c ? Math.PI / 2 : 0)), 0)));
    const got = indicesFrom(pos, idx[0], idx[1]);
    if (got.some((x, k) => x !== idx[k])) propagated = false;
  }
  const vals = [...sums].sort((a, b) => a - b);
  check(`true Penrose tiling (${tiles.length} rhombi): corner indices take 4 consecutive values`, vals.length === 4 && vals[3] - vals[0] === 3, vals.join(','));
  check('indicesFrom reproduces every rhombus’s corner indices from two corners', propagated);
  for (const shape of ['thick', 'thin']) {
    const idx = firstIndices(firstTile(shape));
    check(`first ${shape} rhombus: indices fit 1…4`, indicesSafe(idx) && idx.every((x) => x !== null), idx.join(','));
  }
  // The rule bites: some thin rhombus across a thick one's edge is unsafe.
  const thick = { verts: firstTile('thick'), idx: firstIndices(firstTile('thick')) };
  let safe = 0, unsafe = 0;
  for (let i = 0; i < 4; i++) {
    for (const v of candidatesAcross('thin', thick, i)) {
      const idx = indicesFrom(v, thick.idx[(i + 1) % 4], thick.idx[i]);
      if (indicesSafe(idx)) safe++; else unsafe++;
    }
  }
  check(`thin across a thick rhombus: ${safe} safe, ${unsafe} refused`, safe > 0 && unsafe > 0);
}

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
