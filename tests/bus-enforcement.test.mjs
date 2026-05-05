/**
 * tests/bus-enforcement.test.mjs
 *
 * Integration test: verifies the event bus rejects non-conformant emissions
 * over a real WebSocket connection and broadcasts conformant ones to
 * subscribers only (no echo to the emitter).
 *
 * Self-contained: spawns the bus, runs assertions, cleans up.
 * Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const PORT = 8081;
const CHANNEL = 'cgp:/r/events/csv-dropped.md';

let bus, wsA, wsB;
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`);
  else     { console.log(`  FAIL  ${label}`); failures++; }
}

// ── Canonical spike from r/meta/schema.md ────────────────

const CONFORMANT = {
  "/data":      { "value": ["2026-01-15", "2026-01-16", "2026-01-17"] },
  "/meaning":   { "key": ["Date"], "value": ["The trade execution date in ISO format."] },
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

// Malformed: same spike with /data removed
const MALFORMED = {
  "/meaning":   CONFORMANT["/meaning"],
  "/structure": CONFORMANT["/structure"],
  "/context":   CONFORMANT["/context"]
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
  for (const ws of [wsA, wsB]) {
    try { if (ws?.readyState <= 1) ws.close(); } catch {}
  }
  if (bus && !bus.killed) bus.kill();
}

// Ensure the bus child process is killed on exit
process.on('exit', cleanup);

// ── Main ─────────────────────────────────────────────────

async function run() {
  console.log('bus-enforcement: starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.\n');

  wsA = await connect('Client A');
  wsB = await connect('Client B');

  // Client A subscribes to the csv-dropped channel
  wsA.send(JSON.stringify({ action: 'subscribe', url: CHANNEL }));
  await new Promise((r) => setTimeout(r, 200));

  // ── Test 1: malformed payload is rejected ──────────
  console.log('Test 1: Malformed emission (missing /data) is rejected');

  wsB.send(JSON.stringify({ action: 'emit', url: CHANNEL, payload: MALFORMED }));

  const err = await nextMsg(wsB);
  assert(err !== null && err.action === 'validation-error',
    'Client B receives validation-error');
  assert(err?.url === CHANNEL,
    'validation-error carries correct channel URL');
  assert(Array.isArray(err?.errors) && err.errors.length > 0,
    'validation-error includes non-empty errors array');

  // Client A must NOT receive the malformed payload
  const leak = await nextMsg(wsA, 500);
  assert(leak === null,
    'Client A receives nothing (malformed payload not propagated)');

  // ── Test 2: conformant payload is broadcast ────────
  console.log('\nTest 2: Conformant emission is broadcast to subscriber');

  wsB.send(JSON.stringify({ action: 'emit', url: CHANNEL, payload: CONFORMANT }));

  const broadcast = await nextMsg(wsA);
  assert(broadcast !== null && broadcast.event === CHANNEL,
    'Client A receives broadcast on correct channel');
  assert(
    broadcast !== null &&
    JSON.stringify(broadcast.payload) === JSON.stringify(CONFORMANT),
    'Broadcast payload matches the emitted conformant spike'
  );

  // Client B must NOT receive its own emission (no echo)
  const echo = await nextMsg(wsB, 500);
  assert(echo === null,
    'Client B does NOT receive its own broadcast (no echo)');

  // ── Done ───────────────────────────────────────────
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
