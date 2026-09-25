// Rotating wireframe thumbnails (2026-09-24, direct request: wizard
// previews "rotating like polyhedraverse"). A plain-JS port of
// polyhedraverse's app/components/browser/ShapePreview.tsx: a 2D <canvas>
// orthographic projection, NOT a WebGL context per thumbnail (a list of
// ~20 cards would blow past the browser's concurrent-context limit, and
// a second full WebGL render beside render.js's main scene is a real,
// already-fixed perf mistake in this codebase -- see welcome.js's own
// header). Same behavior as the original: centroid-centered, scaled by
// max radius, a fixed 0.5 rad tilt, 0.008 rad/frame spin, a random
// per-instance starting phase, depth-sorted edges with far edges dimmed,
// and ONE shared requestAnimationFrame loop ticking every mounted
// preview.
//
// Input is a plain list of edges as point pairs, [[a, b], ...] with
// a/b = [x, y, z] -- whatever the caller's own real geometry source
// produces (render.js's EdgesGeometry of the real piece geometry, the
// 2D tile outlines, ...), so this file owns no geometry of its own.
// An edge list flagged `edges.coin = true` (a flat 2D tile) spins like
// a coin instead: no tilt, turning about the vertical axis, so it
// narrows to its edge and back, with no depth dimming.

const LINE_COLOR = '#7cf';
const LINE_COLOR_DIM = 'rgba(124, 204, 255, 0.35)';
const SPIN_PER_FRAME = 0.008;
const TILT = 0.5;

const scheduler = (() => {
  const callbacks = new Set();
  let frameId = null;
  const tick = (now) => {
    callbacks.forEach((cb) => cb(now));
    frameId = callbacks.size > 0 ? requestAnimationFrame(tick) : null;
  };
  return {
    register(cb) {
      callbacks.add(cb);
      if (frameId === null) frameId = requestAnimationFrame(tick);
    },
    unregister(cb) {
      callbacks.delete(cb);
    },
  };
})();

function rotateY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function rotateX([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

// Draws `edges` into `canvas` (CSS size `size` px), spinning. Returns a
// dispose function that unregisters it from the shared loop -- callers
// must call it when the canvas leaves the DOM.
export function mountWireframePreview(canvas, edges, size) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx || !edges.length) return () => {};

  const pts = edges.flat();
  const c = [0, 1, 2].map((a) => pts.reduce((s, p) => s + p[a], 0) / pts.length);
  const centered = edges.map(([a, b]) => [a.map((v, i) => v - c[i]), b.map((v, i) => v - c[i])]);
  const maxR = Math.max(...centered.flat().map((p) => Math.hypot(...p)), 1e-6);
  const scale = (size * dpr * 0.36) / maxR;
  let angle = Math.random() * Math.PI * 2;

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const half = (size * dpr) / 2;
    const tilt = edges.coin ? 0 : TILT;
    const rotated = centered.map(([a, b]) => [rotateX(rotateY(a, angle), tilt), rotateX(rotateY(b, angle), tilt)]);
    const zs = rotated.flat().map((p) => p[2]);
    const minZ = Math.min(...zs);
    const zRange = Math.max(Math.max(...zs) - minZ, 1e-6);
    const byDepth = rotated
      .map(([a, b]) => ({ a, b, avgZ: (a[2] + b[2]) / 2 }))
      .sort((e1, e2) => e1.avgZ - e2.avgZ);
    ctx.lineWidth = Math.max(1, dpr);
    for (const { a, b, avgZ } of byDepth) {
      ctx.strokeStyle = edges.coin || (avgZ - minZ) / zRange > 0.5 ? LINE_COLOR : LINE_COLOR_DIM;
      ctx.beginPath();
      ctx.moveTo(half + a[0] * scale, half - a[1] * scale);
      ctx.lineTo(half + b[0] * scale, half - b[1] * scale);
      ctx.stroke();
    }
  };

  const onFrame = () => {
    angle += SPIN_PER_FRAME;
    draw();
  };
  draw();
  scheduler.register(onFrame);
  return () => scheduler.unregister(onFrame);
}
