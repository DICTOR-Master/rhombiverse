// Nets: a 2D world of its own (Wizard → 2D → Nets), from 2D to 3D only
// (direct decisions, 2026-09-29: "a new section of 2D to 3D, only nets";
// "but only 2D to 3D, 3D has enough happening"). Pick a solid; its net
// shows as a faint ghost; build it following the ghost, the first face
// side by side (a tap per side), then a face a tap, in 1D cells like
// Construct's; when it's complete, a tap folds it up into the solid
// ("tap it and it folds into the solid"), and a slider folds and unfolds
// it by hand ("fold slider"). The geometry is geometry-extensions/nets.js.
import * as THREE from 'three';
import { netOf, netSteps, SOLIDS, SOLID_GROUPS, apply } from '../geometry-extensions/nets.js';
import { bulletGeometry, plainCellGeometry } from './bullet-cell.js';
import { t } from './i18n.js';
import { dimensionLabel } from './dimension-label.js';
import { getSettings, onSettingsChange } from './settings.js';
import { addPanelMinimiser } from './panel-minimiser.js';

const STORAGE_KEY = 'rhombiverse-nets-world';
const L = 5; // edge length; five cells an edge, as in Construct
const R = 0.055;
const PAD = 0.004;
const CYAN = 0x22c3e6;
const NEXT = 0xf59e0b; // the orange "tap here"
const FOLD_SECONDS = 1.6;
const lang = () => getSettings().language;

export function createNetsWorld({ scene, camera, controls, onOpenIn = () => {}, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const nets = Object.fromEntries(Object.keys(SOLIDS).map((id) => [id, netOf(id, L)]));
  const stepsOf = Object.fromEntries(Object.entries(nets).map(([id, net]) => [id, netSteps(net)]));
  let solid = 'cube';
  const progress = Object.fromEntries(Object.keys(SOLIDS).map((id) => [id, 0]));
  let fold = 0; // 0 flat … 1 closed
  const clampP = (id, v) => (Number.isInteger(v) ? Math.max(0, Math.min(stepsOf[id].length, v)) : 0);
  function read(data) {
    if (data?.version !== 1) return;
    for (const id of Object.keys(SOLIDS)) progress[id] = clampP(id, data.progress?.[id]);
    if (SOLIDS[data.solid]) solid = data.solid;
    fold = data.fold === 1 && progress[solid] === stepsOf[solid].length ? 1 : 0;
  }
  try { read(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { /* start empty */ }
  const toJSON = () => ({ version: 1, solid, progress: { ...progress }, fold: fold === 1 ? 1 : 0 });
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON())); } catch { /* best-effort */ } }
  let active = false;
  const net = () => nets[solid];
  const steps = () => stepsOf[solid];
  const done = () => progress[solid];
  const complete = () => done() === steps().length;

  // ---- drawing ----
  const geo = bulletGeometry(1, R, PAD); // full detail: only the edges being built show their cells
  const rodGeo = plainCellGeometry(L, R, 20); // a built edge, fused into one
  const filledMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, roughness: 0.8, metalness: 0.05 });
  const nextMat = new THREE.MeshStandardMaterial({ color: NEXT, emissive: NEXT, emissiveIntensity: 0.35, vertexColors: true });
  const faceMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const ghostMat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.28 });
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -0.5;
  group.add(catchPlane);
  const layer = new THREE.Group();
  group.add(layer);
  const up = new THREE.Vector3(0, 1, 0);
  let faceGroups = [];

  // An edge as five cells, in its face's own (solid-space) frame.
  function edgeCells(a, b, mat, into) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A).normalize();
    for (let i = 0; i < L; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(A).lerp(B, (i + 0.5) / L);
      m.quaternion.setFromUnitVectors(up, dir);
      into.add(m);
    }
  }
  function draw() {
    // Each solid's own colour where it has one (the golden zonohedra), cyan otherwise.
    const tint = SOLIDS[solid].color ?? CYAN;
    filledMat.color.setHex(tint);
    faceMat.color.setHex(tint);
    for (const c of [...layer.children]) { layer.remove(c); c.traverse((o) => { if (o.userData.own) o.geometry.dispose(); }); }
    faceGroups = [];
    if (!active) return;
    const n = net();
    const k = done();
    const next = complete() ? null : steps()[k];
    // Each face its own group, placed by the fold.
    faceGroups = n.faces.map(() => { const g = new THREE.Group(); g.matrixAutoUpdate = false; layer.add(g); return g; });
    const builtEdges = new Set();
    steps().slice(0, k).forEach((st) => st.edges.forEach((e) => builtEdges.add(e)));
    steps().forEach((st) => st.edges.forEach((e) => {
      // Built edges fuse into one rod each (direct suggestion: "fuse them
      // as you go through the build to maintain speed"); the next ones
      // show their cells.
      if (builtEdges.has(e)) {
        const A = new THREE.Vector3(...e[0]), B = new THREE.Vector3(...e[1]);
        const m = new THREE.Mesh(rodGeo, filledMat);
        m.position.copy(A).add(B).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
        faceGroups[st.face].add(m);
      }
      else if (next && next.edges.includes(e)) edgeCells(e[0], e[1], nextMat, faceGroups[st.face]);
    }));
    // A face fills in (faintly) once all its sides are there.
    const faceDone = (i) => n.faces[i].pts.every((p, j) => {
      const q = n.faces[i].pts[(j + 1) % n.faces[i].pts.length];
      return [...builtEdges].some(([a, b]) => (a === p && b === q) || (a === q && b === p) || (near(a, p) && near(b, q)) || (near(a, q) && near(b, p)));
    });
    n.faces.forEach((f, i) => {
      if (!faceDone(i)) return;
      const g = new THREE.BufferGeometry().setFromPoints(f.pts.map((p) => new THREE.Vector3(...p)));
      const idx = [];
      for (let j = 1; j + 1 < f.pts.length; j++) idx.push(0, j, j + 1);
      g.setIndex(idx);
      const m = new THREE.Mesh(g, faceMat);
      m.userData.own = true;
      faceGroups[i].add(m);
    });
    // The ghost net: every face's outline, flat, while it's still flat.
    if (fold === 0 && !complete()) {
      const pts = [];
      n.flat.forEach((P) => P.forEach((p, j) => { const q = P[(j + 1) % P.length]; pts.push(new THREE.Vector3(...p), new THREE.Vector3(...q)); }));
      const ghost = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), ghostMat);
      ghost.userData.own = true;
      layer.add(ghost);
    }
    place();
    renderPanel();
  }
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  function place() {
    const T = net().at(fold);
    faceGroups.forEach((g, i) => { g.matrix.fromArray(T[i]); g.matrixWorldNeedsUpdate = true; });
  }

  // ---- the view: straight on while flat; turning to three-quarters as it folds ----
  function box(t) {
    const T = net().at(t);
    const b = new THREE.Box3();
    net().faces.forEach((f, i) => f.pts.forEach((p) => b.expandByPoint(new THREE.Vector3(...apply(T[i], p)))));
    return b;
  }
  function pose() {
    const flat = fold === 0;
    // Folding, frame the shape as it is now together with the closed
    // solid (half open it spreads wider), so the slider never carries it
    // off the screen; the view follows as it folds (see follow()).
    const b = flat ? box(0) : box(Math.max(fold, 0.05)).union(box(1));
    // Centred on the flat net, or on the closed solid.
    const c = (flat ? b : box(1)).getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    // Fit to the screen's own shape (a wide net on a tall phone is limited
    // by its width): flat, the box's width and height; folded, the
    // solid's sphere, in whichever field of view is narrower.
    const vHalf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    // Only the band between the top buttons and the panel is clear: fit to
    // it, and centre there.
    const H = window.innerHeight || 1;
    const top = 150, bottom = H - (panel.offsetHeight || 150) - 60;
    const band = Math.max(0.3, (bottom - top) / H);
    const bandNdc = 1 - (top + bottom) / H; // the band's middle, +up
    const dist = flat
      ? Math.max(s.y / 2 / (Math.tan(vHalf) * band), s.x / 2 / Math.tan(hHalf)) * 1.1
      : (Math.max(...[0, 1].flatMap((i) => [0, 1].flatMap((j) => [0, 1].map((k) => new THREE.Vector3(i ? b.max.x : b.min.x, j ? b.max.y : b.min.y, k ? b.max.z : b.min.z).distanceTo(c))))) / Math.sin(Math.min(Math.atan(Math.tan(vHalf) * band), hHalf))) * 1.05;
    const dir = flat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(-0.45, 0.35, 0.82).normalize();
    // Look a little below the shape, so it sits in the band's middle.
    const target = c.clone().addScaledVector(camera.up.clone().normalize(), -bandNdc * Math.tan(vHalf) * dist);
    return { target, position: target.clone().add(dir.multiplyScalar(dist)), dist };
  }
  let tween = 0, tweening = false;
  // While folding: keep the viewing direction (yours, if you've turned
  // it), and move in or out to fit.
  function follow() {
    if (tweening || fold === 0) return;
    const to = pose();
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(to.target);
    camera.position.copy(to.target).add(dir.multiplyScalar(to.dist));
    controls.update();
  }
  function frame(animate = false) {
    cancelAnimationFrame(tween);
    const to = pose();
    camera.up.set(0, 1, 0);
    if (!animate) { controls.target.copy(to.target); camera.position.copy(to.position); controls.update(); return; }
    const fT = controls.target.clone(), fP = camera.position.clone(), t0 = performance.now();
    tweening = true;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1400), e = k * k * (3 - 2 * k);
      controls.target.lerpVectors(fT, to.target, e);
      camera.position.lerpVectors(fP, to.position, e);
      controls.update();
      if (k < 1 && active) tween = requestAnimationFrame(step);
      else { tweening = false; follow(); }
    };
    tween = requestAnimationFrame(step);
  }

  // ---- folding ----
  let foldRaf = 0;
  function setFold(v, { record = true } = {}) {
    const wasFlat = fold === 0;
    fold = Math.max(0, Math.min(1, v));
    place();
    if (wasFlat !== (fold === 0)) { draw(); frame(true); } else follow();
    slider.value = String(Math.round(fold * 100));
    renderPanel();
    if (record) { save(); onChange(); }
  }
  function animateFold(to) {
    cancelAnimationFrame(foldRaf);
    const from = fold, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / (FOLD_SECONDS * 1000 * Math.abs(to - from) || 1));
      setFold(from + (to - from) * (k * k * (3 - 2 * k)), { record: k === 1 });
      if (k < 1 && active) foldRaf = requestAnimationFrame(step);
      else if (k === 1 && to === 1) showHudPrompt(t('nets.prompt.folded', lang(), { name: net().label }), 5000);
    };
    foldRaf = requestAnimationFrame(step);
  }

  // ---- building ----
  function commit() { save(); draw(); onChange(); }
  function handleTap(hit, mode) {
    if (mode === 'paint') return false;
    if (mode === 'chisel') {
      if (fold > 0) { animateFold(0); return true; }
      if (!done()) return false;
      progress[solid] -= 1;
      commit();
      return true;
    }
    // Complete: a tap folds it up (or back down).
    if (complete()) { animateFold(fold < 1 ? 1 : 0); return true; }
    progress[solid] += 1;
    commit();
    if (complete()) showHudPrompt(t('nets.prompt.done', lang(), { name: net().label }), 5000);
    else if (done() === net().faces[net().tree.order[0]].pts.length) showHudPrompt(t('nets.prompt.faces', lang()), 4500);
    return true;
  }

  // ---- panel: the solid, and the fold slider once the net is complete ----
  const panel = document.createElement('div');
  panel.id = 'worldnets-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="nets-solids"></div>
    <div class="w4d-row nets-fold-row"><input type="range" class="nets-fold" min="0" max="100" step="1" value="0"><button type="button" class="sig-send" data-open></button></div>`;
  document.body.appendChild(panel);
  addPanelMinimiser(panel, 'nets', () => frame(true));
  const solidsRow = panel.querySelector('.nets-solids');
  const foldRow = panel.querySelector('.nets-fold-row');
  const slider = panel.querySelector('.nets-fold');
  const openBtn = panel.querySelector('[data-open]');
  slider.addEventListener('input', () => { cancelAnimationFrame(foldRaf); setFold(Number(slider.value) / 100, { record: false }); });
  slider.addEventListener('change', () => { save(); onChange(); });
  solidsRow.addEventListener('click', (e) => {
    const id = e.target.closest('[data-solid]')?.dataset.solid;
    if (!id || id === solid) return;
    cancelAnimationFrame(foldRaf);
    solid = id; fold = 0;
    save(); draw(); frame(true); onChange();
    if (!done()) showHudPrompt(t('nets.prompt.start', lang()), 5000);
  });
  openBtn.addEventListener('click', () => (SOLIDS[solid].golden ? onOpenIn('golden', SOLIDS[solid].golden) : onOpenIn('3D', SOLIDS[solid].piece)));
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    // Each group named, its solids short (full names on hover).
    const SHORT = { rd: 'RD', to: 'TO', tetra: 'Tetra', octa: 'Octa', icosa: 'Icosa', dodeca: 'Dodeca', tt: 'Trunc. tetra', prolate: 'Prolate', oblate: 'Oblate', bilinski: 'Bilinski', ricosa: 'Rh. icosa', rtriac: 'Triaconta' };
    solidsRow.innerHTML = SOLID_GROUPS.map((g) => `<div class="w4d-row w4d-options"><span class="nets-group">${t(`nets.group.${g.id}`, lang())}</span>${Object.entries(SOLIDS).filter(([, s]) => s.groups.includes(g.id)).map(([id, s]) => `<button type="button" data-solid="${id}" class="${id === solid ? 'active' : ''}" title="${s.label}">${SHORT[id] ?? s.label}</button>`).join('')}</div>`).join('');
    foldRow.hidden = !complete();
    // The slider always shows this net's own fold (direct report: "the
    // slider doesn't reset between builds").
    slider.value = String(Math.round(fold * 100));
    slider.title = t('nets.fold', lang());
    slider.setAttribute('aria-label', slider.title);
    // Open in 3D where the 3D world has this solid as a piece.
    openBtn.hidden = fold < 1 || !(SOLIDS[solid].piece || SOLIDS[solid].golden);
    openBtn.textContent = t('con.open', lang(), { dim: dimensionLabel('3D') });
  }
  let shownLang = lang();
  onSettingsChange((st) => { if (st.language !== shownLang) { shownLang = st.language; if (active) renderPanel(); } });

  return {
    group,
    meshes: () => [catchPlane],
    handleTap,
    setActive(on) {
      if (on === active) return;
      active = on;
      group.visible = on;
      if (!on) { cancelAnimationFrame(tween); cancelAnimationFrame(foldRaf); panel.classList.remove('visible'); }
      draw();
      if (on) { frame(); if (!done()) showHudPrompt(t('nets.prompt.start', lang()), 5000); }
    },
    /** Folded any way at all: the net has left 2D. */
    get folded() { return fold > 0; },
    get isEmpty() { return Object.values(progress).every((v) => v === 0); },
    /** Nothing built on the solid you're on (the ⊘ beside Undo). */
    get currentEmpty() { return progress[solid] === 0 && fold === 0; },
    /** ⊘ beside Undo (direct request: "need the delete button on nets"):
     * the solid you're on, back to its ghost net; Undo brings it back. */
    clearCurrent() {
      cancelAnimationFrame(foldRaf);
      progress[solid] = 0; fold = 0;
      save(); draw(); if (active) { frame(true); showHudPrompt(t('nets.prompt.start', lang()), 5000); }
      onChange();
    },
    clear() { for (const id of Object.keys(progress)) progress[id] = 0; fold = 0; save(); draw(); if (active) frame(true); onChange(); },
    snapshot: toJSON,
    restore(json) { read(json); save(); draw(); if (active) frame(true); },
    toJSON,
  };
}
