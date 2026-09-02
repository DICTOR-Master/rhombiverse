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
     on all symbols"). First attempt used a crisp multi-layer outline;
     direct follow-up feedback said that read as too much white overall
     -- reverted to the original single text-shadow mechanism, just a
     little stronger (opacity 0.55->0.8, blur 3px->4px) rather than a
     new outline effect. filter: drop-shadow() instead of text-shadow so
     it also reaches the real inline-SVG faces (e.g. Cuboctahedron
     Build, bottom|sx1sz-1), which text-shadow never affected.
     Second round of direct feedback, same day, more specific: the real
     problem isn't glow strength, it's that some Unicode glyphs are
     inherently thin single-line marks (Spherical's ◯, X-Ray's ⛶,
     Reload's ↻, Menu's ◇) that font-weight:700 barely thickens -- bold
     Latin weight doesn't reliably apply to symbol codepoints the same
     font falls back to -- while filled glyphs (Lab's ⚙, Cyborg's ◈)
     read fine already. -webkit-text-stroke adds real stroke width to
     every glyph's own outline (not a halo/shadow) -- a small value
     visibly bolds the thin ones without over-thickening the already-
     solid ones already carrying plenty of ink. */
  -webkit-text-stroke: 1.4px currentColor;
  filter: drop-shadow(0 0 4px rgba(255,255,255,0.8));
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
  // Direct instruction 2026-09-02: "get rid of lab everywhere" -- title
  // only, dropped from "Advanced / Lab" to plain "Settings"; internal
  // elId (#lab-toggle) unchanged.
  'equator|sx1sy1':   { symbol: '⚙', elId: 'lab-toggle',              title: 'Settings' },
  'equator|sx1sy-1':  { symbol: '⛶', elId: 'xray-toggle',             title: 'X-Ray' },
  // Real SVG robot head, not the bare ◈ glyph -- same final design as
  // wheel-icons.js's MARKS.cyborg (see that file's own comment for the
  // full 5-round review history and Metropolis/Maschinenmensch
  // sourcing), scaled into this file's own tiny coordinate convention.
  // Ellipse head, big round eyes, two open neck rings (narrow-then-
  // wide going down). Ears simplified to 2 tiers instead of the main
  // mark's 4 -- at this face's true render size (~1/19th the main
  // wheel's), 4 sub-1-unit steps would blur into noise; 2 clear tiers
  // (a small tab + one bold peak at the vertical center) keep the
  // "graduated, not a smooth cork" silhouette legible at actual size.
  'equator|sx-1sy1':  {
    svg: '<svg viewBox="-2.6 -2.6 5.2 5.2" width="1em" height="1em"><path d="M1,-0.68 L1.1,-0.68 L1.1,-0.47 L1.5,-0.47 L1.5,-0.05 L1.1,-0.05 L1.1,0.16 L1,0.16 Z M-1,-0.68 L-1.1,-0.68 L-1.1,-0.47 L-1.5,-0.47 L-1.5,-0.05 L-1.1,-0.05 L-1.1,0.16 L-1,0.16 Z" fill="currentColor"/><ellipse cx="0" cy="-0.26" rx="1.04" ry="1.25" fill="none" stroke="currentColor" stroke-width="0.16"/><circle cx="-0.42" cy="-0.47" r="0.29" fill="currentColor"/><circle cx="0.42" cy="-0.47" r="0.29" fill="currentColor"/><ellipse cx="0" cy="1.14" rx="0.42" ry="0.16" fill="none" stroke="currentColor" stroke-width="0.16"/><ellipse cx="0" cy="1.46" rx="0.52" ry="0.16" fill="none" stroke="currentColor" stroke-width="0.16"/></svg>',
    elId: 'cyborg-toggle', title: 'Cyborg Mode',
  },
  'equator|sx-1sy-1': { symbol: '◆', elId: 'sculpture-mode-toggle',   title: 'Sculpture Mode' },
  'top|sy1sz1':       { symbol: '◐', elId: 'duality-toggle',          title: 'Duality' },
  // Real SVG hexagon, not the bare ⬡ Unicode glyph: direct report
  // 2026-09-02 ("some single line lattice wheel symbols on HUD are
  // still feint") -- measured live, this glyph's rendered ink bounding
  // box is comparable in SIZE to the others (X-Ray/Menu), so the
  // SYMBOL_SCALE bump above wasn't the actual gap; the font just
  // renders ⬡ with much thinner strokes than sibling glyphs like ◇,
  // and -webkit-text-stroke didn't compensate enough for that specific
  // codepoint. Same fix already used for Cuboctahedron Build below (a
  // real SVG gives direct stroke-width control instead of depending on
  // font glyph rendering) -- a plain hexagon outline, matching that
  // face's own coordinate scale and stroke weight for visual
  // consistency.
  //
  // IMPORTANT: this static value is a real fallback, but it is NOT what
  // the user actually sees in practice -- render.js's
  // updateLatticeQuickViewIcon() overwrites this exact face's
  // labelEl.innerHTML live, once at startup and again on every Lattice
  // View cycle, keyed by LATTICE_QUICK_VIEW_MARK_KEY (a different icon
  // system, wheel-icons.js's MARKS/iconFrame). The "still feint" report
  // that named this face was actually that live sync producing a
  // BLANK frame in the default 'off' state (no mark key existed for
  // it) -- fixed there (see LATTICE_QUICK_VIEW_MARK_KEY / MARKS.
  // latticeOff), not by anything in this file. Keep this SVG in sync
  // with MARKS.latticeOff's own visual weight if either ever changes.
  'top|sy-1sz1':      {
    svg: '<svg viewBox="-2.6 -2.6 5.2 5.2" width="1em" height="1em"><polygon points="0,-2.3 1.99,-1.15 1.99,1.15 0,2.3 -1.99,1.15 -1.99,-1.15" fill="none" stroke="currentColor" stroke-width="0.32" stroke-linejoin="round"/></svg>',
    elId: 'bcc-toggle', title: 'BCC Lattice',
  },
  'top|sx1sz1':       { symbol: '◇', elId: 'rhombic-wheel-3d-toggle', title: 'Menu' },
  'top|sx-1sz1':      { symbol: '⊘', elId: 'clear-world-toggle',      title: 'Clear World' },
  'bottom|sy1sz-1':   { symbol: '↻', elId: 'reload-toggle',           title: 'Reload' },
  // This face was a temporary duplicate of Duality at its true
  // geometric antipode (see the policy note below on the one remaining
  // duplicate). Replaced with real new content, Spherical Toggle, the
  // same "duplicate slot -> real function" swap Cuboctahedron Build
  // (bottom|sx1sz-1 below) later also did with the (by-then-retired)
  // BCC Build's own slot -- Spherical is the closer sibling to Duality
  // anyway (both are client-side view toggles that reinterpret the
  // same cells, not new world-state), so it fits its old spot
  // semantically too.
  'bottom|sy-1sz-1':  { symbol: '◯', elId: 'spherical-toggle',        title: 'Spherical' },
  // BCC Build retired 2026-09-02 (direct report): a genuinely separate,
  // duplicate implementation of the exact bootstrap/extend mechanic
  // Piece:TO's own handleToClick already provided (see core/build.js,
  // core/bcc-build.md) -- not a second real doorway, an actual
  // reimplementation. This slot is filled with real new content
  // instead of a duplicate ("no blank spaces but no adjacent
  // duplications either," direct instruction) -- Cuboctahedron Build
  // had no seat anywhere on this medallion at all (only on the Piece
  // wheel and the Lab panel), so it's a genuinely new capability here,
  // not filler. Verified non-adjacent to every real Cuboctahedron
  // Build doorway (there isn't another one on this wheel to be
  // adjacent to). Deliberately NOT the same hexagon-with-3-alternating-
  // wedges mark wheel-icons.js's MARKS.cuboctahedron uses -- direct
  // follow-up report caught a real collision that mark would have
  // caused: render.js's updateLatticeQuickViewIcon() overwrites the
  // 'BCC Lattice' face above (top|sy-1sz1) with that exact same mark
  // whenever Lattice View is cycled to its own 'cubocta' preview mode
  // -- confirmed live, both faces showed the identical icon
  // simultaneously. Same "real placement vs. live preview need visibly
  // different icons, even for the same shape family" precedent the
  // retired BCC Build face already established against BCC Lattice's
  // own plain hexagon. Solid filled hexagon with a "+" cut out (evenodd)
  // instead -- the same Add-tool "+" language used elsewhere in this
  // app, on a solid (not wedge-shaded) hexagon, so it reads as "commit/
  // place" rather than "preview."
  'bottom|sx1sz-1':   {
    svg: '<svg viewBox="-2.6 -2.6 5.2 5.2" width="1em" height="1em"><path d="M0,-1.5 L1.3,-0.75 L1.3,0.75 L0,1.5 L-1.3,0.75 L-1.3,-0.75 Z M0.18,0.18 L0.18,1.0 L-0.18,1.0 L-0.18,0.18 L-1.0,0.18 L-1.0,-0.18 L-0.18,-0.18 L-0.18,-1.0 L0.18,-1.0 L0.18,-0.18 L1.0,-0.18 L1.0,0.18 Z" fill="currentColor" fill-rule="evenodd"/></svg>',
    elId: 'cubocta-build-toggle', title: 'Cuboctahedron Build',
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
