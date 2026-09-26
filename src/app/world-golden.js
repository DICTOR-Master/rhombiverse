// Golden Rhombohedra: a 3D world of its own for building freely with the
// two pieces of the 3D Penrose (Ammann-Kramer) tiling, the prolate and
// oblate golden rhombohedra. Listed as a 3D lattice ('tool:goldenWorld');
// render.js routes taps here while it's on, like the Shells world.
//
// Every piece is a tile (n, I) of the Z^6 lattice the 6D world projects
// (quasicrystal.js): corner n, edges along three of the six icosahedral
// axes I. So each free piece can be tested exactly against the true
// Penrose tiling (the 6D world's tiling at phason 0): the Penrose check
// colours pieces green where they belong to it and red where the build
// has drifted (face-to-face matching alone never forces aperiodicity in
// 3D). The first piece is the tiling's seed; tap a face to add the chosen
// piece across it (the true tiling's own piece when it's that type, else
// the most upright non-overlapping one); long-press
// removes. Lattice View ghosts the true tiling one step out.
import * as THREE from 'three';
import { makeQuasicrystal, BASE_OFFSET, tileKey } from '../geometry-extensions/quasicrystal.js';
import { solidFromPlanes } from '../geometry-extensions/rd-pieces.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-golden-world';
const FIRST_COLOR = 0x00e5ff;
const GHOST_COLOR = 0x9de0ff;
const EDGE_COLOR = 0x0b1220;
const TYPE_COLOR = { prolate: 0xffc857, oblate: 0x7cc4ff };
const MATCH_COLOR = 0x5fd38a;
const DRIFT_COLOR = 0xff5d6c;
const lang = () => getSettings().language;
// A parallelepiped's six faces as loops of its corner indices (corner
// a*4 + b*2 + c, as quasicrystal.js tileVertices orders them).
const QUADS = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function createGoldenWorld({ scene, onChange = () => {}, showHudPrompt = () => {} }) {
  const e = makeQuasicrystal('6d');
  const offset = BASE_OFFSET['6d'];
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const tiles = new Map(); // key -> { n, I }
  const view = { piece: 'prolate', check: true };
  let active = false;
  let skeleton = false;
  let opacity = 1;
  let latticeView = false;
  let infoOpen = false;
  const keyOf = (x) => tileKey(x.n, x.I);
  const centreOf = (x) => e.parCentre(x.n, x.I);

  function setFromJSON(data) {
    tiles.clear();
    for (const x of Array.isArray(data?.tiles) ? data.tiles : []) {
      if (!Array.isArray(x?.n) || x.n.length !== 6 || !x.n.every(Number.isInteger)) continue;
      if (!Array.isArray(x.I) || x.I.length !== 3 || !x.I.every((i) => Number.isInteger(i) && i >= 0 && i < 6)) continue;
      const I = [...x.I].sort((a, b) => a - b);
      if (new Set(I).size !== 3) continue;
      tiles.set(tileKey(x.n, I), { n: [...x.n], I });
    }
  }
  const toJSON = () => ({ tiles: [...tiles.values()] });
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data) {
      setFromJSON(data);
      if (['prolate', 'oblate'].includes(data.view?.piece)) view.piece = data.view.piece;
      if (data.view?.check === false) view.check = false;
    }
  } catch { /* corrupt or blocked storage: start empty */ }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON(), view })); } catch { /* best-effort */ }
  }

  // ---- geometry ----
  // A tile's outward face planes (for exact overlap tests).
  function planesOf(x) {
    const v = e.tileVertices(x.n, x.I);
    const c = centreOf(x);
    return QUADS.map((q) => {
      let n = cross(sub(v[q[1]], v[q[0]]), sub(v[q[3]], v[q[0]]));
      if (dot(n, sub(v[q[0]], c)) < 0) n = n.map((a) => -a);
      return { n, d: dot(n, v[q[0]]) };
    });
  }
  const overlaps = (a, b) => solidFromPlanes([...planesOf(a), ...planesOf(b)]).volume > 1e-7;
  // Tiles that could sit across face f (from e.tileFaces) of tile x, on
  // the far side, of the given type: most upright first.
  function candidatesAcross(x, f, type) {
    const own = centreOf(x);
    const out = [];
    for (let j = 0; j < 6; j++) {
      if (f.K.includes(j)) continue;
      const J = [...f.K, j].sort((a, b) => a - b);
      if (e.tileType(J) !== type) continue;
      for (const eps of [0, 1]) {
        const cand = { n: f.n.map((v, l) => v - (l === j ? eps : 0)), I: J };
        if (keyOf(cand) === keyOf(x)) continue;
        const c = centreOf(cand);
        const shared = e.parOf(f.n);
        const inward = sub(own, shared), outward = sub(c, shared);
        // Far side of the face: the two centres on opposite sides of it.
        const kVec = cross(e.par[f.K[0]], e.par[f.K[1]]);
        if (Math.sign(dot(inward, kVec)) === Math.sign(dot(outward, kVec))) continue;
        const up = Math.abs(dot(e.par[j], kVec)) / Math.hypot(...kVec) / Math.hypot(...e.par[j]);
        out.push({ tile: cand, up });
      }
    }
    // The true Penrose neighbour first (when it's this type), so choosing
    // the tiling's own piece keeps the build in the tiling; then the most
    // upright.
    const truth = e.isTile(x.n, x.I, offset) ? e.neighbourAcross(x.n, x.I, f, offset) : null;
    const rank = (o) => (truth && keyOf(o.tile) === keyOf(truth) ? 2 : o.up);
    return out.sort((a, b) => rank(b) - rank(a)).map((o) => o.tile);
  }

  // ---- drawing ----
  const pieceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  let tris = [], ghostTris = [];
  const pickTargets = [];
  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry.dispose();
      if (child.isLineSegments) child.material.dispose();
    }
    pickTargets.length = 0;
  }
  // One mesh for a list of tiles: every face not shared by two of them.
  function meshOf(list, material, colorOf, edgeColor, tag, record) {
    const faceCount = new Map();
    const faceKey = (x, q) => q.map((i) => e.tileVertices(x.n, x.I)[i].map((a) => a.toFixed(5)).join(',')).sort().join('|');
    for (const x of list) for (const q of QUADS) { const k = faceKey(x, q); faceCount.set(k, (faceCount.get(k) ?? 0) + 1); }
    const pos = [], col = [], edge = [];
    const c = new THREE.Color();
    for (const x of list) {
      colorOf(x, c);
      const v = e.tileVertices(x.n, x.I);
      for (const q of QUADS) {
        if (faceCount.get(faceKey(x, q)) > 1) continue;
        const p = q.map((i) => v[i]);
        for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]); col.push(c.r, c.g, c.b); }
        record.push(x, x);
        for (let i = 0; i < 4; i++) edge.push(...p[i], ...p[(i + 1) % 4]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.userData.golden = tag;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
    return [mesh, new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: edgeColor }))];
  }
  // The true tiling one step out from the pieces that belong to it.
  function trueSlots() {
    const out = new Map();
    for (const x of tiles.values()) {
      if (!e.isTile(x.n, x.I, offset)) continue;
      for (const f of e.tileFaces(x.n, x.I)) {
        const u = e.neighbourAcross(x.n, x.I, f, offset);
        if (u && !tiles.has(keyOf(u)) && ![...tiles.values()].some((y) => overlaps(u, y))) out.set(keyOf(u), u);
      }
    }
    return [...out.values()];
  }
  function rebuild() {
    renderInfo();
    clearGroup();
    if (!active) return;
    pieceMaterial.transparent = opacity < 1;
    pieceMaterial.opacity = opacity;
    pieceMaterial.depthWrite = opacity >= 1;
    if (tiles.size) {
      const colorOf = (x, c) => c.setHex(view.check ? (e.isTile(x.n, x.I, offset) ? MATCH_COLOR : DRIFT_COLOR) : TYPE_COLOR[e.tileType(x.I)]);
      tris = [];
      const [mesh, lines] = meshOf([...tiles.values()], pieceMaterial, colorOf, EDGE_COLOR, 'piece', tris);
      mesh.visible = !skeleton;
      if (skeleton) lines.material.color.setHex(0x9de0ff);
      group.add(mesh, lines);
      pickTargets.push(mesh);
      if (latticeView) {
        ghostTris = [];
        const slots = trueSlots();
        if (slots.length) {
          const [gm, gl] = meshOf(slots, ghostMaterial, (x, c) => c.setHex(GHOST_COLOR), GHOST_COLOR, 'ghost', ghostTris);
          group.add(gm, gl);
          pickTargets.push(gm);
        }
      }
    } else {
      const seed = e.seedTile(offset);
      const rec = [];
      const [mesh, lines] = meshOf([seed], firstMaterial, (x, c) => c.setHex(FIRST_COLOR), FIRST_COLOR, 'first', rec);
      mesh.userData.seed = seed;
      group.add(mesh, lines);
      pickTargets.push(mesh);
    }
    renderPanel();
  }

  // ---- building ----
  function commit() { save(); rebuild(); onChange(); }
  function place(x) {
    if (tiles.has(keyOf(x))) return false;
    if ([...tiles.values()].some((y) => overlaps(x, y))) return false;
    tiles.set(keyOf(x), { n: [...x.n], I: [...x.I] });
    commit();
    return true;
  }
  function handleTap(hit, mode) {
    const kind = hit.object.userData.golden;
    const chisel = mode === 'chisel';
    if (kind === 'first') return chisel ? false : place(hit.object.userData.seed);
    if (kind === 'ghost') return chisel ? false : place(ghostTris[hit.faceIndex]);
    if (kind !== 'piece') return false;
    const x = tris[hit.faceIndex];
    if (!x) return false;
    if (chisel) { tiles.delete(keyOf(x)); commit(); return true; }
    const p = hit.point;
    const f = e.tileFaces(x.n, x.I)[e.faceAtPoint(x.n, x.I, [p.x, p.y, p.z])];
    for (const cand of candidatesAcross(x, f, view.piece)) if (place(cand)) return true;
    showHudPrompt(t('golden.prompt.noFit', lang(), { piece: t(`golden.${view.piece}`, lang()) }), 3000);
    return false;
  }

  // ---- info ----
  const info = document.createElement('div');
  info.id = 'worldgolden-info';
  info.className = 'qc-info';
  info.setAttribute('aria-live', 'polite');
  document.body.appendChild(info);
  function renderInfo() {
    const show = active && infoOpen;
    info.classList.toggle('visible', show);
    if (!show) return;
    const L = lang();
    const all = [...tiles.values()];
    const count = (type) => all.filter((x) => e.tileType(x.I) === type).length;
    const matching = all.filter((x) => e.isTile(x.n, x.I, offset)).length;
    const row = (k, v) => `<div><span class="w4d-info-k">${k}</span> ${v}</div>`;
    info.innerHTML = [
      row(t('golden.info.pieces', L), all.length ? t('golden.info.counts', L, { prolate: count('prolate'), oblate: count('oblate') }) : t('hull.info.none', L)),
      all.length ? row(t('golden.info.penrose', L), t('golden.info.matching', L, { n: matching, total: all.length })) : '',
    ].join('');
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'worldgolden-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row"><label class="hull-pick"><span class="golden-piece-label"></span> <select class="hull-select" data-select="piece"></select></label></div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const pieceSelect = panel.querySelector('[data-select="piece"]');
  const optionsRow = panel.querySelector('.w4d-options');
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    panel.querySelector('.golden-piece-label').textContent = t('hull.piece', L);
    pieceSelect.innerHTML = ['prolate', 'oblate'].map((p) => `<option value="${p}"${p === view.piece ? ' selected' : ''}>${t(`golden.${p}`, L)}</option>`).join('');
    optionsRow.innerHTML = [
      `<button type="button" data-opt="check" class="${view.check ? 'active' : ''}">${t('golden.check', L)}</button>`,
      `<button type="button" data-opt="info" class="${infoOpen ? 'active' : ''}">${t('hyper.info', L)}</button>`,
    ].join('');
  }
  pieceSelect.addEventListener('change', () => {
    if (!['prolate', 'oblate'].includes(pieceSelect.value)) return;
    view.piece = pieceSelect.value;
    save();
  });
  optionsRow.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-opt]');
    if (!b) return;
    if (b.dataset.opt === 'check') { view.check = !view.check; save(); if (view.check) showHudPrompt(t('golden.prompt.check', lang()), 4000); }
    else if (b.dataset.opt === 'info') infoOpen = !infoOpen;
    rebuild();
  });
  let shownLang = lang();
  onSettingsChange((st) => { if (st.language !== shownLang) { shownLang = st.language; if (active) rebuild(); } });

  return {
    group,
    meshes: () => pickTargets,
    handleTap,
    setActive(on) {
      if (on === active) return;
      active = on;
      group.visible = on;
      if (!on) { panel.classList.remove('visible'); info.classList.remove('visible'); }
      rebuild();
    },
    setSkeleton(on) { skeleton = on; if (active) rebuild(); },
    setTranslucent(o) { if (o !== opacity) { opacity = o; if (active) rebuild(); } },
    setLatticeView(on) { latticeView = on; if (active) rebuild(); },
    get isEmpty() { return tiles.size === 0; },
    clear() { tiles.clear(); commit(); },
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); rebuild(); onChange(); },
    toJSON,
  };
}
