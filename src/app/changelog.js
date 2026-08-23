// B7 (RHOMBIVERSE_UIUX_BUILD_PLAN.md): "Replace 'Under Construction'
// branding with a versioned 'What's new' changelog panel." The branding
// itself was already dropped (2026-08-19, user feedback); this is the
// replacement half. Self-contained like welcome.js -- a DOM/localStorage
// concern only, independent of render.js/world state, own script tag.
const SEEN_KEY = 'rhombiverse-changelog-seen';

function panelHtml(entries) {
  const body = entries
    .map(
      (entry) => `
      <div class="changelog-entry">
        <div class="changelog-date">${entry.date}</div>
        <div class="changelog-title">${entry.title}</div>
        <ul>${entry.items.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>`
    )
    .join('');
  return `
    <div id="changelog-card">
      <div id="changelog-header"><span>What's New</span><button id="changelog-close" type="button">✕</button></div>
      <div id="changelog-body">${body}</div>
    </div>`;
}

async function init() {
  const btn = document.createElement('button');
  btn.id = 'changelog-btn';
  btn.type = 'button';
  btn.title = "What's New";
  btn.textContent = '🕘';
  document.body.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.id = 'changelog-overlay';
  document.body.appendChild(overlay);

  let entries = [];
  try {
    const res = await fetch('./data/changelog.json');
    entries = await res.json();
  } catch (err) {
    console.warn('Rhombiverse: failed to load changelog', err);
    return;
  }
  overlay.innerHTML = panelHtml(entries);

  const latestDate = entries[0]?.date ?? '';
  let seenDate = '';
  try {
    seenDate = localStorage.getItem(SEEN_KEY) ?? '';
  } catch { /* localStorage unavailable -- just won't show the "new" badge */ }
  if (latestDate && latestDate !== seenDate) btn.classList.add('has-news');

  function open() {
    overlay.classList.add('open');
    btn.classList.remove('has-news');
    try { localStorage.setItem(SEEN_KEY, latestDate); } catch { /* best-effort only */ }
  }
  function close() {
    overlay.classList.remove('open');
  }
  btn.addEventListener('click', open);
  document.getElementById('changelog-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

init();
