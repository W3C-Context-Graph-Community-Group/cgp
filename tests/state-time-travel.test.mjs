/**
 * tests/state-time-travel.test.mjs
 *
 * Verifies StateService.computeStateAt(n) returns correct snapshots at
 * every point in time:
 *   - computeStateAt(0): empty state
 *   - computeStateAt(1): observatron with 0 spikes
 *   - computeStateAt(2): observatron with 1 spike
 *   - computeStateAt(3): observatron with 2 spikes
 *   - computeStateAt(4): observatron with 3 spikes
 *   - computeStateAt(5): byte-equal to computeStateAt(4) (rejection doesn't change state)
 *   - getCurrentState().state matches computeStateAt(5)
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
const PORT = 8090;

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
  console.log('state-time-travel: starting bus on port', PORT);
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

  // Emit: observatron (seq 1), spike A (seq 2), spike B (seq 3), spike C (seq 4), malformed (seq 5 — rejected)
  emitter.emit(ACTIVATED, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_A);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_B);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_C);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, { bad: true });
  await new Promise((r) => setTimeout(r, 500));

  assert(log.maxSeq === 5, 'Log has 5 entries (4 accepted + 1 rejection)');

  // computeStateAt(0): empty
  console.log('\nTest 1: computeStateAt(0) returns empty state');
  const s0 = svc.computeStateAt(0);
  assert(s0.observatrons.length === 0, 'computeStateAt(0) has 0 observatrons');

  // computeStateAt(1): observatron with 0 spikes
  console.log('\nTest 2: computeStateAt(1) returns observatron with 0 spikes');
  const s1 = svc.computeStateAt(1);
  assert(s1.observatrons.length === 1, 'computeStateAt(1) has 1 observatron');
  assert(s1.observatrons[0].spikes.length === 0, 'computeStateAt(1) observatron has 0 spikes');
  assert(s1.observatrons[0].url === 'cgp:/s/0/o/0', 'computeStateAt(1) observatron URL matches');

  // computeStateAt(2): observatron with 1 spike
  console.log('\nTest 3: computeStateAt(2) returns observatron with 1 spike');
  const s2 = svc.computeStateAt(2);
  assert(s2.observatrons.length === 1, 'computeStateAt(2) has 1 observatron');
  assert(s2.observatrons[0].spikes.length === 1, 'computeStateAt(2) observatron has 1 spike');
  assert(JSON.stringify(s2.observatrons[0].spikes[0]) === JSON.stringify(SPIKE_A), 'computeStateAt(2) spike is SPIKE_A');

  // computeStateAt(3): observatron with 2 spikes
  console.log('\nTest 4: computeStateAt(3) returns observatron with 2 spikes');
  const s3 = svc.computeStateAt(3);
  assert(s3.observatrons.length === 1, 'computeStateAt(3) has 1 observatron');
  assert(s3.observatrons[0].spikes.length === 2, 'computeStateAt(3) observatron has 2 spikes');

  // computeStateAt(4): observatron with 3 spikes
  console.log('\nTest 5: computeStateAt(4) returns observatron with 3 spikes');
  const s4 = svc.computeStateAt(4);
  assert(s4.observatrons.length === 1, 'computeStateAt(4) has 1 observatron');
  assert(s4.observatrons[0].spikes.length === 3, 'computeStateAt(4) observatron has 3 spikes');
  assert(JSON.stringify(s4.observatrons[0].spikes[2]) === JSON.stringify(SPIKE_C), 'computeStateAt(4) third spike is SPIKE_C');

  // computeStateAt(5): byte-equal to computeStateAt(4) — rejection doesn't change state
  console.log('\nTest 6: computeStateAt(5) is byte-equal to computeStateAt(4)');
  const s5 = svc.computeStateAt(5);
  assert(JSON.stringify(s5) === JSON.stringify(s4), 'computeStateAt(5) === computeStateAt(4)');

  // getCurrentState().state matches computeStateAt(5)
  console.log('\nTest 7: getCurrentState().state matches computeStateAt(5)');
  const current = svc.getCurrentState();
  assert(current.seq === 5, 'getCurrentState().seq is 5');
  assert(JSON.stringify(current.state) === JSON.stringify(s5), 'getCurrentState().state matches computeStateAt(5)');

  console.log(failures === 0 ? '\n--- All assertions passed ---' : `\n--- ${failures} assertion(s) FAILED ---`);
  cleanup();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => { console.error('Test crashed:', err); cleanup(); process.exit(1); });
