/* global pako */

"use strict";

let combined_update_channels, extension_version;
const { update_channels } = require('./update_channels');

// Determine if we're in the tests.  If so, define some necessary components.
if (typeof window === "undefined") {
  var WebCrypto = require("node-webcrypto-ossl"),
    crypto = new WebCrypto(),
    atob = require("atob"),
    btoa = require("btoa"),
    pako = require('../external/pako-1.0.5/pako_inflate.min.js'),
    { TextDecoder } = require('text-encoding'),
    chrome = require("sinon-chrome"),
    window = { atob, btoa, chrome, crypto, pako, TextDecoder },
    fs = require('fs');

  extension_version = JSON.parse(fs.readFileSync('./manifest.json')).version;

  combined_update_channels = update_channels;
} else {
  extension_version = chrome.runtime.getManifest().version;
}

(function(exports) {

const util = require('./util');

let store,
  background_callback;

// how often we should check for new rulesets
const periodicity = 86400;

const extension_date = new Date(extension_version.split('.').slice(0,3).join('-'));
const extension_timestamp = extension_date.getTime() / 1000;

let imported_keys;

// update channels are loaded from `background-scripts/update_channels.js` as well as the storage api
async function loadUpdateChannelsKeys() {
  util.log(util.NOTE, 'Loading update channels and importing associated public keys.');

  const stored_update_channels = await store.get_promise('update_channels', []);
  const combined_update_channels_preflight = update_channels.concat(stored_update_channels);

  imported_keys = {};
  combined_update_channels = [];

  for(let update_channel of combined_update_channels_preflight) {

    try{
      imported_keys[update_channel.name] = await window.crypto.subtle.importKey(
        "jwk",
        update_channel.jwk,
        {
          name: "RSA-PSS",
          hash: {name: "SHA-256"},
        },
        false,
        ["verify"]
      );
      combined_update_channels.push(update_channel);
      util.log(util.NOTE, update_channel.name + ': Update channel key loaded.');
    } catch(err) {
      util.log(util.WARN, update_channel.name + ': Could not import key.  Aborting.');
    }
  }
}


// Determine the time until we should check for new rulesets
async function timeToNextCheck() {
  const last_checked = await store.local.get_promise('last-checked', false);
  if(last_checked) {
    const current_timestamp = Date.now() / 1000;
    const secs_since_last_checked = current_timestamp - last_checked;
    return Math.max(0, periodicity - secs_since_last_checked);
  } else {
    return 0;
  }
}

// Check for new rulesets immediately
async function resetTimer() {
  await store.local.set_promise('last-checked', false);
  destroyTimer();
  await createTimer();
}

// Check for new rulesets. If found, return the timestamp. If not, return false
async function checkForNewRulesets(update_channel) {
  let timestamp_result = await fetch(update_channel.update_path_prefix + "/latest-rulesets-timestamp");
  if(timestamp_result.status == 200) {
    let rulesets_timestamp = Number(await timestamp_result.text());

    if((await store.local.get_promise('rulesets-timestamp: ' + update_channel.name, 0)) < rulesets_timestamp) {
      return rulesets_timestamp;
    }
  }
  return false;
}

// Retrieve the timestamp for when a stored ruleset bundle was published
async function getRulesetTimestamps() {
  let timestamp_promises = [];
  for(let update_channel of combined_update_channels) {
    timestamp_promises.push(new Promise(async resolve => {
      let timestamp = await store.local.get_promise('rulesets-stored-timestamp: ' + update_channel.name, 0);
      resolve([update_channel, timestamp]);
    }));
  }
  let timestamps = await Promise.all(timestamp_promises);
  return timestamps;
}

// Download and return new rulesets
async function getNewRulesets(rulesets_timestamp, update_channel) {

  store.local.set_promise('rulesets-timestamp: ' + update_channel.name, rulesets_timestamp);

  let signature_promise = fetch(update_channel.update_path_prefix + "/rulesets-signature." + rulesets_timestamp + ".sha256");
  let rulesets_promise = fetch(update_channel.update_path_prefix + "/default.rulesets." + rulesets_timestamp + ".gz");

  let responses = await Promise.all([
    signature_promise,
    rulesets_promise
  ]);

  let resolutions = await Promise.all([
    responses[0].arrayBuffer(),
    responses[1].arrayBuffer()
  ]);

  return {
    signature_array_buffer: resolutions[0],
    rulesets_array_buffer: resolutions[1]
  };
}

// Returns a promise which verifies that the rulesets have a valid EFF
// signature, and if so, stores them and returns true.
// Otherwise, it throws an exception.
function verifyAndStoreNewRulesets(new_rulesets, rulesets_timestamp, update_channel) {
  return new Promise((resolve, reject) => {
    window.crypto.subtle.verify(
      {
        name: "RSA-PSS",
        saltLength: 32
      },
      imported_keys[update_channel.name],
      new_rulesets.signature_array_buffer,
      new_rulesets.rulesets_array_buffer
    ).then(async isvalid => {
      if(isvalid) {
        util.log(util.NOTE, update_channel.name + ': Downloaded ruleset signature checks out.  Storing rulesets.');

        const rulesets_gz = util.ArrayBufferToString(new_rulesets.rulesets_array_buffer);
        const rulesets_byte_array = pako.inflate(rulesets_gz);
        const rulesets = new TextDecoder("utf-8").decode(rulesets_byte_array);
        const rulesets_json = JSON.parse(rulesets);

        if(rulesets_json.timestamp != rulesets_timestamp) {
          reject(update_channel.name + ': Downloaded ruleset had an incorrect timestamp.  This may be an attempted downgrade attack.  Aborting.');
        } else {
          await store.local.set_promise('rulesets: ' + update_channel.name, window.btoa(rulesets_gz));
          resolve(true);
        }
      } else {
        reject(update_channel.name + ': Downloaded ruleset signature is invalid.  Aborting.');
      }
    }).catch(() => {
      reject(update_channel.name + ': Downloaded ruleset signature could not be verified.  Aborting.');
    });
  });
}

// Unzip and apply the rulesets we have stored.
async function applyStoredRulesets(rulesets_obj) {
  let rulesets_promises = [];
  for(let update_channel of combined_update_channels) {
    rulesets_promises.push(new Promise(resolve => {
      const key = 'rulesets: ' + update_channel.name;
      chrome.storage.local.get(key, root => {
        if(root[key]) {
          util.log(util.NOTE, update_channel.name + ': Applying stored rulesets.');

          const rulesets_gz = window.atob(root[key]);
          const rulesets_byte_array = pako.inflate(rulesets_gz);
          const rulesets_string = new TextDecoder("utf-8").decode(rulesets_byte_array);
          const rulesets_json = JSON.parse(rulesets_string);

          resolve({json: rulesets_json, scope: update_channel.scope, replaces: update_channel.replaces_default_rulesets});
        } else {
          resolve();
        }
      });
    }));
  }

  function isNotUndefined(subject) {
    return (typeof subject != 'undefined');
  }

  const channel_results = (await Promise.all(rulesets_promises)).filter(isNotUndefined);

  let replaces = false;
  for(const channel_result of channel_results) {
    if(channel_result.replaces === true) {
      replaces = true;
    }
    rulesets_obj.addFromJson(channel_result.json.rulesets, channel_result.scope);
  }

  if(!replaces) {
    rulesets_obj.addFromJson(util.loadExtensionFile('rules/default.rulesets', 'json'));
  }
}

// basic workflow for periodic checks
async function performCheck() {
  util.log(util.NOTE, 'Checking for new rulesets.');

  const current_timestamp = Date.now() / 1000;
  store.local.set_promise('last-checked', current_timestamp);

  let num_updates = 0;
  for(let update_channel of combined_update_channels) {
    let new_rulesets_timestamp = await checkForNewRulesets(update_channel);
    if(new_rulesets_timestamp) {

      if(update_channel.replaces_default_rulesets && extension_timestamp > new_rulesets_timestamp) {
        util.log(util.NOTE, update_channel.name + ': A new ruleset bundle has been released, but it is older than the extension-bundled rulesets it replaces.  Skipping.');
        continue;
      }

      util.log(util.NOTE, update_channel.name + ': A new ruleset bundle has been released.  Downloading now.');
      let new_rulesets = await getNewRulesets(new_rulesets_timestamp, update_channel);
      try{
        await verifyAndStoreNewRulesets(new_rulesets, new_rulesets_timestamp, update_channel);
        store.local.set_promise('rulesets-stored-timestamp: ' + update_channel.name, new_rulesets_timestamp);
        num_updates++;
      } catch(err) {
        util.log(util.WARN, update_channel.name + ': ' + err);
      }
    }
  }
  if(num_updates > 0) {
    background_callback();
  }
};

async function storageListener(changes, areaName) {
  if (areaName === 'sync' || areaName === 'local') {
    if ('autoUpdateRulesets' in changes) {
      if (changes.autoUpdateRulesets.newValue) {
        await createTimer();
      } else {
        destroyTimer();
      }
    }
  }

  if ('update_channels' in changes) {
    await loadUpdateChannelsKeys();
  }
};

function addStorageListener() {
  chrome.storage.onChanged.addListener(storageListener);
}

function removeStorageListener() {
  chrome.storage.onChanged.removeListener(storageListener);
}

addStorageListener();

let initialCheck,
  subsequentChecks;

async function createTimer() {
  const time_to_next_check = await timeToNextCheck();

  initialCheck = setTimeout(() => {
    performCheck();
    subsequentChecks = setInterval(performCheck, periodicity * 1000);
  }, time_to_next_check * 1000);
}

function destroyTimer() {
  if (initialCheck) {
    clearTimeout(initialCheck);
  }
  if (subsequentChecks) {
    clearInterval(subsequentChecks);
  }
}

function clear_replacement_update_channels() {
  let keys = [];
  for (const update_channel of combined_update_channels) {
    if(update_channel.replaces_default_rulesets) {
      util.log(util.NOTE, update_channel.name + ': You have a new version of the extension.  Clearing any stored rulesets, which replace the new extension-bundled ones.');
      keys.push('rulesets-timestamp: ' + update_channel.name);
      keys.push('rulesets-stored-timestamp: ' + update_channel.name);
      keys.push('rulesets: ' + update_channel.name);
    }
  }

  return new Promise(resolve => {
    chrome.storage.local.remove(keys, resolve);
  });
}

async function initialize(store_param, cb) {
  store = store_param;
  background_callback = cb;

  await loadUpdateChannelsKeys();

  if (await store.local.get_promise('extensionTimestamp', 0) !== extension_timestamp) {
    await clear_replacement_update_channels();
    await store.local.set_promise('extensionTimestamp', extension_timestamp);
  }

  if (await store.get_promise('autoUpdateRulesets', true)) {
    await createTimer();
  }
}

Object.assign(exports, {
  applyStoredRulesets,
  initialize,
  getRulesetTimestamps,
  resetTimer,
  loadUpdateChannelsKeys,
  addStorageListener,
  removeStorageListener,
});

})(typeof exports == 'undefined' ? require.scopes.update = {} : exports);
