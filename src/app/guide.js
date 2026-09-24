// In-app "How to use" guide: renders docs/guide.md (the same file
// guide.html serves as the shareable /guide page) in a full-screen
// overlay. English only for now -- the guide itself isn't translated.
import { renderMarkdown, GUIDE_CSS } from './markdown.js';

let overlay = null;

function build() {
  const style = document.createElement('style');
  style.textContent = `${GUIDE_CSS}
#guide-overlay { position: fixed; inset: 0; z-index: 1100; display: none; flex-direction: column; background: #0a0c14; }
#guide-overlay.open { display: flex; }
#guide-bar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #2c3444; font: 13px system-ui, sans-serif; }
#guide-bar a { color: #9de0ff; margin-left: auto; }
#guide-close { min-width: 44px; min-height: 44px; background: none; border: 1px solid rgba(124, 204, 255, 0.35); border-radius: 8px; color: #ddd; font-size: 18px; cursor: pointer; }
#guide-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px 16px 48px; }`;
  document.head.appendChild(style);

  overlay = document.createElement('div');
  overlay.id = 'guide-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'How to use Rhombiverse');
  overlay.innerHTML = `
    <div id="guide-bar">
      <button id="guide-close" type="button" title="Close (Esc)" aria-label="Close">✕</button>
      <a href="./guide.html" target="_blank" rel="noopener">Open as a page to share &rarr;</a>
    </div>
    <div id="guide-body"><div class="md-guide">Loading…</div></div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#guide-close').addEventListener('click', closeGuide);
  // In-page #anchor links scroll inside the overlay instead of touching
  // location.hash, which the app itself uses for shared-world links.
  overlay.querySelector('#guide-body').addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    overlay.querySelector(`[id="${CSS.escape(a.getAttribute('href').slice(1))}"]`)?.scrollIntoView({ behavior: 'smooth' });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      e.stopPropagation();
      closeGuide();
    }
  }, true);

  fetch('./docs/guide.md')
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((md) => { overlay.querySelector('.md-guide').innerHTML = renderMarkdown(md); })
    .catch((err) => {
      console.warn('Rhombiverse: failed to load guide', err);
      overlay.querySelector('.md-guide').textContent = 'The guide could not be loaded. Check your connection and try again.';
    });
}

export function openGuide() {
  if (!overlay) build();
  overlay.classList.add('open');
  overlay.querySelector('#guide-body').scrollTop = 0;
}

export function closeGuide() {
  overlay?.classList.remove('open');
}
