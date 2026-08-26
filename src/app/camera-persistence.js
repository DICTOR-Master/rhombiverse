// Persists the orbit camera's position/look-at target across reloads, so
// the view resumes where you left off instead of resetting to the fixed
// default spawn every load. Full rationale: docs/code-notes/app/
// camera-persistence.md
const CAMERA_KEY = 'rhombiverse-camera';

export function saveCameraState(position, target) {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify({
      position: [position.x, position.y, position.z],
      target: [target.x, target.y, target.z],
    }));
  } catch (err) {
    console.warn('Rhombiverse: failed to save camera position', err);
  }
}

export function loadCameraState() {
  try {
    const raw = localStorage.getItem(CAMERA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.position) || !Array.isArray(parsed.target)) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}
