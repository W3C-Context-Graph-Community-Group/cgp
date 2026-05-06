/**
 * tests/order-independence.test.mjs
 *
 * Verifies that events emitted BEFORE any HTTP/WS viewer connects are
 * still captured by LogService and available via StateService:
 *   - Start bus, connect LogService (server-side always-on)
 *   - Emit observatron + 2 spikes (no viewer connected)
 *   - Call getLog() — assert full history (3 entries)
 *   - Call getCurrentState() — assert observatron with 2 spikes
 *
 * Self-contained: spawns bus, runs assertions, cleans up.
 * Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WebSocket from 'ws';

globalThis.WebSocket = WebSocket;

import { EventBus } from '../lib/event-bus/client.js';
import { LogService } from '../lib/log-service/LogService.js';
import { StateService } from '../lib/state-service/StateService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const PORT = 8092;

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

let busProc;
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`);
  else     { console.log(`  FAIL  ${label}`); failures++; }
}

function startBus() {
  return new Promise((resolve, reject) => {
    busProc = spawn('node', [BUS_SCRIPT], {
      env: { ...process.env, BUS_PORT: String(PORT) },
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

function cleanup() { if (busProc && !busProc.killed) busProc.kill(); }
process.on('exit', cleanup);

async function run() {
  console.log('order-independence: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // Create LogService (server-side, always on)
  const logBus = new EventBus(`ws://localhost:${PORT}`);
  await logBus.ready();
  const log = new LogService(logBus);
  const svc = new StateService(log);
  console.log(`  LogService connected (client ${logBus.clientId})`);
  await new Promise((r) => setTimeout(r, 200));

  // Create emitter — no "viewer" has connected yet
  const emitter = new EventBus(`ws://localhost:${PORT}`);
  await emitter.ready();
  console.log(`  Emitter connected (client ${emitter.clientId})`);
  console.log('  (No HTTP/WS viewer is connected — events fire before any viewer exists)\n');

  // Emit observatron + 2 spikes
  emitter.emit(ACTIVATED, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_A);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_B);
  await new Promise((r) => setTimeout(r, 500));

  // Verify getLog() returns full history
  console.log('Test 1: getLog() returns full history even with no viewer');
  const entries = log.getLog();
  assert(entries.length === 3, 'getLog() returns 3 entries');
  assert(entries[0].seq === 1, 'Entry 1 seq is 1');
  assert(entries[0].channel === ACTIVATED, 'Entry 1 channel is activated');
  assert(entries[1].seq === 2, 'Entry 2 seq is 2');
  assert(entries[1].channel === CSV_DROPPED, 'Entry 2 channel is csv-dropped');
  assert(entries[2].seq === 3, 'Entry 3 seq is 3');
  assert(entries[2].channel === CSV_DROPPED, 'Entry 3 channel is csv-dropped');

  // Verify getCurrentState() returns correct state
  console.log('\nTest 2: getCurrentState() returns full state with no viewer');
  const current = svc.getCurrentState();
  assert(current.seq === 3, 'getCurrentState().seq is 3');
  assert(current.state.observatrons.length === 1, 'State has 1 observatron');

  const obs = current.state.observatrons[0];
  assert(obs.url === 'cgp:/s/0/o/0', 'Observatron URL matches');
  assert(obs.spikes.length === 2, 'Observatron has 2 spikes');
  assert(JSON.stringify(obs.spikes[0]) === JSON.stringify(SPIKE_A), 'First spike is SPIKE_A');
  assert(JSON.stringify(obs.spikes[1]) === JSON.stringify(SPIKE_B), 'Second spike is SPIKE_B');

  console.log(failures === 0 ? '\n--- All assertions passed ---' : `\n--- ${failures} assertion(s) FAILED ---`);
  cleanup();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => { console.error('Test crashed:', err); cleanup(); process.exit(1); });
