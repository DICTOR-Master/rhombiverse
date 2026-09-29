// 1D Signal (src/app/world-signal.js; DICTO's 1D Experience Plan): a
// strictly one-dimensional trajectory, parametrised by one coordinate s,
// carrying Morse code. Pure maths, no THREE (verify:trajectory).
//
// - Cells: dot (1 unit), dash (3), gap (1, 3 or 7 units: between the
//   parts of a letter, between letters, between words), laid end to end
//   along s. Standard Morse timing.
// - The screen embedding E(s) -> (x, y) is for drawing only: a curve at
//   unit speed whose direction drifts slowly (the plan's curvature term).
//   The world's only distance is measured along s; two points' distance
//   on screen (a chord) is shorter than their distance along s (the arc)
//   wherever the curve bends.
// - One time signal m(u) (1 while a dot or dash is sounding) is what the
//   moving chain carries, so every view shows the same state.

export const UNITS = { dot: 1, dash: 3 };
export const GAP_UNITS = { element: 1, letter: 3, word: 7 };

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '"': '.-..-.', '@': '.--.-.',
};
const DECODE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export const cellUnits = (c) => (c.type === 'gap' ? c.units ?? 1 : UNITS[c.type]);

/** A message as cells, with standard gaps (none trailing). Characters
 * Morse has no code for are skipped. */
export function morseSequence(text) {
  const out = [];
  const words = String(text).toUpperCase().split(/\s+/).map((w) => [...w].filter((ch) => MORSE[ch])).filter((w) => w.length);
  words.forEach((word, wi) => {
    if (wi) out.push({ type: 'gap', units: GAP_UNITS.word });
    word.forEach((ch, ci) => {
      if (ci) out.push({ type: 'gap', units: GAP_UNITS.letter });
      [...MORSE[ch]].forEach((sym, si) => {
        if (si) out.push({ type: 'gap', units: GAP_UNITS.element });
        out.push({ type: sym === '.' ? 'dot' : 'dash' });
      });
    });
  });
  return out;
}

/** Morse written out, as the message box shows keyed cells (direct
 * request: "if you tap the dots and dashes they appear in the writing
 * box so you can see them and edit"): · and – (. and - typed), a space
 * between letters, " / " between words. */
export const isCode = (str) => /[.\-·–]/.test(str) && /^[\s.\-·–—/]*$/.test(str);
export function toCode(cells) {
  let out = '';
  for (const c of cells) {
    if (c.type === 'dot') out += '·';
    else if (c.type === 'dash') out += '–';
    else if ((c.units ?? 1) >= GAP_UNITS.word) out += ' / ';
    else if ((c.units ?? 1) >= GAP_UNITS.letter) out += ' ';
  }
  return out;
}
export function codeSequence(str) {
  const out = [];
  const words = String(str).split(/\s*\/\s*|\s{2,}/).map((w) => w.trim().split(/\s+/).filter(Boolean)).filter((w) => w.length);
  words.forEach((word, wi) => {
    if (wi) out.push({ type: 'gap', units: GAP_UNITS.word });
    word.forEach((letter, li) => {
      if (li) out.push({ type: 'gap', units: GAP_UNITS.letter });
      [...letter].filter((ch) => '.-·–—'.includes(ch)).forEach((ch, k) => {
        if (k) out.push({ type: 'gap', units: GAP_UNITS.element });
        out.push({ type: ch === '.' || ch === '·' ? 'dot' : 'dash' });
      });
    });
  });
  return out;
}

/** Cells read back as text: a gap of 3 or more ends a letter, 7 or more
 * a word; an unknown pattern shows as '?'. */
export function decode(cells) {
  let text = '', letter = '', gap = 0;
  const flush = () => { if (letter) { text += DECODE[letter] ?? '?'; letter = ''; } };
  for (const c of cells) {
    if (c.type === 'gap') { gap += cellUnits(c); continue; }
    if (gap >= GAP_UNITS.letter) flush();
    if (gap >= GAP_UNITS.word && text) text += ' ';
    gap = 0;
    letter += c.type === 'dot' ? '.' : '-';
  }
  flush();
  return text;
}

/** A telegraph key's timing (Signal's pulse key): a press held past
 * DASH_MS is a dash; the pause before a press sets the gap before it
 * (standard ratios, at a relaxed hand speed). */
export const KEY_MS = { dash: 250, letter: 700, word: 1800 };
export const keyedElement = (heldMs) => ({ type: heldMs < KEY_MS.dash ? 'dot' : 'dash' });
export const keyedGap = (pauseMs) => ({ type: 'gap', units: pauseMs < KEY_MS.letter ? GAP_UNITS.element : pauseMs < KEY_MS.word ? GAP_UNITS.letter : GAP_UNITS.word });

/** The text read back letter by letter, each with where its last
 * element ends along s (a word break is a ' ' at the next letter's end):
 * the message as it arrives, cell by cell. */
export function letterEnds(cells) {
  const out = [];
  let letter = '', gap = 0, end = 0, s = 0;
  const flush = () => { if (letter) { out.push({ text: DECODE[letter] ?? '?', end }); letter = ''; } };
  for (const c of cells) {
    const u = cellUnits(c);
    if (c.type === 'gap') { gap += u; s += u; continue; }
    if (gap >= GAP_UNITS.letter) flush();
    const space = gap >= GAP_UNITS.word && out.length;
    gap = 0;
    letter += c.type === 'dot' ? '.' : '-';
    s += u;
    end = s;
    if (space && letter.length === 1) out.push({ text: ' ', end: s });
  }
  flush();
  return out;
}

/** Each cell's span [s0, s1) along the trajectory, end to end from 0. */
export function layout(cells) {
  let s = 0;
  return cells.map((c) => { const s0 = s; s += cellUnits(c); return { cell: c, s0, s1: s }; });
}
export const totalUnits = (cells) => cells.reduce((s, c) => s + cellUnits(c), 0);

// ---- the time signal ----
/** The sounding elements as time windows [u0, u1) in units, one pass. */
export function elements(cells) {
  return layout(cells).filter(({ cell }) => cell.type !== 'gap').map(({ s0, s1 }) => [s0, s1]);
}
/** m(u): 1 while an element sounds, repeating with a word gap between
 * passes (the infinite transmission). */
export function signal(cells, u) {
  const P = totalUnits(cells) + GAP_UNITS.word;
  if (u < 0 || P <= GAP_UNITS.word) return 0;
  const v = u % P;
  return elements(cells).some(([a, b]) => v >= a && v < b) ? 1 : 0;
}
/** Play: the chain is a train heading forward along the trajectory, its
 * first cell in front. Laid out at u = -s (the message's own s), it moves
 * toward +u at unit speed, repeating every pass (chain plus a word gap):
 * the point u shows, at time t, m(t - u), so a reader ahead receives the
 * message in order, first symbol first. */
export function waveAt(cells, u, t) {
  return signal(cells, t - u);
}

// ---- the screen embedding E(s) ----
// Unit speed, direction theta(s) drifting slowly: two sines of long,
// incommensurate periods, so it never quite repeats. Nearly straight
// (direct request: "too curved, should be stretching off to infinity"):
// a few degrees of drift over dozens of cells. Running up the screen
// (direct request: "nearly vertical, not horizontal"), which suits a
// phone held upright.
const theta = (s) => Math.PI / 2 + 0.07 * Math.sin(s / 31) + 0.04 * Math.sin(s / 83 + 1.3);
const STEP = 0.05;
const table = new Map(); // integer step index -> [x, y]
table.set(0, [0, 0]);
function point(i) {
  if (table.has(i)) return table.get(i);
  // Walk out from the nearest known point (midpoint rule, exact enough).
  const dir = i > 0 ? 1 : -1;
  let j = i - dir;
  while (!table.has(j)) j -= dir;
  let [x, y] = table.get(j);
  for (let k = j + dir; dir > 0 ? k <= i : k >= i; k += dir) {
    const a = theta((k - dir / 2) * STEP);
    x += dir * STEP * Math.cos(a); y += dir * STEP * Math.sin(a);
    table.set(k, [x, y]);
  }
  return table.get(i);
}
/** E(s): the trajectory's drawn position. */
export function embed(s) {
  const f = s / STEP, i = Math.floor(f), u = f - i;
  const [x0, y0] = point(i), [x1, y1] = point(i + 1);
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
}
/** Direction of travel at s (radians). */
export const tangentAngle = (s) => theta(s);
/** The plan's Δ = s_e - s_obs: signed distance along the trajectory. */
export const signedDistance = (sEvent, sObserver) => sEvent - sObserver;
