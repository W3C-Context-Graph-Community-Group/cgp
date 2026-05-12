import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { createServer } from 'http';
import { readFile, readdir, stat } from 'fs/promises';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { EventBus } from './lib/event-bus/client.js';
import { LogService } from './lib/log-service/LogService.js';
import { StateService } from './lib/state-service/StateService.js';

globalThis.WebSocket = WebSocket;

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const BUS_PORT = process.env.BUS_PORT || '8080';

/* ── MIME types ── */
const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.mjs':   'application/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.md':    'text/markdown; charset=utf-8',
  '.txt':   'text/plain; charset=utf-8',
  '.csv':   'text/csv; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
};

/* ── Recursively list .md files under a directory ── */
async function listMdFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = base ? base + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      files = files.concat(await listMdFiles(fullPath, relPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(relPath);
    }
  }
  return files;
}

/* ── Services (populated once bus is ready) ── */
let logService = null;
let stateService = null;

/* ── HTTP server ── */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  /* API endpoint: list all .md files under r/ */
  if (pathname === '/api/r-files') {
    try {
      const files = await listMdFiles(join(ROOT, 'r'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(files));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  /* API endpoint: event log */
  if (pathname === '/api/log') {
    const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
    const entries = logService ? logService.getLog({ since }) : [];
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ entries }));
    return;
  }

  /* API endpoint: hypergraph state snapshot */
  if (pathname === '/api/state') {
    if (stateService) {
      const atParam = url.searchParams.get('at');
      const at = atParam !== null ? parseInt(atParam, 10) : logService.maxSeq;
      const state = stateService.computeStateAt(at);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ state, seq: at }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ state: { observatrons: [] }, seq: 0 }));
    }
    return;
  }

  /* Static file serving */
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = join(ROOT, pathname);

  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      res.writeHead(302, { Location: pathname + '/' });
      res.end();
      return;
    }
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

/* ── WebSocket /ws/updates endpoint ── */
const wsUpdates = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  if (pathname === '/ws/updates') {
    wsUpdates.handleUpgrade(req, socket, head, (ws) => {
      wsUpdates.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wsUpdates.on('connection', (ws) => {
  ws.once('message', (raw) => {
    if (!logService) { ws.close(); return; }
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { ws.close(); return; }
    const since = typeof msg.since === 'number' ? msg.since : 0;

    // Replay entries with seq > since
    for (const entry of logService.getLog({ since })) {
      if (ws.readyState === 1) ws.send(JSON.stringify(entry));
    }

    // Subscribe to future entries
    const unsub = logService.subscribe((entry) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(entry));
    });

    ws.on('close', unsub);
  });
});

server.listen(PORT, () => {
  console.log(`HTTP serving from ${ROOT} on http://localhost:${PORT}`);
});

/* ── Start event bus (WebSocket on port 8080) ── */
const busProc = spawn('node', ['lib/event-bus/server.js'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, BUS_PORT: BUS_PORT },
});

busProc.stdout.on('data', async (chunk) => {
  process.stdout.write(chunk);
  if (!logService && chunk.toString().includes('listening')) {
    const bus = new EventBus(`ws://localhost:${BUS_PORT}`);
    await bus.ready();
    logService = new LogService(bus);
    stateService = new StateService(logService);
    console.log('Log service and state service connected to bus');
    console.log('\n\x1b[1;34mTo test for drift, run `npm test`\x1b[0m\n');
  }
});

busProc.on('close', (code) => {
  server.close();
  process.exit(code);
});

process.on('SIGINT',  () => { busProc.kill(); server.close(); process.exit(0); });
process.on('SIGTERM', () => { busProc.kill(); server.close(); process.exit(0); });
