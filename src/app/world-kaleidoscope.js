// Kaleidoscope: a 2D world of its own (Wizard → 2D → Kaleidoscope).
// Build with flat tiles of one edge length (geometry-extensions/
// kaleidoscope.js: Penrose thick/thin rhombi and pentagons, Kagome
// triangles and hexagons, squares and triangles); the mirrors cut the
// build to one wedge (or triangle) and reflect it everywhere, like a
// real kaleidoscope. render.js routes taps here while it's on.
//
// Decisions this file implements (user, 2026-09-26):
// - Attach: tap an edge, the chosen piece goes across it (refused if it
//   would overlap). Loose: tap anywhere to drop the piece there; it
//   shuffles across the build until it lines up edge to edge, settling
//   in the free spot nearest where it fell (the spot whose Voronoi cell
//   it's in), preferring a spot beside a complementary partner (thick
//   next to thin, triangle next to hexagon, square next to triangle).
//   Pieces never overlap.
// - Shake loosens every piece and lets them all settle again, a new
//   pattern each time. Turn (slider) rotates the build against the
//   mirrors, like turning the tube; Spin turns it on its own.
// - Mirrors: Ring (1-12 mirror lines through the centre) or a triangle
//   of three (60-60-60, 45-45-90, 30-60-90) repeating across the plane;
//   the slider sets the mirror count or the triangle's size.
// - A tap on any mirror image means the same spot on the build (it's
//   folded back into the domain). Guides shows the mirror lines and the
//   uncut outlines of the build; off, it's the plain kaleidoscope.
// - Paint (the 2D brush) recolours the tapped piece; long-press removes.
import * as THREE from 'three';
import {
  KALEIDO_SHAPES, KALEIDO_GROUPS, KALEIDO_SHAPE_LABELS, MIRROR_MODES, RING_MIN, RING_MAX, SIZE_MIN, SIZE_MAX,
  looseTile, firstTile, overlaps, contains, nearestEdge, candidatesAcross, domain, groupMaps, applyMap, fold,
  clipPolygon, clipSegment, centroid, area, rotatePoint, PENROSE_SHAPES, indicesFrom, firstIndices, indicesSafe,
} from '../geometry-extensions/kaleidoscope.js';
import { createGearedSlider } from './geared-slider.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-kaleidoscope-world';
const FIRST_COLOR = 0x00e5ff;
const OUTLINE_COLOR = 0x05070c;
const GUIDE_COLOR = 0x9de0ff;
const GHOST_COLOR = 0x9de0ff;
const OUTLINE_WIDTH = 0.035; // edge lengths
const SETTLE_MS = 700;
const SPIN_PER_SEC = 0.25; // radians
const MAX_COPIES = 2500;
const lang = () => getSettings().language;
const shapeOk = (s) => Object.hasOwn(KALEIDO_SHAPES, s);
const groupOf = (shape) => KALEIDO_GROUPS.filter((g) => g.shapes.includes(shape));
const partners = (a, b) => a !== b && groupOf(a).some((g) => g.shapes.includes(b));

export function createKaleidoWorld({ scene, edge = 1, colorFor, getMaterial, isPainting = () => false, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  group.scale.setScalar(edge);
  scene.add(group);

  // ---- state ----
  let tiles = []; // { shape, verts, material, idx }, in placing order (idx: Penrose corner indices, see kaleidoscope.js)
  const view = { group: 'penrose', shape: 'thick', place: 'attach', mirror: 'ring', k: 5, size: 3, turn: 0, slider: 'mirrors', guides: true, safe: true };
  let latticeView = false;
  let ghosts = [];
  let active = false;
  let spinning = false;
  let flights = []; // { tile, from: {c, a}, to: {c, a}, target } while pieces settle

  function setFromJSON(data) {
    tiles = [];
    for (const x of Array.isArray(data?.tiles) ? data.tiles : []) {
      if (!shapeOk(x?.shape) || !Array.isArray(x.verts) || x.verts.length !== KALEIDO_SHAPES[x.shape].length) continue;
      if (!x.verts.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) continue;
      const idx = Array.isArray(x.idx) && x.idx.length === x.verts.length && x.idx.every((i) => i === null || Number.isInteger(i)) ? x.idx : x.verts.map(() => null);
      tiles.push({ shape: x.shape, verts: x.verts.map((p) => [...p]), material: typeof x.material === 'string' ? x.material : 'base', idx });
    }
  }
  const toJSON = () => ({ tiles: tiles.map((x) => ({ shape: x.shape, verts: x.verts.map(([a, b]) => [+a.toFixed(9), +b.toFixed(9)]), material: x.material, idx: x.idx })) });
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data) {
      setFromJSON(data);
      const v = data.view ?? {};
      if (KALEIDO_GROUPS.some((g) => g.id === v.group)) view.group = v.group;
      if (shapeOk(v.shape)) view.shape = v.shape;
      if (['attach', 'loose'].includes(v.place)) view.place = v.place;
      if (MIRROR_MODES.includes(v.mirror)) view.mirror = v.mirror;
      if (Number.isInteger(v.k) && v.k >= RING_MIN && v.k <= RING_MAX) view.k = v.k;
      if (Number.isInteger(v.size) && v.size >= SIZE_MIN && v.size <= SIZE_MAX) view.size = v.size;
      if (Number.isFinite(v.turn)) view.turn = v.turn;
      if (v.guides === false) view.guides = false;
      if (v.safe === false) view.safe = false;
    }
  } catch { /* corrupt or blocked storage: start empty */ }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON(), view })); } catch { /* best-effort */ }
  }

  // ---- frames ----
  // The build turns against the mirrors: view = rot(build, turn).
  const toView = (p) => rotatePoint(p, view.turn);
  const toBuild = (p) => rotatePoint(p, -view.turn);
  const D = () => domain(view.mirror, view.k, view.size);

  // ---- settling (Loose, Shake) ----
  // Every free spot the piece fits: across an edge of a settled piece,
  // not overlapping any. Scored by distance from where it fell (so it
  // lands in the spot whose Voronoi cell it's in), less a bonus beside a
  // partner; spots on the visible side of the mirrors first.
  function settleSpot(shape, from, settled) {
    if (!settled.length) return firstSpot(shape);
    const Dv = D();
    let best = null;
    for (const x of settled) {
      const c = centroid(x.verts);
      if (Math.hypot(c[0] - from[0], c[1] - from[1]) > 12 && best) continue;
      for (let i = 0; i < x.verts.length; i++) {
        for (const spot of spotsAcross(shape, x, i, 0.5, settled)) {
          const cc = centroid(spot.verts);
          let score = Math.hypot(cc[0] - from[0], cc[1] - from[1]);
          if (partners(shape, x.shape)) score -= 1; else if (shape === x.shape) score -= 0.3;
          if (!contains(Dv, toView(cc))) score += 50;
          if (!best || score < best.score) best = { ...spot, score };
        }
      }
    }
    return best;
  }
  // The first piece sits on the mirror line from the centre.
  function firstSpot(shape) {
    const verts = firstTile(shape);
    return { verts, idx: firstIndices(verts) };
  }
  // Where `shape` fits across edge i of tile x: no overlap, and Safe
  // (Penrose's rule) for the rhombi while Safe is on.
  function spotsAcross(shape, x, i, t, others) {
    const n = x.verts.length;
    return candidatesAcross(shape, x, i, t).map((verts) => ({ verts, idx: indicesFrom(verts, x.idx[(i + 1) % n], x.idx[i]) })).filter((spot) => {
      const cc = centroid(spot.verts);
      if (others.some((y) => { const yc = centroid(y.verts); return Math.hypot(yc[0] - cc[0], yc[1] - cc[1]) < 2.2 && overlaps(spot.verts, y.verts); })) return false;
      return !(view.safe && PENROSE_SHAPES.includes(shape)) || safeWith(spot, others);
    });
  }
  // Safe: corners in 1…4, and the same index as any piece already
  // meeting at that corner.
  function safeWith(spot, others) {
    if (!indicesSafe(spot.idx)) return false;
    return spot.verts.every((p, k) => spot.idx[k] === null || others.every((y) => y.verts.every((q, j) => y.idx[j] === null || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6 || y.idx[j] === spot.idx[k])));
  }
  // Lattice View: every free spot the chosen piece fits, as ghosts.
  function computeGhosts() {
    ghosts = [];
    if (!latticeView || !tiles.length) return;
    const seen = new Set();
    for (const x of tiles) {
      for (let i = 0; i < x.verts.length; i++) {
        for (const spot of spotsAcross(view.shape, x, i, 0.5, tiles)) {
          const c = centroid(spot.verts);
          const key = `${Math.round(c[0] * 1e5)},${Math.round(c[1] * 1e5)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          ghosts.push(spot);
        }
      }
    }
  }
  // A rigid move from one pose of a shape to another: which corner
  // matches which (only those keeping the angle sequence), and the
  // smallest turn.
  function poseMove(shape, fromVerts, toVerts) {
    const angles = KALEIDO_SHAPES[shape];
    const n = angles.length;
    const cf = centroid(fromVerts), ct = centroid(toVerts);
    const dir = (poly, i) => Math.atan2(poly[(i + 1) % n][1] - poly[i][1], poly[(i + 1) % n][0] - poly[i][0]);
    let best = null;
    for (let j = 0; j < n; j++) {
      if (!angles.every((a, i) => a === angles[(i + j) % n])) continue;
      let d = dir(toVerts, j) - dir(fromVerts, 0);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { d };
    }
    return { cf, ct, turn: best.d };
  }
  const posed = (verts, m, u) => {
    const cf = m.cf, a = m.turn * u;
    const c = [cf[0] + (m.ct[0] - cf[0]) * u, cf[1] + (m.ct[1] - cf[1]) * u];
    return verts.map((p) => { const r = rotatePoint([p[0] - cf[0], p[1] - cf[1]], a); return [r[0] + c[0], r[1] + c[1]]; });
  };
  let flightStart = 0;
  function launch(list) {
    // list: [{ tile, fromVerts }] settling one after another into the
    // spots left by those before.
    const settled = tiles.filter((x) => !list.some((f) => f.tile === x));
    flights = [];
    for (const f of list) {
      const target = settleSpot(f.tile.shape, centroid(f.fromVerts), settled);
      if (!target) { tiles = tiles.filter((x) => x !== f.tile); continue; }
      f.tile.verts = target.verts;
      f.tile.idx = target.idx;
      settled.push(f.tile);
      flights.push({ tile: f.tile, fromVerts: f.fromVerts, move: poseMove(f.tile.shape, f.fromVerts, target.verts) });
    }
    flightStart = performance.now();
    commit();
    tick();
  }
  function shake() {
    if (tiles.length < 2) return;
    const order = [...tiles].sort(() => Math.random() - 0.5);
    // Everything tumbles a little from where it was, then settles again
    // in a new order.
    launch(order.map((x) => {
      const c = centroid(x.verts);
      const jitter = [c[0] + (Math.random() - 0.5) * 2.5, c[1] + (Math.random() - 0.5) * 2.5];
      return { tile: x, fromVerts: looseTile(x.shape, jitter, Math.random() * Math.PI * 2) };
    }));
  }

  // ---- drawing ----
  const pieceMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const firstMaterial = new THREE.MeshBasicMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const guideMaterial = new THREE.LineBasicMaterial({ color: GUIDE_COLOR, transparent: true, opacity: 0.45 });
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -0.01;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  let pieces = null, guides = null, first = null, ghostMesh = null, ghostLines = null;
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const ghostLineMaterial = new THREE.LineBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.8 });
  const dispose = (o) => { if (o) { group.remove(o); o.geometry.dispose(); } };
  const tmpColor = new THREE.Color();

  function draw(now = performance.now()) {
    dispose(pieces); dispose(guides); dispose(first); dispose(ghostMesh); dispose(ghostLines);
    pieces = guides = first = ghostMesh = ghostLines = null;
    if (!active) return;
    const Dv = D();
    const u = flights.length ? Math.min(1, (now - flightStart) / SETTLE_MS) : 1;
    const ease = u * u * (3 - 2 * u);
    const flying = new Map(flights.map((f) => [f.tile, f]));
    const shown = tiles.map((x) => {
      const f = flying.get(x);
      return { tile: x, verts: (f ? posed(f.fromVerts, f.move, ease) : x.verts).map(toView), lift: f ? 0.004 : 0 };
    });

    // The fundamental piece: every tile cut to the domain, plus its own
    // edges (never the cut: a mirror shows no seam) as thin strips.
    const pos = [], col = [];
    const push = (p, z, c) => { pos.push(p[0], p[1], z); col.push(c.r, c.g, c.b); };
    shown.forEach(({ tile, verts, lift }, idx) => {
      const z = 0.0005 * idx / Math.max(1, shown.length) + lift;
      const cut = clipPolygon(verts, Dv);
      if (!cut.length) return;
      colorFor(tile, tmpColor);
      for (let i = 1; i < cut.length - 1; i++) { push(cut[0], z, tmpColor); push(cut[i], z, tmpColor); push(cut[i + 1], z, tmpColor); }
      tmpColor.setHex(OUTLINE_COLOR);
      verts.forEach((a, i) => {
        const seg = clipSegment(a, verts[(i + 1) % verts.length], Dv);
        if (!seg) return;
        const [p, q] = seg;
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 1e-9) return;
        const nx = (-(q[1] - p[1]) / L) * OUTLINE_WIDTH / 2, ny = ((q[0] - p[0]) / L) * OUTLINE_WIDTH / 2;
        const quad = [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]];
        const zl = z + 0.001;
        for (const i3 of [0, 1, 2, 0, 2, 3]) push(quad[i3], zl, tmpColor);
      });
    });
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const maps = mapsFor(40);
      pieces = new THREE.InstancedMesh(g, pieceMaterial, maps.length);
      pieces.frustumCulled = false;
      const m = new THREE.Matrix4();
      maps.forEach(([a, b, c, d, e, f], i) => { m.set(a, b, 0, e, c, d, 0, f, 0, 0, 1, 0, 0, 0, 0, 1); pieces.setMatrixAt(i, m); });
      pieces.instanceMatrix.needsUpdate = true;
      group.add(pieces);
    }

    // Guides: the mirror lines, and the whole (uncut) build outlined.
    if (view.guides) {
      const lp = [];
      const R = 60;
      if (view.mirror === 'ring') {
        for (let j = 0; j < view.k; j++) {
          const a = (Math.PI * j) / view.k;
          lp.push(-R * Math.cos(a), -R * Math.sin(a), 0.003, R * Math.cos(a), R * Math.sin(a), 0.003);
        }
      } else {
        const maps = mapsFor(24);
        for (const mp of maps) Dv.forEach((p, i) => { const a = applyMap(mp, p), b = applyMap(mp, Dv[(i + 1) % 3]); lp.push(a[0], a[1], 0.003, b[0], b[1], 0.003); });
      }
      for (const { verts } of shown) verts.forEach((p, i) => { const q = verts[(i + 1) % verts.length]; lp.push(p[0], p[1], 0.003, q[0], q[1], 0.003); });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      guides = new THREE.LineSegments(lg, guideMaterial);
      group.add(guides);
    }

    // Lattice View ghosts, whole (uncut) where they'd really go.
    if (ghosts.length) {
      const gp = [], lp = [];
      for (const { verts } of ghosts) {
        const v = verts.map(toView);
        for (let i = 1; i < v.length - 1; i++) gp.push(...v[0], 0.002, ...v[i], 0.002, ...v[i + 1], 0.002);
        v.forEach((p, i) => { const q = v[(i + 1) % v.length]; lp.push(p[0], p[1], 0.0025, q[0], q[1], 0.0025); });
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      ghostMesh = new THREE.Mesh(gg, ghostMaterial);
      ghostLines = new THREE.LineSegments(lg, ghostLineMaterial);
      group.add(ghostMesh, ghostLines);
    }

    // Empty: the cyan outline of the first piece, at the centre.
    if (!tiles.length) {
      const v = firstTile(view.shape).map(toView);
      const s = new THREE.Shape(v.map(([x, y]) => new THREE.Vector2(x, y)));
      first = new THREE.Mesh(new THREE.ShapeGeometry(s), firstMaterial);
      group.add(first);
    }
  }

  // Mirror images, cached per setting: at most MAX_COPIES (a small
  // triangle shrinks the radius they cover instead).
  const mapCache = new Map();
  function mapsFor(radius) {
    const key = `${view.mirror}|${view.k}|${view.size}|${radius}`;
    if (!mapCache.has(key)) {
      const r = view.mirror === 'ring' ? radius : Math.min(radius, Math.sqrt((MAX_COPIES * Math.abs(area(D()))) / Math.PI));
      mapCache.set(key, groupMaps(view.mirror, view.k, view.size, r));
    }
    return mapCache.get(key);
  }

  let raf = 0;
  let lastFrame = 0;
  function tick() {
    if (raf) return;
    lastFrame = performance.now();
    const step = (now) => {
      raf = 0;
      if (!active) return;
      if (spinning) { view.turn = (view.turn + ((now - lastFrame) / 1000) * SPIN_PER_SEC) % (2 * Math.PI); renderSlider(); }
      lastFrame = now;
      const settling = flights.length && now - flightStart < SETTLE_MS;
      draw(now);
      if (!settling && flights.length) { flights = []; draw(now); }
      if (settling || spinning) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---- building ----
  function commit() { save(); computeGhosts(); draw(); renderPanel(); onChange(); }
  const tileAt = (b) => [...tiles].reverse().find((x) => contains(x.verts, b));
  function handleTap(hit, mode) {
    if (!hit?.point) return false;
    // The tap in the build's own frame (group is scaled by `edge`),
    // folded back from whichever mirror image it hit.
    const raw = toBuild([hit.point.x / edge, hit.point.y / edge]);
    const v = fold(view.mirror, view.k, view.size, [hit.point.x / edge, hit.point.y / edge]);
    const b = toBuild(v);
    // A ghost is drawn where it really goes, so it's hit unfolded.
    const ghost = mode !== 'chisel' && !isPainting() && ghosts.find((g) => contains(g.verts, raw));
    if (ghost) { tiles.push({ shape: view.shape, verts: ghost.verts, idx: ghost.idx, material: getMaterial(view.shape) }); commit(); return true; }
    if (mode === 'chisel') {
      const x = tileAt(b);
      if (!x) return false;
      tiles = tiles.filter((y) => y !== x);
      commit();
      return true;
    }
    if (isPainting()) {
      const x = tileAt(b);
      const material = x && getMaterial(x.shape);
      if (!x || x.material === material) return false;
      x.material = material;
      commit();
      return true;
    }
    const material = getMaterial(view.shape);
    if (view.place === 'loose' || !tiles.length) {
      const tile = { shape: view.shape, verts: [], material };
      tiles.push(tile);
      const fell = view.place === 'loose' ? looseTile(view.shape, b, Math.atan2(b[1], b[0])) : firstTile(view.shape);
      launch([{ tile, fromVerts: fell }]);
      if (!tiles.includes(tile)) { showHudPrompt(t('kal.prompt.noFit', lang(), { piece: KALEIDO_SHAPE_LABELS[view.shape] }), 3000); return false; }
      return true;
    }
    const near = nearestEdge(tiles, b);
    if (!near) return false;
    const spot = spotsAcross(view.shape, near.tile, near.i, near.t, tiles)[0];
    if (spot) { tiles.push({ shape: view.shape, verts: spot.verts, idx: spot.idx, material }); commit(); return true; }
    showHudPrompt(t('kal.prompt.noFit', lang(), { piece: KALEIDO_SHAPE_LABELS[view.shape] }), 3000);
    return false;
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'worldkaleido-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row w4d-controls kal-shapes"></div>
    <div class="w4d-row w4d-controls kal-mirrors"></div>
    <div class="w4d-track" role="slider"><div class="w4d-ticks"></div><div class="w4d-thumb"></div></div>
    <div class="w4d-row w4d-options kal-options"></div>`;
  document.body.appendChild(panel);
  const shapesRow = panel.querySelector('.kal-shapes');
  const mirrorsRow = panel.querySelector('.kal-mirrors');
  const optionsRow = panel.querySelector('.kal-options');
  const track = panel.querySelector('.w4d-track');
  // Short, so the panel fits a phone: a triangle by its angle at the
  // centre (the full name is its tooltip).
  const MIRROR_LABELS = { ring: null, tri60: '△60°', tri45: '△45°', tri30: '△30°' };
  const MIRROR_TITLES = { tri60: '60-60-60', tri45: '45-45-90', tri30: '30-60-90' };
  const SHORT = { thick: 'Thick', thin: 'Thin' };
  // The slider runs -1 … +1: Mirrors maps it onto the count (Ring) or
  // the triangle's size, Turn onto -180° … +180°.
  const range = () => (view.mirror === 'ring' ? [RING_MIN, RING_MAX] : [SIZE_MIN, SIZE_MAX]);
  const toSlider = (n, [lo, hi]) => -1 + (2 * (n - lo)) / (hi - lo);
  const fromSlider = (s, [lo, hi]) => Math.round(lo + ((s + 1) / 2) * (hi - lo));
  const slider = createGearedSlider(track, {
    value: () => (view.slider === 'turn' ? Math.atan2(Math.sin(view.turn), Math.cos(view.turn)) / Math.PI : toSlider(view.mirror === 'ring' ? view.k : view.size, range())),
    setValue: (s) => {
      if (view.slider === 'turn') { view.turn = s * Math.PI; spinning = false; }
      else {
        const n = fromSlider(s, range());
        if (view.mirror === 'ring') { if (n === view.k) return; view.k = n; } else { if (n === view.size) return; view.size = n; }
      }
      renderSlider();
      draw();
    },
    limit: () => 1,
    perSweep: () => 2,
    detents: () => {
      if (view.slider === 'turn') return [-1, -0.5, 0, 0.5, 1].map((v) => ({ v, label: `${Math.round(v * 180)}°` }));
      const [lo, hi] = range();
      return Array.from({ length: hi - lo + 1 }, (_, i) => ({ v: toSlider(lo + i, [lo, hi]), label: String(lo + i) }));
    },
    snap: () => (view.slider === 'turn' ? 0.03 : 1),
    onEnd: () => { save(); renderPanel(); },
  });
  function renderSlider() { slider.render(); }
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    const btn = (attr, val, label, on, title = '') => `<button type="button" data-${attr}="${val}" class="${on ? 'active' : ''}"${title ? ` title="${title}"` : ''}>${label}</button>`;
    const grp = KALEIDO_GROUPS.find((g) => g.id === view.group);
    shapesRow.innerHTML = [
      `<select class="hull-select" data-select="group">${KALEIDO_GROUPS.map((g) => `<option value="${g.id}"${g.id === view.group ? ' selected' : ''}>${g.label}</option>`).join('')}</select>`,
      ...grp.shapes.map((s) => btn('shape', s, SHORT[s] ?? KALEIDO_SHAPE_LABELS[s], s === view.shape, KALEIDO_SHAPE_LABELS[s])),
    ].join('');
    mirrorsRow.innerHTML = [
      ...MIRROR_MODES.map((m) => btn('mirror', m, MIRROR_LABELS[m] ?? t('kal.ring', L), m === view.mirror, MIRROR_TITLES[m])),
      btn('slider', 'mirrors', view.mirror === 'ring' ? t('kal.mirrors', L, { n: view.k }) : t('kal.size', L, { n: view.size }), view.slider === 'mirrors'),
      btn('slider', 'turn', t('kal.turn', L), view.slider === 'turn'),
    ].join('');
    optionsRow.innerHTML = [
      btn('place', 'attach', t('kal.attach', L), view.place === 'attach'),
      btn('place', 'loose', t('kal.loose', L), view.place === 'loose'),
      btn('opt', 'shake', t('kal.shake', L), false),
      btn('opt', 'spin', t('kal.spin', L), spinning),
      btn('opt', 'guides', t('kal.guides', L), view.guides),
      btn('opt', 'safe', t('kal.safe', L), view.safe),
    ].join('');
    renderSlider();
  }
  shapesRow.addEventListener('change', (ev) => {
    const g = KALEIDO_GROUPS.find((x) => x.id === ev.target.value);
    if (!g) return;
    view.group = g.id;
    if (!g.shapes.includes(view.shape)) view.shape = g.shapes[0];
    save(); computeGhosts(); renderPanel(); draw();
  });
  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.shape && shapeOk(d.shape)) view.shape = d.shape;
    else if (d.mirror && MIRROR_MODES.includes(d.mirror)) view.mirror = d.mirror;
    else if (d.slider) view.slider = d.slider;
    else if (d.place) {
      view.place = d.place;
      showHudPrompt(t(d.place === 'loose' ? 'kal.prompt.loose' : 'kal.prompt.attach', lang()), 4000);
    } else if (d.opt === 'shake') shake();
    else if (d.opt === 'spin') { spinning = !spinning; if (spinning) tick(); }
    else if (d.opt === 'guides') view.guides = !view.guides;
    else if (d.opt === 'safe') { view.safe = !view.safe; if (view.safe) showHudPrompt(t('kal.prompt.safe', lang()), 4500); }
    save(); computeGhosts(); renderPanel(); draw();
  });
  let shownLang = lang();
  onSettingsChange((st) => { if (st.language !== shownLang) { shownLang = st.language; if (active) renderPanel(); } });

  return {
    group,
    meshes: () => pickTargets,
    handleTap,
    setActive(on) {
      if (on === active) return;
      active = on;
      group.visible = on;
      if (!on) { spinning = false; panel.classList.remove('visible'); }
      renderPanel();
      draw();
    },
    setLatticeView(on) { latticeView = on; computeGhosts(); if (active) draw(); },
    /** Colours changed (mode, Type list): redraw. */
    repaint() { if (active) draw(); },
    get isEmpty() { return tiles.length === 0; },
    clear() { tiles = []; flights = []; commit(); },
    snapshot: toJSON,
    restore(json) { flights = []; setFromJSON(json); save(); computeGhosts(); draw(); renderPanel(); onChange(); },
    toJSON,
    // For verify / tests: the fundamental-domain area actually covered.
    coveredArea: () => tiles.reduce((s, x) => s + area(clipPolygon(x.verts.map(toView), D())), 0),
  };
}
