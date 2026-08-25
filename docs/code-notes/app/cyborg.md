# Notes: `src/app/cyborg.js`

Full design rationale/history for this file, moved out of the source so
the code itself stays lite and readable — nothing here is new, it's the
exact commentary that used to sit inline. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## File overview

Cyborg Mode (`RHOMBIVERSE_UIUX_BUILD_PLAN.md` B3): guided onboarding
that narrates a "subscript" JSON (`data/cyborg/*.json`) — an ordered
list of steps, each with a plain-language instruction, a named
`successCondition` event to wait for, and a hint shown only after
`hintAfterSeconds` elapses without success. Every real game event this
listens for (`rhombiverse:cameraRotated`/`faceHovered`/`cellPlaced`) is
dispatched from `render.js`/`build.js`'s own existing hooks — this
module only listens and narrates, it NEVER calls `world.addCell`/
`removeCell` or touches localStorage, satisfying B3's own "toggleable
off at any time with zero persistent state change to the world."

## `.cyborg-highlighted` (CSS)

Highlights `render.js`'s `#app` (the `"#viewport"` the spec's own
example subscript names — this codebase's real 3D-viewport container
has a different real id, so the shipped subscript targets that one
directly rather than a placeholder selector that doesn't exist).

## `createCyborgMode`'s `getSuggestion` param

"Really wanted cyborg modes to be able to do more than just suggest
clicking on a face" — an optional `async () => string`, reusing the
same three-tier AI pattern Full-Cyborg sculpting/cultivating already
use (see `render.js`'s `getCyborgSuggestion`). Still narration-only:
this never touches world state itself, same as everything else here —
it just gives the player a genuinely creative idea to go build
themselves, once the walkthrough's own fixed steps are done.

## `handleSuccess`

"If a player performs an action out of the expected order... recognize
the corresponding step's success condition whenever it fires rather
than strictly enforcing sequence" — every step's own `successCondition`
is listened for the whole time Cyborg Mode is on, not just the current
step's. A step completed early is simply skipped once
`advanceToNextIncomplete` reaches it.
