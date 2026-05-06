/**
 * lib/state-service/StateService.js
 *
 * Stateless state aggregator. All methods are pure functions over
 * LogService.entries — the service holds no mutable state of its own.
 *
 * computeStateAt(n) is deterministic: same log produces the same state,
 * byte-equal, every time.
 */

const ACTIVATED_CHANNEL   = 'cgp:/r/events/activated.md';
const CSV_DROPPED_CHANNEL = 'cgp:/r/events/csv-dropped.md';

export class StateService {
  /**
   * @param {import('../log-service/LogService.js').LogService} logService
   */
  constructor(logService) {
    this._logService = logService;
  }

  /**
   * Pure function. Filters LogService.entries to seq <= n AND accepted,
   * runs the observatron+spike aggregation reducer, returns the snapshot.
   *
   * @param {number} n  Compute state as of this seq number.
   * @returns {{ observatrons: Array<object> }}
   */
  computeStateAt(n) {
    const observatrons = new Map();

    for (const entry of this._logService.entries) {
      if (entry.seq > n) break;
      if (!entry.accepted) continue;

      if (entry.channel === ACTIVATED_CHANNEL) {
        const payload = entry.payload;
        const url = payload['/context']?.anchor?.[0];
        if (!url) continue;
        const existing = observatrons.get(url);
        if (existing) {
          existing.entry = payload;
        } else {
          observatrons.set(url, { entry: payload, spikes: [] });
        }
      } else if (entry.channel === CSV_DROPPED_CHANNEL) {
        const spike = entry.payload;
        const parentUrl = spike['/context']?.source?.[0];
        if (!parentUrl) continue;
        let parent = observatrons.get(parentUrl);
        if (!parent) {
          parent = {
            entry: { '/context': { anchor: [parentUrl] } },
            spikes: [],
          };
          observatrons.set(parentUrl, parent);
        }
        parent.spikes.push(spike);
      }
    }

    return {
      observatrons: [...observatrons.values()].map(({ entry, spikes }) => {
        const url = entry['/context']?.anchor?.[0] ?? null;
        const obj = { url };
        if (entry['/data'])      obj['/data']      = entry['/data'];
        if (entry['/meaning'])   obj['/meaning']   = entry['/meaning'];
        if (entry['/structure']) obj['/structure']  = entry['/structure'];
        if (entry['/context'])   obj['/context']    = entry['/context'];
        obj.spikes = spikes;
        return obj;
      }),
    };
  }

  /**
   * @returns {{ state: object, seq: number }}
   */
  getCurrentState() {
    const seq = this._logService.maxSeq;
    return { state: this.computeStateAt(seq), seq };
  }
}
