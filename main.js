const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  globalShortcut,
  clipboard,
  dialog,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { createPresenterRemote } = require('./remote-server');

const COLORS = ['#F6E6C8', '#F4C7B8', '#D5E5C8', '#CDE4F0', '#DDD6F3'];
const INK_COLORS = ['#2A241C', '#111111', '#8C2F22', '#2F5D3A', '#1E3A5F', '#F8F1E3'];
const DEFAULT_W = 280;
const DEFAULT_H = 280;
const MIN_W = 220;
const MIN_H = 180;
const FOLDED_H = 64;
const FONT_IDS = [
  'Source Serif 4',
  'Fraunces',
  'DM Sans',
  'Georgia',
  'Segoe UI',
  'JetBrains Mono',
  'Caveat',
];
const SIZES = [12, 14, 16, 18, 22, 28];
const LINE_HEIGHTS = [1.2, 1.45, 1.55, 1.7, 2.0];
const ALIGNS = ['left', 'center'];

const DEFAULT_FORMAT = {
  font: 'Source Serif 4',
  size: 16,
  lineHeight: 1.55,
  align: 'left',
  opacity: 1,
  ink: '#2A241C',
};

const DEFAULT_SETTINGS = {
  font: 'Source Serif 4',
  size: 16,
  lineHeight: 1.55,
  paperColor: '#F6E6C8',
  opacity: 1,
  alwaysOnTop: false,
  inkColor: '#2A241C',
  confirmDelete: true,
  newNotesFolded: false,
  restoreOpenNotes: false,
  startOnLogin: false,
  snapToEdges: false,
  seenWelcome: false,
  boardCourse: 'Business Law',
  openBoardOnLaunch: false,
  boardLiveUrl: '',
};

let notesPath;
let settingsPath;
let imagesDir;
let tessdataDir;
let boardPath;
let tray = null;
let managerWin = null;
let settingsWin = null;
let boardWin = null;
let expiredWin = null;
let board = {
  version: 1,
  course: 'Business Law',
  liveUrl: '',
  updatedAt: 0,
  items: [],
  notified: {},
};
let liveError = null;
let liveRefreshing = false;
let liveTimer = null;
let notifyTimer = null;
let colorCursor = 0;
let isQuitting = false;
const notes = new Map();
let settings = { ...DEFAULT_SETTINGS };
const snapTimers = new Map();
const dragOffsets = new Map();
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
let tessWorker = null;
let tessBoot = null;
let tessBusy = Promise.resolve();

function id() {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loginItemSupported() {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function loadJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function loadStore() {
  const parsed = loadJson(notesPath, null);
  return Array.isArray(parsed) ? parsed : null;
}

function clampOpacity(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.55, n));
}

function defaultFormat(format) {
  const src = format && typeof format === 'object' ? format : {};
  const next = { ...DEFAULT_FORMAT };
  if (typeof src.font === 'string' && FONT_IDS.includes(src.font)) next.font = src.font;
  if (typeof src.size === 'number' && SIZES.includes(src.size)) next.size = src.size;
  if (typeof src.lineHeight === 'number' && LINE_HEIGHTS.includes(src.lineHeight)) {
    next.lineHeight = src.lineHeight;
  }
  if (typeof src.align === 'string' && ALIGNS.includes(src.align)) next.align = src.align;
  if (typeof src.opacity === 'number' && Number.isFinite(src.opacity)) {
    next.opacity = clampOpacity(src.opacity);
  }
  if (typeof src.ink === 'string' && INK_COLORS.includes(src.ink)) next.ink = src.ink;
  return next;
}

function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const next = { ...DEFAULT_SETTINGS };
  if (typeof src.font === 'string' && FONT_IDS.includes(src.font)) next.font = src.font;
  if (typeof src.size === 'number' && SIZES.includes(src.size)) next.size = src.size;
  if (typeof src.lineHeight === 'number' && LINE_HEIGHTS.includes(src.lineHeight)) {
    next.lineHeight = src.lineHeight;
  }
  if (typeof src.paperColor === 'string' && COLORS.includes(src.paperColor)) {
    next.paperColor = src.paperColor;
  }
  if (typeof src.opacity === 'number' && Number.isFinite(src.opacity)) {
    next.opacity = clampOpacity(src.opacity);
  }
  if (typeof src.alwaysOnTop === 'boolean') next.alwaysOnTop = src.alwaysOnTop;
  if (typeof src.inkColor === 'string' && INK_COLORS.includes(src.inkColor)) {
    next.inkColor = src.inkColor;
  }
  if (typeof src.confirmDelete === 'boolean') next.confirmDelete = src.confirmDelete;
  if (typeof src.newNotesFolded === 'boolean') next.newNotesFolded = src.newNotesFolded;
  if (typeof src.restoreOpenNotes === 'boolean') next.restoreOpenNotes = src.restoreOpenNotes;
  if (typeof src.startOnLogin === 'boolean') next.startOnLogin = src.startOnLogin;
  if (typeof src.snapToEdges === 'boolean') next.snapToEdges = src.snapToEdges;
  if (typeof src.boardCourse === 'string' && src.boardCourse.trim()) {
    next.boardCourse = src.boardCourse.trim().slice(0, 80);
  }
  if (typeof src.openBoardOnLaunch === 'boolean') next.openBoardOnLaunch = src.openBoardOnLaunch;
  if (typeof src.boardLiveUrl === 'string') next.boardLiveUrl = src.boardLiveUrl.trim();
  if (typeof src.seenWelcome === 'boolean') next.seenWelcome = src.seenWelcome;
  return next;
}

function displayVersion() {
  try {
    const v = String(app.getVersion() || '3.0.0');
    const m = v.match(/^(\d+\.\d+)/);
    return m ? m[1] : '3.0';
  } catch (_) {
    return '3.0';
  }
}

function appYearExpired() {
  return new Date().getFullYear() >= 2027;
}

function closeLiveWindows() {
  try { globalShortcut.unregisterAll(); } catch (_) {}
  stopBoardTimers();
  if (tray) {
    try { tray.destroy(); } catch (_) {}
    tray = null;
  }
  for (const entry of notes.values()) {
    if (entry.win && !entry.win.isDestroyed()) {
      try { entry.win.destroy(); } catch (_) {}
    }
    entry.win = null;
  }
  const wins = [managerWin, settingsWin, boardWin];
  managerWin = null;
  settingsWin = null;
  boardWin = null;
  wins.forEach((w) => {
    if (w && !w.isDestroyed()) {
      try { w.destroy(); } catch (_) {}
    }
  });
}

function showExpiredWindow() {
  if (expiredWin && !expiredWin.isDestroyed()) {
    expiredWin.show();
    expiredWin.focus();
    return;
  }
  expiredWin = new BrowserWindow({
    width: 440,
    height: 260,
    resizable: false,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    autoHideMenuBar: true,
    title: 'GTR Stickies',
    backgroundColor: '#F6E6C8',
    icon: makeIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  expiredWin.loadFile(path.join(__dirname, 'renderer', 'expired.html'));
  expiredWin.on('closed', () => {
    expiredWin = null;
    if (!isQuitting) {
      isQuitting = true;
      app.quit();
    }
  });
}

function haltIfExpired() {
  if (!appYearExpired()) return false;
  closeLiveWindows();
  showExpiredWindow();
  return true;
}

function publicSettings() {
  return {
    ...settings,
    loginItemSupported: loginItemSupported(),
    colors: COLORS,
    inkColors: INK_COLORS,
    shortcut: 'Ctrl+Shift+N',
    version: displayVersion(),
    boardLiveUrl: (board && board.liveUrl) || settings.boardLiveUrl || '',
  };
}

function persistSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to persist settings:', err);
  }
}

function applyLoginItem() {
  if (!loginItemSupported()) return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!settings.startOnLogin });
  } catch (_) {
    /* unsupported */
  }
}

function loadSettings() {
  settings = normalizeSettings(loadJson(settingsPath, null));
  applyLoginItem();
}

function saveSettings(partial) {
  const prevCourse = settings.boardCourse;
  settings = normalizeSettings({ ...settings, ...(partial || {}) });
  persistSettings();
  applyLoginItem();
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'boardLiveUrl')) {
    applyLiveUrl(String(partial.boardLiveUrl || ''), { fromSettings: true });
  }
  if (partial && typeof partial.boardCourse === 'string') {
    const course = settings.boardCourse || 'Business Law';
    if (!board.course || board.course === prevCourse) {
      board.course = course;
      persistBoard();
    }
  }
  broadcastSettings();
  return publicSettings();
}

function broadcastSettings() {
  const payload = publicSettings();
  for (const entry of notes.values()) {
    if (entry.win && !entry.win.isDestroyed()) {
      entry.win.webContents.send('settings:changed', payload);
    }
  }
  if (managerWin && !managerWin.isDestroyed()) {
    managerWin.webContents.send('settings:changed', payload);
  }
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('settings:changed', payload);
  }
  if (boardWin && !boardWin.isDestroyed()) {
    boardWin.webContents.send('settings:changed', payload);
  }
}

function formatFromSettings() {
  return defaultFormat({
    font: settings.font,
    size: settings.size,
    lineHeight: settings.lineHeight,
    opacity: settings.opacity,
    ink: settings.inkColor,
    align: 'left',
  });
}

function finiteNum(n, fallback) {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function mimeFromExt(ext) {
  switch (String(ext || '').toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

function extFromMime(mime, fallback) {
  switch (String(mime || '').toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    case 'image/png':
      return '.png';
    default:
      return IMAGE_EXTS.has(String(fallback || '').toLowerCase()) ? String(fallback).toLowerCase() : '.png';
  }
}

function normalizeImage(raw, index) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const file = typeof src.file === 'string' ? path.basename(src.file) : '';
  return {
    id: typeof src.id === 'string' && src.id ? src.id : `i_${index}_${id()}`,
    file,
    x: finiteNum(src.x, 16),
    y: finiteNum(src.y, 16),
    width: Math.max(48, finiteNum(src.width, 140)),
    height: Math.max(48, finiteNum(src.height, 100)),
    z: Number.isFinite(Number(src.z)) ? Number(src.z) : index + 1,
    rotation: Number.isFinite(Number(src.rotation))
      ? Math.max(-6, Math.min(6, Number(src.rotation)))
      : 0,
  };
}

function serializeImage(img) {
  return {
    id: img.id,
    file: img.file,
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height,
    z: img.z || 0,
    rotation: img.rotation || 0,
  };
}

function noteHasImages(entry) {
  return !!(entry && Array.isArray(entry.data.images) && entry.data.images.length);
}

function normalizeNote(data) {
  const height = Math.max(MIN_H, data.height || DEFAULT_H);
  return {
    id: data.id || id(),
    x: data.x,
    y: data.y,
    width: Math.max(MIN_W, data.width || DEFAULT_W),
    height,
    color: COLORS.includes(data.color) ? data.color : COLORS[colorCursor % COLORS.length],
    text: typeof data.text === 'string' ? data.text : '',
    pinned: data.pinned !== false,
    presenterMode: !!data.presenterMode,
    open: data.open !== false,
    folded: !!data.folded,
    unfoldedHeight:
      typeof data.unfoldedHeight === 'number' && Number.isFinite(data.unfoldedHeight)
        ? Math.max(MIN_H, data.unfoldedHeight)
        : height,
    minimized: !!data.minimized,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    format: defaultFormat(data.format),
    images: Array.isArray(data.images)
      ? data.images.map((img, i) => normalizeImage(img, i)).filter((img) => img.file)
      : [],
  };
}

function noteImagesDir(noteId) {
  return path.join(imagesDir, noteId);
}

function deleteNoteImages(noteId) {
  if (!imagesDir || !noteId) return;
  try {
    fs.rmSync(noteImagesDir(noteId), { recursive: true, force: true });
  } catch (_) {
    /* ignore */
  }
}

function deleteImageFile(noteId, file) {
  if (!imagesDir || !noteId || !file) return;
  try {
    fs.unlinkSync(path.join(noteImagesDir(noteId), path.basename(file)));
  } catch (_) {
    /* ignore */
  }
}

function asBuffer(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (data.type === 'Buffer' && Array.isArray(data.data)) return Buffer.from(data.data);
  return null;
}

function dataUrlFromFile(filePath, ext) {
  const buf = fs.readFileSync(filePath);
  return `data:${mimeFromExt(ext)};base64,${buf.toString('base64')}`;
}

function publicImages(noteData) {
  if (!noteData || !Array.isArray(noteData.images) || !imagesDir) return [];
  const dir = noteImagesDir(noteData.id);
  const out = [];
  for (const img of noteData.images) {
    const file = path.basename(img.file || '');
    if (!file) continue;
    const fp = path.join(dir, file);
    try {
      if (!fs.existsSync(fp)) continue;
      out.push({
        ...serializeImage({ ...img, file }),
        dataUrl: dataUrlFromFile(fp, path.extname(file)),
      });
    } catch (_) {
      /* skip broken files */
    }
  }
  return out;
}

function probeImageSize(buffer) {
  try {
    const ni = nativeImage.createFromBuffer(buffer);
    if (!ni.isEmpty()) {
      const s = ni.getSize();
      if (s.width > 0 && s.height > 0) return s;
    }
  } catch (_) {
    /* gif/webp may not decode */
  }
  return { width: 160, height: 120 };
}

function defaultStickerSize(natW, natH, noteWidth) {
  const maxW = Math.max(96, Math.min(176, Math.round((noteWidth || DEFAULT_W) * 0.58)));
  const maxH = 168;
  const scale = Math.min(1, maxW / Math.max(natW, 1), maxH / Math.max(natH, 1));
  return {
    width: Math.max(48, Math.round(natW * scale)),
    height: Math.max(48, Math.round(natH * scale)),
  };
}

function nextImageZ(images) {
  return (images || []).reduce((m, img) => Math.max(m, Number(img.z) || 0), 0) + 1;
}

function addImageRecord(entry, buffer, ext) {
  if (!entry || !buffer || !buffer.length) return null;
  if (buffer.length > MAX_IMAGE_BYTES) return null;
  const safeExt = IMAGE_EXTS.has(ext) ? ext : '.png';
  const imgId = `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const file = `${imgId}${safeExt}`;
  const dir = noteImagesDir(entry.data.id);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, file);
  fs.writeFileSync(dest, buffer);
  if (!Array.isArray(entry.data.images)) entry.data.images = [];
  const nat = probeImageSize(buffer);
  const size = defaultStickerSize(nat.width, nat.height, entry.data.width);
  const n = entry.data.images.length;
  const rec = {
    id: imgId,
    file,
    x: 16 + (n % 5) * 14,
    y: 16 + (n % 5) * 14,
    width: size.width,
    height: size.height,
    z: nextImageZ(entry.data.images),
    rotation: Math.round((Math.random() * 4 - 2) * 10) / 10,
  };
  entry.data.images.push(rec);
  entry.data.updatedAt = Date.now();
  persist();
  return {
    ...serializeImage(rec),
    dataUrl: dataUrlFromFile(dest, safeExt),
  };
}

function copyNoteImages(srcId, destId, images) {
  const copied = [];
  if (!imagesDir || !srcId || !destId || !Array.isArray(images)) return copied;
  const srcDir = noteImagesDir(srcId);
  const destDir = noteImagesDir(destId);
  fs.mkdirSync(destDir, { recursive: true });
  for (const img of images) {
    const file = path.basename(img.file || '');
    if (!file) continue;
    try {
      fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      copied.push(serializeImage({ ...img, file }));
    } catch (_) {
      /* skip missing */
    }
  }
  return copied;
}

function tessdataReady() {
  if (!tessdataDir) return false;
  try {
    return fs.readdirSync(tessdataDir).some((f) => f.startsWith('eng.traineddata'));
  } catch (_) {
    return false;
  }
}

async function getTessWorker() {
  if (tessWorker) return tessWorker;
  if (tessBoot) return tessBoot;
  tessBoot = (async () => {
    const { createWorker } = require('tesseract.js');
    fs.mkdirSync(tessdataDir, { recursive: true });
    const worker = await createWorker('eng', 1, {
      cachePath: tessdataDir,
      gzip: true,
    });
    tessWorker = worker;
    return worker;
  })();
  try {
    return await tessBoot;
  } catch (err) {
    tessBoot = null;
    tessWorker = null;
    throw err;
  }
}

function runSnipe(fn) {
  const job = tessBusy.then(fn, fn);
  tessBusy = job.then(
    () => {},
    () => {}
  );
  return job;
}

async function terminateTess() {
  const worker = tessWorker;
  tessWorker = null;
  tessBoot = null;
  if (worker) {
    try {
      await worker.terminate();
    } catch (_) {
      /* ignore */
    }
  }
}

function plainText(html) {
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

function isEmptyText(html) {
  return plainText(html).trim() === '';
}

function noteWindowTitle(text) {
  const line = plainText(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!line) return 'GTR Stickies';
  const clipped = line.length > 42 ? line.slice(0, 41) + '…' : line;
  return 'GTR Stickies — ' + clipped;
}

function applyWindowTitle(entry) {
  if (!entry || !entry.win || entry.win.isDestroyed()) return;
  entry.win.setTitle(noteWindowTitle(entry.data.text));
}

function captureBounds(entry) {
  if (!entry || !entry.win || entry.win.isDestroyed()) return;
  const b = entry.win.getBounds();
  entry.data.x = b.x;
  entry.data.y = b.y;
  entry.data.width = b.width;
  entry.data.pinned = entry.win.isAlwaysOnTop();
  if (entry.data.folded) {
    // Keep the slim bar height out of the restored size.
  } else {
    entry.data.height = b.height;
    entry.data.unfoldedHeight = b.height;
  }
}

function serializeList() {
  const list = [];
  for (const entry of notes.values()) {
    captureBounds(entry);
    list.push({
      ...entry.data,
      format: { ...entry.data.format },
      images: (entry.data.images || []).map(serializeImage),
    });
  }
  return list;
}

function persist() {
  const list = serializeList();
  try {
    fs.mkdirSync(path.dirname(notesPath), { recursive: true });
    fs.writeFileSync(notesPath, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Failed to persist notes:', err);
  }
  notifyManager();
}

function isWindowVisible(entry) {
  return !!(
    entry.win &&
    !entry.win.isDestroyed() &&
    entry.win.isVisible() &&
    !entry.data.minimized
  );
}

function listForManager() {
  return [...notes.values()]
    .map((entry) => ({
      id: entry.data.id,
      text: entry.data.text,
      color: entry.data.color,
      pinned: !!entry.data.pinned,
      open: isWindowVisible(entry),
      minimized: !!entry.data.minimized,
      folded: !!entry.data.folded,
      updatedAt: entry.data.updatedAt || 0,
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function notifyManager() {
  if (managerWin && !managerWin.isDestroyed()) {
    managerWin.webContents.send('notes:changed', listForManager());
  }
}

function cascadeOrigin(index) {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const col = index % 6;
  const row = Math.floor(index / 6);
  const x = Math.round(area.x + area.width - DEFAULT_W - 64 - col * 48);
  const y = Math.round(area.y + 64 + row * 48 + col * 40);
  return { x, y };
}

function visibleOnAnyDisplay(bounds) {
  const displays = screen.getAllDisplays();
  return displays.some((d) => {
    const a = d.workArea;
    const overlapW = Math.min(bounds.x + bounds.width, a.x + a.width) - Math.max(bounds.x, a.x);
    const overlapH = Math.min(bounds.y + bounds.height, a.y + a.height) - Math.max(bounds.y, a.y);
    return overlapW > 80 && overlapH > 60;
  });
}

function makeIcon() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  } catch (_) {
    /* fall through */
  }
  const pixel =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8uG1TPQAIOQM9VGFK2wAAAABJRU5ErkJggg==';
  return nativeImage.createFromDataURL('data:image/png;base64,' + pixel).resize({
    width: 32,
    height: 32,
  });
}

function ensureBounds(data) {
  const bounds = {
    x: data.x,
    y: data.y,
    width: Math.max(MIN_W, data.width || DEFAULT_W),
    height: Math.max(MIN_H, data.height || DEFAULT_H),
  };
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number' || !visibleOnAnyDisplay(bounds)) {
    const openCount = [...notes.values()].filter((e) => e.win && !e.win.isDestroyed()).length;
    const pos = cascadeOrigin(openCount);
    bounds.x = pos.x;
    bounds.y = pos.y;
  }
  data.x = bounds.x;
  data.y = bounds.y;
  data.width = bounds.width;
  data.height = bounds.height;
  return bounds;
}

function sendMeta(entry) {
  if (!entry || !entry.win || entry.win.isDestroyed()) return;
  entry.win.webContents.send('note:meta', {
    folded: !!entry.data.folded,
    minimized: !!entry.data.minimized,
  });
}

function applyFoldedSize(entry) {
  if (!entry || !entry.win || entry.win.isDestroyed()) return;
  const win = entry.win;
  const width = Math.max(MIN_W, entry.data.width || DEFAULT_W);
  if (entry.data.folded) {
    win.setMinimumSize(MIN_W, FOLDED_H);
    win.setSize(width, FOLDED_H);
  } else {
    const h = Math.max(MIN_H, entry.data.unfoldedHeight || entry.data.height || DEFAULT_H);
    win.setMinimumSize(MIN_W, MIN_H);
    win.setSize(width, h);
    entry.data.height = h;
  }
}

function maybeSnap(entry) {
  if (!settings.snapToEdges || !entry || !entry.win || entry.win.isDestroyed()) return;
  const win = entry.win;
  const prev = snapTimers.get(win.id);
  if (prev) clearTimeout(prev);
  snapTimers.set(
    win.id,
    setTimeout(() => {
      snapTimers.delete(win.id);
      if (!settings.snapToEdges || win.isDestroyed() || !win.isVisible()) return;
      const b = win.getBounds();
      const display = screen.getDisplayMatching(b);
      const a = display.workArea;
      const T = 28;
      let x = b.x;
      let y = b.y;
      if (Math.abs(b.x - a.x) < T) x = a.x;
      else if (Math.abs(b.x + b.width - (a.x + a.width)) < T) x = a.x + a.width - b.width;
      if (Math.abs(b.y - a.y) < T) y = a.y;
      else if (Math.abs(b.y + b.height - (a.y + a.height)) < T) y = a.y + a.height - b.height;
      if (x !== b.x || y !== b.y) {
        win.setPosition(Math.round(x), Math.round(y));
      }
    }, 160)
  );
}


/** Keep pinned notes above PowerPoint Presenter / slideshow (floating loses). */
function applyNotePin(win, on) {
  if (!win || win.isDestroyed()) return;
  if (on) {
    try {
      win.setAlwaysOnTop(true, 'screen-saver');
    } catch (_) {
      win.setAlwaysOnTop(true);
    }
    try {
      win.moveTop();
    } catch (_) {
      /* ignore */
    }
  } else {
    win.setAlwaysOnTop(false);
  }
}

function reassertPinnedNotes() {
  for (const entry of notes.values()) {
    if (!entry || !entry.data || !entry.data.pinned) continue;
    if (!entry.win || entry.win.isDestroyed()) continue;
    applyNotePin(entry.win, true);
  }
}

let pinHoldTimer = null;
function syncPinHold() {
  const any = [...notes.values()].some(
    (e) => e && e.data && e.data.pinned && e.win && !e.win.isDestroyed()
  );
  if (any && !pinHoldTimer) {
    pinHoldTimer = setInterval(reassertPinnedNotes, 1500);
  } else if (!any && pinHoldTimer) {
    clearInterval(pinHoldTimer);
    pinHoldTimer = null;
  }
}


/** Exclude note from OS screen capture (full-screen / Display Capture). Bonus for Meet full-desktop share. */
function applyPresenterMode(win, on) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setContentProtection(!!on);
  } catch (_) {
    /* older Electron / platforms */
  }
}

/* Win32 ShowCursor — Meet window-share draws the OS cursor onto the shared slide preview
   when the pointer rests over a floating sticky that overlaps the slide window's screen bounds.
   CSS cursor:none alone does not stop that ghost cursor. */
let _showCursorFn = null;
let _showCursorTried = false;
let _systemCursorHidden = false;
const presenterPointerNotes = new Set();

function loadShowCursor() {
  if (process.platform !== 'win32') return null;
  if (_showCursorTried) return _showCursorFn;
  _showCursorTried = true;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    _showCursorFn = user32.func('int __stdcall ShowCursor(int bShow)');
  } catch (err) {
    console.warn('ShowCursor FFI unavailable:', err && err.message ? err.message : err);
    _showCursorFn = null;
  }
  return _showCursorFn;
}

function hideSystemCursor() {
  if (_systemCursorHidden) return;
  const ShowCursor = loadShowCursor();
  if (!ShowCursor) return;
  try {
    ShowCursor(0);
    _systemCursorHidden = true;
  } catch (err) {
    console.warn('ShowCursor(FALSE) failed:', err && err.message ? err.message : err);
  }
}

function showSystemCursor() {
  if (!_systemCursorHidden) return;
  const ShowCursor = loadShowCursor();
  if (!ShowCursor) {
    _systemCursorHidden = false;
    return;
  }
  try {
    ShowCursor(1);
  } catch (err) {
    console.warn('ShowCursor(TRUE) failed:', err && err.message ? err.message : err);
  }
  _systemCursorHidden = false;
}

function syncSystemCursorForPresenter() {
  if (presenterPointerNotes.size > 0) hideSystemCursor();
  else showSystemCursor();
}

function setPresenterPointerInside(noteId, inside) {
  if (!noteId) return;
  if (inside) presenterPointerNotes.add(noteId);
  else presenterPointerNotes.delete(noteId);
  syncSystemCursorForPresenter();
}

function clearPresenterPointer(noteId) {
  if (noteId) presenterPointerNotes.delete(noteId);
  else presenterPointerNotes.clear();
  syncSystemCursorForPresenter();
}


let remoteTargetNoteId = null;
let presenterRemote = null;

function getPresenterRemote() {
  if (presenterRemote) return presenterRemote;
  presenterRemote = createPresenterRemote({
    htmlPath: path.join(__dirname, 'renderer', 'remote.html'),
    onScroll: (payload) => {
      applyRemoteScroll(payload);
    },
    onStatus: (info) => {
      broadcastRemoteInfo(info);
    },
  });
  return presenterRemote;
}

function presenterEntries() {
  return [...notes.values()].filter((e) => e && e.data && e.data.presenterMode);
}

function resolveRemoteTargetEntry() {
  const live = presenterEntries().filter((e) => e.win && !e.win.isDestroyed());
  if (!live.length) return null;
  if (remoteTargetNoteId) {
    const hit = live.find((e) => e.data.id === remoteTargetNoteId);
    if (hit) return hit;
  }
  return live[live.length - 1];
}

function applyRemoteScroll(payload) {
  const entry = resolveRemoteTargetEntry();
  if (!entry || !entry.win || entry.win.isDestroyed()) return;
  const wc = entry.win.webContents;
  if (!wc || wc.isDestroyed()) return;
  // Scroll only — never focus / moveTop (keeps PowerPoint / Meet in front).
  try {
    wc.send('note:remote-scroll', payload || {});
  } catch (_) {
    /* ignore */
  }
}

function broadcastRemoteInfo(info) {
  const payload = info || (presenterRemote ? presenterRemote.info() : { running: false });
  for (const entry of notes.values()) {
    if (!entry || !entry.data || !entry.data.presenterMode) continue;
    if (!entry.win || entry.win.isDestroyed()) continue;
    try {
      entry.win.webContents.send('note:remote-info', {
        ...payload,
        targetNoteId: remoteTargetNoteId,
      });
    } catch (_) {
      /* ignore */
    }
  }
}

async function syncPresenterRemote() {
  const active = presenterEntries();
  if (!active.length) {
    remoteTargetNoteId = null;
    if (presenterRemote && presenterRemote.isRunning()) {
      presenterRemote.stop();
    } else {
      broadcastRemoteInfo({ running: false });
    }
    return;
  }
  if (remoteTargetNoteId) {
    const still = active.some((e) => e.data.id === remoteTargetNoteId);
    if (!still) remoteTargetNoteId = active[active.length - 1].data.id;
  } else {
    remoteTargetNoteId = active[active.length - 1].data.id;
  }
  try {
    const remote = getPresenterRemote();
    const info = await remote.start();
    broadcastRemoteInfo(info);
  } catch (err) {
    console.warn('Presenter remote failed to start:', err && err.message ? err.message : err);
    broadcastRemoteInfo({ running: false, error: String(err && err.message ? err.message : err) });
  }
}


function attachWindow(entry, { focus } = { focus: true }) {
  const noteData = entry.data;
  const bounds = ensureBounds(noteData);
  noteData.open = true;
  const folded = !!noteData.folded;
  const startH = folded ? FOLDED_H : bounds.height;

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: startH,
    minWidth: MIN_W,
    minHeight: folded ? FOLDED_H : MIN_H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: noteData.pinned,
    skipTaskbar: false,
    resizable: true,
    hasShadow: false,
    show: false,
    title: noteWindowTitle(noteData.text),
    icon: makeIcon(),
    roundedCorners: true,
    maximizable: false,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  applyNotePin(win, !!noteData.pinned);
  applyPresenterMode(win, !!noteData.presenterMode);
  win.on('blur', () => {
    if (entry.data && entry.data.pinned) applyNotePin(win, true);
    if (entry.data) clearPresenterPointer(entry.data.id);
  });
  syncPinHold();

  try {
    const ses = win.webContents.session;
    ses.setSpellCheckerEnabled(true);
    const available = ses.availableSpellCheckerLanguages || [];
    const wanted = ['en-GB', 'en-US'].filter((code) => available.includes(code));
    if (wanted.length) {
      ses.setSpellCheckerLanguages(wanted);
    } else {
      const en = available.filter((code) => String(code).startsWith('en')).slice(0, 2);
      if (en.length) ses.setSpellCheckerLanguages(en);
    }
  } catch (_) {
    /* dictionaries vary by platform */
  }

  entry.win = win;
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    applyWindowTitle(entry);
    if (noteData.minimized) {
      win.show();
      win.minimize();
      return;
    }
    win.show();
    if (focus) win.focus();
  });

  win.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    if (win.isDestroyed()) return;
    const word = params && params.misspelledWord ? String(params.misspelledWord) : '';
    const selectionText = params && params.selectionText ? String(params.selectionText) : '';
    const suggestions = params && Array.isArray(params.dictionarySuggestions)
      ? params.dictionarySuggestions.map((s) => String(s)).filter(Boolean).slice(0, 8)
      : [];
    win.webContents.send('note:spell-context', {
      misspelledWord: word,
      dictionarySuggestions: suggestions,
      selectionText,
      x: params && params.x,
      y: params && params.y,
    });
  });

  win.webContents.on('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.webContents.send('note:init', {
      ...noteData,
      format: { ...noteData.format },
      images: publicImages(noteData),
      colors: COLORS,
      inkColors: INK_COLORS,
      folded: !!noteData.folded,
      settings: publicSettings(),
      tessReady: tessdataReady(),
    });
    if (noteData.presenterMode && presenterRemote && presenterRemote.isRunning()) {
      try {
        win.webContents.send('note:remote-info', {
          ...presenterRemote.info(),
          targetNoteId: remoteTargetNoteId,
        });
      } catch (_) {
        /* ignore */
      }
    } else if (noteData.presenterMode) {
      setTimeout(() => { try { syncPresenterRemote(); } catch (_) {} }, 0);
    }
  });

  const saveBounds = () => {
    if (win.isDestroyed()) return;
    captureBounds(entry);
    persist();
    maybeSnap(entry);
  };

  win.on('moved', saveBounds);
  win.on('resized', saveBounds);

  win.on('minimize', () => {
    entry.data.minimized = true;
    entry.data.open = true;
    entry.data.updatedAt = Date.now();
    persist();
  });

  win.on('restore', () => {
    entry.data.minimized = false;
    entry.data.open = true;
    entry.data.updatedAt = Date.now();
    persist();
  });

  win.on('closed', () => {
    clearPresenterPointer(noteData.id);
    if (remoteTargetNoteId === noteData.id) {
      const others = presenterEntries().filter((e) => e.data.id !== noteData.id);
      remoteTargetNoteId = others.length ? others[others.length - 1].data.id : null;
    }
    setTimeout(() => { try { syncPresenterRemote(); } catch (_) {} }, 0);
    const current = notes.get(noteData.id);
    if (!current) return;
    current.win = null;
    dragOffsets.delete(win.id);
    if (isQuitting) {
      persist();
      return;
    }
    if (current.data.open !== false) {
      current.data.open = false;
      current.data.minimized = false;
      current.data.updatedAt = Date.now();
    }
    persist();
    ensureManagerAlive();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const cmd = input.control || input.meta;
    const key = String(input.key || '');
    const lower = key.toLowerCase();
    if (cmd && lower === 'n' && !input.shift && !input.alt) {
      event.preventDefault();
      spawnNote();
    }
    if (cmd && lower === 'w') {
      event.preventDefault();
      if (!win.isDestroyed()) win.webContents.send('note:request-close');
    }
    if (cmd && (key === '`' || key === 'Backquote' || (input.shift && lower === 'f'))) {
      event.preventDefault();
      toggleFold(entry);
    }
  });

  return win;
}

function createNote(data, { focus } = { focus: true }) {
  const noteData = normalizeNote(data);
  const entry = { data: noteData, win: null };
  notes.set(noteData.id, entry);
  if (noteData.open !== false) {
    attachWindow(entry, { focus: focus && !noteData.minimized });
  }
  persist();
  return entry.win;
}

function spawnNote(partial = {}) {
  if (haltIfExpired()) return null;
  const color =
    partial.color ||
    (COLORS.includes(settings.paperColor) ? settings.paperColor : COLORS[colorCursor % COLORS.length]);
  colorCursor = (colorCursor + 1) % COLORS.length;
  const pos = cascadeOrigin([...notes.values()].filter((e) => e.win && !e.win.isDestroyed()).length);
  const format = defaultFormat({ ...formatFromSettings(), ...(partial.format || {}) });
  const folded = typeof partial.folded === 'boolean' ? partial.folded : !!settings.newNotesFolded;
  const height = Math.max(MIN_H, partial.height || DEFAULT_H);
  return createNote({
    id: id(),
    x: typeof partial.x === 'number' ? partial.x : pos.x,
    y: typeof partial.y === 'number' ? partial.y : pos.y,
    width: partial.width || DEFAULT_W,
    height,
    color,
    text: partial.text || '',
    pinned: typeof partial.pinned === 'boolean' ? partial.pinned : !!settings.alwaysOnTop,
    open: true,
    folded,
    unfoldedHeight: height,
    minimized: false,
    updatedAt: Date.now(),
    format,
  });
}

function findEntry(webContents) {
  const win = BrowserWindow.fromWebContents(webContents);
  if (!win) return null;
  for (const entry of notes.values()) {
    if (entry.win === win) return entry;
  }
  return null;
}

function hideNote(entry) {
  if (!entry) return;
  captureBounds(entry);
  entry.data.open = false;
  entry.data.minimized = false;
  entry.data.updatedAt = Date.now();
  if (entry.win && !entry.win.isDestroyed()) {
    entry.win.close();
  } else {
    persist();
  }
}

function deleteNote(id) {
  const entry = notes.get(id);
  if (!entry) return;
  if (entry.data) {
    entry.data.presenterMode = false;
    clearPresenterPointer(id);
  }
  if (remoteTargetNoteId === id) remoteTargetNoteId = null;
  notes.delete(id);
  if (entry.win && !entry.win.isDestroyed()) {
    entry.data.open = false;
    entry.data.minimized = false;
    entry.win.close();
  }
  deleteNoteImages(id);
  persist();
  syncPresenterRemote();
}

function hideOrRemove(entry) {
  if (!entry) return;
  if (isEmptyText(entry.data.text) && !noteHasImages(entry)) {
    deleteNote(entry.data.id);
  } else {
    hideNote(entry);
  }
}

function showNote(id, { focus } = { focus: true }) {
  const entry = notes.get(id);
  if (!entry) return;
  entry.data.open = true;
  entry.data.minimized = false;
  entry.data.updatedAt = Date.now();
  if (entry.win && !entry.win.isDestroyed()) {
    if (entry.win.isMinimized()) entry.win.restore();
    entry.win.show();
    entry.win.moveTop();
    if (focus) entry.win.focus();
    persist();
    return;
  }
  attachWindow(entry, { focus });
  persist();
}

function minimizeNote(entry) {
  if (!entry) return;
  captureBounds(entry);
  entry.data.minimized = true;
  entry.data.open = true;
  entry.data.updatedAt = Date.now();
  if (entry.win && !entry.win.isDestroyed()) {
    entry.win.minimize();
  }
  persist();
}

function toggleFold(entry) {
  if (!entry || !entry.win || entry.win.isDestroyed()) return;
  captureBounds(entry);
  entry.data.folded = !entry.data.folded;
  if (!entry.data.folded) {
    entry.data.height = Math.max(MIN_H, entry.data.unfoldedHeight || DEFAULT_H);
  }
  entry.data.updatedAt = Date.now();
  sendMeta(entry);
  applyFoldedSize(entry);
  persist();
}

function duplicateNote(noteId) {
  const entry = notes.get(noteId);
  if (!entry) return;
  captureBounds(entry);
  const src = entry.data;
  const newId = id();
  const images = copyNoteImages(src.id, newId, src.images || []);
  createNote({
    id: newId,
    x: (typeof src.x === 'number' ? src.x : 80) + 28,
    y: (typeof src.y === 'number' ? src.y : 80) + 28,
    width: src.width,
    height: src.unfoldedHeight || src.height || DEFAULT_H,
    color: src.color,
    text: src.text,
    pinned: src.pinned,
    presenterMode: !!src.presenterMode,
    open: true,
    folded: false,
    unfoldedHeight: src.unfoldedHeight || src.height || DEFAULT_H,
    minimized: false,
    updatedAt: Date.now(),
    format: defaultFormat(src.format),
    images,
  });
}

function seedFirstLaunch() {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const creamX = Math.round(area.x + area.width - 300 - 80);
  const creamY = Math.round(area.y + 80);
  createNote(
    {
      id: id(),
      x: creamX,
      y: creamY,
      width: 300,
      height: 292,
      color: '#F6E6C8',
      text: 'Welcome to GTR Stickies.\n\nSticky notes for your desk, plus a Dashboard for class deadlines.\n\nDeveloped by Mohamed Asjau.',
      pinned: false,
      open: false,
      updatedAt: Date.now(),
      format: { ...DEFAULT_FORMAT },
    },
    { focus: false }
  );
  createNote(
    {
      id: id(),
      x: Math.max(area.x + 48, creamX - 250),
      y: creamY + 52,
      width: DEFAULT_W,
      height: DEFAULT_H,
      color: '#D5E5C8',
      text: '',
      pinned: false,
      open: false,
      updatedAt: Date.now(),
      format: { ...DEFAULT_FORMAT },
    },
    { focus: false }
  );
  colorCursor = 2;
}

function restoreOrSeed() {
  if (haltIfExpired()) return;
  const stored = loadStore();
  if (!stored) {
    seedFirstLaunch();
    openManager();
    return;
  }
  stored.forEach((n) => {
    const noteData = normalizeNote(n);
    noteData.open = false;
    noteData.minimized = false;
    const idx = COLORS.indexOf(noteData.color);
    if (idx >= 0) colorCursor = (idx + 1) % COLORS.length;
    notes.set(noteData.id, { data: noteData, win: null });
  });
  persist();
  openManager();
}

function showAll() {
  if (haltIfExpired()) return;
  let last = null;
  for (const entry of notes.values()) {
    if (entry.data.open === false && !entry.data.minimized) continue;
    if (entry.data.minimized || entry.data.open !== false) {
      showNote(entry.data.id, { focus: false });
      last = notes.get(entry.data.id);
    }
  }
  if (last && last.win && !last.win.isDestroyed()) last.win.focus();
}

function anyOpenWindow() {
  return [...notes.values()].some((e) => e.win && !e.win.isDestroyed() && e.win.isVisible());
}

function framelessPrefs() {
  return {
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    hasShadow: false,
    show: false,
    title: 'GTR Stickies',
    icon: makeIcon(),
    roundedCorners: true,
    minimizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

function anyNoteWindow() {
  return [...notes.values()].some((e) => e.win && !e.win.isDestroyed());
}

function ensureManagerAlive() {
  if (isQuitting) return;
  if (haltIfExpired()) return;
  if (anyNoteWindow()) return;
  if (managerWin && !managerWin.isDestroyed()) return;
  openManager();
}

function openManager() {
  if (haltIfExpired()) return;
  if (managerWin && !managerWin.isDestroyed()) {
    if (managerWin.isMinimized()) managerWin.restore();
    managerWin.show();
    managerWin.focus();
    notifyManager();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = 400;
  const height = 520;
  const x = Math.round(area.x + area.width - width - 48);
  const y = Math.round(area.y + 72);

  managerWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 320,
    minHeight: 360,
    ...framelessPrefs(),
    title: 'GTR Stickies — All notes',
  });

  managerWin.loadFile(path.join(__dirname, 'renderer', 'manager.html'));

  managerWin.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  managerWin.once('ready-to-show', () => {
    if (!managerWin || managerWin.isDestroyed()) return;
    managerWin.show();
    managerWin.focus();
  });

  managerWin.webContents.on('did-finish-load', () => {
    notifyManager();
    if (managerWin && !managerWin.isDestroyed()) {
      managerWin.webContents.send('settings:changed', publicSettings());
    }
  });

  managerWin.on('closed', () => {
    managerWin = null;
  });
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show();
    settingsWin.focus();
    settingsWin.webContents.send('settings:changed', publicSettings());
    return;
  }

  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = 380;
  const height = 560;
  const x = Math.round(area.x + area.width - width - 72);
  const y = Math.round(area.y + 96);

  settingsWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 320,
    minHeight: 400,
    ...framelessPrefs(),
  });

  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  settingsWin.once('ready-to-show', () => {
    if (!settingsWin || settingsWin.isDestroyed()) return;
    settingsWin.show();
    settingsWin.focus();
  });

  settingsWin.webContents.on('did-finish-load', () => {
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send('settings:changed', publicSettings());
    }
  });

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

function boardItemId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function stableLiveId(type, title, due, course) {
  const key = [type, title, due, course]
    .map((s) => String(s || '').trim().toLowerCase())
    .join('|');
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'live_' + (h >>> 0).toString(36);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function localYmd(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function parseLooseDue(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    if (iso[4] == null) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:${iso[6] || '00'}`;
  }
  const md = s.match(
    /^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i
  );
  if (md) {
    let a = Number(md[1]);
    let b = Number(md[2]);
    let y = Number(md[3]);
    if (y < 100) y += 2000;
    let day;
    let month;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return s;
    let hh = md[4] != null ? Number(md[4]) : null;
    const mm = md[5] != null ? Number(md[5]) : 0;
    const ampm = String(md[7] || '').toLowerCase();
    if (hh != null && ampm === 'pm' && hh < 12) hh += 12;
    if (hh != null && ampm === 'am' && hh === 12) hh = 0;
    if (hh == null) return `${y}-${pad2(month)}-${pad2(day)}`;
    return `${y}-${pad2(month)}-${pad2(day)}T${pad2(hh)}:${pad2(mm)}:00`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return (
      d.getFullYear() +
      '-' +
      pad2(d.getMonth() + 1) +
      '-' +
      pad2(d.getDate()) +
      'T' +
      pad2(d.getHours()) +
      ':' +
      pad2(d.getMinutes()) +
      ':00'
    );
  }
  return s;
}

function parseDueDate(raw) {
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
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeBoardType(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'assignment' || s === 'quiz' || s === 'test' || s === 'reminder' || s === 'presentation') return s;
  if (/unit\s*test|exam|midterm|final/.test(s)) return 'test';
  if (/quiz/.test(s)) return 'quiz';
  if (/present|\bppt\b|slides/.test(s)) return 'presentation';
  if (/remind/.test(s)) return 'reminder';
  if (/assign|homework|\bhw\b/.test(s)) return 'assignment';
  return 'assignment';
}

function normalizeBoardItem(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const type = normalizeBoardType(src.type);
  const title = typeof src.title === 'string' ? src.title.trim().slice(0, 160) : '';
  const due = parseLooseDue(src.due == null ? '' : src.due);
  const course = typeof src.course === 'string' ? src.course.trim().slice(0, 80) : '';
  const notes = typeof src.notes === 'string' ? src.notes.slice(0, 800) : '';
  const id = typeof src.id === 'string' && src.id.trim() ? src.id.trim().slice(0, 80) : boardItemId();
  return {
    id,
    type,
    title,
    due,
    course,
    notes,
    done: !!src.done,
    personal: !!src.personal,
    source: src.source === 'live' ? 'live' : 'local',
  };
}

const DEFAULT_BOARD_SCHEDULE = [
  { day: 0, start: '19:00', end: '20:30', title: 'Business Research Methods', lecturer: 'Rashid' },
  { day: 2, start: '19:00', end: '20:30', title: 'Business Research Methods', lecturer: 'Rashid' },
  { day: 0, start: '20:30', end: '22:00', title: 'Business Law', lecturer: 'Hawwa Shazna' },
  { day: 2, start: '20:30', end: '22:00', title: 'Business Law', lecturer: 'Hawwa Shazna' },
  { day: 4, start: '19:00', end: '20:30', title: 'Project Management', lecturer: 'Rashid' },
  { day: 6, start: '19:00', end: '20:30', title: 'Project Management', lecturer: 'Rashid' },
  { day: 4, start: '20:30', end: '22:00', title: 'Business Economics', lecturer: 'Anoop' },
  { day: 6, start: '20:30', end: '22:00', title: 'Business Economics', lecturer: 'Anoop' },
];

function parseDayToken(value) {
  if (typeof value === 'number' && value >= 0 && value <= 6) return value;
  const map = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
  const key = String(value || '').trim().toLowerCase();
  if (key in map) return map[key];
  const n = Number(key);
  return n >= 0 && n <= 6 ? n : null;
}

function normalizeSchedule(raw) {
  const src = Array.isArray(raw) ? raw : DEFAULT_BOARD_SCHEDULE;
  const out = [];
  src.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 80) : '';
    const lecturer = typeof item.lecturer === 'string' ? item.lecturer.trim().slice(0, 60) : '';
    const start = String(item.start || '').trim();
    const end = String(item.end || '').trim();
    if (!start || !title) return;
    const dayList = Array.isArray(item.days) ? item.days : [item.day];
    const days = [];
    dayList.forEach((d) => {
      const parsed = parseDayToken(d);
      if (parsed != null && days.indexOf(parsed) < 0) days.push(parsed);
    });
    days.forEach((day) => out.push({ day, start, end, title, lecturer }));
  });
  return out.length ? out : DEFAULT_BOARD_SCHEDULE.map((s) => Object.assign({}, s));
}

function emptyBoard() {
  return {
    version: 1,
    course: (settings && settings.boardCourse) || 'Business Law',
    liveUrl: '',
    updatedAt: Date.now(),
    items: [],
    notified: {},
    theme: 'paper',
    compact: false,
    font: 'sans',
    size: 'm',
    clock24: false,
    schedule: DEFAULT_BOARD_SCHEDULE.map((s) => Object.assign({}, s)),
    liveMeta: {},
  };
}

function normalizeBoard(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const next = emptyBoard();
  if (typeof src.course === 'string' && src.course.trim()) next.course = src.course.trim().slice(0, 80);
  if (typeof src.liveUrl === 'string') next.liveUrl = src.liveUrl.trim();
  const themes = ['paper', 'aero', 'glow', 'midnight', 'campus'];
  next.theme = themes.includes(src.theme) ? src.theme : 'paper';
  next.compact = !!src.compact;
  const fonts = ['sans', 'display', 'serif', 'ui', 'hand'];
  next.font = fonts.includes(src.font) ? src.font : 'sans';
  const sizes = ['s', 'm', 'l'];
  next.size = sizes.includes(src.size) ? src.size : 'm';
  next.clock24 = !!src.clock24;
  if (typeof src.winW === "number" && src.winW >= 300) next.winW = Math.round(src.winW);
  if (typeof src.winH === "number" && src.winH >= 280) next.winH = Math.round(src.winH);
  next.schedule = Object.prototype.hasOwnProperty.call(src, "schedule")
    ? normalizeSchedule(src.schedule)
    : DEFAULT_BOARD_SCHEDULE.map((s) => Object.assign({}, s));
  next.updatedAt = typeof src.updatedAt === 'number' && Number.isFinite(src.updatedAt) ? src.updatedAt : Date.now();
  next.notified = src.notified && typeof src.notified === 'object' && !Array.isArray(src.notified) ? src.notified : {};
  next.liveMeta = src.liveMeta && typeof src.liveMeta === 'object' && !Array.isArray(src.liveMeta) ? src.liveMeta : {};
  const items = Array.isArray(src.items) ? src.items : [];
  next.items = items.map(normalizeBoardItem).filter((it) => it.title);
  return next;
}

function persistBoard() {
  if (!boardPath) return;
  try {
    const out = {
      version: 1,
      course: board.course || 'Business Law',
      liveUrl: board.liveUrl || '',
      theme: board.theme || 'paper',
      compact: !!board.compact,
      font: board.font || 'sans',
      size: board.size || 'm',
      clock24: !!board.clock24,
      winW: board.winW || 0,
      winH: board.winH || 0,
      schedule: normalizeSchedule(board.schedule),
      updatedAt: board.updatedAt || Date.now(),
      items: (board.items || []).map((it) => ({
        id: it.id,
        type: it.type,
        title: it.title,
        due: it.due || '',
        course: it.course || '',
        notes: it.notes || '',
        done: !!it.done,
        personal: !!it.personal,
        source: it.source === 'live' ? 'live' : 'local',
      })),
      notified: board.notified && typeof board.notified === 'object' ? board.notified : {},
      liveMeta: board.liveMeta && typeof board.liveMeta === 'object' ? board.liveMeta : {},
    };
    fs.mkdirSync(path.dirname(boardPath), { recursive: true });
    fs.writeFileSync(boardPath, JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Failed to persist board:', err);
  }
}

function publicBoard() {
  return {
    version: 1,
    course: board.course || 'Business Law',
    liveUrl: board.liveUrl || '',
    theme: board.theme || 'paper',
    compact: !!board.compact,
    font: board.font || 'sans',
    size: board.size || 'm',
    clock24: !!board.clock24,
    winW: board.winW || 0,
    winH: board.winH || 0,
    schedule: Array.isArray(board.schedule) ? board.schedule.map((s) => Object.assign({}, s)) : [],
    updatedAt: board.updatedAt || 0,
    items: (board.items || []).map((it) => ({ ...it })),
    appVersion: displayVersion(),
    liveError,
    liveRefreshing,
    hasHiddenLive: Object.values(board.liveMeta && typeof board.liveMeta === 'object' ? board.liveMeta : {}).some((m) => m && m.hidden),
  };
}

function broadcastBoard() {
  const payload = publicBoard();
  if (boardWin && !boardWin.isDestroyed()) {
    boardWin.webContents.send('board:changed', payload);
  }
}

function loadBoard() {
  board = normalizeBoard(loadJson(boardPath, null));
  if (!board.liveUrl && settings.boardLiveUrl) {
    board.liveUrl = String(settings.boardLiveUrl).trim();
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  const s = String(text || '').replace(/^\uFEFF/, '');
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => String(c).trim() !== '')) rows.push(row);
  return rows;
}

function parseCsvItems(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((c) => String(c || '').trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  let typeI = col('type');
  let titleI = col('title');
  let dueI = col('due');
  let courseI = col('course');
  let notesI = col('notes');
  let start = 1;
  if (titleI < 0) {
    typeI = 0;
    titleI = 1;
    dueI = 2;
    courseI = 3;
    notesI = 4;
    start = 0;
  }
  const items = [];
  for (let r = start; r < rows.length; r++) {
    const row = rows[r];
    const title = String(row[titleI] || '').trim();
    if (!title) continue;
    const type = normalizeBoardType(row[typeI]);
    const due = parseLooseDue(row[dueI]);
    const course = String((courseI >= 0 ? row[courseI] : '') || '').trim();
    const notes = String((notesI >= 0 ? row[notesI] : '') || '').trim();
    items.push({
      id: stableLiveId(type, title, due, course),
      type,
      title,
      due,
      course,
      notes,
      done: false,
      personal: false,
      source: 'live',
    });
  }
  return items;
}

function parseBoardFeed(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return { items: [] };
  if (raw[0] === '{' || raw[0] === '[') {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('invalid json');
    }
    if (Array.isArray(data)) return { items: data };
    if (data && typeof data === 'object') {
      return {
        course: typeof data.course === 'string' ? data.course : '',
        items: Array.isArray(data.items) ? data.items : [],
      };
    }
    return { items: [] };
  }
  return { items: parseCsvItems(raw) };
}

function fetchText(urlString, redirects) {
  const hops = redirects == null ? 0 : redirects;
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      reject(new Error('invalid url'));
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error('only http(s)'));
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      urlString,
      {
        timeout: 20000,
        headers: {
          'User-Agent': 'GTR-Stickies/2.2',
          Accept: 'text/csv, application/json, text/plain, */*',
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (hops >= 5) {
            reject(new Error('too many redirects'));
            return;
          }
          let next;
          try {
            next = new URL(res.headers.location, urlString).toString();
          } catch {
            reject(new Error('bad redirect'));
            return;
          }
          fetchText(next, hops + 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error('http ' + status));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > 8 * 1024 * 1024) {
            req.destroy();
            reject(new Error('too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}


function liveFingerprint(item) {
  const title = String((item && item.title) || '').trim().toLowerCase();
  const type = String((item && item.type) || '').trim().toLowerCase();
  const course = String((item && item.course) || '').trim().toLowerCase();
  const due = parseDueDate(item && item.due);
  const day = due ? localYmd(due) : String((item && item.due) || '').trim().toLowerCase();
  return [type, title, course, day].join('|');
}

function rememberLiveMeta(item, patch) {
  if (!item) return;
  if (!board.liveMeta || typeof board.liveMeta !== 'object') board.liveMeta = {};
  const keys = [item.id, liveFingerprint(item)].filter(Boolean);
  keys.forEach((key) => {
    const prev = board.liveMeta[key] && typeof board.liveMeta[key] === 'object' ? board.liveMeta[key] : {};
    board.liveMeta[key] = { ...prev, ...patch };
  });
}

function liveMetaFor(item) {
  if (!board.liveMeta || typeof board.liveMeta !== 'object') return {};
  const a = board.liveMeta[item.id];
  const b = board.liveMeta[liveFingerprint(item)];
  return { ...(b && typeof b === 'object' ? b : {}), ...(a && typeof a === 'object' ? a : {}) };
}

function mergeLiveItems(incomingRaw) {
  const incoming = (incomingRaw || [])
    .map((raw) => {
      const item = normalizeBoardItem(raw);
      if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) {
        item.id = stableLiveId(item.type, item.title, item.due, item.course);
      }
      item.source = 'live';
      item.personal = false;
      return item;
    })
    .filter((i) => i.title);

  const existing = board.items || [];
  const keyOf = (x) => String(x.title || '').trim().toLowerCase() + '|' + String(x.due || '');
  function doneFor(item) {
    const meta = liveMetaFor(item);
    if (meta.done === true) return true;
    if (meta.done === false) return false;
    const byId = existing.find((x) => x.id === item.id);
    if (byId) return !!byId.done;
    const byKey = existing.find((x) => keyOf(x) === keyOf(item));
    return byKey ? !!byKey.done : false;
  }

  const personal = existing.filter((x) => x.personal);
  const localClass = existing.filter((x) => !x.personal && x.source !== 'live');
  const incomingIds = new Set(incoming.map((i) => i.id));
  const keptLocal = localClass.filter((x) => !incomingIds.has(x.id));
  const live = incoming
    .filter((item) => !liveMetaFor(item).hidden)
    .map((item) => ({
      ...item,
      done: doneFor(item),
      source: 'live',
      personal: false,
    }));
  board.items = [...personal, ...keptLocal, ...live];
  board.updatedAt = Date.now();
}

function mergeImportedItems(incomingRaw, incomingMeta) {
  const incoming = (incomingRaw || [])
    .map(normalizeBoardItem)
    .filter((i) => i.title && !i.personal);
  const byId = new Map((board.items || []).map((i) => [i.id, i]));
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (existing && existing.personal) continue;
    byId.set(item.id, {
      ...item,
      done: existing ? !!existing.done : !!item.done,
      personal: false,
      source: 'local',
    });
  }
  board.items = [...byId.values()];
  if (incomingMeta && typeof incomingMeta.course === 'string' && incomingMeta.course.trim()) {
    if (!board.course) board.course = incomingMeta.course.trim();
  }
  board.updatedAt = Date.now();
}

async function refreshLiveBoard() {
  if (appYearExpired()) return { ok: false, error: 'expired' };
  const url = String(board.liveUrl || '').trim();
  if (!url) {
    liveError = null;
    liveRefreshing = false;
    broadcastBoard();
    return { ok: true };
  }
  liveRefreshing = true;
  liveError = null;
  broadcastBoard();
  try {
    const text = await fetchText(url);
    const feed = parseBoardFeed(text);
    mergeLiveItems(feed.items || []);
    if (feed.course && !board.course) board.course = feed.course;
    liveError = null;
    persistBoard();
    liveRefreshing = false;
    broadcastBoard();
    const liveCount = (board.items || []).filter((i) => i.source === 'live').length;
    const incomingCount = (feed.items || []).length;
    return { ok: true, skippedHidden: incomingCount > 0 && liveCount === 0 };
  } catch (err) {
    liveError = String((err && err.message) || 'fetch failed');
    liveRefreshing = false;
    broadcastBoard();
    return { ok: false, error: 'Couldn’t refresh the dashboard.' };
  }
}

async function restoreLiveBoard() {
  board.liveMeta = {};
  persistBoard();
  const result = await refreshLiveBoard();
  if (result && result.ok) result.restored = true;
  return result;
}

function resetLiveDeletes() {
  board.liveMeta = {};
  persistBoard();
  broadcastBoard();
  return { ok: true };
}

function sanitizeLiveUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  return u.toString();
}

function applyLiveUrl(url, opts) {
  const next = sanitizeLiveUrl(url);
  if (next === null) return { ok: false, error: 'Use an http(s) URL.' };
  board.liveUrl = next;
  if (!opts || !opts.fromSettings) {
    settings.boardLiveUrl = next;
    persistSettings();
    broadcastSettings();
  }
  persistBoard();
  broadcastBoard();
  if (next) {
    refreshLiveBoard().catch(() => {});
  }
  return { ok: true };
}

function addBoardItem(partial) {
  const item = normalizeBoardItem(partial);
  item.id = boardItemId();
  item.source = 'local';
  item.done = false;
  if (partial && typeof partial.personal === 'boolean') {
    item.personal = partial.personal;
  } else {
    item.personal = item.type === 'reminder';
  }
  if (!item.title) return { ok: false, error: 'Title is required.' };
  if (!item.course) item.course = board.course || settings.boardCourse || 'Business Law';
  board.course = item.course;
  board.items.push(item);
  board.updatedAt = Date.now();
  persistBoard();
  broadcastBoard();
  return { ok: true, item };
}

function updateBoardItem(partial) {
  if (!partial || typeof partial.id !== 'string') return { ok: false, error: 'Missing item.' };
  const item = (board.items || []).find((i) => i.id === partial.id);
  if (!item) return { ok: false, error: 'Missing item.' };
  const prevDue = item.due;
  const next = normalizeBoardItem({ ...item, ...partial, id: item.id });
  next.done = typeof partial.done === 'boolean' ? partial.done : item.done;
  next.personal = typeof partial.personal === 'boolean' ? partial.personal : item.personal;
  next.source = item.source;
  if (!next.title) return { ok: false, error: 'Title is required.' };
  Object.assign(item, next);
  if (item.course) board.course = item.course;
  if (item.due !== prevDue && board.notified) delete board.notified[item.id];
  board.updatedAt = Date.now();
  persistBoard();
  broadcastBoard();
  return { ok: true, item };
}

function deleteBoardItem(id) {
  if (typeof id !== 'string' || !id) return { ok: false };
  const gone = (board.items || []).find((i) => i.id === id);
  if (gone && gone.source === 'live') rememberLiveMeta(gone, { hidden: true });
  board.items = (board.items || []).filter((i) => i.id !== id);
  if (board.notified) delete board.notified[id];
  board.updatedAt = Date.now();
  persistBoard();
  broadcastBoard();
  return { ok: true };
}

function toggleBoardItem(id, done) {
  const item = (board.items || []).find((i) => i.id === id);
  if (!item) return { ok: false };
  item.done = !!done;
  if (item.source === 'live') rememberLiveMeta(item, { done: !!done, hidden: false });
  board.updatedAt = Date.now();
  persistBoard();
  broadcastBoard();
  return { ok: true, item };
}

function fireBoardNote(body) {
  try {
    if (!Notification.isSupported()) return;
    const n = new Notification({
      title: 'GTR Stickies',
      body,
      silent: false,
      icon: makeIcon(),
    });
    n.show();
  } catch (err) {
    console.error('Board notification failed:', err);
  }
}

function checkBoardNotifications() {
  const now = Date.now();
  const today = localYmd(new Date());
  let changed = false;
  if (!board.notified || typeof board.notified !== 'object') board.notified = {};
  for (const item of board.items || []) {
    if (item.done || !item.title) continue;
    const due = parseDueDate(item.due);
    if (!due) continue;
    const rec = board.notified[item.id] && typeof board.notified[item.id] === 'object' ? board.notified[item.id] : {};
    const delta = due.getTime() - now;
    const dueToday = localYmd(due) === today;
    if (delta <= 60 * 60 * 1000 && delta >= -5 * 60 * 1000) {
      const windowKey = String(item.due || '') + '|' + localYmd(due);
      if (rec.soonFor !== windowKey) {
        fireBoardNote((item.title || 'Deadline') + ' is due soon');
        rec.soonFor = windowKey;
        board.notified[item.id] = rec;
        changed = true;
      }
    } else if (dueToday && rec.morningOn !== today) {
      fireBoardNote('Due today · ' + item.title);
      rec.morningOn = today;
      board.notified[item.id] = rec;
      changed = true;
    }
  }
  if (changed) persistBoard();
}

function startBoardTimers() {
  stopBoardTimers();
  notifyTimer = setInterval(() => {
    try {
      if (haltIfExpired()) return;
      checkBoardNotifications();
    } catch (err) {
      console.error(err);
    }
  }, 60 * 1000);
  liveTimer = setInterval(() => {
    if (board.liveUrl) refreshLiveBoard().catch(() => {});
  }, 5 * 60 * 1000);
  setTimeout(() => {
    try {
      checkBoardNotifications();
    } catch (_) {
      /* ignore */
    }
    if (board.liveUrl) refreshLiveBoard().catch(() => {});
  }, 2500);
}

function stopBoardTimers() {
  if (notifyTimer) {
    clearInterval(notifyTimer);
    notifyTimer = null;
  }
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
}

function boardParentWin() {
  if (boardWin && !boardWin.isDestroyed()) return boardWin;
  if (managerWin && !managerWin.isDestroyed()) return managerWin;
  return undefined;
}

function exportClassBoard() {
  const payload = {
    version: 1,
    course: board.course || 'Business Law',
    updatedAt: Date.now(),
    schedule: normalizeSchedule(board.schedule),
    items: (board.items || [])
      .filter((it) => !it.personal)
      .map((it) => ({
        id: it.id,
        type: it.type,
        title: it.title,
        due: it.due || '',
        course: it.course || '',
        notes: it.notes || '',
        done: false,
        personal: false,
        source: 'local',
      })),
  };
  return payload;
}

async function exportBoardDialog() {
  const parent = boardParentWin();
  const opts = {
    title: 'Export dashboard',
    defaultPath: 'GTR-Dashboard.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const result = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts);
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(exportClassBoard(), null, 2));
    return { ok: true, path: result.filePath };
  } catch (err) {
    console.error('Export board failed:', err);
    return { ok: false, error: 'Couldn’t save that file.' };
  }
}

async function importBoardDialog() {
  const parent = boardParentWin();
  const opts = {
    title: 'Import class board',
    properties: ['openFile'],
    filters: [
      { name: 'Board', extensions: ['json', 'csv'] },
      { name: 'All files', extensions: ['*'] },
    ],
  };
  const result = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { ok: false, canceled: true };
  }
  try {
    const text = fs.readFileSync(result.filePaths[0], 'utf8');
    const feed = parseBoardFeed(text);
    mergeImportedItems(feed.items || [], feed);
    persistBoard();
    broadcastBoard();
    return { ok: true };
  } catch (err) {
    console.error('Import board failed:', err);
    return { ok: false, error: 'Couldn’t read that board file.' };
  }
}

function openBoard() {
  if (haltIfExpired()) return;
  if (boardWin && !boardWin.isDestroyed()) {
    if (boardWin.isMinimized()) boardWin.restore();
    boardWin.show();
    boardWin.focus();
    broadcastBoard();
    if (board.liveUrl) refreshLiveBoard().catch(() => {});
    return;
  }

  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = Math.max(320, Math.round(board.winW) || 380);
  const height = Math.max(320, Math.round(board.winH) || 540);
  const x = Math.round(area.x + area.width - width - 28);
  const y = Math.round(area.y + 72);

  boardWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 300,
    minHeight: 280,
    ...framelessPrefs(),
    alwaysOnTop: false,
    skipTaskbar: true,
    title: 'Dashboard',
  });

  boardWin.setAlwaysOnTop(false);
  boardWin.loadFile(path.join(__dirname, 'renderer', 'board.html'));

  boardWin.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  boardWin.once('ready-to-show', () => {
    if (!boardWin || boardWin.isDestroyed()) return;
    boardWin.show();
    boardWin.focus();
  });

  boardWin.webContents.on('did-finish-load', () => {
    broadcastBoard();
    if (boardWin && !boardWin.isDestroyed()) {
      boardWin.webContents.send('settings:changed', publicSettings());
    }
  });

  boardWin.on('closed', () => {
    boardWin = null;
  });

  if (board.liveUrl) refreshLiveBoard().catch(() => {});
}


function buildTray() {
  const icon = makeIcon();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('GTR Stickies');
  const menu = Menu.buildFromTemplate([
    {
      label: 'New note',
      accelerator: 'CommandOrControl+N',
      click: () => spawnNote(),
    },
    {
      label: 'All notes',
      click: () => openManager(),
    },
    {
      label: 'Dashboard',
      click: () => openBoard(),
    },
    {
      label: 'Show all',
      click: () => showAll(),
    },
    {
      label: 'Settings…',
      click: () => openSettings(),
    },
    { type: 'separator' },
    {
      label: 'Quit GTR Stickies',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (notes.size === 0) spawnNote();
    else if (!anyOpenWindow()) openManager();
    else showAll();
  });
}

function wireIpc() {
  ipcMain.on('note:text', (event, text) => {
    const entry = findEntry(event.sender);
    if (!entry) return;
    entry.data.text = typeof text === 'string' ? text : '';
    entry.data.updatedAt = Date.now();
    applyWindowTitle(entry);
    persist();
  });

  ipcMain.on('note:format', (event, format) => {
    const entry = findEntry(event.sender);
    if (!entry) return;
    entry.data.format = defaultFormat({ ...entry.data.format, ...format });
    entry.data.updatedAt = Date.now();
    persist();
  });

  ipcMain.on('note:color', (event, color) => {
    const entry = findEntry(event.sender);
    if (!entry) return;
    if (COLORS.includes(color)) {
      entry.data.color = color;
      entry.data.updatedAt = Date.now();
      persist();
    }
  });

  ipcMain.on('note:pin', (event, pinned) => {
    const entry = findEntry(event.sender);
    if (!entry) return;
    const on = !!pinned;
    entry.data.pinned = on;
    entry.data.updatedAt = Date.now();
    if (entry.win && !entry.win.isDestroyed()) {
      applyNotePin(entry.win, on);
    }
    syncPinHold();
    persist();
  });

  ipcMain.on('note:presenter', (event, enabled) => {
    const entry = findEntry(event.sender);
    if (!entry) return;
    const on = !!enabled;
    entry.data.presenterMode = on;
    entry.data.updatedAt = Date.now();
    if (entry.win && !entry.win.isDestroyed()) {
      applyPresenterMode(entry.win, on);
    }
    if (!on) {
      clearPresenterPointer(entry.data.id);
      if (remoteTargetNoteId === entry.data.id) remoteTargetNoteId = null;
      try {
        entry.win && !entry.win.isDestroyed() &&
          entry.win.webContents.send('note:remote-info', { running: false });
      } catch (_) {
        /* ignore */
      }
    } else {
      remoteTargetNoteId = entry.data.id;
    }
    persist();
    syncPresenterRemote();
  });

  ipcMain.on('note:presenter-pointer', (event, inside) => {
    const entry = findEntry(event.sender);
    if (!entry || !entry.data) return;
    if (!entry.data.presenterMode) {
      clearPresenterPointer(entry.data.id);
      return;
    }
    setPresenterPointerInside(entry.data.id, !!inside);
  });

  ipcMain.on('note:close', (event, payload) => {
    const entry = findEntry(event.sender);
    if (!entry) return;
    if (payload && typeof payload.text === 'string') {
      entry.data.text = payload.text;
    }
    hideOrRemove(entry);
  });

  ipcMain.on('note:minimize', (event) => {
    minimizeNote(findEntry(event.sender));
  });

  ipcMain.on('note:toggle-fold', (event) => {
    toggleFold(findEntry(event.sender));
  });

  ipcMain.on('note:drag-start', (event, pos) => {
    const entry = findEntry(event.sender);
    if (!entry || !entry.win || entry.win.isDestroyed() || !pos) return;
    const b = entry.win.getBounds();
    const screenX = Number(pos.screenX);
    const screenY = Number(pos.screenY);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
    dragOffsets.set(entry.win.id, {
      offsetX: screenX - b.x,
      offsetY: screenY - b.y,
    });
  });

  ipcMain.on('note:drag-move', (event, pos) => {
    const entry = findEntry(event.sender);
    if (!entry || !entry.win || entry.win.isDestroyed() || !pos) return;
    const drag = dragOffsets.get(entry.win.id);
    if (!drag) return;
    const screenX = Number(pos.screenX);
    const screenY = Number(pos.screenY);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
    entry.win.setPosition(Math.round(screenX - drag.offsetX), Math.round(screenY - drag.offsetY));
  });

  ipcMain.on('note:drag-end', (event) => {
    const entry = findEntry(event.sender);
    if (!entry || !entry.win || entry.win.isDestroyed()) return;
    dragOffsets.delete(entry.win.id);
    captureBounds(entry);
    persist();
    maybeSnap(entry);
  });

  ipcMain.on('note:resize', (event, size) => {
    const entry = findEntry(event.sender);
    if (!entry || !size || !entry.win || entry.win.isDestroyed()) return;
    if (entry.data.folded) return;
    const width = Math.max(MIN_W, Math.round(size.width));
    const height = Math.max(MIN_H, Math.round(size.height));
    entry.win.setSize(width, height);
    entry.data.width = width;
    entry.data.height = height;
    entry.data.unfoldedHeight = height;
    persist();
  });

  ipcMain.on('note:new', () => spawnNote());

  ipcMain.on('manager:open', () => openManager());
  ipcMain.on('manager:close', () => {
    if (managerWin && !managerWin.isDestroyed()) managerWin.close();
  });
  ipcMain.on('manager:minimize', () => {
    if (managerWin && !managerWin.isDestroyed()) managerWin.minimize();
  });

  ipcMain.on('settings:open', () => openSettings());
  ipcMain.on('settings:close', () => {
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
  });
  ipcMain.handle('settings:get', () => publicSettings());
  ipcMain.on('settings:set', (_event, partial) => {
    saveSettings(partial && typeof partial === 'object' ? partial : {});
  });

  ipcMain.handle('notes:list', () => listForManager());

  ipcMain.on('notes:open', (_event, noteId) => {
    if (typeof noteId === 'string') showNote(noteId);
  });

  ipcMain.on('notes:delete', (_event, noteId) => {
    if (typeof noteId === 'string') deleteNote(noteId);
  });

  ipcMain.on('notes:duplicate', (_event, noteId) => {
    if (typeof noteId === 'string') duplicateNote(noteId);
  });

  ipcMain.on('notes:pin', (_event, noteId, pinned) => {
    const entry = notes.get(noteId);
    if (!entry) return;
    const on = !!pinned;
    entry.data.pinned = on;
    entry.data.updatedAt = Date.now();
    if (entry.win && !entry.win.isDestroyed()) {
      applyNotePin(entry.win, on);
    }
    syncPinHold();
    persist();
  });

  ipcMain.handle('note:add-image', async (event, payload) => {
    const entry = findEntry(event.sender);
    if (!entry) return null;
    const src = payload && typeof payload === 'object' ? payload : {};
    try {
      if (src.fromClipboard) {
        const img = clipboard.readImage();
        if (!img || img.isEmpty()) return null;
        return addImageRecord(entry, img.toPNG(), '.png');
      }
      if (typeof src.filePath === 'string' && src.filePath) {
        const ext = path.extname(src.filePath).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) return null;
        const buf = fs.readFileSync(src.filePath);
        return addImageRecord(entry, buf, ext === '.jpeg' ? '.jpg' : ext);
      }
      const buf = asBuffer(src.buffer);
      if (!buf) return null;
      const ext = extFromMime(src.mime, src.ext);
      return addImageRecord(entry, buf, ext);
    } catch (err) {
      console.error('Failed to add image:', err);
      return null;
    }
  });

  ipcMain.handle('note:pick-image', async (event) => {
    const entry = findEntry(event.sender);
    if (!entry || !entry.win || entry.win.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(entry.win, {
      title: 'Add image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) return null;
    try {
      const buf = fs.readFileSync(filePath);
      return addImageRecord(entry, buf, ext === '.jpeg' ? '.jpg' : ext);
    } catch (err) {
      console.error('Failed to pick image:', err);
      return null;
    }
  });

  ipcMain.on('note:image-transform', (event, payload) => {
    const entry = findEntry(event.sender);
    if (!entry || !payload || typeof payload.id !== 'string') return;
    if (!Array.isArray(entry.data.images)) return;
    const img = entry.data.images.find((item) => item.id === payload.id);
    if (!img) return;
    if (Number.isFinite(payload.x)) img.x = payload.x;
    if (Number.isFinite(payload.y)) img.y = payload.y;
    if (Number.isFinite(payload.width)) img.width = Math.max(48, payload.width);
    if (Number.isFinite(payload.height)) img.height = Math.max(48, payload.height);
    if (Number.isFinite(payload.z)) img.z = payload.z;
    if (Number.isFinite(payload.rotation)) {
      img.rotation = Math.max(-6, Math.min(6, payload.rotation));
    }
    entry.data.updatedAt = Date.now();
    persist();
  });

  ipcMain.handle('note:remove-image', (event, imageId) => {
    const entry = findEntry(event.sender);
    if (!entry || typeof imageId !== 'string') return false;
    const img = (entry.data.images || []).find((item) => item.id === imageId);
    if (!img) return false;
    entry.data.images = entry.data.images.filter((item) => item.id !== imageId);
    deleteImageFile(entry.data.id, img.file);
    entry.data.updatedAt = Date.now();
    persist();
    return true;
  });

  ipcMain.handle('clipboard:read-image', () => {
    try {
      const img = clipboard.readImage();
      return { hasImage: !!(img && !img.isEmpty()) };
    } catch (_) {
      return { hasImage: false };
    }
  });

  ipcMain.handle('clipboard:write-image', (event, imageId) => {
    const entry = findEntry(event.sender);
    if (!entry || typeof imageId !== 'string') return false;
    const img = (entry.data.images || []).find((item) => item.id === imageId);
    if (!img) return false;
    const fp = path.join(noteImagesDir(entry.data.id), path.basename(img.file));
    try {
      let ni = nativeImage.createFromPath(fp);
      if (ni.isEmpty()) ni = nativeImage.createFromBuffer(fs.readFileSync(fp));
      if (ni.isEmpty()) return false;
      clipboard.writeImage(ni);
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('clipboard:write-text', (_event, value) => {
    clipboard.writeText(String(value || ''));
    return true;
  });

  ipcMain.handle('clipboard:read-text', () => {
    try {
      return clipboard.readText() || '';
    } catch (_) {
      return '';
    }
  });

  ipcMain.on('note:replace-misspelling', (event, word) => {
    try {
      event.sender.replaceMisspelling(String(word || ''));
    } catch (_) {
      /* ignore */
    }
  });

  ipcMain.on('note:add-to-dictionary', (event, word) => {
    try {
      const w = String(word || '').trim();
      if (!w) return;
      event.sender.session.addWordToSpellCheckerDictionary(w);
    } catch (_) {
      /* ignore */
    }
  });

  ipcMain.handle('ocr:ready', () => tessdataReady());

  ipcMain.handle('note:snipe', async (event, payload) => {
    const entry = findEntry(event.sender);
    if (!entry || !payload || typeof payload.id !== 'string') {
      return { text: '', error: 'missing' };
    }
    const img = (entry.data.images || []).find((item) => item.id === payload.id);
    if (!img) return { text: '', error: 'missing' };
    const fp = path.join(noteImagesDir(entry.data.id), path.basename(img.file));
    if (!fs.existsSync(fp)) return { text: '', error: 'missing' };

    return runSnipe(async () => {
      try {
        const worker = await getTessWorker();
        let source = fp;
        let rectangle = null;
        const crop = payload.crop;
        if (
          crop &&
          Number.isFinite(crop.x) &&
          Number.isFinite(crop.y) &&
          Number.isFinite(crop.w) &&
          Number.isFinite(crop.h) &&
          crop.w > 2 &&
          crop.h > 2
        ) {
          const left = Math.max(0, Math.round(crop.x));
          const top = Math.max(0, Math.round(crop.y));
          const width = Math.max(1, Math.round(crop.w));
          const height = Math.max(1, Math.round(crop.h));
          try {
            const ni = nativeImage.createFromPath(fp);
            if (!ni.isEmpty()) {
              const size = ni.getSize();
              const x = Math.min(size.width - 1, left);
              const y = Math.min(size.height - 1, top);
              const w = Math.max(1, Math.min(size.width - x, width));
              const h = Math.max(1, Math.min(size.height - y, height));
              if (w > 2 && h > 2) {
                source = ni.crop({ x, y, width: w, height: h }).toPNG();
              }
            } else {
              rectangle = { left, top, width, height };
            }
          } catch (_) {
            rectangle = { left, top, width, height };
          }
        }
        const result = rectangle
          ? await worker.recognize(source, { rectangle })
          : await worker.recognize(source);
        return { text: String((result.data && result.data.text) || '').trim() };
      } catch (err) {
        console.error('Snipe failed:', err);
        return { text: '', error: 'snipe' };
      }
    });
  });

  ipcMain.on('board:resize', (_event, size) => {
    if (!boardWin || boardWin.isDestroyed() || !size) return;
    const width = Math.max(300, Math.round(size.width));
    const height = Math.max(280, Math.round(size.height));
    boardWin.setSize(width, height);
    board.winW = width;
    board.winH = height;
    board.updatedAt = Date.now();
    persistBoard();
  });
  ipcMain.on('board:open', () => openBoard());
  ipcMain.on('board:close', () => {
    if (boardWin && !boardWin.isDestroyed()) boardWin.close();
  });
  ipcMain.on('board:minimize', () => {
    if (boardWin && !boardWin.isDestroyed()) boardWin.hide();
  });
  ipcMain.handle('board:get', () => publicBoard());
  ipcMain.handle('board:save', (_event, partial) => {
    const src = partial && typeof partial === 'object' ? partial : {};
    let dirty = false;
    if (typeof src.course === 'string' && src.course.trim()) {
      board.course = src.course.trim().slice(0, 80);
      dirty = true;
    }
    const themes = ['paper', 'aero', 'glow', 'midnight', 'campus'];
    if (typeof src.theme === 'string' && themes.includes(src.theme)) {
      board.theme = src.theme;
      dirty = true;
    }
    if (typeof src.compact === 'boolean') {
      board.compact = src.compact;
      dirty = true;
    }
    const fonts = ['sans', 'display', 'serif', 'ui', 'hand'];
    if (typeof src.font === 'string' && fonts.includes(src.font)) {
      board.font = src.font;
      dirty = true;
    }
    const sizes = ['s', 'm', 'l'];
    if (typeof src.size === 'string' && sizes.includes(src.size)) {
      board.size = src.size;
      dirty = true;
    }
    if (typeof src.clock24 === 'boolean') {
      board.clock24 = src.clock24;
      dirty = true;
    }
    if (Object.prototype.hasOwnProperty.call(src, 'schedule')) {
      board.schedule = normalizeSchedule(src.schedule);
      dirty = true;
    }
    if (dirty) {
      board.updatedAt = Date.now();
      persistBoard();
      broadcastBoard();
    }
    if (Object.prototype.hasOwnProperty.call(src, 'liveUrl')) {
      return applyLiveUrl(src.liveUrl);
    }
    return publicBoard();
  });
  ipcMain.handle('board:add', (_event, item) => addBoardItem(item));
  ipcMain.handle('board:update', (_event, item) => updateBoardItem(item));
  ipcMain.handle('board:delete', (_event, id) => deleteBoardItem(id));
  ipcMain.handle('board:toggle', (_event, id, done) => toggleBoardItem(id, done));
  ipcMain.handle('board:export', () => exportBoardDialog());
  ipcMain.handle('board:import', () => importBoardDialog());
  ipcMain.handle('board:set-live-url', (_event, url) => applyLiveUrl(url));
  ipcMain.handle('board:refresh-live', () => refreshLiveBoard());
  ipcMain.handle('board:restore-live', () => restoreLiveBoard());
  ipcMain.handle('board:reset-live-deletes', () => resetLiveDeletes());
  ipcMain.on('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch('no-sandbox');
  app.disableHardwareAcceleration();
}

app.setName('GTR Stickies');
if (process.platform === 'win32') {
  try {
    app.setAppUserModelId('GTR.Stickies');
  } catch (_) {
    /* ignore */
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (haltIfExpired()) return;
    if (notes.size === 0) spawnNote();
    else if (!anyOpenWindow()) openManager();
    else showAll();
  });

  app.whenReady().then(() => {
    notesPath = path.join(app.getPath('userData'), 'notes.json');
    settingsPath = path.join(app.getPath('userData'), 'settings.json');
    imagesDir = path.join(app.getPath('userData'), 'images');
    tessdataDir = path.join(app.getPath('userData'), 'tessdata');
    boardPath = path.join(app.getPath('userData'), 'board.json');
    try {
      fs.mkdirSync(imagesDir, { recursive: true });
      fs.mkdirSync(tessdataDir, { recursive: true });
    } catch (_) {
      /* ignore */
    }
    loadSettings();
    loadBoard();
    wireIpc();
    if (haltIfExpired()) return;
    buildTray();
    // Hidden window so the process stays alive when every note is closed.
    new BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      frame: false,
      skipTaskbar: true,
      transparent: true,
      focusable: false,
    });
    restoreOrSeed();
    /* presenter remote after restore */
    syncPresenterRemote();
    startBoardTimers();
    if (settings.openBoardOnLaunch) openBoard();

    globalShortcut.register('CommandOrControl+Shift+N', () => {
      if (haltIfExpired()) return;
      spawnNote();
    });

    app.on('activate', () => {
      if (haltIfExpired()) return;
      if (notes.size === 0) spawnNote();
      else if (!anyOpenWindow()) openManager();
      else showAll();
    });
  });
}

app.on('window-all-closed', () => {
  // Stay alive via the tray so New note remains available.
});

app.on('before-quit', () => {
  isQuitting = true;
  persist();
  persistSettings();
  persistBoard();
  stopBoardTimers();
  if (pinHoldTimer) {
    clearInterval(pinHoldTimer);
    pinHoldTimer = null;
  }
  presenterPointerNotes.clear();
  showSystemCursor();
  try {
    if (presenterRemote) presenterRemote.stop();
  } catch (_) {
    /* ignore */
  }
  globalShortcut.unregisterAll();
  terminateTess();
});
