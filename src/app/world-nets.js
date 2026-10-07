// Nets: a 2D world of its own (Wizard → 2D → Nets), from 2D to 3D only
// (direct decisions, 2026-09-29: "a new section of 2D to 3D, only nets";
// "but only 2D to 3D, 3D has enough happening"). Pick a solid; its net
// shows as a faint ghost; build it following the ghost, the first face
// side by side (a tap per side), then a face a tap, in 1D cells like
// Construct's; when it's complete, a tap folds it up into the solid
// ("tap it and it folds into the solid"), and a slider folds and unfolds
// it by hand ("fold slider"). The geometry is geometry-extensions/nets.js.
import * as THREE from 'three';
import { netOf, netSteps, SOLIDS, SOLID_GROUPS, EKP_PIECES, EKP_ORDER, IDENTITY, apply, mul, rigidAlign } from '../geometry-extensions/nets.js';
import { roofFoldSolids, ROOF_FOLD_COLOURS, PHI } from '../geometry-extensions/roof-fold.js';
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
  let fold = 0; // 0 flat … 1 closed, for the solid you're on
  let cellView = false; // the whole EKP cell instead of one net
  let wrap = 0; // whole cell: shells shown inside out, 0 … pieces folded; a fraction is the next one folding
  // Folded all the way, kept once reached: an assembly piece (direct
  // decision, 2026-10-07: "stella octangula ... jump together") needs
  // this to show its already-done siblings while you build the next one.
  const foldDone = Object.fromEntries(Object.keys(SOLIDS).map((id) => [id, false]));
  // Other solids that join this one into one assembled whole: the same
  // `assembly` tag, or named either way in `assemblyWith`.
  function siblingsOf(id) {
    const a = SOLIDS[id].assembly;
    return Object.keys(SOLIDS).filter((o) => o !== id
      && ((a && SOLIDS[o].assembly === a) || (SOLIDS[id].assemblyWith ?? []).includes(o) || (SOLIDS[o].assemblyWith ?? []).includes(id)));
  }
  // A net folds about its own root face, flat on the screen; `net.align`
  // takes the closed solid onto its true vertices, the frame its assembly
  // siblings share. Folded siblings stand in that frame.
  const trueT = (id, T) => (siblingsOf(id).length ? T.map((Ti) => mul(nets[id].align, Ti)) : T);
  // The piece being built: flat and facing you while you build it, then
  // carried into its true place among its folded siblings as it folds
  // (a Pacioli rectangle in the x = 0 plane was being built edge-on).
  function carry(M, s) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    new THREE.Matrix4().fromArray(M).decompose(p, q, sc);
    return new THREE.Matrix4().compose(p.multiplyScalar(s), new THREE.Quaternion().slerp(q, s), new THREE.Vector3(1, 1, 1)).toArray();
  }
  const placedT = (id, t) => {
    const T = nets[id].at(t);
    if (!siblingsOf(id).length) return T;
    const B = t >= 1 ? nets[id].align : carry(nets[id].align, t);
    return T.map((Ti) => mul(B, Ti));
  };
  // Folded siblings show only once the piece you're on leaves the flat.
  const shownSiblings = () => (fold > 0 ? siblingsOf(solid).filter((s) => foldDone[s]) : []);
  const clampP = (id, v) => (Number.isInteger(v) ? Math.max(0, Math.min(stepsOf[id].length, v)) : 0);
  function read(data) {
    if (data?.version !== 1) return;
    for (const id of Object.keys(SOLIDS)) progress[id] = clampP(id, data.progress?.[id]);
    for (const id of Object.keys(SOLIDS)) foldDone[id] = data.foldDone?.[id] === true && progress[id] === stepsOf[id].length;
    if (SOLIDS[data.solid]) solid = data.solid;
    // Saves from before foldDone kept only the current solid's fold.
    if (data.fold === 1 && progress[solid] === stepsOf[solid].length) foldDone[solid] = true;
    fold = foldDone[solid] ? 1 : 0;
    cellView = data.cell === true;
    wrap = Infinity; // fully wrapped; drawCell clamps it
  }
  try { read(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { /* start empty */ }
  const toJSON = () => ({ version: 1, solid, progress: { ...progress }, foldDone: { ...foldDone }, cell: cellView });
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
  // Every EKP piece in full colour, the EKP world's own (roof-fold.js), so
  // a colour means the same piece in both worlds; stella's two tetrahedra
  // take a vivid magenta and cyan so the pair reads as two.
  const PIECE_COLOR = {
    ...Object.fromEntries(Object.entries(EKP_PIECES).map(([id, p]) => [id, ROOF_FOLD_COLOURS[p.kind]])),
    stella1: 0xff3b9e, stella2: 0x27d0e0,
  };
  const tintedMats = new Map();
  function matFor(id, base) {
    if (PIECE_COLOR[id] === undefined) return base;
    const key = id + '\u0000' + base.uuid;
    if (!tintedMats.has(key)) { const m = base.clone(); m.color.set(PIECE_COLOR[id]); tintedMats.set(key, m); }
    return tintedMats.get(key);
  }
  // Both sides: a Pacioli rectangle is one face, seen from either side.
  const siblingMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide });
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
    // 1 for every solid whose edges are all the same length; the EKP
    // assembly pieces (the spike, Pacioli's rectangle) are not, so their
    // longer edges stretch the same cell rather than leaving it short of
    // the edge (direct finding, 2026-10-07).
    const segLen = A.distanceTo(B) / L;
    for (let i = 0; i < L; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(A).lerp(B, (i + 0.5) / L);
      m.quaternion.setFromUnitVectors(up, dir);
      m.scale.y = segLen;
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
    folding = null;
    if (!active) return;
    if (cellView) { drawCell(); renderPanel(); return; }
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
        const m = new THREE.Mesh(rodGeo, matFor(solid, filledMat));
        m.position.copy(A).add(B).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
        m.scale.y = A.distanceTo(B) / L;
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
      const m = new THREE.Mesh(g, matFor(solid, faceMat));
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
    // Assembly siblings already folded, in their shared true frame. The
    // star's icosahedron shows through (X-ray) while you're on its spike.
    for (const sib of shownSiblings()) {
      const sn = nets[sib];
      const T = trueT(sib, sn.at(1));
      const mat = solid === 'starSpike' && sib === 'icosa' ? matFor(sib, faceMat) : matFor(sib, siblingMat);
      sn.faces.forEach((f, i) => {
        const g = new THREE.BufferGeometry().setFromPoints(f.pts.map((p) => new THREE.Vector3(...apply(T[i], p))));
        const idx = []; for (let j = 1; j + 1 < f.pts.length; j++) idx.push(0, j, j + 1);
        g.setIndex(idx);
        g.computeVertexNormals();
        // filledMat multiplies by vertex colours: white, so the tint shows.
        g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
        const m = new THREE.Mesh(g, mat);
        m.userData.own = true;
        layer.add(m);
      });
    }
    place();
    renderPanel();
  }
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

  // ---- the whole EKP cell: the pieces you've folded, inside out ----
  // Each piece in the cell's own frame (roof-fold.js), one scale for all:
  // the icosahedron family at the size you built it. The wrap runs the
  // shells in EKP_ORDER, each folding from its net around the ones inside
  // it; X-ray fades each kind further out, as in the EKP world.
  const EKP = roofFoldSolids();
  const U = (L * PHI ** 2) / 2; // world units per cell unit
  const cellRod = plainCellGeometry(1, 0.07, 12);
  let folding = null;
  let drawnShell = '';
  const built = () => EKP_ORDER.filter((id) => foldDone[id]);
  const nextPiece = () => EKP_ORDER.find((id) => !foldDone[id]);
  const cellFaces = (id) => {
    const { kind, index } = EKP_PIECES[id];
    if (kind === 'stella') return EKP.stella.faces.slice(4 * index, 4 * index + 4);
    if (kind === 'rects') return [EKP.rects.faces[index]];
    return EKP[kind].faces;
  };
  const cellEdges = (id) => {
    const { kind, index } = EKP_PIECES[id];
    if (kind === 'stella') return EKP.stella.edges.slice(6 * index, 6 * index + 6);
    if (kind === 'rects') return EKP.rects.edges.slice(4 * index, 4 * index + 4);
    return EKP[kind].edges;
  };
  // One spike stands for all 20: the turn taking spike 0 onto spike j.
  const spikeTurns = EKP.ico.faces.map((f, j) => rigidAlign([EKP.ico.faces[0][0], EKP.ico.faces[0][1], EKP.star.faces[0][2]], [f[0], f[1], EKP.star.faces[3 * j][2]]));
  const xray = (rank) => (rank === 0 ? 1 : Math.max(0.14, 0.5 - 0.08 * (rank - 1)));
  const cellMats = new Map();
  function cellMat(id, opacity) {
    const key = `${id}|${opacity}`;
    if (!cellMats.has(key)) cellMats.set(key, new THREE.MeshStandardMaterial({ color: PIECE_COLOR[id], transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide, flatShading: true, roughness: 0.7, metalness: 0.05 }));
    return cellMats.get(key);
  }
  const rodMat = (id) => matFor(id, filledMat);
  function polyMesh(polys, mat, order) {
    const pos = [];
    for (const P of polys) for (let j = 1; j + 1 < P.length; j++) pos.push(...P[0], ...P[j], ...P[j + 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = order;
    m.userData.own = true;
    return m;
  }
  // A rod from a to b in `into`'s units, k world units each: every rod the same thickness.
  function cellRodMesh(a, b, mat, into, k) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const m = new THREE.Mesh(cellRod, mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
    m.scale.set(1 / k, A.distanceTo(B), 1 / k);
    into.add(m);
  }
  function drawCell() {
    const shown = built();
    wrap = Math.max(0, Math.min(wrap, shown.length));
    const whole = Math.floor(wrap), frac = wrap - whole;
    const visible = shown.slice(0, whole + (frac > 0 ? 1 : 0));
    drawnShell = `${whole}|${frac > 0}`;
    const kinds = [...new Set(visible.map((id) => EKP_PIECES[id].kind))];
    visible.forEach((id, i) => {
      const rank = kinds.indexOf(EKP_PIECES[id].kind);
      const faceMat = cellMat(id, xray(rank)), rm = rodMat(id);
      if (i < whole) {
        const g = new THREE.Group();
        g.scale.setScalar(U);
        g.add(polyMesh(cellFaces(id), faceMat, rank));
        for (const [a, b] of cellEdges(id)) cellRodMesh(a, b, rm, g, U);
        layer.add(g);
        return;
      }
      // The shell wrapping now: its net folding up around the ones inside.
      const n = nets[id], s = (U * EKP_PIECES[id].cell) / n.scale;
      folding = { id, faces: [] };
      for (const R of id === 'starSpike' ? spikeTurns : [IDENTITY]) n.faces.forEach((f, fi) => {
        const g = new THREE.Group();
        g.matrixAutoUpdate = false;
        g.add(polyMesh([f.pts], faceMat, rank));
        f.pts.forEach((p, j) => cellRodMesh(p, f.pts[(j + 1) % f.pts.length], rm, g, s));
        layer.add(g);
        folding.faces.push({ g, R, fi, s });
      });
    });
    // Fully wrapped: the next shell to build, as a ghost.
    const next = nextPiece();
    if (whole === shown.length && next) {
      const pts = cellEdges(next).flatMap(([a, b]) => [new THREE.Vector3(...a).multiplyScalar(U), new THREE.Vector3(...b).multiplyScalar(U)]);
      const ghost = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: PIECE_COLOR[next], transparent: true, opacity: 0.45 }));
      ghost.userData.own = true;
      ghost.userData.ownMaterial = true;
      layer.add(ghost);
    }
    placeCell();
  }
  function placeCell() {
    if (!folding) return;
    const T = nets[folding.id].at(wrap - Math.floor(wrap));
    const align = nets[folding.id].align;
    for (const { g, R, fi, s } of folding.faces) {
      const S = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
      g.matrix.fromArray(mul(R, mul(S, mul(align, T[fi]))));
      g.matrixWorldNeedsUpdate = true;
    }
  }
  let wrapRaf = 0;
  function setWrap(v) {
    wrap = Math.max(0, Math.min(built().length, v));
    const shell = `${Math.floor(wrap)}|${wrap % 1 > 0}`;
    if (shell !== drawnShell) draw(); else placeCell();
    cellSlider.value = String(Math.round((wrap / Math.max(1, built().length)) * 1000));
  }
  const WRAP_SECONDS = 1.2; // per shell
  function playWrap() {
    cancelAnimationFrame(wrapRaf);
    const n = built().length;
    const from = wrap >= n ? 0 : wrap, t0 = performance.now();
    const step = (now) => {
      const x = Math.min(n, from + (now - t0) / (WRAP_SECONDS * 1000));
      const i = Math.floor(x), f = x - i;
      setWrap(x >= n ? n : i + f * f * (3 - 2 * f));
      if (x < n && active && cellView) wrapRaf = requestAnimationFrame(step);
    };
    wrapRaf = requestAnimationFrame(step);
  }
  function openCell() {
    cancelAnimationFrame(foldRaf);
    cellView = true;
    wrap = built().length;
    save(); draw(); frame(true); onChange();
    const n = built().length;
    showHudPrompt(n ? t('nets.prompt.cell', lang(), { n, total: EKP_ORDER.length }) : t('nets.prompt.cellEmpty', lang()), 6000);
  }
  function choose(id) {
    cancelAnimationFrame(foldRaf); cancelAnimationFrame(wrapRaf);
    cellView = false;
    solid = id; fold = foldDone[id] ? 1 : 0;
    save(); draw(); frame(true); onChange();
    if (!done()) showHudPrompt(t('nets.prompt.start', lang()), 5000);
  }
  function place() {
    if (cellView) { placeCell(); return; }
    const T = placedT(solid, fold);
    faceGroups.forEach((g, i) => { g.matrix.fromArray(T[i]); g.matrixWorldNeedsUpdate = true; });
  }

  // ---- the view: straight on while flat; turning to three-quarters as it folds ----
  function box(t) {
    const b = new THREE.Box3();
    if (cellView) {
      // What's built, and the ghost of the next shell.
      const ids = [...built(), nextPiece()].filter(Boolean);
      const r = U * Math.max(0.5, ...ids.flatMap((id) => cellEdges(id).flat().map((p) => Math.hypot(...p))));
      return b.set(new THREE.Vector3(-r, -r, -r), new THREE.Vector3(r, r, r));
    }
    const T = placedT(solid, t);
    net().faces.forEach((f, i) => f.pts.forEach((p) => b.expandByPoint(new THREE.Vector3(...apply(T[i], p)))));
    // Folding, frame the folded siblings too.
    for (const sib of t > 0 ? shownSiblings() : []) {
      const sn = nets[sib], ST = trueT(sib, sn.at(1));
      sn.faces.forEach((f, i) => f.pts.forEach((p) => b.expandByPoint(new THREE.Vector3(...apply(ST[i], p)))));
    }
    return b;
  }
  function pose() {
    const flat = fold === 0 && !cellView;
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
    const wasFlat = fold === 0, wasDone = fold === 1;
    fold = Math.max(0, Math.min(1, v));
    foldDone[solid] = fold === 1;
    place();
    // Redraw crossing either edge: flat/folding as before, and done/not
    // done, since an assembly sibling only appears once this is done.
    if (wasFlat !== (fold === 0) || wasDone !== (fold === 1)) { draw(); frame(true); } else follow();
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
    if (cellView) {
      if (mode === 'chisel') return false;
      if (!built().length) { showHudPrompt(t('nets.prompt.cellEmpty', lang()), 5000); return true; }
      playWrap();
      return true;
    }
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
    <div class="w4d-row nets-fold-row"><input type="range" class="nets-fold" min="0" max="100" step="1" value="0"><button type="button" class="sig-send" data-open></button></div>
    <div class="w4d-row nets-cell-row"><input type="range" class="nets-wrap" min="0" max="1000" step="1" value="1000"></div>
    <div class="w4d-row nets-next-row"><button type="button" class="sig-send" data-next></button></div>`;
  document.body.appendChild(panel);
  addPanelMinimiser(panel, 'nets', () => frame(true));
  const solidsRow = panel.querySelector('.nets-solids');
  const foldRow = panel.querySelector('.nets-fold-row');
  const slider = panel.querySelector('.nets-fold');
  const openBtn = panel.querySelector('[data-open]');
  const cellRow = panel.querySelector('.nets-cell-row');
  const cellSlider = panel.querySelector('.nets-wrap');
  const nextRow = panel.querySelector('.nets-next-row');
  const nextBtn = panel.querySelector('[data-next]');
  cellSlider.addEventListener('input', () => { cancelAnimationFrame(wrapRaf); setWrap((Number(cellSlider.value) / 1000) * built().length); });
  nextBtn.addEventListener('click', () => { const id = nextPiece(); if (id) choose(id); else openCell(); });
  slider.addEventListener('input', () => { cancelAnimationFrame(foldRaf); setFold(Number(slider.value) / 100, { record: false }); });
  slider.addEventListener('change', () => { save(); onChange(); });
  solidsRow.addEventListener('click', (e) => {
    if (e.target.closest('[data-cell]')) { if (!cellView) openCell(); return; }
    const id = e.target.closest('[data-solid]')?.dataset.solid;
    if (!id || (id === solid && !cellView)) return;
    choose(id);
  });
  openBtn.addEventListener('click', () => (SOLIDS[solid].golden ? onOpenIn('golden', SOLIDS[solid].golden) : onOpenIn('3D', SOLIDS[solid].piece)));
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    // Each group named, its solids short (full names on hover); the EKP
    // cell's in its wrap order, inside out, then the whole cell.
    const SHORT = { rd: 'RD', to: 'TO', tetra: 'Tetra', octa: 'Octa', icosa: 'Icosa', dodeca: 'Dodeca', stella1: 'Stella A', stella2: 'Stella B', starSpike: 'Star spike', pacioli1: 'Pacioli A', pacioli2: 'Pacioli B', pacioli3: 'Pacioli C', tt: 'Trunc. tetra', prolate: 'Prolate', oblate: 'Oblate', bilinski: 'Bilinski', ricosa: 'Rh. icosa', rtriac: 'Triaconta' };
    const orderOf = (g, id) => (g === 'ekp' ? EKP_ORDER.indexOf(id) : 0);
    const button = (id, s) => `<button type="button" data-solid="${id}" class="${id === solid && !cellView ? 'active' : ''}" title="${s.label}">${SHORT[id] ?? s.label}</button>`;
    // A long group (the EKP cell's ten pieces and Whole cell) takes its own lines: its name above, its buttons wrapping, so none is cut off on a phone.
    const LONG = 7;
    solidsRow.innerHTML = SOLID_GROUPS.map((g) => `<div class="w4d-row w4d-options${Object.values(SOLIDS).filter((s) => s.groups.includes(g.id)).length >= LONG ? ' nets-long' : ''}"><span class="nets-group">${t(`nets.group.${g.id}`, lang())}</span>${Object.entries(SOLIDS).filter(([, s]) => s.groups.includes(g.id)).sort(([a], [b]) => orderOf(g.id, a) - orderOf(g.id, b)).map(([id, s]) => button(id, s)).join('')}${g.id === 'ekp' ? `<button type="button" data-cell class="${cellView ? 'active' : ''}">${t('nets.cell', lang())}</button>` : ''}</div>`).join('');
    // Next, inside out: from a folded EKP piece, or from the whole cell.
    const next = nextPiece();
    nextRow.hidden = !(cellView ? next : EKP_PIECES[solid] && fold === 1);
    nextBtn.textContent = next ? t('nets.next', lang(), { name: SOLIDS[next].label }) : t('nets.cell', lang());
    cellRow.hidden = !cellView || !built().length;
    cellSlider.title = t('nets.wrap', lang());
    cellSlider.setAttribute('aria-label', cellSlider.title);
    if (cellView) { foldRow.hidden = true; return; }
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
      if (!on) { cancelAnimationFrame(tween); cancelAnimationFrame(foldRaf); cancelAnimationFrame(wrapRaf); panel.classList.remove('visible'); }
      draw();
      if (on) { frame(); if (!cellView && !done()) showHudPrompt(t('nets.prompt.start', lang()), 5000); }
    },
    /** Folded any way at all: the net has left 2D. */
    get folded() { return cellView || fold > 0; },
    get isEmpty() { return Object.values(progress).every((v) => v === 0); },
    /** Nothing built on the solid you're on (the ⊘ beside Undo). */
    get currentEmpty() { return cellView || (progress[solid] === 0 && fold === 0); },
    /** ⊘ beside Undo (direct request: "need the delete button on nets"):
     * the solid you're on, back to its ghost net; Undo brings it back. */
    clearCurrent() {
      cancelAnimationFrame(foldRaf);
      progress[solid] = 0; fold = 0; foldDone[solid] = false;
      save(); draw(); if (active) { frame(true); showHudPrompt(t('nets.prompt.start', lang()), 5000); }
      onChange();
    },
    clear() { for (const id of Object.keys(progress)) { progress[id] = 0; foldDone[id] = false; } fold = 0; cellView = false; save(); draw(); if (active) frame(true); onChange(); },
    snapshot: toJSON,
    restore(json) { read(json); save(); draw(); if (active) frame(true); },
    toJSON,
  };
}
