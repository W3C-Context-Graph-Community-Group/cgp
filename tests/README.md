# Tests

## Convention

Each test file ends in `.test.mjs`, runs with plain `node`, and exits with
status `0` on success or `1` on failure.

No test framework is required — tests use only Node.js built-in APIs and
dependencies already in `package.json`.

## Running

```
npm test
```

## What each test covers

- **schema-binding.test.mjs** — Verifies SchemaService binds schemas to
  channel URLs correctly. Unit-level: loads schemas and event bindings,
  validates canonical payloads, and confirms malformed payloads are rejected.

- **bus-enforcement.test.mjs** — Verifies the bus rejects non-conformant
  emissions over a real WebSocket connection. Integration-level: spawns the bus
  as a child process, connects two WebSocket clients, and confirms that
  malformed payloads produce a `validation-error` (and are not propagated to
  subscribers), while conformant payloads are broadcast to subscribers without
  echoing back to the emitter.

- **client-api.test.mjs** — Exercises the EventBus client's `ready()`,
  `onError()`, and `offError()` methods. Spawns the bus, creates an EventBus
  instance, verifies `ready()` resolves with a `clientId`, verifies `onError()`
  delivers validation-error messages, and verifies `offError()` stops delivery.

- **log-viewer.test.mjs** — Proves the subscribe-and-display data flow used by
  `log/index.html`: a subscriber client listening on both alpha event channels
  receives payloads emitted by a separate client.

- **state-aggregation.test.mjs** — Proves the subscribe-and-receive data flow
  used by `state/index.html`: a subscriber listening on both alpha channels
  receives an observatron and two child spikes emitted by a separate client,
  with correct event/from/payload structure and spike source pointing to the
  observatron's anchor.

- **runtime-observatron-conformance.test.mjs** — Verifies the runtime's
  `buildObservatronEntry` function produces a conformant observatron entry.
  Validates the entry against `observatron.schema.json` locally, then spawns the
  bus and confirms the entry is accepted and broadcast on
  `cgp:/r/events/activated.md`.
