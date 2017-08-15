document.addEventListener("DOMContentLoaded", function () {
  // auto-translate all elements with i18n attributes
  var elem = document.querySelectorAll("[i18n]");
  for (let el of elem) {
    el.innerHTML = chrome.i18n.getMessage(el.getAttribute("i18n"));
  }

  // other translations
  e("aboutTitle").setAttribute("title", chrome.i18n.getMessage("about_title"));
  e("add-rule-link").addEventListener("click", addManualRule);
});
