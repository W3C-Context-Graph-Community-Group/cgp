(function () {
  var script = document.currentScript;
  var activePage = script.getAttribute('data-active') || '';
  var accent = script.getAttribute('data-accent') || '#A78BFA';
  var mode = script.getAttribute('data-mode') || 'light';

  // Parse hex to rgb for alpha variant
  var r = parseInt(accent.slice(1, 3), 16);
  var g = parseInt(accent.slice(3, 5), 16);
  var b = parseInt(accent.slice(5, 7), 16);
  var accentAlpha = 'rgba(' + r + ',' + g + ',' + b + ',0.094)';

  // Inject CSS
  var style = document.createElement('style');
  style.textContent =
    '.sidebar-hamburger {' +
    '  position:fixed;top:12px;left:12px;z-index:1100;' +
    '  width:30px;height:30px;border:none;background:#fff;' +
    '  border-radius:6px;cursor:pointer;display:flex;' +
    '  flex-direction:column;align-items:center;justify-content:center;' +
    '  gap:4px;box-shadow:0 1px 4px rgba(0,0,0,.12);' +
    '}' +
    '.sidebar-hamburger span {' +
    '  display:block;width:14px;height:1.5px;background:#555;' +
    '  border-radius:2px;transition:transform .25s,opacity .25s;' +
    '}' +
    '.sidebar-hamburger.open span:nth-child(1){transform:translateY(5.5px) rotate(45deg)}' +
    '.sidebar-hamburger.open span:nth-child(2){opacity:0}' +
    '.sidebar-hamburger.open span:nth-child(3){transform:translateY(-5.5px) rotate(-45deg)}' +
    '.sidebar-backdrop {' +
    '  position:fixed;inset:0;background:rgba(0,0,0,.35);' +
    '  z-index:1000;opacity:0;pointer-events:none;' +
    '  transition:opacity .25s;' +
    '}' +
    '.sidebar-backdrop.open{opacity:1;pointer-events:auto}' +
    '.sidebar-nav {' +
    '  position:fixed;top:0;left:0;bottom:0;width:260px;' +
    '  background:#fff;z-index:1050;padding:72px 20px 20px;' +
    '  transform:translateX(-100%);transition:transform .25s;' +
    '  box-shadow:2px 0 12px rgba(0,0,0,.1);' +
    '  font-family:"JetBrains Mono",monospace;' +
    '}' +
    '.sidebar-nav.open{transform:translateX(0)}' +
    '.sidebar-nav a {' +
    '  display:block;padding:12px 14px;margin-bottom:4px;' +
    '  border-radius:8px;text-decoration:none;color:#555;' +
    '  font-size:14px;font-weight:400;transition:background .15s;' +
    '}' +
    '.sidebar-nav a:hover{background:#f0f0f0}' +
    '.sidebar-nav a.active{' +
    '  background:' + accentAlpha + ';' +
    '  color:' + accent + ';' +
    '  font-weight:700;' +
    '  border-left:3px solid ' + accent + ';' +
    '  border-radius:0 8px 8px 0;' +
    '}' +
    '.sidebar-nav hr{border:none;border-top:1px solid #e0e0e0;margin:8px 14px}' +
    '.sidebar-hamburger.dark-mode {' +
    '  background:transparent;border:1px solid rgba(255,255,255,.5);box-shadow:none;' +
    '}' +
    '.sidebar-hamburger.dark-mode span{background:#fff}' +
    '.sidebar-hamburger.dark-mode.open span{background:#555}';
  document.head.appendChild(style);

  // Build nav links
  var links = [
    { id: 'home',         label: 'Home',         href: '/' },
    { id: '_hr' },
    { id: 'calculator',   label: 'Calculator',   href: '/calculator/' },
    { id: 'observatrons', label: 'Observatrons', href: '/observatrons/' },
    { id: 'docs',         label: 'Docs',         href: '/docs/' },
    { id: 'components',   label: 'Components',   href: '/components/' },
    { id: 'liquid_hypergraph', label: 'Liquid Hypergraph', href: '/liquid_hypergraph/' },
    { id: 'inspectors',       label: 'Inspectors',       href: '/inspectors/' }
  ];

  var linksHtml = links.map(function (link) {
    if (link.id === '_hr') return '<hr />';
    var cls = link.id === activePage ? ' class="active"' : '';
    return '<a href="' + link.href + '"' + cls + ' target="_blank">' + link.label + '</a>';
  }).join('');

  var darkCls = mode === 'dark' ? ' dark-mode' : '';
  document.body.insertAdjacentHTML('afterbegin',
    '<button class="sidebar-hamburger' + darkCls + '" id="sidebarToggle" aria-label="Open navigation">' +
    '<span></span><span></span><span></span></button>' +
    '<div class="sidebar-backdrop" id="sidebarBackdrop"></div>' +
    '<nav class="sidebar-nav" id="sidebarNav">' + linksHtml + '</nav>'
  );

  // Wire up events
  var btn = document.getElementById('sidebarToggle');
  var nav = document.getElementById('sidebarNav');
  var backdrop = document.getElementById('sidebarBackdrop');
  function open()  { btn.classList.add('open'); nav.classList.add('open'); backdrop.classList.add('open'); }
  function close() { btn.classList.remove('open'); nav.classList.remove('open'); backdrop.classList.remove('open'); }
  function toggle() { nav.classList.contains('open') ? close() : open(); }
  btn.addEventListener('click', toggle);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
