// Almanac (Stage 1 -- docs/RHOMBIVERSE_SPEC_ALMANAC.md section 5): the
// static list + detail panel view. Wired to the real `openAlmanac`
// action (see render.js's onAction, previously just a "not built yet"
// toast). Content comes entirely from almanac-data.js -- this file only
// renders it, never invents its own copy. No 3D preview yet (Stage 3).
//
// Structurally mirrors cyborg.js's createCyborgMode: a create*() factory
// (render.js's own established convention for interactive sub-panels,
// distinct from welcome.js/changelog.js's simpler self-mounting
// <script> pattern -- Almanac needs an exported open()/close()/toggle()
// API because, unlike those two, it has no dedicated always-visible
// trigger button of its own; it's only ever opened via the wheel's
// Almanac face), CSS injected once via injectCssOnce() rather than
// added to index.html's own embedded stylesheet, same visual language
// (cyan accent, near-black panel) as changelog.js/cyborg.js already use.
import { ALMANAC_ENTRIES } from './almanac-data.js';
import { iconFrame, MARKS } from './wheel-icons.js';

const CSS = `
.almanac-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 990;
  align-items: center; justify-content: center;
  background: rgba(5, 5, 10, 0.88);
  backdrop-filter: blur(2px);
  padding: 24px 12px;
  box-sizing: border-box;
}
.almanac-overlay.open { display: flex; }
.almanac-card {
  width: 100%; max-width: 520px; max-height: 84vh;
  overflow-y: auto;
  color: #ddd; font: 14px/1.5 system-ui, sans-serif;
  background: rgba(15, 15, 25, 0.96);
  border: 1px solid rgba(124, 204, 255, 0.35);
  border-radius: 10px;
  padding: 18px 22px 22px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.almanac-header {
  display: flex; align-items: center; justify-content: space-between;
  font: 700 16px system-ui, sans-serif;
  color: #9de0ff;
  margin-bottom: 12px;
}
.almanac-close { background: none; border: none; color: #9de0ff; cursor: pointer; font: 15px system-ui, sans-serif; }
.almanac-list { display: flex; flex-direction: column; gap: 4px; }
.almanac-entry {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  color: #eee;
  font: 13px system-ui, sans-serif;
  text-align: left;
  cursor: pointer;
}
.almanac-entry:hover { background: rgba(124, 204, 255, 0.12); border-color: rgba(124, 204, 255, 0.4); }
.almanac-entry-icon { flex: 0 0 auto; font-size: 22px; color: #9de0ff; line-height: 0; }
.almanac-entry-icon:empty { display: none; }
.almanac-entry-label { flex: 1 1 auto; }
.almanac-kind {
  font: 700 10px system-ui, sans-serif;
  letter-spacing: 0.04em; text-transform: uppercase;
  color: #789;
  margin: 14px 0 4px;
}
.almanac-kind:first-child { margin-top: 0; }
.almanac-detail { display: none; }
.almanac-back {
  background: none; border: none; color: #9de0ff; cursor: pointer;
  font: 13px system-ui, sans-serif; padding: 0; margin-bottom: 12px;
}
.almanac-detail-icon { font-size: 48px; color: #9de0ff; text-align: center; margin-bottom: 8px; line-height: 0; }
.almanac-detail-icon:empty { display: none; }
.almanac-detail-title { font: 700 17px system-ui, sans-serif; color: #fff; margin-bottom: 8px; text-align: center; }
.almanac-detail-stats {
  text-align: center;
  color: #9de0ff;
  font: 700 11px system-ui, sans-serif;
  letter-spacing: 0.03em;
  margin-bottom: 10px;
}
.almanac-detail-desc { color: #ccd; font-size: 13px; }
`;

function injectCssOnce() {
  if (document.getElementById('almanac-style')) return;
  const style = document.createElement('style');
  style.id = 'almanac-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// almanac-data.js's own entry `kind`s (piece/concept/history), given a
// real section heading here -- markKey-less entries (the 2 lattice
// concepts, spec section 6's open question) simply render with no icon
// (.almanac-*-icon:empty collapses to nothing) rather than a placeholder.
const KIND_LABEL = { piece: 'Pieces', concept: 'Lattice Concepts', history: 'History' };

function iconHtml(markKey, label) {
  return markKey && MARKS[markKey] ? iconFrame(MARKS[markKey], { title: label }) : '';
}

// Stage 2 (docs/RHOMBIVERSE_SPEC_ALMANAC.md section 5): entry.stats is
// either a real computed {vertexCount,edgeCount,faceCount} (single-cell
// convex pieces) or a real {composedOf,unit} (cluster pieces -- see
// almanac-data.js's own header for why those don't get a fabricated
// V/E/F). Lattice-concept/history entries have no stats at all, so this
// renders nothing for them, same :empty-collapse convention the icon
// slots already use.
function statsHtml(stats) {
  if (!stats) return '';
  if (typeof stats.vertexCount === 'number') {
    return `<div class="almanac-detail-stats">${stats.vertexCount} vertices &middot; ${stats.edgeCount} edges &middot; ${stats.faceCount} faces</div>`;
  }
  if (typeof stats.composedOf === 'number') {
    // Real singular/plural forms from almanac-data.js, not a naive "+s"
    // (a real bug found live: "Hemi RD half" -> "Hemi RD halfs").
    const unit = stats.composedOf === 1 ? stats.unit : stats.unitPlural;
    return `<div class="almanac-detail-stats">Composed of ${stats.composedOf} &times; ${unit}</div>`;
  }
  return '';
}

export function createAlmanac() {
  injectCssOnce();

  const overlay = document.createElement('div');
  overlay.className = 'almanac-overlay';
  overlay.innerHTML = `
    <div class="almanac-card">
      <div class="almanac-header"><span>Almanac</span><button type="button" class="almanac-close">✕</button></div>
      <div class="almanac-list"></div>
      <div class="almanac-detail"></div>
    </div>`;
  document.body.appendChild(overlay);

  const listEl = overlay.querySelector('.almanac-list');
  const detailEl = overlay.querySelector('.almanac-detail');

  // Grouped by kind, in ALMANAC_ENTRIES' own order (pieces, then lattice
  // concepts, then history -- see almanac-data.js) rather than one flat
  // list, since which section an entry is in is itself useful context.
  let sectionsHtml = '';
  let lastKind = null;
  ALMANAC_ENTRIES.forEach((entry, i) => {
    if (entry.kind !== lastKind) {
      sectionsHtml += `<div class="almanac-kind">${KIND_LABEL[entry.kind] ?? entry.kind}</div>`;
      lastKind = entry.kind;
    }
    sectionsHtml += `
      <button type="button" class="almanac-entry" data-index="${i}">
        <span class="almanac-entry-icon">${iconHtml(entry.markKey, entry.label)}</span>
        <span class="almanac-entry-label">${entry.label}</span>
      </button>`;
  });
  listEl.innerHTML = sectionsHtml;

  function showList() {
    listEl.style.display = 'flex';
    detailEl.style.display = 'none';
  }

  function showDetail(index) {
    const entry = ALMANAC_ENTRIES[index];
    if (!entry) return;
    detailEl.innerHTML = `
      <button type="button" class="almanac-back">&larr; Back</button>
      <div class="almanac-detail-icon">${iconHtml(entry.markKey, entry.label)}</div>
      <div class="almanac-detail-title">${entry.label}</div>
      ${statsHtml(entry.stats)}
      <div class="almanac-detail-desc">${entry.desc}</div>`;
    detailEl.querySelector('.almanac-back').addEventListener('click', showList);
    listEl.style.display = 'none';
    detailEl.style.display = 'block';
  }

  listEl.querySelectorAll('.almanac-entry').forEach((el) => {
    el.addEventListener('click', () => showDetail(Number(el.dataset.index)));
  });

  overlay.querySelector('.almanac-close').addEventListener('click', () => close());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  function open() {
    showList(); // always reset to the list view on (re)open
    overlay.classList.add('open');
  }
  function close() {
    overlay.classList.remove('open');
  }
  function toggle() {
    if (overlay.classList.contains('open')) close();
    else open();
  }

  return { open, close, toggle };
}
