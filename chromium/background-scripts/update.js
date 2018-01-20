/* global update_channels */
/* global pako */

"use strict";

(function(exports) {

const util = require('./util');
let store,
  background_callback;

// how often we should check for new rulesets
const periodicity = 10;

// jwk key loaded from keys.js
let imported_keys = {};
for(let update_channel of update_channels){
  imported_keys[update_channel.name] = window.crypto.subtle.importKey(
    "jwk",
    update_channel.jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: {name: "SHA-256"},
    },
    false,
    ["verify"]
  );
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

// Generic ajax promise
function xhr_promise(url){
  return new Promise((resolve) => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function(){
      if(this.readyState == 4 && this.status == 200) {
        resolve(this.response);
      }
    }
    xhr.responseType = "text";
    xhr.send(null);
  });
}

// Check for new rulesets. If found, return the timestamp. If not, return false
async function checkForNewRulesets(update_channel) {

  let timestamp_promise = xhr_promise(update_channel.update_path_prefix + "/rulesets-timestamp");
  let rulesets_timestamp = Number(await timestamp_promise);
  if((await store.local.get_promise('rulesets-timestamp: ' + update_channel.name, 0)) < rulesets_timestamp){
    return rulesets_timestamp;
  } else {
    return false;
  }
}

// Download and return new rulesets
async function getNewRulesets(rulesets_timestamp, update_channel) {

  store.local.set_promise('rulesets-timestamp: ' + update_channel.name, rulesets_timestamp);

  let signature_promise = xhr_promise(update_channel.update_path_prefix + "/rulesets-signature.sha256.base64");
  let rulesets_promise = xhr_promise(update_channel.update_path_prefix + "/default.rulesets.gz.base64");

  let resolutions = await Promise.all([
    signature_promise,
    rulesets_promise
  ]);

  return {
    signature_byte_array: util.base64ToUint8Array(resolutions[0]),
    rulesets_byte_array: util.stringToUint8Array(resolutions[1]),
    rulesets_gz_base64: resolutions[1]
  };
}

// Returns a promise which verifies that the rulesets have a valid EFF
// signature, and if so, stores them and returns true.
// Otherwise, it throws an exception.
function verifyAndStoreNewRulesets(new_rulesets, update_channel){
  return new Promise((resolve, reject) => {
    imported_keys[update_channel.name].then(publicKey => {
      window.crypto.subtle.verify(
        {
          name: "RSASSA-PKCS1-v1_5",
        },
        publicKey,
        new_rulesets.signature_byte_array.buffer,
        new_rulesets.rulesets_byte_array.buffer
      ).then(async isvalid => {
        if(isvalid) {
          util.log(util.NOTE, update_channel.name + ': Downloaded ruleset signature checks out.  Storing rulesets.');
          await store.local.set_promise('rulesets: ' + update_channel.name, new_rulesets.rulesets_gz_base64);
          resolve(true);
        } else {
          reject('Downloaded ruleset signature is invalid.  Aborting.');
        }
      }).catch(() => {
        reject('Downloaded ruleset signature could not be verified.  Aborting.');
      });
    }).catch(() => {
      reject('Downloaded ruleset signature could not be verified.  Aborting.');
    });
  });
}

// Base64 decode, unzip, and apply the rulesets we have stored.
async function applyStoredRulesets(rulesets_obj){
  let rulesets_promises = [];
  for(let update_channel of update_channels){
    rulesets_promises.push(new Promise(resolve => {
      const key = 'rulesets: ' + update_channel.name
      chrome.storage.local.get(key, root => {
        if(root[key]){
          util.log(util.NOTE, update_channel.name + ': Applying stored rulesets.');

          const rulesets_gz = window.atob(root[key]);
          const rulesets_byte_array = pako.inflate(rulesets_gz);
          const rulesets = new TextDecoder("utf-8").decode(rulesets_byte_array);
          const rulesets_json = JSON.parse(rulesets);

          resolve(rulesets_json);
        } else {
          resolve();
        }
      });
    }));
  }

  const rulesets_jsons = await Promise.all(rulesets_promises);
  if(rulesets_jsons.join("").length > 0){
    for(let rulesets_json of rulesets_jsons){
      rulesets_obj.addFromJson(rulesets_json);
    }
  } else {
    rulesets_obj.addFromJson(util.loadExtensionFile('rules/default.rulesets', 'json'));
  }
}

// basic workflow for periodic checks
async function performCheck() {
  util.log(util.NOTE, 'Checking for new rulesets.');

  const current_timestamp = Date.now() / 1000;
  store.local.set_promise('last-checked', current_timestamp);

  let num_updates = 0;
  for(let update_channel of update_channels){
    let new_rulesets_timestamp = await checkForNewRulesets(update_channel);
    if(new_rulesets_timestamp){
      util.log(util.NOTE, update_channel.name + ': A new ruleset bundle has been released.  Downloading now.');
      let new_rulesets = await getNewRulesets(new_rulesets_timestamp, update_channel);
      try{
        await verifyAndStoreNewRulesets(new_rulesets, update_channel);
        num_updates++;
      } catch(err) {
        util.log(util.WARN, update_channel.name + ': ' + err);
      }
    }
  }
  if(num_updates > 0){
    background_callback();
  }
};

chrome.storage.onChanged.addListener(async function(changes, areaName) {
  if (areaName === 'sync' || areaName === 'local') {
    if ('autoUpdateRulesets' in changes) {
      if (changes.autoUpdateRulesets.newValue) {
        await createTimer();
      } else {
        destroyTimer();
      }
    }
  }
});

let initialCheck,
  subsequentChecks;

async function createTimer(){
  const time_to_next_check = await timeToNextCheck();

  initialCheck = setTimeout(() => {
    performCheck();
    subsequentChecks = setInterval(performCheck, periodicity * 1000);
  }, time_to_next_check * 1000);
}

function destroyTimer(){
  if (initialCheck) {
    clearTimeout(initialCheck);
  }
  if (subsequentChecks) {
    clearInterval(subsequentChecks);
  }
}

async function initialize(store_param, cb){
  store = store_param;
  background_callback = cb;

  if (await store.get_promise('autoUpdateRulesets', true)) {
    await createTimer();
  }
}

Object.assign(exports, {
  applyStoredRulesets,
  initialize
});

})(typeof exports == 'undefined' ? require.scopes.update = {} : exports);
