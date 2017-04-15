"use strict";

(function(exports) {

// how often we should check for new rulesets
let periodicity = 10;

// jwk key loaded from keys.js
let importedEffKey = window.crypto.subtle.importKey(
  "jwk",
  keys.eff,
  {
    name: "RSASSA-PKCS1-v1_5",
    hash: {name: "SHA-256"},
  },
  false,
  ["verify"]
);


// Determine the time until we should check for new rulesets
async function timeToNextCheck() {
  let last_checked = await getLastChecked();
  if(last_checked === undefined) {
    return 0;
  } else {
    let current_timestamp = Date.now() / 1000;
    let secs_since_last_checked = current_timestamp - last_checked;
    return Math.max(0, periodicity - secs_since_last_checked);
  }
}

// Get the time we last checked for new rulesets
function getLastChecked() {
  return new Promise(resolve => {
    chrome.storage.local.get("last-checked", root => {
      resolve(root['last-checked']);
    });
  });
}

// Get the currently applied rulesets timestamp
function getRulesetsTimestamp() {
  return new Promise(resolve => {
    chrome.storage.local.get("rulesets-timestamp", root => {
      resolve(root['rulesets-timestamp']);
    });
  });
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
async function checkForNewRulesets() {

  let current_timestamp = Date.now() / 1000;
  chrome.storage.local.set({
    'last-checked': current_timestamp
  });

  let timestamp_promise = xhr_promise("http://localhost:8000/rulesets-timestamp");
  let rulesets_timestamp = Number(await timestamp_promise);

  if((await getRulesetsTimestamp() || 0) < rulesets_timestamp){
    return rulesets_timestamp;
  } else {
    return false;
  }
}

// Download and return new rulesets
async function getNewRulesets(rulesets_timestamp) {

  chrome.storage.local.set({
    'rulesets-timestamp': rulesets_timestamp
  });

  let signature_promise = xhr_promise("http://localhost:8000/rulesets-signature.sha256.base64");
  let rulesets_promise = xhr_promise("http://localhost:8000/default.rulesets.gz.base64");

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
function verifyAndStoreNewRulesets(new_rulesets){
  return new Promise((resolve, reject) => {
    importedEffKey.then(publicKey => {
      window.crypto.subtle.verify(
        {
          name: "RSASSA-PKCS1-v1_5",
        },
        publicKey,
        new_rulesets.signature_byte_array.buffer,
        new_rulesets.rulesets_byte_array.buffer
      )
      .then(isvalid => {
        if(isvalid) {
          util.log(util.NOTE, 'Downloaded ruleset signature checks out.  Storing rulesets.');
          chrome.storage.local.set({
            rulesets: new_rulesets.rulesets_gz_base64
          });
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
  chrome.storage.local.get("rulesets", root => {
    if(root.rulesets){
      util.log(util.NOTE, 'Applying stored rulesets.');

      let rulesets_gz = window.atob(root.rulesets);
      let rulesets_byte_array = pako.inflate(rulesets_gz);
      let rulesets = new TextDecoder("utf-8").decode(rulesets_byte_array);

      background.all_rules = new rules.RuleSets(background.ls);
      background.all_rules.addFromJson(rulesets_json);
      background.loadStoredUserRules();
    }
  });
}

// basic workflow for periodic checks
async function performCheck(){
  util.log(util.NOTE, 'Checking for new ruleset bundle.');
  let new_rulesets_timestamp = await checkForNewRulesets();
  if(new_rulesets_timestamp){
    util.log(util.NOTE, 'A new ruleset bundle has been released.  Downloading now.');
    let new_rulesets = await getNewRulesets(new_rulesets_timestamp);
    try{
      await verifyAndStoreNewRulesets(new_rulesets);
      applyStoredRulesets();
    } catch(err) {
      util.log(util.WARN, err);
    }
  }
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
