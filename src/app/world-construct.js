// 1D Construct: a world of its own (Wizard → 1D → Construct), the
// construction microscope of DICTO's Dimensional Construction Interface
// (docs/DIMENSIONAL_CONSTRUCTION_INTERFACE.md; the model is
// geometry-extensions/construction.js).
//
// Redesigned 2026-09-29 (direct feedback on the first version: "horrible
// and confusing", "I wanted a square, not a grid", "looks like 1960s Open
// University graphics, nothing like the rest of the app", "supposed to be
// staged to make it as simple as possible"). Decisions: one cell per tap,
// cyan like Signal, a fixed square of 10 cells per side, slender cells,
// seen straight on.
// - One line at a time: only the side you're on shows (its empty cells
//   faint, plain) until the square closes. The next cell is orange: tap
//   (anywhere) to fill it. Up the screen along X first; at the corner a
//   junction glows and Y joins (X stays); clockwise along the top, down
//   the far side (a second X line, parallel to the first), back along
//   the bottom. Closing
//   the loop, the square fills in, and can open in 2D ("same animal,
//   different zoo").
// - Long-press takes back the last cell. No other controls.
// - Cells are the shared 1D bullet (bullet-cell.js), nose along the way
//   round, in Signal's cyan, matte, shaded cups.
import * as THREE from 'three';
import { squareLoop, junctions, axisName, SQUARE_N } from '../geometry-extensions/construction.js';
import { bulletGeometry, plainCellGeometry } from './bullet-cell.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-construct-world';
const U = 0.5; // world units per cell
// Slender, more like an axis than a fat tube (direct request).
const R = 0.055;
const PAD = 0.004;
const CYAN = 0x22c3e6;
const NEXT = 0xf59e0b; // the 1D worlds' orange "tap here"
const lang = () => getSettings().language;

export function createConstructWorld({ scene, camera, controls, onOpenIn = () => {}, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const loop = squareLoop(SQUARE_N);
  const turns = junctions(loop);
  let filled = 0;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data?.version === 2 && Number.isInteger(data.filled)) filled = Math.max(0, Math.min(loop.length, data.filled));
  } catch { /* corrupt or blocked storage: start empty */ }
  let active = false;
  const toJSON = () => ({ version: 2, filled });
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON())); } catch { /* best-effort */ }
  }
  const complete = () => filled === loop.length;

  // ---- drawing ----
  const geo = bulletGeometry(U, R, PAD);
  const plainGeo = plainCellGeometry(U, R);
  const filledMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, roughness: 0.8, metalness: 0.05 });
  const nextMat = new THREE.MeshStandardMaterial({ color: NEXT, emissive: NEXT, emissiveIntensity: 0.35, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false });
  const emptyMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.08, depthWrite: false });
  const faceMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const junctionMat = new THREE.MeshBasicMaterial({ color: NEXT, transparent: true, opacity: 0.45, depthWrite: false });
  // Rounded corners (direct request: "corners should become rounded when
  // reached; the dome should reach the far side of the diameter"): a
  // joint as wide as the cells at each corner once it's reached, so the
  // line bends smoothly instead of stopping at the corner's centre line.
  const cornerMat = new THREE.MeshStandardMaterial({ color: CYAN, roughness: 0.8, metalness: 0.05 });
  const cornerGeo = new THREE.SphereGeometry(R, 48, 24);
  const corners = [...turns.map((j) => ({ point: j.point, arrive: j.at - 1, depart: j.at })), { point: loop[0].from, arrive: loop.length - 1, depart: 0 }];
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -R - 0.05;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  const layer = new THREE.Group();
  group.add(layer);
  const up = new THREE.Vector3(0, 1, 0);
  // The first line (X) runs up the screen, like Signal's (direct
  // request: "can't we start at the vertical axis?"); X is only the first
  // direction's name, not "horizontal". Y then turns off to the side.
  const world = (p) => new THREE.Vector3(p[1] * U, p[0] * U, 0);

  function cellMesh(c, mat, g = geo) {
    const m = new THREE.Mesh(g, mat);
    const a = world(c.from), b = world(c.to);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    return m;
  }
  function draw() {
    for (const child of [...layer.children]) { layer.remove(child); if (child.userData.own) child.geometry.dispose(); }
    if (!active) return;
    // One line at a time (direct requests: "this is 1D, so only one axis
    // should show at a time", "only one axis showing till complete"):
    // just the side you're on; the closed square shows whole.
    const here = loop[Math.min(filled, loop.length - 1)].instance;
    loop.forEach((c, k) => {
      if (complete()) { layer.add(cellMesh(c, filledMat)); return; }
      if (c.instance !== here) return;
      if (k < filled) layer.add(cellMesh(c, filledMat));
      else if (k === filled) layer.add(cellMesh(c, nextMat));
      else layer.add(cellMesh(c, emptyMat, plainGeo));
    });
    for (const c of corners) {
      const reached = filled > c.arrive;
      if (complete() || (reached && (loop[c.arrive].instance === here || loop[c.depart].instance === here))) {
        const joint = new THREE.Mesh(cornerGeo, cornerMat);
        joint.position.copy(world(c.point));
        layer.add(joint);
      }
    }
    // The junction just reached: a soft orange glow round the corner.
    const j = turns.find((x) => x.at === filled);
    if (j) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 2.2, 32, 16), junctionMat);
      dot.userData.own = true;
      dot.position.copy(world(j.point));
      layer.add(dot);
    }
    if (complete()) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(SQUARE_N * U, SQUARE_N * U), faceMat);
      face.userData.own = true;
      face.position.set((SQUARE_N * U) / 2, (SQUARE_N * U) / 2, 0);
      layer.add(face);
    }
    renderPanel();
  }
  // Straight on from above (direct request: "this vertical should be
  // pure, without perspective"): the square's plane faces the screen, so
  // its lines stay truly vertical and horizontal.
  function frame() {
    const c = new THREE.Vector3((SQUARE_N * U) / 2, (SQUARE_N * U) / 2, 0);
    camera.up.set(0, 1, 0);
    controls.target.copy(c);
    camera.position.set(c.x, c.y, SQUARE_N * U * 2.3);
    controls.update();
  }

  // ---- building ----
  function commit() { save(); draw(); onChange(); }
  function handleTap(hit, mode) {
    if (mode === 'paint') return false;
    if (mode === 'chisel') {
      if (!filled) return false;
      filled -= 1;
      commit();
      return true;
    }
    if (complete()) return false;
    filled += 1;
    commit();
    const j = turns.find((x) => x.at === filled);
    if (complete()) showHudPrompt(t('con.prompt.done', lang(), { name: 'Square', n: loop.length }), 5000);
    else if (j) showHudPrompt(t('con.prompt.junction', lang(), { axis: axisName(j.exposes) }), 4000);
    return true;
  }

  // ---- panel: only the hand-off, once the square is complete ----
  const panel = document.createElement('div');
  panel.id = 'world1dconstruct-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = '<div class="w4d-row w4d-options"><button type="button" class="sig-send" data-open="2D"></button></div>';
  document.body.appendChild(panel);
  const openBtn = panel.querySelector('[data-open]');
  function renderPanel() {
    panel.classList.toggle('visible', active && complete());
    openBtn.textContent = t('con.open', lang(), { dim: '2D' });
  }
  openBtn.addEventListener('click', () => onOpenIn('2D', 'square'));
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
      if (!on) { camera.up.set(0, 1, 0); panel.classList.remove('visible'); }
      draw();
      if (on) { frame(); if (!filled) showHudPrompt(t('con.prompt.start', lang()), 5000); }
    },
    get isEmpty() { return filled === 0; },
    clear() { filled = 0; commit(); },
    snapshot: toJSON,
    restore(json) {
      if (json?.version === 2 && Number.isInteger(json.filled)) filled = Math.max(0, Math.min(loop.length, json.filled));
      save(); draw(); onChange();
    },
    toJSON,
  };
}
