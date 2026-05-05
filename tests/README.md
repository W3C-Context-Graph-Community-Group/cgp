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
