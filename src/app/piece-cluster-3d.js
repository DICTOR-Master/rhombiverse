// Piece picker, take 2: a real mini 3D render, not a flat SVG. Direct
// live comparison against a real wheel screenshot showed the flat SVG
// version (still in wheel-pickers.js's own history/docs) was "easily
// distinguishable from the real wheel" -- missing genuine perspective
// foreshortening and per-face directional-light shading, which no
// amount of flat-CSS tuning can produce. This rebuilds the same 4-face
// idea (RHOMBIVERSE has 6 real 4-valent RD vertices, each with exactly
// 4 faces meeting there) as a real THREE.js render instead.
//
// Rendering technique reused wholesale from hud-wheel-3d.js: shares the
// MAIN scene's own WebGLRenderer via a scissor/viewport sub-region each
// frame rather than a second renderer -- same perf reasoning as that
// file's own header. Unlike the HUD wheel (always-on, corner-anchored,
// gold/opaque, freely rotatable), this one is: centered on screen,
// SKELETON_COLOR translucent wireframe (the MAIN wheel's own material
// style -- "the menu one not the HUD", direct clarification), and only
// rendered/listened-to while the Piece picker is actually open.
//
// Two real vertex views, not one (added 2026-08-28, interstitial-lattice
// piece tiers): originally a single FIXED rotation was enough -- exactly
// 4 real faces meet at one 4-valent RD vertex, matching the 4 piece
// tiers that existed then. Adding 2 more tiers broke that 1:1 fit; a
// flat CSS-positioned "satellite" pair was tried first and reverted on
// direct feedback ("not flat... a new wheel") -- it silently reintroduced
// exactly the "reads as fake" problem this whole widget exists to avoid.
// The real fix, verified computationally (a headless script enumerated
// every one of the RD's 6 four-valent vertices and which faces meet at
// each): the CURRENT vertex (2,0,0) and its ANTIPODAL vertex (-2,0,0)
// share ZERO faces (verified -- their two 4-face sets are completely
// disjoint, as central symmetry guarantees for antipodal RD vertices),
// so a second real, equally-valid 4-face view exists just by rotating
// group.rotation.y from -PI/2 to +PI/2 (the sign-flip is not
// coincidental: rotating -x to face the camera instead of +x is exactly
// that flip). A single view showing all 6 faces at once does NOT exist
// on this polyhedron -- also checked directly (a 3-fold body-diagonal
// view only brings 3 faces to a comparable facing value, not 6) -- so
// this is a real two-state ROTATING wheel (click the flip control),
// not a single magic angle.
import * as THREE from 'three';
import { buildRDFaces, faceKey, ensureOutwardWinding, SKELETON_COLOR, FACE_STYLE } from './rhombic-wheel-3d-core.js';
import { MARKS, iconFrame } from './wheel-icons.js';

// Two real vertex views: index 0 is the original (2,0,0) vertex's own 4
// faces (RD/Cube/Pyramid/TO); index 1 is the antipodal (-2,0,0) vertex's
// -- of its own 4 real faces, 2 host the new interstitial tiers and the
// other 2 stay non-interactive context, the same treatment the other 8
// faces already get at view 0.
const ROTATIONS = [-Math.PI / 2, Math.PI / 2];
const PIECE_FACE_DATA = {
  'equator|sx1sy1': { value: 'rd', markKey: 'pieceRD', label: 'RD', view: 0 },
  'equator|sx1sy-1': { value: 'cube', markKey: 'pieceCube', label: 'Cube', view: 0 },
  'top|sx1sz1': { value: 'pyramid', markKey: 'piecePyramid', label: 'Pyramid', view: 0 },
  'bottom|sx1sz-1': { value: 'to', markKey: 'pieceTO', label: 'TO', view: 0 },
  'top|sx-1sz1': { value: 'idis', markKey: 'pieceDisphenoid', label: 'Disphenoid', view: 1 },
  'bottom|sx-1sz-1': { value: 'ioct', markKey: 'pieceOctaSite', label: 'Octa Site', view: 1 },
};

const CSS = `
#piece-cluster-3d-labels {
  position: fixed; inset: 0; z-index: 987; display: none;
}
#piece-cluster-3d-labels.open { display: block; }
.piece-cluster-3d-label {
  position: absolute;
  pointer-events: auto; cursor: pointer;
  opacity: 0; transition: opacity 0.15s ease;
}
/* Icon and text are each independently centered on the label's own
   (left, top) anchor point -- NOT a flex column centered as one block.
   Real bug found live (2026-08-28): centering the icon+text stack as a
   single unit put the icon itself systematically ~9-10px above each
   face's true projected centroid (the text underneath pulled the
   whole stack's center down), on all 4 faces alike. Decoupling them
   means the icon's own center lands exactly on the true centroid,
   with the text simply anchored below it, not sharing its transform. */
.piece-cluster-3d-icon {
  position: absolute; left: 0; top: 0; transform: translate(-50%, -50%);
  width: 44px; height: 44px; color: #4DD0E1;
}
.piece-cluster-3d-icon svg { width: 100%; height: 100%; display: block; }
.piece-cluster-3d-text {
  position: absolute; left: 0; top: 26px; transform: translateX(-50%);
  white-space: nowrap;
  color: #eaf6ff; font: 700 11px system-ui, sans-serif;
  text-transform: uppercase; letter-spacing: 0.5px;
  opacity: 0; transition: opacity 0.15s ease;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9);
}
.piece-cluster-3d-label:hover .piece-cluster-3d-text,
.piece-cluster-3d-label.current .piece-cluster-3d-text { opacity: 1; }
.piece-cluster-3d-label.current .piece-cluster-3d-icon { filter: drop-shadow(0 0 6px #9de0ff); }
#piece-cluster-3d-hint {
  position: fixed; left: 50%; transform: translateX(-50%);
  color: #eaf6ff; font: 13px system-ui, sans-serif;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.9);
  pointer-events: none;
}
#piece-cluster-3d-flip {
  position: fixed; transform: translate(0, -50%);
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(20, 24, 32, 0.55); border: 1.5px solid rgba(234, 246, 255, 0.4);
  color: #eaf6ff; cursor: pointer; pointer-events: auto;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease;
}
#piece-cluster-3d-flip:hover { background: rgba(77, 208, 225, 0.25); border-color: #4DD0E1; }
`;

function injectCssOnce() {
  if (document.getElementById('piece-cluster-3d-style')) return;
  const style = document.createElement('style');
  style.id = 'piece-cluster-3d-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createPieceCluster3D(renderer, { size = 280 } = {}) {
  injectCssOnce();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  // Closer than the HUD wheel's z=7 -- this widget only ever needs to
  // show 4 faces prominently, not the whole 12-face RD at once, so it's
  // deliberately zoomed in more (direct instruction: the flat-SVG
  // version read as too small).
  camera.position.set(0, 0, 4.6);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 0.4);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  let viewIndex = 0;
  let currentRotY = ROTATIONS[0];
  let targetRotY = ROTATIONS[0];
  group.rotation.set(0, currentRotY, 0);

  const faceEntries = [];
  const labelsLayer = document.createElement('div');
  labelsLayer.id = 'piece-cluster-3d-labels';
  document.body.appendChild(labelsLayer);
  const hint = document.createElement('div');
  hint.id = 'piece-cluster-3d-hint';
  hint.textContent = 'Pick a piece';
  labelsLayer.appendChild(hint);

  // Flip control: the only way to reach view 1's 2 tiers (Octa Site /
  // Disphenoid) -- a small rotate-arrow button, not another RD face,
  // since it isn't itself a pickable piece. Animated (render()'s own
  // lerp toward targetRotY), so it reads as the wheel actually turning,
  // not an instant cut.
  const flipBtn = document.createElement('button');
  flipBtn.id = 'piece-cluster-3d-flip';
  flipBtn.type = 'button';
  flipBtn.title = 'Rotate to see more piece types';
  flipBtn.innerHTML = '<svg viewBox="-12 -12 24 24" width="22" height="22"><path d="M8,-6 A9,9 0 1 1 -8,-6 M8,-6 L8,1 M8,-6 L1,-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  labelsLayer.appendChild(flipBtn);

  for (const face of buildRDFaces()) {
    const k = faceKey(face);
    const data = PIECE_FACE_DATA[k];
    let verts = face.verts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const centroid = verts.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(verts.length);
    verts = ensureOutwardWinding(verts, centroid);

    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array([
      ...verts[0].toArray(), ...verts[1].toArray(), ...verts[2].toArray(),
      ...verts[0].toArray(), ...verts[2].toArray(), ...verts[3].toArray(),
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.computeVertexNormals();
    // Same material recipe as the MAIN Rhombic Wheel 3D's own faces
    // (rhombic-wheel-3d.js's buildWheel) -- translucent SKELETON_COLOR,
    // not the HUD wheel's opaque gold. The 4 real piece faces get a
    // brighter fill than the other 8 (context only, never clickable)
    // so they read as the actual interactive surface at a glance.
    const isPieceFace = !!data;
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      color: SKELETON_COLOR,
      transparent: true,
      opacity: isPieceFace ? FACE_STYLE.fillOpacityBase * 2.2 : FACE_STYLE.fillOpacityBase,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    mesh.userData.faceKey = k;
    if (isPieceFace) group.add(mesh);
    else group.add(mesh); // context faces still added, just dimmer -- see opacity above

    const lineGeom = new THREE.BufferGeometry().setFromPoints([...verts, verts[0]]);
    const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({
      color: SKELETON_COLOR, transparent: true,
      opacity: isPieceFace ? FACE_STYLE.outlineOpacityBase * 1.6 : FACE_STYLE.outlineOpacityBase * 0.6,
    }));
    group.add(line);

    let labelEl = null;
    if (data) {
      labelEl = document.createElement('div');
      labelEl.className = 'piece-cluster-3d-label';
      labelEl.dataset.value = data.value;
      // Real bug found live (2026-08-28): MARKS entries are bare <polygon>
      // fragments meant to sit INSIDE an <svg> (see wheel-icons.js's own
      // iconFrame(), used everywhere else a MARKS value is rendered) --
      // injecting one directly into a plain <span> via innerHTML produces
      // no visible shape at all, since a <polygon> outside an SVG context
      // isn't valid markup to parse. Every other picker in this codebase
      // already wraps MARKS values in iconFrame(); this one just missed it.
      labelEl.innerHTML = `
        <span class="piece-cluster-3d-icon">${iconFrame(MARKS[data.markKey] ?? '', { title: data.label })}</span>
        <span class="piece-cluster-3d-text">${data.label}</span>`;
      labelsLayer.appendChild(labelEl);
    }

    faceEntries.push({
      key: k, data, mesh, centroid,
      normal: verts[1].clone().sub(verts[0]).cross(verts[3].clone().sub(verts[0])).normalize(),
      labelEl,
    });
  }

  // Centered on screen (unlike the HUD wheel's fixed corner) -- recomputed
  // on resize and whenever opened, since "centered" depends on current
  // viewport size.
  let rect = { x: 0, y: 0, w: size, h: size, cssX: 0, cssY: 0, cssW: size, cssH: size };
  function updateRect() {
    const cssX = (window.innerWidth - size) / 2;
    // Nudged well up from dead-center: the bottom face's own label sits
    // outside the widget's own rect (pushed outward along its radius,
    // same as every other face's label), and on a real viewport that
    // area can collide with bottom UI (the welcome tutorial panel,
    // HUD prompts) -- caught by an actual screenshot, not assumed.
    const cssY = (window.innerHeight - size) / 2 - 70;
    rect = { x: cssX, y: window.innerHeight - cssY - size, w: size, h: size, cssX, cssY, cssW: size, cssH: size };
  }
  updateRect();
  window.addEventListener('resize', updateRect);

  let isOpen = false;
  const fullSize = new THREE.Vector2();
  function render() {
    if (!isOpen) return;
    // Simple per-call lerp toward the target rotation (flip()/open()
    // below set targetRotY) -- this widget is only ever rendered while
    // open, at the main scene's own frame rate, so a fixed factor reads
    // as a smooth, quick snap rather than a literal instant jump.
    currentRotY += (targetRotY - currentRotY) * 0.2;
    group.rotation.y = currentRotY;
    updateRect();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.setScissorTest(true);
    renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
    renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
    // Skip the usual full clear: the main scene already rendered the
    // live world into this same canvas region earlier in this exact
    // frame (this widget only opens once the modal wheel itself has
    // closed), so NOT clearing color leaves that real frame showing
    // through everywhere this mini-render doesn't draw -- floating over
    // the world, not a solid box (the HUD wheel's own corner box is an
    // accepted, unrelated tradeoff -- small and corner-anchored; this
    // widget is centered and prominent, so the difference matters more
    // here). clearDepth() still resets the depth buffer WITHIN the
    // active scissor rect (WebGL's scissor test constrains clears too),
    // so this mini-scene's own faces still occlude each other correctly
    // -- they just don't fight leftover depth values from the world.
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    renderer.getSize(fullSize);
    renderer.setViewport(0, 0, fullSize.x, fullSize.y);

    hint.style.left = `${rect.cssX + rect.cssW / 2}px`;
    hint.style.top = `${rect.cssY - 24}px`;
    flipBtn.style.left = `${rect.cssX + rect.cssW + 18}px`;
    flipBtn.style.top = `${rect.cssY + rect.cssH / 2}px`;

    for (const e of faceEntries) {
      if (!e.labelEl) continue;
      const worldNormal = e.normal.clone().applyQuaternion(group.quaternion);
      const viewDirToCamera = camera.position.clone().sub(e.centroid.clone().applyQuaternion(group.quaternion)).normalize();
      const facing = worldNormal.dot(viewDirToCamera);
      const visible = facing > 0.3;
      e.labelEl.style.opacity = visible ? '1' : '0';
      e.labelEl.style.pointerEvents = visible ? 'auto' : 'none';
      if (!visible) continue;
      const worldCentroid = e.centroid.clone().applyQuaternion(group.quaternion);
      const p = worldCentroid.clone().project(camera);
      e.labelEl.style.left = `${rect.cssX + (p.x * 0.5 + 0.5) * rect.cssW}px`;
      e.labelEl.style.top = `${rect.cssY + (-p.y * 0.5 + 0.5) * rect.cssH}px`;
    }
  }

  function setCurrent(value) {
    for (const e of faceEntries) {
      if (!e.labelEl) continue;
      e.labelEl.classList.toggle('current', e.data?.value === value);
    }
  }

  function flip() {
    viewIndex = 1 - viewIndex;
    targetRotY = ROTATIONS[viewIndex];
  }
  flipBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't let this bubble into the "click outside closes" handler below
    flip();
  });

  function open(currentValue) {
    isOpen = true;
    labelsLayer.classList.add('open');
    updateRect();
    setCurrent(currentValue);
    // Land on whichever view actually contains the currently-selected
    // tier, so re-opening the picker on e.g. Disphenoid doesn't require
    // an extra flip just to see your own current selection highlighted.
    const currentEntry = faceEntries.find((f) => f.data?.value === currentValue);
    viewIndex = currentEntry?.data?.view ?? 0;
    targetRotY = ROTATIONS[viewIndex];
    currentRotY = targetRotY; // snap instantly on open, no animated flip
    group.rotation.y = currentRotY;
  }
  function close() {
    isOpen = false;
    labelsLayer.classList.remove('open');
  }

  let onPickCallback = null;
  labelsLayer.addEventListener('click', (e) => {
    const labelEl = e.target.closest('.piece-cluster-3d-label');
    if (!labelEl || !onPickCallback) return;
    const value = labelEl.dataset.value;
    const entry = faceEntries.find((f) => f.data?.value === value);
    onPickCallback(value, entry?.data?.label ?? value);
  });
  // Click anywhere else in the label layer (the transparent backdrop,
  // not a specific face) closes -- same "click outside to dismiss"
  // convention the other pickers use, without needing a real dimming
  // overlay div (which would sit on top of the canvas and hide the
  // scissor-rendered wheel underneath it -- see this file's own header).
  labelsLayer.addEventListener('click', (e) => {
    if (e.target === labelsLayer) close();
  });

  return {
    open, close, render,
    get isOpen() { return isOpen; },
    setOnPick(fn) { onPickCallback = fn; },
  };
}
