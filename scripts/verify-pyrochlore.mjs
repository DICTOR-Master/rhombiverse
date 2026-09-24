// Verifies src/geometry-extensions/pyrochlore-lattice.js against the
// real geometric facts its header claims (pyrochlore = quarter cubic
// honeycomb, registered to the main RD/FCC world).
import {
  PYROCHLORE_S,
  pyrochloreSiteOrientation,
  pyrochloreCellToWorld,
  pyrochloreNeighborOffsets,
  tetrahedronVerts,
  truncatedTetrahedronVerts,
  pyrochloreCapTetsOf,
  pyrochloreCapTets,
  pyrochloreNeighborForTTFace,
  pyrochloreNeighborForTetFace,
  pyrochloreShapeStats,
  pyrochloreTetKind,
  pyrochloreVisibleTets,
  pyrochloreCapForTTFace,
  pyrochloreTetCornerPartner,
} from '../src/geometry-extensions/pyrochlore-lattice.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}
const key = (p) => p.map((n) => (Math.abs(n) < 1e-9 ? 0 : n).toFixed(6)).join(',');
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const e = Math.SQRT2 / 2;

const ttWorld = (i, j, k) => {
  const c = pyrochloreCellToWorld(i, j, k);
  return truncatedTetrahedronVerts(pyrochloreSiteOrientation(i, j, k)).map((v) => add(v, c));
};
const tetWorld = (kind, center) => tetrahedronVerts(kind).map((v) => add(v, center.map((n) => n / 2)));

const O = [2, 0, 0];
const T = [1, 1, -1];
check('O-site (2,0,0) is orientation +1', pyrochloreSiteOrientation(...O) === 1);
check('T-site (1,1,-1) is orientation -1', pyrochloreSiteOrientation(...T) === -1);
check('FCC point (0,0,0) is not a TT site', pyrochloreSiteOrientation(0, 0, 0) === 0);
check('T+ hole (1,1,1) is not a TT site', pyrochloreSiteOrientation(1, 1, 1) === 0);

const tt = truncatedTetrahedronVerts(1);
check('truncated tetrahedron has 12 vertices', tt.length === 12);
const edges = [];
for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) edges.push(dist(tt[a], tt[b]));
check('TT has exactly 18 edges of length e', edges.filter((d) => Math.abs(d - e) < 1e-9).length === 18);
check('T-site TT is the exact inversion of the O-site TT', truncatedTetrahedronVerts(-1).every((v, n) => key(v) === key(tt[n].map((x) => -x))));

// Every neighbor offset lands on a valid site of the OPPOSITE type, sharing a 6-vertex hex face.
for (const [label, cell] of [['O', O], ['T', T]]) {
  const o = pyrochloreSiteOrientation(...cell);
  const mine = new Set(ttWorld(...cell).map(key));
  const offs = pyrochloreNeighborOffsets(o);
  check(`${label}-site: all 4 neighbors are opposite-type sites`, offs.every((d) => pyrochloreSiteOrientation(...add(cell, d)) === -o));
  check(`${label}-site: each neighbor shares exactly 6 vertices (hex face)`, offs.every((d) => ttWorld(...add(cell, d)).filter((v) => mine.has(key(v))).length === 6));
  const caps = pyrochloreCapTetsOf(...cell);
  check(`${label}-site: capped by 4 ${o === 1 ? 'down' : 'up'}-tets`, caps.length === 4 && caps.every((c) => c.kind === (o === 1 ? 'down' : 'up')));
  check(`${label}-site: each cap tet shares exactly 3 vertices (a face)`, caps.every((c) => tetWorld(c.kind, c.center).filter((v) => mine.has(key(v))).length === 3));
  const apex = caps.flatMap((c) => tetWorld(c.kind, c.center).filter((v) => !mine.has(key(v))));
  const apexEdges = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) apexEdges.push(dist(apex[a], apex[b]));
  check(`${label}-site: TT + 4 caps = one big tetrahedron of edge 3e`, apex.length === 4 && apexEdges.every((d) => Math.abs(d - 3 * e) < 1e-9));
}

// Every pyrochlore vertex belongs to exactly 1 up-tet and 1 down-tet.
const vertexTets = new Map();
for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) for (let z = -4; z <= 4; z++) {
  if ((x + y + z) % 2 !== 0) continue;
  for (const v of tetWorld('up', [2 * x, 2 * y, 2 * z])) vertexTets.set(key(v), [...(vertexTets.get(key(v)) ?? []), 'up']);
  for (const v of tetWorld('down', [2 * x + 1, 2 * y + 1, 2 * z + 1])) vertexTets.set(key(v), [...(vertexTets.get(key(v)) ?? []), 'down']);
}
const inner = [...vertexTets.entries()].filter(([k]) => k.split(',').every((n) => Math.abs(Number(n)) < 2));
check('every inner vertex is shared by exactly 1 up-tet and 1 down-tet', inner.length > 0 && inner.every(([, ts]) => ts.length === 2 && ts.includes('up') && ts.includes('down')));

const { truncatedTetrahedron: ttS, tetrahedron: tetS } = pyrochloreShapeStats(1);
check('2 tets + 2 TTs per FCC point = FCC cell volume 2', Math.abs(2 * tetS.volume + 2 * ttS.volume - 2) < 1e-9);

check('lone TT derives 4 cap tets', (() => { const r = pyrochloreCapTets([{ x: 2, y: 0, z: 0 }]); return r.up.length + r.down.length === 4; })());
check('2 hex-adjacent TTs derive 8 tets (share none)', (() => { const r = pyrochloreCapTets([{ x: 2, y: 0, z: 0 }, { x: 3, y: 1, z: 1 }]); return r.up.length + r.down.length === 8; })());

// Tap directions resolve to real hex neighbors / TTs across tet faces.
check('TT tap through each hex face -> that neighbor', pyrochloreNeighborOffsets(1).every((d) => key(pyrochloreNeighborForTTFace(...O, d) ?? [NaN]) === key(add(O, d))));
check('TT tap on a triangle face -> null (covered by a cap tet)', PYROCHLORE_S.every((s) => pyrochloreNeighborForTTFace(...O, s.map((n) => -n)) === null));
check('tet tap -> a real TT site capped by that tet', pyrochloreCapTetsOf(...O).every((c) => PYROCHLORE_S.every((s) => {
  const n = c.kind === 'up' ? s.map((x) => -x) : s;
  const across = pyrochloreNeighborForTetFace(c.kind, c.center, n);
  return pyrochloreSiteOrientation(...across) !== 0 && pyrochloreCapTetsOf(...across).some((cc) => key(cc.center) === key(c.center));
})));

// Individual small tets (Whole tet | Small tet toggle).
check('tet centers are never TT sites and vice versa', [[0, 0, 0], [1, 1, 1], [2, 2, 0], [-1, -1, 1]].every((p) => (pyrochloreTetKind(...p) === null) !== (pyrochloreSiteOrientation(...p) === 0) || (pyrochloreTetKind(...p) === null && pyrochloreSiteOrientation(...p) === 0)));
check('cap-tet centers classify as the right kind', pyrochloreCapTetsOf(...O).every((c) => pyrochloreTetKind(...c.center) === c.kind) && pyrochloreCapTetsOf(...T).every((c) => pyrochloreTetKind(...c.center) === c.kind));
{
  const caps = pyrochloreCapTetsOf(...O);
  const removedOne = pyrochloreVisibleTets([{ x: 2, y: 0, z: 0 }, { x: caps[0].center[0], y: caps[0].center[1], z: caps[0].center[2], tetRemoved: true }]);
  check('a tetRemoved marker hides that derived cap (3 left)', removedOne.up.length + removedOne.down.length === 3);
  const lone = pyrochloreVisibleTets([{ x: 0, y: 0, z: 0, tetAdded: true }]);
  check('a tetAdded cell shows on its own (no TT)', lone.up.length === 1 && lone.down.length === 0);
}
check('triangle-face tap -> the cap that belongs there; hex-face tap -> null', PYROCHLORE_S.every((s) => {
  const cap = pyrochloreCapForTTFace(...O, s.map((n) => -n));
  return cap && pyrochloreCapTetsOf(...O).some((c) => key(c.center) === key(cap.center));
}) && pyrochloreNeighborOffsets(1).every((d) => pyrochloreCapForTTFace(...O, d) === null));
check('corner-partner tet shares exactly 1 vertex with the tapped tet', ['up', 'down'].every((kind) => PYROCHLORE_S.every((s) => {
  const center = kind === 'up' ? [0, 0, 0] : [1, 1, 1];
  const dir = kind === 'up' ? s : s.map((n) => -n);
  const p = pyrochloreTetCornerPartner(kind, center, dir);
  const a = new Set(tetWorld(kind, center).map(key));
  return p.kind !== kind && pyrochloreTetKind(...p.center) === p.kind && tetWorld(p.kind, p.center).filter((v) => a.has(key(v))).length === 1;
})));

console.log(failures === 0 ? '\nAll checks passed (0 failures).' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
