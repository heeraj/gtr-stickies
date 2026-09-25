const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petal', {
  onInit: (callback) => {
    ipcRenderer.on('note:init', (_event, data) => callback(data));
  },
  onMeta: (callback) => {
    ipcRenderer.on('note:meta', (_event, data) => callback(data));
  },
  updateText: (text) => ipcRenderer.send('note:text', text),
  updateFormat: (format) => ipcRenderer.send('note:format', format),
  setColor: (color) => ipcRenderer.send('note:color', color),
  setPinned: (pinned) => ipcRenderer.send('note:pin', pinned),
  setPresenterMode: (on) => ipcRenderer.send('note:presenter', on),
  setPresenterPointer: (inside) => ipcRenderer.send('note:presenter-pointer', !!inside),
  close: (payload) => ipcRenderer.send('note:close', payload || {}),
  minimize: () => ipcRenderer.send('note:minimize'),
  toggleFold: () => ipcRenderer.send('note:toggle-fold'),
  dragStart: (pos) => ipcRenderer.send('note:drag-start', pos),
  dragMove: (pos) => ipcRenderer.send('note:drag-move', pos),
  dragEnd: () => ipcRenderer.send('note:drag-end'),
  onRequestClose: (callback) => {
    ipcRenderer.on('note:request-close', () => callback());
  },
  resize: (width, height) => ipcRenderer.send('note:resize', { width, height }),
  newNote: () => ipcRenderer.send('note:new'),
  openManager: () => ipcRenderer.send('manager:open'),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  onNotesChanged: (callback) => {
    ipcRenderer.on('notes:changed', (_event, list) => callback(list));
  },
  openNote: (id) => ipcRenderer.send('notes:open', id),
  deleteNote: (id) => ipcRenderer.send('notes:delete', id),
  duplicateNote: (id) => ipcRenderer.send('notes:duplicate', id),
  pinNote: (id, pinned) => ipcRenderer.send('notes:pin', id, pinned),
  closeManager: () => ipcRenderer.send('manager:close'),
  minimizeManager: () => ipcRenderer.send('manager:minimize'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial) => ipcRenderer.send('settings:set', partial),
  openSettings: () => ipcRenderer.send('settings:open'),
  closeSettings: () => ipcRenderer.send('settings:close'),
  onSettings: (callback) => {
    ipcRenderer.on('settings:changed', (_event, data) => callback(data));
  },
  addImage: (payload) => ipcRenderer.invoke('note:add-image', payload),
  pickImage: () => ipcRenderer.invoke('note:pick-image'),
  transformImage: (payload) => ipcRenderer.send('note:image-transform', payload),
  removeImage: (id) => ipcRenderer.invoke('note:remove-image', id),
  snipe: (payload) => ipcRenderer.invoke('note:snipe', payload),
  tessReady: () => ipcRenderer.invoke('ocr:ready'),
  readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
  writeClipboardImage: (id) => ipcRenderer.invoke('clipboard:write-image', id),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text'),
  onSpellContext: (callback) => {
    ipcRenderer.on('note:spell-context', (_event, data) => callback(data));
  },
  replaceMisspelling: (word) => ipcRenderer.send('note:replace-misspelling', word),
  addToDictionary: (word) => ipcRenderer.send('note:add-to-dictionary', word),
  openBoard: () => ipcRenderer.send('board:open'),
  closeBoard: () => ipcRenderer.send('board:close'),
  minimizeBoard: () => ipcRenderer.send('board:minimize'),
  getBoard: () => ipcRenderer.invoke('board:get'),
  saveBoard: (partial) => ipcRenderer.invoke('board:save', partial),
  addBoardItem: (item) => ipcRenderer.invoke('board:add', item),
  updateBoardItem: (item) => ipcRenderer.invoke('board:update', item),
  deleteBoardItem: (id) => ipcRenderer.invoke('board:delete', id),
  toggleBoardItem: (id, done) => ipcRenderer.invoke('board:toggle', id, done),
  exportBoard: () => ipcRenderer.invoke('board:export'),
  importBoard: () => ipcRenderer.invoke('board:import'),
  setLiveUrl: (url) => ipcRenderer.invoke('board:set-live-url', url),
  refreshLive: () => ipcRenderer.invoke('board:refresh-live'),
  restoreLive: () => ipcRenderer.invoke('board:restore-live'),
  resetLiveDeletes: () => ipcRenderer.invoke('board:reset-live-deletes'),
  resizeBoard: (width, height) => ipcRenderer.send('board:resize', { width, height }),
  onBoardChanged: (callback) => {
    ipcRenderer.on('board:changed', (_event, data) => callback(data));
  },
  quitApp: () => ipcRenderer.send('app:quit'),
});
