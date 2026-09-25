// The 5D and 6D quasicrystal worlds, one factory for both, on the
// cut-and-project engine in geometry-extensions/quasicrystal.js
// (verify:quasicrystal):
//   6D: the icosahedral quasicrystal, prolate and oblate golden
//       rhombohedra (Ammann-Kramer) from Z^6.
//   5D: the decagonal quasicrystal, Penrose thick and thin rhombi from Z^5,
//       stacked into prism layers (height PRISM_HEIGHT).
// Each world owns its store, THREE group, slider panel and tap handling;
// render.js switches it on for its dimension and routes taps to it, as it
// does for 4D.
//
// Decisions this file implements (docs/PLAN-5D-6D.md, stages 2-3):
// - The tiling decides the shape: tapping a face adds the one tile the
//   tiling has across it. No Shape choice. In 5D a prism's top or bottom
//   adds the same rhombus on the next layer.
// - Pieces never move. Each is a face (n, I) of Z^d (plus a layer in 5D);
//   the slider changes which faces are in the slice, so pieces appear and
//   vanish.
// - ONE geared slider + a toggle: Phason 1 | Phason 2 | Phason 3 |
//   Approximant (Phason 3 hidden in 5D: it would leave the Penrose
//   tilings). Each phason keeps its own value, from -1 to +1 window widths
//   (one sweep of the track covers the range), click-stop at 0.
//   Approximant snaps to the Fibonacci stops 1/1 ... 13/8 and tau.
// - Empty slice: a cyan first-placement target on the tile nearest the
//   origin. Lattice View: every tile across a face of the build, as a
//   ghost; tap one to place it.
// - Window View (Build | Window toggle): the acceptance window in the
//   hidden dimensions, drawn at true size in the units the slider moves in
//   (6D: the rhombic triacontahedron; 5D: its slices at the corners'
//   heights, the four Penrose pentagons), with every corner of every
//   placed piece as a point: white inside, red outside. A piece shows
//   exactly when all its corners are inside (verify:quasicrystal), so a
//   point crossing the edge is pieces vanishing or appearing. With Lattice
//   View on, the ghost pieces' corners show too. No placing while it's up.
// - Summon (catalogue, quasicrystal-catalogue.js): a gold ghost appears
//   where the item genuinely occurs in the current tiling, nearest the
//   build; tap anywhere on the build to move it to the nearest occurrence
//   there, tap the ghost to place it. It lands as ordinary pieces (already
//   placed ones are kept), in one undo step. The slider only moves if the
//   item needs another approximant, sliding there in about half a second;
//   undoing or cancelling the summon slides it back. Info lists every
//   summon; tap one to slide back to its settings.
// - Polytopes land as one shadow piece at a tiling vertex: the projected
//   wireframe over translucent faces (5D: a 1-layer prism). They never
//   block tiles. Corners that are vertices of the current slice light up,
//   and Window View draws their hidden-dimension shadow too. Long-press
//   removes one; they undo and export like pieces.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { makeQuasicrystal, BASE_OFFSET, APPROXIMANT_STOPS, TIERS, PRISM_HEIGHT, tileKey } from '../geometry-extensions/quasicrystal.js';
import { createGearedSlider } from './geared-slider.js';
import { findOccurrence, polytopeShape } from '../geometry-extensions/quasicrystal-catalogue.js';

const PHASON_LIMIT = 1; // window widths
const PHASON_SNAP = 0.04;
const FIRST_COLOR = 0x00e5ff;
const SLOT_COLOR = 0x9de0ff;
const WINDOW_COLOR = 0x77ccff;
const CORNER_IN = 0xf2f8ff;
const CORNER_OUT = 0xff4d5e;
const SLOT_CORNER_OUT = 0x4a5563;
const CORNER_RADIUS = 0.045;
const GHOST_COLOR = 0xffc857;
const SLIDE_MS = 500;
const SUMMON_ROWS = 8;
const CONTROL_LABELS = { p1: 'Phason 1', p2: 'Phason 2', p3: 'Phason 3', approx: 'Approximant' };
// Approximant stops spread evenly across the track, tau at the right end.
const STOP_POS = APPROXIMANT_STOPS.map((_, i) => -1 + (2 * i) / (APPROXIMANT_STOPS.length - 1));
const stopLabel = (s) => (s ? `${s[0]}/${s[1]}` : 'τ');

const WORLDS = {
  '6d': {
    label: '6D',
    storageKey: 'rhombiverse-6d-world',
    name: 'Icosahedral quasicrystal (from Z⁶)',
    controls: ['p1', 'p2', 'p3', 'approx'],
    types: ['prolate', 'oblate'],
    layered: false,
  },
  '5d': {
    label: '5D',
    storageKey: 'rhombiverse-5d-world',
    name: 'Decagonal quasicrystal: Penrose layers (from Z⁵)',
    controls: ['p1', 'p2', 'approx'],
    types: ['thick', 'thin'],
    layered: true,
  },
};

export function createQuasicrystalWorld({ tier, scene, materialColor, getMaterial, onChange = () => {}, showHudPrompt = () => {}, focusOn = () => {} }) {
  const W = WORLDS[tier];
  const { d, k } = TIERS[tier];
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const tiles = new Map(); // key -> { n, I, layer?, material, summon? }
  // Summon record: { id, serial, name, settings, before } per summon
  // (settings = the slider at landing, before = the slider before the
  // summon moved it). Pieces carry their summon's id.
  let summons = [];
  // Polytope shadows: key -> { family, directions, v, layer?, material, summon }.
  const polys = new Map();
  const polyKey = (p) => `${p.family}|${p.directions.join('')}|${p.v.join(',')}${W.layered ? `|${p.layer}` : ''}`;
  let pending = null; // a summon in progress: { entry, tiles, layer, before }
  const view = { phason: [0, 0, 0], approx: APPROXIMANT_STOPS.length - 1, control: 'p1', mode: 'build' };
  let active = false;
  let skeleton = false;
  let pieceOpacity = 1; // below 1 in World View: Translucent
  let latticeView = false;
  let infoOpen = false;

  const engines = new Map();
  const engine = () => {
    if (!engines.has(view.approx)) engines.set(view.approx, makeQuasicrystal(tier, APPROXIMANT_STOPS[view.approx]));
    return engines.get(view.approx);
  };
  const offset = () => {
    const w = engine().windowWidth;
    return BASE_OFFSET[tier].map((b, i) => b + view.phason[i] * w);
  };
  const keyOf = (t) => tileKey(t.n, t.I, W.layered ? t.layer : undefined);
  const vertsOf = (t) => engine().tileVertices(t.n, t.I, t.layer ?? 0);
  const pieceOf = (t) => ({ n: t.n, I: t.I, ...(W.layered ? { layer: t.layer } : {}) });

  function load() {
    try {
      const raw = localStorage.getItem(W.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      setTilesFromJSON(data.tiles);
      setSummonsFromJSON(data.summons);
      setPolysFromJSON(data.polytopes);
      if (data.view) {
        if (Array.isArray(data.view.phason) && data.view.phason.length === 3) {
          view.phason = data.view.phason.map((x, i) => (W.controls.includes(`p${i + 1}`) ? Math.max(-PHASON_LIMIT, Math.min(PHASON_LIMIT, +x || 0)) : 0));
        }
        if (Number.isInteger(data.view.approx) && APPROXIMANT_STOPS[data.view.approx] !== undefined) view.approx = data.view.approx;
        if (W.controls.includes(data.view.control)) view.control = data.view.control;
        if (data.view.mode === 'window') view.mode = 'window';
      }
    } catch { /* corrupt or blocked storage: start empty */ }
  }
  const tilesJSON = () => [...tiles.values()].map((t) => ({ ...pieceOf(t), material: t.material, ...(t.summon ? { summon: t.summon } : {}) }));
  function setTilesFromJSON(list) {
    tiles.clear();
    for (const t of list ?? []) {
      if (!Array.isArray(t.n) || t.n.length !== d || !t.n.every(Number.isInteger)) continue;
      if (!Array.isArray(t.I) || t.I.length !== k || !t.I.every((i) => Number.isInteger(i) && i >= 0 && i < d)) continue;
      if (W.layered && !Number.isInteger(t.layer)) continue;
      const I = [...t.I].sort((a, b) => a - b);
      if (new Set(I).size !== k) continue;
      const tile = { ...pieceOf({ ...t, I }), material: t.material, ...(Number.isInteger(t.summon) ? { summon: t.summon } : {}) };
      tiles.set(keyOf(tile), tile);
    }
  }
  const settingsJSON = (x) => ({ phason: x.phason.map((v) => Math.max(-PHASON_LIMIT, Math.min(PHASON_LIMIT, +v || 0))), approx: APPROXIMANT_STOPS[x.approx] !== undefined ? x.approx : APPROXIMANT_STOPS.length - 1 });
  function setSummonsFromJSON(list) {
    summons = (Array.isArray(list) ? list : [])
      .filter((x) => Number.isInteger(x?.id) && Number.isInteger(x.serial) && x.settings && x.before)
      .map((x) => ({ id: x.id, serial: x.serial, name: String(x.name ?? ''), settings: settingsJSON(x.settings), before: settingsJSON(x.before) }));
  }
  const polysJSON = () => [...polys.values()].map((p) => ({ ...p }));
  function setPolysFromJSON(list) {
    polys.clear();
    for (const p of Array.isArray(list) ? list : []) {
      if (!['orthoplex', 'demicube', 'simplex'].includes(p?.family)) continue;
      if (!Array.isArray(p.v) || p.v.length !== d || !p.v.every(Number.isInteger)) continue;
      if (!Array.isArray(p.directions) || p.directions.length < 3 || !p.directions.every((i) => Number.isInteger(i) && i >= 0 && i < d)) continue;
      if (W.layered && !Number.isInteger(p.layer)) continue;
      const poly = { family: p.family, directions: p.directions, v: p.v, ...(W.layered ? { layer: p.layer } : {}), material: p.material, ...(Number.isInteger(p.summon) ? { summon: p.summon } : {}) };
      polys.set(polyKey(poly), poly);
    }
  }
  function save() {
    try {
      localStorage.setItem(W.storageKey, JSON.stringify({ version: 1, tiles: tilesJSON(), summons, polytopes: polysJSON(), view }));
    } catch { /* best-effort */ }
  }
  load();

  const visibleTiles = () => {
    const e = engine(), off = offset();
    return [...tiles.values()].filter((t) => e.isTile(t.n, t.I, off));
  };
  // The tile across face f of t (numbered as engine.faceAtPoint): 6D, and a
  // 5D prism's sides, go through the tiling; a prism's bottom (4) and top
  // (5) reach the same rhombus on the next layer.
  function across(t, f) {
    if (W.layered && f >= 4) return { n: t.n, I: t.I, layer: t.layer + (f === 5 ? 1 : -1) };
    const e = engine();
    const u = e.neighbourAcross(t.n, t.I, e.tileFaces(t.n, t.I)[f], offset());
    return u && pieceOf({ ...u, layer: t.layer });
  }
  const faceCount = 6; // a rhombohedron or a rhombic prism
  // Open slots: every tile across a face of a visible piece that isn't
  // placed yet.
  function openSlots(visible) {
    const out = new Map();
    for (const t of visible) {
      for (let f = 0; f < faceCount; f++) {
        const u = across(t, f);
        if (u && !tiles.has(keyOf(u))) out.set(keyOf(u), u);
      }
    }
    return [...out.values()];
  }

  // Every lattice point at a corner of these pieces, once each (5D: a
  // prism's corners are its rhombus's, on every layer).
  function cornersOf(list) {
    const out = new Map();
    for (const t of list) {
      for (let mask = 0; mask < 1 << k; mask++) {
        const m = t.n.map((x, l) => x + (t.I.some((i, b) => i === l && mask & (1 << b)) ? 1 : 0));
        out.set(m.join(','), m);
      }
    }
    return [...out.values()];
  }
  // A corner's point in the window's frame: offset - perp(m).
  const windowPoint = (m) => { const off = offset(); return engine().perpOf(m).map((x, i) => off[i] - x); };
  // 6D perp axes go straight to x, y, z. 5D: the Penrose plane's two perp
  // axes to x and z, the diagonal up, matching the build's layout.
  const toScene = (y) => (W.layered ? [y[0], y[2], y[1]] : y);

  // ---- summon ----
  const settingsNow = () => ({ phason: [...view.phason], approx: view.approx });
  const sameSettings = (a, b) => a.approx === b.approx && a.phason.every((x, i) => Math.abs(x - b.phason[i]) < 1e-9);
  // Slide the slider to `target` over SLIDE_MS (phasons glide; the
  // approximant changes at the start, since its stops are discrete).
  let slideFrame = 0;
  function slideTo(target, done = () => {}) {
    cancelAnimationFrame(slideFrame);
    const from = settingsNow();
    view.approx = target.approx;
    const t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / SLIDE_MS);
      const ease = u * u * (3 - 2 * u);
      view.phason = from.phason.map((x, i) => x + (target.phason[i] - x) * ease);
      rebuild();
      if (u < 1) { slideFrame = requestAnimationFrame(step); return; }
      save();
      done();
    };
    slideFrame = requestAnimationFrame(step);
  }
  // A physical point in the build's frame -> the engine's par space.
  const toPar = (p) => (W.layered ? [p[0], p[2]] : p);
  const buildCentre = () => {
    const e = engine();
    const vis = visibleTiles();
    if (!vis.length) return toPar([0, 0, 0]);
    const cs = vis.map((t) => e.parCentre(t.n, t.I));
    return cs[0].map((_, j) => cs.reduce((acc, c) => acc + c[j], 0) / cs.length);
  };
  // Big patches take a second or so to find: say so first, and let the
  // prompt paint before the search runs.
  function locateSoon(near, layer, after = () => {}) {
    showHudPrompt(`Finding ${pending.entry.name}…`, 2500);
    setTimeout(() => { if (pending) { locate(near, layer); after(); } }, 50);
  }
  function locate(near, layer) {
    const occ = findOccurrence(engine(), offset(), pending.entry, near);
    if (!occ) { showHudPrompt(`${pending.entry.name} doesn't occur near there. Tap somewhere else.`, 3500); return; }
    pending.tiles = occ.tiles ?? [];
    pending.anchor = occ.anchor ?? null;
    pending.layer = layer;
    rebuild();
    // The nearest occurrence can be off screen (decagons are rare): bring
    // the camera round to it.
    const h = (pending.entry.layers ?? 1) / 2;
    focusOn(W.layered ? [occ.centre[0], layer + h, occ.centre[1]] : occ.centre);
  }
  function startSummon(entry) {
    if (!entry || entry.tier !== tier) return;
    const before = pending ? pending.before : settingsNow();
    pending = { entry, tiles: [], layer: 0, before };
    view.mode = 'build';
    const approx = entry.approximant ? APPROXIMANT_STOPS.findIndex((s) => s && s[0] === entry.approximant[0] && s[1] === entry.approximant[1]) : APPROXIMANT_STOPS.length - 1;
    const go = () => {
      const vis = visibleTiles();
      locateSoon(buildCentre(), vis.length ? Math.max(...vis.map((t) => t.layer ?? 0)) : 0, () => {
        if (pending?.tiles.length || pending?.anchor) showHudPrompt(`${entry.name}: tap the gold outline to place it, or tap the build to move it.`, 5000);
      });
    };
    if (approx !== view.approx) slideTo({ approx, phason: view.phason }, go);
    else go();
  }
  function cancelSummon() {
    const before = pending?.before;
    pending = null;
    if (before && !sameSettings(before, settingsNow())) slideTo(before);
    else rebuild();
  }
  function landSummon() {
    const id = summons.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const { entry } = pending;
    const material = getMaterial();
    let added = 0;
    if (pending.anchor) {
      const poly = { family: entry.family, directions: entry.directions, v: pending.anchor, ...(W.layered ? { layer: pending.layer } : {}), material, summon: id };
      if (!polys.has(polyKey(poly))) { polys.set(polyKey(poly), poly); added = 1; }
    }
    for (const t of pending.tiles) {
      for (let L = 0; L < (entry.layers ?? 1); L++) {
        const piece = pieceOf({ ...t, layer: pending.layer + L });
        const key = keyOf(piece);
        if (tiles.has(key)) continue;
        tiles.set(key, { ...piece, material, summon: id });
        added++;
      }
    }
    summons.push({ id, serial: entry.serial, name: entry.name, settings: settingsNow(), before: pending.before });
    pending = null;
    save(); rebuild(); onChange();
    showHudPrompt(`${entry.name} placed (${added} new piece${added === 1 ? '' : 's'}).`, 3000);
    return true;
  }

  // ---- info ----
  const info = document.createElement('div');
  info.id = `world${tier}-info`;
  info.className = 'qc-info';
  info.setAttribute('aria-live', 'polite');
  document.body.appendChild(info);
  const fmt = (x) => {
    const r = Math.round(x * 100) / 100;
    return (Object.is(r, -0) ? 0 : r).toString();
  };
  function renderInfo(visible) {
    const show = active && infoOpen;
    info.classList.toggle('visible', show);
    if (!show) return;
    const e = engine();
    const count = (list, type) => list.filter((t) => e.tileType(t.I) === type).length;
    const all = [...tiles.values()];
    const layers = new Set(all.map((t) => t.layer)).size;
    const rows = [
      ['World', W.name],
      ['Built', all.length ? `${W.types.map((ty) => `${count(all, ty)} ${ty}`).join(', ')}${W.layered ? ` on ${layers} layer${layers === 1 ? '' : 's'}` : ''}` : 'nothing yet'],
      ['In the slice', `${visible.length} shown, ${all.length - visible.length} hidden by the slice`],
      ['Phason', W.controls.filter((c) => c !== 'approx').map((c) => fmt(view.phason[Number(c[1]) - 1])).join(' · ')],
      ['Approximant', APPROXIMANT_STOPS[view.approx] ? `${stopLabel(APPROXIMANT_STOPS[view.approx])} (a periodic crystal)` : 'τ (the true quasicrystal)'],
    ];
    if (polys.size) rows.splice(2, 0, ['Polytopes', `${polys.size} shadow${polys.size === 1 ? '' : 's'}`]);
    const summoned = all.filter((t) => t.summon).length;
    if (summons.length) rows.splice(2, 0, ['Pieces', `${all.length - summoned} hand-placed, ${summoned} summoned`]);
    if (view.mode === 'window') {
      const corners = cornersOf(all);
      const inside = corners.filter((m) => e.isVertex(m, offset())).length;
      rows.push(['Window', corners.length ? `${inside} of ${corners.length} corners inside` : 'place a piece to see its corners']);
    }
    const settingsLabel = (x) => (APPROXIMANT_STOPS[x.approx] ? `${stopLabel(APPROXIMANT_STOPS[x.approx])}, ` : '')
      + `phason ${W.controls.filter((c) => c !== 'approx').map((c) => fmt(x.phason[Number(c[1]) - 1])).join(' · ')}`;
    // The most recent few, so the box never covers the scene.
    const recent = summons.slice(-SUMMON_ROWS);
    const summonRows = summons.length
      ? `<div><span class="w4d-info-k">Summoned</span> tap one to slide back to its settings${summons.length > recent.length ? ` (latest ${recent.length} of ${summons.length})` : ''}</div>${recent.map((x) =>
        `<button type="button" class="qc-summon-row" data-summon="${x.id}">#${x.serial} ${x.name} <span class="qc-summon-set">${settingsLabel(x.settings)}</span></button>`).join('')}`
      : '';
    info.innerHTML = rows.map(([key, v]) => `<div><span class="w4d-info-k">${key}</span> ${v}</div>`).join('') + summonRows;
  }
  info.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-summon]');
    const x = b && summons.find((s) => s.id === Number(b.dataset.summon));
    if (x) slideTo(x.settings);
  });

  // ---- rendering ----
  const pickTargets = [];
  const geometries = new Map(); // tile key -> ConvexGeometry (pieces never move)
  const geometryOf = (t) => {
    const key = keyOf(t);
    if (!geometries.has(key)) geometries.set(key, new ConvexGeometry(vertsOf(t).map(([x, y, z]) => new THREE.Vector3(x, y, z))));
    return geometries.get(key);
  };
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0b0b12 });
  const skeletonEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x9de0ff });
  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.isLineSegments) child.geometry.dispose();
      if (child.material && !child.userData.sharedMaterial) child.material.dispose();
      if (child.isInstancedMesh) child.dispose();
    }
    for (const g of windowGeometries.splice(0)) g.dispose();
    pickTargets.length = 0;
  }
  function addTile(t, { color, opacity = 1, qc, lineMaterial = edgeMaterial }) {
    const geometry = geometryOf(t);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
    mesh.userData = { qc, tile: pieceOf(t) };
    mesh.visible = !skeleton || opacity < 1;
    group.add(mesh);
    pickTargets.push(mesh);
    const lineMat = skeleton ? skeletonEdgeMaterial : lineMaterial;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMat);
    lines.userData.sharedMaterial = lineMat === edgeMaterial || lineMat === skeletonEdgeMaterial;
    group.add(lines);
  }

  // Window View: the window plus the corner points.
  function drawWindow(visible) {
    const e = engine();
    const fill = new THREE.MeshBasicMaterial({ color: WINDOW_COLOR, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
    const edges = new THREE.LineBasicMaterial({ color: WINDOW_COLOR });
    const addWindowPiece = (geometry) => {
      group.add(new THREE.Mesh(geometry, fill));
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edges));
      windowGeometries.push(geometry);
    };
    const built = cornersOf([...tiles.values()]);
    const builtKeys = new Set(built.map((m) => m.join(',')));
    const slots = latticeView ? cornersOf(openSlots(visible)).filter((m) => !builtKeys.has(m.join(','))) : [];
    if (!W.layered) {
      addWindowPiece(new ConvexGeometry(e.windowVertices().map((v) => new THREE.Vector3(...v))));
    } else {
      // One slice per height the corners sit at (four at tau).
      const heights = new Map();
      for (const m of [...built, ...slots]) { const h = windowPoint(m)[2]; heights.set(h.toFixed(6), h); }
      if (!heights.size) heights.set('0', offset()[2]);
      for (const h of heights.values()) {
        const poly = e.windowSlice(h);
        if (poly.length < 3) continue;
        const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(u, v)));
        // ShapeGeometry lies in x/y; turn it into the x/z plane at height h.
        const g = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2).translate(0, h, 0);
        addWindowPiece(g);
      }
    }
    // Polytopes: their hidden-dimension shadow, same edges.
    const polyCorners = [];
    for (const p of polys.values()) {
      const { verts, edges } = polytopeShape(d, p.family, p.directions);
      const corners = verts.map((o) => o.map((x, i) => x + p.v[i]));
      const segs = edges.flatMap(([a, b]) => [corners[a], corners[b]]).map((m) => new THREE.Vector3(...toScene(windowPoint(m))));
      const g = new THREE.BufferGeometry().setFromPoints(segs);
      windowGeometries.push(g);
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: materialColor(p.material) })));
      polyCorners.push(...corners);
    }
    const points = [
      ...built.map((m) => ({ m, color: e.isVertex(m, offset()) ? CORNER_IN : CORNER_OUT })),
      ...polyCorners.map((m) => ({ m, color: e.isVertex(m, offset()) ? CORNER_IN : CORNER_OUT })),
      ...slots.map((m) => ({ m, color: e.isVertex(m, offset()) ? SLOT_COLOR : SLOT_CORNER_OUT })),
    ];
    if (!points.length) return;
    const dots = new THREE.InstancedMesh(cornerGeometry, new THREE.MeshBasicMaterial(), points.length);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    points.forEach(({ m, color: c }, i) => {
      dots.setMatrixAt(i, matrix.makeTranslation(...toScene(windowPoint(m))));
      dots.setColorAt(i, color.setHex(c));
    });
    group.add(dots);
  }
  const cornerGeometry = new THREE.SphereGeometry(CORNER_RADIUS, 12, 8);
  const windowGeometries = [];

  // A polytope's shadow: its corners (lattice points) in the build's
  // frame, and its edges. 5D: the flat shadow as a 1-layer prism.
  function polyGeometry(p) {
    const e = engine();
    const { verts, edges } = polytopeShape(d, p.family, p.directions);
    const corners = verts.map((o) => o.map((x, i) => x + p.v[i]));
    const at = (m, y) => { const q = e.parOf(m); return W.layered ? [q[0], y, q[1]] : q; };
    const base = corners.map((m) => at(m, (p.layer ?? 0) * PRISM_HEIGHT));
    const pts = W.layered ? [...base, ...corners.map((m) => at(m, ((p.layer ?? 0) + 1) * PRISM_HEIGHT))] : base;
    const segs = [];
    for (const [a, b] of edges) {
      segs.push(pts[a], pts[b]);
      if (W.layered) segs.push(pts[a + corners.length], pts[b + corners.length]);
    }
    if (W.layered) corners.forEach((_, i) => segs.push(pts[i], pts[i + corners.length]));
    return { corners, pts, base, segs };
  }
  function addPoly(p, { color, opacity, qc, lineColor, litCorners = true }) {
    const { corners, pts, base, segs } = polyGeometry(p);
    const mesh = new THREE.Mesh(new ConvexGeometry(pts.map((q) => new THREE.Vector3(...q))), new THREE.MeshStandardMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.userData = { qc, poly: p };
    mesh.visible = !skeleton || qc === 'ghost';
    group.add(mesh);
    windowGeometries.push(mesh.geometry);
    pickTargets.push(mesh);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(segs.map((q) => new THREE.Vector3(...q)));
    group.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: lineColor })));
    if (!litCorners) return;
    // Corners that are vertices of the current slice light up.
    const e = engine(), off = offset();
    const dots = new THREE.InstancedMesh(cornerGeometry, new THREE.MeshBasicMaterial(), corners.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    corners.forEach((m, i) => {
      dots.setMatrixAt(i, m4.makeTranslation(...base[i]));
      dots.setColorAt(i, c.setHex(e.isVertex(m, off) ? CORNER_IN : SLOT_CORNER_OUT));
    });
    group.add(dots);
  }

  function rebuild() {
    const visible = active ? visibleTiles() : [];
    renderInfo(visible);
    clearGroup();
    if (!active) return;
    if (view.mode === 'window') {
      drawWindow(visible);
      renderPanel();
      return;
    }
    for (const t of visible) addTile(t, { color: materialColor(t.material), opacity: pieceOpacity, qc: 'tile' });
    for (const p of polys.values()) {
      const color = materialColor(p.material);
      addPoly(p, { color, opacity: 0.22, qc: 'polytope', lineColor: color });
    }
    if (pending?.anchor) {
      addPoly({ family: pending.entry.family, directions: pending.entry.directions, v: pending.anchor, layer: pending.layer }, { color: GHOST_COLOR, opacity: 0.3, qc: 'ghost', lineColor: GHOST_COLOR, litCorners: false });
    }
    if (pending?.tiles.length) {
      const lineMaterial = new THREE.LineBasicMaterial({ color: GHOST_COLOR });
      for (const t of pending.tiles) for (let L = 0; L < (pending.entry.layers ?? 1); L++) {
        addTile(pieceOf({ ...t, layer: pending.layer + L }), { color: GHOST_COLOR, opacity: 0.3, qc: 'ghost', lineMaterial });
      }
    }
    if (!visible.length && !pending) {
      // Nothing of the build in this slice (or nothing built): one cyan
      // target on the tile nearest the origin (5D: on layer 0).
      const s = pieceOf({ ...engine().seedTile(offset()), layer: 0 });
      addTile(s, { color: FIRST_COLOR, opacity: 0.12, qc: 'slot', lineMaterial: new THREE.LineBasicMaterial({ color: FIRST_COLOR }) });
    } else if (latticeView) {
      const lineMaterial = new THREE.LineBasicMaterial({ color: SLOT_COLOR, transparent: true, opacity: 0.6 });
      for (const u of openSlots(visible)) addTile(u, { color: SLOT_COLOR, opacity: 0.12, qc: 'slot', lineMaterial });
    }
    renderPanel();
  }

  // ---- taps (core/build.js routes here while this world is active) ----
  function place(t) {
    const key = keyOf(t);
    if (tiles.has(key)) return false;
    tiles.set(key, { ...pieceOf(t), material: getMaterial() });
    save(); rebuild(); onChange();
    return true;
  }
  function handleTap(hit, mode) {
    const { qc, tile } = hit.object.userData;
    if (mode !== 'chisel' && pending) {
      // Summoning: the ghost places; anything else moves the ghost there.
      if (qc === 'ghost') return landSummon();
      const p = hit.point;
      locateSoon(toPar([p.x, p.y, p.z]), (tile ?? hit.object.userData.poly)?.layer ?? 0);
      return true;
    }
    if (qc === 'polytope') {
      if (mode !== 'chisel') { showHudPrompt('A polytope shadow: long-press to remove it. Turn the view to reach the pieces behind it.', 3500); return true; }
      polys.delete(polyKey(hit.object.userData.poly));
      save(); rebuild(); onChange();
      return true;
    }
    if (mode === 'chisel') {
      if (qc !== 'tile') return false;
      tiles.delete(keyOf(tile));
      save(); rebuild(); onChange();
      return true;
    }
    if (qc === 'slot') return place(tile);
    if (qc !== 'tile') return false;
    const p = hit.point;
    const u = across(tile, engine().faceAtPoint(tile.n, tile.I, [p.x, p.y, p.z], tile.layer ?? 0));
    return !!u && place(u);
  }

  // ---- panel: one geared slider + Phason modes | Approximant ----
  const panel = document.createElement('div');
  panel.id = `world${tier}-panel`;
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row w4d-controls"></div>
    <div class="w4d-track" role="slider" aria-label="${W.label} slider"><div class="w4d-ticks"></div><div class="w4d-thumb"></div></div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const controlsRow = panel.querySelector('.w4d-controls');
  const optionsRow = panel.querySelector('.w4d-options');
  const isApprox = () => view.control === 'approx';
  const phasonIndex = () => Number(view.control[1]) - 1;
  const slider = createGearedSlider(panel.querySelector('.w4d-track'), {
    value: () => (isApprox() ? STOP_POS[view.approx] : view.phason[phasonIndex()]),
    setValue: (v) => {
      if (isApprox()) {
        let best = 0;
        STOP_POS.forEach((p, i) => { if (Math.abs(p - v) < Math.abs(STOP_POS[best] - v)) best = i; });
        if (best === view.approx) return;
        view.approx = best;
      } else {
        view.phason[phasonIndex()] = v;
      }
      rebuild();
    },
    limit: () => PHASON_LIMIT,
    perSweep: () => 2 * PHASON_LIMIT,
    detents: () => (isApprox()
      ? APPROXIMANT_STOPS.map((s, i) => ({ v: STOP_POS[i], label: stopLabel(s) }))
      : [{ v: 0, label: '0' }]),
    snap: () => (isApprox() ? 0 : PHASON_SNAP),
    onEnd: save,
  });

  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    controlsRow.innerHTML = W.controls.map((c) => `<button type="button" data-control="${c}" class="${c === view.control ? 'active' : ''}">${CONTROL_LABELS[c]}</button>`).join('');
    const infoBtn = `<button type="button" data-opt="info" class="${infoOpen ? 'active' : ''}">Info</button>`;
    optionsRow.innerHTML = pending ? `<button type="button" data-opt="cancel">Cancel summon</button>${infoBtn}` : [
      `<button type="button" data-opt="mode" class="${view.mode === 'window' ? 'active' : ''}">${view.mode === 'window' ? 'Window' : 'Build'}</button>`,
      `<button type="button" data-opt="reset">Reset ${W.label}</button>`,
      infoBtn,
    ].join('');
    slider.render();
  }
  controlsRow.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-control]');
    if (!b) return;
    view.control = b.dataset.control;
    save(); renderPanel();
  });
  optionsRow.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-opt]');
    if (!b) return;
    if (b.dataset.opt === 'cancel') { cancelSummon(); return; }
    if (b.dataset.opt === 'info') infoOpen = !infoOpen;
    else if (b.dataset.opt === 'mode') { view.mode = view.mode === 'window' ? 'build' : 'window'; save(); }
    else if (b.dataset.opt === 'reset') { view.phason = [0, 0, 0]; view.approx = APPROXIMANT_STOPS.length - 1; save(); }
    rebuild();
  });

  return {
    group,
    meshes: () => (view.mode === 'window' ? [] : pickTargets),
    handleTap,
    setActive(on) {
      active = on;
      group.visible = on;
      if (!on) panel.classList.remove('visible');
      rebuild();
    },
    setSkeleton(on) { skeleton = on; rebuild(); },
    setTranslucent(opacity) { if (opacity !== pieceOpacity) { pieceOpacity = opacity; rebuild(); } },
    setLatticeView(on) { latticeView = on; rebuild(); },
    startSummon,
    get isEmpty() { return tiles.size === 0 && polys.size === 0; },
    clear() { tiles.clear(); polys.clear(); summons = []; pending = null; save(); rebuild(); onChange(); },
    // Undo (render.js's history): the pieces and the summon record, never
    // the slider -- except that undoing a summon slides back to where the
    // slider was before it.
    snapshot() { return { tiles: tilesJSON(), summons: summons.map((x) => ({ ...x })), polytopes: polysJSON() }; },
    restore(json) {
      const undone = summons.filter((x) => !(json?.summons ?? []).some((y) => y.id === x.id));
      setTilesFromJSON(Array.isArray(json) ? json : json?.tiles);
      setSummonsFromJSON(Array.isArray(json) ? [] : json?.summons);
      setPolysFromJSON(Array.isArray(json) ? [] : json?.polytopes);
      pending = null;
      save(); onChange();
      const back = undone[undone.length - 1]?.before;
      if (back && !sameSettings(back, settingsNow())) slideTo(back);
      else rebuild();
    },
  };
}
