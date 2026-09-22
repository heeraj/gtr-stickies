const bodyEl = document.getElementById('body');
const emptyEl = document.getElementById('empty');
const addBtn = document.getElementById('add');
const shareBtn = document.getElementById('share');
const refreshBtn = document.getElementById('refresh');
const minimizeBtn = document.getElementById('minimize');
const closeBtn = document.getElementById('close');
const shareMenu = document.getElementById('share-menu');
const composer = document.getElementById('composer');
const composerTitle = document.getElementById('composer-title');
const typeEl = document.getElementById('c-type');
const titleEl = document.getElementById('c-title');
const dueEl = document.getElementById('c-due');
const courseEl = document.getElementById('c-course');
const notesEl = document.getElementById('c-notes');
const saveBtn = document.getElementById('c-save');
const cancelBtn = document.getElementById('c-cancel');
const deleteBtn = document.getElementById('c-delete');
const urlPrompt = document.getElementById('url-prompt');
const urlInput = document.getElementById('url-input');
const urlSave = document.getElementById('url-save');
const urlCancel = document.getElementById('url-cancel');
const urlClear = document.getElementById('url-clear');
const confirmEl = document.getElementById('confirm');
const confirmCopy = document.getElementById('confirm-copy');
const keepBtn = document.getElementById('keep');
const discardBtn = document.getElementById('discard');
const statusEl = document.getElementById('status');
const verEl = document.getElementById('app-ver');
const boardEl = document.getElementById('board');

const TYPE_LABEL = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  test: 'Test',
  reminder: 'Reminder',
  presentation: 'Presentation',
};

const GROUPS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'later', label: 'Later' },
  { id: 'done', label: 'Done' },
];

let board = { course: 'Business Law', liveUrl: '', items: [], appVersion: '3.0', theme: 'paper', compact: false, font: 'sans', size: 'm', clock24: false, schedule: [] };
let settings = { confirmDelete: true, boardCourse: 'Business Law' };
let editingId = null;
let pendingDeleteId = null;
let doneOpen = false;
let expandedId = null;
let statusTimer = null;
let clockTimer = null;

const THEMES = [
  { id: 'paper', label: 'Paper' },
  { id: 'aero', label: 'Aero' },
  { id: 'pearl', label: 'Pearl' },
  { id: 'glow', label: 'Glow' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'noir', label: 'Noir' },
  { id: 'ember', label: 'Ember' },
  { id: 'campus', label: 'Campus' },
];
const DARK_THEMES = { glow: 1, aurora: 1, midnight: 1, noir: 1, ember: 1, campus: 1 };

const FONTS = [
  { id: 'sans', label: 'Sans' },
  { id: 'display', label: 'Display' },
  { id: 'serif', label: 'Serif' },
  { id: 'ui', label: 'System' },
  { id: 'hand', label: 'Hand' },
];

const SIZES = [
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
];

const DEFAULT_SCHEDULE = [
  { days: [0, 2], start: '19:00', end: '20:30', title: 'Business Research Methods', lecturer: 'Rashid' },
  { days: [0, 2], start: '20:30', end: '22:00', title: 'Business Law', lecturer: 'Hawwa Shazna' },
  { days: [4, 6], start: '19:00', end: '20:30', title: 'Project Management', lecturer: 'Rashid' },
  { days: [4, 6], start: '20:30', end: '22:00', title: 'Business Economics', lecturer: 'Anoop' },
];

function minutesOf(hhmm) {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatClock(mins) {
  if (mins == null) return '';
  const h24 = Math.floor(mins / 60) % 24;
  const mm = String(mins % 60).padStart(2, '0');
  if (board.clock24) return String(h24).padStart(2, '0') + ':' + mm;
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h = h24 % 12 || 12;
  return h + ':' + mm + ' ' + ampm;
}

function slotLabel(slot) {
  const title = String((slot && slot.title) || '').trim();
  const who = String((slot && slot.lecturer) || '').trim();
  if (title && who) return title + ' · ' + who;
  return title || who || 'Class';
}

function todaySlots(now) {
  const list = Array.isArray(board.schedule) && board.schedule.length ? board.schedule : DEFAULT_SCHEDULE;
  const day = now.getDay();
  const out = [];
  list.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const days = Array.isArray(raw.days) ? raw.days : [raw.day];
    if (!days.some((d) => Number(d) === day)) return;
    const start = minutesOf(raw.start);
    const end = minutesOf(raw.end);
    if (start == null) return;
    out.push({
      start,
      end: end == null ? start + 80 : end,
      title: raw.title,
      lecturer: raw.lecturer,
    });
  });
  out.sort((a, b) => a.start - b.start);
  return out;
}

function renderTodayClass() {
  const el = document.getElementById('today-class');
  if (!el) return;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const slots = todaySlots(now);
  el.innerHTML = '';
  el.classList.remove('is-now', 'is-idle');
  if (!slots.length) {
    el.classList.add('is-idle');
    el.textContent = 'No class today';
    return;
  }
  const current = slots.find((s) => mins >= s.start && mins < s.end);
  const next = slots.find((s) => s.start > mins);
  if (current) {
    el.classList.add('is-now');
    const row = document.createElement('div');
    row.className = 'today-row';
    const kicker = document.createElement('span');
    kicker.className = 'today-kicker';
    kicker.textContent = 'Now';
    const title = document.createElement('span');
    title.className = 'today-title';
    title.textContent = slotLabel(current);
    const when = document.createElement('span');
    when.className = 'today-when';
    when.textContent = 'until ' + formatClock(current.end);
    row.appendChild(kicker);
    row.appendChild(title);
    row.appendChild(when);
    el.appendChild(row);
    if (next) {
      const sub = document.createElement('div');
      sub.className = 'today-next';
      sub.textContent = 'Next · ' + slotLabel(next) + ' at ' + formatClock(next.start);
      el.appendChild(sub);
    }
    return;
  }
  if (next) {
    const row = document.createElement('div');
    row.className = 'today-row';
    const kicker = document.createElement('span');
    kicker.className = 'today-kicker';
    kicker.textContent = 'Next';
    const title = document.createElement('span');
    title.className = 'today-title';
    title.textContent = slotLabel(next);
    const when = document.createElement('span');
    when.className = 'today-when';
    when.textContent = 'at ' + formatClock(next.start);
    row.appendChild(kicker);
    row.appendChild(title);
    row.appendChild(when);
    el.appendChild(row);
    const later = slots.filter((s) => s.start > next.start);
    if (later[0]) {
      const sub = document.createElement('div');
      sub.className = 'today-next';
      sub.textContent = 'Then · ' + slotLabel(later[0]) + ' at ' + formatClock(later[0].start);
      el.appendChild(sub);
    }
    return;
  }
  el.classList.add('is-idle');
  el.textContent = 'No more classes today';
}

function parseDue(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const hasTime = iso[4] != null;
    const d = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4] || 23),
      Number(iso[5] || (hasTime ? 0 : 59)),
      Number(iso[6] || 0)
    );
    d._dateOnly = !hasTime;
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDatetimeLocal(raw) {
  const d = parseDue(raw);
  if (!d) return '';
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

function fromDatetimeLocal(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return s;
  return m[1] + 'T' + m[2] + ':00';
}


function formatDueLong(raw) {
  const d = parseDue(raw);
  if (!d) return '';
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const date = weekdays[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  if (d._dateOnly) return date;
  const mins = d.getHours() * 60 + d.getMinutes();
  return date + ', ' + formatClock(mins);
}

function formatDue(raw) {
  const d = parseDue(raw);
  if (!d) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[d.getDay()];
  const dateOnly = !!d._dateOnly;
  let time = '';
  if (!dateOnly) {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    time = m ? h + ':' + pad(m) + ampm : h + ':00' + ampm;
  }
  const now = new Date();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  let rel = '';
  if (diffDays < 0) rel = diffDays === -1 ? 'yesterday' : -diffDays + ' days ago';
  else if (diffDays === 0) rel = 'today';
  else if (diffDays === 1) rel = 'tomorrow';
  else rel = 'in ' + diffDays + ' days';
  return time ? day + ' ' + time + ' · ' + rel : day + ' · ' + rel;
}

function groupOf(item, now) {
  if (item.done) return 'done';
  const d = parseDue(item.due);
  if (!d) return 'later';
  const today = startOfDay(now);
  const dueDay = startOfDay(d);
  if (dueDay < today) return 'overdue';
  if (dueDay.getTime() === today.getTime()) return 'today';
  const end = new Date(today);
  const weekday = today.getDay();
  const add = weekday === 0 ? 0 : 7 - weekday;
  end.setDate(today.getDate() + add);
  end.setHours(23, 59, 59, 999);
  if (d.getTime() <= end.getTime()) return 'week';
  return 'later';
}

function urgencyOf(item, now) {
  if (item.done) return 'done';
  const d = parseDue(item.due);
  if (!d) return 'none';
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (dayDiff <= 0) return 'red';
  if (dayDiff < 4) return 'orange';
  if (dayDiff <= 7) return 'yellow';
  return 'green';
}

function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const n = new Date();
  const m = String(n.getMinutes()).padStart(2, '0');
  if (board.clock24) {
    el.textContent = String(n.getHours()).padStart(2, '0') + ':' + m;
    renderTodayClass();
    return;
  }
  let h = n.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  el.textContent = h + ':' + m + ' ' + ampm;
  renderTodayClass();
}

function applyLook() {
  const theme = THEMES.some((x) => x.id === board.theme) ? board.theme : 'paper';
  const font = FONTS.some((x) => x.id === board.font) ? board.font : 'sans';
  const size = SIZES.some((x) => x.id === board.size) ? board.size : 'm';
  board.theme = theme;
  board.font = font;
  board.size = size;
  boardEl.dataset.theme = theme;
  boardEl.dataset.font = font;
  boardEl.dataset.size = size;
  boardEl.classList.toggle('is-dark', !!DARK_THEMES[theme]);
  boardEl.classList.remove('is-compact');
  ensureQsMenu();
  const themes = document.getElementById('qs-themes');
  if (themes) {
    themes.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.theme === theme);
    });
  }
  const fonts = document.getElementById('qs-fonts');
  if (fonts) {
    fonts.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.font === font);
    });
  }
  const sizes = document.getElementById('qs-sizes');
  if (sizes) {
    sizes.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.size === size);
    });
  }
  const clockBtn = document.getElementById('qs-clock');
  if (clockBtn) clockBtn.classList.toggle('is-on', !!board.clock24);
  tickClock();
}

function applyTheme() {
  applyLook();
}

function ensureQsMenu() {
  const themes = document.getElementById('qs-themes');
  if (!themes || themes.dataset.ready === '1') return;
  themes.dataset.ready = '1';
  THEMES.forEach((th) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.theme = th.id;
    btn.innerHTML = '<span class="theme-swatch theme-' + th.id + '"></span><span class="menu-label">' + th.label + '</span>';
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      board.theme = th.id;
      applyLook();
      window.petal.saveBoard({ theme: th.id });
    });
    themes.appendChild(btn);
  });
  const fonts = document.getElementById('qs-fonts');
  FONTS.forEach((f) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.font = f.id;
    btn.className = 'qs-pill font-' + f.id;
    btn.textContent = f.label;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      board.font = f.id;
      applyLook();
      window.petal.saveBoard({ font: f.id });
    });
    fonts.appendChild(btn);
  });
  const sizes = document.getElementById('qs-sizes');
  SIZES.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.size = s.id;
    btn.className = 'qs-pill';
    btn.textContent = s.label;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      board.size = s.id;
      applyLook();
      window.petal.saveBoard({ size: s.id });
    });
    sizes.appendChild(btn);
  });
  const clockBtn = document.getElementById('qs-clock');
  clockBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    board.clock24 = !board.clock24;
    applyLook();
    window.petal.saveBoard({ clock24: !!board.clock24 });
  });
}

function hideQsMenu() {
  const menu = document.getElementById('qs-menu');
  if (menu) menu.hidden = true;
}

function hideThemeMenu() {
  hideQsMenu();
}

function toggleQsMenu() {
  const menu = document.getElementById('qs-menu');
  const btn = document.getElementById('qs-btn');
  if (!menu || !btn) return;
  if (!menu.hidden) {
    menu.hidden = true;
    return;
  }
  hideMenus();
  ensureQsMenu();
  applyLook();
  menu.hidden = false;
  const rect = btn.getBoundingClientRect();
  const box = boardEl.getBoundingClientRect();
  const pad = 12;
  const width = Math.max(220, box.width - pad * 2);
  let left = pad;
  let top = rect.bottom - box.top + 6;
  const maxH = Math.max(160, box.height - top - 18);
  menu.style.width = width + 'px';
  menu.style.maxHeight = maxH + 'px';
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function persistCompact() {
  window.petal.saveBoard({ compact: !!board.compact });
}

function sortItems(a, b) {
  const da = parseDue(a.due);
  const db = parseDue(b.due);
  const ta = da ? da.getTime() : Number.POSITIVE_INFINITY;
  const tb = db ? db.getTime() : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

function defaultCourse() {
  return board.course || settings.boardCourse || 'Business Law';
}

function showStatus(text, kind) {
  if (!statusEl) return;
  if (!text) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.className = 'board-status' + (kind ? ' is-' + kind : '');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (statusEl.textContent === text) {
      statusEl.hidden = true;
    }
  }, 4200);
}

function hideMenus() {
  if (shareMenu) shareMenu.hidden = true;
  hideQsMenu();
}

function hideComposer() {
  composer.hidden = true;
  editingId = null;
  deleteBtn.hidden = true;
}

function hideUrlPrompt() {
  urlPrompt.hidden = true;
}

function hideConfirm() {
  pendingDeleteId = null;
  confirmEl.hidden = true;
}

function closeOverlays() {
  hideMenus();
  hideComposer();
  hideUrlPrompt();
  hideConfirm();
}

function setTypeTab(type) {
  const next = TYPE_LABEL[type] ? type : 'assignment';
  typeEl.value = next;
  document.querySelectorAll('#c-types button').forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.type === next);
  });
}

function openComposer(item) {
  hideMenus();
  hideUrlPrompt();
  hideConfirm();
  editingId = item && item.id ? item.id : null;
  composerTitle.textContent = editingId ? 'Edit deadline' : 'New deadline';
  setTypeTab((item && item.type) || 'assignment');
  titleEl.value = (item && item.title) || '';
  dueEl.value = item && item.due ? toDatetimeLocal(item.due) : '';
  courseEl.value = (item && item.course) || defaultCourse();
  notesEl.value = (item && item.notes) || '';
  deleteBtn.hidden = !editingId;
  composer.hidden = false;
  requestAnimationFrame(() => titleEl.focus());
}

function openUrlPrompt() {
  hideMenus();
  hideComposer();
  hideConfirm();
  urlInput.value = board.liveUrl || '';
  urlPrompt.hidden = false;
  requestAnimationFrame(() => urlInput.focus());
}

function requestDelete(id) {
  hideMenus();
  if (settings.confirmDelete === false) {
    window.petal.deleteBoardItem(id);
    hideComposer();
    return;
  }
  pendingDeleteId = id;
  confirmCopy.textContent = 'Delete this item?';
  composer.hidden = true;
  confirmEl.hidden = false;
}

function render() {
  const items = Array.isArray(board.items) ? board.items.slice() : [];
  const now = new Date();
  const grouped = { overdue: [], today: [], week: [], later: [], done: [] };
  items.forEach((item) => {
    const g = groupOf(item, now);
    if (!grouped[g]) grouped.later.push(item);
    else grouped[g].push(item);
  });
  GROUPS.forEach((g) => grouped[g.id].sort(sortItems));

  bodyEl.innerHTML = '';
  const hasAny = items.length > 0;
  emptyEl.hidden = hasAny;
  if (!hasAny) {
    const hasLive = !!(board.liveUrl && String(board.liveUrl).trim());
    emptyEl.textContent = hasLive
      ? (board.hasHiddenLive
        ? 'Deleted class items stay gone. Share → Reset deletes, then refresh to sync from the sheet.'
        : 'No class items yet. Hit refresh to pull the sheet.')
      : 'No deadlines yet — add one, or import a dashboard.';
  }

  const hasLive = !!(board.liveUrl && String(board.liveUrl).trim());
  refreshBtn.hidden = !hasLive;
  refreshBtn.classList.toggle('is-spin', !!board.liveRefreshing);

    applyTheme();
  tickClock();

  const summary = document.getElementById('summary');
  if (summary) {
    summary.innerHTML = '';
    const nOver = grouped.overdue.length;
    const nToday = grouped.today.length;
    const nWeek = grouped.week.length;
    const chips = [];
    if (nOver) chips.push(['overdue', nOver + ' overdue']);
    if (nToday) chips.push(['today', nToday + ' today']);
    if (nWeek) chips.push(['week', nWeek + ' this week']);
    if (!chips.length && grouped.later.length) chips.push(['later', grouped.later.length + ' upcoming']);
    chips.forEach(([kind, label]) => {
      const chip = document.createElement('span');
      chip.className = 'sum-chip is-' + kind;
      chip.textContent = label;
      summary.appendChild(chip);
    });
  }

  GROUPS.forEach((g) => {
    const list = grouped[g.id];
    if (!list.length) return;
    const section = document.createElement('section');
    section.className = 'board-group' + (g.id === 'overdue' ? ' is-overdue' : '') + (g.id === 'done' ? ' is-done' : '');
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'board-group-title';
    head.textContent = g.label + ' · ' + list.length;
    if (g.id === 'done') {
      head.setAttribute('aria-expanded', doneOpen ? 'true' : 'false');
      head.addEventListener('click', () => {
        doneOpen = !doneOpen;
        render();
      });
    }
    section.appendChild(head);
    if (g.id === 'done' && !doneOpen) {
      bodyEl.appendChild(section);
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'board-list';
    const show = list;
    if (!show.length) return;
    show.forEach((item) => {
      ul.appendChild(rowEl(item, g.id));
    });
    section.appendChild(ul);
    bodyEl.appendChild(section);
  });

}

function rowEl(item, groupId) {
  const li = document.createElement('li');
  const urg = urgencyOf(item, new Date());
  li.className = 'board-row urg-' + urg + (groupId === 'overdue' ? ' is-overdue' : '') + (item.done ? ' is-checked' : '') + (expandedId === item.id ? ' is-open' : '');
  li.dataset.id = item.id;

  const dot = document.createElement('span');
  dot.className = 'urgency-dot is-' + urg + (urg === 'red' && !item.done ? ' is-pulse' : '');
  dot.title = urg === 'red' ? 'Due today or overdue' : urg === 'orange' ? 'Due within 4 days' : urg === 'yellow' ? 'Due within a week' : urg === 'green' ? 'Plenty of time' : urg === 'done' ? 'Completed' : 'No due date';

  const main = document.createElement('div');
  main.className = 'board-row-main';

  const top = document.createElement('div');
  top.className = 'board-row-top';
  const chip = document.createElement('span');
  chip.className = 'type-chip type-' + (item.type || 'assignment');
  chip.textContent = TYPE_LABEL[item.type] || 'Assignment';
  const title = document.createElement('span');
  title.className = 'board-row-title';
  title.textContent = item.title || 'Untitled';
  top.appendChild(chip);
  top.appendChild(title);

  const due = document.createElement('div');
  due.className = 'board-row-due';
  due.textContent = formatDue(item.due) || 'No due date';

  const course = document.createElement('div');
  course.className = 'board-row-course';
  const bits = [];
  if (item.course) bits.push(item.course);
  if (item.personal) bits.push('Personal');
  else if (item.source === 'live') bits.push('Class');
  course.textContent = bits.join(' · ');

  main.appendChild(top);
  main.appendChild(due);
  if (course.textContent) main.appendChild(course);

  if (expandedId === item.id) {
    const whenText = formatDueLong(item.due);
    if (whenText) {
      const whenEl = document.createElement('div');
      whenEl.className = 'board-row-when';
      whenEl.textContent = whenText;
      main.appendChild(whenEl);
    }
    const noteText = String(item.notes || '').trim();
    if (noteText) {
      const notesEl = document.createElement('div');
      notesEl.className = 'board-row-notes';
      notesEl.textContent = noteText;
      main.appendChild(notesEl);
    }
    const actions = document.createElement('div');
    actions.className = 'board-row-actions';
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'save';
    doneBtn.textContent = item.done ? 'Restore' : 'Mark done';
    doneBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      window.petal.toggleBoardItem(item.id, !item.done);
      expandedId = null;
    });
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openComposer(item);
    });
    actions.appendChild(doneBtn);
    actions.appendChild(editBtn);
    main.appendChild(actions);
  }

  li.appendChild(dot);
  li.appendChild(main);
  li.addEventListener('click', (event) => {
    if (event.target.closest && event.target.closest('button')) return;
    expandedId = expandedId === item.id ? null : item.id;
    render();
  });
  return li;
}

let lastLiveError = null;
function applyBoard(next) {
  board = next && typeof next === 'object' ? next : board;
  if (pendingDeleteId && !(board.items || []).some((i) => i.id === pendingDeleteId)) {
    hideConfirm();
  }
  if (board.liveError && board.liveError !== lastLiveError) {
    showStatus('Couldn’t refresh the dashboard.', 'warn');
  }
  lastLiveError = board.liveError || null;
  render();
}

addBtn.addEventListener('click', () => openComposer(null));
shareBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (!shareMenu.hidden) {
    hideMenus();
    return;
  }
  hideComposer();
  hideUrlPrompt();
  hideConfirm();
  shareMenu.hidden = false;
  const rect = shareBtn.getBoundingClientRect();
  const box = boardEl.getBoundingClientRect();
  let left = rect.left - box.left;
  let top = rect.bottom - box.top + 4;
  shareMenu.style.left = left + 'px';
  shareMenu.style.top = top + 'px';
  requestAnimationFrame(() => {
    const mr = shareMenu.getBoundingClientRect();
    if (mr.right > box.right - 8) left = Math.max(8, box.width - mr.width - 8);
    if (mr.bottom > box.bottom - 8) top = Math.max(8, rect.top - box.top - mr.height - 4);
    shareMenu.style.left = left + 'px';
    shareMenu.style.top = top + 'px';
  });
});
refreshBtn.addEventListener('click', async (event) => {
  if (event.shiftKey && window.petal.restoreLive) {
    showStatus('Restoring from sheet…');
    const result = await window.petal.restoreLive();
    if (result && result.ok) showStatus('Class items restored from the sheet.', 'ok');
    else showStatus((result && result.error) || 'Couldn’t restore the dashboard.', 'warn');
    return;
  }
  showStatus('Refreshing…');
  const result = await window.petal.refreshLive();
  if (result && result.ok && result.skippedHidden) {
    showStatus('Deleted class items stay gone. Share → Restore deleted from sheet.', 'warn');
  } else if (result && result.ok) showStatus('Dashboard updated.', 'ok');
  else showStatus((result && result.error) || 'Couldn’t refresh the dashboard.', 'warn');
});
minimizeBtn.addEventListener('click', () => window.petal.minimizeBoard());
closeBtn.addEventListener('click', () => window.petal.closeBoard());

shareMenu.addEventListener('click', async (event) => {
  const btn = event.target.closest && event.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  hideMenus();
  if (act === 'export') {
    const result = await window.petal.exportBoard();
    if (result && result.canceled) return;
    if (result && result.ok) showStatus('Saved GTR-Dashboard.json.', 'ok');
    else showStatus((result && result.error) || 'Export didn’t finish.', 'warn');
  } else if (act === 'import') {
    const result = await window.petal.importBoard();
    if (result && result.canceled) return;
    if (result && result.ok) showStatus('Dashboard imported.', 'ok');
    else showStatus((result && result.error) || 'Import didn’t finish.', 'warn');
  } else if (act === 'live') {
    openUrlPrompt();
  } else if (act === 'reset-deletes') {
    const result = await window.petal.resetLiveDeletes();
    if (result && result.ok) showStatus('Deletes cleared. Refresh to pull the sheet.', 'ok');
    else showStatus((result && result.error) || 'Couldn\u2019t reset deletes.', 'warn');
  } else if (act === 'restore') {
    showStatus('Restoring from sheet…');
    const result = await window.petal.restoreLive();
    if (result && result.ok) showStatus('Class items restored from the sheet.', 'ok');
    else showStatus((result && result.error) || 'Couldn’t restore the dashboard.', 'warn');
  }
});
shareMenu.addEventListener('pointerdown', (event) => event.stopPropagation());
shareMenu.addEventListener('contextmenu', (event) => event.preventDefault());

const typeTabs = document.getElementById('c-types');
if (typeTabs) {
  typeTabs.addEventListener('click', (event) => {
    const btn = event.target.closest && event.target.closest('button[data-type]');
    if (!btn) return;
    setTypeTab(btn.dataset.type);
  });
}

cancelBtn.addEventListener('click', hideComposer);
titleEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveBtn.click();
  }
});

saveBtn.addEventListener('click', async () => {
  const title = String(titleEl.value || '').trim();
  if (!title) {
    titleEl.focus();
    return;
  }
  const payload = {
    type: typeEl.value || 'assignment',
    title,
    due: fromDatetimeLocal(dueEl.value),
    course: String(courseEl.value || '').trim() || defaultCourse(),
    notes: String(notesEl.value || '').trim(),
  };
  if (editingId) {
    payload.id = editingId;
    await window.petal.updateBoardItem(payload);
  } else {
    await window.petal.addBoardItem(payload);
  }
  hideComposer();
});
deleteBtn.addEventListener('click', () => {
  if (editingId) requestDelete(editingId);
});

urlCancel.addEventListener('click', hideUrlPrompt);
urlClear.addEventListener('click', async () => {
  await window.petal.setLiveUrl('');
  hideUrlPrompt();
  showStatus('Live URL cleared.');
});
urlSave.addEventListener('click', async () => {
  const url = String(urlInput.value || '').trim();
  const result = await window.petal.setLiveUrl(url);
  hideUrlPrompt();
  if (!url) showStatus('Live URL cleared.');
  else if (result && result.ok) showStatus('Live URL saved. Refreshing…', 'ok');
  else showStatus((result && result.error) || 'Couldn’t use that URL.', 'warn');
});

keepBtn.addEventListener('click', hideConfirm);
discardBtn.addEventListener('click', () => {
  if (pendingDeleteId) window.petal.deleteBoardItem(pendingDeleteId);
  hideConfirm();
  hideComposer();
});

const qsBtn = document.getElementById('qs-btn');
if (qsBtn) {
  qsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleQsMenu();
  });
}
const qsMenuEl = document.getElementById('qs-menu');
if (qsMenuEl) {
  qsMenuEl.addEventListener('pointerdown', (event) => event.stopPropagation());
}

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest && event.target.closest('.share-menu, #share, .qs-menu, #qs-btn, #qs-wrap')) return;
  hideMenus();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const qsMenu = document.getElementById('qs-menu');
  if (!shareMenu.hidden || (qsMenu && !qsMenu.hidden)) {
    event.preventDefault();
    hideMenus();
    return;
  }
  if (!confirmEl.hidden) {
    event.preventDefault();
    hideConfirm();
    return;
  }
  if (!urlPrompt.hidden) {
    event.preventDefault();
    hideUrlPrompt();
    return;
  }
  if (!composer.hidden) {
    event.preventDefault();
    hideComposer();
  }
});

tickClock();
if (clockTimer) clearInterval(clockTimer);
clockTimer = setInterval(tickClock, 15000);

window.petal.onBoardChanged(applyBoard);
window.petal.getBoard().then(applyBoard);
window.petal.onSettings((next) => {
  if (next) settings = { ...settings, ...next };
});
window.petal.getSettings().then((next) => {
  if (next) {
    settings = { ...settings, ...next };
    if (verEl && next.version) verEl.textContent = next.version;
  }
});

const resizeHandle = document.getElementById('resize');
if (resizeHandle) {
  resizeHandle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeHandle.setPointerCapture(event.pointerId);
    const startW = window.outerWidth;
    const startH = window.outerHeight;
    const startX = event.screenX;
    const startY = event.screenY;
    const onMove = (ev) => {
      const width = Math.max(300, startW + (ev.screenX - startX));
      const height = Math.max(280, startH + (ev.screenY - startY));
      if (window.petal.resizeBoard) window.petal.resizeBoard(width, height);
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
}
