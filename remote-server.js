'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PREFERRED_PORT = 17832;
const PORT_SPAN = 20;

function lanIPv4() {
  const nets = os.networkInterfaces();
  const preferred = [];
  const fallback = [];
  for (const name of Object.keys(nets || {})) {
    for (const net of nets[name] || []) {
      if (!net || net.internal) continue;
      const fam = net.family;
      if (fam !== 'IPv4' && fam !== 4) continue;
      const addr = String(net.address || '');
      if (!addr || addr === '127.0.0.1') continue;
      if (addr.startsWith('192.168.') || addr.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(addr)) {
        preferred.push(addr);
      } else {
        fallback.push(addr);
      }
    }
  }
  return preferred[0] || fallback[0] || null;
}

function makePairCode() {
  const n = 100000 + Math.floor(Math.random() * 900000);
  return String(n);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

/**
 * Tiny LAN HTTP + WebSocket remote for Presenter mode.
 * Pairing code required on HTTP (?code=) or WebSocket URL / first auth message.
 */
function createPresenterRemote({ htmlPath, onScroll, onStatus } = {}) {
  let server = null;
  let wss = null;
  let port = null;
  let code = null;
  let starting = null;
  const clients = new Set();

  function info() {
    const ip = lanIPv4();
    const running = !!(server && port && code);
    const base = running && ip ? `http://${ip}:${port}` : null;
    return {
      running,
      ip: ip || null,
      port,
      code,
      url: base && code ? `${base}/?code=${code}` : null,
      baseUrl: base,
      clients: clients.size,
    };
  }

  function emitStatus() {
    if (typeof onStatus === 'function') {
      try {
        onStatus(info());
      } catch (_) {
        /* ignore */
      }
    }
  }

  function authorized(candidate) {
    return !!(code && candidate && String(candidate) === String(code));
  }

  function parseQueryCode(reqUrl) {
    try {
      const u = new URL(reqUrl || '/', 'http://127.0.0.1');
      return u.searchParams.get('code') || u.searchParams.get('c') || '';
    } catch (_) {
      return '';
    }
  }

  function handleScrollMessage(raw) {
    let msg;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    const type = String(msg.type || '');
    if (type === 'ping') return;
    if (type === 'scroll') {
      const dy = Number(msg.dy);
      if (!Number.isFinite(dy) || dy === 0) return;
      if (typeof onScroll === 'function') onScroll({ dy });
      return;
    }
    if (type === 'scrollTo') {
      let ratio = Number(msg.ratio);
      if (!Number.isFinite(ratio)) return;
      ratio = Math.max(0, Math.min(1, ratio));
      if (typeof onScroll === 'function') onScroll({ ratio });
      return;
    }
    if (type === 'page') {
      const dir = String(msg.dir || msg.direction || '').toLowerCase();
      if (dir !== 'up' && dir !== 'down') return;
      if (typeof onScroll === 'function') onScroll({ page: dir });
    }
  }

  function attachClient(ws, alreadyAuthed) {
    let authed = !!alreadyAuthed;
    clients.add(ws);
    emitStatus();

    ws.on('message', (data) => {
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data || '');
      if (!authed) {
        try {
          const msg = JSON.parse(text);
          if (msg && (msg.type === 'auth' || msg.code) && authorized(msg.code)) {
            authed = true;
            try {
              ws.send(JSON.stringify({ type: 'hello', ok: true }));
            } catch (_) {
              /* ignore */
            }
            return;
          }
        } catch (_) {
          /* fall through */
        }
        try {
          ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
        } catch (_) {
          /* ignore */
        }
        try {
          ws.close(4401, 'unauthorized');
        } catch (_) {
          /* ignore */
        }
        return;
      }
      handleScrollMessage(text);
    });

    ws.on('close', () => {
      clients.delete(ws);
      emitStatus();
    });
    ws.on('error', () => {
      clients.delete(ws);
      emitStatus();
    });

    if (authed) {
      try {
        ws.send(JSON.stringify({ type: 'hello', ok: true }));
      } catch (_) {
        /* ignore */
      }
    }
  }

  function tryListen(srv, tryPort) {
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        srv.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        srv.removeListener('error', onError);
        resolve(tryPort);
      };
      srv.once('error', onError);
      srv.once('listening', onListening);
      srv.listen(tryPort, '0.0.0.0');
    });
  }

  function createHttpServer(pagePath) {
    return http.createServer((req, res) => {
      const method = (req.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
      }

      let pathname = '/';
      try {
        pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      } catch (_) {
        pathname = '/';
      }

      if (pathname === '/health' || pathname === '/api/status') {
        const body = JSON.stringify({ ok: true, running: true });
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(method === 'HEAD' ? undefined : body);
        return;
      }

      if (pathname !== '/' && pathname !== '/index.html' && pathname !== '/remote.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      let html;
      try {
        html = fs.readFileSync(pagePath, 'utf8');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Remote page missing');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType(pagePath),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(method === 'HEAD' ? undefined : html);
    });
  }

  async function start() {
    if (server && port && code) return info();
    if (starting) return starting;

    starting = (async () => {
      code = makePairCode();
      const pagePath = htmlPath || path.join(__dirname, 'renderer', 'remote.html');

      let bound = null;
      let lastErr = null;
      let srv = null;
      let socketServer = null;

      for (let i = 0; i < PORT_SPAN; i += 1) {
        const tryPort = PREFERRED_PORT + i;
        srv = createHttpServer(pagePath);
        socketServer = new WebSocketServer({ noServer: true, clientTracking: false });
        srv.on('upgrade', (req, socket, head) => {
          const qCode = parseQueryCode(req.url);
          const ok = authorized(qCode);
          socketServer.handleUpgrade(req, socket, head, (ws) => {
            attachClient(ws, ok);
          });
        });
        try {
          bound = await tryListen(srv, tryPort);
          break;
        } catch (err) {
          lastErr = err;
          try { srv.close(); } catch (_) { /* ignore */ }
          try { socketServer.close(); } catch (_) { /* ignore */ }
          srv = null;
          socketServer = null;
        }
      }

      if (!bound || !srv) {
        code = null;
        throw lastErr || new Error('No free port near 17832');
      }

      server = srv;
      wss = socketServer;
      port = bound;
      emitStatus();
      return info();
    })();

    try {
      return await starting;
    } finally {
      starting = null;
    }
  }

  function stop() {
    for (const ws of [...clients]) {
      try {
        ws.close(1001, 'presenter off');
      } catch (_) {
        /* ignore */
      }
    }
    clients.clear();
    if (wss) {
      try {
        wss.close();
      } catch (_) {
        /* ignore */
      }
      wss = null;
    }
    if (server) {
      try {
        server.close();
      } catch (_) {
        /* ignore */
      }
      server = null;
    }
    port = null;
    code = null;
    emitStatus();
    return info();
  }

  function isRunning() {
    return !!(server && port && code);
  }

  return { start, stop, info, isRunning, lanIPv4 };
}

module.exports = {
  createPresenterRemote,
  lanIPv4,
  PREFERRED_PORT,
};
