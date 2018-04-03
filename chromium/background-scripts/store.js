"use strict";

(function(exports) {

const rules = require('./rules');

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

/* Storage promise setters and getters */

function generic_get_promise(key, default_val, storage) {
  return new Promise(res => storage.get({[key]: default_val}, data => res(data[key])));
}

function generic_set_promise(key, value, storage) {
  return new Promise(res => storage.set({[key]: value}, res));
}

function get_promise(key, default_val) {
  return generic_get_promise(key, default_val, exports);
}

function set_promise(key, value) {
  return generic_set_promise(key, value, exports);
}

function local_get_promise(key, default_val) {
  return generic_get_promise(key, default_val, chrome.storage.local);
}

function local_set_promise(key, value) {
  return generic_set_promise(key, value, chrome.storage.local);
}



async function performMigrations() {
  const migration_version = await get_promise('migration_version', 0);

  if (migration_version < 1) {

    let ls;
    try {
      ls = localStorage;
    } catch(e) {}

    let ruleActiveStates = {};
    for (const key in ls) {
      if (ls.hasOwnProperty(key)) {
        if (key == rules.RuleSets().USER_RULE_KEY){
          await set_promise(rules.RuleSets().USER_RULE_KEY, JSON.parse(ls[key]));
        } else {
          ruleActiveStates[key] = (ls[key] == "true");
        }
      }
    }
    await set_promise('ruleActiveStates', ruleActiveStates);
  }

  await set_promise('migration_version', 1);
}

const local = {
  get: chrome.storage.local.get,
  set: chrome.storage.local.set,
  get_promise: local_get_promise,
  set_promise: local_set_promise
};

function setStorage(store) {
  Object.assign(exports, {
    get: store.get.bind(store),
    set: store.set.bind(store),
    get_promise,
    set_promise,
    local
  });
}

Object.assign(exports, {
  initialize,
  performMigrations
});

})(typeof exports == 'undefined' ? require.scopes.store = {} : exports);
