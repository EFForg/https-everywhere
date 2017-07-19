'use strict';
(function() {
  const storage = chrome.storage.sync ? chrome.storage.sync : chrome.storage.local;

  if (typeof window !== 'undefined') {
    window.storage = storage;
  }

  if (typeof exports !== 'undefined') {
    exports = storage;
  }
})();
