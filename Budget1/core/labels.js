(function () {
  var B = window.Budget;

  // Labels for the debt and loan types, and the menu name. These are added on top of core/i18n.js.
  var EXTRA = {
    en: {
      'type.loan_received': 'Debt taken',
      'type.loan_repaid': 'Debt paid',
      'type.loan_given': 'Loan given',
      'type.loan_collected': 'Loan collected',
      'menu.loans': 'Loan & Debt'
    },
    bn: {
      'type.loan_received': 'দেনা নেওয়া',
      'type.loan_repaid': 'দেনা শোধ',
      'type.loan_given': 'ধার দেওয়া',
      'type.loan_collected': 'ধার আদায়',
      'menu.loans': 'ঋণ ও দেনা'
    }
  };

  var original = B.t;
  B.t = function (key) {
    var lang = B.settings.get().language === 'bn' ? 'bn' : 'en';
    if (EXTRA[lang][key] !== undefined) return EXTRA[lang][key];
    return original(key);
  };
})();