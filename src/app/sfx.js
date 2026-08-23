// Tiny WebAudio blip generator for B1's "brief... sound on placement/
// removal" requirement (RHOMBIVERSE_UIUX_BUILD_PLAN.md). No audio assets
// exist anywhere in this repo yet, and adding a bundler/asset pipeline
// just for two short beeps would violate the project's own no-build-step
// rule (CLAUDE.md) -- a couple of oscillator blips is the Grounded-
// Simplicity-appropriate way to get real sound with zero new tooling.
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
  // Browsers start an AudioContext 'suspended' until a user gesture --
  // every call here already happens inside a click/contextmenu handler,
  // so this is always safe to call, just occasionally a no-op resume.
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
