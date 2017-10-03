"use strict";

(function(exports) {

let ls;

try{
  ls = localStorage;
} catch(e) {
  ls = {setItem: () => {}, getItem: () => {}};
}

function setStorage(store) {
  Object.assign(exports, {
    get: store.get,
    set: store.set,
    localStorage: ls
  });
}

if (chrome.storage.sync) {
  chrome.storage.sync.set({"sync-set-test": true}, () => {
    if(chrome.runtime.lastError){
      setStorage(chrome.storage.local);
    } else {
      setStorage(chrome.storage.sync);
    }
    background.initialize();
  });
} else {
  setStorage(chrome.storage.local);
  background.initialize();
}

})(typeof exports == 'undefined' ? window.store = {} : exports);
