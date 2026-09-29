// Checks src/geometry-extensions/sphere-packing.js (Spherical View Cycle,
// States 2-3): spheres touch exactly at TANGENT_R; voids are found only
// when enclosed, each with the right number of spheres at the right
// distance; void spheres fit without overlapping; and in bulk FCC there
// are one octahedral and two tetrahedral voids per sphere.
import { packing, TANGENT_R, OCTA_FIT, TETRA_FIT, voidRadius, voidSphereRadius, OCTA_DIST, TETRA_DIST, RADIUS_MAX } from '../src/geometry-extensions/sphere-packing.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const NB = [[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]];

check('neighbours touch: nearest centres 2·TANGENT_R apart (√2), TANGENT_R = √2/2', near(dist([0, 0, 0], [1, 1, 0]), 2 * TANGENT_R) && near(TANGENT_R, Math.SQRT2 / 2));
check('void fits at tangency: octahedral (√2−1)r ≈ 0.414r, tetrahedral (√1.5−1)r ≈ 0.225r', near(voidRadius('octa', TANGENT_R), OCTA_FIT * TANGENT_R) && near(voidRadius('tetra', TANGENT_R), TETRA_FIT * TANGENT_R), `${OCTA_FIT.toFixed(3)}, ${TETRA_FIT.toFixed(3)}`);

const counts = (cells) => { const p = packing(cells); return `${p.spheres.length}/${p.octa.length}/${p.tetra.length}`; };
check('one RD: one sphere, no enclosed voids', counts([[0, 0, 0]]) === '1/0/0');
check('four in a tetrahedron: one tetrahedral void', counts([[0, 0, 0], [1, 1, 0], [1, 0, 1], [0, 1, 1]]) === '4/0/1');
check('six round a point: one octahedral void', counts([[0, 0, 0], [2, 0, 0], [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1]]) === '6/1/0');
check('the 13-cell cluster (a centre and its 12 neighbours): 8 tetrahedral voids round the centre, no octahedral', counts([[0, 0, 0], ...NB]) === '13/0/8', counts([[0, 0, 0], ...NB]));

// A block of FCC: every void's spheres at the right distance, no void
// sphere overlapping a sphere, and deep inside 1 octahedral and 2
// tetrahedral voids per sphere.
const block = [];
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) for (let z = 0; z <= 8; z++) if ((x + y + z) % 2 === 0) block.push([x, y, z]);
const P = packing(block);
const around = (v, d) => P.spheres.filter((s) => near(dist(s, v), d)).length;
check('every octahedral void has 6 spheres at distance 1, every tetrahedral 4 at √3/2', P.octa.every((v) => around(v, OCTA_DIST) === 6) && P.tetra.every((v) => around(v, TETRA_DIST) === 4));
const clear = [...P.octa.map((v) => ['octa', v]), ...P.tetra.map((v) => ['tetra', v])].every(([k, v]) => P.spheres.every((s) => dist(s, v) >= TANGENT_R + voidRadius(k, TANGENT_R) - 1e-9));
check('void spheres fit: none overlaps a packed sphere', clear);
const inner = (v) => v.every((x) => x >= 2 && x < 6);
const nS = P.spheres.filter(inner).length, nO = P.octa.filter(inner).length, nT = P.tetra.filter(inner).length;
check('bulk FCC: one octahedral and two tetrahedral voids per sphere', nO === nS && nT === 2 * nS, `${nS} spheres, ${nO} octa, ${nT} tetra`);

// The size slider: void spheres in proportion below touching, never
// overlapping a packed sphere at any size, gone at 0 and once overlapped.
const sizes = Array.from({ length: 28 }, (_, i) => (i / 20) * TANGENT_R).filter((r) => r <= RADIUS_MAX * TANGENT_R);
const ok = sizes.every((r) => ['octa', 'tetra'].every((k) => { const v = voidSphereRadius(k, r); return v >= 0 && v <= voidRadius(k, r) + 1e-12 && v <= (k === 'octa' ? OCTA_FIT : TETRA_FIT) * r + 1e-12; }));
check('the size slider: voids in proportion below touching, fit at every size, gone at 0 and when overlapped', ok && voidSphereRadius('octa', 0) === 0 && voidSphereRadius('tetra', RADIUS_MAX * TANGENT_R) === 0 && near(voidSphereRadius('octa', TANGENT_R), OCTA_FIT * TANGENT_R));

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
