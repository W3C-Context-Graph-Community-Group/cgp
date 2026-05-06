/**
 * tests/state-service.test.mjs
 *
 * Verifies that StateService correctly computes state from LogService:
 *   1. LogService receives an observatron and 2 spikes via the bus
 *   2. computeStateAt(maxSeq) returns the observatron with both spikes nested
 *   3. getCurrentState() returns the same state with its seq
 *
 * Self-contained: spawns the bus, runs assertions, cleans up.
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
const PORT = 8087;

const ACTIVATED_CHANNEL   = 'cgp:/r/events/activated.md';
const CSV_DROPPED_CHANNEL = 'cgp:/r/events/csv-dropped.md';

// ── Canonical payloads ──

const OBSERVATRON = {
  '/data': {
    value: {
      'cgp-system-id': '0',
      'cgp-observatron-id': '0',
      'cgp-target': '.drop-zone',
      'cgp-intent': '{"cgp-policy":"cgp:/r/policies/parse-csv-headers.md"}',
    },
  },
  '/meaning': {
    key: ['watches CSV columns'],
    value: ['Observes drag-and-drop CSV files and emits one spike per column.'],
  },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor:    ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    source:    ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel:   ['cgp:/r/events/activated.md', 'cgp:/r/events/activated.md'],
    timestamp: ['2026-05-02T13:22:55.774Z', '2026-05-02T13:22:55.774Z'],
    key:       ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value:     ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_A = {
  '/data': { value: ['2026-01-15', '2026-01-16', '2026-01-17'] },
  '/meaning': { key: ['Date'], value: ['The trade execution date in ISO format.'] },
  '/structure': {
    key:   ['json-schema-2020-12'],
    value: ['{"type":"array","items":{"type":"string","format":"date"}}'],
  },
  '/context': {
    anchor:    ['cgp:/s/0/o/0/c/state-change/0/a/0/p/0', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/0'],
    source:    ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel:   ['cgp:/r/events/csv-dropped.md', 'cgp:/r/events/csv-dropped.md'],
    timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key:       ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value:     ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

const SPIKE_B = {
  '/data': { value: ['AAPL', 'GOOG', 'MSFT'] },
  '/meaning': { key: ['Ticker'], value: ['Stock ticker symbol.'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor:    ['cgp:/s/0/o/0/c/state-change/0/a/0/p/1', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/1'],
    source:    ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel:   ['cgp:/r/events/csv-dropped.md', 'cgp:/r/events/csv-dropped.md'],
    timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key:       ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value:     ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

// ── Helpers ──────────────────────────────────────────────

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
      if (!started && chunk.toString().includes('listening')) {
        started = true;
        resolve();
      }
    });
    busProc.stderr.on('data', (chunk) => process.stderr.write(chunk));
    busProc.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Bus start timeout')); }, 10_000);
  });
}

function cleanup() {
  if (busProc && !busProc.killed) busProc.kill();
}

process.on('exit', cleanup);

// ── Main ─────────────────────────────────────────────────

async function run() {
  console.log('state-service: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // ── Create LogService (subscribes to bus) ──
  const logBus = new EventBus(`ws://localhost:${PORT}`);
  await logBus.ready();
  const log = new LogService(logBus);
  console.log(`  LogService connected (client ${logBus.clientId})`);

  // ── Create StateService (reads from LogService) ──
  const svc = new StateService(log);

  // Let subscriptions propagate to the bus server
  await new Promise((r) => setTimeout(r, 200));

  // ── Create emitter ──
  const emitter = new EventBus(`ws://localhost:${PORT}`);
  await emitter.ready();
  console.log(`  Emitter connected (client ${emitter.clientId})`);

  // ── Emit observatron + 2 spikes ──
  console.log('\nTest 1: StateService computes state from LogService entries');

  emitter.emit(ACTIVATED_CHANNEL, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED_CHANNEL, SPIKE_A);
  await new Promise((r) => setTimeout(r, 500));

  emitter.emit(CSV_DROPPED_CHANNEL, SPIKE_B);
  await new Promise((r) => setTimeout(r, 500));

  // ── Verify computeStateAt ──
  const state = svc.computeStateAt(log.maxSeq);

  assert(state.observatrons !== undefined,
    'State has observatrons array');
  assert(state.observatrons.length === 1,
    'State contains exactly 1 observatron');

  const obs = state.observatrons[0];

  assert(obs.url === 'cgp:/s/0/o/0',
    'Observatron URL matches');
  assert(JSON.stringify(obs['/data']) === JSON.stringify(OBSERVATRON['/data']),
    'Observatron /data matches');
  assert(JSON.stringify(obs['/context']) === JSON.stringify(OBSERVATRON['/context']),
    'Observatron /context matches');
  assert(Array.isArray(obs.spikes),
    'Observatron has spikes array');
  assert(obs.spikes.length === 2,
    'Observatron has 2 nested spikes');
  assert(JSON.stringify(obs.spikes[0]) === JSON.stringify(SPIKE_A),
    'First spike matches SPIKE_A');
  assert(JSON.stringify(obs.spikes[1]) === JSON.stringify(SPIKE_B),
    'Second spike matches SPIKE_B');

  // ── Verify parent-child relationship ──
  assert(obs.spikes[0]['/context'].source[0] === obs.url,
    'Spike A source points to parent observatron');
  assert(obs.spikes[1]['/context'].source[0] === obs.url,
    'Spike B source points to parent observatron');

  // ── Verify getCurrentState ──
  console.log('\nTest 2: getCurrentState returns { state, seq }');

  const current = svc.getCurrentState();
  assert(current.seq === log.maxSeq,
    'getCurrentState().seq matches log.maxSeq');
  assert(JSON.stringify(current.state) === JSON.stringify(state),
    'getCurrentState().state matches computeStateAt(maxSeq)');

  // ── Summary ────────────────────────────────────────
  console.log(
    failures === 0
      ? '\n--- All assertions passed ---'
      : `\n--- ${failures} assertion(s) FAILED ---`
  );

  cleanup();
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('Test crashed:', err);
  cleanup();
  process.exit(1);
});
