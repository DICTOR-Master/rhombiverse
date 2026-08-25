# Notes: `src/app/worldshare.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## `compressionSupported`

World sharing via a compressed URL (`RHOMBIVERSE_UIUX_BUILD_PLAN.md`
B6). Uses the browser's native `CompressionStream`/`DecompressionStream`
(gzip) — no external compression library needed, keeping the
no-build-step frontend untouched, same "reuse the platform" instinct as
`byok.js`'s plain-fetch choice. Widely supported in evergreen browsers;
feature-detected here rather than assumed.

## `shareableSlice`

Only the real world data a fresh session needs to reconstruct the build
— deliberately excludes bulky/regenerable-on-load fields
(`asteroidRegrowth` timers, `playerInventory`, `pendingTrades`) to keep
the URL as short as possible; a shared link is meant for "here's what I
built," not a full account-state transfer.

## `clearSharedWorldParam`

Removes the `?w=` param from the visible URL after a shared world has
been loaded, so refreshing the page resumes the player's OWN save
(already copied into localStorage by then) instead of re-importing the
shared link's snapshot every time.
