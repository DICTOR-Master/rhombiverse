// Three.js scene, camera, RD mesh generation, instanced rendering, and most
// app orchestration. See RHOMBIVERSE_PLAN.md section 4 for the phase history.
// Full design rationale/history for the code below: docs/code-notes/render.md
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, cellToWorld, parseCellKey, nearestValidCell, isValidCell, cellKey, pyramidPieces, cellsInShells } from './core/lattice.js';
import { FULL_PYRAMIDS, presentAxisKeys } from './core/pyramid.js';
import { createRhombicWheel3D } from './app/rhombic-wheel-3d.js';
import { getDual, DUAL_DIRS, snapToDual } from './core/dual.js';
import { generateBCCLatticePatch, bccDetailVertsFor, bccShapeScaleFor } from './geometry-extensions/bcc-detail-lattice.js';
import { truncatedOctahedronVertices, nearestBCCPoints, nearestFCCPoints, BCC_NEIGHBOR_OFFSETS, isBCC } from './geometry-extensions/dual-lattice.js';
import { createBCCBuildController } from './core/bcc-build.js';
import { createInterstitialStore } from './core/interstitial-build.js';
import { bootstrapDisphenoid } from './geometry-extensions/interstitial-lattice.js';
import { SKELETON_COLOR } from './app/rhombic-wheel-3d-core.js';
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
  scaleVerticesAroundOrigin,
  dominantSpecies,
  speckleCountForBiomass,
  AGGREGATE_MAX_SPECKLES,
} from './geometry-extensions/latticezoom.js';
import { loadWorld, createWorldStore, setRegionsIntegration as setWorldstateRegionsIntegration } from './core/worldstate-core.js';
import { createBuildController, removeShell, recolorShell } from './core/build.js';
import { generatePlanetoid } from './geometry-extensions/planetoidgen.js';
import { getSettings, updateSettings, onSettingsChange, QUALITY_PIXEL_RATIO_FACTOR, QUALITY_LEVELS_ASCENDING } from './app/settings.js';
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
  setRegionsIntegration as setSculptureRegionsIntegration,
} from './core/sculpture.js';
import { matchNeighborOffset } from './core/build.js';
import { computePlanetoids, gravityAt, nearestPlanetoid, setRegionsIntegration as setGravityRegionsIntegration } from './geometry-extensions/gravity.js';
import { createPlayerController } from './app/player.js';
import { saveCameraState, loadCameraState } from './app/camera-persistence.js';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  exportWorldFile,
  importWorldFile,
  BCC_STORAGE_KEY,
  INTERSTITIAL_STORAGE_KEY,
} from './core/persistence.js';
import {
  ensureAnonymousSession,
  loadSharedWorld,
  pushCellUpsert,
  pushCellDelete,
  pushClaim,
  pushClaimDestructible,
  pushRegrowthSet,
  pushRegrowthClear,
  subscribeToSharedWorld,
  setSyncErrorHandler,
  mineAsteroidCellRemote,
  pushTradePropose,
  pushTradeConfirm,
  pushTradeCancel,
  pushSeedSet,
  pushSeedClear,
  publishToGallery,
  fetchGalleryWorlds,
  fetchGalleryWorldData,
  subscribeToPresence,
  updatePresence,
} from './app/sync.js';
// trade.js's proposeTrade/confirmTrade/cancelTrade are NOT imported here --
// local play has no second player identity; sync.js's server-backed
// versions are used instead while Shared World is connected.
// applyInventoryDecay/checkAchievements/applyHydrosphere/animals.js's
// exports are also not statically imported -- flag-gated (FEATURES),
// loaded via dynamic import() in init(), see docs/code-notes/render.md.
import {
  compressionSupported,
  encodeWorldForUrl,
  decodeWorldFromUrl,
  buildShareUrl,
  getSharedWorldParam,
  clearSharedWorldParam,
} from './app/worldshare.js';
import { GROWTH_TEMPLATES, plantSeed, applyGrowth, tileWorldVertices, pruneTile, VALID_TRIPLES, unitTileVertices } from './geometry-extensions/growth.js';
import {
  createCultivationSession,
  proposeCultivationSite,
  acceptCultivationSuggestion,
  dismissCultivationSuggestion,
  requestCultivationIntent,
  executeCultivationIntent,
} from './geometry-extensions/cultivation.js';
import {
  GENOME_TRAIT_RANGES,
  plantOrganism,
  resolveCatchUpForAllPlanetoids,
  averageTraitValue,
  planetoidKeyFor,
  localBiomassAvailability,
} from './game-systems/evolution.js';
// Inert defaults for the dynamically-loaded World Systems bindings above.
let applyInventoryDecay = () => {};
let checkAchievements = () => [];
let applyHydrosphere = () => {};
let LAND_CREATURE_SPECIES, SEA_CREATURE_SPECIES, ANIMAL_TRAIT_RANGES;
let plantAnimal, animalGenerationStepHook, reproduceFn, computeAnimalSurvivalProbability;
// Mining/hazards/claims inert defaults (Migration Path Phase A) -- see
// docs/code-notes/render.md.
let seedAsteroidBelts = () => {};
let applyAsteroidRegeneration = () => {};
let applyPopulationScaledSpawning = () => {};
let listBelts = () => [];
let mineAsteroidCell = () => {};
let computeClaim = () => { throw new Error('computeClaim called with FEATURES.economy off -- the Claim Land button should be disabled/hidden, see setClaimLandEnabled'); };
let claimFootprintWorldVertices = () => [];
let claimIdAt = () => null;
let isClaimProtected = () => false;
let applyBlackHoleConsumption = () => {};
let applyAsymptoticGeneration = () => {};
let annotateBlackHoles = (planetoids) => planetoids;
let applyStarFusion = () => {};
let annotateStars = (planetoids) => planetoids;
let canPlaceForStars = () => true;
let applyDetonationCheck = () => {};
let annotateSupernovae = (planetoids) => planetoids;

const SCALE = 1;
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

let syncWarningTimer = null;
function showSyncWarning(error) {
  const el = document.getElementById('sync-warning');
  if (!el) return;
  const errorMessage = error?.message ?? '';
  const message = /budget exceeded/i.test(errorMessage)
    ? "You're building faster than Shared World allows right now -- some changes may not have saved. It refills over time; slow down a bit."
    : /asteroid cell at that position/i.test(errorMessage)
      ? "That rock is already gone -- someone else may have mined it first."
      : "Some changes aren't reaching Shared World (connection issue) -- they may not be saved for other players.";
  el.textContent = `⚠ ${message}`;
  el.style.display = 'block';
  clearTimeout(syncWarningTimer);
  syncWarningTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 6000);
}
setSyncErrorHandler(showSyncWarning);

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
// below, which runs at module-eval time before init() (and wheel3D) exist --
// same pattern as tickPresenceFn further down this file.
let refreshWheel3D = () => {};

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
// itself from controls.target (see rebuildBCCLatticeDetail's own
// refPos), so with no restore here, toggling BCC back on next session
// always reseeded from the DEFAULT (0,0,0) view rather than wherever you
// were actually standing/looking when you last built against it -- the
// two would drift apart with no way to tell why. Doesn't touch
// scheduleBCCRefresh's deliberate live camera-follow while BCC stays
// toggled on within a session -- that's a separate, already-requested
// behavior (see that function's own header) and this doesn't change it.
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

// Settings panel (B1, behind the Lab entry point) -- applies live, no
// page reload needed. Quality only affects pixel ratio for now (WebGL
// antialiasing can't be toggled after the renderer is created).
onSettingsChange((s) => {
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  controls.rotateSpeed = s.sensitivity;
  renderer.setPixelRatio(window.devicePixelRatio * QUALITY_PIXEL_RATIO_FACTOR[s.quality]);
  document.getElementById('fps-meter')?.classList.toggle('visible', s.showFPSMeter);
});

// Walk mode (RHOMBIVERSE_PLAN.md Phase 5.5) state, module-level since
// both init() (which creates `player` once the world is loaded) and
// animate() (the top-level render loop) need it. `planetoids` is derived
// from world-state and recomputed in onChange() -- see gravity.js.
let walking = false;
let player = null;
// Assigned inside init() once updateHudIndicator exists there -- enterWalk/
// exitWalk are module-level (defined before init()) but still need to
// refresh the HUD's mode/material indicator on every Explore transition.
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
  hudPromptTimer = setTimeout(() => el.classList.remove('visible'), ms);
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
let planetoids = {};
// Mirrors world.getClaims(), same module-level pattern as planetoids
// above -- gravityAt() (RHOMBIVERSE_SPEC_LOOPHOLES.md section 5) and
// updateGravityInfo() both need it but live outside init()'s scope where
// `world` itself is declared, so it's kept in sync via refreshClaims()
// (inside init()) instead of read from world directly.
let currentClaims = {};
// RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md Stage 9: mirrors
// world.getOrganisms(), same module-level pattern as planetoids/
// currentClaims above -- updateEvolutionInfo() lives outside init()'s
// Refreshed via refreshOrganismsSnapshot -- see docs/code-notes/render.md
let organismsSnapshot = {};

// Shared World (Phase 5) state -- see docs/code-notes/render.md
let sharedWorldActive = false;
let applyingRemote = false;
let unsubscribeShared = null;
let myUserId = null; // this session's anonymous auth.uid(), set on enableSharedWorld
const LOCAL_PLAYER_ID = 'local-player'; // B6: fallback ownerId for solo play, see notes

const DISPLAY_NAME_KEY = 'rhombiverse-display-name';
function loadDisplayName() {
  try {
    const saved = localStorage.getItem(DISPLAY_NAME_KEY);
    if (saved) return saved;
  } catch { /* localStorage unavailable -- fall through to the generated default */ }
  return `Rhombinaut-${Math.floor(1000 + Math.random() * 9000)}`;
}
let displayName = loadDisplayName();

// Other connected players' live presence (B6 task #40/#42).
let otherPlayers = {};
let unsubscribePresence = null;
const avatarLabelEls = new Map(); // userId -> DOM element, pooled across frames
const INTERACT_RADIUS = 6; // world units -- close enough to trade with, same spirit as BELT_DIGGABLE_RADIUS
let nearestInteractPartnerId = null;

function handleLocalAdd(x, y, z, data) {
  if (sharedWorldActive && !applyingRemote) pushCellUpsert(x, y, z, data);
}
function handleLocalRemove(x, y, z) {
  if (sharedWorldActive && !applyingRemote) pushCellDelete(x, y, z);
}
// Push-on-local-mutation, same pattern as cells -- see docs/code-notes/render.md
function handleLocalRegrowthSet(key, entry) {
  if (sharedWorldActive && !applyingRemote) {
    const [x, y, z] = parseCellKey(key);
    pushRegrowthSet(x, y, z, entry);
  }
}
function handleLocalRegrowthClear(key) {
  if (sharedWorldActive && !applyingRemote) {
    const [x, y, z] = parseCellKey(key);
    pushRegrowthClear(x, y, z);
  }
}
// Push-on-local-mutation for seeds too -- see docs/code-notes/render.md
function handleLocalSeedSet(seedId, seedData) {
  if (sharedWorldActive && !applyingRemote) pushSeedSet(seedId, seedData);
}
function handleLocalSeedClear(seedId) {
  if (sharedWorldActive && !applyingRemote) pushSeedClear(seedId);
}

// See docs/code-notes/render.md
function updateGravityInfo() {
  const el = document.getElementById('gravity-info');
  if (!el) return;
  const refPos = walking && player ? player.getPosition() : controls.target;
  const nearest = nearestPlanetoid(refPos, planetoids);
  if (!nearest) {
    el.textContent = 'No planetoid yet — place a Blackstar-Glassite cell to create a gravity source.';
    return;
  }
  const reallyActive = !!gravityAt(refPos, planetoids, currentClaims);
  const status = !nearest.active
    ? 'out of range (build closer to the core, or add more BSG)'
    : reallyActive
      ? 'active'
      : 'blocked — you\'re in a protected claim';
  const hydro = nearest.hydrosphereActive ? ' · hydrosphere+atmosphere active' : '';
  const blackHole = nearest.isBlackHole
    ? ` · BLACK HOLE — ledger ${nearest.consumedMatter} · generated ${nearest.generatedCellCount} cells through shell ${nearest.generatedThroughShell}`
    : '';
  const star = nearest.isStar
    ? ` · STAR — luminosity ${nearest.luminosity.toFixed(1)} · fusion ${nearest.fusionActive ? 'active' : 'idle (needs hydrosphere + Ferrostone)'} · frost line ${nearest.frostLineDistance.toFixed(1)}u` +
      (nearest.detonated ? ` · DETONATED${nearest.isBlackHoleRemnant ? ' (black hole remnant)' : ''}` : ` · mass ${nearest.accumulatedMass}/${nearest.supernovaCriticalMass}`)
    : '';
  el.textContent =
    `Nearest planetoid: gravity ${status} · radius ${nearest.gravityRadius.toFixed(1)}u · ` +
    `${nearest.bsgCount} BSG cell${nearest.bsgCount === 1 ? '' : 's'} · ` +
    `recommended core: ${nearest.coreShellRecommendation} shell${nearest.coreShellRecommendation === 1 ? '' : 's'}${hydro}${blackHole}${star}`;
}

// See docs/code-notes/render.md (Stage 1-7 catch-up engine, Animals wiring)
function resolveEvolution(world, now) {
  const organismIds = Object.keys(world.getOrganisms());
  if (organismIds.length === 0) return false;
  const results = resolveCatchUpForAllPlanetoids(world, organismIds, now, animalGenerationStepHook, reproduceFn, computeAnimalSurvivalProbability);
  return Object.values(results).some((r) => r.generationsResolved > 0);
}

// See docs/code-notes/render.md
function refreshOrganismsSnapshot(world) {
  const seeds = world.getSeeds();
  organismsSnapshot = Object.fromEntries(
    Object.entries(world.getOrganisms()).map(([id, o]) => [id, { ...o, origin: seeds[o.seedId]?.origin }])
  );
}

// See docs/code-notes/render.md
function updateEvolutionInfo() {
  const el = document.getElementById('evolution-info');
  if (!el) return;
  const refPos = walking && player ? player.getPosition() : controls.target;
  const nearest = nearestPlanetoid(refPos, planetoids);
  const allIds = Object.keys(organismsSnapshot);
  if (allIds.length === 0) {
    el.textContent = 'No evolving life yet — Plant an "(evolving)" species to start a real, adapting population.';
    return;
  }
  const key = nearest ? planetoidKeyFor(nearest.centerOfMass) : null;
  const localIds = key
    ? allIds.filter((id) => {
        const origin = organismsSnapshot[id].origin;
        if (!origin) return false;
        const p = nearestPlanetoid({ x: origin[0], y: origin[1], z: origin[2] }, planetoids);
        return p && planetoidKeyFor(p.centerOfMass) === key;
      })
    : [];
  if (localIds.length === 0) {
    el.textContent = 'No evolving life near this planetoid yet.';
    return;
  }
  const bySpecies = {};
  for (const id of localIds) {
    const s = organismsSnapshot[id].species;
    bySpecies[s] = (bySpecies[s] ?? 0) + 1;
  }
  const mix = Object.entries(bySpecies)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ');
  const avgEfficiency = averageTraitValue(
    { getOrganisms: () => organismsSnapshot },
    localIds,
    'resourceEfficiency'
  );
  const avgMutation = averageTraitValue({ getOrganisms: () => organismsSnapshot }, localIds, 'mutationRate');
  const pendingCount = localIds.filter((id) => organismsSnapshot[id].status === 'pending').length;
  el.textContent =
    `Life here: ${mix} · avg resourceEfficiency ${avgEfficiency.toFixed(2)} · avg mutationRate ${avgMutation.toFixed(2)}` +
    (pendingCount > 0 ? ` · ${pendingCount} pending review` : '');
}

// See docs/code-notes/render.md
function updateBeltHint() {
  const el = document.getElementById('belt-hint');
  if (!el) return;
  const refPos = walking && player ? player.getPosition() : controls.target;
  let nearest = null;
  let nearestDist = Infinity;
  for (const belt of listBelts()) {
    const [bx, by, bz] = belt.center;
    const d = Math.hypot(refPos.x - bx, refPos.y - by, refPos.z - bz);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = belt;
    }
  }
  if (!nearest) return;
  el.textContent = `Nearest belt: ${nearest.id} · ${nearestDist.toFixed(0)}u away.`;
  checkBeltApproachTransition(nearest, nearestDist);
}

// B6 belt-approach transition -- see docs/code-notes/render.md
const BELT_APPROACH_RADIUS = 40; // "the lattice becoming apparent"
const BELT_DIGGABLE_RADIUS = 15; // close enough to actually mine
let beltApproachState = 'far'; // 'far' | 'approaching' | 'diggable'
function checkBeltApproachTransition(nearest, dist) {
  if (dist < BELT_DIGGABLE_RADIUS) {
    if (beltApproachState !== 'diggable') {
      showHudPrompt(`${nearest.id}: close enough to mine — right-click an asteroid cell to harvest it.`, 4200);
    }
    beltApproachState = 'diggable';
  } else if (dist < BELT_APPROACH_RADIUS) {
    if (beltApproachState === 'far') {
      showHudPrompt(`${nearest.id} ahead — its lattice structure is becoming visible.`, 4200);
    }
    beltApproachState = 'approaching';
  } else {
    beltApproachState = 'far';
  }
}

// B2 Explore transition sequence -- see docs/code-notes/render.md
const SPACE_BG_COLOR = new THREE.Color(0x05050a);
const WALK_BG_COLOR = new THREE.Color(0x0d1420); // stands in for "horizon change", see notes
const WALK_TRANSITION_MS = 550;
let walkTransitioning = false;

function animateBackground(from, to, duration, onDone) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    scene.background.copy(from).lerp(to, t);
    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  }
  requestAnimationFrame(step);
}

function enterWalk() {
  if (!player || walking || walkTransitioning) return;
  walking = true;
  walkTransitioning = true;
  controls.enabled = false;
  document.body.classList.add('explore-transitioning');
  showHudPrompt('Entering Explore — gravity engaging…', WALK_TRANSITION_MS + 400);
  animateBackground(SPACE_BG_COLOR, WALK_BG_COLOR, WALK_TRANSITION_MS);
  setTimeout(() => {
    document.body.classList.remove('explore-transitioning');
    document.getElementById('walk-toggle').textContent = 'Exit Walk Mode (Esc)';
    document.getElementById('walk-hint').style.display = '';
    document.getElementById('hud-crosshair')?.classList.add('visible');
    setWalkTouchControlsVisible(true);
    player.reset(camera.position);
    player.setEnabled(true);
    player.requestLock();
    walkTransitioning = false;
    window.dispatchEvent(new CustomEvent('rhombiverse:walkModeEntered')); // B6's onboarding discovery sequence
    updateGravityInfo();
    updateBeltHint();
    updateEvolutionInfo();
    refreshHudIndicator();
  }, WALK_TRANSITION_MS);
}

function exitWalk() {
  if (!walking || walkTransitioning) return;
  walking = false;
  walkTransitioning = true;
  if (player) player.setEnabled(false);
  camera.up.set(0, 1, 0);
  document.body.classList.add('explore-transitioning');
  showHudPrompt('Leaving Explore…', WALK_TRANSITION_MS + 400);
  document.getElementById('hud-crosshair')?.classList.remove('visible');
  setWalkTouchControlsVisible(false);
  animateBackground(WALK_BG_COLOR, SPACE_BG_COLOR, WALK_TRANSITION_MS);
  setTimeout(() => {
    document.body.classList.remove('explore-transitioning');
    controls.enabled = true;
    document.getElementById('walk-toggle').textContent = 'Enter Walk Mode';
    document.getElementById('walk-hint').style.display = 'none';
    walkTransitioning = false;
    updateGravityInfo();
    updateBeltHint();
    updateEvolutionInfo();
    refreshHudIndicator();
  }, WALK_TRANSITION_MS);
}

document.getElementById('walk-toggle').addEventListener('click', () => {
  if (walking) exitWalk();
  else enterWalk();
});

// See docs/code-notes/render.md
document.addEventListener('pointerlockchange', () => {
  if (walking && document.pointerLockElement !== renderer.domElement) exitWalk();
});

// Mobile/touch support -- see docs/code-notes/render.md
const IS_TOUCH_PRIMARY = window.matchMedia('(pointer: coarse)').matches;

const walkLookZoneEl = document.getElementById('walk-look-zone');
const walkJoystickEl = document.getElementById('walk-joystick');
const walkJoystickKnobEl = document.getElementById('walk-joystick-knob');
const walkJumpBtnEl = document.getElementById('walk-jump-btn');

function setWalkTouchControlsVisible(visible) {
  if (!IS_TOUCH_PRIMARY) return;
  walkLookZoneEl.classList.toggle('visible', visible);
  walkJoystickEl.classList.toggle('visible', visible);
  walkJumpBtnEl.classList.toggle('visible', visible);
}

if (IS_TOUCH_PRIMARY) {
  const JOYSTICK_RADIUS = 50; // px -- knob travel distance for full-speed input
  let joystickTouchId = null;
  let joystickCenter = { x: 0, y: 0 };

  walkJoystickEl.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    const r = walkJoystickEl.getBoundingClientRect();
    joystickCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, { passive: true });
  walkJoystickEl.addEventListener('touchmove', (e) => {
    const t = [...e.changedTouches].find((t) => t.identifier === joystickTouchId);
    if (!t || !player) return;
    let dx = t.clientX - joystickCenter.x;
    let dy = t.clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    walkJoystickKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    // Screen-down (positive dy) is backward, matching a real joystick's
    // "pull toward you to go back" convention.
    player.setVirtualMove(-dy / JOYSTICK_RADIUS, dx / JOYSTICK_RADIUS);
  }, { passive: true });
  const endJoystickTouch = (e) => {
    if (![...e.changedTouches].some((t) => t.identifier === joystickTouchId)) return;
    joystickTouchId = null;
    walkJoystickKnobEl.style.transform = '';
    player?.setVirtualMove(0, 0);
  };
  walkJoystickEl.addEventListener('touchend', endJoystickTouch);
  walkJoystickEl.addEventListener('touchcancel', endJoystickTouch);

  walkJumpBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    player?.setVirtualKey('Space', true);
  });
  const endJumpTouch = () => player?.setVirtualKey('Space', false);
  walkJumpBtnEl.addEventListener('touchend', endJumpTouch);
  walkJumpBtnEl.addEventListener('touchcancel', endJumpTouch);

  // Drag-to-look -- see docs/code-notes/render.md
  const LOOK_LONG_PRESS_MS = 500;
  const LOOK_MOVE_TOLERANCE = 12; // px
  let lookTouchId = null;
  let lookLastX = 0;
  let lookLastY = 0;
  let lookStartX = 0;
  let lookStartY = 0;
  let lookLongPressTimer = null;
  let lookLongPressFired = false;

  walkLookZoneEl.addEventListener('touchstart', (e) => {
    if (lookTouchId !== null) return; // one look-drag at a time
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lookStartX = lookLastX = t.clientX;
    lookStartY = lookLastY = t.clientY;
    lookLongPressFired = false;
    clearTimeout(lookLongPressTimer);
    lookLongPressTimer = setTimeout(() => {
      lookLongPressFired = true;
      renderer.domElement.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: lookLastX,
        clientY: lookLastY,
      }));
    }, LOOK_LONG_PRESS_MS);
  }, { passive: true });

  walkLookZoneEl.addEventListener('touchmove', (e) => {
    const t = [...e.changedTouches].find((t) => t.identifier === lookTouchId);
    if (!t || !player) return;
    const dx = t.clientX - lookLastX;
    const dy = t.clientY - lookLastY;
    lookLastX = t.clientX;
    lookLastY = t.clientY;
    if (Math.hypot(t.clientX - lookStartX, t.clientY - lookStartY) > LOOK_MOVE_TOLERANCE) {
      clearTimeout(lookLongPressTimer);
    }
    // "Standard mobile-FPS convention": drag right -> look right, same
    // sign as a real mouse's movementX/Y feeding the same applyLookDelta.
    if (!lookLongPressFired) player.lookBy(dx, dy);
  }, { passive: true });

  const endLookTouch = (e) => {
    if (![...e.changedTouches].some((t) => t.identifier === lookTouchId)) return;
    lookTouchId = null;
    clearTimeout(lookLongPressTimer);
  };
  walkLookZoneEl.addEventListener('touchend', endLookTouch);
  walkLookZoneEl.addEventListener('touchcancel', endLookTouch);
}

const labToggleEl = document.getElementById('lab-toggle');
const labPanelEl = document.getElementById('lab-panel');

function closeMobilePanels() {
  labPanelEl.classList.remove('open');
}

labToggleEl.addEventListener('click', () => {
  labPanelEl.classList.toggle('open');
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
const CYBORG_SUGGEST_SYSTEM_PROMPT = `You are a creative building companion for Rhombiverse, a voxel-building game where every block is a rhombic dodecahedron.

Given a short description of what a player has already built, suggest ONE small, concrete, achievable next thing for them to build or plant -- something more interesting than "place another block", but still doable in a few minutes. Name a shape, direction, or technique (e.g. "try a mirrored arch to the east", "plant a conifer near your fern for a mixed grove", "hollow out the center and add windows"). Keep it under 140 characters, friendly, and specific to what they've actually built so far -- don't suggest something they've clearly already done. Never mention that you are an AI.

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

// B6 onboarding sequence -- see docs/code-notes/render.md
const onboardingCyborg = createCyborgMode({
  subscriptUrl: './data/cyborg/onboarding.json',
  panelTitle: 'Welcome — a quick tour',
  getSuggestion: getCyborgSuggestion,
});

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

  // Migration Path Phase C (RHOMBIVERSE_PLAN.md): Rhombeometry mode.
  // features.js reads this flag once, at module-eval time, ahead of
  // this init() ever gating a World Systems import -- there is no live
  // way to flip World Systems on/off mid-session, so this always
  // reloads. Nothing is lost: the current World autosaves to
  // localStorage the same way a manual refresh already preserves it.
  const pureGeometryInput = document.getElementById('setting-pure-geometry');
  const pureGeometryHint = document.getElementById('pure-geometry-hint');
  pureGeometryInput.checked = s.pureGeometry;
  pureGeometryInput.addEventListener('change', () => {
    updateSettings({ pureGeometry: pureGeometryInput.checked });
    pureGeometryHint.style.display = '';
    setTimeout(() => window.location.reload(), 400);
  });

  // Model vs. World Separation (reframe Stage 2): unlike pureGeometry
  // above, this is a live, no-reload toggle -- workspaceMode is read
  // fresh by the 5s simulation tick (see init()'s setInterval) on its
  // very next firing, not just at module-eval time.
  const workspaceModeInput = document.getElementById('setting-workspace-mode');
  workspaceModeInput.checked = workspaceMode === 'model';
  workspaceModeInput.addEventListener('change', () => {
    workspaceMode = workspaceModeInput.checked ? 'model' : 'world';
    refreshWheel3D();
    showHudPrompt(
      workspaceMode === 'model'
        ? 'Model workspace: simulation frozen (growth, ecosystem/animal catch-up, asteroid regrowth, inventory decay all paused). Geometry and material tools stay available.'
        : 'World workspace: simulation resumed.',
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

// See docs/code-notes/render.md
// emerald/gold added 2026-08-29, direct request -- buildable colors
// only (deliberately NOT wired into asteroids.js's YIELD_WEIGHTS,
// trade.js's FREE_THRESHOLDS, TRADE_MATERIALS, or planetoidgen.js's
// body recipes -- those are real tunable economy-balance constants,
// not something to invent numbers for without being asked). gold
// reuses hud-wheel-3d.js's own GOLD constant (0xd4af37) verbatim for
// visual consistency with the one other "gold" already in this app.
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
};

function materialColor(material) {
  return new THREE.Color(MATERIAL_COLORS[material] ?? MATERIAL_COLORS.base);
}

// See docs/code-notes/render.md
const SPECIES_COLORS = {
  amoeba: 0x9fd8a0,
  moss: 0x4f7a3f,
  fungus: 0xd9b26b,
  fern: 0x2f6b3a,
  sapling: 0x6fae4f,
  conifer: 0x1f4a28,
  shrub: 0x7a8f3f,
  nautilus: 0xe8dcc0,
  scallop: 0xe0a598,
  spineling: 0xc9b896,
  'cluster-frame': 0x8a8f99,
  amoeba_evolved: 0x6ee7b7,
  plant_evolved: 0x86efac,
  landCreature_evolved: 0xd4a574,
  seaCreature_evolved: 0x0e7490,
};

const LANDSCAPE_WEATHERED_COLOR = new THREE.Color(0x8b6f47); // see docs/code-notes/render.md

// See docs/code-notes/render.md
const ORGANISM_SEED_SPECIES_PREFIX = 'organism:';
function speciesColor(species) {
  if (species.startsWith(ORGANISM_SEED_SPECIES_PREFIX)) {
    const base = species.slice(ORGANISM_SEED_SPECIES_PREFIX.length);
    return new THREE.Color(SPECIES_COLORS[`${base}_evolved`] ?? SPECIES_COLORS[base] ?? 0xffffff);
  }
  return new THREE.Color(SPECIES_COLORS[species] ?? 0xffffff);
}

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
  return cell.pyramids !== undefined && cell.pyramids !== FULL_PYRAMIDS;
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

function rebuildPartialCellMeshes(world, inReportMode = false) {
  const source = inReportMode ? world.entries() : world.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed');
  const wanted = new Map();
  for (const cell of source) {
    if (isPartialCell(cell)) wanted.set(cellKey(cell.x, cell.y, cell.z), cell);
  }
  for (const [key, entry] of partialCellMeshes) {
    if (!wanted.has(key)) {
      partialCellGroup.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
      partialCellMeshes.delete(key);
    }
  }
  for (const [key, cell] of wanted) {
    const existing = partialCellMeshes.get(key);
    if (existing && existing.cell.pyramids === cell.pyramids && existing.cell.material === cell.material
        && existing.cell.status === cell.status && existing.cell.shell === cell.shell) {
      existing.cell = cell; // cheap fields (e.g. shellCenter) may still have changed
      continue;
    }
    if (existing) {
      partialCellGroup.remove(existing.mesh);
      existing.mesh.geometry.dispose();
      existing.mesh.material.dispose();
    }
    const geom = buildPartialCellGeometry(cell.pyramids);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.55, flatShading: true });
    mat.color.copy(instanceColorFor(cell));
    const m = new THREE.Mesh(geom, mat);
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.position.set(wx, wy, wz);
    m.userData.cellKey = key;
    partialCellGroup.add(m);
    partialCellMeshes.set(key, { mesh: m, cell });
  }
}

// BCC dual-lattice build's own instance list -- deliberately a SEPARATE
// module-level array from cellOrder above, not a second call into
// rebuildInstances() reusing it: rebuildInstances() overwrites the
// shared `cellOrder` variable that the main FCC build controller's own
// cellAt(instanceId) callback reads, so routing BCC cells through it
// would corrupt the main world's own hit-testing. See core/bcc-build.md.
let bccCellOrder = []; // instanceId -> {x, y, z, ...cellData}
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

// World Systems dynamic imports -- see docs/code-notes/render.md
async function init() {
  if (FEATURES.achievements) {
    ({ checkAchievements } = await import('./game-systems/achievements.js'));
  }
  if (FEATURES.economy) {
    ({ applyInventoryDecay } = await import('./game-systems/trade.js'));
    ({ computeClaim, claimFootprintWorldVertices, claimIdAt, isClaimProtected } = await import('./game-systems/regions.js'));
  }
  if (FEATURES.hydrosphere) {
    ({ applyHydrosphere } = await import('./game-systems/hydrosphere.js'));
  }
  if (FEATURES.animals) {
    ({
      LAND_CREATURE_SPECIES,
      SEA_CREATURE_SPECIES,
      ANIMAL_TRAIT_RANGES,
      plantAnimal,
      animalGenerationStepHook,
      reproduceFn,
      computeAnimalSurvivalProbability,
    } = await import('./game-systems/animals.js'));
  }
  if (FEATURES.mining) {
    ({ seedAsteroidBelts, applyAsteroidRegeneration, applyPopulationScaledSpawning, listBelts, mineAsteroidCell } = await import('./game-systems/asteroids.js'));
  }
  if (FEATURES.hazards) {
    ({ applyBlackHoleConsumption, applyAsymptoticGeneration, annotateBlackHoles } = await import('./game-systems/blackhole.js'));
    ({ applyStarFusion, annotateStars, canPlaceMaterial: canPlaceForStars } = await import('./game-systems/starsystem.js'));
    ({ applyDetonationCheck, annotateSupernovae } = await import('./game-systems/supernova.js'));
  }
  // Regions-integration wiring (Migration Path Phase A) -- see docs/code-notes/render.md
  if (FEATURES.economy) {
    setSculptureRegionsIntegration({ claimIdAt, isClaimProtected });
    setWorldstateRegionsIntegration({ claimIdAt });
    setGravityRegionsIntegration({ isClaimProtected });
  }

  wireFirstUseHint('duality-toggle', 'Duality: shows this structure\'s aperiodic shadow -- the tiling it casts, not the block shape itself.');
  wireFirstUseHint('bcc-toggle', 'Lattice View: click to cycle five lenses on your World and its dual BCC/truncated-octahedron lattice -- FCC only, TO only, both differentiated, FCC ghosted, or TO ghosted.');
  wireFirstUseHint('clear-world-toggle', 'Clear World: erase everything and start fresh from a single seed cell.');
  wireFirstUseHint('reload-toggle', 'Reload: hard-refresh the app if anything looks stuck or stale.');
  wireFirstUseHint('sculpture-mode-toggle', 'Sculpture Mode: a separate, isolated scratch workspace -- nothing here touches your real World.');
  wireFirstUseHint('cyborg-toggle', 'Cyborg Mode: a guided walkthrough, step by step.');
  wireFirstUseHint('xray-toggle', 'X-Ray: drag a cutaway plane through the structure to see inside it.');
  wireFirstUseHint('lab-toggle', 'Lab: advanced settings and tools live here.');
  // Moved from the welcome card's own quickstart line -- see docs/code-notes/render.md
  wireFirstUseHint('hud-wheel-cue', 'Tab / Space (or tap Menu) opens the Rhombic Wheel -- build, sculpt, grow, and more, all from here.');
  wireFirstUseHint('export-json', 'Export your World anytime to keep a copy.');

  // World load priority (shared link / saved / Showcase World) -- see docs/code-notes/render.md
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
  const isFirstVisit = !sharedWorldJSON && !savedJSON;
  let worldJSON;
  if (sharedWorldJSON) {
    worldJSON = sharedWorldJSON;
  } else if (savedJSON) {
    worldJSON = savedJSON;
  } else if (getSettings().pureGeometry) {
    // Rhombeometry's first-visit experience is geometry-only, full stop --
    // no pre-built World, no game-flavored tour (both of those are Full
    // Game World content, see onboardingCyborg.enable() below). Direct
    // user decision 2026-08-28: the mode choice on the welcome screen
    // ("geometry comes first") was silently undone the moment the world
    // itself loaded, since this branch used to run unconditionally
    // regardless of pureGeometry -- every first-time Rhombeometry visitor
    // was actually dropped into the same Showcase World + tour as Full
    // Game World, no different first look at all.
    worldJSON = await loadWorld('./data/starter-world.json');
  } else {
    try {
      worldJSON = await loadWorld('./data/presets/showcase-world.json');
    } catch (err) {
      console.warn('Rhombiverse: failed to load the Showcase World for first visit, falling back to a generated starter planetoid', err);
      worldJSON = await loadWorld('./data/starter-world.json');
      worldJSON.cells = {};
    }
  }
  const world = createWorldStore(worldJSON, {
    onAdd: handleLocalAdd,
    onRemove: handleLocalRemove,
    onRegrowthSet: handleLocalRegrowthSet,
    onRegrowthClear: handleLocalRegrowthClear,
    onSeedSet: handleLocalSeedSet,
    onSeedClear: handleLocalSeedClear,
  });
  cyborgWorldRef = world;
  if (isFirstVisit && world.entries().length === 0) {
    generatePlanetoid(world, 'rocky', 0, 0, 0, 2); // only reached if the Showcase World fetch above failed
  }
  if (sharedWorldJSON) {
    saveToLocalStorage(world.toJSON());
    showHudPrompt('Loaded a shared World from your link.', 5000);
  }
  // Every step of this tour narrates Full Game World content (an
  // "already-built World," pre-seeded "growing life", Explore framed as
  // walking around "yours and everyone else's") -- none of it true for
  // Rhombeometry's actual first-visit world (a single blank cell, no
  // organisms, no other players). Direct user decision 2026-08-28: no
  // tour at all for a first-time Rhombeometry visitor, rather than
  // narrating content that isn't there.
  if (isFirstVisit && !getSettings().pureGeometry) onboardingCyborg.enable();
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

  // Lattice Zoom Stage 5 -- Ecosystem Rendering -- see docs/code-notes/render.md
  const organismMiniGroup = new THREE.Group();
  scene.add(organismMiniGroup);
  const MAX_NEARBY_ORGANISMS = 20;

  const aggregateSpeckleScale = level2Scale * 0.4;
  const aggregateSpeckleGeometry = buildRDGeometry(aggregateSpeckleScale);
  const aggregateSpeckleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, // identity multiplier -- real color comes entirely from setColorAt, same pattern as the top-level `mesh`
    metalness: 0.1,
    roughness: 0.7,
    flatShading: true,
  });
  const aggregateSpeckleMesh = new THREE.InstancedMesh(
    aggregateSpeckleGeometry,
    aggregateSpeckleMaterial,
    MAX_NEARBY_SUBLATTICE_CELLS * AGGREGATE_MAX_SPECKLES
  );
  aggregateSpeckleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  aggregateSpeckleMesh.count = 0;
  scene.add(aggregateSpeckleMesh);
  const aggregateSpeckleDummy = new THREE.Object3D();

  // See docs/code-notes/render.md
  function writeBlendedInstance(mesh, idx, worldPosition, blend) {
    subLatticeDummy.position.set(...worldPosition);
    subLatticeDummy.scale.setScalar(blend);
    subLatticeDummy.updateMatrix();
    mesh.setMatrixAt(idx, subLatticeDummy.matrix);
  }

  // See docs/code-notes/render.md
  function refreshOrganismMiniatures(refPos) {
    while (organismMiniGroup.children.length > 0) {
      const group = organismMiniGroup.children[0];
      organismMiniGroup.remove(group);
      for (const child of group.children) {
        child.geometry.dispose();
        child.material.dispose();
      }
    }
    const items = Object.values(organismsSnapshot)
      .filter((o) => o.origin)
      .map((o) => ({ worldPosition: o.origin, seedId: o.seedId }));
    const chosen = selectNearbyByWorldPosition(
      items,
      refPos,
      SUB_LATTICE_TRIGGER_DISTANCE + SUB_LATTICE_BLEND_WIDTH,
      MAX_NEARBY_ORGANISMS
    );
    const baseFactor = subScaleFactor(SUB_LATTICE_MAX_SHELL);
    for (const item of chosen) {
      const blend = blendFactor(item.d, SUB_LATTICE_TRIGGER_DISTANCE, SUB_LATTICE_BLEND_WIDTH);
      if (blend <= 0) continue; // degenerate (every vertex would collapse onto origin) -- skip rather than build a zero-size hull
      const seed = world.getSeeds()[item.seedId];
      if (!seed) continue;
      const factor = baseFactor * blend;
      const color = speciesColor(seed.species);
      const group = new THREE.Group();
      for (const tile of seed.tiles) {
        const verts = scaleVerticesAroundOrigin(tileWorldVertices(seed, tile), seed.origin, factor).map(
          ([x, y, z]) => new THREE.Vector3(x, y, z)
        );
        const geometry = new ConvexGeometry(verts);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        group.add(new THREE.Mesh(geometry, material));
      }
      organismMiniGroup.add(group);
    }
  }

  // See docs/code-notes/render.md
  function refreshSubLattice() {
    const camPos = walking && player ? player.getPosition() : camera.position;
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
    let speckleIdx = 0;
    const level1Cells = [];
    const organismList = Object.values(organismsSnapshot);
    for (const parent of chosen) {
      const blend = blendFactor(parent.d, SUB_LATTICE_TRIGGER_DISTANCE, SUB_LATTICE_BLEND_WIDTH);
      const subCells = generateSubLattice(parent.x, parent.y, parent.z, SUB_LATTICE_MAX_SHELL, SCALE);
      for (const sub of subCells) {
        writeBlendedInstance(subLatticeMesh, idx, sub.worldPosition, blend);
        idx++;
        level1Cells.push(sub);
      }

      const parentWorldPos = cellToWorld(parent.x, parent.y, parent.z, SCALE);
      const biomass = localBiomassAvailability(world, parentWorldPos, Object.keys(organismsSnapshot));
      const speckleCount = Math.min(speckleCountForBiomass(biomass), subCells.length);
      if (speckleCount > 0) {
        const nearbyForColor = organismList.filter((o) => {
          if (!o.origin) return false;
          const d = Math.hypot(o.origin[0] - parentWorldPos[0], o.origin[1] - parentWorldPos[1], o.origin[2] - parentWorldPos[2]);
          return d <= SUB_LATTICE_TRIGGER_DISTANCE;
        });
        const dominant = dominantSpecies(nearbyForColor);
        const speckleColor = speciesColor(dominant ? `${ORGANISM_SEED_SPECIES_PREFIX}${dominant}` : 'plant');
        const nearestForLandscape = nearestPlanetoid({ x: parentWorldPos[0], y: parentWorldPos[1], z: parentWorldPos[2] }, planetoids);
        const landscapeState = nearestForLandscape
          ? world.getPlanetoidEvolution()[planetoidKeyFor(nearestForLandscape.centerOfMass)]?.landscapeState ?? 0
          : 0;
        speckleColor.lerp(LANDSCAPE_WEATHERED_COLOR, landscapeState);
        for (let i = 0; i < speckleCount; i++) {
          aggregateSpeckleDummy.position.set(...subCells[i].worldPosition);
          aggregateSpeckleDummy.scale.setScalar(blend);
          aggregateSpeckleDummy.updateMatrix();
          aggregateSpeckleMesh.setMatrixAt(speckleIdx, aggregateSpeckleDummy.matrix);
          aggregateSpeckleMesh.setColorAt(speckleIdx, speckleColor);
          speckleIdx++;
        }
      }
    }
    aggregateSpeckleMesh.count = speckleIdx;
    aggregateSpeckleMesh.instanceMatrix.needsUpdate = true;
    if (aggregateSpeckleMesh.instanceColor) aggregateSpeckleMesh.instanceColor.needsUpdate = true;
    aggregateSpeckleMesh.computeBoundingSphere();
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

    refreshOrganismMiniatures(refPos);
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

  // See docs/code-notes/render.md
  const claimGroup = new THREE.Group();
  scene.add(claimGroup);
  const CLAIM_COLOR_MINE = 0x4ade80; // green -- this session's own claims
  const CLAIM_COLOR_OTHER = 0xf59e0b; // amber -- everyone else's

  // See docs/code-notes/render.md
  const growthGroup = new THREE.Group();
  scene.add(growthGroup);
  const growthMeshesBySeed = new Map(); // seedId -> THREE.Group

  seedAsteroidBelts(world);
  applyAsteroidRegeneration(world);
  applyPopulationScaledSpawning(world);
  applyInventoryDecay(world);
  applyHydrosphere(world);
  applyBlackHoleConsumption(world);
  applyAsymptoticGeneration(world);
  applyStarFusion(world);
  applyDetonationCheck(world);
  rebuildInstances(mesh, world);

  planetoids = computePlanetoids(world);
  planetoids = annotateBlackHoles(planetoids, world);
  planetoids = annotateStars(planetoids, world);
  planetoids = annotateSupernovae(planetoids);
  player = createPlayerController({
    camera,
    domElement: renderer.domElement,
    getGravity: (pos) => gravityAt(pos, planetoids, currentClaims),
  });
  updateGravityInfo();
  updateBeltHint();
  updateInventoryHint();
  renderTradePanel();
  rebuildAllGrowth();

  // Pre-interactivity catch-up -- see docs/code-notes/render.md
  if (!sharedWorldActive && Object.keys(world.getOrganisms()).length > 0) {
    if (resolveEvolution(world, Date.now())) rebuildAllGrowth();
    saveToLocalStorage(world.toJSON());
  }
  refreshOrganismsSnapshot(world);
  updateEvolutionInfo();

  // See docs/code-notes/render.md
  const beltNavRow = document.getElementById('belt-nav-row');
  for (const belt of listBelts()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `Go to ${belt.id.replace('_', ' ')}`;
    btn.addEventListener('click', () => {
      if (walking) exitWalk();
      const [bx, by, bz] = belt.center;
      camera.position.set(bx + 6, by + 5, bz + 8);
      controls.target.set(bx, by, bz);
      updateGravityInfo();
      updateBeltHint();
      updateEvolutionInfo();
    });
    beltNavRow.appendChild(btn);
  }

  // Undo stack -- see docs/code-notes/render.md
  const undoStack = [];
  const MAX_UNDO = 20;
  let lastSnapshot = JSON.stringify(world.toJSON());

  function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    btn.disabled = sharedWorldActive || undoStack.length === 0;
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
    if (sharedWorldActive || i < 0 || i >= undoStack.length) return;
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
      container.innerHTML = '<div class="placeholder">Click a built structure to see its shells.</div>';
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
      recolorBtn.textContent = 'Recolor';
      recolorBtn.title = 'Set this shell to the selected material';
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

  function updateInventoryHint() {
    const el = document.getElementById('inventory-hint');
    if (!el) return;
    // See docs/code-notes/render.md
    const mine = world.getInventory()[myUserId ?? LOCAL_PLAYER_ID] ?? {};
    const parts = Object.entries(mine).map(([material, entry]) => `${material} ×${entry.quantity}`);
    el.textContent = parts.length > 0 ? `Inventory: ${parts.join(', ')}.` : 'Inventory: empty.';
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
    // Skipped during Shared World: that world is server-authoritative,
    // and unilaterally inserting a local-only cell here would desync
    // from the real multiplayer state rather than fix anything -- same
    // reasoning as the existing sharedWorldActive guard on the save call
    // below.
    if (!sharedWorldActive && world.entries().length === 0) {
      world.addCell(0, 0, 0, { material: 'base' });
    }
    applyAsteroidRegeneration(world);
    applyPopulationScaledSpawning(world);
    // Shared World: inventory is server-authoritative now (schema.sql's
    // apply_inventory_decay runs on its own pg_cron schedule) -- running
    // this local pass too would silently drift the display out of sync
    // with the real server value between realtime updates, and
    // setInventoryEntry here has no push hook to correct the server
    // anyway. Local-only play has no server, so this stays the only
    // decay mechanism there, unchanged.
    if (!sharedWorldActive) applyInventoryDecay(world);
    applyHydrosphere(world);
    applyBlackHoleConsumption(world);
    applyAsymptoticGeneration(world);
    applyStarFusion(world);
    applyDetonationCheck(world);
    rebuildInstances(mesh, world, currentMode === 'report');
    planetoids = computePlanetoids(world);
    planetoids = annotateBlackHoles(planetoids, world);
    planetoids = annotateStars(planetoids, world);
    planetoids = annotateSupernovae(planetoids);
    updateGravityInfo();
    updateBeltHint();
    updateInventoryHint();
    refreshOrganismsSnapshot(world);
    updateEvolutionInfo();
    const afterJSON = world.toJSON();
    const afterStr = JSON.stringify(afterJSON);
    if (afterStr !== lastSnapshot) {
      undoStack.push(lastSnapshot);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    lastSnapshot = afterStr;
    // Frozen while Shared World is active -- otherwise the shared view
    // (loaded via world.replaceAll(), not the player's own build) would
    // overwrite their real local save on the very next onChange().
    if (!sharedWorldActive) saveToLocalStorage({ ...afterJSON, planetoids });
    updateUndoButton();
    renderUndoScrubStrip();
    renderRingList();
    toastNewAchievements(checkAchievements({ world, planetoids }));
  }

  // B6 achievements: toasted one at a time via the existing bottom
  // contextual-prompt/toast pattern (showHudPrompt), never a new panel.
  // A single big world load (e.g. loading the Showcase World) can
  // legitimately earn several at once -- queued with a short stagger so
  // they're each actually readable instead of overwriting one another.
  let achievementQueue = [];
  let achievementToastTimer = null;
  function toastNewAchievements(newlyEarned) {
    if (newlyEarned.length === 0) return;
    achievementQueue.push(...newlyEarned);
    if (achievementToastTimer) return;
    const showNext = () => {
      const next = achievementQueue.shift();
      if (!next) {
        achievementToastTimer = null;
        return;
      }
      showHudPrompt(`🏆 Achievement: ${next.label}`, 3800);
      achievementToastTimer = setTimeout(showNext, 4200);
    };
    showNext();
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
  function updateSectionEnabled() {
    const enabled = document.getElementById('section-enable').checked;
    material.clippingPlanes = enabled ? [sectionPlane] : [];
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
  {
    const wheel3D = createRhombicWheel3D({
      getWorkspaceMode: () => workspaceMode,
      onAction: (action) => {
        // openCyborg/openLab reuse the real, already-shipped toggles;
        // openLenses maps to the closest existing single control
        // (X-Ray) -- see rhombic-wheel-3d-core.js's UNIVERSAL_RING
        // comment for why this isn't a clean 1:1 match. openAlmanac has
        // no existing counterpart yet and is a stub.
        if (action === 'openCyborg') { wheel3D.close(); cyborgToggleEl?.click(); return; }
        if (action === 'openLab') { wheel3D.close(); labToggleEl?.click(); return; }
        if (action === 'openLenses') { wheel3D.close(); document.getElementById('xray-toggle')?.click(); return; }
        if (action === 'openAlmanac') { showHudPrompt('Almanac is not built yet.', 3000); return; }
        // Explore (Rhombinaut) is a single destination, not a wheel --
        // reuses the real existing action (#walk-toggle, same trigger
        // the 2D wheel.js's own Explore item uses), then closes this
        // wheel since there's nothing left to navigate to here.
        if (action === 'navigateTo:explore') {
          document.getElementById('walk-toggle')?.click();
          wheel3D.close();
          return;
        }
        // Construct no longer needs a special case here: it's now a
        // real (mostly-spare) wheel in ALL_WHEELS with Build and Alter
        // as its two populated faces, so navigateTo:construct already
        // resolves via the generic ALL_WHEELS[target] branch above,
        // same as every other real wheel. See rhombic-wheel-3d-core.js.

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
        // wheel" for this instead of a bespoke second scene. Picking a
        // piece here used to close the wheel like every other terminal
        // tool: action in this file -- changed 2026-08-29, direct
        // request: shape and Material should be pickable "close
        // together," so this ONE terminal action deliberately stays
        // open instead of closing (Material now lives on this same
        // WHEEL_PIECE screen, see rhombic-wheel-3d-core.js) rather than
        // forcing a re-open just to reach it right after. Material's
        // own handler below still closes the wheel -- that's the real
        // hand-off point, to the separate color-swatch overlay.
        if (action.startsWith('tool:pieceType:')) {
          const value = action.slice('tool:pieceType:'.length);
          const PIECE_LABELS = { rd: 'RD', cube: 'Cube', pyramid: 'Pyramid', to: 'Truncated Octahedron', ioct: 'Octahedron Site', idis: 'Disphenoid' };
          document.getElementById('piece-type-select').value = value;
          updateHudIndicator();
          showHudPrompt(`Piece: ${PIECE_LABELS[value] ?? value}`, 3000);
          return;
        }
        // Reuses the 2D wheel's own material-picker overlay (a real,
        // already-independent DOM overlay, not part of its radial
        // LEVEL1/LEVEL2 visuals) via the openMaterialPicker export
        // added to wheel.js -- filling a real feature into a spare
        // slot, not inventing one. See rhombic-wheel-3d-core.js.
        if (action === 'tool:material') {
          wheel3D.close();
          pickers.openMaterialPicker((value, label) => showHudPrompt(`Material: ${label}`, 3000));
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

        // --- Cultivate: Growth Params is a direct match; Prune has no
        // separate mode -- it's a right-click gesture on an existing
        // growth tile while already in 'plant' mode (see render.js's
        // contextmenu listener calling pruneTile()), so this sets the
        // same real mode and explains the real gesture rather than
        // inventing a "prune mode" that doesn't exist. Plant also opens
        // the species picker (2D wheel's "Plant a Seed", folded in here
        // rather than given its own face) before setting plant mode --
        // mirrors the 2D wheel's own species-picker -> mode -> prompt
        // order exactly. ---
        if (action === 'tool:plant') {
          wheel3D.close();
          pickers.openSpeciesPicker((value, label) => {
            clickMode('plant');
            document.getElementById('cultivate-panel')?.classList.add('open');
            showHudPrompt(`Click anywhere to plant a ${label}.`, 3500);
          });
          return;
        }
        if (action === 'tool:prune') { clickMode('plant'); showHudPrompt('Prune: right-click an existing growth tile while in Plant mode.', 4000); wheel3D.close(); return; }
        if (action === 'tool:growthParams') { document.getElementById('cultivate-panel')?.classList.add('open'); wheel3D.close(); return; } // real "Growth Parameters" section lives in this panel

        // --- Rhombisis: BCC Build (core/bcc-build.md), replacing WHEEL_
        // RHOMBISIS's own Generate a Body duplicate at bottom|sx-1sz-1,
        // 2026-08-26 direct instruction -- "a fourth way to bring
        // something new into being" alongside Sculpt/Generate/Plant.
        // Same clickMode() shim as every other tool face; the
        // FEATURES.bccLattice check is defense-in-depth so this wheel
        // face can't put a Full Game World session into BCC mode even
        // though the underlying .mode-btn itself would technically
        // still accept the click (it's just hidden by CSS there).
        if (action === 'tool:bccBuild') {
          wheel3D.close();
          if (!FEATURES.bccLattice) {
            showHudPrompt('BCC Build is Rhombeometry-only -- switch modes in the Lab panel first.', 4000);
            return;
          }
          clickMode('bcc');
          showHudPrompt('BCC Build: click a face to place a BCC lattice cell (or a face of your normal World to start one nearby). Right-click removes.', 4500);
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
        // Reuses the 2D wheel's generator-type picker (a real,
        // already-independent overlay) via the openGeneratorPicker
        // export -- mirrors the 2D wheel's own picker -> mode:'generate'
        // -> prompt order exactly. Placed on Rhombitect rather than
        // Build/Cultivate/Trade per direct user decision 2026-08-25.
        if (action === 'tool:generateBody') {
          wheel3D.close();
          pickers.openGeneratorPicker((value, label) => {
            clickMode('generate');
            showHudPrompt(`Click anywhere to grow a ${label}.`, 3500);
          });
          return;
        }

        // --- Trade: JUDGMENT CALL. Offer/Accept only exist via the
        // in-world "Interact" trigger (walk up to another player, tap
        // Interact) -- see index.html's #interact-btn and render.js's
        // Interact panel comments -- there is no menu-driven way to
        // start one, so these open the Lab panel (where #trade-panel's
        // pending-trades list and #inventory-hint both really live)
        // and explain the real mechanism, rather than pretending a
        // direct action exists. ---
        if (action === 'tool:offer') { labToggleEl?.click(); showHudPrompt('Trades start via Interact: walk up to another player and tap Interact to propose one.', 4500); wheel3D.close(); return; }
        if (action === 'tool:accept') { labToggleEl?.click(); showHudPrompt('Pending trades from other players show up in the Lab panel -- walk up and tap Interact to respond.', 4500); wheel3D.close(); return; }
        if (action === 'tool:inventory') { labToggleEl?.click(); wheel3D.close(); return; } // real inventory line lives in the Lab panel

        if (action?.startsWith('tool:')) { showHudPrompt(`${action.slice(5)} is not built yet.`, 3000); return; }
      },
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
    function toggleWheel3D() {
      if (pickers.isAnyPickerOpen()) { pickers.closeAnyPicker(); return; }
      if (wheel3D.isOpen) wheel3D.close();
      else { seedIfWorldEmpty(); wheel3D.open('home'); }
    }
    rhombicWheel3DToggleBtn?.addEventListener('click', toggleWheel3D);
    isRhombicWheel3DOpen = () => wheel3D.isOpen;

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
        return;
      }
      e.preventDefault();
      toggleWheel3D();
    });

    // Bottom-left quick-select icons (their own innerHTML is refreshed
    // further down, near updateHudIndicator) reopen straight to where
    // that value gets changed -- the real Piece wheel screen / the real
    // Material picker overlay -- not back through Home, matching the
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
    document.getElementById('hud-quick-material')?.addEventListener('click', () => {
      if (wheel3D.isOpen) wheel3D.close();
      pickers.openMaterialPicker((value, label) => showHudPrompt(`Material: ${label}`, 3000));
    });
  }

  const bccToggleBtn = document.getElementById('bcc-toggle');
  if (bccToggleBtn) bccToggleBtn.style.display = FEATURES.bccLattice ? '' : 'none';
  // Real BCC cell placement (core/bcc-build.md) -- same Rhombeometry-only
  // gating as the preview toggle above.
  const bccBuildRow = document.getElementById('bcc-build-row');
  if (bccBuildRow) bccBuildRow.style.display = FEATURES.bccLattice ? '' : 'none';
  // Dualize preview (reframe Stage 3): same Rhombeometry-only gating as
  // the rest of the BCC/TO family -- Lab-panel entry point rather than a
  // wheel face, same precedent as BCC Build's own original placement
  // ("every wheel face is already allocated," core/bcc-build.md) -- a
  // wheel face can follow later once a commit path exists to make it a
  // more central tool, per that same precedent's own trajectory.
  const dualizeRow = document.getElementById('dualize-row');
  if (dualizeRow) dualizeRow.style.display = FEATURES.bccLattice ? '' : 'none';
  // Interpenetrating Lattice preview: same Rhombeometry-only gating and
  // Lab-panel placement precedent as the rest of the BCC/TO family.
  const interpenetrateRow = document.getElementById('interpenetrate-row');
  if (interpenetrateRow) interpenetrateRow.style.display = FEATURES.bccLattice ? '' : 'none';
  // Piece picker's TO option (core/build.js's handleToClick) -- same
  // Rhombeometry-only gating as the rest of BCC's own UI. A disabled
  // option can't be selected via the <select> itself; getPieceType()
  // reading 'to' at all already implies this feature is on.
  const pieceTypeToOption = document.getElementById('piece-type-to-option');
  if (pieceTypeToOption) {
    pieceTypeToOption.disabled = !FEATURES.bccLattice;
    pieceTypeToOption.hidden = !FEATURES.bccLattice;
  }
  // Same gating for the interstitial-lattice piece tiers.
  for (const id of ['piece-type-ioct-option', 'piece-type-idis-option']) {
    const opt = document.getElementById(id);
    if (opt) {
      opt.disabled = !FEATURES.bccLattice;
      opt.hidden = !FEATURES.bccLattice;
    }
  }
  // Lens Parity (reframe Stage 1): five view modes over the same two
  // renderables the original boolean BCC-preview toggle already drove --
  // the active FCC world mesh, and this dual BCC/TO lattice preview mesh.
  // Deliberately NOT touching bcc-build.js's separate, always-on `bccMesh`
  // (the player's own real, placed BCC/TO world) -- that's a structurally
  // different feature (persistent world-state vs. this camera-following,
  // non-persistent preview) that the reframe brief's five-mode matrix was
  // never scoped against.
  const LATTICE_VIEW_MODES = ['fcc-only', 'to-only', 'both-differentiated', 'fcc-ghost', 'to-ghost'];
  const LATTICE_VIEW_MODE_INFO = {
    'fcc-only': { fccOpacity: 1, label: 'FCC only -- the dual lattice preview is hidden.' },
    'to-only': { fccOpacity: 0, label: 'TO only -- your World is hidden, showing only the dual BCC/truncated-octahedron lattice preview.' },
    'both-differentiated': { fccOpacity: 1, label: 'Both, differentiated -- World and dual lattice shown together at full opacity, in distinct colors and fill styles.' },
    'fcc-ghost': { fccOpacity: 0.3, label: 'FCC ghost -- your World faded so the dual lattice preview stands out.' },
    'to-ghost': { fccOpacity: 0.35, label: 'TO ghost -- the dual lattice preview shown against your faded World.' },
  };
  let latticeViewMode = 'fcc-only';
  let bccLatticeMesh = null;
  let bccLatticeEdges = null; // wireframe overlay, only used in both-differentiated
  // Real bug found live (2026-08-28): rebuildBCCLatticeDetail() is called
  // from two places that can overlap -- a click AND the recurring 250ms
  // refresh timer (scheduleBCCRefresh) -- and only checked latticeViewMode
  // once, at the very start. A call already in flight when the player
  // switched modes (e.g. to fcc-only) would finish its own async work
  // (the dynamic import below) AFTER the newer call had already cleared
  // the scene, and re-add a mesh for a mode that no longer applies --
  // reproduced by cycling the lens quickly enough for a stale in-flight
  // refresh to land after a mode-switching click. Guarded the standard
  // way: a generation counter, bumped at the start of every call; if a
  // newer call has started by the time this one's await resolves, this
  // one discards its own result instead of touching the scene.
  let bccLatticeGeneration = 0;
  let bccRefreshTimer = null;
  let bccRefreshLoopActive = false;
  async function rebuildBCCLatticeDetail() {
    const myGeneration = ++bccLatticeGeneration;
    const { world: w, scene: s } = activeWorldTriple();
    if (bccLatticeMesh) {
      s.remove(bccLatticeMesh);
      bccLatticeMesh.geometry.dispose();
      bccLatticeMesh.material.dispose();
      bccLatticeMesh = null;
    }
    if (bccLatticeEdges) {
      s.remove(bccLatticeEdges);
      bccLatticeEdges.geometry.dispose();
      bccLatticeEdges.material.dispose();
      bccLatticeEdges = null;
    }
    if (latticeViewMode === 'fcc-only') return;
    const cells = w ? w.entries() : [];
    if (cells.length === 0) return;
    // controls.target (the real look-at point, same convention already
    // used elsewhere in this file, e.g. updateGravityInfo) -- NOT
    // camera.position, which sits offset from the structure by the whole
    // orbit distance. Real bug found via live testing (2026-08-25):
    // seeding from camera.position put the patch off near the camera
    // itself, not overlapping the actual visible world content.
    const refPos = walking && player ? [player.getPosition().x, player.getPosition().y, player.getPosition().z] : [controls.target.x, controls.target.y, controls.target.z];
    // One real, connected BCC lattice patch seeded near the camera's
    // look-at point -- NOT derived per FCC parent cell, so it stays
    // continuous across FCC-FCC seams (see bcc-detail-lattice.js's own
    // header for why the earlier per-cell design read as disconnected
    // islands).
    const subCells = generateBCCLatticePatch(refPos, SCALE);
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    // A newer call (a later click, or the recurring refresh timer) may
    // have started and already handled the scene while this one was
    // awaiting the import above -- discard this stale result instead of
    // clobbering that newer state or adding a mesh for a mode that may
    // no longer be current.
    if (myGeneration !== bccLatticeGeneration) return;
    const pieces = [];
    for (const sub of subCells) {
      const verts = bccDetailVertsFor(sub).map(([x, y, z]) => new THREE.Vector3(x, y, z));
      pieces.push(new ConvexGeometry(verts));
    }
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    // 'both-differentiated' pairs a distinct color with a distinct fill
    // style -- a real wireframe edge overlay -- rather than color alone,
    // reusing SKELETON_COLOR, this project's own existing "translucent
    // fill + line outline" convention (rhombic-wheel-3d-core.js's wheel
    // faces / piece-cluster-3d.js), instead of inventing a new
    // colorblind-safe pairing from scratch. Every other mode keeps the
    // preview's original plain green, unchanged.
    const differentiated = latticeViewMode === 'both-differentiated';
    const toColor = differentiated ? SKELETON_COLOR : 0x39ff88;
    bccLatticeMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
      color: toColor, emissive: toColor, emissiveIntensity: 0.7, flatShading: true, metalness: 0.1, roughness: 0.6,
    }));
    s.add(bccLatticeMesh);
    if (differentiated) {
      bccLatticeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(merged), new THREE.LineBasicMaterial({ color: 0xffffff }));
      s.add(bccLatticeEdges);
    }
  }
  // Live re-triggering while active -- mirrors Lattice Zoom's own
  // scheduleSubLatticeRefresh throttled-loop pattern, reusing the same
  // adaptive-damping throttle functions, so BCC detail keeps following the
  // camera instead of freezing at whatever position it was toggled on at.
  function scheduleBCCRefresh() {
    bccRefreshTimer = setTimeout(async () => {
      if (latticeViewMode === 'fcc-only') { bccRefreshLoopActive = false; return; }
      try {
        await rebuildBCCLatticeDetail();
      } catch (err) {
        console.error('[BCC refresh error]', err);
      }
      scheduleBCCRefresh();
    }, SUB_LATTICE_THROTTLE_BASE_MS);
  }
  // Nested detail sitting entirely inside an opaque parent cell is
  // invisible from outside by construction -- real symptom found via live
  // testing (2026-08-25): the mesh built correctly (confirmed via direct
  // instrumentation) but never showed up on screen except once, by
  // accident, when the camera happened to be clipped inside a freshly
  // placed, still-open cell. Real fix: make the world semi-transparent
  // whenever the FCC side of the current lens isn't at full opacity, the
  // same "temporarily change how the main mesh renders" move Duality Mode
  // already makes (there: fully hidden; here: see-through/hidden-via-
  // opacity, since unlike Duality this preview is meant to be seen
  // alongside -- or, in to-only, instead of -- the real world, using
  // opacity rather than `.visible` so raycasting/build clicks are
  // unaffected either way) -- restored exactly when the lens returns to
  // fcc-only.
  bccToggleBtn?.addEventListener('click', async () => {
    const currentIdx = LATTICE_VIEW_MODES.indexOf(latticeViewMode);
    latticeViewMode = LATTICE_VIEW_MODES[(currentIdx + 1) % LATTICE_VIEW_MODES.length];
    bccToggleBtn.classList.toggle('active', latticeViewMode !== 'fcc-only');
    const activeMesh = sculptureModeActive ? sculptureMesh : mesh;
    const { fccOpacity, label } = LATTICE_VIEW_MODE_INFO[latticeViewMode];
    if (fccOpacity < 1) {
      activeMesh.material.transparent = true;
      activeMesh.material.opacity = fccOpacity;
      // transparent alone still writes to the depth buffer -- real bug
      // found via live testing (2026-08-25): a see-through (or fully
      // invisible-but-still-opaque-to-depth) parent still fully occludes
      // anything behind it despite LOOKING translucent. depthWrite:false
      // is the standard fix for a translucent object that must not block
      // what's behind it.
      activeMesh.material.depthWrite = false;
    } else {
      activeMesh.material.transparent = false;
      activeMesh.material.opacity = 1;
      activeMesh.material.depthWrite = true;
    }
    activeMesh.material.needsUpdate = true; // transparent's blend-state change needs a real program recompile, not just the opacity value
    showHudPrompt(`Lattice View: ${label}`, 4500);
    if (latticeViewMode === 'fcc-only') {
      if (bccRefreshTimer) clearTimeout(bccRefreshTimer);
      bccRefreshTimer = null;
      bccRefreshLoopActive = false;
      await rebuildBCCLatticeDetail(); // clears any existing preview mesh/edges
    } else {
      await rebuildBCCLatticeDetail();
      if (!bccRefreshLoopActive) {
        bccRefreshLoopActive = true;
        scheduleBCCRefresh();
      }
    }
  });

  const shellCountInput = document.getElementById('shell-count');
  const hollowFromInput = document.getElementById('hollow-from');
  const materialSelect = document.getElementById('material-select');

  const getShellCount = () => Math.min(Math.max(1, Number(shellCountInput.value) || 1), MAX_SHELL);

  // See docs/code-notes/render.md
  const MODE_HINTS = {
    build: 'Click a face to add one cell using the selected material.',
    fill: 'Click a cell to fill shells (hollow from–radius) outward around it, approximating a sphere. A second click on the same structure grows it further.',
    round: 'Click a shell-tagged cell to smooth its outer boundary by true distance from center.',
    excavate: 'Click a shell-tagged structure to hollow out its interior below "Hollow from shell".',
    generate: 'Click a cell to generate a full body of the chosen type there (radius = Shell fill radius), formula-built in one click instead of hand-placing every cell.',
    report: 'Shows flagged/removed cells (normally hidden) in red. Click one to flag it, click a flagged one to approve it back.',
    plant: 'Click anywhere to plant a seed of the chosen species. Left alone, it grows on its own over real time.',
    sculpt: 'Model (add) onto a face, or Chisel (subtract) a clicked cell -- see the Sculpt panel for tier/mirror/brush.',
    bcc: 'Click a face of an existing BCC cell to extend it, or a face of your normal World to start one nearby. Right-click removes a BCC cell. Overlap with your normal World is expected -- it\'s how the two lattices join.',
    dualize: 'Click an existing structure (FCC or a real placed BCC/TO cell) to preview its region (radius = Shell fill radius) reinterpreted through the other lattice. View-only -- nothing is written to your World.',
  };
  function updateModeUI() {
    const showRadius = currentMode === 'fill' || currentMode === 'generate' || currentMode === 'dualize';
    const showHollowFrom = currentMode === 'fill' || currentMode === 'excavate';
    const showGenerator = currentMode === 'generate';
    const showSpecies = currentMode === 'plant';
    document.getElementById('shell-radius-row').style.display = showRadius ? '' : 'none';
    document.getElementById('hollow-from-row').style.display = showHollowFrom ? '' : 'none';
    document.getElementById('generator-row').style.display = showGenerator ? '' : 'none';
    document.getElementById('species-row').style.display = showSpecies ? '' : 'none';
    document.getElementById('mode-hint').textContent = MODE_HINTS[currentMode];
    updateHudIndicator();
  }

  // See docs/code-notes/render.md
  const PLAYER_FACING_MODE_LABEL = {
    // 'build'/'chisel'/'sculpt' are internal mode strings kept for
    // minimal disruption (see core/build.js) -- their player-facing
    // labels are the universal "Add"/"Remove"/"Symmetry" now (direct
    // instruction 2026-08-26, retiring the Rhombi-/Pyramid-/Cube-
    // specific names). 'chisel' was previously missing here entirely and
    // fell through to the raw internal string -- caught live, not just
    // reasoned about, via a real HUD screenshot.
    build: 'Add',
    chisel: 'Remove',
    sculpt: 'Symmetry',
    fill: 'Fill',
    round: 'Smooth',
    excavate: 'Dig',
    generate: 'Create',
    replace: 'Replace',
    report: 'Report',
    plant: 'Plant',
    bcc: 'BCC Build',
    dualize: 'Dualize Preview',
  };
  // Maps core/build.js's own getPieceType() values to their matching
  // MARKS entry -- same shape vocabulary the Piece wheel faces
  // themselves use (wheel-icons.js), so the quick-select icon below is
  // never a second, competing symbol for the same shape.
  const PIECE_MARK_KEY = { rd: 'pieceRD', cube: 'pieceCube', pyramid: 'piecePyramid', to: 'pieceTO', ioct: 'pieceOctaSite', idis: 'pieceDisphenoid' };
  const quickShapeEl = document.getElementById('hud-quick-shape');
  const quickMaterialEl = document.getElementById('hud-quick-material');
  // Bottom-left quick-select: always-visible current Piece/Material,
  // direct request 2026-08-29 ("a little hexagon icon of each... stay
  // open at bottom next to menu") -- unlike updateHudIndicator's own
  // text readout below, these two stay accurate through Walk/Sculpture
  // Mode too (the underlying value doesn't change either), so this runs
  // unconditionally rather than sharing those early returns.
  function updateQuickSelect() {
    if (quickShapeEl) {
      const pieceValue = document.getElementById('piece-type-select').value;
      quickShapeEl.innerHTML = iconFrame(MARKS[PIECE_MARK_KEY[pieceValue]] ?? MARKS.pieceRD, { title: 'Shape' });
    }
    if (quickMaterialEl) {
      const hex = `#${materialColor(materialSelect.value).getHexString()}`;
      quickMaterialEl.innerHTML = iconFrame(swatchMark(hex), { title: 'Material' });
    }
  }
  function updateHudIndicator() {
    updateQuickSelect();
    const el = document.getElementById('hud-indicator');
    if (!el) return;
    if (walking) {
      el.textContent = 'Exploring';
      return;
    }
    if (sculptureModeActive) {
      el.textContent = 'Sculpture Mode (standalone)';
      return;
    }
    const modeLabel = PLAYER_FACING_MODE_LABEL[currentMode] ?? currentMode;
    const materialLabel = materialSelect.options[materialSelect.selectedIndex]?.textContent ?? '';
    el.textContent = `${modeLabel} · ${materialLabel}`;
  }
  refreshHudIndicator = updateHudIndicator;
  materialSelect.addEventListener('change', updateHudIndicator);
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

  // See docs/code-notes/render.md
  const plantRaycaster = new THREE.Raycaster();
  const plantPointer = new THREE.Vector2();
  let seedCounter = 0;
  renderer.domElement.addEventListener('click', (event) => {
    if (currentMode !== 'plant' || walking) return;
    const rect = renderer.domElement.getBoundingClientRect();
    plantPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    plantPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    plantRaycaster.setFromCamera(plantPointer, camera);
    const hits = plantRaycaster.intersectObject(mesh);
    let origin;
    if (hits.length > 0) {
      const hit = hits[0];
      const normal = hit.face.normal;
      origin = [hit.point.x + normal.x * 0.5, hit.point.y + normal.y * 0.5, hit.point.z + normal.z * 0.5];
    } else {
      const dir = plantRaycaster.ray.direction;
      const p = camera.position.clone().add(dir.clone().multiplyScalar(10));
      origin = [p.x, p.y, p.z];
    }
    const species = document.getElementById('species-select').value;

    // B5 Cultivation Mode's Semi-Cyborg tier: propose a planting site
    // instead of planting immediately -- nothing plants without
    // explicit accept. Only applies to plain (non-evolving) species;
    // evolving organisms/animals are a different, unrelated planting
    // path this mode doesn't touch.
    if (cultivateSession.assistanceTier === 'semi-cyborg' && !species.startsWith('evo-')) {
      const [cx, cy, cz] = nearestValidCell(origin[0], origin[1], origin[2]);
      const hitCell = world.has(cx, cy, cz) ? { x: cx, y: cy, z: cz, ...world.entries().find((c) => c.x === cx && c.y === cy && c.z === cz) } : { x: cx, y: cy, z: cz };
      proposeCultivationSite(cultivateSession, world, hitCell, species, currentGrowthParameters());
      renderCultivateSuggestion();
      return;
    }

    seedCounter += 1;
    const seedId = `seed_${Date.now()}_${seedCounter}`;
    let seed;
    // RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md Stage 9: 'evo-*' options
    // are the one new player-facing lever this stage adds -- plant a
    // REAL, genome-bearing organism (evolution.js's plantOrganism)
    // instead of a fixed Wave-1/Wave-2 template seed. Per section 9's own
    // governing decision ("no breeding/culling UI"), the player never
    // hand-edits genome numbers -- a starting genome is drawn uniformly
    // at random within each trait's own real, coherence-bounded range
    // (GENOME_TRAIT_RANGES), the same "player influences conditions, not
    // genes directly" framing every other lever in section 9 already
    // uses (this is just the FOUNDING lever: what starts on the
    // planetoid at all).
    const isEvolvingSpecies =
      species === 'evo-amoeba' || species === 'evo-plant' || species === 'evo-land' || species === 'evo-land-dino' || species === 'evo-sea';
    if (isEvolvingSpecies && sharedWorldActive) {
      // See docs/code-notes/render.md
      alert('Evolving species require local (non-Shared-World) play for now -- disable Shared World first.');
      return;
    }
    if (species === 'evo-amoeba' || species === 'evo-plant') {
      const evoSpecies = species.slice('evo-'.length);
      const genome = {};
      for (const [trait, [min, max]] of Object.entries(GENOME_TRAIT_RANGES)) {
        genome[trait] = min + Math.random() * (max - min);
      }
      const organismId = `organism_${Date.now()}_${seedCounter}`;
      ({ seed } = plantOrganism(world, organismId, seedId, evoSpecies, genome, origin));
    } else if (species === 'evo-land' || species === 'evo-land-dino' || species === 'evo-sea') {
      if (!FEATURES.animals) {
        alert('Animals are currently disabled (FEATURES.animals is off).');
        return;
      }
      // See docs/code-notes/render.md
      const animalSpecies = species === 'evo-sea' ? SEA_CREATURE_SPECIES : LAND_CREATURE_SPECIES;
      const isDino = species === 'evo-land-dino';
      const genome = {};
      for (const [trait, [min, max]] of Object.entries(GENOME_TRAIT_RANGES)) {
        genome[trait] = isDino && trait === 'maturitySize' ? max - Math.random() * (max - min) * 0.3 : min + Math.random() * (max - min);
      }
      const animalTraits = {};
      for (const [trait, [min, max]] of Object.entries(ANIMAL_TRAIT_RANGES)) {
        animalTraits[trait] = isDino ? max - Math.random() * (max - min) * 0.3 : min + Math.random() * (max - min);
      }
      const organismId = `organism_${Date.now()}_${seedCounter}`;
      try {
        ({ seed } = plantAnimal(world, organismId, seedId, animalSpecies, genome, animalTraits, origin));
      } catch (err) {
        const habitatHint =
          animalSpecies === LAND_CREATURE_SPECIES
            ? 'Land creatures need dry ground, away from any Ice 9.9/liquid-permeated zone.'
            : 'Sea creatures need a liquid-permeated zone (Ice 9.9 near a Blackstar-Glassite core).';
        alert(`Can't plant here: ${err.message}. ${habitatHint}`);
        return;
      }
    } else {
      seed = plantSeed(world, seedId, species, origin);
      // See docs/code-notes/render.md
      world.setSeed(seedId, { ...seed, growthParameters: currentGrowthParameters(), assistanceTier: cultivateSession.assistanceTier, authorId: myUserId ?? LOCAL_PLAYER_ID });
    }
    rebuildSeedMeshes(seedId, seed);
    if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
    refreshOrganismsSnapshot(world);
    updateEvolutionInfo();
    toastNewAchievements(checkAchievements({ world, planetoids }));
    window.dispatchEvent(new CustomEvent('rhombiverse:seedPlanted'));
  });
  updateModeUI();

  // See docs/code-notes/render.md
  renderer.domElement.addEventListener('contextmenu', (event) => {
    if (currentMode !== 'plant' || walking) return;
    const rect = renderer.domElement.getBoundingClientRect();
    plantPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    plantPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    plantRaycaster.setFromCamera(plantPointer, camera);
    const hits = plantRaycaster.intersectObjects(growthGroup.children, true);
    if (hits.length === 0) return;
    const { seedId, tileIndex } = hits[0].object.userData;
    if (seedId === undefined) return;
    event.preventDefault();
    if (pruneTile(world, seedId, tileIndex)) {
      const seed = world.getSeeds()[seedId];
      rebuildSeedMeshes(seedId, seed);
      if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
      showHudPrompt('Pruned -- the growth layer will fill the gap back in on its own.');
    }
  });

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
    // core/bcc-build.js's own TO-piece click handling already uses to
    // let one click react correctly to whichever real structure is
    // actually there.
    const hits = dualizeRaycaster.intersectObjects([mesh, bccMesh]);
    if (hits.length === 0 || hits[0].instanceId === undefined) return;
    const hitBcc = hits[0].object === bccMesh;
    const cell = hitBcc ? bccCellOrder[hits[0].instanceId] : cellOrder[hits[0].instanceId];
    if (!cell) return;
    await rebuildDualizePreview(hitBcc ? 'bcc' : 'fcc', cell.x, cell.y, cell.z, getShellCount());
  });

  // --- Interpenetrating Lattice preview (direct user request 2026-08-28,
  // after a feasibility check against this exact codebase) --------------
  // Real, verified geometric fact this feature is built on, not an
  // approximation: a BCC/TO cell placed at the SAME coordinate as an FCC
  // cell has its 6 square-face centers land EXACTLY on that FCC cell's
  // RD's own 6 sharp (4-valent) vertices, using the SAME
  // bccShapeScaleFor(SCALE) self-tiling scale this project already
  // established for a different reason (tangent contact between
  // neighboring BCC cells) -- confirmed by direct numeric computation
  // against rdRawVerts/truncatedOctahedronVertices before any of this
  // was written, not assumed. Real constraint that comes with it: only
  // FCC cells whose coordinates are ALSO valid BCC points (all-same-
  // parity) can host a co-located BCC cell -- which, for any FCC-valid
  // (x+y+z even) coordinate, means exactly the all-even sub-family (the
  // all-odd BCC family always sums to odd, so it's never FCC-valid to
  // begin with). isBCC() alone is a sufficient filter over real FCC
  // cells for exactly this reason -- no separate "all-even" check
  // needed. View-only, like every other lens/preview in this app:
  // scans the real World's own cells once per toggle, never writes to
  // bccWorld.
  let interpenetrateActive = false;
  let interpenetrateMesh = null;
  let interpenetrateEdges = null;
  function clearInterpenetratePreview() {
    if (interpenetrateMesh) {
      scene.remove(interpenetrateMesh);
      interpenetrateMesh.geometry.dispose();
      interpenetrateMesh.material.dispose();
      interpenetrateMesh = null;
    }
    if (interpenetrateEdges) {
      scene.remove(interpenetrateEdges);
      interpenetrateEdges.geometry.dispose();
      interpenetrateEdges.material.dispose();
      interpenetrateEdges = null;
    }
  }
  async function rebuildInterpenetratePreview() {
    clearInterpenetratePreview();
    const coLocatable = world.entries().filter((c) => isBCC(c.x, c.y, c.z));
    if (coLocatable.length === 0) {
      showHudPrompt('Interpenetrating Lattice: no built cells at a coordinate that can host a co-located BCC/TO cell (needs all-even x,y,z) -- try a larger structure.', 5000);
      return;
    }
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    const shapeScale = bccShapeScaleFor(SCALE);
    const pieces = [];
    for (const c of coLocatable) {
      const [wx, wy, wz] = cellToWorld(c.x, c.y, c.z, SCALE);
      const verts = truncatedOctahedronVertices(shapeScale).map(([x, y, z]) => new THREE.Vector3(x + wx, y + wy, z + wz));
      pieces.push(new ConvexGeometry(verts));
    }
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((g) => g.dispose());
    // Same color + wireframe pairing convention as every other dual-
    // lattice preview in this app (Lens Parity's both-differentiated,
    // Dualize) -- not a new visual language for "this is a preview."
    interpenetrateMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({
      color: SKELETON_COLOR, emissive: SKELETON_COLOR, emissiveIntensity: 0.6, flatShading: true,
      transparent: true, opacity: 0.55, metalness: 0.1, roughness: 0.6,
    }));
    scene.add(interpenetrateMesh);
    interpenetrateEdges = new THREE.LineSegments(new THREE.EdgesGeometry(merged), new THREE.LineBasicMaterial({ color: 0xffffff }));
    scene.add(interpenetrateEdges);
    showHudPrompt(
      `Interpenetrating Lattice: ${coLocatable.length} of your World's cells sit at a co-locatable coordinate -- each RD's 6 sharp vertices exactly meet a TO's 6 square-face centers (view-only -- nothing written to your World).`,
      6500,
    );
  }
  document.getElementById('interpenetrate-toggle')?.addEventListener('click', async () => {
    interpenetrateActive = !interpenetrateActive;
    document.getElementById('interpenetrate-toggle').classList.toggle('active', interpenetrateActive);
    if (interpenetrateActive) {
      await rebuildInterpenetratePreview();
    } else {
      clearInterpenetratePreview();
      showHudPrompt('Interpenetrating Lattice preview hidden.', 3000);
    }
  });

  // --- B5: Cultivation Mode (Grow -> Cultivate) -----------------------
  const cultivateSession = createCultivationSession(myUserId ?? LOCAL_PLAYER_ID);

  function currentGrowthParameters() {
    const [bx, by, bz] = document.getElementById('cultivate-directional-bias').value.split(',').map(Number);
    const densityBias = Number(document.getElementById('cultivate-density-bias').value);
    return { directionalBias: [bx, by, bz], densityBias };
  }

  function renderCultivateSuggestion() {
    const el = document.getElementById('cultivate-suggestion');
    const s = cultivateSession.pendingSuggestion;
    if (!s) {
      el.style.display = 'none';
      return;
    }
    document.getElementById('cultivate-suggestion-text').textContent = `Plant ${s.species} here -- ${s.reason}.`;
    el.style.display = '';
  }

  document.querySelectorAll('#cultivate-tier-row .tier-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cultivate-tier-row .tier-btn').forEach((b) => b.classList.toggle('active', b === btn));
      cultivateSession.assistanceTier = btn.dataset.tier;
      cultivateSession.pendingSuggestion = null;
      renderCultivateSuggestion();
      const isFullCyborg = cultivateSession.assistanceTier === 'full-cyborg';
      // Same standalone-mode-or-flag rule as Sculpt's own Full-Cyborg
      // gate (B5's own instruction: "gated the same way" as B4a's).
      const fullCyborgUsable = sculptureModeActive || FULL_CYBORG_INWORLD_ENABLED;
      document.getElementById('cultivate-fullcyborg-section').style.display = isFullCyborg && fullCyborgUsable ? '' : 'none';
      document.getElementById('cultivate-fullcyborg-gated').style.display = isFullCyborg && !fullCyborgUsable ? '' : 'none';
    });
  });

  document.getElementById('cultivate-close')?.addEventListener('click', () => {
    document.getElementById('cultivate-panel').classList.remove('open');
  });

  document.getElementById('cultivate-suggestion-accept').addEventListener('click', () => {
    acceptCultivationSuggestion(cultivateSession, world, myUserId ?? LOCAL_PLAYER_ID);
    onChange();
    renderCultivateSuggestion();
  });
  document.getElementById('cultivate-suggestion-dismiss').addEventListener('click', () => {
    dismissCultivationSuggestion(cultivateSession);
    renderCultivateSuggestion();
  });

  document.getElementById('cultivate-nl-go').addEventListener('click', async () => {
    const input = document.getElementById('cultivate-nl-input');
    const resultEl = document.getElementById('cultivate-nl-result');
    const text = input.value.trim();
    if (!text) return;
    resultEl.textContent = 'Thinking…';
    const origin = { x: 0, y: 0, z: 0 }; // TODO: same last-hovered-cell limitation as Sculpt's own Full-Cyborg box
    const intent = await requestCultivationIntent(text, origin);
    if (intent.unrecognized) {
      resultEl.textContent = intent.description;
      return;
    }
    const { applied, skipped } = executeCultivationIntent(world, intent, world.getClaims(), myUserId ?? LOCAL_PLAYER_ID, currentGrowthParameters());
    resultEl.textContent = `${intent.description}${intent.viaAI ? ' (AI)' : ' (local parser)'} -- ${applied.length} seed${applied.length === 1 ? '' : 's'} planted${skipped.length ? `, ${skipped.length} skipped (outside your claim)` : ''}.`;
    if (applied.length > 0) {
      refreshOrganismsSnapshot(world);
      onChange();
    }
    input.value = '';
  });

  // Frost line -- see docs/code-notes/render.md
  const canPlaceMaterial = (material, x, y, z) =>
    canPlaceForStars(material, x, y, z, Object.values(planetoids).filter((p) => p.isStar));

  // See docs/code-notes/render.md
  const FULL_CYBORG_INWORLD_ENABLED = false;
  const sculptSession = createSculptureSession(myUserId ?? LOCAL_PLAYER_ID);
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
      myUserId ?? LOCAL_PLAYER_ID,
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
    if (walking) exitWalk();
    // See docs/code-notes/render.md
    document.getElementById('duality-toggle')?.classList.contains('active') && document.getElementById('duality-toggle').click();
    savedCameraState.position.copy(camera.position);
    savedCameraState.target.copy(controls.target);
    if (!sculptureWorld) {
      sculptureWorld = createWorldStore({ worldName: 'Sculpture Scratch', version: 1, cells: {}, meta: {} });
      sculptureWorld.addCell(0, 0, 0, { material: 'base' });
    }
    sculptureModeActive = true;
    updateWorldPanelVisibility();
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
    updateWorldPanelVisibility();
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
    cellAt: (hit) => (hit.instanceId !== undefined
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
        idis: {
          add: "That disphenoid's already there.",
          remove: 'No disphenoid there to remove -- tap directly on one from the interstitial lattice.',
        },
        ioct: {
          add: 'That octahedron site is already complete there.',
          remove: 'No octahedron site there to remove -- tap directly on one of its own disphenoids.',
        },
      };
      showHudPrompt(messages[piece]?.[action] ?? 'Nothing to do there.', 3500);
    },
    getDragPlacementEnabled: () => pickers.isDragPlacementEnabled(),
    // getMode() must return 'plant', never null -- see docs/code-notes/render.md
    getMode: () => (walking ? null : currentMode),
    getShellCount,
    getMinShell: () => Math.min(Math.max(1, Number(hollowFromInput.value) || 1), getShellCount()),
    getMaterial: () => materialSelect.value,
    getGeneratorType: () => document.getElementById('generator-type-select').value,
    getPieceType: () => document.getElementById('piece-type-select').value,
    // TO ("adopted family member", direct instruction 2026-08-26): lets
    // the universal Add/Remove actions ALSO target the separate BCC
    // dual-lattice world, reusing its own bootstrap-vs-extend logic
    // (core/bcc-build.js) via core/build.js's handleToClick -- not a
    // pretense that a truncated octahedron is a piece of the same RD
    // decomposition RD/Cube/Pyramid are. bccWorld/bccMesh always exist
    // regardless of FEATURES.bccLattice (see their own construction
    // above); the Piece picker's own 'to' option is what's actually
    // feature-gated (below), so no separate guard is needed here.
    bccWorld,
    bccMesh,
    bccCellAt: (instanceId) => bccCellOrder[instanceId],
    onBCCChange,
    interstitialStore,
    interstitialGroup,
    onInterstitialChange,
    canPlaceMaterial,
    getOwnerId: () => myUserId ?? LOCAL_PLAYER_ID,
    mineRemote: (x, y, z) => {
      if (sharedWorldActive) mineAsteroidCellRemote(x, y, z);
    },
    mineAsteroidCell, // see docs/code-notes/render.md
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
  // small dedicated rebuild, not a reuse of onChange(). See core/
  // bcc-build.md.
  function onBCCChange() {
    // Same "never truly empty" invariant as the main world's own
    // onChange() -- direct instruction, 2026-08-29: applies to every
    // lattice, not just the FCC one. (0,0,0) is a real, always-valid BCC
    // lattice point (isBCC: all-even), so this restores exactly the
    // same kind of real, buildable anchor a fresh BCC Build starts from.
    if (bccWorld.entries().length === 0) {
      bccWorld.addCell(0, 0, 0, { material: 'base' });
    }
    rebuildBCCInstances(bccMesh, bccWorld);
    saveToLocalStorage(bccWorld.toJSON(), BCC_STORAGE_KEY);
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
    saveToLocalStorage(interstitialStore.toJSON(), INTERSTITIAL_STORAGE_KEY);
  }
  createBCCBuildController({
    renderer,
    camera,
    fccMesh: mesh,
    bccMesh,
    fccCellAt: (instanceId) => cellOrder[instanceId],
    bccCellAt: (instanceId) => bccCellOrder[instanceId],
    bccWorld,
    onChange: onBCCChange,
    getMaterial: () => materialSelect.value,
    isActive: () => !walking && currentMode === 'bcc' && FEATURES.bccLattice,
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
    if (persona === 'rhombinaut') {
      document.getElementById('walk-toggle')?.click();
    } else if (persona === 'rhombisculptor') {
      clickMode('sculpt');
      openSculptPanel();
    } else if (persona === 'rhombiologist') {
      clickMode('plant');
      document.getElementById('cultivate-panel')?.classList.add('open');
    }
    // 'rhombitect' (Build): already the default state, nothing to do.
  };
  if (pendingPersonaChoice) {
    applyPersonaChoiceFn(pendingPersonaChoice);
    pendingPersonaChoice = null;
  }

  // See docs/code-notes/render.md
  function applyRemoteUpsert(x, y, z, data) {
    applyingRemote = true;
    world.addCell(x, y, z, data);
    onChange();
    applyingRemote = false;
  }
  function applyRemoteDelete(x, y, z) {
    applyingRemote = true;
    world.removeCell(x, y, z);
    onChange();
    applyingRemote = false;
  }

  // See docs/code-notes/render.md
  function applyRemoteClaim(claimId, claimData) {
    world.addClaim(claimId, claimData);
    refreshClaims();
  }

  // See docs/code-notes/render.md
  function applyRemoteRegrowthSet(key, entry) {
    applyingRemote = true;
    world.setRegrowthEntry(key, entry);
    applyingRemote = false;
  }
  function applyRemoteRegrowthClear(key) {
    applyingRemote = true;
    world.removeRegrowthEntry(key);
    applyingRemote = false;
  }

  // See docs/code-notes/render.md
  function applyRemoteSeedSet(seedId, seedData) {
    applyingRemote = true;
    world.setSeed(seedId, seedData);
    applyingRemote = false;
    rebuildSeedMeshes(seedId, seedData);
  }
  function applyRemoteSeedClear(seedId) {
    applyingRemote = true;
    world.removeSeed(seedId);
    applyingRemote = false;
  }

  // See docs/code-notes/render.md
  function applyRemoteInventory(ownerId, material, entry) {
    world.setInventoryEntry(ownerId, material, entry);
    updateInventoryHint();
    renderTradePanel();
  }

  // See docs/code-notes/render.md
  function interactPanelShowsTrade(tradeData) {
    return (
      interactOverlayEl?.classList.contains('open') &&
      interactPartnerId &&
      (tradeData.playerA === interactPartnerId || tradeData.playerB === interactPartnerId)
    );
  }
  function applyRemoteTrade(tradeId, tradeData) {
    world.setPendingTrade(tradeId, tradeData);
    renderTradePanel();
    if (interactPanelShowsTrade(tradeData)) renderInteractPanel();
  }
  function applyRemoteTradeClear(tradeId) {
    const removed = world.getPendingTrades()[tradeId];
    world.removePendingTrade(tradeId);
    renderTradePanel();
    if (removed && interactPanelShowsTrade(removed)) renderInteractPanel();
  }

  const sharedWorldToggle = document.getElementById('shared-world-toggle');
  const sharedWorldHint = document.getElementById('shared-world-hint');
  const newWorldBtn = document.getElementById('new-world');
  const loadPresetBtn = document.getElementById('load-preset');
  const claimLandBtn = document.getElementById('claim-land-btn');
  const claimHint = document.getElementById('claim-hint');
  const claimsListEl = document.getElementById('claims-list');
  // Claims panel visibility -- see docs/code-notes/render.md
  ['claim-land-row', 'claim-hint', 'claims-list'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = FEATURES.economy ? '' : 'none';
  });
  // See docs/code-notes/render.md
  function updateWorldPanelVisibility() {
    const asteroidSection = document.getElementById('asteroid-info-section');
    if (asteroidSection) asteroidSection.style.display = FEATURES.mining && !sculptureModeActive ? '' : 'none';
    const presetsSection = document.getElementById('world-presets-section');
    if (presetsSection) presetsSection.style.display = sculptureModeActive ? 'none' : '';
  }
  updateWorldPanelVisibility();

  // See docs/code-notes/render.md
  function refreshClaims() {
    while (claimGroup.children.length > 0) {
      const child = claimGroup.children[0];
      claimGroup.remove(child);
      child.geometry.dispose();
      child.material.dispose();
    }
    if (!FEATURES.economy) return;
    const claims = world.getClaims();
    currentClaims = claims;
    const ids = Object.keys(claims);

    if (sharedWorldActive) {
      claimLandBtn.disabled = ids.some((id) => claims[id].ownerId === myUserId);
    }

    for (const id of ids) {
      const claim = claims[id];
      const [wx, wy, wz] = cellToWorld(...claim.center, SCALE);
      const points = claimFootprintWorldVertices(claim, SCALE).map(([x, y, z]) => new THREE.Vector3(x - wx, y - wy, z - wz));
      const hullGeom = new ConvexGeometry(points);
      const mine = claim.ownerId === myUserId;
      const hullMat = new THREE.MeshBasicMaterial({
        color: mine ? CLAIM_COLOR_MINE : CLAIM_COLOR_OTHER,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const hull = new THREE.Mesh(hullGeom, hullMat);
      hull.position.set(wx, wy, wz);
      claimGroup.add(hull);
    }

    if (!claimsListEl) return;
    claimsListEl.innerHTML = '';
    if (ids.length === 0) {
      claimsListEl.innerHTML = '<div class="placeholder">No claims granted yet.</div>';
      return;
    }
    for (const id of ids) {
      const claim = claims[id];
      const mine = claim.ownerId === myUserId;
      const row = document.createElement('div');
      row.className = 'claim-item';
      const label = document.createElement('span');
      label.textContent =
        `${mine ? '★ ' : ''}${id} — shell ${claim.shellIndex} — ` +
        `${mine ? 'you' : claim.ownerId.slice(0, 8)}`;
      row.appendChild(label);
      if (mine) {
        const toggle = document.createElement('label');
        toggle.className = 'claim-destructible-toggle';
        toggle.title = 'Protect this claim from black hole/supernova consumption';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = claim.destructible === false;
        checkbox.addEventListener('change', async () => {
          checkbox.disabled = true;
          try {
            const newValue = checkbox.checked ? false : true;
            await pushClaimDestructible(id, newValue);
            world.addClaim(id, { ...claim, destructible: newValue });
            refreshClaims();
          } catch (err) {
            checkbox.checked = !checkbox.checked; // revert on failure
            console.warn('Rhombiverse: destructible toggle failed', err);
          } finally {
            checkbox.disabled = false;
          }
        });
        toggle.appendChild(checkbox);
        toggle.appendChild(document.createTextNode('Protected'));
        row.appendChild(toggle);
      }
      claimsListEl.appendChild(row);
    }
  }

  // See docs/code-notes/render.md
  function rebuildSeedMeshes(seedId, seed) {
    const existing = growthMeshesBySeed.get(seedId);
    if (existing) {
      growthGroup.remove(existing);
      for (const child of existing.children) {
        child.geometry.dispose();
        child.material.dispose();
      }
      growthMeshesBySeed.delete(seedId);
    }
    if (seed.species.startsWith(ORGANISM_SEED_SPECIES_PREFIX)) return; // see docs/code-notes/render.md
    const group = new THREE.Group();
    const color = speciesColor(seed.species);
    seed.tiles.forEach((tile, tileIndex) => {
      const verts = tileWorldVertices(seed, tile).map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const geometry = new ConvexGeometry(verts);
      const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
      const tileMesh = new THREE.Mesh(geometry, material);
      tileMesh.userData.seedId = seedId;
      tileMesh.userData.tileIndex = tileIndex;
      group.add(tileMesh);
    });
    growthGroup.add(group);
    growthMeshesBySeed.set(seedId, group);
  }

  // Full rebuild -- every planted seed, from scratch. Used on init/
  // Shared World connect-disconnect/preset load, where the whole world
  // (not just one seed) may have changed.
  function rebuildAllGrowth() {
    for (const [seedId] of growthMeshesBySeed) {
      const group = growthMeshesBySeed.get(seedId);
      growthGroup.remove(group);
      for (const child of group.children) {
        child.geometry.dispose();
        child.material.dispose();
      }
    }
    growthMeshesBySeed.clear();
    for (const [seedId, seed] of Object.entries(world.getSeeds())) {
      rebuildSeedMeshes(seedId, seed);
    }
  }

  // See docs/code-notes/render.md
  const TRADE_MATERIALS = [
    ['base', 'Base Rhomb'],
    ['garnet', 'Garnet'],
    ['ferrostone', 'Ferrostone'],
    ['glassite', 'Glassite'],
    ['star-glassite', 'Star-Glassite'],
    ['blackstar-glassite', 'Blackstar-Glassite'],
  ];

  function shortId(id) {
    return id.slice(0, 8);
  }

  function formatOffer(offer) {
    return Object.entries(offer)
      .map(([material, amount]) => `${amount} ${material}`)
      .join(', ');
  }

  // Rebuilt trade UI (B6 task #40): the Lab-panel form/partner-list is
  // gone -- proposing a NEW trade now only happens via Interact (below),
  // triggered by proximity to another player's live avatar. This
  // simplified renderTradePanel() keeps just the pending-trades list,
  // useful when a trade's partner has since walked away or disconnected
  // and you want to check/cancel/confirm it without finding them again.
  function renderTradePanel() {
    const panel = document.getElementById('trade-panel');
    if (!panel) return;
    if (!sharedWorldActive || !myUserId) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';

    const tradesListEl = document.getElementById('pending-trades-list');
    const trades = world.getPendingTrades();
    const tradeIds = Object.keys(trades);
    tradesListEl.innerHTML = '';
    if (tradeIds.length === 0) {
      tradesListEl.innerHTML = '<div class="placeholder">No pending trades.</div>';
      return;
    }
    for (const id of tradeIds) {
      const trade = trades[id];
      const isA = trade.playerA === myUserId;
      const isB = trade.playerB === myUserId;
      if (!isA && !isB) continue; // shouldn't happen (RLS already scopes this), defensive only
      const myConfirmed = isA ? trade.confirmedA : trade.confirmedB;
      const partnerId = isA ? trade.playerB : trade.playerA;

      const row = document.createElement('div');
      row.className = 'ring-item';
      const label = document.createElement('span');
      label.textContent = `${formatOffer(trade.offerA)} ⇄ ${formatOffer(trade.offerB)} — with ${shortId(partnerId)}`;
      row.appendChild(label);

      if (!myConfirmed) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'ring-recolor';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          try {
            await pushTradeConfirm(id, isA);
          } catch (err) {
            console.warn('Rhombiverse: confirm trade failed', err);
            confirmBtn.disabled = false;
          }
        });
        row.appendChild(confirmBtn);
      } else {
        const waiting = document.createElement('span');
        waiting.className = 'placeholder';
        waiting.textContent = 'waiting for them';
        row.appendChild(waiting);
      }

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'ring-remove';
      cancelBtn.textContent = '×';
      cancelBtn.title = 'Cancel this trade';
      cancelBtn.addEventListener('click', () => pushTradeCancel(id));
      row.appendChild(cancelBtn);

      tradesListEl.appendChild(row);
    }
  }

  // --- B6 tasks #40/#42: player presence, in-world avatars, Interact --

  function currentPlayerWorldPosition() {
    return walking && player ? player.getPosition() : camera.position;
  }

  const displayNameInput = document.getElementById('display-name-input');
  if (displayNameInput) {
    displayNameInput.value = displayName;
    displayNameInput.addEventListener('change', () => {
      const trimmed = displayNameInput.value.trim();
      displayName = trimmed || loadDisplayName();
      displayNameInput.value = displayName;
      try { localStorage.setItem(DISPLAY_NAME_KEY, displayName); } catch { /* best-effort only */ }
    });
  }

  const avatarLayerEl = document.getElementById('avatar-layer');
  function clearAvatarLabels() {
    avatarLayerEl.innerHTML = '';
    avatarLabelEls.clear();
  }

  // See docs/code-notes/render.md
  const projectVec = new THREE.Vector3();
  function updateAvatarLabels() {
    const seen = new Set();
    for (const [id, presence] of Object.entries(otherPlayers)) {
      if (!presence.walking) continue; // only walking players have a meaningful in-world position, see the module-level comment on otherPlayers
      seen.add(id);
      projectVec.set(presence.x, presence.y, presence.z).project(camera);
      if (projectVec.z > 1) continue; // behind the camera
      let el = avatarLabelEls.get(id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'avatar-label';
        el.innerHTML = '<div class="avatar-dot"></div><div class="avatar-name"></div>';
        avatarLayerEl.appendChild(el);
        avatarLabelEls.set(id, el);
      }
      el.querySelector('.avatar-name').textContent = presence.name || shortId(id);
      const x = (projectVec.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projectVec.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.display = x < -50 || x > window.innerWidth + 50 || y < -50 || y > window.innerHeight + 50 ? 'none' : '';
    }
    for (const [id, el] of avatarLabelEls) {
      if (!seen.has(id)) {
        el.remove();
        avatarLabelEls.delete(id);
      }
    }
  }

  // See docs/code-notes/render.md
  const interactBtnEl = document.getElementById('interact-btn');
  function updateInteractProximity() {
    if (!sharedWorldActive || !walking || !player) {
      nearestInteractPartnerId = null;
      interactBtnEl.classList.remove('visible');
      return;
    }
    const myPos = player.getPosition();
    let nearestId = null;
    let nearestDist = Infinity;
    for (const [id, presence] of Object.entries(otherPlayers)) {
      if (!presence.walking) continue;
      const d = Math.hypot(presence.x - myPos.x, presence.y - myPos.y, presence.z - myPos.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = id;
      }
    }
    nearestInteractPartnerId = nearestDist <= INTERACT_RADIUS ? nearestId : null;
    interactBtnEl.classList.toggle('visible', nearestInteractPartnerId !== null && !interactOverlayEl.classList.contains('open'));
  }

  let presenceBroadcastAccum = 0;
  const PRESENCE_BROADCAST_INTERVAL = 0.3; // seconds -- frequent enough to feel live, far below realtime rate limits
  function tickPresence(dt) {
    if (!sharedWorldActive) return;
    updateAvatarLabels();
    updateInteractProximity();
    presenceBroadcastAccum += dt;
    if (presenceBroadcastAccum < PRESENCE_BROADCAST_INTERVAL) return;
    presenceBroadcastAccum = 0;
    const pos = currentPlayerWorldPosition();
    updatePresence({ name: displayName, x: pos.x, y: pos.y, z: pos.z, walking });
  }

  // --- The Interact panel: two-sided drag-and-accept offer view -------

  const interactOverlayEl = document.getElementById('interact-overlay');
  const interactPartnerNameEl = document.getElementById('interact-partner-name');
  const interactExistingEl = document.getElementById('interact-existing-trade');
  const interactProposeFormEl = document.getElementById('interact-propose-form');
  let interactPartnerId = null;
  let interactGiveMaterial = null;
  let interactGetMaterial = null;

  function closeInteractPanel() {
    interactOverlayEl.classList.remove('open');
    interactPartnerId = null;
  }
  document.getElementById('interact-close').addEventListener('click', closeInteractPanel);

  function findPendingTradeWith(partnerId) {
    const trades = world.getPendingTrades();
    for (const [id, trade] of Object.entries(trades)) {
      const involvesMe = trade.playerA === myUserId || trade.playerB === myUserId;
      const involvesPartner = trade.playerA === partnerId || trade.playerB === partnerId;
      if (involvesMe && involvesPartner) return [id, trade];
    }
    return null;
  }

  // See docs/code-notes/render.md
  function makeChipDraggable(chipEl, onDrop) {
    chipEl.addEventListener('pointerdown', (e) => {
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;
      let ghost = null;
      const onMove = (ev) => {
        if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
          dragging = true;
          ghost = chipEl.cloneNode(true);
          ghost.classList.add('interact-chip-ghost');
          document.body.appendChild(ghost);
        }
        if (dragging && ghost) {
          ghost.style.left = `${ev.clientX}px`;
          ghost.style.top = `${ev.clientY}px`;
          document.querySelectorAll('.interact-dropzone').forEach((zone) => {
            zone.classList.toggle('drag-over', zone === document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.interact-dropzone'));
          });
        }
      };
      const onUp = (ev) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.querySelectorAll('.interact-dropzone').forEach((zone) => zone.classList.remove('drag-over'));
        if (dragging && ghost) {
          ghost.remove();
          const zone = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.interact-dropzone');
          onDrop(zone?.id ?? null);
        } else {
          onDrop(null);
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function renderOfferZone(zoneId, material, maxQty, onQtyChange) {
    const zone = document.getElementById(zoneId);
    const content = zone.querySelector('.interact-dropzone-content');
    if (!material) {
      content.innerHTML = '';
      content.textContent = 'drag or tap a material above';
      return;
    }
    content.innerHTML = '';
    const chip = document.createElement('div');
    chip.className = 'interact-offer-chip';
    const label = document.createElement('span');
    label.textContent = TRADE_MATERIALS.find(([v]) => v === material)?.[1] ?? material;
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.max = String(maxQty);
    qtyInput.value = '1';
    qtyInput.addEventListener('input', () => {
      const clamped = Math.max(1, Math.min(maxQty, Math.floor(Number(qtyInput.value)) || 1));
      qtyInput.value = String(clamped); // reflect the clamp -- typing a value outside min/max isn't blocked by the browser on its own
      onQtyChange(clamped);
    });
    chip.appendChild(label);
    chip.appendChild(qtyInput);
    content.appendChild(chip);
  }

  let interactGiveQty = 1;
  let interactGetQty = 1;
  function updateSendButtonState() {
    document.getElementById('interact-send-btn').disabled = !interactGiveMaterial || !interactGetMaterial;
  }

  function renderInteractProposeForm() {
    const inventory = world.getInventory();
    const myInv = inventory[myUserId] ?? {};
    const theirInv = inventory[interactPartnerId] ?? {};

    const yourStrip = document.getElementById('interact-your-materials');
    yourStrip.innerHTML = '';
    for (const [material, entry] of Object.entries(myInv)) {
      if (entry.quantity <= 0) continue;
      const chip = document.createElement('div');
      chip.className = 'interact-chip';
      chip.textContent = `${TRADE_MATERIALS.find(([v]) => v === material)?.[1] ?? material} ×${entry.quantity}`;
      makeChipDraggable(chip, (zoneId) => {
        if (zoneId === 'interact-get-zone') return; // your own material doesn't belong in "you get"
        interactGiveMaterial = material;
        interactGiveQty = 1;
        renderOfferZone('interact-give-zone', material, entry.quantity, (q) => { interactGiveQty = q; });
        updateSendButtonState();
      });
      yourStrip.appendChild(chip);
    }
    if (!yourStrip.children.length) yourStrip.innerHTML = '<div class="placeholder">You have nothing to offer yet.</div>';

    const theirStrip = document.getElementById('interact-their-materials');
    theirStrip.innerHTML = '';
    for (const [material, entry] of Object.entries(theirInv)) {
      if (entry.quantity <= 0) continue;
      const chip = document.createElement('div');
      chip.className = 'interact-chip';
      chip.textContent = `${TRADE_MATERIALS.find(([v]) => v === material)?.[1] ?? material} ×${entry.quantity}`;
      makeChipDraggable(chip, (zoneId) => {
        if (zoneId === 'interact-give-zone') return; // their material doesn't belong in "you give"
        interactGetMaterial = material;
        interactGetQty = 1;
        renderOfferZone('interact-get-zone', material, Math.max(entry.quantity, 999), (q) => { interactGetQty = q; });
        updateSendButtonState();
      });
      theirStrip.appendChild(chip);
    }
    if (!theirStrip.children.length) theirStrip.innerHTML = '<div class="placeholder">Nothing known yet.</div>';

    interactGiveMaterial = null;
    interactGetMaterial = null;
    renderOfferZone('interact-give-zone', null);
    renderOfferZone('interact-get-zone', null);
    updateSendButtonState();
  }

  document.getElementById('interact-send-btn').addEventListener('click', async () => {
    const hint = document.getElementById('interact-propose-hint');
    if (!interactGiveMaterial || !interactGetMaterial || !interactPartnerId) return;
    const held = world.getInventory()[myUserId]?.[interactGiveMaterial]?.quantity ?? 0;
    if (held < interactGiveQty) {
      hint.textContent = `You only have ${held}.`;
      return;
    }
    const tradeId = `trade_${shortId(myUserId)}_${Date.now()}`;
    hint.textContent = 'Sending…';
    try {
      await pushTradePropose(tradeId, myUserId, { [interactGiveMaterial]: interactGiveQty }, interactPartnerId, { [interactGetMaterial]: interactGetQty });
      hint.textContent = 'Offer sent — waiting for confirmation.';
      renderInteractPanel();
    } catch (err) {
      console.warn('Rhombiverse: propose trade failed', err);
      hint.textContent = 'Failed to send the offer (see console).';
    }
  });

  function renderInteractExistingTrade(tradeId, trade) {
    const isA = trade.playerA === myUserId;
    const myConfirmed = isA ? trade.confirmedA : trade.confirmedB;
    const myOffer = isA ? trade.offerA : trade.offerB;
    const theirOffer = isA ? trade.offerB : trade.offerA;
    document.getElementById('interact-existing-summary').textContent =
      `You give ${formatOffer(myOffer)} for ${formatOffer(theirOffer)}.` + (myConfirmed ? ' You have confirmed -- waiting on them.' : '');
    const confirmBtn = document.getElementById('interact-confirm-btn');
    confirmBtn.style.display = myConfirmed ? 'none' : '';
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try { await pushTradeConfirm(tradeId, isA); }
      catch (err) { console.warn('Rhombiverse: confirm trade failed', err); confirmBtn.disabled = false; }
    };
    document.getElementById('interact-cancel-btn').onclick = () => { pushTradeCancel(tradeId); closeInteractPanel(); };
  }

  function renderInteractPanel() {
    if (!interactPartnerId) return;
    interactPartnerNameEl.textContent = otherPlayers[interactPartnerId]?.name ?? shortId(interactPartnerId);
    const existing = findPendingTradeWith(interactPartnerId);
    interactExistingEl.style.display = existing ? '' : 'none';
    interactProposeFormEl.style.display = existing ? 'none' : '';
    if (existing) renderInteractExistingTrade(existing[0], existing[1]);
    else renderInteractProposeForm();
  }

  function openInteractPanel(partnerId) {
    if (!partnerId) return;
    interactPartnerId = partnerId;
    document.getElementById('interact-propose-hint').textContent = '';
    renderInteractPanel();
    interactOverlayEl.classList.add('open');
    interactBtnEl.classList.remove('visible');
  }

  interactBtnEl.addEventListener('click', () => openInteractPanel(nearestInteractPartnerId));
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (interactOverlayEl.classList.contains('open')) { closeInteractPanel(); return; }
    if (nearestInteractPartnerId) openInteractPanel(nearestInteractPartnerId);
  });
  tickPresenceFn = tickPresence;

  // Claim Land button -- see docs/code-notes/render.md
  claimLandBtn.addEventListener('click', async () => {
    if (!sharedWorldActive || !myUserId) return;
    claimLandBtn.disabled = true;
    try {
      const focus = walking ? camera.position : controls.target;
      const [ox, oy, oz] = nearestValidCell(focus.x / SCALE, focus.y / SCALE, focus.z / SCALE);
      const { claimId, claimData } = computeClaim(world, myUserId, undefined, { x: ox, y: oy, z: oz });
      await pushClaim(claimId, claimData);
      world.addClaim(claimId, claimData);
      refreshClaims();
      toastNewAchievements(checkAchievements({ world, planetoids })); // claim-granting doesn't route through onChange() either
      claimHint.textContent =
        `Claimed ${claimId}: center [${claimData.center.join(', ')}], ` +
        `shell ${claimData.shellIndex}, size ${claimData.size}.`;
    } catch (err) {
      claimHint.textContent = `Claim failed: ${err.message}`;
      console.warn('Rhombiverse: claim failed', err);
    } finally {
      claimLandBtn.disabled =
        !FEATURES.economy || !sharedWorldActive || Object.values(world.getClaims()).some((c) => c.ownerId === myUserId);
    }
  });

  // See docs/code-notes/render.md
  function setLocalResetControlsEnabled(enabled) {
    newWorldBtn.disabled = !enabled;
    importInput.disabled = !enabled;
    loadPresetBtn.disabled = !enabled;
  }

  // claimLandBtn is the inverse of the above -- disabled OUTSIDE Shared
  // World (ownership is meaningless in a world only you can see), enabled
  // only while connected. Also stays disabled whenever FEATURES.economy
  // is off, same reasoning as this panel's own display:none above --
  // Shared World connecting shouldn't be able to re-surface a claims UI
  // that's supposed to not exist for this session.
  function setClaimLandEnabled(enabled) {
    claimLandBtn.disabled = !enabled || !FEATURES.economy;
    if (!enabled || !FEATURES.economy) claimHint.textContent = '';
  }

  async function enableSharedWorld() {
    if (sharedWorldActive) return;
    if (
      !confirm(
        'Switch to the shared world? This replaces your current view with the live shared build. ' +
          'Your local save is untouched and returns automatically when you disable Shared World.'
      )
    ) {
      return;
    }
    sharedWorldToggle.disabled = true;
    sharedWorldHint.textContent = 'Shared World: connecting…';
    try {
      const session = await ensureAnonymousSession();
      myUserId = session.user.id;
      const shared = await loadSharedWorld();
      world.replaceAll(shared);
      // Set BEFORE seedAsteroidBelts (and onChange()) -- a real bug
      // caught only by a live two-session test, not by review: this used
      // to be set AFTER seeding, so every seeded cell's world.addCell
      // call fired its onAdd hook while sharedWorldActive was still
      // false, meaning handleLocalAdd's own `if (sharedWorldActive...)`
      // guard skipped pushCellUpsert entirely -- asteroid belts have been
      // purely local/cosmetic in Shared World this whole time, never
      // actually reaching Supabase. Also still needed for onChange()'s
      // own localStorage guard and the undo button's disabled state to
      // already reflect shared mode for this first render.
      sharedWorldActive = true;
      // Idempotent (checks for existing asteroid-tagged cells first) --
      // safe even if a previous session already seeded this shared world.
      // A rare race exists if two sessions connect to a truly fresh
      // (never-seeded) Shared World simultaneously -- both could seed
      // independently, upserting the same positions with possibly
      // different random materials. Not catastrophic (same idempotent
      // upsert mechanism as any other concurrent cell write), just
      // slightly wasteful; not worth distributed-locking machinery for a
      // one-time bootstrap case. See CLAUDE.md's asteroids status.
      seedAsteroidBelts(world);
      onChange();
      refreshClaims();
      unsubscribeShared = subscribeToSharedWorld({
        onRemoteUpsert: applyRemoteUpsert,
        onRemoteDelete: applyRemoteDelete,
        onRemoteClaim: applyRemoteClaim,
        onRemoteRegrowthSet: applyRemoteRegrowthSet,
        onRemoteRegrowthClear: applyRemoteRegrowthClear,
        onRemoteInventory: applyRemoteInventory,
        onRemoteTrade: applyRemoteTrade,
        onRemoteTradeClear: applyRemoteTradeClear,
        onRemoteSeedSet: applyRemoteSeedSet,
        onRemoteSeedClear: applyRemoteSeedClear,
      });
      renderTradePanel();
      rebuildAllGrowth();
      setLocalResetControlsEnabled(false);
      setClaimLandEnabled(true);
      const startPos = currentPlayerWorldPosition();
      unsubscribePresence = subscribeToPresence(
        myUserId,
        { name: displayName, x: startPos.x, y: startPos.y, z: startPos.z, walking },
        (others) => { otherPlayers = others; }
      );
      sharedWorldToggle.textContent = 'Disable Shared World';
      sharedWorldHint.textContent = 'Shared World: live — building here syncs to everyone in realtime.';
    } catch (err) {
      sharedWorldActive = false;
      sharedWorldHint.textContent = 'Shared World: failed to connect (see console).';
      console.warn('Rhombiverse: failed to enable Shared World', err);
    } finally {
      sharedWorldToggle.disabled = false;
    }
  }

  async function disableSharedWorld() {
    if (!sharedWorldActive) return;
    sharedWorldActive = false;
    if (unsubscribeShared) {
      unsubscribeShared();
      unsubscribeShared = null;
    }
    if (unsubscribePresence) {
      unsubscribePresence();
      unsubscribePresence = null;
    }
    otherPlayers = {};
    clearAvatarLabels();
    closeInteractPanel();
    const local = loadFromLocalStorage() ?? (await loadWorld('./data/starter-world.json'));
    world.replaceAll(local);
    seedAsteroidBelts(world); // no-op if `local` already has its own asteroid cells -- see load-preset's own comment on why this call is needed after any replaceAll()
    onChange();
    setLocalResetControlsEnabled(true);
    setClaimLandEnabled(false);
    myUserId = null;
    refreshClaims();
    renderTradePanel();
    rebuildAllGrowth();
    sharedWorldToggle.textContent = 'Enable Shared World';
    sharedWorldHint.textContent = 'Shared World: off.';
  }

  sharedWorldToggle.addEventListener('click', () => {
    if (sharedWorldActive) disableSharedWorld();
    else enableSharedWorld();
  });

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
    // target.set(0,0,0) reset. Exits Walk mode first if active, since a
    // walking player's camera is driven by the player controller every
    // frame, not by controls.target directly -- the orbit reset alone
    // wouldn't be visible until Walk mode itself is off.
    if (walking) document.getElementById('walk-toggle')?.click();
    camera.position.set(6, 5, 8);
    controls.target.set(0, 0, 0);
    controls.update();
    saveCameraState(camera.position, controls.target);
    clearLocalStorage();
    const fresh = await loadWorld('./data/starter-world.json');
    world.replaceAll(fresh);
    seedAsteroidBelts(world); // matches what a true first visit gets, see load-preset's own comment
    onChange();
    rebuildAllGrowth();
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
  }
  document.getElementById('new-world').addEventListener('click', clearWorldToNew);
  document.getElementById('clear-world-toggle')?.addEventListener('click', clearWorldToNew);
  document.getElementById('reload-toggle')?.addEventListener('click', () => {
    location.reload();
  });

  document.getElementById('export-json').addEventListener('click', () => {
    exportWorldFile({ ...world.toJSON(), planetoids });
  });

  // B6 Shared Worlds Gallery -- requires Shared World (a real Supabase
  // account is needed for the shared_worlds table's RLS insert policy,
  // author_id = auth.uid()), same boundary claims already use. Requires
  // schema.sql's shared_worlds table to actually exist server-side --
  // if that migration hasn't been run yet, fetch/publish calls below
  // fail cleanly into their own catch blocks with a real error message,
  // not a crash.
  const galleryOverlay = document.getElementById('gallery-overlay');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryGated = document.getElementById('gallery-gated');
  const galleryPublishRow = document.getElementById('gallery-publish-row');

  function captureThumbnail() {
    // Downscale from the real canvas so a gallery row stays small --
    // full-resolution screenshots would bloat every fetchGalleryWorlds()
    // call for no visual benefit at thumbnail size.
    const THUMB_W = 320;
    const THUMB_H = 240;
    const src = renderer.domElement;
    const off = document.createElement('canvas');
    off.width = THUMB_W;
    off.height = THUMB_H;
    off.getContext('2d').drawImage(src, 0, 0, src.width, src.height, 0, 0, THUMB_W, THUMB_H);
    return off.toDataURL('image/png');
  }

  async function renderGalleryGrid() {
    galleryGrid.innerHTML = '<div class="sculpt-hint">Loading…</div>';
    try {
      const worlds = await fetchGalleryWorlds();
      galleryGrid.innerHTML = '';
      if (worlds.length === 0) {
        galleryGrid.innerHTML = '<div class="sculpt-hint">No Worlds published yet -- be the first.</div>';
        return;
      }
      for (const w of worlds) {
        const item = document.createElement('div');
        item.className = 'gallery-card-item';
        item.innerHTML = `<img src="${w.thumbnail ?? ''}" alt="" /><div class="gallery-title"></div>`;
        item.querySelector('.gallery-title').textContent = w.title;
        item.addEventListener('click', async () => {
          try {
            const data = await fetchGalleryWorldData(w.id);
            world.replaceAll(data);
            seedAsteroidBelts(world); // see load-preset's own comment
            onChange();
            rebuildAllGrowth();
            galleryOverlay.classList.remove('open');
            showHudPrompt(`Loaded "${w.title}" from the Gallery.`, 4000);
          } catch (err) {
            console.warn('Rhombiverse: failed to load gallery world', err);
            showHudPrompt('Could not load that World.', 4000);
          }
        });
        galleryGrid.appendChild(item);
      }
    } catch (err) {
      console.warn('Rhombiverse: failed to fetch gallery', err);
      galleryGrid.innerHTML = '<div class="sculpt-hint">Could not reach the Gallery (has the shared_worlds table been set up yet?).</div>';
    }
  }

  document.getElementById('open-gallery')?.addEventListener('click', () => {
    galleryOverlay.classList.add('open');
    const usable = sharedWorldActive && myUserId;
    galleryGated.style.display = usable ? 'none' : '';
    galleryPublishRow.style.display = usable ? '' : 'none';
    galleryGrid.style.display = usable ? '' : 'none';
    if (usable) renderGalleryGrid();
  });
  document.getElementById('gallery-close')?.addEventListener('click', () => {
    galleryOverlay.classList.remove('open');
  });
  galleryOverlay?.addEventListener('click', (e) => {
    if (e.target === galleryOverlay) galleryOverlay.classList.remove('open');
  });
  document.getElementById('gallery-publish-btn')?.addEventListener('click', async () => {
    const titleInput = document.getElementById('gallery-publish-title');
    const hint = document.getElementById('gallery-publish-hint');
    const title = titleInput.value.trim();
    if (!title) {
      hint.textContent = 'Give your World a title first.';
      return;
    }
    hint.textContent = 'Publishing…';
    try {
      const thumbnail = captureThumbnail();
      await publishToGallery(title, world.toJSON(), thumbnail);
      hint.textContent = 'Published! Refreshing the gallery…';
      titleInput.value = '';
      renderGalleryGrid();
    } catch (err) {
      console.warn('Rhombiverse: gallery publish failed', err);
      hint.textContent = 'Could not publish (has the shared_worlds table been set up yet?).';
    }
  });

  document.getElementById('share-world')?.addEventListener('click', async () => {
    const hint = document.getElementById('share-world-hint');
    if (!compressionSupported()) {
      hint.textContent = "Your browser doesn't support the compression this needs -- try a recent Chrome/Firefox/Safari.";
      return;
    }
    hint.textContent = 'Compressing…';
    try {
      const encoded = await encodeWorldForUrl(world.toJSON());
      const shareUrl = buildShareUrl(encoded);
      await navigator.clipboard.writeText(shareUrl);
      hint.textContent = `Link copied (${shareUrl.length} chars) -- paste it anywhere; opening it loads this exact World.`;
    } catch (err) {
      console.warn('Rhombiverse: world share failed', err);
      hint.textContent = 'Could not create a share link for this World (it may be too large).';
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
      seedAsteroidBelts(world); // see load-preset's own comment
      onChange();
      rebuildAllGrowth();
    } catch (err) {
      alert('That file is not valid Rhombiverse world JSON.');
      console.warn('Rhombiverse: import failed', err);
    } finally {
      importInput.value = '';
    }
  });

  // Presets: ready-built structures (data/presets/*.json) loaded the
  // same way New World does -- a full world.replaceAll(), confirm-gated
  // since it's destructive. Exists because precise face-by-face clicking
  // to hand-build something like a 20-BSG-cell black hole is genuinely
  // fragile (real face targeting needs the shared-face midpoint between
  // two cell centers, not either center itself, and a fixed camera plus
  // a growing structure can walk distant click targets off-canvas or into
  // occlusion -- both hit for real while verifying the frost line this
  // session) -- these presets are generated via the actual lattice math
  // (NEIGHBOR_OFFSETS-driven, not hand-derived coordinates) so they're
  // guaranteed valid, and double as reliable fixtures for future tests.
  // See docs/code-notes/render.md
  document.getElementById('load-preset').addEventListener('click', async () => {
    const key = document.getElementById('preset-select').value;
    if (!key) return;
    if (!confirm('Load this preset? This clears your current build.')) return;
    const path = key.startsWith('growth:')
      ? `./data/growth-presets/${key.slice('growth:'.length)}.json`
      : `./data/presets/${key}.json`;
    const preset = await loadWorld(path);
    if (!confirmLargeWorldLoad(preset)) return;
    world.replaceAll(preset);
    seedAsteroidBelts(world); // re-seed after the full replace -- see docs/code-notes/render.md
    onChange();
    rebuildAllGrowth();
  });

  // 5s idle-time tick: asteroid regrowth, inventory decay, growth, and
  // evolution catch-up. Deliberately does NOT go through onChange() --
  // see docs/code-notes/render.md for why, and for a real bug history
  // on the evolution-save condition below.
  setInterval(() => {
    // Model vs. World Separation (reframe Stage 2): this tick IS "all
    // time-based and agent-based simulation" for the whole app -- every
    // World System with a clock (asteroid regrowth, inventory decay,
    // growth, ecosystem/animal catch-up) funnels through this single
    // interval, nothing else runs on a timer. Freezing model mode here,
    // as one early return, is exhaustive rather than freezing each
    // sub-system individually and risking missing one. Does NOT freeze
    // hydrosphere/black-hole/star/supernova checks -- those are reactive
    // (re-evaluated on onChange(), i.e. player action, not elapsed time)
    // and out of this stage's scope, which named growth/ecosystem/animal
    // specifically.
    if (workspaceMode !== 'world') return;
    const before = world.entries().length;
    applyAsteroidRegeneration(world);
    applyPopulationScaledSpawning(world);
    applyInventoryDecay(world);
    updateInventoryHint();
    if (applyGrowth(world, Date.now())) {
      rebuildAllGrowth();
      if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
    }
    // Saves on every tick with >=1 organism (not just when something
    // visibly changed) -- see docs/code-notes/render.md for the real
    // lost-baseline bug this fixes.
    if (!sharedWorldActive && Object.keys(world.getOrganisms()).length > 0) {
      if (resolveEvolution(world, Date.now())) rebuildAllGrowth();
      saveToLocalStorage(world.toJSON());
    }
    refreshOrganismsSnapshot(world);
    updateEvolutionInfo();
    if (world.entries().length === before) return;
    rebuildInstances(mesh, world, currentMode === 'report');
    if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
  }, 5000);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// tickPresenceFn: init()-scoped logic bridged to this module-level slot --
// see docs/code-notes/render.md.
let tickPresenceFn = () => {};

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

  if (walking && player) {
    player.update(dt);
    // player position changes every frame, unlike Build mode's onChange-driven updates
    updateGravityInfo();
    updateBeltHint();
    updateEvolutionInfo();
  } else {
    controls.update();
  }
  tickPresenceFn(dt);
  // Skip the (otherwise fully-hidden) world render while the Rhombic
  // Wheel 3D is open -- its own overlay/renderer covers the whole
  // screen, so this pass would be pure wasted GPU work every frame.
  // Everything else above (presence ticking, controls damping) still
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
