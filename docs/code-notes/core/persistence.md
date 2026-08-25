# Notes: `src/core/persistence.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header

World-state persistence backend. `localStorage` for now (Phase 3),
swappable for a realtime store later (Phase 5) without a schema
change — both would just implement the same save/load shape.

## `saveToLocalStorage`

Wrapped in try/catch: a quota-exceeded or private-browsing
`localStorage` failure should not break building — it's a real,
recoverable possibility, not a hypothetical worth ignoring, since
`MAX_CELLS=20000` shell-fills can produce a JSON blob large enough to
matter.

## `exportWorldFile`

Triggers a browser download of the given world JSON as a `.json`
file — the portable, manually-shareable form the plan's Phase 3 calls
for.

## `importWorldFile`

Reads a File (from an `<input type="file">` change event) and resolves
to its parsed JSON. Rejects if it isn't valid JSON — callers should
handle that as a user-facing "invalid file" case, not a crash.
