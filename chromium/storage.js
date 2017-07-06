const storage = chrome.storage.local;
if (chrome.storage.sync) {
  storage = chrome.storage.sync;
}
if (typeof exports !== 'undefined') {
  exports = storage;
}
