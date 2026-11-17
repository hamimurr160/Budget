(function () {
  var B = window.Budget;
  var L = B.L;
  var esc = B.esc;
  var ESSENTIAL_DEFAULT = ['Food', 'Bills', 'Transport', 'Health'];

  // ---- Numbers ----



  // Floating target in paisa: a percentage of average income, or a fixed amount.
 
  // Target settings shared by Floating and Emergency.
  var BUCKET = {
    floating: { title: ['Floating target', 'ফ্লোটিং লক্ষ্য'], months: 2 },
    emergency: { title: ['Emergency target', 'ইমার্জেন্সি লক্ষ্য'], months: 3 }
  };

  function bucketSettings(p) {
    var st = B.settings.get();
    return {
      months: st[p + 'Months'] || BUCKET[p].months,
      reach: st[p + 'Reach'] || 12,
      baseCustom: st[p + 'BaseCustom'] || 0,
      totalCustom: st[p + 'TotalCustom'] || 0
    };
  }

  // Total target in paisa: a custom total, or months × (custom monthly amount or average income).
  function bucketTarget(p) {
    var s = bucketSettings(p);
    if (s.totalCustom > 0) return s.totalCustom;
    var base = s.baseCustom > 0 ? s.baseCustom : suggestedAverage();
    return Math.round(base * s.months);
  }

  function bucketPanel(p) {
    var t = BUCKET[p].title;
    B.panel.open(L(t[0], t[1]), function (body) {
      var s = bucketSettings(p);
      var st = {
        months: s.months,
        reach: s.reach,
        base: s.baseCustom ? B.money.toInput(s.baseCustom) : '',
        total: s.totalCustom ? B.money.toInput(s.totalCustom) : ''
      };
      var MONTH_CHOICES = [1, 2, 3, 4, 6, 9, 12];
      var REACH_CHOICES = [3, 6, 12, 18, 24];

      function readInputs() {
        var m = document.getElementById('bp-mcustom'), b = document.getElementById('bp-base'), tt = document.getElementById('bp-total');
        if (m && m.value.trim()) { var n = parseInt(m.value, 10); if (n >= 1 && n <= 24) st.months = n; }
        if (b) st.base = b.value;
        if (tt) st.total = tt.value;
      }

      function chips(list, cur, key, suffix) {
        return list.map(function (v) {
          return '<button class="chip' + (cur === v ? ' on' : '') + '" data-key="' + key + '" data-val="' + v + '">' +
            v + ' ' + suffix + '</button>';
        }).join('');
      }

      function preview() {
        var bal = B.balances(B.transactions.all())[p] || 0;
        var baseP = B.money.toPaisa(String(st.base).trim()) || suggestedAverage();
        var totalP = B.money.toPaisa(String(st.total).trim());
        var target = totalP > 0 ? totalP : Math.round(baseP * st.months);
        var need = Math.max(0, target - bal);
        return { target: target, per: Math.ceil(need / st.reach) };
      }

      function paint() {
        var pv = preview();
        body.innerHTML =
          '<div class="setup-sec"><div class="setup-h">' + L('How many months of saving', 'কত মাসের খরচ জমাবেন') + '</div>' +
            '<div class="chips">' + chips(MONTH_CHOICES, st.months, 'months', L('mo', 'মাস')) + '</div>' +
            '<input id="bp-mcustom" inputmode="numeric" placeholder="' + L('Other (1 to 24)', 'অন্য (১ থেকে ২৪)') + '"></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('How many months to reach it', 'কত মাসে পৌঁছাবেন') + '</div>' +
            '<div class="chips">' + chips(REACH_CHOICES, st.reach, 'reach', L('mo', 'মাস')) + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Average monthly income', 'গড় মাসিক আয়') + '</div>' +
            '<div class="meta">' + L('Last 3 months: ', 'গত ৩ মাস: ') + B.money.format(suggestedAverage()) + '</div>' +
            '<input id="bp-base" inputmode="decimal" placeholder="' + L('Custom monthly amount (optional)', 'নিজের মাসিক পরিমাণ (ঐচ্ছিক)') + '" value="' + esc(st.base) + '"></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Custom total target', 'নিজের মোট লক্ষ্য') + '</div>' +
            '<input id="bp-total" inputmode="decimal" placeholder="' + L('Leave empty to use months × income', 'খালি রাখলে মাস × আয়') + '" value="' + esc(st.total) + '"></div>' +
          '<div class="setup-sec"><div class="meta">' + L('Target: ', 'লক্ষ্য: ') + B.money.format(pv.target) +
            ' · ' + L('Save ', 'জমান ') + B.money.format(pv.per) + L(' a month', ' প্রতি মাসে') + '</div></div>' +
          '<p class="msg" id="bp-msg"></p>' +
          '<div class="sheet-actions"><button class="primary" data-bp-save="1">' + L('Save', 'সেভ') + '</button></div>';
      }

      paint();

      body.onclick = function (e) {
        var c = e.target.closest('[data-key]');
        if (c) {
          readInputs();
          var k = c.getAttribute('data-key'), v = Number(c.getAttribute('data-val'));
          if (k === 'months') st.months = v;
          if (k === 'reach') st.reach = v;
          return paint();
        }
        if (!e.target.closest('[data-bp-save]')) return;
        readInputs();
        var msg = document.getElementById('bp-msg');
        var base = B.money.toPaisa(String(st.base).trim());
        var total = B.money.toPaisa(String(st.total).trim());
        if (String(st.base).trim() && !(base > 0)) { msg.textContent = L('Enter a valid monthly amount.', 'সঠিক মাসিক পরিমাণ লিখুন।'); return; }
        if (String(st.total).trim() && !(total > 0)) { msg.textContent = L('Enter a valid total.', 'সঠিক মোট লিখুন।'); return; }
        B.settings.set(p + 'Months', st.months);
        B.settings.set(p + 'Reach', st.reach);
        B.settings.set(p + 'BaseCustom', base || 0);
        B.settings.set(p + 'TotalCustom', total || 0);
        B.panel.close();
        B.refresh();
      };
    });
  }

   function floatingTarget() { return bucketTarget('floating'); }

  function essentialList() {
    return B.settings.get().essentialCats || ESSENTIAL_DEFAULT;
  }
  var DEFAULT_REASONS = ['Medical', 'Income loss', 'Urgent repair', 'Other'];
  function reasonList() { return B.settings.get().emergencyReasons || DEFAULT_REASONS; }
  function saveReasons(list) { B.settings.set('emergencyReasons', list); }

  function emergencyMonths() { return B.settings.get().emergencyMonths || 3; }
  function reachMonths() { return B.settings.get().emergencyReach || 12; }

   // Average over the last 3 months that have entries. Empty months are skipped.
  // If there are none yet, the current month is used.
  function monthlyAverage(pick) {
    var list = B.transactions.all();
    var now = B.dates.currentMonthKey();
    var total = 0, months = 0;
    for (var i = 1; i <= 3; i++) {
      var rows = B.inMonth(list, B.dates.shiftMonth(now, -i));
      if (!rows.length) continue;
      total += pick(rows);
      months++;
    }
    if (!months) { total = pick(B.inMonth(list, now)); months = 1; }
    return Math.round(total / months);
  }

  function incomeOf(rows) { return B.summarize(rows).income; }

  function essentialOf(rows) {
    var cats = essentialList();
    return rows.reduce(function (sum, t) {
      return (B.txType(t) === 'expense' && cats.indexOf(B.txCategory(t)) !== -1) ? sum + t.amount : sum;
    }, 0);
  }

  function suggestedAverage() { return monthlyAverage(incomeOf); }
  function essentialAverage() { return monthlyAverage(essentialOf); }


  // ---- History ----

  // Every entry that moved money into or out of one bucket.
    function historyHtml(ref) {
    var rows = B.transactions.all().filter(function (t) {
      return t.account === ref || t.toAccount === ref;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (!rows.length) return '<p class="meta">' + L('No money here yet.', 'এখানে এখনো টাকা নেই।') + '</p>';
    return rows.map(function (t) {
      var into = t.toAccount === ref;
      var other = into ? (t.account || 'Cash') : (t.toAccount || 'Cash');
      var tags = Array.isArray(t.tags) && t.tags.length ? ' · ' + t.tags.join(', ') : '';
      return '<div class="item-row"><div><b>' + (into ? '+ ' : '− ') + B.money.format(t.amount) + '</b>' +
        '<div class="meta">' + B.dates.toDisplay(t.date) + ' · ' +
          (into ? L('From ', 'থেকে ') : L('To ', 'যাবে ')) + esc(B.endpointLabel(other)) + esc(tags) + '</div>' +
        (t.note ? '<div class="meta">' + esc(t.note) + '</div>' : '') +
      '</div></div>';
    }).join('');
  }

  // ---- Floating panel ----

  function floatingTargetPanel() {
    B.panel.open(L('Floating target', 'ফ্লোটিং লক্ষ্য'), function (body) {
      var st = B.settings.get();
      var suggested = Math.round(suggestedAverage() * 0.1);
      body.innerHTML =
        '<p class="meta">' + L('Suggested: 10% of your average income of the last 3 months, which is ',
          'পরামর্শ: গত ৩ মাসের গড় আয়ের ১০%, যা ') + B.money.format(suggested) + '</p>' +
        '<div class="ed-label">' + L('Percentage of average income', 'গড় আয়ের শতাংশ') + '</div>' +
        '<input id="fl-pct" inputmode="decimal" value="' + (st.floatingMode === 'amt' ? '' : (st.floatingPct || 10)) + '">' +
        '<div class="ed-label">' + L('Or a fixed amount (৳)', 'অথবা নির্দিষ্ট পরিমাণ (৳)') + '</div>' +
        '<input id="fl-amt" inputmode="decimal" value="' + (st.floatingMode === 'amt' ? B.money.toInput(st.floatingAmt || 0) : '') + '">' +
        '<div class="sheet-actions"><button class="primary" data-fl-save="1">' + L('Save', 'সেভ') + '</button></div>' +
        '<p class="msg" id="fl-msg"></p>';
      body.onclick = function (e) {
        if (!e.target.closest('[data-fl-save]')) return;
        var amtText = document.getElementById('fl-amt').value.trim();
        var pctText = document.getElementById('fl-pct').value.trim();
        var msg = document.getElementById('fl-msg');
        if (amtText) {
          var amt = B.money.toPaisa(amtText);
          if (!amt || amt <= 0) { msg.textContent = L('Enter an amount greater than 0.', 'শূন্যের বেশি পরিমাণ লিখুন।'); return; }
          B.settings.set('floatingMode', 'amt');
          B.settings.set('floatingAmt', amt);
        } else {
          var pct = parseFloat(pctText);
          if (!(pct > 0 && pct <= 100)) { msg.textContent = L('Enter a percentage between 1 and 100.', '১ থেকে ১০০-এর মধ্যে শতাংশ লিখুন।'); return; }
          B.settings.set('floatingMode', 'pct');
          B.settings.set('floatingPct', pct);
        }
        B.panel.close();
        B.refresh();
      };
    });
  }

  // ---- Emergency panel ----

    function emergencyPanel() {
    B.panel.open(L('Emergency Fund setup', 'ইমার্জেন্সি ফান্ড সেটআপ'), function (body) {
      var st = { months: emergencyMonths(), reach: reachMonths(), cats: essentialList().slice() };
      var all = B.categories.ordered();

      function chips(list, value, key, suffix) {
        return list.map(function (v) {
          return '<button class="chip' + (value === v ? ' on' : '') + '" data-key="' + key + '" data-val="' + v + '">' + v + suffix + '</button>';
        }).join('');
      }

      function paint() {
        body.innerHTML =
          '<div class="setup-sec"><div class="setup-h">' + L('How many months to keep', 'কত মাসের খরচ জমাবেন') + '</div>' +
            '<div class="chips">' + chips([3, 4, 5, 6], st.months, 'months', ' ' + L('mo', 'মাস')) + '</div>' +
            '<input id="em-custom" inputmode="numeric" placeholder="' + L('Other (1 to 24)', 'অন্য (১ থেকে ২৪)') + '"></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Reach it in', 'কত মাসে পৌঁছাবেন') + '</div>' +
            '<div class="chips">' + chips([6, 12, 18, 24], st.reach, 'reach', ' ' + L('mo', 'মাস')) + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Essential categories', 'জরুরি খাত') + '</div>' +
            '<div class="chips">' + all.map(function (c) {
              return '<button class="chip' + (st.cats.indexOf(c) !== -1 ? ' on' : '') + '" data-key="cats" data-val="' + esc(c) + '">' + esc(c) + '</button>';
            }).join('') + '</div></div>' +
          '<p class="msg" id="em-msg"></p>' +
          '<div class="sheet-actions"><button class="primary" data-em-save="1">' + L('Save', 'সেভ') + '</button></div>';
      }

      paint();

      body.onclick = function (e) {
        var c = e.target.closest('[data-key]');
        if (c) {
          var key = c.getAttribute('data-key'), val = c.getAttribute('data-val');
          if (key === 'months') st.months = Number(val);
          if (key === 'reach') st.reach = Number(val);
          if (key === 'cats') {
            var i = st.cats.indexOf(val);
            if (i === -1) st.cats.push(val); else st.cats.splice(i, 1);
          }
          return paint();
        }
        if (!e.target.closest('[data-em-save]')) return;
        var msg = document.getElementById('em-msg');
        var custom = parseInt(document.getElementById('em-custom').value, 10);
        if (!isNaN(custom)) {
          if (custom < 1 || custom > 24) { msg.textContent = L('Enter 1 to 24 months.', '১ থেকে ২৪ মাস লিখুন।'); return; }
          st.months = custom;
        }
        if (!st.cats.length) { msg.textContent = L('Pick at least one category.', 'অন্তত একটি খাত বাছুন।'); return; }
        B.settings.set('emergencyMonths', st.months);
        B.settings.set('emergencyReach', st.reach);
        B.settings.set('essentialCats', st.cats);
        B.panel.close();
        B.refresh();
      };
    });
  }

  // ---- Sections ----

    // A bucket card in the same style as the goal cards on the Plan page.
  function bucketCard(o) {
    return '<div class="card goal-plan"' + (o.attr ? ' ' + o.attr : '') + '>' +
      '<div class="bud-row">' + B.ring(o.pct, 'ok', 76) +
        '<div class="bud-info">' +
          '<div class="bud-title">' + o.icon + ' ' + esc(o.title) + '</div>' +
          '<div class="meta">' + o.subtitle + '</div>' +
        '</div></div>' +
      '<div class="goal-nums big-nums">' +
        o.stats.map(function (s) { return '<span>' + s[0] + '<b>' + s[1] + '</b></span>'; }).join('') +
      '</div>' +
      (o.note ? o.note : '') +
      '<div class="btn-row" style="margin-top:10px">' + o.buttons + '</div>' +
    '</div>';
  }

     function typeName(t) {
    var type = B.txType(t);
    var map = { transfer: L('Transfer', 'ট্রান্সফার'), expense: L('Expense', 'খরচ'), income: L('Income', 'আয়') };
    return map[type] || type;
  }

  // Excel-style list: date, type, amount, from → to, edit and delete. Newest first.
  function ledgerTable(ref) {
    var rows = B.transactions.all().filter(function (t) {
      return t.account === ref || t.toAccount === ref;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (!rows.length) return '<p class="meta">' + L('No entries yet.', 'এখনো কোনো লেনদেন নেই।') + '</p>';
    var body = rows.map(function (t) {
      var into = t.toAccount === ref;
      var other = into ? (t.account || 'Cash') : (t.toAccount || 'Cash');
      var cat = t.category && t.category !== 'Other' ? ' · ' + t.category : '';
      var tags = Array.isArray(t.tags) && t.tags.length ? ' · ' + t.tags.join(', ') : '';
      return '<tr>' +
        '<td class="nw">' + B.dates.toDisplay(t.date) + '</td>' +
        '<td class="nw">' + esc(typeName(t)) + '</td>' +
        '<td class="num nw ' + (into ? 'in' : 'out') + '">' + (into ? '+ ' : '− ') + B.money.format(t.amount) + '</td>' +
        '<td class="wrap">' + (into ? L('From ', 'থেকে ') : L('To ', 'যাবে ')) + esc(B.endpointLabel(other)) +
          esc(cat + tags) + (t.note ? '<div class="meta">' + esc(t.note) + '</div>' : '') + '</td>' +
        '<td class="nw act">' +
          '<button class="mini" data-edit-tx="' + t.id + '">' + L('Edit', 'সম্পাদনা') + '</button> ' +
          '<button class="mini danger" data-del-tx="' + t.id + '">' + L('Delete', 'মুছুন') + '</button>' +
        '</td></tr>';
    }).join('');
    return '<div class="xl-wrap"><table class="xl ledger"><thead><tr>' +
      '<th class="nw">' + L('Date', 'তারিখ') + '</th>' +
      '<th class="nw">' + L('Type', 'ধরন') + '</th>' +
      '<th class="num nw">' + L('Amount', 'পরিমাণ') + '</th>' +
      '<th class="wrap">' + L('From → To', 'থেকে → যাবে') + '</th>' +
      '<th class="nw"></th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function historyCard(ref, title) {
    return '<div class="card"><h2>' + title + '</h2>' + ledgerTable(ref) + '</div>';
  }

  function floatingSection() {
    var bal = B.balances(B.transactions.all())['floating'] || 0;
    var target = floatingTarget();
    var pct = target > 0 ? Math.min(100, Math.round(bal / target * 100)) : 0;
    var more = Math.max(0, target - bal);
 
    
   return bucketCard({
      
      pct: pct,
      icon: '🛟',
      title: L('Floating Fund', 'ফ্লোটিং ফান্ড'),
      subtitle: L('Guilt-free safety net. Not in Safe-to-Spend.', 'নিশ্চিন্ত সুরক্ষা। সেফ-টু-স্পেন্ডে নেই।'),
      stats: [
        [L('Balance', 'ব্যালেন্স'), B.money.format(bal)],
        [L('Target', 'লক্ষ্য'), B.money.format(target)],
        [L('To go', 'বাকি'), B.money.format(more)]
      ],
      note: '',
      buttons: '<button class="mini primary-mini" data-fl-add="1">' + L('Add money', 'টাকা জমান') + '</button>' +
        '<button class="mini" data-fl-take="1"' + (bal <= 0 ? ' disabled' : '') + '>' + L('Take out', 'টাকা তুলুন') + '</button>' +
        '<button class="mini" data-fl-target="1">' + L('Set target', 'লক্ষ্য ঠিক করুন') + '</button>'
    }) + historyCard('floating', L('Floating history', 'ফ্লোটিং ইতিহাস'));
  }

      function emergencySection() {
    var list = B.transactions.all();
    var bal = B.balances(list)['emergency'] || 0;
    var months = bucketSettings('emergency').months;
    var target = bucketTarget('emergency');
    var pct = target > 0 ? Math.min(100, Math.round(bal / target * 100)) : 0;
    var need = Math.max(0, target - bal);
    var n = reachMonths();
    var perMonth = Math.ceil(need / n);
    var withdrew = list.some(function (t) { return t.account === 'emergency'; });

    var note;
    if (target === 0) {
      note = '<div class="meta">' + L('Your target appears after you have essential spending in the last 3 months.',
        'গত ৩ মাসে জরুরি খরচ হলে লক্ষ্য দেখা যাবে।') + '</div>';
    } else if (withdrew && need > 0) {
      note = '<div class="rebuild-note"><b>' + L('Rebuilding your safety net', 'আপনার সুরক্ষা আবার গড়ে তোলা হচ্ছে') + '</b>' +
        '<div class="meta">' + L('Still ' + B.money.format(need) + ' to go. One step at a time.',
          'আরও ' + B.money.format(need) + ' বাকি। ধীরে ধীরে এগোন।') + '</div></div>';
    } else if (need > 0) {
      note = '<div class="meta">' + L('To reach it in ' + n + ' months, save ' + B.money.format(perMonth) + ' a month.',
        n + ' মাসে পৌঁছাতে প্রতি মাসে ' + B.money.format(perMonth) + ' জমান।') + '</div>';
    } else {
      note = '<div class="meta">' + L('Target reached.', 'লক্ষ্য পূরণ হয়েছে।') + '</div>';
    }

    return bucketCard({
      pct: pct,
      icon: '🛡️',
      title: L('Emergency Fund', 'ইমার্জেন্সি ফান্ড'),
            subtitle: L('Target: ' + months + ' months of average income. Not in Safe-to-Spend.',
        months + ' মাসের গড় আয়। সেফ-টু-স্পেন্ডে নেই।'),

     stats: [
        [L('Balance', 'ব্যালেন্স'), B.money.format(bal)],
        [L('Target', 'লক্ষ্য'), B.money.format(target)],
        [L('To go', 'বাকি'), B.money.format(need)]
      ],
      note: note,
      buttons: '<button class="mini primary-mini" data-em-add="1">' + L('Add money', 'টাকা জমান') + '</button>' +
        '<button class="mini" data-em-take="1"' + (bal <= 0 ? ' disabled' : '') + '>' + L('Take out', 'টাকা তুলুন') + '</button>' +
        '<button class="mini" data-em-manage="1">' + L('Reasons & categories', 'কারণ ও খাত') + '</button>' +
        '<button class="mini" data-em-target="1">' + L('Set target', 'লক্ষ্য ঠিক করুন')+ '</button>'
    }) + historyCard('emergency', L('Emergency history', 'ইমার্জেন্সি ইতিহাস'));
  }

  // ---- Withdrawal from the Emergency Fund ----

  var REASONS = [
    { key: 'medical', en: 'Medical', bn: 'চিকিৎসা', cat: 'Health' },
    { key: 'income', en: 'Income loss', bn: 'আয় বন্ধ', cat: 'Other' },
    { key: 'repair', en: 'Urgent repair', bn: 'জরুরি মেরামত', cat: 'Bills' },
    { key: 'other', en: 'Other', bn: 'অন্যান্য', cat: 'Other' }
  ];

  function newId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function withdrawPanel() {
    B.panel.open(L('Take out from Emergency', 'ইমার্জেন্সি থেকে টাকা তুলুন'), function (body) {
      var wallets = B.accounts.ordered().map(function (a) { return a.name; });
      var cats = essentialList();
      var reasons = reasonList();
      var st = { amount: '', reason: reasons[0], cat: cats[0] || 'Other', acc: wallets[0], note: '' };

      function readInputs() {
        var a = document.getElementById('wd-amt'), n = document.getElementById('wd-note');
        if (a) st.amount = a.value;
        if (n) st.note = n.value;
      }

      function chips(list, cur, key) {
        return list.map(function (v) {
          return '<button class="chip' + (cur === v ? ' on' : '') + '" data-key="' + key +
            '" data-val="' + esc(v) + '">' + esc(v) + '</button>';
        }).join('');
      }

      function paint() {
        var have = B.balances(B.transactions.all())['emergency'] || 0;
        body.innerHTML =
          '<div class="setup-sec"><div class="setup-h">' + L('Amount (৳)', 'পরিমাণ (৳)') + '</div>' +
            '<input id="wd-amt" inputmode="decimal" placeholder="0" value="' + esc(st.amount) + '">' +
            '<div class="meta">' + L('Available: ', 'আছে: ') + B.money.format(have) + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Reason', 'কারণ') + '</div>' +
            '<div class="chips">' + chips(reasons, st.reason, 'reason') + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Expense category', 'খরচের খাত') + '</div>' +
            '<div class="chips">' + chips(cats, st.cat, 'cat') + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Pay into', 'কোথায় যাবে') + '</div>' +
            '<div class="chips">' + chips(wallets, st.acc, 'acc') + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Note (optional)', 'নোট (ঐচ্ছিক)') + '</div>' +
            '<input id="wd-note" placeholder="' + L('e.g. hospital bill', 'যেমন: হাসপাতালের বিল') + '" value="' + esc(st.note) + '"></div>' +
          '<p class="msg" id="wd-msg"></p>' +
          '<div class="sheet-actions"><button class="primary" data-wd-save="1">' + L('Withdraw', 'তুলুন') + '</button></div>';
      }

      paint();

      body.onclick = function (e) {
        var c = e.target.closest('[data-key]');
        if (c) {
          readInputs();
          var key = c.getAttribute('data-key'), val = c.getAttribute('data-val');
          if (key === 'reason') st.reason = val;
          if (key === 'cat') st.cat = val;
          if (key === 'acc') st.acc = val;
          return paint();
        }
        if (!e.target.closest('[data-wd-save]')) return;
        readInputs();

        var msg = document.getElementById('wd-msg');
        var amount = B.money.toPaisa(String(st.amount).trim());
        var have = B.balances(B.transactions.all())['emergency'] || 0;
        if (!amount || amount <= 0) { msg.textContent = L('Enter an amount greater than 0.', 'শূন্যের বেশি পরিমাণ লিখুন।'); return; }
        if (amount > have) { msg.textContent = L('Only ' + B.money.format(have) + ' is in the Emergency Fund.',
          'ইমার্জেন্সি ফান্ডে আছে ' + B.money.format(have) + '।'); return; }

        var date = B.dates.today();
        var now = new Date().toISOString();
        var move = { id: newId(), type: 'transfer', amount: amount, date: date,
          account: 'emergency', toAccount: st.acc, category: 'Other', person: null,
          tags: ['emergency', st.reason],
          note: L('Emergency: ', 'ইমার্জেন্সি: ') + st.reason,
          createdAt: now, updatedAt: now };
        var spend = { id: newId(), type: 'expense', amount: amount, date: date,
          account: st.acc, toAccount: null, category: st.cat, person: null,
          tags: ['emergency', st.reason],
          note: st.note.trim() || st.reason,
          createdAt: now, updatedAt: now };

        if (!B.transactions.upsert(move)) { msg.textContent = L('Could not save the withdrawal.', 'তুলতে পারেনি। আবার চেষ্টা করুন।'); return; }
        if (!B.transactions.upsert(spend)) {
          msg.textContent = L('The withdrawal saved, but the expense did not. Please tell me.',
            'তোলা হয়েছে, কিন্তু খরচ সেভ হয়নি। আমাকে জানান।');
          return;
        }
        B.panel.close();
        B.refresh();
      };
    });
  }


  // ---- Ledger buttons and per-saving history ----

  // Edit and Delete for any ledger row. Returns true when it handled the tap.
  function ledgerClick(e) {
    var del = e.target.closest('[data-del-tx]');
    if (del) {
      var id = del.getAttribute('data-del-tx');
      if (!window.confirm(L('Move this entry to Trash?', 'এই লেনদেনটি ট্র্যাশে সরাবেন?'))) return true;
      B.transactions.remove(id);
      B.toast(L('Moved to trash.', 'ট্র্যাশে সরানো হয়েছে।'), L('Undo', 'ফেরান'), function () {
        B.transactions.restore(id);
        B.refresh();
      });
      B.panel.close();
      B.refresh();
      return true;
    }
    var ed = e.target.closest('[data-edit-tx]');
    if (ed) { B.editTransaction(ed.getAttribute('data-edit-tx')); return true; }
    return false;
  }

  // One saving's history, in its own panel with the full width.
  function savingHistory(id) {
    var sv = savingsAll().filter(function (s) { return s.id === id; })[0];
    if (!sv) return;
    B.panel.open(sv.name + ' · ' + L('History', 'ইতিহাস'), function (body) {
      body.innerHTML = ledgerTable('saving:' + id);
      body.onclick = function (e) { ledgerClick(e); };
    });
  }

  // Called by the transaction screen: create a saving, then return its id.
  B.createSaving = function (done) { savingPanel(null, done); };


  // ---- Reasons and essential categories ----

  function manageEmergencyPanel() {
    B.panel.open(L('Reasons and categories', 'কারণ ও খাত'), function (body) {
      var st = { reasons: reasonList().slice(), cats: essentialList().slice() };
      var all = B.categories.ordered();

      // Keep what the user has typed in the reason boxes before the panel redraws.
      function readRows() {
        st.reasons = st.reasons.map(function (r, i) {
          var el = body.querySelector('[data-rname="' + i + '"]');
          return el ? el.value.trim() : r;
        });
      }

      function paint(msg) {
        body.innerHTML =
          '<div class="setup-sec"><div class="setup-h">' + L('Withdrawal reasons', 'তোলার কারণ') + '</div>' +
            st.reasons.map(function (r, i) {
              return '<div class="rs-row"><input data-rname="' + i + '" value="' + esc(r) + '">' +
                '<button class="mini" data-rdel="' + i + '">' + L('Delete', 'মুছুন') + '</button></div>';
            }).join('') +
            '<div class="rs-row"><input id="r-new" placeholder="' + L('New reason', 'নতুন কারণ') + '">' +
              '<button class="mini primary-mini" data-radd="1">' + L('Add', 'যোগ') + '</button></div>' +
          '</div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Essential categories', 'জরুরি খাত') + '</div>' +
            '<div class="chips">' + all.map(function (c) {
              return '<button class="chip' + (st.cats.indexOf(c) !== -1 ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
            }).join('') + '</div>' +
            '<button class="ghost wide" data-catmgr="1">' +
              L('Add, rename or delete categories', 'খাত যোগ, নাম বদল বা মুছুন') + '</button>' +
          '</div>' +
          '<p class="msg">' + esc(msg || '') + '</p>' +
          '<div class="sheet-actions"><button class="primary" data-rsave-all="1">' + L('Save', 'সেভ') + '</button></div>';
      }

      paint();

      body.onclick = function (e) {
        var t;
        if ((t = e.target.closest('[data-cat]'))) {
          readRows();
          var c = t.getAttribute('data-cat'), i = st.cats.indexOf(c);
          if (i === -1) st.cats.push(c); else st.cats.splice(i, 1);
          return paint();
        }
        if ((t = e.target.closest('[data-rdel]'))) {
          readRows();
          if (st.reasons.length <= 1) return paint(L('Keep at least one reason.', 'অন্তত একটি কারণ রাখুন।'));
          st.reasons.splice(Number(t.getAttribute('data-rdel')), 1);
          return paint();
        }
        if (e.target.closest('[data-radd]')) {
          readRows();
          var nv = document.getElementById('r-new').value.trim();
          if (!nv) return paint(L('Type a reason first.', 'আগে একটি কারণ লিখুন।'));
          if (st.reasons.indexOf(nv) !== -1) return paint(L('That reason already exists.', 'এই কারণটি আগেই আছে।'));
          st.reasons.push(nv);
          return paint();
        }
        if (e.target.closest('[data-catmgr]')) {
          readRows();
          return B.openCategoryManager(function () {});
        }
        if (e.target.closest('[data-rsave-all]')) {
          readRows();
          var clean = st.reasons.filter(Boolean);
          if (!clean.length) return paint(L('Keep at least one reason.', 'অন্তত একটি কারণ রাখুন।'));
          if (!st.cats.length) return paint(L('Pick at least one category.', 'অন্তত একটি খাত বাছুন।'));
          saveReasons(clean);
          B.settings.set('essentialCats', st.cats);
          B.panel.close();
          B.refresh();
        }
      };
    });
  }

  // ---- Page ----

    // Which card is showing. Each time the page is opened, it starts on Floating.
  var tab = 'floating';

  function tabBar() {
    var items = [
      ['floating', L('Floating', 'ফ্লোটিং')],
      ['emergency', L('Emergency', 'ইমার্জেন্সি')],
      ['saving', L('Saving', 'সঞ্চয়')]
    ];
    return '<div class="seg">' + items.map(function (i) {
      return '<button class="seg-btn' + (tab === i[0] ? ' on' : '') + '" data-tab="' + i[0] + '">' + i[1] + '</button>';
    }).join('') + '</div>';
  }

    // ---- Long-term savings ----

  var SAVING_TYPES = [
    { key: 'land', en: 'Land', bn: 'জমি' },
    { key: 'dps', en: 'DPS', bn: 'ডিপিএস' },
    { key: 'fdr', en: 'FDR', bn: 'এফডিআর' },
    { key: 'other', en: 'Other', bn: 'অন্যান্য' }
  ];

  function savingsAll() { return B.settings.get().savingsList || []; }
  function saveSavings(list) { B.settings.set('savingsList', list); }

  // Whole months from today to a date. Returns 0 if the date has passed.
  function monthsUntil(iso) {
    var end = new Date(iso + 'T00:00:00');
    var now = new Date(B.dates.today() + 'T00:00:00');
    if (end <= now) return 0;
    return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  }

    function savingPanel(id, done) {
    var existing = id ? savingsAll().filter(function (s) { return s.id === id; })[0] : null;
    B.panel.open(existing ? L('Edit saving', 'সঞ্চয় সম্পাদনা') : L('New saving', 'নতুন সঞ্চয়'), function (body) {
      var st = existing ? {
        name: existing.name, type: existing.type,
        target: existing.target ? B.money.toInput(existing.target) : '',
        date: existing.date || '', rate: existing.rate || ''
      } : { name: '', type: 'land', target: '', date: '', rate: '' };

      function readInputs() {
        var n = document.getElementById('sv-name'), tg = document.getElementById('sv-target'),
          d = document.getElementById('sv-date'), r = document.getElementById('sv-rate');
        if (n) st.name = n.value;
        if (tg) st.target = tg.value;
        if (d) st.date = d.value;
        if (r) st.rate = r.value;
      }

      function paint() {
        body.innerHTML =
          '<div class="setup-sec"><div class="setup-h">' + L('Name', 'নাম') + '</div>' +
            '<input id="sv-name" placeholder="' + L('e.g. Plot at Savar', 'যেমন: সাভারের প্লট') + '" value="' + esc(st.name) + '"></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Type', 'ধরন') + '</div><div class="chips">' +
            SAVING_TYPES.map(function (k) {
              return '<button class="chip' + (st.type === k.key ? ' on' : '') + '" data-type="' + k.key + '">' + L(k.en, k.bn) + '</button>';
            }).join('') + '</div></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Target amount (optional)', 'লক্ষ্য (ঐচ্ছিক)') + '</div>' +
            '<input id="sv-target" inputmode="decimal" placeholder="0" value="' + esc(st.target) + '"></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Maturity or goal date (optional)', 'মেয়াদ বা তারিখ (ঐচ্ছিক)') + '</div>' +
            '<input id="sv-date" type="date" value="' + esc(st.date) + '"></div>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Interest rate (optional, for info)', 'সুদের হার (ঐচ্ছিক, শুধু তথ্যের জন্য)') + '</div>' +
            '<input id="sv-rate" placeholder="' + L('e.g. 8% a year', 'যেমন: বছরে ৮%') + '" value="' + esc(st.rate) + '"></div>' +
          '<p class="msg" id="sv-msg"></p>' +
          '<div class="sheet-actions"><button class="primary" data-sv-save="1">' + L('Save', 'সেভ') + '</button></div>';
      }

      paint();

      body.onclick = function (e) {
        var ty = e.target.closest('[data-type]');
        if (ty) { readInputs(); st.type = ty.getAttribute('data-type'); return paint(); }
        if (!e.target.closest('[data-sv-save]')) return;
        readInputs();
        var msg = document.getElementById('sv-msg');
        if (!st.name.trim()) { msg.textContent = L('Enter a name.', 'একটি নাম লিখুন।'); return; }
        var target = B.money.toPaisa(String(st.target).trim()) || 0;
        if (String(st.target).trim() && !(target > 0)) { msg.textContent = L('Enter a valid target.', 'সঠিক লক্ষ্য লিখুন।'); return; }
        var item = { id: existing ? existing.id : newId(), name: st.name.trim(), type: st.type,
          target: target, date: st.date || null, rate: st.rate.trim(), closed: false };
        var list = existing
          ? savingsAll().map(function (s) { return s.id === existing.id ? Object.assign({}, s, item) : s; })
          : savingsAll().concat([item]);
        saveSavings(list);
        B.panel.close();
        B.refresh();
        if (done) done(item.id);
      };
    });
  }

    // ---- Long-term savings ----

  var SAVING_TYPES = [
    { key: 'land', en: 'Land', bn: 'জমি' },
    { key: 'dps', en: 'DPS', bn: 'ডিপিএস' },
    { key: 'fdr', en: 'FDR', bn: 'এফডিআর' },
    { key: 'other', en: 'Other', bn: 'অন্যান্য' }
  ];

  function savingsAll() { return B.settings.get().savingsList || []; }
  function saveSavings(list) { B.settings.set('savingsList', list); }

  // Whole months from today to a date. Returns 0 if the date has passed.
  function monthsUntil(iso) {
    var end = new Date(iso + 'T00:00:00');
    var now = new Date(B.dates.today() + 'T00:00:00');
    if (end <= now) return 0;
    return (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  }

  // Counts as income and adds to this saving.
  function recordInterest(id) {
    B.panel.open(L('Record interest', 'সুদ লিখুন'), function (body) {
      body.innerHTML =
        '<div class="setup-sec"><div class="setup-h">' + L('Interest amount (৳)', 'সুদের পরিমাণ (৳)') + '</div>' +
          '<input id="int-amt" inputmode="decimal" placeholder="0"></div>' +
        '<p class="meta">' + L('This is counted as income and added to this saving.',
          'এটি আয় হিসেবে গণ্য হবে এবং এই সঞ্চয়ে যোগ হবে।') + '</p>' +
        '<p class="msg" id="int-msg"></p>' +
        '<div class="sheet-actions"><button class="primary" data-int-save="1">' + L('Save', 'সেভ') + '</button></div>';

      body.onclick = function (e) {
        if (!e.target.closest('[data-int-save]')) return;
        var msg = document.getElementById('int-msg');
        var amount = B.money.toPaisa(document.getElementById('int-amt').value.trim());
        if (!amount || amount <= 0) { msg.textContent = L('Enter an amount greater than 0.', 'শূন্যের বেশি পরিমাণ লিখুন।'); return; }
        var now = new Date().toISOString();
        var ok = B.transactions.upsert({ id: newId(), type: 'income', amount: amount, date: B.dates.today(),
          account: 'saving:' + id, toAccount: null, category: 'Other', person: null, tags: ['interest'],
          note: L('Interest', 'সুদ'), createdAt: now, updatedAt: now });
        if (!ok) { msg.textContent = L('Could not save. Try again.', 'সেভ হয়নি। আবার চেষ্টা করুন।'); return; }
        B.panel.close();
        B.refresh();
      };
    });
  }

  // Moves the full balance to an account, then marks the saving closed.
  function closeSavingPanel(id) {
    var sv = savingsAll().filter(function (s) { return s.id === id; })[0];
    if (!sv) return;
    B.panel.open(L('Close saving', 'সঞ্চয় বন্ধ'), function (body) {
      var bal = B.balances(B.transactions.all())['saving:' + id] || 0;
      var wallets = B.accounts.ordered().map(function (a) { return a.name; });
      var st = { acc: wallets[0] };

      function paint() {
        body.innerHTML =
          '<p class="meta">' + esc(sv.name) + ' · ' + L('Balance ', 'ব্যালেন্স ') + B.money.format(bal) + '</p>' +
          '<div class="setup-sec"><div class="setup-h">' + L('Move the balance to', 'ব্যালেন্স কোথায় যাবে') + '</div>' +
            '<div class="chips">' + wallets.map(function (w) {
              return '<button class="chip' + (st.acc === w ? ' on' : '') + '" data-acc="' + esc(w) + '">' + esc(w) + '</button>';
            }).join('') + '</div></div>' +
          '<p class="msg" id="cl-msg"></p>' +
          '<p class="meta">' + L('The saving moves to Closed. It is removed 30 days later, once it has no money left.',
  'সঞ্চয়টি বন্ধ তালিকায় যাবে। টাকা না থাকলে ৩০ দিন পর মুছে যাবে।') + '</p>' +
'<button class="close-saving-btn" data-cl-save="1">' + L('Close saving', 'সঞ্চয় বন্ধ করুন') + '</button>';
      }

      paint();

      body.onclick = function (e) {
        var c = e.target.closest('[data-acc]');
        if (c) { st.acc = c.getAttribute('data-acc'); return paint(); }
        if (!e.target.closest('[data-cl-save]')) return;
        var now = new Date().toISOString();
        if (bal > 0) {
          var ok = B.transactions.upsert({ id: newId(), type: 'transfer', amount: bal, date: B.dates.today(),
            account: 'saving:' + id, toAccount: st.acc, category: 'Other', person: null, tags: ['saving-closed'],
            note: L('Saving closed: ', 'সঞ্চয় বন্ধ: ') + sv.name, createdAt: now, updatedAt: now });
          if (!ok) { document.getElementById('cl-msg').textContent = L('Could not save. Try again.', 'সেভ হয়নি। আবার চেষ্টা করুন।'); return; }
        }
        saveSavings(savingsAll().map(function (s) {
          return s.id === id ? Object.assign({}, s, { closed: true, closedAt: B.dates.today() }) : s;
        }));
        B.panel.close();
        B.refresh();
      };
    });
  }

  function savingCard(s) {
    var ref = 'saving:' + s.id;
    var bal = B.balances(B.transactions.all())[ref] || 0;
    var type = SAVING_TYPES.filter(function (k) { return k.key === s.type; })[0] || SAVING_TYPES[3];
    var pct = s.target > 0 ? Math.min(100, Math.round(bal / s.target * 100)) : 0;
    var stats = [[L('Balance', 'ব্যালেন্স'), B.money.format(bal)]];
    if (s.target > 0) {
      stats.push([L('Target', 'লক্ষ্য'), B.money.format(s.target)]);
      stats.push([L('To go', 'বাকি'), B.money.format(Math.max(0, s.target - bal))]);
    }
    var subtitle = L(type.en, type.bn) + (s.rate ? ' · ' + esc(s.rate) : '') +
      (s.date ? ' · ' + B.dates.toDisplay(s.date) : '');
    var note = '';
    if (s.date) {
      var m = monthsUntil(s.date);
      note = '<div class="meta">' + (m > 0 ? L(m + ' months to go', m + ' মাস বাকি') : L('Matured', 'মেয়াদ শেষ')) + '</div>';
    }
       if (s.target > 0 && bal >= s.target) {
      note = '<div class="congrats">🎉 ' + L('Congratulations! You reached your target.',
        'অভিনন্দন! আপনি লক্ষ্য পূরণ করেছেন।') + '</div>' + note;
    }
    return bucketCard({
      attr: 'data-sv-history="' + s.id + '" role="button"',
      pct: pct, icon: '🏛️', title: s.name, subtitle: subtitle, stats: stats, note: note,
      buttons: '<button class="mini primary-mini" data-sv-add="' + s.id + '">' + L('Add money', 'টাকা জমান') + '</button>' +
        '<button class="mini" data-sv-take="' + s.id + '"' + (bal <= 0 ? ' disabled' : '') + '>' + L('Take out', 'টাকা তুলুন') + '</button>' +
        '<button class="mini" data-sv-interest="' + s.id + '">' + L('Record interest', 'সুদ লিখুন') + '</button>' +

 '<button class="mini" data-sv-edit="' + s.id + '">' + L('Edit', 'সম্পাদনা') + '</button>' +
        '<button class="mini" data-sv-close="' + s.id + '">' + L('Close', 'বন্ধ') + '</button>'
    });
  }

    // Days from one date to another (YYYY-MM-DD).
  function daysBetween(a, b) {
    return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }

  // Keeps the list tidy:
  // - a saving that reaches its target gets a completion date;
  // - 7 days after completion it moves to Closed;
  // - a closed saving with no money left is removed 30 days after it was closed.
  function maintainSavings() {
    var today = B.dates.today();
    var bals = B.balances(B.transactions.all());
    var changed = false;
    var list = savingsAll().map(function (s) {
      var bal = bals['saving:' + s.id] || 0;
      if (!s.closed && s.target > 0 && bal >= s.target && !s.completedAt) {
        changed = true;
        return Object.assign({}, s, { completedAt: today });
      }
      if (!s.closed && s.completedAt && (bals['saving:' + s.id] || 0) <= 0 && daysBetween(s.completedAt, today) >= 7) {
        changed = true;
        return Object.assign({}, s, { closed: true, closedAt: today });
      }
      return s;
    }).filter(function (s) {
      var bal = bals['saving:' + s.id] || 0;
      var oldClosed = s.closed && s.closedAt && daysBetween(s.closedAt, today) >= 30;
      if (oldClosed && bal <= 0) { changed = true; return false; }
      return true;
    });
    if (changed) saveSavings(list);
  }

    // Removes a saving from the list. Its past entries stay in History.
  function deleteSaving(id) {
    saveSavings(savingsAll().filter(function (s) { return s.id !== id; }));
  }

  function savingSection() {
    maintainSavings();
    var list = savingsAll();
    var open = list.filter(function (s) { return !s.closed; });
    var closed = list.filter(function (s) { return s.closed; });
    var bals = B.balances(B.transactions.all());
    var html = '<button class="new-saving" data-sv-new="1">＋ ' + L('New saving', 'নতুন সঞ্চয়') + '</button>';
    if (!list.length) {
      return html + '<div class="card meta">' + L('No long-term savings yet. Tap New saving.',
        'এখনো কোনো দীর্ঘমেয়াদি সঞ্চয় নেই। নতুন সঞ্চয় চাপুন।') + '</div>';
    }
    html += open.map(savingCard).join('');
    if (closed.length) {
      var emptyCount = closed.filter(function (s) { return (bals['saving:' + s.id] || 0) <= 0; }).length;
      html += '<div class="card">' +
        '<div class="sec-head"><h2>' + L('Closed savings', 'বন্ধ সঞ্চয়') + '</h2>' +
          (emptyCount ? '<button class="mini danger" data-sv-delall="1">' + L('Delete all empty', 'খালি সবগুলো মুছুন') + '</button>' : '') +
        '</div>' +
        '<p class="meta">' + L('Removed automatically 30 days after closing, once empty. Delete one by one here. A saving with money left must be emptied first.',
          'বন্ধ করার ৩০ দিন পর, খালি হলে আপনা থেকে মুছে যাবে। এখান থেকে একটি একটি করে মুছুন। টাকা থাকলে আগে খালি করুন।') + '</p>' +
        closed.map(function (s) {
          var bal = bals['saving:' + s.id] || 0;
          return '<div class="item-row"><div><b>' + esc(s.name) + '</b><div class="meta">' +
            L('Closed ', 'বন্ধ: ') + B.dates.toDisplay(s.closedAt || B.dates.today()) + ' · ' +
            L('Left ', 'বাকি ') + B.money.format(bal) + '</div></div>' +
            '<div class="row-btns">' +
              (bal > 0 ? '<button class="mini" data-sv-move="' + s.id + '">' + L('Move money', 'টাকা সরান') + '</button>' : '') +
              '<button class="mini danger" data-sv-del="' + s.id + '"' + (bal > 0 ? ' disabled' : '') + '>' + L('Delete', 'মুছুন') + '</button>' +
            '</div></div>';
        }).join('') +
        '</div>';
    }
    return html;
  }


  function renderPage(root) {
    root.classList.add('fund-page');
    var body = tab === 'emergency' ? emergencySection() : tab === 'saving' ? savingSection() : floatingSection();
    root.innerHTML = tabBar() + body;

    root.onclick = function (e) {

          if (ledgerClick(e)) return;
           if (e.target.closest('[data-sv-new]')) return savingPanel(null);
      var sv1 = e.target.closest('[data-sv-add]');
      if (sv1) return B.openTransaction({ type: 'transfer', to: 'saving:' + sv1.getAttribute('data-sv-add') });
      var sv2 = e.target.closest('[data-sv-take]');
      if (sv2) return B.openTransaction({ type: 'transfer', from: 'saving:' + sv2.getAttribute('data-sv-take') });
      var sv3 = e.target.closest('[data-sv-interest]');
      if (sv3) return recordInterest(sv3.getAttribute('data-sv-interest'));
      var sv4 = e.target.closest('[data-sv-edit]');
      if (sv4) return savingPanel(sv4.getAttribute('data-sv-edit'));
    
      var sd = e.target.closest('[data-sv-del]');
      if (sd) {
        if (!window.confirm(L('Delete this saving from the list? Its past entries stay in History.',
          'এই সঞ্চয়টি তালিকা থেকে মুছবেন? আগের লেনদেন ইতিহাসে থাকবে।'))) return;
        deleteSaving(sd.getAttribute('data-sv-del'));
        return B.refresh();
      }
      if (e.target.closest('[data-sv-delall]')) {
        if (!window.confirm(L('Delete all closed savings that are empty?', 'বন্ধ থাকা খালি সঞ্চয়গুলো সব মুছবেন?'))) return;
        var bals2 = B.balances(B.transactions.all());
        saveSavings(savingsAll().filter(function (s) {
          return !(s.closed && (bals2['saving:' + s.id] || 0) <= 0);
        }));
        return B.refresh();
      }
      var svm = e.target.closest('[data-sv-move]');
      if (svm) return closeSavingPanel(svm.getAttribute('data-sv-move'));
  var sv5 = e.target.closest('[data-sv-close]');
      if (sv5) return closeSavingPanel(sv5.getAttribute('data-sv-close'));
      if (e.target.closest('[data-em-manage]')) return manageEmergencyPanel();

      var t = e.target.closest('[data-tab]');
      if (t) { tab = t.getAttribute('data-tab'); return B.refresh(); }
      if (e.target.closest('[data-fl-add]')) return B.openTransaction({ type: 'transfer', to: 'floating' });
      if (e.target.closest('[data-fl-take]')) return B.openTransaction({ type: 'transfer', from: 'floating' });
      if (e.target.closest('[data-fl-target]')) return bucketPanel('floating');
      if (e.target.closest('[data-em-add]')) return B.openTransaction({ type: 'transfer', to: 'emergency' });
      if (e.target.closest('[data-em-take]')) return withdrawPanel();
      if (e.target.closest('[data-em-target]')) return bucketPanel('emergency');
          var svh = e.target.closest('[data-sv-history]');
      if (svh) return savingHistory(svh.getAttribute('data-sv-history'));

};
  }

  B.registerPage({
    id: 'savings',
    get label() { return L('Floating & Savings', 'ফ্লোটিং ও সঞ্চয়'); },
    onEnter: function () { tab = 'floating'; },
    render: renderPage
  });
})();