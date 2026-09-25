// Generates the polytope entries of data/catalogue-5d6d.json (serials
// 1-999) and rewrites that file (other entries kept). Run by hand:
// node scripts/generate-catalogue-polytopes.mjs
//
// One entry per family (orthoplex, demicube, corner simplex), size k (3 up
// to the tier's d) and orientation class of k axes up to the tiling's
// symmetries, so every entry is a different shadow.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeQuasicrystal, subsets } from '../src/geometry-extensions/quasicrystal.js';
import { congruentSets } from '../src/geometry-extensions/quasicrystal-catalogue.js';

const FILE = new URL('../data/catalogue-5d6d.json', import.meta.url);
const FAMILIES = ['orthoplex', 'demicube', 'simplex'];

function entriesFor(tier, firstSerial) {
  const e = makeQuasicrystal(tier);
  const out = [];
  let serial = firstSerial;
  for (const family of FAMILIES) {
    for (let k = 3; k <= e.d; k++) {
      const classes = [];
      for (const S of subsets(e.d, k)) {
        const key = congruentSets(e, S).map((T) => T.join('')).join(';');
        if (!classes.some((c) => c.key === key)) classes.push({ key, S });
      }
      for (const { S } of classes) {
        let suffix = '';
        if (classes.length > 1) {
          if (tier === '6d') suffix = ` (${e.tileType(S)} axes)`;
          else suffix = S.every((i, j) => j === 0 || (i - S[j - 1] === 1)) ? ' (adjacent axes)' : ' (spread axes)';
        }
        const common = { 'orthoplex3': ', an octahedron', 'demicube3': ', a tetrahedron', 'orthoplex4': ', a 16-cell', 'demicube4': ', a 16-cell' }[`${family}${k}`] ?? '';
        const name = `${k}-${family === 'simplex' ? 'simplex corner' : family}${common}${suffix}`;
        out.push({ serial: serial++, tier, kind: 'polytope', name: `${tier === '6d' ? '6D' : '5D'} ${name}`, family, directions: S, ...(tier === '5d' ? { layers: 1 } : {}), approximant: null });
      }
    }
  }
  return out;
}

const kept = JSON.parse(readFileSync(FILE)).filter((x) => x.kind !== 'polytope');
const six = entriesFor('6d', 1);
const five = entriesFor('5d', 1 + six.length);
const all = [...six, ...five, ...kept];
writeFileSync(FILE, `[\n${all.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n`);
console.log(`wrote ${all.length} entries (${six.length + five.length} polytopes)`);
for (const x of [...six, ...five]) console.log(`  ${x.serial} ${x.name} [${x.directions}]`);
