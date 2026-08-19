// Sculpture tool module (RHOMBIVERSE_UIUX_BUILD_PLAN.md B4) -- shared,
// built once, used identically by B4a (in-world "Create" wheel category)
// and B4b (standalone Sculpture Mode). Pure logic only: no DOM, no THREE
// scene access -- callers (render.js) own presentation, this owns the
// Assistance Spectrum data model, symmetry mirroring, the shell-radius
// brush, and Full-Cyborg's natural-language intent parsing/execution.
import { cellKey, cellsInShells, isValidCell } from './lattice.js';
import { claimIdAt, isClaimProtected } from './regions.js';
import { requestBYOKJson } from './byok.js';

// --- Symmetry mirroring -----------------------------------------------
// "Reuse the lattice's existing order-48 cubic symmetry group" (B4's own
// wording) -- no such group actually existed anywhere in this codebase
// before this file (confirmed by search; the plan's own "already in your
// repository" framing was wrong for this one specific reference, unlike
// its regions/claims counterpart, which is real). Built here instead:
// the full octahedral symmetry group Oh has exactly 48 elements -- every
// combination of a signed permutation of (x,y,z) (3! permutations x 2^3
// sign choices = 48). Every element trivially preserves the FCC parity
// rule (isValidCell: x+y+z even), since negating or reordering integers
// never changes the parity of their sum.
const PERMS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];
const SIGNS = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];
export const FULL_SYMMETRY_GROUP = PERMS.flatMap(([pa, pb, pc]) =>
  SIGNS.map(([sa, sb, sc]) => (x, y, z) => {
    const v = [x, y, z];
    return [v[pa] * sa, v[pb] * sb, v[pc] * sc];
  })
);

// The Manual-tier "pick a mirror plane" control exposes six real,
// nameable elements of that same 48-element group (the axis-aligned and
// diagonal reflections) rather than all 48 as a flat button list -- a
// UI-legibility choice, not a reduction of the underlying group, which
// stays fully available via FULL_SYMMETRY_GROUP above for anything else
// (e.g. Full-Cyborg's own "mirror this wing" phrasing) that wants it.
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
// "Reuse the existing shellCount(n) = 10n^2+2 formula... one click
// adds/removes an entire shell-cluster." cellsInShells (lattice.js) is
// that exact existing formula's own candidate generator -- reused
// directly, not reimplemented. Returns the list of cells actually
// touched (so a caller can also mirror them) rather than mutating
// silently; center itself is included for radius >= 0 add actions.
export function shellBrushCells(cx, cy, cz, radius) {
  const cells = [{ x: cx, y: cy, z: cz, shell: 0 }];
  if (radius > 0) cells.push(...cellsInShells(cx, cy, cz, radius));
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

// Applies a single-cell add/remove, then its mirrored counterpart too
// (if a plane is chosen and the mirror lands somewhere different from
// the original -- a cell exactly ON the mirror plane maps to itself,
// correctly a no-op second write). Returns every real cell touched.
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

// Combined brush+mirror stroke -- what the actual Manual-tier click
// handler calls: every cell the shell-radius brush would touch, each
// ALSO mirrored if a plane is chosen. radius 0 degenerates to exactly
// applySymmetricCell's own single-cell(+mirror) behavior.
export function sculptStroke(world, action, cx, cy, cz, radius, material, mirrorPlaneId, canPlaceMaterial = () => true) {
  const touched = [];
  for (const c of shellBrushCells(cx, cy, cz, radius)) {
    touched.push(...applySymmetricCell(world, action, c.x, c.y, c.z, material, mirrorPlaneId, canPlaceMaterial));
  }
  return touched;
}

// --- Assistance Spectrum session state ---------------------------------
// Exact shape from RHOMBIVERSE_UIUX_BUILD_PLAN.md B4's own schema.
export function createSculptureSession(playerId, assistanceTier = 'manual') {
  return {
    playerId,
    assistanceTier, // 'manual' | 'semi-cyborg' | 'full-cyborg'
    pendingSuggestion: null, // only ever populated in semi-cyborg tier; never auto-applied
    recentManualCells: [], // small ring buffer this module uses for its own suggestion heuristic -- not part of the persisted schema shape itself
  };
}

const RECENT_CELLS_TRACKED = 6;

// Semi-Cyborg: "the agent observes the player's recent manual edits and
// proposes a plausible next edit... surfaced as preview cells." The
// spec's own example reason ("completing symmetric dome edge") is a
// literal symmetry-completion heuristic, not an LLM call -- implemented
// exactly that way: after a manual edit, if a mirror plane is active and
// that edit's own mirror counterpart doesn't exist yet, propose adding
// it. Call this after every manual world mutation while assistanceTier
// is 'semi-cyborg'; no-ops (clears pendingSuggestion) if there's nothing
// to propose.
export function updateSemiCyborgSuggestion(session, world, lastCell, mirrorPlaneId) {
  session.pendingSuggestion = null;
  if (session.assistanceTier !== 'semi-cyborg' || !lastCell || !mirrorPlaneId) return null;
  session.recentManualCells.push(lastCell);
  if (session.recentManualCells.length > RECENT_CELLS_TRACKED) session.recentManualCells.shift();

  const [mx, my, mz] = mirrorCell(mirrorPlaneId, lastCell.x, lastCell.y, lastCell.z);
  if (mx === lastCell.x && my === lastCell.y && mz === lastCell.z) return null; // on the plane, nothing to complete
  const mirrorExists = world.has(mx, my, mz);
  const wasAdd = lastCell.action !== 'remove';
  // A missing mirror of a just-ADDED cell is a real gap to fill; a
  // still-present mirror of a just-REMOVED cell is a real "you cleared
  // one side, the other side is now asymmetric" gap in the other
  // direction. Both read as the same "complete the symmetric feature"
  // suggestion, just add vs. remove.
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
// Two paths, same output shape ({cells, action, description}):
//
// 1. requestFullCyborgIntent (preferred): POSTs the player's raw text to
//    /api/sculpt-intent, a real Vercel serverless function (see that
//    file) that calls an LLM via Vercel's AI Gateway -- genuine natural-
//    language UNDERSTANDING, not keyword matching. The model's only job
//    is producing a small structured decision (shape/action/radius/
//    mirror); turning that into actual FCC-lattice cell coordinates
//    stays 100% deterministic client-side math (intentToCells below),
//    reused by both paths -- the model never invents coordinates itself.
// 2. parseFullCyborgIntent (fallback): a bounded keyword parser, used
//    when the API call fails for any reason (AI Gateway not yet enabled
//    on the Vercel project, network issue, rate limit) -- so this
//    feature still genuinely works even before/without that one-time
//    dashboard setup step, rather than hard-failing.
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
  return 3; // a reasonable, disclosed default when no size word is present
}
function detectAction(text) {
  if (/\b(clear|remove|erase|dig out|hollow)\b/.test(text)) return 'remove';
  return 'add';
}

// Shared geometry step for both the local parser and the AI-Gateway path
// below -- shape/action/radius/mirror -> real cell coordinates. origin:
// {x,y,z}, the player's current build-cursor cell.
function intentToCells(shape, action, radius, origin, useMirror, mirrorPlaneId) {
  if (!shape || shape === 'none') return [];
  let cells;
  if (shape === 'wall') {
    // A straight run of cells along the lattice's own X neighbor
    // direction, `radius` cells long each way from origin -- reuses
    // NEIGHBOR-adjacent stepping via cellsInShells's own shell-1
    // members filtered to one direction would overcomplicate a simple
    // line; a direct arithmetic walk is clearer and still real lattice
    // math (every step preserves the parity rule since +2 on one axis
    // does).
    cells = [];
    for (let i = -radius; i <= radius; i++) {
      const cx = origin.x + i * 2;
      if (isValidCell(cx, origin.y, origin.z)) cells.push({ x: cx, y: origin.y, z: origin.z });
    }
  } else {
    // dome/sphere/mirror-wing all resolve to a shell-radius cluster --
    // "dome" reads as the upper half (y >= origin.y), matching the
    // word's own real-world shape; "sphere"/"mirror-wing" use the full
    // cluster (a "wing" is just whatever's on one side once mirrored).
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

// origin: {x,y,z} -- where the edit is centered (render.js passes the
// player's current build-cursor cell).
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

// The AI-Gateway-backed path (see /api/sculpt-intent.js): sends the raw
// text to the server, gets back a small structured decision, and turns
// it into cells with the exact same intentToCells math the local parser
// uses. Falls back to parseFullCyborgIntent on any failure -- a real
// resilience path, not a formality: this makes the feature work even
// before AI Gateway is enabled on the Vercel project dashboard (a one-
// time manual step only the project owner can do).
const SCULPT_SYSTEM_PROMPT = `You translate a player's plain-language building request in a voxel-building game (Rhombiverse) into a small structured plan.

The game has exactly two basic sculpting modes: "Model" (adds material -- action "add") and "Chisel" (removes/carves away material -- action "remove"). Pick whichever the player's words imply; default to "add" if unclear.

Shapes you can produce: "dome" (a mound/hemisphere), "sphere" (a full round cluster), "wall" (a straight line/ridge), "mirror-wing" (build one side, meant to be mirrored), or "none" if the request doesn't describe a buildable shape at all.

Respond with a JSON object with exactly these fields: shape (one of the above), action ("add" or "remove"), radius (integer 1-8, default 3 if unclear), useMirror (boolean, true if the player mentions symmetry/mirroring/"the other side"), description (a short friendly confirmation, <140 chars, using "Model" or "Chisel").`;

// Three-tier fallback, in order: (1) the player's own AI key (byok.js --
// their key, their browser, their choice), (2) this site's shared AI
// Gateway (/api/sculpt-intent), (3) the local keyword parser. Each tier
// only runs if the one before it is unavailable or fails -- the feature
// works at every tier, just with more real language understanding the
// higher up the chain it succeeds.
export async function requestFullCyborgIntent(text, origin, mirrorPlaneId) {
  try {
    const decision = await requestBYOKJson(SCULPT_SYSTEM_PROMPT, `Player said: "${text}"`);
    if (decision) return decisionToIntent(decision, origin, mirrorPlaneId, true);
  } catch (err) {
    console.warn('Rhombiverse: personal AI key call failed, trying the shared AI Gateway instead', err);
  }
  try {
    const res = await fetch('/api/sculpt-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
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

// Scoping rule shared by B4a's Full-Cyborg tier: "restricted to the
// player's own claimed region... or destructible-flagged space." Local-
// only play (no Shared World, no real claims registry) has nothing to
// restrict against, so this is permissive there by construction --
// claimIdAt returns null for any coordinate with no claims at all.
export function canFullCyborgEditAt(claims, playerId, x, y, z) {
  const id = claimIdAt(claims, x, y, z);
  if (!id) return true; // unclaimed space
  if (claims[id].ownerId === playerId) return true; // the requesting player's own claim
  return !isClaimProtected(claims, x, y, z); // someone else's claim, but explicitly opted destructible
}

// Applies a parsed intent, skipping any cell the scoping check rejects.
// Every resulting world.addCell/removeCell call is IDENTICAL to a normal
// manual placement -- this project's own authorId stamping happens
// server-side (sync.js, from the authenticated session), never supplied
// by the client -- so edits made here are attributed to whichever player
// is actually signed in and pushing them, never to "the agent," by
// construction, not by a special case this function has to implement.
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
