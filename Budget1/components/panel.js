(function () {
  var B = window.Budget;
  var current = null;
  var catEdit = null, catEditIcon = null, catAddIcon = null, panelMsg = '';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return B.esc(s); }
  function L(en, bn) { return B.L(en, bn); }
  function t(k) { return B.t(k); }

  // ---------- The floating panel (used by many pages) ----------

  function build() {
    if ($('panel-wrap')) return;
    var wrap = document.createElement('div');
    wrap.id = 'panel-wrap';
    wrap.innerHTML =
      '<div id="panel-overlay"></div>' +
      '<div id="panel" role="dialog" aria-modal="true">' +
        '<div class="sheet-grip"></div>' +
        '<div class="sheet-top"><h2 id="panel-title"></h2>' +
        '<button id="panel-x" class="icon-btn" aria-label="Close">✕</button></div>' +
        '<div id="panel-body"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    $('panel-overlay').onclick = function () { B.panel.close(); };
    $('panel-x').onclick = function () { B.panel.close(); };
  }

  // Keeps the panel above anything opened earlier.
  function raise() {
    var w = $('panel-wrap');
    if (w) document.body.appendChild(w);
  }

  function paint() {
    if (!current) return;
    $('panel-title').textContent = current.title;
    var body = $('panel-body');
    body.onclick = null;
    body.oninput = null;
    body.innerHTML = '';
    current.render(body);
    body.scrollTop = 0;
  }

  B.panel = {
    // render(body) fills the panel and sets its own click handler.
    // onClose (optional) runs when the panel is closed.
    open: function (title, render, onClose) {
      build();
      raise();
      current = { title: title, render: render, onClose: onClose || null };
      $('panel-wrap').classList.add('open');
      paint();
    },
    refresh: function () { paint(); },
    close: function () {
      var w = $('panel-wrap');
      if (w) w.classList.remove('open');
      var cb = current && current.onClose;
      current = null;
      if (cb) cb();
    },
    isOpen: function () { return !!current; }
  };

  // ---------- Categories manager ----------

  function renderCategories(body) {
    var list = B.categories.ordered();
    var rows = list.map(function (c) {
      if (c === catEdit) {
        var icon = catEditIcon || B.categories.icon(c);
        return '<div class="mgr-item mgr-editing">' +
          '<input id="cat-edit" value="' + esc(catEditName || c) + '">' +
          '<div class="icon-grid">' + B.categoryIcons.map(function (i) {
            return '<button class="icon-opt' + (i === icon ? ' sel' : '') + '" data-icon="' + i + '">' + i + '</button>';
          }).join('') + '</div>' +
          '<div class="mgr-actions">' +
            '<button class="mini primary-mini" data-cat-save="' + esc(c) + '">' + L('Save', 'সেভ') + '</button>' +
            '<button class="mini" data-cat-back="1">' + L('Back', 'ফিরে যান') + '</button>' +
          '</div></div>';
      }
      return '<div class="mgr-item"><div class="mgr-name"><span class="mgr-ico">' + B.categories.icon(c) + '</span>' + esc(c) + '</div>' +
        '<div class="mgr-actions">' +
          '<button class="icon-pill" data-cat-edit="' + esc(c) + '" aria-label="Edit">✎</button>' +
          (c === 'Other' ? '' : '<button class="icon-pill danger" data-cat-del="' + esc(c) + '" aria-label="Delete">✕</button>') +
        '</div></div>';
    }).join('');

    var addIcon = catAddIcon || B.categoryIcons[0];
    body.innerHTML =
      '<div class="mgr-count">' + list.length + ' ' + L('categories', 'টি ক্যাটাগরি') + '</div>' +
      '<p class="meta">' + t('panel.catHint') + '</p>' +
      '<div class="mgr-list">' + rows + '</div>' +
      (panelMsg ? '<p class="msg ok">' + esc(panelMsg) + '</p>' : '') +
      '<div class="mgr-addbox">' +
        '<div class="ed-label">' + L('New category', 'নতুন ক্যাটাগরি') + '</div>' +
        '<div class="mgr-add"><input id="cat-new" placeholder="' + t('panel.newCategory') + '">' +
        '<button class="add-btn" data-cat-add="1">' + t('btn.add') + '</button></div>' +
        '<div class="icon-grid">' + B.categoryIcons.map(function (i) {
          return '<button class="icon-opt' + (i === addIcon ? ' sel' : '') + '" data-add-icon="' + i + '">' + i + '</button>';
        }).join('') + '</div>' +
      '</div>';

    body.onclick = function (e) {
      var el;
      if ((el = e.target.closest('[data-icon]'))) {
        var nameBox = $('cat-edit');
        catEditIcon = el.getAttribute('data-icon');
        if (nameBox) catEditName = nameBox.value;
        return B.panel.refresh();
      }
      if ((el = e.target.closest('[data-add-icon]'))) {
        catAddIcon = el.getAttribute('data-add-icon');
        return B.panel.refresh();
      }
      if ((el = e.target.closest('[data-cat-edit]'))) {
        catEdit = el.getAttribute('data-cat-edit');
        catEditIcon = B.categories.icon(catEdit);
        catEditName = catEdit;
        panelMsg = '';
        return B.panel.refresh();
      }
      if (e.target.closest('[data-cat-back]')) {
        catEdit = null;
        catEditName = null;
        panelMsg = '';
        return B.panel.refresh();
      }
      if ((el = e.target.closest('[data-cat-save]'))) {
        var oldName = el.getAttribute('data-cat-save');
        var newName = $('cat-edit').value;
        var err = B.categories.rename(oldName, newName);
        if (err) { panelMsg = err; return B.panel.refresh(); }
        var cleanName = String(newName).trim();
        if (catEditIcon) B.categories.setIcon(cleanName, catEditIcon);
        catEdit = null;
        panelMsg = t('panel.renamed');
        B.panel.refresh();
        return B.refresh();
      }
      if ((el = e.target.closest('[data-cat-del]'))) {
        var name = el.getAttribute('data-cat-del');
        if (B.settings.get().confirmDelete && !window.confirm('"' + name + '"?')) return;
        var delErr = B.categories.remove(name);
        panelMsg = delErr || t('panel.deleted');
        B.panel.refresh();
        return B.refresh();
      }
      if (e.target.closest('[data-cat-add]')) {
        var addErr = B.categories.add($('cat-new').value);
        if (!addErr) {
          B.categories.setIcon(String($('cat-new').value).trim(), catAddIcon || B.categoryIcons[0]);
        }
        panelMsg = addErr || t('panel.added');
        B.panel.refresh();
        return B.refresh();
      }
    };
  }

  var catEditName = null;

  // Opened from the transaction form and from Settings. onClose runs when the panel closes.
  B.openCategoryManager = function (onClose) {
    catEdit = null;
    catEditName = null;
    catEditIcon = null;
    catAddIcon = null;
    panelMsg = '';
    B.panel.open(L('Categories', 'ক্যাটাগরি'), renderCategories, onClose);
  };

  // ---------- Repeating entries manager ----------

  function everyLabel(e) {
    return e === 'day' ? L('Daily', 'প্রতিদিন') : e === 'week' ? L('Weekly', 'সাপ্তাহিক') : L('Monthly', 'মাসিক');
  }

  function renderRecurring(body) {
    var list = B.recurring.all().slice().sort(function (a, b) { return a.nextDate < b.nextDate ? -1 : 1; });
    var rows = list.length ? list.map(function (r) {
      var who = r.person || r.note || B.txRoute(r);
      return '<div class="mgr-item"><div class="mgr-name" style="flex-direction:column;align-items:flex-start;gap:3px">' +
        '<span>' + esc(B.money.format(r.amount) + ' · ' + t('type.' + r.type)) + '</span>' +
        '<span class="meta">' + esc(everyLabel(r.every)) + ' · ' + esc(who) + '</span>' +
        '<span class="meta">' + (r.active
          ? L('Next: ', 'পরের: ') + B.dates.toDisplay(r.nextDate)
          : L('Paused', 'বন্ধ আছে')) + '</span></div>' +
        '<div class="mgr-actions"><button class="mini" data-rtoggle="' + r.id + '">' +
          (r.active ? L('Pause', 'বন্ধ') : L('Resume', 'চালু')) + '</button>' +
        '<button class="icon-pill danger" data-rdel="' + r.id + '" aria-label="Delete">✕</button></div></div>';
    }).join('') : '<p class="meta">' + L('No repeating entries yet. Add one from the + button and choose Repeat.',
      'এখনো কোনো নিয়মিত লেনদেন নেই। + দিয়ে যোগ করে "পুনরাবৃত্তি" বাছুন।') + '</p>';

    body.innerHTML =
      '<div class="mgr-count">' + list.length + ' ' + L('repeating', 'টি নিয়মিত') + '</div>' +
      '<p class="meta">' + L('Entries are added automatically when you open the app. Deleting a rule keeps the entries it already made.',
        'অ্যাপ খুললে নিয়মিত লেনদেন নিজে থেকে যোগ হয়। নিয়ম মুছলে আগের লেনদেন থেকে যাবে।') + '</p>' +
      '<div class="mgr-list">' + rows + '</div>';

    body.onclick = function (e) {
      var el;
      if ((el = e.target.closest('[data-rtoggle]'))) {
        B.recurring.toggle(el.getAttribute('data-rtoggle'));
        return B.panel.refresh();
      }
      if ((el = e.target.closest('[data-rdel]'))) {
        if (!window.confirm(L('Delete this repeating entry? Entries already made stay.',
          'এই নিয়মিত লেনদেন মুছবেন? আগের লেনদেন থেকে যাবে।'))) return;
        B.recurring.remove(el.getAttribute('data-rdel'));
        return B.panel.refresh();
      }
    };
  }

  B.openRecurringManager = function () {
    B.panel.open(L('Repeating entries', 'নিয়মিত লেনদেন'), renderRecurring);
  };
})();
