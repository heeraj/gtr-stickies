const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const searchEl = document.getElementById('search');
const plusBtn = document.getElementById('plus');
const boardBtn = document.getElementById('board');
const closeBtn = document.getElementById('close');
const settingsBtn = document.getElementById('settings');
const minimizeBtn = document.getElementById('minimize');
const confirmEl = document.getElementById('confirm');
const keepBtn = document.getElementById('keep');
const discardBtn = document.getElementById('discard');
const managerEl = document.getElementById('manager');
const rowMenu = document.getElementById('row-menu');

let notes = [];
let query = '';
let pendingDeleteId = null;
let settings = { confirmDelete: true };
let menuNoteId = null;

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function titleOf(note) {
  const text = stripHtml(note.text);
  const line = text.split('\n').map((s) => s.trim()).find((s) => s.length > 0);
  if (!line) return 'Untitled';
  return line.length > 64 ? line.slice(0, 63) + '…' : line;
}

function relativeTime(ts) {
  if (!ts) return 'just now';
  const delta = Date.now() - ts;
  const sec = Math.max(0, Math.round(delta / 1000));
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 14) return day + 'd ago';
  try {
    return new Date(ts).toLocaleDateString();
  } catch (_) {
    return '';
  }
}

function filtered() {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter((n) => {
    const title = titleOf(n).toLowerCase();
    const body = stripHtml(n.text).toLowerCase();
    return title.includes(q) || body.includes(q);
  });
}

function statusOf(note) {
  if (note.minimized) return 'Minimized';
  if (note.open) return note.folded ? 'On desk · folded' : 'On desk';
  return 'Hidden';
}

function requestDelete(id) {
  hideRowMenu();
  if (settings.confirmDelete === false) {
    window.petal.deleteNote(id);
    return;
  }
  pendingDeleteId = id;
  confirmEl.hidden = false;
}

function render() {
  const items = filtered();
  listEl.innerHTML = '';
  if (items.length === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent = notes.length === 0 ? 'No notes yet' : 'No matching notes';
    return;
  }
  emptyEl.hidden = true;

  items.forEach((note) => {
    const li = document.createElement('li');
    const hidden = !note.open && !note.minimized;
    li.className = 'note-item' + (hidden ? ' is-hidden' : '') + (note.minimized ? ' is-minimized' : '');
    li.title = hidden ? 'Open this note' : 'Show this note';

    const swatch = document.createElement('span');
    swatch.className = 'item-swatch';
    swatch.style.background = note.color || '#F6E6C8';

    const body = document.createElement('div');
    body.className = 'item-body';

    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = titleOf(note);

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    const bits = [];
    bits.push(statusOf(note));
    if (note.pinned) bits.push('Pinned');
    bits.push(relativeTime(note.updatedAt));
    meta.textContent = bits.join(' · ');

    body.appendChild(title);
    body.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'item-open';
    openBtn.textContent = note.open || note.minimized ? 'Show' : 'Open';
    openBtn.title = note.open || note.minimized ? 'Bring to front' : 'Open note';
    openBtn.setAttribute('aria-label', openBtn.title);
    openBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      window.petal.openNote(note.id);
    });

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'icon-btn pin' + (note.pinned ? ' is-on' : '');
    pin.title = note.pinned ? 'Unpin' : 'Pin';
    pin.setAttribute('aria-label', pin.title);
    pin.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8.7 1.6c.9-.4 1.9-.2 2.6.5.7.7.9 1.7.5 2.6l-.3.7 1.8 1.8c.3.3.3.8 0 1.1l-.7.7c-.3.3-.8.3-1.1 0L10.3 7.8 5.9 12.2c-.2.2-.4.3-.7.3H3.8L2.4 13.9c-.2.2-.5.2-.7 0-.2-.2-.2-.5 0-.7l1.4-1.4v-1.4c0-.3.1-.5.3-.7L7.8 5.3 6.6 4.1c-.3-.3-.3-.8 0-1.1l.7-.7c.3-.3.8-.3 1.1 0L10.2 4l.7-.3z" fill="currentColor"/></svg>';
    pin.addEventListener('click', (event) => {
      event.stopPropagation();
      window.petal.pinNote(note.id, !note.pinned);
    });

    const dup = document.createElement('button');
    dup.type = 'button';
    dup.className = 'icon-btn';
    dup.title = 'Duplicate';
    dup.setAttribute('aria-label', 'Duplicate');
    dup.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="5.2" y="5.2" width="7.4" height="7.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.6 10.2V4.8c0-.9.7-1.6 1.6-1.6h5.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    dup.addEventListener('click', (event) => {
      event.stopPropagation();
      window.petal.duplicateNote(note.id);
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn close';
    del.title = 'Delete';
    del.setAttribute('aria-label', 'Delete');
    del.innerHTML =
      '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>';
    del.addEventListener('click', (event) => {
      event.stopPropagation();
      requestDelete(note.id);
    });

    actions.appendChild(openBtn);
    actions.appendChild(pin);
    actions.appendChild(dup);
    actions.appendChild(del);

    li.appendChild(swatch);
    li.appendChild(body);
    li.appendChild(actions);
    li.tabIndex = 0;
    li.dataset.id = note.id;
    li.addEventListener('click', () => window.petal.openNote(note.id));
    li.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.petal.openNote(note.id);
      }
    });
    li.addEventListener('contextmenu', (event) => {
      if (event.target.closest && event.target.closest('.item-actions')) return;
      event.preventDefault();
      event.stopPropagation();
      openRowMenu(event.clientX, event.clientY, note);
    });
    listEl.appendChild(li);
  });
}

function applyList(list) {
  notes = Array.isArray(list) ? list : [];
  if (pendingDeleteId && !notes.some((n) => n.id === pendingDeleteId)) {
    pendingDeleteId = null;
    confirmEl.hidden = true;
  }
  if (menuNoteId && !notes.some((n) => n.id === menuNoteId)) hideRowMenu();
  render();
}

searchEl.addEventListener('input', () => {
  query = searchEl.value || '';
  render();
});

searchEl.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (rowMenu && !rowMenu.hidden) return;
  if (searchEl.value) {
    event.preventDefault();
    searchEl.value = '';
    query = '';
    render();
  } else {
    searchEl.blur();
  }
});

plusBtn.addEventListener('click', () => window.petal.newNote());
if (boardBtn) boardBtn.addEventListener('click', () => window.petal.openBoard());
settingsBtn.addEventListener('click', () => window.petal.openSettings());
minimizeBtn.addEventListener('click', () => window.petal.minimizeManager());
closeBtn.addEventListener('click', () => window.petal.closeManager());

keepBtn.addEventListener('click', () => {
  pendingDeleteId = null;
  confirmEl.hidden = true;
});

discardBtn.addEventListener('click', () => {
  if (pendingDeleteId) window.petal.deleteNote(pendingDeleteId);
  pendingDeleteId = null;
  confirmEl.hidden = true;
});

window.petal.onNotesChanged(applyList);
window.petal.listNotes().then(applyList);
window.petal.onSettings((next) => {
  if (next) settings = { ...settings, ...next };
});
function showWelcome(show) {
  const el = document.getElementById('welcome');
  if (!el) return;
  el.hidden = !show;
}
function dismissWelcome() {
  showWelcome(false);
  if (window.petal.saveSettings) window.petal.saveSettings({ seenWelcome: true });
}
const welcomeGo = document.getElementById('welcome-go');
const welcomeDash = document.getElementById('welcome-dash');
if (welcomeGo) welcomeGo.addEventListener('click', dismissWelcome);
if (welcomeDash) welcomeDash.addEventListener('click', () => {
  dismissWelcome();
  if (window.petal.openBoard) window.petal.openBoard();
});
window.petal.getSettings().then((next) => {
  if (next) settings = { ...settings, ...next };
  const ver = document.querySelector('.app-ver');
  if (ver && next && next.version) ver.textContent = next.version;
  if (next && !next.seenWelcome) showWelcome(true);
});

function hideRowMenu() {
  menuNoteId = null;
  if (rowMenu) rowMenu.hidden = true;
}

function menuButton(label, act, opts) {
  const o = opts || {};
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('role', 'menuitem');
  btn.dataset.act = act;
  if (o.danger) btn.classList.add('is-danger');
  const lab = document.createElement('span');
  lab.className = 'menu-label';
  lab.textContent = label;
  btn.appendChild(lab);
  return btn;
}

function menuSep() {
  const el = document.createElement('div');
  el.className = 'menu-sep';
  return el;
}

function placeRowMenu(clientX, clientY) {
  if (!rowMenu || !managerEl) return;
  const box = managerEl.getBoundingClientRect();
  let left = clientX - box.left;
  let top = clientY - box.top;
  rowMenu.hidden = false;
  rowMenu.style.left = left + 'px';
  rowMenu.style.top = top + 'px';
  requestAnimationFrame(() => {
    const mr = rowMenu.getBoundingClientRect();
    if (mr.right > box.right - 8) left -= mr.width;
    if (mr.bottom > box.bottom - 8) top -= mr.height;
    left = Math.min(Math.max(8, left), Math.max(8, box.width - mr.width - 8));
    top = Math.min(Math.max(8, top), Math.max(8, box.height - mr.height - 8));
    rowMenu.style.left = left + 'px';
    rowMenu.style.top = top + 'px';
  });
}

function openRowMenu(clientX, clientY, note) {
  if (!rowMenu || !confirmEl.hidden) return;
  menuNoteId = note.id;
  rowMenu.innerHTML = '';
  const openLabel = note.open || note.minimized ? 'Show' : 'Open';
  rowMenu.appendChild(menuButton(openLabel, 'open'));
  rowMenu.appendChild(menuButton(note.pinned ? 'Unpin' : 'Pin', 'pin'));
  rowMenu.appendChild(menuButton('Duplicate', 'duplicate'));
  rowMenu.appendChild(menuButton('Copy title', 'copy-title'));
  rowMenu.appendChild(menuSep());
  rowMenu.appendChild(menuButton('Delete', 'delete', { danger: true }));
  placeRowMenu(clientX, clientY);
}

function openEmptyMenu(clientX, clientY) {
  if (!rowMenu || !confirmEl.hidden) return;
  menuNoteId = null;
  rowMenu.innerHTML = '';
  rowMenu.appendChild(menuButton('New note', 'new'));
  placeRowMenu(clientX, clientY);
}

async function runRowAct(act) {
  const id = menuNoteId;
  hideRowMenu();
  if (act === 'new') {
    window.petal.newNote();
    return;
  }
  if (!id) return;
  const note = notes.find((n) => n.id === id);
  if (act === 'open') window.petal.openNote(id);
  else if (act === 'pin') window.petal.pinNote(id, !(note && note.pinned));
  else if (act === 'duplicate') window.petal.duplicateNote(id);
  else if (act === 'copy-title') {
    const title = titleOf(note || { text: '' });
    if (window.petal.writeClipboardText) await window.petal.writeClipboardText(title);
  } else if (act === 'delete') requestDelete(id);
}

if (rowMenu) {
  rowMenu.addEventListener('pointerdown', (event) => event.stopPropagation());
  rowMenu.addEventListener('contextmenu', (event) => event.preventDefault());
  rowMenu.addEventListener('click', (event) => {
    const btn = event.target.closest && event.target.closest('button[data-act]');
    if (!btn) return;
    runRowAct(btn.dataset.act);
  });
}

if (managerEl) {
  managerEl.addEventListener('contextmenu', (event) => {
    if (event.target.closest && event.target.closest('.item-actions, .manager-chrome, .confirm, .paper-menu')) return;
    if (event.target.closest && event.target.closest('.note-item')) return;
    event.preventDefault();
    openEmptyMenu(event.clientX, event.clientY);
  });
}

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest && event.target.closest('.paper-menu')) return;
  hideRowMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (rowMenu && !rowMenu.hidden) {
    event.preventDefault();
    hideRowMenu();
  }
});
