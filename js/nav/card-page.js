var CardPage = (function () {

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function buildCSS() {
    return [
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body {',
      '  background: #f5f5f5;',
      '  font-family: "JetBrains Mono", monospace;',
      '  color: #333;',
      '  min-height: 100vh;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 40px 24px;',
      '}',
      'h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }',
      '.subtitle { color: #999; font-size: 13px; margin-bottom: 48px; }',
      '.cards { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; max-width: 900px; }',
      '.card {',
      '  background: #fff;',
      '  border: 1px solid #e0e0e0;',
      '  border-radius: 16px;',
      '  padding: 32px 28px;',
      '  width: 260px;',
      '  text-decoration: none;',
      '  color: inherit;',
      '  transition: transform .2s, box-shadow .2s, border-color .2s;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: flex-start;',
      '}',
      '.card:hover {',
      '  transform: translateY(-4px);',
      '  box-shadow: 0 8px 24px rgba(0,0,0,.08);',
      '  border-color: var(--card-color);',
      '}',
      '.card-icon {',
      '  width: 48px; height: 48px;',
      '  border-radius: 12px;',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-size: 22px;',
      '  margin-bottom: 18px;',
      '}',
      '.card-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }',
      '.card-desc { font-size: 12px; color: #888; line-height: 1.6; }',
      '.back-link {',
      '  position: fixed; top: 12px; left: 50px; z-index: 1100;',
      '  height: 30px;',
      '  text-decoration: none; color: #aaa; font-size: 11px; font-weight: 600;',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  transition: color .15s;',
      '}',
      '.back-link:hover { color: #777; }',
      '.footer { margin-top: 48px; color: #bbb; font-size: 10px; }'
    ].join('\n');
  }

  function render(config) {
    // 1. Set document title
    document.title = config.pageTitle || (config.title + ' — Dark Fraction');

    // 2. Inject Google Fonts
    var fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // 3. Inject base CSS
    var style = document.createElement('style');
    style.textContent = buildCSS();
    document.head.appendChild(style);

    // 4. Optionally load sidebar
    if (config.sidebar) {
      var sidebarScript = document.createElement('script');
      sidebarScript.src = '/js/nav/sidebar.js';
      sidebarScript.setAttribute('data-active', config.sidebar.active || '');
      sidebarScript.setAttribute('data-accent', config.sidebar.accent || config.accent || '#A78BFA');
      if (config.sidebar.mode) sidebarScript.setAttribute('data-mode', config.sidebar.mode);
      document.body.appendChild(sidebarScript);
    }

    // 5. Build page DOM

    // Back link on sub-pages
    if (config.sidebar) {
      var back = document.createElement('a');
      back.href = '/';
      back.className = 'back-link';
      back.innerHTML = '&#8249; BACK';
      document.body.appendChild(back);
    }

    var h1 = document.createElement('h1');
    h1.textContent = config.title;
    if (config.accent) h1.style.color = config.accent;
    document.body.appendChild(h1);

    var sub = document.createElement('div');
    sub.className = 'subtitle';
    sub.textContent = config.subtitle;
    document.body.appendChild(sub);

    var cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards';

    config.cards.forEach(function (card) {
      var a = document.createElement('a');
      a.href = card.href;
      if (card.target) a.target = card.target;
      a.className = 'card';

      var cardColor = config.accent || card.color || '#333';
      a.style.setProperty('--card-color', cardColor);

      var icon = document.createElement('div');
      icon.className = 'card-icon';
      icon.textContent = card.icon;
      icon.style.background = hexToRgba(cardColor, 0.094);
      icon.style.color = cardColor;

      var title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = card.title;
      title.style.color = cardColor;

      var desc = document.createElement('div');
      desc.className = 'card-desc';
      desc.textContent = card.desc;

      a.appendChild(icon);
      a.appendChild(title);
      a.appendChild(desc);
      cardsDiv.appendChild(a);
    });

    document.body.appendChild(cardsDiv);

    var footer = document.createElement('div');
    footer.className = 'footer';
    footer.textContent = config.footer || 'W3C Context Graph Community Group';
    document.body.appendChild(footer);
  }

  return render;
})();
