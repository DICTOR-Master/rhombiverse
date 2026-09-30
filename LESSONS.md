# Rhombiverse — Lessons Learned

Curated, not chronological. Extracted from `CLAUDE.md`'s own build-log
history on 2026-08-14, right before that history was cut from `CLAUDE.md`
down to current-state-only (git log has the full narrative if you need
it — this file exists because git log doesn't organize anything, and the
routine "level 3 done" entries buried the genuinely reusable material).

Grouped by theme. Skip around; nothing here depends on reading the rest.

## Debugging methodology — reach for real execution before guessing

- **When code review says "this looks right" but a bug report says
  otherwise, exercise the real code, don't keep re-reading it.** A
  reported "Fill mode only removes cells" bug was never reproducible
  through the actual code path once actually driven with a real
  raycast/click simulation — the report was wrong, not the code. The
  SAME investigation, using the SAME harness, found a real, different
  gap review had missed (`onCellClicked`'s pre-mutation-state timing
  bug). Static reading can be wrong in both directions — don't trust it
  alone either way.
- **Portable Node.js + the real npm package, no root needed.** When a
  bug needs exercising pure CPU-side logic (raycasting, world-state
  mutation) with zero WebGL/DOM dependency: download a portable Node
  binary to a scratch dir, `npm install` the exact same package version
  the app's import map uses, then import the REAL project source files
  via absolute paths against it. A real `EventTarget` stands in for
  `renderer.domElement`; project a target position through the real
  camera matrices to compute the correct synthetic click coordinate
  rather than guessing pixel values. Reusable any time a reported bug
  can't be resolved by reading code (`browser-test-harness` skill,
  Harness 1).
- **Portable Python venv + Playwright + cached Chromium, no sudo.** For
  anything Harness 1 can't reach — real WebGL rendering, pointer lock,
  real click/keyboard dispatch. `~/.cache/ms-playwright`'s downloaded
  Chromium persists across sessions even though the venv itself is
  ephemeral. Known CDP limitation: a synthetic Escape keydown does NOT
  release pointer lock (tied to genuine trusted input) — call
  `document.exitPointerLock()` directly to simulate what a real Escape
  does instead.
- **A `node --cpu-prof` flame profile beats guessing at "what's slow."**
  When a scenario is reproducibly slow (a real crash after ~40s), don't
  theorize about which function is the culprit — run `node --cpu-prof`
  against an isolated repro script and read the actual self-time
  ranking. Found a getter's own defensive object-copy was ~40% of total
  time, not the O(n²) algorithm everyone would have
  guessed first. Re-profiling after each fix showed the NEXT bottleneck
  directly rather than guessing whether more work was needed.
- **A green test run proves the test passed, not that the deployed code
  is what ran.** A Playwright run against the LIVE production site
  reported success for a feature — but the actual `render.js` changes
  had been written and unit-tested yet never committed and pushed, so production was silently still
  running the old code the whole time. "Zero console errors" said
  nothing about whether the right code was even live. Check what's
  actually deployed before trusting a live-site test result.
- **A plausible-sounding CLI failure deserves a direct API query before
  chasing theories.** A Vercel deploy silently stuck at `BLOCKED` with no
  useful CLI output led to two wrong theories (account mismatch, SSO
  protection) before a direct `GET /v13/deployments/:id` revealed the
  real, documented reason in one call (`readyStateReason`). When a tool's
  own UI/CLI is silent, go straight to whatever API/log actually has the
  answer rather than guessing from symptoms.
- **A geometric/overlap bug needs a REAL independent geometric check, not
  the same weak check the buggy code already used.** A centroid-equality
  dedup check could never catch two *different*, non-identical tiles
  occupying overlapping space — found only once a real 3D
  separating-axis test (SAT) against actual vertices was run
  independently. The existing unit test had the same blind spot as the
  code (compared centroid keys), so it couldn't have caught the class of
  bug either — fixed by replacing the test's own check, not just the
  implementation.

## Real bugs found, and the general lesson each one teaches

- **A raw constant ported from a different project's own scale context
  can be silently wrong by a constant factor even when its ratio/shape
  is correct.** RD cell size was ported directly from a sibling project's
  own `WORLD_SCALE`-relative constants — the cube:octa 2:1 shape ratio
  was right, the absolute magnitude was 2x too large for tiling flush
  against this project's own unit lattice spacing. Fixed by solving the
  real geometric constraint (where do three neighbor-offset perpendicular
  bisector planes actually meet) rather than trusting the ported number.
  Always re-derive scale from the real constraint when porting geometry
  across projects with different unit conventions.
- **`InstancedMesh.raycast()` caches its `boundingSphere` lazily, once,
  and never auto-invalidates it.** Found by reading three.js's own
  source directly rather than guessing — the first-ever raycast call
  froze a tiny sphere around whatever few instances existed at that
  moment, silently dropping every later click outside it regardless of
  `mesh.count`. Call `computeBoundingSphere()` after every rebuild —
  compute the real geometry, don't estimate.
- **An HTML `max` attribute on a number input is a pure UI hint — typing
  past it does nothing unless you also clamp in JS.** A user could type
  an arbitrary shell count that would have attempted to fill ~200k+
  cells against a real budget. Client-side validation attributes are not
  enforcement.
- **A per-fragment GPU clipping plane's position and orientation must
  stay independently computed, even when folding them together looks
  like a shortcut.** An early section-view implementation folded the
  "flip which side is clipped" state into the plane's own POSITION
  calculation — would have shifted the plane's actual location depending
  on flip state instead of only changing which side gets clipped. Keep
  independent geometric parameters independent.
- **`shellCount(n) = 10n²+2` grows quadratically — an eager candidate-
  materialization loop bounded by a "looks generous" constant can hang a
  real browser.** A search bounded at 300 shells tried to eagerly build
  ~90 million candidate records before checking even one; Playwright's
  own click timeout is what surfaced the freeze. A bound that looks safe
  in isolation needs to be checked against the actual growth formula, not
  just "seems big enough."
- **A defensive object-copy inside a getter, called repeatedly inside an
  already-O(n²) loop, silently turns it into O(n³) with a heavy constant
  factor.** A registry getter returned `{ ...collection }` on every
  call — correct and safe (every mutation already used
  copy-on-write reassignment, never in-place mutation), but expensive
  when re-fetched repeatedly within an O(n²) check. Fixed by memoizing the copy and invalidating only on real
  mutation — same external safety guarantee, O(1) between writes instead
  of O(n) every read. Found via `node --cpu-prof`, not guessed.
- **Headless/software (SwiftShader) Chromium rendering can produce a
  real, reproducible crash under sustained load that a real
  GPU-accelerated browser session never hits at all.** After fixing
  three real algorithmic bugs, a scenario still reliably crashed headless
  Chromium with a suspiciously FIXED timing (~42s) that didn't scale with
  scene complexity — the tell that it wasn't algorithmic. Retesting with
  `chromium.launch({ headless: false })` against a real X display: 2-34ms
  round-trip latency, zero issues, for the same test duration that
  crashed headless. Before concluding a sustained-load performance
  problem is a genuine app bug, retest headed against a real display if
  one is available.
- **A UI panel that grows past the viewport with no `overflow-y`/
  `max-height` can make later-added controls literally unreachable in a
  REAL browser, not just a layout nitpick.** A shorter panel never
  triggered it; a later feature that made the panel longer surfaced a
  latent gap unrelated to that feature's own logic. Worth checking
  scrollability whenever a control panel gains new rows, not just when
  something visually looks cut off.

## Design patterns that paid off (reuse, don't reinvent)

- **A copy-on-write registry (`{ ...collection }` reassignment, never
  in-place mutation) plus an optional `hooks: {onAdd, onRemove}` callback
  is the one correct integration point for a feature that needs to
  observe every mutation without the core module knowing that feature
  exists.** Confirmed by grep that
  literally every mutation path already funneled through the same two
  methods before relying on it as the single hook point.
- **Explicitly flag a known, deliberate limitation in code/docs rather
  than silently working around it or hiding it.** This project's own
  `check_expected()`-style pattern (a test that reports a known gap
  clearly instead of either failing the suite or silently passing)
  recurs constructively throughout. A documented known gap is very
  different from an unnoticed one.
- **Fuse finished work as the build goes; keep detail only where the
  hands are** (DICTO's suggestion, 2026-09-29: "can you not just fuse them
  as you go through the build to maintain speed"). Construct drew every
  1D cell of every edge as its own bullet, so a finished 24-cell was 576
  bullets, about 800k vertices, and ran at 0.8 fps on the Pi: too heavy
  to turn by touch. Batching them into instanced meshes changed nothing
  (the cost wasn't draw calls), and cutting their detail only got 3×.
  Fusing each finished edge into one plain rod, with cells only on the
  edge being built, gave 7×, faster than the ordinary 3D world, *and* let
  the live bullets go back to full detail. The general rule: a build's
  finished parts don't need the resolution of the part being worked on.
  Measure frame rate before and after each attempt (a 4 s
  `requestAnimationFrame` count in Playwright is enough); the first guess
  at the cost (draw calls) was wrong, and only the numbers showed it.

## UX lessons from real user feedback

- **Modifier-key combinations stacked on one gesture stop being
  debuggable past one or two.** Five behaviors (including two pairs of
  literal opposites) one keystroke apart became something the user
  "couldn't separate to understand what was wrong" — not a preference
  complaint, a genuine usability failure. Replaced with explicit mode
  buttons; the underlying algorithms didn't change at all, only how they
  were triggered.
- **Two ways to express the same underlying concept (a shell-based
  onion-skin filter AND a ring-list panel) is the redundancy users
  actually complain about — remove the superseded one, don't keep both
  "just in case."**
- **When a user says "I want to do X" (remove a ring and refill it with
  a different material), the literal request can be much clunkier than
  what they actually need (recolor it in place).** Investigating WHY the
  literal request was awkward (nothing left to click once a ring is
  removed) surfaced the simpler, more direct feature to build instead.
- **A shared-face click target is at the MIDPOINT between two cell
  centers, not at the neighbor's own center — aiming at the full
  neighbor position often overshoots into empty space.** Combined with:
  a fixed camera plus a growing structure walks distant click targets
  off-canvas or behind nearer geometry as the scene grows. Both are real,
  generalizable lessons about raycast-based UI testing against a
  procedurally growing 3D scene, not just one-off flakiness.
