# Notes: `src/app/piece-cluster-3d.js`

Full design rationale/history for this file's exports, moved out of the
source so the code itself stays lite and readable. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## Why this exists

Third design pass on the Piece picker in one session (flat strip -> flat
CSS grid -> flat SVG with real projected geometry -> this). The flat SVG
version (`docs/code-notes/app/wheel-pickers.md` has its own real vertex-
sharing computation, still valid and reused here) was geometrically exact
but, once actually compared side-by-side against a real wheel screenshot,
"easily distinguishable from the real wheel" — a flat SVG has no genuine
perspective foreshortening and no real per-face directional-light
shading, and no amount of CSS gradient/shadow tuning can produce either.
This is a real WebGL render instead, so it doesn't have to fake either.

## Rendering technique: reused from `hud-wheel-3d.js`, not reinvented

Shares the MAIN scene's own `THREE.WebGLRenderer` via a scissor/viewport
sub-region each frame, exactly like the persistent HUD wheel — that
file's own header explains why (a second full-scene WebGL renderer was a
real, already-found perf cost; a shared-renderer scissor patch avoids
it). Real differences from the HUD wheel, all deliberate:

- **Centered on screen, not corner-anchored** — this widget is a modal
  picker, not a persistent HUD element.
- **`SKELETON_COLOR` (`#4DD0E1`) translucent wireframe fill, not the HUD
  wheel's opaque gold** — direct clarification mid-session that "the
  real RD" meant the MAIN Rhombic Wheel 3D's own material style, not the
  HUD wheel's (`hud-wheel-3d.js`'s `GOLD = 0xd4af37`) — they'd been
  confused for each other once already.
- **A fixed rotation, no drag** — `group.rotation.set(0, -Math.PI / 2,
  0)` is `hud-wheel-3d.js`'s OWN already-verified "looks straight down
  the 4-valent vertex (2,0,0)" rotation, reused verbatim rather than
  re-derived, since it's the exact same real vertex-view this widget
  needs. This picker never needs to rotate — all 4 real options are
  already visible at once, unlike the HUD wheel's 9 real faces spread
  across all 12 slots.
- **Only rendered/listened-to while actually open** — `render()` is a
  no-op unless `isOpen`, called unconditionally every frame from
  `render.js`'s own `animate()` anyway (same "let the widget gate its
  own work" pattern the HUD wheel's always-on `render()` established).

## The "floating over the world, not a box" fix

The naive version of this (first real screenshot taken) showed a
visible solid dark rectangle behind the wheel — because `renderer.
render(scene, camera)` clears the scissor region's color buffer by
default, and this widget's own scene has nothing to show through where
its geometry doesn't cover. The HUD wheel has this same artifact
(visible as a small dark square in its own corner in nearly every
screenshot this project has ever taken) but it's small and corner-
anchored, so it reads as acceptable there; centered and this much
larger, it read as a floating box instead of a wheel reaching into the
scene.

Real fix, not a cosmetic patch: the MAIN scene already rendered the live
world into this exact canvas region earlier in the SAME animation frame
(this widget only opens once the modal Rhombic Wheel 3D itself has
closed, so the main scene is rendering normally). Setting `renderer.
autoClear = false` for just this widget's own `renderer.render()` call
leaves that real frame showing through everywhere this mini-scene
doesn't draw, instead of clearing to black — genuinely floating over the
world. `renderer.clearDepth()` still runs first, constrained to the
active scissor rect (WebGL's scissor test constrains `clear()` calls
too, confirmed via the real rendered result, not assumed from reading
the WebGL spec) — so the mini-wheel's own faces still occlude each
other correctly, they just don't fight leftover depth values from the
world's own geometry at those same pixels. `autoClear` is restored to
`true` immediately after, every frame, so the main scene's own next
render is unaffected — verified live: dragging to orbit the main scene
immediately after closing this picker renders perfectly cleanly, no
leftover artifacts.

Deliberately NOT applied to the HUD wheel — that's a separate, already-
shipped, unrelated component; this fix is scoped to what actually needed
it, not a blanket "fix" applied on the assumption the same issue matters
equally everywhere.

## Real bug caught by a screenshot, not assumed

The widget's own vertical centering (`updateRect`) originally sat close
to true screen center. A real screenshot showed the "Cube" face's own
hover-reveal label — which sits outward from the wheel's own rect,
same as every other face's label — landing directly under the welcome
tutorial panel's own dialog box, unreadable. Nudged the whole widget's
`cssY` further up (`-70` instead of `-20`) to give real clearance;
confirmed via a second screenshot showing the label clear of the dialog.
