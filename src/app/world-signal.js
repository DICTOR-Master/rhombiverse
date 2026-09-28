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
//   not sit on a line - they are the line"), formed inside a faint tube:
//   the 1D dimension itself, stretching off to infinity both ways.
// - Outside (the default): the chain seen from above, following E(s).
//   Inside: the observer on the trajectory, just ahead of where the chain
//   is heading, looking back along it.
// - Play (user-started, like the Kaleidoscope's Spin) moves the bullets
//   themselves ("bullets themselves should be moving"): the chain streams
//   along the trajectory, repeating, toward its start, so a reader there
//   gets the message in order. Fixed speed; breathing and undulation are
//   later.
// - Controls: one row of symbols (• — ␣, view, ▶) and the message field
//   ("the controls are too complicated").
import * as THREE from 'three';
import { morseSequence, decode, layout, totalUnits, cellUnits, embed, tangentAngle } from '../geometry-extensions/trajectory-1d.js';
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
const SPEED = 4; // units per second
const lang = () => getSettings().language;
const at = (s, z = 0) => { const [x, y] = embed(s); return new THREE.Vector3(x * S, y * S, z); };

export function createSignalWorld({ scene, camera, controls, resetView = () => {}, colorFor, getMaterial, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  let cells = []; // { type, units?, material }
  const view = { type: 'dot', inside: false };
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
    }
  } catch { /* corrupt or blocked storage: start empty */ }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON(), view: { type: view.type } })); } catch { /* best-effort */ }
  }

  // Where a point of the trajectory is drawn. Outside: through E(s).
  // Inside: straight, since from within a 1D world only distance along s
  // exists (E is for looking from outside; the plan's §6.2).
  const place = (s, z = 0) => (view.inside ? new THREE.Vector3(s * S, 0, z) : at(s, z));
  const heading = (s) => (view.inside ? 0 : tangentAngle(s));

  // ---- drawing ----
  // The bullets are the trajectory, inside its tube; no line. Each
  // cell is the shared 1D cell (bullet-cell.js), centred on E(s), nose
  // along the trajectory. Play moves the bullets themselves: the chain
  // streams along the trajectory, repeating (one pass P = the chain plus
  // a word gap), toward its start, so a reader there gets the
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
  // The tube the bullets form in (direct request, 2026-09-29): the 1D
  // dimension itself, a faint channel just wider than a cell, stretching
  // off both ways toward infinity. From Inside it's the tunnel you look
  // down.
  const TUBE_R = R * 1.45;
  const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  class TrajectoryCurve extends THREE.Curve {
    constructor(lo, hi) { super(); this.lo = lo; this.hi = hi; }
    getPoint(u, target = new THREE.Vector3()) { return target.copy(place(this.lo + u * (this.hi - this.lo))); }
  }

  function placeCell(mesh, s0, units) {
    const mid = s0 + units / 2;
    mesh.position.copy(place(mid));
    mesh.rotation.z = heading(mid) - Math.PI / 2; // the cell's own axis is y, nose at +y
  }
  function clearBuilt() {
    for (const child of [...built.children]) {
      built.remove(child);
      if (child.isInstancedMesh) child.dispose();
      else if (child.userData.ownGeometry) child.geometry.dispose();
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
    // What a tap adds next: the message's ghosts, else the chosen cell.
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
    }
    const lo = WINDOW[0], hi = L + WINDOW[1];
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new TrajectoryCurve(lo, hi), Math.ceil((hi - lo) * 2), TUBE_R, 16, false), tubeMaterial);
    tube.userData.ownGeometry = true;
    built.add(tube);
    if (view.inside) aimInside();
    renderReadout();
  }
  // Positions every bullet for the current moment (at rest: where it was
  // placed; playing: carried along by the stream).
  function placeStream() {
    const L = chainEnd(), P = period();
    const shift = playing ? -(playT % P) : 0;
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
  // Inside: the observer on the trajectory just before the chain's start,
  // where it's heading, looking along it, so the bullets come toward you.
  function aimInside() {
    const ahead = -4;
    // Inside the tube, just above the bullets' path, looking along it:
    // the chain runs straight to a vanishing point.
    // Tilted down ~15°, which lifts the near bullets and the vanishing
    // point up the screen, clear of the panel.
    const eye = place(ahead, R * 1.2);
    const look = place(ahead + 12, R * 1.2 - 12 * S * Math.tan(Math.PI / 12));
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
  // Outside looks up the trajectory from behind and above, so it runs
  // up the screen and narrows into the distance (direct request: "closer
  // is wider"), focused on the chain's end, where taps add.
  function frameOutside() {
    // The chain's end at the middle of the screen, clear of the panel
    // below ("the controls are blocking the closer circle").
    const focus = chainEnd();
    const t = place(focus), back = place(focus - 6);
    camera.up.set(0, 0, 1);
    controls.target.copy(t);
    camera.position.set(back.x, back.y, 3.4);
    controls.update();
  }

  // ---- play ----
  let raf = 0, last = 0;
  function tick(now) {
    raf = 0;
    if (!active || !playing) return;
    playT += ((now - last) / 1000) * SPEED;
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
    const ndc = place(chainEnd()).project(camera);
    if (Math.abs(ndc.x) < 0.6 && ndc.y > -0.3 && ndc.y < 0.45) return;
    frameOutside();
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
    <div class="w4d-row sig-message-row"><input type="text" class="sig-message" maxlength="80" autocomplete="off" spellcheck="false"><span class="sig-readout"></span></div>`;
  document.body.appendChild(panel);
  const cellsRow = panel.querySelector('.sig-cells');
  const input = panel.querySelector('.sig-message');
  const readout = panel.querySelector('.sig-readout');
  function renderReadout() {
    const text = decode(cells);
    readout.textContent = text ? `“${text}”` : '';
  }
  // One row of symbols (direct request: "the controls are too
  // complicated"): the three cells, the view, play. Words only as
  // tooltips.
  // The view button shows the view you're in: an eye looking on from
  // Outside, a tunnel mouth Inside.
  const VIEW_ICONS = {
    outside: '<svg viewBox="-12 -12 24 24" width="20" height="20"><path d="M-11,0 C-6,-7 6,-7 11,0 C6,7 -6,7 -11,0 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle r="3.5" fill="currentColor"/></svg>',
    inside: '<svg viewBox="-12 -12 24 24" width="20" height="20"><circle r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle r="1.8" fill="currentColor"/></svg>',
  };
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    const btn = (attr, val, label, on, title) => `<button type="button" class="sig-sym${on ? ' active' : ''}" data-${attr}="${val}" title="${title}" aria-label="${title}">${label}</button>`;
    const nextView = view.inside ? 'outside' : 'inside';
    cellsRow.innerHTML = [
      ...TYPES.map((ty) => btn('type', ty, { dot: '•', dash: '—', gap: '␣' }[ty], ty === view.type && !pending.length, t(`sig.${ty}`, L))),
      btn('view', nextView, VIEW_ICONS[view.inside ? 'inside' : 'outside'], false, t(`sig.${nextView}`, L)),
      btn('opt', 'play', playing ? '■' : '▶', playing, t(playing ? 'sig.stop' : 'sig.play', L)),
    ].join('');
    input.placeholder = t('sig.message', L);
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
        view.inside = false;
        camera.up.set(0, 1, 0);
        controls.enabled = true;
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
