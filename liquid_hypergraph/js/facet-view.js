// facet-view.js — CgpFacetView: facet document view + JSON toggle

export class CgpFacetView {
  constructor(resolver, container) {
    this._resolver = resolver;
    this._container = container;
    this._selectedUrl = null;
    this._showJson = false;
    this._renderEmpty();
  }

  select(url) {
    this._selectedUrl = url;
    this._showJson = false;
    this._render();
  }

  // --- Private ---

  _render() {
    if (!this._selectedUrl) {
      this._renderEmpty();
      return;
    }

    const data = this._resolver.resolve(this._selectedUrl);
    if (!data) {
      this._container.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'lh-facet__empty';
      empty.textContent = 'No data for this URL';
      this._container.appendChild(empty);
      return;
    }

    if (this._showJson) {
      this._container.innerHTML = '';
      this._renderHeader(this._selectedUrl);
      this._renderJson(data);
    } else {
      this._container.innerHTML = '';
      this._renderHeader(this._selectedUrl);
      this._renderDocument(this._selectedUrl, data);
    }
  }

  _renderEmpty() {
    this._container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'lh-facet__empty';
    empty.textContent = 'Select a URL from the tree';
    this._container.appendChild(empty);
  }

  _renderHeader(url) {
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;';

    const urlDiv = document.createElement('div');
    urlDiv.className = 'lh-facet__url';
    urlDiv.textContent = url;
    header.appendChild(urlDiv);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'lh-facet__toggle' + (this._showJson ? ' lh-facet__toggle--active' : '');
    toggleBtn.textContent = this._showJson ? 'DOCUMENT' : 'RAW JSON';
    toggleBtn.addEventListener('click', () => this._toggleView());
    header.appendChild(toggleBtn);

    this._container.appendChild(header);
  }

  _renderDocument(url, data) {
    const facets = data.facets || data;

    this._renderDataSection(facets['/data']);
    this._renderMeaningSection(facets['/meaning']);
    this._renderStructureSection(facets['/structure']);
    this._renderContextSection(facets['/context']);
  }

  _renderDataSection(facetData) {
    const section = this._createSection('Data', 'data');

    if (!facetData || facetData.value == null) {
      section.body.innerHTML = '<span class="lh-facet__dim">\u2014</span>';
    } else {
      const payload = facetData.value;

      if (typeof payload === 'string' || typeof payload === 'number') {
        const span = document.createElement('span');
        span.textContent = String(payload);
        section.body.appendChild(span);

      } else if (Array.isArray(payload)) {
        const ul = document.createElement('ul');
        ul.className = 'lh-facet__list';
        for (const item of payload) {
          const li = document.createElement('li');
          li.textContent = String(item);
          ul.appendChild(li);
        }
        section.body.appendChild(ul);

      } else if (typeof payload === 'object' && payload !== null) {
        const table = document.createElement('table');
        table.className = 'lh-facet__table';
        const tbody = document.createElement('tbody');
        for (const [k, v] of Object.entries(payload)) {
          const tr = document.createElement('tr');
          const tdKey = document.createElement('td');
          tdKey.textContent = k;
          const tdVal = document.createElement('td');
          tdVal.textContent = typeof v === 'object' ? JSON.stringify(v) : String(v);
          tr.appendChild(tdKey);
          tr.appendChild(tdVal);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        section.body.appendChild(table);
      }
    }

    this._container.appendChild(section.el);
  }

  _renderMeaningSection(facetData) {
    const section = this._createSection('Meaning', 'meaning');

    const keys = facetData?.key || [];
    const values = facetData?.value || [];
    if (keys.length === 0 && values.length === 0) {
      section.body.innerHTML = '<span class="lh-facet__dim">\u2014</span>';
    } else {
      const table = document.createElement('table');
      table.className = 'lh-facet__table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Symbol</th><th>Meaning</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      const len = Math.max(keys.length, values.length);
      for (let i = 0; i < len; i++) {
        const tr = document.createElement('tr');
        const tdKey = document.createElement('td');
        tdKey.textContent = keys[i] || '';
        const tdVal = document.createElement('td');
        tdVal.textContent = values[i] || '';
        tr.appendChild(tdKey);
        tr.appendChild(tdVal);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      section.body.appendChild(table);
    }

    this._container.appendChild(section.el);
  }

  _renderStructureSection(facetData) {
    const section = this._createSection('Structure', 'structure');

    const keys = facetData?.key || [];
    const values = facetData?.value || [];
    if (keys.length === 0 && values.length === 0) {
      section.body.innerHTML = '<span class="lh-facet__dim">\u2014</span>';
    } else {
      const table = document.createElement('table');
      table.className = 'lh-facet__table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Key</th><th>Value</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      const len = Math.max(keys.length, values.length);
      for (let i = 0; i < len; i++) {
        const tr = document.createElement('tr');
        const tdKey = document.createElement('td');
        tdKey.textContent = keys[i] || '';
        const tdVal = document.createElement('td');
        tdVal.textContent = values[i] || '';
        tr.appendChild(tdKey);
        tr.appendChild(tdVal);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      section.body.appendChild(table);
    }

    this._container.appendChild(section.el);
  }

  _renderContextSection(facetData) {
    const section = this._createSection('Context', 'context');

    if (!facetData || Object.keys(facetData).length === 0) {
      section.body.innerHTML = '<span class="lh-facet__dim">\u2014</span>';
    } else {
      const anchors = facetData.anchor || [];
      const sources = facetData.source || [];
      const channels = facetData.channel || [];
      const timestamps = facetData.timestamp || [];
      const keys = facetData.key || [];
      const values = facetData.value || [];

      if (anchors.length > 0 || timestamps.length > 0 || channels.length > 0) {
        const table = document.createElement('table');
        table.className = 'lh-facet__table';

        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>Anchor</th><th>Source</th><th>Channel</th><th>Timestamp</th><th>Key</th><th>Value</th></tr>';
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const len = Math.max(anchors.length, sources.length, channels.length, timestamps.length, keys.length, values.length);
        for (let i = 0; i < len; i++) {
          const tr = document.createElement('tr');

          // Anchor
          const tdAnchor = document.createElement('td');
          const anchorVal = anchors[i];
          if (this._isUrl(String(anchorVal))) {
            tdAnchor.appendChild(this._createUrlLink(String(anchorVal)));
          } else {
            tdAnchor.textContent = String(anchorVal || '');
          }
          tr.appendChild(tdAnchor);

          // Source
          const tdSource = document.createElement('td');
          const sourceVal = sources[i];
          if (this._isUrl(String(sourceVal))) {
            tdSource.appendChild(this._createUrlLink(String(sourceVal)));
          } else {
            tdSource.textContent = String(sourceVal || '');
          }
          tr.appendChild(tdSource);

          // Channel
          const tdChan = document.createElement('td');
          const chanVal = channels[i];
          if (this._isUrl(String(chanVal))) {
            tdChan.appendChild(this._createUrlLink(String(chanVal)));
          } else {
            tdChan.textContent = String(chanVal || '');
          }
          tr.appendChild(tdChan);

          // Timestamp
          const tdTime = document.createElement('td');
          tdTime.textContent = timestamps[i] || '';
          tr.appendChild(tdTime);

          // Key
          const tdKey = document.createElement('td');
          tdKey.textContent = keys[i] || '';
          tr.appendChild(tdKey);

          // Value
          const tdVal = document.createElement('td');
          const val = values[i];
          if (this._isUrl(String(val))) {
            tdVal.appendChild(this._createUrlLink(String(val)));
          } else {
            tdVal.textContent = String(val || '');
          }
          tr.appendChild(tdVal);

          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        section.body.appendChild(table);
      } else {
        // Fallback: generic key-value
        const table = document.createElement('table');
        table.className = 'lh-facet__table';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>Key</th><th>Value</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (const [key, value] of Object.entries(facetData)) {
          const tr = document.createElement('tr');
          const tdKey = document.createElement('td');
          tdKey.textContent = key;
          const tdVal = document.createElement('td');
          tdVal.textContent = Array.isArray(value) ? value.join(', ') : String(value);
          tr.appendChild(tdKey);
          tr.appendChild(tdVal);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        section.body.appendChild(table);
      }
    }

    this._container.appendChild(section.el);
  }

  _createSection(title, facetType) {
    const el = document.createElement('div');
    el.className = 'lh-facet__section';

    const header = document.createElement('div');
    header.className = 'lh-facet__section-header';

    const dot = document.createElement('span');
    dot.className = `lh-facet__dot lh-facet__dot--${facetType}`;
    header.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = title;
    header.appendChild(label);

    el.appendChild(header);

    const body = document.createElement('div');
    body.className = 'lh-facet__section-body';
    el.appendChild(body);

    return { el, body };
  }

  _renderJson(data) {
    const pre = document.createElement('pre');
    pre.className = 'lh-facet__json';

    const raw = JSON.stringify(data, null, 2);
    const html = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"([^"]+)"(?=\s*:)/g, '<span class="json-key">"$1"</span>')
      .replace(/:\s*"([^"]*?)"/g, ': <span class="json-string">"$1"</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/[{}\[\]]/g, '<span class="json-brace">$&</span>');
    pre.innerHTML = html;

    this._container.appendChild(pre);
  }

  _toggleView() {
    this._showJson = !this._showJson;
    this._render();
  }

  _highlightHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/&lt;(\/?)([\w-]+)/g, '<span class="hl-punct">&lt;$1</span><span class="hl-tag">$2</span>')
      .replace(/([\w-]+)=/g, '<span class="hl-attr">$1</span>=')
      .replace(/="([^"]*)"/g, '=<span class="hl-string">"$1"</span>')
      .replace(/&gt;/g, '<span class="hl-punct">&gt;</span>');
  }

  _isUrl(value) {
    return typeof value === 'string' && value.startsWith('cgp:/');
  }

  _createUrlLink(urlStr) {
    const span = document.createElement('span');
    span.className = 'lh-facet__url-link';
    span.textContent = urlStr;
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('cgp-url-selected', {
        bubbles: true,
        detail: { url: urlStr }
      }));
    });
    return span;
  }
}
