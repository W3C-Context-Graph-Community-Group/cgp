/**
 * tests/runtime-spike-conformance.test.mjs
 *
 * Verifies the runtime's buildSpikeEntry function produces a conformant
 * spike entry that:
 *   1. Passes validation against spike.schema.json via SchemaService
 *   2. Is accepted (not rejected) by the bus on cgp:/r/events/csv-dropped.md
 *   3. Works for a 3-column CSV — builds 3 spikes, all validate and broadcast
 *
 * Self-contained: spawns the bus, runs assertions, cleans up.
 * Exit 0 = all pass, exit 1 = any failure.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import WebSocket from 'ws';
import { SchemaService } from '../lib/schema-service/SchemaService.js';
import { buildSpikeEntry } from '../lib/cgp-runtime/runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUS_SCRIPT = join(__dirname, '..', 'lib', 'event-bus', 'server.js');
const ROOT = join(__dirname, '..');
const PORT = 8086;
const CHANNEL = 'cgp:/r/events/csv-dropped.md';

let bus, wsSub, wsEmit;
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  PASS  ${label}`);
  else     { console.log(`  FAIL  ${label}`); failures++; }
}

// Sample CSV-like input (single column)
const SAMPLE = {
  systemId: '0',
  observatronId: '0',
  columnIndex: 0,
  columnHeader: 'Date',
  columnValues: ['2026-01-15', '2026-01-16', '2026-01-17'],
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
  console.log('Test 1: buildSpikeEntry produces a conformant spike entry');

  const spike = buildSpikeEntry(SAMPLE);

  // Structural checks
  assert(Array.isArray(spike['/data'].value),
    '/data/value is an array (columnValues)');
  assert(spike['/data'].value.length === 3,
    '/data/value has 3 elements');
  assert(spike['/data'].value[0] === '2026-01-15',
    '/data/value[0] is verbatim');
  assert(spike['/meaning'].key.length === 0 && spike['/meaning'].value.length === 0,
    '/meaning is empty arrays');
  assert(spike['/structure'].key.length === 0 && spike['/structure'].value.length === 0,
    '/structure is empty arrays');
  assert(spike['/context'].key[0] === 'cgp:/r/keys/task.md',
    '/context key[0] is task');
  assert(spike['/context'].key[1] === 'cgp:/r/keys/component-type.md',
    '/context key[1] is component-type');
  assert(spike['/context'].value[0] === 'cgp:/r/tasks/csv-dropped.md',
    '/context value[0] is csv-dropped task');
  assert(spike['/context'].value[1] === 'cgp:/r/components/html/forms/drag-and-drop.md',
    '/context value[1] is drag-and-drop component');
  assert(spike['/context'].anchor[0] === 'cgp:/s/0/o/0/c/state-change/0/a/0/p/0',
    'anchor encodes column index 0');
  assert(spike['/context'].source[0] === 'cgp:/s/0/o/0',
    'source is observatron URL');
  assert(spike['/context'].channel[0] === CHANNEL,
    'channel is csv-dropped');
  assert(spike['/context'].timestamp[0] === spike['/context'].timestamp[1],
    'both timestamps are identical');

  // Validate against spike.schema.json via SchemaService
  const schemas = new SchemaService();
  await schemas.loadDir(resolve(ROOT, 'r', 'schemas'));
  await schemas.loadEventBindings(resolve(ROOT, 'r', 'events'));

  const result = schemas.validate(CHANNEL, spike);
  assert(result.valid,
    'Spike passes spike.schema.json via csv-dropped channel');
  if (!result.valid) {
    console.log('  Schema errors:', JSON.stringify(result.errors, null, 2));
  }

  // ── Test 2: Bus accepts and broadcasts ─────────────
  console.log('\nTest 2: Bus accepts and broadcasts the conformant spike');

  console.log('  Starting bus on port', PORT);
  await startBus();
  console.log('  Bus is listening.');

  wsSub = await connect('Subscriber');
  wsEmit = await connect('Emitter');

  // Subscriber listens on the csv-dropped channel
  wsSub.send(JSON.stringify({ action: 'subscribe', url: CHANNEL }));
  await new Promise((r) => setTimeout(r, 200));

  // Set up listeners BEFORE emitting
  const broadcastPromise = nextMsg(wsSub, 2000);
  const errPromise = nextMsg(wsEmit, 500);

  // Emitter sends the spike entry
  wsEmit.send(JSON.stringify({ action: 'emit', url: CHANNEL, payload: spike }));

  const errMsg = await errPromise;
  assert(errMsg === null,
    'Emitter receives no validation-error (spike accepted)');

  const broadcast = await broadcastPromise;
  assert(broadcast !== null && broadcast.event === CHANNEL,
    'Subscriber receives broadcast on csv-dropped channel');
  assert(
    broadcast !== null &&
    JSON.stringify(broadcast.payload) === JSON.stringify(spike),
    'Broadcast payload matches emitted spike'
  );

  // ── Test 3: 3-column CSV — all validate and broadcast ──
  console.log('\nTest 3: 3-column CSV — 3 spikes, all validate and broadcast');

  const columns = [
    { header: 'Date',    values: ['2026-01-15', '2026-01-16'] },
    { header: 'Product', values: ['Widget', 'Gadget'] },
    { header: 'Amount',  values: ['100', '200'] },
  ];

  for (let i = 0; i < columns.length; i++) {
    const s = buildSpikeEntry({
      systemId: '0',
      observatronId: '0',
      columnIndex: i,
      columnHeader: columns[i].header,
      columnValues: columns[i].values,
    });

    const v = schemas.validate(CHANNEL, s);
    assert(v.valid, `Column ${i} (${columns[i].header}) passes schema`);
    if (!v.valid) {
      console.log('  Schema errors:', JSON.stringify(v.errors, null, 2));
    }

    const bp = nextMsg(wsSub, 2000);
    const ep = nextMsg(wsEmit, 500);
    wsEmit.send(JSON.stringify({ action: 'emit', url: CHANNEL, payload: s }));

    const e = await ep;
    assert(e === null, `Column ${i} not rejected by bus`);

    const b = await bp;
    assert(b !== null && b.event === CHANNEL, `Column ${i} broadcast received`);
  }

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
