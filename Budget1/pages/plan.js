(function () {
  var B = window.Budget;
  var tab = 'budget';
  var viewKey = null;
  var view = null;          // null = the list. Otherwise a form that opens on this page.
  var msg = '', msgErr = false;

  function L(en, bn) { return B.L(en, bn); }
  function esc(s) { return B.esc(s); }
  function money(p) { return B.money.format(p); }
  function $(id) { return document.getElementById(id); }

  function say(text, isErr) { msg = text; msgErr = !!isErr; }

  function msgHtml() {
    if (!msg) return '';
    var html = '<p class="msg' + (msgErr ? '' : ' ok') + '">' + esc(msg) + '</p>';
    msg = ''; msgErr = false;
    return html;
  }

  function backBtn() {
    return '<button class="ghost wide" data-vback="1">← ' + L('Back', 'ফিরে যান') + '</button>';
  }

  function rolloverRow(on) {
    return '<div class="setting-row"><span>' + L('Carry unused money to next month', 'অব্যবহৃত টাকা পরের মাসে নিন') +
      '</span><button class="switch' + (on ? ' on' : '') + '" data-roll="1" aria-label="Carry over"></button></div>';
  }

  function monthNav() {
    var isCurrent = viewKey >= B.dates.currentMonthKey();
    return '<div class="card"><div class="month-nav">' +
      '<button data-month="prev" aria-label="Previous month">‹</button>' +
      '<span>' + B.dates.monthLabel(viewKey) + '</span>' +
      '<button data-month="next" aria-label="Next month"' + (isCurrent ? ' disabled' : '') + '>›</button>' +
      '</div></div>';
  }

  function tilesHtml() {
    return '<div class="tile-row">' +
      '<button class="action-tile new" data-new="1"><span class="at-ico">＋</span>' +
        '<b>' + L('New budget', 'নতুন বাজেট') + '</b>' +
        '<small>' + L('Pick a category and amount', 'ক্যাটাগরি ও পরিমাণ বাছুন') + '</small></button>' +
      '<button class="action-tile personal" data-personal="1"><span class="at-ico">◔</span>' +
        '<b>' + L('Personal budget', 'ব্যক্তিগত বাজেট') + '</b>' +
        '<small>' + L('Split money by % or amount', 'শতাংশ বা টাকায় ভাগ করুন') + '</small></button>' +
    '</div>';
  }

  // ---------- Budget list ----------

  // Total is calculated from the category budgets. It is never set separately.
  function totalCard() {
    var tot = B.budgets.pctFor('__total__', viewKey);
    if (!tot) return '';
    var v = tot.view;
    var pct = Math.round(tot.pct);
    var s = B.statusOf(pct);
    return '<div class="card total-card"><div class="bud-row">' + B.ring(pct, s, 92) +
      '<div class="bud-info">' +
        '<div class="meta">' + L('Total budget (from your categories)', 'মোট বাজেট (আপনার ক্যাটাগরি থেকে)') + '</div>' +
        '<div class="total-val">' + money(v.available) + '</div>' +
        '<div class="meta">' + L('Spent', 'ব্যয়') + ' <b>' + money(v.spent) + '</b> · ' +
          L('Left', 'বাকি') + ' <b class="' + (v.remaining < 0 ? 'out' : 'in') + '">' + money(v.remaining) + '</b></div>' +
      '</div></div></div>';
  }

  // Every budget card has its own Close budget button, even when the budget is 0.
  function budgetCard(name) {
    var r = B.budgets.pctFor(name, viewKey);
    if (!r) return '';
    var v = r.view;
    var pct = Math.round(r.pct);
    var s = B.statusOf(pct);
    var zone = s === 'over' ? ' zone-over' : s === 'warn' ? ' zone-warn' : '';
    var note = s === 'over'
      ? '<div class="zone-msg over">⛔ ' + L('Over budget. Red zone.', 'বাজেট ছাড়িয়েছে। লাল সীমা।') + '</div>'
      : (s === 'warn' ? '<div class="zone-msg warn">⚠ ' + L('80% used. Close to the limit.', '৮০% খরচ হয়েছে। সীমার কাছে।') + '</div>' : '');
    return '<div class="card bud-wrap' + zone + '">' +
      '<button class="bud-card-btn" data-edit-budget="' + esc(name) + '">' +
        '<div class="bud-row">' + B.ring(pct, s, 64) +
          '<div class="bud-info"><div class="bud-title">' + B.categories.icon(name) + ' ' + esc(name) + '</div>' +
            '<span class="badge ' + s + '">' + pct + '%</span>' +
            '<div class="meta">' + L('Spent', 'ব্যয়') + ' ' + money(v.spent) + ' / ' + money(v.available) + '</div>' +
            '<div class="meta">' + L('Left', 'বাকি') + ' <b class="' + (v.remaining < 0 ? 'out' : '') + '">' + money(v.remaining) + '</b></div>' +
          '</div></div>' + note +
      '</button>' +
      '<div class="btn-row" style="margin-top:8px">' +
        '<button class="mini danger" data-close-budget="' + esc(name) + '">' + L('Close budget', 'বাজেট বন্ধ করুন') + '</button>' +
      '</div></div>';
  }

  function budgetList() {
    var rows = B.budgets.rows(viewKey);
    var alerts = rows.filter(function (x) { return Math.round(x.r.pct) >= 80; });
    var html = monthNav() + tilesHtml() + msgHtml();

    if (!rows.length) {
      return html + '<div class="card meta">' +
        L('No budget yet. Tap New budget to start, or Personal budget to split your money.',
          'এখনো কোনো বাজেট নেই। নতুন বাজেট চাপুন, অথবা ব্যক্তিগত বাজেটে টাকা ভাগ করুন।') + '</div>';
    }
    html += totalCard();
    if (alerts.length) {
      html += '<div class="card zone-msg warn">⚠ ' + L('Attention', 'সতর্কতা') + ': ' +
        alerts.map(function (x) { return esc(x.name); }).join(', ') + '</div>';
    }
    return html + rows.map(function (x) { return budgetCard(x.name); }).join('');
  }

  // ---------- New budget ----------

  function newBudgetView(d) {
    var cats = B.categories.ordered();
    var notice = d.existing
      ? '<div class="zone-msg warn">⚠ ' + L('This category already has a budget. Saving changes its amount from this month on.',
          'এই ক্যাটাগরির বাজেট আগে থেকেই চলছে। সেভ করলে এই মাস থেকে পরিমাণ বদলে যাবে।') + '</div>'
      : '';
    return '<div class="card"><h2>' + L('New budget', 'নতুন বাজেট') + '</h2>' +
      '<div class="ed-label">' + L('Choose a category', 'ক্যাটাগরি বাছুন') + '</div>' +
      '<div class="cat-grid">' + cats.map(function (c) {
        return '<button class="cat-tile' + (d.key === c ? ' sel' : '') + '" data-pick="' + esc(c) + '">' +
          '<span>' + B.categories.icon(c) + '</span><b>' + esc(c) + '</b></button>';
      }).join('') +
        '<button class="cat-tile add" data-addcat="1"><span>＋</span><b>' + L('Add new category', 'নতুন ক্যাটাগরি') + '</b></button>' +
      '</div>' +
      notice +
      '<div class="field"><label>' + L('Monthly amount (৳)', 'মাসিক পরিমাণ (৳)') + '</label>' +
        '<input id="nb-amt" inputmode="decimal" value="' + esc(d.amount) + '" placeholder="0"></div>' +
      rolloverRow(d.rollover) +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<button class="primary" data-save="1">' + (d.existing ? L('Update budget', 'বাজেট আপডেট') : L('Save budget', 'বাজেট সেভ')) + '</button>' +
      backBtn() + '</div>';
  }

  function newCatView(d) {
    return '<div class="card"><h2>' + L('New category', 'নতুন ক্যাটাগরি') + '</h2>' +
      '<div class="field"><label>' + L('Category name', 'ক্যাটাগরির নাম') + '</label>' +
        '<input id="nc-name" value="' + esc(d.name) + '" placeholder="' + L('e.g. College travel', 'যেমন: কলেজে যাতায়াত') + '"></div>' +
      '<div class="ed-label">' + L('Choose an icon', 'একটি আইকন বাছুন') + '</div>' +
      '<div class="icon-grid">' + B.categoryIcons.map(function (i) {
        return '<button class="icon-opt' + (i === d.icon ? ' sel' : '') + '" data-icon="' + i + '">' + i + '</button>';
      }).join('') + '</div>' +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<button class="primary" data-save="1">' + L('Create category', 'ক্যাটাগরি তৈরি করুন') + '</button>' +
      backBtn() + '</div>';
  }

  // ---------- Edit one budget ----------

  function editBudgetView(key, d) {
    return '<div class="card"><h2>' + B.categories.icon(key) + ' ' + esc(key) + '</h2>' +
      '<p class="meta">' + L('A new amount applies from this month on. Past months stay as they were.',
        'নতুন পরিমাণ এই মাস থেকে কার্যকর হবে। আগের মাসের হিসাব বদলাবে না।') + '</p>' +
      '<div class="field"><label>' + L('Monthly amount (৳)', 'মাসিক পরিমাণ (৳)') + '</label>' +
        '<input id="eb-amt" inputmode="decimal" value="' + esc(d.amount) + '"></div>' +
      rolloverRow(d.rollover) +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<button class="primary" data-save="1">' + L('Save', 'সেভ') + '</button>' +
      '<button class="link-danger" data-close-budget="' + esc(key) + '">' + L('Close this budget', 'এই বাজেট বন্ধ করুন') + '</button>' +
      backBtn() + '</div>';
  }

  // ---------- Personal budget: choose categories, split by % or amount ----------

  function chosen(st) {
    return B.categories.ordered().filter(function (c) { return st.picked[c]; });
  }

  function resplitEqual(st) {
    var total = B.money.toPaisa(st.total) || 0;
    var list = chosen(st);
    st.pct = {};
    st.amt = {};
    if (!list.length) return;
    var each = Math.floor(100 / list.length);
    list.forEach(function (c, i) {
      var p = each + (i === 0 ? 100 - each * list.length : 0);
      st.pct[c] = p;
      st.amt[c] = Math.round(total * p / 100);
    });
  }

  function personalView(st) {
    var cats = B.categories.ordered();
    var picked = chosen(st);
    var split = picked.map(function (c) {
      return '<div class="split-row"><div class="split-name">' + B.categories.icon(c) + ' ' + esc(c) + '</div>' +
        '<div class="split-inputs">' +
          '<input class="pct" data-pct="' + esc(c) + '" inputmode="numeric" value="' + (st.pct[c] || 0) + '"><span>%</span>' +
          '<input class="amt" data-amt="' + esc(c) + '" inputmode="decimal" value="' + B.money.toInput(st.amt[c] || 0) + '"><span>৳</span>' +
        '</div></div>';
    }).join('');
    return '<div class="card"><h2>' + L('Personal budget', 'ব্যক্তিগত বাজেট') + '</h2>' +
      '<div class="field"><label>' + L('How much do you want to budget? (৳)', 'কত টাকা বাজেট করতে চান? (৳)') + '</label>' +
        '<input id="pb-total" inputmode="decimal" value="' + esc(st.total) + '" placeholder="0"></div>' +
      '<div class="ed-label">' + L('Choose categories', 'ক্যাটাগরি বাছুন') + '</div>' +
      '<div class="cat-grid">' + cats.map(function (c) {
        return '<button class="cat-tile' + (st.picked[c] ? ' sel' : '') + '" data-pickc="' + esc(c) + '">' +
          '<span>' + B.categories.icon(c) + '</span><b>' + esc(c) + '</b></button>';
      }).join('') +
        '<button class="cat-tile add" data-addcat="1"><span>＋</span><b>' + L('Add new category', 'নতুন ক্যাটাগরি') + '</b></button>' +
      '</div>' +
      (picked.length
        ? '<div class="ed-label">' + L('Split', 'ভাগ করুন') + '</div>' + split + '<p class="meta" id="pb-sum"></p>'
        : '<p class="meta">' + L('Pick at least one category.', 'কমপক্ষে একটি ক্যাটাগরি বাছুন।') + '</p>') +
      '<p class="msg">' + esc(st.err) + '</p>' +
      '<button class="primary" data-apply="1">' + L('Apply budget', 'বাজেট চালু করুন') + '</button>' +
      backBtn() + '</div>';
  }

  function updateSum(root, st) {
    var el = root.querySelector('#pb-sum');
    if (!el) return;
    var total = B.money.toPaisa(st.total) || 0;
    var sum = chosen(st).reduce(function (s, c) { return s + (st.amt[c] || 0); }, 0);
    var left = total - sum;
    el.textContent = L('Allocated', 'বরাদ্দ') + ' ' + money(sum) + ' · ' +
      (left >= 0 ? L('Left', 'বাকি') + ' ' + money(left) : L('Over by', 'বেশি') + ' ' + money(-left));
    el.className = 'meta' + (left < 0 ? ' out' : '');
  }

  function setField(root, attr, name, value) {
    var inputs = root.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].getAttribute(attr) === name) { inputs[i].value = value; return; }
    }
  }

  // Typing a % updates the amount, and typing an amount updates the %. Nothing is redrawn.
  function personalInput(target, st, root) {
    if (target.id === 'pb-total') {
      target.value = B.cleanAmount(target.value);
      st.total = target.value;
      var total = B.money.toPaisa(st.total) || 0;
      chosen(st).forEach(function (c) {
        st.amt[c] = Math.round(total * (st.pct[c] || 0) / 100);
        setField(root, 'data-amt', c, B.money.toInput(st.amt[c]));
      });
    } else if (target.hasAttribute('data-pct')) {
      var pc = target.getAttribute('data-pct');
      var total2 = B.money.toPaisa(st.total) || 0;
      st.pct[pc] = Math.max(0, Math.min(100, Math.round(+target.value || 0)));
      st.amt[pc] = Math.round(total2 * st.pct[pc] / 100);
      setField(root, 'data-amt', pc, B.money.toInput(st.amt[pc]));
    } else if (target.hasAttribute('data-amt')) {
      target.value = B.cleanAmount(target.value);
      var ac = target.getAttribute('data-amt');
      var total3 = B.money.toPaisa(st.total) || 0;
      st.amt[ac] = Math.max(0, B.money.toPaisaAny(target.value) || 0);
      st.pct[ac] = total3 > 0 ? Math.round(st.amt[ac] * 100 / total3) : 0;
      setField(root, 'data-pct', ac, st.pct[ac]);
    } else {
      return;
    }
    updateSum(root, st);
  }

  // ---------- Goal forms ----------

  function goalFormHtml(prefix, d, title, saveLabel, saveAttr) {
    return '<div class="card"><h2>' + title + '</h2>' +
      '<div class="field"><label>' + L('Goal name', 'লক্ষ্যের নাম') + '</label>' +
        '<input id="' + prefix + '-name" value="' + esc(d.name) + '" placeholder="' + L('e.g. New phone', 'যেমন: নতুন ফোন') + '"></div>' +
      '<div class="field"><label>' + L('Target amount (৳)', 'লক্ষ্যমাত্রা (৳)') + '</label>' +
        '<input id="' + prefix + '-target" inputmode="decimal" value="' + esc(d.target) + '" placeholder="0"></div>' +
      '<div class="field"><label>' + L('Target date', 'লক্ষ্যের তারিখ') + '</label>' +
        '<button class="date-btn" data-gdate="1">' + (d.date ? B.dates.toDisplay(d.date) : L('Pick a date', 'তারিখ বাছুন')) + '  ▾</button>' +
        '<div id="' + prefix + '-cal" class="calendar' + (d.showCal ? '' : ' hidden') + '"></div></div>' +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<button class="primary" ' + saveAttr + '="1">' + saveLabel + '</button>' +
      backBtn() + '</div>';
  }

  function newGoalView(d) {
    return goalFormHtml('ng', d, L('New goal', 'নতুন লক্ষ্য'), L('Create goal', 'লক্ষ্য তৈরি করুন'), 'data-create');
  }

    // The entries that moved money into or out of one goal.
  function goalHistoryHtml(g) {
    var ref = 'goal:' + g.id;
    var rows = B.transactions.all().filter(function (t) {
      return t.account === ref || t.toAccount === ref;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (!rows.length) return '<div class="card meta">' + L('No money has moved in this goal yet.', 'এই লক্ষ্যে এখনো টাকা জমা হয়নি।') + '</div>';
    return '<div class="card"><h2>' + L('History', 'ইতিহাস') + '</h2>' +
      rows.map(function (t) {
        var into = t.toAccount === ref;
        return '<div class="item-row"><div><b>' + (into ? '+ ' : '− ') + money(t.amount) + '</b>' +
          '<div class="meta">' + B.dates.toDisplay(t.date) + ' · ' +
          (into ? L('From ', 'থেকে ') + esc(t.account || 'Cash') : L('To ', 'যাবে ') + esc(t.toAccount || 'Cash')) +
          '</div></div></div>';
      }).join('') + '</div>';
  }

  function editGoalView(d, g) {
    return goalFormHtml('eg', d, '🎯 ' + L('Edit goal', 'লক্ষ্য সম্পাদনা'), L('Save changes', 'পরিবর্তন সেভ করুন'), 'data-egsave') +
      goalHistoryHtml(g);
  }

  function closeGoalView(g, d) {
    var bal = B.balances(B.transactions.all());
    var pr = B.goals.progress(g, bal);
    return '<div class="card goal-plan done"><h2>🎯 ' + esc(g.name) + '</h2>' +
      '<div class="goal-nums big-nums">' +
        '<span>' + L('Target', 'লক্ষ্য') + '<b>' + money(g.target) + '</b></span>' +
        '<span>' + L('Saved', 'জমা') + '<b>' + money(pr.saved) + '</b></span>' +
        '<span>' + L('Remaining', 'বাকি') + '<b>' + money(pr.remaining) + '</b></span>' +
      '</div>' +
      '<p class="meta" style="margin-top:12px">' + L('Where do you want to move this money?', 'এই টাকাটা কোথায় নিতে চান?') + '</p>' +
      '<div class="acc-list">' + B.accounts.ordered().map(function (a) {
        return '<button class="acc-card' + (d.to === a.name ? ' sel' : '') + '" data-closeto="' + esc(a.name) + '">' +
          '<span class="acc-name">' + esc(a.name) + '</span>' +
          '<span class="acc-bal">' + money(bal[a.name] || 0) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<button class="primary" data-closeconfirm="1">' + L('Close goal and move money', 'লক্ষ্য বন্ধ করে টাকা সরান') + '</button>' +
      backBtn() + '</div>';
  }

  function viewHtml() {
    var v = view;
    if (v.kind === 'new') return newBudgetView(v.d);
    if (v.kind === 'newcat') return newCatView(v.d);
    if (v.kind === 'personal') return personalView(v.st);
    if (v.kind === 'editbudget') return editBudgetView(v.key, v.d);
    if (v.kind === 'newgoal') return newGoalView(v.d);
    if (v.kind === 'editgoal') return editGoalView(v.d, v.goal);
    if (v.kind === 'closegoal') return closeGoalView(v.goal, v.d);
    return budgetList();
  }

  // ---------- Goals tab ----------

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

  function goalsTab() {
    var bal = B.balances(B.transactions.all());
    var html = msgHtml();
    html += '<div class="tile-row">' +
      '<button class="action-tile new goal-new" data-newgoal="1"><span class="at-ico">＋</span>' +
        '<b>' + L('New goal', 'নতুন লক্ষ্য') + '</b>' +
        '<small>' + L('Set a name, target and date', 'নাম, লক্ষ্য ও তারিখ দিন') + '</small></button>' +
    '</div>';

    var goals = B.goals.all().slice().sort(function (a, b) {
      var pa = B.goals.progress(a, bal).done, pb = B.goals.progress(b, bal).done;
      if (pa !== pb) return pa ? 1 : -1;
      var da = daysLeft(a), db = daysLeft(b);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    if (!goals.length) html += '<div class="card meta">' + L('No active goals yet. Tap New goal.', 'এখনো কোনো সক্রিয় লক্ষ্য নেই। নতুন লক্ষ্য চাপুন।') + '</div>';

    goals.forEach(function (g) {
      var pr = B.goals.progress(g, bal);
      var st = dateStatus(g, pr);
      html += '<div class="card goal-plan' + (pr.done ? ' done' : '') + '" data-goal-open="' + g.id + '"' +
        (st ? ' style="background:' + st.bg + ';color:' + st.ink + '"' : '') + '>' +
        '<div class="bud-row">' + B.ring(pr.pct, 'ok', 76) +
          '<div class="bud-info">' +
            '<div class="bud-title">🎯 ' + esc(g.name) +
              (pr.done ? ' <span class="badge ok">' + L('Completed', 'সম্পন্ন') + '</span>' : '') +
              (st ? ' <span class="badge">' + st.text + '</span>' : '') + '</div>' +
            (g.deadline ? '<div class="meta">' + L('Target date', 'লক্ষ্যের তারিখ') + ': ' + B.dates.toDisplay(g.deadline) + '</div>' : '') +
          '</div></div>' +
        '<div class="goal-nums big-nums">' +
          '<span>' + L('Target', 'লক্ষ্য') + '<b>' + money(g.target) + '</b></span>' +
          '<span>' + L('Saved', 'জমা') + '<b>' + money(pr.saved) + '</b></span>' +
          '<span>' + L('Remaining', 'বাকি') + '<b>' + money(pr.remaining) + '</b></span>' +
        '</div>' +
        '<div class="bar"><div class="fill ok" style="width:' + pr.pct + '%"></div></div>' +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="mini primary-mini" data-goal-add="' + g.id + '">' + L('Add money', 'টাকা জমান') + '</button>' +
          '<button class="mini" data-goal-take="' + g.id + '"' + (pr.saved <= 0 ? ' disabled' : '') + '>' + L('Take out', 'টাকা তুলুন') + '</button>' +
          '<button class="mini" data-goal-close="' + g.id + '">' + L('Close goal', 'লক্ষ্য বন্ধ') + '</button>' +
        '</div>' +
      '</div>';
    });

    var closed = B.goals.closed();
    if (closed.length) {
      html += '<div class="card"><h2>' + L('Closed goals', 'বন্ধ লক্ষ্য') + '</h2>' +
        closed.map(function (g) {
          return '<div class="item-row"><div><b>' + esc(g.name) + '</b>' +
            '<div class="meta">' + L('Closed ', 'বন্ধ: ') + B.dates.toDisplay(g.closedAt.slice(0, 10)) +
            ' · ' + L('Target ', 'লক্ষ্য ') + money(g.target) + '</div></div>' +
            '<button class="mini danger" data-goal-del="' + g.id + '">' + L('Delete', 'মুছুন') + '</button></div>';
        }).join('') + '</div>';
    }
    return html;
  }

  // ---------- Click handling ----------

  function budgetClick(e) {
    var v = view, el;

    if (v.kind === 'new') {
      if ((el = e.target.closest('[data-pick]'))) {
        var key = el.getAttribute('data-pick');
        var cfg = B.budgets.get(key);
        v.d.key = key;
        v.d.err = '';
        v.d.existing = !!cfg;
        if (cfg) { v.d.amount = B.money.toInput(cfg.limit); v.d.rollover = cfg.rollover; }
        return B.refresh();
      }
      if (e.target.closest('[data-addcat]')) {
        view = { kind: 'newcat', d: { name: '', icon: B.categoryIcons[0], err: '' }, parent: v };
        return B.refresh();
      }
      if (e.target.closest('[data-roll]')) { v.d.rollover = !v.d.rollover; return B.refresh(); }
      if (e.target.closest('[data-save]')) {
        if (!v.d.key) { v.d.err = L('Choose a category first.', 'আগে ক্যাটাগরি বাছুন।'); return B.refresh(); }
        var paisa = B.money.toPaisa(v.d.amount);
        if (paisa === null) { v.d.err = L('Enter an amount greater than 0.', '০ এর বেশি লিখুন।'); return B.refresh(); }
        var name = v.d.key;
        B.budgets.setLimit(name, paisa);
        B.budgets.setRollover(name, v.d.rollover);
        view = null;
        say('', false);
        B.refresh();
        return B.success(L('Budget saved', 'বাজেট সেভ হয়েছে'), [name + ' · ' + money(paisa)], 'ok');
      }
      return;
    }

    if (v.kind === 'newcat') {
      if ((el = e.target.closest('[data-icon]'))) { v.d.icon = el.getAttribute('data-icon'); return B.refresh(); }
      if (e.target.closest('[data-save]')) {
        var err = B.categories.add(v.d.name);
        if (err) { v.d.err = err; return B.refresh(); }
        var clean = String(v.d.name).trim();
        B.categories.setIcon(clean, v.d.icon);
        var parent = v.parent;
        if (parent && parent.kind === 'new') { parent.d.key = clean; parent.d.existing = false; }
        if (parent && parent.kind === 'personal') { parent.st.picked[clean] = true; resplitEqual(parent.st); }
        view = parent || null;
        return B.refresh();
      }
      return;
    }

    if (v.kind === 'personal') {
      if ((el = e.target.closest('[data-pickc]'))) {
        var n = el.getAttribute('data-pickc');
        v.st.picked[n] = !v.st.picked[n];
        resplitEqual(v.st);
        v.st.err = '';
        return B.refresh();
      }
      if (e.target.closest('[data-addcat]')) {
        view = { kind: 'newcat', d: { name: '', icon: B.categoryIcons[0], err: '' }, parent: v };
        return B.refresh();
      }
      if (e.target.closest('[data-apply]')) {
        var st = v.st;
        var total = B.money.toPaisa(st.total);
        var list = chosen(st);
        if (total === null) { st.err = L('Enter an amount greater than 0.', '০ এর বেশি লিখুন।'); return B.refresh(); }
        if (!list.length) { st.err = L('Choose at least one category.', 'কমপক্ষে একটি ক্যাটাগরি বাছুন।'); return B.refresh(); }
        var allocated = list.reduce(function (s, c) { return s + (st.amt[c] || 0); }, 0);
        if (allocated > total) {
          st.err = L('More than the total is allocated. Lower some amounts.', 'মোট টাকার বেশি বরাদ্দ হয়েছে। কিছু কমান।');
          return B.refresh();
        }
        var splits = {};
        list.forEach(function (c) { splits[c] = st.amt[c] || 0; });
        B.budgets.applyPlan(splits);
        view = null;
        say('', false);
        B.refresh();
        return B.success(L('Personal budget applied', 'ব্যক্তিগত বাজেট চালু হয়েছে'),
          [list.length + ' ' + L('categories', 'টি ক্যাটাগরি') + ' · ' + money(total)], 'ok');
      }
      return;
    }

    if (v.kind === 'editbudget') {
      if (e.target.closest('[data-roll]')) { v.d.rollover = !v.d.rollover; return B.refresh(); }
      if (e.target.closest('[data-save]')) {
        var p2 = B.money.toPaisa(v.d.amount);
        if (p2 === null) { v.d.err = L('Enter an amount greater than 0.', '০ এর বেশি লিখুন।'); return B.refresh(); }
        B.budgets.setLimit(v.key, p2);
        B.budgets.setRollover(v.key, v.d.rollover);
        view = null;
        B.refresh();
        return B.success(L('Budget updated', 'বাজেট আপডেট হয়েছে'), [v.key + ' · ' + money(p2)], 'ok');
      }
      if ((el = e.target.closest('[data-close-budget]'))) return closeBudget(el.getAttribute('data-close-budget'));
      return;
    }
  }

  // Closing a budget removes its limit. Earlier months keep their spending record.
  function closeBudget(key) {
    if (!window.confirm(L('Close this budget? Its limit is removed. Past history stays.',
      'এই বাজেট বন্ধ করবেন? সীমা মুছে যাবে। আগের হিসাব থাকবে।'))) return;
    B.budgets.setLimit(key, null);
    view = null;
    say(L('Budget closed.', 'বাজেট বন্ধ হয়েছে।'), false);
    B.refresh();
  }

  // Shared handler for the New goal and Edit goal forms.
  function goalFormClick(e, prefix, d, onSave) {
    if (!e.target.closest('[data-gdate],[data-create],[data-egsave]')) return;
    if (e.target.closest('[data-gdate]')) {
      d.name = $(prefix + '-name').value;
      d.target = $(prefix + '-target').value;
      d.showCal = !d.showCal;
      return B.refresh();
    }
    var target = B.money.toPaisa($(prefix + '-target').value);
    d.name = $(prefix + '-name').value;
    d.target = $(prefix + '-target').value;
    if (target === null) { d.err = L('Enter a target greater than 0.', 'লক্ষ্যমাত্রা ০ এর বেশি লিখুন।'); return B.refresh(); }
    if (!d.date) { d.err = L('Pick a target date.', 'লক্ষ্যের তারিখ বাছুন।'); return B.refresh(); }
    var err = onSave(d.name, target, d.date);
    if (err) d.err = err;
    return B.refresh();
  }

    function goalsClick(e) {
    var el;
    if (e.target.closest('[data-newgoal]')) {
      view = { kind: 'newgoal', parent: null, d: { name: '', target: '', date: null, showCal: false, err: '' } };
      return B.refresh();
    }
    if ((el = e.target.closest('[data-goal-add]'))) {
      return B.openTransaction({ type: 'transfer', to: 'goal:' + el.getAttribute('data-goal-add') });
    }
    if ((el = e.target.closest('[data-goal-take]'))) {
      return B.openTransaction({ type: 'transfer', from: 'goal:' + el.getAttribute('data-goal-take') });
    }
    if ((el = e.target.closest('[data-goal-close]'))) {
      var cg = B.goals.all().filter(function (x) { return x.id === el.getAttribute('data-goal-close'); })[0];
      if (!cg) return;
      view = { kind: 'closegoal', goal: cg, parent: null, d: { to: null, err: '' } };
      return B.refresh();
    }
    if ((el = e.target.closest('[data-goal-del]'))) {
      if (!window.confirm(L('Delete this goal? This cannot be undone.', 'এই লক্ষ্য মুছবেন? এটি ফেরানো যাবে না।'))) return;
      var derr = B.goals.remove(el.getAttribute('data-goal-del'));
      say(derr || L('Goal deleted.', 'লক্ষ্য মুছে ফেলা হয়েছে।'), !!derr);
      return B.refresh();
    }
    // Tapping anywhere else on a goal card opens its edit page.
    if ((el = e.target.closest('[data-goal-open]'))) {
      var eg = B.goals.all().filter(function (x) { return x.id === el.getAttribute('data-goal-open'); })[0];
      if (!eg) return;
      view = { kind: 'editgoal', goal: eg, parent: null,
        d: { name: eg.name, target: B.money.toInput(eg.target), date: eg.deadline || null, showCal: false, err: '' } };
      return B.refresh();
    }
  }

  B.registerPage({
    id: 'plan',
    get label() { return L('Budget & Goals', 'বাজেট ও লক্ষ্য'); },

    // The dashboard can ask for a tab ("budget" or "goals") when this page opens.
    onEnter: function () {
      if (B.pendingPlanTab) { tab = B.pendingPlanTab; B.pendingPlanTab = null; }
      view = null; msg = '';
    },

    render: function (root) {
      if (!viewKey) viewKey = B.dates.currentMonthKey();

      // An open form always shows first. Otherwise the current tab's list.
      var body = view ? viewHtml() : (tab === 'goals' ? goalsTab() : budgetList());
      root.innerHTML =
        '<div class="tabs">' +
          '<button class="tab' + (tab === 'budget' ? ' on' : '') + '" data-tab="budget">' + L('Budget', 'বাজেট') + '</button>' +
          '<button class="tab' + (tab === 'goals' ? ' on' : '') + '" data-tab="goals">' + L('Goals', 'লক্ষ্য') + '</button>' +
        '</div>' + body;

      // Calendars inside the goal forms.
      if (view && view.kind === 'newgoal') {
        B.datePicker.mount(root.querySelector('#ng-cal'), view.d.date || B.dates.today(), function (iso) {
          view.d.date = iso; view.d.showCal = false; B.refresh();
        });
      }
      if (view && view.kind === 'editgoal') {
        B.datePicker.mount(root.querySelector('#eg-cal'), view.d.date || B.dates.today(), function (iso) {
          view.d.date = iso; view.d.showCal = false; B.refresh();
        });
      }
      if (view && view.kind === 'personal') updateSum(root, view.st);

      root.onclick = function (e) {
        var el;
        if ((el = e.target.closest('[data-tab]'))) {
          tab = el.getAttribute('data-tab');
          view = null; msg = '';
          return B.refresh();
        }
        if (e.target.closest('[data-vback]')) {
          view = view && view.parent ? view.parent : null;
          return B.refresh();
        }

        // Goal forms
        if (view && view.kind === 'newgoal') {
          return goalFormClick(e, 'ng', view.d, function (name, target, date) {
            var err = B.goals.add(name, target, date);
            if (err) return err;
            view = null;
            say(L('Goal created.', 'লক্ষ্য তৈরি হয়েছে।'), false);
            return null;
          });
        }
        if (view && view.kind === 'editgoal') {
          return goalFormClick(e, 'eg', view.d, function (name, target, date) {
            var err = B.goals.update(view.goal.id, name, target, date);
            if (err) return err;
            view = null;
            say(L('Goal updated.', 'লক্ষ্য আপডেট হয়েছে।'), false);
            return null;
          });
        }
        if (view && view.kind === 'closegoal') {
          var el2;
          if ((el2 = e.target.closest('[data-closeto]'))) {
            view.d.to = el2.getAttribute('data-closeto');
            view.d.err = '';
            return B.refresh();
          }
          if (e.target.closest('[data-closeconfirm]')) {
            if (!view.d.to) { view.d.err = L('Choose an account.', 'একটি অ্যাকাউন্ট বাছুন।'); return B.refresh(); }
            if (!window.confirm(L('Close this goal? The money moves to ' + view.d.to + '.',
              'লক্ষ্য বন্ধ করবেন? টাকা ' + view.d.to + '-এ যাবে।'))) return;
            var gname = view.goal.name, to = view.d.to;
            var cerr = B.goals.close(view.goal.id, to);
            if (cerr) { view.d.err = cerr; return B.refresh(); }
            view = null;
            say(L('Goal closed. Money moved to ', 'লক্ষ্য বন্ধ হয়েছে। টাকা গেছে ') + to + '.', false);
            B.refresh();
            return B.success(L('Goal closed', 'লক্ষ্য বন্ধ হয়েছে'), [gname + ' → ' + to], 'ok');
          }
          return;
        }

        if (tab === 'goals') return goalsClick(e);

        if (view) return budgetClick(e);

        if ((el = e.target.closest('[data-close-budget]'))) return closeBudget(el.getAttribute('data-close-budget'));
        if ((el = e.target.closest('[data-month]'))) {
          viewKey = B.dates.shiftMonth(viewKey, el.getAttribute('data-month') === 'prev' ? -1 : 1);
          return B.refresh();
        }
        if (e.target.closest('[data-new]')) {
          view = { kind: 'new', parent: null, d: { key: null, amount: '', rollover: false, err: '', existing: false } };
          return B.refresh();
        }
        if (e.target.closest('[data-personal]')) {
          view = { kind: 'personal', parent: null, st: { total: '', picked: {}, pct: {}, amt: {}, err: '' } };
          return B.refresh();
        }
        if ((el = e.target.closest('[data-edit-budget]'))) {
          var name = el.getAttribute('data-edit-budget');
          var cfg = B.budgets.get(name);
          if (!cfg) return;
          view = { kind: 'editbudget', key: name, parent: null,
            d: { amount: B.money.toInput(cfg.limit), rollover: cfg.rollover, err: '' } };
          return B.refresh();
        }
      };

      root.oninput = function (e) {
        if (!view) return;
        var t = e.target;
        if (view.kind === 'new' && t.id === 'nb-amt') view.d.amount = B.cleanAmount(t.value);
        if (view.kind === 'newcat' && t.id === 'nc-name') view.d.name = t.value;
        if (view.kind === 'editbudget' && t.id === 'eb-amt') view.d.amount = B.cleanAmount(t.value);
        if (view.kind === 'newgoal' && t.id === 'ng-target') view.d.target = B.cleanAmount(t.value);
        if (view.kind === 'newgoal' && t.id === 'ng-name') view.d.name = t.value;
        if (view.kind === 'editgoal' && t.id === 'eg-name') view.d.name = t.value;
        if (view.kind === 'editgoal' && t.id === 'eg-target') view.d.target = B.cleanAmount(t.value);
        if (view.kind === 'personal') personalInput(t, view.st, root);
      };
    }
  });
})();