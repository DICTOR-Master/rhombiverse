# Notes: `src/render.js`

Full design rationale/history for this file's code, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists. Headings
below are ordered the same as their code appears in `render.js`.

## Trade imports (`proposeTrade`/`confirmTrade`/`cancelTrade` NOT imported)

`proposeTrade`/`confirmTrade`/`cancelTrade` (`trade.js`'s own
local-only implementations) are deliberately NOT used from here —
trading fundamentally needs two distinct real player identities, which
local single-player mode has no concept of (`myUserId` is null there);
the trade panel below only ever shows while Shared World is connected,
where every trade action goes through `sync.js`'s server-backed
`pushTradePropose`/`Confirm`/`Cancel` instead.

## World Systems dynamic-import bindings

`applyInventoryDecay` (`trade.js`), `checkAchievements`
(`achievements.js`), `applyHydrosphere` (`hydrosphere.js`), and the
`animals.js` exports are intentionally NOT statically imported here —
they're the four World Systems entry points that are actually
flag-gated (see `FEATURES` in `features.js`). They're loaded
conditionally via dynamic `import()` inside `init()`, awaited before
the app becomes interactive, and populate the module-level bindings
declared just below.

## Module-level slots for the four dynamically-loaded World Systems entry points

Safe, inert defaults so any call site reached before `init()`'s dynamic
imports resolve — or with its `FEATURES` flag off — degrades quietly
instead of throwing on `undefined`.

## Mining/hazards/claims inert defaults (Migration Path Phase A)

Migration Path Phase A's "two remaining gaps" (`RHOMBIVERSE_PLAN.md`),
closed 2026-08-24: `render.js`'s OWN direct usage of mining/claims/
hazards joins the same flag-gated roster above — not just the four
Core/Geometry-Extension modules Phase A itself already covered.
Mining/hazards are pure data-layer here (nothing but ticks/render-loop
calls reach them), so an inert no-op/identity default is the whole
story — every one of the 10+ existing call sites throughout this file
is UNCHANGED, correctness comes entirely from which function is bound.
Claims are the one exception with a real UI surface (Claim Land button,
claim boundary rendering) — see that panel's own `display:none`/
`setClaimLandEnabled`/`refreshClaims` guards elsewhere in this file; the
bindings below are still needed since `claimIdAt`/`isClaimProtected`
also feed the Phase A injection block just below this one.

## `MAX_CELLS`

Fixed InstancedMesh capacity. Cumulative cells through shell 8 alone is
~2057 (see `lattice.js`'s `shellCount`); 20000 leaves headroom for
several shell-fills plus hand-building. Revisit for real player counts.

## `MAX_SHELL`

Real, enforced cap on the shell-count/hollow-from UI inputs —
cumulative cells through shell 15 is 12431 (1 + sum of `shellCount(n)`
for n=1..15), leaving real headroom under `MAX_CELLS` for hand-built
cells or a second structure. Previously these had inconsistent, PURELY
COSMETIC `max=` HTML attributes that didn't actually stop anyone from
typing past them — a real bug (shell-count had nothing stopping a
request for shell 100, ~200k+ cells, far past `MAX_CELLS`) as well as a
confusing inconsistency, caught by the user.

## `showSyncWarning`

`pushCellUpsert`/`pushCellDelete` (`sync.js`) previously only
`console.warn`'d on failure — fine for transient network blips, but it
meant a real rejection (e.g. `schema.sql`'s `cells_rate_limit` trigger,
added 2026-08-13) would silently desync a player's view from the
shared world with zero visible feedback. This surfaces it without
being disruptive: one line, auto-hides, and re-triggering while already
visible just resets the hide timer rather than stacking/spamming — a
legitimate large Fill/Generate burst that trips the rate limit could
otherwise fire this dozens of times in a row.

## `sculptureScene`

B4b: standalone Sculpture Mode — "a fresh, fully isolated lattice
space: no connection to the player's claim, no authorId, no moderation
state, no persistence in shared world-state." A genuinely separate
`THREE.Scene` (not a swap of `scene`'s own contents), so it never
touches the dozens of `scene.add()` call sites the main world already
has scattered through `init()` (gravity/claims/organisms/asteroids/etc.
— none of which apply to a bare scratch lattice anyway). The render
loop (`animate()`, bottom of this file) picks whichever scene
`sculptureModeActive` selects; camera/renderer/OrbitControls are reused
as-is since they're scene-agnostic.

## `sectionPlane`

Section view: a single cutaway clipping plane through the whole scene
(`RHOMBIVERSE_PLAN.md` doesn't cover this — added at the user's request
so the shell system, previously invisible from outside a solid
structure, can actually be seen and understood). Disabled by default
(empty `clippingPlanes` array); `#section-enable` populates
`material.clippingPlanes` with this same `Plane` object, so mutating
its normal/constant here is picked up automatically next frame with no
separate "apply" step.

## `cameraRotated` event tracking

B3 (Cyborg Mode, `RHOMBIVERSE_UIUX_BUILD_PLAN.md`): the `'cameraRotated'`
success-condition event a first-build-session subscript step listens
for. OrbitControls' own `'change'` event fires identically for
rotate/zoom/pan with no way to tell them apart, so this tracks a real
left-button drag directly instead — dispatched globally (not scoped to
`cyborg.js`) since it's a real, generically useful signal, same spirit
as `build.js`'s `onPlaced`/`onHover` callbacks.

## Settings panel live-apply (`onSettingsChange`)

Settings panel (B1, behind the Lab entry point) — applies live, no page
reload needed. Quality only affects pixel ratio for now (WebGL
antialiasing can't be toggled after the renderer is created).

## Walk mode module-level state (`walking`/`player`)

Walk mode (`RHOMBIVERSE_PLAN.md` Phase 5.5) state, module-level since
both `init()` (which creates `player` once the world is loaded) and
`animate()` (the top-level render loop) need it. `planetoids` is
derived from world-state and recomputed in `onChange()` — see
`gravity.js`.

## `refreshHudIndicator`

Assigned inside `init()` once `updateHudIndicator` exists there —
`enterWalk`/`exitWalk` are module-level (defined before `init()`) but
still need to refresh the HUD's mode/material indicator on every
Explore transition.

## `hudPromptTimer`/`showHudPrompt`

Module-level (not `init()`-local) since `enterWalk`/`exitWalk`, defined
before `init()` runs, need it too — has no dependency on any `init()`
closure, just a DOM element and a timer.

## HUD first-use hints (`wireFirstUseHint`)

The HUD's icon-only toggles (Duality, Sculpture Mode, Cyborg, X-Ray,
Lab) rely on a hover `title` for their label — real on desktop, but
titles don't exist on touch at all, so a first-time tap is a total
guess there. Explains itself via the same toast every other hint in
this file already uses, once per toggle, the first time it's used
(hover for a mouse, tap for touch — whichever fires first).

## `organismsSnapshot`

Refreshed via `refreshOrganismsSnapshot`, called from the same call
sites as `updateGravityInfo` (several of which are module-level) but
the underlying `organisms` registry only ever changes inside
`init()`/`onChange()`/the periodic catch-up tick, all of which already
have `world` in scope to refresh this from directly.

## Shared World module-level state (`sharedWorldActive`/`applyingRemote`)

Shared World (Phase 5) state. `sharedWorldActive` gates both directions
of sync: whether local mutations get pushed (`handleLocalAdd`/`Remove`,
wired into `createWorldStore`'s hooks below) and whether `onChange()`/
the Undo button are allowed to overwrite localStorage (see their own
guards) — while connected, localStorage must stay frozen at whatever
the player's private build was, or switching back would silently lose
it. `applyingRemote` suppresses `handleLocalAdd`/`Remove` specifically
while a just-received remote change is being written into the local
store (`applyRemoteUpsert`/`applyRemoteDelete` in `init()`), which
would otherwise immediately re-push what was just received and
feedback-loop with every other connected client doing the same.

## `myUserId`

This session's anonymous `auth.uid()`, captured once on
`enableSharedWorld` — ownership (`RHOMBIVERSE_SPEC_REGIONS.md`) only
means anything with a real per-player identity, which local-only play
doesn't have.

## `LOCAL_PLAYER_ID`

B6: the fallback identity for solo play everywhere a real `ownerId`
would otherwise be required (mining/inventory credit, Sculpt/Cultivate
sessions) — claims still require a real Shared World account (one
claim per verified account, per `regions.js`), but nothing else does.

## Display name (`DISPLAY_NAME_KEY`/`loadDisplayName`)

B6 task #42: lightweight pseudonymous display name, chosen once and
remembered per-device — deliberately just localStorage, no account
system, matching the spec's own "lightweight" framing. Never sent
anywhere but this session's own presence broadcasts (see `sync.js`'s
`subscribeToPresence`/`updatePresence`).

## `otherPlayers`/presence

Other connected players' live presence (B6 task #40/#42) — keyed by
their userId, refreshed wholesale on every presence sync rather than
diffed, since the payload is tiny and this only ever runs a few times a
second at most.

## `handleLocalRegrowthSet`/`Clear`

`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4: same push-on-local-mutation
pattern as cells, wired into `worldstate.js`'s `setRegrowthEntry`/
`removeRegrowthEntry` hooks — so ANY connected client processing a
pending regrowth (not just whoever originally mined the cell) pushes
that outcome for everyone else too.

## `handleLocalSeedSet`/`Clear`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 10, closed 2026-08-13:
same push-on-local-mutation pattern as regrowth, wired into
`worldstate.js`'s `setSeed`/`removeSeed` hooks — covers both the
initial Plant-mode click (`plantSeed` calls `world.setSeed` once) and
every later growth tick (`applyGrowth` calls `world.setSeed` again per
seed that grew), so a planted seed's growth is visible to every
connected player over time, not just a one-shot placement.

## `updateGravityInfo`

Shown near the mode controls regardless of Build/Walk mode — useful
even when nothing is active yet ("no gravity source"), so it doubles
as a hint for how to create one. Reads `controls.target` in Build mode
(a reasonable proxy for "what you're looking at") and the live player
position while walking. The "blocked — you're in a protected claim"
branch distinguishes "gravity active" from "gravity WOULD be active,
but you're standing in a protected claim" — `gravityAt` is the real
physics function (`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 5), so the
hint reads the same source of truth `player.js` actually acts on
rather than showing "active" for a pull that isn't really happening.

## `resolveEvolution`

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` Stage 9: the one call site
that actually drives the Stage 1-7 catch-up engine, which until now was
real, tested, and 100% inert in the live game (nothing called it).
Resolves every planetoid's own organisms independently (Stage 6's
isolation), returns whether anything actually changed (new offspring,
removed-by-selection organisms, or ordinary growth) so the caller only
pays for a `rebuildAllGrowth()` when something real happened — same
"cheap no-op most ticks" shape `growth.js`'s own `applyGrowth` already
has. Deliberately local-only for this pass: `organisms`/
`planetoidEvolution` have no Supabase sync path yet (unlike `seeds`,
which gained one earlier) — flagged honestly as a known gap rather
than silently assumed solved, same discipline as every other
deferred-sync registry this project has shipped before its own sync
pass existed. `RHOMBIVERSE_SPEC_ANIMALS.md` Stages B-D: all three
overrides passed in (`animalGenerationStepHook` — movement + predation,
`reproduceFn` — sexual mate-pairing, `computeAnimalSurvivalProbability`
— huntBias-blended herbivory/carnivory survival odds) are no-ops/pure
delegates for every non-animal organism (amoeba/plant), so passing
them unconditionally is safe and correct regardless of what's actually
planted — this is the one real wiring point Animals' own mechanics
needed to go live in the actual game.

## `refreshOrganismsSnapshot`

Refreshes `organismsSnapshot` with each organism's own seed origin
pre-attached — keeps `updateEvolutionInfo` fully self-contained (reads
only module-level state, same as `updateGravityInfo`/`updateBeltHint`),
rather than needing `world` itself in scope, which isn't available to
the module-level call sites (e.g. the `animate()` render loop) this
needs to run from.

## `updateEvolutionInfo`

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` section 9's own read-only
"inspect dominant traits" tool — observation only, never a
breeding/culling control, per that section's explicit governing
decision. Scoped to whichever planetoid `updateGravityInfo` is already
reporting on (same `refPos` logic), so a player reads "what's evolving
HERE" rather than a whole-world aggregate that would blur together
isolated planetoids (section 6's own Isolation law — a UI that
averaged across planetoids would visually contradict the very
isolation the simulation itself enforces). The `key`/`localIds` filter
uses the same planetoid-grouping key `evolution.js`'s own
`groupOrganismsByPlanetoid` uses, so "here" means the exact same
planetoid the catch-up engine itself resolves independently — not
re-derived a second way.

## `updateBeltHint`

`RHOMBIVERSE_SPEC_ASTEROIDS.md` UI: belts sit 80+ units from the
default camera framing — without this, a player has no way to
discover or reach them at all short of reading source. `listBelts()`
is a pure function of fixed constants (no world dependency), so this
can be module-level like `updateGravityInfo`, needing no world-state
access.

## Belt approach transition (`checkBeltApproachTransition`)

B6: "a visible transition when approaching a mineable asteroid
(lattice becoming apparent, then diggable), mirroring the B2 Explore-
mode transition style." Reuses `updateBeltHint`'s own already-computed
nearest-belt distance (no second loop) — a real two-stage threshold
crossing (far -> approaching -> diggable), each firing its own toast
exactly once per approach, same `showHudPrompt` pattern B2/B3/B4/B5 all
already use for their own transitions.

## Explore transition sequence (`animateBackground` etc.)

B2's Explore transition sequence — HUD fade, camera settle, a gravity
engagement cue, and a horizon change, replacing the old instant toggle.
`walking` still flips true/false at the START of its respective
transition (`build.js`'s `getMode()` already keys off it to disable
editing while walking/transitioning, same as before) — only the ACTUAL
control handoff (`player.setEnabled`/`requestLock`, or restoring
OrbitControls) and the walk-toggle/hint text are delayed until the
sequence finishes. `walkTransitioning` guards against re-entry (a stray
`pointerlockchange` during the sequence, a second Explore pick, etc.).
`WALK_BG_COLOR`'s tint stands in for "horizon change" since this
project has no separate skybox/horizon system to hook into.

## `pointerlockchange` listener

Browsers exit pointer lock on their own (Esc, tab switch, etc.) without
going through `exitWalk()` — this catches that so Walk mode's own
state (`controls.enabled`, the toggle button label) never gets out of
sync with the actual lock state.

## Mobile/touch support intro comment

1. Walk Mode's touch controls (B7 mobile layout: "on-screen joystick
   for Explore mode"). 2026-08-13 originally hid the Lab panel's Walk
   Mode row entirely on touch-primary devices — Pointer Lock + WASD has
   no touch equivalent, so there was nothing usable to show. That
   justification no longer holds now that real touch controls exist;
   the row stays visible — the wheel's own Explore category already
   reached Walk Mode on touch regardless (it `.click()`s this same
   button programmatically), it just wasn't usable once there.
2. B1 (`RHOMBIVERSE_UIUX_BUILD_PLAN.md`) replaced the old always-visible
   two-panel sidebar with one Lab panel behind an explicit `#lab-toggle`
   entry point — superseding the mobile "closed -> controls -> shells"
   screen-navigation scheme this comment used to describe (that whole
   problem, a sidebar too wide for a phone viewport, doesn't apply to a
   single already-scrollable overlay). `closeMobilePanels()` is kept as
   a small alias so the mode-btn click handler further down (a genuine,
   unrelated existing call site) doesn't need editing.

## Touch joystick drag-to-look

Drag-to-look: standard mobile-FPS convention. A long-press without
meaningful drag forwards as a synthetic `contextmenu` at the same point
instead — `build.js`'s own `onContextMenu` (mining/removal) is reused
exactly as-is rather than duplicated, same "replay the real event"
approach used elsewhere (e.g. the persona picker replaying real wheel
clicks).

## `buildCyborgWorldSummary`/`cyborgWorldRef`

Cyborg Mode's post-walkthrough creative suggestion ("really wanted
cyborg modes to be able to do more than just suggest clicking on a
face, which is the most obvious thing to do anyway") — the exact same
three-tier pattern Full-Cyborg sculpting/cultivating already use
(`byok.js` personal key -> shared AI Gateway -> local fallback), just
generating a short text idea instead of a structured build plan.
`world.entries()`/`getSeeds()`/`getOrganisms()` are `init()`-local, so
the same module-level bridging pattern as `tickPresenceFn`/
`applyPersonaChoiceFn` applies: this function exists and is passed into
`createCyborgMode()` before `init()` runs, but only actually reads
`cyborgWorldRef` once a player clicks the button, by which point
`init()` has long since filled it in.

## `CYBORG_SUGGEST_SYSTEM_PROMPT`

Kept in sync with `api/cyborg-suggest.js`'s own copy — BYOK calls run
entirely client-side and need their own prompt text, same reasoning as
`sculpture.js`'s `SCULPT_SYSTEM_PROMPT`/`api/sculpt-intent.js` split.

## `cyborgMode` (manual toggle)

B3: Cyborg Mode is fully self-contained (fetches its own subscript
JSON, listens for the `rhombiverse:*` events dispatched elsewhere in
this file, never touches world-state) — module-level like the toggle
above, no `init()`-local dependency needed.

## `onboardingCyborg`

B6's onboarding discovery sequence — a second, independent Cyborg Mode
instance (`cyborg.js` supports concurrent instances precisely for this)
auto-started once, only on a true first visit, so it never fights with
the player's own manual Cyborg Mode toggle above.

## Persona-choice event bridging (`pendingPersonaChoice`)

`welcome.js`'s identity grid ("consider making the four personas
clickable... letting a new player pick 'Rhombiologist' and land with
the grow wheel open") dispatches this the instant a persona is clicked
— which can happen before `init()` below has finished (`welcome.js` is
deliberately independent of this file, see its own header comment, so
there's no other handshake). Latched at module level so an early click
isn't lost; `applyPersonaChoiceFn` is only assigned once `init()` has
everything (the wheel, mode shims) a persona action needs.

## `buildRDGeometry`

Builds one RD's geometry via convex hull over its 14 raw vertices —
the JS equivalent of the scipy `ConvexHull` step this project family's
own `build_polyhedron` (`dictoroids_tetraroid.py`) uses for every
solid. Only triangulated faces are needed for rendering, not
`build_polyhedron`'s merged N-gon face structure, which is a
physics-layer concern this project doesn't have yet.

## `MATERIAL_COLORS`

Base color per material (`RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md`'s
Glassite family, `RHOMBIVERSE_SPEC_ASTEROIDS.md`'s Garnet/Ferrostone,
`RHOMBIVERSE_SPEC_WATER_ICE.md`'s Water/Ice 9.9). The shared
InstancedMesh material's own `.color` is left white (see `init()`) so
these show through unmodified via `setColorAt` — cosmetic only for
now, no material has functional behavior yet (gravity/hydrosphere land
in Phase 5.5).

## `SPECIES_COLORS`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 5: "reuse the existing
`MATERIAL_COLORS` palette... unless a real reason argues otherwise" —
distinguishing a planted structure's species at a glance is that real
reason (tile-type, acute vs. oblate, is far less useful to a player
than which organism they're looking at), so this is a small,
deliberately separate map, not a wholesale new palette. Wave 2
(2026-08-13) gave one distinct tint per template, not per category, so
e.g. sapling/conifer/shrub (all `species: 'plant'`) still read apart
from each other in the 3D view. Evolution Stage 9's genome-driven
organisms (`evolution.js`'s own `plantOrganism`/`reproduceAsexual`/
`reproduceSexual`) get a warmer, saturated palette, distinct from the
fixed Wave-1/Wave-2 templates, so an evolving structure reads as
visibly different in kind, not just another named template.
`RHOMBIVERSE_SPEC_ANIMALS.md`'s land/sea creatures get the same
warmer/saturated "genome-driven" treatment, but a distinct hue per
habitat (earthy tan for land, deep teal for sea) so the two read apart
at a glance in the 3D view.

## `LANDSCAPE_WEATHERED_COLOR`

`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md` Stage 6 (Landscape Aggregate State,
section 6.2): a real, distinct "weathered ground" tone — earthy
brown/grey, deliberately NOT one of `SPECIES_COLORS`' own vivid
living-tissue hues — blended into the aggregate speckle layer's own
color by that planetoid's real `landscapeState` (0 = pure
current-species tint, 1 = fully weathered), so a location with a long
sustained biological history reads as visibly different from one with
only current, recent life, even at the same instantaneous population
size.

## `speciesColor`/`ORGANISM_SEED_SPECIES_PREFIX`

`evolution.js`'s own `plantOrganism` deliberately namespaces the
underlying seed's `species` field as `organism:<species>` (see its own
header comment) so it can never collide with a real `GROWTH_TEMPLATES`
key — unwrap that prefix here so an evolved organism still gets a real
color instead of falling through to the `?? 0xffffff` default.

## `shellTint`

Tint for a cell by its shell-fill distance (`lattice.js`'s
`cellsInShells`), so shells placed by the shift+click fill tool are
visually distinguishable outward. Cells with no `shell` (plain single
clicks, or the original seed) get white — an identity multiplier, no
tint. Hue cycles per shell (0.15 turns/shell) rather than a fixed
palette, so it stays distinct for any shell count the UI allows.

## `GENERATED_TINT`

Distinct tint for black-hole-generated buffer cells
(`RHOMBIVERSE_SPEC_BLACKHOLE.md` section 2) — players need to be able
to tell "auto-generated containment space" apart from their own build
at a glance, not just via the underlying data flag.

## `instanceColorFor`

Final per-instance color: the cell's material color, lightly blended
(35%) toward its shell tint so shell rings stay visible without
obscuring which material a cell actually is. The flagged-status branch
is only ever reached in Report mode (`visibleCells` excludes
flagged/removed cells everywhere else), so a bright warning tint here
is unambiguous — it's ONLY shown to someone actively reviewing reports.

## `cellOrder`

instanceId -> `{x, y, z, ...cellData}`, refreshed on every rebuild.
Read by `build.js`'s raycast controller to turn a clicked instance back
into lattice coordinates.

## `visibleCells`

Phase 5.8: flagged/removed cells are quarantined from the default view
— excluded from the instance set entirely (invisible AND unclickable,
same technique the old onion-skin shell filter used) rather than
deleted, so derived mechanics (hydrosphere/black hole/etc., which read
`world.entries()` directly, not this filtered list) still see and act
on the true full world regardless of what's currently visible. Report
mode is the one exception: it needs to see (and click, to toggle back)
already-flagged cells to be usable at all, so it opts back into
showing them, distinctly tinted — see `instanceColorFor`'s
flagged-in-Report-mode branch.

## `rebuildInstances` bounding-sphere recompute

`InstancedMesh.raycast()` only computes its bounding-sphere pre-check
lazily, ONCE, then caches it forever (three.js's own source: `if
(this.boundingSphere === null) this.computeBoundingSphere()`). It is
never auto-invalidated when `count` grows or instances move, so
without forcing a recompute here, any click outside whatever sphere
happened to be cached on the first-ever raycast is silently dropped
before per-instance testing even runs — the exact cause of a real bug
where only cells near the very first click's bounding sphere could
ever be built.

## `init()` — World Systems dynamic imports

Feature-gated World Systems modules: loaded (or not) before anything
below can reach them, per `FEATURES` (`features.js`). As of 2026-08-24
every World Systems flag is wired to conditional loading — mining/
economy(claims)/hazards joined achievements/animals/hydrosphere/trade
here, closing Migration Path Phase A's "two remaining gaps"
(`RHOMBIVERSE_PLAN.md`). Awaiting every enabled import here, ahead of
all wheel/event wiring below, guarantees no consumer (e.g. the
evo-land/evo-sea planting branch further down, or the periodic
achievements/inventory-decay/hydrosphere/mining/hazards ticks) can ever
observe one of these bindings still unresolved.

## `init()` — regions-integration wiring

`RHOMBIVERSE_PLAN.md`'s Core vs. Modules Migration Path, Phase A
completion (2026-08-23): `sculpture.js`/`worldstate.js` (Core) and
`gravity.js` (a Geometry Extension) no longer statically import
`regions.js` (claims, a World System); `build.js` (Core) no longer
statically imports `asteroids.js`'s `mineAsteroidCell` (mining, a World
System) either. This just injects the real functions (loaded just
above, alongside every other World System) into those four
Core/Geometry-Extension modules, gated by the same flags that already
gate every other World System. Skipping a wiring call leaves that
module's own inert default in place (no claims exist / mining is a
no-op).

## First-use hints moved from the welcome card

Moved here from the welcome card's own quickstart line (trimmed down
2026-08-24 — it was reading as too heavy alongside the new mode
choice) so each piece of guidance surfaces where it's actually
relevant, not all at once up front.

## `init()` — world load priority (shared link / saved / Showcase World)

A saved build takes priority over the static seed — that's the whole
point of Phase 3 (refreshing preserves the build). B6: a `?w=` link
(`worldshare.js`) always wins — visiting a shared link is a deliberate
"show me THAT world" action, same priority a manual Load-a-World pick
already has over whatever was open before. B6 also rebuilt first-time
onboarding around the existing Showcase World — a true first-ever
visit now loads that real, pre-built world (growth/evolution/claims
and all) instead of B1's bare starter planetoid, giving the discovery
sequence below something real to discover. `data/starter-world.json`
is now only a last-resort fallback if the Showcase World preset itself
fails to fetch (a real body needs a Blackstar-Glassite core placed via
`createWorldStore`'s own `onAdd` hooks, not baked into a static JSON,
so it's generated rather than hand-authored into the file).

## `init()` — `rebuildInstances` reference declared early

Declared this early so the very first `rebuildInstances()` call below
(before the mode-button UI further down even exists) can safely
reference it — report mode can't be active yet at that point, but the
reference itself must not be in `currentMode`'s temporal dead zone.

## Lattice Zoom Stage 2/1: `subLatticeMesh` setup

Sub-lattice reveal trigger & lifecycle, replacing Stage 1's single-
hardcoded-cell demo. Real, deliberate deviation from the spec's own
suggested pattern ("reusing `refreshClaims`'s own clear-and-rebuild
pattern"): claims are few, irregularly-shaped, and each needs its own
real convex-hull geometry, so `refreshClaims` allocates/disposes a
`THREE.Mesh` per claim every recompute. Sub-lattice cells are many,
but every one is the EXACT SAME shape (one shared geometry, per Stage
1) — the top-level `mesh` above already solves exactly this shape of
problem (many identical objects, count changes over time) via a
FIXED-capacity InstancedMesh with an adjustable `.count`, never
allocating/disposing per recompute at all. Reusing THAT pattern here is
a strictly stronger answer to this stage's own "no leaked geometry"
success check than clear-and-rebuild would be: there is nothing to
leak, because nothing is ever created or destroyed after this one-time
allocation — only the same buffer's contents and `.count` change.

`SUB_LATTICE_TRIGGER_DISTANCE` (4 world units) is a real, reasoned
first value, flagged as tunable per this spec's own section 10 open
question ("needs real frame-cost measurement... not guessed here"):
the default camera framing sits ~11.2 units from the origin (real
Euclidean distance for position (6,5,8)), so 4 keeps the sub-lattice
invisible at the ordinary starting view (this stage's own first
success check) while comfortably reachable by zooming in, matching
Stage 1's own live-verified "close zoom" screenshot distance.
`MAX_NEARBY_SUBLATTICE_CELLS` (20) bounds worst-case cost independent
of how many cells exist in the whole world — the same "a real cap
grounded in reasoned cost" discipline as `MAX_CELLS`/`MAX_UNDO`/
`MAX_CATCHUP_GENERATIONS` elsewhere in this project.

## Lattice Zoom Stage 3 — level 2 (`level2Mesh`)

`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md` Stage 3 — Multi-Level Depth &
Blending, level 2 (the sub-sub-lattice, `MAX_LOD_DEPTH`'s own second
and — per that constant's own reasoning — last level for this pass).
Same "one shared, fixed-capacity InstancedMesh" pattern as level 1
above, just hung off individual depth-1 sub-cells instead of top-level
world cells. Reuses `subLatticeMaterial` unmodified (governing decision
3, "uniform substructure": every level repeats the exact same
material, not a new color invented per depth).

`LEVEL2_TRIGGER_DISTANCE` shrinks from the depth-1 trigger by the SAME
`subScaleFactor` the geometry itself shrinks by (`levelTriggerDistance`'s
own doc comment) — self-similar reveal ratio at every depth, not a
second unrelated number picked freehand.

`MAX_NEARBY_LEVEL2_PARENTS` (4): `LEVEL2_TRIGGER_DISTANCE` is already
~0.26x the depth-1 trigger (`subScaleFactor(2) = cbrt(1/55)`), so only
whatever handful of depth-1 sub-cells are already extremely close to
the camera can ever qualify — a small bounded cap, same "real cap
grounded in reasoned cost, not arbitrary" discipline as
`MAX_NEARBY_SUBLATTICE_CELLS` above.

## Lattice Zoom: `SUB_LATTICE_BLEND_WIDTH`/`LEVEL2_BLEND_WIDTH`

The fade completes over about the same distance the cell itself spans,
a physically meaningful zone rather than an arbitrary fraction of the
trigger distance. Deeper levels shrink their own blend width by the
SAME `subScaleFactor` as their trigger distance (`levelTriggerDistance`
reused verbatim for this, per its own doc comment: "trigger distance
and blend width are the SAME real fraction... as the geometry itself
shrinks by") — and that self-similar formula happens to make
`LEVEL2_BLEND_WIDTH` come out exactly equal to `level2Scale` too,
confirming the grounding holds at depth as well as at the base.

## Lattice Zoom: sub-lattice throttle state

`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md` Stage 4 (Adaptive Damping): real
volatility-driven widening of this throttle, via `latticezoom.js`'s
own pure `nextVolatilityScore`/`throttleForVolatility` (the same
`RHOMBIVERSE_PRINCIPLES.md` section 2 shape `evolution.js`'s own
volatility score already implements elsewhere in this project).
`subLatticeVolatilityScore`/`lastSubLatticeRefPos` are the real
per-refresh state the pure functions need; `subLatticeThrottleMs`
itself stays a plain `let` (the self-rescheduling `setTimeout` loop
reads it fresh on every tick, so a widened value takes effect on the
very next scheduling, no timer teardown needed).

## Lattice Zoom Stage 5 — Ecosystem Rendering (`organismMiniGroup` etc.)

`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md` Stage 5. Tier 1 (section 6.1, "a few
real organisms"): each real tracked organism is FEW and IRREGULARLY
SHAPED (its own real growth-tile hull, not a shared uniform cell
shape), the same real content class Stage 2's own doc comment already
distinguishes from the sub-lattice cells — so this reuses
`claimGroup`'s established "clear-and-rebuild `THREE.Group`, real
convex-hull-per-item" pattern rather than a fixed-capacity
InstancedMesh. `MAX_NEARBY_ORGANISMS` bounds worst-case per-refresh
cost independent of total organism count, same "real cap grounded in
reasoned cost" discipline as `MAX_NEARBY_SUBLATTICE_CELLS`/
`MAX_NEARBY_LEVEL2_PARENTS`.

Tier 2 (section 6.1, "aggregate/general layer"): NOT independently
tracked per instance — section 10's own "leaning toward instanced
geometry... for a first pass," so this DOES reuse the sub-lattice's
own fixed-capacity InstancedMesh + `setColorAt` pattern (the exact same
white-base-material + per-instance-`setColorAt` shape the TOP-LEVEL
`mesh` already uses for cell tinting, reused verbatim rather than a
second color mechanism). Each revealed top-level parent gets up to
`AGGREGATE_MAX_SPECKLES` speckles, placed at that SAME parent's own
already-computed depth-1 sub-cell positions (reusing real existing
geometry rather than inventing a second scattering/jitter scheme),
sized deliberately smaller than a real depth-2 cell so a speckle is
never mistaken for actual per-organism detail.

## `writeBlendedInstance`

Writes one blended instance into `mesh` at `idx`: position at the
cell's real world center, uniform scale set to `blend` (1 = full size,
shrinking toward 0 as the cell approaches its outer fade distance) —
Stage 3's own cross-fade mechanism, a single shared helper so level 1
and level 2 apply it identically.

## `refreshOrganismMiniatures`

Stage 5, Tier 1: rebuilds the real tiny growth-structure for each real
tracked organism close enough to the reference position, clear-and-
rebuild same as `refreshClaims` (few, irregularly-shaped, real-hull-
per-item content — not the sub-lattice's own many-identical-instances
shape). Each organism's own EXISTING, already-correct tile geometry is
reused outright (`tileWorldVertices`), just scaled down around its own
real rooted position (`seed.origin`) by the SAME ratio depth-1
sub-lattice cells shrink by, times that organism's own real
distance-driven blend — so it fades in/out exactly like every other
Lattice Zoom reveal, rather than a separately-tuned fade.

## `refreshSubLattice`

Recomputes which built cells are near enough to the camera (or the
live player position while walking) to reveal sub-lattice detail,
closest-first up to the real `MAX_NEARBY_SUBLATTICE_CELLS` bound, and
rewrites the shared InstancedMesh's own instance buffer in place — no
allocation, no disposal, ever, after the one-time setup above.

Stage 3: each PARENT's own real distance (already computed by
`selectNearbyCells`/`selectNearbyByWorldPosition` as `.d`) drives a
single uniform blend factor applied to every sub-cell that parent
reveals — a clean whole-parent fade rather than each of its own
sub-cells dissolving independently, which would read as the
sub-lattice partially melting rather than the parent smoothly
resolving into it. Also recurses one further level (up to
`MAX_LOD_DEPTH`): whichever depth-1 sub-cells are themselves close
enough to the reference position get their own depth-2 sub-sub-
lattice, generated via `generateSubLatticeAt`/
`selectNearbyByWorldPosition` (the general, non-integer-coordinate
cores Stage 3 added), the exact same real recursion the unit tests
already proved correct.

Stage 4 (inside the function): real movement since the last refresh
drives the volatility score, which drives the NEXT scheduled throttle
interval — rapid repeated scrubbing widens it, calm/slow movement
decays it back toward the tight default.

Stage 5, Tier 2 (aggregate plant-coverage layer): real local biomass at
THIS parent's own position drives how many speckles show here, placed
at that same parent's own already-generated depth-1 sub-cell positions
(reusing real geometry, not a second scattering scheme), tinted by
whichever species is locally dominant among real nearby organisms
(`organism.species` is never prefixed — only its seed's species
carries `evolution.js`'s own `"organism:"` prefix — so `speciesColor`
needs that prefix added back on to reach the same `_evolved` color
lookup normal organism rendering already uses). Stage 6: blend toward
`LANDSCAPE_WEATHERED_COLOR` by however weathered/soil-built-up THIS
parent's own nearest planetoid real tracked `landscapeState` currently
is — a real, slow, persisted signal (`evolution.js`'s own
`resolveCatchUpForAllPlanetoids`), not recomputed from scratch here; 0
(no tracked history yet, including planetoids with no organisms at
all) leaves the speckle's pure current-species tint untouched.

`subLatticeMesh.computeBoundingSphere()`: same real bug this project
already found and fixed once for the top-level mesh —
`InstancedMesh.raycast()` lazily computes its `boundingSphere` ONCE and
never auto-invalidates it. Not yet raycast against (governing decision
4: block-level building/mining only, sub-lattice is purely visual for
this whole spec's current scope) — cheap insurance regardless, same as
Stage 1.

## `scheduleSubLatticeRefresh`

Self-rescheduling throttle (not a fixed `setInterval`) so Stage 4's own
adaptive-damping widening of `subLatticeThrottleMs` takes effect on the
very next tick, with no need to clear/recreate a timer.

## `claimGroup`

`RHOMBIVERSE_SPEC_REGIONS.md` territory visualization: one low-opacity
mesh per claim, its exact real footprint shape (via `ConvexGeometry` on
`claimFootprintWorldVertices` — ACTUAL cell-center points, the same
"real geometry, not an estimate" standard every other shape in this
app already holds to) rather than tinting individual cells, since most
of a claim's footprint is typically unbuilt space with no cell to tint
at all. Replaced a bounding-SPHERE version, 2026-08-13, after a player
noticed claim territories visually overlapping on screen even though
their real footprints never do — `claimBoundingRadius` (the farthest
single CORNER of a claim's footprint) made a genuinely much looser
sphere than the real rhombic-dodecahedron-shaped territory, which only
got more visible once claims got bigger. A plain `THREE.Group` so the
whole set can be cleared and rebuilt in one call (`refreshClaims`)
without tracking individual mesh references.

## `growthGroup`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 5: additive rendering,
never touches the RD `mesh`/`MAX_CELLS` system. Each of the 40 real
valid direction-triples (`growth.js`'s own `VALID_TRIPLES`) is a
genuinely different orientation in space, not just a translated copy
of one shape — an InstancedMesh would need a per-instance rotation
matrix computed against a template, real complexity for Wave 1's
actual bounded scale (a handful of tiles per seed, per the spec's own
low-generation-count templates). Simplicity wins here: one plain Mesh
per tile (`ConvexGeometry` on that tile's own real world vertices,
always correct regardless of orientation), grouped per seed so a whole
seed's meshes can be cleared/rebuilt together. Revisit with real
instancing only if actual usage ever shows this is a performance
problem — not assumed up front.

## `init()` — pre-interactivity catch-up on load

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` section 4's own "on
planetoid_load(planetoid)" — resolve however much real time passed
while nobody was here BEFORE the player sees anything, same as the
spec's own pseudocode names it. Deliberately NOT run while Shared World
is active (see `resolveEvolution`'s own header): organisms/
`planetoidEvolution` have no sync path yet, so mutating them locally
against a shared view would desync exactly like Undo/New World are
already guarded against. Saves unconditionally (not just when
something visibly changed) whenever any organism exists, for the same
real reason the periodic tick does — see that call site's own header
for the bug this fixes.

## Asteroid belt nav buttons

`RHOMBIVERSE_SPEC_ASTEROIDS.md` UI: belts are otherwise undiscoverable
(80+ units from the default camera framing, no minimap) — one button
per belt reframes the camera exactly like the initial
`camera.position.set(6,5,8)`/`controls.target.set(0,0,0)` setup, just
offset to the belt's own center instead of world origin. Exits Walk
Mode first if active, since `camera.position` there is driven by
`player.js` every frame and would immediately override this.

## Undo stack (`undoStack`/`lastSnapshot`)

A full-world-JSON snapshot stack, not a diff/command log — simpler to
reason about correctly than tracking per-operation inverses, and every
operation (build/fill/round/excavate/ring remove/New World/Import)
already produces a full JSON via `world.toJSON()`, so this covers all
of them uniformly for free. `lastSnapshot` always holds the state as
of the END of the previous `onChange` — i.e. exactly the state right
before whatever mutation `onChange` is currently reporting — so
pushing it captures the correct "before" state without needing to
hook every individual `world.addCell`/`removeCell` call site.

## `renderUndoScrubStrip`/`jumpToUndoIndex`

B2's scrub-timeline: `undoStack[0]` is the OLDEST kept state,
`undoStack[length-1]` the most recent (matches the push order in
`onChange`). Jumping to tick i reverts to that exact state and
discards everything newer than it (indices > i) — the same "no redo
past a jump" semantics a linear undo stack without redo support
already implied, just now reachable directly instead of only one pop
at a time.

## Ring list (`focusedCenterKey` etc.)

Ring list: "standard view" of the last-clicked structure's shells,
each with its own remove button — added per direct request, to replace
the onion-skin min/max number inputs (view-only, removed) with
something that both shows the structure at a glance AND lets
individual shells be permanently removed, safety-netted by the undo
button. `shellHue` uses the same hue formula as `shellTint()` above, so
a shell's color in this 2D diagram matches its tint in the actual 3D
view — one color means the same thing everywhere, deliberately, for
the "idiot proof" goal.

## `renderRingDiagram`

Concentric-circle "bullseye" diagram: painted largest shell first so
each smaller circle draws on top and covers the larger one's center,
leaving only its own ring-shaped band visible — the standard, simple
way to get real donut-shaped click targets without annulus/arc path
math. Kept alongside the text list (not replacing it): a thin visual
ring is easy to mis-click, so the list is the precise fallback for
actually hitting one specific shell.

## `updateInventoryHint`

B6: "remove the Shared World requirement for solo mining/inventory" —
mining itself already worked locally (`build.js`'s `onContextMenu`
falls through to local `mineAsteroidCell` when no `mineRemote` is
supplied); this display was the one place still gated on a real
account existing. `LOCAL_PLAYER_ID` is the same local-identity
fallback Sculpt/Cultivate sessions already use.
`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 5: entries are
`{quantity, lastUsedAt}` objects now, not bare numbers.

## Undo button hold-vs-click (`UNDO_HOLD_MS`)

Undo reverts the LOCAL view only, via `replaceAll` — like New
World/Import/Load preset, it bypasses the `addCell`/`removeCell` hooks
that drive `sync.js`'s pushes, so it can't un-push a change already
synced to the shared table. Disabled outright while Shared World is
active (see `updateUndoButton`) rather than left to silently desync.
B2: a quick click still undoes exactly one step (`jumpToUndoIndex` on
the last/most-recent entry, same effect the old `pop()`-based handler
had); holding past `UNDO_HOLD_MS` instead reveals the scrub strip so
any past state can be jumped to directly. Clicking anywhere outside the
strip closes it without acting — same "reveal on hold, dismiss on
outside interaction" pattern the Rhombic Wheel's own picker strip uses.

## Section view / X-Ray (`updateSectionEnabled`, `xrayHandle`/`xrayGizmo`)

Section view (clipping plane): `#section-enable` toggles whether
`material.clippingPlanes` contains `sectionPlane` at all, AND whether
the axis/position/flip sub-controls are even shown — no point showing
controls for a feature that's currently off. The other three controls
just mutate the same `Plane` object in place, picked up automatically
by the next rendered frame (no rebuild needed — clipping is a GPU-side
spatial test).

B2: X-Ray as an interactive draggable cutaway plane, not just a
checkbox+slider. `#section-enable`/`#section-axis`/`#section-flip`/
`#section-pos` (Lab panel, still there for precise numeric control) and
this handle drive the exact same `sectionPlane` object, kept in sync
both directions — "keep all underlying mechanics... unchanged, this
phase is presentation and interaction feel only" (B2's own scope
line): `sectionPlane`/`material.clippingPlanes` are untouched, only how
a player reaches and moves them is new. Dragging the handle updates
`sectionPlane` in real time — reveals the interior as it moves through
the structure, not just on release, and keeps the Lab panel's own
numeric slider live too, both directions.

## B5 Duality Mode

"The RD lattice as a 4D hypercube shadow, the rhombic triacontahedron
as a 6D hypercube shadow" — no such cut-and-project mapping exists
anywhere in this codebase or its specs (checked before writing this,
same kind of gap as B4's "order-48 symmetry group" claim, but deeper:
the textbook 6D construction uses the icosahedral point group, order
120, which doesn't act on this lattice's actual cubic (order-48) FCC
symmetry at all — there's no clean way to apply the literal method
here). What IS real and already built: `growth.js`'s own
Ammann-rhombohedra tile geometry (`STAR_DIRECTIONS`/`VALID_TRIPLES`/
`unitTileVertices`), a genuine quasicrystal-related construction this
project already uses for its Penrose growth layer. Duality Mode
reveals that SAME real geometry applied to every regular built cell
instead of just grown seeds — "display it for free" rather than
inventing new projection math, per direct steer. Deterministic (same
cell always picks the same real prototile triple, via `tripleForCell`'s
coordinate hash) but not a literal verified hypercube-shadow
projection — disclosed here, not silently oversold.

## Mode selector / contextual UI (`MODE_HINTS`)

Mode selector: exactly one `#mode-btn` is "active" at a time; a plain
click does whatever that mode does (`build.js`). Replaced an earlier
modifier-key scheme (Shift/Ctrl/Ctrl+Shift+click) that became
unmanageable — see `build.js`'s header comment for the full reasoning.

Contextual UI, added because "all options seem available at same time"
was a real, separate complaint even after the fill logic itself was
verified correct by direct execution: each mode only shows the shell
inputs it actually reads (Fill uses both; Excavate uses only "hollow
from"; Round and Build use neither), and the hint line states in plain
language exactly what a click currently does — so it's possible to
tell whether something worked without needing devtools. Material stays
visible in every mode, unlike the shell inputs: it's read by
Build/Fill for what to place, AND by the ring panel's Recolor button
regardless of which mode is active, so hiding it in Round/Excavate
would make recoloring require a mode switch just to see the dropdown.

## `PLAYER_FACING_MODE_LABEL`

Player-facing terminology (`RHOMBIVERSE_UIUX_BUILD_PLAN.md` B1's rename
table) for the HUD's top-right indicator — the Lab panel keeps the
original technical labels (Generate, Excavate, Round, Walk Mode,
Presets) untouched, per that same table's "outside Lab/Advanced view"
scope.

## Mode button clicks — Report mode resync, mobile close

Entering/leaving Report mode changes which cells are visible
(`visibleCells`) — re-sync immediately rather than waiting for the next
unrelated `onChange`. Mobile screen-navigation: picking a mode is the
whole reason to have opened the controls screen — return straight to
the 3D view so the next tap lands on the canvas, not a second manual
"Close" tap. No-op on desktop (`closeMobilePanels` only affects a CSS
class the desktop layout never uses).

## Plant mode raycasting (`plantRaycaster`)

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 4: Plant mode's own click
handling, entirely separate from `build.js`'s controller (see
`getMode`'s own comment for why). Section 10's own deferral —
"freestanding, fewer cross-system dependencies" — means planting
doesn't need to hit an existing cell; it raycasts against the RD mesh
purely to translate a 2D click into a real 3D point (whatever surface
is under the cursor), falling back to a fixed distance along the
camera ray when nothing is hit (open space, or no cells built yet). A
tiny outward offset along the hit normal keeps a freshly-planted seed
from spawning literally inside the RD cell it was clicked on.

## Planting evolving species -- Shared World block

`organisms`/`planetoidEvolution` have no Supabase sync path yet (see
`resolveEvolution`'s own header) — planting one here would sync the
underlying SEED (seeds already sync) but not the organism record
behind it, leaving every other client with a frozen, never-evolving
tile cluster instead of a real shared organism. Blocked outright
rather than shipping a silently half-synced experience.

## Planting animals (`evo-land`/`evo-land-dino`/`evo-sea`)

`RHOMBIVERSE_SPEC_ANIMALS.md` Stage A/B: same random-within-range
founding genome as evo-amoeba/evo-plant (no breeding UI), plus a
random-within-range `animalTraits` object for mobilityRange/huntBias.
`plantAnimal` enforces habitat validity at plant time — a land
creature can't be planted on/near a liquid-permeated cell and vice
versa, surfaced here as a friendly alert rather than an unhandled
exception. "Dinosaur" is still a real, random genome (no hand-tuned
exact numbers, no breeding UI) but biased toward the LARGE end of
`maturitySize` specifically — a real, grounded read (large-bodied land
animals), not a special-cased new mechanic; `animalTraits` is
similarly biased toward high huntBias (carnivore) and high
mobilityRange (a real predator's own mobility advantage) — same "bias
the random draw, never hand-fix a value" shape, keeping this a real,
still-evolvable genome.

## Plain seed planting -- Cultivation `growthParameters`

B5 Cultivation Mode Manual tier: "expose the existing growth-layer's...
parameters... as player-adjustable inputs at planting time" — layered
on here rather than changing `plantSeed`'s own signature, since every
OTHER planting path (evolving organisms/animals above) is explicitly
out of Cultivation's scope and must stay completely unaffected.
Planting doesn't route through `onChange()` (seeds are a genuinely
separate coordinate space, see `worldstate.js`'s own comment on why) —
achievements need their own hook here too. B6's onboarding discovery
sequence listens for the `rhombiverse:seedPlanted` event, same spirit
as `build.js`'s `onPlaced`.

## Plant-mode right-click pruning

B5 Cultivation Mode: "manually pruning part of an already-grown
structure should trigger the existing aperiodic fill/reroute behavior
the growth system already has" — reuses the same right-click-always-
removes convention every other mode already has, scoped to Plant mode
(grown tiles aren't normal `world.cells`, so `build.js`'s own
`onContextMenu` never sees them). `growSeed`'s frontier scan already
re-derives itself from `seed.tiles` fresh every call, so the "reroute"
is genuinely free — `pruneTile` is the whole mechanic.

## Frost line (`canPlaceMaterial`)

`RHOMBIVERSE_SPEC_STAR_SYSTEM.md` section 3: reads the live
`planetoids` closure variable at call time (not a stale snapshot), so
it always reflects whatever stars exist as of the most recent
`onChange`.

## `FULL_CYBORG_INWORLD_ENABLED`

B4a: Sculpt tool (Create -> Sculpt). Full-Cyborg stays behind this flag
in the shared world until B7's moderation work is verified — per the
plan's own instruction, the logic itself is fully built either way,
just not reachable here while false. Standalone Sculpture Mode (B4b)
enables it unconditionally, since nothing there touches shared
world-state.

## Sculpt symmetry mode selectors

Exactly one symmetry mode is active at a time: the 6-plane mirror
picker (default/fallback), the two dual-aware presets, or Full
symmetry (48) — additive options layered on top of the existing
picker, not a replacement for it, so selecting one always clears the
others rather than combining silently. Full symmetry (48) reuses
`FULL_SYMMETRY_GROUP` (`sculpture.js`), which already existed but was
never wired to any UI control before — confirmed during this task's
own investigation step. Not gated on `FEATURES.dualSculpture` (it has
nothing to do with the dual cube/octahedron structure), so this row is
always visible. Cube/Octa symmetry presets ARE gated on
`FEATURES.dualSculpture` (the row itself is `display:none` via the
dual-section hide when the flag is off, so these listeners simply
never fire in that configuration).

## `sculptTarget`

Sculpt mode's own click handling (`build.js` has a one-line no-op for
`mode === 'sculpt'`, same shape as its Plant-mode no-op). `sculptTarget`
is an indirection so the SAME click handler/panel serves both B4a
(in-world, targets `world`/`mesh`) and B4b (standalone, targets
`sculptureWorld`/`sculptureMesh`) — swapped by
`enterSculptureMode`/`exitSculptureMode`, never duplicated.

## Dual structure section (`dualShowEl` etc.)

Dual structure (core; `RHOMBIVERSE_PLAN.md` "Core vs. Modules" —
treated as load-bearing rather than a real feature toggle, per
`CLAUDE.md`'s own instruction; `FEATURES.dualSculpture` defaults true,
this only actually disables anything if someone deliberately flips it
for a reduced/testing configuration). Overlay/snap/shell state lives
here, next to `sculptTarget`, since both the in-world Sculpt tool (B4a)
and standalone Sculpture Mode (B4b) share this one panel and click
handler via the same `sculptTarget` indirection.

## `cellDuals`

Per-cell dual data for whatever's currently rendered by `sculptTarget`
— rebuilt on every overlay refresh rather than cached, since it must
stay correct across both the in-world/standalone swap and every
sculpt edit; sized for Sculpture Mode's typical scratch-space cell
counts, not yet optimized for a huge shared World (a real, deferred
cost matching this codebase's own admitted perf-tuning pattern
elsewhere — see e.g. the Showcase World's `evolution.js` fix in
`CLAUDE.md`).

## `rebuildDualOverlay`

Desaturate/lower-opacity RD faces only while something's actually
drawn — Show Dual on with Focus "None" would otherwise dim the faces
around nothing, which isn't what "the overlay reads clearly" is asking
for. Cool color for the cube (3-valent) edges, warm for the octahedron
(4-valent) edges — matching this app's existing cool/warm palette
pairing (glassite blues vs. garnet/ferrostone warms).

## `snappedSculptTarget`/Snap to Dual

Snap to Dual: given a raw world-space hit point and the hovered cell's
own dual, nudges to the nearest dual vertex (per Dual Focus) within a
small threshold — purely a target-selection adjustment before the
existing sculpt click logic runs, no new mutation path. Snapping
selects the whole inscribed solid the vertex belongs to (Phase 2, step
6) — no separate selection concept exists anywhere else in
`sculpture.js`/`render.js` to wire into (checked directly during this
task's own investigation step), so this is highlight-only via the
returned `which`/`cell` info; a real multi-cell selection state is a
TODO, not invented here.

## Sculpt click handler — Snap to Dual + symmetry application

Snap to Dual (Phase 2, steps 5-6): a click landing near a 3-valent
(cube) or 4-valent (octa) dual vertex selects the whole inscribed solid
it belongs to. No selection-state concept exists anywhere else in
`sculpture.js`/`render.js` for the order-48 mirror/symmetry tools to
wire into (there is no order-48 tool wired to the UI at all before this
task), so this is highlight-only: it surfaces a HUD prompt and,
matching the dual-awareness task's own step 4, auto-switches the active
symmetry preset to match — the player can still override manually
afterward. RD placement itself stays cell/face-based (no continuous
ghost-hover target exists to actually re-aim), so snapping does not
relocate the placement target.

Model (add): the neighbor cell across the clicked face, same
target-selection rule Build mode uses. Chisel (remove): the clicked
cell itself, matching the tool's own "carve away what you're pointing
at" framing.

Dual Shell (Phase 2, step 7): the shell-radius brush walks `DUAL_DIRS`
(per Dual Focus) instead of the normal 12-neighbor offsets — an
alternate direction set passed into the existing
`shellBrushCells`/`cellsInShells` traversal (`lattice.js`), not a
reimplementation. "Both" walks the union of both direction sets.

Full symmetry (48): replicate through every element of
`FULL_SYMMETRY_GROUP` instead of a single mirror plane. Cube/Octa
symmetry presets: replicate across the 8/6 `DUAL_DIRS` positions via
`applyDualSymmetry` instead of the single mirror plane `sculptStroke`
would otherwise apply. Both reuse the shell brush's own cell list, so
radius/Dual Shell still behave identically to the normal path. Manual
tier auto-mirrors immediately (a direct player action, same as every
other consent-free build tool). Semi-Cyborg deliberately does NOT
auto-mirror here — the whole point of that tier is that completing the
mirror is the AGENT's proposal, surfaced as an accept/dismiss
suggestion, not applied inline with the player's own click.

Dual-awareness (gated on `FEATURES.dualSculpture`): pass the active
Dual Focus so Semi-Cyborg can also propose completing an inscribed
cube/octahedron, not just the mirror-plane heuristic. `undefined` when
the flag is off, so behavior is byte-identical to before this task in
that configuration.

## `enterSculptureMode`/`exitSculptureMode`

Duality's shadow mesh lives in whichever scene was active when it was
built — turn it off cleanly before switching scenes rather than
leaving a stale shadow (and a hidden main mesh) behind. A completely
empty scratch world has no face to click "Model" onto at all (the
same bootstrap problem B1 fixed for the main world's old single-empty-
cell starter) — one seed cell, not a whole planetoid, since this is
meant to be a bare scratch space. Full-Cyborg is enabled
unconditionally in Sculpture Mode — nothing in this scratch space
writes shared world-state, so B7's moderation gate (which the in-world
tier stays behind) doesn't apply.

## `exportSculpture`

Export — reuses the exact same `buildRDGeometry`-derived `geometry`
every in-world cell already renders with (via `sculptureMesh`'s own
geometry), merged into one real BufferGeometry per active instance
rather than a new from-scratch export pipeline.

## "Place a copy in-world"

The ONLY bridge back to shared world-state (B4b's own wording). A
normal player-attributed placement (the player placing something they
made), not a live agent write, so it doesn't need the Full-Cyborg gate
either — it's just `world.addCell`, the same call every manual build
action already makes, offset so it doesn't land on top of whatever's
already at the main world's origin. Must be an EVEN shift —
`isValidCell` requires x+y+z even, and this only offsets x, so an odd
offset would flip every placed cell's parity and make `isValidCell`
reject all of them.

## Ghost block preview (`ghostMeshes`)

Ghost block preview (B1's "intelligent ghost block"): up to two
translucent RD meshes, reusing the exact same geometry as the real
mesh so the preview always matches the real shape exactly. Hidden by
default; `build.js`'s `onHover`/`onHoverEnd` callbacks drive
position/visibility — `render.js` owns the actual THREE objects since
it already owns `scene`/`geometry`, keeping `build.js`'s own job pure
raycasting/state (same separation the rest of this file already uses).
B2: the material wheel's live structure-preview on hover recolors this
same ghost instead of a separate preview object — when
`materialPreviewColor` is set, it overrides the normal occupied/valid
tint until hover ends.

## `flashAt`

Placement/removal feedback (B1): a short outline flash at the affected
cell plus a WebAudio blip (`sfx.js`). Reuses the same shared geometry
as the ghost preview — a wireframe wrapper via `EdgesGeometry`, scaled
up and faded out over a fixed short duration, then disposed, so
nothing here needs its own per-frame animation loop beyond a single
`requestAnimationFrame` chain.

## `createBuildController` wiring

`'faceHovered'` (B3) fires on any valid hovered face, not just an
unoccupied one, matching the subscript step's own plain-language
framing ("hover over one" of the 12 faces).

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`: Plant mode's own build/place
handling is in `render.js` (its own click listener), never `build.js`
— but `getMode()` must still return the real `'plant'` string here,
not null. A real bug caught fixing this: returning null (mirroring how
Walk mode disables editing entirely) also silently disabled
`onContextMenu`'s right-click removal in Plant mode, contradicting
"right-click always removes the clicked cell, in every mode."
`build.js`'s own `onClick` has a one-line `mode === 'plant'` no-op
instead, so its own unconditional build fallthrough is skipped WITHOUT
also disabling removal.

Phase A completion (2026-08-23): `build.js` (Core) no longer statically
imports `asteroids.js` — see the `FEATURES.economy` block above
`init()`'s own end for the parallel `regions.js` wiring. This
`render.js`-local `mineAsteroidCell` binding (declared near
`applyInventoryDecay` etc.) is already the real function when
`FEATURES.mining` is on, or its own inert no-op default otherwise —
`build.js`'s own separate default (its param default) is redundant
with, not needed alongside, this one.

## `createRhombicWheel` wiring

Rhombic Wheel (B1) — the one control surface all mode/material
interaction is meant to go through now that the old always-visible
sidebar is gone. Drives the hidden `.mode-btn`/`#material-select`/etc.
shim elements directly (see `wheel.js`'s own header for why), so this
needs no further wiring into `build.js`'s mode dispatch itself. Left-
drag normally orbits the camera (OrbitControls' own default) — while
Repeat is armed, left-drag instead paints a run of cells (`build.js`'s
`onPointerMove`), so orbiting via that button has to yield for as long
as Repeat stays selected; right-click (remove) and middle-drag (zoom)
are unaffected.

## `applyPersonaChoiceFn`

Completes the persona grid's onboarding arc: Build is already the
default state (Rhombitect needs no action beyond dismissing the
overlay), the other three land the player straight into the mode/panel
their persona is about — reusing the exact same wheel-item clicks a
real player would make (`open()` -> category leaf -> tool leaf), so
this can never drift out of sync with what the wheel itself does for
that same choice.

## `applyRemoteUpsert`/`applyRemoteDelete`

Shared World (Phase 5): these write an incoming realtime change into
the LOCAL store via the same `world.addCell`/`removeCell` every other
code path uses (so derived mechanics — hydrosphere, black hole, star
fusion — recompute correctly against it too, since `onChange()`
re-runs the full apply* pipeline), guarded by `applyingRemote` so
`handleLocalAdd`/`Remove` (registered on the store above) don't
immediately push the very change that was just received back to
Supabase.

## `applyRemoteClaim`

Claims have no local push-hook to suppress (unlike cells' `addCell`/
`removeCell` — see `worldstate.js`), so no `applyingRemote` guard is
needed here: applying an incoming claim can never itself trigger
another push. No `onChange()` either — claims have no visual
representation yet (no boundary rendering in this pass), and per
Isolation a newly-announced claim never retroactively touches
already-placed cells, so there's nothing to re-render.

## `applyRemoteRegrowthSet`/`Clear`

`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4: unlike cells, setting/
clearing a regrowth-queue entry is pure bookkeeping with no visual
effect of its own (the actual cell reappearing/vanishing is a SEPARATE
cells-table event that already triggers its own `onChange` via
`applyRemoteUpsert`/`applyRemoteDelete`) — so no `onChange()` here,
same reasoning as claims. DOES need the `applyingRemote` guard, unlike
claims, since `setRegrowthEntry`/`removeRegrowthEntry` have real local
push-hooks (`handleLocalRegrowthSet`/`Clear`) that would otherwise
immediately re-push what was just received.

## `applyRemoteSeedSet`/`Clear`

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 10, closed 2026-08-13:
unlike regrowth entries, a seed HAS real visual geometry (its tiles),
so an incoming remote seed (a fresh plant from another player, or a
growth tick on a seed this session didn't plant) needs
`rebuildSeedMeshes`, not just a silent store update. No `onChange()`
here — a growth-layer seed's tiles are their own separate mesh group
(see `rebuildSeedMeshes`), not part of the RD InstancedMesh
`onChange()` re-syncs.

## `applyRemoteInventory`

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md`: inventory has no local
push-hook (`worldstate.js`'s `setInventoryEntry` is a plain setter —
Shared World inventory changes only ever originate server-side, via
`mine_asteroid_cell` or the trade-resolution trigger, never a direct
client write), so no `applyingRemote` guard is needed, same reasoning
as claims. No `onChange()` either — inventory has no 3D representation;
just re-renders the panel.

## `interactPanelShowsTrade`/`applyRemoteTrade`

Same no-guard reasoning as inventory — a pending trade only ever
changes via this session's own `pushTradePropose`/`Confirm`/`Cancel`
calls (which never touch `world.setPendingTrade` directly) or another
client's realtime echo, never a local write that could feedback-loop.
Scoped to trades actually involving the currently-open partner —
`renderInteractPanel()` rebuilds the propose form from scratch
(including resetting any offer the player has already picked), so an
unrelated trade elsewhere in the shared world updating must NOT trigger
it, or it would silently wipe an in-progress selection for a completely
unrelated reason.

## Claims panel visibility (Migration Path Phase A, claims half)

`RHOMBIVERSE_PLAN.md`, claims half (2026-08-23): unlike mining/hazards
— pure data-layer systems where an inert function default is enough,
since nothing reaches through them but ticks/render loops — claims
have a real clickable UI surface. Leaving Claim Land enabled with
`FEATURES.economy` off would let a player click it and see a broken
"Claimed null: center [undefined]" result (`regions.js`'s real
`computeClaim` never loads, so the module-level binding stays its
inert default). Hiding the whole panel is a coherent "claims don't
exist" state instead of a half-working button — direct instruction,
confirmed over "leave the UI as-is."

## `updateWorldPanelVisibility`

World-panel content that only makes sense for the real World: the
asteroid-belt hint/nav (`belt-nav-row` itself already empties
naturally when `FEATURES.mining` is off — `listBelts()` returns `[]` —
but the static hint text needs an explicit hide, same reasoning as
claims) and the World presets/Load-World picker. Direct feedback
(2026-08-24): Sculpture Mode's OWN scratch world has no presets and no
asteroids — `CLAUDE.md`'s own "a separate, isolated scratch workspace"
— so both groups must ALSO hide whenever `sculptureModeActive` is
true, independent of the FEATURES flags (re-run from
`enterSculptureMode`/`exitSculptureMode`, not just once here at init).

## `refreshClaims`

Rebuilds both the wireframe-sphere territory visuals AND the text list
from `world.getClaims()` — called after every point claims actually
change (a local grant, a remote claim arriving, entering/leaving Shared
World), not on every `onChange()`, since claims change far less often
than cells do. Clearing and rebuilding the whole group each time is
simpler than diffing for the handful of claims this project has ever
been tested with — revisit if that stops being true. Clears any
existing claim-boundary hulls and stops if `FEATURES.economy` is off —
claims don't exist for this session, full stop, regardless of what a
previously-saved world's own JSON still has stored under `claims`
(that data isn't deleted, just not surfaced, same as every other
FEATURES-gated system). One claim per player
(`RHOMBIVERSE_SPEC_LOOPHOLES.md` section 2) — disable the button once
this session already owns one, rather than letting them click it again
just to see the "already have a claim" error every time. Footprint
points are already in world space (`claimFootprintWorldVertices`
applies SCALE itself), offset by -claim center so the resulting
geometry is centered at its own local origin — the mesh is then
positioned via `.position.set`, matching how every other object in
this scene is placed, rather than baking the offset into the geometry
itself. Solid, low-opacity fill (not wireframe) — a wireframe of an
8-shell claim's real convex hull has far more facets than the old
sphere ever did and reads as visual noise; a translucent solid volume
is what actually makes overlapping claims legible at a glance.
`DoubleSide` since the camera can end up inside a large claim's own
hull while walking. Only your own claims get the destructible toggle —
RLS would silently reject an attempt on anyone else's anyway
(`claims_update_own`), so there's no point offering a control that can
only ever fail.

## `rebuildSeedMeshes`

Rebuilds ONE seed's own tile meshes from its current world-state —
called after growth (not a full-world rebuild) so an idle seed's
meshes are never touched just because something unrelated changed
elsewhere. Disposes the previous group's geometries/materials before
replacing them, same cleanup discipline `refreshClaims` already uses.
`RHOMBIVERSE_SPEC_LATTICE_ZOOM.md` Stage 5: a real tracked organism's
seed is deliberately EXCLUDED from this always-visible, full-block-
scale rendering — this is the exact "scale-mismatch problem the
project owner raised" section 6.1 opens with (an amoeba/plant rendered
at the same order of magnitude as a whole building block). Stage 5's
own `refreshOrganismMiniatures` replaces it with a correctly tiny,
LOD-gated version instead, reusing this exact same real tile geometry,
just scaled down and only revealed once the camera is genuinely close.
Ordinary (non-organism) growth species are completely unaffected —
this only skips seeds whose species carries `evolution.js`'s own
`ORGANISM_SEED_SPECIES_PREFIX`. `tileMesh.userData.seedId`/`tileIndex`
lets the prune contextmenu handler identify exactly which seed/tile a
right-click landed on (B5 Cultivation Mode).

## `TRADE_MATERIALS` / trade panel

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 3: direct barter only, no
marketplace/listings (the spec's own explicit scope limit) — one
material each side, kept deliberately simple rather than a
multi-material offer basket. With no chat/DM system anywhere in this
app, a trade partner has to be identified by pasting their raw player
ID; the "known traders" list (derived from the already-public
`player_inventory` data, not a new lookup) exists purely so that isn't
the ONLY way — click a row to fill the input.

## `updateAvatarLabels`

Called every frame from `animate()` while Shared World is active —
projects each other walking player's live position to screen space
(this app already does everything else, hud-prompt/achievements/claim
hints, as plain DOM overlays rather than 3D sprites, so this stays
consistent with that rather than introducing a new rendering approach
just for avatars).

## `updateInteractProximity`

Nearest walking player within `INTERACT_RADIUS`, if any — drives both
the tappable `#interact-btn` (touch has no equivalent for a keyboard
shortcut, same gap this session already fixed for the wheel) and the
'E' key.

## `makeChipDraggable`

Pointer-based drag (not HTML5 draggable/dragstart) — see index.html's
own comment: native drag-and-drop has no touch equivalent, and this
session already fixed real touch gaps elsewhere in this app. A plain
click/tap (no movement) is also accepted, calling `onDrop(null)` so the
caller can default to that chip's natural zone — this makes the whole
interaction work identically well with a mouse or a finger.

## `renderInteractProposeForm` — partner quantity cap

The partner's own held quantity is a display cap only — the trade can
still ask for more than they currently hold, same as the old form
allowed (`proposeTrade` only ever checks the PROPOSER's own side up
front; `resolveTrade` re-checks both at the moment of resolution, per
`trade.js`'s own comment).

## Claim Land button

`RHOMBIVERSE_SPEC_REGIONS.md`, minimal UI trigger: grants this
session's player one fixed-size claim in the first free slot found
outward from world center. Only meaningful while Shared World is
active (ownership needs a real per-player identity, and claims are
pointless to protect in a world only you can ever see) — `claimLandBtn`
is enabled/disabled alongside the other Shared-World-only controls.
Pushes to Supabase BEFORE applying locally (unlike cell edits, which
apply optimistically then push) — `computeClaim` is pure/non-mutating
specifically so this ordering is possible, since a genuine
concurrent-grant race on the same free slot needs to be caught by the
server (the claims table's own primary key) before this client treats
the claim as real. Search origin is wherever this player actually is
(their real position while walking, or wherever they're currently
looking/orbiting otherwise) rather than always world center — see
`findFreeSlot`'s own header (`regions.js`, 2026-08-13) for why: a fixed
shared search origin gets more crowded, and thus more expensive to
search past, as every player who has ever claimed land accumulates
near it; a per-player origin keeps search cost flat regardless of
total claims elsewhere in the (genuinely unbounded) lattice. The
`finally` block does NOT unconditionally re-enable the button — a real
bug caught live: this used to always flip back to `!sharedWorldActive`
(i.e. enabled), immediately undoing `refreshClaims()`'s own "you
already own a claim, disable the button" state set moments earlier.
Re-derives the same ownership check instead of fighting `refreshClaims`
for the last word.

## `setLocalResetControlsEnabled`

New World/Import/Load preset all mutate via `world.replaceAll()`,
which deliberately bypasses the `addCell`/`removeCell` sync hooks (see
`worldstate.js`) — a personal local-view reset must never bulk-push or
bulk-delete against the shared table. Rather than let that silently
desync the view from the shared world, these three controls are simply
disabled for the duration of the Shared World session.

## `setClaimLandEnabled`

The inverse of `setLocalResetControlsEnabled` — disabled OUTSIDE Shared
World (ownership is meaningless in a world only you can see), enabled
only while connected. Also stays disabled whenever `FEATURES.economy`
is off, same reasoning as this panel's own `display:none` — Shared
World connecting shouldn't be able to re-surface a claims UI that's
supposed to not exist for this session.

## `enableSharedWorld`

`sharedWorldActive` is set BEFORE `seedAsteroidBelts` (and
`onChange()`) — a real bug caught only by a live two-session test, not
by review: this used to be set AFTER seeding, so every seeded cell's
`world.addCell` call fired its `onAdd` hook while `sharedWorldActive`
was still false, meaning `handleLocalAdd`'s own `if
(sharedWorldActive...)` guard skipped `pushCellUpsert` entirely —
asteroid belts have been purely local/cosmetic in Shared World this
whole time, never actually reaching Supabase. Also still needed for
`onChange()`'s own localStorage guard and the undo button's disabled
state to already reflect shared mode for this first render. Seeding is
idempotent (checks for existing asteroid-tagged cells first) — safe
even if a previous session already seeded this shared world. A rare
race exists if two sessions connect to a truly fresh (never-seeded)
Shared World simultaneously — both could seed independently, upserting
the same positions with possibly different random materials. Not
catastrophic (same idempotent upsert mechanism as any other concurrent
cell write), just slightly wasteful; not worth distributed-locking
machinery for a one-time bootstrap case. See `CLAUDE.md`'s asteroids
status.

## `captureThumbnail`

Downscale from the real canvas so a gallery row stays small —
full-resolution screenshots would bloat every `fetchGalleryWorlds()`
call for no visual benefit at thumbnail size.

## B6 Shared Worlds Gallery

Requires Shared World (a real Supabase account is needed for the
`shared_worlds` table's RLS insert policy, `author_id = auth.uid()`),
same boundary claims already use. Requires `schema.sql`'s
`shared_worlds` table to actually exist server-side — if that
migration hasn't been run yet, fetch/publish calls fail cleanly into
their own catch blocks with a real error message, not a crash.

## Load-preset button

Presets: ready-built structures (`data/presets/*.json`) loaded the same
way New World does — a full `world.replaceAll()`, confirm-gated since
it's destructive. Exists because precise face-by-face clicking to
hand-build something like a 20-BSG-cell black hole is genuinely
fragile (real face targeting needs the shared-face midpoint between
two cell centers, not either center itself, and a fixed camera plus a
growing structure can walk distant click targets off-canvas or into
occlusion — both hit for real while verifying the frost line) — these
presets are generated via the actual lattice math
(`NEIGHBOR_OFFSETS`-driven, not hand-derived coordinates) so they're
guaranteed valid, and double as reliable fixtures for future tests.
`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 4.1: growth-layer presets
live in their own `data/growth-presets/` directory (distinct from
`data/presets/*.json`'s planetoid presets), selected by a `"growth:"`
prefix on the option value rather than a second dropdown — simplest
thing that works for one extra directory. Every `replaceAll()` call
site (New World/Import/Load preset/Gallery load) re-runs
`seedAsteroidBelts(world)` afterward — idempotent, matches what a true
first visit gets, since `replaceAll` doesn't itself tag any cells as
asteroids.

## `load-preset` click handler

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md` section 4.1: growth-layer presets
live in their own `data/growth-presets/` directory (distinct from
`data/presets/*.json`'s planetoid presets), selected by a `"growth:"`
prefix on the option value rather than a second dropdown — simplest
thing that works for one extra directory. Loading a World is a full
replace, not additive — any asteroid belts seeded at first visit
(`init()`'s own unconditional `seedAsteroidBelts()` call) are gone the
moment this fires, and this never re-seeded them, silently leaving
nothing minable behind for any preset that wasn't itself authored with
asteroid cells baked in (true of every Body Type preset —
`planetoidgen.js` never tags any). Same idempotent call
`enableSharedWorld()` already makes — a no-op if the loaded World
already has its own asteroid cells, otherwise seeds the standard two
belts.

## The 5-second periodic tick (`setInterval`)

`RHOMBIVERSE_SPEC_ASTEROIDS.md` section 4: a mined cell should regrow
as real time passes, not only on the player's next edit — a periodic
tick covers idle time between mutations. Deliberately does NOT go
through `onChange()` (which would push a phantom undo-stack entry and
re-save on every tick even when nothing regrew) — only rebuilds
instances and persists when `applyAsteroidRegeneration` actually
changed the cell count. Regrown cells still sync to Shared World
normally, since `world.addCell` (called inside
`applyAsteroidRegeneration`) fires the same `onAdd` hook as any other
cell placement.

`RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` section 4: decay never changes
cell count (it only touches `playerInventory`), so it can't be gated
behind the same before/after cell-count check above — but the
inventory hint still needs to reflect it as it happens, not only after
the player's next unrelated edit.

`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`: same "periodic tick covers idle
time" reasoning as asteroid regrowth above, and the exact same "don't
route through `onChange()`" avoidance — but checked independently of
the cells before/after comparison, since growth never touches `cells`
at all (a seed's own tiles live entirely in `seeds`, per the spec's
Isolation section).

`RHOMBIVERSE_SPEC_EVOLUTION_ECOSYSTEM.md` section 4: the same
periodic-tick shape covers real elapsed time for organisms too — most
ticks resolve zero generations (`EVOLUTION_GENERATION_INTERVAL_MS` is
30s, this tick is 5s) and are cheap no-ops, exactly like `applyGrowth`'s
own cooldown above. Gated off while Shared World is active for the same
reason the initial on-load resolve is (see `resolveEvolution`'s own
header — no sync path yet).

Real bug caught by a live Playwright run before trusting this:
`resolveCatchUpForAllPlanetoids` advances each planetoid's own
`lastSimulated`/`rngState` bookkeeping in the LIVE in-memory world
object on every call, even when zero generations resolve — that part is
correct and accumulates fine across ticks within one continuous
session. But this used to only call `saveToLocalStorage` when
`resolveEvolution` returned true (something visibly changed), exactly
mirroring `applyGrowth`'s own pattern above — which is wrong here
specifically, because unlike a growth seed (whose `lastGrowthAt` is
never touched at all unless real growth happens), a brand-new
planetoid's very first resolve falls back to `now` as its baseline
`lastSimulated` and only that in-memory value ever advances it
correctly afterward. A page reload before the first real generation
ever resolves (up to a 30s window) would have lost that in-memory
baseline entirely, silently resetting the clock. Saving on every tick
that has at least one organism to track (regardless of whether this
specific tick grew anything) closes that gap.

## Pyramid Sub-Cell (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md)

Full geometry/hit-resolution derivation: `core/pyramid.md`. This section
covers the render-architecture and access-method decisions specific to
this file.

**Access method (spec section 3, left genuinely open there)**: two new
`currentMode` values, `pyramidModel`/`pyramidSculpt`, wired through the
exact same single build-scene + mode-button mechanism already used for
the 7 other whole-block tools (build/fill/excavate/round/generate/
replace/report) — mirroring Rhombi-model/Rhombi-sculpt's own existing
'build'/'sculpt' pair. Neither of the spec's own two listed options (reuse
`latticezoom.js`'s "zoom", or a whole separate scene+camera mode like
Sculpture Mode) survived checking directly: `latticezoom.js`'s "zoom" is
a genuinely different concept (generating a smaller NEW sub-lattice of
cells for organic-growth LOD, not editing an already-placed cell's own
real 7-piece structure) — routing through it would need just as much new
code as this did, for no real benefit. A whole separate scene+camera mode
is real extra weight (Sculpture Mode's own architecture) this tool
doesn't need, given the existing mode-button mechanism already does
exactly this job for 7 other tools.

**Why a mixed render architecture (InstancedMesh + individual meshes)**:
`InstancedMesh` requires every instance to share one exact `BufferGeometry`
— fine for the pre-existing case (every cell is a full, identical RD), but
a cell missing one or more pyramids has a genuinely different shape.
`isPartialCell`/`visibleCells` exclude any cell with a non-full
`pyramids` value from the shared `mesh` (the main InstancedMesh);
`rebuildPartialCellMeshes` (folded into `rebuildInstances` itself, so
every one of that function's existing 7 call sites gets this for free
with zero extra wiring) gives each partial cell its own individual
`THREE.Mesh`, geometry built by feeding `ConvexGeometry` the cube's 8
points plus only the currently-present apexes (`pyramidPieces` +
`presentAxisKeys`) — always convex and always exactly right, since the
convex hull of ANY subset of a convex polytope's vertices is itself
convex; no custom face/triangle bookkeeping needed for the mesh itself.
Kept in their own `partialCellGroup`, disposed (geometry + material) and
removed the moment a cell either gets deleted entirely or returns to full.

**Why `core/build.js`'s `cellAt` callback changed from `(instanceId) =>`
to `(hit) =>`**: build.js's own header promises "Right-click always
removes the clicked cell, in every mode" — a partial cell needs to keep
working with that (and with fill/excavate/round/generate/report/replace),
not just with Pyramid mode's own raycaster. `extraPickTargets` (defaults
to `[]`, so every OTHER caller of `createBuildController` is unaffected)
lets `pick()` raycast `partialCellGroup` too; since a hit on an individual
Mesh has no `instanceId` (InstancedMesh-only), `cellAt` now receives the
whole hit and resolves either via `cellOrder[hit.instanceId]` or via
`partialCellMeshes.get(hit.object.userData.cellKey)`.

**Pyramid-model only ever needs to see partial cells, never the shared
InstancedMesh**: a fully-intact cell has no flat/missing pyramid face to
click "add" on in the first place (whole-block placement always places a
full RD) — a cell only ever becomes eligible for Pyramid-model after a
prior Pyramid-sculpt removed something from it. Pyramid-sculpt (remove)
does need to see both — most cells clicked for removal are still full
InstancedMesh instances.

**Real verification**: pure logic (`pyramidPieces`, the bitmask helpers,
both branches of `resolvePyramidAxisForHit`, a real `applyPyramidEdit`
round-trip through `createWorldStore`) checked directly in a real browser
via dynamic `import()`, not just reasoned about. Then a full real-click
end-to-end pass: seed a world with one cell via `localStorage`, real
`page.mouse.click()` in Pyramid-sculpt mode removes a pyramid (confirmed
both via the saved world JSON AND a screenshot showing a visibly different
facet), the same screen point in Pyramid-model mode re-adds it (screenshot
pixel-matches the original full-RD shape again). Both new wheel faces
(`WHEEL_BUILD`'s `bottom|sy1sz-1`, replacing its old `DUPLICATE_HOME_FACE`
per that face type's own documented policy; `WHEEL_ALTER`'s genuine open
`bottom|sx1sz-1` `SPARE`) checked live too — real icon markup present and
`has-icon`-classed on both, zero console/page errors throughout.

## `animate()` / `tickPresenceFn`

B6 tasks #40/#42: `tickPresenceFn` itself is `init()`-scoped (it needs
`world` and several panel DOM elements only created there), but
`animate()` is module-level — bridged the same way `onboardingCyborg`'s
`applyPersonaChoiceFn` is, a module-level slot `init()` fills in once
everything it needs actually exists. `dt`'s clamp (0.1s) avoids a huge
physics step after a tab is backgrounded and regains focus.
