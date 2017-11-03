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

function get_promise(key, default_val) {
  return new Promise(res => exports.get({[key]: default_val}, data => res(data[key])));
}

function set_promise(key, value) {
  return new Promise(res => exports.set({[key]: value}, res));
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

function setStorage(store) {
  Object.assign(exports, {
    get: store.get,
    set: store.set,
    get_promise,
    set_promise
  });
}

Object.assign(exports, {
  initialize,
  performMigrations
});

})(typeof exports == 'undefined' ? require.scopes.store = {} : exports);
