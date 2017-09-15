(function(exports) {

Object.assign(exports, {
  get: chrome.storage.local.get,
  set: chrome.storage.local.set,
});

if (chrome.storage.sync) {
  chrome.storage.sync.set({"sync-set-test": true}, () => {
    if(!chrome.runtime.lastError){

      Object.assign(exports, {
        get: chrome.storage.sync.get,
        set: chrome.storage.sync.set,
      });

      background.initializeStoredGlobals();
    }
  });
}

})(typeof exports == 'undefined' ? window.storage = {} : exports);
