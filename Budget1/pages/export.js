(function () {
  var B = window.Budget;
  var mode = null;   // null = format menu. Otherwise the chosen format key.

  function L(en, bn) { return B.L(en, bn); }
  function esc(s) { return B.esc(s); }
  function $(id) { return document.getElementById(id); }

  // ---------- Rows: the same entries the History page shows, newest first ----------

  function rows() {
    return B.sortNewest(B.transactions.all()).map(function (t) {
      var type = B.txType(t);
      return {
        date: B.dates.toDisplay(t.date),
        type: B.types[type].label,
        amountPlain: (t.amount / 100).toFixed(2),
        amount: B.money.format(t.amount),
        route: B.txRoute(t),
        category: (type === 'income' || type === 'expense') ? B.txCategory(t) : '',
        person: t.person || '',
        tags: B.txTags(t).join(', '),
        note: t.note || '',
        edits: String(t.editCount || 0),
        editedOn: t.editedAt ? B.dates.toDisplay(t.editedAt.slice(0, 10)) : ''
      };
    });
  }

  var HEAD = ['Date', 'Type', 'Amount', 'From to To', 'Category', 'Person', 'Tags', 'Note', 'Edits', 'Edited on'];

  function cells(r) {
    return [r.date, r.type, r.amountPlain, r.route, r.category, r.person, r.tags, r.note, r.edits, r.editedOn];
  }

  // ---------- CSV (opens in Excel and Google Sheets) ----------

  function csvField(v) {
    return '"' + String(v).replace(/"/g, '""') + '"';
  }

  // A byte-order mark first, so Excel reads Bengali text correctly.
  function asCsv() {
    var lines = [HEAD.map(csvField).join(',')];
    rows().forEach(function (r) { lines.push(cells(r).map(csvField).join(',')); });
    return '\uFEFF' + lines.join('\r\n');
  }

  // ---------- Plain text ----------

  function asText() {
    var lines = [L('Budget history', 'বাজেট ইতিহাস'), ''];
    rows().forEach(function (r) {
      lines.push(r.date + '  ' + r.type + '  ' + r.amount + '  ' + r.route +
        (r.category ? '  [' + r.category + ']' : '') +
        (r.person ? '  ' + r.person : '') +
        (r.tags ? '  #' + r.tags.replace(/,\s*/g, ' #') : '') +
        (r.note ? '  - ' + r.note : '') +
        (r.edits !== '0' ? '  (edited ' + r.edits + 'x' + (r.editedOn ? ', ' + r.editedOn : '') + ')' : ''));
    });
    return lines.join('\r\n');
  }

  // ---------- PDF (built directly; text is ASCII, so each character is one byte) ----------

  function pdfText(s) {
    return String(s).replace(/৳/g, 'BDT ').replace(/[^\x20-\x7E]/g, '?');
  }

  function pdfEscape(s) {
    return pdfText(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function col(s, w) {
    var v = pdfText(s);
    if (v.length > w) v = v.slice(0, w - 1) + '~';
    while (v.length < w) v += ' ';
    return v;
  }

  function pdfLines() {
    var out = [
      L('Budget history', 'বাজেট ইতিহাস') + '  -  ' + B.dates.toDisplay(B.dates.today()),
      '',
      col('Date', 10) + col('Type', 12) + col('Amount', 14) + col('From to To', 22) + col('Category', 12) + col('Note', 30)
    ];
    rows().forEach(function (r) {
      out.push(col(r.date, 10) + col(r.type, 12) + col(r.amount.replace('৳ ', 'BDT '), 14) +
        col(r.route, 22) + col(r.category, 12) + col(r.note + (r.person ? ' ' + r.person : ''), 30));
    });
    return out;
  }

  function asPdf() {
    var lines = pdfLines();
    var perPage = 62;
    var pages = [];
    for (var i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
    if (!pages.length) pages.push(['(no entries)']);

    var objs = [];
    var pageIds = [], contentIds = [];
    var nextId = 4;
    pages.forEach(function () {
      pageIds.push(nextId);
      contentIds.push(nextId + 1);
      nextId += 2;
    });

    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') +
      '] /Count ' + pages.length + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';

    pages.forEach(function (pageLines, idx) {
      var stream = 'BT /F1 8 Tf 36 806 Td 10 TL\n';
      pageLines.forEach(function (ln) { stream += '(' + pdfEscape(ln) + ') Tj T*\n'; });
      stream += 'ET';
      objs[contentIds[idx]] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
      objs[pageIds[idx]] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
        '/Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentIds[idx] + ' 0 R >>';
    });

    var out = '%PDF-1.4\n';
    var offsets = [];
    for (var k = 1; k < objs.length; k++) {
      offsets[k] = out.length;
      out += k + ' 0 obj\n' + objs[k] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (var j = 1; j < objs.length; j++) {
      out += ('0000000000' + offsets[j]).slice(-10) + ' 00000 n \n';
    }
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return out;
  }

  // ---------- Full data file ----------

  function asData() { return B.store.dump(); }

  // ---------- Formats ----------

  var FORMATS = {
    csv: {
      title: L('Excel (CSV)', 'Excel (CSV)'), file: 'csv', mime: 'text/csv;charset=utf-8',
      make: asCsv, preview: asCsv,
      hint: L('Opens in Excel and Google Sheets. Tap Download, or Copy and paste into a sheet.',
        'Excel ও Google Sheets-এ খোলা যায়। Download চাপুন, অথবা Copy করে শিটে পেস্ট করুন।')
    },
    txt: {
      title: L('Text (.txt)', 'টেক্সট (.txt)'), file: 'txt', mime: 'text/plain;charset=utf-8',
      make: asText, preview: asText,
      hint: L('A plain list you can read or print. Tap Download, or Copy and save in a notes app.',
        'পড়া ও প্রিন্টের জন্য সাধারণ তালিকা। Download চাপুন, অথবা Copy করে নোট অ্যাপে সেভ করুন।')
    },
    pdf: {
      title: L('PDF (.pdf)', 'PDF (.pdf)'), file: 'pdf', mime: 'application/pdf',
      make: asPdf, preview: asText,
      hint: L('A printable PDF file. Tap Download. Bengali names show as ? in the PDF.',
        'প্রিন্টযোগ্য PDF ফাইল। Download চাপুন। PDF-এ বাংলা নাম ? হিসেবে দেখাবে।')
    },
    data: {
      title: L('All data (.json)', 'সব ডেটা (.json)'), file: 'json', mime: 'application/json;charset=utf-8',
      make: asData, preview: asData,
      hint: L('Everything in the app in one file. Keep it as your full backup.',
        'অ্যাপের সব ডেটা একটি ফাইলে। এটি আপনার পূর্ণ ব্যাকআপ হিসেবে রাখুন।')
    }
  };

  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  // Returns true when the browser accepted the download. HopWeb may block it.
  function download(filename, mime, content) {
    try {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function fallbackCopy(area) {
    area.focus();
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    return ok;
  }

  function copyText(text, area) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return fallbackCopy(area); }
      );
    }
    return Promise.resolve(fallbackCopy(area));
  }

  function setMsg(text, ok) {
    var el = $('ex-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg' + (ok ? ' ok' : '');
  }

  // ---------- Panel screens ----------

  function renderMenu(body) {
    var count = rows().length;
    body.innerHTML =
      '<p class="meta">' + count + ' ' + L('entries', 'টি লেনদেন') + ' · ' +
        L('Choose a format, then Download the file.', 'একটি ফরম্যাট বাছুন, তারপর ফাইল ডাউনলোড করুন।') + '</p>' +
      '<div class="export-grid">' +
        '<button class="export-tile xl" data-fmt="csv"><span>📊</span><b>Excel</b><small>.csv</small></button>' +
        '<button class="export-tile tx" data-fmt="txt"><span>📝</span><b>Text</b><small>.txt</small></button>' +
        '<button class="export-tile pd" data-fmt="pdf"><span>📄</span><b>PDF</b><small>.pdf</small></button>' +
      '</div>' +
      '<button class="export-tile data-tile" data-fmt="data"><span>🗂️</span><b>' +
        L('Save all data', 'সব ডেটা সেভ') + '</b><small>.json · ' + L('full backup', 'পূর্ণ ব্যাকআপ') + '</small></button>';
  }

  function renderPreview(body, key) {
    var f = FORMATS[key];
    var text = f.preview();
    body.innerHTML =
      '<p class="meta">' + f.hint + '</p>' +
      '<textarea id="ex-area" class="area ex-area" readonly>' + esc(text.length > 20000 ? text.slice(0, 20000) + '\n…' : text) + '</textarea>' +
      '<p class="msg ok" id="ex-msg"></p>' +
      '<div class="sheet-actions">' +
        '<button class="ghost" data-exback="1">← ' + L('Back', 'ফিরে যান') + '</button>' +
        '<button class="ghost" data-copy="1">' + L('Copy', 'কপি') + '</button>' +
        '<button class="primary" data-download="1">' + L('Download', 'ডাউনলোড') + '</button>' +
      '</div>';
  }

  function paint(body) {
    if (!mode) return renderMenu(body);
    return renderPreview(body, mode);
  }

  B.openExport = function () {
    mode = null;
    B.panel.open(L('Export', 'এক্সপোর্ট'), function (body) {
      paint(body);
      body.onclick = function (e) {
        var el;
        if ((el = e.target.closest('[data-fmt]'))) {
          mode = el.getAttribute('data-fmt');
          return B.panel.refresh();
        }
        if (e.target.closest('[data-exback]')) {
          mode = null;
          return B.panel.refresh();
        }
        if (e.target.closest('[data-download]')) {
          var f = FORMATS[mode];
          var content = f.make();
          var name = 'budget-' + (mode === 'data' ? 'data' : 'history') + '-' + stamp() + '.' + f.file;
          var ok = download(name, f.mime, content);
          setMsg(ok
            ? L('Download started: ' + name + '. Check your Downloads folder.', 'ডাউনলোড শুরু হয়েছে: ' + name + '। Downloads ফোল্ডার দেখুন।')
            : L('Download is blocked in this app. Tap Copy and save the text in a notes app instead.',
                'এই অ্যাপে ডাউনলোড বন্ধ। Copy চাপুন, তারপর নোট অ্যাপে সেভ করুন।'), ok);
          return;
        }
        if (e.target.closest('[data-copy]')) {
          var text = FORMATS[mode].preview();
          copyText(text, $('ex-area')).then(function (done) {
            setMsg(done ? L('Copied.', 'কপি হয়েছে।') : L('Select the text and copy it.', 'লেখাটি সিলেক্ট করে কপি করুন।'), done);
          });
        }
      };
    });
  };
})();
