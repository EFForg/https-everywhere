"use strict";

(function(exports) {

// how often we should check for new rulesets
let periodicity = 10;

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


// Get an object stored in localstorage
var getStoredLocalObject = object_key => {
  return new Promise(resolve => {
    chrome.storage.local.get(object_key, root => {
      resolve(root[object_key]);
    });
  });
};

// Get an object stored in localstorage
var setStoredLocalObject = (object_key, object_value) => {
  return new Promise(resolve => {
    var object = {};
    object[object_key] = object_value;
    chrome.storage.local.set(object, () => {
      resolve();
    });
  });
};

// Determine the time until we should check for new rulesets
async function timeToNextCheck() {
  let last_checked = await getStoredLocalObject('last-checked');
  if(last_checked === undefined) {
    return 0;
  } else {
    let current_timestamp = Date.now() / 1000;
    let secs_since_last_checked = current_timestamp - last_checked;
    return Math.max(0, periodicity - secs_since_last_checked);
  }
}

// Generic ajax promise
let xhr_promise = url => {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onreadystatechange = function(){
      if(this.readyState == 4 && this.status == 200) {
        resolve(this.response);
      }
    }
    xhr.send(null);
  });
}

// Check for new rulesets. If found, return the timestamp. If not, return false
async function checkForNewRulesets(update_channel) {

  let timestamp_promise = xhr_promise(update_channel.update_path_prefix + "/rulesets-timestamp");
  let rulesets_timestamp = Number(await timestamp_promise);

  if((await getStoredLocalObject('rulesets-timestamp: ' + update_channel.name) || 0) < rulesets_timestamp){
    return rulesets_timestamp;
  } else {
    return false;
  }
}

// Download and return new rulesets
async function getNewRulesets(rulesets_timestamp, update_channel) {

  setStoredLocalObject('rulesets-timestamp: ' + update_channel.name, rulesets_timestamp);

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
      )
      .then(async isvalid => {
        if(isvalid) {
          util.log(util.NOTE, update_channel.name + ': Downloaded ruleset signature checks out.  Storing rulesets.');
          await setStoredLocalObject('rulesets: ' + update_channel.name, new_rulesets.rulesets_gz_base64);
          resolve(true);
        } else {
          reject('Downloaded ruleset signature is invalid.  Aborting.');
        }
      })
      .catch(err => {
        reject('Downloaded ruleset signature could not be verified.  Aborting.');
      });
    })
    .catch(err => {
      reject('Downloaded ruleset signature could not be verified.  Aborting.');
    });
  });
}

// Base64 decode, unzip, and apply the rulesets we have stored.
async function applyStoredRulesets(){
  let rulesets_promises = [];
  for(let update_channel of update_channels){
    rulesets_promises.push(new Promise(resolve => {
      let key = 'rulesets: ' + update_channel.name
      chrome.storage.local.get(key, root => {
        if(root[key]){
          util.log(util.NOTE, update_channel.name + ': Applying stored rulesets.');

          let rulesets_gz = window.atob(root[key]);
          let rulesets_byte_array = pako.inflate(rulesets_gz);
          let rulesets = new TextDecoder("utf-8").decode(rulesets_byte_array);
          let rulesets_json = JSON.parse(rulesets);

          resolve(rulesets_json);
        } else {
          resolve();
        }
      });
    }));
  }

  let rulesets_jsons = await Promise.all(rulesets_promises);
  if(rulesets_jsons.join("").length > 0){
    background.all_rules = new rules.RuleSets(background.ls);
    for(let rulesets_json of rulesets_jsons){
      background.all_rules.addFromJson(rulesets_json);
    }
    background.loadStoredUserRules();
  }
}

/*
async function storeUpdateObjects() {
  let local_update_channels = await getStoredLocalObject('update-channels');
  if(local_update_channels == undefined){
    let update_promises = [];
    let update_channels_array = [];
    for(let update_channel of update_channels){
      update_promises.push(setStoredLocalObject(
        'update-channel-' + update_channel.name,
        update_channels
      ));

      update_channels_array.push(update_channel.name);
    }

    update_promises.push(setStoredLocalObject('update-channels', update_channels_array));
    await Promise.all(update_promises);
  }
}*/

// basic workflow for periodic checks
async function performCheck() {
  util.log(util.NOTE, 'Checking for new rulesets.');

  let current_timestamp = Date.now() / 1000;
  setStoredLocalObject('last-checked', current_timestamp);

  for(let update_channel of update_channels){
    let new_rulesets_timestamp = await checkForNewRulesets(update_channel);
    if(new_rulesets_timestamp){
      util.log(util.NOTE, update_channel.name + ': A new ruleset bundle has been released.  Downloading now.');
      let new_rulesets = await getNewRulesets(new_rulesets_timestamp, update_channel);
      try{
        await verifyAndStoreNewRulesets(new_rulesets, update_channel);
      } catch(err) {
        util.log(util.WARN, update_channel.name + ': ' + err);
      }
    }
  }
  applyStoredRulesets();
};


async function setUpRulesetsTimer(){
  let time_to_next_check = await timeToNextCheck();

  setTimeout(() => {
    performCheck();
    setInterval(performCheck, periodicity * 1000);
  }, time_to_next_check * 1000);
}


applyStoredRulesets();
setUpRulesetsTimer();

})(typeof exports == 'undefined' ? window.update = {} : exports);
