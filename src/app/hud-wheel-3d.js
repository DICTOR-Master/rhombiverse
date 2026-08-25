// The HUD Wheel -- a small, persistent, always-visible RD mesh in the
// HUD corner replacing the previous row of 9 individual icon buttons
// (Lab/X-Ray/Cyborg/Sculpture Mode/Duality/BCC/Menu/Clear World/
// Reload) with symbol faces on the real shape itself. Direct user
// decision 2026-08-25: silver-grey opaque with black relief edges,
// rotates on touch/drag only (no auto-rotate, no idle timer -- it's
// always sitting there, nothing about it should move on its own),
// replacing the whole row rather than sitting alongside it.
//
// Reuses the same RD face geometry as the full Rhombic Wheel 3D
// (buildRDFaces/ensureOutwardWinding/faceKey from
// rhombic-wheel-3d-core.js) but is a genuinely separate, much smaller
// component with its own material style and interaction model -- not
// a scaled-down instance of that wheel's own renderer/state machine.
//
// Rendering: shares the MAIN scene's own THREE.WebGLRenderer via a
// scissor/viewport sub-region every frame rather than creating a
// second renderer -- this session already found and fixed a real perf
// cost from two simultaneous full-scene WebGL renders (see docs/
// code-notes/app/rhombic-wheel-3d.md); a persistent, always-on mini
// wheel would make that same mistake permanent instead of a transient
// modal-open cost, so it shares the existing renderer/canvas instead
// of standing up its own.
import * as THREE from 'three';
import { buildRDFaces, faceKey, ensureOutwardWinding } from './rhombic-wheel-3d-core.js';

const SILVER = 0xb8bcc2;
const RELIEF_LINE_COLOR = 0x0a0a0c;

const CSS = `
#hud-wheel-3d-labels {
  position: fixed; inset: 0; pointer-events: none; z-index: 901;
}
.hud-wheel-3d-symbol {
  position: absolute; transform: translate(-50%, -50%);
  color: #0a0a0c;
  font: 700 15px/1 system-ui, sans-serif;
  text-shadow: 0 0 3px rgba(255,255,255,0.55);
  pointer-events: none;
  user-select: none;
}
`;

function injectCssOnce() {
  if (document.getElementById('hud-wheel-3d-style')) return;
  const style = document.createElement('style');
  style.id = 'hud-wheel-3d-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Symbols reused verbatim from the real buttons they replace -- same
// established visual language, not new icons. Menu gets a distinct
// glyph (◇ vs Cyborg's ◈) since two identical symbols on one
// symbol-only wheel would be genuinely ambiguous with no text to
// disambiguate, unlike the old button row where position/tooltip did.
const HUD_FACES = {
  'equator|sx1sy1':   { symbol: '⚙', elId: 'lab-toggle',              title: 'Advanced / Lab' },
  'equator|sx1sy-1':  { symbol: '⛶', elId: 'xray-toggle',             title: 'X-Ray' },
  'equator|sx-1sy1':  { symbol: '◈', elId: 'cyborg-toggle',           title: 'Cyborg Mode' },
  'equator|sx-1sy-1': { symbol: '◆', elId: 'sculpture-mode-toggle',   title: 'Sculpture Mode' },
  'top|sy1sz1':       { symbol: '◐', elId: 'duality-toggle',          title: 'Duality' },
  'top|sy-1sz1':      { symbol: '⬡', elId: 'bcc-toggle',              title: 'BCC Lattice' },
  'top|sx1sz1':       { symbol: '◇', elId: 'rhombic-wheel-3d-toggle', title: 'Menu' },
  'top|sx-1sz1':      { symbol: '⊘', elId: 'clear-world-toggle',      title: 'Clear World' },
  'bottom|sy1sz-1':   { symbol: '↻', elId: 'reload-toggle',           title: 'Reload' },
  // 3 spare faces (bottom|sy-1sz-1, bottom|sx1sz-1, bottom|sx-1sz-1):
  // deliberately blank, same "reserved for later, not invented" policy
  // as the full wheel's own SPARE faces.
};

export function createHudWheel3D(renderer, { size = 96, margin = 12 } = {}) {
  injectCssOnce();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  camera.position.set(0, 0, 7);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 0.4);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  // A gentle fixed tilt so more than one face reads at rest, rather
  // than staring straight down one face's normal.
  group.rotation.set(-0.35, 0.55, 0);

  const faceEntries = [];
  const labelsLayer = document.createElement('div');
  labelsLayer.id = 'hud-wheel-3d-labels';
  document.body.appendChild(labelsLayer);

  for (const face of buildRDFaces()) {
    const k = faceKey(face);
    const data = HUD_FACES[k];
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
    // Solid, opaque, silver-grey -- deliberately the opposite of the
    // full wheel's near-invisible glass fill; this one is meant to
    // read as a real small object sitting in the HUD, not a
    // see-through overlay.
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
      color: SILVER, metalness: 0.55, roughness: 0.35, side: THREE.DoubleSide,
    }));
    mesh.userData.faceKey = k;
    group.add(mesh);

    // Black relief: a real outlined edge per face, giving the
    // embossed/medallion look asked for, not just a flat silver blob.
    const lineGeom = new THREE.BufferGeometry().setFromPoints([...verts, verts[0]]);
    const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: RELIEF_LINE_COLOR }));
    group.add(line);

    let labelEl = null;
    if (data) {
      labelEl = document.createElement('div');
      labelEl.className = 'hud-wheel-3d-symbol';
      labelEl.textContent = data.symbol;
      labelEl.title = data.title;
      labelEl.dataset.faceKey = k;
      labelsLayer.appendChild(labelEl);
    }

    faceEntries.push({ key: k, data, mesh, centroid, normal: verts[1].clone().sub(verts[0]).cross(verts[3].clone().sub(verts[0])).normalize(), labelEl });
  }

  // Viewport rectangle in CSS pixels, top-right corner. Recomputed on
  // resize; used both for the scissor render call and for converting a
  // pointer event's page coordinates into this mini scene's own NDC
  // space (which is NOT the same as the main scene's, since it only
  // occupies a small sub-rectangle of the canvas).
  // renderer.setViewport/setScissor take CSS-pixel units (THREE scales
  // by devicePixelRatio internally, same convention as .setSize) --
  // and WebGL's own y-axis runs bottom-up, unlike CSS/DOM's top-down,
  // so glY is a real flip, not just a rename.
  let rect = { x: 0, y: 0, w: size, h: size, cssX: 0, cssY: 0, cssW: size, cssH: size };
  function updateRect() {
    const cssX = window.innerWidth - size - margin;
    const cssY = margin;
    rect = {
      x: cssX, y: window.innerHeight - cssY - size,
      w: size, h: size,
      cssX, cssY, cssW: size, cssH: size,
    };
  }
  updateRect();
  window.addEventListener('resize', updateRect);

  const fullSize = new THREE.Vector2();
  function render() {
    updateRect();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.setScissorTest(true);
    renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
    renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    // Critical: restore the full-canvas viewport, or the main scene's
    // next render() call would inherit this small leftover viewport
    // and render into a corner of the canvas too.
    renderer.getSize(fullSize);
    renderer.setViewport(0, 0, fullSize.x, fullSize.y);

    for (const e of faceEntries) {
      if (!e.labelEl) continue;
      const worldNormal = e.normal.clone().applyQuaternion(group.quaternion);
      const viewDirToCamera = camera.position.clone().sub(e.centroid.clone().applyQuaternion(group.quaternion)).normalize();
      const facing = worldNormal.dot(viewDirToCamera);
      const visible = facing > 0.3;
      e.labelEl.style.opacity = visible ? '1' : '0';
      if (!visible) continue;
      const worldCentroid = e.centroid.clone().applyQuaternion(group.quaternion);
      const p = worldCentroid.clone().project(camera);
      e.labelEl.style.left = `${rect.cssX + (p.x * 0.5 + 0.5) * rect.cssW}px`;
      e.labelEl.style.top = `${rect.cssY + (-p.y * 0.5 + 0.5) * rect.cssH}px`;
    }
  }

  function pickFace(clientX, clientY) {
    const localX = clientX - rect.cssX;
    const localY = clientY - rect.cssY;
    if (localX < 0 || localX > rect.cssW || localY < 0 || localY > rect.cssH) return null;
    const ndc = new THREE.Vector2((localX / rect.cssW) * 2 - 1, -(localY / rect.cssH) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(faceEntries.map((e) => e.mesh));
    return hits.length ? hits[0].object.userData.faceKey : null;
  }

  return { scene, camera, group, faceEntries, render, pickFace, getRect: () => rect };
}
