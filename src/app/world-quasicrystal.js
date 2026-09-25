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
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { makeQuasicrystal, BASE_OFFSET, APPROXIMANT_STOPS, TIERS, tileKey } from '../geometry-extensions/quasicrystal.js';
import { createGearedSlider } from './geared-slider.js';

const PHASON_LIMIT = 1; // window widths
const PHASON_SNAP = 0.04;
const FIRST_COLOR = 0x00e5ff;
const SLOT_COLOR = 0x9de0ff;
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

export function createQuasicrystalWorld({ tier, scene, materialColor, getMaterial, onChange = () => {} }) {
  const W = WORLDS[tier];
  const { d, k } = TIERS[tier];
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const tiles = new Map(); // key -> { n, I, layer?, material }
  const view = { phason: [0, 0, 0], approx: APPROXIMANT_STOPS.length - 1, control: 'p1' };
  let active = false;
  let skeleton = false;
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
      if (data.view) {
        if (Array.isArray(data.view.phason) && data.view.phason.length === 3) {
          view.phason = data.view.phason.map((x, i) => (W.controls.includes(`p${i + 1}`) ? Math.max(-PHASON_LIMIT, Math.min(PHASON_LIMIT, +x || 0)) : 0));
        }
        if (Number.isInteger(data.view.approx) && APPROXIMANT_STOPS[data.view.approx] !== undefined) view.approx = data.view.approx;
        if (W.controls.includes(data.view.control)) view.control = data.view.control;
      }
    } catch { /* corrupt or blocked storage: start empty */ }
  }
  const tilesJSON = () => [...tiles.values()].map((t) => ({ ...pieceOf(t), material: t.material }));
  function setTilesFromJSON(list) {
    tiles.clear();
    for (const t of list ?? []) {
      if (!Array.isArray(t.n) || t.n.length !== d || !t.n.every(Number.isInteger)) continue;
      if (!Array.isArray(t.I) || t.I.length !== k || !t.I.every((i) => Number.isInteger(i) && i >= 0 && i < d)) continue;
      if (W.layered && !Number.isInteger(t.layer)) continue;
      const I = [...t.I].sort((a, b) => a - b);
      if (new Set(I).size !== k) continue;
      const tile = { ...pieceOf({ ...t, I }), material: t.material };
      tiles.set(keyOf(tile), tile);
    }
  }
  function save() {
    try {
      localStorage.setItem(W.storageKey, JSON.stringify({ version: 1, tiles: tilesJSON(), view }));
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
    info.innerHTML = rows.map(([key, v]) => `<div><span class="w4d-info-k">${key}</span> ${v}</div>`).join('');
  }

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
    }
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

  function rebuild() {
    const visible = active ? visibleTiles() : [];
    renderInfo(visible);
    clearGroup();
    if (!active) return;
    for (const t of visible) addTile(t, { color: materialColor(t.material), qc: 'tile' });
    if (!visible.length) {
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
    optionsRow.innerHTML = [
      `<button type="button" data-opt="reset">Reset ${W.label}</button>`,
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
    setActive(on) {
      active = on;
      group.visible = on;
      if (!on) panel.classList.remove('visible');
      rebuild();
    },
    setSkeleton(on) { skeleton = on; rebuild(); },
    setLatticeView(on) { latticeView = on; rebuild(); },
    get isEmpty() { return tiles.size === 0; },
    clear() { tiles.clear(); save(); rebuild(); onChange(); },
    // Undo (render.js's history): the built pieces only, never the slider.
    snapshot() { return tilesJSON(); },
    restore(list) { setTilesFromJSON(list); save(); rebuild(); onChange(); },
  };
}
