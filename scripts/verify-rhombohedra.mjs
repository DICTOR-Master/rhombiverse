// Verifies rhombohedra-lattice.js's 4-orientation attach logic: every
// face of every orientation offers exactly 2 non-overlapping pieces
// (same-orientation translate + one partner orientation), and 4 pieces
// around one RD center reassemble that RD, reachable purely by attaching.
import { rdQuarterPieces } from '../src/core/lattice.js';
import {
  rhombohedraAttachOptions,
  rhombohedraOverlap,
  rhombohedraOrientationMatrix,
  rhombohedraMigrateLegacyCell,
  rhombohedraTileVerts,
  rhombohedraCellToWorld,
} from '../src/geometry-extensions/rhombohedra-lattice.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}
const key = (a) => a.join(',');
const normals = [[1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1]].flatMap((n) => [n, n.map((x) => -x)]);

// The 4 RD Quarter pieces of the RD at the origin, in the centroid frame.
const rdQuarters = rdQuarterPieces(1).map((raw, q) => ({ o: q, c4: [0, 1, 2].map((a) => Math.round((raw.reduce((s, p) => s + p[a], 0) / 8) * 4)) }));

for (let q = 0; q < 4; q++) {
  const c4 = rdQuarters[q].c4;
  const counts = new Set();
  const seenFaces = new Set();
  for (const n of normals) {
    const opts = rhombohedraAttachOptions(q, c4, n);
    const faceSig = opts.map((o) => key([o.o, ...o.c4])).join(';');
    if (seenFaces.has(faceSig)) continue;
    seenFaces.add(faceSig);
    counts.add(`${opts.length}:${opts[0]?.o === q}:${opts[1] ? opts[1].o !== q : false}`);
  }
  check(`orientation ${q}: 6 distinct faces`, seenFaces.size === 6);
  check(`orientation ${q}: every face offers exactly [same orientation, partner]`, counts.size === 1 && counts.has('2:true:true'));
}

check('the 4 RD quarters never overlap each other', rdQuarters.every((a, i) => rdQuarters.every((b, j) => i === j || !rhombohedraOverlap(a.o, a.c4, b.o, b.c4))));
// Reachability: starting from quarter 0 alone, attaching partners across faces reaches all 4.
const reached = new Set([key([0, ...rdQuarters[0].c4])]);
let frontier = [rdQuarters[0]];
const target = new Set(rdQuarters.map((r) => key([r.o, ...r.c4])));
for (let step = 0; step < 3; step++) {
  const next = [];
  for (const p of frontier) for (const n of normals) for (const opt of rhombohedraAttachOptions(p.o, p.c4, n)) {
    const k = key([opt.o, ...opt.c4]);
    if (target.has(k) && !reached.has(k)) { reached.add(k); next.push(opt); }
  }
  frontier = next;
}
check('all 4 RD quarters reachable from one by face-attaching (a whole RD can be clustered)', reached.size === 4);

// Rotations render each orientation exactly.
const t0 = rhombohedraTileVerts(1);
for (let q = 0; q < 4; q++) {
  const m = rhombohedraOrientationMatrix(q);
  const raw = rdQuarterPieces(1)[q];
  const c = [0, 1, 2].map((a) => raw.reduce((s, p) => s + p[a], 0) / 8);
  const want = new Set(raw.map((p) => p.map((x, a) => (x - c[a]).toFixed(6)).join(',')));
  const got = t0.map((v) => [0, 1, 2].map((r) => (m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]).toFixed(6)).join(','));
  check(`orientation ${q}: rotation matrix maps the shared geometry onto it`, got.every((g) => want.has(g.replace(/-0\.000000/g, '0.000000'))) || got.every((g) => want.has(g)));
}

// Legacy saves: old (i,j,k) cells land on the same world centroid.
check('legacy migration preserves world position', [[5, 0, 0], [-2, 3, 1]].every(([i, j, k]) => key(rhombohedraMigrateLegacyCell(i, j, k).map((x) => x / 4)) === key(rhombohedraCellToWorld(i, j, k, 1).map((x) => Math.round(x * 4) / 4))));

console.log(failures === 0 ? '\nAll checks passed (0 failures).' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
