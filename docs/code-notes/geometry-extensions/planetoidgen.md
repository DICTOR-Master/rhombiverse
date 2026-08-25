# Notes: `src/geometry-extensions/planetoidgen.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable — nothing here is
new, it's the exact commentary that used to sit inline. See
`CONTRIBUTING.md`'s "Ground rules" for why this split exists.

## File header — why formula-driven generation exists at all

Formula-driven planetoid generation. Reuses the same shell math already
central to this project (`cellsInShells`/`shellCount(n) = 10n^2+2`) to
build recognizable body types (rocky planetoid, ice moon, gas giant) in
ONE click, rather than requiring precise face-by-face hand-building —
exactly the fragility documented in `CLAUDE.md`'s frost-line
verification entry (shared-face midpoints vs. neighbor centers, a fixed
camera walking distant click targets off-canvas or into occlusion).

Every recipe stamps exactly one Blackstar-Glassite cell at the center:
gravity in this game is entirely tied to BSG
(`RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` section 4 — "a planetoid is
only gravity-active... if it has at least one Blackstar-Glassite
cell"), so a generated body needs one to be walkable/gravitationally
coherent at all. That's a hard constraint of the existing mechanic, not
invented lore.

Per-shell composition gradients (dense core -> lighter crust, an icy
moon's rock-then-ice layering, a gas giant's small rocky core under a
large translucent envelope) directly mirror real planetary
differentiation and this project's own established Grounded Simplicity
convention: borrow the real gradient, don't invent an arbitrary one.
Gas giants reuse Glassite ("translucent... no gravity function," per
`RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` section 2) as the atmosphere
material rather than minting a new one — same "reuse before inventing"
move as Star System's own Ferrostone-as-carbon-catalyst choice.

## `fractionalRecipe`

`bands`: `[[endFraction, material], ...]` in ascending fraction order —
as simple a per-shell formula as reasonably possible: which band a
shell's fractional depth (`shell/totalShells`) falls into decides its
material, nothing more elaborate.

## `surfaceNoise`

Deterministic pseudo-random value noise — the standard GLSL sine-hash
technique (borrowed, not invented, per Grounded Simplicity), quantized
to a patch grid so nearby cells usually land in the same bucket and
read as chunky coastlines/lake patches rather than salt-and-pepper
speckle. Same input always produces the same output, so a generated
body is reproducible from its own coordinates alone — no seed needs to
be stored anywhere.

## `oceanicRecipe`

A layered body with OPEN water on the surface (oceans/lakes), distinct
from ice-moon/ice-giant's icy-mantle-reaches-the-surface design: per
direct request, ice belongs NEAR THE CORE (a buried layer, same real
basis as Europa/Enceladus subsurface oceans — ice-moon's own existing
justification, reused here) while the crust itself is a genuine mix of
dry land and standing water bodies, so there's always land to plant
`RHOMBIVERSE_SPEC_PENROSE_GROWTH.md`'s growth-layer life on.
`waterFraction` (0..1) is the one tunable knob varying the three
presets below — higher means more of the crust reads as ocean rather
than continent. The subsurface ice band still auto-permeates to
(subsurface) water via `hydrosphere.js` the instant the body loads,
same established mechanic as ice-moon/ice-giant — not prevented here,
since a buried liquid layer under solid crust is the correct real-world
reading (a subsurface ocean), not a bug to work around.

Layer breakdown (by fractional distance `f` from center):
- `f <= 0.18`: `ferrostone` — dense core.
- `f <= 0.4`: `ice99` — buried ice layer near the core, auto-permeates
  to a subsurface ocean.
- `f <= 0.62`: `garnet` — rocky mantle separating the subsurface ocean
  from the crust.
- Crust (beyond 0.62): dry land by default, open water in patches
  sized/positioned by `surfaceNoise` — `'water'` is placed directly
  (already the terminal liquid material, no permeation step needed) so
  oceans/lakes are visible immediately on generation, not only after
  `hydrosphere.js`'s next pass.

## `PLANETOID_RECIPES`

- `rocky`: dense core / mantle / crust, the plainest three-band recipe.
- `ice-moon`: rocky/metallic core, per real icy moons (Europa,
  Enceladus), then an icy shell that auto-permeates via
  `hydrosphere.js` since it's in the same BSG cluster.
- `gas-giant`: small dense core under a large translucent "atmosphere"
  envelope.
- `ice-giant`: distinct from both ice-moon (ice reaches the surface, no
  atmosphere) and gas-giant (no ice layer at all) — real ice giants
  (Uranus, Neptune) are a small rocky/metallic core wrapped in a deep
  water/ammonia/methane "ices" mantle, topped with a comparatively thin
  H/He/CH4 atmosphere, the defining three-layer structure that
  separates them from gas giants. Layers: small rocky/metallic core ->
  deep icy mantle (auto-permeates via `hydrosphere.js`) -> thin
  translucent outer atmosphere.
- `arid-world` / `continental` / `ocean-world`: three points along one
  real gradient — how much of a rocky body's surface is open water vs.
  dry land — rather than three unrelated recipes, per the direct
  request for "varying water surface" bodies. All three share the exact
  same layering (core -> subsurface ice -> rocky mantle -> land/water
  crust); only `waterFraction` differs (0.12 scattered oases/mostly dry
  land — roomiest for sowing life; 0.42 Earth-like balance; 0.72 mostly
  ocean with scattered islands — land is the rare resource here).

## `generatePlanetoid`

Builds a full body in one call: the given center becomes the
Blackstar-Glassite gravity core (overwriting whatever was there —
"generate a planetoid here" means this location becomes the new
anchor, a deliberate replacement like New World, not an incremental
grow). Skips cells that already exist (never overwrites other real
player-built matter) and respects `canPlaceMaterial` (the Star System
frost line) exactly like Fill mode does — restricted candidates are
simply skipped, not blocked as a whole action.

Selects cells by TRUE Euclidean distance from center (`<= radius`), not
raw BFS shell membership — a BFS "shell" in this 12-neighbor lattice is
a rhombic-dodecahedron-shaped level set of the graph metric (this
project's own voxel shape, expressed at planetoid scale), not a sphere:
`build.js`'s `roundStructure` already documents shell N's real
distances ranging from N up to `N*sqrt(2)`, which is exactly why a raw
shell-fill body reads as faceted/pointed rather than round.
`cellsInShells(..., radius)` is still the right candidate pool — shell
N's minimum real distance is exactly N, so no cell within Euclidean
`radius` can ever sit at a BFS shell greater than `radius` — but
membership is now decided by real distance, giving a genuinely round
body instead of a shell-shaped one needing a separate Round pass
afterward. `shell` (BFS integer) is still stamped per cell for
compatibility with everything else that groups by it (gravity
core-cavity sizing, the ring panel, Round/Excavate).

`materialForCell` (`oceanicRecipe`) needs the cell's own coordinates
for surface noise; `materialForShell` (every other recipe) only ever
needed depth, so it's untouched — one or the other is always defined,
never both.
