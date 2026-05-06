/**
 * tests/ws-updates.test.mjs
 *
 * Verifies the /ws/updates WebSocket protocol:
 *   1. Emit 3 events; connect with since=0; receive exactly 3 (replay)
 *   2. Emit 2 more; receive exactly 2 live (seq 4, 5)
 *   3. Disconnect; emit 2 more; reconnect with since=5; receive exactly 2 (seq 6, 7)
 *
 * Creates a mini /ws/updates server backed by LogService (same protocol as server.js).
 *
 * Self-contained: spawns bus, runs assertions, cleans up.
 * Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WebSocket, { WebSocketServer } from 'ws';
import { createServer } from 'node:http';

globalThis.WebSocket = WebSocket;

import { EventBus } from '../lib/event-bus/client.js';
import { LogService } from '../lib/log-service/LogService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const BUS_PORT = 8093;
const WS_PORT  = 8094;

const ACTIVATED   = 'cgp:/r/events/activated.md';
const CSV_DROPPED = 'cgp:/r/events/csv-dropped.md';

const OBSERVATRON = {
  '/data': { value: { 'cgp-system-id': '0', 'cgp-observatron-id': '0', 'cgp-target': '.drop-zone', 'cgp-intent': '{"cgp-policy":"cgp:/r/policies/parse-csv-headers.md"}' } },
  '/meaning': { key: ['watches CSV columns'], value: ['Observes drag-and-drop CSV files and emits one spike per column.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'], source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [ACTIVATED, ACTIVATED], timestamp: ['2026-05-02T13:22:55.774Z', '2026-05-02T13:22:55.774Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_A = {
  '/data': { value: ['2026-01-15', '2026-01-16', '2026-01-17'] },
  '/meaning': { key: ['Date'], value: ['The trade execution date in ISO format.'] },
  '/structure': { key: ['json-schema-2020-12'], value: ['{"type":"array","items":{"type":"string","format":"date"}}'] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/0', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/0'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_B = {
  '/data': { value: ['AAPL', 'GOOG', 'MSFT'] },
  '/meaning': { key: ['Ticker'], value: ['Stock ticker symbol.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/1', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/1'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_C = {
  '/data': { value: ['100', '200', '300'] },
  '/meaning': { key: ['Amount'], value: ['Trade amount in USD.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/2', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/2'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_D = {
  '/data': { value: ['BUY', 'SELL', 'BUY'] },
  '/meaning': { key: ['Side'], value: ['Trade direction.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/3', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/3'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_E = {
  '/data': { value: ['10.50', '11.25', '9.75'] },
  '/meaning': { key: ['Price'], value: ['Trade price in USD.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/4', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/4'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_F = {
  '/data': { value: ['NYSE', 'NASDAQ', 'NYSE'] },
  '/meaning': { key: ['Exchange'], value: ['Trading exchange.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/5', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/5'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_G = {
  '/data': { value: ['FILL', 'FILL', 'PARTIAL'] },
  '/meaning': { key: ['Status'], value: ['Order fill status.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor: ['cgp:/s/0/o/0/c/state-change/0/a/0/p/6', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/6'],
    source: ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel: [CSV_DROPPED, CSV_DROPPED], timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value: ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

let busProc;
let httpServer;
let wsServer;
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`);
  else     { console.log(`  FAIL  ${label}`); failures++; }
}

function startBus() {
  return new Promise((resolve, reject) => {
    busProc = spawn('node', [BUS_SCRIPT], {
      env: { ...process.env, BUS_PORT: String(BUS_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    busProc.stdout.on('data', (chunk) => {
      if (!started && chunk.toString().includes('listening')) { started = true; resolve(); }
    });
    busProc.stderr.on('data', (chunk) => process.stderr.write(chunk));
    busProc.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Bus start timeout')); }, 10_000);
  });
}

/** Create a mini /ws/updates server implementing the same protocol as server.js */
function startWsUpdatesServer(logService) {
  return new Promise((resolve) => {
    httpServer = createServer();
    wsServer = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
      const { pathname } = new URL(req.url, `http://localhost:${WS_PORT}`);
      if (pathname === '/ws/updates') {
        wsServer.handleUpgrade(req, socket, head, (ws) => {
          wsServer.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    });

    wsServer.on('connection', (ws) => {
      ws.once('message', (raw) => {
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

    httpServer.listen(WS_PORT, () => resolve());
  });
}

/** Connect a test WS client, send { since }, collect N messages, return them */
function collectMessages(since, count, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws/updates`);
    const messages = [];
    const timer = setTimeout(() => {
      ws.close();
      resolve(messages); // resolve with whatever we got
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({ since }));
    });

    ws.on('message', (raw) => {
      messages.push(JSON.parse(raw.toString()));
      if (messages.length === count) {
        clearTimeout(timer);
        // Give a brief pause to ensure no extra messages arrive
        setTimeout(() => {
          ws.close();
          resolve(messages);
        }, 300);
      }
    });

    ws.on('error', reject);
  });
}

/** Connect a persistent WS client that collects messages into an array */
function connectPersistent(since) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/ws/updates`);
    const messages = [];

    ws.on('open', () => {
      ws.send(JSON.stringify({ since }));
      // Brief delay to let replay complete before resolving
      setTimeout(() => resolve({ ws, messages }), 300);
    });

    ws.on('message', (raw) => {
      messages.push(JSON.parse(raw.toString()));
    });

    ws.on('error', reject);
  });
}

function cleanup() {
  if (busProc && !busProc.killed) busProc.kill();
  if (wsServer) wsServer.close();
  if (httpServer) httpServer.close();
}
process.on('exit', cleanup);

async function run() {
  console.log('ws-updates: starting bus on port', BUS_PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // Create LogService
  const logBus = new EventBus(`ws://localhost:${BUS_PORT}`);
  await logBus.ready();
  const log = new LogService(logBus);
  console.log(`  LogService connected (client ${logBus.clientId})`);
  await new Promise((r) => setTimeout(r, 200));

  // Start /ws/updates server backed by LogService
  await startWsUpdatesServer(log);
  console.log(`  /ws/updates server listening on port ${WS_PORT}`);

  // Create emitter
  const emitter = new EventBus(`ws://localhost:${BUS_PORT}`);
  await emitter.ready();
  console.log(`  Emitter connected (client ${emitter.clientId})\n`);

  // ── Phase 1: Emit 3 events, then connect with since=0 ──
  console.log('Test 1: Connect with since=0 after 3 emissions — receive 3 replayed entries');

  emitter.emit(ACTIVATED, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 400));

  emitter.emit(CSV_DROPPED, SPIKE_A);
  await new Promise((r) => setTimeout(r, 400));

  emitter.emit(CSV_DROPPED, SPIKE_B);
  await new Promise((r) => setTimeout(r, 400));

  const replayed = await collectMessages(0, 3);
  assert(replayed.length === 3, 'Received 3 replayed entries');
  assert(replayed[0].seq === 1, 'Replayed entry 1 has seq 1');
  assert(replayed[1].seq === 2, 'Replayed entry 2 has seq 2');
  assert(replayed[2].seq === 3, 'Replayed entry 3 has seq 3');

  // ── Phase 2: Connect persistent client, emit 2 more, receive live ──
  console.log('\nTest 2: Connected client receives 2 live entries after new emissions');

  const { ws: persistentWs, messages: liveMessages } = await connectPersistent(3);

  emitter.emit(CSV_DROPPED, SPIKE_C);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_D);
  await new Promise((r) => setTimeout(r, 500));

  assert(liveMessages.length === 2, 'Received 2 live entries');
  assert(liveMessages[0].seq === 4, 'Live entry 1 has seq 4');
  assert(liveMessages[1].seq === 5, 'Live entry 2 has seq 5');

  // ── Phase 3: Disconnect, emit 2 more, reconnect with since=5 ──
  console.log('\nTest 3: Reconnect with since=5 after missed emissions — receive exactly 2');

  persistentWs.close();
  await new Promise((r) => setTimeout(r, 300));

  emitter.emit(CSV_DROPPED, SPIKE_E);
  await new Promise((r) => setTimeout(r, 400));

  emitter.emit(CSV_DROPPED, SPIKE_F);
  await new Promise((r) => setTimeout(r, 400));

  const missed = await collectMessages(5, 2);
  assert(missed.length === 2, 'Received 2 missed entries');
  assert(missed[0].seq === 6, 'Missed entry 1 has seq 6');
  assert(missed[1].seq === 7, 'Missed entry 2 has seq 7');

  console.log(failures === 0 ? '\n--- All assertions passed ---' : `\n--- ${failures} assertion(s) FAILED ---`);
  cleanup();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => { console.error('Test crashed:', err); cleanup(); process.exit(1); });
