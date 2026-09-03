// Rhombis engine (docs/RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md):
// generic across stages -- scene/camera/input/render loop and the
// tap-piece/tap-void/flip-piece interaction model live here once;
// what's actually IN the scene per stage is stages.js. Advancing
// stages just reruns loadStage() with the next STAGES entry, no
// special-casing. Scene/camera/lighting numbers match src/render.js's
// own conventions (same dark background, same Ambient+Directional
// light pair) purely for visual consistency with the parent app --
// Rhombis itself has no dependency on render.js.
//
// Touch/mobile (direct instruction 2026-09-03, built in from Stage 3
// onward rather than retrofitted later): tap-vs-drag detection tracks
// real Pointer Event ids so a second finger joining mid-gesture cancels
// tap-candidacy instead of misfiring as a tap on release; camera
// framing compensates distance for narrow/portrait aspect ratios so a
// phone in portrait still fits both skeleton and tray; devicePixelRatio
// is capped for fill-rate cost on high-DPI phones. rhombis.html carries
// the matching viewport/touch-action/safe-area CSS.
//
// Rotation is applied to the SKELETON GROUP directly (drag-to-spin the
// goal piece itself), not an orbiting camera -- the camera is static
// once framed. Found via real testing, not a style choice: with
// OrbitControls (camera orbits a fixed world origin) the tray -- a
// separate object at its own fixed world position, same origin -- swings
// around right along with the skeleton as the camera moves, so after
// rotating to reach a cube's hidden faces the tray piece visually
// drifted onto/behind the skeleton instead of staying put. Rotating the
// skeleton's own Group instead leaves the camera, and everything else
// in world space (the tray), completely undisturbed. A piece that gets
// PLACED is reparented from the tray (a `scene` child, fixed) into
// `skeletonGroup` itself (`Object3D.attach()`, which preserves its
// current world transform across the reparent) so it then spins
// together with the rest of the assembled shape, exactly as a real
// placed piece should.
import * as THREE from 'three';
import { outwardQuaternion } from './geometry.js';
import { STAGES, WIRE_COLOR } from './stages.js';
import { createPuzzleState, selectPiece, flipPiece, placeSelected, isSolved, voidValidityForPiece } from './puzzle-state.js';

const SCALE = 2;
const SELECTED_EMISSIVE = 0x664422;
const REJECT_FLASH_COLOR = 0xff5050;
const FILLED_WIRE_COLOR = 0x9be3ff;
// Direct instruction (2026-09-03): while a piece is selected, every
// unfilled void's own wire shows red or green for whether THAT piece,
// at its current orientation, would actually fit there right now (not
// just a flash after a failed tap) -- reusing REJECT_FLASH_COLOR for
// "invalid" so red means the same thing everywhere in this UI.
const VALID_TARGET_COLOR = 0x6dff9e;
const INVALID_TARGET_COLOR = REJECT_FLASH_COLOR;
const STAGE_ADVANCE_DELAY_MS = 1400;
const ROTATION_DAMPING = 0.25;
const ORIENTATION_LABELS = { 'y+': 'apex up', 'y-': 'apex down' };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(3, 5, 4);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
const CAMERA_DIRECTION = new THREE.Vector3(2.5, 2, 5).normalize();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

camera.lookAt(0, 0, 0);

// Camera distance is DERIVED, not hand-tuned per stage: measure how far
// the farthest point of the scene (skeleton + tray, at their initial
// layout) sits from the origin, then back-solve the distance that puts
// that point exactly at the tighter of the horizontal/vertical FOV
// edges (with a margin). This is what actually fixed the real bug an
// empirical "distance * fudge-factor for narrow aspect" approach kept
// getting wrong: on an iPhone-width portrait viewport the tray (offset
// to the side of the skeleton) was running off the right edge of the
// screen because the fudge factor was tuned by eye against a desktop
// window, not derived from real geometry. Correct for any aspect ratio
// or stage layout without per-stage magic numbers.
const FRAME_MARGIN = 1.12;

function boundingRadiusFromOrigin(objects) {
  const box = new THREE.Box3();
  for (const obj of objects) box.expandByObject(obj);
  const corners = [
    [box.min.x, box.min.y, box.min.z], [box.min.x, box.min.y, box.max.z],
    [box.min.x, box.max.y, box.min.z], [box.min.x, box.max.y, box.max.z],
    [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
    [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z],
  ];
  let maxDistSq = 0;
  for (const [x, y, z] of corners) maxDistSq = Math.max(maxDistSq, x * x + y * y + z * z);
  return Math.sqrt(maxDistSq);
}

function applyCameraFraming() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  if (!current) return;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const limitingHalfFov = Math.min(vFov, hFov) / 2;
  const distance = (current.boundingRadius / Math.sin(limitingHalfFov)) * FRAME_MARGIN;
  camera.position.copy(CAMERA_DIRECTION).multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
}

function handleViewportChange() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyCameraFraming();
}

window.addEventListener('resize', handleViewportChange);
window.addEventListener('orientationchange', () => {
  handleViewportChange();
  // iOS can report stale innerWidth/innerHeight for a moment right
  // after orientationchange fires -- one delayed re-check covers it.
  setTimeout(handleViewportChange, 150);
});

const hud = document.getElementById('rhombis-hud');
const solvedBanner = document.getElementById('rhombis-solved');
const stageLabel = document.getElementById('rhombis-stage');

let stageIndex = 0;
let current = null; // { skeletonGroup, pieces, voids, state, boundingRadius }

function clearCurrentStage() {
  if (!current) return;
  scene.remove(current.skeletonGroup);
  current.pieces.forEach((p) => scene.remove(p.mesh));
}

function loadStage(index) {
  clearCurrentStage();
  const stageDef = STAGES[index];
  const built = stageDef.build(SCALE);

  scene.add(built.skeletonGroup);
  built.pieces.forEach((p) => scene.add(p.mesh));

  const state = createPuzzleState({
    pieces: built.pieces.map((p) => ({ id: p.id, orientation: p.orientation, orientationOptions: p.orientationOptions })),
    voids: built.voids.map((v) => ({ id: v.id, requiredOrientation: v.requiredOrientation })),
  });

  const boundingRadius = boundingRadiusFromOrigin([built.skeletonGroup, ...built.pieces.map((p) => p.mesh)]);
  current = { ...built, state, boundingRadius };
  applyCameraFraming();
  solvedBanner.hidden = true;
  stageLabel.textContent = `Stage ${stageDef.id}: ${stageDef.name}`;
  updateHud();
}

function pieceById(id) {
  return current.pieces.find((p) => p.id === id);
}

function currentStatePiece(id) {
  return current.state.pieces.find((p) => p.id === id);
}

function remainingCount() {
  return current.state.pieces.filter((p) => !p.placed).length;
}

function revealNextTrayPiece() {
  const next = current.pieces.find((p) => !currentStatePiece(p.id).placed);
  if (!next) return;
  next.mesh.visible = true;
  next.mesh.position.copy(next.homePosition);
}

function updateHud() {
  const selectedId = current.state.selectedPieceId;
  const flippable = current.pieces.some((p) => p.orientationOptions);
  const multiplePieces = current.pieces.length > 1 && !flippable;
  const remaining = remainingCount();

  if (!selectedId) {
    if (flippable) {
      hud.textContent = 'Tap a piece, then tap its void (tap the same piece again to flip it)';
    } else if (multiplePieces) {
      hud.textContent = `Tap the piece, then tap a void to place it (${remaining} left)`;
    } else {
      hud.textContent = 'Tap the piece, then tap the skeleton to place it';
    }
    return;
  }

  const orientation = currentStatePiece(selectedId).orientation;
  if (orientation) {
    const label = ORIENTATION_LABELS[orientation] ?? orientation;
    hud.textContent = `Piece selected (${label}) -- tap it again to flip, or tap a void to place`;
  } else if (multiplePieces) {
    hud.textContent = `Piece selected (${remaining} left) -- tap a void to place it`;
  } else {
    hud.textContent = 'Piece selected -- tap the skeleton to place it';
  }
}

function setPieceSelectedVisual(piece, isSelected) {
  if (piece.mesh.material.emissive) {
    piece.mesh.material.emissive.setHex(isSelected ? SELECTED_EMISSIVE : 0x000000);
  }
}

function flashRejectWire(wire) {
  const original = wire.material.color.getHex();
  wire.material.color.setHex(REJECT_FLASH_COLOR);
  setTimeout(() => wire.material.color.setHex(original), 180);
}

// Recolors every unfilled void's wire: green if the currently selected
// piece (at its current orientation) would fit there right now, red if
// not, or back to the plain default when nothing is selected. Filled
// voids are left alone (they already show FILLED_WIRE_COLOR). Call this
// any time selection, orientation, or fill state changes.
function refreshVoidHighlights() {
  const selectedId = current.state.selectedPieceId;
  const validity = selectedId ? voidValidityForPiece(current.state, selectedId) : null;
  for (const v of current.voids) {
    const stateVoid = current.state.voids.find((sv) => sv.id === v.id);
    if (stateVoid.filled) continue;
    const color = validity ? (validity[v.id] ? VALID_TARGET_COLOR : INVALID_TARGET_COLOR) : WIRE_COLOR;
    v.wire.material.color.setHex(color);
  }
}

function advanceOrFinish() {
  const next = STAGES[stageIndex + 1];
  hud.textContent = 'Solved!';
  solvedBanner.hidden = false;
  solvedBanner.textContent = next ? 'Solved!' : 'Solved! More stages coming soon.';
  if (next) {
    setTimeout(() => {
      stageIndex += 1;
      loadStage(stageIndex);
    }, STAGE_ADVANCE_DELAY_MS);
  }
}

// --- Tap vs. drag-to-rotate: a SINGLE pointer that moves past the
// threshold spins the skeleton (updated live on every move, not just at
// the end); one that comes back up without moving far is a tap instead.
// A second pointer joining mid-gesture cancels both -- no pinch/rotate
// gesture is defined for two fingers (yet; Stage 7's own "touch
// refinements" is where the spec places pinch-to-rotate), so it's
// simply ignored rather than fighting a one-finger drag already in
// progress.
const activePointers = new Set();
let tapCandidateId = null;
let pointerDownPos = null;
let dragLast = null;
const TAP_MOVE_THRESHOLD = 10;
const ROTATE_SPEED = 0.012;
const MAX_PITCH = Math.PI / 2 - 0.02;

function cancelTapCandidate() {
  tapCandidateId = null;
  pointerDownPos = null;
  dragLast = null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  if (activePointers.size === 1) {
    tapCandidateId = e.pointerId;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    dragLast = { x: e.clientX, y: e.clientY };
  } else {
    cancelTapCandidate();
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== tapCandidateId || !dragLast || !current) return;
  const dx = e.clientX - dragLast.x;
  const dy = e.clientY - dragLast.y;
  dragLast = { x: e.clientX, y: e.clientY };
  const rot = current.skeletonGroup.rotation;
  rot.y += dx * ROTATE_SPEED;
  rot.x = THREE.MathUtils.clamp(rot.x + dy * ROTATE_SPEED, -MAX_PITCH, MAX_PITCH);
});

renderer.domElement.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  if (e.pointerId !== tapCandidateId || !pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  const moved = Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD;
  cancelTapCandidate();
  if (moved) return; // was a drag/rotate
  handleTap(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('pointercancel', (e) => {
  activePointers.delete(e.pointerId);
  if (e.pointerId === tapCandidateId) cancelTapCandidate();
});

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function handleTap(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const pieceTargets = current.pieces
    .filter((p) => !currentStatePiece(p.id).placed)
    .map((p) => p.mesh);
  const voidTargets = current.voids.map((v) => v.hitTarget);
  const hits = raycaster.intersectObjects([...pieceTargets, ...voidTargets], false);
  if (hits.length === 0) return;
  const hitObj = hits[0].object;

  const hitPiece = current.pieces.find((p) => p.mesh === hitObj);
  if (hitPiece) {
    if (current.state.selectedPieceId === hitPiece.id) {
      // A piece with no orientationOptions (Stage 1's/Stage 3's pieces)
      // has nothing to flip -- flipPiece() is already a no-op for it,
      // but skip the rotation-target update too rather than calling
      // outwardQuaternion(undefined) for a piece with no orientation.
      if (hitPiece.orientationOptions) {
        current.state = flipPiece(current.state, hitPiece.id);
        hitPiece.orientation = currentStatePiece(hitPiece.id).orientation;
        hitPiece.mesh.userData.targetQuaternion = outwardQuaternion(hitPiece.orientation);
      }
    } else {
      current.state = selectPiece(current.state, hitPiece.id);
      current.pieces.forEach((p) => setPieceSelectedVisual(p, p.id === current.state.selectedPieceId));
    }
    refreshVoidHighlights();
    updateHud();
    return;
  }

  const hitVoid = current.voids.find((v) => v.hitTarget === hitObj);
  if (!hitVoid) return;

  const result = placeSelected(current.state, hitVoid.id);
  current.state = result.state;
  if (!result.placed) {
    flashRejectWire(hitVoid.wire);
    return;
  }

  const placedPiece = pieceById(result.pieceId);
  // Reparent tray -> skeleton (Object3D.add() detaches from its current
  // parent automatically) so this piece rotates together with the rest
  // of the assembled shape from now on, instead of staying pinned to
  // the tray's fixed position in world space.
  current.skeletonGroup.add(placedPiece.mesh);
  placedPiece.mesh.position.copy(hitVoid.position);
  placedPiece.mesh.quaternion.copy(hitVoid.quaternion);
  placedPiece.mesh.userData.targetQuaternion = hitVoid.quaternion;
  setPieceSelectedVisual(placedPiece, false);
  hitVoid.wire.material.color.setHex(FILLED_WIRE_COLOR);
  revealNextTrayPiece();
  refreshVoidHighlights();
  updateHud();

  if (isSolved(current.state)) advanceOrFinish();
}

function animate() {
  requestAnimationFrame(animate);
  if (current) {
    for (const p of current.pieces) {
      const target = p.mesh.userData.targetQuaternion;
      if (target) p.mesh.quaternion.slerp(target, ROTATION_DAMPING);
    }
  }
  renderer.render(scene, camera);
}

loadStage(stageIndex);
animate();
