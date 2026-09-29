// Spherical View Cycle, States 2 and 3 (docs/RHOMBIVERSE_SPEC_SPHERICAL_
// VIEW_CYCLE.md): close-packed spheres and the voids they leave, read
// straight off the RD grid. Pure maths, no THREE (verify:packing).
//
// The app's cells are the D3 / A1* frame the spec names: RD centres on
// the even-sum integer points, each RD with cube half-side 1/2 and apexes
// at ±1. So:
// - one sphere per RD centre; nearest neighbours are √2 apart, so the
//   spheres touch at radius √2/2 (not EdgeLength/2 as the spec's draft
//   says: the RD's edge is √3/2, which would leave them apart);
// - octahedral voids sit on the RD's 4-valent corners, the odd-sum
//   integer points, each with 6 spheres round it at distance 1;
// - tetrahedral voids sit on its 3-valent corners, the points with every
//   coordinate a half-integer, each with 4 spheres round it at √3/2.
// A void counts only when all its spheres are placed (direct decision,
// 2026-09-29: "only fully enclosed").

export const TANGENT_R = Math.SQRT2 / 2; // spheres touching
export const OCTA_DIST = 1; // void centre to its spheres' centres
export const TETRA_DIST = Math.sqrt(3) / 2;
// The largest sphere that fits each void when the spheres have radius r.
export const voidRadius = (kind, r) => Math.max(0, (kind === 'octa' ? OCTA_DIST : TETRA_DIST) - r);
// At tangency: (√2 − 1)·r and (√(3/2) − 1)·r, the classic 0.414 and 0.225.
export const OCTA_FIT = Math.SQRT2 - 1;
export const TETRA_FIT = Math.sqrt(1.5) - 1;
// The void sphere drawn at sphere radius r: in proportion below touching
// (so at r = 0 there's nothing, and shrinking the spheres doesn't swell
// the voids into one another), closing up once the spheres overlap.
export const voidSphereRadius = (kind, r) => Math.min((kind === 'octa' ? OCTA_FIT : TETRA_FIT) * r, voidRadius(kind, r));
// The radius slider's range (a fraction of TANGENT_R): 0 = plain
// wireframe, 1 = touching, above = overlapping, molecule-style.
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 1.35;

const key = (p) => p.map((v) => v.toFixed(3)).join();

/** Spheres and enclosed voids for a set of whole RD cells ([x, y, z],
 * even-sum integers): { spheres, octa, tetra } (points). */
export function packing(cells) {
  const has = new Set(cells.map(key));
  const spheres = cells.map((c) => [...c]);
  const octa = new Map(), tetra = new Map();
  const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const c of cells) {
    // Octahedral: across each of the cell's 6 apexes.
    for (const d of AX) {
      const v = c.map((x, i) => x + d[i]);
      const k = key(v);
      if (octa.has(k)) continue;
      if (AX.every((e) => has.has(key(v.map((x, i) => x + e[i]))))) octa.set(k, v);
    }
    // Tetrahedral: at each of its 8 cube corners; its spheres are the
    // even-sum corners of the unit cube round it.
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
      const v = [c[0] + sx, c[1] + sy, c[2] + sz];
      const k = key(v);
      if (tetra.has(k)) continue;
      const around = [];
      for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) for (const g of [-0.5, 0.5]) {
        const p = [v[0] + a, v[1] + b, v[2] + g];
        if ((p[0] + p[1] + p[2]) % 2 === 0) around.push(p);
      }
      if (around.every((p) => has.has(key(p)))) tetra.set(k, v);
    }
  }
  return { spheres, octa: [...octa.values()], tetra: [...tetra.values()] };
}
