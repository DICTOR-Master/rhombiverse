// The Rhombic Wheel -- RHOMBIVERSE_UIUX_BUILD_PLAN.md B1's radial menu,
// the one control surface all mode/material interaction is meant to go
// through once the old always-visible sidebar is gone.
//
// Integration strategy: rather than re-implementing mode-switching/
// material-selection state (currentMode, MODE_HINTS, updateModeUI, the
// fill/generate/plant row visibility, etc. -- all real, working logic
// already in render.js), this wheel drives the EXACT SAME hidden shim
// controls render.js already listens to (`.mode-btn[data-mode=...]`,
// `#material-select`, `#generator-type-select`, `#species-select`,
// `#walk-toggle`) via .click()/.value, then closes itself. Zero backend/
// mode-logic duplication, per B1's own "do not modify... backend logic
// in this pass" scope -- this is a new INPUT layer on top of unchanged
// logic, not a parallel implementation of it.
//
// Rhombic grammar: every wheel entry is a real rhombus (a square rotated
// 45deg, not a circle or rectangle) per B1's explicit styling requirement.
// The four first-level entries additionally sit at N/E/S/W around the
// center, which traces a rhombus/diamond outline as a whole -- the shape
// language holds at both the single-control and whole-composition level.

const LEVEL1 = [
  { id: 'build', label: 'Build' },
  { id: 'alter', label: 'Alter' },
  { id: 'create', label: 'Create' },
  { id: 'explore', label: 'Explore' },
];

// Build -> Place/Repeat/Pattern/Material and Alter -> Dig/Smooth/Fill/
// Replace are B1's own literal table. 'mode' entries proxy a hidden
// .mode-btn by data-mode; 'tool' entries are build.js behavior toggles,
// not modes; 'material' opens the level-3 material strip.
const BUILD_SUBMENU = [
  { id: 'place', label: 'Place', kind: 'mode', mode: 'build' },
  { id: 'repeat', label: 'Repeat', kind: 'tool-drag' },
  { id: 'pattern', label: 'Pattern', kind: 'placeholder' },
  { id: 'material', label: 'Material', kind: 'material-picker' },
];

const ALTER_SUBMENU = [
  { id: 'dig', label: 'Dig', kind: 'mode', mode: 'excavate' },
  { id: 'smooth', label: 'Smooth', kind: 'mode', mode: 'round' },
  { id: 'fill', label: 'Fill', kind: 'mode', mode: 'fill' },
  { id: 'replace', label: 'Replace', kind: 'mode', mode: 'replace' },
];

// Create's real tool module (symmetry mirroring, shell brush, the
// Assistance Spectrum) is B4a's job, not B1's -- these two leaves are a
// deliberately narrow interim home for the two existing "make a whole
// structure/organism" mechanics that don't fit Build (single cell) or
// Alter (modifies existing structure), each opening a level-3 picker.
const CREATE_SUBMENU = [
  { id: 'generate-body', label: 'Generate a Body', kind: 'generator-picker' },
  { id: 'plant-seed', label: 'Plant a Seed', kind: 'species-picker' },
];

const CSS = `
#rhombic-wheel-overlay {
  position: fixed; inset: 0; z-index: 980;
  display: none;
  align-items: center; justify-content: center;
  background: rgba(2, 2, 6, 0.35);
}
#rhombic-wheel-overlay.open { display: flex; }
#rhombic-wheel-root {
  position: relative;
  width: 1px; height: 1px;
}
.wheel-item {
  position: absolute;
  width: 84px; height: 84px;
  margin: -42px 0 0 -42px;
  background: rgba(20, 22, 34, 0.92);
  border: 1px solid rgba(124, 204, 255, 0.55);
  transform: rotate(45deg);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
  box-shadow: 0 0 0 rgba(124,204,255,0);
}
.wheel-item:hover, .wheel-item:focus-visible { background: rgba(60, 110, 160, 0.55); border-color: #9de0ff; box-shadow: 0 0 14px rgba(124,204,255,0.45); }
.wheel-item.disabled { opacity: 0.4; cursor: default; }
.wheel-item.disabled:hover { background: rgba(20, 22, 34, 0.92); box-shadow: none; }
.wheel-item-label {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  transform: rotate(-45deg);
  color: #eaf6ff;
  font: 600 12px/1.2 system-ui, sans-serif;
  text-align: center;
  padding: 4px;
  box-sizing: border-box;
  user-select: none;
}
.wheel-level2 .wheel-item { width: 68px; height: 68px; margin: -34px 0 0 -34px; }
#rhombic-wheel-hint {
  position: absolute;
  bottom: -46px; left: 50%; transform: translateX(-50%);
  color: #bcd; font: 12px system-ui, sans-serif; white-space: nowrap;
  opacity: 0.85;
}
#rhombic-wheel-back {
  position: absolute; top: -175px; left: 50%; transform: translateX(-50%);
  color: #eaf6ff; font: 12px system-ui, sans-serif;
  background: rgba(124,204,255,0.18); border: 1px solid rgba(124,204,255,0.5);
  border-radius: 4px; padding: 4px 10px; cursor: pointer;
}
#wheel-picker-strip {
  position: fixed; left: 0; right: 0; bottom: 18px;
  z-index: 985;
  display: none;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  padding: 0 12px;
}
#wheel-picker-strip.open { display: flex; }
.wheel-picker-item {
  min-width: 56px; height: 56px; padding: 0 6px;
  background: rgba(20, 22, 34, 0.92);
  border: 1px solid rgba(124, 204, 255, 0.55);
  transform: rotate(45deg);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.wheel-picker-item:hover { background: rgba(60, 110, 160, 0.55); border-color: #9de0ff; }
.wheel-picker-item span {
  transform: rotate(-45deg);
  color: #eaf6ff; font: 600 10px/1.15 system-ui, sans-serif; text-align: center;
  max-width: 64px;
}
.wheel-picker-group-label {
  width: 100%; text-align: center;
  color: #9cd; font: 11px system-ui, sans-serif; opacity: 0.75;
  margin: 2px 0;
}
`;

function injectCssOnce() {
  if (document.getElementById('rhombic-wheel-style')) return;
  const style = document.createElement('style');
  style.id = 'rhombic-wheel-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// N/E/S/W for 4 items; a wider arc for submenus with a different count.
function positionsFor(count, radius) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    positions.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return positions;
}

function readSelectOptions(selectEl) {
  // Flattens <optgroup> into {group, value, label} entries, and bare
  // <option>s into {group: null, ...} -- single-sourced from the real
  // hidden <select> in index.html so the wheel can never drift out of
  // sync with what render.js actually reads via .value.
  const out = [];
  for (const child of selectEl.children) {
    if (child.tagName === 'OPTGROUP') {
      for (const opt of child.children) {
        out.push({ group: child.label, value: opt.value, label: opt.textContent });
      }
    } else if (child.tagName === 'OPTION') {
      out.push({ group: null, value: child.value, label: child.textContent });
    }
  }
  return out;
}

export function createRhombicWheel({
  modeButtonSelector = '.mode-btn',
  materialSelectId = 'material-select',
  generatorSelectId = 'generator-type-select',
  speciesSelectId = 'species-select',
  walkToggleId = 'walk-toggle',
  onModeChosen = () => {},
  onDragPlacementChange = () => {},
  onPrompt = () => {}, // (text) => void -- surfaces a message in the bottom HUD prompt
  onMenuSound = () => {},
  onSelectionChange = () => {}, // called after ANY leaf pick (mode/material/generator/species/repeat) -- render.js uses this to refresh the top-right HUD indicator
}) {
  injectCssOnce();

  let dragPlacementEnabled = false;
  let level = 0; // 0 closed, 1 = first ring shown, 2 = second ring shown
  let activeCategory = null;

  const overlay = document.createElement('div');
  overlay.id = 'rhombic-wheel-overlay';
  const root = document.createElement('div');
  root.id = 'rhombic-wheel-root';
  overlay.appendChild(root);
  document.body.appendChild(overlay);

  const pickerStrip = document.createElement('div');
  pickerStrip.id = 'wheel-picker-strip';
  document.body.appendChild(pickerStrip);

  function clearRoot() {
    root.innerHTML = '';
  }

  function closePicker() {
    pickerStrip.classList.remove('open');
    pickerStrip.innerHTML = '';
  }

  function close() {
    overlay.classList.remove('open');
    closePicker();
    clearRoot();
    level = 0;
    activeCategory = null;
    onSelectionChange();
  }

  function clickModeShim(modeName) {
    const buttons = document.querySelectorAll(modeButtonSelector);
    for (const btn of buttons) {
      if (btn.dataset.mode === modeName) {
        btn.click();
        return;
      }
    }
  }

  function openPickerStrip(options, onPick, currentValue) {
    pickerStrip.innerHTML = '';
    let lastGroup = undefined;
    for (const opt of options) {
      if (opt.group !== lastGroup) {
        lastGroup = opt.group;
        if (opt.group) {
          const groupLabel = document.createElement('div');
          groupLabel.className = 'wheel-picker-group-label';
          groupLabel.textContent = opt.group;
          pickerStrip.appendChild(groupLabel);
        }
      }
      const item = document.createElement('div');
      item.className = 'wheel-picker-item';
      item.tabIndex = 0;
      if (opt.value === currentValue) item.style.borderColor = '#9de0ff';
      const span = document.createElement('span');
      span.textContent = opt.label;
      item.appendChild(span);
      item.addEventListener('click', () => {
        onMenuSound();
        onPick(opt.value, opt.label);
        close();
      });
      pickerStrip.appendChild(item);
    }
    pickerStrip.classList.add('open');
  }

  function buildLevel(items, radius, extraClass) {
    const ring = document.createElement('div');
    if (extraClass) ring.className = extraClass;
    const positions = positionsFor(items.length, radius);
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'wheel-item';
      el.style.left = `${positions[i].x}px`;
      el.style.top = `${positions[i].y}px`;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      const label = document.createElement('div');
      label.className = 'wheel-item-label';
      label.textContent =
        item.id === 'repeat' && dragPlacementEnabled ? `${item.label} ✓` : item.label;
      el.appendChild(label);
      el.addEventListener('click', () => selectItem(item));
      ring.appendChild(el);
    });
    root.appendChild(ring);
    return ring;
  }

  function selectItem(item) {
    onMenuSound();
    if (item.id === 'build' || item.id === 'alter' || item.id === 'create') {
      activeCategory = item.id;
      level = 2;
      renderLevel2();
      return;
    }
    if (item.id === 'explore') {
      const btn = document.getElementById(walkToggleId);
      if (btn) btn.click();
      onModeChosen('explore');
      close();
      return;
    }

    // Level-2 leaves.
    if (item.kind === 'mode') {
      clickModeShim(item.mode);
      onModeChosen(item.mode);
      close();
      return;
    }
    if (item.kind === 'tool-drag') {
      dragPlacementEnabled = !dragPlacementEnabled;
      onDragPlacementChange(dragPlacementEnabled);
      clickModeShim('build');
      onModeChosen('build');
      onPrompt(
        dragPlacementEnabled
          ? 'Repeat armed: drag across faces to place a run of cells. Camera orbit is off while Repeat is active -- pick Place to get it back.'
          : 'Repeat off.'
      );
      close();
      return;
    }
    if (item.kind === 'placeholder') {
      onPrompt('Pattern stamping is coming soon.');
      close();
      return;
    }
    if (item.kind === 'material-picker') {
      const select = document.getElementById(materialSelectId);
      const options = readSelectOptions(select);
      openPickerStrip(options, (value) => {
        select.value = value;
        onPrompt(`Material: ${select.options[select.selectedIndex].textContent}`);
      }, select.value);
      return;
    }
    if (item.kind === 'generator-picker') {
      const select = document.getElementById(generatorSelectId);
      const options = readSelectOptions(select);
      openPickerStrip(options, (value) => {
        select.value = value;
        clickModeShim('generate');
        onModeChosen('generate');
        onPrompt(`Click anywhere to grow a ${select.options[select.selectedIndex].textContent}.`);
      }, select.value);
      return;
    }
    if (item.kind === 'species-picker') {
      const select = document.getElementById(speciesSelectId);
      const options = readSelectOptions(select);
      openPickerStrip(options, (value) => {
        select.value = value;
        clickModeShim('plant');
        onModeChosen('plant');
        onPrompt(`Click anywhere to plant a ${select.options[select.selectedIndex].textContent}.`);
      }, select.value);
      return;
    }
  }

  function renderLevel2() {
    clearRoot();
    const back = document.createElement('div');
    back.id = 'rhombic-wheel-back';
    back.textContent = '← Back';
    back.addEventListener('click', () => {
      level = 1;
      activeCategory = null;
      renderLevel1();
    });
    const submenu = activeCategory === 'build' ? BUILD_SUBMENU : activeCategory === 'alter' ? ALTER_SUBMENU : CREATE_SUBMENU;
    buildLevel(submenu, 90, 'wheel-level2');
    root.appendChild(back);
    const hint = document.createElement('div');
    hint.id = 'rhombic-wheel-hint';
    hint.textContent = 'Esc to go back';
    root.appendChild(hint);
  }

  function renderLevel1() {
    clearRoot();
    buildLevel(LEVEL1, 90);
    const hint = document.createElement('div');
    hint.id = 'rhombic-wheel-hint';
    hint.textContent = 'Tab / Space to close';
    root.appendChild(hint);
  }

  function open() {
    overlay.classList.add('open');
    level = 1;
    activeCategory = null;
    renderLevel1();
    onMenuSound();
  }

  function toggle() {
    if (level === 0 && !pickerStrip.classList.contains('open')) open();
    else close();
  }

  function isOpen() {
    return level !== 0 || pickerStrip.classList.contains('open');
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space') {
      // Only hijack Tab/Space when not typing into a real form control
      // (the Lab panel has plenty of <input>/<select> elements) -- this
      // is a global listener, so it must not eat every Space keystroke
      // on the page.
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      toggle();
      return;
    }
    if (e.code === 'Escape' && isOpen()) {
      if (pickerStrip.classList.contains('open')) {
        closePicker();
      } else if (level === 2) {
        level = 1;
        activeCategory = null;
        renderLevel1();
      } else {
        close();
      }
    }
  });

  return {
    open,
    close,
    toggle,
    isOpen,
    isDragPlacementEnabled: () => dragPlacementEnabled,
  };
}
