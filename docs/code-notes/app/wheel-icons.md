# Notes: `src/app/wheel-icons.js` and the Icon System's first real pass

Full design rationale/history, moved out of the source so the code
itself stays lite and readable. See `CONTRIBUTING.md`'s "Ground rules"
for why this split exists. Covers `wheel-icons.js` plus its wiring into
`rhombic-wheel-3d.js`.

## Scope of this pass

`RHOMBIVERSE_SPEC_ICON_SYSTEM.md` (outside this repo) is a full spec:
frame, reveal-on-touch, 17 resolved marks. 2026-08-26 direct instruction
was to skip cautiously piloting the infrastructure on one wheel first --
"we already have two wheels that work, [the main one already renders
real faces,] the HUD already is symbols alone" -- so this pass builds
the real infrastructure (frame, reveal-on-touch) and wires it in
directly across every wheel at once, not incrementally.

**What did NOT get built**: a mark for every real action across all 8
wheels. The spec's own section 4 table only resolves ~15 of the ~30+
real actions in `rhombic-wheel-3d-core.js` -- `tool:material`,
`tool:repeat`, `tool:pattern`, `tool:generateBody`, `tool:dome`,
`tool:spiralColumn`, `tool:templates`, `tool:plant`,
`tool:growthParams`, `tool:prune`, `tool:offer`, `tool:accept`,
`tool:inventory`, and the `Build`/`Alter`/`Construct` department-nav
faces themselves have no row in the table at all. The spec explicitly
says not to guess silently on unresolved items (section 5's own
framing) -- so `ACTION_TO_MARK` in `rhombic-wheel-3d.js` only maps the
genuinely resolved subset; every unmapped face keeps its existing plain
text label, completely unchanged. This is a real, load-bearing gap, not
an oversight -- see the list above for exactly what's still open.

## `wheel-icons.js`

`iconFrame(markSvg, { title })`: the universal container (spec section
2) -- a circle plus a regular hexagon whose 6 vertices touch it, real
trig (`hexPts`), not eyeballed. This same hexagon outline doubles as
"the one hexagon" referenced by every single-hexagon mark (e.g. Rhombi-
model's "+ inside one hexagon") -- no redundant nested hexagon drawn for
those; only multi-hexagon/multi-rhombus marks (Fill, Replace, Rhombisis,
Shell Brush) draw their own smaller shapes inside the frame.

`MARKS`: one SVG fragment per resolved concept, all authored in the same
-50..50 coordinate space as the frame so they compose directly.
Generated from real computed vertex coordinates (`hexPts`/`rhombusPts`
helpers, verified well-formed XML and visually reviewed as a rendered
gallery before shipping -- 2 of the first pass's marks, `rhombitect` and
`symmetryMirror`, turned out to draw their extra geometry directly on
top of the frame's own hexagon edges and were nearly invisible when
actually rendered; both were redone with geometry clearly inset/offset
from the frame instead of retracing it. Caught by actually looking at
the rendered gallery, not by reading the SVG source.

`cyborg`'s mark is not new geometry -- it's the live cross-walk's own
resolution (see `bcc-build.md`'s icon-system section): reuses the HUD
wheel's existing ◈ character verbatim via a `<text>` element, since
Cyborg already has a real shipped icon and the spec's own two candidate
directions (diamond-based / target-brackets) would have been a second,
competing symbol for the same concept -- direct instruction: no two
symbols for one purpose.

## Wiring into `rhombic-wheel-3d.js`

`ACTION_TO_MARK`: action-string -> `MARKS` key, not label-string -- more
stable, and a single mapping this way automatically gives the SAME icon
to every duplicate/quick-access copy of a function across every wheel
(they all share the same `action` value by construction already), with
zero extra bookkeeping.

Label creation: a face with a resolved mark gets `.has-icon` and two
children -- `.rw3d-label-icon` (the `iconFrame()` output, always
present) and `.rw3d-label-text` (the existing plain-text label,
`opacity: 0` by default). Everything else is untouched, still a bare
text node, exactly as before.

Reveal-on-touch (spec section 3): `.rw3d-label-text`'s opacity is
CSS-toggled by a `.reveal` class, layered on TOP of (not replacing) the
existing per-frame facing-driven opacity animation on the parent
`.rw3d-label` (`updateLabelsAndFaceVisuals()`, unmodified) -- CSS
opacity multiplies down the tree, so the resting state genuinely reads
as "icon only, faded in as you rotate toward it" (existing behavior,
now driving the icon instead of text) and the text ONLY shows once
BOTH the face is front-facing enough AND revealed. Desktop:
`pointerenter`/`pointerleave` adds/removes `.reveal` directly. Touch has
no hover equivalent, so a hold timer (`REVEAL_HOLD_MS`, currently 350ms
-- spec explicitly leaves this tunable, "needs real testing on touch
devices") stands in, added alongside (not replacing) the label's
existing `pointerdown` → `startDrag()` call, so orbit-dragging a label
still works exactly as before. A quick tap still activates immediately
via the existing unmodified `click` → `selectFace()` handler, per the
spec's explicit requirement that reveal never gate activation.

## Verified live (Playwright)

WHEEL_HOME: 9 of 12 faces got real icons (the resolved subset), 3 kept
plain text (Construct, Lab/Settings, one duplicate) -- exactly matching
`ACTION_TO_MARK`'s real coverage, not a bug. Confirmed a rendered icon
(Almanac's four-diamond mark) visually via screenshot, correctly
inheriting the wheel's own cyan theme color through `currentColor`.
Confirmed the reveal mechanism itself with computed styles, not just
class names: a visible icon label's text starts at `opacity: 0`
(resting, symbol-only) and becomes `opacity: 1` after a real mouse
hover. Zero console/page errors throughout.

## Real remaining gap, for whenever this continues

Every action listed in "What did NOT get built" above still needs
either a resolved mark (added to both the spec's own table and
`MARKS`/`ACTION_TO_MARK`) or an explicit decision to leave it as plain
text permanently. Also unresolved from the spec itself: Dome/Spiral
Column's own marks (spec section 5 item 2 suggests plain text is fine,
not acted on either way yet), and reveal-timing tuning against a real
touch device (section 5 item 3).
