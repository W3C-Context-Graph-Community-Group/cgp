/**
 * tests/state-aggregation.test.mjs
 *
 * Proves the subscribe-and-receive data flow used by state/index.html:
 * a subscriber client listening on both alpha event channels receives
 * an observatron and its child spikes emitted by a separate client.
 *
 * Tests the subscription layer only — aggregation is client-side rendering
 * logic tested by visual inspection.
 *
 * Self-contained: spawns the bus on a non-default port, runs assertions,
 * cleans up.  Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WebSocket from 'ws';

globalThis.WebSocket = WebSocket;

import { EventBus } from '../lib/event-bus/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const PORT = 8085;

const ACTIVATED_CHANNEL   = 'cgp:/r/events/activated.md';
const CSV_DROPPED_CHANNEL = 'cgp:/r/events/csv-dropped.md';

// ── Canonical payloads from r/meta/schema.md ─────────────

const OBSERVATRON = {
  "/data": {
    "value": {
      "cgp-system-id": "0",
      "cgp-observatron-id": "0",
      "cgp-target": ".drop-zone",
      "cgp-intent": "{\"cgp-policy\":\"cgp:/r/policies/parse-csv-headers.md\"}"
    }
  },
  "/meaning": {
    "key": ["watches CSV columns"],
    "value": ["Observes drag-and-drop CSV files and emits one spike per column."]
  },
  "/structure": { "key": [], "value": [] },
  "/context": {
    "anchor":    ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "source":    ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "channel":   ["cgp:/r/events/activated.md", "cgp:/r/events/activated.md"],
    "timestamp": ["2026-05-02T13:22:55.774Z", "2026-05-02T13:22:55.774Z"],
    "key":       ["cgp:/r/keys/task.md", "cgp:/r/keys/component-type.md"],
    "value":     ["cgp:/r/tasks/csv-dropped.md", "cgp:/r/components/html/forms/drag-and-drop.md"]
  }
};

// Two spikes whose /context.source[0] points to the observatron above

const SPIKE_A = {
  "/data": { "value": ["2026-01-15", "2026-01-16", "2026-01-17"] },
  "/meaning": { "key": ["Date"], "value": ["The trade execution date in ISO format."] },
  "/structure": {
    "key":   ["json-schema-2020-12"],
    "value": ["{\"type\":\"array\",\"items\":{\"type\":\"string\",\"format\":\"date\"}}"]
  },
  "/context": {
    "anchor":    ["cgp:/s/0/o/0/c/state-change/0/a/0/p/0", "cgp:/s/0/o/0/c/state-change/0/a/0/p/0"],
    "source":    ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "channel":   ["cgp:/r/events/csv-dropped.md", "cgp:/r/events/csv-dropped.md"],
    "timestamp": ["2026-05-02T13:23:24.034Z", "2026-05-02T13:23:24.034Z"],
    "key":       ["cgp:/r/keys/task.md", "cgp:/r/keys/component-type.md"],
    "value":     ["cgp:/r/tasks/csv-dropped.md", "cgp:/r/components/html/forms/drag-and-drop.md"]
  }
};

const SPIKE_B = {
  "/data": { "value": ["AAPL", "GOOG", "MSFT"] },
  "/meaning": { "key": ["Ticker"], "value": ["Stock ticker symbol."] },
  "/structure": { "key": [], "value": [] },
  "/context": {
    "anchor":    ["cgp:/s/0/o/0/c/state-change/0/a/0/p/1", "cgp:/s/0/o/0/c/state-change/0/a/0/p/1"],
    "source":    ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "channel":   ["cgp:/r/events/csv-dropped.md", "cgp:/r/events/csv-dropped.md"],
    "timestamp": ["2026-05-02T13:23:24.034Z", "2026-05-02T13:23:24.034Z"],
    "key":       ["cgp:/r/keys/task.md", "cgp:/r/keys/component-type.md"],
    "value":     ["cgp:/r/tasks/csv-dropped.md", "cgp:/r/components/html/forms/drag-and-drop.md"]
  }
};

// ── Helpers ──────────────────────────────────────────────

let bus;
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`);
  else     { console.log(`  FAIL  ${label}`); failures++; }
}

function startBus() {
  return new Promise((resolve, reject) => {
    bus = spawn('node', [BUS_SCRIPT], {
      env: { ...process.env, BUS_PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    bus.stdout.on('data', (chunk) => {
      if (!started && chunk.toString().includes('listening')) {
        started = true;
        resolve();
      }
    });
    bus.stderr.on('data', (chunk) => process.stderr.write(chunk));
    bus.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Bus start timeout')); }, 10_000);
  });
}

function cleanup() {
  if (bus && !bus.killed) bus.kill();
}

process.on('exit', cleanup);

// ── Main ─────────────────────────────────────────────────

async function run() {
  console.log('state-aggregation: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // Subscriber — mirrors what state/index.html does
  const subscriber = new EventBus(`ws://localhost:${PORT}`);
  await subscriber.ready();
  assert(typeof subscriber.clientId === 'string', 'Subscriber connected');

  const received = [];
  for (const ch of [ACTIVATED_CHANNEL, CSV_DROPPED_CHANNEL]) {
    subscriber.on(ch, (msg) => received.push(msg));
  }

  await new Promise((r) => setTimeout(r, 200));

  // Emitter — a separate client
  const emitter = new EventBus(`ws://localhost:${PORT}`);
  await emitter.ready();
  assert(typeof emitter.clientId === 'string', 'Emitter connected');

  // ── Test 1: observatron on activated channel ──────
  console.log('\nTest 1: Observatron arrives on activated channel');

  emitter.emit(ACTIVATED_CHANNEL, OBSERVATRON);
  await new Promise((r) => setTimeout(r, 500));

  assert(received.length === 1,
    'Subscriber received one message');
  assert(received[0]?.event === ACTIVATED_CHANNEL,
    'Message arrived on activated channel');
  assert(received[0]?.from === emitter.clientId,
    'Message from field matches emitter');
  assert(JSON.stringify(received[0]?.payload) === JSON.stringify(OBSERVATRON),
    'Observatron payload matches verbatim');

  // ── Test 2: first spike on csv-dropped channel ────
  console.log('\nTest 2: First spike arrives on csv-dropped channel');

  emitter.emit(CSV_DROPPED_CHANNEL, SPIKE_A);
  await new Promise((r) => setTimeout(r, 500));

  assert(received.length === 2,
    'Subscriber received two messages total');
  assert(received[1]?.event === CSV_DROPPED_CHANNEL,
    'Message arrived on csv-dropped channel');
  assert(JSON.stringify(received[1]?.payload) === JSON.stringify(SPIKE_A),
    'Spike A payload matches verbatim');
  assert(received[1]?.payload['/context'].source[0] === OBSERVATRON['/context'].anchor[0],
    'Spike A source points to the observatron');

  // ── Test 3: second spike on csv-dropped channel ───
  console.log('\nTest 3: Second spike arrives on csv-dropped channel');

  emitter.emit(CSV_DROPPED_CHANNEL, SPIKE_B);
  await new Promise((r) => setTimeout(r, 500));

  assert(received.length === 3,
    'Subscriber received three messages total');
  assert(received[2]?.event === CSV_DROPPED_CHANNEL,
    'Message arrived on csv-dropped channel');
  assert(JSON.stringify(received[2]?.payload) === JSON.stringify(SPIKE_B),
    'Spike B payload matches verbatim');
  assert(received[2]?.payload['/context'].source[0] === OBSERVATRON['/context'].anchor[0],
    'Spike B source points to the same observatron');

  // ── Done ──────────────────────────────────────────
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
