// The 6D world: the icosahedral quasicrystal (Ammann-Kramer tiling of
// prolate and oblate golden rhombohedra), cut and projected from Z^6 by
// geometry-extensions/quasicrystal.js (verify:quasicrystal). Owns its own
// store, THREE group, slider panel and tap handling; render.js switches it
// on for the 6D dimension and routes taps to it, as it does for 4D.
//
// Decisions this file implements (docs/PLAN-5D-6D.md, stage 2):
// - The tiling decides the shape: tapping a face adds the one tile the
//   tiling has across it, prolate or oblate. No Shape choice.
// - Pieces never move. Each is a face (n, I) of Z^6; the slider changes
//   which faces are in the slice, so pieces appear and vanish.
// - ONE geared slider + a toggle: Phason 1 | Phason 2 | Phason 3 |
//   Approximant. Each phason keeps its own value, from -1 to +1 window
//   widths (one sweep of the track covers the range), click-stop at 0.
//   Approximant snaps to the Fibonacci stops 1/1 ... 13/8 and tau.
// - Empty slice: a cyan first-placement target on the tile nearest the
//   origin. Lattice View: every tile across a face of the build, as a
//   ghost; tap one to place it.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { makeQuasicrystal, BASE_OFFSET, APPROXIMANT_STOPS, tileKey } from '../geometry-extensions/quasicrystal.js';
import { createGearedSlider } from './geared-slider.js';

export const WORLD6D_STORAGE_KEY = 'rhombiverse-6d-world';
const PHASON_LIMIT = 1; // window widths
const PHASON_SNAP = 0.04;
const FIRST_COLOR = 0x00e5ff;
const SLOT_COLOR = 0x9de0ff;
const CONTROLS = ['p1', 'p2', 'p3', 'approx'];
const CONTROL_LABELS = { p1: 'Phason 1', p2: 'Phason 2', p3: 'Phason 3', approx: 'Approximant' };
// Approximant stops spread evenly across the track, tau at the right end.
const STOP_POS = APPROXIMANT_STOPS.map((_, i) => -1 + (2 * i) / (APPROXIMANT_STOPS.length - 1));
const stopLabel = (s) => (s ? `${s[0]}/${s[1]}` : 'τ');

export function createWorld6D({ scene, materialColor, getMaterial, onChange = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const tiles = new Map(); // key -> { n, I, material }
  const view = { phason: [0, 0, 0], approx: APPROXIMANT_STOPS.length - 1, control: 'p1' };
  let active = false;
  let skeleton = false;
  let latticeView = false;
  let infoOpen = false;

  const engines = new Map();
  const engine = () => {
    if (!engines.has(view.approx)) engines.set(view.approx, makeQuasicrystal('6d', APPROXIMANT_STOPS[view.approx]));
    return engines.get(view.approx);
  };
  const offset = () => {
    const w = engine().windowWidth;
    return BASE_OFFSET['6d'].map((b, i) => b + view.phason[i] * w);
  };

  function load() {
    try {
      const raw = localStorage.getItem(WORLD6D_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      setTilesFromJSON(data.tiles);
      if (data.view) {
        if (Array.isArray(data.view.phason) && data.view.phason.length === 3) view.phason = data.view.phason.map((x) => Math.max(-PHASON_LIMIT, Math.min(PHASON_LIMIT, +x || 0)));
        if (Number.isInteger(data.view.approx) && APPROXIMANT_STOPS[data.view.approx] !== undefined) view.approx = data.view.approx;
        if (CONTROLS.includes(data.view.control)) view.control = data.view.control;
      }
    } catch { /* corrupt or blocked storage: start empty */ }
  }
  const tilesJSON = () => [...tiles.values()].map((t) => ({ n: t.n, I: t.I, material: t.material }));
  function setTilesFromJSON(list) {
    tiles.clear();
    for (const t of list ?? []) {
      if (!Array.isArray(t.n) || t.n.length !== 6 || !t.n.every(Number.isInteger)) continue;
      if (!Array.isArray(t.I) || t.I.length !== 3 || !t.I.every((i) => Number.isInteger(i) && i >= 0 && i < 6)) continue;
      const I = [...t.I].sort((a, b) => a - b);
      if (new Set(I).size !== 3) continue;
      tiles.set(tileKey(t.n, I), { n: t.n, I, material: t.material });
    }
  }
  function save() {
    try {
      localStorage.setItem(WORLD6D_STORAGE_KEY, JSON.stringify({ version: 1, tiles: tilesJSON(), view }));
    } catch { /* best-effort */ }
  }
  load();

  const visibleTiles = () => {
    const e = engine(), off = offset();
    return [...tiles.values()].filter((t) => e.isTile(t.n, t.I, off));
  };
  // Open slots: every tile of the current tiling across a face of a
  // visible piece that isn't placed yet.
  function openSlots(visible) {
    const e = engine(), off = offset();
    const out = new Map();
    for (const t of visible) {
      for (const f of e.tileFaces(t.n, t.I)) {
        const u = e.neighbourAcross(t.n, t.I, f, off);
        if (!u) continue;
        const key = tileKey(u.n, u.I);
        if (!tiles.has(key)) out.set(key, u);
      }
    }
    return [...out.values()];
  }

  // ---- info ----
  const info = document.createElement('div');
  info.id = 'world6d-info';
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
    const rows = [
      ['World', 'Icosahedral quasicrystal (from Z⁶)'],
      ['Built', all.length ? `${count(all, 'prolate')} prolate, ${count(all, 'oblate')} oblate` : 'nothing yet'],
      ['In the slice', `${visible.length} shown, ${all.length - visible.length} hidden by the slice`],
      ['Phason', view.phason.map(fmt).join(' · ')],
      ['Approximant', APPROXIMANT_STOPS[view.approx] ? `${stopLabel(APPROXIMANT_STOPS[view.approx])} (a periodic crystal)` : 'τ (the true quasicrystal)'],
    ];
    info.innerHTML = rows.map(([k, v]) => `<div><span class="w4d-info-k">${k}</span> ${v}</div>`).join('');
  }

  // ---- rendering ----
  const pickTargets = [];
  const geometries = new Map(); // tile key -> ConvexGeometry (pieces never move)
  const geometryOf = (t) => {
    const key = tileKey(t.n, t.I);
    if (!geometries.has(key)) geometries.set(key, new ConvexGeometry(engine().tileVertices(t.n, t.I).map(([x, y, z]) => new THREE.Vector3(x, y, z))));
    return geometries.get(key);
  };
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0b0b12 });
  const skeletonEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x9de0ff });
  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.isLineSegments) child.geometry.dispose();
      if (child.material && !child.userData.sharedMaterial) child.material.dispose();
    }
    pickTargets.length = 0;
  }
  function addTile(t, { color, opacity = 1, userData, lineMaterial = edgeMaterial }) {
    const geometry = geometryOf(t);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
    mesh.userData = userData;
    mesh.visible = !skeleton || opacity < 1;
    group.add(mesh);
    pickTargets.push(mesh);
    const lineMat = skeleton ? skeletonEdgeMaterial : lineMaterial;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMat);
    lines.userData.sharedMaterial = lineMat === edgeMaterial || lineMat === skeletonEdgeMaterial;
    group.add(lines);
  }

  function rebuild() {
    const visible = active ? visibleTiles() : [];
    renderInfo(visible);
    clearGroup();
    if (!active) return;
    for (const t of visible) addTile(t, { color: materialColor(t.material), userData: { world6d: 'tile', n: t.n, I: t.I } });
    if (!visible.length) {
      // Nothing of the build in this slice (or nothing built): one cyan
      // target on the tile nearest the origin.
      const s = engine().seedTile(offset());
      addTile(s, { color: FIRST_COLOR, opacity: 0.12, userData: { world6d: 'slot', n: s.n, I: s.I, first: true }, lineMaterial: new THREE.LineBasicMaterial({ color: FIRST_COLOR }) });
    } else if (latticeView) {
      const lineMaterial = new THREE.LineBasicMaterial({ color: SLOT_COLOR, transparent: true, opacity: 0.6 });
      for (const u of openSlots(visible)) addTile(u, { color: SLOT_COLOR, opacity: 0.12, userData: { world6d: 'slot', n: u.n, I: u.I }, lineMaterial });
    }
    renderPanel();
  }

  // ---- taps (core/build.js routes here while 6D is active) ----
  function place(t) {
    const key = tileKey(t.n, t.I);
    if (tiles.has(key)) return false;
    tiles.set(key, { n: t.n, I: t.I, material: getMaterial() });
    save(); rebuild(); onChange();
    return true;
  }
  function handleTap(hit, mode) {
    const u = hit.object.userData;
    if (mode === 'chisel') {
      if (u.world6d !== 'tile') return false;
      tiles.delete(tileKey(u.n, u.I));
      save(); rebuild(); onChange();
      return true;
    }
    if (u.world6d === 'slot') return place(u);
    if (u.world6d !== 'tile') return false;
    const e = engine();
    const p = hit.point;
    const face = e.tileFaces(u.n, u.I)[e.faceAtPoint(u.n, u.I, [p.x, p.y, p.z])];
    const across = e.neighbourAcross(u.n, u.I, face, offset());
    return !!across && place(across);
  }

  // ---- panel: one geared slider + Phason 1-3 | Approximant ----
  const panel = document.createElement('div');
  panel.id = 'world6d-panel';
  panel.innerHTML = `
    <div class="w4d-row w4d-controls"></div>
    <div class="w4d-track" role="slider" aria-label="6D slider"><div class="w4d-ticks"></div><div class="w4d-thumb"></div></div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const controlsRow = panel.querySelector('.w4d-controls');
  const optionsRow = panel.querySelector('.w4d-options');
  const isApprox = () => view.control === 'approx';
  const phasonIndex = () => ['p1', 'p2', 'p3'].indexOf(view.control);
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
    document.body.classList.toggle('world6d-on', active);
    if (!active) return;
    controlsRow.innerHTML = CONTROLS.map((c) => `<button type="button" data-control="${c}" class="${c === view.control ? 'active' : ''}">${CONTROL_LABELS[c]}</button>`).join('');
    optionsRow.innerHTML = [
      '<button type="button" data-opt="reset">Reset 6D</button>',
      `<button type="button" data-opt="info" class="${infoOpen ? 'active' : ''}">Info</button>`,
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
    if (b.dataset.opt === 'info') infoOpen = !infoOpen;
    else if (b.dataset.opt === 'reset') { view.phason = [0, 0, 0]; view.approx = APPROXIMANT_STOPS.length - 1; save(); }
    rebuild();
  });

  return {
    group,
    meshes: () => pickTargets,
    handleTap,
    setActive(on) { active = on; group.visible = on; if (!on) { panel.classList.remove('visible'); document.body.classList.remove('world6d-on'); } rebuild(); },
    setSkeleton(on) { skeleton = on; rebuild(); },
    setLatticeView(on) { latticeView = on; rebuild(); },
    get isEmpty() { return tiles.size === 0; },
    clear() { tiles.clear(); save(); rebuild(); onChange(); },
    // Undo (render.js's history): the built pieces only, never the slider.
    snapshot() { return tilesJSON(); },
    restore(list) { setTilesFromJSON(list); save(); rebuild(); onChange(); },
  };
}
