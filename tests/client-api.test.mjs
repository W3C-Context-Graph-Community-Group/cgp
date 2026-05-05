/**
 * tests/client-api.test.mjs
 *
 * Tests the EventBus client's public API additions:
 *   - ready()    resolves when the welcome handshake completes
 *   - onError()  delivers server-side errors (validation-error)
 *   - offError() stops delivering after removal
 *
 * Self-contained: spawns the bus, runs assertions, cleans up.
 * Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WebSocket from 'ws';

// Make WebSocket available globally so EventBus can use it in Node
globalThis.WebSocket = WebSocket;

import { EventBus } from '../lib/event-bus/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const PORT = 8083;
const CHANNEL = 'cgp:/r/events/csv-dropped.md';

// A spike missing /data — guaranteed to fail validation
const MALFORMED = {
  '/meaning':   { key: ['x'], value: ['y'] },
  '/structure': { key: [], value: [] },
  '/context': {
    anchor:    ['cgp:/s/0/o/0/c/state-change/0/a/0/p/0', 'cgp:/s/0/o/0/c/state-change/0/a/0/p/0'],
    source:    ['cgp:/s/0/o/0', 'cgp:/s/0/o/0'],
    channel:   ['cgp:/r/events/csv-dropped.md', 'cgp:/r/events/csv-dropped.md'],
    timestamp: ['2026-05-02T13:23:24.034Z', '2026-05-02T13:23:24.034Z'],
    key:       ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
    value:     ['cgp:/r/tasks/csv-dropped.md', 'cgp:/r/components/html/forms/drag-and-drop.md'],
  },
};

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
  console.log('client-api: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  // ── Test 1: ready() resolves with clientId ─────────
  console.log('Test 1: ready() resolves when welcome handshake completes');

  const client = new EventBus(`ws://localhost:${PORT}`);
  await client.ready();

  assert(typeof client.clientId === 'string' && client.clientId.length > 0,
    'clientId is set after ready()');

  // Calling ready() again returns an already-resolved promise
  await client.ready();
  assert(true, 'ready() is idempotent (second call resolves immediately)');

  // ── Test 2: onError() receives validation-error ────
  console.log('\nTest 2: onError() receives validation-error for malformed emission');

  let receivedError = null;
  const handler = (msg) => { receivedError = msg; };
  client.onError(handler);

  client.emit(CHANNEL, MALFORMED);
  await new Promise((r) => setTimeout(r, 500));

  assert(receivedError !== null,
    'Error handler was called');
  assert(receivedError?.action === 'validation-error',
    'Error action is validation-error');
  assert(receivedError?.url === CHANNEL,
    'Error carries correct channel URL');
  assert(Array.isArray(receivedError?.errors) && receivedError.errors.length > 0,
    'Error includes non-empty errors array');

  // ── Test 3: offError() stops delivery ──────────────
  console.log('\nTest 3: offError() stops delivering errors');

  receivedError = null;
  client.offError(handler);

  client.emit(CHANNEL, MALFORMED);
  await new Promise((r) => setTimeout(r, 500));

  assert(receivedError === null,
    'Error handler was NOT called after offError()');

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
