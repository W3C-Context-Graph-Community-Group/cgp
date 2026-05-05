import { SchemaService } from '../lib/schema-service/SchemaService.js';
import { resolve } from 'node:path';

const root = resolve('.');
const schemas = new SchemaService();

// Step 1: Load schemas from r/schemas/ (keyed by $id)
const schemaCount = await schemas.loadDir(resolve(root, 'r/schemas'));
console.log(`Schemas loaded: ${schemaCount}`);

// Step 2: Load event bindings from r/events/
const bindingCount = await schemas.loadEventBindings(resolve(root, 'r/events'));
console.log(`Event bindings registered: ${bindingCount}`);

// Test 1: Channel URLs are registered
const hasActivated = schemas.has('cgp:/r/events/activated.md');
const hasCsvDropped = schemas.has('cgp:/r/events/csv-dropped.md');
console.log(`\nschemas.has('cgp:/r/events/activated.md'): ${hasActivated}`);
console.log(`schemas.has('cgp:/r/events/csv-dropped.md'): ${hasCsvDropped}`);
console.assert(hasActivated, 'activated channel should be registered');
console.assert(hasCsvDropped, 'csv-dropped channel should be registered');

// Test 2: Validate canonical observatron against activated channel
const observatron = {
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
  "/structure": {
    "key": [],
    "value": []
  },
  "/context": {
    "anchor": ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "source": ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "channel": ["cgp:/r/events/activated.md", "cgp:/r/events/activated.md"],
    "timestamp": ["2026-05-02T13:22:55.774Z", "2026-05-02T13:22:55.774Z"],
    "key": ["cgp:/r/keys/task.md", "cgp:/r/keys/component-type.md"],
    "value": ["cgp:/r/tasks/csv-dropped.md", "cgp:/r/components/html/forms/drag-and-drop.md"]
  }
};

const r1 = schemas.validate('cgp:/r/events/activated.md', observatron);
console.log(`\nObservatron vs activated channel: valid=${r1.valid}`);
console.assert(r1.valid, 'Canonical observatron should pass');

// Test 3: Validate canonical spike against csv-dropped channel
const spike = {
  "/data": {
    "value": ["2026-01-15", "2026-01-16", "2026-01-17"]
  },
  "/meaning": {
    "key": ["Date"],
    "value": ["The trade execution date in ISO format."]
  },
  "/structure": {
    "key": ["json-schema-2020-12"],
    "value": ["{\"type\":\"array\",\"items\":{\"type\":\"string\",\"format\":\"date\"}}"]
  },
  "/context": {
    "anchor": [
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0",
      "cgp:/s/0/o/0/c/state-change/0/a/0/p/0"
    ],
    "source": ["cgp:/s/0/o/0", "cgp:/s/0/o/0"],
    "channel": ["cgp:/r/events/csv-dropped.md", "cgp:/r/events/csv-dropped.md"],
    "timestamp": ["2026-05-02T13:23:24.034Z", "2026-05-02T13:23:24.034Z"],
    "key": ["cgp:/r/keys/task.md", "cgp:/r/keys/component-type.md"],
    "value": ["cgp:/r/tasks/csv-dropped.md", "cgp:/r/components/html/forms/drag-and-drop.md"]
  }
};

const r2 = schemas.validate('cgp:/r/events/csv-dropped.md', spike);
console.log(`Spike vs csv-dropped channel: valid=${r2.valid}`);
console.assert(r2.valid, 'Canonical spike should pass');

// Test 4: Malformed entry (missing /data) must fail
const malformed = { ...spike };
delete malformed['/data'];

const r3 = schemas.validate('cgp:/r/events/csv-dropped.md', malformed);
console.log(`\nMalformed (no /data) vs csv-dropped: valid=${r3.valid}`);
console.log(`Error path: ${r3.errors?.[0]?.instancePath || '(root)'} — ${r3.errors?.[0]?.message}`);
console.assert(!r3.valid, 'Malformed entry should fail');

console.log('\n--- All assertions passed ---');
