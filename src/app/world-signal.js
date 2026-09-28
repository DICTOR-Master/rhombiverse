// 1D Signal: a world of its own (Wizard → 1D → Signal), from DICTO's 1D
// Experience Plan. A strictly one-dimensional trajectory
// (geometry-extensions/trajectory-1d.js) carrying Morse code.
//
// Decisions this file implements (plan §9, user 2026-09-29):
// - The trajectory is a chain of cells placed one at a time, tap to add,
//   long-press to remove (the chain closes up: it's one-dimensional).
//   Each cell is a dot, dash or gap, chosen in the panel.
// - Typing a message shows it as ghost cells after the chain; each tap
//   places the next one. The panel reads the chain back as text.
// - Outside (the default): the trajectory drawn in the plane through E(s),
//   a thin filament running on toward infinity both ways. Inside: the
//   observer on the trajectory past the chain's end, looking back down it.
// - Play (user-started, like the Kaleidoscope's Spin): the chain is sent
//   as pulses along the trajectory, forward from its start or back from
//   its end, repeating; both views show the same pulses (one m(t)).
//   Speed on the slider. Breathing and undulation are later.
import * as THREE from 'three';
import { morseSequence, decode, layout, totalUnits, cellUnits, pulsesAt, embed, tangentAngle } from '../geometry-extensions/trajectory-1d.js';
import { createGearedSlider } from './geared-slider.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-signal-world';
const S = 0.35; // world units per unit of s
const R = 0.1; // cell radius (world)
const PAD = 0.07; // space between neighbouring cells (world)
const FIRST_COLOR = 0x00e5ff;
const GHOST_COLOR = 0x9de0ff;
const FILAMENT_COLOR = new THREE.Color(0x9de0ff);
const PULSE_COLOR = 0xfff2c4;
const TYPES = ['dot', 'dash', 'gap'];
const SPEEDS = [0.5, 1, 2, 4, 8, 16]; // units per second
const lang = () => getSettings().language;
const at = (s, z = 0) => { const [x, y] = embed(s); return new THREE.Vector3(x * S, y * S, z); };

export function createSignalWorld({ scene, camera, controls, resetView = () => {}, colorFor, getMaterial, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  let cells = []; // { type, units?, material }
  const view = { type: 'dot', inside: false, speed: 3, dir: 1 };
  let message = '';
  let pending = []; // ghost cells of the typed message still to place
  let active = false;
  let playing = false;
  let playT = 0;

  const validCell = (c) => c && TYPES.includes(c.type) && (c.type !== 'gap' || [1, 3, 7].includes(c.units ?? 1));
  function setFromJSON(data) {
    cells = (Array.isArray(data?.cells) ? data.cells : []).filter(validCell)
      .map((c) => ({ type: c.type, ...(c.type === 'gap' ? { units: c.units ?? 1 } : {}), material: typeof c.material === 'string' ? c.material : 'base' }));
  }
  const toJSON = () => ({ cells: cells.map((c) => ({ ...c })) });
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data) {
      setFromJSON(data);
      if (TYPES.includes(data.view?.type)) view.type = data.view.type;
      if (Number.isInteger(data.view?.speed) && data.view.speed >= 0 && data.view.speed < SPEEDS.length) view.speed = data.view.speed;
      if (data.view?.dir === -1) view.dir = -1;
    }
  } catch { /* corrupt or blocked storage: start empty */ }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON(), view: { type: view.type, speed: view.speed, dir: view.dir } })); } catch { /* best-effort */ }
  }

  // ---- drawing ----
  const geoCache = new Map();
  function capsule(units) {
    if (!geoCache.has(units)) geoCache.set(units, new THREE.CapsuleGeometry(R, Math.max(0.001, units * S - 2 * R - PAD), 6, 12));
    return geoCache.get(units);
  }
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.22, depthWrite: false });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.3, depthWrite: false });
  const gapMaterial = new THREE.MeshStandardMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.1, depthWrite: false });
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: PULSE_COLOR, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -0.02;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  const built = new THREE.Group();
  group.add(built);
  let pulseMesh = null;
  const tmpColor = new THREE.Color();

  function placeCell(mesh, s0, units) {
    const mid = s0 + units / 2;
    mesh.position.copy(at(mid, R));
    mesh.rotation.z = tangentAngle(mid) - Math.PI / 2; // the capsule's own axis is y
  }
  function clearBuilt() {
    for (const child of [...built.children]) {
      built.remove(child);
      if (child.isLine) { child.geometry.dispose(); child.material.dispose(); } else if (child.userData.ownMaterial) child.material.dispose();
    }
  }
  const chainEnd = () => totalUnits(cells);
  function draw() {
    clearBuilt();
    if (!active) return;
    const L = chainEnd();
    // The filament: from far before the start to far past the end,
    // fading out both ways (toward infinity).
    const lo = -60, hi = L + 160;
    const pos = [], col = [];
    for (let s = lo; s <= hi; s += 0.25) {
      const p = at(s, 0.004);
      pos.push(p.x, p.y, p.z);
      const fade = Math.min(1, (s - lo) / 40, (hi - s) / 80);
      col.push(FILAMENT_COLOR.r, FILAMENT_COLOR.g, FILAMENT_COLOR.b, 0.55 * Math.max(0, fade));
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    built.add(new THREE.Line(fg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true })));

    for (const { cell, s0 } of layout(cells)) {
      const units = cellUnits(cell);
      let mesh;
      if (cell.type === 'gap') mesh = new THREE.Mesh(capsule(units), gapMaterial);
      else {
        colorFor(cell, tmpColor);
        mesh = new THREE.Mesh(capsule(units), new THREE.MeshStandardMaterial({ color: tmpColor.clone(), roughness: 0.45, metalness: 0.1 }));
        mesh.userData.ownMaterial = true;
      }
      placeCell(mesh, s0, units);
      built.add(mesh);
    }
    // What a tap adds next: the message's ghosts, else the chosen cell.
    const next = pending.length ? pending : [{ type: view.type, ...(view.type === 'gap' ? { units: 1 } : {}) }];
    let s = L;
    next.forEach((c, i) => {
      const units = cellUnits(c);
      const mesh = new THREE.Mesh(capsule(units), !cells.length && i === 0 ? firstMaterial : ghostMaterial);
      placeCell(mesh, s, units);
      built.add(mesh);
      s += units;
    });
    if (view.inside) aimInside();
    drawPulses();
    renderReadout();
  }

  // Pulses: ribbons along the curve over each span the signal occupies.
  function drawPulses() {
    if (pulseMesh) { group.remove(pulseMesh); pulseMesh.geometry.dispose(); pulseMesh = null; }
    if (!playing || !cells.length) return;
    const L = chainEnd();
    const spans = pulsesAt(cells, playT, { from: view.dir > 0 ? 0 : L, dir: view.dir, lo: -60, hi: L + 160 });
    const pos = [];
    const w = R * 1.35;
    for (const [a, b] of spans) {
      const n = Math.max(2, Math.ceil((b - a) / 0.2));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const s = a + ((b - a) * i) / n;
        const p = at(s, R * 2.2);
        const ang = tangentAngle(s) + Math.PI / 2;
        const l = [p.x + Math.cos(ang) * w, p.y + Math.sin(ang) * w, p.z], r = [p.x - Math.cos(ang) * w, p.y - Math.sin(ang) * w, p.z];
        if (prev) pos.push(...prev[0], ...prev[1], ...l, ...prev[1], ...r, ...l);
        prev = [l, r];
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pulseMesh = new THREE.Mesh(g, pulseMaterial);
    group.add(pulseMesh);
  }

  // ---- views ----
  // Inside: the observer a little past the chain's end, on the trajectory,
  // looking back along it (pulses sent forward come toward you).
  function aimInside() {
    const sObs = chainEnd() + 4;
    const eye = at(sObs, 0.32);
    const look = at(sObs - 14, 0);
    camera.up.set(0, 0, 1);
    camera.position.copy(eye);
    controls.target.copy(look);
    controls.enabled = false;
    controls.update();
  }
  function setInside(on) {
    view.inside = on;
    if (on) aimInside();
    else { camera.up.set(0, 1, 0); controls.enabled = true; resetView(); frameOutside(); }
  }
  // Outside: centre the view on the chain.
  function frameOutside() {
    const mid = at(chainEnd() / 2);
    controls.target.set(mid.x, mid.y, 0);
    camera.position.set(mid.x, mid.y, camera.position.z || 12);
    controls.update();
  }

  // ---- play ----
  let raf = 0, last = 0;
  function tick(now) {
    raf = 0;
    if (!active || !playing) return;
    playT += ((now - last) / 1000) * SPEEDS[view.speed];
    last = now;
    drawPulses();
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    if (on && !cells.some((c) => c.type !== 'gap')) { showHudPrompt(t('sig.prompt.empty', lang()), 3000); on = false; }
    playing = on;
    if (on) { playT = 0; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); } else drawPulses();
    renderPanel();
  }

  // Keep the chain's end (where taps add) on screen: glide the view there
  // when it has drifted off, keeping the camera's height.
  function followEnd() {
    if (view.inside) return;
    const end = at(chainEnd());
    const ndc = end.clone().project(camera);
    if (Math.abs(ndc.x) < 0.6 && Math.abs(ndc.y) < 0.45) return;
    const delta = new THREE.Vector3(end.x - controls.target.x, end.y - controls.target.y, 0);
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
  }

  // ---- building ----
  function commit() { save(); draw(); followEnd(); renderPanel(); onChange(); }
  // The cell nearest a tapped point, measured on screen (where it's drawn).
  function cellNear(point, reach = 0.6) {
    let best = null;
    for (const { cell, s0 } of layout(cells)) {
      const u = cellUnits(cell);
      for (let s = s0; s <= s0 + u; s += 0.25) {
        const d = at(s).distanceTo(point);
        if (d <= reach && (!best || d < best.d)) best = { cell, d };
      }
    }
    return best?.cell ?? null;
  }
  function handleTap(hit, mode) {
    if (!hit?.point) return false;
    const p = new THREE.Vector3(hit.point.x, hit.point.y, 0);
    if (mode === 'chisel') {
      const c = cellNear(p);
      if (!c) return false;
      cells = cells.filter((x) => x !== c);
      commit();
      return true;
    }
    if (mode === 'paint') {
      const c = cellNear(p);
      const material = c && getMaterial(c.type);
      if (!c || c.type === 'gap' || c.material === material) return false;
      c.material = material;
      commit();
      return true;
    }
    const next = pending.length ? pending.shift() : { type: view.type, ...(view.type === 'gap' ? { units: 1 } : {}) };
    cells.push({ ...next, material: getMaterial(next.type) });
    if (!pending.length && message) { message = ''; input.value = ''; }
    commit();
    return true;
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'world1dsignal-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row w4d-controls sig-cells"></div>
    <div class="w4d-row sig-message-row"><input type="text" class="sig-message" maxlength="80" autocomplete="off" spellcheck="false"><span class="sig-readout"></span></div>
    <div class="w4d-track" role="slider"><div class="w4d-ticks"></div><div class="w4d-thumb"></div></div>
    <div class="w4d-row w4d-options sig-options"></div>`;
  document.body.appendChild(panel);
  const cellsRow = panel.querySelector('.sig-cells');
  const optionsRow = panel.querySelector('.sig-options');
  const input = panel.querySelector('.sig-message');
  const readout = panel.querySelector('.sig-readout');
  const track = panel.querySelector('.w4d-track');
  const toSlider = (i) => -1 + (2 * i) / (SPEEDS.length - 1);
  const slider = createGearedSlider(track, {
    value: () => toSlider(view.speed),
    setValue: (v) => { const i = Math.round(((v + 1) / 2) * (SPEEDS.length - 1)); if (i !== view.speed) { view.speed = i; slider.render(); } },
    limit: () => 1,
    perSweep: () => 2,
    detents: () => SPEEDS.map((sp, i) => ({ v: toSlider(i), label: `×${sp}` })),
    snap: () => 1,
    onEnd: () => { save(); },
  });
  function renderReadout() {
    const text = decode(cells);
    readout.textContent = text ? `“${text}”` : '';
  }
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    const btn = (attr, val, label, on) => `<button type="button" data-${attr}="${val}" class="${on ? 'active' : ''}">${label}</button>`;
    cellsRow.innerHTML = [
      ...TYPES.map((ty) => btn('type', ty, `${{ dot: '•', dash: '—', gap: '·' }[ty]} ${t(`sig.${ty}`, L)}`, ty === view.type && !pending.length)),
      btn('view', 'outside', t('sig.outside', L), !view.inside),
      btn('view', 'inside', t('sig.inside', L), view.inside),
    ].join('');
    optionsRow.innerHTML = [
      btn('opt', 'play', playing ? `■ ${t('sig.stop', L)}` : `▶ ${t('sig.play', L)}`, playing),
      btn('opt', 'dir', view.dir > 0 ? `→ ${t('sig.forward', L)}` : `← ${t('sig.reverse', L)}`, false),
    ].join('');
    input.placeholder = t('sig.message', L);
    slider.render();
    renderReadout();
  }
  input.addEventListener('input', () => {
    message = input.value;
    pending = morseSequence(message);
    // After an existing chain, a word gap first (it's a new word).
    if (pending.length && cells.length && cells[cells.length - 1].type !== 'gap') pending.unshift({ type: 'gap', units: 7 });
    draw(); renderPanel();
  });
  // Typing shouldn't reach the scene's keyboard shortcuts.
  input.addEventListener('keydown', (e) => e.stopPropagation());
  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.type && TYPES.includes(d.type)) { view.type = d.type; pending = []; input.value = ''; }
    else if (d.view) setInside(d.view === 'inside');
    else if (d.opt === 'play') { setPlaying(!playing); return; }
    else if (d.opt === 'dir') { view.dir = -view.dir; playT = 0; }
    save(); draw(); renderPanel();
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
      if (!on) {
        playing = false;
        if (view.inside) { view.inside = false; camera.up.set(0, 1, 0); controls.enabled = true; }
        panel.classList.remove('visible');
      }
      renderPanel();
      draw();
      if (on) frameOutside();
    },
    get isEmpty() { return cells.length === 0; },
    clear() { cells = []; pending = []; input.value = ''; playing = false; commit(); },
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); draw(); renderPanel(); onChange(); },
    toJSON,
  };
}
