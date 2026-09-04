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
import { createPuzzleState, selectPiece, flipPiece, setPieceOrientation, openOrientationOptions, placeSelected, isSolved, voidValidityForPiece, smallestEnclosingGroupId, ANY_SINGLE_CELL_GROUP } from './puzzle-state.js';

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

// A light's own `.layers` gates which CAMERA can see it at all (the
// renderer tests `light.layers.test(camera.layers)` same as any other
// Object3D, not just which objects it illuminates) -- both lights stay
// on the default layer 0 (so `camera`, the target, keeps lighting the
// skeleton exactly as before) and ALSO get `STARFIELD_LAYER` enabled so
// `trayCamera` (which, after the layer-bleed fix below, no longer has
// layer 0 at all) still has light to render tray pieces by, rather than
// going fully black. Declared up here, before the lights, so both can
// reference it -- see `TRAY_LAYER`'s own comment further down for the
// bug this whole arrangement fixes.
const STARFIELD_LAYER = 2;
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(3, 5, 4);
ambientLight.layers.enable(STARFIELD_LAYER);
sun.layers.enable(STARFIELD_LAYER);
scene.add(ambientLight, sun);

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
// STARFIELD_LAYER (declared up with the lights, for the same reason) --
// shared backdrop for BOTH cameras without pulling the target skeleton
// into the tray's own render (see TRAY_LAYER's own comment below).
const starfieldA = buildStarfield(900, [70, 85], 1.1, 0.55);
const starfieldB = buildStarfield(120, [70, 85], 2.2, 0.9);
starfieldA.layers.set(STARFIELD_LAYER);
starfieldB.layers.set(STARFIELD_LAYER);
scene.add(starfieldA, starfieldB);

// Two independent cameras/viewports, one shared renderer -- direct
// instruction (2026-09-04): "the main issue with target and piece
// picker tray is that because they are all in a line you can only view
// them at a small size" / "target and tray should move independently"
// / "picker pieces should be top right target should be left of
// center" / "as you enlarge picker pieces disappear". The ORIGINAL
// design (both in one shared camera, tray offset far to the side) is
// exactly what caused all four of those: a shared "fit everything"
// distance means neither the target nor the tray can ever be big, a
// single rotation/zoom couldn't touch one without touching the other,
// and zooming toward the target pushed the far-off tray out of the
// same camera's frustum entirely. Splitting into two cameras -- each
// with its own derived framing, its own rotation group, its own zoom --
// removes the coupling at the root instead of patching each symptom.
// Real bug caught live during this same rewrite: rendering the SAME
// scene through two different cameras means EITHER camera renders
// everything in it by default, including whichever pieces are
// currently sitting in the OTHER camera's own group -- confirmed
// directly (temporary debug logging of the target camera's own
// computed distance matched hand-verified math exactly, ruling out a
// framing-math bug; the real cause was the tray's own solid pieces
// visibly bleeding into the target's render). THREE.Layers is the
// fix: every tray piece goes on TRAY_LAYER, `camera` (target) never
// enables it (a camera's default layer mask is layer 0 only, so simply
// never touching `camera.layers` already excludes it).
//
// Second real bug, same root cause, found later (live report: "massive
// shape appears and then disappears as you try to manipulate"):
// `trayCamera.layers.enable(TRAY_LAYER)` only ADDS a layer to a
// camera's mask, it doesn't replace it -- a fresh camera's mask already
// has layer 0 enabled by default, so `trayCamera` was rendering BOTH
// the tray pieces AND the full target skeleton (layer 0) the whole
// time. Most rotations/zoom levels keep the (much larger, differently
// positioned) target skeleton outside the tray camera's own narrow,
// close-up frustum, so this stayed invisible -- until a rotation swung
// part of it into view, where the tray's own close-focused framing
// rendered it hugely oversized inside the small tray corner, then out
// again as the rotation continued. `trayCamera.layers.set(TRAY_LAYER)`
// (replace, not add) is the fix; `STARFIELD_LAYER` below exists so both
// cameras can still share just the starfield backdrop without either
// one pulling in the other's actual content.
const TRAY_LAYER = 1;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
const trayCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.layers.enable(STARFIELD_LAYER);
trayCamera.layers.set(TRAY_LAYER);
trayCamera.layers.enable(STARFIELD_LAYER);
const CAMERA_DIRECTION = new THREE.Vector3(2.5, 2, 5).normalize();

// All UNPLACED pieces live here (not loose children of `scene`) so the
// tray can be rotated as its own independent group, exactly paralleling
// how `skeletonGroup` already works for the target -- a placed piece
// reparents OUT of this into `skeletonGroup`, same as before.
const trayGroup = new THREE.Group();
scene.add(trayGroup);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

camera.lookAt(0, 0, 0);

// Camera distance is DERIVED, not hand-tuned per stage -- and, since
// the target/tray viewport split, derived from the TRUE camera-relative
// extent of the content, not a generic bounding-SPHERE approximation.
// A sphere-based fit (this file's own earlier version) is only exactly
// right for a spherical object; for an elongated/asymmetric shape
// (Stage 8's Triangle, N=4's Tetrahedron/Straight Line) viewed from a
// fixed angle, it can under-estimate the distance actually needed and
// let real corners clip past the frame edge. This was ALWAYS true of
// the sphere math, but invisible before the viewport split: framing
// the target and tray together in one shared sphere (the tray sitting
// far off to the side) made that shared sphere's radius dominated by
// the tray's own distance, which accidentally gave the target far more
// margin than its own real extent needed. Splitting the two cameras
// removed that accidental slack and made the real gap visible
// (confirmed live: Stage 8/12's target visibly clipped top and bottom
// with the sphere-based fit). Fixed properly, not by inflating the
// margin further: `cameraRelativeDistance` decomposes each of the
// object's real 8 bounding-box corners into components along the
// camera's own actual right/up axes (not an isotropic radius), and
// solves for the distance that keeps EVERY corner inside both the
// vertical and horizontal FOV -- correct for any shape from this fixed
// viewing angle, not just spheres.
const FRAME_MARGIN = 1.12;
const CAMERA_FORWARD = CAMERA_DIRECTION.clone().negate(); // camera looks back toward its target, opposite of the direction it's offset along
const CAMERA_RIGHT = new THREE.Vector3().crossVectors(CAMERA_FORWARD, new THREE.Vector3(0, 1, 0)).normalize();
const CAMERA_UP = new THREE.Vector3().crossVectors(CAMERA_RIGHT, CAMERA_FORWARD).normalize();

function boundingBoxCenterAndCorners(objects) {
  const box = new THREE.Box3();
  for (const obj of objects) box.expandByObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const cornerOffsets = [
    [box.min.x, box.min.y, box.min.z], [box.min.x, box.min.y, box.max.z],
    [box.min.x, box.max.y, box.min.z], [box.min.x, box.max.y, box.max.z],
    [box.max.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.max.z],
    [box.max.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.max.z],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).sub(center));
  return { center, cornerOffsets };
}

function cameraRelativeDistance(cornerOffsets, cam) {
  const vFov = THREE.MathUtils.degToRad(cam.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
  const tanV = Math.tan(vFov / 2);
  const tanH = Math.tan(hFov / 2);
  let maxDistance = 0;
  for (const offset of cornerOffsets) {
    const rightComp = Math.abs(offset.dot(CAMERA_RIGHT));
    const upComp = Math.abs(offset.dot(CAMERA_UP));
    maxDistance = Math.max(maxDistance, rightComp / tanH, upComp / tanV);
  }
  return maxDistance;
}

// Pinch-to-zoom/wheel-zoom multiply the DERIVED distance rather than
// replacing it -- direct instruction (2026-09-04, "need pinch and
// expand gestures to make puzzle bigger"). Target and tray get their
// OWN independent zoom now (part of the same split as the two cameras
// above) -- zooming the target no longer affects the tray's own size
// at all. Both reset to 1 on every stage load.
let zoomFactor = 1;
let trayZoomFactor = 1;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

function applyCameraFraming() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  if (!current) return;
  const distance = cameraRelativeDistance(current.targetBox.cornerOffsets, camera) * FRAME_MARGIN * zoomFactor;
  camera.position.copy(current.targetBox.center).add(CAMERA_DIRECTION.clone().multiplyScalar(distance));
  camera.lookAt(current.targetBox.center);
}

function applyTrayFraming() {
  const rect = trayViewportRect();
  trayCamera.aspect = rect.width / rect.height;
  trayCamera.updateProjectionMatrix();
  if (!current) return;
  const distance = cameraRelativeDistance(current.trayBox.cornerOffsets, trayCamera) * FRAME_MARGIN * trayZoomFactor;
  trayCamera.position.copy(current.trayBox.center).add(CAMERA_DIRECTION.clone().multiplyScalar(distance));
  trayCamera.lookAt(current.trayBox.center);
}

// Tray viewport: a fixed corner overlay, top-right (direct instruction
// "picker pieces should be top right"), rendered as a second scissored
// pass over the target's own full-screen render. Kept well clear of
// the topbar (RHOMBIS wordmark/Stages button) and safe-area insets.
const TRAY_MARGIN = 16;
function trayViewportRect() {
  const topInset = 64; // clears the topbar in the common case without reading its live layout every frame
  const width = Math.min(300, window.innerWidth * 0.42);
  const height = Math.min(380, window.innerHeight * 0.48);
  return {
    left: window.innerWidth - width - TRAY_MARGIN,
    top: topInset,
    width,
    height,
  };
}

function syncTrayPanel() {
  const rect = trayViewportRect();
  const panel = document.getElementById('rhombis-tray-panel');
  if (!panel) return;
  panel.style.left = `${rect.left}px`;
  panel.style.top = `${rect.top}px`;
  panel.style.width = `${rect.width}px`;
  panel.style.height = `${rect.height}px`;
}

function handleViewportChange() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyCameraFraming();
  applyTrayFraming();
  syncTrayPanel();
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
const trayFlash = document.getElementById('rhombis-tray-flash');

// Direct instruction (2026-09-04, "success message in picker tray
// box") -- confirmation shown right where attention already is (the
// tray itself) on a successful placement, not just the bottom HUD text
// that's easy to miss mid-play. Own opacity transition (CSS `.show`
// class) rather than toggling `hidden`, and the forced reflow below
// lets a rapid second placement restart the animation instead of it
// looking stuck if it retriggers before the first fade-out finishes.
let trayFlashTimer = null;
// Generalized (2026-09-04) to take arbitrary text/duration, not just
// "Placed!" -- direct report on the Burr Puzzle stage, "I didnt really
// get the difference with burr... it felt similar to how I solved
// others": the mechanic was real (verified: the key piece IS genuinely
// rejected out of order) but completely SILENT about WHY -- a blocked
// placement got the exact same generic reject-flash as a decoy or a
// wrong orientation, so a player who happened to place pieces in a
// working order never even noticed anything was different, and one who
// didn't just saw an unexplained rejection. Reuses this SAME "right
// where attention already is" element (originally added for the same
// reason: bottom HUD text is easy to miss mid-play) rather than a new
// UI element.
function flashTrayMessage(text, durationMs = 700) {
  if (!trayFlash) return;
  trayFlash.textContent = text;
  trayFlash.classList.remove('show');
  void trayFlash.offsetWidth;
  trayFlash.classList.add('show');
  if (trayFlashTimer) clearTimeout(trayFlashTimer);
  trayFlashTimer = setTimeout(() => trayFlash.classList.remove('show'), durationMs);
}

function flashTrayPlaced() {
  flashTrayMessage('Placed!');
}

// Dev/testing convenience only, never surfaced in the UI: ?stage=N
// jumps straight to that stage's own id (STAGES' own `id` field, not
// the array index) on load, so trying out a specific stage -- e.g.
// comparing two neighboring stages' own mechanics -- doesn't need
// editing source and remembering to revert it. Silently falls back to
// Stage 1 for a missing/invalid value.
const requestedStageId = Number(new URLSearchParams(window.location.search).get('stage'));
const requestedStageIndex = STAGES.findIndex((s) => s.id === requestedStageId);
let stageIndex = requestedStageIndex >= 0 ? requestedStageIndex : 0;
let current = null; // { skeletonGroup, pieces, voids, state, targetBox, trayBox, history, advanceTimer }

function clearCurrentStage() {
  if (!current) return;
  if (current.advanceTimer) clearTimeout(current.advanceTimer);
  scene.remove(current.skeletonGroup);
  // A piece's current parent is whichever group it was actually in
  // (trayGroup if never placed, skeletonGroup if it was) -- removing
  // from `.parent` directly is correct either way, rather than assuming.
  current.pieces.forEach((p) => p.mesh.parent?.remove(p.mesh));
}

function loadStage(index) {
  clearCurrentStage();
  zoomFactor = 1; // a new stage's own derived framing, not a leftover zoom from whatever was open before
  trayZoomFactor = 1;
  const stageDef = STAGES[index];
  const built = stageDef.build(SCALE);

  scene.add(built.skeletonGroup);

  // Recenter the tray stack around ITS OWN centroid before adding
  // pieces to trayGroup -- every stage's own home positions were
  // chosen back when the tray shared one camera with the target and
  // needed to sit visibly "off to the side" of it; now that the tray
  // gets its own independent camera and its own independently-
  // rotatable group, rotating trayGroup around ITS local origin
  // (unchanged, at world (0,0,0)) would swing pieces sitting far from
  // there wildly across the screen instead of spinning them in place.
  // Recentering here means no stage's own home-position choices needed
  // to change at all.
  const trayCentroid = built.pieces
    .reduce((sum, p) => sum.add(p.homePosition), new THREE.Vector3())
    .multiplyScalar(1 / built.pieces.length);
  built.pieces.forEach((p, i) => {
    p.homePosition.sub(trayCentroid);
    p.mesh.position.copy(p.homePosition);
    trayGroup.add(p.mesh);
    p.mesh.layers.set(TRAY_LAYER);
    // A fused piece (no `orientationOptions`, so no flip mechanic and
    // no meaningful "starts wrong" pose the way a flippable piece has)
    // otherwise rests at plain identity forever -- every one in a tray
    // looks like the exact same static pose, not just the same shape/
    // color. Direct instruction (2026-09-04, after numbers and a
    // per-piece hue were both tried and reverted -- numbers felt like
    // clutter, hue risked colliding with the red/green void-validity
    // meaning): "next piece should be at a slightly different rotation
    // to start, to avoid confusion with previous piece". The golden
    // angle keeps consecutive pieces well spread apart regardless of
    // how many are in the tray, never landing two adjacent ones at a
    // near-identical angle the way a small fixed step could. Flippable
    // pieces are untouched -- their own starting `orientation` is
    // already meaningful (Stage 1's own "starts wrong" design), not
    // something to override with an arbitrary spin.
    if (!p.orientationOptions) {
      const GOLDEN_ANGLE = 2.399963;
      p.trayRestQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * GOLDEN_ANGLE);
      p.mesh.quaternion.copy(p.trayRestQuaternion);
      p.mesh.userData.targetQuaternion = p.trayRestQuaternion;
    }
  });

  const state = createPuzzleState({
    pieces: built.pieces.map((p) => ({
      id: p.id,
      orientation: p.orientation,
      orientationOptions: p.orientationOptions,
      fillsGroup: p.fillsGroup,
      requiresPlacedFirst: p.requiresPlacedFirst,
    })),
    voids: built.voids.map((v) => ({ id: v.id, requiredOrientation: v.requiredOrientation, groupIds: v.groupIds })),
  });

  const targetBox = boundingBoxCenterAndCorners([built.skeletonGroup]);
  const trayBox = boundingBoxCenterAndCorners(built.pieces.map((p) => p.mesh));
  current = { ...built, groups: built.groups ?? [], state, targetBox, trayBox, history: [], advanceTimer: null };
  applyCameraFraming();
  applyTrayFraming();
  solvedBanner.hidden = true;
  stageLabel.textContent = `Stage ${stageDef.id}: ${stageDef.name}`;
  // A fresh piece mesh defaults to visible (THREE.Object3D's own
  // default) -- fine for a fixed-group fused piece (always meant to be
  // shown), but WRONG for the interchangeable singles, which now share
  // one tray slot and need exactly one of them picked to start (the
  // same "reveal next" logic syncVisualsToState() already runs on every
  // placement/undo). Calling it here too, on a fresh load, is what
  // actually applies that same one-at-a-time rule from the very first
  // frame -- without this, every single stayed visible until the FIRST
  // placement or undo happened to trigger a sync. It already runs
  // refreshVoidHighlights()/updateHud() itself, so those standalone
  // calls are gone.
  syncVisualsToState();
  updateUndoButton();
}

function updateUndoButton() {
  undoButton.disabled = !current || current.history.length === 0;
}

// Stage picker -- direct instruction (2026-09-04): a returning player
// shouldn't have to replay every earlier stage just to reach one they
// already know they want. A fixed jump-in link (the welcome screen's
// own tagline link, `data/changelog.json`'s `link` field) covers
// exactly one destination; this covers all of them, live, without a
// page reload. Populated directly from STAGES, so a stage added later
// needs no picker-specific update.
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
// A placed fused piece's ACTUAL target group -- `p.fillsGroup` directly
// for a fixed-group piece, but an interchangeable one's own
// `fillsGroup` is just the ANY_SINGLE_CELL_GROUP sentinel, not a real
// id (there's no fresh `placeSelected()` result to read `targetGroupId`
// off of here, unlike the live placement code -- this is the undo/
// resync path, re-derived purely from current state). Any one void this
// piece filled unambiguously identifies the real group, since every
// void in that group got the SAME `filledBy` together.
function resolvedGroupIdForPlacedFusedPiece(p) {
  if (p.fillsGroup !== ANY_SINGLE_CELL_GROUP) return p.fillsGroup;
  const filledVoidId = current.state.voids.find((sv) => sv.filledBy === p.id).id;
  const filledVoid = current.voids.find((v) => v.id === filledVoidId);
  return smallestEnclosingGroupId(current.state, filledVoid);
}

function syncVisualsToState() {
  for (const p of current.pieces) {
    const sp = currentStatePiece(p.id);
    if (sp.placed) {
      const target = p.fillsGroup
        ? current.groups.find((g) => g.id === resolvedGroupIdForPlacedFusedPiece(p))
        : current.voids.find((v) => current.state.voids.find((sv) => sv.id === v.id).filledBy === p.id);
      current.skeletonGroup.add(p.mesh);
      p.mesh.layers.set(0);
      p.mesh.position.copy(target.position);
      p.mesh.quaternion.copy(target.quaternion);
      p.mesh.userData.targetQuaternion = target.quaternion;
      p.mesh.scale.setScalar(1); // real full size once actually part of the assembled shape, not the capped tray-display size
    } else {
      trayGroup.add(p.mesh); // detach from skeletonGroup back to the tray, if it was there
      p.mesh.layers.set(TRAY_LAYER);
      p.mesh.position.copy(p.homePosition);
      const restQuaternion = sp.orientation ? quaternionForOrientationKey(sp.orientation) : (p.trayRestQuaternion ?? new THREE.Quaternion());
      p.mesh.quaternion.copy(restQuaternion);
      p.mesh.userData.targetQuaternion = restQuaternion;
      // Fused pieces with a FIXED group (joined-pair, full, decoy) are
      // always shown -- each is its own distinct slot. Interchangeable
      // singles (ANY_SINGLE_CELL_GROUP) are the exception: direct
      // instruction (2026-09-04, "really dont want four single RDs in a
      // row taking up space in picker tray") -- they're all the same
      // shape sharing one tray slot (stages.js gives them a shared
      // homePosition), so only one should ever be visible at a time,
      // same "one at a time" queue revealNextTrayPiece already runs for
      // loose pieces below.
      p.mesh.visible = Boolean(p.fillsGroup) && p.fillsGroup !== ANY_SINGLE_CELL_GROUP;
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

// Queues LOOSE pieces (no `fillsGroup`) -- a fused piece with a FIXED
// group is its own separate, always-available tray slot (stages.js sets
// its mesh visible from construction). Interchangeable singles
// (ANY_SINGLE_CELL_GROUP) join this same "one at a time" queue too
// (2026-09-04, see syncVisualsToState's own comment) -- they all share
// one tray slot/homePosition, so revealing them one at a time is what
// actually frees up the space, not just deciding WHICH single shows.
function revealNextTrayPiece() {
  const next = current.pieces.find(
    (p) => (!p.fillsGroup || p.fillsGroup === ANY_SINGLE_CELL_GROUP) && !currentStatePiece(p.id).placed,
  );
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

// --- Region routing: which viewport (tray vs. target) a pointer event
// belongs to, decided once per gesture (at pointerdown, or at the
// moment a second finger joins for a pinch) and held for that whole
// gesture -- a drag/pinch that wanders outside its own starting rect
// mid-gesture (a finger sliding past the tray's own small corner, say)
// should keep controlling whatever it started controlling, not switch
// targets mid-motion.
function regionAt(clientX, clientY) {
  const rect = trayViewportRect();
  const inTray = clientX >= rect.left && clientX <= rect.left + rect.width
    && clientY >= rect.top && clientY <= rect.top + rect.height;
  return inTray ? 'tray' : 'target';
}

// --- Tap vs. drag-to-rotate vs. pinch-to-zoom: a SINGLE pointer that
// moves past the threshold spins the region it started in (target's
// skeletonGroup, or the tray's own trayGroup -- direct instruction
// 2026-09-04, "target and tray should move independently"); one that
// comes back up without moving far is a tap instead. A second pointer
// joining mid-gesture cancels the single-finger candidate (no fighting
// a one-finger drag already in progress) and starts tracking a pinch
// instead, scoped to whichever region the pinch itself started in.
// `activePointers` is a Map (id -> last known {x,y}), not just a Set,
// since pinch needs both fingers' actual positions, not just a count.
const activePointers = new Map();
let tapCandidateId = null;
let pointerDownPos = null;
let dragLast = null;
let dragRegion = null;
let pinchStartDistance = null;
let pinchStartZoom = null;
let pinchRegion = null;
const TAP_MOVE_THRESHOLD = 10;
const ROTATE_SPEED = 0.012;
const MAX_PITCH = Math.PI / 2 - 0.02;
const WHEEL_ZOOM_SPEED = 0.0015;

// Direct instruction (2026-09-04): "three ways of matching orientation
// 1. you tap (as now) 2. you revolve picker shape 3. you revolve
// target" -- a live report that a selected piece showing every void
// except its CURRENT orientation as flat red ("full of red... game
// shouldn't upset intuitive and logic") when it could actually fit
// several of them, just at a different orientation, read as "doesn't
// fit" rather than "not yet". A tray-region drag with a FLIPPABLE piece
// selected now spins THAT piece's own orientation, live, instead of
// the whole tray view -- `animate()`'s own per-piece slerp (below) is
// suppressed for whichever piece this names, so the drag has
// uncontested control of it while active. Rotating the TARGET stays
// pure camera movement, unchanged -- already a real way to compare a
// void's required pose against however you're currently holding the
// piece, just an indirect one (a viewing aid, not a setter).
let orientDragPieceId = null;

function selectedFlippablePiece() {
  if (!current || !current.state.selectedPieceId) return null;
  const sp = currentStatePiece(current.state.selectedPieceId);
  if (!sp || sp.placed || !sp.orientationOptions || sp.orientationOptions.length < 2) return null;
  return sp;
}

function cancelTapCandidate() {
  tapCandidateId = null;
  pointerDownPos = null;
  dragLast = null;
  dragRegion = null;
  orientDragPieceId = null;
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
    dragRegion = regionAt(e.clientX, e.clientY);
    orientDragPieceId = dragRegion === 'tray' && selectedFlippablePiece() ? current.state.selectedPieceId : null;
  } else {
    cancelTapCandidate();
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinchRegion = regionAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchStartDistance = currentPinchDistance();
      pinchStartZoom = pinchRegion === 'tray' ? trayZoomFactor : zoomFactor;
    }
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 2 && pinchStartDistance) {
    // Fingers spreading apart (expand) shrinks the distance ratio,
    // shrinking the zoom factor -- a smaller camera distance means a
    // BIGGER/closer view, matching "expand to make it bigger" as a
    // real, not just labeled, effect.
    const ratio = pinchStartDistance / currentPinchDistance();
    const newZoom = THREE.MathUtils.clamp(pinchStartZoom * ratio, MIN_ZOOM, MAX_ZOOM);
    if (pinchRegion === 'tray') { trayZoomFactor = newZoom; applyTrayFraming(); }
    else { zoomFactor = newZoom; applyCameraFraming(); }
    return;
  }
  if (e.pointerId !== tapCandidateId || !dragLast || !current) return;
  const dx = e.clientX - dragLast.x;
  const dy = e.clientY - dragLast.y;
  dragLast = { x: e.clientX, y: e.clientY };
  if (orientDragPieceId) {
    // Spins the SELECTED PIECE's own mesh, not the tray view -- no
    // pitch clamp (unlike the group-rotation branch below), since a
    // piece may need to reach a fully upside-down pose and clamping
    // pitch would make that orientation unreachable by dragging alone.
    const mesh = pieceById(orientDragPieceId).mesh;
    mesh.rotation.y += dx * ROTATE_SPEED;
    mesh.rotation.x += dy * ROTATE_SPEED;
    const sp = currentStatePiece(orientDragPieceId);
    let nearestKey = sp.orientation;
    let nearestAngle = Infinity;
    // Only searches orientations still worth reaching (`openOrientationOptions`)
    // -- direct instruction (2026-09-04, "reduce amount of wrong options
    // as faces get filled"): a drag that's actually closest to a now-dead
    // orientation (one no open void wants anymore) snaps to the nearest
    // LIVE one instead, so dragging never lands on a pose that's
    // guaranteed to reject.
    for (const key of openOrientationOptions(current.state, orientDragPieceId)) {
      const angle = mesh.quaternion.angleTo(quaternionForOrientationKey(key));
      if (angle < nearestAngle) {
        nearestAngle = angle;
        nearestKey = key;
      }
    }
    // Only touches state (and re-renders the red/green highlights) when
    // the nearest reachable orientation actually changes -- this is
    // what makes the "wall of red" sweep to green live as you rotate,
    // rather than only updating once on release.
    if (nearestKey !== sp.orientation) {
      current.state = setPieceOrientation(current.state, orientDragPieceId, nearestKey);
      refreshVoidHighlights();
      updateHud();
    }
    return;
  }
  const rot = (dragRegion === 'tray' ? trayGroup : current.skeletonGroup).rotation;
  rot.y += dx * ROTATE_SPEED;
  rot.x = THREE.MathUtils.clamp(rot.x + dy * ROTATE_SPEED, -MAX_PITCH, MAX_PITCH);
});

renderer.domElement.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) { pinchStartDistance = null; pinchRegion = null; }
  if (e.pointerId !== tapCandidateId || !pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  const moved = Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD;
  const tapRegion = dragRegion;
  cancelTapCandidate();
  if (moved) return; // was a drag/rotate
  handleTap(e.clientX, e.clientY, tapRegion);
});

renderer.domElement.addEventListener('pointercancel', (e) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) { pinchStartDistance = null; pinchRegion = null; }
  if (e.pointerId === tapCandidateId) cancelTapCandidate();
});

// Desktop equivalent of pinch -- same zoom factors, same clamped range,
// scoped to whichever region the wheel event itself landed in.
// preventDefault stops the page itself from scrolling under a wheel
// event landing on the canvas.
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (regionAt(e.clientX, e.clientY) === 'tray') {
    trayZoomFactor = THREE.MathUtils.clamp(trayZoomFactor * (1 + e.deltaY * WHEEL_ZOOM_SPEED), MIN_ZOOM, MAX_ZOOM);
    applyTrayFraming();
  } else {
    zoomFactor = THREE.MathUtils.clamp(zoomFactor * (1 + e.deltaY * WHEEL_ZOOM_SPEED), MIN_ZOOM, MAX_ZOOM);
    applyCameraFraming();
  }
}, { passive: false });

const raycaster = new THREE.Raycaster();
// Raycaster.layers defaults to layer 0 only and is checked in ADDITION
// to whatever explicit object list intersectObjects() is given -- since
// tray pieces now live on TRAY_LAYER (see the camera-layer comment
// above), a raycast against them would silently find nothing without
// this. The explicit pieceTargets/voidTargets lists already do the
// real filtering, so just accept every layer here rather than
// duplicating that logic on the raycaster's own mask.
raycaster.layers.enableAll();
const pointerNDC = new THREE.Vector2();

// Splits by region rather than one combined raycast against both
// cameras -- pieces only ever live in the tray viewport now, voids
// only ever live in the target viewport, so a tray tap need only ever
// test pieces and a target tap need only ever test voids. Simpler than
// the old single-camera version, not just relocated.
function handleTap(clientX, clientY, region) {
  if (region === 'tray') handleTrayTap(clientX, clientY);
  else handleTargetTap(clientX, clientY);
}

function screenToNDC(clientX, clientY, rect) {
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  return pointerNDC;
}

function handleTrayTap(clientX, clientY) {
  const rect = trayViewportRect();
  raycaster.setFromCamera(screenToNDC(clientX, clientY, rect), trayCamera);

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
  const hits = raycaster.intersectObjects(pieceTargets, false);
  if (hits.length === 0) return;
  const hitPiece = current.pieces.find((p) => p.mesh === hits[0].object);
  if (!hitPiece) return;

  if (current.state.selectedPieceId === hitPiece.id) {
    // A piece with no orientationOptions (Stage 3's pieces) has nothing
    // to flip -- flipPiece() is already a no-op for it, but skip the
    // rotation-target update too rather than calling
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
}

function handleTargetTap(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(screenToNDC(clientX, clientY, rect), camera);

  const voidTargets = current.voids.map((v) => v.hitTarget);
  const hits = raycaster.intersectObjects(voidTargets, false);
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
  // that's actually usable (an unfilled void that's valid when validity
  // is known) before falling back to the closest hit of any kind --
  // preserves the reject-flash for a genuine miss (nothing valid
  // anywhere along the ray) while no longer letting an invisible-ish
  // invalid/filled void silently eat a tap meant for something valid
  // behind it.
  const selectedId = current.state.selectedPieceId;
  const validity = selectedId ? voidValidityForPiece(current.state, selectedId) : null;
  const isUsableVoidHit = (obj) => {
    const v = current.voids.find((vv) => vv.hitTarget === obj);
    if (!v) return false;
    if (current.state.voids.find((sv) => sv.id === v.id).filled) return false;
    return validity ? Boolean(validity[v.id]) : true;
  };
  const bestHit = hits.find((h) => isUsableVoidHit(h.object)) || hits[0];
  const hitVoid = current.voids.find((v) => v.hitTarget === bestHit.object);
  if (!hitVoid) return;

  const previousState = current.state;
  const result = placeSelected(current.state, hitVoid.id);
  current.state = result.state;
  if (!result.placed) {
    flashRejectWire(hitVoid.wire);
    // The one rejection reason that isn't self-explanatory from the
    // void itself -- a wrong orientation or wrong shape is visible on
    // the piece the player is holding, but "blocked" depends on OTHER
    // pieces' own state, invisible without saying so explicitly.
    if (result.reason === 'blocked') {
      const blockedPiece = currentStatePiece(result.pieceId);
      const stillNeeded = blockedPiece.requiresPlacedFirst.filter((id) => !currentStatePiece(id).placed).length;
      flashTrayMessage(`Needs ${stillNeeded} other piece${stillNeeded === 1 ? '' : 's'} placed first`, 1800);
    }
    return;
  }
  current.history.push(previousState);
  updateUndoButton();

  const placedPiece = pieceById(result.pieceId);
  // A loose piece snaps to the one void it was tapped onto; a fused
  // piece (Stage 5) snaps to its GROUP's own shared placement instead
  // (e.g. the cube's own center, identity rotation) -- it's a single
  // physical object standing in for every void it just filled at once,
  // not oriented to any one of them. `result.targetGroupId` (not
  // `placedPiece.fillsGroup`) -- an interchangeable piece's own
  // `fillsGroup` is just the ANY_SINGLE_CELL_GROUP sentinel, not a real
  // group id; `targetGroupId` is whichever group placeSelected() ACTUALLY
  // resolved and filled.
  const target = placedPiece.fillsGroup
    ? current.groups.find((g) => g.id === result.targetGroupId)
    : hitVoid;
  // Reparent tray -> skeleton (Object3D.add() detaches from its current
  // parent automatically) so this piece rotates together with the rest
  // of the assembled shape from now on, instead of staying pinned to
  // the tray's fixed position in world space.
  current.skeletonGroup.add(placedPiece.mesh);
  placedPiece.mesh.layers.set(0); // visible to the target camera now, not TRAY_LAYER
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

  const justSolved = isSolved(current.state);
  if (!justSolved) flashTrayPlaced(); // the "Solved!" banner is already strong enough feedback on its own
  if (justSolved) advanceOrFinish();
}

function animate() {
  requestAnimationFrame(animate);
  if (current) {
    for (const p of current.pieces) {
      if (p.id === orientDragPieceId) continue; // uncontested drag control -- see the drag handler's own comment
      const sp = currentStatePiece(p.id);
      if (sp && !sp.placed && sp.orientation) {
        // The piece's own intrinsic orientation, in LOCAL space -- no
        // longer composed with a parent group's rotation by hand (real
        // live report 2026-09-03, "genuinely aligned spaces dont light
        // up as you rotate", needed that composition back when unplaced
        // pieces were loose children of `scene`). Now that every
        // unplaced piece is a real child of `trayGroup`, rotating
        // trayGroup already composes its children's world rotation
        // automatically via the ordinary scene graph -- exactly how a
        // PLACED piece (a child of skeletonGroup) already worked, no
        // special case needed for either anymore.
        const desired = quaternionForOrientationKey(sp.orientation);
        p.mesh.quaternion.slerp(desired, ROTATION_DAMPING);
      } else {
        const target = p.mesh.userData.targetQuaternion;
        if (target) p.mesh.quaternion.slerp(target, ROTATION_DAMPING);
      }
    }
  }

  // Two scissored passes, one shared renderer/scene -- the target gets
  // the full screen, the tray overlays a fixed top-right corner on top
  // of it (direct instruction "picker pieces should be top right").
  // setViewport/setScissor/clear all take LOGICAL (CSS) pixel
  // coordinates -- WebGLRenderer applies its own tracked pixelRatio
  // internally before touching the actual drawing buffer, so passing
  // already-multiplied device-pixel values here double-scales
  // everything. Real bug, live report (2026-09-04, "shape appears half
  // out of shot in upper right and cant be coaxed down"): every call
  // below used to be pre-multiplied by `renderer.getPixelRatio()`,
  // which silently doubled on any real device with pixelRatio > 1 --
  // completely invisible in desktop testing (pixelRatio 1, so doubling
  // was a no-op) and only surfaced testing a real mobile viewport +
  // device scale factor. The full-screen target pass masked its own
  // half of the bug too: an oversized full-screen rect still covers the
  // whole canvas, so only the tray -- a small sub-rect that actually
  // needs to land in the RIGHT place -- showed any visible symptom.
  // Confirmed via `gl.getParameter(gl.VIEWPORT)`: the actual GL state
  // was exactly 2x the intended tray rect and extended past the real
  // drawing buffer's own width/height entirely.
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.clear();

  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

  const rect = trayViewportRect();
  const trayX = rect.left;
  const trayY = window.innerHeight - rect.top - rect.height; // CSS top-down -> WebGL bottom-up
  renderer.setViewport(trayX, trayY, rect.width, rect.height);
  renderer.setScissor(trayX, trayY, rect.width, rect.height);
  renderer.clearDepth(); // depth only -- the target's own depth values must not bleed into the tray's, but its
  // COLOR should: direct instruction (2026-09-04, "still view part of
  // target shape through picker tray in the background, so shape is
  // completer... but not interfere with it") -- the target's own
  // already-rendered pixels are left in place as a backdrop (autoClear
  // would otherwise wipe them to plain background here, same as it
  // already did for the color clear at the top of this function),
  // dimmed by the tray panel's own translucent DOM background
  // (`rgba(8,10,16,0.35)` in rhombis.html) so the target's outline
  // reads through continuously behind the tray rather than being cut
  // off by a hard black box. The tray's own pieces still draw fully
  // opaque on top either way (a real depth clear + normal depth test
  // against THEIR OWN fresh values), so they're never dimmed or
  // visually mixed with the target showing through around them.
  renderer.autoClearColor = false;
  renderer.render(scene, trayCamera);
  renderer.autoClearColor = true; // restore for the next frame's own full-screen target clear

  renderer.setScissorTest(false);
}

loadStage(stageIndex);
syncTrayPanel();
animate();
