"use strict";

(function(exports) {

const util = require('./util'),
  { RuleSets, Bloom } = wasm_bindgen;

async function initialize() {
  try {
    await wasm_bindgen(chrome.runtime.getURL('wasm/https_everywhere_lib_wasm_bg.wasm'));
  } catch(e) {
    util.log(util.WARN, 'The wasm library has not loaded correctly: ' + e);
  }
}

function is_enabled() {
  return true;
}

Object.assign(exports, {
  initialize,
  RuleSets,
  Bloom,
  is_enabled,
});

})(typeof exports == 'undefined' ? require.scopes.wasm = {} : exports);
