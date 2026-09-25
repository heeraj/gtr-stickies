# GTR Stickies

Little thoughts, always on top. Version 3.0.

GTR Stickies is a warm, frameless desktop sticky-notes app with a class Dashboard. Developed by Mohamed Asjau. Contact: mail.asjau@gmail.com. Notes sit on your screen like scraps of paper -- cream, blush, sage, sky, and lavender -- with a quiet top bar, a tray for new notes, and local persistence. The All notes window is the home of the app.

Privacy: see [PRIVACY.md](PRIVACY.md).

GTR Stickies 3.0 is an early build and may contain bugs. Developed by Mohamed Asjau. Contact: mail.asjau@gmail.com.

## How to run

Requires Node.js 18+ and a graphical session (Windows / macOS / X11 / Wayland).

Windows (Command Prompt or PowerShell), from this folder:

    npm.cmd install
    npm.cmd start

macOS / Linux:

    npm install
    npm start

That pulls `electron` and `tesseract.js`. The script is in package.json.

## Use

- The app opens to All notes. Notes stay in the list until you open one. Click a row or its Open control to put that note on the desk. Subtitles read On desk, Hidden, or Minimized.
- Drag the empty top bar (or the GTR wordmark) to move a note. Double-click that same wide bar to fold the note into a slim strip; double-click again to restore. Ctrl+` or Ctrl+Shift+F also folds the focused note. Chrome buttons never fold or drag the window.
- Click the body to write. Empty notes show a quiet italic placeholder.
- Format bar: font and line spacing apply to the note; size and ink color apply to the selected text only (like Word). Color is a compact dropdown (Brown, Black, Red, Green, Blue, Cream). Bold / italic / underline / strike (Ctrl/Cmd+B, I, U, Ctrl+Shift+X), yellow/peach highlight plus Remove highlight, bullets, and a checklist on the current line. Left/center align and a droplet slider for paper transparency (55%-100%).
- Right-click a word for spelling suggestions (including British/US variants like behaviour/behavior) and Add to dictionary; spellcheck uses en-GB and en-US; undo/redo (Ctrl+Z / Ctrl+Y) also reverse color, size, highlight, and clear formatting. The paper menu keeps cut/copy/paste (including paste without formatting, Ctrl+Shift+V), select all, bold/italic/underline/strike, highlight, ink color, size (12-28), and clear formatting when a word or selection is active; lists stay on the format bar only. Right-click empty paper for paste, select all, undo/redo, and paste image. Image right-click still snipes. Ctrl+F opens a slim find strip; match marks are temporary and never saved into notes.json. All notes rows have a matching right-click menu (open, pin, duplicate, copy title, delete).
- Pin keeps the note always on top (on by default, or as set in Settings).
- Presenter mode (eye-off button next to Pin): for Meet **window** share of slides, hides the Windows system cursor (via ShowCursor) while the pointer is over the note paper so the shared preview does not show a ghost cursor; CSS also hides the in-note cursor on the script. Content protection is enabled as a bonus for full-screen / display capture. Wheel-scroll still works; chrome buttons restore a normal cursor so you can exit Presenter.
- Color dots change the paper.
- Minimize sends a note to the Windows taskbar (it stays listed in All notes). Click the taskbar item, or use All notes / tray Show all, to restore. Close hides a note that has text. Empty notes are discarded (optional confirm).
- All notes is the main menu: search, open, pin, duplicate, delete, plus a header minimize that also stays on the taskbar. The Dashboard button (calendar) sits next to +. Gear opens Settings. If every note window is closed, All notes stays available (the app does not quit).
- The plus button or Ctrl/Cmd+N (with a note focused) creates a new note. Ctrl/Cmd+Shift+N works globally.
- Resize from the bottom-right corner grip.
- Paste a screenshot or photo (Ctrl/Cmd+V) onto a note to drop it as a floating sticker. Drag-drop image files, or use the small photo button on the format bar. Drag to move, corner handle to resize. Right-click a sticker: **Snipe text** (OCR the whole photo), **Snipe region**, copy, restack, or remove. First snipe may download the English lens into userData; later snipes are local.

Closing the last note does not quit the app -- All notes comes back if it was closed, or use the tray to make another, or Quit GTR Stickies.

First launch seeds two sample notes in All notes (one cream welcome, one sage blank). They stay closed until you open them.

## Dashboard

A widget-style paper window for course deadlines (Asjau / MI College / Business Law). The product is still GTR Stickies; Dashboard is a window inside it (internal IPC stays `board:*`). The app still starts at All notes -- Dashboard opens only from the All notes button, a note's optional Dashboard icon, or the tray. Settings has an off-by-default "Open dashboard on launch".

Dashboard is a desktop gadget (not always-on-top, no taskbar button — reopen from All notes or the tray). Themes: Paper, Aero, Glow, Midnight, Campus (dots in the header). Status lights go green → yellow → red as a due date gets close; overdue pulses. Click a row for Mark done / Restore; completed items move to Done. Drag the header to move the gadget.

Open Dashboard from All notes (button next to +) or the tray. Header: **Dashboard**, a live clock, then quick settings, add, share, refresh (when a live URL is set), minimize, close.

Rows group into Overdue, Today, This week, Later, and a quiet collapsed Done list. Each row has a type chip (Assignment / Quiz / Test / Reminder / Presentation), title, due (e.g. Tue 5:00pm · in 3 days), and course. Check the box to mark done (kept locally, including for live class items). + opens an in-board composer (type, title, due date+time, course, notes). Click a row or the pencil to edit. Delete uses the same paper confirm as notes.

### Share with classmates

Share menu:

1. **Export dashboard…** -- save `GTR-Dashboard.json` (class items only; personal reminders stay off the file) via the system save dialog.
2. **Import dashboard…** -- merge by id. Incoming class items replace matching ids; local personal items are kept; new items are added. JSON or CSV.
3. **Live class URL…** -- paste a URL. Stored on the dashboard. Refresh on Dashboard open, on the refresh button, and every 5 minutes while the app is running. Fetch happens in the main process (https). Supported feeds:
   - JSON of the same board shape (`{ version, course, items }` or a raw array)
   - CSV with header `type,title,due,course,notes` (Google Sheets **File → Share → Publish to web → CSV**). `type` may be assignment, quiz, test, reminder, or presentation.

Classmates install GTR Stickies, then Import the file or paste the same live URL. To live-update: the owner keeps a Google Sheet, publishes it to the web as CSV, and everyone pastes that link. Live rows get `source: "live"` and are not personal. Personal items are never overwritten or deleted by a live pull. Live rows that disappear from the feed are removed. Local `done` is kept for matching ids (or title+due). Deleting a live class item hides it locally; a normal refresh does not bring it back.

There is no custom server and no Firebase.

### Notifications

While the app or tray is running, a ~60s timer fires desktop notifications (`GTR Stickies`) when an item is due within 60 minutes, and once for items due today. One notify per item per due-window (tracked in board.json). Closing every window is fine as long as the tray is still up; quitting the app stops reminders.

## Settings

Tray Settings…, or the gear on a note / All notes. Saved to userData/settings.json.

Defaults for new notes: font, size, line spacing, paper color, ink color, opacity, always-on-top, start folded. Behavior: confirm before delete, snap to screen edges after a drag, and start on login (macOS / Windows). The app always launches at All notes. Optional Dashboard: default module name (Business Law), open dashboard on launch (off), live class URL. About shows GTR Stickies 3.0. Shortcut reminder for Ctrl+Shift+N.

## Data

Notes are saved as JSON in Electron user-data:

    userData/notes.json
    userData/settings.json
    userData/images/<noteId>/   image sticker files (not inlined in notes.json)
    userData/tessdata/          cached OCR traineddata (eng)
    userData/board.json         Dashboard deadlines

Notes fields: id, x, y, width, height, color, text, pinned, presenterMode, open, folded, unfoldedHeight, minimized, updatedAt, format, images

text is HTML from the editor (inline size, color, highlight, lists live here). open: false means the window is hidden, not deleted. minimized keeps a taskbar button via win.minimize(). folded collapses to chrome only. format is { font, size, lineHeight, align, opacity, ink } — size/ink here are defaults for unstyled text. images is [{ id, file, x, y, width, height, z, rotation }] with positions relative to the note body. Old notes without the new fields still load with defaults. Permanently deleting a note (or a sticker) removes its image files.

board.json: { version, course, liveUrl, updatedAt, items, notified, theme, compact, font, size, clock24, schedule, liveMeta, winW, winH }. Each item: { id, type (assignment|quiz|test|reminder|presentation), title, due (ISO local-naive or with offset), course, notes, done, personal, source (local|live) }. Missing fields are filled on load. Personal items never get overwritten by a live pull. Due dates are parsed as local-naive ISO when they have no Z/offset (Maldives/Windows local time).

## Layout

    package.json
    PRIVACY.md
    main.js            Electron main process, tray, persistence, manager, settings, board
    preload.js         Isolated IPC bridge (window.petal)
    renderer/index.html
    renderer/styles.css
    renderer/note.js
    renderer/manager.html
    renderer/manager.js
    renderer/settings.html
    renderer/settings.js
    renderer/board.html
    renderer/board.js
    renderer/expired.html
    renderer/expired.js
    build/installer.nsh
    assets/icon.png    Tray / window icon
