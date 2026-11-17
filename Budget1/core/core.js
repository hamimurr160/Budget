(function () {
  // ---------- Keys ----------
  // All app data lives in ONE record: DATA_KEY. A backup copy is written at the same time.
  // OLD_KEY / OLD_SETTINGS_KEY come from older versions; they are read once and then removed.
  var DATA_KEY = 'budget.data';
  var BACKUP_KEY = 'budget.backup';
  var OLD_KEY = 'budget.v1';
  var OLD_SETTINGS_KEY = 'budget.settings';

  var TRASH_DAYS = 60;
  var DAY_MS = 86400000;
  var BACKGROUNDS = ['sky', 'ocean', 'mint', 'lavender', 'sand', 'black', 'premium-black', 'premium-blue', 'deep-sky'];
  var CATEGORY_ICONS = ['🍔', '🚌', '🧾', '🛍️', '💊', '📚', '👨‍👩‍👧', '🎬', '✈️', '🎓', '🏠', '⛽', '📱', '🎁', '☕', '🏷️'];
  var KIND_ICON = { cash: '💵', bank: '🏦', mobile: '📱', savings: '🐖', other: '💳' };
  var KIND_LABEL = {
    cash: ['Cash', 'নগদ'], bank: ['Bank', 'ব্যাংক'], mobile: ['Mobile', 'মোবাইল'],
    savings: ['Savings', 'সঞ্চয়'], other: ['Other', 'অন্যান্য']
  };
  var DEFAULT_KIND = { 'Cash': 'cash', 'Bank': 'bank', 'Mobile wallet': 'mobile' };

  // sign = effect on a balance. Only income and expense count toward income/expense totals.
  // Debt = I owe the person. Loan = the person owes me.
  var TYPES = {
    income: { sign: 1 },
    expense: { sign: -1 },
    transfer: { sign: 0 },
    loan_received: { sign: 1 },
    loan_repaid: { sign: -1 },
    loan_given: { sign: -1 },
    loan_collected: { sign: 1 }
  };
  var DEBT_TYPES = { loan_received: true, loan_repaid: true };
  var LOAN_TYPES = { loan_given: true, loan_collected: true };

  var DEFAULT_CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Education', 'Family', 'Entertainment', 'Other'];
  var DEFAULT_ACCOUNTS = [
    { name: 'Cash', opening: 0, kind: 'cash' },
    { name: 'Bank', opening: 0, kind: 'bank' },
    { name: 'Mobile wallet', opening: 0, kind: 'mobile' }
  ];
  var SETTINGS_DEFAULTS = {
    defaultAccount: null, animations: true, confirmDelete: true, background: 'sky',
    language: 'en', reminderOn: false, reminderMinutes: 1200, dismissedOn: null
  };

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function T(key) { return window.Budget.t ? window.Budget.t(key) : key; }
  function L(en, bn) { return window.Budget.settings.get().language === 'bn' ? bn : en; }

  function freshState() {
    return {
      transactions: [],
      accounts: DEFAULT_ACCOUNTS.map(function (a) { return { name: a.name, opening: a.opening, kind: a.kind }; }),
      categories: DEFAULT_CATEGORIES.slice(),
      catIcons: {},
      tags: [],
      budgets: {},
      goals: [],
      trash: [],
      recurring: [],
      dueDates: {},
      settings: {}
    };
  }

  // ---------- Dates ----------
  var dates = {
    today: function () {
      var d = new Date();
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    todayDisplay: function () { return dates.toDisplay(dates.today()); },
    toDisplay: function (iso) {
      var p = String(iso).split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    },
    parseInput: function (text) {
      var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text || '');
      if (!m) return null;
      var d = +m[1], mo = +m[2], y = +m[3];
      var check = new Date(y, mo - 1, d);
      if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
      return y + '-' + pad(mo) + '-' + pad(d);
    },
    monthKey: function (iso) { return String(iso).slice(0, 7); },
    currentMonthKey: function () { return dates.monthKey(dates.today()); },
    shiftMonth: function (key, n) {
      var d = new Date(+key.slice(0, 4), (+key.slice(5, 7) - 1) + n, 1);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    },
    monthLabel: function (key) { return T('month.' + (+key.slice(5, 7))) + ' ' + key.slice(0, 4); },
    monthShort: function (key) { return T('mshort.' + (+key.slice(5, 7))); },
    daysInMonth: function (key) { return new Date(+key.slice(0, 4), +key.slice(5, 7), 0).getDate(); }
  };

  // ---------- Money ----------
  var money = {
    toPaisa: function (text) {
      var n = parseFloat(String(text).replace(/,/g, ''));
      if (!isFinite(n) || n <= 0) return null;
      return Math.round(n * 100);
    },
    toPaisaAny: function (text) {
      var clean = String(text).replace(/,/g, '').trim();
      if (clean === '') return 0;
      var n = parseFloat(clean);
      if (!isFinite(n)) return null;
      return Math.round(n * 100);
    },
    toInput: function (paisa) {
      return paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2);
    },
    format: function (paisa) {
      var sign = paisa < 0 ? '-' : '';
      var abs = Math.abs(paisa);
      var taka = String(Math.floor(abs / 100));
      var part = abs % 100;
      var grouped = '';
      while (taka.length > 3) {
        grouped = ',' + taka.slice(-3) + grouped;
        taka = taka.slice(0, -3);
      }
      var text = sign + '৳ ' + taka + grouped;
      return part ? text + '.' + pad(part) : text;
    }
  };

  // "005" -> "5", "12.5" stays. Keeps only digits and one dot, max 2 decimals.
  function cleanAmount(raw) {
    var s = String(raw).replace(/[^0-9.]/g, '');
    var dot = s.indexOf('.');
    var intPart = dot === -1 ? s : s.slice(0, dot);
    var decPart = dot === -1 ? null : s.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    intPart = intPart.replace(/^0+(?=\d)/, '');
    return decPart === null ? intPart : intPart + '.' + decPart;
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute || el.getAttribute('inputmode') !== 'decimal') return;
    var v = cleanAmount(el.value);
    if (v !== el.value) el.value = v;
  });

  // ---------- Storage ----------
  function scoreOf(s) {
    if (!s || typeof s !== 'object') return -1;
    return (s.transactions || []).length * 2 + (s.goals || []).length * 2 +
      Object.keys(s.budgets || {}).length * 2 + (s.trash || []).length + (s.recurring || []).length;
  }

  // Reads the main record. If it looks empty but another copy has data, the fuller copy is used.
  function readRaw() {
    var best = null, bestScore = -2;
    [DATA_KEY, OLD_KEY, BACKUP_KEY].forEach(function (k) {
      var parsed = null;
      try { parsed = JSON.parse(localStorage.getItem(k)); } catch (e) { parsed = null; }
      var sc = scoreOf(parsed);
      if (parsed && sc > bestScore) { best = parsed; bestScore = sc; }
    });
    var state = best || {};
    if (!state.settings) {
      try { state.settings = JSON.parse(localStorage.getItem(OLD_SETTINGS_KEY)) || {}; }
      catch (e) { state.settings = {}; }
    }
    return state;
  }

  var store = {
    load: function () {
      var state = readRaw();
      var fresh = freshState();
      Object.keys(fresh).forEach(function (k) {
        if (state[k] === undefined || state[k] === null) state[k] = fresh[k];
      });
      state.settings = Object.assign({}, SETTINGS_DEFAULTS, state.settings);
      var cutoff = Date.now() - TRASH_DAYS * DAY_MS;
      state.trash = state.trash.filter(function (x) { return Date.parse(x.deletedAt) > cutoff; });
      return state;
    },
    save: function (data) {
      try {
        var text = JSON.stringify(data);
        localStorage.setItem(DATA_KEY, text);
        localStorage.setItem(BACKUP_KEY, text);
        localStorage.removeItem(OLD_KEY);
        localStorage.removeItem(OLD_SETTINGS_KEY);
        return true;
      } catch (e) {
        console.error('save failed', e);
        return false;
      }
    },
    // The whole data file as text (used for backup and export).
    dump: function () { return JSON.stringify(store.load(), null, 2); },
    // Replaces everything with the text of a backup. Returns an error message or null.
    importText: function (text) {
      var obj;
      try { obj = JSON.parse(text); } catch (e) { return 'That is not a valid backup.'; }
      if (!obj || !Array.isArray(obj.transactions)) return 'That backup has no transactions.';
      return store.save(Object.assign(freshState(), obj)) ? null : 'Could not restore.';
    },
    reset: function () {
      try {
        localStorage.removeItem(DATA_KEY);
        localStorage.removeItem(BACKUP_KEY);
        localStorage.removeItem(OLD_KEY);
        localStorage.removeItem(OLD_SETTINGS_KEY);
      } catch (e) {}
      return store.save(freshState());
    }
  };

  var settings = {
    get: function () { return store.load().settings; },
    set: function (key, value) {
      var st = store.load();
      st.settings[key] = value;
      store.save(st);
      applySettings();
    }
  };

  function applySettings() {
    var body = document.body;
    if (!body) return;
    var s = settings.get();
    body.classList.toggle('no-anim', !s.animations);
    body.classList.toggle('lang-bn', s.language === 'bn');
    document.documentElement.lang = s.language === 'bn' ? 'bn' : 'en';
    BACKGROUNDS.forEach(function (id) { body.classList.remove('bg-' + id); });
    body.classList.add('bg-' + s.background);
  }

  // ---------- Toast with Undo countdown ----------
  var toastTimer = null;
  function toast(text, actionLabel, onAction) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    function hide() {
      el.classList.remove('show');
      clearInterval(toastTimer);
    }
    el.innerHTML = '<span>' + esc(text) + '</span>' +
      (actionLabel ? '<button id="toast-btn">' + esc(actionLabel) + ' <b id="toast-sec">5</b>s</button>' : '');
    el.classList.add('show');
    var left = 5;
    clearInterval(toastTimer);
    toastTimer = setInterval(function () {
      left -= 1;
      var sec = document.getElementById('toast-sec');
      if (sec) sec.textContent = left;
      if (left <= 0) hide();
    }, 1000);
    var btn = document.getElementById('toast-btn');
    if (btn) btn.onclick = function () { hide(); if (onAction) onAction(); };
  }

  // ---------- Transaction helpers ----------
  function txType(t) {
    if (t.type === 'in') return 'income';
    if (t.type === 'out') return 'expense';
    return TYPES[t.type] ? t.type : 'expense';
  }
  function isDebtType(type) { return !!DEBT_TYPES[type]; }
  function isLoanGroupType(type) { return !!LOAN_TYPES[type]; }
  function isLoan(type) { return isDebtType(type) || isLoanGroupType(type); }
  function txAccount(t) { return t.account || 'Cash'; }
  function txCategory(t) { return t.category || 'Other'; }
  function txTags(t) { return Array.isArray(t.tags) ? t.tags : []; }

  function parseTags(text) {
    var seen = {};
    var out = [];
    String(text || '').split(',').forEach(function (raw) {
      var tag = raw.trim().replace(/^#+/, '');
      if (tag && !seen[tag.toLowerCase()]) {
        seen[tag.toLowerCase()] = true;
        out.push(tag);
      }
    });
    return out;
  }

  // Goals are balances too. Their references look like 'goal:<id>'.
  function isGoalRef(ep) { return typeof ep === 'string' && ep.indexOf('goal:') === 0; }

  function endpointLabel(ep) {
    if (!ep) return '-';
    if (ep === 'floating') return L('Floating Fund', 'ফ্লোটিং ফান্ড');
      if (ep === 'emergency') return L('Emergency Fund', 'ইমার্জেন্সি ফান্ড');
    if (ep && ep.indexOf('saving:') === 0) {
      var sv = (store.load().settings.savingsList || []).filter(function (s) { return 'saving:' + s.id === ep; })[0];
      return sv ? sv.name : L('Saving', 'সঞ্চয়');
    }

  if (isGoalRef(ep)) {
      var g = store.load().goals.filter(function (x) { return 'goal:' + x.id === ep; })[0];
      return g ? g.name : T('goal.deleted');
    }
    return ep;
  }

  function txRoute(t) {
    if (txType(t) === 'transfer') {
      return endpointLabel(txAccount(t)) + ' → ' + endpointLabel(t.toAccount || txAccount(t));
    }
    return txAccount(t);
  }

  function inMonth(list, key) {
    return list.filter(function (t) { return dates.monthKey(t.date) === key; });
  }

  function summarize(list) {
    var income = 0, expense = 0;
    list.forEach(function (t) {
      var type = txType(t);
      if (type === 'income') income += t.amount;
      if (type === 'expense') expense += t.amount;
    });
    return { income: income, expense: expense, net: income - expense };
  }

  // Balances: opening amount plus transactions. Goals start at 0 and hold what was saved.
  function balances(list) {
    var bal = {};
    var state = store.load();
    state.accounts.forEach(function (a) { bal[a.name] = a.opening || 0; });
    state.goals.forEach(function (g) { bal['goal:' + g.id] = 0; });
   (state.settings.savingsList || []).forEach(function (s) { bal['saving:' + s.id] = 0; });

    bal['floating'] = 0;
    bal['emergency'] = 0;

  list.forEach(function (t) {
      var type = txType(t);
      var from = txAccount(t);
      if (type === 'transfer') {
        var to = t.toAccount || from;
        if (bal[from] !== undefined) bal[from] -= t.amount;
        if (bal[to] !== undefined) bal[to] += t.amount;
      } else if (bal[from] !== undefined) {
        bal[from] += TYPES[type].sign * t.amount;
      }
    });
    return bal;
  }

  function sortNewest(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
    });
  }

  function statusOf(pct) { return pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok'; }

  function ring(pct, status, size) {
    var s = size || 64, r = s / 2 - 6, c = 2 * Math.PI * r, p = Math.max(0, Math.min(pct, 100));
    var color = status === 'over' ? '#fb7185' : status === 'warn' ? '#fbbf24' : '#34d399';
    return '<svg class="ring" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke-width="7" style="stroke:var(--soft)"/>' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="7" ' +
        'stroke-linecap="round" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '" ' +
        'transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"/>' +
      '<text x="50%" y="54%" text-anchor="middle" font-size="' + Math.round(s / 4.2) + '" font-weight="700" style="fill:var(--text)">' +
        Math.round(pct) + '%</text></svg>';
  }

  function txRow(t) {
    var type = txType(t);
    var def = TYPES[type];
    var sign = def.sign > 0 ? '+ ' : def.sign < 0 ? '- ' : '⇄ ';
    var cls = def.sign > 0 ? 'in' : def.sign < 0 ? 'out' : 'neutral';
    var label = (type === 'transfer' && isGoalRef(t.toAccount)) ? T('transfer.toGoal') : T('type.' + type);
    var parts = [dates.toDisplay(t.date), label, type === 'transfer' ? txRoute(t) : txAccount(t)];
    if (type === 'income' || type === 'expense') parts.push(txCategory(t));
    if (isLoan(type) && t.person) parts.push(t.person);
    if (t.note) parts.push(t.note);
    var tagHtml = txTags(t).map(function (g) { return '<span class="tag">#' + esc(g) + '</span>'; }).join('');
    var edits = t.editCount || 0;
    var badge = edits > 0 ? '<span class="edited">' + L('Edited', 'সম্পাদিত') + (edits > 1 ? ' ×' + edits : '') + '</span>' : '';
    return '<li data-edit="' + t.id + '">' +
      '<div class="amt ' + cls + '">' + sign + money.format(t.amount) + '</div>' +
      '<div class="meta">' + esc(parts.join(' · ')) + ' ' + tagHtml + ' ' + badge + '</div>' +
    '</li>';
  }

  function hasName(list, name, except) {
    var low = name.toLowerCase();
    return list.some(function (a) { return a.name.toLowerCase() === low && a.name !== except; });
  }

  function indexOfTx(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  // ---------- Transactions ----------
  var transactions = {
    all: function () { return store.load().transactions; },
    trashed: function () { return store.load().trash; },
    find: function (id) {
      var list = store.load().transactions;
      var i = indexOfTx(list, id);
      return i >= 0 ? list[i] : null;
    },
    // Saving an existing entry records when it was edited (editedAt) and counts the edit.
    upsert: function (tx) {
      var state = store.load();
      var i = indexOfTx(state.transactions, tx.id);
      if (i >= 0) {
        var old = state.transactions[i];
        var merged = Object.assign({}, old, tx, { editedAt: new Date().toISOString() });
        if (tx.editCount === undefined) merged.editCount = (old.editCount || 0) + 1;
        state.transactions[i] = merged;
      } else {
        state.transactions.push(tx);
      }
      return store.save(state);
    },
    remove: function (id) {
      var state = store.load();
      var i = indexOfTx(state.transactions, id);
      if (i < 0) return false;
      var tx = state.transactions[i];
      state.transactions.splice(i, 1);
      state.trash.push({ tx: tx, deletedAt: new Date().toISOString() });
      return store.save(state);
    },
    restore: function (id) {
      var state = store.load();
      var item = state.trash.filter(function (x) { return x.tx.id === id; })[0];
      if (!item) return false;
      state.trash = state.trash.filter(function (x) { return x.tx.id !== id; });
      state.transactions.push(item.tx);
      return store.save(state);
    },
    purge: function (id) {
      var state = store.load();
      state.trash = state.trash.filter(function (x) { return x.tx.id !== id; });
      return store.save(state);
    },
    emptyTrash: function () {
      var state = store.load();
      state.trash = [];
      return store.save(state);
    }
  };

  // ---------- Account kinds and accounts ----------
  var kinds = {
    list: Object.keys(KIND_ICON),
    icon: function (k) { return KIND_ICON[k] || KIND_ICON.other; },
    label: function (k) { var p = KIND_LABEL[k] || KIND_LABEL.other; return L(p[0], p[1]); }
  };

  function kindOf(name) {
    var a = store.load().accounts.filter(function (x) { return x.name === name; })[0];
    return (a && a.kind) || DEFAULT_KIND[name] || 'other';
  }

  function countAccountUses(state) {
    var counts = {};
    state.transactions.forEach(function (t) {
      var a = txAccount(t);
      counts[a] = (counts[a] || 0) + 1;
      if (t.toAccount && !isGoalRef(t.toAccount)) counts[t.toAccount] = (counts[t.toAccount] || 0) + 1;
    });
    return counts;
  }

  var accounts = {
    all: function () { return store.load().accounts; },
    kindOf: kindOf,
    ordered: function () {
      var state = store.load();
      var counts = countAccountUses(state);
      return state.accounts.map(function (a, i) {
        return { name: a.name, opening: a.opening, kind: a.kind, index: i, uses: counts[a.name] || 0 };
      }).sort(function (x, y) { return (y.uses - x.uses) || (x.index - y.index); });
    },
    add: function (name, opening, kind) {
      var clean = String(name).trim();
      if (!clean) return L('Enter an account name.', 'অ্যাকাউন্টের নাম লিখুন।');
      var state = store.load();
      if (hasName(state.accounts, clean, null)) return L('That account already exists.', 'এই নামের অ্যাকাউন্ট আছে।');
      state.accounts.push({ name: clean, opening: opening || 0, kind: kind || 'other' });
      return store.save(state) ? null : 'Could not save.';
    },
    // Renaming updates past transactions, so balances stay correct.
    update: function (oldName, newName, opening, kind) {
      var clean = String(newName).trim();
      if (!clean) return L('Enter an account name.', 'অ্যাকাউন্টের নাম লিখুন।');
      var state = store.load();
      if (clean.toLowerCase() !== oldName.toLowerCase() && hasName(state.accounts, clean, oldName)) {
        return L('That name is already used.', 'এই নাম আগে থেকেই আছে।');
      }
      state.accounts.forEach(function (a) {
        if (a.name === oldName) {
          a.name = clean;
          a.opening = opening;
          a.kind = kind || a.kind || DEFAULT_KIND[oldName] || 'other';
        }
      });
      state.transactions.forEach(function (t) {
        if (txAccount(t) === oldName) t.account = clean;
        if (t.toAccount === oldName) t.toAccount = clean;
      });
      return store.save(state) ? null : 'Could not save.';
    },
    // Deleting is allowed only at balance 0. Old entries keep the name in history.
    remove: function (name) {
      var state = store.load();
      var current = balances(state.transactions)[name] || 0;
      if (current !== 0) {
        return L('Balance must be ' + money.format(0) + ' to delete. It is currently ' + money.format(current) + '.',
          'মুছতে হলে ব্যালেন্স ' + money.format(0) + ' হতে হবে। এখন আছে ' + money.format(current) + '।');
      }
      state.accounts = state.accounts.filter(function (a) { return a.name !== name; });
      return store.save(state) ? null : 'Could not save.';
    }
  };

  // ---------- Categories ----------
  var categories = {
    all: function () { return store.load().categories; },
    icon: function (name) { return store.load().catIcons[name] || '🏷️'; },
    setIcon: function (name, icon) {
      var state = store.load();
      state.catIcons[name] = icon;
      return store.save(state) ? null : 'Could not save.';
    },
    ordered: function () {
      var state = store.load();
      var counts = {};
      state.transactions.forEach(function (t) {
        var c = txCategory(t);
        counts[c] = (counts[c] || 0) + 1;
      });
      return state.categories.slice().sort(function (a, b) {
        return ((counts[b] || 0) - (counts[a] || 0)) || a.localeCompare(b);
      });
    },
    add: function (name) {
      var clean = String(name).trim();
      if (!clean) return 'Enter a category name.';
      var state = store.load();
      var low = clean.toLowerCase();
      if (state.categories.some(function (c) { return c.toLowerCase() === low; })) return 'That category already exists.';
      state.categories.push(clean);
      return store.save(state) ? null : 'Could not save.';
    },
    // Past transactions keep their old name. Only the list changes.
    rename: function (oldName, newName) {
      var clean = String(newName).trim();
      if (!clean) return 'Enter a category name.';
      var state = store.load();
      var low = clean.toLowerCase();
      if (low !== oldName.toLowerCase() && state.categories.some(function (c) { return c.toLowerCase() === low; })) {
        return 'That category already exists.';
      }
      state.categories = state.categories.map(function (c) { return c === oldName ? clean : c; });
      if (state.catIcons[oldName]) { state.catIcons[clean] = state.catIcons[oldName]; delete state.catIcons[oldName]; }
      return store.save(state) ? null : 'Could not save.';
    },
    remove: function (name) {
      if (name === 'Other') return 'Other cannot be deleted.';
      var state = store.load();
      state.categories = state.categories.filter(function (c) { return c !== name; });
      return store.save(state) ? null : 'Could not save.';
    }
  };

  // ---------- Tags ----------
  var tags = {
    all: function () { return store.load().tags; },
    add: function (name) {
      var clean = String(name).trim().replace(/^#+/, '');
      if (!clean) return 'Enter a tag name.';
      var state = store.load();
      var low = clean.toLowerCase();
      if (state.tags.some(function (x) { return x.toLowerCase() === low; })) return 'That tag already exists.';
      state.tags.push(clean);
      return store.save(state) ? null : 'Could not save.';
    },
    rename: function (oldName, newName) {
      var clean = String(newName).trim().replace(/^#+/, '');
      if (!clean) return 'Enter a tag name.';
      var state = store.load();
      state.tags = state.tags.map(function (x) { return x === oldName ? clean : x; });
      return store.save(state) ? null : 'Could not save.';
    },
    remove: function (name) {
      var state = store.load();
      state.tags = state.tags.filter(function (x) { return x !== name; });
      return store.save(state) ? null : 'Could not save.';
    },
    ensure: function (list) {
      var state = store.load();
      list.forEach(function (tag) {
        var low = tag.toLowerCase();
        if (!state.tags.some(function (x) { return x.toLowerCase() === low; })) state.tags.push(tag);
      });
      store.save(state);
    }
  };

  // ---------- Budgets ----------
  // Stored as { limit, rollover, since, changes: [{from:'YYYY-MM', limit}] }.
  // A change applies from its month on, so editing a budget never rewrites past months.
  function curMonth() { return dates.currentMonthKey(); }

  function normBudget(raw) {
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number') raw = { limit: raw, rollover: false, since: curMonth() };
    var since = raw.since || curMonth();
    var changes = Array.isArray(raw.changes) && raw.changes.length
      ? raw.changes.slice()
      : [{ from: since, limit: raw.limit }];
    changes.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    return { limit: changes[changes.length - 1].limit, rollover: !!raw.rollover, since: since, changes: changes };
  }

  function getBudget(key) { return normBudget(store.load().budgets[key]); }

  function limitAt(cfg, m) {
    var lim = cfg.changes[0].limit;
    cfg.changes.forEach(function (c) { if (c.from <= m) lim = c.limit; });
    return lim;
  }

  function catKeys() {
    return Object.keys(store.load().budgets).filter(function (k) { return k !== '__total__'; });
  }

  function spentFor(key, m, list) {
    return inMonth(list, m).reduce(function (sum, t) {
      if (txType(t) !== 'expense') return sum;
      if (key !== '__total__' && txCategory(t) !== key) return sum;
      return sum + t.amount;
    }, 0);
  }

  function monthView(key, m) {
    if (key === '__total__') return totalView(m);
    var cfg = getBudget(key);
    if (!cfg || m < cfg.since) return null;
    var list = store.load().transactions;
    var carry = 0, result = null, mm = cfg.since;
    while (mm <= m) {
      var limit = limitAt(cfg, mm);
      var spent = spentFor(key, mm, list);
      var roll = cfg.rollover ? carry : 0;
      var available = limit + roll;
      if (mm === m) {
        result = { limit: limit, carry: roll, available: available, spent: spent,
          remaining: available - spent, rollover: cfg.rollover };
      }
      carry = cfg.rollover ? Math.max(0, available - spent) : 0;
      mm = dates.shiftMonth(mm, 1);
    }
    return result;
  }

  // Total budget is calculated from the category budgets. It is never set separately.
  function totalView(m) {
    var sum = null;
    catKeys().forEach(function (k) {
      var v = monthView(k, m);
      if (!v) return;
      if (!sum) sum = { limit: 0, carry: 0, available: 0, spent: 0, remaining: 0, rollover: false };
      sum.limit += v.limit;
      sum.carry += v.carry;
      sum.available += v.available;
      sum.spent += v.spent;
      sum.remaining += v.remaining;
      sum.rollover = sum.rollover || v.rollover;
    });
    return sum;
  }

  function pctFor(key, m) {
    var v = monthView(key, m);
    if (!v) return null;
    var pct = v.available > 0 ? v.spent / v.available * 100 : (v.spent > 0 ? 100 : 0);
    return { pct: pct, view: v };
  }

  var budgets = {
    get: getBudget,
    monthView: monthView,
    pctFor: pctFor,
    catKeys: catKeys,
    // Budgeted categories for a month, highest % first.
    rows: function (m) {
      return catKeys().map(function (k) {
        return { name: k, r: pctFor(k, m) };
      }).filter(function (x) { return x.r; })
        .sort(function (a, b) { return b.r.pct - a.r.pct; });
    },
    // Sets the limit from this month on. Changing a budget that is already running updates it.
    setLimit: function (key, paisa) {
      var state = store.load();
      if (paisa === null || paisa === undefined) {
        delete state.budgets[key];
        return store.save(state) ? null : 'Could not save.';
      }
      var cur = curMonth();
      var old = normBudget(state.budgets[key]);
      if (!old) {
        state.budgets[key] = { limit: paisa, rollover: false, since: cur, changes: [{ from: cur, limit: paisa }] };
      } else {
        var changes = old.changes.filter(function (c) { return c.from !== cur; });
        changes.push({ from: cur, limit: paisa });
        changes.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
        state.budgets[key] = { limit: paisa, rollover: old.rollover, since: old.since, changes: changes };
      }
      return store.save(state) ? null : 'Could not save.';
    },
    setRollover: function (key, flag) {
      var state = store.load();
      var old = normBudget(state.budgets[key]);
      if (!old) return 'Set a limit first.';
      state.budgets[key] = { limit: old.limit, rollover: flag, since: old.since, changes: old.changes };
      return store.save(state) ? null : 'Could not save.';
    },
    // splits: { categoryName: paisa }. Zero or less removes that category's budget.
    applyPlan: function (splits) {
      var err = null;
      Object.keys(splits).forEach(function (k) {
        var p = splits[k];
        err = budgets.setLimit(k, p > 0 ? p : null) || err;
      });
      return err;
    },
    all: function () { return store.load().budgets; }
  };

  // ---------- Goals ----------
  function allGoals() { return store.load().goals; }

  var goals = {
    all: function () { return allGoals().filter(function (g) { return !g.closedAt; }); },
    closed: function () { return allGoals().filter(function (g) { return !!g.closedAt; }); },
    balanceOf: function (id) { return balances(store.load().transactions)['goal:' + id] || 0; },
    isLocked: function () { return false; },
    // bal = result of balances(). Returns saved, remaining, percent and whether it is done.
    progress: function (g, bal) {
      var saved = (bal && bal['goal:' + g.id]) || 0;
      var remaining = Math.max(0, g.target - saved);
      var pct = g.target > 0 ? Math.min(100, Math.round(saved * 100 / g.target)) : 0;
      return { saved: saved, remaining: remaining, pct: pct, done: g.target > 0 && saved >= g.target };
    },
    add: function (name, target, deadline) {
      var clean = String(name).trim();
      if (!clean) return T('goal.nameInvalid');
      if (!target || target <= 0) return T('goal.targetInvalid');
      var state = store.load();
      if (state.goals.some(function (g) { return g.name.toLowerCase() === clean.toLowerCase() && !g.closedAt; })) {
        return L('That goal already exists.', 'এই নামের লক্ষ্য আছে।');
      }
      state.goals.push({ id: uid(), name: clean, target: target, deadline: deadline || null });
      return store.save(state) ? null : 'Could not save.';
    },
    update: function (id, name, target, deadline) {
      var clean = String(name).trim();
      if (!clean) return T('goal.nameInvalid');
      if (!target || target <= 0) return T('goal.targetInvalid');
      var state = store.load();
      if (state.goals.some(function (g) { return g.id !== id && g.name.toLowerCase() === clean.toLowerCase(); })) {
        return L('That goal already exists.', 'এই নামের লক্ষ্য আছে।');
      }
      state.goals.forEach(function (g) {
        if (g.id === id) { g.name = clean; g.target = target; g.deadline = deadline || null; }
      });
      return store.save(state) ? null : 'Could not save.';
    },
    // Removing is allowed only when nothing is saved in the goal.
    remove: function (id) {
      var state = store.load();
      var bal = balances(state.transactions)['goal:' + id] || 0;
      if (bal !== 0) return T('goal.deleteBlocked');
      state.goals = state.goals.filter(function (g) { return g.id !== id; });
      return store.save(state) ? null : 'Could not save.';
    },
    // Moves all saved money into an account and closes the goal. The move is recorded in history.
    close: function (id, accountName) {
      var state = store.load();
      var g = state.goals.filter(function (x) { return x.id === id; })[0];
      if (!g) return L('Goal not found.', 'লক্ষ্য পাওয়া যায়নি।');
      if (g.closedAt) return L('This goal is already closed.', 'এই লক্ষ্য আগেই বন্ধ।');
      var bal = balances(state.transactions)['goal:' + id] || 0;
      if (bal > 0) {
        if (!accountName) return L('Choose an account.', 'একটি অ্যাকাউন্ট বাছুন।');
        var now = new Date().toISOString();
        state.transactions.push({
          id: uid(), type: 'transfer', amount: bal, date: dates.today(),
          account: 'goal:' + id, toAccount: accountName, category: 'Other', person: null, tags: [],
          note: L('Goal closed: ', 'লক্ষ্য বন্ধ: ') + g.name, createdAt: now, updatedAt: now
        });
      }
      g.closedAt = new Date().toISOString();
      return store.save(state) ? null : 'Could not save.';
    }
  };

  // ---------- Debts and loans (each person's ledger) ----------
  function dueDateOf(group, name) {
    return store.load().dueDates[group + ':' + name] || null;
  }

  function groupSummary(group) {
    var plus = group === 'debt' ? 'loan_received' : 'loan_given';
    var minus = group === 'debt' ? 'loan_repaid' : 'loan_collected';
    var map = {};
    store.load().transactions.forEach(function (t) {
      var type = txType(t);
      if (type !== plus && type !== minus) return;
      var name = (t.person || 'Unknown').trim();
      if (!map[name]) map[name] = { name: name, group: group, taken: 0, paid: 0, count: 0 };
      if (type === plus) map[name].taken += t.amount;
      else map[name].paid += t.amount;
      map[name].count += 1;
    });
    return Object.keys(map).map(function (k) {
      var p = map[k];
      p.remaining = p.taken - p.paid;
      p.due = dueDateOf(group, p.name);
      return p;
    }).sort(function (a, b) { return b.remaining - a.remaining; });
  }

  var debts = {
    list: function (group) { return groupSummary(group); },
    persons: function () {
      var names = {};
      groupSummary('debt').concat(groupSummary('loan')).forEach(function (p) { names[p.name] = true; });
      return Object.keys(names);
    },
    dueOf: dueDateOf,
    setDue: function (group, name, iso) {
      var state = store.load();
      var key = group + ':' + name;
      if (iso) state.dueDates[key] = iso;
      else delete state.dueDates[key];
      return store.save(state) ? null : 'Could not save.';
    },
    // Every entry of one person in one group, newest first. Used by the ledger.
    entries: function (group, name) {
      var wanted = group === 'debt' ? DEBT_TYPES : LOAN_TYPES;
      return sortNewest(store.load().transactions.filter(function (t) {
        return wanted[txType(t)] && ((t.person || 'Unknown').trim() === name);
      }));
    }
  };

  var loans = {
    summary: function () { return groupSummary('debt'); }
  };

  // ---------- Quick entries: the 3 income or expense entries the user repeats most ----------
  var quick = {
    top: function (n) {
      var map = {};
      store.load().transactions.forEach(function (t) {
        var type = txType(t);
        if (type !== 'income' && type !== 'expense') return;
        var category = txCategory(t), account = txAccount(t), note = t.note || '';
        var key = [type, t.amount, category, account, note].join('|');
        if (!map[key]) {
          map[key] = { type: type, amount: t.amount, category: category, account: account,
            note: note, tags: txTags(t), count: 0, last: t.date };
        }
        map[key].count += 1;
        if (t.date > map[key].last) map[key].last = t.date;
      });
      return Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) { return (b.count - a.count) || (a.last < b.last ? 1 : -1); })
        .slice(0, n || 3);
    }
  };

  // ---------- Celebration popup for a completed goal ----------
  var CONFETTI = ['#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];
  function celebrate(name) {
    var el = document.getElementById('celebrate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'celebrate';
      document.body.appendChild(el);
    }
    var bits = '';
    for (var i = 0; i < 28; i++) {
      bits += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' +
        CONFETTI[i % CONFETTI.length] + ';animation-delay:' + (Math.random() * 0.8).toFixed(2) + 's"></i>';
    }
    el.innerHTML = '<div class="cel-confetti">' + bits + '</div>' +
      '<div class="cel-card"><div class="cel-burst">🎉</div>' +
      '<h3>' + L('Goal completed!', 'লক্ষ্য পূরণ হয়েছে!') + '</h3>' +
      '<p>' + esc(name) + '</p>' +
      '<button id="cel-x" class="primary">' + L('Close', 'বন্ধ করুন') + '</button></div>';
    el.classList.add('show');
    var timer = setTimeout(hide, 7000);
    function hide() {
      el.classList.remove('show');
      clearTimeout(timer);
    }
    document.getElementById('cel-x').onclick = hide;
  }

  // ---------- Repeating entries ----------
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function nextAfter(iso, every, anchorDay) {
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10);
    if (every === 'day') return ymd(new Date(y, m - 1, d + 1));
    if (every === 'week') return ymd(new Date(y, m - 1, d + 7));
    var ny = y, nm = m + 1;
    if (nm > 12) { nm = 1; ny += 1; }
    var dim = new Date(ny, nm, 0).getDate();
    return ny + '-' + pad(nm) + '-' + pad(Math.min(anchorDay || d, dim));
  }

  function makeTx(r, date) {
    var now = new Date().toISOString();
    return {
      id: uid(), type: r.type, amount: r.amount, date: date,
      account: r.account || 'Cash', toAccount: r.toAccount || null,
      category: r.category || 'Other', person: r.person || null,
      tags: r.tags || [], note: r.note || '', createdAt: now, updatedAt: now, recurringId: r.id
    };
  }

  function processRecurring() {
    var state = store.load();
    var today = dates.today();
    var changed = false;
    state.recurring.forEach(function (r) {
      var guard = 0;
      while (r.active && r.nextDate <= today && guard < 500) {
        guard += 1;
        state.transactions.push(makeTx(r, r.nextDate));
        r.nextDate = nextAfter(r.nextDate, r.every, r.startDay);
        changed = true;
      }
    });
    if (changed) store.save(state);
    return changed;
  }

  var recurring = {
    all: function () { return store.load().recurring; },
    add: function (rule, startDate) {
      var state = store.load();
      var day = +startDate.slice(8, 10);
      state.recurring.push({
        id: uid(), type: rule.type, amount: rule.amount,
        account: rule.account || 'Cash', toAccount: rule.toAccount || null,
        category: rule.category || 'Other', person: rule.person || null,
        tags: rule.tags || [], note: rule.note || '', every: rule.every,
        startDay: day, nextDate: nextAfter(startDate, rule.every, day),
        endDate: null, active: true, createdAt: new Date().toISOString()
      });
      return store.save(state) ? null : 'Could not save.';
    },
    toggle: function (id) {
      var state = store.load();
      state.recurring.forEach(function (r) { if (r.id === id) r.active = !r.active; });
      return store.save(state) ? null : 'Could not save.';
    },
    remove: function (id) {
      var state = store.load();
      state.recurring = state.recurring.filter(function (r) { return r.id !== id; });
      return store.save(state) ? null : 'Could not save.';
    },
    process: processRecurring
  };

  // ---------- Public API ----------
  if (!window.Budget) window.Budget = {};
  var Budget = window.Budget;
  Budget.pages = Budget.pages || [];
  Budget.registerPage = function (page) { Budget.pages.push(page); };
  if (!Budget.t) Budget.t = function (key) { return key; };
  Budget.L = L;
  Budget.TRASH_DAYS = TRASH_DAYS;
  Budget.BACKGROUNDS = BACKGROUNDS;
  Budget.categoryIcons = CATEGORY_ICONS;
  Budget.types = TYPES;
  Budget.dates = dates;
  Budget.money = money;
  Budget.cleanAmount = cleanAmount;
  Budget.store = store;
  Budget.settings = settings;
  Budget.applySettings = applySettings;
  Budget.toast = toast;
  Budget.kinds = kinds;
  Budget.transactions = transactions;
  Budget.accounts = accounts;
  Budget.categories = categories;
  Budget.tags = tags;
  Budget.budgets = budgets;
  Budget.goals = goals;
  Budget.debts = debts;
  Budget.loans = loans;
  Budget.quick = quick;
  Budget.recurring = recurring;
  Budget.celebrate = celebrate;
  Budget.txType = txType;
  Budget.isLoan = isLoan;
  Budget.isDebtType = isDebtType;
  Budget.isLoanGroupType = isLoanGroupType;
  Budget.isGoalRef = isGoalRef;
  Budget.endpointLabel = endpointLabel;
  Budget.txRoute = txRoute;
  Budget.txAccount = txAccount;
  Budget.txCategory = txCategory;
  Budget.txTags = txTags;
  Budget.parseTags = parseTags;
  Budget.txRow = txRow;
  Budget.inMonth = inMonth;
  Budget.summarize = summarize;
  Budget.balances = balances;
  Budget.sortNewest = sortNewest;
  Budget.statusOf = statusOf;
  Budget.ring = ring;
  Budget.esc = esc;
  Budget.uid = uid;

  applySettings();
})();