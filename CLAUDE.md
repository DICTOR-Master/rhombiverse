# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in
this repository. Written for a future Claude Code session with no memory of
the conversation that scaffolded this repo, so it can pick up cold.

## What this project is

Rhombiverse is a browser-based, Three.js voxel-style world-builder where the
"voxel" is a **rhombic dodecahedron (RD)**, packed via the real FCC lattice.
Players build outward face-by-face from a seed cell; the world is stored as
plain JSON, not baked geometry, so any renderer/client/future backend can
read and write it. See `RHOMBIVERSE_PLAN.md` section 0 (Meta-Paradigm) and
section 6 (Vision Statement) before touching anything else in this repo —
they're short and everything downstream assumes you've read them.

**This is a different project from `~/rhombispheres/`** (formerly named
`rhombiverse` until 2026-08-11, when it was renamed to free up this name).
`~/rhombispheres/` is an unrelated Python/pygame arcade game (DICTOROIDS-
family hemisphere-capture levels). Same brand word, nothing else shared —
don't cross-reference code or specs between the two repos.

**GitHub**: private repo at https://github.com/DICTOR-Master/rhombiverse
(account `DICTOR-Master`, `gh` already authenticated).

## Current status (as of 2026-08-19)

Everything through Lattice Zoom (2026-08-14) plus the entire UI/UX
overhaul tracks B1–B6 (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`) is done. In
build order:

- **B1–B6** (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`) — DONE. Replaced the
  always-visible sidebar with the **Rhombic Wheel** radial menu
  (`src/app/wheel.js`) as the single control surface; added **Sculpture
  Mode** (`src/core/sculpture.js`, order-48 cubic symmetry group, Model/
  Chisel, an Assistance Spectrum up to AI-assisted Full-Cyborg), **Cyborg
  Mode** guided walkthroughs (`src/app/cyborg.js`, supports multiple
  concurrent instances — the manual toggle and the auto-started
  onboarding sequence are two separate instances), **Duality Mode**
  (reuses `growth.js`'s real Ammann-rhombohedra tile geometry, not
  separate projection math) and **Cultivation Mode**
  (`src/geometry-extensions/cultivation.js`), **bring-your-own-AI-key** support
  (`src/app/byok.js` — direct browser calls to Anthropic/OpenAI/etc., with a
  shared Vercel AI Gateway fallback in `api/` and a local keyword-parser
  last resort), an **achievements** toast system (`src/world-systems/achievements.js`),
  **World sharing** via compressed URLs (`src/app/worldshare.js`) and a
  public **Gallery** (`shared_worlds` table, `src/app/sync.js`), a sequenced
  first-visit **onboarding** walkthrough that loads the real Showcase
  World and ends with a clickable persona picker on the welcome screen,
  and a rebuilt **in-world trade UI** — walk near another player (visible
  as a live named avatar via Supabase Realtime **Presence**, a
  lightweight pseudonymous display name, no accounts) and use **Interact**
  to open a two-sided drag-and-tap offer view, replacing the old
  permanent Lab-panel trade form. All "Under Construction" branding was
  deliberately removed (2026-08-19, user feedback: it undermined trust).
- **B7 partially started** (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`) — the
  rest is the biggest remaining track (Lab view audit, accessibility
  pass, performance guardrails, OG screenshot, moderation/compliance
  scaffolding are all still open). Shipped so far: the versioned
  "What's New" changelog panel (`src/app/changelog.js`,
  `data/changelog.json`, real dated entries) replacing the branding
  that was removed above; and real touch controls for Walk/Explore mode
  (`player.js`'s `setVirtualMove`/`setVirtualKey`/`lookBy`, an on-screen
  joystick/jump button/drag-to-look zone in `render.js`) — Walk mode was
  previously completely unusable on touch (keyboard-only movement,
  Pointer-Lock-only look), and a prior session had worked around that
  by hiding its toggle on touch devices entirely; that hiding is now
  removed since there's something real to show. Also shipped, off-plan
  but explicitly requested: Cyborg Mode can now suggest a genuinely
  creative next build (`api/cyborg-suggest.js`, same three-tier AI
  pattern as Full-Cyborg) once its walkthrough finishes — Cyborg Mode
  itself stays narration-only, exactly what B3 defined it as.
- **Known, real, pre-existing gap found while building Walk-mode touch
  controls (not caused by that work, not yet fixed):** `render.js`
  passes `getMode: () => (walking ? null : currentMode)` into
  `build.js`'s `createBuildController`, and `onContextMenu`'s first
  line is `if (!getMode()) return;` — so right-click mining is
  currently a silent no-op while walking, on desktop too, contradicting
  the belt-approach hint text's own "right-click an asteroid cell to
  harvest it" promise. Needs a decision: should Walk mode's `getMode()`
  distinguish "can freely build/edit" (no) from "can still mine" (should
  probably be yes)?
- **A real CI regression chase, 2026-08-19** (see `tests/browser/
  smoke.mjs` and `.github/workflows/ci.yml`): the smoke test started
  failing/hanging from B6's first commit onward, for two distinct
  reasons, not one. (1) Cold JS parse/eval time genuinely grew past the
  old fixed 10s `waitForSelector` timeouts as the module graph grew
  across B1-B6 — recalibrated to 25s, a real test-maintenance fix, not
  a bug (bundling the module graph together was never the right fix
  for a test timeout — see `scripts/build.mjs`, added 2026-08-24, for
  the real production perf fix this project actually took: minify each
  file in place, no bundling, dev untouched). (2)
  `page.click('.wheel-item:has-text(...)')` reproducibly hung on one
  specific interaction, both locally and on GitHub's runners, even
  though a live diagnostic proved the DOM state was completely correct
  and stable every time (a MutationObserver over 2s of idle showed zero
  mutations, `elementFromPoint` confirmed no occluding element, a raw
  `querySelectorAll` via `evaluate()` found the target instantly) — a
  genuine Playwright/CDP-level polling failure, not an app bug. Fixed
  by dispatching `.click()` directly via `evaluate()` for wheel-item
  clicks instead of Playwright's own `page.click()`. Also bumped
  `actions/checkout`/`actions/setup-node` v4→v7 (clears a real Node-20-
  deprecated platform warning) while deliberately keeping
  `node-version: 20` for the jobs themselves — bumping that to 24 broke
  `node --test tests/unit/` outright (a real Node 22+ regression
  resolving a bare directory argument, reproduced locally too) and was
  reverted.

- **Rhombis** (2026-09-03, `docs/RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md`)
  — **Stages 1-6 done** (one piece; octahedron/2 pieces; cube/6 pieces;
  rhombic dodecahedron/12 pieces; conjoined pieces; multi-cell): a standalone
  geometric-packing intro puzzle, `rhombis.html` + `src/
  rhombis/`. `geometry.js`'s `pyramidGeometry()` is the one mesh every
  stage reuses (`ConvexGeometry` over `core/lattice.js`'s already-real,
  already-tested `pyramidPieces(s).pyramids['y+']`, re-centered to the
  spec's own canonical pose -- base square at y=0, apex at (0,s/2,0));
  `outwardQuaternion(axisKey)`/`inwardQuaternion(axisKey)` are the
  general axis-keyed orientation system (reuses `core/pyramid.js`'s own
  `x+`/`x-`/.../`z-` vocabulary) every stage composes that mesh with --
  Stage 2's up/down flip and Stage 3's 6 cube faces are both just this
  plus a transform, no second geometry derivation. `puzzle-state.js` is
  the pure state machine (unit tested, 17 cases): `orientation`/
  `orientationOptions` (a piece), `requiredOrientation` (a void), both
  optional and additive; `flipPiece()` cycles a piece's own
  `orientationOptions` list; `voidValidityForPiece()` classifies every
  open void red/green for a given piece, live, not just after a
  rejected tap. `stages.js` holds per-stage scene content (`STAGES`
  array, plain functions, no main.js changes needed to add one);
  `main.js` is the generic engine -- tap-vs-drag detection (real Pointer
  Event ids, a second finger joining mid-gesture cancels tap-candidacy),
  select/flip/place, red/green target highlighting, solved-state, auto-
  advance to the next `STAGES` entry, and a derived (not hand-tuned)
  camera fit: distance is back-solved from the real bounding radius of
  skeleton+tray against the tighter of the horizontal/vertical FOV, so
  a narrow phone viewport still frames everything correctly. **Rotation
  spins the skeleton's own Group, not an orbiting camera** -- found via
  real testing that an orbiting camera also swings the TRAY (a separate
  fixed-position object sharing the same world origin) around with it,
  so reaching a cube's hidden faces visually dragged the tray onto the
  skeleton; a placed piece is reparented tray-group -> skeleton-group
  (`Object3D.add()`) so it then rotates with the rest of the assembled
  shape. Own separate zero-build-step entry point (own import map, does
  not import `render.js` or touch the Core/Modules boundary), linked
  from the welcome screen (`welcome.js`'s `.rhombis-link`), built mobile/
  touch-first (capped pixel ratio, safe-area CSS, `touch-action`/tap-
  highlight hardening). `rhombis.html?stage=<id>` jumps straight to that
  stage on load (dev/testing convenience only, never surfaced in the
  UI, silently falls back to Stage 1 for a missing/invalid id) -- added
  so comparing stage variants (e.g. Stage 4's auto-snap vs. manual-
  orientation prototype) doesn't need editing source and remembering to
  revert it, which is exactly how earlier stages in this same session
  got tested before this existed. A real geometry bug was caught and fixed during
  Stage 3 verification (not shipped broken): the cube's 6 void positions
  were rotated but never translated, leaving apex/base swapped relative
  to spec (verified numerically before AND after the fix). Verified via
  real headless-Chromium runs, including real iPhone-viewport touch
  taps, across Stages 1-3 end to end. **Stage 4** (RD, 12 pieces) needed
  zero new geometry primitives -- per axis, the inward void (Stage 3's
  own) and a new outward one share the exact same `position` (both have
  their base on that cube face) and differ only in `quaternion`
  (`inwardQuaternion`/`outwardQuaternion`, both already built for
  Stages 2-3); verified numerically before landing (outward 'y+' at
  scale=2: base world (0,1,0), apex world (0,2,0), matching the spec's
  own stated outward-cap coordinate exactly) rather than assumed from
  the Stage 3 pattern.

  **Stage 4 introduced manual orientation, later confirmed and extended
  to every stage (see this section's own later entry) -- not the
  original auto-snap design** (direct instruction 2026-09-03, "let's
  prototype manual orientation on stage 4 and feel it out" -- a real
  question the user raised about whether auto-snapping every loose
  piece from Stage 3 onward was quietly turning "assemble a jigsaw"
  into "revolve one big complicated shape and tap obvious holes",
  making Stage 3+ less of a genuine spatial-reasoning puzzle than
  Stage 1/2 already were, and specifically undermining what a later
  spatial-reasoning score would even be measuring). Every Stage 4 piece
  now starts at a fixed wrong orientation ('x+:in', matching Stage 1's
  own "starts wrong" design) and must be cycled -- tap the selected
  piece again, same mechanic Stage 1/2 already use -- through all 12
  real targets (`geometry.js`'s new `quaternionForOrientationKey()`,
  which unifies Stage 1/2's bare axis-key orientations and Stage 4's
  new compound 'axisKey:in'/'axisKey:out' ones behind one resolver) to
  the void's own `requiredOrientation` before it will place. Needed
  ZERO `puzzle-state.js` changes -- `flipPiece()`'s N-way cycling and
  `placeSelected()`'s orientation gate already generalized from Stage
  2's 2-state case to Stage 4's 12-state one for free, proof the
  earlier design held up. `tests/unit/rhombis-puzzle-state.test.mjs`
  covers the 12-way cycle (wraps back to the start after exactly 12
  flips), a wrong-orientation placement rejecting cleanly, and all 12
  solvable once correctly oriented.

  **Real bug found and fixed while building this** (2026-09-03,
  general, not Stage-4-specific): `THREE.Raycaster` does NOT skip
  invisible objects on its own -- verified directly against the
  library source (neither `Raycaster.js` nor `Mesh.js` check
  `.visible`). Every earlier count-tracked tray (Stage 3/5/6) passed
  ALL its own not-yet-revealed pieces to the raycaster right alongside
  the one visible piece, and never caught this: those pieces sit at the
  exact same UNROTATED pose as the visible one, so tied-distance
  intersections happened to stably resolve to array order (index 0) by
  coincidence, not because visibility was actually respected. Stage 4's
  flip mechanic broke that coincidence the moment a piece rotates away
  from the shared pose -- the raycaster would then find the NEXT
  queued, still-unrotated, still-invisible piece instead, silently
  flipping the wrong one (caught via a live repro: flip cycled p0 once
  correctly, then the very next tap flipped p1 instead, confirmed with
  temporary debug logging before the fix). Fixed in `main.js`'s
  `handleTap`: `pieceTargets` now filters `p.mesh.visible` explicitly
  rather than relying on the raycaster to do it. This was a real,
  latent bug in every stage with a count-tracked tray, not something
  Stage 4 introduced -- it simply never had a chance to manifest until
  a piece could rotate while still queued.

  **Real secondary UX finding, not yet acted on**: because the
  canonical pyramid mesh's local origin is at its base center (not its
  visual centroid), flipping a piece rotates it around a point well
  behind its own apex -- the piece visibly SHIFTS position on screen
  with each flip, not just its facing. Confirmed via screenshot
  (compare the tray piece's on-screen position before vs. after a
  flip). This could make repeatedly tapping to cycle through
  orientations feel like "chasing" the piece rather than a stable,
  precise action -- flagged for direct hands-on feel, not fixed
  preemptively; the fix, if wanted, would be re-centering the piece
  mesh's own pivot to its bounding-box centroid before it's used as a
  flippable tray piece.

  **Decision confirmed and extended, 2026-09-03**: after live hands-on
  play (full stage completions, plus the endgame-visibility and
  rotation-tracking bugs above found and fixed along the way), manual
  orientation is the KEEP direction, not reverted -- and extended to
  every remaining auto-orienting stage in the same conversation, per
  direct instruction ("extend manual orientation to stage 3, 5, and 6",
  itself confirming an earlier direct question, "why not only allow
  green for correctly oriented piece"). Stage 3 and Stage 5/6's loose
  pieces now all cycle through real orientation options
  (`CUBE_ORIENTATIONS` -- 6 inward-only axis keys for the cube stages;
  `RD_ORIENTATIONS`, already built for Stage 4, reused unchanged for
  Stage 6's loose RD pieces) exactly like Stage 4's own pieces, and every
  void across every stage now carries a real `requiredOrientation`. Zero
  `puzzle-state.js` changes needed (same reason Stage 4 needed none --
  `flipPiece()`/`placeSelected()` only ever compare orientation strings,
  proven to generalize at any scale); a void's `groupId` (Stage 5/6's
  fused-piece path) and `requiredOrientation` (the loose-piece path)
  coexist without conflict since `voidValidityForPiece`/`placeSelected`
  only ever read ONE of the two depending on whether the selected piece
  has `fillsGroup` set. This also fully resolves the earlier
  "opaque/stacking" rendering fix's own root cause for loose pieces: with
  a real orientation gate, at most one void is ever valid at a time (the
  same reason Stage 4 never needed the calm-opacity fallback), so that
  fallback is now only ever exercised by an actual fused-piece selection,
  exactly what it was really for. Verified live: Stage 3 selecting a
  piece now shows exactly one green facet that moves correctly as you
  flip (screenshotted both orientations), a real placement at the
  correct orientation succeeds (6 -> 5 left), Stage 5's fused-piece path
  is unaffected (still solves the whole cube in one tap, still shows the
  calm/idle shell while selected, not a stacked wall), and Stage 6's
  loose pieces correctly cycle through the full in/out set
  (screenshotted "x+ face, inward" -> "x+ face, outward" after one
  flip). Full `node --test tests/unit/*.test.mjs` clean (275/275) --
  the suite's own `stage3State()`/`stage5State()`/`stage6State()` test
  fixtures are independent, hand-built analogs that exercise
  `puzzle-state.js`'s GENERIC mechanisms directly (a void with no
  `requiredOrientation` always valid, etc.) rather than importing
  `stages.js`'s real build functions, so they were never coupled to this
  change and needed no updates -- worth knowing if their own comments
  read as describing current Stage 3/5/6 behavior, since they no longer
  do (a documentation nit, not a real test gap: the mechanism they cover
  is still real and still exercised by a fused-piece selection).

  **Stage 5** (conjoined pieces) is the first REAL
  architecture extension, not just new content on the existing engine:
  `puzzle-state.js` gains `groupId` (a void) and `fillsGroup` (a piece),
  both optional and additive -- a "fused" piece placed by tapping any
  void in its group fills every void sharing that `groupId` in one
  placement, but only if none of them are filled yet (a fused piece
  physically can't fit where a loose piece already sits), giving the
  spec's own required "more than one valid decomposition of the same
  volume". Stage 5's actual puzzle reuses Stage 3's 6-void cube
  untouched, adding one pre-fused `THREE.BoxGeometry` piece (a real
  cube, not 6 stitched copies of the shared pyramid mesh -- it's
  honestly a different physical object) as an alternate for all 6 at
  once. `main.js` changes: `remainingCount()` now counts open VOIDS
  rather than unplaced pieces (a fused placement can clear several
  voids while its own loose siblings never get used, so the two
  diverge); `revealNextTrayPiece()` only queues loose pieces -- a fused
  piece is its own always-visible tray slot, not part of the "one at a
  time" queue; placement resolves its target position/quaternion from
  the piece's GROUP (cube center, identity) rather than from whichever
  void was actually tapped, and colors every void the placement filled,
  not just one. Verified live: fused piece placed with one tap solves
  the whole cube instantly (correct position, correct "Solved!"); after
  one loose piece claims part of the group, selecting the fused piece
  turns every remaining void red (not just not-green) and a tap on any
  of them is rejected without disturbing what's already placed; the
  loose path was independently re-confirmed too (4 of 6 placed live,
  reusing Stage 3's own already-fully-verified void positions
  unchanged). `tests/unit/rhombis-puzzle-state.test.mjs` (23 cases total
  now) separately proves both full decompositions solve the puzzle and
  that a partially-loose-filled group rejects the fused piece with
  `reason: 'group-partially-filled'`. **Stage 6** (multi-cell) needed
  ZERO `puzzle-state.js` changes -- the `groupId`/`fillsGroup` mechanism
  Stage 5 built already generalizes to more than one simultaneous group
  for free, since a fused piece only ever looks at its OWN `fillsGroup`
  value. Two full Stage-4-style 12-void RD cells, positioned at a REAL
  adjacent FCC lattice offset via `core/lattice.js`'s own
  `NEIGHBOR_OFFSETS`/`cellToWorld` -- the exact math the main app uses
  to place real RD cells, not a Rhombis-only approximation (the spec's
  own framing for this stage: "the connection back to... the Rhombiverse
  lattice work"). The composite is re-centered on the two cells' own
  midpoint (not cell 0's position) so dragging rotates it around its
  natural middle. Each cell independently offers loose-vs-fused, now a
  real whole-RD fused piece (`geometry.js`'s new
  `rhombicDodecahedronGeometry()`, reusing `core/lattice.js`'s own
  `rdRawVerts()` -- the SAME 14-point hull `render.js`'s `buildRDGeometry`
  uses for every real placed RD in the main app, not an approximation)
  standing in for that cell's 12 loose pyramids at once -- 4 real
  combinations overall (loose+loose / loose+fused / fused+loose /
  fused+fused). All 24 loose pieces share one tray queue across both
  cells; the 2 fused RD pieces are each their own always-visible slot.
  Verified live: selecting one cell's fused piece correctly turns ONLY
  that cell's own 12 voids green (the other cell's 12 stay their normal
  color, provably independent, not just asserted); placing it fills
  exactly that cell's 12 voids in one tap (24 -> 12, not a partial or
  over-fill); placing the second cell's fused piece completes the whole
  composite with the correct final "Solved!" state and a genuinely
  correct double-RD silhouette (two real rhombic dodecahedra sharing a
  face, matching real FCC packing); the loose path was independently
  spot-checked too (one loose pyramid correctly auto-orients within a
  specific cell, 24 -> 23). `tests/unit/rhombis-puzzle-state.test.mjs`
  (27 cases total now) separately proves fused+fused, fused+loose, and
  all-24-loose all solve the same composite, and that fusing one cell
  never affects the other cell's own fused option. **Stage 7 (content/
  polish): undo is done**, the rest is NOT yet built. Undo pops the
  pre-placement snapshot off a per-stage history stack (only real
  placements push -- selecting/flipping a piece is already trivially
  reversible by tapping again) and re-derives every mesh's transform/
  parent/visibility from the restored state (`syncVisualsToState()`)
  rather than hand-writing the inverse of each placement type -- one
  code path correctly handles both a 1-void loose undo and an N-void
  fused-group undo (needed `puzzle-state.js`'s new `filledBy` field on
  each void: which piece placed it, the reverse mapping a loose piece's
  own resync needs; a fused piece's target comes from its `fillsGroup`
  directly instead). Also correctly cancels a pending stage-auto-advance
  if undo fires inside that delay window (`current.advanceTimer`,
  tracked so `undo()`/`clearCurrentStage()` can `clearTimeout` it).
  Verified live: undo right after solving Stage 1 restores the piece to
  the tray in its pre-flip orientation AND genuinely prevents the
  advance (confirmed still on Stage 1 after waiting past the full delay,
  not just immediately after undo); a Stage 5 loose placement undoes
  cleanly (6->5->6), and a Stage 5 FUSED placement undoes all 6 voids at
  once in a single undo click (0->6, not a partial revert) -- both
  screenshotted, not just HUD-text-checked. The rest of Stage 7
  (procedural skeleton generator, scoring/timer, a real piece-bank tray
  UI, pinch-to-rotate/hold-to-preview) is NOT yet built -- these involve
  more subjective/open-ended design calls (a generation algorithm, a
  scoring formula, a UI redesign direction) than Stages 1-6's own
  spec-literal shapes did, so left as an explicit punch list for
  direct review rather than guessed at length unattended. The scoring
  slot specifically is the intended home for a later "spatial
  reasoning" score (direct suggestion 2026-09-03: NOT literally IQ --
  that implies a validated psychometric claim this can't back up) --
  not scoped or built yet.

  **Idle-state lattice decluttering, Stages 3-6** (2026-09-03, direct
  live-testing report: "far too many lines visible on RD I placed all
  six outer shell but couldnt see how to fit in inner ones" -- confirms
  the earlier-decided Option B was a real necessity, not a nice-to-have).
  Each of Stages 3-6 now gets its own permanent, always-visible outer
  boundary silhouette (`stages.js`'s new `makeOuterBoundary()`, a plain
  `THREE.LineSegments`/`EdgesGeometry` outline of the stage's cube/RD/
  composite shape, added once to the skeleton group) while every
  individual void's own wire defaults to HIDDEN until it's actually
  relevant (`hideIdleVoidWires: true` on those 4 stages' return objects;
  Stage 1/2 unflagged, unchanged). `main.js`'s `refreshVoidHighlights()`
  now sets each unfilled void wire's `.visible` from selection state --
  hidden when idle (nothing selected) and `hideIdleVoidWires` is set,
  shown red/green the moment a piece is selected -- while a FILLED void's
  wire always stays visible (a real seam in the completed shape, not
  clutter). `flashRejectWire()` was also fixed to force-show a wire
  during its reject flash even on a normally-hidden stage, restoring
  `.visible` to what it was before afterward, so a rejected placement is
  never invisible. Verified live via headless Chromium: Stage 4/6's idle
  view now shows only the clean outer silhouette(s), not the previous
  criss-cross of all 12 (or 24) individual void wires; selecting a piece
  still correctly lights up every remaining OPEN void red/green (fewer
  of them as more get placed/filled, which is what actually solves the
  reported problem -- the count shown at once shrinks as you progress
  instead of staying at the stage's full total). Full `node --test
  tests/unit/*.test.mjs` suite re-run clean (275/275) -- this change is
  purely visual/THREE-side, no `puzzle-state.js` changes.

  **Goal-shape redesign: translucent solid + ghost-piece overlay, DONE**
  (2026-09-03, direct follow-up after the above fix landed): the
  wireframe skeleton (`makeOuterBoundary`) is gone, replaced by
  `makeOuterSolid()` -- the stage's real SOLID cube/RD/composite
  geometry rendered translucent, reusing the main app's own already-
  established World View translucent treatment verbatim rather than
  inventing new material logic (`render.js`'s
  `applyWorldViewMaterials()`/`TRANSLUCENT_OPACITY = 0.55`: `transparent:
  true, opacity: 0.55, depthWrite: false`). A placed piece stays fully
  solid/opaque and visually "fills in" the translucent shell -- this is
  also the answer to a separate suggestion ("goal piece should grow
  incrementally") that arrived the same conversation: no separate
  reveal/growth logic needed, solidification falls straight out of real
  geometry filling real voids. Per direct decision on how void-targeting
  should work without wireframe voids to color: `makeVoid()`'s wire is
  now a translucent GHOST COPY of the piece that would go there (the
  SAME geometry a placed piece uses), tinted per `refreshVoidHighlights()`
  -- green if the selected piece would place validly there, red if not.
  **Real legibility bug found and fixed during live verification, same
  session**: with every open void's ghost at one shared opacity, a stage
  with many simultaneously-open voids (Stage 4's 12, only ever 1 valid
  at once under manual orientation) stacked 11 translucent red wedges on
  top of each other and rendered as one solid red blob -- the single
  green one visually disappeared into it, defeating the whole point of
  the highlight (screenshotted both ways: solid red blob before, a
  clearly popped-out green wedge after). Fixed by splitting ghost
  opacity by validity (`VALID_GHOST_OPACITY = 0.85`,
  `INVALID_GHOST_OPACITY = 0.12`) -- invalid ghosts stay a faint hint,
  the one valid target renders near-opaque and reads instantly.
  `flashRejectWire()` also needed a matching fix: forces full opacity
  during its own flash now, since an already-faint invalid ghost would
  otherwise make a rejected-placement flash nearly invisible. A filled
  void's ghost is hidden outright (not recolored) once a real piece
  occupies that exact position/orientation -- showing both would double
  up two solid objects in the same space. Also confirms the earlier
  "no situation where 12 identical pieces waiting" note needed no new
  work: the tray already reveals one piece at a time with a count badge
  (`revealNextTrayPiece()`, decided and shipped in Stage 5+), not N
  queued duplicate meshes. Full `node --test tests/unit/*.test.mjs`
  clean (275/275) -- pure THREE/visual-side change, no `puzzle-state.js`
  edits.

  **Real accessibility gap found and fixed, same session** (2026-09-03,
  direct report: "rhombis is not accessible on app"): the only link to
  Rhombis anywhere in the main app was a one-time welcome-overlay link
  (`welcome.js`'s `.rhombis-link`), gated behind
  `localStorage['rhombiverse-skip-intro']` -- any returning visitor (the
  overwhelming majority of real usage) never sees that overlay again and
  had no way back to Rhombis at all. Also surfaced a real, previously-
  unnoticed mechanism while investigating: `welcome.js`'s own tagline is
  ALWAYS the newest `data/changelog.json` entry's title
  (`loadLatestUpdate()`/`tagline.textContent = entry.title`) -- meaning
  every changelog entry, however narrow, briefly becomes the entire
  app's public-facing tagline for every new visitor, not just a line in
  a changelog nobody reads. Confirmed live (screenshotted): the welcome
  card's subtitle really did read "Rhombis: A Steadier Tray" (an
  internal tap-target bugfix on a barely-reachable feature) before this
  was caught. Fixed both: (1) a persistent `#rhombis-settings-link` line
  added to `#lab-panel` (Settings, reachable via the real live nav path
  -- the Rhombic Wheel 3D menu's gear face, not the legacy flat
  `#lab-toggle` button which the live UI no longer shows by default) --
  verified live via a real click through to `rhombis.html`, not just
  visual inspection; (2) `data/changelog.json` trimmed back to ONE real
  Rhombis entry ("Rhombis: A New Way In", the genuine launch
  announcement) with the five subsequent internal-iteration entries
  (Stage 4/5/6 additions, undo button, tray bugfix, lattice-declutter
  fix) removed -- they were real work, just not each individually
  tagline-worthy for an audience with no way to reach the feature they
  described. **Changelog policy going forward, direct instruction
  2026-09-03**: only add an entry for something that actually, currently
  affects reachable users -- not every internal iteration on a WIP/beta
  feature, given this tagline mechanism's real reach.

  **Real deploy-time 404, found immediately after the above "fixed"
  the accessibility gap** (2026-09-03, direct live report on the
  production site: "still not accessible showing 404 not found"). Root
  cause: `scripts/build.mjs` (the Vercel `buildCommand`, producing
  `dist/` as the real deployed output -- see its own header, "Production-
  only build") copies an explicit ALLOWLIST of top-level static files
  into `dist/`, and `rhombis.html` was never added to it -- every local
  verification this whole session used `python3 -m http.server` directly
  against the repo root (this repo's own established dev-testing
  pattern), which serves the raw tree and so never exercised this
  allowlist at all. `rhombis.html`'s own JS (`src/rhombis/*.js`) WAS
  always fine (the build's separate `findJsFiles(src/)` walk picks up
  everything under `src/` unconditionally) -- only the HTML entry point
  itself was missing. Fixed: added `'rhombis.html'` to
  `staticEntries`. Verified for real, not just by reading the script:
  ran `node scripts/build.mjs` locally (this script has zero Vercel-
  specific dependencies, runs standalone), confirmed `dist/rhombis.html`
  and `dist/src/rhombis/*.js` now exist, served `dist/` directly via a
  second local static server (a real stand-in for what Vercel actually
  serves, not the dev-only raw-tree server), and re-ran the SAME live
  Playwright checks against port 8124 instead of the usual dev port:
  `rhombis.html` loads and runs cleanly against the real MINIFIED
  production build (Stage 1 renders, HUD text correct, zero console/page
  errors), and the Settings-panel link added earlier this session
  resolves and navigates correctly from `dist/index.html` too. This is
  the real, first end-to-end confirmation that Rhombis is reachable on
  the actual deployed site, not just in local dev -- everything reported
  "verified live" earlier this session was only ever checked against the
  raw-tree dev server, a real gap in this session's own verification
  method that's worth remembering for anything else added to the repo
  root (a new top-level HTML entry point, in particular) going forward.

  **Two more real bugs found live on the deployed site, same day, after
  the 404 fix above** (2026-09-03):

  1. "cube isnt translucent it is opaque so blocks view" -- the outer
  solid shell (`makeOuterSolid`) had no `side` set on its material, so
  WebGL's default back-face culling meant a closed convex shape only
  ever rendered its near 2-3 faces, blended against the background, not
  against each other -- no far wall ever showed through, so it read as
  flat painted panels rather than glass (confirmed genuinely translucent
  underneath by temporarily forcing opacity to 0.08 and seeing it go
  much dimmer, ruling out "opacity isn't applying at all" before
  chasing the real cause). Fixed with `side: THREE.DoubleSide` on both
  `makeOuterSolid` and `makeVoid`'s ghost material. That alone wasn't
  enough for Stage 3/5/6 specifically, though: an auto-orienting piece
  (no `orientationOptions` -- any open void accepts it) makes EVERY open
  void valid at once, and popping every one of them to
  `VALID_GHOST_OPACITY` stacks that many translucent layers on top of
  each other -- alpha-blending N overlapping layers approaches full
  opacity fast regardless of any single layer's own value (screenshotted
  proof: Stage 3's 6-void cube read as one solid green wall when
  selected). There's also nothing to disambiguate when literally every
  open void is correct, unlike Stage 4's real "1 of 12". Fixed in
  `main.js`'s `refreshVoidHighlights()`: when every open void is
  simultaneously valid AND there's more than one of them (`> 1` matters
  -- Stage 1 has exactly one void total, where "the one open void is
  valid" is real, meaningful feedback with nothing to stack, not this
  problem), skip the pop treatment and fall back to the calm/idle
  opacity instead. Verified live both ways (Stage 3 selected now looks
  like the idle shell, Stage 1's real match still pops green; Stage 4's
  real "1 of 12" pop independently re-confirmed unaffected).

  2. "third green inside piece in RD will not accept tapping as it is
  surrounded by incorrectly oriented pieces which block" -- a real
  raycasting-priority bug, not a placement-logic bug.
  `raycaster.intersectObjects` sorts purely by 3D distance, with no
  regard for a void's filled/valid state or how visible its ghost
  currently is. An invalid void's ghost is deliberately rendered
  near-invisible (`INVALID_GHOST_OPACITY`), but its `hitTarget` geometry
  is exactly as solid as ever -- Stage 4's outward-pointing wedge sits
  physically BETWEEN the camera and its own axis's inward wedge (the
  RD's outward spike is closer to the viewer than the RD's own interior
  along that same face-normal ray), so tapping toward an inward target
  could resolve to the outward wedge's hitTarget first and reject,
  even though the player was aiming at (and could dimly see) the valid
  target behind it. Fixed in `main.js`'s `handleTap`: instead of always
  taking `hits[0]`, walk the sorted hit list for the first hit that's
  actually usable (a piece, or an unfilled void that's valid when
  validity is known) before falling back to the closest hit of any kind
  -- preserves the reject-flash for a genuine miss (nothing valid
  anywhere along the ray) while no longer letting an invisible-ish
  invalid/filled void silently eat a tap meant for something valid
  behind it. Verified live: reproduced the exact reported scenario
  (piece starts 'x+:in', tapped toward the x+ face where the outward
  wedge sits in front of the inward one) and confirmed placement now
  succeeds where it previously would have been swallowed by the
  closer-but-invalid outward wedge.

  **Third real bug, found the same day investigating "1 left over
  couldnt fill" / "only outside were green on last few" / "something
  stuck"** -- NOT a logic bug. Proven by writing a scripted solver
  (temporary debug hook exposing `camera`/`renderer`/`current` on
  `window`, real perspective-projection math to convert each void's
  world position to exact screen pixels, removed again before
  committing) that placed all 12 pieces correctly using precise
  projected coordinates -- zero failures, confirming
  `voidValidityForPiece`/`placeSelected`/the raycast-priority fix above
  are all completely correct. The real cause: late in a stage, most
  voids already hold real SOLID opaque placed pieces. A remaining valid
  target's ghost is still correctly computed as green, but it can end
  up fully behind one of those already-placed pieces from whatever angle
  the shape currently sits at -- normal WebGL depth testing means the
  player literally cannot SEE it to know where to tap, even though the
  underlying match is completely correct (confirmed live: screenshotted
  a real endgame state -- 2 voids left, 10 solid pieces already placed
  -- and the valid target was invisible with normal depth testing on).
  Fixed in `main.js`'s `refreshVoidHighlights()`: the currently-VALID
  ghost specifically gets `depthTest = false` (invalid/idle ghosts keep
  normal depth testing -- they're not worth punching through solid
  geometry to see, only the one thing that actually matters right now
  is). Verified live: the same endgame screenshot now clearly shows the
  green target through the solid orange pieces in front of it, and a
  tap at that same screen position places correctly (2 left -> 1 left).
  A related but ultimately unnecessary idea raised the same
  conversation ("maybe pieces should only be offered in order that can
  be completed" / "available spaces should only be offered in order")
  doesn't actually apply here -- every piece in a stage is geometrically
  IDENTICAL and interchangeable (any piece fits any void once correctly
  oriented), so queue/reveal ORDER was never what made the reported
  scenario unsolvable; visibility was the whole problem, and this fix
  addresses it directly rather than constraining player choice.

  Full `node --test tests/unit/*.test.mjs` clean (275/275) after all
  three fixes -- all pure THREE-rendering/raycasting-side changes, no
  `puzzle-state.js` edits.

  **Fourth real bug, found live the same day after completing every
  stage anyway** ("one highly frustrating thing was that genuinely
  aligned spaces dont light up as you rotate target and successful
  orientations are in completely different directions"). Root cause: an
  unplaced (tray) piece is a child of `scene`, not `skeletonGroup` --
  its fixed tray POSITION depends on that (Stage 3's own header comment
  already explains why: an orbiting camera or a fully-parented tray both
  swing the tray around unacceptably). But dragging to rotate the target
  shape spins `skeletonGroup` (and every void with it) while the held
  piece's own facing never moved at all -- its orientation quaternion
  (`quaternionForOrientationKey`) is a fixed LOCAL-axis label with no
  relationship to the skeleton's current on-screen rotation. So "does
  this piece look aligned with that hole from here" was never a
  trustworthy cue the moment you rotated even slightly, exactly matching
  the report. Fixed in `main.js`'s `animate()`: for an unplaced piece
  with a real `orientation` (Stage 1/2/4 currently), the per-frame slerp
  target is now `skeletonGroup.quaternion * quaternionForOrientationKey
  (orientation)`, recomputed every frame -- the piece's POSITION stays
  fixed in the tray (unaffected), but its FACING now visually spins
  along with the target shape in real time, so alignment is a genuine
  visual cue again at any rotation. Placed pieces need none of this --
  already children of `skeletonGroup`, the scene graph composes their
  rotation with the group automatically, which is exactly why this bug
  was invisible for anything already placed. Verified live
  (screenshotted before/after a drag with a piece selected: the held
  piece's own silhouette visibly changes shape as the target rotates,
  where before it stayed static) and re-confirmed placement still works
  correctly immediately after rotating mid-selection (a real
  select-rotate-flip-place sequence, not just visual inspection). Full
  suite re-run clean (275/275) after this fix too.

  **New playable level: "Joined Pair" (`STAGES` id 7, `buildStage7`),
  2026-09-04** (direct instruction, after confirming via a direct
  question -- "the two target cells were joined previously no?" -- that
  Stage 6 had never actually built this: its two fused pieces are
  independent, each only ever filling its own cell). Reuses Stage 6's
  exact 2-cell layout (factored out into a shared `twoCellCenters(scale)`
  helper so the two stages are provably the same geometry, not just
  visually similar) but is a genuinely different puzzle, not more
  content on the same engine: NO loose pieces at all, exactly two fused
  pieces --
  - the **joined pair**: one real physical object spanning both cells,
    filling all 24 voids in a single placement -- built by merging two
    `rhombicDodecahedronGeometry(scale)` instances (each translated to
    its own cell's center) into one real `BufferGeometry` via
    `three/addons/utils/BufferGeometryUtils.js`'s `mergeGeometries`
    (the same established pattern `render.js` already uses for its own
    merged skeleton meshes, imported statically this time rather than
    render.js's own dynamic `await import()`, since stages.js's build
    functions are called synchronously from `main.js`'s `loadStage()`
    and staying sync avoided a wider async refactor). Deliberately ONE
    real `THREE.Mesh`, not a `THREE.Group` of two -- `main.js`'s
    raycaster intersects `pieceTargets` non-recursively, so a Group's
    children would simply never be hit-tested.
  - the **decoy**: an ordinary single-cell whole-RD fused piece,
    visually identical to Stage 5/6's own fused pieces and just as
    functional -- tap it onto cell-0 and it genuinely, correctly fills
    that cell's 12 voids. Direct instruction on what makes it a real
    decoy, not a fake button: "1 single cell as decoy" meant it had to
    actually work, not be silently rejected everywhere -- use it and
    cell-1 has nothing left to fill it with (no loose pieces, only one
    decoy), so the composite is stuck open until Undo. A decoy that
    just flashed red on every tap wouldn't be tempting, just broken.

  **Real generalization needed in `puzzle-state.js`**: a void's single
  `groupId` string became a `groupIds` ARRAY, since a cell-0 void now
  belongs to BOTH `'cell-0'` (the decoy's own group) and `'joined-01'`
  (the joined pair's group) at once -- something no earlier stage ever
  needed (Stage 5/6's groups never overlapped). `voidValidityForPiece`/
  `placeSelected` now check `voidEntry.groupIds.includes(piece.
  fillsGroup)` instead of `===`; a piece's own `fillsGroup` stayed a
  single id (unchanged) -- only voids needed multi-membership, not
  pieces. Every existing single-group void across Stage 5/6 (and this
  file's own `stage5State()`/`stage6State()` test fixtures) just got a
  one-element array; the single-group case is semantically identical to
  before, confirmed by the full suite passing unchanged for those. 4 new
  tests added directly covering the new mechanic (`joinedPairState()`):
  the joined pair fills all 24 in one tap, the decoy genuinely fills
  just its own 12 (not a no-op), the decoy is rejected against the
  wrong cell, and using the decoy correctly traps the joined pair
  (`reason: 'group-partially-filled'`, every remaining void reading
  invalid for it). Verified live end-to-end, not just unit-tested: a
  fresh board solves in one tap with the joined pair (screenshotted
  "Solved!"); selecting the decoy correctly shows cell-0 green/cell-1
  red (screenshotted); placing the decoy on cell-0 then selecting the
  joined pair shows the ENTIRE remaining shape red (the trap, confirmed
  visually, not just via the unit test); Undo correctly restores to a
  fresh, still-solvable 24-void state afterward. Full `node --test
  tests/unit/*.test.mjs` clean (275 -> 279).

  **Naming note**: this is the first STAGES entry with `id: 7` -- an
  unrelated, MUCH earlier use of "Stage 7" already exists in this same
  file (and in `puzzle-state.js`'s own comments) meaning "post-Stage-6
  polish work" (undo, scoring, a piece-bank UI, procedural generation --
  see this section's own punch list below), not a playable level. The
  two are unrelated; don't conflate a comment referencing "Stage 7's
  undo" with this actual playable Stage 7.

  **Cell-arrangement enumerator, built 2026-09-04** (direct instruction,
  "from here forward all mathematical possibilities in any cell
  arrangement" / "go ahead, start the enumerator"): `src/rhombis/
  cell-arrangements.js`, pure math, no THREE/DOM -- generates the
  COMPLETE, symmetry-deduplicated set of connected N-cell FCC shapes
  directly from `core/lattice.js`'s own `NEIGHBOR_OFFSETS`, rather than
  hand-picking a few named shapes ("a line," "a triangle") the way Stage
  7 reused an already-known 2-cell layout. `SYMMETRY_OPERATIONS`: the
  FCC lattice's full symmetry group is exactly the 48-operation
  octahedral group (6 axis permutations x 8 sign combinations) --
  verified directly (own test suite), not assumed: every one of the 48
  maps `NEIGHBOR_OFFSETS` bijectively onto itself, preserves the
  lattice's own even-sum parity constraint, and the group closes under
  composition. `canonicalForm(cells)`: tries all 48 operations, keeps
  the lexicographically-smallest translated-and-sorted representation,
  so two shapes that are just rotations/reflections of each other
  collapse to the identical canonical key -- exactly the "free
  polyomino" counting problem, adapted from a square grid to this
  lattice. `enumerateShapes(maxN)`: BFS-grows every connected N-cell
  cluster from a seed cell, deduping via canonical form at each size
  before growing further, so N=k's own complete deduped list is real
  input to generating N=k+1.

  **Real, verified results, not guesses**: N=1 gives 1 shape (trivial);
  N=2 gives exactly 1 shape (the lattice symmetry group acts
  transitively on all 12 neighbor offsets -- confirms Stage 6/7 really
  are "the" 2-cell shape, not just "a" 2-cell shape); **N=3 gives
  exactly 4 distinct shapes**, not the 2-3 guessed by hand the day
  before -- characterized by their real pairwise cell distances (in
  edge-length units, edge = sqrt(2)):
  - **Triangle**: (1, 1, 1) -- equilateral, all three cells mutually
    adjacent, a real face of the FCC close-packing.
  - **Straight line**: (1, 1, 2*sqrt(2)) -- the two end cells at
    exactly double the edge length apart (the SAME offset applied
    twice), the maximum possible end-to-end spread for 3 connected
    cells.
  - **Wide bend**: (1, 1, sqrt(6)) -- an open (non-triangular) chain,
    ends farther apart than the narrow bend.
  - **Narrow bend**: (1, 1, 2) -- an open chain, ends closer together
    than the wide bend, tighter turn than the straight line.
  N=4 was also computed as a further sanity check on the generator's
  own scaling behavior: 20 distinct shapes (not yet characterized in
  detail -- no N=4 stage work has started).

  12 tests in `tests/unit/rhombis-cell-arrangements.test.mjs` cover the
  symmetry group's own correctness (count, bijectivity, parity
  preservation, closure under composition) independently from the
  enumeration results, plus `canonicalForm`'s translation/symmetry
  invariance, the N=1/N=2/N=3 counts, two hand-built shapes (a real
  triangle, a real straight line) provably appearing among the N=3
  results and being provably distinct from each other, and that every
  generated shape at every size is genuinely connected (no
  reachability bugs slipping through). Full `node --test
  tests/unit/*.test.mjs` clean.

  **All 4 built as real playable stages, same day** (`STAGES` ids 8-11,
  direct instruction "all 4"): `buildNCellStage(scale, cellLatticeOffsets,
  joinedPairIndices)` is one generic builder driving all four, not four
  hand-written stages. Named by heading convention "N Cells: <Shape>"
  starting from N=2 (direct instruction) -- Stage 7 renamed to "2 Cells:
  Joined Pair" to match, Stages 8-11 are "3 Cells: Triangle" / "Narrow
  Bend" / "Wide Bend" / "Straight Line".

  **Real bug, caught live the same day: "you havent wired enumerator"**
  -- the FIRST version of this imported `enumerateShapes` but never
  actually called it, hardcoding a hand-copied snapshot of its output
  (`THREE_CELL_SHAPES` as a literal array) instead. Fixed properly:
  `THREE_CELL_STAGE_DEFS` now calls `enumerateShapes(3)[3]` for real,
  every stage load. Since the raw enumeration order isn't guaranteed
  stable across contexts (confirmed live: the SAME code produced Narrow
  Bend and Wide Bend in swapped positions between a plain-Node run and
  the real browser's own module context -- almost certainly BFS growth
  order sensitivity, not a bug in the math itself, but a real
  demonstration of why trusting array position would have been wrong),
  each shape's own name is derived by classifying its REAL pairwise
  cell distances (`classifyThreeCellShape` -- the 4 shapes have
  distinct, verified maximum pairwise distances: Triangle sqrt(2),
  Narrow Bend 2, Wide Bend sqrt(6), Straight Line 2*sqrt(2)), and its
  joined-pair indices are likewise found by checking real adjacency
  (`findAdjacentCellPair`) against whatever cells actually came back --
  never assumed from position. `STAGES`' own 8-11 entries are now built
  by mapping over this real, freshly-computed list
  (`...THREE_CELL_STAGES` spread into the array), not four separately
  hardcoded id/name/build triples. Verified live after the fix: the
  displayed stage names are correct regardless of the underlying
  enumeration order (confirmed the actual browser-context order does
  differ from the original hand-copied snapshot, and the labels still
  come out right because they're derived, not positional).

  Tray design, per direct instruction ("an extra two piece with three
  pieces, after singles"): N single-cell fused pieces (one per cell,
  each independently always correct -- unlike Stage 7, this is NOT a
  decoy/trap design, matching Stage 5/6's own "more than one valid
  decomposition" spirit at 3-cell scale) PLUS one "joined pair" fused
  piece spanning the shape's own adjacent cell pair. No loose pyramids
  at all, matching the direct instruction's own "singles" (whole-cell)
  framing.

  **A real concern checked and NOT found to be a problem**: selecting
  the joined pair makes 24 of 36 voids simultaneously valid at once (2
  of 3 cells) -- close to the exact condition (many simultaneously-valid
  ghosts) that caused the earlier "cube isnt translucent" stacking-
  opacity bug. Verified live before shipping (screenshotted) that it
  does NOT recur here: unlike Stage 3's original bug (6 voids all
  tiling the SAME compact cube volume, heavily overlapping in screen
  space from any angle), a 3-cell shape's voids are spread across
  spatially SEPARATE lobes -- each lobe's own 12 voids only overlap
  within that lobe's own small screen region, never across lobes. Both
  the joined-pair selection (2 clearly green lobes, 1 red) and a single
  selection (1 green, 2 red) read cleanly with no wall effect.

  Verified live end-to-end on Stage 8 (Triangle): all 4 stages load
  with zero console/page errors and the correct 36-void count; a real
  joined-pair placement succeeds (36 -> 12, screenshotted). The
  remaining single-piece placement was confirmed correct at the
  puzzle-state.js level (own unit tests, not reasoned about by
  inspection) rather than exhaustively re-verified pixel-by-pixel live
  for all 4 stages -- direct instruction mid-session ("rewire every
  time a stage is finished so I can test manually more easily") shifted
  hands-on verification of 9/10/11 to direct manual play rather than
  more automated Playwright runs; Stage 7 was independently confirmed
  working by direct manual test the same way ("stage 7 ok by test").
  Full `node --test tests/unit/*.test.mjs` clean.

  **"Full" piece generalization + N=4 curated stages, added the same
  day** (`STAGES` ids 12-15, direct instruction: "scope out four piece
  levels using logic applied with addition of full four piece
  solutions, maybe add this back to 3 piece level"). Two real pieces of
  work:

  1. `buildNCellStage` gained a THIRD fused-piece option for N>2: a
  "full" piece spanning ALL N cells at once (merging N
  `rhombicDodecahedronGeometry` instances, same `mergeGeometries`
  pattern as the joined pair). A void can now belong to its own cell's
  group, the joined-pair's group (if it's one of that pair's 2 cells),
  AND `'full'` simultaneously -- `groupIds` already being an array
  (from Stage 7's own generalization) made this a small, additive
  change, not a new mechanism. Retrofitted onto Stages 8-11 too (the
  "maybe add this back to 3 piece level" half of the instruction) --
  every N=3 stage now offers 3 singles, 1 joined pair, AND 1 full
  piece, all genuine alternate solutions, none of them a decoy. 4 new
  tests (`threeCellWithFullPieceState`) directly prove a void handling
  THREE simultaneous group memberships works correctly: the full piece
  solves in one tap, three independent singles still solve it without
  touching the fused pieces at all, a single placement on the third
  cell traps the full piece specifically (not the joined pair, whose
  own 2 cells are untouched), and a joined-pair placement traps the
  full piece while leaving the remaining single still genuinely usable.

  2. **N=4 scope, decided via direct question**: N=3 had exactly 4 real
  shapes (a small, complete set worth building "all of"); N=4 has 20 --
  a curated subset was chosen over building all 20, confirmed by direct
  answer. The 4 picks were chosen from REAL topology data
  (`shapeTopology`: edge count + per-cell degree sequence + max pairwise
  distance, computed for all 20 real shapes before picking, not
  guessed), specifically to span structures that don't even exist at
  N=3: **Tetrahedron** (6 edges, every cell degree 3 -- all 4 mutually
  adjacent, the maximally compact case, FCC's real analog of N=3's
  triangle), **Ring** (4 edges, every cell degree 2 -- a closed 4-cycle
  with no "ends" at all, topologically impossible with only 3 cells),
  **Star** (3 edges, one cell degree 3 and three degree 1 -- a
  branching tripod, also impossible at N=3 since that needs a degree-3
  cell), and **Straight Line** (the single N=4 shape with the greatest
  possible cell-to-cell distance, direct continuation of the N=3
  pattern). Each pick is selected from the real `enumerateShapes(4)[4]`
  output by `pickFourCellShape`'s own signature-matching (with an
  explicit, documented tiebreak for Star, since 3 different real
  4-cell shapes share its exact edge/degree signature at different
  "spreads" -- picked the most compact one) -- same "derive it for
  real, never hardcode a snapshot" discipline the N=3 fix established,
  applied from the start this time rather than needing a second bug
  report to get there.

  Verified live: all 4 N=4 stages load with zero errors and the
  correct 48-void count (12 per cell), visually distinct from each
  other and from the N=3 shapes (screenshotted); the retrofitted full
  piece confirmed working on both a 3-cell stage (Stage 8, 36 -> 0 in
  one tap) and a 4-cell stage (Stage 12 Tetrahedron, 48 -> 0 in one
  tap). Full `node --test tests/unit/*.test.mjs` clean.

  **Open notes for whenever this progression continues**: decoy pieces
  should vary in size as levels advance -- still not relevant to
  Stages 8-15 (none of them are decoy/trap designs), will matter once a
  later stage reintroduces that mechanic; the remaining 16 real N=4
  shapes (and N=5+, not yet enumerated at all) remain available in
  `cell-arrangements.js` whenever this progression continues further.

  **Pinch/wheel zoom + starry background, added the same day** (direct
  instruction: "need pinch and expand gestures to make puzzle bigger
  and a starry sky background"). Zoom is a multiplier (`zoomFactor`,
  clamped [0.4, 2.5], reset to 1 on every stage load) applied on top of
  the existing DERIVED camera distance (`applyCameraFraming`'s own
  bounding-radius math), not a replacement for it -- preserves the
  "always frames correctly regardless of aspect ratio or stage size"
  property a past bug fix established, with zoom layered on as a per-
  session interactive adjustment. `activePointers` changed from a Set
  to a Map (id -> last {x,y}) since pinch needs both fingers' actual
  positions, not just a count; a genuine 2-finger pinch tracks the
  distance between them and scales `zoomFactor` by the ratio (fingers
  spreading apart shrinks the distance ratio, shrinking `zoomFactor`,
  which means a SMALLER camera distance -- a bigger/closer view, so
  "expand to make it bigger" is a real effect, not just a label). Wheel
  does the same on desktop. Verified live: wheel zoom confirmed both
  directions (screenshotted before/in/out); a REAL two-finger pinch
  simulated via synthetic PointerEvents (Playwright has no high-level
  multi-touch API) confirmed the expand gesture visibly grows the
  puzzle, and that a 2-finger gesture never triggers an accidental tap/
  placement (already true structurally -- `cancelTapCandidate()` fires
  the moment a second pointer joins, same guard that already protected
  the single-finger tap-vs-drag logic).

  Starry background: two `THREE.Points` layers (900 small dim stars +
  120 larger bright ones, for real size/brightness variety rather than
  a uniform dot grid), positioned via genuine uniform-sphere sampling
  (not naive per-axis random, which clusters near a bounding cube's
  corners) at a fixed radius comfortably inside the camera's far clip
  plane (100) but well beyond any stage's own bounding radius --
  `sizeAttenuation: false` keeps each star a constant screen size
  regardless of zoom, correct for something meant to read as
  infinitely far away. Added directly to `scene`, not `skeletonGroup`,
  so rotating/zooming the puzzle never visibly moves the stars --
  verified live (screenshotted before/after a real drag-rotate,
  identical star positions in both).

  Full `node --test tests/unit/*.test.mjs` clean (295/295, unchanged --
  both features are pure THREE-rendering/input-side, no puzzle-state.js
  surface).

  **Still open from the same request**: a small HUD/topbar symbol
  showing the current stage's cell arrangement as a "skeleton side
  view" (direct instruction, mentioned a triangle-of-RDs example), and
  a blocky 80s-style RHOMBIS logo built from RDs ("if possible") --
  both are more open-ended visual-design tasks, deliberately sequenced
  after the more mechanical zoom/starfield work, not yet started.

  **Welcome-screen tagline is now a real link, same day** (direct
  instruction, deliberate wordplay: "could we use the sub heading
  rhombis a new way in as a link to enumerator... A new way in
  (wordplay too)"). `welcome.js`'s own tagline mechanism was already
  established (always the newest `data/changelog.json` entry's title,
  see this file's own earlier "accessibility gap" writeup above) but
  was always plain text. `data/changelog.json` entries can now
  optionally carry a `link` field -- the "Rhombis: A New Way In" entry
  got `"link": "./rhombis.html?stage=8"`, and `welcome.js` renders the
  tagline as a real `<a>` when one's present (unchanged plain text
  otherwise, so every other entry is unaffected). The wordplay lands
  literally: the tagline that originally announced Rhombis now IS a
  new way in -- a direct shortcut straight to Stage 8, the first
  enumerator-generated puzzle, skipping the intro tutorial stages
  entirely for a returning player who wants the newest content. A
  small step toward the separately-requested "level select for
  returning users" idea, not a replacement for it. Styled with a
  subtle dotted underline (`index.html`'s `.tagline a`), not a jarring
  default blue link. Verified live: the link's real href resolves to
  `./rhombis.html?stage=8`, and clicking it actually navigates there
  (Stage 8, correct title), not just present in markup.

  **Two real bugs found live testing the N=3/N=4 tray, same day**
  ("picker tray pieces are overlapping each other and cant be
  rotated", then Stage 15 rendering fully blank after the first fix).

  1. The fixed per-slot vertical spacing (`homeSpacing * i`) was tuned
  for N single-RD-sized pieces, but the joined-pair and full pieces are
  physically bigger (2 or N cells' worth of merged geometry) --
  screenshotted live showing N=4's last 2-3 tray slots crammed into one
  overlapping blob. Fixed by laying the tray out from each piece's own
  real bounding-sphere radius (a running Y cursor moves down by the
  previous piece's own half-height, a fixed gap, then the next piece's
  own half-height) instead of a uniform per-slot gap.

  2. That fix immediately surfaced a second, worse bug: Stage 15
  (Straight Line) rendered completely blank. Root cause: `main.js`'s
  `boundingRadiusFromOrigin` derives camera distance from the farthest
  point across the skeleton AND every tray piece combined -- Straight
  Line's own "full" piece spans real lattice distance ~4.24 (the
  single farthest-apart cell pair of any real N=4 shape), so its
  merged geometry's own bounding sphere is dramatically larger than a
  single RD's, and positioning it correctly-spaced-but-far-down the
  tray (fix #1, above) pushed the derived camera distance out so far
  the actual target shrank to sub-pixel specks. Fixed by CAPPING a
  merged piece's visual size in the tray (`trayScaleFor`/`trayScale`,
  a real `Object3D.scale` set at creation and reset to 1 the instant
  the piece is actually placed into the assembled shape -- both the
  live-placement code and the undo/resync path needed the reset) --
  ordinary 2-cell joined pairs and compact N=4 pieces (Tetrahedron/
  Ring/Star) stay full scale, comfortably under the cap; only Straight
  Line's own outlier full piece gets visibly shrunk in the tray (still
  correctly selectable/placeable at the smaller size, confirmed live --
  a uniformly-scaled elongated shape still LOOKS elongated, just
  smaller, which is the geometrically honest result, not a further
  bug). Verified live across all 8 real N=3/N=4 stages after both
  fixes: no overlap, no blank renders, correct piece counts. Full
  `node --test tests/unit/*.test.mjs` clean -- pure THREE-rendering-
  side, no puzzle-state.js surface.

  **N=3 stage naming fixed to use the real geometric angle, same day**
  (direct live correction: "you missed right angle bend as option").
  All 4 real N=3 shapes were always correctly enumerated and built --
  this was a naming bug, not a missing shape. `classifyThreeCellShape`
  previously named shapes by raw max pairwise distance (a valid
  DISTINGUISHING signature, but not an intuitive one): the shape with
  the LARGER max-distance got called "Wide Bend", which happens to be
  the 90-degree right-angle bend -- a name giving no hint it was a
  right angle, while the real 120-degree (genuinely wider) bend got
  called "Narrow". Fixed by classifying on the shape's own real hinge
  angle instead (`threeCellHingeAngle` -- finds whichever cell is
  adjacent to both others, computes the real angle between the two
  vectors from it): verified directly, the 4 real shapes have hinge
  angles 60 (Triangle, its own true internal angle), 90 (now correctly
  named "Right-Angle Bend"), 120 (now "Wide Bend", genuinely justified
  since 120 > 90), 180 (Straight Line). Verified live: Stage 10 now
  reads "3 Cells: Right-Angle Bend". Full `node --test
  tests/unit/*.test.mjs` clean -- pure naming/classification change, no
  behavioral surface, no new tests needed (existing N=3 tests never
  asserted on specific names, only on counts/placement behavior).

  **Real level-select screen, same day** (direct instruction, after
  hitting the gap three times live: "I think we need a level select
  opening for returning users that dont want to start from beginning
  again" / the welcome tagline's own `?stage=8` shortcut "didnt give me
  options just threw me into last few puzzles" / "I thought there
  would be a selection possible"). A new "Stages" button in
  `rhombis.html`'s topbar opens a real overlay (`#rhombis-stage-picker`)
  listing all 15 `STAGES` entries by id + name, generated directly from
  the live `STAGES` array (`populateStagePicker()`) so a stage added
  later needs no picker-specific update; the currently-open stage gets
  a highlighted border, tapping any option jumps straight there
  (`loadStage`) and closes the picker, and tapping the backdrop or the
  close button dismisses it without navigating. Verified live: 15
  options listed, jumping to Stage 12 (Tetrahedron) correctly loads
  it and closes the overlay, reopening correctly highlights Stage 12
  as current -- also visibly confirms the "Right-Angle Bend" rename
  from the fix above shows correctly in the real list, not just in
  isolation. Full `node --test tests/unit/*.test.mjs` clean (295/295,
  unchanged -- pure main-app-side navigation UI, no puzzle-state.js
  surface). This does NOT replace the separately-requested independent
  target/tray viewport work below -- it solves "let me jump to a
  specific stage", not "let me see the tray at a reasonable size".

  **Two real bug reports investigated and NOT reproduced, same day**
  ("stage 8 accepted fused piece to fill final part" / clarified to "a
  fused piece was accepted to fill final single cell"; "stage 12
  rejected a fused pair and two singles which should work"). Both
  scenarios were reproduced with EXACT clicking (a temporary debug hook
  exposing camera/renderer/current, real perspective-projection math to
  click precise screen coordinates rather than guessing pixels, removed
  before committing each time) rather than pixel-guessing, and in both
  cases the actual game state was already correct: a fused piece
  selected against a too-small remaining group is genuinely rejected
  (`placed: false`, void stays unfilled), and a genuine joined-pair +
  2-singles combination genuinely solves the puzzle end to end. Given
  the SAME session separately surfaced "as you enlarge picker pieces
  disappear" and "because they are all in a line you can only view them
  at a small size" -- the likely real explanation is imprecise manual
  taps on small/overlapping on-screen targets (a UX problem) being
  misread as logic rejections, not actual puzzle-state bugs. Worth
  re-checking once the independent-viewport work below lands and tray
  pieces are large enough to tap precisely.

  **Independent target/tray viewports, layout, and transparency --
  shipped 2026-09-04**, closing 3 of the 4 items raised in the prior
  session's open design conversation (layout, independence, and
  transparency; the 4th, tray-content redesign, remains open -- see
  below). Direct feedback driving this: "target and tray should move
  independently" (from a first-time player, "my wife played earliest
  stages"), "picker pieces should be top right target should be left
  of center", "as you enlarge picker pieces disappear", and "target
  more transparent please". Architecture: two independent
  `THREE.PerspectiveCamera`s (`camera` for the target, `trayCamera` for
  the tray) rendering the same shared `scene` via two-pass scissored
  rendering (`renderer.setScissorTest`/`setViewport`/`setScissor`/
  `clearDepth`, explicit `renderer.getPixelRatio()` multiplication since
  those calls operate in raw drawing-buffer pixels not CSS pixels, and
  WebGL's viewport Y-origin is bottom-up so the tray rect's screen-space
  top has to be flipped to `window.innerHeight - cssTop - cssHeight`
  before use). The tray sits in a small fixed-size top-right panel
  (`trayViewportRect()`, capped to `min(300, 42vw)` x `min(380, 48vh)`),
  mirrored by a real DOM div (`#rhombis-tray-panel` in `rhombis.html`,
  `pointer-events: none`, kept in sync every frame via `syncTrayPanel()`
  so the visual frame never drifts from the actual scissored region it's
  meant to outline) since the WebGL canvas itself has no way to draw a
  bordered panel chrome. Pointer routing (`regionAt()`) decides once per
  gesture (at pointerdown, or when a second finger joins for a pinch)
  which viewport a drag/pinch/tap belongs to and holds that for the
  whole gesture, so a drag that wanders outside its own starting rect
  mid-motion keeps controlling what it started controlling. Framing math
  was upgraded from a bounding-SPHERE approximation (which under-fit
  elongated/asymmetric shapes, like Straight Line's "full" piece, from a
  fixed viewing angle) to true camera-relative (anisotropic) framing --
  `cameraRelativeDistance()` decomposes each of a bounding box's 8
  corners onto the camera's own right/up basis vectors (derived from
  `CAMERA_FORWARD`/a world-up cross product, not assumed axis-aligned)
  and solves for the true minimum distance per axis, so the frame fits
  tightly regardless of shape proportions or viewing angle.

  **Two real bugs found and fixed while building this.** (1) After
  splitting into two cameras, Stage 8/12 screenshots showed the target
  clipped top/bottom -- first hypothesis was the framing math itself,
  investigated via temporary debug logging and hand-verified against
  manual trigonometry (computed distance matched the manual calculation
  exactly), which disproved a math bug. Re-examining the same screenshot
  showed piece-colored (orange) content bleeding into the target view --
  the real bug was that rendering one shared `scene` through two
  different cameras means each camera renders EVERYTHING in it unless
  objects are explicitly excluded; nothing had segregated tray pieces
  away from the target camera. Fixed via THREE.js's `Layers` system:
  `TRAY_LAYER = 1`, `trayCamera.layers.enable(TRAY_LAYER)`, every tray-
  piece mesh gets `.layers.set(TRAY_LAYER)` when parented into
  `trayGroup` and `.layers.set(0)` when moved to the target's
  `skeletonGroup` on placement (all 4 reparenting call sites: initial
  tray population, both branches of `syncVisualsToState`, and the live
  placement code). (2) Fixing that surfaced a second, related gotcha:
  `THREE.Raycaster.layers` defaults to layer 0 only and is checked IN
  ADDITION to whatever explicit object list `intersectObjects()` is
  given -- without `raycaster.layers.enableAll()`, a raycast against
  TRAY_LAYER pieces would have silently found nothing even with the
  right objects passed explicitly. Verified via a temporary debug hook
  (`window.__rhombisDebug` exposing `camera`/`trayCamera`/`renderer`/
  `current`, removed before committing) driving real perspective-
  projection math to click exact screen coordinates for pieces/voids
  rather than guessing pixels: Stage 1's full solve (tap piece, flip
  apex-down to apex-up, tap void) now reads "Solved!"; Stage 4's
  place-then-undo cycle correctly goes 12 left -> 11 left -> back to 12;
  a real pointer drag centered on the target rotates only the target
  (`skeletonGroup.rotation.y` changes) and is fully unaffected by a
  subsequent drag centered on the tray (same value before and after);
  the Stages picker still opens/lists/navigates correctly on top of the
  new layout. Full `node --test tests/unit/*.test.mjs` clean (295/295,
  unchanged -- this was a rendering/input-routing rewrite, no
  `puzzle-state.js` surface touched). `TRANSLUCENT_OPACITY` (`stages.js`)
  lowered from 0.55 to 0.35 for the "target more transparent please"
  request, verified visually against Stage 8's 3-cell target.

  **Open design conversation, not yet acted on**: a deeper game-design
  critique of the N=3/N=4 tray content itself remains unaddressed --
  "alternatives should be different configurations of four... not one
  perfect one and oddments only too obvious no skill" -- the current "N
  singles + 1 joined-pair + 1 full-solve piece" structure means the full
  piece trivializes the puzzle (tap the one obvious piece, done, no
  spatial reasoning required) while the leftover singles carry no real
  challenge either (fused pieces have no orientation concept at all).
  The suggested fix is real alternate DECOMPOSITIONS (different genuine
  sub-groupings of the N cells, not one dominant shortcut piece plus
  filler) -- echoes the project's own original Day 1 "genuine jigsaw,
  not revolve one big piece" design question. Also still open from
  earlier sessions: introducing octahedron/pyramid/tetragonal-disphenoid
  piece types as decoys ("scramble in the octahedron, pyramid, and
  tetragonal disphenoid into the mix"), making decoys more visually
  similar to increase difficulty ("making the picker tray more similar
  pieces"), the "six octahedrons could fill single RD" idea (possibly
  requiring stage reordering), decoy pieces varying in size as levels
  advance, an HUD shape-symbol icon, and an 80s-style blocky RD logo.
  None of this has been scoped or built yet.

  **Real bug found and fixed, 2026-09-04, live report "stage picker
  looks good but massive shape appears and then disappears as you try
  to manipulate... when going to any stages of actual game"**: a second,
  more subtle instance of the SAME root cause as the target/tray bleed-
  through bug above, missed the first time because it manifested as an
  intermittent visual glitch (dependent on rotation angle) rather than a
  constant one. `trayCamera.layers.enable(TRAY_LAYER)` only ADDS a layer
  to a camera's render mask, it does not REPLACE it -- a fresh
  `PerspectiveCamera`'s mask already has layer 0 enabled by default, so
  `trayCamera` was rendering BOTH the tray pieces (`TRAY_LAYER`) AND the
  full target skeleton (layer 0, untouched) the entire time. Most
  rotations/zoom levels keep the target -- much larger, positioned and
  scaled for the FULL-SCREEN target camera's own distant framing --
  outside the tray camera's own tiny, close-up frustum, so it stayed
  invisible; a rotation that swung part of the target INTO that frustum
  rendered it there hugely oversized (framed for a camera sitting close
  to a small tray-sized box), reading as a shape suddenly appearing
  massive in/around the tray corner, then vanishing again as the
  rotation continued past it. Reproduced live via a bounded rotation
  sweep (Playwright's synthetic mouse can't legally leave the actual
  browser viewport mid-gesture -- a real cursor/finger can't either --
  so the repro used repeated in-bounds swipes, not one long drag past
  the window edge, after an earlier same-session attempt with an
  out-of-bounds single drag produced a misleading false freeze that
  traced back to the test itself, not the app). Fix: `trayCamera.layers.
  set(TRAY_LAYER)` (replace, not add). This alone made the tray render
  fully BLACK (a second real bug surfaced by the first fix, caught before
  shipping): a `Light`'s own `.layers` gates which CAMERA can see it at
  all (the renderer tests `light.layers.test(camera.layers)` for lights
  same as any other Object3D, not just which objects a light
  illuminates) -- both scene lights were on the untouched default layer
  0, so once `trayCamera` no longer had layer 0 in its mask at all, it
  couldn't see the lights either, and unlit `MeshStandardMaterial` tray
  pieces render solid black. Fixed by introducing `STARFIELD_LAYER`
  (also cleanly separates the starfield backdrop itself off layer 0, so
  sharing it between cameras doesn't reintroduce the original bleed):
  both lights and the starfield get `STARFIELD_LAYER` enabled IN
  ADDITION to their existing layer (lights keep layer 0 too, so `camera`
  -- the target -- is unaffected); `trayCamera` enables `STARFIELD_LAYER`
  alongside its own `TRAY_LAYER`-only mask. Net result: `camera` sees
  {0, STARFIELD_LAYER} (skeleton/voids + stars, lit by both lights),
  `trayCamera` sees {TRAY_LAYER, STARFIELD_LAYER} (tray pieces + stars,
  lit by both lights) -- neither camera can see the other's actual
  content anymore, both share light and backdrop. Verified live before
  shipping: a full bounded rotation sweep (6 repeated in-viewport swipes,
  ~7 full turns) on both elongated N=4 stages (Stage 15, Straight Line)
  with before/after screenshots of the tray corner specifically (the
  previously-blue-tinted piece in the tray is now solid orange, con-
  firming the bleed is gone and lighting is restored); Stage 1's full
  solve (flip + place -> "Solved!"); Stage 4's place-then-undo cycle (12
  left -> 11 left -> 12 left); independent target/tray rotation (a
  target-region drag changes `skeletonGroup.rotation.y`, a subsequent
  tray-region drag leaves it unchanged); the stage picker still opens/
  lists/navigates correctly. Full `node --test tests/unit/*.test.mjs`
  clean (295/295, unchanged -- pure rendering-layer fix, no `puzzle-
  state.js` surface touched).

  **Name disambiguation, 2026-09-04**: a real, unrelated, long-defunct
  2D Windows game also used the name "Rhombis" -- direct instruction to
  make this game clearly distinguishable/separately searchable rather
  than pick a new name (no copyright found on the old game anywhere,
  and "rhombis" is a fairly generic word). `rhombis.html`'s `<title>`
  ("RHOMBIS -- 3D Puzzle Game from Rhombiverse") and a new `<meta
  name="description">` carry the actual disambiguation for search
  engines/browser tabs, which matters regardless of screen size; a small
  `#rhombis-subtitle` ("3D puzzle from Rhombiverse") was also added next
  to the in-game topbar wordmark, hidden below 600px so it doesn't crowd
  the stage name out on a phone-width topbar. `welcome.js`'s own link
  text updated to "Try RHOMBIS, our 3D intro puzzle" (was "Try Rhombis,
  a short intro puzzle") for the same reason, consistent with the
  in-game wordmark's own ALL-CAPS styling. Pure content/copy change, no
  logic touched; full `node --test tests/unit/*.test.mjs` re-run clean
  regardless (295/295).

  **Real, fundamental rendering bug found and fixed, 2026-09-04, live
  report "shape appears half out of shot in upper right and cant be
  coaxed down... when going to any stages of actual game"**: this
  turned out to be a SEPARATE, more serious bug than the camera-layers
  one above, hiding behind it. Every `renderer.setViewport()`/
  `setScissor()`/`clear()` call in the two-pass render loop was being
  pre-multiplied by `renderer.getPixelRatio()` (`const pr = ...; const
  fullW = window.innerWidth * pr; ...`) under the assumption that these
  methods take raw drawing-buffer (device) pixels -- they don't.
  `WebGLRenderer.setViewport`/`setScissor` take LOGICAL (CSS) pixel
  coordinates and apply the renderer's own tracked pixelRatio
  internally before touching the GL state. Pre-multiplying by `pr`
  meant the ACTUAL GL viewport/scissor ended up scaled by `pr` a SECOND
  time -- on any real device with `devicePixelRatio > 1` (essentially
  every phone), the tray's small rect was computed at roughly 2x its
  intended size and position, extending past the real drawing buffer's
  own bounds entirely.
  
  This was completely invisible in EVERY desktop test this whole
  session (`devicePixelRatio` 1 there, so doubling was a mathematical
  no-op), and the full-screen TARGET pass masked its own half of the
  same bug too: an oversized full-screen rect still covers the whole
  canvas either way, so only the TRAY -- the one pass where the exact
  rect actually matters -- showed any visible symptom. Reproduced for
  the first time only after deliberately testing a real mobile viewport
  + device scale factor (`deviceScaleFactor: 3`, matching a real
  phone) rather than only desktop viewports, confirmed with
  `gl.getParameter(gl.VIEWPORT)`: the live GL state was exactly 2x the
  intended tray rect in every dimension and extended past the real
  drawing buffer's actual width/height. Ruled out several other
  hypotheses first via direct evidence before finding this, in order:
  color bleed from the tray pass's `clearDepth()`-only call (disproved
  -- `renderer.autoClear` already fully clears color+depth within the
  active scissor rect on every `render()` call, confirmed by extreme-
  zoom testing showing zero bleed even with the target filling the
  whole screen); stale depth-buffer values blocking the tray's own
  geometry (disproved -- swapping to an explicit scissored `clear()`
  changed nothing); THREE's per-object frustum culling wrongly
  excluding tray pieces (disproved -- forcing `frustumCulled = false`
  changed nothing); the render call not being issued at all (disproved
  -- `renderer.info.render` showed real draw calls and triangle counts
  for the tray pass). Only checking the RAW GL viewport/scissor state
  directly surfaced the actual 2x mismatch. Fix: removed the pixelRatio
  pre-multiplication everywhere in the render loop -- `setViewport`/
  `setScissor`/`clear` now receive plain CSS-pixel coordinates
  (`window.innerWidth`/`window.innerHeight`, and `trayViewportRect()`'s
  own rect, untouched) and let the renderer handle device-pixel scaling
  itself, matching what its own API actually expects. Verified live
  after the fix: a direct pixel-level crop of the tray panel's exact
  CSS rect on a 390x844/deviceScaleFactor:3 mobile viewport shows all 5
  of Stage 9's pieces correctly lit and contained, zero target bleed;
  re-checked across Stages 1/9/15 and after real dispatched-PointerEvent
  touch-drag rotation (6 repeated swipes); re-confirmed zero regression
  on the original desktop (pixelRatio 1) test matrix used throughout
  this whole session. Full `node --test tests/unit/*.test.mjs` clean
  (295/295, unchanged -- pure rendering-pixel-math fix, no `puzzle-
  state.js` surface touched). **Lesson for this codebase going
  forward**: any WebGL viewport/scissor/rendering change MUST be
  verified against a real mobile viewport + a `deviceScaleFactor` > 1,
  not just desktop -- pixelRatio-dependent bugs are structurally
  invisible at `pixelRatio === 1` and both real bugs in this session's
  two-viewport rewrite (the camera-layers one and this one) went
  through multiple rounds of thorough-seeming desktop-only verification
  before shipping.

  **Tray shows the target through it now, 2026-09-04**: direct
  instruction after the pixelRatio fix landed and the game was playable
  again -- "cuts across shape the picker screen obscures outline...
  still view part of target shape through picker tray in the
  background, so shape is completer... but not interfere with it".
  Previously the tray pass's `renderer.render(scene, trayCamera)` used
  `WebGLRenderer`'s own default `autoClear` behavior, which fully wipes
  color (to `scene.background`) within the active scissor rect before
  drawing -- meaning the target's own already-rendered pixels behind the
  tray panel were always replaced with plain background, reading as a
  hard cut rather than a continuation of the shape. Fix: `renderer.
  autoClearColor = false` for just this one `render()` call (restored
  to `true` immediately after, since the NEXT frame's full-screen target
  clear still needs it), while `renderer.clearDepth()` still runs
  explicitly beforehand as before -- the target's color stays as a
  backdrop, dimmed by the tray panel's own translucent DOM background
  (`rgba(8,10,16,0.35)`), while the tray's own pieces still draw fully
  opaque on top via a genuinely fresh depth buffer, so they're never
  visually mixed with what shows through around them. Verified live: a
  rotated Stage 12 (Tetrahedron) shows its blue shape continuing
  unbroken behind the tray corner while the tray's own orange pieces
  stay crisp and undisturbed; re-confirmed the pixelRatio fix above
  still holds (mobile viewport + `deviceScaleFactor:3`, Stage 9's tray
  still fully correct) since this change touches the exact same render
  passes. Full `node --test tests/unit/*.test.mjs` clean (295/295,
  unchanged -- pure rendering-state change, no `puzzle-state.js` surface
  touched).

  **Piece identity: numbers, per-piece color, placement flash --
  2026-09-04**: direct instruction after a real live report ("my wife
  was frustratedly stabbing screen with finger" -- after placing a
  piece, whatever showed in that tray slot next could look near-
  identical to the one just placed, with nothing on screen
  distinguishing "stuck, unplaced" from "genuinely a different piece").
  Three complementary fixes, all suggested directly, all hooked in from
  ONE shared call site (`loadStage()`'s own piece-population loop) so
  every stage gets them uniformly without touching any of the 7 stage-
  builder functions individually:
  - A stable per-piece number badge (`makeNumberSprite()`, `main.js`) --
    a canvas-texture `THREE.Sprite`, always billboard-faces the camera
    regardless of how the tray itself gets rotated, unlike a flat 3D
    label would. Positioned from the geometry's own real bounding BOX
    (not a bounding-sphere-radius offset from local (0,0,0) -- caught
    live before shipping: the pyramid-based cube/RD-face pieces have
    their local origin at their own BASE, not their visual centroid, a
    known quirk from Stage 4's own build notes, so an origin-relative
    offset landed the badge floating in empty space for those). Hidden
    once that piece is actually placed (no longer "a piece to tell
    apart"), shown again on undo.
  - A distinct hue per piece (`applyPieceIdentity()`) -- an even
    rotation around the piece color's own hue by `360/total` degrees
    per index, so no two pieces in the same tray are ever the same
    shade, readable before the number even needs reading. Each piece
    mesh already has its own fresh `MeshStandardMaterial` instance
    (`pieceMaterial()`, `stages.js`), so recoloring here is a local
    change with no cross-piece side effects.
  - A "Placed!" flash inside the tray panel itself (`#rhombis-tray-
    flash`, `rhombis.html` + `flashTrayPlaced()`, `main.js`) -- feedback
    shown right where attention already is (the tray), not just the
    bottom HUD text that's easy to miss mid-play. Skipped when the
    placement also solves the stage (the "Solved!" banner is already
    strong enough on its own).
  Verified live: Stage 9's 5-piece tray shows 5 genuinely distinct
  colors/numbers at both desktop and a real mobile pixel ratio (re-
  confirming the earlier pixelRatio fix still holds against this new
  sprite geometry); a real Stage 4 placement (flip-cycle + place) shows
  the flash and reveals piece "2" in a clearly different color from
  piece "1"'s. Full `node --test tests/unit/*.test.mjs` clean (295/295
  -- pure visual/rendering addition, no `puzzle-state.js` surface
  touched).

  **Drag-to-orient: a real second way to reach an orientation --
  2026-09-04**: direct instruction, explicitly framed as the biggest,
  most wide-sweeping change requested this session ("i know this may be
  the biggest widesweeping array of fixes, but it is important for
  playability") -- "should be three ways of matching orientation: 1.
  you tap (as now) 2. you revolve picker shape 3. you revolve target...
  there shouldn't be a shape full of red when you have a piece that
  fits perfectly anywhere depending on rotation". Before this, dragging
  the tray or target was PURE camera movement -- the only way to
  actually change a piece's orientation was the abstract tap-cycle
  (`flipPiece`), which is why a piece that could fit several voids (at
  different orientations) showed every void except its current one as
  flat red: "no", not "not yet, keep looking". Presented two concrete
  implementation options before writing any code (real drag-to-orient
  vs. just softening the red/green feedback) -- direct instruction
  picked the bigger one.
  - `puzzle-state.js` gained `setPieceOrientation(state, pieceId,
    orientationKey)` -- a second real way to reach any of a piece's own
    `orientationOptions` besides stepping through `flipPiece()` one at a
    time, reaching the exact same states, just settable directly (6 new
    unit tests, including one proving it reaches the SAME final state
    `flipPiece` would after equivalent steps).
  - `main.js`: a tray-region drag with a FLIPPABLE piece selected
    (`selectedFlippablePiece()`) now spins THAT piece's own mesh
    (`mesh.rotation.x/y`, no pitch clamp -- unlike the ordinary group-
    rotation branch, a piece may need to reach a fully upside-down pose,
    and clamping pitch would make that unreachable by dragging alone),
    not the whole tray view. Every pointermove during that drag computes
    which of the piece's own `orientationOptions` keys is angularly
    NEAREST to its current live rotation (`Quaternion.angleTo`) and,
    only when that nearest key actually CHANGES, commits it via
    `setPieceOrientation` and re-renders the void highlights + HUD text
    live -- this is what makes the "wall of red" sweep to green AS you
    rotate, not just once on release. `animate()`'s own per-piece slerp-
    toward-canonical-pose is suppressed for whichever piece is being
    drag-oriented (`orientDragPieceId`), so the drag has uncontested
    control while active; once released, that suppression lifts and the
    SAME pre-existing slerp naturally glides the piece from wherever the
    drag left it to the exact canonical pose of the committed
    orientation -- a "settle into place" snap animation for free,
    reusing the existing mechanism rather than writing a new one.
    Rotating the TARGET stays pure camera movement, unchanged -- already
    a real (if indirect) way to compare a void's required pose against
    however you're currently holding the piece, satisfying the third
    "way" without needing new logic there. Tap-to-flip is fully
    unchanged and still works as a fallback.
  - Two real bugs found and RULED OUT during verification, both the
    exact same root cause as an earlier bug this same session (Playwright/
    a real cursor cannot move the pointer beyond the actual browser
    viewport mid-gesture) -- an orientation that appeared to "change on
    its own" during a later click traced back to an EARLIER test drag
    whose own coordinates ran off the right edge of a 1000px viewport
    (the tray sits near that edge already), silently dropping the
    browser's own `pointerup` and leaving `orientDragPieceId` stuck
    active into the NEXT gesture. Confirmed via direct tracing
    (`document.elementFromPoint` returning nothing at the drag's final
    off-screen position) before concluding it wasn't the feature's own
    code -- neither report reproduces with a properly viewport-bounded
    drag.
  Verified live: a full bounded drag on Stage 4 sweeps through 3 real
  orientations and PLACES successfully with zero taps at all; tap-to-
  flip still solves Stage 1 end to end unchanged; dragging the TARGET
  with a piece selected still only rotates the camera view (piece
  orientation provably unchanged); real dispatched-PointerEvent touch
  dragging (mobile) reaches a valid orientation and cleans up its own
  drag-tracking state correctly on release. Full `node --test tests/
  unit/*.test.mjs` clean (301/301 -- 295 + 6 new `setPieceOrientation`
  tests).

  **Stage 11 "rejecting valid solution of two conjoined and 1 single" --
  investigated and NOT reproduced, same day**: reproduced the EXACT
  scenario with precise coordinate clicking (place the joined-pair,
  then the matching single into the one remaining open cell) and it
  genuinely solves the puzzle end to end (`isSolved` true). The likely
  real explanation, confirmed by first getting the SAME rejection myself
  before fixing my own test: in an N-cell stage, the tray's singles are
  NOT freely interchangeable duplicates the way Stage 3's cube pieces
  are -- each specific single piece (`single-0`, `single-1`, ...) is
  tied to ONE specific cell's own group and will always be rejected
  against every other cell's void, even though every single looks
  generically the same (now visually distinguished by the piece-
  identity work directly above, which may on its own reduce this
  particular confusion going forward). Not something to silently fix by
  loosening the group-match rule -- that would let a single count toward
  the wrong cell, which is real, load-bearing solve logic, not a bug.
- **Phases 1–4** (renderer, build tool, local persistence, public deploy)
  — done, live.
- **Phase 5** (Shared World / Supabase realtime sync) — done, opt-in
  toggle, local single-player is still the default.
- **Phase 5.5** (Planetoid Building + Radial Gravity) — done, plus all
  four addenda (Water/Ice, Black Hole, Star System, Supernova).
- **Phase 5.8** (Trust Zones/Moderation) — done, **deliberately,
  intentionally partial**: the flagged/removed Report mechanism works;
  a three-tier reachability gate, age/mode selector, COPPA review, and
  moderator-scaling are explicitly deferred with documented reasons, not
  left incomplete by oversight.
- `RHOMBIVERSE_SPEC_REGIONS.md` (ownership claims), `_ASTEROIDS.md`
  (mining/resources), `_TRADE_INVENTORY.md` (barter/decay),
  `_LOOPHOLES.md` (cross-spec gap patches) — all done.
- **Phase 6** (Penrose/RT Growth Layer) — done, both waves (Wave 1:
  `amoeba`/`moss`/`fungus`/`fern`; Wave 2: `sapling`/`conifer`/`shrub`/
  `nautilus`/`scallop`/`spineling`/`cluster-frame`).
- **`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md`** — done, all 9 stages
  (genome/phenotype → reproduction/HGT/sexual selection →
  environmental selection → deterministic catch-up engine → trophic
  coupling → isolation enforcement → adaptive damping → moderation hook
  → player-facing surface). `src/world-systems/evolution.js`.
- **`RHOMBIVERSE_SPEC_ANIMALS.md`** — done, all 6 stages (species/
  habitat, mobility, sexual reproduction, trophic herbivory/carnivory,
  habitat crossover, full verification). `src/world-systems/animals.js`.
- **`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md`** — done, all 6 stages (static
  sub-lattice geometry → camera-distance trigger → multi-level depth &
  blending → adaptive damping → real-organism/plant-coverage rendering
  → landscape aggregate state). `src/geometry-extensions/latticezoom.js`, wired into
  `src/render.js`.
- **Showcase world** — done, `data/presets/showcase-world.json` (a real
  continental planetoid with growth, evolved organisms, and animals),
  loadable via the `#preset-select` dropdown.
- **Spherical Toggle** (2026-09-01, `docs/RHOMBIVERSE_SPEC_ADDENDUM_SPHERICAL_TOGGLE.md`)
  — **Stage 1 only**: classification + superellipsoid math
  (`src/geometry-extensions/spherical-toggle.js`, pure/THREE-free, unit
  tested against this repo's own real vertex generators, not just the
  spec's illustrative numbers — a real numeric error in the spec's own
  Truncated Octahedron volume-matched-sphere constant was caught and
  fixed during review, 1.9695 -> 1.1371) wired into a HUD toggle
  (`#spherical-toggle`, `render.js`), reachable via the persistent HUD
  Wheel (`hud-wheel-3d.js`, replaced the last Duality-duplicate face).
  Covers every real placeable piece type (RD, Octahedron(gap), Cube,
  Cuboctahedron, Truncated Octahedron, Disphenoid — Disphenoid and Cube
  are their own per-cell Meshes, not InstancedMesh, so each has its own
  swap code path, see `sphericalClassificationFor`'s own header and the
  toggle handler's Cube/Disphenoid blocks). Direct instruction
  (2026-09-01): stay strictly to **sphere or superellipsoid**, no third
  `volumeSphere` render mode (it isn't a different shape anyway, just a
  different radius choice for a sphere). Cuboctahedron is the one
  superellipsoid; everything else is a plain sphere.
  Two real rounds of live-build feedback the same day reshaped the
  radius choice per shape, both grounded/verified before landing (see
  `tests/unit/spherical-toggle.test.mjs`, 220/220 passing):
  1. Truncated Octahedron ("spheres obviously too small") — its solved
     superellipsoid exponent (n≈1.585 < 2) pinches the shape down to
     0.866×R everywhere off-axis, unlike Cuboctahedron's n≈2.71 which
     bulges outward past R. Switched to a plain sphere at the same R
     (the real axis-face touching distance).
  2. RD/Cube/Octahedron ("RD slightly too small" / "cube and
     cube-octahedron slightly too big") — confirmed a systematic
     pattern: face-plane-distance R is the SMALLEST possible measure of
     a faceted shape's size, so it reads undersized across the board.
     Switched RD/Octahedron(gap)/Cube from face-plane R to a
     volume-matched R (still just a sphere, sized by real volume
     instead) — real volumes grounded in this repo's own decomposition
     (RD = cube+6-pyramids = 2·scale³; Octahedron = (4/3)·r³ at
     r=0.5·scale = scale³/6; Cube = scale³ trivially), independently
     re-verified from raw vertex data in the test file, not just
     algebra. Cuboctahedron's own superellipsoid was deliberately left
     unchanged — by the same "real vertices reach past face distance"
     analysis it's likely already undersized in absolute terms too, so
     "too big" there most likely reads as a relative effect against
     RD's now-corrected size, not an independent CO bug; flagged for
     DICTO to re-check once RD's fix is live rather than guessed at
     further. Disphenoid was also deliberately left at face-plane R
     (its own volume-matched R would be a ~54% jump — a much more
     elongated shape, no real feedback yet that it reads wrong, and
     that big a jump risks visible clipping through its own real faces).
  **NOT yet done**: Sculpture Mode's own mesh, Lattice Zoom's
  sub-lattice/aggregate-speckle meshes (both reuse RD's own geometry
  builder at other scales, out of scope for this stage), and Section 4
  (disphenoid-ring -> torus, explicitly deferred by direct instruction
  — disphenoids still convert individually, just never merged into a
  torus). Not yet confirmed in a live browser (no Playwright/npm
  available in this session's environment) — verify visually, esp.
  whether Cuboctahedron still reads oversized after this round, before
  treating Stage 1 as fully done.
- **Rhombic Wheel 3D** (2026-08-25, `src/app/rhombic-wheel-3d-core.js`/
  `rhombic-wheel-3d.js`) — the sole navigation surface now, on the real
  RD mesh. The old 2D radial menu (`wheel.js`) was fully removed the
  same day, per direct user decision — not flag-gated, deleted. No
  feature flag on the 3D wheel either; it's load-bearing, not optional.
  Real material/generator/species picker overlays and the drag-
  placement toggle survive the removal in `src/app/wheel-pickers.js`
  (extracted out of `wheel.js` before deletion so the 3D wheel's real
  functionality didn't depend on a file about to disappear). Tab/Space/
  `#hud-wheel-cue`/Escape all reclaimed to drive the 3D wheel directly.
  Home/Construct/Build/Alter/Rhombitect/Cultivate/Trade all real and
  reachable; department faces wired to real actions (mode-btn clicks,
  the real pickers), not placeholders, except Spiral Column/Templates
  and Pattern (genuine stubs — Pattern matches the *old* 2D wheel's own
  "coming soon" placeholder, not withheld functionality) and Replace
  (discovered broken in the 2D wheel too, before it was removed — no
  implementation anywhere). Full rationale:
  `docs/code-notes/app/rhombic-wheel-3d.md`.

Building the showcase world (2026-08-14) surfaced and fixed three real
performance bugs in `evolution.js`/`worldstate.js` (unbounded population
growth, and two O(n) registry/geometry recomputations hit inside O(n²)
loops — see that commit's own message for full detail). The real
worst-case timing improved ~40s→~2s, verified via `node --test`. A
live-browser crash still reproduced afterward under headless/software
(SwiftShader) rendering in this session's own sandboxed dev environment
— **root-caused and confirmed resolved same day**: retested headed,
against a real GPU via the actual X display (`DISPLAY=:0`, not headless),
and the exact same scenario that reliably crashed headless stayed at
2–34ms round-trip latency for a full 20s hold-still with zero issues.
The crash was a headless/software-rendering artifact of this dev
sandbox, not a real app bug reachable by an actual player on a normal
GPU-accelerated browser.

Full reasoning, every tuned constant's derivation, and every real bug
found is in `git log`/the GitHub repo history itself (already pushed) --
this section states what's CURRENTLY true, it does not narrate how it
got there. If you need the story behind something, `git log --oneline`
and the commit bodies are the real record, not a second markdown file
duplicating them.

**Design idea flagged for the wider app, not yet implemented outside
Rhombis** (2026-09-03, reinforced twice by direct user suggestion the
same day): Rhombis' selected-piece validity highlighting
(`src/rhombis/main.js`'s `refreshVoidHighlights()`, `puzzle-state.js`'s
`voidValidityForPiece()`) recolors every open target red or green,
live, for whatever's currently selected/held -- not just a flash after
a rejected action. **Priority candidate: the pyramid/BCC sub-piece
placement system** (`core/pyramid.js`'s `resolvePyramidAxisForHit`/
`resolvePyramidClickOnExisting`, `core/build.js`'s piece-tier-aware Add/
Remove) -- the user specifically named this area ("could really help in
Rhombiverse for all smaller pieces") after separately reporting live
"hit or miss" placement/removal behavior with the Pyramid piece tier.
That report led to a real, now-fixed bug the same session -- see
`docs/code-notes/core/pyramid.md`'s own "Second real live report,
2026-09-03" section for the full repro/root-cause/fix, not narrated
twice here. This is also the module with the longest real
bug history in the repo (`git log --oneline -- src/core/pyramid.js`:
multiple "last pyramid bonds outward instead"/"stray pyramid placed
elsewhere" regressions), making it the highest-value place to try a
live green/red hover-or-selected preview rather than only reacting
after a click lands wrong. Other plausible spots: Build/Piece:TO
placement generally, Sculpture Mode's symmetry/mirror preview, region/
claim-boundary editing. Nobody has scoped or built any of this yet --
still a flagged idea, not a task in progress.

## Read this before touching anything

- **No build step, by design.** `index.html` loads Three.js via an ES
  module import map from a CDN — no npm/webpack/vite. This is a direct
  application of Grounded Simplicity (`docs/RHOMBIVERSE_PRINCIPLES.md`
  section 0): the simplest thing that still works, and it keeps the repo
  trivially deployable as static files (GitHub Pages / Vercel, Phase 4).
  Don't introduce a bundler unless a real requirement forces it.
- **The world is data, not baked geometry** (`RHOMBIVERSE_PLAN.md` section
  0, the "golden rule"). Every mechanic in every spec extends the same JSON
  world-state additively — new top-level keys (`planetoids`, `claims`,
  `asteroidBelts`, `playerInventory`, `pendingTrades`) or new per-cell
  fields, never a breaking schema change. If an implementation task seems
  to require restructuring existing schema fields, stop and re-read the
  relevant spec — that's almost certainly not what's being asked for.
- **`RHOMBIVERSE_PRINCIPLES.md` governs every other doc and is not optional
  reading.** Three binding laws, in order of precedence:
  1. **Grounded Simplicity** — borrow real physics or established
     convention over inventing something arbitrary; prefer the simplest
     version that still works. Applied throughout: FCC crystallography,
     white-dwarf-density-as-gravity (Blackstar-Glassite), Schwarzschild
     asymptotic behavior (black hole), Chandrasekhar-limit detonation
     (supernova), icy-moon subsurface oceans (Ice 9.9).
  2. **Isolation** — any subsystem that can go unstable must define its own
     bounded **blast radius**; a local problem never propagates world-wide.
  3. **Adaptive Damping** — correction/tolerance mechanisms must widen
     (boundedly) with repeated correction and decay during calm periods,
     not use a single fixed threshold forever. Reused verbatim (not
     reinvented) by black hole cost-scaling, supernova threshold approach,
     asteroid population-scaled spawning, and inventory decay.
  Every future spec is expected to state its blast radius and its
  volatility/decay tuning explicitly, the same way "Success Checks"
  already is a required section.
- **`shellCount(n) = 10n² + 2`** (FCC shell size at radius `n`) is the one
  formula reused across nearly every subsystem: core-cavity sizing
  (gravity), recentering-shockwave tolerance (gravity), asymptotic
  space-generation cost (black hole), asteroid node internal shape, claim
  allocation shell-filling (regions). Implement it once, import it
  everywhere — do not let a second spec quietly reimplement it.
- **12-neighbor FCC adjacency** is the other universal primitive: valid
  cell = `(x,y,z) ∈ ℤ³` where `x+y+z` is even; 12 offsets in
  `RHOMBIVERSE_PLAN.md` section 2. Lattice propagation (hydrosphere
  permeation), shell counting, and claim allocation all walk this same
  offset table — implement it once in `src/core/lattice.js`.
- **"region" is two unrelated fields — do not conflate them.** The per-cell
  `region` field (`RHOMBIVERSE_PLAN.md` Phase 5.8) is a *moderation*
  status (`core`/`reviewed`/`open`). Ownership is a separate field,
  `claimId` (`docs/RHOMBIVERSE_SPEC_REGIONS.md`). A cell can have both at
  once; they answer different questions. This collision is called out
  explicitly in the regions spec — read it before touching either field.
- **`destructible` is a single flag with two effects, not two flags.** It
  lives on a `claims` entry (not per-cell) and gates both block-destruction
  *and* entity-pull consent for that claim (the entity-pull gap was a
  loophole fixed in `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` section 5 — don't
  add a second consent field for entities, extend the existing one).
- **Cross-player black hole/supernova consumption is never allowed, full
  stop — binding direct instruction, 2026-08-12.** Not opt-in, not
  `destructible`-gated: `blackhole.js`'s `applyBlackHoleConsumption` and
  `supernova.js`'s `detonate` both skip any candidate cell whose
  `authorId` (stamped from Supabase's `author_id` column by `sync.js`,
  merged into cell data client-side) differs from the black hole/star's
  own sticky `coreCell.authorId`. This predates and is independent of
  Phase 5.8's eventual region/claim/consent system — treat it as a hard
  floor Phase 5.8 builds on top of, not something Phase 5.8 introduces.
  Any future consumption-adjacent mechanic (new spec, new material) must
  preserve this check, not bypass it.
- **Decay-reset and multi-account loopholes are spec-acknowledged, not
  spec-solved.** `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2 explicitly
  states multi-accounting has no full spec-level fix (needs platform-level
  account verification, out of scope). Don't write code or comments
  implying it's solved — document it as a known gap, per that spec's own
  instruction.

## Core vs. Modules

`RHOMBIVERSE_PLAN.md`'s "Core vs. Modules" section has the full
architecture and Migration Path; this is the short version for staying
inside the boundary while coding.

- **Core** (`src/core/lattice.js`, `src/core/sculpture.js`,
  `src/core/build.js`, `src/render.js`, `src/core/worldstate-core.js`,
  `src/core/persistence.js`) must never import from or depend on World
  Systems modules (mining, trade, regions, achievements, animals,
  hazards, hydrosphere). If a change to core seems to require such a
  dependency, stop and flag it rather than adding the import. **As of
  2026-08-23 (Migration Path Phase A) this is enforced for build.js/
  sculpture.js/worldstate-core.js**: none of them statically import
  `asteroids.js`/`regions.js` anymore — `render.js` injects the real
  functions (gated behind `features.js`'s `mining`/`economy` flags) via
  a constructor param (build.js) or each module's own
  `setRegionsIntegration()` (sculpture.js/worldstate-core.js/gravity.js).
  `render.js` itself is the one exception, and deliberately so — it's
  the app's own orchestrator (not yet split into a separate
  `render-core.js`/`index-orchestrator.js`, see `RHOMBIVERSE_PLAN.md`'s
  Migration Path Phase B), so its own direct World-Systems usage is
  expected, not a violation — though as of 2026-08-24 that usage is
  ALSO flag-gated end-to-end (`FEATURES.mining`/`economy`/`hazards`),
  closing what used to be an open gap here. Don't add a *new*
  Core→World-Systems dependency in any of the other five files.
- **The dual cube/octahedron structure exists now** (`src/core/dual.js`,
  merged 2026-08-23) — it's part of core, not optional, load-bearing,
  not gated behind a flag (`FEATURES.dualSculpture` exists but only
  controls whether the Sculpture Mode UI for it shows, per that flag's
  own comment). Don't confuse it with the separate, unrelated Duality
  Mode (`render.js`, Duality toggle), which shows the aperiodic
  Penrose-tiling shadow a structure casts, not a cube/octahedron dual
  mesh.
- New continuously-simulated functionality belongs in World Systems,
  gated behind a flag in `features.js`, defaulted to `false` for
  anything genuinely new, and loaded via dynamic `import()` — not wired
  into core's always-on path. (`features.js`'s existing World Systems
  flags default to `true`, not `false` — deliberate, since those are
  already-shipped live features; see that file's own header comment
  before changing any of them.)
- World-Systems PRs and modules are welcome and can be owned/maintained
  by other contributors independent of core.

## Build order (full detail in `RHOMBIVERSE_PLAN.md` section 4)

Phases 1–4 are the base build (solo, local, becomes public/static
once deployed). Phase 5+ and the spec addenda layer on progressively:

1. **Lattice + Renderer** — one RD renders, camera orbits. No interactivity.
2. **Build Tool** — face-picking raycast, click to add/remove cells.
3. **Local Persistence** — `localStorage` save/load, JSON export/import.
4. **Deploy Publicly** — static deploy (GH Pages/Vercel), still single-player.
   *`docs/RHOMBIVERSE_COMPLIANCE.md`'s "Required before Phase 4" checklist
   (LICENSE, ToS, Privacy Policy, SECURITY.md, XSS audit) must be done
   before this phase ships, not after.*
5. **Shared World** (optional) — swap persistence backend to realtime sync.
   DONE, 2026-08-12 (see status above) — Supabase `public.cells` table +
   `src/app/sync.js`, gated behind an opt-in toggle (local single-player play
   is still the default and fully unaffected when it's off).
5.5. **Planetoid Building + Radial Gravity** — DONE, commit `30cd1c8` (2026-08-11,
     see status above), except crystal-growth (intentionally deferred to
     Phase 6 timing). `docs/RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`.
     Also unlocks four addenda, whose REAL dependency order is not the
     order the docs list them in: **Water/Ice → Black Hole → Star System
     → Supernova** (Star System hard-depends on Water/Ice's hydrogen/
     oxygen; Supernova depends on both Star System and Black Hole).
     - Water/Ice (`SPEC_WATER_ICE.md`) — DONE, commit `ce528da` (2026-08-11).
     - Black Hole (`SPEC_BLACKHOLE.md`) — DONE except the Phase 5.8-
       dependent cross-player consent model, deliberately scoped for
       single-player per direct instruction (see status above).
     - Star System (`SPEC_STAR_SYSTEM.md`) — DONE (2026-08-11, see status above).
     - Supernova (`SPEC_SUPERNOVA.md`) — DONE (2026-08-11, see status above). All four addenda complete.
5.8. **Trust Zones / Moderation** — region moderation states + review
     pipeline. DONE, deliberately partial (see status above).
     `docs/RHOMBIVERSE_SPEC_REGIONS.md` (ownership claims) and
     the asteroid/trade specs assume this exists — implement before those
     if working out of order. *`RHOMBIVERSE_COMPLIANCE.md`'s Phase 5.8
     checklist includes a real COPPA review if minors may use the app —
     legal, not just technical.*
6. **Penrose/RT Growth Layer** (v2) — additive-only `growth.js`, does not
   modify `build.js`. DONE, both waves (see status above).
7. **UI/UX overhaul** (`docs/RHOMBIVERSE_UIUX_BUILD_PLAN.md`, tracks
   B1–B7) — a later, separate build plan layered on top of everything
   above once the core mechanics were all in place. B1–B6 DONE (see
   status above); B7 not started.

`docs/RHOMBIVERSE_SPEC_ASTEROIDS.md` (mining/resources) and
`docs/RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` (barter/decay) extend Phase 2's
build/delete tool and can be built any time after it, independent of the
5.x gravity/moderation track — DONE (see status above). `docs/
RHOMBIVERSE_SPEC_LOOPHOLES.md` patches gaps across five other specs — DONE,
already applied.

## Compliance

`docs/RHOMBIVERSE_COMPLIANCE.md`'s Phase 4 checklist (`LICENSE`,
`TERMS.md`, `PRIVACY.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`CONTRIBUTING.md`) is done — all present at repo root, the app is
publicly deployed. Any NEW backend-auth/rate-limiting/GDPR-relevant
surface added going forward should be checked against that doc directly,
not assumed pre-cleared by this note.
