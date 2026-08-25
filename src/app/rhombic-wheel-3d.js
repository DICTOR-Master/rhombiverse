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
  resolveWheelFaces, ALL_WHEELS,
} from './rhombic-wheel-3d-core.js';

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
    const resolved = resolveWheelFaces(wheelConfig);
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
      labelEl.textContent = data.label;
      // The label itself is a real, independent click target -- not
      // just a visual annotation over the mesh -- since the mesh's
      // true footprint doesn't reliably extend out to where the label
      // is drawn. startDrag() lets a drag that begins on a label still
      // orbit the wheel; the click handler mirrors the canvas's own
      // drag-suppression check and hit-kind guard.
      labelEl.addEventListener('pointerdown', (ev) => startDrag(ev.clientX, ev.clientY));
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

      const worldCentroid = e.centroid.clone().applyQuaternion(group.quaternion)
        .add(worldNormal.clone().multiplyScalar(0.35));
      const pos = screenPosFor(worldCentroid);
      e.labelEl.style.left = `${pos.x}px`;
      e.labelEl.style.top = `${pos.y}px`;
      e.labelEl.style.fontSize = isSelect ? LABEL_STYLE.fontSizeSelected : LABEL_STYLE.fontSizeBase;

      const fillTarget = FACE_STYLE.fillOpacityBase
        + (isHover ? FACE_STYLE.fillOpacityHoverBump : 0)
        + (isSelect ? FACE_STYLE.fillOpacitySelectBump : 0);
      e.mesh.material.opacity = fillTarget;
      const outlineBase = e.isSpare ? FACE_STYLE.outlineOpacityBaseSpare : FACE_STYLE.outlineOpacityBase;
      e.line.material.opacity = outlineBase + ((isHover || isSelect) ? FACE_STYLE.outlineOpacityBump : 0);
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
    // Preserve camera/rotation state -- rebuild faces in place, don't
    // touch group.quaternion or camera.
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
  // view. switchWheel() deliberately does NOT reset this -- once
  // you're actively navigating, your own rotation stays.
  const DEFAULT_OPEN_ROTATION = { x: Math.PI / 4, y: -0.6154797086703874, z: Math.PI / 12 };
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
  };
}
