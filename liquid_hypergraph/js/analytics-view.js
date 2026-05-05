// analytics-view.js — CgpAnalyticsView: delta gauges, stats, graph summary

import { computeDarkFraction, formatDelta, createGauge } from './dark-fraction.js';

export class CgpAnalyticsView {
  constructor(resolver, container) {
    this._resolver = resolver;
    this._container = container;
    this._selectedUrl = null;
  }

  selectUrl(url) {
    this._selectedUrl = url;
    this._render();
  }

  refreshGraphSummary() {
    this._render();
  }

  // --- Private ---

  _render() {
    this._container.innerHTML = '';

    if (this._selectedUrl) {
      this._renderSelectedNodeDelta();
      this._renderSubtreeDelta();
    } else {
      const empty = document.createElement('div');
      empty.className = 'lh-analytics__empty';
      empty.textContent = 'Select a node';
      this._container.appendChild(empty);
    }

    this._renderTrendPlaceholder();
    this._renderDistPlaceholder();
    this._renderGraphSummary();
  }

  _renderSelectedNodeDelta() {
    const section = document.createElement('div');
    section.className = 'lh-analytics__section';

    const title = document.createElement('div');
    title.className = 'lh-analytics__section-title';
    title.textContent = 'Selected Node \u03b4';
    section.appendChild(title);

    const m = 1;
    const r = this._countVerifiedFacets(this._selectedUrl);
    const result = computeDarkFraction(m, r);

    // Gauge
    const gaugeWrap = document.createElement('div');
    gaugeWrap.className = 'lh-analytics__gauge';
    gaugeWrap.appendChild(createGauge(result.delta, result.phi, 140));
    section.appendChild(gaugeWrap);

    // Stats
    const stats = document.createElement('div');
    stats.className = 'lh-analytics__stat';
    stats.appendChild(this._createStatCard('m', String(m)));
    stats.appendChild(this._createStatCard('n', String(result.n)));
    stats.appendChild(this._createStatCard('r', String(r)));
    section.appendChild(stats);

    this._container.appendChild(section);
  }

  _renderSubtreeDelta() {
    const subtreeUrls = this._getSubtreeUrls(this._selectedUrl);
    if (subtreeUrls.length <= 1) return; // No subtree beyond the node itself

    const section = document.createElement('div');
    section.className = 'lh-analytics__section';

    const title = document.createElement('div');
    title.className = 'lh-analytics__section-title';
    title.textContent = 'Subtree \u03b4';
    section.appendChild(title);

    const m = subtreeUrls.length;
    let r = 0;
    for (const url of subtreeUrls) {
      r += this._countVerifiedFacets(url);
    }
    const result = computeDarkFraction(m, r);

    // Gauge
    const gaugeWrap = document.createElement('div');
    gaugeWrap.className = 'lh-analytics__gauge';
    gaugeWrap.appendChild(createGauge(result.delta, result.phi, 120));
    section.appendChild(gaugeWrap);

    // Stats
    const stats = document.createElement('div');
    stats.className = 'lh-analytics__stat';
    stats.appendChild(this._createStatCard('URLs', String(m)));
    stats.appendChild(this._createStatCard('n', String(result.n)));
    stats.appendChild(this._createStatCard('r', String(r)));
    section.appendChild(stats);

    this._container.appendChild(section);
  }

  _renderTrendPlaceholder() {
    const ph = document.createElement('div');
    ph.className = 'lh-analytics__placeholder';
    ph.id = 'lh-delta-trend';

    const title = document.createElement('div');
    title.className = 'lh-analytics__placeholder-title';
    title.textContent = '\u03b4 Trend';
    ph.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'lh-analytics__placeholder-desc';
    desc.textContent = 'Using /context timestamps, plot delta as a time series. Leading-indicator reading \u2014 delta climbing means coverage is decreasing.';
    ph.appendChild(desc);

    this._container.appendChild(ph);
  }

  _renderDistPlaceholder() {
    const ph = document.createElement('div');
    ph.className = 'lh-analytics__placeholder';
    ph.id = 'lh-delta-distribution';

    const title = document.createElement('div');
    title.className = 'lh-analytics__placeholder-title';
    title.textContent = '\u03b4 Distribution';
    ph.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'lh-analytics__placeholder-desc';
    desc.textContent = 'Group spikes by channel and compute delta per channel. Shows which kinds of events are well-verified and which aren\u2019t.';
    ph.appendChild(desc);

    this._container.appendChild(ph);
  }

  _renderGraphSummary() {
    const section = document.createElement('div');
    section.className = 'lh-analytics__section';

    const title = document.createElement('div');
    title.className = 'lh-analytics__section-title';
    title.textContent = 'Graph Summary';
    section.appendChild(title);

    const urls = this._resolver.urls();
    const protocol = urls.filter(u => u.startsWith('cgp:/root/'));
    const library  = urls.filter(u => u.startsWith('cgp:/core/'));
    const user     = urls.filter(u => u.startsWith('cgp:/s/'));

    // Total
    const totalRow = document.createElement('div');
    totalRow.className = 'lh-analytics__ns-row';
    totalRow.innerHTML = `<span class="lh-analytics__ns-label">Total URLs</span><span class="lh-analytics__ns-count">${urls.length}</span>`;
    section.appendChild(totalRow);

    const divider1 = document.createElement('hr');
    divider1.className = 'lh-analytics__divider';
    section.appendChild(divider1);

    // Namespace breakdown
    const namespaces = [
      { label: 'Protocol', count: protocol.length },
      { label: 'Library', count: library.length },
      { label: 'User', count: user.length }
    ];
    for (const ns of namespaces) {
      const row = document.createElement('div');
      row.className = 'lh-analytics__ns-row';
      row.innerHTML = `<span class="lh-analytics__ns-label">${ns.label}</span><span class="lh-analytics__ns-count">${ns.count}</span>`;
      section.appendChild(row);
    }

    const divider2 = document.createElement('hr');
    divider2.className = 'lh-analytics__divider';
    section.appendChild(divider2);

    // Kind breakdown
    const kindColors = {
      system: '#F59E0B', observatron: '#4ECDC4', event: '#89b4fa',
      anchor: '#a78bfa', path: '#34d399'
    };
    const kindCounts = { system: 0, observatron: 0, event: 0, anchor: 0, path: 0 };
    for (const url of user) {
      const kind = this._inferKind(url);
      if (kindCounts[kind] !== undefined) kindCounts[kind]++;
    }

    for (const [kind, count] of Object.entries(kindCounts)) {
      const row = document.createElement('div');
      row.className = 'lh-analytics__kind-row';

      const dot = document.createElement('span');
      dot.className = 'lh-analytics__kind-dot';
      dot.style.background = kindColors[kind];
      row.appendChild(dot);

      const label = document.createElement('span');
      label.className = 'lh-analytics__kind-label';
      label.textContent = kind.charAt(0).toUpperCase() + kind.slice(1) + 's';
      row.appendChild(label);

      const countEl = document.createElement('span');
      countEl.className = 'lh-analytics__kind-count';
      countEl.textContent = String(count);
      row.appendChild(countEl);

      section.appendChild(row);
    }

    this._container.appendChild(section);
  }

  _createStatCard(label, value) {
    const card = document.createElement('div');
    card.className = 'lh-analytics__stat-card';

    const valEl = document.createElement('div');
    valEl.className = 'lh-analytics__stat-value';
    valEl.textContent = value;
    card.appendChild(valEl);

    const labelEl = document.createElement('div');
    labelEl.className = 'lh-analytics__stat-label';
    labelEl.textContent = label;
    card.appendChild(labelEl);

    return card;
  }

  _countVerifiedFacets(url) {
    const data = this._resolver.resolve(url);
    if (!data) return 0;
    const facets = data.facets || data;
    let count = 0;

    // /meaning: any array with length > 0
    const meaning = facets['/meaning'];
    if (meaning && typeof meaning === 'object') {
      for (const val of Object.values(meaning)) {
        if (Array.isArray(val) && val.length > 0) { count++; break; }
      }
    }

    // /structure: any array with length > 0
    const structure = facets['/structure'];
    if (structure && typeof structure === 'object') {
      for (const val of Object.values(structure)) {
        if (Array.isArray(val) && val.length > 0) { count++; break; }
      }
    }

    // /context: any array with length > 0
    const context = facets['/context'];
    if (context && typeof context === 'object') {
      for (const val of Object.values(context)) {
        if (Array.isArray(val) && val.length > 0) { count++; break; }
      }
    }

    return count;
  }

  _getSubtreeUrls(url) {
    const prefix = url.endsWith('/') ? url : url + '/';
    return this._resolver.urls().filter(u => u === url || u.startsWith(prefix));
  }

  _inferKind(url) {
    if (url.startsWith('cgp:/root/')) return 'protocol';
    if (url.startsWith('cgp:/core/')) return 'component';

    const match = url.match(/^cgp:\/s\/(.*)$/);
    if (!match) return 'protocol';

    const segments = match[1].split('/').filter(Boolean);
    const len = segments.length;

    if (len <= 1) return 'system';
    if (len <= 3) return 'observatron';
    if (len <= 5) return 'event';
    if (len <= 7) return 'anchor';
    return 'path';
  }
}
