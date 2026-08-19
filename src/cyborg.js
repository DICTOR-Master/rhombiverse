// Cyborg Mode (RHOMBIVERSE_UIUX_BUILD_PLAN.md B3): guided onboarding
// that narrates a "subscript" JSON (data/cyborg/*.json) -- an ordered
// list of steps, each with a plain-language instruction, a named
// successCondition event to wait for, and a hint shown only after
// hintAfterSeconds elapses without success. Every real game event this
// listens for (rhombiverse:cameraRotated/faceHovered/cellPlaced) is
// dispatched from render.js/build.js's own existing hooks -- this
// module only listens and narrates, it NEVER calls world.addCell/
// removeCell or touches localStorage, satisfying B3's own "toggleable
// off at any time with zero persistent state change to the world."
const CSS = `
.cyborg-panel {
  position: fixed;
  left: 50%; bottom: 110px; transform: translateX(-50%);
  z-index: 940;
  width: min(420px, 86vw);
  background: rgba(6, 6, 12, 0.94);
  border: 1px solid rgba(124, 204, 255, 0.45);
  border-radius: 8px;
  padding: 10px 14px 12px;
  color: #eaf6ff;
  font: 13px/1.45 system-ui, sans-serif;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
}
.cyborg-header {
  display: flex; align-items: center; justify-content: space-between;
  font: 700 11px system-ui, sans-serif;
  letter-spacing: 0.04em;
  color: #9de0ff;
  margin-bottom: 4px;
}
.cyborg-close {
  background: none; border: none; color: #9de0ff; cursor: pointer;
  font: 13px system-ui, sans-serif; opacity: 0.8; padding: 0 2px;
}
.cyborg-close:hover { opacity: 1; }
.cyborg-instruction { color: #fff; }
.cyborg-hint {
  display: none;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(124, 204, 255, 0.3);
  color: #bcd;
  font-size: 12px;
}
.cyborg-hint.visible { display: block; }

/* Highlights render.js's #app (the "#viewport" the spec's own example
   subscript names -- this codebase's real 3D-viewport container has a
   different real id, so the shipped subscript below targets that one
   directly rather than a placeholder selector that doesn't exist). */
.cyborg-highlighted {
  outline: 3px solid #7cf;
  outline-offset: -3px;
  animation: cyborg-pulse 1.3s ease-in-out infinite;
}
@keyframes cyborg-pulse {
  0%, 100% { outline-color: rgba(124, 204, 255, 0.9); }
  50% { outline-color: rgba(124, 204, 255, 0.25); }
}
`;

function injectCssOnce() {
  if (document.getElementById('cyborg-style')) return;
  const style = document.createElement('style');
  style.id = 'cyborg-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const SUCCESS_EVENTS = ['cameraRotated', 'faceHovered', 'cellPlaced', 'wheelOpened', 'walkModeEntered', 'seedPlanted'];

export function createCyborgMode({ subscriptUrl = './data/cyborg/first-build-session.json', panelTitle = 'Cyborg Mode — Guided Walkthrough' } = {}) {
  injectCssOnce();

  let subscript = null;
  let enabled = false;
  let currentIndex = 0;
  let completedStepIds = new Set();
  let hintTimer = null;
  const listeners = [];

  const panel = document.createElement('div');
  panel.className = 'cyborg-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div class="cyborg-header"><span>${panelTitle}</span><button class="cyborg-close" type="button" title="Turn off">✕</button></div>
    <div class="cyborg-instruction"></div>
    <div class="cyborg-hint"></div>
  `;
  document.body.appendChild(panel);
  const instructionEl = panel.querySelector('.cyborg-instruction');
  const hintEl = panel.querySelector('.cyborg-hint');
  panel.querySelector('.cyborg-close').addEventListener('click', () => disable());

  let highlightedEl = null;
  function clearHighlight() {
    if (highlightedEl) highlightedEl.classList.remove('cyborg-highlighted');
    highlightedEl = null;
  }
  function applyHighlight(selector) {
    clearHighlight();
    const el = selector ? document.querySelector(selector) : null;
    if (el) {
      el.classList.add('cyborg-highlighted');
      highlightedEl = el;
    }
  }

  function currentStep() {
    return subscript ? (subscript.steps[currentIndex] ?? null) : null;
  }

  function renderStep() {
    const step = currentStep();
    if (!step) return;
    instructionEl.textContent = step.instruction;
    hintEl.textContent = '';
    hintEl.classList.remove('visible');
    applyHighlight(step.highlightTarget);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hintEl.textContent = step.hint;
      hintEl.classList.add('visible');
    }, (step.hintAfterSeconds ?? 8) * 1000);
  }

  function finish() {
    clearTimeout(hintTimer);
    clearHighlight();
    instructionEl.textContent = subscript.completionMessage ?? "That's everything -- you've got it.";
    hintEl.textContent = '';
    hintEl.classList.remove('visible');
    setTimeout(() => {
      if (enabled) disable();
    }, 6000);
  }

  function advanceToNextIncomplete() {
    while (currentIndex < subscript.steps.length && completedStepIds.has(subscript.steps[currentIndex].stepId)) {
      currentIndex += 1;
    }
    if (currentIndex >= subscript.steps.length) finish();
    else renderStep();
  }

  // "If a player performs an action out of the expected order... recognize
  // the corresponding step's success condition whenever it fires rather
  // than strictly enforcing sequence" -- every step's own successCondition
  // is listened for the whole time Cyborg Mode is on, not just the
  // current step's. A step completed early is simply skipped once
  // advanceToNextIncomplete reaches it.
  function handleSuccess(conditionName) {
    if (!enabled || !subscript) return;
    const step = subscript.steps.find((s) => s.successCondition === conditionName && !completedStepIds.has(s.stepId));
    if (!step) return;
    completedStepIds.add(step.stepId);
    if (subscript.steps.indexOf(step) === currentIndex) {
      advanceToNextIncomplete();
    }
  }

  function wireListeners() {
    for (const name of SUCCESS_EVENTS) {
      const handler = () => handleSuccess(name);
      window.addEventListener(`rhombiverse:${name}`, handler);
      listeners.push({ name: `rhombiverse:${name}`, handler });
    }
  }
  function unwireListeners() {
    for (const { name, handler } of listeners) window.removeEventListener(name, handler);
    listeners.length = 0;
  }

  async function enable() {
    if (enabled) return;
    if (!subscript) {
      const res = await fetch(subscriptUrl);
      subscript = await res.json();
    }
    enabled = true;
    currentIndex = 0;
    completedStepIds = new Set();
    panel.style.display = '';
    wireListeners();
    renderStep();
  }

  function disable() {
    enabled = false;
    clearTimeout(hintTimer);
    clearHighlight();
    unwireListeners();
    panel.style.display = 'none';
  }

  function toggle() {
    if (enabled) disable();
    else enable();
  }

  return { toggle, enable, disable, isEnabled: () => enabled };
}
