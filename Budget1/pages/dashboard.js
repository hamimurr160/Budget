(function () {
  var B = window.Budget;
  var viewKey = null;
  var carryOpen = false;
  var PALETTE = ['#38bdf8', '#818cf8', '#34d399', '#fb923c', '#f472b6', '#facc15', '#2dd4bf', '#a78bfa', '#f87171'];

  function L(en, bn) { return B.L(en, bn); }
  function esc(s) { return B.esc(s); }
  function money(p) { return B.money.format(p); }

  // A card. go (optional) makes the whole card tappable and names where it opens.
  function card(title, inner, go) {
    var attr = go ? ' data-go="' + go + '" role="button"' : '';
    return '<div class="card' + (go ? ' tappable' : '') + '"' + attr + '><h2>' + title + '</h2>' + inner + '</div>';
  }

    function kpi(cls, label, value, go) {
    var attr = go ? ' data-go="' + go + '" role="button"' : '';
    return '<div class="kpi ' + cls + '"' + attr + '><div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-val">' + value + '</div></div>';
  }

  // Total budget first (calculated from the category budgets), then the three closest to their limit.
  function budgetHtml(key) {
    var rows = B.budgets.rows(key);
    if (!rows.length) {
      return '<p class="meta">' + L('No budget yet. Tap to set one up.', 'এখনো বাজেট নেই। ট্যাপ করে বাজেট ঠিক করুন।') + '</p>';
    }
    var html = '';
    var total = B.budgets.pctFor('__total__', key);
    if (total) {
      var tp = Math.round(total.pct);
      html += '<div class="bud-row">' + B.ring(tp, B.statusOf(tp), 84) +
        '<div class="bud-info"><div class="bud-title">' + L('Total budget', 'মোট বাজেট') + '</div>' +
        '<div class="meta">' + L('Left', 'বাকি') + ' <b>' + money(total.view.remaining) + '</b></div>' +
        '<div class="meta">' + L('Spent', 'ব্যয়') + ' ' + money(total.view.spent) + '</div></div></div>';
    }
    html += '<div style="margin-top:12px">' + rows.slice(0, 3).map(function (x) {
      var pct = Math.round(x.r.pct);
      var s = B.statusOf(pct);
      var zone = s === 'over' ? ' zone-over' : (s === 'warn' ? ' zone-warn' : '');
      return '<div class="mini-row' + zone + '"><div class="info">' +
        '<div class="bud-title" style="font-size:14px">' + B.categories.icon(x.name) + ' ' + esc(x.name) +
          ' <span class="badge ' + s + '">' + pct + '%</span></div>' +
        '<div class="bar"><div class="fill ' + s + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
        '<div class="meta">' + L('Left', 'বাকি') + ' ' + money(x.r.view.remaining) + '</div></div></div>';
    }).join('') + '</div>';
    return html;
  }

  // Income vs expense pie for the viewed month.
  function pieHtml(income, expense) {
    var total = income + expense;
    if (total <= 0) return '<p class="meta">' + L('No income or expense this month.', 'এই মাসে আয় বা ব্যয় নেই।') + '</p>';
    var a = income / total * 360;
    var cx = 80, cy = 80, r = 70;
    function pt(deg) {
      var rad = (deg - 90) * Math.PI / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    }
    function slice(start, end, color) {
      if (end - start >= 359.9) return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
      var p1 = pt(start), p2 = pt(end);
      var large = end - start > 180 ? 1 : 0;
      return '<path d="M' + cx + ' ' + cy + ' L' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2) +
        ' Z" fill="' + color + '"/>';
    }
    var incPct = Math.round(income / total * 100);
    return '<div class="pie-wrap">' +
      '<svg viewBox="0 0 160 160" width="150" height="150">' +
        slice(0, a, '#38bdf8') + slice(a, 360, '#fb7185') +
        '<circle cx="80" cy="80" r="34" style="fill:var(--card-solid)"/>' +
      '</svg>' +
      '<div class="pie-legend">' +
        '<div><span class="dot" style="background:#38bdf8"></span>' + L('Income', 'আয়') +
          '<b>' + incPct + '%</b><small>' + money(income) + '</small></div>' +
        '<div><span class="dot" style="background:#fb7185"></span>' + L('Expense', 'ব্যয়') +
          '<b>' + (100 - incPct) + '%</b><small>' + money(expense) + '</small></div>' +
      '</div></div>';
  }

  function categoryBars(monthList) {
    var totals = {};
    monthList.forEach(function (x) {
      if (B.txType(x) !== 'expense') return;
      var c = B.txCategory(x);
      totals[c] = (totals[c] || 0) + x.amount;
    });
    var rows = Object.keys(totals).map(function (c) {
      return { name: c, amount: totals[c] };
    }).sort(function (a, b) { return b.amount - a.amount; });
    if (!rows.length) return '<p class="meta">' + L('No expenses this month.', 'এই মাসে কোনো ব্যয় নেই।') + '</p>';

    var total = rows.reduce(function (s, r) { return s + r.amount; }, 0);
    var max = rows[0].amount;
    return rows.slice(0, 5).map(function (r, i) {
      var pct = Math.round(r.amount / total * 100);
      var width = Math.round(r.amount / max * 100);
      return '<div class="cat-row"><div class="cat-top"><span>' + B.categories.icon(r.name) + ' ' + esc(r.name) + '</span>' +
        '<span>' + money(r.amount) + ' · ' + pct + '%</span></div>' +
        '<div class="bar"><div class="fill" style="width:' + width + '%;background:' + PALETTE[i % PALETTE.length] + '"></div></div></div>';
    }).join('');
  }

    // Days from today to a goal's date. Negative means overdue. Null means no date.
  function daysLeft(g) {
    if (!g.deadline) return null;
    var end = new Date(g.deadline + 'T00:00:00');
    var now = new Date(B.dates.today() + 'T00:00:00');
    return Math.round((end - now) / 86400000);
  }

  // The coloured box and the label for a goal's date. Null when no box is needed.
    function dateStatus(g, pr) {
    var left = daysLeft(g);
    if (pr.done || left === null) return null;
    if (left < 0) return { bg: '#fecdd3', ink: '#881337', text: L('Overdue', 'মেয়াদ শেষ') };
    if (left <= 3) return { bg: '#fde68a', ink: '#713f12', text: left === 0 ? L('Due today', 'আজ শেষ') : L(left + ' days left', left + ' দিন বাকি') };
    return null;
  }

  function goalsHtml(list) {
    var bal = B.balances(list);
    // Completed goals are not shown on the Dashboard. Nearest date first.
    var goals = B.goals.all().filter(function (g) { return !B.goals.progress(g, bal).done; });
    if (!B.goals.all().length) return '<p class="meta">' + L('No goals yet. Tap to create one.', 'এখনো কোনো লক্ষ্য নেই। ট্যাপ করে তৈরি করুন।') + '</p>';
    if (!goals.length) return '<p class="meta">' + L('No active goals.', 'কোনো সক্রিয় লক্ষ্য নেই।') + '</p>';
    goals.sort(function (a, b) {
      var da = daysLeft(a), db = daysLeft(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    return goals.map(function (g) {
      var pr = B.goals.progress(g, bal);
      var st = dateStatus(g, pr);
      return '<div class="mini-row goal-box" style="' + (st ? 'background:' + st.bg + ';color:' + st.ink + ';border-radius:14px;padding:10px;' : '') + '">' +
        '<div class="info"><b>🎯 ' + esc(g.name) + '</b>' +
        '<div class="bar"><div class="fill ok" style="width:' + pr.pct + '%"></div></div>' +
        '<div class="meta">' + (st ? '<b>' + st.text + '</b> · ' : '') +
          L('Remaining', 'বাকি') + ' ' + money(pr.remaining) + ' · ' + L('Target', 'লক্ষ্য') + ' ' + money(g.target) + '</div></div>' +
        '<span class="meta">' + money(pr.saved) + '</span></div>';
    }).join('');
  }

  function accountsHtml(list) {
    var accs = B.accounts.all();
    if (!accs.length) return '<p class="meta">' + L('No accounts yet. Tap to add one.', 'এখনো কোনো অ্যাকাউন্ট নেই। ট্যাপ করে যোগ করুন।') + '</p>';
    var bal = B.balances(list);
    return '<div class="strip">' + accs.map(function (a) {
      var v = bal[a.name] || 0;
      return '<div class="stat"><div class="meta">' + B.kinds.icon(B.accounts.kindOf(a.name)) + ' ' + esc(a.name) + '</div>' +
        '<div class="val ' + (v < 0 ? 'out' : '') + '">' + money(v) + '</div></div>';
    }).join('') + '</div>';
  }

  function recentHtml(list) {
    var recent = B.sortNewest(list).slice(0, 3);
    var rows = recent.length
      ? '<ul class="list">' + recent.map(function (t) { return B.txRow(t); }).join('') + '</ul>'
      : '<p class="meta">' + L('No transactions yet. Tap + to add one.', 'এখনো কোনো লেনদেন নেই। + চাপুন।') + '</p>';
    return rows + '<button class="ghost wide" data-action="history">' + L('Show all in History', 'ইতিহাসে সব দেখুন') + '</button>';
  }

  function reminderCard(list) {
    var s = B.settings.get();
    if (!s.reminderOn) return '';
    var now = B.bd.now();
    if (s.dismissedOn === now.date) return '';
    if (now.minutes < B.bd.reminderMinutes()) return '';
    var added = list.some(function (x) { return x.date === now.date; });
    if (added) return '';
    return '<div class="card reminder"><div><b>' + L('Daily reminder', 'দৈনিক রিমাইন্ডার') + '</b>' +
      '<div class="meta">' + L('No transactions added today yet.', 'আজ এখনো কোনো লেনদেন যোগ হয়নি।') +
      ' · ' + B.bd.formatTime(B.bd.reminderMinutes()) + ' (BD)</div></div>' +
      '<div class="btn-row"><button class="mini primary-mini" data-action="add">' + L('Add now', 'এখনই যোগ করুন') + '</button>' +
      '<button class="mini" data-dismiss="1">' + L('Later', 'পরে') + '</button></div></div>';
  }

  // ---------- Reminder panel (opened from the bell button) ----------

  function reminderPanel(body) {
    var s = B.settings.get();
    var mins = B.bd.reminderMinutes();
    var p = B.bd.splitTime(mins);
    var presets = [[7 * 60, '7:00 AM'], [12 * 60, '12:00 PM'], [20 * 60, '8:00 PM'], [21 * 60 + 30, '9:30 PM']];
    body.innerHTML =
      '<div class="setting-row"><span>' + L('Remind me if nothing is added today', 'আজ কিছু যোগ না হলে মনে করান') + '</span>' +
        '<button class="switch' + (s.reminderOn ? ' on' : '') + '" data-rtoggle="1" aria-label="Reminder"></button></div>' +
      '<div class="' + (s.reminderOn ? '' : 'dim') + '">' +
        '<div class="time-display"><div class="sub">' + L('Reminder time (Bangladesh)', 'রিমাইন্ডারের সময় (বাংলাদেশ)') + '</div>' +
          '<div class="big">' + B.bd.formatTime(mins) + '</div>' +
          '<div class="sub">' + L('Now ', 'এখন ') + B.bd.formatTime(B.bd.now().minutes) + '</div></div>' +
        '<div class="stepper-row">' +
          '<div class="stepper"><div class="lbl">' + L('Hour', 'ঘণ্টা') + '</div><div class="num">' + p.h12 + '</div>' +
            '<div class="btns"><button data-rdelta="-60">−1h</button><button data-rdelta="60">+1h</button></div></div>' +
          '<div class="stepper"><div class="lbl">' + L('Minute', 'মিনিট') + '</div><div class="num">' + B.bd.pad(p.mm) + '</div>' +
            '<div class="btns"><button data-rdelta="-5">−5</button><button data-rdelta="-1">−1</button>' +
            '<button data-rdelta="1">+1</button><button data-rdelta="5">+5</button></div></div>' +
        '</div>' +
        '<div class="seg"><button data-rampm="AM" class="' + (p.ampm === 'AM' ? 'on' : '') + '">AM</button>' +
          '<button data-rampm="PM" class="' + (p.ampm === 'PM' ? 'on' : '') + '">PM</button></div>' +
        '<div class="chips" style="margin-top:12px">' + presets.map(function (pr) {
          return '<button class="chip' + (pr[0] === mins ? ' sel' : '') + '" data-rpreset="' + pr[0] + '">' + pr[1] + '</button>';
        }).join('') + '</div>' +
      '</div>';

    body.onclick = function (e) {
      var el;
      if (e.target.closest('[data-rtoggle]')) {
        B.settings.set('reminderOn', !B.settings.get().reminderOn);
        return reopen();
      }
      if ((el = e.target.closest('[data-rdelta]'))) {
        var m = B.bd.reminderMinutes() + (+el.getAttribute('data-rdelta'));
        B.settings.set('reminderMinutes', ((m % 1440) + 1440) % 1440);
        return reopen();
      }
      if ((el = e.target.closest('[data-rampm]'))) {
        var cur = B.bd.splitTime(B.bd.reminderMinutes());
        B.settings.set('reminderMinutes', B.bd.joinTime(cur.h12, cur.mm, el.getAttribute('data-rampm')));
        return reopen();
      }
      if ((el = e.target.closest('[data-rpreset]'))) {
        B.settings.set('reminderMinutes', +el.getAttribute('data-rpreset'));
        return reopen();
      }
    };
  }

  function reopen() {
    B.panel.refresh();
    B.refresh();
  }

  // ---------- Page ----------

  // The bell sits in the top bar (index.html) and opens the reminder controls.
  var bell = document.getElementById('bell-btn');
  if (bell) bell.onclick = function () { B.panel.open(L('Reminder', 'রিমাইন্ডার'), reminderPanel); };

  B.registerPage({
    id: 'dashboard',
        onEnter: function () { viewKey = B.dates.currentMonthKey(); carryOpen = false; },
    get label() { return L('Dashboard', 'ড্যাশবোর্ড'); },

    render: function (root) {
      if (!viewKey) viewKey = B.dates.currentMonthKey();

      var list = B.transactions.all();
      var monthList = B.inMonth(list, viewKey);
      var s = B.summarize(monthList);
      var rate = s.income > 0 ? Math.round(s.net / s.income * 100) : 0;
      var isCurrent = viewKey >= B.dates.currentMonthKey();
      // Balances at the end of the viewed month, and at the start of it.
      var monthEnd = viewKey + '-' + ('0' + B.dates.daysInMonth(viewKey)).slice(-2);
      var monthStart = viewKey + '-01';
      var balEnd = B.balances(list.filter(function (x) { return x.date <= monthEnd; }));
      var balStart = B.balances(list.filter(function (x) { return x.date < monthStart; }));
      function accountsSum(bal) {
        return B.accounts.all().reduce(function (sum, a) { return sum + (bal[a.name] || 0); }, 0);
      }
      var netNow = accountsSum(balEnd);
      var change = netNow - accountsSum(balStart);
      var goalsNow = B.goals.all().concat(B.goals.closed()).reduce(function (sum, g) {
        return sum + (balEnd['goal:' + g.id] || 0);
      }, 0);
      var owedToMe = B.debts.list('loan').reduce(function (sum, p) { return sum + Math.max(p.remaining, 0); }, 0);
      var iOwe = B.debts.list('debt').reduce(function (sum, p) { return sum + Math.max(p.remaining, 0); }, 0);


      root.innerHTML =
        reminderCard(list) +
      '<div class="card hero">' +
          '<div class="month-nav">' +
            '<button data-month="prev" aria-label="Previous month">‹</button>' +
            '<span>' + B.dates.monthLabel(viewKey) + '</span>' +
            '<button data-month="next" aria-label="Next month"' + (isCurrent ? ' disabled' : '') + '>›</button>' +
          '</div>' +
          '<div class="hero-label">' + L('Net balance (all accounts)', 'মোট ব্যালেন্স (সব অ্যাকাউন্ট)') + '</div>' +
          '<div class="hero-value" data-go="net-history" role="button">' + money(netNow) + '</div>' +
          '<div class="hero-sub">' + L('In goals', 'লক্ষ্যে জমা') + ' ' + money(goalsNow) +
            ' · ' + L('This month', 'এই মাসে') + ' ' + (change < 0 ? '-' : '+') + ' ' + money(Math.abs(change)) + '</div>' +
          '<button class="carry-toggle" data-carry="1">' + L('Carry-over', 'ক্যারি-ওভার') + ' ' + (carryOpen ? '▴' : '▾') + '</button>' +
          (carryOpen
            ? '<div class="strip carry-strip">' +
                '<div class="stat"><div class="meta">' + L('Brought forward', 'আগের মাস থেকে') + '</div>' +
                  '<div class="val">' + money(accountsSum(balStart)) + '</div></div>' +
                '<div class="stat"><div class="meta">' + L('Closing balance', 'মাস শেষে') + '</div>' +
                  '<div class="val">' + money(netNow) + '</div></div>' +
              '</div>'
            : '') +
        '</div>' +

        '<div class="kpis">' +
                    kpi('inc', L('Income', 'আয়'), money(s.income), 'income') +
          kpi('exp', L('Expense', 'ব্যয়'), money(s.expense), 'expense') +
          kpi('loan', L('Loans to collect', 'পাওনা ধার'), money(owedToMe), 'loans-collect') +
          kpi('debt', L('Debt to repay', 'পরিশোধযোগ্য দেনা'), money(iOwe), 'loans-repay') +  
        '</div>' +
        card(L('Budget', 'বাজেট'), budgetHtml(viewKey), 'budget') +
        card(L('This month', 'এই মাস'), pieHtml(s.income, s.expense)) +
        card(L('Spending by category', 'ক্যাটাগরি অনুযায়ী ব্যয়'), categoryBars(monthList)) +
        card(L('Goals', 'লক্ষ্য'), goalsHtml(list), 'goals') +
        card(L('Accounts', 'অ্যাকাউন্ট'), accountsHtml(list), 'accounts') +
        card(L('Recent transactions', 'সাম্প্রতিক লেনদেন'), recentHtml(list));

      root.onclick = function (e) {
        var el;
        if (e.target.closest('[data-dismiss]')) {
          B.settings.set('dismissedOn', B.dates.today());
          return B.refresh();
        }
        if ((el = e.target.closest('[data-edit]'))) return B.editTransaction(el.getAttribute('data-edit'));

        // Buttons inside a card are handled before the card itself.

               if ((el = e.target.closest('[data-carry]'))) {
          carryOpen = !carryOpen;
          return B.refresh();
        }

        if ((el = e.target.closest('[data-action],[data-month]'))) {
          if (el.hasAttribute('data-month')) {
            viewKey = B.dates.shiftMonth(viewKey, el.getAttribute('data-month') === 'prev' ? -1 : 1);
            return B.refresh();
          }
          var action = el.getAttribute('data-action');
          if (action === 'history') return B.navigate('history');
          if (action === 'add') return B.openTransaction();
          return;
        }

        // Tapping a card opens its page. Budget and Goals open their own tab.
        if ((el = e.target.closest('[data-go]'))) {
          var go = el.getAttribute('data-go');
          if (go === 'budget') { B.pendingPlanTab = 'budget'; return B.navigate('plan'); }
          if (go === 'goals') { B.pendingPlanTab = 'goals'; return B.navigate('plan'); }
          if (go === 'accounts') return B.navigate('accounts');

          if (go === 'net-history') {
            B.pendingHistoryMonth = viewKey;
            B.pendingHistoryType = null;
            return B.navigate('history');
          }

          if (go === 'income' || go === 'expense') {
            B.pendingHistoryType = go;
            B.pendingHistoryMonth = viewKey;
            return B.navigate('history');
          }
          if (go === 'loans-collect') { B.pendingLoansTab = 'loan'; return B.navigate('loans'); }
          if (go === 'loans-repay') { B.pendingLoansTab = 'debt'; return B.navigate('loans'); }

        }
      };
    }
  });
})();