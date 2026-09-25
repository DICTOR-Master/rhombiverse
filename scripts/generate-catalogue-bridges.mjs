// Generates the bridge entries of data/catalogue-5d6d.json (serials
// 2000-2999: hyperprisms) and rewrites that file (other entries kept).
// Run by hand: node scripts/generate-catalogue-bridges.mjs
//
// A hyperprism is a lattice polytope (orthoplex, demicube or corner
// simplex over k axes S) carried one step along a further axis j. One
// entry per family, size k and distinct shadow: two (S, j) choices are the
// same entry when their shadows are congruent (equal sorted corner-to-corner
// distances), so every entry is a different shape.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeQuasicrystal, subsets } from '../src/geometry-extensions/quasicrystal.js';
import { polytopeShape } from '../src/geometry-extensions/quasicrystal-catalogue.js';

const FILE = new URL('../data/catalogue-5d6d.json', import.meta.url);
const FAMILIES = [['orthoplex', 2], ['demicube', 3], ['simplex', 2]]; // family, smallest k
const LETTERS = 'ABCDEFGH';

function shapeKey(e, family, S, j) {
  const pts = polytopeShape(e.d, family, S, j).verts.map((m) => e.parOf(m));
  const ds = [];
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) ds.push(Math.hypot(...pts[a].map((x, i) => x - pts[b][i])).toFixed(4));
  return ds.sort().join(',');
}

function entriesFor(tier, firstSerial) {
  const e = makeQuasicrystal(tier);
  const out = [];
  let serial = firstSerial;
  for (const [family, kMin] of FAMILIES) {
    for (let k = kMin; k <= e.d - 1; k++) {
      const classes = [];
      for (const S of subsets(e.d, k)) {
        for (let j = 0; j < e.d; j++) {
          if (S.includes(j)) continue;
          const key = shapeKey(e, family, S, j);
          if (!classes.some((c) => c.key === key)) classes.push({ key, S, j });
        }
      }
      classes.forEach(({ S, j }, i) => {
        const base = `${k}-${family === 'simplex' ? 'simplex corner' : family}`;
        const common = { orthoplex2: ', a square', simplex2: ', a triangle', orthoplex3: ', an octahedron', demicube3: ', a tetrahedron', simplex3: ', a tetrahedron corner', orthoplex4: ', a 16-cell', demicube4: ', a 16-cell' }[`${family}${k}`] ?? '';
        const form = classes.length > 1 ? ` (form ${LETTERS[i]})` : '';
        out.push({ serial: serial++, tier, kind: 'bridge', name: `${tier === '6d' ? '6D' : '5D'} ${base} prism${common}${form}`, family, directions: S, prism: j, ...(tier === '5d' ? { layers: 1 } : {}), approximant: null });
      });
    }
  }
  return out;
}

const kept = JSON.parse(readFileSync(FILE)).filter((x) => x.kind !== 'bridge');
const six = entriesFor('6d', 2001);
const five = entriesFor('5d', 2001 + six.length);
const all = [...kept.filter((x) => x.serial < 2000), ...six, ...five, ...kept.filter((x) => x.serial >= 3000)];
writeFileSync(FILE, `[\n${all.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n`);
console.log(`wrote ${all.length} entries (${six.length + five.length} bridges)`);
for (const x of [...six, ...five]) console.log(`  ${x.serial} ${x.name} [${x.directions}] +${x.prism}`);
