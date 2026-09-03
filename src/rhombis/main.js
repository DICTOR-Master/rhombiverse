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
import { quaternionForOrientationKey } from './geometry.js';
import { STAGES, WIRE_COLOR, GHOST_OPACITY } from './stages.js';
import { createPuzzleState, selectPiece, flipPiece, placeSelected, isSolved, voidValidityForPiece } from './puzzle-state.js';

const SCALE = 2;
const SELECTED_EMISSIVE = 0x664422;
const REJECT_FLASH_COLOR = 0xff5050;
// Direct instruction (2026-09-03): while a piece is selected, every
// unfilled void's own wire shows red or green for whether THAT piece,
// at its current orientation, would actually fit there right now (not
// just a flash after a failed tap) -- reusing REJECT_FLASH_COLOR for
// "invalid" so red means the same thing everywhere in this UI.
const VALID_TARGET_COLOR = 0x6dff9e;
const INVALID_TARGET_COLOR = REJECT_FLASH_COLOR;
// Found live (2026-09-03): with every open void's ghost at the same
// opacity, a stage with many simultaneously-invalid voids (Stage 4's 12,
// only 1 ever valid at once under manual orientation) stacks 11 red
// translucent wedges on top of each other and reads as one solid red
// blob -- the single green one gets visually lost in it, defeating the
// whole point of the highlight. Invalid ghosts stay faint (a hint nudge,
// not real information -- there's only ever one correct answer); the
// valid one renders near-opaque so it visually pops out on its own.
const VALID_GHOST_OPACITY = 0.85;
const INVALID_GHOST_OPACITY = 0.12;
const STAGE_ADVANCE_DELAY_MS = 1400;
const ROTATION_DAMPING = 0.25;
// Friendlier labels for the small, named set of orientations that have
// one; anything else (Stage 4's 12-way 'axisKey:in'/'axisKey:out') gets
// a generic fallback from orientationLabel() below instead of an entry
// here -- see that function's own comment.
const ORIENTATION_LABELS = { 'y+': 'apex up', 'y-': 'apex down' };

function orientationLabel(key) {
  if (ORIENTATION_LABELS[key]) return ORIENTATION_LABELS[key];
  if (key.includes(':')) {
    const [axisKey, direction] = key.split(':');
    return `${axisKey} face, ${direction === 'in' ? 'inward' : 'outward'}`;
  }
  return key;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(3, 5, 4);
scene.add(sun);

// Starry sky background -- direct instruction (2026-09-04, "a starry
// sky background"). A real THREE.Points cloud, not a texture/CSS
// trick, on a fixed sphere far enough out to read as "at infinity" --
// comfortably inside the camera's own far clip plane (100 below) but
// well beyond any stage's own bounding radius (a handful of units even
// at the biggest stages), so pinch/wheel-zooming the puzzle never
// visibly moves the stars, exactly like a real distant sky wouldn't.
// Two layers, not one, for a genuine size/brightness variety rather
// than a uniform dot grid -- `sizeAttenuation: false` keeps each
// star's own screen size constant regardless of distance/zoom, the
// correct look for something meant to be read as infinitely far.
function buildStarfield(count, radiusRange, size, opacity) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Real uniform sampling on a sphere (not a naive per-axis random,
    // which clusters points near the corners of the bounding cube).
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0]);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}
scene.add(buildStarfield(900, [70, 85], 1.1, 0.55));
scene.add(buildStarfield(120, [70, 85], 2.2, 0.9));

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

// Pinch-to-zoom/wheel-zoom multiply the DERIVED distance rather than
// replacing it -- direct instruction (2026-09-04, "need pinch and
// expand gestures to make puzzle bigger"), fulfilling a gap this
// file's own pointer-handling comment already flagged ("no pinch
// gesture is defined for two fingers yet"). Keeping the derivation
// (real bounding-radius math, not a hand-tuned distance) as the base
// and treating zoom as a multiplier on top preserves the "always
// frames correctly regardless of aspect ratio or stage size" property
// that fixed a real narrow-viewport bug earlier -- zoom is a per-
// session interactive adjustment layered over a still-correct default,
// not a replacement for it. Reset to 1 on every stage load (a stage
// with a very different bounding radius shouldn't inherit an
// unrelated previous zoom level).
let zoomFactor = 1;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

function applyCameraFraming() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  if (!current) return;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const limitingHalfFov = Math.min(vFov, hFov) / 2;
  const distance = (current.boundingRadius / Math.sin(limitingHalfFov)) * FRAME_MARGIN * zoomFactor;
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
const undoButton = document.getElementById('rhombis-undo');
const stagePicker = document.getElementById('rhombis-stage-picker');
const stagePickerToggle = document.getElementById('rhombis-stage-picker-toggle');
const stagePickerClose = document.getElementById('rhombis-stage-picker-close');
const stageList = document.getElementById('rhombis-stage-list');

// Dev/testing convenience only, never surfaced in the UI: ?stage=4
// jumps straight to that stage's own id (STAGES' own `id` field, not
// the array index) on load, so trying out a specific stage -- e.g.
// comparing Stage 4's manual-orientation prototype against Stage 3 --
// doesn't need editing source and remembering to revert it. Silently
// falls back to Stage 1 for a missing/invalid value.
const requestedStageId = Number(new URLSearchParams(window.location.search).get('stage'));
const requestedStageIndex = STAGES.findIndex((s) => s.id === requestedStageId);
let stageIndex = requestedStageIndex >= 0 ? requestedStageIndex : 0;
let current = null; // { skeletonGroup, pieces, voids, state, boundingRadius, history, advanceTimer }

function clearCurrentStage() {
  if (!current) return;
  if (current.advanceTimer) clearTimeout(current.advanceTimer);
  scene.remove(current.skeletonGroup);
  current.pieces.forEach((p) => scene.remove(p.mesh));
}

function loadStage(index) {
  clearCurrentStage();
  zoomFactor = 1; // a new stage's own derived framing, not a leftover zoom from whatever was open before
  const stageDef = STAGES[index];
  const built = stageDef.build(SCALE);

  scene.add(built.skeletonGroup);
  built.pieces.forEach((p) => scene.add(p.mesh));

  const state = createPuzzleState({
    pieces: built.pieces.map((p) => ({
      id: p.id,
      orientation: p.orientation,
      orientationOptions: p.orientationOptions,
      fillsGroup: p.fillsGroup,
    })),
    voids: built.voids.map((v) => ({ id: v.id, requiredOrientation: v.requiredOrientation, groupIds: v.groupIds })),
  });

  const boundingRadius = boundingRadiusFromOrigin([built.skeletonGroup, ...built.pieces.map((p) => p.mesh)]);
  current = { ...built, groups: built.groups ?? [], state, boundingRadius, history: [], advanceTimer: null };
  applyCameraFraming();
  solvedBanner.hidden = true;
  stageLabel.textContent = `Stage ${stageDef.id}: ${stageDef.name}`;
  refreshVoidHighlights(); // sets each void wire's correct idle visibility
  updateHud();
  updateUndoButton();
}

function updateUndoButton() {
  undoButton.disabled = !current || current.history.length === 0;
}

// Stage picker -- direct instruction (2026-09-04): a returning player
// shouldn't have to replay every earlier stage just to reach one they
// already know they want. A fixed jump-in link (the welcome screen's
// own tagline link, ?stage=8) covers exactly one destination; this
// covers all of them, live, without a page reload. Populated directly
// from STAGES, so a stage added later needs no picker-specific update.
function populateStagePicker() {
  stageList.innerHTML = '';
  STAGES.forEach((stageDef, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'rhombis-stage-option';
    option.dataset.stageIndex = String(index);
    option.innerHTML = `<span class="stage-num">${stageDef.id}</span><span>${stageDef.name}</span>`;
    option.addEventListener('click', () => {
      stageIndex = index;
      loadStage(stageIndex);
      closeStagePicker();
    });
    stageList.appendChild(option);
  });
}

function refreshStagePickerCurrent() {
  for (const option of stageList.children) {
    option.classList.toggle('current', Number(option.dataset.stageIndex) === stageIndex);
  }
}

function openStagePicker() {
  refreshStagePickerCurrent();
  stagePicker.hidden = false;
}

function closeStagePicker() {
  stagePicker.hidden = true;
}

populateStagePicker();
stagePickerToggle.addEventListener('click', openStagePicker);
stagePickerClose.addEventListener('click', closeStagePicker);
stagePicker.addEventListener('click', (e) => {
  if (e.target === stagePicker) closeStagePicker(); // backdrop tap
});

// Stage 7's undo: pops the last placement's pre-placement snapshot and
// re-derives every mesh's transform/parent/visibility from it, rather
// than trying to hand-write the inverse of each placement -- simpler
// and more robust than tracking exactly what a given placement changed,
// and cheap enough at Rhombis' piece counts to just redo it in full
// every time. Only placements go on the history stack (selecting or
// flipping a piece is already trivially reversible by tapping again),
// so this is genuinely "undo my last placement", not a full action log.
function syncVisualsToState() {
  for (const p of current.pieces) {
    const sp = currentStatePiece(p.id);
    if (sp.placed) {
      const target = p.fillsGroup
        ? current.groups.find((g) => g.id === p.fillsGroup)
        : current.voids.find((v) => current.state.voids.find((sv) => sv.id === v.id).filledBy === p.id);
      current.skeletonGroup.add(p.mesh);
      p.mesh.position.copy(target.position);
      p.mesh.quaternion.copy(target.quaternion);
      p.mesh.userData.targetQuaternion = target.quaternion;
      p.mesh.scale.setScalar(1); // real full size once actually part of the assembled shape, not the capped tray-display size
    } else {
      scene.add(p.mesh); // detach from skeletonGroup back to the fixed tray, if it was there
      p.mesh.position.copy(p.homePosition);
      const restQuaternion = sp.orientation ? quaternionForOrientationKey(sp.orientation) : new THREE.Quaternion();
      p.mesh.quaternion.copy(restQuaternion);
      p.mesh.userData.targetQuaternion = restQuaternion;
      p.mesh.visible = Boolean(p.fillsGroup); // fused: always shown; loose: fixed by revealNextTrayPiece below
      p.mesh.scale.setScalar(p.trayScale ?? 1);
    }
    setPieceSelectedVisual(p, p.id === current.state.selectedPieceId);
  }
  revealNextTrayPiece();

  for (const v of current.voids) {
    const filled = current.state.voids.find((sv) => sv.id === v.id).filled;
    // Filled: real piece mesh occupies this spot, ghost hidden (see
    // handlePlacement's own comment). Unfilled: reset to the neutral
    // ghost color -- refreshVoidHighlights() right below decides
    // visibility/red-green from current selection.
    v.wire.visible = !filled;
    if (!filled) v.wire.material.color.setHex(WIRE_COLOR);
  }
  refreshVoidHighlights();
  updateHud();
}

function undo() {
  if (!current || current.history.length === 0) return;
  if (current.advanceTimer) {
    clearTimeout(current.advanceTimer);
    current.advanceTimer = null;
  }
  solvedBanner.hidden = true;
  current.state = { ...current.history.pop(), selectedPieceId: null };
  syncVisualsToState();
  updateUndoButton();
}

undoButton.addEventListener('click', undo);

function pieceById(id) {
  return current.pieces.find((p) => p.id === id);
}

function currentStatePiece(id) {
  return current.state.pieces.find((p) => p.id === id);
}

// Counts open VOIDS, not unplaced pieces -- the two diverge as soon as
// a stage offers alternates (Stage 5's fused piece can clear several
// voids in one placement while its own loose siblings never get used
// at all), and "how much of the shape is left to fill" is what the
// player actually wants to know either way.
function remainingCount() {
  return current.state.voids.filter((v) => !v.filled).length;
}

// Only ever queues LOOSE pieces (no `fillsGroup`) -- a fused piece is
// its own separate, always-available tray slot (stages.js sets its
// mesh visible from construction), not part of the "one at a time"
// queue the count-tracked loose pieces share.
function revealNextTrayPiece() {
  const next = current.pieces.find((p) => !p.fillsGroup && !currentStatePiece(p.id).placed);
  if (!next) return;
  next.mesh.visible = true;
  next.mesh.position.copy(next.homePosition);
}

function updateHud() {
  const selectedId = current.state.selectedPieceId;
  const flippable = current.pieces.some((p) => p.orientationOptions);
  // Was mutually exclusive with `flippable` until Stage 4's manual-
  // orientation prototype made a stage BOTH flippable and 12-void at
  // once -- the remaining count is still worth showing there, so it's
  // folded into every branch below as a suffix instead of its own
  // separate branch.
  const multipleVoids = current.voids.length > 1;
  const remaining = remainingCount();
  const countSuffix = multipleVoids ? ` (${remaining} left)` : '';

  if (!selectedId) {
    if (flippable) {
      hud.textContent = `Tap a piece, then tap its void (tap again to flip)${countSuffix}`;
    } else if (multipleVoids) {
      hud.textContent = `Tap a piece, then tap a void to place it${countSuffix}`;
    } else {
      hud.textContent = 'Tap the piece, then tap the skeleton to place it';
    }
    return;
  }

  const selectedPiece = currentStatePiece(selectedId);
  if (selectedPiece.orientation) {
    const label = orientationLabel(selectedPiece.orientation);
    hud.textContent = `Piece selected (${label}) -- tap it again to flip, or tap a void to place${countSuffix}`;
  } else if (selectedPiece.fillsGroup) {
    hud.textContent = 'Fused piece selected -- tap anywhere on that region to fill it all at once';
  } else if (multipleVoids) {
    hud.textContent = `Piece selected${countSuffix} -- tap a void to place it`;
  } else {
    hud.textContent = 'Piece selected -- tap the skeleton to place it';
  }
}

function setPieceSelectedVisual(piece, isSelected) {
  if (piece.mesh.material.emissive) {
    piece.mesh.material.emissive.setHex(isSelected ? SELECTED_EMISSIVE : 0x000000);
  }
}

// Also toggles visibility, not just color -- on a stage where void
// wires are hidden until relevant (hideIdleVoidWires), a reject can
// happen on a wire that's currently invisible (tapping a void with
// nothing selected), and a color-only flash on an invisible line gives
// no feedback at all. Briefly force it visible for the flash, then
// restore whatever visibility it actually had.
function flashRejectWire(wire) {
  const originalColor = wire.material.color.getHex();
  const originalVisible = wire.visible;
  const originalOpacity = wire.material.opacity;
  wire.visible = true;
  wire.material.color.setHex(REJECT_FLASH_COLOR);
  // Force full opacity for the flash itself -- an already-invalid ghost
  // normally sits at INVALID_GHOST_OPACITY (faint, by design), which
  // would make the reject flash nearly invisible if left untouched.
  wire.material.opacity = VALID_GHOST_OPACITY;
  setTimeout(() => {
    wire.material.color.setHex(originalColor);
    wire.visible = originalVisible;
    wire.material.opacity = originalOpacity;
  }, 180);
}

// Recolors every unfilled void's translucent ghost piece: green if the
// currently selected piece (at its current orientation) would fit there
// right now, red if not. Filled voids are left alone (their ghost was
// already hidden at placement time -- the real solid piece occupies
// that spot now). Call this any time selection, orientation, or fill
// state changes.
//
// Also controls IDLE visibility for stages that opt into it
// (`hideIdleVoidWires` -- Stage 3+, direct instruction 2026-09-03 after
// live feedback: with every void's wire always on, an RD's 12 pyramids'
// worth of crisscrossing internal seams made the inward voids
// unreadable, contradicting the spec's own "no grid, no internal lines
// beyond the target's own silhouette" rule). With nothing selected,
// those stages hide every unfilled void's wire entirely -- the
// stage's own makeOuterBoundary() (stages.js) is what's left on
// screen. Stage 1/2 don't set the flag: their void wire already IS the
// target's own outer silhouette (no separate boundary object, nothing
// "internal" to hide), so it stays visible exactly as before.
function refreshVoidHighlights() {
  const selectedId = current.state.selectedPieceId;
  const validity = selectedId ? voidValidityForPiece(current.state, selectedId) : null;
  // Real live bug (2026-09-03, "cube isnt translucent it is opaque so
  // blocks view"): an auto-orienting piece (Stage 3/5/6's loose pieces,
  // no orientationOptions -- any open void takes it) makes EVERY open
  // void valid at once. Popping every one of them to VALID_GHOST_OPACITY
  // stacks that many near-opaque translucent layers on top of each
  // other -- alpha blending N overlapping layers approaches full opacity
  // fast regardless of any single layer's own opacity value (a 6-void
  // cube already reads as a solid wall even at a much-reduced per-layer
  // opacity; Stage 6 can have up to 24 simultaneously valid), so no
  // fixed opacity number fixes this for every stage's void count. There
  // is also nothing to disambiguate when literally every open void is a
  // correct answer -- unlike Stage 4's "1 of 12" or Stage 1/2's "1 of 2"
  // under a specific orientation, a ghost per void carries zero extra
  // information here. Fixed by hiding ghosts entirely in this case: the
  // outer translucent shell alone is what's shown, exactly as idle.
  const openVoidIds = current.voids
    .filter((v) => !current.state.voids.find((sv) => sv.id === v.id).filled)
    .map((v) => v.id);
  const validCount = validity ? openVoidIds.filter((id) => validity[id]).length : 0;
  // openVoidIds.length > 1 matters: Stage 1 has exactly ONE void total,
  // so "every open void valid" there just means "yes, correct
  // orientation" -- real, meaningful feedback with nothing to stack, not
  // the many-layers-of-green problem this guard exists for.
  const everyOpenVoidValid = validity && openVoidIds.length > 1 && validCount === openVoidIds.length;
  for (const v of current.voids) {
    const stateVoid = current.state.voids.find((sv) => sv.id === v.id);
    if (stateVoid.filled) continue;
    if (validity && everyOpenVoidValid) {
      v.wire.visible = !current.hideIdleVoidWires;
      v.wire.material.color.setHex(WIRE_COLOR);
      v.wire.material.opacity = GHOST_OPACITY;
      v.wire.material.depthTest = true;
    } else if (validity) {
      const valid = validity[v.id];
      v.wire.visible = true;
      v.wire.material.color.setHex(valid ? VALID_TARGET_COLOR : INVALID_TARGET_COLOR);
      v.wire.material.opacity = valid ? VALID_GHOST_OPACITY : INVALID_GHOST_OPACITY;
      // Real live bug (2026-09-03, "1 left over couldnt fill" / "only
      // outside were green on last few"): late in a stage, most voids
      // are already filled with real SOLID opaque pieces. A remaining
      // valid target can end up sitting fully behind one of those from
      // whatever angle the shape is currently at -- the raycast/match
      // logic is entirely correct (proven by a scripted solve using
      // exact projected screen coordinates, which placed all 12 without
      // a single failure), but the PLAYER can't see where to tap
      // because solid geometry is literally drawn in front of it, and
      // may not think to rotate to hunt for the one angle that shows a
      // gap. The single valid target is the most important thing on
      // screen right now, so it draws through everything else:
      // depthTest off only for the valid one specifically (kept on for
      // invalid/idle ghosts -- they're not worth punching through solid
      // pieces to see).
      v.wire.material.depthTest = !valid;
    } else {
      v.wire.visible = !current.hideIdleVoidWires;
      v.wire.material.color.setHex(WIRE_COLOR);
      v.wire.material.opacity = GHOST_OPACITY;
      v.wire.material.depthTest = true;
    }
  }
}

function advanceOrFinish() {
  const next = STAGES[stageIndex + 1];
  hud.textContent = 'Solved!';
  solvedBanner.hidden = false;
  solvedBanner.textContent = next ? 'Solved!' : 'Solved! More stages coming soon.';
  if (next) {
    current.advanceTimer = setTimeout(() => {
      stageIndex += 1;
      loadStage(stageIndex);
    }, STAGE_ADVANCE_DELAY_MS);
  }
}

// --- Tap vs. drag-to-rotate vs. pinch-to-zoom: a SINGLE pointer that
// moves past the threshold spins the skeleton (updated live on every
// move); one that comes back up without moving far is a tap instead. A
// second pointer joining mid-gesture cancels the single-finger
// candidate (no fighting a one-finger drag already in progress) and
// starts tracking a pinch instead -- direct instruction (2026-09-04,
// "need pinch and expand gestures to make puzzle bigger"), fulfilling
// a gap this comment used to flag as not-yet-built. `activePointers`
// is a Map (id -> last known {x,y}), not just a Set, since pinch needs
// both fingers' actual positions, not just a count.
const activePointers = new Map();
let tapCandidateId = null;
let pointerDownPos = null;
let dragLast = null;
let pinchStartDistance = null;
let pinchStartZoom = null;
const TAP_MOVE_THRESHOLD = 10;
const ROTATE_SPEED = 0.012;
const MAX_PITCH = Math.PI / 2 - 0.02;
const WHEEL_ZOOM_SPEED = 0.0015;

function cancelTapCandidate() {
  tapCandidateId = null;
  pointerDownPos = null;
  dragLast = null;
}

function currentPinchDistance() {
  const [a, b] = [...activePointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 1) {
    tapCandidateId = e.pointerId;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    dragLast = { x: e.clientX, y: e.clientY };
  } else {
    cancelTapCandidate();
    if (activePointers.size === 2) {
      pinchStartDistance = currentPinchDistance();
      pinchStartZoom = zoomFactor;
    }
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2 && pinchStartDistance) {
    // Fingers spreading apart (expand) shrinks the distance ratio,
    // shrinking zoomFactor -- a smaller camera distance means a
    // BIGGER/closer view, matching "expand to make it bigger" as a
    // real, not just labeled, effect.
    const ratio = pinchStartDistance / currentPinchDistance();
    zoomFactor = THREE.MathUtils.clamp(pinchStartZoom * ratio, MIN_ZOOM, MAX_ZOOM);
    applyCameraFraming();
    return;
  }
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
  if (activePointers.size < 2) pinchStartDistance = null;
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
  if (activePointers.size < 2) pinchStartDistance = null;
  if (e.pointerId === tapCandidateId) cancelTapCandidate();
});

// Desktop equivalent of pinch -- same zoomFactor, same clamped range.
// preventDefault stops the page itself from scrolling under a wheel
// event landing on the canvas.
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomFactor = THREE.MathUtils.clamp(zoomFactor * (1 + e.deltaY * WHEEL_ZOOM_SPEED), MIN_ZOOM, MAX_ZOOM);
  applyCameraFraming();
}, { passive: false });

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function handleTap(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  // .visible is filtered explicitly, not left to the raycaster -- real
  // bug, caught building Stage 4's manual-orientation prototype
  // (2026-09-03): THREE.Raycaster does NOT skip invisible objects on
  // its own (verified directly against the library source, neither
  // Raycaster.js nor Mesh.js check `.visible`). The count-tracked tray
  // queue (Stage 3/5/6) never surfaced this: every not-yet-revealed
  // piece sits at the exact same UNROTATED pose as the visible one, so
  // tied-distance intersections happened to stably resolve to array
  // order (index 0) by coincidence, not because visibility was actually
  // respected. Stage 4 breaks that coincidence -- flipping the visible
  // piece rotates it away from the shared pose, so the next queued
  // (still-identity-rotated, still invisible) piece could resolve
  // nearer the ray than the one actually on screen, silently flipping
  // the WRONG piece.
  const pieceTargets = current.pieces
    .filter((p) => !currentStatePiece(p.id).placed && p.mesh.visible)
    .map((p) => p.mesh);
  const voidTargets = current.voids.map((v) => v.hitTarget);
  const hits = raycaster.intersectObjects([...pieceTargets, ...voidTargets], false);
  if (hits.length === 0) return;

  // Real live bug (2026-09-03, "third green inside piece in RD will not
  // accept tapping as it is surrounded by incorrectly oriented pieces
  // which block"): raycaster hits are sorted purely by 3D distance, with
  // no regard for a void's own filled/valid state or how visible its
  // ghost currently is right now. An invalid void's ghost is
  // deliberately rendered near-invisible (INVALID_GHOST_OPACITY), but
  // its hitTarget geometry is exactly as solid as ever -- if it happens
  // to sit closer to the camera along the same ray as a valid target
  // behind it, hits[0] silently resolves to the invalid one and the tap
  // is rejected even though the player was clearly aiming at (and could
  // dimly see) the valid target through it. A filled void's hitTarget
  // has the same problem -- nothing excluded it once its ghost was
  // hidden. Fixed by walking the sorted hit list for the first hit
  // that's actually usable (a piece, or an unfilled void that's valid
  // when validity is known) before falling back to the closest hit of
  // any kind -- preserves the reject-flash for a genuine miss (nothing
  // valid anywhere along the ray) while no longer letting an invisible-
  // ish invalid/filled void silently eat a tap meant for something valid
  // behind it.
  const selectedId = current.state.selectedPieceId;
  const validity = selectedId ? voidValidityForPiece(current.state, selectedId) : null;
  const isUsableVoidHit = (obj) => {
    const v = current.voids.find((vv) => vv.hitTarget === obj);
    if (!v) return false;
    if (current.state.voids.find((sv) => sv.id === v.id).filled) return false;
    return validity ? Boolean(validity[v.id]) : true;
  };
  const bestHit = hits.find((h) => pieceTargets.includes(h.object) || isUsableVoidHit(h.object)) || hits[0];
  const hitObj = bestHit.object;

  const hitPiece = current.pieces.find((p) => p.mesh === hitObj);
  if (hitPiece) {
    if (current.state.selectedPieceId === hitPiece.id) {
      // A piece with no orientationOptions (Stage 3's pieces) has
      // nothing to flip -- flipPiece() is already a no-op for it, but
      // skip the rotation-target update too rather than calling
      // quaternionForOrientationKey(undefined) for a piece with no
      // orientation.
      if (hitPiece.orientationOptions) {
        current.state = flipPiece(current.state, hitPiece.id);
        hitPiece.orientation = currentStatePiece(hitPiece.id).orientation;
        hitPiece.mesh.userData.targetQuaternion = quaternionForOrientationKey(hitPiece.orientation);
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

  const previousState = current.state;
  const result = placeSelected(current.state, hitVoid.id);
  current.state = result.state;
  if (!result.placed) {
    flashRejectWire(hitVoid.wire);
    return;
  }
  current.history.push(previousState);
  updateUndoButton();

  const placedPiece = pieceById(result.pieceId);
  // A loose piece snaps to the one void it was tapped onto; a fused
  // piece (Stage 5) snaps to its GROUP's own shared placement instead
  // (e.g. the cube's own center, identity rotation) -- it's a single
  // physical object standing in for every void it just filled at once,
  // not oriented to any one of them.
  const target = placedPiece.fillsGroup
    ? current.groups.find((g) => g.id === placedPiece.fillsGroup)
    : hitVoid;
  // Reparent tray -> skeleton (Object3D.add() detaches from its current
  // parent automatically) so this piece rotates together with the rest
  // of the assembled shape from now on, instead of staying pinned to
  // the tray's fixed position in world space.
  current.skeletonGroup.add(placedPiece.mesh);
  placedPiece.mesh.position.copy(target.position);
  placedPiece.mesh.quaternion.copy(target.quaternion);
  placedPiece.mesh.userData.targetQuaternion = target.quaternion;
  placedPiece.mesh.scale.setScalar(1); // real full size once actually part of the assembled shape, not the capped tray-display size
  setPieceSelectedVisual(placedPiece, false);
  for (const filledId of result.filledVoidIds) {
    const filledVoid = current.voids.find((v) => v.id === filledId);
    if (!filledVoid) continue;
    // The real solid piece mesh now occupies this exact position/
    // orientation -- the translucent ghost would just double up on top
    // of it, so hide it rather than recoloring it (2026-09-03 ghost-
    // piece-overlay redesign, superseding the old FILLED_WIRE_COLOR seam).
    filledVoid.wire.visible = false;
  }
  revealNextTrayPiece();
  refreshVoidHighlights();
  updateHud();

  if (isSolved(current.state)) advanceOrFinish();
}

function animate() {
  requestAnimationFrame(animate);
  if (current) {
    for (const p of current.pieces) {
      const sp = currentStatePiece(p.id);
      if (sp && !sp.placed && sp.orientation) {
        // Real live report (2026-09-03): "genuinely aligned spaces dont
        // light up as you rotate... successful orientations are in
        // completely different directions". Root cause: an unplaced
        // piece lives in the fixed tray as a child of `scene`, not
        // `skeletonGroup` -- dragging to rotate the target shape spins
        // the skeleton (and every void with it), but the held piece's
        // own facing never moved, so "does this look aligned with that
        // hole" stopped being a trustworthy cue the moment you rotated
        // at all (the piece's orientation is a fixed local-axis label,
        // meaningless as a SCREEN direction until composed with
        // whatever the skeleton's current rotation actually is). Fixed
        // by composing the piece's own orientation with the skeleton's
        // live rotation every frame, so the held piece visually spins
        // along with the target shape and stays a real visual match for
        // whichever void it's actually compatible with, at any camera
        // angle. Placed pieces need none of this -- they're already
        // children of skeletonGroup, so the scene graph composes their
        // rotation with the group's automatically.
        const desired = current.skeletonGroup.quaternion.clone().multiply(quaternionForOrientationKey(sp.orientation));
        p.mesh.quaternion.slerp(desired, ROTATION_DAMPING);
      } else {
        const target = p.mesh.userData.targetQuaternion;
        if (target) p.mesh.quaternion.slerp(target, ROTATION_DAMPING);
      }
    }
  }
  renderer.render(scene, camera);
}

loadStage(stageIndex);
animate();
