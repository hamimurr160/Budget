(function () {
  var B = window.Budget;
  var current = null;
  var buttons = {};

  // Shows script errors on the page, so you can debug on the phone.
  window.addEventListener('error', function (e) {
    var box = document.createElement('pre');
    box.style.cssText = 'background:#fff0f0;color:#c62828;padding:10px;white-space:pre-wrap;font-size:12px;margin:12px;';
    box.textContent = 'Error: ' + e.message + ' (line ' + e.lineno + ')';
    document.body.appendChild(box);
  });

  function start() {
    var main = document.getElementById('main');
    var menuBtn = document.getElementById('menu-btn');
    var drawer = document.getElementById('drawer');
    var overlay = document.getElementById('drawer-overlay');
    var items = document.getElementById('drawer-items');

    function openMenu(open) {
      drawer.classList.toggle('open', open);
      overlay.classList.toggle('open', open);
    }

    menuBtn.onclick = function () { openMenu(true); };
    overlay.onclick = function () { openMenu(false); };

        function syncLabels() {
      B.pages.forEach(function (p) {
        if (buttons[p.id]) buttons[p.id].textContent = p.label;
      });
    }

    // Each page keeps its own container. Switching pages moves that container
    // into the main area, so it is instant. A container that is not showing is
    // detached from the document, so its element ids can't clash with the page on screen.
    var hosts = {};
    var dirty = {};

    function hostFor(page) {
      if (!hosts[page.id]) hosts[page.id] = document.createElement('div');
      return hosts[page.id];
    }

    function setActive(id) {
      Object.keys(buttons).forEach(function (k) {
        buttons[k].classList.toggle('active', k === id);
      });
    }

    // Draws the page into its own container and updates the menu labels.
    function draw(page) {
      page.render(hostFor(page));
      dirty[page.id] = false;
      syncLabels();
    }

    B.navigate = function (id) {
      var page = B.pages.filter(function (p) { return p.id === id; })[0];
      if (!page) return;
      if (page.onEnter) { page.onEnter(); dirty[page.id] = true; }
      current = page;
      var host = hostFor(page);
      if (dirty[page.id] || !host.firstChild) draw(page);
      setActive(page.id);
      while (main.firstChild) main.removeChild(main.firstChild);
      main.appendChild(host);
      openMenu(false);
      window.scrollTo(0, 0);
    };

    B.refresh = function () {
      if (!current) return;
      var y = window.scrollY;
      // Data changed, so every other page is redrawn the next time it is opened.
      B.pages.forEach(function (p) { if (p !== current) dirty[p.id] = true; });
      draw(current);
      window.scrollTo(0, y);
    };

    // Each page appears once in the menu.
    var seen = {};
    B.pages.forEach(function (page) {
      if (seen[page.id]) return;
      seen[page.id] = true;
      var btn = document.createElement('button');
      btn.className = 'item';
      btn.textContent = page.label;
      btn.onclick = function () { B.navigate(page.id); };
      items.appendChild(btn);
      buttons[page.id] = btn;
    });

    // Menu-only pages, opened from the menu without a separate page file.
    var exportBtn = document.createElement('button');
    exportBtn.className = 'item';
    exportBtn.textContent = B.L('Export', 'এক্সপোর্ট');
    exportBtn.onclick = function () { B.openExport(); };
    items.appendChild(exportBtn);

    B.recurring.process();
    if (B.pages.length) B.navigate(B.pages[0].id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

// ---- PWA: offline support and "Install app" ----
// Paste this at the very END of app.js. Do not change anything else in the file.

// 1. Register the service worker (offline support).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('Service worker failed:', err);
    });
  });
}

// 2. Optional "Install app" button. It appears only when the phone allows installing.
var deferredInstall = null;
var installBtn = document.createElement('button');
installBtn.textContent = 'Install app';
installBtn.hidden = true;
installBtn.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:60;padding:10px 14px;border:0;border-radius:999px;background:#1e88e5;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.2);';
document.body.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredInstall = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', function () {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  deferredInstall.userChoice.then(function () {
    deferredInstall = null;
    installBtn.hidden = true;
  });
});

window.addEventListener('appinstalled', function () {
  installBtn.hidden = true;
});
