// Construct (1D → primitive), the data model of DICTO's Dimensional
// Construction Interface (docs/DIMENSIONAL_CONSTRUCTION_INTERFACE.md).
// Pure, no THREE (verify:construction). The doc's terms, kept apart:
// - axis direction: X, Y, Z, W, V, U, … (index 0, 1, 2, …; open-ended);
// - axis instance: one line in a direction, at a base point;
//   parallel axes = instances sharing a direction;
// - cell: one unit interval on an instance (instance + index along it);
// - junction: where another direction becomes available. It never
//   replaces an axis: exposing Y adds to X.
// - primitive: what the filled cells compose (square, cube, tesseract…).
//
// Construction rule (the hypercube family, side n cells): the primitive
// is the grid of unit cells filling [0, n]^d, i.e. every X-, Y-, …
// directed line through its lattice points. The rule for when things
// become available:
// - directions are exposed in order; X from the start, the next one at
//   the junction at the origin once the first instance of the latest
//   direction (the one through the origin) is completely filled;
// - an instance is available once its direction is exposed and its base
//   point has been reached (the origin, or the end of a filled cell);
// - its cells fill in order from the base (●—●—○—○).
// Other families (Kagome, pentagon → dodecahedron) get their own rules
// later, each verified first (the doc's §17).

export const AXES = ['X', 'Y', 'Z', 'W', 'V', 'U'];
export const axisName = (i) => AXES[i] ?? `A${i + 1}`;
export const AXIS_COLORS = { X: 0xff5d6c, Y: 0x5fd38a, Z: 0x4da3ff, W: 0xffc857, V: 0xd46cff, U: 0x22c3e6 };

export const PRIMITIVES = [
  { id: 'square', label: 'Square', d: 2 },
  { id: 'cube', label: 'Cube', d: 3 },
  { id: 'tesseract', label: 'Tesseract', d: 4 },
];
export const N_MIN = 1;
export const N_MAX = 8;

const key = (p) => p.join(',');

/** Every axis instance and cell of the d-dimensional grid of side n. */
export function buildGrid(d, n) {
  const instances = [];
  const cells = [];
  for (let dir = 0; dir < d; dir++) {
    // Base points: coordinate `dir` is 0, the others 0..n.
    const others = [...Array(d).keys()].filter((a) => a !== dir);
    const count = (n + 1) ** others.length;
    for (let m = 0; m < count; m++) {
      const base = Array(d).fill(0);
      let r = m;
      for (const a of others) { base[a] = r % (n + 1); r = Math.floor(r / (n + 1)); }
      const inst = { id: instances.length, dir, base, cells: [] };
      instances.push(inst);
      for (let i = 0; i < n; i++) {
        const from = [...base]; from[dir] += i;
        const to = [...from]; to[dir] += 1;
        const cell = { id: cells.length, instance: inst.id, index: i, dir, from, to };
        cells.push(cell);
        inst.cells.push(cell.id);
      }
    }
  }
  return { d, n, instances, cells };
}

/** A construction: the grid plus what's been done to it. */
export function createConstruction(d, n, saved = null) {
  const grid = buildGrid(d, n);
  const filled = new Set((saved?.filled ?? []).filter((id) => Number.isInteger(id) && id >= 0 && id < grid.cells.length));
  let exposed = Math.max(1, Math.min(d, saved?.exposed ?? 1)); // X, or X..the exposed count
  const origin = key(Array(d).fill(0));
  const originInstance = (dir) => grid.instances.find((ins) => ins.dir === dir && ins.base.every((c) => c === 0));

  function reached() {
    const r = new Set([origin]);
    for (const id of filled) r.add(key(grid.cells[id].to));
    return r;
  }
  function instanceAvailable(ins, R = reached()) {
    return ins.dir < exposed && R.has(key(ins.base));
  }
  /** 'filled' | 'available' | 'unavailable' for every cell. */
  function states() {
    const R = reached();
    return grid.cells.map((c) => {
      if (filled.has(c.id)) return 'filled';
      const ins = grid.instances[c.instance];
      if (!instanceAvailable(ins, R)) return 'unavailable';
      return c.index === 0 || filled.has(ins.cells[c.index - 1]) ? 'available' : 'unavailable';
    });
  }
  /** The junction that can expose the next direction, if it's ready:
   * at the origin, once the latest direction's origin instance is full. */
  function junction() {
    if (exposed >= d) return null;
    const ins = originInstance(exposed - 1);
    if (!ins.cells.every((id) => filled.has(id))) return null;
    return { at: Array(d).fill(0), exposes: exposed };
  }
  function expose() {
    if (!junction()) return false;
    exposed += 1;
    return true;
  }
  function fill(id) {
    if (states()[id] !== 'available') return false;
    filled.add(id);
    return true;
  }
  /** Unfill: only a cell nothing else depends on (the last filled on its
   * instance, whose end starts no instance with filled cells), and not a
   * cell whose instance opened the next direction once that's in use. */
  function canUnfill(id) {
    if (!filled.has(id)) return false;
    const c = grid.cells[id];
    const ins = grid.instances[c.instance];
    if (c.index < ins.cells.length - 1 && filled.has(ins.cells[c.index + 1])) return false;
    const end = key(c.to);
    if (grid.instances.some((o) => key(o.base) === end && o.cells.some((x) => filled.has(x)) && o.id !== ins.id)) return false;
    // Keep reachability: the end must not be the only way to a base in use.
    if (exposed > c.dir + 1 && originInstance(c.dir).id === ins.id) {
      const nextUsed = grid.cells.some((x) => x.dir > c.dir && filled.has(x.id));
      if (nextUsed) return false;
    }
    return true;
  }
  function unfill(id) {
    if (!canUnfill(id)) return false;
    filled.delete(id);
    const c = grid.cells[id];
    // The next direction closes again if its junction no longer holds
    // and nothing was built with it.
    while (exposed > 1 && !grid.cells.some((x) => x.dir >= exposed - 1 && filled.has(x.id)) && !originInstance(exposed - 2).cells.every((x) => filled.has(x))) exposed -= 1;
    return c;
  }
  const complete = () => exposed === d && filled.size === grid.cells.length;
  const progress = () => ({ filled: filled.size, total: grid.cells.length });

  return {
    grid, states, junction, expose, fill, unfill, canUnfill, complete, progress,
    get exposed() { return exposed; },
    get filled() { return filled; },
    toJSON: () => ({ exposed, filled: [...filled].sort((a, b) => a - b) }),
  };
}
