(function () {
  var B = window.Budget;
  var message = '';
  var isError = false;
  var tagEdit = null;
  var panelMsg = '';

  function $(id) { return document.getElementById(id); }
  function t(k) { return B.t(k); }
  function esc(s) { return B.esc(s); }
  function L(en, bn) { return B.L(en, bn); }

  function setMsg(text, error) {
    message = text;
    isError = !!error;
    var el = $('st-msg');
    if (el) {
      el.textContent = text;
      el.className = 'msg' + (error ? '' : ' ok');
    }
  }

  function toggleRow(key, label, on) {
    return '<div class="setting-row"><span>' + label + '</span>' +
      '<button class="switch' + (on ? ' on' : '') + '" data-toggle="' + key + '" aria-label="' + label + '"></button></div>';
  }

  // ---------- Tags panel ----------

  function renderTagsPanel(body) {
    var list = B.tags.all();
    var rows = list.length ? list.map(function (g) {
      if (g === tagEdit) {
        return '<div class="mgr-item mgr-editing"><input id="tag-edit" value="' + esc(g) + '">' +
          '<div class="mgr-actions"><button class="mini primary-mini" data-tag-save="' + esc(g) + '">' + L('Save', 'সেভ') + '</button>' +
          '<button class="mini" data-tag-back="1">' + L('Back', 'ফিরে যান') + '</button></div></div>';
      }
      return '<div class="mgr-item"><div class="mgr-name"><span class="mgr-pill">#' + esc(g) + '</span></div>' +
        '<div class="mgr-actions"><button class="icon-pill" data-tag-edit="' + esc(g) + '" aria-label="Edit">✎</button>' +
        '<button class="icon-pill danger" data-tag-del="' + esc(g) + '" aria-label="Delete">✕</button></div></div>';
    }).join('') : '<p class="meta">' + t('panel.noTagsYet') + '</p>';

    body.innerHTML =
      '<div class="mgr-count">' + list.length + ' ' + L('tags', 'টি ট্যাগ') + '</div>' +
      '<p class="meta">' + t('panel.tagHint') + '</p>' +
      '<div class="mgr-list">' + rows + '</div>' +
      (panelMsg ? '<p class="msg ok">' + esc(panelMsg) + '</p>' : '') +
      '<div class="mgr-add"><input id="tag-new" placeholder="' + t('panel.newTag') + '">' +
      '<button class="add-btn" data-tag-add="1">' + t('btn.add') + '</button></div>';

    body.onclick = function (e) {
      var el;
      if ((el = e.target.closest('[data-tag-edit]'))) {
        tagEdit = el.getAttribute('data-tag-edit');
        panelMsg = '';
        return B.panel.refresh();
      }
      if (e.target.closest('[data-tag-back]')) {
        tagEdit = null;
        panelMsg = '';
        return B.panel.refresh();
      }
      if ((el = e.target.closest('[data-tag-save]'))) {
        var err = B.tags.rename(el.getAttribute('data-tag-save'), $('tag-edit').value);
        if (err) { panelMsg = err; return B.panel.refresh(); }
        tagEdit = null;
        panelMsg = t('panel.renamed');
        return B.panel.refresh();
      }
      if ((el = e.target.closest('[data-tag-del]'))) {
        B.tags.remove(el.getAttribute('data-tag-del'));
        panelMsg = t('panel.deleted');
        return B.panel.refresh();
      }
      if (e.target.closest('[data-tag-add]')) {
        var addErr = B.tags.add($('tag-new').value);
        panelMsg = addErr || t('panel.added');
        return B.panel.refresh();
      }
    };
  }

  // ---------- Backup and restore ----------

  function fallbackCopy(area) {
    area.focus();
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    setMsg(ok ? 'Backup copied.' : 'Select the text above and copy it.', !ok);
  }

  function copyBackup() {
    var text = B.store.dump();
    var area = $('st-backup');
    area.value = text;
    area.classList.remove('hidden');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { setMsg('Backup copied. Keep it in a notes app.', false); },
        function () { fallbackCopy(area); }
      );
    } else {
      fallbackCopy(area);
    }
  }

  function restore() {
    var text = $('st-restore').value.trim();
    if (!text) return setMsg('Paste a backup first.', true);
    if (!window.confirm('Replace all current data with this backup?')) return;
    var err = B.store.importText(text);
    if (err) return setMsg(err, true);
    setMsg('Restored.', false);
    B.refresh();
  }

  // Reset: clears everything. Copy a backup first.
  function reset() {
    if ($('st-reset-word').value.trim() !== 'RESET') return setMsg('Type RESET to confirm.', true);
    if (!window.confirm('Delete all data? This cannot be undone.')) return;
    B.store.reset();
    $('st-reset-word').value = '';
    setMsg('All data was reset.', false);
    B.refresh();
  }

  B.registerPage({
    id: 'settings',
    get label() { return B.t('menu.settings'); },

    render: function (root) {
      var s = B.settings.get();
      var accs = B.accounts.all();
      var txCount = B.transactions.all().length;
      var trashCount = B.transactions.trashed().length;

      var accOptions = '<option value="">' + L('First account', 'প্রথম অ্যাকাউন্ট') + '</option>' + accs.map(function (a) {
        return '<option value="' + esc(a.name) + '"' + (s.defaultAccount === a.name ? ' selected' : '') + '>' + esc(a.name) + '</option>';
      }).join('');

      var langOptions = '<option value="en"' + (s.language === 'en' ? ' selected' : '') + '>English</option>' +
        '<option value="bn"' + (s.language === 'bn' ? ' selected' : '') + '>বাংলা</option>';

      var bgSwatches = B.BACKGROUNDS.map(function (id) {
        return '<button class="swatch bg-' + id + (s.background === id ? ' sel' : '') + '" data-bg="' + id + '">' +
          esc(t('bg.' + id)) + '</button>';
      }).join('');

      root.innerHTML =
        '<div class="card"><h2>' + t('settings.language') + '</h2>' +
          '<select id="st-lang">' + langOptions + '</select></div>' +
        '<div class="card"><h2>' + t('settings.background') + '</h2><div class="swatches">' + bgSwatches + '</div></div>' +
        '<div class="card"><h2>' + t('settings.entry') + '</h2>' +
          '<button class="nav-row" data-open="categories"><span>' + t('settings.categories') + '</span><span>' + B.categories.all().length + ' ›</span></button>' +
          '<button class="nav-row" data-open="tags"><span>' + t('settings.tags') + '</span><span>' + B.tags.all().length + ' ›</span></button>' +
          '<button class="nav-row" data-open="recurring"><span>' + L('Repeating entries', 'নিয়মিত লেনদেন') + '</span><span>' + B.recurring.all().length + ' ›</span></button>' +
          '<button class="nav-row" data-open="trash"><span>' + t('settings.trash') + '</span><span>' + trashCount + ' ›</span></button>' +
          '<div class="field" style="margin-top:6px"><label>' + t('settings.defaultAccount') + '</label>' +
            '<select id="st-acc">' + accOptions + '</select></div></div>' +
        '<div class="card"><h2>' + t('settings.look') + '</h2>' +
          toggleRow('animations', t('settings.animations'), s.animations) + '</div>' +
        '<div class="card"><h2>' + t('settings.safety') + '</h2>' +
          toggleRow('confirmDelete', t('settings.confirmDelete'), s.confirmDelete) + '</div>' +
        '<div class="card"><h2>' + L('Export', 'এক্সপোর্ট') + '</h2>' +
          '<p class="meta">' + L('Save your history as Excel, text or PDF, or save all data.',
            'ইতিহাস Excel, টেক্সট বা PDF হিসেবে, অথবা সব ডেটা সেভ করুন।') + '</p>' +
          '<button class="nav-row" data-open="export"><span>' + L('Open export', 'এক্সপোর্ট খুলুন') + '</span><span>›</span></button></div>' +
        '<div class="card"><h2>' + t('settings.backup') + '</h2>' +
          '<p class="meta">' + L('Copies every transaction, budget, goal, account, category, tag, debt and trash item as one backup.',
            'সব লেনদেন, বাজেট, লক্ষ্য, অ্যাকাউন্ট, ক্যাটাগরি, ট্যাগ, ঋণ ও ট্র্যাশ একটি ব্যাকআপ হিসেবে কপি হবে।') + '</p>' +
          '<button class="primary" id="st-copy">' + t('settings.copy') + '</button>' +
          '<textarea id="st-backup" class="area hidden" readonly></textarea>' +
          '<h2 style="margin-top:14px">' + t('settings.restore') + '</h2>' +
          '<textarea id="st-restore" class="area" placeholder="Paste backup here"></textarea>' +
          '<button class="ghost wide" id="st-restore-btn">' + t('settings.restoreBtn') + '</button></div>' +
        '<div class="card danger-card"><h2>' + t('settings.reset') + '</h2>' +
          '<p class="meta">' + L('Deletes everything in the app. Copy a backup first. Type RESET to continue.',
            'অ্যাপের সব ডেটা মুছে যাবে। আগে ব্যাকআপ কপি করুন। চালিয়ে যেতে RESET লিখুন।') + '</p>' +
          '<input id="st-reset-word" placeholder="RESET">' +
          '<button class="danger-btn" id="st-reset-btn">' + t('settings.resetBtn') + '</button></div>' +
        '<div class="card"><h2>' + t('settings.about') + '</h2>' +
          '<p class="meta">Budget · ' + txCount + ' transactions</p></div>' +
        '<p id="st-msg" class="msg' + (message && !isError ? ' ok' : '') + '">' + esc(message) + '</p>';

      root.onclick = function (e) {
        var el;
        if ((el = e.target.closest('[data-bg]'))) {
          B.settings.set('background', el.getAttribute('data-bg'));
          return B.refresh();
        }
        if ((el = e.target.closest('[data-toggle]'))) {
          var key = el.getAttribute('data-toggle');
          B.settings.set(key, !B.settings.get()[key]);
          setMsg('Saved.', false);
          return B.refresh();
        }
        if ((el = e.target.closest('[data-open]'))) {
          var which = el.getAttribute('data-open');
          if (which === 'export') return B.openExport();
          if (which === 'categories') return B.openCategoryManager();
          if (which === 'recurring') return B.openRecurringManager();
          if (which === 'tags') { tagEdit = null; panelMsg = ''; B.panel.open(t('settings.tags'), renderTagsPanel); }
          if (which === 'trash') return B.navigate('trash');
          return;
        }
        if (e.target.closest('#st-copy')) return copyBackup();
        if (e.target.closest('#st-restore-btn')) return restore();
        if (e.target.closest('#st-reset-btn')) return reset();
      };

      root.onchange = function (e) {
        if (e.target.id === 'st-lang') {
          B.settings.set('language', e.target.value);
          return B.refresh();
        }
        if (e.target.id === 'st-acc') {
          B.settings.set('defaultAccount', e.target.value || null);
          return setMsg('Default account saved.', false);
        }
      };
    }
  });
})();
