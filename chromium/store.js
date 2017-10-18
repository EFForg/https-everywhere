"use strict";

(function(exports) {

let ls;

try {
  ls = localStorage;
} catch(e) {
  ls = {setItem: () => {}, getItem: () => {}};
}

function initialize() {
  return new Promise(resolve => {
    if (chrome.storage.sync) {
      chrome.storage.sync.set({"sync-set-test": true}, () => {
        if(chrome.runtime.lastError){
          setStorage(chrome.storage.local);
        } else {
          setStorage(chrome.storage.sync);
        }
        resolve();
      });
    } else {
      setStorage(chrome.storage.local);
      resolve();
    }
  });
}

function setStorage(store) {
  Object.assign(exports, {
    get: store.get,
    set: store.set,
    localStorage: ls,
    initialize
  });
}

Object.assign(exports, {
  initialize
});

})(typeof exports == 'undefined' ? require.scopes.store = {} : exports);
