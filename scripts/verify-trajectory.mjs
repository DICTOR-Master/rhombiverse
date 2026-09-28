// Checks src/geometry-extensions/trajectory-1d.js (1D Signal):
// - standard Morse timing (PARIS = 50 units with its word gap, SOS = 27);
// - text -> cells -> text round trip;
// - m(u) and the travelling pulses agree (one signal, every view);
// - E(s): unit speed, continuous, and a chord on screen is never longer
//   than the distance along s (the world's only metric).
import { morseSequence, decode, totalUnits, signal, pulsesAt, embed, tangentAngle, GAP_UNITS, MORSE } from '../src/geometry-extensions/trajectory-1d.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}

check('PARIS is 43 units, 50 with its word gap (the standard word)', totalUnits(morseSequence('PARIS')) === 43 && totalUnits(morseSequence('PARIS')) + GAP_UNITS.word === 50);
check('SOS is 27 units', totalUnits(morseSequence('SOS')) === 27);
check('two words: one 7-unit gap between them', morseSequence('E E').map((c) => c.units ?? c.type).join(',') === 'dot,7,dot');
const all = Object.keys(MORSE).join('');
check('every Morse character round-trips', decode(morseSequence(all)) === all);
check('words round-trip', decode(morseSequence('Hello world 42')) === 'HELLO WORLD 42');
check('characters with no Morse code are skipped', decode(morseSequence('a~b')) === 'AB');

// One signal: the pulses seen at a fixed point s over time are m(t - s).
{
  const cells = morseSequence('SOS');
  let ok = true;
  for (let t = 0; t < 80; t += 0.37) {
    for (const s of [0.5123, 3.2071, 11.7313, 40.1177]) {
      const on = pulsesAt(cells, t).some(([a, b]) => s > a && s <= b) ? 1 : 0;
      if (on !== signal(cells, t - s)) ok = false;
    }
  }
  check('pulses on the trajectory at (s, t) = m(t - s): forward', ok);
  let okBack = true;
  const L = totalUnits(cells);
  for (let t = 0; t < 80; t += 0.41) {
    for (const s of [L - 0.5, L - 7.3, 2.2]) {
      const on = pulsesAt(cells, t, { from: L, dir: -1 }).some(([a, b]) => s > a && s <= b) ? 1 : 0;
      if (on !== signal(cells, t - (L - s))) okBack = false;
    }
  }
  check('reverse: pulses from the far end = m(t - (L - s))', okBack);
}

// E(s).
{
  let unit = true, chord = true, cont = true;
  for (let s = -60; s < 200; s += 0.731) {
    const h = 1e-3;
    const [x0, y0] = embed(s), [x1, y1] = embed(s + h);
    if (Math.abs(Math.hypot(x1 - x0, y1 - y0) / h - 1) > 1e-3) unit = false;
    if (Math.hypot(x1 - x0, y1 - y0) > 2 * h) cont = false;
    for (const d of [0.5, 5, 30]) {
      const [xa, ya] = embed(s), [xb, yb] = embed(s + d);
      if (Math.hypot(xb - xa, yb - ya) > d + 1e-9) chord = false;
    }
    const a = tangentAngle(s);
    const [xc, yc] = embed(s + 0.01), [xd, yd] = embed(s - 0.01);
    if (Math.abs(Math.atan2(yc - yd, xc - xd) - a) > 1e-3) unit = false;
  }
  check('E(s) moves at unit speed along its tangent', unit);
  check('E(s) is continuous', cont);
  check('screen distance (chord) never exceeds distance along s', chord);
  const [xa, ya] = embed(0), [xb, yb] = embed(60);
  check('and is really shorter where it bends: E is not distance-preserving', Math.hypot(xb - xa, yb - ya) < 60 - 0.5, `${Math.hypot(xb - xa, yb - ya).toFixed(2)} on screen for 60 along s`);
}

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
