// Checks src/geometry-extensions/trajectory-1d.js (1D Signal):
// - standard Morse timing (PARIS = 50 units with its word gap, SOS = 27);
// - text -> cells -> text round trip;
// - the moving chain carries m(u) (one signal, every view);
// - E(s): unit speed, continuous, and a chord on screen is never longer
//   than the distance along s (the world's only metric).
import { morseSequence, decode, totalUnits, signal, waveAt, embed, tangentAngle, GAP_UNITS, MORSE, letterEnds, readKeying, isCode, toCode, codeSequence } from '../src/geometry-extensions/trajectory-1d.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}

check('PARIS is 43 units, 50 with its word gap (the standard word)', totalUnits(morseSequence('PARIS')) === 43 && totalUnits(morseSequence('PARIS')) + GAP_UNITS.word === 50);
check('SOS is 27 units', totalUnits(morseSequence('SOS')) === 27);
{
  // The pulse key, read by the keyer's own rhythm: "CALL ME" (the direct
  // report that came out as "TETE ET ETI ETI TT E") keyed carefully and
  // slowly, briskly, and unevenly, reads back right each time.
  const keyAs = (text, { dot, dash, el, letter, word, jitter = 0 }) => {
    let r = 7;
    const j = (x) => { r = (r * 9301 + 49297) % 233280; return x * (1 + jitter * (2 * (r / 233280) - 1)); };
    const presses = [];
    let gapBefore = 0;
    for (const c of morseSequence(text)) {
      if (c.type === 'gap') { gapBefore = c.units === 7 ? word : c.units === 3 ? letter : el; continue; }
      presses.push({ held: j(c.type === 'dot' ? dot : dash), pause: j(gapBefore) });
      gapBefore = 0;
    }
    return decode(readKeying(presses));
  };
  const careful = keyAs('CALL ME', { dot: 260, dash: 750, el: 900, letter: 2200, word: 4500 });
  const brisk = keyAs('CALL ME', { dot: 90, dash: 270, el: 90, letter: 280, word: 650 });
  const uneven = keyAs('SOS HELP', { dot: 180, dash: 520, el: 300, letter: 900, word: 2000, jitter: 0.25 });
  check('the pulse key reads your own rhythm: careful, brisk and uneven keying all come out right', careful === 'CALL ME' && brisk === 'CALL ME' && uneven === 'SOS HELP', `${careful} | ${brisk} | ${uneven}`);
  const oneLetter = keyAs('C', { dot: 260, dash: 750, el: 900, letter: 2200, word: 4500 });
  const oneWord = keyAs('HELLO', { dot: 240, dash: 700, el: 800, letter: 2000, word: 4000, jitter: 0.15 });
  check('and a single careful letter, or one careful word', oneLetter === 'C' && oneWord === 'HELLO', `${oneLetter} | ${oneWord}`);
  // And a sweep: six messages at careful, normal and fast keying, each
  // with ±15% wobble in every press and pause, 10 hands each.
  const speeds = [{ dot: 260, dash: 750, el: 850, letter: 2100, word: 4300 }, { dot: 150, dash: 450, el: 170, letter: 500, word: 1200 }, { dot: 80, dash: 240, el: 80, letter: 240, word: 560 }];
  let right = 0, all = 0;
  for (const sp of speeds) for (const m of ['SOS', 'CALL ME', 'HELLO WORLD', 'THE QUICK FOX', 'MEET AT TEN', 'E T I M']) for (let seed = 1; seed <= 10; seed++) {
    let r = seed * 7919;
    const jj = (x) => { r = (r * 9301 + 49297) % 233280; return x * (1 + 0.15 * (2 * (r / 233280) - 1)); };
    const ps = []; let g = 0;
    for (const c of morseSequence(m)) { if (c.type === 'gap') { g = c.units === 7 ? sp.word : c.units === 3 ? sp.letter : sp.el; continue; } ps.push({ held: jj(c.type === 'dot' ? sp.dot : sp.dash), pause: jj(g) }); g = 0; }
    all++; if (decode(readKeying(ps)) === m) right++;
  }
  check('keyed by many hands (±15% wobble, three speeds): every message reads right', right === all, `${right}/${all}`);
  const msg = morseSequence('SOS HELP');
  check('keyed code written out and read back is the same chain (· –, space, /)', JSON.stringify(codeSequence(toCode(msg))) === JSON.stringify(msg) && toCode(morseSequence('SOS')) === '··· ––– ···' && decode(codeSequence('... --- ... / .... ..')) === 'SOS HI' && isCode('·– /') && !isCode('hi'));
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
