// Every wheel config opens: none declares a face key that the universal
// ring (Settings, Almanac, spare) or the Home slot already holds. A clash
// throws when the wheel opens (the piece and RD wheels both did once, so
// the piece picker couldn't open -- direct report, 2026-09-26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../src/app/rhombic-wheel-3d-core.js';

test('every exported wheel config resolves without a face-key clash', () => {
  const wheels = Object.entries(core).filter(([name, v]) => name.startsWith('WHEEL_') && v && typeof v === 'object' && v.faces);
  assert.ok(wheels.length >= 5, `found ${wheels.length} wheels`);
  for (const [name, config] of wheels) assert.doesNotThrow(() => core.resolveWheelFaces(config), name);
});
