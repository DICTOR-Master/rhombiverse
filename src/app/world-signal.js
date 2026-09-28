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
// - The bullets are the trajectory (direct correction: "bullets should
//   not sit on a line - they are the line"): nothing else is drawn.
// - Outside (the default): the chain seen from above, following E(s).
//   Inside: the observer on the trajectory, just ahead of where the chain
//   is heading, looking back along it.
// - Play (user-started, like the Kaleidoscope's Spin) moves the bullets
//   themselves ("bullets themselves should be moving"): the chain streams
//   along the trajectory, repeating, Forward (toward its start, so a
//   reader there gets the message in order) or Reverse. Speed on the
//   slider. Breathing and undulation are later.
import * as THREE from 'three';
import { morseSequence, decode, layout, totalUnits, cellUnits, embed, tangentAngle } from '../geometry-extensions/trajectory-1d.js';
import { createGearedSlider } from './geared-slider.js';
import { bulletGeometry } from './bullet-cell.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-signal-world';
const S = 0.35; // world units per unit of s
const R = 0.1; // cell radius (world)
const PAD = 0.07; // space between neighbouring cells (world)
const FIRST_COLOR = 0x00e5ff;
const GHOST_COLOR = 0x9de0ff;
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

  // Where a point of the trajectory is drawn. Outside: through E(s).
  // Inside: straight, since from within a 1D world only distance along s
  // exists (E is for looking from outside; the plan's §6.2).
  const place = (s, z = 0) => (view.inside ? new THREE.Vector3(s * S, 0, z) : at(s, z));
  const heading = (s) => (view.inside ? 0 : tangentAngle(s));

  // ---- drawing ----
  // The bullets are the trajectory: no line is drawn under them. Each
  // cell is the shared 1D cell (bullet-cell.js), centred on E(s), nose
  // along the trajectory. Play moves the bullets themselves: the chain
  // streams along the trajectory, repeating (one pass P = the chain plus
  // a word gap), toward its start when Forward, so a reader there gets the
  // message in order: at time t the point s shows the chain's s + t
  // (streamAt in trajectory-1d.js, checked against m(t)).
  const cellGeometry = (units) => bulletGeometry(units * S, R, PAD);
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const gapMaterial = new THREE.MeshStandardMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const solidMaterial = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide });
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -0.2;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  const built = new THREE.Group();
  group.add(built);
  const tmpColor = new THREE.Color();
  let stream = []; // { mesh, entries: [{ s0, units, color }] } per cell shape
  const WINDOW = [-200, 400]; // how far before the start / past the end the trajectory is drawn
  // Empty cells: the trajectory beyond the chain, stretching off both
  // ways toward infinity (the Construction Interface's unfilled cells).
  const emptyMaterial = new THREE.MeshStandardMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });

  function placeCell(mesh, s0, units) {
    const mid = s0 + units / 2;
    mesh.position.copy(place(mid));
    mesh.rotation.z = heading(mid) - Math.PI / 2; // the cell's own axis is y, nose at +y
  }
  function clearBuilt() {
    for (const child of [...built.children]) {
      built.remove(child);
      if (child.isInstancedMesh) child.dispose();
    }
    stream = [];
  }
  const chainEnd = () => totalUnits(cells);
  const period = () => chainEnd() + 7;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1);
  function draw() {
    clearBuilt();
    if (!active) return;
    const L = chainEnd();
    // One instanced mesh per cell shape (dot, dash, each gap length),
    // sized for every repeat the stream can show.
    const byKey = new Map();
    for (const { cell, s0 } of layout(cells)) {
      const units = cellUnits(cell);
      const k = `${cell.type === 'gap' ? 'gap' : 'solid'}|${units}`;
      if (!byKey.has(k)) byKey.set(k, []);
      const color = cell.type === 'gap' ? null : colorFor(cell, new THREE.Color()).clone();
      byKey.get(k).push({ s0, units, color });
    }
    const copies = playing ? Math.ceil((L + WINDOW[1] - WINDOW[0]) / period()) + 2 : 1;
    for (const [k, entries] of byKey) {
      const [kind, units] = k.split('|');
      const mesh = new THREE.InstancedMesh(cellGeometry(Number(units)), kind === 'gap' ? gapMaterial : solidMaterial, entries.length * copies);
      mesh.frustumCulled = false;
      built.add(mesh);
      stream.push({ mesh, entries });
    }
    placeStream();
    // What a tap adds next: the message's ghosts, else the chosen cell;
    // then empty cells on out to the edges (while playing, the stream
    // itself fills the trajectory).
    if (!playing) {
      const next = pending.length ? pending : [{ type: view.type, ...(view.type === 'gap' ? { units: 1 } : {}) }];
      let s = L;
      next.forEach((c, i) => {
        const units = cellUnits(c);
        const mesh = new THREE.Mesh(cellGeometry(units), !cells.length && i === 0 ? firstMaterial : ghostMaterial);
        placeCell(mesh, s, units);
        built.add(mesh);
        s += units;
      });
      const spots = [];
      for (let e = -1; e >= WINDOW[0]; e--) spots.push(e);
      for (let e = Math.ceil(s); e < L + WINDOW[1]; e++) spots.push(e);
      const empty = new THREE.InstancedMesh(cellGeometry(1), emptyMaterial, spots.length);
      empty.frustumCulled = false;
      spots.forEach((e, i) => {
        q.setFromAxisAngle(zAxis, heading(e + 0.5) - Math.PI / 2);
        m4.compose(place(e + 0.5), q, one);
        empty.setMatrixAt(i, m4);
      });
      built.add(empty);
    }
    if (view.inside) aimInside();
    renderReadout();
  }
  // Positions every bullet for the current moment (at rest: where it was
  // placed; playing: carried along by the stream).
  function placeStream() {
    const L = chainEnd(), P = period();
    const shift = playing ? -view.dir * (playT % P) : 0;
    const lo = WINDOW[0], hi = L + WINDOW[1];
    for (const { mesh, entries } of stream) {
      let n = 0;
      for (const { s0, units, color } of entries) {
        const kMin = playing ? Math.ceil((lo - s0 - shift - units) / P) : 0;
        const kMax = playing ? Math.floor((hi - s0 - shift) / P) : 0;
        for (let k = kMin; k <= kMax && n < mesh.instanceMatrix.count; k++) {
          const mid = s0 + shift + k * P + units / 2;
          q.setFromAxisAngle(zAxis, heading(mid) - Math.PI / 2);
          m4.compose(place(mid), q, one);
          mesh.setMatrixAt(n, m4);
          if (color) mesh.setColorAt(n, color);
          n++;
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  // ---- views ----
  // Inside: the observer on the trajectory just ahead of where the chain
  // is heading (before its start for Forward, past its end for Reverse),
  // looking back along it, so the bullets come toward you.
  function aimInside() {
    const ahead = view.dir > 0 ? -4 : chainEnd() + 4;
    // Level, just above the trajectory, looking far along it: the chain
    // runs straight to a vanishing point.
    const eye = place(ahead, R * 1.6);
    const look = place(ahead + view.dir * 60, R * 1.6);
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
    const mid = place(chainEnd() / 2);
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
    placeStream();
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    if (on && !cells.some((c) => c.type !== 'gap')) { showHudPrompt(t('sig.prompt.empty', lang()), 3000); on = false; }
    playing = on;
    if (on) { playT = 0; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
    draw();
    renderPanel();
  }

  // Keep the chain's end (where taps add) on screen: glide the view there
  // when it has drifted off, keeping the camera's height.
  function followEnd() {
    if (view.inside) return;
    const end = place(chainEnd());
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
        const d = place(s).distanceTo(point);
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
