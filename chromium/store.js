"use strict";

(function() {

function _getExports (name) {
  return global.module && global.module.exports || (global[name] = {})
}

const exports = _getExports('store')

function setStorage(store) {
  Object.assign(exports, {
    get: store.get,
    set: store.set,
  });
}

setStorage(chrome.storage.local);
if (chrome.storage.sync) {
  chrome.storage.sync.set({"sync-set-test": true}, () => {
    if(!chrome.runtime.lastError){
      setStorage(chrome.storage.sync);
      background.initializeStoredGlobals();
    }
  });
}

})(this);
