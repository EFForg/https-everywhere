"use strict";

(function(exports) {

const rules = require('./rules');
const util = require("./util");

function initialize() {
  return new Promise(resolve => {
    if (chrome.storage.sync) {
      chrome.storage.sync.set({"sync-set-test": true}, () => {
        if(chrome.runtime.lastError) {
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
  let migration_version = await get_promise('migration_version', 0);

  try {
    if (migration_version === 0) {
      let ls = localStorage;
      let ruleActiveStates = {};

      for (let key in ls) {
        if (ls.hasOwnProperty(key)) {
          if (rules.RuleSets().USER_RULE_KEY === key) {
            await set_promise(rules.RuleSets().USER_RULE_KEY, JSON.parse(ls[key]));
          } else {
            ruleActiveStates[key] = (ls[key] === "true");
          }
        }
      }
      migration_version = 1;
      await set_promise('migration_version', migration_version);
      await set_promise('ruleActiveStates', ruleActiveStates);
    }

  } catch (e) {
    // do nothing
  }

  if (migration_version <= 1) {
    await get_promise(rules.RuleSets().USER_RULE_KEY, [])
      .then(userRules => {
        userRules = userRules.map(userRule => {
          return {
            name: userRule.host,
            target: [userRule.host],
            rule: [{ from: userRule.urlMatcher, to: userRule.redirectTo }],
            default_off: "user rule"
          };
        });
        return userRules;
      })
      .then(userRules => {
        return set_promise(rules.RuleSets().USER_RULE_KEY, userRules);
      });

    migration_version = 2;
    await set_promise('migration_version', migration_version);
  }

  if (migration_version <= 2) {
    await get_promise('disabledList', [])
      .then(disabledList => {
        disabledList = disabledList.map(item => {
          return util.getNormalisedHostname(item);
        });
        return disabledList;
      })
      .then(disabledList => {
        return set_promise('disabledList', disabledList);
      });

    migration_version = 3;
    await set_promise('migration_version', migration_version);
  }
}

const local = {
  get: (...args) => chrome.storage.local.get(...args),
  set: (...args) => chrome.storage.local.set(...args),
  remove: (...args) => chrome.storage.local.remove(...args),
  get_promise: local_get_promise,
  set_promise: local_set_promise
};

function setStorage(store) {
  Object.assign(exports, {
    get: store.get.bind(store),
    set: store.set.bind(store),
    remove: store.remove.bind(store),
    get_promise,
    set_promise,
    local
  });
  chrome.runtime.sendMessage("store_initialized");
}

Object.assign(exports, {
  initialize,
  performMigrations
});

})(typeof exports == 'undefined' ? require.scopes.store = {} : exports);
