# Rhombiverse

A world built from a single honest rule: everything is made of rhombi, and
rhombi obey two different kinds of order at once. One is a crystal — rigid,
repeating, minable, buildable, the same everywhere you look, the geometry
real garnet already grows in. The other is a quasicrystal — aperiodic,
five-fold, never quite repeating, the geometry evolution already reaches for
in flowers and shells. Nothing here is arbitrary; every shape traces back to
real crystallography and real mathematics.

From that one rule: raise a mountain range face-by-face from a single seed
block, fill a sphere and stand on the surface of your own planetoid with
gravity bending toward its core, plant something and let five-fold growth
rules unfold it into a tree or a shell, leave a crystal field untouched and
come back to find it larger. It's less a building game than a small,
coherent universe of shape.

See `RHOMBIVERSE_PLAN.md` section 6 for the full vision statement, and
`CLAUDE.md` for a technical map of this repo.

## What this is (right now)

**Phase 1** (renderer + lattice math), **Phase 2** (build/remove), and
**Phase 3** (local persistence — builds survive a refresh; New World /
Export JSON / Import JSON) are all implemented and visually confirmed.

**Planetoid tools**, pulled forward ahead of Phase 5.5. Pick a **mode**
with the Build / Fill / Round / Excavate buttons on the left — a plain
click then does whatever that mode does, and only the controls relevant
to that mode are shown. **Right-click always removes the clicked cell,
in every mode.**
- **Build** — click a face to add the neighboring cell (default mode).
- **Fill** — click a cell to fill shells ("hollow from"–"radius") outward
  around it, approximating a sphere. A second Fill click on the same
  structure grows it further rather than starting a new one.
- **Round** — click a shell-tagged cell to smooth its outer boundary.
  Shell-based fills are naturally faceted; round reselects the boundary
  by actual distance from center instead, trimming the far points and
  filling the gaps that leaves.
- **Excavate** — click an already-built structure to hollow it out down
  to "Hollow from shell", for retrofitting something you built solid.

A **material picker** selects which material new cells use (Base Rhomb,
Garnet, Ferrostone, Glassite, Star-Glassite, Blackstar-Glassite, Ice 9.9,
Water), each with its own tint — cosmetic only for now. A **section
view** (cutaway clipping plane, pick an axis/position/flip) lets you see
inside a structure instead of just its solid exterior.

On the right, a **shells panel** always shows the last-clicked
structure's shells as a live bullseye diagram (colored to match the 3D
view) plus a precise list with a remove button per shell — click a ring,
either in the diagram or the list, to delete it. A prominent **Undo**
button at the top covers every mutating action (Build/Fill/Round/
Excavate/ring removal/New World/Import), not just ring removal, up to
20 steps back.

Phase 4 (deploy publicly) is next — see `RHOMBIVERSE_PLAN.md` section 4
for the full phased build order. `docs/RHOMBIVERSE_COMPLIANCE.md`'s
"Required before Phase 4" items (LICENSE, ToS, Privacy Policy,
SECURITY.md, XSS audit) haven't been started yet.

## Structure

```
rhombiverse/
  index.html              # static entry point, Three.js via import map, no build step
  src/
    lattice.js             # RD/FCC coordinate math, 12-neighbor lookup
    render.js               # Three.js scene + RD mesh generation
    build.js                 # placement/removal, face-picking, input
    worldstate.js           # world JSON load/save/serialize
    persistence.js          # storage backend (localStorage first)
  data/
    starter-world.json      # single seed cell at the FCC origin
  docs/                    # design specs (see below)
  RHOMBIVERSE_PLAN.md     # construction-order plan -- read this first
  README.md
```

## Design documents (`docs/`)

Read `RHOMBIVERSE_PLAN.md` (repo root) first, then `docs/RHOMBIVERSE_PRINCIPLES.md`
(the cross-cutting design law every other doc complies with). The rest are
standalone addenda, each extending specific phases of the plan:

| Doc | Extends |
|---|---|
| `RHOMBIVERSE_PRINCIPLES.md` | Cross-cutting law: Grounded Simplicity, Isolation, Adaptive Damping |
| `RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md` | Phase 5.5 — planetoid building, radial gravity, BSG core |
| `RHOMBIVERSE_SPEC_BLACKHOLE.md` | Planetoid gravity — extreme case, asymptotic containment |
| `RHOMBIVERSE_SPEC_STAR_SYSTEM.md` | Planetoid gravity + water/ice — BSG at star scale |
| `RHOMBIVERSE_SPEC_SUPERNOVA.md` | Star system — Chandrasekhar-style mass threshold |
| `RHOMBIVERSE_SPEC_WATER_ICE.md` | Asteroids + planetoid gravity — hydrosphere/atmosphere |
| `RHOMBIVERSE_SPEC_ASTEROIDS.md` | Plan Phase 2 — resource acquisition, mining |
| `RHOMBIVERSE_SPEC_REGIONS.md` | Plan section 2/Phase 5.8 — ownership claims |
| `RHOMBIVERSE_SPEC_TRADE_INVENTORY.md` | Asteroids — barter trade, resource decay |
| `RHOMBIVERSE_SPEC_LOOPHOLES.md` | Patches gaps across regions/supernova/blackhole/asteroids/trade |
| `RHOMBIVERSE_COMPLIANCE.md` | Legal/safety checklist, phased by when each item is required |

## Running (once Phase 1 exists)

No build step — plain ES modules loaded via an import map in `index.html`.
Serve the directory with any static file server, e.g.:

```
cd ~/rhombiverse
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
