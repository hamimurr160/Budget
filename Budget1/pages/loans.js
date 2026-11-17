(function () {
  var B = window.Budget;
  var tab = 'debt';          // 'debt' (I owe) | 'loan' (owed to me) | 'history'
  var hist = 'all';          // history filter
  var view = null;           // null, or { kind: 'person', group, name }
  var sortKey = 'date', sortDir = 'desc';
  var ORDER = ['debt', 'loan', 'history'];

  function L(en, bn) { return B.L(en, bn); }
  function esc(s) { return B.esc(s); }
  function money(p) { return B.money.format(p); }
  function t(k) { return B.t(k); }

  var GROUP = {
    debt: {
      plus: 'loan_received', minus: 'loan_repaid',
      title: function () { return L('Debt (I owe)', 'দেনা (আমি দেব)'); },
      total: function () { return L('Total debt to repay', 'মোট দেনা (বাকি)'); },
      plusBtn: function () { return L('+ Taken', '+ নিলাম'); },
      minusBtn: function () { return L('+ Paid', '+ শোধ'); },
      taken: function () { return L('Total debt', 'মোট দেনা'); },
      paid: function () { return L('Paid', 'শোধ'); },
      remainingCls: 'out'
    },
    loan: {
      plus: 'loan_given', minus: 'loan_collected',
      title: function () { return L('Loan (owed to me)', 'ধার (আমার পাওনা)'); },
      total: function () { return L('Total loan to collect', 'মোট পাওনা (বাকি)'); },
      plusBtn: function () { return L('+ Given', '+ দিলাম'); },
      minusBtn: function () { return L('+ Collected', '+ আদায়'); },
      taken: function () { return L('Total loan', 'মোট ধার'); },
      paid: function () { return L('Collected', 'আদায়'); },
      remainingCls: 'in'
    }
  };

  function dayDiff(iso) {
    var today = B.dates.today();
    var a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
    var b = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }

  // rank: 0 = overdue (red), 1 = within 7 days (yellow), 2 = more time, 3 = no date given
  function statusOf(iso) {
    if (!iso) return { rank: 3, cls: 'alarm-none', text: L('No date given', 'তারিখ দেওয়া নেই') };
    var n = dayDiff(iso);
    if (n < 0) return { rank: 0, cls: 'alarm-red', text: L('Overdue by ' + (-n) + ' days', (-n) + ' দিন পার হয়েছে') };
    if (n === 0) return { rank: 1, cls: 'alarm-yellow', text: L('Due today', 'আজ শেষ তারিখ') };
    if (n <= 7) return { rank: 1, cls: 'alarm-yellow', text: L('Due in ' + n + ' days', n + ' দিন বাকি') };
    return { rank: 2, cls: '', text: L(n + ' days left', n + ' দিন বাকি') };
  }

  function findPerson(group, name) {
    return B.debts.list(group).filter(function (p) { return p.name === name; })[0] ||
      { name: name, taken: 0, paid: 0, remaining: 0, due: B.debts.dueOf(group, name) };
  }

  // ---------- Summary cards ----------

  function personCard(p) {
    var g = GROUP[tab];
    var st = statusOf(p.due);
    var pct = p.taken > 0 ? Math.min(100, Math.round(p.paid / p.taken * 100)) : 0;
    return '<div class="card person-card ' + st.cls + '" data-ledger="' + esc(p.name) + '" data-group="' + tab + '">' +
      '<div class="loan-top"><div>' +
        '<div class="loan-name">' + esc(p.name) + ' <span class="open-hint">›</span></div>' +
        '<div class="due">' + esc(st.text) + (p.due ? ' · ' + B.dates.toDisplay(p.due) : '') + '</div>' +
      '</div>' +
      '<div class="loan-rem ' + g.remainingCls + '">' + money(p.remaining) +
        '<div class="meta">' + L('remaining', 'বাকি') + '</div></div></div>' +
      '<div class="mini-stats"><div>' + g.taken() + '<b>' + money(p.taken) + '</b></div>' +
        '<div>' + g.paid() + '<b>' + money(p.paid) + '</b></div>' +
        '<div>' + L('Remaining', 'বাকি') + '<b>' + money(p.remaining) + '</b></div></div>' +
      '<div class="bar"><div class="fill ok" style="width:' + pct + '%"></div></div>' +
      '<div class="btn-row">' +
        '<button class="mini primary-mini" data-plus="' + esc(p.name) + '">' + g.plusBtn() + '</button>' +
        '<button class="mini" data-minus="' + esc(p.name) + '">' + g.minusBtn() + '</button>' +
        '<button class="mini" data-due="' + esc(p.name) + '">' + L('Set date', 'তারিখ দিন') + '</button>' +
      '</div></div>';
  }

  // Sorted: overdue (red), due soon (yellow), more time, then no date given.
  function sortedPeople(group, onlyRunning) {
    var list = B.debts.list(group);
    if (onlyRunning) list = list.filter(function (p) { return p.remaining > 0; });
    return list.sort(function (a, b) {
      var ra = statusOf(a.due).rank, rb = statusOf(b.due).rank;
      if (ra !== rb) return ra - rb;
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      return b.remaining - a.remaining;
    });
  }

  function runningHtml() {
    var g = GROUP[tab];
    var list = sortedPeople(tab, true);
    var total = list.reduce(function (s, p) { return s + p.remaining; }, 0);
    var taken = list.reduce(function (s, p) { return s + p.taken; }, 0);
    var paid = list.reduce(function (s, p) { return s + p.paid; }, 0);

    var html = '<div class="card hero">' +
      '<div class="hero-label">' + g.total() + '</div>' +
      '<div class="hero-value">' + money(total) + '</div>' +
      '<div class="hero-sub">' + list.length + ' ' + L('people', 'জন') + '</div>' +
      '<div class="mini-stats"><div>' + g.taken() + '<b>' + money(taken) + '</b></div>' +
        '<div>' + g.paid() + '<b>' + money(paid) + '</b></div></div></div>';

    if (!list.length) {
      html += '<div class="card"><h2>' + L('All settled', 'সব মিটে গেছে') + '</h2>' +
        '<p class="meta">' + L('Nothing is running right now. Finished items are hidden. Use History to see them.',
          'এখন কিছু চলছে না। শেষ হওয়া হিসাব লুকানো আছে। ইতিহাসে দেখতে পারেন।') + '</p></div>';
    } else {
      html += list.map(personCard).join('');
    }
    return html;
  }

  // ---------- Person detail: totals, edit actions and full ledger ----------

  function personView() {
    var g = GROUP[view.group];
    var p = findPerson(view.group, view.name);
    var st = statusOf(p.due);
    var entries = B.debts.entries(view.group, view.name);

    var rows = entries.map(function (tx) {
      var n = tx.editCount || 0;
      var editedOn = tx.editedAt
        ? '<div class="edited-on">' + L('Edited on ', 'সম্পাদিত: ') + B.dates.toDisplay(tx.editedAt.slice(0, 10)) +
          (n > 1 ? ' · ×' + n : '') + '</div>'
        : '';
      return '<div class="ledger-row" data-edit="' + tx.id + '">' +
        '<div class="ledger-main">' +
          '<div class="ledger-type">' + esc(t('type.' + B.txType(tx))) + '</div>' +
          '<div class="meta">' + esc(B.dates.toDisplay(tx.date)) + (tx.note ? ' · ' + esc(tx.note) : '') + '</div>' +
          editedOn +
        '</div>' +
        '<div class="ledger-amt">' + money(tx.amount) + '</div>' +
        '<button class="mini" data-edit="' + tx.id + '">' + L('Edit', 'এডিট') + '</button>' +
      '</div>';
    }).join('');

    return '<div class="card person-card ' + st.cls + '">' +
        '<button class="ghost wide" data-back-list="1">← ' + L('Back', 'ফিরে যান') + '</button>' +
        '<h2 style="margin-top:12px">' + esc(view.name) + '</h2>' +
        '<div class="due">' + esc(st.text) + (p.due ? ' · ' + B.dates.toDisplay(p.due) : '') + '</div>' +
        '<div class="mini-stats"><div>' + g.taken() + '<b>' + money(p.taken) + '</b></div>' +
          '<div>' + g.paid() + '<b>' + money(p.paid) + '</b></div>' +
          '<div>' + L('Remaining', 'বাকি') + '<b>' + money(p.remaining) + '</b></div></div>' +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="mini primary-mini" data-plus="' + esc(view.name) + '">' + g.plusBtn() + '</button>' +
          '<button class="mini" data-minus="' + esc(view.name) + '">' + g.minusBtn() + '</button>' +
          '<button class="mini" data-due="' + esc(view.name) + '">' + L('Set date', 'তারিখ দিন') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="card"><h2>' + L('Ledger history', 'খতিয়ানের ইতিহাস') + '</h2>' +
        (rows || '<p class="meta">' + L('No entries yet.', 'এখনো কোনো হিসাব নেই।') + '</p>') +
      '</div>';
  }

  // ---------- History of all loan and debt entries ----------

  function historyList() {
    var list = B.transactions.all().filter(function (tx) {
      var type = B.txType(tx);
      if (!B.isLoan(type)) return false;
      if (hist === 'debt') return B.isDebtType(type);
      if (hist === 'loan') return B.isLoanGroupType(type);
      return true;
    });
    list.sort(function (a, b) {
      var x, y;
      if (sortKey === 'amount') { x = a.amount; y = b.amount; }
      else if (sortKey === 'person') { x = a.person || ''; y = b.person || ''; }
      else { x = a.date; y = b.date; }
      var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      if (r === 0) r = (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }

  function peopleChips() {
    var names = B.debts.persons();
    if (!names.length) return '';
    var debtNames = {};
    B.debts.list('debt').forEach(function (p) { debtNames[p.name] = true; });
    return '<div class="chips" style="margin-bottom:10px">' + names.map(function (n) {
      var group = debtNames[n] ? 'debt' : 'loan';
      return '<button class="chip" data-ledger="' + esc(n) + '" data-group="' + group + '">' + esc(n) + '</button>';
    }).join('') + '</div>';
  }

  function historyHtml() {
    var list = historyList();
    var cols = [
      { key: 'date', label: L('Date', 'তারিখ') },
      { key: 'type', label: L('Type', 'ধরন') },
      { key: 'person', label: L('Person', 'ব্যক্তি') },
      { key: 'amount', label: L('Amount', 'পরিমাণ'), num: true },
      { key: 'account', label: L('Account', 'অ্যাকাউন্ট') },
      { key: 'note', label: L('Note', 'নোট') },
      { key: 'edits', label: L('Edits', 'সম্পাদনা') }
    ];

    var head = '<tr><th class="idx">#</th>' + cols.map(function (c) {
      var arrow = sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return '<th data-sort="' + c.key + '">' + c.label + arrow + '</th>';
    }).join('') + '</tr>';

    var rows = list.map(function (tx, i) {
      var type = B.txType(tx);
      var cls = B.isDebtType(type) ? 'out' : 'in';
      var n = tx.editCount || 0;
      return '<tr data-edit="' + tx.id + '"><td class="idx">' + (i + 1) + '</td>' +
        '<td>' + esc(B.dates.toDisplay(tx.date)) + '</td>' +
        '<td><span class="pill ' + cls + '">' + esc(t('type.' + type)) + '</span></td>' +
        '<td>' + esc(tx.person || '') + '</td>' +
        '<td class="num">' + money(tx.amount) + '</td>' +
        '<td>' + esc(B.txAccount(tx)) + '</td>' +
        '<td>' + esc(tx.note || '') + '</td>' +
        '<td>' + (n ? '<span class="edited">' + L('Edited', 'সম্পাদিত') + (n > 1 ? ' ×' + n : '') + '</span>' : '') + '</td></tr>';
    }).join('');
    if (!list.length) rows = '<tr><td colspan="' + (cols.length + 1) + '" class="meta">' + L('No entries yet.', 'এখনো কোনো লেনদেন নেই।') + '</td></tr>';

    var filters = [['all', L('All', 'সব')], ['debt', L('Debt', 'দেনা')], ['loan', L('Loan', 'ধার')]].map(function (c) {
      return '<button class="chip' + (hist === c[0] ? ' sel' : '') + '" data-hist="' + c[0] + '">' + c[1] + '</button>';
    }).join('');

    return '<div class="card"><h2>' + L('People', 'ব্যক্তি') + '</h2>' + peopleChips() +
      '<div class="chips" style="margin-bottom:10px">' + filters + '</div>' +
      '<p class="meta" style="margin:0 0 8px">' + L('Tap a heading to sort. Tap a row to edit. Tap a name to open the person.',
        'শিরোনামে চাপলে সাজানো হবে। সারিতে চাপলে এডিট হবে। নামে চাপলে ব্যক্তির তথ্য খুলবে।') + '</p>' +
      '<div class="xl-wrap"><table class="xl"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
      '</div>';
  }

  // ---------- Pay / collect date ----------

  function openDuePanel(group, name) {
    var current = B.debts.dueOf(group, name) || B.dates.today();
    B.panel.open(name + ' · ' + L('Date', 'তারিখ'), function (body) {
      body.innerHTML =
        '<p class="meta">' + (group === 'debt'
          ? L('The date you plan to pay this back.', 'যে তারিখে এটি শোধ করার পরিকল্পনা আছে।')
          : L('The date you expect to collect this.', 'যে তারিখে এটি আদায়ের আশা করছেন।')) + '</p>' +
        '<div id="due-cal"></div>' +
        '<div class="sheet-actions">' +
          '<button class="ghost" data-clear="1">' + L('Clear date', 'তারিখ মুছুন') + '</button>' +
          '<button class="ghost" data-back="1">' + L('Back', 'ফিরে যান') + '</button>' +
        '</div>';
      B.datePicker.mount(body.querySelector('#due-cal'), current, function (iso) {
        B.debts.setDue(group, name, iso);
        B.panel.close();
        B.refresh();
      });
      body.onclick = function (e) {
        if (e.target.closest('[data-back]')) return B.panel.close();
        if (e.target.closest('[data-clear]')) {
          B.debts.setDue(group, name, null);
          B.panel.close();
          B.refresh();
        }
      };
    });
  }

  // ---------- Page ----------

  function tabsHtml() {
    var labels = { debt: GROUP.debt.title(), loan: GROUP.loan.title(), history: L('History', 'ইতিহাস') };
    return '<div class="tabs loan-tabs">' + ORDER.map(function (k) {
      return '<button class="tab' + (tab === k ? ' on' : '') + '" data-tab="' + k + '">' + labels[k] + '</button>';
    }).join('') + '</div>';
  }

  function currentGroup() {
    if (view) return view.group;
    return tab === 'loan' ? 'loan' : 'debt';
  }

  B.registerPage({
    id: 'loans',
    get label() { return L('Loan & Debt', 'ঋণ ও দেনা'); },

    // Coming back to this page always starts on the main Debt tab.
    onEnter: function () {
      tab = B.pendingLoansTab || 'debt';
      B.pendingLoansTab = null;
      view = null;
    },

    render: function (root) {
      var body;
      if (view && view.kind === 'person') body = personView();
      else body = tab === 'history' ? historyHtml() : runningHtml();
      root.innerHTML = tabsHtml() + body;

      root.onclick = function (e) {
        var el;
        // Buttons first, so they never open the person card underneath them.
        if ((el = e.target.closest('[data-plus]'))) {
          return B.openTransaction({ type: GROUP[currentGroup()].plus, person: el.getAttribute('data-plus') });
        }
        if ((el = e.target.closest('[data-minus]'))) {
          return B.openTransaction({ type: GROUP[currentGroup()].minus, person: el.getAttribute('data-minus') });
        }
        if ((el = e.target.closest('[data-due]'))) {
          return openDuePanel(currentGroup(), el.getAttribute('data-due'));
        }
        if ((el = e.target.closest('[data-edit]'))) return B.editTransaction(el.getAttribute('data-edit'));
        if (e.target.closest('[data-back-list]')) { view = null; return B.refresh(); }
        if ((el = e.target.closest('[data-tab]'))) { tab = el.getAttribute('data-tab'); view = null; return B.refresh(); }
        if ((el = e.target.closest('[data-hist]'))) { hist = el.getAttribute('data-hist'); return B.refresh(); }
        if ((el = e.target.closest('[data-sort]'))) {
          var key = el.getAttribute('data-sort');
          if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          else { sortKey = key; sortDir = key === 'amount' ? 'desc' : 'asc'; }
          return B.refresh();
        }
        // Anywhere on a person's box (or a name chip) opens that person.
        if ((el = e.target.closest('[data-ledger]'))) {
          view = { kind: 'person', group: el.getAttribute('data-group') || currentGroup(), name: el.getAttribute('data-ledger') };
          return B.refresh();
        }
      };
    }
  });
})();