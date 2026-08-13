// Real-browser smoke test -- the CI equivalent of "Harness 2" in
// .claude/skills/browser-test-harness/SKILL.md, scoped down to a fast,
// deterministic check suitable for every push/PR (not a full
// regression suite). Assumes the app is already being served at
// BASE_URL (the CI workflow starts `python3 -m http.server`).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err}`));
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(`${BASE_URL}/index.html`);

  // Welcome overlay shows on first load and can be dismissed.
  await page.waitForSelector('#welcome-overlay', { state: 'visible', timeout: 10000 });
  await page.click('#enter-world-btn');
  await page.waitForTimeout(500);
  const overlayDisplay = await page.$eval('#welcome-overlay', (el) => getComputedStyle(el).display);
  assert.equal(overlayDisplay, 'none', 'welcome overlay should hide after Enter');

  // The seed cell rendered -- InstancedMesh count should be exactly 1.
  const initialCount = await page.evaluate(() => {
    const raw = localStorage.getItem('rhombiverse-world');
    if (!raw) return null;
    return Object.keys(JSON.parse(raw).cells).length;
  });
  assert.equal(initialCount, 1, 'expected exactly the seed cell before any build action');

  // A real Build-mode click on the seed cell's face adds a neighbor.
  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  const afterBuildCount = await page.evaluate(() => {
    const raw = localStorage.getItem('rhombiverse-world');
    return Object.keys(JSON.parse(raw).cells).length;
  });
  assert.equal(afterBuildCount, 2, 'expected the seed cell plus one newly built neighbor');

  // Mode buttons are present and switchable without error.
  await page.click('.mode-btn[data-mode="fill"]');
  const shellRowVisible = await page.$eval('#shell-radius-row', (el) => getComputedStyle(el).display !== 'none');
  assert.ok(shellRowVisible, 'Fill mode should reveal the shell-radius row');
  await page.click('.mode-btn[data-mode="build"]');

  if (errors.length > 0) {
    throw new Error(`Console/page errors during smoke test:\n${errors.join('\n')}`);
  }

  await browser.close();
  console.log('smoke test passed: welcome overlay, build, and mode switching, zero console errors');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
