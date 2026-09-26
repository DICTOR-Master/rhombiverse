// Three.js scene, camera, RD mesh generation, instanced rendering, and most
// app orchestration.
//
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
import { bootstrapDisphenoid, disphenoidVertsToWorld, octahedronDisphenoids, disphenoidKey } from './geometry-extensions/interstitial-lattice.js';
import { sampleSuperellipsoidGrid, volumeMatchedRadius } from './geometry-extensions/spherical-toggle.js';
import { SKELETON_COLOR } from './app/rhombic-wheel-3d-core.js';
import { createDimensionWizard } from './app/dimension-wizard.js';
import { createWorld4D } from './app/world-4d.js';
import { createQuasicrystalWorld } from './app/world-quasicrystal.js';
import { createShellsWorld } from './app/world-shells.js';
import { createGoldenWorld } from './app/world-golden.js';
import { createKaleidoWorld } from './app/world-kaleidoscope.js';
import { makeQuasicrystal, PRISM_HEIGHT } from './geometry-extensions/quasicrystal.js';
import { loadCatalogue, findBySerial, zonotopeVertices, localPatch, polytopeShape } from './geometry-extensions/quasicrystal-catalogue.js';
import { elongatedDodecahedronVerts, elongDodecaCellToWorld } from './geometry-extensions/elongated-dodecahedron.js';
import { hexPrismVerts, hexCellToWorld, HEX_NEIGHBOR_OFFSETS } from './geometry-extensions/hex-prism.js';
import { NAMED_LATTICE_ANGLES, START_LATTICE_ANGLE, LATTICE_PRIMITIVES, LATTICE_PRIMITIVE_IMPLS, latticeBasis, RHOMBILLE_ANGLE_ID, RHOMBILLE_ARRANGEMENT_IMPL } from './geometry-extensions/lattice-2d.js';
import { rhombohedraTileVerts, rhombohedraOrientationMatrix, rhombohedraPieceWorld, rhombohedraMigrateLegacyCell, rhombohedraAttachOptions, rhombohedraOverlap } from './geometry-extensions/rhombohedra-lattice.js';
import { pyrochloreSiteOrientation, pyrochloreCellToWorld, truncatedTetrahedronVerts, tetrahedronVerts, pyrochloreCapTets, pyrochloreShapeStats, pyrochloreNeighborOffsets, pyrochloreCapTetsOf, pyrochloreVisibleTets, pyrochloreTetCornerPartner } from './geometry-extensions/pyrochlore-lattice.js';
import { FEATURES } from './app/features.js';
import { loadWorld, createWorldStore } from './core/worldstate-core.js';
import { createBuildController } from './core/build.js';
import { getSettings, updateSettings, onSettingsChange, QUALITY_PIXEL_RATIO_FACTOR, QUALITY_LEVELS_ASCENDING } from './app/settings.js';
import { t, LANG_ORDER, LANG_META } from './app/i18n.js';
import { playPlaceSound, playRemoveSound, playMenuSound } from './app/sfx.js';
import { createWheelPickers } from './app/wheel-pickers.js';
import { MARKS, iconFrame, swatchMark } from './app/wheel-icons.js';
import { createHudWheel3D } from './app/hud-wheel-3d.js';
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
  PYROCHLORE_STORAGE_KEY,
} from './core/persistence.js';
import { VALID_TRIPLES, unitTileVertices } from './geometry-extensions/growth.js';
// World-building/game systems (mining, trade, claims, achievements,
// animals, hazards, hydrosphere, gravity/planetoids, growth/evolution/
// cultivation, walking/exploring, Shared World sync) were retired and
// their code archived to an archive, since deleted (2026-09-24) -- see docs/HISTORY-retired-systems.md.

const SCALE = 1;
// Hex Prism: no special proportion is required for a plain hex-prism
// tiling (any height works, unlike Elongated Dodecahedron's own derived
// h) -- these are a deliberate, honestly-arbitrary aesthetic choice
// (roughly SCALE-sized), not a derived constant.
const HEX_PRISM_R = SCALE;
const HEX_PRISM_H = Math.sqrt(3) * SCALE;
// 2D lattice tier (Phase 3): direct correction, Phase 5 ("why are the
// shapes so tiny compared to dot still?" then, after the dot-field
// coverage fix alone wasn't enough, "STILL not letting me add by
// tapping"): bumped from a plain SCALE match to 2.5x it. A real, non-
// cosmetic reason this also matters for tapping, not just visual size --
// this drives BOTH the dot spacing AND the real tile's own edge length
// (see updateDotMatrix/lattice2dMeshes, both built from this SAME
// constant), so a bigger value gives a bigger on-screen tile with more
// actual room between its own center and each of its 4/3/6 neighbor
// directions -- exactly the precision a hit-point-direction click needs
// (see handleLattice2dClick's own header, core/build.js) to reliably
// resolve which neighbor a tap meant, rather than several directions
// crowding into the same few dozen screen pixels.
const LATTICE2D_S = SCALE * 2.5;
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
// Rhombohedra (free lattice): same real scale as everything else -- a
// genuine 3D solid, no special height/thinness constant needed.
const RHOMBOHEDRA_S = SCALE;
// Where the FIRST rhombohedron goes when its world is empty (the cyan
// target, 2026-09-24): RD Quarter piece 0 of the RD at the origin --
// 4 x its centroid, orientation 0. Old auto-seed spot kept below only to
// recognise and remove untouched legacy seeds on load.
const RHOMBOHEDRA_FIRST = [-1, -1, -1];
const RHOMBOHEDRA_LEGACY_SEED = rhombohedraMigrateLegacyCell(5, 0, 0);
// Pyrochlore (3D Kagome): registered to the main RD world's own units
// (direct decision) -- see geometry-extensions/pyrochlore-lattice.js.
const PYROCHLORE_S = SCALE;
// Where the FIRST truncated tetrahedron goes when the Pyrochlore world is
// empty (the cyan target, 2026-09-24): the O-site nearest the origin,
// world (1,0,0). Earlier auto-seed spots kept only to recognise and
// remove untouched legacy seeds on load.
const PYROCHLORE_FIRST = [2, 0, 0];
const PYROCHLORE_LEGACY_SEEDS = [[-10, 0, 0], [-6, 0, 0], [-3, -1, 1]];
const MAX_CELLS = 20000; // fixed InstancedMesh capacity


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);


// Dimension-select wizard (2026-09-22): which dimension tier the app is
// currently in ('3D' the only real value in Phase 1; null before a
// choice is made, which only ever happens for the instant between page
// load and init() force-opening WHEEL_DIMENSION -- see init()'s own
// "auto-open to dimension wheel" comment). In-memory only, never
// persisted -- every fresh load starts back at the dimension-select
// wheel, same "UI state, not world state" convention this app already
// applies to every other transient screen.
let activeDimension = null;
// The 4D world (src/app/world-4d.js) -- created in init, switched on
// only while activeDimension === '4D'.
let world4d = null;
// The 5D and 6D quasicrystal worlds (src/app/world-quasicrystal.js), by
// dimension, each switched on only while its dimension is active.
const qcWorlds = new Map();
// Worlds of their own inside 2D/3D (src/app/world-shells.js,
// world-golden.js, world-kaleidoscope.js): on while their dimension is
// active and one is the chosen piece ('shells' | 'golden' | 'kaleido').
let shellsWorld = null;
let goldenWorld = null;
let kaleidoWorld = null;
let own3D = null;
const OWN_WORLD_DIMENSION = { shells: '3D', golden: '3D', kaleido: '2D' };
const own3DWorld = () => ({ shells: shellsWorld, golden: goldenWorld, kaleido: kaleidoWorld })[own3D] ?? null;
const own3DActive = () => !!own3DWorld() && activeDimension === OWN_WORLD_DIMENSION[own3D];
// 4D, 5D, 6D and the own 3D worlds each own their scene, taps, Lattice View and Skeleton.
const isOwnWorldDimension = () => activeDimension === '4D' || qcWorlds.has(activeDimension) || own3DActive();
const activeOwnWorld = () => (own3DActive() ? own3DWorld() : qcWorlds.get(activeDimension) ?? world4d);

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
  getBackgroundColor: () => scene.background,
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
// (lets you see inside a solid structure). Disabled by default
// (empty clippingPlanes array); #section-enable populates
// material.clippingPlanes with this same Plane object, so mutating its
// normal/constant here is picked up automatically next frame with no
// separate "apply" step.
const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
// X-Ray cut direction for a #section-axis value: the 3 coordinate axes
// plus (angled X-Ray, 2026-09-24, direct request) the 4 cube body-
// diagonals -- a cut perpendicular to any of those slices Pyrochlore
// (3D Kagome) into its own Kagome layers.
const SECTION_AXIS_DIRS = {
  x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1],
  d111: [1, 1, 1], d1mm: [1, -1, -1], dm1m: [-1, 1, -1], dmm1: [-1, -1, 1],
};
function sectionAxisVector(axis) {
  return new THREE.Vector3(...(SECTION_AXIS_DIRS[axis] ?? SECTION_AXIS_DIRS.x)).normalize();
}

function updateSectionPlane() {
  const axis = document.getElementById('section-axis').value;
  const flip = document.getElementById('section-flip').checked;
  const pos = Number(document.getElementById('section-pos').value) || 0;
  // The plane's own position (a point on it) is always `pos` along the
  // chosen axis, regardless of flip -- only the normal direction (which
  // side gets kept vs. clipped) should change when flipping, not where
  // the plane physically sits.
  const axisVec = sectionAxisVector(axis);
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
// Real bug, direct report ("still unable to tap and place on iPad"):
// applyDimensionCamera's own 2D remap below only ever touched
// controls.mouseButtons.LEFT (mouse-specific), never
// controls.touches.ONE -- OrbitControls' SEPARATE single-finger touch
// gesture setting, which defaults to THREE.TOUCH.ROTATE. Even with
// enableRotate=false suppressing the actual rotation, a real one-
// finger tap on a touchscreen still goes through OrbitControls' own
// touch-drag state machine first (mismatched from the intended 2D
// "flat planar movement" pan design), which can swallow the touch
// sequence before the browser's own synthesized 'click' event -- the
// one build.js's own onClick listener actually needs -- ever fires.
// Saved once here, same pattern as ORBIT_LEFT_DEFAULT, so it can be
// restored exactly on the way back to 3D.
const ORBIT_TOUCH_ONE_DEFAULT = controls.touches.ONE;

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
    // Real bug, direct report ("still unable to tap and place on
    // iPad"): the mouseButtons.LEFT remap just above only ever covered
    // mouse input -- controls.touches.ONE (OrbitControls' separate
    // single-finger touch gesture, defaulting to THREE.TOUCH.ROTATE)
    // was never touched, so a real one-finger tap on a touchscreen
    // still went through the ROTATE touch-drag state machine first
    // (mismatched from 2D's own "flat planar movement" design), which
    // can swallow the touch sequence before the browser's own
    // synthesized 'click' (the one build.js's own onClick listener
    // needs) ever fires -- see ORBIT_TOUCH_ONE_DEFAULT's own header.
    if (controls.touches.ONE !== null) controls.touches.ONE = THREE.TOUCH.PAN;
    controls.update();
  } else {
    controls.enableRotate = true;
    if (controls.mouseButtons.LEFT !== null) controls.mouseButtons.LEFT = ORBIT_LEFT_DEFAULT;
    if (controls.touches.ONE !== null) controls.touches.ONE = ORBIT_TOUCH_ONE_DEFAULT;
    if (cameraSavedFor2D) {
      camera.position.copy(saved3DCameraState.position);
      controls.target.copy(saved3DCameraState.target);
      cameraSavedFor2D = false;
      controls.update();
    }
  }
}

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


// B6 onboarding sequence removed 2026-09-22 -- narrated Full World/game
// content (an "already-built World," "growing life", other players) that
// no longer exists; its own enable() call was already permanently
// unreachable (gated on !pureGeometry, which settings.js forces true
// unconditionally). The old onboarding.json (retired game content) was deleted 2026-09-24.


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


})();

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
// The main light rides with the camera (direct request 2026-09-25: an
// underside turned toward you should be shaded like a top or side, not
// flat ambient). It keeps the angle the old fixed sun at (5, 8, 4) had
// from the default view at (6, 5, 8), so the opening view looks the same.
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
{
  const home = new THREE.PerspectiveCamera();
  home.position.set(6, 5, 8);
  home.lookAt(0, 0, 0);
  home.updateMatrixWorld();
  sun.position.copy(home.worldToLocal(new THREE.Vector3(5, 8, 4)));
  sun.target.position.copy(home.worldToLocal(new THREE.Vector3(0, 0, 0)));
}
camera.add(sun, sun.target);
scene.add(camera);

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
// Real volume + nearest face-plane distance of a convex point cloud,
// measured from its own ConvexGeometry (centroid-fan tetrahedra) -- used
// for the shapes added to the Spherical Toggle 2026-09-24 (ED, Hex
// Prism, Rhombohedron) so their sphere radius follows the SAME cap()
// rule as every other shape without hand-deriving each formula.
function convexVolumeAndCeiling(verts) {
  const g = new ConvexGeometry(verts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const pos = g.attributes.position;
  const c = [0, 1, 2].map((a) => verts.reduce((sum, v) => sum + v[a], 0) / verts.length);
  const at = (i) => [pos.getX(i) - c[0], pos.getY(i) - c[1], pos.getZ(i) - c[2]];
  let volume = 0;
  let ceiling = Infinity;
  for (let i = 0; i < pos.count; i += 3) {
    const [a, b, d] = [at(i), at(i + 1), at(i + 2)];
    const n = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
    volume += Math.abs(a[0] * (b[1] * d[2] - b[2] * d[1]) - a[1] * (b[0] * d[2] - b[2] * d[0]) + a[2] * (b[0] * d[1] - b[1] * d[0])) / 6;
    const len = Math.hypot(...n);
    if (len > 1e-12) ceiling = Math.min(ceiling, Math.abs(n[0] * a[0] + n[1] * a[1] + n[2] * a[2]) / len);
  }
  g.dispose();
  return { volume, ceiling };
}

function sphericalClassificationFor(scale) {
  const cap = (volume, ceiling) => ({ mode: 'sphere', R: Math.min(volumeMatchedRadius(volume), ceiling) });
  const capStats = ({ volume, ceiling }) => cap(volume, ceiling);
  return {
    rd: cap(2 * scale ** 3, scale / Math.SQRT2),
    octahedron: cap(scale ** 3 / 6, 0.5 * scale),
    cuboctahedron: cap((5 / 6) * scale ** 3, 0.5 * scale),
    truncatedOctahedron: cap(4 * scale ** 3, scale),
    // Pyrochlore (3D Kagome) -- see pyrochloreShapeStats for the real
    // volumes and nearest-face ceilings.
    truncatedTetrahedron: cap(pyrochloreShapeStats(scale).truncatedTetrahedron.volume, pyrochloreShapeStats(scale).truncatedTetrahedron.ceiling),
    tetrahedron: cap(pyrochloreShapeStats(scale).tetrahedron.volume, pyrochloreShapeStats(scale).tetrahedron.ceiling),
    // View-mode backfill (2026-09-24): ED, Hex Prism, Rhombohedra.
    elongDodeca: capStats(convexVolumeAndCeiling(elongatedDodecahedronVerts(scale))),
    hexPrism: capStats(convexVolumeAndCeiling(hexPrismVerts(HEX_PRISM_R, HEX_PRISM_H))),
    rhombohedron: capStats(convexVolumeAndCeiling(rhombohedraTileVerts(RHOMBOHEDRA_S))),
  };
}

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
  cyan: 0x22c3e6,
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

// Each piece type's colour in the Type colour mode (see COLOR_MODES
// below). 'cubocta' is a virtual key: the Cuboctahedron is a separate
// mode, not a #piece-type-select entry, so its placer passes it directly.
// These are defaults: the live mapping is autoAssignOverrides, edited in
// the Type list (#auto-assign-colors-row) and saved to localStorage.
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
  elongdodeca: 'rose-quartz',
  hexprism: 'water',
  rhombohedra: 'glassite',
  pyrochlore: 'emerald',
  'lattice2d:parallelogram': 'water',
  'lattice2d:triangle': 'garnet',
  'lattice2d:hexagon': 'emerald',
  'lattice2d:kite': 'amethyst',
  'lattice2d:kagome': 'gold',
  'kaleido:thick': 'gold',
  'kaleido:thin': 'water',
  'kaleido:pentagon': 'garnet',
  'kaleido:triangle': 'emerald',
  'kaleido:hexagon': 'amethyst',
  'kaleido:square': 'citrine',
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
  elongdodeca: 'Elongated Dodecahedron',
  hexprism: 'Hexagonal Prism',
  rhombohedra: 'Rhombohedra',
  pyrochlore: 'Pyrochlore (3D Kagome)',
  'lattice2d:parallelogram': '2D Parallelogram',
  'lattice2d:triangle': '2D Triangle',
  'lattice2d:hexagon': '2D Hexagon',
  'lattice2d:kite': '2D Kite',
  'lattice2d:kagome': '2D Kagome',
  'kaleido:thick': 'Kaleidoscope: Thick rhombus',
  'kaleido:thin': 'Kaleidoscope: Thin rhombus',
  'kaleido:pentagon': 'Kaleidoscope: Pentagon',
  'kaleido:triangle': 'Kaleidoscope: Triangle',
  'kaleido:hexagon': 'Kaleidoscope: Hexagon',
  'kaleido:square': 'Kaleidoscope: Square',
};

// Piece colour mode (2026-09-26, parity with Polyhedraverse's Green /
// Family / Pick): 'cyan' shows every piece cyan (the default), 'type'
// shows each piece in its piece type's colour (live, from the Type
// list), 'pick' shows each piece's own saved colour (cell.material).
// Only 'pick' reads stored colours, so switching never loses them.
const COLOR_MODES = ['cyan', 'type', 'pick'];
const AUTO_ASSIGN_STORAGE_KEY = 'rhombiverse-auto-assign-materials';
const COLOR_MODE_STORAGE_KEY = 'rhombiverse-color-mode';
// Read from storage here, not in the settings setup, because the worlds
// are first drawn before that runs. The setup then points typeMaterial at
// the live, editable Type list.
const colorView = {
  mode: (() => { try { const m = localStorage.getItem(COLOR_MODE_STORAGE_KEY); return COLOR_MODES.includes(m) ? m : 'cyan'; } catch { return 'cyan'; } })(),
  typeMaterial: (() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(AUTO_ASSIGN_STORAGE_KEY)) ?? {}; } catch { /* defaults */ }
    return (type) => saved[type] ?? AUTO_ASSIGN_MATERIAL_BY_PIECE[type] ?? 'base';
  })(),
};
/** A stored colour as currently shown: the 4D/5D/6D worlds only store a colour, so Cyan applies and Type/Pick show what was placed. */
function viewMaterialColor(material) {
  return colorView.mode === 'cyan' ? new THREE.Color(MATERIAL_COLORS.cyan) : materialColor(material);
}

const _shellColorCache = new Map();
function shellTint(shell) {
  if (!shell) return new THREE.Color(1, 1, 1);
  if (!_shellColorCache.has(shell)) {
    _shellColorCache.set(shell, new THREE.Color().setHSL((shell * 0.15) % 1, 0.65, 0.55));
  }
  return _shellColorCache.get(shell);
}

const GENERATED_TINT = new THREE.Color(0x2a0a30);

function instanceColorFor(cell, type) {
  if (cell.generatedByBlackHole) return GENERATED_TINT;
  const base = colorView.mode === 'cyan' ? new THREE.Color(MATERIAL_COLORS.cyan)
    : colorView.mode === 'type' && type ? materialColor(colorView.typeMaterial(type))
    : materialColor(cell.material);
  if (!cell.shell) return base;
  return base.clone().lerp(shellTint(cell.shell), 0.35);
}

let cellOrder = []; // instanceId -> {x, y, z, ...cellData}

function visibleCells(world) {
  const base = world.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed');
  // Pyramid Sub-Cell: a partial cell can't be an instance of the shared
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

function rebuildInstances(mesh, world) {
  cellOrder = visibleCells(world);
  const m = new THREE.Matrix4();
  cellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, instanceColorFor(cell, 'rd'));
  });
  mesh.count = cellOrder.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Forces a bounding-sphere recompute.
  mesh.computeBoundingSphere();
  rebuildPartialCellMeshes(world);
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
    for (const mesh of buildPyramidOnlyMeshes(cell, instanceColorFor(cell, 'pyramid'))) {
      mesh.userData.cellKey = key;
      group.add(mesh);
    }
    object3D = group;
  } else {
    const geom = buildPartialCellGeometry(effectivePyramids(cell));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
    mat.color.copy(instanceColorFor(cell, 'cube'));
    object3D = new THREE.Mesh(geom, mat);
  }
  const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
  object3D.position.set(wx, wy, wz);
  object3D.userData.cellKey = key;
  return object3D;
}

function rebuildPartialCellMeshes(world) {
  const source = world.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed');
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
// 2D lattice tier: one instanceId->cell array PER PRIMITIVE, keyed by
// the primitive's own `id` -- same "separate array per family, never
// share cellAt's own instance-id space" reasoning as bccCellOrder/
// hexPrismCellOrder above, generalized off the earlier 3 separately-
// named arrays.
const lattice2dCellOrders = new Map(); // primitiveId -> instanceId -> {x, y, z, ...cellData}
const lattice2dCompanionOwners = new Map(); // companion InstancedMesh -> instanceId -> cellOrder index (Kagome)
const KAGOME_TRIANGLE_LIGHTEN_TO = new THREE.Color(0xffffff);
const KAGOME_TRIANGLE_LIGHTEN = 0.4;
// Pyrochlore: TTs split across 2 meshes by site orientation ([O-site,
// T-site] -- the two are exact inversions, each its own fixed geometry,
// translation-only instances so a hit's face normal is already world-
// aligned); derived cap tets across 2 more ([up, down]). Tet instance
// indices don't line up with any cell order, so each tet mesh records
// per-instance {kind, center, cell} for tap resolution and tinting.
const pyrochloreCellOrders = [[], []];
const pyrochloreTetInstances = new Map(); // tet InstancedMesh -> instanceId -> { kind, center, cell }
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
    mat.color.copy(instanceColorFor(cell, cell.verts.length === 4 ? 'idis' : 'ioct'));
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
    mat.color.copy(instanceColorFor(piece, piece.type));
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
    bccMesh.setColorAt(i, instanceColorFor(cell, 'to'));
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
    elongDodecaMesh.setColorAt(i, instanceColorFor(cell, 'elongdodeca'));
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
    hexPrismMesh.setColorAt(i, instanceColorFor(cell, 'hexprism'));
  });
  hexPrismMesh.count = hexPrismCellOrder.length;
  hexPrismMesh.instanceMatrix.needsUpdate = true;
  if (hexPrismMesh.instanceColor) hexPrismMesh.instanceColor.needsUpdate = true;
  hexPrismMesh.computeBoundingSphere();
}

// Real placed 2D lattice cells -- same instancing pattern again,
// parametrized by `primitiveId` + the CURRENTLY toggled `angleDeg`
// (Phase 6, direct correction: "the toggle should work for groups of
// cells... it just needs to be able to do for real" -- see
// lattice2dSeedCell's own header for the full incident). Unlike every
// other rebuild function on this page, this one also replaces the
// mesh's own GEOMETRY (not just its instances' transforms) on every
// call: a primitive's own tile shape is a genuine function of angle
// (a parallelogram at 90 degrees is square; at 70.53 it's a slanted
// rhombus -- a different silhouette, not a repositioned one), so
// toggling the angle on an ALREADY-BUILT structure needs its real
// geometry to change too, not just where each already-placed instance
// sits. Orientation handling (Triangle's "down" instances reuse the SAME
// "up" geometry via a 180-degree Z-rotation baked into the instance
// matrix; Kite's own other fan positions reuse fan-index-0's geometry via
// an N-fold rotation, same trick generalized -- both exact per lattice-
// 2d.js's own verified header) is `impl.hasOrientation`, driving a call
// to `impl.instanceRotationRad(angleDeg, cell.z)` rather than a hardcoded
// 180-degree flip.
// Resolves which impl is actually active for `primitiveId` right now --
// RHOMBILLE_ARRANGEMENT_IMPL swaps in for 'parallelogram' only when
// `arrangementId` is 'rotational', otherwise the plain
// LATTICE_PRIMITIVE_IMPLS entry. The one place this decision is made,
// module-level (not closed over init()'s own toggle state) so both
// rebuildLattice2dInstances below and build.js's click handler (via the
// lattice2d.getImpl accessor init() passes it) read through the exact
// same function and can never disagree about which geometry is active.
// Trusts `arrangementId` rather than re-deriving applicability from the
// current angle -- init()'s own toggle-panel handlers are responsible for
// resetting it to 'translation' whenever the Rhombille row stops applying
// (see renderLattice2dPanel's own angle/primitive click handlers).
function resolveLattice2dImpl(primitiveId, arrangementId) {
  if (primitiveId === 'parallelogram' && arrangementId === 'rotational') return RHOMBILLE_ARRANGEMENT_IMPL;
  return LATTICE_PRIMITIVE_IMPLS[primitiveId];
}
// `companionMeshes` (Kagome only): its up/down triangle meshes, one
// instance per real triangle touching ANY placed hexagon (the Star of
// David fix -- see lattice-2d.js's own kagomeStarTriangles header), so
// their instance index does NOT line up with cellOrder. Each instance's
// owning cellOrder index is recorded in lattice2dCompanionOwners so a
// tap on a triangle still resolves to a real stored cell (see the
// lattice2d store's own cellAt). Tinted a lighter shade of the owner's
// color so the hexagon reads as its own shape.
//
// `classMeshes` (Kite only, when impl.classCount(angleDeg) > 1): the
// OPPOSITE of companions -- every one of these IS a real click target
// (see build.js's own broadened store.classMeshes check). Each real cell
// (cellOrder index i) belongs to exactly ONE class mesh; every OTHER
// class mesh gets a DEGENERATE (zero-scale) instance at that SAME index
// i, which THREE's raycaster correctly treats as unhittable (a zero-area
// triangle has no real intersection) -- so index i always means the same
// cell across every class mesh, letting cellAt stay a single flat lookup
// with no per-mesh bookkeeping, and a click can only ever register
// against the ONE mesh actually showing real geometry at that spot.
function rebuildLattice2dInstances(mesh, world, primitiveId, angleDeg, arrangementId = 'translation', companionMeshes = null, classMeshes = null) {
  const impl = resolveLattice2dImpl(primitiveId, arrangementId);
  const cellOrder = world.entries();
  lattice2dCellOrders.set(primitiveId, cellOrder);
  const numClasses = impl.classCount ? impl.classCount(angleDeg) : 1;

  if (impl.classCount && classMeshes && numClasses > 1) {
    const m = new THREE.Matrix4();
    classMeshes.forEach((classMesh, c) => {
      if (c < numClasses) {
        const classGeometry = new ConvexGeometry(impl.classTileVerts(angleDeg, c, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        classGeometry.computeVertexNormals();
        classMesh.geometry.dispose();
        classMesh.geometry = classGeometry;
      }
      cellOrder.forEach((cell, i) => {
        if (c < numClasses && impl.classOf(cell.z, angleDeg) === c) {
          const [wx, wy, wz] = impl.cellToWorld(cell.x, cell.y, cell.z, angleDeg, LATTICE2D_S, 0);
          m.makeRotationZ(impl.classInstanceRotationRad(cell.z, angleDeg));
          m.setPosition(wx, wy, wz);
        } else {
          m.makeScale(0, 0, 0);
        }
        classMesh.setMatrixAt(i, m);
        classMesh.setColorAt(i, instanceColorFor(cell, `lattice2d:${primitiveId}`));
      });
      classMesh.count = cellOrder.length;
      classMesh.instanceMatrix.needsUpdate = true;
      if (classMesh.instanceColor) classMesh.instanceColor.needsUpdate = true;
      classMesh.computeBoundingSphere();
    });
  } else {
    // Single-mesh path -- either this primitive has no class concept at
    // all, or the CURRENT angle only needs 1 (e.g. Kite at Square/
    // Triangular). Any extra class meshes from a PREVIOUS angle that
    // needed more must be emptied here, or they'd keep showing/blocking
    // clicks on stale geometry after switching back.
    if (classMeshes) for (let c = 1; c < classMeshes.length; c++) classMeshes[c].count = 0;
    const newGeometry = new ConvexGeometry(impl.tileVerts(angleDeg, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    newGeometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = newGeometry;
    const m = new THREE.Matrix4();
    cellOrder.forEach((cell, i) => {
      const [wx, wy, wz] = impl.cellToWorld(cell.x, cell.y, cell.z, angleDeg, LATTICE2D_S, 0);
      if (impl.hasOrientation) {
        m.makeRotationZ(impl.instanceRotationRad(angleDeg, cell.z));
        m.setPosition(wx, wy, wz);
      } else {
        m.makeTranslation(wx, wy, wz);
      }
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, instanceColorFor(cell, `lattice2d:${primitiveId}`));
    });
    mesh.count = cellOrder.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  if (impl.companions && companionMeshes) {
    impl.companions.forEach((companion, idx) => {
      const companionMesh = companionMeshes[idx];
      const companionGeometry = new ConvexGeometry(companion.tileVerts(angleDeg, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      companionGeometry.computeVertexNormals();
      companionMesh.geometry.dispose();
      companionMesh.geometry = companionGeometry;
      const cm = new THREE.Matrix4();
      const instances = companion.instances(cellOrder, angleDeg, LATTICE2D_S);
      instances.forEach(({ world: [wx, wy], owner }, i) => {
        cm.makeTranslation(wx, wy, 0);
        companionMesh.setMatrixAt(i, cm);
        companionMesh.setColorAt(i, instanceColorFor(cellOrder[owner], `lattice2d:${primitiveId}`).clone().lerp(KAGOME_TRIANGLE_LIGHTEN_TO, KAGOME_TRIANGLE_LIGHTEN));
      });
      lattice2dCompanionOwners.set(companionMesh, instances.map((inst) => inst.owner));
      companionMesh.count = instances.length;
      companionMesh.instanceMatrix.needsUpdate = true;
      if (companionMesh.instanceColor) companionMesh.instanceColor.needsUpdate = true;
      companionMesh.computeBoundingSphere();
    });
  }
}

// Real placed Rhombohedra cells (free lattice) -- same instancing
// pattern again, own rhombohedraCellToWorld position (a real 3D
// coordinate frame, no orientation flag or flat-tile height needed).
// 4 orientations (2026-09-24): cell = 4 x centroid, `o` = which of RD
// Quarter's 4 orientations -- one shared geometry, rotated per instance
// (see rhombohedra-lattice.js's 4-orientation section).
function rhombohedraInstanceMatrix(cell) {
  const [wx, wy, wz] = rhombohedraPieceWorld([cell.x, cell.y, cell.z], RHOMBOHEDRA_S);
  const r = rhombohedraOrientationMatrix(cell.o ?? 0);
  return new THREE.Matrix4().set(r[0][0], r[0][1], r[0][2], wx, r[1][0], r[1][1], r[1][2], wy, r[2][0], r[2][1], r[2][2], wz, 0, 0, 0, 1);
}
function rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld) {
  rhombohedraCellOrder = rhombohedraWorld.entries();
  const m = new THREE.Matrix4();
  rhombohedraCellOrder.forEach((cell, i) => {
    m.copy(rhombohedraInstanceMatrix(cell));
    rhombohedraMesh.setMatrixAt(i, m);
    rhombohedraMesh.setColorAt(i, instanceColorFor(cell, 'rhombohedra'));
  });
  rhombohedraMesh.count = rhombohedraCellOrder.length;
  rhombohedraMesh.instanceMatrix.needsUpdate = true;
  if (rhombohedraMesh.instanceColor) rhombohedraMesh.instanceColor.needsUpdate = true;
  rhombohedraMesh.computeBoundingSphere();
}

// Pyrochlore (3D Kagome): placed truncated tetrahedra, plus every
// tetrahedron capping any of them (derived, same rule as 2D Kagome's
// triangles -- see pyrochloreCapTets), tinted a lighter shade of the
// owning TT's own color.
function rebuildPyrochloreInstances(ttMeshes, tetMeshes, pyrochloreWorld) {
  const cells = pyrochloreWorld.entries().filter((c) => pyrochloreSiteOrientation(c.x, c.y, c.z) !== 0);
  const m = new THREE.Matrix4();
  [1, -1].forEach((orientation, idx) => {
    const order = cells.filter((c) => pyrochloreSiteOrientation(c.x, c.y, c.z) === orientation);
    pyrochloreCellOrders[idx] = order;
    const ttMesh = ttMeshes[idx];
    order.forEach((cell, i) => {
      const [wx, wy, wz] = pyrochloreCellToWorld(cell.x, cell.y, cell.z, PYROCHLORE_S);
      m.makeTranslation(wx, wy, wz);
      ttMesh.setMatrixAt(i, m);
      ttMesh.setColorAt(i, instanceColorFor(cell, 'pyrochlore'));
    });
    ttMesh.count = order.length;
    ttMesh.instanceMatrix.needsUpdate = true;
    if (ttMesh.instanceColor) ttMesh.instanceColor.needsUpdate = true;
    ttMesh.computeBoundingSphere();
  });
  // Derived caps, minus Small-tet removals, plus Small-tet additions --
  // see pyrochloreVisibleTets.
  const tets = pyrochloreVisibleTets(pyrochloreWorld.entries());
  ['up', 'down'].forEach((kind, idx) => {
    const tetMesh = tetMeshes[idx];
    const list = tets[kind];
    list.forEach(({ center, cell }, i) => {
      const [wx, wy, wz] = pyrochloreCellToWorld(center[0], center[1], center[2], PYROCHLORE_S);
      m.makeTranslation(wx, wy, wz);
      tetMesh.setMatrixAt(i, m);
      tetMesh.setColorAt(i, instanceColorFor(cell, 'pyrochlore').clone().lerp(KAGOME_TRIANGLE_LIGHTEN_TO, KAGOME_TRIANGLE_LIGHTEN));
    });
    pyrochloreTetInstances.set(tetMesh, list.map(({ center, cell }) => ({ kind, center, cell })));
    tetMesh.count = list.length;
    tetMesh.instanceMatrix.needsUpdate = true;
    if (tetMesh.instanceColor) tetMesh.instanceColor.needsUpdate = true;
    tetMesh.computeBoundingSphere();
  });
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
    cuboctaMesh.setColorAt(i, instanceColorFor(cell, 'cubocta'));
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
    octGapMesh.setColorAt(i, instanceColorFor(cell, 'octahedron'));
  });
  octGapMesh.count = octGapCellOrder.length;
  octGapMesh.instanceMatrix.needsUpdate = true;
  if (octGapMesh.instanceColor) octGapMesh.instanceColor.needsUpdate = true;
  octGapMesh.computeBoundingSphere();
}

async function init() {
  // Lattice View state, declared first: dimension switches (which can
  // run early in startup) rebuild it.
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
  wireFirstUseHint('duality-toggle', 'Duality: shows this structure\'s aperiodic shadow -- the tiling it casts, not the block shape itself.');
  wireFirstUseHint('spherical-toggle', 'Spherical: renders shapes in a simplified near-spherical form -- a client-side view only, your cells are untouched.');
  wireFirstUseHint('bcc-toggle', 'Lattice View: click to cycle a preview lens through every Piece type -- RD, Cube, Pyramid (shown on your real World), then Cuboctahedron and Octahedron, then BCC/TO, Flattened Octahedron, and Disphenoid (a hypothetical patch near you), then Off.');
  wireFirstUseHint('clear-world-toggle', 'Clear World: erase everything in every dimension and start fresh (Undo can bring it back).');
  wireFirstUseHint('reload-toggle', 'Reload: hard-refresh the app if anything looks stuck or stale.');
  wireFirstUseHint('xray-toggle', 'X-Ray: drag a cutaway plane through the structure to see inside it.');
  wireFirstUseHint('lab-toggle', 'Settings: camera, graphics, sound, language, colors, and Export / Import World.');
  wireFirstUseHint('hud-wheel-cue', 'Tab / Space (or tap Menu) opens the menu wheel.');
  // The quick-select row starts just right of the Menu box, whose width
  // changes with the language.
  const menuCueEl = document.getElementById('hud-wheel-cue');
  if (menuCueEl && 'ResizeObserver' in window) {
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--quick-x', `${Math.round(menuCueEl.getBoundingClientRect().right + 8)}px`);
    }).observe(menuCueEl);
  }
  wireFirstUseHint('export-json', 'Export World saves every dimension to one file -- Import World opens it again.');

  // The saved World (this browser), or the empty starter on a first visit.
  const savedJSON = loadFromLocalStorage();
  const world = createWorldStore(savedJSON ?? await loadWorld('./data/starter-world.json'));
  // Declared early: read by handlers set up before its first use.
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

  // Phase 6, direct correction ("the toggle should work for groups of
  // cells... it reverts to one when shifting... I have loaded four
  // cells on each toggle... that makes it seem like it is working... it
  // just needs to be able to do for real"): a real, fundamental design
  // mistake, not a bug in the previous sense -- one store PER (angle,
  // primitive) COMBINATION meant toggling the angle silently switched
  // to a DIFFERENT, independent store rather than re-rendering the SAME
  // built structure at the new angle. Manually building an identical-
  // looking cluster under every angle only ever LOOKED like one
  // structure transforming; it was 12 unrelated ones. Fixed by keying
  // the real store by PRIMITIVE ALONE (3 stores, not 12) -- which cells
  // are filled is angle-independent data (an (i,j[,orientation]) index,
  // not a world position); the angle toggle now only changes the BASIS
  // that same stored index set is rendered through (see
  // rebuildLattice2dInstances' own header below), so switching angle
  // genuinely reshapes the real, already-built structure in place.
  // Switching PRIMITIVE still switches to a different store -- a
  // parallelogram cell and a hexagon cell are genuinely different
  // topology (4 vs 6 neighbors), not just a different rendering of the
  // same index.
  // Kagome tiles added before 2026-09-25 were saved with z missing
  // ("1,0,undefined") -- see kagomeNeighborOffsets. Rename those keys to
  // z 0 on load so the tiles become removable again.
  function repairLattice2dKeys(json) {
    if (!json?.cells) return json;
    const cells = {};
    for (const [key, value] of Object.entries(json.cells)) {
      const [x, y, z] = key.split(',');
      cells[z === undefined || z === 'undefined' || z === 'NaN' || z === 'null' ? `${x},${y},0` : key] = value;
    }
    return { ...json, cells };
  }
  function lattice2dSeedCell() {
    return [0, 0];
  }

  // 2D lattice tier: one store PER PRIMITIVE (not per angle x
  // primitive) -- same "seed here, not just in the change handler"
  // reasoning as hexPrismWorld above.
  const lattice2dWorlds = new Map(); // primitiveId -> world store
  LATTICE_PRIMITIVES.forEach((primitive) => {
    const savedJSON = repairLattice2dKeys(loadFromLocalStorage(lattice2dStorageKey(primitive.id)));
    // No seed tile (2026-09-25, direct request): an empty 2D world shows
    // the cyan first-placement outline instead, same as 3D and 4D -- see
    // firstPlacementSpec.
    const world = createWorldStore(savedJSON ?? { worldName: `2D Lattice (${primitive.label})`, version: 1, cells: {}, meta: {} });
    lattice2dWorlds.set(primitive.id, world);
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
  // Legacy saves (translation-only lattice: cell = (i,j,k) index, no
  // `o`) -> the 4-orientation centroid frame, same world positions.
  // Batched (all removes before any add) so a converted key can never
  // collide with a not-yet-converted legacy index.
  const rhombohedraLegacy = rhombohedraWorld.entries().filter((c) => c.o === undefined);
  rhombohedraLegacy.forEach(({ x, y, z }) => rhombohedraWorld.removeCell(x, y, z));
  rhombohedraLegacy.forEach(({ x, y, z, ...data }) => rhombohedraWorld.addCell(...rhombohedraMigrateLegacyCell(x, y, z), { ...data, o: 0 }));
  const pyrochloreSavedJSON = loadFromLocalStorage(PYROCHLORE_STORAGE_KEY);
  const pyrochloreWorld = createWorldStore(pyrochloreSavedJSON ?? { worldName: 'Pyrochlore Lattice', version: 1, cells: {}, meta: {} });

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
  // no-ops (the DOM leaves the select's value unchanged). Fixed by
  // injecting a real <option> per LATTICE_PRIMITIVES entry here, once,
  // before anything below ever tries to set one as the select's value
  // -- generated, not hand-listed in index.html, so this can't drift
  // out of sync with the registry again. Phase 6: one per PRIMITIVE
  // now (3, not 12) -- angle is no longer part of the piece-type value
  // at all, see lattice2dSeedCell's own header above.
  const pieceTypeSelect = document.getElementById('piece-type-select');
  for (const primitive of LATTICE_PRIMITIVES) {
    pieceTypeSelect.add(new Option(primitive.label, `lattice2d:${primitive.id}`));
  }

  // 2D Lattice Build: one InstancedMesh PER PRIMITIVE (not per angle x
  // primitive). Its geometry is rebuilt (not just its instances
  // repositioned) whenever the active angle toggle changes -- see
  // rebuildLattice2dInstances' own header below -- since a primitive's
  // own tile shape is a genuine function of angle.
  const lattice2dMeshes = new Map(); // primitiveId -> InstancedMesh
  // Kagome-only: its 2 companion (render-only, not clickable) meshes --
  // see rebuildLattice2dInstances' own header for why they're rebuilt in
  // lockstep with the primary mesh rather than owning a separate world.
  const lattice2dCompanionMeshes = new Map(); // primitiveId -> InstancedMesh[]
  // Kite-only: its up-to-`impl.maxClasses` CLICKABLE class meshes (unlike
  // companions above, every one of these is a real raycast target -- see
  // rebuildLattice2dInstances' own header). Index 0 is always the SAME
  // object as lattice2dMeshes.get(primitiveId), so every generic piece of
  // plumbing that already iterates lattice2dMeshes (visibility, clipping
  // planes, world-view materials) keeps working unchanged; indices 1+ are
  // the real extra meshes. Pre-created once at the primitive's own
  // maxClasses size regardless of the CURRENT angle, so toggling the
  // angle live never needs to create/destroy meshes, only resize how many
  // are actually populated (see rebuildLattice2dInstances).
  const lattice2dClassMeshes = new Map(); // primitiveId -> InstancedMesh[]
  LATTICE_PRIMITIVES.forEach((primitive) => {
    const impl = LATTICE_PRIMITIVE_IMPLS[primitive.id];
    const geometry = new ConvexGeometry(impl.tileVerts(START_LATTICE_ANGLE.angleDeg, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    geometry.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geometry, material.clone(), MAX_CELLS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    lattice2dMeshes.set(primitive.id, mesh);
    if (impl.companions) {
      lattice2dCompanionMeshes.set(primitive.id, impl.companions.map((companion) => {
        const companionGeometry = new ConvexGeometry(companion.tileVerts(START_LATTICE_ANGLE.angleDeg, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        companionGeometry.computeVertexNormals();
        // 3x: each hexagon touches 3 up + 3 down triangles, so up to 3
        // of each per placed cell (see kagomeStarTriangles).
        const companionMesh = new THREE.InstancedMesh(companionGeometry, material.clone(), 3 * MAX_CELLS);
        companionMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(companionMesh);
        return companionMesh;
      }));
    }
    if (impl.classCount) {
      const classMeshes = [mesh];
      for (let c = 1; c < impl.maxClasses; c++) {
        const classGeometry = new ConvexGeometry(impl.classTileVerts(START_LATTICE_ANGLE.angleDeg, c, LATTICE2D_S, LATTICE2D_H).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        classGeometry.computeVertexNormals();
        const classMesh = new THREE.InstancedMesh(classGeometry, material.clone(), MAX_CELLS);
        classMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(classMesh);
        classMeshes.push(classMesh);
      }
      lattice2dClassMeshes.set(primitive.id, classMeshes);
    }
    rebuildLattice2dInstances(mesh, lattice2dWorlds.get(primitive.id), primitive.id, START_LATTICE_ANGLE.angleDeg, 'translation', lattice2dCompanionMeshes.get(primitive.id), lattice2dClassMeshes.get(primitive.id));
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
  // Direct correction, Phase 5 ("should be about a hundred dots per
  // square," "not 1 or 4"): dots were one-per-real-lattice-point before
  // -- exactly 4 per square (its own corners), 3 per triangle, 1 per
  // hexagon (its own center) -- real lattice points, correctly unified
  // with the real tile's own basis/angle, but nowhere near "a hundred."
  // Rather than decoupling dots from the real lattice (which would undo
  // that unification -- see dimensionAllowsMesh's own Phase 5 comment),
  // this SUBDIVIDES each real cell into a finer DOT_SUBDIVISIONS x
  // DOT_SUBDIVISIONS decorative grid, still built from the exact same
  // angle/basis (latticeBasis), just at 1/DOT_SUBDIVISIONS the spacing
  // -- so it still visibly skews/transforms together with the real
  // lattice on every angle toggle, just densely enough that one real
  // square now shows DOT_SUBDIVISIONS^2 = 100 dots across its own area,
  // not only its 4 corners. DOT_MATRIX_CELL_RADIUS (how many REAL cells
  // outward this covers) raised 3 -> 10, direct follow-up ("still far
  // too few dots to cover reasonable portion of screen when zooming
  // out") -- 3 was sized only for the default un-zoomed camera
  // distance. (21*DOT_SUBDIVISIONS+1)^2 total instances at radius 10 is
  // still comfortably within InstancedMesh's own practical range for
  // this simple an unlit sphere, but if a future iPad performance
  // report ever comes in, THIS is the number to trade off first.
  const DOT_SUBDIVISIONS = 10;
  const DOT_MATRIX_CELL_RADIUS = 10;
  const DOT_MATRIX_RADIUS = DOT_SUBDIVISIONS * DOT_MATRIX_CELL_RADIUS;
  const dotMatrixGeometry = new THREE.SphereGeometry(0.06 * LATTICE2D_S / DOT_SUBDIVISIONS, 8, 6);
  // Signature blue (#9de0ff), same accent color as everything else in
  // this app's own HUD chrome -- fully opaque (not the original 0.85)
  // for max contrast against the scene's own dark starfield background,
  // direct instruction ("contrast against star background"). Real
  // depth testing (NOT depthTest:false, its own original value) --
  // direct correction, "place tile in front of dots for visibility":
  // depthTest:false forced dots to draw over EVERYTHING regardless of
  // actual position, which is exactly why they sat on top of (and
  // cluttered) the real tile once there were ~100 of them per square.
  // Real depth testing plus dots positioned BEHIND the tile's own back
  // face (see updateDotMatrix's own z below) lets the opaque tile
  // correctly occlude the dots underneath it, while dots elsewhere
  // (nothing in front of them) still render normally.
  const dotMatrixMaterial = new THREE.MeshBasicMaterial({ color: 0x9de0ff });
  const dotMatrixCount = (2 * DOT_MATRIX_RADIUS + 1) ** 2;
  const dotMatrixMesh = new THREE.InstancedMesh(dotMatrixGeometry, dotMatrixMaterial, dotMatrixCount);
  // renderOrder no longer needed for draw-order purposes now that real
  // depth testing (not depthTest:false) handles tile-occludes-dots
  // correctly on its own -- left at the default.
  dotMatrixMesh.visible = false;
  scene.add(dotMatrixMesh);

  function updateDotMatrix(angleDeg) {
    const [v0, v1] = latticeBasis(angleDeg, LATTICE2D_S / DOT_SUBDIVISIONS);
    const m = new THREE.Matrix4();
    let idx = 0;
    for (let i = -DOT_MATRIX_RADIUS; i <= DOT_MATRIX_RADIUS; i++) {
      for (let j = -DOT_MATRIX_RADIUS; j <= DOT_MATRIX_RADIUS; j++) {
        const x = i * v0[0] + j * v1[0];
        const y = i * v0[1] + j * v1[1];
        // Behind the tile's own back face (LATTICE2D_H's real extent is
        // roughly +-0.015 regardless of LATTICE2D_S), not in front of it
        // at 0.12 like before -- see dotMatrixMaterial's own comment
        // above for why this, paired with real depth testing, is what
        // actually lets the tile occlude the dots under it now.
        m.makeTranslation(x, y, -0.05);
        dotMatrixMesh.setMatrixAt(idx++, m);
      }
    }
    dotMatrixMesh.count = idx;
    dotMatrixMesh.instanceMatrix.needsUpdate = true;
    dotMatrixMesh.computeBoundingSphere();
  }
  updateDotMatrix(START_LATTICE_ANGLE.angleDeg);

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
  let activeLattice2dAngleId = START_LATTICE_ANGLE.id;
  let activeLattice2dPrimitiveId = LATTICE_PRIMITIVES[0].id;
  // Rhombille (Part D): a second, contextual placement pattern for the
  // SAME 'parallelogram' primitive/world, offered only at the Triangular
  // angle -- see RHOMBILLE_ARRANGEMENT_IMPL's own header. Not a
  // LATTICE_PRIMITIVES entry, so it needs its own toggle state rather
  // than reusing activeLattice2dPrimitiveId.
  let activeLattice2dArrangementId = 'translation';
  // Whether the Rhombille row itself should be showing right now -- the
  // panel uses this to render/hide that 3rd row, and the angle/primitive
  // click handlers use it to reset activeLattice2dArrangementId back to
  // 'translation' the moment it stops applying (see renderLattice2dPanel),
  // which is what lets resolveLattice2dImpl above trust `arrangementId`
  // alone without re-checking the angle itself on every call.
  function rhombilleArrangementApplicable() {
    return activeLattice2dPrimitiveId === 'parallelogram' && activeLattice2dAngleId === RHOMBILLE_ANGLE_ID;
  }
  const lattice2dPanel = document.createElement('div');
  lattice2dPanel.id = 'lattice2d-toggle-panel';
  document.body.appendChild(lattice2dPanel);

  // Rhombohedra attach toggle (direct request 2026-09-24, replacing a
  // "tap the same spot again to cycle" that could miss and place a
  // second piece instead): every rhombohedron face offers exactly 2
  // pieces -- a same-orientation Copy, or the Mirror image across that
  // face (verified exactly, all 4 orientations x 12 face directions).
  // Taps place whichever this toggle selects -- a bottom-row quick
  // button, shown only while Rhombohedra is the 3D piece.
  const RHOMBO_ATTACH_KEY = 'rhombiverse-rhombo-attach-mode';
  let rhomboAttachMode = 'copy';
  try { if (localStorage.getItem(RHOMBO_ATTACH_KEY) === 'mirror') rhomboAttachMode = 'mirror'; } catch { /* best-effort */ }
  // Pyrochlore's own mode in the SAME bottom-row slot (direct request,
  // 2026-09-24): 'whole' = place/remove whole truncated tetrahedra (small
  // tets derived), 'small' = add/remove individual small tetrahedra --
  // see pyrochlore-lattice.js's own Small-tet section.
  const PYRO_ATTACH_KEY = 'rhombiverse-pyrochlore-attach-mode';
  let pyroAttachMode = 'whole';
  try { if (localStorage.getItem(PYRO_ATTACH_KEY) === 'small') pyroAttachMode = 'small'; } catch { /* best-effort */ }
  // Written as a general "attach variant" slot (direct note: "it could
  // be used for other pieces with similar issues in future") -- any
  // piece whose face attach has more than one valid result can reuse
  // this button: extend updateRhomboAttachPanel's piece check and read
  // rhomboAttachMode from that piece's own click handler.
  // Bottom-row quick button (#hud-quick-attach, next to Shape/Color/
  // Lattice View): tap switches Copy <-> Mirror. Icon: two rhombi side
  // by side, parallel (Copy) or reflected about the center line (Mirror).
  const rhomboAttachBtn = document.getElementById('hud-quick-attach');
  const RHOMBO_ATTACH_ICONS = {
    copy: '<svg viewBox="-30 -30 60 60"><g fill="none" stroke="currentColor" stroke-width="3"><polygon points="-26,14 -18,-14 -2,-14 -10,14"/><polygon points="2,14 10,-14 26,-14 18,14"/></g></svg>',
    mirror: '<svg viewBox="-30 -30 60 60"><g fill="none" stroke="currentColor" stroke-width="3"><polygon points="-26,14 -18,-14 -2,-14 -10,14"/><polygon points="26,14 18,-14 2,-14 10,14"/></g><line x1="0" y1="-22" x2="0" y2="22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/></svg>',
  };
  const PYRO_ATTACH_ICONS = {
    whole: '<svg viewBox="-30 -30 60 60"><polygon points="0,-24 20.78,12 -20.78,12" fill="none" stroke="currentColor" stroke-width="3"/><polygon points="-6.93,-12 6.93,-12 13.86,0 6.93,12 -6.93,12 -13.86,0" fill="currentColor" opacity="0.35"/></svg>',
    small: '<svg viewBox="-30 -30 60 60"><polygon points="-8,-4 4,-4 -2,8" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="2.5"/><polygon points="4,-4 16,-4 10,-16" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
  };
  const attachPiece = () => document.getElementById('piece-type-select')?.value;
  // D4's Whole 24-cell / 16-cell toggle (direct decision) -- the same
  // bottom-row slot: tap swaps which D4 cell you place.
  // Hyper-pyrochlore's three-way toggle (direct decision): Truncated ->
  // Bitruncated -> 5-cell, the same slot again.
  const A4_CYCLE = ['a4trunc', 'a4bitrunc', 'a4cell5'];
  // handleWheelAction lives inside a later block; bound here once it
  // exists (same late-binding pattern as isRhombicWheel3DOpen) -- a real
  // bug otherwise: the 4D toggles below threw ReferenceError on tap.
  let selectPieceAction = null;
  const A4_ATTACH_LABELS = { a4trunc: 'Truncated', a4bitrunc: 'Bitruncated', a4cell5: '5-cell' };
  const D4_ATTACH_ICONS = {
    cell24: '<svg viewBox="-30 -30 60 60"><polygon points="0,-24 20.78,-12 20.78,12 0,24 -20.78,12 -20.78,-12" fill="none" stroke="currentColor" stroke-width="3"/><polygon points="0,-12 10.39,6 -10.39,6" fill="currentColor" opacity="0.35"/></svg>',
    cell16: '<svg viewBox="-30 -30 60 60"><polygon points="0,-24 24,0 0,24 -24,0" fill="none" stroke="currentColor" stroke-width="3"/><path d="M0,-24 V24 M-24,0 H24" stroke="currentColor" stroke-width="1.5" opacity="0.6"/></svg>',
  };
  // 2D Paint (2026-09-26): the same slot, shown in 2D. While on, a tap
  // on a placed tile gives it the picked colour instead of adding one;
  // it turns Pick on, since only Pick shows each tile's own colour.
  let paint2d = false;
  function setPaint2d(on) {
    paint2d = on;
    rhomboAttachBtn?.classList.toggle('active', on);
    renderRhomboAttachButton();
  }
  const PAINT_ICON = '<svg viewBox="-30 -30 60 60"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M-4,4 L16,-16 a5,5 0 0 1 7,7 L3,11 Z"/><path d="M-4,4 C-12,4 -14,10 -14,14 C-14,20 -20,22 -24,22 C-16,26 -2,24 3,11"/></g></svg>';
  function renderRhomboAttachButton() {
    if (!rhomboAttachBtn) return;
    if (activeDimension === '2D') {
      rhomboAttachBtn.innerHTML = PAINT_ICON;
      rhomboAttachBtn.title = `Paint: ${paint2d ? 'on' : 'off'} (tap to switch)`;
      return;
    }
    if (A4_CYCLE.includes(attachPiece())) {
      rhomboAttachBtn.innerHTML = `<svg viewBox="-30 -30 60 60">${MARKS[{ a4trunc: 'pieceTrunc5Cell', a4bitrunc: 'pieceBitrunc5Cell', a4cell5: 'piece5Cell' }[attachPiece()]]}</svg>`;
      rhomboAttachBtn.title = `Hyper-pyrochlore: ${A4_ATTACH_LABELS[attachPiece()]} (tap to switch)`;
      return;
    }
    if (attachPiece() === 'cell24' || attachPiece() === 'cell16') {
      rhomboAttachBtn.innerHTML = D4_ATTACH_ICONS[attachPiece()];
      rhomboAttachBtn.title = `D4: ${attachPiece() === 'cell16' ? '16-cell' : 'Whole 24-cell'} (tap to switch)`;
      return;
    }
    if (attachPiece() === 'pyrochlore') {
      rhomboAttachBtn.innerHTML = PYRO_ATTACH_ICONS[pyroAttachMode];
      rhomboAttachBtn.title = `Pyrochlore: ${pyroAttachMode === 'small' ? 'Small tet' : 'Whole tet'} (tap to switch)`;
      return;
    }
    rhomboAttachBtn.innerHTML = RHOMBO_ATTACH_ICONS[rhomboAttachMode];
    rhomboAttachBtn.title = `Rhombohedra attach: ${rhomboAttachMode === 'mirror' ? 'Mirror' : 'Copy'} (tap to switch)`;
  }
  rhomboAttachBtn?.addEventListener('click', () => {
    if (activeDimension === '2D') {
      setPaint2d(!paint2d);
      if (paint2d && colorView.mode !== 'pick') setColorMode('pick');
      showHudPrompt(paint2d ? 'Paint: tap a tile to give it the picked colour.' : 'Paint off: taps add tiles again.', 3000);
      return;
    }
    if (attachPiece() === 'cell24' || attachPiece() === 'cell16') {
      selectPieceAction?.(`tool:pieceType:${attachPiece() === 'cell24' ? 'cell16' : 'cell24'}`);
      return;
    }
    if (A4_CYCLE.includes(attachPiece())) {
      const next = A4_CYCLE[(A4_CYCLE.indexOf(attachPiece()) + 1) % A4_CYCLE.length];
      selectPieceAction?.(`tool:pieceType:${next}`);
      showHudPrompt({ a4trunc: 'Truncated: tap a big face to add the next one straight through the gap -- the 5-cells come with them.', a4bitrunc: 'Bitruncated: tap a truncated 5-cell\u2019s big face to fill the gap there.', a4cell5: '5-cell: tap near a 5-cell\u2019s corner to add the one sharing it; long-press any 5-cell to remove just that one.' }[next], 4500);
      return;
    }
    if (attachPiece() === 'pyrochlore') {
      pyroAttachMode = pyroAttachMode === 'small' ? 'whole' : 'small';
      try { localStorage.setItem(PYRO_ATTACH_KEY, pyroAttachMode); } catch { /* best-effort */ }
      renderRhomboAttachButton();
      updateFirstPlacementTarget();
      showHudPrompt(pyroAttachMode === 'small' ? 'Small tet: tap near a small tetrahedron’s corner to add the one sharing it; long-press any small tetrahedron to remove just that one.' : 'Whole tet: tap to add truncated tetrahedra (their small tetrahedra come with them); long-press one to remove it.', 4500);
      return;
    }
    rhomboAttachMode = rhomboAttachMode === 'mirror' ? 'copy' : 'mirror';
    try { localStorage.setItem(RHOMBO_ATTACH_KEY, rhomboAttachMode); } catch { /* best-effort */ }
    renderRhomboAttachButton();
    if (latticeQuickViewMode === 'rhombohedra') rebuildLatticeQuickView();
    showHudPrompt(rhomboAttachMode === 'mirror' ? 'Attach: Mirror -- taps place the mirror image across the tapped face.' : 'Attach: Copy -- taps place a same-orientation copy across the tapped face.', 3000);
  });
  renderRhomboAttachButton();
  function updateRhomboAttachPanel() {
    const attachable = activeDimension === '4D' ? ['cell24', 'cell16', ...A4_CYCLE] : activeDimension !== '2D' && !isOwnWorldDimension() ? ['rhombohedra', 'pyrochlore'] : [];
    const show2dPaint = activeDimension === '2D';
    if (!show2dPaint && paint2d) setPaint2d(false);
    rhomboAttachBtn?.classList.toggle('hidden', !show2dPaint && !attachable.includes(attachPiece()));
    renderRhomboAttachButton();
  }

  // Rhombille is the one primitive genuinely locked to a single named
  // angle (Triangular -- see RHOMBILLE_ANGLE_ID's own header for the
  // real geometric reason). Kite and Kagome both used to be restricted
  // too, before their own rendering fixes covered the rest -- see
  // lattice-2d.js's own KITE/KAGOME comments for that history. Rather
  // than special-case a primitive by name here, this reads the SAME
  // `impl.validAngleIds`
  // field lattice-2d.js's dispatch table already carries, so any
  // angle-restricted primitive gates the same way with no new code here.
  function angleAllowedForPrimitive(primitiveId, angleId) {
    const validAngleIds = LATTICE_PRIMITIVE_IMPLS[primitiveId].validAngleIds;
    return !validAngleIds || validAngleIds.includes(angleId);
  }
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
      if (!angleAllowedForPrimitive(activeLattice2dPrimitiveId, angle.id)) {
        btn.disabled = true;
        btn.title = `${angle.label} — not available for the current shape`;
      } else {
        btn.addEventListener('click', () => {
          if (angle.id === activeLattice2dAngleId) return;
          activeLattice2dAngleId = angle.id;
          // Rhombille row may just have gone (in)applicable -- reset so
          // resolveLattice2dImpl never trusts a stale 'rotational' state
          // (see rhombilleArrangementApplicable's own header).
          if (!rhombilleArrangementApplicable()) activeLattice2dArrangementId = 'translation';
          renderLattice2dPanel();
          applyLattice2dSelection();
        });
      }
      angleRow.appendChild(btn);
    }
    const primRow = document.createElement('div');
    primRow.className = 'lattice2d-toggle-row';
    for (const primitive of LATTICE_PRIMITIVES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = primitive.label;
      if (primitive.id === activeLattice2dPrimitiveId) btn.classList.add('active');
      if (!angleAllowedForPrimitive(primitive.id, activeLattice2dAngleId)) {
        btn.disabled = true;
        const validLabels = LATTICE_PRIMITIVE_IMPLS[primitive.id].validAngleIds.map((id) => NAMED_LATTICE_ANGLES.find((a) => a.id === id).label);
        btn.title = `${primitive.label} needs a different angle — try ${validLabels.join(' or ')}`;
      } else {
        btn.addEventListener('click', () => {
          if (primitive.id === activeLattice2dPrimitiveId) return;
          activeLattice2dPrimitiveId = primitive.id;
          if (!rhombilleArrangementApplicable()) activeLattice2dArrangementId = 'translation';
          renderLattice2dPanel();
          applyLattice2dSelection();
        });
      }
      primRow.appendChild(btn);
    }
    lattice2dPanel.append(angleRow, primRow);
    // Rhombille (Part D): a 3rd row, shown only when the current
    // (primitive, angle) is exactly (Parallelogram, Triangular) -- the
    // one combo where 3 rotated copies of the rhombus close up without
    // gaps (see RHOMBILLE_ARRANGEMENT_IMPL's own header). Every other
    // combo has exactly one valid arrangement already, so no row shows
    // for them -- same "don't show a choice that doesn't exist" principle
    // the angle/primitive disabling above already follows.
    if (rhombilleArrangementApplicable()) {
      const arrangementRow = document.createElement('div');
      arrangementRow.className = 'lattice2d-toggle-row';
      const arrangements = [
        { id: 'translation', label: 'Translation' },
        { id: 'rotational', label: 'Rotational (Rhombille)' },
      ];
      for (const arrangement of arrangements) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = arrangement.label;
        if (arrangement.id === activeLattice2dArrangementId) btn.classList.add('active');
        btn.addEventListener('click', () => {
          if (arrangement.id === activeLattice2dArrangementId) return;
          activeLattice2dArrangementId = arrangement.id;
          renderLattice2dPanel();
          applyLattice2dSelection();
        });
        arrangementRow.appendChild(btn);
      }
      lattice2dPanel.append(arrangementRow);
    }
  }
  // Decorative preview shapes REMOVED, 2026-09-23 (a real design
  // mistake, not a tuning issue -- see lattice2dSeedCell's own updated
  // comment above for the full incident). They were never wired into
  // build.js's raycast target list (pure decoration, not part of any
  // world store), sat prominently at the dot matrix's own center where
  // a real tile now lives instead, and directly caused "STILL cant
  // generate pieces by tapping": users naturally tapped the big
  // obvious shape, which did nothing, while the actual clickable tile
  // was a small, scattered, easy-to-miss real one elsewhere. The
  // replacement needs no separate preview mechanism at all: with only
  // the ACTIVE combo's real tile visible now (see dimensionAllowsMesh
  // below), sitting at the origin among the SAME dots (identical
  // basis/scale -- see updateDotMatrix), that one real, clickable tile
  // already IS the "shape transforms with the matrix" demonstration --
  // unified, not decorative, per direct correction "dots and shapes
  // arent separate... they are the matrix together."

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
  // Phase 6: re-renders the ACTIVE primitive's own real store at the
  // CURRENT angle on every toggle change (either axis) -- this is what
  // makes an already-built structure genuinely reshape in place when
  // the angle toggles, not just what gets placed going forward. See
  // rebuildLattice2dInstances' own header and lattice2dSeedCell's above
  // for the full incident this replaces.
  function currentLattice2dAngleDeg() {
    return NAMED_LATTICE_ANGLES.find((a) => a.id === activeLattice2dAngleId).angleDeg;
  }
  function applyLattice2dSelection() {
    const angleDeg = currentLattice2dAngleDeg();
    const primitive = LATTICE_PRIMITIVES.find((p) => p.id === activeLattice2dPrimitiveId);
    updateDotMatrix(angleDeg);
    rebuildLattice2dInstances(lattice2dMeshes.get(primitive.id), lattice2dWorlds.get(primitive.id), primitive.id, angleDeg, activeLattice2dArrangementId, lattice2dCompanionMeshes.get(primitive.id), lattice2dClassMeshes.get(primitive.id));
    updateFirstPlacementTarget(); // the empty-world outline follows the tile/angle/arrangement
    document.getElementById('piece-type-select').value = `lattice2d:${primitive.id}`;
    // Re-derives which single lattice2d mesh dimensionAllowsMesh now
    // permits (the newly active primitive) and hides every other one --
    // see that function's own Phase 5 comment for why only one is ever
    // shown at a time.
    applyDimensionVisibility();
    if (currentMode !== 'build' && currentMode !== 'chisel') {
      document.querySelector('.mode-btn[data-mode="build"]')?.click();
    }
    updateHudIndicator();
    const angleLabel = NAMED_LATTICE_ANGLES.find((a) => a.id === activeLattice2dAngleId).label;
    showHudPrompt(`Piece: ${angleLabel} × ${primitive.label}`, 2000);
  }
  renderLattice2dPanel();

  // Rhombohedra Build (free lattice): its own InstancedMesh, own
  // geometry (rhombohedraTileVerts -- one of RD Quarter's own 4
  // congruent orientations, centered on its own centroid).
  const rhombohedraGeometry = new ConvexGeometry(rhombohedraTileVerts(RHOMBOHEDRA_S).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  rhombohedraGeometry.computeVertexNormals();
  const rhombohedraMesh = new THREE.InstancedMesh(rhombohedraGeometry, material.clone(), MAX_CELLS);
  rhombohedraMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(rhombohedraMesh);
  rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld);

  // Pyrochlore Build (3D Kagome): 2 TT meshes (O-site/T-site, exact
  // inversions) + 2 derived tet meshes (up/down). Tet capacity 4x: each
  // TT caps 4 tets, so scattered TTs need up to 4 tets each.
  const pyrochloreGeometry = (verts) => {
    const g = new ConvexGeometry(verts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    g.computeVertexNormals();
    return g;
  };
  const pyrochloreTTGeometries = [pyrochloreGeometry(truncatedTetrahedronVerts(1, PYROCHLORE_S)), pyrochloreGeometry(truncatedTetrahedronVerts(-1, PYROCHLORE_S))];
  const pyrochloreTetGeometries = [pyrochloreGeometry(tetrahedronVerts('up', PYROCHLORE_S)), pyrochloreGeometry(tetrahedronVerts('down', PYROCHLORE_S))];
  const pyrochloreInstancedMesh = (g, capacity) => {
    const im = new THREE.InstancedMesh(g, material.clone(), capacity);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    return im;
  };
  const pyrochloreTTMeshes = pyrochloreTTGeometries.map((g) => pyrochloreInstancedMesh(g, MAX_CELLS));
  const pyrochloreTetMeshes = pyrochloreTetGeometries.map((g) => pyrochloreInstancedMesh(g, 4 * MAX_CELLS));
  const pyrochloreAllMeshes = [...pyrochloreTTMeshes, ...pyrochloreTetMeshes];
  rebuildPyrochloreInstances(pyrochloreTTMeshes, pyrochloreTetMeshes, pyrochloreWorld);

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

  // Untouched legacy seeds (2026-09-24, direct decision): a world holding
  // ONLY its old auto-seed -- nothing built from it -- is cleared on load
  // so the cyan target shows instead. Anything actually built is kept.
  {
    const onlySeed = (w, spots) => {
      const cells = w.entries();
      return cells.length === 1 && spots.some(([x, y, z]) => cells[0].x === x && cells[0].y === y && cells[0].z === z);
    };
    const clear = (w, key) => { for (const c of w.entries()) w.removeCell(c.x, c.y, c.z); saveToLocalStorage(w.toJSON(), key); };
    if (onlySeed(world, [[0, 0, 0]])) clear(world, undefined);
    if (onlySeed(bccWorld, [[0, 0, 0]])) clear(bccWorld, BCC_STORAGE_KEY);
    if (onlySeed(cuboctaWorld, [[0, 0, 0]])) clear(cuboctaWorld, CUBOCTA_STORAGE_KEY);
    if (onlySeed(hexPrismWorld, [[0, 0, 0]])) clear(hexPrismWorld, HEXPRISM_STORAGE_KEY);
    if (onlySeed(rhombohedraWorld, [RHOMBOHEDRA_LEGACY_SEED])) clear(rhombohedraWorld, RHOMBOHEDRA_STORAGE_KEY);
    if (onlySeed(pyrochloreWorld, PYROCHLORE_LEGACY_SEEDS)) clear(pyrochloreWorld, PYROCHLORE_STORAGE_KEY);
    const inter = interstitialStore.entries();
    if (inter.length === 1 && inter[0].key === disphenoidKey(bootstrapDisphenoid([0, 0, 0]))) {
      interstitialStore.replaceAll({ worldName: 'Interstitial Lattice', version: 1, cells: {} });
      saveToLocalStorage(interstitialStore.toJSON(), INTERSTITIAL_STORAGE_KEY);
    }
    rebuildInstances(mesh, world, false);
    rebuildBCCInstances(bccMesh, bccWorld);
    rebuildCuboctaInstances(cuboctaMesh, cuboctaWorld);
    rebuildHexPrismInstances(hexPrismMesh, hexPrismWorld);
    rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld);
    rebuildPyrochloreInstances(pyrochloreTTMeshes, pyrochloreTetMeshes, pyrochloreWorld);
    rebuildInterstitialMeshes(interstitialStore);
  }

  // First-placement target (2026-09-24, direct request: "get rid of
  // physical seeds and just have a target outline in cyan showing where
  // first will place"; "all RD derivatives plant an RD seed first"):
  // while the SELECTED piece's own world is empty, one cyan outline shows
  // where its first piece goes; tapping it places that piece (core/
  // build.js routes a hit on firstPlacementMesh to place()). Only the
  // selected piece's target ever shows, so nothing crowds the origin.
  const RD_FAMILY_PIECES = ['rd', 'cube', 'pyramid', 'halfrd', 'hourglass', 'rdquarter', 'hemi3', 'hemi4', 'hemiTri'];
  function firstPlacementSpec() {
    if (isOwnWorldDimension()) return null; // 4D/6D draw their own cyan target
    if (activeDimension === '2D') {
      // The active tile at cell (0,0,0), drawn exactly as
      // rebuildLattice2dInstances would draw it at the current angle and
      // arrangement (its own class/orientation rules included).
      const primitiveId = activeLattice2dPrimitiveId;
      const w2 = lattice2dWorlds.get(primitiveId);
      if (!w2 || w2.entries().length) return null;
      const impl = resolveLattice2dImpl(primitiveId, activeLattice2dArrangementId);
      const angleDeg = currentLattice2dAngleDeg();
      let verts;
      let rot = 0;
      if (impl.classCount && impl.classCount(angleDeg) > 1) {
        verts = impl.classTileVerts(angleDeg, impl.classOf(0, angleDeg), LATTICE2D_S, LATTICE2D_H);
        rot = impl.classInstanceRotationRad(0, angleDeg);
      } else {
        verts = impl.tileVerts(angleDeg, LATTICE2D_S, LATTICE2D_H);
        if (impl.hasOrientation) rot = impl.instanceRotationRad(angleDeg, 0);
      }
      const [sx, sy] = lattice2dSeedCell();
      const [wx, wy, wz] = impl.cellToWorld(sx, sy, 0, angleDeg, LATTICE2D_S, 0);
      const geom = new ConvexGeometry(verts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      geom.applyMatrix4(new THREE.Matrix4().makeRotationZ(rot).setPosition(wx, wy, wz));
      return { geometry: geom, place: (material) => { w2.addCell(sx, sy, 0, { material }); onLattice2dChange(primitiveId); } };
    }
    const piece = document.getElementById('piece-type-select')?.value;
    if (currentMode === 'cubocta') {
      return cuboctaWorld.entries().length ? null : { geometry: cuboctaGeometry.clone(), place: (material) => { cuboctaWorld.addCell(0, 0, 0, { material }); onCuboctaChange(); } };
    }
    if (RD_FAMILY_PIECES.includes(piece)) {
      return world.entries().length ? null : { geometry: geometry.clone(), place: (material) => { world.addCell(0, 0, 0, { material }); onChange(); } };
    }
    if (piece === 'to') {
      return bccWorld.entries().length ? null : { geometry: bccGeometry.clone(), place: (material) => { bccWorld.addCell(0, 0, 0, { material }); onBCCChange(); } };
    }
    if (piece === 'ioct' || piece === 'idis') {
      const verts = bootstrapDisphenoid([0, 0, 0]);
      return interstitialStore.entries().length ? null : { geometry: buildInterstitialGeometry(verts, SCALE), place: (material) => { interstitialStore.addDisphenoid(verts, { material }); onInterstitialChange(); } };
    }
    if (piece === 'elongdodeca') {
      return elongDodecaWorld.entries().length ? null : { geometry: elongDodecaGeometry.clone().translate(...elongDodecaCellToWorld(0, 0, 0, SCALE)), place: (material) => { elongDodecaWorld.addCell(0, 0, 0, { material }); onElongDodecaChange(); } };
    }
    if (piece === 'hexprism') {
      return hexPrismWorld.entries().length ? null : { geometry: hexPrismGeometry.clone(), place: (material) => { hexPrismWorld.addCell(0, 0, 0, { material }); onHexPrismChange(); } };
    }
    if (piece === 'rhombohedra') {
      const cell = { x: RHOMBOHEDRA_FIRST[0], y: RHOMBOHEDRA_FIRST[1], z: RHOMBOHEDRA_FIRST[2], o: 0 };
      return rhombohedraWorld.entries().length ? null : { geometry: rhombohedraGeometry.clone().applyMatrix4(rhombohedraInstanceMatrix(cell)), place: (material) => { rhombohedraWorld.addCell(...RHOMBOHEDRA_FIRST, { material, o: 0 }); onRhombohedraChange(); } };
    }
    if (piece === 'pyrochlore') {
      // The whole first piece as it will look: TT + its 4 cap tets --
      // together exactly one big tetrahedron, so its hull is the outline.
      const [i, j, k] = PYROCHLORE_FIRST;
      const c = pyrochloreCellToWorld(i, j, k, PYROCHLORE_S);
      const pts = truncatedTetrahedronVerts(1, PYROCHLORE_S).map(([x, y, z]) => [x + c[0], y + c[1], z + c[2]]);
      for (const cap of pyrochloreCapTetsOf(i, j, k)) {
        const cc = pyrochloreCellToWorld(...cap.center, PYROCHLORE_S);
        for (const [x, y, z] of tetrahedronVerts(cap.kind, PYROCHLORE_S)) pts.push([x + cc[0], y + cc[1], z + cc[2]]);
      }
      // Empty = nothing visible (a world holding only Small-tet removal
      // markers shows nothing). Small-tet mode starts with one up-tet at
      // the origin instead of a whole truncated tetrahedron.
      const cellsNow = pyrochloreWorld.entries();
      const empty = !cellsNow.some((cc) => pyrochloreSiteOrientation(cc.x, cc.y, cc.z) !== 0 || cc.tetAdded);
      if (!empty) return null;
      if (pyroAttachMode === 'small') {
        return { geometry: new ConvexGeometry(tetrahedronVerts('up', PYROCHLORE_S).map(([x, y, z]) => new THREE.Vector3(x, y, z))), place: (material) => { pyrochloreWorld.addCell(0, 0, 0, { material, tetAdded: true }); onPyrochloreChange(); } };
      }
      return { geometry: new ConvexGeometry(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))), place: (material) => { pyrochloreWorld.addCell(i, j, k, { material }); onPyrochloreChange(); } };
    }
    return null;
  }
  const FIRST_PLACEMENT_COLOR = 0x00e5ff;
  const firstPlacementMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: FIRST_PLACEMENT_COLOR, transparent: true, opacity: 0.12, depthWrite: false }));
  const firstPlacementEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: FIRST_PLACEMENT_COLOR }));
  firstPlacementMesh.visible = false;
  firstPlacementEdges.visible = false;
  scene.add(firstPlacementMesh, firstPlacementEdges);
  let firstPlacementCurrent = null;
  function updateFirstPlacementTarget() {
    const spec = firstPlacementSpec();
    firstPlacementCurrent = spec;
    firstPlacementMesh.geometry.dispose();
    firstPlacementEdges.geometry.dispose();
    if (!spec) {
      firstPlacementMesh.geometry = new THREE.BufferGeometry();
      firstPlacementEdges.geometry = new THREE.BufferGeometry();
      firstPlacementMesh.visible = false;
      firstPlacementEdges.visible = false;
      return;
    }
    firstPlacementMesh.geometry = spec.geometry;
    firstPlacementEdges.geometry = new THREE.EdgesGeometry(spec.geometry);
    firstPlacementMesh.visible = true;
    firstPlacementEdges.visible = true;
  }

  // Hemisphere pieces (core/hemisphere-build.md): a sixth independent
  // store, own localStorage key, same reasoning as BCC/interstitial/
  // Cuboctahedron/gap-octahedron above. No "never truly empty" bootstrap
  // seed needed (unlike those four) -- Hemi RD/Hourglass both bootstrap
  // fresh off the solid FCC/BCC world's own faces, not off an existing
  // piece of their own kind, so an empty store is a perfectly valid start.
  const hemisphereSavedJSON = loadFromLocalStorage(HEMISPHERE_STORAGE_KEY);
  const hemisphereStore = createHemisphereStore(hemisphereSavedJSON);
  rebuildHemisphereMeshes(hemisphereStore);


  // (Lattice Zoom -- the orange sub-lattice that faded in when the
  // camera got close -- was removed 2026-09-24: a leftover of the retired
  // growth layer that read as seeds growing; see docs/HISTORY-retired-systems.md.)

  rebuildInstances(mesh, world);

  // Undo history (2026-09-25, direct request: "a go back undo button
  // would be universally useful"). Was a main-FCC-world-only stack; now
  // every store records through persist() below, so an undo step covers
  // whatever one action changed, in any store. Steps are tagged with the
  // dimension(s) they touched, and undo only steps back through the
  // CURRENT dimension's own history (2D, 3D and 4D each keep their own).
  // Each store restores through its own change handler (see
  // registerHistoryStores), so every mesh rebuilds exactly as after a
  // normal edit. Clear World / New World are undoable too.
  const MAX_UNDO = 40;
  const historySteps = []; // { dims: Set<'2D'|'3D'|'4D'|'5D'|'6D'>, before: Map<historyKey, jsonString> }
  const historyLastSaved = new Map(); // historyKey -> jsonString, for registered stores only
  const historyRestorers = new Map(); // historyKey -> { dim, restore(json) }
  let historyPending = null;
  let historyRestoring = false;
  const MAIN_HISTORY_KEY = 'main';

  function recordHistory(historyKey, json) {
    const str = JSON.stringify(json);
    const prev = historyLastSaved.get(historyKey);
    historyLastSaved.set(historyKey, str);
    if (historyRestoring || prev === undefined || prev === str) return;
    // Everything one action changes lands in the same task -- group it.
    if (!historyPending) {
      historyPending = { dims: new Set(), before: new Map() };
      queueMicrotask(() => {
        historySteps.push(historyPending);
        historyPending = null;
        if (historySteps.length > MAX_UNDO) historySteps.shift();
        updateUndoButton();
      });
    }
    if (!historyPending.before.has(historyKey)) historyPending.before.set(historyKey, prev);
    historyPending.dims.add(historyRestorers.get(historyKey).dim);
  }

  // Every store's save goes through here instead of saveToLocalStorage
  // directly (key undefined = the main FCC world's own default key).
  function persist(json, storageKey) {
    const historyKey = storageKey ?? MAIN_HISTORY_KEY;
    if (historyRestorers.has(historyKey)) recordHistory(historyKey, json);
    saveToLocalStorage(json, storageKey);
  }

  function currentDimensionSteps() {
    return historySteps.filter((step) => step.dims.has(activeDimension));
  }

  function undoOneStep() {
    let idx = -1;
    for (let k = historySteps.length - 1; k >= 0; k--) if (historySteps[k].dims.has(activeDimension)) { idx = k; break; }
    if (idx < 0) return false;
    const [step] = historySteps.splice(idx, 1);
    historyRestoring = true;
    try {
      for (const [historyKey, str] of step.before) historyRestorers.get(historyKey).restore(JSON.parse(str));
    } finally {
      historyRestoring = false;
    }
    return true;
  }

  function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    if (btn) btn.disabled = currentDimensionSteps().length === 0;
  }

  // Hold the button: a row of ticks, oldest first; tapping one steps
  // back to just before that step.
  function renderUndoScrubStrip() {
    const strip = document.getElementById('undo-scrub-strip');
    strip.innerHTML = '';
    const n = currentDimensionSteps().length;
    if (n === 0) return;
    const label = document.createElement('div');
    label.className = 'scrub-label';
    label.textContent = `${n} step${n === 1 ? '' : 's'} back`;
    strip.appendChild(label);
    for (let i = 0; i < n; i++) {
      const back = n - i;
      const tick = document.createElement('div');
      tick.className = 'scrub-tick';
      tick.title = `Jump back ${back} step${back === 1 ? '' : 's'}`;
      tick.addEventListener('click', () => undoSteps(back));
      strip.appendChild(tick);
    }
  }

  function undoSteps(count) {
    let done = 0;
    while (done < count && undoOneStep()) done++;
    updateUndoButton();
    renderUndoScrubStrip();
    document.getElementById('undo-scrub-strip').classList.remove('visible');
    if (done) showHudPrompt(done === 1 ? 'Undone.' : `Undone ${done} steps.`, 1500);
  }

  // Called once every store exists (right after the 4D world is
  // created). Baselines are each store's state at that moment; a restore
  // replaces the store and runs its own change handler, whose persist()
  // call is ignored by history while historyRestoring is set.
  // Redraws every piece in its current colour (a colour-mode or Type
  // colour change): each store re-renders through its own restore, the
  // same path undo uses. Nothing changes, so no undo step is recorded.
  function repaintAllPieces() {
    for (const { get, restore } of historyRestorers.values()) restore(get());
  }

  function registerHistoryStores() {
    const reg = (historyKey, dim, get, restore) => {
      historyRestorers.set(historyKey, { dim, restore, get });
      historyLastSaved.set(historyKey, JSON.stringify(get()));
    };
    reg(MAIN_HISTORY_KEY, '3D', () => world.toJSON(), (j) => { world.replaceAll(j); onChange(); });
    reg(BCC_STORAGE_KEY, '3D', () => bccWorld.toJSON(), (j) => { bccWorld.replaceAll(j); onBCCChange(); });
    reg(ELONGDODECA_STORAGE_KEY, '3D', () => elongDodecaWorld.toJSON(), (j) => { elongDodecaWorld.replaceAll(j); onElongDodecaChange(); });
    reg(HEXPRISM_STORAGE_KEY, '3D', () => hexPrismWorld.toJSON(), (j) => { hexPrismWorld.replaceAll(j); onHexPrismChange(); });
    reg(PYROCHLORE_STORAGE_KEY, '3D', () => pyrochloreWorld.toJSON(), (j) => { pyrochloreWorld.replaceAll(j); onPyrochloreChange(); });
    reg(RHOMBOHEDRA_STORAGE_KEY, '3D', () => rhombohedraWorld.toJSON(), (j) => { rhombohedraWorld.replaceAll(j); onRhombohedraChange(); });
    reg(INTERSTITIAL_STORAGE_KEY, '3D', () => interstitialStore.toJSON(), (j) => { interstitialStore.replaceAll(j); onInterstitialChange(); });
    reg(HEMISPHERE_STORAGE_KEY, '3D', () => hemisphereStore.toJSON(), (j) => { hemisphereStore.replaceAll(j); onHemisphereChange(); });
    reg(CUBOCTA_STORAGE_KEY, '3D', () => cuboctaWorld.toJSON(), (j) => { cuboctaWorld.replaceAll(j); onCuboctaChange(); });
    reg(CUBOCTA_GAP_STORAGE_KEY, '3D', () => octGapWorld.toJSON(), (j) => { octGapWorld.replaceAll(j); onOctGapChange(); });
    for (const primitive of LATTICE_PRIMITIVES) {
      const w2 = lattice2dWorlds.get(primitive.id);
      reg(lattice2dStorageKey(primitive.id), '2D', () => w2.toJSON(), (j) => { w2.replaceAll(j); onLattice2dChange(primitive.id); });
    }
    reg('world4d', '4D', () => world4d.snapshot(), (j) => world4d.restore(j));
    for (const [dim, w] of qcWorlds) reg(`world${dim.toLowerCase()}`, dim, () => w.snapshot(), (j) => w.restore(j));
    reg('worldshells', '3D', () => shellsWorld.snapshot(), (j) => shellsWorld.restore(j));
    reg('worldgolden', '3D', () => goldenWorld.snapshot(), (j) => goldenWorld.restore(j));
    reg('worldkaleido', '2D', () => kaleidoWorld.snapshot(), (j) => kaleidoWorld.restore(j));
    updateUndoButton();
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
    // The old "never empty" auto-reseed lived here -- replaced 2026-09-24
    // by the cyan first-placement target (direct request: "get rid of
    // physical seeds and just have a target outline in cyan showing where
    // first will place... getting very crowded with seeds"). An empty
    // world is no longer a dead end: the target is always tappable. See
    // firstPlacementSpec.
    rebuildInstances(mesh, world);
    updateSectionEnabled(); // keeps newly created partial-cell (Pyramid) mesh materials in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning as updateSectionEnabled() above -- see World View's own header
    if (worldViewMode === 'skeleton') rebuildWorldViewSkeleton();
    // Keep an active Lattice Quick-View in sync with your real World --
    // every mode now re-renders your own cells (see
    // rebuildLatticeQuickView's own header), so a build/remove while one
    // is active should update it too.
    if (latticeQuickViewMode !== 'off') rebuildLatticeQuickView();
    persist(world.toJSON());
  }

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
    if (!undoHeld) undoSteps(1);
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
    updateFirstPlacementTarget(); // every lattice's own change handler runs through here -- see firstPlacementSpec
    const enabled = document.getElementById('section-enable').checked;
    const planes = enabled ? [sectionPlane] : [];
    material.clippingPlanes = planes;
    bccMesh.material.clippingPlanes = planes;
    elongDodecaMesh.material.clippingPlanes = planes;
    hexPrismMesh.material.clippingPlanes = planes;
    lattice2dMeshes.forEach((m) => { m.material.clippingPlanes = planes; });
    lattice2dCompanionMeshes.forEach((meshes) => meshes.forEach((m) => { m.material.clippingPlanes = planes; }));
    lattice2dClassMeshes.forEach((meshes) => meshes.forEach((m) => { m.material.clippingPlanes = planes; }));
    rhombohedraMesh.material.clippingPlanes = planes;
    pyrochloreAllMeshes.forEach((m) => { m.material.clippingPlanes = planes; });
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
    const mats = [material, bccMesh.material, elongDodecaMesh.material, hexPrismMesh.material, ...[...lattice2dMeshes.values()].map((m) => m.material), ...[...lattice2dCompanionMeshes.values()].flat().map((m) => m.material), ...[...lattice2dClassMeshes.values()].flat().map((m) => m.material), rhombohedraMesh.material, ...pyrochloreAllMeshes.map((m) => m.material), cuboctaMesh.material, octGapMesh.material];
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
  // 'lattice2d:' keys (one per LATTICE_PRIMITIVES entry) replace the
  // old hand-listed 'square2d'/'hexagon2d'/'triangle2d' trio here -- a
  // namespaced prefix check generalizes to however many
  // combinations lattice-2d.js ever defines, with no new case needed
  // per named angle or primitive added there in the future.
  //
  // Phase 5 correction, 2026-09-23 (a real design mistake, not a
  // tuning issue -- see lattice2dSeedCell's own comment for the full
  // incident): a `lattice2d:<id>` key is now only allowed when it's
  // the CURRENTLY ACTIVE one (matching the toggle panel), not "all of
  // them simultaneously" the way every other coexisting family on this
  // page still is. Direct reports converged on exactly this: tiles
  // scattered around, most of them not the one you can actually click,
  // is clutter that actively hid the real interactive one behind
  // visual noise ("STILL cant generate pieces by tapping"). Phase 6:
  // `<id>` is now a PRIMITIVE id alone (3 possible values), not a
  // (primitive, angle) combo id (12) -- angle no longer selects a
  // different store, only how the active primitive's own store is
  // rendered, so it's no longer part of this key at all.
  function dimensionAllowsMesh(key) {
    // 4D shows only its own world (world-4d.js's own group); every 3D and
    // 2D mesh hides, same "toggle visibility, delete nothing" rule.
    if (isOwnWorldDimension()) return false;
    if (key.startsWith('lattice2d:')) {
      return activeDimension === '2D' && key === `lattice2d:${activeLattice2dPrimitiveId}`;
    }
    // '3D' or not yet chosen (activeDimension === null, e.g. mid-load):
    // default to showing 3D's own coexisting families, same as before
    // this fix existed.
    return activeDimension !== '2D';
  }
  function setSolidWorldVisible(visible) {
    mesh.visible = visible && dimensionAllowsMesh('mesh');
    bccMesh.visible = visible && dimensionAllowsMesh('bcc');
    elongDodecaMesh.visible = visible && dimensionAllowsMesh('elongdodeca');
    hexPrismMesh.visible = visible && dimensionAllowsMesh('hexprism');
    lattice2dMeshes.forEach((m, primitiveId) => { m.visible = visible && dimensionAllowsMesh(`lattice2d:${primitiveId}`); });
    lattice2dCompanionMeshes.forEach((meshes, primitiveId) => { const v = visible && dimensionAllowsMesh(`lattice2d:${primitiveId}`); meshes.forEach((m) => { m.visible = v; }); });
    lattice2dClassMeshes.forEach((meshes, primitiveId) => { const v = visible && dimensionAllowsMesh(`lattice2d:${primitiveId}`); meshes.forEach((m) => { m.visible = v; }); });
    rhombohedraMesh.visible = visible && dimensionAllowsMesh('rhombohedra');
    pyrochloreAllMeshes.forEach((m) => { m.visible = visible && dimensionAllowsMesh('pyrochlore'); });
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
    dotMatrixMesh.visible = visible && activeDimension === '2D' && !own3DActive();
    // Switch the others off first, so the active one's panel stays up.
    for (const [dim, w] of qcWorlds) if (dim !== activeDimension) w.setActive(false);
    world4d?.setActive(activeDimension === '4D');
    qcWorlds.get(activeDimension)?.setActive(true);
    shellsWorld?.setActive(own3DActive() && own3D === 'shells');
    goldenWorld?.setActive(own3DActive() && own3D === 'golden');
    kaleidoWorld?.setActive(own3DActive() && own3D === 'kaleido');
    document.body.classList.toggle('qc-world-on', qcWorlds.has(activeDimension) || own3DActive());
    // 4D/6D: X-Ray and Spherical don't apply (the slider IS the X-Ray),
    // so their HUD faces go blank and untappable (direct decision).
    hudWheel?.setFaceHidden?.('xray-toggle', isOwnWorldDimension());
    hudWheel?.setFaceHidden?.('spherical-toggle', isOwnWorldDimension());
    lattice2dPanel.classList.toggle('visible', activeDimension === '2D' && !own3DActive());
    updateRhomboAttachPanel();
    updateFirstPlacementTarget();
    updateUndoButton(); // each dimension has its own undo history
    // In 2D, shapes are picked by lattice (the toggle panel above), not
    // by this dropdown -- lattice2dPanel already keeps #piece-type-select's
    // own value in sync (see applyLattice2dSelection), so showing this row
    // too would just be a second, redundant way to pick a shape. Real bug,
    // direct report ("shape selecter button still visible and active"):
    // setting the `hidden` PROPERTY alone doesn't work here -- `#controls
    // .row { display: flex }` is an author-origin rule with no !important,
    // which beats the UA stylesheet's own `[hidden] { display: none }`
    // regardless of specificity (author normal always outranks UA normal
    // in the cascade), so the element kept rendering even with
    // `.hidden === true`. Setting the inline style directly sidesteps
    // that -- inline style always wins over any external stylesheet rule
    // short of an author `!important`, which nothing here uses.
    document.getElementById('piece-type-row').style.display = activeDimension === '3D' || activeDimension === null ? '' : 'none';
    // Same real bug, same fix, for the always-on bottom-left quick-select
    // shortcut: its click handler unconditionally calls wheel3D.open('piece')
    // (the 3D Piece wheel) regardless of dimension, and `#hud-quick-shape`
    // has its own `display: flex` rule with the identical override
    // problem. Hiding it in 2D avoids a second broken entry point rather
    // than trying to redirect its click into the lattice panel, which is
    // already fixed-position and always visible in 2D, so there's nothing
    // for a click to usefully "open."
    // 5D/6D: the tiling decides each piece's shape, so this button opens
    // the catalogue instead (updateQuickSelect draws its icon).
    document.getElementById('hud-quick-shape').style.display = activeDimension === '2D' ? 'none' : '';
  }
  // Re-applies the same visibility rule whenever activeDimension itself
  // changes (not just when World View mode changes, which is
  // setSolidWorldVisible's own original trigger) -- reuses that exact
  // function with the CURRENT worldViewMode's own solid-visibility
  // intent (true unless Skeleton mode has already hidden everything),
  // so the two mechanisms never fight each other.
  function applyDimensionVisibility() {
    setSolidWorldVisible(worldViewMode !== 'skeleton');
    // The 3D/2D Lattice View overlay belongs to the dimension it was drawn
    // in: redraw it for the new one (4D/5D/6D clear it and draw their own).
    // Real bug, direct report: "I had the 3D kagome lattice come into 5D".
    if (latticeQuickViewMode !== 'off') rebuildLatticeQuickView();
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
    if (isOwnWorldDimension()) return; // 4D/6D draw their own Skeleton
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
    // View-mode backfill (2026-09-24): ED, Hex Prism, Rhombohedra --
    // same geometry/position recipe as each one's own instance rebuild.
    for (const cell of elongDodecaWorld.entries()) {
      const [wx, wy, wz] = elongDodecaCellToWorld(cell.x, cell.y, cell.z, SCALE);
      pieces.push((sphericalModeActive ? sphericalGeometries.elongDodeca : elongDodecaGeometry).clone().translate(wx, wy, wz));
    }
    for (const cell of hexPrismWorld.entries()) {
      const [wx, wy, wz] = hexCellToWorld(cell.x, cell.y, cell.z, HEX_PRISM_R, HEX_PRISM_H);
      pieces.push((sphericalModeActive ? sphericalGeometries.hexPrism : hexPrismGeometry).clone().translate(wx, wy, wz));
    }
    for (const cell of rhombohedraWorld.entries()) {
      pieces.push((sphericalModeActive ? sphericalGeometries.rhombohedron : rhombohedraGeometry).clone().applyMatrix4(rhombohedraInstanceMatrix(cell)));
    }
    // Pyrochlore (3D Kagome): TTs + their derived cap tets, same
    // geometry/position recipe as rebuildPyrochloreInstances.
    const pyroCells = pyrochloreWorld.entries().filter((c) => pyrochloreSiteOrientation(c.x, c.y, c.z) !== 0);
    for (const cell of pyroCells) {
      const [wx, wy, wz] = pyrochloreCellToWorld(cell.x, cell.y, cell.z, PYROCHLORE_S);
      const g = sphericalModeActive ? sphericalGeometries.truncatedTetrahedron.clone() : pyrochloreTTGeometries[pyrochloreSiteOrientation(cell.x, cell.y, cell.z) === 1 ? 0 : 1].clone();
      pieces.push(g.translate(wx, wy, wz));
    }
    const pyroTets = pyrochloreVisibleTets(pyrochloreWorld.entries());
    ['up', 'down'].forEach((kind, idx) => {
      for (const { center } of pyroTets[kind]) {
        const [wx, wy, wz] = pyrochloreCellToWorld(center[0], center[1], center[2], PYROCHLORE_S);
        const g = sphericalModeActive ? sphericalGeometries.tetrahedron.clone() : pyrochloreTetGeometries[idx].clone();
        pieces.push(g.translate(wx, wy, wz));
      }
    });
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
    world4d?.setSkeleton(worldViewMode === 'skeleton');
    for (const w of qcWorlds.values()) w.setSkeleton(worldViewMode === 'skeleton');
    shellsWorld?.setSkeleton(worldViewMode === 'skeleton');
    goldenWorld?.setSkeleton(worldViewMode === 'skeleton');
    // Translucent too, at the same opacity as the 3D worlds.
    world4d?.setTranslucent(worldViewMode === 'translucent' ? TRANSLUCENT_OPACITY : 1);
    for (const w of qcWorlds.values()) w.setTranslucent(worldViewMode === 'translucent' ? TRANSLUCENT_OPACITY : 1);
    shellsWorld?.setTranslucent(worldViewMode === 'translucent' ? TRANSLUCENT_OPACITY : 1);
    goldenWorld?.setTranslucent(worldViewMode === 'translucent' ? TRANSLUCENT_OPACITY : 1);
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

  // Generalized for angled X-Ray (2026-09-24): the handle's own local Z
  // is turned onto the cut direction (PlaneGeometry faces +Z by default)
  // and the gizmo drags in LOCAL space along that Z only -- works the
  // same for the 3 axes and the 4 body-diagonals.
  function orientXrayHandle(axis) {
    xrayHandle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sectionAxisVector(axis));
    xrayGizmo.setSpace('local');
    xrayGizmo.showX = false;
    xrayGizmo.showY = false;
    xrayGizmo.showZ = true;
  }

  function syncXrayHandleToSectionPlane() {
    if (!xrayHandle.visible) return;
    const axis = document.getElementById('section-axis').value;
    const pos = Number(document.getElementById('section-pos').value) || 0;
    orientXrayHandle(axis);
    xrayHandle.position.copy(sectionAxisVector(axis).multiplyScalar(pos));
  }

  xrayGizmo.addEventListener('change', () => {
    if (!xrayHandle.visible) return;
    const axis = document.getElementById('section-axis').value;
    const flip = document.getElementById('section-flip').checked;
    const axisVec = sectionAxisVector(axis);
    const pos = xrayHandle.position.dot(axisVec);
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

  // Duality Mode
  let dualityModeActive = false;
  let dualityShadowMesh = null;
  function tripleForCell(x, y, z) {
    const h = Math.abs((x * 73856093) ^ (y * 19349663) ^ (z * 83492791));
    return VALID_TRIPLES[h % VALID_TRIPLES.length];
  }
  function activeWorldTriple() {
    return { world, scene };
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
    const activeMesh = mesh;
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
    truncatedTetrahedron: buildSphericalGeometry(sphericalShapes.truncatedTetrahedron),
    tetrahedron: buildSphericalGeometry(sphericalShapes.tetrahedron),
    elongDodeca: buildSphericalGeometry(sphericalShapes.elongDodeca),
    hexPrism: buildSphericalGeometry(sphericalShapes.hexPrism),
    rhombohedron: buildSphericalGeometry(sphericalShapes.rhombohedron),
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
          mat.color.copy(instanceColorFor(entry.cell, 'rd'));
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
    // Pyrochlore: 2 TT + 2 tet meshes, each its own real (non-shared)
    // angular geometry, so swap per mesh rather than via originalGeometries.
    pyrochloreTTMeshes.forEach((m, idx) => { m.geometry = sphericalModeActive ? sphericalGeometries.truncatedTetrahedron : pyrochloreTTGeometries[idx]; });
    pyrochloreTetMeshes.forEach((m, idx) => { m.geometry = sphericalModeActive ? sphericalGeometries.tetrahedron : pyrochloreTetGeometries[idx]; });
    // View-mode backfill (2026-09-24): ED, Hex Prism, Rhombohedra.
    elongDodecaMesh.geometry = sphericalModeActive ? sphericalGeometries.elongDodeca : elongDodecaGeometry;
    hexPrismMesh.geometry = sphericalModeActive ? sphericalGeometries.hexPrism : hexPrismGeometry;
    rhombohedraMesh.geometry = sphericalModeActive ? sphericalGeometries.rhombohedron : rhombohedraGeometry;
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
    // { quiet: true }: the dimension picker's own default-piece pick --
    // selects the piece without auto-opening the colour picker, which is
    // only wanted when a player deliberately picks a Piece from the menu
    // (2026-09-25: it was popping up over the empty world on every entry
    // into 2D/3D/4D, reading as a cluster of floating squares).
    const handleWheelAction = (action, { quiet = false } = {}) => {
        // openCyborg/openLab reuse the real, already-shipped toggles.
        // openAlmanac now opens the real Almanac overlay (Stage 1 --
        // previously just a "not built yet" toast).
        // (openLenses/X-Ray was dropped from the universal ring
        // 2026-08-29 -- X-Ray stays reachable via the corner HUD wheel's
        // own #xray-toggle face and the Lab panel, so no wheel face
        // routes to it here any more.)
        if (action === 'tool:shellsWorld' || action === 'tool:goldenWorld' || action === 'tool:kaleidoWorld') {
          own3D = { 'tool:shellsWorld': 'shells', 'tool:goldenWorld': 'golden', 'tool:kaleidoWorld': 'kaleido' }[action];
          wheel3D.close();
          applyDimensionVisibility();
          updateQuickSelect();
          showHudPrompt({ shells: 'Shells', golden: 'Golden Rhombohedra', kaleido: 'Kaleidoscope' }[own3D], 2500);
          return;
        }
        if (own3D && (action?.startsWith('tool:pieceType:') || action === 'tool:cuboctaBuild')) {
          own3D = null;
          applyDimensionVisibility();
        }
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

        // --- Build: direct matches, high confidence ---
        // Universal Add/Remove, direct instruction 2026-08-26: retires the
        // separate Rhombi-model/Pyramid-model/Cube-model (and their own
        // -sculpt counterparts) as distinct buttons -- ONE Add and ONE
        // Remove, both piece-tier-aware via the new Piece picker below
        // (core/build.js's getPieceType()). 'build'/'chisel' are the
        // internal mode strings (unchanged/new respectively); the LABELS
        // are the generic ones now. Was "Rhombi-model" (tool:rhombiModel).
        // Was "Rhombi-sculpt" (tool:rhombiSculpt) -- same rich brush/
        // mirror/symmetry panel as always, just renamed so it doesn't
        // read as a same-job-different-name twin of the new plain Remove
        // action below (that confusion was the whole point of this pass).
        // New: a plain "click a piece, it's gone" action -- piece-tier
        // aware (RD/Cube = the whole cell, Pyramid = just that one
        // pyramid). Real logic in core/build.js's 'chisel' mode.
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
            rd: 'RD', cube: 'Cube', pyramid: 'Pyramid', to: 'Truncated Octahedron', ioct: 'Flattened Octahedron', octahedron: 'Octahedron', idis: 'Disphenoid', halfrd: 'Hemi RD', hourglass: 'Hourglass', hemi3: 'Corner Cluster', hemi4: 'Band Cluster', hemiTri: 'Triangle Cluster', elongdodeca: 'Elongated Dodecahedron', rdquarter: 'RD Quarter (rhombohedron)', hexprism: 'Hexagonal Prism', rhombohedra: 'Rhombohedra', pyrochlore: 'Pyrochlore (3D Kagome)', tesseract: 'Tesseract', cell24: '24-cell', cell16: '16-cell', a4trunc: 'Truncated 5-cell', a4bitrunc: 'Bitruncated 5-cell', a4cell5: '5-cell',
            // 2D lattice tier: one label per LATTICE_PRIMITIVES entry
            // (Phase 6: primitive alone, angle is a live toggle not a
            // piece-type value -- see lattice2dSeedCell's own header),
            // generated rather than hand-listed so a new primitive never
            // needs a matching new label added here.
            ...Object.fromEntries(LATTICE_PRIMITIVES.map((p) => [`lattice2d:${p.id}`, p.label])),
          };
          document.getElementById('piece-type-select').value = value;
          if (['tesseract', 'cell24', 'cell16', 'a4trunc', 'a4bitrunc', 'a4cell5'].includes(value)) world4d?.setKind(value);
          // Real gap, caught while fixing a separate lattice2d bug
          // (see lattice2dSeedCell's own header): every OTHER piece
          // type here is always-visible regardless of which is picked
          // (rd/cube/to/... genuinely do coexist), but lattice2d meshes
          // do NOT -- only the toggle panel's own ACTIVE primitive
          // stays visible (dimensionAllowsMesh's own Phase 5 gate).
          // Picking a lattice2d piece from the Wizard/wheel (not the
          // toggle panel itself) must sync the panel's own state too,
          // or the piece-type-select changes while the WRONG mesh
          // stays shown -- a real, silent mismatch this closes.
          if (value.startsWith('lattice2d:')) {
            const primitiveId = value.slice('lattice2d:'.length);
            if (primitiveId !== activeLattice2dPrimitiveId) {
              activeLattice2dPrimitiveId = primitiveId;
              activeLattice2dArrangementId = 'translation'; // reset -- same reasoning as renderLattice2dPanel's own angle/primitive click handlers
              renderLattice2dPanel();
            }
            const angleDeg = currentLattice2dAngleDeg();
            rebuildLattice2dInstances(lattice2dMeshes.get(primitiveId), lattice2dWorlds.get(primitiveId), primitiveId, angleDeg, activeLattice2dArrangementId, lattice2dCompanionMeshes.get(primitiveId), lattice2dClassMeshes.get(primitiveId));
            updateDotMatrix(angleDeg);
            applyDimensionVisibility();
          }
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
          if (!quiet) pickers.openColorPicker((matValue, matLabel) => showHudPrompt(`Color: ${matLabel}`, 3000));
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
          if (!quiet) pickers.openColorPicker((value, label) => showHudPrompt(`Color: ${label}`, 3000));
          return;
        }

        // --- Rhombitect: JUDGMENT CALL. "Dome" is a real sculpt-panel
        // NL shape keyword (src/core/sculpture.js's shape parser
        // recognizes "dome"); prefilling it is a real, grounded action,
        // not invented, but was never a documented 1-click wheel
        // action before now. ---

        if (action?.startsWith('tool:')) { showHudPrompt(`${action.slice(5)} is not built yet.`, 3000); return; }
    };
    selectPieceAction = handleWheelAction;
    const wheel3D = createRhombicWheel3D({
      onAction: handleWheelAction,
    });
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
    // No longer seeds anything (2026-09-24: physical seeds replaced by
    // the cyan first-placement target, see firstPlacementSpec) -- kept as
    // a no-op so its many call sites stay valid.
    function seedIfWorldEmpty() {}
    // Dimension-select wheel (2026-09-22, 3rd iteration): a SEPARATE
    // createRhombicWheel3D() instance, dedicated only to WHEEL_DIMENSION
    // -- never navigated to/from wheel3D (the shared Build/Piece nav
    // wheel), its own overlay/scene, direct instruction ("one moving
    // rhombic wheel with all dimensions selectable... a dedicated
    // rotating wheel just for dimensions"). Replaces the earlier
    // wireframe-card wizard (dimension-wizard.js, now archived --
    // an old dimension-wizard.js, since deleted).
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
      onAction: (action) => {
        if (action === 'tool:selectDimension:3D') {
          activeDimension = '3D';
          applyDimensionVisibility();
          applyDimensionCamera('3D');
          seedIfWorldEmpty();
          dimensionWheel3D.close();
          handleWheelAction('tool:pieceType:rd', { quiet: true });
          return;
        }
        // 2D: every lattice2dWorlds entry is already seeded at
        // construction (see its own "seed here, not just in the change
        // handler" comment above) -- unlike 3D there's no separate world
        // to seed here, just select a default piece type. Defaults to
        // Parallelogram (LATTICE_PRIMITIVES' own first entry) at
        // START_LATTICE_ANGLE (the toggle panel's own default -- see
        // activeLattice2dAngleId's declaration),
        // matching this quick dimension-wheel shortcut's own "just pick
        // A reasonable default, the full picker is dimension-wizard.js's
        // job" role -- same relationship 3D's own 'rd' default above has
        // to its own wizard screen.
        // 4D (2026-09-24): switch every 3D/2D mesh off, the 4D world on,
        // and open the separate 4D picker wheel, starting on the 24-cell.
        if (action === 'tool:selectDimension:4D') {
          activeDimension = '4D';
          handleWheelAction('tool:pieceType:cell24', { quiet: true });
          applyDimensionVisibility();
          applyDimensionCamera('4D');
          dimensionWheel3D.close();
          wheel3D.open('piece4d');
          return;
        }
        if (action === 'tool:selectDimension:5D' || action === 'tool:selectDimension:6D') {
          dimensionWheel3D.close();
          enterQuasicrystal(action.slice(-2));
          return;
        }
        if (action === 'tool:selectDimension:2D') {
          activeDimension = '2D';
          applyDimensionVisibility();
          applyDimensionCamera('2D');
          dimensionWheel3D.close();
          handleWheelAction(`tool:pieceType:lattice2d:${LATTICE_PRIMITIVES[0].id}`, { quiet: true });
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
    // Wizard wireframes (2026-09-24 parity): each piece's edges come from
    // the SAME real geometry this file places/renders (and Lattice View /
    // Skeleton / the cyan first-placement outline all edge the same way,
    // via EdgesGeometry) -- the wizard owns no geometry of its own.
    // Built lazily per open screen; plain [[a, b], ...] point pairs out.
    function wizardPieceGeometry(action) {
      const convex = (pts) => new ConvexGeometry(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      const piece = action.replace('tool:pieceType:', '');
      if (action === 'tool:cuboctaBuild') return cuboctaGeometry;
      if (action === 'tool:shellsWorld') return wizardPieceGeometry('tool:pieceType:rd');
      if (action === 'tool:goldenWorld') {
        const e6 = qcEngines['6d'];
        return convex(e6.tileVertices([0, 0, 0, 0, 0, 0], [0, 1, 2]));
      }
      if (action.startsWith('summon:')) {
        const entry = findBySerial(catalogueEntries, Number(action.slice(7)));
        if (!entry) return null;
        const e = qcEngines[entry.tier];
        if (entry.kind !== 'patch') return convex(zonotopeVertices(e, entry, PRISM_HEIGHT));
        // A patch: its own tiles, centred on the star's vertex.
        return mergeGeometries(localPatch(e, entry.window, entry.rings).map((t) => convex(e.tileVertices(t.n, t.I, 0))), false);
      }
      switch (piece) {
        case 'rd': return geometry;
        case 'halfrd': return buildHemisphereGeometry({ type: 'halfrd', cell: [0, 0, 0], offsetIndex: 0, side: 'positive' }, SCALE);
        case 'hourglass': return buildHemisphereGeometry({ type: 'hourglass', cellA: [0, 0, 0], cellB: NEIGHBOR_OFFSETS[0], offsetIndex: 0 }, SCALE);
        case 'rdquarter': return buildHemisphereGeometry({ type: 'rdquarter', cell: [0, 0, 0], cornerIndex: 0 }, SCALE);
        case 'cube': return convex(pyramidPieces(SCALE).cube);
        case 'pyramid': { const { base, apex } = pyramidPieces(SCALE).pyramids['y+']; return convex([...base, apex]); }
        case 'octahedron': return octGapGeometry;
        case 'to': return bccGeometry;
        case 'ioct': return mergeGeometries(octahedronDisphenoids([0, 0, 0], LATTICE_QUICK_VIEW_AXIS_OFFSET).map((v) => convex(disphenoidVertsToWorld(v, SCALE))), false);
        case 'idis': return buildInterstitialGeometry(bootstrapDisphenoid([0, 0, 0]), SCALE);
        case 'elongdodeca': return elongDodecaGeometry;
        case 'hexprism': return hexPrismGeometry;
        case 'rhombohedra': return rhombohedraGeometry;
        case 'pyrochlore': return convex(truncatedTetrahedronVerts(1, PYROCHLORE_S));
        default: return null;
      }
    }
    function wizardPieceEdges(action) {
      // A polytope's preview is its whole projected wireframe, not just
      // the hull's outline (5D: the flat shadow, lifted into the x/z plane).
      const poly = action.startsWith('summon:') && findBySerial(catalogueEntries, Number(action.slice(7)));
      if (poly?.kind === 'polytope' || poly?.kind === 'bridge') {
        const e = qcEngines[poly.tier];
        const { verts, edges } = polytopeShape(e.d, poly.family, poly.directions, poly.prism);
        const pts = verts.map((m) => { const q = e.parOf(m); return poly.tier === '5d' ? [q[0], 0, q[1]] : q; });
        return edges.map(([a, b]) => [pts[a], pts[b]]);
      }
      const g = wizardPieceGeometry(action);
      if (!g) return [];
      const edges = new THREE.EdgesGeometry(g);
      const a = edges.attributes.position.array;
      const out = [];
      for (let i = 0; i < a.length; i += 6) out.push([[a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]]]);
      edges.dispose();
      return out;
    }
    // 5D/6D (quasicrystals): one world each, and the tiling picks each
    // piece's shape, so there's no piece to choose on the way in.
    function enterQuasicrystal(dimension, action = null) {
      activeDimension = dimension;
      applyDimensionVisibility();
      applyDimensionCamera(dimension);
      updateQuickSelect(); // the bottom-left button becomes Catalogue
      if (action?.startsWith('summon:')) {
        loadCatalogue().then((entries) => qcWorlds.get(dimension).startSummon(findBySerial(entries, Number(action.slice(7)))));
      }
    }
    // Catalogue wireframes (the Wizard's 5D/6D screen): each entry's
    // zonotope outline, from the same engine that places its pieces.
    let catalogueEntries = [];
    loadCatalogue().then((entries) => { catalogueEntries = entries; });
    const qcEngines = { '5d': makeQuasicrystal('5d'), '6d': makeQuasicrystal('6d') };
    const dimensionWizard = createDimensionWizard({
      pieceEdges: wizardPieceEdges,
      // Real bug fixed same session: this used to hardcode
      // activeDimension = '3D' regardless of which of the wizard's own
      // screens the pick came from, so choosing Square from its 2D
      // screen incorrectly left activeDimension at '3D' -- wrong for
      // applyDimensionVisibility's own dimension-scoped mesh toggling.
      // dimension-wizard.js's own showLattice2D/showLattice3D now pass
      // the real dimension alongside the action.
      onSelectFamily: (dimension, action) => {
        dimensionWheel3D.close(); // chosen from the Wizard: the dimension picker is done
        if (qcWorlds.has(dimension)) { enterQuasicrystal(dimension, action); return; }
        activeDimension = dimension;
        applyDimensionVisibility();
        applyDimensionCamera(dimension);
        if (dimension === '3D') seedIfWorldEmpty();
        // Quiet, like the dimension picker: no colour picker popping up over
        // the first-placement outline (it caught the first tap -- direct
        // report, 2026-09-26). The Colour button is still one tap away.
        handleWheelAction(action, { quiet: true });
      },
    });
    document.getElementById('hud-wizard-cue')?.addEventListener('click', () => dimensionWizard.open());
    // The welcome screen's 2D, 3D, 4D, 5D & 6D links open the Wizard there.
    window.addEventListener('rhombiverse:open-wizard', (e) => dimensionWizard.openDimension(e.detail));
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
      // 4D: the bottom-left button opens the separate 4D picker wheel
      // (direct decision), not the 3D Piece wheel.
      if (activeDimension === '4D') { wheel3D.open('piece4d'); return; }
      if (qcWorlds.has(activeDimension)) { dimensionWizard.openCatalogue(activeDimension); return; }
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
  const LATTICE_QUICK_VIEW_MODES = ['off', 'rd', 'cube', 'pyramid', 'rdquarter', 'cubocta', 'octahedron', 'bcc', 'octa', 'disphenoid', 'elongdodeca', 'hexprism', 'rhombohedra', 'pyrochlore'];
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
    elongdodeca: 'Elongated Dodecahedron -- your ED build plus every open ED slot one step beyond it.',
    hexprism: 'Hex Prism -- your Hex Prism build plus every open slot one step beyond it on its own hexagonal grid.',
    rhombohedra: 'Rhombohedra -- your Rhombohedra build plus every open slot one step beyond it (following the current Copy / Mirror setting).',
    pyrochlore: 'Pyrochlore (3D Kagome) -- your truncated tetrahedra plus every open slot one step beyond them, with all their corner-sharing tetrahedra.',
  };
  // 'off' added 2026-09-02: without it, markKey was undefined and
  // updateLatticeQuickViewIcon() below rendered a totally blank
  // iconFrame (outline only, zero ink) for the default/most-common
  // state -- direct report ("lattice view symbols are still feint")
  // traced to this, not a rendering-strength issue. See MARKS.latticeOff.
  const LATTICE_QUICK_VIEW_MARK_KEY = { off: 'latticeOff', rd: 'pieceRD', cube: 'pieceCube', pyramid: 'piecePyramid', rdquarter: 'pieceRDQuarter', cubocta: 'cuboctahedron', bcc: 'pieceTO', octa: 'pieceOctaSite', octahedron: 'pieceOctahedron', disphenoid: 'pieceDisphenoid', elongdodeca: 'pieceElongDodeca', hexprism: 'pieceHexPrism', rhombohedra: 'pieceRhombohedron', pyrochlore: 'piecePyrochlore' };
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

  function clearLatticeQuickView() {
    for (const g of [latticeQuickViewMesh, latticeQuickViewEdges]) {
      if (!g) continue;
      g.parent?.remove(g);
      for (const child of g.children) { child.geometry.dispose(); child.material.dispose(); }
    }
    latticeQuickViewMesh = null;
    latticeQuickViewEdges = null;
  }
  // Lattice View shows only the build's outer bands (direct request,
  // 2026-09-26: a big build's ghosts piled up toward the centre): the open
  // slots outside it (band 0) and its 3 outermost layers (bands 1-3),
  // fading inward. A built cell's band is its depth: 1 if it has an open
  // neighbour, else one more than its shallowest neighbour. Cells deeper
  // than LATTICE_VIEW_LAYERS get no ghost.
  const LATTICE_VIEW_LAYERS = 3;
  const LATTICE_VIEW_FADE = [1, 1, 0.5, 0.25]; // opacity by band
  function buildDepths(list, offsetsOf) {
    const key = (c) => c.join(',');
    const built = new Set(list.map(key));
    const depth = new Map();
    let frontier = list.filter((c) => offsetsOf(c).some(([dx, dy, dz]) => !built.has(key([c[0] + dx, c[1] + dy, c[2] + dz]))));
    for (const c of frontier) depth.set(key(c), 1);
    for (let d = 2; d <= LATTICE_VIEW_LAYERS && frontier.length; d++) {
      const next = [];
      for (const c of frontier) for (const [dx, dy, dz] of offsetsOf(c)) {
        const n = [c[0] + dx, c[1] + dy, c[2] + dz];
        const k = key(n);
        if (built.has(k) && !depth.has(k)) { depth.set(k, d); next.push(n); }
      }
      frontier = next;
    }
    return depth;
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
    // 4D/6D draw their own Lattice View; no 3D overlay there.
    if (isOwnWorldDimension()) { syncLatticeQuickViewActiveState(true); return; }
    const { world: w, scene: s } = activeWorldTriple();
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    // A newer call (a later click, or a rapid second onChange) may have
    // started and already handled the scene while this one was
    // awaiting the import above -- discard this stale result instead of
    // clobbering that newer state or adding a mesh for a mode that may
    // no longer be current.
    if (myGeneration !== latticeQuickViewGeneration) return;

    const isFccFamily = latticeQuickViewMode === 'rd' || latticeQuickViewMode === 'cube' || latticeQuickViewMode === 'pyramid' || latticeQuickViewMode === 'rdquarter';
    const pieces = []; // { g, band }
    const put = (g, band) => pieces.push({ g, band });
    const allCells = w ? w.entries() : [];
    // The FCC build's outer bands, plus its open slots as band 0 (so every
    // FCC-based mode extends past the build, like ED/Hex/Pyrochlore do):
    // `cells` is those cells, `bandOf` reads one's band.
    const bandMap = buildDepths(allCells.map((c) => [c.x, c.y, c.z]), () => NEIGHBOR_OFFSETS);
    const builtKeys = new Set(allCells.map((c) => `${c.x},${c.y},${c.z}`));
    const cells = allCells.filter((c) => bandMap.has(`${c.x},${c.y},${c.z}`));
    for (const c of allCells) {
      if (bandMap.get(`${c.x},${c.y},${c.z}`) !== 1) continue;
      for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
        const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
        if (builtKeys.has(k) || bandMap.has(k)) continue;
        bandMap.set(k, 0);
        cells.push({ x: c.x + dx, y: c.y + dy, z: c.z + dz });
      }
    }
    const bandOf = (c) => bandMap.get(`${c.x},${c.y},${c.z}`);
    // Derived anchors take the shallowest band of the cells that made them.
    const setAnchor = (map, p, band) => { const k = p.join(','); const old = map.get(k); if (!old || band < old.band) map.set(k, { p, band }); };
    if (isFccFamily) {
      for (const cell of cells) for (const g of fccQuickViewPieces(cell, latticeQuickViewMode)) put(g, bandOf(cell));
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
      const cuboctaAnchors = new Map(); // "x,y,z" -> { p, band }
      const [repDx, repDy, repDz] = CUBOCTA_AXIS_OFFSETS[0];
      for (const cell of cells) {
        setAnchor(cuboctaAnchors, [cell.x, cell.y, cell.z], bandOf(cell));
        setAnchor(cuboctaAnchors, [cell.x + repDx, cell.y + repDy, cell.z + repDz], bandOf(cell));
      }
      for (const { p: [x, y, z], band } of cuboctaAnchors.values()) {
        const [wx, wy, wz] = cellToWorld(x, y, z, SCALE);
        const verts = cuboctahedronVertices(SCALE).map(([vx, vy, vz]) => new THREE.Vector3(vx + wx, vy + wy, vz + wz));
        put(new ConvexGeometry(verts), band);
      }
    } else if (latticeQuickViewMode === 'octahedron') {
      // Cuboctahedron gap-fill Octahedron: lives directly in the SAME
      // FCC-cell coordinate space as 'cubocta' above (octGapCellForCOCell
      // treats a real cell exactly like a real CO position, no BCC
      // conversion involved) -- two representative octahedra per real
      // cell, at the fixed LATTICE_QUICK_VIEW_OCTAHEDRON_DIRECTIONS
      // corners, deduped the same way the BCC-family anchors below are
      // (adjacent cells can share the same cube-center).
      const anchors = new Map(); // "i,j,k" -> { p, band }
      for (const cell of cells) {
        for (const dir of LATTICE_QUICK_VIEW_OCTAHEDRON_DIRECTIONS) setAnchor(anchors, octGapCellForCOCell(cell, dir), bandOf(cell));
      }
      for (const { p: [i, j, k], band } of anchors.values()) {
        const [wx, wy, wz] = octGapCellToWorld(i, j, k, SCALE);
        const verts = octGapVertices(SCALE).map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
        put(new ConvexGeometry(verts), band);
      }
    } else if (['elongdodeca', 'hexprism', 'rhombohedra', 'pyrochlore'].includes(latticeQuickViewMode)) {
      // Own-lattice pieces (2026-09-24, direct instruction: "follow rules
      // of previous ones where a lattice always extends past where you
      // have built so far"): drawn from that piece's OWN build, not the
      // RD world -- every placed piece plus every open slot one step
      // beyond it, so the grid visibly extends past the build and grows
      // with it.
      const at = (verts, [cx, cy, cz]) => new ConvexGeometry(verts.map(([x, y, z]) => new THREE.Vector3(x + cx, y + cy, z + cz)));
      if (latticeQuickViewMode === 'elongdodeca' || latticeQuickViewMode === 'hexprism') {
        const isED = latticeQuickViewMode === 'elongdodeca';
        const own = isED ? elongDodecaWorld.entries() : hexPrismWorld.entries();
        const offsets = isED ? NEIGHBOR_OFFSETS : HEX_NEIGHBOR_OFFSETS;
        const depth = buildDepths(own.map((c) => [c.x, c.y, c.z]), () => offsets);
        const slots = new Map(); // key -> { p, band }
        for (const c of own) {
          const band = depth.get(`${c.x},${c.y},${c.z}`);
          if (band === undefined) continue;
          slots.set(`${c.x},${c.y},${c.z}`, { p: [c.x, c.y, c.z], band });
        }
        for (const c of own) {
          if (depth.get(`${c.x},${c.y},${c.z}`) !== 1) continue;
          for (const [dx, dy, dz] of offsets) {
            const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
            if (!slots.has(k) && !depth.has(k)) slots.set(k, { p: [c.x + dx, c.y + dy, c.z + dz], band: 0 });
          }
        }
        const verts = isED ? elongatedDodecahedronVerts(SCALE) : hexPrismVerts(HEX_PRISM_R, HEX_PRISM_H);
        for (const { p: [x, y, z], band } of slots.values()) put(at(verts, isED ? elongDodecaCellToWorld(x, y, z, SCALE) : hexCellToWorld(x, y, z, HEX_PRISM_R, HEX_PRISM_H)), band);
      } else if (latticeQuickViewMode === 'rhombohedra') {
        const own = rhombohedraWorld.entries();
        const slots = new Map(own.map((c) => [`${c.x},${c.y},${c.z}`, { x: c.x, y: c.y, z: c.z, o: c.o ?? 0 }]));
        const faceDirs = [[1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1]].flatMap((n) => [n, n.map((v) => -v)]);
        for (const c of own) {
          const q = c.o ?? 0;
          for (const n of faceDirs) {
            const opt = rhombohedraAttachOptions(q, [c.x, c.y, c.z], n).find((o) => (o.o !== q) === (rhomboAttachMode === 'mirror'));
            if (!opt || slots.has(opt.c4.join(','))) continue;
            if (own.some((b) => rhombohedraOverlap(b.o ?? 0, [b.x, b.y, b.z], opt.o, opt.c4))) continue;
            slots.set(opt.c4.join(','), { x: opt.c4[0], y: opt.c4[1], z: opt.c4[2], o: opt.o });
          }
        }
        const base = rhombohedraTileVerts(RHOMBOHEDRA_S);
        for (const cell of slots.values()) put(new ConvexGeometry(base.map(([x, y, z]) => new THREE.Vector3(x, y, z))).applyMatrix4(rhombohedraInstanceMatrix(cell)), 1);
      } else {
        const own = pyrochloreWorld.entries().filter((c) => pyrochloreSiteOrientation(c.x, c.y, c.z) !== 0);
        const ttOffsets = ([x, y, z]) => pyrochloreNeighborOffsets(pyrochloreSiteOrientation(x, y, z));
        const depth = buildDepths(own.map((c) => [c.x, c.y, c.z]), ttOffsets);
        const slots = new Map(); // key -> { x, y, z, band }
        for (const c of own) {
          const band = depth.get(`${c.x},${c.y},${c.z}`);
          if (band !== undefined) slots.set(`${c.x},${c.y},${c.z}`, { x: c.x, y: c.y, z: c.z, band });
        }
        for (const c of own) {
          if (depth.get(`${c.x},${c.y},${c.z}`) !== 1) continue;
          for (const [dx, dy, dz] of ttOffsets([c.x, c.y, c.z])) {
            const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
            if (!slots.has(k) && !depth.has(k)) slots.set(k, { x: c.x + dx, y: c.y + dy, z: c.z + dz, band: 0 });
          }
        }
        const all = [...slots.values()];
        for (const c of all) put(at(truncatedTetrahedronVerts(pyrochloreSiteOrientation(c.x, c.y, c.z), PYROCHLORE_S), pyrochloreCellToWorld(c.x, c.y, c.z, PYROCHLORE_S)), c.band);
        // Tets: caps of every TT slot, plus the built world's own visible
        // tets (incl. Small-tet additions) and, for each of those, the 4
        // tets sharing its corners -- so a tets-only build extends too.
        const tetSlots = new Map();
        const addTet = (kind, center) => tetSlots.set(center.join(','), { kind, center });
        const caps = pyrochloreCapTets(all);
        for (const kind of ['up', 'down']) for (const { center } of caps[kind]) addTet(kind, center);
        const visible = pyrochloreVisibleTets(pyrochloreWorld.entries());
        for (const kind of ['up', 'down']) {
          for (const { center } of visible[kind]) {
            addTet(kind, center);
            for (const dir of [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]) {
              const partner = pyrochloreTetCornerPartner(kind, center, kind === 'up' ? dir : dir.map((v) => -v));
              addTet(partner.kind, partner.center);
            }
          }
        }
        for (const { kind, center } of tetSlots.values()) put(at(tetrahedronVerts(kind, PYROCHLORE_S), pyrochloreCellToWorld(center[0], center[1], center[2], PYROCHLORE_S)), 1);
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
      const anchors = new Map(); // "x,y,z" -> { p, band }
      for (const cell of cells) {
        for (const p of nearestBCCPoints([cell.x, cell.y, cell.z])) setAnchor(anchors, p, bandOf(cell));
      }
      for (const { p: [x, y, z], band } of anchors.values()) for (const g of bccFamilyQuickViewPieces({ x, y, z }, latticeQuickViewMode)) put(g, band);
    }
    // Defensive only past this point -- nearestBCCPoints always returns
    // a real anchor for any input, and the World is never truly empty
    // (see onChange's own invariant), so `cells` (and therefore
    // `pieces`) can't actually be empty here anymore.
    if (pieces.length === 0) {
      syncLatticeQuickViewActiveState(false);
      return;
    }
    const baseMaterial = new THREE.MeshStandardMaterial({
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
    });
    // Same "2 shapes per cell vs. every other mode's 1" reasoning as the
    // fill material's own opacity above -- half the edge opacity too.
    const edgeOpacity = latticeQuickViewMode === 'cubocta' ? 0.5 : 1;
    latticeQuickViewMesh = new THREE.Group();
    latticeQuickViewEdges = new THREE.Group();
    for (let band = 0; band <= LATTICE_VIEW_LAYERS; band++) {
      const list = pieces.filter((x) => x.band === band).map((x) => x.g);
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const fade = LATTICE_VIEW_FADE[band];
      const material = baseMaterial.clone();
      material.opacity *= fade;
      latticeQuickViewMesh.add(new THREE.Mesh(merged, material));
      latticeQuickViewEdges.add(new THREE.LineSegments(new THREE.EdgesGeometry(merged), new THREE.LineBasicMaterial({
        color: 0xffffff, depthTest: latticeQuickViewMode !== 'cubocta',
        transparent: edgeOpacity * fade < 1, opacity: edgeOpacity * fade,
      })));
    }
    baseMaterial.dispose();
    s.add(latticeQuickViewMesh);
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
    // 4D/6D have one Lattice View (their own open slots): Off <-> On.
    if (isOwnWorldDimension()) latticeQuickViewMode = latticeQuickViewMode === 'off' ? 'rd' : 'off';
    else latticeQuickViewMode = LATTICE_QUICK_VIEW_MODES[(currentIdx + 1) % LATTICE_QUICK_VIEW_MODES.length];
    if (latticeQuickViewMode !== 'off') clearDualizePreview(); // mutual exclusion -- see deactivateLatticeQuickView's own comment
    updateLatticeQuickViewIcon();
    world4d?.setLatticeView(latticeQuickViewMode !== 'off');
    for (const w of qcWorlds.values()) w.setLatticeView(latticeQuickViewMode !== 'off');
    shellsWorld?.setLatticeView(latticeQuickViewMode !== 'off');
    goldenWorld?.setLatticeView(latticeQuickViewMode !== 'off');
    kaleidoWorld?.setLatticeView(latticeQuickViewMode !== 'off');
    showHudPrompt(isOwnWorldDimension() ? `Lattice View: ${latticeQuickViewMode === 'off' ? 'Off.' : `every open slot one step past your ${activeDimension} build.`}` : `Lattice View: ${LATTICE_QUICK_VIEW_LABELS[latticeQuickViewMode]}`, 4500);
    await rebuildLatticeQuickView(); // also syncs the toggle buttons' own 'active' state -- see syncLatticeQuickViewActiveState
  }
  bccToggleBtn?.addEventListener('click', cycleLatticeQuickView);
  document.getElementById('hud-quick-lattice-view')?.addEventListener('click', cycleLatticeQuickView);
  updateLatticeQuickViewIcon();

  const materialSelect = document.getElementById('color-select');

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
  // The colour a new piece is saved with: what the current colour mode
  // shows, so switching to Pick later shows each piece as it was placed.
  function currentMaterialFor(pieceType) {
    if (colorView.mode === 'cyan') return 'cyan';
    if (colorView.mode === 'type') return autoAssignOverrides[pieceType] ?? AUTO_ASSIGN_MATERIAL_BY_PIECE[pieceType] ?? materialSelect.value;
    return materialSelect.value;
  }
  colorView.typeMaterial = (type) => autoAssignOverrides[type] ?? AUTO_ASSIGN_MATERIAL_BY_PIECE[type] ?? 'base';

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
        repaintAllPieces();
      });
      wrap.append(span, select);
      autoAssignMaterialsRow.appendChild(wrap);
    }
  }
  // Cyan / Type / Pick (see COLOR_MODES). Only the controls the mode
  // uses are shown: the Type list in Type, the colour picker in Pick.
  const colorModeButtons = document.querySelectorAll('.color-mode-btn');
  const colorRow = document.getElementById('color-row');
  function showColorMode() {
    colorModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.colorMode === colorView.mode));
    if (colorRow) colorRow.style.display = colorView.mode === 'pick' ? '' : 'none';
    if (autoAssignMaterialsRow) autoAssignMaterialsRow.style.display = colorView.mode === 'type' ? 'flex' : 'none';
  }
  function setColorMode(mode) {
    if (!COLOR_MODES.includes(mode) || mode === colorView.mode) return;
    colorView.mode = mode;
    if (mode !== 'pick' && paint2d) setPaint2d(false);
    try { localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode); } catch { /* best-effort only */ }
    showColorMode();
    repaintAllPieces();
    refreshHudIndicator?.();
  }
  materialSelect.value = currentMaterialFor(document.getElementById('piece-type-select')?.value);
  colorModeButtons.forEach((btn) => btn.addEventListener('click', () => setColorMode(btn.dataset.colorMode)));
  showColorMode();

  const DUALIZE_RADIUS = 3; // shells around the clicked cell that Dualize previews

  const MODE_HINTS = {
    build: 'Click a face to add one cell using the selected material.',
    bcc: 'Click a face of an existing BCC cell to extend it, or a face of your normal World to start one nearby. Right-click removes a BCC cell. Overlap with your normal World is expected -- it\'s how the two lattices join.',
    cubocta: 'Click a face of your normal World to place a cuboctahedron there, or near a POINT of an existing one to add the neighbor there -- click closer to a flat face instead of a point to add one face to face with its next-door neighbor. Right-click removes one. Overlap with your normal World is expected. To fill the gap that opens up between face-to-face cuboctahedra, switch to Build/Chisel mode and pick Octahedron from the Piece menu instead -- click near a corner of an existing cuboctahedron.',
    dualize: 'Click an existing structure (FCC or a real placed BCC/TO cell) to preview the region around it reinterpreted through the other lattice. View-only -- nothing is written to your World.',
  };
  function updateModeUI() {
    document.getElementById('mode-hint').textContent = MODE_HINTS[currentMode] ?? '';
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
    elongdodeca: 'pieceElongDodeca', hexprism: 'pieceHexPrism', rdquarter: 'pieceRDQuarter', rhombohedra: 'pieceRhombohedron', pyrochlore: 'piecePyrochlore', tesseract: 'pieceTesseract', cell24: 'piece24Cell', cell16: 'piece16Cell', a4trunc: 'pieceTrunc5Cell', a4bitrunc: 'pieceBitrunc5Cell', a4cell5: 'piece5Cell',
    // 2D lattice tier: one entry per LATTICE_PRIMITIVES, reusing
    // wheel-icons.js's own 3 primitive-keyed icons (Phase 6: the piece
    // type IS just the primitive now, angle is a separate live toggle
    // -- see lattice2dSeedCell's own header).
    ...Object.fromEntries(LATTICE_PRIMITIVES.map((p) => [`lattice2d:${p.id}`, `piece2d${p.id[0].toUpperCase()}${p.id.slice(1)}`])),
  };
  const quickShapeEl = document.getElementById('hud-quick-shape');
  // Real bug from the same-day Material -> Color rename (669fc6f): that
  // commit renamed the button's id in index.html's CSS/markup AND this
  // file's own click handler (a few hundred lines up) to #hud-quick-color,
  // but missed THIS lookup -- left pointing at the old #hud-quick-material
  // id, which no longer exists anywhere. getElementById returned null,
  // silently no-oping the `if (quickMaterialEl)` branch below on every
  // call, so the button kept working (its click handler was renamed
  // correctly) but never again showed the current color swatch. Direct
  // report: "the color selection icon disappeared... still working but
  // doesnt show current color now" -- exactly this symptom.
  const quickMaterialEl = document.getElementById('hud-quick-color');
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
  onSettingsChange(() => updateQuickSelect()); // the Catalogue title follows the language
  function updateQuickSelect() {
    updateRhomboAttachPanel();
    // The "6 pyramids on a cube" hint only applies to RD/Cube/Pyramid --
    // direct report: it also showed for Kagome/Pyrochlore ("why
    // instructions for kagome mention cube?").
    const tryHint = document.getElementById('piece-try-hint');
    if (tryHint) tryHint.style.display = ['rd', 'cube', 'pyramid'].includes(document.getElementById('piece-type-select')?.value) ? '' : 'none';
    updateFirstPlacementTarget();
    if (quickShapeEl) {
      // Cuboctahedron Build (currentMode === 'cubocta') isn't a
      // piece-type value at all -- it's its own mode, same as BCC Build
      // -- so it was invisible to this icon entirely: picking it left
      // the quick-select showing whatever piece type was selected
      // before, with zero feedback that anything had changed. Direct
      // report 2026-08-29 ("the picker symbol at bottom doesnt change").
      // Checked first, ahead of the plain piece-type lookup below.
      if (qcWorlds.has(activeDimension)) {
        quickShapeEl.innerHTML = iconFrame(MARKS.pieceRhombohedron, { title: t('cat.button', getSettings().language) });
      } else if (own3DActive()) {
        quickShapeEl.innerHTML = iconFrame(own3D === 'shells' ? MARKS.pieceRD : MARKS.pieceRhombohedron, { title: own3D === 'shells' ? 'Shells' : 'Golden Rhombohedra' });
      } else if (currentMode === 'cubocta') {
        quickShapeEl.innerHTML = iconFrame(MARKS.cuboctahedron, { title: 'Shape' });
      } else {
        const pieceValue = document.getElementById('piece-type-select').value;
        quickShapeEl.innerHTML = iconFrame(MARKS[PIECE_MARK_KEY[pieceValue]] ?? MARKS.pieceRD, { title: 'Shape' });
      }
    }
    if (quickMaterialEl) {
      const hex = `#${materialColor(currentMaterialFor(document.getElementById('piece-type-select').value)).getHexString()}`;
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
    if (colorView.mode === 'cyan') { setColorMode('pick'); return; }
    if (colorView.mode !== 'type') return;
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
    repaintAllPieces();
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
      rebuildInstances(mesh, world);
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
    if (currentMode !== 'dualize') return;
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
    await rebuildDualizePreview(hitBcc ? 'bcc' : 'fcc', cell.x, cell.y, cell.z, DUALIZE_RADIUS);
  });

  // Interpenetrating Lattice Preview (direct user request 2026-08-28)
  // retired 2026-08-29: Lattice Quick-View's own 'bcc' mode now covers
  // your real World's co-locatable cells the same way (and more
  // consistently, alongside RD/Cube/Pyramid/Octahedron Site/Disphenoid)
  // -- see cycleLatticeQuickView/rebuildLatticeQuickView above. Direct
  // confirmation to retire rather than keep both.

  const canPlaceMaterial = () => true;

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

  world4d = createWorld4D({
    scene,
    materialColor: viewMaterialColor,
    getMaterial: () => currentMaterialFor(document.getElementById('piece-type-select').value),
    showHudPrompt,
    // Undo history: the 4D world saves itself, so it reports its built
    // cells here after every edit (view changes never reach this).
    onChange: () => { if (historyRestorers.has('world4d')) recordHistory('world4d', world4d.snapshot()); },
  });
  // A 5D/6D summon ghost can land out of view (it goes where the item
  // really occurs): glide the camera, target and position together so the
  // view direction is kept, until the point is centred.
  function focusCameraOn([x, y, z]) {
    const p = new THREE.Vector3(x, y, z);
    const ndc = p.clone().project(camera);
    if (Math.abs(ndc.x) < 0.7 && Math.abs(ndc.y) < 0.6 && ndc.z < 1) return;
    const delta = p.sub(controls.target);
    const fromTarget = controls.target.clone();
    const fromPosition = camera.position.clone();
    const t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / 400);
      const ease = u * u * (3 - 2 * u);
      controls.target.copy(fromTarget).addScaledVector(delta, ease);
      camera.position.copy(fromPosition).addScaledVector(delta, ease);
      controls.update();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  for (const dim of ['5D', '6D']) {
    const historyKey = `world${dim.toLowerCase()}`;
    const w = createQuasicrystalWorld({
      tier: dim.toLowerCase(),
      scene,
      materialColor: viewMaterialColor,
      getMaterial: () => currentMaterialFor(document.getElementById('piece-type-select').value),
      showHudPrompt,
      focusOn: focusCameraOn,
      onChange: () => { if (historyRestorers.has(historyKey)) recordHistory(historyKey, w.snapshot()); },
    });
    qcWorlds.set(dim, w);
  }
  // Shells: after + Shell, pull the view back (never in) so the whole
  // hull fits, keeping the view direction; glide like focusCameraOn.
  function fitCameraTo([x, y, z], radius) {
    const centre = new THREE.Vector3(x, y, z);
    const need = (radius * 1.15) / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.min(1, camera.aspect);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const now = camera.position.distanceTo(controls.target);
    const toTarget = centre;
    const toPosition = centre.clone().addScaledVector(dir, Math.max(now, need));
    const fromTarget = controls.target.clone();
    const fromPosition = camera.position.clone();
    const t0 = performance.now();
    const step = (t) => {
      const u = Math.min(1, (t - t0) / 400);
      const ease = u * u * (3 - 2 * u);
      controls.target.lerpVectors(fromTarget, toTarget, ease);
      camera.position.lerpVectors(fromPosition, toPosition, ease);
      controls.update();
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  shellsWorld = createShellsWorld({
    scene,
    showHudPrompt,
    fitView: fitCameraTo,
    onChange: () => { if (historyRestorers.has('worldshells')) recordHistory('worldshells', shellsWorld.snapshot()); },
  });
  goldenWorld = createGoldenWorld({
    scene,
    showHudPrompt,
    onChange: () => { if (historyRestorers.has('worldgolden')) recordHistory('worldgolden', goldenWorld.snapshot()); },
  });
  kaleidoWorld = createKaleidoWorld({
    scene,
    // One edge length = the 2D hexagon's edge at 60°, so tiles look the same size.
    edge: LATTICE2D_S / Math.sqrt(3),
    colorFor: (tile, out) => out.copy(instanceColorFor({ material: tile.material }, `kaleido:${tile.shape}`)),
    getMaterial: (shape) => currentMaterialFor(`kaleido:${shape}`),
    isPainting: () => paint2d && activeDimension === '2D',
    showHudPrompt,
    onChange: () => { if (historyRestorers.has('worldkaleido')) recordHistory('worldkaleido', kaleidoWorld.snapshot()); },
  });
  registerHistoryStores();
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
      } else {
        hideGhost();
      }
    },
    onHoverEnd: hideGhost,
    onPlaced: (cell) => {
      flashAt(cell, 0x9de0ff);
      playPlaceSound();
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
        a4trunc: {
          add: 'Nothing new to add there -- tap a truncated 5-cell\u2019s big face to add the next one straight through the gap, or tap one of its 5-cells or a gap cell.',
          remove: 'Long-press a placed cell to remove it.',
        },
        a4bitrunc: {
          add: 'Bitruncated 5-cells fill the gaps next to truncated 5-cells -- tap a truncated 5-cell\u2019s big face.',
          remove: 'Long-press a placed cell to remove it.',
        },
        a4cell5: {
          add: 'Tap near a 5-cell\u2019s corner to add the one sharing it, or a truncated 5-cell\u2019s bare small face to put its 5-cell back.',
          remove: 'Long-press any 5-cell to remove just that one.',
        },
        tesseract: {
          add: 'A tesseract is already there -- tap a different face, or slide W-depth to reach the next layer.',
          remove: 'Long-press a placed tesseract to remove it.',
        },
        cell24: {
          add: 'A 24-cell is already there -- tap a different face, or slide W-depth to reach the next layer.',
          remove: 'Long-press a placed 24-cell to remove it.',
        },
        cell16: {
          add: 'A 16-cell is already there -- tap a different face, or slide W-depth to reach the next layer.',
          remove: 'Long-press a placed 16-cell to remove it.',
        },
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
          add: 'Nothing to add there -- that slot is already filled (all 4 rhombohedra in the cell, or the mirror spot is taken or inside a solid RD).',
          remove: 'No RD Quarter there to remove -- tap directly on one you’ve placed.',
        },
        pyrochlore: {
          add: 'A truncated tetrahedron is already there -- tap a hexagon face or one of the small tetrahedra to add one in a new direction.',
          remove: 'Long-press a truncated tetrahedron itself to remove it -- the small tetrahedra are shared between neighbors and go away on their own.',
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
      const lattice2dPrimitive = piece?.startsWith('lattice2d:') ? LATTICE_PRIMITIVES.find((p) => `lattice2d:${p.id}` === piece) : null;
      const lattice2dMessages = lattice2dPrimitive && {
        add: `A ${lattice2dPrimitive.label} tile is already there.`,
        remove: lattice2dPrimitive.id === 'kagome'
          ? 'Nothing to remove there -- long-press one of the hexagons; its triangles go with it (a triangle is shared by up to three hexagons, so it can’t be removed on its own).'
          : `No ${lattice2dPrimitive.label} tile there to remove -- long-press directly on a tile you've placed.`,
      };
      showHudPrompt((lattice2dMessages ?? messages[piece])?.[action] ?? 'Nothing to do there.', 3500);
    },
    getMeshPickable: () => dimensionAllowsMesh('mesh'),
    getMode: () => currentMode,
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
    // 2D lattice tier: one `lattice2d` param replaces the old
    // square2dWorld/square2dMesh/square2dCellAt(+Hexagon/+Triangle)
    // trio-of-trios -- see core/build.js's own `lattice2d` param
    // comment for why. `stores` is built fresh here (not cached)
    // because it's cheap (3 entries) and always needs to reflect
    // lattice2dWorlds/lattice2dMeshes' own current contents. Phase 6:
    // keyed by PRIMITIVE id alone now (not a combo id) -- angle is no
    // longer a store selector, just a live rendering parameter read via
    // `getAngleDeg` at click time (see lattice2dSeedCell's own header
    // for the full incident this replaces).
    lattice2d: {
      primitives: LATTICE_PRIMITIVES,
      stores: new Map(LATTICE_PRIMITIVES.map((p) => [
        p.id,
        {
          world: lattice2dWorlds.get(p.id),
          mesh: lattice2dMeshes.get(p.id),
          // Kite only (see rebuildLattice2dInstances' own header): every
          // class mesh is a real click target, not just the primary --
          // build.js's own handleLattice2dClick checks a hit against ALL
          // of these, not just `mesh`, via this same array. undefined for
          // every other primitive, same as `companions`/`classCount` on
          // their own dispatch entries.
          classMeshes: lattice2dClassMeshes.get(p.id),
          // Kagome only: real bug, direct report ("long touch isnt
          // erasing") -- its 2 triangle companions were built as
          // render-only/non-clickable on purpose (see
          // rebuildLattice2dInstances' own header), but that made roughly
          // half of every Kagome cell's own visible area a dead zone for
          // both tap-to-add and long-press-to-remove, with NO visual way
          // to tell which part is real hexagon vs decorative triangle --
          // confirmed directly (a contextmenu dispatched at a triangle-
          // only point correctly hit nothing and no-opped). Companions
          // are now ALSO real click targets here. Since the Star of David
          // fix their instance index no longer matches cellOrder, so
          // `cellAt` takes the hit mesh and maps a companion hit through
          // lattice2dCompanionOwners back to its owning hexagon cell.
          companionMeshes: lattice2dCompanionMeshes.get(p.id),
          cellAt: (instanceId, object) => {
            const owners = object && lattice2dCompanionOwners.get(object);
            return lattice2dCellOrders.get(p.id)?.[owners ? owners[instanceId] : instanceId];
          },
        },
      ])),
      s: LATTICE2D_S,
      getAngleDeg: currentLattice2dAngleDeg,
      onChange: onLattice2dChange,
      // Real bug this closes: build.js used to import LATTICE_PRIMITIVE_
      // IMPLS directly and look up `impl = LATTICE_PRIMITIVE_IMPLS[primitiveId]`
      // itself, which has no way to know about the Rhombille arrangement
      // swap -- a click while Rotational was active would still place/
      // raycast against plain translated-parallelogram geometry while the
      // mesh RENDERED as rotated rhombi, a real mismatch between what's
      // drawn and what's clickable. Routing through the exact same
      // resolveLattice2dImpl this file's own rebuildLattice2dInstances
      // already uses keeps them permanently in agreement.
      getImpl: (primitiveId) => resolveLattice2dImpl(primitiveId, activeLattice2dArrangementId),
      isPainting: () => paint2d && activeDimension === '2D',
    },
    rhombohedraWorld,
    rhombohedraMesh,
    rhombohedraCellAt: (instanceId) => rhombohedraCellOrder[instanceId],
    getRhombohedraAttachMode: () => rhomboAttachMode,
    getPyrochloreAttachMode: () => pyroAttachMode,
    // First-placement target (see firstPlacementSpec): core/build.js
    // raycasts this mesh while it's visible and routes a tap on it here.
    firstPlacementTarget: {
      mesh: firstPlacementMesh,
      place: (material) => { firstPlacementCurrent?.place(material); },
    },
    onRhombohedraChange,
    // 4D/5D/6D worlds: while one is active it is the ONLY raycast target
    // and handles every tap/long-press itself.
    ownWorld: {
      isActive: isOwnWorldDimension,
      meshes: () => activeOwnWorld().meshes(),
      handleTap: (hit, mode) => activeOwnWorld().handleTap(hit, mode),
    },
    // Pyrochlore (3D Kagome): resolves a raycast hit on any of its 4
    // meshes to either { type: 'tt', cell } or { type: 'tet', kind,
    // center, cell } (cell = the tet's owning TT) -- see
    // rebuildPyrochloreInstances.
    pyrochlore: {
      world: pyrochloreWorld,
      meshes: pyrochloreAllMeshes,
      resolveHit: (hit) => {
        const ttIdx = pyrochloreTTMeshes.indexOf(hit.object);
        if (ttIdx !== -1) {
          const cell = pyrochloreCellOrders[ttIdx][hit.instanceId];
          return cell ? { type: 'tt', cell } : null;
        }
        const inst = pyrochloreTetInstances.get(hit.object)?.[hit.instanceId];
        return inst ? { type: 'tet', ...inst } : null;
      },
      onChange: onPyrochloreChange,
    },
    interstitialStore,
    interstitialGroup,
    onInterstitialChange,
    hemisphereStore,
    hemisphereGroup,
    onHemisphereChange,
    canPlaceMaterial,
    getOwnerId: () => LOCAL_PLAYER_ID,
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
    rebuildBCCInstances(bccMesh, bccWorld);
    updateSectionEnabled(); // keeps bccMesh's own material in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    persist(bccWorld.toJSON(), BCC_STORAGE_KEY);
  }

  // Elongated Dodecahedron build: own change handler, same reasoning as
  // onBCCChange above. No "never truly empty" invariant here -- see
  // elongDodecaWorld's own construction comment above for why it doesn't
  // need one (the main FCC world, which DOES enforce that invariant via
  // seedIfWorldEmpty(), is always a valid bootstrap surface for it).
  function onElongDodecaChange() {
    if (latticeQuickViewMode === 'elongdodeca') rebuildLatticeQuickView();
    rebuildElongDodecaInstances(elongDodecaMesh, elongDodecaWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    persist(elongDodecaWorld.toJSON(), ELONGDODECA_STORAGE_KEY);
  }

  // Hex Prism build: own change handler. "Never truly empty" invariant
  // (see hexPrismWorld's own construction comment above for why this
  // one specifically needs it, unlike elongDodecaWorld).
  function onHexPrismChange() {
    if (latticeQuickViewMode === 'hexprism') rebuildLatticeQuickView();
    rebuildHexPrismInstances(hexPrismMesh, hexPrismWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    persist(hexPrismWorld.toJSON(), HEXPRISM_STORAGE_KEY);
  }

  // 2D lattice tier: ONE generic change handler for every primitive,
  // replacing the old onSquare2dChange/onHexagon2dChange/
  // onTriangle2dChange trio -- same "never truly empty" invariant.
  // Phase 6: keyed by primitiveId alone (not a combo id) -- re-renders
  // at the CURRENTLY toggled angle (currentLattice2dAngleDeg), same as
  // applyLattice2dSelection does on a toggle click, so a click-driven
  // change and a toggle-driven change never disagree about what angle
  // the structure should be shown at.
  function onLattice2dChange(primitiveId) {
    const world = lattice2dWorlds.get(primitiveId);
    rebuildLattice2dInstances(lattice2dMeshes.get(primitiveId), world, primitiveId, currentLattice2dAngleDeg(), activeLattice2dArrangementId, lattice2dCompanionMeshes.get(primitiveId), lattice2dClassMeshes.get(primitiveId));
    updateFirstPlacementTarget();
    updateSectionEnabled();
    applyWorldViewMaterials();
    persist(world.toJSON(), lattice2dStorageKey(primitiveId));
  }

  // Rhombohedra build (free lattice): own change handler, same "never
  // truly empty" invariant.
  function onPyrochloreChange() {
    if (latticeQuickViewMode === 'pyrochlore') rebuildLatticeQuickView();
    rebuildPyrochloreInstances(pyrochloreTTMeshes, pyrochloreTetMeshes, pyrochloreWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    if (worldViewMode === 'skeleton') rebuildWorldViewSkeleton();
    persist(pyrochloreWorld.toJSON(), PYROCHLORE_STORAGE_KEY);
  }

  function onRhombohedraChange() {
    if (latticeQuickViewMode === 'rhombohedra') rebuildLatticeQuickView();
    rebuildRhombohedraInstances(rhombohedraMesh, rhombohedraWorld);
    updateSectionEnabled();
    applyWorldViewMaterials();
    persist(rhombohedraWorld.toJSON(), RHOMBOHEDRA_STORAGE_KEY);
  }

  // Interstitial-lattice build: own change handler, same reasoning as
  // onBCCChange above (Rhombeometry-only, no World Systems pipeline).
  function onInterstitialChange() {
    // Same invariant again -- bootstrapDisphenoid([0,0,0]) is the exact
    // same canonical anchor disphenoid every fresh interstitial build
    // already starts from (interstitial-lattice.js's own sanity gate
    // uses this same anchor), not a special case invented here.
    rebuildInterstitialMeshes(interstitialStore);
    updateSectionEnabled(); // keeps newly created interstitial mesh materials in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    persist(interstitialStore.toJSON(), INTERSTITIAL_STORAGE_KEY);
  }

  // Hemisphere pieces: own change handler, same reasoning as onBCCChange/
  // onInterstitialChange above -- no "never truly empty" seed needed, see
  // this store's own construction comment above.
  function onHemisphereChange() {
    rebuildHemisphereMeshes(hemisphereStore);
    updateSectionEnabled(); // keeps newly created hemisphere mesh materials in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    persist(hemisphereStore.toJSON(), HEMISPHERE_STORAGE_KEY);
  }
  // Cuboctahedron Build: own change handler, same "never truly empty"
  // reasoning as onBCCChange/onInterstitialChange above.
  function onCuboctaChange() {
    rebuildCuboctaInstances(cuboctaMesh, cuboctaWorld);
    updateSectionEnabled(); // keeps cuboctaMesh's own material in sync with X-Ray -- see that function's own header
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    persist(cuboctaWorld.toJSON(), CUBOCTA_STORAGE_KEY);
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
    isActive: () => currentMode === 'cubocta' && FEATURES.bccLattice,
  });

  // Cuboctahedron gap-octahedron Build: own change handler -- genuinely
  // optional/manually placed, so unlike onCuboctaChange there is no
  // "never truly empty" seeding here.
  function onOctGapChange() {
    rebuildOctGapInstances(octGapMesh, octGapWorld);
    updateSectionEnabled();
    applyWorldViewMaterials(); // same reasoning -- see World View's own header
    persist(octGapWorld.toJSON(), CUBOCTA_GAP_STORAGE_KEY);
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
      (currentMode === 'build' || currentMode === 'chisel') &&
      FEATURES.bccLattice &&
      document.getElementById('piece-type-select')?.value === 'octahedron',
  });

  // The old 2D radial menu (wheel.js) was removed 2026-08-25 -- the
  // Rhombic Wheel 3D is now the sole navigation surface, per direct
  // user decision.
  // createWheelPickers keeps the real material/generator/species
  // picker overlays and the drag-placement toggle alive independent of
  // either wheel's own UI -- these are used directly by the 3D wheel.
  const pickers = createWheelPickers({
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
    // 2D lattice tier: one loop over every primitive, replacing the old
    // Square/Hexagon/Triangle hand-written trio -- same "fresh start
    // clears it too" reasoning as every store above.
    LATTICE_PRIMITIVES.forEach((primitive) => {
      clearLocalStorage(lattice2dStorageKey(primitive.id));
      lattice2dWorlds.get(primitive.id).replaceAll({ worldName: `2D Lattice (${primitive.label})`, version: 1, cells: {}, meta: {} });
      onLattice2dChange(primitive.id);
    });
    clearLocalStorage(RHOMBOHEDRA_STORAGE_KEY);
    rhombohedraWorld.replaceAll({ worldName: 'Rhombohedra Lattice', version: 1, cells: {}, meta: {} });
    onRhombohedraChange();
    clearLocalStorage(PYROCHLORE_STORAGE_KEY);
    pyrochloreWorld.replaceAll({ worldName: 'Pyrochlore Lattice', version: 1, cells: {}, meta: {} });
    onPyrochloreChange();
    // "Erase everything" includes the 4D world (it was left untouched).
    world4d?.clear();
    for (const w of qcWorlds.values()) w.clear();
    shellsWorld?.clear();
    goldenWorld?.clear();
    kaleidoWorld?.clear();
  }
  document.getElementById('new-world').addEventListener('click', clearWorldToNew);
  document.getElementById('clear-world-toggle')?.addEventListener('click', clearWorldToNew);
  document.getElementById('reload-toggle')?.addEventListener('click', () => {
    location.reload();
  });

  // Export / Import World: every dimension in one file -- all the stores
  // the undo history knows (every 3D lattice, the 2D tiles, the 4D world).
  // Import also accepts an older single-world file (the main FCC world
  // only). An import is one undo step.
  document.getElementById('export-json').addEventListener('click', () => {
    const stores = {};
    for (const [key, { get }] of historyRestorers) stores[key] = get();
    exportWorldFile({ app: 'rhombiverse', format: 'world-bundle', version: 1, exportedAt: new Date().toISOString(), stores });
  });

  const importInput = document.getElementById('import-json');
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const parsed = await importWorldFile(file);
      if (parsed?.format === 'world-bundle' && parsed.stores && typeof parsed.stores === 'object') {
        let loaded = 0;
        for (const [key, json] of Object.entries(parsed.stores)) {
          const entry = historyRestorers.get(key);
          if (!entry || !json) continue;
          entry.restore(json);
          loaded++;
        }
        if (!loaded) throw new Error('no known stores in bundle');
        showHudPrompt('World imported.', 2500);
      } else {
        if (!parsed?.cells) throw new Error('not a World file');
        world.replaceAll(parsed);
        onChange();
      }
    } catch (err) {
      alert('That file is not valid Rhombiverse world JSON.');
      console.warn('Rhombiverse: import failed', err);
    } finally {
      importInput.value = '';
    }
  });

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

const hudDimEl = document.getElementById('hud-dim');
function animate() {
  requestAnimationFrame(animate);
  // The dimension beside Wizard (a cheap per-frame check: several paths
  // change activeDimension; not yet chosen means the default 3D world).
  if (hudDimEl && hudDimEl.textContent !== (activeDimension ?? '3D')) hudDimEl.textContent = activeDimension ?? '3D';
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
    renderer.render(scene, camera);
  }
  // Always renders, regardless of the modal wheel's open state -- it's
  // a persistent HUD element, not something that should disappear
  // while other UI is open.
  hudWheel.render();
}

init();
animate();
