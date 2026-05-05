/**
 * tests/runtime-observatron-conformance.test.mjs
 *
 * Verifies the runtime's buildObservatronEntry function produces a
 * conformant observatron entry that:
 *   1. Passes validation against observatron.schema.json
 *   2. Is accepted (not rejected) by the bus on cgp:/r/events/activated.md
 *
 * Self-contained: spawns the bus, runs assertions, cleans up.
 * Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import WebSocket from 'ws';
import { SchemaService } from '../lib/schema-service/SchemaService.js';
import { buildObservatronEntry } from '../lib/cgp-runtime/runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const ROOT = join(__dirname, '..');
const PORT = 8082;
const CHANNEL = 'cgp:/r/events/activated.md';

let bus, wsSub, wsEmit;
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`);
  else     { console.log(`  FAIL  ${label}`); failures++; }
}

// The same attributes the demo HTML page carries
const ATTRS = {
  'cgp-id': 'cgp:/r/components/html/forms/drag-and-drop.md',
  'cgp-system-id': '0',
  'cgp-observatron-id': '0',
  'cgp-target': '.drop-zone',
  'cgp-intent': '{"cgp-policy":"cgp:/r/policies/parse-csv-headers.md"}',
};

// ── Helpers ──────────────────────────────────────────────

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

function connect(label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.once('error', reject);
    ws.once('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.action === 'welcome') {
        console.log(`  ${label} connected (id ${m.clientId})`);
        resolve(ws);
      }
    });
    setTimeout(() => reject(new Error(`${label}: no welcome`)), 5_000);
  });
}

/** Resolves with the next message on ws, or null after ms. */
function nextMsg(ws, ms = 2000) {
  return new Promise((resolve) => {
    const handler = (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    };
    ws.once('message', handler);
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(null);
    }, ms);
  });
}

function cleanup() {
  for (const ws of [wsSub, wsEmit]) {
    try { if (ws?.readyState <= 1) ws.close(); } catch {}
  }
  if (bus && !bus.killed) bus.kill();
}

process.on('exit', cleanup);

// ── Main ─────────────────────────────────────────────────

async function run() {
  // ── Test 1: Schema conformance (local validation) ──
  console.log('Test 1: buildObservatronEntry produces a conformant entry');

  const entry = buildObservatronEntry(ATTRS);

  // Structural checks
  assert(entry['/data']?.value !== undefined,
    '/data/value exists');
  assert(entry['/data'].value['cgp-id'] === undefined,
    'cgp-id excluded from /data/value');
  assert(entry['/data'].value['cgp-system-id'] === '0',
    '/data/value carries cgp-system-id verbatim');
  assert(entry['/data'].value['cgp-intent'] === ATTRS['cgp-intent'],
    '/data/value carries cgp-intent verbatim');
  assert(entry['/context'].key[0] === 'cgp:/r/keys/task.md',
    '/context key[0] is task');
  assert(entry['/context'].key[1] === 'cgp:/r/keys/component-type.md',
    '/context key[1] is component-type');
  assert(entry['/context'].value[1] === ATTRS['cgp-id'],
    '/context component-type value matches cgp-id');
  assert(entry['/context'].anchor[0] === entry['/context'].source[0],
    'anchor equals source (observatron writes about itself)');

  // Validate against the observatron schema via SchemaService
  const schemas = new SchemaService();
  await schemas.loadDir(resolve(ROOT, 'r', 'schemas'));
  await schemas.loadEventBindings(resolve(ROOT, 'r', 'events'));

  const result = schemas.validate(CHANNEL, entry);
  assert(result.valid,
    'Entry passes observatron.schema.json via activated channel');
  if (!result.valid) {
    console.log('  Schema errors:', JSON.stringify(result.errors, null, 2));
  }

  // ── Test 2: Bus accepts the entry (integration) ────
  console.log('\nTest 2: Bus accepts and broadcasts the conformant observatron');

  console.log('  Starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.');

  wsSub = await connect('Subscriber');
  wsEmit = await connect('Emitter');

  // Subscriber listens on the activated channel
  wsSub.send(JSON.stringify({ action: 'subscribe', url: CHANNEL }));
  await new Promise((r) => setTimeout(r, 200));

  // Set up listeners BEFORE emitting so no messages are lost
  const broadcastPromise = nextMsg(wsSub, 2000);
  const errPromise = nextMsg(wsEmit, 500);

  // Emitter sends the observatron entry
  wsEmit.send(JSON.stringify({ action: 'emit', url: CHANNEL, payload: entry }));

  const errMsg = await errPromise;
  assert(errMsg === null,
    'Emitter receives no validation-error (entry accepted)');

  const broadcast = await broadcastPromise;
  assert(broadcast !== null && broadcast.event === CHANNEL,
    'Subscriber receives broadcast on activated channel');
  assert(
    broadcast !== null &&
    JSON.stringify(broadcast.payload) === JSON.stringify(entry),
    'Broadcast payload matches emitted entry'
  );

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
