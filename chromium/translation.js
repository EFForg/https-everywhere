'use strict'

document.addEventListener('DOMContentLoaded', () => {
  // auto-translate all elements with data-i18n attributes
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.innerText = chrome.i18n.getMessage(el.getAttribute('data-i18n'))
  }
})
