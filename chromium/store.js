import { initializeStoredGlobals } from './background.js'

export const store = {};

function setStorage(newStore) {
  Object.assign(store, {
    get: newStore.get,
    set: newStore.set,
  });
}

setStorage(chrome.storage.local);

if (chrome.storage.sync) {
  chrome.storage.sync.set({"sync-set-test": true}, () => {
    if(!chrome.runtime.lastError){
      setStorage(chrome.storage.sync);
      initializeStoredGlobals();
    }
  });
}
