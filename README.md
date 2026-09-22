# GTR Stickies

**Version 3.0.4** — sticky notes and a class Dashboard.

Little thoughts, always on top. GTR Stickies is a warm, frameless desktop sticky-notes app with a class Dashboard. Notes sit on your screen like scraps of paper — cream, blush, sage, sky, and lavender — with a quiet top bar, a tray for new notes, and local persistence. The All notes window is the home of the app.

**Developed by Mohamed Asjau.** Contact: **mail.asjau@gmail.com**.

This **private** repository is for development and class use. Do not redistribute outside the intended audience without permission.

Privacy: see [PRIVACY.md](PRIVACY.md). Disclaimer / expiry: see [DISCLAIMER.md](DISCLAIMER.md). License: [MIT](LICENSE).

GTR Stickies 3.0.4 is an **early build** and may contain bugs. The app is valid through calendar year **2026** and blocks from **1 January 2027** with an update message. Not affiliated with Microsoft or PowerPoint. Use at your own risk. The Windows installer is unsigned — SmartScreen may warn.

---

## Install from Releases (Windows)

1. Open this repo’s **Releases** page and download `GTR-Stickies-Setup-3.0.4.exe`.
2. Run the installer. If Windows SmartScreen warns, that is expected for an unsigned private build — choose More info → Run anyway only if you trust this source.
3. Launch **GTR Stickies** from the Start menu or desktop shortcut.

---

## How to run from source

Requires Node.js 18+ and a graphical session (Windows / macOS / X11 / Wayland).

**Windows** (Command Prompt or PowerShell), from this folder:

```text
npm.cmd install
npm.cmd start
```

**macOS / Linux:**

```text
npm install
npm start
```

That pulls `electron` and `tesseract.js`. Scripts are in `package.json`.

To build a Windows installer locally: `npm.cmd run dist` (output under `dist/`; `*.exe` is gitignored — attach builds via Releases).

---

## Features (summary)

### Sticky notes

- Frameless notes with paper colors, pin (always on top), fold, minimize, and local JSON persistence.
- Rich text: font, size, ink color, highlight, bold/italic/underline/strike, lists, checklist, alignment, paper opacity.
- Image stickers with paste/drop; local OCR sniping (tesseract.js).
- Spellcheck (en-GB / en-US), find strip, tray, All notes manager, Settings.
- **Pin above PowerPoint Presenter** via screen-saver always-on-top (notes stay visible over slideshows).

### Dashboard

- Class deadlines gadget (assignments, quizzes, tests, reminders, presentations).
- **Type chips** and **urgency lights** (green → yellow → red; overdue pulses).
- Expand a row to show the **calendar due date**.
- Mark done / restore; personal vs class items; optional live class URL or import/export JSON/CSV.
- Desktop notifications for upcoming due items while the app/tray is running.

### Privacy & data

Everything stays local (`userData/notes.json`, `settings.json`, `board.json`, image stickers, OCR cache). No sign-in, no analytics. See [PRIVACY.md](PRIVACY.md).

---

## Use (quick tour)

- The app opens to **All notes**. Open a row to put a note on the desk.
- Drag the empty top bar to move; double-click the bar (or Ctrl+` / Ctrl+Shift+F) to fold.
- Pin keeps a note always on top (including over PowerPoint Presenter when screen-saver AOT is used).
- Plus / Ctrl+N (focused) or Ctrl+Shift+N (global) creates a note.
- **Dashboard** opens from All notes (calendar button), a note’s optional Dashboard icon, or the tray.
- Settings (gear / tray): defaults for new notes, confirm delete, snap edges, start on login, Dashboard options.

Closing the last note does not quit — use All notes or the tray. Quit from the tray menu.

---

## Data layout

Saved under Electron `userData`:

- `notes.json`, `settings.json`, `board.json`
- `images/<noteId>/` — sticker files
- `tessdata/` — cached OCR traineddata

---

## Layout (source)

```text
package.json
main.js            Electron main process, tray, persistence, manager, settings, board
preload.js
renderer/          UI (notes, All notes, Dashboard, settings, expired)
assets/            Icons
PRIVACY.md
DISCLAIMER.md
LICENSE
README.md
```

---

## Changelog highlights — 3.0.4

- Pin above PowerPoint Presenter via screen-saver always-on-top.
- Dashboard type chips + urgency lights.
- Expand shows calendar due date.
- Early-build / 2027 expiry / privacy docs refreshed for this private release.

---

## Contact

**Mohamed Asjau** — mail.asjau@gmail.com
