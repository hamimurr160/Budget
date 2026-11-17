(function () {
  var B = window.Budget;
  // Asia/Dhaka is UTC+6 all year (no daylight saving), so a fixed offset is exact.
  var BD_OFFSET_MS = 6 * 3600000;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Bilingual helper: English or Bengali text, following the Language setting.
  function L(en, bn) {
    return B.settings.get().language === 'bn' ? bn : en;
  }

  // Current Bangladesh time, computed from the device clock.
  function bdNow() {
    var d = new Date(Date.now() + BD_OFFSET_MS);
    var h = d.getUTCHours(), m = d.getUTCMinutes();
    return {
      date: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()),
      minutes: h * 60 + m
    };
  }

  // minutes since midnight -> { h12, mm, ampm }
  function splitTime(mins) {
    var h24 = Math.floor(mins / 60);
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { h12: h12, mm: mins % 60, ampm: h24 >= 12 ? 'PM' : 'AM' };
  }

  // { h12, mm, ampm } -> minutes since midnight
  function joinTime(h12, mm, ampm) {
    return (h12 % 12 + (ampm === 'PM' ? 12 : 0)) * 60 + mm;
  }

  function formatTime(mins) {
    var p = splitTime(mins);
    return p.h12 + ':' + pad(p.mm) + ' ' + p.ampm;
  }

  function reminderMinutes() {
    var v = B.settings.get().reminderMinutes;
    return typeof v === 'number' ? v : 20 * 60; // default 8:00 PM
  }

  B.L = L;
  B.bd = {
    now: bdNow,
    splitTime: splitTime,
    joinTime: joinTime,
    formatTime: formatTime,
    reminderMinutes: reminderMinutes,
    pad: pad
  };
})();