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
  ranking. Found `getSeeds`/`getOrganisms`'s own defensive object-copy
  was ~40% of total time, not the O(n²) algorithm everyone would have
  guessed first. Re-profiling after each fix showed the NEXT bottleneck
  directly rather than guessing whether more work was needed.
- **Two genuinely independent browser sessions (separate localStorage,
  separate anon-auth identity) catch cross-player bugs a single session
  structurally cannot.** Used repeatedly for Shared World features
  (claims, trades, asteroid regrowth, seed sync) — found real bugs every
  single time it was used, including ones a "clean test run" had
  already passed:
  - Asteroid cells were undeletable by anyone except whoever happened to
    seed them (an RLS policy scoped to `author_id`, silently affecting
    zero rows on a failed DELETE — no error surfaces).
  - Asteroid belts never reached Supabase at all — `sharedWorldActive`
    was set AFTER the seeding call that checked it, so every push
    silently no-opped; looked completely normal in every single-session
    test because rendering read from `localStorage`, not the actual
    server state.
  - A "second author" appearing mid-investigation looked like a THIRD
    bug (a reseeding race) but was population-scaled spawning correctly
    reacting to a second real session connecting — a good reminder that
    an unexpected observation during a bug hunt isn't automatically
    another bug.
- **A green test run proves the test passed, not that the deployed code
  is what ran.** A two-session Playwright run against the LIVE
  production site reported success for a seed-sync feature — but the
  actual `render.js`/`sync.js` changes had been written and unit-tested
  yet never committed and pushed, so production was silently still
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
- **A control run can disprove a hypothesis a symptom seems to confirm.**
  (Also see the sibling `dictoroids`-family lesson of the same shape —
  this is a recurring, generalizable pattern worth remembering across
  projects, not a one-off.) Section 5.1's "convergence" claim looked
  unreliable at first measurement; running dozens of real trials across
  varied starting conditions revealed the actual invariant (consistent
  selection pressure favors a better starting position) was real and
  reliable even though the textbook-framed version (strict gap-
  narrowing) wasn't — confirmed 20/20 in a dedicated check before writing
  the real test, rather than either trusting the naive framing or
  dismissing the mechanism as broken.
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
  `mesh.count`. Call `computeBoundingSphere()` after every rebuild. This
  exact bug recurred in a different guise later: claim territory
  visualization used a bounding-SPHERE estimate (farthest single corner)
  that only became visibly wrong once claims grew large enough for the
  sphere-vs-real-hull gap to matter — the fix both times was "compute the
  real geometry, don't estimate."
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
- **Anything chain-built onto a cluster becomes PART of that cluster,
  for any mechanic that reasons about "foreign vs. owned" adjacency.**
  Bit both Black Hole's and Supernova's own test setups the same way
  (independently) — a "foreign approaching structure" built as a
  connected chain silently merged into the black hole's own cluster and
  was then correctly excluded as foreign, making working code look
  broken. A real, recurring test-design trap for this project's own
  adjacency model specifically, not a code bug either time.
- **`shellCount(n) = 10n²+2` grows quadratically — an eager candidate-
  materialization loop bounded by a "looks generous" constant can hang a
  real browser.** `MAX_CLAIM_SEARCH_SHELL = 300` tried to eagerly build
  ~90 million candidate records before checking even one; Playwright's
  own click timeout is what surfaced the freeze. A bound that looks safe
  in isolation needs to be checked against the actual growth formula, not
  just "seems big enough."
- **A deterministic/seeded simulation needs literally zero real-clock
  reads anywhere in its resolution path, or the whole "same input, same
  output" guarantee silently breaks.** Caught by re-reading a function
  against its own "deterministic" claim before trusting it, not by a
  failing test — a first draft called `Date.now()` to timestamp new
  offspring inside what was supposed to be a fully seeded, replayable
  catch-up engine.
- **A defensive object-copy inside a getter, called repeatedly inside an
  already-O(n²) loop, silently turns it into O(n³) with a heavy constant
  factor.** `getSeeds()`/`getOrganisms()` returned `{ ...collection }`
  on every call — correct and safe (every mutation already used
  copy-on-write reassignment, never in-place mutation), but expensive
  when re-fetched repeatedly within a single generation's proximity
  checks. Fixed by memoizing the copy and invalidating only on real
  mutation — same external safety guarantee, O(1) between writes instead
  of O(n) every read. Found via `node --cpu-prof`, not guessed.
- **A geometric property (bounding radius, in this case) recomputed from
  scratch on every call is the same class of bug as the getter-copy one
  above, just at the geometry layer instead of the registry layer.**
  `organismBoundingRadius` iterated every tile's every vertex fresh each
  time, hit repeatedly by the same O(n²) proximity checks. Fixed by
  caching it on the seed record itself after each real growth tick
  (growth is the only thing that can change it), read-through with a
  fallback for anything predating the cache field.
- **A system-level population/growth loop needs an explicit hard cap,
  not just a soft survival-probability penalty.** Crowding-based
  survival pressure is real damping, but it's not a GUARANTEE — 50
  generations (a real, reachable worst case for a planetoid revisited
  after real hours away) of even modest reproduction from a real
  starting population could still grow large enough, combined with an
  O(n²) per-generation check elsewhere, to hang a real browser tab. Any
  loop that can run an unbounded-feeling number of iterations against a
  growing collection needs its own explicit ceiling, the same discipline
  this project already applies to `MAX_CATCHUP_GENERATIONS`/`MAX_CELLS`/
  `MAX_UNDO` — just remember to apply it to the THING THAT GROWS
  (population), not only the THING THAT LOOPS (generations).
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
- **RLS's `WITH CHECK` clause only ever sees the NEW row — it can't
  compare against OLD to block specific columns from changing.** Real
  "this field is immutable except one column" enforcement (claim
  geometry, trade confirmation flags) needs a `BEFORE UPDATE` trigger
  that explicitly compares NEW against OLD, not a check constraint alone.
  Verify a hard safety guarantee like this directly against the database
  BEFORE wiring any app code around it — a raw SQL UPDATE attempt is a
  faster, more certain proof than exercising it through the UI.
- **A Supabase upsert's `default now()` on a timestamp column only
  applies on the INSERT half — an UPDATE via upsert leaves it stuck at
  the original value unless set explicitly every time.**
- **A UI panel that grows past the viewport with no `overflow-y`/
  `max-height` can make later-added controls literally unreachable in a
  REAL browser, not just a layout nitpick.** A shorter panel never
  triggered it; a later feature that made the panel longer surfaced a
  latent gap unrelated to that feature's own logic. Worth checking
  scrollability whenever a control panel gains new rows, not just when
  something visually looks cut off.

## Design patterns that paid off (reuse, don't reinvent)

- **Reuse the existing shape for a new resource/threshold/damping curve
  instead of inventing a second one.** Recurring throughout: Ferrostone
  as Star System's carbon catalyst instead of a new material; Glassite
  as a gas giant's atmosphere instead of a new low-density material;
  asteroid regrowth's cooldown tick reused verbatim as trade decay's own
  tick interval; Star System's damping reused verbatim (not re-derived)
  by Supernova; Evolution's own volatility-score shape reused verbatim by
  Lattice Zoom's throttle-widening, just with its own local constants.
  Every one of these was a real, deliberate choice stated as such, not
  an accident of convenience.
- **A copy-on-write registry (`{ ...collection }` reassignment, never
  in-place mutation) plus an optional `hooks: {onAdd, onRemove}` callback
  is the one correct integration point for a feature that needs to
  observe every mutation** (Supabase sync, in this case) **without the
  core module knowing that feature exists.** Confirmed by grep that
  literally every mutation path already funneled through the same two
  methods before relying on it as the single hook point.
- **A generic, optional per-call override hook (defaulting to existing
  behavior) lets a downstream module (Animals) extend a shared engine's
  behavior (Evolution's catch-up loop) with zero coupling and zero
  changes to the shared engine's own already-tested functions.** Three
  small hooks (`onGenerationStep`, `reproduceFn`, `survivalProbabilityFn`)
  were enough for movement, predation, sexual mate-pairing, and
  herbivore/carnivore survival blending — `evolution.js` still has zero
  knowledge animals exist.
- **A per-cell/per-organism "already spoken for" tag (`shellCenter`,
  `claimId`, `asteroidNodeId`) is a cheap, composable way to let
  unrelated systems avoid colliding without coupling them together.**
  The claim/asteroid-belt collision guard needed zero import between
  `regions.js` and `asteroids.js` — it just checked the same kind of tag
  every other system already uses.
- **A single-point-of-truth flag beats reconstructing derived state.**
  Fusion's "oxygen byproduct" needed zero new code because its hydrogen
  source already implied `hydrosphereActive`/`atmosphereActive` were
  true — satisfied structurally, not by a second flag tracking the same
  fact two ways.
- **Explicitly flag a known, deliberate limitation in code/docs rather
  than silently working around it or hiding it.** This project's own
  `check_expected()`-style pattern (a test that reports a known gap
  clearly instead of either failing the suite or silently passing)
  recurs constructively throughout — used for `BODY_WORLD_SCALE` carried-
  over shortfalls, for Shared World sync gaps, for the moderation
  reachability-gate deferral. A documented known gap is very different
  from an unnoticed one.
- **Grounded Simplicity in practice: don't build for a hypothetical
  future requirement.** A full three-tier moderation reachability gate
  was deliberately NOT built when actually sitting down to build it,
  once direct pushback established the actual current risk didn't
  justify it yet — investigation before stopping even found a real sharp
  edge the gate would have shipped with (a live seed cell with no
  `region` field would show a new player nothing under a naive
  default-deny gate). Explicitly deferred, with the exact conditions
  that would reopen the decision stated plainly, not just abandoned.

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
