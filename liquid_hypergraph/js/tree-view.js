// tree-view.js — CgpTreeView: hierarchical URL tree grouped by namespace

export class CgpTreeView {
  constructor(resolver, container) {
    this._resolver = resolver;
    this._container = container;
    this._selectedUrl = null;
    this._expansionState = new Set();
    this._knownKeys = new Set();
  }

  render() {
    this._saveExpansionState();
    this._container.innerHTML = '';

    const urls = this._resolver.urls();

    // Partition into three top-level branches
    const protocol = urls.filter(u => u.startsWith('cgp:/root/'));
    const library  = urls.filter(u => u.startsWith('cgp:/core/'));
    const user     = urls.filter(u => u.startsWith('cgp:/s/'));

    const protocolBranch = this._renderBranch('Reserved \u2014 Protocol', protocol, 'branch-protocol', false);
    const libraryBranch  = this._renderBranch('Reserved \u2014 Library', library, 'branch-library', false);
    const userBranch     = this._renderBranch('User Systems', user, 'branch-user', true);

    this._container.appendChild(protocolBranch);
    this._container.appendChild(libraryBranch);
    this._container.appendChild(userBranch);

    this._restoreExpansionState();

    // Re-apply selection
    if (this._selectedUrl) {
      this._applySelection(this._selectedUrl);
    }
  }

  selectUrl(url) {
    this._selectedUrl = url;
    this._applySelection(url);
  }

  // --- Private ---

  _renderBranch(label, urls, key, defaultOpen) {
    const details = document.createElement('details');
    details.className = 'lh-tree__branch';
    details.setAttribute('data-key', key);
    if (defaultOpen && !this._expansionState.size) {
      details.open = true;
    }

    const summary = document.createElement('summary');
    summary.textContent = label;
    const count = document.createElement('span');
    count.style.cssText = 'font-size:9px;color:#bbb;font-weight:400;margin-left:auto;';
    count.textContent = urls.length;
    summary.appendChild(count);
    details.appendChild(summary);

    // Build trie from URLs, collapse single-child chains, render recursively
    const trie = this._collapseTrie(this._buildTrie(urls));
    for (const [segment, node] of trie) {
      const el = this._renderTrieNode(segment, node, 1, key);
      details.appendChild(el);
    }

    return details;
  }

  _buildTrie(urls) {
    const root = new Map();
    for (const url of urls) {
      // Strip cgp:/ prefix, then split by /
      const path = url.replace(/^cgp:\//, '');
      const parts = path.split('/').filter(Boolean);
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current.has(part)) {
          current.set(part, { children: new Map(), url: null });
        }
        const node = current.get(part);
        if (i === parts.length - 1) {
          node.url = url;
        }
        current = node.children;
      }
    }
    return root;
  }

  // Collapse chains of single-child nodes that have no URL.
  // e.g. o → 0 becomes o/0, c → state-change → 0 becomes c/state-change/0
  _collapseTrie(trie) {
    const collapsed = new Map();
    for (const [segment, node] of trie) {
      let label = segment;
      let current = node;
      while (!current.url && current.children.size === 1) {
        const [childSeg, childNode] = current.children.entries().next().value;
        label += '/' + childSeg;
        current = childNode;
      }
      current.children = this._collapseTrie(current.children);
      collapsed.set(label, current);
    }
    return collapsed;
  }

  _renderTrieNode(segment, node, depth, parentKey) {
    const hasChildren = node.children.size > 0;
    const url = node.url;

    if (hasChildren) {
      // Render as expandable details
      const details = document.createElement('details');
      details.className = 'lh-tree__branch';
      const detailKey = parentKey + '/' + segment;
      details.setAttribute('data-key', detailKey);

      const summary = document.createElement('summary');
      summary.className = 'lh-tree__node';
      summary.setAttribute('data-depth', String(depth));

      if (url) {
        const kind = this._inferKind(url);
        const badge = this._createBadge(kind);
        summary.appendChild(badge);
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'lh-tree__label';
      labelSpan.textContent = segment;
      summary.appendChild(labelSpan);

      if (url) {
        summary.setAttribute('data-url', url);
        summary.addEventListener('click', (e) => {
          // Don't prevent the toggle, just also fire selection
          this._handleClick(url);
        });
      }

      details.appendChild(summary);

      for (const [childSeg, childNode] of node.children) {
        details.appendChild(this._renderTrieNode(childSeg, childNode, depth + 1, detailKey));
      }

      return details;
    }

    // Leaf node
    const div = document.createElement('div');
    div.className = 'lh-tree__node';
    div.setAttribute('data-depth', String(depth));

    if (url) {
      const kind = this._inferKind(url);
      const badge = this._createBadge(kind);
      div.appendChild(badge);
      div.setAttribute('data-url', url);
      div.addEventListener('click', () => this._handleClick(url));
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'lh-tree__label';
    labelSpan.textContent = segment;
    div.appendChild(labelSpan);

    return div;
  }

  _createBadge(kind) {
    const ABBREV = {
      system: 'SYS', observatron: 'OBS', event: 'EVT',
      anchor: 'ANC', path: 'PTH', protocol: 'PRO', component: 'CMP'
    };
    const badge = document.createElement('span');
    badge.className = `lh-tree__badge lh-tree__badge--${kind}`;
    badge.textContent = ABBREV[kind] || kind.toUpperCase().slice(0, 3);
    return badge;
  }

  _inferKind(url) {
    if (url.startsWith('cgp:/root/')) return 'protocol';
    if (url.startsWith('cgp:/core/')) return 'component';

    // Parse user system URLs: cgp:/s/{id}/o/{id}/c/{name}/{n}/a/{n}/p/{n}
    const match = url.match(/^cgp:\/s\/(.*)$/);
    if (!match) return 'protocol';

    const segments = match[1].split('/').filter(Boolean);
    const len = segments.length;

    if (len <= 1) return 'system';       // cgp:/s/{id}
    if (len <= 3) return 'observatron';  // cgp:/s/{id}/o/{id}
    if (len <= 5) return 'event';        // cgp:/s/{id}/o/{id}/c/{name}/{n}
    if (len <= 7) return 'anchor';       // cgp:/s/{id}/o/{id}/c/{name}/{n}/a/{n}
    return 'path';                       // cgp:/s/{id}/o/{id}/c/{name}/{n}/a/{n}/p/{n}
  }

  _handleClick(url) {
    this._selectedUrl = url;
    this._applySelection(url);
    document.dispatchEvent(new CustomEvent('cgp-url-selected', {
      bubbles: true,
      detail: { url }
    }));
  }

  _applySelection(url) {
    // Remove previous selection
    const prev = this._container.querySelector('.lh-tree__node--selected');
    if (prev) prev.classList.remove('lh-tree__node--selected');

    // Apply new selection
    const node = this._container.querySelector(`[data-url="${CSS.escape(url)}"]`);
    if (node) {
      node.classList.add('lh-tree__node--selected');
      // Expand ancestor <details> elements to reveal the node.
      // If the node is a <summary>, skip its own <details> (the user controls that toggle).
      let parent;
      if (node.tagName === 'SUMMARY') {
        parent = node.closest('details')?.parentElement?.closest('details');
      } else {
        parent = node.closest('details');
      }
      while (parent) {
        parent.open = true;
        parent = parent.parentElement?.closest('details');
      }
    }
  }

  _saveExpansionState() {
    this._expansionState = new Set();
    const details = this._container.querySelectorAll('details[data-key]');
    for (const d of details) {
      const key = d.getAttribute('data-key');
      this._knownKeys.add(key);
      if (d.open) {
        this._expansionState.add(key);
      }
    }
  }

  _restoreExpansionState() {
    const details = this._container.querySelectorAll('details[data-key]');
    for (const d of details) {
      const key = d.getAttribute('data-key');
      if (this._expansionState.has(key)) {
        d.open = true;
      } else if (key.startsWith('branch-user') && !this._knownKeys.has(key)) {
        // New user system node — auto-expand so CSV drops reveal the full tree
        d.open = true;
      }
      this._knownKeys.add(key);
    }
  }
}
