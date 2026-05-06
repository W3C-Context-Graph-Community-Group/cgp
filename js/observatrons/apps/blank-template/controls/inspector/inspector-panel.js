/**
 * Right-column inspector panel with resizable width and tabbed views.
 * Shows the four facets of a selected spike in DOM or JSON view.
 */
export class InspectorPanel {
  /**
   * @param {object} opts
   * @param {number} [opts.initialWidth=320] — starting width in px
   * @param {number} [opts.minWidth=200]
   * @param {number} [opts.maxWidth=600]
   * @param {function} [opts.onResize] — called with (width) after resize
   */
  constructor({ initialWidth = 320, minWidth = 200, maxWidth = 600, onResize } = {}) {
    this._width = initialWidth;
    this._minWidth = minWidth;
    this._maxWidth = maxWidth;
    this._onResize = onResize || null;
    this._activeTab = 'dom';
    this._spikeUrl = null;
    this._facets = null;

    this.cssURL = new URL('inspector-panel.css', import.meta.url).href;
  }

  mount() {
    const el = document.createElement('div');
    el.className = 'inspector-panel';
    el.style.setProperty('--inspector-width', this._width + 'px');
    this._el = el;

    // ── Resizer ──
    const resizer = document.createElement('div');
    resizer.className = 'inspector-panel__resizer';
    el.appendChild(resizer);
    this._initResize(resizer);

    // ── Tabs ──
    const tabs = document.createElement('div');
    tabs.className = 'inspector-panel__tabs';

    this._domTab = this._createTab('DOM', 'dom');
    this._jsonTab = this._createTab('JSON', 'json');
    tabs.appendChild(this._domTab);
    tabs.appendChild(this._jsonTab);
    el.appendChild(tabs);

    // ── Body ──
    this._body = document.createElement('div');
    this._body.className = 'inspector-panel__body';
    el.appendChild(this._body);

    this._setTab('dom');
    this._renderBody();
    return el;
  }

  get width() { return this._width; }

  /**
   * Show a spike's four facets.
   * @param {string} url — the spike's CGP URL
   * @param {object} facets — { '/data': {...}, '/meaning': {...}, '/structure': {...}, '/context': {...} }
   */
  showSpike(url, facets) {
    this._spikeUrl = url;
    this._facets = facets;
    this._renderBody();
  }

  clear() {
    this._spikeUrl = null;
    this._facets = null;
    this._renderBody();
  }

  _createTab(label, key) {
    const btn = document.createElement('button');
    btn.className = 'inspector-panel__tab';
    btn.textContent = label;
    btn.addEventListener('click', () => this._setTab(key));
    return btn;
  }

  _setTab(key) {
    this._activeTab = key;
    this._domTab.classList.toggle('inspector-panel__tab--active', key === 'dom');
    this._jsonTab.classList.toggle('inspector-panel__tab--active', key === 'json');
    this._renderBody();
  }

  _renderBody() {
    if (!this._body) return;
    this._body.innerHTML = '';

    if (!this._spikeUrl || !this._facets) {
      const empty = document.createElement('div');
      empty.className = 'inspector-panel__empty';
      empty.textContent = 'Select a spike to inspect';
      this._body.appendChild(empty);
      return;
    }

    if (this._activeTab === 'dom') {
      this._renderDom();
    } else {
      this._renderJson();
    }
  }

  _renderDom() {
    // spike URL header
    const urlLabel = document.createElement('div');
    urlLabel.className = 'inspector-panel__field-label';
    urlLabel.textContent = 'Spike';
    this._body.appendChild(urlLabel);

    const urlValue = document.createElement('div');
    urlValue.className = 'inspector-panel__field-value';
    urlValue.textContent = this._spikeUrl;
    this._body.appendChild(urlValue);

    // four facets
    const facetOrder = ['/data', '/meaning', '/structure', '/context'];
    for (const facetName of facetOrder) {
      const facetData = this._facets[facetName];
      if (!facetData) continue;

      const section = document.createElement('div');
      section.className = 'inspector-panel__facet';

      const header = document.createElement('div');
      header.className = 'inspector-panel__facet-header';

      const dot = document.createElement('span');
      dot.className = 'inspector-panel__facet-dot';
      dot.classList.add(`inspector-panel__facet-dot--${facetName.slice(1)}`);
      const isEmpty = this._isFacetEmpty(facetData);
      if (isEmpty) dot.classList.add('inspector-panel__facet-dot--empty');
      header.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'inspector-panel__facet-name';
      name.textContent = facetName;
      header.appendChild(name);

      if (isEmpty) {
        const badge = document.createElement('span');
        badge.className = 'inspector-panel__facet-badge';
        badge.textContent = 'empty';
        header.appendChild(badge);
      }

      section.appendChild(header);

      if (!isEmpty) {
        const table = document.createElement('div');
        table.className = 'inspector-panel__facet-table';

        for (const [col, values] of Object.entries(facetData)) {
          const row = document.createElement('div');
          row.className = 'inspector-panel__facet-row';

          const colName = document.createElement('div');
          colName.className = 'inspector-panel__facet-col';
          colName.textContent = col;
          row.appendChild(colName);

          const colVals = document.createElement('div');
          colVals.className = 'inspector-panel__facet-vals';
          if (Array.isArray(values)) {
            for (const v of values) {
              const chip = document.createElement('span');
              chip.className = 'inspector-panel__facet-chip';
              chip.textContent = v;
              colVals.appendChild(chip);
            }
          } else {
            colVals.textContent = String(values);
          }
          row.appendChild(colVals);

          table.appendChild(row);
        }
        section.appendChild(table);
      }

      this._body.appendChild(section);
    }
  }

  _renderJson() {
    const pre = document.createElement('pre');
    pre.className = 'inspector-panel__json';
    pre.textContent = JSON.stringify(this._facets, null, 2);
    this._body.appendChild(pre);
  }

  _isFacetEmpty(facetData) {
    for (const v of Object.values(facetData)) {
      if (Array.isArray(v) && v.length > 0) return false;
      if (!Array.isArray(v) && v != null && v !== '') return false;
    }
    return true;
  }

  _initResize(handle) {
    let startX, startW;

    const onMove = (e) => {
      const dx = startX - e.clientX;
      const w = Math.min(this._maxWidth, Math.max(this._minWidth, startW + dx));
      this._width = w;
      this._el.style.setProperty('--inspector-width', w + 'px');
      if (this._onResize) this._onResize(w);
    };

    const onUp = () => {
      this._el.classList.remove('inspector-panel--resizing');
      removeEventListener('mousemove', onMove);
      removeEventListener('mouseup', onUp);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = this._width;
      this._el.classList.add('inspector-panel--resizing');
      addEventListener('mousemove', onMove);
      addEventListener('mouseup', onUp);
    });
  }

  dispose() {
    if (this._el) this._el.remove();
  }
}
