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
//
// TODO (parked 2026-08-25, not a rejected idea -- just unresolved):
// tried attaching each symbol as a real textured plane on the rotating
// geometry (an "engraving" rigidly parented to `group`) instead of this
// camera-facing DOM overlay, per direct user feedback that a billboard
// reads as "floating" detached from the object during a drag. Hit a
// real, unexplained rendering bug -- the dark glyph fill barely showed
// (only the light halo was visible), and it survived two ruled-out
// hypotheses (Canvas 2D font-fallback gap: ruled out, glyphs render
// fine standalone; FrontSide backface culling: ruled out, DoubleSide
// didn't fix it either) without a clear root cause. Reverted to this
// known-working DOM approach per direct user permission ("if need be
// keep symbols floating... make a note to see if we can have them
// fixed at some point") rather than keep guessing blind.
import * as THREE from 'three';
import { buildRDFaces, faceKey, ensureOutwardWinding } from './rhombic-wheel-3d-core.js';

// Metallic gold, not silver -- deliberately distinct from "regular"
// RD material colors used elsewhere (Base Rhomb etc.), per direct
// user request 2026-08-25, so the HUD wheel reads as its own special
// object at a glance, not just another buildable material sample.
const GOLD = 0xd4af37;
const RELIEF_LINE_COLOR = 0x0a0a0c;

const CSS = `
#hud-wheel-3d-labels {
  position: fixed; inset: 0; pointer-events: none; z-index: 901;
}
.hud-wheel-3d-symbol {
  position: absolute; transform: translate(-50%, -50%) scale(var(--hw-scale, 1));
  color: #0a0a0c;
  font: 700 30px/1 system-ui, sans-serif;
  /* Legibility pass, 2026-09-02 (direct user request: "black and white
     on all symbols"): a single soft rgba(255,255,255,0.55) glow wasn't
     enough contrast against the gold medallion's own reflections/the
     world scene showing through at low opacity. Stacked drop-shadow()
     (not text-shadow) so the same treatment applies uniformly to BOTH
     the plain-glyph faces (textContent) and the one real inline-SVG
     face (BCC Build, bottom|sx1sz-1) -- text-shadow only ever affected
     the text ones. Four cardinal-offset shadows + two soft blurs read
     as a crisp, near-opaque white outline around the black glyph --
     a real black-and-white badge, not just a faint halo. */
  filter:
    drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff)
    drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff)
    drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff);
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

// A handful of these glyphs read visually smaller than the others even
// at the same font-size -- their ink doesn't fill the em-box as fully
// (a hollow double-diamond, a thin-stroke hexagon outline, a thin
// circle-slash, vs. a bold filled gear/diamond). Direct user feedback
// 2026-08-25 ("BCC lattice & cyborg mode symbols are still a bit small
// compared to others", and "Clear World" -- referred to as "start new
// world" -- flagged alongside them) -- per-symbol scale bump instead of
// raising the shared base size, which would overshoot the ones that
// already read correctly.
const SYMBOL_SCALE = {
  'cyborg-toggle': 1.25,
  'bcc-toggle': 1.3,
  'clear-world-toggle': 1.25,
};

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
  // This face was a temporary duplicate of Duality at its true
  // geometric antipode (see the policy note below on the one remaining
  // duplicate). Replaced with real new content, Spherical Toggle, the
  // same "duplicate slot -> real function" swap BCC Build (bottom|
  // sx1sz-1 below) already did with a Clear World duplicate --
  // Spherical is the closer sibling to Duality anyway (both are
  // client-side view toggles that reinterpret the same cells, not new
  // world-state), so it fits its old spot semantically too.
  'bottom|sy-1sz-1':  { symbol: '◯', elId: 'spherical-toggle',        title: 'Spherical' },
  // The 1 remaining bottom face (sx-1sz-1, below) is a temporary
  // duplicate of an existing function at its TRUE geometric antipode
  // (centroid inversion through the origin, verified numerically, same
  // standing policy as the main Rhombic Wheel 3D -- "until those blank
  // faces are filled they should serve as temporary duplicates at
  // opposite points on the RD to their duplicates", direct user
  // directive 2026-08-25). Each antipode pairing below was confirmed
  // NOT edge-adjacent to the face it duplicates before being assigned.
  // 2026-08-26 direct instruction: this slot's Clear World duplicate
  // (a confirm()-gated destructive action -- arguably doesn't even
  // WANT a quick-access shortcut) replaced with real new content, BCC
  // Build, rather than another copy. Clear World keeps its own true
  // original face (top|sx-1sz1) untouched. See core/bcc-build.md.
  //
  // Real SVG glyph, not a Unicode stand-in: the truncated octahedron
  // viewed straight down a square-face axis, verified against
  // truncatedOctahedronVertices (not eyeballed) -- 8 outer points at
  // radius sqrt(5) (the hexagonal faces' silhouette) form the octagon,
  // 4 inner points at radius 1 (the near square face itself) form the
  // centered square. One-symbol-one-purpose: deliberately distinct from
  // 'BCC Lattice' (top|sy-1sz1)'s bare ⬡ -- same shape family, but this
  // is real placement, that's a live preview, and they're different
  // functions.
  'bottom|sx1sz-1':   {
    svg: '<svg viewBox="-2.6 -2.6 5.2 5.2" width="1em" height="1em"><polygon points="-2,-1 -1,-2 1,-2 2,-1 2,1 1,2 -1,2 -2,1" fill="none" stroke="currentColor" stroke-width="0.28" stroke-linejoin="round"/><polygon points="0,-1 1,0 0,1 -1,0" fill="none" stroke="currentColor" stroke-width="0.28" stroke-linejoin="round"/></svg>',
    elId: 'bcc-build-toggle', title: 'BCC Build',
  },
  'bottom|sx-1sz-1':  { symbol: '◇', elId: 'rhombic-wheel-3d-toggle', title: 'Menu', temporary: true },
};

export function createHudWheel3D(renderer, { size = 144, margin = 12, getBackgroundColor } = {}) {
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
  // Looks straight down the 4-valent vertex (2,0,0) -- computed
  // exactly (axis-angle from vertex direction to camera, converted to
  // Euler XYZ; -90 deg yaw around Y, confirmed numerically not
  // eyeballed), showing Lab/X-Ray/Menu together: the three most
  // broadly useful functions on this wheel, per direct user request
  // 2026-08-25 ("three or four most important symbols showing face up
  // to start"). Checked all 6 four-valent vertices' real-symbol
  // coverage first -- two alternatives show all 4 real (no blank
  // face), but mix in less-central actions (Clear World, BCC); this
  // trio reads as the clearer "important" set even with one blank.
  group.rotation.set(0.35, -Math.PI / 2, 0);

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
      color: GOLD, metalness: 0.75, roughness: 0.28, side: THREE.DoubleSide,
    }));
    mesh.userData.faceKey = k;
    group.add(mesh);

    // Black relief: a real outlined edge per face, giving the
    // embossed/medallion look asked for, not just a flat silver blob.
    // Temporary duplicates get a dashed outline instead of solid --
    // same visual language as the main Rhombic Wheel 3D's own
    // temporary-duplicate faces, so the "this is a stand-in, not
    // unique content" cue reads consistently across both wheels.
    const lineGeom = new THREE.BufferGeometry().setFromPoints([...verts, verts[0]]);
    const line = data?.temporary
      ? new THREE.Line(lineGeom, new THREE.LineDashedMaterial({ color: RELIEF_LINE_COLOR, dashSize: 0.12, gapSize: 0.08 }))
      : new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: RELIEF_LINE_COLOR }));
    if (data?.temporary) line.computeLineDistances();
    group.add(line);

    let labelEl = null;
    if (data) {
      labelEl = document.createElement('div');
      labelEl.className = 'hud-wheel-3d-symbol';
      // Real inline SVG for faces that carry one (`data.svg`) instead of
      // a single Unicode character -- everything else on this wheel is
      // still a plain glyph via textContent, this is the one exception,
      // for a shape (the truncated octahedron's real silhouette) with no
      // reasonable single-character stand-in. See core/bcc-build.md.
      if (data.svg) labelEl.innerHTML = data.svg;
      else labelEl.textContent = data.symbol;
      labelEl.title = data.title;
      labelEl.dataset.faceKey = k;
      const scale = SYMBOL_SCALE[data.elId];
      if (scale) labelEl.style.setProperty('--hw-scale', String(scale));
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
  // Real bug found live (2026-08-28): this scene has no .background of
  // its own, so a full clear here falls back to the renderer's own
  // clear color -- plain black by default, regardless of whatever the
  // real world scene's own background actually is. Normally close
  // enough to invisible against the main scene's own near-black
  // background, but any lighter/different background reveals it as a
  // stark, flat square, breaking the "floating gem" illusion this
  // corner widget is going for. Fixed by explicitly clearing to
  // whatever the real scene's background actually is for this one
  // draw, then restoring the renderer's own clear color right after --
  // same save/restore discipline this function already applies to the
  // viewport below.
  const prevClearColor = new THREE.Color();
  function render() {
    updateRect();
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    renderer.setScissorTest(true);
    renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
    renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
    const bg = getBackgroundColor?.();
    let prevAlpha;
    if (bg !== undefined) {
      renderer.getClearColor(prevClearColor);
      prevAlpha = renderer.getClearAlpha();
      renderer.setClearColor(bg, 1);
    }
    renderer.render(scene, camera);
    if (bg !== undefined) {
      renderer.setClearColor(prevClearColor, prevAlpha);
    }
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
