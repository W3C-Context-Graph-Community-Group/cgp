// ============================================================
// FourFacetModel — canonical columnar four-facet generator
// ============================================================

export class FourFacetModel {
  /**
   * @param {string}   url   — the spike's URL (becomes /data anchor)
   * @param {string}   name  — human label (goes into /meaning)
   * @param {Function} rand  — () => number in [0,1)
   */
  static createRandom({ url, name, rand }) {
    const hasMeaning   = rand() < 0.5;
    const hasStructure = rand() < 0.5;
    const hasContext    = rand() < 0.5;

    return {
      '/data': { anchor: [url] },

      '/meaning': hasMeaning
        ? { symbol: [url], meaning: [name] }
        : { symbol: [], meaning: [] },

      '/structure': hasStructure
        ? { 'constraint-key': ['kind'], 'constraint-value': ['column'] }
        : { 'constraint-key': [], 'constraint-value': [] },

      '/context': hasContext
        ? { timestamp: [new Date().toISOString()],
            channel: ['path-minted'], key: ['header'], value: [name] }
        : { timestamp: [], channel: [], key: [], value: [] },
    };
  }
}
