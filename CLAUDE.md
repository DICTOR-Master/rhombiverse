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

  **Stage 4 is currently a manual-orientation PROTOTYPE, not the
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

  Not yet re-verified live end-to-end for a full 12-piece solve (the
  select-flip-place LOOP was confirmed once, real placement, real
  count decrement, correct snap) -- pending the user's own hands-on
  "feel it out" pass before deciding whether to keep, tune (e.g. a
  smarter cycle order, or fewer discrete steps), or revert to Stage 3's
  auto-snap style. Stage 3, 5, 6's loose pieces are UNCHANGED
  (still auto-snap) -- this prototype is deliberately scoped to Stage 4
  only, per the direct instruction.

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

  Full `node --test tests/unit/*.test.mjs` clean (275/275) after both
  fixes -- both are pure THREE-rendering/raycasting-side changes, no
  `puzzle-state.js` edits.
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
