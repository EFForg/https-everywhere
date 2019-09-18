"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Auto-translate all elements with data-i18n attributes
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.innerText = chrome.i18n.getMessage(element.getAttribute("data-i18n")).replace(/&quot;/g,"\"");
  }
});
