// Achievements/soft-goals (RHOMBIVERSE_UIUX_BUILD_PLAN.md B6). "Using
// the existing bottom contextual-prompt element... (the 'toast'
// pattern) rather than a new panel" -- this module owns ONLY detection
// (pure functions over world/planetoids state already computed
// elsewhere every onChange); render.js calls checkAchievements() and
// feeds any newly-earned ones to its own showHudPrompt, no new UI
// surface here at all. Earned achievements persist in localStorage so
// the same toast doesn't repeat every session.
const STORAGE_KEY = 'rhombiverse-achievements';

function loadEarned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (err) {
    return new Set();
  }
}
function saveEarned(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (err) {
    console.warn('Rhombiverse: failed to save achievements', err);
  }
}

let earned = loadEarned();

// Each check receives {world, planetoids} -- the same two pieces of
// state render.js's own onChange() already recomputes every call, nothing
// new tracked. Real, cheap conditions only (no per-frame polling).
const ACHIEVEMENTS = [
  {
    id: 'first-seed',
    label: 'Planted your first seed',
    check: ({ world }) => Object.keys(world.getSeeds()).length > 0,
  },
  {
    id: 'first-fern',
    label: 'Grew your first fern',
    check: ({ world }) => Object.values(world.getSeeds()).some((s) => s.species === 'fern'),
  },
  {
    id: 'three-shell-planetoid',
    label: 'Built a 3-shell planetoid',
    check: ({ world }) => {
      const maxShellByCenter = {};
      for (const cell of world.entries()) {
        if (!cell.shellCenter || cell.shell === undefined) continue;
        maxShellByCenter[cell.shellCenter] = Math.max(maxShellByCenter[cell.shellCenter] ?? 0, cell.shell);
      }
      return Object.values(maxShellByCenter).some((max) => max >= 3);
    },
  },
  {
    id: 'reach-black-hole',
    label: 'Reached a black hole',
    check: ({ planetoids }) => Object.values(planetoids ?? {}).some((p) => p.isBlackHole),
  },
  {
    id: 'reach-star',
    label: 'Reached a star',
    check: ({ planetoids }) => Object.values(planetoids ?? {}).some((p) => p.isStar),
  },
  {
    id: 'evolve-species',
    label: 'Evolved a species',
    check: ({ world }) => Object.values(world.getOrganisms()).some((o) => o.generation > 0),
  },
  {
    id: 'first-claim',
    label: "Claimed your first Rhombi-space",
    check: ({ world }) => Object.keys(world.getClaims()).length > 0,
  },
  {
    id: 'first-mine',
    label: 'Mined your first asteroid',
    check: ({ world }) => Object.keys(world.getRegrowthQueue()).length > 0,
  },
];

// Returns an array of newly-earned {id, label} entries (usually 0 or 1,
// but a single big world-load could legitimately satisfy several at
// once -- callers should toast them one at a time, not all in the same
// instant). Marks them earned immediately so a second call never
// re-reports the same one.
export function checkAchievements({ world, planetoids }) {
  const newlyEarned = [];
  for (const achievement of ACHIEVEMENTS) {
    if (earned.has(achievement.id)) continue;
    if (achievement.check({ world, planetoids })) {
      earned.add(achievement.id);
      newlyEarned.push(achievement);
    }
  }
  if (newlyEarned.length > 0) saveEarned(earned);
  return newlyEarned;
}
