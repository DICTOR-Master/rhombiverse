// Shells: a 3D world of its own for building hulls out of shells of RDs
// (docs/PLAN-SHELLS.md). Listed as a 3D lattice ('tool:shellsWorld');
// while it's on, render.js routes every tap here (the same own-world path
// as 4D/5D/6D) and hides the other 3D worlds.
//
// The first piece placed is the centre. Every piece is coloured by its
// shell -- counted out from the centre by the chosen hull shape (Steps =
// cuboctahedron, Distance = sphere, or a target: tetrahedron, cube,
// octahedron, RD, truncated octahedron) -- in the old Shells hue step.
//
// A cell holds a whole RD or fragments: pieces of the RD's symmetric
// splits (rd-pieces.js), each (split, symmetry element). Build mode: tap a
// face to add the Piece chosen in its dropdown there (Whole: the RD across
// the face; a split: that split's piece under the finger, across an outer
// face or inside the same cell across a cut), long-press to remove.
// Fragment mode: tap a piece to target its cell, pick a breakdown, Turn
// cycles the cut's orientation. + Shell fills the innermost unfinished
// shell with whole RDs, − Shell removes the outermost.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, facePieces, NEIGHBOR_OFFSETS } from '../core/lattice.js';
import { HULL_IDS, hullShell, hullShellOf, SPLITS, SPLIT_BY_ID, pieceSolid, splitOrientations, pieceAt, piecesOverlap } from '../geometry-extensions/rd-pieces.js';
import { t, tn } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-shells-world';
const FIRST_COLOR = 0x00e5ff;
const SLOT_COLOR = 0x9de0ff;
const EDGE_COLOR = 0x0b1220;
const TARGET_COLOR = 0xffc857;
// The largest hull + Shell will build (with the fused skin, frame rate
// barely depends on size; measured in stage 2).
export const MAX_PIECES = 4000;
const HULL_LABEL_KEY = {
  steps: 'hull.steps', distance: 'hull.distance', tetrahedron: 'hull.tetrahedron', 'tetrahedron-mirror': 'hull.tetrahedronMirror',
  cube: 'hull.cube', octahedron: 'hull.octahedron', rd: 'hull.rd', to: 'hull.to',
};
const SPLIT_IDS = SPLITS.map((s) => s.id); // 'whole' first
const splitLabel = (id, L) => t(`hull.split.${id}`, L);
const lang = () => getSettings().language;
const keyOf = (c) => c.join(',');
// The old Shells panel's colours: the centre white, shell n a hue step of
// 0.15 round the colour wheel.
const shellColor = (n, out = new THREE.Color()) => (n === 0 ? out.setRGB(1, 1, 1) : out.setHSL((n * 0.15) % 1, 0.65, 0.55));
const isCell = (c) => Array.isArray(c) && c.length === 3 && c.every(Number.isInteger) && (c[0] + c[1] + c[2]) % 2 === 0;

export function createShellsWorld({ scene, onChange = () => {}, showHudPrompt = () => {}, fitView = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  // key -> { c: [x, y, z], parts: null (a whole RD) | [{ split, g }] }
  const cells = new Map();
  let centre = null; // the first piece's cell
  const view = { hull: 'steps', mode: 'build', piece: 'whole' };
  let target = null; // Fragment mode: the targeted cell's key
  let active = false;
  let skeleton = false;
  let opacity = 1; // below 1 in World View: Translucent
  let latticeView = false;
  let infoOpen = false;

  const shellOf = (c) => (centre ? hullShellOf(view.hull, c, centre) : 0);
  // The orientation (index into splitOrientations) a cell's pieces belong
  // to: the first one holding all of them; -1 if they're mixed.
  function orientationOf(parts) {
    const split = parts?.[0]?.split;
    if (!split || !parts.every((p) => p.split === split)) return -1;
    return splitOrientations(split).findIndex((gs) => parts.every((p) => gs.includes(p.g)));
  }
  const isWhole = (k) => cells.get(k)?.parts === null;

  function setFromJSON(data) {
    cells.clear();
    centre = null;
    for (const c of Array.isArray(data?.cells) ? data.cells : []) if (isCell(c)) cells.set(keyOf(c), { c: [...c], parts: null });
    for (const p of Array.isArray(data?.parts) ? data.parts : []) {
      if (!isCell(p?.c) || !SPLIT_BY_ID.has(p.split) || p.split === 'whole' || !Number.isInteger(p.g) || p.g < 0 || p.g > 47) continue;
      const k = keyOf(p.c);
      if (isWhole(k)) continue;
      if (!cells.has(k)) cells.set(k, { c: [...p.c], parts: [] });
      cells.get(k).parts.push({ split: p.split, g: p.g });
    }
    const k = Array.isArray(data?.centre) ? keyOf(data.centre) : null;
    if (k && cells.has(k)) centre = cells.get(k).c;
    else if (cells.size) centre = [...cells.values()][0].c;
    if (target && !cells.has(target)) target = null;
  }
  const toJSON = () => ({
    cells: [...cells.values()].filter((e) => e.parts === null).map((e) => e.c),
    parts: [...cells.values()].filter((e) => e.parts).flatMap((e) => e.parts.map((p) => ({ c: e.c, split: p.split, g: p.g }))),
    centre,
  });
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      setFromJSON(data);
      if (HULL_IDS.includes(data.view?.hull)) view.hull = data.view.hull;
      if (data.view?.mode === 'fragment') view.mode = 'fragment';
      if (SPLIT_IDS.includes(data.view?.piece)) view.piece = data.view.piece;
    } catch { /* corrupt or blocked storage: start empty */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, ...toJSON(), view })); } catch { /* best-effort */ }
  }
  load();

  // ---- geometry ----
  const rdGeometry = new ConvexGeometry(rdRawVerts(1).map((v) => new THREE.Vector3(...v)));
  const rdEdges = new THREE.EdgesGeometry(rdGeometry).getAttribute('position').array;
  // RD face i is the one shared with the neighbour at NEIGHBOR_OFFSETS[i].
  const FACES = facePieces(1).map((f) => f.base);
  const pieceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const slotMaterial = new THREE.MeshStandardMaterial({ color: SLOT_COLOR, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.12, depthWrite: false });
  let slotCells = [], skinTris = [], partTris = [], ghostParts = [];
  const pickTargets = [];

  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.isInstancedMesh) child.dispose();
      else if (child.isLineSegments || child.isMesh) child.geometry.dispose();
      if (child.isLineSegments) child.material.dispose();
    }
    pickTargets.length = 0;
  }
  // RD outlines at these cells, in one colour.
  function rdOutlines(list, color) {
    const pos = new Float32Array(list.length * rdEdges.length);
    list.forEach((cell, i) => {
      for (let j = 0; j < rdEdges.length; j += 3) {
        const o = i * rdEdges.length + j;
        pos[o] = rdEdges[j] + cell[0]; pos[o + 1] = rdEdges[j + 1] + cell[1]; pos[o + 2] = rdEdges[j + 2] + cell[2];
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
  }
  function instanced(list, material) {
    const m = new THREE.InstancedMesh(rdGeometry, material, list.length);
    const matrix = new THREE.Matrix4();
    list.forEach((cell, i) => m.setMatrixAt(i, matrix.makeTranslation(...cell)));
    return m;
  }
  function openSlots() {
    const out = new Map();
    for (const { c } of cells.values()) for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const n = [c[0] + dx, c[1] + dy, c[2] + dz];
      if (!cells.has(keyOf(n))) out.set(keyOf(n), n);
    }
    return [...out.values()];
  }
  // A mesh + outline builder: faces as loops of points, one colour each.
  function meshBuilder() {
    const pos = [], col = [], edge = [], edgeCol = [];
    return {
      face(q, c, e) {
        for (let i = 1; i + 1 < q.length; i++) for (const j of [0, i, i + 1]) { pos.push(...q[j]); col.push(c.r, c.g, c.b); }
        for (let i = 0; i < q.length; i++) { edge.push(...q[i], ...q[(i + 1) % q.length]); edgeCol.push(e.r, e.g, e.b, e.r, e.g, e.b); }
        return q.length - 2; // triangles added
      },
      build(material, tag) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, material);
        mesh.userData.shells = tag;
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
        lg.setAttribute('color', new THREE.Float32BufferAttribute(edgeCol, 3));
        return { mesh, lines: new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true })) };
      },
    };
  }

  // Whole RDs drawn as ONE fused surface of the faces that can be seen: a
  // face against another whole RD is left out, so only the hull's skin is
  // drawn (the hidden core costs nothing). Translucent and Skeleton keep
  // the faces between two shells (once, from the inner piece) so the bands
  // show as nested skins. Faces next to a fragmented cell are drawn.
  function buildSkin(showBands, shell) {
    const b = meshBuilder();
    skinTris = [];
    const c = new THREE.Color(), e = new THREE.Color();
    for (const [k, { c: cell, parts }] of cells) {
      if (parts) continue;
      const n = shell.get(k);
      shellColor(n, c);
      if (skeleton) e.copy(c); else e.setHex(EDGE_COLOR);
      NEIGHBOR_OFFSETS.forEach(([dx, dy, dz], f) => {
        const nk = keyOf([cell[0] + dx, cell[1] + dy, cell[2] + dz]);
        if (isWhole(nk) && !(showBands && n < shell.get(nk))) return;
        const q = FACES[f].map((v) => [v[0] + cell[0], v[1] + cell[1], v[2] + cell[2]]);
        const tris = b.face(q, c, e);
        for (let i = 0; i < tris; i++) skinTris.push({ key: k, f });
      });
    }
    return b.build(pieceMaterial, 'skin');
  }
  // Fragments: every piece's faces, except those lying on its RD's outer
  // face against a whole neighbour.
  function buildParts(shell) {
    const b = meshBuilder();
    partTris = [];
    const c = new THREE.Color(), e = new THREE.Color();
    for (const [k, { c: cell, parts }] of cells) {
      if (!parts) continue;
      shellColor(shell.get(k), c);
      parts.forEach((p, pi) => {
        if (skeleton) e.copy(c); else e.setHex(EDGE_COLOR);
        const solid = pieceSolid(p.split, p.g, cell);
        for (const loop of solid.faces) {
          const q = loop.map((i) => solid.verts[i]);
          const m = q.reduce((s, v) => [s[0] + v[0] / q.length, s[1] + v[1] / q.length, s[2] + v[2] / q.length], [0, 0, 0]);
          const f = NEIGHBOR_OFFSETS.findIndex((o) => Math.abs(o[0] * (m[0] - cell[0]) + o[1] * (m[1] - cell[1]) + o[2] * (m[2] - cell[2]) - 1) < 1e-7);
          if (f >= 0 && isWhole(keyOf([cell[0] + NEIGHBOR_OFFSETS[f][0], cell[1] + NEIGHBOR_OFFSETS[f][1], cell[2] + NEIGHBOR_OFFSETS[f][2]]))) continue;
          const tris = b.face(q, c, e);
          for (let i = 0; i < tris; i++) partTris.push({ key: k, part: pi, f });
        }
      });
    }
    return b.build(pieceMaterial, 'parts');
  }
  // Lattice View in a fragmented cell: its missing pieces (of the split it
  // was last broken into) as ghosts, tap to put one back.
  function buildGhostParts() {
    const b = meshBuilder();
    ghostParts = [];
    const c = new THREE.Color(SLOT_COLOR), e = new THREE.Color(SLOT_COLOR);
    for (const [k, { c: cell, parts }] of cells) {
      const o = orientationOf(parts);
      if (o < 0) continue;
      const split = parts[0].split;
      const gs = splitOrientations(split)[o];
      for (const g of gs) {
        if (parts.some((p) => p.g === g)) continue;
        const solid = pieceSolid(split, g, cell);
        for (const loop of solid.faces) {
          const tris = b.face(loop.map((i) => solid.verts[i]), c, e);
          for (let i = 0; i < tris; i++) ghostParts.push({ key: k, split, g });
        }
      }
    }
    return ghostParts.length ? b.build(slotMaterial, 'ghostPart') : null;
  }

  function rebuild() {
    renderInfo();
    clearGroup();
    if (!active) return;
    if (cells.size) {
      pieceMaterial.transparent = opacity < 1;
      pieceMaterial.opacity = opacity;
      pieceMaterial.depthWrite = opacity >= 1;
      const shell = new Map();
      for (const [k, { c }] of cells) shell.set(k, shellOf(c));
      for (const { mesh, lines } of [buildSkin(opacity < 1 || skeleton, shell), buildParts(shell)]) {
        mesh.visible = !skeleton;
        group.add(mesh, lines);
        pickTargets.push(mesh);
      }
    } else {
      // An empty world: the cyan outline where the centre goes.
      const first = new THREE.Mesh(rdGeometry.clone(), firstMaterial);
      first.userData.shells = 'first';
      group.add(first, rdOutlines([[0, 0, 0]], FIRST_COLOR));
      pickTargets.push(first);
    }
    if (view.mode === 'fragment' && target && cells.has(target)) group.add(rdOutlines([cells.get(target).c], TARGET_COLOR));
    if (latticeView && cells.size) {
      slotCells = openSlots();
      const slots = instanced(slotCells, slotMaterial);
      slots.userData.shells = 'slot';
      group.add(slots);
      pickTargets.push(slots);
      const ghosts = buildGhostParts();
      if (ghosts) { group.add(ghosts.mesh, ghosts.lines); pickTargets.push(ghosts.mesh); }
    }
    renderPanel();
  }

  // ---- building ----
  function commit() { save(); rebuild(); onChange(); }
  function placeWhole(cell) {
    if (cells.has(keyOf(cell))) return false;
    cells.set(keyOf(cell), { c: cell, parts: null });
    if (!centre) centre = cell;
    commit();
    return true;
  }
  // Loose placement: the piece of `split` in `cell` under `point`, if it
  // doesn't overlap what the cell already holds.
  function placePart(split, cell, point) {
    const k = keyOf(cell);
    if (isWhole(k)) return false;
    const hit = pieceAt(split, cell, point);
    if (!hit) return false;
    const entry = cells.get(k);
    const piece = { split, g: hit.g, cell };
    if (entry?.parts.some((p) => piecesOverlap(piece, { ...p, cell }))) {
      showHudPrompt(t('hull.prompt.noFit', lang()), 2500);
      return false;
    }
    if (entry) entry.parts.push({ split, g: hit.g });
    else cells.set(k, { c: cell, parts: [{ split, g: hit.g }] });
    if (!centre) centre = cell;
    commit();
    return true;
  }
  function removeCell(k) {
    cells.delete(k);
    if (target === k) target = null;
    if (!cells.size) centre = null;
    commit();
    return true;
  }
  function removePart(k, pi) {
    const entry = cells.get(k);
    entry.parts.splice(pi, 1);
    if (!entry.parts.length) return removeCell(k);
    commit();
    return true;
  }
  // Fragment mode: break the target cell into `split` (filling any gaps),
  // or make it whole again.
  function applyBreakdown(split) {
    const entry = target && cells.get(target);
    if (!entry) return;
    if (split === 'whole') { entry.parts = null; commit(); return; }
    const ors = splitOrientations(split);
    const o = entry.parts?.[0]?.split === split ? Math.max(0, orientationOf(entry.parts)) : 0;
    entry.parts = ors[o].map((g) => ({ split, g }));
    commit();
  }
  function turnTarget() {
    const entry = target && cells.get(target);
    const split = entry?.parts?.[0]?.split;
    if (!split) return;
    const ors = splitOrientations(split);
    const o = (Math.max(0, orientationOf(entry.parts)) + 1) % ors.length;
    entry.parts = ors[o].map((g) => ({ split, g }));
    commit();
  }
  // + Shell: the innermost shell with a missing cell gets whole RDs there.
  function addShell() {
    if (!centre) { placeWhole([0, 0, 0]); return; }
    for (let n = 1; ; n++) {
      const missing = hullShell(view.hull, n, centre).filter((c) => !cells.has(keyOf(c)));
      if (!missing.length) continue;
      if (cells.size + missing.length > MAX_PIECES) {
        showHudPrompt(t('hull.prompt.limit', lang(), { max: MAX_PIECES }), 3500);
        return;
      }
      for (const c of missing) cells.set(keyOf(c), { c, parts: null });
      commit();
      // Keep the whole hull in view: its farthest piece plus one RD.
      let r = 0;
      for (const { c } of cells.values()) r = Math.max(r, Math.hypot(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]));
      fitView(centre, r + 1);
      showHudPrompt(tn('hull.prompt.added', lang(), missing.length, { shell: n }), 2500);
      return;
    }
  }
  // − Shell: the outermost shell present goes (the centre last).
  function removeShell() {
    if (!cells.size) return;
    let top = 0;
    for (const { c } of cells.values()) top = Math.max(top, shellOf(c));
    for (const [k, { c }] of cells) if (shellOf(c) === top) { cells.delete(k); if (target === k) target = null; }
    if (!cells.size) centre = null;
    commit();
    showHudPrompt(t('hull.prompt.removed', lang(), { shell: top }), 2500);
  }
  function handleTap(hit, mode) {
    const kind = hit.object.userData.shells;
    const chisel = mode === 'chisel';
    if (kind === 'first') return chisel ? false : placeWhole([0, 0, 0]);
    if (kind === 'slot') return chisel ? false : placeWhole(slotCells[hit.instanceId]);
    if (kind === 'ghostPart') {
      const gp = ghostParts[hit.faceIndex];
      if (chisel || !gp) return false;
      cells.get(gp.key).parts.push({ split: gp.split, g: gp.g });
      commit();
      return true;
    }
    const tri = kind === 'skin' ? skinTris[hit.faceIndex] : kind === 'parts' ? partTris[hit.faceIndex] : null;
    if (!tri) return false;
    if (chisel) return kind === 'skin' ? removeCell(tri.key) : removePart(tri.key, tri.part);
    if (view.mode === 'fragment') { target = tri.key; rebuild(); return true; }
    // Build: across an outer RD face into the next cell, or (a fragment's
    // cut face) into the same cell.
    const cell = cells.get(tri.key).c;
    const into = tri.f >= 0 ? NEIGHBOR_OFFSETS[tri.f].map((o, i) => cell[i] + o) : cell;
    if (view.piece === 'whole') return into === cell ? false : placeWhole(into);
    const n = hit.face.normal;
    const p = [hit.point.x + n.x * 0.02, hit.point.y + n.y * 0.02, hit.point.z + n.z * 0.02];
    return placePart(view.piece, into, p);
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
    let fragments = 0;
    for (const { c, parts } of cells.values()) {
      const n = shellOf(c);
      have.set(n, (have.get(n) ?? 0) + 1);
      if (parts) fragments += parts.length;
    }
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
      fragments ? row(t('hull.info.fragments', L), String(fragments)) : '',
      row(t('hull.info.shells', L), t('hull.info.complete', L, { n: complete })),
      ...rows.slice(-INFO_SHELL_ROWS).map((r) => `<div class="hull-shell-row">${r}</div>`),
    ].join('');
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'worldshells-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row">
      <label class="hull-pick"><span class="hull-pick-label"></span> <select class="hull-select" data-select="hull"></select></label>
      <label class="hull-pick hull-piece-pick"><span class="hull-piece-label"></span> <select class="hull-select" data-select="piece"></select></label>
    </div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const hullSelect = panel.querySelector('[data-select="hull"]');
  const pieceSelect = panel.querySelector('[data-select="piece"]');
  const piecePick = panel.querySelector('.hull-piece-pick');
  const optionsRow = panel.querySelector('.w4d-options');
  // The target's breakdown: its split if it holds one split's pieces.
  const targetSplit = () => {
    const parts = target && cells.get(target)?.parts;
    if (parts === null) return 'whole';
    return parts?.length && parts.every((p) => p.split === parts[0].split) ? parts[0].split : '';
  };
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    const fragment = view.mode === 'fragment';
    panel.querySelector('.hull-pick-label').textContent = t('hull.label', L);
    hullSelect.innerHTML = HULL_IDS.map((h) => `<option value="${h}"${h === view.hull ? ' selected' : ''}>${t(HULL_LABEL_KEY[h], L)}</option>`).join('');
    // Build: the Piece to place. Fragment: the target's breakdown (hidden
    // until a piece is targeted).
    panel.querySelector('.hull-piece-label').textContent = t(fragment ? 'hull.breakdown' : 'hull.piece', L);
    const current = fragment ? targetSplit() : view.piece;
    pieceSelect.innerHTML = (current === '' ? `<option value="" selected>${t('hull.split.mixed', L)}</option>` : '')
      + SPLIT_IDS.map((id) => `<option value="${id}"${id === current ? ' selected' : ''}>${splitLabel(id, L)}</option>`).join('');
    piecePick.hidden = fragment && !(target && cells.has(target));
    const turnable = fragment && target && cells.get(target)?.parts?.length && targetSplit() && splitOrientations(targetSplit()).length > 1;
    optionsRow.innerHTML = [
      `<button type="button" data-opt="mode" class="${fragment ? 'active' : ''}">${t(fragment ? 'hull.mode.fragment' : 'hull.mode.build', L)}</button>`,
      turnable ? `<button type="button" data-opt="turn">${t('hull.turn', L)}</button>` : '',
      fragment ? '' : `<button type="button" data-opt="remove"${cells.size ? '' : ' hidden'}>${t('hull.removeShell', L)}</button>`,
      fragment ? '' : `<button type="button" data-opt="add">${t('hull.addShell', L)}</button>`,
      `<button type="button" data-opt="info" class="${infoOpen ? 'active' : ''}">${t('hyper.info', L)}</button>`,
    ].join('');
  }
  hullSelect.addEventListener('change', () => {
    if (!HULL_IDS.includes(hullSelect.value)) return;
    view.hull = hullSelect.value;
    save(); rebuild();
    showHudPrompt(t('hull.prompt.hull', lang(), { name: t(HULL_LABEL_KEY[view.hull], lang()) }), 3000);
  });
  pieceSelect.addEventListener('change', () => {
    if (!SPLIT_IDS.includes(pieceSelect.value)) return;
    if (view.mode === 'fragment') { applyBreakdown(pieceSelect.value); return; }
    view.piece = pieceSelect.value;
    save(); renderPanel();
  });
  optionsRow.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-opt]');
    if (!b) return;
    if (b.dataset.opt === 'add') addShell();
    else if (b.dataset.opt === 'remove') removeShell();
    else if (b.dataset.opt === 'turn') turnTarget();
    else if (b.dataset.opt === 'info') { infoOpen = !infoOpen; rebuild(); }
    else if (b.dataset.opt === 'mode') {
      view.mode = view.mode === 'fragment' ? 'build' : 'fragment';
      target = null;
      save(); rebuild();
      if (view.mode === 'fragment') showHudPrompt(t('hull.prompt.target', lang()), 3500);
    }
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
    clear() { cells.clear(); centre = null; target = null; commit(); },
    // Undo (render.js's history): the pieces and the centre, never the view.
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); rebuild(); onChange(); },
    // Export/Import bundle entry.
    toJSON,
  };
}
