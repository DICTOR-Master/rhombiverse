// Checks src/geometry-extensions/rd-pieces.js
// from the solids themselves, not by sampling:
// - every split's pieces have equal volume, fill the RD (volumes sum to
//   the RD's) and never overlap (every pair meets in zero volume);
// - the big RD at x2, x3, x4 and x6 is filled exactly by small pieces of
//   the family, with the measured counts;
// - shell sizes for both shell rules.
import { SPLITS, SPLIT_BY_ID, OH, pieceSolid, solidFromPlanes, scaleDecomposition, shells, identifyPiece, HULLS, HULL_IDS, hullShell, hullShellOf, splitOrientations, pieceAt, piecesOverlap, pointInPiece, TRIMMABLE, hullPlanes, trimGauge, trimPiece } from '../src/geometry-extensions/rd-pieces.js';
import { rdQuarterPieces, hemisphereSplit, NEIGHBOR_OFFSETS } from '../src/core/lattice.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}
const near = (a, b, tol = 1e-7) => Math.abs(a - b) < tol;
const RD_VOLUME = 2;

check('the RD itself has volume 2', near(SPLIT_BY_ID.get('whole').piece0.volume, RD_VOLUME));

for (const s of SPLITS) {
  const pieces = s.elements.map((g) => pieceSolid(s.id, g));
  check(`${s.id}: ${s.count} distinct pieces`, pieces.length === s.count, `${pieces.length}`);
  const vols = pieces.map((p) => p.volume);
  check(`${s.id}: each piece is 1/${s.count} of the RD`, vols.every((v) => near(v, RD_VOLUME / s.count)), `${Math.min(...vols).toFixed(9)}-${Math.max(...vols).toFixed(9)}`);
  check(`${s.id}: pieces fill the RD`, near(vols.reduce((a, b) => a + b, 0), RD_VOLUME));
  let overlap = 0;
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    overlap = Math.max(overlap, solidFromPlanes([...pieces[i].planes, ...pieces[j].planes]).volume);
  }
  check(`${s.id}: no two pieces overlap`, overlap < 1e-7, `largest shared volume ${overlap.toExponential(1)}`);
}

// The app's own pieces are members of the family, in every orientation:
// RD Quarter (core/lattice.js rdQuarterPieces) and Hemi RD (hemisphereSplit).
const quarters = rdQuarterPieces(1).map(identifyPiece);
check("the app's 4 RD Quarters are the 4 rhombohedral quarters", quarters.every((q) => q?.split === 'quarter-rhombohedron') && new Set(quarters.map((q) => pieceSolid('quarter-rhombohedron', q.g).verts.map((v) => v.join()).sort().join('|'))).size === 4);
const hemis = NEIGHBOR_OFFSETS.map((_, i) => identifyPiece(hemisphereSplit(1, i).positive));
check("the app's 12 Hemi RD halves are diagonal-mirror halves", hemis.every((h) => h?.split === 'half-diagonal'));

// The scale ladder. Expected counts per piece kind (measured by Monte
// Carlo in the design session, 2026-09-26; here from exact solids).
const EXPECTED = {
  2: { whole: 1, 'half-diagonal': 12, sixth: 6 },
  3: { whole: 19, third: 24 },
  4: { whole: 43, 'half-diagonal': 36, 'quarter-rhombohedron': 8, sixth: 6 },
  6: { whole: 165, 'half-diagonal': 84, third: 24, sixth: 6 },
};
for (const [k, expected] of Object.entries(EXPECTED).map(([k, e]) => [Number(k), e])) {
  const parts = scaleDecomposition(k);
  const unknown = parts.filter((p) => !p.split);
  check(`x${k}: every boundary piece is a member of the family`, unknown.length === 0, unknown.length ? `${unknown.length} unmatched, volumes ${[...new Set(unknown.map((p) => p.volume.toFixed(4)))].join(', ')}` : '');
  const counts = {};
  for (const p of parts) if (p.split) counts[p.split] = (counts[p.split] ?? 0) + 1;
  check(`x${k}: counts ${JSON.stringify(expected)}`, JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(expected).sort()), JSON.stringify(counts));
  const total = parts.reduce((a, p) => a + p.volume, 0);
  check(`x${k}: pieces fill the big RD (${k ** 3} RDs of volume)`, near(total, RD_VOLUME * k ** 3, 1e-6), (total / RD_VOLUME).toFixed(9));
}
// A big RD away from the origin decomposes the same way.
check('x2 at coarse cell (1,1,0): same counts as at the origin', JSON.stringify(scaleDecomposition(2, [1, 1, 0]).map((p) => p.split).sort()) === JSON.stringify(scaleDecomposition(2).map((p) => p.split).sort()));

// Shells.
const stepSizes = shells('steps', 6).map((c) => c.length);
check('step shells: 12, 42, 92, 162, 252, 362 (10n² + 2)', JSON.stringify(stepSizes) === '[12,42,92,162,252,362]', stepSizes.join(','));
const distSizes = shells('distance', 8).map((c) => c.length);
check('distance shells: 12, 6, 24, 12, 24, 8, 48, 6', JSON.stringify(distSizes) === '[12,6,24,12,24,8,48,6]', distSizes.join(','));
const scaled = shells('steps', 2, [2, 0, 0], 2);
check('scaled shells: x2 step shell 1 is 12 coarse cells, each 2 small steps from its centre', scaled[0].length === 12 && scaled[0].every((c) => Math.abs(c[0] - 2) + Math.abs(c[1]) + Math.abs(c[2]) === 4));
// Hulls: Steps is the cuboctahedron gauge, Distance the sphere, and each
// target's shells hold exactly the cells whose gauge ranks there.
const sameCells = (a, b) => JSON.stringify(a.map((c) => c.join()).sort()) === JSON.stringify(b.map((c) => c.join()).sort());
check('hull "steps" shells 1-6 = the neighbour-step shells', shells('steps', 6).every((cells, i) => sameCells(cells, hullShell('steps', i + 1, [0, 0, 0]))));
check('hull "distance" shells 1-8 = the distance shells', shells('distance', 8).every((cells, i) => sameCells(cells, hullShell('distance', i + 1, [0, 0, 0]))));
for (const h of HULL_IDS) {
  const ok = [1, 2, 3, 4, 5, 6].every((n) => hullShell(h, n, [2, 0, 0]).every((c) => hullShellOf(h, c, [2, 0, 0]) === n));
  const sizes = [1, 2, 3, 4].map((n) => hullShell(h, n, [0, 0, 0]).length);
  check(`hull "${h}": shells 1-6 round-trip (cell -> shell -> cell), off-origin centre`, ok, `sizes ${sizes.join(',')}…`);
}
// Every target's faces lie on lattice layers (flat), measured on a hull of
// ~600 cells: along each face normal, the outermost cells share one plane
// and every face holds the same number of them.
const FACES = {
  tetrahedron: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  'tetrahedron-mirror': [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]],
  cube: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  octahedron: [1, -1].flatMap((a) => [1, -1].flatMap((b) => [1, -1].map((c) => [a, b, c]))),
  rd: [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]],
};
for (const [h, N] of Object.entries(FACES)) {
  const cells = [];
  for (let n = 1; cells.length < 600; n++) cells.push(...hullShell(h, n, [0, 0, 0]));
  const perFace = N.map((f) => { const d = cells.map((c) => c[0] * f[0] + c[1] * f[1] + c[2] * f[2]); const m = Math.max(...d); return d.filter((v) => v === m).length; });
  check(`hull "${h}": every face is a flat layer of equal size`, new Set(perFace).size === 1 && perFace[0] > 1, `${perFace[0]} cells per face`);
}
void HULLS;
// Fragments. Each orientation of a split is itself a full split of the
// RD (its pieces equal, non-overlapping, filling it); pieces of one
// orientation never overlap each other; pieceAt finds the piece under a
// point; a whole RD overlaps every piece in its cell and none next door.
for (const s of SPLITS) {
  const ors = splitOrientations(s.id);
  const ok = ors.every((gs) => gs.length === s.count
    && Math.abs(gs.map((g) => pieceSolid(s.id, g).volume).reduce((a, b) => a + b, 0) - 2) < 1e-7
    && gs.every((g, i) => gs.slice(i + 1).every((h) => !piecesOverlap({ split: s.id, g, cell: [0, 0, 0] }, { split: s.id, g: h, cell: [0, 0, 0] }))));
  check(`${s.id}: ${ors.length} orientation(s), each a full split of the RD`, ok);
}
{
  const pts = [[0.3, 0.1, 0.05], [-0.2, 0.4, 0.1], [0.05, -0.1, -0.6], [0.45, 0.3, 0.15]];
  const ok = SPLITS.every((s) => pts.every((p) => { const hit = pieceAt(s.id, [0, 0, 0], p); return hit && pointInPiece(s.id, hit.g, [0, 0, 0], p); }));
  check('pieceAt: every split finds the piece holding a point, and it really holds it', ok);
  check('pieceAt: a point outside the RD finds nothing', pieceAt('48th', [0, 0, 0], [1.2, 0, 0]) === null);
  const whole = { split: 'whole', g: 0, cell: [0, 0, 0] };
  check('overlap: a whole RD overlaps every 48th in its cell', splitOrientations('48th')[0].every((g) => piecesOverlap(whole, { split: '48th', g, cell: [0, 0, 0] })));
  check('overlap: a whole RD overlaps nothing in the cell next door', splitOrientations('48th')[0].every((g) => !piecesOverlap(whole, { split: '48th', g, cell: [1, 1, 0] })));
  const a = { split: 'half-axis', g: splitOrientations('half-axis')[0][0], cell: [0, 0, 0] };
  const crossing = splitOrientations('half-axis').flat().filter((g) => piecesOverlap(a, { split: 'half-axis', g, cell: [0, 0, 0] })).length;
  check('overlap: an x-half overlaps every half of the other two axes (and itself), not its opposite', crossing === 5, `${crossing} of 6`);
}
// Trimming: the built pieces cut by the trim planes fill the target shape
// exactly (volume of the cut pieces = volume of the hull), for every flat
// hull at shells 1-4, and the truncated octahedron at every size the
// trim rule picks up to shell 8 (and at none it rejects).
for (const h of TRIMMABLE) {
  const res = [];
  const built = [[0, 0, 0]];
  for (let n = 1; n <= (h === 'to' ? 8 : 4); n++) {
    built.push(...hullShell(h, n, [0, 0, 0]));
    const g = trimGauge(h, n);
    if (g === null) { res.push(`${n}:none`); continue; }
    const planes = hullPlanes(h, g);
    const H = solidFromPlanes(planes).volume;
    let covered = 0;
    for (const c of built) { const t = trimPiece(planes, 'whole', 0, c); if (t === 'inside') covered += 2; else if (t) covered += t.volume; }
    res.push(`${n}:${Math.abs(covered - H) < 1e-6 ? 'exact' : 'NOT'}`);
  }
  check(`trim "${h}": the cut pieces fill the target shape exactly`, !res.some((r) => r.endsWith('NOT')), res.join(' '));
}
check('trim "to": no exact size before shell 4, then gauges 3 and 4', trimGauge('to', 3) === null && trimGauge('to', 4) === 3 && trimGauge('to', 5) === 4 && trimGauge('to', 6) === 4);
check('trim: the sphere has no flat faces to trim to', trimGauge('distance', 3) === null);
check('OH has 48 distinct elements', new Set(OH.map((m) => m.flat().join())).size === 48);

console.log(`\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
