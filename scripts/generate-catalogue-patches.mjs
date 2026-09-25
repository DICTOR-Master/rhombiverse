// Generates the vertex-star patch entries of data/catalogue-5d6d.json
// (serials 3000+) from the tilings themselves, and rewrites that file
// (other entries kept). Run by hand: node scripts/generate-catalogue-patches.mjs
//
// For each tier: sample vertices at several phasons, group them by their
// vertex star (ring 1) up to symmetry, number the stars from most to least
// common, and for 1-3 rings take each star's most common surround. An
// entry's window point is the centroid of that surround's occurrences, each
// first turned into the surround's canonical orientation (the acceptance
// region is convex, so the centroid lies inside it); `reach` covers the
// spread seen. verify:catalogue then checks every entry really lands.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeQuasicrystal, BASE_OFFSET } from '../src/geometry-extensions/quasicrystal.js';
import { localPatch, canonicalPatch } from '../src/geometry-extensions/quasicrystal-catalogue.js';

const FILE = new URL('../data/catalogue-5d6d.json', import.meta.url);
// 6D stops at 2 rings: 3 rings is hundreds of pieces and rarely repeats.
const RINGS = { '5d': [1, 2, 3], '6d': [1, 2] };
const SAMPLE_CAP = 150; // occurrences per star examined for rings 2-3
// A surround must be seen this often to be listed, so a summon finds one
// nearby; rarer ones would land far away or not at all.
const MIN_SEEN = 10;
// Least search reach (window units): a few sightings understate the
// acceptance region, and too tight a reach misses real occurrences (the
// full patch check rejects any false candidate).
const MIN_REACH = 0.1;

const key = (t) => `${t.n.join(',')}|${t.I.join('')}`;
// The symmetry that brings tiles to their canonical orientation.
function canonicalWith(e, tiles) {
  let best = null;
  for (const g of e.symmetries()) {
    const s = tiles.map((t) => key(g.mapTile(t))).sort().join(';');
    if (!best || s < best.s) best = { s, g };
  }
  return best;
}

function sampleVertices(e, tier) {
  const out = [];
  const phasons = [[0, 0, 0], [0.31, -0.2, 0.12], [-0.45, 0.4, -0.3], [0.2, 0.45, 0.33], [-0.15, -0.38, 0.41]];
  const radius = tier === '6d' ? 7 : 22;
  for (const ph of phasons) {
    const off = BASE_OFFSET[tier].map((b, i) => (tier === '5d' && i === 2 ? b : b + ph[i] * e.windowWidth));
    const seen = new Set();
    for (const t of e.patch(off, radius + 3)) {
      for (let mask = 0; mask < 1 << t.I.length; mask++) {
        const v = t.n.map((x, l) => x + (t.I.some((i, b) => i === l && mask & (1 << b)) ? 1 : 0));
        const k = v.join(',');
        if (seen.has(k) || Math.hypot(...e.parOf(v)) > radius) continue;
        seen.add(k);
        out.push(e.perpOf(v).map((x, i) => off[i] - x)); // its window point
      }
    }
  }
  return out;
}

function entriesFor(tier, firstSerial) {
  const e = makeQuasicrystal(tier);
  const [big, small] = tier === '6d' ? ['prolate', 'oblate'] : ['thick', 'thin'];
  const points = sampleVertices(e, tier);
  console.log(`${tier}: ${points.length} sampled vertices`);
  // Group by vertex star.
  const stars = new Map();
  for (const w of points) {
    const c = canonicalPatch(e, localPatch(e, w, 1));
    if (!stars.has(c)) stars.set(c, []);
    stars.get(c).push(w);
  }
  const ordered = [...stars.values()].sort((a, b) => b.length - a.length);
  console.log(`${tier}: ${ordered.length} vertex stars`);
  const entries = [];
  let serial = firstSerial;
  ordered.forEach((ws, index) => {
    const star = localPatch(e, ws[0], 1);
    const nBig = star.filter((t) => e.tileType(t.I) === big).length;
    const starName = `${tier === '6d' ? '6D' : 'Penrose'} vertex star ${index + 1}: ${nBig} ${big}, ${star.length - nBig} ${small}`;
    for (const rings of RINGS[tier]) {
      const variants = new Map();
      for (const w of ws.slice(0, SAMPLE_CAP)) {
        const tiles = localPatch(e, w, rings);
        const { s, g } = canonicalWith(e, tiles);
        if (!variants.has(s)) variants.set(s, { tiles: tiles.length, aligned: [] });
        variants.get(s).aligned.push(g.perpMap(w));
      }
      const [canon, top] = [...variants.entries()].sort((a, b) => b[1].aligned.length - a[1].aligned.length)[0];
      if (top.aligned.length < MIN_SEEN) { console.log(`  skip ${starName}, ${rings} rings: seen ${top.aligned.length}x`); continue; }
      let window = [0, 1, 2].map((i) => top.aligned.reduce((sum, p) => sum + p[i], 0) / top.aligned.length);
      if (canonicalPatch(e, localPatch(e, window, rings)) !== canon) {
        // Centroid of a stabilizer-spread set can miss; use a real sample.
        window = top.aligned[0];
      }
      const reach = Math.max(MIN_REACH, Math.max(...top.aligned.map((p) => Math.hypot(...p.map((x, i) => x - window[i])))) * 1.25);
      entries.push({
        serial: serial++, tier, kind: 'patch',
        name: rings === 1 ? starName : `${starName}, ${rings} rings`,
        window: window.map((x) => Math.round(x * 1e6) / 1e6), rings, reach: Math.round(reach * 1e4) / 1e4, pieces: top.tiles,
        ...(tier === '5d' ? { layers: 1 } : {}), approximant: null,
      });
      console.log(`  ${entries.at(-1).serial} ${entries.at(-1).name}: ${top.tiles} pieces, seen ${top.aligned.length}x, reach ${reach.toFixed(3)}`);
    }
  });
  return entries;
}

const kept = JSON.parse(readFileSync(FILE)).filter((x) => x.kind !== 'patch');
const five = entriesFor('5d', 3001);
const six = entriesFor('6d', 3001 + five.length);
const all = [...kept, ...five, ...six];
writeFileSync(FILE, `[\n${all.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n]\n`);
console.log(`wrote ${all.length} entries (${five.length + six.length} patches)`);
