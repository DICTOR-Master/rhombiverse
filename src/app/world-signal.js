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
// - Controls: one line, the view button, the message, the pulse key,
//   Send. The key (direct request: "a pulse button: a tap for short (dot)
//   and a touch for dash, etc."): tap for a dot, hold for a dash; a pause
//   starts a new letter, a longer one a new word, like a telegraph key.
// - A script-style button beside Send opens the Morse glossary
//   (tap a letter to add it to the message), and while the signal plays
//   the message reads out at the top, letter by letter, as it arrives
//   there ("a sent message viewer where the signal arrives at the top").
import * as THREE from 'three';
import { morseSequence, decode, letterEnds, keyedElement, keyedGap, KEY_MS, layout, totalUnits, cellUnits, embed, tangentAngle, MORSE } from '../geometry-extensions/trajectory-1d.js';
import { bulletGeometry, plainCellGeometry } from './bullet-cell.js';
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
  // A typed message replaces the chain (direct report: "my message added
  // to hello world ... impossible to delete or go back"): until its first
  // cell is placed, it previews in place of the old one; editing the text
  // re-derives the preview, keeping any placed cells that still match.
  let draftStarted = false;
  const shown = () => (pending.length && !draftStarted ? [] : cells);
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
  // Inside, the trajectory runs straight down the tunnel; you stand a
  // little above its path, so it runs up the screen to the vanishing
  // point and you see the cells' tops in the distance (direct request:
  // "see signal moving up and out by seeing a little of top view in the
  // distance; then rings won't be necessary to define the tunnel").
  const EYE_U = 2;
  const insidePoint = (s, z = 0) => new THREE.Vector3(s * S, 0, z);
  const insideTangent = () => new THREE.Vector3(1, 0, 0);
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
  const nextMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, color: NEXT_COLOR, emissive: NEXT_COLOR, emissiveIntensity: 0.35 }); // opaque: no nested nose showing through
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
  // Just the cells' own width, and faint: a slight mist along the same
  // borders, no second outline beside them (direct request: "I don't like
  // double lines outside of cells on outside view; only slight misting
  // matching cell borders").
  const TUBE_R = R * 1.005;
  const tubeMaterial = new THREE.MeshStandardMaterial({ color: 0x9de0ff, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.FrontSide });
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
  const chainEnd = () => totalUnits(shown());
  const period = () => chainEnd() + 7;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  function draw() {
    clearBuilt();
    if (!active) return;
    const L = chainEnd();
    // One instanced mesh per cell shape (dot, dash, each gap length),
    // sized for every repeat the stream can show.
    const byKey = new Map();
    for (const { cell, s0 } of layout(shown())) {
      const units = cellUnits(cell);
      const k = `${cell.type === 'gap' ? 'gap' : 'solid'}|${units}`;
      if (!byKey.has(k)) byKey.set(k, []);
      const color = cell.type === 'gap' ? null : colorFor(cell, new THREE.Color()).clone();
      byKey.get(k).push({ s0, units, color });
    }
    const copies = playing ? Math.ceil((L + BEHIND + AHEAD) / period()) + 2 : 1;
    for (const [k, entries] of byKey) {
      const [kind, units] = k.split('|');
      // Gaps are faint and plain (no nose or cup to show double through them).
      const mesh = new THREE.InstancedMesh(kind === 'gap' ? plainCellGeometry(Number(units) * S, R) : cellGeometry(Number(units)), kind === 'gap' ? gapMaterial : solidMaterial, entries.length * copies);
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
        const mesh = new THREE.Mesh(i === 0 ? cellGeometry(units) : plainCellGeometry(units * S, R), i === 0 ? nextMaterial : ghostMaterial);
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
  // is"): you stand still in the tube just ahead of the train, a little
  // above its path,
  // looking down the tunnel. Send and the signal comes from behind, passes
  // just beneath you and travels away, up the screen and into the
  // distance. Plain dark walls; the path itself shows the way.
  const cab = new THREE.Group();
  const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x0f1a24, side: THREE.BackSide });
  const TUNNEL = [-10, AHEAD];
  class InsideCurve extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) { return target.copy(insidePoint(TUNNEL[0] + t * (TUNNEL[1] - TUNNEL[0]))); }
  }
  // Smooth circles (direct request: "does there have to be rough
  // crenulation ... is smooth circle not possible?"): plenty of segments.
  // Roomier than the outside tube, so you can stand well above the path.
  const TUNNEL_R = R * 3.2;
  const tunnel = new THREE.Mesh(new THREE.TubeGeometry(new InsideCurve(), (TUNNEL[1] - TUNNEL[0]) * 2, TUNNEL_R, 96, false), wallMaterial);
  cab.add(tunnel);
  // Above the path: a passing cell fills the bottom of the view unbroken
  // ("if a cell is coming that part of the screen should be full of cyan";
  // cutting it where you stand left a dark gap under it), and the path
  // narrows to a sharp point at the horizon. (Tried on the axis for "full
  // circle" cells; the user preferred this: "inside view was perfect
  // before".)
  const EYE_H = R * 2.2;
  function aimInside() {
    camera.up.set(0, 0, 1);
    camera.position.copy(insidePoint(EYE_U, EYE_H));
    // The view tilted back against the path, 22° (direct requests:
    // "tilt view backwards so cells vanish above in distance", "centre of
    // appearing and disappearing cell should drop slightly", "more upward
    // tilt", "still want more stretch of tunnel upwards, vanishing into
    // distance"): each cell's
    // centre sits a little below the middle as it passes and the path
    // climbs to a vanishing point well above it.
    const reach = 20 * S;
    controls.target.copy(insidePoint(EYE_U + 20, EYE_H - reach * Math.tan((22 * Math.PI) / 180)));
    controls.enabled = false;
    controls.update();
  }
  // Distance fades into the dark (both views; the scene's fog, only
  // while Signal is on).
  // Inside, far enough out that the path narrows to a sharp point first
  // ("make the disappearing triangle sharper to horizon").
  const fogs = { inside: new THREE.Fog(0x05050a, 6, 90), outside: new THREE.Fog(0x05050a, 3, 16) };
  function setFog(on) { scene.fog = on ? fogs[view.inside ? 'inside' : 'outside'] : null; }
  function setInside(on) {
    queueMicrotask(measureArrival);
    view.inside = on;
    setFog(true);
    // Inside, only outward faces (you're never within a cell, but it keeps
    // a cell's hollow from ever showing through).
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
    // From behind and well above, so the line converges to its vanishing
    // point ("there should be a perspective sense from outside too") and
    // the cells' ends read as ellipses, not full circles ("outside view
    // should be an ellipse").
    const t = place(focus + 3), back = place(focus - 4);
    camera.up.set(0, 0, 1);
    controls.target.copy(t);
    camera.position.set(back.x, back.y, 3);
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
    renderArrivals();
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    if (on && !cells.some((c) => c.type !== 'gap')) { showHudPrompt(t('sig.prompt.empty', lang()), 3000); on = false; }
    playing = on;
    if (on) { playT = 0; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
    draw();
    renderPanel();
    measureArrival();
    renderArrivals();
  }

  // ---- the message as it arrives ----
  // Where the line fades out of sight (the fog's far reach, up the
  // screen): a letter has arrived once its last cell has passed there.
  // The stream repeats, so the read-out starts again with each pass.
  let uArrive = 0;
  function measureArrival() {
    const far = (scene.fog?.far ?? 16) * 0.85;
    let u = -chainEnd();
    while (u < AHEAD && place(u).distanceTo(camera.position) < far) u += 0.5;
    uArrive = u;
  }
  const viewer = document.createElement('div');
  viewer.id = 'sig-arrivals';
  document.body.appendChild(viewer);
  let arrivedText = null, heardWhole = false;
  function renderArrivals() {
    const on = active && playing;
    viewer.classList.toggle('visible', on);
    if (!on) { arrivedText = null; heardWhole = false; return; }
    const P = period();
    const y = (((playT % P) - uArrive) % P + P) % P;
    const letters = letterEnds(cells);
    let text = letters.filter((l) => l.end <= y).map((l) => l.text).join('');
    // Between passes, the whole message stays up until the next one's
    // first letter arrives.
    if (text.length === letters.length) heardWhole = true;
    else if (!text && heardWhole) text = letters.map((l) => l.text).join('');
    if (text !== arrivedText) { arrivedText = text; viewer.textContent = text; }
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
    if (!draftStarted) { cells = []; draftStarted = true; }
    const next = pending.shift();
    cells.push({ ...next, material: getMaterial(next.type) });
    if (!pending.length) { message = ''; input.value = ''; draftStarted = false; }
    commit();
    return true;
  }
  // Send: the rest of the message joins the chain, and the chain sets off.
  function send() {
    keying = false;
    if (pending.length && !draftStarted) cells = [];
    for (const c of pending) cells.push({ ...c, material: getMaterial(c.type) });
    pending = [];
    draftStarted = false;
    message = '';
    input.value = '';
    if (!cells.some((c) => c.type !== 'gap')) { showHudPrompt(t('sig.prompt.empty', lang()), 3000); draw(); return; }
    save();
    onChange();
    setPlaying(true);
    if (!view.inside) frameOutside(); // the whole message was placed at once
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'world1dsignal-panel';
  panel.className = 'qc-panel';
  // One line (direct requests: "the controls are too complicated", "no
  // dot dash space controls", "type message .... send on the same line";
  // nobody is expected to know Morse): the view, the message, Send.
  panel.innerHTML = `
    <div class="w4d-row sig-message-row"><button type="button" class="sig-sym" data-view></button><input type="text" class="sig-message" maxlength="80" autocomplete="off" spellcheck="false" enterkeyhint="send"><button type="button" class="sig-sym sig-pulse" data-pulse></button><button type="button" class="sig-send" data-opt="send"></button></div>`;
  document.body.appendChild(panel);
  const viewBtn = panel.querySelector('[data-view]');
  const sendBtn = panel.querySelector('[data-opt="send"]');
  const input = panel.querySelector('.sig-message');
  const pulseBtn = panel.querySelector('[data-pulse]');

  // ---- the pulse key ----
  // Timing: KEY_MS (trajectory-1d.js).
  const PULSE_ICONS = {
    dot: '<svg viewBox="-12 -12 24 24" width="20" height="20"><circle r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle r="3.2" fill="currentColor"/></svg>',
    dash: '<svg viewBox="-12 -12 24 24" width="20" height="20"><circle r="10" fill="none" stroke="currentColor" stroke-width="2"/><rect x="-6" y="-2.2" width="12" height="4.4" rx="2.2" fill="currentColor"/></svg>',
  };
  pulseBtn.innerHTML = PULSE_ICONS.dot;
  let keying = false; // the chain is a keyed message (the next Send ends it)
  let downAt = 0, upAt = 0, dashTimer = 0;
  pulseBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pulseBtn.setPointerCapture?.(e.pointerId);
    // Input time, not handler time: a busy frame mustn't stretch a dot.
    downAt = e.timeStamp;
    pulseBtn.classList.add('down');
    clearTimeout(dashTimer);
    dashTimer = setTimeout(() => { pulseBtn.innerHTML = PULSE_ICONS.dash; }, KEY_MS.dash);
  });
  function keyUp(e) {
    if (!downAt) return;
    e.preventDefault();
    const now = e.timeStamp;
    const held = now - downAt;
    const pause = downAt - upAt;
    downAt = 0; upAt = now;
    clearTimeout(dashTimer);
    pulseBtn.classList.remove('down');
    pulseBtn.innerHTML = PULSE_ICONS.dot;
    if (e.type === 'pointercancel') return;
    if (playing) setPlaying(false);
    if (!keying) {
      // A keyed message replaces the chain, as a typed one does.
      cells = []; pending = []; draftStarted = false; message = ''; input.value = '';
      keying = true;
    } else if (cells.length) {
      cells.push(keyedGap(pause));
    }
    const { type } = keyedElement(held);
    cells.push({ type, material: getMaterial(type) });
    commit();
  }
  pulseBtn.addEventListener('pointerup', keyUp);
  pulseBtn.addEventListener('pointercancel', keyUp);

  // ---- the Morse glossary ----
  // Beside Send (direct request: "glossary next to send").
  const glossBtn = document.createElement('button');
  glossBtn.type = 'button';
  glossBtn.className = 'sig-sym';
  glossBtn.id = 'sig-gloss-btn';
  // A little scroll: the code book.
  glossBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z"/><path d="M6 16h9M10 8h4M10 11h1.2M13 11h3M10 14h3"/></svg>';
  panel.querySelector('.sig-message-row').appendChild(glossBtn);
  const gloss = document.createElement('div');
  gloss.id = 'sig-gloss';
  const sym = (code) => [...code].map((c) => `<i class="${c === '.' ? 'd' : 'l'}"></i>`).join('');
  // Letters, then digits, then punctuation (object order would put the
  // digits first).
  const glossOrder = [...Object.keys(MORSE).filter((k) => /[A-Z]/.test(k)), ...Object.keys(MORSE).filter((k) => /[0-9]/.test(k)), ...Object.keys(MORSE).filter((k) => !/[A-Z0-9]/.test(k))];
  gloss.innerHTML = glossOrder.map((ch) => [ch, MORSE[ch]]).map(([ch, code]) => `<button type="button" data-ch="${ch === '"' ? '&quot;' : ch}"><b>${ch === '"' ? '&quot;' : ch}</b><span>${sym(code)}</span></button>`).join('');
  document.body.appendChild(gloss);
  let glossOpen = false;
  glossBtn.addEventListener('click', (e) => { e.stopPropagation(); glossOpen = !glossOpen; renderPanel(); });
  // A letter tapped in the glossary joins the message, as if typed.
  gloss.addEventListener('click', (e) => {
    const ch = e.target.closest('[data-ch]')?.dataset.ch;
    if (!ch) return;
    input.value = (input.value + ch).slice(0, 80);
    input.dispatchEvent(new Event('input'));
  });
  // The view button shows the view you're in: an eye looking on from
  // Outside, a tunnel mouth Inside.
  const VIEW_ICONS = {
    outside: '<svg viewBox="-12 -12 24 24" width="20" height="20"><path d="M-11,0 C-6,-7 6,-7 11,0 C6,7 -6,7 -11,0 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle r="3.5" fill="currentColor"/></svg>',
    inside: '<svg viewBox="-12 -12 24 24" width="20" height="20"><circle r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle r="1.8" fill="currentColor"/></svg>',
  };
  function renderPanel() {
    panel.classList.toggle('visible', active);
    gloss.classList.toggle('visible', active && glossOpen);
    glossBtn.classList.toggle('active', glossOpen);
    if (!active) return;
    const L = lang();
    const nextView = view.inside ? 'outside' : 'inside';
    viewBtn.dataset.view = nextView;
    viewBtn.innerHTML = VIEW_ICONS[view.inside ? 'inside' : 'outside'];
    viewBtn.title = t(`sig.${nextView}`, L);
    viewBtn.setAttribute('aria-label', viewBtn.title);
    pulseBtn.title = t('sig.pulse', L);
    pulseBtn.setAttribute('aria-label', pulseBtn.title);
    glossBtn.title = t('sig.glossary', L);
    glossBtn.setAttribute('aria-label', glossBtn.title);
    sendBtn.textContent = playing ? `■ ${t('sig.stop', L)}` : t('sig.send', L);
    sendBtn.classList.toggle('active', playing);
    // An empty field shows what the chain says; otherwise the prompt.
    const said = decode(cells);
    input.placeholder = said ? `“${said}”` : t('sig.message', L);
  }
  input.addEventListener('input', () => {
    keying = false;
    message = input.value;
    const seq = morseSequence(message);
    if (draftStarted) {
      // Keep the placed cells that still match the edited text.
      let k = 0;
      while (k < cells.length && k < seq.length && cells[k].type === seq[k].type && (cells[k].units ?? 1) === (seq[k].units ?? 1)) k++;
      cells = cells.slice(0, k);
      pending = seq.slice(k);
      if (!message) draftStarted = false;
    } else pending = seq;
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
    if ('pulse' in d) return;
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
        solidMaterial.side = THREE.DoubleSide;
        solidMaterial.needsUpdate = true;
        camera.up.set(0, 1, 0);
        controls.enabled = true;
        panel.classList.remove('visible');
        renderArrivals();
      }
      renderPanel();
      draw();
      if (on) { setFog(true); frameOutside(); }
    },
    get isEmpty() { return cells.length === 0; },
    clear() { cells = []; pending = []; draftStarted = false; keying = false; input.value = ''; playing = false; commit(); renderArrivals(); },
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); draw(); renderPanel(); onChange(); },
    toJSON,
  };
}
