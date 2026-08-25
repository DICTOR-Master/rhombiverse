# Notes: `src/game-systems/achievements.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

Achievements/soft-goals (`RHOMBIVERSE_UIUX_BUILD_PLAN.md` B6). "Using
the existing bottom contextual-prompt element... (the 'toast' pattern)
rather than a new panel" — this module owns ONLY detection (pure
functions over world/planetoids state already computed elsewhere every
`onChange`); `render.js` calls `checkAchievements()` and feeds any
newly-earned ones to its own `showHudPrompt`, no new UI surface here at
all. Earned achievements persist in `localStorage` so the same toast
doesn't repeat every session.

## `ACHIEVEMENTS`

Each check receives `{world, planetoids}` — the same two pieces of
state `render.js`'s own `onChange()` already recomputes every call,
nothing new tracked. Real, cheap conditions only (no per-frame
polling).

## `checkAchievements`

Returns an array of newly-earned `{id, label}` entries (usually 0 or
1, but a single big world-load could legitimately satisfy several at
once — callers should toast them one at a time, not all in the same
instant). Marks them earned immediately so a second call never
re-reports the same one.
