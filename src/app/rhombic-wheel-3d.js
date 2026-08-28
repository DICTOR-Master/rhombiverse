// Rhombic Wheel 3D -- a second, parallel wheel/navigation surface built
// on the real RD mesh (see rhombic-wheel-shared-renderer.md, Phase 0-3).
// Deliberately does NOT touch wheel.js's existing 2D radial menu --
// that stays the shipped B1 control surface. This is new, flag-gated
// off by default (FEATURES.rhombicWheel3D in features.js).
//
// Self-contained: its own THREE.Scene/Camera/WebGLRenderer/Raycaster in
// a modal overlay canvas, not the main world scene -- this is a
// navigation wheel the user orbits by dragging, independent of wherever
// the camera happens to be in the world when it's opened. Full
// rationale: docs/code-notes/app/rhombic-wheel-3d.md.
import * as THREE from 'three';
import {
  buildRDFaces, faceKey, ensureOutwardWinding,
  SKELETON_COLOR, FACE_STYLE, computeLabelVisibility, LABEL_STYLE,
  resolveWheelFaces, ALL_WHEELS, applyWorkspaceModeGate, applyBCCLatticeGate,
} from './rhombic-wheel-3d-core.js';
import { iconFrame, MARKS } from './wheel-icons.js';
import { FEATURES } from './features.js';

// Icon System (RHOMBIVERSE_SPEC_ICON_SYSTEM.md): only actions the spec's
// section 4 table (or the live cross-walk's Cyborg resolution) actually
// resolves get a real mark -- every other face keeps its existing plain
// text label exactly as today. Deliberately NOT a guess-to-fill-every-
// face table: the spec explicitly says not to guess silently, and
// several real actions (tool:material, tool:repeat, tool:generateBody,
// tool:offer/accept/inventory, tool:plant/growthParams/prune, and the
// Build/Alter department-nav faces themselves) have no resolved row.
// See docs/code-notes/app/wheel-icons.md for the full gap list.
const ACTION_TO_MARK = {
  // Universal Add/Remove + Piece picker (direct instruction 2026-08-26,
  // retiring the earlier separate Rhombi-/Pyramid-/Cube- model/sculpt
  // marks). 'tool:symmetry' reuses the existing `symmetryMirror` modifier
  // mark below (a real match for what that panel actually does) rather
  // than the old generic "-" now spoken for by 'tool:remove'.
  'tool:add': 'add',
  'tool:remove': 'remove',
  'tool:symmetry': 'symmetryMirror',
  // Piece: the doorway face (WHEEL_BUILD's own "Piece") shows the
  // clustered-shapes mark as a preview of what's inside, same pattern
  // as navigateTo:build/alter below; each of the 6 real tiers inside
  // WHEEL_PIECE gets its own real shape mark instead (added 2026-08-28,
  // replacing the old bare 'tool:pieceType' -- that action string no
  // longer exists on its own now that Piece is a real wheel, not a
  // picker overlay).
  'navigateTo:piece': 'pieceType',
  'tool:pieceType:rd': 'pieceRD',
  'tool:pieceType:cube': 'pieceCube',
  'tool:pieceType:pyramid': 'piecePyramid',
  'tool:pieceType:to': 'pieceTO',
  'tool:pieceType:ioct': 'pieceOctaSite',
  'tool:pieceType:idis': 'pieceDisphenoid',
  'tool:fill': 'fill',
  'tool:dig': 'dig',
  'tool:smooth': 'smooth',
  'tool:replace': 'replace',
  'navigateTo:trade': 'trade',
  'navigateTo:rhombitect': 'rhombitect',
  'navigateTo:cultivate': 'rhombivate',
  'navigateTo:rhombisis': 'rhombisis',
  'navigateTo:explore': 'explore',
  openLenses: 'lenses',
  openAlmanac: 'almanac',
  openCyborg: 'cyborg',
  // 2026-08-26 second pass -- see wheel-icons.js for full design notes
  // on each of these (not in the spec's own table, resolved here).
  'tool:material': 'material',
  'tool:repeat': 'repeat',
  'tool:pattern': 'pattern',
  'tool:generateBody': 'generateBody',
  'tool:plant': 'plant',
  'tool:growthParams': 'growthParams',
  'tool:prune': 'prune',
  'tool:offer': 'offer',
  'tool:accept': 'accept',
  'tool:inventory': 'inventory',
  // Build/Alter department-nav faces reuse their own wheel's primary
  // tool icon -- the face is a doorway into that wheel, so its first/
  // defining action doubles as a preview of what's inside, rather than
  // inventing two more marks for "leads to the Rhombi-model wheel" /
  // "leads to the Dig wheel."
  'navigateTo:build': 'add',
  'navigateTo:alter': 'dig',
  // Construct has no tool of its own (pure routing hub, see its own
  // real code comment in rhombic-wheel-3d-core.js) -- gets a dedicated
  // mark instead of reusing either child's.
  'navigateTo:construct': 'construct',
  // Universal ring (every wheel): Lab/Settings and Home.
  openLab: 'lab',
  navigateHome: 'home',
  // BCC Build: same mark as the HUD wheel's own icon, now on the main
  // wheel too.
  'tool:bccBuild': 'bccBuild',
};
// Reveal timing (spec section 3): explicitly left tunable by the spec
// itself ("needs real testing on touch devices"), not a fixed value --
// this is a reasonable starting point, not a final answer.
const REVEAL_HOLD_MS = 350;

const CSS = `
#rhombic-wheel-3d-overlay {
  position: fixed; inset: 0; z-index: 990;
  display: none;
  background: rgba(2, 2, 6, 0.55);
}
#rhombic-wheel-3d-overlay.open { display: block; }
#rhombic-wheel-3d-canvas-wrap { position: absolute; inset: 0; }
#rhombic-wheel-3d-labels { position: absolute; inset: 0; pointer-events: none; }
.rw3d-label {
  position: absolute; transform: translate(-50%, -50%);
  width: max-content; /* explicit shrink-to-fit -- see .has-icon's own comment for why this can't be left implicit */
  color: ${SKELETON_COLOR};
  font-family: ${LABEL_STYLE.fontFamily};
  font-weight: ${LABEL_STYLE.fontWeight};
  letter-spacing: ${LABEL_STYLE.letterSpacing};
  text-transform: ${LABEL_STYLE.textTransform};
  font-size: ${LABEL_STYLE.fontSizeBase};
  text-shadow: ${LABEL_STYLE.textShadow};
  white-space: nowrap;
  pointer-events: none; /* toggled to auto per-frame only once actually visible enough to aim at -- see updateLabelsAndFaceVisuals() */
  cursor: pointer;
  opacity: 0;
}
.rw3d-label.spare { color: #7fa; opacity: 0 !important; pointer-events: none; cursor: default; }
/* Icon System (RHOMBIVERSE_SPEC_ICON_SYSTEM.md section 3): resting state
   is symbol-only; the text word is a separate child, hidden until
   .reveal (hover on desktop, hold on touch -- see REVEAL_HOLD_MS). Its
   opacity multiplies with the parent .rw3d-label's own facing-driven
   opacity (updateLabelsAndFaceVisuals()), so text only ever shows once
   the icon itself is already visible enough to be worth reading. */
/* .has-icon is NOT display:flex -- a flex row's own box (icon + gap +
   text) is what gets centered by the parent .rw3d-label's translate(-50%,
   -50%), so a hidden-but-still-laid-out text child (opacity alone doesn't
   remove it from flow) was pulling that centering point off the icon
   itself, visibly off-center from the real face anchor. The icon is the
   only thing establishing .rw3d-label's box now; the text is taken out
   of flow entirely (position:absolute) and anchored to the icon's own
   right edge, so it can never affect centering, revealed or not.
   Real regression found 2026-08-26 via getBoundingClientRect() diffed
   against every face, not just a couple: this rule used to also set
   position: relative (so .rw3d-label-text's own position:absolute had
   something to anchor to) -- but .rw3d-label.has-icon outranks the
   base .rw3d-label { position: absolute } on specificity, so it was
   silently overriding it. That turned every icon-bearing label from a
   positioned box (top/left = real screen coordinates) into a normal-flow
   block that stacks under its DOM siblings, with top/left then applied
   as a RELATIVE offset from that stacked position -- drift compounded by
   about one icon-height per face in DOM order (0, 52, 104, 156px, ...),
   identical at every viewport size tested (desktop through phone), which
   is exactly the "floating all over the place" live report and why it
   read as if centering assumed a much taller container. No position
   override needed here: position: absolute (already inherited) is
   itself a valid positioned ancestor for the text child. */
.rw3d-label-icon { display: block; width: 52px; height: 52px; }
.rw3d-label-icon svg { display: block; width: 100%; height: 100%; }
.rw3d-label-text {
  /* Above the icon, not to its right (direct instruction 2026-08-26):
     on touch, the touching hand/thumb naturally covers the area right of
     and below the touch point, hiding a label anchored there right when
     it reveals. Above keeps it clear of the hand for a right-handed
     touch the same way it already is for a mouse hover. */
  position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%);
  margin-bottom: 8px;
  opacity: 0; transition: opacity 0.15s ease;
  font-size: ${LABEL_STYLE.fontSizeBase};
}
.rw3d-label.reveal .rw3d-label-text { opacity: 1; }
#rhombic-wheel-3d-panel {
  position: absolute; right: 24px; top: 50%; transform: translateY(-50%);
  width: 260px; padding: 16px;
  background: rgba(10, 12, 20, 0.85); border: 1px solid rgba(77, 208, 225, 0.5);
  color: #eaf6ff; font: 13px system-ui, sans-serif;
  display: none;
}
#rhombic-wheel-3d-panel.open { display: block; }
#rhombic-wheel-3d-panel h3 { margin: 0 0 8px; color: ${SKELETON_COLOR}; }
#rhombic-wheel-3d-close {
  position: absolute; top: 16px; right: 16px;
  color: #eaf6ff; background: none; border: 1px solid rgba(255,255,255,0.4);
  width: 32px; height: 32px; cursor: pointer; font-size: 16px;
}
`;

function injectCssOnce() {
  if (document.getElementById('rhombic-wheel-3d-style')) return;
  const style = document.createElement('style');
  style.id = 'rhombic-wheel-3d-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createRhombicWheel3D({
  onAction, // (actionString) => void -- caller resolves navigateHome/navigateTo:x/tool:x/openLenses/etc.
  getWorkspaceMode, // () => 'model' | 'world' -- read fresh on every build, not snapshotted at construction (reframe Stage 2)
} = {}) {
  injectCssOnce();

  const overlay = document.createElement('div');
  overlay.id = 'rhombic-wheel-3d-overlay';
  const canvasWrap = document.createElement('div');
  canvasWrap.id = 'rhombic-wheel-3d-canvas-wrap';
  const labelsLayer = document.createElement('div');
  labelsLayer.id = 'rhombic-wheel-3d-labels';
  const panel = document.createElement('div');
  panel.id = 'rhombic-wheel-3d-panel';
  const closeBtn = document.createElement('button');
  closeBtn.id = 'rhombic-wheel-3d-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  overlay.append(canvasWrap, labelsLayer, panel, closeBtn);
  document.body.appendChild(overlay);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  canvasWrap.appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  const group = new THREE.Group();
  scene.add(group);

  // Per-face state: mesh (fill), line (outline), label DOM el, face data.
  const faceEntries = [];
  let currentWheelId = null;
  let hovered = null;
  let selected = null;
  let dragging = false;
  let lastPointer = null;
  let idleTimer = null;
  let autoRotating = true;
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  function clearFaces() {
    for (const e of faceEntries) {
      group.remove(e.mesh, e.line);
      e.mesh.geometry.dispose(); e.mesh.material.dispose();
      e.line.geometry.dispose(); e.line.material.dispose();
      e.labelEl.remove();
    }
    faceEntries.length = 0;
  }

  function buildWheel(wheelId) {
    const wheelConfig = ALL_WHEELS[wheelId];
    if (!wheelConfig) throw new Error(`Unknown Rhombic Wheel 3D id "${wheelId}"`);
    clearFaces();
    currentWheelId = wheelId;
    const resolved = applyBCCLatticeGate(
      applyWorkspaceModeGate(resolveWheelFaces(wheelConfig), getWorkspaceMode?.() ?? 'world'),
      FEATURES.bccLattice
    );
    for (const face of buildRDFaces()) {
      const key = faceKey(face);
      const data = resolved[key];
      let verts = face.verts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const centroid = verts.reduce((a, v) => a.add(v), new THREE.Vector3()).divideScalar(verts.length);
      verts = ensureOutwardWinding(verts, centroid);
      const normal = verts[1].clone().sub(verts[0]).cross(verts[3].clone().sub(verts[0])).normalize();

      const geom = new THREE.BufferGeometry();
      const posAttr = new Float32Array([
        ...verts[0].toArray(), ...verts[1].toArray(), ...verts[2].toArray(),
        ...verts[0].toArray(), ...verts[2].toArray(), ...verts[3].toArray(),
      ]);
      geom.setAttribute('position', new THREE.BufferAttribute(posAttr, 3));
      geom.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({
        color: SKELETON_COLOR, transparent: true, opacity: FACE_STYLE.fillOpacityBase,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.faceKey = key;

      const lineGeom = new THREE.BufferGeometry().setFromPoints([...verts, verts[0]]);
      const isSpare = data.kind === 'spare';
      // Temporary duplicates (data.temporary -- DUPLICATE_HOME_FACE and
      // every other "fills a blank until real content exists" face,
      // see rhombic-wheel-3d-core.js) get the same dashed outline as a
      // true spare -- signals "this is filler, not permanent" -- but
      // stay at FULL opacity/brightness and fully clickable, unlike a
      // real spare, since they're genuinely functional right now.
      // Direct user request 2026-08-25.
      const isDashed = isSpare || !!data.temporary;
      const lineOpacity = isSpare ? FACE_STYLE.outlineOpacityBaseSpare : FACE_STYLE.outlineOpacityBase;
      const lineMat = new THREE.LineBasicMaterial({ color: SKELETON_COLOR, transparent: true, opacity: lineOpacity });
      const line = isDashed
        ? new THREE.Line(lineGeom, new THREE.LineDashedMaterial({
            color: SKELETON_COLOR, transparent: true, opacity: lineOpacity,
            dashSize: 0.15, gapSize: 0.1,
          }))
        : new THREE.Line(lineGeom, lineMat);
      if (isDashed) line.computeLineDistances();

      group.add(mesh, line);

      const labelEl = document.createElement('div');
      labelEl.className = 'rw3d-label' + (isSpare ? ' spare' : '');
      labelEl.dataset.faceKey = key;
      // Icon System (RHOMBIVERSE_SPEC_ICON_SYSTEM.md): only actions
      // ACTION_TO_MARK actually resolves get a real icon + reveal-on-
      // touch word; everything else keeps the plain text label exactly
      // as before -- see that map's own header for why (spec leaves
      // several real actions genuinely unresolved; not guessing here).
      const markKey = ACTION_TO_MARK[data.action];
      if (markKey && MARKS[markKey]) {
        labelEl.classList.add('has-icon');
        const iconEl = document.createElement('span');
        iconEl.className = 'rw3d-label-icon';
        iconEl.innerHTML = iconFrame(MARKS[markKey], { title: data.label });
        const textEl = document.createElement('span');
        textEl.className = 'rw3d-label-text';
        textEl.textContent = data.label;
        labelEl.append(iconEl, textEl);
      } else {
        labelEl.textContent = data.label;
      }
      // The label itself is a real, independent click target -- not
      // just a visual annotation over the mesh -- since the mesh's
      // true footprint doesn't reliably extend out to where the label
      // is drawn. startDrag() lets a drag that begins on a label still
      // orbit the wheel; the click handler mirrors the canvas's own
      // drag-suppression check and hit-kind guard.
      let revealTimer = null;
      labelEl.addEventListener('pointerdown', (ev) => {
        startDrag(ev.clientX, ev.clientY);
        // Reveal-on-touch (spec section 3): no hover equivalent on
        // touch, so a hold threshold stands in for it -- mirrors
        // core/build.js's own HOLD_MS pattern for the same reason. A
        // normal quick tap still activates immediately via the existing
        // click handler below, unaffected by this timer.
        if (ev.pointerType === 'touch') {
          clearTimeout(revealTimer);
          revealTimer = setTimeout(() => labelEl.classList.add('reveal'), REVEAL_HOLD_MS);
        }
      });
      labelEl.addEventListener('pointerup', () => { clearTimeout(revealTimer); labelEl.classList.remove('reveal'); });
      labelEl.addEventListener('pointercancel', () => { clearTimeout(revealTimer); labelEl.classList.remove('reveal'); });
      // Desktop hover -- pointerenter/leave also fire for touch in most
      // browsers, but only after pointerdown, so this never fights with
      // the hold-timer above; touch's own reveal is handled there.
      labelEl.addEventListener('pointerenter', (ev) => { if (ev.pointerType !== 'touch') labelEl.classList.add('reveal'); });
      labelEl.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'touch') labelEl.classList.remove('reveal'); });
      labelEl.addEventListener('click', () => {
        if (dragDistance > DRAG_CLICK_SUPPRESS_PX) return;
        selectFace(key);
      });
      labelsLayer.appendChild(labelEl);

      faceEntries.push({ key, data, verts, centroid, normal, mesh, line, labelEl, isSpare });
    }
    panel.classList.remove('open');
    selected = null;
    hovered = null;
  }

  function resize() {
    const w = overlay.clientWidth || window.innerWidth;
    const h = overlay.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function resetIdleTimer() {
    autoRotating = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!selected) autoRotating = true;
    }, 3000);
  }

  function screenPosFor(vec3) {
    const p = vec3.clone().project(camera);
    const w = overlay.clientWidth || window.innerWidth;
    const h = overlay.clientHeight || window.innerHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, behind: p.z > 1 };
  }

  function updateLabelsAndFaceVisuals() {
    const camToOrigin = new THREE.Vector3(0, 0, 0).sub(camera.position).normalize();
    for (const e of faceEntries) {
      const worldNormal = e.normal.clone().applyQuaternion(group.quaternion);
      const viewDirToCamera = camera.position.clone().sub(
        e.centroid.clone().applyQuaternion(group.quaternion)
      ).normalize();
      const { facing, angleFade } = computeLabelVisibility(worldNormal, viewDirToCamera);
      const isHover = hovered === e.key;
      const isSelect = selected === e.key;
      const boost = isSelect ? 1 : isHover ? 0.85 : 0;
      let target = facing < -0.3 ? 0 : Math.max(angleFade, boost);
      const prev = e._labelOpacity ?? 0;
      e._labelOpacity = prev + (target - prev) * 0.25;
      e.labelEl.style.opacity = String(e._labelOpacity);
      // Only a label a player can actually read should be able to
      // intercept a click -- a near-invisible label for a face currently
      // facing away is still positioned somewhere on screen and would
      // otherwise silently steal clicks meant for whatever's really
      // visible there. Spares are handled separately via the CSS rule.
      e.labelEl.style.pointerEvents = (!e.isSpare && e._labelOpacity > 0.2) ? 'auto' : 'none';

      // The label's screen position is the average of its face's own 4
      // vertices, each projected to screen space individually -- the
      // real visual center of the rendered quad, at any viewing angle.
      // Not the old approach (a 3D centroid + a fixed push along the face
      // normal, retuned three times same-day -- 0.35, 0.24, 0.14 -- and
      // still wrong): pushing along a 3D normal moves the point off the
      // face's own plane, and for a face viewed at an oblique angle that
      // normal is nearly parallel to the screen, so even a small 3D push
      // causes a large apparent 2D shift -- confirmed live at a 5-visible-
      // face rotation (several faces half in/half out of their rhombus)
      // AND, per direct follow-up, even the plain 3-/4-face views were
      // never quite centered either, since ANY nonzero push drifts away
      // from center as soon as the face isn't perfectly square-on.
      // Averaging the 4 already-projected vertices has no such failure
      // mode -- it's computed directly from the actual rendered shape,
      // not a 3D heuristic that assumes a symmetric, face-on view.
      const screenVerts = e.verts.map((v) => screenPosFor(v.clone().applyQuaternion(group.quaternion)));
      const avgX = screenVerts.reduce((sum, p) => sum + p.x, 0) / screenVerts.length;
      const avgY = screenVerts.reduce((sum, p) => sum + p.y, 0) / screenVerts.length;
      e.labelEl.style.left = `${avgX}px`;
      e.labelEl.style.top = `${avgY}px`;
      e.labelEl.style.fontSize = isSelect ? LABEL_STYLE.fontSizeSelected : LABEL_STYLE.fontSizeBase;

      // Real bug found live (2026-08-28): every face rendered at the
      // exact same flat brightness regardless of viewing angle --
      // MeshBasicMaterial ignores lighting entirely, and this scene only
      // has an AmbientLight anyway (no directional light to create real
      // per-face contrast even for a lit material). The whole wheel read
      // as a flat 2D hexagon as a result, independent of rotation angle
      // (confirmed: DEFAULT_OPEN_ROTATION already has real tilt on all
      // three axes -- the flatness wasn't the angle, it was the shading).
      // Fixed with a real depth cue, cheaply: reuse the SAME `facing`
      // value already computed above for label visibility to shade each
      // face -- more toward the camera reads brighter, a grazing angle
      // reads dimmer, the same visual effect real directional lighting
      // would produce, without touching the established translucent
      // material or adding lights that could clash with it.
      // Additive, not multiplicative: fillOpacityBase (0.05) is already
      // so low that even a 0-1 multiplier barely moves it -- confirmed
      // live, a first attempt at this fix was imperceptible on screen.
      // An additive boost creates real, visible contrast between a
      // camera-facing fill and a grazing one regardless of how low the
      // starting base is.
      const shade = Math.max(0, facing);
      const fillTarget = FACE_STYLE.fillOpacityBase
        + (isHover ? FACE_STYLE.fillOpacityHoverBump : 0)
        + (isSelect ? FACE_STYLE.fillOpacitySelectBump : 0)
        + shade * 0.22;
      e.mesh.material.opacity = fillTarget;
      const outlineBase = e.isSpare ? FACE_STYLE.outlineOpacityBaseSpare : FACE_STYLE.outlineOpacityBase;
      e.line.material.opacity = outlineBase + ((isHover || isSelect) ? FACE_STYLE.outlineOpacityBump : 0) + shade * 0.2;
      const pop = isSelect ? FACE_STYLE.popOutSelect : isHover ? FACE_STYLE.popOutHover : 0;
      const popVec = e.normal.clone().multiplyScalar(pop);
      e.mesh.position.copy(popVec);
      e.line.position.copy(popVec);
    }
  }

  function pickFace(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(faceEntries.map((e) => e.mesh));
    return hits.length ? hits[0].object.userData.faceKey : null;
  }

  function switchWheel(wheelId) {
    // Real report, 2026-08-29: navigating into a department (e.g. Build
    // -> Piece) used to preserve whatever rotation was active the
    // instant its trigger face was clicked -- reproduced directly: that
    // face is often only just barely front-facing (opacity a hair above
    // the visibility threshold, since a drag stops the moment it becomes
    // clickable at all), so the SAME raw rotation applied to the new
    // wheel's own different face geometry regularly lands on a near
    // edge-on view where nothing is clearly visible, requiring an extra
    // drag just to see the department you already chose. Reset to the
    // exact same DEFAULT_OPEN_ROTATION every fresh wheel-open already
    // uses (real, already-verified: 3 real faces land clearly visible)
    // so every navigateTo: transition lands you looking straight at the
    // new department's own primary content, not wherever the click
    // happened to leave the wheel facing.
    group.rotation.set(DEFAULT_OPEN_ROTATION.x, DEFAULT_OPEN_ROTATION.y, DEFAULT_OPEN_ROTATION.z);
    buildWheel(wheelId);
  }

  function dispatchAction(action) {
    if (!action) return;
    if (action.startsWith('navigateTo:')) {
      const target = action.slice('navigateTo:'.length);
      if (ALL_WHEELS[target]) { switchWheel(target); return; }
    } else if (action === 'navigateHome') {
      switchWheel('home');
      return;
    }
    onAction?.(action);
  }

  // Browsers fire a native 'click' after any mousedown->mouseup pair on
  // the same element, even with real movement in between -- so orbiting
  // the wheel by drag was also spuriously selecting whatever face ended
  // up under the cursor on release. Track total movement since
  // pointerdown and suppress the click handler's selection if it
  // crossed a small threshold (a real drag, not a tap/click).
  let dragDistance = 0;
  const DRAG_CLICK_SUPPRESS_PX = 5;

  // Shared with each label's own pointerdown listener below -- a drag
  // that starts directly on top of a label (a large, natural place to
  // press down, now that labels are real click targets) must still
  // orbit the wheel, not just the canvas.
  function startDrag(clientX, clientY) {
    dragging = true;
    dragDistance = 0;
    lastPointer = { x: clientX, y: clientY };
    resetIdleTimer();
  }
  renderer.domElement.addEventListener('pointerdown', (ev) => startDrag(ev.clientX, ev.clientY));
  window.addEventListener('pointermove', (ev) => {
    if (!overlay.classList.contains('open')) return;
    if (dragging && lastPointer) {
      const dx = ev.clientX - lastPointer.x;
      const dy = ev.clientY - lastPointer.y;
      dragDistance += Math.hypot(dx, dy);
      lastPointer = { x: ev.clientX, y: ev.clientY };
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.008);
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.008);
      group.quaternion.premultiply(qx).premultiply(qy);
      resetIdleTimer();
    } else {
      const key = pickFace(ev.clientX, ev.clientY);
      if (key !== hovered) {
        hovered = key;
        renderer.domElement.style.cursor = key ? 'pointer' : 'default';
      }
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; });

  // Shared by both hit-test paths below (mesh raycast and label click) --
  // a real player naturally aims at the readable label text, not the
  // invisible-ish glass face underneath it, and the label is
  // deliberately rendered offset outward from the mesh along its
  // normal (for legibility) -- at some viewing angles that offset
  // point sits entirely off the mesh polygon, so a raycast-only hit
  // test silently drops clicks a player would reasonably expect to
  // land. Confirmed via real browser testing, not a guess: identical
  // clicks at a label's exact screen position sometimes never reached
  // any mesh, with the raycaster correctly reporting no hit -- because
  // there was genuinely nothing there to hit.
  function selectFace(key) {
    const entry = faceEntries.find((e) => e.key === key);
    if (!entry || entry.data.kind === 'spare') return;
    selected = key;
    panel.innerHTML = `<h3>${entry.data.label}</h3><p>${entry.data.desc || ''}</p>`;
    panel.classList.add('open');
    dispatchAction(entry.data.action);
    resetIdleTimer();
  }

  renderer.domElement.addEventListener('click', (ev) => {
    if (dragDistance > DRAG_CLICK_SUPPRESS_PX) return;
    const key = pickFace(ev.clientX, ev.clientY);
    if (key) selectFace(key);
  });
  closeBtn.addEventListener('click', () => close());
  window.addEventListener('resize', () => { if (overlay.classList.contains('open')) resize(); });

  let rafId = null;
  function tick() {
    if (autoRotating) group.rotation.y += 0.0025;
    updateLabelsAndFaceVisuals();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  // Looks straight down one of the RD's 8 three-valent vertices
  // ((1,1,1), specifically) -- the exact viewing angle where 3 real
  // faces meet at a shared vertex and their silhouette together forms
  // a hexagon outline, per direct user request 2026-08-25 ("the three
  // faces should form a triangle in the hexagon outline as you first
  // see it"). Computed exactly (axis-angle from vertex direction to
  // the camera's +Z, converted to Euler XYZ), not eyeballed -- see
  // rhombic-wheel-shared-renderer session notes. The equator ring has
  // no shared 3-valent vertex among its OWN 4 faces (each of its two
  // 3-valent vertices is shared with a top or bottom face instead, not
  // another equator face), so this specific vertex mixes 2 universal-
  // ring faces (Lenses, Lab) with 1 equator dept face rather than 3
  // pure department faces -- a real structural constraint, not a
  // missed target; still a genuinely elegant, well-composed opening
  // view. switchWheel() now resets to this same rotation on every
  // navigateTo: transition too (changed 2026-08-29, direct report -- see
  // switchWheel's own comment for why the earlier "leave your rotation
  // alone while navigating" choice regularly landed on a near-invisible
  // edge-on view of the department you'd just chosen).
  // Real bug found live (2026-08-28): at the exact original angle
  // (y: -0.6154797086703874), several edges converge on the shared
  // central vertex with near-perfect radial symmetry in the 2D
  // projection -- the classic "cube corner reads as a flat hexagon"
  // ambiguous-figure illusion (confirmed: auto-rotation immediately
  // resolves it, so the geometry itself was never actually flat, only
  // this one exact static alignment read that way). Nudged y away from
  // that exact value so the resting pose is never shown at the
  // perfectly-symmetric angle, without changing which faces are
  // prominent (still the same three departments, just no longer
  // dead-on).
  const DEFAULT_OPEN_ROTATION = { x: Math.PI / 4, y: -0.6154797086703874 + 0.16, z: Math.PI / 12 };
  function open(wheelId = 'home') {
    overlay.classList.add('open');
    group.rotation.set(DEFAULT_OPEN_ROTATION.x, DEFAULT_OPEN_ROTATION.y, DEFAULT_OPEN_ROTATION.z);
    resize();
    buildWheel(wheelId);
    resetIdleTimer();
    if (!rafId) tick();
  }

  function close() {
    overlay.classList.remove('open');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    clearTimeout(idleTimer);
  }

  return {
    open, close,
    get currentWheelId() { return currentWheelId; },
    // Lets the caller skip its own (otherwise fully-hidden) render pass
    // while this wheel's own overlay/renderer covers the whole screen --
    // see render.js's animate().
    get isOpen() { return overlay.classList.contains('open'); },
    // Model vs. World Separation (reframe Stage 2): re-resolves the
    // currently-displayed wheel's faces against the live workspaceMode.
    // buildWheel() only runs on navigation (switchWheel), so a mode flip
    // while sitting on an already-open wheel needs this explicit nudge
    // to be reflected immediately rather than on the next navigation.
    refresh() { if (currentWheelId) buildWheel(currentWheelId); },
  };
}
