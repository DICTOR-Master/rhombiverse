// Tiny WebAudio blip generator (no audio assets, no build step).
// Full rationale: docs/code-notes/app/sfx.md
import { getSettings, onSettingsChange } from './settings.js';

let ctx = null;
let masterGain = null;

function ensureContext() {
  if (ctx) return ctx;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  ctx = new AudioContextCtor();
  masterGain = ctx.createGain();
  masterGain.gain.value = getSettings().volume;
  masterGain.connect(ctx.destination);
  onSettingsChange((s) => {
    if (masterGain) masterGain.gain.value = s.volume;
  });
  return ctx;
}

function blip(freq, durationSec) {
  const audioCtx = ensureContext();
  if (!audioCtx) return;
  // Safe to always call resume() here -- see docs/code-notes/app/sfx.md
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationSec);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + durationSec);
}

export function playPlaceSound() {
  blip(660, 0.09);
}

export function playRemoveSound() {
  blip(280, 0.11);
}

export function playMenuSound() {
  blip(880, 0.05);
}
