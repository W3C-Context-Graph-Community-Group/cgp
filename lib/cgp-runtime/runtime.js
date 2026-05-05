/**
 * lib/cgp-runtime/runtime.js
 *
 * Minimum CGP runtime. On DOMContentLoaded, queries [cgp-id] elements,
 * constructs a conformant observatron entry for each, and emits on
 * cgp:/r/events/activated.md via the event bus.
 *
 * buildObservatronEntry is exported as a pure function so tests can
 * call it without a DOM.
 */

const ACTIVATED_CHANNEL = 'cgp:/r/events/activated.md';
const TASK_URL = 'cgp:/r/tasks/csv-dropped.md';

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
    '/meaning': { key: [], value: [] },
    '/structure': { key: [], value: [] },
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
    }
  });
}
