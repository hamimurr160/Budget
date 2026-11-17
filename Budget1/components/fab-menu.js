(function () {
  var B = window.Budget;

  function $(id) { return document.getElementById(id); }

  function setOpen(open) {
    $('fab-menu').classList.toggle('open', open);
    $('fab-overlay').classList.toggle('open', open);
    $('fab').classList.toggle('x', open);
    $('fab-menu').setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function isOpen() { return $('fab-menu').classList.contains('open'); }

  // The + button opens a short menu. The menu items go straight to a screen or the add form.
  $('fab').onclick = function () {
    if (isOpen()) return setOpen(false);
    setOpen(true);
  };

  $('fab-overlay').onclick = function () { setOpen(false); };

  document.getElementById('fab-menu').onclick = function (e) {
    var b = e.target.closest('[data-fab]');
    if (!b) return;
    var what = b.getAttribute('data-fab');
    setOpen(false);
    if (what === 'transaction') return B.openTransaction();
    if (what === 'history') return B.navigate('history');
    if (what === 'dashboard') return B.navigate('dashboard');
  };
})();