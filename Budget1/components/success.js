(function () {
  var B = window.Budget;
  var hideTimer = null;

  function esc(s) { return B.esc(s); }

  function box() {
    var el = document.getElementById('success');
    if (!el) {
      el = document.createElement('div');
      el.id = 'success';
      document.body.appendChild(el);
    }
    return el;
  }

  function hide(el) {
    clearTimeout(hideTimer);
    el.classList.remove('show');
  }

  // Shows for 5 seconds. Close with ✕, or swipe left or right.
  // tone: 'ok' (green), 'warn' (amber, 80% budget), 'over' (red, over budget).
  B.success = function (title, lines, tone) {
    var el = box();
    var kind = tone || 'ok';
    var icon = kind === 'over' ? '⛔' : kind === 'warn' ? '⚠' : '✓';

    el.innerHTML = '<div class="ok-card ' + kind + '" id="ok-card">' +
      '<div class="ok-ico">' + icon + '</div>' +
      '<div class="ok-body"><b>' + esc(title) + '</b>' +
        (lines || []).map(function (l) { return '<div class="ok-line">' + esc(l) + '</div>'; }).join('') +
      '</div>' +
      '<button class="ok-x" id="ok-x" aria-label="Close">✕</button>' +
      '<div class="ok-bar"><i></i></div>' +
    '</div>';

    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');

    var card = document.getElementById('ok-card');
    var sx = null;

    card.ontouchstart = function (e) {
      sx = e.touches[0].clientX;
      card.style.transition = 'none';
    };
    card.ontouchmove = function (e) {
      if (sx === null) return;
      var dx = e.touches[0].clientX - sx;
      card.style.transform = 'translateX(' + dx + 'px)';
      card.style.opacity = String(1 - Math.min(Math.abs(dx) / 240, 0.8));
    };
    card.ontouchend = function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      sx = null;
      card.style.transition = 'transform .2s ease, opacity .2s ease';
      if (Math.abs(dx) > 70) {
        card.style.transform = 'translateX(' + (dx > 0 ? 420 : -420) + 'px)';
        card.style.opacity = '0';
        setTimeout(function () { hide(el); }, 180);
      } else {
        card.style.transform = 'translateX(0)';
        card.style.opacity = '1';
      }
    };

    document.getElementById('ok-x').onclick = function () { hide(el); };

    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { hide(el); }, 5000);
  };
})();