(function () {
  var B = window.Budget;

  function L(en, bn) { return B.L(en, bn); }
  function esc(s) { return B.esc(s); }
  function money(p) { return B.money.format(p); }

  function kindChips(selected) {
    return B.kinds.list.map(function (k) {
      return '<button class="chip' + (k === selected ? ' sel' : '') + '" data-kind="' + k + '">' +
        B.kinds.icon(k) + ' ' + esc(B.kinds.label(k)) + '</button>';
    }).join('');
  }

  function openForm(existing) {
    var d = existing
      ? { old: existing.name, name: existing.name, kind: B.accounts.kindOf(existing.name), opening: B.money.toInput(existing.opening), err: '' }
      : { old: null, name: '', kind: 'bank', opening: '', err: '' };
    B.panel.open(existing ? L('Edit account', 'অ্যাকাউন্ট সম্পাদনা') : L('New account', 'নতুন অ্যাকাউন্ট'), function (body) {
      paint(body, d);
    });
  }

  function paint(body, d) {
    var bal = d.old ? B.balances(B.transactions.all())[d.old] || 0 : 0;
    body.innerHTML =
      '<div class="ed-label">' + L('What kind of account?', 'কী ধরনের অ্যাকাউন্ট?') + '</div>' +
      '<div class="chips kind-chips">' + kindChips(d.kind) + '</div>' +
      '<div class="field" style="margin-top:12px"><label>' + L('Account name', 'অ্যাকাউন্টের নাম') + '</label>' +
      '<input id="ac-name" value="' + esc(d.name) + '" placeholder="' + L('e.g. bKash, Savings', 'যেমন: বিকাশ, সঞ্চয়') + '"></div>' +
      '<div class="field"><label>' + L('Opening balance (৳)', 'শুরুর টাকা (৳)') + '</label>' +
      '<input id="ac-open" inputmode="decimal" value="' + esc(d.opening) + '" placeholder="0"></div>' +
      (d.old ? '<p class="meta">' + L('Current balance', 'এখনকার টাকা') + ': <b>' + money(bal) + '</b></p>' : '') +
      '<p class="msg">' + esc(d.err) + '</p>' +
      '<div class="sheet-actions"><button class="ghost" data-back="1">' + L('Back', 'ফিরে যান') + '</button>' +
      '<button class="primary" data-save="1">' + L('Save', 'সেভ') + '</button></div>' +
      (d.old ? '<button class="link-danger" data-del="1">' + L('Delete account', 'অ্যাকাউন্ট মুছুন') + '</button>' : '');

    function read() {
      d.name = body.querySelector('#ac-name').value;
      d.opening = body.querySelector('#ac-open').value;
    }

    body.onclick = function (e) {
      var el;
      if ((el = e.target.closest('[data-kind]'))) {
        read();
        d.kind = el.getAttribute('data-kind');
        return paint(body, d);
      }
      if (e.target.closest('[data-back]')) return B.panel.close();
      if (e.target.closest('[data-save]')) {
        read();
        var opening = B.money.toPaisaAny(d.opening);
        if (opening === null) { d.err = L('Enter a valid balance.', 'সঠিক টাকা লিখুন।'); return paint(body, d); }
        var err = d.old
          ? B.accounts.update(d.old, d.name, opening, d.kind)
          : B.accounts.add(d.name, opening, d.kind);
        if (err) { d.err = err; return paint(body, d); }
        B.panel.close();
        B.refresh();
        return B.success(L('Account saved', 'অ্যাকাউন্ট সেভ হয়েছে'), [d.name.trim()], 'ok');
      }
      if (e.target.closest('[data-del]')) {
        if (!window.confirm(L('Delete this account?', 'এই অ্যাকাউন্ট মুছবেন?'))) return;
        var delErr = B.accounts.remove(d.old);
        if (delErr) { d.err = delErr; return paint(body, d); }
        B.panel.close();
        B.refresh();
      }
    };
  }

  function tile(a, bal) {
    var kind = B.accounts.kindOf(a.name);
    return '<button class="acc-tile" data-acc="' + esc(a.name) + '">' +
      '<div class="acc-top"><span class="acc-kind">' + B.kinds.icon(kind) + '</span>' +
      '<span class="acc-kind-label">' + esc(B.kinds.label(kind)) + '</span></div>' +
      '<div class="acc-title">' + esc(a.name) + '</div>' +
      '<div class="acc-amount ' + (bal < 0 ? 'out' : '') + '">' + money(bal) + '</div>' +
      '<div class="meta">' + L('Opening', 'শুরুর টাকা') + ' ' + money(a.opening) + '</div></button>';
  }

  B.registerPage({
    id: 'accounts',
    get label() { return L('Accounts', 'অ্যাকাউন্ট'); },

    render: function (root) {
      var accs = B.accounts.all();
      var bal = B.balances(B.transactions.all());
      var total = accs.reduce(function (s, a) { return s + (bal[a.name] || 0); }, 0);

      root.innerHTML =
        '<div class="card hero">' +
          '<div class="hero-label">' + L('Total in all accounts', 'সব অ্যাকাউন্টে মোট') + '</div>' +
          '<div class="hero-value">' + money(total) + '</div>' +
          '<div class="hero-sub">' + accs.length + ' ' + L('accounts', 'টি অ্যাকাউন্ট') + '</div>' +
          '<button class="hero-btn" data-add="1">+ ' + L('Add account', 'অ্যাকাউন্ট যোগ') + '</button>' +
        '</div>' +
        (accs.length
          ? '<div class="acc-grid">' + accs.map(function (a) { return tile(a, bal[a.name] || 0); }).join('') + '</div>'
          : '<div class="card meta">' + L('No accounts yet. Tap Add account to create one.',
              'এখনো কোনো অ্যাকাউন্ট নেই। অ্যাকাউন্ট যোগ চাপুন।') + '</div>');

      root.onclick = function (e) {
        if (e.target.closest('[data-add]')) return openForm(null);
        var el = e.target.closest('[data-acc]');
        if (!el) return;
        var name = el.getAttribute('data-acc');
        openForm(accs.filter(function (a) { return a.name === name; })[0]);
      };
    }
  });
})();