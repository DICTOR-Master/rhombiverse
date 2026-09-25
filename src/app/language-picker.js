// Language picker (🌐 + each language's own name) for the welcome screen
// and the User Guide. It writes the same `language` setting as
// Settings → Language, so every place stays in step: changing it here
// re-translates the whole UI through render.js's onSettingsChange
// listener, and a change made anywhere else updates this picker.
import { getSettings, updateSettings, onSettingsChange } from './settings.js';
import { t, LANG_ORDER, LANG_META } from './i18n.js';

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = `
.lang-picker { display: inline-flex; align-items: center; gap: 6px; font: 14px system-ui, sans-serif; color: #cfe8ff; }
.lang-picker .globe { font-size: 18px; line-height: 1; }
.lang-picker select { min-height: 44px; padding: 0 10px; background: rgba(10, 14, 24, 0.85); color: #e8f4ff; border: 1px solid rgba(124, 204, 255, 0.45); border-radius: 8px; font: inherit; cursor: pointer; }`;
  document.head.appendChild(style);
}

/** Returns a new picker element, already wired and kept in sync. */
export function createLanguagePicker() {
  addStyle();
  const label = document.createElement('label');
  label.className = 'lang-picker';
  label.innerHTML = `<span class="globe" aria-hidden="true">🌐</span><select>${LANG_ORDER.map((code) => `<option value="${code}" lang="${code}">${LANG_META[code].native}</option>`).join('')}</select>`;
  const select = label.querySelector('select');
  const sync = (lang) => {
    select.value = lang;
    select.setAttribute('aria-label', t('setting.language', lang));
  };
  sync(getSettings().language);
  select.addEventListener('change', () => updateSettings({ language: select.value }));
  onSettingsChange((s) => sync(s.language));
  return label;
}
