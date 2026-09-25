// Verifies data/catalogue-5d6d.json against the cut-and-project engine:
// serials unique and inside their kind's range, names unique, and every
// entry genuinely occurs in its tiling (at several phasons, near several
// points), landing as the right number of pieces with no overlap.
import { readFileSync } from 'node:fs';
import { makeQuasicrystal, BASE_OFFSET, TIERS } from '../src/geometry-extensions/quasicrystal.js';
import { SERIAL_RANGES, findOccurrence, pieceCount, congruentSets } from '../src/geometry-extensions/quasicrystal-catalogue.js';
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
check('every entry is well-formed', entries.every((x) => TIERS[x.tier] && Array.isArray(x.directions)
  && x.directions.length >= TIERS[x.tier].k && x.directions.every((i) => Number.isInteger(i) && i >= 0 && i < TIERS[x.tier].d)
  && new Set(x.directions).size === x.directions.length
  && (x.tier === '5d' ? Number.isInteger(x.layers) && x.layers >= 1 : x.layers === undefined)
  && (x.approximant === null || (Array.isArray(x.approximant) && x.approximant.length === 2))));
const shapeKeys = entries.map((x) => `${x.tier}|${congruentSets(makeQuasicrystal(x.tier), x.directions).map((s) => s.join('')).join(';')}|${x.layers ?? 1}`);
check('no two entries are the same shape', new Set(shapeKeys).size === entries.length);

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
      const inPlane = occ.tiles.length === pieceCount(e, x) / (x.layers ?? 1);
      const real = occ.tiles.every((t) => e.isTile(t.n, t.I, off));
      const V = occ.tiles.map((t) => e.tileVertices(t.n, t.I));
      const apart = V.every((a, i) => V.every((b, j) => j <= i || !tilesOverlap(a, b)));
      ok &&= inPlane && real && apart;
    }
  }
  check(`${x.serial} ${x.name}: lands as ${pieceCount(makeQuasicrystal(x.tier), x)} real piece${pieceCount(makeQuasicrystal(x.tier), x) === 1 ? "" : "s"} near every probe (farthest ${worst.toFixed(1)} away)`, ok);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall catalogue checks passed');
process.exit(failures ? 1 : 0);
