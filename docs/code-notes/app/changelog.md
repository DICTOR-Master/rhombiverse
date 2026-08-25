# Notes: `src/app/changelog.js`

Full design rationale/history for this file, moved out of the source
so the code itself stays lite and readable — nothing here is new, it's
the exact commentary that used to sit inline. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## Module overview

B7 (`RHOMBIVERSE_UIUX_BUILD_PLAN.md`): "Replace 'Under Construction'
branding with a versioned 'What's new' changelog panel." The branding
itself was already dropped (2026-08-19, user feedback); this is the
replacement half. Self-contained like `welcome.js` — a DOM/localStorage
concern only, independent of `render.js`/world state, own script tag.
