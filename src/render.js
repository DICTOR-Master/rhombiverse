// Three.js scene, camera, RD mesh generation, instanced rendering.
// Phase 1 (RHOMBIVERSE_PLAN.md section 4): renderer + lattice math, camera
// orbit. Phase 2: wires build.js's click-to-add/remove controller onto
// the same InstancedMesh, re-syncing it after every world-state change.
// Phase 3: every change also saves to localStorage, and wires the New
// World / Export / Import buttons.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, cellToWorld, parseCellKey, nearestValidCell, isValidCell } from './lattice.js';
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
} from './latticezoom.js';
import { loadWorld, createWorldStore } from './worldstate.js';
import { createBuildController, removeShell, recolorShell } from './build.js';
import { generatePlanetoid } from './planetoidgen.js';
import { getSettings, updateSettings, onSettingsChange, QUALITY_PIXEL_RATIO_FACTOR } from './settings.js';
import { playPlaceSound, playRemoveSound, playMenuSound } from './sfx.js';
import { createRhombicWheel } from './wheel.js';
import { createCyborgMode } from './cyborg.js';
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
} from './sculpture.js';
import { matchNeighborOffset } from './build.js';
import { computePlanetoids, gravityAt, nearestPlanetoid } from './gravity.js';
import { applyHydrosphere } from './hydrosphere.js';
import { applyBlackHoleConsumption, applyAsymptoticGeneration, annotateBlackHoles } from './blackhole.js';
import { applyStarFusion, annotateStars, canPlaceMaterial as canPlaceForStars } from './starsystem.js';
import { applyDetonationCheck, annotateSupernovae } from './supernova.js';
import { createPlayerController } from './player.js';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  exportWorldFile,
  importWorldFile,
} from './persistence.js';
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
} from './sync.js';
import { computeClaim, claimFootprintWorldVertices } from './regions.js';
import {
  seedAsteroidBelts,
  applyAsteroidRegeneration,
  applyPopulationScaledSpawning,
  listBelts,
} from './asteroids.js';
// proposeTrade/confirmTrade/cancelTrade (trade.js's own local-only
// implementations) are deliberately NOT used from here -- trading
// fundamentally needs two distinct real player identities, which local
// single-player mode has no concept of (myUserId is null there); the
// trade panel below only ever shows while Shared World is connected,
// where every trade action goes through sync.js's server-backed
// pushTradePropose/Confirm/Cancel instead.
import { applyInventoryDecay } from './trade.js';
import { GROWTH_TEMPLATES, plantSeed, applyGrowth, tileWorldVertices, pruneTile, VALID_TRIPLES, unitTileVertices } from './growth.js';
import {
  createCultivationSession,
  proposeCultivationSite,
  acceptCultivationSuggestion,
  dismissCultivationSuggestion,
  requestCultivationIntent,
  executeCultivationIntent,
} from './cultivation.js';
import {
  GENOME_TRAIT_RANGES,
  plantOrganism,
  resolveCatchUpForAllPlanetoids,
  averageTraitValue,
  planetoidKeyFor,
  localBiomassAvailability,
} from './evolution.js';
import {
  LAND_CREATURE_SPECIES,
  SEA_CREATURE_SPECIES,
  ANIMAL_TRAIT_RANGES,
  plantAnimal,
  animalGenerationStepHook,
  reproduceFn,
  computeAnimalSurvivalProbability,
} from './animals.js';

const SCALE = 1;
// Fixed InstancedMesh capacity. Cumulative cells through shell 8 alone is
// ~2057 (see lattice.js's shellCount); 20000 leaves headroom for several
// shell-fills plus hand-building. Revisit for real player counts.
const MAX_CELLS = 20000;
// Real, enforced cap on the shell-count/hollow-from UI inputs --
// cumulative cells through shell 15 is 12431 (1 + sum of shellCount(n)
// for n=1..15), leaving real headroom under MAX_CELLS for hand-built
// cells or a second structure. Previously these had inconsistent,
// PURELY COSMETIC max= HTML attributes that didn't actually stop anyone
// from typing past them -- a real bug (shell-count had nothing stopping
// a request for shell 100, ~200k+ cells, far past MAX_CELLS) as well as
// a confusing inconsistency, caught by the user.
const MAX_SHELL = 15;

// pushCellUpsert/pushCellDelete (sync.js) previously only console.warn'd
// on failure -- fine for transient network blips, but it meant a real
// rejection (e.g. schema.sql's cells_rate_limit trigger, added
// 2026-08-13) would silently desync a player's view from the shared
// world with zero visible feedback. This surfaces it without being
// disruptive: one line, auto-hides, and re-triggering while already
// visible just resets the hide timer rather than stacking/spamming --
// a legitimate large Fill/Generate burst that trips the rate limit
// could otherwise fire this dozens of times in a row.
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
renderer.localClippingEnabled = true; // required once, globally, for any clippingPlanes to take effect
document.getElementById('app').appendChild(renderer.domElement);

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
// scope (it needs to run from the same call sites as updateGravityInfo,
// several of which are also module-level) but the underlying `organisms`
// registry only ever changes inside init()/onChange()/the periodic
// catch-up tick, all of which already have `world` in scope to refresh
// this from directly.
let organismsSnapshot = {};

// Shared World (Phase 5) state. sharedWorldActive gates both directions
// of sync: whether local mutations get pushed (handleLocalAdd/Remove,
// wired into createWorldStore's hooks below) and whether onChange()/the
// Undo button are allowed to overwrite localStorage (see their own
// guards) -- while connected, localStorage must stay frozen at whatever
// the player's private build was, or switching back would silently lose
// it. applyingRemote suppresses handleLocalAdd/Remove specifically while
// a just-received remote change is being written into the local store
// (applyRemoteUpsert/applyRemoteDelete in init()), which would otherwise
// immediately re-push what was just received and feedback-loop with
// every other connected client doing the same.
let sharedWorldActive = false;
let applyingRemote = false;
let unsubscribeShared = null;
// This session's anonymous auth.uid(), captured once on enableSharedWorld
// -- ownership (RHOMBIVERSE_SPEC_REGIONS.md) only means anything with a
// real per-player identity, which local-only play doesn't have.
let myUserId = null;

function handleLocalAdd(x, y, z, data) {
  if (sharedWorldActive && !applyingRemote) pushCellUpsert(x, y, z, data);
}
function handleLocalRemove(x, y, z) {
  if (sharedWorldActive && !applyingRemote) pushCellDelete(x, y, z);
}
// RHOMBIVERSE_SPEC_ASTEROIDS.md section 4: same push-on-local-mutation
// pattern as cells above, wired into worldstate.js's setRegrowthEntry/
// removeRegrowthEntry hooks -- so ANY connected client processing a
// pending regrowth (not just whoever originally mined the cell) pushes
// that outcome for everyone else too.
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
// RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 10, closed 2026-08-13: same
// push-on-local-mutation pattern as regrowth above, wired into
// worldstate.js's setSeed/removeSeed hooks -- covers both the initial
// Plant-mode click (plantSeed calls world.setSeed once) and every later
// growth tick (applyGrowth calls world.setSeed again per seed that grew),
// so a planted seed's growth is visible to every connected player over
// time, not just a one-shot placement.
function handleLocalSeedSet(seedId, seedData) {
  if (sharedWorldActive && !applyingRemote) pushSeedSet(seedId, seedData);
}
function handleLocalSeedClear(seedId) {
  if (sharedWorldActive && !applyingRemote) pushSeedClear(seedId);
}

// Shown near the mode controls regardless of Build/Walk mode -- useful
// even when nothing is active yet ("no gravity source"), so it doubles as
// a hint for how to create one. Reads `controls.target` in Build mode (a
// reasonable proxy for "what you're looking at") and the live player
// position while walking.
function updateGravityInfo() {
  const el = document.getElementById('gravity-info');
  if (!el) return;
  const refPos = walking && player ? player.getPosition() : controls.target;
  const nearest = nearestPlanetoid(refPos, planetoids);
  if (!nearest) {
    el.textContent = 'No planetoid yet — place a Blackstar-Glassite cell to create a gravity source.';
    return;
  }
  // Distinguishes "gravity active" from "gravity WOULD be active, but
  // you're standing in a protected claim" -- gravityAt is the real
  // physics function (RHOMBIVERSE_SPEC_LOOPHOLES.md section 5), so the
  // hint reads the same source of truth player.js actually acts on
  // rather than showing "active" for a pull that isn't really happening.
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

// RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md Stage 9: the one call site that
// actually drives the Stage 1-7 catch-up engine, which until now was
// real, tested, and 100% inert in the live game (nothing called it).
// Resolves every planetoid's own organisms independently (Stage 6's
// isolation), returns whether anything actually changed (new offspring,
// removed-by-selection organisms, or ordinary growth) so the caller only
// pays for a rebuildAllGrowth() when something real happened -- same
// "cheap no-op most ticks" shape growth.js's own applyGrowth already has.
// Deliberately local-only for this pass: `organisms`/`planetoidEvolution`
// have no Supabase sync path yet (unlike `seeds`, which gained one
// earlier this session) -- flagged honestly as a known gap rather than
// silently assumed solved, same discipline as every other deferred-sync
// registry this project has shipped before its own sync pass existed.
function resolveEvolution(world, now) {
  const organismIds = Object.keys(world.getOrganisms());
  if (organismIds.length === 0) return false;
  // RHOMBIVERSE_SPEC_ANIMALS.md Stages B-D: all three overrides
  // (animalGenerationStepHook -- movement + predation, reproduceFn --
  // sexual mate-pairing, computeAnimalSurvivalProbability -- huntBias-
  // blended herbivory/carnivory survival odds) are no-ops/pure delegates
  // for every non-animal organism (amoeba/plant), so passing them here
  // unconditionally is safe and correct regardless of what's actually
  // planted -- this is the one real wiring point Animals' own mechanics
  // needed to go live in the actual game.
  const results = resolveCatchUpForAllPlanetoids(world, organismIds, now, animalGenerationStepHook, reproduceFn, computeAnimalSurvivalProbability);
  return Object.values(results).some((r) => r.generationsResolved > 0);
}

// Refreshes organismsSnapshot with each organism's own seed origin
// pre-attached -- keeps updateEvolutionInfo below fully self-contained
// (reads only module-level state, same as updateGravityInfo/
// updateBeltHint), rather than needing `world` itself in scope, which
// isn't available to the module-level call sites (e.g. the animate()
// render loop) this needs to run from.
function refreshOrganismsSnapshot(world) {
  const seeds = world.getSeeds();
  organismsSnapshot = Object.fromEntries(
    Object.entries(world.getOrganisms()).map(([id, o]) => [id, { ...o, origin: seeds[o.seedId]?.origin }])
  );
}

// RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md section 9's own read-only
// "inspect dominant traits" tool -- observation only, never a breeding/
// culling control, per that section's explicit governing decision. Scoped
// to whichever planetoid updateGravityInfo is already reporting on (same
// refPos logic), so a player reads "what's evolving HERE" rather than a
// whole-world aggregate that would blur together isolated planetoids
// (RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md section 6's own Isolation law
// -- a UI that averaged across planetoids would visually contradict the
// very isolation the simulation itself enforces).
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
  // Same planetoid-grouping key evolution.js's own groupOrganismsByPlanetoid
  // uses, so "here" means the exact same planetoid the catch-up engine
  // itself resolves independently -- not re-derived a second way.
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

// RHOMBIVERSE_SPEC_ASTEROIDS.md UI: belts sit 80+ units from the default
// camera framing -- without this, a player has no way to discover or
// reach them at all short of reading source. listBelts() is a pure
// function of fixed constants (no world dependency), so this can be
// module-level like updateGravityInfo, needing no world-state access.
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
}

// B2's Explore transition sequence -- HUD fade, camera settle, a gravity
// engagement cue, and a horizon change, replacing the old instant toggle.
// `walking` still flips true/false at the START of its respective
// transition (build.js's getMode() already keys off it to disable
// editing while walking/transitioning, same as before) -- only the
// ACTUAL control handoff (player.setEnabled/requestLock, or restoring
// OrbitControls) and the walk-toggle/hint text are delayed until the
// sequence finishes. walkTransitioning guards against re-entry (a stray
// pointerlockchange during the sequence, a second Explore pick, etc.).
const SPACE_BG_COLOR = new THREE.Color(0x05050a);
const WALK_BG_COLOR = new THREE.Color(0x0d1420); // a faint atmosphere tint stands in for "horizon change" -- this project has no separate skybox/horizon system to hook into
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
    player.reset(camera.position);
    player.setEnabled(true);
    player.requestLock();
    walkTransitioning = false;
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

// Browsers exit pointer lock on their own (Esc, tab switch, etc.) without
// going through exitWalk() -- this catches that so Walk mode's own state
// (controls.enabled, the toggle button label) never gets out of sync with
// the actual lock state.
document.addEventListener('pointerlockchange', () => {
  if (walking && document.pointerLockElement !== renderer.domElement) exitWalk();
});

// Mobile/touch support, 2026-08-13. Two independent fixes, per direct
// user decisions this session:
//
// 1. Walk Mode hidden on touch-primary devices. Pointer lock + WASD has
//    no touch equivalent wired up yet, and the user explicitly chose
//    "hide it on touch for now" over building full touch controls for
//    it in this pass. A feature check (pointer: coarse), not a viewport
//    width check -- an iPad is plenty wide but still touch-primary.
if (window.matchMedia('(pointer: coarse)').matches) {
  const walkRow = document.getElementById('walk-toggle')?.closest('.row');
  if (walkRow) walkRow.style.display = 'none';
}

// 2. B1 (RHOMBIVERSE_UIUX_BUILD_PLAN.md) replaced the old always-visible
//    two-panel sidebar with one Lab panel behind an explicit #lab-toggle
//    entry point -- superseding the mobile "closed -> controls -> shells"
//    screen-navigation scheme this comment used to describe (that whole
//    problem, a sidebar too wide for a phone viewport, doesn't apply to
//    a single already-scrollable overlay). closeMobilePanels() is kept
//    as a small alias so the mode-btn click handler further down (a
//    genuine, unrelated existing call site) doesn't need editing.
const labToggleEl = document.getElementById('lab-toggle');
const labPanelEl = document.getElementById('lab-panel');

function closeMobilePanels() {
  labPanelEl.classList.remove('open');
}

labToggleEl.addEventListener('click', () => {
  labPanelEl.classList.toggle('open');
});

// B3: Cyborg Mode is fully self-contained (fetches its own subscript
// JSON, listens for the rhombiverse:* events dispatched elsewhere in
// this file, never touches world-state) -- module-level like the toggle
// above, no init()-local dependency needed.
const cyborgMode = createCyborgMode();
const cyborgToggleEl = document.getElementById('cyborg-toggle');
cyborgToggleEl.addEventListener('click', () => {
  cyborgMode.toggle();
  cyborgToggleEl.classList.toggle('active', cyborgMode.isEnabled());
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
})();

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 8, 4);
scene.add(sun);

// Builds one RD's geometry via convex hull over its 14 raw vertices --
// the JS equivalent of the scipy ConvexHull step this project family's
// own `build_polyhedron` (dictoroids_tetraroid.py) uses for every solid.
// Only triangulated faces are needed for rendering, not build_polyhedron's
// merged N-gon face structure, which is a physics-layer concern this
// project doesn't have yet.
function buildRDGeometry(scale = 1) {
  const points = rdRawVerts(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// Base color per material (RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md's
// Glassite family, RHOMBIVERSE_SPEC_ASTEROIDS.md's Garnet/Ferrostone,
// RHOMBIVERSE_SPEC_WATER_ICE.md's Water/Ice 9.9). The shared
// InstancedMesh material's own .color is left white (see init()) so
// these show through unmodified via setColorAt -- cosmetic only for now,
// no material has functional behavior yet (gravity/hydrosphere land in
// Phase 5.5).
const MATERIAL_COLORS = {
  base: 0x8899aa,
  garnet: 0x8b2e2e,
  ferrostone: 0x5a5a5a,
  glassite: 0xbfe3f0,
  'star-glassite': 0xdff3ff,
  'blackstar-glassite': 0x1a1a22,
  ice99: 0xd8f0ff,
  water: 0x2e6f9e,
};

function materialColor(material) {
  return new THREE.Color(MATERIAL_COLORS[material] ?? MATERIAL_COLORS.base);
}

// RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 5: "reuse the existing
// MATERIAL_COLORS palette... unless a real reason argues otherwise" --
// distinguishing a planted structure's species at a glance is that real
// reason (tile-type, acute vs. oblate, is far less useful to a player
// than which organism they're looking at), so this is a small,
// deliberately separate map, not a wholesale new palette.
const SPECIES_COLORS = {
  amoeba: 0x9fd8a0,
  moss: 0x4f7a3f,
  fungus: 0xd9b26b,
  fern: 0x2f6b3a,
  // Wave 2 (2026-08-13) -- one distinct tint per template, not per
  // category, so e.g. sapling/conifer/shrub (all species: 'plant')
  // still read apart from each other in the 3D view.
  sapling: 0x6fae4f,
  conifer: 0x1f4a28,
  shrub: 0x7a8f3f,
  nautilus: 0xe8dcc0,
  scallop: 0xe0a598,
  spineling: 0xc9b896,
  'cluster-frame': 0x8a8f99,
  // Evolution Stage 9 -- genome-driven organisms (evolution.js's own
  // plantOrganism/reproduceAsexual/reproduceSexual), distinct from the
  // fixed Wave-1/Wave-2 templates above: a warmer, saturated palette so
  // an evolving structure reads as visibly different in kind, not just
  // another named template.
  amoeba_evolved: 0x6ee7b7,
  plant_evolved: 0x86efac,
  // RHOMBIVERSE_SPEC_ANIMALS.md -- land/sea creatures, same warmer/
  // saturated "genome-driven" treatment as amoeba/plant above, but a
  // distinct hue per habitat (earthy tan for land, deep teal for sea) so
  // the two read apart at a glance in the 3D view.
  landCreature_evolved: 0xd4a574,
  seaCreature_evolved: 0x0e7490,
};

// RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 6 (Landscape Aggregate State,
// section 6.2): a real, distinct "weathered ground" tone -- earthy brown/
// grey, deliberately NOT one of SPECIES_COLORS' own vivid living-tissue
// hues -- blended into the aggregate speckle layer's own color by that
// planetoid's real landscapeState (0 = pure current-species tint, 1 =
// fully weathered), so a location with a long sustained biological
// history reads as visibly different from one with only current, recent
// life, even at the same instantaneous population size.
const LANDSCAPE_WEATHERED_COLOR = new THREE.Color(0x8b6f47);

// evolution.js's own plantOrganism deliberately namespaces the
// underlying seed's `species` field as `organism:<species>` (see its own
// header comment) so it can never collide with a real GROWTH_TEMPLATES
// key -- unwrap that prefix here so an evolved organism still gets a
// real color instead of falling through to the ?? 0xffffff default.
const ORGANISM_SEED_SPECIES_PREFIX = 'organism:';
function speciesColor(species) {
  if (species.startsWith(ORGANISM_SEED_SPECIES_PREFIX)) {
    const base = species.slice(ORGANISM_SEED_SPECIES_PREFIX.length);
    return new THREE.Color(SPECIES_COLORS[`${base}_evolved`] ?? SPECIES_COLORS[base] ?? 0xffffff);
  }
  return new THREE.Color(SPECIES_COLORS[species] ?? 0xffffff);
}

// Tint for a cell by its shell-fill distance (lattice.js's
// cellsInShells), so shells placed by the shift+click fill tool are
// visually distinguishable outward. Cells with no `shell` (plain single
// clicks, or the original seed) get white -- an identity multiplier, no
// tint. Hue cycles per shell (0.15 turns/shell) rather than a fixed
// palette, so it stays distinct for any shell count the UI allows.
const _shellColorCache = new Map();
function shellTint(shell) {
  if (!shell) return new THREE.Color(1, 1, 1);
  if (!_shellColorCache.has(shell)) {
    _shellColorCache.set(shell, new THREE.Color().setHSL((shell * 0.15) % 1, 0.65, 0.55));
  }
  return _shellColorCache.get(shell);
}

// Distinct tint for black-hole-generated buffer cells (RHOMBIVERSE_SPEC_
// BLACKHOLE.md section 2) -- players need to be able to tell "auto-
// generated containment space" apart from their own build at a glance,
// not just via the underlying data flag.
const GENERATED_TINT = new THREE.Color(0x2a0a30);

// Final per-instance color: the cell's material color, lightly blended
// (35%) toward its shell tint so shell rings stay visible without
// obscuring which material a cell actually is.
const FLAGGED_TINT = new THREE.Color(0xff2020);

function instanceColorFor(cell) {
  // Only ever reached in Report mode (visibleCells excludes flagged/
  // removed cells everywhere else), so a bright warning tint here is
  // unambiguous -- it's ONLY shown to someone actively reviewing reports.
  if (cell.status === 'flagged' || cell.status === 'removed') return FLAGGED_TINT;
  if (cell.generatedByBlackHole) return GENERATED_TINT;
  const base = materialColor(cell.material);
  if (!cell.shell) return base;
  return base.clone().lerp(shellTint(cell.shell), 0.35);
}

// instanceId -> {x, y, z, ...cellData}, refreshed on every rebuild. Read
// by build.js's raycast controller to turn a clicked instance back into
// lattice coordinates.
let cellOrder = [];

// Phase 5.8: flagged/removed cells are quarantined from the default view
// -- excluded from the instance set entirely (invisible AND unclickable,
// same technique the old onion-skin shell filter used) rather than
// deleted, so derived mechanics (hydrosphere/black hole/etc., which read
// world.entries() directly, not this filtered list) still see and act on
// the true full world regardless of what's currently visible. Report
// mode is the one exception: it needs to see (and click, to toggle back)
// already-flagged cells to be usable at all, so it opts back into showing
// them, distinctly tinted -- see instanceColorFor's flagged-in-Report-mode
// branch below.
function visibleCells(world, inReportMode) {
  if (inReportMode) return world.entries();
  return world.entries().filter((c) => c.status !== 'flagged' && c.status !== 'removed');
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
  // InstancedMesh.raycast() only computes its bounding-sphere pre-check
  // lazily, ONCE, then caches it forever (three.js's own source: `if
  // (this.boundingSphere === null) this.computeBoundingSphere()`). It is
  // never auto-invalidated when `count` grows or instances move, so
  // without forcing a recompute here, any click outside whatever sphere
  // happened to be cached on the first-ever raycast is silently dropped
  // before per-instance testing even runs -- the exact cause of a real
  // bug where only cells near the very first click's bounding sphere
  // could ever be built.
  mesh.computeBoundingSphere();
}

async function init() {
  // A saved build takes priority over the static seed -- that's the
  // whole point of Phase 3 (refreshing preserves the build). On a true
  // first-ever visit (no saved build) B1 calls for a small starter
  // planetoid instead of a single empty cell -- data/starter-world.json
  // still supplies the base worldName/meta shape (a real body needs a
  // Blackstar-Glassite core placed via createWorldStore's own onAdd
  // hooks, not baked into a static JSON, so it's generated below rather
  // than hand-authored into the file).
  const savedJSON = loadFromLocalStorage();
  const worldJSON = savedJSON ?? (await loadWorld('./data/starter-world.json'));
  const isFirstVisit = !savedJSON;
  if (isFirstVisit) {
    worldJSON.cells = {}; // drop starter-world.json's single placeholder cell -- generatePlanetoid below replaces it
  }
  const world = createWorldStore(worldJSON, {
    onAdd: handleLocalAdd,
    onRemove: handleLocalRemove,
    onRegrowthSet: handleLocalRegrowthSet,
    onRegrowthClear: handleLocalRegrowthClear,
    onSeedSet: handleLocalSeedSet,
    onSeedClear: handleLocalSeedClear,
  });
  if (isFirstVisit) {
    generatePlanetoid(world, 'rocky', 0, 0, 0, 2);
  }
  // Declared this early so the very first rebuildInstances() call below
  // (before the mode-button UI further down even exists) can safely
  // reference it -- report mode can't be active yet at that point, but
  // the reference itself must not be in currentMode's temporal dead zone.
  let currentMode = 'build';

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

  // B4b's standalone mesh -- same geometry/material recipe as the main
  // world's (a real sculpture should look identical either place), own
  // InstancedMesh/capacity since it's a genuinely separate scene.
  sculptureMesh = new THREE.InstancedMesh(geometry, material.clone(), MAX_CELLS);
  sculptureMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sculptureScene.add(sculptureMesh);

  // RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 2: real camera-distance
  // trigger & lifecycle, replacing Stage 1's single-hardcoded-cell demo.
  // Real, deliberate deviation from the spec's own suggested pattern
  // ("reusing refreshClaims's own clear-and-rebuild pattern"): claims are
  // few, irregularly-shaped, and each needs its own real convex-hull
  // geometry, so refreshClaims allocates/disposes a THREE.Mesh per claim
  // every recompute. Sub-lattice cells are many, but every one is the
  // EXACT SAME shape (one shared geometry, per Stage 1) -- the top-level
  // `mesh` above already solves exactly this shape of problem (many
  // identical objects, count changes over time) via a FIXED-capacity
  // InstancedMesh with an adjustable `.count`, never allocating/disposing
  // per recompute at all. Reusing THAT pattern here is a strictly
  // stronger answer to this stage's own "no leaked geometry" success
  // check than clear-and-rebuild would be: there is nothing to leak,
  // because nothing is ever created or destroyed after this one-time
  // allocation -- only the same buffer's contents and `.count` change.
  //
  // SUB_LATTICE_TRIGGER_DISTANCE (4 world units) is a real, reasoned
  // first value, flagged as tunable per this spec's own section 10 open
  // question ("needs real frame-cost measurement... not guessed here"):
  // the default camera framing sits ~11.2 units from the origin (real
  // Euclidean distance for position (6,5,8)), so 4 keeps the sub-lattice
  // invisible at the ordinary starting view (this stage's own first
  // success check) while comfortably reachable by zooming in, matching
  // Stage 1's own live-verified "close zoom" screenshot distance.
  // MAX_NEARBY_SUBLATTICE_CELLS (20) bounds worst-case cost independent
  // of how many cells exist in the whole world -- the same "a real cap
  // grounded in reasoned cost" discipline as MAX_CELLS/MAX_UNDO/
  // MAX_CATCHUP_GENERATIONS elsewhere in this project.
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

  // RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 3 -- Multi-Level Depth &
  // Blending, level 2 (the sub-sub-lattice, MAX_LOD_DEPTH's own second
  // and -- per that constant's own reasoning -- last level for this
  // pass). Same "one shared, fixed-capacity InstancedMesh" pattern as
  // level 1 above, just hung off individual depth-1 sub-cells instead of
  // top-level world cells. Reuses subLatticeMaterial unmodified (governing
  // decision 3, "uniform substructure": every level repeats the exact same
  // material, not a new color invented per depth).
  //
  // LEVEL2_TRIGGER_DISTANCE shrinks from the depth-1 trigger by the SAME
  // subScaleFactor the geometry itself shrinks by (levelTriggerDistance's
  // own doc comment) -- self-similar reveal ratio at every depth, not a
  // second unrelated number picked freehand.
  //
  // MAX_NEARBY_LEVEL2_PARENTS (4): LEVEL2_TRIGGER_DISTANCE is already
  // ~0.26x the depth-1 trigger (subScaleFactor(2) = cbrt(1/55)), so only
  // whatever handful of depth-1 sub-cells are already extremely close to
  // the camera can ever qualify -- a small bounded cap, same "real cap
  // grounded in reasoned cost, not arbitrary" discipline as
  // MAX_NEARBY_SUBLATTICE_CELLS above.
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

  // Blend width per level (section 3's own "not a hard pop" requirement,
  // via latticezoom.js's blendFactor): grounded as roughly ONE cell-width
  // of that level's own geometry -- the fade completes over about the
  // same distance the cell itself spans, a physically meaningful zone
  // rather than an arbitrary fraction of the trigger distance. Deeper
  // levels shrink their own blend width by the SAME subScaleFactor as
  // their trigger distance (levelTriggerDistance reused verbatim for
  // this, per its own doc comment: "trigger distance and blend width are
  // the SAME real fraction... as the geometry itself shrinks by") -- and
  // that self-similar formula happens to make LEVEL2_BLEND_WIDTH come out
  // exactly equal to level2Scale too, confirming the grounding holds at
  // depth as well as at the base.
  const SUB_LATTICE_BLEND_WIDTH = subLatticeScale;
  const LEVEL2_BLEND_WIDTH = levelTriggerDistance(SUB_LATTICE_BLEND_WIDTH, 2, SUB_LATTICE_MAX_SHELL);

  // RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 4 (Adaptive Damping): real
  // volatility-driven widening of this throttle, via latticezoom.js's
  // own pure nextVolatilityScore/throttleForVolatility (the same
  // RHOMBIVERSE_PRINCIPLES.md section 2 shape evolution.js's own
  // volatility score already implements elsewhere in this project).
  // subLatticeVolatilityScore/lastSubLatticeRefPos are the real per-
  // refresh state the pure functions need; subLatticeThrottleMs itself
  // stays a plain `let` (the self-rescheduling setTimeout loop below
  // reads it fresh on every tick, so a widened value takes effect on the
  // very next scheduling, no timer teardown needed).
  let subLatticeThrottleMs = SUB_LATTICE_THROTTLE_BASE_MS;
  let subLatticeVolatilityScore = 0;
  let lastSubLatticeRefPos = null;
  let lastSubLatticeRefresh = 0;
  const subLatticeDummy = new THREE.Object3D();

  // RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 5 -- Ecosystem Rendering.
  //
  // Tier 1 (section 6.1, "a few real organisms"): each real tracked
  // organism is FEW and IRREGULARLY SHAPED (its own real growth-tile
  // hull, not a shared uniform cell shape), the same real content class
  // Stage 2's own doc comment already distinguishes from the sub-lattice
  // cells above -- so this reuses `claimGroup`'s established "clear-and-
  // rebuild THREE.Group, real convex-hull-per-item" pattern rather than a
  // fixed-capacity InstancedMesh, not the sub-lattice's own pattern.
  const organismMiniGroup = new THREE.Group();
  scene.add(organismMiniGroup);
  // Bounds worst-case per-refresh cost independent of total organism
  // count, same "real cap grounded in reasoned cost" discipline as
  // MAX_NEARBY_SUBLATTICE_CELLS/MAX_NEARBY_LEVEL2_PARENTS above.
  const MAX_NEARBY_ORGANISMS = 20;

  // Tier 2 (section 6.1, "aggregate/general layer"): NOT independently
  // tracked per instance -- section 10's own "leaning toward instanced
  // geometry... for a first pass," so this DOES reuse the sub-lattice's
  // own fixed-capacity InstancedMesh + setColorAt pattern (the exact same
  // white-base-material + per-instance-setColorAt shape the TOP-LEVEL
  // `mesh` already uses for cell tinting, reused verbatim rather than a
  // second color mechanism). Each revealed top-level parent gets up to
  // AGGREGATE_MAX_SPECKLES speckles, placed at that SAME parent's own
  // already-computed depth-1 sub-cell positions (reusing real existing
  // geometry rather than inventing a second scattering/jitter scheme),
  // sized deliberately smaller than a real depth-2 cell so a speckle is
  // never mistaken for actual per-organism detail.
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

  // Writes one blended instance into `mesh` at `idx`: position at the
  // cell's real world center, uniform SCALE set to `blend` (1 = full
  // size, shrinking toward 0 as the cell approaches its outer fade
  // distance) -- Stage 3's own cross-fade mechanism, a single shared
  // helper so level 1 and level 2 apply it identically.
  function writeBlendedInstance(mesh, idx, worldPosition, blend) {
    subLatticeDummy.position.set(...worldPosition);
    subLatticeDummy.scale.setScalar(blend);
    subLatticeDummy.updateMatrix();
    mesh.setMatrixAt(idx, subLatticeDummy.matrix);
  }

  // Stage 5, Tier 1 (section 6.1, "a few real organisms"): rebuilds the
  // real tiny growth-structure for each real tracked organism close
  // enough to the reference position, clear-and-rebuild same as
  // refreshClaims (few, irregularly-shaped, real-hull-per-item content --
  // not the sub-lattice's own many-identical-instances shape). Each
  // organism's own EXISTING, already-correct tile geometry is reused
  // outright (tileWorldVertices), just scaled down around its own real
  // rooted position (seed.origin) by the SAME ratio depth-1 sub-lattice
  // cells shrink by, times that organism's own real distance-driven
  // blend -- so it fades in/out exactly like every other Lattice Zoom
  // reveal, rather than a separately-tuned fade.
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

  // Recomputes which built cells are near enough to the camera (or the
  // live player position while walking) to reveal sub-lattice detail,
  // closest-first up to the real MAX_NEARBY_SUBLATTICE_CELLS bound, and
  // rewrites the shared InstancedMesh's own instance buffer in place --
  // no allocation, no disposal, ever, after the one-time setup above.
  //
  // Stage 3: each PARENT's own real distance (already computed by
  // selectNearbyCells/selectNearbyByWorldPosition as `.d`) drives a
  // single uniform blend factor applied to every sub-cell that parent
  // reveals -- a clean whole-parent fade rather than each of its own
  // sub-cells dissolving independently, which would read as the
  // sub-lattice partially melting rather than the parent smoothly
  // resolving into it. Also recurses one further level (up to
  // MAX_LOD_DEPTH): whichever depth-1 sub-cells are themselves close
  // enough to the reference position get their own depth-2 sub-sub-
  // lattice, generated via generateSubLatticeAt/selectNearbyByWorldPosition
  // (the general, non-integer-coordinate cores Stage 3 added), the exact
  // same real recursion the unit tests already proved correct.
  function refreshSubLattice() {
    const camPos = walking && player ? player.getPosition() : camera.position;
    const refPos = [camPos.x, camPos.y, camPos.z];

    // Stage 4: real movement since the last refresh drives the
    // volatility score, which drives the NEXT scheduled throttle
    // interval -- rapid repeated scrubbing widens it, calm/slow movement
    // decays it back toward the tight default.
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

      // Stage 5, Tier 2 (aggregate plant-coverage layer): real local
      // biomass at THIS parent's own position drives how many speckles
      // show here, placed at that same parent's own already-generated
      // depth-1 sub-cell positions (reusing real geometry, not a second
      // scattering scheme), tinted by whichever species is locally
      // dominant among real nearby organisms (organism.species is never
      // prefixed -- only its seed's species carries evolution.js's own
      // "organism:" prefix -- so speciesColor needs that prefix added
      // back on to reach the same _evolved color lookup normal organism
      // rendering already uses).
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
        // Stage 6: blend toward LANDSCAPE_WEATHERED_COLOR by however
        // weathered/soil-built-up THIS parent's own nearest planetoid
        // real tracked landscapeState currently is -- a real, slow,
        // persisted signal (evolution.js's own resolveCatchUpForAllPlanetoids),
        // not recomputed from scratch here; 0 (no tracked history yet,
        // including planetoids with no organisms at all) leaves the
        // speckle's pure current-species tint untouched.
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
    // Same real bug this project already found and fixed once for the
    // top-level mesh: InstancedMesh.raycast() lazily computes its
    // boundingSphere ONCE and never auto-invalidates it. Not yet
    // raycast against (governing decision 4: block-level building/
    // mining only, sub-lattice is purely visual for this whole spec's
    // current scope) -- cheap insurance regardless, same as Stage 1.
    subLatticeMesh.computeBoundingSphere();

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

  // Self-rescheduling throttle (not a fixed setInterval) so Stage 4's
  // own adaptive-damping widening of `subLatticeThrottleMs` takes effect
  // on the very next tick, with no need to clear/recreate a timer.
  function scheduleSubLatticeRefresh() {
    setTimeout(() => {
      refreshSubLattice();
      lastSubLatticeRefresh = performance.now();
      scheduleSubLatticeRefresh();
    }, subLatticeThrottleMs);
  }
  scheduleSubLatticeRefresh();

  // RHOMBIVERSE_SPEC_REGIONS.md territory visualization: one low-opacity
  // mesh per claim, its exact real footprint shape (via ConvexGeometry on
  // claimFootprintWorldVertices -- ACTUAL cell-center points, the same
  // "real geometry, not an estimate" standard every other shape in this
  // app already holds to) rather than tinting individual cells, since
  // most of a claim's footprint is typically unbuilt space with no cell
  // to tint at all. Replaced a bounding-SPHERE version, 2026-08-13, after
  // a player noticed claim territories visually overlapping on screen
  // even though their real footprints never do -- claimBoundingRadius
  // (the farthest single CORNER of a claim's footprint) made a genuinely
  // much looser sphere than the real rhombic-dodecahedron-shaped
  // territory, which only got more visible once claims got bigger. A
  // plain THREE.Group so the whole set can be cleared and rebuilt in one
  // call (refreshClaims below) without tracking individual mesh
  // references.
  const claimGroup = new THREE.Group();
  scene.add(claimGroup);
  const CLAIM_COLOR_MINE = 0x4ade80; // green -- this session's own claims
  const CLAIM_COLOR_OTHER = 0xf59e0b; // amber -- everyone else's

  // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 5: additive rendering,
  // never touches the RD `mesh`/`MAX_CELLS` system. Each of the 40 real
  // valid direction-triples (growth.js's own VALID_TRIPLES) is a
  // genuinely different orientation in space, not just a translated
  // copy of one shape -- an InstancedMesh would need a per-instance
  // rotation matrix computed against a template, real complexity for
  // Wave 1's actual bounded scale (a handful of tiles per seed, per the
  // spec's own low-generation-count templates). Simplicity wins here:
  // one plain Mesh per tile (ConvexGeometry on that tile's own real
  // world vertices, always correct regardless of orientation), grouped
  // per seed so a whole seed's meshes can be cleared/rebuilt together.
  // Revisit with real instancing only if actual usage ever shows this
  // is a performance problem -- not assumed up front.
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

  // RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md section 4's own "on
  // planetoid_load(planetoid)" -- resolve however much real time passed
  // while nobody was here BEFORE the player sees anything, same as the
  // spec's own pseudocode names it. Deliberately NOT run while Shared
  // World is active (see resolveEvolution's own header): organisms/
  // planetoidEvolution have no sync path yet, so mutating them locally
  // against a shared view would desync exactly like Undo/New World are
  // already guarded against. Saves unconditionally (not just when
  // something visibly changed) whenever any organism exists, for the
  // same real reason the periodic tick below does -- see that call
  // site's own header for the bug this fixes.
  if (!sharedWorldActive && Object.keys(world.getOrganisms()).length > 0) {
    if (resolveEvolution(world, Date.now())) rebuildAllGrowth();
    saveToLocalStorage(world.toJSON());
  }
  refreshOrganismsSnapshot(world);
  updateEvolutionInfo();

  // RHOMBIVERSE_SPEC_ASTEROIDS.md UI: belts are otherwise undiscoverable
  // (80+ units from the default camera framing, no minimap) -- one
  // button per belt reframes the camera exactly like the initial
  // camera.position.set(6,5,8)/controls.target.set(0,0,0) setup, just
  // offset to the belt's own center instead of world origin. Exits Walk
  // Mode first if active, since camera.position there is driven by
  // player.js every frame and would immediately override this.
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

  // Undo: a full-world-JSON snapshot stack, not a diff/command log --
  // simpler to reason about correctly than tracking per-operation
  // inverses, and every operation (build/fill/round/excavate/ring
  // remove/New World/Import) already produces a full JSON via
  // world.toJSON(), so this covers all of them uniformly for free.
  // lastSnapshot always holds the state as of the END of the previous
  // onChange -- i.e. exactly the state right before whatever mutation
  // onChange is currently reporting -- so pushing it captures the
  // correct "before" state without needing to hook every individual
  // world.addCell/removeCell call site.
  const undoStack = [];
  const MAX_UNDO = 20;
  let lastSnapshot = JSON.stringify(world.toJSON());

  function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    btn.disabled = sharedWorldActive || undoStack.length === 0;
    // B2: the icon itself no longer carries a numeric readout -- the
    // scrub-timeline strip (renderUndoScrubStrip) is the count now.
  }

  // B2's scrub-timeline: undoStack[0] is the OLDEST kept state,
  // undoStack[length-1] the most recent (matches the push order in
  // onChange below). Jumping to tick i reverts to that exact state and
  // discards everything newer than it (indices > i) -- the same
  // "no redo past a jump" semantics a linear undo stack without redo
  // support already implied, just now reachable directly instead of only
  // one pop at a time.
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

  // Ring list: "standard view" of the last-clicked structure's shells,
  // each with its own remove button -- added per direct request, to
  // replace the onion-skin min/max number inputs (view-only, removed)
  // with something that both shows the structure at a glance AND lets
  // individual shells be permanently removed, safety-netted by the undo
  // button above.
  let focusedCenterKey = null;

  // Same hue formula as shellTint() above, so a shell's color in this 2D
  // diagram matches its tint in the actual 3D view -- one color means
  // the same thing everywhere, deliberately, for the "idiot proof" goal.
  function shellHue(shell) {
    return ((shell * 0.15) % 1) * 360;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Concentric-circle "bullseye" diagram: painted largest shell first so
  // each smaller circle draws on top and covers the larger one's center,
  // leaving only its own ring-shaped band visible -- the standard, simple
  // way to get real donut-shaped click targets without annulus/arc path
  // math. Kept alongside the text list below (not replacing it): a thin
  // visual ring is easy to mis-click, so the list is the precise fallback
  // for actually hitting one specific shell.
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
    if (!myUserId) {
      el.textContent = 'Inventory: connect to Shared World to mine and track materials.';
      return;
    }
    const mine = world.getInventory()[myUserId] ?? {};
    // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 5: entries are
    // {quantity, lastUsedAt} objects now, not bare numbers.
    const parts = Object.entries(mine).map(([material, entry]) => `${material} ×${entry.quantity}`);
    el.textContent = parts.length > 0 ? `Inventory: ${parts.join(', ')}.` : 'Inventory: empty.';
  }

  function onChange() {
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
  }

  // Undo reverts the LOCAL view only, via replaceAll -- like New World/
  // Import/Load preset, it bypasses the addCell/removeCell hooks that
  // drive sync.js's pushes, so it can't un-push a change already synced
  // to the shared table. Disabled outright while Shared World is active
  // (see updateUndoButton) rather than left to silently desync.
  //
  // B2: a quick click still undoes exactly one step (jumpToUndoIndex on
  // the last/most-recent entry, same effect the old pop()-based handler
  // had); holding past UNDO_HOLD_MS instead reveals the scrub strip so
  // any past state can be jumped to directly.
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
  // Clicking anywhere outside the strip closes it without acting --
  // same "reveal on hold, dismiss on outside interaction" pattern the
  // Rhombic Wheel's own picker strip uses.
  document.addEventListener('pointerdown', (e) => {
    if (undoStripEl.classList.contains('visible') && !undoStripEl.contains(e.target) && e.target !== undoBtn) {
      undoStripEl.classList.remove('visible');
    }
  });
  updateUndoButton();

  // Section view (clipping plane): #section-enable toggles whether
  // material.clippingPlanes contains sectionPlane at all, AND whether the
  // axis/position/flip sub-controls are even shown -- no point showing
  // controls for a feature that's currently off. The other three
  // controls just mutate the same Plane object in place, picked up
  // automatically by the next rendered frame (no rebuild needed --
  // clipping is a GPU-side spatial test).
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

  // B2: X-Ray as an interactive draggable cutaway plane, not just a
  // checkbox+slider. #section-enable/#section-axis/#section-flip/
  // #section-pos (Lab panel, still there for precise numeric control)
  // and this handle drive the exact same `sectionPlane` object, kept in
  // sync both directions -- "keep all underlying mechanics... unchanged,
  // this phase is presentation and interaction feel only" (B2's own
  // scope line): sectionPlane/material.clippingPlanes are untouched,
  // only how a player reaches and moves them is new.
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

  // Dragging the handle updates sectionPlane in real time -- reveals the
  // interior as it moves through the structure, not just on release.
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

  // --- B5 Duality Mode --------------------------------------------
  // "The RD lattice as a 4D hypercube shadow, the rhombic triacontahedron
  // as a 6D hypercube shadow" -- no such cut-and-project mapping exists
  // anywhere in this codebase or its specs (checked before writing this,
  // same kind of gap as B4's "order-48 symmetry group" claim, but
  // deeper: the textbook 6D construction uses the icosahedral point
  // group, order 120, which doesn't act on this lattice's actual cubic
  // (order-48) FCC symmetry at all -- there's no clean way to apply the
  // literal method here). What IS real and already built: growth.js's
  // own Ammann-rhombohedra tile geometry (STAR_DIRECTIONS/VALID_TRIPLES/
  // unitTileVertices), a genuine quasicrystal-related construction this
  // project already uses for its Penrose growth layer. Duality Mode
  // reveals that SAME real geometry applied to every regular built cell
  // instead of just grown seeds -- "display it for free" rather than
  // inventing new projection math, per direct steer. Deterministic (same
  // cell always picks the same real prototile triple) but not a literal
  // verified hypercube-shadow projection -- disclosed here, not silently
  // oversold.
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

  const shellCountInput = document.getElementById('shell-count');
  const hollowFromInput = document.getElementById('hollow-from');
  const materialSelect = document.getElementById('material-select');

  const getShellCount = () => Math.min(Math.max(1, Number(shellCountInput.value) || 1), MAX_SHELL);

  // Mode selector: exactly one #mode-btn is "active" at a time; a plain
  // click does whatever that mode does (build.js). Replaced an earlier
  // modifier-key scheme (Shift/Ctrl/Ctrl+Shift+click) that became
  // unmanageable -- see build.js's header comment for the full reasoning.
  //
  // Contextual UI, added because "all options seem available at same
  // time" was a real, separate complaint even after the fill logic
  // itself was verified correct by direct execution: each mode only
  // shows the shell inputs it actually reads (Fill uses both; Excavate
  // uses only "hollow from"; Round and Build use neither), and the hint
  // line states in plain language exactly what a click currently does --
  // so it's possible to tell whether something worked without needing
  // devtools. Material stays visible in every mode, unlike the shell
  // inputs: it's read by Build/Fill for what to place, AND by the ring
  // panel's Recolor button regardless of which mode is active, so hiding
  // it in Round/Excavate would make recoloring require a mode switch
  // just to see the dropdown.
  const MODE_HINTS = {
    build: 'Click a face to add one cell using the selected material.',
    fill: 'Click a cell to fill shells (hollow from–radius) outward around it, approximating a sphere. A second click on the same structure grows it further.',
    round: 'Click a shell-tagged cell to smooth its outer boundary by true distance from center.',
    excavate: 'Click a shell-tagged structure to hollow out its interior below "Hollow from shell".',
    generate: 'Click a cell to generate a full body of the chosen type there (radius = Shell fill radius), formula-built in one click instead of hand-placing every cell.',
    report: 'Shows flagged/removed cells (normally hidden) in red. Click one to flag it, click a flagged one to approve it back.',
    plant: 'Click anywhere to plant a seed of the chosen species. Left alone, it grows on its own over real time.',
    sculpt: 'Model (add) onto a face, or Chisel (subtract) a clicked cell -- see the Sculpt panel for tier/mirror/brush.',
  };
  function updateModeUI() {
    const showRadius = currentMode === 'fill' || currentMode === 'generate';
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

  // Player-facing terminology (RHOMBIVERSE_UIUX_BUILD_PLAN.md B1's rename
  // table) for the HUD's top-right indicator -- the Lab panel keeps the
  // original technical labels (Generate, Excavate, Round, Walk Mode,
  // Presets) untouched, per that same table's "outside Lab/Advanced view"
  // scope.
  const PLAYER_FACING_MODE_LABEL = {
    build: 'Build',
    fill: 'Fill',
    round: 'Smooth',
    excavate: 'Dig',
    generate: 'Create',
    replace: 'Replace',
    report: 'Report',
    plant: 'Plant',
  };
  function updateHudIndicator() {
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

  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      modeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      updateModeUI();
      // Entering/leaving Report mode changes which cells are visible
      // (visibleCells) -- re-sync immediately rather than waiting for the
      // next unrelated onChange.
      rebuildInstances(mesh, world, currentMode === 'report');
      // Mobile screen-navigation: picking a mode is the whole reason to
      // have opened the controls screen -- return straight to the 3D
      // view so the next tap lands on the canvas, not a second manual
      // "Close" tap. No-op on desktop (closeMobilePanels only affects a
      // CSS class the desktop layout never uses).
      closeMobilePanels();
    });
  });

  // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 4: Plant mode's own
  // click handling, entirely separate from build.js's controller (see
  // getMode's own comment above for why). Section 10's own deferral --
  // "freestanding, fewer cross-system dependencies" -- means planting
  // doesn't need to hit an existing cell; it raycasts against the RD
  // mesh purely to translate a 2D click into a real 3D point (whatever
  // surface is under the cursor), falling back to a fixed distance
  // along the camera ray when nothing is hit (open space, or no cells
  // built yet). A tiny outward offset along the hit normal keeps a
  // freshly-planted seed from spawning literally inside the RD cell it
  // was clicked on.
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
      // organisms/planetoidEvolution have no Supabase sync path yet
      // (see resolveEvolution's own header) -- planting one here would
      // sync the underlying SEED (seeds already sync) but not the
      // organism record behind it, leaving every other client with a
      // frozen, never-evolving tile cluster instead of a real shared
      // organism. Blocked outright rather than shipping a silently
      // half-synced experience.
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
      // RHOMBIVERSE_SPEC_ANIMALS.md Stage A/B: same random-within-range
      // founding genome as evo-amoeba/evo-plant above (no breeding UI),
      // plus a random-within-range animalTraits object for mobilityRange/
      // huntBias. plantAnimal enforces habitat validity at plant time --
      // a land creature can't be planted on/near a liquid-permeated cell
      // and vice versa, surfaced here as a friendly alert rather than an
      // unhandled exception.
      const animalSpecies = species === 'evo-sea' ? SEA_CREATURE_SPECIES : LAND_CREATURE_SPECIES;
      const isDino = species === 'evo-land-dino';
      const genome = {};
      for (const [trait, [min, max]] of Object.entries(GENOME_TRAIT_RANGES)) {
        // "Dinosaur": still a real, random genome (no hand-tuned exact
        // numbers, no breeding UI) but biased toward the LARGE end of
        // maturitySize specifically -- a real, grounded read (large-
        // bodied land animals), not a special-cased new mechanic.
        genome[trait] = isDino && trait === 'maturitySize' ? max - Math.random() * (max - min) * 0.3 : min + Math.random() * (max - min);
      }
      const animalTraits = {};
      for (const [trait, [min, max]] of Object.entries(ANIMAL_TRAIT_RANGES)) {
        // Biased toward high huntBias (carnivore) and high mobilityRange
        // (a real predator's own mobility advantage) -- same "bias the
        // random draw, never hand-fix a value" shape as maturitySize
        // above, keeping this a real, still-evolvable genome.
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
      // B5 Cultivation Mode Manual tier: "expose the existing growth-
      // layer's... parameters... as player-adjustable inputs at planting
      // time" -- layered on here rather than changing plantSeed's own
      // signature, since every OTHER planting path (evolving organisms/
      // animals above) is explicitly out of Cultivation's scope and
      // must stay completely unaffected.
      world.setSeed(seedId, { ...seed, growthParameters: currentGrowthParameters(), assistanceTier: cultivateSession.assistanceTier, authorId: myUserId ?? 'local-player' });
    }
    rebuildSeedMeshes(seedId, seed);
    if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
    refreshOrganismsSnapshot(world);
    updateEvolutionInfo();
  });
  updateModeUI();

  // B5 Cultivation Mode: "manually pruning part of an already-grown
  // structure should trigger the existing aperiodic fill/reroute
  // behavior the growth system already has" -- reuses the same right-
  // click-always-removes convention every other mode already has,
  // scoped to Plant mode (grown tiles aren't normal world.cells, so
  // build.js's own onContextMenu never sees them). growSeed's frontier
  // scan already re-derives itself from seed.tiles fresh every call, so
  // the "reroute" is genuinely free -- pruneTile is the whole mechanic.
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

  // --- B5: Cultivation Mode (Grow -> Cultivate) -----------------------
  const cultivateSession = createCultivationSession(myUserId ?? 'local-player');

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
    acceptCultivationSuggestion(cultivateSession, world, myUserId ?? 'local-player');
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
    const { applied, skipped } = executeCultivationIntent(world, intent, world.getClaims(), myUserId ?? 'local-player', currentGrowthParameters());
    resultEl.textContent = `${intent.description}${intent.viaAI ? ' (AI)' : ' (local parser)'} -- ${applied.length} seed${applied.length === 1 ? '' : 's'} planted${skipped.length ? `, ${skipped.length} skipped (outside your claim)` : ''}.`;
    if (applied.length > 0) {
      refreshOrganismsSnapshot(world);
      onChange();
    }
    input.value = '';
  });

  // Frost line (RHOMBIVERSE_SPEC_STAR_SYSTEM.md section 3): reads the
  // live `planetoids` closure variable at call time (not a stale
  // snapshot), so it always reflects whatever stars exist as of the most
  // recent onChange.
  const canPlaceMaterial = (material, x, y, z) =>
    canPlaceForStars(material, x, y, z, Object.values(planetoids).filter((p) => p.isStar));

  // B4a: Sculpt tool (Create -> Sculpt). Full-Cyborg stays behind this
  // flag in the shared world until B7's moderation work is verified --
  // per the plan's own instruction, the logic itself is fully built
  // either way, just not reachable here while false. Standalone
  // Sculpture Mode (B4b) enables it unconditionally, since nothing
  // there touches shared world-state.
  const FULL_CYBORG_INWORLD_ENABLED = false;
  const sculptSession = createSculptureSession(myUserId ?? 'local-player');
  let sculptMirrorPlane = '';
  let sculptActionMode = 'add';

  const sculptPanelEl = document.getElementById('sculpt-panel');
  const sculptSuggestionEl = document.getElementById('sculpt-suggestion');
  const sculptSuggestionTextEl = document.getElementById('sculpt-suggestion-text');
  const sculptFullCyborgSection = document.getElementById('sculpt-fullcyborg-section');
  const sculptFullCyborgGated = document.getElementById('sculpt-fullcyborg-gated');

  function openSculptPanel() {
    sculptPanelEl.classList.add('open');
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

  document.querySelectorAll('#sculpt-mirror-row .mirror-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sculpt-mirror-row .mirror-btn').forEach((b) => b.classList.toggle('active', b === btn));
      sculptMirrorPlane = btn.dataset.plane;
    });
  });

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
    renderSculptSuggestion();
  });
  document.getElementById('sculpt-suggestion-dismiss').addEventListener('click', () => {
    dismissSculptSuggestion(sculptSession);
    renderSculptSuggestion();
  });

  // Full-Cyborg (only reachable in-world once FULL_CYBORG_INWORLD_ENABLED
  // flips true -- see the tier-button handler above, which keeps this
  // section hidden until then).
  document.getElementById('sculpt-nl-go').addEventListener('click', async () => {
    const input = document.getElementById('sculpt-nl-input');
    const resultEl = document.getElementById('sculpt-nl-result');
    const text = input.value.trim();
    if (!text) return;
    resultEl.textContent = 'Thinking…';
    const origin = { x: 0, y: 0, z: 0 }; // TODO: last-hovered cell once Sculpt mode grows ghost-hover support
    const intent = await requestFullCyborgIntent(text, origin, sculptMirrorPlane);
    if (intent.unrecognized) {
      resultEl.textContent = intent.description;
      return;
    }
    const material = materialSelect.value;
    const { applied, skipped } = executeFullCyborgIntent(
      sculptTarget.world,
      intent,
      sculptTarget.world.getClaims(),
      myUserId ?? 'local-player',
      material,
      sculptTarget.canPlaceMaterial
    );
    resultEl.textContent = `${intent.description}${intent.viaAI ? ' (AI)' : ' (local parser)'} -- ${applied.length} cell${applied.length === 1 ? '' : 's'} placed${skipped.length ? `, ${skipped.length} skipped (outside your claim)` : ''}.`;
    if (applied.length > 0) sculptTarget.apply();
    input.value = '';
  });

  // Sculpt mode's own click handling (build.js has a one-line no-op for
  // mode === 'sculpt', same shape as its Plant-mode no-op above).
  // sculptTarget is an indirection so the SAME click handler/panel serves
  // both B4a (in-world, targets `world`/`mesh`) and B4b (standalone,
  // targets `sculptureWorld`/`sculptureMesh`) -- swapped by
  // enterSculptureMode/exitSculptureMode below, never duplicated.
  const sculptTarget = {
    world,
    mesh,
    canPlaceMaterial,
    apply: onChange,
  };
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

    // Model (add): the neighbor cell across the clicked face, same
    // target-selection rule Build mode uses. Chisel (remove): the
    // clicked cell itself, matching the tool's own "carve away what
    // you're pointing at" framing.
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
    // Manual tier auto-mirrors immediately (a direct player action, same
    // as every other consent-free build tool). Semi-Cyborg deliberately
    // does NOT auto-mirror here -- the whole point of that tier is that
    // completing the mirror is the AGENT's proposal, surfaced as an
    // accept/dismiss suggestion below, not applied inline with the
    // player's own click.
    const touched = sculptStroke(sculptTarget.world, sculptActionMode, targetX, targetY, targetZ, radius, material, isSemiCyborg ? null : sculptMirrorPlane || null, sculptTarget.canPlaceMaterial);
    if (touched.length === 0) return;
    sculptTarget.apply();

    if (isSemiCyborg) {
      const lastCell = { ...touched[touched.length - 1], action: sculptActionMode, material };
      updateSemiCyborgSuggestion(sculptSession, sculptTarget.world, lastCell, sculptMirrorPlane || null);
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
    // Duality's shadow mesh lives in whichever scene was active when it
    // was built -- turn it off cleanly before switching scenes rather
    // than leaving a stale shadow (and a hidden main mesh) behind.
    document.getElementById('duality-toggle')?.classList.contains('active') && document.getElementById('duality-toggle').click();
    savedCameraState.position.copy(camera.position);
    savedCameraState.target.copy(controls.target);
    if (!sculptureWorld) {
      sculptureWorld = createWorldStore({ worldName: 'Sculpture Scratch', version: 1, cells: {}, meta: {} });
      // A completely empty world has no face to click "Model" onto at
      // all (the same bootstrap problem B1 fixed for the main world's
      // old single-empty-cell starter) -- one seed cell, not a whole
      // planetoid, since this is meant to be a bare scratch space.
      sculptureWorld.addCell(0, 0, 0, { material: 'base' });
    }
    sculptureModeActive = true;
    sculptTarget.world = sculptureWorld;
    sculptTarget.mesh = sculptureMesh;
    sculptTarget.canPlaceMaterial = permissiveCanPlaceMaterial;
    sculptTarget.apply = () => rebuildInstances(sculptureMesh, sculptureWorld);
    rebuildInstances(sculptureMesh, sculptureWorld);
    camera.position.set(6, 5, 8);
    controls.target.set(0, 0, 0);
    // Full-Cyborg is enabled unconditionally here -- nothing in this
    // scratch space writes shared world-state, so B7's moderation gate
    // (which the in-world tier stays behind) doesn't apply.
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

  // Export -- reuses the exact same buildRDGeometry-derived `geometry`
  // every in-world cell already renders with (via sculptureMesh's own
  // geometry), merged into one real BufferGeometry per active instance
  // rather than a new from-scratch export pipeline.
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

  // "place a copy in-world" -- the ONLY bridge back to shared world-state
  // (B4b's own wording). A normal player-attributed placement (the
  // player placing something they made), not a live agent write, so it
  // doesn't need the Full-Cyborg gate either -- it's just world.addCell,
  // the same call every manual build action already makes, offset so it
  // doesn't land on top of whatever's already at the main world's origin.
  document.getElementById('sculpture-place-in-world')?.addEventListener('click', () => {
    if (!sculptureWorld) return;
    const cells = sculptureWorld.entries();
    if (cells.length === 0) return;
    const xs = cells.map((c) => c.x);
    // Must be an EVEN shift -- isValidCell requires x+y+z even, and this
    // only offsets x, so an odd offset would flip every placed cell's
    // parity and make isValidCell reject all of them below.
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

  // Ghost block preview (B1's "intelligent ghost block"): up to two
  // translucent RD meshes, reusing the exact same geometry as the real
  // mesh so the preview always matches the real shape exactly. Hidden by
  // default; build.js's onHover/onHoverEnd callbacks below drive
  // position/visibility -- render.js owns the actual THREE objects since
  // it already owns `scene`/`geometry`, keeping build.js's own job pure
  // raycasting/state (same separation the rest of this file already uses).
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
  // B2: the material wheel's live structure-preview on hover recolors
  // this same ghost instead of a separate preview object -- when set,
  // it overrides the normal occupied/valid tint until hover ends.
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

  // Placement/removal feedback (B1): a short outline flash at the
  // affected cell plus a WebAudio blip (sfx.js). Reuses the same shared
  // geometry as the ghost preview -- a wireframe wrapper via
  // EdgesGeometry, scaled up and faded out over a fixed short duration,
  // then disposed, so nothing here needs its own per-frame animation
  // loop beyond a single requestAnimationFrame chain.
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
    cellAt: (instanceId) => cellOrder[instanceId],
    world,
    onChange,
    onHover: (cells, valid) => {
      if (cells && cells.length > 0) {
        showGhost(cells);
        // B3: 'faceHovered' -- fires on any valid hovered face, not just
        // an unoccupied one, matching the subscript step's own plain-
        // language framing ("hover over one" of the 12 faces).
        window.dispatchEvent(new CustomEvent('rhombiverse:faceHovered'));
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
    getDragPlacementEnabled: () => wheel.isDragPlacementEnabled(),
    // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md: Plant mode's own build/place
    // handling is in render.js (its own click listener below), never
    // build.js -- but getMode() must still return the real 'plant'
    // string here, not null. A real bug caught fixing this: returning
    // null (mirroring how Walk mode disables editing entirely) also
    // silently disabled onContextMenu's right-click removal in Plant
    // mode, contradicting "right-click always removes the clicked
    // cell, in every mode." build.js's own onClick has a one-line
    // `mode === 'plant'` no-op instead, so its own unconditional build
    // fallthrough is skipped WITHOUT also disabling removal.
    getMode: () => (walking ? null : currentMode),
    getShellCount,
    getMinShell: () => Math.min(Math.max(1, Number(hollowFromInput.value) || 1), getShellCount()),
    getMaterial: () => materialSelect.value,
    getGeneratorType: () => document.getElementById('generator-type-select').value,
    canPlaceMaterial,
    getOwnerId: () => myUserId,
    mineRemote: (x, y, z) => {
      if (sharedWorldActive) mineAsteroidCellRemote(x, y, z);
    },
    onCellClicked: (cell) => {
      focusedCenterKey = cell.shellCenter || null;
      renderRingList();
    },
  });

  // Rhombic Wheel (B1) -- the one control surface all mode/material
  // interaction is meant to go through now that the old always-visible
  // sidebar is gone. Drives the hidden .mode-btn/#material-select/etc.
  // shim elements directly (see wheel.js's own header for why), so this
  // needs no further wiring into build.js's mode dispatch itself.
  const wheel = createRhombicWheel({
    onModeChosen: () => {
      updateModeUI();
      rebuildInstances(mesh, world, currentMode === 'report');
    },
    onDragPlacementChange: (enabled) => {
      // Left-drag normally orbits the camera (OrbitControls' own
      // default) -- while Repeat is armed, left-drag instead paints a
      // run of cells (build.js's onPointerMove), so orbiting via that
      // button has to yield for as long as Repeat stays selected.
      // Right-click (remove) and middle-drag (zoom) are unaffected.
      controls.mouseButtons.LEFT = enabled ? null : ORBIT_LEFT_DEFAULT;
    },
    onPrompt: (text) => showHudPrompt(text),
    onMenuSound: playMenuSound,
    onSelectionChange: updateHudIndicator,
    onOpenSculptPanel: openSculptPanel,
    onOpenCultivatePanel: () => document.getElementById('cultivate-panel').classList.add('open'),
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

  // Shared World (Phase 5): applyRemoteUpsert/Delete write an incoming
  // realtime change into the LOCAL store via the same world.addCell/
  // removeCell every other code path uses (so derived mechanics --
  // hydrosphere, black hole, star fusion -- recompute correctly against
  // it too, since onChange() re-runs the full apply* pipeline), guarded
  // by applyingRemote so handleLocalAdd/Remove (registered on the store
  // above) don't immediately push the very change that was just received
  // back to Supabase.
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

  // Claims have no local push-hook to suppress (unlike cells' addCell/
  // removeCell -- see worldstate.js), so no applyingRemote guard is
  // needed here: applying an incoming claim can never itself trigger
  // another push. No onChange() either -- claims have no visual
  // representation yet (no boundary rendering in this pass), and per
  // Isolation a newly-announced claim never retroactively touches
  // already-placed cells, so there's nothing to re-render.
  function applyRemoteClaim(claimId, claimData) {
    world.addClaim(claimId, claimData);
    refreshClaims();
  }

  // RHOMBIVERSE_SPEC_ASTEROIDS.md section 4: unlike cells, setting/
  // clearing a regrowth-queue entry is pure bookkeeping with no visual
  // effect of its own (the actual cell reappearing/vanishing is a
  // SEPARATE cells-table event that already triggers its own onChange
  // via applyRemoteUpsert/applyRemoteDelete above) -- so no onChange()
  // here, same reasoning as claims. DOES need the applyingRemote guard,
  // unlike claims, since setRegrowthEntry/removeRegrowthEntry have real
  // local push-hooks (handleLocalRegrowthSet/Clear) that would otherwise
  // immediately re-push what was just received.
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

  // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 10, closed 2026-08-13:
  // unlike regrowth entries, a seed HAS real visual geometry (its
  // tiles), so an incoming remote seed (a fresh plant from another
  // player, or a growth tick on a seed this session didn't plant) needs
  // rebuildSeedMeshes, not just a silent store update. No onChange()
  // here -- a growth-layer seed's tiles are their own separate mesh
  // group (see rebuildSeedMeshes), not part of the RD InstancedMesh
  // onChange() re-syncs.
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

  // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md: inventory has no local push-hook
  // (worldstate.js's setInventoryEntry is a plain setter -- Shared World
  // inventory changes only ever originate server-side, via
  // mine_asteroid_cell or the trade-resolution trigger, never a direct
  // client write), so no applyingRemote guard is needed, same reasoning
  // as claims. No onChange() either -- inventory has no 3D representation;
  // just re-renders the panel.
  function applyRemoteInventory(ownerId, material, entry) {
    world.setInventoryEntry(ownerId, material, entry);
    updateInventoryHint();
    renderTradePanel();
  }

  // Same no-guard reasoning as inventory above -- a pending trade only
  // ever changes via this session's own pushTradePropose/Confirm/Cancel
  // calls (which never touch world.setPendingTrade directly, see
  // proposeTradeUI/confirmTradeUI/cancelTradeUI below) or another
  // client's realtime echo, never a local write that could feedback-loop.
  function applyRemoteTrade(tradeId, tradeData) {
    world.setPendingTrade(tradeId, tradeData);
    renderTradePanel();
  }
  function applyRemoteTradeClear(tradeId) {
    world.removePendingTrade(tradeId);
    renderTradePanel();
  }

  const sharedWorldToggle = document.getElementById('shared-world-toggle');
  const sharedWorldHint = document.getElementById('shared-world-hint');
  const newWorldBtn = document.getElementById('new-world');
  const loadPresetBtn = document.getElementById('load-preset');
  const claimLandBtn = document.getElementById('claim-land-btn');
  const claimHint = document.getElementById('claim-hint');
  const claimsListEl = document.getElementById('claims-list');

  // Rebuilds both the wireframe-sphere territory visuals AND the text
  // list from world.getClaims() -- called after every point claims
  // actually change (a local grant, a remote claim arriving, entering/
  // leaving Shared World), not on every onChange(), since claims change
  // far less often than cells do. Clearing and rebuilding the whole
  // group each time is simpler than diffing for the handful of claims
  // this project has ever been tested with -- revisit if that stops
  // being true.
  function refreshClaims() {
    while (claimGroup.children.length > 0) {
      const child = claimGroup.children[0];
      claimGroup.remove(child);
      child.geometry.dispose();
      child.material.dispose();
    }
    const claims = world.getClaims();
    currentClaims = claims;
    const ids = Object.keys(claims);

    // One claim per player (RHOMBIVERSE_SPEC_LOOPHOLES.md section 2) --
    // disable the button once this session already owns one, rather than
    // letting them click it again just to see the "already have a claim"
    // error every time. Only touches the button while Shared World is
    // actually active; setClaimLandEnabled(false) on disconnect already
    // covers the other case.
    if (sharedWorldActive) {
      claimLandBtn.disabled = ids.some((id) => claims[id].ownerId === myUserId);
    }

    for (const id of ids) {
      const claim = claims[id];
      const [wx, wy, wz] = cellToWorld(...claim.center, SCALE);
      // Footprint points are already in world space (claimFootprintWorldVertices
      // applies SCALE itself), offset by -claim center so the resulting
      // geometry is centered at its own local origin -- the mesh is then
      // positioned via `.position.set`, matching how every other object
      // in this scene is placed, rather than baking the offset into the
      // geometry itself.
      const points = claimFootprintWorldVertices(claim, SCALE).map(([x, y, z]) => new THREE.Vector3(x - wx, y - wy, z - wz));
      const hullGeom = new ConvexGeometry(points);
      const mine = claim.ownerId === myUserId;
      // Solid, low-opacity fill (not wireframe) -- a wireframe of an
      // 8-shell claim's real convex hull has far more facets than the
      // old sphere ever did and reads as visual noise; a translucent
      // solid volume is what actually makes overlapping claims legible
      // at a glance. DoubleSide since the camera can end up inside a
      // large claim's own hull while walking.
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
      // Only your own claims get the toggle -- RLS would silently reject
      // an attempt on anyone else's anyway (claims_update_own), so there's
      // no point offering a control that can only ever fail.
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

  // Rebuilds ONE seed's own tile meshes from its current world-state --
  // called after growth (not a full-world rebuild) so an idle seed's
  // meshes are never touched just because something unrelated changed
  // elsewhere. Disposes the previous group's geometries/materials
  // before replacing them, same cleanup discipline refreshClaims above
  // already uses for its own THREE objects.
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
    // RHOMBIVERSE_SPEC_LATTICE_ZOOM.md Stage 5: a real tracked organism's
    // seed is deliberately EXCLUDED from this always-visible, full-block-
    // scale rendering -- this is the exact "scale-mismatch problem the
    // project owner raised" section 6.1 opens with (an amoeba/plant
    // rendered at the same order of magnitude as a whole building block).
    // Stage 5's own refreshOrganismMiniatures below replaces it with a
    // correctly tiny, LOD-gated version instead, reusing this exact same
    // real tile geometry, just scaled down and only revealed once the
    // camera is genuinely close. Ordinary (non-organism) growth species
    // are completely unaffected -- this only skips seeds whose species
    // carries evolution.js's own ORGANISM_SEED_SPECIES_PREFIX.
    if (seed.species.startsWith(ORGANISM_SEED_SPECIES_PREFIX)) return;
    const group = new THREE.Group();
    const color = speciesColor(seed.species);
    seed.tiles.forEach((tile, tileIndex) => {
      const verts = tileWorldVertices(seed, tile).map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const geometry = new ConvexGeometry(verts);
      const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
      const tileMesh = new THREE.Mesh(geometry, material);
      // B5 Cultivation Mode: lets the prune contextmenu handler below
      // identify exactly which seed/tile a right-click landed on.
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

  // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 3: direct barter only,
  // no marketplace/listings (the spec's own explicit scope limit) -- one
  // material each side, kept deliberately simple rather than a
  // multi-material offer basket. With no chat/DM system anywhere in this
  // app, a trade partner has to be identified by pasting their raw
  // player ID; the "known traders" list below (derived from the
  // already-public player_inventory data, not a new lookup) exists
  // purely so that isn't the ONLY way -- click a row to fill the input.
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

  function renderTradePanel() {
    const panel = document.getElementById('trade-panel');
    if (!panel) return;
    if (!sharedWorldActive || !myUserId) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';

    const inventory = world.getInventory();
    const partnerListEl = document.getElementById('trade-partner-list');
    const partnerIds = Object.keys(inventory).filter((id) => id !== myUserId && Object.keys(inventory[id]).length > 0);
    partnerListEl.innerHTML = '';
    if (partnerIds.length === 0) {
      partnerListEl.innerHTML = '<div class="placeholder">No other traders with inventory yet.</div>';
    } else {
      for (const id of partnerIds) {
        const row = document.createElement('div');
        row.className = 'trade-partner-item';
        row.textContent = `${shortId(id)} — ${formatOffer(
          Object.fromEntries(Object.entries(inventory[id]).map(([m, e]) => [m, e.quantity]))
        )}`;
        row.title = 'Click to fill in as trade partner';
        row.addEventListener('click', () => {
          document.getElementById('trade-partner-input').value = id;
        });
        partnerListEl.appendChild(row);
      }
    }

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

  const tradeOfferSelect = document.getElementById('trade-offer-material');
  const tradeWantSelect = document.getElementById('trade-want-material');
  for (const select of [tradeOfferSelect, tradeWantSelect]) {
    if (!select) continue;
    for (const [value, label] of TRADE_MATERIALS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  document.getElementById('propose-trade-btn')?.addEventListener('click', async () => {
    const hint = document.getElementById('trade-propose-hint');
    if (!sharedWorldActive || !myUserId) return;
    const partnerId = document.getElementById('trade-partner-input').value.trim();
    const offerMaterial = tradeOfferSelect.value;
    const offerQty = Math.floor(Number(document.getElementById('trade-offer-qty').value));
    const wantMaterial = tradeWantSelect.value;
    const wantQty = Math.floor(Number(document.getElementById('trade-want-qty').value));

    if (!partnerId || partnerId === myUserId) {
      hint.textContent = 'Enter a trade partner\'s ID (not your own).';
      return;
    }
    if (!Number.isFinite(offerQty) || offerQty <= 0 || !Number.isFinite(wantQty) || wantQty <= 0) {
      hint.textContent = 'Quantities must be positive whole numbers.';
      return;
    }
    const held = world.getInventory()[myUserId]?.[offerMaterial]?.quantity ?? 0;
    if (held < offerQty) {
      hint.textContent = `You only have ${held} ${offerMaterial}.`;
      return;
    }

    const tradeId = `trade_${shortId(myUserId)}_${Date.now()}`;
    hint.textContent = 'Proposing…';
    try {
      await pushTradePropose(tradeId, myUserId, { [offerMaterial]: offerQty }, partnerId, { [wantMaterial]: wantQty });
      hint.textContent = 'Trade proposed — waiting for confirmation.';
    } catch (err) {
      console.warn('Rhombiverse: propose trade failed', err);
      hint.textContent = 'Failed to propose trade (see console) — check the partner ID is valid.';
    }
  });

  // RHOMBIVERSE_SPEC_REGIONS.md, minimal UI trigger: grants this session's
  // player one fixed-size claim in the first free slot found outward from
  // world center. Only meaningful while Shared World is active (ownership
  // needs a real per-player identity, and claims are pointless to protect
  // in a world only you can ever see) -- claimLandBtn is enabled/disabled
  // alongside the other Shared-World-only controls. Pushes to Supabase
  // BEFORE applying locally (unlike cell edits, which apply optimistically
  // then push) -- computeClaim is pure/non-mutating specifically so this
  // ordering is possible, since a genuine concurrent-grant race on the
  // same free slot needs to be caught by the server (the claims table's
  // own primary key) before this client treats the claim as real.
  claimLandBtn.addEventListener('click', async () => {
    if (!sharedWorldActive || !myUserId) return;
    claimLandBtn.disabled = true;
    try {
      // Search near wherever this player actually is -- their real
      // position while walking, or wherever they're currently looking/
      // orbiting otherwise -- rather than always world center. See
      // findFreeSlot's own header (regions.js, 2026-08-13) for why: a
      // fixed shared search origin gets more crowded, and thus more
      // expensive to search past, as every player who has ever claimed
      // land accumulates near it; a per-player origin keeps search cost
      // flat regardless of total claims elsewhere in the (genuinely
      // unbounded) lattice.
      const focus = walking ? camera.position : controls.target;
      const [ox, oy, oz] = nearestValidCell(focus.x / SCALE, focus.y / SCALE, focus.z / SCALE);
      const { claimId, claimData } = computeClaim(world, myUserId, undefined, { x: ox, y: oy, z: oz });
      await pushClaim(claimId, claimData);
      world.addClaim(claimId, claimData);
      refreshClaims();
      claimHint.textContent =
        `Claimed ${claimId}: center [${claimData.center.join(', ')}], ` +
        `shell ${claimData.shellIndex}, size ${claimData.size}.`;
    } catch (err) {
      claimHint.textContent = `Claim failed: ${err.message}`;
      console.warn('Rhombiverse: claim failed', err);
    } finally {
      // NOT unconditionally re-enabled here -- a real bug caught live:
      // this used to always flip back to `!sharedWorldActive` (i.e.
      // enabled), immediately undoing refreshClaims()'s own "you already
      // own a claim, disable the button" state set moments earlier in the
      // try block above. Re-derive the same ownership check instead of
      // fighting refreshClaims for the last word.
      claimLandBtn.disabled =
        !sharedWorldActive || Object.values(world.getClaims()).some((c) => c.ownerId === myUserId);
    }
  });

  // New World / Import / Load preset all mutate via world.replaceAll(),
  // which deliberately bypasses the addCell/removeCell sync hooks (see
  // worldstate.js) -- a personal local-view reset must never bulk-push
  // or bulk-delete against the shared table. Rather than let that
  // silently desync the view from the shared world, these three controls
  // are simply disabled for the duration of the Shared World session.
  function setLocalResetControlsEnabled(enabled) {
    newWorldBtn.disabled = !enabled;
    importInput.disabled = !enabled;
    loadPresetBtn.disabled = !enabled;
  }

  // claimLandBtn is the inverse of the above -- disabled OUTSIDE Shared
  // World (ownership is meaningless in a world only you can see), enabled
  // only while connected.
  function setClaimLandEnabled(enabled) {
    claimLandBtn.disabled = !enabled;
    if (!enabled) claimHint.textContent = '';
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
    const local = loadFromLocalStorage() ?? (await loadWorld('./data/starter-world.json'));
    world.replaceAll(local);
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

  document.getElementById('new-world').addEventListener('click', async () => {
    if (!confirm('Start a new world? This clears your current build.')) return;
    clearLocalStorage();
    const fresh = await loadWorld('./data/starter-world.json');
    world.replaceAll(fresh);
    onChange();
    rebuildAllGrowth();
  });

  document.getElementById('export-json').addEventListener('click', () => {
    exportWorldFile({ ...world.toJSON(), planetoids });
  });

  const importInput = document.getElementById('import-json');
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const parsed = await importWorldFile(file);
      world.replaceAll(parsed);
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
  document.getElementById('load-preset').addEventListener('click', async () => {
    const key = document.getElementById('preset-select').value;
    if (!key) return;
    if (!confirm('Load this preset? This clears your current build.')) return;
    // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md section 4.1: growth-layer
    // presets live in their own data/growth-presets/ directory
    // (distinct from data/presets/*.json's planetoid presets), selected
    // by a "growth:" prefix on the option value rather than a second
    // dropdown -- simplest thing that works for one extra directory.
    const path = key.startsWith('growth:')
      ? `./data/growth-presets/${key.slice('growth:'.length)}.json`
      : `./data/presets/${key}.json`;
    const preset = await loadWorld(path);
    world.replaceAll(preset);
    onChange();
    rebuildAllGrowth();
  });

  // RHOMBIVERSE_SPEC_ASTEROIDS.md section 4: a mined cell should regrow
  // as real time passes, not only on the player's next edit -- a periodic
  // tick covers idle time between mutations. Deliberately does NOT go
  // through onChange() (which would push a phantom undo-stack entry and
  // re-save on every tick even when nothing regrew) -- only rebuilds
  // instances and persists when applyAsteroidRegeneration actually
  // changed the cell count. Regrown cells still sync to Shared World
  // normally, since world.addCell (called inside applyAsteroidRegeneration)
  // fires the same onAdd hook as any other cell placement.
  setInterval(() => {
    const before = world.entries().length;
    applyAsteroidRegeneration(world);
    applyPopulationScaledSpawning(world);
    // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md section 4: decay never changes
    // cell count (it only touches playerInventory), so it can't be
    // gated behind the same before/after cell-count check above -- but
    // the inventory hint still needs to reflect it as it happens, not
    // only after the player's next unrelated edit.
    applyInventoryDecay(world);
    updateInventoryHint();
    // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md: same "periodic tick covers
    // idle time" reasoning as asteroid regrowth above, and the exact
    // same "don't route through onChange()" avoidance -- but checked
    // independently of the cells before/after comparison, since growth
    // never touches `cells` at all (a seed's own tiles live entirely in
    // `seeds`, per the spec's Isolation section).
    if (applyGrowth(world, Date.now())) {
      rebuildAllGrowth();
      if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
    }
    // RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md section 4: the same
    // periodic-tick shape covers real elapsed time for organisms too --
    // most ticks resolve zero generations (EVOLUTION_GENERATION_
    // INTERVAL_MS is 30s, this tick is 5s) and are cheap no-ops, exactly
    // like applyGrowth's own cooldown above. Gated off while Shared
    // World is active for the same reason the initial on-load resolve
    // is (see resolveEvolution's own header -- no sync path yet).
    //
    // Real bug caught by a live Playwright run before trusting this:
    // resolveCatchUpForAllPlanetoids advances each planetoid's own
    // lastSimulated/rngState bookkeeping in the LIVE in-memory world
    // object on every call, even when zero generations resolve -- that
    // part is correct and accumulates fine across ticks within one
    // continuous session. But this used to only call saveToLocalStorage
    // when resolveEvolution returned true (something visibly changed),
    // exactly mirroring applyGrowth's own pattern above -- which is
    // wrong here specifically, because unlike a growth seed (whose
    // lastGrowthAt is never touched at all unless real growth happens),
    // a brand-new planetoid's very first resolve falls back to `now` as
    // its baseline lastSimulated and only that in-memory value ever
    // advances it correctly afterward. A page reload before the first
    // real generation ever resolves (up to a 30s window) would have lost
    // that in-memory baseline entirely, silently resetting the clock.
    // Saving on every tick that has at least one organism to track
    // (regardless of whether this specific tick grew anything) closes
    // that gap.
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

let lastFrameTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000); // clamp avoids a huge step after a tab is backgrounded
  lastFrameTime = now;

  if (walking && player) {
    player.update(dt);
    // player position changes every frame, unlike Build mode's onChange-driven updates
    updateGravityInfo();
    updateBeltHint();
    updateEvolutionInfo();
  } else {
    controls.update();
  }
  renderer.render(sculptureModeActive ? sculptureScene : scene, camera);
}

init();
animate();
