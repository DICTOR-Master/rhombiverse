// The elementary 1D cell (DICTO's Dimensional Construction Interface:
// "long, bullet-like cells"), shared by the 1D worlds (Signal,
// Construct): a rounded nose, and a tail hollowed to the nose's own arc
// (direct instruction: "the tail is indented to the specific arc of
// nose"), so along an axis each cell's nose nests in the next one's
// tail. The nose also shows which way the axis runs.
//
// Built along +y, nose at +y, for a cell spanning [-unit/2, unit/2] of
// its axis. The back is flat (direct request: "the backs of bullets
// should appear flat for simplicity, but actually are concave so they
// nest"): a knife-edge rim at -unit/2 + pad/2 round a hollow as deep as
// the nose, which domes out past unit/2 into the next cell's hollow, a
// `pad` gap between them. A line's last nose therefore rounds off its
// end, and at a corner rounds the corner.
import * as THREE from 'three';

const cache = new Map();
// `segments`: round the axis, `steps`: along the nose's and hollow's
// curves. Full detail by default ("smooth circles, no crenulation"); the
// finished edges Construct and Nets fuse into rods use fewer.
export function bulletGeometry(unit, radius, pad = 0, segments = 64, steps = 10) {
  const key = `${unit.toFixed(4)}|${radius.toFixed(4)}|${pad.toFixed(4)}|${segments}|${steps}`;
  if (cache.has(key)) return cache.get(key);
  const back = -unit / 2 + pad / 2; // the flat back, and the hollow's centre
  const base = unit / 2 - pad / 2; // the nose's centre
  const r = Math.min(radius, (base - back) / 2);
  const pts = [];
  const STEPS = steps; // along the nose's and the hollow's curve
  // Tail hollow: a sphere of the nose's radius, from its deepest point on
  // the axis out to the rim.
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r * Math.sin(a), back + r * Math.cos(a)));
  }
  // Side, then the nose back to the axis.
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r * Math.cos(a), base + r * Math.sin(a)));
  }
  const g = new THREE.LatheGeometry(pts, segments); // smooth circles, no crenulation
  g.computeVertexNormals();
  // A soft shadow in the tail's hollow, darkening toward its centre, so
  // the concave cup reads as concave, not as a dome (direct request:
  // "concave appearing convex, so slight shadow darkening towards
  // centre"). Materials use it through vertexColors.
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const rho = Math.hypot(pos.getX(i), pos.getZ(i));
    const inCup = i % pts.length <= STEPS && rho < r - 1e-6; // lathe vertices run profile-first
    const f = inCup ? 0.35 + 0.65 * (rho / r) ** 2 : 1;
    col[3 * i] = col[3 * i + 1] = col[3 * i + 2] = f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cache.set(key, g);
  return g;
}

// A faint, not-yet-filled or gap cell drawn plain: an open cylinder the
// cell's length, no nose or hollow tail, so a run of them reads as one
// smooth line (direct report: "gaps shouldn't show as double when
// ghosted out": see-through noses and cups overlapped as double rims).
const plainCache = new Map();
export function plainCellGeometry(unit, radius, segments = 64) {
  const key = `${unit.toFixed(4)}|${radius.toFixed(4)}|${segments}`;
  if (!plainCache.has(key)) {
    const g = new THREE.CylinderGeometry(radius, radius, unit, segments, 1, true);
    const col = new Float32Array(g.attributes.position.count * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); // matches the bullets' vertexColors materials
    plainCache.set(key, g);
  }
  return plainCache.get(key);
}
