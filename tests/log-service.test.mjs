/**
 * tests/log-service.test.mjs
 *
 * Verifies LogService correctly records bus events:
 *   - 3 valid emissions appear as accepted entries
 *   - 1 malformed emission is captured automatically via the bus's
 *     cgp:/internal/validation-errors audit channel as a rejected entry
 *   - getLog() returns all 4 in order
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const PORT = 8088;

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
  console.log('log-service: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // Create LogService (subscribes to both event channels + rejection audit channel)
  const logBus = new EventBus(`ws://localhost:${PORT}`);
  await logBus.ready();
  const log = new LogService(logBus);
  console.log(`  LogService connected (client ${logBus.clientId})`);
  await new Promise((r) => setTimeout(r, 200));

  // Create separate emitter
  const emitter = new EventBus(`ws://localhost:${PORT}`);
  await emitter.ready();
  console.log(`  Emitter connected (client ${emitter.clientId})`);

  // Emit 3 valid events
  console.log('\nTest 1: LogService records 3 accepted events and 1 rejection');

  emitter.emit(ACTIVATED, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_A);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED, SPIKE_B);
  await new Promise((r) => setTimeout(r, 500));

  // Emit malformed payload — LogService captures the rejection automatically
  // via the cgp:/internal/validation-errors audit channel
  emitter.emit(CSV_DROPPED, { bad: true });
  await new Promise((r) => setTimeout(r, 500));

  // Verify
  const entries = log.getLog();
  assert(entries.length === 4, 'getLog() returns 4 entries');
  assert(log.maxSeq === 4, 'maxSeq is 4');

  // Entry 1: observatron (accepted)
  assert(entries[0].seq === 1, 'Entry 1 seq is 1');
  assert(entries[0].channel === ACTIVATED, 'Entry 1 channel is activated');
  assert(entries[0].accepted === true, 'Entry 1 is accepted');
  assert(entries[0].from === emitter.clientId, 'Entry 1 from matches emitter');
  assert(JSON.stringify(entries[0].payload) === JSON.stringify(OBSERVATRON), 'Entry 1 payload is OBSERVATRON');

  // Entry 2: spike A (accepted)
  assert(entries[1].seq === 2, 'Entry 2 seq is 2');
  assert(entries[1].channel === CSV_DROPPED, 'Entry 2 channel is csv-dropped');
  assert(entries[1].accepted === true, 'Entry 2 is accepted');
  assert(JSON.stringify(entries[1].payload) === JSON.stringify(SPIKE_A), 'Entry 2 payload is SPIKE_A');

  // Entry 3: spike B (accepted)
  assert(entries[2].seq === 3, 'Entry 3 seq is 3');
  assert(entries[2].channel === CSV_DROPPED, 'Entry 3 channel is csv-dropped');
  assert(entries[2].accepted === true, 'Entry 3 is accepted');
  assert(JSON.stringify(entries[2].payload) === JSON.stringify(SPIKE_B), 'Entry 3 payload is SPIKE_B');

  // Entry 4: rejection (captured automatically via audit channel)
  assert(entries[3].seq === 4, 'Entry 4 seq is 4');
  assert(entries[3].channel === CSV_DROPPED, 'Entry 4 channel is csv-dropped');
  assert(entries[3].accepted === false, 'Entry 4 is rejected');
  assert(entries[3].from === emitter.clientId, 'Entry 4 from matches emitter');
  assert(entries[3].payload.action === 'validation-error', 'Entry 4 payload is validation-error envelope');

  console.log(failures === 0 ? '\n--- All assertions passed ---' : `\n--- ${failures} assertion(s) FAILED ---`);
  cleanup();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => { console.error('Test crashed:', err); cleanup(); process.exit(1); });
