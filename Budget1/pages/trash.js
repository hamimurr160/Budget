(function () {
  var B = window.Budget;
  var PAGE = 50;
  var page = 0;
  var sortKey = 'deleted';
  var sortDir = 'desc';
  var fText = '';

  function L(en, bn) { return B.L(en, bn); }
  function t(k) { return B.t(k); }
  function esc(s) { return B.esc(s); }

  var COLS = [
    { key: 'deleted', en: 'Deleted', bn: 'মোছা হয়েছে' },
    { key: 'date', en: 'Date', bn: 'তারিখ' },
    { key: 'type', en: 'Type', bn: 'ধরন' },
    { key: 'amount', en: 'Amount', bn: 'পরিমাণ', num: true },
    { key: 'route', en: 'From → To', bn: 'কোথা থেকে → কোথায়' },
    { key: 'category', en: 'Category', bn: 'ক্যাটাগরি' },
    { key: 'person', en: 'Person', bn: 'ব্যক্তি' },
    { key: 'tags', en: 'Tags', bn: 'ট্যাগ' },
    { key: 'note', en: 'Note', bn: 'নোট' },
    { key: 'left', en: 'Days left', bn: 'বাকি দিন', num: true }
  ];

  function daysLeft(item) {
    return B.TRASH_DAYS - Math.floor((Date.now() - Date.parse(item.deletedAt)) / 86400000);
  }

  function localDate(iso) {
    var d = new Date(iso);
    return B.dates.todayDisplay ? pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() : iso;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function value(item, key) {
    var tx = item.tx;
    var type = B.txType(tx);
    switch (key) {
      case 'deleted': return item.deletedAt;
      case 'date': return tx.date;
      case 'type': return t('type.' + type);
      case 'amount': return tx.amount;
      case 'route': return B.txRoute(tx);
      case 'category': return (type === 'income' || type === 'expense') ? B.txCategory(tx) : '';
      case 'person': return tx.person || '';
      case 'tags': return B.txTags(tx).join(', ');
      case 'note': return tx.note || '';
      case 'left': return daysLeft(item);
    }
    return '';
  }

  function filtered() {
    var needle = fText.toLowerCase();
    var list = B.transactions.trashed().filter(function (item) {
      if (!needle) return true;
      var tx = item.tx;
      var hay = [tx.note, tx.person, B.txRoute(tx), B.txCategory(tx), B.txTags(tx).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(needle) !== -1;
    });
    list.sort(function (a, b) {
      var x = value(a, sortKey), y = value(b, sortKey);
      var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }

  function cellHtml(item, key) {
    var tx = item.tx;
    if (key === 'deleted') return esc(localDate(item.deletedAt));
    if (key === 'date') return esc(B.dates.toDisplay(tx.date));
    if (key === 'type') {
      var type = B.txType(tx);
      var cls = B.types[type].sign > 0 ? 'in' : B.types[type].sign < 0 ? 'out' : 'neutral';
      return '<span class="pill ' + cls + '">' + esc(t('type.' + type)) + '</span>';
    }
    if (key === 'amount') return B.money.format(tx.amount);
    if (key === 'tags') return B.txTags(tx).map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('');
    if (key === 'left') {
      var left = daysLeft(item);
      return '<span class="' + (left <= 7 ? 'out' : '') + '">' + left + '</span>';
    }
    return esc(value(item, key));
  }

  function tableHtml() {
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (page >= pages) page = pages - 1;
    var start = page * PAGE;
    var slice = list.slice(start, start + PAGE);

    var head = '<tr><th class="idx">#</th>' + COLS.map(function (c) {
      var arrow = sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c.key + '">' + L(c.en, c.bn) + arrow + '</th>';
    }).join('') + '<th></th></tr>';

    var rows = slice.map(function (item, i) {
      return '<tr><td class="idx">' + (start + i + 1) + '</td>' +
        COLS.map(function (c) {
          return '<td' + (c.num ? ' class="num"' : '') + '>' + cellHtml(item, c.key) + '</td>';
        }).join('') +
        '<td class="act"><div class="btn-row">' +
          '<button class="mini" data-restore="' + item.tx.id + '">' + t('btn.restore') + '</button>' +
          '<button class="mini danger" data-purge="' + item.tx.id + '">' + L('Delete forever', 'চিরতরে মুছুন') + '</button>' +
        '</div></td></tr>';
    }).join('');
    if (!slice.length) rows = '<tr><td colspan="' + (COLS.length + 2) + '" class="meta">' + L('Trash is empty.', 'ট্র্যাশ খালি।') + '</td></tr>';

    var from = list.length ? start + 1 : 0;
    var to = Math.min(start + PAGE, list.length);
    var pager = '<div class="pager"><span>' + t('hist.showing') + ' ' + from + '–' + to + ' ' + t('hist.of') + ' ' + list.length + '</span>' +
      '<span class="btn-row">' +
        (page > 0 ? '<button class="mini" data-page="newer">‹ ' + t('hist.newer') + '</button>' : '') +
        (start + PAGE < list.length ? '<button class="mini" data-page="older">' + t('hist.older') + ' ›</button>' : '') +
      '</span></div>';

    return '<div class="xl-wrap"><table class="xl"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' + pager;
  }

  function redrawTable() {
    var box = document.getElementById('tr-table');
    if (box) box.innerHTML = tableHtml();
  }

  B.registerPage({
    id: 'trash',
    get label() { return L('Trash', 'ট্র্যাশ'); },

    render: function (root) {
      var total = B.transactions.trashed().length;
      root.innerHTML =
        '<div class="card">' +
          '<div class="sum-chips"><span>' + total + ' ' + L('in trash', 'ট্র্যাশে') + '</span>' +
            '<span>' + L('Kept for ' + B.TRASH_DAYS + ' days', B.TRASH_DAYS + ' দিন রাখা হয়') + '</span></div>' +
          '<p class="meta">' + L('Restore brings an entry back to History. Delete forever cannot be undone.',
            'ফেরত আনলে লেনদেন ইতিহাসে ফিরবে। চিরতরে মুছলে আর ফেরানো যাবে না।') + '</p>' +
          '<div class="xl-filters" style="margin-top:10px">' +
            '<input id="tr-text" placeholder="' + t('hist.search') + '" value="' + esc(fText) + '">' +
          '</div>' +
          (total ? '<button class="danger-btn" data-empty="1">' + L('Empty trash', 'ট্র্যাশ খালি করুন') + '</button>' : '') +
        '</div>' +
        '<div id="tr-table">' + tableHtml() + '</div>';

      root.oninput = function (e) {
        if (e.target.id === 'tr-text') { fText = e.target.value; page = 0; redrawTable(); }
      };

      root.onclick = function (e) {
        var el;
        if ((el = e.target.closest('[data-restore]'))) {
          B.transactions.restore(el.getAttribute('data-restore'));
          return B.refresh();
        }
        if ((el = e.target.closest('[data-purge]'))) {
          if (!window.confirm(L('Delete this entry forever? This cannot be undone.', 'চিরতরে মুছবেন? এটি ফেরানো যাবে না।'))) return;
          B.transactions.purge(el.getAttribute('data-purge'));
          return B.refresh();
        }
        if ((el = e.target.closest('[data-empty]'))) {
          if (!window.confirm(L('Empty the trash? Everything in it is deleted forever.', 'ট্র্যাশ খালি করবেন? সব চিরতরে মুছে যাবে।'))) return;
          B.transactions.emptyTrash();
          return B.refresh();
        }
        if ((el = e.target.closest('[data-page]'))) {
          page += el.getAttribute('data-page') === 'older' ? 1 : -1;
          return redrawTable();
        }
        if ((el = e.target.closest('[data-sort]'))) {
          var key = el.getAttribute('data-sort');
          if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortKey = key; sortDir = (key === 'amount' || key === 'left') ? 'desc' : 'asc'; }
          page = 0;
          return redrawTable();
        }
      };
    }
  });
})();