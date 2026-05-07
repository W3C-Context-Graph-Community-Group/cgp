/**
 * lib/cgp-runtime/runtime.js
 *
 * Minimum CGP runtime. On DOMContentLoaded, queries [cgp-id] elements,
 * constructs a conformant observatron entry for each, and emits on
 * cgp:/r/events/activated.md via the event bus.
 *
 * buildObservatronEntry and buildSpikeEntry are exported as pure functions
 * so tests can call them without a DOM.
 */

const ACTIVATED_CHANNEL = 'cgp:/r/events/activated.md';
const CSV_CHANNEL = 'cgp:/r/events/csv-dropped.md';
const TASK_URL = 'cgp:/r/tasks/csv-dropped.md';
const COMPONENT_URL = 'cgp:/r/components/html/forms/drag-and-drop.md';

/**
 * Build a conformant observatron entry from an element's cgp- attributes.
 *
 * @param {Record<string, string>} attrs  Key-value pairs of cgp- attributes.
 *   Must include cgp-id, cgp-system-id, cgp-observatron-id.
 * @returns {object}  Four-facet observatron entry conforming to
 *   observatron.schema.json.
 */
export function buildObservatronEntry(attrs) {
  const systemId = attrs['cgp-system-id'] || '0';
  const obsId = attrs['cgp-observatron-id'] || '0';
  const componentId = attrs['cgp-id'];

  const observatronUrl = `cgp:/s/${systemId}/o/${obsId}`;
  const now = new Date().toISOString();

  // /data/value: all cgp- attributes except cgp-id, recorded verbatim
  const dataValue = {};
  for (const key of Object.keys(attrs)) {
    if (key === 'cgp-id') continue;
    dataValue[key] = attrs[key];
  }

  return {
    '/data': { value: dataValue },
    '/meaning': {
      key:   ['observatron'],
      value: ['Observes at a system boundary and follows policies of its intent map'],
    },
    '/structure': {
      key:   ['json-schema-2020-12'],
      value: [JSON.stringify({
        type: 'object',
        required: ['cgp-system-id', 'cgp-observatron-id', 'cgp-target', 'cgp-intent'],
        properties: {
          'cgp-system-id':      { type: 'string', description: 'System identifier' },
          'cgp-observatron-id': { type: 'string', description: 'Observatron identifier within the system' },
          'cgp-target':         { type: 'string', description: 'CSS selector for the observed DOM element' },
          'cgp-intent':         { type: 'string', description: 'JSON-encoded intent map referencing CGP policy URLs' },
        },
        additionalProperties: false,
      })],
    },
    '/context': {
      anchor: [observatronUrl, observatronUrl],
      source: [observatronUrl, observatronUrl],
      channel: [ACTIVATED_CHANNEL, ACTIVATED_CHANNEL],
      timestamp: [now, now],
      key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
      value: [TASK_URL, componentId],
    },
  };
}

/**
 * Build a conformant spike entry for a single CSV column.
 *
 * @param {object} opts
 * @param {string} opts.systemId        System scope ID.
 * @param {string} opts.observatronId   Observatron ID within system.
 * @param {number} opts.columnIndex     Zero-based column index.
 * @param {string} opts.columnHeader    Column header text (unused in entry but
 *   available for callers).
 * @param {string[]} opts.columnValues  Verbatim cell strings for this column.
 * @returns {object}  Four-facet spike entry conforming to spike.schema.json.
 */
export function buildSpikeEntry({ systemId, observatronId, columnIndex, columnHeader, columnValues }) {
  const obsUrl = `cgp:/s/${systemId}/o/${observatronId}`;
  const anchorUrl = `cgp:/s/${systemId}/o/${observatronId}/c/state-change/0/a/${columnIndex}/p/0`;
  const now = new Date().toISOString();

  return {
    '/data': { value: columnValues },
    '/meaning': { key: [], value: [] },
    '/structure': { key: [], value: [] },
    '/context': {
      anchor: [anchorUrl, anchorUrl],
      source: [obsUrl, obsUrl],
      channel: [CSV_CHANNEL, CSV_CHANNEL],
      timestamp: [now, now],
      key: ['cgp:/r/keys/task.md', 'cgp:/r/keys/component-type.md'],
      value: [TASK_URL, COMPONENT_URL],
    },
  };
}

// ── Browser runtime (only executes when loaded in a page) ──

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const { EventBus } = await import('../event-bus/client.js');
    const bus = new EventBus();
    await bus.ready();

    for (const el of document.querySelectorAll('[cgp-id]')) {
      const attrs = {};
      for (const { name, value } of el.attributes) {
        if (name.startsWith('cgp-')) attrs[name] = value;
      }

      const entry = buildObservatronEntry(attrs);

      let rejected = false;
      const onErr = (msg) => {
        if (msg.url === ACTIVATED_CHANNEL) {
          rejected = true;
          console.error('[cgp] Bus rejected observatron:', msg.errors);
        }
      };
      bus.onError(onErr);
      bus.emit(ACTIVATED_CHANNEL, entry);

      // Give the bus a moment to respond with a rejection (or silence)
      await new Promise((r) => setTimeout(r, 300));
      bus.offError(onErr);

      if (!rejected) {
        console.log(`[cgp] Observatron activated: ${attrs['cgp-id']}`);
      }

      // ── Drop handling for elements with cgp-target ──

      const targetSelector = attrs['cgp-target'];
      if (!targetSelector) continue;
      const target = el.querySelector(targetSelector);
      if (!target) continue;

      const systemId = attrs['cgp-system-id'] || '0';
      const observatronId = attrs['cgp-observatron-id'] || '0';

      /** Dispatch a custom event on the target so the HTML page can style it. */
      const signal = (state, detail) =>
        target.dispatchEvent(new CustomEvent('cgp:dropzone', { detail: { state, ...detail } }));

      target.addEventListener('dragenter', (e) => {
        e.preventDefault();
        signal('active');
      });

      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        signal('active');
      });

      target.addEventListener('dragleave', () => {
        signal('neutral');
      });

      target.addEventListener('drop', async (e) => {
        e.preventDefault();
        signal('neutral');

        const file = e.dataTransfer?.files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length === 0) return;

        // Minimal CSV parse (~10 lines, alpha-quality, no quoted-comma handling)
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1);
        const numCols = headers.length;

        let emitted = 0;
        let errors = 0;

        for (let colIdx = 0; colIdx < numCols; colIdx++) {
          const columnValues = rows.map((row) => {
            const cells = row.split(',');
            return cells[colIdx] !== undefined ? cells[colIdx].trim() : '';
          });

          const spike = buildSpikeEntry({
            systemId,
            observatronId,
            columnIndex: colIdx,
            columnHeader: headers[colIdx],
            columnValues,
          });

          let spikeRejected = false;
          const onSpikeErr = (msg) => {
            if (msg.url === CSV_CHANNEL) {
              spikeRejected = true;
              console.error(`[cgp] Spike ${colIdx} rejected:`, msg.errors);
            }
          };

          bus.onError(onSpikeErr);
          bus.emit(CSV_CHANNEL, spike);
          await new Promise((r) => setTimeout(r, 300));
          bus.offError(onSpikeErr);

          if (spikeRejected) errors++;
          else emitted++;
        }

        signal('done', { count: emitted, errors });
      });
    }
  });
}
