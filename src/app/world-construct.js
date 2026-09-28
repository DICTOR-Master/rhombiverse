// 1D Construct: a world of its own (Wizard → 1D → Construct), the
// construction microscope of DICTO's Dimensional Construction Interface
// (docs/DIMENSIONAL_CONSTRUCTION_INTERFACE.md; model and rules in
// geometry-extensions/construction.js).
//
// Stage B (2026-09-29): the square. Start with one X line of unfilled
// cells; tap to fill them in order (●—●—○). A full X line reaches a
// junction at the origin that exposes Y (X stays); Y lines then grow from
// every reached point, and X lines parallel to the first from every point
// Y reaches, until the square emerges from its cells. Every cell keeps
// the colour of the direction it was built along (provenance, not
// decoration), so Paint is off here. Cells are the shared bullet cell,
// nose along their axis. A finished square opens in 2D as the Square
// lattice's own tile ("same animal, different zoo").
import * as THREE from 'three';
import { createConstruction, axisName, AXIS_COLORS, N_MIN, N_MAX } from '../geometry-extensions/construction.js';
import { bulletGeometry } from './bullet-cell.js';
import { createGearedSlider } from './geared-slider.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-construct-world';
const U = 1; // world units per cell
const R = 0.1;
const PAD = 0.08;
const PRIMITIVE = { id: 'square', label: 'Square', d: 2 };
const lang = () => getSettings().language;

export function createConstructWorld({ scene, camera, controls, onOpenIn = () => {}, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  let n = 3;
  let saved = null;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data) { if (Number.isInteger(data.n) && data.n >= N_MIN && data.n <= N_MAX) n = data.n; saved = data; }
  } catch { /* corrupt or blocked storage: start empty */ }
  let con = createConstruction(PRIMITIVE.d, n, saved);
  let active = false;
  let wasComplete = con.complete();
  const toJSON = () => ({ primitive: PRIMITIVE.id, n, ...con.toJSON() });
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON() })); } catch { /* best-effort */ }
  }

  // ---- drawing ----
  const geo = bulletGeometry(U, R, PAD);
  const filledMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide });
  // Cells you can fill next glow orange, the 1D worlds' "tap here".
  const availableMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.35, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const unavailableMat = new THREE.MeshStandardMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -0.02;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  const layer = new THREE.Group();
  group.add(layer);
  let junctionMesh = null, faceMesh = null;
  const world = (p) => new THREE.Vector3(p[0] * U, (p[1] ?? 0) * U, 0);
  const mid = (c) => world(c.from).add(world(c.to)).multiplyScalar(0.5);

  function clearLayer() {
    for (const child of [...layer.children]) { layer.remove(child); if (child.isInstancedMesh) child.dispose(); }
    junctionMesh = null;
    faceMesh = null;
  }
  function draw() {
    clearLayer();
    if (!active) return;
    const st = con.states();
    const lists = { filled: [], available: [], unavailable: [] };
    con.grid.cells.forEach((c, i) => lists[st[i]].push(c));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    for (const [kind, mat] of [['filled', filledMat], ['available', availableMat], ['unavailable', unavailableMat]]) {
      const list = lists[kind];
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((c, i) => {
        const dir = world(c.to).sub(world(c.from)).normalize();
        q.setFromUnitVectors(up, dir);
        const p = mid(c);
        p.z = R;
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        if (kind === 'filled') mesh.setColorAt(i, color.setHex(AXIS_COLORS[axisName(c.dir)]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      layer.add(mesh);
    }
    // The junction: a glowing point in the colour of the direction it
    // would expose.
    const j = con.junction();
    if (j) {
      junctionMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 2.2, 20, 14), new THREE.MeshBasicMaterial({ color: AXIS_COLORS[axisName(j.exposes)], transparent: true, opacity: 0.85 }));
      junctionMesh.position.copy(world(j.at)).setZ(R);
      layer.add(junctionMesh);
    }
    // The primitive, once it has emerged: its face, faintly.
    if (con.complete()) {
      faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(n * U, n * U), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.12, depthWrite: false }));
      faceMesh.position.set((n * U) / 2, (n * U) / 2, -0.005);
      layer.add(faceMesh);
    }
    renderPanel();
  }
  function frame() {
    const c = new THREE.Vector3((n * U) / 2, (n * U) / 2, 0);
    controls.target.copy(c);
    camera.position.set(c.x, c.y, Math.max(8, n * 2.6));
    controls.update();
  }

  // ---- building ----
  function commit() {
    save(); draw(); onChange();
    const done = con.complete();
    if (done && !wasComplete) showHudPrompt(t('con.prompt.done', lang(), { name: PRIMITIVE.label, n: con.grid.cells.length }), 5000);
    wasComplete = done;
  }
  function nearest(point, kind, reach = 0.7) {
    const st = con.states();
    let best = null;
    con.grid.cells.forEach((c, i) => {
      if (st[i] !== kind) return;
      const d = mid(c).distanceTo(point);
      if (d <= reach && (!best || d < best.d)) best = { id: i, d };
    });
    return best?.id ?? null;
  }
  function handleTap(hit, mode) {
    if (!hit?.point || mode === 'paint') return false;
    const p = new THREE.Vector3(hit.point.x, hit.point.y, 0);
    if (mode === 'chisel') {
      const id = nearest(p, 'filled');
      if (id === null) return false;
      if (!con.unfill(id)) { showHudPrompt(t('con.prompt.locked', lang()), 3000); return true; }
      commit();
      return true;
    }
    const j = con.junction();
    if (j && world(j.at).distanceTo(p) < 0.45) return exposeNext();
    const id = nearest(p, 'available');
    if (id === null) return false;
    con.fill(id);
    commit();
    if (con.junction() && !j) showHudPrompt(t('con.prompt.junction', lang(), { axis: axisName(con.junction().exposes) }), 4500);
    return true;
  }
  function exposeNext() {
    if (!con.expose()) return false;
    commit();
    return true;
  }
  function setN(k) {
    if (k === n) return;
    n = k;
    con = createConstruction(PRIMITIVE.d, n);
    wasComplete = false;
    commit();
    frame();
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'world1dconstruct-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row w4d-controls con-axes"></div>
    <div class="w4d-track" role="slider"><div class="w4d-ticks"></div><div class="w4d-thumb"></div></div>
    <div class="w4d-row w4d-options con-options"></div>`;
  document.body.appendChild(panel);
  const axesRow = panel.querySelector('.con-axes');
  const optionsRow = panel.querySelector('.con-options');
  const toSlider = (k) => -1 + (2 * (k - N_MIN)) / (N_MAX - N_MIN);
  const slider = createGearedSlider(panel.querySelector('.w4d-track'), {
    value: () => toSlider(n),
    setValue: (v) => { const k = Math.round(N_MIN + ((v + 1) / 2) * (N_MAX - N_MIN)); if (k !== n) { setN(k); slider.render(); } },
    limit: () => 1,
    perSweep: () => 2,
    detents: () => Array.from({ length: N_MAX - N_MIN + 1 }, (_, i) => ({ v: toSlider(N_MIN + i), label: String(N_MIN + i) })),
    snap: () => 1,
  });
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    const j = con.junction();
    // Axis symbols: exposed (in their colour), ready at a junction
    // (outlined, tappable), not yet available (faded, inert).
    axesRow.innerHTML = [...Array(PRIMITIVE.d).keys()].map((a) => {
      const name = axisName(a);
      const hex = `#${AXIS_COLORS[name].toString(16).padStart(6, '0')}`;
      const state = a < con.exposed ? 'on' : j && j.exposes === a ? 'ready' : 'off';
      return `<button type="button" class="con-axis con-axis-${state}" data-axis="${a}" style="--axis:${hex}"${state === 'off' ? ' disabled' : ''}>${name}</button>`;
    }).join('') + `<span class="con-progress">${t('con.progress', L, con.progress())}</span>`;
    optionsRow.innerHTML = `<span class="con-size">${t('con.size', L, { n })}</span>` + (con.complete() ? `<button type="button" data-open="2D">${t('con.open', L, { dim: '2D' })}</button>` : '');
    slider.render();
  }
  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.axis !== undefined) { const j = con.junction(); if (j && j.exposes === Number(b.dataset.axis)) exposeNext(); }
    else if (b.dataset.open) onOpenIn(b.dataset.open, PRIMITIVE.id);
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
      if (!on) panel.classList.remove('visible');
      draw();
      if (on) { frame(); if (!con.progress().filled) showHudPrompt(t('con.prompt.start', lang()), 5000); }
    },
    get isEmpty() { return con.progress().filled === 0; },
    clear() { con = createConstruction(PRIMITIVE.d, n); wasComplete = false; commit(); },
    snapshot: toJSON,
    restore(json) {
      if (Number.isInteger(json?.n) && json.n >= N_MIN && json.n <= N_MAX) n = json.n;
      con = createConstruction(PRIMITIVE.d, n, json);
      wasComplete = con.complete();
      save(); draw(); onChange();
    },
    toJSON,
  };
}
