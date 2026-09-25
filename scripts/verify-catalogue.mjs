// Verifies data/catalogue-5d6d.json against the cut-and-project engine:
// serials unique and inside their kind's range, names unique, and every
// entry genuinely occurs in its tiling (at several phasons, near several
// points), landing as the right number of pieces with no overlap.
import { readFileSync } from 'node:fs';
import { makeQuasicrystal, BASE_OFFSET, TIERS } from '../src/geometry-extensions/quasicrystal.js';
import { SERIAL_RANGES, findOccurrence, pieceCount, congruentSets, localPatch, canonicalPatch, polytopeShape } from '../src/geometry-extensions/quasicrystal-catalogue.js';
import { tilesOverlap } from '../src/geometry-extensions/growth.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}

const entries = JSON.parse(readFileSync(new URL('../data/catalogue-5d6d.json', import.meta.url)));
check(`${entries.length} entries`, entries.length > 0);
const serials = entries.map((x) => x.serial);
check('serials are unique', new Set(serials).size === serials.length);
check('every serial is inside its kind\'s range', entries.every((x) => SERIAL_RANGES[x.kind] && x.serial >= SERIAL_RANGES[x.kind][0] && x.serial <= SERIAL_RANGES[x.kind][1]));
check('names are unique', new Set(entries.map((x) => x.name)).size === entries.length);
const wellFormedShape = (x) => ((x.kind === 'polytope' || x.kind === 'bridge') && !['orthoplex', 'demicube', 'simplex'].includes(x.family) ? false
  : x.kind === 'bridge' && !(Number.isInteger(x.prism) && x.prism >= 0 && x.prism < TIERS[x.tier].d && !x.directions.includes(x.prism)) ? false : x.kind === 'patch'
  ? Array.isArray(x.window) && x.window.length === 3 && x.window.every(Number.isFinite) && [1, 2, 3].includes(x.rings) && x.reach > 0 && Number.isInteger(x.pieces)
  : Array.isArray(x.directions) && x.directions.length + (x.kind === 'bridge' ? 1 : 0) >= TIERS[x.tier].k && x.directions.every((i) => Number.isInteger(i) && i >= 0 && i < TIERS[x.tier].d)
    && new Set(x.directions).size === x.directions.length);
check('every entry is well-formed', entries.every((x) => TIERS[x.tier] && wellFormedShape(x)
  && (x.tier === '5d' ? Number.isInteger(x.layers) && x.layers >= 1 : x.layers === undefined)
  && (x.approximant === null || (Array.isArray(x.approximant) && x.approximant.length === 2))));
const engines = { '5d': makeQuasicrystal('5d'), '6d': makeQuasicrystal('6d') };
// Bridges: the shadow's sorted corner-to-corner distances (congruent
// shadows are the same entry).
const shadowKey = (x) => { const e = engines[x.tier]; const p = polytopeShape(e.d, x.family, x.directions, x.prism).verts.map((m) => e.parOf(m)); const ds = []; for (let a = 0; a < p.length; a++) for (let b = a + 1; b < p.length; b++) ds.push(Math.hypot(...p[a].map((v, i) => v - p[b][i])).toFixed(4)); return ds.sort().join(','); };
const shapeKeys = entries.map((x) => (x.kind === 'bridge'
  ? `${x.tier}|bridge|${x.family}|${shadowKey(x)}`
  : x.kind === 'polytope'
  ? `${x.tier}|polytope|${x.family}|${congruentSets(engines[x.tier], x.directions).map((s) => s.join('')).join(';')}`
  : x.kind === 'patch'
  ? `${x.tier}|patch|${canonicalPatch(engines[x.tier], localPatch(engines[x.tier], x.window, x.rings))}`
  : `${x.tier}|${congruentSets(engines[x.tier], x.directions).map((s) => s.join('')).join(';')}|${x.layers ?? 1}`));
check('no two entries are the same shape', new Set(shapeKeys).size === entries.length);
// A polytope's shadow is solid (3D in 6D, a polygon with area in 5D).
const spread = (pts) => {
  const c = pts[0].map((_, j) => pts.reduce((a, p) => a + p[j], 0) / pts.length);
  const M = [0, 1, 2].slice(0, c.length).map((i) => [0, 1, 2].slice(0, c.length).map((j) => pts.reduce((a, p) => a + (p[i] - c[i]) * (p[j] - c[j]), 0)));
  return M.length === 3
    ? M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
    : M[0][0] * M[1][1] - M[0][1] * M[1][0];
};
check('every polytope and bridge shadow is full-dimensional, with the right corner count', entries.filter((x) => x.kind === 'polytope' || x.kind === 'bridge').every((x) => {
  const e = engines[x.tier];
  const { verts, edges } = polytopeShape(e.d, x.family, x.directions, x.prism);
  const k = x.directions.length;
  const expect = (x.family === 'orthoplex' ? 2 * k : x.family === 'simplex' ? k + 1 : 2 ** (k - 1)) * (x.kind === 'bridge' ? 2 : 1);
  return verts.length === expect && edges.length > 0 && spread(verts.map((m) => e.parOf(m))) > 1e-6;
}));
check('every patch entry is as big as it says', entries.filter((x) => x.kind === 'patch').every((x) => localPatch(engines[x.tier], x.window, x.rings).length === x.pieces));

// Each entry lands: found near several points at several phasons, with the
// right piece count, all real tiles, none overlapping.
const probes = [[0, 0, 0], [3, -2, 1], [-4, 1, 2]];
const phasons = [[0, 0, 0], [0.31, -0.2, 0.12], [-0.45, 0.4, -0.3]];
for (const x of entries) {
  const e = makeQuasicrystal(x.tier, x.approximant);
  let ok = true, worst = 0;
  for (const ph of phasons) {
    const off = BASE_OFFSET[x.tier].map((b, i) => (x.tier === '5d' && i === 2 ? b : b + ph[i] * e.windowWidth));
    for (const p of probes) {
      const near = x.tier === '6d' ? p : [p[0], p[2]];
      const occ = findOccurrence(e, off, x, near);
      if (!occ) { ok = false; continue; }
      worst = Math.max(worst, Math.hypot(...occ.centre.map((c, i) => c - near[i])));
      if (x.kind === 'polytope' || x.kind === 'bridge') { ok &&= e.isVertex(occ.anchor, off); continue; }
      const inPlane = occ.tiles.length === pieceCount(e, x) / (x.layers ?? 1);
      const real = occ.tiles.every((t) => e.isTile(t.n, t.I, off));
      const V = occ.tiles.map((t) => e.tileVertices(t.n, t.I));
      const apart = V.every((a, i) => V.every((b, j) => j <= i || !tilesOverlap(a, b)));
      ok &&= inPlane && real && apart;
    }
  }
  check(`${x.serial} ${x.name}: ${x.kind === "polytope" || x.kind === "bridge" ? "anchors at a tiling vertex" : `lands as ${pieceCount(makeQuasicrystal(x.tier), x)} real piece${pieceCount(makeQuasicrystal(x.tier), x) === 1 ? "" : "s"}`} near every probe (farthest ${worst.toFixed(1)} away)`, ok);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall catalogue checks passed');
process.exit(failures ? 1 : 0);
