var ComponentPage = (function () {

  function buildCSS(accent) {
    var r = parseInt(accent.slice(1, 3), 16);
    var g = parseInt(accent.slice(3, 5), 16);
    var b = parseInt(accent.slice(5, 7), 16);
    var accentAlpha = 'rgba(' + r + ',' + g + ',' + b + ',0.094)';

    return [
      '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }',

      'body {',
      '  background: #f5f5f5;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  color: #333;',
      '  min-height: 100vh;',
      '  display: flex;',
      '}',

      /* ── Back link ── */
      '.back-link {',
      '  position: fixed; top: 12px; left: 50px; z-index: 1100;',
      '  height: 30px;',
      '  text-decoration: none; color: #aaa; font-size: 11px; font-weight: 600;',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  font-family: "JetBrains Mono", monospace;',
      '  transition: color .15s;',
      '}',
      '.back-link:hover { color: #777; }',

      /* ── Two-column layout ── */
      '.cp-layout {',
      '  display: flex;',
      '  width: 100%;',
      '  min-height: 100vh;',
      '  padding-top: 54px;',
      '}',

      /* ── Left panel: live preview ── */
      '.cp-live {',
      '  width: 50%;',
      '  min-width: 200px;',
      '  flex-shrink: 0;',
      '  padding: 32px 24px;',
      '  border-right: none;',
      '  background: transparent;',
      '  position: sticky;',
      '  top: 54px;',
      '  height: calc(100vh - 54px);',
      '  overflow-y: auto;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: flex-start;',
      '}',

      /* ── Resizer handle ── */
      '.cp-resizer {',
      '  width: 6px;',
      '  flex-shrink: 0;',
      '  cursor: col-resize;',
      '  background: transparent;',
      '  position: relative;',
      '  z-index: 10;',
      '  transition: background .15s;',
      '}',
      '.cp-resizer::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 0; bottom: 0;',
      '  left: 2px;',
      '  width: 2px;',
      '  background: #ddd;',
      '  transition: background .15s;',
      '}',
      '.cp-resizer:hover::after, .cp-resizer.active::after {',
      '  background: #999;',
      '}',

      '.cp-live__label {',
      '  font-family: "JetBrains Mono", monospace;',
      '  font-size: 10px;',
      '  font-weight: 700;',
      '  text-transform: uppercase;',
      '  letter-spacing: 1.5px;',
      '  color: #999;',
      '  margin-bottom: 16px;',
      '  align-self: flex-start;',
      '}',

      '.cp-live__card {',
      '  background: transparent;',
      '  border: none;',
      '  border-radius: 12px;',
      '  padding: 40px 32px;',
      '  width: 100%;',
      '  max-width: 500px;',
      '}',

      /* ── Right panel: documentation ── */
      '.cp-doc {',
      '  flex: 1;',
      '  min-width: 200px;',
      '  padding: 32px 48px 80px;',
      '  overflow-y: auto;',
      '}',

      '.cp-doc__card {',
      '  background: #fff;',
      '  border: 1px solid #e0e0e0;',
      '  border-radius: 12px;',
      '  padding: 40px 48px;',
      '  box-shadow: 0 1px 4px rgba(0,0,0,0.04);',
      '}',

      /* ── Source code section ── */
      '.cp-source-label {',
      '  font-family: "JetBrains Mono", monospace;',
      '  font-size: 10px;',
      '  font-weight: 700;',
      '  text-transform: uppercase;',
      '  letter-spacing: 1.5px;',
      '  color: ' + accent + ';',
      '  margin-bottom: 8px;',
      '}',

      '.cp-source-block {',
      '  margin-bottom: 32px;',
      '  padding-bottom: 32px;',
      '  border-bottom: 1px solid #f0f0f0;',
      '}',

      '.cp-source-block pre {',
      '  background: #1e1e2e;',
      '  color: #cdd6f4;',
      '  border-radius: 8px;',
      '  padding: 16px 20px;',
      '  overflow-x: auto;',
      '  font-family: "JetBrains Mono", monospace;',
      '  font-size: 12.5px;',
      '  line-height: 1.6;',
      '  margin: 0;',
      '}',

      '.cp-source-block pre code {',
      '  background: none;',
      '  padding: 0;',
      '  color: inherit;',
      '  font-size: inherit;',
      '}',

      /* ── Markdown rendered content ── */
      '.cp-doc__markdown h1 {',
      '  font-size: 26px;',
      '  font-weight: 700;',
      '  color: #111;',
      '  margin-bottom: 16px;',
      '  padding-bottom: 10px;',
      '  border-bottom: 2px solid #f0f0f0;',
      '}',

      '.cp-doc__markdown h2 {',
      '  font-size: 20px;',
      '  font-weight: 700;',
      '  color: #222;',
      '  margin: 2em 0 0.6em;',
      '  padding-bottom: 6px;',
      '  border-bottom: 1px solid #f0f0f0;',
      '}',

      '.cp-doc__markdown h3 {',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  color: #333;',
      '  margin: 1.6em 0 0.4em;',
      '}',

      '.cp-doc__markdown h4 {',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  color: #555;',
      '  margin: 1.4em 0 0.3em;',
      '}',

      '.cp-doc__markdown p {',
      '  font-size: 14px;',
      '  line-height: 1.75;',
      '  margin: 0.6em 0;',
      '}',

      '.cp-doc__markdown strong { color: #111; }',

      '.cp-doc__markdown a {',
      '  color: #2563eb;',
      '  text-decoration: none;',
      '}',
      '.cp-doc__markdown a:hover { text-decoration: underline; }',

      '.cp-doc__markdown code {',
      '  background: #eff6ff;',
      '  padding: 2px 6px;',
      '  border-radius: 4px;',
      '  font-family: "JetBrains Mono", monospace;',
      '  font-size: 12.5px;',
      '  color: #2563eb;',
      '}',

      '.cp-doc__markdown pre {',
      '  background: #1e1e2e;',
      '  color: #cdd6f4;',
      '  border-radius: 8px;',
      '  padding: 16px 20px;',
      '  overflow-x: auto;',
      '  font-family: "JetBrains Mono", monospace;',
      '  font-size: 12.5px;',
      '  line-height: 1.6;',
      '  margin: 1em 0;',
      '}',

      '.cp-doc__markdown pre code {',
      '  background: none;',
      '  padding: 0;',
      '  color: inherit;',
      '  font-size: inherit;',
      '}',

      '.cp-doc__markdown ul, .cp-doc__markdown ol {',
      '  padding-left: 1.5em;',
      '  margin: 0.6em 0;',
      '}',

      '.cp-doc__markdown li {',
      '  font-size: 14px;',
      '  line-height: 1.75;',
      '  margin: 0.3em 0;',
      '}',

      '.cp-doc__markdown blockquote {',
      '  border-left: 3px solid ' + accent + ';',
      '  padding: 8px 16px;',
      '  margin: 1em 0;',
      '  background: ' + accentAlpha + ';',
      '  color: #555;',
      '  font-style: italic;',
      '}',

      '.cp-doc__markdown table {',
      '  width: 100%;',
      '  border-collapse: collapse;',
      '  margin: 1em 0;',
      '  font-size: 13px;',
      '}',

      '.cp-doc__markdown th {',
      '  background: #f8f8f8;',
      '  font-weight: 700;',
      '  text-align: left;',
      '  padding: 8px 12px;',
      '  border: 1px solid #e0e0e0;',
      '}',

      '.cp-doc__markdown td {',
      '  padding: 8px 12px;',
      '  border: 1px solid #e0e0e0;',
      '  vertical-align: top;',
      '}',

      '.cp-doc__markdown hr {',
      '  border: none;',
      '  border-top: 1px solid #eee;',
      '  margin: 2em 0;',
      '}',

      /* ── Loading state ── */
      '.cp-loading {',
      '  color: #999;',
      '  font-size: 13px;',
      '  padding: 20px 0;',
      '}',

      /* ── Responsive ── */
      '@media (max-width: 768px) {',
      '  .cp-layout { flex-direction: column; }',
      '  .cp-resizer { display: none; }',
      '  .cp-live {',
      '    width: 100% !important;',
      '    position: static;',
      '    height: auto;',
      '    border-right: none;',
      '    border-bottom: 1px solid #e0e0e0;',
      '  }',
      '  .cp-doc { padding: 24px 16px 60px; }',
      '  .cp-doc__card { padding: 24px 20px; }',
      '}'
    ].join('\n');
  }

  function render(config) {
    var accent = config.accent || '#F59E0B';

    // 1. Set document title
    document.title = config.pageTitle || (config.title + ' — Components');

    // 2. Inject Google Fonts
    var fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // 3. Inject highlight.js CSS theme
    var hljsCSS = document.createElement('link');
    hljsCSS.rel = 'stylesheet';
    hljsCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/catppuccin-mocha.min.css';
    document.head.appendChild(hljsCSS);

    // 4. Inject page CSS
    var style = document.createElement('style');
    style.textContent = buildCSS(accent);
    document.head.appendChild(style);

    // 5. Load sidebar
    if (config.sidebar) {
      var sidebarScript = document.createElement('script');
      sidebarScript.src = '/js/nav/sidebar.js';
      sidebarScript.setAttribute('data-active', config.sidebar.active || '');
      sidebarScript.setAttribute('data-accent', config.sidebar.accent || accent);
      if (config.sidebar.mode) sidebarScript.setAttribute('data-mode', config.sidebar.mode);
      document.body.appendChild(sidebarScript);
    }

    // 6. Back link
    var back = document.createElement('a');
    back.href = config.backHref || './';
    back.className = 'back-link';
    back.innerHTML = '&#8249; BACK';
    document.body.appendChild(back);

    // 7. Build layout
    var layout = document.createElement('div');
    layout.className = 'cp-layout';

    // 8. Left panel — live preview
    var livePanel = document.createElement('div');
    livePanel.className = 'cp-live';

    var liveLabel = document.createElement('div');
    liveLabel.className = 'cp-live__label';
    liveLabel.textContent = 'Live Preview';
    livePanel.appendChild(liveLabel);

    var liveCard = document.createElement('div');
    liveCard.className = 'cp-live__card';
    liveCard.innerHTML = config.html;
    livePanel.appendChild(liveCard);

    // 9. Right panel — documentation
    var docPanel = document.createElement('div');
    docPanel.className = 'cp-doc';

    var docCard = document.createElement('div');
    docCard.className = 'cp-doc__card';

    // 9a. Source code block
    var sourceSection = document.createElement('div');
    sourceSection.className = 'cp-source-block';

    var sourceLabel = document.createElement('div');
    sourceLabel.className = 'cp-source-label';
    sourceLabel.textContent = 'Source Code';
    sourceSection.appendChild(sourceLabel);

    var pre = document.createElement('pre');
    var code = document.createElement('code');
    code.className = 'language-html';
    code.textContent = config.html;
    pre.appendChild(code);
    sourceSection.appendChild(pre);

    docCard.appendChild(sourceSection);

    // 9b. Markdown content placeholder
    var mdContent = document.createElement('div');
    mdContent.className = 'cp-doc__markdown';
    mdContent.innerHTML = '<p class="cp-loading">Loading documentation\u2026</p>';
    docCard.appendChild(mdContent);

    docPanel.appendChild(docCard);

    // 10. Resizer between panels
    var resizer = document.createElement('div');
    resizer.className = 'cp-resizer';

    // 11. Assemble layout
    layout.appendChild(livePanel);
    layout.appendChild(resizer);
    layout.appendChild(docPanel);
    document.body.appendChild(layout);

    // 12. Resizer drag logic
    (function () {
      var dragging = false;

      resizer.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        dragging = true;
        resizer.classList.add('active');
        resizer.setPointerCapture(e.pointerId);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      });

      resizer.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var layoutRect = layout.getBoundingClientRect();
        var offset = e.clientX - layoutRect.left;
        var pct = (offset / layoutRect.width) * 100;
        pct = Math.max(15, Math.min(85, pct));
        livePanel.style.width = pct + '%';
      });

      resizer.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove('active');
        resizer.releasePointerCapture(e.pointerId);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
    })();

    // 13. Load highlight.js, then highlight source block
    var hljsScript = document.createElement('script');
    hljsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    hljsScript.onload = function () {
      var langScript = document.createElement('script');
      langScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/xml.min.js';
      langScript.onload = function () {
        hljs.highlightElement(code);
        // Also highlight any markdown code blocks already rendered
        mdContent.querySelectorAll('pre code').forEach(function (block) {
          hljs.highlightElement(block);
        });
      };
      document.head.appendChild(langScript);
    };
    document.head.appendChild(hljsScript);

    // 14. Load marked.js, then fetch and render markdown
    if (config.markdownSrc) {
      var markedScript = document.createElement('script');
      markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
      markedScript.onload = function () {
        fetch(config.markdownSrc)
          .then(function (r) {
            if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
            return r.text();
          })
          .then(function (md) {
            mdContent.innerHTML = marked.parse(md);
            // Apply highlight.js if already loaded
            if (typeof hljs !== 'undefined') {
              mdContent.querySelectorAll('pre code').forEach(function (block) {
                hljs.highlightElement(block);
              });
            }
          })
          .catch(function (err) {
            mdContent.innerHTML = '<p style="color:#c00">Failed to load docs: ' + err.message + '</p>';
          });
      };
      document.head.appendChild(markedScript);
    }

    // 15. Optionally load CGP runtime
    if (config.loadRuntime) {
      var runtimeScript = document.createElement('script');
      runtimeScript.type = 'module';
      runtimeScript.src = config.runtimeSrc || '/lib/cgp-runtime/runtime.js';
      document.body.appendChild(runtimeScript);
    }
  }

  return render;
})();
