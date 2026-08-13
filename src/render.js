// Three.js scene, camera, RD mesh generation, instanced rendering.
// Phase 1 (RHOMBIVERSE_PLAN.md section 4): renderer + lattice math, camera
// orbit. Phase 2: wires build.js's click-to-add/remove controller onto
// the same InstancedMesh, re-syncing it after every world-state change.
// Phase 3: every change also saves to localStorage, and wires the New
// World / Export / Import buttons.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, cellToWorld, parseCellKey } from './lattice.js';
import { loadWorld, createWorldStore } from './worldstate.js';
import { createBuildController, removeShell, recolorShell } from './build.js';
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
} from './sync.js';
import { computeClaim, claimBoundingRadius } from './regions.js';
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
import { GROWTH_TEMPLATES, plantSeed, applyGrowth, tileWorldVertices } from './growth.js';

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

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(6, 5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
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
// Right-click is reserved for block removal (build.js), not camera pan.
controls.mouseButtons.RIGHT = null;

// Walk mode (RHOMBIVERSE_PLAN.md Phase 5.5) state, module-level since
// both init() (which creates `player` once the world is loaded) and
// animate() (the top-level render loop) need it. `planetoids` is derived
// from world-state and recomputed in onChange() -- see gravity.js.
let walking = false;
let player = null;
let planetoids = {};
// Mirrors world.getClaims(), same module-level pattern as planetoids
// above -- gravityAt() (RHOMBIVERSE_SPEC_LOOPHOLES.md section 5) and
// updateGravityInfo() both need it but live outside init()'s scope where
// `world` itself is declared, so it's kept in sync via refreshClaims()
// (inside init()) instead of read from world directly.
let currentClaims = {};

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

function enterWalk() {
  if (!player || walking) return;
  walking = true;
  controls.enabled = false;
  document.getElementById('walk-toggle').textContent = 'Exit Walk Mode (Esc)';
  document.getElementById('walk-hint').style.display = '';
  player.reset(camera.position);
  player.setEnabled(true);
  player.requestLock();
  updateGravityInfo();
  updateBeltHint();
}

function exitWalk() {
  if (!walking) return;
  walking = false;
  if (player) player.setEnabled(false);
  controls.enabled = true;
  camera.up.set(0, 1, 0);
  document.getElementById('walk-toggle').textContent = 'Enter Walk Mode';
  document.getElementById('walk-hint').style.display = 'none';
  updateGravityInfo();
  updateBeltHint();
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

// 2. Screen-navigation model for #controls/#shells-panel on narrow/touch
//    viewports, per direct feedback: "touch buttons that move you
//    through menu screens seems to make sense, minimal options...
//    always simplicity." A live phone-viewport diagnostic (Playwright,
//    iPhone 13 emulation) found #controls measured ~480px wide -- wider
//    than the whole 390px viewport -- completely covering the canvas
//    with no way to reach it at all; this replaces "both panels visible
//    at once" with one full-screen panel at a time (closed -> controls
//    -> shells), matching index.html's own
//    `(pointer: coarse), (max-width: 700px)` media query, under which
//    these become full-screen `inset:0` drawers. On desktop, where that
//    media query never applies, these listeners are harmless no-ops --
//    the CSS classList toggles have nothing to show/hide.
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const controlsPanelEl = document.getElementById('controls');
const shellsPanelEl = document.getElementById('shells-panel');

function openMobileControls() {
  shellsPanelEl.classList.remove('mobile-screen-open');
  controlsPanelEl.classList.add('mobile-screen-open');
  mobileMenuToggle.style.display = 'none';
}
function openMobileShells() {
  controlsPanelEl.classList.remove('mobile-screen-open');
  shellsPanelEl.classList.add('mobile-screen-open');
  mobileMenuToggle.style.display = 'none';
}
function closeMobilePanels() {
  controlsPanelEl.classList.remove('mobile-screen-open');
  shellsPanelEl.classList.remove('mobile-screen-open');
  mobileMenuToggle.style.display = '';
}

mobileMenuToggle.addEventListener('click', openMobileControls);
document.getElementById('mobile-close-controls').addEventListener('click', closeMobilePanels);
document.getElementById('mobile-goto-shells').addEventListener('click', openMobileShells);
document.getElementById('mobile-back-to-controls').addEventListener('click', openMobileControls);

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
};

function speciesColor(species) {
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
  // whole point of Phase 3 (refreshing preserves the build).
  const worldJSON = loadFromLocalStorage() ?? (await loadWorld('./data/starter-world.json'));
  const world = createWorldStore(worldJSON, {
    onAdd: handleLocalAdd,
    onRemove: handleLocalRemove,
    onRegrowthSet: handleLocalRegrowthSet,
    onRegrowthClear: handleLocalRegrowthClear,
  });
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

  // RHOMBIVERSE_SPEC_REGIONS.md territory visualization: one wireframe
  // sphere per claim, sized to its real bounding radius (claimBoundingRadius
  // -- exact geometry, not an estimate) rather than tinting individual
  // cells, since most of a claim's footprint is typically unbuilt space
  // with no cell to tint at all. A plain THREE.Group so the whole set can
  // be cleared and rebuilt in one call (refreshClaims below) without
  // tracking individual mesh references.
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
    btn.textContent = undoStack.length > 0 ? `Undo (${undoStack.length})` : 'Undo';
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
    renderRingList();
  }

  // Undo reverts the LOCAL view only, via replaceAll -- like New World/
  // Import/Load preset, it bypasses the addCell/removeCell hooks that
  // drive sync.js's pushes, so it can't un-push a change already synced
  // to the shared table. Disabled outright while Shared World is active
  // (see updateUndoButton) rather than left to silently desync.
  document.getElementById('undo-btn').addEventListener('click', () => {
    if (sharedWorldActive || undoStack.length === 0) return;
    const prev = undoStack.pop();
    world.replaceAll(JSON.parse(prev));
    lastSnapshot = prev;
    rebuildInstances(mesh, world, currentMode === 'report');
    saveToLocalStorage(world.toJSON());
    updateUndoButton();
    renderRingList();
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
  }
  updateSectionPlane();
  updateSectionEnabled();
  document.getElementById('section-enable').addEventListener('change', updateSectionEnabled);
  for (const id of ['section-axis', 'section-flip', 'section-pos']) {
    document.getElementById(id).addEventListener('input', updateSectionPlane);
  }

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
  }

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
    seedCounter += 1;
    const seedId = `seed_${Date.now()}_${seedCounter}`;
    const seed = plantSeed(world, seedId, species, origin);
    rebuildSeedMeshes(seedId, seed);
    if (!sharedWorldActive) saveToLocalStorage(world.toJSON());
  });
  updateModeUI();

  // Frost line (RHOMBIVERSE_SPEC_STAR_SYSTEM.md section 3): reads the
  // live `planetoids` closure variable at call time (not a stale
  // snapshot), so it always reflects whatever stars exist as of the most
  // recent onChange.
  const canPlaceMaterial = (material, x, y, z) =>
    canPlaceForStars(material, x, y, z, Object.values(planetoids).filter((p) => p.isStar));

  createBuildController({
    renderer,
    camera,
    mesh,
    cellAt: (instanceId) => cellOrder[instanceId],
    world,
    onChange,
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
      const radius = claimBoundingRadius(claim);
      const [wx, wy, wz] = cellToWorld(...claim.center, SCALE);
      const sphereGeom = new THREE.SphereGeometry(radius, 16, 12);
      const mine = claim.ownerId === myUserId;
      const sphereMat = new THREE.MeshBasicMaterial({
        color: mine ? CLAIM_COLOR_MINE : CLAIM_COLOR_OTHER,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      sphere.position.set(wx, wy, wz);
      claimGroup.add(sphere);
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
    }
    const group = new THREE.Group();
    const color = speciesColor(seed.species);
    for (const tile of seed.tiles) {
      const verts = tileWorldVertices(seed, tile).map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const geometry = new ConvexGeometry(verts);
      const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
      group.add(new THREE.Mesh(geometry, material));
    }
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
      const { claimId, claimData } = computeClaim(world, myUserId);
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
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
}

init();
animate();
