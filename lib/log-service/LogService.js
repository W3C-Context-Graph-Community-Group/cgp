/**
 * lib/log-service/LogService.js
 *
 * Source-of-truth ordered log. Subscribes to the event bus and records
 * every accepted broadcast and every validation rejection as a LogEntry.
 *
 * LogEntry shape (internal, no JSON schema):
 *   { seq, channel, from, timestamp, payload, accepted }
 *
 * StateService reads from LogService.entries — it never subscribes to
 * the bus directly.
 */

const ACTIVATED_CHANNEL   = 'cgp:/r/events/activated.md';
const CSV_DROPPED_CHANNEL = 'cgp:/r/events/csv-dropped.md';
const REJECTION_CHANNEL   = 'cgp:/internal/validation-errors';

export class LogService {
  /**
   * @param {import('../event-bus/client.js').EventBus} [bus]
   *   Optional bus client. If provided, the service auto-subscribes to
   *   both alpha event channels and the validation-error stream.
   */
  constructor(bus) {
    /** @type {Array<object>} Append-only ordered log. */
    this.entries = [];
    this._seq = 0;
    this._subscribers = new Set();

    if (bus) {
      bus.on(ACTIVATED_CHANNEL, (msg) => {
        this.append({
          channel: msg.event,
          from: msg.from,
          payload: msg.payload,
          accepted: true,
        });
      });

      bus.on(CSV_DROPPED_CHANNEL, (msg) => {
        this.append({
          channel: msg.event,
          from: msg.from,
          payload: msg.payload,
          accepted: true,
        });
      });

      bus.on(REJECTION_CHANNEL, (msg) => {
        this.append({
          channel: msg.payload.url,
          from: msg.from,
          payload: msg.payload,
          accepted: false,
        });
      });
    }
  }

  /**
   * Append a new entry to the log.
   * Assigns a monotonic seq (gap-free, starting at 1) and an ISO timestamp.
   * Notifies all subscribers synchronously after appending.
   *
   * @param {object} opts
   * @param {string} opts.channel  The cgp:/ event URL.
   * @param {*}      opts.from     Bus client id of the emitter.
   * @param {object} opts.payload  Raw payload or rejection envelope.
   * @param {boolean} opts.accepted  true for valid events, false for rejections.
   * @returns {object} The stored LogEntry.
   */
  append({ channel, from, payload, accepted }) {
    const entry = {
      seq: ++this._seq,
      channel,
      from,
      timestamp: new Date().toISOString(),
      payload,
      accepted,
    };
    this.entries.push(entry);
    for (const handler of this._subscribers) handler(entry);
    return entry;
  }

  /**
   * Return log entries with seq > since, in order.
   * @param {object} [opts]
   * @param {number} [opts.since=0]
   * @returns {Array<object>}
   */
  getLog({ since = 0 } = {}) {
    if (since === 0) return [...this.entries];
    return this.entries.filter((e) => e.seq > since);
  }

  /**
   * Subscribe to new entries. The handler is called synchronously on each
   * append with the new LogEntry.
   * @param {Function} handler
   * @returns {Function} Unsubscribe function.
   */
  subscribe(handler) {
    this._subscribers.add(handler);
    return () => this._subscribers.delete(handler);
  }

  /** Current highest seq number. */
  get maxSeq() {
    return this._seq;
  }
}
