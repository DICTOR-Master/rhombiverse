// Material/generator/species picker overlays + the drag-placement
// ("Repeat") toggle -- real, independent functionality extracted out
// of the old 2D wheel.js (removed 2026-08-25, see CLAUDE.md/docs/
// code-notes/app/rhombic-wheel-3d.md) so the Rhombic Wheel 3D -- now
// the sole navigation surface -- doesn't depend on a second UI's
// internals for real features. These overlays were always independent
// DOM (their own fixed-position elements, never part of the old
// radial menu's own visuals), so extracting them changes nothing about
// how they look or behave, only where the code that drives them lives.

function positionsFor(count, radius) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    positions.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return positions;
}

function readSelectOptions(selectEl) {
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

const CSS = `
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

#material-wheel-overlay {
  position: fixed; inset: 0; z-index: 986;
  display: none;
  align-items: center; justify-content: center;
  background: rgba(2, 2, 6, 0.35);
}
#material-wheel-overlay.open { display: flex; }
#material-wheel-root { position: relative; width: 1px; height: 1px; }
.material-wheel-item {
  position: absolute;
  width: 48px; height: 48px;
  margin: -24px 0 0 -24px;
  border: 1.5px solid rgba(255,255,255,0.35);
  transform: rotate(45deg);
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s;
}
.material-wheel-item:hover, .material-wheel-item.current {
  transform: rotate(45deg) scale(1.25);
  box-shadow: 0 0 12px rgba(255,255,255,0.6);
  border-color: #fff;
  z-index: 2;
}
#material-wheel-hint {
  position: absolute; top: 0; left: 50%; transform: translate(-50%, -50%);
  color: #eaf6ff; font: 13px system-ui, sans-serif;
  white-space: nowrap;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.95);
  z-index: 3;
}
`;

function injectCssOnce() {
  if (document.getElementById('wheel-pickers-style')) return;
  const style = document.createElement('style');
  style.id = 'wheel-pickers-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createWheelPickers({
  modeButtonSelector = '.mode-btn',
  materialSelectId = 'material-select',
  generatorSelectId = 'generator-type-select',
  speciesSelectId = 'species-select',
  onModeChosen = () => {},
  onDragPlacementChange = () => {},
  onMenuSound = () => {},
  onSelectionChange = () => {},
  getMaterialColor = () => '#8899aa',
  onMaterialHoverPreview = () => {},
  onMaterialHoverEnd = () => {},
} = {}) {
  injectCssOnce();

  let dragPlacementEnabled = false;

  const pickerStrip = document.createElement('div');
  pickerStrip.id = 'wheel-picker-strip';
  document.body.appendChild(pickerStrip);

  const materialWheelOverlay = document.createElement('div');
  materialWheelOverlay.id = 'material-wheel-overlay';
  const materialWheelRoot = document.createElement('div');
  materialWheelRoot.id = 'material-wheel-root';
  const materialWheelHint = document.createElement('div');
  materialWheelHint.id = 'material-wheel-hint';
  materialWheelRoot.appendChild(materialWheelHint);
  materialWheelOverlay.appendChild(materialWheelRoot);
  document.body.appendChild(materialWheelOverlay);

  function closeMaterialWheel() {
    materialWheelOverlay.classList.remove('open');
    onMaterialHoverEnd();
  }

  function openMaterialWheel(options, onPick, currentValue) {
    materialWheelRoot.innerHTML = '';
    materialWheelRoot.appendChild(materialWheelHint);
    materialWheelHint.textContent = 'Hover to preview · click to select';
    const positions = positionsFor(options.length, 100);
    options.forEach((opt, i) => {
      const item = document.createElement('div');
      item.className = 'material-wheel-item';
      if (opt.value === currentValue) item.classList.add('current');
      item.style.left = `${positions[i].x}px`;
      item.style.top = `${positions[i].y}px`;
      item.style.background = getMaterialColor(opt.value);
      item.title = opt.label;
      item.addEventListener('mouseenter', () => {
        materialWheelHint.textContent = opt.label;
        onMaterialHoverPreview(opt.value);
      });
      item.addEventListener('mouseleave', () => {
        materialWheelHint.textContent = 'Hover to preview · click to select';
        onMaterialHoverEnd();
      });
      item.addEventListener('click', () => {
        onMenuSound();
        onPick(opt.value, opt.label);
        closeMaterialWheel();
        onSelectionChange();
      });
      materialWheelRoot.appendChild(item);
    });
    materialWheelOverlay.classList.add('open');
  }
  materialWheelOverlay.addEventListener('click', (e) => {
    if (e.target === materialWheelOverlay) closeMaterialWheel();
  });

  function closePicker() {
    pickerStrip.classList.remove('open');
    pickerStrip.innerHTML = '';
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
        closePicker();
        onSelectionChange();
      });
      pickerStrip.appendChild(item);
    }
    pickerStrip.classList.add('open');
  }

  // Own Escape handling for these two overlays -- independent of
  // whatever else (the 3D wheel, a panel) might also listen for Escape.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (materialWheelOverlay.classList.contains('open')) closeMaterialWheel();
    else if (pickerStrip.classList.contains('open')) closePicker();
  });

  function clickModeShim(modeName) {
    const buttons = document.querySelectorAll(modeButtonSelector);
    for (const btn of buttons) {
      if (btn.dataset.mode === modeName) {
        btn.click();
        return;
      }
    }
  }

  function openMaterialPicker(onPick) {
    const select = document.getElementById(materialSelectId);
    const options = readSelectOptions(select);
    openMaterialWheel(options, (value, label) => { select.value = value; onPick?.(value, label); }, select.value);
  }
  function openSpeciesPicker(onPick) {
    const select = document.getElementById(speciesSelectId);
    const options = readSelectOptions(select);
    openPickerStrip(options, (value, label) => { select.value = value; onPick?.(value, label); }, select.value);
  }
  function openGeneratorPicker(onPick) {
    const select = document.getElementById(generatorSelectId);
    const options = readSelectOptions(select);
    openPickerStrip(options, (value, label) => { select.value = value; onPick?.(value, label); }, select.value);
  }
  function toggleDragPlacement() {
    dragPlacementEnabled = !dragPlacementEnabled;
    onDragPlacementChange(dragPlacementEnabled);
    clickModeShim('build');
    onModeChosen('build');
    return dragPlacementEnabled;
  }

  return {
    openMaterialPicker,
    openSpeciesPicker,
    openGeneratorPicker,
    toggleDragPlacement,
    isDragPlacementEnabled: () => dragPlacementEnabled,
    // For a caller (the 3D wheel's Tab/Space/HUD-cue handling) that
    // wants to close whichever of these is open before doing anything
    // else, same UX the old 2D wheel had for its own Tab/Space handler.
    isAnyPickerOpen: () => materialWheelOverlay.classList.contains('open') || pickerStrip.classList.contains('open'),
    closeAnyPicker: () => { closeMaterialWheel(); closePicker(); },
  };
}
