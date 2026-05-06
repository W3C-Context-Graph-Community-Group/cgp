// ============================================================
// ObservatronChannelManager
// channel → event → anchor → path hierarchy + URL minting
// ============================================================

import { FourFacetModel } from './four-facet-model.js';

function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randIntIn(rand, lo, hi) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

export class ObservatronChannelManager {
  /**
   * @param {object} opts
   * @param {string} [opts.systemId='0']
   * @param {string} [opts.observatronId='0']
   */
  constructor({ systemId = '0', observatronId = '0' } = {}) {
    this._systemId = systemId;
    this._observatronId = observatronId;
    /** @type {Map<string, object[]>} channelName → array of events */
    this._channels = new Map();
    /** @type {Map<string, number>} channelName → next event index */
    this._counters = new Map();
  }

  get systemUrl()      { return `cgp:/s/${this._systemId}`; }
  get observatronUrl() { return `${this.systemUrl}/o/${this._observatronId}`; }

  /**
   * Generate random events from a seed.
   * @param {number} seed
   * @param {object} [opts]
   * @param {{min:number,max:number}|null} [opts.channelsRange] — channel count range
   * @param {{min:number,max:number}|null} [opts.eventsRange]   — events per channel range
   * @param {{min:number,max:number}|null} [opts.anchorsRange]  — anchors per event range
   * @param {{min:number,max:number}|null} [opts.pathsRange]    — paths per anchor range
   */
  seed(seed, { channelsRange = null, eventsRange = null, anchorsRange = null, pathsRange = null } = {}) {
    this.reset();
    const rand = prng(seed);

    const numChannels = channelsRange
      ? randIntIn(rand, channelsRange.min, channelsRange.max)
      : 1;

    for (let ci = 0; ci < numChannels; ci++) {
      const channelName = numChannels === 1 ? 'state-change' : `ch-${ci}`;

      const numEvents = eventsRange
        ? randIntIn(rand, eventsRange.min, eventsRange.max)
        : randIntIn(rand, 1, 3);

      for (let ei = 0; ei < numEvents; ei++) {
        const eventUrl = this._mintEvent(channelName);

        const numAnchors = anchorsRange
          ? randIntIn(rand, anchorsRange.min, anchorsRange.max)
          : 1;

        for (let ai = 0; ai < numAnchors; ai++) {
          const anchorUrl = `${eventUrl}/a/${ai}`;

          const numPaths = pathsRange
            ? randIntIn(rand, pathsRange.min, pathsRange.max)
            : randIntIn(rand, 1, 5);

          const columns = [];
          for (let pi = 0; pi < numPaths; pi++) {
            const pathUrl = `${anchorUrl}/p/${pi}`;
            columns.push({
              name: `col-${pi + 1}`,
              url: pathUrl,
              facets: FourFacetModel.createRandom({ url: pathUrl, name: `col-${pi + 1}`, rand }),
            });
          }
          this._pushEvent(channelName, eventUrl, anchorUrl, columns);
        }
      }
    }
  }

  /** Clear all channels and events. */
  reset() {
    this._channels.clear();
    this._counters.clear();
  }

  /** All events across all channels (for _deriveSpikes). */
  get events() {
    const all = [];
    for (const evts of this._channels.values()) {
      for (const e of evts) all.push(e);
    }
    return all;
  }

  /** Total event/region count across all channels. */
  get eventCount() {
    let count = 0;
    for (const evts of this._channels.values()) count += evts.length;
    return count;
  }

  /** Number of distinct channels. */
  get channelCount() {
    return this._channels.size;
  }

  /** Total anchor count across all events. */
  get anchorCount() {
    let count = 0;
    for (const evts of this._channels.values()) {
      for (const e of evts) count += e.attachments.length;
    }
    return count;
  }

  /** Total path/column count across all events. */
  get columnCount() {
    let count = 0;
    for (const evts of this._channels.values()) {
      for (const e of evts) {
        for (const a of e.attachments) count += a.columns.length;
      }
    }
    return count;
  }

  // ── internal ──

  _mintEvent(channelName) {
    const idx = this._counters.get(channelName) ?? 0;
    this._counters.set(channelName, idx + 1);
    return `${this.observatronUrl}/c/${channelName}/${idx}`;
  }

  _pushEvent(channelName, eventUrl, anchorUrl, columns) {
    if (!this._channels.has(channelName)) {
      this._channels.set(channelName, []);
    }
    const arr = this._channels.get(channelName);

    // find or create event
    let event = arr.find(e => e.url === eventUrl);
    if (!event) {
      event = {
        url: eventUrl,
        channel: channelName,
        timestamp: new Date().toISOString(),
        attachments: [],
      };
      arr.push(event);
    }

    event.attachments.push({
      url: anchorUrl,
      path: anchorUrl,
      columns,
    });
  }
}
