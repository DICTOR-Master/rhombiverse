// The geared slider shared by the 4D and 6D panels: relative drag (the
// thumb doesn't jump to the finger; one drag across the whole track
// changes the value by `perSweep()`), no coasting, and on release a snap
// to the nearest click-stop within `snap()`. Everything is a function so
// the owner can switch what the slider controls without rebuilding it.
// Markup: a `.w4d-track` holding `.w4d-ticks` and `.w4d-thumb`.
export function createGearedSlider(track, { value, setValue, limit, perSweep, detents, snap, onEnd = () => {} }) {
  const thumb = track.querySelector('.w4d-thumb');
  const ticks = track.querySelector('.w4d-ticks');

  function render() {
    const L = limit();
    const ds = detents();
    // Labels read rightward from their ticks, so a labelled last tick needs
    // room past it (about 6.5px a character plus the indent) or its label
    // hangs off the end of the track; ticks and thumb share that margin.
    const last = ds.find(({ v, below }) => !below && (v + L) / (2 * L) > 0.95);
    const right = last?.label ? Math.max(17, Math.ceil(22 + 6.5 * String(last.label).length)) : 17;
    ticks.style.right = `${right}px`;
    ticks.innerHTML = ds.map(({ v, label, below }) => `<span class="w4d-tick${below ? ' w4d-tick-below' : ''}" style="left:${((v + L) / (2 * L)) * 100}%">${label}</span>`).join('');
    thumb.style.left = `calc(17px + (100% - ${17 + right}px) * ${(value() + L) / (2 * L)})`;
  }

  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, start: value(), width: track.getBoundingClientRect().width || 1 };
    track.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    setValue(Math.max(-limit(), Math.min(limit(), drag.start + ((e.clientX - drag.x) / drag.width) * perSweep())));
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    const v = value();
    const near = detents().filter((d) => Math.abs(d.v - v) <= snap()).sort((a, b) => Math.abs(a.v - v) - Math.abs(b.v - v))[0];
    if (near) setValue(near.v);
    onEnd();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  return { render };
}
