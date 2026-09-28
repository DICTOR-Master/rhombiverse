// 1D Signal: a world of its own (Wizard → 1D → Signal), from DICTO's 1D
// Experience Plan. A strictly one-dimensional trajectory
// (geometry-extensions/trajectory-1d.js) carrying Morse code.
//
// Decisions this file implements (plan §9 and direct requests, user
// 2026-09-29):
// - Message first: nobody is expected to know Morse. Type a message and
//   its cells appear as ghosts after the chain, the next one in orange
//   ("tap here"): each tap places one. Send places the rest and sets the
//   chain moving. Long-press removes a cell (the chain closes up: it's
//   one-dimensional). An empty field shows what the chain says.
// - The bullets are the trajectory ("bullets should not sit on a line -
//   they are the line"), formed inside a faint tube: the 1D dimension
//   itself, stretching off to infinity both ways.
// - Outside (the default): from behind and above, the line running up the
//   screen and narrowing into the distance. Inside: standing still in the
//   tunnel; the signal passes through you and travels away.
// - Playing moves the bullets themselves: the chain streams along the
//   trajectory, repeating, toward its start, so a reader there gets the
//   message in order. Fixed speed; breathing and undulation are later.
// - Controls: one line, the view button, the message, Send.
import * as THREE from 'three';
import { morseSequence, decode, layout, totalUnits, cellUnits, embed, tangentAngle } from '../geometry-extensions/trajectory-1d.js';
import { bulletGeometry } from './bullet-cell.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-signal-world';
const S = 0.35; // world units per unit of s
const R = 0.1; // cell radius (world)
const PAD = 0.003; // a hair between nose and cup: flush joins (direct report: "an obvious ridge where they aren't joining cleanly"), without the two surfaces flickering
const NEXT_COLOR = 0xf59e0b; // the HUD's orange
const GHOST_COLOR = 0x9de0ff;
const TYPES = ['dot', 'dash', 'gap'];
const SPEED = 4; // units per second
// Inside, each cell fills the view as it passes, so it moves slower there
// (direct report: "pulsing too erratic inside tunnel").
const SPEED_INSIDE = 0.8; // and slower still: "slow down view in tunnel, more calming pulse"
const lang = () => getSettings().language;
const at = (s, z = 0) => { const [x, y] = embed(s); return new THREE.Vector3(x * S, y * S, z); };

export function createSignalWorld({ scene, camera, controls, resetView = () => {}, colorFor, getMaterial, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  let cells = []; // { type, units?, material }
  const view = { inside: false };
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
    }
  } catch { /* corrupt or blocked storage: start empty */ }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON() })); } catch { /* best-effort */ }
  }

  // Where a point of the trajectory is drawn. Outside: through E(s).
  // Inside: straight, since from within a 1D world only distance along s
  // exists (E is for looking from outside; the plan's §6.2).
  // Inside, the tunnel rises very gently ahead of you (direct request:
  // "a very slight upward curve of horizon / vanishing point ... so the
  // signal fades into distance"): a parabola, level where you stand.
  const EYE_U = 2;
  const RISE = 0.0025; // world units of rise per (world unit ahead)^2
  const ahead = (s) => Math.max(0, (s - EYE_U) * S);
  const insidePoint = (s, z = 0) => new THREE.Vector3(s * S, 0, z + RISE * ahead(s) ** 2);
  const insideTangent = (s) => new THREE.Vector3(1, 0, 2 * RISE * ahead(s)).normalize();
  const place = (s, z = 0) => (view.inside ? insidePoint(s, z) : at(s, z));
  // A cell's orientation (its own axis is y, nose at +y) at s.
  const yAxis = new THREE.Vector3(0, 1, 0);
  const orient = (s, out = new THREE.Quaternion()) => (view.inside
    ? out.setFromUnitVectors(yAxis, insideTangent(s))
    : out.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tangentAngle(s) - Math.PI / 2));

  // ---- drawing ----
  // The bullets are the trajectory, inside its tube; no line. Each
  // cell is the shared 1D cell (bullet-cell.js), centred on E(s), nose
  // along the trajectory. The chain is a train (direct report: "signal
  // seems to be going backwards"): its first cell is the engine, at the
  // front (u = 0), later cells behind it toward the viewer, all noses
  // forward. Cell i of the message sits at u = -(its s), so taps add at
  // the back (u = -L). Play drives it forward, nose first, repeating (one
  // pass P = the chain plus a word gap), so a reader ahead gets the
  // message in order: the point u shows m(t - u) (waveAt in
  // trajectory-1d.js, checked against m(t)).
  const cellGeometry = (units) => bulletGeometry(units * S, R, PAD);
  const ghostMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, color: GHOST_COLOR, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  // The next cell a tap places, in orange ("tap here"; everything else
  // is cyan).
  const nextMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, color: NEXT_COLOR, emissive: NEXT_COLOR, emissiveIntensity: 0.35, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
  const gapMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x9de0ff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const solidMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide }); // matte: no bright glint in the tail's hollow
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -0.2;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  const built = new THREE.Group();
  group.add(built);
  const tmpColor = new THREE.Color();
  let stream = []; // { mesh, entries: [{ s0, units, color }] } per cell shape
  const BEHIND = 60, AHEAD = 400; // how far behind the train / ahead of it the trajectory is drawn
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

  // A cell spanning [s0, s0 + units] of the message, in world position u.
  const uMid = (s0, units) => -(s0 + units / 2);
  function placeCell(mesh, s0, units) {
    const mid = uMid(s0, units);
    mesh.position.copy(place(mid));
    orient(mid, mesh.quaternion);
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
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
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
    const copies = playing ? Math.ceil((L + BEHIND + AHEAD) / period()) + 2 : 1;
    for (const [k, entries] of byKey) {
      const [kind, units] = k.split('|');
      const mesh = new THREE.InstancedMesh(cellGeometry(Number(units)), kind === 'gap' ? gapMaterial : solidMaterial, entries.length * copies);
      mesh.frustumCulled = false;
      built.add(mesh);
      stream.push({ mesh, entries });
    }
    placeStream();
    // The typed message still to place, as ghosts; the next one in
    // orange: tap to place it (Outside only).
    if (!playing && !view.inside) {
      let s = L;
      pending.forEach((c, i) => {
        const units = cellUnits(c);
        const mesh = new THREE.Mesh(cellGeometry(units), i === 0 ? nextMaterial : ghostMaterial);
        placeCell(mesh, s, units);
        built.add(mesh);
        s += units;
      });
    }
    if (view.inside) { group.add(cab); } else group.remove(cab);
    const lo = -L - BEHIND - 40, hi = AHEAD;
    // Outside, the faint tube seen from without; Inside, the cab's own
    // tunnel takes its place.
    if (!view.inside) {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new TrajectoryCurve(lo, hi), Math.ceil((hi - lo) * 2), TUBE_R, 48, false), tubeMaterial);
      tube.userData.ownGeometry = true;
      built.add(tube);
    }
    renderPanel();
  }
  // Positions every bullet for the current moment (at rest: where it was
  // placed; playing: carried along by the stream).
  function placeStream() {
    const L = chainEnd(), P = period();
    const shift = playing ? playT % P : 0;
    const lo = -L - BEHIND, hi = AHEAD;
    const repeat = playing;
    for (const { mesh, entries } of stream) {
      let n = 0;
      // Inside, only the signal itself: no gap cells.
      if (view.inside && mesh.material === gapMaterial) { mesh.count = 0; continue; }
      for (const { s0, units, color } of entries) {
        const base = uMid(s0, units) + shift;
        const kMin = repeat ? Math.ceil((lo - base) / P) : 0;
        const kMax = repeat ? Math.floor((hi - base) / P) : 0;
        for (let k = kMin; k <= kMax && n < mesh.instanceMatrix.count; k++) {
          const mid = base + k * P;
          orient(mid, q);
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
  // Inside (direct requests: "inside tunnel view, outside not visible";
  // "the only colour shapes should be the cyan signal patches moving
  // through you, not continuous rings; you are not travelling, the signal
  // is"): you stand still on the tube's axis just ahead of the train,
  // looking down the tunnel. Send and the signal comes from behind, passes
  // through you and travels away. Plain dark walls, rising very gently
  // ahead so the signal climbs away and fades into the distance.
  const cab = new THREE.Group();
  const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x0f1a24, side: THREE.BackSide });
  const TUNNEL = [-10, 160];
  class InsideCurve extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) { return target.copy(insidePoint(TUNNEL[0] + t * (TUNNEL[1] - TUNNEL[0]))); }
  }
  // Smooth circles (direct request: "does there have to be rough
  // crenulation ... is smooth circle not possible?"): plenty of segments.
  const tunnel = new THREE.Mesh(new THREE.TubeGeometry(new InsideCurve(), (TUNNEL[1] - TUNNEL[0]) * 2, TUBE_R, 96, false), wallMaterial);
  // The dimension's cell walls, faintly, and still ("maybe a slight
  // opacity of cell walls, but that isn't moving").
  const wallRingMaterial = new THREE.MeshBasicMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.1, depthWrite: false });
  const ringCount = Math.floor(TUNNEL[1] - EYE_U);
  const walls = new THREE.InstancedMesh(new THREE.TorusGeometry(TUBE_R * 0.98, TUBE_R * 0.02, 6, 96), wallRingMaterial, ringCount);
  {
    const zAxisRing = new THREE.Vector3(0, 0, 1); // the torus lies across its own z
    for (let i = 0; i < ringCount; i++) {
      const k = Math.ceil(EYE_U) + i;
      walls.setMatrixAt(i, m4.compose(insidePoint(k), new THREE.Quaternion().setFromUnitVectors(zAxisRing, insideTangent(k)), one));
    }
  }
  walls.frustumCulled = false;
  cab.add(tunnel, walls);
  // You're in the signal's path: cells are cut where you stand, and only
  // their outward faces drawn, so each one emerges from beyond the view,
  // its hollow tail toward you, and shrinks away down the tunnel.
  const atYou = new THREE.Plane(new THREE.Vector3(1, 0, 0), -(EYE_U + 0.1) * S); // right at you: each cell emerges as big as the view ("all the way from outside the rings") and shrinks away
  function aimInside() {
    camera.up.set(0, 0, 1);
    camera.position.copy(insidePoint(EYE_U));
    // Along the rising tunnel, so the view tilts up a touch with it.
    controls.target.copy(insidePoint(EYE_U + 14));
    controls.enabled = false;
    controls.update();
  }
  // Distance fades into the dark (both views; the scene's fog, only
  // while Signal is on).
  const fogs = { inside: new THREE.Fog(0x05050a, 1.2, 9), outside: new THREE.Fog(0x05050a, 3, 16) };
  function setFog(on) { scene.fog = on ? fogs[view.inside ? 'inside' : 'outside'] : null; }
  function setInside(on) {
    view.inside = on;
    setFog(true);
    // Inside, only outward faces: a cell around you isn't drawn from
    // within (no flood of colour), you see it again once it's ahead.
    solidMaterial.clippingPlanes = on ? [atYou] : [];
    solidMaterial.side = on ? THREE.FrontSide : THREE.DoubleSide;
    solidMaterial.needsUpdate = true;
    if (on) aimInside();
    else { camera.up.set(0, 1, 0); controls.enabled = true; resetView(); frameOutside(); }
  }
  // Outside looks up the trajectory from behind the train and above, so
  // it runs up the screen and narrows into the distance (direct request:
  // "closer is wider"), the train heading away. The back of the train,
  // where taps add, sits mid-screen, clear of the panel below ("the
  // controls are blocking the closer circle").
  function frameOutside() {
    const focus = -chainEnd();
    // Low and grazing, so the line converges strongly to its vanishing
    // point ("there should be a perspective sense from outside too").
    const t = place(focus + 3), back = place(focus - 5);
    camera.up.set(0, 0, 1);
    controls.target.copy(t);
    camera.position.set(back.x, back.y, 1.5);
    controls.update();
  }

  // ---- play ----
  let raf = 0, last = 0;
  function tick(now) {
    raf = 0;
    if (!active || !playing) return;
    playT += ((now - last) / 1000) * (view.inside ? SPEED_INSIDE : SPEED);
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
    const ndc = place(-chainEnd()).project(camera);
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
        const d = place(-s).distanceTo(point);
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
    if (!pending.length) { if (!cells.length) showHudPrompt(t('sig.prompt.empty', lang()), 3000); return !cells.length; }
    const next = pending.shift();
    cells.push({ ...next, material: getMaterial(next.type) });
    if (!pending.length) { message = ''; input.value = ''; }
    commit();
    return true;
  }
  // Send: the rest of the message joins the chain, and the chain sets off.
  function send() {
    for (const c of pending) cells.push({ ...c, material: getMaterial(c.type) });
    pending = [];
    message = '';
    input.value = '';
    if (!cells.some((c) => c.type !== 'gap')) { showHudPrompt(t('sig.prompt.empty', lang()), 3000); draw(); return; }
    save();
    onChange();
    setPlaying(true);
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'world1dsignal-panel';
  panel.className = 'qc-panel';
  // One line (direct requests: "the controls are too complicated", "no
  // dot dash space controls", "type message .... send on the same line";
  // nobody is expected to know Morse): the view, the message, Send.
  panel.innerHTML = `
    <div class="w4d-row sig-message-row"><button type="button" class="sig-sym" data-view></button><input type="text" class="sig-message" maxlength="80" autocomplete="off" spellcheck="false" enterkeyhint="send"><button type="button" class="sig-send" data-opt="send"></button></div>`;
  document.body.appendChild(panel);
  const viewBtn = panel.querySelector('[data-view]');
  const sendBtn = panel.querySelector('[data-opt="send"]');
  const input = panel.querySelector('.sig-message');
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
    const nextView = view.inside ? 'outside' : 'inside';
    viewBtn.dataset.view = nextView;
    viewBtn.innerHTML = VIEW_ICONS[view.inside ? 'inside' : 'outside'];
    viewBtn.title = t(`sig.${nextView}`, L);
    viewBtn.setAttribute('aria-label', viewBtn.title);
    sendBtn.textContent = playing ? `■ ${t('sig.stop', L)}` : t('sig.send', L);
    sendBtn.classList.toggle('active', playing);
    // An empty field shows what the chain says; otherwise the prompt.
    const said = decode(cells);
    input.placeholder = said ? `“${said}”` : t('sig.message', L);
  }
  input.addEventListener('input', () => {
    message = input.value;
    pending = morseSequence(message);
    // After an existing chain, a word gap first (it's a new word).
    if (pending.length && cells.length && cells[cells.length - 1].type !== 'gap') pending.unshift({ type: 'gap', units: 7 });
    draw(); renderPanel();
  });
  // Typing shouldn't reach the scene's keyboard shortcuts; Enter sends.
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); send(); }
  });
  panel.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.view) setInside(d.view === 'inside');
    else if (d.opt === 'send') { if (playing) setPlaying(false); else send(); return; }
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
        setFog(false);
        solidMaterial.clippingPlanes = [];
        solidMaterial.side = THREE.DoubleSide;
        solidMaterial.needsUpdate = true;
        camera.up.set(0, 1, 0);
        controls.enabled = true;
        panel.classList.remove('visible');
      }
      renderPanel();
      draw();
      if (on) { setFog(true); frameOutside(); }
    },
    get isEmpty() { return cells.length === 0; },
    clear() { cells = []; pending = []; input.value = ''; playing = false; commit(); },
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); draw(); renderPanel(); onChange(); },
    toJSON,
  };
}
