// Shells: a 3D world of its own for building hulls out of shells of RDs
// (docs/PLAN-SHELLS.md, stage 2). Listed as a 3D lattice ('tool:shellsWorld');
// while it's on, render.js routes every tap here (the same own-world path
// as 4D/5D/6D) and hides the other 3D worlds.
//
// The first piece placed is the centre. Every piece is coloured by its
// shell -- counted out from the centre by the chosen hull shape (Steps =
// cuboctahedron, Distance = sphere, or a target: tetrahedron, cube,
// octahedron, RD, truncated octahedron) -- in the old Shells hue step.
// Tap a face to add the RD across it, long-press to remove; + Shell fills
// the innermost unfinished shell, − Shell removes the outermost.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, facePieces, NEIGHBOR_OFFSETS } from '../core/lattice.js';
import { HULL_IDS, hullShell, hullShellOf } from '../geometry-extensions/rd-pieces.js';
import { t, tn } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-shells-world';
const FIRST_COLOR = 0x00e5ff;
const SLOT_COLOR = 0x9de0ff;
const EDGE_COLOR = 0x0b1220;
// The largest hull + Shell will build (a phone keeps a steady frame rate
// well past this; measured in stage 2).
export const MAX_PIECES = 4000;
const HULL_LABEL_KEY = {
  steps: 'hull.steps', distance: 'hull.distance', tetrahedron: 'hull.tetrahedron', 'tetrahedron-mirror': 'hull.tetrahedronMirror',
  cube: 'hull.cube', octahedron: 'hull.octahedron', rd: 'hull.rd', to: 'hull.to',
};
const lang = () => getSettings().language;
const keyOf = (c) => c.join(',');
// The old Shells panel's colours: the centre white, shell n a hue step of
// 0.15 round the colour wheel.
const shellColor = (n, out = new THREE.Color()) => (n === 0 ? out.setRGB(1, 1, 1) : out.setHSL((n * 0.15) % 1, 0.65, 0.55));

export function createShellsWorld({ scene, onChange = () => {}, showHudPrompt = () => {}, fitView = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const cells = new Map(); // key -> [x, y, z]
  let centre = null; // the first piece's cell
  const view = { hull: 'steps' };
  let active = false;
  let skeleton = false;
  let opacity = 1; // below 1 in World View: Translucent
  let latticeView = false;
  let infoOpen = false;

  const shellOf = (c) => (centre ? hullShellOf(view.hull, c, centre) : 0);

  function setFromJSON(data) {
    cells.clear();
    centre = null;
    for (const c of Array.isArray(data?.cells) ? data.cells : []) {
      if (!Array.isArray(c) || c.length !== 3 || !c.every(Number.isInteger) || (c[0] + c[1] + c[2]) % 2 !== 0) continue;
      cells.set(keyOf(c), [...c]);
    }
    const k = Array.isArray(data?.centre) ? keyOf(data.centre) : null;
    if (k && cells.has(k)) centre = cells.get(k);
    else if (cells.size) centre = [...cells.values()][0];
  }
  const toJSON = () => ({ cells: [...cells.values()], centre });
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      setFromJSON(data);
      if (HULL_IDS.includes(data.view?.hull)) view.hull = data.view.hull;
    } catch { /* corrupt or blocked storage: start empty */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON(), view })); } catch { /* best-effort */ }
  }
  load();

  // ---- geometry ----
  const rdGeometry = new ConvexGeometry(rdRawVerts(1).map((v) => new THREE.Vector3(...v)));
  const rdEdges = new THREE.EdgesGeometry(rdGeometry).getAttribute('position').array;
  // RD face i is the one shared with the neighbour at NEIGHBOR_OFFSETS[i].
  const FACES = facePieces(1).map((f) => f.base);
  const pieceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const slotMaterial = new THREE.MeshStandardMaterial({ color: SLOT_COLOR, transparent: true, opacity: 0.18, depthWrite: false });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.12, depthWrite: false });
  let skinMesh = null, slotsMesh = null, firstMesh = null, slotCells = [], skinTris = [];
  const pickTargets = [];

  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.isInstancedMesh) child.dispose();
      else if (child.isLineSegments || child.isMesh) child.geometry.dispose();
      if (child.isLineSegments) child.material.dispose();
    }
    skinMesh = slotsMesh = firstMesh = null;
    pickTargets.length = 0;
  }
  // All pieces' edges as one set of lines, each in its shell colour in
  // Skeleton (dark outlines otherwise).
  function edgesFor(list, colorOf) {
    const pos = new Float32Array(list.length * rdEdges.length);
    const col = new Float32Array(list.length * rdEdges.length);
    const c = new THREE.Color();
    list.forEach((cell, i) => {
      colorOf(cell, c);
      for (let j = 0; j < rdEdges.length; j += 3) {
        const o = i * rdEdges.length + j;
        pos[o] = rdEdges[j] + cell[0]; pos[o + 1] = rdEdges[j + 1] + cell[1]; pos[o + 2] = rdEdges[j + 2] + cell[2];
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
  }
  function instanced(list, material, colorOf) {
    const m = new THREE.InstancedMesh(rdGeometry, material, list.length);
    const matrix = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((cell, i) => {
      m.setMatrixAt(i, matrix.makeTranslation(...cell));
      if (colorOf) m.setColorAt(i, colorOf(cell, c));
    });
    return m;
  }
  function openSlots() {
    const out = new Map();
    for (const c of cells.values()) for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const n = [c[0] + dx, c[1] + dy, c[2] + dz];
      if (!cells.has(keyOf(n))) out.set(keyOf(n), n);
    }
    return [...out.values()];
  }

  // The build drawn as ONE fused surface: only the faces that can be seen.
  // Opaque: a face touching another piece is hidden, so it's left out and
  // only the hull's skin is drawn. Translucent and Skeleton also keep the
  // faces between two shells (once, from the inner piece), so the bands
  // show as nested skins. Pieces stay separate in the data; a tap finds
  // its piece and face from the triangle it hit.
  function buildSkin(showBands) {
    const shell = new Map();
    for (const [k, c] of cells) shell.set(k, shellOf(c));
    const pos = [], col = [], edge = [], edgeCol = [];
    skinTris = [];
    const c = new THREE.Color(), e = new THREE.Color();
    for (const [k, cell] of cells) {
      const n = shell.get(k);
      shellColor(n, c);
      if (skeleton) e.copy(c); else e.setHex(EDGE_COLOR);
      NEIGHBOR_OFFSETS.forEach(([dx, dy, dz], f) => {
        const nk = keyOf([cell[0] + dx, cell[1] + dy, cell[2] + dz]);
        const ns = shell.get(nk);
        if (ns !== undefined && !(showBands && n < ns)) return;
        const q = FACES[f].map((v) => [v[0] + cell[0], v[1] + cell[1], v[2] + cell[2]]);
        for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...q[i]); col.push(c.r, c.g, c.b); }
        skinTris.push({ cell, f }, { cell, f });
        for (let i = 0; i < 4; i++) { edge.push(...q[i], ...q[(i + 1) % 4]); edgeCol.push(e.r, e.g, e.b, e.r, e.g, e.b); }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, pieceMaterial);
    mesh.userData.shells = 'skin';
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(edgeCol, 3));
    return { mesh, lines: new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true })) };
  }

  function rebuild() {
    renderInfo();
    clearGroup();
    if (!active) return;
    if (cells.size) {
      pieceMaterial.transparent = opacity < 1;
      pieceMaterial.opacity = opacity;
      pieceMaterial.depthWrite = opacity >= 1;
      const { mesh, lines } = buildSkin(opacity < 1 || skeleton);
      skinMesh = mesh;
      skinMesh.visible = !skeleton;
      group.add(skinMesh, lines);
      pickTargets.push(skinMesh);
    } else {
      // An empty world: the cyan outline where the centre goes.
      firstMesh = new THREE.Mesh(rdGeometry.clone(), firstMaterial);
      firstMesh.userData.shells = 'first';
      group.add(firstMesh);
      pickTargets.push(firstMesh);
      group.add(edgesFor([[0, 0, 0]], (_, c) => c.setHex(FIRST_COLOR)));
    }
    if (latticeView && cells.size) {
      slotCells = openSlots();
      slotsMesh = instanced(slotCells, slotMaterial);
      slotsMesh.userData.shells = 'slot';
      group.add(slotsMesh);
      pickTargets.push(slotsMesh);
    }
    renderPanel();
  }

  // ---- building ----
  function commit() { save(); rebuild(); onChange(); }
  function place(cell) {
    if (cells.has(keyOf(cell))) return false;
    cells.set(keyOf(cell), cell);
    if (!centre) centre = cell;
    commit();
    return true;
  }
  function remove(cell) {
    cells.delete(keyOf(cell));
    if (!cells.size) centre = null;
    commit();
    return true;
  }
  // + Shell: the innermost shell with a missing piece gets all of them.
  function addShell() {
    if (!centre) { place([0, 0, 0]); return; }
    for (let n = 1; ; n++) {
      const missing = hullShell(view.hull, n, centre).filter((c) => !cells.has(keyOf(c)));
      if (!missing.length) continue;
      if (cells.size + missing.length > MAX_PIECES) {
        showHudPrompt(t('hull.prompt.limit', lang(), { max: MAX_PIECES }), 3500);
        return;
      }
      for (const c of missing) cells.set(keyOf(c), c);
      commit();
      // Keep the whole hull in view: its farthest piece plus one RD.
      let r = 0;
      for (const c of cells.values()) r = Math.max(r, Math.hypot(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]));
      fitView(centre, r + 1);
      showHudPrompt(tn('hull.prompt.added', lang(), missing.length, { shell: n }), 2500);
      return;
    }
  }
  // − Shell: the outermost shell present goes (the centre last).
  function removeShell() {
    if (!cells.size) return;
    let top = 0;
    for (const c of cells.values()) top = Math.max(top, shellOf(c));
    for (const [k, c] of cells) if (shellOf(c) === top) cells.delete(k);
    if (!cells.size) centre = null;
    commit();
    showHudPrompt(t('hull.prompt.removed', lang(), { shell: top }), 2500);
  }
  function handleTap(hit, mode) {
    const kind = hit.object.userData.shells;
    if (kind === 'first') return mode === 'chisel' ? false : place([0, 0, 0]);
    if (kind === 'slot') return mode === 'chisel' ? false : place(slotCells[hit.instanceId]);
    const tri = kind === 'skin' ? skinTris[hit.faceIndex] : null;
    if (!tri) return false;
    if (mode === 'chisel') return remove(tri.cell);
    // The neighbour across the tapped face.
    const o = NEIGHBOR_OFFSETS[tri.f];
    return place([tri.cell[0] + o[0], tri.cell[1] + o[1], tri.cell[2] + o[2]]);
  }

  // ---- info ----
  const info = document.createElement('div');
  info.id = 'worldshells-info';
  info.className = 'qc-info';
  info.setAttribute('aria-live', 'polite');
  document.body.appendChild(info);
  const INFO_SHELL_ROWS = 8;
  function renderInfo() {
    const show = active && infoOpen;
    info.classList.toggle('visible', show);
    if (!show) return;
    const L = lang();
    const row = (k, v) => `<div><span class="w4d-info-k">${k}</span> ${v}</div>`;
    if (!centre) { info.innerHTML = row(t('hull.info.hull', L), t(HULL_LABEL_KEY[view.hull], L)) + row(t('hull.info.pieces', L), t('hull.info.none', L)); return; }
    const have = new Map();
    for (const c of cells.values()) { const n = shellOf(c); have.set(n, (have.get(n) ?? 0) + 1); }
    const top = Math.max(...have.keys());
    let complete = 0;
    const rows = [];
    for (let n = 1; n <= top; n++) {
      const total = hullShell(view.hull, n, centre).length;
      const got = have.get(n) ?? 0;
      if (got === total && complete === n - 1) complete = n;
      rows.push(t('hull.info.shellRow', L, { n, have: got, total }));
    }
    info.innerHTML = [
      row(t('hull.info.hull', L), t(HULL_LABEL_KEY[view.hull], L)),
      row(t('hull.info.centre', L), `(${centre.join(', ')})`),
      row(t('hull.info.pieces', L), String(cells.size)),
      row(t('hull.info.shells', L), t('hull.info.complete', L, { n: complete })),
      ...rows.slice(-INFO_SHELL_ROWS).map((r) => `<div class="hull-shell-row">${r}</div>`),
    ].join('');
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'worldshells-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row"><label class="hull-pick"><span class="hull-pick-label"></span> <select class="hull-select"></select></label></div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const select = panel.querySelector('.hull-select');
  const optionsRow = panel.querySelector('.w4d-options');
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    panel.querySelector('.hull-pick-label').textContent = t('hull.label', L);
    select.innerHTML = HULL_IDS.map((h) => `<option value="${h}"${h === view.hull ? ' selected' : ''}>${t(HULL_LABEL_KEY[h], L)}</option>`).join('');
    optionsRow.innerHTML = [
      `<button type="button" data-opt="remove"${cells.size ? '' : ' hidden'}>${t('hull.removeShell', L)}</button>`,
      `<button type="button" data-opt="add">${t('hull.addShell', L)}</button>`,
      `<button type="button" data-opt="info" class="${infoOpen ? 'active' : ''}">${t('hyper.info', L)}</button>`,
    ].join('');
  }
  select.addEventListener('change', () => {
    if (!HULL_IDS.includes(select.value)) return;
    view.hull = select.value;
    save(); rebuild();
    showHudPrompt(t('hull.prompt.hull', lang(), { name: t(HULL_LABEL_KEY[view.hull], lang()) }), 3000);
  });
  optionsRow.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-opt]');
    if (!b) return;
    if (b.dataset.opt === 'add') addShell();
    else if (b.dataset.opt === 'remove') removeShell();
    else if (b.dataset.opt === 'info') { infoOpen = !infoOpen; rebuild(); }
  });
  // A language change redraws the panel and Info (not on every setting).
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
    get isEmpty() { return cells.size === 0; },
    get pieceCount() { return cells.size; },
    clear() { cells.clear(); centre = null; commit(); },
    // Undo (render.js's history): the pieces and the centre, never the hull.
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); rebuild(); onChange(); },
    // Export/Import bundle entry.
    toJSON,
  };
}
