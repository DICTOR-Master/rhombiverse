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
  // Logged live, not just collected for the end-of-run check below --
  // a real error that happens before some later assertion throws (e.g.
  // a timeout) would otherwise never make it into the CI log at all.
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = `[console] ${msg.text()}`;
      errors.push(text);
      console.log(text);
    }
  });
  page.on('pageerror', (err) => {
    const text = `[pageerror] ${err}`;
    errors.push(text);
    console.log(text);
  });
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(`${BASE_URL}/index.html`);

  // Welcome overlay shows on first load and can be dismissed. Timeout
  // recalibrated 2026-08-19: render.js's own module graph has grown
  // (B1-B6 added dozens of files) to where cold JS parse/eval genuinely
  // takes several seconds on CI's shared runners -- confirmed via direct
  // timing (not a real app bug: zero console/page errors at any point,
  // and this is a no-build-step app by design, so shrinking the module
  // graph via a bundler isn't the right fix for a test timeout).
  await page.waitForSelector('#welcome-overlay', { state: 'visible', timeout: 25000 });
  await page.click('#enter-world-btn');
  await page.waitForTimeout(500);
  const overlayDisplay = await page.$eval('#welcome-overlay', (el) => getComputedStyle(el).display);
  assert.equal(overlayDisplay, 'none', 'welcome overlay should hide after Enter');

  // Nothing is saved to localStorage until the first onChange() fires
  // (documented, pre-existing behavior -- render.js only persists on a
  // real mutation, not right after initial seeding), and the starting
  // cell count isn't just the seed cell either -- seedAsteroidBelts()
  // runs unconditionally in init(), even in local-only mode (the two
  // belts are real, minable content locally too, not just in Shared
  // World). So this checks the DELTA from one build action, not an
  // absolute count -- the only thing actually worth asserting here.
  const cellCount = async () => {
    const raw = await page.evaluate(() => localStorage.getItem('rhombiverse-world'));
    return raw ? Object.keys(JSON.parse(raw).cells).length : 0;
  };

  // A real Build-mode click on the seed cell's face adds a neighbor.
  // waitForSelector (not page.$, which does a single instantaneous
  // query) actively retries until the canvas is actually attached --
  // a single-shot query flaked once in local testing even though the
  // canvas was confirmed present a moment later.
  const canvas = await page.waitForSelector('canvas', { state: 'attached', timeout: 25000 });
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  const afterFirstClick = await cellCount();
  assert.ok(afterFirstClick > 0, 'expected at least one cell to exist after the first click');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  const afterSecondClick = await cellCount();
  assert.equal(afterSecondClick, afterFirstClick + 1, 'expected exactly one new cell from the second build click');

  // The 2D wheel.js was removed 2026-08-25 -- the Rhombic Wheel 3D is
  // the sole navigation surface now. Its own labels are continuously
  // repositioned every frame by a live render loop, which reproducibly
  // defeats Playwright's actionability/stability polling (see
  // CLAUDE.md and docs/code-notes/app/rhombic-wheel-3d.md for two
  // separate real incidents of this exact class of issue) -- clicking
  // through the 3D wheel's own faces is not a reliable CI interaction.
  // Mode switching itself is tested directly against the real
  // underlying primitive instead (.mode-btn[data-mode=...], the same
  // element the 3D wheel's own onAction handler drives via .click()),
  // which is both more reliable here and a more direct test of the
  // actual state-changing behavior, not UI theater on top of it.
  async function clickMode(modeName) {
    const clicked = await page.evaluate((mode) => {
      const el = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
      if (!el) return false;
      el.click();
      return true;
    }, modeName);
    assert.ok(clicked, `.mode-btn[data-mode="${modeName}"] should exist and be clickable`);
  }

  await clickMode('fill');
  const shellRowVisible = await page.$eval('#shell-radius-row', (el) => getComputedStyle(el).display !== 'none');
  assert.ok(shellRowVisible, 'Fill mode should reveal the shell-radius row');
  await clickMode('build');

  // Tab now opens the Rhombic Wheel 3D directly (reclaimed from the
  // old 2D wheel) -- just confirm the overlay opens/closes, not any
  // specific face click, for the reliability reason above.
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  const wheel3DOpen = await page.$eval('#rhombic-wheel-3d-overlay', (el) => el.classList.contains('open'));
  assert.ok(wheel3DOpen, 'Tab should open the Rhombic Wheel 3D');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  const wheel3DClosed = await page.$eval('#rhombic-wheel-3d-overlay', (el) => !el.classList.contains('open'));
  assert.ok(wheel3DClosed, 'Tab again should close the Rhombic Wheel 3D');

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
