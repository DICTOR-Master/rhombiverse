// The elementary 1D cell (DICTO's Dimensional Construction Interface:
// "long, bullet-like cells"), shared by the 1D worlds (Signal,
// Construct): a rounded nose, and a tail hollowed to the nose's own arc
// (direct instruction: "the tail is indented to the specific arc of
// nose"), so along an axis each cell's nose nests in the next one's
// tail. The nose also shows which way the axis runs.
//
// Built along +y, nose at +y, for a cell spanning [-unit/2, unit/2] of
// its axis: the nose tip is at unit/2 - pad/2 and the tail cup's deepest
// point at -unit/2 + pad/2, so consecutive cells (unit apart) keep a
// `pad` gap where nose meets cup. The cup's rim reaches back past -unit/2,
// around the previous cell's nose.
import * as THREE from 'three';

const cache = new Map();
export function bulletGeometry(unit, radius, pad = 0) {
  const key = `${unit.toFixed(4)}|${radius.toFixed(4)}|${pad.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  const tip = unit / 2 - pad / 2;
  const cupDeep = -unit / 2 + pad / 2;
  const r = Math.min(radius, (tip - cupDeep) / 2);
  const pts = [];
  const STEPS = 10;
  // Tail cup: a sphere of the nose's radius, centred r behind its
  // deepest point, from the axis out to the rim.
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r * Math.sin(a), cupDeep - r + r * Math.cos(a)));
  }
  // Side, then the nose back to the axis.
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r * Math.cos(a), tip - r + r * Math.sin(a)));
  }
  const g = new THREE.LatheGeometry(pts, 64); // smooth circles, no crenulation
  g.computeVertexNormals();
  // A soft shadow in the tail's hollow, darkening toward its centre, so
  // the concave cup reads as concave, not as a dome (direct request:
  // "concave appearing convex, so slight shadow darkening towards
  // centre"). Materials use it through vertexColors.
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const rho = Math.hypot(pos.getX(i), pos.getZ(i));
    const inCup = pos.getY(i) <= cupDeep + 1e-6 && rho < r - 1e-6;
    const f = inCup ? 0.35 + 0.65 * (rho / r) ** 2 : 1;
    col[3 * i] = col[3 * i + 1] = col[3 * i + 2] = f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cache.set(key, g);
  return g;
}
