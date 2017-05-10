var storage = chrome.storage.local;
if (chrome.storage.sync) {
  chrome.storage.sync.set({"sync-set-test": true}, () => {
    if(!chrome.runtime.lastError){
      storage = chrome.storage.sync;
    }
  });
}
if (typeof exports != 'undefined') {
  exports = storage;
}
