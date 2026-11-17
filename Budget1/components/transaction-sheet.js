(function () {
  var B = window.Budget;
  var state = null;
  var ICONS = {
    income: '💰', expense: '🧾', transfer: '🔁',
    loan_received: '🤝', loan_repaid: '↩️', loan_given: '📤', loan_collected: '📥'
  };
  var CHOICE = { type: 1, category: 1, account: 1, from: 1, to: 1 };
  // Types that pay back an existing debt or loan, and the group they belong to.
  var REPAY = { loan_repaid: 'debt', loan_collected: 'loan' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return B.esc(s); }
  function t(k) { return B.t(k); }
  function L(en, bn) { return B.L(en, bn); }
  function money(p) { return B.money.format(p); }
  function isLoan(type) { return B.isLoan(type); }
  function isGoal(ep) { return B.isGoalRef(ep); }

  function build() {
    if ($('sheet-wrap')) return;
    var wrap = document.createElement('div');
    wrap.id = 'sheet-wrap';
    wrap.innerHTML =
      '<div id="sheet-overlay"></div>' +
      '<div id="sheet" role="dialog" aria-modal="true">' +
        '<div class="sheet-grip"></div>' +
        '<div class="sheet-top"><h2 id="sheet-title"></h2>' +
        '<button id="sheet-x" class="icon-btn" aria-label="Close">✕</button></div>' +
        '<div id="sheet-progress" class="progress"></div>' +
        '<div id="sheet-body"></div>' +
        '<p id="s-msg" class="msg"></p>' +
        '<div id="sheet-actions" class="sheet-actions">' +
          '<button id="s-back" class="ghost"></button><button id="s-next" class="primary"></button>' +
        '</div>' +
        '<button id="s-quick" class="primary"></button>' +
        '<button id="s-delete" class="link-danger"></button>' +
      '</div>';
    document.body.appendChild(wrap);
    $('sheet-overlay').onclick = close;
    $('sheet-x').onclick = close;
    $('s-back').onclick = backPressed;
    $('s-next').onclick = next;
    $('s-quick').onclick = save;
    $('s-delete').onclick = remove;
  }

  // Keeps the form above anything opened earlier.
  function raise() {
    var w = $('sheet-wrap');
    if (w) document.body.appendChild(w);
  }

  function stepsFor(type) {
    if (!type) return ['type'];
    if (type === 'transfer') return ['type', 'amount', 'date', 'from', 'to', 'note'];
    if (isLoan(type)) return ['type', 'amount', 'date', 'account', 'person', 'note'];
    return ['type', 'amount', 'date', 'category', 'account', 'note'];
  }

  function otherAccount(exclude) {
    var first = B.accounts.ordered().filter(function (a) { return a.name !== exclude; })[0];
    return first ? first.name : null;
  }

  function listExcl() {
    var all = B.transactions.all();
    return state && state.editingId ? all.filter(function (x) { return x.id !== state.editingId; }) : all;
  }

  // Cleans an amount box value (005 -> 5) and returns it.
  function amountOf(input) {
    input.value = B.cleanAmount(input.value);
    return input.value;
  }

  // ---- Running debt or loan ----
  function runningFor(type, person) {
    var group = REPAY[type];
    if (!group) return null;
    var name = String(person || '').trim();
    return B.debts.list(group).filter(function (p) {
      return p.name === name && p.remaining > 0;
    })[0] || null;
  }

  function noRunningMsg(type) {
    return type === 'loan_repaid'
      ? L('No running debt for this person. Add a debt first.', 'এই ব্যক্তির চলমান দেনা নেই। আগে দেনা যোগ করুন।')
      : L('No running loan for this person. Add a loan first.', 'এই ব্যক্তির চলমান ধার নেই। আগে ধার যোগ করুন।');
  }

  // Returns a message when the amount is more than what is left, otherwise null.
  function overpayMsg(type, person, amount) {
    var r = runningFor(type, person);
    if (!r) return noRunningMsg(type);
    if (amount > r.remaining) {
      return L('Only ' + money(r.remaining) + ' is left for ' + r.name + '. Go back and enter ' +
        money(r.remaining) + ' or less.',
        r.name + '-এর বাকি আছে ' + money(r.remaining) + '। পেছনে গিয়ে ' + money(r.remaining) + ' বা কম দিন।');
    }
    return null;
  }

  // ---- Pickers ----
  function accountItems(selected, exclude) {
    var bal = B.balances(listExcl());
    var items = B.accounts.ordered()
      .filter(function (a) { return a.name !== exclude; })
      .map(function (a) { return { ep: a.name, label: a.name, bal: bal[a.name] || 0, removed: false }; });
    if (selected && !isGoal(selected) && !isBucket(selected) && selected !== exclude && items.every(function (i) { return i.ep !== selected; })) {
      items.push({ ep: selected, label: selected + ' ' + L('(deleted)', '(মুছে ফেলা)'), bal: 0, removed: true });
    }
    return items;
  }

  function goalButton(key, selected, mode) {
 


    var label = isGoal(selected) ? B.endpointLabel(selected) : L('Choose a goal', 'লক্ষ্য বাছুন');
    return '<button class="acc-card goal-entry' + (isGoal(selected) ? ' sel' : '') +
      '" data-goal-pick="' + key + '" data-mode="' + mode + '">' +
      '<span class="acc-name">🎯 ' + esc(label) + '</span><span class="acc-bal">›</span></button>';
  }

   // The Floating and Emergency funds: choices in transfer pickers, hidden when already the other side.
  var BUCKETS = ['floating', 'emergency'];
  function isBucket(ep) { return BUCKETS.indexOf(ep) !== -1 || (!!ep && ep.indexOf('saving:') === 0); }

      function isSaving(ep) { return !!ep && ep.indexOf('saving:') === 0; }

  // One FUNDS choice in transfer pickers. Floating, Emergency and Saving open from here.
  function fundsCard(key, selected) {
    var isFund = selected === 'floating' || selected === 'emergency' || isSaving(selected);
    var label = isFund ? B.endpointLabel(selected) : L('FUNDS', 'ফান্ড');
    return '<button class="acc-card' + (isFund ? ' sel' : '') + '" data-funds="' + key + '">' +
      '<span class="acc-name">💼 ' + esc(label) + '</span><span class="acc-bal">›</span></button>';
  }

  function openFundsPick(key) {
    state.view = { kind: 'funds', key: key, parent: null };
    renderStep();
  }

  function pickerHtml(key, selected, exclude, mode) {
    var html = accountItems(selected, exclude).map(function (a) {
      return '<button class="acc-card' + (a.ep === selected ? ' sel' : '') + (a.removed ? ' removed' : '') +
        '" data-ep="' + esc(a.ep) + '" data-key="' + key + '">' +
        '<span class="acc-name">' + esc(a.label) + '</span>' +
        '<span class="acc-bal">' + (a.removed ? '' : money(a.bal)) + '</span></button>';
    }).join('');
    if (mode === 'account') return html;
    return html + fundsCard(key, selected) + goalButton(key, selected, mode);
  }

  // ---- Goal pick and create: shown inside this form, with Back ----
  function openGoalPick(key, mode) {
    state.view = { kind: 'pick', key: key, mode: mode, parent: null };
    renderStep();
  }

  function leaveView() {
    state.view = state.view && state.view.parent ? state.view.parent : null;
    renderStep();
  }

    function renderGoalView() {
    var v = state.view;
    $('sheet-title').textContent = v.kind === 'create' ? L('New goal', 'নতুন লক্ষ্য')
      : v.kind === 'pick' ? L('Choose a goal', 'লক্ষ্য বাছুন')
      : v.kind === 'funds' ? L('Choose fund', 'ফান্ড বাছুন')
      : L('Choose saving', 'সঞ্চয় বাছুন');
    $('sheet-progress').innerHTML = '';
    $('sheet-actions').style.display = 'none';
    $('s-quick').style.display = 'none';
    $('s-delete').style.display = 'none';
    $('s-msg').textContent = '';
    var body = $('sheet-body');
    body.oninput = null;
    body.scrollTop = 0;
    if (v.kind === 'funds') paintFundsPick(body, v);
    else if (v.kind === 'savings') paintSavingsPick(body, v);
    else if (v.kind === 'pick') paintGoalPick(body, v);
    else paintGoalCreate(body, v);
  }

  // The three choices behind FUNDS.
  function paintFundsPick(body, v) {
    var bal = B.balances(listExcl());
    var sel = state.data[v.key];
    var fund = function (ep, name, icon) {
      return '<button class="goal-card' + (sel === ep ? ' sel' : '') + '" data-fund="' + ep + '">' +
        '<div class="goal-top"><span class="goal-ico">' + icon + '</span><b>' + esc(name) + '</b></div>' +
        '<div class="goal-nums"><span>' + L('Balance', 'ব্যালেন্স') + '<b>' + money(bal[ep] || 0) + '</b></span></div></button>';
    };
    body.innerHTML =
      fund('floating', L('Floating Fund', 'ফ্লোটিং ফান্ড'), '🛟') +
      fund('emergency', L('Emergency Fund', 'ইমার্জেন্সি ফান্ড'), '🛡️') +
      '<button class="goal-card" data-fund="saving"><div class="goal-top"><span class="goal-ico">🏛️</span>' +
        '<b>' + L('Long-term Savings', 'দীর্ঘমেয়াদি সঞ্চয়') + '</b></div>' +
        '<small>' + L('Choose one of your savings', 'আপনার সঞ্চয় থেকে বাছুন') + '</small></button>' +
      '<button class="ghost wide" data-goalback="1">← ' + L('Back', 'ফিরে যান') + '</button>';

    body.onclick = function (e) {
      if (e.target.closest('[data-goalback]')) return leaveView();
      var f = e.target.closest('[data-fund]');
      if (!f) return;
      var ep = f.getAttribute('data-fund');
      if (ep === 'saving') {
        state.view = { kind: 'savings', key: v.key, parent: v };
        return renderStep();
      }
      state.data[v.key] = ep;
      state.view = null;
      afterPick();
    };
  }

  // The list of savings, with New saving first.
  function paintSavingsPick(body, v) {
    var bal = B.balances(listExcl());
    var sel = state.data[v.key];
    var list = (B.settings.get().savingsList || []).filter(function (s) { return !s.closed; });
    var cards = list.map(function (s) {
      var ep = 'saving:' + s.id;
      return '<button class="goal-card' + (sel === ep ? ' sel' : '') + '" data-saving="' + s.id + '">' +
        '<div class="goal-top"><span class="goal-ico">🏛️</span><b>' + esc(s.name) + '</b></div>' +
        '<div class="goal-nums"><span>' + L('Balance', 'ব্যালেন্স') + '<b>' + money(bal[ep] || 0) + '</b></span></div></button>';
    }).join('');

    body.innerHTML =
      '<button class="action-tile new goal-add" data-newsaving="1"><span class="at-ico">＋</span>' +
        '<b>' + L('New saving', 'নতুন সঞ্চয়') + '</b></button>' +
      (cards || '<p class="meta">' + L('No savings yet. Tap New saving.', 'এখনো কোনো সঞ্চয় নেই। নতুন সঞ্চয় চাপুন।') + '</p>') +
      '<button class="ghost wide" data-goalback="1">← ' + L('Back', 'ফিরে যান') + '</button>';

    body.onclick = function (e) {
      if (e.target.closest('[data-goalback]')) return leaveView();
      if (e.target.closest('[data-newsaving]')) {
        return B.createSaving(function () { renderStep(); });
      }
      var s = e.target.closest('[data-saving]');
      if (!s) return;
      state.data[v.key] = 'saving:' + s.getAttribute('data-saving');
      state.view = null;
      afterPick();
    };
  }


  // Add-new-goal tile first (like New budget), then the active goals.
  function paintGoalPick(body, v) {
    var bal = B.balances(listExcl());
    var selected = state.data[v.key];
    var cards = B.goals.all().map(function (g) {
      var pr = B.goals.progress(g, bal);
      var disabled = v.mode === 'from' && pr.saved <= 0;
      return '<button class="goal-card' + (selected === 'goal:' + g.id ? ' sel' : '') + (disabled ? ' disabled' : '') +
        '" data-goal="' + g.id + '"' + (disabled ? ' disabled' : '') + '>' +
        '<div class="goal-top"><span class="goal-ico">🎯</span><b>' + esc(g.name) + '</b>' +
        '<span class="badge ' + (pr.done ? 'ok' : '') + '">' + pr.pct + '%</span></div>' +
        '<div class="bar"><div class="fill ok" style="width:' + pr.pct + '%"></div></div>' +
        '<div class="goal-nums">' +
          '<span>' + L('Saved', 'জমা') + '<b>' + money(pr.saved) + '</b></span>' +
          '<span>' + L('Remaining', 'বাকি') + '<b>' + money(pr.remaining) + '</b></span>' +
          '<span>' + L('Target', 'লক্ষ্য') + '<b>' + money(g.target) + '</b></span>' +
        '</div>' +
        (disabled ? '<small>' + L('No money yet', 'এখনো টাকা নেই') + '</small>' : '') +
        '</button>';
    }).join('');

    body.innerHTML =
      '<button class="action-tile new goal-add" data-newgoal="1"><span class="at-ico">＋</span>' +
        '<b>' + L('Add new goal', 'নতুন লক্ষ্য যোগ করুন') + '</b>' +
        '<small>' + L('Set a name, target and date', 'নাম, লক্ষ্য ও তারিখ দিন') + '</small></button>' +
      (cards || '<p class="meta">' + L('No goals yet. Tap Add new goal.', 'এখনো কোনো লক্ষ্য নেই। নতুন লক্ষ্য যোগ করুন চাপুন।') + '</p>') +
      '<button class="ghost wide" data-goalback="1">← ' + L('Back', 'ফিরে যান') + '</button>';

    body.onclick = function (e) {
      var el;
      if (e.target.closest('[data-goalback]')) return leaveView();
      if (e.target.closest('[data-newgoal]')) {
        state.view = {
          kind: 'create', key: v.key, mode: v.mode, parent: v,
          d: { name: '', target: '', date: null, showCal: false, err: '' }
        };
        return renderStep();
      }
      if ((el = e.target.closest('[data-goal]'))) {
        state.data[v.key] = 'goal:' + el.getAttribute('data-goal');
        state.view = null;
        return afterPick();
      }
    };
  }

  function paintGoalCreate(body, v) {
    var d = v.d;
    body.innerHTML =
      '<div class="field"><label>' + L('Goal name', 'লক্ষ্যের নাম') + '</label>' +
        '<input id="gc-name" value="' + esc(d.name) + '" placeholder="' + L('e.g. New phone', 'যেমন: নতুন ফোন') + '"></div>' +
      '<div class="field"><label>' + L('Target amount (৳)', 'লক্ষ্যমাত্রা (৳)') + '</label>' +
        '<input id="gc-target" inputmode="decimal" value="' + esc(d.target) + '" placeholder="0"></div>' +
      '<div class="field"><label>' + L('Target date', 'লক্ষ্যের তারিখ') + '</label>' +
        '<button class="date-btn" data-gcdate="1">' +
          (d.date ? B.dates.toDisplay(d.date) : L('Pick a date', 'তারিখ বাছুন')) + '  ▾</button>' +
        '<div id="gc-cal" class="calendar' + (d.showCal ? '' : ' hidden') + '"></div></div>' +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<button class="primary" data-create="1">' + L('Create goal', 'লক্ষ্য তৈরি করুন') + '</button>' +
      '<button class="ghost wide" data-goalback="1">← ' + L('Back', 'ফিরে যান') + '</button>';

    B.datePicker.mount(body.querySelector('#gc-cal'), d.date || B.dates.today(), function (iso) {
      d.date = iso;
      body.querySelector('[data-gcdate]').textContent = B.dates.toDisplay(iso) + '  ▾';
    });

    body.oninput = function (e) {
      if (e.target.id === 'gc-name') d.name = e.target.value;
      if (e.target.id === 'gc-target') d.target = amountOf(e.target);
    };

    body.onclick = function (e) {
      var el;
      if (e.target.closest('[data-goalback]')) {
        state.view = v.parent;
        return renderStep();
      }
      if ((el = e.target.closest('[data-gcdate]'))) {
        d.showCal = !d.showCal;
        body.querySelector('#gc-cal').classList.toggle('hidden', !d.showCal);
        return;
      }
      if (e.target.closest('[data-create]')) {
        if (!d.name.trim()) { d.err = L('Enter a goal name.', 'লক্ষ্যের নাম লিখুন।'); return paintGoalCreate(body, v); }
        var target = B.money.toPaisa(d.target);
        if (target === null) { d.err = L('Enter a target greater than 0.', 'লক্ষ্যমাত্রা ০ এর বেশি লিখুন।'); return paintGoalCreate(body, v); }
        if (!d.date) { d.err = L('Pick a target date.', 'লক্ষ্যের তারিখ বাছুন।'); return paintGoalCreate(body, v); }
        var err = B.goals.add(d.name, target, d.date);
        if (err) { d.err = err; return paintGoalCreate(body, v); }
        var created = B.goals.all().slice(-1)[0];
        state.data[v.key] = 'goal:' + created.id;
        state.view = null;
        return afterPick();
      }
    };
  }

  function afterPick() {
    if (!state) return;
    if (state.mode === 'edit') return renderEdit();
    goTo(state.index + 1);
  }

  // ---- Categories and types ----
  function catChips(selected, attr) {
    var list = B.categories.ordered().map(function (c) { return { name: c, removed: false }; });
    if (selected && list.every(function (c) { return c.name !== selected; })) {
      list.unshift({ name: selected, removed: true });
    }
    var chips = list.map(function (c) {
      return '<button class="chip' + (c.name === selected ? ' sel' : '') + (c.removed ? ' removed' : '') +
        '" ' + attr + '="' + esc(c.name) + '">' + B.categories.icon(c.name) + ' ' + esc(c.name) +
        (c.removed ? ' ' + L('(removed)', '(মুছে ফেলা)') : '') + '</button>';
    }).join('');
    return chips + '<button class="chip manage" data-manage="1">✎ ' + L('Manage', 'ম্যানেজ') + '</button>';
  }

  function typeChips(selected, attr) {
    return Object.keys(B.types).map(function (k) {
      return '<button class="chip' + (k === selected ? ' sel' : '') + '" ' + attr + '="' + k + '">' +
        esc(t('type.' + k)) + '</button>';
    }).join('');
  }

  // ---- Quick entries: the user's 3 most repeated transactions ----
  function quickChip(q, i) {
    return '<button class="quick-chip ' + q.type + '" data-quick="' + i + '">' +
      '<span class="qc-type">' + esc(t('type.' + q.type)) + '</span>' +
      '<b>' + money(q.amount) + '</b>' +
      '<small>' + esc(q.category) + ' · ' + esc(q.account) + (q.note ? ' · ' + esc(q.note) : '') + '</small></button>';
  }

  function goTo(i) {
    state.index = Math.max(0, Math.min(i, state.steps.length - 1));
    renderStep();
  }

  function backPressed() {
    if (state.view) return leaveView();
    goTo(state.index - 1);
  }

  function showMsg(text) {
    var msg = $('s-msg');
    msg.className = 'msg';
    msg.textContent = text;
  }

  function renderStep() {
    if (state.view) return renderGoalView();
    if (state.mode === 'edit') return renderEdit();
    renderWizard();
  }

  // ---------- New transaction ----------

  function renderWizard() {
    var step = state.steps[state.index];
    var total = state.steps.length;
    $('sheet-title').textContent = t('sheet.new');
    $('sheet-progress').innerHTML = state.steps.map(function (s, i) {
      return '<span class="pip' + (i <= state.index ? ' on' : '') + '"></span>';
    }).join('');
    $('sheet-actions').style.display = '';
    $('s-back').textContent = t('btn.back');
    $('s-back').style.visibility = state.index === 0 ? 'hidden' : 'visible';
    if (step === 'quick') $('s-next').textContent = L('Submit', 'জমা দিন');
    else $('s-next').textContent = state.index === total - 1 ? t('btn.save') : t('btn.next');
    $('s-next').style.display = CHOICE[step] ? 'none' : '';
    $('s-quick').style.display = 'none';
    $('s-delete').style.display = 'none';
    $('s-msg').textContent = '';

    var body = $('sheet-body');
    body.onclick = null;
    body.oninput = null;
    body.innerHTML = '';
    STEP_RENDER[step](body);
    body.scrollTop = 0;
  }

  function stepType(body) {
    var top = B.quick.top(3);
    state.quick = top;
    var quick = top.length
      ? '<div class="ed-label">' + L('Your usual', 'আপনার সাধারণ') + '</div>' +
        '<div class="quick-row">' + top.map(quickChip).join('') + '</div>'
      : '';

    body.innerHTML = quick + '<div class="type-grid">' +
      Object.keys(B.types).map(function (k) {
        return '<button class="type-card' + (state.data.type === k ? ' sel' : '') + '" data-type="' + k + '">' +
          '<span class="type-ico">' + ICONS[k] + '</span><span>' + esc(t('type.' + k)) + '</span></button>';
      }).join('') + '</div>';

    body.onclick = function (e) {
      var q = e.target.closest('[data-quick]');
      if (q) {
        var tpl = state.quick[+q.getAttribute('data-quick')];
        state.data = {
          type: tpl.type,
          amountText: B.money.toInput(tpl.amount),
          date: B.dates.today(),
          category: tpl.category,
          account: tpl.account,
          to: null,
          person: '',
          tags: tpl.tags.join(', '),
          note: tpl.note,
          repeat: 'once'
        };
        state.steps = ['quick'];
        state.index = 0;
        return renderStep();
      }
      var b = e.target.closest('[data-type]');
      if (!b) return;
      state.data.type = b.getAttribute('data-type');
      state.steps = stepsFor(state.data.type);
      goTo(1);
    };
  }

  function stepQuick(body) {
    var d = state.data;
    var rows = [
      [L('Type', 'ধরন'), t('type.' + d.type)],
      [L('Amount', 'পরিমাণ'), money(B.money.toPaisa(d.amountText) || 0)],
      [L('Date', 'তারিখ'), B.dates.toDisplay(d.date)],
      [L('Category', 'ক্যাটাগরি'), d.category],
      [L('Account', 'অ্যাকাউন্ট'), d.account],
      [L('Note', 'নোট'), d.note || '-']
    ];
    body.innerHTML = '<p class="step-q">' + L('Check, then submit', 'দেখে নিয়ে জমা দিন') + '</p>' +
      '<div class="summary">' + rows.map(function (r) {
        return '<div class="sum-row"><span>' + r[0] + '</span><strong>' + esc(r[1]) + '</strong></div>';
      }).join('') + '</div>' +
      '<button class="ghost wide" data-change="1">' + L('Change something', 'কিছু বদলান') + '</button>';
    body.onclick = function (e) {
      if (!e.target.closest('[data-change]')) return;
      state.steps = stepsFor(d.type);
      goTo(1);
    };
  }

  function stepAmount(body) {
    body.innerHTML = '<p class="step-q">' + t('sheet.howMuch') + '</p>' +
      '<div class="amount-box"><span class="cur">৳</span>' +
      '<input id="s-amount" inputmode="decimal" autocomplete="off" placeholder="0" value="' + esc(state.data.amountText) + '"></div>';
    var input = $('s-amount');
    input.oninput = function () {
      state.data.amountText = amountOf(input);
    };
  }

  function stepDate(body) {
    body.innerHTML = '<p class="step-q">' + L('When?', 'কবে?') + '</p>' +
      '<div id="date-show" class="date-show">' + B.dates.toDisplay(state.data.date) + '</div>' +
      '<div id="cal" class="calendar"></div>' +
      '<button id="s-today" class="ghost">' + t('btn.today') + '</button>';
    B.datePicker.mount($('cal'), state.data.date, function (iso) {
      state.data.date = iso;
      $('date-show').textContent = B.dates.toDisplay(iso);
    });
    $('s-today').onclick = function () {
      state.data.date = B.dates.today();
      renderStep();
    };
  }

  function stepCategory(body) {
    body.innerHTML = '<p class="step-q">' + t('sheet.whichCat') + '</p><div class="chips">' +
      catChips(state.data.category, 'data-cat') + '</div>';
    body.onclick = function (e) {
      if (e.target.closest('[data-manage]')) {
        return B.openCategoryManager(function () { if (state) renderStep(); });
      }
      var c = e.target.closest('[data-cat]');
      if (!c) return;
      state.data.category = c.getAttribute('data-cat');
      goTo(state.index + 1);
    };
  }

  function endpointStep(body, key, mode, question) {
    var exclude = key === 'to' ? state.data.account : null;
    body.innerHTML = '<p class="step-q">' + question + '</p>' +
      '<div class="acc-list">' + pickerHtml(key, state.data[key], exclude, mode) + '</div>';
    body.onclick = function (e) {
      var f = e.target.closest('[data-funds]');
      if (f) return openFundsPick(f.getAttribute('data-funds'));
      var g = e.target.closest('[data-goal-pick]');
      if (g) return openGoalPick(g.getAttribute('data-goal-pick'), g.getAttribute('data-mode'));
      var b = e.target.closest('[data-ep]');
      if (!b) return;
      state.data[key] = b.getAttribute('data-ep');
      goTo(state.index + 1);
    };
  }

  // For debt paid and loan collected, only people with a running debt or loan are offered.
  function stepPerson(body) {
    var d = state.data;
    var group = REPAY[d.type];
    var names = group
      ? B.debts.list(group).filter(function (p) { return p.remaining > 0; }).map(function (p) { return p.name; })
      : B.debts.persons();
    var chips = names.map(function (name) {
      return '<button class="chip" data-person="' + esc(name) + '">' + esc(name) + '</button>';
    }).join('');
    var empty = group && !names.length ? '<p class="msg">' + noRunningMsg(d.type) + '</p>' : '';

    body.innerHTML = '<p class="step-q">' + t('sheet.who') + '</p>' +
      '<input id="s-person" placeholder="' + L('Name', 'নাম') + '" value="' + esc(d.person) + '">' +
      (chips ? '<div class="chips" style="margin-top:10px">' + chips + '</div>' : '') + empty;

    var input = $('s-person');
    input.oninput = function () { d.person = input.value; };
    body.onclick = function (e) {
      var c = e.target.closest('[data-person]');
      if (!c) return;
      d.person = c.getAttribute('data-person');
      input.value = d.person;
    };
  }

  function repeatChips(current) {
    var opts = [['once', L('Once', 'একবার')], ['day', L('Daily', 'প্রতিদিন')],
      ['week', L('Weekly', 'সাপ্তাহিক')], ['month', L('Monthly', 'মাসিক')]];
    return opts.map(function (o) {
      return '<button class="chip' + (current === o[0] ? ' sel' : '') + '" data-repeat="' + o[0] + '">' + o[1] + '</button>';
    }).join('');
  }

  function stepNote(body) {
    var d = state.data;
    var rows = [
      [L('Type', 'ধরন'), t('type.' + d.type)],
      [L('Amount', 'পরিমাণ'), money(B.money.toPaisa(d.amountText) || 0)],
      [L('Date', 'তারিখ'), B.dates.toDisplay(d.date)]
    ];
    if (d.type === 'transfer') {
      rows.push([L('From', 'কোথা থেকে'), B.endpointLabel(d.account)]);
      rows.push([L('To', 'কোথায়'), B.endpointLabel(d.to)]);
    } else {
      rows.push([L('Account', 'অ্যাকাউন্ট'), d.account]);
      if (d.type === 'income' || d.type === 'expense') rows.push([L('Category', 'ক্যাটাগরি'), d.category]);
    }
    if (isLoan(d.type)) rows.push([L('Person', 'ব্যক্তি'), d.person]);

    var tagSuggestions = B.tags.all().map(function (g) {
      return '<button class="chip" data-tagadd="' + esc(g) + '">#' + esc(g) + '</button>';
    }).join('');

    body.innerHTML = '<p class="step-q">' + t('sheet.noteTags') + '</p>' +
      '<div class="field"><label>' + t('sheet.note') + '</label>' +
        '<input id="s-note" placeholder="' + t('sheet.notePh') + '" value="' + esc(d.note) + '"></div>' +
      '<div class="field"><label>' + t('sheet.tags') + '</label>' +
        '<input id="s-tags" placeholder="' + t('sheet.tagsPh') + '" value="' + esc(d.tags) + '"></div>' +
      (tagSuggestions ? '<div class="chips">' + tagSuggestions + '</div>' : '') +
      '<div class="ed-label">' + L('Repeat', 'পুনরাবৃত্তি') + '</div><div class="chips">' + repeatChips(d.repeat || 'once') + '</div>' +
      '<div class="summary">' + rows.map(function (r) {
        return '<div class="sum-row"><span>' + r[0] + '</span><strong>' + esc(r[1] || '-') + '</strong></div>';
      }).join('') + '</div>';

    $('s-note').oninput = function () { d.note = this.value; };
    $('s-tags').oninput = function () { d.tags = this.value; };
    body.onclick = function (e) {
      var rep = e.target.closest('[data-repeat]');
      if (rep) {
        d.repeat = rep.getAttribute('data-repeat');
        return renderStep();
      }
      var c = e.target.closest('[data-tagadd]');
      if (!c) return;
      var tagsInput = $('s-tags');
      var current = B.parseTags(tagsInput.value);
      var add = c.getAttribute('data-tagadd');
      if (current.indexOf(add) === -1) current.push(add);
      tagsInput.value = current.join(', ');
      d.tags = tagsInput.value;
    };
  }

  var STEP_RENDER = {
    type: stepType,
    quick: stepQuick,
    amount: stepAmount,
    date: stepDate,
    category: stepCategory,
    account: function (b) { endpointStep(b, 'account', 'account', t('sheet.whichAcc')); },
    from: function (b) { endpointStep(b, 'account', 'from', t('sheet.fromWhich')); },
    to: function (b) { endpointStep(b, 'to', 'to', t('sheet.toWhich')); },
    person: stepPerson,
    note: stepNote
  };

  function validate(step) {
    var d = state.data;
    if (step === 'amount' && B.money.toPaisa(d.amountText) === null) return t('sheet.amountInvalid');
    if (step === 'person') {
      if (!d.person.trim()) return t('sheet.personInvalid');
      if (REPAY[d.type] && state.mode === 'new') {
        return overpayMsg(d.type, d.person, B.money.toPaisa(d.amountText) || 0);
      }
    }
    if (step === 'to') {
      if (!d.to) return t('sheet.chooseTo');
      if (d.to === d.account) return t('sheet.sameAccount');
    }
    return null;
  }

  function next() {
    var err = validate(state.steps[state.index]);
    if (err) return showMsg(err);
    if (state.index === state.steps.length - 1) return save();
    goTo(state.index + 1);
  }

  // ---------- Edit transaction (one page) ----------

  function renderEdit() {
    var d = state.data;
    var isTransfer = d.type === 'transfer';
    var isIE = d.type === 'income' || d.type === 'expense';
    var loan = isLoan(d.type);

    $('sheet-title').textContent = t('sheet.edit');
    $('sheet-progress').innerHTML = '';
    $('sheet-actions').style.display = 'none';
    $('s-quick').style.display = '';
    $('s-quick').textContent = t('sheet.save');
    $('s-delete').style.display = '';
    $('s-delete').textContent = t('sheet.trash');
    $('s-msg').textContent = '';

    var catBlock = isIE
      ? '<div class="ed-label">' + t('sheet.category') + '</div><div class="chips">' + catChips(d.category, 'data-ecat') + '</div>'
      : '';

    var accBlock = isTransfer
      ? '<div class="ed-label">' + t('sheet.from') + '</div><div class="acc-list">' +
          pickerHtml('account', d.account, null, 'from') + '</div>' +
        '<div class="ed-label">' + t('sheet.to') + '</div><div class="acc-list">' +
          pickerHtml('to', d.to, d.account, 'to') + '</div>'
      : '<div class="ed-label">' + t('sheet.account') + '</div><div class="acc-list">' +
          pickerHtml('account', d.account, null, 'account') + '</div>';

    var personBlock = loan
      ? '<div class="ed-label">' + t('sheet.person') + '</div><input id="s-person" value="' + esc(d.person) + '">'
      : '';

    var body = $('sheet-body');
    body.onclick = editClick;
    body.oninput = null;
    body.innerHTML =
      '<div class="ed-label">' + t('sheet.type') + '</div><div class="chips">' + typeChips(d.type, 'data-etype') + '</div>' +
      '<div class="ed-label">' + t('sheet.amount') + '</div>' +
      '<div class="amount-box"><span class="cur">৳</span>' +
        '<input id="s-amount" inputmode="decimal" autocomplete="off" value="' + esc(d.amountText) + '"></div>' +
      '<div class="ed-label">' + t('sheet.date') + '</div>' +
      '<button id="date-btn" class="date-btn" data-toggle-cal="1">' + B.dates.toDisplay(d.date) + '  ▾</button>' +
      '<div id="cal" class="calendar' + (state.showCal ? '' : ' hidden') + '"></div>' +
      catBlock + accBlock + personBlock +
      '<div class="ed-label">' + t('sheet.note') + '</div>' +
      '<input id="s-note" value="' + esc(d.note) + '" placeholder="' + t('sheet.notePh') + '">' +
      '<div class="ed-label">' + t('sheet.tags') + '</div>' +
      '<input id="s-tags" value="' + esc(d.tags) + '" placeholder="' + t('sheet.tagsPh') + '">';

    $('s-amount').oninput = function () { d.amountText = amountOf(this); };
    $('s-note').oninput = function () { d.note = this.value; };
    $('s-tags').oninput = function () { d.tags = this.value; };
    if ($('s-person')) $('s-person').oninput = function () { d.person = this.value; };

    B.datePicker.mount($('cal'), d.date, function (iso) {
      d.date = iso;
      $('date-btn').textContent = B.dates.toDisplay(iso) + '  ▾';
    });
  }

  function editClick(e) {
    var d = state.data;
    var el;

    if ((el = e.target.closest('[data-manage]'))) {
      return B.openCategoryManager(function () { if (state) renderEdit(); });
    }
    if ((el = e.target.closest('[data-funds]'))) {
      return openFundsPick(el.getAttribute('data-funds'));
    }
    if ((el = e.target.closest('[data-goal-pick]'))) {
      return openGoalPick(el.getAttribute('data-goal-pick'), el.getAttribute('data-mode'));
    }
    if ((el = e.target.closest('[data-toggle-cal]'))) {
      state.showCal = !state.showCal;
      $('cal').classList.toggle('hidden', !state.showCal);
      return;
    }
    if ((el = e.target.closest('[data-etype]'))) {
      d.type = el.getAttribute('data-etype');
      if (d.type === 'transfer' && !d.to) d.to = otherAccount(d.account);
      return renderEdit();
    }
    if ((el = e.target.closest('[data-ecat]'))) {
      d.category = el.getAttribute('data-ecat');
      return renderEdit();
    }
    if ((el = e.target.closest('[data-ep]'))) {
      d[el.getAttribute('data-key') === 'to' ? 'to' : 'account'] = el.getAttribute('data-ep');
      return renderEdit();
    }
  }

  // ---------- Budget alerts ----------

  function snapshot(keys, monthKey) {
    var out = {};
    keys.forEach(function (k) { out[k] = B.budgets.pctFor(k, monthKey); });
    return out;
  }

  // Alerts appear only when this save pushes a budget across 80% or 100%.
  function crossings(before, after) {
    var alerts = [];
    Object.keys(after).forEach(function (k) {
      var a = after[k], b = before[k];
      if (!a) return;
      var label = k === '__total__' ? L('Total budget', 'মোট বাজেট') : k;
      if (a.pct >= 100 && (!b || b.pct < 100)) {
        alerts.push({ over: true, text: '⛔ ' + label + ' — ' + L('over budget', 'বাজেট ছাড়িয়েছে') });
      } else if (a.pct >= 80 && (!b || b.pct < 80)) {
        alerts.push({ over: false, text: '⚠ ' + label + ' — ' + L('80% used', '৮০% খরচ হয়েছে') });
      }
    });
    return alerts;
  }

  // Popup after a new debt or loan: ask for a date, with Skip.
  function openDuePopup(group, person) {
    B.panel.open(person + ' · ' + L('Date', 'তারিখ'), function (body) {
      var picked = B.dates.today();
      body.innerHTML =
        '<p class="meta">' + L('Set the date this should be paid or collected. You can skip and set it later.',
          'কবে শোধ বা আদায় হবে তা দিন। চাইলে এড়িয়ে পরে দিতে পারেন।') + '</p>' +
        '<div id="due-cal"></div>' +
        '<div class="sheet-actions"><button class="ghost" data-skip="1">' + L('Skip', 'এড়িয়ে যান') + '</button>' +
        '<button class="primary" data-setdue="1">' + L('Set date', 'তারিখ সেট করুন') + '</button></div>';
      B.datePicker.mount(body.querySelector('#due-cal'), picked, function (iso) { picked = iso; });
      body.onclick = function (e) {
        if (e.target.closest('[data-skip]')) return B.panel.close();
        if (e.target.closest('[data-setdue]')) {
          B.debts.setDue(group, person, picked);
          B.panel.close();
          B.refresh();
        }
      };
    });
  }

  // ---------- Save, trash, open, close ----------

  // Money going out of an account must not be more than the account has.
  var OUT_TYPES = { expense: 1, transfer: 1, loan_given: 1, loan_repaid: 1 };

  // Instead of saving, offer a fix: move money in from another account, or add income first.
  function askFunds(acc, have, need) {
    var short = need - have;
    var bal = B.balances(listExcl());
    var best = null;
    B.accounts.ordered().forEach(function (a) {
      if (a.name === acc) return;
      var v = bal[a.name] || 0;
      if (!best || v > best.v) best = { name: a.name, v: v };
    });
    B.panel.open(L('Not enough money', 'টাকা যথেষ্ট নেই'), function (body) {
      body.innerHTML =
        '<p class="meta">' + L('Account', 'অ্যাকাউন্ট') + ': <b>' + B.esc(acc) + '</b></p>' +
        '<div class="item-row"><span>' + L('Balance now', 'এখন আছে') + '</span><b>' + money(have) + '</b></div>' +
        '<div class="item-row"><span>' + L('Needed', 'দরকার') + '</span><b>' + money(need) + '</b></div>' +
        '<div class="item-row"><span>' + L('Short by', 'কম আছে') + '</span><b class="out">' + money(short) + '</b></div>' +
        '<p class="meta">' + L('Choose how to fix it. The expense is not saved yet.',
          'কীভাবে ঠিক করবেন বাছুন। এই খরচ এখনো সেভ হয়নি।') + '</p>' +
        '<div class="sheet-actions" style="flex-direction:column">' +
          '<button class="primary" data-fix="transfer">' + L('Move money into ', 'টাকা সরান ') + B.esc(acc) + '</button>' +
          '<button class="ghost" data-fix="income">' + L('Add income to ', 'আয় যোগ করুন ') + B.esc(acc) + '</button>' +
          '<button class="ghost" data-fix="cancel">' + L('Change amount', 'পরিমাণ বদলান') + '</button>' +
        '</div>';
      body.onclick = function (e) {
        var el = e.target.closest('[data-fix]');
        if (!el) return;
        var k = el.getAttribute('data-fix');
        B.panel.close();
        if (k === 'cancel') return;
        close();
        if (k === 'transfer') B.openTransaction({ type: 'transfer', from: best ? best.name : null, to: acc, amount: short });
        else B.openTransaction({ type: 'income', account: acc, amount: short });
      };
    });
  }

  function save() {
    var d = state.data;
    var amount = B.money.toPaisa(d.amountText);
    if (amount === null) return showMsg(t('sheet.amountInvalid'));
    if (!d.type) return showMsg(t('sheet.chooseType'));

    var isTransfer = d.type === 'transfer';
    var isIE = d.type === 'income' || d.type === 'expense';
    var loan = isLoan(d.type);
    if (isTransfer && !d.to) return showMsg(t('sheet.chooseTo'));
    if (isTransfer && d.to === d.account) return showMsg(t('sheet.sameAccount'));
    if (loan && !(d.person || '').trim()) return showMsg(t('sheet.personInvalid'));
    if (REPAY[d.type] && state.mode === 'new') {
      var over = overpayMsg(d.type, d.person, amount);
      if (over) return showMsg(over);
    }

    // No account can go below 0 by an expense, transfer or loan given/repaid.
    if (OUT_TYPES[d.type] && !isGoal(d.account || 'Cash') && !isBucket(d.account)) {
      var haveNow = B.balances(listExcl())[d.account || 'Cash'] || 0;
      if (amount > haveNow) return askFunds(d.account || 'Cash', haveNow, amount);
    }

        // A Floating or Emergency fund goes back to an account only, and can never go below 0.
    if (isTransfer && isBucket(d.account)) {
      var bucketName = B.endpointLabel(d.account);
      if (isGoal(d.to) || isBucket(d.to)) {
        return showMsg(L(bucketName + ' money goes back to an account only.', bucketName + ' টাকা শুধু অ্যাকাউন্টে ফেরত যায়।'));
      }
      var bucketHave = B.balances(listExcl())[d.account] || 0;
      if (amount > bucketHave) return showMsg(L('Not enough in ' + bucketName + '.', bucketName + '-এ যথেষ্ট টাকা নেই।'));
    }

    // A goal can never go below 0.
    if (isTransfer && isGoal(d.account)) {
      var available = B.balances(listExcl())[d.account] || 0;
      if (amount > available) return showMsg(t('goal.notEnough'));
    }

    // Detect a goal that this save completes.
    var completed = null;
    if (isTransfer && isGoal(d.to)) {
      var goal = B.goals.all().filter(function (g) { return 'goal:' + g.id === d.to; })[0];
      if (goal && goal.target > 0) {
        var before = B.balances(listExcl())[d.to] || 0;
        if (before < goal.target && before + amount >= goal.target) completed = goal.name;
      }
    }

    var monthKey = B.dates.monthKey(d.date);
    var watch = d.type === 'expense' ? [d.category || 'Other', '__total__'] : [];
    var before2 = snapshot(watch, monthKey);

    var now = new Date().toISOString();
    var id = state.editingId || B.uid();
    var old = state.mode === 'edit' ? B.transactions.find(id) : null;
    var tagList = B.parseTags(d.tags);
    var repeat = state.mode === 'new' ? (d.repeat || 'once') : 'once';

    var tx = {
      id: id,
      type: d.type,
      amount: amount,
      date: d.date,
      account: d.account || 'Cash',
      toAccount: isTransfer ? d.to : null,
      category: isIE ? (d.category || 'Other') : 'Other',
      person: loan ? d.person.trim() : null,
      tags: tagList,
      note: (d.note || '').trim(),
      createdAt: old ? old.createdAt : now,
      updatedAt: now
    };
    if (old) tx.editCount = (old.editCount || 0) + 1;

    if (!B.transactions.upsert(tx)) return showMsg('Could not save. Check the error box.');
    B.tags.ensure(tagList);

    if (repeat !== 'once') {
      B.recurring.add({
        type: tx.type, amount: tx.amount, account: tx.account, toAccount: tx.toAccount,
        category: tx.category, person: tx.person, tags: tagList, note: tx.note, every: repeat
      }, tx.date);
    }

    var alerts = crossings(before2, snapshot(watch, monthKey));
    var isNew = state.mode === 'new';
    var group = loan ? (B.isDebtType(d.type) ? 'debt' : 'loan') : null;
    var person = loan ? d.person.trim() : '';
    var askDue = isNew && group && !B.debts.dueOf(group, person);
    var line = money(amount) + ' · ' + t('type.' + d.type) + (isIE ? ' · ' + d.category : '');
    var tone = alerts.some(function (a) { return a.over; }) ? 'over' : (alerts.length ? 'warn' : 'ok');

    close();
    B.refresh();
    B.success(isNew ? L('Saved', 'সেভ হয়েছে') : L('Updated', 'আপডেট হয়েছে'),
      [line].concat(alerts.map(function (a) { return a.text; })), tone);

    if (completed) B.celebrate(completed);
    else if (askDue) openDuePopup(group, person);
  }

  // Always asks first. Then the entry goes to Trash, with Undo for 5 seconds.
  function remove() {
    if (!state || !state.editingId) return;
    if (!window.confirm(t('sheet.confirmTrash'))) return;
    var id = state.editingId;
    B.transactions.remove(id);
    close();
    B.toast(L('Moved to trash.', 'ট্র্যাশে সরানো হয়েছে।'), t('btn.undo'), function () {
      B.transactions.restore(id);
      B.refresh();
    });
    B.refresh();
  }

  function close() {
    document.body.classList.remove('tx-open');
    var wrap = $('sheet-wrap');
    if (wrap) wrap.classList.remove('open');
    state = null;
  }

  // preset (optional): { type, from, to, person }
  function open(tx, preset) {
    build();
    raise();
    document.body.classList.add('tx-open');

    var s = B.settings.get();
    var accounts = B.accounts.ordered();
    var firstName = accounts[0] ? accounts[0].name : 'Cash';
    var preferred = (s.defaultAccount && accounts.some(function (a) { return a.name === s.defaultAccount; }))
      ? s.defaultAccount
      : firstName;
    var p = preset || {};
    var from = p.from || p.account || preferred;

    var data = tx ? {
      type: B.txType(tx),
      amountText: B.money.toInput(tx.amount),
      date: tx.date,
      category: B.txCategory(tx),
      account: B.txAccount(tx),
      to: tx.toAccount || null,
      person: tx.person || '',
      tags: B.txTags(tx).join(', '),
      note: tx.note || '',
      repeat: 'once'
    } : {
      type: p.type || null,
      amountText: p.amount ? B.money.toInput(p.amount) : '',
      date: B.dates.today(),
      category: B.categories.ordered()[0] || 'Other',
      account: from,
      to: p.to || otherAccount(from),
      person: p.person || '',
      tags: '',
      note: '',
      repeat: 'once'
    };

    state = {
      mode: tx ? 'edit' : 'new',
      editingId: tx ? tx.id : null,
      showCal: false,
      quick: [],
      view: null,
      index: 0,
      steps: stepsFor(data.type),
      data: data
    };
    // With a preset type, start at the amount step.
    if (!tx && data.type) state.index = 1;

    $('sheet-wrap').classList.add('open');
    renderStep();
  }

  B.openTransaction = function (preset) { open(null, preset || null); };

  B.editTransaction = function (id) {
    var tx = B.transactions.find(id);
    if (tx) open(tx, null);
  };
})();