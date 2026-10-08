// Pair lattices (direct requests, 2026-10-08): 3D+ worlds of two pieces that fill space together
// in a checkerboard on the cubic cells, one piece on the even cells and the other on the odd (the
// face-centred cubic lattice with two pieces per point). Tap a face to add the piece across it;
// long-press to remove. Views show both pieces or either alone. The Shear either moves the cell
// centres and keeps every piece exact (copies), or bends the whole packing (solid; Kaleidohedra only). The five-fold
// toggle overlays each even piece's five-fold axes (and, where given, more lines per piece).
// Each world is a config: here the Sunstar Lattice (world-sunstar.js), ported from Kaleidohedra
// (2026-10-08). Rhombiverse has no lattice shear, so there is no Shear button. Geometry in geometry-extensions/roof-fold.js, checked in
// scripts/verify-roof-fold.mjs.
import * as THREE from 'three';
import { ROOF_FOLD_WORLD_SCALE as WS, PAIR_LATTICE_NEIGHBOURS as DJ_NEIGHBOURS, fiveFoldAxes } from '../geometry-extensions/roof-fold.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';
import { addPanelMinimiser } from './panel-minimiser.js';

const EDGE_COLOR = 0x0b1220;
const GHOST_COLOR = 0x9de0ff; // as the EKP world's
const FIRST_COLOR = 0x00e5ff;
const AXIS_COLOR = 0xffffff;
const lang = () => getSettings().language;
const key = (s) => s.join(',');
const isEven = (s) => (((s[0] + s[1] + s[2]) % 2) + 2) % 2 === 0;

/**
 * config: { storageKey, panelId, minimiser, strings (key prefix), modes [{ id, even, odd }],
 * evenFaces / oddFaces ([polygon, colour] in cell units), insideEven / insideOdd (p in cell units,
 * centred on the cell), overlay(s) -> { faint, bright } extra line segments per even piece (optional),
 * brightColor, holePrompt (true: a tap toward a hidden piece explains; false: it adds the nearest
 * shown piece instead, as corner-sharing pieces need) }.
 */
export function createPairLatticeWorld({ scene, fitView = () => {}, shear = () => null, showHudPrompt = () => {}, onChange = () => {} }, config) {
  const { storageKey: STORAGE_KEY, strings: S_, modes: MODE_LIST } = config;
  const MODES = MODE_LIST.map((m) => m.id);
  const modeOf = () => MODE_LIST.find((m) => m.id === view.mode) ?? MODE_LIST[0];
  const showsSite = (s) => (isEven(s) ? modeOf().even : modeOf().odd);
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const AXES = fiveFoldAxes();

  // ---- state ----
  const cells = new Map(); // key -> [x, y, z]
  const view = { mode: MODES[0], shear: 'copies', axes: false };
  let active = false, skeleton = false, opacity = 1, latticeView = false;
  function read(data) {
    cells.clear();
    for (const s of Array.isArray(data?.cells) ? data.cells : []) if (Array.isArray(s) && s.length === 3 && s.every(Number.isInteger)) cells.set(key(s), [...s]);
    if (MODES.includes(data?.view?.mode)) view.mode = data.view.mode;
    if (['copies', 'solid'].includes(data?.view?.shear)) view.shear = data.view.shear;
    view.axes = data?.view?.axes === true;
  }
  try { read(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { /* corrupt or blocked storage: start empty */ }
  const snapshot = () => ({ version: 1, cells: [...cells.values()], view: { ...view } });
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); } catch { /* best-effort */ } };
  const shown = () => [...cells.values()].filter(showsSite);

  // ---- placement through the shear ----
  const shearMap = (p) => { const A = shear(); return A ? A.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]) : p; };
  const shearInv = (p) => {
    const A = shear();
    if (!A) return p;
    const [a, b, c] = A, det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    const inv = [
      [b[1] * c[2] - b[2] * c[1], a[2] * c[1] - a[1] * c[2], a[1] * b[2] - a[2] * b[1]],
      [b[2] * c[0] - b[0] * c[2], a[0] * c[2] - a[2] * c[0], a[2] * b[0] - a[0] * b[2]],
      [b[0] * c[1] - b[1] * c[0], a[1] * c[0] - a[0] * c[1], a[0] * b[1] - a[1] * b[0]],
    ].map((r) => r.map((v) => v / det));
    return inv.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
  };
  const copies = () => view.shear === 'copies';
  // A cell-unit point of the piece at site s, in world units.
  const toWorld = (s, p) => {
    const c = s.map((x) => 2 * x);
    return (copies() ? shearMap(c).map((v, a) => v + p[a]) : shearMap(p.map((v, a) => v + c[a]))).map((v) => v * WS);
  };
  // A world point back into the frame of the piece at site s (cell units, unsheared).
  const toLocal = (s, w) => {
    const q = w.map((v) => v / WS), c = s.map((x) => 2 * x);
    return copies() ? q.map((v, a) => v - shearMap(c)[a]) : shearInv(q).map((v, a) => v - c[a]);
  };

  // ---- drawing ----
  const pieceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const pickTargets = [];
  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry.dispose();
      if (child.isLineSegments) child.material.dispose();
    }
    pickTargets.length = 0;
  }
  const facesOf = (s) => (isEven(s) ? config.evenFaces : config.oddFaces);
  function meshOf(sitesList, material, tag, colourOverride, edgeColor = EDGE_COLOR) {
    const pos = [], col = [], line = [], records = [];
    for (const s of sitesList) for (const [f, hex] of facesOf(s)) {
      const colour = new THREE.Color(colourOverride ?? hex);
      const P = f.map((p) => toWorld(s, p));
      for (let i = 1; i + 1 < P.length; i++) {
        for (const p of [P[0], P[i], P[i + 1]]) { pos.push(...p); col.push(colour.r, colour.g, colour.b); }
        records.push(s);
      }
      P.forEach((p, i) => line.push(...p, ...P[(i + 1) % P.length]));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.userData.stellaJewel = tag;
    mesh.userData.records = records;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
    return [mesh, new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: edgeColor }))];
  }
  // Empty cells touching the build: across faces (Dragon Jewel <-> stella), and Dragon Jewel to
  // Dragon Jewel across the rhombi; in the jewels-alone view, the rhombus neighbours only.
  function emptyNeighbours() {
    const out = new Map();
    for (const s of shown()) for (const d of DJ_NEIGHBOURS) {
      const n = s.map((c, i) => c + d[i]);
      if (!showsSite(n) || !config.touches(s, d)) continue;
      if (!cells.has(key(n))) out.set(key(n), n);
    }
    return [...out.values()];
  }
  function draw() {
    clearGroup();
    if (!active) return;
    const S = shown();
    if (!S.length) {
      const [m, l] = meshOf([modeOf().even ? [0, 0, 0] : [1, 0, 0]], firstMaterial, 'first', FIRST_COLOR, FIRST_COLOR);
      group.add(m, l);
      pickTargets.push(m);
    } else {
      pieceMaterial.transparent = opacity < 1;
      pieceMaterial.opacity = opacity;
      pieceMaterial.depthWrite = opacity >= 1;
      const [m, l] = meshOf(S, pieceMaterial, 'piece');
      m.visible = !skeleton;
      if (skeleton) l.material.color.setHex(GHOST_COLOR);
      group.add(m, l);
      pickTargets.push(m);
      if (latticeView) {
        const ghosts = emptyNeighbours();
        if (ghosts.length) {
          const [gm, gl] = meshOf(ghosts, ghostMaterial, 'ghost', GHOST_COLOR, GHOST_COLOR);
          gl.material.transparent = true;
          gl.material.opacity = 0.4;
          group.add(gm, gl);
          pickTargets.push(gm);
        }
      }
      if (view.axes) group.add(...fiveFoldOverlay(S.filter(isEven)));
    }
    renderPanel();
  }
  // The six five-fold axes through each Dragon Jewel, and on every face the five window
  // positions: faint, with the cube's choice (the window itself) bright.
  function fiveFoldOverlay(jewels) {
    const axis = [], faint = [], bright = [];
    for (const s of jewels) {
      for (const a of AXES) axis.push(...toWorld(s, a.map((c) => -2.1 * c)), ...toWorld(s, a.map((c) => 2.1 * c)));
      for (const [polys, into] of [[config.overlay?.faint ?? [], faint], [config.overlay?.bright ?? [], bright]]) for (const P of polys) P.forEach((p, i) => into.push(...toWorld(s, p), ...toWorld(s, P[(i + 1) % P.length])));
    }
    const lines = (pts, color, op) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthTest: false }));
      ls.renderOrder = 3;
      return ls;
    };
    return [lines(axis, AXIS_COLOR, 0.7), lines(faint, FIRST_COLOR, 0.35), lines(bright, config.brightColor ?? AXIS_COLOR, 1)];
  }
  function fit() {
    const S = shown();
    if (!S.length) { fitView([0, 0, 0], 2.2 * WS); return; }
    const P = S.map((s) => toWorld(s, [0, 0, 0]));
    const c = [0, 1, 2].map((a) => P.reduce((t0, p) => t0 + p[a], 0) / P.length);
    fitView(c, Math.max(...P.map((p) => Math.hypot(...p.map((v, a) => v - c[a])))) + 2 * WS);
  }

  // ---- building ----
  function commit() { save(); draw(); onChange(); }
  function add(s) {
    if (cells.has(key(s))) return false;
    if (!showsSite(s)) return false;
    cells.set(key(s), [...s]);
    commit();
    fit();
    return true;
  }
  // The piece across the tapped face: the neighbour whose piece holds a point just outside it.
  function across(s, hit) {
    const n = hit.face.normal;
    const w = [hit.point.x + n.x * 0.03 * WS, hit.point.y + n.y * 0.03 * WS, hit.point.z + n.z * 0.03 * WS];
    const q = toLocal(s, w);
    for (const d of DJ_NEIGHBOURS) {
      const nb = s.map((c, i) => c + d[i]);
      const p = q.map((v, a) => v - 2 * d[a]);
      if (isEven(nb) ? config.insideEven(p) : config.insideOdd(p)) {
        if (showsSite(nb) || config.holePrompt) return nb;
        break;
      }
    }
    // Pieces that only share corners (or a hidden piece in between): the nearest shown neighbour.
    let best = null, bestD = Infinity;
    for (const d of DJ_NEIGHBOURS) {
      const nb = s.map((c, i) => c + d[i]);
      if (!showsSite(nb) || !config.touches(s, d)) continue;
      const dist = Math.hypot(...q.map((v, a) => v - 2 * d[a]));
      if (dist < bestD) { bestD = dist; best = nb; }
    }
    return best;
  }
  function handleTap(hit, mode) {
    const tag = hit.object.userData.stellaJewel;
    const s = hit.object.userData.records?.[hit.faceIndex];
    if (!tag || !s || mode === 'paint') return false;
    const chisel = mode === 'chisel';
    if (tag === 'first' || tag === 'ghost') return chisel ? false : add(s);
    if (chisel) {
      if (!cells.delete(key(s))) return false;
      commit();
      return true;
    }
    const nb = across(s, hit);
    if (!nb) return false;
    if (!showsSite(nb)) { showHudPrompt(t(`${S_}.prompt.hole`, lang()), 2500); return false; }
    if (add(nb)) return true;
    showHudPrompt(t(`${S_}.prompt.taken`, lang()), 2000);
    return false;
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = config.panelId;
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row"><label class="hull-pick"><span class="sj-view-label"></span> <select class="hull-select" data-select="mode"></select></label></div>
    <div class="w4d-row sj-count"></div>
    <div class="w4d-row w4d-options"><button type="button" data-sj="axes"></button></div>`;
  document.body.appendChild(panel);
  addPanelMinimiser(panel, config.minimiser);
  const modeSelect = panel.querySelector('[data-select="mode"]');
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    panel.querySelector('.sj-view-label').textContent = t(`${S_}.view`, L);
    modeSelect.innerHTML = MODES.map((m) => `<option value="${m}"${m === view.mode ? ' selected' : ''}>${t(`${S_}.view.${m}`, L)}</option>`).join('');
    const all = [...cells.values()];
    panel.querySelector('.sj-count').textContent = t(`${S_}.count`, L, { even: all.filter(isEven).length, odd: all.filter((s) => !isEven(s)).length });
    const axesBtn = panel.querySelector('[data-sj="axes"]');
    axesBtn.textContent = t(`${S_}.axes`, L);
    axesBtn.classList.toggle('active', view.axes);
  }
  modeSelect.addEventListener('change', () => {
    if (!MODES.includes(modeSelect.value)) return;
    view.mode = modeSelect.value;
    save(); draw(); fit();
  });
  panel.querySelector('[data-sj="axes"]').addEventListener('click', () => { view.axes = !view.axes; save(); draw(); });
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
      if (!on) panel.classList.remove('visible');
      draw();
      if (on) { fit(); if (!shown().length) showHudPrompt(t(`${S_}.prompt.start`, lang()), 5000); }
    },
    setSkeleton(on) { skeleton = on; if (active) draw(); },
    setTranslucent(o) { if (o !== opacity) { opacity = o; if (active) draw(); } },
    setLatticeView(on) { latticeView = on; if (active) draw(); },
    shearChanged() { if (active) draw(); },
    get isEmpty() { return cells.size === 0; },
    clear() { cells.clear(); commit(); if (active) fit(); },
    snapshot,
    restore(json) { read(json); save(); draw(); },
  };
}
