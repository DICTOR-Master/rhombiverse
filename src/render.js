// Three.js scene, camera, RD mesh generation, instanced rendering, and most
// app orchestration. See RHOMBIVERSE_PLAN.md section 4 for the phase history.
// Full design rationale/history for the code below: docs/code-notes/render.md
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rdRawVerts, cellToWorld, nearestValidCell, isValidCell, cellKey, pyramidPieces, rdQuarterPieces, cellsInShells, cuboctahedronVertices, octGapVertices, hemisphereSplit, NEIGHBOR_OFFSETS } from './core/lattice.js';
import { FULL_PYRAMIDS, presentAxisKeys, hasCube, effectivePyramids } from './core/pyramid.js';
import { createRhombicWheel3D } from './app/rhombic-wheel-3d.js';
import { createAlmanac } from './app/almanac.js';
import { getDual, DUAL_DIRS, snapToDual } from './core/dual.js';
import { bccShapeScaleFor } from './geometry-extensions/bcc-detail-lattice.js';
import { truncatedOctahedronVertices, nearestBCCPoints, nearestFCCPoints, BCC_NEIGHBOR_OFFSETS } from './geometry-extensions/dual-lattice.js';
import { createCuboctaBuildController, AXIS_OFFSETS as CUBOCTA_AXIS_OFFSETS } from './core/cubocta-build.js';
import { createCuboctaGapBuildController, octGapCellToWorld, octGapCellForCOCell } from './core/cubocta-gap-build.js';
import { createInterstitialStore } from './core/interstitial-build.js';
import { createHemisphereStore } from './core/hemisphere-build.js';
import { bootstrapDisphenoid, disphenoidVertsToWorld, octahedronDisphenoids } from './geometry-extensions/interstitial-lattice.js';
import { sampleSuperellipsoidGrid, volumeMatchedRadius } from './geometry-extensions/spherical-toggle.js';
import { SKELETON_COLOR } from './app/rhombic-wheel-3d-core.js';
import { createDimensionWizard } from './app/dimension-wizard.js';
import { elongatedDodecahedronVerts, elongDodecaCellToWorld } from './geometry-extensions/elongated-dodecahedron.js';
import { hexPrismVerts, hexCellToWorld, HEX_NEIGHBOR_OFFSETS } from './geometry-extensions/hex-prism.js';
import { NAMED_LATTICE_ANGLES, LATTICE_2D_COMBINATIONS, LATTICE_PRIMITIVES, LATTICE_PRIMITIVE_IMPLS, latticeBasis } from './geometry-extensions/lattice-2d.js';
import { rhombohedraTileVerts, rhombohedraCellToWorld } from './geometry-extensions/rhombohedra-lattice.js';
import { FEATURES } from './app/features.js';
import {
  generateSubLattice,
  generateSubLatticeAt,
  SUB_LATTICE_MAX_SHELL,
  cumulativeCellCount,
  subScaleFactor,
  selectNearbyCells,
  selectNearbyByWorldPosition,
  MAX_LOD_DEPTH,
  levelTriggerDistance,
  blendFactor,
  SUB_LATTICE_THROTTLE_BASE_MS,
  nextVolatilityScore,
  throttleForVolatility,
} from './geometry-extensions/latticezoom.js';
import { loadWorld, createWorldStore } from './core/worldstate-core.js';
import { createBuildController, removeShell, recolorShell } from './core/build.js';
import { getSettings, updateSettings, onSettingsChange, QUALITY_PIXEL_RATIO_FACTOR, QUALITY_LEVELS_ASCENDING } from './app/settings.js';
import { t, LANG_ORDER, LANG_META } from './app/i18n.js';
import { playPlaceSound, playRemoveSound, playMenuSound } from './app/sfx.js';
import { createWheelPickers } from './app/wheel-pickers.js';
import { MARKS, iconFrame, swatchMark } from './app/wheel-icons.js';
import { createHudWheel3D } from './app/hud-wheel-3d.js';
import { createCyborgMode } from './app/cyborg.js';
import { requestBYOKJson } from './app/byok.js';
import {
  MIRROR_PLANES,
  createSculptureSession,
  sculptStroke,
  updateSemiCyborgSuggestion,
  acceptSuggestion as acceptSculptSuggestion,
  dismissSuggestion as dismissSculptSuggestion,
  parseFullCyborgIntent,
  requestFullCyborgIntent,
  canFullCyborgEditAt,
  executeFullCyborgIntent,
  applyDualSymmetry,
  applyFullSymmetry,
  shellBrushCells,
} from './core/sculpture.js';
import { matchNeighborOffset } from './core/build.js';
import { saveCameraState, loadCameraState } from './app/camera-persistence.js';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  exportWorldFile,
  importWorldFile,
  BCC_STORAGE_KEY,
  INTERSTITIAL_STORAGE_KEY,
  CUBOCTA_STORAGE_KEY,
  CUBOCTA_GAP_STORAGE_KEY,
  HEMISPHERE_STORAGE_KEY,
  ELONGDODECA_STORAGE_KEY,
  HEXPRISM_STORAGE_KEY,
  lattice2dStorageKey,
  RHOMBOHEDRA_STORAGE_KEY,
} from './core/persistence.js';
import {
  compressionSupported,
  encodeWorldForUrl,
  decodeWorldFromUrl,
  buildShareUrl,
  getSharedWorldParam,
  clearSharedWorldParam,
} from './app/worldshare.js';
import { VALID_TRIPLES, unitTileVertices } from './geometry-extensions/growth.js';
// World-building/game systems (mining, trade, claims, achievements,
// animals, hazards, hydrosphere, gravity/planetoids, growth/evolution/
// cultivation, walking/exploring, Shared World sync) were retired and
// their code archived to world-systems-archived/ -- see README.md.

const SCALE = 1;
// Hex Prism: no special proportion is required for a plain hex-prism
// tiling (any height works, unlike Elongated Dodecahedron's own derived
// h) -- these are a deliberate, honestly-arbitrary aesthetic choice
// (roughly SCALE-sized), not a derived constant.
const HEX_PRISM_R = SCALE;
const HEX_PRISM_H = Math.sqrt(3) * SCALE;
// 2D lattice tier (Phase 3): matches SCALE for visual consistency with
// everything else -- no special proportion required (same reasoning as
// hex prism's own height above), shared by every (angle, primitive)
// combination in LATTICE_2D_COMBINATIONS.
const LATTICE2D_S = SCALE;
// 2D tiles read as genuinely flat, direct instruction 2026-09-23 ("make
// 2D seem more 2D... show only 2D plane"): a near-zero tile height still
// renders a real, visible top/bottom face pair + edge sliver (not a
// literal zero-thickness plane, which would z-fight and produce zero
// normal-based lighting), but reads as a flat tile rather than a puck.
// Attachment direction-matching never depended on this height in the
// first place -- handleLattice2dClick (build.js) uses the hit point's
// own in-plane offset from the cell's world center (see its own
// header), not the tile's side-face normals, so shrinking this doesn't
// touch click behavior at all.
const LATTICE2D_H = 0.03 * SCALE;
// One seed color PER combination (12 of MATERIAL_COLORS' 14 keys below
// -- everything except 'base' itself and 'blackstar-glassite', whose
// near-black tone reads poorly against the scene's own dark background)
// -- direct correction, 2026-09-23 ("dull colors to start with for
// shapes"): every seed used to hardcode 'base' (a flat gray), so all 12
// combinations' own first tile looked identical and unremarkable. Plain
// string keys, not a reference to MATERIAL_COLORS itself (declared much
// later in this file) -- this only needs to name them, not look up
// their values.
const LATTICE2D_SEED_COLORS = ['garnet', 'ferrostone', 'glassite', 'star-glassite', 'ice99', 'water', 'emerald', 'gold', 'amethyst', 'rose-quartz', 'citrine', 'turquoise'];
// Rhombohedra (free lattice): same real scale as everything else -- a
// genuine 3D solid, no special height/thinness constant needed.
const RHOMBOHEDRA_S = SCALE;
const MAX_CELLS = 20000; // fixed InstancedMesh capacity, see docs/code-notes/render.md

// Performance guardrail (reframe Stage 6): warn before loading a World
// large enough to risk a real slowdown on lower-power hardware (this
// app is played on a Raspberry Pi) -- not a hard block, just a heads-up
// with a chance to back out, matching the confirm()-gated pattern
// already used for every other destructive world-replace action here.
// Well above realistic normal use (the built-in Showcase World is 459
// cells) but with real headroom below MAX_CELLS, so it only fires for
// genuinely oversized imports/presets, not everyday structures.
const LARGE_WORLD_CELL_WARNING_THRESHOLD = 5000;
function confirmLargeWorldLoad(worldJSON) {
  const cellCount = Object.keys(worldJSON.cells ?? {}).length;
  if (cellCount <= LARGE_WORLD_CELL_WARNING_THRESHOLD) return true;
  return confirm(
    `This World has ${cellCount.toLocaleString()} cells, which may run slowly on lower-power devices. Load it anyway?`
  );
}
const MAX_SHELL = 15; // enforced cap on shell-count UI inputs, see docs/code-notes/render.md

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);

// B4b: standalone Sculpture Mode -- "a fresh, fully isolated lattice
// space: no connection to the player's claim, no authorId, no
// moderation state, no persistence in shared world-state." A genuinely
// separate THREE.Scene (not a swap of `scene`'s own contents), so it
// never touches the dozens of scene.add() call sites the main world
// already has scattered through init() (gravity/claims/organisms/
// asteroids/etc. -- none of which apply to a bare scratch lattice
// anyway). The render loop (animate(), bottom of this file) picks
// whichever scene sculptureModeActive selects; camera/renderer/
// OrbitControls are reused as-is since they're scene-agnostic.
const sculptureScene = new THREE.Scene();
sculptureScene.background = new THREE.Color(0x0a0a14);
sculptureScene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sculptureSun = new THREE.DirectionalLight(0xffffff, 1.2);
sculptureSun.position.set(5, 8, 4);
sculptureScene.add(sculptureSun);
let sculptureModeActive = false;
let sculptureWorld = null; // created lazily, first time Sculpture Mode is entered
let sculptureMesh = null; // created inside init(), once geometry/material exist

// Model vs. World Separation (reframe Stage 2): a live, in-session toggle
// over the SAME data -- not a new file/schema (RHOMBIVERSE_PLAN.md's
// "world is data" rule) and not the reload-requiring pureGeometry/
// Rhombeometry setting (that's a session-startup choice of which SYSTEMS
// exist at all; this is a live pause on the ones that do). Default
// 'world' preserves today's always-simulating behavior unchanged for
// anyone who never touches the new toggle.
let workspaceMode = 'world';
// Bridges init()-scoped wheel3D.refresh() out to wireSettingsPanel()'s IIFE
// below, which runs at module-eval time before init() (and wheel3D) exist.
let refreshWheel3D = () => {};
// Dimension-select wizard (2026-09-22): which dimension tier the app is
// currently in ('3D' the only real value in Phase 1; null before a
// choice is made, which only ever happens for the instant between page
// load and init() force-opening WHEEL_DIMENSION -- see init()'s own
// "auto-open to dimension wheel" comment). In-memory only, never
// persisted -- every fresh load starts back at the dimension-select
// wheel, same "UI state, not world state" convention this app already
// applies to every other transient screen.
let activeDimension = null;

const camera = new THREE.PerspectiveCamera(
  getSettings().fov,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(6, 5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio * QUALITY_PIXEL_RATIO_FACTOR[getSettings().quality]);
document.getElementById('fps-meter')?.classList.toggle('visible', getSettings().showFPSMeter);
renderer.localClippingEnabled = true; // required once, globally, for any clippingPlanes to take effect
document.getElementById('app').appendChild(renderer.domElement);

// The persistent HUD wheel replacing the old 9-button icon row --
// shares this same renderer via its own scissor sub-viewport every
// frame (see hud-wheel-3d.js's own header comment for why: a second
// full WebGLRenderer, always running, would make the exact perf
// mistake this session already found and fixed for the modal wheel).
const hudWheel = createHudWheel3D(renderer, {
  getBackgroundColor: () => (sculptureModeActive ? sculptureScene.background : scene.background),
});

// Touch/drag-only rotation, scoped to the wheel's own small on-screen
// rect -- no auto-rotate, no idle timer, matching "rotates to touch
// only, always there" exactly. Same drag-vs-click disambiguation the
// modal wheel uses (a real click must not have moved past a small
// threshold), same reason: a native 'click' fires after any
// mousedown->mouseup pair regardless of movement in between.
{
  let hudDragging = false;
  let hudLastPointer = null;
  let hudDragDistance = 0;
  let controlsEnabledBeforeHudDrag = true;
  const HUD_DRAG_CLICK_SUPPRESS_PX = 5;

  function withinHudRect(clientX, clientY) {
    const r = hudWheel.getRect();
    return clientX >= r.cssX && clientX <= r.cssX + r.cssW && clientY >= r.cssY && clientY <= r.cssY + r.cssH;
  }

  // A drag starting on the HUD wheel's own on-screen rect also lands on
  // OrbitControls (bound to the same canvas underneath) since these are
  // separate listeners on the same event, not a delegated one -- with
  // nothing here to yield the mouse, both the widget AND the real camera
  // rotated in lockstep on every drag (found live on iPad/iPhone touch,
  // reproduced with a synthetic touch-pointer drag over the HUD rect;
  // the underlying cause -- two independent listeners on one event -- is
  // not touch-specific, same "yield the mouse" pattern already used for
  // the X-Ray TransformControls drag below). Saving/restoring the PRIOR
  // enabled state (not hardcoding true) avoids fighting whatever set it,
  // e.g. Walk Mode's own controls.enabled = false while walking.
  window.addEventListener('pointerdown', (ev) => {
    if (!withinHudRect(ev.clientX, ev.clientY)) return;
    hudDragging = true;
    hudDragDistance = 0;
    hudLastPointer = { x: ev.clientX, y: ev.clientY };
    controlsEnabledBeforeHudDrag = controls.enabled;
    controls.enabled = false;
  });
  window.addEventListener('pointermove', (ev) => {
    if (!hudDragging || !hudLastPointer) return;
    const dx = ev.clientX - hudLastPointer.x;
    const dy = ev.clientY - hudLastPointer.y;
    hudDragDistance += Math.hypot(dx, dy);
    hudLastPointer = { x: ev.clientX, y: ev.clientY };
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.012);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.012);
    hudWheel.group.quaternion.premultiply(qx).premultiply(qy);
  });
  window.addEventListener('pointerup', () => {
    if (hudDragging) controls.enabled = controlsEnabledBeforeHudDrag;
    hudDragging = false;
  });
  window.addEventListener('click', (ev) => {
    if (!withinHudRect(ev.clientX, ev.clientY)) return;
    if (hudDragDistance > HUD_DRAG_CLICK_SUPPRESS_PX) return;
    const key = hudWheel.pickFace(ev.clientX, ev.clientY);
    if (!key) return;
    const entry = hudWheel.faceEntries.find((e) => e.key === key);
    if (!entry?.data) return;
    document.getElementById(entry.data.elId)?.click();
  });
}

// Section view: a single cutaway clipping plane through the whole scene
// (RHOMBIVERSE_PLAN.md doesn't cover this -- added at the user's request
// so the shell system, previously invisible from outside a solid
// structure, can actually be seen and understood). Disabled by default
// (empty clippingPlanes array); #section-enable populates
// material.clippingPlanes with this same Plane object, so mutating its
// normal/constant here is picked up automatically next frame with no
// separate "apply" step.
const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
function updateSectionPlane() {
  const axis = document.getElementById('section-axis').value;
  const flip = document.getElementById('section-flip').checked;
  const pos = Number(document.getElementById('section-pos').value) || 0;
  // The plane's own position (a point on it) is always `pos` along the
  // chosen axis, regardless of flip -- only the normal direction (which
  // side gets kept vs. clipped) should change when flipping, not where
  // the plane physically sits.
  const axisVec = new THREE.Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0
  );
  const pointOnPlane = axisVec.clone().multiplyScalar(pos);
  const normal = flip ? axisVec.clone().negate() : axisVec.clone();
  sectionPlane.setFromNormalAndCoplanarPoint(normal, pointOnPlane);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.rotateSpeed = getSettings().sensitivity;
// Right-click is reserved for block removal (build.js), not camera pan.
controls.mouseButtons.RIGHT = null;
const ORBIT_LEFT_DEFAULT = controls.mouseButtons.LEFT;

// Resume the view where it was left last session, instead of always
// resetting to the fixed default spawn -- fixes a real bug this fed
// into: the BCC dual-lattice preview (bcc-detail-lattice.js) seeds
// itself from controls.target (see rebuildLatticeQuickView's own
// refPos), so with no restore here, toggling BCC back on next session
// always reseeded from the DEFAULT (0,0,0) view rather than wherever you
// were actually standing/looking when you last built against it -- the
// two would drift apart with no way to tell why. Doesn't touch
// scheduleLatticeQuickViewRefresh's deliberate live camera-follow while
// a hypothetical-lattice mode stays active within a session -- that's a
// separate, already-requested behavior (see that function's own header)
// and this doesn't change it.
{
  const savedCam = loadCameraState();
  if (savedCam) {
    camera.position.set(...savedCam.position);
    controls.target.set(...savedCam.target);
    controls.update();
  }
}
// Saved on a real interaction boundary (OrbitControls' own 'end' event,
// not 'change' -- 'change' fires every frame mid-drag, 'end' once per
// gesture), a low-frequency fallback interval (covers walk-mode
// movement, which never fires OrbitControls events), and beforeunload
// as a last-moment safety net. Skips Sculpture Mode's own temporary
// scratch-space camera (see enterSculptureMode's own savedCameraState)
// -- that view has nothing to do with the main world and would
// otherwise clobber the real saved position with a scratch-space one.
function persistCameraState() {
  if (sculptureModeActive) return;
  saveCameraState(camera.position, controls.target);
}
controls.addEventListener('end', persistCameraState);
window.addEventListener('beforeunload', persistCameraState);
setInterval(persistCameraState, 3000);

// Dimension-scoped camera (2026-09-23): direct instruction ("make 2D
// seem more 2D... show only 2D plane"). A thin flat tile still reads as
// a 3D puck from this app's normal angled orbit view (confirmed via
// direct screenshot: hexagon tiles showed visible side faces even at
// LATTICE2D_H=0.03) -- tile thinness alone was never going to fix that,
// the VIEW itself needed to go flat too. Every 2D lattice combination
// (lattice-2d.js) pins world Z to 0 and extrudes tile thickness along Z
// (see parallelogramTileVerts' own header: "height h
// along the scene's own Z axis"), so a true top-down 2D view means
// looking straight down the Z axis, not the Y axis camera.position.set
// (6,5,8)'s default orbit implies. Locks rotation entirely (not just a
// polar-angle clamp -- OrbitControls' polar angle is measured from its
// object.up, (0,1,0) by default, which doesn't correspond to "flat
// along Z" in any simple min/max range) while in 2D; pan/zoom stay
// free. Save/restore follows the exact same pattern enterSculptureMode/
// exitSculptureMode already use for their own temporary camera pose.
const saved3DCameraState = { position: new THREE.Vector3(), target: new THREE.Vector3() };
let cameraSavedFor2D = false;
function applyDimensionCamera(dimension) {
  // Direct follow-up, same day: "2D shouldnt revolve should just stay
  // flat planar movement only" -- enableRotate=false alone (below)
  // already stops any actual rotation, but left it with NO drag gesture
  // bound at all (LEFT was still mapped to the now-inert ROTATE action),
  // reading as "nothing moves," not "flat planar movement." Remaps LEFT
  // to PAN in 2D instead, so a drag slides the flat view around, then
  // restores ORBIT_LEFT_DEFAULT (rotate) on the way back to 3D. Guarded
  // by `!== null`: Drag Placement mode (pickers' own onDragPlacementChange)
  // sets LEFT to null while active, and this must never clobber that.
  if (dimension === '2D') {
    if (!cameraSavedFor2D) {
      saved3DCameraState.position.copy(camera.position);
      saved3DCameraState.target.copy(controls.target);
      cameraSavedFor2D = true;
    }
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 12);
    controls.enableRotate = false;
    if (controls.mouseButtons.LEFT !== null) controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.update();
  } else {
    controls.enableRotate = true;
    if (controls.mouseButtons.LEFT !== null) controls.mouseButtons.LEFT = ORBIT_LEFT_DEFAULT;
    if (cameraSavedFor2D) {
      camera.position.copy(saved3DCameraState.position);
      controls.target.copy(saved3DCameraState.target);
      cameraSavedFor2D = false;
      controls.update();
    }
  }
}

// B3 (Cyborg Mode, RHOMBIVERSE_UIUX_BUILD_PLAN.md): the 'cameraRotated'
// success-condition event a first-build-session subscript step listens
// for. OrbitControls' own 'change' event fires identically for rotate/
// zoom/pan with no way to tell them apart, so this tracks a real
// left-button drag directly instead -- dispatched globally (not scoped
// to cyborg.js) since it's a real, generically useful signal, same
// spirit as build.js's onPlaced/onHover callbacks.
let camRotateStart = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) camRotateStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (!camRotateStart) return;
  const moved = Math.hypot(e.clientX - camRotateStart.x, e.clientY - camRotateStart.y);
  if (moved > 6) {
    window.dispatchEvent(new CustomEvent('rhombiverse:cameraRotated'));
    camRotateStart = null; // one dispatch per drag gesture is enough
  }
});
window.addEventListener('pointerup', () => {
  camRotateStart = null;
});

// UI-chrome translations (src/app/i18n.js), Phase 1 scope only -- see
// that file's own header for exactly what's covered/deferred. Applies
// every element tagged data-i18n/-title/-placeholder/-html; the
// handful of JS-only dynamic strings this file sets directly (walk-
// toggle, shared-world toggle/hint, recolor button, gallery/share
// hints) call t() at their own assignment site instead, since their
// text depends on live STATE, not just the current language. Called
// once at module load and again whenever the language setting changes.
function applyTranslations() {
  const lang = getSettings().language;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, lang); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle, lang); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder, lang); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml, lang); });
}
applyTranslations();

// One <option> per LANG_ORDER entry, generated here rather than
// hand-written in index.html so it can never drift from the
// dictionary's own language list.
const languageSelect = document.getElementById('setting-language');
if (languageSelect) {
  languageSelect.innerHTML = LANG_ORDER.map((code) => `<option value="${code}">${LANG_META[code].native}</option>`).join('');
  languageSelect.value = getSettings().language;
  languageSelect.addEventListener('change', () => {
    updateSettings({ language: languageSelect.value });
  });
}

// Settings panel (B1, behind the Lab entry point) -- applies live, no
// page reload needed. Quality only affects pixel ratio for now (WebGL
// antialiasing can't be toggled after the renderer is created).
onSettingsChange((s) => {
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  controls.rotateSpeed = s.sensitivity;
  renderer.setPixelRatio(window.devicePixelRatio * QUALITY_PIXEL_RATIO_FACTOR[s.quality]);
  document.getElementById('fps-meter')?.classList.toggle('visible', s.showFPSMeter);
  applyTranslations();
  if (languageSelect && languageSelect.value !== s.language) languageSelect.value = s.language;
});

// Walk mode (RHOMBIVERSE_PLAN.md Phase 5.5) was archived 2026-09-22
// (second world-building removal pass) along with gravity/planetoids --
// `walking` is kept, permanently false, since a number of unrelated
// mode guards elsewhere (Duality/Sculpt/Cuboctahedron) still read it
// defensively; nothing sets it true anymore, so those guards are
// harmless no-ops now rather than load-bearing. `player` (the walk
// controller) had no other consumer, so it's gone entirely.
let walking = false;
// Assigned inside init() once updateHudIndicator exists there.
let refreshHudIndicator = () => {};

// Assigned once the Rhombic Wheel 3D is created (feature-flagged, see
// init()). animate()'s main render loop checks this to skip its own
// renderer.render() call while the wheel's own overlay/renderer fully
// covers the screen -- avoids two simultaneous full-scene WebGL
// renders every frame for a pass that's provably invisible anyway.
let isRhombicWheel3DOpen = () => false;

// Module-level (not init()-local) since enterWalk/exitWalk, defined
// before init() runs, need it too -- has no dependency on any init()
// closure, just a DOM element and a timer.
let hudPromptTimer = null;
function showHudPrompt(text, ms = 4000) {
  const el = document.getElementById('hud-prompt');
  if (!el) return;
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(hudPromptTimer);
  // Real, live-investigated confusion (2026-09-03): this only ever
  // toggled the 'visible' class, never cleared textContent -- #hud-
  // prompt has no opacity/fade transition (just display:block/none, see
  // index.html), so there's no animation to interrupt. A successful
  // Add/Remove shows no prompt of its own (success is silent), so an
  // earlier failure's message could otherwise sit in the DOM
  // indefinitely and read as if it described whatever the player just
  // did, well after it had actually faded from view.
  hudPromptTimer = setTimeout(() => {
    el.classList.remove('visible');
    el.textContent = '';
  }, ms);
}

// The HUD's icon-only toggles (Duality, Sculpture Mode, Cyborg, X-Ray,
// Lab) rely on a hover `title` for their label -- real on desktop, but
// titles don't exist on touch at all, so a first-time tap is a total
// guess there. Explains itself via the same toast every other hint in
// this file already uses, once per toggle, the first time it's used
// (hover for a mouse, tap for touch -- whichever fires first).
const HINT_SEEN_KEY = 'rhombiverse-hud-hints-seen';
function loadSeenHints() {
  try { return new Set(JSON.parse(localStorage.getItem(HINT_SEEN_KEY)) || []); }
  catch { return new Set(); }
}
const seenHints = loadSeenHints();
function wireFirstUseHint(elementId, text) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const reveal = () => {
    if (seenHints.has(elementId)) return;
    seenHints.add(elementId);
    localStorage.setItem(HINT_SEEN_KEY, JSON.stringify([...seenHints]));
    showHudPrompt(text, 4500);
  };
  el.addEventListener('mouseenter', reveal);
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') reveal(); });
}
const LOCAL_PLAYER_ID = 'local-player'; // fallback ownerId for solo play (no multiplayer identity exists), see notes

const labToggleEl = document.getElementById('lab-toggle');
const labPanelEl = document.getElementById('lab-panel');

function closeMobilePanels() {
  labPanelEl.classList.remove('open');
}

labToggleEl.addEventListener('click', () => {
  labPanelEl.classList.toggle('open');
});
// Direct report 2026-08-29: unlike Sculpt/Cultivate/Interact/Gallery,
// the Lab panel had no close (✕) button of its own -- the only way to
// close it was re-tapping the gear icon that opened it, easy to miss
// especially on touch. Matches the same close-button convention/markup
// (#lab-header/#lab-close) those other panels already use.
document.getElementById('lab-close')?.addEventListener('click', () => {
  labPanelEl.classList.remove('open');
});

// See docs/code-notes/render.md
let cyborgWorldRef = null;
function buildCyborgWorldSummary() {
  if (!cyborgWorldRef) return 'Nothing built yet.';
  const cells = cyborgWorldRef.entries();
  const materialCounts = {};
  for (const cell of cells) materialCounts[cell.material] = (materialCounts[cell.material] ?? 0) + 1;
  const materialList = Object.entries(materialCounts).map(([m, n]) => `${n} ${m}`).join(', ') || 'nothing yet';
  const seeds = Object.values(cyborgWorldRef.getSeeds());
  const speciesList = [...new Set(seeds.map((s) => s.species))].join(', ');
  const organismCount = Object.keys(cyborgWorldRef.getOrganisms()).length;
  let text = `${cells.length} blocks built (${materialList}).`;
  text += seeds.length > 0 ? ` ${seeds.length} planted seed(s): ${speciesList}.` : ' Nothing planted yet.';
  if (organismCount > 0) text += ` ${organismCount} living organism(s) present.`;
  return text;
}

// Kept in sync with api/cyborg-suggest.js's own copy -- see docs/code-notes/render.md
const CYBORG_SUGGEST_SYSTEM_PROMPT = `You are a creative building companion for Rhombiverse, a spatial editor where every block is a rhombic dodecahedron.

Given a short description of what someone has already built, suggest ONE small, concrete, achievable next thing for them to build or plant -- something more interesting than "place another block", but still doable in a few minutes. Name a shape, direction, or technique (e.g. "try a mirrored arch to the east", "plant a conifer near your fern for a mixed grove", "hollow out the center and add windows"). Keep it under 140 characters, friendly, and specific to what they've actually built so far -- don't suggest something they've clearly already done. Never mention that you are an AI.

Respond with a JSON object with exactly one field: suggestion (string, <140 chars).`;

const LOCAL_CYBORG_SUGGESTIONS = [
  'Try building a small dome and see how it looks from inside.',
  "Plant something new near what's already grown -- see how the species interact.",
  "Add a mirrored wing to double a shape you've already built.",
  "Walk to the edge of what you've built and extend it in a new direction.",
  'Try a different material for the next few blocks -- see how the color changes the feel of the shape.',
  'Hollow out part of a solid structure and see what it looks like from inside.',
];
let lastLocalCyborgSuggestion = -1;
function pickLocalCyborgSuggestion() {
  if (LOCAL_CYBORG_SUGGESTIONS.length === 1) return LOCAL_CYBORG_SUGGESTIONS[0];
  let i;
  do {
    i = Math.floor(Math.random() * LOCAL_CYBORG_SUGGESTIONS.length);
  } while (i === lastLocalCyborgSuggestion);
  lastLocalCyborgSuggestion = i;
  return LOCAL_CYBORG_SUGGESTIONS[i];
}

async function getCyborgSuggestion() {
  const summary = buildCyborgWorldSummary();
  try {
    const decision = await requestBYOKJson(CYBORG_SUGGEST_SYSTEM_PROMPT, summary);
    if (decision?.suggestion) return decision.suggestion;
  } catch (err) {
    console.warn('Rhombiverse: personal AI key call failed for Cyborg suggestion, trying the shared AI Gateway instead', err);
  }
  try {
    const res = await fetch('/api/cyborg-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    });
    if (!res.ok) throw new Error(`cyborg-suggest API returned ${res.status}`);
    const data = await res.json();
    if (!data.suggestion) throw new Error('no suggestion in response');
    return data.suggestion;
  } catch (err) {
    console.warn('Rhombiverse: Cyborg suggestion AI Gateway call failed, using a local suggestion instead', err);
    return pickLocalCyborgSuggestion();
  }
}

const cyborgMode = createCyborgMode({ getSuggestion: getCyborgSuggestion });
const cyborgToggleEl = document.getElementById('cyborg-toggle');
cyborgToggleEl.addEventListener('click', async () => {
  await cyborgMode.toggle();
  cyborgToggleEl.classList.toggle('active', cyborgMode.isEnabled());
});

// B6 onboarding sequence removed 2026-09-22 -- narrated Full World/game
// content (an "already-built World," "growing life", other players) that
// no longer exists; its own enable() call was already permanently
// unreachable (gated on !pureGeometry, which settings.js forces true
// unconditionally). data/cyborg-archived/onboarding.json (moved there, narrated retired game content).

// See docs/code-notes/render.md
let pendingPersonaChoice = null;
let applyPersonaChoiceFn = null;
window.addEventListener('rhombiverse:personaChosen', (e) => {
  if (applyPersonaChoiceFn) applyPersonaChoiceFn(e.detail.persona);
  else pendingPersonaChoice = e.detail.persona;
});

// Settings inputs (Lab panel only, per B1) -- initialized from whatever
// was last saved/defaulted in settings.js, then pushed back on any change.
(function wireSettingsPanel() {
  const s = getSettings();
  const sensitivityInput = document.getElementById('setting-sensitivity');
  const invertYInput = document.getElementById('setting-invert-y');
  const fovInput = document.getElementById('setting-fov');
  const qualitySelect = document.getElementById('setting-quality');
  const volumeInput = document.getElementById('setting-volume');
  sensitivityInput.value = s.sensitivity;
  invertYInput.checked = s.invertY;
  fovInput.value = s.fov;
  qualitySelect.value = s.quality;
  volumeInput.value = s.volume;
  sensitivityInput.addEventListener('input', () => updateSettings({ sensitivity: Number(sensitivityInput.value) }));
  invertYInput.addEventListener('change', () => updateSettings({ invertY: invertYInput.checked }));
  fovInput.addEventListener('input', () => updateSettings({ fov: Number(fovInput.value) }));
  qualitySelect.addEventListener('change', () => updateSettings({ quality: qualitySelect.value }));
  volumeInput.addEventListener('input', () => updateSettings({ volume: Number(volumeInput.value) }));

  // Performance guardrail (reframe Stage 6): the meter's own visibility
  // is opt-in; applied live via the onSettingsChange subscriber below
  // (same pattern as pixel ratio), not just here, so it also reflects a
  // setting change from any other future entry point.
  const fpsMeterInput = document.getElementById('setting-fps-meter');
  fpsMeterInput.checked = s.showFPSMeter;
  fpsMeterInput.addEventListener('change', () => updateSettings({ showFPSMeter: fpsMeterInput.checked }));

  // Rhombeometry mode's Settings checkbox is gone -- World Systems are
  // retired (see features.js/settings.js), there's no longer a real
  // choice to expose here.

  // Model vs. World Separation (reframe Stage 2): unlike pureGeometry
  // above, this is a live, no-reload toggle. Originally gated the whole
  // simulation heartbeat (growth/evolution/gravity ticks); those systems
  // were archived 2026-09-22 (second world-building removal pass) along
  // with the heartbeat itself, so this toggle now only gates Cuboctahedron
  // Build (WORLD_ONLY_FACE_ACTIONS, rhombic-wheel-3d-core.js) -- a
  // persistent-World-only system for unrelated reasons. Kept rather than
  // removed since that gate is still real.
  const workspaceModeInput = document.getElementById('setting-workspace-mode');
  workspaceModeInput.checked = workspaceMode === 'model';
  workspaceModeInput.addEventListener('change', () => {
    workspaceMode = workspaceModeInput.checked ? 'model' : 'world';
    refreshWheel3D();
    showHudPrompt(
      workspaceMode === 'model'
        ? 'Model workspace: Cuboctahedron Build paused (a persistent-World-only system). Geometry and material tools stay available.'
        : 'World workspace: Cuboctahedron Build available again.',
      5000,
    );
  });

  // Bring-Your-Own-AI-Key (mid-B5 addition) -- see byok.js's own header
  // for why this is plain fetch, not the @anthropic-ai/sdk package.
  const byokProviderSelect = document.getElementById('byok-provider');
  const byokFields = document.getElementById('byok-fields');
  const byokApiKeyInput = document.getElementById('byok-api-key');
  const byokModelInput = document.getElementById('byok-model');
  byokProviderSelect.value = s.byokProvider;
  byokApiKeyInput.value = s.byokApiKey;
  byokModelInput.value = s.byokModel;
  byokFields.style.display = s.byokProvider === 'none' ? 'none' : '';
  byokProviderSelect.addEventListener('change', () => {
    updateSettings({ byokProvider: byokProviderSelect.value });
    byokFields.style.display = byokProviderSelect.value === 'none' ? 'none' : '';
  });
  byokApiKeyInput.addEventListener('input', () => updateSettings({ byokApiKey: byokApiKeyInput.value }));
  byokModelInput.addEventListener('input', () => updateSettings({ byokModel: byokModelInput.value }));
})();

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 8, 4);
scene.add(sun);

// See docs/code-notes/render.md
function buildRDGeometry(scale = 1) {
  const points = rdRawVerts(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// BCC dual-lattice build (core/bcc-build.md): the truncated octahedron,
// same recipe as buildRDGeometry above -- one shared base geometry,
// instanced per placed cell, not a merged mesh rebuilt from scratch like
// the ephemeral preview (bcc-detail-lattice.js) uses.
function buildBCCGeometry(scale) {
  const points = truncatedOctahedronVertices(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// Same recipe again, for real placed Cuboctahedron Build cells.
function buildCuboctaGeometry(scale) {
  const points = cuboctahedronVertices(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// Same recipe again, for the Cuboctahedron gap-octahedron piece (real
// geometry verified numerically this session -- see core/lattice.js's
// own octGapVertices header).
function buildOctGapGeometry(scale) {
  const points = octGapVertices(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// Spherical Toggle (docs/RHOMBIVERSE_SPEC_ADDENDUM_SPHERICAL_TOGGLE.md),
// Stage 1: turns a spherical-toggle.js lat/lon point grid into a real
// BufferGeometry -- ONE shared mesh-building step for every render mode
// ('sphere'/'volumeSphere' pass n=2 through the same superellipsoid
// formula, 'superellipsoid' passes the shape's own solved n), per the
// spec's own "one reusable function... not a per-shape mesh" note.
function buildSphericalGeometryFromGrid(grid) {
  const positions = [];
  const rows = grid.length;
  const cols = grid[0].length;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) positions.push(...grid[i][j]);
  }
  const indices = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildSphericalGeometry({ mode, R, n }) {
  return buildSphericalGeometryFromGrid(sampleSuperellipsoidGrid(R, mode === 'superellipsoid' ? n : 2));
}

// Real per-shape face-plane distances, at this world's own SCALE --
// grounded directly in the same vertex generators buildRDGeometry/
// buildCuboctaGeometry/buildOctGapGeometry/buildBCCGeometry already use
// above, not re-derived by hand (see tests/unit/spherical-toggle.test.mjs
// for the numeric cross-check against those same generators). RD/
// Octahedron(gap)/Cube/Cuboctahedron are all uniform (Section 1 case 2,
// "plain sphere") -- Cuboctahedron dropped its superellipsoid entirely,
// see Direct override #2 below. There is no ring/torus grouping in this
// feature at all, by direct instruction -- not deferred, ruled out
// entirely (Disphenoid always renders as an individual sphere, see
// spherical-toggle.js's own header).
//
// Governing rule (2026-09-01, DICTO: "run some sort of a proportion
// pass if we could make mathematically consistent so much the better"),
// after several rounds of real live-build feedback converged on it:
//
//   R = min(volume-matched radius, real tangent ceiling)
//
// "Tangent ceiling" = HALF the real distance to the nearest same-type
// neighbor cell in whatever lattice/store that piece type actually
// occupies -- the one value mathematically guaranteed to never overlap
// a neighbor, at any world density (this is the lesson from the
// earlier "TO great size, nearly everything else massively too big"
// round: any R past this line compounds into visible overlap across a
// real densely-built world, even though a single isolated cell never
// reveals it). Volume-matched is the natural "how big should this
// really read" target; the ceiling is a hard safety cap on top of it,
// never the other way around.
//
// This single rule reproduces every value already confirmed correct by
// direct live testing, with the real numbers behind each shape's own
// ceiling (all independently grounded in that shape's own real
// placement lattice, not assumed):
//   RD:                   volume-matched 0.7816*s, ceiling 0.7071*s
//     (half the main FCC world's own NEIGHBOR_OFFSETS spacing,
//     sqrt(2)*s) -> capped at 0.7071*s (unchanged, confirmed good).
//   Cuboctahedron:        volume-matched 0.5838*s, ceiling 0.5000*s
//     (half CO's own real axis-adjacent spacing, 1.0*s -- CO's own
//     doubled-density lattice, both integer parities, not the same
//     spacing as RD's) -> capped at 0.5000*s (unchanged, confirmed).
//   Truncated Octahedron: volume-matched 0.9847*s, ceiling 1.0000*s
//     (half the BCC lattice's own axis-neighbor spacing, 2*s) ->
//     0.9847*s, under its own ceiling already, no capping needed
//     (unchanged, confirmed "great size").
//   Disphenoid: NOT this rule -- see the toggle handler's own
//     disphenoidFreeR. Direct instruction overrides the ceiling
//     entirely here (uncapped volume-matched, 0.5419*s, always, no
//     neighbor-distance capping at all) after live testing showed the
//     ceiling-respecting version read as too small to accept.
// And two shapes this rule newly (correctly) grows, since they were
// previously stuck at their own face-plane distance even though their
// REAL ceiling (half their real neighbor spacing, not their own face
// distance -- these two don't tile flush with a same-type neighbor the
// way RD/CO/TO/Disphenoid do) is well past that:
//   Cube: volume-matched 0.6204*s, ceiling 0.7071*s (Cube shares RD's
//     own main-world lattice, so the same sqrt(2)*s spacing applies) ->
//     0.6204*s, real growth from the old 0.5*s. Cube itself isn't a
//     field below -- it's the pyramids=0 case of the same general
//     partial-cell formula the toggle handler applies directly (see
//     applySphericalToPartials/partialCellVolume), which gives the
//     exact same 0.6204*s result since it's the identical formula.
//   Octahedron(gap): volume-matched 0.3413*s, ceiling 0.5000*s (half
//     the octGap lattice's own real neighbor spacing, 1.0*s, per
//     octGapCellToWorld's (i+0.5,j+0.5,k+0.5)*s placement -- coincides
//     with octahedron's own vertex/circumradius) -> 0.3413*s, real
//     growth from the old 0.2887*s.
function sphericalClassificationFor(scale) {
  const cap = (volume, ceiling) => ({ mode: 'sphere', R: Math.min(volumeMatchedRadius(volume), ceiling) });
  return {
    rd: cap(2 * scale ** 3, scale / Math.SQRT2),
    octahedron: cap(scale ** 3 / 6, 0.5 * scale),
    cuboctahedron: cap((5 / 6) * scale ** 3, 0.5 * scale),
    truncatedOctahedron: cap(4 * scale ** 3, scale),
  };
}

// See docs/code-notes/render.md
// emerald/gold added 2026-08-29, direct request -- buildable colors
// only (deliberately NOT wired into asteroids.js's YIELD_WEIGHTS,
// trade.js's FREE_THRESHOLDS, TRADE_MATERIALS, or planetoidgen.js's
// body recipes -- those are real tunable economy-balance constants,
// not something to invent numbers for without being asked). gold
// reuses hud-wheel-3d.js's own GOLD constant (0xd4af37) verbatim for
// visual consistency with the one other "gold" already in this app.
// amethyst/rose-quartz/citrine/turquoise added 2026-09-02, direct
// request for a fuller palette -- same "buildable color only" scoping
// as emerald/gold above. Deliberately NOT separate "-glassite"
// variants (direct correction: translucency is the World View toggle
// below, not per-material dropdown entries) -- see WORLD_VIEW_MODES.
//
// 2026-09-22: this is now a plain color palette, not gem/mineral-themed
// -- index.html's #color-select dropdown shows plain color names
// (Red, Gray, Blue, ...) instead of these keys' original gem/mineral
// names. The KEYS themselves ('garnet', 'blackstar-glassite', etc.) are
// kept as-is rather than renamed, deliberately: they're stored verbatim
// as `cell.material` in every existing preset/saved World, and renaming
// them would silently break material lookups on anything built before
// this pass (falling back to MATERIAL_COLORS.base). Same 14 colors,
// same values -- only the human-facing label changed.
const MATERIAL_COLORS = {
  base: 0x8899aa,
  garnet: 0x8b2e2e,
  ferrostone: 0x5a5a5a,
  glassite: 0xbfe3f0,
  'star-glassite': 0xdff3ff,
  'blackstar-glassite': 0x1a1a22,
  ice99: 0xd8f0ff,
  water: 0x2e6f9e,
  emerald: 0x50c878,
  gold: 0xd4af37,
  amethyst: 0x9966cc,
  'rose-quartz': 0xe8a0b4,
  citrine: 0xe08a3c,
  turquoise: 0x30c9b8,
};

function materialColor(material) {
  return new THREE.Color(MATERIAL_COLORS[material] ?? MATERIAL_COLORS.base);
}

// Auto-assign (direct request 2026-09-02, "By piece type"): when the
// #auto-assign-color checkbox is on, each piece type places with its
// own material instead of whatever #color-select currently shows --
// see currentMaterialFor() below, wired into the 3 piece-placing
// controllers only (main build, Cuboctahedron, octahedron-gap), not the
// Recolor tool or Sculpture/AI material assignment, which stay explicit
// picks. 'cubocta' is a virtual key -- Piece:CO has no entry of its own
// in #piece-type-select (it's a separate mode), so its own getMaterial
// call site passes this key directly.
//
// These are DEFAULTS only -- direct follow-up 2026-09-02 ("autoselected
// colors for all shapes adjustable"): the real, live-in-effect mapping
// is autoAssignOverrides (below), user-editable via the per-piece
// dropdowns #auto-assign-colors-row builds, persisted to
// localStorage. This object is what a dropdown falls back to before the
// user has ever touched it for that piece, and what Reset (if added
// later) would restore.
const AUTO_ASSIGN_MATERIAL_BY_PIECE = {
  rd: 'base',
  cube: 'ferrostone',
  pyramid: 'garnet',
  to: 'gold',
  ioct: 'turquoise',
  idis: 'amethyst',
  octahedron: 'emerald',
  cubocta: 'citrine',
  halfrd: 'base',
  hourglass: 'base',
  hemi3: 'base',
  hemi4: 'base',
  hemiTri: 'base',
};
const AUTO_ASSIGN_PIECE_LABELS = {
  rd: 'RD (full block)',
  cube: 'Cube',
  pyramid: 'Pyramid',
  to: 'Truncated Octahedron',
  ioct: 'Flattened Octahedron',
  idis: 'Disphenoid',
  octahedron: 'Octahedron',
  cubocta: 'Cuboctahedron',
  halfrd: 'Hemi RD',
  hourglass: 'Hourglass',
  hemi3: 'Hemi RD: Corner Cluster',
  hemi4: 'Hemi RD: Band Cluster',
  hemiTri: 'Hemi RD: Triangle Cluster',
};
const AUTO_ASSIGN_STORAGE_KEY = 'rhombiverse-auto-assign-materials';

// See docs/code-notes/render.md
const _shellColorCache = new Map();
function shellTint(shell) {
  if (!shell) return new THREE.Color(1, 1, 1);
  if (!_shellColorCache.has(shell)) {
    _shellColorCache.set(shell, new THREE.Color().setHSL((shell * 0.15) % 1, 0.65, 0.55));
  }
  return _shellColorCache.get(shell);
}

const GENERATED_TINT = new THREE.Color(0x2a0a30); // see docs/code-notes/render.md
const FLAGGED_TINT = new THREE.Color(0xff2020);

// See docs/code-notes/render.md
function instanceColorFor(cell) {
  if (cell.status === 'flagged' || cell.status === 'removed') return FLAGGED_TINT;
  if (cell.generatedByBlackHole) return GENERATED_TINT;
  const base = materialColor(cell.material);
  if (!cell.shell) return base;
  return base.clone().lerp(shellTint(cell.shell), 0.35);
}

let cellOrder = []; // instanceId -> {x, y, z, ...cellData}, see docs/code-notes/render.md

// See docs/code-notes/render.md
function visibleCells(world, inReportMode) {
  const base = inReportMode ? world.entries() : world.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed');
  // Pyramid Sub-Cell (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md, docs/code-notes/
  // core/pyramid.md): a partial cell can't be an instance of the shared
  // InstancedMesh -- InstancedMesh requires every instance to share the
  // exact same BufferGeometry, and a partial cell's real shape (cube +
  // some subset of its 6 pyramids) genuinely differs per cell. It gets its
  // own individual Mesh instead (rebuildPartialCellMeshes below), so it's
  // excluded here to avoid double-rendering the same cell twice.
  return base.filter((c) => !isPartialCell(c));
}

function isPartialCell(cell) {
  // cube === false (see core/pyramid.js's hasCube()) always needs the
  // per-cell mesh path -- a cube-less cell can never be a plain
  // InstancedMesh instance regardless of its own pyramids bitmask.
  return cell.cube === false || (cell.pyramids !== undefined && cell.pyramids !== FULL_PYRAMIDS);
}

function rebuildInstances(mesh, world, inReportMode = false) {
  cellOrder = visibleCells(world, inReportMode);
  const m = new THREE.Matrix4();
  cellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, instanceColorFor(cell));
  });
  mesh.count = cellOrder.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Forces a bounding-sphere recompute -- see docs/code-notes/render.md
  mesh.computeBoundingSphere();
  rebuildPartialCellMeshes(world, inReportMode);
}

// Pyramid Sub-Cell: one individual Mesh per partial cell, kept in its own
// group (raycast target for both Pyramid mode's own controller and, via
// extraPickTargets, the regular whole-cell build/report/fill/etc. tools --
// see core/build.md and core/pyramid.md for why a shared InstancedMesh
// can't represent these). Same material recipe as the main InstancedMesh's
// `material` (white base), just with an explicit per-mesh color instead of
// per-instance color -- a lone Mesh has no instance-color channel to use.
const partialCellGroup = new THREE.Group();
scene.add(partialCellGroup);
const partialCellMeshes = new Map(); // cellKey string -> { mesh, cell }

function buildPartialCellGeometry(pyramids) {
  const pieces = pyramidPieces(SCALE);
  const points = [...pieces.cube, ...presentAxisKeys(pyramids).map((k) => pieces.pyramids[k].apex)]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// "Pyramid without a cube" (direct instruction 2026-08-29): a cube-less
// cell can't reuse buildPartialCellGeometry's own single-ConvexGeometry
// approach -- that function's correctness depends on the cube's own 8
// points anchoring the hull (any subset of pyramid apexes only ever adds
// an outward bump, never changes the hull elsewhere). With no cube,
// TWO OR MORE present pyramids sharing a cube edge would instead hull
// together into one merged wedge (their bases' shared corners bridge
// them), not two visually separate spikes. Each present pyramid gets
// its own small standalone Mesh instead -- always correct regardless of
// how many are present, and simpler than reasoning about which subsets
// stay separate.
function buildPyramidOnlyMeshes(cell, color) {
  const pieces = pyramidPieces(SCALE);
  const meshes = [];
  for (const axisKey of presentAxisKeys(effectivePyramids(cell))) {
    const { base, apex } = pieces.pyramids[axisKey];
    const points = [...base, apex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const geometry = new ConvexGeometry(points);
    geometry.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
    mat.color.copy(color);
    const pyramidMesh = new THREE.Mesh(geometry, mat);
    // Which of the 6 axes this specific sub-mesh is -- core/build.js's
    // pyramid click handler needs this to tell "clicked my own existing
    // pyramid's base/apex" apart from "clicked a bare cube's flat face",
    // see classifyExistingPyramidHit in core/pyramid.js.
    pyramidMesh.userData.axisKey = axisKey;
    meshes.push(pyramidMesh);
  }
  return meshes;
}

function disposePartialCellObject3D(object3D) {
  if (object3D.isGroup) {
    for (const child of object3D.children) {
      child.geometry.dispose();
      child.material.dispose();
    }
  } else {
    object3D.geometry.dispose();
    object3D.material.dispose();
  }
}

function buildPartialCellObject3D(cell, key) {
  let object3D;
  if (!hasCube(cell)) {
    const group = new THREE.Group();
    for (const mesh of buildPyramidOnlyMeshes(cell, instanceColorFor(cell))) {
      mesh.userData.cellKey = key;
      group.add(mesh);
    }
    object3D = group;
  } else {
    const geom = buildPartialCellGeometry(effectivePyramids(cell));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
    mat.color.copy(instanceColorFor(cell));
    object3D = new THREE.Mesh(geom, mat);
  }
  const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
  object3D.position.set(wx, wy, wz);
  object3D.userData.cellKey = key;
  return object3D;
}

function rebuildPartialCellMeshes(world, inReportMode = false) {
  const source = inReportMode ? world.entries() : world.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed');
  const wanted = new Map();
  for (const cell of source) {
    if (isPartialCell(cell)) wanted.set(cellKey(cell.x, cell.y, cell.z), cell);
  }
  for (const [key, entry] of partialCellMeshes) {
    if (!wanted.has(key)) {
      partialCellGroup.remove(entry.mesh);
      disposePartialCellObject3D(entry.mesh);
      partialCellMeshes.delete(key);
    }
  }
  for (const [key, cell] of wanted) {
    const existing = partialCellMeshes.get(key);
    if (existing && existing.cell.pyramids === cell.pyramids && existing.cell.cube === cell.cube
        && existing.cell.material === cell.material
        && existing.cell.status === cell.status && existing.cell.shell === cell.shell) {
      existing.cell = cell; // cheap fields (e.g. shellCenter) may still have changed
      continue;
    }
    if (existing) {
      partialCellGroup.remove(existing.mesh);
      disposePartialCellObject3D(existing.mesh);
    }
    const object3D = buildPartialCellObject3D(cell, key);
    partialCellGroup.add(object3D);
    partialCellMeshes.set(key, { mesh: object3D, cell });
  }
}

// BCC dual-lattice build's own instance list -- deliberately a SEPARATE
// module-level array from cellOrder above, not a second call into
// rebuildInstances() reusing it: rebuildInstances() overwrites the
// shared `cellOrder` variable that the main FCC build controller's own
// cellAt(instanceId) callback reads, so routing BCC cells through it
// would corrupt the main world's own hit-testing. See core/bcc-build.md.
let bccCellOrder = []; // instanceId -> {x, y, z, ...cellData}
let cuboctaCellOrder = []; // instanceId -> {x, y, z, ...cellData}
let elongDodecaCellOrder = []; // instanceId -> {x, y, z, ...cellData}
let hexPrismCellOrder = []; // instanceId -> {x, y, z, ...cellData}
// 2D lattice tier (Phase 3): one instanceId->cell array PER (angle,
// primitive) combination, keyed by the combination's own `id` -- same
// "separate array per family, never share cellAt's own instance-id
// space" reasoning as bccCellOrder/hexPrismCellOrder above, generalized
// off the earlier Phase 2 design's 3 separately-named arrays.
const lattice2dCellOrders = new Map(); // comboId -> instanceId -> {x, y, z, ...cellData}
let rhombohedraCellOrder = []; // instanceId -> {x, y, z, ...cellData} -- x,y,z are rhombohedra-lattice.js's own (i,j,k) frame
let octGapCellOrder = []; // instanceId -> {x, y, z, ...cellData} -- x,y,z are octGap's own offset-frame index, see core/cubocta-gap-build.js
// Interstitial-lattice build: one real Mesh per disphenoid cell, same
// pattern as partialCellGroup/partialCellMeshes above and for the same
// reason (each cell's own geometry is genuinely different from its
// neighbors', not a shared instanced template). Baked directly from the
// cell's own absolute world-space vertices (mesh.position stays at
// origin) since a disphenoid has no single natural "cell center" the way
// RD/TO's cellToWorld(x,y,z) gives one.
const interstitialGroup = new THREE.Group();
scene.add(interstitialGroup);
const interstitialMeshes = new Map(); // disphenoid key -> Mesh

function buildInterstitialGeometry(verts, subScale) {
  const points = verts.map(([x, y, z]) => new THREE.Vector3(x * subScale, y * subScale, z * subScale));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

function rebuildInterstitialMeshes(store) {
  const wanted = new Map(store.entries().map((c) => [c.key, c]));
  for (const [key, mesh] of interstitialMeshes) {
    if (!wanted.has(key)) {
      interstitialGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      interstitialMeshes.delete(key);
    }
  }
  for (const [key, cell] of wanted) {
    if (interstitialMeshes.has(key)) continue;
    const geom = buildInterstitialGeometry(cell.verts, SCALE);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
    mat.color.copy(instanceColorFor(cell));
    const m = new THREE.Mesh(geom, mat);
    m.userData.key = key;
    interstitialGroup.add(m);
    interstitialMeshes.set(key, m);
  }
}

// Hemisphere pieces (core/hemisphere-build.js): Hemi RD (one real
// hemisphereSplit() half) and Hourglass (two halves from adjacent cells),
// ported from Rhombis 2026-09-06. Same one-real-Mesh-per-piece pattern as
// interstitialMeshes just above -- baked directly from the piece's own
// STORED cell coordinates into absolute world-space vertices, with the
// mesh's own .position left untouched at the group origin. This is the
// exact fix for the real double-offset bug Rhombis's own Hourglass/
// Hourglass Chain stages shipped with (a bridging piece's geometry was
// pre-translated to absolute coords via mergeGeometries+.translate(), then
// ALSO repositioned by a separate group/anchor position at real placement
// time -- see core/hemisphere-build.js's own header): there is no second
// position applied here, so that whole bug class can't recur by
// construction.
const hemisphereGroup = new THREE.Group();
scene.add(hemisphereGroup);
const hemisphereMeshes = new Map(); // piece key -> Mesh

function buildHemisphereGeometry(piece, subScale) {
  if (piece.type === 'halfrd') {
    const [cx, cy, cz] = piece.cell;
    const [wx, wy, wz] = cellToWorld(cx, cy, cz, subScale);
    const verts = hemisphereSplit(subScale, piece.offsetIndex)[piece.side]
      .map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
    const geometry = new ConvexGeometry(verts);
    geometry.computeVertexNormals();
    return geometry;
  }
  // 'wedge2' (Triangle Ring, core/hemisphere-build.js's own wedge2Key):
  // real bug found live -- this branch never existed, so a wedge2 piece
  // fell through into the 'hourglass' branch below and crashed on
  // `...piece.cellA` (undefined, wedge2 only ever stores `cell`) the
  // moment one was placed. Same "cell's own 14 raw vertices, dot-product
  // filtered" technique hemisphereSplit already uses for a single cut,
  // just intersected against BOTH of this piece's own axes at once --
  // exactly the formula core/hemisphere-build.js's own wedge2Key header
  // already documents and claims was verified (non-degenerate for every
  // real CORNER_GROUPS triple), just never actually wired into a real
  // render.
  if (piece.type === 'rdquarter') {
    const [cx, cy, cz] = piece.cell;
    const [wx, wy, wz] = cellToWorld(cx, cy, cz, subScale);
    const verts = rdQuarterPieces(subScale)[piece.cornerIndex]
      .map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
    const geometry = new ConvexGeometry(verts);
    geometry.computeVertexNormals();
    return geometry;
  }
  if (piece.type === 'wedge2') {
    const [cx, cy, cz] = piece.cell;
    const [wx, wy, wz] = cellToWorld(cx, cy, cz, subScale);
    const axisA = NEIGHBOR_OFFSETS[piece.axisA];
    const axisB = NEIGHBOR_OFFSETS[piece.axisB];
    const dot = (v, d) => v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
    const verts = rdRawVerts(subScale)
      .filter((v) => dot(v, axisA) >= -1e-9 && dot(v, axisB) >= -1e-9)
      .map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
    const geometry = new ConvexGeometry(verts);
    geometry.computeVertexNormals();
    return geometry;
  }
  // 'hourglass': cellA's own positive half (toward cellB) merged with
  // cellB's own negative half (toward cellA) -- same offsetIndex for
  // both, same reasoning rhombis/geometry.js's buildHourglassStage
  // already established (a fixed global direction, not a per-cell one).
  const [ax, ay, az] = cellToWorld(...piece.cellA, subScale);
  const [bx, by, bz] = cellToWorld(...piece.cellB, subScale);
  const split = hemisphereSplit(subScale, piece.offsetIndex);
  const vertsA = split.positive.map(([x, y, z]) => new THREE.Vector3(x + ax, y + ay, z + az));
  const vertsB = split.negative.map(([x, y, z]) => new THREE.Vector3(x + bx, y + by, z + bz));
  const geometry = mergeGeometries([new ConvexGeometry(vertsA), new ConvexGeometry(vertsB)], false);
  geometry.computeVertexNormals();
  return geometry;
}

function rebuildHemisphereMeshes(store) {
  const wanted = new Map(store.entries().map((p) => [p.key, p]));
  for (const [key, mesh] of hemisphereMeshes) {
    if (!wanted.has(key)) {
      hemisphereGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      hemisphereMeshes.delete(key);
    }
  }
  for (const [key, piece] of wanted) {
    if (hemisphereMeshes.has(key)) continue;
    const geom = buildHemisphereGeometry(piece, SCALE);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
    mat.color.copy(instanceColorFor(piece));
    const m = new THREE.Mesh(geom, mat);
    m.userData.key = key;
    hemisphereGroup.add(m);
    hemisphereMeshes.set(key, m);
  }
}

function rebuildBCCInstances(bccMesh, bccWorld) {
  bccCellOrder = bccWorld.entries();
  const m = new THREE.Matrix4();
  bccCellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    bccMesh.setMatrixAt(i, m);
    bccMesh.setColorAt(i, instanceColorFor(cell));
  });
  bccMesh.count = bccCellOrder.length;
  bccMesh.instanceMatrix.needsUpdate = true;
  if (bccMesh.instanceColor) bccMesh.instanceColor.needsUpdate = true;
  bccMesh.computeBoundingSphere();
}

// Real placed Elongated Dodecahedron cells -- same instancing pattern
// again, own separate cell order/mesh, own (anisotropic)
// elongDodecaCellToWorld position (see that function's own header for
// why: same FCC index topology as the main world, different world-space
// scale along one axis).
function rebuildElongDodecaInstances(elongDodecaMesh, elongDodecaWorld) {
  elongDodecaCellOrder = elongDodecaWorld.entries();
  const m = new THREE.Matrix4();
  elongDodecaCellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = elongDodecaCellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    elongDodecaMesh.setMatrixAt(i, m);
    elongDodecaMesh.setColorAt(i, instanceColorFor(cell));
  });
  elongDodecaMesh.count = elongDodecaCellOrder.length;
  elongDodecaMesh.instanceMatrix.needsUpdate = true;
  if (elongDodecaMesh.instanceColor) elongDodecaMesh.instanceColor.needsUpdate = true;
  elongDodecaMesh.computeBoundingSphere();
}

// Real placed Hex Prism cells -- same instancing pattern again, own
// hexCellToWorld position (axial q,r + integer z, not the main FCC grid).
function rebuildHexPrismInstances(hexPrismMesh, hexPrismWorld) {
  hexPrismCellOrder = hexPrismWorld.entries();
  const m = new THREE.Matrix4();
  hexPrismCellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = hexCellToWorld(cell.x, cell.y, cell.z, HEX_PRISM_R, HEX_PRISM_H);
    m.makeTranslation(wx, wy, wz);
    hexPrismMesh.setMatrixAt(i, m);
    hexPrismMesh.setColorAt(i, instanceColorFor(cell));
  });
  hexPrismMesh.count = hexPrismCellOrder.length;
  hexPrismMesh.instanceMatrix.needsUpdate = true;
  if (hexPrismMesh.instanceColor) hexPrismMesh.instanceColor.needsUpdate = true;
  hexPrismMesh.computeBoundingSphere();
}

// Real placed 2D lattice cells (Phase 3) -- same instancing pattern
// again, generalized off the earlier Phase 2 design's 3 hand-written
// rebuild functions (Square/Hexagon/Triangle) into one parametrized by
// `combo` (an entry of LATTICE_2D_COMBINATIONS). Orientation handling
// (the Triangle primitive's own "down" instances reuse the SAME "up"
// geometry via a 180-degree Z-rotation baked into the instance matrix,
// exact per lattice-2d.js's own verified header) generalizes to
// `impl.hasOrientation`, true only for the triangle primitive.
function rebuildLattice2dInstances(mesh, world, combo) {
  const impl = LATTICE_PRIMITIVE_IMPLS[combo.primitiveId];
  const cellOrder = world.entries();
  lattice2dCellOrders.set(combo.id, cellOrder);
  const m = new THREE.Matrix4();
  cellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = impl.cellToWorld(cell.x, cell.y, cell.z, combo.angleDeg, LATTICE2D_S, 0);
    if (impl.hasOrientation && cell.z === 1) {
      m.makeRotationZ(Math.PI);
      m.setPosition(wx, wy, wz);
    } else {
      m.makeTranslation(wx, wy, wz);
    }
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, instanceColorFor(cell));
  });
  mesh.count = cellOrder.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

// Real placed Rhombohedra cells (free lattice) -- same instancing
// pattern again, own rhombohedraCellToWorld position (a real 3D
// coordinate frame, no orientation flag or flat-tile height needed).
function rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld) {
  rhombohedraCellOrder = rhombohedraWorld.entries();
  const m = new THREE.Matrix4();
  rhombohedraCellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = rhombohedraCellToWorld(cell.x, cell.y, cell.z, RHOMBOHEDRA_S);
    m.makeTranslation(wx, wy, wz);
    rhombohedraMesh.setMatrixAt(i, m);
    rhombohedraMesh.setColorAt(i, instanceColorFor(cell));
  });
  rhombohedraMesh.count = rhombohedraCellOrder.length;
  rhombohedraMesh.instanceMatrix.needsUpdate = true;
  if (rhombohedraMesh.instanceColor) rhombohedraMesh.instanceColor.needsUpdate = true;
  rhombohedraMesh.computeBoundingSphere();
}

// Real placed Cuboctahedron Build cells -- same instancing pattern as
// rebuildBCCInstances above, own separate cell order/mesh.
function rebuildCuboctaInstances(cuboctaMesh, cuboctaWorld) {
  cuboctaCellOrder = cuboctaWorld.entries();
  const m = new THREE.Matrix4();
  cuboctaCellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    cuboctaMesh.setMatrixAt(i, m);
    cuboctaMesh.setColorAt(i, instanceColorFor(cell));
  });
  cuboctaMesh.count = cuboctaCellOrder.length;
  cuboctaMesh.instanceMatrix.needsUpdate = true;
  if (cuboctaMesh.instanceColor) cuboctaMesh.instanceColor.needsUpdate = true;
  cuboctaMesh.computeBoundingSphere();
}

// Cuboctahedron gap-octahedron cells -- same instancing pattern again,
// own offset-frame world position (octGapCellToWorld, not cellToWorld).
function rebuildOctGapInstances(octGapMesh, octGapWorld) {
  octGapCellOrder = octGapWorld.entries();
  const m = new THREE.Matrix4();
  octGapCellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = octGapCellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    octGapMesh.setMatrixAt(i, m);
    octGapMesh.setColorAt(i, instanceColorFor(cell));
  });
  octGapMesh.count = octGapCellOrder.length;
  octGapMesh.instanceMatrix.needsUpdate = true;
  if (octGapMesh.instanceColor) octGapMesh.instanceColor.needsUpdate = true;
  octGapMesh.computeBoundingSphere();
}

async function init() {
  wireFirstUseHint('duality-toggle', 'Duality: shows this structure\'s aperiodic shadow -- the tiling it casts, not the block shape itself.');
  wireFirstUseHint('spherical-toggle', 'Spherical: renders shapes in a simplified near-spherical form -- a client-side view only, your cells are untouched.');
  wireFirstUseHint('bcc-toggle', 'Lattice View: click to cycle a preview lens through every Piece type -- RD, Cube, Pyramid (shown on your real World), then Cuboctahedron and Octahedron, then BCC/TO, Flattened Octahedron, and Disphenoid (a hypothetical patch near you), then Off.');
  wireFirstUseHint('clear-world-toggle', 'Clear World: erase everything and start fresh from a single seed cell.');
  wireFirstUseHint('reload-toggle', 'Reload: hard-refresh the app if anything looks stuck or stale.');
  wireFirstUseHint('sculpture-mode-toggle', 'Sculpture Mode: a separate, isolated scratch workspace -- nothing here touches your real World.');
  wireFirstUseHint('cyborg-toggle', 'Cyborg Mode: a guided walkthrough, step by step.');
  wireFirstUseHint('xray-toggle', 'X-Ray: drag a cutaway plane through the structure to see inside it.');
  wireFirstUseHint('lab-toggle', 'Settings: advanced settings and tools live here.');
  // Moved from the welcome card's own quickstart line -- see docs/code-notes/render.md
  wireFirstUseHint('hud-wheel-cue', 'Tab / Space (or tap Menu) opens the Rhombic Wheel -- build, sculpt, grow, and more, all from here.');
  wireFirstUseHint('export-json', 'Export your World anytime to keep a copy.');

  // World load priority (shared link / saved / blank starter) -- see
  // docs/code-notes/render.md. No bundled demo/preset World loads on
  // first visit anymore (Showcase World and the "Body Types" planetoid
  // presets were removed 2026-09-22, along with the game-world framing
  // they carried) -- every first visit starts from the same single-cell
  // starter, geometry only, no tour, no other players, nothing pre-built.
  const sharedParam = getSharedWorldParam();
  let sharedWorldJSON = null;
  if (sharedParam) {
    try {
      sharedWorldJSON = await decodeWorldFromUrl(sharedParam);
    } catch (err) {
      console.warn('Rhombiverse: failed to decode shared world link', err);
    }
    clearSharedWorldParam();
  }

  const savedJSON = loadFromLocalStorage();
  let worldJSON;
  if (sharedWorldJSON) {
    worldJSON = sharedWorldJSON;
  } else if (savedJSON) {
    worldJSON = savedJSON;
  } else {
    worldJSON = await loadWorld('./data/starter-world.json');
  }
  const world = createWorldStore(worldJSON);
  cyborgWorldRef = world;
  if (sharedWorldJSON) {
    saveToLocalStorage(world.toJSON());
    showHudPrompt('Loaded a shared World from your link.', 5000);
  }
  // Declared early -- see docs/code-notes/render.md
  let currentMode = 'build';

  // BCC dual-lattice build: a second, independent world store, own
  // localStorage key (BCC_STORAGE_KEY), no relation to Shared World/
  // shared-link loading or the Showcase World fallback above -- always
  // starts empty on a true first visit. Rhombeometry-only (gated by the
  // 'bcc' mode-btn's own display toggle below), so it never needs the
  // World Systems hooks (regrowth/seeds/etc) the main world's store has.
  // See core/bcc-build.md.
  const bccSavedJSON = loadFromLocalStorage(BCC_STORAGE_KEY);
  const bccWorld = createWorldStore(bccSavedJSON ?? { worldName: 'BCC Lattice', version: 1, cells: {}, meta: {} });

  // Cuboctahedron Build: a fourth, independent store (own localStorage
  // key, CUBOCTA_STORAGE_KEY), same reasoning as bccWorld/interstitial
  // above -- Rhombeometry-only, no World Systems hooks needed.
  const cuboctaSavedJSON = loadFromLocalStorage(CUBOCTA_STORAGE_KEY);
  const cuboctaWorld = createWorldStore(cuboctaSavedJSON ?? { worldName: 'Cuboctahedron Lattice', version: 1, cells: {}, meta: {} });

  // Cuboctahedron gap-octahedron Build: a fifth, independent store, own
  // offset coordinate frame (core/cubocta-gap-build.js's own
  // octGapCellToWorld) -- manually placed, genuinely optional, so unlike
  // cuboctaWorld it has no "never truly empty" bootstrap invariant.
  const octGapSavedJSON = loadFromLocalStorage(CUBOCTA_GAP_STORAGE_KEY);
  const octGapWorld = createWorldStore(octGapSavedJSON ?? { worldName: 'Cuboctahedron Gap Octahedra', version: 1, cells: {}, meta: {} });

  // Elongated Dodecahedron Build: a sixth independent store (own
  // localStorage key, ELONGDODECA_STORAGE_KEY). Same FCC integer
  // coordinate grid as the main World -- see geometry-extensions/
  // elongated-dodecahedron.js's own header -- so, unlike bccWorld/
  // cuboctaWorld, it doesn't need its own "never truly empty" bootstrap
  // rule to stay reachable: the main world's own cells are always a
  // valid bootstrap surface for it.
  const elongDodecaSavedJSON = loadFromLocalStorage(ELONGDODECA_STORAGE_KEY);
  const elongDodecaWorld = createWorldStore(elongDodecaSavedJSON ?? { worldName: 'Elongated Dodecahedron Lattice', version: 1, cells: {}, meta: {} });

  // Hex Prism Build: a genuinely separate lattice (own axial-hex
  // coordinate frame, geometry-extensions/hex-prism.js), same "own
  // independent store, own localStorage key" pattern as bccWorld/
  // cuboctaWorld. Unlike elongDodecaWorld, DOES need the "never truly
  // empty" invariant (onHexPrismChange, below) -- its own coordinate
  // frame is unrelated to FCC's, so there's no bootstrap-from-FCC path
  // to fall back on; growth only ever works from an existing hex-prism
  // cell.
  const hexPrismSavedJSON = loadFromLocalStorage(HEXPRISM_STORAGE_KEY);
  const hexPrismWorld = createWorldStore(hexPrismSavedJSON ?? { worldName: 'Hex Prism Lattice', version: 1, cells: {}, meta: {} });
  // Seeded here, not just inside onHexPrismChange -- that handler only
  // ever runs in response to a real click, so a truly fresh load (no
  // saved JSON) would otherwise leave hexPrismMesh with zero instances
  // forever, and handleHexPrismClick's own grow-only design (see its own
  // header) has no bootstrap path to recover from that.
  if (hexPrismWorld.entries().length === 0) hexPrismWorld.addCell(0, 0, 0, { material: 'base' });

  // A seed cell (lattice-index coordinates, not world units) for the
  // idx-th LATTICE_2D_COMBINATIONS entry, arranged as a compact
  // primitive-column x angle-row grid (3 columns, 4 rows) rather than a
  // single spread-out line -- real bug caught live via a browser check:
  // applyDimensionCamera('2D') always frames a FIXED position/distance
  // (camera.position.set(0,0,12), independent of piece type), so a
  // naive `idx * 20` line put later combos tens of units outside that
  // fixed view, invisible until manually panned/zoomed out. This keeps
  // every combo within a few units of the origin, same as Square/
  // Hexagon/Triangle's own original hand-picked (2,0)/(-2,0)/(0,-4)
  // seeds already were, while still keeping all 12 mutually distinct
  // (a real per-combo world-space gap, not just a coincidence) so they
  // don't visually stack on each other or on the main RD seed at origin.
  function lattice2dSeedCell(idx) {
    const primitiveIndex = idx % LATTICE_PRIMITIVES.length;
    const angleIndex = Math.floor(idx / LATTICE_PRIMITIVES.length);
    return [primitiveIndex * 3 - 3, -angleIndex * 3 - 3];
  }

  // 2D lattice tier (Phase 3): one store PER (angle, primitive)
  // combination -- same "seed here, not just in the change handler"
  // reasoning as hexPrismWorld above, generalized off the earlier
  // Phase 2 design's 3 hand-written blocks (Square/Hexagon/Triangle).
  const lattice2dWorlds = new Map(); // comboId -> world store
  LATTICE_2D_COMBINATIONS.forEach((combo, idx) => {
    const savedJSON = loadFromLocalStorage(lattice2dStorageKey(combo.id));
    const world = createWorldStore(savedJSON ?? { worldName: `2D Lattice (${combo.label})`, version: 1, cells: {}, meta: {} });
    if (world.entries().length === 0) {
      const [sx, sy] = lattice2dSeedCell(idx);
      world.addCell(sx, sy, 0, { material: LATTICE2D_SEED_COLORS[idx % LATTICE2D_SEED_COLORS.length] });
    }
    lattice2dWorlds.set(combo.id, world);
  });

  // Rhombohedra (free lattice): own store, own coordinate frame -- same
  // reasoning again. Seeded at (5,0,0), NOT the origin -- real bug found
  // live via a browser sweep test: this lattice's own (0,0,0) sits
  // exactly at the main RD world's own seed position, and the
  // rhombohedron's whole volume is a real subset of a solid RD's own
  // volume at that same spot (same "unclickable, fully enclosed" issue
  // this whole feature exists to get away from -- see rhombohedra-
  // lattice.js's own header). Offsetting the seed puts it in genuinely
  // open space instead.
  const rhombohedraSavedJSON = loadFromLocalStorage(RHOMBOHEDRA_STORAGE_KEY);
  const rhombohedraWorld = createWorldStore(rhombohedraSavedJSON ?? { worldName: 'Rhombohedra Lattice', version: 1, cells: {}, meta: {} });
  if (rhombohedraWorld.entries().length === 0) rhombohedraWorld.addCell(5, 0, 0, { material: 'base' });

  const geometry = buildRDGeometry(SCALE);
  // White base color: actual per-cell color comes entirely from
  // setColorAt (instanceColorFor) via the multiplicative USE_INSTANCING_
  // COLOR shader path, so white here is an identity multiplier that lets
  // the per-instance color show through unmodified.
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0.55,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_CELLS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  // BCC dual-lattice build: its own InstancedMesh (truncated-octahedron
  // geometry, not RD) and own material clone -- same MATERIAL_COLORS
  // palette as the main world (no separate material system, no tint;
  // direct instruction 2026-08-26), just a different base shape.
  const bccGeometry = buildBCCGeometry(bccShapeScaleFor(SCALE));
  const bccMesh = new THREE.InstancedMesh(bccGeometry, material.clone(), MAX_CELLS);
  bccMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bccMesh);
  rebuildBCCInstances(bccMesh, bccWorld);

  // Elongated Dodecahedron Build: its own InstancedMesh, same "own
  // material clone, same MATERIAL_COLORS palette, different base shape"
  // pattern as bccMesh above. elongatedDodecahedronVerts(SCALE) already
  // uses the verified equilateral-hexagon elongation ratio by default
  // (elongationRatio=1, geometry-extensions/elongated-dodecahedron.js's
  // own header) -- no extra scale correction needed the way bccShapeScaleFor
  // provides for TO.
  const elongDodecaGeometry = new ConvexGeometry(elongatedDodecahedronVerts(SCALE).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  elongDodecaGeometry.computeVertexNormals();
  const elongDodecaMesh = new THREE.InstancedMesh(elongDodecaGeometry, material.clone(), MAX_CELLS);
  elongDodecaMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(elongDodecaMesh);
  rebuildElongDodecaInstances(elongDodecaMesh, elongDodecaWorld);

  // Hex Prism Build: its own InstancedMesh, own geometry (hexPrismVerts,
  // no special elongation ratio needed -- see HEX_PRISM_R/H's own
  // header above).
  const hexPrismGeometry = new ConvexGeometry(hexPrismVerts(HEX_PRISM_R, HEX_PRISM_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  hexPrismGeometry.computeVertexNormals();
  const hexPrismMesh = new THREE.InstancedMesh(hexPrismGeometry, material.clone(), MAX_CELLS);
  hexPrismMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(hexPrismMesh);
  rebuildHexPrismInstances(hexPrismMesh, hexPrismWorld);

  // Real bug, direct report ("silhouettes just sit there, pieces cant
  // be generated"): #piece-type-select only ever had literal <option>s
  // for the OLD square2d/hexagon2d/triangle2d values -- setting a
  // <select>'s .value to a string with no matching <option> silently
  // no-ops (the DOM leaves the select's value unchanged), so every one
  // of the 12 new "lattice2d:<id>" values the toggle panel/Wizard set
  // never actually took effect: the piece-type <select> stayed on
  // whatever it was before, so build.js's own getPieceType() check
  // never matched, and clicking a tile silently fell through to
  // whichever OTHER piece type was actually still selected. Fixed by
  // injecting a real <option> per LATTICE_2D_COMBINATIONS entry here,
  // once, before anything below ever tries to set one as the select's
  // value -- generated, not hand-listed in index.html, so this can't
  // drift out of sync with the registry again the way the old 3-option
  // version implicitly did once it stopped being updated.
  const pieceTypeSelect = document.getElementById('piece-type-select');
  for (const combo of LATTICE_2D_COMBINATIONS) {
    pieceTypeSelect.add(new Option(combo.label, `lattice2d:${combo.id}`));
  }

  // 2D Lattice Build (Phase 3): one InstancedMesh PER (angle, primitive)
  // combination, own geometry each (a combination's tile shape is a
  // genuine function of its own angle -- see lattice-2d.js's header --
  // so, unlike every other family on this page, these 12 meshes can't
  // share geometry across combinations the way Triangle's own up/down
  // orientations already share ONE geometry within a single combo).
  const lattice2dMeshes = new Map(); // comboId -> InstancedMesh
  LATTICE_2D_COMBINATIONS.forEach((combo) => {
    const impl = LATTICE_PRIMITIVE_IMPLS[combo.primitiveId];
    const geometry = new ConvexGeometry(impl.tileVerts(combo.angleDeg, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    geometry.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geometry, material.clone(), MAX_CELLS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    lattice2dMeshes.set(combo.id, mesh);
    rebuildLattice2dInstances(mesh, lattice2dWorlds.get(combo.id), combo);
  });

  // Dot-matrix overlay (Phase 4, direct instruction: "showing the dot
  // matrix of lattice" / "a four position toggle... to see
  // transformations"): a live visualization of the CURRENT angle's own
  // lattice points, independent of which primitive is active (dots are
  // just lattice points -- always well-defined at any angle, no
  // primitive-shape ambiguity the way a tile has). Repositioned (not
  // rebuilt) whenever the toggle panel's own angle changes, so dragging
  // through the 4 named angles visibly morphs this dot grid in place --
  // the actual "see transformations" effect asked for.
  // Direct correction, 2026-09-23 ("matrix dots are a little big and
  // coverage is small of whole matrix when zooming out"): smaller dots,
  // wider coverage (radius 8 -> 24, so the grid still fills the view at
  // a real zoomed-out distance instead of trailing off into empty space).
  const DOT_MATRIX_RADIUS = 24;
  const dotMatrixGeometry = new THREE.SphereGeometry(0.035 * LATTICE2D_S, 8, 6);
  // Signature blue (#9de0ff), same accent color as everything else in
  // this app's own HUD chrome -- fully opaque (not the original 0.85)
  // for max contrast against the scene's own dark starfield background,
  // direct instruction ("contrast against star background").
  const dotMatrixMaterial = new THREE.MeshBasicMaterial({ color: 0x9de0ff, depthTest: false });
  const dotMatrixCount = (2 * DOT_MATRIX_RADIUS + 1) ** 2;
  const dotMatrixMesh = new THREE.InstancedMesh(dotMatrixGeometry, dotMatrixMaterial, dotMatrixCount);
  dotMatrixMesh.renderOrder = 5; // stay visible above the flat tiles it sits on top of
  dotMatrixMesh.visible = false;
  scene.add(dotMatrixMesh);

  function updateDotMatrix(angleDeg) {
    const [v0, v1] = latticeBasis(angleDeg, LATTICE2D_S);
    const m = new THREE.Matrix4();
    let idx = 0;
    for (let i = -DOT_MATRIX_RADIUS; i <= DOT_MATRIX_RADIUS; i++) {
      for (let j = -DOT_MATRIX_RADIUS; j <= DOT_MATRIX_RADIUS; j++) {
        const x = i * v0[0] + j * v1[0];
        const y = i * v0[1] + j * v1[1];
        m.makeTranslation(x, y, 0.12);
        dotMatrixMesh.setMatrixAt(idx++, m);
      }
    }
    dotMatrixMesh.count = idx;
    dotMatrixMesh.instanceMatrix.needsUpdate = true;
    dotMatrixMesh.computeBoundingSphere();
  }
  updateDotMatrix(NAMED_LATTICE_ANGLES[0].angleDeg);

  // Persistent 2D toggle panel (Phase 4, direct instruction: "a four
  // position toggle... to see transformations" -- an always-reachable
  // live control while building in 2D, replacing the earlier one-shot
  // "pick once from the Wizard's 12-row list, then it behaves like a
  // fixed piece type" design; that list stays as an alternate entry
  // point -- see dimension-wizard.js -- but this panel is the one meant
  // to be flipped back and forth mid-session). 2 rows: 4
  // NAMED_LATTICE_ANGLES, 3 LATTICE_PRIMITIVES. Changing either
  // immediately re-derives the active (angle, primitive) combination,
  // switches the live piece type to it (reusing the SAME
  // 'tool:pieceType:lattice2d:<id>' action beginFaceAttach-style
  // dispatch already handles), and redraws the dot-matrix overlay at
  // the new angle.
  let activeLattice2dAngleId = NAMED_LATTICE_ANGLES[0].id;
  let activeLattice2dPrimitiveId = LATTICE_PRIMITIVES[0].id;
  const lattice2dPanel = document.createElement('div');
  lattice2dPanel.id = 'lattice2d-toggle-panel';
  document.body.appendChild(lattice2dPanel);

  function renderLattice2dPanel() {
    lattice2dPanel.innerHTML = '';
    const angleRow = document.createElement('div');
    angleRow.className = 'lattice2d-toggle-row';
    for (const angle of NAMED_LATTICE_ANGLES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      // Direct correction, 2026-09-23 ("toggle positions names should
      // be lattice angles not piece names"): this control is about the
      // continuous lattice-angle parameter, not a set of named pieces,
      // so the button itself shows the real angle value -- its own
      // named identity (angle.label, e.g. "RD Rhombus") moves to the
      // title tooltip instead of disappearing outright.
      btn.textContent = `${angle.angleDeg.toFixed(2)}°`;
      btn.title = angle.label;
      if (angle.id === activeLattice2dAngleId) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (angle.id === activeLattice2dAngleId) return;
        activeLattice2dAngleId = angle.id;
        renderLattice2dPanel();
        applyLattice2dSelection();
      });
      angleRow.appendChild(btn);
    }
    const primRow = document.createElement('div');
    primRow.className = 'lattice2d-toggle-row';
    for (const primitive of LATTICE_PRIMITIVES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = primitive.label;
      if (primitive.id === activeLattice2dPrimitiveId) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (primitive.id === activeLattice2dPrimitiveId) return;
        activeLattice2dPrimitiveId = primitive.id;
        renderLattice2dPanel();
        applyLattice2dSelection();
      });
      primRow.appendChild(btn);
    }
    lattice2dPanel.append(angleRow, primRow);
  }
  // Live preview shapes, direct reports ("shapes dont change when dot
  // matrix changes" then "you only need to see three basic shapes but
  // they must change when matrix does"): the 12 real seed tiles each
  // live in their own separate store at their own fixed grid offset (by
  // design -- see LATTICE_2D_COMBINATIONS' own "families coexist"
  // reasoning above), so toggling the angle never visibly reshapes any
  // already-placed one, and showing all 12 at once is more clutter than
  // signal. These 3 extra, non-persisted preview meshes (not part of
  // any world store -- never saved, never counts as a placed cell) --
  // one per LATTICE_PRIMITIVES entry, side by side at the dot matrix's
  // own origin -- get their geometry rebuilt to the CURRENT toggled
  // angle every time it changes, so all 3 visibly morph together in
  // place alongside the dots. The currently active primitive (the one
  // that will actually get placed on click) is the one rendered fully
  // opaque; the other 2 stay dim for comparison.
  // Direct correction, 2026-09-23 ("shapes are too small relative to
  // dot spacing"): these 3 are a purely cosmetic comparison display,
  // not tied to the real 1-unit-per-cell placement grid the way the
  // actual placeable tiles are, so there's no correctness reason they
  // need to match dot spacing 1:1 -- scaled up 3x to read as real
  // "hero" shapes against the now much wider (radius-24) dot field,
  // spacing scaled proportionally so they still don't overlap.
  const LATTICE2D_PREVIEW_SCALE = 3;
  const lattice2dPreviewMeshes = new Map(); // primitiveId -> Mesh
  function updateLattice2dPreviews(angleDeg, activePrimitiveId) {
    const previewS = LATTICE2D_S * LATTICE2D_PREVIEW_SCALE;
    const spacing = 1.6 * previewS;
    LATTICE_PRIMITIVES.forEach((primitive, i) => {
      const old = lattice2dPreviewMeshes.get(primitive.id);
      if (old) {
        scene.remove(old);
        old.geometry.dispose();
        old.material.dispose();
      }
      const impl = LATTICE_PRIMITIVE_IMPLS[primitive.id];
      const geometry = new ConvexGeometry(impl.tileVerts(angleDeg, previewS, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      geometry.computeVertexNormals();
      const isActive = primitive.id === activePrimitiveId;
      const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x9de0ff, transparent: true, opacity: isActive ? 0.85 : 0.35, depthTest: false });
      const mesh = new THREE.Mesh(geometry, previewMaterial);
      mesh.position.set((i - (LATTICE_PRIMITIVES.length - 1) / 2) * spacing, 0, 0.2);
      mesh.renderOrder = 6; // above the dot matrix (5) and the flat tiles it sits on top of
      scene.add(mesh);
      lattice2dPreviewMeshes.set(primitive.id, mesh);
    });
  }

  // Deliberately NOT handleWheelAction (out of scope here -- it's a
  // `const` declared inside a nested block further down, not reachable
  // from this closure; a real ReferenceError caught live) and
  // deliberately NOT reusing its own full pieceType-pick behavior even
  // once that's fixed: that flow also force-opens the color picker on
  // every pick, which is right for a one-shot Wizard/wheel selection
  // but wrong here -- flipping through toggles to watch the lattice
  // transform shouldn't pop a modal over the view on every click. Just
  // the minimum real effect: set the active piece type and make sure
  // Add mode is active, same as handleWheelAction's own pieceType
  // branch does before it gets to the color-picker part.
  function applyLattice2dSelection() {
    const combo = LATTICE_2D_COMBINATIONS.find((c) => c.angleId === activeLattice2dAngleId && c.primitiveId === activeLattice2dPrimitiveId);
    updateDotMatrix(combo.angleDeg);
    updateLattice2dPreviews(combo.angleDeg, activeLattice2dPrimitiveId);
    document.getElementById('piece-type-select').value = `lattice2d:${combo.id}`;
    if (currentMode !== 'build' && currentMode !== 'chisel') {
      document.querySelector('.mode-btn[data-mode="build"]')?.click();
    }
    updateHudIndicator();
    showHudPrompt(`Piece: ${combo.label}`, 2000);
  }
  renderLattice2dPanel();
  updateLattice2dPreviews(NAMED_LATTICE_ANGLES[0].angleDeg, LATTICE_PRIMITIVES[0].id);

  // Rhombohedra Build (free lattice): its own InstancedMesh, own
  // geometry (rhombohedraTileVerts -- one of RD Quarter's own 4
  // congruent orientations, centered on its own centroid).
  const rhombohedraGeometry = new ConvexGeometry(rhombohedraTileVerts(RHOMBOHEDRA_S).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  rhombohedraGeometry.computeVertexNormals();
  const rhombohedraMesh = new THREE.InstancedMesh(rhombohedraGeometry, material.clone(), MAX_CELLS);
  rhombohedraMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(rhombohedraMesh);
  rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld);

  // Cuboctahedron Build: its own InstancedMesh (cuboctahedron geometry),
  // same "own material clone, same MATERIAL_COLORS palette" pattern as
  // bccMesh above -- cuboctahedronVertices(SCALE) already applies the
  // real, verified half-scale internally (see core/lattice.js's own
  // header), so real placed cells touch their real neighbors without
  // overlapping, the same property Lattice Quick-View's own 'cubocta'
  // preview mode relies on.
  const cuboctaGeometry = buildCuboctaGeometry(SCALE);
  const cuboctaMesh = new THREE.InstancedMesh(cuboctaGeometry, material.clone(), MAX_CELLS);
  cuboctaMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Real z-fighting, caught live 2026-08-29 ("epileptic triggering
  // patterning" -- a genuine dotted/speckled artifact, confirmed via a
  // real multi-cell cluster screenshot, not a false alarm): a
  // cuboctahedron's own vertices sit EXACTLY at its host cell's shared
  // rhombic-face midpoint with each of its 12 real neighbors (core/
  // lattice.js's cuboctahedronVertices() -- half of NEIGHBOR_OFFSETS,
  // by construction). Wherever a neighbor cell actually exists there,
  // the cuboctahedron's own facets run coincident with that neighbor's
  // real RD face right at the touching vertex -- the exact depth-buffer
  // tie that produces this project's own established z-fighting
  // signature (same root cause, same fix, as the Lattice Quick-View/
  // Dualize preview flicker fixed earlier this session -- see that
  // fix's own polygonOffset comment). Not a preview/translucent overlay
  // this time -- real, opaque, permanently-placed geometry -- so this
  // needed applying directly to cuboctaMesh's own material, not just
  // the preview overlay materials that already had it.
  cuboctaMesh.material.polygonOffset = true;
  cuboctaMesh.material.polygonOffsetFactor = -8;
  cuboctaMesh.material.polygonOffsetUnits = -8;
  scene.add(cuboctaMesh);
  rebuildCuboctaInstances(cuboctaMesh, cuboctaWorld);

  // Cuboctahedron gap-octahedron Build: its own InstancedMesh, same
  // "own material clone, same MATERIAL_COLORS palette" pattern as
  // cuboctaMesh above. Sits in genuinely empty space between cells (not
  // nested inside a larger cell), so no polygonOffset/z-fighting
  // treatment is needed -- verified numerically this session that its
  // own faces are the exact, real boundary shared with the surrounding
  // cuboctahedra, not a coincident duplicate surface.
  const octGapGeometry = buildOctGapGeometry(SCALE);
  const octGapMesh = new THREE.InstancedMesh(octGapGeometry, material.clone(), MAX_CELLS);
  octGapMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(octGapMesh);
  rebuildOctGapInstances(octGapMesh, octGapWorld);

  // Interstitial-lattice build: a third, independent store (own
  // localStorage key, INTERSTITIAL_STORAGE_KEY) -- see core/
  // interstitial-build.md. Each disphenoid has its own unique
  // orientation (not related to its neighbors by translation the way
  // RD/TO cells are), so this can't use InstancedMesh like the two
  // meshes above; rebuildInterstitialMeshes (below) renders one real
  // Mesh per cell, the same pattern partialCellGroup already uses for
  // pyramid-shaved RD cells.
  const interstitialSavedJSON = loadFromLocalStorage(INTERSTITIAL_STORAGE_KEY);
  const interstitialStore = createInterstitialStore(interstitialSavedJSON);
  rebuildInterstitialMeshes(interstitialStore);

  // Hemisphere pieces (core/hemisphere-build.md): a sixth independent
  // store, own localStorage key, same reasoning as BCC/interstitial/
  // Cuboctahedron/gap-octahedron above. No "never truly empty" bootstrap
  // seed needed (unlike those four) -- Hemi RD/Hourglass both bootstrap
  // fresh off the solid FCC/BCC world's own faces, not off an existing
  // piece of their own kind, so an empty store is a perfectly valid start.
  const hemisphereSavedJSON = loadFromLocalStorage(HEMISPHERE_STORAGE_KEY);
  const hemisphereStore = createHemisphereStore(hemisphereSavedJSON);
  rebuildHemisphereMeshes(hemisphereStore);

  // B4b's standalone mesh -- same geometry/material recipe as the main
  // world's (a real sculpture should look identical either place), own
  // InstancedMesh/capacity since it's a genuinely separate scene.
  sculptureMesh = new THREE.InstancedMesh(geometry, material.clone(), MAX_CELLS);
  sculptureMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sculptureScene.add(sculptureMesh);

  // Lattice Zoom Stage 2: sub-lattice reveal setup -- see docs/code-notes/render.md
  const SUB_LATTICE_TRIGGER_DISTANCE = 4;
  const MAX_NEARBY_SUBLATTICE_CELLS = 20;
  const SUB_LATTICE_CELLS_PER_PARENT = cumulativeCellCount(SUB_LATTICE_MAX_SHELL);
  const subLatticeScale = subScaleFactor(SUB_LATTICE_MAX_SHELL) * SCALE;
  const subLatticeGeometry = buildRDGeometry(subLatticeScale);
  const subLatticeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    metalness: 0.15,
    roughness: 0.55,
    flatShading: true,
  });
  const subLatticeMesh = new THREE.InstancedMesh(
    subLatticeGeometry,
    subLatticeMaterial,
    MAX_NEARBY_SUBLATTICE_CELLS * SUB_LATTICE_CELLS_PER_PARENT
  );
  subLatticeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  subLatticeMesh.count = 0;
  scene.add(subLatticeMesh);

  // Lattice Zoom Stage 3, level 2 -- see docs/code-notes/render.md
  const LEVEL2_TRIGGER_DISTANCE = levelTriggerDistance(SUB_LATTICE_TRIGGER_DISTANCE, 2, SUB_LATTICE_MAX_SHELL);
  const MAX_NEARBY_LEVEL2_PARENTS = 4;
  const level2Scale = subLatticeScale * subScaleFactor(SUB_LATTICE_MAX_SHELL);
  const level2Geometry = buildRDGeometry(level2Scale);
  const level2Mesh = new THREE.InstancedMesh(
    level2Geometry,
    subLatticeMaterial,
    MAX_NEARBY_LEVEL2_PARENTS * SUB_LATTICE_CELLS_PER_PARENT
  );
  level2Mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  level2Mesh.count = 0;
  scene.add(level2Mesh);

  // Blend width per level -- see docs/code-notes/render.md
  const SUB_LATTICE_BLEND_WIDTH = subLatticeScale;
  const LEVEL2_BLEND_WIDTH = levelTriggerDistance(SUB_LATTICE_BLEND_WIDTH, 2, SUB_LATTICE_MAX_SHELL);

  // Sub-lattice throttle state -- see docs/code-notes/render.md
  let subLatticeThrottleMs = SUB_LATTICE_THROTTLE_BASE_MS;
  let subLatticeVolatilityScore = 0;
  let lastSubLatticeRefPos = null;
  let lastSubLatticeRefresh = 0;
  const subLatticeDummy = new THREE.Object3D();

  // See docs/code-notes/render.md
  function writeBlendedInstance(mesh, idx, worldPosition, blend) {
    subLatticeDummy.position.set(...worldPosition);
    subLatticeDummy.scale.setScalar(blend);
    subLatticeDummy.updateMatrix();
    mesh.setMatrixAt(idx, subLatticeDummy.matrix);
  }

  // See docs/code-notes/render.md
  function refreshSubLattice() {
    const camPos = camera.position;
    const refPos = [camPos.x, camPos.y, camPos.z];

    const movement = lastSubLatticeRefPos
      ? Math.hypot(refPos[0] - lastSubLatticeRefPos[0], refPos[1] - lastSubLatticeRefPos[1], refPos[2] - lastSubLatticeRefPos[2])
      : 0;
    subLatticeVolatilityScore = nextVolatilityScore(subLatticeVolatilityScore, movement, SUB_LATTICE_TRIGGER_DISTANCE);
    subLatticeThrottleMs = throttleForVolatility(subLatticeVolatilityScore);
    lastSubLatticeRefPos = refPos;

    const chosen = selectNearbyCells(
      world.entries(),
      refPos,
      SUB_LATTICE_TRIGGER_DISTANCE + SUB_LATTICE_BLEND_WIDTH,
      MAX_NEARBY_SUBLATTICE_CELLS,
      SCALE
    );

    let idx = 0;
    const level1Cells = [];
    for (const parent of chosen) {
      const blend = blendFactor(parent.d, SUB_LATTICE_TRIGGER_DISTANCE, SUB_LATTICE_BLEND_WIDTH);
      const subCells = generateSubLattice(parent.x, parent.y, parent.z, SUB_LATTICE_MAX_SHELL, SCALE);
      for (const sub of subCells) {
        writeBlendedInstance(subLatticeMesh, idx, sub.worldPosition, blend);
        idx++;
        level1Cells.push(sub);
      }
    }
    subLatticeMesh.count = idx;
    subLatticeMesh.instanceMatrix.needsUpdate = true;
    subLatticeMesh.computeBoundingSphere(); // see docs/code-notes/render.md

    let idx2 = 0;
    if (MAX_LOD_DEPTH >= 2) {
      const chosen2 = selectNearbyByWorldPosition(
        level1Cells,
        refPos,
        LEVEL2_TRIGGER_DISTANCE + LEVEL2_BLEND_WIDTH,
        MAX_NEARBY_LEVEL2_PARENTS
      );
      for (const parent of chosen2) {
        const blend2 = blendFactor(parent.d, LEVEL2_TRIGGER_DISTANCE, LEVEL2_BLEND_WIDTH);
        const subCells2 = generateSubLatticeAt(parent.worldPosition, parent.scale, SUB_LATTICE_MAX_SHELL);
        for (const sub of subCells2) {
          writeBlendedInstance(level2Mesh, idx2, sub.worldPosition, blend2);
          idx2++;
        }
      }
    }
    level2Mesh.count = idx2;
    level2Mesh.instanceMatrix.needsUpdate = true;
    level2Mesh.computeBoundingSphere();
  }
  refreshSubLattice();

  // See docs/code-notes/render.md
  function scheduleSubLatticeRefresh() {
    setTimeout(() => {
      refreshSubLattice();
      lastSubLatticeRefresh = performance.now();
      scheduleSubLatticeRefresh();
    }, subLatticeThrottleMs);
  }
  scheduleSubLatticeRefresh();

  rebuildInstances(mesh, world);

  // Undo stack -- see docs/code-notes/render.md
  const undoStack = [];
  const MAX_UNDO = 20;
  let lastSnapshot = JSON.stringify(world.toJSON());

  function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    btn.disabled = undoStack.length === 0;
    // B2: the icon itself no longer carries a numeric readout -- the
    // scrub-timeline strip (renderUndoScrubStrip) is the count now.
  }

  // See docs/code-notes/render.md
  function renderUndoScrubStrip() {
    const strip = document.getElementById('undo-scrub-strip');
    strip.innerHTML = '';
    if (undoStack.length === 0) return;
    const label = document.createElement('div');
    label.className = 'scrub-label';
    label.textContent = `${undoStack.length} step${undoStack.length === 1 ? '' : 's'} back`;
    strip.appendChild(label);
    undoStack.forEach((snapshot, i) => {
      const tick = document.createElement('div');
      tick.className = 'scrub-tick';
      tick.title = `Jump back ${undoStack.length - i} step${undoStack.length - i === 1 ? '' : 's'}`;
      tick.addEventListener('click', () => jumpToUndoIndex(i));
      strip.appendChild(tick);
    });
  }

  function jumpToUndoIndex(i) {
    if (i < 0 || i >= undoStack.length) return;
    const target = undoStack[i];
    world.replaceAll(JSON.parse(target));
    lastSnapshot = target;
    undoStack.length = i; // drop this state and everything newer -- it's now the live state, not a past one
    rebuildInstances(mesh, world, currentMode === 'report');
    saveToLocalStorage(world.toJSON());
    updateUndoButton();
    renderUndoScrubStrip();
    renderRingList();
    document.getElementById('undo-scrub-strip').classList.remove('visible');
  }

  // Ring list -- see docs/code-notes/render.md
  let focusedCenterKey = null;

  function shellHue(shell) {
    return ((shell * 0.15) % 1) * 360;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // See docs/code-notes/render.md
  function renderRingDiagram(shells, counts) {
    const size = 176;
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size / 2 - 6;
    const maxShell = shells[shells.length - 1];
    const radiusFor = (n) => (n / maxShell) * maxRadius;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);

    for (let i = shells.length - 1; i >= 0; i--) {
      const shell = shells[i];
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', radiusFor(shell));
      circle.setAttribute('fill', `hsl(${shellHue(shell)}, 65%, 50%)`);
      circle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', () => {
        removeShell(world, focusedCenterKey, shell);
        onChange();
      });
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = `Shell ${shell} · ${counts.get(shell)} cells (click to remove)`;
      circle.appendChild(title);
      svg.appendChild(circle);
    }

    const centerDot = document.createElementNS(SVG_NS, 'circle');
    centerDot.setAttribute('cx', cx);
    centerDot.setAttribute('cy', cy);
    centerDot.setAttribute('r', 3);
    centerDot.setAttribute('fill', '#fff');
    svg.appendChild(centerDot);

    return svg;
  }

  function renderRingList() {
    const container = document.getElementById('ring-list');
    container.innerHTML = '';
    if (!focusedCenterKey) {
      container.innerHTML = `<div class="placeholder" data-i18n="shells.emptyHint">${t('shells.emptyHint', getSettings().language)}</div>`;
      return;
    }
    const structure = world
      .entries()
      .filter((c) => c.shellCenter === focusedCenterKey && c.shell !== undefined);
    if (structure.length === 0) {
      container.innerHTML = '<div class="placeholder">No shells in this structure.</div>';
      return;
    }
    const counts = new Map();
    for (const c of structure) counts.set(c.shell, (counts.get(c.shell) || 0) + 1);
    const shells = [...counts.keys()].sort((a, b) => a - b);

    container.appendChild(renderRingDiagram(shells, counts));

    for (const shell of shells) {
      const row = document.createElement('div');
      row.className = 'ring-item';
      const label = document.createElement('span');
      label.textContent = `Shell ${shell} · ${counts.get(shell)} cells`;
      const recolorBtn = document.createElement('button');
      recolorBtn.type = 'button';
      recolorBtn.className = 'ring-recolor';
      recolorBtn.textContent = t('shells.recolor', getSettings().language);
      recolorBtn.title = t('shells.recolorTitle', getSettings().language);
      recolorBtn.addEventListener('click', () => {
        recolorShell(world, focusedCenterKey, shell, materialSelect.value, canPlaceMaterial);
        onChange();
      });
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ring-remove';
      removeBtn.textContent = '×';
      removeBtn.title = `Remove shell ${shell}`;
      removeBtn.addEventListener('click', () => {
        removeShell(world, focusedCenterKey, shell);
        onChange();
      });
      row.appendChild(label);
      row.appendChild(recolorBtn);
      row.appendChild(removeBtn);
      container.appendChild(row);
    }
  }

  function onChange() {
    // Invariant (direct instruction, 2026-08-29): the world must never
    // reach zero cells. With nothing left to click a face of, Add has no
    // way to place anything ever again -- a genuine dead end, found live
    // (right-clicking the single starter cell leaves exactly this
    // state). onChange() is the one real choke point every world-
    // mutating path already runs through (Add/Remove/Fill/Dig/Round/
    // Excavate/Report/Clear World/Load/Import/undo/...), so enforcing it
    // here holds regardless of which of them caused the count to drop,
    // not just the dedicated Clear World button (which already happened
    // to be fine, since it always reloads the real 1-cell starter file).
    if (world.entries().length === 0) {
      world.addCell(0, 0, 0, { material: 'base' });
    }
    rebuildInstances(mesh, world, currentMode === 'report');
    updateSectionEnabled(); // keeps newly created partial-cell (Pyramid) mesh materials in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning as updateSectionEnabled() above -- see World View's own header
    if (worldViewMode === 'skeleton') rebuildWorldViewSkeleton();
    // Keep an active Lattice Quick-View in sync with your real World --
    // every mode now re-renders your own cells (see
    // rebuildLatticeQuickView's own header), so a build/remove while one
    // is active should update it too.
    if (latticeQuickViewMode !== 'off') rebuildLatticeQuickView();
    const afterJSON = world.toJSON();
    const afterStr = JSON.stringify(afterJSON);
    if (afterStr !== lastSnapshot) {
      undoStack.push(lastSnapshot);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    lastSnapshot = afterStr;
    saveToLocalStorage(afterJSON);
    updateUndoButton();
    renderUndoScrubStrip();
    renderRingList();
  }

  // See docs/code-notes/render.md
  const UNDO_HOLD_MS = 220;
  let undoHoldTimer = null;
  let undoHeld = false;
  const undoBtn = document.getElementById('undo-btn');
  const undoStripEl = document.getElementById('undo-scrub-strip');
  undoBtn.addEventListener('pointerdown', () => {
    if (undoBtn.disabled) return;
    undoHeld = false;
    clearTimeout(undoHoldTimer);
    undoHoldTimer = setTimeout(() => {
      undoHeld = true;
      renderUndoScrubStrip();
      undoStripEl.classList.add('visible');
    }, UNDO_HOLD_MS);
  });
  undoBtn.addEventListener('pointerup', () => {
    clearTimeout(undoHoldTimer);
    if (!undoHeld) {
      jumpToUndoIndex(undoStack.length - 1);
    }
    undoHeld = false;
  });
  undoBtn.addEventListener('pointerleave', () => {
    clearTimeout(undoHoldTimer);
  });
  document.addEventListener('pointerdown', (e) => {
    if (undoStripEl.classList.contains('visible') && !undoStripEl.contains(e.target) && e.target !== undoBtn) {
      undoStripEl.classList.remove('visible');
    }
  });
  updateUndoButton();

  // See docs/code-notes/render.md
  // Real report 2026-08-29: X-Ray's cross-section left most of a real
  // structure uncut -- BCC/Octahedron Site/Disphenoid pieces (added
  // well after X-Ray itself) never respected the section plane at all.
  // Root cause: bccMesh's own material is a ONE-TIME `material.clone()`
  // made at startup (cloning doesn't keep clippingPlanes linked to the
  // original -- a later reassignment here never reaches it), and both
  // partial-cell (Pyramid sub-cell) and interstitial (Octahedron Site/
  // Disphenoid) meshes get a BRAND NEW MeshStandardMaterial every time
  // one is created, with clippingPlanes never set at all. Fixed by
  // reapplying to every one of these here too, and calling this
  // function (idempotent, cheap) from onChange()/onBCCChange()/
  // onInterstitialChange() as well as the checkbox toggle, so freshly
  // created materials pick up the CURRENT clip state immediately
  // instead of only whenever the user next happens to re-toggle X-Ray.
  function updateSectionEnabled() {
    const enabled = document.getElementById('section-enable').checked;
    const planes = enabled ? [sectionPlane] : [];
    material.clippingPlanes = planes;
    bccMesh.material.clippingPlanes = planes;
    elongDodecaMesh.material.clippingPlanes = planes;
    hexPrismMesh.material.clippingPlanes = planes;
    lattice2dMeshes.forEach((m) => { m.material.clippingPlanes = planes; });
    rhombohedraMesh.material.clippingPlanes = planes;
    cuboctaMesh.material.clippingPlanes = planes;
    octGapMesh.material.clippingPlanes = planes;
    // Cube-less cells (see core/pyramid.js's hasCube()) render as a
    // Group of separate pyramid meshes rather than one Mesh -- see
    // disposePartialCellObject3D's own header for why -- so a Group's
    // own children each need the clippingPlanes update individually.
    for (const { mesh } of partialCellMeshes.values()) {
      if (mesh.isGroup) { for (const child of mesh.children) child.material.clippingPlanes = planes; }
      else mesh.material.clippingPlanes = planes;
    }
    for (const mesh of interstitialMeshes.values()) mesh.material.clippingPlanes = planes;
    for (const mesh of hemisphereMeshes.values()) mesh.material.clippingPlanes = planes;
    document.getElementById('section-controls-row').style.display = enabled ? '' : 'none';
    document.getElementById('xray-toggle')?.classList.toggle('active', enabled);
  }
  updateSectionPlane();
  updateSectionEnabled();
  document.getElementById('section-enable').addEventListener('change', updateSectionEnabled);
  for (const id of ['section-axis', 'section-flip', 'section-pos']) {
    document.getElementById(id).addEventListener('input', () => {
      updateSectionPlane();
      syncXrayHandleToSectionPlane();
    });
  }

  // World View (direct request 2026-09-02, refined mid-build: "toggle
  // between color trans or skeleton" -- one 3-way, mutually-exclusive
  // whole-world display mode, not a per-material dropdown proliferation
  // and not two independent checkboxes that could both be on at once).
  // 'translucent' reuses the exact same material set updateSectionEnabled
  // already touches for clippingPlanes (same reasoning: freshly created
  // materials -- a new bccMesh.material.clone(), a newly-placed partial
  // cell's own MeshStandardMaterial -- need the CURRENT mode reapplied
  // immediately, not just at the next manual toggle). 'skeleton' ("Ghost
  // + edges", matching the Rhombic Wheel's own SKELETON_COLOR face
  // style) hides the solid meshes and shows a separate merged-geometry
  // overlay instead -- InstancedMesh can't render THREE.EdgesGeometry's
  // line-pairs correctly (it always draws its geometry as triangles), so
  // per-instance edges aren't possible without a second mesh; the merged-
  // geometry-per-rebuild technique below is the SAME one already proven
  // 3x in this file for Lattice Quick-View/Dualize preview, not new
  // machinery. Scoped to the main World's whole+partial RD/Cube/Pyramid
  // cells for this first pass -- BCC/Cuboctahedron/interstitial pieces
  // stay solid under Skeleton for now (all optional/advanced features,
  // same "no per-cell data migration" reasoning kept this simple).
  let worldViewMode = 'color';
  let skeletonMesh = null;
  let skeletonEdges = null;
  let skeletonGeneration = 0;
  const TRANSLUCENT_OPACITY = 0.55; // matches Lattice Quick-View/Dualize preview's own established "see-through structure" opacity
  function worldViewMaterials() {
    const mats = [material, bccMesh.material, elongDodecaMesh.material, hexPrismMesh.material, ...[...lattice2dMeshes.values()].map((m) => m.material), rhombohedraMesh.material, cuboctaMesh.material, octGapMesh.material];
    for (const { mesh: m } of partialCellMeshes.values()) {
      if (m.isGroup) { for (const child of m.children) mats.push(child.material); }
      else mats.push(m.material);
    }
    for (const m of interstitialMeshes.values()) mats.push(m.material);
    for (const m of hemisphereMeshes.values()) mats.push(m.material);
    return mats;
  }
  function applyWorldViewMaterials() {
    const translucent = worldViewMode === 'translucent';
    for (const mat of worldViewMaterials()) {
      mat.transparent = translucent;
      mat.opacity = translucent ? TRANSLUCENT_OPACITY : 1;
      mat.depthWrite = !translucent;
      mat.needsUpdate = true;
    }
  }
  // Dimension-scoped visibility (2026-09-22): direct report, "2D is in
  // 3D world so... all seed shapes revolving about screen" -- 2D's own
  // Square lattice and 3D's own coexisting families (BCC/Elongated
  // Dodecahedron/Hex Prism -- all reached from WHEEL_RD_FAMILY, so
  // structurally "3D" regardless of activeDimension having no separate
  // slot for them) were ALWAYS both visible/clickable regardless of
  // which dimension is actually active, cluttering the view with the
  // other dimension's own stray seed cells. The main FCC world itself
  // (`mesh`) is deliberately NOT gated here -- that's the user's own
  // real 3D build, never a "stray seed" to hide.
  // Real follow-up report, live: the main FCC world (`mesh`) was
  // deliberately excluded from this gate at first ("that's the user's
  // own real 3D build, never a stray seed to hide") -- direct
  // correction, "can still see 3D shapes in middle of 2D scene," is
  // unambiguous that it should hide too. Nothing is deleted -- this
  // only toggles Object3D.visible, so switching back to 3D
  // (tool:selectDimension:3D, which also calls applyDimensionVisibility)
  // shows it again exactly as it was.
  // 'lattice2d:' keys (one per LATTICE_2D_COMBINATIONS entry, Phase 3)
  // replace the old hand-listed 'square2d'/'hexagon2d'/'triangle2d'
  // trio here -- a namespaced prefix check generalizes to however many
  // combinations lattice-2d.js ever defines, with no new case needed
  // per named angle or primitive added there in the future.
  function dimensionAllowsMesh(key) {
    if (activeDimension === '2D') return key.startsWith('lattice2d:');
    // '3D' or not yet chosen (activeDimension === null, e.g. mid-load):
    // default to showing 3D's own coexisting families, same as before
    // this fix existed.
    return !key.startsWith('lattice2d:');
  }
  function setSolidWorldVisible(visible) {
    mesh.visible = visible && dimensionAllowsMesh('mesh');
    bccMesh.visible = visible && dimensionAllowsMesh('bcc');
    elongDodecaMesh.visible = visible && dimensionAllowsMesh('elongdodeca');
    hexPrismMesh.visible = visible && dimensionAllowsMesh('hexprism');
    lattice2dMeshes.forEach((m, comboId) => { m.visible = visible && dimensionAllowsMesh(`lattice2d:${comboId}`); });
    rhombohedraMesh.visible = visible && dimensionAllowsMesh('rhombohedra');
    cuboctaMesh.visible = visible && dimensionAllowsMesh('cubocta');
    octGapMesh.visible = visible && dimensionAllowsMesh('octgap');
    partialCellGroup.visible = visible && dimensionAllowsMesh('mesh'); // partial (pyramid-decomposed) FCC cells -- same "main world" content as `mesh` above
    interstitialGroup.visible = visible && dimensionAllowsMesh('interstitial');
    hemisphereGroup.visible = visible && dimensionAllowsMesh('hemisphere');
    // Dot-matrix overlay + its toggle panel (Phase 4): tied to the same
    // 2D-only gate as the lattice2d tile meshes above, not to any single
    // combination -- both stay visible/reachable for as long as 2D is
    // the active dimension, regardless of which (angle, primitive) is
    // currently toggled.
    dotMatrixMesh.visible = visible && activeDimension === '2D';
    lattice2dPreviewMeshes.forEach((m) => { m.visible = visible && activeDimension === '2D'; });
    lattice2dPanel.classList.toggle('visible', activeDimension === '2D');
  }
  // Re-applies the same visibility rule whenever activeDimension itself
  // changes (not just when World View mode changes, which is
  // setSolidWorldVisible's own original trigger) -- reuses that exact
  // function with the CURRENT worldViewMode's own solid-visibility
  // intent (true unless Skeleton mode has already hidden everything),
  // so the two mechanisms never fight each other.
  function applyDimensionVisibility() {
    setSolidWorldVisible(worldViewMode !== 'skeleton');
  }
  function clearWorldViewSkeleton() {
    if (skeletonMesh) {
      skeletonMesh.parent?.remove(skeletonMesh);
      skeletonMesh.geometry.dispose();
      skeletonMesh.material.dispose();
      skeletonMesh = null;
    }
    if (skeletonEdges) {
      skeletonEdges.parent?.remove(skeletonEdges);
      skeletonEdges.geometry.dispose();
      skeletonEdges.material.dispose();
      skeletonEdges = null;
    }
  }
  // Per-cell world-space geometry for the Skeleton merge below -- same
  // whole-vs-partial split visibleCells()/isPartialCell() already use
  // for the real solid meshes, just building loose geometries instead of
  // instance matrices. Cube-less cells return one ConvexGeometry per
  // pyramid (not one merged hull) for the same "preserve internal seams,
  // avoid coincident-face z-fighting" reasoning as fccQuickViewPieces's
  // own 'pyramid' branch.
  //
  // Spherical-aware (direct follow-up 2026-09-02, "spheres dont render
  // skeletal on world view"): sphericalModeActive/sphericalGeometries/
  // partialSphereGeometryFor are declared further down this same scope
  // (spherical-toggle.js's own real-cell-shape swap) -- safe to
  // reference here since this function is only ever CALLED later, after
  // those are initialized, same as every other forward reference in
  // this file's init(). All 4 are shared/cached template geometries
  // (real cells reuse the SAME object), so always .clone() before
  // .translate() -- mutating a shared template in place would corrupt
  // every other cell using it, including Spherical Toggle's own solid
  // meshes.
  function skeletonCellPieces(cell) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    const shift = (g) => g.clone().translate(wx, wy, wz);
    if (!isPartialCell(cell)) {
      return [shift(sphericalModeActive ? sphericalGeometries.rd : buildRDGeometry(SCALE))];
    }
    // A partial cell's own sphere size depends on its real volume
    // (partialSphereGeometryFor), same for both the cube and cube-less
    // cases -- unlike the angular shapes below, no need to keep pyramids
    // as separate pieces once they're just one sphere.
    if (sphericalModeActive) return [shift(partialSphereGeometryFor(cell))];
    if (cell.cube === false) {
      const pieces = pyramidPieces(SCALE);
      return presentAxisKeys(effectivePyramids(cell)).map((axisKey) => {
        const { base, apex } = pieces.pyramids[axisKey];
        const points = [...base, apex].map(([x, y, z]) => new THREE.Vector3(x, y, z));
        return new ConvexGeometry(points).translate(wx, wy, wz);
      });
    }
    return [buildPartialCellGeometry(effectivePyramids(cell)).translate(wx, wy, wz)];
  }
  async function rebuildWorldViewSkeleton() {
    const myGeneration = ++skeletonGeneration;
    clearWorldViewSkeleton();
    const { world: w, scene: s } = activeWorldTriple();
    const cells = w ? w.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed') : [];
    const pieces = cells.flatMap(skeletonCellPieces);
    // BCC/Cuboctahedron/octahedron-gap/interstitial are real-World-only
    // (Sculpture Mode's own scratch world has no equivalents) -- direct
    // follow-up 2026-09-02 ("not all shapes showing up in skeleton"),
    // same real geometry+position recipe each one's own InstancedMesh/
    // Mesh rebuild already uses (buildBCCGeometry/buildCuboctaGeometry/
    // buildOctGapGeometry/buildInterstitialGeometry) -- or, under
    // Spherical Toggle, the same sphere templates that rebuild swaps
    // those meshes' OWN .geometry to -- just as loose geometries
    // instead of instance matrices.
    if (!sculptureModeActive) {
      for (const cell of bccWorld.entries()) {
        const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
        const g = sphericalModeActive ? sphericalGeometries.truncatedOctahedron.clone() : buildBCCGeometry(bccShapeScaleFor(SCALE));
        pieces.push(g.translate(wx, wy, wz));
      }
      for (const cell of cuboctaWorld.entries()) {
        const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
        const g = sphericalModeActive ? sphericalGeometries.cuboctahedron.clone() : buildCuboctaGeometry(SCALE);
        pieces.push(g.translate(wx, wy, wz));
      }
      for (const cell of octGapWorld.entries()) {
        const [wx, wy, wz] = octGapCellToWorld(cell.x, cell.y, cell.z, SCALE);
        const g = sphericalModeActive ? sphericalGeometries.octahedron.clone() : buildOctGapGeometry(SCALE);
        pieces.push(g.translate(wx, wy, wz));
      }
      for (const cell of interstitialStore.entries()) {
        if (sphericalModeActive) {
          const [cx, cy, cz] = disphenoidCentroid(cell.verts);
          pieces.push(disphenoidSphereTemplate.clone().translate(cx, cy, cz));
        } else {
          // Already baked in absolute world-space vertices (see
          // buildInterstitialGeometry's own header) -- no translate needed.
          pieces.push(buildInterstitialGeometry(cell.verts, SCALE));
        }
      }
    }
    if (pieces.length === 0) return;
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    if (myGeneration !== skeletonGeneration) { pieces.forEach((g) => g.dispose()); return; } // stale, see rebuildLatticeQuickView's own generation-counter precedent
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    skeletonMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
      color: SKELETON_COLOR, emissive: SKELETON_COLOR, emissiveIntensity: 0.6, flatShading: true,
      transparent: true, opacity: 0.16, depthWrite: false,
    }));
    s.add(skeletonMesh);
    skeletonEdges = new THREE.LineSegments(new THREE.EdgesGeometry(merged), new THREE.LineBasicMaterial({ color: SKELETON_COLOR }));
    s.add(skeletonEdges);
  }
  async function applyWorldViewMode() {
    if (worldViewMode === 'skeleton') {
      setSolidWorldVisible(false);
      await rebuildWorldViewSkeleton();
    } else {
      skeletonGeneration++; // invalidate any in-flight skeleton rebuild
      clearWorldViewSkeleton();
      setSolidWorldVisible(true);
      applyWorldViewMaterials();
    }
    document.getElementById('world-view-toggle')?.classList.toggle('active', worldViewMode !== 'color');
  }
  const worldViewSelect = document.getElementById('world-view-select');
  worldViewSelect?.addEventListener('change', () => {
    worldViewMode = worldViewSelect.value;
    applyWorldViewMode();
  });
  // Standalone top-right round toggle (direct correction 2026-09-02:
  // "separate position on HUD" -- NOT folded into the bottom-left
  // Piece/Material/Lattice-View quick-select row), same cycle-on-click
  // pattern as X-Ray/BCC Lattice's own toggle buttons.
  document.getElementById('world-view-toggle')?.addEventListener('click', () => {
    const modes = ['color', 'translucent', 'skeleton'];
    worldViewMode = modes[(modes.indexOf(worldViewMode) + 1) % modes.length];
    if (worldViewSelect) worldViewSelect.value = worldViewMode;
    showHudPrompt(`World View: ${worldViewMode[0].toUpperCase()}${worldViewMode.slice(1)}`, 3000);
    applyWorldViewMode();
  });
  const worldViewToggleBtn = document.getElementById('world-view-toggle');
  if (worldViewToggleBtn) worldViewToggleBtn.innerHTML = iconFrame(MARKS.worldView, { title: 'World View (tap to cycle)' });

  const xrayHandleGeometry = new THREE.PlaneGeometry(40, 40);
  const xrayHandleMaterial = new THREE.MeshBasicMaterial({
    color: 0x9de0ff,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const xrayHandle = new THREE.Mesh(xrayHandleGeometry, xrayHandleMaterial);
  xrayHandle.visible = false;
  scene.add(xrayHandle);

  const xrayGizmo = new TransformControls(camera, renderer.domElement);
  xrayGizmo.setMode('translate');
  xrayGizmo.setSize(0.8);
  xrayGizmo.visible = false;
  xrayGizmo.enabled = false;
  scene.add(xrayGizmo.getHelper ? xrayGizmo.getHelper() : xrayGizmo);
  xrayGizmo.addEventListener('dragging-changed', (e) => {
    controls.enabled = !e.value; // TransformControls/OrbitControls both want the mouse -- yield orbit while actively dragging the plane
  });

  function orientXrayHandle(axis) {
    xrayHandle.rotation.set(0, 0, 0);
    if (axis === 'x') xrayHandle.rotation.y = Math.PI / 2;
    else if (axis === 'y') xrayHandle.rotation.x = Math.PI / 2;
    // axis === 'z': PlaneGeometry's own default orientation already faces Z, no rotation needed
    xrayGizmo.showX = axis === 'x';
    xrayGizmo.showY = axis === 'y';
    xrayGizmo.showZ = axis === 'z';
  }

  function syncXrayHandleToSectionPlane() {
    if (!xrayHandle.visible) return;
    const axis = document.getElementById('section-axis').value;
    const pos = Number(document.getElementById('section-pos').value) || 0;
    orientXrayHandle(axis);
    xrayHandle.position.set(0, 0, 0);
    xrayHandle.position[axis] = pos;
  }

  xrayGizmo.addEventListener('change', () => {
    if (!xrayHandle.visible) return;
    const axis = document.getElementById('section-axis').value;
    const flip = document.getElementById('section-flip').checked;
    const pos = xrayHandle.position[axis];
    const axisVec = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    sectionPlane.setFromNormalAndCoplanarPoint(
      flip ? axisVec.clone().negate() : axisVec,
      axisVec.clone().multiplyScalar(pos)
    );
    // Keep the Lab panel's own numeric slider live too, both directions.
    const posInput = document.getElementById('section-pos');
    if (document.activeElement !== posInput) posInput.value = String(Math.round(pos * 10) / 10);
  });

  document.getElementById('xray-toggle')?.addEventListener('click', () => {
    const enableCheckbox = document.getElementById('section-enable');
    const turningOn = !enableCheckbox.checked;
    enableCheckbox.checked = turningOn;
    updateSectionEnabled();
    xrayHandle.visible = turningOn;
    xrayGizmo.visible = turningOn;
    xrayGizmo.enabled = turningOn;
    if (turningOn) {
      syncXrayHandleToSectionPlane();
      xrayGizmo.attach(xrayHandle);
      showHudPrompt('X-Ray: drag the translucent plane through the structure.', 4000);
    } else {
      xrayGizmo.detach();
    }
  });

  // B5 Duality Mode -- see docs/code-notes/render.md
  let dualityModeActive = false;
  let dualityShadowMesh = null;
  function tripleForCell(x, y, z) {
    const h = Math.abs((x * 73856093) ^ (y * 19349663) ^ (z * 83492791));
    return VALID_TRIPLES[h % VALID_TRIPLES.length];
  }
  function activeWorldTriple() {
    return sculptureModeActive
      ? { world: sculptureWorld, scene: sculptureScene }
      : { world, scene };
  }
  async function rebuildDualityShadow() {
    const { world: w, scene: s } = activeWorldTriple();
    if (dualityShadowMesh) {
      s.remove(dualityShadowMesh);
      dualityShadowMesh.geometry.dispose();
      dualityShadowMesh.material.dispose();
      dualityShadowMesh = null;
    }
    const cells = w ? w.entries() : [];
    if (cells.length === 0) return;
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    const pieces = cells.map((cell) => {
      const triple = tripleForCell(cell.x, cell.y, cell.z);
      const verts = unitTileVertices(triple.dirs).map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const geom = new ConvexGeometry(verts);
      const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
      geom.translate(wx, wy, wz);
      return geom;
    });
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    dualityShadowMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0xc88cff, flatShading: true, metalness: 0.1, roughness: 0.6 }));
    s.add(dualityShadowMesh);
  }
  document.getElementById('duality-toggle')?.addEventListener('click', async () => {
    dualityModeActive = !dualityModeActive;
    document.getElementById('duality-toggle').classList.toggle('active', dualityModeActive);
    const { world: w, scene: s } = activeWorldTriple();
    const activeMesh = sculptureModeActive ? sculptureMesh : mesh;
    activeMesh.visible = !dualityModeActive;
    if (dualityModeActive) {
      showHudPrompt('Duality: showing this structure’s real Ammann-rhombohedra shadow (a client-side render only -- your cells are untouched).', 5000);
      await rebuildDualityShadow();
    } else if (dualityShadowMesh) {
      s.remove(dualityShadowMesh);
      dualityShadowMesh.geometry.dispose();
      dualityShadowMesh.material.dispose();
      dualityShadowMesh = null;
    }
  });

  // Spherical Toggle (docs/RHOMBIVERSE_SPEC_ADDENDUM_SPHERICAL_TOGGLE.md),
  // Stage 1 -- a client-side view swap only, same spirit as Duality above
  // (your cells are untouched). Covers every real placeable piece type.
  // No ring/torus grouping of any kind, by direct instruction -- not
  // deferred, ruled out entirely: disphenoids always convert
  // individually below, never merged into a torus, no matter how many
  // same-type cells share an axis. EVERY shape renders as a plain
  // sphere now -- no superellipsoid in active use ("revert to sphere",
  // direct instruction) and no third volumeSphere render mode either
  // (that's not a different shape anyway, just a different radius choice
  // for a sphere). See sphericalClassificationFor's own header for the
  // real governing rule behind each shape's radius (many faces ->
  // volume-matched, few faces -> face-plane distance). For the 4
  // InstancedMesh piece families (RD/Octahedron/Cuboctahedron/Truncated
  // Octahedron), every instance already shares one BufferGeometry, so
  // toggling the view is just swapping which geometry object each mesh
  // points at. Disphenoid and Cube are different (own Mesh per cell, no
  // InstancedMesh) -- handled separately below.
  // Deliberately NOT applied to sculptureMesh (own separate concern) or
  // the Lattice Zoom sub-lattice/aggregate-speckle meshes (also reuse
  // `geometry`/buildRDGeometry at other scales) -- out of scope for this
  // stage, and safe to leave alone: reassigning mesh.geometry only
  // changes that one InstancedMesh's own property, not the underlying
  // object other meshes still reference.
  let sphericalModeActive = false;
  const sphericalShapes = sphericalClassificationFor(SCALE);
  const sphericalGeometries = {
    rd: buildSphericalGeometry(sphericalShapes.rd),
    octahedron: buildSphericalGeometry(sphericalShapes.octahedron),
    cuboctahedron: buildSphericalGeometry(sphericalShapes.cuboctahedron),
    truncatedOctahedron: buildSphericalGeometry(sphericalShapes.truncatedOctahedron),
  };
  const originalGeometries = {
    rd: geometry,
    octahedron: octGapGeometry,
    cuboctahedron: cuboctaGeometry,
    truncatedOctahedron: bccGeometry,
  };
  // Disphenoid (interstitial-lattice, incl. the "Flattened Octahedron"
  // bundle -- 4 disphenoids around a shared axis, no separate primitive,
  // see interstitial-lattice.js's own header): each cell is its own real
  // Mesh with the cell's real WORLD-SPACE coordinates baked directly
  // into its geometry (no separate .position, same convention
  // buildInterstitialGeometry already uses) -- not InstancedMesh, since
  // each disphenoid has its own unique orientation. Disphenoids are all
  // congruent (isosceles tetrahedra, only orientation/position differs)
  // and genuinely uniform face-distance from their own centroid --
  // Section 1 case 2, plain sphere.
  //
  // Simplified back from a real pairwise-merge + neighbor-aware-capping
  // attempt (kept in git history, not repeated here) after direct
  // live-testing feedback the same day: a merged pair next to two
  // still-small individual spheres in the same 4-disphenoid bundle read
  // as an inconsistent, lumpy composition ("looks weird"). Direct
  // instruction: "disphenoid one max size sphere, flattened octahedron
  // four max sized spheres is better" -- every disphenoid, alone or in
  // a full bundle, always renders at its own uncapped volume-matched
  // radius, full stop, no pairing, no neighbor-presence checking at
  // all. In a full 4-bundle the 4 spheres DO overlap each other at this
  // size (confirmed acceptable, unlike the ruled-out torus/fusion
  // look -- 4 distinct big spheres reads differently than one smooth
  // merged ring surface even with real overlap between them).
  //
  // Open follow-up, explicitly requested, NOT implemented ("I would
  // like to try the other alternative"): an anisotropic ellipsoid,
  // volume-preserving but compressed toward a close neighbor and
  // stretched elsewhere, instead of a plain sphere. Real and buildable
  // in principle (superellipsoidPoint's formula generalizes cleanly to
  // 3 independent semi-axes), but only ever a PARTIAL fix for this
  // specific shape: a disphenoid's 4 real face directions are not
  // mutually orthogonal, so one 3-axis ellipsoid can't respect all 4 at
  // once in a full bundle (where every direction has a real neighbor)
  // -- and it needs a genuinely new per-cell rotation/orientation step,
  // unlike every other shape here (translation only). Discussed and
  // deliberately deferred, not silently dropped -- see
  // project_rhombiverse_spherical_toggle.md.
  const disphenoidFreeR = volumeMatchedRadius((2 / 3) * SCALE ** 3);
  const disphenoidSphereTemplate = buildSphericalGeometry({ mode: 'sphere', R: disphenoidFreeR });
  const disphenoidOriginalGeometries = new Map(); // key -> original Mesh geometry
  function disphenoidCentroid(verts) {
    const world = disphenoidVertsToWorld(verts, SCALE);
    return [0, 1, 2].map((i) => world.reduce((s, v) => s + v[i], 0) / world.length);
  }
  function applySphericalToDisphenoids(active) {
    for (const [key, m] of interstitialMeshes) {
      if (active) {
        if (!disphenoidOriginalGeometries.has(key)) disphenoidOriginalGeometries.set(key, m.geometry);
        const cell = interstitialStore.entries().find((c) => c.key === key);
        if (!cell) continue;
        const [cx, cy, cz] = disphenoidCentroid(cell.verts);
        const sphereGeom = disphenoidSphereTemplate.clone();
        sphereGeom.translate(cx, cy, cz);
        m.geometry = sphereGeom;
      } else {
        const original = disphenoidOriginalGeometries.get(key);
        if (original) m.geometry = original;
      }
    }
  }

  // Cube and Pyramid pieces (Pyramid Sub-Cell, `partialCellMeshes` --
  // see core/pyramid.md): rendered per-cell, not InstancedMesh, but unlike
  // Disphenoid above each of these DOES use a real object3D.position
  // (buildPartialCellObject3D), so a shared sphere geometry can be
  // swapped in directly, same as the 4 InstancedMesh families -- just
  // one geometry per real (cube present?, pyramid count) combination
  // rather than a single shared one, since the cell's own real volume
  // (and so its correctly-sized sphere) depends on both.
  //
  // Direct instruction (2026-09-01): every pyramid-based cell (1
  // through 6 pyramids, with or without a cube) gets the SAME
  // min(volume-matched, real tangent ceiling) rule already used for
  // every other shape, fed that cell's own real combined volume --
  // not a separate hardcoded per-count table, and not distinct shape
  // primitives (a spherical cap for 1, an ellipsoid for 2, etc. --
  // considered and explicitly turned down in favor of this simpler,
  // already-built formula). Real volume: cube (scale^3, only if
  // present) + presentCount * (scale^3/6) -- PYRAMID_VOLUME below is
  // exactly 1/6 of RD's own 2*scale^3 volume (RD = cube + 6 pyramids).
  // Ceiling: same as RD/Cube's own (scale/sqrt(2)) -- every one of
  // these cells sits at a real main-world FCC lattice point, sharing
  // that exact same real neighbor spacing (sqrt(2)*scale) regardless
  // of which pyramids happen to be present on it.
  // A cube-less pyramid-only cell renders as a THREE.Group of
  // individual pyramid Meshes (buildPyramidOnlyMeshes), not a single
  // Mesh -- Groups have no .geometry to swap, so instead its children
  // are hidden and one sphere Mesh is added as an extra child (in the
  // Group's own LOCAL space, so it inherits the Group's real
  // object3D.position automatically).
  const PYRAMID_VOLUME = SCALE ** 3 / 6;
  const PARTIAL_CEILING = SCALE / Math.SQRT2; // same real ceiling as RD/Cube -- same lattice
  function partialCellVolume(cell) {
    const count = presentAxisKeys(effectivePyramids(cell)).length;
    return (hasCube(cell) ? SCALE ** 3 : 0) + count * PYRAMID_VOLUME;
  }
  const partialSphereGeometryCache = new Map(); // volume (fixed-precision key) -> geometry
  function partialSphereGeometryFor(cell) {
    const volume = partialCellVolume(cell);
    const key = volume.toFixed(9);
    if (!partialSphereGeometryCache.has(key)) {
      const R = Math.min(volumeMatchedRadius(volume), PARTIAL_CEILING);
      partialSphereGeometryCache.set(key, buildSphericalGeometry({ mode: 'sphere', R }));
    }
    return partialSphereGeometryCache.get(key);
  }
  const partialOriginalGeometries = new Map(); // cellKey string -> original Mesh geometry
  const partialAddedSphereMeshes = new Map(); // cellKey string -> sphere Mesh added to a cube-less Group
  function applySphericalToPartials(active) {
    for (const [key, entry] of partialCellMeshes) {
      if (hasCube(entry.cell)) {
        if (active) {
          if (!partialOriginalGeometries.has(key)) partialOriginalGeometries.set(key, entry.mesh.geometry);
          entry.mesh.geometry = partialSphereGeometryFor(entry.cell);
        } else {
          const original = partialOriginalGeometries.get(key);
          if (original) entry.mesh.geometry = original;
        }
      } else if (active) {
        if (!partialAddedSphereMeshes.has(key)) {
          const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
          mat.color.copy(instanceColorFor(entry.cell));
          const sphereMesh = new THREE.Mesh(partialSphereGeometryFor(entry.cell), mat);
          entry.mesh.children.forEach((c) => { c.visible = false; });
          entry.mesh.add(sphereMesh);
          partialAddedSphereMeshes.set(key, sphereMesh);
        }
      } else {
        const sphereMesh = partialAddedSphereMeshes.get(key);
        if (sphereMesh) {
          entry.mesh.remove(sphereMesh);
          sphereMesh.material.dispose();
          entry.mesh.children.forEach((c) => { c.visible = true; });
          partialAddedSphereMeshes.delete(key);
        }
      }
    }
  }

  document.getElementById('spherical-toggle')?.addEventListener('click', () => {
    sphericalModeActive = !sphericalModeActive;
    document.getElementById('spherical-toggle').classList.toggle('active', sphericalModeActive);
    const active = sphericalModeActive ? sphericalGeometries : originalGeometries;
    mesh.geometry = active.rd;
    octGapMesh.geometry = active.octahedron;
    cuboctaMesh.geometry = active.cuboctahedron;
    bccMesh.geometry = active.truncatedOctahedron;
    applySphericalToDisphenoids(sphericalModeActive);
    applySphericalToPartials(sphericalModeActive);
    // Skeleton's own merged overlay isn't one of the meshes swapped
    // above -- rebuild it too if it's the one currently showing, or it
    // would keep showing the OLD (angular or spherical) shapes until
    // the next unrelated World View change. See skeletonCellPieces's
    // own header.
    if (worldViewMode === 'skeleton') rebuildWorldViewSkeleton();
    showHudPrompt(sphericalModeActive
      ? 'Spherical: every real placeable shape shown as a true sphere -- a client-side view only, your cells are untouched.'
      : 'Spherical: off.', 5000);
  });

  // BCC dual-lattice Phase 2 (third revision, 2026-08-25) -- Rhombeometry-
  // only. A real, connected, globally-consistent BCC lattice sharing the
  // FCC world's own coordinate frame, seeded near the camera -- "a
  // cohesive master lattice together with FCC," "mathematically
  // consistent and interchangeable," per direct instruction. Additive to
  // the real RD world (never touches worldstate); see
  // geometry-extensions/bcc-detail-lattice.js for the full history of why
  // this design replaced two earlier attempts (a same-scale overlay, then
  // a per-cell-contained nested cluster -- both real, reasoned dead ends,
  // not guesses).
  // Rhombic Wheel 3D: second, parallel navigation wheel on the real RD
  // mesh (see app/rhombic-wheel-3d.js). Flag-gated off by default;
  // leaves the existing 2D wheel.js untouched. onAction resolves every
  // action createRhombicWheel3D doesn't resolve internally -- that's
  // navigateTo:<a real wheel id> and navigateHome (handled inside
  // createRhombicWheel3D itself), everything else lands here.
  // No feature flag -- this is the sole navigation surface now (the
  // old 2D wheel.js was removed 2026-08-25), always on, not optional.
  const rhombicWheel3DToggleBtn = document.getElementById('rhombic-wheel-3d-toggle');
  // Almanac (docs/RHOMBIVERSE_SPEC_ALMANAC.md, Stage 1): created once,
  // same lifetime as wheel3D/cyborg/lab below -- its own overlay handles
  // its open/closed state internally (open()/close()/toggle()), this
  // scope just needs a stable reference to call into from onAction.
  const almanac = createAlmanac();
  {
    // handleWheelAction: extracted to a named function (2026-09-22,
    // dimension-select wheel) so the dedicated dimensionWheel3D instance
    // can dispatch through the exact SAME real-action path the shared
    // wheel itself uses (e.g. tool:pieceType:rd/to for FCC/BCC) rather
    // than duplicating any of this logic -- "one tool, one doorway"
    // extended to a second real caller, not a second implementation.
    // Safe to reference wheel3D before its own declaration below: this
    // function's body only reads
    // wheel3D when actually CALLED (a later click), by which time the
    // const just below has long since been assigned -- the exact same
    // closure timing this arrow function already relied on before the
    // extraction, just now also reachable from outside createRhombicWheel3D.
    const handleWheelAction = (action) => {
        // openCyborg/openLab reuse the real, already-shipped toggles.
        // openAlmanac now opens the real Almanac overlay (Stage 1 --
        // previously just a "not built yet" toast).
        // (openLenses/X-Ray was dropped from the universal ring
        // 2026-08-29 -- X-Ray stays reachable via the corner HUD wheel's
        // own #xray-toggle face and the Lab panel, so no wheel face
        // routes to it here any more.)
        if (action === 'openCyborg') { wheel3D.close(); cyborgToggleEl?.click(); return; }
        if (action === 'openLab') { wheel3D.close(); labToggleEl?.click(); return; }
        if (action === 'openAlmanac') { wheel3D.close(); almanac.open(); return; }
        // Real tool wiring below -- reuses existing, already-working
        // primitives (mode-btn clicks, panel-open functions) rather
        // than reimplementing anything, same pattern as Explore's
        // #walk-toggle reuse above. Confidence varies per action; see
        // each comment. clickMode() mirrors wheel.js's own
        // clickModeShim(): find the real .mode-btn[data-mode=X] and
        // click it, since that's the actual state-changing primitive
        // both wheels should share.
        const clickMode = (modeName) => document.querySelector(`.mode-btn[data-mode="${modeName}"]`)?.click();

        // --- Alter: Dig/Smooth are direct 1:1 mode matches, high
        // confidence. Replace is a pre-existing dead end, discovered
        // while wiring this: wheel.js's own 2D "Replace" item calls
        // clickModeShim('replace'), but there is no
        // .mode-btn[data-mode="replace"] anywhere in index.html and no
        // `currentMode === 'replace'` handling anywhere in render.js --
        // the 2D button is already a silent no-op today. Not
        // reproducing that silently here; flagged as not built yet
        // instead of pretending it's wired. ---
        if (action === 'tool:dig') { clickMode('excavate'); wheel3D.close(); return; }
        if (action === 'tool:smooth') { clickMode('round'); wheel3D.close(); return; }
        if (action === 'tool:replace') { showHudPrompt('Replace is not built yet (the 2D menu\'s Replace button is a pre-existing no-op too).', 4000); return; }

        // --- Build: direct matches, high confidence ---
        // Universal Add/Remove, direct instruction 2026-08-26: retires the
        // separate Rhombi-model/Pyramid-model/Cube-model (and their own
        // -sculpt counterparts) as distinct buttons -- ONE Add and ONE
        // Remove, both piece-tier-aware via the new Piece picker below
        // (core/build.js's getPieceType()). 'build'/'chisel' are the
        // internal mode strings (unchanged/new respectively); the LABELS
        // are the generic ones now. Was "Rhombi-model" (tool:rhombiModel).
        if (action === 'tool:add') { clickMode('build'); wheel3D.close(); return; }
        if (action === 'tool:fill') { clickMode('fill'); wheel3D.close(); return; }
        // Was "Rhombi-sculpt" (tool:rhombiSculpt) -- same rich brush/
        // mirror/symmetry panel as always, just renamed so it doesn't
        // read as a same-job-different-name twin of the new plain Remove
        // action below (that confusion was the whole point of this pass).
        if (action === 'tool:symmetry') { clickMode('sculpt'); openSculptPanel(); wheel3D.close(); return; }
        // New: a plain "click a piece, it's gone" action -- piece-tier
        // aware (RD/Cube = the whole cell, Pyramid = just that one
        // pyramid). Real logic in core/build.js's 'chisel' mode.
        if (action === 'tool:remove') { clickMode('chisel'); wheel3D.close(); return; }
        // Piece tiers: terminal actions from the real WHEEL_PIECE layer
        // (rhombic-wheel-3d-core.js), replacing the old separate
        // piece-cluster-3d.js widget/pickers.openPieceTypePicker
        // 2026-08-28 -- direct feedback was to use "the same main real
        // wheel" for this instead of a bespoke second scene.
        //
        // 2026-08-29 -> 2026-08-31: Material used to live on this same
        // WHEEL_PIECE screen (its own top|sy1sz1 face) so shape+Material
        // could be picked "close together," with this action
        // deliberately staying open afterward rather than closing, so
        // the player could navigate there next. Direct user feedback
        // 2026-08-31: a real color swatch sitting among the wheel's own
        // monochrome marks read as a genuine visual outlier, and it was
        // sometimes hard to find besides. Replaced: Material's wheel
        // face is gone (freeing that slot for Octahedron, see
        // rhombic-wheel-3d-core.js), and picking ANY piece here now
        // opens the real color-swatch overlay directly -- same
        // `pickers.openColorPicker` call tool:color's own handler
        // below uses, so there's exactly one color-picker code path,
        // not two. wheel3D now closes here too, matching every other
        // terminal tool: action -- there's no more Material face left on
        // this screen to stay open for.
        // WHEEL_HOME's "Change Dimension" face (repurposed spare, see
        // that wheel's own header comment). Opens the dedicated
        // dimensionWheel3D instance -- a SEPARATE wheel/overlay from
        // this shared one (see WHEEL_DIMENSION's own header in
        // rhombic-wheel-3d-core.js for the full history/reasoning). One
        // of dimensionWheel3D's two routes in (the other: force-opened
        // once on load, see init()'s own comment below) -- both land on
        // the SAME single instance, not two different ones.
        if (action === 'tool:changeDimension') {
          wheel3D.close();
          dimensionWheel3D.open('dimension');
          return;
        }
        if (action.startsWith('tool:pieceType:')) {
          const value = action.slice('tool:pieceType:'.length);
          const PIECE_LABELS = {
            rd: 'RD', cube: 'Cube', pyramid: 'Pyramid', to: 'Truncated Octahedron', ioct: 'Flattened Octahedron', octahedron: 'Octahedron', idis: 'Disphenoid', halfrd: 'Hemi RD', hourglass: 'Hourglass', hemi3: 'Corner Cluster', hemi4: 'Band Cluster', hemiTri: 'Triangle Cluster', elongdodeca: 'Elongated Dodecahedron', rdquarter: 'RD Quarter (rhombohedron)', hexprism: 'Hexagonal Prism', rhombohedra: 'Rhombohedra',
            // 2D lattice tier (Phase 3): one label per LATTICE_2D_COMBINATIONS
            // entry, generated rather than hand-listed (replaces the old
            // square2d/hexagon2d/triangle2d trio) so a new named angle or
            // primitive never needs a matching new label added here.
            ...Object.fromEntries(LATTICE_2D_COMBINATIONS.map((c) => [`lattice2d:${c.id}`, c.label])),
          };
          document.getElementById('piece-type-select').value = value;
          // Real bug, caught live 2026-08-29: picking a piece type here
          // only ever updated the <select> value -- it never touched
          // currentMode. A player who'd entered some OTHER mode first
          // (most commonly Cuboctahedron/BCC Build, now trivially easy
          // to reach from this same wheel) stayed stuck there: the piece
          // indicator and this HUD prompt both said the pick worked, but
          // every subsequent World click kept routing to whichever build
          // mode was still active, not the intended Add -- "not even
          // letting me place RD" was this, not a placement-logic bug.
          // 'build'/'chisel' (Add/Remove) are both genuinely piece-type-
          // aware -- e.g. Remove + Pyramid removes just one pyramid -- so
          // those are left alone; anything else falls back to plain Add,
          // since picking what to place only makes sense there.
          if (currentMode !== 'build' && currentMode !== 'chisel') clickMode('build');
          updateHudIndicator();
          showHudPrompt(`Piece: ${PIECE_LABELS[value] ?? value}`, 3000);
          wheel3D.close();
          pickers.openColorPicker((matValue, matLabel) => showHudPrompt(`Color: ${matLabel}`, 3000));
          return;
        }
        // Reuses the 2D wheel's own color-picker overlay (a real,
        // already-independent DOM overlay, not part of its radial
        // LEVEL1/LEVEL2 visuals) via the openColorPicker export added
        // to wheel.js -- filling a real feature into a spare slot, not
        // inventing one. See rhombic-wheel-3d-core.js. Action renamed
        // from 'tool:material' 2026-09-23 (direct instruction: "it
        // should be color picker/color... etc") to match its own
        // WHEEL_PIECE face label, already renamed to "Color".
        if (action === 'tool:color') {
          wheel3D.close();
          pickers.openColorPicker((value, label) => showHudPrompt(`Color: ${label}`, 3000));
          return;
        }
        // Real toggle, same as the 2D wheel's own "Repeat" leaf --
        // reuses wheel.js's toggleDragPlacement() rather than
        // duplicating the drag-placement state/logic here.
        if (action === 'tool:repeat') {
          const enabled = pickers.toggleDragPlacement();
          showHudPrompt(
            enabled
              ? 'Repeat armed: drag across faces to place a run of cells. Camera orbit is off while Repeat is active -- pick Rhombi-model to get it back.'
              : 'Repeat off.',
            4500
          );
          wheel3D.close();
          return;
        }
        // Matches the 2D wheel's own real capability exactly -- Pattern
        // is a "coming soon" placeholder there too, not a real feature
        // being withheld here.
        if (action === 'tool:pattern') { showHudPrompt('Pattern stamping is coming soon.', 3000); return; }

        // --- Piece: Cuboctahedron Build (core/cubocta-build.js), the RD
        // lattice's own dual shape -- 2026-08-29, freed onto Piece's
        // top|sy1sz1 slot by dropping Lenses from the universal ring.
        // Same Rhombeometry-only defense-in-depth check the retired
        // standalone BCC Build face used to have (even though
        // #cubocta-build-toggle is already hidden by CSS in Full World).
        //
        // 2026-08-29 SAME-DAY FIX, real bug caught live: this used to
        // close the wheel immediately (BCC Build's own pattern), unlike
        // every OTHER face on this wheel (tool:pieceType:*), which all
        // deliberately stay open so Material can be picked right after.
        // Direct report: "exactly the same bug in every way I described"
        // -- i.e. the wheel not reopening for Material, the quick-select
        // icon never updating -- once every other Piece option got fixed
        // to behave consistently, Cuboctahedron sitting on the SAME
        // wheel but behaving differently just reads as still-broken.
        // Fixed to match: stays open (Material reachable immediately,
        // same tap-empty-space-to-dismiss gesture as everything else on
        // this wheel), and updateHudIndicator() (called via clickMode's
        // own mode-btn handler) now shows a real Cuboctahedron icon on
        // the bottom-left quick-select while this mode is active -- see
        // updateQuickSelect()'s own header comment.
        //
        // Toast shortened to match tool:pieceType:*'s own "Piece: <X>"
        // format exactly -- direct instruction ("it will just say CO
        // like RD does"). The longer click/grow/right-click-removes
        // explanation this toast used to carry isn't lost -- it's
        // MODE_HINTS.cubocta above, already shown persistently in the
        // Lab panel's mode-hint line the whole time this mode is active,
        // the same place every other mode's own instructions live.
        //
        // Real gap, direct report 2026-09-01 ("cube-octahedron doesnt
        // go to color wheel when opened"): "stays open" above only ever
        // meant the WHEEL stayed open -- the actual openMaterialPicker
        // call every tool:pieceType:* pick makes right after was never
        // actually added here, across this handler's entire history
        // (confirmed via git log -- the comment's own "Material
        // reachable immediately" claim was aspirational, not real). The
        // color WAS always changeable via the separate tool:material
        // quick-select, just never auto-opened the way every other
        // Piece already does. Added below, matching tool:pieceType:*'s
        // own call exactly.
        //
        // STILL-OPEN-WHEEL BUG, direct report 2026-09-02 ("when selected
        // the color wheel appears behind instead of in front so
        // impossible to select"): the "stays open" design above was
        // written before openMaterialPicker was ever really wired in
        // here (see the paragraph just above) -- once it was, the wheel
        // (z-index 990) kept covering the picker strip (z-index 985,
        // wheel-pickers.js), since the wheel was still open when the
        // picker opened. tool:pieceType:* never hit this because IT
        // already calls wheel3D.close() first (line ~3026). Matching
        // that here too -- Material is still reachable immediately
        // (right after this click, not "stay open in case"), it's just
        // reachable through a picker that isn't hidden behind the wheel
        // anymore.
        if (action === 'tool:cuboctaBuild') {
          if (!FEATURES.bccLattice) {
            wheel3D.close();
            showHudPrompt('Cuboctahedron Build is Rhombeometry-only -- switch modes in the Settings panel first.', 4000);
            return;
          }
          clickMode('cubocta');
          showHudPrompt('Piece: CO', 3000);
          wheel3D.close();
          pickers.openColorPicker((value, label) => showHudPrompt(`Color: ${label}`, 3000));
          return;
        }

        // --- Rhombitect: JUDGMENT CALL. "Dome" is a real sculpt-panel
        // NL shape keyword (src/core/sculpture.js's shape parser
        // recognizes "dome"); prefilling it is a real, grounded action,
        // not invented, but was never a documented 1-click wheel
        // action before now. Spiral Column and Templates have no
        // backing mechanic anywhere in the codebase -- genuine stubs,
        // not a wiring gap. ---
        if (action === 'tool:dome') {
          clickMode('sculpt');
          openSculptPanel();
          const input = document.getElementById('sculpt-nl-input');
          if (input) input.value = 'dome';
          showHudPrompt('Dome shape ready in the Sculpt panel -- press Go to build it.', 4000);
          wheel3D.close();
          return;
        }
        if (action === 'tool:spiralColumn' || action === 'tool:templates') { showHudPrompt(`${action.slice(5)} is not built yet.`, 3000); return; }

        if (action?.startsWith('tool:')) { showHudPrompt(`${action.slice(5)} is not built yet.`, 3000); return; }
    };
    const wheel3D = createRhombicWheel3D({
      getWorkspaceMode: () => workspaceMode,
      onAction: handleWheelAction,
    });
    refreshWheel3D = () => wheel3D.refresh();
    // Direct instruction 2026-08-26: "there should always automatically
    // be 1 cell because you open cell place menu." Real gap found live --
    // every whole-cell Add mode (RD/Cube/TO) places a NEW cell adjacent
    // to a face you click, so a genuinely empty world (reachable by
    // simply removing the last cell -- nothing currently stops that) has
    // no face for anything to click, and clicking anywhere silently does
    // nothing forever after, unrecoverable except via Clear World/Reload.
    // The single real fix point: wheel3D.open() is the only place the
    // wheel/build menu ever actually opens (every other wheel3D call in
    // this file is .close()), so seeding here guarantees a real cell
    // exists before the player can reach any Add/Remove tool at all.
    function seedIfWorldEmpty() {
      if (world.entries().length === 0) {
        world.addCell(0, 0, 0, { material: materialSelect.value });
        onChange();
      }
    }
    // Dimension-select wheel (2026-09-22, 3rd iteration): a SEPARATE
    // createRhombicWheel3D() instance, dedicated only to WHEEL_DIMENSION
    // -- never navigated to/from wheel3D (the shared Build/Piece nav
    // wheel), its own overlay/scene, direct instruction ("one moving
    // rhombic wheel with all dimensions selectable... a dedicated
    // rotating wheel just for dimensions"). Replaces the earlier
    // wireframe-card wizard (dimension-wizard.js, now archived --
    // src/world-systems-archived/dimension-wizard.js).
    //
    // Its own onAction, NOT handleWheelAction directly: the universal-
    // ring actions (openCyborg/openLab/openAlmanac) need to close THIS
    // wheel instance, not wheel3D (handleWheelAction's own `wheel3D.
    // close()` calls would close the wrong, already-closed instance and
    // leave this one sitting open on top of Settings/Cyborg/Almanac).
    // navigateHome/navigateTo: are intercepted inside createRhombicWheel3D's
    // own dispatchAction before ever reaching onAction, so nothing
    // special is needed for the 5th-slot Home face -- it already
    // switches this same instance to WHEEL_HOME's own content.
    const dimensionWheel3D = createRhombicWheel3D({
      instanceId: 'dimension',
      getWorkspaceMode: () => workspaceMode,
      onAction: (action) => {
        if (action === 'tool:selectDimension:3D') {
          activeDimension = '3D';
          applyDimensionVisibility();
          applyDimensionCamera('3D');
          seedIfWorldEmpty();
          dimensionWheel3D.close();
          handleWheelAction('tool:pieceType:rd');
          return;
        }
        // 2D (Phase 3): every lattice2dWorlds entry is already seeded at
        // construction (see its own "seed here, not just in the change
        // handler" comment above) -- unlike 3D there's no separate world
        // to seed here, just select a default piece type. Defaults to
        // the Square/Parallelogram combination (LATTICE_2D_COMBINATIONS'
        // own first entry -- NAMED_LATTICE_ANGLES/LATTICE_PRIMITIVES are
        // both ordered with Square/Parallelogram first specifically so
        // this default stays meaningful without hardcoding its id here),
        // matching this quick dimension-wheel shortcut's own "just pick
        // A reasonable default, the full picker is dimension-wizard.js's
        // job" role -- same relationship 3D's own 'rd' default above has
        // to its own wizard screen.
        if (action === 'tool:selectDimension:2D') {
          activeDimension = '2D';
          applyDimensionVisibility();
          applyDimensionCamera('2D');
          dimensionWheel3D.close();
          handleWheelAction(`tool:pieceType:lattice2d:${LATTICE_2D_COMBINATIONS[0].id}`);
          return;
        }
        // WHEEL_DIMENSION's own noUniversalRing:true (see that config's
        // own header) means Cyborg/Settings are no longer reachable
        // faces on this wheel at all -- only Almanac stays, doubled on
        // its own antipodal pair ("maybe almanac too doubled for all
        // 12"), so this is the one universal-ring action still live here.
        if (action === 'openAlmanac') { dimensionWheel3D.close(); almanac.open(); return; }
      },
    });
    // Dimension wizard: a SECOND, parallel entry point inside a
    // dimension's own sandbox -- direct instruction ("wheel is entry
    // point of whole rhombiverse[,] then whichever dimension['s] scene
    // opens[:] bottom left for menu wheel or top left for wireframe
    // wizard... similar to Polyhedraverse[,] except one more entry
    // wheel"). Polyhedraverse keeps its own wheel and card-browser as
    // two deliberately separate, parallel surfaces (confirmed directly
    // against its own page.tsx); rhombiverse's dedicated dimension wheel
    // above is the "one more" on top of that same pattern. This is the
    // exact same wizard/onSelectFamily wiring as before -- only WHEN
    // it's reachable changed (no longer forced open on load, that's
    // dimensionWheel3D's own job now; reachable any time via the new
    // top-left #hud-wizard-cue instead).
    const dimensionWizard = createDimensionWizard({
      // Real bug fixed same session: this used to hardcode
      // activeDimension = '3D' regardless of which of the wizard's own
      // screens the pick came from, so choosing Square from its 2D
      // screen incorrectly left activeDimension at '3D' -- wrong for
      // applyDimensionVisibility's own dimension-scoped mesh toggling.
      // dimension-wizard.js's own showLattice2D/showLattice3D now pass
      // the real dimension alongside the action.
      onSelectFamily: (dimension, action) => {
        activeDimension = dimension;
        applyDimensionVisibility();
        applyDimensionCamera(dimension);
        if (dimension === '3D') seedIfWorldEmpty();
        handleWheelAction(action);
      },
    });
    document.getElementById('hud-wizard-cue')?.addEventListener('click', () => dimensionWizard.open());
    function toggleWheel3D() {
      if (pickers.isAnyPickerOpen()) { pickers.closeAnyPicker(); return; }
      if (wheel3D.isOpen) wheel3D.close();
      else { seedIfWorldEmpty(); wheel3D.open('home'); }
    }
    rhombicWheel3DToggleBtn?.addEventListener('click', toggleWheel3D);
    isRhombicWheel3DOpen = () => wheel3D.isOpen || dimensionWheel3D.isOpen;

    // Dimension-select wheel: the app's real entry gate now -- every
    // load force-opens this dedicated wheel, in place of the old
    // default of landing in the 3D FCC sandbox with nothing open. No
    // persistence/skip (matches activeDimension's own "in-memory only"
    // comment above): every fresh load asks again.
    dimensionWheel3D.open('dimension');

    // Reclaims Tab/Space/hud-wheel-cue from the old 2D wheel -- same
    // entry points, now driving the sole (3D) wheel.
    document.getElementById('hud-wheel-cue')?.addEventListener('click', toggleWheel3D);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Tab' && e.code !== 'Space' && e.code !== 'Escape') return;
      // Don't hijack these when typing into a real form control (the
      // Lab panel has plenty of <input>/<select> elements).
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Escape') {
        if (pickers.isAnyPickerOpen()) pickers.closeAnyPicker();
        else if (wheel3D.isOpen) wheel3D.close();
        else if (dimensionWheel3D.isOpen) dimensionWheel3D.close();
        return;
      }
      e.preventDefault();
      toggleWheel3D();
    });

    // Bottom-left quick-select icons (their own innerHTML is refreshed
    // further down, near updateHudIndicator) reopen straight to where
    // that value gets changed -- the real Piece wheel screen / the real
    // Color picker overlay -- not back through Home, matching the
    // direct request's own "reopens at selection" wording. Wired here,
    // via a fresh getElementById rather than the outer quickShapeEl/
    // quickMaterialEl consts, since wheel3D/toggleWheel3D/
    // seedIfWorldEmpty only exist in THIS block's own scope, and those
    // outer consts are declared LATER in init() -- referencing them here
    // would read them before their own initializer line has run (a real
    // TDZ crash hit live: "Cannot access 'quickShapeEl' before
    // initialization"). pickers, unlike quickShapeEl/quickMaterialEl, is
    // only ever touched inside the deferred click callback body below
    // (never synchronously at registration time), so it's fine to
    // reference even though createWheelPickers itself runs later still --
    // same pattern this block's own onAction callback already relies on.
    document.getElementById('hud-quick-shape')?.addEventListener('click', () => {
      if (pickers.isAnyPickerOpen()) pickers.closeAnyPicker();
      seedIfWorldEmpty();
      wheel3D.open('piece');
    });
    document.getElementById('hud-quick-color')?.addEventListener('click', () => {
      if (wheel3D.isOpen) wheel3D.close();
      pickers.openColorPicker((value, label) => showHudPrompt(`Color: ${label}`, 3000));
    });
  }

  const bccToggleBtn = document.getElementById('bcc-toggle');
  if (bccToggleBtn) bccToggleBtn.style.display = FEATURES.bccLattice ? '' : 'none';
  // Bottom-left Lattice View quick-select icon -- same Rhombeometry-only
  // gating as the corner HUD wheel's own "BCC Lattice" face, since it
  // drives the exact same underlying cycle (see cycleLatticeQuickView).
  const hudQuickLatticeViewEl = document.getElementById('hud-quick-lattice-view');
  if (hudQuickLatticeViewEl) hudQuickLatticeViewEl.style.display = FEATURES.bccLattice ? '' : 'none';
  // Real Cuboctahedron cell placement -- same Rhombeometry-only gating.
  // Lab-panel entry point kept alongside the real wheel face (Piece:CO)
  // as a second doorway to the same mode -- not code duplication, both
  // just call clickMode('cubocta').
  const cuboctaBuildRow = document.getElementById('cubocta-build-row');
  if (cuboctaBuildRow) cuboctaBuildRow.style.display = FEATURES.bccLattice ? '' : 'none';
  // Dualize preview (reframe Stage 3): same Rhombeometry-only gating as
  // the rest of the BCC/TO family -- Lab-panel entry point rather than a
  // wheel face; a wheel face can follow later once a commit path exists
  // to make it a more central tool.
  const dualizeRow = document.getElementById('dualize-row');
  if (dualizeRow) dualizeRow.style.display = FEATURES.bccLattice ? '' : 'none';
  // Piece picker's TO option (core/build.js's handleToClick) -- same
  // Rhombeometry-only gating as the rest of BCC's own UI. A disabled
  // option can't be selected via the <select> itself; getPieceType()
  // reading 'to' at all already implies this feature is on.
  const pieceTypeToOption = document.getElementById('piece-type-to-option');
  if (pieceTypeToOption) {
    pieceTypeToOption.disabled = !FEATURES.bccLattice;
    pieceTypeToOption.hidden = !FEATURES.bccLattice;
  }
  // Same gating for the interstitial-lattice piece tiers, plus the
  // Cuboctahedron gap-fill Octahedron (same Rhombeometry-only reasoning).
  for (const id of ['piece-type-ioct-option', 'piece-type-octahedron-option', 'piece-type-idis-option']) {
    const opt = document.getElementById(id);
    if (opt) {
      opt.disabled = !FEATURES.bccLattice;
      opt.hidden = !FEATURES.bccLattice;
    }
  }
  // Lattice Quick-View (generalizes the old "Lens Parity" system,
  // 2-lattices/5-modes, into one cycle across ALL SIX Piece-picker
  // types -- direct request 2026-08-29: "the lattice view button on
  // the HUD with positions for all lattices," clarified to a single
  // control cycling through every option including Off. ALL SIX modes
  // now work the same way, direct follow-up feedback 2026-08-29 ("up to
  // pyramid the lattices are full and great... can we not show the
  // remaining lattices in a more similar way, instead of just a tight
  // clump"): every mode RE-RENDERS your real built World's own cells as
  // a forced canonical shape, not a small hypothetical patch near the
  // camera --
  // - 'rd'/'cube'/'pyramid': every real cell shown as a complete block/
  //   bare cube/cube-plus-6-separate-pyramid-facets, regardless of its
  //   own actual partial-pyramid state.
  // - 'bcc'/'octa'/'disphenoid': every real cell's own nearest BCC dual
  //   point(s) (nearestBCCPoints, deduped -- NOT isBCC's exact-match
  //   filter, which the retired Interpenetrating Lattice Preview used
  //   and which real testing showed reads as far too sparse to convey
  //   "a lattice," only ~1/4 of FCC-valid cells by parity) shown as the
  //   corresponding TO / one octahedron bundle (4 disphenoids, fixed
  //   axis matching core/build.js's own bootstrap default) / one
  //   bootstrap disphenoid there.
  // Rebuilt on every onChange() for all six modes now (no more camera-
  // following refresh timer -- dropped along with the old system's
  // per-mode ghost/opacity-fade sub-variants, neither needed once every
  // mode is tied to your real World instead of a nearby hypothetical).
  // Deliberately NOT touching bcc-build.js's separate, always-on
  // `bccMesh` (the player's own real, placed BCC/TO world) or
  // interstitialStore (the player's own real placed Octahedron
  // Site/Disphenoid cells) -- those are structurally different features
  // (persistent world-state) from this re-rendering, non-persistent
  // preview.
  // Order groups related forms adjacent to each other -- direct user
  // request: Cuboctahedron next to the regular Octahedron (the two that
  // fill space together, this session's own doubled-density work), and
  // Octahedron Site next to Disphenoid (which composes into it, see
  // interstitial-lattice.js). Labels/icons are keyed by mode name below
  // (LATTICE_QUICK_VIEW_LABELS/_MARK_KEY), not by array position, so
  // reordering this list alone is safe.
  const LATTICE_QUICK_VIEW_MODES = ['off', 'rd', 'cube', 'pyramid', 'rdquarter', 'cubocta', 'octahedron', 'bcc', 'octa', 'disphenoid'];
  const LATTICE_QUICK_VIEW_LABELS = {
    off: 'Off.',
    rd: 'RD -- every built cell shown as a complete block.',
    cube: 'Cube -- every built cell shown bare, pyramids hidden.',
    pyramid: "Pyramid -- every built cell's cube and 6 pyramid facets shown as separate pieces.",
    rdquarter: 'RD Quarter -- every built cell shown as its 4 real rhombohedra (Fedorov’s zonotope decomposition).',
    cubocta: 'Cuboctahedron -- every built cell shown as the real coordination shape, plus a preview at one face-touching axis-neighbor position too.',
    bcc: 'BCC/TO -- every co-locatable built cell shown as its dual truncated octahedron.',
    octa: 'Flattened Octahedron -- every co-locatable built cell shown as one octahedron bundle.',
    octahedron: 'Octahedron -- the Cuboctahedron gap-fill piece, previewed at two cube-centers near every built cell.',
    disphenoid: 'Disphenoid -- every co-locatable built cell shown as one disphenoid.',
  };
  // 'off' added 2026-09-02: without it, markKey was undefined and
  // updateLatticeQuickViewIcon() below rendered a totally blank
  // iconFrame (outline only, zero ink) for the default/most-common
  // state -- direct report ("lattice view symbols are still feint")
  // traced to this, not a rendering-strength issue. See MARKS.latticeOff.
  const LATTICE_QUICK_VIEW_MARK_KEY = { off: 'latticeOff', rd: 'pieceRD', cube: 'pieceCube', pyramid: 'piecePyramid', rdquarter: 'piecePyramid', cubocta: 'cuboctahedron', bcc: 'pieceTO', octa: 'pieceOctaSite', octahedron: 'pieceOctahedron', disphenoid: 'pieceDisphenoid' };
  // Fixed axis for octahedron/disphenoid coverage -- matches core/
  // build.js's own bootstrap default for a fresh 'ioct' placement; a
  // representative single orientation per anchor is enough for a
  // preview, not every possible one.
  const LATTICE_QUICK_VIEW_AXIS_OFFSET = [2, 0, 0];
  // Fixed body-diagonal direction for the NEW Octahedron gap-fill
  // preview -- same "one representative orientation is enough" reasoning
  // as the axis offset above, just body-diagonal instead of axis-aligned
  // since that's the real direction octGapCellForCOCell expects (see
  // core/cubocta-gap-build.js).
  // Two opposite body-diagonal corners (out of 8 real ones -- see
  // core/cubocta-gap-build.js's own BODY_DIAGONAL_OFFSETS), not just
  // one -- direct user request to bring this mode's own density up to
  // the same "2 per real cell" order 'cubocta' settled on above, since
  // this mode has no "real cell shown as itself" baseline shape the way
  // 'cubocta' does (every position here is a preview), one direction
  // alone under-represented it by comparison.
  const LATTICE_QUICK_VIEW_OCTAHEDRON_DIRECTIONS = [
    [1, 1, 1],
    [-1, -1, -1],
  ];
  let latticeQuickViewMode = 'off';
  let latticeQuickViewMesh = null;
  let latticeQuickViewEdges = null;
  // Real bug the old system already hit and fixed live (2026-08-28),
  // same guard kept here even though the only remaining overlapping
  // caller is onChange() vs. a direct cycle click: a generation
  // counter, bumped at the start of every call, lets a call whose own
  // await resolves AFTER a newer call already started discard its
  // stale result instead of touching the scene.
  let latticeQuickViewGeneration = 0;

  function clearLatticeQuickView() {
    if (latticeQuickViewMesh) {
      latticeQuickViewMesh.parent?.remove(latticeQuickViewMesh);
      latticeQuickViewMesh.geometry.dispose();
      latticeQuickViewMesh.material.dispose();
      latticeQuickViewMesh = null;
    }
    if (latticeQuickViewEdges) {
      latticeQuickViewEdges.parent?.remove(latticeQuickViewEdges);
      latticeQuickViewEdges.geometry.dispose();
      latticeQuickViewEdges.material.dispose();
      latticeQuickViewEdges = null;
    }
  }
  // Also resets the toggle buttons' own 'active' state and mode, unlike
  // clearLatticeQuickView() alone -- used wherever something ELSE
  // (Dualize) is about to show its own overlapping translucent preview.
  // Same mutual-exclusion reasoning as the retired Interpenetrate vs.
  // Dualize fix (2026-08-29): both previews share the exact same
  // SKELETON_COLOR translucent-fill + white-edge styling, so having two
  // up at once reads as one preview showing "two different colors" from
  // the overlapping transparency, not two actually-different materials.
  function deactivateLatticeQuickView() {
    latticeQuickViewMode = 'off';
    bccToggleBtn?.classList.remove('active');
    document.getElementById('hud-quick-lattice-view')?.classList.remove('active');
    updateLatticeQuickViewIcon();
    clearLatticeQuickView();
  }

  // FCC-family modes: real per-piece convex geometries kept SEPARATE
  // (not one big re-hulled shape) so their internal seams survive into
  // the merged EdgesGeometry -- needed for 'pyramid' mode to actually
  // show the 6-facet decomposition, not just the outer RD silhouette a
  // single convex hull over all points would collapse down to.
  // 'pyramid' deliberately does NOT also include the bare cube piece:
  // real flicker reported live (2026-08-29, "microflashing... could
  // trigger epilepsy") traced to genuine z-fighting -- a pyramid's own
  // base sits in the EXACT same plane as the cube face under it, so
  // rendering both as separate solid pieces put two coincident,
  // opposite-facing surfaces at the identical depth, fighting for which
  // one the GPU draws on top every frame. The 6 pyramids' own outer
  // faces already trace the same silhouette without it -- the real
  // in-World partial-cell renderer (buildPartialCellGeometry) never hit
  // this because it computes ONE merged convex hull, which naturally
  // discards the redundant internal cube faces a hull algorithm would
  // never have exposed in the first place.
  function fccQuickViewPieces(cell, mode) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    const shift = (pts) => pts.map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
    if (mode === 'rd') return [new ConvexGeometry(shift(rdRawVerts(SCALE)))];
    const { cube, pyramids } = pyramidPieces(SCALE);
    if (mode === 'cube') return [new ConvexGeometry(shift(cube))];
    // RD Quarter (Fedorov's zonotope decomposition, see rdQuarterPieces'
    // own header) -- same "own quick-view mode, no interactive click-to-
    // place" treatment as Cube above, not a new partial-cell system.
    if (mode === 'rdquarter') return rdQuarterPieces(SCALE).map((verts) => new ConvexGeometry(shift(verts)));
    const pieces = [];
    for (const axisKey of Object.keys(pyramids)) {
      const { base, apex } = pyramids[axisKey];
      pieces.push(new ConvexGeometry(shift([...base, apex])));
    }
    return pieces;
  }
  // BCC-family modes: one shape per (deduped) nearest-BCC-point anchor
  // -- see rebuildLatticeQuickView's own call site for why this uses
  // nearestBCCPoints over every real cell rather than isBCC's exact-
  // match filter (the retired Interpenetrating Lattice Preview's own
  // 'bcc'-only approach), extended here to Octahedron Site/Disphenoid.
  function bccFamilyQuickViewPieces(cell, mode) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    if (mode === 'bcc') {
      const shapeScale = bccShapeScaleFor(SCALE);
      const verts = truncatedOctahedronVertices(shapeScale).map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
      return [new ConvexGeometry(verts)];
    }
    const bundles = mode === 'octa'
      ? octahedronDisphenoids([cell.x, cell.y, cell.z], LATTICE_QUICK_VIEW_AXIS_OFFSET)
      : [bootstrapDisphenoid([cell.x, cell.y, cell.z])];
    return bundles.map((verts) => new ConvexGeometry(disphenoidVertsToWorld(verts, SCALE).map(([x, y, z]) => new THREE.Vector3(x, y, z))));
  }

  // Keeps the toggle buttons' own 'active' class in sync with whether
  // anything is ACTUALLY showing right now, not just whether a non-off
  // mode is nominally selected -- real bug already hit and fixed once
  // for the retired Interpenetrating Lattice Preview (2026-08-29): a
  // World with zero eligible cells left the button lit up 'active' with
  // nothing rendered and no persisting explanation past the toast,
  // reading as "the feature doesn't work." Called from every
  // rebuildLatticeQuickView() run (cycle click OR a live onChange()
  // refresh), not just at cycle time, so building an eligible cell
  // later while a bcc/octa/disphenoid mode is already selected but
  // empty correctly lights the button back up on its own too.
  function syncLatticeQuickViewActiveState(shown) {
    const isOn = latticeQuickViewMode !== 'off' && shown;
    bccToggleBtn?.classList.toggle('active', isOn);
    document.getElementById('hud-quick-lattice-view')?.classList.toggle('active', isOn);
  }

  async function rebuildLatticeQuickView() {
    const myGeneration = ++latticeQuickViewGeneration;
    clearLatticeQuickView();
    if (latticeQuickViewMode === 'off') { syncLatticeQuickViewActiveState(false); return; }
    const { world: w, scene: s } = activeWorldTriple();
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    // A newer call (a later click, or a rapid second onChange) may have
    // started and already handled the scene while this one was
    // awaiting the import above -- discard this stale result instead of
    // clobbering that newer state or adding a mesh for a mode that may
    // no longer be current.
    if (myGeneration !== latticeQuickViewGeneration) return;

    const isFccFamily = latticeQuickViewMode === 'rd' || latticeQuickViewMode === 'cube' || latticeQuickViewMode === 'pyramid' || latticeQuickViewMode === 'rdquarter';
    const pieces = [];
    const cells = w ? w.entries() : [];
    if (isFccFamily) {
      for (const cell of cells) pieces.push(...fccQuickViewPieces(cell, latticeQuickViewMode));
    } else if (latticeQuickViewMode === 'cubocta') {
      // Cuboctahedron is native to the SAME FCC lattice as world.entries()
      // itself (its 12 vertices are exactly NEIGHBOR_OFFSETS -- see
      // core/lattice.js's own cuboctahedronVertices) -- unlike the BCC-
      // family modes below, no cross-lattice nearest-point conversion is
      // needed, one real shape per real cell, same as the FCC-family
      // modes above.
      //
      // Extended 2026-08-31 (doubled-density CO Build) to ALSO preview
      // one face-touching axis-neighbor position alongside each real
      // cell's own position -- enough to show the new capability exists
      // without multiplying per cell the way every OTHER Lattice
      // Quick-View mode deliberately never does (BCC-family modes below
      // already use exactly ONE representative direction per anchor,
      // LATTICE_QUICK_VIEW_AXIS_OFFSET/_OCTAHEDRON_DIRECTION, not every
      // possible one -- see those constants' own comments). Went through
      // two denser iterations first (6 axis positions, then all 18 real
      // growth directions) before landing here: both were confirmed live
      // as too dense specifically because they multiplied several
      // shapes per real cell where every other mode shows roughly one --
      // "still too many COs, multiplies too much compared to others"
      // pinned down the actual problem (the multiplication factor
      // itself, not just total opacity/count). Reusing the FIRST entry
      // of CUBOCTA_AXIS_OFFSETS as that one representative direction, no
      // new constant needed. Deduped via the same anchor-Map pattern the
      // BCC-family modes below already use.
      const cuboctaAnchors = new Map(); // "x,y,z" -> [x, y, z]
      const [repDx, repDy, repDz] = CUBOCTA_AXIS_OFFSETS[0];
      for (const cell of cells) {
        cuboctaAnchors.set(`${cell.x},${cell.y},${cell.z}`, [cell.x, cell.y, cell.z]);
        const p = [cell.x + repDx, cell.y + repDy, cell.z + repDz];
        cuboctaAnchors.set(p.join(','), p);
      }
      for (const [x, y, z] of cuboctaAnchors.values()) {
        const [wx, wy, wz] = cellToWorld(x, y, z, SCALE);
        const verts = cuboctahedronVertices(SCALE).map(([vx, vy, vz]) => new THREE.Vector3(vx + wx, vy + wy, vz + wz));
        pieces.push(new ConvexGeometry(verts));
      }
    } else if (latticeQuickViewMode === 'octahedron') {
      // Cuboctahedron gap-fill Octahedron: lives directly in the SAME
      // FCC-cell coordinate space as 'cubocta' above (octGapCellForCOCell
      // treats a real cell exactly like a real CO position, no BCC
      // conversion involved) -- two representative octahedra per real
      // cell, at the fixed LATTICE_QUICK_VIEW_OCTAHEDRON_DIRECTIONS
      // corners, deduped the same way the BCC-family anchors below are
      // (adjacent cells can share the same cube-center).
      const anchors = new Map(); // "i,j,k" -> [i, j, k]
      for (const cell of cells) {
        for (const dir of LATTICE_QUICK_VIEW_OCTAHEDRON_DIRECTIONS) {
          const p = octGapCellForCOCell(cell, dir);
          anchors.set(p.join(','), p);
        }
      }
      for (const [i, j, k] of anchors.values()) {
        const [wx, wy, wz] = octGapCellToWorld(i, j, k, SCALE);
        const verts = octGapVertices(SCALE).map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
        pieces.push(new ConvexGeometry(verts));
      }
    } else {
      // BCC-family modes: nearest BCC dual point(s) for EVERY real cell
      // (not just cells that already happen to sit exactly on a BCC
      // point -- isBCC's own filter, only ~1/4 of FCC-valid cells by
      // parity, real testing showed this read as far too sparse to
      // convey "a lattice"). Same nearestBCCPoints() Dualize's own
      // FCC->BCC direction already uses, deduped across the whole
      // structure so cells near the same dual point don't produce
      // overlapping duplicates.
      const anchors = new Map(); // "x,y,z" -> [x, y, z]
      for (const cell of cells) {
        for (const p of nearestBCCPoints([cell.x, cell.y, cell.z])) anchors.set(p.join(','), p);
      }
      for (const [x, y, z] of anchors.values()) pieces.push(...bccFamilyQuickViewPieces({ x, y, z }, latticeQuickViewMode));
    }
    // Defensive only past this point -- nearestBCCPoints always returns
    // a real anchor for any input, and the World is never truly empty
    // (see onChange's own invariant), so `cells` (and therefore
    // `pieces`) can't actually be empty here anymore.
    if (pieces.length === 0) {
      syncLatticeQuickViewActiveState(false);
      return;
    }
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    latticeQuickViewMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
      color: SKELETON_COLOR, emissive: SKELETON_COLOR, emissiveIntensity: 0.6, flatShading: true,
      // 'cubocta' previews 2 shapes per real cell (its own position +
      // one representative axis-neighbor, see this mode's own branch
      // above) where every other mode previews roughly 1 -- half the
      // opacity here keeps the total visual weight comparable rather
      // than compounding, direct user reasoning ("twice as many to
      // start" -> half density).
      transparent: true, opacity: latticeQuickViewMode === 'cubocta' ? 0.275 : 0.55, metalness: 0.1, roughness: 0.6,
      // Real flicker reported live (2026-08-29, "microflashing... could
      // trigger epilepsy"), particularly visible with X-Ray exposing
      // the interior: 'rd' mode's geometry sits EXACTLY where a real
      // full cell already is (same shape, same position), and BCC/
      // Octahedron Site/Disphenoid genuinely touch real geometry at
      // real contact points (the interpenetrating-lattice design) --
      // coincident depth with nothing to break the tie, so the GPU
      // picks a different "winner" essentially at random each frame.
      // polygonOffset nudges this mesh's rasterized depth slightly
      // toward the camera so it deterministically wins, eliminating the
      // fight instead of just hiding it. Bumped -4 -> -8 (2026-08-29,
      // still reported after the first pass) for extra margin -- this
      // dev environment's own GPU/depth-buffer precision couldn't be
      // matched exactly to whatever DICTO's real device uses, and a
      // coarser depth buffer needs a proportionally larger offset to
      // reliably separate a tie.
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
      // Follow-up report, still visible while actually orbiting the
      // camera (a static-frame diff alone didn't catch this): adjacent
      // cells' own overlay pieces can overlap each other too, not just
      // the real world -- a SINGLE mesh's own internal triangles still
      // depth-test/write against each other, so two overlapping
      // translucent pieces drawn in front of each other from different
      // angles produced a shifting double-layered "ghost" patch as the
      // view rotated. depthWrite:false is the exact same fix already
      // established elsewhere in this file for a translucent preview
      // mesh (X-Ray's own opacity-fade code, see updateSectionEnabled's
      // history) -- the overlay still tests against the real world's
      // own depth buffer (correct occlusion), it just stops writing
      // depth values of its own for its own triangles to fight over.
      depthWrite: false,
      // Real report 2026-08-29 ("lattice view of CO only sows slight
      // lines of buried ones"): unlike every other mode, 'cubocta'
      // previews a shape that's genuinely SMALLER than, and sits at the
      // exact SAME coordinate as, the real opaque cell already there
      // (RD/Cube/Pyramid preview AT that cell's own real scale/shape,
      // so there's nothing to be buried under; BCC/Octahedron/
      // Disphenoid sit at separate dual-lattice points, not nested
      // inside a same-coordinate opaque cell either) -- so with normal
      // depth-testing, the real RD cell in front almost entirely hides
      // its own cuboctahedron preview, leaving only the thin slivers
      // where the two surfaces' edges happen to graze. A "quick view of
      // the lattice" should stay visible regardless of what's drawn in
      // front of it, the same as every other mode already effectively
      // is at their own scale -- depthTest off only for this one mode.
      depthTest: latticeQuickViewMode !== 'cubocta',
    }));
    s.add(latticeQuickViewMesh);
    latticeQuickViewEdges = new THREE.LineSegments(new THREE.EdgesGeometry(merged), new THREE.LineBasicMaterial({
      color: 0xffffff, depthTest: latticeQuickViewMode !== 'cubocta',
      // Same "2 shapes per cell vs. every other mode's 1" reasoning as
      // the fill material's own opacity above -- half here too.
      transparent: latticeQuickViewMode === 'cubocta', opacity: latticeQuickViewMode === 'cubocta' ? 0.5 : 1,
    }));
    s.add(latticeQuickViewEdges);
    syncLatticeQuickViewActiveState(true);
  }
  // Corner HUD wheel's own "BCC Lattice" face (hud-wheel-3d.js) --
  // found once and cached, same reuse as the bottom-left icon's own
  // markKey lookup below, since faceEntries never changes after
  // createHudWheel3D() builds it once at startup.
  const hudLatticeFaceEntry = hudWheel.faceEntries.find((e) => e.data?.elId === 'bcc-toggle');
  function updateLatticeQuickViewIcon() {
    const markKey = LATTICE_QUICK_VIEW_MARK_KEY[latticeQuickViewMode];
    const title = `Lattice View: ${latticeQuickViewMode === 'off' ? 'Off' : latticeQuickViewMode}`;
    const html = iconFrame(markKey ? MARKS[markKey] : '', { title });
    const el = document.getElementById('hud-quick-lattice-view');
    if (el) el.innerHTML = html;
    // Direct report 2026-08-29: this face stayed a fixed ⬡ regardless of
    // mode, unlike the bottom-left icon -- same underlying state, two
    // access points, should show the same live icon both places.
    if (hudLatticeFaceEntry) hudLatticeFaceEntry.labelEl.innerHTML = html;
  }
  async function cycleLatticeQuickView() {
    const currentIdx = LATTICE_QUICK_VIEW_MODES.indexOf(latticeQuickViewMode);
    latticeQuickViewMode = LATTICE_QUICK_VIEW_MODES[(currentIdx + 1) % LATTICE_QUICK_VIEW_MODES.length];
    if (latticeQuickViewMode !== 'off') clearDualizePreview(); // mutual exclusion -- see deactivateLatticeQuickView's own comment
    updateLatticeQuickViewIcon();
    showHudPrompt(`Lattice View: ${LATTICE_QUICK_VIEW_LABELS[latticeQuickViewMode]}`, 4500);
    await rebuildLatticeQuickView(); // also syncs the toggle buttons' own 'active' state -- see syncLatticeQuickViewActiveState
  }
  bccToggleBtn?.addEventListener('click', cycleLatticeQuickView);
  document.getElementById('hud-quick-lattice-view')?.addEventListener('click', cycleLatticeQuickView);
  updateLatticeQuickViewIcon();

  const shellCountInput = document.getElementById('shell-count');
  const hollowFromInput = document.getElementById('hollow-from');
  const materialSelect = document.getElementById('color-select');
  const autoAssignMaterialCheckbox = document.getElementById('auto-assign-color');

  // Per-piece overrides on top of AUTO_ASSIGN_MATERIAL_BY_PIECE's own
  // defaults -- direct follow-up 2026-09-02 ("autoselected colors for
  // all shapes adjustable"). Loaded once here; each dropdown below
  // writes back into this object AND localStorage on change.
  let autoAssignOverrides = {};
  try {
    autoAssignOverrides = JSON.parse(localStorage.getItem(AUTO_ASSIGN_STORAGE_KEY)) ?? {};
  } catch { /* corrupt/missing -- fall back to the built-in defaults */ }

  // See AUTO_ASSIGN_MATERIAL_BY_PIECE's own header. Direct follow-up
  // (2026-09-22) after a first, wrong-direction attempt at this (auto-
  // cycling every placement, reverted): "auto assign is fine but with
  // override changes pre-assign until updated again" / "has a color if
  // you don't change but changes if you pick new color" -- the real
  // complaint was that auto-assign's own fixed per-piece default
  // silently outranked the MAIN #color-select dropdown, so picking a
  // new color there appeared to do nothing for auto-assigned piece
  // types. Fixed below (not here) by having a #color-select change
  // ALSO write into autoAssignOverrides for whichever piece type is
  // currently selected -- same "sticky until you change it again"
  // model, just reachable from the dropdown the user is actually
  // looking at, not only the Settings-panel per-piece list.
  function currentMaterialFor(pieceType) {
    if (autoAssignMaterialCheckbox?.checked) {
      return autoAssignOverrides[pieceType] ?? AUTO_ASSIGN_MATERIAL_BY_PIECE[pieceType] ?? materialSelect.value;
    }
    return materialSelect.value;
  }

  // Builds the "Auto-assign colors" mini-panel -- one label + color
  // dropdown per piece type, options cloned straight from #color-
  // select so the list can never drift out of sync with the real
  // palette. Built once at startup (not per-toggle) since the row's
  // OWN visibility is all that needs to change when the checkbox
  // flips, not its contents.
  const autoAssignMaterialsRow = document.getElementById('auto-assign-colors-row');
  if (autoAssignMaterialsRow) {
    for (const pieceType of Object.keys(AUTO_ASSIGN_MATERIAL_BY_PIECE)) {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px; opacity:0.85;';
      const span = document.createElement('span');
      span.textContent = AUTO_ASSIGN_PIECE_LABELS[pieceType] ?? pieceType;
      const select = document.createElement('select');
      for (const opt of materialSelect.options) {
        select.add(new Option(opt.textContent, opt.value));
      }
      select.value = autoAssignOverrides[pieceType] ?? AUTO_ASSIGN_MATERIAL_BY_PIECE[pieceType];
      select.addEventListener('change', () => {
        autoAssignOverrides[pieceType] = select.value;
        try { localStorage.setItem(AUTO_ASSIGN_STORAGE_KEY, JSON.stringify(autoAssignOverrides)); } catch { /* best-effort only */ }
      });
      wrap.append(span, select);
      autoAssignMaterialsRow.appendChild(wrap);
    }
  }
  autoAssignMaterialCheckbox?.addEventListener('change', () => {
    if (autoAssignMaterialsRow) autoAssignMaterialsRow.style.display = autoAssignMaterialCheckbox.checked ? 'flex' : 'none';
  });
  // Auto-assign now defaults ON (direct instruction 2026-09-02, "default
  // auto assign color with manual override" -- the checkbox's own HTML
  // `checked` attribute already covers a fresh page load; this covers
  // the row's own visibility matching that same default, since it
  // otherwise only syncs on the checkbox's 'change' event). Manual
  // override is still one click away either way -- uncheck for the
  // plain color picker, or use the per-piece dropdowns above without
  // unchecking anything.
  if (autoAssignMaterialsRow && autoAssignMaterialCheckbox) {
    autoAssignMaterialsRow.style.display = autoAssignMaterialCheckbox.checked ? 'flex' : 'none';
  }

  const getShellCount = () => Math.min(Math.max(1, Number(shellCountInput.value) || 1), MAX_SHELL);

  // See docs/code-notes/render.md
  const MODE_HINTS = {
    build: 'Click a face to add one cell using the selected material.',
    fill: 'Click a cell to fill shells (hollow from–radius) outward around it, approximating a sphere. A second click on the same structure grows it further.',
    round: 'Click a shell-tagged cell to smooth its outer boundary by true distance from center.',
    excavate: 'Click a shell-tagged structure to hollow out its interior below "Hollow from shell".',
    report: 'Shows flagged/removed cells (normally hidden) in red. Click one to flag it, click a flagged one to approve it back.',
    sculpt: 'Model (add) onto a face, or Chisel (subtract) a clicked cell -- see the Sculpt panel for tier/mirror/brush.',
    bcc: 'Click a face of an existing BCC cell to extend it, or a face of your normal World to start one nearby. Right-click removes a BCC cell. Overlap with your normal World is expected -- it\'s how the two lattices join.',
    cubocta: 'Click a face of your normal World to place a cuboctahedron there, or near a POINT of an existing one to grow toward that neighbor -- click closer to a flat face instead of a point to grow face to face with its next-door neighbor. Right-click removes one. Overlap with your normal World is expected. To fill the gap that opens up between face-to-face cuboctahedra, switch to Build/Chisel mode and pick Octahedron from the Piece menu instead -- click near a corner of an existing cuboctahedron.',
    dualize: 'Click an existing structure (FCC or a real placed BCC/TO cell) to preview its region (radius = Shell fill radius) reinterpreted through the other lattice. View-only -- nothing is written to your World.',
  };
  function updateModeUI() {
    const showRadius = currentMode === 'fill' || currentMode === 'dualize';
    const showHollowFrom = currentMode === 'fill' || currentMode === 'excavate';
    document.getElementById('shell-radius-row').style.display = showRadius ? '' : 'none';
    document.getElementById('hollow-from-row').style.display = showHollowFrom ? '' : 'none';
    document.getElementById('mode-hint').textContent = MODE_HINTS[currentMode];
    updateHudIndicator();
  }

  // Maps core/build.js's own getPieceType() values to their matching
  // MARKS entry -- same shape vocabulary the Piece wheel faces
  // themselves use (wheel-icons.js), so the quick-select icon below is
  // never a second, competing symbol for the same shape.
  const PIECE_MARK_KEY = {
    rd: 'pieceRD', cube: 'pieceCube', pyramid: 'piecePyramid', to: 'pieceTO', ioct: 'pieceOctaSite', octahedron: 'pieceOctahedron', idis: 'pieceDisphenoid',
    halfrd: 'pieceHalfRD', hourglass: 'pieceHourglass', hemi3: 'pieceHemi3', hemi4: 'pieceHemi4', hemiTri: 'pieceHemiTri',
    // Real bug fixed 2026-09-23, direct report ("it keeps saying RD
    // however many times i select elongated"): every piece added this
    // session was missing from this map, so the quick-select icon
    // always fell back to pieceRD's own mark (see updateQuickSelect's
    // own `?? MARKS.pieceRD` fallback below) regardless of which was
    // actually selected -- the real placement itself was always
    // correct, only this indicator was silently wrong.
    elongdodeca: 'pieceElongDodeca', hexprism: 'pieceHexPrism', rdquarter: 'pieceRhombohedron', rhombohedra: 'pieceRhombohedron',
    // 2D lattice tier (Phase 3): one entry per LATTICE_2D_COMBINATIONS,
    // reusing wheel-icons.js's own 3 primitive-keyed icons (the mark
    // only varies by primitive, not angle -- see that file's own
    // comment for why a full 12-icon set wasn't built).
    ...Object.fromEntries(LATTICE_2D_COMBINATIONS.map((c) => [`lattice2d:${c.id}`, `piece2d${c.primitiveId[0].toUpperCase()}${c.primitiveId.slice(1)}`])),
  };
  const quickShapeEl = document.getElementById('hud-quick-shape');
  const quickMaterialEl = document.getElementById('hud-quick-material');
  // Bottom-left quick-select: always-visible current Piece/Material,
  // direct request 2026-08-29 ("a little hexagon icon of each... stay
  // open at bottom next to menu") -- unlike updateHudIndicator's own
  // text readout below, these two stay accurate through Walk/Sculpture
  // Mode too (the underlying value doesn't change either), so this runs
  // unconditionally rather than sharing those early returns.
  // Dimension-select wizard (2026-09-22), direct confirmation: this
  // shortcut stays exactly as-is across every dimension tier, not
  // replaced by anything dimension-specific -- as 2D/4D/5D/6D each ship
  // real piece types (PIECE_MARK_KEY today only covers 3D's), this same
  // icon should pick from whichever shapes the ACTIVE dimension (see
  // activeDimension near the top of this file) actually offers, same
  // "families coexist, switch via the existing Piece-picker pattern"
  // principle the wizard plan already settled on for 3D's FCC/BCC. No
  // gating needed yet -- 3D is the only real dimension so far.
  function updateQuickSelect() {
    if (quickShapeEl) {
      // Cuboctahedron Build (currentMode === 'cubocta') isn't a
      // piece-type value at all -- it's its own mode, same as BCC Build
      // -- so it was invisible to this icon entirely: picking it left
      // the quick-select showing whatever piece type was selected
      // before, with zero feedback that anything had changed. Direct
      // report 2026-08-29 ("the picker symbol at bottom doesnt change").
      // Checked first, ahead of the plain piece-type lookup below.
      if (currentMode === 'cubocta') {
        quickShapeEl.innerHTML = iconFrame(MARKS.cuboctahedron, { title: 'Shape' });
      } else {
        const pieceValue = document.getElementById('piece-type-select').value;
        quickShapeEl.innerHTML = iconFrame(MARKS[PIECE_MARK_KEY[pieceValue]] ?? MARKS.pieceRD, { title: 'Shape' });
      }
    }
    if (quickMaterialEl) {
      const hex = `#${materialColor(materialSelect.value).getHexString()}`;
      quickMaterialEl.innerHTML = iconFrame(swatchMark(hex), { title: 'Material' });
    }
  }
  // Was also a top-right "Mode · Material" text readout (#hud-indicator)
  // -- removed 2026-08-29, direct instruction: redundant with the
  // bottom-left quick-select icons above, which already show current
  // Piece/Material at a glance (and, unlike this text ever did, are
  // tappable to change them). Kept the function/name since every mode-
  // change call site in this file already calls it (via
  // refreshHudIndicator) to keep the quick-select icons in sync --
  // that's its real remaining job now.
  function updateHudIndicator() {
    updateQuickSelect();
  }
  refreshHudIndicator = updateHudIndicator;
  materialSelect.addEventListener('change', updateHudIndicator);
  // Direct fix for the "auto assign... but with override changes pre-
  // assign until updated again" complaint above: picking a new color
  // from the MAIN material picker now also updates the auto-assign
  // override for whichever piece type is currently selected, so it
  // actually takes effect (previously auto-assign's own fixed default
  // silently outranked this dropdown whenever it was checked, which is
  // ON by default). Same "sticky until changed again" persistence as
  // the Settings-panel per-piece dropdowns already have -- this is just
  // a second way to reach the exact same autoAssignOverrides entry, not
  // a separate mechanism, so the two never drift out of sync with each
  // other. Only writes when auto-assign is actually on -- with it off,
  // materialSelect.value already IS the live color (currentMaterialFor's
  // own plain fallback), nothing extra to persist.
  materialSelect.addEventListener('change', () => {
    if (!autoAssignMaterialCheckbox?.checked) return;
    const pieceType = document.getElementById('piece-type-select')?.value;
    if (!pieceType) return;
    autoAssignOverrides[pieceType] = materialSelect.value;
    try { localStorage.setItem(AUTO_ASSIGN_STORAGE_KEY, JSON.stringify(autoAssignOverrides)); } catch { /* best-effort only */ }
    // Keep the Settings-panel per-piece dropdown (if it exists for this
    // piece type) visually in sync too, so the two controls never show
    // contradicting values.
    for (const wrap of autoAssignMaterialsRow?.children ?? []) {
      const span = wrap.querySelector('span');
      const select = wrap.querySelector('select');
      if (select && span?.textContent === (AUTO_ASSIGN_PIECE_LABELS[pieceType] ?? pieceType)) {
        select.value = materialSelect.value;
      }
    }
  });
  // Real bug, caught live 2026-08-31 ("picking CO... disphenoid coming
  // instead", eventually pinned down to "picker shape is flat
  // octahedron" -- not a placement bug at all, confirmed by checking
  // real placed-cell data: CO placement itself was correct throughout).
  // materialSelect got its own change listener above; #piece-type-select
  // never did -- selecting a piece directly from the Lab panel's own
  // dropdown (a real, direct interaction path, not just a wheel proxy)
  // silently left the quick-select icon showing whatever the WHEEL had
  // last set it to, with no refresh at all until some other action
  // happened to call updateHudIndicator() again.
  document.getElementById('piece-type-select')?.addEventListener('change', updateHudIndicator);
  // Real bug, direct report ("color change is not working still
  // following previous pieces color"): the main #material-select
  // dropdown never updated its own DISPLAYED value when piece type
  // changed, so after switching pieces it kept visually showing
  // whichever color was last picked for the PREVIOUS piece type --
  // reading as "my color change isn't sticking," even though
  // currentMaterialFor() (the function that actually decides a new
  // cell's real color) was already correctly using each piece type's
  // own independent auto-assign override/default the whole time
  // (verified directly). Syncs the dropdown to the NEW piece type's
  // own real current color on every switch, so what's shown always
  // matches what will actually be placed.
  document.getElementById('piece-type-select')?.addEventListener('change', (e) => {
    materialSelect.value = currentMaterialFor(e.target.value);
  });
  // quickShapeEl/quickMaterialEl's own click handlers are wired up above,
  // inside the wheel3D block (they need wheel3D/toggleWheel3D/
  // seedIfWorldEmpty, which only exist in that block's own scope).

  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      modeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      // Dualize preview (reframe Stage 3) is click-driven, not a toggle --
      // leaving it visible after switching to an unrelated mode would be
      // a stale, orphaned overlay of your last-previewed region.
      if (currentMode !== 'dualize') clearDualizePreview();
      updateModeUI();
      rebuildInstances(mesh, world, currentMode === 'report');
      closeMobilePanels();
    });
  });

  updateModeUI();

  // --- Dualize (reframe Stage 3): view-only FCC<->BCC region
  // reinterpretation. Reuses shellBrushCells (Shell Brush's own region-
  // selection primitive, core/sculpture.js) for "player-selected region"
  // and nearestBCCPoints (dual-lattice.js -- unwired since the earlier
  // BCC task's own Phase 3 stretch scope) for the actual FCC->BCC math;
  // no new geometry math invented here. Always targets the real World's
  // own mesh/scene/cellOrder, never Sculpture Mode's separate scratch
  // scene -- deliberately out of scope for this pass, not an oversight.
  // View-only by design: never calls world.addCell/removeCell. Commit-
  // path decision (2026-08-28, direct user decision): committed dualized
  // cells will live in the existing bccWorld/BCC_STORAGE_KEY store (same
  // one BCC Build's real placed cells already use), reusing that
  // schema/rendering/persistence rather than a new store or the main
  // `cells` map (rejected -- see core/bcc-build.md's own coordinate-
  // collision reasoning). Still open, not yet implemented: whether
  // committed cells need a provenance flag (e.g. generatedBy/
  // sourceRegion) to stay distinguishable from hand-placed BCC cells.
  let dualizePreviewMesh = null;
  let dualizePreviewEdges = null;
  function clearDualizePreview() {
    if (dualizePreviewMesh) {
      scene.remove(dualizePreviewMesh);
      dualizePreviewMesh.geometry.dispose();
      dualizePreviewMesh.material.dispose();
      dualizePreviewMesh = null;
    }
    if (dualizePreviewEdges) {
      scene.remove(dualizePreviewEdges);
      dualizePreviewEdges.geometry.dispose();
      dualizePreviewEdges.material.dispose();
      dualizePreviewEdges = null;
    }
  }
  // Bidirectional (reframe follow-up, 2026-08-28, direct user question:
  // "shouldn't dualize preview show opposite lattice to current picker
  // shape?"): reacts to whichever real lattice you actually clicked, via
  // the raycast hit itself -- not the Piece picker's own current
  // selection, which can be stale relative to what's actually on screen
  // (e.g. still set to TO after clicking an FCC cell). Reuses
  // nearestFCCPoints (dual-lattice.js) for the new BCC->FCC direction,
  // verified numerically before being wired in here -- see that
  // function's own header for the real, confirmed asymmetry (an
  // all-even BCC point is already FCC-valid; an all-odd one has 6
  // equidistant FCC neighbors, not a single nearest one).
  async function rebuildDualizePreview(sourceLattice, cx, cy, cz, radius) {
    clearDualizePreview();
    if (latticeQuickViewMode !== 'off') deactivateLatticeQuickView(); // mutual exclusion -- see its own comment
    const isFcc = sourceLattice === 'fcc';
    const sourceLabel = isFcc ? 'FCC' : 'BCC/TO';
    const targetLabel = isFcc ? 'BCC/TO' : 'FCC';
    // BCC-side region selection reuses cellsInShells with BCC's own
    // neighbor offsets -- the exact same "shell radius around a center"
    // primitive shellBrushCells already wraps for FCC, just handed a
    // different offset table, not a separately-invented mechanism.
    const regionCells = isFcc
      ? shellBrushCells(cx, cy, cz, radius).filter((c) => world.has(c.x, c.y, c.z))
      : [{ x: cx, y: cy, z: cz, shell: 0 }, ...cellsInShells(cx, cy, cz, radius, 1, BCC_NEIGHBOR_OFFSETS)]
          .filter((c) => bccWorld.has(c.x, c.y, c.z));
    if (regionCells.length === 0) {
      showHudPrompt(`Dualize: no built ${sourceLabel} cells in that region -- click an existing structure.`, 4000);
      return;
    }
    // Dedup across the WHOLE region, not per-cell -- nearby source cells'
    // nearest-dual-point sets overlap heavily, and a real reinterpretation
    // of "the same enclosed space" is one set of dual cells, not a bag
    // with repeats.
    const targetPoints = new Map(); // "x,y,z" -> [x,y,z]
    for (const c of regionCells) {
      const pts = isFcc ? nearestBCCPoints([c.x, c.y, c.z]) : nearestFCCPoints([c.x, c.y, c.z]);
      for (const p of pts) targetPoints.set(p.join(','), p);
    }
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    const pieces = [];
    if (isFcc) {
      // Same real, established self-tiling scale as the existing BCC
      // preview/BCC Build features (bccShapeScaleFor(SCALE)) --
      // "mathematically consistent and interchangeable" with FCC, not
      // re-derived here.
      const shapeScale = bccShapeScaleFor(SCALE);
      for (const [bx, by, bz] of targetPoints.values()) {
        const [wx, wy, wz] = cellToWorld(bx, by, bz, SCALE);
        const verts = truncatedOctahedronVertices(shapeScale).map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
        pieces.push(new ConvexGeometry(verts));
      }
    } else {
      // Reverse direction previews as real RD shapes, at the same SCALE
      // every FCC cell in the actual World already uses -- reuses
      // rdRawVerts exactly as the real build/render path does, no new
      // geometry invented for this direction either.
      for (const [fx, fy, fz] of targetPoints.values()) {
        const [wx, wy, wz] = cellToWorld(fx, fy, fz, SCALE);
        const verts = rdRawVerts(SCALE).map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
        pieces.push(new ConvexGeometry(verts));
      }
    }
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    // Color + wireframe pairing (SKELETON_COLOR + real edge overlay),
    // same reused convention as both-differentiated lattice view mode --
    // not a new visual language for "this is a dual-lattice preview."
    dualizePreviewMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
      color: SKELETON_COLOR, emissive: SKELETON_COLOR, emissiveIntensity: 0.6, flatShading: true,
      transparent: true, opacity: 0.55, metalness: 0.1, roughness: 0.6,
      // Same real z-fighting fix as Lattice Quick-View's own mesh (see
      // its own comments) -- Dualize's preview genuinely touches real
      // built geometry at real contact points too, and can self-overlap
      // across adjacent region cells the same way.
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
      depthWrite: false,
    }));
    scene.add(dualizePreviewMesh);
    dualizePreviewEdges = new THREE.LineSegments(new THREE.EdgesGeometry(merged), new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(dualizePreviewEdges);
    showHudPrompt(
      `Dualize preview: ${regionCells.length} ${sourceLabel} cell${regionCells.length === 1 ? '' : 's'} -> ${targetPoints.size} ${targetLabel} cell${targetPoints.size === 1 ? '' : 's'} (view-only -- nothing written to your World).`,
      6000,
    );
  }
  const dualizeRaycaster = new THREE.Raycaster();
  const dualizePointer = new THREE.Vector2();
  renderer.domElement.addEventListener('click', async (event) => {
    if (currentMode !== 'dualize' || walking) return;
    const rect = renderer.domElement.getBoundingClientRect();
    dualizePointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    dualizePointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    dualizeRaycaster.setFromCamera(dualizePointer, camera);
    // Raycast both real lattices, closest hit wins -- same pattern
    // core/build.js's own handleToClick already uses to let one click
    // react correctly to whichever real structure is actually there.
    const hits = dualizeRaycaster.intersectObjects([mesh, bccMesh]);
    if (hits.length === 0 || hits[0].instanceId === undefined) return;
    const hitBcc = hits[0].object === bccMesh;
    const cell = hitBcc ? bccCellOrder[hits[0].instanceId] : cellOrder[hits[0].instanceId];
    if (!cell) return;
    await rebuildDualizePreview(hitBcc ? 'bcc' : 'fcc', cell.x, cell.y, cell.z, getShellCount());
  });

  // Interpenetrating Lattice Preview (direct user request 2026-08-28)
  // retired 2026-08-29: Lattice Quick-View's own 'bcc' mode now covers
  // your real World's co-locatable cells the same way (and more
  // consistently, alongside RD/Cube/Pyramid/Octahedron Site/Disphenoid)
  // -- see cycleLatticeQuickView/rebuildLatticeQuickView above. Direct
  // confirmation to retire rather than keep both.

  const canPlaceMaterial = () => true;

  // See docs/code-notes/render.md
  const FULL_CYBORG_INWORLD_ENABLED = false;
  const sculptSession = createSculptureSession(LOCAL_PLAYER_ID);
  let sculptMirrorPlane = '';
  let sculptActionMode = 'add';

  const sculptPanelEl = document.getElementById('sculpt-panel');
  const sculptSuggestionEl = document.getElementById('sculpt-suggestion');
  const sculptSuggestionTextEl = document.getElementById('sculpt-suggestion-text');
  const sculptFullCyborgSection = document.getElementById('sculpt-fullcyborg-section');
  const sculptFullCyborgGated = document.getElementById('sculpt-fullcyborg-gated');

  function openSculptPanel() {
    sculptPanelEl.classList.add('open');
    // Moved here from the welcome card's own quickstart line (trimmed
    // down 2026-08-24) -- same one-time-toast idiom wireFirstUseHint
    // uses elsewhere, just triggered by opening the panel instead of a
    // hover/tap on an icon, since Sculpt is reached through the wheel.
    if (!seenHints.has('sculpt-panel-open')) {
      seenHints.add('sculpt-panel-open');
      localStorage.setItem(HINT_SEEN_KEY, JSON.stringify([...seenHints]));
      showHudPrompt('Sculpt: symmetry and mirror tools, no World required.', 4500);
    }
  }
  function closeSculptPanel() {
    sculptPanelEl.classList.remove('open');
  }
  document.getElementById('sculpt-close').addEventListener('click', closeSculptPanel);

  document.querySelectorAll('#sculpt-tier-row .tier-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sculpt-tier-row .tier-btn').forEach((b) => b.classList.toggle('active', b === btn));
      sculptSession.assistanceTier = btn.dataset.tier;
      sculptSession.pendingSuggestion = null;
      sculptSuggestionEl.style.display = 'none';
      const isFullCyborg = sculptSession.assistanceTier === 'full-cyborg';
      // Standalone Sculpture Mode enables Full-Cyborg unconditionally
      // (nothing there touches shared world-state); in-world stays
      // behind FULL_CYBORG_INWORLD_ENABLED until B7's moderation work is
      // verified.
      const fullCyborgUsable = sculptureModeActive || FULL_CYBORG_INWORLD_ENABLED;
      sculptFullCyborgSection.style.display = isFullCyborg && fullCyborgUsable ? '' : 'none';
      sculptFullCyborgGated.style.display = isFullCyborg && !fullCyborgUsable ? '' : 'none';
    });
  });

  document.querySelectorAll('#sculpt-mode-row .mode-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sculpt-mode-row .mode-toggle-btn').forEach((b) => b.classList.toggle('active', b === btn));
      sculptActionMode = btn.dataset.sculptMode;
    });
  });

  // See docs/code-notes/render.md
  let sculptDualPreset = ''; // '' | 'cube' | 'octa'
  let sculptFullSymmetry = false;
  function clearOtherSymmetrySelectors(exceptGroup) {
    if (exceptGroup !== 'mirror') {
      document.querySelectorAll('#sculpt-mirror-row .mirror-btn').forEach((b) => b.classList.toggle('active', b.dataset.plane === ''));
      sculptMirrorPlane = '';
    }
    if (exceptGroup !== 'dual') {
      document.querySelectorAll('#dual-symmetry-row .dual-symmetry-btn').forEach((b) => b.classList.remove('active'));
      sculptDualPreset = '';
    }
    if (exceptGroup !== 'full') {
      document.getElementById('sculpt-full-symmetry-btn')?.classList.remove('active');
      sculptFullSymmetry = false;
    }
  }

  document.querySelectorAll('#sculpt-mirror-row .mirror-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sculpt-mirror-row .mirror-btn').forEach((b) => b.classList.toggle('active', b === btn));
      sculptMirrorPlane = btn.dataset.plane;
      clearOtherSymmetrySelectors('mirror');
    });
  });

  document.getElementById('sculpt-full-symmetry-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('sculpt-full-symmetry-btn');
    const turningOn = !btn.classList.contains('active');
    clearOtherSymmetrySelectors(turningOn ? 'full' : null);
    btn.classList.toggle('active', turningOn);
    sculptFullSymmetry = turningOn;
  });

  if (FEATURES.dualSculpture) {
    document.querySelectorAll('#dual-symmetry-row .dual-symmetry-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('active');
        const turningOn = !wasActive;
        clearOtherSymmetrySelectors(turningOn ? 'dual' : null);
        btn.classList.toggle('active', turningOn);
        sculptDualPreset = turningOn ? btn.dataset.dualSymmetry : '';
      });
    });
  }

  const sculptBrushRadiusInput = document.getElementById('sculpt-brush-radius');

  function renderSculptSuggestion() {
    const s = sculptSession.pendingSuggestion;
    if (!s) {
      sculptSuggestionEl.style.display = 'none';
      return;
    }
    sculptSuggestionTextEl.textContent = `Suggestion: ${s.reason} (${s.action === 'remove' ? 'Chisel' : 'Model'}, ${s.cells.length} cell${s.cells.length === 1 ? '' : 's'}).`;
    sculptSuggestionEl.style.display = '';
  }
  document.getElementById('sculpt-suggestion-accept').addEventListener('click', () => {
    acceptSculptSuggestion(sculptSession, sculptTarget.world, sculptTarget.canPlaceMaterial);
    sculptTarget.apply();
    rebuildDualOverlay();
    renderSculptSuggestion();
  });
  document.getElementById('sculpt-suggestion-dismiss').addEventListener('click', () => {
    dismissSculptSuggestion(sculptSession);
    renderSculptSuggestion();
  });

  document.getElementById('sculpt-nl-go').addEventListener('click', async () => {
    const input = document.getElementById('sculpt-nl-input');
    const resultEl = document.getElementById('sculpt-nl-result');
    const text = input.value.trim();
    if (!text) return;
    resultEl.textContent = 'Thinking…';
    const origin = { x: 0, y: 0, z: 0 }; // TODO: last-hovered cell once Sculpt mode grows ghost-hover support
    const dualFocusForIntent = FEATURES.dualSculpture ? dualFocusEl?.value : undefined;
    const intent = await requestFullCyborgIntent(text, origin, sculptMirrorPlane, dualFocusForIntent);
    if (intent.unrecognized) {
      resultEl.textContent = intent.description;
      return;
    }
    const material = materialSelect.value;
    const { applied, skipped } = executeFullCyborgIntent(
      sculptTarget.world,
      intent,
      sculptTarget.world.getClaims(),
      LOCAL_PLAYER_ID,
      material,
      sculptTarget.canPlaceMaterial
    );
    resultEl.textContent = `${intent.description}${intent.viaAI ? ' (AI)' : ' (local parser)'} -- ${applied.length} cell${applied.length === 1 ? '' : 's'} placed${skipped.length ? `, ${skipped.length} skipped (outside your claim)` : ''}.`;
    if (applied.length > 0) {
      sculptTarget.apply();
      rebuildDualOverlay();
    }
    input.value = '';
  });

  // See docs/code-notes/render.md
  const sculptTarget = {
    world,
    mesh,
    canPlaceMaterial,
    apply: onChange,
  };

  // Dual structure -- see docs/code-notes/render.md
  const dualShowEl = document.getElementById('dual-show');
  const dualFocusEl = document.getElementById('dual-focus');
  const dualSnapEl = document.getElementById('dual-snap');
  const dualShellEl = document.getElementById('dual-shell');
  [
    'dual-section', 'dual-toggle-row', 'dual-options-row', 'dual-symmetry-row',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = FEATURES.dualSculpture ? '' : 'none';
  });

  let dualCubeOverlay = null;
  let dualOctaOverlay = null;
  function clearDualOverlay() {
    [dualCubeOverlay, dualOctaOverlay].forEach((m) => {
      if (!m) return;
      m.parent?.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    dualCubeOverlay = null;
    dualOctaOverlay = null;
  }

  // See docs/code-notes/render.md
  function cellDuals() {
    return sculptTarget.world.entries().map((cell) => {
      const [cx, cy, cz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
      const verts = rdRawVerts(SCALE).map(([x, y, z]) => [x + cx, y + cy, z + cz]);
      return { cell, center: [cx, cy, cz], dual: getDual(verts, [cx, cy, cz]) };
    });
  }

  function rebuildDualOverlay() {
    clearDualOverlay();
    const showingSolid = FEATURES.dualSculpture && dualShowEl?.checked && dualFocusEl?.value !== 'none';
    sculptTarget.mesh.material.transparent = showingSolid;
    sculptTarget.mesh.material.opacity = showingSolid ? 0.35 : 1;
    if (!showingSolid) return;
    const focus = dualFocusEl.value;
    const cubePts = [];
    const octaPts = [];
    for (const { dual } of cellDuals()) {
      if (focus === 'cube' || focus === 'both') {
        for (const [a, b] of dual.cubeEdges) {
          cubePts.push(new THREE.Vector3(...dual.cube[a]), new THREE.Vector3(...dual.cube[b]));
        }
      }
      if (focus === 'octa' || focus === 'both') {
        for (const [a, b] of dual.octaEdges) {
          octaPts.push(new THREE.Vector3(...dual.octa[a]), new THREE.Vector3(...dual.octa[b]));
        }
      }
    }
    const targetScene = sculptureModeActive ? sculptureScene : scene;
    if (cubePts.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(cubePts);
      dualCubeOverlay = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x7ccdff }));
      targetScene.add(dualCubeOverlay);
    }
    if (octaPts.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(octaPts);
      dualOctaOverlay = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xff9a4f }));
      targetScene.add(dualOctaOverlay);
    }
  }

  if (FEATURES.dualSculpture) {
    dualShowEl?.addEventListener('change', rebuildDualOverlay);
    dualFocusEl?.addEventListener('change', rebuildDualOverlay);
  }

  // See docs/code-notes/render.md
  const DUAL_SNAP_THRESHOLD = SCALE * 0.35;
  function snappedSculptTarget(hitPoint, cell) {
    if (!FEATURES.dualSculpture || !dualSnapEl?.checked || dualFocusEl.value === 'none') return null;
    const [cx, cy, cz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    const verts = rdRawVerts(SCALE).map(([x, y, z]) => [x + cx, y + cy, z + cz]);
    const dual = getDual(verts, [cx, cy, cz]);
    const snapped = snapToDual([hitPoint.x, hitPoint.y, hitPoint.z], dual, dualFocusEl.value, DUAL_SNAP_THRESHOLD);
    if (!snapped) return null;
    return { which: snapped.which, cell };
  }

  const sculptRaycaster = new THREE.Raycaster();
  const sculptPointer = new THREE.Vector2();
  renderer.domElement.addEventListener('click', (event) => {
    if (!sculptureModeActive && (currentMode !== 'sculpt' || walking)) return;
    const rect = renderer.domElement.getBoundingClientRect();
    sculptPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    sculptPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    sculptRaycaster.setFromCamera(sculptPointer, camera);
    const hits = sculptRaycaster.intersectObject(sculptTarget.mesh);
    if (hits.length === 0 || hits[0].instanceId === undefined) return;
    const hit = hits[0];
    const cell = cellOrder[hit.instanceId];
    if (!cell) return;

    // Snap to Dual (Phase 2, steps 5-6) -- see docs/code-notes/render.md
    const dualSnap = snappedSculptTarget(hit.point, cell);
    if (dualSnap) {
      clearOtherSymmetrySelectors('dual');
      sculptDualPreset = dualSnap.which;
      document.querySelectorAll('#dual-symmetry-row .dual-symmetry-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.dualSymmetry === dualSnap.which);
      });
      showHudPrompt(`Snapped to the inscribed ${dualSnap.which === 'cube' ? 'cube' : 'octahedron'} -- ${dualSnap.which === 'cube' ? 'Cube' : 'Octa'} symmetry selected.`, 2500);
    }

    let targetX, targetY, targetZ;
    if (sculptActionMode === 'add') {
      const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
      targetX = cell.x + dx;
      targetY = cell.y + dy;
      targetZ = cell.z + dz;
    } else {
      targetX = cell.x;
      targetY = cell.y;
      targetZ = cell.z;
    }

    const radius = Math.max(0, Math.min(10, Number(sculptBrushRadiusInput.value) || 0));
    const material = materialSelect.value;
    const isSemiCyborg = sculptSession.assistanceTier === 'semi-cyborg';
    // Dual Shell -- see docs/code-notes/render.md
    const useDualShell = FEATURES.dualSculpture && dualShellEl?.checked && dualFocusEl.value !== 'none';
    const shellOffsets = useDualShell
      ? (dualFocusEl.value === 'both' ? [...DUAL_DIRS.cube, ...DUAL_DIRS.octa] : DUAL_DIRS[dualFocusEl.value])
      : undefined;

    let touched;
    // Symmetry application order -- see docs/code-notes/render.md
    if (!isSemiCyborg && sculptFullSymmetry) {
      touched = [];
      for (const c of shellBrushCells(targetX, targetY, targetZ, radius, shellOffsets)) {
        touched.push(...applyFullSymmetry(sculptTarget.world, sculptActionMode, c.x, c.y, c.z, material, sculptTarget.canPlaceMaterial));
      }
    } else if (!isSemiCyborg && sculptDualPreset) {
      touched = [];
      for (const c of shellBrushCells(targetX, targetY, targetZ, radius, shellOffsets)) {
        touched.push(...applyDualSymmetry(sculptTarget.world, sculptActionMode, c.x, c.y, c.z, material, DUAL_DIRS[sculptDualPreset], sculptTarget.canPlaceMaterial));
      }
    } else {
      touched = sculptStroke(sculptTarget.world, sculptActionMode, targetX, targetY, targetZ, radius, material, isSemiCyborg ? null : sculptMirrorPlane || null, sculptTarget.canPlaceMaterial, shellOffsets);
    }
    if (touched.length === 0) return;
    sculptTarget.apply();
    rebuildDualOverlay();

    if (isSemiCyborg) {
      const lastCell = { ...touched[touched.length - 1], action: sculptActionMode, material };
      const dualFocusForSuggestion = FEATURES.dualSculpture ? dualFocusEl?.value : undefined;
      updateSemiCyborgSuggestion(sculptSession, sculptTarget.world, lastCell, sculptMirrorPlane || null, dualFocusForSuggestion);
      renderSculptSuggestion();
    }
  });

  // --- B4b: standalone Sculpture Mode ---------------------------------
  const permissiveCanPlaceMaterial = () => true; // no frost-line stars exist in a bare scratch lattice
  const sculptureBanner = document.getElementById('sculpture-mode-banner');
  const savedCameraState = { position: new THREE.Vector3(), target: new THREE.Vector3() };

  function enterSculptureMode() {
    if (sculptureModeActive) return;
    // See docs/code-notes/render.md
    document.getElementById('duality-toggle')?.classList.contains('active') && document.getElementById('duality-toggle').click();
    savedCameraState.position.copy(camera.position);
    savedCameraState.target.copy(controls.target);
    if (!sculptureWorld) {
      sculptureWorld = createWorldStore({ worldName: 'Sculpture Scratch', version: 1, cells: {}, meta: {} });
      sculptureWorld.addCell(0, 0, 0, { material: 'base' });
    }
    sculptureModeActive = true;
    sculptTarget.world = sculptureWorld;
    sculptTarget.mesh = sculptureMesh;
    sculptTarget.canPlaceMaterial = permissiveCanPlaceMaterial;
    sculptTarget.apply = () => rebuildInstances(sculptureMesh, sculptureWorld);
    rebuildInstances(sculptureMesh, sculptureWorld);
    clearDualOverlay();
    rebuildDualOverlay();
    camera.position.set(6, 5, 8);
    controls.target.set(0, 0, 0);
    sculptFullCyborgGated.style.display = 'none';
    if (sculptSession.assistanceTier === 'full-cyborg') sculptFullCyborgSection.style.display = '';
    sculptureBanner.style.display = 'flex';
    document.getElementById('sculpt-standalone-section').style.display = '';
    openSculptPanel();
    clickModeShimSculpt();
    updateHudIndicator();
  }

  function exitSculptureMode() {
    if (!sculptureModeActive) return;
    document.getElementById('duality-toggle')?.classList.contains('active') && document.getElementById('duality-toggle').click();
    sculptureModeActive = false;
    sculptTarget.world = world;
    sculptTarget.mesh = mesh;
    sculptTarget.canPlaceMaterial = canPlaceMaterial;
    sculptTarget.apply = onChange;
    clearDualOverlay();
    rebuildDualOverlay();
    camera.position.copy(savedCameraState.position);
    controls.target.copy(savedCameraState.target);
    sculptFullCyborgGated.style.display = sculptSession.assistanceTier === 'full-cyborg' && !FULL_CYBORG_INWORLD_ENABLED ? '' : 'none';
    if (sculptSession.assistanceTier === 'full-cyborg' && !FULL_CYBORG_INWORLD_ENABLED) sculptFullCyborgSection.style.display = 'none';
    sculptureBanner.style.display = 'none';
    document.getElementById('sculpt-standalone-section').style.display = 'none';
    updateHudIndicator();
  }

  function clickModeShimSculpt() {
    const btn = document.querySelector('.mode-btn[data-mode="sculpt"]');
    if (btn) btn.click();
  }

  document.getElementById('sculpture-mode-toggle')?.addEventListener('click', enterSculptureMode);
  document.getElementById('sculpture-mode-exit')?.addEventListener('click', exitSculptureMode);

  // See docs/code-notes/render.md
  async function exportSculpture(format) {
    if (!sculptureWorld) return;
    const cells = sculptureWorld.entries();
    if (cells.length === 0) {
      showHudPrompt('Nothing to export yet -- Model a few cells first.');
      return;
    }
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    const pieces = cells.map((cell) => {
      const g = geometry.clone();
      const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
      g.translate(wx, wy, wz);
      return g;
    });
    const merged = mergeGeometries(pieces, false);
    const exportMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x8899aa }));
    const filenameBase = `rhombiverse-sculpture-${Date.now()}`;

    if (format === 'stl') {
      const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
      const data = new STLExporter().parse(exportMesh, { binary: true });
      downloadBlob(new Blob([data], { type: 'application/octet-stream' }), `${filenameBase}.stl`);
    } else if (format === 'obj') {
      const { OBJExporter } = await import('three/addons/exporters/OBJExporter.js');
      const data = new OBJExporter().parse(exportMesh);
      downloadBlob(new Blob([data], { type: 'text/plain' }), `${filenameBase}.obj`);
    } else if (format === 'gltf') {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      new GLTFExporter().parse(
        exportMesh,
        (result) => {
          const json = result instanceof ArrayBuffer ? null : JSON.stringify(result, null, 2);
          downloadBlob(
            json ? new Blob([json], { type: 'application/json' }) : new Blob([result], { type: 'application/octet-stream' }),
            json ? `${filenameBase}.gltf` : `${filenameBase}.glb`
          );
        },
        (err) => console.error('Rhombiverse: GLTF export failed', err),
        { binary: false }
      );
    }
    pieces.forEach((g) => g.dispose());
    merged.dispose();
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  document.getElementById('sculpture-export-stl')?.addEventListener('click', () => exportSculpture('stl'));
  document.getElementById('sculpture-export-obj')?.addEventListener('click', () => exportSculpture('obj'));
  document.getElementById('sculpture-export-gltf')?.addEventListener('click', () => exportSculpture('gltf'));

  // See docs/code-notes/render.md
  document.getElementById('sculpture-place-in-world')?.addEventListener('click', () => {
    if (!sculptureWorld) return;
    const cells = sculptureWorld.entries();
    if (cells.length === 0) return;
    const xs = cells.map((c) => c.x);
    let offsetX = Math.max(...xs) - Math.min(...xs) + 6;
    if (offsetX % 2 !== 0) offsetX += 1;
    let placed = 0;
    for (const cell of cells) {
      const nx = cell.x + offsetX;
      const ny = cell.y;
      const nz = cell.z;
      if (isValidCell(nx, ny, nz) && !world.has(nx, ny, nz)) {
        world.addCell(nx, ny, nz, { material: cell.material });
        placed += 1;
      }
    }
    onChange();
    showHudPrompt(`Placed a copy of your sculpture in-world (${placed} cells), next to the origin.`);
  });

  // See docs/code-notes/render.md
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x9de0ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const ghostMeshes = [0, 1].map(() => {
    const m = new THREE.Mesh(geometry, ghostMaterial);
    m.visible = false;
    scene.add(m);
    return m;
  });
  let lastHoverCells = null;
  let materialPreviewColor = null;
  function showGhost(cells) {
    lastHoverCells = cells;
    ghostMeshes.forEach((m, i) => {
      const cell = cells[i];
      if (!cell) {
        m.visible = false;
        return;
      }
      const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
      m.position.set(wx, wy, wz);
      m.visible = true;
      ghostMaterial.color.set(materialPreviewColor ?? (cell.occupied ? 0xff8866 : 0x9de0ff));
    });
  }
  function hideGhost() {
    lastHoverCells = null;
    ghostMeshes.forEach((m) => {
      m.visible = false;
    });
  }

  // See docs/code-notes/render.md
  function flashAt(cell, color) {
    const edges = new THREE.EdgesGeometry(geometry);
    const flashMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const outline = new THREE.LineSegments(edges, flashMat);
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    outline.position.set(wx, wy, wz);
    scene.add(outline);
    const start = performance.now();
    const DURATION = 260;
    function step(now) {
      const t = Math.min(1, (now - start) / DURATION);
      const scale = 1 + t * 0.6;
      outline.scale.setScalar(scale);
      flashMat.opacity = 0.9 * (1 - t);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        scene.remove(outline);
        edges.dispose();
        flashMat.dispose();
      }
    }
    requestAnimationFrame(step);
  }

  createBuildController({
    renderer,
    camera,
    mesh,
    extraPickTargets: [partialCellGroup],
    // Pyramid Sub-Cell: a hit on a partial cell's own individual Mesh has
    // no instanceId (that's InstancedMesh-only) -- resolve it via the
    // hit object's own userData.cellKey instead. See core/pyramid.md.
    //
    // Real bug avoided here, direct follow-up to the "RD doesnt place on
    // elongated RDs rhombic sides" fix: elongDodecaMesh is now ALSO a
    // valid raycast target for 'rd'/'cube' (see pick()'s own
    // elongDodecaTargets), handled by its own dedicated
    // handleRDOffElongDodecaClick in onClick -- but onContextMenu's own
    // generic fallback still reaches this same cellAt() for a
    // right-click there. Blindly indexing hit.instanceId into
    // cellOrder (the MAIN world's own instance-order array) for a hit
    // on a COMPLETELY DIFFERENT mesh would silently return the WRONG
    // cell (whichever one happens to sit at that same numeric index in
    // cellOrder) instead of null -- this explicit `hit.object === mesh`
    // check is what keeps that impossible, not just unlikely.
    cellAt: (hit) => (hit.object === mesh && hit.instanceId !== undefined
      ? cellOrder[hit.instanceId]
      : (partialCellMeshes.get(hit.object?.userData?.cellKey)?.cell ?? null)),
    world,
    onChange,
    onHover: (cells, valid) => {
      if (cells && cells.length > 0) {
        showGhost(cells);
        window.dispatchEvent(new CustomEvent('rhombiverse:faceHovered')); // B3, see docs/code-notes/render.md
      } else {
        hideGhost();
      }
    },
    onHoverEnd: hideGhost,
    onPlaced: (cell) => {
      flashAt(cell, 0x9de0ff);
      playPlaceSound();
      window.dispatchEvent(new CustomEvent('rhombiverse:cellPlaced', { detail: cell })); // B3
      // Hemi RD cluster stamps ('hemi3'/'hemi4', core/build.js's own
      // addHemisphereCluster) attach a real label naming which of the 8
      // corners or 3 axes was actually resolved -- direct instruction
      // 2026-09-06 ("just 8 instead"/"not a new geometry, just naming/
      // exposing what the corner math already gives"). Surfaced as a
      // real toast so the choice is legible, not an invisible internal
      // disambiguation detail.
      if (cell.label) showHudPrompt(cell.label, 2500);
    },
    onRemoved: (cell) => {
      flashAt(cell, 0xff8866);
      playRemoveSound();
    },
    // Direct live report 2026-08-26: the Pyramid piece tier's no-ops
    // (add on an already-full block, remove on an already-bare spot)
    // were real and correct but silent -- see core/build.js's own note
    // on onPieceNoOp for why this is the very first thing a new player
    // hits.
    // Piece-tier-aware: the TO tier's own no-ops (audited in, not
    // reported live) turned out to be the same "silent and correct, but
    // reads as broken" issue the Pyramid tier's live report caught --
    // most likely one being Remove+TO tapped on ordinary (non-TO) world
    // geometry, since most of what's actually on screen is RD, not TO.
    onPieceNoOp: (action) => {
      const piece = document.getElementById('piece-type-select')?.value;
      const messages = {
        pyramid: {
          add: "That pyramid's already there -- try a face you've removed one from, or switch Piece to Cube/RD to place a whole new block.",
          remove: 'No pyramid there to remove -- that face is already a flat cube.',
        },
        to: {
          add: 'A Truncated Octahedron is already there.',
          remove: "No Truncated Octahedron there to remove -- Remove+TO only clears an actual TO, not the RD world around it. Tap directly on one you've placed.",
        },
        elongdodeca: {
          add: 'An Elongated Dodecahedron is already there.',
          remove: "No Elongated Dodecahedron there to remove -- Remove+Elongated Dodecahedron only clears an actual one, not the RD world around it. Tap directly on one you've placed.",
        },
        rdquarter: {
          add: 'All 4 real rhombohedra are already placed in that cell.',
          remove: 'No RD Quarter there to remove -- tap directly on one you’ve placed.',
        },
        hexprism: {
          add: 'A Hex Prism is already there.',
          remove: "No Hex Prism there to remove -- Remove+Hex Prism only clears an actual one, not the RD world around it. Tap directly on one you've placed.",
        },
        idis: {
          add: "That disphenoid's already there.",
          remove: 'No disphenoid there to remove -- tap directly on one from the interstitial lattice.',
        },
        ioct: {
          add: 'That octahedron site is already complete there.',
          remove: 'No octahedron site there to remove -- tap directly on one of its own disphenoids.',
        },
        halfrd: {
          add: "A Hemi RD's already there.",
          remove: 'No Hemi RD there to remove -- tap directly on one you’ve placed.',
        },
        hourglass: {
          add: 'An Hourglass already bridges that boundary.',
          remove: 'No Hourglass there to remove -- tap directly on one you’ve placed.',
        },
        hemi3: {
          add: 'That corner cluster is already complete there.',
          remove: 'No Hemi RD there to remove -- tap directly on one you’ve placed.',
        },
        hemi4: {
          add: 'That band cluster is already complete there.',
          remove: 'No Hemi RD there to remove -- tap directly on one you’ve placed.',
        },
        hemiTri: {
          add: 'That triangle cluster is already complete there.',
          remove: 'No Hemi RD there to remove -- tap directly on one you’ve placed.',
        },
      };
      // 2D lattice tier (Phase 3): one generic message per combination's
      // own label, replacing the old square2d/hexagon2d/triangle2d
      // hand-written trio -- same underlying "grow-only, tap directly on
      // an existing one to remove it" fact for every combination.
      const lattice2dCombo = piece?.startsWith('lattice2d:') ? LATTICE_2D_COMBINATIONS.find((c) => `lattice2d:${c.id}` === piece) : null;
      const lattice2dMessages = lattice2dCombo && {
        add: `A ${lattice2dCombo.label} tile is already there.`,
        remove: `No ${lattice2dCombo.label} tile there to remove -- Remove only clears an actual one, not the RD world around it. Tap directly on one you've placed.`,
      };
      showHudPrompt((lattice2dMessages ?? messages[piece])?.[action] ?? 'Nothing to do there.', 3500);
    },
    getDragPlacementEnabled: () => pickers.isDragPlacementEnabled(),
    getMode: () => (walking ? null : currentMode),
    getShellCount,
    getMinShell: () => Math.min(Math.max(1, Number(hollowFromInput.value) || 1), getShellCount()),
    getMaterial: () => currentMaterialFor(document.getElementById('piece-type-select').value),
    getPieceType: () => document.getElementById('piece-type-select').value,
    // TO ("adopted family member", direct instruction 2026-08-26): lets
    // the universal Add/Remove actions ALSO target the separate BCC
    // dual-lattice world, via core/build.js's own handleToClick (which
    // owns the bootstrap-vs-extend logic directly, using
    // geometry-extensions/dual-lattice.js's matchBCCNeighborOffset) --
    // not a pretense that a truncated octahedron is a piece of the same RD
    // decomposition RD/Cube/Pyramid are. bccWorld/bccMesh always exist
    // regardless of FEATURES.bccLattice (see their own construction
    // above); the Piece picker's own 'to' option is what's actually
    // feature-gated (below), so no separate guard is needed here.
    bccWorld,
    bccMesh,
    bccCellAt: (instanceId) => bccCellOrder[instanceId],
    onBCCChange,
    elongDodecaWorld,
    elongDodecaMesh,
    elongDodecaCellAt: (instanceId) => elongDodecaCellOrder[instanceId],
    onElongDodecaChange,
    hexPrismWorld,
    hexPrismMesh,
    hexPrismCellAt: (instanceId) => hexPrismCellOrder[instanceId],
    onHexPrismChange,
    // 2D lattice tier (Phase 3): one `lattice2d` param replaces the old
    // square2dWorld/square2dMesh/square2dCellAt(+Hexagon/+Triangle)
    // trio-of-trios -- see core/build.js's own `lattice2d` param
    // comment for why. `stores` is built fresh here (not cached)
    // because it's cheap (12 entries) and always needs to reflect
    // lattice2dWorlds/lattice2dMeshes' own current contents.
    lattice2d: {
      combos: LATTICE_2D_COMBINATIONS,
      stores: new Map(LATTICE_2D_COMBINATIONS.map((c) => [
        c.id,
        { world: lattice2dWorlds.get(c.id), mesh: lattice2dMeshes.get(c.id), cellAt: (instanceId) => lattice2dCellOrders.get(c.id)?.[instanceId] },
      ])),
      s: LATTICE2D_S,
      onChange: onLattice2dChange,
    },
    rhombohedraWorld,
    rhombohedraMesh,
    rhombohedraCellAt: (instanceId) => rhombohedraCellOrder[instanceId],
    onRhombohedraChange,
    interstitialStore,
    interstitialGroup,
    onInterstitialChange,
    hemisphereStore,
    hemisphereGroup,
    onHemisphereChange,
    canPlaceMaterial,
    getOwnerId: () => LOCAL_PLAYER_ID,
    onCellClicked: (cell) => {
      focusedCenterKey = cell.shellCenter || null;
      renderRingList();
    },
  });

  // BCC dual-lattice build: own change handler, deliberately NOT the main
  // world's onChange() -- that pipeline is entirely World Systems
  // machinery (asteroid regen, hydrosphere, achievements, undo stack...)
  // that's off in Rhombeometry mode anyway, the only mode this build ever
  // runs in. Mirrors how Sculpture Mode's own sculptTarget.apply is a
  // small dedicated rebuild, not a reuse of onChange(). Still shared by
  // core/build.js's own Piece:TO handleToClick (the standalone BCC Build
  // mode/controller this used to also serve was cut 2026-09-02 as
  // redundant with that -- see core/build.js's own onBCCChange param
  // and rhombic-wheel-3d-core.js's WHEEL_HOME comment for the removal).
  function onBCCChange() {
    // Same "never truly empty" invariant as the main world's own
    // onChange() -- direct instruction, 2026-08-29: applies to every
    // lattice, not just the FCC one. (0,0,0) is a real, always-valid BCC
    // lattice point (isBCC: all-even), so this restores exactly the
    // same kind of real, buildable anchor a fresh BCC placement starts
    // from.
    if (bccWorld.entries().length === 0) {
      bccWorld.addCell(0, 0, 0, { material: 'base' });
    }
    rebuildBCCInstances(bccMesh, bccWorld);
    updateSectionEnabled(); // keeps bccMesh's own material in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    saveToLocalStorage(bccWorld.toJSON(), BCC_STORAGE_KEY);
  }

  // Elongated Dodecahedron build: own change handler, same reasoning as
  // onBCCChange above. No "never truly empty" invariant here -- see
  // elongDodecaWorld's own construction comment above for why it doesn't
  // need one (the main FCC world, which DOES enforce that invariant via
  // seedIfWorldEmpty(), is always a valid bootstrap surface for it).
  function onElongDodecaChange() {
    rebuildElongDodecaInstances(elongDodecaMesh, elongDodecaWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    saveToLocalStorage(elongDodecaWorld.toJSON(), ELONGDODECA_STORAGE_KEY);
  }

  // Hex Prism build: own change handler. "Never truly empty" invariant
  // (see hexPrismWorld's own construction comment above for why this
  // one specifically needs it, unlike elongDodecaWorld).
  function onHexPrismChange() {
    if (hexPrismWorld.entries().length === 0) {
      hexPrismWorld.addCell(0, 0, 0, { material: 'base' });
    }
    rebuildHexPrismInstances(hexPrismMesh, hexPrismWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    saveToLocalStorage(hexPrismWorld.toJSON(), HEXPRISM_STORAGE_KEY);
  }

  // 2D lattice tier (Phase 3): ONE generic change handler for every
  // (angle, primitive) combination, replacing the old onSquare2dChange/
  // onHexagon2dChange/onTriangle2dChange trio -- same "never truly
  // empty" invariant, keyed by the combination's own index (for its
  // own off-origin seed offset, matching lattice2dWorlds' own
  // construction above) rather than 3 hand-picked seed positions.
  function onLattice2dChange(comboId) {
    const combo = LATTICE_2D_COMBINATIONS.find((c) => c.id === comboId);
    const idx = LATTICE_2D_COMBINATIONS.indexOf(combo);
    const world = lattice2dWorlds.get(comboId);
    if (world.entries().length === 0) {
      const [sx, sy] = lattice2dSeedCell(idx);
      world.addCell(sx, sy, 0, { material: LATTICE2D_SEED_COLORS[idx % LATTICE2D_SEED_COLORS.length] });
    }
    rebuildLattice2dInstances(lattice2dMeshes.get(comboId), world, combo);
    updateSectionEnabled();
    applyWorldViewMaterials();
    saveToLocalStorage(world.toJSON(), lattice2dStorageKey(comboId));
  }

  // Rhombohedra build (free lattice): own change handler, same "never
  // truly empty" invariant.
  function onRhombohedraChange() {
    if (rhombohedraWorld.entries().length === 0) {
      rhombohedraWorld.addCell(5, 0, 0, { material: 'base' });
    }
    rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    saveToLocalStorage(rhombohedraWorld.toJSON(), RHOMBOHEDRA_STORAGE_KEY);
  }

  // Interstitial-lattice build: own change handler, same reasoning as
  // onBCCChange above (Rhombeometry-only, no World Systems pipeline).
  function onInterstitialChange() {
    // Same invariant again -- bootstrapDisphenoid([0,0,0]) is the exact
    // same canonical anchor disphenoid every fresh interstitial build
    // already starts from (interstitial-lattice.js's own sanity gate
    // uses this same anchor), not a special case invented here.
    if (interstitialStore.entries().length === 0) {
      interstitialStore.addDisphenoid(bootstrapDisphenoid([0, 0, 0]), { material: 'base' });
    }
    rebuildInterstitialMeshes(interstitialStore);
    updateSectionEnabled(); // keeps newly created interstitial mesh materials in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    saveToLocalStorage(interstitialStore.toJSON(), INTERSTITIAL_STORAGE_KEY);
  }

  // Hemisphere pieces: own change handler, same reasoning as onBCCChange/
  // onInterstitialChange above -- no "never truly empty" seed needed, see
  // this store's own construction comment above.
  function onHemisphereChange() {
    rebuildHemisphereMeshes(hemisphereStore);
    updateSectionEnabled(); // keeps newly created hemisphere mesh materials in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    saveToLocalStorage(hemisphereStore.toJSON(), HEMISPHERE_STORAGE_KEY);
  }
  // Cuboctahedron Build: own change handler, same "never truly empty"
  // reasoning as onBCCChange/onInterstitialChange above.
  function onCuboctaChange() {
    if (cuboctaWorld.entries().length === 0) {
      cuboctaWorld.addCell(0, 0, 0, { material: 'base' });
    }
    rebuildCuboctaInstances(cuboctaMesh, cuboctaWorld);
    updateSectionEnabled(); // keeps cuboctaMesh's own material in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    saveToLocalStorage(cuboctaWorld.toJSON(), CUBOCTA_STORAGE_KEY);
  }
  createCuboctaBuildController({
    renderer,
    camera,
    fccMesh: mesh,
    cuboctaMesh,
    fccCellAt: (instanceId) => cellOrder[instanceId],
    cuboctaCellAt: (instanceId) => cuboctaCellOrder[instanceId],
    cuboctaWorld,
    onChange: onCuboctaChange,
    getMaterial: () => currentMaterialFor('cubocta'),
    isActive: () => !walking && currentMode === 'cubocta' && FEATURES.bccLattice,
  });

  // Cuboctahedron gap-octahedron Build: own change handler -- genuinely
  // optional/manually placed, so unlike onCuboctaChange there is no
  // "never truly empty" seeding here.
  function onOctGapChange() {
    rebuildOctGapInstances(octGapMesh, octGapWorld);
    updateSectionEnabled();
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    saveToLocalStorage(octGapWorld.toJSON(), CUBOCTA_GAP_STORAGE_KEY);
  }
  // Driven by the Piece picker's own 'octahedron' slot (a real, separate
  // value from 'ioct' -- direct user decision to keep the old flattened
  // Octahedron Site/4-disphenoid bundle on the wheel exactly as it was,
  // rather than replace it) -- reachable in the generic Build/Chisel
  // modes (same as idis) rather than a dedicated mode, driven by the
  // SAME #piece-type-select the wheel already surfaces, not currentMode.
  createCuboctaGapBuildController({
    renderer,
    camera,
    cuboctaMesh,
    octGapMesh,
    cuboctaCellAt: (instanceId) => cuboctaCellOrder[instanceId],
    octGapCellAt: (instanceId) => octGapCellOrder[instanceId],
    octGapWorld,
    onChange: onOctGapChange,
    getMaterial: () => currentMaterialFor('octahedron'),
    isActive: () =>
      !walking &&
      (currentMode === 'build' || currentMode === 'chisel') &&
      FEATURES.bccLattice &&
      document.getElementById('piece-type-select')?.value === 'octahedron',
  });

  // The old 2D radial menu (wheel.js) was removed 2026-08-25 -- the
  // Rhombic Wheel 3D is now the sole navigation surface, per direct
  // user decision. See docs/code-notes/app/rhombic-wheel-3d.md.
  // createWheelPickers keeps the real material/generator/species
  // picker overlays and the drag-placement toggle alive independent of
  // either wheel's own UI -- these are used directly by the 3D wheel.
  const pickers = createWheelPickers({
    onModeChosen: () => {
      updateModeUI();
      rebuildInstances(mesh, world, currentMode === 'report');
    },
    onDragPlacementChange: (enabled) => {
      controls.mouseButtons.LEFT = enabled ? null : ORBIT_LEFT_DEFAULT;
    },
    onMenuSound: playMenuSound,
    onSelectionChange: updateHudIndicator,
    getMaterialColor: (value) => `#${(MATERIAL_COLORS[value] ?? MATERIAL_COLORS.base).toString(16).padStart(6, '0')}`,
    onMaterialHoverPreview: (value) => {
      materialPreviewColor = MATERIAL_COLORS[value] ?? MATERIAL_COLORS.base;
      if (lastHoverCells) showGhost(lastHoverCells);
    },
    onMaterialHoverEnd: () => {
      materialPreviewColor = null;
      if (lastHoverCells) showGhost(lastHoverCells);
    },
  });
  updateHudIndicator();

  // See docs/code-notes/render.md
  // Ported 2026-08-25 off the old 2D wheel's DOM (simulated clicks on
  // .wheel-item text) onto the real underlying primitives directly --
  // the same ones the Rhombic Wheel 3D itself now drives, see
  // rhombic-wheel-3d-core.js's tool:* actions in render.js's onAction.
  // No UI dependency at all now, 2D or 3D.
  applyPersonaChoiceFn = (persona) => {
    const clickMode = (modeName) => document.querySelector(`.mode-btn[data-mode="${modeName}"]`)?.click();
    // 'rhombinaut' (Explore/walk) and 'rhombiologist' (Cultivate/plant)
    // removed 2026-09-22 along with those systems -- this whole
    // personaChosen mechanism has no live dispatcher anywhere in the app
    // today (grepped: nothing fires 'rhombiverse:personaChosen'), so
    // these branches were already unreachable; trimmed rather than left
    // referencing archived UI.
    if (persona === 'rhombisculptor') {
      clickMode('sculpt');
      openSculptPanel();
    }
    // 'rhombitect' (Build): already the default state, nothing to do.
  };
  if (pendingPersonaChoice) {
    applyPersonaChoiceFn(pendingPersonaChoice);
    pendingPersonaChoice = null;
  }

  // Shared by both the Lab panel's own "New World" button and the always-
  // visible HUD clear-world-toggle added alongside it (2026-08-25) -- same
  // action, a second, easier-to-find entry point for it since the Lab
  // panel lives behind the gear icon and isn't the first thing a returning
  // player necessarily opens.
  async function clearWorldToNew() {
    if (!confirm('Start a new world? This clears your current build.')) return;
    // Real report, 2026-08-29: "still have zero cells" after Clear World
    // -- reproduced directly. The data-level fix (onChange()'s own
    // never-empty invariant) was already correct, but this function
    // never recentered the camera, so if it had drifted away from the
    // origin (building/exploring elsewhere, then the SAVED camera state
    // carrying that forward), the one real starter cell existed but sat
    // completely off-screen and unclickable -- looks and feels exactly
    // like zero even though it isn't. Same reasoning as
    // enterSculptureMode's own camera.position.set(6,5,8)/controls.
    // target.set(0,0,0) reset.
    camera.position.set(6, 5, 8);
    controls.target.set(0, 0, 0);
    controls.update();
    saveCameraState(camera.position, controls.target);
    clearLocalStorage();
    const fresh = await loadWorld('./data/starter-world.json');
    world.replaceAll(fresh);
    onChange();
    // BCC dual-lattice build: a real second world store, so a "fresh
    // start" needs to clear it too, not just the main one -- see
    // core/bcc-build.md.
    clearLocalStorage(BCC_STORAGE_KEY);
    bccWorld.replaceAll({ worldName: 'BCC Lattice', version: 1, cells: {}, meta: {} });
    onBCCChange();
    // Interstitial-lattice build: a third real store, same "fresh start
    // clears it too" reasoning as BCC above.
    clearLocalStorage(INTERSTITIAL_STORAGE_KEY);
    interstitialStore.replaceAll({ worldName: 'Interstitial Lattice', version: 1, cells: {} });
    onInterstitialChange();
    // Cuboctahedron Build: a fourth real store, same "fresh start clears
    // it too" reasoning as BCC/interstitial above.
    clearLocalStorage(CUBOCTA_STORAGE_KEY);
    cuboctaWorld.replaceAll({ worldName: 'Cuboctahedron Lattice', version: 1, cells: {} });
    onCuboctaChange();
    // Cuboctahedron gap-octahedron Build: a fifth real store, same
    // "fresh start clears it too" reasoning as above.
    clearLocalStorage(CUBOCTA_GAP_STORAGE_KEY);
    octGapWorld.replaceAll({ worldName: 'Cuboctahedron Gap Octahedra', version: 1, cells: {} });
    onOctGapChange();
    // Hemisphere pieces: a sixth real store, same "fresh start clears it
    // too" reasoning as BCC/interstitial/Cuboctahedron/gap above.
    clearLocalStorage(HEMISPHERE_STORAGE_KEY);
    hemisphereStore.replaceAll({ worldName: 'Hemisphere Pieces', version: 1, pieces: {} });
    onHemisphereChange();
    // Elongated Dodecahedron/Hex Prism/Square (2D): 3 more real stores
    // added later, same session -- real bug, direct report ("hex prisms
    // aren't going when pressing clear current build"): these were never
    // wired into this function at all, so Clear World silently left them
    // untouched. Same "fresh start clears it too" reasoning as every
    // store above.
    clearLocalStorage(ELONGDODECA_STORAGE_KEY);
    elongDodecaWorld.replaceAll({ worldName: 'Elongated Dodecahedron Lattice', version: 1, cells: {}, meta: {} });
    onElongDodecaChange();
    clearLocalStorage(HEXPRISM_STORAGE_KEY);
    hexPrismWorld.replaceAll({ worldName: 'Hex Prism Lattice', version: 1, cells: {}, meta: {} });
    onHexPrismChange();
    // 2D lattice tier (Phase 3): one loop over every combination,
    // replacing the old Square/Hexagon/Triangle hand-written trio --
    // same "fresh start clears it too" reasoning as every store above.
    LATTICE_2D_COMBINATIONS.forEach((combo) => {
      clearLocalStorage(lattice2dStorageKey(combo.id));
      lattice2dWorlds.get(combo.id).replaceAll({ worldName: `2D Lattice (${combo.label})`, version: 1, cells: {}, meta: {} });
      onLattice2dChange(combo.id);
    });
    clearLocalStorage(RHOMBOHEDRA_STORAGE_KEY);
    rhombohedraWorld.replaceAll({ worldName: 'Rhombohedra Lattice', version: 1, cells: {}, meta: {} });
    onRhombohedraChange();
  }
  document.getElementById('new-world').addEventListener('click', clearWorldToNew);
  document.getElementById('clear-world-toggle')?.addEventListener('click', clearWorldToNew);
  document.getElementById('reload-toggle')?.addEventListener('click', () => {
    location.reload();
  });

  document.getElementById('export-json').addEventListener('click', () => {
    exportWorldFile(world.toJSON());
  });

  // .rhomb: pure-model export, no game data (RHOMBIVERSE_CLAUDE_CODE_IMPLEMENTATION_PLAN.md
  // section 4) -- always extractable regardless of workspaceMode/pureGeometry.
  document.getElementById('export-rhomb')?.addEventListener('click', () => {
    exportWorldFile(world.toRhombJSON(), 'rhombiverse-model.rhomb');
  });

  document.getElementById('share-world')?.addEventListener('click', async () => {
    const hint = document.getElementById('share-world-hint');
    if (!compressionSupported()) {
      hint.textContent = "Your browser doesn't support the compression this needs -- try a recent Chrome/Firefox/Safari.";
      return;
    }
    hint.textContent = t('share.compressing', getSettings().language);
    try {
      const encoded = await encodeWorldForUrl(world.toJSON());
      const shareUrl = buildShareUrl(encoded);
      await navigator.clipboard.writeText(shareUrl);
      hint.textContent = `Link copied (${shareUrl.length} chars) -- paste it anywhere; opening it loads this exact World.`;
    } catch (err) {
      console.warn('Rhombiverse: world share failed', err);
      hint.textContent = t('share.failed', getSettings().language);
    }
  });

  const importInput = document.getElementById('import-json');
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const parsed = await importWorldFile(file);
      if (!confirmLargeWorldLoad(parsed)) return;
      world.replaceAll(parsed);
      onChange();
    } catch (err) {
      alert('That file is not valid Rhombiverse world JSON.');
      console.warn('Rhombiverse: import failed', err);
    } finally {
      importInput.value = '';
    }
  });

  // Preset-world picker (Showcase World, planetoid Body Types) removed
  // 2026-09-22 along with the rest of the game-world content -- see
  // data/presets-archived/. Building your own World, Export/Import, and
  // World sharing (compressed link) above are all that remain, and are
  // untouched.
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

let lastFrameTime = performance.now();

// Performance guardrail (reframe Stage 6): FPS meter + auto-degrade.
// Sampled once per second, not every frame -- a per-frame instant
// reading is too noisy to display or act on. Auto-degrade runs
// regardless of whether the meter itself is visible -- it's a safety
// net, not something you have to opt into to benefit from (matches the
// original B7 ask: "automatic quality/pixel-ratio reduction before
// content is dropped under load"). Real absolute FPS numbers depend
// entirely on the device this runs on -- this is self-calibrating
// (reacts to whatever the real hardware reports), unlike trying to
// guess a "safe" world size in advance.
const FPS_SAMPLE_MS = 1000;
const FPS_DEGRADE_THRESHOLD = 24;
const FPS_SUSTAINED_LOW_SAMPLES = 5; // ~5 consecutive low samples before acting -- avoids reacting to one bad second
const FPS_DEGRADE_COOLDOWN_MS = 15000; // lets a new quality level actually take effect before checking again
let fpsFrameCount = 0;
let fpsSampleWindowStart = performance.now();
let lowFPSSampleStreak = 0;
let lastDegradeAt = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000); // clamp avoids a huge step after a backgrounded tab regains focus
  lastFrameTime = now;

  fpsFrameCount++;
  if (now - fpsSampleWindowStart >= FPS_SAMPLE_MS) {
    const fps = (fpsFrameCount / (now - fpsSampleWindowStart)) * 1000;
    fpsFrameCount = 0;
    fpsSampleWindowStart = now;
    const meterEl = document.getElementById('fps-meter');
    if (meterEl) meterEl.textContent = `${fps.toFixed(0)} FPS`;

    lowFPSSampleStreak = fps < FPS_DEGRADE_THRESHOLD ? lowFPSSampleStreak + 1 : 0;
    const currentLevelIdx = QUALITY_LEVELS_ASCENDING.indexOf(getSettings().quality);
    if (
      lowFPSSampleStreak >= FPS_SUSTAINED_LOW_SAMPLES &&
      currentLevelIdx > 0 &&
      now - lastDegradeAt > FPS_DEGRADE_COOLDOWN_MS
    ) {
      const nextLevel = QUALITY_LEVELS_ASCENDING[currentLevelIdx - 1];
      updateSettings({ quality: nextLevel });
      lastDegradeAt = now;
      lowFPSSampleStreak = 0;
      showHudPrompt(`Performance: frame rate has been low, so graphics quality was automatically reduced to ${nextLevel}. Change it back anytime in Settings.`, 6000);
    }
  }

  controls.update();
  // Skip the (otherwise fully-hidden) world render while the Rhombic
  // Wheel 3D is open -- its own overlay/renderer covers the whole
  // screen, so this pass would be pure wasted GPU work every frame.
  // Everything else above (controls damping) still
  // runs -- only the render call itself is skipped.
  if (!isRhombicWheel3DOpen()) {
    renderer.render(sculptureModeActive ? sculptureScene : scene, camera);
  }
  // Always renders, regardless of the modal wheel's open state -- it's
  // a persistent HUD element, not something that should disappear
  // while other UI is open.
  hudWheel.render();
}

init();
animate();
