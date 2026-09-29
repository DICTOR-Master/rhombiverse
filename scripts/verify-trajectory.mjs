// Checks src/geometry-extensions/trajectory-1d.js (1D Signal):
// - standard Morse timing (PARIS = 50 units with its word gap, SOS = 27);
// - text -> cells -> text round trip;
// - the moving chain carries m(u) (one signal, every view);
// - E(s): unit speed, continuous, and a chord on screen is never longer
//   than the distance along s (the world's only metric).
import { morseSequence, decode, totalUnits, signal, waveAt, embed, tangentAngle, GAP_UNITS, MORSE, letterEnds, keyedElement, keyedGap, KEY_MS } from '../src/geometry-extensions/trajectory-1d.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}

check('PARIS is 43 units, 50 with its word gap (the standard word)', totalUnits(morseSequence('PARIS')) === 43 && totalUnits(morseSequence('PARIS')) + GAP_UNITS.word === 50);
check('SOS is 27 units', totalUnits(morseSequence('SOS')) === 27);
{
  // The pulse key: S O S keyed with a relaxed hand reads back as SOS, and
  // a long pause makes a word break.
  const presses = [[90, 0], [90, 200], [90, 200], [400, 900], [400, 200], [400, 200], [90, 2500], [90, 200], [90, 200]];
  const keyed = [];
  presses.forEach(([held, pause], i) => { if (i) keyed.push(keyedGap(pause)); keyed.push(keyedElement(held)); });
  check('the pulse key: short is a dot, held is a dash; a pause ends a letter, a longer one a word', decode(keyed) === 'SO S' && keyedElement(KEY_MS.dash - 1).type === 'dot' && keyedElement(KEY_MS.dash).type === 'dash', decode(keyed));
  const ends = letterEnds(morseSequence('HI YO'));
  check('letters arrive in order, each once its last cell has passed', ends.map((l) => l.text).join('') === 'HI YO' && ends.every((l, k) => !k || l.end >= ends[k - 1].end) && ends.at(-1).end === totalUnits(morseSequence('HI YO')));
}
check('two words: one 7-unit gap between them', morseSequence('E E').map((c) => c.units ?? c.type).join(',') === 'dot,7,dot');
const all = Object.keys(MORSE).join('');
check('every Morse character round-trips', decode(morseSequence(all)) === all);
check('words round-trip', decode(morseSequence('Hello world 42')) === 'HELLO WORLD 42');
check('characters with no Morse code are skipped', decode(morseSequence('a~b')) === 'AB');

// One signal: the moving train read at a fixed point is m(t).
{
  const cells = morseSequence('SOS');
  const L = totalUnits(cells), P = L + GAP_UNITS.word;
  let ok = true;
  for (let t = 0; t < 120; t += 0.37) if (waveAt(cells, 0, t) !== signal(cells, t)) ok = false;
  check('a reader ahead (at the front, u = 0) reads m(t): the message in order', ok);
  let rest = true;
  for (let u = -L + 0.013; u < 0; u += 0.29) {
    // At t = 0 the train is laid out at u = -s: its first cell in front.
    if (waveAt(cells, u, 0) !== signal(cells, -u)) rest = false;
  }
  check('at rest the first cell is in front (u = -s)', rest);
  let same = true;
  for (let t = 0; t < 60; t += 0.41) for (const u of [0.5123, 3.2071, 11.7313]) {
    // Rigid motion forward: what u shows at t, u - t showed at 0.
    if (waveAt(cells, u, t) !== waveAt(cells, u - t, 0)) same = false;
  }
  check('it travels away, forward at unit speed, as a whole', same);
  let period = true;
  for (let t = 0; t < 30; t += 0.53) if (waveAt(cells, 1.7, t) !== waveAt(cells, 1.7, t + P)) period = false;
  check(`it repeats every pass (the chain plus a word gap, ${P} units)`, period);
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
  const [xa, ya] = embed(0), [xb, yb] = embed(200);
  check('and is really shorter where it bends: E is not distance-preserving', Math.hypot(xb - xa, yb - ya) < 200 - 0.2, `${Math.hypot(xb - xa, yb - ya).toFixed(2)} on screen for 200 along s`);
  let straight = true;
  for (let s = -100; s < 300; s += 1.3) if (Math.abs(tangentAngle(s) - Math.PI / 2) > 0.12) straight = false;
  check('nearly straight and vertical: never more than 7° off straight up the screen', straight);
}

console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
