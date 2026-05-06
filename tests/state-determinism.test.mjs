/**
 * tests/state-determinism.test.mjs
 *
 * Verifies that StateService.computeStateAt(n) is deterministic:
 *   - Same log fixture, call computeStateAt(n) twice for each n in [0,1,2,3,4]
 *   - Assert byte-equal (JSON.stringify) results across the two runs
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
const PORT = 8091;

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
  console.log('state-determinism: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // Create LogService + StateService
  const logBus = new EventBus(`ws://localhost:${PORT}`);
  await logBus.ready();
  const log = new LogService(logBus);
  const svc = new StateService(log);
  console.log(`  LogService connected (client ${logBus.clientId})`);
  await new Promise((r) => setTimeout(r, 200));

  // Create emitter
  const emitter = new EventBus(`ws://localhost:${PORT}`);
  await emitter.ready();
  console.log(`  Emitter connected (client ${emitter.clientId})`);

  // Emit observatron + 3 spikes (4 accepted entries)
  emitter.emit(ACTIVATED, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_A);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_B);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_C);
  await new Promise((r) => setTimeout(r, 500));

  assert(log.maxSeq === 4, 'Log has 4 entries');

  // Call computeStateAt(n) twice for each n, assert byte-equal
  console.log('\nTest 1: computeStateAt(n) is deterministic for n in [0,1,2,3,4]');

  for (let n = 0; n <= 4; n++) {
    const run1 = JSON.stringify(svc.computeStateAt(n));
    const run2 = JSON.stringify(svc.computeStateAt(n));
    assert(run1 === run2, `computeStateAt(${n}) is byte-equal across two calls`);
  }

  // Extra: verify different n values produce different results (sanity check)
  console.log('\nTest 2: different n values produce different states (sanity)');
  const j0 = JSON.stringify(svc.computeStateAt(0));
  const j1 = JSON.stringify(svc.computeStateAt(1));
  const j2 = JSON.stringify(svc.computeStateAt(2));
  assert(j0 !== j1, 'computeStateAt(0) differs from computeStateAt(1)');
  assert(j1 !== j2, 'computeStateAt(1) differs from computeStateAt(2)');

  console.log(failures === 0 ? '\n--- All assertions passed ---' : `\n--- ${failures} assertion(s) FAILED ---`);
  cleanup();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => { console.error('Test crashed:', err); cleanup(); process.exit(1); });
