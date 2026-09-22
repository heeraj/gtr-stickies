const FONT_CSS = {
  'Source Serif 4': '"Source Serif 4", Georgia, serif',
  'Fraunces': '"Fraunces", Georgia, serif',
  'DM Sans': '"DM Sans", "Segoe UI", system-ui, sans-serif',
  'Georgia': 'Georgia, serif',
  'Segoe UI': '"Segoe UI", system-ui, sans-serif',
  'JetBrains Mono': '"JetBrains Mono", ui-monospace, monospace',
  'Caveat': '"Caveat", cursive',
};

const PAPER = [
  { hex: '#F6E6C8', name: 'Cream' },
  { hex: '#F4C7B8', name: 'Blush' },
  { hex: '#D5E5C8', name: 'Sage' },
  { hex: '#CDE4F0', name: 'Sky' },
  { hex: '#DDD6F3', name: 'Lavender' },
];

const INKS = [
  { hex: '#2A241C', name: 'Brown' },
  { hex: '#111111', name: 'Black' },
  { hex: '#8C2F22', name: 'Red' },
  { hex: '#2F5D3A', name: 'Green' },
  { hex: '#1E3A5F', name: 'Blue' },
  { hex: '#F8F1E3', name: 'Cream' },
];

const fontSel = document.getElementById('font');
const sizeSel = document.getElementById('size');
const leadingSel = document.getElementById('leading');
const papersEl = document.getElementById('papers');
const inksEl = document.getElementById('inks');
const opacityInput = document.getElementById('opacity');
const loginRow = document.getElementById('login-row');
const loginHint = document.getElementById('login-hint');
const shortcutEl = document.getElementById('shortcut');
const closeBtn = document.getElementById('close');
const root = document.getElementById('settings');

const TOGGLES = ['alwaysOnTop', 'newNotesFolded', 'confirmDelete', 'restoreOpenNotes', 'startOnLogin', 'snapToEdges', 'openBoardOnLaunch'];

let settings = {};

function bindToggle(id) {
  const btn = document.getElementById(id);
  btn.addEventListener('click', () => {
    const on = !btn.classList.contains('is-on');
    setToggle(btn, on);
    window.petal.saveSettings({ [id]: on });
  });
}

function setToggle(btn, on) {
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function paintPapers(active) {
  papersEl.innerHTML = '';
  PAPER.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dot' + (p.hex === active ? ' is-active' : '');
    btn.style.setProperty('--c', p.hex);
    btn.title = p.name;
    btn.setAttribute('aria-label', p.name);
    btn.addEventListener('click', () => {
      window.petal.saveSettings({ paperColor: p.hex });
    });
    papersEl.appendChild(btn);
  });
}

function paintInks(active) {
  inksEl.innerHTML = '';
  INKS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ink-dot' + (p.hex === active ? ' is-active' : '');
    btn.style.setProperty('--c', p.hex);
    btn.title = p.name;
    btn.setAttribute('aria-label', p.name);
    btn.addEventListener('click', () => {
      window.petal.saveSettings({ inkColor: p.hex });
    });
    inksEl.appendChild(btn);
  });
}

function apply(next) {
  settings = next || {};
  fontSel.value = settings.font || 'Source Serif 4';
  fontSel.style.fontFamily = FONT_CSS[fontSel.value] || FONT_CSS['Source Serif 4'];
  sizeSel.value = String(settings.size || 16);
  const lead = String(settings.lineHeight || 1.55);
  leadingSel.value = lead === '2.0' ? '2' : lead;
  opacityInput.value = String(Math.round((settings.opacity || 1) * 100));
  root.style.setProperty('--paper', settings.paperColor || '#F6E6C8');
  paintPapers(settings.paperColor || '#F6E6C8');
  paintInks(settings.inkColor || '#2A241C');
  TOGGLES.forEach((id) => {
    const btn = document.getElementById(id);
    setToggle(btn, !!settings[id]);
  });
  if (settings.loginItemSupported) {
    loginRow.hidden = false;
    loginHint.hidden = true;
  } else {
    loginRow.hidden = true;
    loginHint.hidden = false;
  }
  const courseEl = document.getElementById('boardCourse');
  if (courseEl && document.activeElement !== courseEl) {
    courseEl.value = settings.boardCourse || 'Business Law';
  }
  const liveEl = document.getElementById('boardLiveUrl');
  if (liveEl && document.activeElement !== liveEl) {
    liveEl.value = settings.boardLiveUrl || '';
  }
  if (settings.shortcut) shortcutEl.textContent = settings.shortcut;
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = 'GTR Stickies ' + (settings.version || '3.0');
}

fontSel.addEventListener('change', () => {
  fontSel.style.fontFamily = FONT_CSS[fontSel.value] || FONT_CSS['Source Serif 4'];
  window.petal.saveSettings({ font: fontSel.value });
});

sizeSel.addEventListener('change', () => {
  window.petal.saveSettings({ size: Number(sizeSel.value) || 16 });
});

leadingSel.addEventListener('change', () => {
  window.petal.saveSettings({ lineHeight: Number(leadingSel.value) || 1.55 });
});

opacityInput.addEventListener('input', () => {
  const pct = Number(opacityInput.value) || 100;
  window.petal.saveSettings({ opacity: Math.min(1, Math.max(0.55, pct / 100)) });
});

TOGGLES.forEach(bindToggle);
closeBtn.addEventListener('click', () => window.petal.closeSettings());

const courseEl = document.getElementById('boardCourse');
if (courseEl) {
  courseEl.addEventListener('change', () => {
    const value = String(courseEl.value || '').trim() || 'Business Law';
    window.petal.saveSettings({ boardCourse: value });
  });
}
const liveEl = document.getElementById('boardLiveUrl');
if (liveEl) {
  liveEl.addEventListener('change', () => {
    const value = String(liveEl.value || '').trim();
    window.petal.saveSettings({ boardLiveUrl: value });
  });
}

window.petal.onSettings(apply);
window.petal.getSettings().then(apply);
