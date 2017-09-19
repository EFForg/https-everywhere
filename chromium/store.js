"use strict";

(function(global) {

  function resolveModule (name) {
    if (typeof require === 'function') {
      return require('./' + name)
    }

    if (global[name]) {
      return global[name]
    }

    throw new Error(`Can't find module ${name}.`)
  }

  function getExports (name) {
    return global.module && global.module.exports || (global[name] = {})
  }

  const exports = getExports('store')

  const background = resolveModule('background')

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
