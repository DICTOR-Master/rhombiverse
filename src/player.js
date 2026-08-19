// Minimal first-person "Walk" controller for planetoid surfaces --
// RHOMBIVERSE_PLAN.md Phase 5.5's other half (gravity.js supplies the
// physics this reads). Deliberately NOT three/addons' PointerLockControls:
// that class hard-codes world Y as "up" in its internal Euler math, which
// breaks the moment gravity's "up" is a radial direction instead. This
// builds camera orientation directly from yaw/pitch plus whatever `up`
// gravity.js reports for the player's current position each frame, so
// walking on a curved planetoid surface re-levels correctly; flying in
// open space (no active planetoid) falls back to world Y and behaves like
// a simple no-clip flycam -- the "zero-gravity space between planetoids"
// case section 4 allows for inert cells applies here too.
//
// Known first-pass limitation: no roll blending between two DIFFERENT
// planetoids' gravity fields in one session (up snaps instantly at the
// boundary) -- acceptable for now since a single-planetoid session is the
// realistic first-playtest case; revisit if that changes.
import * as THREE from 'three';
import { getSettings } from './settings.js';

const WALK_SPEED = 4.0; // world units/sec, first-guess, not yet playtested
const FLY_SPEED = 6.0;
const GRAVITY_ACCEL = 9.0; // world units/sec^2, first-guess
const JUMP_SPEED = 4.5;
const PLAYER_EYE_HEIGHT = 0.9; // world units above a planetoid's surface radius
const MOUSE_SENSITIVITY = 0.0022;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function createPlayerController({ camera, domElement, getGravity }) {
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let grounded = false;
  let enabled = false;

  const keys = new Set();
  const onKeyDown = (e) => keys.add(e.code);
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseMove = (e) => {
    if (document.pointerLockElement !== domElement) return;
    const { sensitivity, invertY } = getSettings();
    const sens = MOUSE_SENSITIVITY * sensitivity;
    yaw -= e.movementX * sens;
    pitch -= (invertY ? -1 : 1) * e.movementY * sens;
    const limit = Math.PI / 2 - 0.01;
    pitch = Math.max(-limit, Math.min(limit, pitch));
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);

  function reset(startPosition) {
    position.copy(startPosition);
    velocity.set(0, 0, 0);
    yaw = 0;
    pitch = 0;
    grounded = false;
  }

  function setEnabled(v) {
    enabled = v;
    keys.clear();
    if (!v && document.pointerLockElement === domElement) document.exitPointerLock();
  }

  function requestLock() {
    domElement.requestPointerLock();
  }

  function update(dt) {
    if (!enabled || dt <= 0) return;

    const gravity = getGravity(position);
    const up = gravity
      ? position.clone().sub(new THREE.Vector3(...gravity.centerOfMass)).normalize()
      : WORLD_UP.clone();

    // Camera basis: align world-Y-up basis vectors to `up`, then apply
    // yaw around `up` and pitch around the yaw-adjusted right axis --
    // the standard "re-level to an arbitrary up vector" construction.
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(WORLD_UP, up);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(alignQuat).applyAxisAngle(up, yaw);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(alignQuat).applyAxisAngle(up, yaw);
    const lookDir = forward.clone().applyAxisAngle(right, pitch);

    const moveDir = new THREE.Vector3();
    if (keys.has('KeyW')) moveDir.add(forward);
    if (keys.has('KeyS')) moveDir.sub(forward);
    if (keys.has('KeyD')) moveDir.add(right);
    if (keys.has('KeyA')) moveDir.sub(right);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    if (gravity) {
      velocity.addScaledVector(up, -GRAVITY_ACCEL * dt);
      position.addScaledVector(velocity, dt);
      position.addScaledVector(moveDir, WALK_SPEED * dt);

      const center = new THREE.Vector3(...gravity.centerOfMass);
      const dist = position.distanceTo(center);
      const floor = gravity.surfaceRadius + PLAYER_EYE_HEIGHT;
      if (dist < floor) {
        position.copy(center).addScaledVector(up, floor);
        velocity.set(0, 0, 0);
        grounded = true;
      } else {
        grounded = dist < floor + 0.08;
      }
      if (keys.has('Space') && grounded) {
        velocity.addScaledVector(up, JUMP_SPEED);
        grounded = false;
      }
    } else {
      // Open space: no momentum, direct fly-cam movement (up/down via
      // Space/Shift) -- there's no "ground" to fall toward out here.
      velocity.set(0, 0, 0);
      position.addScaledVector(moveDir, FLY_SPEED * dt);
      if (keys.has('Space')) position.addScaledVector(up, FLY_SPEED * dt);
      if (keys.has('ShiftLeft')) position.addScaledVector(up, -FLY_SPEED * dt);
      grounded = false;
    }

    camera.up.copy(up);
    camera.position.copy(position);
    camera.lookAt(position.clone().add(lookDir));
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
  }

  return {
    update,
    setEnabled,
    requestLock,
    reset,
    dispose,
    isGrounded: () => grounded,
    getPosition: () => position.clone(),
  };
}
