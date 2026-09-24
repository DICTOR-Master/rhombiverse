// The 4D world (D4 first -- 2026-09-24 design; Z4 and A4 follow on the
// same machinery). Owns its own store, THREE group, on-screen slider
// panel and tap handling; render.js only switches it on for the 4D
// dimension and routes taps to it (core/build.js's world4d hook). All
// geometry comes from geometry-extensions/lattice-4d.js (verify:4d).
//
// Direct decisions this file implements:
// - Two views: Slice (default) -- the 3D cross-section at depth w -- and
//   Projection (parallel by default, perspective as an option).
// - ONE geared slider + a toggle: W-depth | XW | YW | ZW. Each rotation
//   plane keeps its own angle (fixed XW -> YW -> ZW order). Projection
//   view HIDES W-depth ("nothing unnecessary is shown"). Relative drag,
//   geared (a full sweep of the track = 45 degrees, or one w-layer), no
//   coasting, click-stops, Reset 4D back to the rest position.
// - Tap a visible face to place the neighbor across that facet; w-
//   parallel facets are reached by moving the slider to the next layer
//   and tapping an open slot, or by tapping a facet shadow in Projection.
// - Empty world: a cyan first-placement target (no auto-seed).
// - Lattice View (render.js's toggle): every open slot one step out;
//   Skeleton: edges only.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import {
  KINDS_4D, cellStructure, cellVertices4, neighborAcrossFacet, rotation4, matVec,
  sliceCell, project4, facetForSliceNormal, toDoubled, fromDoubled, cellKey4,
  cellAcrossFacet, throughGap, cornerPartner, dedupeSections, A4_FIRST, A4_REST_W,
} from '../geometry-extensions/lattice-4d.js';

// One store for every 4D kind (the worlds share one frame and coexist,
// like 3D's); the key name predates the tesseract joining it.
export const WORLD4D_STORAGE_KEY = 'rhombiverse-4d-d4-world';
const DEG = Math.PI / 180;
// Gearing (proportions proposed in design, user to confirm): a full
// sweep across the slider track turns 45 degrees, or moves one w unit.
const ANGLE_PER_SWEEP = 45 * DEG;
const W_PER_SWEEP = 1;
const ANGLE_LIMIT = 90 * DEG;
const W_LIMIT = 3;
const ANGLE_DETENTS = [-45 * DEG, 0, 45 * DEG];
const ANGLE_SNAP = 3 * DEG;
const W_SNAP = 0.06;
const FIRST_COLOR = 0x00e5ff;
const SLOT_COLOR = 0x9de0ff;

// First placement per kind: the cell whose slice shows at the rest
// position (w = 0): a tesseract on the origin (its slice is the unit
// cube), a 24-cell on the origin (its slice is the RD), a
// 16-cell on the deep hole just above (its slice is a facet tetrahedron).
// Hyper-pyrochlore's three kinds start from A4_FIRST (lattice-4d.js).
const FIRST_CENTER = { tesseract: [0, 0, 0, 0], cell24: [0, 0, 0, 0], cell16: [0.5, 0.5, 0.5, 0.5], ...A4_FIRST };
const isA4 = (k) => KINDS_4D[k]?.family === 'a4';
// Rest position (direct decisions): w = 0 (the FCC floor) for Tesseract
// and D4; the Pyrochlore slice for Hyper-pyrochlore.
const restW = (k) => (isA4(k) ? A4_REST_W : 0);
// Which piece wins when two cells show the identical section (a facet
// lying in the slice): 5-cells, then truncated, then bitruncated.
const SECTION_RANK = { a4cell5: 0, a4trunc: 1, a4bitrunc: 2 };
// Integer keys per kind: A4 kinds use their own exact 5D keys; Z4/D4 the
// doubled coordinates.
const keyInts = (k, c) => (KINDS_4D[k].key ? KINDS_4D[k].key(c) : toDoubled(c));
const fromKeyInts = (k, d) => (KINDS_4D[k].fromKey ? KINDS_4D[k].fromKey(d) : fromDoubled(d));
const keyOf = (k, c) => cellKey4(k, keyInts(k, c));

export function createWorld4D({ scene, materialColor, getMaterial, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const cells = new Map(); // key -> { kind, c, material }
  const view = { mode: 'slice', perspective: false, angles: { xw: 0, yw: 0, zw: 0 }, w: 0, control: 'w' };
  let kind = 'cell24';
  let active = false;
  let skeleton = false;
  let latticeView = false;

  function load() {
    try {
      const raw = localStorage.getItem(WORLD4D_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const c of data.cells ?? []) {
        if (!KINDS_4D[c.kind]) continue;
        const center = fromKeyInts(c.kind, c.d);
        if (!KINDS_4D[c.kind].isCenter(center)) continue;
        cells.set(cellKey4(c.kind, c.d), { kind: c.kind, c: center, material: c.material, added: !!c.added, removed: !!c.removed });
      }
      if (data.view) {
        Object.assign(view.angles, data.view.angles ?? {});
        if (typeof data.view.w === 'number') view.w = data.view.w;
        if (data.view.mode === 'projection') view.mode = 'projection';
        view.perspective = !!data.view.perspective;
        if (['w', 'xw', 'yw', 'zw'].includes(data.view.control)) view.control = data.view.control;
      }
    } catch { /* corrupt or blocked storage: start empty */ }
  }
  function save() {
    try {
      localStorage.setItem(WORLD4D_STORAGE_KEY, JSON.stringify({
        version: 1,
        cells: [...cells.values()].map((c) => ({ kind: c.kind, d: keyInts(c.kind, c.c), material: c.material, ...(c.added ? { added: true } : {}), ...(c.removed ? { removed: true } : {}) })),
        view: { angles: view.angles, w: view.w, mode: view.mode, perspective: view.perspective, control: view.control },
      }));
    } catch { /* best-effort */ }
  }
  load();

  // ---- what's in the world ----
  // Stored: Z4/D4 cells, placed truncated and bitruncated 5-cells, and
  // 5-cell entries -- `added` (placed on their own, Small-tet style) or
  // `removed` (a derived cap taken away; the marker stays, same rule as
  // Pyrochlore's Small tet).
  const entry = (k, c) => cells.get(keyOf(k, c));
  // Derived caps (direct decision, Pyrochlore-style): every 5-cell across a
  // placed truncated 5-cell's tetrahedral facet shows, unless removed.
  function capsOf(t) {
    const s = cellStructure('a4trunc', t.c);
    const out = [];
    s.facets.forEach((f, i) => {
      if (f.verts.length !== 4) return;
      const n = cellAcrossFacet('a4trunc', t.c, i);
      if (n) out.push(n.c);
    });
    return out;
  }
  function visibleCells() {
    const out = new Map();
    for (const [key, cell] of cells) {
      if (cell.kind === 'a4cell5') { if (cell.added) out.set(key, cell); continue; }
      out.set(key, cell);
    }
    for (const t of cells.values()) {
      if (t.kind !== 'a4trunc') continue;
      for (const c of capsOf(t)) {
        const key = keyOf('a4cell5', c);
        if (out.has(key) || cells.get(key)?.removed) continue;
        out.set(key, { kind: 'a4cell5', c, material: t.material, derived: true });
      }
    }
    return [...out.values()];
  }
  const isVisible = (k, c) => visibleCells().some((v) => v.kind === k && keyOf(k, v.c) === keyOf(k, c));

  // ---- rendering ----
  const pickTargets = [];
  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry?.dispose();
      if (child.material && !child.userData.sharedMaterial) child.material.dispose();
    }
    pickTargets.length = 0;
  }
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0b0b12 });
  const skeletonEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x9de0ff });
  const toVec3 = (pts) => pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));

  function addSolid(pts, { color, opacity = 1, userData, outline = true, pickable = true, lineMaterial = edgeMaterial }) {
    const geometry = new ConvexGeometry(toVec3(pts));
    const material = new THREE.MeshStandardMaterial({
      color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = userData;
    mesh.visible = !skeleton || opacity < 1;
    group.add(mesh);
    if (pickable) pickTargets.push(mesh);
    if (outline || skeleton) {
      const lineMat = skeleton ? skeletonEdgeMaterial : lineMaterial;
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMat);
      lines.userData.sharedMaterial = lineMat === edgeMaterial || lineMat === skeletonEdgeMaterial;
      group.add(lines);
    }
    return mesh;
  }

  // Projection view: every facet of the cell as its own translucent shadow
  // (so a tap knows which facet it hit), plus the cell's projected edges.
  function addProjectedCell(k, c, { color, opacity, userDataBase, pickable = true }) {
    const s = cellStructure(k, c);
    const R = rotation4(view.angles);
    const p3 = s.offsets.map((o) => project4(matVec(R, [c[0] + o[0], c[1] + o[1], c[2] + o[2], c[3] + o[3]]), view.perspective));
    s.facets.forEach((f, facetIndex) => {
      const pts = f.verts.map((i) => p3[i]);
      let geometry;
      try { geometry = new ConvexGeometry(toVec3(pts)); } catch { return; }
      if (!geometry.attributes.position || geometry.attributes.position.count === 0) return;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      mesh.userData = { ...userDataBase, facetIndex };
      mesh.visible = !skeleton;
      group.add(mesh);
      if (pickable) pickTargets.push(mesh);
    });
    const pos = [];
    for (const [i, j] of s.edges) pos.push(...p3[i], ...p3[j]);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(lineGeometry, skeleton ? skeletonEdgeMaterial : new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.55) }));
    lines.userData.sharedMaterial = skeleton;
    group.add(lines);
  }

  // Open slots ("a lattice always extends past where you have built"):
  // wherever a tap with the selected kind could place next.
  // Z4/D4: every same-kind neighbor across a facet. Hyper-pyrochlore
  // (direct decision, Pyrochlore-style): Truncated -> straight through
  // each bitruncated gap; Bitruncated -> the gaps next to placed
  // truncated cells; 5-cell -> the partner across every visible 5-cell's
  // corner, plus any removed cap.
  function openSlots(k) {
    const out = new Map();
    const add = (kk, c) => { const key = keyOf(kk, c); if (!out.has(key)) out.set(key, c); };
    if (!isA4(k)) {
      for (const cell of cells.values()) {
        if (cell.kind !== k) continue;
        cellStructure(k, cell.c).facets.forEach((_, i) => {
          const n = fromKeyInts(k, keyInts(k, neighborAcrossFacet(k, cell.c, i)));
          if (!entry(k, n)) add(k, n);
        });
      }
      return [...out.values()];
    }
    const truncs = [...cells.values()].filter((c) => c.kind === 'a4trunc');
    if (k === 'a4trunc' || k === 'a4bitrunc') {
      for (const t of truncs) {
        cellStructure('a4trunc', t.c).facets.forEach((f, i) => {
          if (f.verts.length !== 12) return;
          const gap = cellAcrossFacet('a4trunc', t.c, i);
          if (!gap) return;
          if (k === 'a4bitrunc') { if (!entry('a4bitrunc', gap.c)) add('a4bitrunc', gap.c); return; }
          const t2 = fromKeyInts('a4trunc', keyInts('a4trunc', throughGap(t.c, gap.c)));
          if (!entry('a4trunc', t2)) add('a4trunc', t2);
        });
      }
      return [...out.values()];
    }
    const vis = visibleCells().filter((v) => v.kind === 'a4cell5');
    const visKeys = new Set(vis.map((v) => keyOf('a4cell5', v.c)));
    for (const c5 of vis) {
      for (const v of cellVertices4('a4cell5', c5.c)) {
        const p = fromKeyInts('a4cell5', keyInts('a4cell5', cornerPartner(c5.c, v)));
        if (!visKeys.has(keyOf('a4cell5', p))) add('a4cell5', p);
      }
    }
    for (const cell of cells.values()) if (cell.kind === 'a4cell5' && cell.removed) add('a4cell5', cell.c);
    return [...out.values()];
  }

  function rebuild() {
    clearGroup();
    if (!active) return;
    const R = rotation4(view.angles);
    const visible = visibleCells();
    let slicedAny = false;
    if (view.mode === 'slice') {
      const items = [];
      for (const cell of visible) {
        const pts = sliceCell(cellVertices4(cell.kind, cell.c), cellStructure(cell.kind, cell.c).edges, R, view.w);
        if (pts) items.push({ pts, rank: SECTION_RANK[cell.kind] ?? 0, w: cell.c[3], cell });
      }
      for (const { pts, cell } of dedupeSections(items)) {
        slicedAny = true;
        addSolid(pts, { color: materialColor(cell.material), userData: { world4d: 'cell', kind: cell.kind, c: cell.c } });
      }
    } else {
      for (const cell of visible) addProjectedCell(cell.kind, cell.c, { color: materialColor(cell.material), opacity: 0.35, userDataBase: { world4d: 'cell', kind: cell.kind, c: cell.c } });
    }
    // Empty (for this kind's world): one cyan first-placement target.
    const worldEmpty = isA4(kind) ? !visible.some((c) => isA4(c.kind)) : !visible.some((c) => c.kind === kind);
    if (worldEmpty) {
      const c = FIRST_CENTER[kind];
      const userData = { world4d: 'slot', kind, c, first: true };
      if (view.mode === 'slice') {
        const pts = sliceCell(cellVertices4(kind, c), cellStructure(kind, c).edges, R, view.w);
        if (pts) addSolid(pts, { color: FIRST_COLOR, opacity: 0.12, userData, lineMaterial: new THREE.LineBasicMaterial({ color: FIRST_COLOR }) });
      } else {
        addProjectedCell(kind, c, { color: FIRST_COLOR, opacity: 0.12, userDataBase: userData });
      }
    } else if (view.mode === 'slice' && (latticeView || !slicedAny)) {
      // Open slots: always in Lattice View; otherwise only when the
      // current slice shows no placed cell (you've slid into an empty
      // layer), in cyan, so there's always something to tap.
      const color = latticeView && slicedAny ? SLOT_COLOR : FIRST_COLOR;
      for (const c of openSlots(kind)) {
        const pts = sliceCell(cellVertices4(kind, c), cellStructure(kind, c).edges, R, view.w);
        if (pts) addSolid(pts, { color, opacity: 0.12, userData: { world4d: 'slot', kind, c }, lineMaterial: new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }) });
      }
    } else if (view.mode === 'projection' && latticeView) {
      for (const c of openSlots(kind)) addProjectedCell(kind, c, { color: SLOT_COLOR, opacity: 0.06, userDataBase: { world4d: 'slot', kind, c } });
    }
    renderPanel();
  }

  // ---- taps (core/build.js routes here while 4D is active) ----
  // Z4/D4: only the selected kind (and its slots) take taps, so a 24-cell
  // never steals a tap meant for a 16-cell. Hyper-pyrochlore: every A4
  // cell takes taps in every A4 mode (a Truncated tap on a cap or a gap
  // still grows), per the rules in handleTap.
  function meshes() {
    return pickTargets.filter((m) => (isA4(kind) ? isA4(m.userData.kind) : m.userData.kind === kind));
  }
  function place(k, c, extra = {}) {
    const snapped = fromKeyInts(k, keyInts(k, c));
    if (!KINDS_4D[k].isCenter(snapped)) return false;
    const key = keyOf(k, snapped);
    const cur = cells.get(key);
    if (k === 'a4cell5') {
      if (isVisible('a4cell5', snapped)) return false;
      if (cur?.removed) cells.delete(key); // a removed cap comes back
      if (!isVisible('a4cell5', snapped)) cells.set(key, { kind: k, c: snapped, material: getMaterial(), added: true });
    } else {
      if (cur) return false;
      cells.set(key, { kind: k, c: snapped, material: getMaterial(), ...extra });
    }
    save(); rebuild(); onChange();
    return true;
  }
  function tappedFacet(hit, u) {
    if (u.facetIndex !== undefined) return u.facetIndex;
    const n = hit.face.normal;
    return facetForSliceNormal(u.kind, u.c, rotation4(view.angles), view.w, [n.x, n.y, n.z]);
  }
  // The tapped point back in the 4D world frame (slice: the rotated-frame
  // point at depth w, turned back; projection: nearest projected corner).
  function nearestCorner(hit, u) {
    const R = rotation4(view.angles);
    const verts = cellVertices4(u.kind, u.c);
    const p = [hit.point.x, hit.point.y, hit.point.z];
    let best = null, bestD = Infinity;
    for (const v of verts) {
      const q = view.mode === 'slice' ? matVec(R, v) : project4(matVec(R, v), view.perspective);
      const d = view.mode === 'slice'
        ? Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2], q[3] - view.w)
        : Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }
  function handleTap(hit, mode) {
    const u = hit.object.userData;
    if (mode === 'chisel') {
      if (u.world4d !== 'cell') return false;
      const key = keyOf(u.kind, u.c);
      if (u.kind === 'a4cell5') {
        // A cap stays gone (marker) if a placed truncated 5-cell derives it.
        const derived = [...cells.values()].some((t) => t.kind === 'a4trunc' && capsOf(t).some((c) => keyOf('a4cell5', c) === key));
        cells.delete(key);
        if (derived) cells.set(key, { kind: 'a4cell5', c: u.c, removed: true });
      } else {
        cells.delete(key);
      }
      save(); rebuild(); onChange();
      return true;
    }
    if (u.world4d === 'slot') return place(u.kind, u.c);
    if (u.world4d !== 'cell') return false;
    if (!isA4(kind)) {
      const facet = tappedFacet(hit, u);
      return facet >= 0 && place(u.kind, neighborAcrossFacet(u.kind, u.c, facet));
    }
    // Hyper-pyrochlore (direct decision, Pyrochlore-style growth).
    if (kind === 'a4cell5' && u.kind === 'a4cell5') {
      const corner = nearestCorner(hit, u);
      return !!corner && place('a4cell5', cornerPartner(u.c, corner));
    }
    const facet = tappedFacet(hit, u);
    if (facet < 0) return false;
    const across = cellAcrossFacet(u.kind, u.c, facet);
    if (!across) return false;
    const facetSize = cellStructure(u.kind, u.c).facets[facet].verts.length;
    if (u.kind === 'a4trunc' && facetSize === 4) return across.kind === 'a4cell5' && (kind === 'a4trunc' || kind === 'a4cell5') && place('a4cell5', across.c); // bare cap facet: its cap back
    if (kind === 'a4trunc') {
      if (u.kind === 'a4trunc') return across.kind === 'a4bitrunc' && place('a4trunc', throughGap(u.c, across.c));
      return across.kind === 'a4trunc' && place('a4trunc', across.c);
    }
    if (kind === 'a4bitrunc') return u.kind === 'a4trunc' && across.kind === 'a4bitrunc' && place('a4bitrunc', across.c);
    return false;
  }

  // ---- panel: one geared slider + W-depth|XW|YW|ZW toggle ----
  const panel = document.createElement('div');
  panel.id = 'world4d-panel';
  panel.innerHTML = `
    <div class="w4d-row w4d-controls"></div>
    <div class="w4d-track" role="slider" aria-label="4D slider"><div class="w4d-ticks"></div><div class="w4d-thumb"></div></div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const controlsRow = panel.querySelector('.w4d-controls');
  const optionsRow = panel.querySelector('.w4d-options');
  const track = panel.querySelector('.w4d-track');
  const thumb = panel.querySelector('.w4d-thumb');
  const ticks = panel.querySelector('.w4d-ticks');

  const CONTROL_LABELS = { w: 'W-depth', xw: 'XW', yw: 'YW', zw: 'ZW' };
  const controlsShown = () => (view.mode === 'slice' ? ['w', 'xw', 'yw', 'zw'] : ['xw', 'yw', 'zw']);
  const isAngle = () => view.control !== 'w';
  const valueOf = () => (isAngle() ? view.angles[view.control] : view.w);
  const limit = () => (isAngle() ? ANGLE_LIMIT : W_LIMIT);
  // Click-stops: 0 and +-45 degrees for angles; for depth the FCC floor
  // (w = 0, labelled) plus every whole w-layer (unlabelled).
  function detents() {
    if (isAngle()) return ANGLE_DETENTS.map((v) => ({ v, label: '' }));
    const out = [];
    for (let w = -W_LIMIT; w <= W_LIMIT; w++) out.push({ v: w, label: w === 0 ? 'FCC' : '' });
    if (isA4(kind)) out.push({ v: A4_REST_W, label: 'Pyrochlore', below: true });
    return out;
  }

  function renderPanel() {
    panel.classList.toggle('visible', active);
    document.body.classList.toggle('world4d-on', active);
    if (!active) return;
    if (!controlsShown().includes(view.control)) view.control = 'xw';
    controlsRow.innerHTML = controlsShown().map((c) => `<button type="button" data-control="${c}" class="${c === view.control ? 'active' : ''}">${CONTROL_LABELS[c]}</button>`).join('');
    optionsRow.innerHTML = [
      `<button type="button" data-opt="mode">${view.mode === 'slice' ? 'Slice' : 'Projection'}</button>`,
      view.mode === 'projection' ? `<button type="button" data-opt="perspective">${view.perspective ? 'Perspective' : 'Parallel'}</button>` : '',
      '<button type="button" data-opt="reset">Reset 4D</button>',
    ].join('');
    const L = limit();
    ticks.innerHTML = detents().map(({ v, label, below }) => `<span class="w4d-tick${below ? ' w4d-tick-below' : ''}" style="left:${((v + L) / (2 * L)) * 100}%">${label}</span>`).join('');
    thumb.style.left = `calc(17px + (100% - 34px) * ${(valueOf() + L) / (2 * L)})`;
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
    if (b.dataset.opt === 'mode') {
      view.mode = view.mode === 'slice' ? 'projection' : 'slice';
      showHudPrompt(view.mode === 'slice' ? 'Slice: the 3D cross-section at the current w-depth.' : 'Projection: whole 4D cells as shadows -- tap a facet shadow to build across it.', 3500);
    } else if (b.dataset.opt === 'perspective') {
      view.perspective = !view.perspective;
    } else if (b.dataset.opt === 'reset') {
      view.angles = { xw: 0, yw: 0, zw: 0 };
      view.w = restW(kind);
    }
    save(); rebuild();
  });

  // Geared relative drag: the thumb doesn't jump to the finger; moving
  // across the whole track changes the value by one sweep's worth. No
  // coasting -- it stops the moment the finger lifts, then snaps to a
  // click-stop if within reach.
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, start: valueOf(), width: track.getBoundingClientRect().width || 1 };
    track.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const per = isAngle() ? ANGLE_PER_SWEEP : W_PER_SWEEP;
    const v = Math.max(-limit(), Math.min(limit(), drag.start + ((e.clientX - drag.x) / drag.width) * per));
    setValue(v);
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    const snap = isAngle() ? ANGLE_SNAP : W_SNAP;
    const near = detents().filter(({ v }) => Math.abs(v - valueOf()) <= snap).sort((a, b) => Math.abs(a.v - valueOf()) - Math.abs(b.v - valueOf()))[0];
    if (near) setValue(near.v);
    save();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  function setValue(v) {
    if (isAngle()) view.angles[view.control] = v; else view.w = v;
    rebuild();
  }

  return {
    group,
    meshes,
    handleTap,
    get kind() { return kind; },
    setKind(k) {
      if (!KINDS_4D[k]) return;
      // Switching between worlds (Tesseract/D4 <-> Hyper-pyrochlore) moves
      // the slider to that world's own rest position.
      if (isA4(k) !== isA4(kind)) { view.w = restW(k); save(); }
      kind = k;
      rebuild();
    },
    setActive(on) { active = on; group.visible = on; rebuild(); },
    setSkeleton(on) { skeleton = on; rebuild(); },
    setLatticeView(on) { latticeView = on; rebuild(); },
    get isActive() { return active; },
    get isEmpty() { return cells.size === 0; },
    clear() { cells.clear(); save(); rebuild(); onChange(); },
  };
}
