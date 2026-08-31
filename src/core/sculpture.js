// Sculpture tool module (RHOMBIVERSE_UIUX_BUILD_PLAN.md B4) -- shared,
// built once, used identically by B4a (in-world "Create" wheel category)
// and B4b (standalone Sculpture Mode). Pure logic only: no DOM, no THREE
// scene access. Full design rationale/history for every export below:
// docs/code-notes/core/sculpture.md
import { cellKey, cellsInShells, isValidCell } from './lattice.js';
import { DUAL_DIRS } from './dual.js';
import { requestBYOKJson } from '../app/byok.js';

// render.js supplies the real claimIdAt/isClaimProtected via
// setRegionsIntegration(), gated behind FEATURES.economy. Inert
// defaults otherwise (no claims exist).
let claimIdAt = () => null;
let isClaimProtected = () => false;
export function setRegionsIntegration({ claimIdAt: claimIdAtFn, isClaimProtected: isClaimProtectedFn }) {
  claimIdAt = claimIdAtFn;
  isClaimProtected = isClaimProtectedFn;
}

// --- Symmetry mirroring -----------------------------------------------
const PERMS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];
const SIGNS = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];
// Order-48 cubic symmetry group Oh (every signed permutation of x,y,z).
export const FULL_SYMMETRY_GROUP = PERMS.flatMap(([pa, pb, pc]) =>
  SIGNS.map(([sa, sb, sc]) => (x, y, z) => {
    const v = [x, y, z];
    return [v[pa] * sa, v[pb] * sb, v[pc] * sc];
  })
);

// Six named, UI-legible elements of FULL_SYMMETRY_GROUP.
export const MIRROR_PLANES = {
  x: { label: 'Mirror X', fn: (x, y, z) => [-x, y, z] },
  y: { label: 'Mirror Y', fn: (x, y, z) => [x, -y, z] },
  z: { label: 'Mirror Z', fn: (x, y, z) => [x, y, -z] },
  xy: { label: 'Mirror X↔Y', fn: (x, y, z) => [y, x, z] },
  xz: { label: 'Mirror X↔Z', fn: (x, y, z) => [z, y, x] },
  yz: { label: 'Mirror Y↔Z', fn: (x, y, z) => [x, z, y] },
};

export function mirrorCell(planeId, x, y, z) {
  const plane = MIRROR_PLANES[planeId];
  return plane ? plane.fn(x, y, z) : null;
}

// --- Shell-radius brush --------------------------------------------
export function shellBrushCells(cx, cy, cz, radius, offsets) {
  const cells = [{ x: cx, y: cy, z: cz, shell: 0 }];
  if (radius > 0) {
    cells.push(...(offsets ? cellsInShells(cx, cy, cz, radius, 1, offsets) : cellsInShells(cx, cy, cz, radius)));
  }
  return cells;
}

export function applyShellBrush(world, cx, cy, cz, radius, action, material, canPlaceMaterial = () => true) {
  const touched = [];
  for (const c of shellBrushCells(cx, cy, cz, radius)) {
    if (!isValidCell(c.x, c.y, c.z)) continue;
    if (action === 'add') {
      if (world.has(c.x, c.y, c.z) || !canPlaceMaterial(material, c.x, c.y, c.z)) continue;
      world.addCell(c.x, c.y, c.z, { material });
      touched.push({ x: c.x, y: c.y, z: c.z });
    } else {
      if (!world.has(c.x, c.y, c.z)) continue;
      world.removeCell(c.x, c.y, c.z);
      touched.push({ x: c.x, y: c.y, z: c.z });
    }
  }
  return touched;
}

export function applySymmetricCell(world, action, x, y, z, material, mirrorPlaneId, canPlaceMaterial = () => true) {
  const touched = [];
  const apply = (cx, cy, cz) => {
    if (!isValidCell(cx, cy, cz)) return;
    if (action === 'add') {
      if (world.has(cx, cy, cz) || !canPlaceMaterial(material, cx, cy, cz)) return;
      world.addCell(cx, cy, cz, { material });
    } else {
      if (!world.has(cx, cy, cz)) return;
      world.removeCell(cx, cy, cz);
    }
    touched.push({ x: cx, y: cy, z: cz });
  };
  apply(x, y, z);
  if (mirrorPlaneId) {
    const [mx, my, mz] = mirrorCell(mirrorPlaneId, x, y, z);
    if (mx !== x || my !== y || mz !== z) apply(mx, my, mz);
  }
  return touched;
}

export function sculptStroke(world, action, cx, cy, cz, radius, material, mirrorPlaneId, canPlaceMaterial = () => true, shellOffsets) {
  const touched = [];
  for (const c of shellBrushCells(cx, cy, cz, radius, shellOffsets)) {
    touched.push(...applySymmetricCell(world, action, c.x, c.y, c.z, material, mirrorPlaneId, canPlaceMaterial));
  }
  return touched;
}

// --- Dual symmetry presets (Cube/Octa) ---------------------------------
export function applyDualSymmetry(world, action, x, y, z, material, dirs, canPlaceMaterial = () => true) {
  const touched = [];
  const apply = (cx, cy, cz) => {
    if (!isValidCell(cx, cy, cz)) return;
    if (action === 'add') {
      if (world.has(cx, cy, cz) || !canPlaceMaterial(material, cx, cy, cz)) return;
      world.addCell(cx, cy, cz, { material });
    } else {
      if (!world.has(cx, cy, cz)) return;
      world.removeCell(cx, cy, cz);
    }
    touched.push({ x: cx, y: cy, z: cz });
  };
  apply(x, y, z);
  for (const [dx, dy, dz] of dirs) {
    apply(x + dx, y + dy, z + dz);
  }
  return touched;
}

export function applyFullSymmetry(world, action, x, y, z, material, canPlaceMaterial = () => true) {
  const touched = [];
  const seen = new Set();
  for (const transform of FULL_SYMMETRY_GROUP) {
    const [cx, cy, cz] = transform(x, y, z);
    const key = cellKey(cx, cy, cz);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isValidCell(cx, cy, cz)) continue;
    if (action === 'add') {
      if (world.has(cx, cy, cz) || !canPlaceMaterial(material, cx, cy, cz)) continue;
      world.addCell(cx, cy, cz, { material });
    } else {
      if (!world.has(cx, cy, cz)) continue;
      world.removeCell(cx, cy, cz);
    }
    touched.push({ x: cx, y: cy, z: cz });
  }
  return touched;
}

// --- Assistance Spectrum session state ---------------------------------
export function createSculptureSession(playerId, assistanceTier = 'manual') {
  return {
    playerId,
    assistanceTier, // 'manual' | 'semi-cyborg' | 'full-cyborg'
    pendingSuggestion: null, // only ever populated in semi-cyborg tier; never auto-applied
    recentManualCells: [], // small ring buffer, not part of the persisted schema shape
  };
}

const RECENT_CELLS_TRACKED = 6;

function findDualAnchor(world, lastCell, dualFocus) {
  const tryDirs = (dirs, which) => {
    for (const [dx, dy, dz] of dirs) {
      const ax = lastCell.x - dx, ay = lastCell.y - dy, az = lastCell.z - dz;
      if (world.has(ax, ay, az)) return { anchor: { x: ax, y: ay, z: az }, which, dirs };
    }
    return null;
  };
  if (dualFocus === 'cube' || dualFocus === 'both') {
    const hit = tryDirs(DUAL_DIRS.cube, 'cube');
    if (hit) return hit;
  }
  if (dualFocus === 'octa' || dualFocus === 'both') {
    const hit = tryDirs(DUAL_DIRS.octa, 'octa');
    if (hit) return hit;
  }
  return null;
}

export function updateSemiCyborgSuggestion(session, world, lastCell, mirrorPlaneId, dualFocus) {
  session.pendingSuggestion = null;
  if (session.assistanceTier !== 'semi-cyborg' || !lastCell) return null;
  session.recentManualCells.push(lastCell);
  if (session.recentManualCells.length > RECENT_CELLS_TRACKED) session.recentManualCells.shift();
  const wasAdd = lastCell.action !== 'remove';

  if (mirrorPlaneId) {
    const [mx, my, mz] = mirrorCell(mirrorPlaneId, lastCell.x, lastCell.y, lastCell.z);
    if (mx !== lastCell.x || my !== lastCell.y || mz !== lastCell.z) { // on the plane, nothing to complete
      const mirrorExists = world.has(mx, my, mz);
      if (wasAdd && !mirrorExists) {
        session.pendingSuggestion = {
          cells: [cellKey(mx, my, mz)],
          action: 'add',
          reason: 'completing symmetric mirror edge',
          material: lastCell.material,
        };
      } else if (!wasAdd && mirrorExists) {
        session.pendingSuggestion = {
          cells: [cellKey(mx, my, mz)],
          action: 'remove',
          reason: 'clearing the now-asymmetric mirror cell',
        };
      }
    }
  }

  if (!session.pendingSuggestion && wasAdd && dualFocus && dualFocus !== 'none') {
    const hit = findDualAnchor(world, lastCell, dualFocus);
    if (hit) {
      const missing = hit.dirs
        .map(([dx, dy, dz]) => [hit.anchor.x + dx, hit.anchor.y + dy, hit.anchor.z + dz])
        .filter(([x, y, z]) => isValidCell(x, y, z) && !world.has(x, y, z))
        .map(([x, y, z]) => cellKey(x, y, z));
      if (missing.length > 0) {
        session.pendingSuggestion = {
          cells: missing,
          action: 'add',
          reason: `mirroring across the inscribed ${hit.which === 'cube' ? 'cube' : 'octahedron'}`,
          material: lastCell.material,
        };
      }
    }
  }
  return session.pendingSuggestion;
}

export function acceptSuggestion(session, world, canPlaceMaterial = () => true) {
  const suggestion = session.pendingSuggestion;
  if (!suggestion) return [];
  const touched = [];
  for (const key of suggestion.cells) {
    const [x, y, z] = key.split(',').map(Number);
    if (suggestion.action === 'add') {
      if (!world.has(x, y, z) && canPlaceMaterial(suggestion.material, x, y, z)) {
        world.addCell(x, y, z, { material: suggestion.material });
        touched.push({ x, y, z });
      }
    } else if (world.has(x, y, z)) {
      world.removeCell(x, y, z);
      touched.push({ x, y, z });
    }
  }
  session.pendingSuggestion = null;
  return touched;
}

export function dismissSuggestion(session) {
  session.pendingSuggestion = null;
}

// --- Full-Cyborg: natural-language intent -> concrete cell edits -------
// Full design rationale/history: docs/code-notes/core/sculpture.md
const SHAPE_WORDS = {
  dome: 'dome', hemisphere: 'dome', mound: 'dome',
  sphere: 'sphere', ball: 'sphere', orb: 'sphere',
  wall: 'wall', line: 'wall', ridge: 'wall',
  wing: 'mirror-wing',
};
const SIZE_WORDS = { small: 2, tiny: 1, medium: 4, large: 6, big: 6, huge: 8 };

function detectShape(text) {
  for (const [word, shape] of Object.entries(SHAPE_WORDS)) {
    if (text.includes(word)) return shape;
  }
  return null;
}
function detectSize(text) {
  for (const [word, radius] of Object.entries(SIZE_WORDS)) {
    if (text.includes(word)) return radius;
  }
  return 3;
}
function detectAction(text) {
  if (/\b(clear|remove|erase|dig out|hollow)\b/.test(text)) return 'remove';
  return 'add';
}

function intentToCells(shape, action, radius, origin, useMirror, mirrorPlaneId) {
  if (!shape || shape === 'none') return [];
  let cells;
  if (shape === 'wall') {
    cells = [];
    for (let i = -radius; i <= radius; i++) {
      const cx = origin.x + i * 2;
      if (isValidCell(cx, origin.y, origin.z)) cells.push({ x: cx, y: origin.y, z: origin.z });
    }
  } else {
    const cluster = shellBrushCells(origin.x, origin.y, origin.z, radius);
    cells = shape === 'dome' ? cluster.filter((c) => c.y >= origin.y) : cluster;
  }

  if (useMirror && mirrorPlaneId) {
    const mirrored = cells.map((c) => {
      const [mx, my, mz] = mirrorCell(mirrorPlaneId, c.x, c.y, c.z);
      return { x: mx, y: my, z: mz };
    });
    cells = [...cells, ...mirrored];
  }
  return cells;
}

function describe(action, shape, cellCount) {
  const verb = action === 'remove' ? 'Chiseling away' : 'Modeling';
  return `${verb} a ${shape ?? 'mirrored'} shape (~${cellCount} cells).`;
}

export function parseFullCyborgIntent(text, origin, mirrorPlaneId) {
  const lower = text.toLowerCase();
  const shape = detectShape(lower);
  const action = detectAction(lower);
  const radius = detectSize(lower);
  const useMirror = /\bmirror\b/.test(lower) || shape === 'mirror-wing';

  if (!shape && !useMirror) {
    return {
      cells: [],
      action,
      description: `Didn't recognize a shape in "${text}" -- try a word like dome, sphere, wall, or "mirror".`,
      unrecognized: true,
    };
  }

  const cells = intentToCells(shape, action, radius, origin, useMirror, mirrorPlaneId);
  return { cells, action, description: describe(action, shape, cells.length), unrecognized: false };
}

const SCULPT_SYSTEM_PROMPT = `You translate someone's plain-language building request in a spatial editor (Rhombiverse) into a small structured plan.

Rhombiverse has exactly two basic sculpting modes: "Model" (adds material -- action "add") and "Chisel" (removes/carves away material -- action "remove"). Pick whichever their words imply; default to "add" if unclear.

Shapes you can produce: "dome" (a mound/hemisphere), "sphere" (a full round cluster), "wall" (a straight line/ridge), "mirror-wing" (build one side, meant to be mirrored), or "none" if the request doesn't describe a buildable shape at all.

Respond with a JSON object with exactly these fields: shape (one of the above), action ("add" or "remove"), radius (integer 1-8, default 3 if unclear), useMirror (boolean, true if they mention symmetry/mirroring/"the other side"), description (a short friendly confirmation, <140 chars, using "Model" or "Chisel").`;

export async function requestFullCyborgIntent(text, origin, mirrorPlaneId, dualFocus) {
  const dualContext = dualFocus !== undefined ? `\n\ndualFocus: ${dualFocus}` : '';
  try {
    const decision = await requestBYOKJson(SCULPT_SYSTEM_PROMPT, `Player said: "${text}"${dualContext}`);
    if (decision) return decisionToIntent(decision, origin, mirrorPlaneId, true);
  } catch (err) {
    console.warn('Rhombiverse: personal AI key call failed, trying the shared AI Gateway instead', err);
  }
  try {
    const body = { text };
    if (dualFocus !== undefined) body.dualFocus = dualFocus;
    const res = await fetch('/api/sculpt-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sculpt-intent API returned ${res.status}`);
    const decision = await res.json();
    return decisionToIntent(decision, origin, mirrorPlaneId, true);
  } catch (err) {
    console.warn('Rhombiverse: Full-Cyborg AI Gateway call failed, using local parser instead', err);
    return parseFullCyborgIntent(text, origin, mirrorPlaneId);
  }
}

function decisionToIntent(decision, origin, mirrorPlaneId, viaAI) {
  if (decision.shape === 'none') {
    return { cells: [], action: decision.action, description: decision.description, unrecognized: true };
  }
  const cells = intentToCells(decision.shape, decision.action, decision.radius, origin, decision.useMirror, mirrorPlaneId);
  return { cells, action: decision.action, description: decision.description, unrecognized: false, viaAI };
}

export function canFullCyborgEditAt(claims, playerId, x, y, z) {
  const id = claimIdAt(claims, x, y, z);
  if (!id) return true; // unclaimed space
  if (claims[id].ownerId === playerId) return true; // the requesting player's own claim
  return !isClaimProtected(claims, x, y, z); // someone else's claim, but explicitly opted destructible
}

export function executeFullCyborgIntent(world, intent, claims, playerId, material, canPlaceMaterial = () => true) {
  const applied = [];
  const skipped = [];
  for (const c of intent.cells) {
    if (!isValidCell(c.x, c.y, c.z)) continue;
    if (!canFullCyborgEditAt(claims, playerId, c.x, c.y, c.z)) {
      skipped.push(c);
      continue;
    }
    if (intent.action === 'remove') {
      if (world.has(c.x, c.y, c.z)) {
        world.removeCell(c.x, c.y, c.z);
        applied.push(c);
      }
    } else if (!world.has(c.x, c.y, c.z) && canPlaceMaterial(material, c.x, c.y, c.z)) {
      world.addCell(c.x, c.y, c.z, { material });
      applied.push(c);
    }
  }
  return { applied, skipped };
}
