const COLORS = ['#F6E6C8', '#F4C7B8', '#D5E5C8', '#CDE4F0', '#DDD6F3'];
const INK_COLORS = [
  { hex: '#2A241C', name: 'Brown' },
  { hex: '#111111', name: 'Black' },
  { hex: '#8C2F22', name: 'Red' },
  { hex: '#2F5D3A', name: 'Green' },
  { hex: '#1E3A5F', name: 'Blue' },
  { hex: '#F8F1E3', name: 'Cream' },
];
const SIZES = [12, 14, 16, 18, 22, 28];
const HIGHLIGHTS = {
  yellow: '#F5E6A8',
  peach: '#F6C7A6',
  mint: '#C9E4B8',
};

const FONT_CSS = {
  'Source Serif 4': '"Source Serif 4", "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif',
  'Fraunces': '"Fraunces", "Source Serif 4", Georgia, serif',
  'DM Sans': '"DM Sans", "Segoe UI", system-ui, sans-serif',
  'Georgia': 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  'Segoe UI': '"Segoe UI", system-ui, sans-serif',
  'JetBrains Mono': '"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
  'Caveat': '"Caveat", "Segoe Script", "Comic Sans MS", cursive',
};

const DEFAULT_FORMAT = {
  font: 'Source Serif 4',
  size: 16,
  lineHeight: 1.55,
  align: 'left',
  opacity: 1,
  ink: '#2A241C',
};

const noteEl = document.getElementById('note');
const textEl = document.getElementById('text');
const pinBtn = document.getElementById('pin');
const presenterBtn = document.getElementById('presenter');
const plusBtn = document.getElementById('plus');
const boardBtn = document.getElementById('board');
const closeBtn = document.getElementById('close');
const managerBtn = document.getElementById('manager');
const settingsBtn = document.getElementById('settings');
const minimizeBtn = document.getElementById('minimize');
const swatches = document.getElementById('swatches');
const resizeHandle = document.getElementById('resize');
const confirmEl = document.getElementById('confirm');
const keepBtn = document.getElementById('keep');
const discardBtn = document.getElementById('discard');
const fontSel = document.getElementById('font');
const sizeSel = document.getElementById('size');
const leadingSel = document.getElementById('leading');
const boldBtn = document.getElementById('bold');
const italicBtn = document.getElementById('italic');
const underlineBtn = document.getElementById('underline');
const strikeBtn = document.getElementById('strike');
const alignLeftBtn = document.getElementById('align-left');
const alignCenterBtn = document.getElementById('align-center');
const opacityInput = document.getElementById('opacity');
const bulletsBtn = document.getElementById('bullets');
const checksBtn = document.getElementById('checks');
const hlYellowBtn = document.getElementById('hl-yellow');
const hlPeachBtn = document.getElementById('hl-peach');
const hlMintBtn = document.getElementById('hl-mint');
const hlClearBtn = document.getElementById('hl-clear');
const foldHit = document.getElementById('fold-hit');
const chromeRow = document.getElementById('chrome-row');
const inkMenu = document.getElementById('ink-menu');
const inkToggle = document.getElementById('ink-toggle');
const inkChip = document.getElementById('ink-chip');
const inkDropdown = document.getElementById('ink-dropdown');
const paperMenu = document.getElementById('paper-menu');
const paperFlyout = document.getElementById('paper-flyout');
const findStrip = document.getElementById('find-strip');
const findInput = document.getElementById('find-input');
const findCount = document.getElementById('find-count');
const findPrevBtn = document.getElementById('find-prev');
const findNextBtn = document.getElementById('find-next');
const findCloseBtn = document.getElementById('find-close');
const remoteBanner = document.getElementById('remote-banner');
const remoteBannerUrl = document.getElementById('remote-banner-url');
const remoteBannerCode = document.getElementById('remote-banner-code');
const remoteCopyBtn = document.getElementById('remote-copy');

let state = {
  id: null,
  color: COLORS[0],
  text: '',
  pinned: false,
  presenterMode: false,
  folded: false,
  colors: COLORS,
  inkColors: INK_COLORS.map((c) => c.hex),
  format: { ...DEFAULT_FORMAT },
  settings: { confirmDelete: true },
  images: [],
  tessReady: false,
};

let saveTimer = null;
let formatTimer = null;
let savedRange = null;
let findOpen = false;
let findMutating = false;
let findIndex = 0;
let findTimer = null;
let flyoutTimer = null;
let menuOpenedAt = 0;
let menuOpenTimer = null;
let lastMenuPoint = { x: 0, y: 0 };
let lastSpell = { misspelledWord: '', dictionarySuggestions: [], at: 0 };
let currentFlyout = null;
const SPELL_VARIANTS = {
  behaviour: 'behavior', behavior: 'behaviour',
  colour: 'color', color: 'colour',
  honour: 'honor', honor: 'honour',
  favour: 'favor', favor: 'favour',
  labour: 'labor', labor: 'labour',
  centre: 'center', center: 'centre',
  metre: 'meter', meter: 'metre',
  defence: 'defense', defense: 'defence',
  offence: 'offense', offense: 'offence',
  organisation: 'organization', organization: 'organisation',
  recognise: 'recognize', recognize: 'recognise',
  analyse: 'analyze', analyze: 'analyse',
  travelling: 'traveling', traveling: 'travelling',
  cancelled: 'canceled', canceled: 'cancelled',
  modelling: 'modeling', modeling: 'modelling',
  programme: 'program', program: 'programme',
  grey: 'gray', gray: 'grey',
  practise: 'practice',
};

function matchCase(sample, next) {
  if (!sample || !next) return next;
  if (sample.toUpperCase() === sample) return next.toUpperCase();
  if (sample[0] === sample[0].toUpperCase()) return next.charAt(0).toUpperCase() + next.slice(1);
  return next;
}

function variantSuggestions(word) {
  if (!word) return [];
  const alt = SPELL_VARIANTS[word.toLowerCase()];
  if (!alt || alt.toLowerCase() === word.toLowerCase()) return [];
  return [matchCase(word, alt)];
}

function selectedSingleWord() {
  const sel = selectionInsideEditor();
  if (!sel || sel.isCollapsed) return '';
  const t = String(sel.toString() || '').trim();
  if (!t || /\s/.test(t)) return '';
  if (!/^[A-Za-z][A-Za-z'-]{0,47}$/.test(t)) return '';
  return t;
}

function uniqueWords(list) {
  const seen = new Set();
  const out = [];
  list.forEach((w) => {
    const key = String(w || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(w);
  });
  return out;
}

const HISTORY_MAX = 80;
const HISTORY_INPUT_MS = 300;
const SPELL_MENU_DELAY_MS = 0;
const history = {
  past: [],
  future: [],
  applying: false,
  inputTimer: null,
};

function paintSwatches() {
  const colors = state.colors || COLORS;
  swatches.innerHTML = '';
  colors.forEach((color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dot' + (color === state.color ? ' is-active' : '');
    btn.style.setProperty('--c', color);
    btn.title = colorName(color);
    btn.setAttribute('aria-label', colorName(color));
    btn.addEventListener('click', () => setColor(color));
    swatches.appendChild(btn);
  });
}

function colorName(hex) {
  switch (hex) {
    case '#F6E6C8': return 'Cream';
    case '#F4C7B8': return 'Blush';
    case '#D5E5C8': return 'Sage';
    case '#CDE4F0': return 'Sky';
    case '#DDD6F3': return 'Lavender';
    default: return 'Paper';
  }
}

function setInkMenuOpen(open) {
  if (!inkDropdown || !inkToggle) return;
  inkDropdown.hidden = !open;
  inkToggle.classList.toggle('is-open', !!open);
  inkToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function paintInks() {
  const inks = (state.inkColors && state.inkColors.length ? state.inkColors : INK_COLORS.map((c) => c.hex));
  inkDropdown.innerHTML = '';
  inks.forEach((hex) => {
    const meta = INK_COLORS.find((c) => c.hex === hex);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ink-option';
    btn.dataset.ink = hex;
    btn.setAttribute('role', 'menuitem');
    const chip = document.createElement('span');
    chip.className = 'ink-chip';
    chip.style.setProperty('--c', hex);
    const label = document.createElement('span');
    label.textContent = (meta && meta.name) || 'Ink';
    btn.title = label.textContent;
    btn.appendChild(chip);
    btn.appendChild(label);
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      rememberSelection();
    });
    btn.addEventListener('click', keepSelection(() => {
      applyInlineStyle('color', hex);
      setInkMenuOpen(false);
    }));
    inkDropdown.appendChild(btn);
  });
  syncInkDots();
}

function applyColor(color) {
  state.color = color;
  noteEl.style.setProperty('--paper', color);
  paintSwatches();
}

function setColor(color) {
  applyColor(color);
  window.petal.setColor(color);
}


let remoteInfo = null;

function updateRemoteBanner(info) {
  remoteInfo = info && info.running ? info : null;
  if (!remoteBanner) return;
  if (!state.presenterMode || !remoteInfo) {
    remoteBanner.hidden = true;
    return;
  }
  const url = remoteInfo.url || (remoteInfo.baseUrl ? remoteInfo.baseUrl + '/?code=' + remoteInfo.code : '');
  if (remoteBannerUrl) {
    remoteBannerUrl.textContent = url
      ? url.replace(/\?code=.*/, '')
      : (remoteInfo.ip ? 'http://' + remoteInfo.ip + ':' + remoteInfo.port : 'starting…');
    remoteBannerUrl.title = url || '';
  }
  if (remoteBannerCode) {
    remoteBannerCode.textContent = remoteInfo.code ? ('code ' + remoteInfo.code) : '';
  }
  remoteBanner.hidden = false;
}

function applyRemoteScroll(payload) {
  if (!payload) return;
  const el = textEl;
  if (!el) return;
  // Never focus — phone remote must not steal presentation focus.
  if (typeof payload.dy === 'number' && Number.isFinite(payload.dy) && payload.dy !== 0) {
    el.scrollBy({ top: payload.dy, left: 0, behavior: 'auto' });
    return;
  }
  if (typeof payload.ratio === 'number' && Number.isFinite(payload.ratio)) {
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = max * Math.max(0, Math.min(1, payload.ratio));
    return;
  }
  if (payload.page === 'up' || payload.page === 'down') {
    const page = Math.max(48, Math.floor(el.clientHeight * 0.85));
    el.scrollBy({ top: payload.page === 'up' ? -page : page, left: 0, behavior: 'auto' });
  }
}

function applyPin(pinned) {
  state.pinned = !!pinned;
  pinBtn.classList.toggle('is-on', state.pinned);
  pinBtn.setAttribute('aria-pressed', state.pinned ? 'true' : 'false');
  pinBtn.title = state.pinned ? 'Unpin from top' : 'Keep on top';
}

function applyPresenter(on) {
  state.presenterMode = !!on;
  if (presenterBtn) {
    presenterBtn.classList.toggle('is-on', state.presenterMode);
    presenterBtn.setAttribute('aria-pressed', state.presenterMode ? 'true' : 'false');
    presenterBtn.title = state.presenterMode
      ? 'Exit presenter mode'
      : 'Presenter: hide pointer & hide from screen share';
    presenterBtn.setAttribute('aria-label', presenterBtn.title);
  }
  noteEl.classList.toggle('is-presenter', state.presenterMode);
  if (!state.presenterMode) {
    if (window.petal.setPresenterPointer) window.petal.setPresenterPointer(false);
    updateRemoteBanner(null);
  } else {
    const paper = document.querySelector('.paper');
    if (paper && typeof paper.matches === 'function' && paper.matches(':hover')) {
      if (window.petal.setPresenterPointer) window.petal.setPresenterPointer(true);
    }
  }
}

function applyFolded(folded) {
  state.folded = !!folded;
  noteEl.classList.toggle('is-folded', state.folded);
  if (state.folded) {
    setInkMenuOpen(false);
    hidePaperMenu();
    closeFind(false);
  }
}

function isEmpty() {
  return textEl.textContent.replace(/\u200b/g, '').trim() === '';
}

function editorHtml() {
  if (isEmpty()) return '';
  if (!textEl.querySelector('[data-find-hit]')) return textEl.innerHTML;
  const clone = textEl.cloneNode(true);
  unwrapFindHits(clone);
  return clone.innerHTML;
}

function isWordChar(ch) {
  if (!ch) return false;
  try {
    return /[\p{L}\p{N}'\u2019]/u.test(ch);
  } catch (_) {
    return /[A-Za-z0-9\u00C0-\u024F'\u2019]/.test(ch);
  }
}

function pointToOffset(root, node, offset) {
  if (!root || !node) return 0;
  const pre = document.createRange();
  try {
    pre.selectNodeContents(root);
    pre.setEnd(node, offset);
    return pre.toString().length;
  } catch (_) {
    return (root.textContent || '').length;
  }
}

function offsetToPoint(root, offset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let last = null;
  while (walker.nextNode()) {
    const n = walker.currentNode;
    last = n;
    const len = (n.nodeValue || '').length;
    if (remaining <= len) return { node: n, offset: remaining };
    remaining -= len;
  }
  if (last) return { node: last, offset: (last.nodeValue || '').length };
  return { node: root, offset: root.childNodes.length };
}

function captureSelOffsets() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 };
  const a = sel.anchorNode;
  const f = sel.focusNode;
  if (!a || (a !== textEl && !textEl.contains(a))) return { start: 0, end: 0 };
  const start = pointToOffset(textEl, a, sel.anchorOffset);
  const end = f ? pointToOffset(textEl, f, sel.focusOffset) : start;
  return { start, end };
}

function restoreSelOffsets(selOff) {
  if (!selOff) return;
  textEl.focus();
  const a = offsetToPoint(textEl, selOff.start);
  const b = offsetToPoint(textEl, selOff.end);
  try {
    const range = document.createRange();
    if (selOff.start <= selOff.end) {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } else {
      range.setStart(b.node, b.offset);
      range.setEnd(a.node, a.offset);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {
    /* ignore */
  }
}

function snapshotNow() {
  return { html: editorHtml(), sel: captureSelOffsets() };
}

function pushHistory() {
  if (history.applying) return;
  const snap = snapshotNow();
  const last = history.past.length ? history.past[history.past.length - 1] : null;
  if (last && last.html === snap.html) return;
  history.past.push(snap);
  if (history.past.length > HISTORY_MAX) history.past.shift();
  history.future = [];
}

function flushHistoryInput() {
  if (history.inputTimer) {
    clearTimeout(history.inputTimer);
    history.inputTimer = null;
  }
  pushHistory();
}

function beginEdit() {
  if (history.applying || findMutating) return;
  flushHistoryInput();
}

function resetHistory() {
  if (history.inputTimer) {
    clearTimeout(history.inputTimer);
    history.inputTimer = null;
  }
  history.applying = false;
  history.past = [snapshotNow()];
  history.future = [];
}

function restoreSnapshot(snap) {
  history.applying = true;
  findMutating = true;
  if (history.inputTimer) {
    clearTimeout(history.inputTimer);
    history.inputTimer = null;
  }
  try {
    textEl.innerHTML = (snap && snap.html) || '';
    restoreSelOffsets(snap && snap.sel);
    rememberSelection();
    syncEmpty();
  } finally {
    findMutating = false;
    history.applying = false;
  }
  scheduleSave();
  syncMarks();
  if (findIsOpen() && findInput && findInput.value) runFind(findInput.value);
}

function canUndo() {
  const cur = editorHtml();
  let n = history.past.length;
  if (n && history.past[n - 1].html === cur) n--;
  return n > 0;
}

function canRedo() {
  return history.future.length > 0;
}

function undo() {
  if (history.applying) return;
  flushHistoryInput();
  const current = snapshotNow();
  if (history.past.length && history.past[history.past.length - 1].html === current.html) {
    history.past.pop();
  }
  if (!history.past.length) {
    history.past.push(current);
    return;
  }
  history.future.push(current);
  restoreSnapshot(history.past[history.past.length - 1]);
}

function redo() {
  if (history.applying || !history.future.length) return;
  flushHistoryInput();
  const current = snapshotNow();
  if (!history.past.length || history.past[history.past.length - 1].html !== current.html) {
    history.past.push(current);
  }
  const next = history.future.pop();
  restoreSnapshot(next);
  if (!history.past.length || history.past[history.past.length - 1].html !== next.html) {
    history.past.push(next);
  }
}

function caretRangeFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos || !pos.offsetNode) return null;
    const r = document.createRange();
    r.setStart(pos.offsetNode, pos.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

function selectWordAtClick(x, y) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount && !sel.isCollapsed) {
    const node = sel.anchorNode;
    if (node && (node === textEl || textEl.contains(node))) return 'selection';
  }
  const caret = caretRangeFromPoint(x, y);
  if (!caret || (caret.startContainer !== textEl && !textEl.contains(caret.startContainer))) {
    return 'none';
  }
  sel.removeAllRanges();
  sel.addRange(caret);
  const full = textEl.textContent || '';
  const pos = pointToOffset(textEl, caret.startContainer, caret.startOffset);
  let i = pos;
  const ch = (idx) => (idx >= 0 && idx < full.length ? full.charAt(idx) : '');
  if (!isWordChar(ch(i)) && isWordChar(ch(i - 1))) i -= 1;
  if (!isWordChar(ch(i))) return 'caret';
  let start = i;
  let end = i + 1;
  while (start > 0 && isWordChar(ch(start - 1))) start -= 1;
  while (end < full.length && isWordChar(ch(end))) end += 1;
  const a = offsetToPoint(textEl, start);
  const b = offsetToPoint(textEl, end);
  try {
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    if (!range.collapsed) {
      sel.removeAllRanges();
      sel.addRange(range);
      return 'word';
    }
  } catch (_) {
    /* leave collapsed */
  }
  return 'caret';
}

function ensureWordSelected(word) {
  restoreSelection();
  const sel = window.getSelection();
  const selected = sel && sel.rangeCount ? sel.toString() : '';
  if (selected && (!word || selected === word)) return true;
  if (!word) return !!(sel && !sel.isCollapsed);
  const full = textEl.textContent || '';
  const idx = full.indexOf(word);
  if (idx < 0) return !!(sel && !sel.isCollapsed);
  let prefer = idx;
  if (sel && sel.rangeCount) {
    const at = pointToOffset(textEl, sel.anchorNode, sel.anchorOffset);
    let from = 0;
    let found = -1;
    while (from <= full.length) {
      const next = full.indexOf(word, from);
      if (next < 0) break;
      if (found < 0 || Math.abs(next - at) < Math.abs(found - at)) found = next;
      from = next + 1;
    }
    if (found >= 0) prefer = found;
  }
  try {
    const a = offsetToPoint(textEl, prefer);
    const b = offsetToPoint(textEl, prefer + word.length);
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(range);
    rememberSelection();
    return true;
  } catch (_) {
    return !!(sel && !sel.isCollapsed);
  }
}

function syncEmpty() {
  const empty = isEmpty();
  textEl.classList.toggle('is-empty', empty);
  if (!empty) return;
  const html = textEl.innerHTML;
  if (html && /<[a-z]/i.test(html) && textEl.textContent.replace(/\u200b/g, '').trim() === '') {
    textEl.innerHTML = '';
  }
}

function looksLikeHtml(s) {
  return /<[a-z][\s\S]*>/i.test(s);
}

function setEditorContent(raw) {
  const s = typeof raw === 'string' ? raw : '';
  if (!s) {
    textEl.innerHTML = '';
  } else if (looksLikeHtml(s)) {
    textEl.innerHTML = s;
  } else {
    textEl.textContent = s;
  }
  syncEmpty();
}

function applyFormat(format) {
  const next = { ...DEFAULT_FORMAT, ...(format || {}) };
  if (!FONT_CSS[next.font]) next.font = DEFAULT_FORMAT.font;
  state.format = next;
  textEl.style.fontFamily = FONT_CSS[next.font];
  // Default size for unstyled text only — size control never writes this.
  textEl.style.fontSize = next.size + 'px';
  textEl.style.lineHeight = String(next.lineHeight);
  textEl.style.textAlign = next.align === 'center' ? 'center' : 'left';
  const ink = next.ink && INK_COLORS.some((c) => c.hex === next.ink) ? next.ink : DEFAULT_FORMAT.ink;
  state.format.ink = ink;
  noteEl.style.setProperty('--ink', ink);
  textEl.style.color = ink;
  const opacity = Math.min(1, Math.max(0.55, Number(next.opacity) || 1));
  state.format.opacity = opacity;
  noteEl.style.setProperty('--paper-alpha', String(opacity));

  fontSel.value = next.font;
  fontSel.style.fontFamily = FONT_CSS[next.font] || FONT_CSS['Source Serif 4'];
  sizeSel.value = String(next.size);
  const lead = String(next.lineHeight);
  leadingSel.value = lead === '2.0' ? '2' : lead;
  if (![...leadingSel.options].some((o) => o.value === leadingSel.value)) {
    leadingSel.value = '1.55';
  }
  opacityInput.value = String(Math.round(opacity * 100));
  opacityInput.title = 'Paper transparency ' + Math.round(opacity * 100) + '%';
  syncAlignButtons();
  syncInkDots();
}

function scheduleSave() {
  syncEmpty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.petal.updateText(editorHtml());
  }, 140);
}

function flushSave() {
  clearTimeout(saveTimer);
  window.petal.updateText(editorHtml());
}

function persistFormat() {
  clearTimeout(formatTimer);
  formatTimer = setTimeout(() => {
    window.petal.updateFormat({ ...state.format });
  }, 80);
}

function selectionInsideEditor() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  if (!node) return null;
  if (node === textEl || textEl.contains(node)) return sel;
  return null;
}

function rememberSelection() {
  const sel = selectionInsideEditor();
  if (!sel) {
    savedRange = null;
    return;
  }
  try {
    savedRange = sel.getRangeAt(0).cloneRange();
  } catch (_) {
    savedRange = null;
  }
}

function restoreSelection() {
  textEl.focus();
  if (!savedRange) return false;
  try {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  } catch (_) {
    return false;
  }
}

function withStyleCss() {
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch (_) {
    /* ignore */
  }
}

function applyStyleToNode(node, property, value) {
  if (!node) return;
  if (node.nodeType === 11) {
    for (const child of [...node.childNodes]) applyStyleToNode(child, property, value);
    return;
  }
  if (node.nodeType === 1) {
    node.style[property] = value;
    for (const child of [...node.children]) applyStyleToNode(child, property, value);
  }
}

function insertTypingSpan(property, value) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const span = document.createElement('span');
  span.style[property] = value;
  span.appendChild(document.createTextNode('\u200b'));
  range.insertNode(span);
  const next = document.createRange();
  next.setStart(span.firstChild, 1);
  next.collapse(true);
  sel.removeAllRanges();
  sel.addRange(next);
}

function wrapTextNodes(root, property, value) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((t) => {
    if (!t.nodeValue) return;
    const span = document.createElement('span');
    span.style[property] = value;
    t.parentNode.insertBefore(span, t);
    span.appendChild(t);
  });
}

function wrapSelection(property, value) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) {
    insertTypingSpan(property, value);
    return;
  }
  try {
    const wrapper = document.createElement('span');
    wrapper.style[property] = value;
    range.surroundContents(wrapper);
    applyStyleToNode(wrapper, property, value);
    sel.removeAllRanges();
    const after = document.createRange();
    after.selectNodeContents(wrapper);
    sel.addRange(after);
    return;
  } catch (_) {
    /* selection crosses elements */
  }
  const contents = range.extractContents();
  applyStyleToNode(contents, property, value);
  wrapTextNodes(contents, property, value);
  const first = contents.firstChild;
  const last = contents.lastChild;
  range.insertNode(contents);
  if (first && last) {
    sel.removeAllRanges();
    const after = document.createRange();
    after.setStartBefore(first);
    after.setEndAfter(last);
    sel.addRange(after);
  }
}

function applyInlineStyle(property, value, record) {
  restoreSelection();
  textEl.focus();
  if (record !== false) beginEdit();
  withStyleCss();
  const sel = selectionInsideEditor();
  if (!sel) {
    insertTypingSpan(property, value);
    scheduleSave();
    syncMarks();
    return;
  }
  wrapSelection(property, value);
  scheduleSave();
  syncMarks();
}

function execMark(command) {
  restoreSelection();
  textEl.focus();
  beginEdit();
  withStyleCss();
  try {
    document.execCommand(command, false, null);
  } catch (_) {
    /* ignore */
  }
  syncMarks();
  scheduleSave();
}

function nearestSize(px) {
  return SIZES.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
}

function hexOfRgb(color) {
  if (!color) return '';
  if (color[0] === '#') return color.toUpperCase();
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '';
  const h = (n) => Number(n).toString(16).padStart(2, '0');
  return ('#' + h(m[1]) + h(m[2]) + h(m[3])).toUpperCase();
}

function selectionComputed() {
  const sel = selectionInsideEditor();
  if (!sel) return window.getComputedStyle(textEl);
  let node = sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentElement;
  if (!node || node === textEl) return window.getComputedStyle(textEl);
  if (!textEl.contains(node)) return window.getComputedStyle(textEl);
  return window.getComputedStyle(node);
}

function syncInkDots() {
  const cs = selectionComputed();
  const current = hexOfRgb(cs.color) || (state.format.ink || '').toUpperCase();
  if (inkChip) {
    inkChip.style.setProperty('--c', current || '#2A241C');
  }
  if (!inkDropdown) return;
  inkDropdown.querySelectorAll('.ink-option').forEach((btn) => {
    const hex = (btn.dataset.ink || '').toUpperCase();
    btn.classList.toggle('is-active', hex === current);
  });
}

function syncListButtons() {
  const sel = selectionInsideEditor();
  let node = sel && sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentElement;
  const ul = node && node.closest ? node.closest('ul') : null;
  const inList = !!(ul && textEl.contains(ul));
  const isCheck = inList && ul.classList.contains('checklist');
  bulletsBtn.classList.toggle('is-on', inList && !isCheck);
  checksBtn.classList.toggle('is-on', isCheck);
  bulletsBtn.setAttribute('aria-pressed', inList && !isCheck ? 'true' : 'false');
  checksBtn.setAttribute('aria-pressed', isCheck ? 'true' : 'false');
}

function syncMarks() {
  const query = (cmd) => {
    try {
      return document.queryCommandState(cmd);
    } catch (_) {
      return false;
    }
  };
  const bold = query('bold');
  const italic = query('italic');
  const underline = query('underline');
  const strike = query('strikeThrough');
  boldBtn.classList.toggle('is-on', bold);
  italicBtn.classList.toggle('is-on', italic);
  underlineBtn.classList.toggle('is-on', underline);
  if (strikeBtn) {
    strikeBtn.classList.toggle('is-on', strike);
    strikeBtn.setAttribute('aria-pressed', strike ? 'true' : 'false');
  }
  boldBtn.setAttribute('aria-pressed', bold ? 'true' : 'false');
  italicBtn.setAttribute('aria-pressed', italic ? 'true' : 'false');
  underlineBtn.setAttribute('aria-pressed', underline ? 'true' : 'false');

  const cs = selectionComputed();
  const px = Math.round(parseFloat(cs.fontSize) || state.format.size || 16);
  sizeSel.value = String(nearestSize(px));
  syncInkDots();
  syncListButtons();
}

function syncAlignButtons() {
  const center = state.format.align === 'center';
  alignLeftBtn.classList.toggle('is-on', !center);
  alignCenterBtn.classList.toggle('is-on', center);
  alignLeftBtn.setAttribute('aria-pressed', center ? 'false' : 'true');
  alignCenterBtn.setAttribute('aria-pressed', center ? 'true' : 'false');
}

function setAlign(align) {
  state.format.align = align === 'center' ? 'center' : 'left';
  textEl.style.textAlign = state.format.align;
  syncAlignButtons();
  persistFormat();
}

function currentList() {
  const sel = selectionInsideEditor();
  let node = sel && sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentElement;
  const ul = node && node.closest ? node.closest('ul') : null;
  if (ul && textEl.contains(ul)) return ul;
  return null;
}

function toggleBullets() {
  restoreSelection();
  textEl.focus();
  beginEdit();
  withStyleCss();
  const ul = currentList();
  if (ul && ul.classList.contains('checklist')) {
    ul.classList.remove('checklist');
    ul.querySelectorAll('li.is-checked').forEach((li) => li.classList.remove('is-checked'));
  } else {
    try {
      document.execCommand('insertUnorderedList', false, null);
    } catch (_) {
      /* ignore */
    }
  }
  syncMarks();
  scheduleSave();
}

function toggleChecklist() {
  restoreSelection();
  textEl.focus();
  beginEdit();
  withStyleCss();
  let ul = currentList();
  if (ul && ul.classList.contains('checklist')) {
    try {
      document.execCommand('insertUnorderedList', false, null);
    } catch (_) {
      /* ignore */
    }
  } else if (ul) {
    ul.classList.add('checklist');
  } else {
    try {
      document.execCommand('insertUnorderedList', false, null);
    } catch (_) {
      /* ignore */
    }
    ul = currentList();
    if (ul) ul.classList.add('checklist');
  }
  syncMarks();
  scheduleSave();
}

function requestClose() {
  const html = editorHtml();
  window.petal.updateText(html);
  if (isEmpty() && !hasStickers() && state.settings && state.settings.confirmDelete !== false) {
    confirmEl.hidden = false;
    return;
  }
  window.petal.close({ text: html });
}

function hideConfirm() {
  confirmEl.hidden = true;
}

function init(data) {
  state = {
    ...state,
    ...data,
    format: { ...DEFAULT_FORMAT, ...(data.format || {}) },
    settings: { ...(state.settings || {}), ...(data.settings || {}) },
  };
  applyColor(state.color);
  applyPin(!!state.pinned);
  applyPresenter(!!state.presenterMode);
  applyFolded(!!state.folded);
  paintInks();
  applyFormat(state.format);
  setEditorContent(state.text || '');
  state.images = Array.isArray(data.images) ? data.images : [];
  state.tessReady = !!data.tessReady;
  paintStickers();
  resetHistory();
  textEl.focus({ preventScroll: true });
}

function keepSelection(handler) {
  return (event) => {
    event.preventDefault();
    restoreSelection();
    handler(event);
  };
}

inkToggle.addEventListener('mousedown', (event) => {
  event.preventDefault();
  rememberSelection();
});

inkToggle.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  restoreSelection();
  setInkMenuOpen(inkDropdown.hidden);
});

document.addEventListener('pointerdown', (event) => {
  if (inkMenu && !inkDropdown.hidden && !inkMenu.contains(event.target)) {
    setInkMenuOpen(false);
  }
  const t = event.target;
  if (t && t.closest && t.closest('.paper-menu, .paper-flyout')) {
    return;
  }
  // Right/middle click must not dismiss — on Windows the contextmenu event
  // is followed by pointer events that would instantly close the menu.
  if (event.button !== 0) return;
  if (menuOpenedAt && Date.now() - menuOpenedAt < 400) return;
  hidePaperMenu();
  if (t && t.closest && t.closest('.sticker, .sticker-menu, .snipe-slip')) return;
  hideStickerMenu();
  if (regionMode) cancelRegion();
  deselectSticker();
});

function isTypingField(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('#find-input, input, select, textarea');
}

document.addEventListener('keydown', (event) => {
  const cmd = event.ctrlKey || event.metaKey;
  const lower = String(event.key || '').toLowerCase();
  const key = event.key;
  if (!cmd && (key === 'Delete' || key === 'Backspace') && selectedId && !isTypingField(event.target) && !findIsOpen()) {
    event.preventDefault();
    event.stopPropagation();
    hidePaperMenu();
    removeSticker(selectedId);
    return;
  }
  if (!cmd || event.altKey || isTypingField(event.target)) return;
  if (lower === 'z') {
    event.preventDefault();
    event.stopPropagation();
    hidePaperMenu();
    if (event.shiftKey) redo();
    else undo();
  } else if (lower === 'y' && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    hidePaperMenu();
    redo();
  }
}, true);

document.addEventListener('keydown', (event) => {
  const cmd = event.ctrlKey || event.metaKey;
  const key = event.key;
  const lower = String(key || '').toLowerCase();
  if (!cmd && (key === 'Delete' || key === 'Backspace') && selectedId && !isTypingField(event.target) && !findIsOpen()) {
    event.preventDefault();
    event.stopPropagation();
    removeSticker(selectedId);
    return;
  }
  if (cmd && lower === 'f' && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    openFind();
    return;
  }
  if ((cmd && lower === 'g') || key === 'F3') {
    event.preventDefault();
    findStep(event.shiftKey ? -1 : 1);
    return;
  }

  if (key !== 'Escape') return;
  if (paperMenuOpen() || menuOpenTimer) {
    event.preventDefault();
    hidePaperMenu();
    restoreSelection();
    return;
  }
  if (inkDropdown && !inkDropdown.hidden) {
    event.preventDefault();
    setInkMenuOpen(false);
    return;
  }
  if (findIsOpen()) {
    event.preventDefault();
    closeFind(true);
    return;
  }
  if (regionMode) {
    event.preventDefault();
    cancelRegion();
    return;
  }
  hideStickerMenu();
  hideSnipeSlip();
});

pinBtn.addEventListener('click', () => {
  applyPin(!state.pinned);
  window.petal.setPinned(state.pinned);
});

if (presenterBtn) {
  presenterBtn.addEventListener('click', () => {
    applyPresenter(!state.presenterMode);
    if (window.petal.setPresenterMode) window.petal.setPresenterMode(state.presenterMode);
  });
}

if (window.petal.onRemoteScroll) {
  window.petal.onRemoteScroll((payload) => {
    applyRemoteScroll(payload);
  });
}

if (window.petal.onRemoteInfo) {
  window.petal.onRemoteInfo((info) => {
    updateRemoteBanner(info);
  });
}

if (remoteCopyBtn) {
  remoteCopyBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const url = (remoteInfo && remoteInfo.url) || '';
    if (!url) return;
    try {
      if (window.petal.writeClipboardText) await window.petal.writeClipboardText(url);
      else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
      remoteCopyBtn.textContent = 'Copied';
      setTimeout(() => { remoteCopyBtn.textContent = 'Copy link'; }, 1200);
    } catch (_) {
      /* ignore */
    }
  });
}


function notifyPresenterPointer(inside) {
  if (!state.presenterMode) {
    if (window.petal.setPresenterPointer) window.petal.setPresenterPointer(false);
    return;
  }
  if (window.petal.setPresenterPointer) window.petal.setPresenterPointer(!!inside);
}

/** Hide OS cursor only over paper/script so Meet window-share has no ghost pointer;
 *  restore when over chrome so Pin / Presenter / Close stay clickable. */
const paperEl = document.querySelector('.paper');
if (paperEl) {
  paperEl.addEventListener('mouseenter', () => notifyPresenterPointer(true));
  paperEl.addEventListener('mouseleave', () => notifyPresenterPointer(false));
}
window.addEventListener('blur', () => {
  if (window.petal.setPresenterPointer) window.petal.setPresenterPointer(false);
});

plusBtn.addEventListener('click', () => {
  window.petal.newNote();
});

if (boardBtn) {
  boardBtn.addEventListener('click', () => {
    if (window.petal.openBoard) window.petal.openBoard();
  });
}

managerBtn.addEventListener('click', () => {
  window.petal.openManager();
});

settingsBtn.addEventListener('click', () => {
  window.petal.openSettings();
});

minimizeBtn.addEventListener('click', () => {
  flushSave();
  window.petal.minimize();
});

closeBtn.addEventListener('click', requestClose);
keepBtn.addEventListener('click', hideConfirm);
discardBtn.addEventListener('click', () => {
  hideConfirm();
  window.petal.close({ text: '' });
});

let foldLock = 0;
let lastFold = { t: 0, x: 0, y: 0 };

function requestFold() {
  const now = Date.now();
  if (now - foldLock < 420) return;
  foldLock = now;
  window.petal.toggleFold();
}

function isFoldChrome(target) {
  if (!target || !target.closest) return false;
  if (target.closest('.actions, .format-bar, button, select, input, .swatches')) return false;
  return !!(target.closest('#fold-hit, .fold-hit, .wordmark'));
}

function onFoldDblClick(event) {
  if (!isFoldChrome(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  requestFold();
}

foldHit.addEventListener('dblclick', onFoldDblClick);

let dragging = false;
let dragArmed = false;
let dragOrigin = null;

function endWindowDrag() {
  if (dragging && window.petal && window.petal.dragEnd) {
    window.petal.dragEnd();
  }
  dragging = false;
  dragArmed = false;
  dragOrigin = null;
}

foldHit.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (!isFoldChrome(event.target)) return;

  const now = Date.now();
  const dist = Math.hypot(event.clientX - lastFold.x, event.clientY - lastFold.y);
  if (now - lastFold.t < 380 && dist < 8) {
    lastFold.t = 0;
    requestFold();
    return;
  }
  lastFold = { t: now, x: event.clientX, y: event.clientY };

  if (event.detail >= 2) return;

  dragging = false;
  dragArmed = true;
  dragOrigin = { x: event.screenX, y: event.screenY };
  try {
    foldHit.setPointerCapture(event.pointerId);
  } catch (_) {
    /* ignore */
  }
});

foldHit.addEventListener('pointermove', (event) => {
  if (!dragArmed && !dragging) return;
  if (!dragOrigin) return;
  const dx = event.screenX - dragOrigin.x;
  const dy = event.screenY - dragOrigin.y;
  if (!dragging) {
    if (Math.hypot(dx, dy) < 5) return;
    dragging = true;
    dragArmed = false;
    lastFold.t = 0;
    window.petal.dragStart({ screenX: event.screenX, screenY: event.screenY });
  }
  window.petal.dragMove({ screenX: event.screenX, screenY: event.screenY });
});

foldHit.addEventListener('pointerup', (event) => {
  endWindowDrag();
  try {
    foldHit.releasePointerCapture(event.pointerId);
  } catch (_) {
    /* ignore */
  }
});

foldHit.addEventListener('pointercancel', () => {
  endWindowDrag();
});

textEl.addEventListener('input', () => {
  if (findMutating || history.applying) return;
  scheduleSave();
  if (findIsOpen()) scheduleFindRefresh();
  if (history.inputTimer) clearTimeout(history.inputTimer);
  history.inputTimer = setTimeout(() => {
    history.inputTimer = null;
    pushHistory();
  }, HISTORY_INPUT_MS);
});
textEl.addEventListener('blur', flushSave);

textEl.addEventListener('keydown', (event) => {
  const cmd = event.ctrlKey || event.metaKey;
  const lower = event.key.toLowerCase();
  if (cmd && lower === 'n' && !event.shiftKey) {
    event.preventDefault();
    window.petal.newNote();
    return;
  }
  if (cmd && event.shiftKey && lower === 'x') {
    event.preventDefault();
    execMark('strikeThrough');
    return;
  }
  if (cmd && event.shiftKey && lower === 'v') {
    event.preventDefault();
    pastePlain();
    return;
  }
  if (cmd && lower === 'h' && !event.altKey) {
    event.preventDefault();
    applyInlineStyle('backgroundColor', event.shiftKey ? HIGHLIGHTS.peach : HIGHLIGHTS.yellow);
    return;
  }
  if (cmd && lower === 'u' && !event.altKey) {
    event.preventDefault();
    if (event.shiftKey) execMark('underline');
    else applyInlineStyle('backgroundColor', 'transparent');
    return;
  }
  if (cmd && ['b', 'i'].includes(lower) && !event.shiftKey) {
    event.preventDefault();
    const map = { b: 'bold', i: 'italic' };
    execMark(map[lower]);
  }
});

textEl.addEventListener('click', (event) => {
  const li = event.target.closest && event.target.closest('ul.checklist li');
  if (!li || !textEl.contains(li)) return;
  const rect = li.getBoundingClientRect();
  if (event.clientX - rect.left > 22) return;
  event.preventDefault();
  beginEdit();
  li.classList.toggle('is-checked');
  scheduleSave();
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel || !textEl.contains(sel.anchorNode)) return;
  rememberSelection();
  syncMarks();
});

fontSel.addEventListener('change', () => {
  state.format.font = fontSel.value;
  const stack = FONT_CSS[state.format.font] || FONT_CSS['Source Serif 4'];
  textEl.style.fontFamily = stack;
  fontSel.style.fontFamily = stack;
  persistFormat();
});

sizeSel.addEventListener('mousedown', rememberSelection);
sizeSel.addEventListener('change', () => {
  restoreSelection();
  applyInlineStyle('fontSize', sizeSel.value + 'px');
});

leadingSel.addEventListener('change', () => {
  state.format.lineHeight = Number(leadingSel.value) || 1.55;
  textEl.style.lineHeight = String(state.format.lineHeight);
  persistFormat();
});

opacityInput.addEventListener('input', () => {
  const pct = Number(opacityInput.value) || 100;
  state.format.opacity = Math.min(1, Math.max(0.55, pct / 100));
  noteEl.style.setProperty('--paper-alpha', String(state.format.opacity));
  opacityInput.title = 'Paper transparency ' + Math.round(state.format.opacity * 100) + '%';
  persistFormat();
});

[
  boldBtn,
  italicBtn,
  underlineBtn,
  strikeBtn,
  alignLeftBtn,
  alignCenterBtn,
  bulletsBtn,
  checksBtn,
  hlYellowBtn,
  hlPeachBtn,
  hlClearBtn,
].filter(Boolean).forEach((btn) => {
  btn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    rememberSelection();
  });
});

boldBtn.addEventListener('click', keepSelection(() => execMark('bold')));
italicBtn.addEventListener('click', keepSelection(() => execMark('italic')));
underlineBtn.addEventListener('click', keepSelection(() => execMark('underline')));
if (strikeBtn) strikeBtn.addEventListener('click', keepSelection(() => execMark('strikeThrough')));
alignLeftBtn.addEventListener('click', keepSelection(() => setAlign('left')));
alignCenterBtn.addEventListener('click', keepSelection(() => setAlign('center')));
bulletsBtn.addEventListener('click', keepSelection(() => toggleBullets()));
checksBtn.addEventListener('click', keepSelection(() => toggleChecklist()));
hlYellowBtn.addEventListener('click', keepSelection(() => applyInlineStyle('backgroundColor', HIGHLIGHTS.yellow)));
hlPeachBtn.addEventListener('click', keepSelection(() => applyInlineStyle('backgroundColor', HIGHLIGHTS.peach)));
if (hlMintBtn) hlMintBtn.addEventListener('click', keepSelection(() => applyInlineStyle('backgroundColor', HIGHLIGHTS.mint)));
hlClearBtn.addEventListener('click', keepSelection(() => applyInlineStyle('backgroundColor', 'transparent')));

noteEl.addEventListener('pointerdown', (event) => {
  if (
    event.target === textEl ||
    textEl.contains(event.target) ||
    event.target.closest('.chrome') ||
    event.target.closest('.resize-handle') ||
    event.target.closest('.confirm') ||
    event.target.closest('.sticker') ||
    event.target.closest('.sticker-menu') ||
    event.target.closest('.snipe-slip')
  ) {
    return;
  }
  textEl.focus();
});

resizeHandle.addEventListener('pointerdown', (event) => {
  if (state.folded) return;
  event.preventDefault();
  event.stopPropagation();
  resizeHandle.setPointerCapture(event.pointerId);
  const startW = window.outerWidth;
  const startH = window.outerHeight;
  const startX = event.screenX;
  const startY = event.screenY;

  const onMove = (ev) => {
    const width = Math.max(220, startW + (ev.screenX - startX));
    const height = Math.max(180, startH + (ev.screenY - startY));
    window.petal.resize(width, height);
  };

  const onUp = (ev) => {
    resizeHandle.releasePointerCapture(ev.pointerId);
    resizeHandle.removeEventListener('pointermove', onMove);
    resizeHandle.removeEventListener('pointerup', onUp);
    resizeHandle.removeEventListener('pointercancel', onUp);
  };

  resizeHandle.addEventListener('pointermove', onMove);
  resizeHandle.addEventListener('pointerup', onUp);
  resizeHandle.addEventListener('pointercancel', onUp);
});

window.petal.onRequestClose(requestClose);
window.petal.onInit(init);
window.petal.onMeta((meta) => {
  if (!meta) return;
  if (typeof meta.folded === 'boolean') {
    applyFolded(meta.folded);
    if (meta.folded) {
      cancelRegion();
      hideStickerMenu();
      hideSnipeSlip();
      hidePaperMenu();
      closeFind(false);
      deselectSticker();
    }
  }
});
window.petal.onSettings((next) => {
  if (!next) return;
  state.settings = { ...state.settings, ...next };
});

const stickersEl = document.getElementById('stickers');
const stickerMenu = document.getElementById('sticker-menu');
const snipeSlip = document.getElementById('snipe-slip');
const snipeKicker = document.getElementById('snipe-kicker');
const snipeBody = document.getElementById('snipe-body');
const snipeCopy = document.getElementById('snipe-copy');
const snipeDrop = document.getElementById('snipe-drop');
const snipeClose = document.getElementById('snipe-close');
const attachBtn = document.getElementById('attach');

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp)$/i;

let selectedId = null;
let menuImageId = null;
let regionMode = null;
let lastSnipeText = '';
let snipeImageId = null;
let transformTimer = null;

function hasStickers() {
  return Array.isArray(state.images) && state.images.length > 0;
}

function findImage(id) {
  return (state.images || []).find((img) => img.id === id) || null;
}

function stickerNode(id) {
  if (!stickersEl) return null;
  return [...stickersEl.querySelectorAll('.sticker')].find((el) => el.dataset.id === id) || null;
}

function bodySize() {
  if (!stickersEl) return { w: 240, h: 180 };
  const r = stickersEl.getBoundingClientRect();
  return { w: Math.max(48, r.width), h: Math.max(48, r.height) };
}

function clampSticker(img) {
  const { w, h } = bodySize();
  const vis = 24;
  img.width = Math.max(48, Math.min(img.width, Math.max(48, w)));
  img.height = Math.max(48, img.height);
  img.x = Math.min(w - vis, Math.max(vis - img.width, img.x));
  img.y = Math.min(h - vis, Math.max(vis - img.height, img.y));
}

function layoutSticker(el, img) {
  el.style.left = Math.round(img.x) + 'px';
  el.style.top = Math.round(img.y) + 'px';
  el.style.width = Math.round(img.width) + 'px';
  el.style.height = Math.round(img.height) + 'px';
  el.style.zIndex = String(img.z || 1);
  el.style.transform = 'rotate(' + (img.rotation || 0) + 'deg)';
}

function persistTransform(img, immediate) {
  const payload = {
    id: img.id,
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height,
    z: img.z,
    rotation: img.rotation || 0,
  };
  const send = () => window.petal.transformImage(payload);
  clearTimeout(transformTimer);
  if (immediate) {
    send();
    return;
  }
  transformTimer = setTimeout(send, 90);
}

function paintSelection() {
  if (!stickersEl) return;
  stickersEl.querySelectorAll('.sticker').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.id === selectedId);
  });
}

async function removeSticker(id) {
  const imageId = id || selectedId;
  if (!imageId) return false;
  hideStickerMenu();
  hideSnipeSlip();
  cancelRegion();
  let ok = true;
  try {
    if (window.petal.removeImage) ok = await window.petal.removeImage(imageId);
  } catch (_) {
    ok = false;
  }
  if (ok === false) return false;
  state.images = (state.images || []).filter((item) => item.id !== imageId);
  const el = stickerNode(imageId);
  if (el) el.remove();
  if (selectedId === imageId) selectedId = null;
  if (snipeImageId === imageId) hideSnipeSlip();
  return true;
}

function deselectSticker() {
  selectedId = null;
  paintSelection();
}

function bumpZ(img) {
  const maxZ = (state.images || []).reduce((m, item) => Math.max(m, Number(item.z) || 0), 0);
  if ((img.z || 0) < maxZ) {
    img.z = maxZ + 1;
    const el = stickerNode(img.id);
    if (el) el.style.zIndex = String(img.z);
    persistTransform(img, true);
  }
}

function selectSticker(id) {
  const img = findImage(id);
  if (!img) return;
  selectedId = id;
  bumpZ(img);
  paintSelection();
}

function hideStickerMenu() {
  if (!stickerMenu) return;
  stickerMenu.hidden = true;
  menuImageId = null;
}

function hideSnipeSlip() {
  if (!snipeSlip) return;
  snipeSlip.hidden = true;
  lastSnipeText = '';
  snipeImageId = null;
}

function cancelRegion() {
  if (!regionMode) return;
  const el = stickerNode(regionMode.id);
  if (el) {
    el.classList.remove('is-region');
    const box = el.querySelector('.snipe-box');
    if (box) {
      box.style.width = '0';
      box.style.height = '0';
    }
  }
  regionMode = null;
}

function localPoint(el, img, clientX, clientY) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const rad = -((img.rotation || 0) * Math.PI) / 180;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return {
    x: lx + img.width / 2,
    y: ly + img.height / 2,
  };
}

function resizeKeepAspect(img, nextWidth) {
  const { w } = bodySize();
  const aspect = (img.height || 1) / Math.max(img.width || 1, 1);
  const maxW = Math.max(48, w - 8);
  let width = Math.min(maxW, Math.max(48, nextWidth));
  let height = width * aspect;
  if (height < 48) {
    height = 48;
    width = height / aspect;
    if (width > maxW) {
      width = maxW;
      height = width * aspect;
    }
  }
  img.width = Math.round(width);
  img.height = Math.round(height);
}

function bindSticker(el, img) {
  const handle = el.querySelector('.sticker-resize');
  const delBtn = el.querySelector('.sticker-delete');
  if (delBtn) {
    delBtn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    delBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeSticker(img.id);
    });
  }

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.sticker-resize')) return;
    event.stopPropagation();
    hideStickerMenu();
    hidePaperMenu();
    hideSnipeSlip();
    if (regionMode && regionMode.id !== img.id) cancelRegion();
    selectSticker(img.id);

    if (regionMode && regionMode.id === img.id) {
      event.preventDefault();
      const start = localPoint(el, img, event.clientX, event.clientY);
      regionMode.start = start;
      regionMode.box = el.querySelector('.snipe-box');
      try {
        el.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
      return;
    }

    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY, imgX: img.x, imgY: img.y };
    let moved = false;
    try {
      el.setPointerCapture(event.pointerId);
    } catch (_) {
      /* ignore */
    }

    const onMove = (ev) => {
      const dx = ev.clientX - origin.x;
      const dy = ev.clientY - origin.y;
      if (!moved) {
        if (Math.hypot(dx, dy) < 4) return;
        moved = true;
        el.classList.add('is-dragging');
      }
      img.x = origin.imgX + dx;
      img.y = origin.imgY + dy;
      clampSticker(img);
      layoutSticker(el, img);
    };
    const onUp = (ev) => {
      el.classList.remove('is-dragging');
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch (_) {
        /* ignore */
      }
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      if (moved) persistTransform(img, true);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });

  el.addEventListener('pointermove', (event) => {
    if (!regionMode || regionMode.id !== img.id || !regionMode.start || !regionMode.box) return;
    const now = localPoint(el, img, event.clientX, event.clientY);
    const x = Math.max(0, Math.min(img.width, Math.min(regionMode.start.x, now.x)));
    const y = Math.max(0, Math.min(img.height, Math.min(regionMode.start.y, now.y)));
    const w = Math.abs(now.x - regionMode.start.x);
    const h = Math.abs(now.y - regionMode.start.y);
    regionMode.box.style.left = x + 'px';
    regionMode.box.style.top = y + 'px';
    regionMode.box.style.width = w + 'px';
    regionMode.box.style.height = h + 'px';
    regionMode.rect = { x, y, w, h };
  });

  el.addEventListener('pointerup', (event) => {
    if (!regionMode || regionMode.id !== img.id || !regionMode.start) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = regionMode.rect;
    const targetId = img.id;
    cancelRegion();
    if (!rect || rect.w < 8 || rect.h < 8) return;
    const pic = el.querySelector('img');
    const natW = (pic && pic.naturalWidth) || img.width;
    const natH = (pic && pic.naturalHeight) || img.height;
    const crop = {
      x: (rect.x / img.width) * natW,
      y: (rect.y / img.height) * natH,
      w: (rect.w / img.width) * natW,
      h: (rect.h / img.height) * natH,
    };
    snipeImage(targetId, crop);
  });

  el.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (regionMode) cancelRegion();
    hidePaperMenu();
    selectSticker(img.id);
    openStickerMenu(event.clientX, event.clientY, img.id);
  });

  if (handle) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      selectSticker(img.id);
      const startW = img.width;
      const startX = event.clientX;
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_) {
        /* ignore */
      }
      const onMove = (ev) => {
        resizeKeepAspect(img, startW + (ev.clientX - startX));
        clampSticker(img);
        layoutSticker(el, img);
      };
      const onUp = (ev) => {
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch (_) {
          /* ignore */
        }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        persistTransform(img, true);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }
}

function renderSticker(img) {
  if (!stickersEl || !img || !img.id) return;
  const existing = stickerNode(img.id);
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'sticker';
  el.dataset.id = img.id;
  el.innerHTML =
    '<div class="sticker-frame">' +
    '<img alt="" draggable="false" />' +
    '<span class="sticker-grain"></span>' +
    '<span class="sticker-reticle"></span>' +
    '</div>' +
    '<span class="snipe-badge" hidden></span>' +
    '<div class="snipe-region"><div class="snipe-box"></div></div>' +
    '<button type="button" class="sticker-delete" title="Delete image" aria-label="Delete image">' +
    '<svg viewBox="0 0 16 16" width="9" height="9" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>' +
    '</button>' +
    '<span class="sticker-resize"></span>';
  const pic = el.querySelector('img');
  pic.src = img.dataUrl || '';
  clampSticker(img);
  layoutSticker(el, img);
  bindSticker(el, img);
  stickersEl.appendChild(el);
  if (img.id === selectedId) el.classList.add('is-selected');
}

function paintStickers() {
  if (!stickersEl) return;
  stickersEl.innerHTML = '';
  (state.images || []).forEach(renderSticker);
  paintSelection();
}

function addSticker(rec) {
  if (!rec || !rec.id) return;
  state.images = (state.images || []).filter((img) => img.id !== rec.id);
  state.images.push(rec);
  renderSticker(rec);
  selectSticker(rec.id);
}

function openStickerMenu(clientX, clientY, id) {
  if (!stickerMenu || !noteEl) return;
  menuImageId = id;
  stickerMenu.hidden = false;
  const noteR = noteEl.getBoundingClientRect();
  let left = clientX - noteR.left;
  let top = clientY - noteR.top;
  stickerMenu.style.left = left + 'px';
  stickerMenu.style.top = top + 'px';
  requestAnimationFrame(() => {
    const mr = stickerMenu.getBoundingClientRect();
    if (mr.right > noteR.right - 8) left -= mr.width;
    if (mr.bottom > noteR.bottom - 8) top -= mr.height;
    stickerMenu.style.left = Math.max(8, left) + 'px';
    stickerMenu.style.top = Math.max(8, top) + 'px';
  });
}

function placeSlipNear(id) {
  if (!snipeSlip || !noteEl) return;
  const noteR = noteEl.getBoundingClientRect();
  const el = stickerNode(id);
  let left = 16;
  let top = 72;
  if (el) {
    const r = el.getBoundingClientRect();
    left = r.right - noteR.left + 10;
    top = r.top - noteR.top + 8;
  }
  snipeSlip.style.left = left + 'px';
  snipeSlip.style.top = top + 'px';
  requestAnimationFrame(() => {
    const sr = snipeSlip.getBoundingClientRect();
    if (sr.right > noteR.right - 10) {
      left = Math.max(10, (el ? el.getBoundingClientRect().left - noteR.left : left) - sr.width - 10);
    }
    if (sr.bottom > noteR.bottom - 10) {
      top = Math.max(10, noteR.height - sr.height - 16);
    }
    snipeSlip.style.left = Math.max(10, left) + 'px';
    snipeSlip.style.top = Math.max(10, top) + 'px';
  });
}

function showSnipeSlip(imageId, result) {
  lastSnipeText = (result && result.text) || '';
  snipeImageId = imageId;
  const empty = !lastSnipeText.trim();
  snipeKicker.textContent = 'Snipe';
  if (empty) {
    snipeBody.textContent = result && result.error
      ? 'Couldn’t snipe. The first run may need the network to fetch the lens.'
      : 'Nothing readable. Try sniping a region.';
  } else {
    snipeBody.textContent = lastSnipeText;
  }
  snipeBody.classList.toggle('is-empty', empty);
  snipeCopy.hidden = empty;
  snipeDrop.hidden = empty;
  snipeSlip.hidden = false;
  placeSlipNear(imageId);
}

async function snipeImage(id, crop) {
  const img = findImage(id);
  if (!img) return;
  hideStickerMenu();
  hideSnipeSlip();
  cancelRegion();
  noteEl.classList.add('is-sniping');
  const el = stickerNode(id);
  if (el) {
    el.classList.add('is-sniping');
    const badge = el.querySelector('.snipe-badge');
    if (badge) {
      badge.hidden = false;
      badge.textContent = state.tessReady ? 'Sniping…' : 'First snipe sets up the lens…';
    }
  }
  try {
    if (!state.tessReady) {
      try {
        state.tessReady = !!(await window.petal.tessReady());
        if (el) {
          const badge = el.querySelector('.snipe-badge');
          if (badge && !state.tessReady) badge.textContent = 'First snipe sets up the lens…';
        }
      } catch (_) {
        /* ignore */
      }
    }
    const result = await window.petal.snipe({ id, crop: crop || null });
    state.tessReady = true;
    showSnipeSlip(id, result || { text: '' });
  } catch (_) {
    showSnipeSlip(id, { text: '', error: 'snipe' });
  } finally {
    noteEl.classList.remove('is-sniping');
    if (el) {
      el.classList.remove('is-sniping');
      const badge = el.querySelector('.snipe-badge');
      if (badge) badge.hidden = true;
    }
  }
}

function startRegion(id) {
  hideStickerMenu();
  hideSnipeSlip();
  cancelRegion();
  const el = stickerNode(id);
  if (!el) return;
  selectSticker(id);
  regionMode = { id, start: null, box: el.querySelector('.snipe-box'), rect: null };
  el.classList.add('is-region');
}

function insertSnipeText(value) {
  const snippet = String(value || '').trim();
  if (!snippet) return;
  restoreSelection();
  textEl.focus();
  beginEdit();
  const occupied = textEl.textContent.replace(/\u200b/g, '').trim() !== '';
  const insert = (occupied ? '\n' : '') + snippet;
  try {
    document.execCommand('insertText', false, insert);
  } catch (_) {
    textEl.appendChild(document.createTextNode(insert));
  }
  scheduleSave();
  hideSnipeSlip();
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type && /^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) return true;
  return IMAGE_NAME_RE.test(file.name || '');
}

function extFromName(name) {
  const m = String(name || '').toLowerCase().match(IMAGE_NAME_RE);
  if (!m) return '.png';
  return m[0] === '.jpeg' ? '.jpg' : m[0];
}

async function addImageFromFile(file) {
  if (!file || !window.petal.addImage) return;
  let rec = null;
  if (file.path) {
    rec = await window.petal.addImage({ filePath: file.path });
  }
  if (!rec) {
    const buffer = await file.arrayBuffer();
    rec = await window.petal.addImage({
      buffer,
      mime: file.type,
      ext: extFromName(file.name),
    });
  }
  if (rec) addSticker(rec);
}

if (stickerMenu) {
  stickerMenu.addEventListener('pointerdown', (event) => event.stopPropagation());
  stickerMenu.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const id = menuImageId;
    const act = btn.dataset.act;
    hideStickerMenu();
    if (!id) return;
    const img = findImage(id);
    if (!img) return;
    if (act === 'snipe') {
      snipeImage(id, null);
    } else if (act === 'region') {
      startRegion(id);
    } else if (act === 'copy') {
      await window.petal.writeClipboardImage(id);
    } else if (act === 'forward') {
      bumpZ(img);
    } else if (act === 'back') {
      const minZ = (state.images || []).reduce((m, item) => Math.min(m, Number(item.z) || 0), img.z || 0);
      img.z = minZ - 1;
      const el = stickerNode(id);
      if (el) el.style.zIndex = String(img.z);
      persistTransform(img, true);
    } else if (act === 'remove') {
      await removeSticker(id);
    }
  });
}

if (snipeSlip) {
  snipeSlip.addEventListener('pointerdown', (event) => event.stopPropagation());
}

if (snipeCopy) {
  snipeCopy.addEventListener('click', async () => {
    await window.petal.writeClipboardText(lastSnipeText);
    const prev = snipeCopy.textContent;
    snipeCopy.textContent = 'Copied';
    setTimeout(() => {
      snipeCopy.textContent = prev;
    }, 900);
  });
}

if (snipeDrop) {
  snipeDrop.addEventListener('click', () => insertSnipeText(lastSnipeText));
}

if (snipeClose) {
  snipeClose.addEventListener('click', hideSnipeSlip);
}

if (attachBtn) {
  attachBtn.addEventListener('click', async () => {
    const rec = await window.petal.pickImage();
    if (rec) addSticker(rec);
  });
}

document.addEventListener(
  'paste',
  async (event) => {
    if (state.folded) return;
    const t = event.target;
    if (t && t.closest && t.closest('.snipe-slip, .sticker-menu, .paper-menu, .find-strip')) return;
    const dt = event.clipboardData;
    if (dt) {
      const items = dt.items ? [...dt.items] : [];
      const imageItem = items.find((it) => it.type && it.type.startsWith('image/'));
      if (imageItem) {
        event.preventDefault();
        event.stopPropagation();
        const file = imageItem.getAsFile();
        if (file) await addImageFromFile(file);
        return;
      }
      const text = (dt.getData('text/plain') || dt.getData('text/html') || '').trim();
      if (text) return;
    }
    try {
      const clip = await window.petal.readClipboardImage();
      if (clip && clip.hasImage) {
        event.preventDefault();
        event.stopPropagation();
        const rec = await window.petal.addImage({ fromClipboard: true });
        if (rec) addSticker(rec);
      }
    } catch (_) {
      /* ignore */
    }
  },
  true
);

function dragHasFiles(dt) {
  if (!dt || !dt.types) return false;
  return [...dt.types].includes('Files');
}

noteEl.addEventListener('dragover', (event) => {
  if (!dragHasFiles(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});

noteEl.addEventListener('drop', async (event) => {
  const files = event.dataTransfer && event.dataTransfer.files ? [...event.dataTransfer.files] : [];
  const images = files.filter(isImageFile);
  if (!images.length) return;
  event.preventDefault();
  event.stopPropagation();
  for (const file of images) {
    await addImageFromFile(file);
  }
});

function paperMenuOpen() {
  return !!(paperMenu && !paperMenu.hidden);
}

function findIsOpen() {
  return !!findOpen;
}

function cancelPendingPaperMenu() {
  if (menuOpenTimer) {
    clearTimeout(menuOpenTimer);
    menuOpenTimer = null;
  }
}

function hidePaperMenu() {
  cancelPendingPaperMenu();
  if (paperMenu) paperMenu.hidden = true;
  hideFlyout();
}

function hideFlyout() {
  currentFlyout = null;
  if (paperFlyout) {
    paperFlyout.hidden = true;
    paperFlyout.innerHTML = '';
  }
}

function unwrapFindHits(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-find-hit]').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  if (root.normalize) root.normalize();
}

function menuButton(label, act, opts) {
  const o = opts || {};
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('role', 'menuitem');
  if (act) btn.dataset.act = act;
  if (o.value != null) btn.dataset.value = o.value;
  if (o.flyout) {
    btn.dataset.flyout = o.flyout;
    btn.classList.add('has-flyout');
  }
  if (o.on) btn.classList.add('is-on');
  if (o.danger) btn.classList.add('is-danger');
  if (o.disabled) btn.disabled = true;
  const lab = document.createElement('span');
  lab.className = 'menu-label';
  if (o.chip) lab.appendChild(o.chip);
  lab.appendChild(document.createTextNode(label));
  btn.appendChild(lab);
  if (o.kbd) {
    const kbd = document.createElement('span');
    kbd.className = 'menu-kbd';
    kbd.textContent = o.kbd;
    btn.appendChild(kbd);
  }
  return btn;
}

function menuSep() {
  const el = document.createElement('div');
  el.className = 'menu-sep';
  return el;
}

function hlChip(color) {
  const span = document.createElement('span');
  span.className = color ? 'hl-chip' : 'hl-chip hl-clear-chip';
  if (color) span.style.setProperty('--h', color);
  return span;
}

function inkChipEl(hex) {
  const span = document.createElement('span');
  span.className = 'ink-chip';
  span.style.setProperty('--c', hex);
  return span;
}

function queryMark(cmd) {
  try {
    return document.queryCommandState(cmd);
  } catch (_) {
    return false;
  }
}

function placePaperMenu(el, clientX, clientY) {
  if (!el || !noteEl) return;
  const noteR = noteEl.getBoundingClientRect();
  let left = clientX - noteR.left;
  let top = clientY - noteR.top;
  el.hidden = false;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  requestAnimationFrame(() => {
    const mr = el.getBoundingClientRect();
    if (mr.right > noteR.right - 8) left -= mr.width;
    if (mr.bottom > noteR.bottom - 8) top -= mr.height;
    left = Math.min(Math.max(8, left), Math.max(8, noteR.width - mr.width - 8));
    top = Math.min(Math.max(8, top), Math.max(8, noteR.height - mr.height - 8));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  });
}

function placeFlyout(anchor) {
  if (!paperFlyout || !noteEl || !anchor) return;
  const noteR = noteEl.getBoundingClientRect();
  const br = anchor.getBoundingClientRect();
  paperFlyout.hidden = false;
  let left = br.right - noteR.left - 2;
  let top = br.top - noteR.top;
  paperFlyout.style.left = left + 'px';
  paperFlyout.style.top = top + 'px';
  requestAnimationFrame(() => {
    const fr = paperFlyout.getBoundingClientRect();
    if (fr.right > noteR.right - 8) left = br.left - noteR.left - fr.width + 2;
    if (fr.bottom > noteR.bottom - 8) top = Math.max(8, noteR.height - fr.height - 8);
    left = Math.min(Math.max(8, left), Math.max(8, noteR.width - fr.width - 8));
    top = Math.min(Math.max(8, top), Math.max(8, noteR.height - fr.height - 8));
    paperFlyout.style.left = left + 'px';
    paperFlyout.style.top = top + 'px';
  });
}

function fillHighlightFlyout() {
  paperFlyout.innerHTML = '';
  const cs = selectionComputed();
  const bg = hexOfRgb(cs.backgroundColor);
  const yellow = HIGHLIGHTS.yellow.toUpperCase();
  const peach = HIGHLIGHTS.peach.toUpperCase();
  const mint = HIGHLIGHTS.mint.toUpperCase();
  paperFlyout.appendChild(menuButton('Yellow', 'hl-yellow', { on: bg === yellow, chip: hlChip(HIGHLIGHTS.yellow), kbd: 'Ctrl+H' }));
  paperFlyout.appendChild(menuButton('Peach', 'hl-peach', { on: bg === peach, chip: hlChip(HIGHLIGHTS.peach), kbd: 'Ctrl+Shift+H' }));
  paperFlyout.appendChild(menuButton('Mint', 'hl-mint', { on: bg === mint, chip: hlChip(HIGHLIGHTS.mint) }));
  paperFlyout.appendChild(menuButton('Remove highlight', 'hl-clear', { chip: hlChip(''), kbd: 'Ctrl+U' }));
}

function fillColorFlyout() {
  paperFlyout.innerHTML = '';
  const cs = selectionComputed();
  const current = (hexOfRgb(cs.color) || (state.format.ink || '')).toUpperCase();
  INK_COLORS.forEach((ink) => {
    paperFlyout.appendChild(menuButton(ink.name, 'ink', {
      value: ink.hex,
      on: ink.hex.toUpperCase() === current,
      chip: inkChipEl(ink.hex),
    }));
  });
}

function fillSizeFlyout() {
  paperFlyout.innerHTML = '';
  const cs = selectionComputed();
  const px = nearestSize(Math.round(parseFloat(cs.fontSize) || state.format.size || 16));
  SIZES.forEach((n) => {
    paperFlyout.appendChild(menuButton(String(n), 'size', { value: String(n), on: n === px }));
  });
}

function showFlyout(kind, anchor) {
  if (!paperFlyout) return;
  if (currentFlyout === kind && !paperFlyout.hidden) {
    placeFlyout(anchor);
    return;
  }
  currentFlyout = kind;
  if (kind === 'highlight') fillHighlightFlyout();
  else if (kind === 'color') fillColorFlyout();
  else if (kind === 'size') fillSizeFlyout();
  else {
    hideFlyout();
    return;
  }
  placeFlyout(anchor);
}

function stripSpellBlock() {
  if (!paperMenu) return;
  [...paperMenu.children].forEach((el) => {
    if (el.dataset && el.dataset.spell === '1') el.remove();
  });
}

function applySpellBlock() {
  if (!paperMenu) return;
  try {
  stripSpellBlock();
  const electronWord = (lastSpell && lastSpell.misspelledWord) || '';
  const selected = selectedSingleWord();
  const word = electronWord || selected;
  if (!word) return;
  const fromElectron = ((lastSpell && lastSpell.dictionarySuggestions) || []).slice();
  const suggestions = uniqueWords(fromElectron.concat(variantSuggestions(word))).filter(
    (s) => s.toLowerCase() !== word.toLowerCase()
  ).slice(0, 8);
  const frag = document.createDocumentFragment();
  suggestions.forEach((s) => {
    const btn = menuButton(s, 'spell', { value: s });
    btn.dataset.spell = '1';
    frag.appendChild(btn);
  });
  const add = menuButton('Add to dictionary', 'add-dict', { value: word });
  add.dataset.spell = '1';
  frag.appendChild(add);
  const sep = menuSep();
  sep.dataset.spell = '1';
  frag.appendChild(sep);
  paperMenu.insertBefore(frag, paperMenu.firstChild);
  if (!paperMenu.hidden && lastMenuPoint) {
    placePaperMenu(paperMenu, lastMenuPoint.x, lastMenuPoint.y);
  }
  } catch (_) {
    /* never block the rest of the menu */
  }
}

function prependSpellSuggestions() {
  applySpellBlock();
}

function buildPaperMenu() {
  paperMenu.innerHTML = '';
  hideFlyout();
  restoreSelection();
  flushHistoryInput();
  const sel = selectionInsideEditor();
  const hasText = !!(sel && !sel.isCollapsed);
  applySpellBlock();
  if (hasText) {
    paperMenu.appendChild(menuButton('Cut', 'cut', { kbd: 'Ctrl+X' }));
    paperMenu.appendChild(menuButton('Copy', 'copy', { kbd: 'Ctrl+C' }));
  }
  paperMenu.appendChild(menuButton('Paste', 'paste', { kbd: 'Ctrl+V' }));
  paperMenu.appendChild(menuButton('Paste without formatting', 'paste-plain', { kbd: 'Ctrl+Shift+V' }));
  paperMenu.appendChild(menuButton('Select all', 'select-all'));
  paperMenu.appendChild(menuSep());
  paperMenu.appendChild(menuButton('Undo', 'undo', { kbd: 'Ctrl+Z', disabled: !canUndo() }));
  paperMenu.appendChild(menuButton('Redo', 'redo', { kbd: 'Ctrl+Y', disabled: !canRedo() }));
  if (hasText) {
    paperMenu.appendChild(menuSep());
    paperMenu.appendChild(menuButton('Bold', 'bold', { on: queryMark('bold') }));
    paperMenu.appendChild(menuButton('Italic', 'italic', { on: queryMark('italic') }));
    paperMenu.appendChild(menuButton('Underline', 'underline', { on: queryMark('underline'), kbd: 'Ctrl+Shift+U' }));
    paperMenu.appendChild(menuButton('Strikethrough', 'strike', { on: queryMark('strikeThrough') }));
    paperMenu.appendChild(menuButton('Highlight', '', { flyout: 'highlight' }));
    paperMenu.appendChild(menuButton('Color', '', { flyout: 'color' }));
    paperMenu.appendChild(menuButton('Size', '', { flyout: 'size' }));
    paperMenu.appendChild(menuButton('Clear formatting', 'clear'));
  } else {
    paperMenu.appendChild(menuSep());
    paperMenu.appendChild(menuButton('Paste image', 'paste-image'));
  }
  refreshPasteEnabled();
}

function refreshPasteEnabled() {
  const textFns = [];
  if (window.petal.readClipboardText) {
    textFns.push(window.petal.readClipboardText().then((t) => !!String(t || '').length).catch(() => true));
  } else {
    textFns.push(Promise.resolve(true));
  }
  if (window.petal.readClipboardImage) {
    textFns.push(window.petal.readClipboardImage().then((r) => !!(r && r.hasImage)).catch(() => false));
  } else {
    textFns.push(Promise.resolve(false));
  }
  Promise.all(textFns).then(([hasText, hasImage]) => {
    if (!paperMenuOpen()) return;
    paperMenu.querySelectorAll('[data-act="paste"], [data-act="paste-plain"]').forEach((btn) => {
      btn.disabled = !hasText;
    });
    const imgBtn = paperMenu.querySelector('[data-act="paste-image"]');
    if (imgBtn) imgBtn.disabled = !hasImage;
  });
}

function openPaperMenu(clientX, clientY) {
  if (!paperMenu || state.folded) return;
  hideStickerMenu();
  hideSnipeSlip();
  setInkMenuOpen(false);
  cancelPendingPaperMenu();
  hideFlyout();
  lastMenuPoint = { x: clientX, y: clientY };
  try {
    rememberSelection();
    restoreSelection();
  } catch (_) {}
  menuOpenedAt = Date.now();
  try {
    buildPaperMenu();
  } catch (_) {
    paperMenu.innerHTML = '';
    paperMenu.appendChild(menuButton('Cut', 'cut', { kbd: 'Ctrl+X' }));
    paperMenu.appendChild(menuButton('Copy', 'copy', { kbd: 'Ctrl+C' }));
    paperMenu.appendChild(menuButton('Paste', 'paste', { kbd: 'Ctrl+V' }));
    paperMenu.appendChild(menuButton('Select all', 'select-all'));
  }
  placePaperMenu(paperMenu, lastMenuPoint.x, lastMenuPoint.y);
}

function execEdit(command) {
  restoreSelection();
  textEl.focus();
  if (command === 'cut' || command === 'paste') beginEdit();
  try {
    document.execCommand(command, false, null);
  } catch (_) {
    /* ignore */
  }
  syncMarks();
  scheduleSave();
}

function selectAllText() {
  textEl.focus();
  const range = document.createRange();
  range.selectNodeContents(textEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  rememberSelection();
  syncMarks();
}

async function pastePlain() {
  restoreSelection();
  textEl.focus();
  let value = '';
  try {
    value = window.petal.readClipboardText ? await window.petal.readClipboardText() : '';
  } catch (_) {
    value = '';
  }
  if (!value) return;
  restoreSelection();
  textEl.focus();
  beginEdit();
  try {
    document.execCommand('insertText', false, value);
  } catch (_) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(value));
    }
  }
  scheduleSave();
}

async function pasteImage() {
  try {
    const clip = await window.petal.readClipboardImage();
    if (clip && clip.hasImage) {
      const rec = await window.petal.addImage({ fromClipboard: true });
      if (rec) addSticker(rec);
    }
  } catch (_) {
    /* ignore */
  }
}

function clearFormatting() {
  restoreSelection();
  textEl.focus();
  beginEdit();
  withStyleCss();
  try {
    document.execCommand('removeFormat', false, null);
  } catch (_) {
    /* ignore */
  }
  applyInlineStyle('backgroundColor', 'transparent', false);
}

async function runPaperAct(act, value) {
  if (!act) return;
  hidePaperMenu();
  restoreSelection();
  if (act === 'cut') execEdit('cut');
  else if (act === 'copy') execEdit('copy');
  else if (act === 'paste') execEdit('paste');
  else if (act === 'paste-plain') await pastePlain();
  else if (act === 'select-all') selectAllText();
  else if (act === 'undo') undo();
  else if (act === 'redo') redo();
  else if (act === 'bold') execMark('bold');
  else if (act === 'italic') execMark('italic');
  else if (act === 'underline') execMark('underline');
  else if (act === 'strike') execMark('strikeThrough');
  else if (act === 'hl-yellow') applyInlineStyle('backgroundColor', HIGHLIGHTS.yellow);
  else if (act === 'hl-peach') applyInlineStyle('backgroundColor', HIGHLIGHTS.peach);
  else if (act === 'hl-mint') applyInlineStyle('backgroundColor', HIGHLIGHTS.mint);
  else if (act === 'hl-clear') applyInlineStyle('backgroundColor', 'transparent');
  else if (act === 'ink') applyInlineStyle('color', value);
  else if (act === 'size') applyInlineStyle('fontSize', value + 'px');
  else if (act === 'clear') clearFormatting();
  else if (act === 'bullets') toggleBullets();
  else if (act === 'checks') toggleChecklist();
  else if (act === 'paste-image') await pasteImage();
  else if (act === 'spell') {
    applySpellSuggestion(value);
  } else if (act === 'add-dict') {
    const word = value || (lastSpell && lastSpell.misspelledWord) || '';
    if (word && window.petal.addToDictionary) window.petal.addToDictionary(word);
    lastSpell = { misspelledWord: '', dictionarySuggestions: [], at: 0 };
  }
}

function applySpellSuggestion(value) {
  if (!value) return;
  restoreSelection();
  textEl.focus();
  ensureWordSelected(lastSpell && lastSpell.misspelledWord);
  rememberSelection();
  beginEdit();
  const before = editorHtml();
  if (window.petal.replaceMisspelling) {
    window.petal.replaceMisspelling(value);
  }
  const sel = window.getSelection();
  const selected = sel && sel.rangeCount ? sel.toString() : '';
  const miss = (lastSpell && lastSpell.misspelledWord) || '';
  if (selected && selected !== value) {
    try {
      document.execCommand('insertText', false, value);
    } catch (_) {
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(value));
      }
    }
  } else if (!selected && editorHtml() === before) {
    if (miss) ensureWordSelected(miss);
    try {
      document.execCommand('insertText', false, value);
    } catch (_) {
      /* ignore */
    }
  }
  lastSpell = { misspelledWord: '', dictionarySuggestions: [], at: 0 };
  scheduleSave();
  syncMarks();
}

function onMenuPointer(event) {
  const btn = event.target.closest && event.target.closest('button[data-flyout]');
  if (btn && paperMenu.contains(btn)) {
    clearTimeout(flyoutTimer);
    showFlyout(btn.dataset.flyout, btn);
    return;
  }
  if (event.target.closest && event.target.closest('button') && paperMenu.contains(event.target)) {
    clearTimeout(flyoutTimer);
    flyoutTimer = setTimeout(hideFlyout, 160);
  }
}

if (paperMenu) {
  paperMenu.addEventListener('mousedown', (event) => {
    event.preventDefault();
    rememberSelection();
  });
  paperMenu.addEventListener('pointerdown', (event) => event.stopPropagation());
  paperMenu.addEventListener('contextmenu', (event) => event.preventDefault());
  paperMenu.addEventListener('pointerenter', onMenuPointer);
  paperMenu.addEventListener('pointerover', onMenuPointer);
  paperMenu.addEventListener('click', (event) => {
    const fly = event.target.closest && event.target.closest('button[data-flyout]');
    if (fly) {
      event.preventDefault();
      showFlyout(fly.dataset.flyout, fly);
      return;
    }
    const btn = event.target.closest && event.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    runPaperAct(btn.dataset.act, btn.dataset.value);
  });
}

if (paperFlyout) {
  paperFlyout.addEventListener('mousedown', (event) => {
    event.preventDefault();
    rememberSelection();
  });
  paperFlyout.addEventListener('pointerdown', (event) => event.stopPropagation());
  paperFlyout.addEventListener('contextmenu', (event) => event.preventDefault());
  paperFlyout.addEventListener('pointerenter', () => clearTimeout(flyoutTimer));
  paperFlyout.addEventListener('click', (event) => {
    const btn = event.target.closest && event.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    runPaperAct(btn.dataset.act, btn.dataset.value);
  });
}

textEl.addEventListener('contextmenu', (event) => {
  if (event.target.closest && event.target.closest('.sticker, .sticker-menu, .snipe-slip')) return;
  event.preventDefault();
  event.stopPropagation();
  try {
    selectWordAtClick(event.clientX, event.clientY);
    rememberSelection();
  } catch (_) {
    /* still open the menu */
  }
  openPaperMenu(event.clientX, event.clientY);
});

if (window.petal.onSpellContext) {
  window.petal.onSpellContext((data) => {
    const word = (data && data.misspelledWord) || '';
    const selectionText = (data && data.selectionText) || '';
    const suggestions = Array.isArray(data && data.dictionarySuggestions)
      ? data.dictionarySuggestions.map(String).filter(Boolean).slice(0, 8)
      : [];
    lastSpell = {
      misspelledWord: word || lastSpell.misspelledWord || '',
      dictionarySuggestions: suggestions.length ? suggestions : (lastSpell.dictionarySuggestions || []),
      at: Date.now(),
    };
    if (word && window.getSelection && (!window.getSelection().toString() || window.getSelection().isCollapsed)) {
      ensureWordSelected(word);
      rememberSelection();
    } else if (!word && selectionText && /^[A-Za-z][A-Za-z'-]{0,47}$/.test(selectionText.trim())) {
      lastSpell.misspelledWord = lastSpell.misspelledWord || selectionText.trim();
    }
    if (paperMenuOpen()) applySpellBlock();
  });
}

textEl.addEventListener('cut', () => {
  if (findMutating || history.applying) return;
  beginEdit();
});
textEl.addEventListener('paste', () => {
  if (findMutating || history.applying) return;
  beginEdit();
});

function closeFind(restoreFocus) {
  findOpen = false;
  findMutating = true;
  unwrapFindHits(textEl);
  findMutating = false;
  if (findStrip) findStrip.hidden = true;
  if (findCount) findCount.textContent = '';
  findIndex = 0;
  if (restoreFocus) {
    textEl.focus();
    restoreSelection();
  }
}

function paintFindCount(total) {
  if (!findCount) return;
  if (!findInput || !findInput.value) {
    findCount.textContent = '';
  } else if (!total) {
    findCount.textContent = '0';
  } else {
    findCount.textContent = (findIndex + 1) + ' / ' + total;
  }
  const none = !total;
  if (findPrevBtn) findPrevBtn.disabled = none;
  if (findNextBtn) findNextBtn.disabled = none;
}

function setCurrentHit(i) {
  const hits = [...textEl.querySelectorAll('[data-find-hit]')];
  if (!hits.length) {
    findIndex = 0;
    paintFindCount(0);
    return;
  }
  findIndex = ((i % hits.length) + hits.length) % hits.length;
  hits.forEach((el, idx) => el.classList.toggle('is-current', idx === findIndex));
  hits[findIndex].scrollIntoView({ block: 'nearest' });
  paintFindCount(hits.length);
}

function runFind(raw) {
  const query = String(raw || '');
  findMutating = true;
  unwrapFindHits(textEl);
  if (!query) {
    findMutating = false;
    findIndex = 0;
    paintFindCount(0);
    return;
  }
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue) continue;
    const lower = node.nodeValue.toLowerCase();
    let from = 0;
    let at = lower.indexOf(needle, from);
    while (at !== -1) {
      hits.push({ node, start: at, end: at + query.length });
      from = at + Math.max(query.length, 1);
      at = lower.indexOf(needle, from);
    }
  }
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    try {
      const range = document.createRange();
      range.setStart(hit.node, hit.start);
      range.setEnd(hit.node, hit.end);
      const span = document.createElement('span');
      span.dataset.findHit = '1';
      span.className = 'find-hit';
      range.surroundContents(span);
    } catch (_) {
      /* skip awkward boundaries */
    }
  }
  findMutating = false;
  const live = textEl.querySelectorAll('[data-find-hit]');
  if (!live.length) {
    findIndex = 0;
    paintFindCount(0);
    return;
  }
  setCurrentHit(0);
}

function scheduleFindRefresh() {
  clearTimeout(findTimer);
  findTimer = setTimeout(() => {
    if (!findIsOpen() || !findInput) return;
    runFind(findInput.value);
  }, 120);
}

function openFind() {
  if (state.folded || !findStrip) return;
  hidePaperMenu();
  setInkMenuOpen(false);
  findOpen = true;
  findStrip.hidden = false;
  if (findInput) {
    findInput.focus();
    findInput.select();
    if (findInput.value) runFind(findInput.value);
    else paintFindCount(0);
  }
}

function findStep(dir) {
  if (!findIsOpen()) {
    openFind();
    return;
  }
  const hits = textEl.querySelectorAll('[data-find-hit]');
  if (!hits.length) {
    if (findInput && findInput.value) runFind(findInput.value);
    return;
  }
  setCurrentHit(findIndex + dir);
}

if (findInput) {
  findInput.addEventListener('input', () => runFind(findInput.value));
  findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      findStep(event.shiftKey ? -1 : 1);
    }
  });
}
if (findPrevBtn) findPrevBtn.addEventListener('click', () => findStep(-1));
if (findNextBtn) findNextBtn.addEventListener('click', () => findStep(1));
if (findCloseBtn) findCloseBtn.addEventListener('click', () => closeFind(true));
if (findStrip) {
  findStrip.addEventListener('pointerdown', () => {
    hidePaperMenu();
  });
}
