(function () {
  var B = window.Budget;
  var WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  // Draws a month calendar into `container`. `iso` is the selected date (YYYY-MM-DD).
  // onPick(newIso) runs when a day is tapped.
  B.datePicker = {
    mount: function (container, iso, onPick) {
      var selected = iso;
      var view = iso.slice(0, 7);
      var todayIso = B.dates.today();

      function draw() {
        var y = +view.slice(0, 4), m = +view.slice(5, 7) - 1;
        var firstDay = new Date(y, m, 1).getDay();
        var daysInMonth = new Date(y, m + 1, 0).getDate();
        var html = '<div class="cal-head">' +
            '<button class="cal-nav" data-nav="-1" aria-label="Previous month">‹</button>' +
            '<span>' + B.dates.monthLabel(view) + '</span>' +
            '<button class="cal-nav" data-nav="1" aria-label="Next month">›</button>' +
          '</div>' +
          '<div class="cal-grid">';
        WEEK.forEach(function (w) { html += '<div class="cal-wd">' + w + '</div>'; });
        for (var i = 0; i < firstDay; i++) html += '<div></div>';
        for (var d = 1; d <= daysInMonth; d++) {
          var key = view + '-' + pad(d);
          var cls = 'cal-day' + (key === selected ? ' sel' : '') + (key === todayIso ? ' today' : '');
          html += '<button class="' + cls + '" data-day="' + key + '">' + d + '</button>';
        }
        html += '</div>';
        container.innerHTML = html;
      }

      container.onclick = function (e) {
        var nav = e.target.closest('[data-nav]');
        if (nav) {
          view = B.dates.shiftMonth(view, +nav.getAttribute('data-nav'));
          draw();
          return;
        }
        var day = e.target.closest('[data-day]');
        if (day) {
          selected = day.getAttribute('data-day');
          draw();
          onPick(selected);
        }
      };

      draw();
    }
  };
})();