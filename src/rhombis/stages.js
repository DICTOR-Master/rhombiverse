// Rhombis stage content: what each stage's skeleton/tray actually is,
// built from the one shared pyramidGeometry() (geometry.js) plus
// transforms only, per docs/RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md.
// main.js is the generic engine (input, render loop, HUD, stage
// advance); this file is purely "what exists in the scene for stage N"
// plus the matching initial puzzle-state descriptors -- kept separate
// so adding Stage 4+ is a new build function here, not a main.js
// rewrite.
import * as THREE from 'three';
import { pyramidGeometry, outwardQuaternion, inwardQuaternion, AXIS_NORMALS } from './geometry.js';
import { PYRAMID_AXES } from '../core/lattice.js';

export const WIRE_COLOR = 0x6ad0ff;
const PIECE_COLOR = 0xffb35c;
const IDENTITY_QUATERNION = new THREE.Quaternion();
const ORIGIN = new THREE.Vector3(0, 0, 0);

function pieceMaterial() {
  return new THREE.MeshStandardMaterial({ color: PIECE_COLOR, roughness: 0.5, metalness: 0.1 });
}

// `position` is a real translation, not just cosmetic -- Stage 1/2's
// shared-base voids correctly need none (the canonical mesh's own base
// already sits at local y=0, exactly where those voids want it), but
// Stage 3's inward-pointing cube voids do NOT: rotating the canonical
// mesh about the origin alone leaves its base pinned at the origin and
// swings its apex out to the FACE, the exact opposite of "apex at the
// shared center, base on the face" -- verified numerically before this
// fix landed (apex ended up at -AXIS_NORMALS*scale/2, base at the
// origin). The real fix is a translation by +AXIS_NORMALS*(scale/2)
// alongside the rotation, which is what buildStage3 now passes.
function makeVoid(geometry, { id, requiredOrientation, quaternion = IDENTITY_QUATERNION, position = ORIGIN, groupId }) {
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: WIRE_COLOR }));
  wire.quaternion.copy(quaternion);
  wire.position.copy(position);
  const hitTarget = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  hitTarget.quaternion.copy(quaternion);
  hitTarget.position.copy(position);
  hitTarget.userData.voidId = id;
  return {
    id,
    requiredOrientation,
    groupId,
    wire,
    hitTarget,
    quaternion: quaternion.clone(),
    position: position.clone(),
    sceneObjects: [wire, hitTarget],
  };
}

// `orientation`/`orientationOptions` are only set for a piece the player
// can flip themselves (Stage 2). A piece without them (Stage 1's single
// piece, Stage 3's cube pieces) starts in the plain identity pose and
// gets its final rotation set programmatically on placement instead --
// no player-driven flip needed for a piece that only ever goes one way.
function makePiece(geometry, { id, orientation, orientationOptions, homePosition }) {
  const mesh = new THREE.Mesh(geometry, pieceMaterial());
  mesh.position.copy(homePosition);
  if (orientation) mesh.quaternion.copy(outwardQuaternion(orientation));
  mesh.userData.pieceId = id;
  return { id, orientation, orientationOptions, mesh, homePosition: homePosition.clone() };
}

// A "fused" piece (Stage 5): a genuinely different physical object, not
// a transform of the shared pyramid mesh -- stands in for every void in
// `fillsGroup` at once. Always visible in the tray from the start (see
// main.js's revealNextTrayPiece, which only ever queues loose pieces),
// since the player CHOOSES between it and the loose pieces rather than
// receiving it in sequence.
function makeFusedPiece(geometry, { id, fillsGroup, homePosition }) {
  const mesh = new THREE.Mesh(geometry, pieceMaterial());
  mesh.position.copy(homePosition);
  mesh.userData.pieceId = id;
  return { id, fillsGroup, mesh, homePosition: homePosition.clone() };
}

// Stage 1 -- engine + one piece. Direct instruction (2026-09-03): even
// this first piece starts in the WRONG orientation ('y-', apex down)
// against a void that wants 'y+' (apex up, the default identity pose),
// so the flip mechanic and the red/green valid-target highlighting are
// both already in play on the very first puzzle, rather than appearing
// cold at Stage 2.
function buildStage1(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  const v0 = makeVoid(geometry, { id: 'v0', requiredOrientation: 'y+', quaternion: outwardQuaternion('y+') });
  skeletonGroup.add(...v0.sceneObjects);

  const p0 = makePiece(geometry, {
    id: 'p0',
    orientation: 'y-',
    orientationOptions: ['y+', 'y-'],
    homePosition: new THREE.Vector3(scale * 2.2, 0, 0),
  });

  return {
    skeletonGroup,
    pieces: [p0],
    voids: [v0],
  };
}

// Stage 2 -- octahedron: two of the same pyramid joined base-to-base,
// apex 'y+' (outward/up, identity) and apex 'y-' (outward/down, a 180
// degree flip), sharing the same base plane at local y=0 -- see
// geometry.js's header for why that's a plain transform of Stage 1's
// own mesh, not a new shape. Both tray pieces start 'y+': exactly one
// void (v-up) accepts a piece as-is, so solving forces at least one
// real flip, and either piece can go in either void once flipped to
// match -- "both placeable in either order" per the spec's own Stage 2
// "Done when".
function buildStage2(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  const vUp = makeVoid(geometry, { id: 'v-up', requiredOrientation: 'y+', quaternion: outwardQuaternion('y+') });
  const vDown = makeVoid(geometry, { id: 'v-down', requiredOrientation: 'y-', quaternion: outwardQuaternion('y-') });
  skeletonGroup.add(...vUp.sceneObjects, ...vDown.sceneObjects);

  const orientationOptions = ['y+', 'y-'];
  const p0 = makePiece(geometry, {
    id: 'p0',
    orientation: 'y+',
    orientationOptions,
    homePosition: new THREE.Vector3(scale * 2.4, 0, scale * 0.9),
  });
  const p1 = makePiece(geometry, {
    id: 'p1',
    orientation: 'y+',
    orientationOptions,
    homePosition: new THREE.Vector3(scale * 2.4, 0, -scale * 0.9),
  });

  return {
    skeletonGroup,
    pieces: [p0, p1],
    voids: [vUp, vDown],
  };
}

// Stage 3 -- cube: 6 of the same pyramid, apex pointing INWARD off each
// of the cube's 6 faces, all 6 apexes meeting at the shared center
// (RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md's own cube row: "apexes
// meeting at the cube's center, one pyramid per face"). No player-
// driven orientation choice here (unlike Stage 2) -- each void has
// exactly one correct pose and the piece snaps to it on placement, so
// pieces carry no `orientation`/`orientationOptions` at all. What's new
// this stage is the TRAY: 6 identical piece entries, but only the next
// unplaced one is ever visible in the tray slot at once (main.js reveals
// the next after each placement) with the remaining count shown in the
// HUD text -- "tray needs to track counts of identical pieces" per the
// spec, without needing a new puzzle-state.js shape (they're still just
// 6 ordinary piece ids).
//
// Direct instruction (2026-09-03): the skeleton's internal pyramid
// seams stay visible from the start for now (all 6 wires drawn up
// front), not just the cube's outer silhouette -- the spec's stricter
// "no lattice until solved" is deferred, not forgotten.
function buildStage3(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();

  const voids = PYRAMID_AXES.map((axisKey) => {
    const v = makeVoid(geometry, {
      id: `v-${axisKey}`,
      quaternion: inwardQuaternion(axisKey),
      position: AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2),
    });
    skeletonGroup.add(...v.sceneObjects);
    return v;
  });

  const homePosition = new THREE.Vector3(scale * 2.6, 0, 0);
  const pieces = PYRAMID_AXES.map((axisKey, i) => {
    const p = makePiece(geometry, { id: `p${i}`, homePosition });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    return p;
  });

  return {
    skeletonGroup,
    pieces,
    voids,
  };
}

// Stage 4 -- rhombic dodecahedron: 12 of the same pyramid, 2 per cube
// face (RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md's own RD row: "a
// cube's 6 inward pyramids, plus 6 more of the same pyramid mirrored
// outward on each face"). Per axis, the inward void (Stage 3's own) and
// the new outward void share the exact same `position` (both have their
// base on that same cube face) and differ only in `quaternion` --
// inward apex meets the shared center, outward apex is the RD's own
// spike. Verified numerically before landing (outward 'y+' at scale=2:
// base world (0,1,0), apex world (0,2,0), exactly the spec's own stated
// "(0,±s,0)" outward cap coordinate) rather than assumed from the
// Stage 3 pattern. "Inward and outward pyramids look identical but sit
// differently" (the spec's own Stage 4 note) is handled for free by
// plain 3D occlusion -- an inward void's hit-target volume is INSIDE
// the cube envelope, an outward one is OUTSIDE it as a spike, so they
// never compete for the same raycast hit despite sharing a base
// position; no extra disambiguation logic needed. Like Stage 3, no
// player-driven orientation choice -- 12 identical, non-flippable tray
// pieces that auto-snap to whichever void is tapped, count-tracked the
// same way.
function buildStage4(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();

  const voids = PYRAMID_AXES.flatMap((axisKey) => {
    const facePosition = AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2);
    const vIn = makeVoid(geometry, {
      id: `v-in-${axisKey}`,
      quaternion: inwardQuaternion(axisKey),
      position: facePosition,
    });
    const vOut = makeVoid(geometry, {
      id: `v-out-${axisKey}`,
      quaternion: outwardQuaternion(axisKey),
      position: facePosition.clone(),
    });
    skeletonGroup.add(...vIn.sceneObjects, ...vOut.sceneObjects);
    return [vIn, vOut];
  });

  const homePosition = new THREE.Vector3(scale * 3.2, 0, 0);
  const pieces = voids.map((_, i) => {
    const p = makePiece(geometry, { id: `p${i}`, homePosition });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    return p;
  });

  return {
    skeletonGroup,
    pieces,
    voids,
  };
}

// Stage 5 -- conjoined pieces: the SAME 6-void cube as Stage 3, but the
// tray now also offers a single pre-fused "cube" piece as an alternate
// fill for all 6 at once (RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md:
// "a fused six for a cube... optional fill for part of a larger void").
// Demonstrates the spec's own Stage 5 "Done when" directly: solvable
// either by placing 6 loose pyramids one at a time (exactly Stage 3's
// own flow, still fully available) OR by selecting the fused piece and
// tapping once -- both are real, independent decompositions of the
// identical cube volume (puzzle-state.js's own `fillsGroup`/`groupId`
// mechanism, unit tested for both paths plus the "fused piece rejected
// once a loose piece has claimed part of the group" case). The fused
// piece is a genuine `THREE.BoxGeometry` -- a real cube, not 6 stitched
// copies of the shared pyramid mesh -- since it's honestly a DIFFERENT
// physical object, not a transform of the one shared piece the rest of
// Rhombis reuses.
function buildStage5(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  const GROUP_ID = 'cube';

  const voids = PYRAMID_AXES.map((axisKey) => {
    const v = makeVoid(geometry, {
      id: `v-${axisKey}`,
      quaternion: inwardQuaternion(axisKey),
      position: AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2),
      groupId: GROUP_ID,
    });
    skeletonGroup.add(...v.sceneObjects);
    return v;
  });

  const homePosition = new THREE.Vector3(scale * 2.6, 0, 0);
  const loosePieces = PYRAMID_AXES.map((axisKey, i) => {
    const p = makePiece(geometry, { id: `p${i}`, homePosition });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    return p;
  });

  const fusedGeometry = new THREE.BoxGeometry(scale, scale, scale);
  const fusedHomePosition = new THREE.Vector3(scale * 2.6, -scale * 1.7, 0);
  const fusedPiece = makeFusedPiece(fusedGeometry, {
    id: 'fused',
    fillsGroup: GROUP_ID,
    homePosition: fusedHomePosition,
  });

  return {
    skeletonGroup,
    pieces: [...loosePieces, fusedPiece],
    voids,
    groups: [{ id: GROUP_ID, position: new THREE.Vector3(0, 0, 0), quaternion: new THREE.Quaternion() }],
  };
}

export const STAGES = [
  { id: 1, name: 'One Piece', build: buildStage1 },
  { id: 2, name: 'Octahedron', build: buildStage2 },
  { id: 3, name: 'Cube', build: buildStage3 },
  { id: 4, name: 'Rhombic Dodecahedron', build: buildStage4 },
  { id: 5, name: 'Conjoined Pieces', build: buildStage5 },
];
