(function () {
  var B = window.Budget;
  var PAGE = 50;
  var monthKey = null;
  var page = 0;
  var sortKey = 'date';
  var sortDir = 'desc';
  var fType = 'all';
  var fTag = 'all';
  var fText = '';

  function t(k) { return B.t(k); }
  function esc(s) { return B.esc(s); }
  function L(en, bn) { return B.L(en, bn); }

  var COLS = [
    { key: 'date', lk: 'hist.date' },
    { key: 'type', lk: 'hist.type' },
    { key: 'amount', lk: 'hist.amount', num: true },
    { key: 'route', lk: 'hist.route' },
    { key: 'category', lk: 'hist.category' },
    { key: 'person', lk: 'hist.person' },
    { key: 'tags', lk: 'hist.tags' },
    { key: 'note', lk: 'hist.note' },
    { key: 'edits', lk: 'hist.edits', num: true }
  ];

  function value(tx, key) {
    var type = B.txType(tx);
    switch (key) {
      case 'date': return tx.date;
      case 'type': return t('type.' + type);
      case 'amount': return tx.amount;
      case 'route': return B.txRoute(tx);
      case 'category': return (type === 'income' || type === 'expense') ? B.txCategory(tx) : '';
      case 'person': return tx.person || '';
      case 'tags': return B.txTags(tx).join(', ');
      case 'note': return tx.note || '';
      case 'edits': return tx.editCount || 0;
    }
    return '';
  }

  function filtered() {
    var needle = fText.toLowerCase();
    var list = B.inMonth(B.transactions.all(), monthKey).filter(function (tx) {
      if (fType !== 'all' && B.txType(tx) !== fType) return false;
      if (fTag !== 'all' && B.txTags(tx).indexOf(fTag) === -1) return false;
      if (needle) {
        var hay = [tx.note, tx.person, B.txRoute(tx), B.txCategory(tx), B.txTags(tx).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(needle) === -1) return false;
      }
      return true;
    });
    // Newest first. Entries on the same day are ordered by when they were added.
    list.sort(function (a, b) {
      var x = value(a, sortKey), y = value(b, sortKey);
      var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      if (r === 0) {
        var ca = a.createdAt || '', cb = b.createdAt || '';
        r = ca < cb ? -1 : ca > cb ? 1 : 0;
      }
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }

  function cellHtml(tx, key) {
    if (key === 'date') return esc(B.dates.toDisplay(tx.date));
    if (key === 'type') {
      var type = B.txType(tx);
      var cls = B.types[type].sign > 0 ? 'in' : B.types[type].sign < 0 ? 'out' : 'neutral';
      var label = (type === 'transfer' && B.isGoalRef(tx.toAccount)) ? B.t('transfer.toGoal') : t('type.' + type);
      return '<span class="pill ' + cls + '">' + esc(label) + '</span>';
    }
    if (key === 'amount') {
      var def = B.types[B.txType(tx)];
      var sign = def.sign > 0 ? '+ ' : def.sign < 0 ? '- ' : '';
      var acls = def.sign > 0 ? 'in' : def.sign < 0 ? 'out' : 'neutral';
      return '<span class="' + acls + '">' + sign + B.money.format(tx.amount) + '</span>';
    }
    if (key === 'tags') return B.txTags(tx).map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('');
    if (key === 'edits') {
      var n = tx.editCount || 0;
      return n ? '<span class="edited">' + t('hist.edits') + (n > 1 ? ' ×' + n : '') + '</span>' : '';
    }
    return esc(value(tx, key));
  }

  function tableHtml() {
    var list = filtered();
    var s = B.summarize(list);
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    var start = page * PAGE;
    var slice = list.slice(start, start + PAGE);

    var head = '<tr><th class="idx">#</th>' + COLS.map(function (c) {
      var arrow = sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c.key + '">' + t(c.lk) + arrow + '</th>';
    }).join('') + '<th></th></tr>';

    var rows = slice.map(function (tx, i) {
      return '<tr data-edit="' + tx.id + '"><td class="idx">' + (start + i + 1) + '</td>' +
        COLS.map(function (c) {
          return '<td' + (c.num ? ' class="num"' : '') + '>' + cellHtml(tx, c.key) + '</td>';
        }).join('') +
        '<td class="act"><button class="mini danger" data-del="' + tx.id + '">' + t('btn.delete') + '</button></td></tr>';
    }).join('');
    if (!slice.length) rows = '<tr><td colspan="' + (COLS.length + 2) + '" class="meta">' + t('hist.none') + '</td></tr>';

    var from = list.length ? start + 1 : 0;
    var to = Math.min(start + PAGE, list.length);
    var pager = '<div class="pager"><span>' + t('hist.showing') + ' ' + from + '–' + to + ' ' + t('hist.of') + ' ' + list.length + '</span>' +
      '<span class="btn-row">' +
        (page > 0 ? '<button class="mini" data-page="newer">‹ ' + t('hist.newer') + '</button>' : '') +
        (start + PAGE < list.length ? '<button class="mini" data-page="older">' + t('hist.older') + ' ›</button>' : '') +
      '</span></div>';

    return '<div class="card">' +
        '<div class="sum-chips">' +
          '<span>' + list.length + ' ' + t('hist.entries') + '</span>' +
          '<span class="in">' + t('hist.income') + ' ' + B.money.format(s.income) + '</span>' +
          '<span class="out">' + t('hist.expense') + ' ' + B.money.format(s.expense) + '</span>' +
          '<span>' + t('hist.net') + ' ' + B.money.format(s.net) + '</span>' +
        '</div>' +
        '<div class="xl-wrap"><table class="xl"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
        pager +
      '</div>';
  }

  function redrawTable() {
    var box = document.getElementById('hx-table');
    if (box) box.innerHTML = tableHtml();
  }

  B.registerPage({
    id: 'history',
    get label() { return B.t('menu.history'); },

    onEnter: function () {
      monthKey = B.pendingHistoryMonth || B.dates.currentMonthKey();
      fType = B.pendingHistoryType || 'all';
      fTag = 'all';
      fText = '';
      page = 0;
      B.pendingHistoryType = null;
      B.pendingHistoryMonth = null;
    },

    render: function (root) {
      if (!monthKey) monthKey = B.dates.currentMonthKey();
      var isCurrent = monthKey >= B.dates.currentMonthKey();

      var tagOptions = '<option value="all">' + t('hist.allTags') + '</option>' + B.tags.all().map(function (g) {
        return '<option value="' + esc(g) + '"' + (fTag === g ? ' selected' : '') + '>#' + esc(g) + '</option>';
      }).join('');
      var typeOptions = '<option value="all">' + t('hist.allTypes') + '</option>' + Object.keys(B.types).map(function (k) {
        return '<option value="' + k + '"' + (fType === k ? ' selected' : '') + '>' + t('type.' + k) + '</option>';
      }).join('');

      root.innerHTML =
        '<div class="card">' +
          '<div class="month-nav">' +
            '<button data-month="prev" aria-label="Previous month">‹</button>' +
            '<span>' + B.dates.monthLabel(monthKey) + '</span>' +
            '<button data-month="next" aria-label="Next month"' + (isCurrent ? ' disabled' : '') + '>›</button>' +
          '</div>' +
          '<div class="xl-filters">' +
            '<select id="h-type">' + typeOptions + '</select>' +
            '<select id="h-tag">' + tagOptions + '</select>' +
            '<input id="h-text" placeholder="' + t('hist.search') + '" value="' + esc(fText) + '">' +
          '</div>' +
          '<p class="meta" style="margin:8px 0 0">' + t('hist.hint') + '</p>' +
        '</div>' +
        '<div id="hx-table">' + tableHtml() + '</div>';

      root.onchange = function (e) {
        if (e.target.id === 'h-type') { fType = e.target.value; page = 0; redrawTable(); }
        if (e.target.id === 'h-tag') { fTag = e.target.value; page = 0; redrawTable(); }
      };

      root.oninput = function (e) {
        if (e.target.id === 'h-text') { fText = e.target.value; page = 0; redrawTable(); }
      };

      root.onclick = function (e) {
        var del = e.target.closest('[data-del]');
        if (del) {
          var id = del.getAttribute('data-del');
          if (!window.confirm(L('Move this entry to Trash?', 'এই লেনদেনটি ট্র্যাশে সরাবেন?'))) return;
          B.transactions.remove(id);
          B.toast(L('Moved to trash.', 'ট্র্যাশে সরানো হয়েছে।'), t('btn.undo'), function () {
            B.transactions.restore(id);
            B.refresh();
          });
          return B.refresh();
        }

        var month = e.target.closest('[data-month]');
        if (month) {
          monthKey = B.dates.shiftMonth(monthKey, month.getAttribute('data-month') === 'prev' ? -1 : 1);
          page = 0;
          return B.refresh();
        }

        var pg = e.target.closest('[data-page]');
        if (pg) {
          page += pg.getAttribute('data-page') === 'older' ? 1 : -1;
          return redrawTable();
        }

        var th = e.target.closest('[data-sort]');
        if (th) {
          var key = th.getAttribute('data-sort');
          if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortKey = key; sortDir = (key === 'amount' || key === 'edits') ? 'desc' : 'asc'; }
          page = 0;
          return redrawTable();
        }

        var row = e.target.closest('[data-edit]');
        if (row) B.editTransaction(row.getAttribute('data-edit'));
      };
    }
  });
})();