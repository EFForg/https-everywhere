document.addEventListener("DOMContentLoaded", function () {
  // auto-translate all elements with i18n attributes
  var elem = document.querySelectorAll("[i18n]");
  for (let el of elem) {
    el.innerText = chrome.i18n.getMessage(el.getAttribute("i18n"));
  }
});
